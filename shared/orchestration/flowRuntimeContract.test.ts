import { describe, expect, it } from "vitest";
import { VYVA_FLOW_CATALOGUE } from "./flowCatalogue";
import { VYVA_PRESENTATION_REGISTRY } from "./presentationRegistry";
import {
  CANONICAL_FLOW_RUNTIME_CONTRACT,
  FLOW_RUNTIME_INTERRUPTION_KINDS,
  FLOW_RUNTIME_LIFECYCLE_STATES,
  FLOW_RUNTIME_PRESENTATION_PATTERNS,
  assertFlowRuntimePresentationContract,
  defineFlowRuntimePresentationContract,
  getFlowRuntimePresentationContractIssues,
  parseCanonicalFlowRuntimeContract,
  parseFlowRuntimeAlignmentRecord,
  parseParallelFlowTaskContract,
} from "./flowRuntimeContract";

const preventiveFlow = VYVA_FLOW_CATALOGUE.flows.find(
  (flow) => flow.flowId === "health.preventive_check",
);
const preventivePresentation = VYVA_PRESENTATION_REGISTRY.presentations.find(
  (presentation) =>
    presentation.presentationId === "presentation.health.preventive.yes_no",
);

if (!preventiveFlow || !preventivePresentation) {
  throw new Error("Task 20 tests require the preventive Health flow and presentation");
}

function validPresentationContract() {
  return defineFlowRuntimePresentationContract({
    flowId: preventiveFlow.flowId,
    flowVersion: preventiveFlow.version,
    ownerSpecialistId: preventiveFlow.ownerSpecialistId,
    lifecycle: {
      start: "initializing",
      terminal: ["completed", "cancelled", "failed"],
      resumable: ["paused", "resuming"],
    },
    state: [
      {
        key: "currentQuestionId",
        scope: "persisted",
        purpose: "Reject stale answers and restore the active question.",
        required: true,
      },
      {
        key: "voiceOrbStatus",
        scope: "transient",
        purpose: "Render current voice-channel activity without becoming Flow truth.",
        required: false,
      },
    ],
    presentation: [
      {
        presentationId: preventivePresentation.presentationId,
        sceneId: preventivePresentation.sceneId,
        pattern: "guided_choice",
        modes: ["voice", "touch", "text"],
        mobileCopy: "brief_helper",
        largerScreenCopy: "full",
      },
      {
        presentationId: "presentation.health.preventive.introduction",
        sceneId: "health.preventive_check.main",
        pattern: "voice_orb_listening",
        modes: ["voice"],
        mobileCopy: "heading_only",
        largerScreenCopy: "brief_helper",
      },
    ],
    tools: {
      canExecuteExternalActions: false,
      allowedToolIds: [],
      requiresConfirmationBeforeExternalAction: false,
    },
    approvalGate: "none",
    interruptionKinds: ["sos", "safety", "stop", "mode_switch"],
    notes: "Presentation bindings are subordinate to the Central Orchestrator runtime contract.",
  });
}

describe("Task 20 canonical Flow runtime contract", () => {
  it("accepts the canonical lifecycle and Central Orchestrator authority policy", () => {
    const parsed = parseCanonicalFlowRuntimeContract(CANONICAL_FLOW_RUNTIME_CONTRACT);

    expect(parsed.runtimeActivation).toBe("not_approved");
    expect(parsed.lifecycleStates).toEqual(FLOW_RUNTIME_LIFECYCLE_STATES);
    expect(parsed.authority.activeFlowAuthority).toBe("central_orchestrator");
    expect(parsed.authority.specialistAuthority).toBe("proposal_only");
    expect(parsed.presentationAttachment.frontendRole).toBe("render_only");
  });

  it("rejects tampering with the idle Task 20 to Task 1 lifecycle mapping", () => {
    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        task1StateMapping: {
          ...CANONICAL_FLOW_RUNTIME_CONTRACT.task1StateMapping,
          idle: ["active"],
        },
      }),
    ).toThrow(/idle/);
  });

  it("rejects other changed Task 20 to Task 1 lifecycle mappings", () => {
    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        task1StateMapping: {
          ...CANONICAL_FLOW_RUNTIME_CONTRACT.task1StateMapping,
          confirming: ["waiting_for_user", "active"],
        },
      }),
    ).toThrow(/confirming/);
  });

  it("rejects missing and extra target states inside lifecycle mapping entries", () => {
    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        task1StateMapping: {
          ...CANONICAL_FLOW_RUNTIME_CONTRACT.task1StateMapping,
          active: ["initializing", "active"],
        },
      }),
    ).toThrow(/active/);

    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        task1StateMapping: {
          ...CANONICAL_FLOW_RUNTIME_CONTRACT.task1StateMapping,
          idle: ["idle", "active"],
        },
      }),
    ).toThrow(/idle/);
  });

  it("rejects missing and extra lifecycle mapping entries", () => {
    const missingActiveMapping = {
      ...CANONICAL_FLOW_RUNTIME_CONTRACT.task1StateMapping,
    };
    delete (missingActiveMapping as Record<string, unknown>).active;

    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        task1StateMapping: missingActiveMapping,
      }),
    ).toThrow();

    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        task1StateMapping: {
          ...CANONICAL_FLOW_RUNTIME_CONTRACT.task1StateMapping,
          finished: ["completed"],
        },
      }),
    ).toThrow();
  });

  it("rejects competing lifecycle vocabulary", () => {
    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        lifecycleStates: ["idle", "listening", "answered"],
      }),
    ).toThrow();
  });

  it("rejects client or channel authority over the active Flow", () => {
    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        authority: {
          ...CANONICAL_FLOW_RUNTIME_CONTRACT.authority,
          activeFlowAuthority: "channel_adapter",
        },
      }),
    ).toThrow();
  });

  it("rejects modality-specific answer semantics", () => {
    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        modality: {
          ...CANONICAL_FLOW_RUNTIME_CONTRACT.modality,
          answerSemantics: "voice_specific",
        },
      }),
    ).toThrow();
  });

  it("requires voice, touch and text in the normalized modality policy", () => {
    expect(() =>
      parseCanonicalFlowRuntimeContract({
        ...CANONICAL_FLOW_RUNTIME_CONTRACT,
        modality: {
          ...CANONICAL_FLOW_RUNTIME_CONTRACT.modality,
          supportedModalities: ["voice", "touch"],
        },
      }),
    ).toThrow();
  });
});

describe("Task 20 presentation-binding compatibility from PR #1043", () => {
  it("accepts a per-flow presentation contract binding Flow state to registry scenes", () => {
    const contract = validPresentationContract();

    expect(assertFlowRuntimePresentationContract(contract)).toBe(contract);
    expect(contract.flowId).toBe(preventiveFlow.flowId);
    expect(contract.presentation[0]?.presentationId).toBe(
      preventivePresentation.presentationId,
    );
  });

  it("keeps locked voice, touch and result presentation patterns available", () => {
    expect(FLOW_RUNTIME_PRESENTATION_PATTERNS).toContain("voice_orb_listening");
    expect(FLOW_RUNTIME_PRESENTATION_PATTERNS).toContain("touch_card_menu");
    expect(FLOW_RUNTIME_PRESENTATION_PATTERNS).toContain("result_summary");
    expect(FLOW_RUNTIME_INTERRUPTION_KINDS).toEqual(
      expect.arrayContaining(["sos", "safety", "mode_switch"]),
    );
  });

  it("rejects duplicate runtime state fields", () => {
    const contract = {
      ...validPresentationContract(),
      state: [
        ...validPresentationContract().state,
        {
          key: "currentQuestionId",
          scope: "persisted" as const,
          purpose: "Duplicate stale-scene field.",
          required: true,
        },
      ],
    };

    expect(getFlowRuntimePresentationContractIssues(contract)).toContain(
      "duplicate runtime state field keys",
    );
    expect(() => assertFlowRuntimePresentationContract(contract)).toThrow(
      /duplicate runtime state field keys/,
    );
  });

  it("requires confirmation and an approval gate before external actions", () => {
    const contract = {
      ...validPresentationContract(),
      tools: {
        canExecuteExternalActions: true,
        allowedToolIds: ["tool.health.followup"],
        requiresConfirmationBeforeExternalAction: false,
      },
      approvalGate: "none" as const,
    };

    expect(getFlowRuntimePresentationContractIssues(contract)).toEqual(
      expect.arrayContaining([
        "external actions require confirmation before execution",
        "external actions require an approval gate",
      ]),
    );
  });
});

describe("Task 20 alignment records and future Flow task handoff", () => {
  it("accepts a Health alignment record tied to catalogue and presentation data", () => {
    const parsed = parseFlowRuntimeAlignmentRecord({
      flowName: preventiveFlow.displayName,
      flowId: preventiveFlow.flowId,
      flowVersion: preventiveFlow.version,
      owner: preventiveFlow.ownerSpecialistId,
      voiceBehavior: "Voice answers normalize into the authoritative preventive Flow.",
      touchBehavior: "Touch answers normalize into the same authoritative preventive Flow.",
      presentationIds: [preventivePresentation.presentationId],
      persistedState: "implemented",
      temporaryState: "ui_only",
      toolPermissions: "authorized",
      confirmationGates: ["none"],
      interruptions: ["sos", "safety", "mode_switch"],
      terminalStates: ["complete", "error"],
      classification: "ALIGNED",
    });

    expect(parsed.flowId).toBe(preventiveFlow.flowId);
    expect(parsed.presentationIds).toEqual([preventivePresentation.presentationId]);
  });

  it("rejects duplicate presentation references in alignment records", () => {
    expect(() =>
      parseFlowRuntimeAlignmentRecord({
        flowName: preventiveFlow.displayName,
        flowId: preventiveFlow.flowId,
        flowVersion: preventiveFlow.version,
        owner: preventiveFlow.ownerSpecialistId,
        voiceBehavior: "Voice behavior.",
        touchBehavior: "Touch behavior.",
        presentationIds: [
          preventivePresentation.presentationId,
          preventivePresentation.presentationId,
        ],
        persistedState: "documented",
        temporaryState: "ui_only",
        toolPermissions: "none",
        confirmationGates: ["none"],
        interruptions: ["sos"],
        terminalStates: ["complete"],
        classification: "DOC GAP",
      }),
    ).toThrow();
  });

  it("accepts future parallel Flow task metadata only when runtime activation is not approved", () => {
    const parsed = parseParallelFlowTaskContract({
      flowName: "Medication refill help",
      flowId: "medication.refill_request",
      flowVersion: "1.0.0",
      owner: "medication",
      voiceBehavior: "Voice gathers refill intent through the Central Orchestrator.",
      touchBehavior: "Touch presents the same refill intent through cards.",
      presentationIds: ["presentation.medication.refill.start"],
      persistedState: "Medication domain state only after explicit runtime approval.",
      temporaryState: "UI-only loading and card focus.",
      toolPermissions: "Proposal-only until Orchestrator authorization is approved.",
      confirmationGates: ["user_confirmation"],
      interruptions: ["sos", "safety", "stop"],
      terminalStates: ["complete", "error"],
      runtimeActivation: "not_approved",
    });

    expect(parsed.runtimeActivation).toBe("not_approved");
  });

  it("rejects future Flow tasks claiming runtime activation approval", () => {
    expect(() =>
      parseParallelFlowTaskContract({
        flowName: "Medication refill help",
        flowId: "medication.refill_request",
        flowVersion: "1.0.0",
        owner: "medication",
        voiceBehavior: "Voice behavior.",
        touchBehavior: "Touch behavior.",
        presentationIds: ["presentation.medication.refill.start"],
        persistedState: "Persisted state.",
        temporaryState: "Temporary state.",
        toolPermissions: "Tool permissions.",
        confirmationGates: ["user_confirmation"],
        interruptions: ["sos"],
        terminalStates: ["complete"],
        runtimeActivation: "approved",
      }),
    ).toThrow();
  });
});
