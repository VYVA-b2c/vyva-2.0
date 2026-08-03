import { describe, expect, it } from "vitest";
import {
  createProactiveEngagementAudit,
  InMemoryProactiveEngagementAuditStore,
  proactiveEngagementAuditSemanticDigest,
  ProactiveEngagementAuditRepositoryStore,
} from "./proactiveAuditPersistence.js";
import { evaluateProactiveEngagementPolicy } from "./proactivePolicy.js";
import { baseProactiveEvaluationInput } from "./proactiveFixtures.js";

function auditForBase() {
  const evaluationInput = baseProactiveEvaluationInput();
  const result = evaluateProactiveEngagementPolicy(evaluationInput);
  if (!result.ok) throw new Error("fixture did not evaluate");
  return createProactiveEngagementAudit({
    evaluationInput,
    decision: result.decision,
    decisionDigest: result.decisionDigest,
    idempotencyKey: result.idempotencyKey,
  });
}

function auditForInput(overrides: Parameters<typeof baseProactiveEvaluationInput>[0] = {}) {
  const evaluationInput = baseProactiveEvaluationInput({
    quietHours: { mode: "none" },
    ...overrides,
  });
  const result = evaluateProactiveEngagementPolicy(evaluationInput);
  if (!result.ok) throw new Error("fixture did not evaluate");
  return {
    evaluation: result,
    audit: createProactiveEngagementAudit({
      evaluationInput: result.input,
      decision: result.decision,
      decisionDigest: result.decisionDigest,
      idempotencyKey: result.idempotencyKey,
    }),
  };
}

describe("Task 8 proactive engagement audit persistence", () => {
  it("stores a valid audit and treats exact duplicates as no-ops", async () => {
    const store = new InMemoryProactiveEngagementAuditStore();
    const audit = auditForBase();
    await expect(store.writeAudit(audit)).resolves.toEqual({ outcome: "stored" });
    await expect(store.writeAudit(audit)).resolves.toEqual({ outcome: "duplicate" });
    expect(store.snapshot()).toHaveLength(1);
  });

  it("rejects the same idempotency identity with changed semantics", async () => {
    const store = new InMemoryProactiveEngagementAuditStore();
    const audit = auditForBase();
    const { proposedChannel: _proposedChannel, ...withoutProposedChannel } = audit;
    const changed = {
      ...withoutProposedChannel,
      reasonCodes: ["quiet_hours" as const],
      decision: "block" as const,
      quietHoursStatus: "inside_quiet_hours" as const,
    };
    await expect(store.writeAudit(audit)).resolves.toEqual({ outcome: "stored" });
    await expect(store.writeAudit(changed)).resolves.toEqual({
      outcome: "rejected",
      reason: "semantic_conflict",
    });
  });

  it("treats canonical timezone aliases and timestamp offsets as duplicate persistence semantics", async () => {
    const store = new InMemoryProactiveEngagementAuditStore();
    const canonical = auditForInput({
      timezone: "America/New_York",
      evaluatedAt: "2026-08-03T12:00:00.000Z",
      dueAt: "2026-08-03T11:55:00.000Z",
    });
    const equivalent = auditForInput({
      timezone: "US/Eastern",
      evaluatedAt: "2026-08-03T13:00:00.000+01:00",
      dueAt: "2026-08-03T12:55:00.000+01:00",
    });
    expect(equivalent.evaluation.input.timezone).toBe("America/New_York");
    expect(equivalent.evaluation.input.evaluatedAt).toBe("2026-08-03T12:00:00.000Z");
    expect(equivalent.evaluation.decision).toEqual(canonical.evaluation.decision);
    expect(equivalent.evaluation.decisionDigest).toBe(canonical.evaluation.decisionDigest);
    expect(equivalent.audit).toEqual(canonical.audit);
    expect(proactiveEngagementAuditSemanticDigest(equivalent.audit))
      .toBe(proactiveEngagementAuditSemanticDigest(canonical.audit));
    await expect(store.writeAudit(canonical.audit)).resolves.toEqual({ outcome: "stored" });
    await expect(store.writeAudit(equivalent.audit)).resolves.toEqual({ outcome: "duplicate" });
    expect(store.snapshot()).toHaveLength(1);
  });

  it("rejects accessor input without invoking it before repository lookup or write", async () => {
    let getterCalls = 0;
    let transactionCalls = 0;
    const store = new ProactiveEngagementAuditRepositoryStore({
      async withTransaction() {
        transactionCalls += 1;
        throw new Error("must not be called");
      },
    });
    const unsafe = auditForBase() as Record<string, unknown>;
    Object.defineProperty(unsafe, "auditId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "audit.unsafe";
      },
    });
    await expect(store.writeAudit(unsafe)).resolves.toEqual({
      outcome: "rejected",
      reason: "invalid_input",
    });
    expect(getterCalls).toBe(0);
    expect(transactionCalls).toBe(0);
  });

  it("classifies database unavailability without exposing raw errors", async () => {
    const store = new ProactiveEngagementAuditRepositoryStore({
      async withTransaction() {
        throw new Error("password=secret unreachable");
      },
    });
    await expect(store.writeAudit(auditForBase())).resolves.toEqual({
      outcome: "rejected",
      reason: "persistence_unavailable",
    });
  });

  it("stores only minimized audit facts and no message, contact, provider or memory content", async () => {
    const store = new InMemoryProactiveEngagementAuditStore();
    await store.writeAudit(auditForBase());
    const serialized = JSON.stringify(store.snapshot());
    expect(serialized).not.toMatch(/\+1\d{10}|user@example\.com|Body|Authorization|cookie|prompt|memory content|medical symptom|provider_payload|device_token/i);
    expect(serialized).toContain("shadowOnly");
    expect(serialized).toContain("nonExecutable");
  });
});
