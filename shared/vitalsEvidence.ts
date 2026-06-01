export const VITALS_READING_SOURCES = ["phone_estimate", "manual_entry", "connected_device", "clinical"] as const;

export type VitalsReadingSource = typeof VITALS_READING_SOURCES[number];
export type VitalsSourceConfidence = "low" | "medium" | "high";

const SELF_REPORTED_SIGNALS = new Set([
  "pain_score",
  "mood_score",
  "sleep_quality_score",
  "energy_level",
  "medication_confirmed",
]);

export function normalizeVitalsSource(source?: string | null): VitalsReadingSource | "manual_entry" {
  if (source === "phone_estimate" || source === "connected_device" || source === "clinical" || source === "manual_entry") {
    return source;
  }
  return "manual_entry";
}

export function vitalsEvidenceFor(source?: string | null, signalType?: string | null): {
  source: VitalsReadingSource;
  confidence: VitalsSourceConfidence;
  reason: string;
  displayLabel: string;
  contextLabel: string;
} {
  const normalized = normalizeVitalsSource(source);
  if (normalized === "clinical") {
    return {
      source: normalized,
      confidence: "high",
      reason: "recorded from a clinical source",
      displayLabel: "Clinical reading",
      contextLabel: "clinical, high confidence",
    };
  }
  if (normalized === "connected_device") {
    return {
      source: normalized,
      confidence: "high",
      reason: "recorded from a connected device",
      displayLabel: "Device reading",
      contextLabel: "device, high confidence",
    };
  }
  if (normalized === "phone_estimate") {
    return {
      source: normalized,
      confidence: "low",
      reason: "estimated from the phone camera",
      displayLabel: "Estimated trend",
      contextLabel: "estimated by phone; confirm before escalation",
    };
  }
  const selfReported = signalType ? SELF_REPORTED_SIGNALS.has(signalType) : false;
  return {
    source: normalized,
    confidence: "medium",
    reason: selfReported ? "self-reported by the user" : "entered manually from the user or a device",
    displayLabel: selfReported ? "Self-reported" : "Manual entry",
    contextLabel: selfReported ? "self-reported, medium confidence" : "manual entry, medium confidence",
  };
}
