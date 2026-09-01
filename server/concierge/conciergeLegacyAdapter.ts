import {
  CONCIERGE_REQUEST_INTAKE_PRESENTATION_ID,
  CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
  CONCIERGE_SHOPPING_CONTEXT_PRESENTATION_ID,
  CONCIERGE_TRUSTED_HELP_PRESENTATION_ID,
  type ConciergeSpecialistCapability,
} from "./conciergeFlow.js";

export type ConciergeLegacyActionType =
  | "concierge.task"
  | "concierge.shopping";

export type ConciergeRequestCategory =
  | "request_intake"
  | "trusted_help_setup"
  | "shopping_context";

export type ConciergeLegacyOutcome =
  | {
      kind: "supported_action";
      actionType: ConciergeLegacyActionType;
      route: "/concierge" | "/concierge/shopping";
      title: string;
      summary: string;
      cue: string;
      capability: ConciergeSpecialistCapability;
      requestCategory: ConciergeRequestCategory;
      presentationId:
        | typeof CONCIERGE_REQUEST_INTAKE_PRESENTATION_ID
        | typeof CONCIERGE_TRUSTED_HELP_PRESENTATION_ID
        | typeof CONCIERGE_SHOPPING_CONTEXT_PRESENTATION_ID;
      presentationFamilyId: "presentation.family.introduction" | "presentation.family.summary";
      requiresConfirmation: false;
      riskLevel: "low";
      externalAction: false;
      parityReference: "voice_action_registry" | "existing_concierge_route";
    }
  | {
      kind: "fallback_to_legacy";
      reasonCode:
        | "concierge_not_recognized"
        | "concierge_safety_preempted"
        | "concierge_external_execution_legacy"
        | "concierge_cross_domain_legacy";
      presentationId: typeof CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID;
      parityReference: "legacy_concierge_agent" | "legacy_cross_domain_router";
    };

export function normalizeConciergeText(text: string): string {
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

const CONCIERGE_NAVIGATION_TERMS = [
  "open concierge",
  "show concierge",
  "go to concierge",
  "take me to concierge",
  "concierge page",
  "concierge menu",
  "concierge help",
  "concierge support",
  "personal assistant",
  "assistant page",
  "help desk",
];

const TRUSTED_HELP_SETUP_TERMS = [
  "trusted help",
  "trusted helper",
  "trusted provider",
  "trusted contact",
  "trusted help setup",
  "trusted help settings",
  "set up trusted help",
  "setup trusted help",
  "open trusted help",
  "show trusted help",
];

const SHOPPING_CONTEXT_TERMS = [
  "open shopping helper",
  "show shopping helper",
  "shopping helper",
  "shopping recommendations",
  "compare products",
  "product choice",
  "shopping choices",
  "open concierge shopping",
  "show concierge shopping",
];

const SAFETY_TERMS = [
  "emergency",
  "emergency room",
  " er ",
  "can't breathe",
  "can t breathe",
  "cant breathe",
  "cannot breathe",
  "overdosed",
  "overdose",
  "fallen",
  "fall",
  "in danger",
  "want to die",
  "suicidal",
  "kill myself",
  "end my life",
];

const CROSS_DOMAIN_TERMS = [
  "brain coach",
  "brain game",
  "memory game",
  "medication",
  "medicine",
  "pill",
  "prescription",
  "anxious",
  "depressed",
  "lonely",
  "blood pressure",
  "vitals",
  "symptom",
  "health check",
  "doctor",
  "pharmacy",
  "pharmacist",
];

const EXTERNAL_EXECUTION_PATTERNS = [
  /\bbook(?:ing)?\b/i,
  /\breserve\b/i,
  /\bcancel\b/i,
  /\breschedule\b/i,
  /\btaxi\b/i,
  /\bcab\b/i,
  /\bride\b/i,
  /\btransport(?:ation)?\b/i,
  /\bdriver\b/i,
  /\buber\b/i,
  /\blyft\b/i,
  /\bcall\b/i,
  /\bphone\b/i,
  /\bcontact\b/i,
  /\bmessage\b/i,
  /\bsms\b/i,
  /\bemail\b/i,
  /\bwhatsapp\b/i,
  /\bsend\b/i,
  /\bprovider\b/i,
  /\bvendor\b/i,
  /\bplumber\b/i,
  /\belectrician\b/i,
  /\brepair\b/i,
  /\bmaintenance\b/i,
  /\bhome service\b/i,
  /\bcleaner\b/i,
  /\bpharmacy\b/i,
  /\bpharmacist\b/i,
  /\border\b/i,
  /\bbuy\b/i,
  /\bpurchase\b/i,
  /\bcheckout\b/i,
  /\bpay(?:ment)?\b/i,
  /\bcard\b/i,
  /\bdeposit\b/i,
  /\bprice\b/i,
  /\bquote\b/i,
  /\bappointment\b/i,
  /\bclinic\b/i,
  /\bhospital\b/i,
  /\baddress\b/i,
  /\blocation\b/i,
  /\bpickup\b/i,
  /\bdestination\b/i,
  /\btrusted person\b/i,
  /\btrusted contact\b/i,
  /\bcaregiver\b/i,
  /\boperator\b/i,
];

export function isConciergeExternalExecutionText(text: string): boolean {
  return EXTERNAL_EXECUTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function isConciergeSafetySensitiveText(text: string): boolean {
  const normalized = ` ${normalizeConciergeText(text)} `;
  return SAFETY_TERMS.some((term) => normalized.includes(term));
}

export function resolveConciergeLegacyOutcome(utterance: string): ConciergeLegacyOutcome {
  const normalized = normalizeConciergeText(utterance);
  if (!normalized) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "concierge_not_recognized",
      presentationId: CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "legacy_concierge_agent",
    };
  }

  if (isConciergeSafetySensitiveText(utterance)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "concierge_safety_preempted",
      presentationId: CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "legacy_cross_domain_router",
    };
  }

  if (isConciergeExternalExecutionText(utterance)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "concierge_external_execution_legacy",
      presentationId: CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "legacy_concierge_agent",
    };
  }

  if (hasAny(normalized, TRUSTED_HELP_SETUP_TERMS)) {
    return {
      kind: "supported_action",
      actionType: "concierge.task",
      route: "/concierge",
      title: "Trusted Help setup",
      summary: "Open the existing Concierge surface for Trusted Help setup context only.",
      cue: "Open Trusted Help setup in Concierge.",
      capability: "concierge_trusted_help_context",
      requestCategory: "trusted_help_setup",
      presentationId: CONCIERGE_TRUSTED_HELP_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.introduction",
      requiresConfirmation: false,
      riskLevel: "low",
      externalAction: false,
      parityReference: "existing_concierge_route",
    };
  }

  if (hasAny(normalized, SHOPPING_CONTEXT_TERMS)) {
    return {
      kind: "supported_action",
      actionType: "concierge.shopping",
      route: "/concierge/shopping",
      title: "Shopping helper",
      summary: "Open the existing Concierge shopping helper context without ordering or checkout.",
      cue: "Open Concierge shopping helper.",
      capability: "concierge_shopping_context",
      requestCategory: "shopping_context",
      presentationId: CONCIERGE_SHOPPING_CONTEXT_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.summary",
      requiresConfirmation: false,
      riskLevel: "low",
      externalAction: false,
      parityReference: "voice_action_registry",
    };
  }

  if (hasAny(normalized, CONCIERGE_NAVIGATION_TERMS) || normalized === "concierge") {
    return {
      kind: "supported_action",
      actionType: "concierge.task",
      route: "/concierge",
      title: "Concierge",
      summary: "Open the existing Concierge request-intake surface.",
      cue: "Open Concierge.",
      capability: "concierge_request_intake",
      requestCategory: "request_intake",
      presentationId: CONCIERGE_REQUEST_INTAKE_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.introduction",
      requiresConfirmation: false,
      riskLevel: "low",
      externalAction: false,
      parityReference: "voice_action_registry",
    };
  }

  if (hasAny(normalized, CROSS_DOMAIN_TERMS)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "concierge_cross_domain_legacy",
      presentationId: CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "legacy_cross_domain_router",
    };
  }

  return {
    kind: "fallback_to_legacy",
    reasonCode: "concierge_not_recognized",
    presentationId: CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
    parityReference: "legacy_concierge_agent",
  };
}
