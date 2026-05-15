import type { VoiceTimelineEvent } from "./voiceTimeline";

export type VoiceTimelineFilter = {
  query: string;
  domain: string;
  kind: string;
  severity: string;
};

export type VoiceQaSession = {
  id: string;
  sessionId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  eventCount: number;
  domain: string;
  agentSlug: string;
  conversationPlanId: string;
  transferCount: number;
  completedActionCount: number;
  dismissedActionCount: number;
  errorCount: number;
  flags: string[];
  latestTitle: string;
  events: VoiceTimelineEvent[];
};

export type VoiceAgentPerformance = {
  key: string;
  label: string;
  sessions: number;
  events: number;
  transfers: number;
  errors: number;
  completedActions: number;
  dismissedActions: number;
};

export type VoiceQaDashboard = {
  sessions: VoiceQaSession[];
  agentPerformance: VoiceAgentPerformance[];
  totalIssues: number;
  filteredEventCount: number;
};

export type VoiceQaReplayPack = {
  version: "vyva_voice_replay_pack_v1";
  generatedAt: string;
  sessionCount: number;
  sessions: Array<{
    sessionId: string;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    domain: string;
    agentSlug: string;
    conversationPlanId: string;
    flags: string[];
    metrics: {
      eventCount: number;
      transfers: number;
      completedActions: number;
      dismissedActions: number;
      errors: number;
    };
    timeline: Array<{
      at: string;
      offsetMs: number;
      kind: string;
      severity: string;
      title: string;
      detail?: string;
      route?: string;
      actionType?: string;
      actionId?: string;
    }>;
  }>;
};

const EMPTY_FILTER: VoiceTimelineFilter = {
  query: "",
  domain: "all",
  kind: "all",
  severity: "all",
};

function eventSearchText(event: VoiceTimelineEvent) {
  return [
    event.title,
    event.detail,
    event.kind,
    event.severity,
    event.sessionId,
    event.domain,
    event.agentSlug,
    event.conversationPlanId,
    event.route,
    event.actionType,
    event.actionId,
  ].filter(Boolean).join(" ").toLowerCase();
}

function firstValue(events: VoiceTimelineEvent[], key: keyof VoiceTimelineEvent) {
  const found = events.find((event) => typeof event[key] === "string" && String(event[key]).trim().length > 0);
  return found ? String(found[key]) : "";
}

function sessionFlags(events: VoiceTimelineEvent[]) {
  const kinds = new Set(events.map((event) => event.kind));
  const flags: string[] = [];
  if (kinds.has("session_error")) flags.push("Error");
  if (kinds.has("session_started") && !kinds.has("session_connected")) flags.push("No connection");
  if (kinds.has("session_started") && !kinds.has("session_ended") && !kinds.has("session_error")) flags.push("No end event");
  if (events.filter((event) => event.kind === "transfer_requested").length > 1) flags.push("Repeated transfer");
  if (events.some((event) => event.kind === "action_dismissed")) flags.push("Dismissed action");
  return flags;
}

function overlapFlags(sessions: VoiceQaSession[]) {
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (current.sessionId !== "No session id" && next.sessionId !== "No session id" && current.endedAt > next.startedAt) {
      current.flags.push("Overlaps another session");
      next.flags.push("Overlaps another session");
    }
  }
}

export function filterVoiceTimelineEvents(
  events: VoiceTimelineEvent[],
  filter: Partial<VoiceTimelineFilter> = EMPTY_FILTER,
) {
  const query = filter.query?.trim().toLowerCase() ?? "";
  const domain = filter.domain ?? "all";
  const kind = filter.kind ?? "all";
  const severity = filter.severity ?? "all";

  return events.filter((event) => {
    if (domain !== "all" && event.domain !== domain) return false;
    if (kind !== "all" && event.kind !== kind) return false;
    if (severity !== "all" && event.severity !== severity) return false;
    if (query && !eventSearchText(event).includes(query)) return false;
    return true;
  });
}

export function groupVoiceTimelineSessions(events: VoiceTimelineEvent[]) {
  const groups = new Map<string, VoiceTimelineEvent[]>();
  for (const event of events) {
    const key = event.sessionId || `event:${event.id}`;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  const sessions = Array.from(groups.entries()).map(([key, group]) => {
    const ordered = [...group].sort((a, b) => a.at - b.at);
    const startedAt = ordered[0]?.at ?? 0;
    const latest = ordered[ordered.length - 1];
    const endedAt = latest?.at ?? startedAt;
    const flags = sessionFlags(ordered);

    return {
      id: key,
      sessionId: key.startsWith("event:") ? "No session id" : key,
      startedAt,
      endedAt,
      durationMs: Math.max(0, endedAt - startedAt),
      eventCount: ordered.length,
      domain: firstValue(ordered, "domain") || "unknown",
      agentSlug: firstValue(ordered, "agentSlug") || "unknown",
      conversationPlanId: firstValue(ordered, "conversationPlanId") || "unknown",
      transferCount: ordered.filter((event) => event.kind === "transfer_requested").length,
      completedActionCount: ordered.filter((event) => event.kind === "action_completed").length,
      dismissedActionCount: ordered.filter((event) => event.kind === "action_dismissed").length,
      errorCount: ordered.filter((event) => event.kind === "session_error").length,
      flags,
      latestTitle: latest?.title ?? "Voice event",
      events: ordered,
    } satisfies VoiceQaSession;
  });

  overlapFlags(sessions);
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export function buildVoiceAgentPerformance(sessions: VoiceQaSession[]) {
  const rows = new Map<string, VoiceAgentPerformance>();
  for (const session of sessions) {
    const key = session.domain !== "unknown" ? session.domain : session.agentSlug;
    const current = rows.get(key) ?? {
      key,
      label: key,
      sessions: 0,
      events: 0,
      transfers: 0,
      errors: 0,
      completedActions: 0,
      dismissedActions: 0,
    };
    current.sessions += 1;
    current.events += session.eventCount;
    current.transfers += session.transferCount;
    current.errors += session.errorCount;
    current.completedActions += session.completedActionCount;
    current.dismissedActions += session.dismissedActionCount;
    rows.set(key, current);
  }

  return Array.from(rows.values()).sort((a, b) => b.sessions - a.sessions || b.events - a.events);
}

export function buildVoiceQaDashboard(events: VoiceTimelineEvent[]): VoiceQaDashboard {
  const sessions = groupVoiceTimelineSessions(events);
  return {
    sessions,
    agentPerformance: buildVoiceAgentPerformance(sessions),
    totalIssues: sessions.reduce((total, session) => total + session.flags.length, 0),
    filteredEventCount: events.length,
  };
}

export function timelineFilterOptions(events: VoiceTimelineEvent[]) {
  const domains = Array.from(new Set(events.map((event) => event.domain).filter(Boolean))).sort() as string[];
  const kinds = Array.from(new Set(events.map((event) => event.kind))).sort();
  const severities = Array.from(new Set(events.map((event) => event.severity))).sort();
  return { domains, kinds, severities };
}

function isoTime(value: number) {
  return new Date(value).toISOString();
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildVoiceReplayPack(sessions: VoiceQaSession[]): VoiceQaReplayPack {
  return {
    version: "vyva_voice_replay_pack_v1",
    generatedAt: new Date().toISOString(),
    sessionCount: sessions.length,
    sessions: sessions.map((session) => ({
      sessionId: session.sessionId,
      startedAt: isoTime(session.startedAt),
      endedAt: isoTime(session.endedAt),
      durationMs: session.durationMs,
      domain: session.domain,
      agentSlug: session.agentSlug,
      conversationPlanId: session.conversationPlanId,
      flags: session.flags,
      metrics: {
        eventCount: session.eventCount,
        transfers: session.transferCount,
        completedActions: session.completedActionCount,
        dismissedActions: session.dismissedActionCount,
        errors: session.errorCount,
      },
      timeline: session.events.map((event) => ({
        at: isoTime(event.at),
        offsetMs: Math.max(0, event.at - session.startedAt),
        kind: event.kind,
        severity: event.severity,
        title: event.title,
        ...(event.detail ? { detail: event.detail } : {}),
        ...(event.route ? { route: event.route } : {}),
        ...(event.actionType ? { actionType: event.actionType } : {}),
        ...(event.actionId ? { actionId: event.actionId } : {}),
      })),
    })),
  };
}

export function voiceQaSessionsToCsv(sessions: VoiceQaSession[]) {
  const header = [
    "session_id",
    "started_at",
    "ended_at",
    "duration_ms",
    "domain",
    "agent_slug",
    "conversation_plan_id",
    "events",
    "transfers",
    "completed_actions",
    "dismissed_actions",
    "errors",
    "flags",
    "latest_title",
  ];
  const rows = sessions.map((session) => [
    session.sessionId,
    isoTime(session.startedAt),
    isoTime(session.endedAt),
    session.durationMs,
    session.domain,
    session.agentSlug,
    session.conversationPlanId,
    session.eventCount,
    session.transferCount,
    session.completedActionCount,
    session.dismissedActionCount,
    session.errorCount,
    session.flags.join("; "),
    session.latestTitle,
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function buildVoicePromptDebugContext(session: VoiceQaSession) {
  const events = session.events
    .map((event) => {
      const detail = event.detail ? ` - ${event.detail}` : "";
      const route = event.route ? ` route=${event.route}` : "";
      return `${isoTime(event.at)} ${event.kind} ${event.severity}: ${event.title}${detail}${route}`;
    })
    .join("\n");

  return [
    "VYVA voice prompt debug context",
    `Session: ${session.sessionId}`,
    `Agent/domain: ${session.domain}`,
    `Agent slug: ${session.agentSlug}`,
    `Conversation plan: ${session.conversationPlanId}`,
    `Duration: ${session.durationMs}ms`,
    `Flags: ${session.flags.length > 0 ? session.flags.join(", ") : "none"}`,
    `Metrics: ${session.eventCount} events, ${session.transferCount} transfers, ${session.completedActionCount} completed actions, ${session.dismissedActionCount} dismissed actions, ${session.errorCount} errors`,
    "",
    "Timeline:",
    events || "No events recorded.",
    "",
    "Prompt tuning questions:",
    "- Did the agent open with the correct plan and context?",
    "- Did the app route or transfer at the right moment?",
    "- Did the user need extra clarification before an action?",
    "- Should the specialist prompt, tool call, or app fulfilment change?",
  ].join("\n");
}
