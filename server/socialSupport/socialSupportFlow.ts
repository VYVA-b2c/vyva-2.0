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

export const SOCIAL_SUPPORT_SPECIALIST_ID = "social" as const;
export const SOCIAL_SUPPORT_SPECIALIST_VERSION = "1.0.0" as const;
export const SOCIAL_SUPPORT_FLOW_ID = "social.community_connection" as const;
export const SOCIAL_SUPPORT_FLOW_VERSION = "1.0.0" as const;
export const SOCIAL_SUPPORT_SCENE_ID = "social.community_connection.main" as const;
export const SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID = "tool.voice.open_app_action" as const;
export const SOCIAL_SUPPORT_COMMUNITY_PRESENTATION_ID =
  "presentation.social.community_connection.summary" as const;
export const SOCIAL_SUPPORT_ROOMS_PRESENTATION_ID =
  "presentation.social.community_connection.rooms" as const;
export const SOCIAL_SUPPORT_ACTIVITIES_PRESENTATION_ID =
  "presentation.social.community_connection.activities" as const;
export const SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID =
  "presentation.social.community_connection.safe_fallback" as const;

export const SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL: SpecialistToolDescriptor = {
  toolId: SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID,
  description:
    "Proposes the existing client-owned open_app_action navigation bridge for community/social-room context only. It does not contact people, grant caregiver permissions, create escalation, schedule outreach, write memory, or execute external actions.",
  inputSchemaId: "schema.voice.open_app_action.v1",
  outputSchemaId: "schema.voice.open_app_action.result.v1",
  requiresConfirmation: false,
  requiresConsent: false,
  idempotencyRequired: true,
  allowedRiskLevels: ["low"],
};

export type SocialSupportSpecialistCapability =
  | "social_community_navigation"
  | "social_rooms_context"
  | "community_activities_context";

export type SocialSupportSpecialistRegistration = {
  specialistId: typeof SOCIAL_SUPPORT_SPECIALIST_ID;
  specialistVersion: typeof SOCIAL_SUPPORT_SPECIALIST_VERSION;
  legacyDomain: "companion";
  supportedFlowIds: readonly [typeof SOCIAL_SUPPORT_FLOW_ID];
  supportedCapabilities: readonly SocialSupportSpecialistCapability[];
  canExecuteToolsDirectly: false;
  canContactHumans: false;
  canMutateCaregiverPermissions: false;
  canCreateCaregiverEscalation: false;
  canCreateOperatorTasks: false;
  canWriteMemory: false;
  canMutateSchedules: false;
  canStartProactiveEngagement: false;
  legacyFallbackAvailable: true;
};

export const SOCIAL_SUPPORT_SPECIALIST_REGISTRATION: SocialSupportSpecialistRegistration = {
  specialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
  specialistVersion: SOCIAL_SUPPORT_SPECIALIST_VERSION,
  legacyDomain: "companion",
  supportedFlowIds: [SOCIAL_SUPPORT_FLOW_ID],
  supportedCapabilities: [
    "social_community_navigation",
    "social_rooms_context",
    "community_activities_context",
  ],
  canExecuteToolsDirectly: false,
  canContactHumans: false,
  canMutateCaregiverPermissions: false,
  canCreateCaregiverEscalation: false,
  canCreateOperatorTasks: false,
  canWriteMemory: false,
  canMutateSchedules: false,
  canStartProactiveEngagement: false,
  legacyFallbackAvailable: true,
};

export type SocialSupportRuntimeContract = {
  flowId: typeof SOCIAL_SUPPORT_FLOW_ID;
  flowVersion: typeof SOCIAL_SUPPORT_FLOW_VERSION;
  sceneId: typeof SOCIAL_SUPPORT_SCENE_ID;
  ownerSpecialistId: typeof SOCIAL_SUPPORT_SPECIALIST_ID;
  catalogueVersion: string;
  canonicalFlow: FlowDefinition;
  allowedTools: readonly [SpecialistToolDescriptor];
  registration: SocialSupportSpecialistRegistration;
  presentations: {
    community: PresentationDefinition;
    rooms: PresentationDefinition;
    activities: PresentationDefinition;
    safeFallback: PresentationDefinition;
  };
};

export function resolveSocialSupportRuntimeContract(input: {
  catalogue?: FlowCatalogue;
  presentationRegistry?: typeof VYVA_PRESENTATION_REGISTRY;
} = {}): SocialSupportRuntimeContract | null {
  const catalogue = parseFlowCatalogue(input.catalogue ?? VYVA_FLOW_CATALOGUE);
  const registry = parsePresentationRegistry(input.presentationRegistry ?? VYVA_PRESENTATION_REGISTRY);
  const canonicalFlow = catalogue.flows.find((flow) =>
    flow.flowId === SOCIAL_SUPPORT_FLOW_ID &&
    flow.version === SOCIAL_SUPPORT_FLOW_VERSION);
  if (!canonicalFlow) return null;
  if (canonicalFlow.ownerSpecialistId !== SOCIAL_SUPPORT_SPECIALIST_ID) return null;
  if (!["approved", "pilot", "active"].includes(canonicalFlow.status)) return null;
  if (!canonicalFlow.supportedTriggers.includes("user")) return null;
  for (const channel of ["voice", "pwa", "touch", "text"] as const) {
    if (!canonicalFlow.supportedChannels.includes(channel)) return null;
  }
  if (!canonicalFlow.uiScenes.some((scene) => scene.sceneId === SOCIAL_SUPPORT_SCENE_ID)) {
    return null;
  }
  if (canonicalFlow.requiredTools.length > 0) return null;
  if (!canonicalFlow.optionalTools.includes(SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID)) return null;

  const community = registry.presentations.find(
    (presentation) => presentation.presentationId === SOCIAL_SUPPORT_COMMUNITY_PRESENTATION_ID,
  );
  const rooms = registry.presentations.find(
    (presentation) => presentation.presentationId === SOCIAL_SUPPORT_ROOMS_PRESENTATION_ID,
  );
  const activities = registry.presentations.find(
    (presentation) => presentation.presentationId === SOCIAL_SUPPORT_ACTIVITIES_PRESENTATION_ID,
  );
  const safeFallback = registry.presentations.find(
    (presentation) => presentation.presentationId === SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
  );
  if (!community || !rooms || !activities || !safeFallback) return null;
  for (const presentation of [community, rooms, activities, safeFallback]) {
    if (!presentation.supportedFlowIds.includes(SOCIAL_SUPPORT_FLOW_ID)) return null;
    if (presentation.sceneId !== SOCIAL_SUPPORT_SCENE_ID) return null;
  }

  return {
    flowId: SOCIAL_SUPPORT_FLOW_ID,
    flowVersion: SOCIAL_SUPPORT_FLOW_VERSION,
    sceneId: SOCIAL_SUPPORT_SCENE_ID,
    ownerSpecialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
    catalogueVersion: catalogue.catalogueVersion,
    canonicalFlow,
    allowedTools: [SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL],
    registration: SOCIAL_SUPPORT_SPECIALIST_REGISTRATION,
    presentations: {
      community,
      rooms,
      activities,
      safeFallback,
    },
  };
}
