import { describe, expect, it, vi } from "vitest";
import { InMemoryProactiveEngagementAuditStore } from "./proactiveAuditPersistence.js";
import {
  PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV,
  resolveProactiveEngagementAuditShadowMode,
} from "./proactiveFeatureFlags.js";
import { createProactiveEngagementShadowObserver } from "./proactiveRuntime.js";
import { baseProactiveEvaluationInput } from "./proactiveFixtures.js";
import type { ProactiveEngagementTelemetryRecord } from "./proactiveTelemetry.js";

const currentTime = () => new Date("2026-08-03T12:00:00.000Z");

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.mode]: "audit_shadow",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.rolloutBasisPoints]: "10000",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.expiry]: "2026-08-04T00:00:00.000Z",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.ownerReference]: "owner.task8",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.auditReference]: "audit.task8",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.environment]: "test",
    ...overrides,
  };
}

describe("Task 8 proactive engagement shadow runtime", () => {
  it("returns immediately on clone failure with zero internal work", async () => {
    let getterCalls = 0;
    const unsafe = baseProactiveEvaluationInput() as Record<string, unknown>;
    Object.defineProperty(unsafe, "evaluationId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "eval.unsafe";
      },
    });
    const flagResolver = vi.fn(resolveProactiveEngagementAuditShadowMode);
    const store = { writeAudit: vi.fn(async () => ({ outcome: "stored" as const })) };
    const telemetryEmitter = vi.fn();
    const idFactory = vi.fn(() => "observation.runtime");
    const clock = vi.fn(currentTime);
    const observer = createProactiveEngagementShadowObserver({
      flagResolver,
      store,
      telemetryEmitter,
      idFactory,
      currentTime: clock,
      env: validEnv(),
    });
    await expect(observer(unsafe)).resolves.toEqual({
      outcome: "invalid_input",
      shadowOnly: true,
      nonExecutable: true,
    });
    expect(getterCalls).toBe(0);
    expect(flagResolver).toHaveBeenCalledTimes(0);
    expect(store.writeAudit).toHaveBeenCalledTimes(0);
    expect(telemetryEmitter).toHaveBeenCalledTimes(0);
    expect(idFactory).toHaveBeenCalledTimes(0);
    expect(clock).toHaveBeenCalledTimes(0);
  });

  it("honors the kill switch without evaluation writes or telemetry", async () => {
    const store = { writeAudit: vi.fn(async () => ({ outcome: "stored" as const })) };
    const telemetryEmitter = vi.fn();
    const idFactory = vi.fn(() => "observation.runtime");
    const observer = createProactiveEngagementShadowObserver({
      store,
      telemetryEmitter,
      idFactory,
      currentTime,
      env: validEnv({ [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.mode]: "disabled" }),
    });
    await expect(observer(baseProactiveEvaluationInput())).resolves.toEqual({
      outcome: "disabled",
      shadowOnly: true,
      nonExecutable: true,
    });
    expect(store.writeAudit).toHaveBeenCalledTimes(0);
    expect(telemetryEmitter).toHaveBeenCalledTimes(0);
    expect(idFactory).toHaveBeenCalledTimes(0);
  });

  it("evaluates, stores and emits minimized telemetry in audit-shadow mode", async () => {
    const store = new InMemoryProactiveEngagementAuditStore();
    const telemetry: ProactiveEngagementTelemetryRecord[] = [];
    const observer = createProactiveEngagementShadowObserver({
      store,
      telemetryEmitter: (record) => telemetry.push(record),
      idFactory: () => "observation.runtime.valid",
      currentTime,
      env: validEnv(),
      monotonicNow: (() => {
        let value = 0;
        return () => {
          value += 5;
          return value;
        };
      })(),
    });
    await expect(observer(baseProactiveEvaluationInput())).resolves.toEqual({
      outcome: "evaluated_and_stored",
      shadowOnly: true,
      nonExecutable: true,
    });
    expect(store.snapshot()).toHaveLength(1);
    expect(telemetry).toHaveLength(1);
    expect(telemetry[0]).toMatchObject({
      observationId: "observation.runtime.valid",
      runtimeOutcome: "evaluated_and_stored",
      decision: "allow",
      proposedChannel: "whatsapp",
      persistence: "stored",
      shadowOnly: true,
      nonExecutable: true,
    });
    expect(JSON.stringify(telemetry[0])).not.toMatch(/user\.test|profile\.test|phone|email@|message|provider|memory/i);
  });

  it("classifies duplicate and persistence-failure outcomes without changing live behavior", async () => {
    const store = new InMemoryProactiveEngagementAuditStore();
    const observer = createProactiveEngagementShadowObserver({
      store,
      telemetryEmitter: () => {},
      currentTime,
      env: validEnv(),
    });
    await expect(observer(baseProactiveEvaluationInput())).resolves.toMatchObject({ outcome: "evaluated_and_stored" });
    await expect(observer(baseProactiveEvaluationInput())).resolves.toMatchObject({ outcome: "duplicate" });

    const failing = createProactiveEngagementShadowObserver({
      store: { writeAudit: vi.fn(async () => ({ outcome: "rejected", reason: "persistence_unavailable" as const })) },
      telemetryEmitter: () => {},
      currentTime,
      env: validEnv(),
    });
    await expect(failing(baseProactiveEvaluationInput())).resolves.toMatchObject({ outcome: "persistence_failure" });
  });

  it("uses one bounded persistence attempt and reports timeout", async () => {
    const observer = createProactiveEngagementShadowObserver({
      store: {
        writeAudit: vi.fn(() => new Promise((resolve) => {
          setTimeout(() => resolve({ outcome: "stored" as const }), 50);
        })),
      },
      telemetryEmitter: () => {},
      currentTime,
      env: validEnv(),
      timeoutMs: 1,
    });
    await expect(observer(baseProactiveEvaluationInput())).resolves.toMatchObject({ outcome: "timeout" });
  });

  it("isolates telemetry sink failures", async () => {
    const observer = createProactiveEngagementShadowObserver({
      store: new InMemoryProactiveEngagementAuditStore(),
      telemetryEmitter: () => {
        throw new Error("telemetry unavailable");
      },
      currentTime,
      env: validEnv(),
    });
    await expect(observer(baseProactiveEvaluationInput())).resolves.toMatchObject({ outcome: "evaluated_and_stored" });
  });
});
