import { describe, expect, it } from "vitest";
import { emitRuntimeInteractionEvent } from "./eventStateAdapters.js";
import {
  DurableEventStateCompatibilityStore,
  InMemoryEventStateCompatibilityRepository,
  InMemoryEventStateCompatibilityStore,
} from "./eventStatePersistence.js";
import {
  normalizeRuntimeInteractionEvent,
  normalizeShellDeliveryEvent,
} from "./interactionEventRuntime.js";
import { projectRuntimeFlowState } from "./flowStateRuntime.js";

const rawEvent = {
  eventId: "event-task7-001",
  occurredAt: "2026-08-02T10:00:00.000Z",
  receivedAt: "2026-08-02T10:00:00.100Z",
  correlationId: "corr-task7-001",
  userId: "user-task7-001",
  sessionId: "session-task7-001",
  locale: "en-US",
  parentEventIds: [],
  adapter: "voice",
  transcript: "start",
};

const rawEventBase = {
  occurredAt: rawEvent.occurredAt,
  receivedAt: rawEvent.receivedAt,
  correlationId: rawEvent.correlationId,
  userId: rawEvent.userId,
  sessionId: rawEvent.sessionId,
  locale: rawEvent.locale,
  parentEventIds: [] as string[],
};

describe("Task 7 compatibility persistence and adapter", () => {
  it("adapter rejects accessor envelopes before normalization, duplicate lookup or insert", async () => {
    let getterCalls = 0;
    let setterCalls = 0;
    let transactions = 0;
    const repository = {
      withTransaction: async () => {
        transactions += 1;
        return { outcome: "stored" };
      },
    };
    const store = new DurableEventStateCompatibilityStore(repository as never);
    const accessorEnvelope = Object.defineProperties({}, {
      rawEvent: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return rawEvent;
        },
      },
      store: {
        enumerable: true,
        value: store,
      },
      flowProjection: {
        enumerable: true,
        set(_value: unknown) {
          setterCalls += 1;
        },
      },
    });

    await expect(emitRuntimeInteractionEvent(accessorEnvelope as never))
      .resolves.toEqual({
        ok: false,
        error: "normalization_invalid",
        persistenceOutcome: "not_attempted",
      });
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
    expect(transactions).toBe(0);
  });

  it("rejects caller-owned accessors before parsing, lookup or insert", async () => {
    let getterCalls = 0;
    let setterCalls = 0;
    let duplicateLookups = 0;
    let inserts = 0;
    const normalized = normalizeRuntimeInteractionEvent(rawEvent);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;

    const metadata = Object.defineProperties({}, {
      secret: {
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
    const repository = {
      withTransaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          findEventById: async () => {
            duplicateLookups += 1;
            return undefined;
          },
          insertEvent: async () => {
            inserts += 1;
            return "inserted";
          },
        }),
    };
    const store = new DurableEventStateCompatibilityStore(repository as never);

    await expect(store.writeInteractionEvent({
      ...normalized.event,
      metadata,
    })).resolves.toEqual({ outcome: "rejected", reason: "persistence_unavailable" });
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
    expect(duplicateLookups).toBe(0);
    expect(inserts).toBe(0);
  });

  it("rejects caller-owned Flow accessors before parsing, lookup or insert", async () => {
    let getterCalls = 0;
    let setterCalls = 0;
    let transactions = 0;
    const projected = projectRuntimeFlowState({
      flowId: "flow.health.preventive_check",
      flowVersion: "1.0.0",
      state: "active",
      sessionId: "session-flow-accessor",
      userId: "user-task7-001",
      updatedAt: "2026-08-02T10:00:00.000Z",
      context: {},
    });
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    const flowState = Object.defineProperties({ ...projected.flowState }, {
      context: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return { secret: "must-not-run" };
        },
      },
      sink: {
        enumerable: true,
        set(_value: unknown) {
          setterCalls += 1;
        },
      },
    });
    const repository = {
      withTransaction: async () => {
        transactions += 1;
        return { outcome: "stored" };
      },
    };
    const store = new DurableEventStateCompatibilityStore(repository as never);

    await expect(store.writeFlowProjection(flowState as never, {
      eventId: "event-flow-accessor",
      reason: "test",
    })).resolves.toEqual({
      outcome: "rejected",
      reason: "persistence_unavailable",
    });
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
    expect(transactions).toBe(0);
  });

  it("rejects accessor-bearing persistence options without invoking them", async () => {
    let getterCalls = 0;
    let setterCalls = 0;
    let transactions = 0;
    const normalized = normalizeRuntimeInteractionEvent(rawEvent);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    const options = Object.defineProperties({}, {
      localParentEvents: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return [];
        },
      },
      sink: {
        enumerable: true,
        set(_value: unknown) {
          setterCalls += 1;
        },
      },
    });
    const repository = {
      withTransaction: async () => {
        transactions += 1;
        return { outcome: "stored" };
      },
    };
    const store = new DurableEventStateCompatibilityStore(repository as never);

    await expect(store.writeInteractionEvent(normalized.event, options as never))
      .resolves.toEqual({ outcome: "rejected", reason: "persistence_unavailable" });
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
    expect(transactions).toBe(0);
  });

  it("persists only detached event and parent clones", async () => {
    const parent = normalizeRuntimeInteractionEvent({
      ...rawEvent,
      eventId: "detached-parent",
      transcript: "parent",
    });
    const child = normalizeRuntimeInteractionEvent({
      ...rawEventBase,
      eventId: "detached-child",
      adapter: "text",
      text: "child",
      causationId: "detached-parent",
      parentEventIds: ["detached-parent"],
    });
    expect(parent.ok && child.ok).toBe(true);
    if (!parent.ok || !child.ok) return;

    let capturedEvent: unknown;
    const repository = {
      withTransaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          findEventById: async () => undefined,
          insertEvent: async (record: { event: unknown }) => {
            capturedEvent = record.event;
            return "inserted";
          },
        }),
    };
    const store = new DurableEventStateCompatibilityStore(repository as never);
    await expect(store.writeInteractionEvent(child.event, {
      localParentEvents: [parent.event],
    })).resolves.toEqual({ outcome: "stored" });
    expect(capturedEvent).toEqual(child.event);
    expect(capturedEvent).not.toBe(child.event);
    expect((capturedEvent as { payload: unknown }).payload).not.toBe(child.event.payload);
  });

  it("keeps retry idempotency across store instances and rejects changed semantics", async () => {
    const repository = new InMemoryEventStateCompatibilityRepository();
    const firstStore = new DurableEventStateCompatibilityStore(repository);
    const restartedStore = new DurableEventStateCompatibilityStore(repository);
    const shell = {
      idempotencyKey: "authoritative-interaction-persistence-1",
      occurredAt: "2026-08-02T10:00:00.000Z",
      receivedAt: "2026-08-02T10:00:00.100Z",
      correlationId: "attempt-correlation-1",
      userId: "user-task7-001",
      sessionId: "session-task7-001",
      locale: "en-US",
      statusCode: 200,
      responseDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      routeId: "route.api.router.post" as const,
    };
    const first = normalizeShellDeliveryEvent(shell);
    const retry = normalizeShellDeliveryEvent({
      ...shell,
      correlationId: "attempt-correlation-2",
      occurredAt: "2026-08-02T10:01:00.000Z",
      receivedAt: "2026-08-02T10:01:00.100Z",
    });
    const changed = normalizeShellDeliveryEvent({
      ...shell,
      responseDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(first.ok && retry.ok && changed.ok).toBe(true);
    if (!first.ok || !retry.ok || !changed.ok) return;
    await expect(firstStore.writeInteractionEvent(first.event))
      .resolves.toEqual({ outcome: "stored" });
    await expect(restartedStore.writeInteractionEvent(retry.event))
      .resolves.toEqual({ outcome: "duplicate" });
    await expect(restartedStore.writeInteractionEvent(changed.event))
      .resolves.toEqual({ outcome: "rejected", reason: "duplicate_conflict" });
  });

  it("stores valid events idempotently and rejects conflicting duplicates", async () => {
    const repository = new InMemoryEventStateCompatibilityRepository();
    const store = new DurableEventStateCompatibilityStore(repository);
    const restartedStore = new DurableEventStateCompatibilityStore(repository);
    const normalized = normalizeRuntimeInteractionEvent(rawEvent);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;

    await expect(store.writeInteractionEvent(normalized.event)).resolves.toEqual({ outcome: "stored" });
    await expect(restartedStore.writeInteractionEvent(normalized.event)).resolves.toEqual({ outcome: "duplicate" });
    await expect(restartedStore.writeInteractionEvent({ ...normalized.event, payload: { transcript: "different" } })).resolves.toEqual({
      outcome: "rejected",
      reason: "duplicate_conflict",
    });
  });

  it("validates persisted causation parents and rejects missing or conflicting chains", async () => {
    const repository = new InMemoryEventStateCompatibilityRepository();
    const store = new DurableEventStateCompatibilityStore(repository);
    const parent = normalizeRuntimeInteractionEvent({ ...rawEvent, eventId: "event-parent", transcript: "parent" });
    const child = normalizeRuntimeInteractionEvent({
      ...rawEventBase,
      eventId: "event-child",
      adapter: "text",
      text: "child",
      causationId: "event-parent",
      parentEventIds: ["event-parent"],
    });
    const missingParent = normalizeRuntimeInteractionEvent({
      ...rawEventBase,
      eventId: "event-missing-parent",
      adapter: "text",
      text: "child",
      causationId: "missing-parent",
      parentEventIds: ["missing-parent"],
    });
    expect(parent.ok && child.ok && missingParent.ok).toBe(true);
    if (!parent.ok || !child.ok || !missingParent.ok) return;

    await expect(store.writeInteractionEvent(parent.event)).resolves.toEqual({ outcome: "stored" });
    await expect(store.writeInteractionEvent(child.event)).resolves.toEqual({ outcome: "stored" });
    await expect(store.writeInteractionEvent(missingParent.event)).resolves.toEqual({
      outcome: "rejected",
      reason: "causation_invalid",
    });
  });

  it("handles concurrent duplicate and conflicting event inserts idempotently", async () => {
    const store = new DurableEventStateCompatibilityStore(new InMemoryEventStateCompatibilityRepository());
    const normalized = normalizeRuntimeInteractionEvent(rawEvent);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;

    const duplicateResults = await Promise.all([
      store.writeInteractionEvent(normalized.event),
      store.writeInteractionEvent(normalized.event),
    ]);
    expect(duplicateResults).toEqual(expect.arrayContaining([{ outcome: "stored" }, { outcome: "duplicate" }]));

    await expect(store.writeInteractionEvent({ ...normalized.event, payload: { transcript: "conflict" } })).resolves.toEqual({
      outcome: "rejected",
      reason: "duplicate_conflict",
    });
  });

  it("stores flow projections idempotently and rejects active-flow conflicts", async () => {
    const repository = new InMemoryEventStateCompatibilityRepository();
    const store = new DurableEventStateCompatibilityStore(repository);
    const restartedStore = new DurableEventStateCompatibilityStore(repository);
    const first = projectRuntimeFlowState({
      flowId: "flow.health.preventive_check",
      flowVersion: "1.0.0",
      state: "active",
      sessionId: "session-task7-001",
      userId: "user-task7-001",
      updatedAt: "2026-08-02T10:00:00.000Z",
      context: {},
    });
    const second = projectRuntimeFlowState({
      flowId: "flow.medication.review",
      flowVersion: "1.0.0",
      state: "active",
      sessionId: "session-task7-001",
      userId: "user-task7-001",
      updatedAt: "2026-08-02T10:01:00.000Z",
      context: {},
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    await expect(store.writeFlowProjection(first.flowState, { eventId: "event-1", reason: "test" })).resolves.toEqual({ outcome: "stored" });
    await expect(restartedStore.writeFlowProjection(first.flowState, { eventId: "event-1", reason: "test" })).resolves.toEqual({ outcome: "duplicate" });
    await expect(restartedStore.writeFlowProjection(second.flowState, { eventId: "event-2", reason: "test" })).resolves.toEqual({
      outcome: "rejected",
      reason: "active_flow_conflict",
    });
  });

  it("allows terminal flows to release the active slot for another session flow", async () => {
    const store = new DurableEventStateCompatibilityStore(new InMemoryEventStateCompatibilityRepository());
    const completed = projectRuntimeFlowState({
      flowId: "flow.health.preventive_check",
      flowVersion: "1.0.0",
      state: "completed",
      completionOutcome: { outcome: "completed" },
      sessionId: "session-terminal",
      userId: "user-task7-001",
      updatedAt: "2026-08-02T10:00:00.000Z",
      context: {},
    });
    const active = projectRuntimeFlowState({
      flowId: "flow.medication.review",
      flowVersion: "1.0.0",
      state: "active",
      sessionId: "session-terminal",
      userId: "user-task7-001",
      updatedAt: "2026-08-02T10:01:00.000Z",
      context: {},
    });
    expect(completed.ok && active.ok).toBe(true);
    if (!completed.ok || !active.ok) return;
    await expect(store.writeFlowProjection(completed.flowState, { eventId: "event-terminal", reason: "test" })).resolves.toEqual({ outcome: "stored" });
    await expect(store.writeFlowProjection(active.flowState, { eventId: "event-active", reason: "test" })).resolves.toEqual({ outcome: "stored" });
  });

  it("rejects stale versions and timestamp regressions durably", async () => {
    const store = new DurableEventStateCompatibilityStore(new InMemoryEventStateCompatibilityRepository());
    const newer = projectRuntimeFlowState({
      flowId: "flow.health.preventive_check",
      flowVersion: "2.0.0",
      state: "completed",
      completionOutcome: { outcome: "completed" },
      sessionId: "session-stale",
      userId: "user-task7-001",
      updatedAt: "2026-08-02T10:02:00.000Z",
      context: {},
    });
    const older = projectRuntimeFlowState({
      flowId: "flow.health.preventive_check",
      flowVersion: "1.0.0",
      state: "completed",
      completionOutcome: { outcome: "completed" },
      sessionId: "session-stale",
      userId: "user-task7-001",
      updatedAt: "2026-08-02T10:01:00.000Z",
      context: {},
    });
    expect(newer.ok && older.ok).toBe(true);
    if (!newer.ok || !older.ok) return;
    await expect(store.writeFlowProjection(newer.flowState, { eventId: "event-newer", reason: "test" })).resolves.toEqual({ outcome: "stored" });
    await expect(store.writeFlowProjection(older.flowState, { eventId: "event-older", reason: "test" })).resolves.toEqual({
      outcome: "rejected",
      reason: "transition_invalid",
    });
  });

  it("bounds the local in-memory test double and rejects over-capacity writes", async () => {
    const store = new InMemoryEventStateCompatibilityStore({ maxEvents: 1, maxFlows: 1 });
    const first = normalizeRuntimeInteractionEvent({ ...rawEvent, eventId: "capacity-event-1" });
    const second = normalizeRuntimeInteractionEvent({ ...rawEvent, eventId: "capacity-event-2", correlationId: "corr-capacity-2" });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    await expect(store.writeInteractionEvent(first.event)).resolves.toEqual({ outcome: "stored" });
    await expect(store.writeInteractionEvent(second.event)).resolves.toEqual({ outcome: "rejected", reason: "capacity_exceeded" });
  });

  it("adapter writes event and projection without exposing persistence errors", async () => {
    const store = new InMemoryEventStateCompatibilityStore();
    await expect(emitRuntimeInteractionEvent({
      rawEvent,
      flowProjection: {
        flowId: "flow.health.preventive_check",
        flowVersion: "1.0.0",
        state: "active",
        sessionId: "session-task7-001",
        userId: "user-task7-001",
        updatedAt: "2026-08-02T10:00:00.000Z",
        context: {},
      },
      store,
    })).resolves.toMatchObject({ ok: true, persistenceOutcome: "stored" });

    await expect(emitRuntimeInteractionEvent({ rawEvent, store })).resolves.toMatchObject({ ok: true, persistenceOutcome: "duplicate" });
  });
});
