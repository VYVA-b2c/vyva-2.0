// src/pages/onboarding/sections/CognitiveSection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { SeniorChoiceChips, type SeniorChoiceOption } from "@/components/onboarding/SeniorChoiceChips";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { BadgeCheck, Brain, Clock3, MessagesSquare, Moon, Repeat, Sparkles, Sun } from "lucide-react";

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

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/cognitive", {
        method: "POST",
        body: JSON.stringify(formRef.current),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
    },
    2000,
  );

  const set = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    scheduleAutoSave();
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
          <Button data-testid="button-cognitive-save" onClick={handleSave} disabled={saving || isLoading} className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save cognitive profile"}
          </Button>
          <button data-testid="button-cognitive-skip" onClick={() => navigate("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">Skip for now</button>
        </div>
      </div>
    </PhoneFrame>
  );
}
