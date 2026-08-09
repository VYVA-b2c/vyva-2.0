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
import type { SpecialistToolDescriptor } from "../../shared/orchestration/specialist.js";

export const MEDICATION_SPECIALIST_ID = "medication" as const;
export const MEDICATION_SPECIALIST_VERSION = "1.0.0" as const;
export const MEDICATION_FLOW_ID = "medication.reminder" as const;
export const MEDICATION_FLOW_VERSION = "1.0.0" as const;
export const MEDICATION_SCENE_ID = "medication.reminder.main" as const;
export const MEDICATION_OPEN_APP_ACTION_TOOL_ID = "tool.voice.open_app_action" as const;
export const MEDICATION_REMINDER_PRESENTATION_ID = "presentation.medication.reminder" as const;
export const MEDICATION_HUMAN_HELP_PRESENTATION_ID =
  "presentation.medication.human_help_confirmation" as const;
export const MEDICATION_FOLLOWUP_PRESENTATION_ID = "presentation.medication.followup" as const;

export const MEDICATION_OPEN_APP_ACTION_TOOL: SpecialistToolDescriptor = {
  toolId: MEDICATION_OPEN_APP_ACTION_TOOL_ID,
  description:
    "Proposes the existing client-owned open_app_action navigation bridge for medication management, adherence-report, or refill-context surfaces.",
  inputSchemaId: "schema.voice.open_app_action.v1",
  outputSchemaId: "schema.voice.open_app_action.result.v1",
  requiresConfirmation: false,
  requiresConsent: false,
  idempotencyRequired: true,
  allowedRiskLevels: ["low", "medium"],
};

export type MedicationSpecialistCapability =
  | "medication_management"
  | "medication_inventory_report"
  | "medication_refill_request";

export type MedicationSpecialistRegistration = {
  specialistId: typeof MEDICATION_SPECIALIST_ID;
  specialistVersion: typeof MEDICATION_SPECIALIST_VERSION;
  domain: "meds";
  supportedFlowIds: readonly [typeof MEDICATION_FLOW_ID];
  supportedCapabilities: readonly MedicationSpecialistCapability[];
  canExecuteToolsDirectly: false;
  canConfirmDoses: false;
  canChangeMedicationRecords: false;
  canContactPharmacy: false;
  canMutateCaregiverPermissions: false;
  canMutateSchedules: false;
  canWriteMemory: false;
  legacyFallbackAvailable: true;
};

export const MEDICATION_SPECIALIST_REGISTRATION: MedicationSpecialistRegistration = {
  specialistId: MEDICATION_SPECIALIST_ID,
  specialistVersion: MEDICATION_SPECIALIST_VERSION,
  domain: "meds",
  supportedFlowIds: [MEDICATION_FLOW_ID],
  supportedCapabilities: [
    "medication_management",
    "medication_inventory_report",
    "medication_refill_request",
  ],
  canExecuteToolsDirectly: false,
  canConfirmDoses: false,
  canChangeMedicationRecords: false,
  canContactPharmacy: false,
  canMutateCaregiverPermissions: false,
  canMutateSchedules: false,
  canWriteMemory: false,
  legacyFallbackAvailable: true,
};

export type MedicationRuntimeContract = {
  flowId: typeof MEDICATION_FLOW_ID;
  flowVersion: typeof MEDICATION_FLOW_VERSION;
  sceneId: typeof MEDICATION_SCENE_ID;
  ownerSpecialistId: typeof MEDICATION_SPECIALIST_ID;
  catalogueVersion: string;
  canonicalFlow: FlowDefinition;
  allowedTools: readonly [SpecialistToolDescriptor];
  registration: MedicationSpecialistRegistration;
  presentations: {
    reminder: PresentationDefinition;
    humanHelpConfirmation: PresentationDefinition;
    followup: PresentationDefinition;
  };
};

export function resolveMedicationRuntimeContract(input: {
  catalogue?: FlowCatalogue;
  presentationRegistry?: typeof VYVA_PRESENTATION_REGISTRY;
} = {}): MedicationRuntimeContract | null {
  const catalogue = parseFlowCatalogue(input.catalogue ?? VYVA_FLOW_CATALOGUE);
  const registry = parsePresentationRegistry(input.presentationRegistry ?? VYVA_PRESENTATION_REGISTRY);
  const canonicalFlow = catalogue.flows.find((flow) =>
    flow.flowId === MEDICATION_FLOW_ID &&
    flow.version === MEDICATION_FLOW_VERSION);
  if (!canonicalFlow) return null;
  if (canonicalFlow.ownerSpecialistId !== MEDICATION_SPECIALIST_ID) return null;
  if (!["approved", "pilot", "active"].includes(canonicalFlow.status)) return null;
  if (!canonicalFlow.supportedTriggers.includes("user")) return null;
  for (const channel of ["voice", "pwa", "touch", "text"] as const) {
    if (!canonicalFlow.supportedChannels.includes(channel)) return null;
  }
  if (!canonicalFlow.uiScenes.some((scene) => scene.sceneId === MEDICATION_SCENE_ID)) {
    return null;
  }
  if (canonicalFlow.requiredTools.length > 0) return null;
  if (!canonicalFlow.optionalTools.includes(MEDICATION_OPEN_APP_ACTION_TOOL_ID)) return null;

  const reminder = registry.presentations.find(
    (presentation) => presentation.presentationId === MEDICATION_REMINDER_PRESENTATION_ID,
  );
  const humanHelpConfirmation = registry.presentations.find(
    (presentation) => presentation.presentationId === MEDICATION_HUMAN_HELP_PRESENTATION_ID,
  );
  const followup = registry.presentations.find(
    (presentation) => presentation.presentationId === MEDICATION_FOLLOWUP_PRESENTATION_ID,
  );
  if (!reminder || !humanHelpConfirmation || !followup) return null;
  for (const presentation of [reminder, humanHelpConfirmation, followup]) {
    if (!presentation.supportedFlowIds.includes(MEDICATION_FLOW_ID)) return null;
    if (presentation.sceneId !== MEDICATION_SCENE_ID) return null;
  }

  return {
    flowId: MEDICATION_FLOW_ID,
    flowVersion: MEDICATION_FLOW_VERSION,
    sceneId: MEDICATION_SCENE_ID,
    ownerSpecialistId: MEDICATION_SPECIALIST_ID,
    catalogueVersion: catalogue.catalogueVersion,
    canonicalFlow,
    allowedTools: [MEDICATION_OPEN_APP_ACTION_TOOL],
    registration: MEDICATION_SPECIALIST_REGISTRATION,
    presentations: { reminder, humanHelpConfirmation, followup },
  };
}
