import { describe, expect, it } from "vitest";
import {
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
