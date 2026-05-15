import type { AgentPolicyDomain } from "./voiceAgentPolicy.js";

export type VoiceConversationPlanId =
  | "main_vyva_first_welcome_tour"
  | "main_vyva_returning_app_open"
  | "health_assistant_session"
  | "default_specialist_session";

export type VoiceConversationPlan = {
  plan_id: VoiceConversationPlanId;
  agent_domain: AgentPolicyDomain;
  goal: string;
  opening_instruction: string;
  steps: string[];
  required_keys: string[];
  optional_keys: string[];
  success_criteria: string[];
  transfer_rules: string[];
  tour_available: boolean;
  tour_steps: string[];
};

type PlanSelectionInput = {
  domain: AgentPolicyDomain;
  appEntrypoint?: string;
  priorVoiceExchangeCount?: number;
};

const APP_TOUR_STEPS = [
  "Home: show today's suggested actions and the main VYVA conversation entry point.",
  "Health: review symptoms, vitals, reports, GP details, providers, allergies, and care context.",
  "Meds: review medication schedules, adherence, missed doses, and prescription-related questions.",
  "Activities: start memory games and brain-coach exercises.",
  "Social rooms: join interest-based rooms and personalised companion conversations.",
  "Concierge: plan appointments, transport, shopping, reminders, and practical tasks.",
  "SOS: use the central safety entry point for urgent help, falls, scams, or emergency concerns.",
];

const MAIN_VYVA_FIRST_WELCOME_TOUR: VoiceConversationPlan = {
  plan_id: "main_vyva_first_welcome_tour",
  agent_domain: "companion",
  goal: "Welcome the user into VYVA, identify them from profile context if available, and ask whether they want a short tour of the app.",
  opening_instruction:
    "This is the user's first recorded VYVA voice session. Greet them warmly, use their first name if available, use profile and preference context lightly, explain in one sentence that VYVA can help coordinate health, medication, activities, social connection, safety, and everyday tasks, then ask if they would like a short tour.",
  steps: [
    "Greet the user by preferred name or first name when available.",
    "Briefly introduce VYVA as the app's coordinating voice assistant.",
    "Mention one or two relevant areas from profile, hobbies, interests, or app insight, without exposing sensitive details unless the user raises them.",
    "Ask whether the user would like a short tour now.",
    "If yes, give a concise tour using the available tour steps and pause for the user's preference.",
    "If no, ask what they would like help with today.",
  ],
  required_keys: [
    "agent_operating_rules",
    "conversation_plan_id",
    "conversation_plan_goal",
    "conversation_plan_opening_instruction",
    "conversation_plan_steps",
    "profile_summary",
    "first_name",
    "is_first_voice_session",
    "tour_steps",
  ],
  optional_keys: [
    "preferred_name",
    "memory_block",
    "next_best_conversation",
    "next_best_conversation_title",
    "next_best_conversation_reason",
    "next_best_conversation_opening_cue",
    "next_best_conversation_feedback",
    "voice_recommendation_feedback_tool",
    "orchestrator_context",
    "app_insight_context",
    "preference_context",
    "birthday_context",
    "upcoming_events",
    "recent_activity_summary",
    "social_activity_summary",
    "nearby_events_of_interest",
    "matching_social_rooms",
    "time_since_last_app_visit",
    "social_context",
    "health_context",
    "location_context",
    "communication_preferences",
    "app_entrypoint",
  ],
  success_criteria: [
    "The user understands what VYVA can help with.",
    "The user is asked whether they want a tour.",
    "The conversation feels personal without revealing sensitive details unprompted.",
    "The user is guided to either a tour or their chosen next task.",
  ],
  transfer_rules: [
    "Transfer to safety for urgent risk, falls, scams, crisis language, or emergency concerns.",
    "Transfer to meds for medication schedules, doses, prescriptions, side effects, or adherence.",
    "Transfer to health or doctor for symptoms, vitals, allergies, medical history, or clinical concerns.",
    "Transfer to concierge for appointments, transport, reminders, shopping, bookings, weather, or logistics.",
    "Transfer to brain coach for cognitive activities, quizzes, games, and memory practice.",
    "Use companion/social flow for conversation, hobbies, stories, interests, loneliness, and social rooms.",
  ],
  tour_available: true,
  tour_steps: APP_TOUR_STEPS,
};

const MAIN_VYVA_RETURNING_APP_OPEN: VoiceConversationPlan = {
  plan_id: "main_vyva_returning_app_open",
  agent_domain: "companion",
  goal: "Restart the relationship naturally, use memory and app context, and suggest the most useful next action.",
  opening_instruction:
    "This is a returning VYVA voice session. Greet briefly, use the user's name if available, use the next best conversation recommendation as the primary opening guide, then use relationship continuity, memory, app insight, preferences, recent activity, social context, and upcoming events to support one useful next action.",
  steps: [
    "Greet the user briefly by preferred name or first name when available.",
    "Review next_best_conversation first and treat it as the ranked recommendation for what VYVA should offer now.",
    "Use memory, last topic, time since last session, preferences, or app activity to make the opening feel continuous.",
    "Suggest one useful next action based on the current app entry point, next best recommendation, app insight, and available context.",
    "Use hobbies, interests, social rooms, upcoming events, and birthday context only when relevant and natural.",
    "For nearby events or places, offer Concierge verification instead of inventing names, times, prices, or venues.",
    "If the next best recommendation belongs to a specialist domain, offer a VYVA handoff rather than acting as that specialist.",
    "Ask a simple choice question so the user can continue, redirect, or request a specialist.",
  ],
  required_keys: [
    "agent_operating_rules",
    "conversation_plan_id",
    "conversation_plan_goal",
    "conversation_plan_opening_instruction",
    "conversation_plan_steps",
    "profile_summary",
    "memory_block",
    "next_best_conversation",
    "next_best_conversation_title",
    "next_best_conversation_reason",
    "next_best_conversation_opening_cue",
    "next_best_conversation_suggested_action",
    "orchestrator_context",
    "app_insight_context",
    "last_visit_activity",
    "time_since_last_voice_session",
    "first_name",
    "is_first_voice_session",
  ],
  optional_keys: [
    "preferred_name",
    "preference_context",
    "personalisation_opportunities",
    "next_best_conversation_candidates",
    "next_best_conversation_domain",
    "next_best_conversation_priority",
    "next_best_conversation_feedback",
    "voice_recommendation_feedback_tool",
    "birthday_context",
    "upcoming_events",
    "recent_activity_summary",
    "social_activity_summary",
    "nearby_events_of_interest",
    "matching_social_rooms",
    "time_since_last_app_visit",
    "social_context",
    "health_context",
    "location_context",
    "communication_preferences",
    "app_entrypoint",
    "last_topic",
  ],
  success_criteria: [
    "The user is greeted without repeating the first-time tour by default.",
    "The opening references relevant context naturally when available.",
    "The user receives one clear, useful next suggestion.",
    "The user can ask for any specialist without confusion.",
  ],
  transfer_rules: MAIN_VYVA_FIRST_WELCOME_TOUR.transfer_rules,
  tour_available: true,
  tour_steps: APP_TOUR_STEPS,
};

const DEFAULT_SPECIALIST_SESSION: VoiceConversationPlan = {
  plan_id: "default_specialist_session",
  agent_domain: "companion",
  goal: "Continue a focused specialist conversation using the supplied user context.",
  opening_instruction:
    "Use the selected specialist domain, next best conversation recommendation, profile context, memory, and app insight to help with the user's current request.",
  steps: [
    "Recognise the user using profile context.",
    "Review next_best_conversation first and use it as the specialist's recommended opening focus.",
    "Acknowledge the likely goal and confirm it briefly.",
    "Use relevant app insight and memory before asking for missing details.",
    "Give one clear next step or continue the planned conversation.",
    "Stay inside the selected specialist domain and request a VYVA transfer when the topic changes.",
  ],
  required_keys: [
    "agent_operating_rules",
    "conversation_plan_id",
    "conversation_plan_goal",
    "conversation_plan_steps",
    "profile_summary",
    "first_name",
    "next_best_conversation",
    "next_best_conversation_opening_cue",
  ],
  optional_keys: [
    "memory_block",
    "next_best_conversation_title",
    "next_best_conversation_reason",
    "next_best_conversation_suggested_action",
    "next_best_conversation_feedback",
    "voice_recommendation_feedback_tool",
    "health_context",
    "social_context",
    "location_context",
    "communication_preferences",
    "safety_context",
  ],
  success_criteria: [
    "The specialist uses relevant context without asking repeat questions.",
    "The answer stays within the selected domain.",
    "The user receives a clear next step.",
  ],
  transfer_rules: [
    "If the topic changes domain, pause and ask VYVA to transfer rather than acting as every agent.",
    "Always escalate safety, crisis, fall, scam, or emergency concerns to the safety flow.",
  ],
  tour_available: false,
  tour_steps: [],
};

const HEALTH_ASSISTANT_SESSION: VoiceConversationPlan = {
  plan_id: "health_assistant_session",
  agent_domain: "health",
  goal:
    "Use the user's current health profile, recent app insight, memory, vitals, symptoms, medication context, and care details to provide a personalised health-support conversation without diagnosing.",
  opening_instruction:
    "Start by recognising the user from profile context, then use the next best conversation recommendation and freshest health snapshot before asking questions. If recent vitals, symptoms, medication adherence, or GP/care-team context is available, refer to one relevant point naturally and ask what they would like help with today.",
  steps: [
    "Identify the user using preferred name, first name, language, and relevant communication preferences.",
    "Review next_best_conversation first and use it to decide whether to open with vitals, symptoms, medication context, appointment prep, or a general health check-in.",
    "Review health profile, latest vitals scan, latest symptom report, medication list, adherence summary, allergies, GP, providers, care team, and memory before asking for repeated details.",
    "Ask one focused question at a time when information is missing, especially symptom timing, severity, change from baseline, and current safety risk.",
    "Use vitals and symptom trends as context, not as a diagnosis. Explain uncertainty clearly and encourage GP/pharmacist review where appropriate.",
    "For medication interactions, side effects, missed doses, adherence, or prescription questions, use medication context and hand off to the meds specialist when the conversation needs medication management.",
    "For urgent red flags, chest pain, severe breathing trouble, sudden weakness, confusion, fainting, severe allergic reaction, falls, or crisis language, stop normal coaching and route to safety/emergency guidance.",
    "Summarise the agreed next step, such as monitoring, symptom report, vitals scan, GP prep, pharmacist check, care-team update, or VYVA transfer.",
  ],
  required_keys: [
    "agent_operating_rules",
    "conversation_plan_id",
    "conversation_plan_goal",
    "conversation_plan_opening_instruction",
    "conversation_plan_steps",
    "profile_summary",
    "health_profile_summary",
    "health_context",
    "latest_vitals_scan",
    "vitals_trend",
    "latest_symptom_report",
    "medications",
    "medication_adherence_summary",
    "medication_interaction_context",
    "first_name",
    "next_best_conversation",
    "next_best_conversation_opening_cue",
  ],
  optional_keys: [
    "preferred_name",
    "next_best_conversation_title",
    "next_best_conversation_reason",
    "next_best_conversation_suggested_action",
    "next_best_conversation_feedback",
    "voice_recommendation_feedback_tool",
    "allergies",
    "health_conditions",
    "devices",
    "recent_health_events",
    "recent_symptom_reports",
    "latest_medical_visit",
    "upcoming_medical_appointment",
    "gp_details",
    "providers",
    "care_team",
    "emergency_contact",
    "memory_block",
    "health_session_context",
    "medical_profile_last_updated",
  ],
  success_criteria: [
    "The user is recognised and the conversation feels continuous.",
    "The agent uses current health context before asking repeat questions.",
    "Vitals, symptoms, medications, allergies, GP, care team, and app insight are used safely and only when relevant.",
    "The agent avoids diagnosis and gives clear next-step support.",
    "Safety, medication, concierge, and orchestrator handoffs are used when the need belongs elsewhere.",
  ],
  transfer_rules: [
    "Transfer to safety immediately for emergency symptoms, falls, crisis language, severe allergic reaction, chest pain, severe shortness of breath, sudden weakness, confusion, fainting, or acute danger.",
    "Transfer to meds for medication schedules, missed doses, prescriptions, adherence, side effects, or interaction checks.",
    "Transfer to concierge for booking appointments, transport, pharmacy calls, provider contact, reminders, or admin logistics.",
    "Transfer to VYVA orchestrator when the user asks for a non-health topic.",
  ],
  tour_available: false,
  tour_steps: [],
};

function isAppOpenEntrypoint(value?: string) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "app_open" || normalized === "home_open";
}

export function selectVoiceConversationPlan(input: PlanSelectionInput): VoiceConversationPlan {
  if (input.domain === "companion" && isAppOpenEntrypoint(input.appEntrypoint)) {
    return (input.priorVoiceExchangeCount ?? 0) === 0
      ? MAIN_VYVA_FIRST_WELCOME_TOUR
      : MAIN_VYVA_RETURNING_APP_OPEN;
  }

  if (input.domain === "health" || input.domain === "doctor") {
    return {
      ...HEALTH_ASSISTANT_SESSION,
      agent_domain: input.domain,
    };
  }

  return {
    ...DEFAULT_SPECIALIST_SESSION,
    agent_domain: input.domain,
  };
}

export function formatPlanList(values: string[]) {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

export function conversationPlanToVariables(plan: VoiceConversationPlan) {
  return {
    conversation_plan_id: plan.plan_id,
    conversation_plan_goal: plan.goal,
    conversation_plan_steps: formatPlanList(plan.steps),
    conversation_plan_opening_instruction: plan.opening_instruction,
    conversation_plan_required_keys: plan.required_keys.join(", "),
    conversation_plan_optional_keys: plan.optional_keys.join(", "),
    conversation_plan_success_criteria: formatPlanList(plan.success_criteria),
    conversation_plan_transfer_rules: formatPlanList(plan.transfer_rules),
    tour_available: plan.tour_available,
    tour_steps: plan.tour_steps.length ? formatPlanList(plan.tour_steps) : "",
  };
}

export function formatConversationPlanPrompt(plan: VoiceConversationPlan) {
  return [
    `Plan ID: ${plan.plan_id}`,
    `Goal: ${plan.goal}`,
    `Opening instruction: ${plan.opening_instruction}`,
    `Steps:\n${formatPlanList(plan.steps)}`,
    `Required keys: ${plan.required_keys.join(", ")}`,
    `Optional keys: ${plan.optional_keys.join(", ")}`,
    `Success criteria:\n${formatPlanList(plan.success_criteria)}`,
    `Transfer rules:\n${formatPlanList(plan.transfer_rules)}`,
    plan.tour_available ? `Tour steps:\n${formatPlanList(plan.tour_steps)}` : "",
  ].filter(Boolean).join("\n");
}
