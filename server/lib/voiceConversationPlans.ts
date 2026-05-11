import type { AgentPolicyDomain } from "./voiceAgentPolicy.js";

export type VoiceConversationPlanId =
  | "main_vyva_first_welcome_tour"
  | "main_vyva_returning_app_open"
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
    "This is the user's first recorded VYVA voice session. Greet them warmly, use their first name if available, explain in one sentence that VYVA can help coordinate health, medication, activities, social connection, safety, and everyday tasks, then ask if they would like a short tour.",
  steps: [
    "Greet the user by preferred name or first name when available.",
    "Briefly introduce VYVA as the app's coordinating voice assistant.",
    "Mention one or two relevant areas from profile context, without exposing sensitive details unless the user raises them.",
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
    "This is a returning VYVA voice session. Greet briefly, use the user's name if available, acknowledge relevant memory or app context when useful, then suggest one helpful next action and invite the user to choose.",
  steps: [
    "Greet the user briefly by preferred name or first name when available.",
    "Use memory, last topic, or profile context to make the opening feel continuous.",
    "Suggest one useful next action based on the current app entry point and available context.",
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
    "first_name",
    "is_first_voice_session",
  ],
  optional_keys: [
    "preferred_name",
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
    "Use the selected specialist domain, profile context, memory, and app insight to help with the user's current request.",
  steps: [
    "Recognise the user using profile context.",
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
  ],
  optional_keys: [
    "memory_block",
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
