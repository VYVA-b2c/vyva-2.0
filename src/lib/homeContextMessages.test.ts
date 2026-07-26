import { describe, expect, it } from "vitest";
import {
  decideHomeContextMessage,
  selectHomeContextMessage,
  stripAgentStageDirections,
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

  it("removes private agent stage directions from visible text", () => {
    expect(stripAgentStageDirections("[warmly] Your ride is booked. [pause]")).toBe("Your ride is booked.");
  });
});
