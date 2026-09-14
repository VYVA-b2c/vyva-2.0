import { describe, expect, it } from "vitest";
import {
  interactionEventSemanticDigest,
  normalizeRuntimeInteractionEvent,
  normalizeShellDeliveryEvent,
  validateLocalEventBatch,
} from "./interactionEventRuntime.js";

const base = {
  occurredAt: "2026-08-02T10:00:00.000Z",
  receivedAt: "2026-08-02T10:00:00.100Z",
  correlationId: "corr-task7-001",
  userId: "user-task7-001",
  sessionId: "session-task7-001",
  locale: "en-US",
  parentEventIds: [],
};

describe("Task 7 interaction event normalization", () => {
  it("rejects runtime accessor input before Zod reads any property", () => {
    let getterCalls = 0;
    let setterCalls = 0;
    const accessorInput = Object.defineProperties({}, {
      adapter: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return "voice";
        },
      },
      transcript: {
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

    expect(normalizeRuntimeInteractionEvent(accessorInput))
      .toEqual({ ok: false, error: "normalization_invalid" });
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
  });

  it("rejects shell delivery accessor input before Zod reads any property", () => {
    let getterCalls = 0;
    let setterCalls = 0;
    const accessorInput = Object.defineProperties({}, {
      idempotencyKey: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return "authoritative-interaction-1";
        },
      },
      statusCode: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return 200;
        },
      },
      sink: {
        enumerable: true,
        set(_value: unknown) {
          setterCalls += 1;
        },
      },
    });

    expect(normalizeShellDeliveryEvent(accessorInput))
      .toEqual({ ok: false, error: "normalization_invalid" });
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
  });

  it("rejects explicit undefined values before normalization", () => {
    expect(normalizeRuntimeInteractionEvent({
      ...base,
      adapter: "voice",
      transcript: "hello",
      questionId: undefined,
    })).toEqual({ ok: false, error: "normalization_invalid" });

    expect(normalizeShellDeliveryEvent({
      idempotencyKey: "authoritative-interaction-1",
      occurredAt: base.occurredAt,
      receivedAt: base.receivedAt,
      correlationId: base.correlationId,
      userId: base.userId,
      sessionId: base.sessionId,
      statusCode: 200,
      responseDigest: undefined,
      routeId: "route.api.router.post",
    })).toEqual({ ok: false, error: "normalization_invalid" });
  });

  it("normalizes supported voice input to the frozen event contract", () => {
    const result = normalizeRuntimeInteractionEvent({ ...base, adapter: "voice", transcript: "I would like option A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event).toMatchObject({
      eventType: "USER_SPOKE",
      source: "voice",
      modality: "voice",
      channel: "voice",
      correlationId: base.correlationId,
      payload: { transcript: "I would like option A" },
    });
    expect(JSON.stringify(result.event)).not.toContain("rawAudio");
  });

  it("normalizes touch and preserves a stable action id without DOM objects", () => {
    expect(normalizeRuntimeInteractionEvent({
      ...base,
      adapter: "tap",
      actionId: "answer-yes",
      questionId: "question-1",
      sceneId: "scene-1",
      flowVersion: "1.0.0",
      flowVersion: "1.0.0",
      browserEvent: { target: "button" },
    }).ok).toBe(false);

    const valid = normalizeRuntimeInteractionEvent({
      ...base,
      adapter: "tap",
      actionId: "answer-yes",
      questionId: "question-1",
      sceneId: "scene-1",
      flowVersion: "1.0.0",
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.event.channel).toBe("touch");
    expect(valid.event.payload).toEqual({
      answerId: "answer-yes",
      questionId: "question-1",
      sceneId: "scene-1",
      flowVersion: "1.0.0",
    });
  });

  it("normalizes bounded text and rejects oversized text", () => {
    const valid = normalizeRuntimeInteractionEvent({ ...base, adapter: "text", text: "hello" });
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.event.channel).toBe("text");
    expect(normalizeRuntimeInteractionEvent({ ...base, adapter: "text", text: "x".repeat(2_001) }))
      .toEqual({ ok: false, error: "normalization_invalid" });
  });

  it("validates child causation and correlation in a local batch", () => {
    const root = normalizeRuntimeInteractionEvent({ ...base, eventId: "event-root", adapter: "voice", transcript: "start" });
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const child = normalizeRuntimeInteractionEvent({
      ...base,
      eventId: "event-child",
      adapter: "text",
      text: "next",
      causationId: "event-root",
      parentEventIds: ["event-root"],
    });
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect(validateLocalEventBatch([root.event, child.event])).toEqual({ ok: true });
  });

  it("rejects explicit local causation cycles and timestamp skew", () => {
    const root = normalizeRuntimeInteractionEvent({ ...base, eventId: "cycle-a", adapter: "text", text: "a", causationId: "cycle-b", parentEventIds: ["cycle-b"] });
    const child = normalizeRuntimeInteractionEvent({ ...base, eventId: "cycle-b", adapter: "text", text: "b", causationId: "cycle-a", parentEventIds: ["cycle-a"] });
    expect(root.ok).toBe(true);
    expect(child.ok).toBe(true);
    if (!root.ok || !child.ok) return;
    expect(validateLocalEventBatch([root.event, child.event])).toEqual({ ok: false, error: "causation_invalid" });

    const parent = normalizeRuntimeInteractionEvent({ ...base, eventId: "future-parent", adapter: "voice", transcript: "parent", occurredAt: "2026-08-02T10:03:00.000Z", receivedAt: "2026-08-02T10:03:00.000Z" });
    const skewedChild = normalizeRuntimeInteractionEvent({
      ...base,
      eventId: "skewed-child",
      adapter: "text",
      text: "child",
      causationId: "future-parent",
      parentEventIds: ["future-parent"],
    });
    expect(parent.ok).toBe(true);
    expect(skewedChild.ok).toBe(true);
    if (!parent.ok || !skewedChild.ok) return;
    expect(validateLocalEventBatch([parent.event, skewedChild.event])).toEqual({ ok: false, error: "causation_invalid" });
  });

  it.each([
    ["unsupported channel", { adapter: "document", text: "x" }, "normalization_invalid"],
    ["bad locale", { adapter: "text", text: "x", locale: "english" }, "normalization_invalid"],
    ["unknown parent", { adapter: "text", text: "x", causationId: "missing" }, "causation_invalid"],
    ["timestamp regression", { adapter: "text", text: "x", receivedAt: "2026-08-02T09:55:00.000Z" }, "correlation_invalid"],
  ])("fails closed for %s", (_label, overrides, error) => {
    expect(normalizeRuntimeInteractionEvent({ ...base, ...overrides })).toEqual({ ok: false, error });
  });

  it("normalizes shell delivery only as a minimized system event", () => {
    const result = normalizeShellDeliveryEvent({
      idempotencyKey: "authoritative-interaction-1",
      occurredAt: base.occurredAt,
      receivedAt: base.receivedAt,
      correlationId: base.correlationId,
      userId: base.userId,
      sessionId: base.sessionId,
      statusCode: 200,
      routeId: "route.api.router.post",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event).toMatchObject({
      eventType: "FLOW_WAITING_FOR_USER",
      source: "system",
      modality: "system",
      triggerSource: "system",
      payload: {},
    });
    expect(JSON.stringify(result.event)).not.toContain("response");
  });

  it("derives retry-stable shell event identity independently of attempt facts", () => {
    const make = (overrides: Record<string, unknown> = {}) =>
      normalizeShellDeliveryEvent({
        idempotencyKey: "authoritative-interaction-1",
        occurredAt: base.occurredAt,
        receivedAt: base.receivedAt,
        correlationId: base.correlationId,
        userId: base.userId,
        sessionId: base.sessionId,
        statusCode: 200,
        routeId: "route.api.router.post",
        ...overrides,
      });
    const first = make();
    const retry = make({
      correlationId: "different-shell-correlation",
      occurredAt: "2026-08-02T10:01:00.000Z",
      receivedAt: "2026-08-02T10:01:00.100Z",
    });
    const different = make({ idempotencyKey: "authoritative-interaction-2" });
    expect(first.ok && retry.ok && different.ok).toBe(true);
    if (!first.ok || !retry.ok || !different.ok) return;
    expect(first.event.eventId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(retry.event.eventId).toBe(first.event.eventId);
    expect(interactionEventSemanticDigest(retry.event))
      .toBe(interactionEventSemanticDigest(first.event));
    expect(different.event.eventId).not.toBe(first.event.eventId);
    expect(first.event.eventId).not.toBe(first.event.correlationId);
  });

  it("fails closed without a valid stable shell idempotency reference", () => {
    const shell = {
      occurredAt: base.occurredAt,
      receivedAt: base.receivedAt,
      correlationId: base.correlationId,
      userId: base.userId,
      sessionId: base.sessionId,
      statusCode: 200,
      routeId: "route.api.router.post",
    };
    expect(normalizeShellDeliveryEvent(shell)).toEqual({
      ok: false,
      error: "normalization_invalid",
    });
    expect(normalizeShellDeliveryEvent({ ...shell, idempotencyKey: "x".repeat(161) }))
      .toEqual({ ok: false, error: "normalization_invalid" });
  });

  it("canonicalizes event payload and metadata key ordering", () => {
    const first = normalizeRuntimeInteractionEvent({
      ...base,
      adapter: "tap",
      actionId: "answer-yes",
      questionId: "question-1",
      sceneId: "scene-1",
      flowVersion: "1.0.0",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const reordered = {
      ...first.event,
      metadata: Object.fromEntries(Object.entries(first.event.metadata).reverse()),
      payload: Object.fromEntries(Object.entries(first.event.payload).reverse()),
    };
    expect(interactionEventSemanticDigest(reordered))
      .toBe(interactionEventSemanticDigest(first.event));
  });
});
