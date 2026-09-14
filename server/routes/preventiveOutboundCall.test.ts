import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  InMemoryPreventiveOutboundCallStore,
  preventiveOutboundCallWebhookEventKey,
} from "../engagement/preventiveOutboundCallStore.js";
import {
  parsePreventiveOutboundCallConfirmationToken,
  PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER,
} from "../engagement/preventiveOutboundCallSecurity.js";
import { createPreventiveOutboundCallRouter } from "./preventiveOutboundCall.js";
import {
  validPreventiveOutboundCallEnv,
  validPreventiveOutboundCallNow,
  validPreventiveOutboundCallPhone,
} from "../engagement/preventiveOutboundCallFixtures.js";
import type { PreventiveHealthFlowEntryStartOutcome } from "../health/preventiveHealthOrchestrator.js";

const authToken = "twilioAuthTokenTask11";
const baseUrl = "https://vyva.example.com";
const twilioCallSid = "CA11111111111111111111111111111111";
const secondTwilioCallSid = "CA22222222222222222222222222222222";

function signTwilio(url: string, params: Record<string, string>): string {
  const data = Object.keys(params).sort().reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

function stage4Success() {
  return vi.fn(async (input: {
    sessionId: string;
  }): Promise<PreventiveHealthFlowEntryStartOutcome> => ({
    outcome: "started",
    flowId: "health.preventive_check",
    flowVersion: "1.0.0",
    sessionId: input.sessionId,
    evidenceReference: `stage4.entry.${input.sessionId}`,
    result: {} as never,
    flagResolution: {} as never,
  }));
}

function app(input: {
  store: InMemoryPreventiveOutboundCallStore;
  env?: ReturnType<typeof validPreventiveOutboundCallEnv>;
  stage4?: ReturnType<typeof stage4Success>;
}) {
  const value = express();
  value.use("/api/preventive-outbound-call", express.urlencoded({ extended: false }));
  value.use("/api/preventive-outbound-call", express.json());
  value.use("/api/preventive-outbound-call", createPreventiveOutboundCallRouter({
    store: input.store,
    env: input.env ?? validPreventiveOutboundCallEnv(),
    currentTime: () => validPreventiveOutboundCallNow,
    idFactory: () => "flow-entry-claim.task11",
    ...(input.stage4 ? { stage4FlowEntry: input.stage4 as never } : {}),
  }));
  return value;
}

async function createAttempt(input: {
  store: InMemoryPreventiveOutboundCallStore;
  token?: string;
  userId?: string;
  profileId?: string;
  conversationId?: string;
  callSid?: string;
  status?: "provider_started" | "answered" | "no_answer";
}) {
  const token = input.token ?? "a".repeat(43);
  const userId = input.userId ?? "user.test";
  const profileId = input.profileId ?? "profile.test.elder";
  const conversationId = input.conversationId ?? "conv.task11";
  const callSid = input.callSid ?? twilioCallSid;
  const parsed = parsePreventiveOutboundCallConfirmationToken(token);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error("invalid token");
  const consent = await input.store.provisionConsent({
    userId,
    profileId,
    enabled: true,
    phoneE164: validPreventiveOutboundCallPhone,
    phoneVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    verificationSource: "admin_provisioned",
    verificationReference: "ticket.task11",
    now: validPreventiveOutboundCallNow,
  });
  const claim = await input.store.acquireCallClaim({
    userId,
    profileId,
    scheduleOccurrenceId: `occurrence.${token.slice(0, 8)}.${callSid.slice(-4)}`,
    scheduleId: "schedule.daily.checkin",
    consent,
    policyAuditId: "audit.task11",
    policyDecisionDigest: `sha256:${"b".repeat(64)}`,
    claimToken: `claim.${token.slice(0, 8)}`,
    claimExpiresAt: new Date(validPreventiveOutboundCallNow.getTime() + 60_000),
    confirmationTokenDigest: parsed.tokenDigest,
    confirmationTokenExpiresAt: new Date(validPreventiveOutboundCallNow.getTime() + 15 * 60_000),
    now: validPreventiveOutboundCallNow,
  });
  expect(claim.outcome).toBe("acquired");
  if (claim.outcome !== "acquired") throw new Error("claim failed");
  await input.store.markProviderAttemptStarted({
    attemptId: claim.attempt.id,
    claimToken: `claim.${token.slice(0, 8)}`,
    providerAttemptId: `provider-attempt.${token.slice(0, 8)}`,
    now: validPreventiveOutboundCallNow,
  });
  await input.store.markProviderStarted({
    attemptId: claim.attempt.id,
    providerAttemptId: `provider-attempt.${token.slice(0, 8)}`,
    providerConversationId: conversationId,
    twilioCallSid: callSid,
    now: validPreventiveOutboundCallNow,
  });
  if (input.status === "answered") {
    await input.store.recordTwilioStatus({
      eventKey: preventiveOutboundCallWebhookEventKey({
        twilioCallSid: callSid,
        providerStatus: "in-progress",
        providerTimestamp: "1",
      }),
      twilioCallSid: callSid,
      providerStatus: "in-progress",
      receivedAt: validPreventiveOutboundCallNow,
    });
  }
  if (input.status === "no_answer") {
    await input.store.recordTwilioStatus({
      eventKey: preventiveOutboundCallWebhookEventKey({
        twilioCallSid: callSid,
        providerStatus: "no-answer",
        providerTimestamp: "1",
      }),
      twilioCallSid: callSid,
      providerStatus: "no-answer",
      receivedAt: validPreventiveOutboundCallNow,
    });
  }
  return { token, attemptId: claim.attempt.id, userId, profileId, conversationId, callSid };
}

function postTwilioStatus(
  store: InMemoryPreventiveOutboundCallStore,
  params: Record<string, string>,
  options: {
    env?: ReturnType<typeof validPreventiveOutboundCallEnv>;
    signatureUrl?: string;
    signatureParams?: Record<string, string>;
    signature?: string;
    host?: string;
    forwardedHost?: string;
    forwardedProto?: string;
  } = {},
) {
  const path = "/api/preventive-outbound-call/twilio/status";
  const signatureUrl = options.signatureUrl ?? `${baseUrl}${path}`;
  const signatureParams = options.signatureParams ?? params;
  const agent = request(app({ store, env: options.env }))
    .post(path)
    .type("form");
  if (options.signature !== undefined) {
    agent.set("X-Twilio-Signature", options.signature);
  } else {
    agent.set("X-Twilio-Signature", signTwilio(signatureUrl, signatureParams));
  }
  if (options.host) agent.set("Host", options.host);
  if (options.forwardedHost) agent.set("X-Forwarded-Host", options.forwardedHost);
  if (options.forwardedProto) agent.set("X-Forwarded-Proto", options.forwardedProto);
  return agent.send(params);
}

function confirm(input: {
  store: InMemoryPreventiveOutboundCallStore;
  token: string;
  conversationId?: string;
  callSid?: string;
  stage4?: ReturnType<typeof stage4Success>;
}) {
  return request(app({ store: input.store, stage4: input.stage4 ?? stage4Success() }))
    .post("/api/preventive-outbound-call/elevenlabs/confirm")
    .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, input.token)
    .send({
      providerConversationId: input.conversationId ?? "conv.task11",
      twilioCallSid: input.callSid ?? twilioCallSid,
      confirmed: true,
    });
}

describe("Task 11 preventive outbound call routes", () => {
  it("proves direct Twilio signature adversarial behavior", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    await createAttempt({ store });
    const params = { CallSid: twilioCallSid, CallStatus: "ringing", SequenceNumber: "1" };
    await postTwilioStatus(store, params).expect(204);
    await request(app({ store }))
      .post("/api/preventive-outbound-call/twilio/status")
      .type("form")
      .send(params)
      .expect(403);
    await postTwilioStatus(store, { ...params, SequenceNumber: "2" }, { signature: "invalid" }).expect(403);
    await postTwilioStatus(
      store,
      { ...params, SequenceNumber: "3" },
      { env: validPreventiveOutboundCallEnv({ TWILIO_AUTH_TOKEN: undefined }) },
    ).expect(403);
    await postTwilioStatus(
      store,
      { ...params, SequenceNumber: "4" },
      { signatureUrl: "https://evil.example.com/api/preventive-outbound-call/twilio/status" },
    ).expect(403);
    await postTwilioStatus(
      store,
      { CallSid: twilioCallSid, CallStatus: "in-progress", SequenceNumber: "5" },
      { signatureParams: { CallSid: twilioCallSid, CallStatus: "ringing", SequenceNumber: "5" } },
    ).expect(403);
    await request(app({ store }))
      .post("/api/preventive-outbound-call/twilio/status")
      .set("X-Twilio-Signature", signTwilio(`${baseUrl}/api/preventive-outbound-call/twilio/status`, params))
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(`CallSid=${twilioCallSid}&CallSid=${secondTwilioCallSid}&CallStatus=ringing&SequenceNumber=6`)
      .expect(403);
    await postTwilioStatus(
      store,
      { ...params, SequenceNumber: "7" },
      {
        signatureUrl: "https://forged.example.com/api/preventive-outbound-call/twilio/status",
        host: "forged.example.com",
      },
    ).expect(403);
    await postTwilioStatus(
      store,
      { ...params, SequenceNumber: "8" },
      {
        signatureUrl: "https://forged.example.com/api/preventive-outbound-call/twilio/status",
        forwardedHost: "forged.example.com",
      },
    ).expect(403);
    await postTwilioStatus(
      store,
      { ...params, SequenceNumber: "9" },
      {
        signatureUrl: "http://vyva.example.com/api/preventive-outbound-call/twilio/status",
        forwardedProto: "http",
      },
    ).expect(403);
  });

  it("rejects unknown, malformed, and wrong-subsystem Twilio CallSid values", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    await postTwilioStatus(store, {
      CallSid: twilioCallSid,
      CallStatus: "ringing",
      SequenceNumber: "1",
    }).expect(404);
    await postTwilioStatus(store, {
      CallSid: "not-a-call-sid",
      CallStatus: "ringing",
      SequenceNumber: "2",
    }).expect(400);
    await postTwilioStatus(store, {
      CallSid: "SM11111111111111111111111111111111",
      CallStatus: "ringing",
      SequenceNumber: "3",
    }).expect(400);
    expect(store.snapshotAttempts()).toHaveLength(0);
  });

  it("keeps replay, duplicate, out-of-order, completed-alone, and terminal-no-answer behavior idempotent", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    const { token } = await createAttempt({ store });
    const ringing = { CallSid: twilioCallSid, CallStatus: "ringing", SequenceNumber: "1" };
    await postTwilioStatus(store, ringing).expect(204);
    await postTwilioStatus(store, ringing).expect(204);
    await postTwilioStatus(store, {
      CallSid: twilioCallSid,
      CallStatus: "completed",
      SequenceNumber: "2",
    }).expect(204);
    await confirm({ store, token }).expect(403);
    await postTwilioStatus(store, {
      CallSid: twilioCallSid,
      CallStatus: "in-progress",
      SequenceNumber: "3",
    }).expect(204);
    await postTwilioStatus(store, {
      CallSid: twilioCallSid,
      CallStatus: "ringing",
      SequenceNumber: "4",
    }).expect(204);
    expect(store.snapshotAttempts()[0]?.status).toBe("answered");

    const second = new InMemoryPreventiveOutboundCallStore();
    await createAttempt({ store: second, token: "n".repeat(43) });
    await postTwilioStatus(second, {
      CallSid: twilioCallSid,
      CallStatus: "no-answer",
      SequenceNumber: "1",
    }).expect(204);
    await postTwilioStatus(second, {
      CallSid: twilioCallSid,
      CallStatus: "in-progress",
      SequenceNumber: "2",
    }).expect(204);
    expect(second.snapshotAttempts()[0]?.status).toBe("no_answer");
  });

  it("requires token plus exact provider conversation and Twilio CallSid before Stage 4 entry", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    const { token } = await createAttempt({ store, token: "c".repeat(43), status: "answered" });
    await request(app({ store }))
      .post("/api/preventive-outbound-call/elevenlabs/confirm")
      .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, token)
      .send({ providerConversationId: "conv.task11", confirmed: true })
      .expect(400);
    await request(app({ store }))
      .post("/api/preventive-outbound-call/elevenlabs/confirm")
      .set(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER, token)
      .send({ twilioCallSid, confirmed: true })
      .expect(400);
    await request(app({ store }))
      .post("/api/preventive-outbound-call/elevenlabs/confirm")
      .send({
        token,
        providerConversationId: "conv.task11",
        twilioCallSid,
        confirmed: true,
      })
      .expect(400);
    await confirm({ store, token, conversationId: "wrong-conv" }).expect(403);
    await confirm({ store, token, callSid: secondTwilioCallSid }).expect(403);
    expect(store.snapshotAttempts()[0]?.status).toBe("answered");
  });

  it("rejects swapped provider identifiers between attempts", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    const first = await createAttempt({
      store,
      token: "d".repeat(43),
      conversationId: "conv.task11.first",
      callSid: twilioCallSid,
      status: "answered",
    });
    const second = await createAttempt({
      store,
      token: "e".repeat(43),
      conversationId: "conv.task11.second",
      callSid: secondTwilioCallSid,
      status: "answered",
    });
    await confirm({ store, token: first.token, conversationId: second.conversationId, callSid: first.callSid }).expect(403);
    await confirm({ store, token: first.token, conversationId: first.conversationId, callSid: second.callSid }).expect(403);
    expect(store.snapshotAttempts().filter((attempt) => attempt.status === "flow_started")).toHaveLength(0);
  });

  it("calls Stage 4 once and records flow_started only after Stage 4 authoritative evidence", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    const stage4 = stage4Success();
    const { token } = await createAttempt({ store, token: "f".repeat(43), status: "answered" });
    await confirm({ store, token, stage4 })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          status: "flow_started",
          flowId: "health.preventive_check",
          flowVersion: "1.0.0",
          nextStep: "continue_preventive_health_flow",
        });
        expect(JSON.stringify(response.body)).not.toContain(token);
      });
    expect(stage4).toHaveBeenCalledTimes(1);
    expect(store.snapshotAttempts()[0]?.status).toBe("flow_started");
    await confirm({ store, token, stage4 }).expect(200);
    expect(stage4).toHaveBeenCalledTimes(1);
  });

  it("leaves Stage 4 rejection recoverable and does not mark flow_started", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    const rejectOnce = vi.fn(async (): Promise<PreventiveHealthFlowEntryStartOutcome> => ({
      outcome: "rejected",
      reasonCode: "preventive_health_flow_persistence_failed",
    }));
    const { token } = await createAttempt({ store, token: "g".repeat(43), status: "answered" });
    await confirm({ store, token, stage4: rejectOnce as never }).expect(409);
    expect(store.snapshotAttempts()[0]?.status).toBe("identity_confirmed");
    const success = stage4Success();
    await confirm({ store, token, stage4: success }).expect(200);
    expect(success).toHaveBeenCalledTimes(1);
    expect(store.snapshotAttempts()[0]?.status).toBe("flow_started");
  });

  it("bounds concurrent confirmation so only one Stage 4 entry is requested", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    const stage4 = vi.fn(async (input: { sessionId: string }): Promise<PreventiveHealthFlowEntryStartOutcome> => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        outcome: "started",
        flowId: "health.preventive_check",
        flowVersion: "1.0.0",
        sessionId: input.sessionId,
        evidenceReference: `stage4.entry.${input.sessionId}`,
        result: {} as never,
        flagResolution: {} as never,
      };
    });
    const { token } = await createAttempt({ store, token: "h".repeat(43), status: "answered" });
    const responses = await Promise.all([
      confirm({ store, token, stage4: stage4 as never }),
      confirm({ store, token, stage4: stage4 as never }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(stage4).toHaveBeenCalledTimes(1);
  });

  it("blocks revoked consent after answer and never calls Stage 4", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    const stage4 = stage4Success();
    const { token } = await createAttempt({ store, token: "i".repeat(43), status: "answered" });
    await store.revokeConsent({
      userId: "user.test",
      profileId: "profile.test.elder",
      now: new Date("2026-08-03T12:01:00.000Z"),
    });
    await confirm({ store, token, stage4 }).expect(403);
    await postTwilioStatus(store, {
      CallSid: twilioCallSid,
      CallStatus: "completed",
      SequenceNumber: "99",
    }).expect(204);
    expect(stage4).not.toHaveBeenCalled();
    expect(store.snapshotAttempts()[0]?.status).toBe("answered");
  });
});
