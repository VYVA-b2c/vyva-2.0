import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { createOrchestratorRouterHandler } from "./orchestrator.js";
import {
  EVENT_STATE_SHADOW_ENV,
  EVENT_STATE_SHADOW_FLAG,
} from "./eventStateFeatureFlags.js";
import { InMemoryEventStateCompatibilityStore } from "./eventStatePersistence.js";
import { resetEventStateTelemetrySink } from "./eventStateTelemetry.js";
import { createEventStateShellObserver } from "./eventStateRuntime.js";

const shadowEnv = {
  [EVENT_STATE_SHADOW_ENV.mode]: "shadow_emit",
  [EVENT_STATE_SHADOW_ENV.rolloutBasisPoints]: "10000",
  [EVENT_STATE_SHADOW_ENV.expiry]: "2026-08-03T12:30:00.000Z",
  [EVENT_STATE_SHADOW_ENV.ownerReference]: "owner.task7",
  [EVENT_STATE_SHADOW_ENV.auditReference]: "audit.task7",
  [EVENT_STATE_SHADOW_ENV.environment]: "test",
};

const minimizedObservation = {
  observationId: "event-state-observation-1",
  idempotencyReference: "authoritative-interaction-1",
  shellCorrelationId: "shell-correlation-task7",
  occurredAt: "2026-08-02T12:00:00.000Z",
  receivedAt: "2026-08-02T12:00:00.000Z",
  userId: "user-1",
  sessionId: "session-1",
  locale: "en-US",
  inputChannel: "voice" as const,
  inputKind: "utterance" as const,
  contentDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  contentLengthBucket: "lt_20" as const,
  responseDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  observation: {
    invocationCount: 1 as const,
    completed: true,
    statusCode: 200,
    responseKind: "json" as const,
    responseDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    latencyBucket: "lt_10ms" as const,
  },
  nonExecutable: true as const,
};

function app(handler: ReturnType<typeof createOrchestratorRouterHandler>) {
  const instance = express();
  instance.use(express.json());
  instance.post("/api/router", handler);
  return instance;
}

function fakeResponse(): Response {
  const response = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: vi.fn(function json(this: { statusCode: number }, body?: unknown) {
      return body;
    }),
    send: vi.fn(function send(_body?: unknown) {
      return this;
    }),
  };
  return response as unknown as Response;
}

describe("Task 7 shell runtime safety", () => {
  afterEach(() => {
    resetEventStateTelemetrySink();
  });

  it("does not observe no-response legacy handlers", async () => {
    const observer = vi.fn();
    const legacyHandler = vi.fn(async () => undefined);
    const handler = createOrchestratorRouterHandler({
      legacyHandler,
      eventStateObserver: observer,
      env: {},
    });

    await handler({ body: { user_id: "user-1", session_id: "session-1", utterance: "hello" } } as Request, fakeResponse());

    expect(legacyHandler).toHaveBeenCalledTimes(1);
    expect(observer).not.toHaveBeenCalled();
  });

  it("runs Task 7 observation after established delivery without changing response", async () => {
    const observer = vi.fn();
    const response = await request(app(createOrchestratorRouterHandler({
      legacyHandler: (_req, res) => res.status(201).json({ ok: true }),
      eventStateObserver: observer,
      env: {},
      idFactory: () => "shell-correlation-task7",
    })))
      .post("/api/router")
      .set("authorization", "Bearer secret-token")
      .set("cookie", "session=secret-cookie")
      .send({
        user_id: "user-1",
        session_id: "session-1",
        idempotency_reference: "authoritative-interaction-1",
        utterance: "hello",
        prompt: "secret-prompt",
        memory: "secret-memory",
        tool_token: "secret-tool-token",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true });
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0][0].idempotencyReference)
      .toBe("authoritative-interaction-1");
    expect(observer.mock.calls[0][0]).not.toHaveProperty("req");
    expect(observer.mock.calls[0][0]).not.toHaveProperty("res");
    const serialized = JSON.stringify(observer.mock.calls[0][0]);
    for (const secret of [
      "hello",
      "secret-token",
      "secret-cookie",
      "secret-prompt",
      "secret-memory",
      "secret-tool-token",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(observer.mock.invocationCallOrder[0]).toBeGreaterThan(0);
  });

  it("preserves legacy response and skips Task 7 when idempotency is unavailable", async () => {
    const observer = vi.fn();
    const legacyHandler = vi.fn((_req, res) =>
      res.status(209).json({ unchanged: true }));
    const response = await request(app(createOrchestratorRouterHandler({
      legacyHandler,
      eventStateObserver: observer,
      env: {},
    }))).post("/api/router").send({
      user_id: "user-1",
      session_id: "session-1",
      utterance: "hello",
    });
    expect(response.status).toBe(209);
    expect(response.body).toEqual({ unchanged: true });
    expect(legacyHandler).toHaveBeenCalledTimes(1);
    expect(observer).not.toHaveBeenCalled();
  });

  it("default disabled mode schedules no Task 7 work", async () => {
    const tasks: Array<() => void> = [];
    const observer = createEventStateShellObserver({
      env: {},
      taskScheduler: (task) => tasks.push(task),
      telemetryEmitter: () => {},
      currentTime: () => new Date("2026-08-02T12:00:00.000Z"),
      idFactory: () => "event-state-disabled-1",
    });

    observer(minimizedObservation);
    expect(tasks).toHaveLength(0);
  });

  it("fails closed before scheduling when stable idempotency is missing", () => {
    const tasks: Array<() => void> = [];
    const observer = createEventStateShellObserver({
      env: shadowEnv,
      taskScheduler: (task) => tasks.push(task),
      telemetryEmitter: () => {},
      currentTime: () => new Date("2026-08-02T12:00:00.000Z"),
    });
    const { idempotencyReference: _missing, ...withoutReference } =
      minimizedObservation;
    observer(withoutReference);
    expect(tasks).toHaveLength(0);
  });

  it("rejects accessor-bearing shell envelopes before scheduling, telemetry facts or persistence", () => {
    let getterCalls = 0;
    let setterCalls = 0;
    let idFactoryCalls = 0;
    let currentTimeCalls = 0;
    let flagResolverCalls = 0;
    const tasks: Array<() => void> = [];
    const telemetry: unknown[] = [];
    const store = {
      writeInteractionEvent: vi.fn(async () => ({ outcome: "stored" as const })),
      writeFlowProjection: vi.fn(async () => ({ outcome: "stored" as const })),
      eventsByCorrelation: vi.fn(async () => []),
      activeFlowsBySession: vi.fn(async () => []),
    };
    const observer = createEventStateShellObserver({
      store,
      env: shadowEnv,
      flagResolver: () => {
        flagResolverCalls += 1;
        return {
          flagId: EVENT_STATE_SHADOW_FLAG.flagId,
          flagVersion: EVENT_STATE_SHADOW_FLAG.flagVersion,
          requestedMode: "shadow_emit",
          effectiveMode: "shadow_emit",
          defaultMode: "disabled",
          reasonCode: "event_state_shadow_selected",
          nonExecutable: true,
        };
      },
      taskScheduler: (task) => tasks.push(task),
      telemetryEmitter: (record) => telemetry.push(record),
      currentTime: () => {
        currentTimeCalls += 1;
        return new Date("2026-08-02T12:00:00.000Z");
      },
      idFactory: () => {
        idFactoryCalls += 1;
        return "event-state-accessor-rejected";
      },
    });
    const accessorEnvelope = Object.defineProperties({}, {
      observation: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return minimizedObservation.observation;
        },
      },
      userId: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return "must-not-run";
        },
      },
      sink: {
        enumerable: true,
        set(_value: unknown) {
          setterCalls += 1;
        },
      },
    });

    observer(accessorEnvelope as never);

    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
    expect(idFactoryCalls).toBe(0);
    expect(currentTimeCalls).toBe(0);
    expect(flagResolverCalls).toBe(0);
    expect(tasks).toHaveLength(0);
    expect(store.writeInteractionEvent).not.toHaveBeenCalled();
    expect(store.writeFlowProjection).not.toHaveBeenCalled();
    expect(store.eventsByCorrelation).not.toHaveBeenCalled();
    expect(store.activeFlowsBySession).not.toHaveBeenCalled();
    expect(telemetry).toHaveLength(0);
  });

  it("emits one minimized event when its own flag is enabled", async () => {
    const store = new InMemoryEventStateCompatibilityStore();
    const telemetry: unknown[] = [];
    const tasks: Array<() => void> = [];
    const observer = createEventStateShellObserver({
      store,
      env: shadowEnv,
      currentTime: () => new Date("2026-08-02T12:00:00.000Z"),
      idFactory: () => "event-state-observation-1",
      telemetryEmitter: (record) => telemetry.push(record),
      taskScheduler: (task) => tasks.push(task),
    });

    observer(minimizedObservation);
    expect(tasks).toHaveLength(1);
    tasks[0]();
    await vi.waitFor(async () => {
      expect(await store.eventsByCorrelation("shell-correlation-task7")).toHaveLength(1);
    });
    const stored = await store.eventsByCorrelation("shell-correlation-task7");
    expect(JSON.stringify(stored)).not.toContain("hello");
    expect(JSON.stringify(stored)).toContain("contentDigest");
    expect(JSON.stringify(telemetry)).not.toContain("hello");
    expect(telemetry).toEqual(expect.arrayContaining([
      expect.objectContaining({
        persistenceOutcome: "stored",
        eventType: "FLOW_WAITING_FOR_USER",
        nonExecutable: true,
      }),
    ]));
  });

  it("persists exact retries once across changed attempt correlation and time", async () => {
    const store = new InMemoryEventStateCompatibilityStore();
    const tasks: Array<() => void> = [];
    const telemetry: Array<{ persistenceOutcome?: string }> = [];
    const observer = createEventStateShellObserver({
      store,
      env: shadowEnv,
      currentTime: () => new Date("2026-08-02T12:00:00.000Z"),
      telemetryEmitter: (record) => telemetry.push(record),
      taskScheduler: (task) => tasks.push(task),
    });
    observer(minimizedObservation);
    observer({
      ...minimizedObservation,
      observationId: "different-observation-id",
      shellCorrelationId: "different-shell-correlation",
      occurredAt: "2026-08-02T12:01:00.000Z",
      receivedAt: "2026-08-02T12:01:00.100Z",
    });
    expect(tasks).toHaveLength(2);
    tasks.forEach((task) => task());
    await vi.waitFor(() => {
      expect(telemetry.map((record) => record.persistenceOutcome).sort())
        .toEqual(["duplicate", "stored"]);
    });
    expect(await store.eventsByCorrelation("shell-correlation-task7")).toHaveLength(1);
    expect(await store.eventsByCorrelation("different-shell-correlation")).toHaveLength(0);
  });

  it("Task 7 persistence failure does not alter the legacy response", async () => {
    const tasks: Array<() => void> = [];
    const observer = createEventStateShellObserver({
      env: shadowEnv,
      currentTime: () => new Date("2026-08-02T12:00:00.000Z"),
      idFactory: () => "event-state-observation-2",
      telemetryEmitter: () => {},
      taskScheduler: (task) => tasks.push(task),
      store: {
        writeInteractionEvent: async () => { throw new Error("store unavailable"); },
        writeFlowProjection: async () => ({ outcome: "stored" }),
        eventsByCorrelation: async () => [],
        activeFlowsBySession: async () => [],
      },
    });

    const response = await request(app(createOrchestratorRouterHandler({
      legacyHandler: (_req, res) => res.status(202).json({ ok: true }),
      env: {},
      idFactory: () => "shell-correlation-task7",
      eventStateObserver: observer,
    })))
      .post("/api/router")
      .send({ user_id: "user-1", session_id: "session-1", idempotency_reference: "authoritative-interaction-2", utterance: "hello" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ ok: true });
    expect(tasks).toHaveLength(1);
    tasks[0]();
  });

  it("Task 7 telemetry failure and timeout do not alter the legacy response", async () => {
    const tasks: Array<() => void> = [];
    const observer = createEventStateShellObserver({
      env: shadowEnv,
      currentTime: () => new Date("2026-08-02T12:00:00.000Z"),
      idFactory: () => "event-state-observation-timeout",
      telemetryEmitter: () => { throw new Error("telemetry down"); },
      taskScheduler: (task) => tasks.push(task),
      timeoutMs: 1,
      store: {
        writeInteractionEvent: () => new Promise(() => {}),
        writeFlowProjection: async () => ({ outcome: "stored" }),
        eventsByCorrelation: async () => [],
        activeFlowsBySession: async () => [],
      },
    });

    const response = await request(app(createOrchestratorRouterHandler({
      legacyHandler: (_req, res) => res.status(203).json({ ok: true }),
      env: {},
      idFactory: () => "shell-correlation-task7",
      eventStateObserver: observer,
    })))
      .post("/api/router")
      .send({ user_id: "user-1", session_id: "session-1", idempotency_reference: "authoritative-interaction-3", utterance: "hello" });

    expect(response.status).toBe(203);
    expect(response.body).toEqual({ ok: true });
    expect(tasks).toHaveLength(1);
    tasks[0]();
  });
});
