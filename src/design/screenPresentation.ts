import { useMemo } from "react";
import {
  getModeContract,
  getScreenContract,
  type ScreenContractId,
  type ScreenControl,
  type ScreenInteractionMode,
  type ScreenPrimarySurface,
  type ScreenTemplateKind,
  type ScreenVisibility,
} from "./screenContracts";

export const SYMPTOM_ASSESSMENT_STAGE_IDS = [
  "welcome", "energy", "mood", "body", "sleep", "symptoms", "details", "safety", "social", "analyzing", "result",
] as const;

export type SymptomAssessmentStageId = (typeof SYMPTOM_ASSESSMENT_STAGE_IDS)[number];

export type SymptomAssessmentPresentationScenes = {
  voiceSceneId: string;
  touchSceneId: string;
};

export const SYMPTOM_ASSESSMENT_PRESENTATION_SCENES = Object.freeze(Object.fromEntries(
  SYMPTOM_ASSESSMENT_STAGE_IDS.map((stageId) => [stageId, Object.freeze({
    voiceSceneId: `health.preventive_check.${stageId}`,
    touchSceneId: `check-how-i-feel.${stageId}`,
  })]),
) as Record<SymptomAssessmentStageId, SymptomAssessmentPresentationScenes>);

export function resolveSymptomAssessmentPresentation(stageId: SymptomAssessmentStageId) {
  return SYMPTOM_ASSESSMENT_PRESENTATION_SCENES[stageId];
}

export type ScreenPresentationVisibility = ScreenVisibility | "contextual";

export interface ScreenPresentationInput {
  screenId: ScreenContractId;
  mode?: ScreenInteractionMode;
  stepId?: string;
  template?: ScreenTemplateKind;
  presentationFamilyId?: string;
  uiInstruction?: string;
  primarySurface?: ScreenPrimarySurface;
  cards?: ScreenPresentationVisibility;
  chips?: ScreenVisibility;
  voicePolicy?: string;
  confirmationBoundary?: string;
}

export interface ScreenPresentationViewModel {
  screenId: ScreenContractId;
  mode: ScreenInteractionMode;
  stepId?: string;
  title: string;
  template: ScreenTemplateKind;
  presentationFamilyId?: string;
  uiInstruction?: string;
  primarySurface: ScreenPrimarySurface;
  cards: ScreenPresentationVisibility;
  chips: ScreenVisibility;
  voicePolicy?: string;
  confirmationBoundary?: string;
  controls: {
    alwaysVisible: readonly ScreenControl[];
    settingsOnly?: readonly ScreenControl[];
    autoCollapseMs?: number;
  };
  rules: readonly string[];
  minTapTargetPx: number;
  bottomNavClearancePx: number;
  bottomNavClearanceClassName: string;
  showHeadingDetail: boolean;
  dataAttributes: Record<`data-${string}`, string>;
}

function hasStructuredSurface(
  primarySurface: ScreenPrimarySurface,
  cards: ScreenPresentationVisibility,
) {
  return cards !== "hidden" || primarySurface !== "orb";
}

export function shouldShowHeadingDetail(
  primarySurface: ScreenPrimarySurface,
  cards: ScreenPresentationVisibility,
) {
  return !hasStructuredSurface(primarySurface, cards);
}

export function getScreenPresentation(input: ScreenPresentationInput): ScreenPresentationViewModel {
  const contract = getScreenContract(input.screenId);
  const mode = getModeContract(contract, input.mode ?? "default");
  const primarySurface = input.primarySurface ?? mode.primarySurface;
  const cards = input.cards ?? mode.cards;
  const chips = input.chips ?? mode.chips;
  const template = input.template ?? contract.template;
  const showHeadingDetail = shouldShowHeadingDetail(primarySurface, cards);
  const bottomNavClearancePx = mode.bottomNav === "fixedClearance" ? contract.minBottomNavClearancePx : 0;
  const dataAttributes: Record<`data-${string}`, string> = {
    "data-screen-contract": contract.id,
    "data-screen-mode": mode.mode,
    "data-template": template,
    "data-primary-surface": primarySurface,
    "data-cards": cards,
    "data-chips": chips,
    "data-heading-detail": showHeadingDetail ? "visible" : "hidden",
    "data-min-tap-target": String(contract.minTapTargetPx),
    "data-bottom-nav-clearance": String(bottomNavClearancePx),
  };

  if (input.stepId) dataAttributes["data-presentation-step"] = input.stepId;
  if (input.presentationFamilyId) dataAttributes["data-presentation-family"] = input.presentationFamilyId;
  if (input.uiInstruction) dataAttributes["data-ui-instruction"] = input.uiInstruction;
  if (input.voicePolicy) dataAttributes["data-voice-policy"] = input.voicePolicy;
  if (input.confirmationBoundary) {
    dataAttributes["data-confirmation-boundary"] = input.confirmationBoundary;
  }

  return {
    screenId: contract.id,
    mode: mode.mode,
    stepId: input.stepId,
    title: contract.title,
    template,
    presentationFamilyId: input.presentationFamilyId,
    uiInstruction: input.uiInstruction,
    primarySurface,
    cards,
    chips,
    voicePolicy: input.voicePolicy,
    confirmationBoundary: input.confirmationBoundary,
    controls: mode.controls,
    rules: mode.rules,
    minTapTargetPx: contract.minTapTargetPx,
    bottomNavClearancePx,
    bottomNavClearanceClassName: bottomNavClearancePx ? "pb-[112px]" : "",
    showHeadingDetail,
    dataAttributes,
  };
}

export function useScreenPresentation(input: ScreenPresentationInput) {
  const {
    cards,
    chips,
    confirmationBoundary,
    mode,
    presentationFamilyId,
    primarySurface,
    screenId,
    stepId,
    template,
    uiInstruction,
    voicePolicy,
  } = input;

  return useMemo(
    () =>
      getScreenPresentation({
        cards,
        chips,
        confirmationBoundary,
        mode,
        presentationFamilyId,
        primarySurface,
        screenId,
        stepId,
        template,
        uiInstruction,
        voicePolicy,
      }),
    [
      cards,
      chips,
      confirmationBoundary,
      mode,
      presentationFamilyId,
      primarySurface,
      screenId,
      stepId,
      template,
      uiInstruction,
      voicePolicy,
    ],
  );
}
