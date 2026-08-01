import { describe, expect, it } from "vitest";
import {
  ORCHESTRATOR_POLICY_CATEGORIES,
  ORCHESTRATOR_POLICY_EFFECTS,
  ORCHESTRATOR_POLICY_PRECEDENCE,
  ORCHESTRATOR_POLICY_STAGES,
  ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS,
  ORCHESTRATOR_CONSENT_ACTIONS,
  ORCHESTRATOR_CONSENT_COMPATIBILITY_MATRIX,
  ORCHESTRATOR_CONSENT_TEST_DIMENSIONS,
  ORCHESTRATOR_DIRECT_SELF_REFERENCE_CASES,
  ORCHESTRATOR_ESCALATION_COMPATIBILITY_MATRIX,
  ORCHESTRATOR_ESCALATION_TEST_DIMENSIONS,
  ORCHESTRATOR_ESCALATION_TYPES,
  ORCHESTRATOR_PLAN_CATEGORIES,
  ORCHESTRATOR_RESUME_PROOF_CASES,
  ORCHESTRATOR_STAGE_VERDICT_COMPATIBILITY,
  ORCHESTRATOR_VERDICT_COMPATIBILITY,
  ORCHESTRATOR_VERDICTS,
  POLICY_SUBJECT_TYPES,
  type OrchestratorPolicyDecision,
  collectAdjudicableSubjects,
  orchestratorPolicyDecisionSchema,
  orchestratorPolicyEvaluationRequestSchema,
  parseOrchestratorPolicyDecision,
  parseOrchestratorPolicyEvaluationRequest,
  validateOrchestratorPolicyDecision,
  validatePolicyFindingCompatibility,
} from "./orchestratorPolicy";
import { OrchestrationContractError } from "./errors";
import {
  TASK4_POLICY_SCENARIO_IDS,
  clonePolicyFixture,
  memoryEnabledFlowCatalogueFixture,
  preventiveChoicePresentation,
  scamPresentationCandidateFixture,
  validIngressPolicyRequest,
  validDeferPolicyDecision,
  validPresentationApprovalDecision,
  validPresentationPolicyRequest,
  validRejectPolicyDecision,
  validRequestMoreInformationDecision,
  validRequestMoreInformationPolicyRequest,
  validSpecialistApprovalDecision,
  validSpecialistResponsePolicyRequest,
  validSafeFailureDecision,
  validSafeFailurePolicyRequest,
  validToolAuthorizationDecision,
  validToolPolicyRequest,
  woundPresentationCandidateFixture,
} from "./orchestratorPolicyFixtures";
import { parseFlowCatalogue, VYVA_FLOW_CATALOGUE } from "./flowCatalogue";
import {
  parsePresentationRegistry,
  VYVA_PRESENTATION_REGISTRY,
} from "./presentationRegistry";

function expectContractError(
  operation: () => unknown,
  code: string,
): void {
  try {
    operation();
    throw new Error("Expected an OrchestrationContractError.");
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestrationContractError);
    expect((error as OrchestrationContractError).code).toBe(code);
  }
}

const INDEPENDENT_VERDICT_ADJUDICATION_EXPECTATIONS = {
  approve: ["approve"],
  approve_with_constraints: ["approve", "approve_with_constraints"],
  request_more_information: ["approve", "approve_with_constraints"],
  defer: ["defer"],
  reject: ["reject"],
  escalate: ["approve", "approve_with_constraints"],
  safe_fail: ["defer", "reject"],
} as const;

const INDEPENDENT_STAGE_VERDICT_EXPECTATIONS = {
  ingress: ["reject", "safe_fail"],
  specialist_invocation: [
    "approve", "reject", "safe_fail",
  ],
  specialist_response: [
    "request_more_information", "defer", "reject", "escalate", "safe_fail",
  ],
  proposal_adjudication: [
    "approve", "approve_with_constraints", "request_more_information",
    "defer", "reject", "escalate", "safe_fail",
  ],
  presentation_approval: [
    "approve", "approve_with_constraints", "request_more_information",
    "defer", "reject", "escalate", "safe_fail",
  ],
  delivery_approval: [
    "approve", "approve_with_constraints", "request_more_information",
    "defer", "reject", "escalate", "safe_fail",
  ],
  safe_failure: ["safe_fail"],
} as const;

type VerificationResult = "pass" | "fail" | "not_applicable";
type ConsentVerificationDimension =
  | "valid" | "missing" | "revoked" | "expired"
  | "wrong_purpose" | "wrong_scope" | "wrong_channel" | "wrong_target";
type EscalationVerificationDimension =
  | "valid" | "missing_flow_rule" | "wrong_flow_rule" | "missing_target"
  | "wrong_target" | "wrong_channel" | "missing_consent" | "wrong_consent"
  | "revoked_consent" | "expired_consent"
  | "duplicate_active_escalation" | "emergency_exception"
  | "missing_required_finding" | "execution_field_attempt";

function consentCase(
  consentArea: string,
  dimension: ConsentVerificationDimension,
  expectedResult: VerificationResult,
  reason: string,
  fixtureBuilderKey = consentArea,
) {
  return {
    scenarioId: `consent.${consentArea}.${dimension}`,
    consentArea,
    dimension,
    expectedResult,
    reason,
    fixtureBuilderKey,
  };
}

const naChannel = "The operation is internal and has no delivery Channel.";
const naTarget = "The operation has no external disclosure target.";
const CONSENT_EXPECTATIONS = [
  consentCase("external_tool_use", "valid", "pass", "Current purpose-specific source consent authorizes the Tool."),
  consentCase("external_tool_use", "missing", "fail", "Decision authority cannot invent Tool consent."),
  consentCase("external_tool_use", "revoked", "fail", "Revoked Tool consent remains revoked."),
  consentCase("external_tool_use", "expired", "fail", "Expired Tool consent cannot be extended."),
  consentCase("external_tool_use", "wrong_purpose", "fail", "Tool consent is purpose-specific."),
  consentCase("external_tool_use", "wrong_scope", "fail", "Another scope cannot authorize Tool use."),
  consentCase("external_tool_use", "wrong_channel", "not_applicable", naChannel),
  consentCase("external_tool_use", "wrong_target", "not_applicable", naTarget),

  consentCase("image_capture", "valid", "pass", "Image capture has its own current source consent."),
  consentCase("image_capture", "missing", "fail", "Capture cannot be inferred from a decision."),
  consentCase("image_capture", "revoked", "fail", "Revoked capture consent fails."),
  consentCase("image_capture", "expired", "fail", "Expired capture consent fails."),
  consentCase("image_capture", "wrong_purpose", "fail", "Capture purpose must match."),
  consentCase("image_capture", "wrong_scope", "fail", "Analysis or retention cannot substitute for capture."),
  consentCase("image_capture", "wrong_channel", "fail", "Capture must use a permitted Channel."),
  consentCase("image_capture", "wrong_target", "not_applicable", naTarget),

  consentCase("image_analysis", "valid", "pass", "Image analysis has its own current source consent."),
  consentCase("image_analysis", "missing", "fail", "Analysis cannot be inferred from capture."),
  consentCase("image_analysis", "revoked", "fail", "Revoked analysis consent fails."),
  consentCase("image_analysis", "expired", "fail", "Expired analysis consent fails."),
  consentCase("image_analysis", "wrong_purpose", "fail", "Analysis purpose must match."),
  consentCase("image_analysis", "wrong_scope", "fail", "Capture cannot substitute for analysis."),
  consentCase("image_analysis", "wrong_channel", "fail", "Analysis must use a permitted Channel."),
  consentCase("image_analysis", "wrong_target", "not_applicable", naTarget),

  consentCase("image_retention", "valid", "pass", "Retained image processing has current retention consent."),
  consentCase("image_retention", "missing", "fail", "Capture does not imply retention."),
  consentCase("image_retention", "revoked", "fail", "Revoked image retention fails."),
  consentCase("image_retention", "expired", "fail", "Expired image retention fails."),
  consentCase("image_retention", "wrong_purpose", "fail", "Retention purpose must match."),
  consentCase("image_retention", "wrong_scope", "fail", "Capture or analysis cannot substitute for retention."),
  consentCase("image_retention", "wrong_channel", "fail", "Retention intake must use a permitted Channel."),
  consentCase("image_retention", "wrong_target", "not_applicable", naTarget),

  consentCase("document_capture", "valid", "pass", "Document capture has current document-specific consent."),
  consentCase("document_capture", "missing", "fail", "Document capture cannot be invented."),
  consentCase("document_capture", "revoked", "fail", "Revoked document capture fails."),
  consentCase("document_capture", "expired", "fail", "Expired document capture fails."),
  consentCase("document_capture", "wrong_purpose", "fail", "Document capture purpose must match."),
  consentCase("document_capture", "wrong_scope", "fail", "Image consent cannot authorize document capture."),
  consentCase("document_capture", "wrong_channel", "fail", "Document capture must use a permitted Channel."),
  consentCase("document_capture", "wrong_target", "not_applicable", naTarget),

  consentCase("document_retention", "valid", "pass", "Document retention has distinct current consent."),
  consentCase("document_retention", "missing", "fail", "Document capture does not imply retention."),
  consentCase("document_retention", "revoked", "fail", "Revoked document retention fails."),
  consentCase("document_retention", "expired", "fail", "Expired document retention fails."),
  consentCase("document_retention", "wrong_purpose", "fail", "Document retention purpose must match."),
  consentCase("document_retention", "wrong_scope", "fail", "Image retention cannot substitute."),
  consentCase("document_retention", "wrong_channel", "fail", "Document retention intake must use a permitted Channel."),
  consentCase("document_retention", "wrong_target", "not_applicable", naTarget),

  consentCase("longitudinal_comparison", "valid", "pass", "Comparison has explicit longitudinal consent."),
  consentCase("longitudinal_comparison", "missing", "fail", "Ordinary retention does not imply comparison."),
  consentCase("longitudinal_comparison", "revoked", "fail", "Revoked comparison consent fails."),
  consentCase("longitudinal_comparison", "expired", "fail", "Expired comparison consent fails."),
  consentCase("longitudinal_comparison", "wrong_purpose", "fail", "Comparison purpose must match."),
  consentCase("longitudinal_comparison", "wrong_scope", "fail", "Retention cannot substitute for comparison."),
  consentCase("longitudinal_comparison", "wrong_channel", "fail", "Comparison intake must use a permitted Channel."),
  consentCase("longitudinal_comparison", "wrong_target", "not_applicable", naTarget),

  consentCase("memory_read", "valid", "pass", "Memory read has current category-bound consent."),
  consentCase("memory_read", "missing", "fail", "Read authority cannot be invented."),
  consentCase("memory_read", "revoked", "fail", "Revoked read consent fails."),
  consentCase("memory_read", "expired", "fail", "Expired read consent fails."),
  consentCase("memory_read", "wrong_purpose", "fail", "Read purpose must match."),
  consentCase("memory_read", "wrong_scope", "fail", "Write consent cannot authorize a read."),
  consentCase("memory_read", "wrong_channel", "not_applicable", naChannel),
  consentCase("memory_read", "wrong_target", "not_applicable", naTarget),

  consentCase("memory_write", "valid", "pass", "Memory write has current target-bound consent."),
  consentCase("memory_write", "missing", "fail", "Write authority cannot be invented."),
  consentCase("memory_write", "revoked", "fail", "Revoked write consent fails."),
  consentCase("memory_write", "expired", "fail", "Expired write consent fails."),
  consentCase("memory_write", "wrong_purpose", "fail", "Write purpose must match."),
  consentCase("memory_write", "wrong_scope", "fail", "Read consent cannot authorize a write."),
  consentCase("memory_write", "wrong_channel", "not_applicable", naChannel),
  consentCase("memory_write", "wrong_target", "not_applicable", "Memory targets are constrained by memory policy, not disclosure target consent."),

  consentCase("mem0_write", "valid", "pass", "Mem0 write has explicit provider-specific consent."),
  consentCase("mem0_write", "missing", "fail", "Generic memory write does not imply Mem0 consent."),
  consentCase("mem0_write", "revoked", "fail", "Revoked Mem0 consent fails."),
  consentCase("mem0_write", "expired", "fail", "Expired Mem0 consent fails."),
  consentCase("mem0_write", "wrong_purpose", "fail", "Mem0 purpose must match."),
  consentCase("mem0_write", "wrong_scope", "fail", "Generic memory scope cannot substitute."),
  consentCase("mem0_write", "wrong_channel", "not_applicable", naChannel),
  consentCase("mem0_write", "wrong_target", "not_applicable", "Mem0 is constrained as a memory target rather than a disclosure recipient."),

  consentCase("caregiver_disclosure", "valid", "pass", "Caregiver disclosure is source-, Channel-, and target-bound."),
  consentCase("caregiver_disclosure", "missing", "fail", "Caregiver disclosure cannot be invented."),
  consentCase("caregiver_disclosure", "revoked", "fail", "Revoked caregiver disclosure fails."),
  consentCase("caregiver_disclosure", "expired", "fail", "Expired caregiver disclosure fails."),
  consentCase("caregiver_disclosure", "wrong_purpose", "fail", "Caregiver purpose must match."),
  consentCase("caregiver_disclosure", "wrong_scope", "fail", "Operator or clinician consent cannot substitute."),
  consentCase("caregiver_disclosure", "wrong_channel", "fail", "Caregiver Channel must be authorized."),
  consentCase("caregiver_disclosure", "wrong_target", "fail", "Caregiver target must be request-authorized."),

  consentCase("operator_disclosure", "valid", "pass", "Operator disclosure is source-, Channel-, and target-bound."),
  consentCase("operator_disclosure", "missing", "fail", "Operator disclosure cannot be invented."),
  consentCase("operator_disclosure", "revoked", "fail", "Revoked operator disclosure fails."),
  consentCase("operator_disclosure", "expired", "fail", "Expired operator disclosure fails."),
  consentCase("operator_disclosure", "wrong_purpose", "fail", "Operator purpose must match."),
  consentCase("operator_disclosure", "wrong_scope", "fail", "Caregiver or clinician consent cannot substitute."),
  consentCase("operator_disclosure", "wrong_channel", "fail", "Operator Channel must be authorized."),
  consentCase("operator_disclosure", "wrong_target", "fail", "Operator target must be request-authorized."),

  consentCase("clinician_disclosure", "valid", "pass", "Clinician disclosure is source-, Channel-, and target-bound."),
  consentCase("clinician_disclosure", "missing", "fail", "Clinician disclosure cannot be invented."),
  consentCase("clinician_disclosure", "revoked", "fail", "Revoked clinician disclosure fails."),
  consentCase("clinician_disclosure", "expired", "fail", "Expired clinician disclosure fails."),
  consentCase("clinician_disclosure", "wrong_purpose", "fail", "Clinician purpose must match."),
  consentCase("clinician_disclosure", "wrong_scope", "fail", "Caregiver or operator consent cannot substitute."),
  consentCase("clinician_disclosure", "wrong_channel", "fail", "Clinician Channel must be authorized."),
  consentCase("clinician_disclosure", "wrong_target", "fail", "Clinician target must be source-authorized."),

  consentCase("proactive_push", "valid", "pass", "Push permission is current and Channel-specific."),
  consentCase("proactive_push", "missing", "fail", "Push permission cannot be invented."),
  consentCase("proactive_push", "revoked", "fail", "Revoked push consent fails."),
  consentCase("proactive_push", "expired", "fail", "Expired push consent fails."),
  consentCase("proactive_push", "wrong_purpose", "fail", "Push purpose must match."),
  consentCase("proactive_push", "wrong_scope", "fail", "Outbound-call consent cannot substitute."),
  consentCase("proactive_push", "wrong_channel", "fail", "Push requires a PWA-compatible Channel."),
  consentCase("proactive_push", "wrong_target", "not_applicable", "Push has a Channel destination, not a disclosure recipient."),

  consentCase("outbound_call", "valid", "pass", "Outbound-call permission is current and telephone-specific."),
  consentCase("outbound_call", "missing", "fail", "Call permission cannot be invented."),
  consentCase("outbound_call", "revoked", "fail", "Revoked call consent fails."),
  consentCase("outbound_call", "expired", "fail", "Expired call consent fails."),
  consentCase("outbound_call", "wrong_purpose", "fail", "Call purpose must match."),
  consentCase("outbound_call", "wrong_scope", "fail", "Push consent cannot substitute."),
  consentCase("outbound_call", "wrong_channel", "fail", "Outbound calls require telephone authorization."),
  consentCase("outbound_call", "wrong_target", "not_applicable", "Calls are Channel-bound in this contract; recipient identity is not a disclosure target."),

  consentCase("followup_channel", "valid", "pass", "Follow-up consent covers the selected Channel."),
  consentCase("followup_channel", "missing", "fail", "Follow-up Channel permission cannot be invented."),
  consentCase("followup_channel", "revoked", "fail", "Revoked follow-up consent fails."),
  consentCase("followup_channel", "expired", "fail", "Expired follow-up consent fails."),
  consentCase("followup_channel", "wrong_purpose", "fail", "Follow-up purpose must match."),
  consentCase("followup_channel", "wrong_scope", "fail", "Unrelated delivery consent cannot substitute."),
  consentCase("followup_channel", "wrong_channel", "fail", "Primary and fallback Channels require coverage."),
  consentCase("followup_channel", "wrong_target", "not_applicable", "Follow-up is Channel-bound rather than disclosure-target-bound."),

  consentCase("escalation", "valid", "pass", "Escalation disclosure consent is current and correlated."),
  consentCase("escalation", "missing", "fail", "Escalation consent cannot be invented."),
  consentCase("escalation", "revoked", "fail", "Revoked escalation consent fails."),
  consentCase("escalation", "expired", "fail", "Expired escalation consent fails."),
  consentCase("escalation", "wrong_purpose", "fail", "Escalation purpose must match."),
  consentCase("escalation", "wrong_scope", "fail", "Unrelated disclosure scope cannot substitute."),
  consentCase("escalation", "wrong_channel", "fail", "Escalation Channel must be authorized."),
  consentCase("escalation", "wrong_target", "fail", "Escalation recipient must be request-authorized."),

  consentCase("emergency_exception", "valid", "pass", "A recorded exception remains request-side authority."),
  consentCase("emergency_exception", "missing", "fail", "An exception cannot be decision-invented."),
  consentCase("emergency_exception", "revoked", "fail", "A revoked ordinary consent cannot be revived without a valid exception record."),
  consentCase("emergency_exception", "expired", "fail", "An expired exception record fails."),
  consentCase("emergency_exception", "wrong_purpose", "fail", "Exception purpose remains bounded."),
  consentCase("emergency_exception", "wrong_scope", "fail", "An exception cannot widen its scope."),
  consentCase("emergency_exception", "wrong_channel", "fail", "Exception delivery remains Channel-bound."),
  consentCase("emergency_exception", "wrong_target", "fail", "Exception target remains explicitly bounded."),
] as const;

function escalationCase(
  escalationType: string,
  dimension: EscalationVerificationDimension,
  expectedResult: VerificationResult,
  reason: string,
  fixtureBuilderKey = escalationType,
) {
  return {
    scenarioId: `escalation.${escalationType}.${dimension}`,
    escalationType,
    dimension,
    expectedResult,
    reason,
    fixtureBuilderKey,
  };
}

const naEmergencyTarget =
  "Emergency services are selected by the Flow rule; no person target is required.";
const naTechnicalTarget =
  "The frozen Flow catalogue models technical handling through the operator rule without a person target.";
const naNoDisclosure =
  "This escalation path performs no personal disclosure and therefore needs no disclosure consent.";
const ESCALATION_EXPECTATIONS = [
  escalationCase("emergency", "valid", "pass", "Safety basis, emergency Flow rule and Channel agree."),
  escalationCase("emergency", "missing_flow_rule", "fail", "Ordinary emergency escalation requires a Flow rule."),
  escalationCase("emergency", "wrong_flow_rule", "fail", "A non-emergency Flow rule cannot authorize emergency escalation."),
  escalationCase("emergency", "missing_target", "not_applicable", naEmergencyTarget),
  escalationCase("emergency", "wrong_target", "not_applicable", naEmergencyTarget),
  escalationCase("emergency", "wrong_channel", "fail", "Emergency delivery must use a Flow-permitted Channel."),
  escalationCase("emergency", "missing_consent", "not_applicable", naNoDisclosure),
  escalationCase("emergency", "wrong_consent", "not_applicable", naNoDisclosure),
  escalationCase("emergency", "revoked_consent", "not_applicable", naNoDisclosure),
  escalationCase("emergency", "expired_consent", "not_applicable", naNoDisclosure),
  escalationCase("emergency", "duplicate_active_escalation", "fail", "Active escalation identity must be correlated."),
  escalationCase("emergency", "emergency_exception", "pass", "A deterministic emergency may use the explicit safety exception path."),
  escalationCase("emergency", "missing_required_finding", "fail", "Emergency Flow safety correlation is mandatory."),
  escalationCase("emergency", "execution_field_attempt", "fail", "Provider execution fields are forbidden."),

  escalationCase("caregiver", "valid", "pass", "Caregiver rule, target, Channel and consent agree."),
  escalationCase("caregiver", "missing_flow_rule", "fail", "Caregiver escalation requires a Flow rule."),
  escalationCase("caregiver", "wrong_flow_rule", "fail", "Another escalation rule cannot substitute."),
  escalationCase("caregiver", "missing_target", "fail", "Caregiver target is required."),
  escalationCase("caregiver", "wrong_target", "fail", "Caregiver target must match proposal and consent."),
  escalationCase("caregiver", "wrong_channel", "fail", "Caregiver Channel must be permitted."),
  escalationCase("caregiver", "missing_consent", "fail", "Caregiver disclosure consent is required."),
  escalationCase("caregiver", "wrong_consent", "fail", "Operator or clinician consent cannot substitute."),
  escalationCase("caregiver", "revoked_consent", "fail", "Revoked caregiver consent fails."),
  escalationCase("caregiver", "expired_consent", "fail", "Expired caregiver consent fails."),
  escalationCase("caregiver", "duplicate_active_escalation", "fail", "Active escalation identity must be correlated."),
  escalationCase("caregiver", "emergency_exception", "not_applicable", "Routine caregiver disclosure has no emergency exception path."),
  escalationCase("caregiver", "missing_required_finding", "fail", "The Flow safety correlation is mandatory."),
  escalationCase("caregiver", "execution_field_attempt", "fail", "Provider execution fields are forbidden."),

  escalationCase("operator", "valid", "pass", "Operator rule, target, Channel and consent agree."),
  escalationCase("operator", "missing_flow_rule", "fail", "Operator escalation requires a Flow rule."),
  escalationCase("operator", "wrong_flow_rule", "fail", "Another escalation rule cannot substitute."),
  escalationCase("operator", "missing_target", "fail", "Operator target is required."),
  escalationCase("operator", "wrong_target", "fail", "Operator target must match proposal and consent."),
  escalationCase("operator", "wrong_channel", "fail", "Operator Channel must be permitted."),
  escalationCase("operator", "missing_consent", "fail", "Operator disclosure consent is required."),
  escalationCase("operator", "wrong_consent", "fail", "Caregiver or clinician consent cannot substitute."),
  escalationCase("operator", "revoked_consent", "fail", "Revoked operator consent fails."),
  escalationCase("operator", "expired_consent", "fail", "Expired operator consent fails."),
  escalationCase("operator", "duplicate_active_escalation", "fail", "Active escalation identity must be correlated."),
  escalationCase("operator", "emergency_exception", "not_applicable", "Routine operator disclosure has no emergency exception path."),
  escalationCase("operator", "missing_required_finding", "fail", "The Flow safety correlation is mandatory."),
  escalationCase("operator", "execution_field_attempt", "fail", "Provider execution fields are forbidden."),

  escalationCase("clinician", "valid", "pass", "Clinician rule, source-bound target, Channel and consent agree."),
  escalationCase("clinician", "missing_flow_rule", "fail", "Clinician escalation requires a Flow rule."),
  escalationCase("clinician", "wrong_flow_rule", "fail", "Another escalation rule cannot substitute."),
  escalationCase("clinician", "missing_target", "fail", "Clinician target is required."),
  escalationCase("clinician", "wrong_target", "fail", "Clinician target must match its authority source."),
  escalationCase("clinician", "wrong_channel", "fail", "Clinician Channel must match its authority source."),
  escalationCase("clinician", "missing_consent", "fail", "Clinician disclosure consent is required."),
  escalationCase("clinician", "wrong_consent", "fail", "Caregiver or operator consent cannot substitute."),
  escalationCase("clinician", "revoked_consent", "fail", "Revoked clinician authority fails."),
  escalationCase("clinician", "expired_consent", "fail", "Expired clinician authority fails."),
  escalationCase("clinician", "duplicate_active_escalation", "fail", "Active escalation identity must be correlated."),
  escalationCase("clinician", "emergency_exception", "pass", "A fully correlated clinical emergency exception is permitted."),
  escalationCase("clinician", "missing_required_finding", "fail", "The Flow safety correlation is mandatory."),
  escalationCase("clinician", "execution_field_attempt", "fail", "Provider execution fields are forbidden."),

  escalationCase("technical", "valid", "pass", "Technical handling uses the frozen operator Flow rule and permitted Channel."),
  escalationCase("technical", "missing_flow_rule", "fail", "Technical escalation requires its handling Flow rule."),
  escalationCase("technical", "wrong_flow_rule", "fail", "An unrelated Flow rule cannot authorize technical handling."),
  escalationCase("technical", "missing_target", "not_applicable", naTechnicalTarget),
  escalationCase("technical", "wrong_target", "not_applicable", naTechnicalTarget),
  escalationCase("technical", "wrong_channel", "fail", "Technical handling must use a permitted Channel."),
  escalationCase("technical", "missing_consent", "not_applicable", naNoDisclosure),
  escalationCase("technical", "wrong_consent", "not_applicable", naNoDisclosure),
  escalationCase("technical", "revoked_consent", "not_applicable", naNoDisclosure),
  escalationCase("technical", "expired_consent", "not_applicable", naNoDisclosure),
  escalationCase("technical", "duplicate_active_escalation", "fail", "Active escalation identity must be correlated."),
  escalationCase("technical", "emergency_exception", "not_applicable", "Technical handling cannot use an emergency consent exception."),
  escalationCase("technical", "missing_required_finding", "fail", "The Flow handling correlation is mandatory."),
  escalationCase("technical", "execution_field_attempt", "fail", "Provider execution fields are forbidden."),
] as const;

function strictPresentationNonDowngradeScenario() {
  const registry = structuredClone(VYVA_PRESENTATION_REGISTRY);
  const presentation = registry.presentations.find(
    (item) =>
      item.presentationId === preventiveChoicePresentation.presentationId &&
      item.version === preventiveChoicePresentation.version,
  )!;
  Object.assign(presentation.privacyTreatment, {
    sensitivity: "restricted",
    screenObscuringAllowed: true,
    hideInAppSwitcher: true,
    screenshotPolicy: "prohibited",
    recordingPolicy: "prohibited",
    evidencePreviewPolicy: "required",
    autoClearPolicy: "after_submission",
    consentNoticeRequired: true,
    retentionNoticeRequired: true,
    shoulderSurfingWarning: true,
    caregiverVisibility: "none",
    operatorVisibility: "none",
  });
  Object.assign(presentation.safetyTreatment, {
    safetyCritical: true,
    urgency: "urgent",
    dismissalPolicy: "prohibited",
    deferPolicy: "prohibited",
    acknowledgementRequired: true,
    confirmationRequired: true,
    humanHelpAvailable: true,
    emergencyActionVisible: true,
    prohibitedClaims: ["diagnosis"],
    requiredDisclaimers: ["copy.test.safety_disclaimer"],
    timeoutBehavior: "remain_visible",
  });
  const decision = clonePolicyFixture(validPresentationApprovalDecision);
  decision.approvedPresentationPlan!.approvedPrivacyPolicy = {
    sensitivity: presentation.privacyTreatment.sensitivity,
    screenObscuringAllowed:
      presentation.privacyTreatment.screenObscuringAllowed,
    hideInAppSwitcher: presentation.privacyTreatment.hideInAppSwitcher,
    screenshotPolicy: presentation.privacyTreatment.screenshotPolicy,
    recordingPolicy: presentation.privacyTreatment.recordingPolicy,
    evidencePreviewPolicy: presentation.privacyTreatment.evidencePreviewPolicy,
    autoClearPolicy: presentation.privacyTreatment.autoClearPolicy,
    consentNoticeRequired:
      presentation.privacyTreatment.consentNoticeRequired,
    retentionNoticeRequired:
      presentation.privacyTreatment.retentionNoticeRequired,
    shoulderSurfingWarning:
      presentation.privacyTreatment.shoulderSurfingWarning,
    caregiverVisibility: presentation.privacyTreatment.caregiverVisibility,
    operatorVisibility: presentation.privacyTreatment.operatorVisibility,
  };
  decision.approvedPresentationPlan!.approvedSafetyPolicy = {
    safetyCritical: presentation.safetyTreatment.safetyCritical,
    urgency: presentation.safetyTreatment.urgency,
    dismissalPolicy: presentation.safetyTreatment.dismissalPolicy,
    deferPolicy: presentation.safetyTreatment.deferPolicy,
    acknowledgementRequired:
      presentation.safetyTreatment.acknowledgementRequired,
    confirmationRequired: presentation.safetyTreatment.confirmationRequired,
    humanHelpAvailable: presentation.safetyTreatment.humanHelpAvailable,
    emergencyActionVisible:
      presentation.safetyTreatment.emergencyActionVisible,
    prohibitedClaims: [...presentation.safetyTreatment.prohibitedClaims],
    requiredDisclaimers: [
      ...presentation.safetyTreatment.requiredDisclaimers,
    ],
    timeoutBehavior: presentation.safetyTreatment.timeoutBehavior,
  };
  return {
    decision,
    presentationRegistry: parsePresentationRegistry(registry),
  };
}

describe("Task 4 Orchestrator policy request", () => {
  it("parses the canonical ingress request", () => {
    expect(parseOrchestratorPolicyEvaluationRequest(
      validIngressPolicyRequest,
    )).toEqual(validIngressPolicyRequest);
  });

  it("supports every declared stage with its required context", () => {
    const requests = {
      ingress: validIngressPolicyRequest,
      specialist_invocation: {
        ...validSpecialistResponsePolicyRequest,
        stage: "specialist_invocation",
        specialistResponse: undefined,
      },
      specialist_response: {
        ...validSpecialistResponsePolicyRequest,
        stage: "specialist_response",
      },
      proposal_adjudication: validSpecialistResponsePolicyRequest,
      presentation_approval: {
        ...validPresentationPolicyRequest,
        stage: "presentation_approval",
      },
      delivery_approval: validPresentationPolicyRequest,
      safe_failure: {
        ...validIngressPolicyRequest,
        stage: "safe_failure",
      },
    } as const;
    expect(Object.keys(requests)).toEqual(ORCHESTRATOR_POLICY_STAGES);
    Object.values(requests).forEach((request) => {
      expect(() =>
        parseOrchestratorPolicyEvaluationRequest(request)
      ).not.toThrow();
    });
  });

  it.each([
    ["specialist_invocation", undefined, "ORCHESTRATOR_POLICY_STAGE_INVALID"],
    ["specialist_response", undefined, "ORCHESTRATOR_POLICY_STAGE_INVALID"],
    ["presentation_approval", undefined, "ORCHESTRATOR_POLICY_STAGE_INVALID"],
    ["delivery_approval", undefined, "ORCHESTRATOR_POLICY_STAGE_INVALID"],
  ] as const)("rejects missing requirements for %s", (stage, _, code) => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.stage = stage;
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      code,
    );
  });

  it("rejects unknown request fields", () => {
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest({
        ...validIngressPolicyRequest,
        runtimeAdapter: "forbidden",
      }),
      "ORCHESTRATOR_POLICY_REQUEST_INVALID",
    );
  });

  it.each(["credential", "Authorization", "providerClient", "callback",
    "endpoint", "diagnosis", "fraudDecision", "stackTrace",
    "executeTool", "memoryWrite", "scheduleJob", "emitEvent",
    "runtimeComponent", "chainOfThought"])(
    "rejects recursively forbidden metadata key %s",
    (key) => {
      const request = clonePolicyFixture(validIngressPolicyRequest);
      request.metadata = { nested: { [key]: "not-allowed" } };
      expectContractError(
        () => parseOrchestratorPolicyEvaluationRequest(request),
        key === "chainOfThought"
          ? "HIDDEN_REASONING_NOT_ALLOWED"
          : "ORCHESTRATOR_POLICY_REQUEST_INVALID",
      );
    },
  );

  it("rejects URLs in free-form metadata", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.metadata = { link: "https://provider.example/private" };
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_METADATA_INVALID",
    );
  });

  it("rejects malformed evaluation IDs", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.evaluationId = "spaces are not ids";
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_POLICY_REQUEST_INVALID",
    );
  });

  it("has at least 25 synthetic scenario identifiers", () => {
    expect(TASK4_POLICY_SCENARIO_IDS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(TASK4_POLICY_SCENARIO_IDS).size).toBe(
      TASK4_POLICY_SCENARIO_IDS.length,
    );
  });
});

describe("Task 4 freeze-blocker hardening", () => {
  const sceneA = "trust.scam.evidence_capture";
  const sceneB = "trust.scam.exposure_questions";
  const sceneC = "trust.scam.immediate_actions";

  function replaceFixtureStrings<T>(
    value: T,
    replacements: ReadonlyArray<readonly [string, string]>,
  ): T {
    let serialized = JSON.stringify(value);
    for (const [from, to] of replacements) {
      serialized = serialized.replaceAll(from, to);
    }
    return JSON.parse(serialized) as T;
  }

  function sceneDeliveryScenario(
    presentationScene: typeof sceneB | typeof sceneC,
    includeDestination: boolean,
  ) {
    const flow = VYVA_FLOW_CATALOGUE.flows.find(
      (item) => item.flowId === "trust.scam_assessment",
    )!;
    const presentation = VYVA_PRESENTATION_REGISTRY.presentations.find(
      (item) =>
        item.presentationId === (
          presentationScene === sceneB
            ? "presentation.trust.scam.exposure_questions"
            : "presentation.trust.scam.immediate_actions"
        ),
    )!;
    const sourceRequest = includeDestination
      ? validRequestMoreInformationPolicyRequest
      : validPresentationPolicyRequest;
    const sourceDecision = includeDestination
      ? validRequestMoreInformationDecision
      : validPresentationApprovalDecision;
    const replacements = [
      [
        preventiveChoicePresentation.presentationId,
        presentation.presentationId,
      ],
      [preventiveChoicePresentation.sceneId,
        includeDestination ? sceneB : presentationScene],
      [validPresentationPolicyRequest.flowDefinitionReference.flowId,
        flow.flowId],
      ["preventive_health", flow.ownerSpecialistId],
    ] as const;
    const request = replaceFixtureStrings(
      clonePolicyFixture(sourceRequest),
      replacements,
    );
    const decision = replaceFixtureStrings(
      clonePolicyFixture(sourceDecision),
      replacements,
    );
    request.currentSceneReference = {
      sceneId: sceneA,
      flowId: flow.flowId,
      flowVersion: flow.version,
    };
    request.flowDefinitionReference = {
      catalogueVersion: VYVA_FLOW_CATALOGUE.catalogueVersion,
      flowId: flow.flowId,
      version: flow.version,
      status: flow.status,
      sessionEligibility: "existing_session",
    };
    request.availablePresentationCandidates = [{
      presentationId: presentation.presentationId,
      version: presentation.version,
      familyId: presentation.familyId,
      sceneId: presentation.sceneId,
      supportedFlowIds: [...presentation.supportedFlowIds],
      status: presentation.status,
      currentEligibility: "eligible",
    }];
    decision.auditRecord.flowId = flow.flowId;
    decision.auditRecord.flowVersion = flow.version;
    const plan = decision.approvedPresentationPlan!;
    plan.presentationId = presentation.presentationId;
    plan.version = presentation.version;
    plan.familyId = presentation.familyId;
    plan.flowId = flow.flowId;
    plan.flowVersion = flow.version;
    plan.sceneId = presentation.sceneId;
    plan.expectedInputReference = presentation.expectedInput
      ? {
        questionId: presentation.expectedInput.questionId,
        sceneId: presentation.expectedInput.sceneId,
        flowVersion: presentation.expectedInput.flowVersion,
      }
      : undefined;
    const destinationPresentation = VYVA_PRESENTATION_REGISTRY.presentations
      .find(
        (item) =>
          item.presentationId ===
          "presentation.trust.scam.exposure_questions",
      )!;
    if (includeDestination && destinationPresentation.expectedInput) {
      request.specialistResponse!.nextQuestion = clonePolicyFixture(
        destinationPresentation.expectedInput,
      );
      request.specialistResponse!.flowStateUpdate!.expectedInput =
        clonePolicyFixture(destinationPresentation.expectedInput);
      decision.approvedFlowStateProposal!.proposal.expectedInput =
        clonePolicyFixture(destinationPresentation.expectedInput);
      for (const item of [
        ...decision.findings,
        ...decision.adjudications,
      ]) {
        if (item.subjectType === "next_question") {
          item.subjectId = destinationPresentation.expectedInput.questionId;
        }
      }
    }
    plan.approvedActionIds = presentation.actions.map((item) => item.actionId);
    plan.approvedEventMappingIds = presentation.eventMappings.map(
      (item) => item.eventMappingId,
    );
    plan.approvedContentSlotIds = presentation.contentSlots.map(
      (item) => item.slotId,
    );
    const privacy = presentation.privacyTreatment;
    plan.approvedPrivacyPolicy = {
      sensitivity: privacy.sensitivity,
      screenObscuringAllowed: privacy.screenObscuringAllowed,
      hideInAppSwitcher: privacy.hideInAppSwitcher,
      screenshotPolicy: privacy.screenshotPolicy,
      recordingPolicy: privacy.recordingPolicy,
      evidencePreviewPolicy: privacy.evidencePreviewPolicy,
      autoClearPolicy: privacy.autoClearPolicy,
      consentNoticeRequired: privacy.consentNoticeRequired,
      retentionNoticeRequired: privacy.retentionNoticeRequired,
      shoulderSurfingWarning: privacy.shoulderSurfingWarning,
      caregiverVisibility: privacy.caregiverVisibility,
      operatorVisibility: privacy.operatorVisibility,
    };
    const safety = presentation.safetyTreatment;
    plan.approvedSafetyPolicy = {
      safetyCritical: safety.safetyCritical,
      urgency: safety.urgency,
      dismissalPolicy: safety.dismissalPolicy,
      deferPolicy: safety.deferPolicy,
      acknowledgementRequired: safety.acknowledgementRequired,
      confirmationRequired: safety.confirmationRequired,
      humanHelpAvailable: safety.humanHelpAvailable,
      emergencyActionVisible: safety.emergencyActionVisible,
      prohibitedClaims: [...safety.prohibitedClaims],
      requiredDisclaimers: [...safety.requiredDisclaimers],
      timeoutBehavior: safety.timeoutBehavior,
    };
    const voice = presentation.voiceSynchronization;
    plan.voiceSynchronizationDecision = {
      spokenContentSlotIds: [...voice.spokenContentSlotIds],
      screenVisibleContentSlotIds: presentation.contentSlots.map(
        (item) => item.slotId,
      ),
      interactionTiming: voice.screenUpdateTiming,
      bargeInAllowed: voice.bargeInAllowed,
      interruptSpeechOnSubmit: voice.interruptSpeechOnSubmit,
      acknowledgement: voice.acknowledgementPolicy,
      repetition: voice.repeatPolicy,
      silenceTimeoutSeconds: voice.silenceTimeoutPolicy.timeoutSeconds,
      captionsRequired: voice.captionsRequired,
      fallbackBehavior: voice.voiceFallbackBehavior,
    };
    if (decision.approvedResponsePlan) {
      decision.approvedResponsePlan.prohibitedClaims = Array.from(new Set([
        ...decision.approvedResponsePlan.prohibitedClaims,
        ...safety.prohibitedClaims,
      ]));
      decision.approvedResponsePlan.requiredDisclaimers = Array.from(new Set([
        ...decision.approvedResponsePlan.requiredDisclaimers,
        ...safety.requiredDisclaimers,
      ]));
      decision.approvedResponsePlan.localizationKeys = [
        ...presentation.localizationPolicy.requiredLocalizationKeys,
      ];
      const limitation = "Evidence remains user-provided and unverified.";
      const findingId = "finding-task4-scene-evidence-limitation";
      decision.findings.push({
        findingId,
        policyId: "policy.response_composition.allowed",
        category: "response_composition",
        severity: "informational",
        outcome: "allow",
        reasonCode: "EVIDENCE_LIMITATION_REQUIRED",
        subjectType: "response_guidance",
        subjectId: `${request.specialistResponse!.requestId}.response_guidance`,
        sourceReferenceIds: [request.specialistResponse!.requestId],
        auditSummary: "The evidence limitation is traceable.",
        createdAt: request.requestedAt,
        metadata: {},
      });
      decision.approvedResponsePlan.evidenceLimitations = [limitation];
      decision.approvedResponsePlan.evidenceLimitationReferences = [{
        text: limitation,
        policyFindingId: findingId,
        sourceReferenceId: request.specialistResponse!.requestId,
      }];
      decision.approvedResponsePlan.policyFindingIds.push(findingId);
      decision.auditRecord.findingIds.push(findingId);
    }
    decision.auditRecord.selectedPresentationId = presentation.presentationId;
    decision.auditRecord.selectedPresentationVersion = presentation.version;
    return { request, decision };
  }

  function completeRejectScenario() {
    const request = clonePolicyFixture(
      validRequestMoreInformationPolicyRequest,
    );
    const decision = clonePolicyFixture(validRequestMoreInformationDecision);
    decision.verdict = "reject";
    decision.rejectionCode = "NO_APPROVED_ACTION";
    decision.adjudications.forEach((item) => {
      item.decision = "reject";
      item.constraints = [];
    });
    decision.approvedFlowStateProposal = undefined;
    decision.approvedPresentationPlan = undefined;
    decision.approvedResponsePlan = undefined;
    decision.auditRecord.verdict = "reject";
    decision.auditRecord.selectedPresentationId = undefined;
    decision.auditRecord.selectedPresentationVersion = undefined;
    decision.auditRecord.constraintIds = [];
    return { request, decision };
  }

  const concreteRejectSubjectTypes = [
    "response_guidance",
    "next_question",
    "ui_instruction",
    "presentation",
    "memory_read",
    "memory_write",
    "tool_call",
    "escalation",
    "flow_state_update",
    "completion",
    "followup",
  ] as const;

  function concreteRejectScenario(
    target: typeof concreteRejectSubjectTypes[number],
  ) {
    const request = clonePolicyFixture(
      ["next_question", "ui_instruction"].includes(target)
        ? validRequestMoreInformationPolicyRequest
        : target === "presentation"
          ? validPresentationPolicyRequest
          : target === "tool_call"
            ? validToolPolicyRequest
            : validSpecialistResponsePolicyRequest,
    );
    request.stage = target === "presentation"
      ? "delivery_approval"
      : "proposal_adjudication";
    if (request.specialistResponse) {
      const response = request.specialistResponse;
      if (["memory_read", "memory_write", "followup"].includes(target)) {
        response.status = "answered";
        response.nextQuestion = undefined;
        response.proposedToolCalls = [];
        response.escalation = undefined;
        response.flowStateUpdate = undefined;
        response.completionResult = undefined;
        response.memoryReadsRequested = target === "memory_read"
          ? [{
            category: "health.summary",
            reason: "Read an approved summary.",
            required: true,
            sensitivityCeiling: "sensitive",
          }]
          : [];
        response.memoryWritesProposed = target === "memory_write"
          ? [{
            category: "health.summary",
            value: { summaryReferenceId: "summary-reject" },
            sensitivity: "internal",
            reason: "Classify a proposed write.",
            expiry: "2026-08-01T10:00:00.000Z",
            requiresUserConfirmation: false,
            target: "working_memory",
          }]
          : [];
        response.followUpRecommendation = target === "followup"
          ? {
            purpose: "Offer an approved follow-up.",
            preferredChannel: "pwa",
            fallbackChannels: ["text"],
            requiresConsent: true,
            reason: "The user may want to continue later.",
            delaySeconds: 3600,
            summary: "A follow-up was proposed.",
          }
          : undefined;
      }
      if (target === "escalation") {
        response.status = "escalated";
        response.nextQuestion = undefined;
        response.proposedToolCalls = [];
        response.flowStateUpdate = undefined;
        response.completionResult = undefined;
        response.escalation = {
          type: "technical",
          reasonCode: "TECHNICAL_HELP_REQUIRED",
          urgency: "routine",
          summary: "Technical help was proposed.",
          requiresConsent: false,
          recommendedChannel: "pwa",
        };
      }
    }
    request.evaluationId = `evaluation-task4-reject-${target}`;
    request.activeAuditContext.correlationIds = Array.from(new Set([
      request.interactionEvent.eventId,
      request.interactionEvent.correlationId!,
      request.sessionId,
      request.evaluationId,
    ]));
    request.proposalRetentionDescriptors = [];
    const subjects = collectAdjudicableSubjects(request);
    const policyFor = (subjectType: typeof subjects[number]["subjectType"]) => {
      if (subjectType === "presentation") {
        return ["policy.presentation.allowed", "presentation"] as const;
      }
      if (subjectType === "tool_call") {
        return [
          "policy.tool.outside_flow_narrow_exception", "tool",
        ] as const;
      }
      if (["memory_read", "memory_write"].includes(subjectType)) {
        return ["policy.memory.allowed", "memory"] as const;
      }
      if (subjectType === "escalation") {
        return ["policy.escalation.allowed", "escalation"] as const;
      }
      if (subjectType === "flow_state_update" ||
        subjectType === "completion") {
        return ["policy.flow_update.allowed", "flow_update"] as const;
      }
      if (subjectType === "followup") {
        return ["policy.followup.allowed", "followup"] as const;
      }
      if (subjectType === "response_guidance") {
        return [
          "policy.response_composition.allowed", "response_composition",
        ] as const;
      }
      return ["policy.specialist.valid", "specialist_validity"] as const;
    };
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.decisionId = `decision-task4-reject-${target}`;
    decision.evaluationId = request.evaluationId;
    decision.stage = request.stage;
    decision.findings = subjects.map((subject, index) => {
      const [policyId, category] = policyFor(subject.subjectType);
      return {
        findingId: `finding-task4-reject-${target}-${index}`,
        policyId,
        category,
        severity: "informational" as const,
        outcome: "allow" as const,
        reasonCode: "PROPOSAL_REJECTED",
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        sourceReferenceIds: [subject.subjectId],
        auditSummary: "The concrete proposal was explicitly adjudicated.",
        createdAt: request.requestedAt,
        metadata: {},
      };
    });
    decision.adjudications = subjects.map((subject, index) => ({
      adjudicationId: `adjudication-task4-reject-${target}-${index}`,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      decision: "reject" as const,
      policyFindingIds: [`finding-task4-reject-${target}-${index}`],
      constraints: [],
      approvedAt: request.requestedAt,
      metadata: {},
    }));
    decision.consentAuthorizations = [];
    decision.toolAuthorizations = [];
    decision.memoryAuthorizations = [];
    decision.approvedFlowStateProposal = undefined;
    decision.approvedPresentationPlan = undefined;
    decision.approvedResponsePlan = undefined;
    decision.followUpAuthorization = undefined;
    decision.escalationAuthorization = undefined;
    Object.assign(decision.auditRecord, {
      auditDecisionId: `audit-task4-reject-${target}`,
      evaluationId: request.evaluationId,
      decisionId: decision.decisionId,
      policyStage: request.stage,
      flowId: request.flowDefinitionReference.flowId,
      flowVersion: request.flowDefinitionReference.version,
      specialistRequestId: request.specialistRequest?.requestId,
      specialistResponseId: request.specialistResponse?.requestId,
      selectedPresentationId: undefined,
      selectedPresentationVersion: undefined,
      findingIds: decision.findings.map((item) => item.findingId),
      adjudicationIds: decision.adjudications.map(
        (item) => item.adjudicationId,
      ),
      constraintIds: [],
    });
    return { request, decision, targetSubject: subjects.find(
      (subject) => subject.subjectType === target,
    )! };
  }

  it("accepts reject only when every actionable proposal is rejected", () => {
    const { request, decision } = completeRejectScenario();
    expect(validateOrchestratorPolicyDecision(request, decision).verdict)
      .toBe("reject");
  });

  it("rejects removal of all rejection adjudications", () => {
    const { request, decision } = completeRejectScenario();
    decision.adjudications = [];
    decision.auditRecord.adjudicationIds = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it.each(POLICY_SUBJECT_TYPES)(
    "declares reject completeness for %s",
    (subjectType) => {
      expect(POLICY_SUBJECT_TYPES).toContain(subjectType);
      expect(ORCHESTRATOR_VERDICT_COMPATIBILITY.reject.adjudicationDecisions)
        .toEqual(["reject"]);
    },
  );

  it.each(
    collectAdjudicableSubjects(validRequestMoreInformationPolicyRequest),
  )("reject fails when $subjectType is omitted", (omitted) => {
    const { request, decision } = completeRejectScenario();
    decision.adjudications = decision.adjudications.filter(
      (item) =>
        item.subjectType !== omitted.subjectType ||
        item.subjectId !== omitted.subjectId,
    );
    decision.auditRecord.adjudicationIds = decision.adjudications.map(
      (item) => item.adjudicationId,
    );
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it("lists all eleven concrete reject subjects independently", () => {
    expect(concreteRejectSubjectTypes).toEqual([
      "response_guidance", "next_question", "ui_instruction", "presentation",
      "memory_read", "memory_write", "tool_call", "escalation",
      "flow_state_update", "completion", "followup",
    ]);
  });

  it.each(concreteRejectSubjectTypes)(
    "concretely rejects %s and rejects omission or non-reject decisions",
    (subjectType) => {
      const { request, decision, targetSubject } =
        concreteRejectScenario(subjectType);
      expect(validateOrchestratorPolicyDecision(request, decision).verdict)
        .toBe("reject");
      const omitted = clonePolicyFixture(decision);
      omitted.adjudications = omitted.adjudications.filter(
        (item) =>
          item.subjectType !== targetSubject.subjectType ||
          item.subjectId !== targetSubject.subjectId,
      );
      omitted.auditRecord.adjudicationIds = omitted.adjudications.map(
        (item) => item.adjudicationId,
      );
      expectContractError(
        () => validateOrchestratorPolicyDecision(request, omitted),
        "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
      );
      for (const incompatible of [
        "approve", "approve_with_constraints", "require_confirmation", "defer",
      ] as const) {
        const changed = clonePolicyFixture(decision);
        const adjudication = changed.adjudications.find(
          (item) =>
            item.subjectType === targetSubject.subjectType &&
            item.subjectId === targetSubject.subjectId,
        )!;
        adjudication.decision = incompatible;
        if (["approve_with_constraints", "require_confirmation"].includes(
          incompatible,
        )) {
          adjudication.constraints = [{
            constraintId: `constraint-task4-reject-${subjectType}`,
            type: "require_user_confirmation",
            reasonCode: "USER_CONFIRMATION_REQUIRED",
            subjectId: targetSubject.subjectId,
            sourcePolicyId: decision.findings.find(
              (item) => item.subjectId === targetSubject.subjectId,
            )!.policyId,
            parameters: {},
          }];
          changed.auditRecord.constraintIds = [
            `constraint-task4-reject-${subjectType}`,
          ];
        }
        expectContractError(
          () => validateOrchestratorPolicyDecision(request, changed),
          "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
        );
      }
    },
  );

  it.each([
    "account_123456789",
    "account-123456789",
    "acct_123456789",
    "bank_account_123456789",
    "card_4111111111111111",
    "routing-number-123456789",
    "sort-code-123456",
    "wallet-account-123456789",
  ])("rejects labeled financial audit value %s", (value) => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.auditRecord.metadata = { note: value };
    expectContractError(
      () => parseOrchestratorPolicyDecision(decision),
      "ORCHESTRATOR_AUDIT_VALUE_INVALID",
    );
  });

  it("rejects nested and array-nested labeled financial audit values", () => {
    for (const metadata of [
      { nested: { note: "account_123456789" } },
      { entries: [{ note: "bank_account_123456789" }] },
    ]) {
      const decision = clonePolicyFixture(validRejectPolicyDecision);
      decision.auditRecord.metadata = metadata;
      expectContractError(
        () => parseOrchestratorPolicyDecision(decision),
        "ORCHESTRATOR_AUDIT_VALUE_INVALID",
      );
    }
  });

  it.each(["accountPolicy", "accountRequired", "audit.account_policy"])(
    "permits restrained architecture identifier %s",
    (value) => {
      const decision = clonePolicyFixture(validRejectPolicyDecision);
      decision.auditRecord.metadata = { note: value };
      expect(parseOrchestratorPolicyDecision(decision).auditRecord.metadata)
        .toEqual({ note: value });
    },
  );

  it("rejects a directive self-subject reference", () => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.systemDirectives = [{
      directiveId: "directive-self",
      type: "require_current_state_refresh",
      sourcePolicyId: "policy.correlation.current",
      reasonCode: "CURRENT_STATE_REQUIRED",
      flowReference: {
        flowId: validIngressPolicyRequest.flowDefinitionReference.flowId,
        flowVersion: validIngressPolicyRequest.flowDefinitionReference.version,
      },
      subjectReferences: ["directive-self"],
      nonExecutable: true,
    }];
    decision.auditRecord.directiveIds = ["directive-self"];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validIngressPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_REFERENCE_SELF_CYCLE",
    );
  });

  it("rejects a constraint self-subject reference", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.verdict = "approve_with_constraints";
    decision.auditRecord.verdict = "approve_with_constraints";
    Object.assign(decision.adjudications[0], {
      decision: "approve_with_constraints",
      constraints: [{
        constraintId: "constraint-self",
        type: "require_current_correlation",
        subjectId: "constraint-self",
        sourcePolicyId: "policy.presentation.allowed",
        reasonCode: "CURRENT_CORRELATION_REQUIRED",
        parameters: {},
      }],
    });
    decision.auditRecord.constraintIds = ["constraint-self"];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_REFERENCE_SELF_CYCLE",
    );
  });

  it("rejects an adjudication self-subject reference", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.adjudications[0].subjectId =
      decision.adjudications[0].adjudicationId;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_REFERENCE_SELF_CYCLE",
    );
  });

  it("rejects an adjudication ID reused by its constraint", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.verdict = "approve_with_constraints";
    decision.auditRecord.verdict = "approve_with_constraints";
    const adjudication = decision.adjudications[0];
    adjudication.decision = "approve_with_constraints";
    adjudication.constraints = [{
      constraintId: adjudication.adjudicationId,
      type: "require_current_correlation",
      subjectId: adjudication.subjectId,
      sourcePolicyId: "policy.presentation.allowed",
      reasonCode: "CURRENT_CORRELATION_REQUIRED",
      parameters: {},
    }];
    decision.auditRecord.constraintIds = [adjudication.adjudicationId];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_REFERENCE_SELF_CYCLE",
    );
  });

  it("rejects an adjudication ID reused as its finding reference", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.adjudications[0].policyFindingIds = [
      decision.adjudications[0].adjudicationId,
    ];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_REFERENCE_SELF_CYCLE",
    );
  });

  it("rejects ordinary delivery between two individually valid scenes", () => {
    const { request, decision } = sceneDeliveryScenario(sceneB, false);
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        request,
        decision,
      ),
      "ORCHESTRATOR_SCENE_TRANSITION_INVALID",
    );
  });

  it("accepts a valid destination declared by the approved next question and Flow update", () => {
    const { request, decision } = sceneDeliveryScenario(sceneB, true);
    expect(validateOrchestratorPolicyDecision(request, decision)
      .approvedPresentationPlan?.sceneId).toBe(sceneB);
  });

  it("rejects a valid Presentation scene that differs from the approved destination", () => {
    const { request, decision } = sceneDeliveryScenario(sceneC, true);
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_SCENE_TRANSITION_INVALID",
    );
  });

  it("publishes independent verdict, consent, escalation and stage matrices", () => {
    expect(Object.fromEntries(
      Object.entries(ORCHESTRATOR_VERDICT_COMPATIBILITY).map(
        ([verdict, rule]) => [verdict, rule.adjudicationDecisions],
      ),
    )).toEqual(INDEPENDENT_VERDICT_ADJUDICATION_EXPECTATIONS);
    expect(Object.keys(INDEPENDENT_VERDICT_ADJUDICATION_EXPECTATIONS).sort())
      .toEqual([...ORCHESTRATOR_VERDICTS].sort());
    expect(ORCHESTRATOR_PLAN_CATEGORIES).toHaveLength(13);
    expect(ORCHESTRATOR_CONSENT_ACTIONS).toHaveLength(18);
    expect(ORCHESTRATOR_CONSENT_TEST_DIMENSIONS).toHaveLength(8);
    expect(ORCHESTRATOR_ESCALATION_TYPES).toHaveLength(5);
    expect(ORCHESTRATOR_CONSENT_COMPATIBILITY_MATRIX).toHaveLength(18 * 8);
    expect(ORCHESTRATOR_ESCALATION_COMPATIBILITY_MATRIX)
      .toHaveLength(5 * 14);
    expect(ORCHESTRATOR_ESCALATION_TEST_DIMENSIONS).toHaveLength(14);
    expect(ORCHESTRATOR_RESUME_PROOF_CASES).toHaveLength(12);
    expect(ORCHESTRATOR_DIRECT_SELF_REFERENCE_CASES).toHaveLength(7);
    expect(ORCHESTRATOR_STAGE_VERDICT_COMPATIBILITY)
      .toEqual(INDEPENDENT_STAGE_VERDICT_EXPECTATIONS);
    expect(Object.keys(INDEPENDENT_STAGE_VERDICT_EXPECTATIONS).sort())
      .toEqual([...ORCHESTRATOR_POLICY_STAGES].sort());
  });

  function setStageCorrelation<
    TRequest extends { stage: string },
    TDecision extends {
      stage: string;
      auditRecord: { policyStage: string };
    },
  >(
    request: TRequest,
    decision: TDecision,
    stage: typeof ORCHESTRATOR_POLICY_STAGES[number],
  ) {
    request.stage = stage;
    decision.stage = stage;
    decision.auditRecord.policyStage = stage;
    return { request, decision };
  }

  function invocationStageScenario(
    verdict: "approve" | "reject" | "safe_fail",
  ) {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.evaluationId = `evaluation-task4-stage-invocation-${verdict}`;
    request.activeAuditContext.correlationIds.push(request.evaluationId);
    request.stage = "specialist_invocation";
    request.specialistRequest = clonePolicyFixture(
      validSpecialistResponsePolicyRequest.specialistRequest,
    );
    const decision = verdict === "safe_fail"
      ? clonePolicyFixture(validSafeFailureDecision)
      : clonePolicyFixture(validRejectPolicyDecision);
    decision.decisionId = `decision-task4-stage-invocation-${verdict}`;
    decision.evaluationId = request.evaluationId;
    decision.stage = request.stage;
    decision.verdict = verdict;
    decision.rejectionCode = verdict === "reject"
      ? "SPECIALIST_INVOCATION_REJECTED"
      : undefined;
    if (verdict === "safe_fail") {
      decision.safeFailurePlan = clonePolicyFixture(
        validSafeFailureDecision.safeFailurePlan,
      );
    }
    decision.specialistInvocationAuthorization = {
      decision: verdict === "approve" ? "approved" : "denied",
      specialistRequestId: request.specialistRequest!.requestId,
      excludedMemoryReferenceIds: [],
      excludedEvidenceReferenceIds: [],
      excludedContextReferenceIds: [],
      policyFindingIds: [],
      nonExecutable: true,
    };
    Object.assign(decision.auditRecord, {
      auditDecisionId: `audit-task4-stage-invocation-${verdict}`,
      evaluationId: request.evaluationId,
      decisionId: decision.decisionId,
      policyStage: request.stage,
      verdict,
      specialistRequestId: request.specialistRequest!.requestId,
    });
    return { request, decision };
  }

  function deferredResponseStageScenario(
    stage: "specialist_response" | "proposal_adjudication",
  ) {
    const { request, decision } =
      concreteRejectScenario("response_guidance");
    setStageCorrelation(request, decision, stage);
    decision.verdict = "defer";
    decision.rejectionCode = undefined;
    decision.adjudications.forEach((item) => {
      item.decision = "defer";
      item.constraints = [];
    });
    decision.deferPlan = {
      reasonCode: "ROUTINE_WORK_DEFERRED",
      resumability: "policy_revalidation",
      deferredAdjudicationIds: decision.adjudications.map(
        (item) => item.adjudicationId,
      ),
      directiveIds: [],
      policyFindingIds: decision.findings.map((item) => item.findingId),
      nonExecutable: true,
    };
    decision.auditRecord.verdict = "defer";
    return { request, decision };
  }

  function technicalEscalationStageScenario(
    stage: "specialist_response" | "proposal_adjudication" |
      "presentation_approval" | "delivery_approval",
  ) {
    const { request, decision, targetSubject } =
      concreteRejectScenario("escalation");
    setStageCorrelation(request, decision, stage);
    if (
      ["presentation_approval", "delivery_approval"].includes(stage)
    ) {
      request.availablePresentationCandidates = clonePolicyFixture(
        validPresentationPolicyRequest.availablePresentationCandidates,
      );
    }
    const catalogueCandidate = clonePolicyFixture(
      memoryEnabledFlowCatalogueFixture,
    );
    const flow = catalogueCandidate.flows.find(
      (item) => item.flowId === request.flowDefinitionReference.flowId,
    )!;
    const safetyCheckId = flow.deterministicSafetyChecks[0];
    flow.escalationRules = [{
      ruleId: "health.preventive_check.caregiver.stage_matrix",
      safetyCheckIds: [safetyCheckId],
      target: "caregiver",
      requiresConsent: true,
    }];
    flow.consentRequirements.push({
      scope: "caregiver_disclosure",
      timing: "before_action",
      revocable: true,
      reusable: false,
      purposeSpecific: true,
    });
    request.specialistResponse!.safetyFlags = [safetyCheckId];
    request.specialistResponse!.escalation!.reasonCode = safetyCheckId;
    request.specialistResponse!.escalation!.type = "caregiver";
    request.specialistResponse!.escalation!.targetId = "caregiver-stage";
    request.specialistResponse!.escalation!.requiresConsent = true;
    request.escalationContext.caregiverDisclosureAllowed = true;
    request.consentContext.scopes.push("caregiver_disclosure");
    request.consentContext.decisions.push({
      scope: "caregiver_disclosure",
      decisionId: `consent-task4-stage-${stage}`,
      status: "granted",
      authorizationBasis: "explicit_user_consent",
      purpose: "purpose.caregiver_disclosure",
      decidedAt: request.requestedAt,
      requiresRevalidation: false,
      permittedChannels: ["pwa"],
    });
    decision.verdict = "escalate";
    decision.rejectionCode = undefined;
    decision.adjudications.find(
      (item) =>
        item.subjectType === targetSubject.subjectType &&
        item.subjectId === targetSubject.subjectId,
    )!.decision = "approve";
    const finding = decision.findings.find(
      (item) => item.subjectId === targetSubject.subjectId,
    )!;
    finding.sourceReferenceIds = [safetyCheckId];
    decision.consentAuthorizations = [{
      authorizationId: `consent-authorization-task4-stage-${stage}`,
      scope: "caregiver_disclosure",
      consentDecisionId: `consent-task4-stage-${stage}`,
      authorizationBasis: "explicit_user_consent",
      purpose: "purpose.caregiver_disclosure",
      decision: "allow",
      policyFindingIds: [finding.findingId],
    }];
    decision.escalationAuthorization = {
      authorizationId: `authorization-task4-stage-${stage}`,
      subjectId: targetSubject.subjectId,
      type: "caregiver",
      urgency: "routine",
      targetId: "caregiver-stage",
      approvedChannel: "pwa",
      consentAuthorizationIds: [
        `consent-authorization-task4-stage-${stage}`,
      ],
      policyFindingIds: [finding.findingId],
      nonExecutable: true,
    };
    decision.auditRecord.verdict = "escalate";
    return {
      request,
      decision,
      options: { flowCatalogue: parseFlowCatalogue(catalogueCandidate) },
    };
  }

  function safeFailureStageScenario(
    stage: typeof ORCHESTRATOR_POLICY_STAGES[number],
  ) {
    if (stage === "specialist_invocation") {
      return { ...invocationStageScenario("safe_fail"), options: {} };
    }
    const request = clonePolicyFixture(validSafeFailurePolicyRequest);
    const decision = clonePolicyFixture(validSafeFailureDecision);
    setStageCorrelation(request, decision, stage);
    if (["specialist_response", "proposal_adjudication"].includes(stage)) {
      request.specialistRequest = clonePolicyFixture(
        validSpecialistResponsePolicyRequest.specialistRequest,
      );
      request.specialistResponse = clonePolicyFixture(
        validSpecialistResponsePolicyRequest.specialistResponse,
      );
      decision.auditRecord.specialistRequestId =
        request.specialistRequest!.requestId;
      decision.auditRecord.specialistResponseId =
        request.specialistResponse!.requestId;
    }
    if (["presentation_approval", "delivery_approval"].includes(stage)) {
      request.availablePresentationCandidates = clonePolicyFixture(
        validPresentationPolicyRequest.availablePresentationCandidates,
      );
    }
    return { request, decision, options: {} };
  }

  function validStageVerdictScenario(
    stage: typeof ORCHESTRATOR_POLICY_STAGES[number],
    verdict: typeof ORCHESTRATOR_VERDICTS[number],
  ) {
    if (verdict === "safe_fail") return safeFailureStageScenario(stage);
    if (stage === "specialist_invocation") {
      return { ...invocationStageScenario(
        verdict as "approve" | "reject",
      ), options: {} };
    }
    if (verdict === "reject") {
      if (stage === "ingress") {
        return {
          request: clonePolicyFixture(validIngressPolicyRequest),
          decision: clonePolicyFixture(validRejectPolicyDecision),
          options: {},
        };
      }
      const scenario = concreteRejectScenario(
        ["presentation_approval", "delivery_approval"].includes(stage)
          ? "presentation"
          : "response_guidance",
      );
      setStageCorrelation(scenario.request, scenario.decision, stage);
      return { ...scenario, options: {} };
    }
    if (verdict === "approve") {
      if (["presentation_approval", "delivery_approval"].includes(stage)) {
        const request = clonePolicyFixture(validPresentationPolicyRequest);
        const decision = clonePolicyFixture(validPresentationApprovalDecision);
        setStageCorrelation(request, decision, stage);
        return { request, decision, options: {} };
      }
      const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
      const decision = clonePolicyFixture(validSpecialistApprovalDecision);
      setStageCorrelation(request, decision, stage);
      return { request, decision, options: {} };
    }
    if (verdict === "approve_with_constraints") {
      if (["presentation_approval", "delivery_approval"].includes(stage)) {
        const request = clonePolicyFixture(validPresentationPolicyRequest);
        const decision = clonePolicyFixture(validPresentationApprovalDecision);
        setStageCorrelation(request, decision, stage);
        decision.verdict = "approve_with_constraints";
        decision.auditRecord.verdict = "approve_with_constraints";
        decision.adjudications[0].decision = "approve_with_constraints";
        decision.adjudications[0].constraints = [{
          constraintId: `constraint-task4-stage-${stage}`,
          type: "require_current_correlation",
          subjectId: decision.adjudications[0].subjectId,
          sourcePolicyId: decision.findings[0].policyId,
          reasonCode: "CURRENT_CORRELATION_REQUIRED",
          parameters: {},
        }];
        decision.auditRecord.constraintIds = [
          `constraint-task4-stage-${stage}`,
        ];
        return { request, decision, options: {} };
      }
      const request = clonePolicyFixture(validToolPolicyRequest);
      const decision = clonePolicyFixture(validToolAuthorizationDecision);
      setStageCorrelation(request, decision, stage);
      if (["presentation_approval", "delivery_approval"].includes(stage)) {
        request.availablePresentationCandidates = clonePolicyFixture(
          validPresentationPolicyRequest.availablePresentationCandidates,
        );
      }
      return { request, decision, options: {} };
    }
    if (verdict === "request_more_information") {
      const request = clonePolicyFixture(
        validRequestMoreInformationPolicyRequest,
      );
      const decision = clonePolicyFixture(validRequestMoreInformationDecision);
      setStageCorrelation(request, decision, stage);
      return { request, decision, options: {} };
    }
    if (verdict === "defer") {
      if (["specialist_response", "proposal_adjudication"].includes(stage)) {
        return {
          ...deferredResponseStageScenario(stage),
          options: {},
        };
      }
      const request = clonePolicyFixture(validPresentationPolicyRequest);
      const decision = clonePolicyFixture(validDeferPolicyDecision);
      setStageCorrelation(request, decision, stage);
      return { request, decision, options: {} };
    }
    return technicalEscalationStageScenario(
      stage as "specialist_response" | "proposal_adjudication" |
        "presentation_approval" | "delivery_approval",
    );
  }

  const independentStageVerdictCases =
    ORCHESTRATOR_POLICY_STAGES.flatMap((stage) =>
      ORCHESTRATOR_VERDICTS.map((verdict) => ({
        stage,
        verdict,
        expected: INDEPENDENT_STAGE_VERDICT_EXPECTATIONS[stage]
          .includes(verdict as never),
      })));

  it.each(independentStageVerdictCases)(
    "request-aware stage matrix: $stage + $verdict => $expected",
    ({ stage, verdict, expected }) => {
      if (expected) {
        const { request, decision, options } =
          validStageVerdictScenario(stage, verdict);
        expect(parseOrchestratorPolicyEvaluationRequest(request, options).stage)
          .toBe(stage);
        expect(parseOrchestratorPolicyDecision(decision).verdict).toBe(verdict);
        expect(validateOrchestratorPolicyDecision(
          request,
          decision,
          options,
        ).verdict).toBe(verdict);
        return;
      }
      const baseline = safeFailureStageScenario(
        stage === "safe_failure" ? stage : (
          INDEPENDENT_STAGE_VERDICT_EXPECTATIONS[stage].includes(
            "safe_fail" as never,
          ) ? stage : "safe_failure"
        ),
      );
      if (baseline.request.stage !== stage) {
        setStageCorrelation(baseline.request, baseline.decision, stage);
      }
      baseline.decision.verdict = verdict;
      baseline.decision.auditRecord.verdict = verdict;
      expect(() => validateOrchestratorPolicyDecision(
        baseline.request,
        baseline.decision,
        baseline.options,
      )).toThrow(OrchestrationContractError);
    },
  );

  const independentAdjudicationDecisions = [
    "approve",
    "approve_with_constraints",
    "require_confirmation",
    "defer",
    "reject",
  ] as const;

  function setProbeAdjudicationDecision(
    decision: OrchestratorPolicyDecision,
    adjudicationIndex: number,
    mode: typeof independentAdjudicationDecisions[number],
  ) {
    const adjudication = decision.adjudications[adjudicationIndex];
    adjudication.decision = mode;
    adjudication.constraints =
      ["approve_with_constraints", "require_confirmation"].includes(mode)
        ? [{
            constraintId: `constraint-task4-verdict-${mode}`,
            type: mode === "require_confirmation"
              ? "require_user_confirmation"
              : "require_current_correlation",
            subjectId: adjudication.subjectId,
            sourcePolicyId: decision.findings.find(
              (item) => item.findingId === adjudication.policyFindingIds[0],
            )!.policyId,
            reasonCode: mode === "require_confirmation"
              ? "USER_CONFIRMATION_REQUIRED"
              : "CURRENT_CORRELATION_REQUIRED",
            parameters: {},
          }]
        : [];
    decision.auditRecord.constraintIds = decision.adjudications.flatMap(
      (item) => item.constraints.map((constraint) => constraint.constraintId),
    );
  }

  function verdictAdjudicationScenario(
    verdict: typeof ORCHESTRATOR_VERDICTS[number],
    adjudicationDecision: typeof independentAdjudicationDecisions[number],
    expected: boolean,
  ) {
    if (verdict === "approve") {
      const request = clonePolicyFixture(validPresentationPolicyRequest);
      const decision = clonePolicyFixture(validPresentationApprovalDecision);
      if (!expected) setProbeAdjudicationDecision(decision, 0, adjudicationDecision);
      return {
        request,
        decision,
        options: {},
        subject: "presentation",
        category: "Presentation plan",
      };
    }
    if (verdict === "approve_with_constraints") {
      const request = clonePolicyFixture(validToolPolicyRequest);
      const decision = clonePolicyFixture(validToolAuthorizationDecision);
      const index = adjudicationDecision === "approve"
        ? decision.adjudications.findIndex((item) => item.decision === "approve")
        : decision.adjudications.findIndex(
          (item) => item.decision === "approve_with_constraints",
        );
      if (!expected) {
        setProbeAdjudicationDecision(
          decision,
          Math.max(index, 0),
          adjudicationDecision,
        );
      }
      return {
        request,
        decision,
        options: {},
        subject: decision.adjudications[Math.max(index, 0)].subjectType,
        category: "Tool authorization",
      };
    }
    if (verdict === "request_more_information") {
      const request = clonePolicyFixture(
        validRequestMoreInformationPolicyRequest,
      );
      const decision = clonePolicyFixture(validRequestMoreInformationDecision);
      if (adjudicationDecision === "approve_with_constraints" && expected) {
        setProbeAdjudicationDecision(decision, 0, adjudicationDecision);
      } else if (!expected) {
        setProbeAdjudicationDecision(decision, 0, adjudicationDecision);
      }
      return {
        request,
        decision,
        options: {},
        subject: decision.adjudications[0].subjectType,
        category: "next-question plan",
      };
    }
    if (verdict === "defer") {
      const request = clonePolicyFixture(validPresentationPolicyRequest);
      const decision = clonePolicyFixture(validDeferPolicyDecision);
      if (!expected) setProbeAdjudicationDecision(decision, 0, adjudicationDecision);
      return {
        request,
        decision,
        options: {},
        subject: "presentation",
        category: "defer plan",
      };
    }
    if (verdict === "reject") {
      const { request, decision } = completeRejectScenario();
      if (!expected) setProbeAdjudicationDecision(decision, 0, adjudicationDecision);
      return {
        request,
        decision,
        options: {},
        subject: decision.adjudications[0].subjectType,
        category: "rejection plan",
      };
    }
    if (verdict === "escalate") {
      const scenario = technicalEscalationStageScenario(
        "proposal_adjudication",
      );
      const index = scenario.decision.adjudications.findIndex(
        (item) => item.subjectType === "escalation",
      );
      if (
        adjudicationDecision === "approve_with_constraints" && expected ||
        !expected
      ) {
        setProbeAdjudicationDecision(
          scenario.decision,
          index,
          adjudicationDecision,
        );
      }
      return {
        ...scenario,
        subject: "escalation",
        category: "escalation authorization",
      };
    }
    const request = clonePolicyFixture(validSafeFailurePolicyRequest);
    const decision = clonePolicyFixture(validSafeFailureDecision);
    request.availablePresentationCandidates = clonePolicyFixture(
      validPresentationPolicyRequest.availablePresentationCandidates,
    );
    decision.findings = clonePolicyFixture(
      validPresentationApprovalDecision.findings,
    );
    decision.adjudications = clonePolicyFixture(
      validPresentationApprovalDecision.adjudications,
    );
    setProbeAdjudicationDecision(decision, 0, adjudicationDecision);
    decision.auditRecord.findingIds = decision.findings.map(
      (item) => item.findingId,
    );
    decision.auditRecord.adjudicationIds = decision.adjudications.map(
      (item) => item.adjudicationId,
    );
    return {
      request,
      decision,
      options: {},
      subject: "presentation",
      category: "safe-failure plan",
    };
  }

  const independentVerdictAdjudicationCases =
    ORCHESTRATOR_VERDICTS.flatMap((verdict) =>
      independentAdjudicationDecisions.map((adjudicationDecision) => ({
        verdict,
        adjudicationDecision,
        expected: INDEPENDENT_VERDICT_ADJUDICATION_EXPECTATIONS[verdict]
          .includes(adjudicationDecision as never),
      })));

  it.each(independentVerdictAdjudicationCases)(
    "request-aware verdict matrix: $verdict + $adjudicationDecision => $expected",
    ({ verdict, adjudicationDecision, expected }) => {
      const scenario = verdictAdjudicationScenario(
        verdict,
        adjudicationDecision,
        expected,
      );
      const label = [
        verdict,
        scenario.subject,
        adjudicationDecision,
        scenario.category,
      ].join(" / ");
      if (expected) {
        expect(
          validateOrchestratorPolicyDecision(
            scenario.request,
            scenario.decision,
            scenario.options,
          ).verdict,
          label,
        ).toBe(verdict);
        return;
      }
      expect(
        () => validateOrchestratorPolicyDecision(
          scenario.request,
          scenario.decision,
          scenario.options,
        ),
        label,
      ).toThrow(OrchestrationContractError);
    },
  );

  it("rejects a verdict outside the independently declared stage matrix", () => {
    const request = clonePolicyFixture(validSafeFailurePolicyRequest);
    const decision = clonePolicyFixture(validSafeFailureDecision);
    decision.verdict = "reject";
    decision.rejectionCode = "SAFE_FAILURE_REJECTED";
    decision.safeFailurePlan = undefined;
    decision.auditRecord.verdict = "reject";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it("publishes a limit for every required bounded collection", () => {
    expect(Object.keys(ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS).sort())
      .toEqual([
        "adjudications", "assignments", "auditCorrelations", "candidates",
        "availableTools", "consentAuthorizations", "constraints", "directives",
        "escalationAuthorizations", "findings", "memoryAuthorizations",
        "responseFacts", "retentionDescriptors", "toolAuthorizations",
      ].sort());
    expect(Object.values(ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS).every(
      (limit) => Number.isInteger(limit) && limit > 0,
    )).toBe(true);
  });

  const boundedDecisionCases = [
    "findings",
    "adjudications",
    "constraints",
    "consentAuthorizations",
    "toolAuthorizations",
    "memoryAuthorizations",
    "directives",
    "responseFacts",
    "assignments",
  ] as const;

  function boundedDecision(
    collection: typeof boundedDecisionCases[number],
    count: number,
  ) {
    const decision = clonePolicyFixture(validToolAuthorizationDecision);
    if (collection === "findings") {
      decision.findings = Array.from({ length: count }, (_, index) => ({
        ...decision.findings[0],
        findingId: `finding-bound-${index}`,
      }));
    } else if (collection === "adjudications") {
      decision.adjudications = Array.from({ length: count }, (_, index) => ({
        ...decision.adjudications[0],
        adjudicationId: `adjudication-bound-${index}`,
      }));
    } else if (collection === "constraints") {
      decision.adjudications[0].constraints = Array.from(
        { length: count },
        (_, index) => ({
          ...decision.adjudications[0].constraints[0],
          constraintId: `constraint-bound-${index}`,
        }),
      );
    } else if (collection === "consentAuthorizations") {
      decision.consentAuthorizations = Array.from(
        { length: count },
        (_, index) => ({
          ...decision.consentAuthorizations[0],
          authorizationId: `consent-bound-${index}`,
        }),
      );
    } else if (collection === "toolAuthorizations") {
      decision.toolAuthorizations = Array.from(
        { length: count },
        (_, index) => ({
          ...decision.toolAuthorizations[0],
          authorizationId: `tool-bound-${index}`,
        }),
      );
    } else if (collection === "memoryAuthorizations") {
      decision.memoryAuthorizations = Array.from(
        { length: count },
        (_, index) => ({
          authorizationId: `memory-bound-${index}`,
          subjectId: `memory-subject-${index}`,
          adjudicationId: `memory-adjudication-${index}`,
          operation: "read" as const,
          category: "memory-category",
          target: "working_memory" as const,
          decision: "reject" as const,
          sensitivityCeiling: "sensitive" as const,
          maximumRetention: "session" as const,
          consentAuthorizationIds: [],
          policyFindingIds: [],
          nonExecutable: true as const,
        }),
      );
    } else if (collection === "directives") {
      decision.systemDirectives = Array.from(
        { length: count },
        (_, index) => ({
          directiveId: `directive-bound-${index}`,
          type: "require_current_state_refresh" as const,
          sourcePolicyId: "policy.correlation.current",
          reasonCode: "CURRENT_STATE_REQUIRED",
          flowReference: {
            flowId: validToolPolicyRequest.flowDefinitionReference.flowId,
            flowVersion:
              validToolPolicyRequest.flowDefinitionReference.version,
          },
          subjectReferences: [],
          nonExecutable: true as const,
        }),
      );
    } else if (collection === "responseFacts") {
      decision.approvedResponsePlan!.approvedFacts = Array.from(
        { length: count },
        (_, index) => ({
          ...decision.approvedResponsePlan!.approvedFacts[0],
          factId: `fact-bound-${index}`,
        }),
      );
    } else {
      decision.approvedResponsePlan!.contentSlotAssignments = Array.from(
        { length: count },
        (_, index) => ({
          contentSlotId: `slot.bound_${index}`,
          factIds: [],
          localizationKey: `copy.bound_${index}`,
        }),
      );
    }
    return decision;
  }

  it.each(boundedDecisionCases)(
    "%s accepts its exact bound and rejects one above",
    (collection) => {
      const limit = collection === "constraints"
        ? ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS.constraints
        : ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS[
          collection === "directives"
            ? "directives"
            : collection
        ];
      expect(orchestratorPolicyDecisionSchema.safeParse(
        boundedDecision(collection, limit),
      ).success).toBe(true);
      expect(orchestratorPolicyDecisionSchema.safeParse(
        boundedDecision(collection, limit + 1),
      ).success).toBe(false);
    },
  );

  it("candidate and audit-correlation bounds accept limit and reject overflow", () => {
    const candidate = validPresentationPolicyRequest
      .availablePresentationCandidates[0];
    const candidateLimit = ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS.candidates;
    const auditLimit =
      ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS.auditCorrelations;
    for (const [field, limit] of [
      ["availablePresentationCandidates", candidateLimit],
      ["audit", auditLimit],
    ] as const) {
      const atLimit = clonePolicyFixture(validPresentationPolicyRequest);
      const overLimit = clonePolicyFixture(validPresentationPolicyRequest);
      if (field === "availablePresentationCandidates") {
        atLimit.availablePresentationCandidates = Array.from(
          { length: limit },
          () => candidate,
        );
        overLimit.availablePresentationCandidates = Array.from(
          { length: limit + 1 },
          () => candidate,
        );
      } else {
        atLimit.activeAuditContext.correlationIds = Array.from(
          { length: limit },
          (_, index) => `correlation-bound-${index}`,
        );
        overLimit.activeAuditContext.correlationIds = Array.from(
          { length: limit + 1 },
          (_, index) => `correlation-bound-${index}`,
        );
      }
      expect(orchestratorPolicyEvaluationRequestSchema.safeParse(atLimit)
        .success).toBe(true);
      expect(orchestratorPolicyEvaluationRequestSchema.safeParse(overLimit)
        .success).toBe(false);
    }
  });

  it("available Tool descriptors accept their exact bound and reject overflow", () => {
    const limit = ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS.availableTools;
    const build = (count: number) => {
      const request = clonePolicyFixture(validToolPolicyRequest);
      request.toolPolicyContext.availableTools = Array.from(
        { length: count },
        (_, index) => ({
          ...request.toolPolicyContext.availableTools[0],
          toolId: `tool.bound.${index}`,
        }),
      );
      request.toolPolicyContext.allowedToolIds = [];
      return request;
    };
    expect(orchestratorPolicyEvaluationRequestSchema.safeParse(build(limit))
      .success).toBe(true);
    expect(orchestratorPolicyEvaluationRequestSchema.safeParse(build(limit + 1))
      .success).toBe(false);
  });

  it.each([
    ["image", "image_retention"],
    ["document", "document_retention"],
  ] as const)(
    "derives missing %s retention consent from an approved descriptor",
    (evidenceType, consentScopeRequired) => {
      const request = clonePolicyFixture(
        validRequestMoreInformationPolicyRequest,
      );
      request.proposalRetentionDescriptors = [{
        subjectType: "ui_instruction",
        subjectId: "instruction-task4-choice",
        evidenceType,
        processingMode: "retained",
        retentionTarget: "external_tool",
        retentionPurpose: "purpose.evidence_retention",
        consentScopeRequired,
        noticeRequired: true,
        retentionClass: "long_term",
        metadata: {},
      }];
      expectContractError(
        () => validateOrchestratorPolicyDecision(
          request,
          validRequestMoreInformationDecision,
        ),
        "CONSENT_ACTION_NOT_AUTHORIZED",
      );
    },
  );

  it("does not treat temporary nonpersistent evidence as retention", () => {
    const request = clonePolicyFixture(
      validRequestMoreInformationPolicyRequest,
    );
    request.proposalRetentionDescriptors = [{
      subjectType: "ui_instruction",
      subjectId: "instruction-task4-choice",
      evidenceType: "image",
      processingMode: "transient",
      retentionTarget: "none",
      retentionPurpose: "purpose.transient_analysis",
      noticeRequired: false,
      retentionClass: "none",
      metadata: {},
    }];
    expect(validateOrchestratorPolicyDecision(
      request,
      validRequestMoreInformationDecision,
    ).verdict).toBe("request_more_information");
  });

  it("rejects a retained proposal without a retention notice", () => {
    const request = clonePolicyFixture(
      validRequestMoreInformationPolicyRequest,
    );
    request.proposalRetentionDescriptors = [{
      subjectType: "ui_instruction",
      subjectId: "instruction-task4-choice",
      evidenceType: "document",
      processingMode: "retained",
      retentionTarget: "postgres",
      retentionPurpose: "purpose.document_retention",
      consentScopeRequired: "document_retention",
      noticeRequired: false,
      retentionClass: "long_term",
      metadata: {},
    }];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        request,
        validRequestMoreInformationDecision,
      ),
      "ORCHESTRATOR_POLICY_REQUEST_INVALID",
    );
  });

  it("requires a retention descriptor for every approved Tool proposal", () => {
    const request = clonePolicyFixture(validToolPolicyRequest);
    request.proposalRetentionDescriptors = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        request,
        validToolAuthorizationDecision,
      ),
      "ORCHESTRATOR_RETENTION_DESCRIPTOR_REQUIRED",
    );
  });

  it.each([
    ["show_image_upload", "image"],
    ["show_document_upload", "document"],
  ] as const)(
    "requires a retention descriptor for approved %s evidence UI",
    (type) => {
      const request = clonePolicyFixture(
        validRequestMoreInformationPolicyRequest,
      );
      request.specialistResponse!.uiInstructions[0].type = type;
      request.specialistResponse!.uiInstructions[0].payload =
        type === "show_image_upload"
          ? { prompt: "Upload an image." }
          : {
              prompt: "Upload a document.",
              acceptedTypes: ["application/pdf"],
            };
      request.proposalRetentionDescriptors = [];
      const registry = clonePolicyFixture(VYVA_PRESENTATION_REGISTRY);
      const presentation = registry.presentations.find(
        (item) =>
          item.presentationId ===
          validRequestMoreInformationDecision.approvedPresentationPlan!
            .presentationId,
      )!;
      presentation.supportedUIInstructionTypes.push(type);
      registry.families.find(
        (item) => item.familyId === presentation.familyId,
      )!.supportedUIInstructionTypes.push(type);
      expectContractError(
        () => validateOrchestratorPolicyDecision(
          request,
          validRequestMoreInformationDecision,
          { presentationRegistry: registry },
        ),
        "ORCHESTRATOR_RETENTION_DESCRIPTOR_REQUIRED",
      );
    },
  );

  it("rejects duplicate retention classifications for one subject", () => {
    const request = clonePolicyFixture(validToolPolicyRequest);
    request.proposalRetentionDescriptors.push(
      clonePolicyFixture(request.proposalRetentionDescriptors[0]),
    );
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_RETENTION_POLICY_INVALID",
    );
  });

  it("bounds the mandatory retention registry", () => {
    const limit =
      ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS.retentionDescriptors;
    const base = clonePolicyFixture(validIngressPolicyRequest);
    const descriptor = clonePolicyFixture(
      validToolPolicyRequest.proposalRetentionDescriptors[0],
    );
    const atLimit = {
      ...base,
      proposalRetentionDescriptors: Array.from(
        { length: limit },
        (_, index) => ({
          ...descriptor,
          subjectType: "presentation" as const,
          subjectId: `presentation-bound-${index}`,
        }),
      ),
    };
    expect(orchestratorPolicyEvaluationRequestSchema.safeParse(atLimit).success)
      .toBe(true);
    expect(orchestratorPolicyEvaluationRequestSchema.safeParse({
      ...atLimit,
      proposalRetentionDescriptors: [
        ...atLimit.proposalRetentionDescriptors,
        { ...descriptor, subjectId: "presentation-bound-overflow" },
      ],
    }).success).toBe(false);
  });
});

describe("identity, correlation and eligibility", () => {
  it.each([
    ["userId", "different-user"],
    ["sessionId", "different-session"],
  ] as const)("rejects mismatched %s", (field, value) => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request[field] = value;
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_CORRELATION_INVALID",
    );
  });

  it("rejects an event Flow mismatch", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.interactionEvent.flowId = "health.other";
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_CORRELATION_INVALID",
    );
  });

  it("rejects an active Flow-version mismatch", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.activeFlowState.flowVersion = "9.9.9";
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_CORRELATION_INVALID",
    );
  });

  it("rejects a stale current question", () => {
    const request = clonePolicyFixture(validRequestMoreInformationPolicyRequest);
    request.activeFlowState = {
      ...request.activeFlowState,
      state: "waiting_for_user",
      expectedInput: preventiveChoicePresentation.expectedInput,
    };
    request.currentQuestionReference = {
      questionId: "question.stale",
      sceneId: preventiveChoicePresentation.sceneId,
      flowVersion: preventiveChoicePresentation.version,
    };
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_CORRELATION_INVALID",
    );
  });

  it("rejects a stale current scene", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.currentSceneReference = {
      sceneId: "health.stale.scene",
      flowId: request.flowDefinitionReference.flowId,
      flowVersion: request.flowDefinitionReference.version,
    };
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_CORRELATION_INVALID",
    );
  });

  it("rejects a Specialist not owned by the Flow", () => {
    const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
    request.specialistRequest!.specialistId = "unapproved_specialist";
    request.specialistResponse!.specialistId = "unapproved_specialist";
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "SPECIALIST_INVOCATION_NOT_ALLOWED",
    );
  });

  it("rejects a Specialist response/request mismatch", () => {
    const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
    request.specialistResponse!.requestId = "different-request";
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "REQUEST_ID_MISMATCH",
    );
  });

  it("rejects an unknown Flow version", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.flowDefinitionReference.version = "9.9.9";
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "FLOW_VERSION_NOT_ELIGIBLE",
    );
  });

  it("rejects an incompatible trigger and Channel", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.channelContext.triggerSource = "caregiver";
    request.interactionEvent.triggerSource = "caregiver";
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "INVALID_EVENT_TRIGGER",
    );
  });

  it("rejects a denied Channel", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.channelContext.allowed = false;
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "CHANNEL_AUTHORIZATION_DENIED",
    );
  });

  it("rejects revoked before-entry consent", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.consentContext.revokedScopes = ["health_data"];
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "CONSENT_REVOKED",
    );
  });

  it("rejects missing before-entry consent", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.consentContext.decisions = request.consentContext.decisions.filter(
      (decision) => decision.scope !== "health_data",
    );
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "CONSENT_AUTHORIZATION_REQUIRED",
    );
  });

  it("rejects a missing deterministic emergency check", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.safetyContext.emergencyChecked = false;
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "SAFETY_PRECEDENCE_REQUIRED",
    );
  });

  it("requires previous decision references to be in audit context", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.previousPolicyDecisionId = "decision-not-in-audit";
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_CORRELATION_INVALID",
    );
  });
});

describe("decision parsing, findings and adjudication", () => {
  it("parses a strict declarative decision", () => {
    expect(parseOrchestratorPolicyDecision(validRejectPolicyDecision))
      .toEqual(validRejectPolicyDecision);
  });

  it("rejects unknown decision fields and execution directives", () => {
    expectContractError(
      () => parseOrchestratorPolicyDecision({
        ...validRejectPolicyDecision,
        execute: true,
      }),
      "ORCHESTRATOR_POLICY_DECISION_INVALID",
    );
  });

  it("rejects unknown findings", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.findings[0].policyId = "policy.unknown";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_FINDING_INVALID",
    );
  });

  it("rejects findings for invented subjects", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.findings[0].subjectId = "presentation.invented";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_FINDING_INVALID",
    );
  });

  it("rejects an adjudication for an invented proposal", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.adjudications[0].subjectId = "presentation.invented";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_ADJUDICATION_INVALID",
    );
  });

  it("rejects duplicate adjudications", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.adjudications.push(
      clonePolicyFixture(decision.adjudications[0]),
    );
    decision.auditRecord.adjudicationIds.push(
      decision.adjudications[0].adjudicationId,
    );
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_POLICY_DECISION_INVALID",
    );
  });

  it("requires constraints for approve_with_constraints", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.verdict = "approve_with_constraints";
    decision.auditRecord.verdict = "approve_with_constraints";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it("validates an authority-narrowing constraint", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.verdict = "approve_with_constraints";
    decision.auditRecord.verdict = "approve_with_constraints";
    decision.adjudications[0].decision = "approve_with_constraints";
    decision.adjudications[0].constraints = [{
      constraintId: "constraint-task4-pwa-only",
      type: "restrict_channel",
      reasonCode: "PWA_ONLY",
      subjectId: preventiveChoicePresentation.presentationId,
      sourcePolicyId: "policy.presentation.allowed",
      parameters: { allowedChannels: ["pwa"] },
    }];
    decision.auditRecord.constraintIds = ["constraint-task4-pwa-only"];
    expect(validateOrchestratorPolicyDecision(
      validPresentationPolicyRequest,
      decision,
    )).toEqual(decision);
  });

  it("rejects a constraint that broadens Channel authority", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.verdict = "approve_with_constraints";
    decision.auditRecord.verdict = "approve_with_constraints";
    decision.adjudications[0].decision = "approve_with_constraints";
    decision.adjudications[0].constraints = [{
      constraintId: "constraint-task4-broaden-channel",
      type: "restrict_channel",
      reasonCode: "INVALID_CHANNEL_EXPANSION",
      subjectId: preventiveChoicePresentation.presentationId,
      sourcePolicyId: "policy.presentation.allowed",
      parameters: { allowedChannels: ["caregiver"] },
    }];
    decision.auditRecord.constraintIds = [
      "constraint-task4-broaden-channel",
    ];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_CONSTRAINT_INVALID",
    );
  });

  it("rejects lower-precedence approval beside a higher denial", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.findings.push({
      findingId: "finding-task4-presentation-denied",
      policyId: "policy.presentation.denied",
      category: "presentation",
      severity: "blocking",
      outcome: "deny",
      reasonCode: "PRESENTATION_DENIED",
      subjectType: "presentation",
      subjectId: preventiveChoicePresentation.presentationId,
      sourceReferenceIds: [preventiveChoicePresentation.presentationId],
      auditSummary: "The presentation is denied.",
      createdAt: "2026-07-31T10:00:00.000Z",
      metadata: {},
    });
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_PRECEDENCE_VIOLATION",
    );
  });

  it("resolves every Task 2 proposal subject deterministically", () => {
    expect(collectAdjudicableSubjects(
      validSpecialistResponsePolicyRequest,
    )).toEqual(expect.arrayContaining([
      {
        subjectType: "flow_state_update",
        subjectId: "request-task4-specialist.flow_state_update",
      },
      {
        subjectType: "completion",
        subjectId: "request-task4-specialist.completion",
      },
    ]));
  });
});

describe("verdict and authorization invariants", () => {
  it("validates a presentation approval", () => {
    expect(validateOrchestratorPolicyDecision(
      validPresentationPolicyRequest,
      validPresentationApprovalDecision,
    )).toEqual(validPresentationApprovalDecision);
  });

  it("validates a Specialist completion and Flow proposal", () => {
    expect(validateOrchestratorPolicyDecision(
      validSpecialistResponsePolicyRequest,
      validSpecialistApprovalDecision,
    )).toEqual(validSpecialistApprovalDecision);
  });

  it("validates request-more-information with question, Flow and Presentation", () => {
    expect(validateOrchestratorPolicyDecision(
      validRequestMoreInformationPolicyRequest,
      validRequestMoreInformationDecision,
    )).toEqual(validRequestMoreInformationDecision);
  });

  it("validates a non-executing Tool authorization", () => {
    expect(validateOrchestratorPolicyDecision(
      validToolPolicyRequest,
      validToolAuthorizationDecision,
    )).toEqual(validToolAuthorizationDecision);
  });

  it("rejects mismatched expected Tool result types", () => {
    const decision = clonePolicyFixture(validToolAuthorizationDecision);
    decision.toolAuthorizations[0].expectedResultType =
      "schema_task4_wrong_output";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validToolPolicyRequest,
        decision,
      ),
      "TOOL_AUTHORIZATION_DENIED",
    );
  });

  it("rejects a Tool unavailable to the policy context", () => {
    const request = clonePolicyFixture(validToolPolicyRequest);
    request.toolPolicyContext.availableTools = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        request,
        validToolAuthorizationDecision,
      ),
      "TOOL_AUTHORIZATION_DENIED",
    );
  });

  it("rejects weakened Tool confirmation", () => {
    const decision = clonePolicyFixture(validToolAuthorizationDecision);
    decision.toolAuthorizations[0].confirmationRequired = false;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validToolPolicyRequest,
        decision,
      ),
      "TOOL_AUTHORIZATION_DENIED",
    );
  });

  it("rejects missing Tool idempotency", () => {
    const decision = clonePolicyFixture(validToolAuthorizationDecision);
    decision.toolAuthorizations[0].idempotencyRequired = false;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validToolPolicyRequest,
        decision,
      ),
      "TOOL_AUTHORIZATION_DENIED",
    );
  });

  it("rejects Tool authorization when external Tool consent is denied", () => {
    const request = clonePolicyFixture(validToolPolicyRequest);
    request.consentContext.externalToolUseAllowed = false;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        request,
        validToolAuthorizationDecision,
      ),
      "TOOL_AUTHORIZATION_DENIED",
    );
  });

  it("rejects request-more-information without waiting-for-user approval", () => {
    const decision = clonePolicyFixture(validRequestMoreInformationDecision);
    decision.approvedFlowStateProposal = undefined;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validRequestMoreInformationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_REVERSE_ADJUDICATION_MISSING",
    );
  });

  it("rejects defer without a defer plan", () => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.verdict = "defer";
    decision.rejectionCode = undefined;
    decision.auditRecord.verdict = "defer";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validIngressPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it("rejects rejection without a safe code", () => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.rejectionCode = undefined;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validIngressPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it("rejects escalation without authorization", () => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.verdict = "escalate";
    decision.rejectionCode = undefined;
    decision.auditRecord.verdict = "escalate";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validIngressPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it("rejects safe failure without a safe-failure plan", () => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.verdict = "safe_fail";
    decision.rejectionCode = undefined;
    decision.auditRecord.verdict = "safe_fail";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validIngressPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it("validates a non-executing safe-failure decision", () => {
    expect(validateOrchestratorPolicyDecision(
      validSafeFailurePolicyRequest,
      validSafeFailureDecision,
    )).toEqual(
      validSafeFailureDecision,
    );
  });

  it("rejects a safe failure without a fallback", () => {
    const decision = clonePolicyFixture(validSafeFailureDecision);
    decision.safeFailurePlan!.approvedVoiceFallbackPolicy = undefined;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validSafeFailurePolicyRequest,
        decision,
      ),
      "SAFE_FAILURE_INVALID",
    );
  });

  it("rejects an invalid Flow transition", () => {
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    decision.approvedFlowStateProposal!.fromState = "idle";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validSpecialistResponsePolicyRequest,
        decision,
      ),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("rejects an outcome absent from the Flow catalogue", () => {
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    decision.approvedFlowStateProposal!.completionOutcomeId =
      "health.preventive_check.invented";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validSpecialistResponsePolicyRequest,
        decision,
      ),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });
});

describe("Presentation, voice/UI and response composition", () => {
  it.each([
    ["approvedChannel", "caregiver"],
    ["approvedDeviceClass", "watch"],
    ["approvedLocale", "xx"],
  ] as const)("rejects incompatible presentation %s", (field, value) => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    Object.assign(decision.approvedPresentationPlan!, { [field]: value });
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      field === "approvedDeviceClass"
        ? "ORCHESTRATOR_POLICY_DECISION_INVALID"
        : "PRESENTATION_AUTHORIZATION_DENIED",
    );
  });

  it("rejects a missing candidate", () => {
    const request = clonePolicyFixture(validPresentationPolicyRequest);
    request.availablePresentationCandidates[0].currentEligibility =
      "ineligible";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        request,
        validPresentationApprovalDecision,
      ),
      "PRESENTATION_AUTHORIZATION_DENIED",
    );
  });

  it("rejects a stale expected-input reference", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.approvedPresentationPlan!.expectedInputReference!.questionId =
      "question.stale";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "PRESENTATION_AUTHORIZATION_DENIED",
    );
  });

  it("rejects a noncanonical fallback", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.approvedPresentationPlan!.approvedFallbackPresentationId =
      "presentation.invented.fallback";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "PRESENTATION_AUTHORIZATION_DENIED",
    );
  });

  it("requires captions when speech accompanies a screen", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.approvedPresentationPlan!
      .voiceSynchronizationDecision.captionsRequired = false;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "VOICE_UI_POLICY_MISMATCH",
    );
  });

  it("rejects provider voice IDs as unknown plan fields", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    Object.assign(
      decision.approvedPresentationPlan!.voiceSynchronizationDecision,
      { providerVoiceId: "voice-provider-001" },
    );
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_POLICY_DECISION_INVALID",
    );
  });

  it("rejects unsupported Specialist facts", () => {
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    decision.approvedResponsePlan!.approvedFacts[0].text =
      "An unsupported diagnosis.";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validSpecialistResponsePolicyRequest,
        decision,
      ),
      "RESPONSE_COMPOSITION_DENIED",
    );
  });

  it("preserves prohibited claims", () => {
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    decision.approvedResponsePlan!.prohibitedClaims = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validSpecialistResponsePolicyRequest,
        decision,
      ),
      "RESPONSE_COMPOSITION_DENIED",
    );
  });
});

describe("safety, consent, safe failure and audit", () => {
  it("does not permit routine approval to downgrade emergency safety", () => {
    const request = clonePolicyFixture(validPresentationPolicyRequest);
    request.safetyContext.deterministicSafetyResult = "emergency";
    request.safetyContext.riskLevel = "emergency";
    request.safetyContext.emergencyPresentationRequired = true;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        request,
        validPresentationApprovalDecision,
      ),
      "SAFETY_PRECEDENCE_REQUIRED",
    );
  });

  it("does not allow revoked consent authorization", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.consentContext.revokedScopes = ["health_data"];
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "CONSENT_REVOKED",
    );
  });

  it("rejects a purpose-mismatched consent authorization", () => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.consentAuthorizations = [{
      authorizationId: "authorization-task4-consent",
      scope: "health_data",
      consentDecisionId: "consent-task4-health",
      authorizationBasis: "explicit_user_consent",
      purpose: "purpose.unrelated",
      decision: "allow",
      policyFindingIds: [],
    }];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validIngressPolicyRequest,
        decision,
      ),
      "CONSENT_AUTHORIZATION_REQUIRED",
    );
  });

  it("accepts a policy-referenced non-executing system directive", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.systemDirectives = [{
      directiveId: "directive-task4-human-review",
      type: "require_human_review",
      sourcePolicyId: "policy.safety.checked",
      reasonCode: "HUMAN_REVIEW_REQUIRED",
      flowReference: {
        flowId: validPresentationPolicyRequest.flowDefinitionReference.flowId,
        flowVersion:
          validPresentationPolicyRequest.flowDefinitionReference.version,
      },
      subjectReferences: [preventiveChoicePresentation.presentationId],
      nonExecutable: true,
    }];
    decision.auditRecord.directiveIds = ["directive-task4-human-review"];
    expect(validateOrchestratorPolicyDecision(
      validPresentationPolicyRequest,
      decision,
    )).toEqual(decision);
  });

  it("rejects mismatched audit correlation", () => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.auditRecord.evaluationId = "different-evaluation";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validIngressPolicyRequest,
        decision,
      ),
      "AUDIT_DECISION_INVALID",
    );
  });

  it("rejects missing audit finding references", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.auditRecord.findingIds = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "AUDIT_DECISION_INVALID",
    );
  });

  it("rejects duplicate decision IDs", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.systemDirectives = [{
      directiveId: decision.findings[0].findingId,
      type: "require_human_review",
      sourcePolicyId: "policy.safety.checked",
      reasonCode: "HUMAN_REVIEW_REQUIRED",
      flowReference: {
        flowId: validPresentationPolicyRequest.flowDefinitionReference.flowId,
        flowVersion:
          validPresentationPolicyRequest.flowDefinitionReference.version,
      },
      subjectReferences: [preventiveChoicePresentation.presentationId],
      nonExecutable: true,
    }];
    decision.auditRecord.directiveIds = [decision.findings[0].findingId];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_POLICY_DECISION_INVALID",
    );
  });

  it("rejects raw provider errors in a safe-failure plan", () => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    Object.assign(decision, {
      providerError: "stack content",
    });
    expectContractError(
      () => parseOrchestratorPolicyDecision(decision),
      "ORCHESTRATOR_POLICY_DECISION_INVALID",
    );
  });
});

describe("Task 4 focused hardening", () => {
  it.each([
    ["presentation", validPresentationPolicyRequest,
      validPresentationApprovalDecision, "presentation"],
    ["Flow update", validSpecialistResponsePolicyRequest,
      validSpecialistApprovalDecision, "flow_state_update"],
    ["response", validSpecialistResponsePolicyRequest,
      validSpecialistApprovalDecision, "response_guidance"],
  ] as const)("requires reverse adjudication for %s plans", (
    _label,
    request,
    sourceDecision,
    subjectType,
  ) => {
    const decision = clonePolicyFixture(sourceDecision);
    decision.adjudications = decision.adjudications.filter(
      (item) => item.subjectType !== subjectType,
    );
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_REVERSE_ADJUDICATION_MISSING",
    );
  });

  it("rejects a supplied plan whose adjudication has no finding", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.adjudications[0].policyFindingIds = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_REVERSE_ADJUDICATION_MISSING",
    );
  });

  it.each([
    "approvedFlowStateProposal",
    "approvedPresentationPlan",
    "approvedResponsePlan",
    "followUpAuthorization",
    "escalationAuthorization",
  ] as const)("reject verdict forbids %s", (field) => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    if (field === "approvedFlowStateProposal") {
      decision.approvedFlowStateProposal =
        clonePolicyFixture(validSpecialistApprovalDecision
          .approvedFlowStateProposal);
    } else if (field === "approvedPresentationPlan") {
      decision.approvedPresentationPlan =
        clonePolicyFixture(validPresentationApprovalDecision
          .approvedPresentationPlan);
    } else if (field === "approvedResponsePlan") {
      decision.approvedResponsePlan =
        clonePolicyFixture(validSpecialistApprovalDecision
          .approvedResponsePlan);
    } else if (field === "followUpAuthorization") {
      decision.followUpAuthorization = {
        authorizationId: "followup-reject",
        subjectId: "followup-reject",
        adjudicationId: "adjudication-reject",
        purpose: "Rejected follow-up",
        approvedChannel: "pwa",
        fallbackChannels: [],
        delaySeconds: 60,
        consentAuthorizationIds: [],
        noResponseDecision: {
          retryAllowed: false,
          fallbackAllowed: false,
          escalationAfterNoResponse: false,
          humanReviewRequired: false,
        },
        policyFindingIds: [],
        nonExecutable: true,
      };
    } else {
      decision.escalationAuthorization = {
        authorizationId: "escalation-reject",
        subjectId: "escalation-reject",
        type: "operator",
        urgency: "routine",
        targetId: "operator-1",
        consentAuthorizationIds: [],
        policyFindingIds: [],
        nonExecutable: true,
      };
    }
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validIngressPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  function safeFailureWithFlowUpdate() {
    const decision = clonePolicyFixture(validSafeFailureDecision);
    decision.safeFailurePlan!.flowUpdateProposal = {
      approvalId: "safe-failure-flow-approval",
      subjectId: "system.safe_failure.flow_update",
      flowId: validSafeFailurePolicyRequest.flowDefinitionReference.flowId,
      flowVersion:
        validSafeFailurePolicyRequest.flowDefinitionReference.version,
      fromState: "active",
      toState: "failed",
      proposal: {
        nextLifecycleState: "failed",
        clearExpectedInput: true,
        reasonCode: "SAFE_FAILURE",
      },
      policyFindingIds: [],
      nonExecutable: true,
    };
    return decision;
  }

  it("validates a safe-failure Flow update through the shared validator", () => {
    expect(validateOrchestratorPolicyDecision(
      validSafeFailurePolicyRequest,
      safeFailureWithFlowUpdate(),
    ).verdict).toBe("safe_fail");
  });

  it.each([
    ["unrelated Flow", (decision: ReturnType<typeof safeFailureWithFlowUpdate>) => {
      decision.safeFailurePlan!.flowUpdateProposal!.flowId =
        "health.unrelated";
    }],
    ["stale version", (decision: ReturnType<typeof safeFailureWithFlowUpdate>) => {
      decision.safeFailurePlan!.flowUpdateProposal!.flowVersion = "9.9.9";
    }],
    ["invalid transition", (decision: ReturnType<typeof safeFailureWithFlowUpdate>) => {
      decision.safeFailurePlan!.flowUpdateProposal!.toState = "idle";
      decision.safeFailurePlan!.flowUpdateProposal!.proposal
        .nextLifecycleState = "idle";
    }],
    ["unknown completion", (decision: ReturnType<typeof safeFailureWithFlowUpdate>) => {
      decision.safeFailurePlan!.flowUpdateProposal!.toState = "completed";
      decision.safeFailurePlan!.flowUpdateProposal!.proposal
        .nextLifecycleState = "completed";
      decision.safeFailurePlan!.flowUpdateProposal!.completionOutcomeId =
        "health.unknown.outcome";
    }],
  ] as const)("rejects safe-failure %s", (_label, mutate) => {
    const decision = safeFailureWithFlowUpdate();
    mutate(decision);
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validSafeFailurePolicyRequest,
        decision,
      ),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("does not let a PWA Presentation constraint gain telephone", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.verdict = "approve_with_constraints";
    decision.auditRecord.verdict = "approve_with_constraints";
    decision.adjudications[0].decision = "approve_with_constraints";
    decision.adjudications[0].constraints = [{
      constraintId: "constraint-presentation-telephone",
      type: "restrict_channel",
      reasonCode: "RESTRICT_CHANNEL",
      subjectId: decision.adjudications[0].subjectId,
      sourcePolicyId: "policy.presentation.allowed",
      parameters: { allowedChannels: ["telephone"] },
    }];
    decision.auditRecord.constraintIds = ["constraint-presentation-telephone"];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_CONSTRAINT_INVALID",
    );
  });

  it.each([
    ["deterministic_safety", "missing-safety-reference"],
    ["flow_catalogue", "health.unknown.fact"],
  ] as const)("rejects unknown %s facts", (sourceType, sourceReferenceId) => {
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    decision.approvedResponsePlan!.approvedFacts[0] = {
      factId: "fact-unresolved",
      text: "Unresolved claim",
      sourceType,
      sourceReferenceId,
    };
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validSpecialistResponsePolicyRequest,
        decision,
      ),
      "RESPONSE_COMPOSITION_DENIED",
    );
  });

  it("rejects an unknown Presentation content slot", () => {
    const decision = clonePolicyFixture(validRequestMoreInformationDecision);
    decision.approvedResponsePlan!.contentSlotAssignments = [{
      contentSlotId: "slot.unknown",
      factIds: ["fact-task4-more-information"],
      localizationKey: "copy.unknown",
    }];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validRequestMoreInformationPolicyRequest,
        decision,
      ),
      "RESPONSE_COMPOSITION_DENIED",
    );
  });

  it("rejects an unsupported localization key", () => {
    const decision = clonePolicyFixture(validRequestMoreInformationDecision);
    decision.approvedResponsePlan!.localizationKeys.push("copy.unknown");
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validRequestMoreInformationPolicyRequest,
        decision,
      ),
      "RESPONSE_COMPOSITION_DENIED",
    );
  });

  it.each([
    ["sensitivity", "public"],
    ["screenObscuringAllowed", false],
    ["hideInAppSwitcher", false],
    ["screenshotPolicy", "allowed"],
    ["recordingPolicy", "allowed"],
    ["evidencePreviewPolicy", "none"],
    ["autoClearPolicy", "none"],
    ["consentNoticeRequired", false],
    ["retentionNoticeRequired", false],
    ["shoulderSurfingWarning", false],
    ["caregiverVisibility", "authorized_summary"],
    ["operatorVisibility", "authorized_case"],
  ] as const)("rejects Presentation privacy downgrade %s", (field, value) => {
    const { decision, presentationRegistry } =
      strictPresentationNonDowngradeScenario();
    Object.assign(
      decision.approvedPresentationPlan!.approvedPrivacyPolicy,
      { [field]: value },
    );
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
        { presentationRegistry },
      ),
      "PRESENTATION_PRIVACY_DOWNGRADE",
    );
  });

  it.each([
    ["safetyCritical", false],
    ["urgency", "routine"],
    ["dismissalPolicy", "allowed"],
    ["deferPolicy", "allowed"],
    ["acknowledgementRequired", false],
    ["confirmationRequired", false],
    ["humanHelpAvailable", false],
    ["emergencyActionVisible", false],
    ["prohibitedClaims", []],
    ["requiredDisclaimers", []],
    ["timeoutBehavior", "none"],
  ] as const)("rejects Presentation safety downgrade %s", (field, value) => {
    const { decision, presentationRegistry } =
      strictPresentationNonDowngradeScenario();
    Object.assign(
      decision.approvedPresentationPlan!.approvedSafetyPolicy,
      { [field]: value },
    );
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
        { presentationRegistry },
      ),
      "PRESENTATION_SAFETY_DOWNGRADE",
    );
  });

  it.each([
    ["acknowledgement", "none"],
    ["repetition", "none"],
    ["interactionTiming", "after_speech"],
    ["fallbackBehavior", "none"],
  ] as const)("rejects canonical voice/UI mismatch %s", (field, value) => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    Object.assign(
      decision.approvedPresentationPlan!.voiceSynchronizationDecision,
      { [field]: value },
    );
    const current =
      validPresentationApprovalDecision.approvedPresentationPlan!
        .voiceSynchronizationDecision[field];
    if (current === value) return;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "VOICE_UI_POLICY_MISMATCH",
    );
  });

  it("rejects a second approved pending Tool", () => {
    const request = clonePolicyFixture(validToolPolicyRequest);
    const decision = clonePolicyFixture(validToolAuthorizationDecision);
    const secondProposal = {
      ...clonePolicyFixture(request.specialistResponse!.proposedToolCalls[0]),
      proposalId: "proposal-task4-tool-2",
    };
    request.specialistResponse!.proposedToolCalls.push(secondProposal);
    const secondFinding = {
      ...clonePolicyFixture(decision.findings[0]),
      findingId: "finding-task4-tool-2",
      subjectId: secondProposal.proposalId,
      sourceReferenceIds: [secondProposal.proposalId],
    };
    decision.findings.push(secondFinding);
    decision.auditRecord.findingIds.push(secondFinding.findingId);
    const secondAdjudication = {
      ...clonePolicyFixture(decision.adjudications[0]),
      adjudicationId: "adjudication-task4-tool-2",
      subjectId: secondProposal.proposalId,
      policyFindingIds: [secondFinding.findingId],
      constraints: [{
        ...clonePolicyFixture(decision.adjudications[0].constraints[0]),
        constraintId: "constraint-task4-tool-2",
        subjectId: secondProposal.proposalId,
        sourcePolicyId: secondFinding.policyId,
      }],
    };
    decision.adjudications.push(secondAdjudication);
    decision.auditRecord.adjudicationIds.push(
      secondAdjudication.adjudicationId,
    );
    decision.auditRecord.constraintIds.push("constraint-task4-tool-2");
    decision.toolAuthorizations.push({
      ...clonePolicyFixture(decision.toolAuthorizations[0]),
      authorizationId: "authorization-task4-tool-2",
      proposalId: secondProposal.proposalId,
      adjudicationId: secondAdjudication.adjudicationId,
      policyFindingIds: [secondFinding.findingId],
    });
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "TOOL_CARDINALITY_VIOLATION",
    );
  });

  it("rejects a new Tool while another Tool is pending", () => {
    const request = clonePolicyFixture(validToolPolicyRequest);
    request.activeFlowState.state = "waiting_for_tool";
    request.activeFlowState.pendingTool = {
      toolId: "existing-tool",
      requestId: "existing-proposal",
      startedAt: request.requestedAt,
    };
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        request,
        validToolAuthorizationDecision,
      ),
      "TOOL_CARDINALITY_VIOLATION",
    );
  });

  it("supports a Task 3-validated injected Flow catalogue snapshot", () => {
    expect(parseOrchestratorPolicyEvaluationRequest(
      validIngressPolicyRequest,
      { flowCatalogue: memoryEnabledFlowCatalogueFixture },
    ).flowDefinitionReference.flowId).toBe("health.preventive_check");
  });

  it("rejects an invalid injected Flow catalogue", () => {
    const catalogue = clonePolicyFixture(VYVA_FLOW_CATALOGUE);
    catalogue.flows[1].flowId = catalogue.flows[0].flowId;
    catalogue.flows[1].version = catalogue.flows[0].version;
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(
        validIngressPolicyRequest,
        { flowCatalogue: catalogue },
      ),
      "FLOW_ID_DUPLICATE",
    );
  });

  function memoryReadScenario() {
    const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
    request.evaluationId = "evaluation-task4-memory-read";
    request.activeAuditContext.correlationIds.push(request.evaluationId);
    request.specialistResponse!.status = "answered";
    request.specialistResponse!.flowStateUpdate = undefined;
    request.specialistResponse!.completionResult = undefined;
    request.specialistResponse!.memoryReadsRequested = [{
      category: "health.summary",
      reason: "Use the approved health summary.",
      required: true,
      sensitivityCeiling: "sensitive",
    }];
    request.memoryPolicyContext = {
      readAllowed: true,
      writeAllowed: true,
      mem0Allowed: true,
      allowedReadCategories: ["health.summary"],
      allowedWriteCategories: [
        "health.summary",
        "health.working_note",
        "health.longitudinal_summary",
      ],
      prohibitedCategories: ["health.hidden_reasoning"],
      permittedTargets: ["postgres", "mem0", "working_memory"],
      sensitivityCeiling: "sensitive",
      maximumRetention: "long_term",
    };
    request.consentContext.scopes.push("memory_read");
    request.consentContext.decisions.push({
      scope: "memory_read",
      decisionId: "consent-task4-memory-read",
      status: "granted",
      authorizationBasis: "explicit_user_consent",
      purpose: "purpose.memory_read",
      decidedAt: request.requestedAt,
      requiresRevalidation: false,
    });
    const responseSubject =
      `${request.specialistResponse!.requestId}.response_guidance`;
    const memorySubject =
      `${request.specialistResponse!.requestId}.memory_read.0`;
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    Object.assign(decision, {
      decisionId: "decision-task4-memory-read",
      evaluationId: request.evaluationId,
      stage: request.stage,
      verdict: "approve",
      rejectionCode: undefined,
      findings: [{
        findingId: "finding-task4-memory-response",
        policyId: "policy.response_composition.allowed",
        category: "response_composition",
        severity: "informational",
        outcome: "allow",
        reasonCode: "RESPONSE_ALLOWED",
        subjectType: "response_guidance",
        subjectId: responseSubject,
        sourceReferenceIds: [request.specialistResponse!.requestId],
        auditSummary: "Response guidance is traceable.",
        createdAt: request.requestedAt,
        metadata: {},
      }, {
        findingId: "finding-task4-memory-read",
        policyId: "policy.memory.allowed",
        category: "memory",
        severity: "informational",
        outcome: "allow",
        reasonCode: "MEMORY_READ_ALLOWED",
        subjectType: "memory_read",
        subjectId: memorySubject,
        sourceReferenceIds: [memorySubject],
        auditSummary: "Memory read is permitted by the injected Flow.",
        createdAt: request.requestedAt,
        metadata: {},
      }, {
        findingId: "finding-task4-memory-consent",
        policyId: "policy.consent.allowed",
        category: "consent",
        severity: "informational",
        outcome: "allow",
        reasonCode: "MEMORY_CONSENT_ALLOWED",
        subjectType: "memory_read",
        subjectId: memorySubject,
        sourceReferenceIds: ["consent-task4-memory-read"],
        auditSummary: "Purpose-specific memory consent is current.",
        createdAt: request.requestedAt,
        metadata: {},
      }],
      adjudications: [{
        adjudicationId: "adjudication-task4-memory-response",
        subjectType: "response_guidance",
        subjectId: responseSubject,
        decision: "approve",
        policyFindingIds: ["finding-task4-memory-response"],
        constraints: [],
        approvedAt: request.requestedAt,
        metadata: {},
      }, {
        adjudicationId: "adjudication-task4-memory-read",
        subjectType: "memory_read",
        subjectId: memorySubject,
        decision: "approve",
        policyFindingIds: ["finding-task4-memory-read"],
        constraints: [],
        approvedAt: request.requestedAt,
        metadata: {},
      }],
      consentAuthorizations: [{
        authorizationId: "authorization-task4-memory-consent",
        scope: "memory_read",
        consentDecisionId: "consent-task4-memory-read",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.memory_read",
        decision: "allow",
        policyFindingIds: ["finding-task4-memory-consent"],
      }],
      memoryAuthorizations: [{
        authorizationId: "authorization-task4-memory-read",
        subjectId: memorySubject,
        adjudicationId: "adjudication-task4-memory-read",
        operation: "read",
        category: "health.summary",
        decision: "approve",
        sensitivityCeiling: "sensitive",
        maximumRetention: "session",
        consentAuthorizationIds: ["authorization-task4-memory-consent"],
        policyFindingIds: ["finding-task4-memory-read"],
        nonExecutable: true,
      }],
      approvedResponsePlan: {
        approvedFacts: [{
          factId: "fact-task4-memory",
          text: request.specialistResponse!.responseGuidance.facts[0],
          sourceType: "specialist",
          sourceReferenceId: responseSubject,
        }],
        approvedAcknowledgements: [],
        approvedTone: "supportive",
        urgency: "routine",
        brevityPreference: "brief",
        prohibitedClaims:
          request.specialistResponse!.responseGuidance.prohibitedClaims,
        requiredDisclaimers: [],
        localizationKeys: [],
        contentSlotAssignments: [],
        evidenceLimitations: [],
        escalationLanguageRequirements: [],
        policyFindingIds: ["finding-task4-memory-response"],
      },
    });
    Object.assign(decision.auditRecord, {
      auditDecisionId: "audit-task4-memory-read",
      evaluationId: request.evaluationId,
      decisionId: decision.decisionId,
      policyStage: request.stage,
      verdict: "approve",
      specialistRequestId: request.specialistRequest!.requestId,
      specialistResponseId: request.specialistResponse!.requestId,
      findingIds: decision.findings.map((item) => item.findingId),
      adjudicationIds: decision.adjudications.map(
        (item) => item.adjudicationId,
      ),
    });
    return { request, decision };
  }

  it("authorizes a memory read only through a validated injected catalogue", () => {
    const { request, decision } = memoryReadScenario();
    expect(validateOrchestratorPolicyDecision(request, decision, {
      flowCatalogue: memoryEnabledFlowCatalogueFixture,
    }).memoryAuthorizations).toHaveLength(1);
  });

  it("keeps canonical catalogue memory denial intact", () => {
    const { request, decision } = memoryReadScenario();
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "MEMORY_AUTHORIZATION_DENIED",
    );
  });

  it("rejects a prohibited memory category under injected policy", () => {
    const { request, decision } = memoryReadScenario();
    request.specialistResponse!.memoryReadsRequested[0].category =
      "health.hidden_reasoning";
    decision.memoryAuthorizations[0].category = "health.hidden_reasoning";
    request.memoryPolicyContext.allowedReadCategories.push(
      "health.hidden_reasoning",
    );
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: memoryEnabledFlowCatalogueFixture,
      }),
      "MEMORY_AUTHORIZATION_DENIED",
    );
  });

  function memoryWriteScenario(
    target: "postgres" | "working_memory" | "mem0",
  ) {
    const { request, decision } = memoryReadScenario();
    const category = target === "postgres"
      ? "health.summary"
      : target === "working_memory"
        ? "health.working_note"
        : "health.longitudinal_summary";
    const scope = target === "mem0" ? "mem0_write" : "memory_write";
    const subject =
      `${request.specialistResponse!.requestId}.memory_write.0`;
    request.evaluationId = `evaluation-task4-memory-write-${target}`;
    request.activeAuditContext.correlationIds =
      request.activeAuditContext.correlationIds.filter(
        (id) => id !== "evaluation-task4-memory-read",
      );
    request.activeAuditContext.correlationIds.push(request.evaluationId);
    request.specialistResponse!.memoryReadsRequested = [];
    request.specialistResponse!.memoryWritesProposed = [{
      category,
      value: { summaryReferenceId: `summary-${target}` },
      sensitivity: "internal",
      reason: "Persist the approved summary.",
      expiry: "2026-08-01T10:00:00.000Z",
      requiresUserConfirmation: false,
      target,
    }];
    request.proposalRetentionDescriptors = [{
      subjectType: "memory_write",
      subjectId: subject,
      evidenceType: "structured_observation",
      processingMode: target === "working_memory"
        ? "transient"
        : "retained",
      retentionTarget: target,
      retentionPurpose: `purpose.${scope}`,
      consentScopeRequired: target === "working_memory" ? undefined : scope,
      noticeRequired: target !== "working_memory",
      retentionClass: target === "working_memory" ? "session" : "long_term",
      expiresAt: "2026-08-01T10:00:00.000Z",
      metadata: {},
    }];
    request.consentContext.scopes = request.consentContext.scopes.filter(
      (item) => item !== "memory_read",
    );
    if (!request.consentContext.scopes.includes(scope)) {
      request.consentContext.scopes.push(scope);
    }
    request.consentContext.decisions =
      request.consentContext.decisions.filter(
        (item) => item.scope !== "memory_read",
      );
    request.consentContext.decisions.push({
      scope,
      decisionId: `consent-task4-${scope}`,
      status: "granted",
      authorizationBasis: "explicit_user_consent",
      purpose: `purpose.${scope}`,
      decidedAt: request.requestedAt,
      requiresRevalidation: false,
    });
    if (target === "mem0") {
      request.consentContext.mem0Allowed = true;
      request.consentContext.scopes.push("memory_write");
      request.consentContext.decisions.push({
        scope: "memory_write",
        decisionId: "consent-task4-memory_write",
        status: "granted",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.memory_write",
        decidedAt: request.requestedAt,
        requiresRevalidation: false,
      });
    }
    decision.decisionId = `decision-task4-memory-write-${target}`;
    decision.evaluationId = request.evaluationId;
    Object.assign(decision.findings[1], {
      findingId: `finding-task4-memory-write-${target}`,
      reasonCode: "MEMORY_WRITE_ALLOWED",
      subjectType: "memory_write",
      subjectId: subject,
      sourceReferenceIds: [subject],
      auditSummary: "Memory write is permitted by the injected Flow.",
    });
    Object.assign(decision.findings[2], {
      findingId: `finding-task4-memory-write-consent-${target}`,
      reasonCode: "MEMORY_WRITE_CONSENT_ALLOWED",
      subjectType: "memory_write",
      subjectId: subject,
      sourceReferenceIds: [`consent-task4-${scope}`],
      auditSummary: "Purpose-specific memory-write consent is current.",
    });
    Object.assign(decision.adjudications[1], {
      adjudicationId: `adjudication-task4-memory-write-${target}`,
      subjectType: "memory_write",
      subjectId: subject,
      policyFindingIds: [`finding-task4-memory-write-${target}`],
    });
    Object.assign(decision.consentAuthorizations[0], {
      authorizationId: `authorization-task4-memory-write-consent-${target}`,
      scope,
      consentDecisionId: `consent-task4-${scope}`,
      purpose: `purpose.${scope}`,
      policyFindingIds: [
        `finding-task4-memory-write-consent-${target}`,
      ],
    });
    if (target === "mem0") {
      decision.findings.push({
        findingId: "finding-task4-memory-write-base-consent",
        policyId: "policy.consent.allowed",
        category: "consent",
        severity: "informational",
        outcome: "allow",
        reasonCode: "MEMORY_WRITE_BASE_CONSENT_ALLOWED",
        subjectType: "memory_write",
        subjectId: subject,
        sourceReferenceIds: ["consent-task4-memory_write"],
        auditSummary: "Base memory-write consent is current.",
        createdAt: request.requestedAt,
        metadata: {},
      });
      decision.consentAuthorizations.push({
        authorizationId: "authorization-task4-memory-write-base-consent",
        scope: "memory_write",
        consentDecisionId: "consent-task4-memory_write",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.memory_write",
        decision: "allow",
        policyFindingIds: ["finding-task4-memory-write-base-consent"],
      });
    }
    Object.assign(decision.memoryAuthorizations[0], {
      authorizationId: `authorization-task4-memory-write-${target}`,
      subjectId: subject,
      adjudicationId: `adjudication-task4-memory-write-${target}`,
      operation: "write",
      category,
      target,
      consentAuthorizationIds: [
        `authorization-task4-memory-write-consent-${target}`,
      ],
      policyFindingIds: [`finding-task4-memory-write-${target}`],
    });
    Object.assign(decision.auditRecord, {
      evaluationId: request.evaluationId,
      decisionId: decision.decisionId,
      findingIds: decision.findings.map((item) => item.findingId),
      adjudicationIds: decision.adjudications.map(
        (item) => item.adjudicationId,
      ),
    });
    return { request, decision };
  }

  it.each(["postgres", "working_memory", "mem0"] as const)(
    "authorizes an inert %s memory write through validated policy",
    (target) => {
      const { request, decision } = memoryWriteScenario(target);
      expect(validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: memoryEnabledFlowCatalogueFixture,
      }).memoryAuthorizations[0].target).toBe(target);
    },
  );

  it("requires a retention descriptor for an approved memory write", () => {
    const { request, decision } = memoryWriteScenario("postgres");
    request.proposalRetentionDescriptors = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: memoryEnabledFlowCatalogueFixture,
      }),
      "ORCHESTRATOR_RETENTION_DESCRIPTOR_REQUIRED",
    );
  });

  it("requires confirmation for a sensitive memory write", () => {
    const { request, decision } = memoryWriteScenario("postgres");
    request.specialistResponse!.memoryWritesProposed[0].sensitivity =
      "sensitive";
    request.specialistResponse!.memoryWritesProposed[0]
      .requiresUserConfirmation = true;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: memoryEnabledFlowCatalogueFixture,
      }),
      "MEMORY_AUTHORIZATION_DENIED",
    );
  });

  it("rejects a memory authorization beyond the retention limit", () => {
    const { request, decision } = memoryWriteScenario("postgres");
    request.memoryPolicyContext.maximumRetention = "none";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: memoryEnabledFlowCatalogueFixture,
      }),
      "MEMORY_AUTHORIZATION_DENIED",
    );
  });

  it("validates interruption policy without executing interruption", () => {
    const request = clonePolicyFixture(validSafeFailurePolicyRequest);
    request.flowOperationContext = {
      operation: "interrupt",
      interruptionReasonCode: "USER_INTERRUPTED",
      interruptedAt: "2026-07-31T09:59:00.000Z",
      ordinaryActiveFlowCount: 1,
    };
    const decision = safeFailureWithFlowUpdate();
    decision.safeFailurePlan!.flowUpdateProposal!.toState = "interrupted";
    decision.safeFailurePlan!.flowUpdateProposal!.proposal = {
      nextLifecycleState: "interrupted",
      pauseReason: "User interruption.",
      reasonCode: "USER_INTERRUPTED",
    };
    expect(validateOrchestratorPolicyDecision(request, decision).verdict)
      .toBe("safe_fail");
  });

  function resumeScenario() {
    const request = clonePolicyFixture(validSafeFailurePolicyRequest);
    request.activeFlowState!.state = "paused";
    request.activeFlowState!.interruptedState = undefined;
    request.activeFlowState!.resumeMetadata = {
      previousState: "active",
      interruptedAt: "2026-07-31T09:00:00.000Z",
      reason: "User interruption.",
    };
    request.flowOperationContext = {
      operation: "resume",
      interruptedAt: "2026-07-31T09:00:00.000Z",
      expiresAt: "2026-08-01T09:00:00.000Z",
      freshSafetyCheckAfterInterruption: true,
      revalidationProof: {
        revalidationReferenceId: "revalidation-task4-resume",
        revalidatedAt: "2026-07-31T09:59:30.000Z",
        flowId: request.flowDefinitionReference.flowId,
        flowVersion: request.flowDefinitionReference.version,
        safetyResultReference: request.safetyContext.resultId,
      },
      previousChannel: "pwa",
      ordinaryActiveFlowCount: 1,
    };
    const decision = safeFailureWithFlowUpdate();
    decision.safeFailurePlan!.flowUpdateProposal!.fromState = "paused";
    decision.safeFailurePlan!.flowUpdateProposal!.toState = "resuming";
    decision.safeFailurePlan!.flowUpdateProposal!.proposal = {
      nextLifecycleState: "resuming",
      resumeMetadata: {
        previousState: "active",
        interruptedAt: "2026-07-31T09:00:00.000Z",
        reason: "User interruption.",
      },
      reasonCode: "USER_RESUMED",
    };
    return { request, decision };
  }

  it("accepts current declarative resume revalidation proof", () => {
    const { request, decision } = resumeScenario();
    expect(validateOrchestratorPolicyDecision(request, decision).verdict)
      .toBe("safe_fail");
  });

  it("rejects stale resume revalidation proof", () => {
    const { request, decision } = resumeScenario();
    request.flowOperationContext!.revalidationProof!.revalidatedAt =
      "2026-07-31T08:59:00.000Z";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("rejects resume without the required fresh safety check", () => {
    const { request, decision } = resumeScenario();
    request.flowOperationContext!.freshSafetyCheckAfterInterruption = false;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("rejects resume with a safety evaluation older than the interruption", () => {
    const { request, decision } = resumeScenario();
    request.safetyContext.checkedAt = "2026-07-31T08:59:59.000Z";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("rejects resume without a revalidation proof", () => {
    const { request, decision } = resumeScenario();
    request.flowOperationContext!.revalidationProof = undefined;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it.each([
    ["flowId", "wrong.flow"],
    ["flowVersion", "9.9.9"],
    ["safetyResultReference", "wrong-safety-result"],
  ] as const)("rejects resume with mismatched %s", (key, value) => {
    const { request, decision } = resumeScenario();
    request.flowOperationContext!.revalidationProof![key] = value;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("rejects a resume proof timestamp after the request", () => {
    const { request, decision } = resumeScenario();
    request.flowOperationContext!.revalidationProof!.revalidatedAt =
      "2026-07-31T10:01:00.000Z";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("rejects a resume Channel switch not permitted by the Flow", () => {
    const { request, decision } = resumeScenario();
    request.flowOperationContext!.previousChannel = "caregiver";
    const catalogue = clonePolicyFixture(VYVA_FLOW_CATALOGUE);
    catalogue.flows.find(
      (flow) => flow.flowId === request.flowDefinitionReference.flowId,
    )!.resumptionPolicy.channelSwitchAllowed = false;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: parseFlowCatalogue(catalogue),
      }),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("accepts a different resume Channel when the Flow permits switching", () => {
    const { request, decision } = resumeScenario();
    request.flowOperationContext!.previousChannel = "telephone";
    const catalogue = clonePolicyFixture(VYVA_FLOW_CATALOGUE);
    catalogue.flows.find(
      (flow) => flow.flowId === request.flowDefinitionReference.flowId,
    )!.resumptionPolicy.channelSwitchAllowed = true;
    expect(validateOrchestratorPolicyDecision(request, decision, {
      flowCatalogue: parseFlowCatalogue(catalogue),
    }).verdict).toBe("safe_fail");
  });

  it("rejects a resume after the interruption has expired", () => {
    const { request, decision } = resumeScenario();
    request.flowOperationContext!.expiresAt = "2026-07-31T09:30:00.000Z";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "FLOW_UPDATE_AUTHORIZATION_DENIED",
    );
  });

  it("authorizes an inert emergency preemption proposal", () => {
    const request = clonePolicyFixture(validSafeFailurePolicyRequest);
    const target = VYVA_FLOW_CATALOGUE.flows.find(
      (flow) => flow.flowId === "safety.emergency_check",
    )!;
    request.flowOperationContext = {
      operation: "preempt",
      targetFlowReference: {
        catalogueVersion: VYVA_FLOW_CATALOGUE.catalogueVersion,
        flowId: target.flowId,
        version: target.version,
        status: target.status,
        sessionEligibility: "new_session",
      },
      ordinaryActiveFlowCount: 1,
    };
    expect(validateOrchestratorPolicyDecision(
      request,
      validSafeFailureDecision,
    ).verdict).toBe("safe_fail");
  });

  it("authorizes an inert explicit Flow switch proposal", () => {
    const request = clonePolicyFixture(validSafeFailurePolicyRequest);
    const catalogue = structuredClone(VYVA_FLOW_CATALOGUE);
    const target = catalogue.flows.find(
      (flow) => flow.flowId === "health.symptom_assessment",
    )!;
    target.status = "pilot";
    const validatedCatalogue = parseFlowCatalogue(catalogue);
    request.flowOperationContext = {
      operation: "switch",
      targetFlowReference: {
        catalogueVersion: validatedCatalogue.catalogueVersion,
        flowId: target.flowId,
        version: target.version,
        status: target.status,
        sessionEligibility: "new_session",
      },
      ordinaryActiveFlowCount: 1,
    };
    expect(validateOrchestratorPolicyDecision(
      request,
      validSafeFailureDecision,
      { flowCatalogue: validatedCatalogue },
    ).verdict).toBe("safe_fail");
  });

  function followUpScenario() {
    const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
    request.evaluationId = "evaluation-task4-followup";
    request.activeAuditContext.correlationIds.push(request.evaluationId);
    request.specialistResponse!.status = "answered";
    request.specialistResponse!.flowStateUpdate = undefined;
    request.specialistResponse!.completionResult = undefined;
    request.specialistResponse!.followUpRecommendation = {
      purpose: "Continue the approved preventive check.",
      preferredChannel: "pwa",
      fallbackChannels: [],
      requiresConsent: true,
      reason: "Continue later.",
      delaySeconds: 3_600,
      summary: "Continue the preventive check later.",
    };
    const responseSubject =
      `${request.specialistResponse!.requestId}.response_guidance`;
    const followUpSubject =
      `${request.specialistResponse!.requestId}.followup`;
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    Object.assign(decision, {
      decisionId: "decision-task4-followup",
      evaluationId: request.evaluationId,
      stage: request.stage,
      verdict: "approve",
      rejectionCode: undefined,
      findings: [{
        findingId: "finding-task4-followup-response",
        policyId: "policy.response_composition.allowed",
        category: "response_composition",
        severity: "informational",
        outcome: "allow",
        reasonCode: "RESPONSE_ALLOWED",
        subjectType: "response_guidance",
        subjectId: responseSubject,
        sourceReferenceIds: [responseSubject],
        auditSummary: "Response is traceable.",
        createdAt: request.requestedAt,
        metadata: {},
      }, {
        findingId: "finding-task4-followup",
        policyId: "policy.followup.allowed",
        category: "followup",
        severity: "informational",
        outcome: "allow",
        reasonCode: "FOLLOWUP_ALLOWED",
        subjectType: "followup",
        subjectId: followUpSubject,
        sourceReferenceIds: [followUpSubject],
        auditSummary: "Follow-up matches Flow policy.",
        createdAt: request.requestedAt,
        metadata: {},
      }, {
        findingId: "finding-task4-followup-consent",
        policyId: "policy.consent.allowed",
        category: "consent",
        severity: "informational",
        outcome: "allow",
        reasonCode: "FOLLOWUP_CONSENT_ALLOWED",
        subjectType: "followup",
        subjectId: followUpSubject,
        sourceReferenceIds: ["consent-task4-push"],
        auditSummary: "Push consent is current.",
        createdAt: request.requestedAt,
        metadata: {},
      }],
      adjudications: [{
        adjudicationId: "adjudication-task4-followup-response",
        subjectType: "response_guidance",
        subjectId: responseSubject,
        decision: "approve",
        policyFindingIds: ["finding-task4-followup-response"],
        constraints: [],
        approvedAt: request.requestedAt,
        metadata: {},
      }, {
        adjudicationId: "adjudication-task4-followup",
        subjectType: "followup",
        subjectId: followUpSubject,
        decision: "approve",
        policyFindingIds: ["finding-task4-followup"],
        constraints: [],
        approvedAt: request.requestedAt,
        metadata: {},
      }],
      consentAuthorizations: [{
        authorizationId: "authorization-task4-followup-consent",
        scope: "proactive_push",
        consentDecisionId: "consent-task4-push",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.preventive_followup",
        decision: "allow",
        policyFindingIds: ["finding-task4-followup-consent"],
      }],
      followUpAuthorization: {
        authorizationId: "authorization-task4-followup",
        subjectId: followUpSubject,
        adjudicationId: "adjudication-task4-followup",
        purpose: "Continue the approved preventive check.",
        approvedChannel: "pwa",
        fallbackChannels: [],
        delaySeconds: 3_600,
        consentAuthorizationIds: [
          "authorization-task4-followup-consent",
        ],
        noResponseDecision: {
          retryAllowed: false,
          fallbackAllowed: true,
          escalationAfterNoResponse: false,
          humanReviewRequired: false,
        },
        policyFindingIds: ["finding-task4-followup"],
        nonExecutable: true,
      },
      approvedResponsePlan: {
        approvedFacts: [{
          factId: "fact-task4-followup",
          text: request.specialistResponse!.responseGuidance.facts[0],
          sourceType: "specialist",
          sourceReferenceId: responseSubject,
        }],
        approvedAcknowledgements: [],
        approvedTone: "supportive",
        urgency: "routine",
        brevityPreference: "brief",
        prohibitedClaims:
          request.specialistResponse!.responseGuidance.prohibitedClaims,
        requiredDisclaimers: [],
        localizationKeys: [],
        contentSlotAssignments: [],
        evidenceLimitations: [],
        escalationLanguageRequirements: [],
        policyFindingIds: ["finding-task4-followup-response"],
      },
    });
    Object.assign(decision.auditRecord, {
      auditDecisionId: "audit-task4-followup",
      evaluationId: request.evaluationId,
      decisionId: decision.decisionId,
      policyStage: request.stage,
      verdict: "approve",
      specialistRequestId: request.specialistRequest!.requestId,
      specialistResponseId: request.specialistResponse!.requestId,
      findingIds: decision.findings.map((item) => item.findingId),
      adjudicationIds: decision.adjudications.map(
        (item) => item.adjudicationId,
      ),
    });
    return { request, decision };
  }

  it("preserves the Flow no-response follow-up policy", () => {
    const { request, decision } = followUpScenario();
    expect(validateOrchestratorPolicyDecision(request, decision)
      .followUpAuthorization?.noResponseDecision.retryAllowed).toBe(false);
  });

  it("rejects follow-up retries forbidden by the Flow", () => {
    const { request, decision } = followUpScenario();
    decision.followUpAuthorization!.noResponseDecision.retryAllowed = true;
    decision.followUpAuthorization!.noResponseDecision.maximumAttempts = 2;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "FOLLOWUP_AUTHORIZATION_DENIED",
    );
  });

  function caregiverEscalationScenario() {
    const catalogueCandidate = clonePolicyFixture(
      memoryEnabledFlowCatalogueFixture,
    );
    const flow = catalogueCandidate.flows.find(
      (item) => item.flowId === "health.preventive_check",
    )!;
    const safetyCheckId = flow.deterministicSafetyChecks[0];
    flow.escalationRules = [{
      ruleId: "health.preventive_check.caregiver",
      safetyCheckIds: [safetyCheckId],
      target: "caregiver",
      requiresConsent: true,
    }];
    flow.consentRequirements.push({
      scope: "caregiver_disclosure",
      timing: "before_action",
      revocable: true,
      reusable: false,
      purposeSpecific: true,
    });
    const catalogue = parseFlowCatalogue(catalogueCandidate);
    const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
    request.evaluationId = "evaluation-task4-caregiver";
    request.activeAuditContext.correlationIds.push(request.evaluationId);
    request.specialistResponse!.status = "escalated";
    request.specialistResponse!.flowStateUpdate = undefined;
    request.specialistResponse!.completionResult = undefined;
    request.specialistResponse!.riskLevel = "medium";
    request.specialistResponse!.safetyFlags = [safetyCheckId];
    request.specialistResponse!.escalation = {
      type: "caregiver",
      reasonCode: safetyCheckId,
      urgency: "routine",
      summary: "Caregiver review is recommended.",
      targetId: "caregiver-1",
      requiresConsent: true,
      recommendedChannel: "pwa",
    };
    request.consentContext.scopes.push("caregiver_disclosure");
    request.consentContext.decisions.push({
      scope: "caregiver_disclosure",
      decisionId: "consent-task4-caregiver",
      status: "granted",
      authorizationBasis: "explicit_user_consent",
      purpose: "purpose.caregiver_disclosure",
      decidedAt: request.requestedAt,
      requiresRevalidation: false,
      permittedChannels: ["pwa"],
    });
    const subjectId = `${request.specialistResponse!.requestId}.escalation`;
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    Object.assign(decision, {
      decisionId: "decision-task4-caregiver",
      evaluationId: request.evaluationId,
      stage: request.stage,
      verdict: "escalate",
      rejectionCode: undefined,
      findings: [{
        findingId: "finding-task4-caregiver",
        policyId: "policy.escalation.allowed",
        category: "escalation",
        severity: "informational",
        outcome: "allow",
        reasonCode: "CAREGIVER_ESCALATION_ALLOWED",
        subjectType: "escalation",
        subjectId,
        sourceReferenceIds: [safetyCheckId],
        auditSummary: "The Flow permits caregiver escalation.",
        createdAt: request.requestedAt,
        metadata: {},
      }, {
        findingId: "finding-task4-caregiver-consent",
        policyId: "policy.consent.allowed",
        category: "consent",
        severity: "informational",
        outcome: "allow",
        reasonCode: "CAREGIVER_CONSENT_ALLOWED",
        subjectType: "escalation",
        subjectId,
        sourceReferenceIds: ["consent-task4-caregiver"],
        auditSummary: "Caregiver disclosure consent is current.",
        createdAt: request.requestedAt,
        metadata: {},
      }],
      adjudications: [{
        adjudicationId: "adjudication-task4-caregiver",
        subjectType: "escalation",
        subjectId,
        decision: "approve",
        policyFindingIds: ["finding-task4-caregiver"],
        constraints: [],
        approvedAt: request.requestedAt,
        metadata: {},
      }],
      consentAuthorizations: [{
        authorizationId: "authorization-task4-caregiver-consent",
        scope: "caregiver_disclosure",
        consentDecisionId: "consent-task4-caregiver",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.caregiver_disclosure",
        decision: "allow",
        policyFindingIds: ["finding-task4-caregiver-consent"],
      }],
      escalationAuthorization: {
        authorizationId: "authorization-task4-caregiver",
        subjectId,
        type: "caregiver",
        urgency: "routine",
        targetId: "caregiver-1",
        approvedChannel: "pwa",
        consentAuthorizationIds: [
          "authorization-task4-caregiver-consent",
        ],
        policyFindingIds: ["finding-task4-caregiver"],
        nonExecutable: true,
      },
    });
    Object.assign(decision.auditRecord, {
      auditDecisionId: "audit-task4-caregiver",
      evaluationId: request.evaluationId,
      decisionId: decision.decisionId,
      policyStage: request.stage,
      verdict: "escalate",
      specialistRequestId: request.specialistRequest!.requestId,
      specialistResponseId: request.specialistResponse!.requestId,
      findingIds: decision.findings.map((item) => item.findingId),
      adjudicationIds: decision.adjudications.map(
        (item) => item.adjudicationId,
      ),
    });
    return { request, decision, catalogue };
  }

  it("authorizes caregiver escalation only when the Flow and consent agree", () => {
    const { request, decision, catalogue } = caregiverEscalationScenario();
    expect(validateOrchestratorPolicyDecision(request, decision, {
      flowCatalogue: catalogue,
    }).verdict).toBe("escalate");
  });

  it("rejects caregiver escalation when disclosure consent is absent", () => {
    const { request, decision, catalogue } = caregiverEscalationScenario();
    decision.consentAuthorizations = [];
    decision.escalationAuthorization!.consentAuthorizationIds = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: catalogue,
      }),
      "ESCALATION_AUTHORIZATION_DENIED",
    );
  });

  function clinicianEscalationScenario() {
    const { request, decision, catalogue } = caregiverEscalationScenario();
    request.evaluationId = "evaluation-task4-clinician";
    request.activeAuditContext.correlationIds.push(request.evaluationId);
    request.escalationContext.allowedTypes.push("clinician");
    request.specialistResponse!.escalation!.type = "clinician";
    request.specialistResponse!.escalation!.targetId = "clinician-1";
    request.consentContext.scopes =
      request.consentContext.scopes.filter(
        (scope) => scope !== "caregiver_disclosure",
      );
    request.consentContext.scopes.push("clinician_disclosure");
    Object.assign(
      request.consentContext.decisions.find(
        (item) => item.scope === "caregiver_disclosure",
      )!,
      {
        scope: "clinician_disclosure",
        decisionId: "consent-task4-clinician",
        purpose: "purpose.clinician_disclosure",
      },
    );
    request.clinicianDisclosureAuthorizationSources = [{
      consentDecisionId: "consent-task4-clinician",
      scope: "clinician_disclosure",
      purpose: "purpose.clinician_disclosure",
      targetType: "specific_clinician",
      targetId: "clinician-1",
      allowedChannels: ["pwa"],
      status: "granted",
      grantedAt: request.requestedAt,
      metadata: {},
    }];
    decision.evaluationId = request.evaluationId;
    decision.decisionId = "decision-task4-clinician";
    decision.escalationAuthorization!.type = "clinician";
    decision.escalationAuthorization!.targetId = "clinician-1";
    Object.assign(decision.consentAuthorizations[0], {
      scope: "clinician_disclosure",
      consentDecisionId: "consent-task4-clinician",
      purpose: "purpose.clinician_disclosure",
      targetId: "clinician-1",
    });
    decision.auditRecord.evaluationId = request.evaluationId;
    decision.auditRecord.decisionId = decision.decisionId;
    const mutableCatalogue = clonePolicyFixture(catalogue);
    const flow = mutableCatalogue.flows.find(
      (item) => item.flowId === request.flowDefinitionReference.flowId,
    )!;
    flow.escalationRules[0].target = "clinician";
    flow.consentRequirements = flow.consentRequirements.filter(
      (item) => item.scope !== "caregiver_disclosure",
    );
    return {
      request,
      decision,
      catalogue: parseFlowCatalogue(mutableCatalogue),
    };
  }

  function clinicianEmergencyExceptionScenario() {
    const scenario = clinicianEscalationScenario();
    const source =
      scenario.request.clinicianDisclosureAuthorizationSources![0];
    const findingId = "finding-task4-clinician-emergency-exception";
    const targetId = "emergency-clinical-service-1";
    scenario.request.safetyContext.deterministicSafetyResult = "emergency";
    scenario.request.specialistResponse!.riskLevel = "emergency";
    source.targetType = "emergency_clinical_service";
    source.targetId = undefined;
    source.approvedTargetIds = [targetId];
    source.emergencyExceptionBasis = {
      safetyFindingId: findingId,
      auditReferenceId:
        scenario.request.activeAuditContext.auditSessionId,
    };
    Object.assign(
      scenario.request.consentContext.decisions.find(
        (item) => item.decisionId === source.consentDecisionId,
      )!,
      {
        authorizationBasis: "emergency_exception",
        permittedTargetIds: [targetId],
        emergencyExceptionFindingId: findingId,
        auditReferenceId:
          scenario.request.activeAuditContext.auditSessionId,
      },
    );
    Object.assign(scenario.decision.consentAuthorizations[0], {
      authorizationBasis: "emergency_exception",
      targetId,
      policyFindingIds: [findingId],
    });
    Object.assign(scenario.decision.escalationAuthorization!, {
      targetId,
      policyFindingIds: [findingId],
    });
    scenario.request.specialistResponse!.escalation!.targetId = targetId;
    scenario.decision.findings.push({
      findingId,
      policyId: "policy.safety.emergency",
      category: "deterministic_safety",
      severity: "critical",
      outcome: "require_escalation",
      reasonCode: "CLINICIAN_EMERGENCY_EXCEPTION_RECORDED",
      subjectType: "escalation",
      sourceReferenceIds: [scenario.request.safetyContext.resultId],
      auditSummary: "A clinician emergency exception was recorded.",
      createdAt: scenario.request.requestedAt,
      metadata: {},
    });
    scenario.decision.auditRecord.findingIds.push(findingId);
    return scenario;
  }

  it("authorizes a clinician emergency exception with exact safety and audit correlation", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    expect(validateOrchestratorPolicyDecision(
      parseOrchestratorPolicyEvaluationRequest(request),
      parseOrchestratorPolicyDecision(decision),
      { flowCatalogue: catalogue },
    ).escalationAuthorization?.type).toBe("clinician");
  });

  it("authorizes clinician escalation with target-specific consent", () => {
    const { request, decision, catalogue } = clinicianEscalationScenario();
    expect(validateOrchestratorPolicyDecision(request, decision, {
      flowCatalogue: catalogue,
    }).escalationAuthorization?.type).toBe("clinician");
  });

  it("does not use caregiver consent for clinician escalation", () => {
    const { request, decision, catalogue } = clinicianEscalationScenario();
    decision.consentAuthorizations[0].scope = "caregiver_disclosure";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: catalogue,
      }),
      "CONSENT_AUTHORIZATION_REQUIRED",
    );
  });

  it("rejects a clinician target not authorized by the source consent", () => {
    const { request, decision, catalogue } = clinicianEscalationScenario();
    decision.escalationAuthorization!.targetId = "clinician-2";
    decision.consentAuthorizations[0].targetId = "clinician-2";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: catalogue,
      }),
      "ESCALATION_AUTHORIZATION_DENIED",
    );
  });

  it.each(["revoked", "denied"] as const)(
    "rejects %s clinician source consent",
    (status) => {
      const { request, decision, catalogue } = clinicianEscalationScenario();
      request.clinicianDisclosureAuthorizationSources![0].status = status;
      expectContractError(
        () => validateOrchestratorPolicyDecision(request, decision, {
          flowCatalogue: catalogue,
        }),
        "ORCHESTRATOR_CONSENT_TARGET_INVALID",
      );
    },
  );

  it("rejects an expired clinician source consent", () => {
    const { request, decision, catalogue } = clinicianEscalationScenario();
    request.clinicianDisclosureAuthorizationSources![0].expiresAt =
      request.requestedAt;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: catalogue,
      }),
      "ORCHESTRATOR_CONSENT_TARGET_INVALID",
    );
  });

  it("rejects a clinician Channel not authorized by source consent", () => {
    const { request, decision, catalogue } = clinicianEscalationScenario();
    request.clinicianDisclosureAuthorizationSources![0].allowedChannels = [
      "telephone",
    ];
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: catalogue,
      }),
      "ORCHESTRATOR_CONSENT_TARGET_INVALID",
    );
  });

  it("rejects a clinician emergency exception from another audit session", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    request.clinicianDisclosureAuthorizationSources![0]
      .emergencyExceptionBasis!.auditReferenceId =
        "unrelated-audit-session";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: catalogue,
      }),
      "ORCHESTRATOR_CONSENT_TARGET_INVALID",
    );
  });

  it("rejects a clinician emergency exception for another safety finding", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    request.clinicianDisclosureAuthorizationSources![0]
      .emergencyExceptionBasis!.safetyFindingId =
        "unrelated-safety-finding";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, {
        flowCatalogue: catalogue,
      }),
      "ORCHESTRATOR_CONSENT_TARGET_INVALID",
    );
  });

  it.each(["clear", "uncertain", "not_applicable"] as const)(
    "rejects a clinician emergency exception for a %s safety result",
    (deterministicSafetyResult) => {
      const { request, decision, catalogue } =
        clinicianEmergencyExceptionScenario();
      request.safetyContext.deterministicSafetyResult =
        deterministicSafetyResult;
      expectContractError(
        () => validateOrchestratorPolicyDecision(
          parseOrchestratorPolicyEvaluationRequest(request),
          parseOrchestratorPolicyDecision(decision),
          { flowCatalogue: catalogue },
        ),
        "CONSENT_ACTION_NOT_AUTHORIZED",
      );
    },
  );

  it("rejects a clinician emergency exception without its structured basis", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    request.clinicianDisclosureAuthorizationSources![0]
      .emergencyExceptionBasis = undefined;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        { flowCatalogue: catalogue },
      ),
      "ORCHESTRATOR_CONSENT_TARGET_INVALID",
    );
  });

  it("rejects a clinician emergency exception for an unapproved target", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    decision.escalationAuthorization!.targetId =
      "unapproved-emergency-clinical-service";
    request.specialistResponse!.escalation!.targetId =
      "unapproved-emergency-clinical-service";
    decision.consentAuthorizations[0].targetId =
      "unapproved-emergency-clinical-service";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        { flowCatalogue: catalogue },
      ),
      "ORCHESTRATOR_CONSENT_TARGET_INVALID",
    );
  });

  it("rejects a clinician emergency exception on an unauthorized Channel", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    request.clinicianDisclosureAuthorizationSources![0].allowedChannels = [
      "voice",
    ];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        { flowCatalogue: catalogue },
      ),
      "ORCHESTRATOR_CONSENT_TARGET_INVALID",
    );
  });

  it("rejects a clinician emergency exception with an unrelated consent authorization", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    decision.escalationAuthorization!.consentAuthorizationIds = [
      "authorization-unrelated-consent",
    ];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        { flowCatalogue: catalogue },
      ),
      "ESCALATION_AUTHORIZATION_DENIED",
    );
  });

  it("rejects routine clinician consent attempting an emergency bypass", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    request.clinicianDisclosureAuthorizationSources![0]
      .emergencyExceptionBasis = undefined;
    const sourceDecision = request.consentContext.decisions.find(
      (item) => item.decisionId === "consent-task4-clinician",
    )!;
    sourceDecision.authorizationBasis = "explicit_user_consent";
    sourceDecision.emergencyExceptionFindingId = undefined;
    sourceDecision.auditReferenceId = undefined;
    decision.consentAuthorizations[0].authorizationBasis =
      "explicit_user_consent";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        { flowCatalogue: catalogue },
      ),
      "ORCHESTRATOR_CONSENT_TARGET_INVALID",
    );
  });

  it.each(["caregiver", "operator"] as const)(
    "rejects %s escalation attempting to use a clinician emergency basis",
    (type) => {
      const { request, decision, catalogue } =
        clinicianEmergencyExceptionScenario();
      request.escalationContext.allowedTypes = [
        ...new Set([...request.escalationContext.allowedTypes, type]),
      ];
      request.specialistResponse!.escalation!.type = type;
      decision.escalationAuthorization!.type = type;
      expectContractError(
        () => validateOrchestratorPolicyDecision(
          parseOrchestratorPolicyEvaluationRequest(request),
          parseOrchestratorPolicyDecision(decision),
          { flowCatalogue: catalogue },
        ),
        "ESCALATION_AUTHORIZATION_DENIED",
      );
    },
  );

  it("rejects contradictory direct-emergency and clinician-exception authorization", () => {
    const { request, decision, catalogue } =
      clinicianEmergencyExceptionScenario();
    request.escalationContext.allowedTypes = [
      ...new Set([...request.escalationContext.allowedTypes, "emergency"]),
    ];
    decision.escalationAuthorization!.type = "emergency";
    decision.escalationAuthorization!.targetId = undefined;
    decision.escalationAuthorization!.consentAuthorizationIds = [];
    decision.systemDirectives = [{
      directiveId: "directive-task4-contradictory-emergency",
      type: "require_safety_escalation",
      sourcePolicyId: "policy.safety.emergency",
      reasonCode: "EMERGENCY_ESCALATION_REQUIRED",
      flowReference: {
        flowId: request.flowDefinitionReference.flowId,
        flowVersion: request.flowDefinitionReference.version,
      },
      subjectReferences: [decision.escalationAuthorization!.subjectId],
      nonExecutable: true,
    }];
    decision.auditRecord.directiveIds = [
      "directive-task4-contradictory-emergency",
    ];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        { flowCatalogue: catalogue },
      ),
      "SAFETY_PRECEDENCE_REQUIRED",
    );
  });

  const consentScopeByArea = {
    external_tool_use: "external_tool_use",
    image_capture: "image_capture",
    image_analysis: "image_analysis",
    image_retention: "image_retention",
    document_capture: "document_capture",
    document_retention: "document_retention",
    longitudinal_comparison: "longitudinal_evidence_comparison",
    memory_read: "memory_read",
    memory_write: "memory_write",
    mem0_write: "mem0_write",
    caregiver_disclosure: "caregiver_disclosure",
    operator_disclosure: "operator_disclosure",
    clinician_disclosure: "clinician_disclosure",
    proactive_push: "proactive_push",
    outbound_call: "outbound_call",
    followup_channel: "proactive_push",
    escalation: "caregiver_disclosure",
    emergency_exception: "clinician_disclosure",
  } as const;

  function buildConsentScenario(
    entry: typeof CONSENT_EXPECTATIONS[number],
  ) {
    if (entry.consentArea === "emergency_exception") {
      const escalationEntry = ESCALATION_EXPECTATIONS.find(
        (candidate) =>
          candidate.escalationType === "emergency" &&
          candidate.dimension === "emergency_exception",
      )!;
      const base = buildEscalationScenario(escalationEntry);
      const sourceId = "consent-emergency-exception-matrix";
      const findingId = "finding-emergency-exception-matrix";
      const source = {
        scope: "clinician_disclosure" as const,
        decisionId: sourceId,
        status: "granted" as const,
        authorizationBasis: "emergency_exception" as const,
        purpose: "purpose.emergency_exception",
        decidedAt: base.request.requestedAt,
        requiresRevalidation: false,
        permittedChannels: ["pwa" as const],
        permittedTargetIds: ["emergency-service-matrix"],
        emergencyExceptionFindingId: findingId,
        auditReferenceId: base.request.activeAuditContext.auditSessionId,
      };
      base.request.consentContext.scopes.push("clinician_disclosure");
      base.request.consentContext.decisions.push(source);
      base.decision.findings.push({
        findingId,
        policyId: "policy.safety.emergency",
        category: "deterministic_safety",
        severity: "critical",
        outcome: "require_escalation",
        reasonCode: "EMERGENCY_EXCEPTION_RECORDED",
        subjectType: "escalation",
        sourceReferenceIds: [
          base.request.safetyContext.resultId,
          sourceId,
        ],
        auditSummary: "A deterministic emergency exception was recorded.",
        createdAt: base.request.requestedAt,
        metadata: {},
      });
      base.decision.consentAuthorizations.push({
        authorizationId: "authorization-emergency-exception-matrix",
        scope: "clinician_disclosure",
        consentDecisionId: sourceId,
        authorizationBasis: "emergency_exception",
        purpose: source.purpose,
        targetId: "emergency-service-matrix",
        decision: "allow",
        policyFindingIds: [findingId],
      });
      base.decision.auditRecord.findingIds.push(findingId);
      if (entry.dimension === "missing") {
        base.request.consentContext.decisions.pop();
      } else if (entry.dimension === "revoked") {
        source.status = "revoked";
        base.request.consentContext.revokedScopes.push(
          "clinician_disclosure",
        );
      } else if (entry.dimension === "expired") {
        Object.assign(source, { expiresAt: base.request.requestedAt });
      } else if (entry.dimension === "wrong_purpose") {
        source.purpose = "purpose.unrelated";
      } else if (entry.dimension === "wrong_scope") {
        source.scope = "health_data";
      } else if (entry.dimension === "wrong_channel") {
        source.permittedChannels = ["voice"];
      } else if (entry.dimension === "wrong_target") {
        base.decision.consentAuthorizations.at(-1)!.targetId =
          "emergency-service-unapproved";
      }
      return base;
    }
    const request = clonePolicyFixture(validIngressPolicyRequest);
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    const scope = consentScopeByArea[entry.fixtureBuilderKey];
    const scenarioToken = entry.scenarioId.replaceAll(/[._]/g, "-");
    const sourceId = `source-${scenarioToken}`;
    const findingId = `finding-${scenarioToken}`;
    const targetApplies = entry.dimension === "wrong_target" ||
      ["caregiver_disclosure", "operator_disclosure",
        "clinician_disclosure", "escalation", "emergency_exception"]
        .includes(entry.consentArea);
    const emergency = entry.consentArea === "emergency_exception";
    const source = {
      scope,
      decisionId: sourceId,
      status: "granted" as const,
      authorizationBasis: emergency
        ? "emergency_exception" as const
        : "explicit_user_consent" as const,
      purpose: `purpose.${entry.consentArea}`,
      decidedAt: request.requestedAt,
      requiresRevalidation: false,
      permittedChannels: ["pwa" as const],
      ...(targetApplies
        ? { permittedTargetIds: ["target-authorized"] }
        : {}),
      ...(emergency
        ? {
          emergencyExceptionFindingId: findingId,
          auditReferenceId: `audit-${scenarioToken}`,
        }
        : {}),
    };
    if (!request.consentContext.scopes.includes(scope)) {
      request.consentContext.scopes.push(scope);
    }
    request.consentContext.decisions =
      request.consentContext.decisions.filter((item) => item.scope !== scope);
    request.consentContext.decisions.push(source);
    const finding = {
      findingId,
      policyId: emergency
        ? "policy.safety.emergency"
        : "policy.consent.allowed",
      category: emergency
        ? "deterministic_safety" as const
        : "consent" as const,
      severity: emergency ? "critical" as const : "informational" as const,
      outcome: emergency ? "require_escalation" as const : "allow" as const,
      reasonCode: emergency
        ? "EMERGENCY_EXCEPTION_RECORDED"
        : "CONSENT_SOURCE_CURRENT",
      subjectType: "escalation" as const,
      sourceReferenceIds: [sourceId],
      auditSummary: "Synthetic consent authority was independently verified.",
      createdAt: request.requestedAt,
      metadata: {},
    };
    decision.findings.push(finding);
    decision.consentAuthorizations.push({
      authorizationId: `authorization-${scenarioToken}`,
      scope,
      consentDecisionId: sourceId,
      authorizationBasis: source.authorizationBasis,
      purpose: source.purpose,
      ...(targetApplies ? { targetId: "target-authorized" } : {}),
      decision: "allow",
      policyFindingIds: [findingId],
    });
    decision.auditRecord.findingIds.push(findingId);

    if (entry.dimension === "missing") {
      request.consentContext.decisions.pop();
    } else if (entry.dimension === "revoked") {
      source.status = "revoked";
      request.consentContext.revokedScopes.push(scope);
    } else if (entry.dimension === "expired") {
      Object.assign(source, { expiresAt: request.requestedAt });
    } else if (entry.dimension === "wrong_purpose") {
      source.purpose = "purpose.unrelated";
    } else if (entry.dimension === "wrong_scope") {
      source.scope = "health_data";
    } else if (entry.dimension === "wrong_channel") {
      source.permittedChannels = ["voice"];
    } else if (entry.dimension === "wrong_target") {
      decision.consentAuthorizations.at(-1)!.targetId = "target-unapproved";
    }
    return { request, decision };
  }

  function buildEscalationScenario(
    entry: typeof ESCALATION_EXPECTATIONS[number],
  ) {
    const base = entry.escalationType === "clinician"
      ? entry.dimension === "emergency_exception"
        ? clinicianEmergencyExceptionScenario()
        : clinicianEscalationScenario()
      : caregiverEscalationScenario();
    const request = base.request;
    const decision = base.decision;
    const mutableCatalogue = clonePolicyFixture(base.catalogue);
    const flow = mutableCatalogue.flows.find(
      (item) => item.flowId === request.flowDefinitionReference.flowId,
    )!;
    const proposal = request.specialistResponse!.escalation!;
    const authorization = decision.escalationAuthorization!;
    const consentSource = request.consentContext.decisions.find(
      (item) => item.decisionId ===
        decision.consentAuthorizations[0]?.consentDecisionId,
    );

    if (entry.escalationType === "caregiver" && consentSource) {
      consentSource.permittedTargetIds = ["caregiver-1"];
      decision.consentAuthorizations[0].targetId = "caregiver-1";
    }
    if (entry.escalationType === "operator") {
      request.escalationContext.allowedTypes =
        [...new Set([...request.escalationContext.allowedTypes, "operator"])];
      request.escalationContext.operatorDisclosureAllowed = true;
      proposal.type = "operator";
      proposal.targetId = "operator-1";
      authorization.type = "operator";
      authorization.targetId = "operator-1";
      flow.escalationRules[0].target = "operator";
      if (consentSource) {
        consentSource.scope = "operator_disclosure";
        consentSource.decisionId = "consent-task4-operator-matrix";
        consentSource.purpose = "purpose.operator_disclosure";
        consentSource.permittedTargetIds = ["operator-1"];
      }
      Object.assign(decision.consentAuthorizations[0], {
        scope: "operator_disclosure",
        consentDecisionId: "consent-task4-operator-matrix",
        purpose: "purpose.operator_disclosure",
        targetId: "operator-1",
      });
    }
    if (["emergency", "technical"].includes(entry.escalationType)) {
      const type = entry.escalationType as "emergency" | "technical";
      request.escalationContext.allowedTypes =
        [...new Set([...request.escalationContext.allowedTypes, type])];
      proposal.type = type;
      proposal.targetId = undefined;
      authorization.type = type;
      authorization.targetId = undefined;
      authorization.consentAuthorizationIds = [];
      decision.consentAuthorizations = [];
      flow.escalationRules[0].target =
        type === "emergency" ? "emergency_services" : "operator";
      flow.escalationRules[0].requiresConsent = false;
    }

    if (entry.dimension === "missing_flow_rule") {
      flow.escalationRules = [];
    } else if (entry.dimension === "wrong_flow_rule") {
      flow.escalationRules[0].target =
        entry.escalationType === "caregiver" ? "operator" : "caregiver";
    } else if (entry.dimension === "missing_target") {
      proposal.targetId = undefined;
      authorization.targetId = undefined;
    } else if (entry.dimension === "wrong_target") {
      authorization.targetId = "target-unapproved";
      if (decision.consentAuthorizations[0]) {
        decision.consentAuthorizations[0].targetId = "target-unapproved";
      }
    } else if (entry.dimension === "wrong_channel") {
      request.escalationContext.allowedChannels = ["pwa"];
      authorization.approvedChannel = "voice";
    } else if (entry.dimension === "missing_consent") {
      decision.consentAuthorizations = [];
      authorization.consentAuthorizationIds = [];
    } else if (entry.dimension === "wrong_consent") {
      decision.consentAuthorizations[0].scope = "external_tool_use";
    } else if (entry.dimension === "revoked_consent") {
      if (entry.escalationType === "clinician") {
        request.clinicianDisclosureAuthorizationSources![0].status = "revoked";
      } else if (consentSource) {
        consentSource.status = "revoked";
      }
    } else if (entry.dimension === "expired_consent") {
      if (entry.escalationType === "clinician") {
        request.clinicianDisclosureAuthorizationSources![0].expiresAt =
          request.requestedAt;
      } else if (consentSource) {
        consentSource.expiresAt = request.requestedAt;
      }
    } else if (entry.dimension === "duplicate_active_escalation") {
      request.escalationContext.activeEscalationId =
        "active-escalation-matrix";
    } else if (
      entry.dimension === "emergency_exception" &&
      entry.escalationType === "emergency"
    ) {
      request.safetyContext.deterministicSafetyResult = "emergency";
      decision.systemDirectives = [{
        directiveId: "directive-emergency-matrix",
        type: "require_safety_escalation",
        sourcePolicyId: "policy.safety.emergency",
        reasonCode: "EMERGENCY_ESCALATION_REQUIRED",
        flowReference: {
          flowId: request.flowDefinitionReference.flowId,
          flowVersion: request.flowDefinitionReference.version,
        },
        subjectReferences: [authorization.subjectId],
        nonExecutable: true,
      }];
      decision.auditRecord.directiveIds = ["directive-emergency-matrix"];
    } else if (entry.dimension === "missing_required_finding") {
      request.specialistResponse!.safetyFlags = [];
      proposal.reasonCode = "UNRELATED_REASON";
    } else if (entry.dimension === "execution_field_attempt") {
      Object.assign(authorization, {
        providerExecutionId: "forbidden-provider-execution",
      });
    }
    return {
      request,
      decision,
      options: { flowCatalogue: parseFlowCatalogue(mutableCatalogue) },
    };
  }

  it("declares an independent complete 144-entry consent matrix", () => {
    expect(CONSENT_EXPECTATIONS).toHaveLength(144);
    expect(new Set(CONSENT_EXPECTATIONS.map((item) => item.consentArea)).size)
      .toBe(18);
    expect(new Set(CONSENT_EXPECTATIONS.map((item) => item.dimension)).size)
      .toBe(8);
    expect(new Set(CONSENT_EXPECTATIONS.map((item) => item.scenarioId)).size)
      .toBe(144);
    const pairs = new Set(CONSENT_EXPECTATIONS.map(
      (item) => `${item.consentArea}:${item.dimension}`,
    ));
    expect(pairs.size).toBe(144);
    expect(CONSENT_EXPECTATIONS.filter(
      (item) => item.expectedResult === "not_applicable",
    ).every((item) => item.reason.trim().length > 0)).toBe(true);
    expect(CONSENT_EXPECTATIONS.filter(
      (item) => item.expectedResult === "pass",
    )).toHaveLength(18);
    expect(CONSENT_EXPECTATIONS.filter(
      (item) => item.expectedResult === "fail",
    )).toHaveLength(109);
    expect(CONSENT_EXPECTATIONS.filter(
      (item) => item.expectedResult === "not_applicable",
    )).toHaveLength(17);
    expect(CONSENT_EXPECTATIONS.every(
      (item) => item.fixtureBuilderKey in consentScopeByArea,
    )).toBe(true);
  });

  it("executes every applicable consent expectation through public validation", () => {
    let invoked = 0;
    for (const entry of CONSENT_EXPECTATIONS) {
      if (entry.expectedResult === "not_applicable") continue;
      invoked += 1;
      const { request, decision, options } = buildConsentScenario(entry);
      const operation = () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      );
      if (entry.expectedResult === "pass") {
        expect(operation, entry.scenarioId).not.toThrow();
      } else {
        try {
          operation();
          throw new Error(`Expected ${entry.scenarioId} to fail.`);
        } catch (error) {
          expect(error, entry.scenarioId)
            .toBeInstanceOf(OrchestrationContractError);
          expect((error as Error).message).not.toContain(sourceIdFor(entry));
        }
      }
    }
    expect(invoked).toBe(127);
    expect(invoked).toBe(CONSENT_EXPECTATIONS.filter(
      (item) => item.expectedResult !== "not_applicable",
    ).length);
  });

  function validGenericEmergencyExceptionScenario() {
    const entry = CONSENT_EXPECTATIONS.find(
      (candidate) =>
        candidate.consentArea === "emergency_exception" &&
        candidate.dimension === "valid",
    )!;
    return buildConsentScenario(entry);
  }

  it("accepts a generic emergency exception with exact safety and audit correlation", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    expect(validateOrchestratorPolicyDecision(
      parseOrchestratorPolicyEvaluationRequest(request),
      parseOrchestratorPolicyDecision(decision),
      options,
    ).verdict).toBe("escalate");
  });

  it("rejects a critical emergency finding with no escalation authorization", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    decision.escalationAuthorization = undefined;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      ),
      "ORCHESTRATOR_REVERSE_ADJUDICATION_MISSING",
    );
  });

  it.each(["clear", "uncertain", "not_applicable"] as const)(
    "rejects a generic emergency exception for a %s safety result",
    (deterministicSafetyResult) => {
      const { request, decision, options } =
        validGenericEmergencyExceptionScenario();
      request.safetyContext.deterministicSafetyResult =
        deterministicSafetyResult;
      expectContractError(
        () => validateOrchestratorPolicyDecision(
          parseOrchestratorPolicyEvaluationRequest(request),
          parseOrchestratorPolicyDecision(decision),
          options,
        ),
        "CONSENT_ACTION_NOT_AUTHORIZED",
      );
    },
  );

  it("rejects a critical decision finding wrapped around a non-emergency result ID", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    request.safetyContext.deterministicSafetyResult = "clear";
    const source = request.consentContext.decisions.at(-1)!;
    expect(decision.findings.find(
      (finding) =>
        finding.findingId === source.emergencyExceptionFindingId,
    )?.sourceReferenceIds).toContain(request.safetyContext.resultId);
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      ),
      "CONSENT_ACTION_NOT_AUTHORIZED",
    );
  });

  it("rejects a generic emergency exception based on a noncritical finding", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    const source = request.consentContext.decisions.at(-1)!;
    decision.findings.find(
      (finding) =>
        finding.findingId === source.emergencyExceptionFindingId,
    )!.severity = "blocking";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      ),
      "ORCHESTRATOR_FINDING_COMPATIBILITY_INVALID",
    );
  });

  it("rejects a generic emergency exception based on a non-safety policy", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    const source = request.consentContext.decisions.at(-1)!;
    decision.findings.find(
      (finding) =>
        finding.findingId === source.emergencyExceptionFindingId,
    )!.policyId = "policy.consent.allowed";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      ),
      "ORCHESTRATOR_FINDING_INVALID",
    );
  });

  it("rejects a generic emergency exception missing its structured correlation fields", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    request.consentContext.decisions.at(-1)!.auditReferenceId = undefined;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      ),
      "CONSENT_ACTION_NOT_AUTHORIZED",
    );
  });

  it("rejects an emergency exception correlated to an unrelated audit session", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    request.consentContext.decisions.at(-1)!.auditReferenceId =
      "unrelated-audit-session";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      ),
      "CONSENT_ACTION_NOT_AUTHORIZED",
    );
  });

  it("rejects an emergency exception correlated to an unaudited finding", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    const source = request.consentContext.decisions.at(-1)!;
    decision.auditRecord.findingIds = decision.auditRecord.findingIds.filter(
      (findingId) => findingId !== source.emergencyExceptionFindingId,
    );
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      ),
      "CONSENT_ACTION_NOT_AUTHORIZED",
    );
  });

  it("rejects an emergency exception correlated to another safety finding", () => {
    const { request, decision, options } =
      validGenericEmergencyExceptionScenario();
    request.consentContext.decisions.at(-1)!.emergencyExceptionFindingId =
      "unrelated-safety-finding";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      ),
      "CONSENT_ACTION_NOT_AUTHORIZED",
    );
  });

  function sourceIdFor(entry: typeof CONSENT_EXPECTATIONS[number]) {
    return `source-${entry.scenarioId.replaceAll(/[._]/g, "-")}`;
  }

  it("declares an independent complete 70-entry escalation matrix", () => {
    expect(ESCALATION_EXPECTATIONS).toHaveLength(70);
    expect(new Set(ESCALATION_EXPECTATIONS.map(
      (item) => item.escalationType,
    )).size).toBe(5);
    expect(new Set(ESCALATION_EXPECTATIONS.map(
      (item) => item.dimension,
    )).size).toBe(14);
    expect(new Set(ESCALATION_EXPECTATIONS.map(
      (item) => item.scenarioId,
    )).size).toBe(70);
    expect(new Set(ESCALATION_EXPECTATIONS.map(
      (item) => `${item.escalationType}:${item.dimension}`,
    )).size).toBe(70);
    expect(ESCALATION_EXPECTATIONS.filter(
      (item) => item.expectedResult === "not_applicable",
    ).every((item) => item.reason.trim().length > 0)).toBe(true);
    expect(ESCALATION_EXPECTATIONS.filter(
      (item) => item.expectedResult === "pass",
    )).toHaveLength(7);
    expect(ESCALATION_EXPECTATIONS.filter(
      (item) => item.expectedResult === "fail",
    )).toHaveLength(48);
    expect(ESCALATION_EXPECTATIONS.filter(
      (item) => item.expectedResult === "not_applicable",
    )).toHaveLength(15);
    expect(ESCALATION_EXPECTATIONS.every(
      (item) => ["emergency", "caregiver", "operator", "clinician", "technical"]
        .includes(item.fixtureBuilderKey),
    )).toBe(true);
  });

  it("executes every applicable escalation expectation through public validation", () => {
    let invoked = 0;
    for (const entry of ESCALATION_EXPECTATIONS) {
      if (entry.expectedResult === "not_applicable") continue;
      invoked += 1;
      const { request, decision, options } = buildEscalationScenario(entry);
      const operation = () => validateOrchestratorPolicyDecision(
        parseOrchestratorPolicyEvaluationRequest(request),
        parseOrchestratorPolicyDecision(decision),
        options,
      );
      if (entry.expectedResult === "pass") {
        expect(operation, entry.scenarioId).not.toThrow();
      } else {
        try {
          operation();
          throw new Error(`Expected ${entry.scenarioId} to fail.`);
        } catch (error) {
          expect(error, entry.scenarioId)
            .toBeInstanceOf(OrchestrationContractError);
          expect((error as Error).message)
            .not.toContain("Caregiver review is recommended.");
        }
      }
    }
    expect(invoked).toBe(55);
    expect(invoked).toBe(ESCALATION_EXPECTATIONS.filter(
      (item) => item.expectedResult !== "not_applicable",
    ).length);
  });

  it("authorizes a minimized Specialist invocation without calling it", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.evaluationId = "evaluation-task4-invocation";
    request.activeAuditContext.correlationIds.push(request.evaluationId);
    request.stage = "specialist_invocation";
    request.specialistRequest =
      clonePolicyFixture(validSpecialistResponsePolicyRequest.specialistRequest);
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.decisionId = "decision-task4-invocation";
    decision.evaluationId = request.evaluationId;
    decision.stage = request.stage;
    decision.verdict = "approve";
    decision.rejectionCode = undefined;
    decision.specialistInvocationAuthorization = {
      decision: "approved",
      specialistRequestId: request.specialistRequest!.requestId,
      excludedMemoryReferenceIds: [],
      excludedEvidenceReferenceIds: [],
      excludedContextReferenceIds: [],
      policyFindingIds: [],
      nonExecutable: true,
    };
    Object.assign(decision.auditRecord, {
      auditDecisionId: "audit-task4-invocation",
      evaluationId: request.evaluationId,
      decisionId: decision.decisionId,
      policyStage: request.stage,
      verdict: "approve",
      specialistRequestId: request.specialistRequest!.requestId,
    });
    expect(validateOrchestratorPolicyDecision(request, decision)
      .specialistInvocationAuthorization?.decision).toBe("approved");
  });

  it.each([
    "rawMessage",
    "transcript",
    "rawImage",
    "base64",
    "toolArgs",
    "financialDetails",
  ])("rejects non-minimized audit metadata key %s", (key) => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.auditRecord.metadata = { nested: [{ [key]: "sensitive" }] };
    expectContractError(
      () => parseOrchestratorPolicyDecision(decision),
      "AUDIT_CONTENT_NOT_MINIMIZED",
    );
  });

  it.each(["token", "Token", "TOKEN", "auth_token", "bearer_token",
    "session_token"])("rejects exact normalized token key %s", (key) => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.metadata = { nested: [{ [key]: "opaque-secret" }] };
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_METADATA_INVALID",
    );
  });

  it.each(["tokenPolicy", "tokenRequired", "tokenReferenceType"])(
    "allows harmless declarative token metadata %s",
    (key) => {
      const request = clonePolicyFixture(validIngressPolicyRequest);
      request.metadata = { [key]: true };
      expect(parseOrchestratorPolicyEvaluationRequest(request).metadata)
        .toEqual({ [key]: true });
    },
  );
});

describe("Task 4 final contract hardening", () => {
  function imageRetentionScenario(includeRetentionConsent: boolean) {
    const request = clonePolicyFixture(
      validRequestMoreInformationPolicyRequest,
    );
    request.specialistResponse!.uiInstructions[0] = {
      instructionId: "instruction-task4-choice",
      type: "show_image_upload",
      sceneId: preventiveChoicePresentation.sceneId,
      payload: { prompt: "Upload an image for review." },
    };
    request.proposalRetentionDescriptors = [{
      subjectType: "ui_instruction",
      subjectId: "instruction-task4-choice",
      evidenceType: "image",
      processingMode: "retained",
      retentionTarget: "postgres",
      retentionPurpose: "purpose.image_retention",
      consentScopeRequired: "image_retention",
      noticeRequired: true,
      retentionClass: "long_term",
      metadata: {},
    }];
    request.consentContext.imageCaptureAllowed = true;
    request.consentContext.imageRetentionAllowed = includeRetentionConsent;
    request.consentContext.scopes.push("image_capture");
    request.consentContext.decisions.push({
      scope: "image_capture",
      decisionId: "consent-task4-image-capture",
      status: "granted",
      authorizationBasis: "explicit_user_consent",
      purpose: "purpose.image_capture",
      decidedAt: request.requestedAt,
      requiresRevalidation: false,
    });
    if (includeRetentionConsent) {
      request.consentContext.scopes.push("image_retention");
      request.consentContext.decisions.push({
        scope: "image_retention",
        decisionId: "consent-task4-image-retention",
        status: "granted",
        authorizationBasis: "explicit_user_consent",
        purpose: "purpose.image_retention",
        decidedAt: request.requestedAt,
        requiresRevalidation: false,
      });
    }
    const decision = clonePolicyFixture(validRequestMoreInformationDecision);
    const consentFacts = [{
      findingId: "finding-task4-image-capture",
      scope: "image_capture" as const,
      decisionId: "consent-task4-image-capture",
      purpose: "purpose.image_capture",
    }, ...(includeRetentionConsent
      ? [{
        findingId: "finding-task4-image-retention",
        scope: "image_retention" as const,
        decisionId: "consent-task4-image-retention",
        purpose: "purpose.image_retention",
      }]
      : [])];
    for (const consent of consentFacts) {
      decision.findings.push({
        findingId: consent.findingId,
        policyId: "policy.consent.allowed",
        category: "consent",
        severity: "informational",
        outcome: "allow",
        reasonCode: "IMAGE_CONSENT_ALLOWED",
        subjectType: "ui_instruction",
        subjectId: "instruction-task4-choice",
        sourceReferenceIds: [consent.decisionId],
        auditSummary: "Purpose-specific image consent is current.",
        createdAt: request.requestedAt,
        metadata: {},
      });
      decision.consentAuthorizations.push({
        authorizationId: `authorization-${consent.findingId}`,
        scope: consent.scope,
        consentDecisionId: consent.decisionId,
        authorizationBasis: "explicit_user_consent",
        purpose: consent.purpose,
        decision: "allow",
        policyFindingIds: [consent.findingId],
      });
      decision.auditRecord.findingIds.push(consent.findingId);
    }
    const registry = clonePolicyFixture(VYVA_PRESENTATION_REGISTRY);
    const selectedPresentation = registry.presentations.find(
      (item) =>
        item.presentationId === preventiveChoicePresentation.presentationId,
    )!;
    selectedPresentation.supportedUIInstructionTypes.push("show_image_upload");
    registry.families.find(
      (item) => item.familyId === selectedPresentation.familyId,
    )!.supportedUIInstructionTypes.push("show_image_upload");
    const catalogue = clonePolicyFixture(VYVA_FLOW_CATALOGUE);
    catalogue.flows.find(
      (item) => item.flowId === request.flowDefinitionReference.flowId,
    )!.evidenceRequirements.push({
      purpose: "Purpose-limited image review.",
      required: false,
      acceptedKinds: ["image"],
      acceptedMimeFamilies: ["image/*"],
      qualityCheckRequired: true,
      contextualQuestionIds: [],
      imageAloneInsufficient: true,
      observationOnly: true,
      retention: "purpose_limited",
      comparisonEligible: false,
    });
    return {
      request,
      decision,
      options: {
        flowCatalogue: parseFlowCatalogue(catalogue),
        presentationRegistry: parsePresentationRegistry(registry),
      },
    };
  }

  it("rejects image retention requested without retention consent", () => {
    const { request, decision, options } = imageRetentionScenario(false);
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision, options),
      "CONSENT_ACTION_NOT_AUTHORIZED",
    );
  });

  it("accepts image retention with separate capture and retention consent", () => {
    const { request, decision, options } = imageRetentionScenario(true);
    expect(validateOrchestratorPolicyDecision(request, decision, options)
      .consentAuthorizations.map((item) => item.scope))
      .toContain("image_retention");
  });

  it.each(["approve", "approve_with_constraints", "require_confirmation", "defer"] as const)(
    "reject forbids a %s adjudication",
    (adjudicationDecision) => {
      const decision = clonePolicyFixture(validDeferPolicyDecision);
      decision.verdict = "reject";
      decision.rejectionCode = "NO_APPROVED_ACTION";
      decision.deferPlan = undefined;
      decision.adjudications[0].decision = adjudicationDecision;
      decision.adjudications[0].constraints =
        ["approve_with_constraints", "require_confirmation"].includes(
          adjudicationDecision,
        )
          ? [{
            constraintId: "constraint-task4-reject",
            type: "require_user_confirmation",
            subjectId: decision.adjudications[0].subjectId,
            sourcePolicyId: "policy.presentation.allowed",
            reasonCode: "CONFIRMATION_REQUIRED",
            parameters: {},
          }]
          : [];
      decision.auditRecord.verdict = "reject";
      decision.auditRecord.constraintIds =
        decision.adjudications[0].constraints.map((item) => item.constraintId);
      expectContractError(
        () => validateOrchestratorPolicyDecision(
          validPresentationPolicyRequest,
          decision,
        ),
        "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
      );
    },
  );

  it.each(["next_question", "ui_instruction"] as const)(
    "reject forbids an approved %s adjudication",
    (subjectType) => {
      const decision = clonePolicyFixture(validRequestMoreInformationDecision);
      decision.verdict = "reject";
      decision.rejectionCode = "NO_APPROVED_ACTION";
      decision.approvedFlowStateProposal = undefined;
      decision.approvedPresentationPlan = undefined;
      decision.approvedResponsePlan = undefined;
      decision.adjudications.forEach((item) => {
        item.decision = item.subjectType === subjectType ? "approve" : "reject";
        item.constraints = [];
      });
      decision.auditRecord.verdict = "reject";
      expectContractError(
        () => validateOrchestratorPolicyDecision(
          validRequestMoreInformationPolicyRequest,
          decision,
        ),
        "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
      );
    },
  );

  it("accepts a defer verdict that names its deferred adjudication", () => {
    expect(validateOrchestratorPolicyDecision(
      validPresentationPolicyRequest,
      validDeferPolicyDecision,
    ).verdict).toBe("defer");
  });

  it("rejects defer without an affected adjudication or directive", () => {
    const decision = clonePolicyFixture(validDeferPolicyDecision);
    decision.deferPlan!.deferredAdjudicationIds = [];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it("rejects defer references to an approved adjudication", () => {
    const decision = clonePolicyFixture(validDeferPolicyDecision);
    decision.adjudications[0].decision = "approve";
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_VERDICT_INCOMPATIBLE",
    );
  });

  it.each([
    ["approvedChannel", "voice"],
    ["approvedDeviceClass", "desktop"],
    ["approvedLocale", "es"],
  ] as const)("rejects an unauthorized delivery-context switch for %s", (
    field,
    value,
  ) => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    Object.assign(decision.approvedPresentationPlan!, { [field]: value });
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "PRESENTATION_AUTHORIZATION_DENIED",
    );
  });

  it.each([
    ["approvedDeviceClass", "desktop", "deviceSwitch"],
    ["approvedLocale", "es", "localeSwitch"],
  ] as const)("accepts an explicitly authorized %s switch", (
    field,
    value,
    switchField,
  ) => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    Object.assign(decision.approvedPresentationPlan!, { [field]: value });
    decision.deliveryContextSwitchAuthorization = {
      authorizationId: `authorization-task4-${switchField}`,
      sourcePolicyId: "policy.presentation.allowed",
      reasonCode: "DELIVERY_CONTEXT_SWITCH_ALLOWED",
      flowId: validPresentationPolicyRequest.flowDefinitionReference.flowId,
      flowVersion:
        validPresentationPolicyRequest.flowDefinitionReference.version,
      sceneId: decision.approvedPresentationPlan!.sceneId,
      consentAuthorizationIds: [],
      policyFindingIds: ["finding-task4-presentation"],
      nonExecutable: true,
      ...(switchField === "deviceSwitch"
        ? {
          deviceSwitch: {
            from: "mobile" as const,
            to: "desktop" as const,
          },
        }
        : {
          localeSwitch: {
            from: "en",
            to: "es",
          },
        }),
    };
    expect(validateOrchestratorPolicyDecision(
      validPresentationPolicyRequest,
      decision,
    ).approvedPresentationPlan?.[field]).toBe(value);
  });

  it("accepts an explicitly authorized Channel switch with destination consent", () => {
    const request = clonePolicyFixture(validPresentationPolicyRequest);
    request.consentContext.decisions[0].permittedChannels = ["pwa", "voice"];
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.approvedPresentationPlan!.approvedChannel = "voice";
    decision.findings.push({
      findingId: "finding-task4-channel-consent",
      policyId: "policy.consent.allowed",
      category: "consent",
      severity: "informational",
      outcome: "allow",
      reasonCode: "CHANNEL_SWITCH_CONSENT_ALLOWED",
      subjectType: "presentation",
      subjectId: preventiveChoicePresentation.presentationId,
      sourceReferenceIds: ["consent-task4-health"],
      auditSummary: "Destination Channel consent is current.",
      createdAt: request.requestedAt,
      metadata: {},
    });
    decision.consentAuthorizations.push({
      authorizationId: "authorization-task4-channel-consent",
      scope: "health_data",
      consentDecisionId: "consent-task4-health",
      authorizationBasis: "explicit_user_consent",
      purpose: "purpose.preventive_health",
      decision: "allow",
      policyFindingIds: ["finding-task4-channel-consent"],
    });
    decision.deliveryContextSwitchAuthorization = {
      authorizationId: "authorization-task4-channel-switch",
      sourcePolicyId: "policy.presentation.allowed",
      reasonCode: "DELIVERY_CONTEXT_SWITCH_ALLOWED",
      flowId: request.flowDefinitionReference.flowId,
      flowVersion: request.flowDefinitionReference.version,
      sceneId: decision.approvedPresentationPlan!.sceneId,
      channelSwitch: { from: "pwa", to: "voice" },
      consentAuthorizationIds: ["authorization-task4-channel-consent"],
      policyFindingIds: ["finding-task4-presentation"],
      nonExecutable: true,
    };
    decision.auditRecord.findingIds.push("finding-task4-channel-consent");
    expect(validateOrchestratorPolicyDecision(request, decision)
      .approvedPresentationPlan?.approvedChannel).toBe("voice");
  });

  it("rejects canonical submit interruption weakened from true to false", () => {
    const decision = clonePolicyFixture(validPresentationApprovalDecision);
    decision.approvedPresentationPlan!.voiceSynchronizationDecision
      .interruptSpeechOnSubmit = false;
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validPresentationPolicyRequest,
        decision,
      ),
      "VOICE_UI_POLICY_MISMATCH",
    );
  });

  it.each([
    "Take 20 mg now",
    "Double your dose",
    "Stop taking the medication",
    "Skip the next dose",
    "This medicine is definitely appropriate for you",
  ])("rejects unapproved medication guidance: %s", (text) => {
    const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
    request.specialistResponse!.responseGuidance.facts[0] = text;
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    decision.approvedResponsePlan!.approvedFacts[0].text = text;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "RESPONSE_COMPOSITION_DENIED",
    );
  });

  it("accepts a classified medication reminder", () => {
    const text = "It is time for your scheduled medication";
    const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
    request.specialistResponse!.responseGuidance.facts[0] = text;
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    Object.assign(decision.approvedResponsePlan!.approvedFacts[0], {
      text,
      classification: "medication_reminder",
    });
    expect(validateOrchestratorPolicyDecision(request, decision)
      .approvedResponsePlan?.approvedFacts[0].classification)
      .toBe("medication_reminder");
  });

  function canonicalMedicationScenario() {
    const text = "Take 20 mg now";
    const carePlanId = "care-plan-task4-001";
    const request = clonePolicyFixture(validSpecialistResponsePolicyRequest);
    request.specialistResponse!.responseGuidance.facts[0] = text;
    request.approvedMedicationAuthoritySources = [{
      sourceReferenceId: "source-record-task4-001",
      issuerType: "approved_care_plan",
      issuerReferenceId: "issuer-task4-care-plan",
      carePlanId: "care-plan-record-task4-001",
      userId: request.userId,
      profileId: request.profileId,
      status: "active",
      metadata: {},
    }];
    request.approvedCarePlanInstructions = [{
      instructionReferenceId: carePlanId,
      carePlanId: "care-plan-record-task4-001",
      instructionId: "instruction-task4-medication",
      userId: request.userId,
      profileId: request.profileId,
      medicationReferenceId: "medication-task4-001",
      instructionType: "approved_care_plan_instruction",
      authorizedInstructionText: text,
      dosage: 20,
      unit: "mg",
      validFrom: "2025-01-01T00:00:00.000Z",
      issuerType: "approved_care_plan",
      issuerReferenceId: "issuer-task4-care-plan",
      sourceRecordReferenceId: "source-record-task4-001",
      status: "active",
      metadata: {},
    }];
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    decision.findings.find(
      (item) => item.findingId === "finding-task4-response-guidance",
    )!.sourceReferenceIds.push(carePlanId);
    Object.assign(decision.approvedResponsePlan!.approvedFacts[0], {
      text,
      classification: "approved_care_plan_instruction",
      carePlanReferenceId: carePlanId,
      medicationReferenceId: "medication-task4-001",
      dosage: 20,
      unit: "mg",
      medicationPolicyFindingId: "finding-task4-response-guidance",
    });
    decision.approvedResponsePlan!.requiredDisclaimers.push(
      "disclaimer.medication.care_plan",
    );
    return { request, decision, carePlanId };
  }

  it("accepts a care-plan medication instruction with policy provenance", () => {
    const { request, decision, carePlanId } = canonicalMedicationScenario();
    expect(validateOrchestratorPolicyDecision(request, decision)
      .approvedResponsePlan?.approvedFacts[0].carePlanReferenceId)
      .toBe(carePlanId);
  });

  it("rejects a fabricated medication care-plan reference", () => {
    const { request, decision } = canonicalMedicationScenario();
    decision.approvedResponsePlan!.approvedFacts[0].carePlanReferenceId =
      "fabricated-care-plan";
    decision.findings[1].sourceReferenceIds.push("fabricated-care-plan");
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_PROVENANCE_INVALID",
    );
  });

  it.each(["expired", "revoked"] as const)(
    "rejects a %s canonical medication instruction",
    (status) => {
      const { request, decision } = canonicalMedicationScenario();
      request.approvedCarePlanInstructions![0].status = status;
      expectContractError(
        () => validateOrchestratorPolicyDecision(request, decision),
        "ORCHESTRATOR_PROVENANCE_INVALID",
      );
    },
  );

  it("rejects medication authority for the wrong user", () => {
    const { request, decision } = canonicalMedicationScenario();
    request.approvedCarePlanInstructions![0].userId = "wrong-user";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_PROVENANCE_INVALID",
    );
  });

  it("rejects the wrong medication reference", () => {
    const { request, decision } = canonicalMedicationScenario();
    decision.approvedResponsePlan!.approvedFacts[0].medicationReferenceId =
      "wrong-medication";
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_PROVENANCE_INVALID",
    );
  });

  it("rejects a dosage that differs from canonical instruction", () => {
    const { request, decision } = canonicalMedicationScenario();
    decision.approvedResponsePlan!.approvedFacts[0].dosage = 40;
    expectContractError(
      () => validateOrchestratorPolicyDecision(request, decision),
      "ORCHESTRATOR_PROVENANCE_INVALID",
    );
  });

  it("rejects an untraced evidence limitation", () => {
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    decision.approvedResponsePlan!.evidenceLimitations = [
      "An image alone cannot establish a diagnosis.",
    ];
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validSpecialistResponsePolicyRequest,
        decision,
      ),
      "RESPONSE_COMPOSITION_DENIED",
    );
  });

  it("accepts an evidence limitation with policy and source trace", () => {
    const text = "An image alone cannot establish a diagnosis.";
    const decision = clonePolicyFixture(validSpecialistApprovalDecision);
    const finding = decision.findings.find(
      (item) => item.findingId === "finding-task4-response-guidance",
    )!;
    finding.sourceReferenceIds.push(
      validSpecialistResponsePolicyRequest.flowDefinitionReference.flowId,
    );
    decision.approvedResponsePlan!.evidenceLimitations = [text];
    decision.approvedResponsePlan!.evidenceLimitationReferences = [{
      text,
      sourceReferenceId:
        validSpecialistResponsePolicyRequest.flowDefinitionReference.flowId,
      policyFindingId: finding.findingId,
    }];
    expect(validateOrchestratorPolicyDecision(
      validSpecialistResponsePolicyRequest,
      decision,
    ).approvedResponsePlan?.evidenceLimitations).toEqual([text]);
  });

  it.each([
    "4111 1111 1111 1111",
    "VGhpcyBpcyBhIGJhc2U2NCBwYXlsb2FkIHRoYXQgaXMgbG9uZyBlbm91Z2ggdG8gYmUgcmVqZWN0ZWQgYnkgdGhlIGF1ZGl0IHZhbHVlIGd1YXJkLg==",
    "User said they felt unwell and then provided a full raw transcript block.",
  ])("rejects unsafe content under a neutral audit key", (note) => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.auditRecord.metadata = { note };
    expectContractError(
      () => parseOrchestratorPolicyDecision(decision),
      "AUDIT_CONTENT_NOT_MINIMIZED",
    );
  });

  it.each([
    "SAFE_REASON_CODE",
    "opaque-reference-task4-001",
    "550e8400-e29b-41d4-a716-446655440000",
    "2026-07-31T10:00:00.000Z",
  ])("accepts architecture-safe audit reference %s", (value) => {
    const decision = clonePolicyFixture(validRejectPolicyDecision);
    decision.auditRecord.metadata = { reference: value };
    expect(parseOrchestratorPolicyDecision(decision).auditRecord.metadata)
      .toEqual({ reference: value });
  });

  it("rejects active audit context missing the current event ID", () => {
    const request = clonePolicyFixture(validIngressPolicyRequest);
    request.activeAuditContext.correlationIds =
      request.activeAuditContext.correlationIds.filter(
        (id) => id !== request.interactionEvent.eventId,
      );
    expectContractError(
      () => parseOrchestratorPolicyEvaluationRequest(request),
      "ORCHESTRATOR_CORRELATION_INVALID",
    );
  });

  it("rejects a Tool Channel constraint without Tool Channel authority", () => {
    const decision = clonePolicyFixture(validToolAuthorizationDecision);
    decision.adjudications[0].constraints.push({
      constraintId: "constraint-task4-tool-channel",
      type: "restrict_channel",
      subjectId: decision.adjudications[0].subjectId,
      sourcePolicyId: "policy.tool.allowed",
      reasonCode: "TOOL_CHANNEL_RESTRICTED",
      parameters: { allowedChannels: ["pwa"] },
    });
    decision.adjudications[0].decision = "approve_with_constraints";
    decision.auditRecord.constraintIds.push("constraint-task4-tool-channel");
    expectContractError(
      () => validateOrchestratorPolicyDecision(
        validToolPolicyRequest,
        decision,
      ),
      "ORCHESTRATOR_CONSTRAINT_INVALID",
    );
  });
});

describe("policy catalogue completeness", () => {
  const independentlyExpectedFindingPairs = new Set([
    "informational:allow",
    "caution:allow",
    "caution:constrain",
    "caution:require_confirmation",
    "caution:require_revalidation",
    "blocking:deny",
    "blocking:require_confirmation",
    "blocking:require_revalidation",
    "blocking:require_safe_fallback",
    "critical:deny",
    "critical:require_escalation",
    "critical:require_safe_fallback",
  ]);

  it.each(
    (["informational", "caution", "blocking", "critical"] as const).flatMap(
      (severity) => ORCHESTRATOR_POLICY_EFFECTS.map(
        (outcome) => [severity, outcome] as const,
      ),
    ),
  )("enforces finding compatibility %s + %s", (severity, outcome) => {
    const expected = independentlyExpectedFindingPairs.has(
      `${severity}:${outcome}`,
    );
    if (expected) {
      expect(() => validatePolicyFindingCompatibility(severity, outcome))
        .not.toThrow();
      return;
    }
    expectContractError(
      () => validatePolicyFindingCompatibility(severity, outcome),
      "ORCHESTRATOR_FINDING_COMPATIBILITY_INVALID",
    );
  });

  it("has unique stable policy IDs and deterministic priorities", () => {
    const ids = ORCHESTRATOR_POLICY_PRECEDENCE.map((policy) => policy.policyId);
    const priorities = ORCHESTRATOR_POLICY_PRECEDENCE.map(
      (policy) => policy.priority,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(priorities).size).toBe(priorities.length);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it("covers every policy category", () => {
    const categories = new Set(
      ORCHESTRATOR_POLICY_PRECEDENCE.map((policy) => policy.category),
    );
    ORCHESTRATOR_POLICY_CATEGORIES.forEach((category) => {
      expect(categories.has(category)).toBe(true);
    });
  });

  it("contains only declarative JSON policy facts", () => {
    const serialized = JSON.stringify(ORCHESTRATOR_POLICY_PRECEDENCE);
    expect(serialized).not.toContain("function");
    expect(ORCHESTRATOR_POLICY_PRECEDENCE.every((policy) =>
      Object.values(policy).every((value) => typeof value !== "function"),
    )).toBe(true);
  });

  it("uses strict schemas at both public boundaries", () => {
    expect(orchestratorPolicyEvaluationRequestSchema.safeParse({
      ...validIngressPolicyRequest,
      unknown: true,
    }).success).toBe(false);
    expect(orchestratorPolicyDecisionSchema.safeParse({
      ...validRejectPolicyDecision,
      unknown: true,
    }).success).toBe(false);
  });

  it("resolves canonical wound and scam Presentation candidates", () => {
    expect(woundPresentationCandidateFixture.supportedFlowIds).toContain(
      "health.visual.wound_assessment",
    );
    expect(scamPresentationCandidateFixture.supportedFlowIds).toContain(
      "trust.scam_assessment",
    );
  });

  it("keeps every authorization and directive non-executable", () => {
    expect(validPresentationApprovalDecision.approvedPresentationPlan
      ?.nonExecutable).toBe(true);
    expect(validSpecialistApprovalDecision.approvedFlowStateProposal
      ?.nonExecutable).toBe(true);
  });
});
