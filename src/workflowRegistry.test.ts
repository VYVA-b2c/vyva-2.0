import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import {
  APP_WORKFLOW_REFERENCES,
  WORKFLOW_DEFINITIONS,
  WORKFLOW_ACTION_LEVELS,
  WORKFLOW_ENTRY_POINTS,
  WORKFLOW_PARITY_STATUSES,
  WORKFLOW_PARITY_STATUS_LABELS,
  WORKFLOW_STATUSES,
  deduplicateWorkflowReferences,
  getWorkflowCoverageSummary,
  getWorkflowDefinition,
  getWorkflowEntryPoint,
  getWorkflowParityAudit,
  getWorkflowParityAuditSummary,
  getWorkflowParityBacklog,
  nextWorkflowImplementationCandidates,
  resolveWorkflowAction,
  validateWorkflowRegistry,
  workflowActionLevelForReference,
  workflowActionForEntryPoint,
  workflowActionsForTarget,
  workflowParityAuditForEntryPoint,
  workflowEntryPointsFor,
  workflowEntryPointsForSurface,
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

  it("surfaces the next incomplete implementation candidates from the registry", () => {
    const candidates = nextWorkflowImplementationCandidates(3);

    expect(candidates).toHaveLength(0);
    expect(candidates.every((candidate) => candidate.coverageState !== "complete")).toBe(true);
  });

  it("audits every mapped entry point for cross-pillar parity", () => {
    const audit = getWorkflowParityAudit();
    const auditedReferences = new Set(audit.map((item) => item.workflowReference));

    expect(audit).toHaveLength(WORKFLOW_DEFINITIONS.length);
    WORKFLOW_ENTRY_POINTS.forEach((entry) => {
      expect(auditedReferences.has(entry.workflow)).toBe(true);
      const item = workflowParityAuditForEntryPoint(entry.id);
      expect(WORKFLOW_PARITY_STATUSES).toContain(item.status);
      expect(item.affectedEntryPointIds).toContain(entry.id);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.nextStep.length).toBeGreaterThan(0);
      expect(item.backlogPriority).toBeGreaterThanOrEqual(1);
      expect(item.backlogPriority).toBeLessThanOrEqual(4);
    });
  });

  it("keeps tool-dependent flows visible as a service-readiness backlog", () => {
    const backlog = getWorkflowParityBacklog(20);
    const backlogReferences = backlog.map((item) => item.workflowReference);

    [
      CONCIERGE_FLOW_REFERENCES.scamCheck,
      CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
      CONCIERGE_FLOW_REFERENCES.shoppingSupport,
      CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    ].forEach((reference) => {
      expect(backlogReferences).toContain(reference);
      expect(getWorkflowParityAudit().find((item) => item.workflowReference === reference)?.status).toBe("needs_tool_service");
    });

    expect(backlog).toEqual([...backlog].sort((left, right) => (
      left.backlogPriority !== right.backlogPriority
        ? left.backlogPriority - right.backlogPriority
        : left.domain !== right.domain
          ? left.domain.localeCompare(right.domain)
          : left.title.localeCompare(right.title)
    )));
  });

  it("summarizes parity statuses without losing the shared label set", () => {
    const summary = getWorkflowParityAuditSummary();

    expect(Object.keys(WORKFLOW_PARITY_STATUS_LABELS).sort()).toEqual([...WORKFLOW_PARITY_STATUSES].sort());
    expect(WORKFLOW_PARITY_STATUSES.reduce((total, status) => total + summary.byStatus[status], 0)).toBe(summary.total);
    expect(summary.ready).toBeGreaterThan(0);
    expect(summary.blocked).toBeGreaterThan(0);
    expect(summary.byDomain.concierge.needs_tool_service).toBeGreaterThan(0);
    expect(summary.byDomain.game.ready).toBeGreaterThan(0);
  });
});
