import {
  HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
  type HealthVoiceScreenSyncAnswers,
  type HealthVoiceScreenSyncOption,
  type HealthVoiceScreenSyncQuestion,
  type HealthVoiceScreenSyncStep,
} from "@/lib/healthVoiceScreenSync";

export type CheckInFlowStatus = "welcome" | "question" | "analyzing" | "result" | "safety";
export type CheckInAnswerModality = "voice" | "touch";

export type CheckInFlowOption = {
  id: string;
  label: string;
  helper?: string;
  value?: string | number;
  selected?: boolean;
};

export type CheckInFlowQuestion = {
  id: string;
  title: string;
  helperText?: string;
  options: CheckInFlowOption[];
};

export type CheckInFlowState = {
  flowId: typeof HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID;
  step: HealthVoiceScreenSyncStep | "welcome" | "analyzing" | "result";
  status: CheckInFlowStatus;
  sceneId?: string;
  sceneInstanceId?: string;
  questionId?: string;
  revision?: number;
  progress?: {
    current: number;
    total: number;
    label: string;
  };
  currentQuestion?: CheckInFlowQuestion;
  answers: HealthVoiceScreenSyncAnswers;
  source: "local_fixture_adapter";
};

export type CheckInFlowActions = {
  start: () => void;
  goBack: () => void;
  answer: (optionId: string, modality: CheckInAnswerModality) => void;
  next: () => void;
  openSafety: () => void;
};

export type CheckInFlowAdapter = {
  flowState: CheckInFlowState;
  actions: CheckInFlowActions;
};

function copyOption(option: HealthVoiceScreenSyncOption): CheckInFlowOption {
  return {
    id: option.id,
    label: option.label,
    helper: option.helper,
    value: option.value,
    selected: option.selected,
  };
}

function copyAnswers(answers: HealthVoiceScreenSyncAnswers): HealthVoiceScreenSyncAnswers {
  return {
    ...answers,
    body_areas: [...answers.body_areas],
    symptoms: [...answers.symptoms],
    symptom_details: [...answers.symptom_details],
    safety_flags: [...answers.safety_flags],
  };
}

export function checkInFlowStateFromHealthQuestion(input: {
  question: HealthVoiceScreenSyncQuestion;
  answers: HealthVoiceScreenSyncAnswers;
}): CheckInFlowState {
  const { question, answers } = input;

  return {
    flowId: HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
    step: question.step,
    status: question.step === "safety" ? "safety" : "question",
    sceneId: question.sceneId,
    sceneInstanceId: question.sceneInstanceId,
    questionId: question.questionId,
    revision: question.revision,
    progress: question.progress,
    currentQuestion: {
      id: question.questionId,
      title: question.title,
      helperText: question.helperText,
      options: question.options.map(copyOption),
    },
    answers: copyAnswers(answers),
    source: "local_fixture_adapter",
  };
}

export function staticCheckInFlowState(input: {
  step: CheckInFlowState["step"];
  status: CheckInFlowStatus;
  answers: HealthVoiceScreenSyncAnswers;
}): CheckInFlowState {
  return {
    flowId: HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
    step: input.step,
    status: input.status,
    answers: copyAnswers(input.answers),
    source: "local_fixture_adapter",
  };
}

export function checkInFlowStatusForStep(step: CheckInFlowState["step"]): CheckInFlowStatus {
  if (step === "welcome") return "welcome";
  if (step === "analyzing") return "analyzing";
  if (step === "result") return "result";
  if (step === "safety") return "safety";
  return "question";
}

export function createCheckInFlowAdapter(input: {
  activeQuestion: HealthVoiceScreenSyncQuestion | null;
  answers: HealthVoiceScreenSyncAnswers;
  step: CheckInFlowState["step"];
  actions: CheckInFlowActions;
}): CheckInFlowAdapter {
  return {
    flowState: input.activeQuestion
      ? checkInFlowStateFromHealthQuestion({
          question: input.activeQuestion,
          answers: input.answers,
        })
      : staticCheckInFlowState({
          step: input.step,
          status: checkInFlowStatusForStep(input.step),
          answers: input.answers,
        }),
    actions: input.actions,
  };
}
