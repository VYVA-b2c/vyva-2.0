// src/pages/onboarding/sections/CognitiveSection.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { SeniorChoiceChips, type SeniorChoiceOption } from "@/components/onboarding/SeniorChoiceChips";
import { ProfileVoiceAction } from "@/components/onboarding/ProfileSectionControls";
import { ProfileVoiceDraftReview } from "@/components/onboarding/ProfileVoiceDraftReview";
import { OnboardingCompanionTarget } from "@/components/onboarding/OnboardingCompanionTarget";
import { useOnboardingAgent } from "@/components/onboarding/useOnboardingAgent";
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
import { BadgeCheck, Brain, Clock3, MessagesSquare, Mic, Moon, Repeat, Sparkles, Sun } from "lucide-react";
import {
  applyProfileVoiceCorrection,
  createSimpleChoiceVoiceDraft,
  parseProfileVoiceCommand,
  type ProfileVoiceDraft,
} from "@/lib/profileVoiceCompletion";

type CognitiveForm = {
  memory_difficulties: string;
  cognitive_diagnosis: string;
  session_length_mins: number;
  training_time: string;
  pace: string;
  variety: string;
  communication_style: string;
};

const MEMORY_OPTIONS: SeniorChoiceOption[] = [
  { value: "none", label: "No concerns", description: "VYVA can keep a normal pace.", icon: <BadgeCheck size={17} /> },
  { value: "mild", label: "Mild support", description: "Helpful prompts and reminders.", icon: <Brain size={17} /> },
  { value: "moderate", label: "More support", description: "Simpler steps and more repetition.", icon: <MessagesSquare size={17} /> },
];

const DIAGNOSIS_OPTIONS: SeniorChoiceOption[] = [
  { value: "none", label: "None", icon: <BadgeCheck size={17} /> },
  { value: "mci", label: "MCI", description: "Mild cognitive impairment.", icon: <Brain size={17} /> },
  { value: "early_dementia", label: "Early dementia", icon: <Brain size={17} /> },
  { value: "alzheimers", label: "Alzheimer's", icon: <Brain size={17} /> },
  { value: "parkinsons", label: "Parkinson's", icon: <Brain size={17} /> },
  { value: "other", label: "Other", icon: <Sparkles size={17} /> },
];

const SESSION_OPTIONS: SeniorChoiceOption[] = [
  { value: "5", label: "5 min", icon: <Clock3 size={17} /> },
  { value: "10", label: "10 min", icon: <Clock3 size={17} /> },
  { value: "15", label: "15 min", icon: <Clock3 size={17} /> },
  { value: "20", label: "20 min", icon: <Clock3 size={17} /> },
];

const TRAINING_TIME_OPTIONS: SeniorChoiceOption[] = [
  { value: "morning", label: "Morning", icon: <Sun size={17} /> },
  { value: "afternoon", label: "Afternoon", icon: <Sun size={17} /> },
  { value: "no_preference", label: "Any time", icon: <Clock3 size={17} /> },
];

const PACE_OPTIONS: SeniorChoiceOption[] = [
  { value: "normal", label: "Normal", icon: <BadgeCheck size={17} /> },
  { value: "slower", label: "Slower", icon: <MessagesSquare size={17} /> },
  { value: "very_slow", label: "Very slow", icon: <MessagesSquare size={17} /> },
];

const VARIETY_OPTIONS: SeniorChoiceOption[] = [
  { value: "variety", label: "Prefer variety", icon: <Sparkles size={17} /> },
  { value: "repeating", label: "Enjoy repeating", icon: <Repeat size={17} /> },
];

const STYLE_OPTIONS: SeniorChoiceOption[] = [
  { value: "standard", label: "Standard", icon: <MessagesSquare size={17} /> },
  { value: "simpler", label: "Simpler language", icon: <MessagesSquare size={17} /> },
  { value: "very_simple", label: "Very simple", description: "More repetition and shorter steps.", icon: <Moon size={17} /> },
];

export default function CognitiveSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<CognitiveForm>({
    memory_difficulties: "none",
    cognitive_diagnosis: "none",
    session_length_mins: 15,
    training_time: "morning",
    pace: "normal",
    variety: "variety",
    communication_style: "standard",
  });
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
  const cognitiveAgentSectionConfig = useMemo(
    () =>
      createProfileOnboardingAgentSectionConfig({
        sectionId: "cognitive",
        sectionLabel: "Cognitive profile",
        voicePrompt: "Tell VYVA your memory support, pace, and brain coach preferences.",
        expectedFields: [
          "memory_difficulties",
          "cognitive_diagnosis",
          "session_length_mins",
          "training_time",
          "pace",
          "variety",
          "communication_style",
        ],
        targetIds: {
          addByVoice: "cognitive-add-by-voice",
          draftReview: "cognitive-voice-draft",
          reviewSave: "cognitive-review-save",
        },
      }),
    [],
  );
  const savedFading = false;
  const retryCountdown = null;
  const retryNow = () => undefined;
  const cancelAutoSave = () => undefined;

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const { data, isLoading } = useQuery<{ profile: { cognitive?: CognitiveForm } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const saved = (data?.profile as { cognitive?: CognitiveForm } | null)?.cognitive;
    if (saved) {
      setForm((prev) => ({ ...prev, ...saved }));
    }
  }, [data]);

  const setVoiceGuidance = useCallback(
    (guidance: Parameters<typeof setGuidance>[0]) => {
      if (companionMode !== "voice") return;
      setGuidance(guidance);
    },
    [companionMode, setGuidance],
  );

  const startVoiceCognitiveCapture = useCallback(() => {
    setCompanionMode("voice");
    setGuidance({
      voiceStatus: "listening",
      draftStatus: "listening",
      currentSectionId: cognitiveAgentSectionConfig.sectionId,
      currentSectionLabel: cognitiveAgentSectionConfig.sectionLabel,
      currentPrompt: cognitiveAgentSectionConfig.voicePrompt,
      activeTargetId: cognitiveAgentSectionConfig.targetIds?.addByVoice,
    });
    setSpeakItOpen(true);
  }, [cognitiveAgentSectionConfig, setCompanionMode, setGuidance]);

  useEffect(() => {
    const unregister = registerVoiceAction({
      id: "profile-cognitive-voice-capture",
      label: "Add by voice",
      description: "Say pace, memory, or session preferences.",
      sectionConfig: cognitiveAgentSectionConfig,
      targetId: cognitiveAgentSectionConfig.targetIds?.addByVoice,
      onStart: startVoiceCognitiveCapture,
    });
    return unregister;
  }, [cognitiveAgentSectionConfig, registerVoiceAction, startVoiceCognitiveCapture]);

  useEffect(() => {
    if (companionMode !== "voice") {
      clearGuidance();
      return;
    }

    setGuidance({
      voiceStatus: "idle",
      draftStatus: voiceDraft ? "parsed-draft" : "idle",
      currentSectionId: cognitiveAgentSectionConfig.sectionId,
      currentSectionLabel: cognitiveAgentSectionConfig.sectionLabel,
      currentPrompt: voiceDraft ? "Review these brain coach preferences before applying them." : cognitiveAgentSectionConfig.voicePrompt,
      activeTargetId: voiceDraft
        ? cognitiveAgentSectionConfig.targetIds?.draftReview
        : cognitiveAgentSectionConfig.targetIds?.addByVoice,
    });

    return () => clearGuidance();
  }, [clearGuidance, cognitiveAgentSectionConfig, companionMode, setGuidance, voiceDraft]);

  const set = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setAutoSaveStatus("idle");
  };

  const createCognitiveDraft = (transcript: string) => {
    const lower = transcript.toLowerCase();
    const metadata: Record<string, string> = {};
    if (lower.includes("mild")) metadata.memory_difficulties = "mild";
    if (lower.includes("moderate") || lower.includes("more support")) metadata.memory_difficulties = "moderate";
    if (lower.includes("no concerns") || lower.includes("no memory")) metadata.memory_difficulties = "none";
    if (lower.includes("mci")) metadata.cognitive_diagnosis = "mci";
    if (lower.includes("dementia")) metadata.cognitive_diagnosis = "early_dementia";
    if (lower.includes("alzheimer")) metadata.cognitive_diagnosis = "alzheimers";
    if (lower.includes("parkinson")) metadata.cognitive_diagnosis = "parkinsons";
    const session = lower.match(/\b(5|10|15|20)\s*(?:minute|min)\b/);
    if (session?.[1]) metadata.session_length_mins = session[1];
    if (lower.includes("morning")) metadata.training_time = "morning";
    if (lower.includes("afternoon")) metadata.training_time = "afternoon";
    if (lower.includes("any time") || lower.includes("no preference")) metadata.training_time = "no_preference";
    if (lower.includes("very slow")) metadata.pace = "very_slow";
    else if (lower.includes("slower") || lower.includes("slow")) metadata.pace = "slower";
    else if (lower.includes("normal pace")) metadata.pace = "normal";
    if (lower.includes("repeat")) metadata.variety = "repeating";
    if (lower.includes("variety")) metadata.variety = "variety";
    if (lower.includes("very simple")) metadata.communication_style = "very_simple";
    else if (lower.includes("simple") || lower.includes("simpler")) metadata.communication_style = "simpler";
    else if (lower.includes("standard")) metadata.communication_style = "standard";

    const labels: Record<string, string> = {
      none: "No concerns",
      mild: "Mild support",
      moderate: "More support",
      mci: "MCI",
      early_dementia: "Early dementia",
      alzheimers: "Alzheimer's",
      parkinsons: "Parkinson's",
      no_preference: "Any time",
      very_slow: "Very slow",
      slower: "Slower",
      normal: "Normal",
      repeating: "Enjoy repeating",
      variety: "Prefer variety",
      very_simple: "Very simple",
      simpler: "Simpler language",
      standard: "Standard",
      morning: "Morning",
      afternoon: "Afternoon",
    };
    const rows = Object.entries(metadata).map(([field, value]) => `${field}: ${labels[value] ?? value}`);
    return createSimpleChoiceVoiceDraft({
      section: "cognitive",
      kind: "cognitive",
      title: "Review cognitive preferences",
      helper: "VYVA found these brain coach settings. Apply them only if they look right.",
      label: "Preference",
      values: rows,
      metadata,
    });
  };

  const handleSpeakItDone = (transcript: string) => {
    setSpeakItOpen(false);
    const command = parseProfileVoiceCommand("cognitive", transcript);
    if (command?.kind === "try-again") {
      startVoiceCognitiveCapture();
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
    const draft = createCognitiveDraft(transcript);
    if (!draft) {
      setVoiceGuidance({
        voiceStatus: "error",
        draftStatus: "needs-clarification",
        lastHeardText: transcript,
        error: "VYVA could not find cognitive preferences in that.",
        activeTargetId: cognitiveAgentSectionConfig.targetIds?.addByVoice,
      });
      return;
    }
    setVoiceDraft(draft);
    setVoiceGuidance({
      voiceStatus: "idle",
      draftStatus: "parsed-draft",
      lastHeardText: transcript,
      activeTargetId: cognitiveAgentSectionConfig.targetIds?.draftReview,
    });
  };

  const confirmVoiceDraft = () => {
    if (!voiceDraft) return;
    const metadata = voiceDraft.metadata ?? {};
    setForm((prev) => ({
      ...prev,
      ...metadata,
      session_length_mins: metadata.session_length_mins
        ? Number(metadata.session_length_mins)
        : prev.session_length_mins,
    }));
    setVoiceDraft(null);
    setAutoSaveStatus("idle");
    setVoiceGuidance({
      voiceStatus: "idle",
      draftStatus: "confirmed-locally",
      activeTargetId: cognitiveAgentSectionConfig.targetIds?.reviewSave,
    });
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/cognitive", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      setAutoSaveStatus("saved");
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: "saved" });
      navigate("/onboarding/complete/cognitive");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save cognitive profile", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const SelectSkeleton = () => <Skeleton className="h-11 w-full rounded-lg" />;

  return (
    <PhoneFrame subtitle="Cognitive profile" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={Brain}
          title="Brain coach"
          kicker="Personal pace"
          description="Help VYVA choose the right pace, language, and brain-training rhythm for calmer daily support."
          badges={[
            { label: "Memory support", color: "purple" },
            { label: "Gentle coaching", color: "blue" },
            { label: "Private by default", color: "green" },
          ]}
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-cognitive-autosave" }}
        />

        {companionMode !== "voice" ? (
          <OnboardingCompanionTarget targetId="cognitive-add-by-voice">
            <ProfileVoiceAction
              icon={Mic}
              title="Add by voice"
              description="Say pace, memory, or brain coach preferences."
              onClick={startVoiceCognitiveCapture}
              testId="button-cognitive-speak-it"
              disabled={isLoading}
            />
          </OnboardingCompanionTarget>
        ) : null}

        {voiceDraft ? (
          <OnboardingCompanionTarget targetId="cognitive-voice-draft">
            <ProfileVoiceDraftReview
              draft={voiceDraft}
              confirmLabel="Apply preferences"
              tryAgainLabel="Try again"
              dismissLabel="Dismiss"
              onConfirm={confirmVoiceDraft}
              onTryAgain={startVoiceCognitiveCapture}
              onDismiss={() => setVoiceDraft(null)}
              onRemoveRow={(value) => {
                const command = parseProfileVoiceCommand("cognitive", `remove ${value}`);
                if (!command) return;
                setVoiceDraft((current) => current ? applyProfileVoiceCorrection(current, command) : current);
                setVoiceGuidance({ voiceStatus: "idle", draftStatus: "corrected-draft" });
              }}
              testId="panel-cognitive-voice-draft"
            />
          </OnboardingCompanionTarget>
        ) : null}

        <div className="flex flex-col gap-7">
          <div className="space-y-3">
            <Label className="text-[15px] font-extrabold text-gray-700">Memory support</Label>
            {isLoading ? <SelectSkeleton /> : (
              <SeniorChoiceChips
                options={MEMORY_OPTIONS}
                value={form.memory_difficulties}
                onChange={(v) => set("memory_difficulties", v)}
                testIdPrefix="chip-cognitive-memory"
              />
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-[15px] font-extrabold text-gray-700">Diagnosis, if any</Label>
            {isLoading ? <SelectSkeleton /> : (
              <SeniorChoiceChips
                options={DIAGNOSIS_OPTIONS}
                value={form.cognitive_diagnosis}
                onChange={(v) => set("cognitive_diagnosis", v)}
                testIdPrefix="chip-cognitive-diagnosis"
              />
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-[15px] font-extrabold text-gray-700">Brain coach sessions</Label>
            {isLoading ? <SelectSkeleton /> : (
              <SeniorChoiceChips
                options={SESSION_OPTIONS}
                value={String(form.session_length_mins)}
                onChange={(v) => set("session_length_mins", parseInt(v))}
                testIdPrefix="chip-cognitive-session"
              />
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-[15px] font-extrabold text-gray-700">Best time of day</Label>
            {isLoading ? <SelectSkeleton /> : (
              <SeniorChoiceChips
                options={TRAINING_TIME_OPTIONS}
                value={form.training_time}
                onChange={(v) => set("training_time", v)}
                testIdPrefix="chip-cognitive-time"
              />
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-[15px] font-extrabold text-gray-700">Conversation pace</Label>
            {isLoading ? <SelectSkeleton /> : (
              <SeniorChoiceChips
                options={PACE_OPTIONS}
                value={form.pace}
                onChange={(v) => set("pace", v)}
                testIdPrefix="chip-cognitive-pace"
              />
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-[15px] font-extrabold text-gray-700">Exercises</Label>
            {isLoading ? <SelectSkeleton /> : (
              <SeniorChoiceChips
                options={VARIETY_OPTIONS}
                value={form.variety}
                onChange={(v) => set("variety", v)}
                testIdPrefix="chip-cognitive-variety"
              />
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-[15px] font-extrabold text-gray-700">VYVA communication style</Label>
            {isLoading ? <SelectSkeleton /> : (
              <SeniorChoiceChips
                options={STYLE_OPTIONS}
                value={form.communication_style}
                onChange={(v) => set("communication_style", v)}
                testIdPrefix="chip-cognitive-style"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <OnboardingCompanionTarget targetId="cognitive-review-save">
          <Button data-testid="button-cognitive-save" onClick={handleSave} disabled={saving || isLoading} className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save cognitive profile"}
          </Button>
          </OnboardingCompanionTarget>
          <button data-testid="button-cognitive-skip" onClick={() => navigate("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">Skip for now</button>
        </div>
      </div>
      {speakItOpen ? (
        <SpeakItOverlay
          title="Tell VYVA your brain coach preferences"
          hint='e.g. "Mild support, 10 minute sessions, slower pace, simple language"'
          onDone={handleSpeakItDone}
          onCancel={() => setSpeakItOpen(false)}
        />
      ) : null}
    </PhoneFrame>
  );
}
