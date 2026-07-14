import {
  CONCIERGE_FLOW_REFERENCES,
  type ConciergeFlowReference,
  type ConciergeToolRequirement,
} from "./conciergeFlowRegistry";
import {
  evaluateConciergeFlowRequirements,
  type ConciergeFlowRequirementKey,
} from "./conciergeFlowRequirements";

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
  confirmation_source?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  failure_reason?: string;
  outcome?: string;
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

function toolFromPayload(payload: Record<string, unknown>, providerPhone?: string | null): ConciergeToolRequirement {
  const channel = clean(payload.execution_channel || payload.active_tool || payload.requested_tool || payload.preferred_channel).toLowerCase();
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

  const requestedTool = toolFromPayload(payload, input.providerPhone);
  const actionType = actionTypeFromPayload(input.useCase, requirements.flowReference, payload, requestedTool);
  const lifecycleStatus = input.lifecycleStatus
    ?? lifecycleStatusFor(input.pendingStatus, missingRequirements.length > 0);
  const userConfirmed = input.userConfirmed ?? existing?.user_confirmed ?? false;
  const confirmedAt = userConfirmed
    ? input.confirmedAt ?? existing?.confirmed_at ?? now
    : existing?.confirmed_at;

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
    execution_task: buildConciergeExecutionTask(input),
  };
}
