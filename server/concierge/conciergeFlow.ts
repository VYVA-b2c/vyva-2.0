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

export const CONCIERGE_SPECIALIST_ID = "concierge" as const;
export const CONCIERGE_SPECIALIST_VERSION = "1.0.0" as const;
export const CONCIERGE_FLOW_ID = "concierge.administrative_support" as const;
export const CONCIERGE_FLOW_VERSION = "1.0.0" as const;
export const CONCIERGE_SCENE_ID = "concierge.administrative_support.main" as const;
export const CONCIERGE_OPEN_APP_ACTION_TOOL_ID = "tool.voice.open_app_action" as const;
export const CONCIERGE_REQUEST_INTAKE_PRESENTATION_ID =
  "presentation.concierge.request_intake" as const;
export const CONCIERGE_TRUSTED_HELP_PRESENTATION_ID =
  "presentation.concierge.trusted_help_setup" as const;
export const CONCIERGE_SHOPPING_CONTEXT_PRESENTATION_ID =
  "presentation.concierge.shopping_context" as const;
export const CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID =
  "presentation.concierge.safe_fallback" as const;

export const CONCIERGE_OPEN_APP_ACTION_TOOL: SpecialistToolDescriptor = {
  toolId: CONCIERGE_OPEN_APP_ACTION_TOOL_ID,
  description:
    "Proposes the existing client-owned open_app_action navigation bridge for Concierge request-intake, Trusted Help setup context, or shopping-context surfaces. It does not execute bookings, provider contact, payments, messages, task creation, caregiver escalation, or scheduling.",
  inputSchemaId: "schema.voice.open_app_action.v1",
  outputSchemaId: "schema.voice.open_app_action.result.v1",
  requiresConfirmation: false,
  requiresConsent: false,
  idempotencyRequired: true,
  allowedRiskLevels: ["low"],
};

export type ConciergeSpecialistCapability =
  | "concierge_request_intake"
  | "concierge_trusted_help_context"
  | "concierge_shopping_context";

export type ConciergeSpecialistRegistration = {
  specialistId: typeof CONCIERGE_SPECIALIST_ID;
  specialistVersion: typeof CONCIERGE_SPECIALIST_VERSION;
  domain: "concierge";
  supportedFlowIds: readonly [typeof CONCIERGE_FLOW_ID];
  supportedCapabilities: readonly ConciergeSpecialistCapability[];
  canExecuteToolsDirectly: false;
  canCreateConciergeTasks: false;
  canContactProviders: false;
  canBookTransport: false;
  canSendMessages: false;
  canAuthorizePayment: false;
  canMutateCaregiverPermissions: false;
  canMutateSchedules: false;
  canWriteMemory: false;
  legacyFallbackAvailable: true;
};

export const CONCIERGE_SPECIALIST_REGISTRATION: ConciergeSpecialistRegistration = {
  specialistId: CONCIERGE_SPECIALIST_ID,
  specialistVersion: CONCIERGE_SPECIALIST_VERSION,
  domain: "concierge",
  supportedFlowIds: [CONCIERGE_FLOW_ID],
  supportedCapabilities: [
    "concierge_request_intake",
    "concierge_trusted_help_context",
    "concierge_shopping_context",
  ],
  canExecuteToolsDirectly: false,
  canCreateConciergeTasks: false,
  canContactProviders: false,
  canBookTransport: false,
  canSendMessages: false,
  canAuthorizePayment: false,
  canMutateCaregiverPermissions: false,
  canMutateSchedules: false,
  canWriteMemory: false,
  legacyFallbackAvailable: true,
};

export type ConciergeRuntimeContract = {
  flowId: typeof CONCIERGE_FLOW_ID;
  flowVersion: typeof CONCIERGE_FLOW_VERSION;
  sceneId: typeof CONCIERGE_SCENE_ID;
  ownerSpecialistId: typeof CONCIERGE_SPECIALIST_ID;
  catalogueVersion: string;
  canonicalFlow: FlowDefinition;
  allowedTools: readonly [SpecialistToolDescriptor];
  registration: ConciergeSpecialistRegistration;
  presentations: {
    requestIntake: PresentationDefinition;
    trustedHelpSetup: PresentationDefinition;
    shoppingContext: PresentationDefinition;
    safeFallback: PresentationDefinition;
  };
};

export function resolveConciergeRuntimeContract(input: {
  catalogue?: FlowCatalogue;
  presentationRegistry?: typeof VYVA_PRESENTATION_REGISTRY;
} = {}): ConciergeRuntimeContract | null {
  const catalogue = parseFlowCatalogue(input.catalogue ?? VYVA_FLOW_CATALOGUE);
  const registry = parsePresentationRegistry(input.presentationRegistry ?? VYVA_PRESENTATION_REGISTRY);
  const canonicalFlow = catalogue.flows.find((flow) =>
    flow.flowId === CONCIERGE_FLOW_ID &&
    flow.version === CONCIERGE_FLOW_VERSION);
  if (!canonicalFlow) return null;
  if (canonicalFlow.ownerSpecialistId !== CONCIERGE_SPECIALIST_ID) return null;
  if (!["approved", "pilot", "active"].includes(canonicalFlow.status)) return null;
  if (!canonicalFlow.supportedTriggers.includes("user")) return null;
  for (const channel of ["voice", "pwa", "touch", "text"] as const) {
    if (!canonicalFlow.supportedChannels.includes(channel)) return null;
  }
  if (!canonicalFlow.uiScenes.some((scene) => scene.sceneId === CONCIERGE_SCENE_ID)) {
    return null;
  }
  if (canonicalFlow.requiredTools.length > 0) return null;
  if (!canonicalFlow.optionalTools.includes(CONCIERGE_OPEN_APP_ACTION_TOOL_ID)) return null;

  const requestIntake = registry.presentations.find(
    (presentation) => presentation.presentationId === CONCIERGE_REQUEST_INTAKE_PRESENTATION_ID,
  );
  const trustedHelpSetup = registry.presentations.find(
    (presentation) => presentation.presentationId === CONCIERGE_TRUSTED_HELP_PRESENTATION_ID,
  );
  const shoppingContext = registry.presentations.find(
    (presentation) => presentation.presentationId === CONCIERGE_SHOPPING_CONTEXT_PRESENTATION_ID,
  );
  const safeFallback = registry.presentations.find(
    (presentation) => presentation.presentationId === CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
  );
  if (!requestIntake || !trustedHelpSetup || !shoppingContext || !safeFallback) return null;
  for (const presentation of [requestIntake, trustedHelpSetup, shoppingContext, safeFallback]) {
    if (!presentation.supportedFlowIds.includes(CONCIERGE_FLOW_ID)) return null;
    if (presentation.sceneId !== CONCIERGE_SCENE_ID) return null;
  }

  return {
    flowId: CONCIERGE_FLOW_ID,
    flowVersion: CONCIERGE_FLOW_VERSION,
    sceneId: CONCIERGE_SCENE_ID,
    ownerSpecialistId: CONCIERGE_SPECIALIST_ID,
    catalogueVersion: catalogue.catalogueVersion,
    canonicalFlow,
    allowedTools: [CONCIERGE_OPEN_APP_ACTION_TOOL],
    registration: CONCIERGE_SPECIALIST_REGISTRATION,
    presentations: {
      requestIntake,
      trustedHelpSetup,
      shoppingContext,
      safeFallback,
    },
  };
}
