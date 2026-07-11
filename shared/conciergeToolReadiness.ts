import type { ConciergeFlowReference, ConciergeToolRequirement } from "./conciergeFlowRegistry";

export type ConciergeToolReadinessStatus = "ready" | "manual_review" | "unavailable";

export interface ConciergeToolProviderSnapshot {
  phone?: unknown;
  email?: unknown;
  whatsapp?: unknown;
  booking_url?: unknown;
  url?: unknown;
  availableChannels?: unknown;
  actions?: unknown;
  providerName?: unknown;
  name?: unknown;
}

export interface ConciergeToolReadinessInput {
  flowReference: ConciergeFlowReference;
  requestedTool: ConciergeToolRequirement;
  provider?: ConciergeToolProviderSnapshot | null;
  capabilities?: Partial<Record<ConciergeToolRequirement, boolean>>;
}

export interface ConciergeToolReadinessResult {
  flowReference: ConciergeFlowReference;
  requestedTool: ConciergeToolRequirement;
  activeTool: ConciergeToolRequirement;
  status: ConciergeToolReadinessStatus;
  canProceed: boolean;
  missing: string[];
  reason: "ready" | "missing_provider_detail" | "capability_unavailable";
}

const CHANNEL_TO_TOOL: Record<string, ConciergeToolRequirement> = {
  booking_url: "booking_link",
  phone: "phone_call",
  whatsapp: "whatsapp",
  email: "email",
  manual: "operator_review",
};

const ACTION_TO_TOOL: Record<string, ConciergeToolRequirement> = {
  start_concierge_action: "operator_review",
  call_phone: "phone_call",
  draft_message: "whatsapp",
  open_url: "booking_link",
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function listFromUnknown(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function providerHasTool(provider: ConciergeToolProviderSnapshot | null | undefined, tool: ConciergeToolRequirement): boolean {
  if (!provider) return false;
  const availableTools = listFromUnknown(provider.availableChannels).map(toolFromAppointmentChannel);
  if (availableTools.includes(tool)) return true;

  const actionTools = listFromUnknown(provider.actions).map(toolFromTransportAction);
  if (actionTools.includes(tool)) return true;

  switch (tool) {
    case "phone_call":
      return Boolean(cleanText(provider.phone));
    case "email":
      return Boolean(cleanText(provider.email));
    case "whatsapp":
      return Boolean(cleanText(provider.whatsapp));
    case "booking_link":
      return Boolean(cleanText(provider.booking_url) || cleanText(provider.url));
    case "operator_review":
      return true;
    case "camera_or_upload":
    case "web_search":
      return true;
    default:
      return false;
  }
}

function missingDetailForTool(tool: ConciergeToolRequirement): string {
  switch (tool) {
    case "phone_call":
      return "phone";
    case "email":
      return "email";
    case "whatsapp":
      return "whatsapp";
    case "booking_link":
      return "booking_url";
    default:
      return "tool_setup";
  }
}

function capabilityIsEnabled(
  capabilities: Partial<Record<ConciergeToolRequirement, boolean>> | undefined,
  tool: ConciergeToolRequirement,
) {
  return capabilities?.[tool] !== false;
}

export function toolFromAppointmentChannel(channel: string | null | undefined): ConciergeToolRequirement {
  return CHANNEL_TO_TOOL[(channel ?? "").trim().toLowerCase()] ?? "operator_review";
}

export function toolFromTransportAction(action: string | null | undefined): ConciergeToolRequirement {
  return ACTION_TO_TOOL[(action ?? "").trim().toLowerCase()] ?? "operator_review";
}

export function preferredToolFromTransportActions(actions: unknown): ConciergeToolRequirement {
  const tools = listFromUnknown(actions).map(toolFromTransportAction);
  return tools.includes("operator_review")
    ? "operator_review"
    : tools.find((tool) => tool !== "operator_review") ?? "operator_review";
}

export function evaluateConciergeToolReadiness(input: ConciergeToolReadinessInput): ConciergeToolReadinessResult {
  const hasRequestedCapability = capabilityIsEnabled(input.capabilities, input.requestedTool);
  const hasRequestedProviderDetail = providerHasTool(input.provider, input.requestedTool);

  if (input.requestedTool === "operator_review") {
    return {
      flowReference: input.flowReference,
      requestedTool: input.requestedTool,
      activeTool: "operator_review",
      status: hasRequestedCapability ? "ready" : "unavailable",
      canProceed: hasRequestedCapability,
      missing: hasRequestedCapability ? [] : ["operator_review"],
      reason: hasRequestedCapability ? "ready" : "capability_unavailable",
    };
  }

  if (hasRequestedCapability && hasRequestedProviderDetail) {
    return {
      flowReference: input.flowReference,
      requestedTool: input.requestedTool,
      activeTool: input.requestedTool,
      status: "ready",
      canProceed: true,
      missing: [],
      reason: "ready",
    };
  }

  if (capabilityIsEnabled(input.capabilities, "operator_review")) {
    return {
      flowReference: input.flowReference,
      requestedTool: input.requestedTool,
      activeTool: "operator_review",
      status: "manual_review",
      canProceed: true,
      missing: hasRequestedProviderDetail ? [input.requestedTool] : [missingDetailForTool(input.requestedTool)],
      reason: hasRequestedCapability ? "missing_provider_detail" : "capability_unavailable",
    };
  }

  return {
    flowReference: input.flowReference,
    requestedTool: input.requestedTool,
    activeTool: input.requestedTool,
    status: "unavailable",
    canProceed: false,
    missing: hasRequestedProviderDetail ? [input.requestedTool] : [missingDetailForTool(input.requestedTool)],
    reason: hasRequestedCapability ? "missing_provider_detail" : "capability_unavailable",
  };
}
