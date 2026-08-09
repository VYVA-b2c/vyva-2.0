import { describe, expect, it } from "vitest";
import { OrchestrationContractError } from "./errors";
import {
  VYVA_FLOW_CATALOGUE,
  parseFlowCatalogue,
  type FlowCatalogue,
} from "./flowCatalogue";
import {
  emergencyCheckFlowFixture,
  futureCapabilityFixture,
  futureCatalogueFixture,
  futureFlowFixture,
  outboundCallFlowFixture,
  pushNotificationFlowFixture,
  scamAssessmentFlowFixture,
  stoolAssessmentFlowFixture,
  woundAssessmentFlowFixture,
} from "./flowCatalogueFixtures";

const requiredFlowIds = [
  "safety.emergency_check", "safety.immediate_risk_assessment",
  "safety.escalation_decision", "safety.safety_followup",
  "health.preventive_check", "health.symptom_assessment", "health.vitals_capture",
  "health.recovery_followup", "health.healthy_ageing_coaching",
  "health.visual.wound_assessment", "health.visual.stool_assessment",
  "health.visual.skin_assessment", "health.visual.foot_assessment",
  "health.visual.swelling_assessment",
  "health.visual.medication_packaging_identification",
  "health.visual.longitudinal_image_comparison",
  "medication.reminder", "medication.dose_confirmation", "medication.dose_deferred",
  "medication.missed_dose", "medication.refill_check", "medication.supply_check",
  "medication.side_effect_report", "medication.adherence_followup",
  "wellbeing.mood_check", "wellbeing.loneliness_check", "wellbeing.distress_check",
  "wellbeing.cognitive_concern", "wellbeing.support", "wellbeing.followup",
  "social.daily_checkin", "social.general_conversation", "social.reminiscence",
  "social.activity", "social.community_connection", "social.family_contact_suggestion",
  "social.loneliness_followup",
  "brain_coach.activity_session",
  "concierge.appointment_support", "concierge.transportation_support",
  "concierge.local_service_request", "concierge.shopping_support",
  "concierge.meal_support", "concierge.administrative_support",
  "concierge.community_resource_discovery", "concierge.operator_handoff",
  "trust.scam_assessment", "trust.suspicious_phone_call",
  "trust.suspicious_message", "trust.suspicious_email", "trust.impersonation_scam",
  "trust.payment_risk", "trust.remote_access_request", "trust.account_compromise",
  "trust.fraud_exposure_followup",
  "caregiver.request_checkin", "caregiver.review_approved_summary",
  "caregiver.respond_to_escalation", "caregiver.update_preferences",
  "caregiver.request_followup",
  "operator.review_escalation", "operator.review_failed_engagement",
  "operator.contact_user", "operator.contact_caregiver",
  "operator.resolve_service_request", "operator.record_outcome",
  "operator.close_case", "operator.reopen_case",
  "engagement.proactive_attempt", "engagement.push_notification",
  "engagement.notification_resume", "engagement.outbound_call", "engagement.retry",
  "engagement.channel_fallback", "engagement.no_response_followup",
  "orchestration.start_flow", "orchestration.resume_flow",
  "orchestration.interrupt_flow", "orchestration.defer_flow",
  "orchestration.cancel_flow", "orchestration.complete_flow",
  "orchestration.fail_flow", "orchestration.escalate_flow",
  "orchestration.expire_flow", "orchestration.wait_for_user",
  "orchestration.wait_for_tool", "orchestration.tool_confirmation",
  "orchestration.consent_check", "orchestration.memory_read_approval",
  "orchestration.memory_write_approval", "orchestration.followup_recommendation",
] as const;

const requiredCapabilityIds = [
  "capability.multimodal.image_capture",
  "capability.multimodal.document_capture",
  "capability.multimodal.screenshot_capture",
  "capability.multimodal.quality_check",
  "capability.multimodal.retake_request",
  "capability.multimodal.evidence_consent",
  "capability.multimodal.asset_authorization",
  "capability.multimodal.vision_analysis",
  "capability.multimodal.structured_observation_validation",
  "capability.multimodal.retention_decision",
  "capability.multimodal.longitudinal_comparison",
  "capability.communication.push",
  "capability.communication.outbound_call",
  "capability.communication.caregiver_handoff",
  "capability.communication.operator_handoff",
] as const;

const clone = <T>(value: T): T => structuredClone(value);
const expectCode = (action: () => unknown, code: string) => {
  try {
    action();
    throw new Error("Expected catalogue validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestrationContractError);
    expect((error as OrchestrationContractError).code).toBe(code);
  }
};
const mutateFlow = (
  catalogue: FlowCatalogue,
  flowId: string,
  mutate: (flow: FlowCatalogue["flows"][number]) => void,
) => mutate(catalogue.flows.find((flow) => flow.flowId === flowId)!);

describe("catalogue identity and versioning", () => {
  it("accepts the canonical catalogue", () => {
    expect(parseFlowCatalogue(VYVA_FLOW_CATALOGUE).flows)
      .toHaveLength(requiredFlowIds.length);
  });
  it("accepts stable lowercase namespaced Flow IDs", () => {
    expect(futureFlowFixture.flowId).toBe("future.example_assessment");
  });
  it("rejects presentation text as a Flow ID", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].flowId = "Emergency Check";
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_CATALOGUE_INVALID");
  });
  it("accepts semantic versions", () => {
    expect(futureFlowFixture.version).toBe("1.0.0");
  });
  it("rejects invalid semantic versions with a typed error", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].version = "version-one";
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_VERSION_INVALID");
  });
  it("rejects duplicate Flow ID and version pairs", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows.push(clone(catalogue.flows[0]));
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_ID_DUPLICATE");
  });
  it("rejects duplicate capability ID and version pairs", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.capabilities.push(clone(catalogue.capabilities[0]));
    expectCode(() => parseFlowCatalogue(catalogue), "CAPABILITY_ID_DUPLICATE");
  });
  it("accepts an explicit deprecated replacement", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, "social.activity", (flow) => {
      flow.status = "deprecated";
      flow.compatibility.isCurrent = false;
      flow.compatibility.replacementFlowId = "social.community_connection";
      flow.compatibility.replacementVersion = "1.0.0";
    });
    expect(parseFlowCatalogue(catalogue).flows).toHaveLength(requiredFlowIds.length);
  });
  it("rejects a retired current definition", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].status = "retired";
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_COMPATIBILITY_INVALID");
  });
});

describe("catalogue references", () => {
  it("resolves the visual parent/subflow relationship", () => {
    const parsed = parseFlowCatalogue(VYVA_FLOW_CATALOGUE);
    expect(parsed.flows.find((flow) => flow.flowId === woundAssessmentFlowFixture.flowId)
      ?.parentFlowId).toBe("health.symptom_assessment");
  });
  it("rejects a missing subflow", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].subflowIds = ["missing.subflow"];
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_REFERENCE_INVALID");
  });
  it("rejects circular parent relationships", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, "health.symptom_assessment", (flow) => {
      flow.parentFlowId = "health.visual.wound_assessment";
    });
    mutateFlow(catalogue, "health.visual.wound_assessment", (flow) => {
      flow.subflowIds = ["health.symptom_assessment"];
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_REFERENCE_CYCLE");
  });
  it("accepts valid capability references", () => {
    expect(parseFlowCatalogue(VYVA_FLOW_CATALOGUE).capabilities)
      .toHaveLength(requiredCapabilityIds.length);
  });
  it("rejects a missing capability", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].capabilityIds = ["capability.missing.reference"];
    expectCode(() => parseFlowCatalogue(catalogue), "CAPABILITY_REFERENCE_INVALID");
  });
  it("accepts valid next-Flow references", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].outcomes[0].allowedNextFlowIds = ["safety.safety_followup"];
    catalogue.flows[0].outcomes[0].terminal = false;
    expect(parseFlowCatalogue(catalogue).flows).toHaveLength(requiredFlowIds.length);
  });
  it("rejects an unknown next Flow", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].outcomes[0].allowedNextFlowIds = ["missing.next_flow"];
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_REFERENCE_INVALID");
  });
});

describe("safety, evidence, and consent policies", () => {
  it("accepts the wound-assessment policy", () => {
    expect(parseFlowCatalogue(VYVA_FLOW_CATALOGUE).flows)
      .toContainEqual(woundAssessmentFlowFixture);
  });
  it("rejects wound assessment without evidence consent", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, woundAssessmentFlowFixture.flowId, (flow) => {
      flow.consentRequirements = [];
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_CONSENT_POLICY_INVALID");
  });
  it("rejects wound assessment without image-quality capability", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, woundAssessmentFlowFixture.flowId, (flow) => {
      flow.capabilityIds = flow.capabilityIds.filter(
        (id) => id !== "capability.multimodal.quality_check",
      );
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_EVIDENCE_POLICY_INVALID");
  });
  it("rejects stool assessment without its red-flag check", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, stoolAssessmentFlowFixture.flowId, (flow) => {
      flow.deterministicSafetyChecks = ["safety_check.emergency_general"];
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_SAFETY_POLICY_INVALID");
  });
  it("allows the emergency Flow to preempt ordinary Flows", () => {
    expect(emergencyCheckFlowFixture.interruptionPolicy)
      .toMatchObject({ mayInterrupt: true, preemptionScope: "all_non_emergency" });
  });
  it("rejects unrestricted ordinary-Flow preemption", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, "social.daily_checkin", (flow) => {
      flow.interruptionPolicy = {
        mayInterrupt: true,
        mayBeInterrupted: true,
        preemptionScope: "all_non_emergency",
      };
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_SAFETY_POLICY_INVALID");
  });
  it("rejects a guaranteed-safe scam outcome", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, scamAssessmentFlowFixture.flowId, (flow) => {
      flow.outcomes[0].outcomeId = "trust.scam_assessment.guaranteed_safe";
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TRUST_POLICY_INVALID");
  });
});

describe("channels and Task 1 triggers", () => {
  it("accepts the push engagement Flow", () => {
    expect(parseFlowCatalogue(VYVA_FLOW_CATALOGUE).flows)
      .toContainEqual(pushNotificationFlowFixture);
  });
  it("rejects push without its capability", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, pushNotificationFlowFixture.flowId, (flow) => {
      flow.capabilityIds = [];
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TRIGGER_POLICY_INVALID");
  });
  it("accepts the outbound-call engagement Flow", () => {
    expect(parseFlowCatalogue(VYVA_FLOW_CATALOGUE).flows)
      .toContainEqual(outboundCallFlowFixture);
  });
  it("rejects outbound call without telephone support", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, outboundCallFlowFixture.flowId, (flow) => {
      flow.supportedChannels = ["pwa"];
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TRIGGER_POLICY_INVALID");
  });
  it.each([
    "user", "push", "outbound_call", "caregiver", "operator", "schedule", "system",
  ] as const)("reuses canonical Task 1 trigger %s", (trigger) => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].supportedTriggers = [trigger];
    if (trigger === "push") {
      catalogue.flows[0].supportedChannels = ["pwa"];
      catalogue.flows[0].capabilityIds = ["capability.communication.push"];
      catalogue.flows[0].consentRequirements = [{
        scope: "proactive_push", timing: "before_entry",
        revocable: true, reusable: true, purposeSpecific: true,
      }];
    }
    if (trigger === "outbound_call") {
      catalogue.flows[0].supportedChannels = ["telephone"];
      catalogue.flows[0].capabilityIds = ["capability.communication.outbound_call"];
      catalogue.flows[0].consentRequirements = [{
        scope: "outbound_call", timing: "before_entry",
        revocable: true, reusable: true, purposeSpecific: true,
      }];
    }
    expect(parseFlowCatalogue(catalogue).flows[0].supportedTriggers).toEqual([trigger]);
  });
  it.each(["voice", "ui", "flow", "safety", "tool", "proactive"])(
    "rejects noncanonical trigger %s",
    (trigger) => {
      const catalogue = clone(VYVA_FLOW_CATALOGUE) as unknown as {
        flows: Array<Record<string, unknown>>;
      };
      catalogue.flows[0].supportedTriggers = [trigger];
      expectCode(() => parseFlowCatalogue(catalogue), "FLOW_CATALOGUE_INVALID");
    },
  );
  it("accepts an arbitrary future push-triggered Flow with declared policy", () => {
    const catalogue = clone(futureCatalogueFixture);
    mutateFlow(catalogue, futureFlowFixture.flowId, (flow) => {
      flow.supportedTriggers = ["push"];
      flow.supportedChannels = ["pwa"];
      flow.capabilityIds = ["capability.communication.push"];
      flow.consentRequirements = [{
        scope: "proactive_push", timing: "before_entry",
        revocable: true, reusable: true, purposeSpecific: true,
      }];
    });
    expect(parseFlowCatalogue(catalogue).flows).toHaveLength(requiredFlowIds.length + 1);
  });
  it.each([
    ["capability", (flow: FlowCatalogue["flows"][number]) => {
      flow.capabilityIds = [];
    }],
    ["Channel", (flow: FlowCatalogue["flows"][number]) => {
      flow.supportedChannels = ["text"];
    }],
  ] as const)("rejects a future push Flow without its %s", (_name, alter) => {
    const catalogue = clone(futureCatalogueFixture);
    mutateFlow(catalogue, futureFlowFixture.flowId, (flow) => {
      flow.supportedTriggers = ["push"];
      flow.supportedChannels = ["pwa"];
      flow.capabilityIds = ["capability.communication.push"];
      flow.consentRequirements = [{
        scope: "proactive_push", timing: "before_entry",
        revocable: true, reusable: true, purposeSpecific: true,
      }];
      alter(flow);
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TRIGGER_POLICY_INVALID");
  });
  it("accepts an arbitrary future outbound-call Flow with declared policy", () => {
    const catalogue = clone(futureCatalogueFixture);
    mutateFlow(catalogue, futureFlowFixture.flowId, (flow) => {
      flow.supportedTriggers = ["outbound_call"];
      flow.supportedChannels = ["telephone"];
      flow.capabilityIds = ["capability.communication.outbound_call"];
      flow.consentRequirements = [{
        scope: "outbound_call", timing: "before_entry",
        revocable: true, reusable: true, purposeSpecific: true,
      }];
    });
    expect(parseFlowCatalogue(catalogue).flows).toHaveLength(requiredFlowIds.length + 1);
  });
  it.each([
    ["capability", (flow: FlowCatalogue["flows"][number]) => {
      flow.capabilityIds = [];
    }],
    ["Channel", (flow: FlowCatalogue["flows"][number]) => {
      flow.supportedChannels = ["pwa"];
    }],
  ] as const)("rejects a future outbound Flow without its %s", (_name, alter) => {
    const catalogue = clone(futureCatalogueFixture);
    mutateFlow(catalogue, futureFlowFixture.flowId, (flow) => {
      flow.supportedTriggers = ["outbound_call"];
      flow.supportedChannels = ["telephone"];
      flow.capabilityIds = ["capability.communication.outbound_call"];
      flow.consentRequirements = [{
        scope: "outbound_call", timing: "before_entry",
        revocable: true, reusable: true, purposeSpecific: true,
      }];
      alter(flow);
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TRIGGER_POLICY_INVALID");
  });
  it("keeps preventive Health communication declarations internally consistent", () => {
    const preventive = VYVA_FLOW_CATALOGUE.flows.find(
      (flow) => flow.flowId === "health.preventive_check",
    )!;
    expect(preventive).toMatchObject({
      supportedTriggers: expect.arrayContaining(["push", "outbound_call"]),
      supportedChannels: expect.arrayContaining(["pwa", "telephone"]),
      capabilityIds: expect.arrayContaining([
        "capability.communication.push",
        "capability.communication.outbound_call",
      ]),
    });
  });
  it("assigns caregiver initiation to every Caregiver Flow", () => {
    const flows = VYVA_FLOW_CATALOGUE.flows.filter(
      (flow) => flow.domain === "caregiver",
    );
    expect(flows.every((flow) => flow.supportedTriggers.includes("caregiver")))
      .toBe(true);
  });
  it("assigns operator initiation to every Operator Flow", () => {
    const flows = VYVA_FLOW_CATALOGUE.flows.filter(
      (flow) => flow.domain === "operator",
    );
    expect(flows.every((flow) => flow.supportedTriggers.includes("operator")))
      .toBe(true);
  });
  it.each([
    ["caregiver.request_checkin", "caregiver"],
    ["operator.review_escalation", "operator"],
  ] as const)("rejects user-only initiation for %s", (flowId, _trigger) => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, flowId, (flow) => {
      flow.supportedTriggers = ["user"];
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TRIGGER_POLICY_INVALID");
  });
});

describe("extensibility and implementation isolation", () => {
  it("accepts a future Flow without a schema change", () => {
    expect(parseFlowCatalogue(futureCatalogueFixture).flows)
      .toContainEqual(futureFlowFixture);
  });
  it("accepts a future provider-neutral capability", () => {
    expect(parseFlowCatalogue(futureCatalogueFixture).capabilities)
      .toContainEqual(futureCapabilityFixture);
  });
  it.each(["providerInstance", "reactComponent"])(
    "rejects implementation field %s",
    (key) => {
      const catalogue = clone(VYVA_FLOW_CATALOGUE);
      catalogue.flows[0].metadata = { [key]: "implementation-detail" };
      expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
    },
  );
  it("rejects executable callbacks", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = { callback: () => undefined };
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it("rejects non-enumerable metadata values", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    Object.defineProperty(catalogue.flows[0].metadata, "hidden", {
      value: undefined,
      enumerable: false,
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it("returns a typed error for malformed catalogue collections", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE) as unknown as {
      flows: unknown;
    };
    catalogue.flows = {};
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_CATALOGUE_INVALID");
  });
  it("accepts safe bounded future metadata", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = {
      futurePolicy: { enabled: true, score: 0.5, labels: ["one", "two"], note: null },
    };
    expect(parseFlowCatalogue(catalogue).flows[0].metadata).toBeDefined();
  });
  it("rejects excessively deep metadata", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = {
      a: { b: { c: { d: { e: { f: true } } } } },
    };
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it("rejects excessive metadata keys", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [`key${index}`, index]),
    );
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it("rejects excessive serialized metadata", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = { text: "x".repeat(17_000) };
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it("rejects cyclic metadata", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    catalogue.flows[0].metadata = cyclic as never;
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it.each([
    ["Date", new Date()],
    ["Map", new Map([["key", "value"]])],
    ["Set", new Set(["value"])],
  ])("rejects %s metadata", (_name, value) => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = { value } as never;
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it("rejects custom class instances", () => {
    class ProviderClientFixture {
      readonly name = "fixture";
    }
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = { client: new ProviderClientFixture() } as never;
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it.each(["apiKey", "credentials", "access_token", "privateKey"])(
    "rejects credential metadata key %s",
    (key) => {
      const catalogue = clone(VYVA_FLOW_CATALOGUE);
      catalogue.flows[0].metadata = { [key]: "fixture-secret" };
      expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
    },
  );
  it("rejects nested credentials", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = { nested: { client_secret: "fixture" } };
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
  it("rejects provider-client fields", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].metadata = { providerClient: { name: "fixture" } };
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_METADATA_INVALID");
  });
});

describe("Trust outcomes and local collection invariants", () => {
  it.each([
    "likely_scam", "suspicious", "insufficient_evidence", "no_obvious_indicators",
  ] as const)("accepts Trust classification %s", (classification) => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, "trust.scam_assessment", (flow) => {
      flow.outcomes = flow.outcomes.filter(
        (outcome) => outcome.category === classification,
      );
    });
    expect(parseFlowCatalogue(catalogue).flows).toHaveLength(requiredFlowIds.length);
  });
  it.each(["safe", "verified_safe", "cleared"])(
    "rejects Trust safe alias %s",
    (alias) => {
      const catalogue = clone(VYVA_FLOW_CATALOGUE);
      mutateFlow(catalogue, "trust.scam_assessment", (flow) => {
        flow.outcomes[0].outcomeId = `trust.scam_assessment.${alias}`;
      });
      expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TRUST_POLICY_INVALID");
    },
  );
  it("rejects guaranteed-safe Trust descriptions", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    mutateFlow(catalogue, "trust.scam_assessment", (flow) => {
      flow.outcomes[0].description = "This is guaranteed safe.";
    });
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TRUST_POLICY_INVALID");
  });
  it("rejects duplicate scene IDs", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].uiScenes.push(clone(catalogue.flows[0].uiScenes[0]));
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_COLLECTION_INVALID");
  });
  it("rejects duplicate outcome IDs", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].outcomes.push(clone(catalogue.flows[0].outcomes[0]));
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_COLLECTION_INVALID");
  });
  it("rejects terminal outcome continuation", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].outcomes[0].allowedNextFlowIds = ["safety.safety_followup"];
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_OUTCOME_POLICY_INVALID");
  });
  it("accepts a nonterminal outcome with a resolved next Flow", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].outcomes[0].terminal = false;
    catalogue.flows[0].outcomes[0].allowedNextFlowIds = ["safety.safety_followup"];
    expect(parseFlowCatalogue(catalogue).flows).toHaveLength(requiredFlowIds.length);
  });
  it("accepts disjoint required and optional Tool sets", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].requiredTools = ["tool.required"];
    catalogue.flows[0].optionalTools = ["tool.optional"];
    expect(parseFlowCatalogue(catalogue).flows).toHaveLength(requiredFlowIds.length);
  });
  it.each(["required", "optional"] as const)(
    "rejects duplicate %s Tools",
    (list) => {
      const catalogue = clone(VYVA_FLOW_CATALOGUE);
      const key = list === "required" ? "requiredTools" : "optionalTools";
      catalogue.flows[0][key] = ["tool.duplicate", "tool.duplicate"];
      expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TOOL_POLICY_INVALID");
    },
  );
  it("rejects overlap between required and optional Tools", () => {
    const catalogue = clone(VYVA_FLOW_CATALOGUE);
    catalogue.flows[0].requiredTools = ["tool.shared"];
    catalogue.flows[0].optionalTools = ["tool.shared"];
    expectCode(() => parseFlowCatalogue(catalogue), "FLOW_TOOL_POLICY_INVALID");
  });
});

describe("canonical catalogue completeness", () => {
  it("contains every required initial Flow ID exactly once", () => {
    const ids = VYVA_FLOW_CATALOGUE.flows.map((flow) => flow.flowId);
    expect(new Set(ids)).toEqual(new Set(requiredFlowIds));
    expect(ids).toHaveLength(requiredFlowIds.length);
  });
  it("contains every required capability ID exactly once", () => {
    const ids = VYVA_FLOW_CATALOGUE.capabilities.map((item) => item.capabilityId);
    expect(new Set(ids)).toEqual(new Set(requiredCapabilityIds));
    expect(ids).toHaveLength(requiredCapabilityIds.length);
  });
  it("resolves every reference", () => {
    expect(() => parseFlowCatalogue(VYVA_FLOW_CATALOGUE)).not.toThrow();
  });
  it("gives every pilot or active Flow an owner", () => {
    const selectable = VYVA_FLOW_CATALOGUE.flows.filter(
      (flow) => flow.status === "pilot" || flow.status === "active",
    );
    expect(selectable.every((flow) => Boolean(flow.ownerSpecialistId))).toBe(true);
  });
  it("gives every visual Flow safety, consent, and evidence policies", () => {
    const visual = VYVA_FLOW_CATALOGUE.flows.filter(
      (flow) => flow.flowId.startsWith("health.visual."),
    );
    expect(visual.every(
      (flow) =>
        flow.deterministicSafetyChecks.length > 0 &&
        flow.consentRequirements.length > 0 &&
        flow.evidenceRequirements.length > 0,
    )).toBe(true);
  });
  it("prohibits guaranteed-safe outcomes for all Trust Flows", () => {
    const trust = VYVA_FLOW_CATALOGUE.flows.filter(
      (flow) => flow.flowId.startsWith("trust."),
    );
    expect(trust.every(
      (flow) => flow.metadata.prohibitsGuaranteedSafeVerdict === true,
    )).toBe(true);
  });
  it("gives every push-triggered Flow compatible policy", () => {
    const flows = VYVA_FLOW_CATALOGUE.flows.filter(
      (flow) => flow.supportedTriggers.includes("push"),
    );
    expect(flows.every(
      (flow) =>
        flow.supportedChannels.includes("pwa") &&
        flow.capabilityIds.includes("capability.communication.push"),
    )).toBe(true);
  });
  it("gives every outbound-triggered Flow compatible policy", () => {
    const flows = VYVA_FLOW_CATALOGUE.flows.filter(
      (flow) => flow.supportedTriggers.includes("outbound_call"),
    );
    expect(flows.every(
      (flow) =>
        flow.supportedChannels.includes("telephone") &&
        flow.capabilityIds.includes("capability.communication.outbound_call"),
    )).toBe(true);
  });
  it("keeps all local scene and outcome IDs unique", () => {
    expect(VYVA_FLOW_CATALOGUE.flows.every(
      (flow) =>
        new Set(flow.uiScenes.map((scene) => scene.sceneId)).size === flow.uiScenes.length &&
        new Set(flow.outcomes.map((outcome) => outcome.outcomeId)).size === flow.outcomes.length,
    )).toBe(true);
  });
  it("keeps terminal outcomes and Tool sets consistent", () => {
    expect(VYVA_FLOW_CATALOGUE.flows.every(
      (flow) =>
        flow.outcomes.every(
          (outcome) => !outcome.terminal || outcome.allowedNextFlowIds.length === 0,
        ) &&
        flow.requiredTools.every((tool) => !flow.optionalTools.includes(tool)),
    )).toBe(true);
  });
});
