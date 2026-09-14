import crypto from "node:crypto";
import fs from "node:fs";
import express from "express";
import pg from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  PostgresPreventiveOutboundCallStore,
} from "../engagement/preventiveOutboundCallStore.js";
import {
  parsePreventiveOutboundCallConfirmationToken,
  PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER,
} from "../engagement/preventiveOutboundCallSecurity.js";
import {
  validPreventiveOutboundCallEnv,
  validPreventiveOutboundCallNow,
  validPreventiveOutboundCallPhone,
} from "../engagement/preventiveOutboundCallFixtures.js";
import { createPreventiveOutboundCallRouter } from "./preventiveOutboundCall.js";
import type { PreventiveHealthFlowEntryStartOutcome } from "../health/preventiveHealthOrchestrator.js";

const migrationSql = fs.readFileSync(
  new URL("../../migrations/0080_preventive_outbound_call_entry.sql", import.meta.url),
  "utf8",
);

const task11PostgresUrl = process.env.TASK11_POSTGRES_URL;
const authToken = "twilioAuthTokenTask11";
const baseUrl = "https://vyva.example.com";
const twilioCallSid = "CA33333333333333333333333333333333";
const secondTwilioCallSid = "CA44444444444444444444444444444444";
const tenConcurrentTwilioCallSid = "CA55555555555555555555555555555555";

function assertScratchTask11Database(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//u, "");
  if (!databaseName.includes("task11") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 11 PostgreSQL route tests require a scratch database name containing task11 and test/tmp/ci/scratch");
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

function signTwilio(url: string, params: Record<string, string>): string {
  const data = Object.keys(params).sort().reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

function stage4Success(options: { delayMs?: number } = {}) {
  return vi.fn(async (input: {
    sessionId: string;
  }): Promise<PreventiveHealthFlowEntryStartOutcome> => {
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    return {
      outcome: "started",
      flowId: "health.preventive_check",
      flowVersion: "1.0.0",
      sessionId: input.sessionId,
      evidenceReference: `stage4.pg.${input.sessionId}`,
      result: {} as never,
      flagResolution: {} as never,
    };
  });
}

function app(input: {
  store: PostgresPreventiveOutboundCallStore;
  stage4: ReturnType<typeof stage4Success>;
}) {
  const value = express();
  value.use("/api/preventive-outbound-call", express.urlencoded({ extended: false }));
  value.use("/api/preventive-outbound-call", express.json());
  value.use("/api/preventive-outbound-call", createPreventiveOutboundCallRouter({
    store: input.store,
    env: validPreventiveOutboundCallEnv(),
    currentTime: () => validPreventiveOutboundCallNow,
    idFactory: () => `flow-entry-claim.pg.${crypto.randomUUID()}`,
    stage4FlowEntry: input.stage4 as never,
  }));
  return value;
}

function postTwilioStatus(input: {
  app: ReturnType<typeof app>;
  params: Record<string, string>;
  signatureParams?: Record<string, string>;
}) {
  const path = "/api/preventive-outbound-call/twilio/status";
  return request(input.app)
    .post(path)
    .set("X-Twilio-Signature", signTwilio(`${baseUrl}${path}`, input.signatureParams ?? input.params))
    .type("form")
    .send(input.params);
}

function postConfirmation(input: {
  app: ReturnType<typeof app>;
  token: string;
  providerConversationId: string;
  twilioCallSid: string;
}) {
  return request(input.app)
    .post("/api/preventive-outbound-call/elevenlabs/confirm")
    .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, input.token)
    .send({
      providerConversationId: input.providerConversationId,
      twilioCallSid: input.twilioCallSid,
      confirmed: true,
    });
}

async function prepareAttempt(input: {
  store: PostgresPreventiveOutboundCallStore;
  userId: string;
  profileId: string;
  token: string;
  conversationId: string;
  callSid: string;
  occurrence: string;
}) {
  const parsed = parsePreventiveOutboundCallConfirmationToken(input.token);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error("invalid token");
  const consent = await input.store.provisionConsent({
    userId: input.userId,
    profileId: input.profileId,
    enabled: true,
    phoneE164: validPreventiveOutboundCallPhone,
    phoneVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    verificationSource: "admin_provisioned",
    verificationReference: `ticket.${input.occurrence}`,
    now: validPreventiveOutboundCallNow,
  });
  const claim = await input.store.acquireCallClaim({
    userId: input.userId,
    profileId: input.profileId,
    scheduleOccurrenceId: input.occurrence,
    scheduleId: "schedule.daily.checkin",
    consent,
    policyAuditId: `audit.${input.occurrence}`,
    policyDecisionDigest: `sha256:${"b".repeat(64)}`,
    claimToken: `claim.${input.occurrence}`,
    claimExpiresAt: new Date(validPreventiveOutboundCallNow.getTime() + 60_000),
    confirmationTokenDigest: parsed.tokenDigest,
    confirmationTokenExpiresAt: new Date(validPreventiveOutboundCallNow.getTime() + 15 * 60_000),
    now: validPreventiveOutboundCallNow,
  });
  expect(claim.outcome).toBe("acquired");
  if (claim.outcome !== "acquired") throw new Error("claim failed");
  await input.store.markProviderAttemptStarted({
    attemptId: claim.attempt.id,
    claimToken: `claim.${input.occurrence}`,
    providerAttemptId: `provider-attempt.${input.occurrence}`,
    now: validPreventiveOutboundCallNow,
  });
  await expect(input.store.markProviderStarted({
    attemptId: claim.attempt.id,
    providerAttemptId: `provider-attempt.${input.occurrence}`,
    providerConversationId: input.conversationId,
    twilioCallSid: input.callSid,
    now: validPreventiveOutboundCallNow,
  })).resolves.toEqual({ outcome: "recorded" });
  return { parsed, attemptId: claim.attempt.id };
}

describe("Task 11 real PostgreSQL preventive outbound call route", () => {
  it.runIf(task11PostgresUrl)(
    "uses the actual signed route and PostgreSQL store for status, confirmation, replay and revocation",
    async () => {
      if (!task11PostgresUrl) throw new Error("TASK11_POSTGRES_URL is required");
      assertScratchTask11Database(task11PostgresUrl);
      const client = new pg.Client({ connectionString: task11PostgresUrl });
      await client.connect();
      try {
        await client.query(migrationSql);
        await client.query("truncate table preventive_outbound_call_webhook_events, preventive_outbound_call_attempts, preventive_outbound_call_consents restart identity cascade");
        const version = await client.query<{ version: string }>("select version()");
        console.info(`[task11-route-postgres] ${version.rows[0]?.version ?? "unknown"}`);
      } finally {
        await client.end();
      }

      const store = new PostgresPreventiveOutboundCallStore(new TestPostgresConnection(task11PostgresUrl));
      const stage4 = stage4Success({ delayMs: 50 });
      const route = app({ store, stage4 });
      const firstToken = "j".repeat(43);
      await prepareAttempt({
        store,
        userId: "user.route.pg",
        profileId: "profile.route.pg",
        token: firstToken,
        conversationId: "conv.route.pg",
        callSid: twilioCallSid,
        occurrence: "occurrence.route.pg",
      });

      await postTwilioStatus({
        app: route,
        params: { CallSid: twilioCallSid, CallStatus: "in-progress", SequenceNumber: "1" },
      }).expect(204);
      await postTwilioStatus({
        app: route,
        params: { CallSid: twilioCallSid, CallStatus: "in-progress", SequenceNumber: "1" },
      }).expect(204);
      await postTwilioStatus({
        app: route,
        params: { CallSid: "CA99999999999999999999999999999999", CallStatus: "ringing", SequenceNumber: "2" },
      }).expect(404);

      await request(route)
        .post("/api/preventive-outbound-call/elevenlabs/confirm")
        .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, firstToken)
        .send({
          providerConversationId: "conv.route.wrong",
          twilioCallSid,
          confirmed: true,
        })
        .expect(403);
      expect(stage4).not.toHaveBeenCalled();

      const concurrentConfirmations = await Promise.all([
        request(route)
          .post("/api/preventive-outbound-call/elevenlabs/confirm")
          .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, firstToken)
          .send({
            providerConversationId: "conv.route.pg",
            twilioCallSid,
            confirmed: true,
          }),
        request(route)
          .post("/api/preventive-outbound-call/elevenlabs/confirm")
          .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, firstToken)
          .send({
            providerConversationId: "conv.route.pg",
            twilioCallSid,
            confirmed: true,
          }),
      ]);
      expect(concurrentConfirmations.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(stage4).toHaveBeenCalledTimes(1);

      await request(route)
        .post("/api/preventive-outbound-call/elevenlabs/confirm")
        .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, firstToken)
        .send({
          providerConversationId: "conv.route.pg",
          twilioCallSid,
          confirmed: true,
        })
        .expect(200);
      expect(stage4).toHaveBeenCalledTimes(1);

      const secondToken = "k".repeat(43);
      await prepareAttempt({
        store,
        userId: "user.revoked.route.pg",
        profileId: "profile.revoked.route.pg",
        token: secondToken,
        conversationId: "conv.revoked.route.pg",
        callSid: secondTwilioCallSid,
        occurrence: "occurrence.revoked.route.pg",
      });
      await postTwilioStatus({
        app: route,
        params: { CallSid: secondTwilioCallSid, CallStatus: "in-progress", SequenceNumber: "1" },
      }).expect(204);
      await store.revokeConsent({
        userId: "user.revoked.route.pg",
        profileId: "profile.revoked.route.pg",
        now: new Date("2026-08-03T12:01:00.000Z"),
      });
      await request(route)
        .post("/api/preventive-outbound-call/elevenlabs/confirm")
        .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, secondToken)
        .send({
          providerConversationId: "conv.revoked.route.pg",
          twilioCallSid: secondTwilioCallSid,
          confirmed: true,
        })
        .expect(403);
      expect(stage4).toHaveBeenCalledTimes(1);

      const rows = await new pg.Client({ connectionString: task11PostgresUrl });
      await rows.connect();
      try {
        const counts = await rows.query<{ status: string; count: string }>(
          "select status, count(*)::text from preventive_outbound_call_attempts group by status order by status",
        );
        expect(counts.rows).toEqual(expect.arrayContaining([
          { status: "flow_started", count: "1" },
          { status: "answered", count: "1" },
        ]));
      } finally {
        await rows.end();
      }
    },
    180_000,
  );

  it.runIf(task11PostgresUrl)(
    "bounds ten concurrent confirmation HTTP requests and recreated runtimes with PostgreSQL",
    async () => {
      if (!task11PostgresUrl) throw new Error("TASK11_POSTGRES_URL is required");
      assertScratchTask11Database(task11PostgresUrl);
      const client = new pg.Client({ connectionString: task11PostgresUrl });
      await client.connect();
      try {
        await client.query(migrationSql);
        await client.query("truncate table preventive_outbound_call_webhook_events, preventive_outbound_call_attempts, preventive_outbound_call_consents restart identity cascade");
        const version = await client.query<{ version: string }>("select version()");
        console.info(`[task11-route-postgres] ${version.rows[0]?.version ?? "unknown"}`);
      } finally {
        await client.end();
      }

      const store = new PostgresPreventiveOutboundCallStore(new TestPostgresConnection(task11PostgresUrl));
      const stage4 = stage4Success({ delayMs: 250 });
      const route = app({ store, stage4 });
      const token = "l".repeat(43);
      await prepareAttempt({
        store,
        userId: "user.route.pg.ten",
        profileId: "profile.route.pg.ten",
        token,
        conversationId: "conv.route.pg.ten",
        callSid: tenConcurrentTwilioCallSid,
        occurrence: "occurrence.route.pg.ten",
      });
      await postTwilioStatus({
        app: route,
        params: { CallSid: tenConcurrentTwilioCallSid, CallStatus: "in-progress", SequenceNumber: "1" },
      }).expect(204);

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => postConfirmation({
          app: route,
          token,
          providerConversationId: "conv.route.pg.ten",
          twilioCallSid: tenConcurrentTwilioCallSid,
        })),
      );

      expect(responses.every((response) => response.status === 200 || response.status === 409)).toBe(true);
      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
      expect(stage4).toHaveBeenCalledTimes(1);

      const recreatedStore = new PostgresPreventiveOutboundCallStore(new TestPostgresConnection(task11PostgresUrl));
      const recreatedStage4 = stage4Success();
      const recreatedRoute = app({ store: recreatedStore, stage4: recreatedStage4 });
      await postConfirmation({
        app: recreatedRoute,
        token,
        providerConversationId: "conv.route.pg.ten",
        twilioCallSid: tenConcurrentTwilioCallSid,
      }).expect(200);
      expect(recreatedStage4).not.toHaveBeenCalled();

      const rows = await new pg.Client({ connectionString: task11PostgresUrl });
      await rows.connect();
      try {
        const attempts = await rows.query<{ status: string; confirmation_token_consumed_at: Date | null }>(
          "select status, confirmation_token_consumed_at from preventive_outbound_call_attempts where twilio_call_sid = $1",
          [tenConcurrentTwilioCallSid],
        );
        expect(attempts.rows).toEqual([
          expect.objectContaining({
            status: "flow_started",
            confirmation_token_consumed_at: expect.any(Date),
          }),
        ]);
      } finally {
        await rows.end();
      }
    },
    180_000,
  );
});
