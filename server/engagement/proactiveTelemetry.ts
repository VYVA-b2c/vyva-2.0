import { z } from "zod";
import {
  proactiveChannelSchema,
  proactiveConsentClassificationSchema,
  proactiveDecisionSchema,
  proactiveDuplicateClassificationSchema,
  proactiveLimitClassificationSchema,
  proactiveQuietHoursClassificationSchema,
  proactiveReasonCodeSchema,
} from "../../shared/engagement/proactiveEngagement.js";

export const PROACTIVE_ENGAGEMENT_TELEMETRY_SCHEMA_VERSION = "1.0.0" as const;

export const proactiveEngagementLatencyBucketSchema = z.enum([
  "gte_250ms",
  "lt_10ms",
  "lt_100ms",
  "lt_250ms",
  "lt_50ms",
]);

export const proactiveEngagementRuntimeOutcomeSchema = z.enum([
  "disabled",
  "duplicate",
  "evaluated_and_stored",
  "invalid_input",
  "persistence_failure",
  "timeout",
]);

export const proactiveEngagementPersistenceClassificationSchema = z.enum([
  "duplicate",
  "not_attempted",
  "persistence_unavailable",
  "semantic_conflict",
  "stored",
  "timed_out",
]);

export const proactiveEngagementTelemetryRecordSchema = z.object({
  schemaVersion: z.literal(PROACTIVE_ENGAGEMENT_TELEMETRY_SCHEMA_VERSION),
  observationId: z.string().min(1).max(160)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
  policyVersion: z.literal("1.0.0"),
  runtimeOutcome: proactiveEngagementRuntimeOutcomeSchema,
  decision: proactiveDecisionSchema.optional(),
  proposedChannel: proactiveChannelSchema.optional(),
  reasonCodes: z.array(proactiveReasonCodeSchema).max(12),
  timezoneValid: z.boolean(),
  consentStatus: proactiveConsentClassificationSchema.optional(),
  quietHoursStatus: proactiveQuietHoursClassificationSchema.optional(),
  limitStatus: proactiveLimitClassificationSchema.optional(),
  duplicateStatus: proactiveDuplicateClassificationSchema.optional(),
  persistence: proactiveEngagementPersistenceClassificationSchema,
  latencyBucket: proactiveEngagementLatencyBucketSchema,
  shadowOnly: z.literal(true),
  nonExecutable: z.literal(true),
}).strict();

export type ProactiveEngagementTelemetryRecord =
  z.infer<typeof proactiveEngagementTelemetryRecordSchema>;

export type ProactiveEngagementTelemetrySink =
  (record: ProactiveEngagementTelemetryRecord) => void | Promise<void>;

let telemetrySink: ProactiveEngagementTelemetrySink | null = null;

export function setProactiveEngagementTelemetrySink(
  sink: ProactiveEngagementTelemetrySink,
): void {
  telemetrySink = sink;
}

export function resetProactiveEngagementTelemetrySink(): void {
  telemetrySink = null;
}

export function emitProactiveEngagementTelemetry(
  record: ProactiveEngagementTelemetryRecord,
): void {
  const validated = proactiveEngagementTelemetryRecordSchema.parse(record);
  const sink = telemetrySink;
  if (!sink) return;
  try {
    void Promise.resolve(sink(validated)).catch(() => {});
  } catch {
    // Task 8 telemetry is non-authoritative and cannot affect live behavior.
  }
}
