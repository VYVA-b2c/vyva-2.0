import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import {
  APP_WORKFLOW_REFERENCES,
} from "../shared/workflowRegistry";
import {
  CROSS_PILLAR_MANUAL_QA_HIGH_RISK_REFERENCES,
  buildCrossPillarManualQaFlows,
  buildCrossPillarManualQaNotes,
  normalizeCrossPillarManualQaRunnerState,
  summarizeCrossPillarManualQaRunner,
  updateCrossPillarManualQaRunnerStatus,
} from "../shared/crossPillarManualQa";

describe("cross-pillar manual QA runner", () => {
  it("builds the high-risk pass across health, meds, safe home, and concierge flows", () => {
    const flows = buildCrossPillarManualQaFlows();
    const references = flows.map((flow) => flow.reference);

    expect(references.slice(0, CROSS_PILLAR_MANUAL_QA_HIGH_RISK_REFERENCES.length)).toEqual(
      CROSS_PILLAR_MANUAL_QA_HIGH_RISK_REFERENCES,
    );
    expect(references).toContain(APP_WORKFLOW_REFERENCES.symptomCheck);
    expect(references).toContain(APP_WORKFLOW_REFERENCES.visualScan);
    expect(references).toContain(APP_WORKFLOW_REFERENCES.medicationPlan);
    expect(references).toContain(APP_WORKFLOW_REFERENCES.doctorNextStep);
    expect(references).toContain(CONCIERGE_FLOW_REFERENCES.safeHomeSupport);
    expect(references).toContain(CONCIERGE_FLOW_REFERENCES.transportBooking);
    expect(references).toContain(CONCIERGE_FLOW_REFERENCES.otcPharmacy);
    expect(references).toContain(CONCIERGE_FLOW_REFERENCES.homeService);
    expect(flows.every((flow) => flow.checks.map((check) => check.kind).join("|") === [
      "missing_setup",
      "provider_tool_readiness",
      "final_confirmation",
      "receipt_moment",
      "resume_behavior",
      "language_tone",
    ].join("|"))).toBe(true);
  });

  it("turns registry readiness into concrete QA expectations", () => {
    const flows = buildCrossPillarManualQaFlows();
    const ride = flows.find((flow) => flow.reference === CONCIERGE_FLOW_REFERENCES.transportBooking);
    const visualScan = flows.find((flow) => flow.reference === APP_WORKFLOW_REFERENCES.visualScan);

    expect(ride).toBeDefined();
    expect(ride?.checks.find((check) => check.kind === "missing_setup")?.expectedResult).toContain("add usual provider");
    expect(ride?.checks.find((check) => check.kind === "provider_tool_readiness")?.expectedResult).toContain("phone call");
    expect(ride?.checks.find((check) => check.kind === "final_confirmation")?.expectedResult).toContain("Confirm pickup");

    expect(visualScan).toBeDefined();
    expect(visualScan?.checks.find((check) => check.kind === "final_confirmation")?.expectedResult).toContain("Ask before uploading");
    expect(visualScan?.checks.find((check) => check.kind === "language_tone")?.expectedResult).toContain("avoids diagnosis");
  });

  it("starts every cross-pillar checkpoint as not tested", () => {
    const flows = buildCrossPillarManualQaFlows();
    const state = normalizeCrossPillarManualQaRunnerState(flows, null);
    const summary = summarizeCrossPillarManualQaRunner(flows, state);

    expect(Object.values(state).every((status) => status === "not_tested")).toBe(true);
    expect(summary.totalFlows).toBe(flows.length);
    expect(summary.notStartedFlows).toBe(flows.length);
    expect(summary.notTestedCheckpoints).toBe(summary.totalChecks);
    expect(summary.highPriorityFlows).toBe(CROSS_PILLAR_MANUAL_QA_HIGH_RISK_REFERENCES.length);
    expect(summary.fullyPassedFlows).toBe(0);
  });

  it("rolls up pass, fail, and needs-review statuses per flow", () => {
    const flows = buildCrossPillarManualQaFlows();
    const symptoms = flows.find((flow) => flow.reference === APP_WORKFLOW_REFERENCES.symptomCheck)!;
    const transport = flows.find((flow) => flow.reference === CONCIERGE_FLOW_REFERENCES.transportBooking)!;
    let state = normalizeCrossPillarManualQaRunnerState(flows, null);

    for (const check of symptoms.checks) {
      state = updateCrossPillarManualQaRunnerStatus(state, check.id, "pass");
    }
    state = updateCrossPillarManualQaRunnerStatus(state, transport.checks[0].id, "fail");
    state = updateCrossPillarManualQaRunnerStatus(state, transport.checks[1].id, "needs_review");

    const summary = summarizeCrossPillarManualQaRunner(flows, state);
    const symptomsResult = summary.flowResults.find((flow) => flow.reference === APP_WORKFLOW_REFERENCES.symptomCheck);
    const transportResult = summary.flowResults.find((flow) => flow.reference === CONCIERGE_FLOW_REFERENCES.transportBooking);

    expect(symptomsResult?.status).toBe("passed");
    expect(transportResult?.status).toBe("blocked");
    expect(summary.fullyPassedFlows).toBe(1);
    expect(summary.blockedFlows).toBe(1);
    expect(summary.failedCheckpoints).toBe(1);
    expect(summary.needsReviewCheckpoints).toBe(1);
    expect(summary.highPriorityBlockedFlows).toBe(1);
  });

  it("normalizes stale stored status and creates PR-ready notes", () => {
    const flows = buildCrossPillarManualQaFlows();
    const doctor = flows.find((flow) => flow.reference === APP_WORKFLOW_REFERENCES.doctorNextStep)!;
    const state = normalizeCrossPillarManualQaRunnerState(flows, {
      [doctor.checks[0].id]: "fail",
      [doctor.checks[1].id]: "needs_review",
      stale_step: "pass",
      [doctor.checks[2].id]: "unknown",
    });

    expect(state.stale_step).toBeUndefined();
    expect(state[doctor.checks[0].id]).toBe("fail");
    expect(state[doctor.checks[1].id]).toBe("needs_review");
    expect(state[doctor.checks[2].id]).toBe("not_tested");

    const notes = buildCrossPillarManualQaNotes(flows, state);
    expect(notes).toContain("Cross-pillar manual QA notes");
    expect(notes).toContain("Talk doctor / clinical next step");
    expect(notes).toContain("Fail: Missing setup path");
    expect(notes).toContain("Needs review: Provider or tool readiness");
    expect(notes).toContain("Expected:");
    expect(notes).toContain("Requires phone call, email, booking link, operator review");
  });
});
