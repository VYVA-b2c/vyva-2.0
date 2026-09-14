import type { SpecialistRequest, SpecialistResponse } from "./specialist";

export const preventiveHealthSpecialistRequest: SpecialistRequest = {
  requestId: "req-health-001",
  correlationId: "corr-health-001",
  causationId: "evt-health-001",
  specialistId: "health.preventive",
  specialistVersion: "1",
  flowId: "health.preventive-check",
  flowVersion: "1",
  flowInstanceId: "flow-instance-health-001",
  currentState: "active",
  userId: "user-fixture-001",
  profileId: "profile-fixture-001",
  sessionId: "session-fixture-001",
  intent: {
    name: "continue_preventive_check",
    confidence: 0.96,
    source: "orchestrator",
    rationaleCode: "ACTIVE_FLOW_MATCH",
  },
  userInput: {
    kind: "safe_text",
    text: "Yesterday",
    redacted: true,
  },
  normalizedInput: {
    type: "answer",
    answer: {
      questionId: "headache_onset",
      answerId: "yesterday",
      answerKind: "option",
      value: "yesterday",
    },
  },
  inputModality: "voice",
  triggerSource: "user",
  relevantMemory: [{
    category: "communication_preference",
    source: "postgres",
    value: { concise: true },
    sensitivity: "internal",
    recordId: "memory-fixture-001",
  }],
  domainContext: { preventiveCheckVersion: "1" },
  safetyContext: {
    emergencyChecked: true,
    deterministicSafetyResult: "clear",
    flags: [],
    riskLevel: "none",
    restrictions: [],
    escalationAlreadyActive: false,
  },
  consentContext: {
    scopes: ["health_check"],
    decisionId: "consent-fixture-001",
    channelAllowed: true,
    memoryReadAllowed: true,
    memoryWriteAllowed: true,
    externalToolUseAllowed: true,
    caregiverEscalationAllowed: false,
    operatorEscalationAllowed: true,
  },
  previousAnswers: {},
  availableTools: [{
    toolId: "schedule_follow_up",
    description: "Propose a follow-up reminder.",
    inputSchemaId: "schedule-follow-up.v1",
    requiresConfirmation: true,
    requiresConsent: true,
    idempotencyRequired: true,
    allowedRiskLevels: ["none", "low"],
  }],
  uiContext: {
    currentRoute: "/health",
    sceneId: "preventive-check",
    visibleInstructionIds: [],
    visibleOptionIds: [],
    deviceClass: "mobile",
    accessibilityPreferences: {},
  },
  locale: "en-GB",
  timezone: "Europe/Madrid",
  channel: { type: "pwa", supportsVoice: true, supportsVisuals: true },
  metadata: {},
  requestedAt: "2026-07-31T10:00:00.000Z",
};

const responseBase = {
  requestId: preventiveHealthSpecialistRequest.requestId,
  specialistId: preventiveHealthSpecialistRequest.specialistId,
  interpretation: {
    summary: "The submitted answer was understood.",
    confidence: 0.95,
    missingInformation: [],
  },
  responseGuidance: {
    facts: ["The preventive check can continue."],
    prohibitedClaims: ["Do not diagnose."],
    urgency: "routine" as const,
  },
  uiInstructions: [],
  memoryReadsRequested: [],
  memoryWritesProposed: [],
  proposedToolCalls: [],
  riskLevel: "none" as const,
  safetyFlags: [],
  auditMetadata: { decisionCodes: ["ANSWER_ACCEPTED"] },
};

export const needsInformationResponse: SpecialistResponse = {
  ...responseBase,
  status: "needs_information",
  nextQuestion: {
    questionId: "symptom_frequency",
    sceneId: "symptom-frequency",
    flowVersion: "1",
    answerKind: "option",
    options: [
      { id: "rarely", label: "Rarely" },
      { id: "often", label: "Often" },
    ],
  },
  flowStateUpdate: {
    nextLifecycleState: "waiting_for_user",
    expectedInput: {
      questionId: "symptom_frequency",
      sceneId: "symptom-frequency",
      flowVersion: "1",
      answerKind: "option",
      options: [
        { id: "rarely", label: "Rarely" },
        { id: "often", label: "Often" },
      ],
    },
    reasonCode: "MORE_INFORMATION_REQUIRED",
  },
};

export const completeSpecialistResponse: SpecialistResponse = {
  ...responseBase,
  status: "complete",
  completionResult: { outcome: "preventive_check_complete" },
  flowStateUpdate: {
    nextLifecycleState: "completed",
    clearExpectedInput: true,
    reasonCode: "FLOW_COMPLETE",
  },
};

export const proposedActionResponse: SpecialistResponse = {
  ...responseBase,
  status: "proposed_action",
  proposedToolCalls: [{
    proposalId: "proposal-001",
    toolId: "schedule_follow_up",
    arguments: { delayDays: 7 },
    reason: "A follow-up may support continuity.",
    requiresConfirmation: true,
    idempotencyKey: "follow-up-flow-instance-health-001",
    riskLevel: "low",
  }],
  flowStateUpdate: {
    nextLifecycleState: "waiting_for_tool",
    pendingTool: {
      toolId: "schedule_follow_up",
      requestId: "proposal-001",
      startedAt: "2026-07-31T10:00:01.000Z",
    },
    clearExpectedInput: true,
    reasonCode: "TOOL_PROPOSED",
  },
};

export const medicationSpecialistRequest: SpecialistRequest = {
  ...preventiveHealthSpecialistRequest,
  requestId: "req-medication-001",
  correlationId: "corr-medication-001",
  specialistId: "medication.adherence",
  flowId: "medication.reminder-review",
  flowInstanceId: "flow-instance-medication-001",
  intent: {
    name: "review_medication_reminder",
    confidence: 0.93,
    source: "explicit",
  },
  domainContext: { medicationReferenceId: "medication-fixture-001" },
};

export const medicationProposedActionResponse: SpecialistResponse = {
  ...proposedActionResponse,
  requestId: medicationSpecialistRequest.requestId,
  specialistId: medicationSpecialistRequest.specialistId,
};

export const safetySpecialistRequest: SpecialistRequest = {
  ...preventiveHealthSpecialistRequest,
  requestId: "req-safety-001",
  specialistId: "safety",
  flowId: "safety.assessment",
  flowInstanceId: "flow-instance-safety-001",
  safetyContext: {
    ...preventiveHealthSpecialistRequest.safetyContext,
    emergencyChecked: false,
    deterministicSafetyResult: "emergency",
    riskLevel: "emergency",
    flags: ["EMERGENCY_LANGUAGE"],
  },
};

export const escalatedSpecialistResponse: SpecialistResponse = {
  ...responseBase,
  requestId: safetySpecialistRequest.requestId,
  specialistId: "safety",
  status: "escalated",
  riskLevel: "emergency",
  safetyFlags: ["EMERGENCY_LANGUAGE"],
  escalation: {
    type: "emergency",
    reasonCode: "IMMEDIATE_SAFETY_RISK",
    urgency: "immediate",
    summary: "Immediate emergency escalation is proposed.",
    requiresConsent: false,
  },
  flowStateUpdate: {
    nextLifecycleState: "escalated",
    clearExpectedInput: true,
    reasonCode: "SAFETY_ESCALATION",
  },
};

export const blockedSpecialistResponse: SpecialistResponse = {
  ...responseBase,
  status: "blocked",
  blockedReason: "Required consent is unavailable.",
};

export const failedSpecialistResponse: SpecialistResponse = {
  ...responseBase,
  status: "failed",
  failureCode: "SPECIALIST_UNAVAILABLE",
  responseGuidance: {
    ...responseBase.responseGuidance,
    facts: ["The request could not be completed safely."],
  },
};
