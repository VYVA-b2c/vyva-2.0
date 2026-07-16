import { describe, expect, it } from "vitest";
import {
  CONCIERGE_DRY_RUN_FIXTURES,
  CONCIERGE_DRY_RUN_TEST_MODE,
  conciergeDryRunTriggerBody,
  isConciergeDryRunPayload,
} from "../shared/conciergeDryRun";
import {
  CONCIERGE_FLOW_REGISTRY,
  conciergeFlowNeedsSavedProvider,
} from "../shared/conciergeFlowRegistry";
import {
  buildConciergeExecutionTask,
  planConciergeConfirmedExecution,
} from "../shared/conciergeActionExecution";

describe("Concierge dry-run fixtures", () => {
  it("provides one safe test fixture for every registered Concierge flow", () => {
    const registryReferences = CONCIERGE_FLOW_REGISTRY.map((flow) => flow.reference).sort();
    const fixtureReferences = CONCIERGE_DRY_RUN_FIXTURES.map((fixture) => fixture.reference).sort();

    expect(CONCIERGE_DRY_RUN_FIXTURES).toHaveLength(CONCIERGE_FLOW_REGISTRY.length);
    expect(new Set(fixtureReferences).size).toBe(CONCIERGE_FLOW_REGISTRY.length);
    expect(fixtureReferences).toEqual(registryReferences);

    for (const fixture of CONCIERGE_DRY_RUN_FIXTURES) {
      expect(fixture.title).toMatch(/dry run/i);
      expect(fixture.savedProviderPath.length, fixture.reference).toBeGreaterThan(20);
      expect(fixture.missingProviderPath.length, fixture.reference).toBeGreaterThan(20);
      expect(fixture.expectedOutcomeSummary).toMatch(/without|sin|no real/i);
      expect(isConciergeDryRunPayload(fixture.actionPayload), fixture.reference).toBe(true);
      expect(fixture.actionPayload).toMatchObject({
        dry_run: true,
        test_mode: CONCIERGE_DRY_RUN_TEST_MODE,
        no_real_provider_contact: true,
      });
    }
  });

  it("uses reserved fake endpoints only", () => {
    for (const fixture of CONCIERGE_DRY_RUN_FIXTURES) {
      const values = [
        fixture.endpoint.value,
        fixture.provider?.phone,
        fixture.provider?.email,
        fixture.provider?.whatsapp,
        fixture.provider?.bookingUrl,
      ].filter((value): value is string => Boolean(value));

      for (const value of values) {
        expect(
          value.includes("example.test") || value.startsWith("+120255501"),
          `${fixture.reference} endpoint ${value}`,
        ).toBe(true);
      }
    }
  });

  it("builds detail-complete simulated plans that never allow external execution", () => {
    for (const fixture of CONCIERGE_DRY_RUN_FIXTURES) {
      const providerName = fixture.provider?.name ?? null;
      const providerPhone = fixture.provider?.phone ?? null;
      const task = buildConciergeExecutionTask({
        useCase: fixture.useCase,
        providerName,
        providerPhone,
        payload: fixture.actionPayload,
        summary: fixture.actionSummary,
        pendingStatus: "pending",
        now: "2026-07-16T10:00:00.000Z",
      });
      const plan = planConciergeConfirmedExecution({
        useCase: fixture.useCase,
        providerName,
        providerPhone,
        payload: fixture.actionPayload,
        summary: fixture.actionSummary,
        pendingStatus: "pending",
        now: "2026-07-16T10:00:00.000Z",
      });

      expect(task.flow_reference, fixture.reference).toBe(fixture.reference);
      expect(task.dry_run, fixture.reference).toBe(true);
      expect(task.missing_requirements, fixture.reference).toEqual([]);
      expect(plan.mode, fixture.reference).not.toBe("needs_info");
      expect(plan.external_action_allowed, fixture.reference).toBe(false);
      expect(plan.dry_run, fixture.reference).toBe(true);
      expect(plan.message, fixture.reference).toMatch(/Dry-run confirmed/i);
    }
  });

  it("covers saved-provider and missing-provider dry-run paths for each relevant flow", () => {
    for (const fixture of CONCIERGE_DRY_RUN_FIXTURES) {
      const missingProviderPlan = planConciergeConfirmedExecution({
        useCase: fixture.useCase,
        providerName: null,
        providerPhone: null,
        payload: fixture.actionPayload,
        summary: fixture.actionSummary,
        pendingStatus: "pending",
        now: "2026-07-16T10:00:00.000Z",
      });

      expect(missingProviderPlan.dry_run, fixture.reference).toBe(true);
      expect(missingProviderPlan.external_action_allowed, fixture.reference).toBe(false);

      if (conciergeFlowNeedsSavedProvider(fixture.reference)) {
        expect(missingProviderPlan.mode, fixture.reference).toBe("needs_info");
        expect(
          missingProviderPlan.missing_requirements.map((requirement) => requirement.key),
          fixture.reference,
        ).toContain("provider");
      } else {
        expect(
          missingProviderPlan.missing_requirements.map((requirement) => requirement.key),
          fixture.reference,
        ).not.toContain("provider");
      }
    }
  });

  it("builds trigger bodies that testers can submit without auto-starting live channels", () => {
    for (const fixture of CONCIERGE_DRY_RUN_FIXTURES) {
      const body = conciergeDryRunTriggerBody(fixture.reference);

      expect(body).toMatchObject({
        use_case: fixture.useCase,
        action_summary: fixture.actionSummary,
        action_payload: fixture.actionPayload,
        auto_start: false,
      });
      expect(isConciergeDryRunPayload(body.action_payload), fixture.reference).toBe(true);
    }
  });
});
