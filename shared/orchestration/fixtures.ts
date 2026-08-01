import type { InteractionEvent } from "./events";
import type {
  AnswerSubmission,
  ExpectedFlowInput,
  FlowState,
  FlowTransition,
} from "./flowState";

export const interactionEventFixture: InteractionEvent = {
  eventId: "evt-001",
  eventType: "USER_SPOKE",
  occurredAt: "2026-07-31T10:00:00.000Z",
  source: "voice",
  userId: "user-123",
  profileId: "profile-123",
  sessionId: "session-001",
  flowId: "health.preventive-check",
  flowVersion: "1",
  channel: "voice_app",
  modality: "voice",
  triggerSource: "user",
  correlationId: "corr-001",
  payload: { transcript: "Yesterday" },
  consentContext: { decisionId: "consent-001", scopes: ["health_check"] },
  safetyContext: { checked: true, flags: [] },
  metadata: {},
};

export const headacheOnsetExpectedInput: ExpectedFlowInput = {
  questionId: "headache_onset",
  sceneId: "headache-onset-scene",
  flowVersion: "1",
  answerKind: "option",
  options: [
    { id: "today", label: "Today", voiceAliases: ["today"] },
    { id: "yesterday", label: "Yesterday", voiceAliases: ["yesterday"] },
    { id: "few_days", label: "A few days ago", voiceAliases: ["a few days", "few days ago"] },
    { id: "unknown", label: "I'm not sure", voiceAliases: ["not sure", "I don't know"] },
  ],
};

const answerContext = {
  questionId: headacheOnsetExpectedInput.questionId,
  sceneId: headacheOnsetExpectedInput.sceneId,
  flowVersion: headacheOnsetExpectedInput.flowVersion,
};

export const equivalentAnswerSubmissions = {
  spoken: {
    modality: "voice",
    transcript: "Yesterday.",
    ...answerContext,
  },
  tapped: {
    modality: "touch",
    answerId: "yesterday",
    ...answerContext,
  },
  typed: {
    modality: "text",
    text: "Yesterday",
    ...answerContext,
  },
} as const satisfies Record<string, AnswerSubmission>;

export const structuredToolExpectedInput: ExpectedFlowInput = {
  questionId: "latest_reading",
  sceneId: "latest-reading-scene",
  flowVersion: "1",
  answerKind: "tool_result",
  expectedToolId: "latest_reading_tool",
};

export const toolResultSubmission: AnswerSubmission = {
  modality: "tool",
  questionId: structuredToolExpectedInput.questionId,
  sceneId: structuredToolExpectedInput.sceneId,
  flowVersion: structuredToolExpectedInput.flowVersion,
  toolId: "latest_reading_tool",
  value: { systolic: 118, diastolic: 74, unit: "mmHg" },
};

export const imageAnswerExpectedInput: ExpectedFlowInput = {
  questionId: "wound_image",
  sceneId: "wound-image-scene",
  flowVersion: "1",
  answerKind: "image",
  acceptedContentTypes: ["image/jpeg", "image/png"],
};

export const documentAnswerExpectedInput: ExpectedFlowInput = {
  questionId: "care_document",
  sceneId: "care-document-scene",
  flowVersion: "1",
  answerKind: "document",
  acceptedContentTypes: ["application/pdf", "text/plain"],
};

export const waitingForUserFlowFixture: FlowState = {
  flowId: "health.preventive-check",
  flowVersion: "1",
  state: "waiting_for_user",
  sessionId: "session-001",
  userId: "user-123",
  expectedInput: headacheOnsetExpectedInput,
  context: {},
  updatedAt: "2026-07-31T10:00:00.000Z",
};

export const validFlowTransitionFixture: FlowTransition = {
  flowId: "health.preventive-check",
  flowVersion: "1",
  from: "waiting_for_user",
  to: "active",
  occurredAt: "2026-07-31T10:01:00.000Z",
  eventId: "evt-002",
  reason: "Valid normalized answer received",
};
