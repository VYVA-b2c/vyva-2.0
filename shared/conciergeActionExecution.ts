import {
  CONCIERGE_FLOW_REFERENCES,
  type ConciergeFlowReference,
  type ConciergeToolRequirement,
} from "./conciergeFlowRegistry";
import {
  evaluateConciergeFlowRequirements,
  type ConciergeFlowRequirementKey,
} from "./conciergeFlowRequirements";
import { isConciergeDryRunPayload } from "./conciergeDryRun";
import {
  conciergeExecutionModeFromState,
  evaluateConciergeChannelReadiness,
  type ConciergeChannelReadinessResult,
  type ConciergeExecutionMode,
} from "./conciergeChannelReadiness";
import {
  buildConciergeAdapterApprovalFingerprint,
  type ConciergeAdapterApprovalFingerprint,
} from "./conciergeAdapterPayloadContract";

export type ConciergeExecutionActionType =
  | "phone_call"
  | "message"
  | "booking_link"
  | "provider_search"
  | "admin_paperwork"
  | "web_search"
  | "shopping_request"
  | "manual_review";

export type ConciergeExecutionTaskStatus =
  | "ready"
  | "needs_info"
  | "confirmed"
  | "in_progress"
  | "done"
  | "failed"
  | "cancelled";

export type ConciergeExecutionMissingRequirement = {
  key: ConciergeFlowRequirementKey | "provider" | "tool_setup";
  label_en: string;
  label_es: string;
};

export type ConciergeExecutionTask = {
  version: 1;
  flow_reference: ConciergeFlowReference;
  action_type: ConciergeExecutionActionType;
  requested_tool: ConciergeToolRequirement;
  active_tool: ConciergeToolRequirement;
  lifecycle_status: ConciergeExecutionTaskStatus;
  provider_ready: boolean;
  missing_requirements: ConciergeExecutionMissingRequirement[];
  confirmation_required: true;
  user_confirmed: boolean;
  external_action_allowed: boolean;
  execution_mode: ConciergeExecutionMode;
  channel_readiness: ConciergeChannelReadinessResult;
  dry_run?: boolean;
  approval_fingerprint?: ConciergeAdapterApprovalFingerprint;
  confirmation_source?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  failure_reason?: string;
  outcome?: string;
};

export type ConciergeConfirmedExecutionMode =
  | "needs_info"
  | "direct_phone_call"
  | "user_controlled_handoff"
  | "operator_queue";

export type ConciergeConfirmedExecutionPlan = {
  mode: ConciergeConfirmedExecutionMode;
  pending_status: "pending" | "calling";
  lifecycle_status: ConciergeExecutionTaskStatus;
  requested_tool: ConciergeToolRequirement;
  active_tool: ConciergeToolRequirement;
  action_type: ConciergeExecutionActionType;
  missing_requirements: ConciergeExecutionMissingRequirement[];
  channel_readiness: ConciergeChannelReadinessResult;
  execution_mode: ConciergeExecutionMode;
  external_action_allowed: boolean;
  dry_run?: boolean;
  operator_fallback_reason?: string;
  message: string;
};

export type ConciergeExecutionAuditEvent =
  | "created"
  | "adapter_execution_blocked"
  | "adapter_execution_failed"
  | "adapter_execution_simulated"
  | "adapter_execution_succeeded"
  | "adapter_retry_requested"
  | "adapter_manual_follow_up_queued"
  | "user_reconfirmation_requested"
  | "user_reconfirmed"
  | "blocked_missing_info"
  | "blocked_channel_not_ready"
  | "user_confirmed"
  | "direct_call_started"
  | "operator_handoff_queued"
  | "completed"
  | "cancelled"
  | "failed";

export type ConciergeExecutionAuditEntry = {
  version: 1;
  event: ConciergeExecutionAuditEvent;
  at: string;
  source: string;
  pending_status?: string;
  lifecycle_status?: ConciergeExecutionTaskStatus;
  mode?: ConciergeConfirmedExecutionMode;
  requested_tool?: ConciergeToolRequirement;
  active_tool?: ConciergeToolRequirement;
  action_type?: ConciergeExecutionActionType;
  user_confirmed?: boolean;
  external_action_allowed?: boolean;
  execution_mode?: ConciergeExecutionMode;
  channel_readiness?: ConciergeChannelReadinessResult;
  adapter_result?: Record<string, unknown>;
  dry_run?: boolean;
  reason?: string;
  missing_requirements?: ConciergeExecutionMissingRequirement[];
};

export type ConciergeExecutionBuildInput = {
  useCase: string;
  payload?: Record<string, unknown> | null;
  providerName?: string | null;
  providerPhone?: string | null;
  summary?: string | null;
  pendingStatus?: string | null;
  lifecycleStatus?: ConciergeExecutionTaskStatus;
  userConfirmed?: boolean;
  confirmationSource?: string;
  confirmedAt?: string;
  channelReadiness?: ConciergeChannelReadinessResult;
  externalActionAllowed?: boolean;
  executionMode?: ConciergeExecutionMode;
  adapterResult?: Record<string, unknown>;
  now?: string;
  failureReason?: string;
  outcome?: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function executionTaskFromPayload(payload: Record<string, unknown> | null | undefined): Partial<ConciergeExecutionTask> | null {
  const raw = payload?.execution_task;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Partial<ConciergeExecutionTask>
    : null;
}

function toolFromPayload(
  payload: Record<string, unknown>,
  providerPhone?: string | null,
  existing?: Partial<ConciergeExecutionTask> | null,
): ConciergeToolRequirement {
  const channel = clean(
    payload.execution_channel
      || payload.active_tool
      || payload.requested_tool
      || payload.preferred_channel
      || existing?.active_tool
      || existing?.requested_tool,
  ).toLowerCase();
  if (channel === "phone" || channel === "phone_call" || channel === "call") return "phone_call";
  if (channel === "email") return "email";
  if (channel === "whatsapp") return "whatsapp";
  if (channel === "booking_url" || channel === "booking_link" || channel === "open_url") return "booking_link";
  if (channel === "web_search") return "web_search";
  if (channel === "camera_or_upload") return "camera_or_upload";
  if (channel === "operator_review" || channel === "manual" || channel === "manual_review") return "operator_review";
  if (clean(payload.booking_url || payload.provider_booking_url)) return "booking_link";
  if (clean(payload.email || payload.provider_email || payload.email_draft_subject)) return "email";
  if (clean(payload.whatsapp || payload.provider_whatsapp || payload.whatsapp_message)) return "whatsapp";
  if (providerPhone || clean(payload.phone || payload.provider_phone || payload.contact_phone)) return "phone_call";
  return "operator_review";
}

function actionTypeFromPayload(
  useCase: string,
  flowReference: ConciergeFlowReference,
  payload: Record<string, unknown>,
  tool: ConciergeToolRequirement,
): ConciergeExecutionActionType {
  const executionType = clean(payload.execution_type).toLowerCase();
  if (useCase === "find_provider") return "provider_search";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.insuranceAdmin || ["insurance_admin", "admin_task", "paperwork"].includes(useCase)) {
    return "admin_paperwork";
  }
  if (executionType.includes("web_search") || tool === "web_search") return "web_search";
  if (useCase === "shopping_request" || useCase === "find_offers" || useCase === "order_food") return "shopping_request";
  if (tool === "email" || tool === "whatsapp") return "message";
  if (tool === "booking_link") return "booking_link";
  if (tool === "phone_call") return "phone_call";
  return "manual_review";
}

function missingProviderRequirement(): ConciergeExecutionMissingRequirement {
  return {
    key: "provider",
    label_en: "Provider",
    label_es: "Proveedor",
  };
}

function missingToolRequirement(labelEn: string, labelEs: string): ConciergeExecutionMissingRequirement {
  return {
    key: "tool_setup",
    label_en: labelEn,
    label_es: labelEs,
  };
}

function payloadHasCleanString(payload: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => clean(payload[key]));
}

function providerPhoneReady(payload: Record<string, unknown>, providerPhone?: string | null): boolean {
  return Boolean(clean(providerPhone) || payloadHasCleanString(payload, ["provider_phone", "phone", "contact_phone"]));
}

function shouldCaptureApprovalFingerprint(confirmationSource: string | undefined): boolean {
  return Boolean(confirmationSource && [
    "agent_confirmed",
    "auto_start",
    "confirm_endpoint",
    "user_controlled_execution",
    "user_confirmed",
  ].includes(confirmationSource));
}

function toolSpecificMissingRequirement(
  tool: ConciergeToolRequirement,
  payload: Record<string, unknown>,
  providerPhone?: string | null,
): ConciergeExecutionMissingRequirement | null {
  if (tool === "phone_call" && !providerPhoneReady(payload, providerPhone)) {
    return missingToolRequirement("Phone number", "Telefono");
  }
  if (tool === "email" && !payloadHasCleanString(payload, ["recipient_email", "provider_email", "to_email", "email_to", "email"])) {
    return missingToolRequirement("Email address", "Email");
  }
  if (tool === "whatsapp" && !payloadHasCleanString(payload, ["recipient_whatsapp", "provider_whatsapp", "to_whatsapp", "whatsapp_to", "whatsapp_number", "whatsapp"])) {
    return missingToolRequirement("WhatsApp number", "Numero de WhatsApp");
  }
  if (tool === "booking_link" && !payloadHasCleanString(payload, ["form_automation_prefilled_url", "booking_url", "provider_booking_url", "website", "url"])) {
    return missingToolRequirement("Form or booking link", "Formulario o enlace");
  }
  return null;
}

function lifecycleStatusFor(
  pendingStatus: string | null | undefined,
  hasMissingRequirements: boolean,
): ConciergeExecutionTaskStatus {
  if (pendingStatus === "completed") return "done";
  if (pendingStatus === "failed") return "failed";
  if (pendingStatus === "cancelled") return "cancelled";
  if (pendingStatus === "calling") return "in_progress";
  return hasMissingRequirements ? "needs_info" : "ready";
}

export function buildConciergeExecutionTask(input: ConciergeExecutionBuildInput): ConciergeExecutionTask {
  const payload = input.payload ?? {};
  const existing = executionTaskFromPayload(payload);
  const now = input.now ?? new Date().toISOString();
  const dryRun = isConciergeDryRunPayload(payload);
  const requirements = evaluateConciergeFlowRequirements({
    useCase: input.useCase,
    payload,
    providerName: input.providerName,
    summary: input.summary,
  });
  const providerReady = requirements.providerReady || !requirements.needsProvider;
  const missingRequirements = requirements.missingRequirements.map((requirement) => ({
    key: requirement.key,
    label_en: requirement.labelEn,
    label_es: requirement.labelEs,
  }));
  if (requirements.needsProvider && !providerReady) missingRequirements.unshift(missingProviderRequirement());

  const requestedTool = toolFromPayload(payload, input.providerPhone, existing);
  const actionType = actionTypeFromPayload(input.useCase, requirements.flowReference, payload, requestedTool);
  const channelReadiness = input.channelReadiness
    ?? existing?.channel_readiness
    ?? evaluateConciergeChannelReadiness({ tool: requestedTool, dryRun });
  const externalActionAllowed = input.externalActionAllowed
    ?? existing?.external_action_allowed
    ?? false;
  const executionMode = input.executionMode
    ?? existing?.execution_mode
    ?? conciergeExecutionModeFromState({
      dryRun,
      externalActionAllowed,
      channelReadiness,
    });
  const toolMissingRequirement = toolSpecificMissingRequirement(requestedTool, payload, input.providerPhone);
  const missingKeys = new Set(missingRequirements.map((requirement) => requirement.key));
  if (
    toolMissingRequirement
    && !missingKeys.has("recipient")
    && !missingKeys.has("website_or_contact")
    && !missingKeys.has("provider")
  ) {
    missingRequirements.push(toolMissingRequirement);
  }
  const inferredLifecycleStatus = lifecycleStatusFor(input.pendingStatus, missingRequirements.length > 0);
  const lifecycleStatus = input.lifecycleStatus
    ?? (existing?.user_confirmed && existing.lifecycle_status === "confirmed" && inferredLifecycleStatus === "ready"
      ? "confirmed"
      : inferredLifecycleStatus);
  const userConfirmed = input.userConfirmed ?? existing?.user_confirmed ?? false;
  const confirmedAt = userConfirmed
    ? input.confirmedAt ?? existing?.confirmed_at ?? now
    : existing?.confirmed_at;
  const approvalFingerprint = userConfirmed && shouldCaptureApprovalFingerprint(input.confirmationSource)
    ? buildConciergeAdapterApprovalFingerprint({
        tool: requestedTool,
        payload,
        providerName: input.providerName,
        providerPhone: input.providerPhone,
        summary: input.summary,
        approvedAt: confirmedAt ?? now,
      })
    : existing?.approval_fingerprint;

  return {
    version: 1,
    flow_reference: requirements.flowReference,
    action_type: actionType,
    requested_tool: requestedTool,
    active_tool: requestedTool,
    lifecycle_status: lifecycleStatus,
    provider_ready: providerReady,
    missing_requirements: missingRequirements,
    confirmation_required: true,
    user_confirmed: userConfirmed,
    external_action_allowed: externalActionAllowed,
    execution_mode: executionMode,
    channel_readiness: channelReadiness,
    ...(dryRun ? { dry_run: true } : {}),
    ...(approvalFingerprint ? { approval_fingerprint: approvalFingerprint } : {}),
    ...(input.confirmationSource || existing?.confirmation_source
      ? { confirmation_source: input.confirmationSource ?? existing?.confirmation_source }
      : {}),
    ...(confirmedAt ? { confirmed_at: confirmedAt } : {}),
    created_at: existing?.created_at ?? now,
    updated_at: now,
    ...(input.failureReason || existing?.failure_reason ? { failure_reason: input.failureReason ?? existing?.failure_reason } : {}),
    ...(input.outcome || existing?.outcome ? { outcome: input.outcome ?? existing?.outcome } : {}),
  };
}

export function withConciergeExecutionTask(input: ConciergeExecutionBuildInput): Record<string, unknown> {
  const payload = input.payload ?? {};
  return {
    ...payload,
    ...(input.adapterResult ? { execution_adapter: input.adapterResult } : {}),
    execution_task: buildConciergeExecutionTask(input),
  };
}

export function appendConciergeExecutionAudit(
  payload: Record<string, unknown> | null | undefined,
  entry: Omit<ConciergeExecutionAuditEntry, "version"> & { version?: 1 },
): Record<string, unknown> {
  const base = payload ?? {};
  const existing = Array.isArray(base.execution_audit)
    ? base.execution_audit.filter((item): item is ConciergeExecutionAuditEntry => (
        Boolean(item)
          && typeof item === "object"
          && !Array.isArray(item)
          && (item as ConciergeExecutionAuditEntry).version === 1
          && typeof (item as ConciergeExecutionAuditEntry).event === "string"
      ))
    : [];
  return {
    ...base,
    execution_audit: [
      ...existing.slice(-19),
      {
        ...entry,
        version: 1,
      },
    ],
  };
}

export function planConciergeConfirmedExecution(input: ConciergeExecutionBuildInput): ConciergeConfirmedExecutionPlan {
  const task = buildConciergeExecutionTask({
    ...input,
    pendingStatus: input.pendingStatus ?? "pending",
  });

  if (task.missing_requirements.length > 0) {
    return {
      mode: "needs_info",
      pending_status: "pending",
      lifecycle_status: "needs_info",
      requested_tool: task.requested_tool,
      active_tool: task.active_tool,
      action_type: task.action_type,
      missing_requirements: task.missing_requirements,
      channel_readiness: task.channel_readiness,
      execution_mode: "blocked",
      external_action_allowed: false,
      ...(task.dry_run ? { dry_run: true } : {}),
      message: "Complete the missing details before confirming this Concierge action.",
    };
  }

  if (task.active_tool === "phone_call") {
    if (task.dry_run) {
      return {
        mode: "operator_queue",
        pending_status: "pending",
        lifecycle_status: "confirmed",
        requested_tool: task.requested_tool,
        active_tool: task.active_tool,
        action_type: task.action_type,
        missing_requirements: [],
        channel_readiness: task.channel_readiness,
        execution_mode: "simulated",
        external_action_allowed: false,
        dry_run: true,
        operator_fallback_reason: "dry_run_simulation",
        message: "Dry-run confirmed. VYVA records a simulated handoff instead of contacting anyone.",
      };
    }

    if (!task.channel_readiness.external_action_allowed) {
      return {
        mode: "operator_queue",
        pending_status: "pending",
        lifecycle_status: "confirmed",
        requested_tool: task.requested_tool,
        active_tool: task.active_tool,
        action_type: task.action_type,
        missing_requirements: [],
        channel_readiness: task.channel_readiness,
        execution_mode: "blocked",
        external_action_allowed: false,
        operator_fallback_reason: task.channel_readiness.blockers[0] ?? "channel_not_ready",
        message: `The ${task.channel_readiness.label.toLowerCase()} channel is not ready for live Concierge actions. VYVA will not contact the provider.`,
      };
    }

    return {
      mode: "direct_phone_call",
      pending_status: "calling",
      lifecycle_status: "in_progress",
      requested_tool: task.requested_tool,
      active_tool: task.active_tool,
      action_type: task.action_type,
      missing_requirements: [],
      channel_readiness: task.channel_readiness,
      execution_mode: "live",
      external_action_allowed: true,
      message: "Outbound concierge call started.",
    };
  }

  return {
    mode: "operator_queue",
    pending_status: "pending",
    lifecycle_status: "confirmed",
    requested_tool: task.requested_tool,
    active_tool: task.active_tool,
    action_type: task.action_type,
    missing_requirements: [],
    channel_readiness: task.channel_readiness,
    execution_mode: task.dry_run ? "simulated" : "manual_review",
    external_action_allowed: false,
    ...(task.dry_run ? {
      dry_run: true,
      operator_fallback_reason: "dry_run_simulation",
      message: "Dry-run confirmed. VYVA records a simulated handoff instead of contacting anyone.",
    } : {
      message: "Concierge action confirmed and queued for VYVA review.",
    }),
  };
}
