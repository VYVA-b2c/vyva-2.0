import { eq } from "drizzle-orm";
import { db, pool } from "../db.js";
import { profiles } from "../../shared/schema.js";
import { normalizeAppLanguage } from "../../shared/language.js";
import {
  appendConciergeExecutionAudit,
  buildConciergeExecutionTask,
  planConciergeConfirmedExecution,
  withConciergeExecutionTask,
  type ConciergeConfirmedExecutionPlan,
  type ConciergeExecutionAuditEvent,
  type ConciergeExecutionBuildInput,
  type ConciergeExecutionTask,
  type ConciergeExecutionTaskStatus,
} from "../../shared/conciergeActionExecution.js";
import { isConciergeDryRunPayload } from "../../shared/conciergeDryRun.js";
import {
  conciergeProductionChannelForTool,
  conciergeExecutionModeFromState,
  type ConciergeChannelReadinessResult,
  type ConciergeExecutionMode,
} from "../../shared/conciergeChannelReadiness.js";
import {
  conciergeChannelReadinessForTool,
  conciergeChannelReadinessForToolWithAdminSettings,
  loadConciergeActionAdapterRuntimeConfig,
} from "./conciergeChannelReadiness.js";
import {
  activeConciergeReconfirmationRequestFromPayload,
  resolveConciergeReconfirmationRequestInPayload,
} from "../../shared/conciergeReconfirmation.js";
import {
  executeConciergeActionAdapter,
  type ConciergeActionAdapterMode,
  type ConciergeActionAdapterResult,
} from "./conciergeActionAdapters.js";

export const CONCIERGE_USE_CASES = [
  "book_ride",
  "order_medicine",
  "book_appointment",
  "home_service",
  "find_provider",
  "find_offers",
  "paperwork",
  "admin_task",
  "scam_check",
  "shopping_request",
  "insurance_admin",
  "travel",
  "send_message",
  "order_food",
] as const;

export type ConciergeUseCase = (typeof CONCIERGE_USE_CASES)[number];

type TriggerSource =
  | "user_request"
  | "agent_confirmed"
  | "automation"
  | "no_contact_nudge"
  | "manual";

export interface ConciergeTriggerInput {
  userId: string;
  useCase: ConciergeUseCase;
  providerId?: string | null;
  providerName?: string | null;
  providerPhone?: string | null;
  foundExternally?: boolean;
  actionSummary: string;
  actionPayload: Record<string, unknown>;
  language?: string | null;
  triggerSource?: TriggerSource;
  autoStart?: boolean;
}

interface BasicProfile {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  date_of_birth: string | null;
  language: string;
  language_preference: string | null;
}

export interface PendingRow {
  id: string;
  user_id: string;
  use_case: ConciergeUseCase;
  provider_id: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  found_externally: boolean;
  action_summary: string;
  action_payload: Record<string, unknown> | null;
  language: string;
  status: string;
}

export interface TriggerResult {
  pendingId: string;
  status: string;
  conversationId: string | null;
  callSid: string | null;
  message: string;
  historySessionId?: string | null;
}

export interface CompleteResult {
  ok: true;
  status: "completed";
  sessionId: string | null;
}

export interface PendingActionDetailsUpdateInput {
  actionPayload: Record<string, unknown>;
  answerKey?: string | null;
  answerValue?: string | null;
}

export interface PendingActionDetailsUpdateResult {
  ok: true;
  item: PendingRow;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function formatList(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return items.length > 0 ? items.join(", ") : undefined;
  }
  return asString(value);
}

function missingLabels(plan: ConciergeConfirmedExecutionPlan): string {
  return plan.missing_requirements
    .map((requirement) => requirement.label_en)
    .filter(Boolean)
    .join(", ");
}

function isDryRunPending(pending: PendingRow): boolean {
  return isConciergeDryRunPayload(pending.action_payload);
}

async function planForPendingConciergeAction(pending: PendingRow): Promise<ConciergeConfirmedExecutionPlan> {
  const preliminaryTask = buildConciergeExecutionTask({
    useCase: pending.use_case,
    payload: pending.action_payload ?? {},
    providerName: pending.provider_name,
    providerPhone: pending.provider_phone,
    summary: pending.action_summary,
    pendingStatus: pending.status,
  });
  const channelReadiness = await conciergeChannelReadinessForToolWithAdminSettings({
    tool: preliminaryTask.active_tool,
    dryRun: Boolean(preliminaryTask.dry_run),
  });

  return planConciergeConfirmedExecution({
    useCase: pending.use_case,
    payload: pending.action_payload ?? {},
    providerName: pending.provider_name,
    providerPhone: pending.provider_phone,
    summary: pending.action_summary,
    pendingStatus: pending.status,
    channelReadiness,
  });
}

function executionTaskFromPayload(payload: Record<string, unknown> | null | undefined): ConciergeExecutionTask | null {
  const task = payload?.execution_task;
  if (!task || typeof task !== "object" || Array.isArray(task)) return null;
  return (task as ConciergeExecutionTask).version === 1 ? task as ConciergeExecutionTask : null;
}

function adapterResultFromPayload(payload: Record<string, unknown> | null | undefined): ConciergeActionAdapterResult | null {
  const result = payload?.execution_adapter;
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  return (result as ConciergeActionAdapterResult).version === 1 ? result as ConciergeActionAdapterResult : null;
}

const USER_RECONFIRMATION_CONFIRMATION_SOURCES = new Set([
  "agent_confirmed",
  "auto_start",
  "confirm_endpoint",
  "user_controlled_execution",
  "user_confirmed",
]);

function shouldResolveReconfirmationRequest(options: { userConfirmed?: boolean; confirmationSource?: string }): boolean {
  return Boolean(
    options.userConfirmed === true
      && options.confirmationSource
      && USER_RECONFIRMATION_CONFIRMATION_SOURCES.has(options.confirmationSource),
  );
}

function reconfirmationApprovalReason(pending: PendingRow): string | undefined {
  return activeConciergeReconfirmationRequestFromPayload(pending.action_payload ?? {})
    ? "updated_details_approved"
    : undefined;
}

function withServerConciergeExecutionTask(
  input: ConciergeExecutionBuildInput,
): Record<string, unknown> {
  const preliminaryTask = buildConciergeExecutionTask(input);
  const channelReadiness = input.channelReadiness ?? conciergeChannelReadinessForTool({
    tool: preliminaryTask.active_tool,
    dryRun: Boolean(preliminaryTask.dry_run),
  });
  const externalActionAllowed = input.externalActionAllowed ?? preliminaryTask.external_action_allowed;
  const executionMode = input.executionMode ?? conciergeExecutionModeFromState({
    dryRun: Boolean(preliminaryTask.dry_run),
    externalActionAllowed,
    channelReadiness,
  });

  return withConciergeExecutionTask({
    ...input,
    channelReadiness,
    externalActionAllowed,
    executionMode,
  });
}

async function adminChannelReadinessForBuildInput(
  input: ConciergeExecutionBuildInput,
): Promise<ConciergeChannelReadinessResult> {
  const preliminaryTask = buildConciergeExecutionTask(input);
  return conciergeChannelReadinessForToolWithAdminSettings({
    tool: preliminaryTask.active_tool,
    dryRun: Boolean(preliminaryTask.dry_run),
  });
}

function normalizeLanguage(language?: string | null, fallback = "es"): string {
  return normalizeAppLanguage(language, normalizeAppLanguage(fallback, "es"));
}

function firstName(profile: BasicProfile): string {
  return (
    profile.preferred_name?.trim() ||
    profile.full_name?.trim().split(/\s+/)[0] ||
    "cliente"
  );
}

function buildDynamicVariables(pending: PendingRow, profile: BasicProfile): Record<string, string> {
  const payload = pending.action_payload ?? {};
  const profileLanguage = normalizeLanguage(profile.language_preference ?? profile.language, "es");
  const dynamicVariables: Record<string, string> = {
    concierge_pending_id: pending.id,
    user_id: pending.user_id,
    use_case: pending.use_case,
    language: normalizeLanguage(pending.language, profileLanguage),
    senior_name: firstName(profile),
  };

  const dob = asString(profile.date_of_birth);
  if (dob) dynamicVariables.date_of_birth = dob;

  const mappings: Array<[string, unknown, "string" | "list"]> = [
    ["pickup_address", payload.pickup_address, "string"],
    ["destination_name", payload.destination_name, "string"],
    ["destination_address", payload.destination_address, "string"],
    ["requested_time", payload.requested_time, "string"],
    ["requested_date", payload.requested_date, "string"],
    ["provider_notes", payload.provider_notes, "string"],
    ["medications", payload.medications, "list"],
    ["delivery_address", payload.delivery_address, "string"],
    ["preferred_delivery", payload.preferred_delivery, "string"],
    ["doctor_name", payload.doctor_name, "string"],
    ["practice_name", payload.practice_name, "string"],
    ["preferred_days", payload.preferred_days, "list"],
    ["preferred_time", payload.preferred_time, "string"],
    ["urgency", payload.urgency, "string"],
    ["reason", payload.reason, "string"],
  ];

  for (const [key, value, mode] of mappings) {
    const formatted = mode === "list" ? formatList(value) : asString(value);
    if (formatted) dynamicVariables[key] = formatted;
  }

  return dynamicVariables;
}

async function ensureProfile(userId: string, language: string) {
  await db
    .insert(profiles)
    .values({
      id: userId,
      language,
      language_preference: language,
    })
    .onConflictDoNothing();
}

async function loadProfile(userId: string): Promise<BasicProfile> {
  const rows = await db
    .select({
      id: profiles.id,
      full_name: profiles.full_name,
      preferred_name: profiles.preferred_name,
      date_of_birth: profiles.date_of_birth,
      language: profiles.language,
      language_preference: profiles.language_preference,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const profile = rows[0];
  if (profile) return profile;

  return {
    id: userId,
    full_name: null,
    preferred_name: null,
    date_of_birth: null,
    language: "es",
    language_preference: null,
  };
}

async function insertPending(input: ConciergeTriggerInput, language: string): Promise<PendingRow> {
  const basePayload = {
    ...input.actionPayload,
    _meta: {
      ...(typeof input.actionPayload._meta === "object" && input.actionPayload._meta !== null
        ? (input.actionPayload._meta as Record<string, unknown>)
        : {}),
      trigger_source: input.triggerSource ?? "user_request",
      created_via: "concierge_trigger_api",
    },
  };
  const now = new Date().toISOString();
  const buildInput = {
    useCase: input.useCase,
    payload: appendConciergeExecutionAudit(basePayload, {
      event: "created",
      at: now,
      source: input.triggerSource ?? "user_request",
      pending_status: "pending",
      user_confirmed: false,
      external_action_allowed: false,
    }),
    providerName: input.providerName,
    providerPhone: input.providerPhone,
    summary: input.actionSummary,
    pendingStatus: "pending",
    userConfirmed: false,
    now,
  } satisfies ConciergeExecutionBuildInput;
  const actionPayload = withServerConciergeExecutionTask({
    ...buildInput,
    channelReadiness: await adminChannelReadinessForBuildInput(buildInput),
  });

  const result = await pool.query<PendingRow>(
    `
      insert into concierge_pending (
        user_id,
        use_case,
        provider_id,
        provider_name,
        provider_phone,
        found_externally,
        action_summary,
        action_payload,
        language
      )
      values ($1, $2, $3::uuid, $4, $5, $6, $7, $8::jsonb, $9)
      returning
        id,
        user_id,
        use_case,
        provider_id::text,
        provider_name,
        provider_phone,
        found_externally,
        action_summary,
        action_payload,
        language,
        status
    `,
    [
      input.userId,
      input.useCase,
      input.providerId ?? null,
      input.providerName ?? null,
      input.providerPhone ?? null,
      input.foundExternally ?? false,
      input.actionSummary,
      JSON.stringify(actionPayload),
      language,
    ],
  );

  return result.rows[0]!;
}

async function updatePendingStatus(
  pending: PendingRow,
  status: "pending" | "calling" | "completed" | "failed" | "cancelled",
  options: {
    lifecycleStatus?: ConciergeExecutionTaskStatus;
    userConfirmed?: boolean;
    confirmationSource?: string;
    failureReason?: string;
    outcome?: string;
    auditEvent?: ConciergeExecutionAuditEvent;
    auditMode?: ConciergeConfirmedExecutionPlan["mode"];
    auditReason?: string;
    auditPlan?: ConciergeConfirmedExecutionPlan;
    channelReadiness?: ConciergeChannelReadinessResult;
    externalActionAllowed?: boolean;
    executionMode?: ConciergeExecutionMode;
    adapterResult?: ConciergeActionAdapterResult | null;
  } = {},
) {
  const now = new Date().toISOString();
  const dryRun = isDryRunPending(pending);
  const payloadWithAdapter = options.adapterResult
    ? { ...(pending.action_payload ?? {}), execution_adapter: options.adapterResult }
    : pending.action_payload ?? {};
  const auditedPayload = options.auditEvent
    ? appendConciergeExecutionAudit(payloadWithAdapter, {
        event: options.auditEvent,
        at: now,
        source: options.confirmationSource ?? "concierge_actions_service",
        pending_status: status,
        lifecycle_status: options.lifecycleStatus,
        mode: options.auditMode,
        requested_tool: options.auditPlan?.requested_tool,
        active_tool: options.auditPlan?.active_tool,
        action_type: options.auditPlan?.action_type,
        user_confirmed: options.userConfirmed,
        external_action_allowed: options.externalActionAllowed ?? false,
        execution_mode: options.executionMode ?? options.auditPlan?.execution_mode,
        channel_readiness: options.channelReadiness ?? options.auditPlan?.channel_readiness,
        adapter_result: options.adapterResult ?? undefined,
        dry_run: options.auditPlan?.dry_run ?? dryRun,
        reason: options.auditReason ?? options.failureReason,
        missing_requirements: options.auditPlan?.missing_requirements,
      })
    : payloadWithAdapter;
  const resolvedReconfirmation = shouldResolveReconfirmationRequest(options)
    ? resolveConciergeReconfirmationRequestInPayload(auditedPayload, {
        resolvedAt: now,
        resolvedSource: options.confirmationSource,
      })
    : { payload: auditedPayload, request: null };
  const basePayload = resolvedReconfirmation.request
    ? appendConciergeExecutionAudit(resolvedReconfirmation.payload, {
        event: "user_reconfirmed",
        at: now,
        source: options.confirmationSource ?? "concierge_actions_service",
        pending_status: status,
        lifecycle_status: options.lifecycleStatus,
        mode: options.auditMode,
        requested_tool: options.auditPlan?.requested_tool,
        active_tool: options.auditPlan?.active_tool,
        action_type: options.auditPlan?.action_type,
        user_confirmed: true,
        external_action_allowed: false,
        execution_mode: "manual_review",
        channel_readiness: options.channelReadiness ?? options.auditPlan?.channel_readiness,
        reason: "updated_details_approved",
      })
    : resolvedReconfirmation.payload;
  const actionPayload = withServerConciergeExecutionTask({
    useCase: pending.use_case,
    payload: basePayload,
    providerName: pending.provider_name,
    providerPhone: pending.provider_phone,
    summary: pending.action_summary,
    pendingStatus: status,
    lifecycleStatus: options.lifecycleStatus,
    userConfirmed: options.userConfirmed,
    confirmationSource: options.confirmationSource,
    channelReadiness: options.channelReadiness ?? options.auditPlan?.channel_readiness,
    externalActionAllowed: options.externalActionAllowed,
    executionMode: options.executionMode ?? options.auditPlan?.execution_mode,
    adapterResult: options.adapterResult ?? undefined,
    failureReason: options.failureReason,
    outcome: options.outcome,
    now,
  });

  await pool.query(
    `
      update concierge_pending
      set status = $2, action_payload = $3::jsonb, updated_at = now()
      where id = $1::uuid
    `,
    [pending.id, status, JSON.stringify(actionPayload)],
  );
  pending.status = status;
  pending.action_payload = actionPayload;
}

function isSuccessfulLiveEmailAdapterResult(
  result: ConciergeActionAdapterResult | null | undefined,
): result is ConciergeActionAdapterResult {
  return Boolean(
    result
      && result.mode === "live"
      && result.channel === "email"
      && result.status === "sent"
      && result.external_action_allowed,
  );
}

async function recordSuccessfulLiveEmailReceipt(
  pending: PendingRow,
  adapterResult: ConciergeActionAdapterResult,
): Promise<string | null> {
  const actionPayload = pending.action_payload ?? {};
  const executionTask = executionTaskFromPayload(actionPayload);
  const providerName = pending.provider_name?.trim()
    || adapterResult.provider_name?.trim()
    || adapterResult.provider_contact?.trim()
    || "Email recipient";
  const providerEmail = adapterResult.provider_contact?.trim()
    || asString(actionPayload.provider_email)
    || asString(actionPayload.recipient_email)
    || null;
  const outcomeSummary = providerEmail
    ? `Email sent to ${providerName} (${providerEmail}). Waiting for provider reply.`
    : `Email sent to ${providerName}. Waiting for provider reply.`;
  const outcomePayload = {
    flow_reference: asString(actionPayload.flow_reference) ?? executionTask?.flow_reference ?? null,
    receipt_kind: "provider_contact_sent",
    email_outcome: "sent",
    execution_channel: "email",
    execution_mode: "live",
    live_action: true,
    external_action_allowed: true,
    confirmation_required: true,
    user_confirmed: executionTask?.user_confirmed === true,
    confirmation_source: executionTask?.confirmation_source ?? "user_controlled_execution",
    provider_name: providerName,
    provider_email: providerEmail,
    recipient_email: providerEmail,
    provider_message_id: adapterResult.result_id ?? null,
    adapter: adapterResult.adapter,
    adapter_mode: adapterResult.mode,
    adapter_channel: adapterResult.channel,
    adapter_provider: adapterResult.provider_name,
    adapter_provider_contact: adapterResult.provider_contact,
    adapter_attempted_at: adapterResult.attempted_at,
    adapter_status: adapterResult.status,
    adapter_result: adapterResult,
    execution_task: executionTask,
    live_handoff_status: "waiting",
    live_handoff_outcome: "email_sent",
    provider_follow_up_status: "waiting",
    waiting_for_provider: true,
    mission_status: "awaiting_provider_reply",
    sent_at: adapterResult.attempted_at,
  };

  const result = await pool.query<{ id: string }>(
    `
      with existing as (
        select id
        from concierge_sessions
        where pending_id = $1::uuid
          and outcome = 'completed'
          and outcome_payload->>'receipt_kind' = 'provider_contact_sent'
          and outcome_payload->>'adapter_channel' = 'email'
        order by completed_at desc nulls last
        limit 1
      ), inserted as (
        insert into concierge_sessions (
          user_id,
          pending_id,
          use_case,
          provider_id,
          provider_name,
          provider_phone,
          found_externally,
          action_summary,
          action_payload,
          outcome,
          outcome_payload,
          outcome_summary,
          completed_at
        )
        select
          $2,
          $1::uuid,
          $3,
          $4::uuid,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          'completed',
          $10::jsonb,
          $11,
          $12::timestamptz
        where not exists (select 1 from existing)
        returning id
      )
      select id from inserted
      union all
      select id from existing
      limit 1
    `,
    [
      pending.id,
      pending.user_id,
      pending.use_case,
      pending.provider_id,
      providerName,
      pending.provider_phone,
      pending.found_externally,
      pending.action_summary,
      JSON.stringify(actionPayload),
      JSON.stringify(outcomePayload),
      outcomeSummary,
      adapterResult.attempted_at,
    ],
  );

  return result.rows[0]?.id ?? null;
}

async function loadPendingById(pendingId: string): Promise<PendingRow | null> {
  const result = await pool.query<PendingRow>(
    `
      select
        id,
        user_id,
        use_case,
        provider_id::text,
        provider_name,
        provider_phone,
        found_externally,
        action_summary,
        action_payload,
        language,
        status
      from concierge_pending
      where id = $1::uuid
      limit 1
    `,
    [pendingId],
  );

  return result.rows[0] ?? null;
}

export async function updatePendingConciergeActionDetails(
  pendingId: string,
  userId: string,
  input: PendingActionDetailsUpdateInput,
): Promise<PendingActionDetailsUpdateResult> {
  const pending = await loadPendingById(pendingId);
  if (!pending) {
    throw new Error("Concierge action not found.");
  }
  if (pending.user_id !== userId) {
    throw new Error("You do not have access to this concierge action.");
  }
  if (pending.status === "completed" || pending.status === "failed" || pending.status === "cancelled") {
    throw new Error(`Concierge action cannot be updated from status "${pending.status}".`);
  }

  const currentPayload = pending.action_payload ?? {};
  const patchMeta = asRecord(input.actionPayload._meta);
  const patchPayload = Object.fromEntries(
    Object.entries(input.actionPayload).filter(([key]) => key !== "_meta"),
  );
  const currentMeta = asRecord(currentPayload._meta);
  const currentAnswers = asRecord(currentMeta.guided_detail_answers);
  const nextAnswers = input.answerKey
    ? {
        ...currentAnswers,
        [input.answerKey]: input.answerValue ?? patchPayload[input.answerKey] ?? "",
      }
    : currentAnswers;

  const nextPayloadBase = {
    ...currentPayload,
    ...patchPayload,
    _meta: {
      ...currentMeta,
      ...patchMeta,
      ...(Object.keys(nextAnswers).length > 0 ? { guided_detail_answers: nextAnswers } : {}),
      guided_detail_updated_at: new Date().toISOString(),
    },
  };

  const buildInput = {
    useCase: pending.use_case,
    payload: nextPayloadBase,
    providerName: pending.provider_name,
    providerPhone: pending.provider_phone,
    summary: pending.action_summary,
    pendingStatus: pending.status,
  } satisfies ConciergeExecutionBuildInput;
  const actionPayload = withServerConciergeExecutionTask({
    ...buildInput,
    channelReadiness: await adminChannelReadinessForBuildInput(buildInput),
  });

  const result = await pool.query<PendingRow>(
    `
      update concierge_pending
      set action_payload = $3::jsonb, updated_at = now()
      where id = $1::uuid
        and user_id = $2
      returning
        id,
        user_id,
        use_case,
        provider_id::text,
        provider_name,
        provider_phone,
        found_externally,
        action_summary,
        action_payload,
        language,
        status
    `,
    [pending.id, userId, JSON.stringify(actionPayload)],
  );

  const item = result.rows[0];
  if (!item) {
    throw new Error("Concierge action could not be updated.");
  }
  return { ok: true, item };
}

function adapterAuditEvent(result: ConciergeActionAdapterResult): ConciergeExecutionAuditEvent {
  if (result.status === "sent") return "adapter_execution_succeeded";
  if (result.status === "simulated") return "adapter_execution_simulated";
  if (result.status === "blocked") return "adapter_execution_blocked";
  return "adapter_execution_failed";
}

function adapterModeForPlan(plan: ConciergeConfirmedExecutionPlan): ConciergeActionAdapterMode {
  return plan.dry_run ? "dry_run" : "live";
}

async function adapterRuntimeConfigForPlan(plan: ConciergeConfirmedExecutionPlan): Promise<{
  liveEndpointUrl: string | null;
  qaTarget: string | null;
}> {
  const channel = conciergeProductionChannelForTool(plan.active_tool);
  if (!channel) return { liveEndpointUrl: null, qaTarget: null };
  return loadConciergeActionAdapterRuntimeConfig(channel);
}

async function runConfirmedConciergeActionAdapter(
  pending: PendingRow,
  profile: BasicProfile,
  confirmationSource = "confirm_endpoint",
  plan: ConciergeConfirmedExecutionPlan,
): Promise<TriggerResult> {
  const adapterRuntimeConfig = await adapterRuntimeConfigForPlan(plan);
  const adapterResult = await executeConciergeActionAdapter({
    mode: adapterModeForPlan(plan),
    tool: plan.active_tool,
    payload: pending.action_payload ?? {},
    providerName: pending.provider_name,
    providerPhone: pending.provider_phone,
    pendingId: pending.id,
    userId: pending.user_id,
    summary: pending.action_summary,
    userConfirmed: true,
    dryRun: Boolean(plan.dry_run),
    channelReadiness: plan.channel_readiness,
    dynamicVariables: buildDynamicVariables(pending, profile),
    liveEndpointUrl: adapterRuntimeConfig.liveEndpointUrl,
    qaTarget: adapterRuntimeConfig.qaTarget,
  });

  if (adapterResult.status === "blocked") {
    await updatePendingStatus(pending, "pending", {
      lifecycleStatus: "needs_info",
      userConfirmed: false,
      confirmationSource,
      failureReason: "channel_not_ready",
      auditEvent: "adapter_execution_blocked",
      auditMode: plan.mode,
      auditReason: adapterResult.blocker ?? "adapter_blocked",
      auditPlan: plan,
      channelReadiness: plan.channel_readiness,
      externalActionAllowed: false,
      executionMode: "blocked",
      adapterResult,
    });
    throw new Error(channelNotReadyMessage(plan));
  }

  if (adapterResult.status === "failed") {
    await updatePendingStatus(pending, "failed", {
      userConfirmed: true,
      confirmationSource,
      failureReason: adapterResult.error ?? "adapter_execution_failed",
      auditEvent: "adapter_execution_failed",
      auditMode: plan.mode,
      auditReason: adapterResult.error ?? "adapter_execution_failed",
      auditPlan: plan,
      channelReadiness: plan.channel_readiness,
      externalActionAllowed: plan.channel_readiness.external_action_allowed,
      executionMode: plan.channel_readiness.external_action_allowed ? "live" : "blocked",
      adapterResult,
    });
    throw new Error(adapterResult.error ?? "Concierge action adapter failed.");
  }

  const pendingStatus = adapterResult.status === "sent" && plan.active_tool === "phone_call" ? "calling" : "pending";
  await updatePendingStatus(pending, pendingStatus, {
    lifecycleStatus: adapterResult.status === "sent" && plan.active_tool === "phone_call" ? "in_progress" : "confirmed",
    userConfirmed: true,
    confirmationSource,
    outcome: pending.action_summary,
    auditEvent: adapterAuditEvent(adapterResult),
    auditMode: plan.mode,
    auditReason: adapterResult.blocker ?? adapterResult.error ?? adapterResult.result,
    auditPlan: plan,
    channelReadiness: plan.channel_readiness,
    externalActionAllowed: adapterResult.status === "sent",
    executionMode: adapterResult.status === "simulated" ? "simulated" : "live",
    adapterResult,
  });

  return {
    pendingId: pending.id,
    status: pendingStatus,
    conversationId: adapterResult.channel === "phone_call" ? adapterResult.result_id ?? null : null,
    callSid: null,
    message: adapterResult.status === "simulated"
      ? "Dry-run confirmed. VYVA recorded the simulated adapter handoff without contacting anyone."
      : adapterResult.result,
  };
}

export async function triggerConciergeAction(input: ConciergeTriggerInput): Promise<TriggerResult> {
  const language = normalizeLanguage(input.language ?? null, "es");
  await ensureProfile(input.userId, language);
  const pending = await insertPending(input, language);

  if (input.autoStart === false) {
    return {
      pendingId: pending.id,
      status: pending.status,
      conversationId: null,
      callSid: null,
      message: "Concierge action saved and waiting to start.",
    };
  }

  const profile = await loadProfile(input.userId);
  return confirmLoadedPendingConciergeAction(pending, profile, input.triggerSource ?? "auto_start");
}

async function queueConfirmedConciergeAction(
  pending: PendingRow,
  profile: BasicProfile,
  confirmationSource: string,
  plan: ConciergeConfirmedExecutionPlan,
  reason?: string,
): Promise<TriggerResult> {
  const existingAdapterResult = adapterResultFromPayload(pending.action_payload);
  if (isSuccessfulLiveEmailAdapterResult(existingAdapterResult)) {
    const historySessionId = await recordSuccessfulLiveEmailReceipt(pending, existingAdapterResult);
    return {
      pendingId: pending.id,
      status: pending.status,
      conversationId: null,
      callSid: null,
      message: existingAdapterResult.result,
      historySessionId,
    };
  }

  const liveUserControlledChannel = Boolean(
    !plan.dry_run &&
    !reason &&
    plan.channel_readiness.channel &&
    plan.channel_readiness.external_action_allowed,
  );
  const adapterRuntimeConfig = plan.dry_run || liveUserControlledChannel
    ? await adapterRuntimeConfigForPlan(plan)
    : { liveEndpointUrl: null, qaTarget: null };
  const adapterResult = plan.dry_run || liveUserControlledChannel
    ? await executeConciergeActionAdapter({
        mode: plan.dry_run ? "dry_run" : "live",
        tool: plan.active_tool,
        payload: pending.action_payload ?? {},
        providerName: pending.provider_name,
        providerPhone: pending.provider_phone,
        pendingId: pending.id,
        userId: pending.user_id,
        summary: pending.action_summary,
        userConfirmed: true,
        dryRun: Boolean(plan.dry_run),
        channelReadiness: plan.channel_readiness,
        dynamicVariables: buildDynamicVariables(pending, profile),
        liveEndpointUrl: adapterRuntimeConfig.liveEndpointUrl,
        qaTarget: adapterRuntimeConfig.qaTarget,
      })
    : null;

  if (adapterResult?.status === "blocked") {
    await updatePendingStatus(pending, "pending", {
      lifecycleStatus: "needs_info",
      userConfirmed: false,
      confirmationSource,
      failureReason: "channel_not_ready",
      auditEvent: "adapter_execution_blocked",
      auditMode: plan.mode,
      auditReason: adapterResult.blocker ?? "adapter_blocked",
      auditPlan: plan,
      channelReadiness: plan.channel_readiness,
      externalActionAllowed: false,
      executionMode: "blocked",
      adapterResult,
    });
    throw new Error(channelNotReadyMessage(plan));
  }

  if (adapterResult?.status === "failed") {
    await updatePendingStatus(pending, "failed", {
      lifecycleStatus: "failed",
      userConfirmed: true,
      confirmationSource,
      failureReason: adapterResult.error ?? "adapter_execution_failed",
      auditEvent: "adapter_execution_failed",
      auditMode: plan.mode,
      auditReason: adapterResult.error ?? "adapter_execution_failed",
      auditPlan: plan,
      channelReadiness: plan.channel_readiness,
      externalActionAllowed: liveUserControlledChannel,
      executionMode: liveUserControlledChannel ? "live" : plan.execution_mode,
      adapterResult,
    });
    throw new Error(adapterResult.error ?? "Concierge action adapter failed.");
  }

  await updatePendingStatus(pending, "pending", {
    lifecycleStatus: "confirmed",
    userConfirmed: true,
    confirmationSource,
    outcome: pending.action_summary,
    auditEvent: adapterResult ? adapterAuditEvent(adapterResult) : "operator_handoff_queued",
    auditMode: plan.mode,
    auditReason: adapterResult?.result ?? reason ?? plan.operator_fallback_reason,
    auditPlan: plan,
    channelReadiness: plan.channel_readiness,
    externalActionAllowed: adapterResult?.status === "sent" ? true : liveUserControlledChannel,
    executionMode: adapterResult?.status === "simulated" ? "simulated" : (liveUserControlledChannel ? "live" : plan.execution_mode),
    adapterResult,
  });

  const historySessionId = isSuccessfulLiveEmailAdapterResult(adapterResult)
    ? await recordSuccessfulLiveEmailReceipt(pending, adapterResult)
    : null;

  return {
    pendingId: pending.id,
    status: "pending",
    conversationId: null,
    callSid: null,
    historySessionId,
    message: adapterResult?.status === "simulated"
      ? "Dry-run confirmed. VYVA recorded the simulated adapter handoff without contacting anyone."
      : (adapterResult?.status === "sent"
        ? adapterResult.result
        : reason === "updated_details_approved"
          ? "Updated Concierge action approved and ready for VYVA retry."
        : reason
        ? `Concierge action confirmed and queued for VYVA review (${reason}).`
        : plan.message),
  };
}

async function markPendingNeedsInfo(
  pending: PendingRow,
  confirmationSource: string,
  plan: ConciergeConfirmedExecutionPlan,
): Promise<void> {
  await updatePendingStatus(pending, "pending", {
    lifecycleStatus: "needs_info",
    userConfirmed: false,
    confirmationSource,
    failureReason: "missing_requirements",
    auditEvent: "blocked_missing_info",
    auditMode: "needs_info",
    auditReason: missingLabels(plan) || "missing_requirements",
    auditPlan: plan,
    externalActionAllowed: false,
  });
}

function channelNotReadyMessage(plan: ConciergeConfirmedExecutionPlan): string {
  const label = plan.channel_readiness.label || "Requested channel";
  const blockers = plan.channel_readiness.blockers.join(", ");
  return blockers
    ? `The ${label.toLowerCase()} channel is not ready for live Concierge actions (${blockers}).`
    : `The ${label.toLowerCase()} channel is not ready for live Concierge actions.`;
}

async function markPendingChannelBlocked(
  pending: PendingRow,
  confirmationSource: string,
  plan: ConciergeConfirmedExecutionPlan,
): Promise<void> {
  const adapterRuntimeConfig = await adapterRuntimeConfigForPlan(plan);
  const adapterResult = plan.channel_readiness.channel
    ? await executeConciergeActionAdapter({
        mode: "live",
        tool: plan.active_tool,
        payload: pending.action_payload ?? {},
        providerName: pending.provider_name,
        providerPhone: pending.provider_phone,
        pendingId: pending.id,
        userId: pending.user_id,
        summary: pending.action_summary,
        userConfirmed: true,
        dryRun: Boolean(plan.dry_run),
        channelReadiness: plan.channel_readiness,
        liveEndpointUrl: adapterRuntimeConfig.liveEndpointUrl,
        qaTarget: adapterRuntimeConfig.qaTarget,
      }).catch(() => null)
    : null;
  await updatePendingStatus(pending, "pending", {
    lifecycleStatus: "needs_info",
    userConfirmed: false,
    confirmationSource,
    failureReason: "channel_not_ready",
    auditEvent: adapterResult ? adapterAuditEvent(adapterResult) : "blocked_channel_not_ready",
    auditMode: plan.mode,
    auditReason: adapterResult?.blocker ?? (plan.channel_readiness.blockers.join(", ") || "channel_not_ready"),
    auditPlan: plan,
    channelReadiness: plan.channel_readiness,
    externalActionAllowed: false,
    executionMode: "blocked",
    adapterResult,
  });
}

async function confirmLoadedPendingConciergeAction(
  pending: PendingRow,
  profile: BasicProfile,
  confirmationSource = "confirm_endpoint",
): Promise<TriggerResult> {
  const plan = await planForPendingConciergeAction(pending);
  const reconfirmationReason = reconfirmationApprovalReason(pending);

  if (plan.mode === "needs_info") {
    await markPendingNeedsInfo(pending, confirmationSource, plan);
    const labels = missingLabels(plan);
    throw new Error(labels ? `Complete before confirming: ${labels}.` : plan.message);
  }

  if (reconfirmationReason) {
    const queuedPlan = plan.mode === "direct_phone_call"
      ? {
          ...plan,
          mode: "operator_queue" as const,
          pending_status: "pending" as const,
          lifecycle_status: "confirmed" as const,
          external_action_allowed: false,
          execution_mode: "manual_review" as const,
          message: "Updated Concierge action approved and ready for VYVA retry.",
        }
      : plan;
    return queueConfirmedConciergeAction(pending, profile, confirmationSource, queuedPlan, reconfirmationReason);
  }

  if (plan.mode === "direct_phone_call") {
    return runConfirmedConciergeActionAdapter(pending, profile, confirmationSource, plan);
  }

  return queueConfirmedConciergeAction(pending, profile, confirmationSource, plan);
}

export async function startPendingConciergeAction(
  pendingId: string,
  userId: string,
  confirmationSource = "confirm_endpoint",
): Promise<TriggerResult> {
  const pending = await loadPendingById(pendingId);
  if (!pending) {
    throw new Error("Concierge action not found.");
  }
  if (pending.user_id !== userId) {
    throw new Error("You do not have access to this concierge action.");
  }
  if (pending.status === "calling") {
    return {
      pendingId: pending.id,
      status: pending.status,
      conversationId: null,
      callSid: null,
      message: "Concierge action is already in progress.",
    };
  }
  if (pending.status === "completed" || pending.status === "failed" || pending.status === "cancelled") {
    throw new Error(`Concierge action cannot be started from status "${pending.status}".`);
  }

  const profile = await loadProfile(userId);
  return confirmLoadedPendingConciergeAction(pending, profile, confirmationSource);
}

export async function confirmPendingConciergeActionReview(
  pendingId: string,
  userId: string,
  confirmationSource = "user_controlled_execution",
): Promise<TriggerResult> {
  const pending = await loadPendingById(pendingId);
  if (!pending) {
    throw new Error("Concierge action not found.");
  }
  if (pending.user_id !== userId) {
    throw new Error("You do not have access to this concierge action.");
  }
  if (pending.status === "completed" || pending.status === "failed" || pending.status === "cancelled") {
    throw new Error(`Concierge action cannot be confirmed from status "${pending.status}".`);
  }

  const plan = await planForPendingConciergeAction(pending);
  const reconfirmationReason = reconfirmationApprovalReason(pending);

  if (plan.mode === "needs_info") {
    await markPendingNeedsInfo(pending, confirmationSource, plan);
    const labels = missingLabels(plan);
    throw new Error(labels ? `Complete before confirming: ${labels}.` : plan.message);
  }

  if (!reconfirmationReason && !plan.dry_run && plan.channel_readiness.channel && !plan.channel_readiness.external_action_allowed) {
    await markPendingChannelBlocked(pending, confirmationSource, plan);
    throw new Error(channelNotReadyMessage(plan));
  }

  const profile = await loadProfile(userId);
  const queuedPlan = reconfirmationReason && plan.mode === "direct_phone_call"
    ? {
        ...plan,
        mode: "user_controlled_handoff" as const,
        pending_status: "pending" as const,
        lifecycle_status: "confirmed" as const,
        external_action_allowed: false,
        execution_mode: "manual_review" as const,
        message: "Updated Concierge action approved and ready for VYVA retry.",
      }
    : {
        ...plan,
        mode: "user_controlled_handoff" as const,
      };
  return queueConfirmedConciergeAction(pending, profile, confirmationSource, queuedPlan, reconfirmationReason);
}

export async function cancelPendingConciergeAction(pendingId: string, userId: string): Promise<void> {
  const pending = await loadPendingById(pendingId);
  if (!pending) {
    throw new Error("Concierge action not found.");
  }
  if (pending.user_id !== userId) {
    throw new Error("You do not have access to this concierge action.");
  }
  if (pending.status === "completed" || pending.status === "failed" || pending.status === "cancelled") {
    return;
  }

  await updatePendingStatus(pending, "cancelled", {
    lifecycleStatus: "cancelled",
    auditEvent: "cancelled",
    auditMode: "operator_queue",
  });
}

export async function completePendingConciergeAction(
  pendingId: string,
  userId: string,
  input: { outcomeSummary?: string | null; outcomePayload?: Record<string, unknown> | null } = {},
): Promise<CompleteResult> {
  const pending = await loadPendingById(pendingId);
  if (!pending) {
    throw new Error("Concierge action not found.");
  }
  if (pending.user_id !== userId) {
    throw new Error("You do not have access to this concierge action.");
  }

  if (pending.status === "completed") {
    const existing = await pool.query<{ id: string }>(
      `
        select id
        from concierge_sessions
        where pending_id = $1::uuid
          and outcome = 'completed'
        order by completed_at desc nulls last
        limit 1
      `,
      [pendingId],
    );
    return { ok: true, status: "completed", sessionId: existing.rows[0]?.id ?? null };
  }

  if (pending.status === "failed" || pending.status === "cancelled") {
    throw new Error(`Concierge action cannot be completed from status "${pending.status}".`);
  }

  const dryRun = isDryRunPending(pending);
  const currentTask = executionTaskFromPayload(pending.action_payload);
  let completionAdapterResult = adapterResultFromPayload(pending.action_payload);
  const fallbackTask = currentTask ?? buildConciergeExecutionTask({
    useCase: pending.use_case,
    payload: pending.action_payload ?? {},
    providerName: pending.provider_name,
    providerPhone: pending.provider_phone,
    summary: pending.action_summary,
    pendingStatus: pending.status,
  });
  const completionChannelReadiness = currentTask?.channel_readiness ?? conciergeChannelReadinessForTool({
    tool: fallbackTask.active_tool,
    dryRun,
  });
  if (!completionAdapterResult && dryRun && completionChannelReadiness.channel) {
    const adapterRuntimeConfig = await loadConciergeActionAdapterRuntimeConfig(completionChannelReadiness.channel);
    completionAdapterResult = await executeConciergeActionAdapter({
      mode: "dry_run",
      tool: fallbackTask.active_tool,
      payload: pending.action_payload ?? {},
      providerName: pending.provider_name,
      providerPhone: pending.provider_phone,
      pendingId: pending.id,
      userId: pending.user_id,
      summary: pending.action_summary,
      userConfirmed: true,
      dryRun: true,
      channelReadiness: completionChannelReadiness,
      liveEndpointUrl: adapterRuntimeConfig.liveEndpointUrl,
      qaTarget: adapterRuntimeConfig.qaTarget,
    });
  }
  const completionExternalActionAllowed = Boolean(currentTask?.external_action_allowed && !dryRun);
  const completionExecutionMode = dryRun
    ? "simulated"
    : (currentTask?.execution_mode === "live" && completionExternalActionAllowed
      ? "live"
      : conciergeExecutionModeFromState({
        dryRun,
        externalActionAllowed: completionExternalActionAllowed,
        channelReadiness: completionChannelReadiness,
      }));
  const outcomeSummary = input.outcomeSummary?.trim()
    || (dryRun ? `Simulated dry-run outcome: ${pending.action_summary}` : pending.action_summary)
    || "completed";
  const finalActionPayload = withServerConciergeExecutionTask({
    useCase: pending.use_case,
    payload: appendConciergeExecutionAudit({
      ...(pending.action_payload ?? {}),
      ...(completionAdapterResult ? { execution_adapter: completionAdapterResult } : {}),
    }, {
      event: "completed",
      at: new Date().toISOString(),
      source: "completion_endpoint",
      pending_status: "completed",
      lifecycle_status: "done",
      user_confirmed: true,
      external_action_allowed: completionExternalActionAllowed,
      execution_mode: completionExecutionMode,
      channel_readiness: completionChannelReadiness,
      adapter_result: completionAdapterResult ?? undefined,
      dry_run: dryRun,
    }),
    providerName: pending.provider_name,
    providerPhone: pending.provider_phone,
    summary: pending.action_summary,
    pendingStatus: "completed",
    lifecycleStatus: "done",
    userConfirmed: true,
    confirmationSource: "completion_endpoint",
    channelReadiness: completionChannelReadiness,
    externalActionAllowed: completionExternalActionAllowed,
    executionMode: completionExecutionMode,
    adapterResult: completionAdapterResult ?? undefined,
    outcome: outcomeSummary,
  });
  const finalOutcomePayload = {
    ...(input.outcomePayload ?? {}),
    execution_mode: completionExecutionMode,
    live_action: completionExecutionMode === "live",
    external_action_allowed: completionExternalActionAllowed,
    channel_readiness: completionChannelReadiness,
    ...(dryRun ? {
      dry_run: true,
      simulated_outcome: true,
      no_real_provider_contact: true,
    } : {}),
    ...(completionAdapterResult ? {
      adapter: completionAdapterResult.adapter,
      adapter_mode: completionAdapterResult.mode,
      adapter_channel: completionAdapterResult.channel,
      adapter_provider: completionAdapterResult.provider_name,
      adapter_provider_contact: completionAdapterResult.provider_contact,
      adapter_attempted_at: completionAdapterResult.attempted_at,
      adapter_status: completionAdapterResult.status,
      adapter_result: completionAdapterResult,
      ...(completionAdapterResult.channel === "email" ? {
        provider_name: pending.provider_name ?? completionAdapterResult.provider_name,
        provider_email: completionAdapterResult.provider_contact,
        recipient_email: completionAdapterResult.provider_contact,
        provider_message_id: completionAdapterResult.result_id ?? null,
        email_outcome: "sent",
      } : {}),
    } : {}),
    execution_task: finalActionPayload.execution_task,
  };

  const client = await pool.connect();
  try {
    await client.query("begin");
    const existingReceipt = await client.query<{ id: string }>(
      `
        select id
        from concierge_sessions
        where pending_id = $1::uuid
          and outcome = 'completed'
          and outcome_payload->>'receipt_kind' = 'provider_contact_sent'
        order by completed_at desc nulls last
        limit 1
      `,
      [pending.id],
    );
    const receiptId = existingReceipt.rows[0]?.id ?? null;
    const storedSession = receiptId
      ? await client.query<{ id: string }>(
          `
            update concierge_sessions
            set
              action_payload = $2::jsonb,
              outcome_payload = $3::jsonb,
              outcome_summary = $4,
              completed_at = now()
            where id = $1::uuid
            returning id
          `,
          [
            receiptId,
            JSON.stringify(finalActionPayload),
            JSON.stringify({ ...finalOutcomePayload, receipt_kind: "final_task_completion" }),
            outcomeSummary,
          ],
        )
      : await client.query<{ id: string }>(
          `
            insert into concierge_sessions (
              user_id,
              pending_id,
              use_case,
              provider_id,
              provider_name,
              provider_phone,
              found_externally,
              action_summary,
              action_payload,
              outcome,
              outcome_payload,
              outcome_summary,
              completed_at
            )
            values ($1, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, $9::jsonb, 'completed', $10::jsonb, $11, now())
            returning id
          `,
          [
            pending.user_id,
            pending.id,
            pending.use_case,
            pending.provider_id,
            pending.provider_name,
            pending.provider_phone,
            pending.found_externally,
            pending.action_summary,
            JSON.stringify(finalActionPayload),
            JSON.stringify(finalOutcomePayload),
            outcomeSummary,
          ],
        );

    await client.query(
      `
        update concierge_pending
        set status = 'completed', action_payload = $2::jsonb, updated_at = now()
        where id = $1::uuid
      `,
      [pendingId, JSON.stringify(finalActionPayload)],
    );
    await client.query("commit");
    return { ok: true, status: "completed", sessionId: storedSession.rows[0]?.id ?? null };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
