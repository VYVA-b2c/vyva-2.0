import { useCallback, useState } from "react";

export type ProviderWizardStep = "need" | "details" | "priorities" | "search_review" | "results" | "contact_review";

const STEP_ORDER: ProviderWizardStep[] = ["need", "details", "priorities", "search_review", "results", "contact_review"];

export function normalizeProviderWizardStep(value: unknown, hasResults = false, hasSelection = false): ProviderWizardStep {
  if (typeof value === "string" && STEP_ORDER.includes(value as ProviderWizardStep)) {
    if (value === "contact_review" && !hasSelection) return hasResults ? "results" : "search_review";
    if (value === "results" && !hasResults) return "search_review";
    return value as ProviderWizardStep;
  }
  if (hasSelection) return "contact_review";
  if (hasResults) return "results";
  return "need";
}

export function useProviderTaskWizard(initialStep: ProviderWizardStep = "need") {
  const [step, setStep] = useState<ProviderWizardStep>(initialStep);
  const goTo = useCallback((nextStep: ProviderWizardStep) => setStep(nextStep), []);
  return { step, goTo, stepIndex: STEP_ORDER.indexOf(step), steps: STEP_ORDER };
}
