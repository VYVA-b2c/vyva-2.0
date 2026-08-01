import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import { buildConciergeManualQaScripts } from "../shared/conciergeManualQaScripts";
import {
  CONCIERGE_MANUAL_QA_EXPORT_VERSION,
  CONCIERGE_MANUAL_QA_PRIORITY_FLOW_REFERENCES,
  buildConciergeManualQaExportPayload,
  buildConciergeManualQaJsonExport,
  buildConciergeManualQaMarkdownReport,
  filterConciergeManualQaPriorityScripts,
  buildConciergeManualQaNotes,
  normalizeConciergeManualQaRunnerState,
  parseConciergeManualQaImport,
  summarizeConciergeManualQaRunner,
  summarizeConciergeManualQaPriorityRunner,
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

  it("tracks the high-risk priority pass separately from the full flow set", () => {
    const scripts = buildConciergeManualQaScripts();
    const priorityScripts = filterConciergeManualQaPriorityScripts(scripts);
    const priorityReferences = priorityScripts.map((script) => script.reference);

    expect(priorityReferences).toEqual(CONCIERGE_MANUAL_QA_PRIORITY_FLOW_REFERENCES);
    expect(priorityReferences).toEqual([
      CONCIERGE_FLOW_REFERENCES.transportBooking,
      CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.homeService,
      CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
      CONCIERGE_FLOW_REFERENCES.scamCheck,
    ]);

    const transport = priorityScripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.transportBooking)!;
    const shopping = scripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.shoppingSupport)!;
    let state = normalizeConciergeManualQaRunnerState(scripts, null);
    for (const step of transport.steps) {
      state = updateConciergeManualQaRunnerStatus(state, step.id, "pass");
    }
    state = updateConciergeManualQaRunnerStatus(state, shopping.steps[0].id, "fail");

    const fullSummary = summarizeConciergeManualQaRunner(scripts, state);
    const prioritySummary = summarizeConciergeManualQaPriorityRunner(scripts, state);

    expect(fullSummary.blockedFlows).toBe(1);
    expect(prioritySummary.totalFlows).toBe(6);
    expect(prioritySummary.fullyPassedFlows).toBe(1);
    expect(prioritySummary.blockedFlows).toBe(0);
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

  it("exports a JSON payload with timestamp, flow status, failed steps, and needs-review steps", () => {
    const scripts = buildConciergeManualQaScripts();
    const transport = scripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.transportBooking)!;
    let state = normalizeConciergeManualQaRunnerState(scripts, null);
    state = updateConciergeManualQaRunnerStatus(state, transport.steps[0].id, "fail");
    state = updateConciergeManualQaRunnerStatus(state, transport.steps[1].id, "needs_review");

    const payload = buildConciergeManualQaExportPayload(scripts, state, "2026-07-15T12:00:00.000Z");
    const transportFlow = payload.flows.find((flow) => flow.reference === CONCIERGE_FLOW_REFERENCES.transportBooking);

    expect(payload.version).toBe(CONCIERGE_MANUAL_QA_EXPORT_VERSION);
    expect(payload.exportedAt).toBe("2026-07-15T12:00:00.000Z");
    expect(payload.runnerState[transport.steps[0].id]).toBe("fail");
    expect(payload.summary.failedCheckpoints).toBe(1);
    expect(payload.summary.needsReviewCheckpoints).toBe(1);
    expect(payload.prioritySummary.failedCheckpoints).toBe(1);
    expect(payload.prioritySummary.needsReviewCheckpoints).toBe(1);
    expect(transportFlow?.status).toBe("blocked");
    expect(transportFlow?.failedSteps).toHaveLength(1);
    expect(transportFlow?.failedSteps[0].title).toBe(transport.steps[0].title);
    expect(transportFlow?.needsReviewSteps).toHaveLength(1);
    expect(transportFlow?.needsReviewSteps[0].title).toBe(transport.steps[1].title);
  });

  it("builds a Markdown report with timestamp, flow status, and issue sections", () => {
    const scripts = buildConciergeManualQaScripts();
    const transport = scripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.transportBooking)!;
    let state = normalizeConciergeManualQaRunnerState(scripts, null);
    state = updateConciergeManualQaRunnerStatus(state, transport.steps[0].id, "fail");
    state = updateConciergeManualQaRunnerStatus(state, transport.steps[1].id, "needs_review");

    const markdown = buildConciergeManualQaMarkdownReport(scripts, state, "2026-07-15T12:00:00.000Z");

    expect(markdown).toContain("# Concierge manual QA report");
    expect(markdown).toContain("Exported at: 2026-07-15T12:00:00.000Z");
    expect(markdown).toContain("## Priority pass");
    expect(markdown).toContain("Priority flows blocked: 1");
    expect(markdown).toContain("Status: blocked");
    expect(markdown).toContain("Failed steps:");
    expect(markdown).toContain(transport.steps[0].title);
    expect(markdown).toContain("Needs-review steps:");
    expect(markdown).toContain(transport.steps[1].title);
  });

  it("imports an exported JSON state so another tester can continue", () => {
    const scripts = buildConciergeManualQaScripts();
    const transport = scripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.transportBooking)!;
    let state = normalizeConciergeManualQaRunnerState(scripts, null);
    state = updateConciergeManualQaRunnerStatus(state, transport.steps[0].id, "pass");

    const json = buildConciergeManualQaJsonExport(scripts, state, "2026-07-15T12:00:00.000Z");
    const result = parseConciergeManualQaImport(scripts, json);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.importedAt).toBe("2026-07-15T12:00:00.000Z");
      expect(result.state[transport.steps[0].id]).toBe("pass");
    }
  });

  it("returns a clear error for invalid or unrelated import JSON", () => {
    const scripts = buildConciergeManualQaScripts();

    expect(parseConciergeManualQaImport(scripts, "{bad").ok).toBe(false);
    const unrelated = parseConciergeManualQaImport(scripts, JSON.stringify({ some_other_step: "pass" }));
    expect(unrelated).toEqual({
      ok: false,
      error: "The pasted QA JSON has no matching tested checkpoints for this dashboard.",
    });
  });
});
