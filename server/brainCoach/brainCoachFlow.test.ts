import { describe, expect, it } from "vitest";
import {
  VYVA_FLOW_CATALOGUE,
  parseFlowCatalogue,
} from "../../shared/orchestration/flowCatalogue";
import {
  BRAIN_COACH_FLOW_ID,
  BRAIN_COACH_FLOW_VERSION,
  BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID,
  BRAIN_COACH_SCENE_ID,
  BRAIN_COACH_SPECIALIST_ID,
  resolveBrainCoachRuntimeContract,
} from "./brainCoachFlow";

describe("Brain Coach flow contract", () => {
  it("adds one pilot Brain Coach activity-session Flow to the canonical catalogue", () => {
    const catalogue = parseFlowCatalogue(VYVA_FLOW_CATALOGUE);
    const flow = catalogue.flows.find((item) => item.flowId === BRAIN_COACH_FLOW_ID);
    expect(flow).toMatchObject({
      flowId: BRAIN_COACH_FLOW_ID,
      version: BRAIN_COACH_FLOW_VERSION,
      status: "pilot",
      ownerSpecialistId: BRAIN_COACH_SPECIALIST_ID,
      requiredTools: [],
      optionalTools: [BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID],
      deterministicSafetyChecks: ["safety_check.emergency_general"],
      metadata: {
        migrationBoundary: "activity_navigation_only",
        noPostgresMigrationRequired: true,
        caregiverBoundaryUnchanged: true,
        scheduleBoundaryUnchanged: true,
        gamePersistenceUnchanged: true,
        domainSupervisorRequired: false,
      },
    });
    expect(flow?.uiScenes.map((scene) => scene.sceneId)).toContain(BRAIN_COACH_SCENE_ID);
  });

  it("resolves the runtime contract only when the catalogue agrees", () => {
    const contract = resolveBrainCoachRuntimeContract();
    expect(contract).toMatchObject({
      flowId: BRAIN_COACH_FLOW_ID,
      flowVersion: BRAIN_COACH_FLOW_VERSION,
      ownerSpecialistId: BRAIN_COACH_SPECIALIST_ID,
    });
    expect(contract?.allowedTools[0].toolId).toBe(BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID);
  });

  it("fails closed if the optional open-app-action tool is removed", () => {
    const catalogue = structuredClone(VYVA_FLOW_CATALOGUE);
    const flow = catalogue.flows.find((item) => item.flowId === BRAIN_COACH_FLOW_ID)!;
    flow.optionalTools = [];
    expect(resolveBrainCoachRuntimeContract({ catalogue })).toBeNull();
  });
});
