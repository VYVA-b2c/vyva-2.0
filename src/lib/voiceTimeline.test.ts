import { beforeEach, describe, expect, it } from "vitest";
import {
  clearVoiceTimeline,
  getVoiceTimelineEvents,
  recordVoiceTimelineEvent,
} from "./voiceTimeline";

describe("voice timeline", () => {
  beforeEach(() => {
    clearVoiceTimeline();
  });

  it("records persistent timeline events", () => {
    recordVoiceTimelineEvent({
      kind: "session_started",
      title: "Voice session started",
      domain: "companion",
      conversationPlanId: "main_vyva_returning_app_open",
    });

    const events = getVoiceTimelineEvents();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("session_started");
    expect(events[0].severity).toBe("info");
    expect(events[0].conversationPlanId).toBe("main_vyva_returning_app_open");
  });

  it("uses success severity for completed actions by default", () => {
    recordVoiceTimelineEvent({
      kind: "action_completed",
      title: "Medication check completed",
      actionId: "voice_meds_inventory_report",
    });

    expect(getVoiceTimelineEvents()[0].severity).toBe("success");
  });

  it("clears recorded events", () => {
    recordVoiceTimelineEvent({
      kind: "simulator",
      title: "Simulator utterance matched",
    });
    clearVoiceTimeline();

    expect(getVoiceTimelineEvents()).toEqual([]);
  });
});
