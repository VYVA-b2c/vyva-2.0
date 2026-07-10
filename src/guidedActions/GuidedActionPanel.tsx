import { useState } from "react";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import type { TFunction } from "i18next";
import type {
  GuidedActionAnswerValue,
  GuidedActionAnswers,
} from "./useGuidedAction";
import type { GuidedActionFlow, GuidedActionStep } from "./flowCatalog";

type GuidedActionPanelProps = {
  flow: GuidedActionFlow;
  answers: GuidedActionAnswers;
  currentStep: GuidedActionStep | null;
  currentStepIndex: number;
  totalSteps: number;
  isComplete: boolean;
  t: TFunction;
  onAnswer: (slot: string, value: GuidedActionAnswerValue) => void;
  onReset: () => void;
  className?: string;
};

function selectedValues(value: GuidedActionAnswerValue | undefined) {
  if (Array.isArray(value)) return value;
  return typeof value === "string" && value ? [value] : [];
}

export default function GuidedActionPanel({
  flow,
  answers,
  currentStep,
  currentStepIndex,
  totalSteps,
  isComplete,
  t,
  onAnswer,
  onReset,
  className = "",
}: GuidedActionPanelProps) {
  const [draft, setDraft] = useState("");
  const [multiDrafts, setMultiDrafts] = useState<Record<string, string[]>>({});
  const visibleStepNumber = isComplete ? totalSteps : currentStepIndex + 1;
  const progress = Math.max(1, Math.min(totalSteps, visibleStepNumber));
  const activeValues = currentStep
    ? currentStep.input === "multi_choice"
      ? (multiDrafts[currentStep.slot] ??
        selectedValues(answers[currentStep.slot]))
      : selectedValues(answers[currentStep.slot])
    : [];

  const commitDraft = () => {
    if (!currentStep) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAnswer(currentStep.slot, trimmed);
    setDraft("");
  };
  const placeholder = currentStep?.textPlaceholderKey
    ? t(
        currentStep.textPlaceholderKey,
        currentStep.textPlaceholderFallback ?? "",
      )
    : (currentStep?.textPlaceholderFallback ?? "");

  return (
    <section
      className={`rounded-[24px] border border-[#BBF7D0] bg-white p-4 shadow-[0_14px_28px_rgba(4,120,87,0.10)] ${className}`}
      data-testid={`guided-action-${flow.ref}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
          {isComplete ? (
            <Check size={22} strokeWidth={2.6} />
          ) : (
            <MessageCircle size={22} strokeWidth={2.4} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.11em] text-[#047857]">
            {t(flow.titleKey, flow.titleFallback)}
          </p>
          <h3 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
            {isComplete
              ? t(flow.completionKey, flow.completionFallback)
              : currentStep
                ? t(currentStep.titleKey, currentStep.titleFallback)
                : t(flow.titleKey, flow.titleFallback)}
          </h3>
          <p className="mt-2 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
            {isComplete
              ? t(flow.confirmationKey, flow.confirmationFallback)
              : currentStep
                ? t(currentStep.helperKey, currentStep.helperFallback)
                : t(flow.introKey, flow.introFallback)}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="vyva-tap inline-flex min-h-[38px] flex-shrink-0 items-center justify-center gap-1 rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 font-body text-[12px] font-black text-[#047857]"
          data-testid="guided-action-reset"
        >
          <RotateCcw size={14} />
          {t("guidedActions.common.reset", "Reset")}
        </button>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5F7EC]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[#047857] transition-[width]"
          style={{ width: `${(progress / totalSteps) * 100}%` }}
        />
      </div>
      <p className="mt-2 font-body text-[12px] font-black text-[#047857]">
        {t("guidedActions.common.stepCount", "Step {{current}} of {{total}}", {
          current: progress,
          total: totalSteps,
        })}
      </p>

      {!isComplete && currentStep ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {currentStep.choices.map((choice) => {
              const selected = activeValues.includes(choice.value);
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => {
                    if (currentStep.input === "multi_choice") {
                      if (
                        currentStep.skipValue &&
                        choice.value === currentStep.skipValue
                      ) {
                        setMultiDrafts((current) => ({
                          ...current,
                          [currentStep.slot]: [choice.value],
                        }));
                        return;
                      }
                      setMultiDrafts((current) => {
                        const existing = current[currentStep.slot] ?? [];
                        const withoutSkip = currentStep.skipValue
                          ? existing.filter(
                              (item) => item !== currentStep.skipValue,
                            )
                          : existing;
                        const next = withoutSkip.includes(choice.value)
                          ? withoutSkip.filter((item) => item !== choice.value)
                          : [...withoutSkip, choice.value];
                        return { ...current, [currentStep.slot]: next };
                      });
                      return;
                    }
                    if (choice.requiresCustomAnswer) {
                      setDraft("");
                      return;
                    }
                    onAnswer(currentStep.slot, choice.value);
                  }}
                  className={`vyva-tap min-h-[52px] rounded-[18px] border px-4 text-left font-body text-[15px] font-black transition-colors ${
                    selected
                      ? "border-[#047857] bg-[#ECFDF5] text-[#047857]"
                      : "border-[#D6F5DF] bg-[#FFFCF8] text-vyva-text-1"
                  }`}
                  aria-pressed={selected}
                  data-testid={`guided-action-choice-${currentStep.id}-${choice.id}`}
                >
                  {t(choice.labelKey, choice.labelFallback)}
                </button>
              );
            })}
          </div>

          {currentStep.input === "multi_choice" && activeValues.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onAnswer(currentStep.slot, activeValues);
                setMultiDrafts((current) => ({
                  ...current,
                  [currentStep.slot]: [],
                }));
              }}
              className="vyva-tap inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-[#047857] px-5 font-body text-[15px] font-black text-white"
              data-testid={`guided-action-next-${currentStep.id}`}
            >
              {t("guidedActions.common.continue", "Continue")}
            </button>
          ) : null}

          {currentStep.allowCustomAnswer ? (
            <div className="rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] p-3">
              <label className="block">
                <span className="mb-1 block font-body text-[12px] font-black text-vyva-text-2">
                  {t("guidedActions.common.sayOrType", "Say it or type it")}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitDraft();
                      }
                    }}
                    placeholder={placeholder}
                    className="min-h-[50px] flex-1 rounded-[16px] border border-[#E8DED4] bg-white px-4 font-body text-[16px] font-semibold text-vyva-text-1 outline-none focus:border-[#047857]"
                    data-testid={`guided-action-text-${currentStep.id}`}
                  />
                  <button
                    type="button"
                    onClick={commitDraft}
                    disabled={!draft.trim()}
                    className="vyva-tap min-h-[50px] rounded-full bg-[#047857] px-5 font-body text-[15px] font-black text-white disabled:opacity-50"
                    data-testid={`guided-action-use-text-${currentStep.id}`}
                  >
                    {t(
                      currentStep.customAnswerLabelKey ??
                        "guidedActions.common.useAnswer",
                      currentStep.customAnswerLabelFallback ?? "Use answer",
                    )}
                  </button>
                </div>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
