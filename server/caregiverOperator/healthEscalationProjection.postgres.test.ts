import fs from "node:fs";
import pg from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildHealthEscalationProjection,
  DurableHealthEscalationProjectionStore,
  type HealthEscalationCurrentDisclosureResolver,
} from "./healthEscalationProjection.js";
import {
  HEALTH_CAREGIVER_OPERATOR_ESCALATION,
  evaluateHealthEscalationAuthorization,
  type HealthEscalationConsent,
} from "./healthEscalationPolicy.js";

const migrationSql = fs.readFileSync(
  new URL("../../migrations/0082_health_caregiver_operator_escalation_projections.sql", import.meta.url),
  "utf8",
);

const task14PostgresUrl = process.env.TASK14_POSTGRES_URL;
const answerDigest = `sha256:${"a".repeat(64)}`;
const now = new Date("2026-08-08T12:00:00.000Z");

function assertScratchTask14Database(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//u, "");
  if (!databaseName.includes("task14") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 14 PostgreSQL tests require a scratch database name containing task14 and test/tmp/ci/scratch");
  }
}

const consent: HealthEscalationConsent = {
  caregiverProjectionAllowed: true,
  operatorProjectionAllowed: true,
  consentRevision: 2,
  approvalReference: "stage9-consent-pg",
};

const caregiverAccess = {
  targetUserId: "senior-pg",
  actorUserId: "caregiver-pg",
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
    currentOperatorRoles: options.currentOperatorRoles ?? { "operator-pg": "admin" as const },
    throwOnResolve: options.throwOnResolve ?? false,
  };
  const resolver: HealthEscalationCurrentDisclosureResolver = async (input) => {
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
    store: new DurableHealthEscalationProjectionStore(undefined, resolver),
    state,
  };
}

function decisionFor(input: {
  flowInstanceId: string;
  sourceEventId: string;
  completionReference: string;
}) {
  const authorization = evaluateHealthEscalationAuthorization({
    subjectUserId: "senior-pg",
    profileId: "senior-pg",
    targetAudience: "caregiver",
    targetActorId: "caregiver-pg",
    targetActorRole: "caregiver",
    purpose: HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose,
    flowId: "health.preventive_check",
    flowVersion: "1.0.0",
    flowInstanceId: input.flowInstanceId,
    sourceEventId: input.sourceEventId,
    completionReference: input.completionReference,
    answerDigest,
    requestedAt: now.toISOString(),
    consent,
    caregiverAccess,
  });
  if (!authorization.ok) throw new Error("valid projection fixture failed authorization");
  return authorization.decision;
}

function operatorDecisionFor(input: {
  flowInstanceId: string;
  sourceEventId: string;
  completionReference: string;
}) {
  const authorization = evaluateHealthEscalationAuthorization({
    subjectUserId: "senior-pg",
    profileId: "senior-pg",
    targetAudience: "operator",
    targetActorId: null,
    targetActorRole: "admin",
    purpose: HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose,
    flowId: "health.preventive_check",
    flowVersion: "1.0.0",
    flowInstanceId: input.flowInstanceId,
    sourceEventId: input.sourceEventId,
    completionReference: input.completionReference,
    answerDigest,
    requestedAt: now.toISOString(),
    consent,
    operatorAuthorization: {
      actorUserId: "operator-pg",
      actorRole: "admin",
      scope: "admin_health_escalation_queue",
    },
  });
  if (!authorization.ok) throw new Error("valid operator projection fixture failed authorization");
  return authorization.decision;
}

function projectionFor(input: {
  flowInstanceId?: string;
  sourceEventId?: string;
  completionReference?: string;
  sourceAlertId?: string | null;
} = {}) {
  const flowInstanceId = input.flowInstanceId ?? "flow-pg";
  const sourceEventId = input.sourceEventId ?? "event.health.preventive_check.completed.pg";
  const completionReference = input.completionReference ?? "completion-pg";
  return buildHealthEscalationProjection({
    subjectUserId: "senior-pg",
    profileId: "senior-pg",
    targetAudience: "caregiver",
    targetActorId: "caregiver-pg",
    targetActorRole: "caregiver",
    flowInstanceId,
    sourceEventId,
    sourceAlertId: input.sourceAlertId ?? null,
    completionReference,
    answerDigest,
    decision: decisionFor({ flowInstanceId, sourceEventId, completionReference }),
    now,
  });
}

function operatorProjectionFor(input: {
  flowInstanceId?: string;
  sourceEventId?: string;
  completionReference?: string;
  sourceAlertId?: string | null;
} = {}) {
  const flowInstanceId = input.flowInstanceId ?? "flow-pg-operator";
  const sourceEventId = input.sourceEventId ?? "event.health.preventive_check.completed.pg.operator";
  const completionReference = input.completionReference ?? "completion-pg-operator";
  return buildHealthEscalationProjection({
    subjectUserId: "senior-pg",
    profileId: "senior-pg",
    targetAudience: "operator",
    targetActorId: null,
    targetActorRole: "admin",
    flowInstanceId,
    sourceEventId,
    sourceAlertId: input.sourceAlertId ?? null,
    completionReference,
    answerDigest,
    decision: operatorDecisionFor({ flowInstanceId, sourceEventId, completionReference }),
    now,
  });
}

async function withClient<T>(operation: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!task14PostgresUrl) throw new Error("TASK14_POSTGRES_URL is required");
  assertScratchTask14Database(task14PostgresUrl);
  const client = new pg.Client({ connectionString: task14PostgresUrl });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

describe.runIf(task14PostgresUrl)("Task 14 PostgreSQL Health escalation projection store", () => {
  beforeEach(async () => {
    await withClient(async (client) => {
      await client.query(migrationSql);
      await client.query("delete from public.health_caregiver_operator_escalation_projections");
    });
  });

  it("requires authoritative baseline alert and queue tables for freeze proof", async () => {
    await withClient(async (client) => {
      const tables = await client.query<{
        caregiver_alerts: string | null;
        concierge_pending: string | null;
      }>(
        `select
           to_regclass('public.caregiver_alerts')::text as caregiver_alerts,
           to_regclass('public.concierge_pending')::text as concierge_pending`,
      );
      expect(tables.rows[0]?.caregiver_alerts).toBe("caregiver_alerts");
      expect(tables.rows[0]?.concierge_pending).toBe("concierge_pending");
    });
  });

  it("handles concurrent duplicate projection creation durably", async () => {
    const store = new DurableHealthEscalationProjectionStore();
    const projection = projectionFor();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.recordProjection(projection)),
    );

    expect(results.filter((result) => result.outcome === "stored")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "duplicate")).toHaveLength(9);
    expect(results.filter((result) => result.outcome === "rejected")).toHaveLength(0);

    await withClient(async (client) => {
      const count = await client.query<{ count: string }>(
        "select count(*)::text from public.health_caregiver_operator_escalation_projections where projection_id = $1",
        [projection.projectionId],
      );
      expect(count.rows[0]?.count).toBe("1");
    });
  });

  it("classifies repeated unique conflicts by semantic digest instead of overwriting durable rows", async () => {
    const store = new DurableHealthEscalationProjectionStore();
    const original = projectionFor();
    await store.recordProjection(original);
    const changed = projectionFor({ sourceAlertId: "alert-pg" });

    await expect(store.recordProjection(changed)).resolves.toEqual({
      outcome: "rejected",
      reason: "semantic_conflict",
    });

    await withClient(async (client) => {
      const row = await client.query<{ source_alert_id: string | null; semantic_digest: string }>(
        `select source_alert_id, semantic_digest
         from public.health_caregiver_operator_escalation_projections
         where projection_id = $1`,
        [original.projectionId],
      );
      expect(row.rows[0]).toEqual({
        source_alert_id: null,
        semantic_digest: original.semanticDigest,
      });
    });
  });

  it("leaves existing caregiver alert rows and concierge queue statuses unchanged", async () => {
    const store = new DurableHealthEscalationProjectionStore();
    let alertId = "";
    let pendingId = "";
    await withClient(async (client) => {
      await client.query("insert into public.profiles (id) values ('senior-pg') on conflict (id) do nothing");
      await client.query("delete from public.caregiver_alerts where user_id = 'senior-pg'");
      await client.query("delete from public.concierge_pending where user_id = 'senior-pg'");
      const alert = await client.query<{ id: string }>(
        `insert into public.caregiver_alerts (
           user_id, alert_type, severity, message, sent_to
         ) values (
           'senior-pg', 'task14_existing_alert', 'warning', 'Existing alert text', array['caregiver-pg']
         ) returning id`,
      );
      const pending = await client.query<{ id: string }>(
        `insert into public.concierge_pending (
           user_id, use_case, action_summary, action_payload, status
         ) values (
           'senior-pg', 'task14-existing-queue', 'Existing queue item', '{}'::jsonb, 'pending'
         ) returning id`,
      );
      alertId = alert.rows[0]!.id;
      pendingId = pending.rows[0]!.id;
    });

    await store.recordProjection(projectionFor({ sourceAlertId: alertId }));

    await withClient(async (client) => {
      const alert = await client.query<{
        alert_type: string;
        severity: string;
        message: string;
        resolved_at: Date | null;
      }>(
        `select alert_type, severity, message, resolved_at
         from public.caregiver_alerts
         where id = $1`,
        [alertId],
      );
      expect(alert.rows[0]).toEqual({
        alert_type: "task14_existing_alert",
        severity: "warning",
        message: "Existing alert text",
        resolved_at: null,
      });

      const pending = await client.query<{ status: string; action_summary: string }>(
        `select status, action_summary
         from public.concierge_pending
         where id = $1`,
        [pendingId],
      );
      expect(pending.rows[0]).toEqual({
        status: "pending",
        action_summary: "Existing queue item",
      });
    });
  });

  it("acknowledges once under concurrent replay and rejects cross-user attacks", async () => {
    const { store } = disclosureStore();
    const projection = projectionFor({
      flowInstanceId: "flow-pg-ack",
      sourceEventId: "event.health.preventive_check.completed.pg.ack",
      completionReference: "completion-pg-ack",
    });
    await store.recordProjection(projection);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.acknowledgeProjectionForAuthenticatedActor({
        projectionId: projection.projectionId,
        subjectUserId: "senior-pg",
        authenticatedActorUserId: "caregiver-pg",
        targetAudience: "caregiver",
        now,
      })),
    );
    expect(results.filter((result) => result.outcome === "acknowledged")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "duplicate")).toHaveLength(9);

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: projection.projectionId,
      subjectUserId: "senior-other",
      authenticatedActorUserId: "caregiver-pg",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });
  });

  it("suppresses durable disclosure and acknowledgement after current consent revocation", async () => {
    const { store, state } = disclosureStore();
    const projection = projectionFor({
      flowInstanceId: "flow-pg-revoked-read",
      sourceEventId: "event.health.preventive_check.completed.pg.revoked.read",
      completionReference: "completion-pg-revoked-read",
    });
    await store.recordProjection(projection);

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: projection.projectionId,
      subjectUserId: "senior-pg",
      authenticatedActorUserId: "caregiver-pg",
      targetAudience: "caregiver",
    })).resolves.toEqual(expect.objectContaining({
      projectionId: projection.projectionId,
    }));

    state.currentConsent = {
      ...consent,
      revokedAt: "2026-08-08T11:00:00.000Z",
    };

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: projection.projectionId,
      subjectUserId: "senior-pg",
      authenticatedActorUserId: "caregiver-pg",
      targetAudience: "caregiver",
    })).resolves.toBeNull();

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: projection.projectionId,
      subjectUserId: "senior-pg",
      authenticatedActorUserId: "caregiver-pg",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });

    await withClient(async (client) => {
      const row = await client.query<{ acknowledgement_state: string; status: string }>(
        `select acknowledgement_state, status
         from public.health_caregiver_operator_escalation_projections
         where projection_id = $1`,
        [projection.projectionId],
      );
      expect(row.rows[0]).toEqual({
        acknowledgement_state: "unacknowledged",
        status: "visible",
      });
    });
  });

  it("suppresses durable caregiver disclosure when current relationship access is unavailable", async () => {
    const { store, state } = disclosureStore();
    const projection = projectionFor({
      flowInstanceId: "flow-pg-caregiver-revoked",
      sourceEventId: "event.health.preventive_check.completed.pg.caregiver.revoked",
      completionReference: "completion-pg-caregiver-revoked",
    });
    await store.recordProjection(projection);
    state.currentCaregiverAccess = null;

    await expect(store.findVisibleForAuthenticatedActor({
      projectionId: projection.projectionId,
      subjectUserId: "senior-pg",
      authenticatedActorUserId: "caregiver-pg",
      targetAudience: "caregiver",
    })).resolves.toBeNull();

    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      projectionId: projection.projectionId,
      subjectUserId: "senior-pg",
      authenticatedActorUserId: "caregiver-pg",
      targetAudience: "caregiver",
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });
  });

  it("suppresses durable operator disclosure when current server role is unavailable", async () => {
    const { store, state } = disclosureStore();
    const projection = operatorProjectionFor();
    await store.recordProjection(projection);
    state.currentOperatorRoles = {};

    const forgedInput = {
      projectionId: projection.projectionId,
      subjectUserId: "senior-pg",
      authenticatedActorUserId: "operator-pg",
      targetAudience: "operator" as const,
      actorRole: "admin" as const,
    };

    await expect(store.findVisibleForAuthenticatedActor(forgedInput)).resolves.toBeNull();
    await expect(store.acknowledgeProjectionForAuthenticatedActor({
      ...forgedInput,
      now,
    })).resolves.toEqual({ outcome: "rejected", reason: "not_found" });

    await withClient(async (client) => {
      const row = await client.query<{ acknowledgement_state: string; status: string }>(
        `select acknowledgement_state, status
         from public.health_caregiver_operator_escalation_projections
         where projection_id = $1`,
        [projection.projectionId],
      );
      expect(row.rows[0]).toEqual({
        acknowledgement_state: "unacknowledged",
        status: "visible",
      });
    });
  });
});
