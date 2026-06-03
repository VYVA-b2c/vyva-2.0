// src/pages/onboarding/sections/ConditionsSection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, CheckCircle2, ChevronDown, HeartPulse, Home, Mic, PersonStanding, Search } from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { SeniorChoiceChips, type SeniorChoiceOption } from "@/components/onboarding/SeniorChoiceChips";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";

const CATEGORIES: { id: string; marker: string; label: string }[] = [
  { id: "heart",       marker: "HEART", label: "Heart & circulation" },
  { id: "metabolic",   marker: "MET", label: "Metabolic & hormonal" },
  { id: "respiratory", marker: "AIR", label: "Respiratory" },
  { id: "musculo",     marker: "MOVE", label: "Joints, bones & muscles" },
  { id: "neuro",       marker: "BRAIN", label: "Neurological" },
  { id: "mental",      marker: "MOOD", label: "Mental health" },
  { id: "cancer",      marker: "CARE", label: "Cancer & oncology" },
  { id: "kidney",      marker: "RENAL", label: "Kidney & urinary" },
  { id: "digestive",   marker: "GUT", label: "Digestive & gut" },
  { id: "sensory",     marker: "SENSE", label: "Sensory & skin" },
  { id: "other",       marker: "MORE", label: "Other" },
];

const CONDITION_GROUPS: { cat: string; items: string[] }[] = [
  { cat: "heart",      items: ["Hypertension","High cholesterol","Heart failure","Atrial fibrillation","Coronary artery disease","Heart attack (history)","Stroke (history)","Pacemaker / ICD","Deep vein thrombosis","Peripheral artery disease","Anaemia"] },
  { cat: "metabolic",  items: ["Diabetes Type 1","Diabetes Type 2","Pre-diabetes","Hypothyroidism","Hyperthyroidism","Osteoporosis","Vitamin D deficiency","Gout","Obesity","Metabolic syndrome"] },
  { cat: "respiratory",items: ["COPD","Asthma","Sleep apnoea","Pulmonary fibrosis","Chronic bronchitis","Emphysema","Pleural effusion"] },
  { cat: "musculo",    items: ["Osteoarthritis","Rheumatoid arthritis","Psoriatic arthritis","Fibromyalgia","Back pain (chronic)","Hip replacement","Knee replacement","Spinal stenosis","Muscle weakness","Lupus"] },
  { cat: "neuro",      items: ["Dementia","Alzheimer's","Parkinson's disease","Epilepsy","Multiple sclerosis","Peripheral neuropathy","Tremors","Migraine (chronic)","Motor neurone disease","Balance disorder"] },
  { cat: "mental",     items: ["Depression","Anxiety","Bipolar disorder","PTSD","OCD","Loneliness / isolation","Grief / bereavement","Sleep disorder / insomnia"] },
  { cat: "cancer",     items: ["Active cancer treatment","Cancer - in remission","Cancer - monitoring","Post-surgical recovery","Lymphoedema"] },
  { cat: "kidney",     items: ["Chronic kidney disease","Kidney stones","Urinary incontinence","Enlarged prostate (BPH)","Recurrent UTIs","Dialysis"] },
  { cat: "digestive",  items: ["IBS","Crohn's disease","Ulcerative colitis","GERD / Acid reflux","Coeliac disease","Diverticular disease","Liver disease","Gallstones","Constipation (chronic)"] },
  { cat: "sensory",    items: ["Vision impairment","Hearing loss","Glaucoma","Cataracts","Macular degeneration","Tinnitus","Eczema / Psoriasis","Diabetic retinopathy"] },
  { cat: "other",      items: ["Falls (recurrent)","Wound / ulcer (ongoing)","Chronic fatigue","Post-COVID / long COVID","Autoimmune condition","Transplant recipient","Blood disorder","Skin condition"] },
];

const ALL_CONDITIONS = CONDITION_GROUPS.flatMap((g) => g.items);

const CONDITION_SYNONYMS: Record<string, string> = {
  "high blood pressure": "Hypertension",
  "blood pressure": "Hypertension",
  "hypertension": "Hypertension",
  "heart attack": "Heart attack (history)",
  "had a heart attack": "Heart attack (history)",
  "diabetes": "Diabetes Type 2",
  "type 1 diabetes": "Diabetes Type 1",
  "type 2 diabetes": "Diabetes Type 2",
  "diabetic": "Diabetes Type 2",
  "cholesterol": "High cholesterol",
  "high cholesterol": "High cholesterol",
  "afib": "Atrial fibrillation",
  "atrial fibrillation": "Atrial fibrillation",
  "stroke": "Stroke (history)",
  "tia": "Stroke (history)",
  "mini stroke": "Stroke (history)",
  "heart failure": "Heart failure",
  "copd": "COPD",
  "emphysema": "Emphysema",
  "asthma": "Asthma",
  "arthritis": "Osteoarthritis",
  "osteoarthritis": "Osteoarthritis",
  "rheumatoid arthritis": "Rheumatoid arthritis",
  "osteoporosis": "Osteoporosis",
  "parkinson": "Parkinson's disease",
  "parkinsons": "Parkinson's disease",
  "alzheimer": "Alzheimer's",
  "alzheimers": "Alzheimer's",
  "dementia": "Dementia",
  "depression": "Depression",
  "anxiety": "Anxiety",
  "ptsd": "PTSD",
  "thyroid": "Hypothyroidism",
  "hypothyroid": "Hypothyroidism",
  "hyperthyroid": "Hyperthyroidism",
  "kidney disease": "Chronic kidney disease",
  "ckd": "Chronic kidney disease",
  "epilepsy": "Epilepsy",
  "ibs": "IBS",
  "irritable bowel": "IBS",
  "crohn": "Crohn's disease",
  "gerd": "GERD / Acid reflux",
  "acid reflux": "GERD / Acid reflux",
  "hearing loss": "Hearing loss",
  "glaucoma": "Glaucoma",
  "cataracts": "Cataracts",
  "macular degeneration": "Macular degeneration",
  "fibromyalgia": "Fibromyalgia",
  "multiple sclerosis": "Multiple sclerosis",
  "long covid": "Post-COVID / long COVID",
  "long-covid": "Post-COVID / long COVID",
};

function matchConditionsFromTranscript(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  const matched = new Set<string>();
  for (const [phrase, canonical] of Object.entries(CONDITION_SYNONYMS)) {
    if (lower.includes(phrase)) {
      const found = ALL_CONDITIONS.find((c) => c.toLowerCase() === canonical.toLowerCase());
      if (found) matched.add(found);
    }
  }
  for (const name of ALL_CONDITIONS) {
    if (matched.has(name)) continue;
    if (lower.includes(name.toLowerCase())) matched.add(name);
  }
  return Array.from(matched);
}

const MOBILITY_OPTIONS = [
  { value: "independent",          label: " Fully independent",      sub: "No aids needed" },
  { value: "stick_or_frame",       label: " Uses a stick or frame",   sub: "" },
  { value: "wheelchair_part_time", label: " Wheelchair (part-time)",  sub: "For longer distances" },
  { value: "wheelchair_full_time", label: " Wheelchair (full-time)",  sub: "Primary mode of movement" },
  { value: "housebound",           label: " Housebound",              sub: "Unable to leave home independently" },
];

const MOBILITY_CHOICES: SeniorChoiceOption[] = [
  { value: "independent", label: "Independent", description: "No aids needed", icon: <PersonStanding size={17} /> },
  { value: "stick_or_frame", label: "Stick or frame", icon: <PersonStanding size={17} /> },
  { value: "wheelchair_part_time", label: "Wheelchair sometimes", description: "For longer distances", icon: <BadgeCheck size={17} /> },
  { value: "wheelchair_full_time", label: "Wheelchair daily", description: "Primary way to move", icon: <BadgeCheck size={17} /> },
  { value: "housebound", label: "Mostly at home", description: "Needs help to leave home", icon: <Home size={17} /> },
];

const LIVING_OPTIONS = [
  { value: "alone",        label: " Lives alone" },
  { value: "with_partner", label: " With partner" },
  { value: "with_family",  label: " With family" },
  { value: "care_home",    label: " Care home" },
];

const LIVING_CHOICES: SeniorChoiceOption[] = [
  { value: "alone", label: "Lives alone", icon: <Home size={17} /> },
  { value: "with_partner", label: "With partner", icon: <Home size={17} /> },
  { value: "with_family", label: "With family", icon: <Home size={17} /> },
  { value: "care_home", label: "Care home", icon: <BadgeCheck size={17} /> },
];

type SavedCondition = { name: string; category: string };

export default function ConditionsSection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [noKnownConditions, setNoKnownConditions] = useState(false);
  const [mobility, setMobility] = useState("");
  const [living, setLiving] = useState("");
  const [saving, setSaving] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [speakItMatches, setSpeakItMatches] = useState<string[]>([]);

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const buildConditionsPayload = () => ({
    health_conditions: selected,
    conditions: selected.map((name) => {
      const group = CONDITION_GROUPS.find((g) => g.items.includes(name));
      return { name, category: group?.cat || "other" };
    }),
    mobility_level: mobility || null,
    living_situation: living || null,
    allergies: [],
    no_known_conditions: noKnownConditions && selected.length === 0,
  });

  const completePath = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo
      ? `/onboarding/complete/conditions?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/complete/conditions";
  };

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave, setAutoSaveStatus } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/conditions", {
        method: "POST",
        body: JSON.stringify(buildConditionsPayload()),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
    },
    2000,
  );

  const { data, isLoading } = useQuery<{
    profile: { conditions?: SavedCondition[]; mobility_level?: string; living_situation?: string; no_known_conditions?: boolean } | null;
  }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const p = data?.profile as { conditions?: SavedCondition[]; mobility_level?: string; living_situation?: string } | null;
    if (p) {
      if (p.conditions) setSelected(p.conditions.map((c) => c.name));
      if (p.mobility_level) setMobility(p.mobility_level);
      if (p.living_situation) setLiving(p.living_situation);
      setNoKnownConditions(Boolean(p.no_known_conditions) && (!p.conditions || p.conditions.length === 0));
    }
  }, [data]);

  const toggleCondition = (name: string) => {
    setNoKnownConditions(false);
    setSelected((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
    scheduleAutoSave();
  };

  const removeSelected = (name: string) => {
    setSelected((prev) => prev.filter((x) => x !== name));
    scheduleAutoSave();
  };

  const toggleNoKnownConditions = () => {
    const next = !noKnownConditions;
    setNoKnownConditions(next);
    if (next) {
      setSelected([]);
      setSearch("");
      setSpeakItMatches([]);
    }
    scheduleAutoSave();
  };

  const handleMobility = (value: string) => { setMobility(value); scheduleAutoSave(); };
  const handleLiving   = (value: string) => { setLiving(value);   scheduleAutoSave(); };
  const hasHealthSectionContent = selected.length > 0 || Boolean(mobility) || Boolean(living) || noKnownConditions;

  const handleSpeakItDone = (transcript: string) => {
    setSpeakItOpen(false);
    if (!transcript) return;
    const matches = matchConditionsFromTranscript(transcript);
    if (matches.length === 0) {
      toast({ title: "No conditions recognised", description: "Try speaking more slowly or select conditions manually below." });
      return;
    }
    setSpeakItMatches(matches);
  };

  const confirmSpeakItMatches = () => {
    const newSelected = Array.from(new Set([...selected, ...speakItMatches]));
    setNoKnownConditions(false);
    setSelected(newSelected);
    setSpeakItMatches([]);
    scheduleAutoSave();
    toast({ title: `${speakItMatches.length} condition${speakItMatches.length > 1 ? "s" : ""} added` });
  };

  const toggleCat = (catId: string) => {
    setOpenCat((prev) => (prev === catId ? null : catId));
  };

  const isSearching = search.trim().length > 0;

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let navigating = false;
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/conditions", {
        method: "POST",
        body: JSON.stringify(buildConditionsPayload()),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      setAutoSaveStatus("saved");
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate(completePath()), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save health conditions", description: msg, variant: "destructive" });
    } finally {
      if (!navigating) setSaving(false);
    }
  };

  return (
    <PhoneFrame subtitle="Health conditions" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={HeartPulse}
          title="Health profile"
          kicker="Better guidance"
          description="Choose the conditions VYVA should know about so reminders, doctor notes, and health conversations are safer."
          badges={[
            { label: "Doctor context", color: "blue" },
            { label: "Reminder support", color: "purple" },
            { label: "Safer triage", color: "red" },
          ]}
          iconBgClassName="bg-[#B0355A]"
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-conditions-autosave" }}
        />

        {/* Speak it banner */}
        <button
          type="button"
          data-testid="button-conditions-speak-it"
          onClick={() => setSpeakItOpen(true)}
          className="flex min-h-[96px] w-full items-center gap-5 rounded-[28px] border border-[#EDE9FE] bg-[#F5F3FF] px-5 py-5 text-left shadow-[0_16px_36px_rgba(107,33,168,0.10)] transition hover:-translate-y-0.5"
          style={{ background: "#F5F3FF", border: "1px solid #EDE9FE" }}
        >
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl animate-pulse-ring"
            style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
          >
            <Mic size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[21px] font-black leading-tight" style={{ color: "#6B21A8" }}>Add by voice</p>
            <p className="mt-1 font-body text-[16px] leading-snug" style={{ color: "#7C3AED" }}>Tell VYVA your health history. It will select matching conditions.</p>
          </div>
        </button>

        {/* Speak-it confirmation */}
        {speakItMatches.length > 0 && (
          <div
            className="rounded-[14px] px-4 py-3"
            style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}
            data-testid="panel-conditions-speak-it-confirm"
          >
            <p className="font-body text-[13px] font-semibold text-green-800 mb-2">
              VYVA found {speakItMatches.length} condition{speakItMatches.length > 1 ? "s" : ""}:
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {speakItMatches.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 bg-white text-green-800 text-[11px] px-2.5 py-1 rounded-full border border-green-200 font-medium">
                  <CheckCircle2 size={10} className="text-green-600" />
                  {name}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSpeakItMatches([])} className="flex-1 py-2 rounded-full font-body text-[13px] font-medium text-gray-600 bg-white border border-gray-200 min-h-[40px]" data-testid="button-conditions-speak-it-reject">Dismiss</button>
              <button onClick={confirmSpeakItMatches} className="flex-1 py-2 rounded-full font-body text-[13px] font-medium text-white min-h-[40px]" style={{ background: "#0A7C4E" }} data-testid="button-conditions-speak-it-confirm">Add these</button>
            </div>
          </div>
        )}

        {speakItOpen && (
          <SpeakItOverlay
            title="Tell VYVA your conditions"
            hint='e.g. "I have Type 2 diabetes and high blood pressure"'
            onDone={handleSpeakItDone}
            onCancel={() => setSpeakItOpen(false)}
          />
        )}

        <div className="rounded-[24px] border border-[#E9DDF8] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(53,28,87,0.05)]">
          <p className="font-body text-[15px] font-extrabold text-vyva-text-1">No conditions to add?</p>
          <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
            Choose this if there are no known health conditions right now.
          </p>
          <button
            type="button"
            aria-pressed={noKnownConditions}
            data-testid="button-conditions-no-known"
            onClick={toggleNoKnownConditions}
            className={cn(
              "mt-3 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] border px-4 py-3 font-body text-[16px] font-black transition",
              noKnownConditions
                ? "border-vyva-purple bg-vyva-purple text-white shadow-[0_14px_26px_rgba(107,33,168,0.22)]"
                : "border-[#E9DDF8] bg-[#FCF8FF] text-vyva-purple",
            )}
          >
            <CheckCircle2 size={18} />
            No known health conditions
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3" data-testid="skeleton-conditions-content">
            <Skeleton className="h-9 w-full rounded-lg" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-[14px]" />
            ))}
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                data-testid="input-conditions-search"
                className="h-14 w-full rounded-[18px] border border-[#DDC7FF] bg-white pl-12 pr-4 text-[17px] text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] placeholder:text-[#8D7D73] focus:outline-none focus:ring-4 focus:ring-vyva-purple/15"
                placeholder="Search conditions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Selected chip bar */}
            <div className="flex min-h-[64px] flex-wrap items-center gap-2 rounded-[22px] bg-purple-50 px-4 py-3">
              {selected.length === 0 ? (
                <span className="text-[15px] font-semibold text-purple-400">Nothing selected - tap any condition below</span>
              ) : (
                selected.map((name) => (
                  <span key={name} className="inline-flex items-center gap-2 rounded-full bg-[#6b21a8] px-3 py-1.5 text-[14px] font-black text-white">
                    {name}
                    <button onClick={() => removeSelected(name)} className="opacity-70 hover:opacity-100" data-testid={`button-remove-condition-${name.replace(/\s+/g, "-").toLowerCase()}`}>x</button>
                  </span>
                ))
              )}
            </div>

            {/* Accordion */}
            <div className="flex flex-col gap-2">
              {CONDITION_GROUPS.map((group) => {
                const cat = CATEGORIES.find((c) => c.id === group.cat)!;
                const visibleItems = isSearching
                  ? group.items.filter((i) => i.toLowerCase().includes(search.toLowerCase()))
                  : group.items;
                if (isSearching && visibleItems.length === 0) return null;

                const selectedCount = group.items.filter((i) => selected.includes(i)).length;
                const isOpen = isSearching || openCat === group.cat;
                const hasSelections = selectedCount > 0;

                return (
                  <div
                    key={group.cat}
                    className="overflow-hidden rounded-[22px] shadow-[0_10px_22px_rgba(53,28,87,0.04)]"
                    style={{
                      border: hasSelections ? "1px solid #A78BFA" : "1px solid #EDE5DB",
                      background: hasSelections ? "#FAF8FF" : "#FFFFFF",
                    }}
                  >
                    {/* Accordion header */}
                    <button
                      type="button"
                      data-testid={`accordion-${group.cat}`}
                      onClick={() => !isSearching && toggleCat(group.cat)}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left"
                    >
                      <span className="rounded-full bg-[#F3E8FF] px-2.5 py-1 text-[11px] font-black leading-none text-vyva-purple">{cat.marker}</span>
                      <span className="min-w-0">
                        <span className="block font-body text-[17px] font-black leading-snug text-gray-800">{cat.label}</span>
                        {hasSelections && (
                          <span
                            className="mt-1 inline-flex max-w-full rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: "#EDE9FE", color: "#6B21A8" }}
                            data-testid={`badge-count-${group.cat}`}
                          >
                            {selectedCount} selected
                          </span>
                        )}
                      </span>
                      {!isSearching && (
                        <ChevronDown
                          size={16}
                          className="text-gray-400 transition-transform duration-200"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        />
                      )}
                    </button>

                    {/* Accordion body */}
                    <div
                      className="overflow-hidden transition-all duration-300 ease-in-out"
                      style={{ maxHeight: isOpen ? "2000px" : "0px" }}
                    >
                      <div className="grid grid-cols-1 gap-3 px-3 pb-4 min-[560px]:grid-cols-2">
                        {visibleItems.map((item) => {
                          const isSelected = selected.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              data-testid={`card-condition-${item.replace(/\s+/g, "-").toLowerCase()}`}
                              onClick={() => toggleCondition(item)}
                              className={cn(
                                "flex min-h-[64px] items-center gap-3 rounded-[18px] px-4 py-3 text-left transition-all",
                              )}
                              style={
                                isSelected
                                  ? { background: "#EDE9FE", border: "2px solid #A78BFA", boxShadow: "0 2px 8px rgba(107,33,168,0.12)" }
                                  : { background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }
                              }
                            >
                              <span
                                className="font-body text-[15px] font-bold leading-tight flex-1 min-w-0"
                                style={{ color: isSelected ? "#5B12A0" : "#2C2320" }}
                              >
                                {item}
                              </span>
                              {isSelected && (
                                <CheckCircle2 size={14} className="flex-shrink-0" style={{ color: "#6B21A8" }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobility */}
            <div>
              <p className="mb-3 text-[15px] font-extrabold text-gray-700">Mobility</p>
              <SeniorChoiceChips
                options={MOBILITY_CHOICES}
                value={mobility}
                onChange={handleMobility}
                testIdPrefix="button-mobility"
              />
            </div>

            {/* Living situation */}
            <div>
              <p className="mb-3 text-[15px] font-extrabold text-gray-700">Living situation</p>
              <SeniorChoiceChips
                options={LIVING_CHOICES}
                value={living}
                onChange={handleLiving}
                testIdPrefix="button-living"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-conditions-save" onClick={handleSave} disabled={saving || isLoading || !hasHealthSectionContent} className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f] disabled:opacity-40">
            {saving ? "Saving..." : "Save health conditions"}
          </Button>
          <button data-testid="button-conditions-skip" onClick={() => navigate("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">
            Skip for now
          </button>
        </div>

      </div>
    </PhoneFrame>
  );
}
