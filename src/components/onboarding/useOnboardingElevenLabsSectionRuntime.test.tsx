import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROFILE_ONBOARDING_AGENT_SECTION_IDS,
  createProfileOnboardingAgentSectionConfig,
} from "@/components/onboarding/profileOnboardingAgentSections";
import type { OnboardingAgentMode } from "@/components/onboarding/useOnboardingAgent";
import { dispatchOnboardingElevenLabsOutput } from "@/lib/onboardingElevenLabsRuntimeAdapter";
import type { ProfileVoiceDraft } from "@/lib/profileVoiceCompletion";
import { useOnboardingElevenLabsSectionRuntime } from "./useOnboardingElevenLabsSectionRuntime";

const { startVoice, optionalVoice } = vi.hoisted(() => ({
  startVoice: vi.fn(),
  optionalVoice: {
    current: undefined as undefined | null | { startVoice: ReturnType<typeof vi.fn> },
  },
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => optionalVoice.current,
}));

vi.mock("@/i18n", () => ({
  getLanguageSnapshot: () => ({ language: "es" }),
}));

const createSectionConfig = (sectionId: (typeof PROFILE_ONBOARDING_AGENT_SECTION_IDS)[number]) =>
  createProfileOnboardingAgentSectionConfig({
    sectionId,
    sectionLabel: `${sectionId} label`,
    voicePrompt: `Tell VYVA about ${sectionId}.`,
    expectedFields: [`${sectionId}_field`],
    targetIds: {
      addByVoice: `${sectionId}-voice`,
      draftReview: `${sectionId}-draft`,
      reviewSave: `${sectionId}-save`,
    },
  });

describe("useOnboardingElevenLabsSectionRuntime", () => {
  beforeEach(() => {
    startVoice.mockReset();
    startVoice.mockResolvedValue(undefined);
    optionalVoice.current = { startVoice };
  });

  it.each(PROFILE_ONBOARDING_AGENT_SECTION_IDS)(
    "starts the shared ElevenLabs onboarding agent for %s",
    async (sectionId) => {
      let mode: OnboardingAgentMode = "touch";
      const setCompanionMode = vi.fn((next: OnboardingAgentMode) => {
        mode = next;
      });
      const setGuidance = vi.fn();
      const setVoiceDraft = vi.fn();
      const sectionConfig = createSectionConfig(sectionId);

      const { result } = renderHook(() =>
        useOnboardingElevenLabsSectionRuntime({
          sectionConfig,
          companionMode: mode,
          setCompanionMode,
          setGuidance,
          setVoiceDraft,
          existingProfileSummary: () => "Existing local section summary",
          activeDraftId: () => `${sectionId}:draft`,
        }),
      );

      await act(async () => {
        await result.current.startRuntimeCapture();
      });

      expect(setCompanionMode).toHaveBeenCalledWith("voice");
      expect(startVoice).toHaveBeenCalledTimes(1);
      expect(startVoice.mock.calls[0]?.[0]).toBe(`Tell VYVA about ${sectionId}.`);
      expect(startVoice.mock.calls[0]?.[2]).toMatchObject({
        agentSlug: "onboarding-profile",
        autoStartListening: true,
        dynamicVariables: {
          active_section_id: sectionId,
          active_section_label: `${sectionId} label`,
          language: "es",
          onboarding_mode: "voice",
          active_draft_id: `${sectionId}:draft`,
        },
      });
      expect(String(startVoice.mock.calls[0]?.[2].dynamicVariables.active_section_schema_json)).toContain(
        `"sectionId":"${sectionId}"`,
      );
    },
  );

  it("keeps ElevenLabs draft output local until the section confirms it", () => {
    let mode: OnboardingAgentMode = "voice";
    const setCompanionMode = vi.fn((next: OnboardingAgentMode) => {
      mode = next;
    });
    const setGuidance = vi.fn();
    const setVoiceDraft = vi.fn();

    renderHook(() =>
      useOnboardingElevenLabsSectionRuntime({
        sectionConfig: createSectionConfig("address"),
        companionMode: mode,
        setCompanionMode,
        setGuidance,
        setVoiceDraft,
      }),
    );

    act(() => {
      const result = dispatchOnboardingElevenLabsOutput({
        eventType: "draft",
        sectionId: "address",
        lifecycle: "parsed-draft",
        draft: {
          kind: "address",
          title: "Review address",
          helper: "Confirm before saving.",
          rows: [{ id: "street", label: "Street", value: "123 Main Street" }],
          values: ["123 Main Street"],
          metadata: { city: "Madrid" },
        },
        safety: {
          localOnly: true,
          requiresReview: true,
          requiresExplicitSave: true,
          mayTriggerExternalAction: false,
        },
      });
      expect(result.ok).toBe(true);
    });

    expect(setVoiceDraft).toHaveBeenCalledWith(
      expect.objectContaining<Partial<ProfileVoiceDraft>>({
        section: "address",
        values: ["123 Main Street"],
      }),
    );
    expect(setGuidance).toHaveBeenCalledWith(
      expect.objectContaining({
        draftStatus: "parsed-draft",
        activeTargetId: "address-draft",
      }),
    );
  });

  it("falls back to the section-local voice UI when no voice provider is mounted", async () => {
    optionalVoice.current = null;
    const fallback = vi.fn();

    const { result } = renderHook(() =>
      useOnboardingElevenLabsSectionRuntime({
        sectionConfig: createSectionConfig("hobbies"),
        companionMode: "voice",
        setCompanionMode: vi.fn(),
        setGuidance: vi.fn(),
        setVoiceDraft: vi.fn(),
      }),
    );

    await act(async () => {
      const started = await result.current.startRuntimeCapture({ fallback });
      expect(started).toBe(false);
    });

    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
