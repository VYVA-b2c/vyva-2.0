import {
  VITALS_SIGNAL_CATALOG,
  defaultContextForSignal,
  isVitalsSignalKey,
  unitForSignal,
  validateVitalsSignalValue,
  type VitalsCaptureMethod,
  type VitalsSignalKey,
} from "./vitalsSignalCatalog";
import type { VitalsReadingSource, VitalsSourceConfidence } from "./vitalsEvidence";

export type ProposedVitalsReading = {
  signal_type: VitalsSignalKey;
  value: number;
  unit: string;
  context_tag: string;
  recorded_at: string;
  source: VitalsReadingSource;
  capture_method: VitalsCaptureMethod;
  confidence: VitalsSourceConfidence;
  explanation: string;
};

export type VitalsParsingResult = {
  proposed_readings: ProposedVitalsReading[];
  needs_confirmation: true;
  clarification_prompt?: string;
  transcript?: string;
};

type ParseOptions = {
  source?: VitalsReadingSource;
  captureMethod?: VitalsCaptureMethod;
  confidence?: VitalsSourceConfidence;
  now?: Date;
};

function normalizedText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNumber(value: string): number | null {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCelsius(value: number, hasFahrenheit: boolean): number {
  if (hasFahrenheit || value > 45) return Math.round(((value - 32) * 5 / 9) * 10) / 10;
  return value;
}

function toKg(value: number, hasPounds: boolean): number {
  if (!hasPounds) return value;
  return Math.round(value * 0.45359237 * 10) / 10;
}

function glucoseMgdl(value: number, unitText: string): { value: number | null; clarification?: string } {
  const normalizedUnit = unitText.toLowerCase();
  if (/\b(mmol|mmol\/l)\b/.test(normalizedUnit)) {
    return { value: Math.round(value * 18.0182) };
  }
  if (/\bmg\s*\/?\s*dl\b/.test(normalizedUnit) || value > 25) {
    return { value };
  }
  return {
    value: null,
    clarification: "Is that glucose reading in mmol/L or mg/dL?",
  };
}

export function formatVitalsReadingDisplay(reading: Pick<ProposedVitalsReading, "signal_type" | "value" | "unit">): string {
  const rounded = Number.isInteger(reading.value) ? String(reading.value) : String(Math.round(reading.value * 10) / 10);
  return `${VITALS_SIGNAL_CATALOG[reading.signal_type].shortLabel}: ${rounded}${reading.unit ? ` ${reading.unit}` : ""}`;
}

export function buildProposedVitalsReading(
  signalType: VitalsSignalKey,
  value: number,
  explanation: string,
  options: Required<Pick<ParseOptions, "source" | "captureMethod" | "confidence" | "now">> & { contextTag?: string },
): ProposedVitalsReading | null {
  const validation = validateVitalsSignalValue(signalType, value);
  if (!validation.ok) return null;
  return {
    signal_type: signalType,
    value,
    unit: unitForSignal(signalType),
    context_tag: options.contextTag ?? defaultContextForSignal(signalType),
    recorded_at: options.now.toISOString(),
    source: options.source,
    capture_method: options.captureMethod,
    confidence: options.confidence,
    explanation,
  };
}

export function parseVitalsText(text: string, options: ParseOptions = {}): VitalsParsingResult {
  const now = options.now ?? new Date();
  const source = options.source ?? "manual_entry";
  const captureMethod = options.captureMethod ?? "manual";
  const confidence = options.confidence ?? "medium";
  const baseOptions = { source, captureMethod, confidence, now };
  const normalized = normalizedText(text);
  const proposed: ProposedVitalsReading[] = [];
  const clarificationPrompts: string[] = [];
  const seen = new Set<string>();

  const add = (signalType: VitalsSignalKey, value: number, explanation: string, contextTag?: string) => {
    const key = `${signalType}:${contextTag ?? defaultContextForSignal(signalType)}`;
    if (seen.has(key)) return;
    const reading = buildProposedVitalsReading(signalType, value, explanation, { ...baseOptions, contextTag });
    if (!reading) return;
    seen.add(key);
    proposed.push(reading);
  };

  const bpMatch = normalized.match(/\b(?:bp|blood pressure|pressure|tension|presion|tensi[oó]n)?\s*(\d{2,3})\s*(?:\/|over|on|sobre|con|by)\s*(\d{2,3})\b/);
  if (bpMatch && (/\b(bp|blood pressure|pressure|tension|presion|tensi[oó]n|over|sobre|\/)\b/.test(bpMatch[0]) || bpMatch[0].includes("/"))) {
    add("bp_systolic", Number(bpMatch[1]), "Blood pressure top number detected.", "general");
    add("bp_diastolic", Number(bpMatch[2]), "Blood pressure bottom number detected.", "general");
  } else {
    const singleBp = normalized.match(/\b(?:bp|blood pressure|pressure|tension|presion|tension)\D{0,16}(\d{2,3})\b/);
    if (singleBp) clarificationPrompts.push("What was the blood pressure bottom number?");
  }

  const glucoseMatch = normalized.match(/\b(?:glucose|blood sugar|sugar|glucosa|azucar|cgm)\D{0,18}(\d+(?:\.\d+)?)\s*([a-z/%]*)/);
  if (glucoseMatch) {
    const parsed = glucoseMgdl(Number(glucoseMatch[1]), glucoseMatch[2] ?? "");
    if (parsed.value == null && parsed.clarification) {
      clarificationPrompts.push(parsed.clarification);
    } else if (parsed.value != null) {
      add("glucose_mgdl", parsed.value, "Glucose reading detected.", "general");
    }
  }

  const oxygenMatch = normalized.match(/\b(?:oxygen|spo2|o2|saturation)\D{0,18}(\d{2,3})(?:\s*%)?/);
  if (oxygenMatch) add("oxygen_saturation", Number(oxygenMatch[1]), "Oxygen saturation detected.", "resting");

  const tempMatch = normalized.match(/\b(?:temperature|temp|fever|thermometer|temperatura)\D{0,18}(\d{2,3}(?:\.\d+)?)\s*([cf])?/);
  if (tempMatch) add("temperature_c", toCelsius(Number(tempMatch[1]), tempMatch[2] === "f"), "Temperature detected.", "general");

  const pulseMatch = normalized.match(/\b(?:heart rate|pulse|pulso|hr|bpm)\D{0,18}(\d{2,3})\b/);
  if (pulseMatch) add("resting_hr_bpm", Number(pulseMatch[1]), "Pulse reading detected.", "resting");

  const respiratoryMatch = normalized.match(/\b(?:respiratory rate|breathing rate|breaths|breathing|respiration|respiracion|rr)\D{0,18}(\d{1,2})\b/);
  if (respiratoryMatch) add("respiratory_rate", Number(respiratoryMatch[1]), "Breathing rate detected.", "resting");

  const weightMatch = normalized.match(/\b(?:weight|scale|peso)\D{0,18}(\d{2,3}(?:\.\d+)?)\s*(kg|kilos?|lb|lbs|pounds?)?/);
  if (weightMatch) add("weight_kg", toKg(Number(weightMatch[1]), /\b(lb|lbs|pounds?)\b/.test(weightMatch[2] ?? "")), "Weight reading detected.", "general");

  const scorePatterns: Array<[VitalsSignalKey, RegExp, string]> = [
    ["pain_score", /\b(?:pain|dolor)\D{0,18}(\d{1,2})(?:\s*\/\s*10)?\b/, "Pain score detected."],
    ["mood_score", /\b(?:mood|feeling|animo)\D{0,18}(\d{1,2})(?:\s*\/\s*10)?\b/, "Mood score detected."],
    ["sleep_quality_score", /\b(?:sleep|slept|sueno)\D{0,18}(\d{1,2})(?:\s*\/\s*10)?\b/, "Sleep score detected."],
    ["energy_level", /\b(?:energy|energia)\D{0,18}(\d{1,2})(?:\s*\/\s*10)?\b/, "Energy score detected."],
  ];
  for (const [signalType, pattern, explanation] of scorePatterns) {
    const match = normalized.match(pattern);
    if (match) add(signalType, Number(match[1]), explanation, "general");
  }

  if (/\b(?:medication|medicine|meds|pill|pastilla)\b/.test(normalized)) {
    if (/\b(?:not|no|missed|forgot|todavia no|aun no)\b/.test(normalized)) {
      add("medication_confirmed", 0, "Medication not confirmed.", "general");
    } else if (/\b(?:taken|took|yes|confirmed|done|tomada|tomado)\b/.test(normalized)) {
      add("medication_confirmed", 1, "Medication confirmed.", "general");
    }
  }

  const compactPrompts = [...new Set(clarificationPrompts)];
  return {
    proposed_readings: proposed,
    needs_confirmation: true,
    ...(compactPrompts.length ? { clarification_prompt: compactPrompts.join(" ") } : {}),
    transcript: text,
  };
}

export function normalizeParsedReading(value: unknown, fallback: ParseOptions = {}): ProposedVitalsReading | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const signalType = row.signal_type ?? row.signalType;
  if (!isVitalsSignalKey(signalType)) return null;
  const numeric = Number(row.value);
  if (!Number.isFinite(numeric)) return null;
  return buildProposedVitalsReading(
    signalType,
    numeric,
    typeof row.explanation === "string" ? row.explanation : "Reading detected.",
    {
      source: fallback.source ?? "manual_entry",
      captureMethod: fallback.captureMethod ?? "device_photo",
      confidence: fallback.confidence ?? "medium",
      now: fallback.now ?? new Date(),
      contextTag: typeof row.context_tag === "string" ? row.context_tag : undefined,
    },
  );
}
