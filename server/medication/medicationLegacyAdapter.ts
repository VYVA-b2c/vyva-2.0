import {
  MEDICATION_FOLLOWUP_PRESENTATION_ID,
  MEDICATION_HUMAN_HELP_PRESENTATION_ID,
  MEDICATION_REMINDER_PRESENTATION_ID,
  type MedicationSpecialistCapability,
} from "./medicationFlow.js";

export type MedicationLegacyActionType =
  | "meds.management"
  | "meds.inventory_report"
  | "meds.refill_request";

export type MedicationLegacyOutcome =
  | {
      kind: "supported_action";
      capability: MedicationSpecialistCapability;
      actionType: MedicationLegacyActionType;
      route: "/meds" | "/meds/adherence-report";
      title: string;
      summary: string;
      cue: string;
      presentationId:
        | typeof MEDICATION_REMINDER_PRESENTATION_ID
        | typeof MEDICATION_HUMAN_HELP_PRESENTATION_ID
        | typeof MEDICATION_FOLLOWUP_PRESENTATION_ID;
      presentationFamilyId:
        | "presentation.family.introduction"
        | "presentation.family.tool_confirmation"
        | "presentation.family.followup_choice";
      requiresConfirmation: boolean;
      riskLevel: "low" | "medium";
      subjectDetected: boolean;
      parityReference: "voice_action_registry";
    }
  | {
      kind: "fallback_to_legacy";
      reasonCode:
        | "medication_not_recognized"
        | "medication_safety_preempted"
        | "medication_dose_mutation_legacy"
        | "medication_interaction_or_side_effect_legacy";
      parityReference: "legacy_medication_route" | "existing_safety_precedence";
    };

const KNOWN_MEDICATION_NAMES = [
  "paracetamol",
  "ibuprofen",
  "aspirin",
  "metformin",
  "lisinopril",
] as const;

const MEDICATION_TERMS = [
  "medication",
  "medicine",
  "meds",
  "pill",
  "pills",
  "tablet",
  "tablets",
  "dose",
  "doses",
  "prescription",
  "adherence",
  "adherence report",
  "medicacion",
  "medicina",
  "pastilla",
  "pastillas",
  "receta",
  ...KNOWN_MEDICATION_NAMES,
] as const;

const REFILL_TERMS = [
  "refill",
  "renew",
  "running out",
  "run out",
  "need more",
  "more medicine",
  "more medication",
  "reponer",
  "renovar",
  "necesito mas",
  "me queda poco",
] as const;

const INVENTORY_TERMS = [
  "report",
  "inventory",
  "stock",
  "adherence",
  "left to take",
  "still due",
  "doses left",
  "medicine check",
  "medication check",
  "do we need",
  "need to buy",
  "informe",
  "inventario",
  "comprar",
  "faltan",
] as const;

const MANAGEMENT_NAVIGATION_TERMS = [
  "open my medication",
  "open my medications",
  "open medications",
  "open meds",
  "show my medication",
  "show my medications",
  "show medications",
  "show meds",
  "view my medication",
  "view my medications",
  "go to medication",
  "go to meds",
  "medication schedule",
  "medicine schedule",
  "meds schedule",
  "medication page",
  "meds page",
  "medication list",
  "my medications",
  "my meds",
  "mis medicamentos",
  "mis medicinas",
  "abrir medicamentos",
  "ver medicamentos",
] as const;

const INTERACTION_OR_SIDE_EFFECT_TERMS = [
  "drug interaction",
  "interact",
  "interacts",
  "interacting",
  "interactions",
  "interaction",
  "contraindication",
  "contraindicated",
  "side effect",
  "side effects",
  "adverse effect",
  "adverse effects",
  "reaction",
] as const;

const DOSE_MUTATION_PATTERNS = [
  /\b(?:mark|log|record|confirm)\s+(?:my\s+)?(?:dose|medication|medicine|pill|tablet)\s+(?:as\s+)?(?:taken|done)\b/i,
  /\bi\s+(?:took|have taken|just took)\s+(?:my\s+)?(?:dose|medication|medicine|pill|tablet)\b/i,
  /\b(?:i(?:'ve| have)\s+)?(?:taken|done)\s+(?:my\s+)?(?:dose|medication|medicine|pill|tablet)\b/i,
];

const DOSE_DECISION_PATTERNS = [
  /\bshould\s+i\s+(?:double|increase|reduce|lower|decrease)\s+(?:my\s+)?dose\b/i,
  /\b(?:can|could|may|should)\s+i\s+take\s+(?:two|another|an\s+extra|extra)\b/i,
  /\bshould\s+i\s+take\s+(?:it\s+now|another\s+one|an\s+extra\s+dose|another\s+dose)\b/i,
  /\b(?:can|could|may|should)\s+i\s+(?:double|increase|reduce|lower|decrease)\s+(?:it|this|my\s+medicine|my\s+medication)\b/i,
  /\b(?:take|taking)\s+two\s+(?:because|if|when)\s+i\s+(?:missed|forgot)\b/i,
];

const START_STOP_DECISION_PATTERNS = [
  /\b(?:can|could|may|should)\s+i\s+(?:stop|start|restart|discontinue)\s+(?:taking\s+)?(?:this|that|it|my\s+)?(?:medicine|medication|pill|tablet|prescription)?\b/i,
  /\b(?:stop|start|restart|discontinue)\s+(?:my\s+)?(?:medicine|medication|pill|tablet|prescription)\b/i,
];

const SKIP_OR_MISSED_DOSE_DECISION_PATTERNS = [
  /\bshould\s+i\s+skip\b/i,
  /\b(?:can|could|may|should)\s+i\s+skip\s+(?:this|tonight'?s|today'?s|my\s+)?(?:dose|pill|tablet|medicine|medication|one)?\b/i,
  /\b(?:i\s+)?(?:missed|forgot)\s+(?:my\s+)?(?:dose|pill|tablet|medicine|medication)\b/i,
  /\b(?:i\s+)?(?:missed|forgot)\s+(?:my\s+)?(?:dose|pill|tablet|medicine|medication).*\b(?:should\s+i|take\s+it\s+now|take\s+another|take\s+two)\b/i,
];

const INTERACTION_CONCERN_PATTERNS = [
  /\binteract(?:s|ed|ing|ion|ions)?\b/i,
  /\bcontraindicat(?:ed|ion|ions)?\b/i,
  /\b(?:medicine|medication|medications|drug|drugs|pills?|tablets?).*\b(?:taken\s+together|take\s+together|together|combine|combined|mix|mixed|mixing)\b/i,
  /\b(?:taken\s+together|take\s+together|combine|combined|mix|mixed|mixing).*\b(?:medicine|medication|medications|drug|drugs|pills?|tablets?)\b/i,
];

const MEDICATION_SAFETY_PATTERNS = [
  /\boverdosed?\b/i,
  /\btook\s+an\s+overdose\b/i,
  /\btook\s+(?:too\s+much|too\s+many)\b/i,
  /\b(?:too\s+much|too\s+many)\s+(?:medicine|medication|pills?|tablets?|doses?)\b/i,
  /\b(?:double|extra)\s+dose\b/i,
  /\b(?:accidentally\s+)?(?:took|taken|had|swallowed)\s+(?:two|double|extra)\s+(?:doses?|pills?|tablets?)\b/i,
  /\b(?:allergic|adverse)\s+reaction\b/i,
  /\b(?:can't|cant|cannot|can not)\s+breathe\b/i,
  /\bchest\s+pain\b/i,
  /\b(?:severe\s+)?dizz(?:y|iness)\b/i,
  /\b(?:fainted|fainting|passed\s+out)\b/i,
  /\bdangerous\s+interaction\b/i,
  /\b(?:mixed|mixing|combine|combined|taking)\s+(?:my\s+)?(?:medicine|medication|pills?)\s+with\s+alcohol\b/i,
  /\balcohol\s+with\s+(?:my\s+)?(?:medicine|medication|pills?)\b/i,
  /\b(?:suicide|suicidal|kill myself|end my life).*(?:overdose|medicine|medication|pills?)\b/i,
  /\b(?:want\s+to\s+die|do\s+not\s+want\s+to\s+live|don't\s+want\s+to\s+live).*(?:overdose|medicine|medication|pills?|tablets?|doses?)\b/i,
];

function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => normalized.includes(phrase));
}

function mentionsMedication(normalized: string): boolean {
  return hasAny(normalized, MEDICATION_TERMS);
}

function knownMedicationMentioned(normalized: string): boolean {
  return KNOWN_MEDICATION_NAMES.some((item) => normalized.includes(item));
}

function isMedicationManagementNavigation(normalized: string): boolean {
  return normalized === "meds" ||
    normalized === "medications" ||
    normalized === "my meds" ||
    normalized === "my medications" ||
    hasAny(normalized, MANAGEMENT_NAVIGATION_TERMS);
}

export function isMedicationSafetySensitiveText(utterance: string): boolean {
  return MEDICATION_SAFETY_PATTERNS.some((pattern) => pattern.test(utterance));
}

function isDoseDecisionText(utterance: string): boolean {
  return DOSE_DECISION_PATTERNS.some((pattern) => pattern.test(utterance));
}

function isStartStopDecisionText(utterance: string): boolean {
  return START_STOP_DECISION_PATTERNS.some((pattern) => pattern.test(utterance));
}

function isSkipOrMissedDoseDecisionText(utterance: string): boolean {
  return SKIP_OR_MISSED_DOSE_DECISION_PATTERNS.some((pattern) => pattern.test(utterance));
}

function isInteractionConcernText(utterance: string): boolean {
  return INTERACTION_CONCERN_PATTERNS.some((pattern) => pattern.test(utterance));
}

export function resolveMedicationLegacyOutcome(utterance: string): MedicationLegacyOutcome {
  const normalized = normalizeText(utterance);
  if (!normalized) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "medication_not_recognized",
      parityReference: "legacy_medication_route",
    };
  }

  if (isMedicationSafetySensitiveText(utterance)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "medication_safety_preempted",
      parityReference: "existing_safety_precedence",
    };
  }

  if (mentionsMedication(normalized) && DOSE_MUTATION_PATTERNS.some((pattern) => pattern.test(utterance))) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "medication_dose_mutation_legacy",
      parityReference: "legacy_medication_route",
    };
  }

  if (
    isDoseDecisionText(utterance) ||
    isStartStopDecisionText(utterance) ||
    isSkipOrMissedDoseDecisionText(utterance)
  ) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "medication_dose_mutation_legacy",
      parityReference: "legacy_medication_route",
    };
  }

  if (
    (mentionsMedication(normalized) && hasAny(normalized, INTERACTION_OR_SIDE_EFFECT_TERMS)) ||
    isInteractionConcernText(utterance)
  ) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "medication_interaction_or_side_effect_legacy",
      parityReference: "legacy_medication_route",
    };
  }

  const subjectDetected = knownMedicationMentioned(normalized);
  if (mentionsMedication(normalized) && hasAny(normalized, REFILL_TERMS)) {
    return {
      kind: "supported_action",
      capability: "medication_refill_request",
      actionType: "meds.refill_request",
      route: "/meds/adherence-report",
      title: "Medication refill",
      summary: "Open medication stock and adherence context before any refill help.",
      cue: "Clarify the medication and ask for confirmation before anyone is contacted.",
      presentationId: MEDICATION_HUMAN_HELP_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.tool_confirmation",
      requiresConfirmation: true,
      riskLevel: "medium",
      subjectDetected,
      parityReference: "voice_action_registry",
    };
  }

  if (mentionsMedication(normalized) && hasAny(normalized, INVENTORY_TERMS)) {
    return {
      kind: "supported_action",
      capability: "medication_inventory_report",
      actionType: "meds.inventory_report",
      route: "/meds/adherence-report",
      title: "Medication check",
      summary: "Open the medication report for adherence, stock, and practical next steps.",
      cue: "Review confirmations, missed entries, and stock context without recording a new dose.",
      presentationId: MEDICATION_FOLLOWUP_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.followup_choice",
      requiresConfirmation: false,
      riskLevel: "low",
      subjectDetected,
      parityReference: "voice_action_registry",
    };
  }

  if (mentionsMedication(normalized) && isMedicationManagementNavigation(normalized)) {
    return {
      kind: "supported_action",
      capability: "medication_management",
      actionType: "meds.management",
      route: "/meds",
      title: "Medication management",
      summary: "Open the medication page for schedule, dose, refill, and routine support.",
      cue: "Ask what part of the medication routine the user wants to review.",
      presentationId: MEDICATION_REMINDER_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.introduction",
      requiresConfirmation: false,
      riskLevel: "low",
      subjectDetected,
      parityReference: "voice_action_registry",
    };
  }

  return {
    kind: "fallback_to_legacy",
    reasonCode: "medication_not_recognized",
    parityReference: "legacy_medication_route",
  };
}
