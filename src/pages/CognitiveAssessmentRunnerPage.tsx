import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Brain, CheckCircle2, ChevronRight, Clock3, Loader2, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  if (task.id === "story_recall_immediate") return { text: "", storyReadComplete: false };
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
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const navigate = useNavigate();
  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  return (
    <header className="px-5 pt-5">
      <button
        type="button"
        onClick={() => navigate("/mind-memory/cognitive-assessment")}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#2f2135] shadow-[0_8px_20px_rgba(63,45,35,0.07)]"
      >
        <ArrowLeft size={18} />
        Cognitive Assessment
      </button>
      <div className="mt-5 rounded-[28px] border border-[#DDD6FE] bg-white p-5 shadow-[0_14px_32px_rgba(63,45,35,0.07)]">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-[#6B21A8]">
            <Brain size={30} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Mind & Memory</p>
            <h1 className="mt-1 text-[32px] font-black leading-[1.02] text-[#2f2135]">Guided check</h1>
            <p className="mt-2 text-[16px] font-bold leading-snug text-[#766b63]">
              Step {Math.min(currentStep, totalSteps)} of {totalSteps}
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#EFE7DE]">
              <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${progress}%` }} />
            </div>
          </div>
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
      <section className="grid gap-4 px-5 pt-5">
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
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  helperText?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#2f2135]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={7}
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
          <p className="mt-4 text-[13px] font-bold leading-relaxed text-[#62564f]">
            Read calmly. When the timer ends, the story will hide and you will write what you remember.
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
              Now write the details you remember. You do not need perfect sentences.
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
        onChange={(value) => setFormState((current) => ({ ...current, text: value }))}
      />
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

  if (items.length === 0) {
    return <p className="text-[15px] font-bold text-[#766b63]">Orientation form content is not ready yet.</p>;
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
        <p className="text-[15px] font-black leading-relaxed text-[#5B21B6]">
          A few quick context questions. Short answers are fine.
        </p>
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
              placeholder="Type a short answer"
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
  const prompt = text(content.letter)
    ? `Words beginning with ${text(content.letter)}`
    : `Words in this category: ${text(content.category, "category")}`;
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
  }, [prompt]);

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
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Timed word round</p>
            <h3 className="mt-1 text-[21px] font-black leading-tight text-[#2f2135]">{prompt}</h3>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-sm font-black text-[#6B21A8]" aria-live="polite">
            {complete ? "Done" : started ? `${secondsLeft}s` : "60s"}
          </span>
        </div>
        <p className="mt-3 text-[14px] font-bold leading-relaxed text-[#62564f]">
          Add one word at a time. Repeats are saved but only unique words count in the report.
        </p>
        {!started ? (
          <button
            type="button"
            onClick={() => setFormState((current) => ({ ...current, fluencyStarted: true, fluencyComplete: false }))}
            className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-[18px] bg-[#2f2135] px-4 text-[15px] font-black text-white"
          >
            Start word round
          </button>
        ) : null}
      </div>

      <div className="rounded-[22px] border border-[#EFE7DE] bg-[#FFFCF8] p-4">
        <div className="flex gap-2">
          <input
            value={draft}
            disabled={!started || complete}
            placeholder={complete ? "Time complete" : "Type a word"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addWord();
              }
            }}
            className="min-h-[52px] min-w-0 flex-1 rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-bold text-[#2f2135] outline-none focus:border-[#A855F7] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={addWord}
            disabled={!started || complete || !draft.trim()}
            className="min-h-[52px] rounded-[18px] bg-[#7C3AED] px-4 text-[15px] font-black text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {words.length === 0 ? (
            <span className="text-[13px] font-bold text-[#766b63]">Words will appear here.</span>
          ) : words.map((word, index) => (
            <span key={`${word}-${index}`} className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#2f2135] shadow-sm">
              {word}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-black">
          <span className="rounded-full bg-[#ECFDF5] px-3 py-1.5 text-[#047857]">{uniqueWords.length} unique</span>
          <button
            type="button"
            onClick={() => setFormState((current) => ({ ...current, fluencyComplete: true }))}
            disabled={!started || complete}
            className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-[#6B21A8] disabled:opacity-50"
          >
            Finish round
          </button>
        </div>
      </div>
    </div>
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
      setFeedback("Now try the numbers backward.");
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

  const checkAnswer = () => {
    if (!trial || isComplete) return;
    const shownDigits = sequenceDigits(trial.sequence);
    const expectedDigits = direction === "forward" ? shownDigits : [...shownDigits].reverse();
    const expected = expectedDigits.join("");
    const actual = digitsOnly(answer);
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
    setFeedback(correct ? "Correct. Try the next one." : "That one was not exact. Try one more at this level.");
    setAnswer("");
    setShowing(false);
    moveAfterAnswer(correct);
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
        <p className="text-[15px] font-black leading-relaxed text-[#5B21B6]">
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
          <div className="rounded-[18px] bg-[#ECFDF5] px-4 py-3 text-[15px] font-black text-[#047857]">
            Digit span saved: {forwardSpan + backwardSpan} total span.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">{direction} round</p>
                <h3 className="mt-1 text-[21px] font-black text-[#2f2135]">Length {trial?.length ?? "-"}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowing(true);
                  setFeedback("");
                }}
                className="min-h-[44px] rounded-[16px] bg-[#2f2135] px-4 text-sm font-black text-white"
              >
                Show numbers
              </button>
            </div>
            <div className="mt-4 flex min-h-[86px] items-center justify-center rounded-[20px] bg-white px-4 text-center">
              {showing && trial ? (
                <p className="text-[34px] font-black tracking-[0.3em] text-[#2f2135]">{sequenceDigits(trial.sequence).join(" ")}</p>
              ) : (
                <p className="text-[15px] font-bold leading-relaxed text-[#766b63]">
                  Press Show numbers. They will disappear, then type what you remember.
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={answer}
                inputMode="numeric"
                placeholder={direction === "forward" ? "Type same order" : "Type reverse order"}
                onChange={(event) => setAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") checkAnswer();
                }}
                className="min-h-[52px] min-w-0 flex-1 rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[18px] font-black tracking-[0.12em] text-[#2f2135] outline-none focus:border-[#A855F7]"
              />
              <button
                type="button"
                onClick={checkAnswer}
                disabled={!answer.trim()}
                className="min-h-[52px] rounded-[18px] bg-[#7C3AED] px-4 text-[15px] font-black text-white disabled:opacity-50"
              >
                Check
              </button>
            </div>
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
          Use the controls to place the clock hands. This records a tracking signal, not a diagnosis.
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
        <TextArea
          label="Optional note"
          placeholder="Add anything you want to note about the drawing."
          value={text(formState.text)}
          onChange={(value) => setFormState((current) => ({ ...current, text: value }))}
        />
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
      <TextArea
        label={`Recall the story: ${text(content.title, "Earlier story")}`}
        placeholder="Without looking back, type anything you remember."
        value={text(formState.text)}
        onChange={(value) => setFormState((current) => ({ ...current, text: value }))}
      />
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
    return (
      <div className="grid gap-4">
        {items.length === 0 ? (
          <p className="rounded-[20px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[15px] font-black text-[#92400E]">
            Similarities content is not loaded for this language yet.
          </p>
        ) : items.map((item, index) => {
          const itemId = text(item.id, `item-${index}`);
          const pair = asArray(asRecord(item.content).pair).map(String);
          return (
            <label key={itemId} className="block">
              <span className="text-sm font-black text-[#2f2135]">
                How are {pair[0] ?? "these"} and {pair[1] ?? "these"} alike?
              </span>
              <input
                value={text(answers[itemId])}
                onChange={(event) => setFormState((current) => ({
                  ...current,
                  answers: { ...asRecord(current.answers), [itemId]: event.target.value },
                }))}
                className="mt-2 min-h-[52px] w-full rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-bold text-[#2f2135] outline-none focus:border-[#A855F7]"
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
    const answers = asRecord(formState.answers);
    const items = asArray(content.items).map((item) => asRecord(item));
    const scale = asArray(content.scale).map((item) => asRecord(item));
    return (
      <div className="grid gap-5">
        {text(content.intro) ? (
          <p className="rounded-[20px] bg-[#F5F3FF] px-4 py-3 text-[15px] font-bold leading-relaxed text-[#5B21B6]">{text(content.intro)}</p>
        ) : null}
        {items.map((item) => {
          const itemId = text(item.id);
          return (
            <fieldset key={itemId} className="rounded-[22px] border border-[#EFE7DE] bg-[#FFFCF8] p-4">
              <legend className="text-[16px] font-black leading-snug text-[#2f2135]">{text(item.text)}</legend>
              <div className="mt-3 grid gap-2">
                {scale.map((option) => {
                  const value = String(numberValue(option.value));
                  return (
                    <label key={`${itemId}-${value}`} className="flex min-h-[48px] items-center gap-3 rounded-[16px] bg-white px-3 text-[15px] font-bold text-[#2f2135] shadow-sm">
                      <input
                        type="radio"
                        name={itemId}
                        value={value}
                        checked={String(answers[itemId] ?? "") === value}
                        onChange={(event) => setFormState((current) => ({
                          ...current,
                          answers: { ...asRecord(current.answers), [itemId]: event.target.value },
                        }))}
                        className="h-5 w-5 accent-[#7C3AED]"
                      />
                      {text(option.label)}
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

  return (
    <TextArea
      label="Response"
      placeholder="Type the response here."
      value={text(formState.text)}
      onChange={(value) => setFormState((current) => ({ ...current, text: value }))}
    />
  );
}

function taskBlocker(task: CognitiveAssessmentRunnerTask, formState: FormState) {
  if (task.id === "story_recall_immediate" && !formState.storyReadComplete) return "Read story first";
  if (task.id.includes("fluency") && !formState.fluencyComplete) return "Finish word round";
  if (task.id === "digit_span" && !formState.digitComplete) return "Complete digit span";
  if (task.id === "clock_drawing" && (!text(formState.clockHour) || !text(formState.clockMinute))) return "Set clock hands";
  return null;
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
  const blocker = taskBlocker(task, formState);
  const submitDisabled = isSaving || Boolean(blocker);
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-32">
      <RunnerHeader currentStep={currentIndex + 1} totalSteps={session.tasks.length} />
      <section className="grid gap-4 px-5 pt-5">
        <div className="rounded-[26px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">{task.domain}</p>
          <h2 className="mt-1 text-[26px] font-black leading-tight text-[#2f2135]">{task.label}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-[13px] font-black">
            <span className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-[#6B21A8]">
              {completedCount}/{session.tasks.length} saved
            </span>
            <span className="rounded-full bg-[#FFF7ED] px-3 py-1.5 text-[#9A3412]">
              About {Math.round(task.expectedDurationSec / 60) || 1} minute
            </span>
          </div>
          <p className="mt-3 text-[14px] font-bold leading-relaxed text-[#766b63]">
            You can pause and come back; VYVA will continue from the next unfinished step.
          </p>
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
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="inline-flex min-h-[56px] flex-[1.4] items-center justify-center gap-2 rounded-[20px] bg-[#7C3AED] px-5 text-[16px] font-black text-white disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : blocker ? <Clock3 size={20} /> : isLast ? <CheckCircle2 size={20} /> : <ChevronRight size={20} />}
            {blocker ?? (isLast ? "Finish and view report" : "Save and continue")}
          </button>
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
  const queryClient = useQueryClient();
  const { language: appLanguage } = useLanguage();
  const assessmentLanguage = languageFromApp(appLanguage);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formState, setFormState] = useState<FormState>({});
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
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Assessment could not be started.");
    },
  });

  const session = sessionQuery.data?.session ?? startMutation.data?.session ?? null;
  const task = session?.tasks[currentIndex] ?? null;

  useEffect(() => {
    if (!session || session.completedAt || session.tasks.length === 0) return;
    const completed = new Set(session.completedTaskIds);
    const firstOpenIndex = session.tasks.findIndex((candidate) => !completed.has(candidate.id));
    if (firstOpenIndex < 0) return;
    const currentTask = session.tasks[currentIndex];
    if (!currentTask || completed.has(currentTask.id)) {
      setCurrentIndex(firstOpenIndex);
    }
  }, [currentIndex, session]);

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
        setCurrentIndex((index) => Math.min(index + 1, session.tasks.length - 1));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Assessment response could not be saved.");
    }
  };

  const handleBack = () => {
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
