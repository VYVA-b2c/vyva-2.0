import {
  type FlowCatalogue,
  type FlowDefinition,
  parseFlowCatalogue,
  VYVA_FLOW_CATALOGUE,
} from "../../shared/orchestration/flowCatalogue.js";
import type { SpecialistToolDescriptor } from "../../shared/orchestration/specialist.js";

export const BRAIN_COACH_SPECIALIST_ID = "brain_coach" as const;
export const BRAIN_COACH_SPECIALIST_VERSION = "1.0.0" as const;
export const BRAIN_COACH_FLOW_ID = "brain_coach.activity_session" as const;
export const BRAIN_COACH_FLOW_VERSION = "1.0.0" as const;
export const BRAIN_COACH_SCENE_ID = "brain_coach.activity_session.main" as const;
export const BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID = "tool.voice.open_app_action" as const;

export const BRAIN_COACH_OPEN_APP_ACTION_TOOL: SpecialistToolDescriptor = {
  toolId: BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID,
  description:
    "Proposes the existing client-owned open_app_action navigation tool for Brain Coach activity surfaces.",
  inputSchemaId: "schema.voice.open_app_action.v1",
  outputSchemaId: "schema.voice.open_app_action.result.v1",
  requiresConfirmation: false,
  requiresConsent: false,
  idempotencyRequired: true,
  allowedRiskLevels: ["none", "low"],
};

export type BrainCoachSpecialistRegistration = {
  specialistId: typeof BRAIN_COACH_SPECIALIST_ID;
  specialistVersion: typeof BRAIN_COACH_SPECIALIST_VERSION;
  domain: "brain_coach";
  supportedFlowIds: readonly [typeof BRAIN_COACH_FLOW_ID];
  canExecuteToolsDirectly: false;
  canMutateCaregiverPermissions: false;
  canMutateSchedules: false;
  legacyFallbackAvailable: true;
};

export const BRAIN_COACH_SPECIALIST_REGISTRATION: BrainCoachSpecialistRegistration = {
  specialistId: BRAIN_COACH_SPECIALIST_ID,
  specialistVersion: BRAIN_COACH_SPECIALIST_VERSION,
  domain: "brain_coach",
  supportedFlowIds: [BRAIN_COACH_FLOW_ID],
  canExecuteToolsDirectly: false,
  canMutateCaregiverPermissions: false,
  canMutateSchedules: false,
  legacyFallbackAvailable: true,
};

export type BrainCoachRuntimeContract = {
  flowId: typeof BRAIN_COACH_FLOW_ID;
  flowVersion: typeof BRAIN_COACH_FLOW_VERSION;
  sceneId: typeof BRAIN_COACH_SCENE_ID;
  ownerSpecialistId: typeof BRAIN_COACH_SPECIALIST_ID;
  catalogueVersion: string;
  canonicalFlow: FlowDefinition;
  allowedTools: readonly [SpecialistToolDescriptor];
  registration: BrainCoachSpecialistRegistration;
};

export function resolveBrainCoachRuntimeContract(input: {
  catalogue?: FlowCatalogue;
} = {}): BrainCoachRuntimeContract | null {
  const catalogue = parseFlowCatalogue(input.catalogue ?? VYVA_FLOW_CATALOGUE);
  const canonicalFlow = catalogue.flows.find((flow) =>
    flow.flowId === BRAIN_COACH_FLOW_ID &&
    flow.version === BRAIN_COACH_FLOW_VERSION);
  if (!canonicalFlow) return null;
  if (canonicalFlow.ownerSpecialistId !== BRAIN_COACH_SPECIALIST_ID) return null;
  if (!["approved", "pilot", "active"].includes(canonicalFlow.status)) return null;
  if (!canonicalFlow.supportedChannels.includes("voice")) return null;
  if (!canonicalFlow.supportedChannels.includes("pwa")) return null;
  if (!canonicalFlow.supportedChannels.includes("touch")) return null;
  if (!canonicalFlow.supportedTriggers.includes("user")) return null;
  if (!canonicalFlow.uiScenes.some((scene) => scene.sceneId === BRAIN_COACH_SCENE_ID)) {
    return null;
  }
  if (!canonicalFlow.optionalTools.includes(BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID)) {
    return null;
  }
  return {
    flowId: BRAIN_COACH_FLOW_ID,
    flowVersion: BRAIN_COACH_FLOW_VERSION,
    sceneId: BRAIN_COACH_SCENE_ID,
    ownerSpecialistId: BRAIN_COACH_SPECIALIST_ID,
    catalogueVersion: catalogue.catalogueVersion,
    canonicalFlow,
    allowedTools: [BRAIN_COACH_OPEN_APP_ACTION_TOOL],
    registration: BRAIN_COACH_SPECIALIST_REGISTRATION,
  };
}
