import { z } from "zod";
import { assetReferenceSchema } from "./assets";
import { contractError } from "./errors";

export const USER_INPUT_EVENT_TYPES = [
  "USER_SPOKE",
  "USER_TAPPED_OPTION",
  "USER_ENTERED_TEXT",
  "USER_UPLOADED_IMAGE",
  "USER_UPLOADED_DOCUMENT",
  "USER_ENTERED_MEASUREMENT",
  "USER_CONFIRMED",
  "USER_DECLINED",
  "USER_INTERRUPTED",
  "USER_REQUESTED_PAUSE",
  "USER_REQUESTED_RESUME",
] as const;

export const FLOW_EVENT_TYPES = [
  "FLOW_STARTED",
  "FLOW_PAUSED",
  "FLOW_RESUMED",
  "FLOW_WAITING_FOR_USER",
  "FLOW_WAITING_FOR_TOOL",
  "FLOW_COMPLETED",
  "FLOW_CANCELLED",
  "FLOW_EXPIRED",
  "FLOW_ESCALATED",
  "FLOW_FAILED",
] as const;

export const SAFETY_EVENT_TYPES = [
  "EMERGENCY_CHECK_STARTED",
  "EMERGENCY_DETECTED",
  "SAFETY_OVERRIDE_TRIGGERED",
  "ESCALATION_REQUESTED",
  "ESCALATION_COMPLETED",
] as const;

export const TOOL_EVENT_TYPES = [
  "TOOL_REQUESTED",
  "TOOL_APPROVED",
  "TOOL_REJECTED",
  "TOOL_STARTED",
  "TOOL_COMPLETED",
  "TOOL_FAILED",
] as const;

export const ENGAGEMENT_EVENT_TYPES = [
  "SCHEDULE_TRIGGERED",
  "PROACTIVE_ENGAGEMENT_REQUESTED",
  "CONSENT_CHECK_COMPLETED",
  "CONSENT_DENIED",
  "QUIET_HOURS_BLOCKED",
  "PUSH_NOTIFICATION_REQUESTED",
  "PUSH_NOTIFICATION_SENT",
  "PUSH_NOTIFICATION_DELIVERED",
  "PUSH_NOTIFICATION_FAILED",
  "USER_OPENED_NOTIFICATION",
  "USER_DISMISSED_NOTIFICATION",
  "OUTBOUND_CALL_REQUESTED",
  "OUTBOUND_CALL_STARTED",
  "OUTBOUND_CALL_ANSWERED",
  "OUTBOUND_CALL_DECLINED",
  "OUTBOUND_CALL_NO_ANSWER",
  "OUTBOUND_CALL_FAILED",
  "PROACTIVE_FLOW_STARTED",
  "PROACTIVE_FLOW_DEFERRED",
  "PROACTIVE_FLOW_CANCELLED",
  "CHANNEL_FALLBACK_REQUESTED",
  "FOLLOWUP_DUE",
  "MEDICATION_REMINDER_DUE",
  "DAILY_CHECKIN_DUE",
  "PREVENTIVE_CHECKIN_DUE",
  "APPOINTMENT_REMINDER_DUE",
  "NO_RESPONSE_DETECTED",
  "CAREGIVER_REQUESTED_CHECKIN",
  "OPERATOR_REQUESTED_CHECKIN",
] as const;

export const SCHEDULER_EVENT_TYPES = [
  "SCHEDULE_TRIGGERED",
  "FOLLOWUP_DUE",
  "MEDICATION_REMINDER_DUE",
  "DAILY_CHECKIN_DUE",
  "PREVENTIVE_CHECKIN_DUE",
  "APPOINTMENT_REMINDER_DUE",
] as const;

export const PROVIDER_OUTCOME_EVENT_TYPES = [
  "PUSH_NOTIFICATION_SENT",
  "PUSH_NOTIFICATION_DELIVERED",
  "PUSH_NOTIFICATION_FAILED",
  "OUTBOUND_CALL_STARTED",
  "OUTBOUND_CALL_ANSWERED",
  "OUTBOUND_CALL_DECLINED",
  "OUTBOUND_CALL_NO_ANSWER",
  "OUTBOUND_CALL_FAILED",
] as const;

export const PROACTIVE_USER_EVENT_TYPES = [
  "USER_OPENED_NOTIFICATION",
  "USER_DISMISSED_NOTIFICATION",
] as const;

export const CAREGIVER_OPERATOR_EVENT_TYPES = [
  "CAREGIVER_REQUESTED_CHECKIN",
  "OPERATOR_REQUESTED_CHECKIN",
] as const;

export const INTERACTION_EVENT_TYPES = [
  ...USER_INPUT_EVENT_TYPES,
  ...FLOW_EVENT_TYPES,
  ...SAFETY_EVENT_TYPES,
  ...TOOL_EVENT_TYPES,
  ...ENGAGEMENT_EVENT_TYPES,
] as const;

export type InteractionEventType = typeof INTERACTION_EVENT_TYPES[number];

export const INTERACTION_EVENT_SOURCES = [
  "user",
  "ui",
  "voice",
  "tool",
  "system",
  "scheduler",
  "provider",
  "caregiver",
  "operator",
] as const;

export const INTERACTION_MODALITIES = [
  "voice",
  "touch",
  "text",
  "image",
  "document",
  "measurement",
  "tool",
  "system",
] as const;

export const INTERACTION_TRIGGER_SOURCES = [
  "user",
  "push",
  "outbound_call",
  "caregiver",
  "operator",
  "schedule",
  "system",
] as const;

export type InteractionEventSource = typeof INTERACTION_EVENT_SOURCES[number];
export type InteractionModality = typeof INTERACTION_MODALITIES[number];
export type InteractionTriggerSource = typeof INTERACTION_TRIGGER_SOURCES[number];
export const interactionTriggerSourceSchema = z.enum(INTERACTION_TRIGGER_SOURCES);

export const EVENT_TYPE_GROUPS = {
  userInput: USER_INPUT_EVENT_TYPES,
  flow: FLOW_EVENT_TYPES,
  safety: SAFETY_EVENT_TYPES,
  tool: TOOL_EVENT_TYPES,
  scheduler: SCHEDULER_EVENT_TYPES,
  providerOutcome: PROVIDER_OUTCOME_EVENT_TYPES,
  proactiveUser: PROACTIVE_USER_EVENT_TYPES,
  caregiverOperator: CAREGIVER_OPERATOR_EVENT_TYPES,
  engagement: ENGAGEMENT_EVENT_TYPES,
} as const;

export const consentContextSchema = z.object({
  decisionId: z.string().min(1).optional(),
  scopes: z.array(z.string().min(1)).optional(),
}).strict();

export const safetyContextSchema = z.object({
  checked: z.boolean().optional(),
  flags: z.array(z.string().min(1)).optional(),
}).strict();

const eventPayloadSchema = z.record(z.unknown());

const answerContextPayload = {
  questionId: z.string().min(1),
  sceneId: z.string().min(1),
  flowVersion: z.string().min(1),
};

export const EVENT_PAYLOAD_SCHEMAS = {
  USER_SPOKE: z.object({
    transcript: z.string().min(1).max(20_000),
    questionId: z.string().min(1).optional(),
    sceneId: z.string().min(1).optional(),
    flowVersion: z.string().min(1).optional(),
  }).strict(),
  USER_TAPPED_OPTION: z.object({
    ...answerContextPayload,
    answerId: z.string().min(1),
  }).strict(),
  USER_ENTERED_TEXT: z.object({
    text: z.string().min(1).max(20_000),
    questionId: z.string().min(1).optional(),
    sceneId: z.string().min(1).optional(),
    flowVersion: z.string().min(1).optional(),
  }).strict(),
  USER_UPLOADED_IMAGE: z.object({
    asset: assetReferenceSchema.refine((asset) => asset.contentType.startsWith("image/")),
  }).strict(),
  USER_UPLOADED_DOCUMENT: z.object({
    asset: assetReferenceSchema.refine((asset) => (
      asset.contentType.startsWith("application/") || asset.contentType.startsWith("text/")
    )),
  }).strict(),
  TOOL_COMPLETED: z.object({
    toolId: z.string().min(1).max(128),
    requestId: z.string().min(1).max(128),
    result: z.unknown().refine((value) => value !== undefined),
  }).strict(),
  SCHEDULE_TRIGGERED: z.object({
    scheduleId: z.string().min(1).max(128),
    purpose: z.string().min(1).max(128),
  }).strict(),
  USER_OPENED_NOTIFICATION: z.object({
    engagementId: z.string().min(1).max(128),
    notificationId: z.string().min(1).max(128).optional(),
  }).strict(),
  PROACTIVE_FLOW_DEFERRED: z.object({
    engagementId: z.string().min(1).max(128).optional(),
    reasonCode: z.string().min(1).max(128).optional(),
    deferUntil: z.string().datetime({ offset: true }).optional(),
  }).strict(),
  PROACTIVE_FLOW_CANCELLED: z.object({
    engagementId: z.string().min(1).max(128).optional(),
    reasonCode: z.string().min(1).max(128).optional(),
  }).strict(),
  OUTBOUND_CALL_ANSWERED: z.object({
    engagementId: z.string().min(1).max(128),
    callId: z.string().min(1).max(128),
    providerCallId: z.string().min(1).max(128).optional(),
  }).strict(),
  FLOW_FAILED: z.object({
    reasonCode: z.string().min(1).max(128),
    recoverable: z.boolean(),
    failureClass: z.string().min(1).max(128).optional(),
  }).strict(),
} as const satisfies Partial<Record<InteractionEventType, z.ZodTypeAny>>;

export interface InteractionEventPayloadMap {
  USER_SPOKE: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.USER_SPOKE>;
  USER_TAPPED_OPTION: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.USER_TAPPED_OPTION>;
  USER_ENTERED_TEXT: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.USER_ENTERED_TEXT>;
  USER_UPLOADED_IMAGE: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.USER_UPLOADED_IMAGE>;
  USER_UPLOADED_DOCUMENT: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.USER_UPLOADED_DOCUMENT>;
  TOOL_COMPLETED: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.TOOL_COMPLETED>;
  SCHEDULE_TRIGGERED: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.SCHEDULE_TRIGGERED>;
  USER_OPENED_NOTIFICATION: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.USER_OPENED_NOTIFICATION>;
  PROACTIVE_FLOW_DEFERRED: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.PROACTIVE_FLOW_DEFERRED>;
  PROACTIVE_FLOW_CANCELLED: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.PROACTIVE_FLOW_CANCELLED>;
  OUTBOUND_CALL_ANSWERED: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.OUTBOUND_CALL_ANSWERED>;
  FLOW_FAILED: z.infer<typeof EVENT_PAYLOAD_SCHEMAS.FLOW_FAILED>;
}

type EventSemanticRule = {
  sources: readonly InteractionEventSource[];
  modalities: readonly InteractionModality[];
  triggers: readonly InteractionTriggerSource[];
  channels?: readonly string[];
};

const ALL_TRIGGERS = INTERACTION_TRIGGER_SOURCES;
const PUSH_CHANNELS = ["push", "pwa_push", "web_push"] as const;
const TELEPHONE_CHANNELS = [
  "telephone", "phone", "outbound_call", "twilio_voice", "elevenlabs_call",
] as const;
const semanticRules: Partial<Record<InteractionEventType, EventSemanticRule>> = {};
const assignRules = (
  eventTypes: readonly InteractionEventType[],
  rule: EventSemanticRule,
): void => {
  for (const eventType of eventTypes) semanticRules[eventType] = rule;
};

assignRules(FLOW_EVENT_TYPES, {
  sources: ["system"],
  modalities: ["system"],
  triggers: ALL_TRIGGERS,
});
assignRules(SAFETY_EVENT_TYPES, {
  sources: ["system"],
  modalities: ["system"],
  triggers: ALL_TRIGGERS,
});
assignRules(TOOL_EVENT_TYPES, {
  sources: ["tool", "provider", "system"],
  modalities: ["tool", "system"],
  triggers: ALL_TRIGGERS,
});
assignRules(ENGAGEMENT_EVENT_TYPES, {
  sources: ["system", "scheduler"],
  modalities: ["system"],
  triggers: ["schedule", "system"],
});

Object.assign(semanticRules, {
  USER_SPOKE: { sources: ["user", "voice"], modalities: ["voice"], triggers: ["user"] },
  USER_TAPPED_OPTION: { sources: ["user", "ui"], modalities: ["touch"], triggers: ["user"] },
  USER_ENTERED_TEXT: { sources: ["user", "ui"], modalities: ["text"], triggers: ["user"] },
  USER_UPLOADED_IMAGE: { sources: ["user", "ui"], modalities: ["image"], triggers: ["user"] },
  USER_UPLOADED_DOCUMENT: { sources: ["user", "ui"], modalities: ["document"], triggers: ["user"] },
  USER_ENTERED_MEASUREMENT: { sources: ["user", "ui"], modalities: ["measurement"], triggers: ["user"] },
  USER_CONFIRMED: { sources: ["user", "ui", "voice"], modalities: ["voice", "touch", "text"], triggers: ["user"] },
  USER_DECLINED: { sources: ["user", "ui", "voice"], modalities: ["voice", "touch", "text"], triggers: ["user"] },
  USER_INTERRUPTED: { sources: ["user", "ui", "voice"], modalities: ["voice", "touch", "text"], triggers: ["user"] },
  USER_REQUESTED_PAUSE: { sources: ["user", "ui", "voice"], modalities: ["voice", "touch", "text"], triggers: ["user"] },
  USER_REQUESTED_RESUME: { sources: ["user", "ui", "voice"], modalities: ["voice", "touch", "text"], triggers: ["user"] },
  SCHEDULE_TRIGGERED: { sources: ["scheduler", "system"], modalities: ["system"], triggers: ["schedule"] },
  FOLLOWUP_DUE: { sources: ["scheduler", "system"], modalities: ["system"], triggers: ["schedule"] },
  MEDICATION_REMINDER_DUE: { sources: ["scheduler", "system"], modalities: ["system"], triggers: ["schedule"] },
  DAILY_CHECKIN_DUE: { sources: ["scheduler", "system"], modalities: ["system"], triggers: ["schedule"] },
  PREVENTIVE_CHECKIN_DUE: { sources: ["scheduler", "system"], modalities: ["system"], triggers: ["schedule"] },
  APPOINTMENT_REMINDER_DUE: { sources: ["scheduler", "system"], modalities: ["system"], triggers: ["schedule"] },
  PUSH_NOTIFICATION_SENT: {
    sources: ["provider", "system"], modalities: ["system"],
    triggers: ["schedule", "system", "caregiver", "operator"], channels: PUSH_CHANNELS,
  },
  PUSH_NOTIFICATION_DELIVERED: {
    sources: ["provider", "system"], modalities: ["system"],
    triggers: ["schedule", "system", "caregiver", "operator"], channels: PUSH_CHANNELS,
  },
  PUSH_NOTIFICATION_FAILED: {
    sources: ["provider", "system"], modalities: ["system"],
    triggers: ["schedule", "system", "caregiver", "operator"], channels: PUSH_CHANNELS,
  },
  USER_OPENED_NOTIFICATION: {
    sources: ["user", "ui"], modalities: ["touch"], triggers: ["push"], channels: PUSH_CHANNELS,
  },
  USER_DISMISSED_NOTIFICATION: {
    sources: ["user", "ui"], modalities: ["touch"], triggers: ["push"], channels: PUSH_CHANNELS,
  },
  PROACTIVE_FLOW_DEFERRED: {
    sources: ["user", "ui", "system", "caregiver", "operator"],
    modalities: ["voice", "touch", "text", "system"],
    triggers: ["push", "outbound_call", "user", "caregiver", "operator", "schedule", "system"],
  },
  PROACTIVE_FLOW_CANCELLED: {
    sources: ["user", "ui", "system", "caregiver", "operator"],
    modalities: ["voice", "touch", "text", "system"],
    triggers: ["push", "outbound_call", "user", "caregiver", "operator", "schedule", "system"],
  },
  OUTBOUND_CALL_STARTED: {
    sources: ["provider", "system"], modalities: ["voice", "system"], triggers: ["outbound_call"],
    channels: TELEPHONE_CHANNELS,
  },
  OUTBOUND_CALL_ANSWERED: {
    sources: ["provider", "system"], modalities: ["voice", "system"], triggers: ["outbound_call"],
    channels: TELEPHONE_CHANNELS,
  },
  OUTBOUND_CALL_DECLINED: {
    sources: ["provider", "system"], modalities: ["voice", "system"], triggers: ["outbound_call"],
    channels: TELEPHONE_CHANNELS,
  },
  OUTBOUND_CALL_NO_ANSWER: {
    sources: ["provider", "system"], modalities: ["voice", "system"], triggers: ["outbound_call"],
    channels: TELEPHONE_CHANNELS,
  },
  OUTBOUND_CALL_FAILED: {
    sources: ["provider", "system"], modalities: ["voice", "system"], triggers: ["outbound_call"],
    channels: TELEPHONE_CHANNELS,
  },
  CAREGIVER_REQUESTED_CHECKIN: {
    sources: ["caregiver"], modalities: ["system", "touch", "text"], triggers: ["caregiver"],
  },
  OPERATOR_REQUESTED_CHECKIN: {
    sources: ["operator"], modalities: ["system", "touch", "text"], triggers: ["operator"],
  },
  NO_RESPONSE_DETECTED: {
    sources: ["system", "scheduler", "provider"], modalities: ["system"],
    triggers: ["push", "outbound_call", "schedule", "system"],
  },
} satisfies Partial<Record<InteractionEventType, EventSemanticRule>>);

export const EVENT_SEMANTIC_RULES =
  semanticRules as Readonly<Record<InteractionEventType, EventSemanticRule>>;

export const interactionEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(INTERACTION_EVENT_TYPES),
  occurredAt: z.string().datetime({ offset: true }),
  source: z.enum(INTERACTION_EVENT_SOURCES),
  userId: z.string().min(1),
  profileId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  flowId: z.string().min(1).optional(),
  flowVersion: z.string().min(1).optional(),
  channel: z.string().min(1),
  modality: z.enum(INTERACTION_MODALITIES),
  triggerSource: interactionTriggerSourceSchema,
  correlationId: z.string().min(1),
  causationId: z.string().min(1).optional(),
  payload: eventPayloadSchema,
  consentContext: consentContextSchema.optional(),
  safetyContext: safetyContextSchema.optional(),
  metadata: z.record(z.unknown()),
}).strict();

export type EventPayloadFor<TType extends InteractionEventType> =
  TType extends keyof InteractionEventPayloadMap
    ? InteractionEventPayloadMap[TType]
    : Record<string, unknown>;

export type InteractionEvent<
  TType extends InteractionEventType = InteractionEventType,
> =
  Omit<z.infer<typeof interactionEventSchema>, "payload"> & {
    eventType: TType;
    payload: EventPayloadFor<TType>;
  };

export function parseInteractionEvent(
  value: unknown,
): InteractionEvent {
  const envelope = interactionEventSchema.safeParse(value);
  if (!envelope.success) {
    const candidate = value as Record<string, unknown>;
    if (!INTERACTION_EVENT_SOURCES.includes(candidate?.source as InteractionEventSource)) {
      contractError("INVALID_EVENT_SOURCE");
    }
    if (!INTERACTION_MODALITIES.includes(candidate?.modality as InteractionModality)) {
      contractError("INVALID_EVENT_MODALITY");
    }
    if (!INTERACTION_TRIGGER_SOURCES.includes(candidate?.triggerSource as InteractionTriggerSource)) {
      contractError("INVALID_EVENT_TRIGGER");
    }
    contractError("INVALID_EVENT_PAYLOAD");
  }

  const event = envelope.data;
  const rule = EVENT_SEMANTIC_RULES[event.eventType];
  if (!rule.sources.includes(event.source)) contractError("INVALID_EVENT_SOURCE");
  if (!rule.modalities.includes(event.modality)) contractError("INVALID_EVENT_MODALITY");
  if (!rule.triggers.includes(event.triggerSource)) contractError("INVALID_EVENT_TRIGGER");
  if (rule.channels && !rule.channels.includes(event.channel.toLowerCase())) {
    contractError("INVALID_EVENT_MODALITY");
  }

  const payloadSchema = EVENT_PAYLOAD_SCHEMAS[event.eventType as keyof typeof EVENT_PAYLOAD_SCHEMAS];
  if (payloadSchema) {
    const payload = payloadSchema.safeParse(event.payload);
    if (!payload.success) contractError("INVALID_EVENT_PAYLOAD");
    return { ...event, payload: payload.data } as InteractionEvent;
  }
  return event as InteractionEvent;
}
