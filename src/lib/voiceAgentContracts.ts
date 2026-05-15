import type { VoiceAppActionDomain } from "@/lib/voiceNavigation";

export type VoiceAgentDomain = VoiceAppActionDomain | "doctor" | "companion";

export type VoiceAgentContract = {
  id: string;
  name: string;
  domain: VoiceAgentDomain;
  agentSlug?: string;
  entrypoints: string[];
  planIds: string[];
  startsFrom: string[];
  requiredContextKeys: string[];
  optionalContextKeys: string[];
  actionTypes: string[];
  handoffDomains: VoiceAgentDomain[];
  notes: string;
};

export type VoiceContextValidation = {
  status: "ready" | "missing_required" | "idle";
  presentRequiredKeys: string[];
  missingRequiredKeys: string[];
  presentOptionalKeys: string[];
  availableKeys: string[];
  coveragePct: number;
};

export type VoiceContextVariables = Record<string, string | number | boolean | null | undefined>;

const BASE_REQUIRED_KEYS = [
  "agent_operating_rules",
  "conversation_plan_id",
  "conversation_plan_goal",
  "conversation_plan_steps",
  "profile_summary",
  "first_name",
];

const COMMON_OPTIONAL_KEYS = [
  "preferred_name",
  "memory_block",
  "next_best_conversation",
  "next_best_conversation_title",
  "next_best_conversation_reason",
  "next_best_conversation_opening_cue",
  "voice_app_action_tool",
  "voice_action_result_tool",
  "voice_specialist_transfer_tool",
  "communication_preferences",
  "app_entrypoint",
];

export const VOICE_AGENT_CONTRACTS: VoiceAgentContract[] = [
  {
    id: "main_vyva",
    name: "Main VYVA",
    domain: "companion",
    entrypoints: ["home_open", "app_open", "manual_talk_button"],
    planIds: ["main_vyva_first_welcome_tour", "main_vyva_returning_app_open"],
    startsFrom: ["Home voice hero", "App-open prompt-first CTA", "Global VYVA talk controls"],
    requiredContextKeys: [
      ...BASE_REQUIRED_KEYS,
      "conversation_plan_opening_instruction",
      "is_first_voice_session",
      "orchestrator_context",
      "app_insight_context",
    ],
    optionalContextKeys: [
      ...COMMON_OPTIONAL_KEYS,
      "preference_context",
      "birthday_context",
      "upcoming_events",
      "recent_activity_summary",
      "social_activity_summary",
      "nearby_events_of_interest",
      "matching_social_rooms",
      "time_since_last_app_visit",
      "time_since_last_voice_session",
      "last_visit_activity",
      "tour_steps",
    ],
    actionTypes: [
      "meds.management",
      "meds.inventory_report",
      "health.vitals_review",
      "health.doctor_support",
      "concierge.task",
      "brain.activity",
      "social.rooms",
      "safety.support",
    ],
    handoffDomains: ["safety", "meds", "health", "doctor", "concierge", "brain_coach", "social"],
    notes: "Orchestrates the app opening and transfers to specialists when the user's goal belongs elsewhere.",
  },
  {
    id: "health_assistant",
    name: "Health Assistant",
    domain: "health",
    agentSlug: "health",
    entrypoints: ["health", "voice_specialist_transfer"],
    planIds: ["health_assistant_session"],
    startsFrom: ["Health page", "Vitals page", "Symptom support", "Main VYVA handoff"],
    requiredContextKeys: [
      ...BASE_REQUIRED_KEYS,
      "health_profile_summary",
      "health_context",
      "latest_vitals_scan",
      "vitals_trend",
      "latest_symptom_report",
      "medications",
      "medication_adherence_summary",
      "medication_interaction_context",
      "next_best_conversation",
      "next_best_conversation_opening_cue",
    ],
    optionalContextKeys: [
      ...COMMON_OPTIONAL_KEYS,
      "allergies",
      "health_conditions",
      "devices",
      "recent_health_events",
      "latest_medical_visit",
      "upcoming_medical_appointment",
      "gp_details",
      "providers",
      "care_team",
      "emergency_contact",
    ],
    actionTypes: ["health.vitals_review", "health.doctor_support", "health.symptom_support", "reports.history"],
    handoffDomains: ["safety", "meds", "concierge", "companion"],
    notes: "Uses profile, symptoms, vitals, meds, allergies, GP, providers, and care-team context without diagnosing.",
  },
  {
    id: "meds_specialist",
    name: "Medication Specialist",
    domain: "meds",
    agentSlug: "meds",
    entrypoints: ["meds", "voice_specialist_transfer"],
    planIds: ["default_specialist_session"],
    startsFrom: ["Meds page", "Adherence report", "Medication action card", "Main VYVA handoff"],
    requiredContextKeys: [
      ...BASE_REQUIRED_KEYS,
      "medications",
      "medication_adherence_summary",
      "medication_interaction_context",
      "next_best_conversation",
      "next_best_conversation_opening_cue",
    ],
    optionalContextKeys: [
      ...COMMON_OPTIONAL_KEYS,
      "allergies",
      "health_conditions",
      "gp_details",
      "providers",
      "recent_health_events",
    ],
    actionTypes: ["meds.management", "meds.inventory_report"],
    handoffDomains: ["safety", "health", "doctor", "concierge"],
    notes: "Owns medication schedule, adherence, stock/refill prompts, and pharmacist/GP escalation cues.",
  },
  {
    id: "concierge_specialist",
    name: "Concierge",
    domain: "concierge",
    agentSlug: "concierge",
    entrypoints: ["concierge", "voice_specialist_transfer"],
    planIds: ["default_specialist_session"],
    startsFrom: ["Concierge page", "Appointment task", "Shopping/transport/task action", "Main VYVA handoff"],
    requiredContextKeys: [
      ...BASE_REQUIRED_KEYS,
      "location_context",
      "communication_preferences",
      "next_best_conversation",
      "next_best_conversation_opening_cue",
    ],
    optionalContextKeys: [
      ...COMMON_OPTIONAL_KEYS,
      "gp_details",
      "providers",
      "care_team",
      "upcoming_events",
      "nearby_events_of_interest",
      "recent_activity_summary",
    ],
    actionTypes: ["concierge.appointment_help", "concierge.task"],
    handoffDomains: ["safety", "health", "meds", "companion"],
    notes: "Prepares practical next steps, drafts tasks, and requires tap confirmation before acting.",
  },
  {
    id: "safety_specialist",
    name: "Safety Specialist",
    domain: "safety",
    agentSlug: "safety",
    entrypoints: ["safe_home", "scam_guard", "voice_specialist_transfer"],
    planIds: ["default_specialist_session"],
    startsFrom: ["Safe Home", "Scam Guard", "SOS/safety action", "Urgent VYVA handoff"],
    requiredContextKeys: [
      ...BASE_REQUIRED_KEYS,
      "safety_context",
      "emergency_contact",
      "care_team",
      "next_best_conversation",
      "next_best_conversation_opening_cue",
    ],
    optionalContextKeys: [
      ...COMMON_OPTIONAL_KEYS,
      "location_context",
      "health_context",
      "recent_health_events",
      "communication_preferences",
    ],
    actionTypes: ["safety.support", "safety.scam_support"],
    handoffDomains: ["health", "doctor", "concierge", "companion"],
    notes: "Prioritises immediate safety, scam protection, emergency guidance, and tap-confirmed escalation.",
  },
  {
    id: "brain_coach",
    name: "Brain Coach",
    domain: "brain_coach",
    agentSlug: "brain-coach",
    entrypoints: ["activities", "memory_games", "voice_specialist_transfer"],
    planIds: ["default_specialist_session"],
    startsFrom: ["Activities", "Memory games", "Brain-game companion toggle", "Main VYVA handoff"],
    requiredContextKeys: [
      ...BASE_REQUIRED_KEYS,
      "cognitive_context",
      "next_best_conversation",
      "next_best_conversation_opening_cue",
    ],
    optionalContextKeys: [
      ...COMMON_OPTIONAL_KEYS,
      "preference_context",
      "recent_activity_summary",
      "social_context",
      "health_context",
    ],
    actionTypes: ["brain.activity", "brain.memory_game"],
    handoffDomains: ["safety", "health", "companion", "social"],
    notes: "Keeps encouragement available during games and uses ability/preferences without over-medicalising play.",
  },
  {
    id: "companion_social",
    name: "Companion / Social",
    domain: "social",
    agentSlug: "companion",
    entrypoints: ["social_rooms", "companions", "voice_specialist_transfer"],
    planIds: ["default_specialist_session"],
    startsFrom: ["Social rooms", "Companion conversations", "Interest-based room handoff"],
    requiredContextKeys: [
      ...BASE_REQUIRED_KEYS,
      "social_context",
      "preference_context",
      "next_best_conversation",
      "next_best_conversation_opening_cue",
    ],
    optionalContextKeys: [
      ...COMMON_OPTIONAL_KEYS,
      "matching_social_rooms",
      "social_activity_summary",
      "hobbies",
      "interests",
      "birthday_context",
      "nearby_events_of_interest",
    ],
    actionTypes: ["social.rooms"],
    handoffDomains: ["safety", "health", "concierge", "brain_coach"],
    notes: "Uses hobbies, interests, social rooms, preferences, and relationship continuity for companionship.",
  },
];

const CONTRACT_BY_DOMAIN = new Map(VOICE_AGENT_CONTRACTS.map((contract) => [contract.domain, contract]));
const CONTRACT_BY_SLUG = new Map(
  VOICE_AGENT_CONTRACTS.flatMap((contract) => contract.agentSlug ? [[contract.agentSlug, contract] as const] : []),
);

export function voiceAgentContractFor(input: {
  domain?: string;
  agentSlug?: string;
  conversationPlanId?: string;
}) {
  const slugMatch = input.agentSlug ? CONTRACT_BY_SLUG.get(input.agentSlug) : undefined;
  if (slugMatch) return slugMatch;

  const domainMatch = input.domain ? CONTRACT_BY_DOMAIN.get(input.domain as VoiceAgentDomain) : undefined;
  if (domainMatch) return domainMatch;

  const planMatch = input.conversationPlanId
    ? VOICE_AGENT_CONTRACTS.find((contract) => contract.planIds.includes(input.conversationPlanId ?? ""))
    : undefined;
  return planMatch ?? VOICE_AGENT_CONTRACTS[0];
}

export function hasContextValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function validateVoiceAgentContext(
  contract: VoiceAgentContract,
  variables: VoiceContextVariables | null | undefined,
): VoiceContextValidation {
  const safeVariables = variables ?? {};
  const availableKeys = Object.entries(safeVariables)
    .filter(([, value]) => hasContextValue(value))
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));
  const availableKeySet = new Set(availableKeys);
  const presentRequiredKeys = contract.requiredContextKeys.filter((key) => availableKeySet.has(key));
  const missingRequiredKeys = contract.requiredContextKeys.filter((key) => !availableKeySet.has(key));
  const presentOptionalKeys = contract.optionalContextKeys.filter((key) => availableKeySet.has(key));
  const coveragePct = contract.requiredContextKeys.length === 0
    ? 100
    : Math.round((presentRequiredKeys.length / contract.requiredContextKeys.length) * 100);

  return {
    status: availableKeys.length === 0
      ? "idle"
      : missingRequiredKeys.length > 0
        ? "missing_required"
        : "ready",
    presentRequiredKeys,
    missingRequiredKeys,
    presentOptionalKeys,
    availableKeys,
    coveragePct,
  };
}
