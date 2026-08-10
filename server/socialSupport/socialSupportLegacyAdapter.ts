import {
  SOCIAL_SUPPORT_ACTIVITIES_PRESENTATION_ID,
  SOCIAL_SUPPORT_COMMUNITY_PRESENTATION_ID,
  SOCIAL_SUPPORT_ROOMS_PRESENTATION_ID,
  SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
  type SocialSupportSpecialistCapability,
} from "./socialSupportFlow.js";

export type SocialSupportActionType =
  | "social.community"
  | "social.rooms"
  | "social.activities";

export type SocialSupportRequestCategory =
  | "community_home"
  | "social_rooms"
  | "community_activities";

export type SocialSupportLegacyOutcome =
  | {
      kind: "supported_action";
      actionType: SocialSupportActionType;
      route: "/social-rooms" | "/social-rooms/join-in" | "/social-rooms/activities";
      title: string;
      summary: string;
      cue: string;
      capability: SocialSupportSpecialistCapability;
      requestCategory: SocialSupportRequestCategory;
      presentationId:
        | typeof SOCIAL_SUPPORT_COMMUNITY_PRESENTATION_ID
        | typeof SOCIAL_SUPPORT_ROOMS_PRESENTATION_ID
        | typeof SOCIAL_SUPPORT_ACTIVITIES_PRESENTATION_ID;
      presentationFamilyId: "presentation.family.summary" | "presentation.family.introduction";
      requiresConfirmation: false;
      riskLevel: "low";
      externalAction: false;
      humanContact: false;
      caregiverAuthority: false;
      parityReference: "existing_social_rooms_route" | "voice_action_registry";
    }
  | {
      kind: "fallback_to_legacy";
      reasonCode:
        | "social_support_not_recognized"
        | "social_support_safety_preempted"
        | "social_support_mental_wellbeing_legacy"
        | "social_support_concierge_legacy"
        | "social_support_caregiver_authority_legacy"
        | "social_support_external_execution_legacy"
        | "social_support_cross_domain_legacy";
      presentationId: typeof SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID;
      parityReference:
        | "legacy_companion_agent"
        | "mental_wellbeing_specialist"
        | "concierge_specialist"
        | "caregiver_permission_system"
        | "existing_safety_precedence"
        | "legacy_cross_domain_router";
    };

export function normalizeSocialSupportText(text: string): string {
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

const SAFETY_TERMS = [
  "emergency",
  "can't breathe",
  "can t breathe",
  "cant breathe",
  "cannot breathe",
  "overdosed",
  "overdose",
  "fallen",
  "fell",
  "fall",
  "in danger",
  "danger",
  "want to die",
  "suicidal",
  "kill myself",
  "end my life",
  "hurting me",
  "hurt myself",
  "self harm",
  "self-harm",
  "i need help right now",
  "i need help now",
];

const MENTAL_WELLBEING_TERMS = [
  "lonely",
  "loneliness",
  "alone",
  "isolated",
  "isolation",
  "someone to talk",
  "talk to someone",
  "some company",
  "company",
  "feeling low",
  "low mood",
  "sad",
  "down",
  "anxious",
  "anxiety",
  "stress",
  "stressed",
  "worried",
  "overwhelmed",
  "mental wellbeing",
  "emotional support",
];

const CAREGIVER_AUTHORITY_TERMS = [
  "caregiver",
  "carer",
  "daughter",
  "son",
  "family",
  "trusted person",
  "trusted contact",
  "trusted helper",
  "grant access",
  "give access",
  "remove access",
  "who can see",
  "permission",
  "permissions",
  "share my",
  "tell my",
  "invite",
  "operator",
  "escalation",
  "alert",
];

const CONCIERGE_TERMS = [
  "trusted help",
  "ride",
  "taxi",
  "transport",
  "doctor",
  "appointment",
  "shopping",
  "groceries",
  "grocery",
  "helper",
  "provider",
  "vendor",
  "pharmacy",
  "concierge",
  "book",
  "order",
  "buy",
  "purchase",
  "checkout",
  "pay",
];

const CROSS_DOMAIN_TERMS = [
  "brain coach",
  "brain game",
  "memory game",
  "medication",
  "medicine",
  "pill",
  "prescription",
  "blood pressure",
  "vitals",
  "symptom",
  "health check",
];

const SOCIAL_ROOMS_TERMS = [
  "join social rooms",
  "open social rooms",
  "show social rooms",
  "social rooms",
  "community rooms",
  "join community room",
  "open community room",
];

const COMMUNITY_ACTIVITY_TERMS = [
  "community activities",
  "community activity",
  "social activity",
  "social activities",
  "open community activities",
  "show community activities",
  "do a social activity",
  "join an activity",
];

const COMMUNITY_HOME_TERMS = [
  "open community",
  "show community",
  "community page",
  "community hub",
  "open social",
  "show social",
  "social hub",
  "open companion",
  "show companion",
  "companion page",
];

const EXTERNAL_EXECUTION_PATTERNS = [
  /\bcall\b/i,
  /\bphone\b/i,
  /\bcontact\b/i,
  /\bmessage\b/i,
  /\bsms\b/i,
  /\bemail\b/i,
  /\bwhatsapp\b/i,
  /\bnotify\b/i,
  /\bsend\b/i,
  /\bshare\b/i,
  /\binvite\b/i,
  /\bgrant\b/i,
  /\bremove\b/i,
  /\bbook(?:ing)?\b/i,
  /\border\b/i,
  /\bbuy\b/i,
  /\bpurchase\b/i,
  /\bpay(?:ment)?\b/i,
  /\btask\b/i,
];

export function isSocialSupportSafetySensitiveText(text: string): boolean {
  const normalized = ` ${normalizeSocialSupportText(text)} `;
  return SAFETY_TERMS.some((term) => normalized.includes(term));
}

export function isSocialSupportExternalExecutionText(text: string): boolean {
  return EXTERNAL_EXECUTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function resolveSocialSupportLegacyOutcome(utterance: string): SocialSupportLegacyOutcome {
  const normalized = normalizeSocialSupportText(utterance);
  if (!normalized) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "social_support_not_recognized",
      presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "legacy_companion_agent",
    };
  }

  if (isSocialSupportSafetySensitiveText(utterance)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "social_support_safety_preempted",
      presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "existing_safety_precedence",
    };
  }

  if (hasAny(normalized, MENTAL_WELLBEING_TERMS)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "social_support_mental_wellbeing_legacy",
      presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "mental_wellbeing_specialist",
    };
  }

  if (hasAny(normalized, CAREGIVER_AUTHORITY_TERMS)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "social_support_caregiver_authority_legacy",
      presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "caregiver_permission_system",
    };
  }

  if (hasAny(normalized, CONCIERGE_TERMS)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "social_support_concierge_legacy",
      presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "concierge_specialist",
    };
  }

  if (isSocialSupportExternalExecutionText(utterance)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "social_support_external_execution_legacy",
      presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "legacy_companion_agent",
    };
  }

  if (hasAny(normalized, CROSS_DOMAIN_TERMS)) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "social_support_cross_domain_legacy",
      presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
      parityReference: "legacy_cross_domain_router",
    };
  }

  if (hasAny(normalized, SOCIAL_ROOMS_TERMS)) {
    return {
      kind: "supported_action",
      actionType: "social.rooms",
      route: "/social-rooms/join-in",
      title: "Social rooms",
      summary: "Open the existing social rooms surface for user-initiated community connection.",
      cue: "Open social rooms.",
      capability: "social_rooms_context",
      requestCategory: "social_rooms",
      presentationId: SOCIAL_SUPPORT_ROOMS_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.summary",
      requiresConfirmation: false,
      riskLevel: "low",
      externalAction: false,
      humanContact: false,
      caregiverAuthority: false,
      parityReference: "existing_social_rooms_route",
    };
  }

  if (hasAny(normalized, COMMUNITY_ACTIVITY_TERMS)) {
    return {
      kind: "supported_action",
      actionType: "social.activities",
      route: "/social-rooms/activities",
      title: "Community activities",
      summary: "Open the existing community activities surface without scheduling or contacting anyone.",
      cue: "Open community activities.",
      capability: "community_activities_context",
      requestCategory: "community_activities",
      presentationId: SOCIAL_SUPPORT_ACTIVITIES_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.summary",
      requiresConfirmation: false,
      riskLevel: "low",
      externalAction: false,
      humanContact: false,
      caregiverAuthority: false,
      parityReference: "voice_action_registry",
    };
  }

  if (hasAny(normalized, COMMUNITY_HOME_TERMS) || normalized === "community" || normalized === "social") {
    return {
      kind: "supported_action",
      actionType: "social.community",
      route: "/social-rooms",
      title: "Community",
      summary: "Open the existing community hub for social rooms and activities.",
      cue: "Open community.",
      capability: "social_community_navigation",
      requestCategory: "community_home",
      presentationId: SOCIAL_SUPPORT_COMMUNITY_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.summary",
      requiresConfirmation: false,
      riskLevel: "low",
      externalAction: false,
      humanContact: false,
      caregiverAuthority: false,
      parityReference: "existing_social_rooms_route",
    };
  }

  return {
    kind: "fallback_to_legacy",
    reasonCode: "social_support_not_recognized",
    presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
    parityReference: "legacy_companion_agent",
  };
}
