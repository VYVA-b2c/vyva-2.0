import {
  canonicalContractProjection,
  canonicalSha256,
  descriptorSafeDeepInertClone,
} from "../orchestrator/eventStateCanonicalJson.js";
import {
  proactiveEngagementAuditSchema,
  type ProactiveEngagementAudit,
  type ProactiveEngagementEvaluationInput,
  type ProactiveEngagementPolicyDecision,
} from "../../shared/engagement/proactiveEngagement.js";

export const PROACTIVE_ENGAGEMENT_AUDIT_DIGEST_DOMAIN =
  "vyva.task8.proactive-engagement.audit.semantic.v1" as const;

export type ProactiveEngagementAuditWriteResult =
  | { outcome: "stored" }
  | { outcome: "duplicate" }
  | { outcome: "rejected"; reason: "invalid_input" | "semantic_conflict" | "persistence_unavailable" };

export interface ProactiveEngagementAuditStore {
  writeAudit(audit: unknown, options?: { signal?: AbortSignal }): Promise<ProactiveEngagementAuditWriteResult>;
}

type AuditRecord = {
  audit: ProactiveEngagementAudit;
  semanticDigest: string;
};

interface ProactiveAuditTransaction {
  findByIdempotencyKey(idempotencyKey: string): Promise<AuditRecord | undefined>;
  insertAudit(record: AuditRecord): Promise<"inserted" | "duplicate">;
}

interface ProactiveAuditRepository {
  withTransaction<T>(operation: (tx: ProactiveAuditTransaction) => Promise<T>): Promise<T>;
}

type PgClient = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

function toPgDate(value: string): Date {
  return new Date(value);
}

export function proactiveEngagementAuditSemanticDigest(
  audit: ProactiveEngagementAudit,
): string {
  return canonicalSha256(
    PROACTIVE_ENGAGEMENT_AUDIT_DIGEST_DOMAIN,
    canonicalContractProjection(audit),
  );
}

function deterministicAuditId(input: {
  idempotencyKey: string;
  decisionDigest: string;
}): string {
  const digest = canonicalSha256(
    `${PROACTIVE_ENGAGEMENT_AUDIT_DIGEST_DOMAIN}.id`,
    canonicalContractProjection(input),
  );
  return `engagement.audit.${digest.slice("sha256:".length, "sha256:".length + 32)}`;
}

export function createProactiveEngagementAudit(input: {
  evaluationInput: ProactiveEngagementEvaluationInput;
  decision: ProactiveEngagementPolicyDecision;
  decisionDigest: string;
  idempotencyKey: string;
}): ProactiveEngagementAudit {
  return proactiveEngagementAuditSchema.parse({
    schemaVersion: input.decision.schemaVersion,
    policyVersion: input.decision.policyVersion,
    auditId: deterministicAuditId({
      idempotencyKey: input.idempotencyKey,
      decisionDigest: input.decisionDigest,
    }),
    idempotencyKey: input.idempotencyKey,
    decisionDigest: input.decisionDigest,
    scheduleOccurrenceId: input.decision.scheduleOccurrenceId,
    scheduleId: input.decision.scheduleId,
    purposeId: input.decision.purposeId,
    decision: input.decision.decision,
    ...(input.decision.proposedChannel ? { proposedChannel: input.decision.proposedChannel } : {}),
    reasonCodes: input.decision.reasonCodes,
    dueAt: input.evaluationInput.dueAt,
    evaluatedAt: input.decision.evaluatedAt,
    timezone: input.decision.timezone,
    consentStatus: input.decision.consentStatus,
    quietHoursStatus: input.decision.quietHoursStatus,
    limitStatus: input.decision.limitStatus,
    duplicateStatus: input.decision.duplicateStatus,
    source: input.decision.source,
    normalizedFacts: {
      fallbackChainConsidered: input.decision.fallbackChainConsidered,
      localEvaluatedAt: input.decision.localEvaluatedAt,
      channelCandidateCount: input.evaluationInput.channelCandidates.length,
      recentAttemptCount: input.evaluationInput.recentAttempts.length,
      consentFactCount: input.evaluationInput.consentFacts.length,
    },
    shadowOnly: true,
    nonExecutable: true,
  });
}

class LazyPostgresProactiveAuditRepository implements ProactiveAuditRepository {
  async withTransaction<T>(operation: (tx: ProactiveAuditTransaction) => Promise<T>): Promise<T> {
    const { pool } = await import("../db.js");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const tx = new PostgresProactiveAuditTransaction(client);
      const result = await operation(tx);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

class PostgresProactiveAuditTransaction implements ProactiveAuditTransaction {
  constructor(private readonly client: PgClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<AuditRecord | undefined> {
    const result = await this.client.query<{
      normalized_audit: ProactiveEngagementAudit;
      semantic_digest: string;
    }>(
      "select normalized_audit, semantic_digest from proactive_engagement_shadow_audits where idempotency_key = $1",
      [idempotencyKey],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      audit: proactiveEngagementAuditSchema.parse(row.normalized_audit),
      semanticDigest: row.semantic_digest,
    };
  }

  async insertAudit(record: AuditRecord): Promise<"inserted" | "duplicate"> {
    const audit = record.audit;
    const result = await this.client.query(
      `insert into proactive_engagement_shadow_audits (
        audit_id, schema_version, policy_version, idempotency_key,
        schedule_occurrence_id, schedule_id, purpose_id, decision,
        proposed_channel, reason_codes, due_at, evaluated_at, timezone,
        consent_status, quiet_hours_status, limit_status, duplicate_status,
        source_classification, normalized_audit, semantic_digest,
        shadow_only, non_executable
      ) values (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19::jsonb, $20,
        true, true
      ) on conflict (idempotency_key) do nothing`,
      [
        audit.auditId,
        audit.schemaVersion,
        audit.policyVersion,
        audit.idempotencyKey,
        audit.scheduleOccurrenceId,
        audit.scheduleId,
        audit.purposeId,
        audit.decision,
        audit.proposedChannel ?? null,
        audit.reasonCodes,
        toPgDate(audit.dueAt),
        toPgDate(audit.evaluatedAt),
        audit.timezone,
        audit.consentStatus,
        audit.quietHoursStatus,
        audit.limitStatus,
        audit.duplicateStatus,
        audit.source,
        JSON.stringify(audit),
        record.semanticDigest,
      ],
    );
    return result.rowCount === 1 ? "inserted" : "duplicate";
  }
}

export class InMemoryProactiveEngagementAuditStore implements ProactiveEngagementAuditStore {
  private readonly records = new Map<string, AuditRecord>();

  async writeAudit(audit: unknown): Promise<ProactiveEngagementAuditWriteResult> {
    let parsed: ProactiveEngagementAudit;
    try {
      parsed = proactiveEngagementAuditSchema.parse(descriptorSafeDeepInertClone(audit));
    } catch {
      return { outcome: "rejected", reason: "invalid_input" };
    }
    const semanticDigest = proactiveEngagementAuditSemanticDigest(parsed);
    const existing = this.records.get(parsed.idempotencyKey);
    if (existing) {
      return existing.semanticDigest === semanticDigest
        ? { outcome: "duplicate" }
        : { outcome: "rejected", reason: "semantic_conflict" };
    }
    this.records.set(parsed.idempotencyKey, { audit: parsed, semanticDigest });
    return { outcome: "stored" };
  }

  snapshot(): ProactiveEngagementAudit[] {
    return Array.from(this.records.values()).map((record) => record.audit);
  }
}

export class ProactiveEngagementAuditRepositoryStore implements ProactiveEngagementAuditStore {
  constructor(private readonly repository: ProactiveAuditRepository = new LazyPostgresProactiveAuditRepository()) {}

  async writeAudit(audit: unknown, options: { signal?: AbortSignal } = {}): Promise<ProactiveEngagementAuditWriteResult> {
    if (options.signal?.aborted) return { outcome: "rejected", reason: "persistence_unavailable" };
    let parsed: ProactiveEngagementAudit;
    try {
      parsed = proactiveEngagementAuditSchema.parse(descriptorSafeDeepInertClone(audit));
    } catch {
      return { outcome: "rejected", reason: "invalid_input" };
    }
    const semanticDigest = proactiveEngagementAuditSemanticDigest(parsed);
    try {
      return await this.repository.withTransaction(async (tx) => {
        if (options.signal?.aborted) return { outcome: "rejected", reason: "persistence_unavailable" } as const;
        const existing = await tx.findByIdempotencyKey(parsed.idempotencyKey);
        if (existing) {
          return existing.semanticDigest === semanticDigest
            ? { outcome: "duplicate" as const }
            : { outcome: "rejected" as const, reason: "semantic_conflict" as const };
        }
        const inserted = await tx.insertAudit({ audit: parsed, semanticDigest });
        if (inserted === "inserted") return { outcome: "stored" as const };
        const raced = await tx.findByIdempotencyKey(parsed.idempotencyKey);
        if (raced?.semanticDigest === semanticDigest) return { outcome: "duplicate" as const };
        return { outcome: "rejected" as const, reason: "semantic_conflict" as const };
      });
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }
  }
}

export const defaultProactiveEngagementAuditStore =
  new ProactiveEngagementAuditRepositoryStore();
