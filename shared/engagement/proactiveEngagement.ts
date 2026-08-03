import { createHash } from "node:crypto";
import { z } from "zod";

export const PROACTIVE_ENGAGEMENT_SCHEMA_VERSION = "1.0.0" as const;
export const PROACTIVE_ENGAGEMENT_POLICY_VERSION = "1.0.0" as const;

const PROACTIVE_INVALID_INERT_INPUT = Object.freeze({
  __vyvaTask8InvalidInertInput: true,
});

const IANA_TIME_ZONE_NAME_PATTERN =
  /^(?:UTC|[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)+)$/;
const OFFSET_TIME_ZONE_PATTERN = /^[+-](?:[01]\d|2[0-3]):?[0-5]\d$/;
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9]\d*)$/;

function isPlainRecord(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneInertValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") return value;
  if (valueType === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite numbers are not inert");
    return value;
  }
  if (valueType === "undefined") throw new Error("explicit undefined is not inert");
  if (valueType !== "object") throw new Error("unsupported non-json value is not inert");

  const objectValue = value as object;
  if (seen.has(objectValue)) throw new Error("cyclic values are not inert");
  seen.add(objectValue);
  try {
    if (Array.isArray(objectValue)) {
      const descriptors = Object.getOwnPropertyDescriptors(objectValue);
      const length = objectValue.length;
      const clone: unknown[] = [];
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key === "symbol") throw new Error("symbol array keys are not inert");
        if (key === "length") continue;
        if (!ARRAY_INDEX_PATTERN.test(key)) {
          throw new Error("non-index array properties are not inert");
        }
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index < 0 || index >= length) {
          throw new Error("out-of-range array properties are not inert");
        }
      }
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor) throw new Error("sparse arrays are not inert");
        if (!descriptor.enumerable) throw new Error("non-enumerable array entries are not inert");
        if ("get" in descriptor || "set" in descriptor) {
          throw new Error("array accessors are not inert");
        }
        clone.push(cloneInertValue(descriptor.value, seen));
      }
      return clone;
    }

    if (!isPlainRecord(objectValue)) throw new Error("unsupported object prototype is not inert");
    const descriptors = Object.getOwnPropertyDescriptors(objectValue);
    const clone: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key === "symbol") throw new Error("symbol object keys are not inert");
      const descriptor = descriptors[key];
      if (!descriptor.enumerable) throw new Error("non-enumerable object properties are not inert");
      if ("get" in descriptor || "set" in descriptor) {
        throw new Error("object accessors are not inert");
      }
      clone[key] = cloneInertValue(descriptor.value, seen);
    }
    return clone;
  } finally {
    seen.delete(objectValue);
  }
}

export function proactiveDescriptorSafeDeepInertClone(value: unknown): unknown {
  return cloneInertValue(value, new WeakSet<object>());
}

function withDescriptorSafeBoundary<T extends z.ZodTypeAny>(
  schema: T,
): z.ZodEffects<T, z.output<T>, unknown> {
  return z.preprocess((value) => {
    try {
      return proactiveDescriptorSafeDeepInertClone(value);
    } catch {
      return PROACTIVE_INVALID_INERT_INPUT;
    }
  }, schema) as z.ZodEffects<T, z.output<T>, unknown>;
}

export function isProactiveIanaTimeZone(value: string): boolean {
  return canonicalizeProactiveIanaTimeZone(value) !== null;
}

export function canonicalizeProactiveIanaTimeZone(value: string): string | null {
  if (value.length < 1 || value.length > 100) return null;
  if (value !== value.trim()) return null;
  if (OFFSET_TIME_ZONE_PATTERN.test(value)) return null;
  if (!IANA_TIME_ZONE_NAME_PATTERN.test(value)) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value })
      .resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}

export function canonicalizeProactiveIsoDateTime(value: string): string | null {
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs)) return null;
  return new Date(epochMs).toISOString();
}

export const proactiveOpaqueIdSchema = z.string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

export const proactiveIsoDateTimeSchema = z.string()
  .datetime({ offset: true })
  .transform((value, context) => {
    const canonical = canonicalizeProactiveIsoDateTime(value);
    if (!canonical) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "timestamp must be a finite ISO instant",
      });
      return z.NEVER;
    }
    return canonical;
  });

export const proactiveLocaleSchema = z.string()
  .min(2)
  .max(32)
  .regex(/^[a-z]{2,3}(-[A-Z0-9]{2,8})*$/);

export const proactiveLocalTimeSchema = z.string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const proactiveIanaTimeZoneSchema = z.string()
  .min(1)
  .max(100)
  .transform((value, context) => {
    const canonical = canonicalizeProactiveIanaTimeZone(value);
    if (!canonical) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "timezone must be a valid IANA time-zone identifier",
      });
      return z.NEVER;
    }
    return canonical;
  });

export const proactivePurposeIdSchema = z.enum([
  "appointment_reminder",
  "brain_coach",
  "callback_onboarding",
  "caregiver_requested_checkin",
  "cognitive_activity",
  "concierge_followup",
  "concierge_task_update",
  "daily_wellbeing_check",
  "elder_consent_call",
  "hydration_reminder",
  "medication_reminder",
  "missed_response_check",
  "movement_reminder",
  "nutrition_reminder",
  "operator_requested_checkin",
  "post_symptom_followup",
  "preventive_health_check",
  "recovery_followup",
  "sleep_checkin",
  "social_engagement",
  "symptom_followup",
]);
export type ProactivePurposeId = z.infer<typeof proactivePurposeIdSchema>;

export const proactiveChannelSchema = z.enum([
  "email",
  "in_app",
  "sms",
  "voice_call",
  "whatsapp",
]);
export type ProactiveChannel = z.infer<typeof proactiveChannelSchema>;

export const proactiveSourceClassificationSchema = z.enum([
  "callback_onboarding",
  "communication_log",
  "consent_attempt",
  "manual_snapshot",
  "scheduled_event",
  "scheduled_interaction",
]);
export type ProactiveSourceClassification =
  z.infer<typeof proactiveSourceClassificationSchema>;

export const proactiveConsentStateSchema = z.enum([
  "denied",
  "expired",
  "granted",
  "not_required",
  "revoked",
  "unknown",
]);
export type ProactiveConsentState = z.infer<typeof proactiveConsentStateSchema>;

export const proactiveDecisionSchema = z.enum(["allow", "block"]);
export type ProactiveDecisionValue = z.infer<typeof proactiveDecisionSchema>;

export const proactiveAllowReasonCodeSchema = z.enum([
  "consent_valid",
  "eligible_fallback_channel",
  "eligible_preferred_channel",
  "occurrence_not_previously_evaluated",
  "outside_quiet_hours",
  "within_frequency_limit",
]);

export const proactiveBlockReasonCodeSchema = z.enum([
  "channel_not_consented",
  "consent_denied",
  "consent_expired",
  "consent_missing",
  "consent_revoked",
  "cooldown_active",
  "duplicate_occurrence",
  "fatigue_limit_reached",
  "frequency_limit_reached",
  "invalid_input",
  "no_eligible_channel",
  "persistence_unavailable",
  "policy_configuration_invalid",
  "quiet_hours",
  "schedule_not_due",
  "shadow_disabled",
  "timezone_invalid",
]);

export const proactiveReasonCodeSchema = z.union([
  proactiveAllowReasonCodeSchema,
  proactiveBlockReasonCodeSchema,
]);
export type ProactiveReasonCode = z.infer<typeof proactiveReasonCodeSchema>;

export const proactiveConsentClassificationSchema = z.enum([
  "channel_denied",
  "denied",
  "expired",
  "missing",
  "not_required",
  "revoked",
  "valid",
]);
export type ProactiveConsentClassification =
  z.infer<typeof proactiveConsentClassificationSchema>;

export const proactiveQuietHoursClassificationSchema = z.enum([
  "inside_quiet_hours",
  "not_configured",
  "outside_quiet_hours",
  "policy_invalid",
  "timezone_invalid",
]);
export type ProactiveQuietHoursClassification =
  z.infer<typeof proactiveQuietHoursClassificationSchema>;

export const proactiveLimitClassificationSchema = z.enum([
  "cooldown_active",
  "fatigue_limit_reached",
  "frequency_limit_reached",
  "not_configured",
  "policy_invalid",
  "within_limit",
]);
export type ProactiveLimitClassification =
  z.infer<typeof proactiveLimitClassificationSchema>;

export const proactiveDuplicateClassificationSchema = z.enum([
  "duplicate_conflict",
  "duplicate_same_digest",
  "not_duplicate",
  "unknown",
]);
export type ProactiveDuplicateClassification =
  z.infer<typeof proactiveDuplicateClassificationSchema>;

export const proactiveAttemptOutcomeSchema = z.enum([
  "answered",
  "cancelled",
  "consent_revoked",
  "delivered",
  "dismissed",
  "failed",
  "no_answer",
  "not_attempted",
  "opened",
]);
export type ProactiveAttemptOutcome =
  z.infer<typeof proactiveAttemptOutcomeSchema>;

export const proactiveAvailabilityStatusSchema = z.enum([
  "available",
  "unavailable",
  "unknown",
]);

export const proactiveConsentSubjectSchema = z.enum([
  "caregiver",
  "operator",
  "user",
]);

const consentFactBaseSchema = z.object({
  consentId: proactiveOpaqueIdSchema,
  purposeId: proactivePurposeIdSchema,
  channel: proactiveChannelSchema.optional(),
  subject: proactiveConsentSubjectSchema,
  state: proactiveConsentStateSchema,
  effectiveAt: proactiveIsoDateTimeSchema,
  recordedAt: proactiveIsoDateTimeSchema,
  expiresAt: proactiveIsoDateTimeSchema.optional(),
  revision: z.number().int().min(0).max(1_000_000),
}).strict();

const proactiveConsentFactBaseSchema = consentFactBaseSchema.superRefine((fact, context) => {
  if (Date.parse(fact.effectiveAt) > Date.parse(fact.recordedAt) + 60_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "effectiveAt cannot be materially after recordedAt",
      path: ["effectiveAt"],
    });
  }
  if (fact.expiresAt && Date.parse(fact.expiresAt) <= Date.parse(fact.effectiveAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "expiresAt must be after effectiveAt",
      path: ["expiresAt"],
    });
  }
});
export const proactiveConsentFactSchema = withDescriptorSafeBoundary(proactiveConsentFactBaseSchema);
export type ProactiveConsentFact = z.infer<typeof proactiveConsentFactSchema>;

const proactiveChannelCandidateBaseSchema = z.object({
  channel: proactiveChannelSchema,
  preferenceRank: z.number().int().min(0).max(100),
  availability: proactiveAvailabilityStatusSchema,
  purposeId: proactivePurposeIdSchema,
}).strict();
export const proactiveChannelCandidateSchema =
  withDescriptorSafeBoundary(proactiveChannelCandidateBaseSchema);
export type ProactiveChannelCandidate =
  z.infer<typeof proactiveChannelCandidateSchema>;

const proactiveFallbackPermissionBaseSchema = z.object({
  purposeId: proactivePurposeIdSchema,
  fromChannel: proactiveChannelSchema,
  toChannel: proactiveChannelSchema,
  allowed: z.boolean(),
  permissionId: proactiveOpaqueIdSchema,
}).strict();
export const proactiveFallbackPermissionSchema =
  withDescriptorSafeBoundary(proactiveFallbackPermissionBaseSchema);
export type ProactiveFallbackPermission =
  z.infer<typeof proactiveFallbackPermissionSchema>;

const proactiveChannelPreferenceFactsBaseSchema = z.object({
  preferredChannel: proactiveChannelSchema.optional(),
  fallbackChain: z.array(proactiveChannelSchema).max(8),
  fallbackPermissions: z.array(proactiveFallbackPermissionSchema).max(32),
}).strict();
export const proactiveChannelPreferenceFactsSchema =
  withDescriptorSafeBoundary(proactiveChannelPreferenceFactsBaseSchema);
export type ProactiveChannelPreferenceFacts =
  z.infer<typeof proactiveChannelPreferenceFactsSchema>;

const quietHoursNoneSchema = z.object({
  mode: z.literal("none"),
}).strict();

const quietHoursWindowSchema = z.object({
  mode: z.literal("window"),
  startLocalTime: proactiveLocalTimeSchema,
  endLocalTime: proactiveLocalTimeSchema,
}).strict();

const quietHoursFullDaySchema = z.object({
  mode: z.literal("full_day"),
}).strict();

const proactiveQuietHoursPolicyBaseSchema = z.discriminatedUnion("mode", [
  quietHoursNoneSchema,
  quietHoursWindowSchema,
  quietHoursFullDaySchema,
]);
export const proactiveQuietHoursPolicySchema =
  withDescriptorSafeBoundary(proactiveQuietHoursPolicyBaseSchema);
export type ProactiveQuietHoursPolicy =
  z.infer<typeof proactiveQuietHoursPolicySchema>;

const proactiveAttemptSummaryBaseSchema = z.object({
  attemptId: proactiveOpaqueIdSchema,
  scheduleOccurrenceId: proactiveOpaqueIdSchema.optional(),
  purposeId: proactivePurposeIdSchema,
  channel: proactiveChannelSchema,
  outcome: proactiveAttemptOutcomeSchema,
  attemptedAt: proactiveIsoDateTimeSchema,
}).strict();
export const proactiveAttemptSummarySchema =
  withDescriptorSafeBoundary(proactiveAttemptSummaryBaseSchema);
export type ProactiveAttemptSummary =
  z.infer<typeof proactiveAttemptSummarySchema>;

const proactiveChannelLimitBaseSchema = z.object({
  channel: proactiveChannelSchema,
  maxAttemptsPerLocalDay: z.number().int().min(0).max(100).optional(),
  rollingWindowMinutes: z.number().int().min(1).max(43_200).optional(),
  maxAttemptsPerRollingWindow: z.number().int().min(0).max(100).optional(),
}).strict().superRefine((value, context) => {
  if ((value.rollingWindowMinutes === undefined) !==
    (value.maxAttemptsPerRollingWindow === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "channel rolling-window limits require both window and count",
    });
  }
});
export const proactiveChannelLimitSchema =
  withDescriptorSafeBoundary(proactiveChannelLimitBaseSchema);
export type ProactiveChannelLimit =
  z.infer<typeof proactiveChannelLimitSchema>;

const proactiveLimitPolicyBaseSchema = z.object({
  enforcement: z.enum(["not_required", "required"]),
  maxAttemptsPerLocalDay: z.number().int().min(0).max(100).optional(),
  rollingWindowMinutes: z.number().int().min(1).max(43_200).optional(),
  maxAttemptsPerRollingWindow: z.number().int().min(0).max(100).optional(),
  minCooldownMinutes: z.number().int().min(0).max(43_200).optional(),
  maxConsecutiveFailures: z.number().int().min(0).max(100).optional(),
  maxRecentNoAnswers: z.number().int().min(0).max(100).optional(),
  maxRecentDismissals: z.number().int().min(0).max(100).optional(),
  channelLimits: z.array(proactiveChannelLimitSchema).max(16),
}).strict().superRefine((value, context) => {
  const hasLimit = value.maxAttemptsPerLocalDay !== undefined ||
    (value.rollingWindowMinutes !== undefined && value.maxAttemptsPerRollingWindow !== undefined) ||
    value.minCooldownMinutes !== undefined ||
    value.maxConsecutiveFailures !== undefined ||
    value.maxRecentNoAnswers !== undefined ||
    value.maxRecentDismissals !== undefined ||
    value.channelLimits.length > 0;
  if (value.enforcement === "required" && !hasLimit) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "required limit enforcement needs at least one explicit limit",
    });
  }
  if ((value.rollingWindowMinutes === undefined) !==
    (value.maxAttemptsPerRollingWindow === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "rolling-window limits require both window and count",
    });
  }
  const limitChannels = value.channelLimits.map((limit) => limit.channel);
  if (new Set(limitChannels).size !== limitChannels.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "duplicate channel limits are not allowed",
      path: ["channelLimits"],
    });
  }
});
export const proactiveLimitPolicySchema =
  withDescriptorSafeBoundary(proactiveLimitPolicyBaseSchema);
export type ProactiveLimitPolicy = z.infer<typeof proactiveLimitPolicySchema>;

const proactiveExistingAuditStateBaseSchema = z.object({
  policyVersion: z.literal(PROACTIVE_ENGAGEMENT_POLICY_VERSION),
  scheduleOccurrenceId: proactiveOpaqueIdSchema,
  purposeId: proactivePurposeIdSchema,
  idempotencyKey: proactiveOpaqueIdSchema,
  semanticDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  decision: proactiveDecisionSchema,
}).strict();
export const proactiveExistingAuditStateSchema =
  withDescriptorSafeBoundary(proactiveExistingAuditStateBaseSchema);
export type ProactiveExistingAuditState =
  z.infer<typeof proactiveExistingAuditStateSchema>;

function rejectUndefinedDeep(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => rejectUndefinedDeep(item));
  return Object.values(value as Record<string, unknown>)
    .some((item) => rejectUndefinedDeep(item));
}

function addNoUndefinedInvariant<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((value, context) => {
    if (rejectUndefinedDeep(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "explicit undefined is not allowed",
      });
    }
  }) as T;
}

const evaluationInputBaseSchema = z.object({
  schemaVersion: z.literal(PROACTIVE_ENGAGEMENT_SCHEMA_VERSION),
  evaluationId: proactiveOpaqueIdSchema,
  policyVersion: z.literal(PROACTIVE_ENGAGEMENT_POLICY_VERSION),
  scheduleOccurrenceId: proactiveOpaqueIdSchema,
  scheduleId: proactiveOpaqueIdSchema,
  purposeId: proactivePurposeIdSchema,
  dueAt: proactiveIsoDateTimeSchema,
  evaluatedAt: proactiveIsoDateTimeSchema,
  timezone: proactiveIanaTimeZoneSchema,
  locale: proactiveLocaleSchema.optional(),
  userRef: proactiveOpaqueIdSchema.optional(),
  profileRef: proactiveOpaqueIdSchema.optional(),
  sessionRef: proactiveOpaqueIdSchema.optional(),
  source: proactiveSourceClassificationSchema,
  consentFacts: z.array(proactiveConsentFactSchema).max(64),
  channelPreferences: proactiveChannelPreferenceFactsSchema,
  channelCandidates: z.array(proactiveChannelCandidateSchema).min(1).max(16),
  quietHours: proactiveQuietHoursPolicySchema,
  recentAttempts: z.array(proactiveAttemptSummarySchema).max(200),
  limitPolicy: proactiveLimitPolicySchema,
  existingAuditStates: z.array(proactiveExistingAuditStateSchema).max(32),
  nonExecutable: z.literal(true),
}).strict().superRefine((input, context) => {
  if (Date.parse(input.dueAt) > Date.parse(input.evaluatedAt) + 366 * 24 * 60 * 60 * 1_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dueAt is implausibly after evaluatedAt",
      path: ["dueAt"],
    });
  }
  const channelKeys = input.channelCandidates.map((candidate) => `${candidate.purposeId}:${candidate.channel}`);
  if (new Set(channelKeys).size !== channelKeys.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "duplicate channel candidates are not allowed",
      path: ["channelCandidates"],
    });
  }
  const fallbackChannels = input.channelPreferences.fallbackChain;
  if (new Set(fallbackChannels).size !== fallbackChannels.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "duplicate fallback channels are not allowed",
      path: ["channelPreferences", "fallbackChain"],
    });
  }
  if (input.quietHours.mode === "window" &&
    input.quietHours.startLocalTime === input.quietHours.endLocalTime) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "window quiet hours cannot have equal start and end",
      path: ["quietHours", "endLocalTime"],
    });
  }
});

export const proactiveEngagementEvaluationInputSchema =
  withDescriptorSafeBoundary(addNoUndefinedInvariant(evaluationInputBaseSchema));
export type ProactiveEngagementEvaluationInput =
  z.infer<typeof proactiveEngagementEvaluationInputSchema>;

const policyDecisionBaseSchema = z.object({
  schemaVersion: z.literal(PROACTIVE_ENGAGEMENT_SCHEMA_VERSION),
  policyVersion: z.literal(PROACTIVE_ENGAGEMENT_POLICY_VERSION),
  decisionId: proactiveOpaqueIdSchema,
  evaluationId: proactiveOpaqueIdSchema,
  scheduleOccurrenceId: proactiveOpaqueIdSchema,
  scheduleId: proactiveOpaqueIdSchema,
  purposeId: proactivePurposeIdSchema,
  decision: proactiveDecisionSchema,
  proposedChannel: proactiveChannelSchema.optional(),
  fallbackChainConsidered: z.array(proactiveChannelSchema).max(8),
  reasonCodes: z.array(proactiveReasonCodeSchema).min(1).max(12),
  evaluatedAt: proactiveIsoDateTimeSchema,
  localEvaluatedAt: z.string().min(16).max(32),
  timezone: proactiveIanaTimeZoneSchema,
  consentStatus: proactiveConsentClassificationSchema,
  quietHoursStatus: proactiveQuietHoursClassificationSchema,
  limitStatus: proactiveLimitClassificationSchema,
  duplicateStatus: proactiveDuplicateClassificationSchema,
  source: proactiveSourceClassificationSchema,
  shadowOnly: z.literal(true),
  nonExecutable: z.literal(true),
}).strict().superRefine((decision, context) => {
  if (decision.decision === "allow" && !decision.proposedChannel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "allow decisions require a proposed channel",
      path: ["proposedChannel"],
    });
  }
  if (decision.decision === "block" && decision.proposedChannel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "block decisions cannot propose a channel",
      path: ["proposedChannel"],
    });
  }
  const allowReasons = proactiveAllowReasonCodeSchema.options as readonly string[];
  const blockReasons = proactiveBlockReasonCodeSchema.options as readonly string[];
  const allMatch = decision.reasonCodes.every((reason) =>
    decision.decision === "allow"
      ? allowReasons.includes(reason)
      : blockReasons.includes(reason)
  );
  if (!allMatch) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "reason codes must match the decision",
      path: ["reasonCodes"],
    });
  }
});

export const proactiveEngagementPolicyDecisionSchema =
  withDescriptorSafeBoundary(addNoUndefinedInvariant(policyDecisionBaseSchema));
export type ProactiveEngagementPolicyDecision =
  z.infer<typeof proactiveEngagementPolicyDecisionSchema>;

const auditBaseSchema = z.object({
  schemaVersion: z.literal(PROACTIVE_ENGAGEMENT_SCHEMA_VERSION),
  policyVersion: z.literal(PROACTIVE_ENGAGEMENT_POLICY_VERSION),
  auditId: proactiveOpaqueIdSchema,
  idempotencyKey: proactiveOpaqueIdSchema,
  decisionDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  scheduleOccurrenceId: proactiveOpaqueIdSchema,
  scheduleId: proactiveOpaqueIdSchema,
  purposeId: proactivePurposeIdSchema,
  decision: proactiveDecisionSchema,
  proposedChannel: proactiveChannelSchema.optional(),
  reasonCodes: z.array(proactiveReasonCodeSchema).min(1).max(12),
  dueAt: proactiveIsoDateTimeSchema,
  evaluatedAt: proactiveIsoDateTimeSchema,
  timezone: proactiveIanaTimeZoneSchema,
  consentStatus: proactiveConsentClassificationSchema,
  quietHoursStatus: proactiveQuietHoursClassificationSchema,
  limitStatus: proactiveLimitClassificationSchema,
  duplicateStatus: proactiveDuplicateClassificationSchema,
  source: proactiveSourceClassificationSchema,
  normalizedFacts: z.object({
    fallbackChainConsidered: z.array(proactiveChannelSchema).max(8),
    localEvaluatedAt: z.string().min(16).max(32),
    channelCandidateCount: z.number().int().min(0).max(16),
    recentAttemptCount: z.number().int().min(0).max(200),
    consentFactCount: z.number().int().min(0).max(64),
  }).strict(),
  shadowOnly: z.literal(true),
  nonExecutable: z.literal(true),
}).strict();

export const proactiveEngagementAuditSchema =
  withDescriptorSafeBoundary(addNoUndefinedInvariant(auditBaseSchema));
export type ProactiveEngagementAudit =
  z.infer<typeof proactiveEngagementAuditSchema>;

export function proactiveEngagementIdempotencyKey(input: {
  policyVersion: typeof PROACTIVE_ENGAGEMENT_POLICY_VERSION;
  scheduleOccurrenceId: string;
  purposeId: ProactivePurposeId;
}): string {
  const digest = createHash("sha256")
    .update("vyva.task8.proactive-engagement.idempotency.v1")
    .update("\0")
    .update(input.policyVersion)
    .update("\0")
    .update(input.purposeId)
    .update("\0")
    .update(input.scheduleOccurrenceId)
    .digest("hex");
  return `engagement.${digest}`;
}
