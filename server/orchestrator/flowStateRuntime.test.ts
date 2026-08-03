import { describe, expect, it } from "vitest";
import {
  projectRuntimeFlowState,
  validLifecycleEdges,
  validateFlowStateTransition,
  validateOneActiveFlowBySession,
} from "./flowStateRuntime.js";

const base = {
  flowId: "flow.health.preventive_check",
  flowVersion: "1.0.0",
  sessionId: "session-task7-001",
  userId: "user-task7-001",
  updatedAt: "2026-08-02T10:00:00.000Z",
  context: {},
};

const expectedInput = {
  questionId: "question-1",
  sceneId: "scene-1",
  flowVersion: "1.0.0",
  answerKind: "option" as const,
  options: [{ id: "yes", label: "Yes", voiceAliases: ["yes"] }],
};

const pendingTool = {
  toolId: "tool.health.lookup",
  requestId: "request-1",
  startedAt: "2026-08-02T10:00:00.000Z",
};

const resumeMetadata = {
  previousState: "paused" as const,
  interruptedAt: "2026-08-02T09:59:00.000Z",
  reason: "user requested resume",
};

describe("Task 7 flow-state compatibility projection", () => {
  it("rejects caller-owned accessors before parsing without invoking them", () => {
    let getterCalls = 0;
    let setterCalls = 0;
    const context = Object.defineProperties({}, {
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

    expect(projectRuntimeFlowState({ ...base, state: "active", context }))
      .toEqual({ ok: false, error: "normalization_invalid" });
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
  });

  it("canonicalizes Flow context and metadata key ordering", () => {
    const left = projectRuntimeFlowState({
      ...base,
      state: "active",
      context: { b: 2, a: { y: 2, x: 1 } },
      metadata: { z: true, a: "first" },
    });
    const right = projectRuntimeFlowState({
      ...base,
      state: "active",
      context: { a: { x: 1, y: 2 }, b: 2 },
      metadata: { a: "first", z: true },
    });
    expect(left.ok && right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    expect(left.digest).toBe(right.digest);
  });

  it("projects inactive and one active states through the frozen parser", () => {
    const idle = projectRuntimeFlowState({
      state: "idle",
      sessionId: base.sessionId,
      userId: base.userId,
      updatedAt: base.updatedAt,
      context: {},
    });
    expect(idle.ok).toBe(true);

    const active = projectRuntimeFlowState({ ...base, state: "active" });
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    expect(validateOneActiveFlowBySession([active.flowState])).toEqual({ ok: true });
  });

  it("rejects two active flows in the same session and allows separate sessions", () => {
    const one = projectRuntimeFlowState({ ...base, state: "active" });
    const two = projectRuntimeFlowState({
      ...base,
      flowId: "flow.medication.review",
      state: "active",
      updatedAt: "2026-08-02T10:01:00.000Z",
      context: {},
    });
    const other = projectRuntimeFlowState({
      ...base,
      flowId: "flow.medication.review",
      sessionId: "session-task7-002",
      state: "active",
    });
    expect(one.ok).toBe(true);
    expect(two.ok).toBe(true);
    expect(other.ok).toBe(true);
    if (!one.ok || !two.ok || !other.ok) return;
    expect(validateOneActiveFlowBySession([one.flowState, two.flowState]))
      .toEqual({ ok: false, error: "active_flow_conflict" });
    expect(validateOneActiveFlowBySession([one.flowState, other.flowState]))
      .toEqual({ ok: true });
  });

  it("excludes terminal states from the active-flow invariant", () => {
    const active = projectRuntimeFlowState({ ...base, state: "active" });
    const completed = projectRuntimeFlowState({
      ...base,
      flowId: "flow.medication.review",
      state: "completed",
      completionOutcome: { outcome: "completed" },
    });
    expect(active.ok).toBe(true);
    expect(completed.ok).toBe(true);
    if (!active.ok || !completed.ok) return;
    expect(validateOneActiveFlowBySession([active.flowState, completed.flowState])).toEqual({ ok: true });
  });

  it("validates lifecycle transitions and rejects backward or terminal mutation", () => {
    const initializing = projectRuntimeFlowState({ ...base, state: "initializing" });
    const active = projectRuntimeFlowState({ ...base, state: "active", updatedAt: "2026-08-02T10:01:00.000Z" });
    const completed = projectRuntimeFlowState({
      ...base,
      state: "completed",
      updatedAt: "2026-08-02T10:02:00.000Z",
      completionOutcome: { outcome: "completed" },
    });
    expect(initializing.ok && active.ok && completed.ok).toBe(true);
    if (!initializing.ok || !active.ok || !completed.ok) return;

    expect(validateFlowStateTransition({ previous: initializing.flowState, next: active.flowState, eventId: "event-1", reason: "test" })).toEqual({ ok: true });
    expect(validateFlowStateTransition({ previous: active.flowState, next: initializing.flowState, eventId: "event-2", reason: "test" })).toEqual({ ok: false, error: "transition_invalid" });
    expect(validateFlowStateTransition({ previous: completed.flowState, next: active.flowState, eventId: "event-3", reason: "test" })).toEqual({ ok: false, error: "transition_invalid" });
  });

  it("accepts observed active scene, expected input, pending tool, interruption, resume and completion facts", () => {
    expect(projectRuntimeFlowState({
      ...base,
      state: "active",
      activeScene: { sceneId: "scene-1", observedAt: "2026-08-02T10:00:00.000Z" },
      domainState: { stage: "synthetic_fixture" },
      metadata: { adapter: "task7_test" },
      correlationId: "corr-flow-1",
    }).ok).toBe(true);

    expect(projectRuntimeFlowState({ ...base, state: "waiting_for_user", expectedInput }).ok).toBe(true);
    expect(projectRuntimeFlowState({ ...base, state: "waiting_for_tool", pendingTool }).ok).toBe(true);
    expect(projectRuntimeFlowState({ ...base, state: "interrupted", interruptedState: "waiting_for_user" }).ok).toBe(true);
    expect(projectRuntimeFlowState({ ...base, state: "resuming", resumeMetadata }).ok).toBe(true);
    expect(projectRuntimeFlowState({ ...base, state: "completed", completionOutcome: { outcome: "completed", reason: "done" } }).ok).toBe(true);
  });

  it("rejects lifecycle-required field omissions and contradictions", () => {
    expect(projectRuntimeFlowState({ ...base, state: "waiting_for_user" })).toEqual({ ok: false, error: "frozen_contract_rejected" });
    expect(projectRuntimeFlowState({ ...base, state: "waiting_for_tool" })).toEqual({ ok: false, error: "frozen_contract_rejected" });
    expect(projectRuntimeFlowState({ ...base, state: "waiting_for_user", pendingTool })).toEqual({ ok: false, error: "frozen_contract_rejected" });
    expect(projectRuntimeFlowState({ ...base, state: "interrupted", interruptedState: "interrupted" })).toEqual({ ok: false, error: "normalization_invalid" });
    expect(projectRuntimeFlowState({ ...base, state: "resuming" })).toEqual({ ok: false, error: "normalization_invalid" });
    expect(projectRuntimeFlowState({
      ...base,
      state: "active",
      completionOutcome: { outcome: "completed" },
    })).toEqual({ ok: false, error: "normalization_invalid" });
  });

  it("rejects scene regression while preserving failed-to-resuming when frozen-supported", () => {
    const scene2 = projectRuntimeFlowState({
      ...base,
      state: "active",
      activeScene: { sceneId: "scene-2" },
    });
    const scene1 = projectRuntimeFlowState({
      ...base,
      state: "waiting_for_user",
      expectedInput: { ...expectedInput, sceneId: "scene-1" },
      activeScene: { sceneId: "scene-1" },
      updatedAt: "2026-08-02T10:01:00.000Z",
    });
    expect(scene2.ok).toBe(true);
    expect(scene1.ok).toBe(true);
    if (!scene2.ok || !scene1.ok) return;
    expect(validateFlowStateTransition({ previous: scene2.flowState, next: scene1.flowState, eventId: "event-scene", reason: "test" }))
      .toEqual({ ok: false, error: "transition_invalid" });

    const failed = projectRuntimeFlowState({ ...base, state: "failed", completionOutcome: { outcome: "failed" } });
    const resuming = projectRuntimeFlowState({ ...base, state: "resuming", resumeMetadata, updatedAt: "2026-08-02T10:01:00.000Z" });
    expect(failed.ok).toBe(true);
    expect(resuming.ok).toBe(true);
    if (!failed.ok || !resuming.ok) return;
    expect(validateFlowStateTransition({ previous: failed.flowState, next: resuming.flowState, eventId: "event-resume", reason: "test" }))
      .toEqual({ ok: true });
  });

  it("keeps the lifecycle graph closed under the frozen transition table", () => {
    const stateInput = (state: string) => ({
      ...base,
      state,
      ...(state === "waiting_for_user" ? { expectedInput } : {}),
      ...(state === "waiting_for_tool" ? { pendingTool } : {}),
      ...(state === "interrupted" ? { interruptedState: "active" as const } : {}),
      ...(state === "resuming" ? { resumeMetadata } : {}),
      ...(state === "completed" ? { completionOutcome: { outcome: "completed" as const } } : {}),
      ...(state === "failed" ? { completionOutcome: { outcome: "failed" as const } } : {}),
      ...(state === "cancelled" ? { completionOutcome: { outcome: "cancelled" as const } } : {}),
      ...(state === "expired" ? { completionOutcome: { outcome: "expired" as const } } : {}),
      ...(state === "escalated" ? { completionOutcome: { outcome: "escalated" as const } } : {}),
    });
    expect(validLifecycleEdges().length).toBeGreaterThan(0);
    for (const [from, to] of validLifecycleEdges()) {
      const previous = projectRuntimeFlowState(stateInput(from));
      const next = projectRuntimeFlowState({ ...stateInput(to), updatedAt: "2026-08-02T10:01:00.000Z" });
      if (!previous.ok || !next.ok) continue;
      expect(validateFlowStateTransition({ previous: previous.flowState, next: next.flowState, eventId: `event-${from}-${to}`, reason: "property_loop" })).toEqual({ ok: true });
    }
  });
});
