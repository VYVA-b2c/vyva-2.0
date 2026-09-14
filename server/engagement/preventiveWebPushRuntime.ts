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
  resolvePreventiveWebPushFlag,
  type PreventiveWebPushEnvironmentMap,
} from "./preventiveWebPushFeatureFlags.js";
import {
  createDefaultPreventiveWebPushProvider,
  type PreventiveWebPushProvider,
} from "./preventiveWebPushProvider.js";
import {
  defaultPreventiveWebPushStore,
  type PreventiveWebPushStore,
} from "./preventiveWebPushStore.js";
import {
  generatePreventiveWebPushEntryToken,
  PREVENTIVE_WEB_PUSH_CHANNEL,
  PREVENTIVE_WEB_PUSH_FLOW_ID,
  PREVENTIVE_WEB_PUSH_FLOW_VERSION,
  PREVENTIVE_WEB_PUSH_PURPOSE_ID,
} from "./preventiveWebPushSecurity.js";

const preventiveWebPushRuntimeInputSchema = z.object({
  userId: proactiveOpaqueIdSchema,
  evaluationInput: proactiveEngagementEvaluationInputSchema,
}).strict();

export type PreventiveWebPushRuntimeInput = z.infer<typeof preventiveWebPushRuntimeInputSchema>;

export type PreventiveWebPushRuntimeOutcome =
  | "audit_persistence_failed"
  | "delivery_duplicate"
  | "delivery_uncertain"
  | "delivery_pending"
  | "flag_disabled"
  | "invalid_input"
  | "no_active_subscription"
  | "policy_blocked"
  | "provider_config_unavailable"
  | "provider_failed_permanent"
  | "provider_failed_retryable"
  | "sent"
  | "subscription_not_consented"
  | "task8_not_web_push";

export type PreventiveWebPushRuntimeResult = Readonly<{
  outcome: PreventiveWebPushRuntimeOutcome;
  sent: boolean;
  channel: typeof PREVENTIVE_WEB_PUSH_CHANNEL;
  flowId: typeof PREVENTIVE_WEB_PUSH_FLOW_ID;
  flowVersion: typeof PREVENTIVE_WEB_PUSH_FLOW_VERSION;
  fallbackAttempted: false;
  auditOnlyTask8Evaluated: boolean;
  deliveryId?: string;
  policyAuditId?: string;
  reason?: string;
}>;

export type PreventiveWebPushRuntimeDependencies = Readonly<{
  auditStore?: ProactiveEngagementAuditStore;
  pushStore?: PreventiveWebPushStore;
  provider?: PreventiveWebPushProvider | null;
  env?: PreventiveWebPushEnvironmentMap;
  currentTime?: () => Date;
  idFactory?: () => string;
}>;

function result(
  outcome: PreventiveWebPushRuntimeOutcome,
  options: Partial<Omit<PreventiveWebPushRuntimeResult, "outcome" | "sent" | "channel" | "flowId" | "flowVersion" | "fallbackAttempted">> = {},
): PreventiveWebPushRuntimeResult {
  return {
    outcome,
    sent: outcome === "sent",
    channel: PREVENTIVE_WEB_PUSH_CHANNEL,
    flowId: PREVENTIVE_WEB_PUSH_FLOW_ID,
    flowVersion: PREVENTIVE_WEB_PUSH_FLOW_VERSION,
    fallbackAttempted: false,
    auditOnlyTask8Evaluated: options.auditOnlyTask8Evaluated ?? false,
    ...(options.deliveryId ? { deliveryId: options.deliveryId } : {}),
    ...(options.policyAuditId ? { policyAuditId: options.policyAuditId } : {}),
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

function buildTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + 30 * 60 * 1_000);
}

function parseInput(rawInput: unknown): PreventiveWebPushRuntimeInput | null {
  let inert: unknown;
  try {
    inert = proactiveDescriptorSafeDeepInertClone(rawInput);
  } catch {
    return null;
  }
  const parsed = preventiveWebPushRuntimeInputSchema.safeParse(inert);
  return parsed.success ? parsed.data : null;
}

function hasStage5Shape(input: ProactiveEngagementEvaluationInput): boolean {
  return input.purposeId === PREVENTIVE_WEB_PUSH_PURPOSE_ID &&
    input.channelCandidates.some((candidate) =>
      candidate.purposeId === PREVENTIVE_WEB_PUSH_PURPOSE_ID &&
      candidate.channel === PREVENTIVE_WEB_PUSH_CHANNEL
    );
}

export async function runPreventiveWebPushEntry(
  rawInput: unknown,
  dependencies: PreventiveWebPushRuntimeDependencies = {},
): Promise<PreventiveWebPushRuntimeResult> {
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

  if (!hasStage5Shape(input.evaluationInput)) {
    return result("task8_not_web_push", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
    });
  }
  if (evaluation.decision.decision !== "allow" ||
    evaluation.decision.proposedChannel !== PREVENTIVE_WEB_PUSH_CHANNEL) {
    return result("policy_blocked", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
      reason: evaluation.decision.reasonCodes.join(","),
    });
  }

  const env = dependencies.env ?? process.env;
  const flag = resolvePreventiveWebPushFlag({
    env,
    cohortKey: input.evaluationInput.scheduleOccurrenceId,
    userRef: input.userId,
  });
  if (flag.effectiveMode !== "pilot") {
    return result("flag_disabled", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
      reason: flag.reasonCode,
    });
  }

  const pushStore = dependencies.pushStore ?? defaultPreventiveWebPushStore;
  const consent = await pushStore.readConsent(input.userId);
  if (!consent.enabled) {
    return result("subscription_not_consented", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
    });
  }

  const subscription = await pushStore.activeSubscription(input.userId);
  if (!subscription) {
    return result("no_active_subscription", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
    });
  }

  const provider = dependencies.provider === undefined
    ? createDefaultPreventiveWebPushProvider(env)
    : dependencies.provider;
  if (!provider) {
    return result("provider_config_unavailable", {
      auditOnlyTask8Evaluated: true,
      policyAuditId: audit.auditId,
    });
  }

  const entryToken = generatePreventiveWebPushEntryToken();
  const claimToken = dependencies.idFactory?.() ?? randomUUID();
  const claim = await pushStore.acquireDeliveryClaim({
    userId: input.userId,
    subscriptionId: subscription.id,
    scheduleOccurrenceId: input.evaluationInput.scheduleOccurrenceId,
    scheduleId: input.evaluationInput.scheduleId,
    policyAuditId: audit.auditId,
    policyDecisionDigest: evaluation.decisionDigest,
    entryTokenDigest: entryToken.tokenDigest,
    claimToken,
    claimExpiresAt: buildClaimExpiry(now),
    now,
  });
  if (claim.outcome === "duplicate") {
    return result("delivery_duplicate", {
      auditOnlyTask8Evaluated: true,
      deliveryId: claim.delivery.id,
      policyAuditId: audit.auditId,
    });
  }
  if (claim.outcome === "pending") {
    return result("delivery_pending", {
      auditOnlyTask8Evaluated: true,
      deliveryId: claim.delivery.id,
      policyAuditId: audit.auditId,
    });
  }
  if (claim.outcome === "uncertain") {
    return result("delivery_uncertain", {
      auditOnlyTask8Evaluated: true,
      deliveryId: claim.delivery.id,
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
  const providerAttempt = await pushStore.markProviderAttemptStarted({
    deliveryId: claim.delivery.id,
    claimToken,
    providerAttemptId,
    now,
  });
  if (providerAttempt.outcome === "duplicate") {
    return result("delivery_duplicate", {
      auditOnlyTask8Evaluated: true,
      deliveryId: providerAttempt.delivery.id,
      policyAuditId: audit.auditId,
    });
  }
  if (providerAttempt.outcome === "pending") {
    return result("delivery_pending", {
      auditOnlyTask8Evaluated: true,
      deliveryId: providerAttempt.delivery.id,
      policyAuditId: audit.auditId,
    });
  }
  if (providerAttempt.outcome === "uncertain") {
    return result("delivery_uncertain", {
      auditOnlyTask8Evaluated: true,
      deliveryId: providerAttempt.delivery.id,
      policyAuditId: audit.auditId,
    });
  }
  if (providerAttempt.outcome !== "started") {
    return result("audit_persistence_failed", {
      auditOnlyTask8Evaluated: true,
      deliveryId: claim.delivery.id,
      policyAuditId: audit.auditId,
      reason: providerAttempt.reason,
    });
  }

  const tokenWrite = await pushStore.recordEntryToken({
    deliveryId: claim.delivery.id,
    userId: input.userId,
    tokenDigest: entryToken.tokenDigest,
    scheduleOccurrenceId: input.evaluationInput.scheduleOccurrenceId,
    issuedAt: now,
    expiresAt: buildTokenExpiry(now),
  });
  if (tokenWrite.outcome !== "stored" && tokenWrite.outcome !== "duplicate") {
    await pushStore.markDeliveryFailed({
      deliveryId: claim.delivery.id,
      status: "failed_retryable",
      providerStatus: null,
      reason: "entry_token_persistence_unavailable",
      providerAttemptId,
      now,
    }).catch(() => {});
    return result("provider_failed_retryable", {
      auditOnlyTask8Evaluated: true,
      deliveryId: claim.delivery.id,
      policyAuditId: audit.auditId,
      reason: tokenWrite.outcome,
    });
  }

  const send = await provider.send({
    subscription: {
      endpoint: subscription.endpoint,
      endpointDigest: subscription.endpointDigest,
      expirationTime: null,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      contentEncoding: subscription.contentEncoding,
      userAgent: null,
    },
    payload: {
      type: "vyva.preventive_check",
      token: entryToken.token,
    },
  });
  if (send.outcome === "sent") {
    const accepted = await pushStore.markProviderAccepted({
      deliveryId: claim.delivery.id,
      providerAttemptId,
      providerStatus: send.providerStatus,
      now,
    });
    if (accepted.outcome !== "recorded") {
      return result("delivery_uncertain", {
        auditOnlyTask8Evaluated: true,
        deliveryId: claim.delivery.id,
        policyAuditId: audit.auditId,
        reason: accepted.outcome,
      });
    }
    try {
      await pushStore.markDeliverySent({
        deliveryId: claim.delivery.id,
        providerAttemptId,
        providerStatus: send.providerStatus,
        now,
      });
      return result("sent", {
        auditOnlyTask8Evaluated: true,
        deliveryId: claim.delivery.id,
        policyAuditId: audit.auditId,
      });
    } catch {
      return result("delivery_uncertain", {
        auditOnlyTask8Evaluated: true,
        deliveryId: claim.delivery.id,
        policyAuditId: audit.auditId,
        reason: "sent_persistence_unavailable",
      });
    }
  }

  await pushStore.markDeliveryFailed({
    deliveryId: claim.delivery.id,
    status: send.outcome,
    providerStatus: send.providerStatus,
    reason: send.reason,
    subscriptionId: subscription.id,
    providerAttemptId,
    now,
  });
  return result(send.outcome === "failed_permanent" ? "provider_failed_permanent" : "provider_failed_retryable", {
      auditOnlyTask8Evaluated: true,
      deliveryId: claim.delivery.id,
      policyAuditId: audit.auditId,
      reason: send.reason,
    });
}
