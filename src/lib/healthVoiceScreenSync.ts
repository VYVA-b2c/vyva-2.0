import type { VoiceCanvasViewModel } from "@/components/voice-canvas";
import type { VoiceCanvasResponseDetail } from "@/lib/voiceCanvasBridge";
import { resolveSymptomAssessmentPresentation } from "@/design/screenPresentation";

export const HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID = "health.preventive_check" as const;
export const HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_OWNER = "health_preventive_check" as const;
export const HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FEATURE_ENDPOINT =
  "/api/config/features/health-preventive-voice-screen-sync" as const;
export const VYVA_HEALTH_VOICE_SCREEN_SYNC_OBSERVATION_EVENT =
  "vyva:health-voice-screen-sync-observation" as const;

export type HealthVoiceScreenSyncStep =
  | "energy"
  | "mood"
  | "body"
  | "sleep"
  | "symptoms"
  | "details"
  | "safety"
  | "social";

export type HealthVoiceScreenSyncAnswerKey =
  | "energy_level"
  | "mood"
  | "body_areas"
  | "sleep_quality"
  | "symptoms"
  | "symptom_details"
  | "safety_flags"
  | "social_contact";

export type HealthVoiceScreenSyncModality = "voice" | "touch";
export type HealthVoiceScreenSyncAnswerMode = "single_option" | "multi_option";

export type HealthVoiceScreenSyncOption = {
  id: string;
  label: string;
  helper?: string;
  value?: string | number;
  selected?: boolean;
};

export type HealthVoiceScreenSyncQuestion = {
  flowId: typeof HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID;
  step: HealthVoiceScreenSyncStep;
  sceneId: string;
  sceneInstanceId: string;
  questionId: string;
  answerKey: HealthVoiceScreenSyncAnswerKey;
  answerMode: HealthVoiceScreenSyncAnswerMode;
  revision: number;
  title: string;
  helperText?: string;
  options: HealthVoiceScreenSyncOption[];
  progress?: {
    current: number;
    total: number;
    label: string;
  };
};

export type HealthVoiceScreenSyncAnswerInput = {
  flowId?: string;
  sceneId: string;
  sceneInstanceId?: string | null;
  questionId?: string;
  revision: number;
  modality: HealthVoiceScreenSyncModality;
  choiceId?: string | null;
  value?: string | number | null;
  utterance?: string | null;
  eventId?: string | null;
  voiceUtteranceId?: string | null;
  at?: string | null;
};

export type CanonicalHealthVoiceScreenSyncAnswer = {
  flowId: typeof HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID;
  sceneId: string;
  sceneInstanceId: string;
  questionId: string;
  answerKey: HealthVoiceScreenSyncAnswerKey;
  answerMode: HealthVoiceScreenSyncAnswerMode;
  revision: number;
  answerId: string;
  answerValue: string | number;
  modality: HealthVoiceScreenSyncModality;
  eventId: string;
  acceptedAt: string;
};

export type HealthVoiceScreenSyncRejectionReason =
  | "flow_mismatch"
  | "stale_scene"
  | "stale_scene_instance"
  | "stale_question"
  | "stale_revision"
  | "answer_not_recognized"
  | "unsupported_modality"
  | "duplicate_event";

export type HealthVoiceScreenSyncAcceptedResult = {
  status: "accepted";
  answer: CanonicalHealthVoiceScreenSyncAnswer;
};

export type HealthVoiceScreenSyncRejectedResult = {
  status: "rejected";
  reason: HealthVoiceScreenSyncRejectionReason;
  flowId: typeof HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID;
  sceneId?: string;
  sceneInstanceId?: string | null;
  questionId?: string;
  revision?: number;
  activeSceneId: string;
  activeSceneInstanceId: string;
  activeQuestionId: string;
  activeRevision: number;
  modality?: HealthVoiceScreenSyncModality;
  eventId: string;
};

export type HealthVoiceScreenSyncNormalizationResult =
  | HealthVoiceScreenSyncAcceptedResult
  | HealthVoiceScreenSyncRejectedResult;

export type HealthVoiceScreenSyncObservation = {
  flowId: typeof HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID;
  sceneId: string;
  sceneInstanceId: string;
  questionId: string;
  revision: number;
  modality?: HealthVoiceScreenSyncModality;
  status: "accepted" | "rejected";
  answerId?: string;
  answerValue?: string | number;
  reason?: HealthVoiceScreenSyncRejectionReason;
  eventId: string;
};

export type HealthVoiceScreenSyncAnswers = {
  energy_level: number | null;
  mood: string | null;
  body_areas: string[];
  sleep_quality: string | null;
  symptoms: string[];
  symptom_details: string[];
  safety_flags: string[];
  social_contact: string | null;
};

const QUESTION_BY_STEP: Record<HealthVoiceScreenSyncStep, {
  questionId: string;
  answerKey: HealthVoiceScreenSyncAnswerKey;
  answerMode: HealthVoiceScreenSyncAnswerMode;
}> = {
  energy: {
    questionId: "health.preventive_check.energy",
    answerKey: "energy_level",
    answerMode: "single_option",
  },
  mood: {
    questionId: "health.preventive_check.mood",
    answerKey: "mood",
    answerMode: "single_option",
  },
  body: {
    questionId: "health.preventive_check.body",
    answerKey: "body_areas",
    answerMode: "multi_option",
  },
  sleep: {
    questionId: "health.preventive_check.sleep",
    answerKey: "sleep_quality",
    answerMode: "single_option",
  },
  symptoms: {
    questionId: "health.preventive_check.symptoms",
    answerKey: "symptoms",
    answerMode: "multi_option",
  },
  details: {
    questionId: "health.preventive_check.details",
    answerKey: "symptom_details",
    answerMode: "multi_option",
  },
  safety: {
    questionId: "health.preventive_check.safety",
    answerKey: "safety_flags",
    answerMode: "multi_option",
  },
  social: {
    questionId: "health.preventive_check.social",
    answerKey: "social_contact",
    answerMode: "single_option",
  },
};

let healthVoiceScreenSyncSessionCounter = 0;

export function createHealthVoiceScreenSyncSessionInstanceId() {
  healthVoiceScreenSyncSessionCounter += 1;
  return `health-voice-screen-sync-session-${healthVoiceScreenSyncSessionCounter}`;
}

export function healthVoiceScreenSyncSceneId(step: HealthVoiceScreenSyncStep) {
  return resolveSymptomAssessmentPresentation(step).voiceSceneId;
}

export function healthVoiceScreenSyncQuestion(input: {
  step: HealthVoiceScreenSyncStep;
  sceneInstanceId: string;
  revision: number;
  title: string;
  helperText?: string;
  options: HealthVoiceScreenSyncOption[];
  progress?: HealthVoiceScreenSyncQuestion["progress"];
}): HealthVoiceScreenSyncQuestion {
  const metadata = QUESTION_BY_STEP[input.step];
  return {
    flowId: HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
    step: input.step,
    sceneId: healthVoiceScreenSyncSceneId(input.step),
    sceneInstanceId: input.sceneInstanceId,
    questionId: metadata.questionId,
    answerKey: metadata.answerKey,
    answerMode: metadata.answerMode,
    revision: input.revision,
    title: input.title,
    helperText: input.helperText,
    options: input.options.map((option) => ({ ...option })),
    progress: input.progress,
  };
}

export function healthVoiceScreenSyncViewModel(question: HealthVoiceScreenSyncQuestion): VoiceCanvasViewModel {
  return {
    sceneId: question.sceneId,
    kind: "choice",
    title: question.title,
    helperText: question.helperText,
    progress: question.progress,
    agentPresence: {
      state: "listening",
      label: "Voice and touch stay together",
      description: "Say or tap the answer shown here.",
      accessibleLabel: "VYVA Health voice and screen synchronization status",
      ariaLive: "polite",
    },
    choices: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      description: option.helper,
      selected: option.selected,
      accessibleLabel: option.helper ? `${option.label}. ${option.helper}` : option.label,
    })),
  };
}

function canonicalText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function candidateEventId(input: HealthVoiceScreenSyncAnswerInput) {
  const explicit = input.eventId?.trim();
  if (explicit) return explicit;
  const voiceUtteranceId = input.modality === "voice"
    ? input.voiceUtteranceId?.trim()
    : "";
  return [
    HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
    input.sceneId,
    input.sceneInstanceId?.trim() ?? "",
    String(input.revision),
    input.modality,
    input.choiceId?.trim() ?? "",
    input.value === undefined || input.value === null ? "" : "value",
    voiceUtteranceId ? `utterance:${voiceUtteranceId}` : "",
    voiceUtteranceId ? "" : input.at?.trim() ?? "",
  ].join(":");
}

function reject(
  activeQuestion: HealthVoiceScreenSyncQuestion,
  input: HealthVoiceScreenSyncAnswerInput,
  reason: HealthVoiceScreenSyncRejectionReason,
): HealthVoiceScreenSyncRejectedResult {
  return {
    status: "rejected",
    reason,
    flowId: HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
    sceneId: input.sceneId,
    sceneInstanceId: input.sceneInstanceId,
    questionId: input.questionId,
    revision: input.revision,
    activeSceneId: activeQuestion.sceneId,
    activeSceneInstanceId: activeQuestion.sceneInstanceId,
    activeQuestionId: activeQuestion.questionId,
    activeRevision: activeQuestion.revision,
    modality: input.modality,
    eventId: candidateEventId(input),
  };
}

export function normalizeHealthVoiceScreenSyncAnswer(
  activeQuestion: HealthVoiceScreenSyncQuestion,
  input: HealthVoiceScreenSyncAnswerInput,
): HealthVoiceScreenSyncNormalizationResult {
  if (input.modality !== "voice" && input.modality !== "touch") {
    return reject(activeQuestion, input, "unsupported_modality");
  }
  if (input.flowId && input.flowId !== HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID) {
    return reject(activeQuestion, input, "flow_mismatch");
  }
  if (input.sceneId !== activeQuestion.sceneId) {
    return reject(activeQuestion, input, "stale_scene");
  }
  if (input.sceneInstanceId !== activeQuestion.sceneInstanceId) {
    return reject(activeQuestion, input, "stale_scene_instance");
  }
  if (input.questionId && input.questionId !== activeQuestion.questionId) {
    return reject(activeQuestion, input, "stale_question");
  }
  if (input.revision !== activeQuestion.revision) {
    return reject(activeQuestion, input, "stale_revision");
  }

  const choiceId = input.choiceId?.trim();
  const valueText = stringValue(input.value);
  const utteranceText = stringValue(input.utterance);
  const canonicalValue = canonicalText(valueText);
  const canonicalUtterance = canonicalText(utteranceText);

  const option = activeQuestion.options.find((candidate) => {
    if (choiceId && candidate.id === choiceId) return true;
    const id = canonicalText(candidate.id.replace(/_/g, " "));
    const label = canonicalText(candidate.label);
    return Boolean(
      (canonicalValue && (canonicalValue === id || canonicalValue === label)) ||
      (canonicalUtterance && (canonicalUtterance === id || canonicalUtterance === label)),
    );
  });

  if (!option) return reject(activeQuestion, input, "answer_not_recognized");

  return {
    status: "accepted",
    answer: {
      flowId: HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
      sceneId: activeQuestion.sceneId,
      sceneInstanceId: activeQuestion.sceneInstanceId,
      questionId: activeQuestion.questionId,
      answerKey: activeQuestion.answerKey,
      answerMode: activeQuestion.answerMode,
      revision: activeQuestion.revision,
      answerId: option.id,
      answerValue: option.value ?? option.id,
      modality: input.modality,
      eventId: candidateEventId(input),
      acceptedAt: input.at?.trim() || new Date().toISOString(),
    },
  };
}

export function applyCanonicalHealthVoiceScreenSyncAnswer(
  answers: HealthVoiceScreenSyncAnswers,
  answer: CanonicalHealthVoiceScreenSyncAnswer,
): HealthVoiceScreenSyncAnswers {
  if (answer.answerMode === "single_option") {
    return {
      ...answers,
      [answer.answerKey]: answer.answerValue,
    };
  }

  const key = answer.answerKey as "body_areas" | "symptoms" | "symptom_details" | "safety_flags";
  const id = answer.answerId;
  const currentValues = answers[key];
  if (id === "ninguno") {
    return { ...answers, [key]: currentValues.includes("ninguno") ? [] : ["ninguno"] };
  }
  const withoutNone = currentValues.filter((value) => value !== "ninguno");
  return {
    ...answers,
    [key]: withoutNone.includes(id)
      ? withoutNone.filter((value) => value !== id)
      : [...withoutNone, id],
  };
}

export function observationForHealthVoiceScreenSyncResult(
  result: HealthVoiceScreenSyncNormalizationResult,
): HealthVoiceScreenSyncObservation {
  if (result.status === "accepted") {
    return {
      flowId: result.answer.flowId,
      sceneId: result.answer.sceneId,
      sceneInstanceId: result.answer.sceneInstanceId,
      questionId: result.answer.questionId,
      revision: result.answer.revision,
      modality: result.answer.modality,
      status: "accepted",
      answerId: result.answer.answerId,
      answerValue: result.answer.answerValue,
      eventId: result.answer.eventId,
    };
  }
  return {
    flowId: result.flowId,
    sceneId: result.sceneId ?? result.activeSceneId,
    sceneInstanceId: result.sceneInstanceId ?? result.activeSceneInstanceId,
    questionId: result.questionId ?? result.activeQuestionId,
    revision: result.revision ?? result.activeRevision,
    modality: result.modality,
    status: "rejected",
    reason: result.reason,
    eventId: result.eventId,
  };
}

export function dispatchHealthVoiceScreenSyncObservation(
  result: HealthVoiceScreenSyncNormalizationResult,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<HealthVoiceScreenSyncObservation>(
    VYVA_HEALTH_VOICE_SCREEN_SYNC_OBSERVATION_EVENT,
    { detail: observationForHealthVoiceScreenSyncResult(result) },
  ));
}

export function healthVoiceScreenSyncInputFromCanvasResponse(
  response: VoiceCanvasResponseDetail,
): HealthVoiceScreenSyncAnswerInput {
  const stableVoiceUtteranceId = response.voiceUtteranceId?.trim();
  return {
    flowId: HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
    sceneId: response.sceneId,
    sceneInstanceId: response.sceneInstanceId,
    questionId: response.questionId,
    revision: response.revision,
    modality: "voice",
    choiceId: response.choiceId,
    value: response.value,
    utterance: response.utterance,
    at: response.at,
    voiceUtteranceId: stableVoiceUtteranceId,
    eventId: [
      "voice-canvas",
      response.sceneId,
      response.sceneInstanceId ?? "",
      String(response.revision),
      response.choiceId ?? "",
      response.kind,
      stableVoiceUtteranceId || response.at,
    ].join(":"),
  };
}
