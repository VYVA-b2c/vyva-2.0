// src/pages/onboarding/sections/EmergencySection.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero, seniorInputClassName } from "@/components/onboarding/ProfileSectionHero";
import { ProfileVoiceAction } from "@/components/onboarding/ProfileSectionControls";
import { OnboardingCompanionTarget } from "@/components/onboarding/OnboardingCompanionTarget";
import { ProfileVoiceDraftReview } from "@/components/onboarding/ProfileVoiceDraftReview";
import { useOnboardingAgent } from "@/components/onboarding/useOnboardingAgent";
import { useOnboardingElevenLabsSectionRuntime } from "@/components/onboarding/useOnboardingElevenLabsSectionRuntime";
import { createProfileOnboardingAgentSectionConfig } from "@/components/onboarding/profileOnboardingAgentSections";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { Mic, ShieldAlert } from "lucide-react";
import {
  applyProfileVoiceCorrection,
  parseProfileVoiceCommand,
  parseProfileVoiceTranscript,
  type ProfileVoiceDraft,
} from "@/lib/profileVoiceCompletion";

type EmergencyForm = {
  name: string;
  relationship: string;
  primary_phone: string;
  secondary_phone: string;
  address: string;
};

export default function EmergencySection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [form, setForm] = useState<EmergencyForm>({
    name: "", relationship: "",
    primary_phone: "", secondary_phone: "", address: "",
  });
  const [saving, setSaving] = useState(false);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<ProfileVoiceDraft | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const {
    mode: companionMode,
    setMode: setCompanionMode,
    setGuidance,
    clearGuidance,
    registerVoiceAction,
  } = useOnboardingAgent();
  const emergencyAgentSectionConfig = useMemo(
    () =>
      createProfileOnboardingAgentSectionConfig({
        sectionId: "emergency",
        sectionLabel: "Emergency contact",
        voicePrompt: "Tell VYVA your emergency contact's name, relationship, and phone.",
        expectedFields: ["name", "relationship", "primary_phone", "secondary_phone", "address"],
        targetIds: {
          addByVoice: "emergency-add-by-voice",
          draftReview: "emergency-voice-draft",
          reviewSave: "emergency-review-save",
        },
      }),
    [],
  );
  const savedFading = false;
  const retryCountdown = null;
  const retryNow = () => undefined;
  const cancelAutoSave = () => undefined;

  const setVoiceGuidance = useCallback(
    (guidance: Parameters<typeof setGuidance>[0]) => {
      if (companionMode !== "voice") return;
      setGuidance(guidance);
    },
    [companionMode, setGuidance],
  );

  const { startRuntimeCapture } = useOnboardingElevenLabsSectionRuntime({
    sectionConfig: emergencyAgentSectionConfig,
    companionMode,
    setCompanionMode,
    setGuidance,
    setVoiceDraft,
    activeDraftId: () => voiceDraft?.id,
  });

  const startVoiceEmergencyCapture = useCallback(() => {
    void startRuntimeCapture({ fallback: () => setSpeakItOpen(true) });
  }, [startRuntimeCapture]);

  useEffect(() => {
    const unregister = registerVoiceAction({
      id: "profile-emergency-voice-capture",
      label: "Add by voice",
      description: "Say their name, relationship, and phone.",
      sectionConfig: emergencyAgentSectionConfig,
      targetId: emergencyAgentSectionConfig.targetIds?.addByVoice,
      onStart: startVoiceEmergencyCapture,
    });
    return unregister;
  }, [emergencyAgentSectionConfig, registerVoiceAction, startVoiceEmergencyCapture]);

  useEffect(() => {
    if (companionMode !== "voice") {
      clearGuidance();
      return;
    }

    setGuidance({
      voiceStatus: "idle",
      draftStatus: voiceDraft ? "parsed-draft" : "idle",
      currentSectionId: emergencyAgentSectionConfig.sectionId,
      currentSectionLabel: emergencyAgentSectionConfig.sectionLabel,
      currentPrompt: voiceDraft
        ? "Review this contact before adding it."
        : emergencyAgentSectionConfig.voicePrompt,
      activeTargetId: voiceDraft
        ? emergencyAgentSectionConfig.targetIds?.draftReview
        : emergencyAgentSectionConfig.targetIds?.addByVoice,
    });

    return () => clearGuidance();
  }, [clearGuidance, companionMode, emergencyAgentSectionConfig, setGuidance, voiceDraft]);

  const buildEmergencyPayload = (current: EmergencyForm) => ({
    emergency_name: current.name,
    emergency_phone: current.primary_phone,
    emergency_role: current.relationship,
    secondary_phone: current.secondary_phone,
    address: current.address,
  });

  const completePath = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo
      ? `/onboarding/complete/emergency?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/complete/emergency";
  };

  const { data, isLoading } = useQuery<{ profile: { emergency_contact?: EmergencyForm } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const ec = (data?.profile as { emergency_contact?: EmergencyForm } | null)?.emergency_contact;
    if (ec) {
      setForm((prev) => ({
        name:            ec.name            ?? prev.name,
        relationship:    ec.relationship    ?? prev.relationship,
        primary_phone:   ec.primary_phone   ?? prev.primary_phone,
        secondary_phone: ec.secondary_phone ?? prev.secondary_phone,
        address:         ec.address         ?? prev.address,
      }));
    }
  }, [data]);

  const set = (f: string, v: string) => {
    setForm((p) => ({ ...p, [f]: v }));
    setAutoSaveStatus("idle");
  };

  const handleSpeakItDone = (transcript: string) => {
    setSpeakItOpen(false);
    const command = parseProfileVoiceCommand("emergency", transcript);
    if (command?.kind === "try-again") {
      startVoiceEmergencyCapture();
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
      setVoiceGuidance({
        voiceStatus: "idle",
        draftStatus: corrected ? "corrected-draft" : "needs-clarification",
        lastHeardText: transcript,
        activeTargetId: corrected
          ? emergencyAgentSectionConfig.targetIds?.draftReview
          : emergencyAgentSectionConfig.targetIds?.addByVoice,
      });
      return;
    }

    const result = parseProfileVoiceTranscript("emergency", transcript);
    if (result.type === "draft") {
      setVoiceDraft(result.draft);
      setVoiceGuidance({
        voiceStatus: "idle",
        draftStatus: "parsed-draft",
        lastHeardText: transcript,
        activeTargetId: emergencyAgentSectionConfig.targetIds?.draftReview,
      });
      return;
    }

    setVoiceGuidance({
      voiceStatus: "error",
      draftStatus: "needs-clarification",
      lastHeardText: transcript,
      error: "VYVA could not find emergency contact details in that.",
      activeTargetId: emergencyAgentSectionConfig.targetIds?.addByVoice,
    });
  };

  const confirmVoiceDraft = () => {
    if (!voiceDraft) return;
    const metadata = voiceDraft.metadata ?? {};
    setForm((prev) => ({
      ...prev,
      name: metadata.name ?? prev.name,
      relationship: metadata.relationship ?? prev.relationship,
      primary_phone: metadata.primary_phone ?? prev.primary_phone,
      secondary_phone: metadata.secondary_phone ?? prev.secondary_phone,
      address: metadata.address ?? prev.address,
    }));
    setVoiceDraft(null);
    setAutoSaveStatus("idle");
    setVoiceGuidance({
      voiceStatus: "idle",
      draftStatus: "confirmed-locally",
      activeTargetId: emergencyAgentSectionConfig.targetIds?.reviewSave,
    });
  };

  const isValid = form.name.trim() && form.primary_phone.trim();

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/emergency", {
        method: "POST",
        body: JSON.stringify(buildEmergencyPayload(form)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      setAutoSaveStatus("saved");
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: "saved" });
      navigate(completePath());
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save emergency contact", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const FieldSkeleton = () => <Skeleton className="h-11 w-full rounded-lg" />;

  return (
    <PhoneFrame subtitle="Emergency contact" showBack onBack={() => navigate("/onboarding/profile")} homeMasterBackPath="/dev/home-master/profile" showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={ShieldAlert}
          title="Emergency contact"
          kicker="Safety net"
          description="Choose the person VYVA should contact first if you need urgent help and cannot respond."
          badges={[
            { label: "24/7 reach", color: "red" },
            { label: "Urgent only", color: "amber" },
            { label: "Protected", color: "purple" },
          ]}
          iconBgClassName="bg-[#B91C1C]"
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-emergency-autosave" }}
        />

        <div className="rounded-[24px] border border-red-100 bg-red-50 px-4 py-3 text-[15px] font-semibold leading-relaxed text-red-700">
          This person can be the same as your caregiver. Their number is shared with emergency services only when needed.
        </div>

        {companionMode !== "voice" ? (
          <OnboardingCompanionTarget targetId="emergency-add-by-voice">
            <ProfileVoiceAction
              icon={Mic}
              title="Add by voice"
              description="Say their name, relationship, and phone."
              onClick={startVoiceEmergencyCapture}
              testId="button-emergency-speak-it"
              disabled={isLoading}
            />
          </OnboardingCompanionTarget>
        ) : null}

        {voiceDraft ? (
          <OnboardingCompanionTarget targetId="emergency-voice-draft">
            <ProfileVoiceDraftReview
              draft={voiceDraft}
              confirmLabel="Add contact"
              tryAgainLabel="Try again"
              dismissLabel="Dismiss"
              onConfirm={confirmVoiceDraft}
              onTryAgain={startVoiceEmergencyCapture}
              onDismiss={() => setVoiceDraft(null)}
              onRemoveRow={(value) => {
                const command = parseProfileVoiceCommand("emergency", `remove ${value}`);
                if (!command) return;
                setVoiceDraft((current) =>
                  current ? applyProfileVoiceCorrection(current, command) : current,
                );
                setVoiceGuidance({ voiceStatus: "idle", draftStatus: "corrected-draft" });
              }}
              testId="panel-emergency-voice-draft"
            />
          </OnboardingCompanionTarget>
        ) : null}

        <div className="space-y-1.5">
          <Label className="text-[15px] font-extrabold text-gray-700">Full name</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-name" placeholder="Name of emergency contact" value={form.name} onChange={(e) => set("name", e.target.value)} className={seniorInputClassName} />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[15px] font-extrabold text-gray-700">Relationship to you</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-relationship" placeholder="e.g. Daughter, Neighbour, Carer" value={form.relationship} onChange={(e) => set("relationship", e.target.value)} className={seniorInputClassName} />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 min-[620px]:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">Primary phone (24/7)</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input data-testid="input-emergency-primary-phone" type="tel" placeholder="Always reachable" value={form.primary_phone} onChange={(e) => set("primary_phone", e.target.value)} className={seniorInputClassName} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">Secondary phone</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input data-testid="input-emergency-secondary-phone" type="tel" placeholder="Backup number" value={form.secondary_phone} onChange={(e) => set("secondary_phone", e.target.value)} className={seniorInputClassName} />
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[15px] font-extrabold text-gray-700">Their address (for emergency services)</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-address" placeholder="If different from yours" value={form.address} onChange={(e) => set("address", e.target.value)} className={seniorInputClassName} />
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <OnboardingCompanionTarget targetId="emergency-review-save">
          <Button data-testid="button-emergency-save" onClick={handleSave} disabled={!isValid || saving || isLoading} className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f] disabled:opacity-40">
            {saving ? "Saving..." : "Save emergency contact"}
          </Button>
          </OnboardingCompanionTarget>
          <button data-testid="button-emergency-skip" onClick={() => navigate("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">Skip for now</button>
        </div>
      </div>
      {speakItOpen ? (
        <SpeakItOverlay
          title="Tell VYVA your emergency contact"
          hint='e.g. "My emergency contact is Sara, my daughter, phone +34 612 345 678"'
          onDone={handleSpeakItDone}
          onCancel={() => setSpeakItOpen(false)}
        />
      ) : null}
    </PhoneFrame>
  );
}
