export type MentalWellbeingSupportIntent =
  | "wellbeing_support"
  | "mood_reflection"
  | "stress_support"
  | "loneliness_support"
  | "grounding_or_breathing";

export type MentalWellbeingLegacyOutcome =
  | {
      kind: "supported_support";
      supportIntent: MentalWellbeingSupportIntent;
      legacyDomain: "companion";
      semanticAction: "continue_companion_support";
      presentationId: "presentation.wellbeing.support.summary";
      presentationFamilyId: "presentation.family.summary";
      summaryCode: string;
      parityReference: "legacy_companion_social_support" | "legacy_breathing_support";
    }
  | {
      kind: "fallback";
      legacyDomain: "companion";
      semanticAction: "fallback_to_legacy";
      presentationId: "presentation.wellbeing.support.safe_fallback";
      presentationFamilyId: "presentation.family.error.safe_fallback";
      reasonCode:
        | "mental_wellbeing_not_recognized"
        | "mental_wellbeing_unsupported_clinical_request"
        | "mental_wellbeing_safety_preempted";
      parityReference: "legacy_companion_social_support" | "existing_safety_precedence";
    };

const SAFETY_OR_CRISIS_TERMS = [
  "suicide",
  "suicidal",
  "kill myself",
  "end my life",
  "want to die",
  "thinking about dying",
  "thinking of dying",
  "wish i was dead",
  "hurt myself",
  "self harm",
  "self-harm",
  "harm myself",
  "not safe",
  "emergency",
  "danger",
];

const BREATHING_DISTRESS_PATTERNS = [
  /\b(?:i|we|he|she|they|someone)\s+(?:can't|cant|cannot|can not)\s+breathe\b/i,
  /\b(?:i|we|he|she|they|someone)\s+(?:can\s+)?(?:barely|hardly)\s+breathe\b/i,
  /\b(?:i(?:'m| am)?|we(?:'re| are)?|he(?:'s| is)?|she(?:'s| is)?|they(?:'re| are)?|someone(?: is)?)\s+(?:unable|struggling)\s+to\s+breathe\b/i,
];

const UNSUPPORTED_CLINICAL_TERMS = [
  "diagnose",
  "diagnosis",
  "clinical assessment",
  "therapy session",
  "therapist",
  "psychiatrist",
  "antidepressant",
  "prescribe",
  "treatment plan",
  "bipolar",
  "ptsd",
  "ocd",
];

const WELLBEING_TERMS = [
  "mental wellbeing",
  "mental well-being",
  "wellbeing",
  "well-being",
  "emotional support",
  "feeling low",
  "low mood",
  "sad",
  "down",
  "upset",
  "worried",
  "worry",
  "anxious",
  "anxiety",
  "stress",
  "stressed",
  "overwhelmed",
  "lonely",
  "loneliness",
  "alone",
  "someone to talk",
  "talk to someone",
  "coping",
  "grounding",
  "breathe",
  "breathing",
  "calm down",
  "relax",
  "mindfulness",
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(normalized: string, terms: readonly string[]): boolean {
  return terms.some((term) => normalized.includes(term));
}

function supported(
  supportIntent: MentalWellbeingSupportIntent,
  summaryCode: string,
  parityReference: MentalWellbeingLegacyOutcome["parityReference"],
): MentalWellbeingLegacyOutcome {
  return {
    kind: "supported_support",
    supportIntent,
    legacyDomain: "companion",
    semanticAction: "continue_companion_support",
    presentationId: "presentation.wellbeing.support.summary",
    presentationFamilyId: "presentation.family.summary",
    summaryCode,
    parityReference: parityReference as "legacy_companion_social_support" | "legacy_breathing_support",
  };
}

function fallback(
  reasonCode: Extract<MentalWellbeingLegacyOutcome, { kind: "fallback" }>["reasonCode"],
  parityReference: Extract<MentalWellbeingLegacyOutcome, { kind: "fallback" }>["parityReference"],
): MentalWellbeingLegacyOutcome {
  return {
    kind: "fallback",
    legacyDomain: "companion",
    semanticAction: "fallback_to_legacy",
    presentationId: "presentation.wellbeing.support.safe_fallback",
    presentationFamilyId: "presentation.family.error.safe_fallback",
    reasonCode,
    parityReference,
  };
}

export function isMentalWellbeingSafetyOrCrisisText(utterance: string): boolean {
  return includesAny(normalize(utterance), SAFETY_OR_CRISIS_TERMS) ||
    BREATHING_DISTRESS_PATTERNS.some((pattern) => pattern.test(utterance));
}

export function resolveMentalWellbeingLegacyOutcome(
  utterance: string,
): MentalWellbeingLegacyOutcome {
  const normalized = normalize(utterance);
  if (!normalized) {
    return fallback("mental_wellbeing_not_recognized", "legacy_companion_social_support");
  }
  if (includesAny(normalized, SAFETY_OR_CRISIS_TERMS)) {
    return fallback("mental_wellbeing_safety_preempted", "existing_safety_precedence");
  }
  if (BREATHING_DISTRESS_PATTERNS.some((pattern) => pattern.test(utterance))) {
    return fallback("mental_wellbeing_safety_preempted", "existing_safety_precedence");
  }
  if (includesAny(normalized, UNSUPPORTED_CLINICAL_TERMS)) {
    return fallback("mental_wellbeing_unsupported_clinical_request", "legacy_companion_social_support");
  }
  if (includesAny(normalized, ["breathe", "breathing", "grounding", "calm down", "relax", "mindfulness"])) {
    return supported("grounding_or_breathing", "wellbeing.grounding_or_breathing", "legacy_breathing_support");
  }
  if (includesAny(normalized, ["lonely", "loneliness", "alone", "someone to talk", "talk to someone"])) {
    return supported("loneliness_support", "wellbeing.loneliness_support", "legacy_companion_social_support");
  }
  if (includesAny(normalized, ["stress", "stressed", "anxious", "anxiety", "worried", "worry", "overwhelmed"])) {
    return supported("stress_support", "wellbeing.stress_support", "legacy_companion_social_support");
  }
  if (includesAny(normalized, ["feeling low", "low mood", "sad", "down", "upset"])) {
    return supported("mood_reflection", "wellbeing.mood_reflection", "legacy_companion_social_support");
  }
  if (includesAny(normalized, WELLBEING_TERMS)) {
    return supported("wellbeing_support", "wellbeing.support", "legacy_companion_social_support");
  }
  return fallback("mental_wellbeing_not_recognized", "legacy_companion_social_support");
}
