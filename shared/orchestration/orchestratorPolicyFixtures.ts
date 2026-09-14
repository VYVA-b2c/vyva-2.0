import type { InteractionEvent } from "./events";
import type { FlowState } from "./flowState";
import {
  parseFlowCatalogue,
  VYVA_FLOW_CATALOGUE,
  type FlowCatalogue,
  type FlowDefinition,
} from "./flowCatalogue";
import {
  VYVA_PRESENTATION_REGISTRY,
  type PresentationDefinition,
} from "./presentationRegistry";
import type {
  SpecialistRequest,
  SpecialistResponse,
} from "./specialist";
import type {
  OrchestratorPolicyDecision,
  OrchestratorPolicyEvaluationRequest,
} from "./orchestratorPolicy";

const timestamp = "2026-07-31T10:00:00.000Z";

export const preventiveFlowDefinition: FlowDefinition =
  VYVA_FLOW_CATALOGUE.flows.find(
    (flow) => flow.flowId === "health.preventive_check",
  )!;

export const preventiveChoicePresentation: PresentationDefinition =
  VYVA_PRESENTATION_REGISTRY.presentations.find(
    (presentation) =>
      presentation.presentationId ===
      "presentation.health.preventive.choice",
  )!;

const memoryCatalogueCandidate = structuredClone(VYVA_FLOW_CATALOGUE);
const memoryEnabledPreventiveFlow = memoryCatalogueCandidate.flows.find(
  (flow) => flow.flowId === preventiveFlowDefinition.flowId,
)!;
memoryEnabledPreventiveFlow.memoryPolicy = {
  allowedReadCategories: ["health.summary"],
  proposedWriteCategories: [
    "health.summary",
    "health.working_note",
    "health.longitudinal_summary",
  ],
  prohibitedCategories: ["health.hidden_reasoning"],
  permittedTargets: ["postgres", "mem0", "working_memory"],
  writeConfirmation: "sensitive_only",
  retentionClassification: "long_term",
};
memoryEnabledPreventiveFlow.consentRequirements = [
  ...memoryEnabledPreventiveFlow.consentRequirements,
  {
    scope: "mem0_write",
    timing: "before_action",
    revocable: true,
    reusable: false,
    purposeSpecific: true,
  },
];
export const memoryEnabledFlowCatalogueFixture: FlowCatalogue =
  parseFlowCatalogue(memoryCatalogueCandidate);

const canonicalPrivacyDecision = (presentation: PresentationDefinition) => ({
  sensitivity: presentation.privacyTreatment.sensitivity,
  screenObscuringAllowed: presentation.privacyTreatment.screenObscuringAllowed,
  hideInAppSwitcher: presentation.privacyTreatment.hideInAppSwitcher,
  screenshotPolicy: presentation.privacyTreatment.screenshotPolicy,
  recordingPolicy: presentation.privacyTreatment.recordingPolicy,
  evidencePreviewPolicy: presentation.privacyTreatment.evidencePreviewPolicy,
  autoClearPolicy: presentation.privacyTreatment.autoClearPolicy,
  consentNoticeRequired: presentation.privacyTreatment.consentNoticeRequired,
  retentionNoticeRequired: presentation.privacyTreatment.retentionNoticeRequired,
  shoulderSurfingWarning: presentation.privacyTreatment.shoulderSurfingWarning,
  caregiverVisibility: presentation.privacyTreatment.caregiverVisibility,
  operatorVisibility: presentation.privacyTreatment.operatorVisibility,
});

const canonicalSafetyDecision = (presentation: PresentationDefinition) => ({
  safetyCritical: presentation.safetyTreatment.safetyCritical,
  urgency: presentation.safetyTreatment.urgency,
  dismissalPolicy: presentation.safetyTreatment.dismissalPolicy,
  deferPolicy: presentation.safetyTreatment.deferPolicy,
  acknowledgementRequired:
    presentation.safetyTreatment.acknowledgementRequired,
  confirmationRequired: presentation.safetyTreatment.confirmationRequired,
  humanHelpAvailable: presentation.safetyTreatment.humanHelpAvailable,
  emergencyActionVisible: presentation.safetyTreatment.emergencyActionVisible,
  prohibitedClaims: [...presentation.safetyTreatment.prohibitedClaims],
  requiredDisclaimers: [...presentation.safetyTreatment.requiredDisclaimers],
  timeoutBehavior: presentation.safetyTreatment.timeoutBehavior,
});

export const policyInteractionEventFixture: InteractionEvent = {
  eventId: "event-task4-001",
  eventType: "USER_ENTERED_TEXT",
  occurredAt: timestamp,
  source: "ui",
  userId: "user-task4-001",
  profileId: "profile-task4-001",
  sessionId: "session-task4-001",
  flowId: preventiveFlowDefinition.flowId,
  flowVersion: preventiveFlowDefinition.version,
  channel: "pwa",
  modality: "text",
  triggerSource: "user",
  correlationId: "correlation-task4-001",
  payload: { text: "Continue" },
  consentContext: {
    decisionId: "consent-task4-health",
    scopes: ["health_data", "proactive_push", "outbound_call"],
  },
  safetyContext: { checked: true, flags: [] },
  metadata: {},
};

export const policyActiveFlowStateFixture: FlowState = {
  flowId: preventiveFlowDefinition.flowId,
  flowVersion: preventiveFlowDefinition.version,
  state: "active",
  sessionId: policyInteractionEventFixture.sessionId!,
  userId: policyInteractionEventFixture.userId,
  context: {},
  updatedAt: timestamp,
};

const activeAuditCorrelations = (evaluationId: string) => [
  policyInteractionEventFixture.eventId,
  policyInteractionEventFixture.correlationId!,
  evaluationId,
  policyInteractionEventFixture.sessionId!,
];

export const validIngressPolicyRequest: OrchestratorPolicyEvaluationRequest = {
  evaluationId: "evaluation-task4-ingress",
  policyVersion: "1.0.0",
  stage: "ingress",
  requestedAt: timestamp,
  userId: policyInteractionEventFixture.userId,
  profileId: policyInteractionEventFixture.profileId,
  sessionId: policyInteractionEventFixture.sessionId!,
  interactionEvent: policyInteractionEventFixture,
  activeFlowState: policyActiveFlowStateFixture,
  flowDefinitionReference: {
    catalogueVersion: VYVA_FLOW_CATALOGUE.catalogueVersion,
    flowId: preventiveFlowDefinition.flowId,
    version: preventiveFlowDefinition.version,
    status: preventiveFlowDefinition.status,
    sessionEligibility: "existing_session",
  },
  safetyContext: {
    emergencyChecked: true,
    deterministicSafetyResult: "clear",
    flags: [],
    riskLevel: "none",
    restrictions: [],
    escalationAlreadyActive: false,
    resultId: "safety-result-task4-001",
    checkedAt: timestamp,
    emergencyPresentationRequired: false,
  },
  consentContext: {
    scopes: ["health_data", "proactive_push", "outbound_call"],
    decisionId: "consent-task4-health",
    channelAllowed: true,
    memoryReadAllowed: true,
    memoryWriteAllowed: true,
    externalToolUseAllowed: true,
    caregiverEscalationAllowed: true,
    operatorEscalationAllowed: true,
    decisions: [
      {
        scope: "health_data",
        decisionId: "consent-task4-health",
        status: "granted",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.preventive_health",
        decidedAt: timestamp,
        requiresRevalidation: false,
      },
      {
        scope: "proactive_push",
        decisionId: "consent-task4-push",
        status: "granted",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.preventive_followup",
        decidedAt: timestamp,
        requiresRevalidation: false,
      },
      {
        scope: "outbound_call",
        decisionId: "consent-task4-call",
        status: "granted",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.preventive_followup",
        decidedAt: timestamp,
        requiresRevalidation: false,
      },
    ],
    revokedScopes: [],
    proactivePushAllowed: true,
    outboundCallAllowed: true,
    imageCaptureAllowed: false,
    documentCaptureAllowed: false,
    imageRetentionAllowed: false,
    longitudinalComparisonAllowed: false,
    mem0Allowed: false,
  },
  channelContext: {
    channel: "pwa",
    allowed: true,
    triggerSource: "user",
    supportsVoice: true,
    supportsVisuals: true,
    locale: "en",
    timezone: "Europe/Madrid",
  },
  deviceContext: {
    deviceClass: "mobile",
    sharedDevice: false,
    captionsAvailable: true,
    screenReaderRequired: false,
    keyboardNavigationRequired: false,
    reducedMotionRequired: false,
    highContrastRequired: false,
  },
  memoryPolicyContext: {
    readAllowed: false,
    writeAllowed: false,
    mem0Allowed: false,
    allowedReadCategories: [],
    allowedWriteCategories: [],
    prohibitedCategories: ["memory.hidden_reasoning"],
    permittedTargets: ["working_memory"],
    sensitivityCeiling: "sensitive",
    maximumRetention: "session",
  },
  toolPolicyContext: {
    externalToolUseAllowed: false,
    availableTools: [],
    allowedToolIds: [],
    prohibitedToolIds: [],
    maximumRiskLevel: "low",
    onePendingToolOnly: true,
  },
  escalationContext: {
    allowedTypes: ["emergency", "caregiver", "operator", "technical"],
    allowedChannels: ["pwa", "telephone", "text"],
    caregiverDisclosureAllowed: true,
    operatorDisclosureAllowed: true,
    emergencyExceptionRecorded: false,
  },
  availablePresentationCandidates: [],
  proposalRetentionDescriptors: [],
  activeAuditContext: {
    auditSessionId: "audit-session-task4-001",
    previousDecisionIds: [],
    correlationIds: activeAuditCorrelations("evaluation-task4-ingress"),
    retentionClassification: "operational",
  },
  metadata: {},
};

export const approvedMedicationAuthoritySourceFixture: NonNullable<
  OrchestratorPolicyEvaluationRequest["approvedMedicationAuthoritySources"]
>[number] = {
  sourceReferenceId: "source-record-task4-medication",
  issuerType: "approved_care_plan",
  issuerReferenceId: "issuer-task4-care-plan",
  carePlanId: "care-plan-record-task4",
  userId: validIngressPolicyRequest.userId,
  profileId: validIngressPolicyRequest.profileId,
  status: "active",
  metadata: {},
};

export const approvedCarePlanInstructionFixture: NonNullable<
  OrchestratorPolicyEvaluationRequest["approvedCarePlanInstructions"]
>[number] = {
  instructionReferenceId: "care-plan-task4-medication",
  carePlanId: "care-plan-record-task4",
  instructionId: "instruction-task4-medication",
  userId: validIngressPolicyRequest.userId,
  profileId: validIngressPolicyRequest.profileId,
  medicationReferenceId: "medication-task4",
  instructionType: "approved_care_plan_instruction",
  authorizedInstructionText: "Take 20 mg now",
  dosage: 20,
  unit: "mg",
  validFrom: "2025-01-01T00:00:00.000Z",
  issuerType: "approved_care_plan",
  issuerReferenceId: "issuer-task4-care-plan",
  sourceRecordReferenceId: "source-record-task4-medication",
  status: "active",
  metadata: {},
};

export const clinicianDisclosureAuthorizationSourceFixture: NonNullable<
  OrchestratorPolicyEvaluationRequest[
    "clinicianDisclosureAuthorizationSources"
  ]
>[number] = {
  consentDecisionId: "consent-task4-clinician",
  scope: "clinician_disclosure",
  purpose: "purpose.clinician_disclosure",
  targetType: "specific_clinician",
  targetId: "clinician-1",
  allowedChannels: ["pwa"],
  status: "granted",
  grantedAt: timestamp,
  metadata: {},
};

export const retainedEvidenceDescriptorFixture: NonNullable<
  OrchestratorPolicyEvaluationRequest["proposalRetentionDescriptors"]
>[number] = {
  subjectType: "ui_instruction",
  subjectId: "instruction-task4-choice",
  evidenceType: "image",
  processingMode: "retained",
  retentionTarget: "external_tool",
  retentionPurpose: "purpose.evidence_retention",
  consentScopeRequired: "image_retention",
  noticeRequired: true,
  retentionClass: "long_term",
  metadata: {},
};

export const validRejectPolicyDecision: OrchestratorPolicyDecision = {
  decisionId: "decision-task4-reject",
  evaluationId: validIngressPolicyRequest.evaluationId,
  policyVersion: validIngressPolicyRequest.policyVersion,
  stage: validIngressPolicyRequest.stage,
  decidedAt: timestamp,
  verdict: "reject",
  rejectionCode: "NO_APPROVED_ACTION",
  findings: [],
  adjudications: [],
  consentAuthorizations: [],
  toolAuthorizations: [],
  memoryAuthorizations: [],
  systemDirectives: [],
  auditRecord: {
    auditDecisionId: "audit-decision-task4-reject",
    evaluationId: validIngressPolicyRequest.evaluationId,
    decisionId: "decision-task4-reject",
    policyVersion: validIngressPolicyRequest.policyVersion,
    policyStage: validIngressPolicyRequest.stage,
    verdict: "reject",
    userId: validIngressPolicyRequest.userId,
    sessionId: validIngressPolicyRequest.sessionId,
    flowId: preventiveFlowDefinition.flowId,
    flowVersion: preventiveFlowDefinition.version,
    findingIds: [],
    adjudicationIds: [],
    constraintIds: [],
    directiveIds: [],
    consentDecisionReferences: ["consent-task4-health"],
    safetyResultReference: validIngressPolicyRequest.safetyContext.resultId,
    createdAt: timestamp,
    retentionClassification: "operational",
    metadata: {},
  },
  metadata: {},
};

export const validPresentationPolicyRequest: OrchestratorPolicyEvaluationRequest = {
  ...validIngressPolicyRequest,
  evaluationId: "evaluation-task4-presentation",
  stage: "delivery_approval",
  currentSceneReference: {
    sceneId: preventiveChoicePresentation.sceneId,
    flowId: preventiveFlowDefinition.flowId,
    flowVersion: preventiveFlowDefinition.version,
  },
  activeAuditContext: {
    ...validIngressPolicyRequest.activeAuditContext,
    correlationIds: activeAuditCorrelations("evaluation-task4-presentation"),
  },
  availablePresentationCandidates: [{
    presentationId: preventiveChoicePresentation.presentationId,
    version: preventiveChoicePresentation.version,
    familyId: preventiveChoicePresentation.familyId,
    sceneId: preventiveChoicePresentation.sceneId,
    supportedFlowIds: [...preventiveChoicePresentation.supportedFlowIds],
    status: preventiveChoicePresentation.status,
    currentEligibility: "eligible",
  }],
};

export const validPresentationApprovalDecision: OrchestratorPolicyDecision = {
  ...validRejectPolicyDecision,
  decisionId: "decision-task4-presentation",
  evaluationId: validPresentationPolicyRequest.evaluationId,
  stage: validPresentationPolicyRequest.stage,
  verdict: "approve",
  rejectionCode: undefined,
  findings: [{
    findingId: "finding-task4-presentation",
    policyId: "policy.presentation.allowed",
    category: "presentation",
    severity: "informational",
    outcome: "allow",
    reasonCode: "PRESENTATION_ELIGIBLE",
    subjectType: "presentation",
    subjectId: preventiveChoicePresentation.presentationId,
    sourceReferenceIds: [preventiveChoicePresentation.presentationId],
    auditSummary: "The canonical presentation is eligible.",
    createdAt: timestamp,
    metadata: {},
  }],
  adjudications: [{
    adjudicationId: "adjudication-task4-presentation",
    subjectType: "presentation",
    subjectId: preventiveChoicePresentation.presentationId,
    decision: "approve",
    policyFindingIds: ["finding-task4-presentation"],
    constraints: [],
    approvedAt: timestamp,
    metadata: {},
  }],
  approvedPresentationPlan: {
    presentationId: preventiveChoicePresentation.presentationId,
    version: preventiveChoicePresentation.version,
    familyId: preventiveChoicePresentation.familyId,
    flowId: preventiveFlowDefinition.flowId,
    flowVersion: preventiveFlowDefinition.version,
    sceneId: preventiveChoicePresentation.sceneId,
    expectedInputReference: {
      questionId: preventiveChoicePresentation.expectedInput!.questionId,
      sceneId: preventiveChoicePresentation.expectedInput!.sceneId,
      flowVersion: preventiveChoicePresentation.expectedInput!.flowVersion,
    },
    approvedUIInstructionIds: [],
    approvedActionIds: preventiveChoicePresentation.actions.map(
      (action) => action.actionId,
    ),
    approvedEventMappingIds: preventiveChoicePresentation.eventMappings.map(
      (mapping) => mapping.eventMappingId,
    ),
    approvedContentSlotIds: preventiveChoicePresentation.contentSlots.map(
      (slot) => slot.slotId,
    ),
    approvedChannel: "pwa",
    approvedDeviceClass: "mobile",
    approvedLocale: "en",
    accessibilityDecision: "meets",
    privacyDecision: "preserved",
    safetyDecision: "preserved",
    approvedPrivacyPolicy: canonicalPrivacyDecision(
      preventiveChoicePresentation,
    ),
    approvedSafetyPolicy: canonicalSafetyDecision(
      preventiveChoicePresentation,
    ),
    voiceSynchronizationDecision: {
      spokenContentSlotIds: [
        ...preventiveChoicePresentation.voiceSynchronization
          .spokenContentSlotIds,
      ],
      screenVisibleContentSlotIds:
        preventiveChoicePresentation.contentSlots.map((slot) => slot.slotId),
      interactionTiming:
        preventiveChoicePresentation.voiceSynchronization.screenUpdateTiming,
      bargeInAllowed:
        preventiveChoicePresentation.voiceSynchronization.bargeInAllowed,
      interruptSpeechOnSubmit:
        preventiveChoicePresentation.voiceSynchronization
          .interruptSpeechOnSubmit,
      acknowledgement:
        preventiveChoicePresentation.voiceSynchronization
          .acknowledgementPolicy,
      repetition:
        preventiveChoicePresentation.voiceSynchronization.repeatPolicy,
      silenceTimeoutSeconds:
        preventiveChoicePresentation.voiceSynchronization
          .silenceTimeoutPolicy.timeoutSeconds,
      captionsRequired:
        preventiveChoicePresentation.voiceSynchronization.captionsRequired,
      fallbackBehavior:
        preventiveChoicePresentation.voiceSynchronization
          .voiceFallbackBehavior,
    },
    policyFindingIds: ["finding-task4-presentation"],
    nonExecutable: true,
  },
  auditRecord: {
    ...validRejectPolicyDecision.auditRecord,
    auditDecisionId: "audit-decision-task4-presentation",
    evaluationId: validPresentationPolicyRequest.evaluationId,
    decisionId: "decision-task4-presentation",
    policyStage: validPresentationPolicyRequest.stage,
    verdict: "approve",
    selectedPresentationId: preventiveChoicePresentation.presentationId,
    selectedPresentationVersion: preventiveChoicePresentation.version,
    findingIds: ["finding-task4-presentation"],
    adjudicationIds: ["adjudication-task4-presentation"],
  },
};

export const validDeferPolicyDecision: OrchestratorPolicyDecision = {
  ...validRejectPolicyDecision,
  decisionId: "decision-task4-defer",
  evaluationId: validPresentationPolicyRequest.evaluationId,
  stage: validPresentationPolicyRequest.stage,
  verdict: "defer",
  rejectionCode: undefined,
  findings: [{
    findingId: "finding-task4-defer",
    policyId: "policy.presentation.allowed",
    category: "presentation",
    severity: "informational",
    outcome: "allow",
    reasonCode: "PRESENTATION_DEFERRED",
    subjectType: "presentation",
    subjectId: preventiveChoicePresentation.presentationId,
    sourceReferenceIds: [preventiveChoicePresentation.presentationId],
    auditSummary: "The routine Presentation proposal is deferred.",
    createdAt: timestamp,
    metadata: {},
  }],
  adjudications: [{
    adjudicationId: "adjudication-task4-defer",
    subjectType: "presentation",
    subjectId: preventiveChoicePresentation.presentationId,
    decision: "defer",
    policyFindingIds: ["finding-task4-defer"],
    constraints: [],
    approvedAt: timestamp,
    metadata: {},
  }],
  deferPlan: {
    reasonCode: "ROUTINE_WORK_DEFERRED",
    resumability: "policy_revalidation",
    deferredAdjudicationIds: ["adjudication-task4-defer"],
    directiveIds: [],
    policyFindingIds: ["finding-task4-defer"],
    nonExecutable: true,
  },
  auditRecord: {
    ...validRejectPolicyDecision.auditRecord,
    auditDecisionId: "audit-decision-task4-defer",
    evaluationId: validPresentationPolicyRequest.evaluationId,
    decisionId: "decision-task4-defer",
    policyStage: validPresentationPolicyRequest.stage,
    verdict: "defer",
    selectedPresentationId: undefined,
    selectedPresentationVersion: undefined,
    findingIds: ["finding-task4-defer"],
    adjudicationIds: ["adjudication-task4-defer"],
  },
};

export const canonicalSpecialistRequestFixture: SpecialistRequest = {
  requestId: "request-task4-specialist",
  correlationId: policyInteractionEventFixture.correlationId!,
  causationId: policyInteractionEventFixture.eventId,
  specialistId: preventiveFlowDefinition.ownerSpecialistId,
  specialistVersion: "1.0.0",
  flowId: preventiveFlowDefinition.flowId,
  flowVersion: preventiveFlowDefinition.version,
  flowInstanceId: "flow-instance-task4-001",
  currentState: "active",
  userId: validIngressPolicyRequest.userId,
  profileId: validIngressPolicyRequest.profileId,
  sessionId: validIngressPolicyRequest.sessionId,
  intent: {
    name: "continue_preventive_check",
    confidence: 0.98,
    source: "orchestrator",
    rationaleCode: "ACTIVE_FLOW_MATCH",
  },
  userInput: {
    kind: "event_reference",
    eventId: policyInteractionEventFixture.eventId,
  },
  normalizedInput: {
    type: "event_reference",
    eventId: policyInteractionEventFixture.eventId,
  },
  inputModality: "text",
  triggerSource: "user",
  relevantMemory: [],
  domainContext: {},
  safetyContext: {
    emergencyChecked: true,
    deterministicSafetyResult: "clear",
    flags: [],
    riskLevel: "none",
    restrictions: [],
    escalationAlreadyActive: false,
  },
  consentContext: {
    scopes: ["health_data"],
    decisionId: "consent-task4-health",
    channelAllowed: true,
    memoryReadAllowed: true,
    memoryWriteAllowed: true,
    externalToolUseAllowed: false,
    caregiverEscalationAllowed: true,
    operatorEscalationAllowed: true,
  },
  previousAnswers: {},
  availableTools: [],
  uiContext: {
    currentRoute: "/health",
    sceneId: preventiveChoicePresentation.sceneId,
    visibleInstructionIds: [],
    visibleOptionIds: [],
    deviceClass: "mobile",
    accessibilityPreferences: {},
  },
  locale: "en",
  timezone: "Europe/Madrid",
  channel: { type: "pwa", supportsVoice: true, supportsVisuals: true },
  metadata: {},
  requestedAt: timestamp,
};

export const completeSpecialistResponseFixture: SpecialistResponse = {
  requestId: canonicalSpecialistRequestFixture.requestId,
  specialistId: canonicalSpecialistRequestFixture.specialistId,
  status: "complete",
  interpretation: {
    summary: "The preventive check is complete.",
    confidence: 0.98,
    missingInformation: [],
  },
  responseGuidance: {
    facts: ["The preventive check is complete."],
    prohibitedClaims: ["Do not diagnose."],
    urgency: "routine",
  },
  uiInstructions: [],
  memoryReadsRequested: [],
  memoryWritesProposed: [],
  proposedToolCalls: [],
  flowStateUpdate: {
    nextLifecycleState: "completed",
    clearExpectedInput: true,
    reasonCode: "FLOW_COMPLETE",
  },
  completionResult: {
    outcome: "health.preventive_check.completed",
  },
  riskLevel: "none",
  safetyFlags: [],
  auditMetadata: { decisionCodes: ["PREVENTIVE_CHECK_COMPLETE"] },
};

export const validSpecialistResponsePolicyRequest:
OrchestratorPolicyEvaluationRequest = {
  ...validIngressPolicyRequest,
  evaluationId: "evaluation-task4-specialist-response",
  stage: "proposal_adjudication",
  activeAuditContext: {
    ...validIngressPolicyRequest.activeAuditContext,
    correlationIds: activeAuditCorrelations(
      "evaluation-task4-specialist-response",
    ),
  },
  specialistRequest: canonicalSpecialistRequestFixture,
  specialistResponse: completeSpecialistResponseFixture,
};

export const validSpecialistApprovalDecision: OrchestratorPolicyDecision = {
  ...validRejectPolicyDecision,
  decisionId: "decision-task4-specialist-response",
  evaluationId: validSpecialistResponsePolicyRequest.evaluationId,
  stage: validSpecialistResponsePolicyRequest.stage,
  verdict: "approve",
  rejectionCode: undefined,
  findings: [{
    findingId: "finding-task4-flow-update",
    policyId: "policy.flow_update.allowed",
    category: "flow_update",
    severity: "informational",
    outcome: "allow",
    reasonCode: "FLOW_UPDATE_ALLOWED",
    subjectType: "flow_state_update",
    subjectId: "request-task4-specialist.flow_state_update",
    sourceReferenceIds: ["request-task4-specialist"],
    auditSummary: "The proposed terminal transition is valid.",
    createdAt: timestamp,
    metadata: {},
  }, {
    findingId: "finding-task4-response-guidance",
    policyId: "policy.response_composition.allowed",
    category: "response_composition",
    severity: "informational",
    outcome: "allow",
    reasonCode: "RESPONSE_GUIDANCE_ALLOWED",
    subjectType: "response_guidance",
    subjectId: "request-task4-specialist.response_guidance",
    sourceReferenceIds: ["request-task4-specialist"],
    auditSummary: "The traceable response guidance is allowed.",
    createdAt: timestamp,
    metadata: {},
  }],
  adjudications: [
    {
      adjudicationId: "adjudication-task4-flow-update",
      subjectType: "flow_state_update",
      subjectId: "request-task4-specialist.flow_state_update",
      decision: "approve",
      policyFindingIds: ["finding-task4-flow-update"],
      constraints: [],
      approvedAt: timestamp,
      metadata: {},
    },
    {
      adjudicationId: "adjudication-task4-response-guidance",
      subjectType: "response_guidance",
      subjectId: "request-task4-specialist.response_guidance",
      decision: "approve",
      policyFindingIds: ["finding-task4-response-guidance"],
      constraints: [],
      approvedAt: timestamp,
      metadata: {},
    },
    {
      adjudicationId: "adjudication-task4-completion",
      subjectType: "completion",
      subjectId: "request-task4-specialist.completion",
      decision: "approve",
      policyFindingIds: ["finding-task4-flow-update"],
      constraints: [],
      approvedAt: timestamp,
      metadata: {},
    },
  ],
  approvedFlowStateProposal: {
    approvalId: "approval-task4-flow-update",
    subjectId: "request-task4-specialist.flow_state_update",
    flowId: preventiveFlowDefinition.flowId,
    flowVersion: preventiveFlowDefinition.version,
    fromState: "active",
    toState: "completed",
    proposal: completeSpecialistResponseFixture.flowStateUpdate!,
    completionOutcomeId: "health.preventive_check.completed",
    policyFindingIds: ["finding-task4-flow-update"],
    nonExecutable: true,
  },
  approvedResponsePlan: {
    approvedFacts: [{
      factId: "fact-task4-complete",
      text: "The preventive check is complete.",
      sourceType: "specialist",
      sourceReferenceId: "request-task4-specialist.response_guidance",
    }],
    approvedAcknowledgements: [],
    approvedTone: "supportive",
    urgency: "routine",
    brevityPreference: "brief",
    prohibitedClaims: ["Do not diagnose."],
    requiredDisclaimers: [],
    localizationKeys: [],
    contentSlotAssignments: [],
    evidenceLimitations: [],
    escalationLanguageRequirements: [],
    policyFindingIds: ["finding-task4-response-guidance"],
  },
  auditRecord: {
    ...validRejectPolicyDecision.auditRecord,
    auditDecisionId: "audit-decision-task4-specialist-response",
    evaluationId: validSpecialistResponsePolicyRequest.evaluationId,
    decisionId: "decision-task4-specialist-response",
    policyStage: validSpecialistResponsePolicyRequest.stage,
    verdict: "approve",
    specialistRequestId: canonicalSpecialistRequestFixture.requestId,
    specialistResponseId: completeSpecialistResponseFixture.requestId,
    findingIds: [
      "finding-task4-flow-update",
      "finding-task4-response-guidance",
    ],
    adjudicationIds: [
      "adjudication-task4-flow-update",
      "adjudication-task4-completion",
      "adjudication-task4-response-guidance",
    ],
  },
};

export const needsInformationSpecialistResponseFixture: SpecialistResponse = {
  ...completeSpecialistResponseFixture,
  status: "needs_information",
  interpretation: {
    summary: "Another answer is required.",
    confidence: 0.97,
    missingInformation: ["preventive_check_timing"],
  },
  responseGuidance: {
    facts: ["One answer is needed to continue."],
    prohibitedClaims: ["Do not diagnose."],
    urgency: "routine",
  },
  nextQuestion: preventiveChoicePresentation.expectedInput!,
  uiInstructions: [{
    instructionId: "instruction-task4-choice",
    type: "show_choice_question",
    questionId: preventiveChoicePresentation.expectedInput!.questionId,
    sceneId: preventiveChoicePresentation.sceneId,
    payload: {
      prompt: "When would you like to continue?",
      options: preventiveChoicePresentation.expectedInput!.options!.map(
        (option) => ({ id: option.id, label: option.label }),
      ),
    },
  }],
  flowStateUpdate: {
    nextLifecycleState: "waiting_for_user",
    expectedInput: preventiveChoicePresentation.expectedInput!,
    reasonCode: "MORE_INFORMATION_REQUIRED",
  },
  completionResult: undefined,
  auditMetadata: { decisionCodes: ["MORE_INFORMATION_REQUIRED"] },
};

export const validRequestMoreInformationPolicyRequest:
OrchestratorPolicyEvaluationRequest = {
  ...validPresentationPolicyRequest,
  evaluationId: "evaluation-task4-more-information",
  stage: "proposal_adjudication",
  activeAuditContext: {
    ...validPresentationPolicyRequest.activeAuditContext,
    correlationIds: activeAuditCorrelations(
      "evaluation-task4-more-information",
    ),
  },
  specialistRequest: canonicalSpecialistRequestFixture,
  specialistResponse: needsInformationSpecialistResponseFixture,
};

const requestMoreInformationSubjects = [
  {
    subjectType: "next_question" as const,
    subjectId: preventiveChoicePresentation.expectedInput!.questionId,
  },
  {
    subjectType: "ui_instruction" as const,
    subjectId: "instruction-task4-choice",
  },
  {
    subjectType: "flow_state_update" as const,
    subjectId: "request-task4-specialist.flow_state_update",
  },
  {
    subjectType: "presentation" as const,
    subjectId: preventiveChoicePresentation.presentationId,
  },
  {
    subjectType: "response_guidance" as const,
    subjectId: "request-task4-specialist.response_guidance",
  },
];

export const validRequestMoreInformationDecision:
OrchestratorPolicyDecision = {
  ...validPresentationApprovalDecision,
  decisionId: "decision-task4-more-information",
  evaluationId: validRequestMoreInformationPolicyRequest.evaluationId,
  stage: validRequestMoreInformationPolicyRequest.stage,
  verdict: "request_more_information",
  findings: requestMoreInformationSubjects.map((subject, index) => ({
    findingId: `finding-task4-more-information-${index}`,
    policyId: subject.subjectType === "presentation"
      ? "policy.presentation.allowed"
      : subject.subjectType === "flow_state_update"
        ? "policy.flow_update.allowed"
        : "policy.specialist.valid",
    category: subject.subjectType === "presentation"
      ? "presentation" as const
      : subject.subjectType === "flow_state_update"
        ? "flow_update" as const
        : "specialist_validity" as const,
    severity: "informational" as const,
    outcome: "allow" as const,
    reasonCode: "MORE_INFORMATION_ALLOWED",
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    sourceReferenceIds: [subject.subjectId],
    auditSummary: "The referenced proposal is eligible.",
    createdAt: timestamp,
    metadata: {},
  })),
  adjudications: requestMoreInformationSubjects.map((subject, index) => ({
    adjudicationId: `adjudication-task4-more-information-${index}`,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    decision: "approve" as const,
    policyFindingIds: [`finding-task4-more-information-${index}`],
    constraints: [],
    approvedAt: timestamp,
    metadata: {},
  })),
  approvedFlowStateProposal: {
    approvalId: "approval-task4-more-information",
    subjectId: "request-task4-specialist.flow_state_update",
    flowId: preventiveFlowDefinition.flowId,
    flowVersion: preventiveFlowDefinition.version,
    fromState: "active",
    toState: "waiting_for_user",
    proposal: needsInformationSpecialistResponseFixture.flowStateUpdate!,
    policyFindingIds: ["finding-task4-more-information-2"],
    nonExecutable: true,
  },
  approvedPresentationPlan: {
    ...validPresentationApprovalDecision.approvedPresentationPlan!,
    expectedInputReference: {
      questionId: preventiveChoicePresentation.expectedInput!.questionId,
      sceneId: preventiveChoicePresentation.expectedInput!.sceneId,
      flowVersion: preventiveChoicePresentation.expectedInput!.flowVersion,
    },
    approvedUIInstructionIds: ["instruction-task4-choice"],
    policyFindingIds: ["finding-task4-more-information-3"],
  },
  approvedResponsePlan: {
    approvedFacts: [{
      factId: "fact-task4-more-information",
      text: "One answer is needed to continue.",
      sourceType: "specialist",
      sourceReferenceId: "request-task4-specialist.response_guidance",
    }],
    approvedAcknowledgements: [],
    approvedTone: "supportive",
    urgency: "routine",
    brevityPreference: "brief",
    prohibitedClaims: ["Do not diagnose."],
    requiredDisclaimers: [],
    localizationKeys:
      preventiveChoicePresentation.localizationPolicy.requiredLocalizationKeys,
    contentSlotAssignments: [],
    evidenceLimitations: [],
    escalationLanguageRequirements: [],
    policyFindingIds: ["finding-task4-more-information-4"],
  },
  auditRecord: {
    ...validPresentationApprovalDecision.auditRecord,
    auditDecisionId: "audit-decision-task4-more-information",
    evaluationId: validRequestMoreInformationPolicyRequest.evaluationId,
    decisionId: "decision-task4-more-information",
    policyStage: validRequestMoreInformationPolicyRequest.stage,
    verdict: "request_more_information",
    specialistRequestId: canonicalSpecialistRequestFixture.requestId,
    specialistResponseId: needsInformationSpecialistResponseFixture.requestId,
    findingIds: requestMoreInformationSubjects.map(
      (_, index) => `finding-task4-more-information-${index}`,
    ),
    adjudicationIds: requestMoreInformationSubjects.map(
      (_, index) => `adjudication-task4-more-information-${index}`,
    ),
  },
};

const task4ToolDescriptor = {
  toolId: "tool_task4_followup",
  description: "Prepare a non-executing follow-up request.",
  inputSchemaId: "schema_task4_followup_input",
  outputSchemaId: "schema_task4_followup_output",
  requiresConfirmation: true,
  requiresConsent: true,
  idempotencyRequired: true,
  allowedRiskLevels: ["none", "low"] as const,
};

export const toolSpecialistRequestFixture: SpecialistRequest = {
  ...canonicalSpecialistRequestFixture,
  requestId: "request-task4-tool",
  availableTools: [task4ToolDescriptor],
  consentContext: {
    ...canonicalSpecialistRequestFixture.consentContext,
    externalToolUseAllowed: true,
  },
};

export const toolSpecialistResponseFixture: SpecialistResponse = {
  ...completeSpecialistResponseFixture,
  requestId: toolSpecialistRequestFixture.requestId,
  status: "proposed_action",
  interpretation: {
    summary: "A follow-up Tool action was proposed.",
    confidence: 0.96,
    missingInformation: [],
  },
  responseGuidance: {
    facts: ["A follow-up can be prepared after confirmation."],
    prohibitedClaims: [],
    urgency: "routine",
  },
  proposedToolCalls: [{
    proposalId: "proposal-task4-tool",
    toolId: task4ToolDescriptor.toolId,
    arguments: { delayDays: 7 },
    reason: "The user requested a future follow-up.",
    requiresConfirmation: true,
    idempotencyKey: "idempotency-task4-tool",
    expectedResultType: task4ToolDescriptor.outputSchemaId,
    riskLevel: "low",
  }],
  flowStateUpdate: {
    nextLifecycleState: "waiting_for_tool",
    pendingTool: {
      toolId: task4ToolDescriptor.toolId,
      requestId: "proposal-task4-tool",
      startedAt: timestamp,
    },
    clearExpectedInput: true,
    reasonCode: "TOOL_CONFIRMATION_REQUIRED",
  },
  completionResult: undefined,
  auditMetadata: { decisionCodes: ["TOOL_PROPOSED"] },
};

export const validToolPolicyRequest: OrchestratorPolicyEvaluationRequest = {
  ...validIngressPolicyRequest,
  evaluationId: "evaluation-task4-tool",
  stage: "proposal_adjudication",
  activeAuditContext: {
    ...validIngressPolicyRequest.activeAuditContext,
    correlationIds: activeAuditCorrelations("evaluation-task4-tool"),
  },
  specialistRequest: toolSpecialistRequestFixture,
  specialistResponse: toolSpecialistResponseFixture,
  toolPolicyContext: {
    externalToolUseAllowed: true,
    availableTools: [task4ToolDescriptor],
    allowedToolIds: [task4ToolDescriptor.toolId],
    prohibitedToolIds: [],
    maximumRiskLevel: "low",
    onePendingToolOnly: true,
  },
  proposalRetentionDescriptors: [{
    subjectType: "tool_call",
    subjectId: "proposal-task4-tool",
    evidenceType: "none",
    processingMode: "transient",
    retentionTarget: "none",
    retentionPurpose: "purpose.task4_tool",
    noticeRequired: false,
    retentionClass: "none",
    sourceToolId: task4ToolDescriptor.toolId,
    metadata: {},
  }],
  consentContext: {
    ...validIngressPolicyRequest.consentContext,
    externalToolUseAllowed: true,
    scopes: [
      ...validIngressPolicyRequest.consentContext.scopes,
      "external_tool_use",
    ],
    decisions: [
      ...validIngressPolicyRequest.consentContext.decisions,
      {
        scope: "external_tool_use",
        decisionId: "consent-task4-tool",
        status: "granted",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.task4_tool",
        decidedAt: timestamp,
        requiresRevalidation: false,
      },
    ],
  },
};

export const validToolAuthorizationDecision: OrchestratorPolicyDecision = {
  ...validRejectPolicyDecision,
  decisionId: "decision-task4-tool",
  evaluationId: validToolPolicyRequest.evaluationId,
  stage: validToolPolicyRequest.stage,
  verdict: "approve_with_constraints",
  rejectionCode: undefined,
  findings: [
    {
      findingId: "finding-task4-tool",
      policyId: "policy.tool.outside_flow_narrow_exception",
      category: "tool",
      severity: "informational",
      outcome: "allow",
      reasonCode: "TOOL_EXPLICITLY_ALLOWED",
      subjectType: "tool_call",
      subjectId: "proposal-task4-tool",
      sourceReferenceIds: ["proposal-task4-tool"],
      auditSummary: "The proposed Tool is explicitly allowed by policy.",
      createdAt: timestamp,
      metadata: {},
    },
    {
      findingId: "finding-task4-tool-flow",
      policyId: "policy.flow_update.allowed",
      category: "flow_update",
      severity: "informational",
      outcome: "allow",
      reasonCode: "WAITING_FOR_TOOL_ALLOWED",
      subjectType: "flow_state_update",
      subjectId: "request-task4-tool.flow_state_update",
      sourceReferenceIds: ["request-task4-tool"],
      auditSummary: "The waiting-for-Tool proposal is valid.",
      createdAt: timestamp,
      metadata: {},
    },
    {
      findingId: "finding-task4-tool-response",
      policyId: "policy.response_composition.allowed",
      category: "response_composition",
      severity: "informational",
      outcome: "allow",
      reasonCode: "RESPONSE_GUIDANCE_ALLOWED",
      subjectType: "response_guidance",
      subjectId: "request-task4-tool.response_guidance",
      sourceReferenceIds: ["request-task4-tool"],
      auditSummary: "The Tool response guidance is traceable.",
      createdAt: timestamp,
      metadata: {},
    },
    {
      findingId: "finding-task4-tool-consent",
      policyId: "policy.consent.allowed",
      category: "consent",
      severity: "informational",
      outcome: "allow",
      reasonCode: "TOOL_CONSENT_ALLOWED",
      subjectType: "tool_call",
      subjectId: "proposal-task4-tool",
      sourceReferenceIds: ["consent-task4-tool"],
      auditSummary: "Purpose-specific external Tool consent is current.",
      createdAt: timestamp,
      metadata: {},
    },
    {
      findingId: "finding-task4-tool-confirmation",
      policyId: "policy.tool.confirmation",
      category: "tool",
      severity: "caution",
      outcome: "require_confirmation",
      reasonCode: "TOOL_CONFIRMATION_REQUIRED",
      subjectType: "tool_call",
      subjectId: "proposal-task4-tool",
      sourceReferenceIds: ["proposal-task4-tool"],
      auditSummary: "The Tool requires explicit user confirmation.",
      createdAt: timestamp,
      metadata: {},
    },
    {
      findingId: "finding-task4-tool-correlation",
      policyId: "policy.correlation.revalidate",
      category: "correlation",
      severity: "caution",
      outcome: "require_revalidation",
      reasonCode: "CURRENT_CORRELATION_REQUIRED",
      subjectType: "flow_state_update",
      subjectId: "request-task4-tool.flow_state_update",
      sourceReferenceIds: ["request-task4-tool"],
      auditSummary: "The Flow update remains bound to current correlation.",
      createdAt: timestamp,
      metadata: {},
    },
  ],
  adjudications: [
    {
      adjudicationId: "adjudication-task4-tool",
      subjectType: "tool_call",
      subjectId: "proposal-task4-tool",
      decision: "require_confirmation",
      policyFindingIds: [
        "finding-task4-tool",
        "finding-task4-tool-confirmation",
      ],
      constraints: [{
        constraintId: "constraint-task4-tool-confirmation",
        type: "require_user_confirmation",
        reasonCode: "TOOL_CONFIRMATION_REQUIRED",
        subjectId: "proposal-task4-tool",
        sourcePolicyId: "policy.tool.confirmation",
        parameters: {},
      }],
      approvedAt: timestamp,
      metadata: {},
    },
    {
      adjudicationId: "adjudication-task4-tool-flow",
      subjectType: "flow_state_update",
      subjectId: "request-task4-tool.flow_state_update",
      decision: "approve_with_constraints",
      policyFindingIds: [
        "finding-task4-tool-flow",
        "finding-task4-tool-correlation",
      ],
      constraints: [{
        constraintId: "constraint-task4-tool-correlation",
        type: "require_current_correlation",
        reasonCode: "CURRENT_CORRELATION_REQUIRED",
        subjectId: "request-task4-tool.flow_state_update",
        sourcePolicyId: "policy.correlation.revalidate",
        parameters: {},
      }],
      approvedAt: timestamp,
      metadata: {},
    },
    {
      adjudicationId: "adjudication-task4-tool-response",
      subjectType: "response_guidance",
      subjectId: "request-task4-tool.response_guidance",
      decision: "approve",
      policyFindingIds: ["finding-task4-tool-response"],
      constraints: [],
      approvedAt: timestamp,
      metadata: {},
    },
  ],
  consentAuthorizations: [{
    authorizationId: "consent-authorization-task4-tool",
    scope: "external_tool_use",
    consentDecisionId: "consent-task4-tool",
    authorizationBasis: "explicit_user_consent",
    purpose: "purpose.task4_tool",
    decision: "allow",
    policyFindingIds: ["finding-task4-tool-consent"],
  }],
  toolAuthorizations: [{
    authorizationId: "authorization-task4-tool",
    proposalId: "proposal-task4-tool",
    adjudicationId: "adjudication-task4-tool",
    toolId: task4ToolDescriptor.toolId,
    decision: "require_confirmation",
    confirmationRequired: true,
    idempotencyRequired: true,
    idempotencyKeyReference: "idempotency-task4-tool",
    expectedResultType: task4ToolDescriptor.outputSchemaId,
    argumentSchemaId: task4ToolDescriptor.inputSchemaId,
    outsideFlowPolicyId: "policy.tool.outside_flow_narrow_exception",
    consentAuthorizationIds: ["consent-authorization-task4-tool"],
    policyFindingIds: ["finding-task4-tool-response"],
    nonExecutable: true,
  }],
  approvedFlowStateProposal: {
    approvalId: "approval-task4-tool-flow",
    subjectId: "request-task4-tool.flow_state_update",
    flowId: preventiveFlowDefinition.flowId,
    flowVersion: preventiveFlowDefinition.version,
    fromState: "active",
    toState: "waiting_for_tool",
    proposal: toolSpecialistResponseFixture.flowStateUpdate!,
    policyFindingIds: ["finding-task4-tool-flow"],
    nonExecutable: true,
  },
  approvedResponsePlan: {
    approvedFacts: [{
      factId: "fact-task4-tool",
      text: "A follow-up can be prepared after confirmation.",
      sourceType: "specialist",
      sourceReferenceId: "request-task4-tool.response_guidance",
    }],
    approvedAcknowledgements: [],
    approvedTone: "neutral",
    urgency: "routine",
    brevityPreference: "brief",
    prohibitedClaims: [],
    requiredDisclaimers: [],
    localizationKeys: [],
    contentSlotAssignments: [],
    evidenceLimitations: [],
    escalationLanguageRequirements: [],
    policyFindingIds: [
      "finding-task4-tool",
      "finding-task4-tool-confirmation",
      "finding-task4-tool-correlation",
    ],
  },
  auditRecord: {
    ...validRejectPolicyDecision.auditRecord,
    auditDecisionId: "audit-decision-task4-tool",
    evaluationId: validToolPolicyRequest.evaluationId,
    decisionId: "decision-task4-tool",
    policyStage: validToolPolicyRequest.stage,
    verdict: "approve_with_constraints",
    specialistRequestId: toolSpecialistRequestFixture.requestId,
    specialistResponseId: toolSpecialistResponseFixture.requestId,
    findingIds: [
      "finding-task4-tool",
      "finding-task4-tool-flow",
      "finding-task4-tool-response",
      "finding-task4-tool-consent",
      "finding-task4-tool-confirmation",
      "finding-task4-tool-correlation",
    ],
    adjudicationIds: [
      "adjudication-task4-tool",
      "adjudication-task4-tool-flow",
      "adjudication-task4-tool-response",
    ],
    constraintIds: [
      "constraint-task4-tool-confirmation",
      "constraint-task4-tool-correlation",
    ],
  },
};

export const validSafeFailurePolicyRequest:
OrchestratorPolicyEvaluationRequest = {
  ...validIngressPolicyRequest,
  evaluationId: "evaluation-task4-safe-failure",
  stage: "safe_failure",
  activeAuditContext: {
    ...validIngressPolicyRequest.activeAuditContext,
    correlationIds: activeAuditCorrelations("evaluation-task4-safe-failure"),
  },
};

export const validSafeFailureDecision: OrchestratorPolicyDecision = {
  ...validRejectPolicyDecision,
  decisionId: "decision-task4-safe-failure",
  evaluationId: validSafeFailurePolicyRequest.evaluationId,
  stage: "safe_failure",
  verdict: "safe_fail",
  rejectionCode: undefined,
  safeFailurePlan: {
    failureCode: "POLICY_CONTEXT_UNAVAILABLE",
    userSafeSummaryCode: "SAFE_RETRY_AVAILABLE",
    auditSummary: "Policy evaluation could not continue safely.",
    recoverable: true,
    approvedVoiceFallbackPolicy: "accessible_text",
    retryPolicy: "revalidate_context",
    policyFindingIds: [],
    nonExecutable: true,
  },
  auditRecord: {
    ...validRejectPolicyDecision.auditRecord,
    auditDecisionId: "audit-decision-task4-safe-failure",
    evaluationId: validSafeFailurePolicyRequest.evaluationId,
    decisionId: "decision-task4-safe-failure",
    policyStage: "safe_failure",
    verdict: "safe_fail",
  },
};

function presentationCandidate(
  presentationId: string,
): OrchestratorPolicyEvaluationRequest[
  "availablePresentationCandidates"
][number] {
  const presentation = VYVA_PRESENTATION_REGISTRY.presentations.find(
    (item) => item.presentationId === presentationId,
  )!;
  return {
    presentationId: presentation.presentationId,
    version: presentation.version,
    familyId: presentation.familyId,
    sceneId: presentation.sceneId,
    supportedFlowIds: [...presentation.supportedFlowIds],
    status: presentation.status,
    currentEligibility: "eligible",
  };
}

export const woundPresentationCandidateFixture = presentationCandidate(
  "presentation.health.wound.capture",
);

export const scamPresentationCandidateFixture = presentationCandidate(
  "presentation.trust.scam.no_obvious_indicators",
);

export const TASK4_POLICY_SCENARIO_IDS = [
  "valid_ingress_rejection",
  "valid_presentation_approval",
  "valid_specialist_completion",
  "invalid_event_correlation",
  "invalid_flow_correlation",
  "invalid_profile_correlation",
  "invalid_specialist_correlation",
  "invalid_policy_stage",
  "retired_flow_rejected",
  "revoked_consent_rejected",
  "channel_denied",
  "emergency_precedence",
  "safety_downgrade_rejected",
  "tool_not_available",
  "tool_confirmation_required",
  "tool_idempotency_required",
  "memory_read_denied",
  "memory_write_denied",
  "mem0_denied",
  "escalation_deduplicated",
  "invalid_flow_transition",
  "followup_window_rejected",
  "presentation_not_canonical",
  "presentation_voice_mismatch",
  "presentation_accessibility_fallback",
  "response_claim_rejected",
  "safe_failure_required",
  "audit_mismatch_rejected",
  "hidden_reasoning_rejected",
  "metadata_secret_rejected",
] as const;

export function clonePolicyFixture<T>(fixture: T): T {
  return structuredClone(fixture);
}
