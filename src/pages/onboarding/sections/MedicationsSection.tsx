// src/pages/onboarding/sections/MedicationsSection.tsx
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField, ResponsiveGrid } from "@/components/vyva-ui";
import { SeniorChoiceChips, type SeniorChoiceOption } from "@/components/onboarding/SeniorChoiceChips";
import { Trash2, Loader2, Plus, CheckCircle2, AlertCircle, Mic, Pill, Clock3, Utensils, Stethoscope, Sparkles, ShieldCheck, ChevronDown, ChevronUp, Pencil, Sun, Moon, Coffee, CalendarClock, BadgeCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { friendlyError } from "@/lib/apiError";
import VoiceMedsModal, { type MedicationForForm } from "@/components/VoiceMedsModal";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string;
  with_food: string;
  prescribed_by: string;
}

const emptyMed = (id: string): Medication => ({
  id, name: "", dosage: "", frequency: "", times: "", with_food: "", prescribed_by: "",
});

const STANDARD_FREQUENCIES = ["once_daily", "twice_daily", "three_daily", "as_needed"];
const FREQUENCY_LABELS: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_daily: "3x daily",
  as_needed: "As needed",
};
const FOOD_LABELS: Record<string, string> = {
  with_food: "With food",
  without_food: "Without food",
  doesnt_matter: "Doesn't matter",
};
const TIME_PRESETS: SeniorChoiceOption[] = [
  { label: "Morning", value: "Morning", icon: <Sun size={17} /> },
  { label: "Evening", value: "Evening", icon: <Moon size={17} /> },
  { label: "Bedtime", value: "Bedtime", icon: <Moon size={17} /> },
  { label: "Morning and evening", value: "Morning and evening", icon: <CalendarClock size={17} /> },
];
const FREQUENCY_OPTIONS: SeniorChoiceOption[] = [
  { label: "Once daily", value: "once_daily", icon: <BadgeCheck size={17} /> },
  { label: "Twice daily", value: "twice_daily", icon: <BadgeCheck size={17} /> },
  { label: "3x daily", value: "three_daily", icon: <BadgeCheck size={17} /> },
  { label: "As needed", value: "as_needed", icon: <CalendarClock size={17} /> },
  { label: "Other", value: "other", description: "Type it in your own words", icon: <Pencil size={17} /> },
];
const FOOD_OPTIONS: SeniorChoiceOption[] = [
  { label: "With food", value: "with_food", icon: <Utensils size={17} /> },
  { label: "Without food", value: "without_food", icon: <Coffee size={17} /> },
  { label: "Doesn't matter", value: "doesnt_matter", icon: <BadgeCheck size={17} /> },
];

function isCustomFrequency(value: string): boolean {
  return Boolean(value && !STANDARD_FREQUENCIES.includes(value));
}

function customFrequencyDisplayValue(value: string): string {
  return value === "as_needed" ? "As needed" : value;
}

function parseMedicationTimes(raw: string): string[] | undefined {
  const times = raw
    .split(/[,\n;]+/)
    .map((time) => time.trim())
    .filter(Boolean);

  return times.length > 0 ? times : undefined;
}

function FieldLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-vyva-purple">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function medicationSummary(med: Medication) {
  const details = [
    med.dosage.trim(),
    med.times.trim(),
    FREQUENCY_LABELS[med.frequency] ?? med.frequency.trim(),
    FOOD_LABELS[med.with_food] ?? "",
  ].filter(Boolean);

  return details.length ? details.join(" • ") : "Ready for simple reminders";
}

function hasAdvancedMedicationDetails(med: Medication) {
  return Boolean(med.frequency || med.with_food || med.prescribed_by.trim());
}

function cloneSetWith(value: Set<string>, id: string) {
  const next = new Set(value);
  next.add(id);
  return next;
}

function cloneSetWithout(value: Set<string>, id: string) {
  const next = new Set(value);
  next.delete(id);
  return next;
}

async function saveMedsToServer(meds: Medication[]): Promise<Response> {
  return await apiFetch("/api/onboarding/section/medications", {
    method: "POST",
    body: JSON.stringify({
      medications: meds
        .filter((m) => m.name.trim())
        .map((m) => ({
          medication_name: m.name.trim(),
          dosage: m.dosage.trim() || undefined,
          frequency: m.frequency || undefined,
          scheduled_times: parseMedicationTimes(m.times),
        })),
    }),
  });
}

function medsAreEqual(a: Medication, b: Medication): boolean {
  return (
    a.name === b.name &&
    a.dosage === b.dosage &&
    a.frequency === b.frequency &&
    a.times === b.times &&
    a.with_food === b.with_food &&
    a.prescribed_by === b.prescribed_by
  );
}

export default function MedicationsSection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const counterRef = useRef(1);
  const loadedRef = useRef(false);
  const initialMed = emptyMed("med-1");
  const [meds, setMeds] = useState<Medication[]>([initialMed]);
  const [savedMeds, setSavedMeds] = useState<Medication[]>([initialMed]);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [customFrequencyMedIds, setCustomFrequencyMedIds] = useState<Set<string>>(() => new Set());
  const [expandedMedIds, setExpandedMedIds] = useState<Set<string>>(() => new Set([initialMed.id]));
  const [detailsOpenMedIds, setDetailsOpenMedIds] = useState<Set<string>>(() => new Set());
  const [showMobileActionBar, setShowMobileActionBar] = useState(false);

  // Refs so auto-save closure always sees the latest values
  const medsRef = useRef(meds);
  const busyRef = useRef(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { medsRef.current = meds; }, [meds]);
  useEffect(() => { busyRef.current = saving || autoSaving || adding || !!removingId; }, [saving, autoSaving, adding, removingId]);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);
  useEffect(() => {
    const updateActionBar = () => setShowMobileActionBar(window.scrollY > 260);
    updateActionBar();
    window.addEventListener("scroll", updateActionBar, { passive: true });
    return () => window.removeEventListener("scroll", updateActionBar);
  }, []);

  const completePath = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo
      ? `/onboarding/complete/medications?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/complete/medications";
  };

  const { data, isLoading } = useQuery<{ profile: { medications?: Omit<Medication, "id">[] } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (loadedRef.current) return;
    const saved = (data?.profile as { medications?: Omit<Medication, "id">[] } | null)?.medications;
    if (saved && saved.length > 0) {
      loadedRef.current = true;
      counterRef.current = saved.length;
      const withIds = saved.map((m, i) => ({ ...m, id: `med-${i + 1}` }));
      setMeds(withIds);
      setSavedMeds(withIds);
      setExpandedMedIds(new Set());
      setDetailsOpenMedIds(new Set());
    } else if (data && !isLoading) {
      loadedRef.current = true;
    }
  }, [data, isLoading]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave, setAutoSaveStatus } = useAutoSave(
    async () => {
      if (busyRef.current) return;
      setAutoSaving(true);
      try {
        const currentMeds = medsRef.current;
        const res = await saveMedsToServer(currentMeds);
        if (!res.ok) {
          const msg = await friendlyError(new Error(), res);
          throw new Error(msg);
        }
        setSavedMeds([...currentMeds]);
        queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      } finally {
        setAutoSaving(false);
      }
    },
    2000,
  );

  const updateMed = (id: string, field: keyof Omit<Medication, "id">, value: string) => {
    setMeds((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
    scheduleAutoSave();
  };

  const updateFrequency = (id: string, value: string) => {
    if (value === "other") {
      setCustomFrequencyMedIds((prev) => new Set(prev).add(id));
      const currentFrequency = medsRef.current.find((med) => med.id === id)?.frequency ?? "";
      if (!isCustomFrequency(currentFrequency)) {
        updateMed(id, "frequency", "");
      }
      return;
    }

    setCustomFrequencyMedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    updateMed(id, "frequency", value);
  };

  const updateTimePreset = (id: string, value: string) => {
    updateMed(id, "times", value);
  };

  const toggleDetails = (id: string) => {
    setDetailsOpenMedIds((prev) => (
      prev.has(id) ? cloneSetWithout(prev, id) : cloneSetWith(prev, id)
    ));
  };

  const editMed = (med: Medication) => {
    setExpandedMedIds((prev) => cloneSetWith(prev, med.id));
    if (hasAdvancedMedicationDetails(med)) {
      setDetailsOpenMedIds((prev) => cloneSetWith(prev, med.id));
    }
  };

  const collapseMed = (id: string) => {
    setExpandedMedIds((prev) => cloneSetWithout(prev, id));
  };

  const addMed = async () => {
    if (adding || removingId || saving) return;
    setAdding(true);
    const previous = meds;
    counterRef.current += 1;
    const newMed = emptyMed(`med-${counterRef.current}`);
    const updated = [...previous, newMed];
    setMeds(updated);
    setExpandedMedIds((prev) => cloneSetWith(prev, newMed.id));
    setDetailsOpenMedIds((prev) => cloneSetWithout(prev, newMed.id));
    let res: Response | undefined;
    try {
      res = await saveMedsToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedMeds(updated);
      setAutoSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
    } catch (err) {
      setMeds(previous);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not add medication row", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeMed = async (id: string) => {
    if (removingId || adding || saving) return;
    setRemovingId(id);
    const previous = meds;
    const filtered = previous.filter((m) => m.id !== id);
    counterRef.current += 1;
      const updated = filtered.length > 0 ? filtered : [emptyMed(`med-${counterRef.current}`)];
      setMeds(updated);
      setExpandedMedIds((prev) => {
        const next = cloneSetWithout(prev, id);
        if (updated.length === 1 && !updated[0].name.trim()) next.add(updated[0].id);
        return next;
      });
      setDetailsOpenMedIds((prev) => cloneSetWithout(prev, id));
      let res: Response | undefined;
    try {
      res = await saveMedsToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedMeds(updated);
      setAutoSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
    } catch (err) {
      setMeds(previous);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not remove medication", description: msg, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const addMedFromVoice = useCallback(
    async (voiceMed: MedicationForForm) => {
      if (adding || removingId || saving) return;
      setAdding(true);
      const previous = meds;
      counterRef.current += 1;
      const newId = `med-${counterRef.current}`;
      const newMed: Medication = {
        id: newId,
        name: voiceMed.name,
        dosage: voiceMed.dosage,
        frequency: voiceMed.frequency,
        times: voiceMed.times,
        with_food: voiceMed.with_food,
        prescribed_by: voiceMed.prescribed_by,
      };
      const updated = [...previous, newMed];
      setMeds(updated);
      setExpandedMedIds((prev) => cloneSetWith(prev, newId));
      if (hasAdvancedMedicationDetails(newMed)) {
        setDetailsOpenMedIds((prev) => cloneSetWith(prev, newId));
      }
      let res: Response | undefined;
      try {
        res = await saveMedsToServer(updated);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSavedMeds(updated);
        setAutoSaveStatus("saved");
        queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      } catch (err) {
        setMeds(previous);
        const msg = await friendlyError(err, res && !res.ok ? res : undefined);
        toast({ title: "Could not add medication", description: msg, variant: "destructive" });
      } finally {
        setAdding(false);
      }
    },
    [adding, removingId, saving, meds, setAutoSaveStatus, toast]
  );

  const hasUnsavedChanges = useCallback((): boolean => {
    const hasUnsavedNewMeds = meds
      .slice(savedMeds.length)
      .some((m) => m.name.trim() !== "");
    if (hasUnsavedNewMeds) return true;
    if (savedMeds.length === 0) return false;
    if (meds.length !== savedMeds.length) return true;
    return meds.some((m, i) => !medsAreEqual(m, savedMeds[i]));
  }, [meds, savedMeds]);

  const confirmNavigation = useCallback((destination: string) => {
    if (hasUnsavedChanges()) {
      const ok = window.confirm(
        "You have unsaved changes to your medications. Leave without saving?"
      );
      if (!ok) return;
    }
    navigate(destination);
  }, [hasUnsavedChanges, navigate]);

  const handleSave = async () => {
    if (saving || autoSaving) return;
    cancelAutoSave();
    setSaving(true);
    let navigating = false;
    let res: Response | undefined;
    try {
      res = await saveMedsToServer(meds);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      setSavedMeds(meds);
      setAutoSaveStatus("saved");
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate(completePath()), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save medications", description: msg, variant: "destructive" });
    } finally {
      if (!navigating) setSaving(false);
    }
  };

  const isMedSaved = (idx: number): boolean => {
    if (savedMeds.length === 0) return false;
    if (idx >= savedMeds.length) return false;
    if (!meds[idx]?.name.trim()) return false;
    return medsAreEqual(meds[idx], savedMeds[idx]);
  };

  const isMedDirty = (idx: number): boolean => {
    if (savedMeds.length === 0) return false;
    if (idx >= savedMeds.length) return false;
    return !medsAreEqual(meds[idx], savedMeds[idx]);
  };

  const MedSkeleton = () => (
    <div className="flex flex-col gap-5 rounded-[30px] border border-purple-100 bg-white p-6 shadow-[0_18px_40px_rgba(53,28,87,0.08)]">
      <Skeleton className="h-14 w-full rounded-[18px]" />
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
        <Skeleton className="h-14 w-full rounded-[18px]" />
        <Skeleton className="h-14 w-full rounded-[18px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
        <Skeleton className="h-14 w-full rounded-[18px]" />
        <Skeleton className="h-14 w-full rounded-[18px]" />
      </div>
      <Skeleton className="h-14 w-full rounded-[18px]" />
    </div>
  );

  const busy = saving || autoSaving || adding || !!removingId;
  const inputClassName = "h-14 rounded-[18px] border-[#DDC7FF] bg-white px-4 text-[17px] text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] placeholder:text-[#8D7D73] focus-visible:ring-4 focus-visible:ring-vyva-purple/15";

  return (
    <PhoneFrame subtitle="💊 Medications" showBack onBack={() => confirmNavigation("/onboarding/profile")} showAllSections onAllSections={() => confirmNavigation("/onboarding/profile")}>
      <div className="flex flex-col gap-7 px-1 pb-28 pt-5 sm:px-2 sm:pb-5 md:px-3">
        <div className="rounded-[30px] border border-[#EFE4D5] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFFFFF_58%,#F5ECFF_100%)] p-5 shadow-[0_18px_45px_rgba(53,28,87,0.07)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#7D2BE8] text-white shadow-[0_12px_24px_rgba(125,43,232,0.22)] min-[520px]:flex">
                <Pill size={26} />
              </div>
              <div className="min-w-0">
                <p className="mb-2 inline-flex rounded-full bg-[#FFF1B8] px-3 py-1 text-[12px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">
                  Voice-friendly setup
                </p>
                <h2 className="font-display text-[34px] leading-[1.05] text-vyva-text-1 sm:text-[38px]">Medications</h2>
                <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-vyva-text-2">
                  Add the medicine name first. VYVA saves as you go, and the extra details help reminders feel clear and reliable.
                </p>
              </div>
            </div>
            <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-meds-autosave" />
          </div>
          <div className="mt-5 grid gap-3 min-[520px]:grid-cols-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white bg-white/80 px-4 py-3 text-[15px] font-extrabold text-[#4B3B58] shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[#14B87A]" aria-hidden="true" /> Autosaves
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white bg-white/80 px-4 py-3 text-[15px] font-extrabold text-[#4B3B58] shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" aria-hidden="true" /> Voice option
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white bg-white/80 px-4 py-3 text-[15px] font-extrabold text-[#4B3B58] shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[#7D2BE8]" aria-hidden="true" /> Name is enough
            </div>
          </div>
        </div>

        {/* Add by voice banner */}
        <button
          type="button"
          data-testid="button-meds-voice"
          onClick={() => setVoiceModalOpen(true)}
          className="group flex w-full items-center gap-5 rounded-[28px] border border-[#F9D66A] bg-[#FFF8DB] px-5 py-5 text-left shadow-[0_16px_36px_rgba(245,158,11,0.13)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(245,158,11,0.18)] sm:px-6"
        >
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl shadow-[0_10px_20px_rgba(245,158,11,0.24)]"
            style={{ background: "#F59E0B" }}
          >
            <Mic size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="mb-1 inline-flex rounded-full bg-white/75 px-3 py-1 font-body text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: "#92400E" }}>
              Easiest option
            </p>
            <p className="font-body text-[21px] font-black leading-tight" style={{ color: "#7A3100" }}>
              Add by voice
            </p>
            <p className="mt-1 font-body text-[16px] leading-snug" style={{ color: "#9A4A00" }}>
              Say: "I take Metformin 500mg every morning." VYVA will fill in the details.
            </p>
          </div>
        </button>

        {isLoading ? (
          <MedSkeleton />
        ) : (
          <>
            {meds.map((med, idx) => {
              const saved = isMedSaved(idx);
              const dirty = isMedDirty(idx);
              const hasName = Boolean(med.name.trim());
              const expanded = expandedMedIds.has(med.id) || !hasName || dirty;
              const summaryOnly = hasName && saved && !dirty && !expanded;
              const detailsOpen = detailsOpenMedIds.has(med.id);
              const showCustomFrequency =
                customFrequencyMedIds.has(med.id) || isCustomFrequency(med.frequency);

              return (
                <div
                  key={med.id}
                  data-testid={`card-med-${med.id}`}
                  className={`relative flex flex-col gap-6 overflow-hidden rounded-[30px] border bg-white p-5 shadow-[0_20px_48px_rgba(53,28,87,0.08)] sm:p-6 ${
                    dirty
                      ? "border-amber-300 ring-1 ring-amber-200"
                      : saved
                      ? "border-green-300 ring-1 ring-green-100"
                      : "border-purple-100"
                  }`}
                >
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 ${
                      dirty ? "bg-[#F59E0B]" : saved ? "bg-[#14B87A]" : "bg-[#7D2BE8]"
                    }`}
                  />
                  {summaryOnly ? (
                    <div className="flex flex-col gap-4 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#0A7C4E]">
                          <Pill size={24} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-body text-[22px] font-black leading-tight text-vyva-text-1">
                            {med.name.trim()}
                          </p>
                          <p className="mt-1 font-body text-[16px] leading-snug text-vyva-text-2">
                            {medicationSummary(med)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          data-testid={`status-med-saved-${idx}`}
                          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-extrabold text-green-600"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Saved
                        </span>
                        <button
                          type="button"
                          data-testid={`button-meds-edit-${med.id}`}
                          onClick={() => editMed(med)}
                          className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E7DCF8] bg-white px-4 text-[14px] font-black text-vyva-purple shadow-sm"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                        <button
                          type="button"
                          data-testid={`button-meds-remove-${med.id}`}
                          onClick={() => removeMed(med.id)}
                          disabled={busy}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {removingId === med.id ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="flex min-h-[48px] flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between min-[520px]:gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3E8FF] text-[18px] font-black text-vyva-purple">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-[19px] font-black leading-tight text-vyva-text-1">
                          Medication {idx + 1}
                        </p>
                        <p className="mt-1 font-body text-[15px] leading-snug text-vyva-text-3">
                          The name is enough to save. Details make reminders smarter.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-2 min-[520px]:justify-start">
                      {saved && (
                        <span
                          data-testid={`status-med-saved-${idx}`}
                          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-extrabold text-green-600"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Saved
                        </span>
                      )}
                      {dirty && (
                        <span
                          data-testid={`status-med-unsaved-${idx}`}
                          className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-extrabold text-amber-600"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Unsaved
                        </span>
                      )}
                      <button
                        type="button"
                        data-testid={`button-meds-remove-${med.id}`}
                        onClick={() => removeMed(med.id)}
                        disabled={busy}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {removingId === med.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                  <FormField label={<FieldLabel icon={<Pill size={16} />}>Medication name</FieldLabel>} required optionalLabel="Optional" requiredLabel="Needed">
                    <Input data-testid={`input-med-name-${idx}`} placeholder="e.g. Metformin" value={med.name} onChange={(e) => updateMed(med.id, "name", e.target.value)} className={inputClassName} />
                  </FormField>
                  <ResponsiveGrid columns="two" gap="lg">
                    <FormField label={<FieldLabel icon={<Sparkles size={16} />}>Dosage</FieldLabel>} hint="Strength or amount, if you know it.">
                      <Input data-testid={`input-med-dosage-${idx}`} placeholder="e.g. 500mg" value={med.dosage} onChange={(e) => updateMed(med.id, "dosage", e.target.value)} className={inputClassName} />
                    </FormField>
                    <FormField label={<FieldLabel icon={<Clock3 size={16} />}>Time or routine</FieldLabel>} hint="Examples: morning and evening, bedtime, or 08:00, 20:00.">
                      <SeniorChoiceChips
                        options={TIME_PRESETS}
                        value={med.times}
                        onChange={(value) => updateTimePreset(med.id, value)}
                        testIdPrefix={`chip-med-time-${idx}`}
                      />
                      <Input data-testid={`input-med-times-${idx}`} placeholder="Morning and evening" value={med.times} onChange={(e) => updateMed(med.id, "times", e.target.value)} className={inputClassName} />
                    </FormField>
                  </ResponsiveGrid>
                  <div className="rounded-[24px] border border-[#EDE2F8] bg-[#FBF8FF] p-4">
                    <button
                      type="button"
                      data-testid={`button-meds-details-${med.id}`}
                      onClick={() => toggleDetails(med.id)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <span>
                        <span className="block text-[17px] font-black text-vyva-text-1">More details</span>
                        <span className="mt-0.5 block text-[14px] leading-snug text-vyva-text-3">
                          Add frequency, food notes, or prescriber only if useful.
                        </span>
                      </span>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-vyva-purple shadow-sm">
                        {detailsOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                      </span>
                    </button>
                    {detailsOpen ? (
                      <div className="mt-5 flex flex-col gap-5">
                        <FormField label={<FieldLabel icon={<Clock3 size={16} />}>Frequency</FieldLabel>} hint={showCustomFrequency ? "Type it in your own words." : "Choose the closest option."}>
                          <SeniorChoiceChips
                            options={FREQUENCY_OPTIONS}
                            value={showCustomFrequency ? "other" : med.frequency}
                            onChange={(value) => updateFrequency(med.id, value)}
                            testIdPrefix={`chip-med-frequency-${idx}`}
                          />
                          {showCustomFrequency && (
                            <Input
                              data-testid={`input-med-frequency-other-${idx}`}
                              placeholder="Type frequency"
                              value={customFrequencyDisplayValue(med.frequency)}
                              onChange={(e) => updateMed(med.id, "frequency", e.target.value)}
                              className={inputClassName}
                            />
                          )}
                        </FormField>
                        <FormField label={<FieldLabel icon={<Utensils size={16} />}>With food?</FieldLabel>}>
                          <SeniorChoiceChips
                            options={FOOD_OPTIONS}
                            value={med.with_food}
                            onChange={(value) => updateMed(med.id, "with_food", value)}
                            testIdPrefix={`chip-med-food-${idx}`}
                          />
                        </FormField>
                        <FormField label={<FieldLabel icon={<Stethoscope size={16} />}>Prescribed by</FieldLabel>} hint="Optional, but helpful for future reports.">
                          <Input data-testid={`input-med-prescribed-${idx}`} placeholder="GP, specialist, or clinic name" value={med.prescribed_by} onChange={(e) => updateMed(med.id, "prescribed_by", e.target.value)} className={inputClassName} />
                        </FormField>
                      </div>
                    ) : null}
                  </div>
                  {saved && !dirty && hasName ? (
                    <button
                      type="button"
                      data-testid={`button-meds-collapse-${med.id}`}
                      onClick={() => collapseMed(med.id)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#E7DCF8] bg-white px-5 text-[15px] font-black text-vyva-purple shadow-sm"
                    >
                      <CheckCircle2 size={17} />
                      Show as summary
                    </button>
                  ) : null}
                    </>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              data-testid="button-meds-add"
              onClick={addMed}
              disabled={busy || isLoading}
              className="flex min-h-[58px] items-center justify-center gap-2 rounded-full border-2 border-dashed border-vyva-purple/40 bg-white text-[17px] font-black text-[#6b21a8] shadow-[0_12px_26px_rgba(53,28,87,0.06)] disabled:opacity-40"
            >
              {adding ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              {adding ? "Adding..." : "Add another medication"}
            </button>
          </>
        )}

        <div className={`fixed bottom-0 left-1/2 z-50 flex w-[min(100vw,410px)] -translate-x-1/2 flex-col gap-3 rounded-t-[28px] border-t border-[#EDE2D1] bg-[#FFFCF8] px-4 pb-3 pt-4 shadow-[0_-18px_40px_rgba(53,28,87,0.16)] transition duration-200 sm:sticky sm:bottom-0 sm:left-auto sm:z-20 sm:-mx-2 sm:w-auto sm:translate-x-0 sm:px-5 sm:opacity-100 ${showMobileActionBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[120%] opacity-0 sm:pointer-events-auto"}`}>
          <Button data-testid="button-meds-save" onClick={handleSave} disabled={busy || isLoading} className="h-14 w-full gap-2 rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f]">
            {saving ? <Loader2 size={19} className="animate-spin" /> : <ShieldCheck size={19} />}
            {saving ? "Saving..." : "Save medications"}
          </Button>
          <button data-testid="button-meds-skip" onClick={() => confirmNavigation("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">Skip for now</button>
        </div>
      </div>

      <VoiceMedsModal
        open={voiceModalOpen}
        onOpenChange={setVoiceModalOpen}
        onAddMedication={addMedFromVoice}
      />
    </PhoneFrame>
  );
}
