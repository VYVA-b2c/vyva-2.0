export const HIP_24H_STEP_ID = "24h_transition_check";
const DEFAULT_HIP_24H_WHATSAPP_FROM = "+15558003512";

export const HIP_24H_QUESTIONS_EN = [
  { id: "q1", prompt: "Do you have your hospital discharge plan and medicines list?", type: "yes_no" as const, required: true },
  { id: "q2", prompt: "Have you been able to take your medicines exactly as listed by the hospital?", type: "yes_no" as const, required: true },
  { id: "q3", prompt: "Are you able to move using the equipment and weight-bearing instructions in your discharge plan?", type: "yes_no" as const, required: true },
  { id: "q4", prompt: "Is the support arranged for you at home available?", type: "yes_no" as const, required: true },
  { id: "q5", prompt: "Do you have any warning sign listed in your hospital discharge plan?", type: "yes_no" as const, required: true },
] as const;

const DEFAULT_TEMPLATE_SIDS = {
  1: "HX90de51ebab2825a1ab114a914dfea261",
  2: "HX4adfb557d7d6c430a6667410a76515f9",
  3: "HX278a1ce9f8a56e5d3ffc37041135043c",
  4: "HXfcd09ee659e8dbe6432128923611dd83",
  5: "HXd70220a7749c1fc20881bdf14c3e9629",
} as const;

const TEMPLATE_ENV_KEYS = {
  1: "TWILIO_WHATSAPP_HIP_24H_Q1_TEMPLATE_EN",
  2: "TWILIO_WHATSAPP_HIP_24H_Q2_TEMPLATE_EN",
  3: "TWILIO_WHATSAPP_HIP_24H_Q3_TEMPLATE_EN",
  4: "TWILIO_WHATSAPP_HIP_24H_Q4_TEMPLATE_EN",
  5: "TWILIO_WHATSAPP_HIP_24H_Q5_TEMPLATE_EN",
} as const;

export type Hip24hQuestionNumber = 1 | 2 | 3 | 4 | 5;
export type Hip24hAnswer = "yes" | "no";
export type Hip24hQuestionId = `q${Hip24hQuestionNumber}`;

export type Hip24hConversationState = {
  mode: "whatsapp_conversation";
  answers: Partial<Record<Hip24hQuestionId | `${Hip24hQuestionId}_detail`, string>>;
  current_question: Hip24hQuestionNumber;
  awaiting_detail_for: Hip24hQuestionId | null;
  processed_message_sids: string[];
  requires_clinical_review?: boolean;
  escalation_reason?: "warning_sign_reported";
  submitted_at?: string;
  updated_at: string;
};

export type Hip24hTransition = {
  state: Hip24hConversationState;
  reply:
    | { kind: "template"; question: Hip24hQuestionNumber }
    | { kind: "text"; body: string };
  completed: boolean;
  cancelled: boolean;
};

const DETAIL_PROMPTS: Record<Hip24hQuestionId, string> = {
  q1: "Please tell us what is missing.",
  q2: "Please tell us what prevented you.",
  q3: "Please tell us what is making this difficult.",
  q4: "Please tell us what support is unavailable.",
  q5: "Please tell us which warning sign you have.",
};

export const HIP_24H_COMPLETION_MESSAGE = "Thank you. Your responses have been recorded for the care team. This chat is not an emergency service. If you need urgent help, follow the emergency instructions in your hospital discharge plan.";
export const HIP_24H_INVALID_REPLY_MESSAGE = "Please reply Yes or No using the buttons.";
export const HIP_24H_STOP_MESSAGE = "You will not receive further WhatsApp messages for this check-in.";

export function isHip24hDirectPilot(stepId: string, language: string) {
  return stepId === HIP_24H_STEP_ID && language === "en";
}

export function hip24hTemplateSid(question: Hip24hQuestionNumber) {
  return process.env[TEMPLATE_ENV_KEYS[question]]?.trim() || DEFAULT_TEMPLATE_SIDS[question];
}

export function hip24hWhatsappFrom() {
  return process.env.TWILIO_WHATSAPP_HIP_24H_FROM?.trim() || DEFAULT_HIP_24H_WHATSAPP_FROM;
}

export function initialHip24hConversationState(now = new Date()): Hip24hConversationState {
  return {
    mode: "whatsapp_conversation",
    answers: {},
    current_question: 1,
    awaiting_detail_for: null,
    processed_message_sids: [],
    updated_at: now.toISOString(),
  };
}

export function normalizeWhatsappAnswer(
  buttonPayload: string | undefined,
  body: string | undefined,
  question?: Hip24hQuestionNumber,
): Hip24hAnswer | null {
  const payload = buttonPayload?.trim().toLowerCase();
  if (payload) {
    if (question && payload === `24h_q${question}_yes`) return "yes";
    if (question && payload === `24h_q${question}_no`) return "no";
    if (question) return null;
    if (payload.endsWith("_yes")) return "yes";
    if (payload.endsWith("_no")) return "no";
  }
  const text = body?.trim().toLowerCase();
  if (text === "yes") return "yes";
  if (text === "no") return "no";
  return null;
}

export function isWhatsappStop(body: string | undefined) {
  return ["stop", "unsubscribe", "cancel", "end", "quit"].includes(body?.trim().toLowerCase() ?? "");
}

export function advanceHip24hConversation(
  existing: Hip24hConversationState,
  input: { body?: string; buttonPayload?: string },
  now = new Date(),
): Hip24hTransition {
  const state: Hip24hConversationState = {
    ...existing,
    answers: { ...existing.answers },
    processed_message_sids: [...existing.processed_message_sids],
    updated_at: now.toISOString(),
  };

  if (isWhatsappStop(input.body)) {
    return { state, reply: { kind: "text", body: HIP_24H_STOP_MESSAGE }, completed: false, cancelled: true };
  }

  if (state.awaiting_detail_for) {
    if (input.buttonPayload) {
      return { state, reply: { kind: "text", body: DETAIL_PROMPTS[state.awaiting_detail_for] }, completed: false, cancelled: false };
    }
    const detail = input.body?.trim();
    if (!detail) {
      return { state, reply: { kind: "text", body: DETAIL_PROMPTS[state.awaiting_detail_for] }, completed: false, cancelled: false };
    }
    state.answers[`${state.awaiting_detail_for}_detail`] = detail.slice(0, 2_000);
    state.awaiting_detail_for = null;
    if (state.current_question === 5) {
      state.requires_clinical_review = true;
      state.escalation_reason = "warning_sign_reported";
      state.submitted_at = now.toISOString();
      return { state, reply: { kind: "text", body: HIP_24H_COMPLETION_MESSAGE }, completed: true, cancelled: false };
    }
    state.current_question = (state.current_question + 1) as Hip24hQuestionNumber;
    return { state, reply: { kind: "template", question: state.current_question }, completed: false, cancelled: false };
  }

  const answer = normalizeWhatsappAnswer(input.buttonPayload, input.body, state.current_question);
  if (!answer) {
    return { state, reply: { kind: "text", body: HIP_24H_INVALID_REPLY_MESSAGE }, completed: false, cancelled: false };
  }

  const questionId = `q${state.current_question}` as Hip24hQuestionId;
  state.answers[questionId] = answer;
  if (state.current_question === 5 && answer === "yes") {
    state.requires_clinical_review = true;
    state.escalation_reason = "warning_sign_reported";
  }
  const needsDetail = state.current_question === 5 ? answer === "yes" : answer === "no";
  if (needsDetail) {
    state.awaiting_detail_for = questionId;
    return { state, reply: { kind: "text", body: DETAIL_PROMPTS[questionId] }, completed: false, cancelled: false };
  }

  if (state.current_question === 5) {
    state.submitted_at = now.toISOString();
    return { state, reply: { kind: "text", body: HIP_24H_COMPLETION_MESSAGE }, completed: true, cancelled: false };
  }

  state.current_question = (state.current_question + 1) as Hip24hQuestionNumber;
  return { state, reply: { kind: "template", question: state.current_question }, completed: false, cancelled: false };
}
