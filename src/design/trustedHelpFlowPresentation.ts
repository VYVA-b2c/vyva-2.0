import {
  getTrustedHelpPresentationStep,
  type TrustedHelpAllowedTemplate,
  type TrustedHelpPresentationStep,
  type TrustedHelpStepId,
} from "./conciergeTrustedHelpPresentationMap";
import {
  getScreenPresentation,
  type ScreenPresentationViewModel,
} from "./screenPresentation";

export type TrustedHelpSetupTab = Extract<
  TrustedHelpStepId,
  "dashboard" | "service" | "provider" | "controls" | "review"
>;

export const TRUSTED_HELP_SETUP_TAB_IDS = [
  "dashboard",
  "service",
  "provider",
  "controls",
  "review",
] as const satisfies readonly TrustedHelpSetupTab[];

export interface TrustedHelpStepViewModel extends ScreenPresentationViewModel {
  id: TrustedHelpSetupTab;
  stepId: TrustedHelpSetupTab;
  label: string;
  template: TrustedHelpAllowedTemplate;
  cards: TrustedHelpPresentationStep["cards"];
  chips: TrustedHelpPresentationStep["chips"];
  voicePolicy: TrustedHelpPresentationStep["voicePolicy"];
  confirmationBoundary: TrustedHelpPresentationStep["confirmationBoundary"];
}

function requireTrustedHelpStep(stepId: TrustedHelpStepId): TrustedHelpPresentationStep {
  const step = getTrustedHelpPresentationStep(stepId);

  if (!step) {
    throw new Error(`Unknown Trusted Help presentation step: ${stepId}`);
  }

  return step;
}

export function getTrustedHelpStepViewModel(stepId: TrustedHelpSetupTab): TrustedHelpStepViewModel {
  const step = requireTrustedHelpStep(stepId);
  const presentation = getScreenPresentation({
    screenId: step.screenContractId,
    mode: "default",
    stepId,
    template: step.template,
    presentationFamilyId: step.presentationFamilyId,
    uiInstruction: step.uiInstruction,
    primarySurface: step.primarySurface,
    cards: step.cards,
    chips: step.chips,
    voicePolicy: step.voicePolicy,
    confirmationBoundary: step.confirmationBoundary,
  });

  return {
    ...presentation,
    id: stepId,
    stepId,
    label: step.label,
    template: step.template,
    cards: step.cards,
    chips: step.chips,
    voicePolicy: step.voicePolicy,
    confirmationBoundary: step.confirmationBoundary,
  };
}

export function getTrustedHelpSetupTabs(): readonly TrustedHelpStepViewModel[] {
  return TRUSTED_HELP_SETUP_TAB_IDS.map((stepId) => getTrustedHelpStepViewModel(stepId));
}

export function getTrustedHelpStepDataAttributes(
  stepId: TrustedHelpSetupTab,
): Record<`data-${string}`, string> {
  return getTrustedHelpStepViewModel(stepId).dataAttributes;
}
