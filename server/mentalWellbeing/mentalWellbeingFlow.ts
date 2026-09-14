import {
  type FlowCatalogue,
  type FlowDefinition,
  parseFlowCatalogue,
  VYVA_FLOW_CATALOGUE,
} from "../../shared/orchestration/flowCatalogue.js";
import {
  type PresentationDefinition,
  parsePresentationRegistry,
  VYVA_PRESENTATION_REGISTRY,
} from "../../shared/orchestration/presentationRegistry.js";

export const MENTAL_WELLBEING_SPECIALIST_ID = "mental_wellbeing" as const;
export const MENTAL_WELLBEING_SPECIALIST_VERSION = "1.0.0" as const;
export const MENTAL_WELLBEING_FLOW_ID = "wellbeing.support" as const;
export const MENTAL_WELLBEING_FLOW_VERSION = "1.0.0" as const;
export const MENTAL_WELLBEING_SCENE_ID = "wellbeing.support.main" as const;
export const MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID = "presentation.wellbeing.support.summary" as const;
export const MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID = "presentation.wellbeing.support.checkin" as const;
export const MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID =
  "presentation.wellbeing.support.safe_fallback" as const;

export type MentalWellbeingSpecialistRegistration = {
  specialistId: typeof MENTAL_WELLBEING_SPECIALIST_ID;
  specialistVersion: typeof MENTAL_WELLBEING_SPECIALIST_VERSION;
  legacyDomain: "companion";
  supportedFlowIds: readonly [typeof MENTAL_WELLBEING_FLOW_ID];
  canExecuteToolsDirectly: false;
  canDiagnose: false;
  canMutateCaregiverPermissions: false;
  canWriteMemory: false;
  canStartProactiveEngagement: false;
  legacyFallbackAvailable: true;
};

export const MENTAL_WELLBEING_SPECIALIST_REGISTRATION: MentalWellbeingSpecialistRegistration = {
  specialistId: MENTAL_WELLBEING_SPECIALIST_ID,
  specialistVersion: MENTAL_WELLBEING_SPECIALIST_VERSION,
  legacyDomain: "companion",
  supportedFlowIds: [MENTAL_WELLBEING_FLOW_ID],
  canExecuteToolsDirectly: false,
  canDiagnose: false,
  canMutateCaregiverPermissions: false,
  canWriteMemory: false,
  canStartProactiveEngagement: false,
  legacyFallbackAvailable: true,
};

export type MentalWellbeingRuntimeContract = {
  flowId: typeof MENTAL_WELLBEING_FLOW_ID;
  flowVersion: typeof MENTAL_WELLBEING_FLOW_VERSION;
  sceneId: typeof MENTAL_WELLBEING_SCENE_ID;
  ownerSpecialistId: typeof MENTAL_WELLBEING_SPECIALIST_ID;
  catalogueVersion: string;
  canonicalFlow: FlowDefinition;
  registration: MentalWellbeingSpecialistRegistration;
  presentations: {
    summary: PresentationDefinition;
    checkin: PresentationDefinition;
    safeFallback: PresentationDefinition;
  };
};

export function resolveMentalWellbeingRuntimeContract(input: {
  catalogue?: FlowCatalogue;
  presentationRegistry?: typeof VYVA_PRESENTATION_REGISTRY;
} = {}): MentalWellbeingRuntimeContract | null {
  const catalogue = parseFlowCatalogue(input.catalogue ?? VYVA_FLOW_CATALOGUE);
  const registry = parsePresentationRegistry(input.presentationRegistry ?? VYVA_PRESENTATION_REGISTRY);
  const canonicalFlow = catalogue.flows.find((flow) =>
    flow.flowId === MENTAL_WELLBEING_FLOW_ID &&
    flow.version === MENTAL_WELLBEING_FLOW_VERSION);
  if (!canonicalFlow) return null;
  if (canonicalFlow.ownerSpecialistId !== MENTAL_WELLBEING_SPECIALIST_ID) return null;
  if (!["approved", "pilot", "active"].includes(canonicalFlow.status)) return null;
  if (!canonicalFlow.supportedTriggers.includes("user")) return null;
  for (const channel of ["voice", "pwa", "touch", "text"] as const) {
    if (!canonicalFlow.supportedChannels.includes(channel)) return null;
  }
  if (!canonicalFlow.uiScenes.some((scene) => scene.sceneId === MENTAL_WELLBEING_SCENE_ID)) {
    return null;
  }
  if (canonicalFlow.requiredTools.length > 0 || canonicalFlow.optionalTools.length > 0) {
    return null;
  }

  const summary = registry.presentations.find(
    (presentation) => presentation.presentationId === MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
  );
  const checkin = registry.presentations.find(
    (presentation) => presentation.presentationId === MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID,
  );
  const safeFallback = registry.presentations.find(
    (presentation) => presentation.presentationId === MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
  );
  if (!summary || !checkin || !safeFallback) return null;
  for (const presentation of [summary, checkin, safeFallback]) {
    if (!presentation.supportedFlowIds.includes(MENTAL_WELLBEING_FLOW_ID)) return null;
    if (presentation.sceneId !== MENTAL_WELLBEING_SCENE_ID) return null;
  }

  return {
    flowId: MENTAL_WELLBEING_FLOW_ID,
    flowVersion: MENTAL_WELLBEING_FLOW_VERSION,
    sceneId: MENTAL_WELLBEING_SCENE_ID,
    ownerSpecialistId: MENTAL_WELLBEING_SPECIALIST_ID,
    catalogueVersion: catalogue.catalogueVersion,
    canonicalFlow,
    registration: MENTAL_WELLBEING_SPECIALIST_REGISTRATION,
    presentations: { summary, checkin, safeFallback },
  };
}
