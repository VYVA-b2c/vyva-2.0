import { describe, expect, it } from "vitest";
import {
  VYVA_FLOW_CATALOGUE,
  parseFlowCatalogue,
} from "../../shared/orchestration/flowCatalogue";
import {
  MEDICATION_FLOW_ID,
  MEDICATION_FLOW_VERSION,
  MEDICATION_OPEN_APP_ACTION_TOOL_ID,
  MEDICATION_SCENE_ID,
  MEDICATION_SPECIALIST_ID,
  resolveMedicationRuntimeContract,
} from "./medicationFlow";

describe("Medication flow contract", () => {
  it("upgrades the canonical medication reminder Flow for the Stage 10C specialist slice", () => {
    const catalogue = parseFlowCatalogue(VYVA_FLOW_CATALOGUE);
    const flow = catalogue.flows.find((item) => item.flowId === MEDICATION_FLOW_ID);
    expect(flow).toMatchObject({
      flowId: MEDICATION_FLOW_ID,
      version: MEDICATION_FLOW_VERSION,
      status: "pilot",
      ownerSpecialistId: MEDICATION_SPECIALIST_ID,
      requiredTools: [],
      optionalTools: [MEDICATION_OPEN_APP_ACTION_TOOL_ID],
      deterministicSafetyChecks: ["safety_check.emergency_general", "safety_check.medication_risk"],
      metadata: {
        migrationBoundary: "medication_navigation_and_context_only",
        noPostgresMigrationRequired: true,
        doseMutationBoundaryUnchanged: true,
        medicationRecordBoundaryUnchanged: true,
        caregiverBoundaryUnchanged: true,
        scheduleBoundaryUnchanged: true,
        domainSupervisorRequired: false,
      },
    });
    expect(flow?.uiScenes.map((scene) => scene.sceneId)).toContain(MEDICATION_SCENE_ID);
  });

  it("resolves the runtime contract only when catalogue and presentation registry agree", () => {
    const contract = resolveMedicationRuntimeContract();
    expect(contract).toMatchObject({
      flowId: MEDICATION_FLOW_ID,
      flowVersion: MEDICATION_FLOW_VERSION,
      ownerSpecialistId: MEDICATION_SPECIALIST_ID,
    });
    expect(contract?.allowedTools[0].toolId).toBe(MEDICATION_OPEN_APP_ACTION_TOOL_ID);
    expect(contract?.presentations.reminder.presentationId).toBe("presentation.medication.reminder");
    expect(contract?.presentations.humanHelpConfirmation.presentationId)
      .toBe("presentation.medication.human_help_confirmation");
    expect(contract?.presentations.followup.presentationId).toBe("presentation.medication.followup");
  });

  it("fails closed if the open-app-action proposal tool is removed", () => {
    const catalogue = structuredClone(VYVA_FLOW_CATALOGUE);
    const flow = catalogue.flows.find((item) => item.flowId === MEDICATION_FLOW_ID)!;
    flow.optionalTools = [];
    expect(resolveMedicationRuntimeContract({ catalogue })).toBeNull();
  });
});
