import type { HomeFastHelpRecoveryNudge } from "./homeFastHelpOutcome";

export type HomeResumeConciergeItem = {
  id?: string | null;
  use_case?: string | null;
  status?: string | null;
  action_payload?: Record<string, unknown> | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type HomeResumeKind =
  | "provider_setup"
  | "provider_shortlist"
  | "form"
  | "booking"
  | "concierge"
  | "fast_help";

export type HomeResumeCandidate<TConcierge extends HomeResumeConciergeItem = HomeResumeConciergeItem> =
  | {
      source: "concierge";
      kind: Exclude<HomeResumeKind, "fast_help">;
      item: TConcierge;
      priority: number;
      updatedAtMs: number;
      waitingOnProvider: boolean;
    }
  | {
      source: "fast_help";
      kind: "provider_setup" | "fast_help";
      nudge: HomeFastHelpRecoveryNudge;
      priority: number;
      updatedAtMs: number;
      waitingOnProvider: false;
    };

function payloadString(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function timestampMs(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizedConciergeSignals(item: HomeResumeConciergeItem) {
  const payload = item.action_payload;
  return [
    item.status,
    payloadString(payload, ["mission_status", "current_step", "provider_status"]),
    payloadString(payload, ["blocker", "retry_blocker", "blocked_reason", "readiness_blocker"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function conciergeResumeIsWaitingOnProvider(item: HomeResumeConciergeItem) {
  const status = (item.status ?? "").toLowerCase();
  const payload = item.action_payload;
  const missionStatus = payloadString(payload, ["mission_status", "current_step"]).toLowerCase();
  const handoffStatus = payloadString(payload, ["live_handoff_status", "provider_follow_up_status"]).toLowerCase();
  return status === "calling"
    || status === "in_progress"
    || missionStatus.includes("awaiting_provider")
    || handoffStatus === "waiting"
    || handoffStatus === "sent_or_called";
}

export function conciergeResumeKind(item: HomeResumeConciergeItem): Exclude<HomeResumeKind, "fast_help"> {
  const payload = item.action_payload;
  const signals = normalizedConciergeSignals(item);
  const providerSetupRequired = payload?.setup_required === true
    || payload?.needs_provider_setup === true
    || (payload?.provider_required === true && payload?.provider_saved === false)
    || /needs[_ ]provider|missing[_ ]provider|provider[_ ]setup|setup[_ ]required/.test(signals);

  if (providerSetupRequired) return "provider_setup";
  if (payload?.task_type === "provider_shortlist") return "provider_shortlist";

  const useCase = (item.use_case ?? "").toLowerCase();
  const taskType = payloadString(payload, ["task_type", "request_type", "appointment_type"]).toLowerCase();
  if (
    useCase === "admin_task"
    || useCase === "paperwork"
    || taskType === "form"
    || /form|application|document|paperwork/.test(signals)
  ) {
    return "form";
  }

  if (
    useCase === "book_ride"
    || useCase === "book_appointment"
    || useCase === "order_medicine"
    || useCase === "home_service"
    || taskType === "home-service"
  ) {
    return "booking";
  }

  return "concierge";
}

function conciergePriority(item: HomeResumeConciergeItem, kind: Exclude<HomeResumeKind, "fast_help">) {
  if (kind === "provider_setup") return 700;
  if ((item.status ?? "").toLowerCase() === "failed") return 650;
  if (conciergeResumeIsWaitingOnProvider(item)) return 260;
  if (kind === "provider_shortlist") return 600;
  if (kind === "form") return 560;
  if (kind === "booking") return 540;
  return 500;
}

export function rankHomeResumeCandidates<TConcierge extends HomeResumeConciergeItem>({
  conciergeItems,
  fastHelpRecovery,
}: {
  conciergeItems: TConcierge[];
  fastHelpRecovery: HomeFastHelpRecoveryNudge | null;
}): HomeResumeCandidate<TConcierge>[] {
  const candidates: HomeResumeCandidate<TConcierge>[] = conciergeItems.flatMap((item) => {
    const status = (item.status ?? "").toLowerCase();
    if (!item.id || status === "completed" || status === "cancelled") return [];
    const kind = conciergeResumeKind(item);
    return [{
      source: "concierge" as const,
      kind,
      item,
      priority: conciergePriority(item, kind),
      updatedAtMs: timestampMs(item.updated_at, item.confirmed_at, item.created_at),
      waitingOnProvider: conciergeResumeIsWaitingOnProvider(item),
    }];
  });

  if (fastHelpRecovery) {
    const kind = fastHelpRecovery.kind === "transport_provider" ? "provider_setup" as const : "fast_help" as const;
    candidates.push({
      source: "fast_help",
      kind,
      nudge: fastHelpRecovery,
      priority: kind === "provider_setup" ? 680 : fastHelpRecovery.kind === "blocked" ? 520 : 420,
      updatedAtMs: timestampMs(fastHelpRecovery.journey.updatedAt),
      waitingOnProvider: false,
    });
  }

  return candidates.sort((left, right) => {
    if (left.priority !== right.priority) return right.priority - left.priority;
    if (left.updatedAtMs !== right.updatedAtMs) return right.updatedAtMs - left.updatedAtMs;
    if (left.source !== right.source) return left.source === "concierge" ? -1 : 1;
    const leftId = left.source === "concierge" ? left.item.id ?? "" : left.nudge.journey.id;
    const rightId = right.source === "concierge" ? right.item.id ?? "" : right.nudge.journey.id;
    return leftId.localeCompare(rightId);
  });
}

export function selectHomeResumeCandidate<TConcierge extends HomeResumeConciergeItem>(input: {
  conciergeItems: TConcierge[];
  fastHelpRecovery: HomeFastHelpRecoveryNudge | null;
}) {
  return rankHomeResumeCandidates(input)[0] ?? null;
}
