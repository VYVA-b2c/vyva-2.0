import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  canonicalContractProjection,
  canonicalSha256,
  descriptorSafeDeepInertClone,
} from "../orchestrator/eventStateCanonicalJson.js";
import type {
  PreventiveHealthMemoryProposalInput,
  PreventiveHealthResult,
} from "../health/preventiveHealthOrchestrator.js";
import {
  PREVENTIVE_HEALTH_FLOW_ID,
  PREVENTIVE_HEALTH_FLOW_VERSION,
} from "../health/preventiveHealthFlow.js";
import { profileMemberships, profiles, teamInvitations, users } from "../../shared/schema.js";
import {
  HEALTH_CAREGIVER_OPERATOR_ESCALATION,
  consentFromStage9ProfileDataSharing,
  evaluateHealthEscalationAuthorization,
  resolveHealthEscalationFeatureFlag,
  stage9Id,
  type HealthEscalationActorRole,
  type HealthEscalationAudience,
  type HealthEscalationAuthorizationDecision,
  type HealthEscalationConsent,
  type HealthEscalationEnvironmentMap,
  type HealthEscalationFeatureResolution,
  type HealthEscalationOperatorAuthorization,
} from "./healthEscalationPolicy.js";

export const HEALTH_ESCALATION_PROJECTION_SCHEMA_VERSION = "1.0.0" as const;
export const HEALTH_ESCALATION_PROJECTION_DIGEST_DOMAIN =
  "vyva.task14.health-escalation.projection.semantic.v1" as const;

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const healthEscalationProjectionStatusSchema = z.enum(["visible", "suppressed"]);
export const healthEscalationAcknowledgementStateSchema = z.enum(["unacknowledged", "acknowledged"]);

export const healthEscalationSafeSummarySchema = z.object({
  category: z.literal("preventive_health_caregiver_flag"),
  severity: z.enum(["attention", "urgent"]),
  reasonCode: z.literal("preventive_health_result_flagged_caregiver"),
  rawHealthAnswerContentRetained: z.literal(false),
}).strict();

export const healthEscalationProjectionSchema = z.object({
  schemaVersion: z.literal(HEALTH_ESCALATION_PROJECTION_SCHEMA_VERSION),
  projectionId: z.string().min(1).max(200),
  idempotencyKey: z.string().min(1).max(512),
  subjectUserId: z.string().min(1).max(160),
  profileId: z.string().min(1).max(160).nullable(),
  targetAudience: z.enum(["caregiver", "operator"]),
  targetActorId: z.string().min(1).max(160).nullable(),
  targetActorRole: z.enum(["caregiver", "family", "admin", "operator"]),
  flowId: z.literal(PREVENTIVE_HEALTH_FLOW_ID),
  flowVersion: z.literal(PREVENTIVE_HEALTH_FLOW_VERSION),
  flowInstanceId: z.string().min(1).max(200),
  sourceEventId: z.string().min(1).max(200),
  sourceAlertId: z.string().min(1).max(200).nullable(),
  completionReference: z.string().min(1).max(200),
  answerDigest: digestSchema,
  escalationPurpose: z.literal(HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose),
  safeSummary: healthEscalationSafeSummarySchema,
  authorizationDecision: z.literal("allow"),
  authorizationReasonCode: z.string().min(1).max(160),
  consentDecision: z.literal("allow"),
  consentReasonCode: z.string().min(1).max(160),
  policyDecisionDigest: digestSchema,
  consentRevision: z.number().int().min(0).max(1_000_000).nullable(),
  approvalReference: z.string().min(1).max(160).nullable(),
  status: healthEscalationProjectionStatusSchema,
  acknowledgementState: healthEscalationAcknowledgementStateSchema,
  acknowledgementId: z.string().min(1).max(200).nullable(),
  acknowledgedAt: z.string().datetime({ offset: true }).nullable(),
  acknowledgedBy: z.string().min(1).max(160).nullable(),
  acknowledgedByRole: z.enum(["caregiver", "family", "admin", "operator"]).nullable(),
  semanticDigest: digestSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((projection, ctx) => {
  if (projection.targetAudience === "caregiver") {
    if (!projection.targetActorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetActorId"],
        message: "caregiver projection requires a target actor",
      });
    }
    if (projection.targetActorRole !== "caregiver" && projection.targetActorRole !== "family") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetActorRole"],
        message: "caregiver projection requires caregiver or family role",
      });
    }
  }
  if (
    projection.targetAudience === "operator" &&
    projection.targetActorRole !== "admin" &&
    projection.targetActorRole !== "operator"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetActorRole"],
      message: "operator projection requires admin or operator role",
    });
  }
  const ackFields = [
    projection.acknowledgementId,
    projection.acknowledgedAt,
    projection.acknowledgedBy,
    projection.acknowledgedByRole,
  ].filter((value) => value !== null).length;
  if (projection.acknowledgementState === "unacknowledged" && ackFields !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["acknowledgementState"],
      message: "unacknowledged projection cannot carry acknowledgement fields",
    });
  }
  if (projection.acknowledgementState === "acknowledged" && ackFields !== 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["acknowledgementState"],
      message: "acknowledged projection requires complete acknowledgement fields",
    });
  }
});

export type HealthEscalationProjectionStatus = z.infer<typeof healthEscalationProjectionStatusSchema>;
export type HealthEscalationAcknowledgementState = z.infer<typeof healthEscalationAcknowledgementStateSchema>;
export type HealthEscalationProjection = z.infer<typeof healthEscalationProjectionSchema>;

export type HealthEscalationProjectionWriteResult =
  | { outcome: "stored"; projection: HealthEscalationProjection }
  | { outcome: "duplicate"; projection: HealthEscalationProjection }
  | { outcome: "rejected"; reason: "invalid_input" | "semantic_conflict" | "persistence_unavailable" };

export type HealthEscalationAcknowledgementResult =
  | { outcome: "acknowledged"; projection: HealthEscalationProjection }
  | { outcome: "duplicate"; projection: HealthEscalationProjection }
  | { outcome: "rejected"; reason: "not_found" | "not_authorized" | "invalid_transition" | "persistence_unavailable" };

export interface HealthEscalationProjectionStore {
  recordProjection(projection: unknown): Promise<HealthEscalationProjectionWriteResult>;
}

type HealthEscalationDisclosureActorRole = Extract<
  HealthEscalationActorRole,
  "caregiver" | "family" | "admin" | "operator"
>;

export type HealthEscalationDisclosureDenialReason =
  | "consent_revoked"
  | "consent_unavailable"
  | "caregiver_access_denied"
  | "operator_role_denied";

export type HealthEscalationDisclosureAuthorizationResult =
  | {
      authorized: true;
      actorRole: HealthEscalationDisclosureActorRole;
      currentConsent: HealthEscalationConsent;
    }
  | {
      authorized: false;
      reasonCode: HealthEscalationDisclosureDenialReason;
    };

export type HealthEscalationCurrentDisclosureResolver = (input: {
  projectionId: string;
  subjectUserId: string;
  authenticatedActorUserId: string;
  targetAudience: HealthEscalationAudience;
}) => Promise<HealthEscalationDisclosureAuthorizationResult>;

type ProjectionRecord = {
  projection: HealthEscalationProjection;
  semanticDigest: string;
};

interface HealthEscalationProjectionTransaction {
  findByProjectionId(projectionId: string): Promise<ProjectionRecord | undefined>;
  findByIdempotencyKey(idempotencyKey: string): Promise<ProjectionRecord | undefined>;
  insertProjection(record: ProjectionRecord): Promise<"inserted" | "duplicate">;
  acknowledge(input: {
    projectionId: string;
    subjectUserId: string;
    actorUserId: string;
    actorRole: HealthEscalationActorRole;
    targetAudience: HealthEscalationAudience;
    acknowledgementId: string;
    acknowledgedAt: string;
    semanticDigest: string;
  }): Promise<ProjectionRecord | undefined>;
}

interface HealthEscalationProjectionRepository {
  withTransaction<T>(operation: (tx: HealthEscalationProjectionTransaction) => Promise<T>): Promise<T>;
  findVisibleForActor(input: {
    projectionId: string;
    subjectUserId: string;
    actorUserId: string;
    actorRole: HealthEscalationActorRole;
    targetAudience: HealthEscalationAudience;
  }): Promise<ProjectionRecord | undefined>;
}

type PgClient = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

function toIso(value: Date): string {
  return new Date(value.getTime()).toISOString();
}

function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function projectionSemanticDigest(projection: Omit<HealthEscalationProjection, "semanticDigest">): string {
  return canonicalSha256(HEALTH_ESCALATION_PROJECTION_DIGEST_DOMAIN, canonicalContractProjection(projection));
}

function normalizeProjection(rawProjection: unknown): HealthEscalationProjection | null {
  let inert: unknown;
  try {
    inert = descriptorSafeDeepInertClone(rawProjection);
  } catch {
    return null;
  }
  const parsed = healthEscalationProjectionSchema.safeParse(inert);
  if (!parsed.success) return null;
  const { semanticDigest, ...withoutDigest } = parsed.data;
  return semanticDigest === projectionSemanticDigest(withoutDigest)
    ? parsed.data
    : null;
}

function rowToProjection(row: Record<string, unknown>): HealthEscalationProjection {
  return healthEscalationProjectionSchema.parse({
    schemaVersion: row.schema_version,
    projectionId: row.projection_id,
    idempotencyKey: row.idempotency_key,
    subjectUserId: row.subject_user_id,
    profileId: row.profile_id,
    targetAudience: row.target_audience,
    targetActorId: row.target_actor_id,
    targetActorRole: row.target_actor_role,
    flowId: row.flow_id,
    flowVersion: row.flow_version,
    flowInstanceId: row.flow_instance_id,
    sourceEventId: row.source_event_id,
    sourceAlertId: row.source_alert_id,
    completionReference: row.completion_reference,
    answerDigest: row.answer_digest,
    escalationPurpose: row.escalation_purpose,
    safeSummary: row.safe_summary,
    authorizationDecision: row.authorization_decision,
    authorizationReasonCode: row.authorization_reason_code,
    consentDecision: row.consent_decision,
    consentReasonCode: row.consent_reason_code,
    policyDecisionDigest: row.policy_decision_digest,
    consentRevision: row.consent_revision,
    approvalReference: row.approval_reference,
    status: row.status,
    acknowledgementState: row.acknowledgement_state,
    acknowledgementId: row.acknowledgement_id,
    acknowledgedAt: row.acknowledged_at instanceof Date
      ? row.acknowledged_at.toISOString()
      : row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedByRole: row.acknowledged_by_role,
    semanticDigest: row.semantic_digest,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  });
}

function projectionColumns(): string {
  return `
    schema_version, projection_id, idempotency_key, subject_user_id, profile_id,
    target_audience, target_actor_id, target_actor_role,
    flow_id, flow_version, flow_instance_id, source_event_id, source_alert_id,
    completion_reference, answer_digest, escalation_purpose, safe_summary,
    authorization_decision, authorization_reason_code, consent_decision, consent_reason_code,
    policy_decision_digest, consent_revision, approval_reference,
    status, acknowledgement_state, acknowledgement_id, acknowledged_at,
    acknowledged_by, acknowledged_by_role, semantic_digest, created_at, updated_at
  `;
}

class LazyPostgresHealthEscalationProjectionRepository implements HealthEscalationProjectionRepository {
  async withTransaction<T>(operation: (tx: HealthEscalationProjectionTransaction) => Promise<T>): Promise<T> {
    const { pool } = await import("../db.js");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await operation(new PostgresHealthEscalationProjectionTransaction(client));
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async findVisibleForActor(input: {
    projectionId: string;
    subjectUserId: string;
    actorUserId: string;
    actorRole: HealthEscalationActorRole;
    targetAudience: HealthEscalationAudience;
  }): Promise<ProjectionRecord | undefined> {
    const { pool } = await import("../db.js");
    const result = await pool.query<Record<string, unknown>>(
      `select ${projectionColumns()}
       from health_caregiver_operator_escalation_projections
       where projection_id = $1
         and subject_user_id = $2
         and target_audience = $3
         and status = 'visible'
         and (
           (target_audience = 'caregiver' and target_actor_id = $4 and target_actor_role = $5)
           or
           (target_audience = 'operator' and $5 in ('admin', 'operator'))
         )
       limit 1`,
      [
        input.projectionId,
        input.subjectUserId,
        input.targetAudience,
        input.actorUserId,
        input.actorRole,
      ],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const projection = rowToProjection(row);
    return { projection, semanticDigest: projection.semanticDigest };
  }
}

class PostgresHealthEscalationProjectionTransaction implements HealthEscalationProjectionTransaction {
  constructor(private readonly client: PgClient) {}

  async findByProjectionId(projectionId: string): Promise<ProjectionRecord | undefined> {
    const result = await this.client.query<Record<string, unknown>>(
      `select ${projectionColumns()}
       from health_caregiver_operator_escalation_projections
       where projection_id = $1
       for update`,
      [projectionId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const projection = rowToProjection(row);
    return { projection, semanticDigest: projection.semanticDigest };
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<ProjectionRecord | undefined> {
    const result = await this.client.query<Record<string, unknown>>(
      `select ${projectionColumns()}
       from health_caregiver_operator_escalation_projections
       where idempotency_key = $1
       for update`,
      [idempotencyKey],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const projection = rowToProjection(row);
    return { projection, semanticDigest: projection.semanticDigest };
  }

  async insertProjection(record: ProjectionRecord): Promise<"inserted" | "duplicate"> {
    const projection = record.projection;
    const result = await this.client.query(
      `insert into health_caregiver_operator_escalation_projections (
        ${projectionColumns()}
      ) values (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17::jsonb,
        $18, $19, $20, $21,
        $22, $23, $24,
        $25, $26, $27, $28,
        $29, $30, $31, $32, $33
      ) on conflict do nothing`,
      [
        projection.schemaVersion,
        projection.projectionId,
        projection.idempotencyKey,
        projection.subjectUserId,
        projection.profileId,
        projection.targetAudience,
        projection.targetActorId,
        projection.targetActorRole,
        projection.flowId,
        projection.flowVersion,
        projection.flowInstanceId,
        projection.sourceEventId,
        projection.sourceAlertId,
        projection.completionReference,
        projection.answerDigest,
        projection.escalationPurpose,
        JSON.stringify(projection.safeSummary),
        projection.authorizationDecision,
        projection.authorizationReasonCode,
        projection.consentDecision,
        projection.consentReasonCode,
        projection.policyDecisionDigest,
        projection.consentRevision,
        projection.approvalReference,
        projection.status,
        projection.acknowledgementState,
        projection.acknowledgementId,
        projection.acknowledgedAt ? new Date(projection.acknowledgedAt) : null,
        projection.acknowledgedBy,
        projection.acknowledgedByRole,
        projection.semanticDigest,
        new Date(projection.createdAt),
        new Date(projection.updatedAt),
      ],
    );
    return result.rowCount === 1 ? "inserted" : "duplicate";
  }

  async acknowledge(input: {
    projectionId: string;
    subjectUserId: string;
    actorUserId: string;
    actorRole: HealthEscalationActorRole;
    targetAudience: HealthEscalationAudience;
    acknowledgementId: string;
    acknowledgedAt: string;
    semanticDigest: string;
  }): Promise<ProjectionRecord | undefined> {
    const result = await this.client.query<Record<string, unknown>>(
      `update health_caregiver_operator_escalation_projections
       set acknowledgement_state = 'acknowledged',
           acknowledgement_id = $6,
           acknowledged_at = $7,
           acknowledged_by = $3,
           acknowledged_by_role = $4,
           semantic_digest = $8,
           updated_at = $7
       where projection_id = $1
         and subject_user_id = $2
         and target_audience = $5
         and acknowledgement_state = 'unacknowledged'
         and status = 'visible'
         and (
           (target_audience = 'caregiver' and target_actor_id = $3 and target_actor_role = $4)
           or
           (target_audience = 'operator' and $4 in ('admin', 'operator'))
         )
       returning ${projectionColumns()}`,
      [
        input.projectionId,
        input.subjectUserId,
        input.actorUserId,
        input.actorRole,
        input.targetAudience,
        input.acknowledgementId,
        new Date(input.acknowledgedAt),
        input.semanticDigest,
      ],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const projection = rowToProjection(row);
    return { projection, semanticDigest: projection.semanticDigest };
  }
}

class InMemoryHealthEscalationProjectionRepository implements HealthEscalationProjectionRepository {
  private projections = new Map<string, ProjectionRecord>();
  private idempotency = new Map<string, string>();

  async withTransaction<T>(operation: (tx: HealthEscalationProjectionTransaction) => Promise<T>): Promise<T> {
    const projectionSnapshot = new Map(this.projections);
    const idempotencySnapshot = new Map(this.idempotency);
    try {
      return await operation(new InMemoryHealthEscalationProjectionTransaction(
        this.projections,
        this.idempotency,
      ));
    } catch (error) {
      this.projections = projectionSnapshot;
      this.idempotency = idempotencySnapshot;
      throw error;
    }
  }

  async findVisibleForActor(input: {
    projectionId: string;
    subjectUserId: string;
    actorUserId: string;
    actorRole: HealthEscalationActorRole;
    targetAudience: HealthEscalationAudience;
  }): Promise<ProjectionRecord | undefined> {
    const record = this.projections.get(input.projectionId);
    if (!record) return undefined;
    const projection = record.projection;
    if (projection.subjectUserId !== input.subjectUserId) return undefined;
    if (projection.targetAudience !== input.targetAudience) return undefined;
    if (projection.status !== "visible") return undefined;
    if (projection.targetAudience === "caregiver") {
      if (projection.targetActorId !== input.actorUserId || projection.targetActorRole !== input.actorRole) {
        return undefined;
      }
    } else if (input.actorRole !== "admin" && input.actorRole !== "operator") {
      return undefined;
    }
    return safeJson(record);
  }
}

class InMemoryHealthEscalationProjectionTransaction implements HealthEscalationProjectionTransaction {
  constructor(
    private readonly projections: Map<string, ProjectionRecord>,
    private readonly idempotency: Map<string, string>,
  ) {}

  async findByProjectionId(projectionId: string): Promise<ProjectionRecord | undefined> {
    const record = this.projections.get(projectionId);
    return record ? safeJson(record) : undefined;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<ProjectionRecord | undefined> {
    const projectionId = this.idempotency.get(idempotencyKey);
    const record = projectionId ? this.projections.get(projectionId) : undefined;
    return record ? safeJson(record) : undefined;
  }

  async insertProjection(record: ProjectionRecord): Promise<"inserted" | "duplicate"> {
    if (this.projections.has(record.projection.projectionId) || this.idempotency.has(record.projection.idempotencyKey)) {
      return "duplicate";
    }
    this.projections.set(record.projection.projectionId, safeJson(record));
    this.idempotency.set(record.projection.idempotencyKey, record.projection.projectionId);
    return "inserted";
  }

  async acknowledge(input: {
    projectionId: string;
    subjectUserId: string;
    actorUserId: string;
    actorRole: HealthEscalationActorRole;
    targetAudience: HealthEscalationAudience;
    acknowledgementId: string;
    acknowledgedAt: string;
    semanticDigest: string;
  }): Promise<ProjectionRecord | undefined> {
    const record = this.projections.get(input.projectionId);
    if (!record) return undefined;
    const projection = record.projection;
    if (projection.subjectUserId !== input.subjectUserId) return undefined;
    if (projection.targetAudience !== input.targetAudience) return undefined;
    if (projection.status !== "visible" || projection.acknowledgementState !== "unacknowledged") {
      return undefined;
    }
    if (projection.targetAudience === "caregiver") {
      if (projection.targetActorId !== input.actorUserId || projection.targetActorRole !== input.actorRole) {
        return undefined;
      }
    } else if (input.actorRole !== "admin" && input.actorRole !== "operator") {
      return undefined;
    }
    const updatedWithoutDigest = {
      ...projection,
      acknowledgementState: "acknowledged" as const,
      acknowledgementId: input.acknowledgementId,
      acknowledgedAt: input.acknowledgedAt,
      acknowledgedBy: input.actorUserId,
      acknowledgedByRole: input.actorRole as "caregiver" | "family" | "admin" | "operator",
      updatedAt: input.acknowledgedAt,
    };
    const updated = {
      ...updatedWithoutDigest,
      semanticDigest: input.semanticDigest,
    };
    const updatedRecord = { projection: updated, semanticDigest: updated.semanticDigest };
    this.projections.set(input.projectionId, safeJson(updatedRecord));
    return safeJson(updatedRecord);
  }
}

export class DurableHealthEscalationProjectionStore implements HealthEscalationProjectionStore {
  constructor(
    private readonly repository: HealthEscalationProjectionRepository = new LazyPostgresHealthEscalationProjectionRepository(),
    private readonly currentDisclosureResolver: HealthEscalationCurrentDisclosureResolver = resolveCurrentHealthEscalationDisclosureAuthorization,
  ) {}

  async recordProjection(rawProjection: unknown): Promise<HealthEscalationProjectionWriteResult> {
    const projection = normalizeProjection(rawProjection);
    if (!projection) return { outcome: "rejected", reason: "invalid_input" };
    try {
      return await this.repository.withTransaction(async (tx) => {
        const existingByProjection = await tx.findByProjectionId(projection.projectionId);
        if (existingByProjection) {
          return existingByProjection.semanticDigest === projection.semanticDigest
            ? { outcome: "duplicate", projection: existingByProjection.projection }
            : { outcome: "rejected", reason: "semantic_conflict" };
        }
        const existingByIdempotency = await tx.findByIdempotencyKey(projection.idempotencyKey);
        if (existingByIdempotency) {
          return existingByIdempotency.semanticDigest === projection.semanticDigest
            ? { outcome: "duplicate", projection: existingByIdempotency.projection }
            : { outcome: "rejected", reason: "semantic_conflict" };
        }
        const inserted = await tx.insertProjection({ projection, semanticDigest: projection.semanticDigest });
        if (inserted === "inserted") return { outcome: "stored", projection };
        const duplicateByIdempotency = await tx.findByIdempotencyKey(projection.idempotencyKey);
        if (duplicateByIdempotency) {
          return duplicateByIdempotency.semanticDigest === projection.semanticDigest
            ? { outcome: "duplicate", projection: duplicateByIdempotency.projection }
            : { outcome: "rejected", reason: "semantic_conflict" };
        }
        const duplicateByProjection = await tx.findByProjectionId(projection.projectionId);
        return duplicateByProjection?.semanticDigest === projection.semanticDigest
          ? { outcome: "duplicate", projection: duplicateByProjection.projection }
          : { outcome: "rejected", reason: "semantic_conflict" };
      });
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }
  }

  async findVisibleForAuthenticatedActor(input: {
    projectionId: string;
    subjectUserId: string;
    authenticatedActorUserId: string;
    targetAudience: HealthEscalationAudience;
  }): Promise<HealthEscalationProjection | null> {
    const authorization = await this.authorizeCurrentDisclosure(input);
    if (!authorization.authorized) return null;
    try {
      return (await this.repository.findVisibleForActor({
        projectionId: input.projectionId,
        subjectUserId: input.subjectUserId,
        actorUserId: input.authenticatedActorUserId,
        actorRole: authorization.actorRole,
        targetAudience: input.targetAudience,
      }))?.projection ?? null;
    } catch {
      return null;
    }
  }

  async acknowledgeProjectionForAuthenticatedActor(input: {
    projectionId: string;
    subjectUserId: string;
    authenticatedActorUserId: string;
    targetAudience: HealthEscalationAudience;
    now: Date;
  }): Promise<HealthEscalationAcknowledgementResult> {
    const authorization = await this.authorizeCurrentDisclosure(input);
    if (!authorization.authorized) {
      return { outcome: "rejected", reason: "not_found" };
    }
    if (
      authorization.currentConsent.revokedAt ||
      (
        input.targetAudience === "caregiver" &&
        authorization.currentConsent.caregiverProjectionAllowed !== true
      ) ||
      (
        input.targetAudience === "operator" &&
        authorization.currentConsent.operatorProjectionAllowed !== true
      )
    ) {
      return { outcome: "rejected", reason: "not_found" };
    }

    const acknowledgedAt = toIso(input.now);
    const acknowledgementId = stage9Id("health.escalation.acknowledgement", {
      projectionId: input.projectionId,
      subjectUserId: input.subjectUserId,
      actorUserId: input.authenticatedActorUserId,
      actorRole: authorization.actorRole,
      targetAudience: input.targetAudience,
    });

    try {
      return await this.repository.withTransaction(async (tx) => {
        const existing = await tx.findByProjectionId(input.projectionId);
        if (!existing || existing.projection.subjectUserId !== input.subjectUserId) {
          return { outcome: "rejected", reason: "not_found" };
        }
        const projection = existing.projection;
        if (projection.targetAudience !== input.targetAudience || projection.status !== "visible") {
          return { outcome: "rejected", reason: "not_found" };
        }
        if (projection.targetAudience === "caregiver") {
          if (
            projection.targetActorId !== input.authenticatedActorUserId ||
            projection.targetActorRole !== authorization.actorRole
          ) {
            return { outcome: "rejected", reason: "not_found" };
          }
        } else if (authorization.actorRole !== "admin" && authorization.actorRole !== "operator") {
          return { outcome: "rejected", reason: "not_found" };
        }

        if (projection.acknowledgementState === "acknowledged") {
          return projection.acknowledgedBy === input.authenticatedActorUserId &&
            projection.acknowledgedByRole === authorization.actorRole &&
            projection.acknowledgementId === acknowledgementId
            ? { outcome: "duplicate", projection }
            : { outcome: "rejected", reason: "invalid_transition" };
        }
        const { semanticDigest: _previousDigest, ...projectionWithoutDigest } = projection;
        const acknowledgedProjection = {
          ...projectionWithoutDigest,
          acknowledgementState: "acknowledged" as const,
          acknowledgementId,
          acknowledgedAt,
          acknowledgedBy: input.authenticatedActorUserId,
          acknowledgedByRole: authorization.actorRole,
          updatedAt: acknowledgedAt,
        };

        const acknowledged = await tx.acknowledge({
          projectionId: input.projectionId,
          subjectUserId: input.subjectUserId,
          actorUserId: input.authenticatedActorUserId,
          actorRole: authorization.actorRole,
          targetAudience: input.targetAudience,
          acknowledgementId,
          acknowledgedAt,
          semanticDigest: projectionSemanticDigest(acknowledgedProjection),
        });
        return acknowledged
          ? { outcome: "acknowledged", projection: acknowledged.projection }
          : { outcome: "rejected", reason: "invalid_transition" };
      });
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }
  }

  private async authorizeCurrentDisclosure(input: {
    projectionId: string;
    subjectUserId: string;
    authenticatedActorUserId: string;
    targetAudience: HealthEscalationAudience;
  }): Promise<HealthEscalationDisclosureAuthorizationResult> {
    try {
      return await this.currentDisclosureResolver(input);
    } catch {
      return { authorized: false, reasonCode: "consent_unavailable" };
    }
  }
}

export class InMemoryHealthEscalationProjectionStore extends DurableHealthEscalationProjectionStore {
  constructor(currentDisclosureResolver?: HealthEscalationCurrentDisclosureResolver) {
    super(
      new InMemoryHealthEscalationProjectionRepository(),
      currentDisclosureResolver ?? resolveCurrentHealthEscalationDisclosureAuthorization,
    );
  }
}

export const defaultHealthEscalationProjectionStore = new DurableHealthEscalationProjectionStore();

export function buildHealthEscalationProjection(input: {
  subjectUserId: string;
  profileId?: string;
  targetAudience: HealthEscalationAudience;
  targetActorId?: string | null;
  targetActorRole: "caregiver" | "family" | "admin" | "operator";
  flowInstanceId: string;
  sourceEventId: string;
  sourceAlertId?: string | null;
  completionReference: string;
  answerDigest: string;
  decision: HealthEscalationAuthorizationDecision;
  now: Date;
}): HealthEscalationProjection {
  const createdAt = toIso(input.now);
  const projectionFacts = {
    subjectUserId: input.subjectUserId,
    targetAudience: input.targetAudience,
    targetActorId: input.targetActorId ?? null,
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    sourceEventId: input.sourceEventId,
    completionReference: input.completionReference,
    answerDigest: input.answerDigest,
    escalationPurpose: HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose,
  };
  const projectionWithoutDigest = {
    schemaVersion: HEALTH_ESCALATION_PROJECTION_SCHEMA_VERSION,
    projectionId: stage9Id("health.escalation.projection", projectionFacts),
    idempotencyKey: stage9Id("health.escalation.idempotency", projectionFacts),
    subjectUserId: input.subjectUserId,
    profileId: input.profileId ?? null,
    targetAudience: input.targetAudience,
    targetActorId: input.targetActorId ?? null,
    targetActorRole: input.targetActorRole,
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    sourceEventId: input.sourceEventId,
    sourceAlertId: input.sourceAlertId ?? null,
    completionReference: input.completionReference,
    answerDigest: input.answerDigest,
    escalationPurpose: HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose,
    safeSummary: {
      category: "preventive_health_caregiver_flag",
      severity: "attention",
      reasonCode: "preventive_health_result_flagged_caregiver",
      rawHealthAnswerContentRetained: false,
    },
    authorizationDecision: input.decision.authorizationDecision,
    authorizationReasonCode: input.decision.authorizationReasonCode,
    consentDecision: input.decision.consentDecision,
    consentReasonCode: input.decision.consentReasonCode,
    policyDecisionDigest: input.decision.decisionDigest,
    consentRevision: input.decision.consentRevision,
    approvalReference: input.decision.approvalReference,
    status: "visible",
    acknowledgementState: "unacknowledged",
    acknowledgementId: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    acknowledgedByRole: null,
    createdAt,
    updatedAt: createdAt,
  } satisfies Omit<HealthEscalationProjection, "semanticDigest">;
  return healthEscalationProjectionSchema.parse({
    ...projectionWithoutDigest,
    semanticDigest: projectionSemanticDigest(projectionWithoutDigest),
  });
}

export type HealthEscalationProjectionOutcome =
  | {
      outcome: "stored" | "duplicate";
      projection: HealthEscalationProjection;
      decision: HealthEscalationAuthorizationDecision;
    }
  | {
      outcome: "denied";
      decision: HealthEscalationAuthorizationDecision;
    }
  | {
      outcome: "rejected";
      reason: "invalid_input" | "semantic_conflict" | "persistence_unavailable";
    };

export async function recordHealthEscalationProjection(input: {
  store: HealthEscalationProjectionStore;
  subjectUserId: string;
  profileId?: string;
  targetAudience: HealthEscalationAudience;
  targetActorId?: string | null;
  targetActorRole: "caregiver" | "family" | "admin" | "operator";
  flowInstanceId: string;
  sourceEventId: string;
  sourceAlertId?: string | null;
  completionReference: string;
  answerDigest: string;
  requestedAt: Date;
  consent: HealthEscalationConsent;
  caregiverAccess?: unknown;
  operatorAuthorization?: HealthEscalationOperatorAuthorization;
}): Promise<HealthEscalationProjectionOutcome> {
  const authorization = evaluateHealthEscalationAuthorization({
    subjectUserId: input.subjectUserId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    targetAudience: input.targetAudience,
    targetActorId: input.targetActorId ?? null,
    targetActorRole: input.targetActorRole,
    purpose: HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose,
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    sourceEventId: input.sourceEventId,
    completionReference: input.completionReference,
    answerDigest: input.answerDigest,
    requestedAt: toIso(input.requestedAt),
    consent: input.consent,
    ...(input.caregiverAccess !== undefined ? { caregiverAccess: input.caregiverAccess } : {}),
    ...(input.operatorAuthorization !== undefined ? { operatorAuthorization: input.operatorAuthorization } : {}),
  });
  if (!authorization.ok) return { outcome: "rejected", reason: "invalid_input" };
  if (
    authorization.decision.authorizationDecision !== "allow" ||
    authorization.decision.consentDecision !== "allow"
  ) {
    return { outcome: "denied", decision: authorization.decision };
  }
  const projection = buildHealthEscalationProjection({
    subjectUserId: input.subjectUserId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    targetAudience: input.targetAudience,
    targetActorId: input.targetActorId ?? null,
    targetActorRole: input.targetActorRole,
    flowInstanceId: input.flowInstanceId,
    sourceEventId: input.sourceEventId,
    sourceAlertId: input.sourceAlertId ?? null,
    completionReference: input.completionReference,
    answerDigest: input.answerDigest,
    decision: authorization.decision,
    now: input.requestedAt,
  });
  const stored = await input.store.recordProjection(projection);
  if (stored.outcome === "stored" || stored.outcome === "duplicate") {
    return {
      outcome: stored.outcome,
      projection: stored.projection,
      decision: authorization.decision,
    };
  }
  return stored;
}

type CaregiverCandidate = {
  actorUserId: string;
  role: "caregiver" | "family";
};

async function loadCaregiverCandidates(subjectUserId: string): Promise<CaregiverCandidate[]> {
  const { db } = await import("../db.js");
  const [membershipRows, invitationRows] = await Promise.all([
    db
      .select({
        userId: profileMemberships.user_id,
        role: profileMemberships.role,
      })
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.profile_id, subjectUserId),
        eq(profileMemberships.status, "active"),
      )),
    db
      .select({
        userId: teamInvitations.accepted_user_id,
        role: teamInvitations.role,
      })
      .from(teamInvitations)
      .where(and(
        eq(teamInvitations.senior_id, subjectUserId),
        eq(teamInvitations.status, "accepted"),
      )),
  ]);
  const seen = new Set<string>();
  const candidates: CaregiverCandidate[] = [];
  for (const row of membershipRows) {
    if ((row.role === "caregiver" || row.role === "family") && !seen.has(row.userId)) {
      seen.add(row.userId);
      candidates.push({ actorUserId: row.userId, role: row.role });
    }
  }
  for (const row of invitationRows) {
    if (!row.userId || seen.has(row.userId)) continue;
    const role = row.role === "family_member" || row.role === "friend" ? "family" : "caregiver";
    seen.add(row.userId);
    candidates.push({ actorUserId: row.userId, role });
  }
  return candidates;
}

async function loadCurrentStage9Consent(subjectUserId: string): Promise<HealthEscalationConsent> {
  const { db } = await import("../db.js");
  const [profile] = await db
    .select({ dataSharingConsent: profiles.data_sharing_consent })
    .from(profiles)
    .where(eq(profiles.id, subjectUserId))
    .limit(1);
  return consentFromStage9ProfileDataSharing(profile?.dataSharingConsent ?? {});
}

function stage9ConsentAllowsAudience(
  consent: HealthEscalationConsent,
  audience: HealthEscalationAudience,
): boolean {
  if (consent.revokedAt) return false;
  return audience === "caregiver"
    ? consent.caregiverProjectionAllowed === true
    : consent.operatorProjectionAllowed === true;
}

function stage9SuperAdminEmail(value: unknown): boolean {
  const configured = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
  return typeof value === "string" && value.trim().toLowerCase() === configured;
}

async function loadCurrentOperatorAuthorization(
  actorUserId: string,
): Promise<{ actorRole: "admin" | "operator"; scope: "admin_health_escalation_queue" } | null> {
  const { db } = await import("../db.js");
  const [[profile], [account]] = await Promise.all([
    db
      .select({ role: profiles.role, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, actorUserId))
      .limit(1),
    db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, actorUserId))
      .limit(1),
  ]);

  if (
    profile?.role === "admin" ||
    stage9SuperAdminEmail(profile?.email) ||
    stage9SuperAdminEmail(account?.email)
  ) {
    return { actorRole: "admin", scope: "admin_health_escalation_queue" };
  }

  if (profile?.role === "operator") {
    return { actorRole: "operator", scope: "admin_health_escalation_queue" };
  }

  return null;
}

export async function resolveCurrentHealthEscalationDisclosureAuthorization(input: {
  projectionId: string;
  subjectUserId: string;
  authenticatedActorUserId: string;
  targetAudience: HealthEscalationAudience;
}): Promise<HealthEscalationDisclosureAuthorizationResult> {
  const currentConsent = await loadCurrentStage9Consent(input.subjectUserId);
  if (currentConsent.revokedAt) {
    return { authorized: false, reasonCode: "consent_revoked" };
  }
  if (!stage9ConsentAllowsAudience(currentConsent, input.targetAudience)) {
    return { authorized: false, reasonCode: "consent_unavailable" };
  }

  if (input.targetAudience === "caregiver") {
    const { resolveDomainAccess } = await import("../lib/caregiverDomainAccess.js");
    const access = await resolveDomainAccess({
      actorUserId: input.authenticatedActorUserId,
      targetUserId: input.subjectUserId,
      domain: "health",
      requiredPermission: "view_vitals",
    });
    if (
      !access ||
      access.isOwnProfile ||
      access.isAdmin ||
      access.actorUserId !== input.authenticatedActorUserId ||
      access.targetUserId !== input.subjectUserId ||
      access.domain !== "health" ||
      access.permissions.view_vitals !== true ||
      (access.actorRole !== "caregiver" && access.actorRole !== "family")
    ) {
      return { authorized: false, reasonCode: "caregiver_access_denied" };
    }
    return {
      authorized: true,
      actorRole: access.actorRole,
      currentConsent,
    };
  }

  const operator = await loadCurrentOperatorAuthorization(input.authenticatedActorUserId);
  if (!operator) {
    return { authorized: false, reasonCode: "operator_role_denied" };
  }

  return {
    authorized: true,
    actorRole: operator.actorRole,
    currentConsent,
  };
}

export type PreventiveHealthEscalationProjectionInput<
  TProfile,
  TResult extends PreventiveHealthResult,
> = PreventiveHealthMemoryProposalInput<TProfile, TResult> & {
  sourceEventId: string;
  sourceAlertId?: string | null;
};

export async function recordPreventiveHealthEscalationProjections<
  TProfile,
  TResult extends PreventiveHealthResult,
>(input: PreventiveHealthEscalationProjectionInput<TProfile, TResult> & {
  store?: HealthEscalationProjectionStore;
}): Promise<{
  flagResolution: HealthEscalationFeatureResolution;
  caregiverOutcomes: HealthEscalationProjectionOutcome[];
  operatorOutcome: HealthEscalationProjectionOutcome | null;
}> {
  const flagResolution = resolveHealthEscalationFeatureFlag({
    env: input.env as HealthEscalationEnvironmentMap,
    cohortKey: input.userId,
    userRef: input.userId,
  });
  if (flagResolution.effectiveMode !== "pilot" || input.result.flag_caregiver !== true) {
    return { flagResolution, caregiverOutcomes: [], operatorOutcome: null };
  }

  const store = input.store ?? defaultHealthEscalationProjectionStore;
  const currentConsent = await loadCurrentStage9Consent(input.userId);
  const caregiverCandidates = await loadCaregiverCandidates(input.userId);
  const { resolveDomainAccess } = await import("../lib/caregiverDomainAccess.js");
  const caregiverOutcomes: HealthEscalationProjectionOutcome[] = [];
  for (const candidate of caregiverCandidates) {
    const access = await resolveDomainAccess({
      actorUserId: candidate.actorUserId,
      targetUserId: input.userId,
      domain: "health",
      requiredPermission: "view_vitals",
    });
    caregiverOutcomes.push(await recordHealthEscalationProjection({
      store,
      subjectUserId: input.userId,
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      targetAudience: "caregiver",
      targetActorId: candidate.actorUserId,
      targetActorRole: candidate.role,
      flowInstanceId: input.flowInstanceId,
      sourceEventId: input.sourceEventId,
      sourceAlertId: input.sourceAlertId ?? null,
      completionReference: input.completionReference,
      answerDigest: input.answerDigest,
      requestedAt: input.completedAt,
      consent: currentConsent,
      ...(access ? { caregiverAccess: access } : {}),
    }));
  }

  const operatorOutcome = await recordHealthEscalationProjection({
    store,
    subjectUserId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    targetAudience: "operator",
    targetActorId: null,
    targetActorRole: "admin",
    flowInstanceId: input.flowInstanceId,
    sourceEventId: input.sourceEventId,
    sourceAlertId: input.sourceAlertId ?? null,
    completionReference: input.completionReference,
    answerDigest: input.answerDigest,
    requestedAt: input.completedAt,
    consent: currentConsent,
    operatorAuthorization: {
      actorUserId: "stage9.admin_health_escalation_queue",
      actorRole: "admin",
      scope: "admin_health_escalation_queue",
    },
  });

  return { flagResolution, caregiverOutcomes, operatorOutcome };
}
