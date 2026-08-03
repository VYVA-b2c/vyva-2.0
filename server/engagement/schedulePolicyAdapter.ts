import { z } from "zod";
import { descriptorSafeDeepInertClone } from "../orchestrator/eventStateCanonicalJson.js";
import {
  PROACTIVE_ENGAGEMENT_POLICY_VERSION,
  PROACTIVE_ENGAGEMENT_SCHEMA_VERSION,
  proactiveAttemptSummarySchema,
  proactiveChannelCandidateSchema,
  proactiveChannelPreferenceFactsSchema,
  proactiveConsentFactSchema,
  proactiveEngagementEvaluationInputSchema,
  proactiveExistingAuditStateSchema,
  proactiveIanaTimeZoneSchema,
  proactiveIsoDateTimeSchema,
  proactiveLimitPolicySchema,
  proactiveLocalTimeSchema,
  proactiveLocaleSchema,
  proactiveOpaqueIdSchema,
  proactivePurposeIdSchema,
  type ProactiveEngagementEvaluationInput,
  type ProactivePurposeId,
} from "../../shared/engagement/proactiveEngagement.js";

const scheduledInteractionTypeSchema = z.enum([
  "BRAIN_COACH",
  "CHECK_IN",
  "CONCIERGE_FOLLOWUP",
  "MEDICATION",
  "SYMPTOM_FOLLOWUP",
]);

const scheduledInteractionSnapshotSchema = z.object({
  evaluationId: proactiveOpaqueIdSchema,
  scheduleOccurrenceId: proactiveOpaqueIdSchema,
  evaluatedAt: proactiveIsoDateTimeSchema,
  schedule: z.object({
    id: proactiveOpaqueIdSchema,
    userId: proactiveOpaqueIdSchema.optional(),
    profileId: proactiveOpaqueIdSchema.optional(),
    sessionId: proactiveOpaqueIdSchema.optional(),
    interactionType: scheduledInteractionTypeSchema,
    nextRunAt: proactiveIsoDateTimeSchema,
    timezone: proactiveIanaTimeZoneSchema,
    preferredLanguage: proactiveLocaleSchema.optional(),
    quietHoursStart: proactiveLocalTimeSchema.optional(),
    quietHoursEnd: proactiveLocalTimeSchema.optional(),
    consentRequired: z.boolean(),
    consentStatus: z.enum(["denied", "granted", "not_required", "pending", "revoked", "unknown"]),
  }).strict(),
  consentFacts: z.array(proactiveConsentFactSchema).max(64),
  channelPreferences: proactiveChannelPreferenceFactsSchema,
  channelCandidates: z.array(proactiveChannelCandidateSchema).min(1).max(16),
  recentAttempts: z.array(proactiveAttemptSummarySchema).max(200),
  limitPolicy: proactiveLimitPolicySchema,
  existingAuditStates: z.array(proactiveExistingAuditStateSchema).max(32),
}).strict();

export type ScheduledInteractionPolicySnapshot =
  z.infer<typeof scheduledInteractionSnapshotSchema>;

export type SchedulePolicyAdapterResult =
  | { ok: true; input: ProactiveEngagementEvaluationInput }
  | { ok: false; error: "invalid_input" | "unsupported_schedule_type" };

const PURPOSE_BY_INTERACTION_TYPE: Record<z.infer<typeof scheduledInteractionTypeSchema>, ProactivePurposeId> = {
  BRAIN_COACH: "brain_coach",
  CHECK_IN: "daily_wellbeing_check",
  CONCIERGE_FOLLOWUP: "concierge_followup",
  MEDICATION: "medication_reminder",
  SYMPTOM_FOLLOWUP: "post_symptom_followup",
};

function quietHoursFor(snapshot: ScheduledInteractionPolicySnapshot):
  ProactiveEngagementEvaluationInput["quietHours"] {
  const start = snapshot.schedule.quietHoursStart;
  const end = snapshot.schedule.quietHoursEnd;
  if (!start || !end) return { mode: "none" };
  if (start === end) return { mode: "full_day" };
  return {
    mode: "window",
    startLocalTime: start,
    endLocalTime: end,
  };
}

export function scheduledInteractionSnapshotToEvaluationInput(
  rawSnapshot: unknown,
): SchedulePolicyAdapterResult {
  let inertSnapshot: unknown;
  try {
    inertSnapshot = descriptorSafeDeepInertClone(rawSnapshot);
  } catch {
    return { ok: false, error: "invalid_input" };
  }
  const parsed = scheduledInteractionSnapshotSchema.safeParse(inertSnapshot);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const snapshot = parsed.data;
  const purposeId = PURPOSE_BY_INTERACTION_TYPE[snapshot.schedule.interactionType];
  if (!proactivePurposeIdSchema.safeParse(purposeId).success) {
    return { ok: false, error: "unsupported_schedule_type" };
  }

  const input = proactiveEngagementEvaluationInputSchema.safeParse({
    schemaVersion: PROACTIVE_ENGAGEMENT_SCHEMA_VERSION,
    evaluationId: snapshot.evaluationId,
    policyVersion: PROACTIVE_ENGAGEMENT_POLICY_VERSION,
    scheduleOccurrenceId: snapshot.scheduleOccurrenceId,
    scheduleId: snapshot.schedule.id,
    purposeId,
    dueAt: snapshot.schedule.nextRunAt,
    evaluatedAt: snapshot.evaluatedAt,
    timezone: snapshot.schedule.timezone,
    ...(snapshot.schedule.preferredLanguage ? { locale: snapshot.schedule.preferredLanguage } : {}),
    ...(snapshot.schedule.userId ? { userRef: snapshot.schedule.userId } : {}),
    ...(snapshot.schedule.profileId ? { profileRef: snapshot.schedule.profileId } : {}),
    ...(snapshot.schedule.sessionId ? { sessionRef: snapshot.schedule.sessionId } : {}),
    source: "scheduled_interaction",
    consentFacts: snapshot.consentFacts,
    channelPreferences: snapshot.channelPreferences,
    channelCandidates: snapshot.channelCandidates,
    quietHours: quietHoursFor(snapshot),
    recentAttempts: snapshot.recentAttempts,
    limitPolicy: snapshot.limitPolicy,
    existingAuditStates: snapshot.existingAuditStates,
    nonExecutable: true,
  });
  if (!input.success) return { ok: false, error: "invalid_input" };
  return { ok: true, input: input.data };
}
