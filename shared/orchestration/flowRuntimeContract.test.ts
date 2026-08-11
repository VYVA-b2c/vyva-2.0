import { describe, expect, it } from "vitest";
import {
  FLOW_RUNTIME_PRESENTATION_PATTERNS,
  assertFlowRuntimeContract,
  defineFlowRuntimeContract,
  getFlowRuntimeContractIssues,
} from "./flowRuntimeContract";

const validContract = defineFlowRuntimeContract({
  flowId: "concierge.administrative_support",
  flowVersion: "1.0.0",
  ownerSpecialistId: "concierge",
  lifecycle: {
    start: "idle",
    terminal: ["completed", "cancelled", "failed"],
    resumable: ["paused", "interrupted", "failed"],
  },
  state: [
    {
      key: "request.goal",
      scope: "persisted",
      purpose: "Keeps the user's practical help request resumable.",
      required: true,
    },
    {
      key: "voice.status",
      scope: "transient",
      purpose: "Tracks whether the current session is connecting, listening, speaking, or ending.",
      required: false,
    },
  ],
  presentation: [
    {
      presentationId: "presentation.concierge.request_intake",
      sceneId: "concierge.administrative_support.main",
      pattern: "voice_orb_idle",
      modes: ["voice"],
      mobileCopy: "heading_only",
      largerScreenCopy: "brief_helper",
    },
    {
      presentationId: "presentation.concierge.trusted_help_setup",
      sceneId: "concierge.administrative_support.main",
      pattern: "guided_choice",
      modes: ["touch", "text"],
      mobileCopy: "heading_only",
      largerScreenCopy: "brief_helper",
    },
  ],
  approvalGates: ["user_confirmation", "caregiver_approval"],
  toolBoundary: {
    canExecuteExternalActions: true,
    allowedToolIds: ["trusted_provider_search"],
    requiresConfirmationBeforeExternalAction: true,
  },
  interruptionPolicy: {
    supported: ["sos", "caregiver", "stop", "mode_switch"],
    resumesAfterInterruption: true,
    terminalInterruptions: ["sos", "stop"],
  },
});

describe("flow runtime contract", () => {
  it("accepts a runtime contract that binds flow state to presentations", () => {
    expect(assertFlowRuntimeContract(validContract)).toBe(validContract);
    expect(getFlowRuntimeContractIssues(validContract)).toEqual([]);
  });

  it("keeps locked voice and touch presentation patterns available", () => {
    expect(FLOW_RUNTIME_PRESENTATION_PATTERNS).toEqual(expect.arrayContaining([
      "voice_orb_idle",
      "voice_orb_listening",
      "voice_orb_speaking",
      "touch_card_menu",
      "guided_choice",
      "result_summary",
      "safe_fallback",
    ]));
  });

  it("rejects duplicate runtime state fields", () => {
    const issues = getFlowRuntimeContractIssues({
      ...validContract,
      state: [
        ...validContract.state,
        {
          key: "request.goal",
          scope: "transient",
          purpose: "Duplicate test field.",
          required: false,
        },
      ],
    });

    expect(issues).toContain("concierge.administrative_support: duplicate state field request.goal");
  });

  it("requires confirmation before external actions", () => {
    const issues = getFlowRuntimeContractIssues({
      ...validContract,
      approvalGates: ["none"],
      toolBoundary: {
        ...validContract.toolBoundary,
        requiresConfirmationBeforeExternalAction: false,
      },
    });

    expect(issues).toEqual(expect.arrayContaining([
      "concierge.administrative_support: external actions require confirmation",
      "concierge.administrative_support: external actions need an approval gate",
    ]));
  });
});
