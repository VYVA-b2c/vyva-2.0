import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  proactiveDescriptorSafeDeepInertClone,
  proactiveEngagementEvaluationInputSchema,
  proactiveOpaqueIdSchema,
  type ProactiveEngagementEvaluationInput,
} from "../../shared/engagement/proactiveEngagement.js";
import {
  createProactiveEngagementAudit,
  defaultProactiveEngagementAuditStore,
  type ProactiveEngagementAuditStore,
} from "./proactiveAuditPersistence.js";
import { evaluateParsedProactiveEngagementPolicy } from "./proactivePolicy.js";
import {
  resolvePreventiveOutboundCallFlag,
  type PreventiveOutboundCallEnvironmentMap,
} from "./preventiveOutboundCallFeatureFlags.js";
import {
  createDefaultPreventiveOutboundCallProvider,
  type PreventiveOutboundCallProvider,
} from "./preventiveOutboundCallProvider.js";
import {
  defaultPreventiveOutboundCallStore,
  type PreventiveOutboundCallStore,
} from "./preventiveOutboundCallStore.js";
import {
  generatePreventiveOutboundCallConfirmationToken,
  PREVENTIVE_OUTBOUND_CALL_CHANNEL,
  PREVENTIVE_OUTBOUND_CALL_FLOW_ID,
  PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION,
  PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID,
} from "./preventiveOutboundCallSecurity.js";

const preventiveOutboundCallRuntimeInputSchema = z.object({
  userId: proactiveOpaqueIdSchema,
  profileId: proactiveOpaqueIdSchema,
  evaluationInput: proactiveEngagementEvaluationInputSchema,
}).strict();

export type PreventiveOutboundCallRuntimeInput =
  z.infer<typeof preventiveOutboundCallRuntimeInputSchema>;

export type PreventiveOutboundCallRuntimeOutcome =
  | "audit_persistence_failed"
  | "call_duplicate"
  | "call_pending"
  | "delivery_uncertain"
  | "flag_disabled"
  | "invalid_input"
  | "not_consented"
  | "phone_not_verified"
  | "policy_blocked"
  | "provider_config_unavailable"
  | "provider_failed_permanent"
  | "provider_failed_retryable"
  | "provider_started"
  | "task8_not_voice_call";

export type PreventiveOutboundCallRuntimeResult = Readonly<{
  outcome: PreventiveOutboundCallRuntimeOutcome;
  providerStarted: boolean;
  channel: typeof PREVENTIVE_OUTBOUND_CALL_CHANNEL;
  flowId: typeof PREVENTIVE_OUTBOUND_CALL_FLOW_ID;
  flowVersion: typeof PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION;
  fallbackAttempted: false;
  auditOnlyTask8Evaluated: boolean;
  callAttemptId?: string;
  policyAuditId?: string;
  providerConversationId?: string | null;
  twilioCallSid?: string | null;
  reason?: string;
}>;

export type PreventiveOutboundCallRuntimeDependencies = Readonly<{
  auditStore?: ProactiveEngagementAuditStore;
  callStore?: PreventiveOutboundCallStore;
  provider?: PreventiveOutboundCallProvider | null;
  env?: PreventiveOutboundCallEnvironmentMap;
  currentTime?: () => Date;
  idFactory?: () => string;
}>;

export type PreventiveOutboundCallConsentRevocationResult = Readonly<{
  outcome: "revoked" | "unavailable";
  cancellationAttempts: number;
  cancellationAccepted: number;
  cancellationFailed: number;
  cancellationUncertain: number;
}>;

function result(
  outcome: PreventiveOutboundCallRuntimeOutcome,
  options: Partial<Omit<PreventiveOutboundCallRuntimeResult, "outcome" | "providerStarted" | "channel" | "flowId" | "flowVersion" | "fallbackAttempted">> = {},
): PreventiveOutboundCallRuntimeResult {
  return {
    outcome,
    providerStarted: outcome === "provider_started",
    channel: PREVENTIVE_OUTBOUND_CALL_CHANNEL,
    flowId: PREVENTIVE_OUTBOUND_CALL_FLOW_ID,
    flowVersion: PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION,
    fallbackAttempted: false,
    auditOnlyTask8Evaluated: options.auditOnlyTask8Evaluated ?? false,
    ...(options.callAttemptId ? { callAttemptId: options.callAttemptId } : {}),
    ...(options.policyAuditId ? { policyAuditId: options.policyAuditId } : {}),
    ...(options.providerConversationId !== undefined ? { providerConversationId: options.providerConversationId } : {}),
    ...(options.twilioCallSid !== undefined ? { twilioCallSid: options.twilioCallSid } : {}),
    ...(options.reason ? { reason: options.reason } : {}),
  };
}

function safeNow(provider: () => Date): Date | null {
  try {
    const value = provider();
    return value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
  } catch {
    return null;
  }
}

function buildClaimExpiry(now: Date): Date {
  return new Date(now.getTime() + 2 * 60 * 1_000);
}

function buildConfirmationTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + 15 * 60 * 1_000);
}

function parseInput(rawInput: unknown): PreventiveOutboundCallRuntimeInput | null {
  let inert: unknown;
  try {
    inert = proactiveDescriptorSafeDeepInertClone(rawInput);
  } catch {
    return null;
  }
  const parsed = preventiveOutboundCallRuntimeInputSchema.safeParse(inert);
  return parsed.success ? parsed.data : null;
}

function hasStage6Shape(input: ProactiveEngagementEvaluationInput): boolean {
  return input.purposeId === PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID &&
    input.channelCandidates.some((candidate) =>
      candidate.purposeId === PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID &&
      candidate.channel === PREVENTIVE_OUTBOUND_CALL_CHANNEL
    );
}

function confirmationUrl(env: PreventiveOutboundCallEnvironmentMap): string | null {
  const base = env.VYVA_PREVENTIVE_OUTBOUND_CALL_PUBLIC_WEBHOOK_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/u, "")}/api/preventive-outbound-call/elevenlabs/confirm`;
}

export async function runPreventiveOutboundCallEntry(
  rawInput: unknown,
  dependencies: PreventiveOutboundCallRuntimeDependencies = {},
): Promise<PreventiveOutboundCallRuntimeResult> {
  const input = parseInput(rawInput);
  if (!input) return result("invalid_input");

  const nowProvider = dependencies.currentTime ?? (() => new Date());
  const now = safeNow(nowProvider);
  if (!now) return result("invalid_input");

  const evaluation = evaluateParsedProactiveEngagementPolicy(input.evaluationInput);
  if (!evaluation.ok) return result("invalid_input");

  const audit = createProactiveEngagementAudit({
    evaluationInput: evaluation.input,
    decision: evaluation.decision,
    decisionDigest: evaluation.decisionDigest,
    idempotencyKey: evaluation.idempotencyKey,
  });
  const auditStore = dependencies.auditStore ?? defaultProactiveEngagementAuditStore;
  const auditWrite = await auditStore.writeAudit(audit);
  if (auditWrite.outcome !== "stored" && auditWrite.outcome !== "duplicate") {
    return result("audit_persistence_failed", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
      reason: auditWrite.reason,
    });
  }

  if (!hasStage6Shape(input.evaluationInput)) {
    return result("task8_not_voice_call", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
    });
  }
  if (evaluation.decision.decision !== "allow" ||
    evaluation.decision.proposedChannel !== PREVENTIVE_OUTBOUND_CALL_CHANNEL) {
    return result("policy_blocked", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
      reason: evaluation.decision.reasonCodes.join(","),
    });
  }

  const env = dependencies.env ?? process.env;
  const flag = resolvePreventiveOutboundCallFlag({
    env,
    userRef: input.profileId,
    now,
  });
  if (flag.effectiveMode !== "pilot") {
    return result("flag_disabled", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
      reason: flag.reasonCode,
    });
  }

  const callStore = dependencies.callStore ?? defaultPreventiveOutboundCallStore;
  const consent = await callStore.readConsent({
    userId: input.userId,
    profileId: input.profileId,
  });
  if (!consent.enabled) {
    return result("not_consented", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
    });
  }
  if (!consent.phoneE164 || !consent.phoneDigest || !consent.phoneVerifiedAt) {
    return result("phone_not_verified", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
    });
  }

  const provider = dependencies.provider === undefined
    ? createDefaultPreventiveOutboundCallProvider(env)
    : dependencies.provider;
  if (!provider) {
    return result("provider_config_unavailable", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
    });
  }
  const callbackUrl = confirmationUrl(env);
  if (!callbackUrl) {
    return result("provider_config_unavailable", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
      reason: "confirmation_url_missing",
    });
  }

  const confirmationToken = generatePreventiveOutboundCallConfirmationToken();
  const claimToken = dependencies.idFactory?.() ?? randomUUID();
  const claim = await callStore.acquireCallClaim({
    userId: input.userId,
    profileId: input.profileId,
    scheduleOccurrenceId: input.evaluationInput.scheduleOccurrenceId,
    scheduleId: input.evaluationInput.scheduleId,
    consent,
    policyAuditId: audit.auditId,
    policyDecisionDigest: evaluation.decisionDigest,
    claimToken,
    claimExpiresAt: buildClaimExpiry(now),
    confirmationTokenDigest: confirmationToken.tokenDigest,
    confirmationTokenExpiresAt: buildConfirmationTokenExpiry(now),
    now,
  });
  if (claim.outcome === "duplicate") {
    return result("call_duplicate", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: claim.attempt.id,
      policyAuditId: audit.auditId,
    });
  }
  if (claim.outcome === "pending") {
    return result("call_pending", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: claim.attempt.id,
      policyAuditId: audit.auditId,
    });
  }
  if (claim.outcome === "uncertain") {
    return result("delivery_uncertain", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: claim.attempt.id,
      policyAuditId: audit.auditId,
    });
  }
  if (claim.outcome !== "acquired") {
    return result("audit_persistence_failed", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
      reason: claim.reason,
    });
  }

  const providerAttemptId = dependencies.idFactory?.() ?? randomUUID();
  const providerAttempt = await callStore.markProviderAttemptStarted({
    attemptId: claim.attempt.id,
    claimToken,
    providerAttemptId,
    now,
  });
  if (providerAttempt.outcome === "duplicate") {
    return result("call_duplicate", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: providerAttempt.attempt.id,
      policyAuditId: audit.auditId,
    });
  }
  if (providerAttempt.outcome === "pending") {
    return result("call_pending", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: providerAttempt.attempt.id,
      policyAuditId: audit.auditId,
    });
  }
  if (providerAttempt.outcome === "uncertain") {
    return result("delivery_uncertain", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: providerAttempt.attempt.id,
      policyAuditId: audit.auditId,
    });
  }
  if (providerAttempt.outcome !== "started") {
    return result("audit_persistence_failed", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: claim.attempt.id,
      policyAuditId: audit.auditId,
      reason: providerAttempt.reason,
    });
  }

  const latestConsent = await callStore.readConsent({ userId: input.userId, profileId: input.profileId });
  if (!latestConsent.enabled || latestConsent.revision !== consent.revision) {
    await callStore.markProviderFailed({
      attemptId: claim.attempt.id,
      providerAttemptId,
      status: "failed_permanent",
      reason: "consent_revoked_before_dispatch",
      now,
    }).catch(() => {});
    return result("not_consented", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: claim.attempt.id,
      policyAuditId: audit.auditId,
    });
  }

  const start = await provider.start({
    callAttemptId: claim.attempt.id,
    phoneE164: consent.phoneE164,
    confirmationToken: confirmationToken.token,
    callbackUrl,
  });
  if (start.outcome === "started") {
    const recorded = await callStore.markProviderStarted({
      attemptId: claim.attempt.id,
      providerAttemptId,
      providerConversationId: start.providerConversationId,
      twilioCallSid: start.twilioCallSid,
      now,
    });
    if (recorded.outcome !== "recorded") {
      await callStore.markProviderFailed({
        attemptId: claim.attempt.id,
        providerAttemptId,
        status: "delivery_uncertain",
        reason: "provider_started_persistence_unavailable",
        now,
      }).catch(() => {});
      return result("delivery_uncertain", {
        auditOnlyTask8Evaluated: true,
        callAttemptId: claim.attempt.id,
        policyAuditId: audit.auditId,
      });
    }
    return result("provider_started", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: claim.attempt.id,
      policyAuditId: audit.auditId,
      providerConversationId: start.providerConversationId,
      twilioCallSid: start.twilioCallSid,
    });
  }

  await callStore.markProviderFailed({
    attemptId: claim.attempt.id,
    providerAttemptId,
    status: start.outcome,
    reason: start.reason,
    now,
  });
  if (start.outcome === "delivery_uncertain") {
    return result("delivery_uncertain", {
      auditOnlyTask8Evaluated: true,
      callAttemptId: claim.attempt.id,
      policyAuditId: audit.auditId,
      reason: start.reason,
    });
  }
  return result(start.outcome === "failed_permanent" ? "provider_failed_permanent" : "provider_failed_retryable", {
    auditOnlyTask8Evaluated: true,
    callAttemptId: claim.attempt.id,
    policyAuditId: audit.auditId,
    reason: start.reason,
  });
}

export async function revokePreventiveOutboundCallConsent(
  input: { userId: string; profileId: string },
  dependencies: Pick<PreventiveOutboundCallRuntimeDependencies, "callStore" | "provider" | "env" | "currentTime"> = {},
): Promise<PreventiveOutboundCallConsentRevocationResult> {
  const nowProvider = dependencies.currentTime ?? (() => new Date());
  const now = safeNow(nowProvider);
  if (!now) {
    return {
      outcome: "unavailable",
      cancellationAttempts: 0,
      cancellationAccepted: 0,
      cancellationFailed: 0,
      cancellationUncertain: 0,
    };
  }
  const callStore = dependencies.callStore ?? defaultPreventiveOutboundCallStore;
  const revoked = await callStore.revokeConsentAndClaimCancellations({
    userId: input.userId,
    profileId: input.profileId,
    now,
  });
  if (revoked.outcome !== "revoked") {
    return {
      outcome: "unavailable",
      cancellationAttempts: 0,
      cancellationAccepted: 0,
      cancellationFailed: 0,
      cancellationUncertain: 0,
    };
  }
  const provider = dependencies.provider === undefined
    ? createDefaultPreventiveOutboundCallProvider(dependencies.env ?? process.env)
    : dependencies.provider;
  let cancellationAccepted = 0;
  let cancellationFailed = 0;
  let cancellationUncertain = 0;
  for (const attempt of revoked.cancellationCandidates) {
    if (!attempt.twilioCallSid) continue;
    if (!provider?.cancel) {
      cancellationUncertain += 1;
      await callStore.recordCancellationResult({
        attemptId: attempt.id,
        twilioCallSid: attempt.twilioCallSid,
        status: "uncertain",
        reason: "provider_cancel_unavailable",
        now,
      }).catch(() => {});
      continue;
    }
    const cancellation = await provider.cancel({
      twilioCallSid: attempt.twilioCallSid,
      providerConversationId: attempt.providerConversationId,
    });
    if (cancellation.outcome === "cancel_requested") {
      cancellationAccepted += 1;
      await callStore.recordCancellationResult({
        attemptId: attempt.id,
        twilioCallSid: attempt.twilioCallSid,
        status: "accepted",
        reason: "provider_cancel_requested",
        now,
      }).catch(() => {});
    } else {
      if (cancellation.outcome === "unsupported") {
        cancellationUncertain += 1;
      } else {
        cancellationFailed += 1;
      }
      await callStore.recordCancellationResult({
        attemptId: attempt.id,
        twilioCallSid: attempt.twilioCallSid,
        status: cancellation.outcome === "unsupported" ? "uncertain" : "failed",
        reason: cancellation.reason ?? cancellation.outcome,
        now,
      }).catch(() => {});
    }
  }
  return {
    outcome: "revoked",
    cancellationAttempts: revoked.cancellationCandidates.length,
    cancellationAccepted,
    cancellationFailed,
    cancellationUncertain,
  };
}
