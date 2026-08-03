import { createHash } from "node:crypto";
import { z } from "zod";
import {
  canonicalContractProjection,
  canonicalSha256,
  descriptorSafeDeepInertClone,
  FLOW_STATE_DIGEST_DOMAIN,
} from "./eventStateCanonicalJson.js";
import {
  FLOW_TRANSITIONS,
  expectedFlowInputSchema,
  pendingToolSchema,
  parseFlowState,
  parseFlowTransition,
  resumeMetadataSchema,
  type FlowLifecycleState,
  type FlowState,
} from "../../shared/orchestration/flowState.js";

const TERMINAL_STATES: readonly FlowLifecycleState[] = ["completed", "escalated", "cancelled", "expired", "failed"];
const ACTIVE_STATES: readonly FlowLifecycleState[] = ["initializing", "active", "waiting_for_user", "waiting_for_tool", "interrupted", "paused", "resuming"];
const opaqueId = z.string().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const boundedMetadataSchema = z.record(z.unknown()).default({});
const completionOutcomeSchema = z.object({
  outcome: z.enum(["completed", "cancelled", "expired", "escalated", "failed"]),
  reason: z.string().min(1).max(256).optional(),
  eventId: opaqueId.optional(),
}).strict();

export const flowStateProjectionInputSchema = z.object({
  flowId: opaqueId.optional(),
  flowVersion: opaqueId.optional(),
  state: z.enum(["idle", "initializing", "active", "waiting_for_user", "waiting_for_tool", "interrupted", "paused", "resuming", "completed", "escalated", "cancelled", "expired", "failed"]),
  sessionId: opaqueId,
  userId: opaqueId,
  activeScene: z.object({
    sceneId: opaqueId,
    sceneVersion: z.string().min(1).max(64).optional(),
    observedAt: z.string().datetime({ offset: true }).optional(),
  }).strict().optional(),
  expectedInput: expectedFlowInputSchema.optional(),
  pendingTool: pendingToolSchema.optional(),
  interruptedState: z.enum(["idle", "initializing", "active", "waiting_for_user", "waiting_for_tool", "interrupted", "paused", "resuming", "completed", "escalated", "cancelled", "expired", "failed"]).optional(),
  resumeMetadata: resumeMetadataSchema.optional(),
  domainState: z.record(z.unknown()).optional(),
  completionOutcome: completionOutcomeSchema.optional(),
  correlationId: opaqueId.optional(),
  causationEventId: opaqueId.optional(),
  metadata: boundedMetadataSchema.optional(),
  updatedAt: z.string().datetime({ offset: true }),
  context: z.record(z.unknown()).default({}),
}).strict().superRefine((flow, context) => {
  if (flow.state === "resuming" && !flow.resumeMetadata) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "resumeMetadata is required while resuming", path: ["resumeMetadata"] });
  }
  if (flow.state === "completed" && !flow.completionOutcome) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "completionOutcome is required when completed", path: ["completionOutcome"] });
  }
  if (flow.completionOutcome && !TERMINAL_STATES.includes(flow.state)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "completionOutcome is terminal-only", path: ["completionOutcome"] });
  }
  if (flow.completionOutcome && flow.completionOutcome.outcome !== flow.state) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "completionOutcome must match lifecycle state", path: ["completionOutcome", "outcome"] });
  }
  if (flow.interruptedState && flow.interruptedState === "interrupted") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "interruptedState cannot be interrupted", path: ["interruptedState"] });
  }
  if (flow.resumeMetadata && !["paused", "interrupted"].includes(flow.resumeMetadata.previousState)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "resume previousState must be paused or interrupted", path: ["resumeMetadata", "previousState"] });
  }
});

export type FlowStateProjectionInput = z.infer<typeof flowStateProjectionInputSchema>;
export type FlowProjectionResult =
  | { ok: true; flowState: FlowState; digest: string }
  | { ok: false; error: "normalization_invalid" | "frozen_contract_rejected" };

function digest(value: unknown): string {
  return canonicalSha256(
    FLOW_STATE_DIGEST_DOMAIN,
    canonicalContractProjection(value),
  );
}

export function projectRuntimeFlowState(rawInput: unknown): FlowProjectionResult {
  let inertInput: unknown;
  try {
    inertInput = descriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, error: "normalization_invalid" };
  }
  const parsed = flowStateProjectionInputSchema.safeParse(inertInput);
  if (!parsed.success) return { ok: false, error: "normalization_invalid" };
  const input = parsed.data;
  const correlation = {
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    ...(input.causationEventId !== undefined ? { causationEventId: input.causationEventId } : {}),
  };
  const context = {
    ...input.context,
    ...(input.activeScene !== undefined ? { activeScene: input.activeScene } : {}),
    ...(input.domainState !== undefined ? { domainState: input.domainState } : {}),
    ...(input.completionOutcome !== undefined ? { completionOutcome: input.completionOutcome } : {}),
    ...(Object.keys(correlation).length > 0 ? { correlation } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
  try {
    const flowState = parseFlowState({
      state: input.state,
      sessionId: input.sessionId,
      userId: input.userId,
      context,
      updatedAt: input.updatedAt,
      ...(input.flowId !== undefined ? { flowId: input.flowId } : {}),
      ...(input.flowVersion !== undefined ? { flowVersion: input.flowVersion } : {}),
      ...(input.expectedInput !== undefined ? { expectedInput: input.expectedInput } : {}),
      ...(input.interruptedState !== undefined ? { interruptedState: input.interruptedState } : {}),
      ...(input.resumeMetadata !== undefined ? { resumeMetadata: input.resumeMetadata } : {}),
      ...(input.pendingTool !== undefined ? { pendingTool: input.pendingTool } : {}),
    });
    return { ok: true, flowState, digest: digest(flowState) };
  } catch {
    return { ok: false, error: "frozen_contract_rejected" };
  }
}

export function isTerminalFlowState(state: FlowLifecycleState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function countsAsActiveFlow(state: FlowLifecycleState): boolean {
  return ACTIVE_STATES.includes(state);
}

export function validateOneActiveFlowBySession(flowStates: readonly FlowState[]):
  { ok: true } | { ok: false; error: "active_flow_conflict" } {
  const activeBySession = new Map<string, string>();
  for (const flow of flowStates) {
    if (!countsAsActiveFlow(flow.state)) continue;
    const flowKey = `${flow.flowId}:${flow.flowVersion}`;
    const existing = activeBySession.get(flow.sessionId);
    if (existing && existing !== flowKey) return { ok: false, error: "active_flow_conflict" };
    activeBySession.set(flow.sessionId, flowKey);
  }
  return { ok: true };
}

export function validateFlowStateTransition(input: {
  previous?: FlowState;
  next: FlowState;
  eventId: string;
  reason: string;
}): { ok: true } | { ok: false; error: "transition_invalid" } {
  if (!input.previous) return { ok: true };
  const previous = input.previous;
  const next = input.next;
  if (previous.sessionId !== next.sessionId || previous.userId !== next.userId) return { ok: false, error: "transition_invalid" };
  if ((FLOW_TRANSITIONS[previous.state] as readonly FlowLifecycleState[]).length === 0) return { ok: false, error: "transition_invalid" };
  if (Date.parse(next.updatedAt) < Date.parse(previous.updatedAt)) return { ok: false, error: "transition_invalid" };
  if (previous.flowVersion && next.flowVersion && next.flowVersion < previous.flowVersion) return { ok: false, error: "transition_invalid" };
  const previousScene = (previous.context as { activeScene?: { sceneId?: string } }).activeScene?.sceneId;
  const nextScene = (next.context as { activeScene?: { sceneId?: string } }).activeScene?.sceneId;
  if (previousScene && nextScene && nextScene < previousScene) return { ok: false, error: "transition_invalid" };
  if (next.state === "interrupted" && next.interruptedState === "interrupted") return { ok: false, error: "transition_invalid" };
  if (next.state === "resuming" && !next.resumeMetadata) return { ok: false, error: "transition_invalid" };
  if (next.state !== "waiting_for_tool" && next.pendingTool) return { ok: false, error: "transition_invalid" };
  if (previous.state === next.state) return { ok: true };
  try {
    parseFlowTransition({
      flowId: next.flowId ?? previous.flowId,
      flowVersion: next.flowVersion ?? previous.flowVersion,
      from: previous.state,
      to: next.state,
      occurredAt: next.updatedAt,
      eventId: input.eventId,
      reason: input.reason,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "transition_invalid" };
  }
}

export function validLifecycleEdges(): ReadonlyArray<readonly [FlowLifecycleState, FlowLifecycleState]> {
  return Object.entries(FLOW_TRANSITIONS).flatMap(([from, targets]) =>
    targets.map((to) => [from as FlowLifecycleState, to] as const));
}

export function flowStateSemanticDigest(flowState: FlowState): string {
  return digest(flowState);
}
