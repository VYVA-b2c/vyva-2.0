import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  buildCorrectionProposal,
  buildDeletionProposal,
  buildHealthPolicyFilteredMemoryBlock,
  PostgresHealthSemanticMemoryOutboxStore,
  recordPreventiveHealthMemoryProposal,
} from "./healthSemanticMemory.js";
import { consentFromProfileDataSharing } from "./healthMemoryPolicy.js";
import {
  TASK13_ANSWER_DIGEST,
  TASK13_COMPLETION_REFERENCE,
  TASK13_FLOW_INSTANCE_ID,
  TASK13_NOW,
  TASK13_PROFILE_ID,
  TASK13_USER_ID,
  task13PilotEnv,
  task13PreventiveHealthResult,
  task13RevokedSemanticMemoryConsent,
  task13SemanticMemoryConsent,
} from "./healthMemoryFixtures.js";

const task13PostgresUrl = process.env.TASK13_POSTGRES_URL;
const migrationSql = fs.readFileSync(
  new URL("../../migrations/0081_health_semantic_memory_outbox.sql", import.meta.url),
  "utf8",
);

function assertScratchTask13Database(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//u, "");
  if (!databaseName.includes("task13") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 13 PostgreSQL tests require a scratch database name containing task13 and test/tmp/ci/scratch");
  }
}

async function withClient<T>(operation: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!task13PostgresUrl) throw new Error("TASK13_POSTGRES_URL is required");
  assertScratchTask13Database(task13PostgresUrl);
  const client = new pg.Client({ connectionString: task13PostgresUrl });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

describe("Task 13 real PostgreSQL Health semantic memory outbox", () => {
  it.runIf(task13PostgresUrl)(
    "persists idempotent proposals, delivery status and policy-filtered reads on PostgreSQL",
    async () => {
      if (!task13PostgresUrl) throw new Error("TASK13_POSTGRES_URL is required");
      process.env.DATABASE_URL = task13PostgresUrl;
      await withClient(async (client) => {
        await client.query(migrationSql);
        const version = await client.query<{ version: string }>("select version()");
        console.info(`[task13-postgres-store] ${version.rows[0]?.version ?? "unknown"}`);
      });

      const store = new PostgresHealthSemanticMemoryOutboxStore();
      try {
        const runId = randomUUID();
        const runFlowInstanceId = `${TASK13_FLOW_INSTANCE_ID}-${runId}`;
        const runCompletionReference = `${TASK13_COMPLETION_REFERENCE}-${runId}`;
        const outcomes = await Promise.all(Array.from({ length: 10 }, () =>
          recordPreventiveHealthMemoryProposal({
            userId: TASK13_USER_ID,
            profileId: TASK13_PROFILE_ID,
            mem0UserId: "mem0.task13.pg",
            flowInstanceId: runFlowInstanceId,
            completionReference: runCompletionReference,
            answerDigest: TASK13_ANSWER_DIGEST,
            result: task13PreventiveHealthResult,
            completedAt: TASK13_NOW,
            profileConsent: task13SemanticMemoryConsent,
            env: task13PilotEnv,
            store,
          })
        ));
        expect(outcomes.filter((item) => item.outcome === "stored")).toHaveLength(1);
        expect(outcomes.filter((item) => item.outcome === "duplicate")).toHaveLength(9);
        const stored = outcomes.find((item) => item.outcome === "stored");
        expect(stored?.outcome).toBe("stored");
        if (!stored || stored.outcome !== "stored") return;

        await withClient(async (client) => {
          const rows = await client.query<{ count: string }>(
            "select count(*)::text as count from health_semantic_memory_outbox where idempotency_key = $1",
            [stored.proposal.idempotencyKey],
          );
          expect(rows.rows[0]?.count).toBe("1");
        });

        const claims = await Promise.all(Array.from({ length: 10 }, () =>
          store.claimProviderDelivery({
            proposalId: stored.proposal.proposalId,
            now: new Date(TASK13_NOW.getTime() + 500),
          })
        ));
        expect(claims.filter((item) => item.outcome === "updated")).toHaveLength(1);
        expect(claims.filter((item) => item.outcome === "invalid_transition")).toHaveLength(9);
        await expect(store.markProviderDelivered({
          proposalId: stored.proposal.proposalId,
          providerMemoryId: "mem0.memory.pg.task13",
          now: new Date(TASK13_NOW.getTime() + 1_000),
        })).resolves.toMatchObject({
          outcome: "updated",
          proposal: {
            status: "delivered",
            localVisibility: "active",
            providerMemoryId: "mem0.memory.pg.task13",
          },
        });

        const memoryBlock = await buildHealthPolicyFilteredMemoryBlock({
          userId: TASK13_USER_ID,
          profileId: TASK13_PROFILE_ID,
          flowInstanceId: runFlowInstanceId,
          profileConsent: task13SemanticMemoryConsent,
          env: task13PilotEnv,
          store,
          now: TASK13_NOW,
        });
        expect(memoryBlock.memoryBlock).toContain("Preventive health check-in completed");

        const consent = consentFromProfileDataSharing(task13SemanticMemoryConsent);
        const correction = buildCorrectionProposal({
          original: memoryBlock.memoryBlock ? stored.proposal : stored.proposal,
          correctedContent: "Preventive health check-in completed with corrected PostgreSQL context.",
          now: new Date(TASK13_NOW.getTime() + 2_000),
          consent,
        });
        expect(correction).toBeTruthy();
        if (!correction) return;
        await expect(store.requestCorrection({
          originalProposalId: stored.proposal.proposalId,
          correctedProposal: {
            ...correction,
            userId: "other-user-task13",
            profileId: "other-profile-task13",
            mem0UserId: "mem0.other-task13",
          },
        })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });
        await expect(store.requestCorrection({
          originalProposalId: stored.proposal.proposalId,
          correctedProposal: {
            ...correction,
            provenance: {
              ...correction.provenance,
              correctionOf: "health.memory.wrong-original",
            },
          },
        })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });
        await expect(store.requestCorrection({
          originalProposalId: stored.proposal.proposalId,
          correctedProposal: {
            ...correction,
            operation: "deletion",
          },
        })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });
        const readableAfterRejectedCorrection = await buildHealthPolicyFilteredMemoryBlock({
          userId: TASK13_USER_ID,
          profileId: TASK13_PROFILE_ID,
          flowInstanceId: runFlowInstanceId,
          profileConsent: task13SemanticMemoryConsent,
          env: task13PilotEnv,
          store,
          now: TASK13_NOW,
        });
        expect(readableAfterRejectedCorrection.memoryBlock).toContain("Preventive health check-in completed");
        await expect(store.requestCorrection({
          originalProposalId: stored.proposal.proposalId,
          correctedProposal: correction,
        })).resolves.toMatchObject({ outcome: "stored" });
        await withClient(async (client) => {
          const rows = await client.query<{ status: string; local_visibility: string; superseded_by: string | null }>(
            `select status, local_visibility, superseded_by
               from health_semantic_memory_outbox
              where proposal_id = $1`,
            [stored.proposal.proposalId],
          );
          expect(rows.rows[0]).toMatchObject({
            status: "corrected",
            local_visibility: "suppressed",
            superseded_by: correction.proposalId,
          });
        });
        await expect(store.requestCorrection({
          originalProposalId: stored.proposal.proposalId,
          correctedProposal: correction,
        })).resolves.toMatchObject({ outcome: "duplicate" });
        await expect(store.markProviderFailed({
          proposalId: correction.proposalId,
          reason: "mem0 correction unavailable",
          now: new Date(TASK13_NOW.getTime() + 3_000),
        })).resolves.toMatchObject({
          outcome: "updated",
          proposal: { status: "delivery_failed" },
        });
        const hiddenAfterCorrection = await buildHealthPolicyFilteredMemoryBlock({
          userId: TASK13_USER_ID,
          profileId: TASK13_PROFILE_ID,
          flowInstanceId: runFlowInstanceId,
          profileConsent: task13SemanticMemoryConsent,
          env: task13PilotEnv,
          store,
          now: TASK13_NOW,
        });
        expect(hiddenAfterCorrection.memoryBlock).toBe("");

        const deleteRunId = randomUUID();
        const deleteOriginal = await recordPreventiveHealthMemoryProposal({
          userId: TASK13_USER_ID,
          profileId: TASK13_PROFILE_ID,
          mem0UserId: "mem0.task13.pg",
          flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}-delete-${deleteRunId}`,
          completionReference: `${TASK13_COMPLETION_REFERENCE}-delete-${deleteRunId}`,
          answerDigest: TASK13_ANSWER_DIGEST,
          result: task13PreventiveHealthResult,
          completedAt: new Date(TASK13_NOW.getTime() + 4_000),
          profileConsent: task13SemanticMemoryConsent,
          env: task13PilotEnv,
          store,
          provider: async () => ({ providerMemoryId: "mem0.memory.pg.delete-original" }),
          deliverApprovedWrites: true,
          loadCurrentConsentForDelivery: async () => task13SemanticMemoryConsent,
        });
        expect(deleteOriginal.outcome).toBe("stored");
        if (deleteOriginal.outcome !== "stored") return;
        const deletion = buildDeletionProposal({
          original: deleteOriginal.proposal,
          now: new Date(TASK13_NOW.getTime() + 5_000),
          consent,
        });
        expect(deletion).toBeTruthy();
        if (!deletion) return;
        await expect(store.requestDeletion({
          originalProposalId: deleteOriginal.proposal.proposalId,
          deletionProposal: {
            ...deletion,
            userId: "other-user-task13",
            profileId: "other-profile-task13",
            mem0UserId: "mem0.other-task13",
          },
        })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });
        await expect(store.requestDeletion({
          originalProposalId: deleteOriginal.proposal.proposalId,
          deletionProposal: {
            ...deletion,
            provenance: {
              ...deletion.provenance,
              deletionOf: "health.memory.wrong-original",
            },
          },
        })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });
        await expect(store.requestDeletion({
          originalProposalId: deleteOriginal.proposal.proposalId,
          deletionProposal: {
            ...deletion,
            operation: "correction",
          },
        })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });
        const readableAfterRejectedDeletion = await buildHealthPolicyFilteredMemoryBlock({
          userId: TASK13_USER_ID,
          profileId: TASK13_PROFILE_ID,
          flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}-delete-${deleteRunId}`,
          profileConsent: task13SemanticMemoryConsent,
          env: task13PilotEnv,
          store,
          now: TASK13_NOW,
        });
        expect(readableAfterRejectedDeletion.memoryBlock).toContain("Preventive health check-in completed");
        await expect(store.requestDeletion({
          originalProposalId: deleteOriginal.proposal.proposalId,
          deletionProposal: deletion,
        })).resolves.toMatchObject({ outcome: "stored" });
        await expect(store.requestDeletion({
          originalProposalId: deleteOriginal.proposal.proposalId,
          deletionProposal: deletion,
        })).resolves.toMatchObject({ outcome: "duplicate" });
        await expect(store.markProviderFailed({
          proposalId: deletion.proposalId,
          reason: "mem0 deletion unavailable",
          now: new Date(TASK13_NOW.getTime() + 6_000),
        })).resolves.toMatchObject({
          outcome: "updated",
          proposal: { status: "deletion_failed" },
        });
        const hiddenAfterDeletion = await buildHealthPolicyFilteredMemoryBlock({
          userId: TASK13_USER_ID,
          profileId: TASK13_PROFILE_ID,
          flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}-delete-${deleteRunId}`,
          profileConsent: task13SemanticMemoryConsent,
          env: task13PilotEnv,
          store,
          now: TASK13_NOW,
        });
        expect(hiddenAfterDeletion.memoryBlock).toBe("");

        const revokedProvider = vi.fn(async () => ({ providerMemoryId: "mem0.memory.pg.revoked" }));
        const revoked = await recordPreventiveHealthMemoryProposal({
          userId: TASK13_USER_ID,
          profileId: TASK13_PROFILE_ID,
          mem0UserId: "mem0.task13.pg",
          flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}-revoked-${runId}`,
          completionReference: `${TASK13_COMPLETION_REFERENCE}-revoked-${runId}`,
          answerDigest: TASK13_ANSWER_DIGEST,
          result: task13PreventiveHealthResult,
          completedAt: new Date(TASK13_NOW.getTime() + 7_000),
          profileConsent: task13SemanticMemoryConsent,
          env: task13PilotEnv,
          store,
          provider: revokedProvider,
          deliverApprovedWrites: true,
          loadCurrentConsentForDelivery: async () => task13RevokedSemanticMemoryConsent,
        });
        expect(revoked).toMatchObject({
          outcome: "stored",
          providerDelivery: "failed",
          proposal: {
            status: "delivery_failed",
            failureReason: "health_memory_policy_consent_revoked",
          },
        });
        expect(revokedProvider).not.toHaveBeenCalled();

        const missingLoaderProvider = vi.fn(async () => ({ providerMemoryId: "mem0.memory.pg.missing-loader" }));
        const missingLoader = await recordPreventiveHealthMemoryProposal({
          userId: TASK13_USER_ID,
          profileId: TASK13_PROFILE_ID,
          mem0UserId: "mem0.task13.pg",
          flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}-missing-loader-${runId}`,
          completionReference: `${TASK13_COMPLETION_REFERENCE}-missing-loader-${runId}`,
          answerDigest: TASK13_ANSWER_DIGEST,
          result: task13PreventiveHealthResult,
          completedAt: new Date(TASK13_NOW.getTime() + 8_000),
          profileConsent: task13SemanticMemoryConsent,
          env: task13PilotEnv,
          store,
          provider: missingLoaderProvider,
          deliverApprovedWrites: true,
        });
        expect(missingLoader).toMatchObject({
          outcome: "stored",
          providerDelivery: "failed",
          proposal: {
            status: "delivery_failed",
            failureReason: "health_memory_policy_current_consent_unavailable",
          },
        });
        expect(missingLoaderProvider).not.toHaveBeenCalled();
      } finally {
        const db = await import("../db.js").catch(() => null);
        await db?.pool.end().catch(() => {});
      }
    },
    180_000,
  );
});
