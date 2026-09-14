import { describe, expect, it } from "vitest";
import {
  VYVA_FLOW_CATALOGUE,
  parseFlowCatalogue,
} from "../../shared/orchestration/flowCatalogue";
import {
  CONCIERGE_FLOW_ID,
  CONCIERGE_FLOW_VERSION,
  CONCIERGE_OPEN_APP_ACTION_TOOL_ID,
  CONCIERGE_SCENE_ID,
  CONCIERGE_SPECIALIST_ID,
  CONCIERGE_SPECIALIST_REGISTRATION,
  resolveConciergeRuntimeContract,
} from "./conciergeFlow";

describe("Concierge flow contract", () => {
  it("upgrades the canonical Concierge administrative-support Flow for the Stage 10D slice", () => {
    const catalogue = parseFlowCatalogue(VYVA_FLOW_CATALOGUE);
    const flow = catalogue.flows.find((item) => item.flowId === CONCIERGE_FLOW_ID);
    expect(flow).toMatchObject({
      flowId: CONCIERGE_FLOW_ID,
      version: CONCIERGE_FLOW_VERSION,
      status: "pilot",
      ownerSpecialistId: CONCIERGE_SPECIALIST_ID,
      requiredTools: [],
      optionalTools: [CONCIERGE_OPEN_APP_ACTION_TOOL_ID],
      deterministicSafetyChecks: [
        "safety_check.emergency_general",
        "safety_check.concierge_external_action",
      ],
      metadata: {
        migrationBoundary: "concierge_request_intake_navigation_context_only",
        noPostgresMigrationRequired: true,
        noGlobalRegistryAdded: true,
        trustedHelpPresentationOnly: true,
        externalExecutionBoundaryUnchanged: true,
        providerContactBoundaryUnchanged: true,
        bookingPaymentBoundaryUnchanged: true,
        caregiverBoundaryUnchanged: true,
        scheduleBoundaryUnchanged: true,
        memoryBoundaryUnchanged: true,
        domainSupervisorRequired: false,
      },
    });
    expect(flow?.uiScenes.map((scene) => scene.sceneId)).toContain(CONCIERGE_SCENE_ID);
  });

  it("resolves the runtime contract only when catalogue and presentation registry agree", () => {
    const contract = resolveConciergeRuntimeContract();
    expect(contract).toMatchObject({
      flowId: CONCIERGE_FLOW_ID,
      flowVersion: CONCIERGE_FLOW_VERSION,
      ownerSpecialistId: CONCIERGE_SPECIALIST_ID,
    });
    expect(contract?.allowedTools[0].toolId).toBe(CONCIERGE_OPEN_APP_ACTION_TOOL_ID);
    expect(contract?.presentations.requestIntake.presentationId)
      .toBe("presentation.concierge.request_intake");
    expect(contract?.presentations.trustedHelpSetup.presentationId)
      .toBe("presentation.concierge.trusted_help_setup");
    expect(contract?.presentations.shoppingContext.presentationId)
      .toBe("presentation.concierge.shopping_context");
    expect(contract?.presentations.safeFallback.presentationId)
      .toBe("presentation.concierge.safe_fallback");
  });

  it("keeps the Specialist registration non-executable and Concierge-only", () => {
    expect(CONCIERGE_SPECIALIST_REGISTRATION).toMatchObject({
      specialistId: CONCIERGE_SPECIALIST_ID,
      domain: "concierge",
      supportedFlowIds: [CONCIERGE_FLOW_ID],
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
    });
  });

  it("fails closed if the open-app-action proposal tool is removed", () => {
    const catalogue = structuredClone(VYVA_FLOW_CATALOGUE);
    const flow = catalogue.flows.find((item) => item.flowId === CONCIERGE_FLOW_ID)!;
    flow.optionalTools = [];
    expect(resolveConciergeRuntimeContract({ catalogue })).toBeNull();
  });
});
