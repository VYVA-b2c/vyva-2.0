import { useMemo, useState } from "react";
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
  Languages,
  Landmark,
  Leaf,
  Loader2,
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
  interests: string[];
  pace: "gentle" | "steady" | "curious";
  dailyTime: string;
  lessonLengthMinutes: number;
};

const DEFAULT_INTEREST = "general_knowledge";
const DEFAULT_FORM: ProgramForm = {
  interests: [DEFAULT_INTEREST],
  pace: "gentle",
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

const wizardStepTitles = ["Interests", "Pace", "Rhythm"] as const;

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

function makeInitialForm(program: LearningProgram | null): ProgramForm {
  if (!program) return DEFAULT_FORM;
  return {
    interests: program.interests.length ? program.interests : [DEFAULT_INTEREST],
    pace: program.pace ?? "gentle",
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
  const canGoNext = step < 2;

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
    <main className="min-h-screen bg-[#FAF8F4] px-4 py-6 text-[#261c29]" data-testid="learn-wizard">
      <section className="mx-auto w-full max-w-3xl">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-[36px] leading-none text-[#211827] sm:text-[46px]">
              Learn Something New
            </h1>
            <p className="mt-3 max-w-xl text-[16px] font-semibold leading-relaxed text-[#6b5d58]">
              Pick a few interests and VYVA will shape one calm lesson a day.
            </p>
          </div>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E4D9CE] bg-white px-4 text-sm font-black text-[#5b4a46]"
            >
              Cancel
            </button>
          ) : null}
        </header>

        <section className="rounded-lg border border-[#E6DDD2] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between text-[12px] font-black uppercase tracking-[0.12em] text-[#7a6c66]">
              <span>Step {step + 1} of 3</span>
              <span>{wizardStepTitles[step]}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={`h-1.5 rounded-full ${index <= step ? "bg-[#6D28D9]" : "bg-[#E8DED4]"}`}
                />
              ))}
            </div>
          </div>

          {step === 0 ? (
            <>
              <h2 className="font-body text-[25px] font-black leading-tight">Choose what sparks your curiosity</h2>
              <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Pick one or more interests. General Knowledge stays available as a fallback.</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {categories.map((category) => {
                  const Icon = categoryIcon(category);
                  const active = form.interests.includes(category.slug);
                  return (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => toggleInterest(category.slug)}
                      className={`flex min-h-[76px] items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                        active ? "border-[#8B5CF6] bg-[#F7F2FF]" : "border-[#E9DFD5] bg-white hover:border-[#CDBCEB]"
                      }`}
                      data-testid={`button-learn-interest-${category.slug}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${category.color}14`, color: category.color }}>
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[16px] font-black text-[#2f2135]">{category.label}</span>
                        <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-[#7d6b65]">{category.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2 className="font-body text-[25px] font-black leading-tight">Set the pace</h2>
              <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Keep it light and readable. The lesson stays educational, not game-like.</p>
              <div className="mt-5 grid gap-2">
                {paceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, pace: option.id }))}
                    className={`flex min-h-[74px] items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left ${
                      form.pace === option.id ? "border-[#8B5CF6] bg-[#F7F2FF]" : "border-[#E9DFD5] bg-white"
                    }`}
                    data-testid={`button-learn-pace-${option.id}`}
                  >
                    <span>
                      <span className="block text-[17px] font-black">{option.label}</span>
                      <span className="mt-1 block text-[13px] font-semibold text-[#7d6b65]">{option.description}</span>
                    </span>
                    {form.pace === option.id ? <CheckCircle2 className="text-purple-700" size={22} /> : null}
                  </button>
                ))}
              </div>
              <label className="mt-5 block rounded-lg border border-[#E9DFD5] bg-[#FCFAF7] p-4">
                <span className="text-[15px] font-black text-[#2f2135]">Lesson length</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={form.lessonLengthMinutes}
                  onChange={(event) => setForm((current) => ({ ...current, lessonLengthMinutes: Number(event.target.value) }))}
                  className="mt-4 w-full accent-purple-700"
                />
                <span className="mt-2 inline-flex rounded-lg bg-white px-3 py-1 text-[13px] font-black text-purple-700">{form.lessonLengthMinutes} min</span>
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2 className="font-body text-[25px] font-black leading-tight">Choose a daily rhythm</h2>
              <p className="mt-2 text-sm font-semibold text-[#7d6b65]">VYVA will keep the first version in-app and show the lesson at this time.</p>
              <label className="mt-5 block rounded-lg border border-[#E9DFD5] bg-[#FCFAF7] p-4">
                <span className="flex items-center gap-2 text-[15px] font-black text-[#2f2135]">
                  <CalendarDays size={18} />
                  Daily lesson time
                </span>
                <input
                  type="time"
                  value={form.dailyTime}
                  onChange={(event) => setForm((current) => ({ ...current, dailyTime: event.target.value }))}
                  className="mt-3 h-14 w-full rounded-lg border border-[#E4D9CE] bg-white px-4 text-[18px] font-black text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                  data-testid="input-learn-daily-time"
                />
              </label>
              <div className="mt-5 rounded-lg border border-[#DDECE2] bg-[#F3FAF5] p-4 text-sm font-bold leading-relaxed text-[#0A7C4E]">
                Your first week will start today with one short lesson per day.
              </div>
            </>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#E4D9CE] bg-white px-4 text-sm font-black text-[#5b4a46]"
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
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-5 text-sm font-black text-white shadow-sm"
              >
                Next
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => onSubmit(form)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-5 text-sm font-black text-white shadow-sm disabled:opacity-60"
                data-testid="button-learn-start-program"
              >
                {saving ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
                Start my week
              </button>
            )}
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

  const { data, isLoading, isError } = useQuery<LearningTodayResponse>({
    queryKey: ["/api/learning/today"],
    retry: false,
  });

  const categories = data?.categories ?? [];
  const program = data?.program ?? null;
  const today = data?.todayItem ?? null;
  const lesson = today?.lesson ?? null;
  const category = categoryFor(categories, lesson?.categorySlug);

  const createProgram = useMutation({
    mutationFn: async (form: ProgramForm) => {
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
      toast({ title: "Learning week ready", description: "Your first daily lesson is waiting." });
    },
    onError: (error) => {
      toast({ title: "Could not start learning week", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
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

  const initialForm = useMemo(() => makeInitialForm(program), [program]);

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

  const startAnotherWeek = () => {
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
            <p className="mt-3 text-[15px] font-semibold leading-relaxed text-[#6b5d58]">
              Day {program.progress.currentDay} of {program.progress.totalCount || 7} | {program.progress.completedCount}/{program.progress.totalCount || 7} complete | {timeLabel(program.dailyTime)} | {program.lessonLengthMinutes} min
            </p>
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

        <div className="mt-5" aria-label="7 day learning progress">
          <div className="flex gap-2">
            {program.items.map((item) => {
              const isComplete = item.status === "completed";
              const isToday = item.id === today?.id;
              return (
                <span
                  key={item.id}
                  aria-label={`Day ${item.programDay}${isComplete ? " complete" : isToday ? " today" : ""}`}
                  className={`h-2 flex-1 rounded-full ${
                    isComplete ? "bg-[#16A34A]" : isToday ? "bg-[#6D28D9]" : "bg-[#E5DCD2]"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[12px] font-bold text-[#7d6b65]">
            <span>Day 1</span>
            <span>Day {program.progress.totalCount || 7}</span>
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
                <button
                  type="button"
                  disabled={eventMutation.isPending || today.status === "completed"}
                  onClick={() => eventMutation.mutate({ eventType: "completed", item: today })}
                  className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60 sm:col-span-1 sm:min-h-[52px]"
                  data-testid="button-learn-complete"
                >
                  <CheckCircle2 size={18} />
                  I learned this
                </button>
                <button
                  type="button"
                  onClick={readLesson}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#E4D9CE] bg-white px-3 py-3 text-sm font-black text-[#5b4a46] sm:min-h-[52px] sm:px-5"
                  data-testid="button-learn-read-aloud"
                >
                  {reading ? <Headphones size={18} /> : <Volume2 size={18} />}
                  Read aloud
                </button>
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
            <h2 className="mt-3 font-serif text-3xl">This learning week is complete.</h2>
            <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Start another week to keep receiving daily snippets.</p>
            <button
              type="button"
              disabled={createProgram.isPending}
              onClick={startAnotherWeek}
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-5 text-sm font-black text-white"
              data-testid="button-learn-start-another-week"
            >
              <RotateCcw size={17} />
              Start another week
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
