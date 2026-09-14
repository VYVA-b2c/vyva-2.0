import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Mic, Stethoscope } from "lucide-react";
import { OnboardingCompanionModeChip } from "@/components/onboarding/OnboardingCompanionModeChip";
import { OnboardingCompanionTarget } from "@/components/onboarding/OnboardingCompanionTarget";
import { ProfileSectionHero, seniorInputClassName } from "@/components/onboarding/ProfileSectionHero";
import { ProfileVoiceAction } from "@/components/onboarding/ProfileSectionControls";
import { ProfileVoiceDraftReview } from "@/components/onboarding/ProfileVoiceDraftReview";
import { useOnboardingAgent } from "@/components/onboarding/useOnboardingAgent";
import { useOnboardingElevenLabsSectionRuntime } from "@/components/onboarding/useOnboardingElevenLabsSectionRuntime";
import { createProfileOnboardingAgentSectionConfig } from "@/components/onboarding/profileOnboardingAgentSections";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlacesSearch, PlaceResult } from "@/components/onboarding/PlacesSearch";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import type { ProfileVoiceDraft } from "@/lib/profileVoiceCompletion";

type GpProfile = {
  gp_name?: string;
  gp_phone?: string;
  gp_email?: string;
  gp_address?: string;
  gp_maps_url?: string;
  gp_place_id?: string;
};

const GP_COMPANION_TARGETS = {
  addByVoice: "gp-add-by-voice",
  draftReview: "gp-draft-review",
  reviewSave: "gp-review-save",
} as const;

const GPSection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [initialGp, setInitialGp] = useState<PlaceResult | null>(null);
  const [initialGpEmail, setInitialGpEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [isChangingGP, setIsChangingGP] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<ProfileVoiceDraft | null>(null);
  const {
    mode: companionMode,
    setMode: setCompanionMode,
    setGuidance,
    clearGuidance,
    registerVoiceAction,
  } = useOnboardingAgent();
  const gpAgentSectionConfig = useMemo(
    () =>
      createProfileOnboardingAgentSectionConfig({
        sectionId: "gp",
        sectionLabel: "GP details",
        voicePrompt: "Tell VYVA your GP or practice name and any contact details you know.",
        expectedFields: ["name", "address", "phone", "email"],
        draftRowLabels: {
          name: "Practice / Surgery name",
          address: "Address",
          phone: "Phone",
          email: "Email",
        },
        targetIds: GP_COMPANION_TARGETS,
      }),
    [],
  );

  const gpDataRef = useRef({ manualName, manualAddress, manualPhone, manualEmail, place });
  useEffect(() => {
    gpDataRef.current = { manualName, manualAddress, manualPhone, manualEmail, place };
  }, [manualName, manualAddress, manualPhone, manualEmail, place]);

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const { data, isLoading } = useQuery<{ profile: GpProfile | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (data?.profile?.gp_name) {
      const p = data.profile;
      const saved: PlaceResult = {
        name: p.gp_name!,
        full_address: p.gp_address ?? "",
        phone: p.gp_phone ?? "",
        google_place_id: p.gp_place_id ?? "",
        google_maps_url: p.gp_maps_url ?? "",
      };
      setInitialGp(saved);
      setPlace(saved);
      setManualName(p.gp_name!);
      setManualAddress(p.gp_address ?? "");
      setManualPhone(p.gp_phone ?? "");
      setManualEmail(p.gp_email ?? "");
      setInitialGpEmail(p.gp_email ?? "");
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave, setAutoSaveStatus } = useAutoSave(
    async () => {
      const { manualName, manualAddress, manualPhone, manualEmail, place } = gpDataRef.current;
      if (!manualName.trim()) return;
      const res = await apiFetch("/api/onboarding/section/gp", {
        method: "POST",
        body: JSON.stringify({
          gp_name:     manualName,
          gp_phone:    manualPhone,
          gp_email:    manualEmail,
          gp_address:  manualAddress,
          gp_maps_url: place?.google_maps_url ?? "",
          gp_place_id: place?.google_place_id ?? "",
        }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
    },
    2000,
  );

  const usingSearch = !!place;

  const { startRuntimeCapture } = useOnboardingElevenLabsSectionRuntime({
    sectionConfig: gpAgentSectionConfig,
    companionMode,
    setCompanionMode,
    setGuidance,
    setVoiceDraft,
    existingProfileSummary: () => {
      const current = gpDataRef.current;
      return [
        current.manualName ? `Current GP: ${current.manualName}` : "",
        current.manualAddress ? `Address: ${current.manualAddress}` : "",
        current.manualPhone ? `Phone: ${current.manualPhone}` : "",
        current.manualEmail ? `Email: ${current.manualEmail}` : "",
      ].filter(Boolean).join(". ") || undefined;
    },
    activeDraftId: () => voiceDraft?.id,
  });

  const startVoiceGpCapture = useCallback(() => {
    void startRuntimeCapture({
      fallback: () =>
        toast({
          title: "Voice is not ready",
          description: "Use the fields below, then save when the details look right.",
        }),
    });
  }, [startRuntimeCapture, toast]);

  useEffect(
    () =>
      registerVoiceAction({
        id: "profile-gp-voice-capture",
        label: "Tell VYVA",
        description: "Say the GP or practice name and contact details.",
        sectionId: "gp",
        sectionLabel: gpAgentSectionConfig.sectionLabel,
        targetId: gpAgentSectionConfig.targetIds?.addByVoice,
        sectionConfig: gpAgentSectionConfig,
        onStart: startVoiceGpCapture,
      }),
    [gpAgentSectionConfig, registerVoiceAction, startVoiceGpCapture],
  );

  useEffect(() => {
    if (companionMode !== "voice") {
      clearGuidance();
      return;
    }

    setGuidance({
      voiceStatus: "idle",
      draftStatus: voiceDraft ? "parsed-draft" : "idle",
      currentSectionId: gpAgentSectionConfig.sectionId,
      currentSectionLabel: gpAgentSectionConfig.sectionLabel,
      currentPrompt: voiceDraft
        ? "Review these GP details before adding them locally."
        : gpAgentSectionConfig.voicePrompt,
      activeTargetId: voiceDraft
        ? gpAgentSectionConfig.targetIds?.draftReview
        : gpAgentSectionConfig.targetIds?.addByVoice,
    });

    return () => clearGuidance();
  }, [clearGuidance, companionMode, gpAgentSectionConfig, setGuidance, voiceDraft]);

  const gpDraftRow = useCallback((draft: ProfileVoiceDraft, ids: string[]) => {
    const normalizedIds = new Set(ids.map((id) => id.toLowerCase()));
    return draft.rows.find((row) => normalizedIds.has(row.id.toLowerCase()))?.value ?? "";
  }, []);

  const confirmVoiceDraft = useCallback(() => {
    if (!voiceDraft) return;
    const metadata = voiceDraft.metadata ?? {};
    const name =
      metadata.name ||
      metadata.gp_name ||
      metadata.practice ||
      metadata.provider ||
      gpDraftRow(voiceDraft, ["name", "gp_name", "practice", "provider"]) ||
      voiceDraft.values[0] ||
      "";

    if (!name.trim()) {
      setGuidance({
        voiceStatus: "error",
        draftStatus: "needs-clarification",
        currentSectionId: gpAgentSectionConfig.sectionId,
        currentSectionLabel: gpAgentSectionConfig.sectionLabel,
        currentPrompt: "Please tell VYVA the GP or practice name before adding it.",
        activeTargetId: gpAgentSectionConfig.targetIds?.addByVoice,
      });
      return;
    }

    cancelAutoSave();
    setPlace(null);
    setManualName(name);
    setManualAddress(metadata.address || metadata.gp_address || gpDraftRow(voiceDraft, ["address", "gp_address"]));
    setManualPhone(metadata.phone || metadata.gp_phone || gpDraftRow(voiceDraft, ["phone", "gp_phone"]));
    setManualEmail(metadata.email || metadata.gp_email || gpDraftRow(voiceDraft, ["email", "gp_email"]));
    setIsChangingGP(true);
    setVoiceDraft(null);
    setGuidance({
      voiceStatus: "thinking",
      draftStatus: "confirmed-locally",
      currentSectionId: gpAgentSectionConfig.sectionId,
      currentSectionLabel: gpAgentSectionConfig.sectionLabel,
      currentPrompt: "I added the GP details locally. Review them, then save when ready.",
      activeTargetId: gpAgentSectionConfig.targetIds?.reviewSave,
    });
  }, [cancelAutoSave, gpAgentSectionConfig, gpDraftRow, setGuidance, voiceDraft]);

  const handleSelect = (p: PlaceResult | null) => {
    if (!p) {
      clearLocalPlace();
      return;
    }
    setPlace(p);
    setManualName(p.name);
    setManualAddress(p.full_address);
    setManualPhone(p.phone);
    setManualEmail("");
    scheduleAutoSave();
  };

  const clearLocalPlace = () => {
    cancelAutoSave();
    setPlace(null);
    setManualName("");
    setManualAddress("");
    setManualPhone("");
    setManualEmail("");
  };

  const handleChangeGP = () => {
    clearLocalPlace();
    setIsChangingGP(true);
  };

  const handleCancelChange = () => {
    if (initialGp) {
      setPlace(initialGp);
      setManualName(initialGp.name);
      setManualAddress(initialGp.full_address);
      setManualPhone(initialGp.phone);
      setManualEmail(initialGpEmail);
    }
    setIsChangingGP(false);
  };

  const removeGP = async () => {
    if (removing) return;
    cancelAutoSave();
    setRemoving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/gp", {
        method: "POST",
        body: JSON.stringify({ gp_name: "", gp_phone: "", gp_email: "", gp_address: "", gp_maps_url: "", gp_place_id: "" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPlace(null);
      setInitialGp(null);
      setManualName("");
      setManualAddress("");
      setManualPhone("");
      setManualEmail("");
      setInitialGpEmail("");
      setIsChangingGP(false);
      setAutoSaveStatus("saved");
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not remove GP details", description: msg, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const canSave = usingSearch || manualName.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    cancelAutoSave();
    setSaving(true);
    let navigating = false;
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/gp", {
        method: "POST",
        body: JSON.stringify({
          gp_name:     manualName,
          gp_phone:    manualPhone,
          gp_email:    manualEmail,
          gp_address:  manualAddress,
          gp_maps_url: place?.google_maps_url ?? "",
          gp_place_id: place?.google_place_id ?? "",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      setAutoSaveStatus("saved");
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate("/onboarding/complete/gp"), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save GP details", description: msg, variant: "destructive" });
    } finally {
      if (!navigating) setSaving(false);
    }
  };

  const showSavedCard = !!initialGp && !isChangingGP;

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button
            data-testid="button-gp-back"
            onClick={() => navigate("/onboarding/profile")}
            className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
          >
            <ChevronLeft size={20} className="text-vyva-text-1" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#EFF6FF" }}
            >
              <Stethoscope size={18} style={{ color: "#1D4ED8" }} />
            </div>
            <h1 className="font-display text-[20px] font-semibold text-vyva-text-1">GP details</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 space-y-7">
        <OnboardingCompanionModeChip
          compactLabel="VYVA mode"
          voiceLabel="Voice"
          voiceDescription="VYVA can talk you through this page."
          tactileLabel="Tactile"
          tactileDescription="Use touch or keyboard controls quietly."
          accessibleLabel="Choose voice or tactile help for GP details"
          statusLabels={{
            idle: "Ready",
            listening: "Listening",
            speaking: "Speaking",
            thinking: "Thinking",
            error: "Needs attention",
          }}
        />

        <ProfileSectionHero
          icon={Stethoscope}
          title="Doctor details"
          kicker="One click away"
          description="Add the GP or practice VYVA should keep handy for appointments, reports, and care conversations."
          badges={[
            { label: "Doctor access", color: "blue" },
            { label: "Reports ready", color: "purple" },
            { label: "Easy updates", color: "green" },
          ]}
          iconBgClassName="bg-[#1D4ED8]"
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-gp-autosave" }}
        />

        {companionMode !== "voice" ? (
          <OnboardingCompanionTarget targetId={GP_COMPANION_TARGETS.addByVoice}>
            <ProfileVoiceAction
              icon={Mic}
              title="Tell VYVA your GP details"
              description="Say the practice name, phone, email, or address."
              onClick={startVoiceGpCapture}
              testId="button-gp-voice"
              tone="purple"
              className="bg-white shadow-[0_8px_18px_rgba(53,28,87,0.06)]"
            />
          </OnboardingCompanionTarget>
        ) : null}

        {voiceDraft ? (
          <OnboardingCompanionTarget targetId={GP_COMPANION_TARGETS.draftReview}>
            <ProfileVoiceDraftReview
              draft={voiceDraft}
              confirmLabel="Add these details"
              tryAgainLabel="Try again"
              dismissLabel="Dismiss"
              onConfirm={confirmVoiceDraft}
              onTryAgain={() => {
                setVoiceDraft(null);
                startVoiceGpCapture();
              }}
              onDismiss={() => setVoiceDraft(null)}
              onRemoveRow={(value) =>
                setVoiceDraft((current) => current
                  ? {
                      ...current,
                      rows: current.rows.filter((row) => row.value !== value),
                      values: current.values.filter((rowValue) => rowValue !== value),
                    }
                  : current)
              }
              testId="panel-gp-elevenlabs-confirm"
            />
          </OnboardingCompanionTarget>
        ) : null}

        {showSavedCard ? (
          /* Saved GP summary card  server is not touched when navigating away */
          <div
            className="bg-white rounded-[18px] border border-vyva-border p-4 space-y-3"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            data-testid="card-gp-saved"
          >
            <div>
              <p className="font-body text-[14px] font-extrabold text-vyva-text-2">Practice / Surgery name</p>
              <p data-testid="text-gp-name" className="mt-1 font-body text-[20px] font-black text-vyva-text-1">{initialGp.name}</p>
            </div>
            {initialGp.full_address && (
              <div>
                <p className="font-body text-[14px] font-extrabold text-vyva-text-2">Address</p>
                <p data-testid="text-gp-address" className="mt-1 font-body text-[20px] font-black text-vyva-text-1">{initialGp.full_address}</p>
              </div>
            )}
            {initialGp.phone && (
              <div>
                <p className="font-body text-[14px] font-extrabold text-vyva-text-2">Phone number</p>
                <p data-testid="text-gp-phone" className="mt-1 font-body text-[20px] font-black text-vyva-text-1">{initialGp.phone}</p>
              </div>
            )}
            {initialGpEmail && (
              <div>
                <p className="font-body text-[14px] font-extrabold text-vyva-text-2">Email</p>
                <p data-testid="text-gp-email" className="mt-1 font-body text-[20px] font-black text-vyva-text-1">{initialGpEmail}</p>
              </div>
            )}
            {initialGp.google_maps_url && (
              <a
                data-testid="link-gp-maps"
                href={initialGp.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-[#E7DCF8] bg-white px-4 font-body text-[15px] font-black text-vyva-purple no-underline shadow-sm"
              >
                View on Google Maps</a>
            )}
            <div className="flex items-center gap-4 pt-1">
              <button
                data-testid="button-gp-change"
                onClick={handleChangeGP}
                className="font-body text-[15px] font-black text-vyva-purple underline"
              >
                Change GP
              </button>
              <button
                data-testid="button-gp-remove"
                onClick={removeGP}
                disabled={removing}
                className="font-body text-[15px] font-bold text-red-500 underline disabled:opacity-40"
              >
                {removing ? "Removing..." : "Remove GP"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Search  wrapped for testid targeting */}
            <div>
              <label className="mb-2 block font-body text-[15px] font-extrabold text-vyva-text-2">
                Search for your GP
              </label>
              <div data-testid="search-gp-places">
                <PlacesSearch
                  category="doctor"
                  onSelect={handleSelect}
                  placeholder="Search GP surgery or practice..."
                  initialValue={isChangingGP ? null : initialGp}
                />
              </div>
            </div>

            {/* Filled or manual details */}
            <div
              className="bg-white rounded-[18px] border border-vyva-border p-4 space-y-4"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              data-testid="form-gp-details"
            >
              <div>
                <label className="mb-2 block font-body text-[15px] font-extrabold text-vyva-text-2">
                  Practice / Surgery name
                </label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" data-testid="skeleton-gp-name" />
                ) : (
                  <Input
                    data-testid="input-gp-name"
                    value={manualName}
                    onChange={(e) => { setManualName(e.target.value); setPlace(null); scheduleAutoSave(); }}
                    placeholder="e.g. Riverside Medical Centre"
                    className={seniorInputClassName}
                  />
                )}
              </div>
              <div>
                <label className="mb-2 block font-body text-[15px] font-extrabold text-vyva-text-2">
                  Address
                </label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" data-testid="skeleton-gp-address" />
                ) : (
                  <Input
                    data-testid="input-gp-address"
                    value={manualAddress}
                    onChange={(e) => { setManualAddress(e.target.value); if (place) setPlace(null); scheduleAutoSave(); }}
                    placeholder="Full address"
                    className={seniorInputClassName}
                  />
                )}
              </div>
              <div>
                <label className="mb-2 block font-body text-[15px] font-extrabold text-vyva-text-2">
                  Phone number
                </label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" data-testid="skeleton-gp-phone" />
                ) : (
                  <Input
                    data-testid="input-gp-phone"
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => { setManualPhone(e.target.value); if (place) setPlace(null); scheduleAutoSave(); }}
                    placeholder="+44 1234 567890"
                    className={seniorInputClassName}
                  />
                )}
              </div>
              <div>
                <label className="mb-2 block font-body text-[15px] font-extrabold text-vyva-text-2">
                  Email
                </label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" data-testid="skeleton-gp-email" />
                ) : (
                  <Input
                    data-testid="input-gp-email"
                    type="email"
                    value={manualEmail}
                    onChange={(e) => { setManualEmail(e.target.value); if (place) setPlace(null); scheduleAutoSave(); }}
                    placeholder="practice@example.com"
                    className={seniorInputClassName}
                  />
                )}
              </div>

              {usingSearch && place?.google_maps_url && (
                <a
                  data-testid="link-gp-maps"
                  href={place.google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-full border border-[#E7DCF8] bg-white px-4 font-body text-[15px] font-black text-vyva-purple no-underline shadow-sm"
                >
                  View on Google Maps</a>
              )}
              {usingSearch && (
                <button
                  data-testid="button-gp-clear-place"
                  onClick={clearLocalPlace}
                  className="font-body text-[12px] text-vyva-text-3 underline"
                >
                  Clear and enter manually
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="px-5 py-6 space-y-3">
        {!showSavedCard && (
          <OnboardingCompanionTarget targetId={GP_COMPANION_TARGETS.reviewSave}>
            <button
              data-testid="button-gp-save"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full rounded-full py-4 font-body text-[18px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)] disabled:opacity-40"
              style={{ background: "#6B21A8" }}
            >
              {saving ? "Saving..." : "Save GP details"}
            </button>
          </OnboardingCompanionTarget>
        )}
        {isChangingGP && (
          <button
            data-testid="button-gp-cancel-change"
            onClick={handleCancelChange}
            className="w-full rounded-full border border-vyva-border bg-white py-3 font-body text-[15px] font-black text-vyva-text-2"
          >
            Cancel
          </button>
        )}
        {showSavedCard && (
          <button
            data-testid="button-gp-back-to-profile"
            onClick={() => navigate("/onboarding/profile")}
            className="w-full rounded-full py-4 font-body text-[18px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)]"
            style={{ background: "#6B21A8" }}
          >
            Back to profile
          </button>
        )}
      </div>
    </div>
  );
};

export default GPSection;
