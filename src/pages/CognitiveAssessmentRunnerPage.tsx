import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Brain, CheckCircle2, ChevronRight, Clock3, Loader2, PlayCircle, Plus, Timer } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/queryClient";
import { useLanguage } from "@/i18n";
import type {
  CognitiveAssessmentCompleteSessionResponse,
  CognitiveAssessmentLanguage,
  CognitiveAssessmentLoadSessionResponse,
  CognitiveAssessmentRunnerSession,
  CognitiveAssessmentRunnerTask,
  CognitiveAssessmentSaveResponseRequest,
  CognitiveAssessmentStartSessionResponse,
} from "../../shared/cognitiveAssessmentRunner";
import { buildStoryRecallScoringFields } from "../../shared/cognitiveStoryRecallScoring";

const SESSION_STORAGE_KEY = "vyva_cognitive_assessment_session_id";

const ASSESSMENT_LANGUAGES: Array<{ value: CognitiveAssessmentLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
];

type FormState = Record<string, unknown>;

type StepTransition = {
  savedLabel: string;
  savedDomain: string;
  nextLabel: string;
  nextDomain: string;
  nextIndex: number;
  completedCount: number;
  totalSteps: number;
  remainingMinutes: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function splitWords(value: unknown) {
  return text(value)
    .split(/[\n,;]+/g)
    .map((word) => word.trim())
    .filter(Boolean);
}

function countWords(value: unknown) {
  return text(value).split(/\s+/g).map((word) => word.trim()).filter(Boolean).length;
}

function digitsOnly(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function sequenceDigits(value: unknown) {
  return digitsOnly(value).split("").filter(Boolean);
}

function digitTrialRows(content: Record<string, unknown>, key: "forward_trials" | "backward_trials") {
  return asArray(content[key])
    .map((trial) => asRecord(trial))
    .flatMap((trial) => {
      const length = numberValue(trial.length, 0);
      return asArray(trial.sequences)
        .map((sequence) => ({
          length,
          sequence: text(sequence),
        }))
        .filter((trialRow) => trialRow.length > 0 && trialRow.sequence);
    });
}

function appendDelimited(current: unknown, next: string) {
  const existing = text(current);
  return existing ? `${existing}, ${next}` : next;
}

function storyReadSeconds(body: unknown) {
  return Math.min(45, Math.max(25, Math.ceil(countWords(body) * 0.6)));
}

function itemId(item: Record<string, unknown>, index: number) {
  return text(item.id) || text(item.prompt_key) || `item-${index}`;
}

function answeredValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function answeredCountForItems(items: Record<string, unknown>[], answers: Record<string, unknown>) {
  return items.filter((item, index) => answeredValue(answers[itemId(item, index)])).length;
}

function estimatedRemainingMinutes(tasks: CognitiveAssessmentRunnerSession["tasks"], currentIndex: number) {
  const seconds = tasks
    .slice(Math.max(0, currentIndex))
    .reduce((sum, task) => sum + Math.max(30, task.expectedDurationSec), 0);
  return Math.max(1, Math.ceil(seconds / 60));
}

function orientationPlaceholder(promptKey: string) {
  if (promptKey.includes("date")) return "Example: 6 July";
  if (promptKey.includes("year")) return "Example: 2026";
  if (promptKey.includes("month")) return "Example: July";
  if (promptKey.includes("day")) return "Example: Monday";
  if (promptKey.includes("hour")) return "Example: 10";
  if (promptKey.includes("country")) return "Example: Spain";
  if (promptKey.includes("city")) return "Example: Madrid";
  if (promptKey.includes("season")) return "Example: summer";
  if (promptKey.includes("region") || promptKey.includes("departement") || promptKey.includes("distrito") || promptKey.includes("concelho")) return "Type the local area";
  return "Type a short answer";
}

function taskInstruction(task: CognitiveAssessmentRunnerTask, formState: FormState) {
  if (task.id === "orientation") return "Answer each context question in a few words.";
  if (task.id === "story_recall_immediate") {
    return formState.storyReadComplete ? "Write remembered details, then save this step." : "Read the story once. It will hide before recall.";
  }
  if (task.id === "story_recall_delayed") return "Without looking back, type anything you remember from the earlier story.";
  if (task.id.includes("fluency")) return "Start the timer, add words one by one, then finish the round.";
  if (task.id === "digit_span") return "Show the numbers, type them back, then save after both rounds.";
  if (task.id === "similarities") return "Give a short answer for each pair.";
  if (task.id === "clock_drawing") return "Set both clock hands before saving.";
  if (["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"].includes(task.id)) return "Tap one answer for every question.";
  return "Complete the response, then save this step.";
}

function languageFromApp(value: string): CognitiveAssessmentLanguage {
  return ASSESSMENT_LANGUAGES.some((language) => language.value === value)
    ? value as CognitiveAssessmentLanguage
    : "en";
}

function languageLabel(value: CognitiveAssessmentLanguage) {
  return ASSESSMENT_LANGUAGES.find((language) => language.value === value)?.label ?? "English";
}

function promptLabel(promptKey: unknown) {
  const key = text(promptKey);
  const labels: Record<string, string> = {
    what_year: "What year is it?",
    what_month: "What month is it?",
    what_day_of_week: "What day of the week is it?",
    what_country: "What country are you in?",
    what_city: "What city are you in?",
    what_season: "What season is it?",
    what_date: "What is today's date?",
    morning_or_afternoon: "Is it morning, afternoon, or evening?",
    what_departement: "What department are you in?",
    what_distrito: "What district are you in?",
    what_region: "What region are you in?",
    what_concelho: "What municipality are you in?",
    what_home_type: "What kind of home are you in?",
    what_time_hour: "About what hour is it?",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

function buildInitialState(task: CognitiveAssessmentRunnerTask | null): FormState {
  if (!task) return {};
  if (task.id === "digit_span") return { forwardSpan: "", backwardSpan: "", digitTrials: [], digitComplete: false };
  if (task.id === "orientation") return { answers: {} };
  if (["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"].includes(task.id)) return { answers: {} };
  if (task.id === "similarities") return { answers: {} };
  if (task.id === "story_recall_immediate") return { text: "", storyReadComplete: false, storyNoRecall: false };
  if (task.id === "story_recall_delayed") return { text: "", storyNoRecall: false };
  if (task.id === "clock_drawing") return { text: "", clockHour: "", clockMinute: "" };
  return { text: "" };
}

function scoreTextAnswer(value: unknown) {
  const words = countWords(value);
  return {
    text: text(value),
    word_count: words,
    score: words > 0 ? 1 : 0,
  };
}

export function buildResponseData(task: CognitiveAssessmentRunnerTask, formState: FormState): Record<string, unknown> {
  const content = asRecord(task.content);

  if (task.id === "orientation") {
    const answers = asRecord(formState.answers);
    const items = asArray(content.items).map((item) => asRecord(item));
    const responseItems = items.map((item) => {
      const promptKey = text(item.prompt_key);
      return {
        prompt_key: promptKey,
        answer: text(answers[promptKey]),
      };
    });
    const answeredCount = responseItems.filter((item) => item.answer).length;
    return {
      items: responseItems,
      answered_count: answeredCount,
      score: answeredCount,
      max_score: items.length,
    };
  }

  if (task.id.includes("story_recall")) {
    return {
      text: text(formState.text),
      ...buildStoryRecallScoringFields(formState.text, content.idea_units),
      title: text(content.title),
      delayed: Boolean(content.delayed),
      no_recall: Boolean(formState.storyNoRecall),
    };
  }

  if (task.id.includes("fluency")) {
    const words = splitWords(formState.text);
    const unique = Array.from(new Set(words.map((word) => word.toLocaleLowerCase())));
    return {
      words,
      unique_responses: unique,
      score: unique.length,
      prompt: text(content.letter) || text(content.category),
    };
  }

  if (task.id === "digit_span") {
    const forward = numberValue(formState.forwardSpan, 0);
    const backward = numberValue(formState.backwardSpan, 0);
    return {
      longest_span_forward: forward,
      longest_span_backward: backward,
      trials: asArray(formState.digitTrials),
      scoring_method: "guided_digit_span",
      score: forward + backward,
      max_score: 17,
    };
  }

  if (task.id === "similarities") {
    const answers = asRecord(formState.answers);
    const items = asArray(content.items).map((item) => asRecord(item));
    const responses = items.map((item) => {
      const itemId = text(item.id);
      const itemContent = asRecord(item.content);
      return {
        item_bank_id: itemId,
        pair: asArray(itemContent.pair).map(String),
        answer: text(answers[itemId]),
      };
    });
    const answeredCount = responses.filter((response) => response.answer).length;
    return {
      responses,
      item_bank_ids: task.itemBankIds ?? [],
      answered_count: answeredCount,
      score: answeredCount,
      max_score: responses.length * 2,
    };
  }

  if (task.id === "clock_drawing") {
    const placedHour = text(formState.clockHour) ? numberValue(formState.clockHour, 0) : null;
    const placedMinute = text(formState.clockMinute) ? numberValue(formState.clockMinute, 0) : null;
    const clockText = text(formState.text) || (placedHour !== null && placedMinute !== null
      ? `Placed clock hands at ${placedHour}:${String(placedMinute).padStart(2, "0")}.`
      : "");
    return {
      text: clockText,
      word_count: countWords(clockText),
      score: placedHour !== null && placedMinute !== null ? 1 : 0,
      target_time: text(content.target_time),
      placed_hour: placedHour,
      placed_minute: placedMinute,
      placement_complete: placedHour !== null && placedMinute !== null,
      input_method: "clock_hand_placement",
    };
  }

  if (["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"].includes(task.id)) {
    const answers = asRecord(formState.answers);
    const items = asArray(content.items).map((item) => asRecord(item));
    const scale = asArray(content.scale).map((item) => asRecord(item));
    const responseItems = items.map((item) => {
      const itemId = text(item.id);
      const value = numberValue(answers[itemId], 0);
      const scaleItem = scale.find((entry) => numberValue(entry.value, Number.NaN) === value);
      return {
        id: itemId,
        text: text(item.text),
        value,
        label: text(scaleItem?.label),
      };
    });
    const score = responseItems.reduce((sum, item) => sum + item.value, 0);
    return {
      instrument: text(content.instrument, task.id),
      answers: responseItems,
      score,
    };
  }

  return scoreTextAnswer(formState.text);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === "object" && body && "error" in body ? String((body as { error?: unknown }).error) : "Request failed.";
    throw new Error(message);
  }
  return body as T;
}

function RunnerHeader({
  currentStep,
  totalSteps,
  detail,
}: {
  currentStep: number;
  totalSteps: number;
  detail?: string;
}) {
  const navigate = useNavigate();
  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  return (
    <header className="px-5 pt-3">
      <div className="rounded-[22px] border border-[#DDD6FE] bg-white p-3 shadow-[0_10px_24px_rgba(63,45,35,0.06)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/mind-memory/cognitive-assessment")}
            aria-label="Back to Cognitive Assessment"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FFFCF8] text-[#2f2135] shadow-sm"
          >
            <ArrowLeft size={19} />
          </button>
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-[#6B21A8]">
            <Brain size={23} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-black leading-tight text-[#2f2135]">Guided check</p>
            <p className="mt-0.5 text-[13px] font-black text-[#766b63]">
              {detail ?? `Step ${Math.min(currentStep, totalSteps)} of ${totalSteps}`}
            </p>
          </div>
          <div className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-xs font-black text-[#6B21A8]">
            {progress}%
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EFE7DE]">
          <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </header>
  );
}

function IntroScreen({
  language,
  onStart,
  isStarting,
  error,
}: {
  language: CognitiveAssessmentLanguage;
  onStart: () => void;
  isStarting: boolean;
  error: string | null;
}) {
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-32">
      <RunnerHeader currentStep={0} totalSteps={12} />
      <section className="grid gap-4 px-5 pt-4">
        <div className="rounded-[26px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <h2 className="text-[24px] font-black leading-tight text-[#2f2135]">Start a new check</h2>
          <p className="mt-2 text-[15px] font-bold leading-relaxed text-[#766b63]">
            The assessment will use the member's VYVA language. You can answer by typing, tapping choices, or entering short notes.
          </p>
          <div className="mt-5 rounded-[20px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[#6B21A8]">Assessment language</p>
            <p className="mt-1 text-[16px] font-black text-[#2f2135]">{languageLabel(language)}</p>
          </div>
          <button
            type="button"
            onClick={onStart}
            disabled={isStarting}
            className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[16px] font-black text-white disabled:opacity-60"
          >
            {isStarting ? <Loader2 className="animate-spin" size={20} /> : <PlayCircle size={20} />}
            Start assessment
          </button>
          {error ? (
            <div className="mt-4 rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-black text-[#991B1B]">
              {error}
            </div>
          ) : null}
        </div>
        <p className="px-1 text-[12px] font-bold leading-relaxed text-[#766b63]">
          This wellness check helps track changes over time. It does not diagnose a medical condition.
        </p>
      </section>
    </main>
  );
}

function TextArea({
  value,
  onChange,
  label,
  placeholder,
  helperText,
  autoFocus = false,
  rows = 6,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  helperText?: string;
  autoFocus?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#2f2135]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mt-2 w-full resize-y rounded-[20px] border border-[#E8DED4] bg-white px-4 py-3 text-[16px] font-bold leading-relaxed text-[#2f2135] outline-none focus:border-[#A855F7]"
      />
      {helperText ? (
        <span className="mt-2 block text-[12px] font-bold leading-relaxed text-[#766b63]">{helperText}</span>
      ) : null}
    </label>
  );
}

function StoryRecallImmediateFields({
  content,
  formState,
  setFormState,
}: {
  content: Record<string, unknown>;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
}) {
  const title = text(content.title, "Story");
  const body = text(content.body, "Story content is not loaded yet.");
  const readSeconds = storyReadSeconds(body);
  const [secondsLeft, setSecondsLeft] = useState(readSeconds);
  const readComplete = Boolean(formState.storyReadComplete);
  const progress = readComplete ? 100 : Math.round(((readSeconds - secondsLeft) / readSeconds) * 100);

  useEffect(() => {
    setSecondsLeft(readSeconds);
  }, [readSeconds, title]);

  useEffect(() => {
    if (readComplete) return;
    if (secondsLeft <= 0) {
      setFormState((current) => ({ ...current, storyReadComplete: true }));
      return;
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [readComplete, secondsLeft, setFormState]);

  const startRecall = () => {
    setSecondsLeft(0);
    setFormState((current) => ({ ...current, storyReadComplete: true }));
  };

  if (!readComplete) {
    return (
      <div className="grid gap-4">
        <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] p-4 text-[#2f2135]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Read once</p>
              <h3 className="mt-1 text-[21px] font-black leading-tight">{title}</h3>
            </div>
            <div className="flex min-w-[74px] items-center justify-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-black text-[#6B21A8]" aria-live="polite">
              <Clock3 size={16} />
              {secondsLeft}s
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#7C3AED] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-4 text-[17px] font-black leading-relaxed">{body}</p>
          <p className="mt-4 rounded-[18px] bg-white/70 px-4 py-3 text-[13px] font-bold leading-relaxed text-[#62564f]">
            Read once. Then write what you remember.
          </p>
          <button
            type="button"
            onClick={startRecall}
            className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-[18px] bg-[#2f2135] px-4 text-[15px] font-black text-white"
          >
            I have read it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-[#14532D]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#059669]">
            <CheckCircle2 size={21} />
          </span>
          <div>
            <h3 className="text-[20px] font-black leading-tight">Story hidden</h3>
            <p className="mt-1 text-[14px] font-bold leading-relaxed">
              Write any details. Fragments are fine.
            </p>
          </div>
        </div>
      </div>
      <TextArea
        label="What do you remember?"
        placeholder="Type names, places, actions, objects, and anything else you remember."
        helperText="It is fine to write fragments. The report uses what you recall, not spelling or grammar."
        autoFocus
        value={text(formState.text)}
        onChange={(value) => setFormState((current) => ({ ...current, text: value, storyNoRecall: false }))}
      />
      <button
        type="button"
        onClick={() => setFormState((current) => ({ ...current, text: "", storyNoRecall: true }))}
        className={`min-h-[48px] rounded-[18px] border px-4 text-[14px] font-black ${
          formState.storyNoRecall
            ? "border-[#7C3AED] bg-[#F5F3FF] text-[#5B21B6]"
            : "border-[#E8DED4] bg-white text-[#62564f]"
        }`}
      >
        I do not remember any details
      </button>
    </div>
  );
}

function StoryRecallDelayedFields({
  content,
  formState,
  setFormState,
}: {
  content: Record<string, unknown>;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Delayed recall</p>
        <h3 className="mt-1 text-[20px] font-black leading-tight text-[#2f2135]">
          Recall the story: {text(content.title, "Earlier story")}
        </h3>
        <p className="mt-2 text-[14px] font-bold leading-relaxed text-[#62564f]">
          Do not look back. Fragments are fine.
        </p>
      </div>
      <TextArea
        label="What do you remember now?"
        placeholder="Type anything you remember from the earlier story."
        value={text(formState.text)}
        onChange={(value) => setFormState((current) => ({ ...current, text: value, storyNoRecall: false }))}
      />
      <button
        type="button"
        onClick={() => setFormState((current) => ({ ...current, text: "", storyNoRecall: true }))}
        className={`min-h-[48px] rounded-[18px] border px-4 text-[14px] font-black ${
          formState.storyNoRecall
            ? "border-[#7C3AED] bg-[#F5F3FF] text-[#5B21B6]"
            : "border-[#E8DED4] bg-white text-[#62564f]"
        }`}
      >
        I do not remember any details
      </button>
    </div>
  );
}

function OrientationFields({
  content,
  formState,
  setFormState,
}: {
  content: Record<string, unknown>;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
}) {
  const answers = asRecord(formState.answers);
  const items = asArray(content.items).map((item) => asRecord(item));
  const answeredCount = answeredCountForItems(items, answers);

  if (items.length === 0) {
    return <p className="text-[15px] font-bold text-[#766b63]">Orientation form content is not ready yet.</p>;
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Quick context</span>
            <span className="mt-1 block text-[17px] font-black leading-snug text-[#2f2135]">
              Short answers are fine.
            </span>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#6B21A8]">
            {answeredCount}/{items.length} answered
          </span>
        </div>
      </div>
      {items.map((item, index) => {
        const promptKey = text(item.prompt_key);
        return (
          <label key={promptKey} className="block rounded-[22px] border border-[#EFE7DE] bg-[#FFFCF8] p-4">
            <span className="flex items-start gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F5F3FF] text-sm font-black text-[#6B21A8]">
                {index + 1}
              </span>
              <span className="pt-1 text-[16px] font-black leading-snug text-[#2f2135]">{promptLabel(promptKey)}</span>
            </span>
            <input
              value={text(answers[promptKey])}
              placeholder={orientationPlaceholder(promptKey)}
              onChange={(event) => setFormState((current) => ({
                ...current,
                answers: { ...asRecord(current.answers), [promptKey]: event.target.value },
              }))}
              className="mt-3 min-h-[52px] w-full rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-bold text-[#2f2135] outline-none focus:border-[#A855F7]"
            />
          </label>
        );
      })}
    </div>
  );
}

function FluencyFields({
  content,
  formState,
  setFormState,
}: {
  content: Record<string, unknown>;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
}) {
  const letter = text(content.letter);
  const category = text(content.category, "category");
  const targetLabel = letter ? letter.toUpperCase() : category;
  const instruction = letter
    ? `Say words that start with ${targetLabel}`
    : `Name ${targetLabel}`;
  const hint = letter
    ? "Add one word each time it comes to mind."
    : "Any real word in this group counts.";
  const durationSeconds = 60;
  const [draft, setDraft] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const started = Boolean(formState.fluencyStarted);
  const complete = Boolean(formState.fluencyComplete);
  const words = splitWords(formState.text);
  const uniqueWords = Array.from(new Set(words.map((word) => word.toLocaleLowerCase())));

  useEffect(() => {
    setDraft("");
    setSecondsLeft(durationSeconds);
  }, [instruction]);

  useEffect(() => {
    if (!started || complete) return;
    if (secondsLeft <= 0) {
      setFormState((current) => ({ ...current, fluencyComplete: true }));
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [complete, secondsLeft, setFormState, started]);

  const addWord = () => {
    const next = draft.trim();
    if (!next) return;
    setFormState((current) => ({ ...current, text: appendDelimited(current.text, next) }));
    setDraft("");
  };

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#D8C7FF] bg-[#F8F4FF]">
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h3 className="text-[30px] font-black leading-none text-[#2f2135] sm:text-[36px]">{instruction}</h3>
          <p className="mt-2 text-[16px] font-bold leading-snug text-[#62564f]">{hint}</p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <div className="flex h-[74px] w-[74px] shrink-0 flex-col items-center justify-center rounded-[22px] bg-white text-[#6B21A8] shadow-sm" aria-live="polite">
            {complete ? <CheckCircle2 size={23} /> : <Timer size={21} />}
            <span className="mt-1 text-[22px] font-black leading-none">{complete ? "Done" : started ? secondsLeft : 60}</span>
            {!complete ? <span className="text-[11px] font-black uppercase tracking-[0.08em]">sec</span> : null}
          </div>
          <div className="flex h-[74px] min-w-[88px] flex-col items-center justify-center rounded-[22px] bg-[#ECFDF5] px-4 text-[#047857] shadow-sm">
            <span className="text-[26px] font-black leading-none">{uniqueWords.length}</span>
            <span className="text-[11px] font-black uppercase tracking-[0.08em]">unique</span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#E8DDFF] bg-white/70 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[160px_minmax(0,1fr)_112px]">
          <button
            type="button"
            onClick={() => setFormState((current) => ({ ...current, fluencyStarted: true, fluencyComplete: false }))}
            disabled={started && !complete}
            className="col-span-2 inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[17px] font-black text-white shadow-[0_12px_22px_rgba(47,33,53,0.16)] disabled:bg-[#EDE9FE] disabled:text-[#6B21A8] sm:col-span-1"
          >
            {started && !complete ? <CheckCircle2 size={22} /> : <PlayCircle size={22} />}
            {started && !complete ? "Started" : complete ? "Start again" : "Start"}
          </button>
          <input
            value={draft}
            disabled={!started || complete}
            placeholder={complete ? "Round complete" : started ? "Type one word" : "Press Start first"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addWord();
              }
            }}
            className="min-h-[56px] min-w-0 flex-1 rounded-[20px] border border-[#E8DED4] bg-white px-5 text-[18px] font-black text-[#2f2135] outline-none focus:border-[#A855F7] disabled:opacity-60"
            aria-label="Type one word"
          />
          <button
            type="button"
            onClick={addWord}
            disabled={!started || complete || !draft.trim()}
            className="inline-flex min-h-[56px] min-w-[92px] items-center justify-center gap-2 rounded-[20px] bg-[#7C3AED] px-4 text-[16px] font-black text-white disabled:opacity-50 sm:min-w-[112px]"
          >
            <Plus size={20} />
            Add
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-black text-[#6B21A8]">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">Type word</span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">Press Enter</span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">Keep going</span>
        </div>

        <div className="mt-3 min-h-[50px] rounded-[20px] border border-[#F3E8DD] bg-white/80 p-3">
          <div className="flex flex-wrap gap-2">
            {words.length === 0 ? (
              <span className="text-[14px] font-bold text-[#766b63]">
                {started ? "Your words will appear here." : "Start the timer, then add words quickly."}
              </span>
            ) : words.map((word, index) => (
              <span key={`${word}-${index}`} className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-sm font-black text-[#2f2135] shadow-sm">
                {word}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] font-bold text-[#766b63]">
            Repeats are okay. Only different words count.
          </p>
          <button
            type="button"
            onClick={() => setFormState((current) => ({ ...current, fluencyComplete: true }))}
            disabled={!started || complete}
            className="min-h-[42px] rounded-full bg-[#F5F3FF] px-5 text-[15px] font-black text-[#6B21A8] disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </section>
  );
}

type DigitDirection = "forward" | "backward";

function DigitSpanFields({
  content,
  formState,
  setFormState,
}: {
  content: Record<string, unknown>;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
}) {
  const forwardTrials = digitTrialRows(content, "forward_trials");
  const backwardTrials = digitTrialRows(content, "backward_trials");
  const [direction, setDirection] = useState<DigitDirection>("forward");
  const [trialIndex, setTrialIndex] = useState(0);
  const [showing, setShowing] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const trials = direction === "forward" ? forwardTrials : backwardTrials;
  const trial = trials[trialIndex] ?? null;
  const forwardSpan = numberValue(formState.forwardSpan, 0);
  const backwardSpan = numberValue(formState.backwardSpan, 0);
  const isComplete = Boolean(formState.digitComplete);

  useEffect(() => {
    setDirection("forward");
    setTrialIndex(0);
    setShowing(false);
    setHasShown(false);
    setAnswer("");
    setFeedback("");
  }, [content.forward_prompt]);

  useEffect(() => {
    if (!showing || !trial) return;
    const displayMs = Math.min(5000, Math.max(2200, sequenceDigits(trial.sequence).length * 700));
    const timer = window.setTimeout(() => setShowing(false), displayMs);
    return () => window.clearTimeout(timer);
  }, [showing, trial]);

  const finishDirection = () => {
    if (direction === "forward") {
      setDirection("backward");
      setTrialIndex(0);
      setAnswer("");
      setHasShown(false);
      setFeedback("Good. Now try the numbers backward.");
      return;
    }
    setFeedback("Digit span complete. You can continue.");
    setFormState((current) => ({ ...current, digitComplete: true }));
  };

  const moveAfterAnswer = (correct: boolean) => {
    if (!trial) return;
    if (correct) {
      const nextLongerIndex = trials.findIndex((candidate, index) => index > trialIndex && candidate.length > trial.length);
      if (nextLongerIndex >= 0) {
        setTrialIndex(nextLongerIndex);
        return;
      }
      finishDirection();
      return;
    }

    const retrySameLengthIndex = trials.findIndex((candidate, index) => index > trialIndex && candidate.length === trial.length);
    if (retrySameLengthIndex >= 0) {
      setTrialIndex(retrySameLengthIndex);
      return;
    }
    finishDirection();
  };

  const checkAnswer = (overrideAnswer?: string) => {
    if (!trial || isComplete) return;
    const shownDigits = sequenceDigits(trial.sequence);
    const expectedDigits = direction === "forward" ? shownDigits : [...shownDigits].reverse();
    const expected = expectedDigits.join("");
    const actual = digitsOnly(overrideAnswer ?? answer);
    const correct = actual === expected;
    const nextSpan = correct ? trial.length : 0;
    setFormState((current) => {
      const currentForward = numberValue(current.forwardSpan, 0);
      const currentBackward = numberValue(current.backwardSpan, 0);
      return {
        ...current,
        forwardSpan: direction === "forward" && correct ? Math.max(currentForward, nextSpan) : current.forwardSpan,
        backwardSpan: direction === "backward" && correct ? Math.max(currentBackward, nextSpan) : current.backwardSpan,
        digitTrials: [
          ...asArray(current.digitTrials),
          {
            direction,
            length: trial.length,
            sequence: trial.sequence,
            answer: actual,
            expected,
            correct,
          },
        ],
      };
    });
    const skipped = overrideAnswer !== undefined && actual.length === 0;
    setFeedback(correct ? "Correct. Try the next one." : skipped ? "No problem. Try one more at this level." : "That one was not exact. Try one more at this level.");
    setAnswer("");
    setShowing(false);
    setHasShown(false);
    moveAfterAnswer(correct);
  };

  const showNumbers = () => {
    setShowing(true);
    setHasShown(true);
    setAnswer("");
    setFeedback("");
  };

  if (forwardTrials.length === 0 || backwardTrials.length === 0) {
    return (
      <div className="rounded-[20px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[15px] font-black text-[#92400E]">
        Digit span content is not ready for this language yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] p-4">
        <div className="mb-4 grid grid-cols-3 gap-2 text-center text-[11px] font-black uppercase tracking-[0.08em]">
          {[
            { key: "forward", label: "Forward", done: forwardSpan > 0 || direction === "backward" || isComplete, active: direction === "forward" && !isComplete },
            { key: "backward", label: "Backward", done: backwardSpan > 0 || isComplete, active: direction === "backward" && !isComplete },
            { key: "save", label: "Save", done: isComplete, active: isComplete },
          ].map((step) => (
            <span
              key={step.key}
              className={`rounded-full px-2 py-2 ${
                step.done
                  ? "bg-[#ECFDF5] text-[#047857]"
                  : step.active
                  ? "bg-white text-[#6B21A8] shadow-sm"
                  : "bg-white/60 text-[#8A7C73]"
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Number Memory</p>
        <p className="mt-1 text-[18px] font-black leading-snug text-[#2f2135]">
          {isComplete
            ? "Digit span complete. You can continue."
            : direction === "forward"
            ? text(content.forward_prompt, "Repeat the numbers in the same order.")
            : text(content.backward_prompt, "Repeat the numbers in reverse order.")}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[18px] bg-white px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[#766b63]">Forward</p>
            <p className="mt-1 text-[24px] font-black text-[#2f2135]">{forwardSpan}</p>
          </div>
          <div className="rounded-[18px] bg-white px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[#766b63]">Backward</p>
            <p className="mt-1 text-[24px] font-black text-[#2f2135]">{backwardSpan}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#EFE7DE] bg-[#FFFCF8] p-4">
        {isComplete ? (
          <div className="rounded-[20px] border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-4 text-[#047857]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white">
                <CheckCircle2 size={22} />
              </span>
              <span>
                <span className="block text-[17px] font-black">Both rounds are complete.</span>
                <span className="mt-1 block text-[13px] font-bold leading-snug">
                  {forwardSpan + backwardSpan} total span. Press Save and continue below to store this step.
                </span>
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">{direction} round</p>
                <h3 className="mt-1 text-[21px] font-black text-[#2f2135]">Length {trial?.length ?? "-"}</h3>
              </div>
              <span className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-xs font-black text-[#6B21A8]">
                {direction === "forward" ? "Same order" : "Reverse order"}
              </span>
            </div>
            <div className="mt-4 flex min-h-[86px] items-center justify-center rounded-[20px] bg-white px-4 text-center">
              {showing && trial ? (
                <p className="text-[34px] font-black tracking-[0.3em] text-[#2f2135]">{sequenceDigits(trial.sequence).join(" ")}</p>
              ) : hasShown ? (
                <p className="text-[17px] font-black leading-relaxed text-[#2f2135]">
                  Now type {direction === "forward" ? "the same numbers" : "the numbers backward"}.
                </p>
              ) : (
                <p className="text-[15px] font-bold leading-relaxed text-[#766b63]">
                  Press Show numbers. Then type what you remember.
                </p>
              )}
            </div>
            {!hasShown && !showing ? (
              <button
                type="button"
                onClick={showNumbers}
                className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center rounded-[18px] bg-[#2f2135] px-4 text-[16px] font-black text-white"
              >
                Show numbers
              </button>
            ) : null}
            {hasShown && !showing ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <input
                  value={answer}
                  inputMode="numeric"
                  placeholder={direction === "forward" ? "Type same order" : "Type reverse order"}
                  autoFocus
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") checkAnswer();
                  }}
                  className="min-h-[56px] min-w-0 rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[20px] font-black tracking-[0.12em] text-[#2f2135] outline-none focus:border-[#A855F7]"
                />
                <button
                  type="button"
                  onClick={() => checkAnswer()}
                  disabled={!answer.trim()}
                  className="min-h-[56px] rounded-[18px] bg-[#7C3AED] px-5 text-[16px] font-black text-white disabled:opacity-50"
                >
                  Check answer
                </button>
                <button
                  type="button"
                  onClick={() => checkAnswer("")}
                  className="min-h-[56px] rounded-[18px] border border-[#E8DED4] bg-white px-5 text-[15px] font-black text-[#62564f]"
                >
                  I don't remember
                </button>
              </div>
            ) : null}
          </>
        )}
        {feedback ? <p className="mt-3 text-[13px] font-black text-[#5B21B6]">{feedback}</p> : null}
      </div>
    </div>
  );
}

function ClockPreview({
  hour,
  minute,
}: {
  hour: number | null;
  minute: number | null;
}) {
  const safeHour = hour ?? 10;
  const safeMinute = minute ?? 10;
  const hourAngle = ((safeHour % 12) + safeMinute / 60) * 30;
  const minuteAngle = safeMinute * 6;
  const numbers = Array.from({ length: 12 }, (_, index) => index + 1);

  return (
    <div className="mx-auto aspect-square w-full max-w-[230px] rounded-full border-[10px] border-[#F5F3FF] bg-white shadow-inner sm:max-w-[270px]">
      <div className="relative h-full w-full rounded-full">
        {numbers.map((number) => {
          const angle = (number * 30 - 90) * (Math.PI / 180);
          const x = 50 + 39 * Math.cos(angle);
          const y = 50 + 39 * Math.sin(angle);
          return (
            <span
              key={number}
              className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black text-[#2f2135]"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {number}
            </span>
          );
        })}
        <span
          className="absolute left-1/2 top-1/2 h-[30%] w-2 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-[#2f2135]"
          style={{ transform: `translate(-50%, -100%) rotate(${hourAngle}deg)` }}
        />
        <span
          className="absolute left-1/2 top-1/2 h-[39%] w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-[#7C3AED]"
          style={{ transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)` }}
        />
        <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7C3AED]" />
      </div>
    </div>
  );
}

function ClockDrawingFields({
  content,
  formState,
  setFormState,
}: {
  content: Record<string, unknown>;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
}) {
  const targetTime = text(content.target_time, "10:11");
  const hour = text(formState.clockHour) ? numberValue(formState.clockHour, 0) : null;
  const minute = text(formState.clockMinute) ? numberValue(formState.clockMinute, 0) : null;
  const hourOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  const minuteOptions = Array.from({ length: 60 }, (_, index) => index);

  return (
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Clock placement</p>
        <h3 className="mt-1 text-[21px] font-black leading-tight text-[#2f2135]">
          Set the clock to {targetTime}
        </h3>
        <p className="mt-2 text-[14px] font-bold leading-relaxed text-[#62564f]">
          Choose the hour and minute. The preview updates as you go.
        </p>
      </div>
      <div className="rounded-[22px] border border-[#EFE7DE] bg-[#FFFCF8] p-4">
        <ClockPreview hour={hour} minute={minute} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-black text-[#2f2135]">Hour hand</span>
            <select
              value={text(formState.clockHour)}
              onChange={(event) => setFormState((current) => ({ ...current, clockHour: event.target.value }))}
              className="mt-2 min-h-[52px] w-full rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-black text-[#2f2135]"
            >
              <option value="">Hour</option>
              {hourOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-black text-[#2f2135]">Minute hand</span>
            <select
              value={text(formState.clockMinute)}
              onChange={(event) => setFormState((current) => ({ ...current, clockMinute: event.target.value }))}
              className="mt-2 min-h-[52px] w-full rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-black text-[#2f2135]"
            >
              <option value="">Minute</option>
              {minuteOptions.map((option) => <option key={option} value={option}>{String(option).padStart(2, "0")}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4">
          <TextArea
            label="Optional note"
            placeholder="Add anything you want to note about the drawing."
            rows={3}
            value={text(formState.text)}
            onChange={(value) => setFormState((current) => ({ ...current, text: value }))}
          />
        </div>
      </div>
    </div>
  );
}

function TaskFields({
  task,
  formState,
  setFormState,
}: {
  task: CognitiveAssessmentRunnerTask;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
}) {
  const content = asRecord(task.content);

  if (task.id === "orientation") {
    return (
      <OrientationFields content={content} formState={formState} setFormState={setFormState} />
    );
  }

  if (task.id === "story_recall_immediate") {
    return (
      <StoryRecallImmediateFields content={content} formState={formState} setFormState={setFormState} />
    );
  }

  if (task.id === "story_recall_delayed") {
    return (
      <StoryRecallDelayedFields content={content} formState={formState} setFormState={setFormState} />
    );
  }

  if (task.id.includes("fluency")) {
    return (
      <FluencyFields content={content} formState={formState} setFormState={setFormState} />
    );
  }

  if (task.id === "digit_span") {
    return (
      <DigitSpanFields content={content} formState={formState} setFormState={setFormState} />
    );
  }

  if (task.id === "similarities") {
    const answers = asRecord(formState.answers);
    const items = asArray(content.items).map((item) => asRecord(item));
    const answeredCount = answeredCountForItems(items, answers);
    return (
      <div className="grid gap-4">
        <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-[15px] font-black leading-relaxed text-[#5B21B6]">
              Think of the shared idea. A short phrase is enough.
            </p>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#6B21A8]">
              {answeredCount}/{items.length} answered
            </span>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="rounded-[20px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[15px] font-black text-[#92400E]">
            Similarities content is not loaded for this language yet.
          </p>
        ) : items.map((item, index) => {
          const itemId = text(item.id, `item-${index}`);
          const pair = asArray(asRecord(item.content).pair).map(String);
          return (
            <label key={itemId} className="block rounded-[22px] border border-[#EFE7DE] bg-[#FFFCF8] p-4">
              <span className="flex items-start gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F5F3FF] text-sm font-black text-[#6B21A8]">
                  {index + 1}
                </span>
                <span className="pt-1 text-[16px] font-black leading-snug text-[#2f2135]">
                  How are {pair[0] ?? "these"} and {pair[1] ?? "these"} alike?
                </span>
              </span>
              <input
                value={text(answers[itemId])}
                placeholder="Type the shared idea"
                onChange={(event) => setFormState((current) => ({
                  ...current,
                  answers: { ...asRecord(current.answers), [itemId]: event.target.value },
                }))}
                className="mt-3 min-h-[52px] w-full rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-bold text-[#2f2135] outline-none focus:border-[#A855F7]"
              />
            </label>
          );
        })}
      </div>
    );
  }

  if (task.id === "clock_drawing") {
    return (
      <ClockDrawingFields content={content} formState={formState} setFormState={setFormState} />
    );
  }

  if (["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"].includes(task.id)) {
    return (
      <QuestionnaireFields content={content} formState={formState} setFormState={setFormState} />
    );
  }

  return (
    <TextArea
      label="Response"
      placeholder="Type the response here."
      value={text(formState.text)}
      onChange={(value) => setFormState((current) => ({ ...current, text: value }))}
    />
  );
}

function QuestionnaireFields({
  content,
  formState,
  setFormState,
}: {
  content: Record<string, unknown>;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
}) {
  const answers = asRecord(formState.answers);
  const items = asArray(content.items).map((item) => asRecord(item));
  const scale = asArray(content.scale).map((item) => asRecord(item));
  const answeredCount = items.filter((item) => {
    const itemId = text(item.id);
    return itemId && answers[itemId] !== undefined && answers[itemId] !== null && String(answers[itemId]).trim() !== "";
  }).length;

  return (
    <div className="grid gap-4">
      {text(content.intro) ? (
        <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Quick check</p>
              <p className="mt-1 text-[16px] font-black leading-snug text-[#4C1D95]">{text(content.intro)}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#6B21A8]">
              {answeredCount}/{items.length || 0} answered
            </span>
          </div>
        </div>
      ) : null}

      {items.map((item, index) => {
        const itemId = text(item.id, `item-${index}`);
        const selectedValue = String(answers[itemId] ?? "");
        return (
          <fieldset key={itemId} className="rounded-[24px] border border-[#E8DED4] bg-[#FFFCF8] p-4 shadow-[0_8px_20px_rgba(63,45,35,0.04)]">
            <legend className="sr-only">{text(item.text)}</legend>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#6B21A8] shadow-sm">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[18px] font-black leading-snug text-[#2f2135]">{text(item.text)}</h3>
                {selectedValue ? (
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.08em] text-[#059669]">Answered</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {scale.map((option) => {
                const value = String(numberValue(option.value));
                const checked = selectedValue === value;
                return (
                  <label
                    key={`${itemId}-${value}`}
                    className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-[18px] border px-3 py-3 text-[14px] font-black leading-snug shadow-sm transition ${
                      checked
                        ? "border-[#7C3AED] bg-[#F5F3FF] text-[#4C1D95] shadow-[0_8px_18px_rgba(124,58,237,0.13)]"
                        : "border-[#EFE7DE] bg-white text-[#2f2135] hover:border-[#D8B4FE] hover:bg-[#FAF5FF]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={itemId}
                      value={value}
                      checked={checked}
                      onChange={(event) => setFormState((current) => ({
                        ...current,
                        answers: { ...asRecord(current.answers), [itemId]: event.target.value },
                      }))}
                      className="sr-only"
                    />
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                      checked ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-[#9C918A] bg-white text-transparent"
                    }`}>
                      <CheckCircle2 size={16} />
                    </span>
                    <span>{text(option.label)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function taskBlocker(task: CognitiveAssessmentRunnerTask, formState: FormState) {
  const content = asRecord(task.content);
  const answers = asRecord(formState.answers);
  if (task.id === "story_recall_immediate" && !formState.storyReadComplete) return "Read story first";
  if (task.id.includes("story_recall") && !text(formState.text) && !formState.storyNoRecall) return "Add recall or mark none";
  if (task.id === "orientation") {
    const items = asArray(content.items).map((item) => asRecord(item));
    if (items.length > 0 && answeredCountForItems(items, answers) < items.length) return "Answer each question";
  }
  if (task.id === "similarities") {
    const items = asArray(content.items).map((item) => asRecord(item));
    if (items.length > 0 && answeredCountForItems(items, answers) < items.length) return "Answer each pair";
  }
  if (["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"].includes(task.id)) {
    const items = asArray(content.items).map((item) => asRecord(item));
    if (items.length > 0 && answeredCountForItems(items, answers) < items.length) return "Answer every item";
  }
  if (task.id.includes("fluency") && !formState.fluencyComplete) return "Finish this round";
  if (task.id === "digit_span" && !formState.digitComplete) return "Complete digit span";
  if (task.id === "clock_drawing" && (!text(formState.clockHour) || !text(formState.clockMinute))) return "Set clock hands";
  return null;
}

function StepTransitionScreen({
  transition,
  onContinue,
}: {
  transition: StepTransition;
  onContinue: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-32">
      <RunnerHeader
        currentStep={transition.nextIndex + 1}
        totalSteps={transition.totalSteps}
        detail={`${transition.completedCount}/${transition.totalSteps} saved, about ${transition.remainingMinutes} min left`}
      />
      <section className="px-5 pt-5">
        <div className="rounded-[28px] border border-[#DDD6FE] bg-white p-5 text-center shadow-[0_18px_40px_rgba(63,45,35,0.08)]">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669]">
            <CheckCircle2 size={34} />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Step saved</p>
          <h1 className="mt-1 text-[30px] font-black leading-tight text-[#2f2135]">{transition.savedLabel}</h1>
          <div className="mx-auto mt-5 max-w-[420px] rounded-[22px] border border-[#E8DED4] bg-[#FFFCF8] px-4 py-4 text-left">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8A7C73]">
              {transition.savedDomain === transition.nextDomain ? "Next step" : "New section"}
            </p>
            <p className="mt-1 text-[20px] font-black leading-tight text-[#2f2135]">{transition.nextLabel}</p>
            <p className="mt-1 text-[13px] font-bold text-[#766b63]">
              {transition.savedDomain === transition.nextDomain
                ? transition.nextDomain
                : `${transition.savedDomain} complete. Next: ${transition.nextDomain}.`}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-[12px] font-black">
            <span className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-[#6B21A8]">
              {transition.completedCount}/{transition.totalSteps} saved
            </span>
            <span className="rounded-full bg-[#FFF7ED] px-3 py-1.5 text-[#9A3412]">
              Take a breath
            </span>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="mt-6 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[16px] font-black text-white"
          >
            Continue now
            <ChevronRight size={20} />
          </button>
        </div>
      </section>
    </main>
  );
}

function RunnerTaskScreen({
  session,
  task,
  currentIndex,
  formState,
  setFormState,
  onBack,
  onSubmit,
  isSaving,
  error,
}: {
  session: CognitiveAssessmentRunnerSession;
  task: CognitiveAssessmentRunnerTask;
  currentIndex: number;
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
  onBack: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  const isLast = currentIndex >= session.tasks.length - 1;
  const completedCount = session.completedTaskIds.length;
  const remainingMinutes = estimatedRemainingMinutes(session.tasks, currentIndex);
  const blocker = taskBlocker(task, formState);
  const usesInlineGuidedControls = task.id === "digit_span" || task.id.includes("fluency");
  const showPrimarySubmit = !blocker || !usesInlineGuidedControls;
  const submitDisabled = isSaving || Boolean(blocker);
  const guidedBlockerCopy = task.id === "digit_span"
    ? "Use Show numbers, then Check answer. Save unlocks after forward and backward rounds."
    : "Finish the round above";
  const isFluencyTask = task.id.includes("fluency");
  const durationLabel = `${Math.round(task.expectedDurationSec / 60) || 1} min`;
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-32">
      <RunnerHeader
        currentStep={currentIndex + 1}
        totalSteps={session.tasks.length}
        detail={`${completedCount}/${session.tasks.length} saved, about ${remainingMinutes} min left`}
      />
      <section className="grid gap-4 px-5 pt-4">
        <div className="rounded-[26px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          {isFluencyTask ? (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Word round</p>
                <h2 className="mt-1 text-[25px] font-black leading-tight text-[#2f2135]">{task.label}</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-[13px] font-black sm:justify-end">
                <span className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-[#6B21A8]">
                  {completedCount}/{session.tasks.length} saved
                </span>
                <span className="rounded-full bg-[#FFF7ED] px-3 py-1.5 text-[#9A3412]">
                  {durationLabel}
                </span>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">{task.domain}</p>
              <h2 className="mt-1 text-[26px] font-black leading-tight text-[#2f2135]">{task.label}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-[13px] font-black">
                <span className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-[#6B21A8]">
                  {completedCount}/{session.tasks.length} saved
                </span>
                <span className="rounded-full bg-[#FFF7ED] px-3 py-1.5 text-[#9A3412]">
                  {durationLabel}
                </span>
              </div>
            </>
          )}
          <div className="mt-4 rounded-[18px] border border-[#EFE7DE] bg-[#FFFCF8] px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[#8A7C73]">What to do now</p>
            <p className="mt-1 text-[14px] font-black leading-relaxed text-[#2f2135]">{taskInstruction(task, formState)}</p>
            <p className="mt-1 text-[12px] font-bold leading-relaxed text-[#766b63]">
              You can pause and come back; VYVA will continue from the next unfinished step.
            </p>
          </div>
          <div className="mt-5">
            <TaskFields task={task} formState={formState} setFormState={setFormState} />
          </div>
        </div>

        {error ? (
          <div className="rounded-[20px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-black text-[#991B1B]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving || currentIndex === 0}
            className="min-h-[56px] flex-1 rounded-[20px] border border-[#E8DED4] bg-white px-5 text-[16px] font-black text-[#2f2135] disabled:opacity-50"
          >
            Back
          </button>
          {showPrimarySubmit ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitDisabled}
              className="inline-flex min-h-[56px] flex-[1.4] items-center justify-center gap-2 rounded-[20px] bg-[#7C3AED] px-5 text-[16px] font-black text-white disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : blocker ? <Clock3 size={20} /> : isLast ? <CheckCircle2 size={20} /> : <ChevronRight size={20} />}
              {blocker ?? (isLast ? "Finish and view report" : "Save and continue")}
            </button>
          ) : (
            <div className="inline-flex min-h-[56px] flex-[1.4] items-center justify-center rounded-[20px] border border-[#E8DED4] bg-[#FFFCF8] px-5 text-center text-[15px] font-black text-[#766b63]">
              {guidedBlockerCopy}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F2EB] p-6">
      <div className="flex items-center gap-3 rounded-[22px] border border-[#E8DED4] bg-white px-5 py-4 text-sm font-black text-[#2f2135] shadow-[0_12px_28px_rgba(63,45,35,0.07)]">
        <Loader2 className="animate-spin" size={20} />
        Loading assessment
      </div>
    </main>
  );
}

function NoTasksScreen() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-32">
      <RunnerHeader currentStep={0} totalSteps={12} />
      <section className="px-5 pt-5">
        <div className="rounded-[26px] border border-[#FECACA] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <h2 className="text-[24px] font-black leading-tight text-[#2f2135]">Assessment unavailable</h2>
          <p className="mt-2 text-[15px] font-bold leading-relaxed text-[#991B1B]">
            The Cognitive Assessment tasks are not available in this database yet.
          </p>
          <button
            type="button"
            onClick={() => navigate("/mind-memory/cognitive-assessment")}
            className="mt-5 min-h-[54px] w-full rounded-[20px] bg-[#2f2135] px-5 text-[16px] font-black text-white"
          >
            Back to report
          </button>
        </div>
      </section>
    </main>
  );
}

export default function CognitiveAssessmentRunnerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { language: appLanguage } = useLanguage();
  const assessmentLanguage = languageFromApp(appLanguage);
  const urlSessionId = searchParams.get("sessionId");
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (urlSessionId) return urlSessionId;
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formState, setFormState] = useState<FormState>({});
  const [stepTransition, setStepTransition] = useState<StepTransition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionQuery = useQuery<CognitiveAssessmentLoadSessionResponse>({
    queryKey: [`/api/cognitive-assessment/sessions/${sessionId ?? ""}`],
    enabled: Boolean(sessionId),
    refetchOnMount: "always",
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/cognitive-assessment/sessions", {
        method: "POST",
        body: JSON.stringify({ language: assessmentLanguage, inputMode: "wizard" }),
      });
      return parseJsonResponse<CognitiveAssessmentStartSessionResponse>(response);
    },
    onSuccess: (data) => {
      setError(null);
      setCurrentIndex(0);
      setSessionId(data.session.sessionId);
      if (typeof window !== "undefined") window.sessionStorage.setItem(SESSION_STORAGE_KEY, data.session.sessionId);
      queryClient.setQueryData([`/api/cognitive-assessment/sessions/${data.session.sessionId}`], { session: data.session });
      queryClient.invalidateQueries({ queryKey: ["/api/cognitive-assessment/program"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Assessment could not be started.");
    },
  });

  const session = sessionQuery.data?.session ?? startMutation.data?.session ?? null;
  const task = session?.tasks[currentIndex] ?? null;

  useEffect(() => {
    if (!urlSessionId || urlSessionId === sessionId) return;
    setSessionId(urlSessionId);
    if (typeof window !== "undefined") window.sessionStorage.setItem(SESSION_STORAGE_KEY, urlSessionId);
  }, [sessionId, urlSessionId]);

  useEffect(() => {
    if (stepTransition || !session || session.completedAt || session.tasks.length === 0) return;
    const completed = new Set(session.completedTaskIds);
    const firstOpenIndex = session.tasks.findIndex((candidate) => !completed.has(candidate.id));
    if (firstOpenIndex < 0) return;
    const currentTask = session.tasks[currentIndex];
    if (!currentTask || completed.has(currentTask.id)) {
      setCurrentIndex(firstOpenIndex);
    }
  }, [currentIndex, session, stepTransition]);

  useEffect(() => {
    if (!stepTransition) return undefined;
    const timer = window.setTimeout(() => {
      setCurrentIndex(stepTransition.nextIndex);
      setStepTransition(null);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [stepTransition]);

  useEffect(() => {
    if (!sessionQuery.data) return;
    if (!sessionQuery.data.session) {
      setSessionId(null);
      if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    if (sessionQuery.data.session.completedAt) {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      navigate(`/mind-memory/cognitive-assessment/report/${sessionQuery.data.session.sessionId}`, { replace: true });
    }
  }, [navigate, sessionQuery.data]);

  useEffect(() => {
    setFormState(buildInitialState(task));
    setError(null);
  }, [task]);

  const saveMutation = useMutation({
    mutationFn: async ({ task: taskToSave, responseData }: { task: CognitiveAssessmentRunnerTask; responseData: Record<string, unknown> }) => {
      const body: CognitiveAssessmentSaveResponseRequest = {
        taskDefinitionId: taskToSave.id,
        responseData,
        itemBankId: taskToSave.itemBankId ?? null,
        rotationFormId: taskToSave.rotationFormId ?? null,
      };
      const response = await apiFetch(`/api/cognitive-assessment/sessions/${session?.sessionId}/responses`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return parseJsonResponse(response);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(`/api/cognitive-assessment/sessions/${session?.sessionId}/complete`, {
        method: "POST",
      });
      return parseJsonResponse<CognitiveAssessmentCompleteSessionResponse>(response);
    },
    onSuccess: (data) => {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["/api/cognitive-assessment/latest-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cognitive-assessment/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cognitive-assessment/program"] });
      navigate(data.reportUrl, { replace: true });
    },
  });

  const isSaving = saveMutation.isPending || completeMutation.isPending;
  const startError = error || (sessionQuery.isError ? "Assessment session could not be loaded." : null);
  const canShowIntro = !sessionId && !session;

  const handleSubmit = async () => {
    if (!session || !task) return;
    setError(null);
    try {
      const responseData = buildResponseData(task, formState);
      await saveMutation.mutateAsync({ task, responseData });
      queryClient.invalidateQueries({ queryKey: [`/api/cognitive-assessment/sessions/${session.sessionId}`] });
      if (currentIndex >= session.tasks.length - 1) {
        await completeMutation.mutateAsync();
      } else {
        const nextIndex = Math.min(currentIndex + 1, session.tasks.length - 1);
        const nextTask = session.tasks[nextIndex];
        setStepTransition({
          savedLabel: task.label,
          savedDomain: task.domain,
          nextLabel: nextTask?.label ?? "Next step",
          nextDomain: nextTask?.domain ?? "Cognitive Assessment",
          nextIndex,
          completedCount: Math.min(session.completedTaskIds.length + 1, session.tasks.length),
          totalSteps: session.tasks.length,
          remainingMinutes: estimatedRemainingMinutes(session.tasks, nextIndex),
        });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Assessment response could not be saved.");
    }
  };

  const handleBack = () => {
    setStepTransition(null);
    setCurrentIndex((index) => Math.max(index - 1, 0));
  };

  if (canShowIntro) {
    return (
      <IntroScreen
        language={assessmentLanguage}
        onStart={() => startMutation.mutate()}
        isStarting={startMutation.isPending}
        error={startError}
      />
    );
  }

  if (sessionQuery.isLoading || !session) return <LoadingScreen />;
  if (session.tasks.length === 0) return <NoTasksScreen />;
  if (!task) return <LoadingScreen />;
  if (stepTransition) {
    return (
      <StepTransitionScreen
        transition={stepTransition}
        onContinue={() => {
          setCurrentIndex(stepTransition.nextIndex);
          setStepTransition(null);
        }}
      />
    );
  }

  return (
    <RunnerTaskScreen
      session={session}
      task={task}
      currentIndex={currentIndex}
      formState={formState}
      setFormState={setFormState}
      onBack={handleBack}
      onSubmit={handleSubmit}
      isSaving={isSaving}
      error={error}
    />
  );
}
