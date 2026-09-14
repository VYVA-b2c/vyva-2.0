import { describe, expect, it } from "vitest";
import {
  VYVA_FLOW_CATALOGUE,
  parseFlowCatalogue,
} from "../../shared/orchestration/flowCatalogue";
import {
  SOCIAL_SUPPORT_FLOW_ID,
  SOCIAL_SUPPORT_FLOW_VERSION,
  SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID,
  SOCIAL_SUPPORT_SCENE_ID,
  SOCIAL_SUPPORT_SPECIALIST_ID,
  SOCIAL_SUPPORT_SPECIALIST_REGISTRATION,
  resolveSocialSupportRuntimeContract,
} from "./socialSupportFlow";

describe("Social Support flow contract", () => {
  it("upgrades the canonical social.community_connection Flow for the Stage 10E slice", () => {
    const catalogue = parseFlowCatalogue(VYVA_FLOW_CATALOGUE);
    const flow = catalogue.flows.find((item) => item.flowId === SOCIAL_SUPPORT_FLOW_ID);
    expect(flow).toMatchObject({
      flowId: SOCIAL_SUPPORT_FLOW_ID,
      version: SOCIAL_SUPPORT_FLOW_VERSION,
      status: "pilot",
      ownerSpecialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
      requiredTools: [],
      optionalTools: [SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID],
      deterministicSafetyChecks: [
        "safety_check.emergency_general",
        "safety_check.social_human_contact_boundary",
      ],
      metadata: {
        task19Stage: "stage_10e_social_support_specialist",
        migrationBoundary: "community_navigation_context_only",
        noPostgresMigrationRequired: true,
        noGlobalRegistryAdded: true,
        mentalWellbeingBoundaryUnchanged: true,
        conciergeBoundaryUnchanged: true,
        trustedHelpBoundaryUnchanged: true,
        caregiverPermissionBoundaryUnchanged: true,
        caregiverOperatorEscalationBoundaryUnchanged: true,
        memoryBoundaryUnchanged: true,
        scheduleBoundaryUnchanged: true,
        domainSupervisorRequired: false,
      },
    });
    expect(flow?.uiScenes.map((scene) => scene.sceneId)).toContain(SOCIAL_SUPPORT_SCENE_ID);
  });

  it("resolves the runtime contract only when catalogue and presentation registry agree", () => {
    const contract = resolveSocialSupportRuntimeContract();
    expect(contract).toMatchObject({
      flowId: SOCIAL_SUPPORT_FLOW_ID,
      flowVersion: SOCIAL_SUPPORT_FLOW_VERSION,
      ownerSpecialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
    });
    expect(contract?.allowedTools[0].toolId).toBe(SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID);
    expect(contract?.presentations.community.presentationId)
      .toBe("presentation.social.community_connection.summary");
    expect(contract?.presentations.rooms.presentationId)
      .toBe("presentation.social.community_connection.rooms");
    expect(contract?.presentations.activities.presentationId)
      .toBe("presentation.social.community_connection.activities");
    expect(contract?.presentations.safeFallback.presentationId)
      .toBe("presentation.social.community_connection.safe_fallback");
  });

  it("keeps the Specialist registration non-executable and companion-social only", () => {
    expect(SOCIAL_SUPPORT_SPECIALIST_REGISTRATION).toMatchObject({
      specialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
      legacyDomain: "companion",
      supportedFlowIds: [SOCIAL_SUPPORT_FLOW_ID],
      canExecuteToolsDirectly: false,
      canContactHumans: false,
      canMutateCaregiverPermissions: false,
      canCreateCaregiverEscalation: false,
      canCreateOperatorTasks: false,
      canWriteMemory: false,
      canMutateSchedules: false,
      canStartProactiveEngagement: false,
      legacyFallbackAvailable: true,
    });
  });

  it("fails closed if the open-app-action proposal tool is removed", () => {
    const catalogue = structuredClone(VYVA_FLOW_CATALOGUE);
    const flow = catalogue.flows.find((item) => item.flowId === SOCIAL_SUPPORT_FLOW_ID)!;
    flow.optionalTools = [];
    expect(resolveSocialSupportRuntimeContract({ catalogue })).toBeNull();
  });
});
