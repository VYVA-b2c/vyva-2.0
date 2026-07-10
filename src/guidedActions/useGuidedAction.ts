import { useEffect, useMemo, useState } from "react";
import {
  getGuidedActionFlow,
  type GuidedActionFlow,
  type GuidedActionStep,
  type GuidedFlowRef,
} from "./flowCatalog";

export type GuidedActionAnswerValue = string | string[];
export type GuidedActionAnswers = Record<string, GuidedActionAnswerValue>;

type UseGuidedActionOptions = {
  persistKey?: string;
  active?: boolean;
  onAnswersChange?: (answers: GuidedActionAnswers) => void;
};

type StoredGuidedActionState = {
  ref: GuidedFlowRef;
  answers: GuidedActionAnswers;
};

function readStoredState(
  persistKey: string | undefined,
  ref: GuidedFlowRef,
): GuidedActionAnswers {
  if (!persistKey || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(persistKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredGuidedActionState;
    if (
      parsed.ref !== ref ||
      typeof parsed.answers !== "object" ||
      !parsed.answers
    )
      return {};
    return parsed.answers;
  } catch {
    return {};
  }
}

function writeStoredState(
  persistKey: string | undefined,
  ref: GuidedFlowRef,
  answers: GuidedActionAnswers,
) {
  if (!persistKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(persistKey, JSON.stringify({ ref, answers }));
  } catch {
    return;
  }
}

function clearStoredState(persistKey: string | undefined) {
  if (!persistKey || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(persistKey);
  } catch {
    return;
  }
}

function hasAnswer(value: GuidedActionAnswerValue | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function isStepVisible(step: GuidedActionStep, answers: GuidedActionAnswers) {
  if (!step.showWhen) return true;
  const answer = answers[step.showWhen.slot];
  const values = Array.isArray(answer)
    ? answer
    : typeof answer === "string"
      ? [answer]
      : [];
  return values.some((value) => step.showWhen?.values.includes(value));
}

export function useGuidedAction(
  ref: GuidedFlowRef,
  options: UseGuidedActionOptions = {},
) {
  const { active, onAnswersChange, persistKey } = options;
  const flow = useMemo<GuidedActionFlow>(() => getGuidedActionFlow(ref), [ref]);
  const [answers, setAnswers] = useState<GuidedActionAnswers>(() =>
    readStoredState(persistKey, ref),
  );
  const visibleSteps = useMemo(
    () => flow.steps.filter((step) => isStepVisible(step, answers)),
    [answers, flow.steps],
  );

  useEffect(() => {
    if (!active) return;
    writeStoredState(persistKey, ref, answers);
    onAnswersChange?.(answers);
  }, [active, answers, onAnswersChange, persistKey, ref]);

  const currentStepIndex = visibleSteps.findIndex(
    (step) => !hasAnswer(answers[step.slot]),
  );
  const isComplete = currentStepIndex === -1;
  const currentStep = isComplete ? null : visibleSteps[currentStepIndex];

  const answerStep = (slot: string, value: GuidedActionAnswerValue) => {
    setAnswers((current) => ({ ...current, [slot]: value }));
  };

  const toggleMultiChoice = (slot: string, value: string) => {
    setAnswers((current) => {
      const existing = current[slot];
      const values = Array.isArray(existing) ? existing : [];
      const next = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      return { ...current, [slot]: next };
    });
  };

  const reset = () => {
    clearStoredState(persistKey);
    setAnswers({});
  };

  return {
    flow,
    answers,
    currentStep,
    currentStepIndex,
    isComplete,
    totalSteps: visibleSteps.length,
    answerStep,
    toggleMultiChoice,
    reset,
  };
}
