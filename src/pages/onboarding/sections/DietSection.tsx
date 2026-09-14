// src/pages/onboarding/sections/DietSection.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero, seniorTextAreaClassName } from "@/components/onboarding/ProfileSectionHero";
import { ChipSelector } from "@/components/onboarding/ChipSelector";
import { ProfileVoiceAction } from "@/components/onboarding/ProfileSectionControls";
import { ProfileVoiceDraftReview } from "@/components/onboarding/ProfileVoiceDraftReview";
import { OnboardingCompanionTarget } from "@/components/onboarding/OnboardingCompanionTarget";
import { useOnboardingAgent } from "@/components/onboarding/useOnboardingAgent";
import { useOnboardingElevenLabsSectionRuntime } from "@/components/onboarding/useOnboardingElevenLabsSectionRuntime";
import { createProfileOnboardingAgentSectionConfig } from "@/components/onboarding/profileOnboardingAgentSections";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { Mic, Utensils } from "lucide-react";
import {
  applyProfileVoiceCorrection,
  createSimpleChoiceVoiceDraft,
  parseProfileVoiceCommand,
  type ProfileVoiceDraft,
} from "@/lib/profileVoiceCompletion";

const DIET_OPTIONS = [
  "Vegetarian","Vegan","Halal","Kosher","No pork","No shellfish",
  "Gluten-free","Dairy-free","Diabetic diet","Low salt","Low potassium","No restrictions",
];

export default function DietSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<ProfileVoiceDraft | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const {
    mode: companionMode,
    setMode: setCompanionMode,
    setGuidance,
    clearGuidance,
    registerVoiceAction,
  } = useOnboardingAgent();
  const dietAgentSectionConfig = useMemo(
    () =>
      createProfileOnboardingAgentSectionConfig({
        sectionId: "diet",
        sectionLabel: "Dietary preferences",
        voicePrompt: "Tell VYVA your dietary preferences or restrictions.",
        expectedFields: ["preferences", "notes"],
        targetIds: {
          addByVoice: "diet-add-by-voice",
          draftReview: "diet-voice-draft",
          reviewSave: "diet-review-save",
        },
      }),
    [],
  );
  const savedFading = false;
  const retryCountdown = null;
  const retryNow = () => undefined;
  const cancelAutoSave = () => undefined;

  const selectedRef = useRef(selected);
  const notesRef = useRef(notes);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const { data, isLoading } = useQuery<{ profile: { diet?: { preferences?: string[]; notes?: string } } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const saved = (data?.profile as { diet?: { preferences?: string[]; notes?: string } } | null)?.diet;
    if (saved) {
      if (saved.preferences) setSelected(saved.preferences);
      if (saved.notes) setNotes(saved.notes);
    }
  }, [data]);

  const setVoiceGuidance = useCallback(
    (guidance: Parameters<typeof setGuidance>[0]) => {
      if (companionMode !== "voice") return;
      setGuidance(guidance);
    },
    [companionMode, setGuidance],
  );

  const { startRuntimeCapture } = useOnboardingElevenLabsSectionRuntime({
    sectionConfig: dietAgentSectionConfig,
    companionMode,
    setCompanionMode,
    setGuidance,
    setVoiceDraft,
    existingProfileSummary: () => [...selected, notes].filter(Boolean).join(", ") || undefined,
    activeDraftId: () => voiceDraft?.id,
  });

  const startVoiceDietCapture = useCallback(() => {
    void startRuntimeCapture({ fallback: () => setSpeakItOpen(true) });
  }, [startRuntimeCapture]);

  useEffect(() => {
    const unregister = registerVoiceAction({
      id: "profile-diet-voice-capture",
      label: "Add by voice",
      description: "Say your diet preferences.",
      sectionConfig: dietAgentSectionConfig,
      targetId: dietAgentSectionConfig.targetIds?.addByVoice,
      onStart: startVoiceDietCapture,
    });
    return unregister;
  }, [dietAgentSectionConfig, registerVoiceAction, startVoiceDietCapture]);

  useEffect(() => {
    if (companionMode !== "voice") {
      clearGuidance();
      return;
    }

    setGuidance({
      voiceStatus: "idle",
      draftStatus: voiceDraft ? "parsed-draft" : "idle",
      currentSectionId: dietAgentSectionConfig.sectionId,
      currentSectionLabel: dietAgentSectionConfig.sectionLabel,
      currentPrompt: voiceDraft ? "Review these dietary preferences before adding them." : dietAgentSectionConfig.voicePrompt,
      activeTargetId: voiceDraft
        ? dietAgentSectionConfig.targetIds?.draftReview
        : dietAgentSectionConfig.targetIds?.addByVoice,
    });

    return () => clearGuidance();
  }, [clearGuidance, companionMode, dietAgentSectionConfig, setGuidance, voiceDraft]);

  const createDietDraft = (transcript: string) => {
    const lower = transcript.toLowerCase();
    const matches = DIET_OPTIONS.filter((option) => lower.includes(option.toLowerCase()));
    const noteMatch = transcript.match(/\b(?:note|notes|also|remember)\s+(?:that\s+)?(.{4,120})$/i);
    const note = noteMatch?.[1]?.trim();
    return createSimpleChoiceVoiceDraft({
      section: "diet",
      kind: "diet",
      title: "Review dietary preferences",
      helper: "VYVA found these preferences. Add them only if they look right.",
      label: "Preference",
      values: matches,
      metadata: note ? { notes: note } : undefined,
    });
  };

  const handleSpeakItDone = (transcript: string) => {
    setSpeakItOpen(false);
    const command = parseProfileVoiceCommand("diet", transcript);
    if (command?.kind === "try-again") {
      startVoiceDietCapture();
      return;
    }
    if (command?.kind === "skip") {
      setVoiceDraft(null);
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: "idle", lastHeardText: transcript });
      return;
    }
    if (command?.kind === "remove" && voiceDraft) {
      const corrected = applyProfileVoiceCorrection(voiceDraft, command);
      setVoiceDraft(corrected);
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: corrected ? "corrected-draft" : "needs-clarification" });
      return;
    }
    const draft = createDietDraft(transcript);
    if (!draft) {
      setVoiceGuidance({
        voiceStatus: "error",
        draftStatus: "needs-clarification",
        lastHeardText: transcript,
        error: "VYVA could not find dietary preferences in that.",
        activeTargetId: dietAgentSectionConfig.targetIds?.addByVoice,
      });
      return;
    }
    setVoiceDraft(draft);
    setVoiceGuidance({
      voiceStatus: "idle",
      draftStatus: "parsed-draft",
      lastHeardText: transcript,
      activeTargetId: dietAgentSectionConfig.targetIds?.draftReview,
    });
  };

  const confirmVoiceDraft = () => {
    if (!voiceDraft) return;
    setSelected((current) => Array.from(new Set([...current, ...voiceDraft.values])));
    if (voiceDraft.metadata?.notes) setNotes(voiceDraft.metadata.notes);
    setVoiceDraft(null);
    setAutoSaveStatus("idle");
    setVoiceGuidance({
      voiceStatus: "idle",
      draftStatus: "confirmed-locally",
      activeTargetId: dietAgentSectionConfig.targetIds?.reviewSave,
    });
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/diet", {
        method: "POST",
        body: JSON.stringify({ preferences: selected, notes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      setAutoSaveStatus("saved");
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: "saved" });
      navigate("/onboarding/complete/diet");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save dietary preferences", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PhoneFrame subtitle="Dietary preferences" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={Utensils}
          title="Food preferences"
          kicker="Comfort at meals"
          description="Tell VYVA what you avoid or prefer so food suggestions, reminders, and concierge help fit your daily life."
          badges={[
            { label: "Meal fit", color: "green" },
            { label: "Health-aware", color: "purple" },
            { label: "Concierge-ready", color: "amber" },
          ]}
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-diet-autosave" }}
        />

        {companionMode !== "voice" ? (
          <OnboardingCompanionTarget targetId="diet-add-by-voice">
            <ProfileVoiceAction
              icon={Mic}
              title="Add by voice"
              description="Say food preferences or restrictions."
              onClick={startVoiceDietCapture}
              testId="button-diet-speak-it"
              disabled={isLoading}
            />
          </OnboardingCompanionTarget>
        ) : null}

        {voiceDraft ? (
          <OnboardingCompanionTarget targetId="diet-voice-draft">
            <ProfileVoiceDraftReview
              draft={voiceDraft}
              confirmLabel="Add preferences"
              tryAgainLabel="Try again"
              dismissLabel="Dismiss"
              onConfirm={confirmVoiceDraft}
              onTryAgain={startVoiceDietCapture}
              onDismiss={() => setVoiceDraft(null)}
              onRemoveRow={(value) => {
                const command = parseProfileVoiceCommand("diet", `remove ${value}`);
                if (!command) return;
                setVoiceDraft((current) => current ? applyProfileVoiceCorrection(current, command) : current);
                setVoiceGuidance({ voiceStatus: "idle", draftStatus: "corrected-draft" });
              }}
              testId="panel-diet-voice-draft"
            />
          </OnboardingCompanionTarget>
        ) : null}

        {isLoading ? (
          <div className="flex flex-col gap-3" data-testid="skeleton-diet-content">
            <div className="flex flex-wrap gap-2">
              {[80, 64, 72, 56, 88, 60, 76, 52].map((w, i) => (
                <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
              ))}
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : (
          <>
            <ChipSelector
              options={DIET_OPTIONS}
              selected={selected}
              onChange={(val) => { setSelected(val); setAutoSaveStatus("idle"); }}
            />

            <div className="space-y-1.5">
              <Label className="text-[15px] font-extrabold text-gray-700">Other dietary notes (optional)</Label>
              <textarea
                data-testid="input-diet-notes"
                className={seniorTextAreaClassName}
                rows={3}
                placeholder="e.g. soft foods only, texture modified, low fibre..."
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setAutoSaveStatus("idle"); }}
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <OnboardingCompanionTarget targetId="diet-review-save">
          <Button data-testid="button-diet-save" onClick={handleSave} disabled={saving || isLoading} className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save dietary preferences"}
          </Button>
          </OnboardingCompanionTarget>
          <button data-testid="button-diet-skip" onClick={() => navigate("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">Skip for now</button>
        </div>
      </div>
      {speakItOpen ? (
        <SpeakItOverlay
          title="Tell VYVA your dietary preferences"
          hint='e.g. "I am gluten-free and low salt"'
          onDone={handleSpeakItDone}
          onCancel={() => setSpeakItOpen(false)}
        />
      ) : null}
    </PhoneFrame>
  );
}
