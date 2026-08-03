import { z } from "zod";
import {
  eventStateShadowReasonCodeSchema,
  type EventStateShadowReasonCode,
} from "./eventStateFeatureFlags.js";

export const EVENT_STATE_TELEMETRY_SCHEMA_VERSION = "1.0.0" as const;

export const eventStateTelemetryRecordSchema = z.object({
  schemaVersion: z.literal(EVENT_STATE_TELEMETRY_SCHEMA_VERSION),
  observationId: z.string().min(1).max(160),
  eventType: z.string().min(1).max(80).optional(),
  channel: z.string().min(1).max(80).optional(),
  normalizationOutcome: z.enum(["not_attempted", "accepted", "rejected"]),
  parserOutcome: z.enum(["not_attempted", "accepted", "rejected"]),
  persistenceOutcome: z.enum(["not_attempted", "stored", "duplicate", "rejected", "failed", "timed_out"]),
  duplicateOutcome: z.enum(["not_checked", "none", "same_record", "conflict"]),
  correlationCompleteness: z.enum(["not_checked", "complete", "incomplete"]),
  causationCompleteness: z.enum(["not_checked", "complete", "incomplete"]),
  flowStateTransitionResult: z.enum(["not_checked", "accepted", "rejected"]),
  activeFlowInvariantResult: z.enum(["not_checked", "accepted", "rejected"]),
  errorClassification: z.enum([
    "none",
    "disabled",
    "normalization_invalid",
    "frozen_contract_rejected",
    "correlation_invalid",
    "causation_invalid",
    "active_flow_conflict",
    "transition_invalid",
    "duplicate_conflict",
    "capacity_exceeded",
    "persistence_unavailable",
    "shadow_timeout",
  ]),
  reasonCode: eventStateShadowReasonCodeSchema.optional(),
  latencyBucket: z.enum(["lt_10ms", "lt_50ms", "lt_100ms", "lt_250ms", "gte_250ms"]),
  nonExecutable: z.literal(true),
}).strict();

export type EventStateTelemetryRecord = z.infer<typeof eventStateTelemetryRecordSchema>;
export type EventStateTelemetrySink = (record: EventStateTelemetryRecord) => void | Promise<void>;

const defaultEventStateTelemetrySink: EventStateTelemetrySink = () => {};
let eventStateTelemetrySink = defaultEventStateTelemetrySink;

export function setEventStateTelemetrySink(sink: EventStateTelemetrySink): void {
  eventStateTelemetrySink = sink;
}

export function resetEventStateTelemetrySink(): void {
  eventStateTelemetrySink = defaultEventStateTelemetrySink;
}

export function emitEventStateTelemetry(record: EventStateTelemetryRecord): void {
  let safeRecord: EventStateTelemetryRecord;
  try {
    safeRecord = eventStateTelemetryRecordSchema.parse(record);
  } catch {
    return;
  }
  try {
    void Promise.resolve(eventStateTelemetrySink(safeRecord)).catch(() => {});
  } catch {
    // Task 7 telemetry is shadow-only and cannot affect runtime delivery.
  }
}

export function disabledTelemetryRecord(input: {
  observationId: string;
  reasonCode?: EventStateShadowReasonCode;
  latencyBucket?: EventStateTelemetryRecord["latencyBucket"];
}): EventStateTelemetryRecord {
  return eventStateTelemetryRecordSchema.parse({
    schemaVersion: EVENT_STATE_TELEMETRY_SCHEMA_VERSION,
    observationId: input.observationId,
    normalizationOutcome: "not_attempted",
    parserOutcome: "not_attempted",
    persistenceOutcome: "not_attempted",
    duplicateOutcome: "not_checked",
    correlationCompleteness: "not_checked",
    causationCompleteness: "not_checked",
    flowStateTransitionResult: "not_checked",
    activeFlowInvariantResult: "not_checked",
    errorClassification: "disabled",
    reasonCode: input.reasonCode,
    latencyBucket: input.latencyBucket ?? "lt_10ms",
    nonExecutable: true,
  });
}
