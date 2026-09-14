import { describe, expect, it } from "vitest";
import {
  decideHomeContextMessage,
  HOME_CONTEXT_MESSAGE_DISPLAY_MS,
  homeContextActionForVoiceReply,
  isHomeContextMessageSuppressed,
  readHomeContextMessageActionHistory,
  readHomeContextMessageOutcomeHistory,
  selectHomeContextMessage,
  stripAgentStageDirections,
  writeHomeContextMessageAction,
  writeHomeContextMessageOutcome,
  type HomeContextMessage,
} from "./homeContextMessages";

const message = (overrides: Partial<HomeContextMessage>): HomeContextMessage => ({
  id: "message",
  kind: "default",
  title: "Hello",
  priority: 1,
  ...overrides,
});

describe("home context messages", () => {
  it("keeps each contextual message visible for fifteen seconds", () => {
    expect(HOME_CONTEXT_MESSAGE_DISPLAY_MS).toBe(15_000);
  });

  it("selects the highest-priority eligible message", () => {
    expect(selectHomeContextMessage([
      message({ id: "tip", priority: 10 }),
      message({ id: "dose", priority: 60 }),
      message({ id: "flow", priority: 90 }),
    ])?.id).toBe("flow");
  });

  it("uses named business tiers before numeric tie-breakers", () => {
    expect(decideHomeContextMessage([
      message({ id: "admin:campaign", kind: "feature", priority: 999 }),
      message({ id: "dose", kind: "reminder", priority: 1 }),
      message({ id: "flow", kind: "flow", priority: 1 }),
      message({ id: "safety", kind: "urgent", priority: 1 }),
    ])).toMatchObject({
      message: { id: "safety" },
      reason: "urgent_safety",
      score: 5001,
    });
  });

  it("keeps active flows ahead of reminders and admin messages", () => {
    expect(decideHomeContextMessage([
      message({ id: "admin:campaign", kind: "feature", priority: 999 }),
      message({ id: "dose", kind: "reminder", priority: 999 }),
      message({ id: "flow", kind: "flow", priority: 1 }),
    ])?.reason).toBe("active_flow");
  });

  it("returns an auditable decision with expiry and safe action", () => {
    expect(decideHomeContextMessage([
      message({
        id: "dose",
        kind: "reminder",
        priority: 20,
        expiresAt: 500,
        actionLabel: "Open medicines",
        actionRoute: "/meds",
        actionState: { source: "home" },
      }),
    ], {}, 100)).toMatchObject({
      reason: "due_personal",
      evaluatedAt: 100,
      expiresAt: 500,
      action: {
        label: "Open medicines",
        route: "/meds",
        state: { source: "home" },
      },
    });
  });

  it("ignores messages outside their active window", () => {
    expect(selectHomeContextMessage([
      message({ id: "expired", priority: 90, expiresAt: 99 }),
      message({ id: "future", priority: 80, startsAt: 101 }),
      message({ id: "current", priority: 10 }),
    ], {}, 100)?.id).toBe("current");
  });

  it("suppresses a recently seen repeating message", () => {
    expect(selectHomeContextMessage([
      message({ id: "dose", priority: 60, repeatAfterMs: 1_000 }),
      message({ id: "fallback", priority: 1 }),
    ], { dose: 500 }, 1_000)?.id).toBe("fallback");
  });

  it("allows a repeating message back into the loop after its cooldown", () => {
    expect(selectHomeContextMessage([
      message({ id: "dose", kind: "reminder", priority: 60, repeatAfterMs: 1_000 }),
      message({ id: "fallback", priority: 1 }),
    ], { dose: 500 }, 1_501)?.id).toBe("dose");
  });

  it("removes private agent stage directions from visible text", () => {
    expect(stripAgentStageDirections("[warmly] Your ride is booked. [pause]")).toBe("Your ride is booked.");
  });

  it("understands short contextual replies in supported app languages", () => {
    expect(homeContextActionForVoiceReply("Show me")).toBe("open");
    expect(homeContextActionForVoiceReply("Más tarde")).toBe("defer");
    expect(homeContextActionForVoiceReply("Pas maintenant")).toBe("defer");
    expect(homeContextActionForVoiceReply("Erledigt")).toBe("complete");
    expect(homeContextActionForVoiceReply("Rimuovilo")).toBe("dismiss");
    expect(homeContextActionForVoiceReply("Sim, por favor")).toBe("open");
    expect(homeContextActionForVoiceReply("Yes, but tell me what this means first")).toBeNull();
  });

  it("persists message outcomes and suppresses deferred or closed messages", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    writeHomeContextMessageAction("dose", "deferred", {
      recordedAt: 1_000,
      deferForMs: 2_000,
      source: "voice",
    }, storage);
    const deferred = readHomeContextMessageActionHistory(storage);
    expect(isHomeContextMessageSuppressed("dose", deferred, 2_000)).toBe(true);
    expect(isHomeContextMessageSuppressed("dose", deferred, 3_001)).toBe(false);

    writeHomeContextMessageAction("dose", "completed", { recordedAt: 4_000 }, storage);
    expect(isHomeContextMessageSuppressed("dose", readHomeContextMessageActionHistory(storage), 99_000)).toBe(true);
  });

  it("ranks medication and appointment reminders above non-urgent discovery", () => {
    const now = new Date(2026, 6, 20, 9, 0).getTime();
    expect(decideHomeContextMessage([
      message({ id: "tip", kind: "tip", priority: 999, nonUrgent: true }),
      message({
        id: "appointment",
        kind: "reminder",
        category: "appointment",
        priority: 1,
        dueAt: now + 90 * 60_000,
      }),
      message({
        id: "dose",
        kind: "reminder",
        category: "medication",
        priority: 1,
        dueAt: now + 15 * 60_000,
      }),
    ], {}, now)?.message.id).toBe("dose");
  });

  it("uses current intent and timing as auditable ranking factors", () => {
    const now = new Date(2026, 6, 20, 9, 0).getTime();
    const decision = decideHomeContextMessage([
      message({ id: "general", kind: "event", priority: 100 }),
      message({
        id: "health",
        kind: "event",
        priority: 1,
        intentTags: ["health"],
        dueAt: now + 20 * 60_000,
      }),
    ], {}, now, { activeIntent: "health" });
    expect(decision?.message.id).toBe("health");
    expect(decision?.factors.map((factor) => factor.key)).toEqual(
      expect.arrayContaining(["intent", "timing"]),
    );
    expect(decision?.explanation).toContain("current health intent");
  });

  it("avoids recent non-urgent repeats and enforces the daily nudge cap", () => {
    const now = new Date(2026, 6, 20, 12, 0).getTime();
    const outcomes = ["tip-a", "tip-b", "tip-c"].map((messageId, index) => ({
      messageId,
      outcome: "shown" as const,
      recordedAt: now - (index + 1) * 60_000,
      source: "system" as const,
      kind: "tip" as const,
    }));
    expect(decideHomeContextMessage([
      message({ id: "tip-new", kind: "tip", priority: 100 }),
      message({ id: "fallback", kind: "default", priority: 0 }),
    ], {}, now, { outcomeHistory: outcomes, dailyNonUrgentLimit: 3 })?.message.id).toBe("fallback");

    expect(decideHomeContextMessage([
      message({ id: "tip-a", kind: "tip", priority: 100 }),
      message({ id: "fallback", kind: "default", priority: 0 }),
    ], { "tip-a": now - 10 * 60_000 }, now, {
      outcomeHistory: outcomes,
      recentNonUrgentWindowMs: 60 * 60_000,
    })?.message.id).toBe("fallback");
  });

  it("freezes rotation during conversation but permits urgent and active-flow overrides", () => {
    const base = [
      message({ id: "previous", kind: "event", priority: 10 }),
      message({ id: "newer", kind: "event", priority: 999 }),
    ];
    expect(decideHomeContextMessage(base, {}, 100, {
      freezeRotation: true,
      frozenMessageId: "previous",
    })).toMatchObject({ message: { id: "previous" }, frozen: true });

    expect(decideHomeContextMessage([
      ...base,
      message({ id: "urgent", kind: "urgent", priority: 1 }),
    ], {}, 100, {
      freezeRotation: true,
      frozenMessageId: "previous",
    })?.message.id).toBe("urgent");

    expect(decideHomeContextMessage([
      ...base,
      message({ id: "flow", kind: "flow", priority: 1 }),
    ], {}, 100, {
      freezeRotation: true,
      frozenMessageId: "previous",
    })?.message.id).toBe("flow");
  });

  it("stores all outcome types and keeps bounded history", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const outcomes = ["shown", "opened", "deferred", "dismissed", "completed", "voice_engaged"] as const;
    outcomes.forEach((outcome, index) => writeHomeContextMessageOutcome({
      messageId: `message-${index}`,
      outcome,
      source: outcome === "voice_engaged" ? "voice" : "system",
      recordedAt: index,
    }, storage));
    expect(readHomeContextMessageOutcomeHistory(storage).map((record) => record.outcome)).toEqual(outcomes);

    for (let index = 0; index < 260; index += 1) {
      writeHomeContextMessageOutcome({
        messageId: `bounded-${index}`,
        outcome: "shown",
        source: "system",
        recordedAt: index + 10,
      }, storage);
    }
    const bounded = readHomeContextMessageOutcomeHistory(storage);
    expect(bounded).toHaveLength(250);
    expect(bounded.at(-1)?.messageId).toBe("bounded-259");
  });
});
