import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import { buildConciergeManualQaScripts } from "../shared/conciergeManualQaScripts";
import {
  buildConciergeManualQaNotes,
  normalizeConciergeManualQaRunnerState,
  summarizeConciergeManualQaRunner,
  updateConciergeManualQaRunnerStatus,
} from "../shared/conciergeManualQaRunner";

describe("concierge manual QA runner", () => {
  it("starts every manual QA checkpoint as not tested", () => {
    const scripts = buildConciergeManualQaScripts();
    const state = normalizeConciergeManualQaRunnerState(scripts, null);
    const summary = summarizeConciergeManualQaRunner(scripts, state);

    expect(Object.values(state).every((status) => status === "not_tested")).toBe(true);
    expect(summary.totalFlows).toBe(scripts.length);
    expect(summary.notStartedFlows).toBe(scripts.length);
    expect(summary.notTestedCheckpoints).toBe(summary.totalSteps);
    expect(summary.fullyPassedFlows).toBe(0);
    expect(summary.blockedFlows).toBe(0);
  });

  it("rolls up pass, fail, and needs-review statuses per flow", () => {
    const scripts = buildConciergeManualQaScripts();
    const transport = scripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.transportBooking);
    const scam = scripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.scamCheck);
    expect(transport).toBeDefined();
    expect(scam).toBeDefined();

    let state = normalizeConciergeManualQaRunnerState(scripts, null);
    for (const step of transport!.steps) {
      state = updateConciergeManualQaRunnerStatus(state, step.id, "pass");
    }
    state = updateConciergeManualQaRunnerStatus(state, scam!.steps[0].id, "fail");
    state = updateConciergeManualQaRunnerStatus(state, scam!.steps[1].id, "needs_review");

    const summary = summarizeConciergeManualQaRunner(scripts, state);
    const transportResult = summary.flowResults.find((flow) => flow.reference === CONCIERGE_FLOW_REFERENCES.transportBooking);
    const scamResult = summary.flowResults.find((flow) => flow.reference === CONCIERGE_FLOW_REFERENCES.scamCheck);

    expect(transportResult?.status).toBe("passed");
    expect(scamResult?.status).toBe("blocked");
    expect(summary.fullyPassedFlows).toBe(1);
    expect(summary.blockedFlows).toBe(1);
    expect(summary.failedCheckpoints).toBe(1);
    expect(summary.needsReviewCheckpoints).toBe(1);
  });

  it("normalizes stale or invalid stored statuses", () => {
    const scripts = buildConciergeManualQaScripts();
    const firstStep = scripts[0].steps[0];
    const state = normalizeConciergeManualQaRunnerState(scripts, {
      [firstStep.id]: "pass",
      stale_step: "fail",
      [scripts[0].steps[1].id]: "unknown",
    });

    expect(state[firstStep.id]).toBe("pass");
    expect(state.stale_step).toBeUndefined();
    expect(state[scripts[0].steps[1].id]).toBe("not_tested");
  });

  it("creates copyable QA notes for failed and needs-review checkpoints", () => {
    const scripts = buildConciergeManualQaScripts();
    const transport = scripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.transportBooking)!;
    let state = normalizeConciergeManualQaRunnerState(scripts, null);
    state = updateConciergeManualQaRunnerStatus(state, transport.steps[0].id, "fail");
    state = updateConciergeManualQaRunnerStatus(state, transport.steps[1].id, "needs_review");

    const notes = buildConciergeManualQaNotes(scripts, state);

    expect(notes).toContain("Concierge manual QA notes");
    expect(notes).toContain("Blocked flows: 1");
    expect(notes).toContain("Book ride / transport");
    expect(notes).toContain(`Fail: ${transport.steps[0].title}`);
    expect(notes).toContain(`Needs review: ${transport.steps[1].title}`);
    expect(notes).toContain("Expected:");
  });
});
