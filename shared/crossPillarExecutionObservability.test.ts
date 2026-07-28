import { describe, expect, it } from "vitest";
import {
  buildCrossPillarExecutionReceipt,
  summarizeCrossPillarRecoveries,
  summarizeCrossPillarToolHealth,
  type CrossPillarExecutionAttemptSnapshot,
} from "./crossPillarExecutionObservability";

function attempt(
  id: string,
  outcome: CrossPillarExecutionAttemptSnapshot["outcome"],
  startedAt: string,
  handoffId = `handoff-${id}`,
  attemptNumber = 1,
): CrossPillarExecutionAttemptSnapshot {
  return {
    id,
    handoffId,
    attemptNumber,
    actionId: "health-doctor",
    pillar: "health",
    workflowReference: "health-doctor-next-step",
    toolFamilies: ["provider_contact"],
    outcome,
    startedAt,
    finishedAt: startedAt,
    idempotencyKey: `key-${id}`,
    createdAt: startedAt,
  };
}

describe("cross-pillar execution observability", () => {
  it("temporarily degrades a tool after repeated recent failures", () => {
    const health = summarizeCrossPillarToolHealth([
      attempt("1", "failed", "2026-07-28T10:05:00.000Z"),
      attempt("2", "timed_out", "2026-07-28T10:04:00.000Z"),
      attempt("3", "failed", "2026-07-28T10:03:00.000Z"),
      attempt("4", "succeeded", "2026-07-28T10:02:00.000Z"),
    ]).find((item) => item.family === "provider_contact");

    expect(health).toMatchObject({
      attempts: 4,
      failures: 3,
      status: "temporarily_degraded",
    });
  });

  it("keeps sparse or successful evidence healthy", () => {
    const health = summarizeCrossPillarToolHealth([
      attempt("1", "failed", "2026-07-28T10:01:00.000Z"),
      attempt("2", "succeeded", "2026-07-28T10:00:00.000Z"),
    ]).find((item) => item.family === "provider_contact");

    expect(health?.status).toBe("healthy");
  });

  it("creates clear success, timeout, and duplicate receipts", () => {
    expect(buildCrossPillarExecutionReceipt({
      outcome: "succeeded",
      actionLabel: "Doctor contact",
      confirmationId: "ABC-123",
    }).whatHappened).toContain("ABC-123");
    expect(buildCrossPillarExecutionReceipt({
      outcome: "timed_out",
      actionLabel: "Doctor contact",
    }).whatRemains).toContain("Try again");
    expect(buildCrossPillarExecutionReceipt({
      outcome: "duplicate",
      actionLabel: "Doctor contact",
    }).whatHappened).toContain("Nothing was sent twice");
  });

  it("separates recovered, blocked, and in-progress handoffs", () => {
    const summary = summarizeCrossPillarRecoveries([
      attempt("a1", "failed", "2026-07-28T10:00:00.000Z", "handoff-a", 1),
      attempt("a2", "resumed", "2026-07-28T10:01:00.000Z", "handoff-a", 2),
      attempt("a3", "succeeded", "2026-07-28T10:02:00.000Z", "handoff-a", 3),
      attempt("b1", "blocked", "2026-07-28T10:03:00.000Z", "handoff-b", 1),
      attempt("c1", "timed_out", "2026-07-28T10:04:00.000Z", "handoff-c", 1),
      attempt("c2", "resumed", "2026-07-28T10:05:00.000Z", "handoff-c", 2),
    ]);

    expect(summary).toMatchObject({
      total: 3,
      recovered: 1,
      stillBlocked: 1,
      inProgress: 1,
      recoveryRatePct: 33,
    });
  });
});
