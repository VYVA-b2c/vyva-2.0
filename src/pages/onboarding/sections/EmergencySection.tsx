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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const RELATIONSHIPS = [
  "Spouse or partner",
  "Daughter",
  "Son",
  "Parent",
  "Sibling",
  "Friend",
  "Neighbour",
  "Caregiver",
  "Other",
] as const;

const COUNTRY_CODES = [
  { code: "+34", label: "Spain" },
  { code: "+44", label: "UK" },
  { code: "+1", label: "US / Canada" },
  { code: "+33", label: "France" },
  { code: "+49", label: "Germany" },
  { code: "+351", label: "Portugal" },
  { code: "+39", label: "Italy" },
  { code: "+31", label: "Netherlands" },
  { code: "+353", label: "Ireland" },
] as const;

function splitInternationalPhone(value: string | undefined, fallbackCode = "+34") {
  const trimmed = value?.trim() ?? "";
  const knownCode = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find(({ code }) => trimmed.startsWith(code))?.code;
  if (knownCode) return { code: knownCode, number: trimmed.slice(knownCode.length).trim() };
  const match = trimmed.match(/^(\+\d{1,4})\s+(.*)$/);
  return match ? { code: match[1], number: match[2] } : { code: fallbackCode, number: trimmed };
}

function formatInternationalPhone(code: string, number: string) {
  return number.trim() ? `${code} ${number.trim()}` : "";
}

export default function EmergencySection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [form, setForm] = useState<EmergencyForm>({
    name: "", relationship: "",
    primary_phone: "", secondary_phone: "", address: "",
  });
  const [saving, setSaving] = useState(false);
  const [primaryDialCode, setPrimaryDialCode] = useState("+34");
  const [secondaryDialCode, setSecondaryDialCode] = useState("+34");
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
    emergency_phone: formatInternationalPhone(primaryDialCode, current.primary_phone),
    emergency_role: current.relationship,
    secondary_phone: formatInternationalPhone(secondaryDialCode, current.secondary_phone),
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
      const primary = splitInternationalPhone(ec.primary_phone);
      const secondary = splitInternationalPhone(ec.secondary_phone);
      setPrimaryDialCode(primary.code);
      setSecondaryDialCode(secondary.code);
      setForm((prev) => ({
        name:            ec.name            ?? prev.name,
        relationship:    ec.relationship    ?? prev.relationship,
        primary_phone:   primary.number || prev.primary_phone,
        secondary_phone: secondary.number || prev.secondary_phone,
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
    const primary = splitInternationalPhone(metadata.primary_phone, primaryDialCode);
    const secondary = splitInternationalPhone(metadata.secondary_phone, secondaryDialCode);
    setPrimaryDialCode(primary.code);
    setSecondaryDialCode(secondary.code);
    setForm((prev) => ({
      ...prev,
      name: metadata.name ?? prev.name,
      relationship: metadata.relationship ?? prev.relationship,
      primary_phone: primary.number || prev.primary_phone,
      secondary_phone: secondary.number || prev.secondary_phone,
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
    <PhoneFrame subtitle="Emergency contact" showBack onBack={() => navigate("/onboarding/profile/group/emergency")} homeMasterBackPath="/dev/home-master/profile">
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          hideTitle
          icon={ShieldAlert}
          title="Emergency contact"
          kicker="Safety net"
          description="Choose one person VYVA should contact in an emergency. This can be your caregiver; their number is shared only when needed."
          iconBgClassName="bg-[#B91C1C]"
          className="home-master-profile-emergency-summary rounded-[24px] border border-red-100 bg-red-50 px-5 py-4"
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-emergency-autosave" }}
        />

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
            <Select value={form.relationship} onValueChange={(value) => set("relationship", value)}>
              <SelectTrigger data-testid="input-emergency-relationship" className={seniorInputClassName}>
                <SelectValue placeholder="Choose relationship" />
              </SelectTrigger>
              <SelectContent>
                {form.relationship && !RELATIONSHIPS.includes(form.relationship as typeof RELATIONSHIPS[number]) ? (
                  <SelectItem value={form.relationship}>{form.relationship}</SelectItem>
                ) : null}
                {RELATIONSHIPS.map((relationship) => (
                  <SelectItem key={relationship} value={relationship}>{relationship}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 min-[620px]:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">Primary phone (24/7)</Label>
            {isLoading ? <FieldSkeleton /> : (
              <div className="flex gap-2">
                <Select value={primaryDialCode} onValueChange={setPrimaryDialCode}>
                  <SelectTrigger aria-label="Primary phone country code" data-testid="select-emergency-primary-country-code" className={`${seniorInputClassName} w-[132px] shrink-0 px-3`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!COUNTRY_CODES.some(({ code }) => code === primaryDialCode) ? <SelectItem value={primaryDialCode}>{primaryDialCode}</SelectItem> : null}
                    {COUNTRY_CODES.map(({ code, label }) => <SelectItem key={code} value={code}>{label} {code}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input data-testid="input-emergency-primary-phone" type="tel" inputMode="tel" placeholder="Phone number" value={form.primary_phone} onChange={(e) => set("primary_phone", e.target.value)} className={`${seniorInputClassName} min-w-0`} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">Secondary phone</Label>
            {isLoading ? <FieldSkeleton /> : (
              <div className="flex gap-2">
                <Select value={secondaryDialCode} onValueChange={setSecondaryDialCode}>
                  <SelectTrigger aria-label="Secondary phone country code" data-testid="select-emergency-secondary-country-code" className={`${seniorInputClassName} w-[132px] shrink-0 px-3`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!COUNTRY_CODES.some(({ code }) => code === secondaryDialCode) ? <SelectItem value={secondaryDialCode}>{secondaryDialCode}</SelectItem> : null}
                    {COUNTRY_CODES.map(({ code, label }) => <SelectItem key={code} value={code}>{label} {code}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input data-testid="input-emergency-secondary-phone" type="tel" inputMode="tel" placeholder="Backup number" value={form.secondary_phone} onChange={(e) => set("secondary_phone", e.target.value)} className={`${seniorInputClassName} min-w-0`} />
              </div>
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
