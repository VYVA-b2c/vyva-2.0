import fs from "node:fs";
import pg from "pg";
import { describe, expect, it } from "vitest";
import {
  PostgresPreventiveOutboundCallStore,
  preventiveOutboundCallWebhookEventKey,
} from "./preventiveOutboundCallStore.js";
import {
  parsePreventiveOutboundCallConfirmationToken,
} from "./preventiveOutboundCallSecurity.js";
import {
  validPreventiveOutboundCallNow,
  validPreventiveOutboundCallPhone,
} from "./preventiveOutboundCallFixtures.js";

const migrationSql = fs.readFileSync(
  new URL("../../migrations/0080_preventive_outbound_call_entry.sql", import.meta.url),
  "utf8",
);

const task11PostgresUrl = process.env.TASK11_POSTGRES_URL;

function assertScratchTask11Database(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//u, "");
  if (!databaseName.includes("task11") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 11 PostgreSQL tests require a scratch database name containing task11 and test/tmp/ci/scratch");
  }
}

class TestPostgresConnection {
  constructor(private readonly connectionString: string) {}
  async withClient<T>(operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const pool = new pg.Pool({ connectionString: this.connectionString, max: 4 });
    const client = await pool.connect();
    try {
      return await operation(client);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

describe("Task 11 real PostgreSQL preventive outbound call store", () => {
  it.runIf(task11PostgresUrl)(
    "coordinates concurrent call claims, signed status persistence, and confirmation idempotency",
    async () => {
      if (!task11PostgresUrl) throw new Error("TASK11_POSTGRES_URL is required");
      assertScratchTask11Database(task11PostgresUrl);
      const client = new pg.Client({ connectionString: task11PostgresUrl });
      await client.connect();
      try {
        await client.query(migrationSql);
      } finally {
        await client.end();
      }
      const store = new PostgresPreventiveOutboundCallStore(new TestPostgresConnection(task11PostgresUrl));
      const consent = await store.provisionConsent({
        userId: "user.test.pg",
        profileId: "profile.test.pg",
        enabled: true,
        phoneE164: validPreventiveOutboundCallPhone,
        phoneVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
        verificationSource: "admin_provisioned",
        verificationReference: "ticket.task11.pg",
        now: validPreventiveOutboundCallNow,
      });
      const token = "e".repeat(43);
      const parsed = parsePreventiveOutboundCallConfirmationToken(token);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw new Error("invalid token");
      const claimInput = {
        userId: "user.test.pg",
        profileId: "profile.test.pg",
        scheduleOccurrenceId: "occurrence.task11.pg",
        scheduleId: "schedule.daily.checkin",
        consent,
        policyAuditId: "audit.task11.pg",
        policyDecisionDigest: `sha256:${"b".repeat(64)}`,
        claimToken: "claim.task11.pg",
        claimExpiresAt: new Date(validPreventiveOutboundCallNow.getTime() + 60_000),
        confirmationTokenDigest: parsed.tokenDigest,
        confirmationTokenExpiresAt: new Date(validPreventiveOutboundCallNow.getTime() + 15 * 60_000),
        now: validPreventiveOutboundCallNow,
      };
      const claims = await Promise.all(Array.from({ length: 10 }, () => store.acquireCallClaim(claimInput)));
      expect(claims.filter((claim) => claim.outcome === "acquired")).toHaveLength(1);
      const acquired = claims.find((claim) => claim.outcome === "acquired");
      expect(acquired?.outcome).toBe("acquired");
      if (!acquired || acquired.outcome !== "acquired") throw new Error("missing claim");
      const started = await store.markProviderAttemptStarted({
        attemptId: acquired.attempt.id,
        claimToken: "claim.task11.pg",
        providerAttemptId: "provider-attempt.pg",
        now: validPreventiveOutboundCallNow,
      });
      expect(started.outcome).toBe("started");
      await expect(store.markProviderStarted({
        attemptId: acquired.attempt.id,
        providerAttemptId: "provider-attempt.pg",
        providerConversationId: "conv.task11.pg",
        twilioCallSid: "CA22222222222222222222222222222222",
        now: validPreventiveOutboundCallNow,
      })).resolves.toEqual({ outcome: "recorded" });
      const answer = await store.recordTwilioStatus({
        eventKey: preventiveOutboundCallWebhookEventKey({
          twilioCallSid: "CA22222222222222222222222222222222",
          providerStatus: "in-progress",
          providerTimestamp: "1",
        }),
        twilioCallSid: "CA22222222222222222222222222222222",
        providerStatus: "in-progress",
        receivedAt: validPreventiveOutboundCallNow,
      });
      expect(answer.outcome).toBe("recorded");
      const confirmation = await store.claimConfirmedFlowEntry({
        tokenDigest: parsed.tokenDigest,
        providerConversationId: "conv.task11.pg",
        twilioCallSid: "CA22222222222222222222222222222222",
        flowEntryClaimToken: "flow-entry-claim.pg",
        flowEntryClaimExpiresAt: new Date(validPreventiveOutboundCallNow.getTime() + 60_000),
        now: validPreventiveOutboundCallNow,
      });
      expect(confirmation).toMatchObject({
        outcome: "flow_entry_started",
        flowId: "health.preventive_check",
        flowVersion: "1.0.0",
      });
      if (confirmation.outcome !== "flow_entry_started") throw new Error("missing flow entry claim");
      await expect(store.markFlowStarted({
        attemptId: confirmation.attempt.id,
        flowEntryClaimToken: confirmation.flowEntryClaimToken,
        flowEntryEvidence: {
          flowId: "health.preventive_check",
          flowVersion: "1.0.0",
          sessionId: `task11.outbound_call.${confirmation.attempt.id}`,
          evidenceReference: `stage4.entry.${confirmation.attempt.id}`,
          status: "started",
        },
        now: validPreventiveOutboundCallNow,
      })).resolves.toMatchObject({
        outcome: "flow_started",
      });
      await expect(store.claimConfirmedFlowEntry({
        tokenDigest: parsed.tokenDigest,
        providerConversationId: "conv.task11.pg",
        twilioCallSid: "CA22222222222222222222222222222222",
        flowEntryClaimToken: "flow-entry-claim.pg.replay",
        flowEntryClaimExpiresAt: new Date(validPreventiveOutboundCallNow.getTime() + 60_000),
        now: validPreventiveOutboundCallNow,
      })).resolves.toMatchObject({ outcome: "already_started" });

      const secondToken = "f".repeat(43);
      const secondParsed = parsePreventiveOutboundCallConfirmationToken(secondToken);
      expect(secondParsed.ok).toBe(true);
      if (!secondParsed.ok) throw new Error("invalid token");
      const secondClaim = await store.acquireCallClaim({
        ...claimInput,
        scheduleOccurrenceId: "occurrence.task11.pg.second",
        claimToken: "claim.task11.pg.second",
        confirmationTokenDigest: secondParsed.tokenDigest,
      });
      expect(secondClaim.outcome).toBe("acquired");
      if (secondClaim.outcome !== "acquired") throw new Error("missing second claim");
      await store.markProviderAttemptStarted({
        attemptId: secondClaim.attempt.id,
        claimToken: "claim.task11.pg.second",
        providerAttemptId: "provider-attempt.pg.second",
        now: validPreventiveOutboundCallNow,
      });
      await expect(store.markProviderStarted({
        attemptId: secondClaim.attempt.id,
        providerAttemptId: "provider-attempt.pg.second",
        providerConversationId: "conv.task11.pg",
        twilioCallSid: "CA22222222222222222222222222222222",
        now: validPreventiveOutboundCallNow,
      })).resolves.toEqual({ outcome: "unavailable" });
    },
    180_000,
  );
});
