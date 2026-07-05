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
  if (task.id === "digit_span") return { forwardSpan: "", backwardSpan: "" };
  if (task.id === "orientation") return { answers: {} };
  if (["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"].includes(task.id)) return { answers: {} };
  if (task.id === "similarities") return { answers: {} };
  if (task.id === "story_recall_immediate") return { text: "", storyReadComplete: false };
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

function buildResponseData(task: CognitiveAssessmentRunnerTask, formState: FormState): Record<string, unknown> {
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
      ...scoreTextAnswer(formState.text),
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
    return {
      ...scoreTextAnswer(formState.text),
      target_time: text(content.target_time),
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
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
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
    const answers = asRecord(formState.answers);
    const items = asArray(content.items).map((item) => asRecord(item));
    return (
      <div className="grid gap-3">
        {items.length === 0 ? (
          <p className="text-[15px] font-bold text-[#766b63]">Orientation form content is not ready yet.</p>
        ) : items.map((item) => {
          const promptKey = text(item.prompt_key);
          return (
            <label key={promptKey} className="block">
              <span className="text-sm font-black text-[#2f2135]">{promptLabel(promptKey)}</span>
              <input
                value={text(answers[promptKey])}
                onChange={(event) => setFormState((current) => ({
                  ...current,
                  answers: { ...asRecord(current.answers), [promptKey]: event.target.value },
                }))}
                className="mt-2 min-h-[52px] w-full rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-bold text-[#2f2135] outline-none focus:border-[#A855F7]"
              />
            </label>
          );
        })}
      </div>
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
    const prompt = text(content.letter) ? `Words beginning with ${text(content.letter)}` : `Words in this category: ${text(content.category, "category")}`;
    return (
      <TextArea
        label={prompt}
        placeholder="Type words separated by commas or new lines."
        value={text(formState.text)}
        onChange={(value) => setFormState((current) => ({ ...current, text: value }))}
      />
    );
  }

  if (task.id === "digit_span") {
    const options = Array.from({ length: 10 }, (_, index) => index);
    return (
      <div className="grid gap-4">
        <p className="rounded-[20px] bg-[#F5F3FF] px-4 py-3 text-[15px] font-bold leading-relaxed text-[#5B21B6]">
          {text(content.practice_note, "Listen calmly. There is no need to rush.")}
        </p>
        <label className="block">
          <span className="text-sm font-black text-[#2f2135]">{text(content.forward_prompt, "Longest sequence repeated forward")}</span>
          <select
            value={text(formState.forwardSpan)}
            onChange={(event) => setFormState((current) => ({ ...current, forwardSpan: event.target.value }))}
            className="mt-2 min-h-[52px] w-full rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-black text-[#2f2135]"
          >
            <option value="">Choose longest forward span</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-black text-[#2f2135]">{text(content.backward_prompt, "Longest sequence repeated backward")}</span>
          <select
            value={text(formState.backwardSpan)}
            onChange={(event) => setFormState((current) => ({ ...current, backwardSpan: event.target.value }))}
            className="mt-2 min-h-[52px] w-full rounded-[18px] border border-[#E8DED4] bg-white px-4 text-[16px] font-black text-[#2f2135]"
          >
            <option value="">Choose longest backward span</option>
            {options.slice(0, 9).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
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
    const targetTime = text(content.target_time, "10:11");
    return (
      <TextArea
        label={text(content.wizard_prompt, "Draw a round clock and set the hands to {time}.").replace("{time}", targetTime)}
        placeholder="Describe what you drew, or note that the drawing is complete."
        value={text(formState.text)}
        onChange={(value) => setFormState((current) => ({ ...current, text: value }))}
      />
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
  const storyReadRequired = task.id === "story_recall_immediate" && !Boolean(formState.storyReadComplete);
  const submitDisabled = isSaving || storyReadRequired;
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <RunnerHeader currentStep={currentIndex + 1} totalSteps={session.tasks.length} />
      <section className="grid gap-4 px-5 pt-5">
        <div className="rounded-[26px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">{task.domain}</p>
          <h2 className="mt-1 text-[26px] font-black leading-tight text-[#2f2135]">{task.label}</h2>
          <p className="mt-2 text-[14px] font-bold text-[#766b63]">Expected time: about {Math.round(task.expectedDurationSec / 60) || 1} minute</p>
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
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : storyReadRequired ? <Clock3 size={20} /> : isLast ? <CheckCircle2 size={20} /> : <ChevronRight size={20} />}
            {storyReadRequired ? "Read story first" : isLast ? "Finish and view report" : "Save and continue"}
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
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
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
  }, [task?.id]);

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
