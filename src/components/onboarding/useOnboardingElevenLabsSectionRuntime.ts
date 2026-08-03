import { useCallback, useEffect, useRef } from "react";
import { getLanguageSnapshot } from "@/i18n";
import { useOptionalVyvaVoice } from "@/hooks/useVyvaVoice";
import type {
  OnboardingAgentMode,
  OnboardingAgentSectionConfig,
  OnboardingAgentState,
} from "@/components/onboarding/useOnboardingAgent";
import type { ProfileOnboardingAgentSectionId } from "@/components/onboarding/profileOnboardingAgentSections";
import type { ProfileVoiceDraft } from "@/lib/profileVoiceCompletion";
import type { OnboardingVoiceUiState } from "@/lib/onboardingVoiceUiState";
import {
  createOnboardingElevenLabsRuntimeStartRequest,
  subscribeOnboardingElevenLabsRuntimeEvents,
  type OnboardingElevenLabsRuntimeEvent,
} from "@/lib/onboardingElevenLabsRuntimeAdapter";

type GuidancePatch = Partial<Omit<OnboardingAgentState, "mode">>;

interface UseOnboardingElevenLabsSectionRuntimeInput {
  sectionConfig: OnboardingAgentSectionConfig<ProfileOnboardingAgentSectionId>;
  companionMode: OnboardingAgentMode;
  setCompanionMode: (mode: OnboardingAgentMode) => void;
  setGuidance: (state: GuidancePatch) => void;
  setVoiceDraft?: (draft: ProfileVoiceDraft | null) => void;
  onDraft?: (draft: ProfileVoiceDraft, event: Extract<OnboardingElevenLabsRuntimeEvent, { type: "draft" }>) => void;
  existingProfileSummary?: () => string | undefined;
  activeDraftId?: () => string | undefined;
  uiState?: () => OnboardingVoiceUiState | undefined;
}

interface StartRuntimeCaptureInput {
  fallback?: () => void;
  afterRuntimeStart?: () => void;
}

function createListeningGuidance(
  sectionConfig: OnboardingAgentSectionConfig<ProfileOnboardingAgentSectionId>,
): GuidancePatch {
  return {
    voiceStatus: "listening",
    draftStatus: "listening",
    currentSectionId: sectionConfig.sectionId,
    currentSectionLabel: sectionConfig.sectionLabel,
    currentPrompt: sectionConfig.voicePrompt,
    activeTargetId: sectionConfig.targetIds?.addByVoice,
  };
}

export function useOnboardingElevenLabsSectionRuntime({
  sectionConfig,
  companionMode,
  setCompanionMode,
  setGuidance,
  setVoiceDraft,
  onDraft,
  existingProfileSummary,
  activeDraftId,
  uiState,
}: UseOnboardingElevenLabsSectionRuntimeInput) {
  const vyvaVoice = useOptionalVyvaVoice();
  const sectionConfigRef = useRef(sectionConfig);
  const companionModeRef = useRef(companionMode);
  const existingProfileSummaryRef = useRef(existingProfileSummary);
  const activeDraftIdRef = useRef(activeDraftId);
  const uiStateRef = useRef(uiState);
  const onDraftRef = useRef(onDraft);
  const setVoiceDraftRef = useRef(setVoiceDraft);

  useEffect(() => {
    sectionConfigRef.current = sectionConfig;
  }, [sectionConfig]);

  useEffect(() => {
    companionModeRef.current = companionMode;
  }, [companionMode]);

  useEffect(() => {
    existingProfileSummaryRef.current = existingProfileSummary;
  }, [existingProfileSummary]);

  useEffect(() => {
    activeDraftIdRef.current = activeDraftId;
  }, [activeDraftId]);

  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  useEffect(() => {
    onDraftRef.current = onDraft;
  }, [onDraft]);

  useEffect(() => {
    setVoiceDraftRef.current = setVoiceDraft;
  }, [setVoiceDraft]);

  const setVoiceGuidance = useCallback(
    (guidance: GuidancePatch) => {
      if (companionModeRef.current !== "voice") return;
      setGuidance(guidance);
    },
    [setGuidance],
  );

  useEffect(
    () =>
      subscribeOnboardingElevenLabsRuntimeEvents(sectionConfig.sectionId, (event) => {
        const activeSectionConfig = sectionConfigRef.current;
        if (event.type === "draft") {
          onDraftRef.current?.(event.draft, event);
          if (!onDraftRef.current) setVoiceDraftRef.current?.(event.draft);
          setVoiceGuidance({
            voiceStatus: "thinking",
            draftStatus: "parsed-draft",
            currentSectionId: event.sectionId,
            currentSectionLabel: activeSectionConfig.sectionLabel,
            currentPrompt: activeSectionConfig.voicePrompt,
            activeTargetId: activeSectionConfig.targetIds?.draftReview,
          });
          return;
        }

        if (event.type === "clarification") {
          setVoiceGuidance({
            voiceStatus: "speaking",
            draftStatus: "needs-clarification",
            currentSectionId: event.sectionId,
            currentSectionLabel: activeSectionConfig.sectionLabel,
            currentPrompt: event.question,
            activeTargetId: activeSectionConfig.targetIds?.addByVoice,
          });
          return;
        }

        if (event.type === "status") {
          setVoiceGuidance({
            voiceStatus: event.voiceStatus,
            draftStatus: event.voiceStatus === "error" ? "needs-clarification" : "listening",
            currentSectionId: event.sectionId,
            currentSectionLabel: activeSectionConfig.sectionLabel,
            currentPrompt: event.message ?? activeSectionConfig.voicePrompt,
            activeTargetId: activeSectionConfig.targetIds?.addByVoice,
          });
        }
      }),
    [sectionConfig.sectionId, setVoiceGuidance],
  );

  const startRuntimeCapture = useCallback(
    async ({ fallback, afterRuntimeStart }: StartRuntimeCaptureInput = {}) => {
      const activeSectionConfig = sectionConfigRef.current;
      const guidance = createListeningGuidance(activeSectionConfig);
      if (companionModeRef.current === "voice") {
        setGuidance(guidance);
      } else {
        setCompanionMode("voice");
        window.setTimeout(() => setGuidance(guidance), 0);
      }

      if (!vyvaVoice) {
        fallback?.();
        return false;
      }

      const startRequest = createOnboardingElevenLabsRuntimeStartRequest({
        sectionConfig: activeSectionConfig,
        language: getLanguageSnapshot().language,
        mode: "voice",
        existingProfileSummary: existingProfileSummaryRef.current?.(),
        activeDraftId: activeDraftIdRef.current?.(),
        uiState: uiStateRef.current?.(),
      });

      await vyvaVoice.startVoice(
        startRequest.contextHint,
        startRequest.systemPrompt,
        startRequest.options,
      );
      afterRuntimeStart?.();
      return true;
    },
    [setCompanionMode, setGuidance, vyvaVoice],
  );

  return { startRuntimeCapture };
}
