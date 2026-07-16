import type { ConciergeToolRequirement } from "./conciergeFlowRegistry";

export type ConciergeProductionChannel =
  | "phone_call"
  | "email"
  | "whatsapp"
  | "form_application"
  | "document_upload";

export type ConciergeChannelReadinessStatus =
  | "ready"
  | "test_mode"
  | "disabled"
  | "not_configured"
  | "not_verified"
  | "not_required";

export type ConciergeExecutionMode =
  | "simulated"
  | "live"
  | "manual_review"
  | "blocked";

export interface ConciergeChannelReadinessFlag {
  adminEnabled?: boolean;
  configured?: boolean;
  verified?: boolean;
  notes?: string | null;
}

export interface ConciergeChannelReadinessResult {
  version: 1;
  tool: ConciergeToolRequirement;
  channel: ConciergeProductionChannel | null;
  label: string;
  status: ConciergeChannelReadinessStatus;
  ready: boolean;
  admin_enabled: boolean;
  configured: boolean;
  verified: boolean;
  dry_run: boolean;
  external_action_allowed: boolean;
  blockers: string[];
  notes?: string | null;
}

export type ConciergeChannelReadinessFlags = Partial<Record<ConciergeProductionChannel, ConciergeChannelReadinessFlag>>;

export const CONCIERGE_PRODUCTION_CHANNELS: Array<{ id: ConciergeProductionChannel; label: string }> = [
  { id: "phone_call", label: "Phone calls" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "form_application", label: "Forms / applications" },
  { id: "document_upload", label: "Document upload" },
];

const CHANNEL_LABELS: Record<ConciergeProductionChannel, string> = Object.fromEntries(
  CONCIERGE_PRODUCTION_CHANNELS.map((channel) => [channel.id, channel.label]),
) as Record<ConciergeProductionChannel, string>;

export function conciergeProductionChannelForTool(
  tool: ConciergeToolRequirement,
): ConciergeProductionChannel | null {
  switch (tool) {
    case "phone_call":
      return "phone_call";
    case "email":
      return "email";
    case "whatsapp":
      return "whatsapp";
    case "booking_link":
      return "form_application";
    case "camera_or_upload":
      return "document_upload";
    case "operator_review":
    case "web_search":
      return null;
    default:
      return null;
  }
}

function blocker(channel: ConciergeProductionChannel, suffix: string): string {
  return `${channel}_${suffix}`;
}

function statusFor(
  channel: ConciergeProductionChannel,
  flag: ConciergeChannelReadinessFlag,
): { status: ConciergeChannelReadinessStatus; blockers: string[] } {
  const blockers: string[] = [];
  if (!flag.adminEnabled) blockers.push(blocker(channel, "disabled_by_admin"));
  if (!flag.configured) blockers.push(blocker(channel, "not_configured"));
  if (!flag.verified) blockers.push(blocker(channel, "not_verified"));

  if (blockers.length === 0) return { status: "ready", blockers };
  if (!flag.adminEnabled) return { status: "disabled", blockers };
  if (!flag.configured) return { status: "not_configured", blockers };
  return { status: "not_verified", blockers };
}

export function evaluateConciergeChannelReadiness(input: {
  tool: ConciergeToolRequirement;
  dryRun?: boolean;
  flags?: ConciergeChannelReadinessFlags;
}): ConciergeChannelReadinessResult {
  const dryRun = Boolean(input.dryRun);
  const channel = conciergeProductionChannelForTool(input.tool);

  if (!channel) {
    return {
      version: 1,
      tool: input.tool,
      channel: null,
      label: "No live provider channel required",
      status: "not_required",
      ready: true,
      admin_enabled: true,
      configured: true,
      verified: true,
      dry_run: dryRun,
      external_action_allowed: false,
      blockers: [],
    };
  }

  const flag = input.flags?.[channel] ?? {};
  const normalizedFlag: ConciergeChannelReadinessFlag = {
    adminEnabled: flag.adminEnabled === true,
    configured: flag.configured === true,
    verified: flag.verified === true,
    notes: flag.notes ?? null,
  };

  if (dryRun) {
    return {
      version: 1,
      tool: input.tool,
      channel,
      label: CHANNEL_LABELS[channel],
      status: "test_mode",
      ready: false,
      admin_enabled: normalizedFlag.adminEnabled,
      configured: normalizedFlag.configured,
      verified: normalizedFlag.verified,
      dry_run: true,
      external_action_allowed: false,
      blockers: [blocker(channel, "dry_run_blocks_live_action")],
      notes: normalizedFlag.notes,
    };
  }

  const status = statusFor(channel, normalizedFlag);
  const ready = status.status === "ready";

  return {
    version: 1,
    tool: input.tool,
    channel,
    label: CHANNEL_LABELS[channel],
    status: status.status,
    ready,
    admin_enabled: normalizedFlag.adminEnabled === true,
    configured: normalizedFlag.configured === true,
    verified: normalizedFlag.verified === true,
    dry_run: false,
    external_action_allowed: ready,
    blockers: status.blockers,
    notes: normalizedFlag.notes,
  };
}

export function conciergeExecutionModeFromState(input: {
  dryRun?: boolean;
  externalActionAllowed?: boolean;
  channelReadiness?: ConciergeChannelReadinessResult | null;
}): ConciergeExecutionMode {
  if (input.dryRun) return "simulated";
  if (input.externalActionAllowed) return "live";
  if (input.channelReadiness?.channel && input.channelReadiness.ready === false) return "blocked";
  return "manual_review";
}
