import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  canonicalContractProjection,
  canonicalSha256,
  descriptorSafeDeepInertClone,
  deterministicShellEventUuid,
  INTERACTION_EVENT_DIGEST_DOMAIN,
} from "./eventStateCanonicalJson.js";
import {
  parseInteractionEvent,
  type InteractionEvent,
  type InteractionEventType,
} from "../../shared/orchestration/events.js";

export const EVENT_STATE_RUNTIME_SCHEMA_VERSION = "1.0.0" as const;
export const MAX_RUNTIME_TEXT_LENGTH = 2_000;
export const MAX_CLOCK_SKEW_MS = 60_000;

const opaqueId = z.string().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const isoDateTime = z.string().datetime({ offset: true });
const localeSchema = z.string().min(2).max(32).regex(/^[a-z]{2,3}(-[A-Z0-9]{2,8})*$/);

const runtimeBase = {
  eventId: opaqueId.optional(),
  idempotencyKey: opaqueId.optional(),
  occurredAt: isoDateTime,
  receivedAt: isoDateTime,
  correlationId: opaqueId,
  causationId: opaqueId.optional(),
  userId: opaqueId,
  profileId: opaqueId.optional(),
  sessionId: opaqueId,
  locale: localeSchema.default("en-US"),
  flowId: opaqueId.optional(),
  flowVersion: opaqueId.optional(),
  parentEventIds: z.array(opaqueId).default([]),
};

export const voiceRuntimeInputSchema = z.object({
  ...runtimeBase,
  adapter: z.literal("voice"),
  transcript: z.string().min(1).max(MAX_RUNTIME_TEXT_LENGTH),
  questionId: opaqueId.optional(),
  sceneId: opaqueId.optional(),
}).strict();

export const tapRuntimeInputSchema = z.object({
  ...runtimeBase,
  adapter: z.literal("tap"),
  actionId: opaqueId,
  questionId: opaqueId,
  sceneId: opaqueId,
}).strict();

export const textRuntimeInputSchema = z.object({
  ...runtimeBase,
  adapter: z.literal("text"),
  text: z.string().min(1).max(MAX_RUNTIME_TEXT_LENGTH),
  questionId: opaqueId.optional(),
  sceneId: opaqueId.optional(),
}).strict();

export const shellRuntimeInputSchema = z.object({
  idempotencyKey: opaqueId,
  occurredAt: isoDateTime,
  receivedAt: isoDateTime,
  correlationId: opaqueId,
  userId: opaqueId,
  sessionId: opaqueId,
  locale: localeSchema.default("en-US"),
  inputChannel: z.enum(["voice", "touch", "text", "system"]).default("system"),
  inputKind: z.enum(["utterance", "touch_action", "typed_text", "system_delivery", "unknown"]).default("system_delivery"),
  contentDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  contentLengthBucket: z.enum(["empty", "lt_20", "lt_100", "lt_500", "gte_500"]).optional(),
  statusCode: z.number().int().min(100).max(599),
  responseDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  routeId: z.literal("route.api.router.post"),
}).strict();

export const supportedRuntimeInputSchema = z.discriminatedUnion("adapter", [
  voiceRuntimeInputSchema,
  tapRuntimeInputSchema,
  textRuntimeInputSchema,
]);

export type VoiceRuntimeInput = z.infer<typeof voiceRuntimeInputSchema>;
export type TapRuntimeInput = z.infer<typeof tapRuntimeInputSchema>;
export type TextRuntimeInput = z.infer<typeof textRuntimeInputSchema>;
export type SupportedRuntimeInput = z.infer<typeof supportedRuntimeInputSchema>;
export type ShellRuntimeInput = z.infer<typeof shellRuntimeInputSchema>;

export type InteractionEventRuntimeResult =
  | { ok: true; event: InteractionEvent; digest: string }
  | { ok: false; error: "normalization_invalid" | "frozen_contract_rejected" | "correlation_invalid" | "causation_invalid" };

export function eventStateCanonicalDigest(value: unknown): string {
  return canonicalSha256(
    INTERACTION_EVENT_DIGEST_DOMAIN,
    canonicalContractProjection(value),
  );
}

function deterministicOpaqueId(prefix: string, value: unknown): string {
  return `${prefix}.${eventStateCanonicalDigest(value).slice("sha256:".length, "sha256:".length + 32)}`;
}

function runtimeEventId(input: { eventId?: string; idempotencyKey?: string }, fallbackFacts: unknown): string {
  if (input.eventId) return input.eventId;
  if (input.idempotencyKey) {
    return deterministicOpaqueId("event", {
      schemaVersion: EVENT_STATE_RUNTIME_SCHEMA_VERSION,
      idempotencyKey: input.idempotencyKey,
    });
  }
  return deterministicOpaqueId("event", fallbackFacts);
}

function validateTimestamps(occurredAt: string, receivedAt: string): boolean {
  const occurred = Date.parse(occurredAt);
  const received = Date.parse(receivedAt);
  return Number.isFinite(occurred) && Number.isFinite(received) && occurred <= received + MAX_CLOCK_SKEW_MS;
}

function baseEvent(input: SupportedRuntimeInput, eventType: InteractionEventType) {
  return {
    eventId: runtimeEventId(input, {
      adapter: input.adapter,
      correlationId: input.correlationId,
      sessionId: input.sessionId,
      occurredAt: input.occurredAt,
      ...(input.causationId !== undefined ? { causationId: input.causationId } : {}),
      ...(input.flowId !== undefined ? { flowId: input.flowId } : {}),
      ...(input.flowVersion !== undefined ? { flowVersion: input.flowVersion } : {}),
    }),
    eventType,
    occurredAt: input.occurredAt,
    source: input.adapter === "voice" ? "voice" : "ui",
    userId: input.userId,
    sessionId: input.sessionId,
    channel: input.adapter === "voice" ? "voice" : input.adapter === "tap" ? "touch" : "text",
    modality: input.adapter === "tap" ? "touch" : input.adapter,
    triggerSource: "user",
    correlationId: input.correlationId,
    safetyContext: { checked: false, flags: [] },
    metadata: {
      schemaVersion: EVENT_STATE_RUNTIME_SCHEMA_VERSION,
      receivedAt: input.receivedAt,
      locale: input.locale,
      runtimeAdapter: input.adapter,
      nonExecutable: true,
    },
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    ...(input.flowId !== undefined ? { flowId: input.flowId } : {}),
    ...(input.flowVersion !== undefined ? { flowVersion: input.flowVersion } : {}),
    ...(input.causationId !== undefined ? { causationId: input.causationId } : {}),
  } as const;
}

export function normalizeRuntimeInteractionEvent(rawInput: unknown): InteractionEventRuntimeResult {
  let inertInput: unknown;
  try {
    inertInput = descriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, error: "normalization_invalid" };
  }
  const parsed = supportedRuntimeInputSchema.safeParse(inertInput);
  if (!parsed.success) return { ok: false, error: "normalization_invalid" };
  const input = parsed.data;
  if (!validateTimestamps(input.occurredAt, input.receivedAt)) return { ok: false, error: "correlation_invalid" };
  if (input.causationId && input.causationId === input.eventId) return { ok: false, error: "causation_invalid" };
  if (input.causationId && !input.parentEventIds.includes(input.causationId)) return { ok: false, error: "causation_invalid" };

  const event = input.adapter === "voice"
    ? {
        ...baseEvent(input, "USER_SPOKE"),
        payload: {
          transcript: input.transcript,
          ...(input.questionId !== undefined ? { questionId: input.questionId } : {}),
          ...(input.sceneId !== undefined ? { sceneId: input.sceneId } : {}),
          ...(input.flowVersion !== undefined ? { flowVersion: input.flowVersion } : {}),
        },
      }
    : input.adapter === "tap"
    ? {
        ...baseEvent(input, "USER_TAPPED_OPTION"),
        payload: {
          questionId: input.questionId,
          sceneId: input.sceneId,
          answerId: input.actionId,
          ...(input.flowVersion !== undefined ? { flowVersion: input.flowVersion } : {}),
        },
      }
    : {
        ...baseEvent(input, "USER_ENTERED_TEXT"),
        payload: {
          text: input.text,
          ...(input.questionId !== undefined ? { questionId: input.questionId } : {}),
          ...(input.sceneId !== undefined ? { sceneId: input.sceneId } : {}),
          ...(input.flowVersion !== undefined ? { flowVersion: input.flowVersion } : {}),
        },
      };

  try {
    const validated = parseInteractionEvent(event);
    return { ok: true, event: validated, digest: eventStateCanonicalDigest(validated) };
  } catch {
    return { ok: false, error: "frozen_contract_rejected" };
  }
}

export function normalizeShellDeliveryEvent(rawInput: unknown): InteractionEventRuntimeResult {
  let inertInput: unknown;
  try {
    inertInput = descriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, error: "normalization_invalid" };
  }
  const parsed = shellRuntimeInputSchema.safeParse(inertInput);
  if (!parsed.success) return { ok: false, error: "normalization_invalid" };
  const input = parsed.data;
  if (!validateTimestamps(input.occurredAt, input.receivedAt)) return { ok: false, error: "correlation_invalid" };
  const event = {
    eventId: deterministicShellEventUuid(
      input.idempotencyKey,
      "FLOW_WAITING_FOR_USER",
    ),
    eventType: "FLOW_WAITING_FOR_USER",
    occurredAt: input.occurredAt,
    source: "system",
    userId: input.userId,
    sessionId: input.sessionId,
    channel: input.inputChannel === "system" ? "pwa" : input.inputChannel,
    modality: "system",
    triggerSource: "system",
    correlationId: input.correlationId,
    payload: {},
    safetyContext: { checked: false, flags: [] },
    metadata: {
      schemaVersion: EVENT_STATE_RUNTIME_SCHEMA_VERSION,
      receivedAt: input.receivedAt,
      routeId: input.routeId,
      statusClass: `${Math.floor(input.statusCode / 100)}xx`,
      locale: input.locale,
      inputKind: input.inputKind,
      nonExecutable: true,
      ...(input.contentDigest !== undefined ? { contentDigest: input.contentDigest } : {}),
      ...(input.contentLengthBucket !== undefined ? { contentLengthBucket: input.contentLengthBucket } : {}),
      ...(input.responseDigest !== undefined ? { responseDigest: input.responseDigest } : {}),
    },
  };

  try {
    const validated = parseInteractionEvent(event);
    return { ok: true, event: validated, digest: eventStateCanonicalDigest(validated) };
  } catch {
    return { ok: false, error: "frozen_contract_rejected" };
  }
}

export function validateLocalEventBatch(events: readonly InteractionEvent[]):
  { ok: true } | { ok: false; error: "correlation_invalid" | "causation_invalid" | "duplicate_conflict" } {
  const byId = new Map<string, InteractionEvent>();
  for (const event of events) {
    const existing = byId.get(event.eventId);
    if (existing && eventStateCanonicalDigest(existing) !== eventStateCanonicalDigest(event)) return { ok: false, error: "duplicate_conflict" };
    byId.set(event.eventId, event);
    if (event.eventId === event.correlationId) return { ok: false, error: "correlation_invalid" };
    if (event.sessionId && event.sessionId === event.correlationId) return { ok: false, error: "correlation_invalid" };
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (eventId: string): boolean => {
    if (visited.has(eventId)) return true;
    if (visiting.has(eventId)) return false;
    visiting.add(eventId);
    const event = byId.get(eventId);
    if (event?.causationId && byId.has(event.causationId) && !visit(event.causationId)) return false;
    visiting.delete(eventId);
    visited.add(eventId);
    return true;
  };

  for (const event of events) {
    if (!visit(event.eventId)) return { ok: false, error: "causation_invalid" };
  }

  for (const event of events) {
    if (event.causationId === event.eventId) return { ok: false, error: "causation_invalid" };
    if (event.causationId) {
      const parent = byId.get(event.causationId);
      if (!parent) return { ok: false, error: "causation_invalid" };
      if (parent.correlationId !== event.correlationId) return { ok: false, error: "correlation_invalid" };
      if (parent.sessionId && event.sessionId && parent.sessionId !== event.sessionId) return { ok: false, error: "causation_invalid" };
      const parentOccurred = Date.parse(parent.occurredAt);
      const childOccurred = Date.parse(event.occurredAt);
      if (Number.isFinite(parentOccurred) && Number.isFinite(childOccurred) && parentOccurred > childOccurred + MAX_CLOCK_SKEW_MS) {
        return { ok: false, error: "causation_invalid" };
      }
    }
  }
  return { ok: true };
}

export function interactionEventSemanticDigest(event: InteractionEvent): string {
  if (
    event.eventType === "FLOW_WAITING_FOR_USER" &&
    event.source === "system" &&
    (event.metadata as Record<string, unknown>).routeId === "route.api.router.post"
  ) {
    const {
      occurredAt: _occurredAt,
      correlationId: _correlationId,
      metadata,
      ...stable
    } = event;
    const { receivedAt: _receivedAt, ...stableMetadata } =
      metadata as Record<string, unknown>;
    return eventStateCanonicalDigest({ ...stable, metadata: stableMetadata });
  }
  return eventStateCanonicalDigest(event);
}
