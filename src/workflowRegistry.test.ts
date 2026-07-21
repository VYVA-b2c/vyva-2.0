import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import {
  APP_WORKFLOW_REFERENCES,
  WORKFLOW_DEFINITIONS,
  WORKFLOW_ACTION_LEVELS,
  WORKFLOW_ENTRY_POINTS,
  WORKFLOW_STATUSES,
  deduplicateWorkflowReferences,
  getWorkflowCoverageSummary,
  getWorkflowDefinition,
  getWorkflowEntryPoint,
  nextWorkflowImplementationCandidates,
  resolveWorkflowAction,
  validateWorkflowRegistry,
  workflowActionLevelForReference,
  workflowActionForEntryPoint,
  workflowActionsForTarget,
  workflowFlowMatrixRows,
  workflowEntryPointsFor,
  workflowEntryPointsForSurface,
  workflowProfileDataSourceLabels,
  workflowProfileDataSources,
  workflowReadinessChecklistRows,
  workflowSetupFallbackChoices,
} from "../shared/workflowRegistry";

describe("cross-app workflow registry", () => {
  it("has no duplicate or dangling workflow map entries", () => {
    expect(validateWorkflowRegistry()).toEqual({
      duplicateWorkflowReferences: [],
      duplicateEntryPointIds: [],
      missingWorkflowReferences: [],
      entryPointsWithoutSuggestedFlow: [],
      workflowsWithoutEntryPoint: [],
    });
  });

  it("covers the visible Home cards and rotating Fast help actions", () => {
    const ids = new Set(WORKFLOW_ENTRY_POINTS.map((entry) => entry.id));

    [
      "home.card.health",
      "home.card.mind-memory",
      "home.card.community",
      "home.card.concierge",
      "home.fast.symptoms",
      "home.fast.age-well",
      "home.fast.find-care",
      "home.fast.book-ride",
      "home.fast.paperwork-help",
      "home.fast.safe-home",
    ].forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it("covers health, medication, learning, community, room, and game surfaces", () => {
    expect(workflowEntryPointsForSurface("health_action").length).toBeGreaterThanOrEqual(4);
    expect(workflowEntryPointsForSurface("learning_action").length).toBeGreaterThanOrEqual(6);
    expect(workflowEntryPointsForSurface("room_action").length).toBeGreaterThanOrEqual(20);
    expect(workflowEntryPointsForSurface("game_action").length).toBeGreaterThanOrEqual(18);

    [
      "health.card.symptoms",
      "health.action.show-vyva",
      "health.fast.book-medical",
      "meds.card.my-medicines",
      "meds.fast.refill-help",
      "learn.action.today-lesson",
      "community.card.activities",
      "room.list.open",
      "together.action.share-plan",
      "music.action.share-song",
      "game.remember-later",
      "game.listen-closely",
      "game.breath-garden",
      "game.scent-memory",
    ].forEach((id) => expect(getWorkflowEntryPoint(id).id).toBe(id));

    expect(getWorkflowEntryPoint("room.list.open").route).toBe("/social-rooms/join-in");
    expect(getWorkflowEntryPoint("scam.action.show-vyva").route).toBe("/scam-guard");
    expect(getWorkflowEntryPoint("safe-home.action.show-vyva").route).toBe("/safe-home");
  });

  it("deduplicates repeated entry points that lead to the same underlying flow", () => {
    const rideReferences = [
      getWorkflowEntryPoint("home.fast.book-ride").workflow,
      getWorkflowEntryPoint("concierge.action.transport").workflow,
    ];
    expect(deduplicateWorkflowReferences(rideReferences)).toEqual([
      CONCIERGE_FLOW_REFERENCES.transportBooking,
    ]);

    const medicationReferences = [
      getWorkflowEntryPoint("health.card.medication").workflow,
      getWorkflowEntryPoint("health.action.medicine").workflow,
      getWorkflowEntryPoint("meds.card.my-medicines").workflow,
    ];
    expect(deduplicateWorkflowReferences(medicationReferences)).toEqual([
      APP_WORKFLOW_REFERENCES.medicationPlan,
    ]);
  });

  it("keeps shared concierge flows available from non-concierge surfaces", () => {
    expect(workflowEntryPointsFor(CONCIERGE_FLOW_REFERENCES.careNavigation).map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "home.fast.find-care",
        "health.fast.find-specialist",
        "concierge.fast.find-specialist",
        "concierge.fast.find-residence",
        "concierge.action.care-navigation",
      ]),
    );
    expect(workflowEntryPointsFor(CONCIERGE_FLOW_REFERENCES.medicalAppointment).map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["health.fast.book-medical", "concierge.fast.book-medical", "concierge.action.medical-appointment"]),
    );
    expect(getWorkflowDefinition(CONCIERGE_FLOW_REFERENCES.otcPharmacy).confirmationRule).toContain("non-prescription");
  });

  it("covers visible Concierge fast-help actions as real workflow entry points", () => {
    [
      ["concierge.fast.safe-home", CONCIERGE_FLOW_REFERENCES.safeHomeSupport],
      ["concierge.fast.paperwork-help", CONCIERGE_FLOW_REFERENCES.insuranceAdmin],
      ["concierge.fast.find-plumber", CONCIERGE_FLOW_REFERENCES.homeService],
      ["concierge.fast.check-scam", CONCIERGE_FLOW_REFERENCES.scamCheck],
      ["concierge.fast.book-ride", CONCIERGE_FLOW_REFERENCES.transportBooking],
      ["concierge.fast.order-groceries", CONCIERGE_FLOW_REFERENCES.shoppingSupport],
      ["concierge.fast.otc-pharmacy", CONCIERGE_FLOW_REFERENCES.otcPharmacy],
      ["concierge.fast.find-specialist", CONCIERGE_FLOW_REFERENCES.careNavigation],
      ["concierge.fast.find-residence", CONCIERGE_FLOW_REFERENCES.careNavigation],
      ["concierge.fast.book-medical", CONCIERGE_FLOW_REFERENCES.medicalAppointment],
      ["concierge.fast.government-help", CONCIERGE_FLOW_REFERENCES.insuranceAdmin],
      ["concierge.fast.prepared-meals", CONCIERGE_FLOW_REFERENCES.shoppingSupport],
    ].forEach(([id, reference]) => {
      const entry = getWorkflowEntryPoint(id);
      expect(entry.workflow).toBe(reference);
      expect(entry.surface).toBe("fast_help");
      expect(entry.source).toBe("ConciergeScreen");
      expect(entry.suggestedFlow).toMatch(/confirm|before|ask|prepare/i);
    });
  });

  it("maps all game routes that are visible from Mind and Memory", () => {
    const routes = new Set(WORKFLOW_ENTRY_POINTS.map((entry) => entry.route).filter(Boolean));

    [
      "/memory-games",
      "/memory-games/memory_match",
      "/memory-games/word_recall",
      "/memory-games/remember-later",
      "/memory-games/curious-minds",
      "/attention-boosters/rhythm-tap",
      "/executive-function/number-trails",
      "/executive-function/category-sort",
      "/face-name-match",
      "/senses/listen-closely",
      "/senses/breath-garden",
      "/senses/scent-memory",
    ].forEach((route) => expect(routes.has(route)).toBe(true));
  });

  it("resolves key UI actions into workflow metadata", () => {
    const checks = [
      ["home.fast.book-ride", CONCIERGE_FLOW_REFERENCES.transportBooking],
      ["health.fast.book-medical", CONCIERGE_FLOW_REFERENCES.medicalAppointment],
      ["meds.fast.refill-help", CONCIERGE_FLOW_REFERENCES.otcPharmacy],
      ["learn.action.today-lesson", APP_WORKFLOW_REFERENCES.learningTodayLesson],
      ["community.card.activities", APP_WORKFLOW_REFERENCES.communityActivities],
      ["game.listen-closely", APP_WORKFLOW_REFERENCES.gameListenClosely],
      ["concierge.action.transport", CONCIERGE_FLOW_REFERENCES.transportBooking],
    ] as const;

    checks.forEach(([entryPointId, workflowReference]) => {
      const action = workflowActionForEntryPoint(entryPointId);
      expect(action.workflowReference).toBe(workflowReference);
      expect(action.workflowTitle.length).toBeGreaterThan(0);
      expect(action.suggestedFlow.length).toBeGreaterThan(0);
      expect(action.nextStep.length).toBeGreaterThan(0);
      expect(action.completionState.length).toBeGreaterThan(0);
      expect(WORKFLOW_ACTION_LEVELS).toContain(action.actionLevel);
      expect(action.actionLevelLabel.length).toBeGreaterThan(0);
      expect(action.actionLevelRule.length).toBeGreaterThan(0);
    });
  });

  it("classifies workflows by reusable action level", () => {
    expect(workflowActionLevelForReference(APP_WORKFLOW_REFERENCES.homeHub)).toBe("light");
    expect(workflowActionLevelForReference(APP_WORKFLOW_REFERENCES.gameScentMemory)).toBe("light");
    expect(workflowActionLevelForReference(APP_WORKFLOW_REFERENCES.symptomCheck)).toBe("guided");
    expect(workflowActionLevelForReference(APP_WORKFLOW_REFERENCES.trustedProviders)).toBe("setup");
    expect(workflowActionLevelForReference(APP_WORKFLOW_REFERENCES.doctorNextStep)).toBe("external_action");
    expect(workflowActionLevelForReference(CONCIERGE_FLOW_REFERENCES.transportBooking)).toBe("external_action");
  });

  it("resolves precise targets and refuses ambiguous matches", () => {
    expect(resolveWorkflowAction({
      source: "HomeScreen",
      surface: "fast_help",
      label: "Book Ride",
    })?.workflowReference).toBe(CONCIERGE_FLOW_REFERENCES.transportBooking);

    expect(resolveWorkflowAction({ route: "/concierge" })).toBeNull();

    expect(workflowActionsForTarget({
      source: "HomeScreen",
      surface: "fast_help",
    }).map((action) => action.entryPointId)).toEqual([
      "home.fast.symptoms",
      "home.fast.age-well",
      "home.fast.find-care",
      "home.fast.book-ride",
      "home.fast.paperwork-help",
      "home.fast.safe-home",
    ]);
  });

  it("summarizes complete, partial, and missing coverage by area", () => {
    const summary = getWorkflowCoverageSummary();

    expect(summary.workflows.total).toBe(WORKFLOW_DEFINITIONS.length);
    expect(summary.entryPoints.total).toBe(WORKFLOW_ENTRY_POINTS.length);
    expect(summary.workflows.complete + summary.workflows.partial + summary.workflows.missing).toBe(summary.workflows.total);
    expect(summary.entryPoints.complete + summary.entryPoints.partial + summary.entryPoints.missing).toBe(summary.entryPoints.total);
    expect(summary.byDomain.health.total).toBeGreaterThan(0);
    expect(summary.byDomain.concierge.total).toBeGreaterThan(0);
    expect(summary.bySurface.fast_help.total).toBeGreaterThan(0);
    expect(summary.bySurface.game_action.total).toBeGreaterThan(0);
    expect(WORKFLOW_ACTION_LEVELS.reduce((total, level) => total + summary.byActionLevel[level], 0)).toBe(summary.workflows.total);
    expect(summary.byActionLevel.light).toBeGreaterThan(0);
    expect(summary.byActionLevel.guided).toBeGreaterThan(0);
    expect(summary.byActionLevel.external_action).toBeGreaterThan(0);
    expect(summary.byActionLevel.setup).toBeGreaterThan(0);
    expect(WORKFLOW_STATUSES.reduce((total, status) => total + summary.byStatus[status], 0)).toBe(summary.workflows.total);
    expect(summary.partialWorkflows).not.toContain(APP_WORKFLOW_REFERENCES.medicationResearch);
    expect(summary.partialWorkflows).not.toContain(APP_WORKFLOW_REFERENCES.learningReadAloud);
  });

  it("builds a cross-pillar flow matrix with setup, fallback, options, receipts, and resume behavior", () => {
    const rows = workflowFlowMatrixRows();

    expect(rows).toHaveLength(WORKFLOW_DEFINITIONS.length);
    for (const row of rows) {
      expect(row.currentStatusLabel).toMatch(/Ready|Partial|UI only|Blocked/);
      expect(row.requiredSetup.length).toBeGreaterThan(0);
      expect(row.missingSetupFallback.length).toBeGreaterThan(0);
      expect(row.findOptionsPath.length).toBeGreaterThan(0);
      expect(row.confirmationRule.length).toBeGreaterThan(0);
      expect(row.receiptMoment.length).toBeGreaterThan(0);
      expect(row.resumeBehavior.length).toBeGreaterThan(0);
      expect(row.profileDataSourceLabels, row.reference).not.toBe("none");
      expect(row.profileDataSources, row.reference).not.toContain("none");
    }

    const ride = rows.find((row) => row.reference === CONCIERGE_FLOW_REFERENCES.transportBooking);
    expect(ride?.requiredSetup).toContain("saved transport");
    expect(ride?.missingSetupFallback).toContain("add usual provider");
    expect(ride?.findOptionsPath).toContain("proximity");
    expect(ride?.receiptMoment).toContain("receipt");
    expect(ride?.resumeBehavior).toContain("pending task");

    const learning = rows.find((row) => row.reference === APP_WORKFLOW_REFERENCES.learningTodayLesson);
    expect(learning?.findOptionsPath).toContain("in-app options");

    const safeHome = rows.find((row) => row.reference === CONCIERGE_FLOW_REFERENCES.safeHomeSupport);
    expect(safeHome?.requiredSetup).toContain("trusted contact");
    expect(safeHome?.findOptionsPath).toContain("proximity");
  });

  it("derives consistent missing-setup choices for provider-backed flows", () => {
    const rideChoices = workflowSetupFallbackChoices(CONCIERGE_FLOW_REFERENCES.transportBooking, {
      returnTo: "/concierge?task=ride",
    });

    expect(rideChoices.map((choice) => choice.kind)).toEqual([
      "add_provider",
      "find_options",
      "ask_family",
      "operator_review",
    ]);
    expect(rideChoices.find((choice) => choice.kind === "add_provider")).toMatchObject({
      label: "Add usual transport / taxi",
      route: "/onboarding/profile/providers",
      state: expect.objectContaining({
        setupFocus: "transport",
        returnTo: "/concierge?task=ride",
      }),
    });
    expect(rideChoices.find((choice) => choice.kind === "find_options")?.description).toContain("proximity");
    expect(rideChoices.find((choice) => choice.kind === "ask_family")).toMatchObject({
      route: "/onboarding/profile/care-team",
    });

    const doctorChoices = workflowSetupFallbackChoices(APP_WORKFLOW_REFERENCES.doctorNextStep, {
      returnTo: "/health/doctor",
    });
    expect(doctorChoices.map((choice) => choice.kind)).toEqual([
      "ask_detail",
      "add_provider",
      "find_options",
      "ask_family",
    ]);
    expect(doctorChoices.find((choice) => choice.kind === "add_provider")).toMatchObject({
      label: "Add usual doctor / clinic",
      route: "/onboarding/profile/providers",
      state: expect.objectContaining({ setupFocus: "doctor_clinic" }),
    });

    const safeHomeChoices = workflowSetupFallbackChoices(CONCIERGE_FLOW_REFERENCES.safeHomeSupport, {
      returnTo: "/safe-home",
    });
    expect(safeHomeChoices.map((choice) => choice.kind)).toEqual([
      "ask_detail",
      "add_trusted_contact",
      "find_options",
      "ask_family",
      "operator_review",
    ]);
    expect(safeHomeChoices.find((choice) => choice.kind === "add_trusted_contact")).toMatchObject({
      label: "Add trusted contact",
      route: "/onboarding/profile/care-team",
    });
  });

  it("derives non-provider fallbacks without forcing provider setup", () => {
    const visualScanChoices = workflowSetupFallbackChoices(APP_WORKFLOW_REFERENCES.visualScan);
    expect(visualScanChoices.map((choice) => choice.kind)).toEqual([
      "ask_detail",
      "choose_input_type",
      "operator_review",
    ]);
    expect(visualScanChoices.some((choice) => choice.kind === "add_provider")).toBe(false);

    const learningChoices = workflowSetupFallbackChoices(APP_WORKFLOW_REFERENCES.learningTodayLesson);
    expect(learningChoices).toEqual([
      expect.objectContaining({
        kind: "open_existing_screen",
        route: "/learn",
      }),
    ]);

    const homeChoices = workflowSetupFallbackChoices(APP_WORKFLOW_REFERENCES.homeHub);
    expect(homeChoices).toEqual([
      expect.objectContaining({
        kind: "none",
      }),
    ]);
  });

  it("keeps every external-action flow behind readiness, confirmation, receipt, and resume gates", () => {
    const rows = workflowReadinessChecklistRows();
    const externalRows = rows.filter((row) => row.actionLevel === "external_action");

    expect(externalRows.length).toBeGreaterThan(0);
    for (const row of externalRows) {
      expect(row.needsAttention, row.reference).toEqual([]);
      expect(row.gates.map((gate) => gate.kind)).toEqual([
        "setup_fallback",
        "tool_readiness",
        "profile_data",
        "confirmation",
        "receipt",
        "resume",
      ]);
      expect(row.gates.find((gate) => gate.kind === "tool_readiness")?.detail, row.reference).toMatch(/Requires/);
      expect(row.gates.find((gate) => gate.kind === "confirmation")?.detail, row.reference).toMatch(/Confirm|Ask|Never|Check/i);
      expect(row.gates.find((gate) => gate.kind === "receipt")?.detail, row.reference).toMatch(/receipt|saved|shown|prepared|captured|confirmed/i);
      expect(row.gates.find((gate) => gate.kind === "resume")?.detail, row.reference).toMatch(/Resume|Return|Stay|reopen/i);
    }
  });

  it("keeps every mapped workflow free of readiness gaps", () => {
    const rows = workflowReadinessChecklistRows();

    expect(rows).toHaveLength(WORKFLOW_DEFINITIONS.length);
    for (const row of rows) {
      expect(row.needsAttention, row.reference).toEqual([]);
      expect(row.gates.map((gate) => gate.kind)).toEqual(
        row.actionLevel === "external_action"
          ? ["setup_fallback", "tool_readiness", "profile_data", "confirmation", "receipt", "resume"]
          : ["setup_fallback", "profile_data", "confirmation", "receipt", "resume"],
      );
    }
  });

  it("makes profile data feeds explicit across pillars", () => {
    expect(workflowProfileDataSources(CONCIERGE_FLOW_REFERENCES.transportBooking)).toEqual([
      "trusted_providers",
      "mobility",
      "home_address",
      "basic_profile",
    ]);
    expect(workflowProfileDataSources(CONCIERGE_FLOW_REFERENCES.shoppingSupport)).toEqual([
      "home_address",
      "basic_profile",
    ]);
    expect(workflowProfileDataSources(APP_WORKFLOW_REFERENCES.medicationAdherence)).toEqual([
      "medications",
    ]);
    expect(workflowProfileDataSources(APP_WORKFLOW_REFERENCES.vitalsTracking)).toEqual([
      "health_profile",
      "vitals",
    ]);
    expect(workflowProfileDataSourceLabels(APP_WORKFLOW_REFERENCES.learningPlan)).toContain("learning interests");
    expect(workflowProfileDataSourceLabels(APP_WORKFLOW_REFERENCES.visualScan)).toContain("care team");
  });

  it("surfaces the next incomplete implementation candidates from the registry", () => {
    const candidates = nextWorkflowImplementationCandidates(3);

    expect(candidates).toHaveLength(0);
    expect(candidates.every((candidate) => candidate.coverageState !== "complete")).toBe(true);
  });
});
