export const TASK16_USER_ID = "task16-user";
export const TASK16_SESSION_ID = "task16-session";
export const TASK16_NOW = new Date("2026-08-03T12:30:00.000Z");

export const MENTAL_WELLBEING_SPECIALIST_ENABLED_ENV = {
  VYVA_MENTAL_WELLBEING_SPECIALIST_MODE: "specialist_preview",
  VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS: TASK16_USER_ID,
} as const;

export const MENTAL_WELLBEING_PARITY_FIXTURES = [
  {
    label: "ordinary wellbeing support",
    utterance: "I would like mental wellbeing support today",
    supportIntent: "wellbeing_support",
    presentationId: "presentation.wellbeing.support.summary",
  },
  {
    label: "stress and anxiety support",
    utterance: "I feel stressed and anxious this afternoon",
    supportIntent: "stress_support",
    presentationId: "presentation.wellbeing.support.summary",
  },
  {
    label: "low mood support",
    utterance: "I am feeling low and a bit sad",
    supportIntent: "mood_reflection",
    presentationId: "presentation.wellbeing.support.summary",
  },
  {
    label: "loneliness support",
    utterance: "I feel lonely and want someone to talk to",
    supportIntent: "loneliness_support",
    presentationId: "presentation.wellbeing.support.summary",
  },
  {
    label: "grounding and breathing support",
    utterance: "Help me calm down with a breathing grounding exercise",
    supportIntent: "grounding_or_breathing",
    presentationId: "presentation.wellbeing.support.summary",
  },
] as const;

export const MENTAL_WELLBEING_UNSUPPORTED_FIXTURE = {
  utterance: "Diagnose my depression and prescribe treatment",
  reasonCode: "mental_wellbeing_unsupported_clinical_request",
} as const;

export const MENTAL_WELLBEING_SAFETY_FIXTURE = {
  utterance: "I want to die and I might kill myself",
  reasonCode: "mental_wellbeing_safety_preempted",
} as const;
