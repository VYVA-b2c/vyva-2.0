import {
  policyActiveFlowStateFixture,
  policyInteractionEventFixture,
  memoryEnabledFlowCatalogueFixture,
  preventiveChoicePresentation,
  preventiveFlowDefinition,
  validIngressPolicyRequest,
  validRejectPolicyDecision,
  validPresentationApprovalDecision,
  validPresentationPolicyRequest,
  validSpecialistApprovalDecision,
  validSpecialistResponsePolicyRequest,
  validToolAuthorizationDecision,
  validToolPolicyRequest,
} from "./orchestratorPolicyFixtures";
import {
  COMPATIBILITY_SCHEMA_VERSION,
  SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS,
  VYVA_LEGACY_SEAM_REGISTRY,
  type AdapterAuthorizationPlan,
  type AuthorityVector,
  type CompatibilityDecisionRecord,
  type CompatibilityEvaluationRequest,
  type CompatibilityEvidence,
  type CompatibilityFeatureFlagState,
  type CompatibilityRollbackPlan,
  type GoldenCompatibilityCatalogue,
  type ShadowComparisonRecord,
} from "./compatibilityBoundary";
import {
  parseFlowCatalogue,
  VYVA_FLOW_CATALOGUE,
  type FlowCatalogue,
} from "./flowCatalogue";
import { VYVA_PRESENTATION_REGISTRY } from "./presentationRegistry";

export const compatibilityTimestamp = "2026-01-15T10:00:00.000Z";
export const compatibilityExpiry = "2027-01-15T10:00:00.000Z";
export const compatibilityDigest =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const compatibilityDigestRecord = {
  algorithm: "sha256" as const,
  value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  canonicalizationVersion: "1.0.0" as const,
};

export const emptyAuthorityVectorFixture: AuthorityVector = {
  channels: [],
  targets: [],
  toolIds: [],
  toolAuthorizationIds: [],
  toolSchemaIds: [],
  toolExpectedResultTypes: [],
  toolRiskClassifications: [],
  toolIdempotencyKeyReferences: [],
  toolConsentAuthorizationIds: [],
  toolArgumentDigestIds: [],
  memoryAuthorizationIds: [],
  memorySubjectIds: [],
  memoryCategories: [],
  memoryTargets: [],
  retentionModes: [],
  escalationTypes: [],
  escalationTargets: [],
  escalationChannels: [],
  escalationUrgencies: [],
  escalationAuthorizationIds: [],
  escalationConsentAuthorizationIds: [],
  escalationDuplicateReferences: [],
  presentationIds: [],
  presentationVersions: [],
  sceneIds: [],
  flowIds: [],
  flowVersions: [],
  responseFactIds: [],
  medicationInstructionIds: [],
  consentScopes: [],
  sessionWriteTypes: [],
  browserEventTypes: [],
  legacyEffectKinds: [],
  scheduleIds: [],
  retryPolicies: [],
  minimumSafetyRank: 2,
  minimumPrivacyRank: 2,
  confirmationRequired: false,
  acknowledgementRequired: false,
  requiredDisclaimerIds: [],
  prohibitedClaimIds: [],
  auditRequired: true,
  idempotencyRequired: false,
  timeoutPolicyIds: [],
  failurePolicyIds: [],
  providerAuthority: false,
  executionAuthority: false,
};

const agentSeam = VYVA_LEGACY_SEAM_REGISTRY.seams.find(
  (seam) => seam.seamId === "legacy.voice.agent_contract",
)!;

export const validCompatibilityRequestFixture: CompatibilityEvaluationRequest = {
  compatibilityRequestId: "compatibility-request-task5-001",
  compatibilitySchemaVersion: COMPATIBILITY_SCHEMA_VERSION,
  contractVersions: {
    interactionEventVersion:
      SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS.interactionEvent,
    flowStateVersion: SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS.flowState,
    specialistContractVersion:
      SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS.specialist,
    flowCatalogueVersion:
      SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS.flowCatalogue,
    presentationRegistryVersion:
      SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS.presentationRegistry,
    orchestratorPolicyVersion:
      SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS.orchestratorPolicy,
    compatibilitySchemaVersion:
      SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS.compatibilityBoundary,
  },
  legacyInputSnapshot: {
    snapshotId: "legacy-input-task5-001",
    seamId: agentSeam.seamId,
    seamVersion: agentSeam.seamVersion,
    capturedAt: compatibilityTimestamp,
    correlationId: policyInteractionEventFixture.correlationId!,
    sessionReference: policyActiveFlowStateFixture.sessionId,
    userReference: policyActiveFlowStateFixture.userId,
    profileReference: policyInteractionEventFixture.profileId,
    locale: "en",
    channel: "pwa",
    deviceClass: "mobile",
    agentDomain: "health",
    agentContractId: "health_assistant",
    entrypoint: "health",
    planId: "health_assistant_session",
    startsFrom: "health_page",
    contextKeyPresence: {
      agent_operating_rules: true,
      conversation_plan_id: true,
      health_context: true,
    },
    contextValidationStatus: "ready",
    actionType: "health.daily_checkin",
    legacyRouteReference: "legacy-route-health",
    legacyFlowReference: preventiveFlowDefinition.flowId,
    safeMetadata: { fixture: "synthetic" },
  },
  normalizedEvent: policyInteractionEventFixture,
  currentFlowState: policyActiveFlowStateFixture,
  policyEvaluationRequest: validIngressPolicyRequest,
  suppliedPolicyDecision: validRejectPolicyDecision,
  compatibilityMode: {
    requestedMode: "legacy_only",
    effectiveMode: "legacy_only",
    defaultMode: "legacy_only",
    activationEligibility: "eligible",
    reasonCode: "TASK5_INERT_DEFAULT",
    nonExecutable: true,
  },
  legacySeamSnapshot: agentSeam,
  expectedComparisonPolicy: {
    comparisonPolicyId: "policy.compatibility.default",
    version: "1.0.0",
    requiredDimensions: [
      "response", "session", "safety", "routing", "escalation",
      "presentation", "effects",
    ],
    allowedDifferenceCodes: ["LEGACY_FORMAT_ONLY"],
    safetyDowngradeAllowed: false,
    consentDowngradeAllowed: false,
  },
  auditContext: {
    auditReference: "audit-task5-001",
    correlationId: policyInteractionEventFixture.correlationId!,
    sessionReference: policyActiveFlowStateFixture.sessionId,
    capturedAt: compatibilityTimestamp,
    metadata: { fixture: "synthetic" },
  },
  nonExecutable: true,
};

export const validLegacyOutputSnapshotFixture:
  CompatibilityDecisionRecord["legacyOutputSnapshot"] = {
    snapshotId: "legacy-output-task5-001",
    inputSnapshotId: validCompatibilityRequestFixture.legacyInputSnapshot.snapshotId,
    seamId: validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
    seamVersion: validCompatibilityRequestFixture.legacyInputSnapshot.seamVersion,
    capturedAt: compatibilityTimestamp,
    correlationId:
      validCompatibilityRequestFixture.legacyInputSnapshot.correlationId,
    responseReference: "legacy-response-task5-001",
    responseStatus: "success",
    responseDigest: compatibilityDigest,
    responseDigestProvenance: {
      algorithm: "sha256",
      canonicalizationVersion: "1.0.0",
      nonExecutable: true,
    },
    semanticResponseFactIds: [],
    sessionWriteProposals: [],
    browserEventProposals: [],
    safetyClassification: "clear",
    effects: [],
    auditReference: validCompatibilityRequestFixture.auditContext.auditReference,
    safeMetadata: { fixture: "synthetic" },
    nonExecutable: true,
  };

const exactDimension = (
  dimension: "response" | "session" | "safety" | "routing" |
    "escalation" | "presentation" | "effects",
) => ({
  dimension,
  classification: "exact_match" as const,
  legacyDigest: { ...compatibilityDigestRecord },
  canonicalDigest: { ...compatibilityDigestRecord },
  comparatorId: "comparator.exact_digest" as const,
  comparatorVersion: "1.0.0" as const,
  comparatorEvidenceReferences: [],
  policyFindingIds: [],
  directiveIds: [],
  safetyDowngrade: false,
  consentDowngrade: false,
  privacyDowngrade: false,
});

export const validShadowComparisonFixture: ShadowComparisonRecord = {
  comparisonId: "comparison-task5-001",
  compatibilityRequestId:
    validCompatibilityRequestFixture.compatibilityRequestId,
  legacySnapshotId: validLegacyOutputSnapshotFixture.snapshotId,
  canonicalDecisionId:
    validCompatibilityRequestFixture.suppliedPolicyDecision.decisionId,
  seamId: validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
  comparisonPolicyId:
    validCompatibilityRequestFixture.expectedComparisonPolicy.comparisonPolicyId,
  comparisonPolicyVersion: "1.0.0",
  comparatorId: "comparator.exact_digest",
  comparatorVersion: "1.0.0",
  comparedAt: compatibilityTimestamp,
  responseComparison: exactDimension("response"),
  responseEvidence: {
    evidenceReference: "evidence-response-task5-001",
    compatibilityRequestId:
      validCompatibilityRequestFixture.compatibilityRequestId,
    task4DecisionId:
      validCompatibilityRequestFixture.suppliedPolicyDecision.decisionId,
    legacyResponseReference:
      validLegacyOutputSnapshotFixture.responseReference!,
    canonicalResponseReference:
      validCompatibilityRequestFixture.suppliedPolicyDecision.decisionId,
    canonicalDigest: { ...compatibilityDigestRecord },
    requiredDisclaimers: [],
    prohibitedClaims: [],
    medicationReferenceIds: [],
    safetyInvariantPassed: true,
    consentInvariantPassed: true,
    privacyInvariantPassed: true,
    emergencyAuthorityPreserved: true,
    nonExecutable: true,
  },
  sessionComparison: exactDimension("session"),
  safetyComparison: exactDimension("safety"),
  routingComparison: exactDimension("routing"),
  escalationComparison: exactDimension("escalation"),
  presentationComparison: exactDimension("presentation"),
  effectComparison: exactDimension("effects"),
  expectedDifferenceReferences: [],
  mismatchFindings: [],
  finalClassification: "byte_equivalent",
  auditReference: validCompatibilityRequestFixture.auditContext.auditReference,
  nonExecutable: true,
};

export const validRollbackPlanFixture: CompatibilityRollbackPlan = {
  rollbackPlanId: "rollback-task5-shadow",
  triggerKinds: ["parity_mismatch", "safety_mismatch"],
  sourceMode: "shadow_compare",
  targetMode: "legacy_only",
  targetLegacySeamId:
    validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
  reasonCodes: ["RETURN_TO_LEGACY"],
  requiredFindings: [],
  requiredEvidence: [],
  auditReference: validCompatibilityRequestFixture.auditContext.auditReference,
  expectedRecoverySemantics: {
    preserveEmergencyHandling: true,
    preserveRequiredAudit: true,
    restoreRevokedConsent: false,
    handlerSeamId:
      validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
  },
  nonExecutable: true,
};

export const validGoldenCatalogueFixture: GoldenCompatibilityCatalogue = {
  catalogueId: "vyva.compatibility.golden_cases",
  catalogueVersion: "1.0.0",
  cases: [{
    goldenCaseId: "golden.preventive.ingress",
    version: "1.0.0",
    title: "Synthetic preventive ingress parity",
    purpose: "purpose.preventive_health",
    seamId: validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
    inputFixtureReference: "fixture.compatibility.preventive.input",
    legacyExpectedReference: "fixture.compatibility.preventive.legacy",
    canonicalExpectedReference: "fixture.compatibility.preventive.canonical",
    flowReference: {
      catalogueVersion: VYVA_FLOW_CATALOGUE.catalogueVersion,
      flowId: preventiveFlowDefinition.flowId,
      version: preventiveFlowDefinition.version,
    },
    presentationReference: {
      registryVersion: VYVA_PRESENTATION_REGISTRY.registryVersion,
      presentationId: preventiveChoicePresentation.presentationId,
      version: preventiveChoicePresentation.version,
    },
    policyReferences: ["policy.safety.emergency"],
    comparisonPolicyId: "policy.compatibility.default",
    comparisonPolicyVersion: "1.0.0",
    expectedClassification: "byte_equivalent",
    requiredSafetyInvariants: ["safety.no_downgrade"],
    requiredConsentInvariants: ["consent.no_downgrade"],
    requiredPrivacyInvariants: ["privacy.no_downgrade"],
    requiredSessionInvariants: ["session.legacy_unchanged"],
    requiredRoutingInvariants: ["routing.legacy_unchanged"],
    requiredEffectInvariants: ["effect.legacy_unchanged"],
    requiredAuditInvariants: ["audit.correlation_complete"],
    allowedDifferences: [],
    prohibitedDifferences: ["safety_downgrade", "consent_downgrade"],
    status: "approved",
    provenance: {
      fixtureKind: "synthetic",
      sourceReference: "fixture.task5.synthetic",
      approvedByReference: "review.task5.architecture",
    },
    nonExecutable: true,
  }],
  nonExecutable: true,
};

export const validCompatibilityEvidenceFixture: CompatibilityEvidence = {
  evidenceId: "evidence-task5-001",
  goldenCaseId: validGoldenCatalogueFixture.cases[0].goldenCaseId,
  goldenCaseVersion: validGoldenCatalogueFixture.cases[0].version,
  runId: "run-task5-001",
  commitReference: "f3fe78fe",
  legacySeamId: validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
  legacyVersion: "1.0.0",
  canonicalContractVersions:
    validCompatibilityRequestFixture.contractVersions,
  comparatorId: "comparator.exact_digest",
  comparatorVersion: "1.0.0",
  comparisonPolicyId: "policy.compatibility.default",
  comparisonPolicyVersion: "1.0.0",
  observedClassification: "byte_equivalent",
  expectedClassification: "byte_equivalent",
  invariantResults: [
    {
      invariantId: "safety.no_downgrade",
      category: "safety",
      passed: true,
      evidenceReference: "evidence-safety-task5",
    },
    {
      invariantId: "consent.no_downgrade",
      category: "consent",
      passed: true,
      evidenceReference: "evidence-consent-task5",
    },
    {
      invariantId: "privacy.no_downgrade",
      category: "privacy",
      passed: true,
      evidenceReference: "evidence-privacy-task5",
    },
    {
      invariantId: "session.legacy_unchanged",
      category: "session",
      passed: true,
      evidenceReference: "evidence-session-task5",
    },
    {
      invariantId: "routing.legacy_unchanged",
      category: "routing",
      passed: true,
      evidenceReference: "evidence-routing-task5",
    },
    {
      invariantId: "effect.legacy_unchanged",
      category: "effect",
      passed: true,
      evidenceReference: "evidence-effect-task5",
    },
    {
      invariantId: "audit.correlation_complete",
      category: "audit",
      passed: true,
      evidenceReference: "evidence-audit-task5",
    },
  ],
  mismatchReferences: [],
  generatedAt: compatibilityTimestamp,
  reviewedByReference: "reviewer-task5",
  reviewStatus: "accepted",
  expiry: compatibilityExpiry,
  nonExecutable: true,
};

export const validShadowFeatureFlagFixture: CompatibilityFeatureFlagState = {
  flagId: "flag.compatibility.shadow",
  flagVersion: "1.0.0",
  defaultMode: "legacy_only",
  requestedMode: "shadow_compare",
  effectiveMode: "shadow_compare",
  environmentClass: "staging",
  audienceClass: "internal_synthetic",
  percentageBasisPoints: 100,
  denyListMatched: false,
  prerequisiteEvidenceIds: [validCompatibilityEvidenceFixture.evidenceId],
  rollbackPlanId: validRollbackPlanFixture.rollbackPlanId,
  expiry: compatibilityExpiry,
  ownerReference: "owner-task5-architecture",
  auditReference: validCompatibilityRequestFixture.auditContext.auditReference,
  nonExecutable: true,
};

export const validAuditAdapterPlanFixture: AdapterAuthorizationPlan = {
  adapterPlanId: "adapter-plan-task5-audit",
  adapterCategory: "audit_adapter",
  sourceDecisionId:
    validCompatibilityRequestFixture.suppliedPolicyDecision.decisionId,
  sourceAdjudicationIds: [],
  sourceFindingIds: [],
  sourcePlanIds: [],
  sourceDirectiveIds: [],
  sourceSeamId: validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
  targetSeamId: validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
  sourceAuthority: { ...emptyAuthorityVectorFixture },
  authorizedEffects: [{
    effectId: "effect-task5-audit",
    effectType: "audit",
    authority: { ...emptyAuthorityVectorFixture },
    sourcePlanId: "adapter-plan-task5-audit",
    nonExecutable: true,
  }],
  prohibitedEffects: [],
  narrowingConstraints: ["no_raw_content"],
  correlationId: validCompatibilityRequestFixture.auditContext.correlationId,
  auditReference: validCompatibilityRequestFixture.auditContext.auditReference,
  nonExecutable: true,
};

export const validCompatibilityDecisionFixture: CompatibilityDecisionRecord = {
  compatibilityDecisionId: "compatibility-decision-task5-001",
  compatibilityRequestId:
    validCompatibilityRequestFixture.compatibilityRequestId,
  compatibilitySchemaVersion: COMPATIBILITY_SCHEMA_VERSION,
  decidedAt: compatibilityTimestamp,
  modeState: validCompatibilityRequestFixture.compatibilityMode,
  legacyOutputSnapshot: validLegacyOutputSnapshotFixture,
  legacyDisposition: {
    responsePreserved: true,
    sessionPreserved: true,
    effectsPreserved: true,
    deliveryAuthority: "legacy_handler",
    nonExecutable: true,
  },
  adapterPlans: [],
  evidence: [],
  observability: {
    observabilityId: "observability-task5-001",
    compatibilityRequestId:
      validCompatibilityRequestFixture.compatibilityRequestId,
    responseComparison: "not_comparable",
    sessionComparison: "not_comparable",
    effectComparison: "not_comparable",
    safetyDivergence: false,
    consentDivergence: false,
    fallbackRecommendation: "none",
    rolloutEligibility: "ineligible",
    latencyBucketReference: "latency.not_measured",
    correlationId: validCompatibilityRequestFixture.auditContext.correlationId,
    auditReference: validCompatibilityRequestFixture.auditContext.auditReference,
    safeMetadata: { fixture: "synthetic" },
    nonExecutable: true,
  },
  finalClassification: "insufficient_evidence",
  auditReference: validCompatibilityRequestFixture.auditContext.auditReference,
  nonExecutable: true,
};

export function cloneCompatibilityFixture<T>(fixture: T): T {
  return structuredClone(fixture);
}

export function createPolicyApprovedDifferenceScenario(): {
  request: CompatibilityEvaluationRequest;
  decision: CompatibilityDecisionRecord;
} {
  const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
  request.normalizedEvent = cloneCompatibilityFixture(
    validSpecialistResponsePolicyRequest.interactionEvent!,
  );
  request.currentFlowState = cloneCompatibilityFixture(
    validSpecialistResponsePolicyRequest.activeFlowState!,
  );
  request.policyEvaluationRequest = cloneCompatibilityFixture(
    validSpecialistResponsePolicyRequest,
  );
  request.suppliedPolicyDecision = cloneCompatibilityFixture(
    validSpecialistApprovalDecision,
  );
  request.suppliedPolicyDecision.approvedResponsePlan!.requiredDisclaimers = [
    "disclaimer.task5.synthetic",
  ];
  request.legacyInputSnapshot.correlationId =
    request.normalizedEvent.correlationId!;
  request.legacyInputSnapshot.sessionReference =
    request.currentFlowState.sessionId;
  request.legacyInputSnapshot.userReference = request.currentFlowState.userId;
  request.legacyInputSnapshot.profileReference =
    request.normalizedEvent.profileId;
  request.auditContext.correlationId = request.normalizedEvent.correlationId!;
  request.auditContext.sessionReference = request.currentFlowState.sessionId;

  const comparison = cloneCompatibilityFixture(validShadowComparisonFixture);
  comparison.canonicalDecisionId = request.suppliedPolicyDecision.decisionId;
  comparison.responseComparison.classification =
    "approved_policy_difference";
  comparison.responseComparison.comparatorId =
    "comparator.policy_difference";
  comparison.responseComparison.comparatorEvidenceReferences = [
    "evidence.policy.legacy_format_only",
  ];
  comparison.responseComparison.differenceCategory = "LEGACY_FORMAT_ONLY";
  comparison.responseComparison.policyFindingIds = [
    "finding-task4-response-guidance",
  ];
  comparison.responseEvidence = {
    evidenceReference: "evidence.policy.legacy_format_only",
    compatibilityRequestId: request.compatibilityRequestId,
    task4DecisionId: request.suppliedPolicyDecision.decisionId,
    legacyResponseReference: validLegacyOutputSnapshotFixture.responseReference!,
    canonicalResponseReference:
      `${request.policyEvaluationRequest.specialistResponse!.requestId}` +
      ".response_guidance",
    canonicalDigest: { ...compatibilityDigestRecord },
    requiredDisclaimers: [
      ...request.suppliedPolicyDecision.approvedResponsePlan!
        .requiredDisclaimers,
    ],
    prohibitedClaims: [
      ...request.suppliedPolicyDecision.approvedResponsePlan!.prohibitedClaims,
    ],
    medicationReferenceIds: request.suppliedPolicyDecision
      .approvedResponsePlan!.approvedFacts.flatMap((fact) =>
        fact.medicationReferenceId
          ? [fact.medicationReferenceId]
          : fact.carePlanReferenceId
            ? [fact.carePlanReferenceId]
            : []),
    safetyInvariantPassed: true,
    consentInvariantPassed: true,
    privacyInvariantPassed: true,
    emergencyAuthorityPreserved: true,
    nonExecutable: true,
  };
  comparison.expectedDifferenceReferences = ["LEGACY_FORMAT_ONLY"];
  comparison.finalClassification = "policy_approved_difference";

  const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
  decision.legacyOutputSnapshot.correlationId =
    request.legacyInputSnapshot.correlationId;
  decision.shadowComparison = comparison;
  decision.finalClassification = "policy_approved_difference";
  decision.observability.responseComparison = "approved_policy_difference";
  decision.observability.sessionComparison = "exact_match";
  decision.observability.effectComparison = "exact_match";
  return { request, decision };
}

export function createToolAdapterScenario(): {
  request: CompatibilityEvaluationRequest;
  decision: CompatibilityDecisionRecord;
} {
  const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
  request.normalizedEvent = cloneCompatibilityFixture(
    validToolPolicyRequest.interactionEvent!,
  );
  request.currentFlowState = cloneCompatibilityFixture(
    validToolPolicyRequest.activeFlowState!,
  );
  request.policyEvaluationRequest = cloneCompatibilityFixture(
    validToolPolicyRequest,
  );
  request.suppliedPolicyDecision = cloneCompatibilityFixture(
    validToolAuthorizationDecision,
  );
  request.legacyInputSnapshot.correlationId =
    request.normalizedEvent.correlationId!;
  request.legacyInputSnapshot.sessionReference =
    request.currentFlowState.sessionId;
  request.legacyInputSnapshot.userReference = request.currentFlowState.userId;
  request.legacyInputSnapshot.profileReference =
    request.normalizedEvent.profileId;
  request.auditContext.correlationId = request.normalizedEvent.correlationId!;
  request.auditContext.sessionReference = request.currentFlowState.sessionId;

  const authorization = request.suppliedPolicyDecision.toolAuthorizations[0];
  const proposal = request.policyEvaluationRequest.specialistResponse!
    .proposedToolCalls.find((item) =>
      item.proposalId === authorization.proposalId)!;
  const authority: AuthorityVector = {
    ...cloneCompatibilityFixture(emptyAuthorityVectorFixture),
    toolIds: [authorization.toolId],
    toolAuthorizationIds: [authorization.authorizationId],
    toolSchemaIds: authorization.argumentSchemaId
      ? [authorization.argumentSchemaId]
      : [],
    toolExpectedResultTypes: authorization.expectedResultType
      ? [authorization.expectedResultType]
      : [],
    toolRiskClassifications: [proposal.riskLevel],
    toolIdempotencyKeyReferences: authorization.idempotencyKeyReference
      ? [authorization.idempotencyKeyReference]
      : [],
    toolConsentAuthorizationIds: [...authorization.consentAuthorizationIds],
    consentScopes: ["external_tool_use"],
    confirmationRequired: authorization.confirmationRequired,
    idempotencyRequired: authorization.idempotencyRequired,
  };
  const adapterPlan: AdapterAuthorizationPlan = {
    adapterPlanId: "adapter-plan-task5-tool",
    adapterCategory: "tool_adapter",
    sourceDecisionId: request.suppliedPolicyDecision.decisionId,
    sourceAdjudicationIds: [authorization.adjudicationId],
    sourceFindingIds: [
      "finding-task4-tool",
      "finding-task4-tool-confirmation",
      ...authorization.policyFindingIds,
    ],
    sourcePlanIds: [authorization.authorizationId],
    sourceDirectiveIds: [],
    sourceSeamId: request.legacyInputSnapshot.seamId,
    targetSeamId: request.legacyInputSnapshot.seamId,
    sourceAuthority: cloneCompatibilityFixture(authority),
    authorizedEffects: [{
      effectId: "effect-task5-tool",
      effectType: "tool",
      authority: cloneCompatibilityFixture(authority),
      sourceAuthorizationId: authorization.authorizationId,
      sourcePlanId: authorization.authorizationId,
      payloadReference: authorization.proposalId,
      nonExecutable: true,
    }],
    prohibitedEffects: [],
    narrowingConstraints: [
      "constraint-task4-tool-confirmation",
    ],
    correlationId: request.auditContext.correlationId,
    auditReference: request.auditContext.auditReference,
    nonExecutable: true,
  };
  const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
  decision.adapterPlans = [adapterPlan];
  decision.legacyOutputSnapshot.correlationId =
    request.legacyInputSnapshot.correlationId;
  return { request, decision };
}

export function createFlowAdapterScenario(): {
  request: CompatibilityEvaluationRequest;
  decision: CompatibilityDecisionRecord;
} {
  const scenario = createToolAdapterScenario();
  const flow = scenario.request.suppliedPolicyDecision
    .approvedFlowStateProposal!;
  const authority: AuthorityVector = {
    ...cloneCompatibilityFixture(emptyAuthorityVectorFixture),
    flowIds: [flow.flowId],
    flowVersions: [flow.flowVersion],
    sessionWriteTypes: ["flow_state_update"],
  };
  scenario.decision.adapterPlans = [{
    adapterPlanId: "adapter-plan-task5-flow",
    adapterCategory: "flow_state_adapter",
    sourceDecisionId: scenario.request.suppliedPolicyDecision.decisionId,
    sourceAdjudicationIds: ["adjudication-task4-tool-flow"],
    sourceFindingIds: [...flow.policyFindingIds],
    sourcePlanIds: [flow.approvalId],
    sourceDirectiveIds: [],
    sourceSeamId: scenario.request.legacyInputSnapshot.seamId,
    targetSeamId: scenario.request.legacyInputSnapshot.seamId,
    sourceAuthority: cloneCompatibilityFixture(authority),
    authorizedEffects: [{
      effectId: "effect-task5-flow",
      effectType: "flow_state",
      authority: cloneCompatibilityFixture(authority),
      sourcePlanId: flow.approvalId,
      nonExecutable: true,
    }],
    prohibitedEffects: [],
    narrowingConstraints: ["constraint-task4-tool-correlation"],
    correlationId: scenario.request.auditContext.correlationId,
    auditReference: scenario.request.auditContext.auditReference,
    nonExecutable: true,
  }];
  return scenario;
}

export function createEscalationAdapterScenario(): {
  request: CompatibilityEvaluationRequest;
  decision: CompatibilityDecisionRecord;
  flowCatalogue: FlowCatalogue;
} {
  const catalogueCandidate = cloneCompatibilityFixture(
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
  const flowCatalogue = parseFlowCatalogue(catalogueCandidate);
  const policyRequest = cloneCompatibilityFixture(
    validSpecialistResponsePolicyRequest,
  );
  policyRequest.evaluationId = "evaluation-task5-caregiver";
  policyRequest.activeAuditContext.correlationIds.push(
    policyRequest.evaluationId,
  );
  policyRequest.specialistResponse!.status = "escalated";
  policyRequest.specialistResponse!.flowStateUpdate = undefined;
  policyRequest.specialistResponse!.completionResult = undefined;
  policyRequest.specialistResponse!.riskLevel = "medium";
  policyRequest.specialistResponse!.safetyFlags = [safetyCheckId];
  policyRequest.specialistResponse!.escalation = {
    type: "caregiver",
    reasonCode: safetyCheckId,
    urgency: "routine",
    summary: "Caregiver review is recommended.",
    targetId: "caregiver-1",
    requiresConsent: true,
    recommendedChannel: "pwa",
  };
  policyRequest.consentContext.scopes.push("caregiver_disclosure");
  policyRequest.consentContext.decisions.push({
    scope: "caregiver_disclosure",
    decisionId: "consent-task5-caregiver",
    status: "granted",
    authorizationBasis: "explicit_user_consent",
    purpose: "purpose.caregiver_disclosure",
    decidedAt: policyRequest.requestedAt,
    requiresRevalidation: false,
    permittedChannels: ["pwa"],
  });
  const subjectId = `${policyRequest.specialistResponse!.requestId}.escalation`;
  const policyDecision = cloneCompatibilityFixture(validRejectPolicyDecision);
  Object.assign(policyDecision, {
    decisionId: "decision-task5-caregiver",
    evaluationId: policyRequest.evaluationId,
    stage: policyRequest.stage,
    verdict: "escalate",
    rejectionCode: undefined,
    findings: [{
      findingId: "finding-task5-caregiver",
      policyId: "policy.escalation.allowed",
      category: "escalation",
      severity: "informational",
      outcome: "allow",
      reasonCode: "CAREGIVER_ESCALATION_ALLOWED",
      subjectType: "escalation",
      subjectId,
      sourceReferenceIds: [safetyCheckId],
      auditSummary: "The Flow permits caregiver escalation.",
      createdAt: policyRequest.requestedAt,
      metadata: {},
    }, {
      findingId: "finding-task5-caregiver-consent",
      policyId: "policy.consent.allowed",
      category: "consent",
      severity: "informational",
      outcome: "allow",
      reasonCode: "CAREGIVER_CONSENT_ALLOWED",
      subjectType: "escalation",
      subjectId,
      sourceReferenceIds: ["consent-task5-caregiver"],
      auditSummary: "Caregiver disclosure consent is current.",
      createdAt: policyRequest.requestedAt,
      metadata: {},
    }],
    adjudications: [{
      adjudicationId: "adjudication-task5-caregiver",
      subjectType: "escalation",
      subjectId,
      decision: "approve",
      policyFindingIds: ["finding-task5-caregiver"],
      constraints: [],
      approvedAt: policyRequest.requestedAt,
      metadata: {},
    }],
    consentAuthorizations: [{
      authorizationId: "consent-authorization-task5-caregiver",
      scope: "caregiver_disclosure",
      consentDecisionId: "consent-task5-caregiver",
      authorizationBasis: "explicit_user_consent",
      purpose: "purpose.caregiver_disclosure",
      decision: "allow",
      policyFindingIds: ["finding-task5-caregiver-consent"],
    }],
    escalationAuthorization: {
      authorizationId: "authorization-task5-caregiver",
      subjectId,
      type: "caregiver",
      urgency: "routine",
      targetId: "caregiver-1",
      approvedChannel: "pwa",
      consentAuthorizationIds: [
        "consent-authorization-task5-caregiver",
      ],
      policyFindingIds: ["finding-task5-caregiver"],
      nonExecutable: true,
    },
  });
  Object.assign(policyDecision.auditRecord, {
    auditDecisionId: "audit-task5-caregiver",
    evaluationId: policyRequest.evaluationId,
    decisionId: policyDecision.decisionId,
    policyStage: policyRequest.stage,
    verdict: "escalate",
    specialistRequestId: policyRequest.specialistRequest!.requestId,
    specialistResponseId: policyRequest.specialistResponse!.requestId,
    findingIds: policyDecision.findings.map((item) => item.findingId),
    adjudicationIds: policyDecision.adjudications.map(
      (item) => item.adjudicationId,
    ),
  });

  const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
  request.normalizedEvent = cloneCompatibilityFixture(
    policyRequest.interactionEvent!,
  );
  request.currentFlowState = cloneCompatibilityFixture(
    policyRequest.activeFlowState!,
  );
  request.policyEvaluationRequest = policyRequest;
  request.suppliedPolicyDecision = policyDecision;
  request.legacyInputSnapshot.correlationId =
    request.normalizedEvent.correlationId!;
  request.legacyInputSnapshot.sessionReference =
    request.currentFlowState.sessionId;
  request.legacyInputSnapshot.userReference = request.currentFlowState.userId;
  request.legacyInputSnapshot.profileReference =
    request.normalizedEvent.profileId;
  request.auditContext.correlationId = request.normalizedEvent.correlationId!;
  request.auditContext.sessionReference = request.currentFlowState.sessionId;

  const authorization = policyDecision.escalationAuthorization!;
  const authority: AuthorityVector = {
    ...cloneCompatibilityFixture(emptyAuthorityVectorFixture),
    channels: [authorization.approvedChannel!],
    targets: [authorization.targetId!],
    escalationTypes: [authorization.type],
    escalationTargets: [authorization.targetId!],
    escalationChannels: [authorization.approvedChannel!],
    escalationUrgencies: [authorization.urgency],
    escalationAuthorizationIds: [authorization.authorizationId],
    escalationConsentAuthorizationIds: [
      ...authorization.consentAuthorizationIds,
    ],
    consentScopes: ["caregiver_disclosure"],
  };
  const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
  decision.adapterPlans = [{
    adapterPlanId: "adapter-plan-task5-escalation",
    adapterCategory: "escalation_adapter",
    sourceDecisionId: policyDecision.decisionId,
    sourceAdjudicationIds: ["adjudication-task5-caregiver"],
    sourceFindingIds: [
      "finding-task5-caregiver",
      "finding-task5-caregiver-consent",
    ],
    sourcePlanIds: [authorization.authorizationId],
    sourceDirectiveIds: [],
    sourceSeamId: request.legacyInputSnapshot.seamId,
    targetSeamId: request.legacyInputSnapshot.seamId,
    sourceAuthority: cloneCompatibilityFixture(authority),
    authorizedEffects: [{
      effectId: "effect-task5-escalation",
      effectType: "escalation",
      authority: cloneCompatibilityFixture(authority),
      sourceAuthorizationId: authorization.authorizationId,
      sourcePlanId: authorization.authorizationId,
      nonExecutable: true,
    }],
    prohibitedEffects: [],
    narrowingConstraints: [],
    correlationId: request.auditContext.correlationId,
    auditReference: request.auditContext.auditReference,
    nonExecutable: true,
  }];
  decision.legacyOutputSnapshot.correlationId =
    request.legacyInputSnapshot.correlationId;
  return { request, decision, flowCatalogue };
}

export function createPresentationAdapterScenario(): {
  request: CompatibilityEvaluationRequest;
  decision: CompatibilityDecisionRecord;
} {
  const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
  request.normalizedEvent = cloneCompatibilityFixture(
    validPresentationPolicyRequest.interactionEvent!,
  );
  request.currentFlowState = cloneCompatibilityFixture(
    validPresentationPolicyRequest.activeFlowState!,
  );
  request.policyEvaluationRequest = cloneCompatibilityFixture(
    validPresentationPolicyRequest,
  );
  request.suppliedPolicyDecision = cloneCompatibilityFixture(
    validPresentationApprovalDecision,
  );
  request.legacyInputSnapshot.correlationId =
    request.normalizedEvent.correlationId!;
  request.legacyInputSnapshot.sessionReference =
    request.currentFlowState.sessionId;
  request.legacyInputSnapshot.userReference = request.currentFlowState.userId;
  request.legacyInputSnapshot.profileReference =
    request.normalizedEvent.profileId;
  request.auditContext.correlationId = request.normalizedEvent.correlationId!;
  request.auditContext.sessionReference = request.currentFlowState.sessionId;
  const presentation = request.suppliedPolicyDecision
    .approvedPresentationPlan!;
  const privacyRank = ["public", "personal", "sensitive", "restricted"]
    .indexOf(presentation.approvedPrivacyPolicy.sensitivity);
  const safetyRank = ["routine", "important", "urgent", "immediate"]
    .indexOf(presentation.approvedSafetyPolicy.urgency) +
    (presentation.safetyDecision === "emergency_required" ? 1 : 0);
  const authority: AuthorityVector = {
    ...cloneCompatibilityFixture(emptyAuthorityVectorFixture),
    channels: [presentation.approvedChannel],
    presentationIds: [presentation.presentationId],
    presentationVersions: [presentation.version],
    sceneIds: [presentation.sceneId],
    flowIds: [presentation.flowId],
    flowVersions: [presentation.flowVersion],
    browserEventTypes: [...presentation.approvedUIInstructionIds],
    minimumSafetyRank: safetyRank,
    minimumPrivacyRank: privacyRank,
    acknowledgementRequired:
      presentation.voiceSynchronizationDecision.acknowledgement === "required",
    requiredDisclaimerIds: [
      ...presentation.approvedSafetyPolicy.requiredDisclaimers,
    ],
    prohibitedClaimIds: [
      ...presentation.approvedSafetyPolicy.prohibitedClaims,
    ],
    timeoutPolicyIds:
      presentation.voiceSynchronizationDecision.silenceTimeoutSeconds
        ? ["presentation_silence_timeout"]
        : [],
  };
  const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
  decision.adapterPlans = [{
    adapterPlanId: "adapter-plan-task5-presentation",
    adapterCategory: "presentation_adapter",
    sourceDecisionId: request.suppliedPolicyDecision.decisionId,
    sourceAdjudicationIds: ["adjudication-task4-presentation"],
    sourceFindingIds: [...presentation.policyFindingIds],
    sourcePlanIds: [presentation.presentationId],
    sourceDirectiveIds: [],
    sourceSeamId: request.legacyInputSnapshot.seamId,
    targetSeamId: request.legacyInputSnapshot.seamId,
    sourceAuthority: cloneCompatibilityFixture(authority),
    authorizedEffects: [{
      effectId: "effect-task5-presentation",
      effectType: "presentation",
      authority: cloneCompatibilityFixture(authority),
      sourcePlanId: presentation.presentationId,
      nonExecutable: true,
    }],
    prohibitedEffects: [],
    narrowingConstraints: [],
    correlationId: request.auditContext.correlationId,
    auditReference: request.auditContext.auditReference,
    nonExecutable: true,
  }];
  decision.legacyOutputSnapshot.correlationId =
    request.legacyInputSnapshot.correlationId;
  return { request, decision };
}

export function createBrowserEventAdapterScenario(): {
  request: CompatibilityEvaluationRequest;
  decision: CompatibilityDecisionRecord;
} {
  const scenario = createPresentationAdapterScenario();
  const presentation = scenario.request.suppliedPolicyDecision
    .approvedPresentationPlan!;
  const authority: AuthorityVector = {
    ...cloneCompatibilityFixture(emptyAuthorityVectorFixture),
    channels: [presentation.approvedChannel],
    sceneIds: [presentation.sceneId],
    legacyEffectKinds: ["session_changed_event"],
  };
  scenario.decision.adapterPlans = [{
    ...scenario.decision.adapterPlans[0],
    adapterPlanId: "adapter-plan-task5-browser-event",
    adapterCategory: "channel_adapter",
    targetSeamId: "legacy.voice.session_bridge",
    sourceAuthority: cloneCompatibilityFixture(authority),
    authorizedEffects: [{
      effectId: "effect-task5-browser-event",
      effectType: "browser_event",
      authority: cloneCompatibilityFixture(authority),
      sourcePlanId: presentation.presentationId,
      nonExecutable: true,
    }],
  }];
  return scenario;
}
