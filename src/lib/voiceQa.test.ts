import { describe, expect, it } from "vitest";
import {
  buildVoicePromptDebugContext,
  buildVoiceQaDashboard,
  buildVoiceReplayPack,
  filterVoiceTimelineEvents,
  groupVoiceTimelineSessions,
  voiceQaSessionsToCsv,
} from "./voiceQa";
import type { VoiceTimelineEvent } from "./voiceTimeline";

function event(input: Partial<VoiceTimelineEvent> & Pick<VoiceTimelineEvent, "id" | "at" | "kind" | "title">): VoiceTimelineEvent {
  return {
    severity: "info",
    ...input,
  };
}

describe("voice QA", () => {
  it("groups timeline events by session", () => {
    const sessions = groupVoiceTimelineSessions([
      event({ id: "1", at: 100, kind: "session_started", title: "Started", sessionId: "s1", domain: "companion" }),
      event({ id: "2", at: 200, kind: "session_connected", title: "Connected", sessionId: "s1" }),
      event({ id: "3", at: 300, kind: "action_completed", title: "Done", sessionId: "s1" }),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId: "s1",
      eventCount: 3,
      domain: "companion",
      completedActionCount: 1,
    });
  });

  it("flags sessions with errors and missing connection", () => {
    const dashboard = buildVoiceQaDashboard([
      event({ id: "1", at: 100, kind: "session_started", title: "Started", sessionId: "s1" }),
      event({ id: "2", at: 150, kind: "session_error", title: "Error", sessionId: "s1", severity: "error" }),
    ]);

    expect(dashboard.sessions[0].flags).toContain("Error");
    expect(dashboard.sessions[0].flags).toContain("No connection");
    expect(dashboard.totalIssues).toBe(2);
  });

  it("filters events by query, domain, kind and severity", () => {
    const events = [
      event({ id: "1", at: 100, kind: "action_completed", title: "Medication done", domain: "meds", severity: "success" }),
      event({ id: "2", at: 200, kind: "session_error", title: "Health failed", domain: "health", severity: "error" }),
    ];

    expect(filterVoiceTimelineEvents(events, { query: "medication", domain: "meds", kind: "action_completed", severity: "success" })).toHaveLength(1);
    expect(filterVoiceTimelineEvents(events, { severity: "error" })[0].domain).toBe("health");
  });

  it("rolls up agent performance by domain", () => {
    const dashboard = buildVoiceQaDashboard([
      event({ id: "1", at: 100, kind: "session_started", title: "Started", sessionId: "s1", domain: "meds" }),
      event({ id: "2", at: 200, kind: "action_dismissed", title: "Dismissed", sessionId: "s1", domain: "meds", severity: "warning" }),
      event({ id: "3", at: 300, kind: "session_started", title: "Started", sessionId: "s2", domain: "health" }),
    ]);

    expect(dashboard.agentPerformance[0]).toMatchObject({
      label: "meds",
      sessions: 1,
      dismissedActions: 1,
    });
  });

  it("builds a replay pack for prompt and tool testing", () => {
    const dashboard = buildVoiceQaDashboard([
      event({ id: "1", at: 100, kind: "session_started", title: "Started", sessionId: "s1", domain: "meds", conversationPlanId: "meds_check" }),
      event({ id: "2", at: 250, kind: "transfer_requested", title: "Transfer", sessionId: "s1", route: "/meds" }),
    ]);

    const pack = buildVoiceReplayPack(dashboard.sessions);
    expect(pack.version).toBe("vyva_voice_replay_pack_v1");
    expect(pack.sessions[0]).toMatchObject({
      sessionId: "s1",
      domain: "meds",
      conversationPlanId: "meds_check",
      metrics: { transfers: 1 },
    });
    expect(pack.sessions[0].timeline[1].offsetMs).toBe(150);
  });

  it("exports sessions as CSV", () => {
    const dashboard = buildVoiceQaDashboard([
      event({ id: "1", at: 100, kind: "session_started", title: "Started, with comma", sessionId: "s1", domain: "health" }),
    ]);

    const csv = voiceQaSessionsToCsv(dashboard.sessions);
    expect(csv).toContain("session_id,started_at");
    expect(csv).toContain('"Started, with comma"');
  });

  it("builds prompt debug context for one session", () => {
    const dashboard = buildVoiceQaDashboard([
      event({ id: "1", at: 100, kind: "session_started", title: "Started", sessionId: "s1", domain: "companion" }),
      event({ id: "2", at: 200, kind: "session_error", title: "Token failed", sessionId: "s1", severity: "error" }),
    ]);

    const context = buildVoicePromptDebugContext(dashboard.sessions[0]);
    expect(context).toContain("Session: s1");
    expect(context).toContain("Flags: Error, No connection");
    expect(context).toContain("Prompt tuning questions");
  });
});
