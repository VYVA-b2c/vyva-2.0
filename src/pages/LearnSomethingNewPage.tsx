import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpen,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Cpu,
  Headphones,
  Hand,
  Languages,
  Landmark,
  Leaf,
  Loader2,
  Mic,
  Music,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LearningCategory = {
  id: string;
  slug: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

type LearningLesson = {
  id: string;
  categorySlug: string;
  language: string;
  title: string;
  hook: string;
  body: string;
  reflectionPrompt: string;
  estimatedMinutes: number;
  difficulty: string;
  tags: string[];
};

type LearningProgramItem = {
  id: string;
  programId: string;
  lessonId: string;
  programDay: number;
  scheduledDate: string;
  status: "recommended" | "saved" | "skipped" | "completed";
  completedAt: string | null;
  savedAt: string | null;
  skippedAt: string | null;
  lesson: LearningLesson | null;
};

type LearningProgram = {
  id: string;
  status: "active" | "completed" | "expired";
  interests: string[];
  pace: "gentle" | "steady" | "curious";
  frequency: "daily" | "three_times_week" | "weekly";
  durationWeeks: 1 | 4 | 12;
  dailyTime: string;
  lessonLengthMinutes: number;
  language: string;
  startDate: string;
  endDate: string;
  completedAt: string | null;
  items: LearningProgramItem[];
  progress: {
    completedCount: number;
    totalCount: number;
    allComplete: boolean;
    currentDay: number;
  };
};

type LearningTodayResponse = {
  onboardingRequired: boolean;
  categories: LearningCategory[];
  program: LearningProgram | null;
  todayItem: LearningProgramItem | null;
};

type ProgramForm = {
  learningMode: "voice" | "touch" | "both";
  interests: string[];
  pace: "gentle" | "steady" | "curious";
  frequency: "daily" | "three_times_week" | "weekly";
  durationWeeks: 1 | 4 | 12;
  dailyTime: string;
  lessonLengthMinutes: number;
};

const DEFAULT_INTEREST = "general_knowledge";
const LEARNING_MODE_STORAGE_KEY = "vyva.learning.mode";
const DEFAULT_FORM: ProgramForm = {
  learningMode: "both",
  interests: [DEFAULT_INTEREST],
  pace: "gentle",
  frequency: "three_times_week",
  durationWeeks: 4,
  dailyTime: "09:00",
  lessonLengthMinutes: 3,
};

const iconByName: Record<string, LucideIcon> = {
  atom: Atom,
  languages: Languages,
  palette: Palette,
  sparkles: Sparkles,
  music: Music,
  landmark: Landmark,
  leaf: Leaf,
  cpu: Cpu,
  "book-open": BookOpen,
};

const paceOptions: Array<{ id: ProgramForm["pace"]; label: string; description: string }> = [
  { id: "gentle", label: "Gentle", description: "One calm idea each day." },
  { id: "steady", label: "Steady", description: "A little more detail and reflection." },
  { id: "curious", label: "Curious", description: "Richer snippets for active learners." },
];

const learningModeOptions: Array<{ id: ProgramForm["learningMode"]; label: string; description: string; Icon: LucideIcon; recommended?: boolean }> = [
  { id: "voice", label: "Voice", description: "Listen and speak.", Icon: Mic },
  { id: "touch", label: "Touch", description: "Read and tap.", Icon: Hand },
  { id: "both", label: "Both", description: "Use either anytime.", Icon: Sparkles, recommended: true },
];

const frequencyOptions: Array<{ id: ProgramForm["frequency"]; label: string; description: string }> = [
  { id: "daily", label: "Daily", description: "Every day." },
  { id: "three_times_week", label: "3 times a week", description: "With rest days." },
  { id: "weekly", label: "Weekly", description: "Slow pace." },
];

const durationOptions: Array<{ id: ProgramForm["durationWeeks"]; label: string; description: string }> = [
  { id: 1, label: "1 week", description: "A quick start." },
  { id: 4, label: "1 month", description: "Build a habit." },
  { id: 12, label: "3 months", description: "A longer learning path." },
];

const wizardStepTitles = ["Mode", "Interests", "Pace", "Rhythm"] as const;

function categoryIcon(category: LearningCategory) {
  return iconByName[category.icon] ?? BookOpen;
}

function categoryFor(categories: LearningCategory[], slug?: string | null) {
  return categories.find((category) => category.slug === slug) ?? categories.find((category) => category.slug === DEFAULT_INTEREST);
}

function timeLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function programPeriodLabel(durationWeeks: ProgramForm["durationWeeks"]) {
  if (durationWeeks === 12) return "in 3 months";
  if (durationWeeks === 4) return "this month";
  return "this week";
}

function normalizeLearningMode(value: unknown): ProgramForm["learningMode"] {
  return value === "voice" || value === "touch" || value === "both" ? value : "both";
}

function readLearningModePreference(): ProgramForm["learningMode"] {
  if (typeof window === "undefined") return "both";
  try {
    return normalizeLearningMode(window.localStorage.getItem(LEARNING_MODE_STORAGE_KEY));
  } catch {
    return "both";
  }
}

function saveLearningModePreference(value: ProgramForm["learningMode"]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEARNING_MODE_STORAGE_KEY, value);
  } catch {
    // Local storage can be unavailable in private or locked-down browser modes.
  }
}

function learningModeLabel(value: ProgramForm["learningMode"]) {
  if (value === "voice") return "Voice";
  if (value === "touch") return "Touch";
  return "Voice + Touch";
}

function recommendedRhythmFor(form: Pick<ProgramForm, "pace" | "lessonLengthMinutes">): Pick<ProgramForm, "frequency" | "durationWeeks"> {
  const frequency = form.pace === "curious" && form.lessonLengthMinutes <= 4 ? "daily" : "three_times_week";
  return { frequency, durationWeeks: 4 };
}

function lessonCountForRhythm(form: Pick<ProgramForm, "frequency" | "durationWeeks">) {
  if (form.frequency === "weekly") return form.durationWeeks;
  if (form.frequency === "three_times_week") return form.durationWeeks * 3;
  return form.durationWeeks * 7;
}

function rhythmDaysLabel(frequency: ProgramForm["frequency"]) {
  if (frequency === "three_times_week") return "Mon/Wed/Fri";
  if (frequency === "weekly") return "Weekly";
  return "Every day";
}

function rhythmPreview(form: ProgramForm) {
  const lessonLabel = lessonCountForRhythm(form) === 1 ? "lesson" : "lessons";
  return `${lessonCountForRhythm(form)} ${lessonLabel} - ${rhythmDaysLabel(form.frequency)} - ${timeLabel(form.dailyTime)}`;
}

function nextLearningItem(program: LearningProgram): LearningProgramItem | null {
  return program.items.find((item) => item.status !== "completed" && !item.completedAt) ?? null;
}

function nextLearningLabel(item: LearningProgramItem | null, dailyTime: string) {
  if (!item) return "Plan complete";
  const todayKey = new Date().toISOString().slice(0, 10);
  const label = item.scheduledDate === todayKey
    ? "Today"
    : new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(`${item.scheduledDate}T12:00:00`));
  return `${label} at ${timeLabel(dailyTime)}`;
}

function learningInterestSummary(interests: string[], categories: LearningCategory[]) {
  const labels = interests
    .map((slug) => categoryFor(categories, slug)?.label ?? slug.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "))
    .slice(0, 2);
  return labels.length ? labels.join(" + ") : "General Knowledge";
}

function makeInitialForm(program: LearningProgram | null, learningMode: ProgramForm["learningMode"] = "both"): ProgramForm {
  if (!program) return { ...DEFAULT_FORM, learningMode };
  return {
    learningMode,
    interests: program.interests.length ? program.interests : [DEFAULT_INTEREST],
    pace: program.pace ?? "gentle",
    frequency: program.frequency ?? "daily",
    durationWeeks: program.durationWeeks ?? 1,
    dailyTime: program.dailyTime ?? "09:00",
    lessonLengthMinutes: program.lessonLengthMinutes ?? 3,
  };
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-[#F8F4EF] px-4 py-6 text-[#2f2135]">
      <section className="mx-auto flex min-h-[420px] w-full max-w-4xl items-center justify-center rounded-[28px] border border-[#EDE2D1] bg-white">
        <span className="inline-flex items-center gap-3 text-sm font-black text-purple-700">
          <Loader2 className="animate-spin" size={20} />
          Loading learning program
        </span>
      </section>
    </main>
  );
}

function Wizard({
  categories,
  initialForm,
  saving,
  onCancel,
  onSubmit,
}: {
  categories: LearningCategory[];
  initialForm: ProgramForm;
  saving: boolean;
  onCancel?: () => void;
  onSubmit: (form: ProgramForm) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProgramForm>(initialForm);
  const [rhythmTouched, setRhythmTouched] = useState(false);
  const hasRenderedStepRef = useRef(false);
  const canGoNext = step < wizardStepTitles.length - 1;
  const recommendedRhythm = recommendedRhythmFor(form);

  useEffect(() => {
    if (!hasRenderedStepRef.current) {
      hasRenderedStepRef.current = true;
      return;
    }
    if (navigator.userAgent.toLowerCase().includes("jsdom")) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [step]);

  const toggleInterest = (slug: string) => {
    setForm((current) => {
      const exists = current.interests.includes(slug);
      const interests = exists
        ? current.interests.filter((interest) => interest !== slug)
        : current.interests.length === 1 && current.interests[0] === DEFAULT_INTEREST && slug !== DEFAULT_INTEREST
          ? [slug]
          : [...current.interests, slug];
      return { ...current, interests: interests.length ? interests : [DEFAULT_INTEREST] };
    });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#FFF6E9_0%,#FAF8F4_34%,#F6F0EA_100%)] px-4 py-5 text-[#261c29] min-[390px]:px-5 sm:px-6 sm:py-7" data-testid="learn-wizard">
      <section className="mx-auto w-full max-w-[920px]">
        <section className="overflow-hidden rounded-[28px] border border-[#E9DDCF] bg-white/95 shadow-[0_18px_46px_rgba(63,45,35,0.08)]">
          <header className="border-b border-[#F0E6DA] bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF8EF_55%,#F5ECFF_100%)] px-5 py-5 min-[390px]:px-6 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7 sm:py-6">
            <div className="min-w-0">
              <p className="inline-flex rounded-full bg-[#FFF1B8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">
                Learning setup
              </p>
              <h1 className="mt-3 max-w-[11em] font-body text-[31px] font-black leading-[0.98] text-[#211827] min-[390px]:text-[35px] sm:text-[42px]">
                Learn Something New
              </h1>
            </div>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[18px] border border-[#E4D9CE] bg-white px-4 text-[15px] font-black text-[#5b4a46] sm:mt-0 sm:w-auto"
              >
                Cancel
              </button>
            ) : null}
          </header>

          <div className="px-5 pb-5 pt-4 min-[390px]:px-6 min-[390px]:pb-6 sm:px-7 sm:pb-7">
            <div className="mb-5 rounded-[20px] border border-[#EFE6DA] bg-[#FFFCF8] p-3 min-[390px]:p-4">
              <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.1em] text-[#7a6c66] min-[390px]:text-[12px]">
                <span>Step {step + 1} of {wizardStepTitles.length}</span>
                <span className="rounded-full bg-white px-3 py-1 text-[#6D28D9] shadow-sm">{wizardStepTitles[step]}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2" aria-hidden="true">
                {wizardStepTitles.map((_title, index) => (
                  <span
                    key={index}
                    className={`h-2 rounded-full ${index <= step ? "bg-[#6D28D9]" : "bg-[#E8DED4]"}`}
                  />
                ))}
              </div>
            </div>

          {step === 0 ? (
            <>
              <h2 className="max-w-[13em] font-body text-[27px] font-black leading-[1.02] text-[#211827] min-[390px]:text-[30px] sm:max-w-none">How do you want to learn?</h2>
              <p className="mt-2 max-w-[38rem] text-[14px] font-bold leading-snug text-[#7d6b65] min-[390px]:text-[15px]">Choose voice, touch, or both. You can still switch anytime.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {learningModeOptions.map(({ id, label, description, Icon, recommended }) => {
                  const active = form.learningMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, learningMode: id }))}
                      aria-pressed={active}
                      className={`min-h-[112px] rounded-[20px] border px-4 py-4 text-left transition-transform hover:-translate-y-0.5 ${
                        active ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_12px_24px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white"
                      }`}
                      data-testid={`button-learn-mode-${id}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#F4EDFF] text-[#6D28D9]">
                          <Icon size={22} strokeWidth={2.5} />
                        </span>
                        {recommended ? (
                          <span className="rounded-full bg-[#FFF1B8] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">Recommended</span>
                        ) : null}
                      </span>
                      <span className="mt-4 block text-[19px] font-black leading-tight text-[#2f2135]">{label}</span>
                      <span className="mt-1 block text-[13px] font-bold leading-snug text-[#7d6b65]">{description}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2 className="max-w-[13em] font-body text-[27px] font-black leading-[1.02] text-[#211827] min-[390px]:text-[30px] sm:max-w-none">Choose what sparks your curiosity</h2>
              <p className="mt-2 max-w-[40rem] text-[14px] font-bold leading-snug text-[#7d6b65] min-[390px]:text-[15px]">Pick one or more interests. General Knowledge stays available as a fallback.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {categories.map((category) => {
                  const Icon = categoryIcon(category);
                  const active = form.interests.includes(category.slug);
                  return (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => toggleInterest(category.slug)}
                      aria-pressed={active}
                      className={`group flex min-h-[86px] items-center gap-3 rounded-[20px] border px-3.5 py-3.5 text-left transition-transform hover:-translate-y-0.5 min-[390px]:gap-4 min-[390px]:px-4 ${
                        active ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_12px_24px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white hover:border-[#CDBCEB]"
                      }`}
                      data-testid={`button-learn-interest-${category.slug}`}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px]" style={{ background: `${category.color}14`, color: category.color }}>
                        <Icon size={23} strokeWidth={2.45} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-black leading-tight text-[#2f2135] min-[390px]:text-[18px]">{category.label}</span>
                        <span className="mt-1 block text-[13px] font-bold leading-snug text-[#7d6b65]">{category.description}</span>
                      </span>
                      {active ? <CheckCircle2 className="h-6 w-6 shrink-0 text-[#6D28D9]" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2 className="font-body text-[27px] font-black leading-tight text-[#211827] min-[390px]:text-[30px]">Set the pace</h2>
              <p className="mt-2 max-w-[38rem] text-[14px] font-bold leading-snug text-[#7d6b65] min-[390px]:text-[15px]">Keep it light and readable. The lesson stays educational, not game-like.</p>
              <div className="mt-5 grid gap-3">
                {paceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setForm((current) => {
                      const next = { ...current, pace: option.id };
                      return rhythmTouched ? next : { ...next, ...recommendedRhythmFor(next) };
                    })}
                    aria-pressed={form.pace === option.id}
                    className={`flex min-h-[82px] items-center justify-between gap-3 rounded-[20px] border px-4 py-3.5 text-left transition-transform hover:-translate-y-0.5 ${
                      form.pace === option.id ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_12px_24px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white"
                    }`}
                    data-testid={`button-learn-pace-${option.id}`}
                  >
                    <span>
                      <span className="block text-[18px] font-black leading-tight">{option.label}</span>
                      <span className="mt-1 block text-[14px] font-bold leading-snug text-[#7d6b65]">{option.description}</span>
                    </span>
                    {form.pace === option.id ? <CheckCircle2 className="text-purple-700" size={22} /> : null}
                  </button>
                ))}
              </div>
              <label className="mt-5 block rounded-[20px] border border-[#E9DFD5] bg-[#FCFAF7] p-4">
                <span className="text-[16px] font-black text-[#2f2135]">Lesson length</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={form.lessonLengthMinutes}
                  onChange={(event) => setForm((current) => {
                    const next = { ...current, lessonLengthMinutes: Number(event.target.value) };
                    return rhythmTouched ? next : { ...next, ...recommendedRhythmFor(next) };
                  })}
                  className="mt-4 w-full accent-purple-700"
                />
                <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-[13px] font-black text-purple-700 shadow-sm">{form.lessonLengthMinutes} min</span>
              </label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h2 className="font-body text-[27px] font-black leading-tight text-[#211827] min-[390px]:text-[30px]">Choose your rhythm</h2>
              <p className="mt-2 max-w-[38rem] text-[14px] font-bold leading-snug text-[#7d6b65] min-[390px]:text-[15px]">Choose how often, how long, and when lessons should appear.</p>
              <section className="mt-5 rounded-[20px] border border-[#E9DFD5] bg-[#FCFAF7] p-4">
                <h3 className="text-[16px] font-black text-[#2f2135]">How often?</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {frequencyOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setRhythmTouched(true);
                        setForm((current) => ({ ...current, frequency: option.id }));
                      }}
                      aria-pressed={form.frequency === option.id}
                      className={`min-h-[78px] rounded-[18px] border px-3 py-3 text-left transition-transform hover:-translate-y-0.5 ${
                        form.frequency === option.id ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_10px_20px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white"
                      }`}
                      data-testid={`button-learn-frequency-${option.id}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="block text-[16px] font-black leading-tight text-[#2f2135]">{option.label}</span>
                        {recommendedRhythm.frequency === option.id ? (
                          <span className="rounded-full bg-[#FFF1B8] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">Recommended</span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-[12px] font-bold leading-snug text-[#7d6b65]">{option.description}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="mt-4 rounded-[20px] border border-[#E9DFD5] bg-[#FCFAF7] p-4">
                <h3 className="text-[16px] font-black text-[#2f2135]">For how long?</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {durationOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setRhythmTouched(true);
                        setForm((current) => ({ ...current, durationWeeks: option.id }));
                      }}
                      aria-pressed={form.durationWeeks === option.id}
                      className={`min-h-[78px] rounded-[18px] border px-3 py-3 text-left transition-transform hover:-translate-y-0.5 ${
                        form.durationWeeks === option.id ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_10px_20px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white"
                      }`}
                      data-testid={`button-learn-duration-${option.id}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="block text-[16px] font-black leading-tight text-[#2f2135]">{option.label}</span>
                        {recommendedRhythm.durationWeeks === option.id ? (
                          <span className="rounded-full bg-[#FFF1B8] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">Recommended</span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-[12px] font-bold leading-snug text-[#7d6b65]">{option.description}</span>
                    </button>
                  ))}
                </div>
              </section>
              <label className="mt-4 flex flex-col gap-3 rounded-[18px] border border-[#E9DFD5] bg-[#FCFAF7] p-4 min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between">
                <span className="flex items-center gap-2 text-[16px] font-black text-[#2f2135]">
                  <CalendarDays size={18} />
                  Preferred time
                </span>
                <input
                  type="time"
                  value={form.dailyTime}
                  onChange={(event) => setForm((current) => ({ ...current, dailyTime: event.target.value }))}
                  className="h-12 w-full rounded-[16px] border border-[#E4D9CE] bg-white px-4 text-[17px] font-black text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100 min-[390px]:w-[150px]"
                  data-testid="input-learn-daily-time"
                />
              </label>
              <div className="mt-4 rounded-[18px] border border-[#DDECE2] bg-[#F3FAF5] px-4 py-3 text-[15px] font-black leading-snug text-[#0A7C4E]" data-testid="learn-rhythm-preview">
                {rhythmPreview(form)}
              </div>
            </>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#F0E6DA] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#E4D9CE] bg-white px-4 text-[15px] font-black text-[#5b4a46] sm:w-auto"
                >
                  <ArrowLeft size={17} />
                  Back
                </button>
              ) : null}
            </div>

            {canGoNext ? (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[#6D28D9] px-5 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(109,40,217,0.20)] sm:w-auto"
              >
                Next
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => onSubmit(form)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[#6D28D9] px-5 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(109,40,217,0.20)] disabled:opacity-60 sm:w-auto"
                data-testid="button-learn-start-program"
              >
                {saving ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
                Start my plan
              </button>
            )}
          </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function LearnSomethingNewPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [learningMode, setLearningMode] = useState<ProgramForm["learningMode"]>(() => readLearningModePreference());

  const { data, isLoading, isError } = useQuery<LearningTodayResponse>({
    queryKey: ["/api/learning/today"],
    retry: false,
  });

  const categories = data?.categories ?? [];
  const program = data?.program ?? null;
  const today = data?.todayItem ?? null;
  const lesson = today?.lesson ?? null;
  const category = categoryFor(categories, lesson?.categorySlug);
  const nextItem = program ? nextLearningItem(program) : null;

  const createProgram = useMutation({
    mutationFn: async (form: ProgramForm) => {
      saveLearningModePreference(form.learningMode);
      setLearningMode(form.learningMode);
      const response = await apiFetch("/api/learning/programs", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Learning program could not be created.");
      return payload;
    },
    onSuccess: () => {
      setWizardOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["/api/learning/today"] });
      toast({ title: "Learning plan ready", description: "Your first lesson is waiting." });
    },
    onError: (error) => {
      toast({ title: "Could not start learning plan", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    },
  });

  const eventMutation = useMutation({
    mutationFn: async ({ eventType, item }: { eventType: "completed" | "saved" | "skipped" | "started"; item: LearningProgramItem }) => {
      const response = await apiFetch("/api/learning/events", {
        method: "POST",
        body: JSON.stringify({
          programId: item.programId,
          programItemId: item.id,
          eventType,
          source: "learn_hub",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Learning progress could not be saved.");
      return payload;
    },
    onSuccess: (_payload, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/learning/today"] });
      if (variables.eventType === "completed") toast({ title: "Lesson completed", description: "Nice. Tomorrow's snippet will keep the thread going." });
      if (variables.eventType === "saved") toast({ title: "Saved for later", description: "This lesson will stay marked for another look." });
    },
    onError: (error) => {
      toast({ title: "Could not update lesson", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    },
  });

  const initialForm = useMemo(() => makeInitialForm(program, learningMode), [program, learningMode]);
  const voiceFirst = learningMode === "voice";

  const readLesson = () => {
    if (!lesson || typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast({ title: "Read aloud is not available", description: "You can still read the lesson on screen." });
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${lesson.title}. ${lesson.hook}. ${lesson.body}. Reflection. ${lesson.reflectionPrompt}`);
    utterance.onend = () => setReading(false);
    utterance.onerror = () => setReading(false);
    setReading(true);
    window.speechSynthesis.speak(utterance);
    if (today) eventMutation.mutate({ eventType: "started", item: today });
  };

  const startAnotherPlan = () => {
    createProgram.mutate(initialForm);
  };

  if (isLoading) return <LoadingState />;

  if (isError) {
    return (
      <main className="min-h-screen bg-[#F8F4EF] px-4 py-6 text-[#2f2135]">
        <section className="mx-auto max-w-3xl rounded-[28px] border border-red-100 bg-white p-6 text-center">
          <h1 className="font-serif text-3xl">Learning could not load</h1>
          <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Please try again in a moment.</p>
        </section>
      </main>
    );
  }

  if (data?.onboardingRequired || wizardOpen || !program) {
    return (
      <Wizard
        categories={categories}
        initialForm={initialForm}
        saving={createProgram.isPending}
        onCancel={program ? () => setWizardOpen(false) : undefined}
        onSubmit={(form) => createProgram.mutate(form)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF8F4] px-4 py-6 text-[#261c29]" data-testid="learn-hub">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-[34px] leading-none text-[#211827] sm:text-[48px]">Learn Something New</h1>
            <div className="mt-4 grid gap-2 text-[13px] font-black text-[#4d403c] sm:grid-cols-3" data-testid="learn-plan-glance">
              <span className="rounded-[16px] border border-[#E9DFD5] bg-white px-3 py-2">Next: {nextLearningLabel(nextItem, program.dailyTime)}</span>
              <span className="rounded-[16px] border border-[#E9DFD5] bg-white px-3 py-2">{program.progress.totalCount || lessonCountForRhythm(program)} lessons {programPeriodLabel(program.durationWeeks)}</span>
              <span className="rounded-[16px] border border-[#E9DFD5] bg-white px-3 py-2">{learningModeLabel(learningMode)} - {learningInterestSummary(program.interests, categories)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex min-h-10 shrink-0 self-start items-center justify-center gap-2 rounded-lg border border-[#E4D9CE] bg-white px-4 text-sm font-black text-[#5b4a46] sm:self-auto"
            data-testid="button-learn-change-interests"
          >
            <SlidersHorizontal size={16} />
            Change interests
          </button>
        </header>

        <div className="mt-5" aria-label="Learning plan progress">
          <div className="flex gap-2">
            {program.items.map((item) => {
              const isComplete = item.status === "completed";
              const isToday = item.id === today?.id;
              return (
                <span
                  key={item.id}
                  aria-label={`Lesson ${item.programDay}${isComplete ? " complete" : isToday ? " today" : ""}`}
                  className={`h-2 flex-1 rounded-full ${
                    isComplete ? "bg-[#16A34A]" : isToday ? "bg-[#6D28D9]" : "bg-[#E5DCD2]"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[12px] font-bold text-[#7d6b65]">
            <span>Lesson 1</span>
            <span>Lesson {program.progress.totalCount || 7}</span>
          </div>
        </div>

        {lesson && today ? (
          <article className="mt-4 rounded-lg border border-[#E6DDD2] bg-white p-4 shadow-sm sm:mt-5 sm:p-7" data-testid="learn-today-lesson">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em]" style={{ color: category?.color ?? "#6D28D9" }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: category?.color ?? "#6D28D9" }} />
                {category?.label ?? "Learning"}
              </span>
              <span className="text-[12px] font-black uppercase tracking-[0.12em] text-[#9a8c84]">Today's lesson</span>
            </div>

            <h2 className="mt-4 max-w-2xl font-serif text-[30px] leading-[1.05] text-[#211827] sm:text-[40px]">{lesson.title}</h2>
            <p className="mt-3 max-w-2xl text-[16px] font-black leading-snug text-[#5b4a46] sm:text-[17px]">{lesson.hook}</p>

            <div className="my-5 h-px bg-[#EEE5DC] sm:my-6" />

            <p className="max-w-2xl text-[16px] font-semibold leading-[1.58] text-[#3f343d] sm:text-[18px] sm:leading-relaxed">{lesson.body}</p>

            <div className="mt-5 flex flex-col gap-5 sm:mt-6">
              <div className="order-2 mt-24 border-l-4 border-[#6D28D9] bg-[#FAF8F4] px-4 py-3 sm:order-1 sm:mt-0">
                <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[#6D28D9]">Reflection prompt</p>
                <p className="mt-2 text-[17px] font-black leading-snug text-[#332934]">{lesson.reflectionPrompt}</p>
              </div>

              <div className="order-1 grid grid-cols-2 gap-2 sm:order-2 sm:grid-cols-[1.35fr_1fr_1fr] sm:gap-3">
                {voiceFirst ? (
                  <button
                    type="button"
                    onClick={readLesson}
                    className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-5 py-3 text-sm font-black text-white shadow-sm sm:col-span-1 sm:min-h-[52px]"
                    data-testid="button-learn-read-aloud"
                  >
                    {reading ? <Headphones size={18} /> : <Volume2 size={18} />}
                    Listen aloud
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={eventMutation.isPending || today.status === "completed"}
                  onClick={() => eventMutation.mutate({ eventType: "completed", item: today })}
                  className={`${voiceFirst ? "" : "col-span-2 bg-[#6D28D9] text-white shadow-sm sm:col-span-1"} inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black disabled:opacity-60 sm:min-h-[52px] ${voiceFirst ? "border border-[#E4D9CE] bg-white text-[#5b4a46]" : ""}`}
                  data-testid="button-learn-complete"
                >
                  <CheckCircle2 size={18} />
                  I learned this
                </button>
                {!voiceFirst ? (
                  <button
                    type="button"
                    onClick={readLesson}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#E4D9CE] bg-white px-3 py-3 text-sm font-black text-[#5b4a46] sm:min-h-[52px] sm:px-5"
                    data-testid="button-learn-read-aloud"
                  >
                    {reading ? <Headphones size={18} /> : <Volume2 size={18} />}
                    Read aloud
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={eventMutation.isPending}
                  onClick={() => eventMutation.mutate({ eventType: "saved", item: today })}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#E4D9CE] bg-white px-3 py-3 text-sm font-black text-[#5b4a46] sm:min-h-[52px] sm:px-5"
                  data-testid="button-learn-save"
                >
                  <Bookmark size={18} />
                  Save for later
                </button>
              </div>
            </div>
          </article>
        ) : (
          <section className="mt-5 rounded-lg border border-[#DDECE2] bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto text-[#0A7C4E]" size={42} />
            <h2 className="mt-3 font-serif text-3xl">This learning plan is complete.</h2>
            <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Start another plan to keep receiving short lessons.</p>
            <button
              type="button"
              disabled={createProgram.isPending}
              onClick={startAnotherPlan}
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-5 text-sm font-black text-white"
              data-testid="button-learn-start-another-week"
            >
              <RotateCcw size={17} />
              Start another plan
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
