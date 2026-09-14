import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import { verifyTwilioSignature } from "../lib/webhookVerification.js";
import { type PreventiveOutboundCallEnvironmentMap } from "../engagement/preventiveOutboundCallFeatureFlags.js";
import {
  defaultPreventiveOutboundCallStore,
  preventiveOutboundCallWebhookEventKey,
  type PreventiveOutboundCallStore,
} from "../engagement/preventiveOutboundCallStore.js";
import {
  parsePreventiveOutboundCallConfirmationToken,
  preventiveOutboundCallConfirmationBodySchema,
  normalizePublicWebhookBaseUrl,
  PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER,
  PREVENTIVE_OUTBOUND_CALL_TWILIO_CALL_SID_PATTERN,
} from "../engagement/preventiveOutboundCallSecurity.js";
import {
  startPreventiveHealthFlowForEntry,
  type PreventiveHealthFlowEntryStartOutcome,
} from "../health/preventiveHealthOrchestrator.js";

export type PreventiveOutboundCallRouterDependencies = Readonly<{
  store?: PreventiveOutboundCallStore;
  env?: PreventiveOutboundCallEnvironmentMap;
  currentTime?: () => Date;
  idFactory?: () => string;
  stage4FlowEntry?: typeof startPreventiveHealthFlowForEntry;
}>;

function safeNow(provider: () => Date): Date {
  const value = provider();
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : new Date();
}

function publicBaseUrl(env: PreventiveOutboundCallEnvironmentMap): string | null {
  const normalized = normalizePublicWebhookBaseUrl(env.VYVA_PREVENTIVE_OUTBOUND_CALL_PUBLIC_WEBHOOK_BASE_URL);
  return normalized.ok ? normalized.baseUrl : null;
}

function recordBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasAmbiguousFormParameter(value: Record<string, unknown>): boolean {
  return Object.values(value).some((item) => Array.isArray(item));
}

function twilioSignatureValid(req: Request, env: PreventiveOutboundCallEnvironmentMap): boolean {
  const authToken = env.TWILIO_AUTH_TOKEN;
  const baseUrl = publicBaseUrl(env);
  if (!authToken || !baseUrl) return false;
  const params = recordBody(req.body);
  if (hasAmbiguousFormParameter(params)) return false;
  return verifyTwilioSignature({
    authToken,
    signature: req.header("X-Twilio-Signature"),
    url: `${baseUrl}${req.originalUrl}`,
    params,
  });
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const TWILIO_CALL_STATUSES = new Set([
  "queued",
  "initiated",
  "ringing",
  "in-progress",
  "completed",
  "no-answer",
  "busy",
  "failed",
  "canceled",
]);

export function createPreventiveOutboundCallRouter(
  dependencies: PreventiveOutboundCallRouterDependencies = {},
) {
  const router = Router();
  const store = dependencies.store ?? defaultPreventiveOutboundCallStore;
  const env = dependencies.env ?? process.env;
  const currentTime = dependencies.currentTime ?? (() => new Date());
  const idFactory = dependencies.idFactory ?? (() => randomUUID());
  const stage4FlowEntry = dependencies.stage4FlowEntry ?? startPreventiveHealthFlowForEntry;

  router.post("/twilio/status", async (req, res) => {
    if (!twilioSignatureValid(req, env)) {
      return res.sendStatus(403);
    }
    const body = recordBody(req.body);
    const twilioCallSid = text(body.CallSid);
    const providerStatus = text(body.CallStatus);
    if (!twilioCallSid ||
      !providerStatus ||
      !PREVENTIVE_OUTBOUND_CALL_TWILIO_CALL_SID_PATTERN.test(twilioCallSid) ||
      !TWILIO_CALL_STATUSES.has(providerStatus)) {
      return res.sendStatus(400);
    }
    const eventKey = preventiveOutboundCallWebhookEventKey({
      twilioCallSid,
      providerStatus,
      providerTimestamp: text(body.Timestamp) ?? text(body.SequenceNumber) ?? null,
    });
    const recorded = await store.recordTwilioStatus({
      eventKey,
      twilioCallSid,
      providerStatus,
      receivedAt: safeNow(currentTime),
    });
    if (recorded.outcome === "unknown_call") return res.sendStatus(404);
    if (recorded.outcome === "unavailable") return res.sendStatus(503);
    return res.sendStatus(204);
  });

  router.post("/elevenlabs/confirm", async (req, res) => {
    const parsed = preventiveOutboundCallConfirmationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, reason: "invalid_request" });
    }
    const token = parsePreventiveOutboundCallConfirmationToken(req.header(PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER));
    if (!token.ok) {
      return res.status(400).json({ ok: false, reason: "invalid_token" });
    }
    const now = safeNow(currentTime);
    const claimed = await store.claimConfirmedFlowEntry({
      tokenDigest: token.tokenDigest,
      providerConversationId: parsed.data.providerConversationId,
      twilioCallSid: parsed.data.twilioCallSid,
      flowEntryClaimToken: idFactory(),
      flowEntryClaimExpiresAt: new Date(now.getTime() + 2 * 60_000),
      now,
    });
    if (claimed.outcome === "already_started") {
      return res.json({
        ok: true,
        status: "already_started",
        flowId: "health.preventive_check",
        flowVersion: "1.0.0",
        callAttemptId: claimed.attempt.id,
        nextStep: "continue_preventive_health_flow",
      });
    }
    if (claimed.outcome === "flow_entry_started") {
      let entry: PreventiveHealthFlowEntryStartOutcome;
      try {
        entry = await stage4FlowEntry({
          userId: claimed.attempt.userId,
          profileId: claimed.attempt.profileId,
          sessionId: `task11.outbound_call.${claimed.attempt.id}`,
          triggerReference: `task11.outbound_call.${claimed.attempt.id}`,
          env,
          now,
        });
      } catch {
        entry = { outcome: "rejected", reasonCode: "preventive_health_flow_runtime_failed" };
      }
      if (entry.outcome === "rejected") {
        await store.markFlowEntryFailed({
          attemptId: claimed.attempt.id,
          flowEntryClaimToken: claimed.flowEntryClaimToken,
          reason: entry.reasonCode,
          now,
        }).catch(() => {});
        return res.status(409).json({ ok: false, reason: entry.reasonCode });
      }
      const finalized = await store.markFlowStarted({
        attemptId: claimed.attempt.id,
        flowEntryClaimToken: claimed.flowEntryClaimToken,
        flowEntryEvidence: {
          flowId: entry.flowId,
          flowVersion: entry.flowVersion,
          sessionId: entry.sessionId,
          evidenceReference: entry.evidenceReference,
          status: entry.outcome,
        },
        now,
      });
      if (finalized.outcome === "flow_started" || finalized.outcome === "already_started") {
        return res.json({
          ok: true,
          status: "flow_started",
          flowId: finalized.flowEntryEvidence.flowId,
          flowVersion: finalized.flowEntryEvidence.flowVersion,
          callAttemptId: finalized.attempt.id,
          nextStep: "continue_preventive_health_flow",
        });
      }
      return res.status(409).json({ ok: false, reason: finalized.outcome });
    }
    if (claimed.outcome === "entry_pending") {
      return res.status(409).json({ ok: false, reason: "flow_entry_pending" });
    }
    if (claimed.outcome === "expired") {
      return res.status(410).json({ ok: false, reason: "confirmation_expired" });
    }
    if (claimed.outcome === "unavailable") {
      return res.status(503).json({ ok: false, reason: "confirmation_unavailable" });
    }
    return res.status(403).json({ ok: false, reason: claimed.outcome });
  });

  return router;
}

export default createPreventiveOutboundCallRouter();
