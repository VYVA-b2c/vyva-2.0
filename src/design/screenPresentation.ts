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

export const PREVENTIVE_CHECK_STAGE_IDS = [
  "welcome", "energy", "mood", "body", "sleep", "symptoms", "details", "safety", "social", "analyzing", "result",
] as const;

export type PreventiveCheckStageId = (typeof PREVENTIVE_CHECK_STAGE_IDS)[number];

export type FlowPresentationScenes = {
  voiceSceneId: string;
  touchSceneId: string;
};

export const PREVENTIVE_CHECK_PRESENTATION_SCENES = Object.freeze(Object.fromEntries(
  PREVENTIVE_CHECK_STAGE_IDS.map((stageId) => [stageId, Object.freeze({
    voiceSceneId: `health.preventive_check.${stageId}`,
    touchSceneId: `check-how-i-feel.${stageId}`,
  })]),
) as Record<PreventiveCheckStageId, FlowPresentationScenes>);

export function resolvePreventiveCheckPresentation(stageId: PreventiveCheckStageId) {
  return PREVENTIVE_CHECK_PRESENTATION_SCENES[stageId];
}

export const SYMPTOM_ASSESSMENT_STAGE_IDS = [
  "describe",
  "safety_check",
  "urgent_escalation",
  "symptom_selection",
  "severity",
  "onset",
  "related_details",
  "review",
  "checking",
  "safest_next_step",
  "save_share_summary",
] as const;

export type SymptomAssessmentStageId = (typeof SYMPTOM_ASSESSMENT_STAGE_IDS)[number];

export const SYMPTOM_ASSESSMENT_REGISTRY_SCENE_BY_STAGE = {
  describe: "health.symptom_assessment.describe",
  safety_check: "health.symptom_assessment.safety",
  urgent_escalation: "health.symptom_assessment.safety",
  symptom_selection: "health.symptom_assessment.details",
  severity: "health.symptom_assessment.details",
  onset: "health.symptom_assessment.details",
  related_details: "health.symptom_assessment.details",
  review: "health.symptom_assessment.review",
  checking: "health.symptom_assessment.review",
  safest_next_step: "health.symptom_assessment.guidance",
  save_share_summary: "health.symptom_assessment.guidance",
} as const satisfies Record<SymptomAssessmentStageId, string>;

export type SymptomAssessmentPresentationScenes = FlowPresentationScenes & {
  registrySceneId: (typeof SYMPTOM_ASSESSMENT_REGISTRY_SCENE_BY_STAGE)[SymptomAssessmentStageId];
};

export const SYMPTOM_ASSESSMENT_PRESENTATION_SCENES = Object.freeze(Object.fromEntries(
  SYMPTOM_ASSESSMENT_STAGE_IDS.map((stageId) => [stageId, Object.freeze({
    registrySceneId: SYMPTOM_ASSESSMENT_REGISTRY_SCENE_BY_STAGE[stageId],
    voiceSceneId: `health.symptom_assessment.${stageId}.voice`,
    touchSceneId: `health.symptom_assessment.${stageId}.touch`,
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
