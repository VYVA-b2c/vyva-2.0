import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { profiles } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import {
  PROACTIVE_ENGAGEMENT_POLICY_VERSION,
  PROACTIVE_ENGAGEMENT_SCHEMA_VERSION,
  type ProactiveAttemptOutcome,
  type ProactiveAttemptSummary,
  type ProactiveConsentFact,
  type ProactiveConsentState,
  type ProactiveEngagementEvaluationInput,
  type ProactiveLimitPolicy,
  type ProactiveSourceClassification,
} from "../../shared/engagement/proactiveEngagement.js";
import { PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID } from "./preventiveOutboundCallSecurity.js";
import {
  defaultPreventiveOutboundCallStore,
  type PreventiveOutboundCallAttemptRecord,
  type PreventiveOutboundCallAttemptStatus,
  type PreventiveOutboundCallConsentState,
  type PreventiveOutboundCallStore,
} from "./preventiveOutboundCallStore.js";
import type { PreventiveOutboundCallRuntimeInput } from "./preventiveOutboundCallRuntime.js";

/**
 * One dedicated "Proactive Outreach" identity handles all outbound contact,
 * regardless of which domain (Wellness Coach, Scam Protector, ...) noticed
 * the need. A detector job only has to describe *why* it wants to reach the
 * user; this module turns that into the ~20-field contract
 * server/engagement/proactivePolicy.ts actually requires, and everything
 * shares the SAME purposeId so cooldown/frequency limits apply across the
 * whole roster, not per-domain (a call from the silence detector counts
 * against the same daily limit as one from the signal detector).
 */
export type ProactiveOutreachCandidate = Readonly<{
  userId: string;
  profileId: string;
  /** Spoken honestly by the agent: "I'm reaching out because ...". */
  reasonSummary: string;
  /** Stable per triggering event, so the same event isn't re-evaluated forever. */
  scheduleOccurrenceId: string;
  scheduleId: string;
  source: ProactiveSourceClassification;
}>;

// Deliberately conservative: this is a shared identity across every domain,
// so its limits are the only thing standing between "helpful" and "nuisance
// caller" for this audience. Not specified by product yet - revisit once
// there's real usage data.
export const PROACTIVE_OUTREACH_LIMIT_POLICY: ProactiveLimitPolicy = Object.freeze({
  enforcement: "required",
  maxAttemptsPerLocalDay: 1,
  minCooldownMinutes: 24 * 60,
  maxConsecutiveFailures: 2,
  maxRecentNoAnswers: 2,
  maxRecentDismissals: 1,
  channelLimits: [{ channel: "voice_call", maxAttemptsPerLocalDay: 1 }],
}) as ProactiveLimitPolicy;

export const PROACTIVE_OUTREACH_QUIET_HOURS = Object.freeze({
  mode: "window",
  startLocalTime: "21:00",
  endLocalTime: "08:00",
}) as ProactiveEngagementEvaluationInput["quietHours"];

const RECENT_ATTEMPTS_WINDOW_DAYS = 30;

function mapAttemptStatusToOutcome(status: PreventiveOutboundCallAttemptStatus): ProactiveAttemptOutcome {
  switch (status) {
    case "answered":
    case "identity_confirmed":
    case "flow_entry_started":
    case "flow_started":
      return "answered";
    case "no_answer":
    case "busy":
      return "no_answer";
    case "declined":
      return "dismissed";
    case "cancelled":
      return "cancelled";
    case "failed_retryable":
    case "failed_permanent":
      return "failed";
    default:
      // requested / claimed / provider_attempt_started / provider_started /
      // ringing / delivery_uncertain: the call was placed, final outcome
      // unknown yet - "delivered" keeps it counting toward cooldown/frequency
      // without falsely counting as a failure or a no-answer.
      return "delivered";
  }
}

function consentState(consent: PreventiveOutboundCallConsentState): ProactiveConsentState {
  if (!consent.id) return "unknown";
  return consent.enabled ? "granted" : "revoked";
}

function buildConsentFacts(consent: PreventiveOutboundCallConsentState, now: Date): ProactiveConsentFact[] {
  const state = consentState(consent);
  const effectiveAt = (consent.enabled ? consent.grantedAt : consent.revokedAt)?.toISOString() ?? now.toISOString();
  const shared = {
    subject: "user" as const,
    state,
    effectiveAt,
    recordedAt: effectiveAt,
    revision: consent.revision,
  };
  return [
    { consentId: `consent.purpose.${consent.userId}`, purposeId: PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID, ...shared },
    { consentId: `consent.channel.voice_call.${consent.userId}`, purposeId: PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID, channel: "voice_call", ...shared },
  ];
}

function buildRecentAttemptSummaries(attempts: readonly PreventiveOutboundCallAttemptRecord[]): ProactiveAttemptSummary[] {
  return attempts
    .filter((attempt): attempt is PreventiveOutboundCallAttemptRecord & { requestedAt: Date } => attempt.requestedAt !== null)
    .map((attempt) => ({
      attemptId: attempt.id,
      scheduleOccurrenceId: attempt.scheduleOccurrenceId,
      purposeId: PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID,
      channel: "voice_call" as const,
      outcome: mapAttemptStatusToOutcome(attempt.status),
      attemptedAt: attempt.requestedAt.toISOString(),
    }));
}

export type ProactiveOutreachContextDependencies = Readonly<{
  callStore?: PreventiveOutboundCallStore;
  currentTime?: () => Date;
  idFactory?: () => string;
}>;

/**
 * The actual new work: assembles what proactivePolicy.ts needs from real
 * consent, attempt-history, and profile data. The engine and the runtime it
 * feeds (preventiveOutboundCallRuntime.ts) are unchanged.
 */
export async function buildProactiveOutreachRuntimeInput(
  candidate: ProactiveOutreachCandidate,
  dependencies: ProactiveOutreachContextDependencies = {},
): Promise<PreventiveOutboundCallRuntimeInput> {
  const callStore = dependencies.callStore ?? defaultPreventiveOutboundCallStore;
  const now = dependencies.currentTime?.() ?? new Date();
  const idFactory = dependencies.idFactory ?? randomUUID;

  const [consent, profileRows] = await Promise.all([
    callStore.readConsent({ userId: candidate.userId, profileId: candidate.profileId }),
    db.select({ timezone: profiles.timezone, language: profiles.language })
      .from(profiles)
      .where(eq(profiles.id, candidate.userId))
      .limit(1)
      .catch(() => []),
  ]);
  const profile = profileRows[0];
  const locale = profile?.language && /^[a-z]{2,3}(-[A-Z0-9]{2,8})*$/.test(profile.language)
    ? profile.language
    : undefined;

  const recentAttempts = await callStore.listRecentAttempts({
    userId: candidate.userId,
    profileId: candidate.profileId,
    since: new Date(now.getTime() - RECENT_ATTEMPTS_WINDOW_DAYS * 24 * 60 * 60_000),
  }).catch(() => []);

  const evaluationInput: ProactiveEngagementEvaluationInput = {
    schemaVersion: PROACTIVE_ENGAGEMENT_SCHEMA_VERSION,
    evaluationId: idFactory(),
    policyVersion: PROACTIVE_ENGAGEMENT_POLICY_VERSION,
    scheduleOccurrenceId: candidate.scheduleOccurrenceId,
    scheduleId: candidate.scheduleId,
    purposeId: PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID,
    dueAt: now.toISOString(),
    evaluatedAt: now.toISOString(),
    timezone: profile?.timezone ?? "Europe/Madrid",
    ...(locale ? { locale } : {}),
    userRef: candidate.userId,
    profileRef: candidate.profileId,
    source: candidate.source,
    consentFacts: buildConsentFacts(consent, now),
    channelPreferences: {
      preferredChannel: "voice_call",
      fallbackChain: [],
      fallbackPermissions: [],
    },
    channelCandidates: [{
      channel: "voice_call",
      preferenceRank: 0,
      availability: consent.phoneE164 ? "available" : "unavailable",
      purposeId: PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID,
    }],
    quietHours: PROACTIVE_OUTREACH_QUIET_HOURS,
    recentAttempts: buildRecentAttemptSummaries(recentAttempts),
    limitPolicy: PROACTIVE_OUTREACH_LIMIT_POLICY,
    existingAuditStates: [],
    nonExecutable: true,
  };

  return {
    userId: candidate.userId,
    profileId: candidate.profileId,
    evaluationInput,
    reasonSummary: candidate.reasonSummary,
  };
}
