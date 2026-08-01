import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADAPTER_CATEGORIES,
  COMPARISON_DIMENSIONS,
  COMPARISON_POLICY_IDS,
  COMPARATOR_IDS,
  COMPATIBILITY_FAILURE_CLASSIFICATIONS,
  COMPATIBILITY_MODES,
  COMPATIBILITY_SAFE_FAILURE_CODE_MAP,
  LEGACY_SEAM_IDS,
  PARITY_CLASSIFICATIONS,
  POLICY_DIFFERENCE_CATEGORIES,
  SUPPORTED_FROZEN_VERSIONS,
  VYVA_COMPARATOR_REGISTRY,
  VYVA_COMPARISON_POLICY_REGISTRY,
  VYVA_LEGACY_SEAM_REGISTRY,
  VYVA_POLICY_DIFFERENCE_AUTHORITY_MATRIX,
  adapterAuthorizationPlanSchema,
  compatibilityDecisionRecordSchema,
  compatibilityModeStateSchema,
  compatibilitySafeFailureSchema,
  legacyInputSnapshotSchema,
  parseAdapterAuthorizationPlan,
  parseCompatibilityDecisionRecord,
  parseCompatibilityEvaluationRequest,
  parseCompatibilityEvidence,
  parseCompatibilityFeatureFlagState,
  parseCompatibilityRollbackPlan,
  parseComparatorRegistry,
  parseComparisonPolicyRegistry,
  parseGoldenCompatibilityCatalogue,
  parseLegacySeamRegistry,
  parsePolicyDifferenceAuthorityMatrix,
  parseShadowComparisonRecord,
  validateAdapterNonBroadening,
  validateCompatibilityDecisionForRequest,
  type AuthorityVector,
} from "./compatibilityBoundary";
import {
  cloneCompatibilityFixture,
  createBrowserEventAdapterScenario,
  createEscalationAdapterScenario,
  createFlowAdapterScenario,
  createPresentationAdapterScenario,
  createPolicyApprovedDifferenceScenario,
  createToolAdapterScenario,
  emptyAuthorityVectorFixture,
  validAuditAdapterPlanFixture,
  validCompatibilityDecisionFixture,
  validCompatibilityEvidenceFixture,
  validCompatibilityRequestFixture,
  validGoldenCatalogueFixture,
  validRollbackPlanFixture,
  validShadowComparisonFixture,
  validShadowFeatureFlagFixture,
} from "./compatibilityBoundaryFixtures";
import { OrchestrationContractError } from "./errors";
import { specialistRiskLevelSchema } from "./specialist";

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("expected contract failure");
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestrationContractError);
    expect((error as OrchestrationContractError).code).toBe(code);
  }
}

function shadowScenario() {
  const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
  request.compatibilityMode = {
    requestedMode: "shadow_compare",
    effectiveMode: "shadow_compare",
    defaultMode: "legacy_only",
    activationEligibility: "eligible",
    featureFlagReference: "flag.compatibility.shadow",
    rolloutReference: "rollout.task5.synthetic",
    reasonCode: "SHADOW_EVALUATION",
    nonExecutable: true,
  };
  const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
  decision.modeState = request.compatibilityMode;
  decision.shadowComparison = cloneCompatibilityFixture(
    validShadowComparisonFixture,
  );
  decision.evidence = [
    cloneCompatibilityFixture(validCompatibilityEvidenceFixture),
  ];
  decision.featureFlagState = cloneCompatibilityFixture(
    validShadowFeatureFlagFixture,
  );
  decision.rollbackPlan = cloneCompatibilityFixture(validRollbackPlanFixture);
  decision.finalClassification = "byte_equivalent";
  decision.observability.responseComparison = "exact_match";
  decision.observability.sessionComparison = "exact_match";
  decision.observability.effectComparison = "exact_match";
  return { request, decision };
}

function validateShadow(request: unknown, decision: unknown) {
  return validateCompatibilityDecisionForRequest(request, decision, {
    goldenCatalogue: validGoldenCatalogueFixture,
    now: "2026-06-01T00:00:00.000Z",
  });
}

describe("Task 5 legacy seam registry", () => {
  it("parses the canonical strict versioned registry", () => {
    const parsed = parseLegacySeamRegistry(VYVA_LEGACY_SEAM_REGISTRY);
    expect(parsed.seams).toHaveLength(6);
    expect(parsed.nonExecutable).toBe(true);
  });

  it("allows sourcePathReference only on the dedicated seam descriptor", () => {
    const parsed = parseLegacySeamRegistry(VYVA_LEGACY_SEAM_REGISTRY);
    expect(parsed.seams.every((seam) =>
      seam.sourcePathReference.startsWith("src/"))).toBe(true);
  });

  it("contains every required seam exactly once", () => {
    const expectedSeams = [
      "legacy.voice.agent_contract",
      "legacy.voice.session_bridge",
      "legacy.voice.session_state",
      "legacy.voice.engine",
      "legacy.triage.current_protocol",
      "legacy.triage.route_outcome",
    ];
    expect(VYVA_LEGACY_SEAM_REGISTRY.seams.map((item) => item.seamId).sort())
      .toEqual([...expectedSeams].sort());
    expect(LEGACY_SEAM_IDS).toEqual(expectedSeams);
    expect(new Set(VYVA_LEGACY_SEAM_REGISTRY.seams.map((item) =>
      `${item.seamId}@${item.seamVersion}`)).size).toBe(6);
  });

  it("covers the inspected legacy voice and triage vocabulary", () => {
    const identifiers = new Set(VYVA_LEGACY_SEAM_REGISTRY.seams.flatMap(
      (item) => item.knownLegacyIdentifiers,
    ));
    [
      "VoiceAgentDomain", "VoiceAgentContract", "VoiceContextValidation",
      "VoiceSessionChangedDetail", "VoiceTriageTouchAnswerDetail",
      "readVoiceSessionId", "writeVoiceSessionId", "ensureVoiceSessionId",
      "clearVoiceSessionId", "emitVoiceTriageTouchAnswer",
      "deriveVoiceSessionPhase", "voiceSessionPhaseLabel", "speak",
      "stopSpeaking", "TRIAGE_PROTOCOLS", "evaluateTriageRules",
      "TriageOutcomeTelemetry", "buildFallbackTriageReport",
      "evaluateTriageSafetyFloor", "primaryEscalationSource",
    ].forEach((identifier) => expect(identifiers.has(identifier)).toBe(true));
  });

  it("rejects duplicate seam IDs and versions", () => {
    const registry = cloneCompatibilityFixture(VYVA_LEGACY_SEAM_REGISTRY);
    registry.seams.push(cloneCompatibilityFixture(registry.seams[0]));
    expectCode(
      () => parseLegacySeamRegistry(registry),
      "COMPATIBILITY_SEAM_REGISTRY_INVALID",
    );
  });

  it("rejects an incomplete one-seam V1 registry", () => {
    const registry = cloneCompatibilityFixture(VYVA_LEGACY_SEAM_REGISTRY);
    registry.seams = [registry.seams[0]];
    expectCode(
      () => parseLegacySeamRegistry(registry),
      "COMPATIBILITY_SEAM_REGISTRY_INVALID",
    );
  });

  it.each([
    "../src/runtime.ts",
    "C:/src/runtime.ts",
    "server/runtime.ts",
    "src/runtime.js",
  ])("rejects invalid inert source path %s", (sourcePathReference) => {
    const registry = cloneCompatibilityFixture(VYVA_LEGACY_SEAM_REGISTRY);
    registry.seams[0].sourcePathReference = sourcePathReference;
    expectCode(
      () => parseLegacySeamRegistry(registry),
      "COMPATIBILITY_SEAM_REGISTRY_INVALID",
    );
  });

  it.each(["callback", "providerClient", "runtimeObject", "execute"])(
    "rejects runtime field %s",
    (field) => {
      const registry = cloneCompatibilityFixture(
        VYVA_LEGACY_SEAM_REGISTRY,
      ) as unknown as Record<string, unknown>;
      (registry.seams as Record<string, unknown>[])[0][field] = "forbidden";
      expectCode(
        () => parseLegacySeamRegistry(registry),
        "COMPATIBILITY_AUDIT_INVALID",
      );
    },
  );
});

describe("Task 5 request, version and mode contracts", () => {
  it("validates a legacy-only façade request through frozen Tasks 1-4", () => {
    const parsed = parseCompatibilityEvaluationRequest(
      validCompatibilityRequestFixture,
    );
    expect(parsed.compatibilityMode.effectiveMode).toBe("legacy_only");
    expect(parsed.suppliedPolicyDecision.decisionId).toBe(
      validCompatibilityRequestFixture.suppliedPolicyDecision.decisionId,
    );
  });

  it("rejects unknown request fields", () => {
    expectCode(
      () => parseCompatibilityEvaluationRequest({
        ...validCompatibilityRequestFixture,
        invokeOrchestrator: true,
      }),
      "COMPATIBILITY_REQUEST_INVALID",
    );
  });

  it.each([
    "interactionEventVersion", "flowStateVersion", "specialistContractVersion",
    "flowCatalogueVersion", "presentationRegistryVersion",
    "orchestratorPolicyVersion", "compatibilitySchemaVersion",
  ] as const)("rejects incompatible %s", (field) => {
    const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
    request.contractVersions[field] = "9.9.9";
    expectCode(
      () => parseCompatibilityEvaluationRequest(request),
      "COMPATIBILITY_VERSION_INVALID",
    );
  });

  it.each([
    "legacy_only", "shadow_compare",
  ] as const)("models current eligible mode %s", (mode) => {
    const parsed = compatibilityModeStateSchema.parse({
      requestedMode: mode,
      effectiveMode: mode,
      defaultMode: "legacy_only",
      activationEligibility: "eligible",
      reasonCode: "CURRENT_MODE",
      nonExecutable: true,
    });
    expect(parsed.effectiveMode).toBe(mode);
  });

  it.each([
    "candidate_delivery", "authoritative",
  ] as const)("models future mode %s without activating it", (requestedMode) => {
    const parsed = compatibilityModeStateSchema.parse({
      requestedMode,
      effectiveMode: "legacy_only",
      defaultMode: "legacy_only",
      activationEligibility: "future_contract_required",
      reasonCode: "FUTURE_AUTHORITY_REQUIRED",
      nonExecutable: true,
    });
    expect(parsed.effectiveMode).toBe("legacy_only");
  });

  it("rejects silent mode promotion", () => {
    expect(compatibilityModeStateSchema.safeParse({
      requestedMode: "legacy_only",
      effectiveMode: "shadow_compare",
      defaultMode: "legacy_only",
      activationEligibility: "eligible",
      reasonCode: "SILENT_PROMOTION",
      nonExecutable: true,
    }).success).toBe(false);
  });

  it("rejects active authoritative mode", () => {
    expect(compatibilityModeStateSchema.safeParse({
      requestedMode: "authoritative",
      effectiveMode: "authoritative",
      defaultMode: "legacy_only",
      activationEligibility: "eligible",
      reasonCode: "FORBIDDEN",
      nonExecutable: true,
    }).success).toBe(false);
  });

  it("rejects stale seam correlation", () => {
    const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
    request.legacyInputSnapshot.seamVersion = "2.0.0";
    expectCode(
      () => parseCompatibilityEvaluationRequest(request),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it.each([
    ["correlationId", "wrong-correlation"],
    ["sessionReference", "wrong-session"],
  ] as const)("rejects incompatible legacy %s", (field, value) => {
    const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
    request.legacyInputSnapshot[field] = value;
    expectCode(
      () => parseCompatibilityEvaluationRequest(request),
      "COMPATIBILITY_CORRELATION_INVALID",
    );
  });

  it.each([
    ["transcript", "raw user words"],
    ["audio", "raw bytes"],
    ["providerPayload", "private provider response"],
    ["secret", "credential material"],
    ["hiddenReasoning", "private chain"],
  ])("rejects unsafe legacy input metadata %s", (key, value) => {
    const input = cloneCompatibilityFixture(
      validCompatibilityRequestFixture.legacyInputSnapshot,
    ) as unknown as Record<string, unknown>;
    input.safeMetadata = { [key]: value };
    expect(legacyInputSnapshotSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a policy-approved difference without exact Task 4 authority", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    const comparison = cloneCompatibilityFixture(validShadowComparisonFixture);
    comparison.responseComparison.classification =
      "approved_policy_difference";
    comparison.responseComparison.comparatorId =
      "comparator.policy_difference";
    comparison.responseComparison.comparatorEvidenceReferences = [
      "evidence.policy.difference",
    ];
    comparison.responseComparison.differenceCategory =
      "LEGACY_FORMAT_ONLY";
    comparison.responseComparison.policyFindingIds = [
      "finding.not.in.task4",
    ];
    comparison.expectedDifferenceReferences = ["LEGACY_FORMAT_ONLY"];
    comparison.finalClassification = "policy_approved_difference";
    decision.shadowComparison = comparison;
    decision.finalClassification = "policy_approved_difference";
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });
});

describe("Task 5 adapter authorization and non-broadening", () => {
  it("lists every adapter category exactly once", () => {
    expect(ADAPTER_CATEGORIES).toEqual([
      "legacy_response_adapter",
      "legacy_session_adapter",
      "channel_adapter",
      "presentation_adapter",
      "tool_adapter",
      "memory_adapter",
      "flow_state_adapter",
      "audit_adapter",
      "escalation_adapter",
    ]);
    expect(new Set(ADAPTER_CATEGORIES).size).toBe(9);
  });

  it("parses a non-executable adapter plan", () => {
    expect(parseAdapterAuthorizationPlan(validAuditAdapterPlanFixture)
      .nonExecutable).toBe(true);
  });

  const allowedArrayCases: Array<[keyof AuthorityVector, unknown]> = [
    ["channels", "telephone"],
    ["targets", "target-new"],
    ["toolIds", "tool.new"],
    ["toolAuthorizationIds", "authorization-new"],
    ["toolSchemaIds", "schema.new"],
    ["toolExpectedResultTypes", "result.new"],
    ["toolRiskClassifications", "high"],
    ["toolIdempotencyKeyReferences", "idempotency-new"],
    ["toolConsentAuthorizationIds", "consent-new"],
    ["toolArgumentDigestIds", "argument-digest-new"],
    ["memoryAuthorizationIds", "memory-authorization-new"],
    ["memorySubjectIds", "memory-subject-new"],
    ["memoryCategories", "memory.new"],
    ["memoryTargets", "postgres"],
    ["retentionModes", "long_term"],
    ["escalationTypes", "caregiver"],
    ["escalationTargets", "caregiver-new"],
    ["escalationChannels", "telephone"],
    ["escalationUrgencies", "urgent"],
    ["escalationAuthorizationIds", "escalation-authorization-new"],
    ["escalationConsentAuthorizationIds", "escalation-consent-new"],
    ["escalationDuplicateReferences", "escalation-duplicate-new"],
    ["presentationIds", "presentation.new"],
    ["presentationVersions", "2.0.0"],
    ["sceneIds", "scene.new"],
    ["flowIds", "flow.new"],
    ["flowVersions", "2.0.0"],
    ["responseFactIds", "fact-new"],
    ["medicationInstructionIds", "medication-new"],
    ["consentScopes", "scope.new"],
    ["sessionWriteTypes", "write.new"],
    ["browserEventTypes", "event.new"],
    ["legacyEffectKinds", "session_changed_event"],
    ["scheduleIds", "schedule-new"],
    ["retryPolicies", "retry.new"],
  ];

  it.each(allowedArrayCases)(
    "rejects broadening protected authority dimension %s",
    (field, value) => {
      const source = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
      const proposed = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
      (proposed[field] as unknown[]) = [value];
      expectCode(
        () => validateAdapterNonBroadening(source, proposed),
        "COMPATIBILITY_ADAPTER_BROADENING",
      );
    },
  );

  it.each([
    ["minimumSafetyRank", 1],
    ["minimumPrivacyRank", 1],
  ] as const)("rejects weakening %s", (field, value) => {
    const source = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
    const proposed = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
    proposed[field] = value;
    expectCode(
      () => validateAdapterNonBroadening(source, proposed),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it.each([
    "confirmationRequired", "acknowledgementRequired", "auditRequired",
    "idempotencyRequired",
  ] as const)("rejects weakening required boolean %s", (field) => {
    const source = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
    const proposed = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
    source[field] = true;
    proposed[field] = false;
    expectCode(
      () => validateAdapterNonBroadening(source, proposed),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it.each([
    "requiredDisclaimerIds", "prohibitedClaimIds", "timeoutPolicyIds",
    "failurePolicyIds",
  ] as const)("rejects removal of required constraint %s", (field) => {
    const source = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
    const proposed = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
    source[field] = ["constraint.required"];
    proposed[field] = [];
    expectCode(
      () => validateAdapterNonBroadening(source, proposed),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it("allows independent strengthening without compensation", () => {
    const source = cloneCompatibilityFixture(emptyAuthorityVectorFixture);
    source.channels = ["pwa", "telephone"];
    source.requiredDisclaimerIds = ["disclaimer.base"];
    const proposed = cloneCompatibilityFixture(source);
    proposed.channels = ["pwa"];
    proposed.minimumSafetyRank = 3;
    proposed.confirmationRequired = true;
    proposed.requiredDisclaimerIds.push("disclaimer.extra");
    expect(() => validateAdapterNonBroadening(source, proposed)).not.toThrow();
  });

  it("rejects provider authority and execution authority at schema level", () => {
    for (const field of ["providerAuthority", "executionAuthority"] as const) {
      const plan = cloneCompatibilityFixture(validAuditAdapterPlanFixture);
      (plan.sourceAuthority as Record<string, unknown>)[field] = true;
      expect(adapterAuthorizationPlanSchema.safeParse(plan).success).toBe(false);
    }
  });

  it("validates an audit effect against the supplied Task 4 decision", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    decision.adapterPlans = [
      cloneCompatibilityFixture(validAuditAdapterPlanFixture),
    ];
    expect(validateCompatibilityDecisionForRequest(
      validCompatibilityRequestFixture,
      decision,
    ).adapterPlans).toHaveLength(1);
  });

  it("rejects source authority not present in the supplied Task 4 decision", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    const plan = cloneCompatibilityFixture(validAuditAdapterPlanFixture);
    plan.sourceAuthority.channels = ["pwa"];
    decision.adapterPlans = [plan];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it("rejects dangling Task 4 finding references", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    const plan = cloneCompatibilityFixture(validAuditAdapterPlanFixture);
    plan.sourceFindingIds = ["finding-does-not-exist"];
    decision.adapterPlans = [plan];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it("rejects a prohibited effect included as authorized", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    const plan = cloneCompatibilityFixture(validAuditAdapterPlanFixture);
    plan.prohibitedEffects = ["audit"];
    decision.adapterPlans = [plan];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it("rejects a session effect without Task 4 Flow-update authority", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    const plan = cloneCompatibilityFixture(validAuditAdapterPlanFixture);
    plan.adapterCategory = "legacy_session_adapter";
    plan.authorizedEffects[0].effectType = "session_write";
    decision.adapterPlans = [plan];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it("accepts a Tool effect exactly matching its Task 4 authorization", () => {
    const { request, decision } = createToolAdapterScenario();
    const parsed = validateCompatibilityDecisionForRequest(request, decision);
    expect(parsed.adapterPlans[0].authorizedEffects[0].effectType).toBe("tool");
    expect(parsed.adapterPlans[0].sourceAuthority.toolRiskClassifications)
      .toEqual(["low"]);
  });

  it("enumerates the five frozen Tool risk values independently", () => {
    const expectedRiskValues = [
      "none", "low", "medium", "high", "emergency",
    ];
    expect(specialistRiskLevelSchema.options).toEqual(expectedRiskValues);
  });

  it("accepts an empty Tool adapter only when exact risk is preserved", () => {
    const { request, decision } = createToolAdapterScenario();
    decision.adapterPlans[0].authorizedEffects = [];
    expect(validateCompatibilityDecisionForRequest(request, decision)
      .adapterPlans[0].sourceAuthority.toolRiskClassifications)
      .toEqual(["low"]);
  });

  it("rejects an empty Tool adapter that omits risk", () => {
    const { request, decision } = createToolAdapterScenario();
    decision.adapterPlans[0].authorizedEffects = [];
    decision.adapterPlans[0].sourceAuthority.toolRiskClassifications = [];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it("rejects Tool adapter and effect risk omission", () => {
    const { request, decision } = createToolAdapterScenario();
    decision.adapterPlans[0].sourceAuthority.toolRiskClassifications = [];
    decision.adapterPlans[0].authorizedEffects[0].authority
      .toolRiskClassifications = [];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it.each([
    ["toolSchemaIds", ["schema.tool.wrong"]],
    ["confirmationRequired", false],
    ["idempotencyRequired", false],
    ["toolIdempotencyKeyReferences", ["idempotency.wrong"]],
    ["toolConsentAuthorizationIds", ["consent.unrelated"]],
    ["toolRiskClassifications", ["high"]],
  ] as const)("rejects Tool effect authority drift in %s", (field, value) => {
    const { request, decision } = createToolAdapterScenario();
    const effectAuthority = decision.adapterPlans[0].authorizedEffects[0]
      .authority as unknown as Record<string, unknown>;
    effectAuthority[field] = value;
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });

  it("rejects adapter source authority that changes Tool risk", () => {
    const { request, decision } = createToolAdapterScenario();
    decision.adapterPlans[0].sourceAuthority.toolRiskClassifications = [
      "high",
    ];
    decision.adapterPlans[0].authorizedEffects[0].authority
      .toolRiskClassifications = ["high"];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it.each(["none", "high"] as const)(
    "rejects non-identical Tool adapter risk %s",
    (riskLevel) => {
      const { request, decision } = createToolAdapterScenario();
      decision.adapterPlans[0].sourceAuthority.toolRiskClassifications = [
        riskLevel,
      ];
      decision.adapterPlans[0].authorizedEffects[0].authority
        .toolRiskClassifications = [riskLevel];
      expectCode(
        () => validateCompatibilityDecisionForRequest(request, decision),
        "COMPATIBILITY_ADAPTER_BROADENING",
      );
    },
  );

  it("rejects a Tool risk copied from another proposal", () => {
    const { request, decision } = createToolAdapterScenario();
    const proposal = request.policyEvaluationRequest.specialistResponse!
      .proposedToolCalls[0];
    request.policyEvaluationRequest.specialistResponse!.proposedToolCalls.push({
      ...cloneCompatibilityFixture(proposal),
      proposalId: "proposal-task5-other-risk",
      riskLevel: "high",
    });
    decision.adapterPlans[0].sourceAuthority.toolRiskClassifications = [
      "high",
    ];
    decision.adapterPlans[0].authorizedEffects[0].authority
      .toolRiskClassifications = ["high"];
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });

  it("rejects a Tool risk copied from another request", () => {
    const { request, decision } = createToolAdapterScenario();
    const otherRequest = createToolAdapterScenario().request;
    otherRequest.policyEvaluationRequest.specialistResponse!
      .proposedToolCalls[0].riskLevel = "none";
    const otherRisk = otherRequest.policyEvaluationRequest.specialistResponse!
      .proposedToolCalls[0].riskLevel;
    decision.adapterPlans[0].sourceAuthority.toolRiskClassifications = [
      otherRisk,
    ];
    decision.adapterPlans[0].authorizedEffects[0].authority
      .toolRiskClassifications = [otherRisk];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it("rejects exact risk attached to the wrong Tool authorization", () => {
    const { request, decision } = createToolAdapterScenario();
    decision.adapterPlans[0].sourceAuthority.toolAuthorizationIds = [
      "authorization-tool-other",
    ];
    decision.adapterPlans[0].authorizedEffects[0].authority
      .toolAuthorizationIds = ["authorization-tool-other"];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_ADAPTER_BROADENING",
    );
  });

  it("rejects unsupported Tool risk before semantic authorization", () => {
    const { decision } = createToolAdapterScenario();
    const plan = decision.adapterPlans[0] as unknown as {
      sourceAuthority: { toolRiskClassifications: string[] };
    };
    plan.sourceAuthority.toolRiskClassifications = ["unbounded"];
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_DECISION_INVALID",
    );
  });

  it.each(["reject", "defer"] as const)(
    "rejects Tool authority from a %s adjudication",
    (adjudicationDecision) => {
      const { request, decision } = createToolAdapterScenario();
      request.suppliedPolicyDecision.adjudications[0].decision =
        adjudicationDecision;
      expect(() => validateCompatibilityDecisionForRequest(request, decision))
        .toThrow(OrchestrationContractError);
    },
  );

  it("rejects Tool authority from an unrelated adjudication", () => {
    const { request, decision } = createToolAdapterScenario();
    decision.adapterPlans[0].sourceAdjudicationIds = [
      "adjudication-task4-tool-response",
    ];
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });

  it("accepts an exact Task 4 Flow ID and version", () => {
    const { request, decision } = createFlowAdapterScenario();
    expect(validateCompatibilityDecisionForRequest(request, decision)
      .adapterPlans[0].sourceAuthority.flowVersions).toEqual(["1.0.0"]);
  });

  it("rejects an adapter-added Flow version", () => {
    const { request, decision } = createFlowAdapterScenario();
    decision.adapterPlans[0].sourceAuthority.flowVersions.push("2.0.0");
    decision.adapterPlans[0].authorizedEffects[0].authority.flowVersions
      .push("2.0.0");
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });

  it("accepts an escalation effect with its exact Task 4 channel and target", () => {
    const { request, decision, flowCatalogue } =
      createEscalationAdapterScenario();
    expect(validateCompatibilityDecisionForRequest(request, decision, {
      flowCatalogue,
    }).adapterPlans[0].authorizedEffects[0].effectType).toBe("escalation");
  });

  it("rejects an escalation effect using the wrong channel", () => {
    const { request, decision, flowCatalogue } =
      createEscalationAdapterScenario();
    decision.adapterPlans[0].sourceAuthority.channels = ["telephone"];
    decision.adapterPlans[0].sourceAuthority.escalationChannels = [
      "telephone",
    ];
    decision.adapterPlans[0].authorizedEffects[0].authority.channels = [
      "telephone",
    ];
    decision.adapterPlans[0].authorizedEffects[0].authority
      .escalationChannels = ["telephone"];
    expect(() => validateCompatibilityDecisionForRequest(request, decision, {
      flowCatalogue,
    })).toThrow(OrchestrationContractError);
  });

  it("accepts exact Presentation safety and privacy authority", () => {
    const { request, decision } = createPresentationAdapterScenario();
    expect(validateCompatibilityDecisionForRequest(request, decision)
      .adapterPlans[0].authorizedEffects[0].effectType).toBe("presentation");
  });

  it("rejects weakening actual Presentation privacy authority", () => {
    const { request, decision } = createPresentationAdapterScenario();
    decision.adapterPlans[0].sourceAuthority.minimumPrivacyRank = 0;
    decision.adapterPlans[0].authorizedEffects[0].authority
      .minimumPrivacyRank = 0;
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });

  it("accepts a browser event permitted by the selected seam", () => {
    const { request, decision } = createBrowserEventAdapterScenario();
    expect(validateCompatibilityDecisionForRequest(request, decision)
      .adapterPlans[0].authorizedEffects[0].authority.legacyEffectKinds)
      .toEqual(["session_changed_event"]);
  });

  it("rejects cross-seam browser event injection", () => {
    const { request, decision } = createBrowserEventAdapterScenario();
    decision.adapterPlans[0].targetSeamId = "legacy.voice.agent_contract";
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });
});

describe("Task 5 shadow comparison and parity", () => {
  it("accepts a deterministic exact comparison", () => {
    expect(parseShadowComparisonRecord(validShadowComparisonFixture)
      .finalClassification).toBe("byte_equivalent");
  });

  it("supports every comparison dimension and parity classification", () => {
    expect(COMPARISON_DIMENSIONS).toEqual([
      "exact_match", "normalized_match", "semantic_match",
      "approved_policy_difference", "legacy_safer", "canonical_safer",
      "incompatible", "missing_legacy_evidence",
      "missing_canonical_evidence", "not_comparable",
    ]);
    expect(PARITY_CLASSIFICATIONS).toEqual([
      "byte_equivalent", "semantically_equivalent",
      "policy_approved_difference", "safe_fallback_required",
      "incompatible", "insufficient_evidence",
    ]);
    expect(COMPATIBILITY_MODES).toEqual([
      "legacy_only", "shadow_compare", "candidate_delivery", "authoritative",
    ]);
  });

  it("accepts shadow validation without changing output or session", () => {
    const { request, decision } = shadowScenario();
    expect(validateShadow(request, decision)
      .finalClassification).toBe("byte_equivalent");
  });

  it("requires a comparison in shadow mode", () => {
    const { request, decision } = shadowScenario();
    decision.shadowComparison = undefined;
    expectCode(
      () => validateShadow(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("rejects adapter delivery in shadow mode", () => {
    const { request, decision } = shadowScenario();
    decision.adapterPlans = [
      cloneCompatibilityFixture(validAuditAdapterPlanFixture),
    ];
    expectCode(
      () => validateShadow(request, decision),
      "COMPATIBILITY_MODE_INVALID",
    );
  });

  it.each([
    "responsePreserved", "sessionPreserved", "effectsPreserved",
  ] as const)("rejects shadow delivery that does not preserve %s", (field) => {
    const { request, decision } = shadowScenario();
    (decision.legacyDisposition[field] as boolean) = false;
    expectCode(
      () => validateShadow(request, decision),
      "COMPATIBILITY_DECISION_INVALID",
    );
  });

  it("records observed legacy session and browser effects without executing them", () => {
    const { request, decision } = shadowScenario();
    decision.legacyOutputSnapshot.sessionWriteProposals = [
      "legacy-session-write-task5",
    ];
    decision.legacyOutputSnapshot.browserEventProposals = [
      "legacy-browser-event-task5",
    ];
    expect(validateShadow(request, decision)
      .legacyDisposition.deliveryAuthority).toBe("legacy_handler");
  });

  it("rejects semantic equivalence without comparator evidence", () => {
    const comparison = cloneCompatibilityFixture(validShadowComparisonFixture);
    comparison.responseComparison.classification = "semantic_match";
    comparison.responseComparison.legacyDigest = undefined;
    comparison.responseComparison.canonicalDigest = undefined;
    comparison.responseComparison.comparatorId =
      "comparator.semantic_fixture";
    comparison.finalClassification = "semantically_equivalent";
    expectCode(
      () => parseShadowComparisonRecord(comparison),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("accepts semantic equivalence with deterministic comparator evidence", () => {
    const comparison = cloneCompatibilityFixture(validShadowComparisonFixture);
    comparison.responseComparison.classification = "semantic_match";
    comparison.responseComparison.comparatorId =
      "comparator.semantic_fixture";
    comparison.responseComparison.comparatorEvidenceReferences = [
      "comparator-evidence-task5",
    ];
    comparison.finalClassification = "semantically_equivalent";
    expect(parseShadowComparisonRecord(comparison).finalClassification)
      .toBe("semantically_equivalent");
  });

  it.each(["safetyDowngrade", "consentDowngrade"] as const)(
    "rejects %s as semantic equivalence",
    (field) => {
      const comparison = cloneCompatibilityFixture(
        validShadowComparisonFixture,
      );
      comparison.responseComparison.classification = "semantic_match";
      comparison.responseComparison.comparatorId =
        "comparator.semantic_fixture";
      comparison.responseComparison.comparatorEvidenceReferences = [
        "comparator-evidence-task5",
      ];
      comparison.responseComparison[field] = true;
      comparison.finalClassification = "semantically_equivalent";
      expectCode(
        () => parseShadowComparisonRecord(comparison),
        "COMPATIBILITY_COMPARISON_INVALID",
      );
    },
  );

  it("requires a finding or directive for policy-approved difference", () => {
    const comparison = cloneCompatibilityFixture(validShadowComparisonFixture);
    comparison.responseComparison.classification =
      "approved_policy_difference";
    comparison.responseComparison.comparatorId =
      "comparator.policy_difference";
    comparison.responseComparison.differenceCategory =
      "LEGACY_FORMAT_ONLY";
    comparison.finalClassification = "policy_approved_difference";
    expectCode(
      () => parseShadowComparisonRecord(comparison),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it.each([
    "safe_fallback_required", "incompatible", "insufficient_evidence",
  ] as const)("models non-promoting parity %s", (finalClassification) => {
    const comparison = cloneCompatibilityFixture(validShadowComparisonFixture);
    comparison.responseComparison.classification =
      finalClassification === "incompatible"
        ? "incompatible"
        : finalClassification === "safe_fallback_required"
          ? "legacy_safer"
          : "missing_canonical_evidence";
    comparison.responseComparison.comparatorId =
      "comparator.semantic_fixture";
    comparison.finalClassification = finalClassification;
    expect(parseShadowComparisonRecord(comparison).finalClassification)
      .toBe(finalClassification);
  });

  it("rejects missing comparison audit", () => {
    const comparison = cloneCompatibilityFixture(
      validShadowComparisonFixture,
    ) as unknown as Record<string, unknown>;
    delete comparison.auditReference;
    expectCode(
      () => parseShadowComparisonRecord(comparison),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });
});

describe("Task 5 closed comparator, policy, digest and parity authority", () => {
  const expectedComparatorPairs = [
    "comparator.exact_digest@1.0.0",
    "comparator.normalized_contract@1.0.0",
    "comparator.semantic_fixture@1.0.0",
    "comparator.policy_difference@1.0.0",
  ];

  it("resolves the independently enumerated comparator registry", () => {
    const parsed = parseComparatorRegistry(VYVA_COMPARATOR_REGISTRY);
    expect(parsed.comparators.map((item) =>
      `${item.comparatorId}@${item.comparatorVersion}`).sort())
      .toEqual([...expectedComparatorPairs].sort());
    expect(COMPARATOR_IDS).toEqual([
      "comparator.exact_digest",
      "comparator.normalized_contract",
      "comparator.semantic_fixture",
      "comparator.policy_difference",
    ]);
  });

  it("rejects comparator version 99.0.0", () => {
    const registry = cloneCompatibilityFixture(
      VYVA_COMPARATOR_REGISTRY,
    ) as unknown as { comparators: Array<Record<string, unknown>> };
    registry.comparators[0].comparatorVersion = "99.0.0";
    expectCode(
      () => parseComparatorRegistry(registry),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("resolves the independently enumerated comparison-policy registry", () => {
    const parsed = parseComparisonPolicyRegistry(
      VYVA_COMPARISON_POLICY_REGISTRY,
    );
    expect(parsed.policies.map((item) =>
      `${item.comparisonPolicyId}@${item.comparisonPolicyVersion}`))
      .toEqual(["policy.compatibility.default@1.0.0"]);
    expect(COMPARISON_POLICY_IDS).toEqual(["policy.compatibility.default"]);
  });

  const expectedDifferenceAuthority = [{
    differenceCategory: "LEGACY_FORMAT_ONLY",
    dimension: "response",
    expectedTask4SubjectType: "response_guidance",
    expectedPolicyId: "policy.response_composition.allowed",
    expectedFindingOutcome: "allow",
    expectedResult: true,
  }] as const;

  it("resolves the literal test-owned policy-difference authority table", () => {
    const parsed = parsePolicyDifferenceAuthorityMatrix(
      VYVA_POLICY_DIFFERENCE_AUTHORITY_MATRIX,
    );
    expect(POLICY_DIFFERENCE_CATEGORIES).toEqual(["LEGACY_FORMAT_ONLY"]);
    expect(parsed.entries.map((entry) => ({
      differenceCategory: entry.differenceCategory,
      dimension: entry.permittedDimensions[0],
      expectedTask4SubjectType: entry.requiredTask4SubjectTypes[0],
      expectedPolicyId: entry.permittedTask4PolicyIds[0],
      expectedFindingOutcome: entry.permittedFindingOutcomes[0],
      expectedResult: true,
    }))).toEqual(expectedDifferenceAuthority);
  });

  it("rejects an altered policy-difference authority matrix", () => {
    const matrix = cloneCompatibilityFixture(
      VYVA_POLICY_DIFFERENCE_AUTHORITY_MATRIX,
    ) as unknown as {
      entries: Array<{ permittedDimensions: string[] }>;
    };
    matrix.entries[0].permittedDimensions = ["session"];
    expectCode(
      () => parsePolicyDifferenceAuthorityMatrix(matrix),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("accepts exact Task 4 authority for the supported policy difference", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    const parsed = validateCompatibilityDecisionForRequest(request, decision);
    expect(parsed.shadowComparison?.responseComparison).toMatchObject({
      dimension: "response",
      classification: "approved_policy_difference",
      differenceCategory: "LEGACY_FORMAT_ONLY",
      policyFindingIds: ["finding-task4-response-guidance"],
    });
  });

  it("binds valid policy-difference evidence to the observed response", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    const parsed = validateCompatibilityDecisionForRequest(request, decision);
    expect(parsed.shadowComparison?.responseEvidence).toMatchObject({
      compatibilityRequestId: request.compatibilityRequestId,
      task4DecisionId: request.suppliedPolicyDecision.decisionId,
      legacyResponseReference:
        decision.legacyOutputSnapshot.responseReference,
      canonicalDigest:
        parsed.shadowComparison.responseComparison.canonicalDigest,
      requiredDisclaimers: ["disclaimer.task5.synthetic"],
      prohibitedClaims: ["Do not diagnose."],
      safetyInvariantPassed: true,
      consentInvariantPassed: true,
      privacyInvariantPassed: true,
      emergencyAuthorityPreserved: true,
    });
  });

  it("rejects legacy-output and response-comparison digest drift", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    decision.legacyOutputSnapshot.responseDigest =
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("rejects response-comparison legacy digest drift", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    decision.shadowComparison!.responseComparison.legacyDigest!.value =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it.each([
    ["algorithm", "md5"],
    ["canonicalizationVersion", "2.0.0"],
  ] as const)("rejects response digest %s mismatch", (field, value) => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    const digest = decision.shadowComparison!.responseComparison
      .legacyDigest as unknown as Record<string, unknown>;
    digest[field] = value;
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });

  it("rejects a missing legacy-output response digest", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    decision.legacyOutputSnapshot.responseDigest = undefined;
    decision.legacyOutputSnapshot.responseDigestProvenance = undefined;
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("rejects a response digest without output-side provenance", () => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.legacyOutputSnapshot.responseDigestProvenance = undefined;
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_DECISION_INVALID",
    );
  });

  it("rejects output-side provenance without a response digest", () => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.legacyOutputSnapshot.responseDigest = undefined;
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_DECISION_INVALID",
    );
  });

  it.each([
    ["algorithm", "sha512"],
    ["canonicalizationVersion", "2.0.0"],
  ] as const)("rejects unsupported output digest provenance %s", (
    field,
    value,
  ) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    const provenance = decision.legacyOutputSnapshot
      .responseDigestProvenance as unknown as Record<string, unknown>;
    provenance[field] = value;
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_DECISION_INVALID",
    );
  });

  it("correlates response comparison to exact output digest provenance", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    const parsed = validateCompatibilityDecisionForRequest(request, decision);
    expect(parsed.legacyOutputSnapshot.responseDigestProvenance).toEqual({
      algorithm:
        parsed.shadowComparison!.responseComparison.legacyDigest!.algorithm,
      canonicalizationVersion:
        parsed.shadowComparison!.responseComparison.legacyDigest!
          .canonicalizationVersion,
      nonExecutable: true,
    });
  });

  it("rejects response evidence from another compatibility request", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    decision.shadowComparison!.responseEvidence.compatibilityRequestId =
      "compatibility-request-other";
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("rejects a canonical response digest from unrelated evidence", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    decision.shadowComparison!.responseEvidence.canonicalDigest.value =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("rejects omitted response disclaimer evidence", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    decision.shadowComparison!.responseEvidence.requiredDisclaimers = [];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("rejects weakened prohibited-claim evidence", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    decision.shadowComparison!.responseEvidence.prohibitedClaims = [];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it.each([
    "session", "safety", "routing", "escalation", "presentation", "effects",
  ] as const)("rejects LEGACY_FORMAT_ONLY on prohibited %s dimension", (
    dimension,
  ) => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    const comparison = decision.shadowComparison!;
    comparison.responseComparison = cloneCompatibilityFixture(
      validShadowComparisonFixture.responseComparison,
    );
    const field = ({
      session: "sessionComparison",
      safety: "safetyComparison",
      routing: "routingComparison",
      escalation: "escalationComparison",
      presentation: "presentationComparison",
      effects: "effectComparison",
    } as const)[dimension];
    const target = comparison[field];
    target.classification = "approved_policy_difference";
    target.comparatorId = "comparator.policy_difference";
    target.comparatorEvidenceReferences = [
      `evidence.policy.${dimension}`,
    ];
    target.differenceCategory = "LEGACY_FORMAT_ONLY";
    target.policyFindingIds = ["finding-task4-response-guidance"];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it.each([
    ["wrong policy", (request: ReturnType<
      typeof createPolicyApprovedDifferenceScenario
    >["request"]) => {
      const finding = request.suppliedPolicyDecision.findings.find((item) =>
        item.findingId === "finding-task4-response-guidance")!;
      finding.policyId = "policy.specialist.valid";
      finding.category = "specialist_validity";
    }],
    ["wrong outcome", (request: ReturnType<
      typeof createPolicyApprovedDifferenceScenario
    >["request"]) => {
      const finding = request.suppliedPolicyDecision.findings.find((item) =>
        item.findingId === "finding-task4-response-guidance")!;
      finding.policyId = "policy.response_composition.denied";
      finding.outcome = "deny";
    }],
    ["wrong subject type", (request: ReturnType<
      typeof createPolicyApprovedDifferenceScenario
    >["request"]) => {
      const finding = request.suppliedPolicyDecision.findings.find((item) =>
        item.findingId === "finding-task4-response-guidance")!;
      finding.subjectType = "presentation";
    }],
    ["wrong subject ID", (request: ReturnType<
      typeof createPolicyApprovedDifferenceScenario
    >["request"]) => {
      const finding = request.suppliedPolicyDecision.findings.find((item) =>
        item.findingId === "finding-task4-response-guidance")!;
      finding.subjectId = "response-guidance-other";
    }],
    ["wrong response plan", (request: ReturnType<
      typeof createPolicyApprovedDifferenceScenario
    >["request"]) => {
      request.suppliedPolicyDecision.approvedResponsePlan!
        .approvedFacts[0].sourceReferenceId = "response-guidance-other";
    }],
    ["wrong request", (request: ReturnType<
      typeof createPolicyApprovedDifferenceScenario
    >["request"]) => {
      request.suppliedPolicyDecision.evaluationId = "evaluation-other";
    }],
  ] as const)("rejects policy difference authority with %s", (
    _name,
    mutate,
  ) => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    mutate(request);
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });

  it.each(["reject", "defer", "require_confirmation"] as const)(
    "rejects policy difference from %s authority",
    (adjudicationDecision) => {
      const { request, decision } = createPolicyApprovedDifferenceScenario();
      const adjudication = request.suppliedPolicyDecision.adjudications.find(
        (item) =>
          item.subjectType === "response_guidance" &&
          item.subjectId === "request-task4-specialist.response_guidance",
      )!;
      adjudication.decision = adjudicationDecision;
      if (adjudicationDecision === "require_confirmation") {
        adjudication.constraints = [{
          constraintId: "constraint-policy-difference-confirmation",
          reasonCode: "CONFIRM_POLICY_DIFFERENCE",
          subjectId: adjudication.subjectId,
          sourcePolicyId: "policy.consent.confirmation",
          type: "require_user_confirmation",
          parameters: {},
        }];
      }
      expect(() => validateCompatibilityDecisionForRequest(request, decision))
        .toThrow(OrchestrationContractError);
    },
  );

  it("rejects policy difference without an adjudicated subject", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    request.suppliedPolicyDecision.adjudications =
      request.suppliedPolicyDecision.adjudications.filter((item) =>
        item.subjectType !== "response_guidance");
    expect(() => validateCompatibilityDecisionForRequest(request, decision))
      .toThrow(OrchestrationContractError);
  });

  it("rejects an unrelated valid Task 4 finding", () => {
    const { request, decision } = createPolicyApprovedDifferenceScenario();
    decision.shadowComparison!.responseComparison.policyFindingIds = [
      "finding-task4-flow-update",
    ];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it("fixes every independent frozen contract and registry version", () => {
    expect(SUPPORTED_FROZEN_VERSIONS).toEqual({
      interactionEvent: "1.0.0",
      flowState: "1.0.0",
      specialist: "1.0.0",
      flowCatalogue: "1.0.0",
      presentationRegistry: "1.0.0",
      orchestratorPolicy: "1.0.0",
      compatibilityBoundary: "1.0.0",
      legacySeamRegistry: "1.0.0",
      legacySeam: "1.0.0",
      comparatorRegistry: "1.0.0",
      comparisonPolicyRegistry: "1.0.0",
      policyDifferenceAuthorityMatrix: "1.0.0",
      goldenCatalogue: "1.0.0",
      goldenCase: "1.0.0",
    });
  });

  it.each([
    ["comparisonPolicyId", "policy.compatibility.unknown"],
    ["version", "99.0.0"],
  ])("rejects unknown request comparison policy %s", (field, value) => {
    const request = cloneCompatibilityFixture(
      validCompatibilityRequestFixture,
    ) as unknown as Record<string, unknown>;
    (request.expectedComparisonPolicy as Record<string, unknown>)[field] = value;
    expectCode(
      () => parseCompatibilityEvaluationRequest(request),
      "COMPATIBILITY_REQUEST_INVALID",
    );
  });

  it.each(["legacyDigest", "canonicalDigest"] as const)(
    "rejects byte equivalence when %s is absent",
    (field) => {
      const comparison = cloneCompatibilityFixture(
        validShadowComparisonFixture,
      );
      comparison.responseComparison[field] = undefined;
      expectCode(
        () => parseShadowComparisonRecord(comparison),
        "COMPATIBILITY_COMPARISON_INVALID",
      );
    },
  );

  it("rejects byte equivalence when both digests are absent", () => {
    const comparison = cloneCompatibilityFixture(validShadowComparisonFixture);
    comparison.responseComparison.legacyDigest = undefined;
    comparison.responseComparison.canonicalDigest = undefined;
    expectCode(
      () => parseShadowComparisonRecord(comparison),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it("rejects unsupported digest algorithms and formats", () => {
    const comparison = cloneCompatibilityFixture(
      validShadowComparisonFixture,
    ) as unknown as {
        responseComparison: {
          legacyDigest: Record<string, unknown>;
        };
      };
    comparison.responseComparison.legacyDigest.algorithm = "md5";
    comparison.responseComparison.legacyDigest.value = "abc";
    expectCode(
      () => parseShadowComparisonRecord(comparison),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it.each([
    ["semantically_equivalent", "incompatible"],
    ["semantically_equivalent", "missing_canonical_evidence"],
    ["policy_approved_difference", "incompatible"],
  ] as const)("rejects final %s with dimension %s", (final, dimension) => {
    const comparison = cloneCompatibilityFixture(validShadowComparisonFixture);
    comparison.responseComparison.classification = dimension;
    comparison.responseComparison.comparatorId =
      "comparator.semantic_fixture";
    comparison.responseComparison.comparatorEvidenceReferences = [
      "evidence.parity.adversarial",
    ];
    comparison.finalClassification = final;
    expectCode(
      () => parseShadowComparisonRecord(comparison),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });
});

describe("Task 5 golden cases and evidence", () => {
  it("resolves an approved synthetic golden case", () => {
    const parsed = parseGoldenCompatibilityCatalogue(
      validGoldenCatalogueFixture,
    );
    expect(parsed.cases[0].status).toBe("approved");
    expect(parsed.cases[0].provenance.fixtureKind).toBe("synthetic");
  });

  it("rejects duplicate golden IDs", () => {
    const catalogue = cloneCompatibilityFixture(validGoldenCatalogueFixture);
    catalogue.cases.push(cloneCompatibilityFixture(catalogue.cases[0]));
    expectCode(
      () => parseGoldenCompatibilityCatalogue(catalogue),
      "COMPATIBILITY_GOLDEN_CASE_INVALID",
    );
  });

  it.each([
    "flowReference", "presentationReference", "policyReferences",
  ] as const)("rejects unresolved golden %s", (field) => {
    const catalogue = cloneCompatibilityFixture(validGoldenCatalogueFixture);
    if (field === "flowReference") {
      catalogue.cases[0].flowReference.flowId = "flow.unknown";
    } else if (field === "presentationReference") {
      catalogue.cases[0].presentationReference.presentationId =
        "presentation.unknown";
    } else {
      catalogue.cases[0].policyReferences = ["policy.unknown"];
    }
    expectCode(
      () => parseGoldenCompatibilityCatalogue(catalogue),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it("rejects non-synthetic golden provenance", () => {
    const catalogue = cloneCompatibilityFixture(
      validGoldenCatalogueFixture,
    ) as unknown as { cases: Array<{ provenance: { fixtureKind: string } }> };
    catalogue.cases[0].provenance.fixtureKind = "live_user";
    expectCode(
      () => parseGoldenCompatibilityCatalogue(catalogue),
      "COMPATIBILITY_GOLDEN_CASE_INVALID",
    );
  });

  it("parses accepted matching evidence", () => {
    expect(parseCompatibilityEvidence(validCompatibilityEvidenceFixture)
      .reviewStatus).toBe("accepted");
  });

  it("rejects unsupported frozen versions through the public evidence parser", () => {
    const fields = [
      "interactionEventVersion",
      "flowStateVersion",
      "specialistContractVersion",
      "flowCatalogueVersion",
      "presentationRegistryVersion",
      "orchestratorPolicyVersion",
      "compatibilitySchemaVersion",
    ] as const;
    for (const field of fields) {
      const evidence = cloneCompatibilityFixture(
        validCompatibilityEvidenceFixture,
      );
      evidence.canonicalContractVersions[field] = "99.0.0";
      expectCode(
        () => parseCompatibilityEvidence(evidence),
        "COMPATIBILITY_EVIDENCE_INVALID",
      );
    }
  });

  it.each([
    "safety.no_downgrade",
    "session.legacy_unchanged",
  ])("rejects accepted evidence missing required invariant %s", (id) => {
    const { request, decision } = shadowScenario();
    decision.evidence[0].invariantResults =
      decision.evidence[0].invariantResults.filter((item) =>
        item.invariantId !== id);
    expectCode(
      () => validateShadow(request, decision),
      "COMPATIBILITY_EVIDENCE_INVALID",
    );
  });

  it("rejects duplicate invariant IDs through the public evidence parser", () => {
    const evidence = cloneCompatibilityFixture(
      validCompatibilityEvidenceFixture,
    );
    evidence.invariantResults.push(
      cloneCompatibilityFixture(evidence.invariantResults[0]),
    );
    expectCode(
      () => parseCompatibilityEvidence(evidence),
      "COMPATIBILITY_EVIDENCE_INVALID",
    );
  });

  it.each(["safety", "consent"] as const)(
    "rejects accepted evidence with failed %s invariant",
    (category) => {
      const evidence = cloneCompatibilityFixture(
        validCompatibilityEvidenceFixture,
      );
      evidence.invariantResults.find((item) =>
        item.category === category)!.passed = false;
      expectCode(
        () => parseCompatibilityEvidence(evidence),
        "COMPATIBILITY_EVIDENCE_INVALID",
      );
    },
  );

  it("rejects accepted evidence with wrong observed classification", () => {
    const evidence = cloneCompatibilityFixture(
      validCompatibilityEvidenceFixture,
    );
    evidence.observedClassification = "incompatible";
    expectCode(
      () => parseCompatibilityEvidence(evidence),
      "COMPATIBILITY_EVIDENCE_INVALID",
    );
  });

  it.each(["draft", "deprecated", "retired"] as const)(
    "prevents %s golden case from authorizing readiness",
    (status) => {
      const { request, decision } = shadowScenario();
      const catalogue = cloneCompatibilityFixture(validGoldenCatalogueFixture);
      catalogue.cases[0].status = status;
      decision.evidence = [
        cloneCompatibilityFixture(validCompatibilityEvidenceFixture),
      ];
      expectCode(
        () => validateCompatibilityDecisionForRequest(request, decision, {
          goldenCatalogue: catalogue,
          now: "2026-06-01T00:00:00.000Z",
        }),
        "COMPATIBILITY_EVIDENCE_INVALID",
      );
    },
  );

  it("rejects stale accepted evidence for promotion", () => {
    const { request, decision } = shadowScenario();
    decision.evidence = [
      cloneCompatibilityFixture(validCompatibilityEvidenceFixture),
    ];
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision, {
        goldenCatalogue: validGoldenCatalogueFixture,
        now: "2028-01-01T00:00:00.000Z",
      }),
      "COMPATIBILITY_EVIDENCE_INVALID",
    );
  });
});

describe("Task 5 feature flag, rollback and safe failure", () => {
  it("accepts default legacy-only flag state", () => {
    const flag = cloneCompatibilityFixture(validShadowFeatureFlagFixture);
    flag.requestedMode = "legacy_only";
    flag.effectiveMode = "legacy_only";
    flag.percentageBasisPoints = 0;
    flag.prerequisiteEvidenceIds = [];
    flag.rollbackPlanId = undefined;
    expect(parseCompatibilityFeatureFlagState(flag).effectiveMode)
      .toBe("legacy_only");
  });

  it("accepts inert shadow flag state", () => {
    expect(parseCompatibilityFeatureFlagState(validShadowFeatureFlagFixture)
      .effectiveMode).toBe("shadow_compare");
  });

  it.each([-1, 10_001])("rejects percentage %s", (percentageBasisPoints) => {
    const flag = cloneCompatibilityFixture(validShadowFeatureFlagFixture);
    flag.percentageBasisPoints = percentageBasisPoints;
    expectCode(
      () => parseCompatibilityFeatureFlagState(flag),
      "COMPATIBILITY_FEATURE_FLAG_INVALID",
    );
  });

  it.each(["rollbackPlanId", "prerequisiteEvidenceIds"] as const)(
    "rejects shadow flag missing %s",
    (field) => {
      const flag = cloneCompatibilityFixture(validShadowFeatureFlagFixture);
      if (field === "rollbackPlanId") flag.rollbackPlanId = undefined;
      else flag.prerequisiteEvidenceIds = [];
      expectCode(
        () => parseCompatibilityFeatureFlagState(flag),
        "COMPATIBILITY_FEATURE_FLAG_INVALID",
      );
    },
  );

  it("enforces deny-list precedence", () => {
    const flag = cloneCompatibilityFixture(validShadowFeatureFlagFixture);
    flag.denyListMatched = true;
    expectCode(
      () => parseCompatibilityFeatureFlagState(flag),
      "COMPATIBILITY_FEATURE_FLAG_INVALID",
    );
  });

  it("rejects production-authoritative state", () => {
    const flag = cloneCompatibilityFixture(validShadowFeatureFlagFixture);
    flag.requestedMode = "authoritative";
    flag.effectiveMode = "authoritative";
    flag.environmentClass = "production";
    expectCode(
      () => parseCompatibilityFeatureFlagState(flag),
      "COMPATIBILITY_FEATURE_FLAG_INVALID",
    );
  });

  it.each(["candidate_delivery", "authoritative"] as const)(
    "rejects effective inactive mode %s through the public flag parser",
    (effectiveMode) => {
      const flag = cloneCompatibilityFixture(
        validShadowFeatureFlagFixture,
      ) as unknown as Record<string, unknown>;
      flag.requestedMode = effectiveMode;
      flag.effectiveMode = effectiveMode;
      expectCode(
        () => parseCompatibilityFeatureFlagState(flag),
        "COMPATIBILITY_FEATURE_FLAG_INVALID",
      );
    },
  );

  it("rejects an arbitrary safe-failure classification/code pairing", () => {
    expect(() => compatibilitySafeFailureSchema.parse({
      failureId: "failure-task5-arbitrary",
      classification: "safety_mismatch",
      fixedPublicErrorCode: "COMPATIBILITY_REQUEST_INVALID",
      fallbackRecommendation: "require_manual_review",
      blockingFindingIds: [],
      auditReference: "audit-task5-safe-failure",
      nonExecutable: true,
    })).toThrow();
  });

  it("validates accepted evidence and rollback for shadow eligibility", () => {
    const { request, decision } = shadowScenario();
    decision.evidence = [
      cloneCompatibilityFixture(validCompatibilityEvidenceFixture),
    ];
    decision.featureFlagState = cloneCompatibilityFixture(
      validShadowFeatureFlagFixture,
    );
    decision.rollbackPlan = cloneCompatibilityFixture(validRollbackPlanFixture);
    expect(validateCompatibilityDecisionForRequest(request, decision, {
      goldenCatalogue: validGoldenCatalogueFixture,
      now: "2026-06-01T00:00:00.000Z",
    }).featureFlagState?.effectiveMode).toBe("shadow_compare");
  });

  it.each([
    ["shadow_compare", "legacy_only"],
    ["candidate_delivery", "legacy_only"],
  ] as const)("accepts inert rollback %s to %s", (sourceMode, targetMode) => {
    const rollback = cloneCompatibilityFixture(validRollbackPlanFixture);
    rollback.sourceMode = sourceMode;
    rollback.targetMode = targetMode;
    expect(parseCompatibilityRollbackPlan(rollback).targetMode)
      .toBe("legacy_only");
  });

  it.each([
    ["shadow_compare", "authoritative"],
    ["legacy_only", "legacy_only"],
    ["shadow_compare", "shadow_compare"],
  ] as const)("rejects rollback %s to %s", (sourceMode, targetMode) => {
    const rollback = cloneCompatibilityFixture(validRollbackPlanFixture);
    rollback.sourceMode = sourceMode;
    rollback.targetMode = targetMode;
    expectCode(
      () => parseCompatibilityRollbackPlan(rollback),
      "COMPATIBILITY_ROLLBACK_INVALID",
    );
  });

  it("rejects rollback that invents a handler seam", () => {
    const rollback = cloneCompatibilityFixture(validRollbackPlanFixture);
    rollback.expectedRecoverySemantics.handlerSeamId =
      "legacy.voice.session_state";
    expectCode(
      () => parseCompatibilityRollbackPlan(rollback),
      "COMPATIBILITY_ROLLBACK_INVALID",
    );
  });

  it("schema-fixes emergency, audit and consent recovery protections", () => {
    for (const [field, value] of [
      ["preserveEmergencyHandling", false],
      ["preserveRequiredAudit", false],
      ["restoreRevokedConsent", true],
    ] as const) {
      const rollback = cloneCompatibilityFixture(validRollbackPlanFixture);
      (rollback.expectedRecoverySemantics as unknown as Record<string, unknown>)[
        field
      ] = value;
      expectCode(
        () => parseCompatibilityRollbackPlan(rollback),
        "COMPATIBILITY_ROLLBACK_INVALID",
      );
    }
  });

  const independentSafeFailureCodes = {
    invalid_request: "COMPATIBILITY_REQUEST_INVALID",
    stale_contract: "COMPATIBILITY_VERSION_INVALID",
    unsupported_seam: "COMPATIBILITY_SEAM_REGISTRY_INVALID",
    invalid_task4_decision: "COMPATIBILITY_DECISION_INVALID",
    unauthorized_adapter_effect: "COMPATIBILITY_EFFECT_UNAUTHORIZED",
    parity_mismatch: "COMPATIBILITY_PARITY_INVALID",
    safety_mismatch: "COMPATIBILITY_SAFETY_MISMATCH",
    consent_mismatch: "COMPATIBILITY_CONSENT_MISMATCH",
    missing_evidence: "COMPATIBILITY_EVIDENCE_INVALID",
    invalid_feature_flag_state: "COMPATIBILITY_FEATURE_FLAG_INVALID",
    invalid_rollback: "COMPATIBILITY_ROLLBACK_INVALID",
    audit_correlation_failure: "COMPATIBILITY_AUDIT_INVALID",
  } as const;

  it.each(COMPATIBILITY_FAILURE_CLASSIFICATIONS)(
    "models safe failure %s without execution",
    (classification) => {
      const reviewRequired = [
        "invalid_task4_decision", "safety_mismatch", "consent_mismatch",
        "audit_correlation_failure",
      ].includes(classification);
      const parsed = compatibilitySafeFailureSchema.parse({
        failureId: `failure-${classification}`,
        classification,
        fixedPublicErrorCode: independentSafeFailureCodes[classification],
        fallbackRecommendation: reviewRequired
          ? "require_manual_review"
          : "remain_legacy_only",
        blockingFindingIds: [],
        auditReference: "audit-task5-safe-failure",
        nonExecutable: true,
      });
      expect(parsed.nonExecutable).toBe(true);
      expect(COMPATIBILITY_SAFE_FAILURE_CODE_MAP[classification])
        .toBe(independentSafeFailureCodes[classification]);
    },
  );
});

describe("Task 5 decision correlation, audit and isolation", () => {
  it("validates the inert legacy-only decision", () => {
    expect(validateCompatibilityDecisionForRequest(
      validCompatibilityRequestFixture,
      validCompatibilityDecisionFixture,
    ).nonExecutable).toBe(true);
  });

  it.each([
    ["occurredAt", "2026-07-31T10:00:01.000Z"],
    ["channel", "text"],
    ["userId", "user-task4-other"],
    ["profileId", "profile-task4-other"],
  ])("rejects duplicated Task 1 event drift in %s", (field, value) => {
    const request = cloneCompatibilityFixture(
      validCompatibilityRequestFixture,
    ) as unknown as {
        policyEvaluationRequest: {
          interactionEvent: Record<string, unknown>;
        };
      };
    request.policyEvaluationRequest.interactionEvent =
      cloneCompatibilityFixture(
        request.policyEvaluationRequest.interactionEvent,
      );
    request.policyEvaluationRequest.interactionEvent[field] = value;
    expect(() => parseCompatibilityEvaluationRequest(request)).toThrow(
      OrchestrationContractError,
    );
  });

  it.each([
    ["updatedAt", "2026-07-31T10:00:01.000Z"],
    ["context", { activeScene: "scene.other" }],
  ])("rejects duplicated Task 1 Flow-state drift in %s", (field, value) => {
    const request = cloneCompatibilityFixture(
      validCompatibilityRequestFixture,
    ) as unknown as {
        policyEvaluationRequest: {
          activeFlowState: Record<string, unknown>;
        };
      };
    request.policyEvaluationRequest.activeFlowState =
      cloneCompatibilityFixture(
        request.policyEvaluationRequest.activeFlowState,
      );
    request.policyEvaluationRequest.activeFlowState[field] = value;
    expect(() => parseCompatibilityEvaluationRequest(request)).toThrow(
      OrchestrationContractError,
    );
  });

  it("rejects duplicated Task 1 pending-Tool drift", () => {
    const request = cloneCompatibilityFixture(
      validCompatibilityRequestFixture,
    ) as unknown as {
        policyEvaluationRequest: {
          activeFlowState: Record<string, unknown>;
        };
      };
    request.policyEvaluationRequest.activeFlowState =
      cloneCompatibilityFixture(
        request.policyEvaluationRequest.activeFlowState,
      );
    request.policyEvaluationRequest.activeFlowState.state = "waiting_for_tool";
    request.policyEvaluationRequest.activeFlowState.pendingTool = {
      toolId: "tool.other",
      requestId: "request.other",
      startedAt: "2026-07-31T10:00:00.000Z",
    };
    expect(() => parseCompatibilityEvaluationRequest(request)).toThrow(
      OrchestrationContractError,
    );
  });

  it("rejects a snapshot older than the resolved policy maximum", () => {
    const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
    request.legacyInputSnapshot.capturedAt = "2026-01-15T09:54:59.000Z";
    expectCode(
      () => parseCompatibilityEvaluationRequest(request),
      "COMPATIBILITY_CORRELATION_INVALID",
    );
  });

  it("rejects a feature flag for another façade flag ID", () => {
    const { request, decision } = shadowScenario();
    decision.featureFlagState!.flagId = "flag.compatibility.other";
    expectCode(
      () => validateShadow(request, decision),
      "COMPATIBILITY_FEATURE_FLAG_INVALID",
    );
  });

  it.each([
    "incompatible",
    "insufficient_evidence",
    "safe_fallback_required",
  ] as const)("rejects shadow flag eligibility at final parity %s", (parity) => {
    const { request, decision } = shadowScenario();
    const comparison = decision.shadowComparison!;
    comparison.responseComparison.classification =
      parity === "incompatible"
        ? "incompatible"
        : parity === "safe_fallback_required"
          ? "legacy_safer"
          : "missing_canonical_evidence";
    comparison.responseComparison.comparatorId =
      "comparator.semantic_fixture";
    comparison.finalClassification = parity;
    decision.finalClassification = parity;
    decision.evidence[0].observedClassification = parity;
    decision.evidence[0].expectedClassification = parity;
    const golden = cloneCompatibilityFixture(validGoldenCatalogueFixture);
    golden.cases[0].expectedClassification = parity;
    expectCode(
      () => validateCompatibilityDecisionForRequest(request, decision, {
        goldenCatalogue: golden,
        now: "2026-06-01T00:00:00.000Z",
      }),
      "COMPATIBILITY_FEATURE_FLAG_INVALID",
    );
  });

  it("rejects a dangling effect sourcePlanId", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    const plan = cloneCompatibilityFixture(validAuditAdapterPlanFixture);
    plan.authorizedEffects[0].sourcePlanId = "dangling-plan";
    decision.adapterPlans = [plan];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_EFFECT_UNAUTHORIZED",
    );
  });

  it("all public parsers return typed fixed errors", () => {
    const parsers = [
      parseLegacySeamRegistry,
      parseCompatibilityEvaluationRequest,
      parseAdapterAuthorizationPlan,
      parseShadowComparisonRecord,
      parseGoldenCompatibilityCatalogue,
      parseCompatibilityEvidence,
      parseCompatibilityFeatureFlagState,
      parseCompatibilityRollbackPlan,
      parseCompatibilityDecisionRecord,
    ];
    for (const parser of parsers) {
      expect(() => parser({ invalid: "submitted-private-detail" }))
        .toThrow(OrchestrationContractError);
    }
  });

  it.each([
    ["compatibilityRequestId", "request-other"],
    ["auditReference", "audit-other"],
  ] as const)("rejects incompatible decision %s", (field, value) => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    decision[field] = value;
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_CORRELATION_INVALID",
    );
  });

  it("rejects a direct adapter-plan self-reference", () => {
    const plan = cloneCompatibilityFixture(validAuditAdapterPlanFixture);
    plan.sourcePlanIds = [plan.adapterPlanId];
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    decision.adapterPlans = [plan];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it("rejects a legacy snapshot stale relative to its audit capture", () => {
    const request = cloneCompatibilityFixture(validCompatibilityRequestFixture);
    request.legacyInputSnapshot.capturedAt = "2026-01-15T09:59:59.000Z";
    expectCode(
      () => parseCompatibilityEvaluationRequest(request),
      "COMPATIBILITY_CORRELATION_INVALID",
    );
  });

  it("rejects a legacy output captured before its input", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    decision.legacyOutputSnapshot.capturedAt = "2026-01-15T09:59:59.000Z";
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_CORRELATION_INVALID",
    );
  });

  it("rejects a comparison captured before the legacy output", () => {
    const { request, decision } = shadowScenario();
    decision.shadowComparison!.comparedAt = "2026-01-15T09:59:59.000Z";
    expectCode(
      () => validateShadow(request, decision),
      "COMPATIBILITY_CORRELATION_INVALID",
    );
  });

  it("rejects duplicate adapter plan identifiers", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    decision.adapterPlans = [
      cloneCompatibilityFixture(validAuditAdapterPlanFixture),
      cloneCompatibilityFixture(validAuditAdapterPlanFixture),
    ];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it("rejects a legacy effect from another request correlation", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    decision.legacyOutputSnapshot.effects = [{
      effectId: "legacy-effect-task5",
      effectType: "write_session_id",
      sourceSeamId: validCompatibilityRequestFixture.legacyInputSnapshot.seamId,
      correlationId: "correlation-other",
      safetyClassification: "routine",
      nonExecutable: true,
    }];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_CORRELATION_INVALID",
    );
  });

  it("rejects rollback evidence that is absent from the decision", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    decision.rollbackPlan = cloneCompatibilityFixture(validRollbackPlanFixture);
    decision.rollbackPlan.requiredEvidence = ["evidence-not-supplied"];
    expectCode(
      () => validateCompatibilityDecisionForRequest(
        validCompatibilityRequestFixture,
        decision,
      ),
      "COMPATIBILITY_ROLLBACK_INVALID",
    );
  });

  it("rejects an observability reference to another comparison", () => {
    const { request, decision } = shadowScenario();
    decision.observability.decisionComparisonReference = "comparison-other";
    expectCode(
      () => validateShadow(request, decision),
      "COMPATIBILITY_REFERENCE_INVALID",
    );
  });

  it("rejects observability that contradicts the comparison", () => {
    const { request, decision } = shadowScenario();
    decision.observability.responseComparison = "semantic_match";
    expectCode(
      () => validateShadow(request, decision),
      "COMPATIBILITY_COMPARISON_INVALID",
    );
  });

  it.each([
    ["transcript", "raw transcript"],
    ["audio", "raw audio"],
    ["imageContent", "raw image"],
    ["documentContent", "raw document"],
    ["toolArguments", { destination: "private" }],
    ["providerPayload", { response: "private" }],
    ["cardNumber", "4111111111111111"],
    ["credential", "private credential"],
    ["token", "private token"],
    ["hiddenReasoning", "private reasoning"],
  ])("rejects unsafe observability metadata %s", (key, value) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = { [key]: value };
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_AUDIT_INVALID",
    );
  });

  const rejectedCredentialValues = [
    [
      "JWT",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    ],
    [
      "structural non-JSON-header JWT",
      "abc12345.def67890.signature1",
    ],
    ["Google API key", "AIza1234567890abcdefghijklmnopqrstuvwxy"],
    ["GitHub token", "ghp_1234567890abcdefghijklmnopqrstuv"],
    ["GitHub fine-grained token", "github_pat_1234567890abcdefghijklmnop"],
    ["secret key", "sk-1234567890abcdefghijkl"],
    ["API-key assignment", "api_key=1234567890abcdef"],
    ["access-token assignment", "access_token=1234567890abcdef"],
    ["client-secret assignment", "client_secret=1234567890abcdef"],
    ["private-key marker", "-----BEGIN PRIVATE KEY-----"],
    ["RSA private-key marker", "-----BEGIN RSA PRIVATE KEY-----"],
    ["OpenSSH private-key marker", "-----BEGIN OPENSSH PRIVATE KEY-----"],
    ["encrypted private-key marker", "-----BEGIN ENCRYPTED PRIVATE KEY-----"],
    ["Basic authorization", "Basic dXNlcjpwYXNzd29yZA=="],
    [
      "credential connection string",
      "Server=provider.example;Password=private-value",
    ],
  ] as const;

  it.each(rejectedCredentialValues)(
    "rejects neutral-key %s values",
    (_kind, value) => {
      const decision = cloneCompatibilityFixture(
        validCompatibilityDecisionFixture,
      );
      decision.observability.safeMetadata = { note: value };
      expectCode(
        () => parseCompatibilityDecisionRecord(decision),
        "COMPATIBILITY_AUDIT_INVALID",
      );
    },
  );

  it("rejects the minimum bounded three-segment JWT-like shape", () => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = {
      note: "abcdefgh.ijklmnop.qrstuvwx",
    };
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_AUDIT_INVALID",
    );
  });

  it.each([
    "compatibility.request.task5",
    "reason.policy.safe",
    "1.2.3",
    `${"a".repeat(129)}.segment12.segment34`,
  ])("allows non-JWT dotted semantic value %s", (value) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = { note: value };
    expect(parseCompatibilityDecisionRecord(decision).observability.safeMetadata)
      .toEqual({ note: value });
  });

  it.each([
    {
      nested: {
        detail:
          "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
      },
    },
    {
      values: [{
        description: "access_token=1234567890abcdef",
      }],
    },
  ])("rejects nested and array-nested credentials", (safeMetadata) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = safeMetadata;
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_AUDIT_INVALID",
    );
  });

  it.each([
    "endpoint", "endpoint_url", "endpointurl", "url", "uri", "execute_url",
    "executeurl", "invoke_url", "invokeurl", "request_url", "requesturl",
    "callback_url", "callbackurl", "webhook", "webhook_url", "webhookurl",
    "client", "api_client", "apiclient", "provider", "provider_client",
    "providerclient", "provider_object", "providerobject", "provider_instance",
    "providerinstance", "runtime_client", "runtimeclient", "sdk_client",
    "sdkclient", "http_client", "httpclient", "base_url", "baseurl",
    "api_url", "apiurl", "host", "hostname", "connection",
    "connection_string", "connectionstring", "socket", "transport",
    "executor", "execute", "invoke", "handler", "adapter_instance",
    "adapterinstance",
  ])("rejects executable audit key %s recursively", (key) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = {
      nested: [{ providerConfiguration: { [key]: "opaque-value" } }],
    };
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_AUDIT_INVALID",
    );
  });

  it.each([
    "https://provider.example/execute",
    "prefix http://provider.example/run",
    "ws://provider.example/socket",
    "wss://provider.example/socket",
    "ftp://provider.example/file",
    "file://server/share",
    "javascript:execute()",
    "data:text/plain,execute",
    "mailto:operator@example.test",
    "\\\\server\\share\\execute",
    "Server=provider.example;Database=vyva",
    "host=provider.example;port=5432",
    "provider.example:443/execute",
    "127.0.0.1:8080",
    "sk-live-raw-secret-value",
  ])("rejects executable audit value %s under any key", (value) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = {
      safeReference: { nested: [value] },
    };
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_AUDIT_INVALID",
    );
  });

  it("rejects a nested provider client with executable endpoints", () => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = {
      providerClient: {
        endpoint: "https://provider.example/execute",
        executeUrl: "https://provider.example/run",
      },
    };
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_AUDIT_INVALID",
    );
  });

  it("allows safe declarative audit keys with inert values", () => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = {
      endpointPolicy: "network.destinations.prohibited",
      providerPolicy: "provider-execution-prohibited",
      clientCapabilityRequired: false,
      urlPolicy: "network.urls.prohibited",
      opaqueProviderReference: "provider-reference-task5",
      tokenPolicy: "credential.values.prohibited",
      tokenRequired: false,
    };
    expect(parseCompatibilityDecisionRecord(decision).observability.safeMetadata)
      .toEqual(decision.observability.safeMetadata);
  });

  it("allows ordinary token-policy prose without credential material", () => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = {
      note: "The token policy requires opaque references.",
    };
    expect(parseCompatibilityDecisionRecord(decision).observability.safeMetadata)
      .toEqual(decision.observability.safeMetadata);
  });

  it.each([
    "sourcePathReference",
    "SourcePathReference",
    "source_path_reference",
    "source-path-reference",
  ])("rejects generic source-path metadata key %s", (key) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = {
      [key]: "shared/orchestration/compatibilityBoundary.ts",
    };
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_AUDIT_INVALID",
    );
  });

  it.each([
    {
      nested: {
        sourcePathReference:
          "shared/orchestration/compatibilityBoundary.ts",
      },
    },
    {
      values: [{
        source_path_reference:
          "shared/orchestration/compatibilityBoundary.ts",
      }],
    },
  ])("rejects nested and array-nested generic source paths", (safeMetadata) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = safeMetadata;
    expectCode(
      () => parseCompatibilityDecisionRecord(decision),
      "COMPATIBILITY_AUDIT_INVALID",
    );
  });

  it.each([
    "550e8400-e29b-41d4-a716-446655440000",
    "2026-01-15T10:00:00.000Z",
    "reason.safe_reference",
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ])("allows minimized safe metadata reference %s", (reference) => {
    const decision = cloneCompatibilityFixture(
      validCompatibilityDecisionFixture,
    );
    decision.observability.safeMetadata = { reference };
    expect(parseCompatibilityDecisionRecord(decision).observability.safeMetadata)
      .toEqual({ reference });
  });

  it("keeps all collections bounded", () => {
    const plan = cloneCompatibilityFixture(validAuditAdapterPlanFixture);
    plan.narrowingConstraints = Array.from(
      { length: 129 },
      (_, index) => `constraint.${index}`,
    );
    expect(adapterAuthorizationPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("contains no runtime implementation imports or execution APIs", () => {
    const source = readFileSync(
      new URL("./compatibilityBoundary.ts", import.meta.url),
      "utf8",
    );
    const forbiddenImports = [
      /from\s+["'](?:\.\.\/)*src\//,
      /from\s+["']react/,
      /elevenlabs/i,
      /from\s+["'](?:openai|@anthropic-ai)/,
      /from\s+["'].*mem0/i,
      /from\s+["'].*(?:drizzle|prisma|database|postgres|pg)/i,
      /from\s+["'].*(?:scheduler|queue|cron)/i,
      /from\s+["'].*(?:api|provider)/i,
      /localStorage|sessionStorage|dispatchEvent|CustomEvent/,
      /speechSynthesis|new\s+SpeechSynthesisUtterance/,
    ];
    forbiddenImports.forEach((pattern) => expect(source).not.toMatch(pattern));
  });

  it("exports strict non-executable decision records", () => {
    const decision = cloneCompatibilityFixture(validCompatibilityDecisionFixture);
    (decision as unknown as Record<string, unknown>).execute = true;
    expect(compatibilityDecisionRecordSchema.safeParse(decision).success)
      .toBe(false);
  });
});
