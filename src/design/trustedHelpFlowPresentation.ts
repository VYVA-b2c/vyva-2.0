import {
  getTrustedHelpPresentationStep,
  type TrustedHelpAllowedTemplate,
  type TrustedHelpPresentationStep,
  type TrustedHelpStepId,
} from "./conciergeTrustedHelpPresentationMap";
import {
  getModeContract,
  getScreenContract,
  type ScreenPrimarySurface,
} from "./screenContracts";

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

export interface TrustedHelpStepViewModel {
  stepId: TrustedHelpSetupTab;
  label: string;
  template: TrustedHelpAllowedTemplate;
  presentationFamilyId: string;
  uiInstruction: string;
  primarySurface: ScreenPrimarySurface;
  cards: TrustedHelpPresentationStep["cards"];
  chips: TrustedHelpPresentationStep["chips"];
  voicePolicy: TrustedHelpPresentationStep["voicePolicy"];
  confirmationBoundary: TrustedHelpPresentationStep["confirmationBoundary"];
  minTapTargetPx: number;
  bottomNavClearancePx: number;
  showHeadingDetail: boolean;
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
  const contract = getScreenContract(step.screenContractId);
  const mode = getModeContract(contract, "default");
  const hasStructuredElements = step.cards !== "hidden" || step.primarySurface !== "orb";

  return {
    stepId,
    label: step.label,
    template: step.template,
    presentationFamilyId: step.presentationFamilyId,
    uiInstruction: step.uiInstruction,
    primarySurface: step.primarySurface ?? mode.primarySurface,
    cards: step.cards,
    chips: step.chips,
    voicePolicy: step.voicePolicy,
    confirmationBoundary: step.confirmationBoundary,
    minTapTargetPx: contract.minTapTargetPx,
    bottomNavClearancePx: contract.minBottomNavClearancePx,
    showHeadingDetail: !hasStructuredElements,
  };
}

export function getTrustedHelpSetupTabs(): readonly TrustedHelpStepViewModel[] {
  return TRUSTED_HELP_SETUP_TAB_IDS.map((stepId) => getTrustedHelpStepViewModel(stepId));
}

export function getTrustedHelpStepDataAttributes(
  stepId: TrustedHelpSetupTab,
): Record<`data-${string}`, string> {
  const view = getTrustedHelpStepViewModel(stepId);

  return {
    "data-screen-contract": "concierge",
    "data-presentation-step": view.stepId,
    "data-template": view.template,
    "data-presentation-family": view.presentationFamilyId,
    "data-ui-instruction": view.uiInstruction,
    "data-primary-surface": view.primarySurface,
    "data-cards": view.cards,
    "data-chips": view.chips,
    "data-voice-policy": view.voicePolicy,
    "data-confirmation-boundary": view.confirmationBoundary,
    "data-min-tap-target": String(view.minTapTargetPx),
    "data-bottom-nav-clearance": String(view.bottomNavClearancePx),
    "data-heading-detail": view.showHeadingDetail ? "visible" : "hidden",
  };
}
