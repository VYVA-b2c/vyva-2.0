import { describe, expect, it } from "vitest";
import { createProfileOnboardingAgentSectionConfig } from "@/components/onboarding/profileOnboardingAgentSections";
import {
  buildOnboardingElevenLabsSystemPrompt,
  classifyOnboardingAgentEffect,
  createOnboardingElevenLabsSessionContext,
  ONBOARDING_ELEVENLABS_AGENT_CONTRACT,
  onboardingElevenLabsSchemaForSection,
  onboardingElevenLabsSectionSchemas,
  validateOnboardingElevenLabsOutput,
  type OnboardingElevenLabsAgentOutput,
} from "./onboardingElevenLabsAgentContract";

const localOnlySafety = {
  localOnly: true,
  requiresReview: true,
  requiresExplicitSave: true,
  mayTriggerExternalAction: false,
} as const;

describe("ElevenLabs onboarding agent contract", () => {
  it("defines schema coverage for every supported onboarding profile section", () => {
    const schemas = onboardingElevenLabsSectionSchemas();

    expect(Object.keys(schemas).sort()).toEqual(
      [...ONBOARDING_ELEVENLABS_AGENT_CONTRACT.supportedSections].sort(),
    );

    for (const sectionId of ONBOARDING_ELEVENLABS_AGENT_CONTRACT.supportedSections) {
      const schema = onboardingElevenLabsSchemaForSection(sectionId);

      expect(schema.sectionId).toBe(sectionId);
      expect(schema.reviewRequired).toBe(true);
      expect(schema.explicitSaveRequired).toBe(true);
      expect(schema.voicePrompt.length).toBeGreaterThan(20);
      expect(schema.expectedFields.length).toBeGreaterThan(0);
      expect(schema.fields.length).toBeGreaterThan(0);
    }
  });

  it("builds active-section context for ElevenLabs without adding write authority", () => {
    const sectionConfig = createProfileOnboardingAgentSectionConfig({
      sectionId: "providers",
      sectionLabel: "Trusted providers",
      voicePrompt: "Tell VYVA a provider name, phone, email, or address.",
      expectedFields: ["name", "phone", "email", "address"],
      targetIds: {
        addByVoice: "providers-add-by-voice",
        draftReview: "providers-voice-draft",
        reviewSave: "providers-review-save",
      },
    });

    const context = createOnboardingElevenLabsSessionContext({
      sectionConfig,
      language: "es",
      mode: "voice",
      existingProfileSummary: "Profile has no saved trusted provider yet.",
      activeDraftId: "providers:zamora-clinic",
      uiState: {
        pagePath: "/onboarding/profile/providers",
        sectionId: "providers",
        sectionLabel: "Trusted providers",
        phase: "collecting",
        visibleTask: "Collect one provider for review.",
        missingFields: ["name"],
        reviewCardVisible: false,
        allowedActions: ["ask_question", "collect_draft", "show_local_review"],
        forbiddenActions: ["ask_account_id", "navigate_away", "save_without_button_press"],
        suggestedPrompt: "Ask for the provider name.",
        activeTargetId: "providers-add-by-voice",
      },
    });

    expect(context).toMatchObject({
      agent_contract_id: "vyva_onboarding_profile",
      conversation_plan_id: "onboarding_profile_collection_v1",
      agent_domain: "onboarding_profile",
      user_id: "app-managed-profile",
      account_id: "app-managed",
      profile_id: "app-managed",
      active_section_id: "providers",
      active_section_label: "Trusted providers",
      active_section_review_required: true,
      active_section_explicit_save_required: true,
      language: "es",
      onboarding_mode: "voice",
      active_draft_id: "providers:zamora-clinic",
      voice_ui_phase: "collecting",
      voice_ui_visible_task: "Collect one provider for review.",
      voice_ui_review_card_visible: false,
      voice_ui_missing_fields: "name",
      voice_ui_allowed_actions: "ask_question, collect_draft, show_local_review",
      voice_ui_forbidden_actions: "ask_account_id, navigate_away, save_without_button_press",
      voice_ui_suggested_prompt: "Ask for the provider name.",
    });
    expect(String(context.voice_ui_state_json)).toContain("\"sectionId\":\"providers\"");
    expect(String(context.voice_ui_state_json)).toContain("\"reviewCardVisible\":false");
    expect(JSON.stringify(context)).not.toMatch(/api|post|save-section|booking|call/i);
  });

  it("publishes a prompt that forbids saves and external actions", () => {
    const prompt = buildOnboardingElevenLabsSystemPrompt();

    expect(prompt).toContain("exactly one active onboarding profile section");
    expect(prompt).toContain("structured JSON");
    expect(prompt).toContain("must never save profile data");
    expect(prompt).toContain("call, message, book, navigate, pay");
    expect(prompt).toContain("Follow the app-provided voice_ui_state_json first");
    expect(prompt).toContain("visible review card must be checked");
    expect(prompt).toContain("Never ask the user for account ID");
    expect(prompt).toContain("Never tell the user to navigate to another app or page");
  });

  it("accepts local-only draft output with review rows", () => {
    const output: OnboardingElevenLabsAgentOutput = {
      eventType: "draft",
      sectionId: "basics",
      lifecycle: "parsed-draft",
      draft: {
        kind: "basics",
        rows: [
          { id: "fullName", label: "Full name", value: "Rosa Martin" },
          { id: "phoneLocal", label: "Phone", value: "+34 600 111 222" },
        ],
        metadata: {
          fullName: "Rosa Martin",
          phoneLocal: "+34 600 111 222",
        },
      },
      safety: localOnlySafety,
    };

    expect(validateOnboardingElevenLabsOutput(output)).toEqual({ ok: true, output });
  });

  it("rejects agent output that tries to save, post, navigate, or trigger an external action", () => {
    const unsafeOutputs = [
      {
        eventType: "draft",
        sectionId: "address",
        lifecycle: "parsed-draft",
        draft: { kind: "address", rows: [{ id: "city", label: "City", value: "Zamora" }] },
        safety: localOnlySafety,
        apiEndpoint: "/api/onboarding/section/address",
      },
      {
        eventType: "status",
        sectionId: "providers",
        lifecycle: "saved",
        voiceStatus: "thinking",
        safety: localOnlySafety,
      },
      {
        eventType: "draft",
        sectionId: "providers",
        lifecycle: "parsed-draft",
        draft: {
          kind: "provider",
          rows: [{ id: "name", label: "Provider", value: "Zamora Clinic" }],
          externalAction: { call: "+34 600 111 222" },
        },
        safety: localOnlySafety,
      },
      {
        eventType: "draft",
        sectionId: "emergency",
        lifecycle: "parsed-draft",
        draft: { kind: "emergency-contact", rows: [{ id: "name", label: "Full name", value: "Sara" }] },
        safety: {
          localOnly: false,
          requiresReview: false,
          requiresExplicitSave: false,
          mayTriggerExternalAction: true,
        },
      },
      {
        eventType: "draft",
        sectionId: "health",
        lifecycle: "parsed-draft",
        draft: {
          kind: "health-conditions",
          rows: [{ id: "condition", label: "Condition", value: "High blood pressure" }],
          metadata: { account_id: "please-enter-account-id" },
        },
        safety: localOnlySafety,
      },
    ];

    for (const output of unsafeOutputs) {
      expect(validateOnboardingElevenLabsOutput(output).ok).toBe(false);
    }
  });

  it("proves ElevenLabs output cannot persist profile data before explicit app save", () => {
    const output: OnboardingElevenLabsAgentOutput = {
      eventType: "draft",
      sectionId: "diet",
      lifecycle: "parsed-draft",
      draft: {
        kind: "diet",
        rows: [{ id: "gluten-free", label: "Diet preference", value: "Gluten-free" }],
      },
      safety: localOnlySafety,
    };

    expect(classifyOnboardingAgentEffect({ source: "elevenlabs-agent", output })).toEqual({
      mayPersistProfileData: false,
      mayTriggerExternalAction: false,
      reason: "ElevenLabs onboarding outputs are local draft events only.",
    });

    expect(
      classifyOnboardingAgentEffect({
        source: "app-section-save",
        sectionId: "diet",
        explicitUserSave: false,
        draftStatus: "confirmed-locally",
      }).mayPersistProfileData,
    ).toBe(false);

    expect(
      classifyOnboardingAgentEffect({
        source: "app-section-save",
        sectionId: "diet",
        explicitUserSave: true,
        draftStatus: "parsed-draft",
      }).mayPersistProfileData,
    ).toBe(false);

    expect(
      classifyOnboardingAgentEffect({
        source: "app-section-save",
        sectionId: "diet",
        explicitUserSave: true,
        draftStatus: "confirmed-locally",
      }).mayPersistProfileData,
    ).toBe(true);
  });
});
