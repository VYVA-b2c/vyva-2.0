// src/pages/onboarding/sections/AddressSection.tsx
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { normalizeAddressCountry as normaliseCountry, addressCountryLabel } from "@/lib/addressCountry";
import { useLanguage } from "@/i18n";
import { addressText, type AddressTextKey } from "@/i18n/address";
import { MapPin, Mic, Loader2, CheckCircle2 } from "lucide-react";
import {
  applyProfileVoiceCorrection,
  createAddressVoiceDraft,
  parseProfileVoiceCommand,
  type ProfileVoiceDraft,
} from "@/lib/profileVoiceCompletion";

type AddressForm = {
  address_line_1: string;
  address_line_2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
};

type ReverseGeocodeResponse = {
  formattedAddress?: string;
  address?: Partial<AddressForm> & { country_code?: string };
};

const EMPTY_FORM: AddressForm = {
  address_line_1: "", address_line_2: "", city: "",
  region: "", postcode: "", country: "Spain",
};

const COUNTRIES = [
  "Spain", "United Kingdom", "France", "Germany", "Italy",
  "Portugal", "Netherlands", "Belgium", "Switzerland", "Austria",
  "Ireland", "United States", "Canada", "Australia", "Other",
];

export default function AddressSection() {
  const { language } = useLanguage();
  const copy = useCallback((key: AddressTextKey, params?: Record<string, string | number>) => addressText(language, key, params), [language]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
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
  const addressAgentSectionConfig = useMemo(
    () =>
      createProfileOnboardingAgentSectionConfig({
        sectionId: "address",
        sectionLabel: copy("Home address"),
        voicePrompt: copy("Tell VYVA your home address."),
        expectedFields: ["address_line_1", "address_line_2", "city", "region", "postcode", "country"],
        targetIds: {
          addByVoice: "address-add-by-voice",
          draftReview: "address-voice-draft",
          reviewSave: "address-review-save",
        },
      }),
    [copy],
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
    sectionConfig: addressAgentSectionConfig,
    companionMode,
    setCompanionMode,
    setGuidance,
    setVoiceDraft,
    existingProfileSummary: () => Object.values(formRef.current).filter(Boolean).join(", ") || undefined,
    activeDraftId: () => voiceDraft?.id,
  });

  const startVoiceAddressCapture = useCallback(() => {
    void startRuntimeCapture({ fallback: () => setSpeakItOpen(true) });
  }, [startRuntimeCapture]);

  useEffect(() => {
    const unregister = registerVoiceAction({
      id: "profile-address-voice-capture",
      label: copy("Speak it"),
      description: "Say your home address.",
      sectionConfig: addressAgentSectionConfig,
      targetId: addressAgentSectionConfig.targetIds?.addByVoice,
      onStart: startVoiceAddressCapture,
    });
    return unregister;
  }, [addressAgentSectionConfig, copy, registerVoiceAction, startVoiceAddressCapture]);

  useEffect(() => {
    if (companionMode !== "voice") {
      clearGuidance();
      return;
    }

    setGuidance({
      voiceStatus: parsing ? "thinking" : "idle",
      draftStatus: voiceDraft ? "parsed-draft" : "idle",
      currentSectionId: addressAgentSectionConfig.sectionId,
      currentSectionLabel: addressAgentSectionConfig.sectionLabel,
      currentPrompt: voiceDraft ? copy("Review the address before adding it.") : addressAgentSectionConfig.voicePrompt,
      activeTargetId: voiceDraft
        ? addressAgentSectionConfig.targetIds?.draftReview
        : addressAgentSectionConfig.targetIds?.addByVoice,
    });

    return () => clearGuidance();
  }, [addressAgentSectionConfig, clearGuidance, companionMode, copy, parsing, setGuidance, voiceDraft]);

  const buildAddressPayload = (current: AddressForm) => ({
    address_line_1: current.address_line_1,
    address_line_2: current.address_line_2,
    city: current.city,
    region: current.region,
    postcode: current.postcode,
    country_code: current.country,
  });

  const completePath = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo
      ? `/onboarding/complete/address?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/complete/address";
  };

  const { data, isLoading } = useQuery<{ profile: AddressForm | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      setForm((prev) => ({
        address_line_1: p.address_line_1 ?? prev.address_line_1,
        address_line_2: p.address_line_2 ?? prev.address_line_2,
        city:           p.city           ?? prev.city,
        region:         p.region         ?? prev.region,
        postcode:       p.postcode       ?? prev.postcode,
        country:        normaliseCountry((p as AddressForm & { country_code?: string }).country_code || p.country || prev.country),
      }));
    }
  }, [data]);

  const set = (field: keyof AddressForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setAutoSaveStatus("idle");
  };

  const applyAddress = (patch: Partial<AddressForm>) => {
    setForm((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch) as (keyof AddressForm)[]) {
        const v = patch[k];
        if (v && v.trim()) next[k] = v.trim();
      }
      return next;
    });
    setAutoSaveStatus("idle");
  };

  //  Detect my location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: copy("Location not supported"), description: copy("Your browser doesn't support location detection."), variant: "destructive" });
      return;
    }
    setDetecting(true);
    setDetected(false);
    setLocationAccuracy(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon, accuracy } = pos.coords;
          let geocoded: ReverseGeocodeResponse | null = null;

          try {
            const params = new URLSearchParams({ lat: String(lat), lng: String(lon) });
            const googleRes = await apiFetch(`/api/places/reverse-geocode?${params.toString()}`);
            if (googleRes.ok) geocoded = await googleRes.json() as ReverseGeocodeResponse;
          } catch {
            geocoded = null;
          }

          if (!geocoded?.address) {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Geocoding failed");
            const json = await res.json() as { address: Record<string, string> };
            const a = json.address ?? {};
            const houseNo   = a.house_number ?? "";
            const road      = a.road ?? a.street ?? a.pedestrian ?? "";
            geocoded = {
              address: {
                address_line_1: houseNo ? `${houseNo} ${road}` : road,
                address_line_2: a.suburb ?? a.neighbourhood ?? a.quarter ?? "",
                city: a.city ?? a.town ?? a.village ?? a.municipality ?? "",
                postcode: a.postcode ?? "",
                region: a.state ?? a.county ?? "",
                country: a.country ?? "",
              },
            };
          }

          const addr = geocoded.address ?? {};
          const country = normaliseCountry(addr.country_code ?? addr.country ?? "");
          if (!addr.address_line_1?.trim() && !addr.city?.trim()) throw new Error("No usable address found");
          // A new detected location must not inherit a street or postcode from the old one.
          setForm({
            address_line_1: addr.address_line_1?.trim() ?? "",
            address_line_2: addr.address_line_2?.trim() ?? "",
            city: addr.city?.trim() ?? "",
            region: addr.region?.trim() ?? "",
            postcode: addr.postcode?.trim() ?? "",
            country,
          });
          setAutoSaveStatus("idle");
          setLocationAccuracy(Math.round(accuracy));
          setDetected(true);
          toast({
            title: copy("Location detected"),
            description: copy("We found your address within about {meters}m. Please check the house/floor details.", { meters: Math.round(accuracy) }),
          });
        } catch {
          toast({ title: copy("Address lookup unavailable"), description: copy("Your existing address has not changed. Review and save it, or enter a different address manually."), variant: "destructive" });
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        const msg = err.code === 1
          ? copy("Location permission was denied. Please allow location access and try again.")
          : copy("Could not detect your location. Please fill in the address manually.");
        toast({ title: copy("Location unavailable"), description: msg, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  //  Speak your address
  const handleSpeakItDone = async (transcript: string) => {
    setSpeakItOpen(false);
    if (!transcript.trim()) return;
    const command = parseProfileVoiceCommand("address", transcript);
    if (command?.kind === "try-again") {
      startVoiceAddressCapture();
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
          ? addressAgentSectionConfig.targetIds?.draftReview
          : addressAgentSectionConfig.targetIds?.addByVoice,
      });
      return;
    }
    setParsing(true);
    try {
      const res = await apiFetch("/api/address-voice-parse", {
        method: "POST",
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error("parse failed");
      const data = (await res.json()) as { address: Partial<AddressForm> };
      const addr = data.address ?? {};
      const hasAny = Object.values(addr).some((v) => v && v.trim());
      if (!hasAny) {
        toast({ title: copy("Couldn't read the address"), description: copy("Try speaking more clearly, e.g. \"42 Calle Mayor, Zamora, Spain\"") });
        return;
      }
      if (addr.country) addr.country = normaliseCountry(addr.country);
      const draft = createAddressVoiceDraft(addr);
      if (!draft) {
        setVoiceGuidance({
          voiceStatus: "error",
          draftStatus: "needs-clarification",
          lastHeardText: transcript,
          error: copy("VYVA could not find an address in that."),
          activeTargetId: addressAgentSectionConfig.targetIds?.addByVoice,
        });
        toast({ title: copy("Couldn't read the address"), description: copy("Try speaking more clearly, e.g. \"42 Calle Mayor, Zamora, Spain\"") });
        return;
      }
      setVoiceDraft(draft);
      setVoiceGuidance({
        voiceStatus: "idle",
        draftStatus: "parsed-draft",
        lastHeardText: transcript,
        activeTargetId: addressAgentSectionConfig.targetIds?.draftReview,
      });
      toast({ title: copy("Address ready to review"), description: copy("Please check it before adding it to the form.") });
    } catch {
      toast({ title: copy("Couldn't process your address"), description: copy("Please fill in the fields manually."), variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const confirmVoiceDraft = () => {
    if (!voiceDraft) return;
    const metadata = voiceDraft.metadata ?? {};
    applyAddress({
      address_line_1: metadata.address_line_1,
      address_line_2: metadata.address_line_2,
      city: metadata.city,
      region: metadata.region,
      postcode: metadata.postcode,
      country: metadata.country ? normaliseCountry(metadata.country) : undefined,
    });
    setVoiceDraft(null);
    setVoiceGuidance({
      voiceStatus: "idle",
      draftStatus: "confirmed-locally",
      activeTargetId: addressAgentSectionConfig.targetIds?.reviewSave,
    });
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/address", {
        method: "POST",
        body: JSON.stringify(buildAddressPayload(form)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      setAutoSaveStatus("saved");
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: "saved" });
      navigate(completePath());
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: copy("Could not save home address"), description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const FieldSkeleton = () => <Skeleton className="h-11 w-full rounded-lg" />;

  return (
    <PhoneFrame subtitle={copy("Home address")} showBack onBack={() => navigate("/onboarding/profile/group/account")}>
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          hideTitle
          icon={MapPin}
          title={copy("Home address")}
          kicker={copy("Local help")}
          description={copy("VYVA uses your address for safety features, local services, and emergency support only when needed.")}
          badges={[
            { label: copy("Safety"), color: "red" },
            { label: copy("Local services"), color: "green" },
            { label: copy("Private"), color: "purple" },
          ]}
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-address-autosave" }}
        />

        {/*  Quick-fill row  */}
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
          {/* Detect my location */}
          <button
            type="button"
            data-testid="button-address-detect-location"
            onClick={handleDetectLocation}
            disabled={detecting || isLoading}
            className="home-master-profile-location-action flex min-h-[86px] items-center gap-4 rounded-[24px] px-4 py-4 text-left shadow-[0_12px_28px_rgba(34,197,94,0.12)] transition-all disabled:opacity-60"
            style={{
              background: detected ? "#ECFDF5" : "#F0FDF4",
              border: detected ? "1px solid #A7F3D0" : "1px solid #BBF7D0",
            }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{ background: detected ? "#10B981" : "#22C55E" }}
            >
              {detecting
                ? <Loader2 size={14} className="text-white animate-spin" />
                : detected
                  ? <CheckCircle2 size={14} className="text-white" />
                  : <MapPin size={14} className="text-white" />
              }
            </div>
            <div className="min-w-0">
              <p className="home-master-profile-location-title font-body text-[18px] font-black leading-tight" style={{ color: "#15803D" }}>
                {detecting ? copy("Detecting...") : detected ? copy("Location used!") : copy("Detect my location")}
              </p>
              <p className="home-master-profile-location-copy mt-1 font-body text-[14px] font-semibold" style={{ color: "#16A34A" }}>
                {detecting
                  ? copy("High-accuracy GPS")
                  : locationAccuracy
                    ? copy("Approx. +/-{meters}m", { meters: locationAccuracy })
                    : copy("Auto-fill from GPS")
                }
              </p>
            </div>
          </button>

          {companionMode !== "voice" ? (
            <OnboardingCompanionTarget targetId="address-add-by-voice">
              <ProfileVoiceAction
                icon={Mic}
                title={copy("Speak it")}
                description={copy("Say your address")}
                onClick={startVoiceAddressCapture}
                testId="button-address-speak-it"
                className="min-h-[86px]"
                disabled={isLoading}
                busy={parsing}
                busyLabel={copy("Reading...")}
              />
            </OnboardingCompanionTarget>
          ) : null}
        </div>

        {voiceDraft ? (
          <OnboardingCompanionTarget targetId="address-voice-draft">
            <ProfileVoiceDraftReview
              draft={voiceDraft}
              confirmLabel={copy("Add address")}
              tryAgainLabel={copy("Try again")}
              dismissLabel={copy("Dismiss")}
              onConfirm={confirmVoiceDraft}
              onTryAgain={startVoiceAddressCapture}
              onDismiss={() => setVoiceDraft(null)}
              onRemoveRow={(value) => {
                const command = parseProfileVoiceCommand("address", `remove ${value}`);
                if (!command) return;
                setVoiceDraft((current) =>
                  current ? applyProfileVoiceCorrection(current, command) : current,
                );
                setVoiceGuidance({ voiceStatus: "idle", draftStatus: "corrected-draft" });
              }}
              testId="panel-address-voice-draft"
            />
          </OnboardingCompanionTarget>
        ) : null}

        {/* Divider with label */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[11px] text-gray-400 font-medium">{copy("or fill in below")}</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/*  Address fields  */}
        <div className="space-y-1.5">
          <Label className="text-[15px] font-extrabold text-gray-700">{copy("Street address")}</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input
              data-testid="input-address-line1"
              placeholder={copy("House number & street name")}
              value={form.address_line_1}
              onChange={(e) => set("address_line_1", e.target.value)}
              className={seniorInputClassName}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[15px] font-extrabold text-gray-700">{copy("Floor / apartment")} <span className="font-normal text-gray-400">{copy("(optional)")}</span></Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input
              data-testid="input-address-line2"
              placeholder={copy("Floor, flat number, building name")}
              value={form.address_line_2}
              onChange={(e) => set("address_line_2", e.target.value)}
              className={seniorInputClassName}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 min-[620px]:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">{copy("City / Town")}</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input
                data-testid="input-address-city"
                placeholder="Zamora"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className={seniorInputClassName}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">{copy("Postcode")}</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input
                data-testid="input-address-postcode"
                placeholder="49001"
                value={form.postcode}
                onChange={(e) => set("postcode", e.target.value)}
                className={seniorInputClassName}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[620px]:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">{copy("Region / Province")}</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input
                data-testid="input-address-region"
                placeholder="Castilla y León"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                className={seniorInputClassName}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[15px] font-extrabold text-gray-700">{copy("Country")}</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Select value={form.country} onValueChange={(v) => set("country", v)}>
                <SelectTrigger data-testid="select-address-country" className={seniorInputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c === "Other" ? copy("Other") : addressCountryLabel(c, language)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Save / Skip */}
        <div className="flex flex-col gap-2 pt-2">
          <OnboardingCompanionTarget targetId="address-review-save">
          <Button
            data-testid="button-address-save"
            onClick={handleSave}
            disabled={saving || isLoading}
            className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f]"
          >
            {saving ? copy("Saving...") : copy("Save home address")}
          </Button>
          </OnboardingCompanionTarget>
        </div>
      </div>

      {/* SpeakIt overlay */}
      {speakItOpen && (
        <SpeakItOverlay
          title={copy("Say your home address")}
          hint={copy("Try speaking more clearly, e.g. \"42 Calle Mayor, Zamora, Spain\"")}
          onDone={handleSpeakItDone}
          onCancel={() => setSpeakItOpen(false)}
        />
      )}
    </PhoneFrame>
  );
}
