import { describe, expect, it, vi } from "vitest";
import {
  PROFILE_ONBOARDING_AGENT_SECTION_IDS,
  createProfileOnboardingAgentSectionConfig,
} from "@/components/onboarding/profileOnboardingAgentSections";
import {
  adaptOnboardingElevenLabsOutput,
  createOnboardingElevenLabsRuntimeStartRequest,
  dispatchOnboardingElevenLabsOutput,
  subscribeOnboardingElevenLabsRuntimeEvents,
  VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT,
} from "./onboardingElevenLabsRuntimeAdapter";
import { classifyOnboardingAgentEffect } from "./onboardingElevenLabsAgentContract";

const healthSection = createProfileOnboardingAgentSectionConfig({
  sectionId: "health",
  sectionLabel: "Health profile",
  voicePrompt: "Tell VYVA one or more health conditions.",
  expectedFields: ["conditions", "mobility", "living_situation"],
});

const safeDraftOutput = {
  eventType: "draft",
  sectionId: "health",
  lifecycle: "parsed-draft",
  draft: {
    kind: "health-conditions",
    title: "Review health conditions",
    helper: "Add these only if they look right.",
    rows: [
      { id: "diabetes", label: "Condition", value: "Diabetes Type 2" },
      { id: "hypertension", label: "Condition", value: "Hypertension" },
    ],
    values: ["Diabetes Type 2", "Hypertension"],
    metadata: { source: "structured-output" },
  },
  safety: {
    localOnly: true,
    requiresReview: true,
    requiresExplicitSave: true,
    mayTriggerExternalAction: false,
  },
} as const;

describe("onboarding ElevenLabs runtime adapter", () => {
  it("builds a slug-based start request with active section context and schemas", () => {
    const request = createOnboardingElevenLabsRuntimeStartRequest({
      sectionConfig: healthSection,
      language: "es",
      mode: "voice",
      existingProfileSummary: "Current health conditions selected in app: Hypertension",
    });

    expect(request.contextHint).toBe("Tell VYVA one or more health conditions.");
    expect(request.systemPrompt).toContain("VYVA Onboarding Profile Agent");
    expect(request.options.agentSlug).toBe("onboarding-profile");
    expect(request.options.autoStartListening).toBe(true);
    expect(request.options.dynamicVariables).toMatchObject({
      agent_contract_id: "vyva_onboarding_profile",
      conversation_plan_id: "onboarding_profile_collection_v1",
      agent_domain: "onboarding_profile",
      user_id: "app-managed-profile",
      account_id: "app-managed",
      profile_id: "app-managed",
      active_section_id: "health",
      active_section_label: "Health profile",
      active_section_review_required: true,
      active_section_explicit_save_required: true,
      language: "es",
      onboarding_mode: "voice",
      app_entrypoint: "onboarding-profile",
    });
    expect(String(request.options.dynamicVariables.active_section_schema_json)).toContain("\"sectionId\":\"health\"");
    expect(String(request.options.dynamicVariables.onboarding_output_schema_json)).toContain("\"eventType\"");
    expect(request.systemPrompt).toContain("Never ask the user for account ID");
  });

  it.each(PROFILE_ONBOARDING_AGENT_SECTION_IDS)(
    "builds a safe local-review runtime request for the %s section",
    (sectionId) => {
      const section = createProfileOnboardingAgentSectionConfig({
        sectionId,
        sectionLabel: `${sectionId} label`,
        voicePrompt: `Tell VYVA about ${sectionId}.`,
        expectedFields: [`${sectionId}_field`],
      });

      const request = createOnboardingElevenLabsRuntimeStartRequest({
        sectionConfig: section,
        language: "en",
        mode: "voice",
        activeDraftId: `${sectionId}:draft`,
      });

      expect(request.options.agentSlug).toBe("onboarding-profile");
      expect(request.options.dynamicVariables).toMatchObject({
        active_section_id: sectionId,
        active_section_label: `${sectionId} label`,
        active_section_review_required: true,
        active_section_explicit_save_required: true,
        onboarding_mode: "voice",
      });
      expect(String(request.options.dynamicVariables.active_section_schema_json)).toContain(
        `"sectionId":"${sectionId}"`,
      );
      const agentContract = JSON.parse(
        String(request.options.dynamicVariables.onboarding_agent_contract_json),
      ) as { safetyRules: string[] };
      expect(agentContract.safetyRules).toEqual(
        expect.arrayContaining([
          "Return structured local drafts only; never save profile data.",
          "The app may persist a section only after the user presses the section Save control.",
        ]),
      );
    },
  );

  it("converts safe structured draft output into a local profile review draft", () => {
    const result = adaptOnboardingElevenLabsOutput({ output: JSON.stringify(safeDraftOutput) });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.event).toMatchObject({
      type: "draft",
      sectionId: "health",
      draft: {
        section: "health",
        kind: "health-conditions",
        title: "Review health conditions",
        values: ["Diabetes Type 2", "Hypertension"],
      },
    });

    const effect = classifyOnboardingAgentEffect({
      source: "elevenlabs-agent",
      output: result.event.output,
    });
    expect(effect.mayPersistProfileData).toBe(false);
    expect(effect.mayTriggerExternalAction).toBe(false);
  });

  it("rejects unsafe output that attempts to save or trigger an external action", () => {
    const result = adaptOnboardingElevenLabsOutput({
      ...safeDraftOutput,
      save: true,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "Output includes forbidden external action key: save.",
    });
  });

  it("dispatches only validated local runtime events to matching section subscribers", () => {
    const handler = vi.fn();
    const unrelatedHandler = vi.fn();
    const unsubscribe = subscribeOnboardingElevenLabsRuntimeEvents("health", handler);
    const unsubscribeUnrelated = subscribeOnboardingElevenLabsRuntimeEvents("address", unrelatedHandler);

    const rejected = dispatchOnboardingElevenLabsOutput({
      eventType: "draft",
      sectionId: "health",
      lifecycle: "saved",
      draft: safeDraftOutput.draft,
      safety: safeDraftOutput.safety,
    });
    expect(rejected.ok).toBe(false);

    const dispatched = dispatchOnboardingElevenLabsOutput(safeDraftOutput);

    expect(dispatched.ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      type: "draft",
      sectionId: "health",
    });
    expect(unrelatedHandler).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent(VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT, { detail: { sectionId: "address" } }));
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    unsubscribeUnrelated();
  });
});
