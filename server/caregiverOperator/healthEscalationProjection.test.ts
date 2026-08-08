import { describe, expect, it } from "vitest";
import {
  buildHealthEscalationProjection,
  InMemoryHealthEscalationProjectionStore,
  recordPreventiveHealthEscalationProjections,
  recordHealthEscalationProjection,
  type HealthEscalationCurrentDisclosureResolver,
} from "./healthEscalationProjection.js";
import {
  HEALTH_CAREGIVER_OPERATOR_ESCALATION,
  evaluateHealthEscalationAuthorization,
  type HealthEscalationConsent,
} from "./healthEscalationPolicy.js";

const answerDigest = `sha256:${"a".repeat(64)}`;
const now = new Date("2026-08-08T10:00:00.000Z");

const consent: HealthEscalationConsent = {
  caregiverProjectionAllowed: true,
  operatorProjectionAllowed: true,
  consentRevision: 1,
  approvalReference: "stage9-consent-1",
};

const caregiverAccess = {
  targetUserId: "senior-1",
  actorUserId: "caregiver-1",
  actorRole: "caregiver",
  isOwnProfile: false,
  isAdmin: false,
  domain: "health",
  permissions: { view_vitals: true },
} as const;

type OperatorRoles = Partial<Record<string, "admin" | "operator">>;

function disclosureStore(options: {
  currentConsent?: HealthEscalationConsent;
  currentCaregiverAccess?: typeof caregiverAccess | null;
  currentOperatorRoles?: OperatorRoles;
  throwOnResolve?: boolean;
} = {}) {
  const state = {
    currentConsent: options.currentConsent ?? { ...consent },
    currentCaregiverAccess: options.currentCaregiverAccess ?? caregiverAccess,
    currentOperatorRoles: options.currentOperatorRoles ?? { "operator-1": "admin" as const },
    throwOnResolve: options.throwOnResolve ?? false,
    resolverCalls: 0,
  };

  const resolver: HealthEscalationCurrentDisclosureResolver = async (input) => {
    state.resolverCalls += 1;
    if (state.throwOnResolve) {
      throw new Error("current disclosure authorization unavailable");
    }
    if (state.currentConsent.revokedAt) {
      return { authorized: false, reasonCode: "consent_revoked" };
    }
    if (input.targetAudience === "caregiver") {
      if (state.currentConsent.caregiverProjectionAllowed !== true) {
        return { authorized: false, reasonCode: "consent_unavailable" };
      }
      const access = state.currentCaregiverAccess;
      if (
        !access ||
        access.actorUserId !== input.authenticatedActorUserId ||
        access.targetUserId !== input.subjectUserId ||
        access.domain !== "health" ||
        access.permissions.view_vitals !== true ||
        access.isOwnProfile ||
        access.isAdmin
      ) {
        return { authorized: false, reasonCode: "caregiver_access_denied" };
      }
      return {
        authorized: true,
        actorRole: access.actorRole,
        currentConsent: state.currentConsent,
      };
    }

    if (state.currentConsent.operatorProjectionAllowed !== true) {
      return { authorized: false, reasonCode: "consent_unavailable" };
    }
    const actorRole = state.currentOperatorRoles[input.authenticatedActorUserId];
    if (!actorRole) {
      return { authorized: false, reasonCode: "operator_role_denied" };
    }
    return {
      authorized: true,
      actorRole,
      currentConsent: state.currentConsent,
    };
  };

  return {
    store: new InMemoryHealthEscalationProjectionStore(resolver),
    state,
  };
}

function validInput(store: InMemoryHealthEscalationProjectionStore) {
  return {
    store,
    subjectUserId: "senior-1",
    profileId: "senior-1",
    targetAudience: "caregiver" as const,
    targetActorId: "caregiver-1",
    targetActorRole: "caregiver" as const,
    flowInstanceId: "flow-1",
    sourceEventId: "event.health.preventive_check.completed.1",
    sourceAlertId: null,
    completionReference: "completion-1",
    answerDigest,
    requestedAt: now,
    consent,
    caregiverAccess,
  };
}

function validOperatorInput(store: InMemoryHealthEscalationProjectionStore) {
  return {
    store,
    subjectUserId: "senior-1",
    profileId: "senior-1",
    targetAudience: "operator" as const,
    targetActorId: null,
    targetActorRole: "admin" as const,
    flowInstanceId: "flow-1",
    sourceEventId: "event.health.preventive_check.completed.1",
    sourceAlertId: null,
    completionReference: "completion-1",
    answerDigest,
    requestedAt: now,
    consent,
    operatorAuthorization: {
      actorUserId: "operator-1",
      actorRole: "admin" as const,
      scope: "admin_health_escalation_queue" as const,
    },
  };
}

describe("Task 14 Health escalation projection store", () => {
  it("preserves rollback behavior by creating no projections when the Stage 9 flag is disabled", async () => {
    const store = new InMemoryHealthEscalationProjectionStore();
    const result = await recordPreventiveHealthEscalationProjections({
      accountUserId: "senior-1",
      userId: "senior-1",
      profileId: "senior-1",
      sessionId: "flow-1",
      profile: { name: "Test" },
      result: {
        feeling_label: "Needs follow-up",
        overall_state: "moderate",
        vyva_reading: "Reading",
        right_now: [],
        today_actions: [],
        highlight: "Flagged",
        flag_caregiver: true,
        watch_for: null,
      },
      completionReference: "completion-1",
      answerDigest,
      flowInstanceId: "flow-1",
      sourceEventId: "event.health.preventive_check.completed.1",
      completedAt: now,
      env: {},
      store,
    });

    expect(result.flagResolution.effectiveMode).toBe("disabled");
    expect(result.caregiverOutcomes).toEqual([]);
    expect(result.operatorOutcome).toBeNull();
  });

  it("stores one projection and treats duplicate escalation as idempotent", async () => {
    const { store } = disclosureStore();
    const first = await recordHealthEscalationProjection(validInput(store));
    const second = await recordHealthEscalationProjection(validInput(store));

    expect(first.outcome).toBe("stored");
    expect(second.outcome).toBe("duplicate");
    if (first.outcome !== "stored" || second.outcome !== "duplicate") return;
    expect(second.projection.projectionId).toBe(first.projection.projectionId);
    expect(second.projection.semanticDigest).toBe(first.projection.semanticDigest);
  });

  it("does not create readable projections for denied escalation decisions", async () => {
    const { store } = disclosureStore();
    const denied = await recordHealthEscalationProjection({
      ...validInput(store),
      consent: {
        caregiverProjectionAllowed: false,
        operatorProjectionAllowed: false,
      },
    });

    expect(denied.outcome).toBe("denied");
    const guessed = await store.findVisibleForAuthenticatedActor({
      projectionId: "health.escalation.projection.guessed",
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
    });
    expect(guessed).toBeNull();
  });

  it("prevents cross-user and wrong-actor visibility by exact projection scope", async () => {
    const { store } = disclosureStore();
    const result = await recordHealthEscalationProjection(validInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-2",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
    })).resolves.toBeNull();

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-2",
      targetAudience: "caregiver",
    })).resolves.toBeNull();
  });

  it("requires current Stage 9 consent before caregiver disclosure", async () => {
    const { store, state } = disclosureStore();
    const result = await recordHealthEscalationProjection(validInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
    })).resolves.toEqual(expect.objectContaining({
      projectionId: result.projection.projectionId,
    }));

    state.currentConsent = {
      ...consent,
      revokedAt: "2026-08-08T09:00:00.000Z",
    };

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
    })).resolves.toBeNull();

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });
  });

  it("fails closed when current disclosure consent cannot be resolved", async () => {
    const { store, state } = disclosureStore();
    const result = await recordHealthEscalationProjection(validInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    state.throwOnResolve = true;

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
    })).resolves.toBeNull();

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });
  });

  it("does not treat unrelated engagement consent as Stage 9 disclosure consent", async () => {
    const { store, state } = disclosureStore();
    const result = await recordHealthEscalationProjection(validInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    state.currentConsent = {
      caregiverProjectionAllowed: false,
      operatorProjectionAllowed: false,
      consentRevision: 5,
      approvalReference: "unrelated-push-call-memory-consent",
    };

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
    })).resolves.toBeNull();

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });
  });

  it("requires current caregiver domain access before disclosure", async () => {
    const { store, state } = disclosureStore();
    const result = await recordHealthEscalationProjection(validInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    state.currentCaregiverAccess = null;

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
    })).resolves.toBeNull();

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });
  });

  it("allows operator visibility only after current server-owned role resolution", async () => {
    const { store } = disclosureStore();
    const result = await recordHealthEscalationProjection(validOperatorInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "operator-1",
      targetAudience: "operator",
    })).resolves.toEqual(expect.objectContaining({
      projectionId: result.projection.projectionId,
    }));

    const forgedOrdinaryUserInput = {
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "ordinary-1",
      targetAudience: "operator" as const,
      actorRole: "admin" as const,
    };
    await expect(store.findVisibleForAuthenticatedActor(forgedOrdinaryUserInput)).resolves.toBeNull();

    const forgedCaregiverInput = {
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "operator" as const,
      actorRole: "operator" as const,
    };
    await expect(store.findVisibleForAuthenticatedActor(forgedCaregiverInput)).resolves.toBeNull();
  });

  it("requires current operator/admin role before acknowledgement", async () => {
    const { store, state } = disclosureStore();
    const result = await recordHealthEscalationProjection(validOperatorInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "operator-1",
      targetAudience: "operator",
      now,
    })).resolves.toEqual(expect.objectContaining({ outcome: "acknowledged" }));

    const second = await recordHealthEscalationProjection({
      ...validOperatorInput(store),
      flowInstanceId: "flow-operator-revoked",
      sourceEventId: "event.health.preventive_check.completed.operator.revoked",
      completionReference: "completion-operator-revoked",
    });
    expect(second.outcome).toBe("stored");
    if (second.outcome !== "stored") return;

    state.currentOperatorRoles = {};
    const forgedInput = {
      projectionId: second.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "operator-1",
      targetAudience: "operator" as const,
      actorRole: "admin" as const,
      now,
    };

    await expect(store.findVisibleForAuthenticatedActor(forgedInput)).resolves.toBeNull();
    await expect(store.acknowledgeProjectionForAuthenticatedActor(forgedInput)).resolves.toEqual({
      outcome: "rejected",
      reason: "not_found",
    });
  });

  it("acknowledges as a distinct auditable action and keeps duplicate acknowledgement idempotent", async () => {
    const { store } = disclosureStore();
    const result = await recordHealthEscalationProjection(validInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    const firstAck = await store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
      now,
    });
    const secondAck = await store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
      now,
    });

    expect(firstAck.outcome).toBe("acknowledged");
    expect(secondAck.outcome).toBe("duplicate");
    if (firstAck.outcome !== "acknowledged" || secondAck.outcome !== "duplicate") return;
    expect(firstAck.projection.acknowledgementState).toBe("acknowledged");
    expect(firstAck.projection.acknowledgedBy).toBe("caregiver-1");
    expect(secondAck.projection.acknowledgementId).toBe(firstAck.projection.acknowledgementId);
    expect(firstAck.projection.flowInstanceId).toBe(result.projection.flowInstanceId);
    expect(firstAck.projection.sourceEventId).toBe(result.projection.sourceEventId);
  });

  it("uses generic acknowledgement denial for wrong actor, cross-user and revoked-consent probes", async () => {
    const { store, state } = disclosureStore();
    const result = await recordHealthEscalationProjection(validInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-2",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-2",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });

    state.currentConsent = {
      ...consent,
      revokedAt: "2026-08-08T09:00:00.000Z",
    };
    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: result.projection.projectionId,
      subjectUserId: "senior-1",
      authenticatedActorUserId: "caregiver-1",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });
  });

  it("classifies same idempotency key with changed semantic content as conflict", async () => {
    const { store } = disclosureStore();
    const first = await recordHealthEscalationProjection(validInput(store));
    expect(first.outcome).toBe("stored");
    if (first.outcome !== "stored") return;

    const authorization = evaluateHealthEscalationAuthorization({
      subjectUserId: "senior-1",
      profileId: "senior-1",
      targetAudience: "caregiver",
      targetActorId: "caregiver-1",
      targetActorRole: "caregiver",
      purpose: HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose,
      flowId: "health.preventive_check",
      flowVersion: "1.0.0",
      flowInstanceId: "flow-1",
      sourceEventId: "event.health.preventive_check.completed.1",
      completionReference: "completion-1",
      answerDigest,
      requestedAt: now.toISOString(),
      consent,
      caregiverAccess,
    });
    expect(authorization.ok).toBe(true);
    if (!authorization.ok) return;
    const changed = buildHealthEscalationProjection({
      subjectUserId: "senior-1",
      profileId: "senior-1",
      targetAudience: "caregiver",
      targetActorId: "caregiver-1",
      targetActorRole: "caregiver",
      flowInstanceId: "flow-1",
      sourceEventId: "event.health.preventive_check.completed.1",
      sourceAlertId: "alert-1",
      completionReference: "completion-1",
      answerDigest,
      decision: authorization.decision,
      now,
    });

    await expect(store.recordProjection(changed)).resolves.toEqual({
      outcome: "rejected",
      reason: "semantic_conflict",
    });
  });

  it("keeps projection summaries minimized and free of raw Health answer text", async () => {
    const { store } = disclosureStore();
    const result = await recordHealthEscalationProjection(validInput(store));
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") return;
    const serialized = JSON.stringify(result.projection.safeSummary);
    expect(serialized).toContain("preventive_health_result_flagged_caregiver");
    expect(serialized).not.toContain("I feel dizzy and scared");
    expect(result.projection.safeSummary.rawHealthAnswerContentRetained).toBe(false);
  });
});
