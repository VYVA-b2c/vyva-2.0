// src/pages/onboarding/sections/MedicationsSection.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, ResponsiveGrid } from "@/components/vyva-ui";
import { Trash2, Loader2, Plus, CheckCircle2, AlertCircle, Mic } from "lucide-react";
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

const STANDARD_FREQUENCIES = ["once_daily", "twice_daily", "three_daily"];

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

  // Refs so auto-save closure always sees the latest values
  const medsRef = useRef(meds);
  const busyRef = useRef(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { medsRef.current = meds; }, [meds]);
  useEffect(() => { busyRef.current = saving || autoSaving || adding || !!removingId; }, [saving, autoSaving, adding, removingId]);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

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

  const addMed = async () => {
    if (adding || removingId || saving) return;
    setAdding(true);
    const previous = meds;
    counterRef.current += 1;
    const newMed = emptyMed(`med-${counterRef.current}`);
    const updated = [...previous, newMed];
    setMeds(updated);
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
    return medsAreEqual(meds[idx], savedMeds[idx]);
  };

  const isMedDirty = (idx: number): boolean => {
    if (savedMeds.length === 0) return false;
    if (idx >= savedMeds.length) return false;
    return !medsAreEqual(meds[idx], savedMeds[idx]);
  };

  const MedSkeleton = () => (
    <div className="flex flex-col gap-4 rounded-[24px] border border-purple-100 bg-white p-5">
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );

  const busy = saving || autoSaving || adding || !!removingId;
  const inputClassName = "h-12 rounded-[16px] border-purple-200 bg-[#FFFCF8] text-[15px]";
  const selectClassName = "h-12 rounded-[16px] border-purple-200 bg-[#FFFCF8] text-[15px]";

  return (
    <PhoneFrame subtitle="💊 Medications" showBack onBack={() => confirmNavigation("/onboarding/profile")} showAllSections onAllSections={() => confirmNavigation("/onboarding/profile")}>
      <div className="flex flex-col gap-6 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="font-display text-[24px] leading-tight text-vyva-text-1">Medications</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-vyva-text-2">Add the details you know. You can leave optional fields blank.</p>
          </div>
          <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-meds-autosave" />
        </div>

        {/* Add by voice banner */}
        <button
          type="button"
          data-testid="button-meds-voice"
          onClick={() => setVoiceModalOpen(true)}
          className="flex w-full items-center gap-4 rounded-[22px] px-4 py-4 text-left"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
        >
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "#F59E0B" }}
          >
            <Mic size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[16px] font-bold" style={{ color: "#92400E" }}>
              Add by voice
            </p>
            <p className="mt-0.5 font-body text-[13px] leading-snug" style={{ color: "#B45309" }}>
              Speak your medications and VYVA will fill in the details
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
              const showCustomFrequency =
                customFrequencyMedIds.has(med.id) || isCustomFrequency(med.frequency);

              return (
                <div
                  key={med.id}
                  data-testid={`card-med-${med.id}`}
                  className={`flex flex-col gap-4 rounded-[24px] border bg-white p-5 ${
                    dirty
                      ? "border-amber-300 ring-1 ring-amber-200"
                      : saved
                      ? "border-green-300 ring-1 ring-green-100"
                      : "border-purple-100"
                  }`}
                >
                  <div className="flex min-h-[32px] items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-vyva-purple">
                        Medication {idx + 1}
                      </p>
                      <p className="mt-0.5 font-body text-[13px] text-vyva-text-3">
                        Name is enough to save. The rest helps reminders feel smarter.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {saved && (
                        <span
                          data-testid={`status-med-saved-${idx}`}
                          className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-green-600"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Saved
                        </span>
                      )}
                      {dirty && (
                        <span
                          data-testid={`status-med-unsaved-${idx}`}
                          className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600"
                        >
                          <AlertCircle className="w-3 h-3" />
                          Unsaved
                        </span>
                      )}
                      <button
                        type="button"
                        data-testid={`button-meds-remove-${med.id}`}
                        onClick={() => removeMed(med.id)}
                        disabled={busy}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {removingId === med.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                  <FormField label="Medication name" required optionalLabel="Optional" requiredLabel="Needed">
                    <Input data-testid={`input-med-name-${idx}`} placeholder="e.g. Metformin" value={med.name} onChange={(e) => updateMed(med.id, "name", e.target.value)} className={inputClassName} />
                  </FormField>
                  <ResponsiveGrid columns="two" gap="md">
                    <FormField label="Dosage" hint="Strength or amount, if you know it.">
                      <Input data-testid={`input-med-dosage-${idx}`} placeholder="e.g. 500mg" value={med.dosage} onChange={(e) => updateMed(med.id, "dosage", e.target.value)} className={inputClassName} />
                    </FormField>
                    <FormField label="Frequency" hint={showCustomFrequency ? "Type it in your own words." : "Choose Other if none of these fit."}>
                      <Select
                        value={showCustomFrequency ? "other" : med.frequency || undefined}
                        onValueChange={(v) => updateFrequency(med.id, v)}
                      >
                        <SelectTrigger data-testid={`select-med-frequency-${idx}`} className={selectClassName}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once_daily">Once daily</SelectItem>
                          <SelectItem value="twice_daily">Twice daily</SelectItem>
                          <SelectItem value="three_daily">3x daily</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
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
                  </ResponsiveGrid>
                  <ResponsiveGrid columns="two" gap="md">
                    <FormField label="Time or routine" hint="Examples: morning and evening, bedtime, or 08:00, 20:00.">
                      <Input data-testid={`input-med-times-${idx}`} placeholder="Morning and evening" value={med.times} onChange={(e) => updateMed(med.id, "times", e.target.value)} className={inputClassName} />
                    </FormField>
                    <FormField label="With food?">
                      <Select value={med.with_food || undefined} onValueChange={(v) => updateMed(med.id, "with_food", v)}>
                        <SelectTrigger data-testid={`select-med-food-${idx}`} className={selectClassName}><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="with_food">With food</SelectItem>
                          <SelectItem value="without_food">Without food</SelectItem>
                          <SelectItem value="doesnt_matter">Doesn't matter</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  </ResponsiveGrid>
                  <FormField label="Prescribed by" hint="Optional, but helpful for future reports.">
                    <Input data-testid={`input-med-prescribed-${idx}`} placeholder="GP, specialist, or clinic name" value={med.prescribed_by} onChange={(e) => updateMed(med.id, "prescribed_by", e.target.value)} className={inputClassName} />
                  </FormField>
                </div>
              );
            })}

            <button
              type="button"
              data-testid="button-meds-add"
              onClick={addMed}
              disabled={busy || isLoading}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-dashed border-vyva-purple/40 bg-white text-[15px] font-bold text-[#6b21a8] disabled:opacity-40"
            >
              {adding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {adding ? "Adding…" : "Add another medication"}
            </button>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-meds-save" onClick={handleSave} disabled={busy || isLoading} className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save medications"}
          </Button>
          <button data-testid="button-meds-skip" onClick={() => confirmNavigation("/onboarding/profile")} className="text-xs text-gray-400 py-2 text-center">Skip for now</button>
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
