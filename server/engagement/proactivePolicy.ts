import {
  canonicalContractProjection,
  canonicalSha256,
  descriptorSafeDeepInertClone,
} from "../orchestrator/eventStateCanonicalJson.js";
import {
  PROACTIVE_ENGAGEMENT_POLICY_VERSION,
  proactiveEngagementEvaluationInputSchema,
  proactiveEngagementIdempotencyKey,
  proactiveEngagementPolicyDecisionSchema,
  type ProactiveAttemptSummary,
  type ProactiveChannel,
  type ProactiveConsentClassification,
  type ProactiveConsentFact,
  type ProactiveEngagementEvaluationInput,
  type ProactiveEngagementPolicyDecision,
  type ProactiveLimitClassification,
  type ProactiveQuietHoursClassification,
  type ProactiveReasonCode,
} from "../../shared/engagement/proactiveEngagement.js";

export const PROACTIVE_POLICY_DECISION_DIGEST_DOMAIN =
  "vyva.task8.proactive-engagement.policy-decision.semantic.v1" as const;

type ConsentEvaluation =
  | { ok: true; status: ProactiveConsentClassification }
  | {
      ok: false;
      status: ProactiveConsentClassification;
      reason: Extract<
        ProactiveReasonCode,
        | "consent_denied"
        | "consent_expired"
        | "consent_missing"
        | "consent_revoked"
        | "policy_configuration_invalid"
      >;
    };

type ChannelConsentEvaluation =
  | { ok: true; status: ProactiveConsentClassification }
  | {
      ok: false;
      status: ProactiveConsentClassification;
      reason: Extract<
        ProactiveReasonCode,
        | "channel_not_consented"
        | "consent_denied"
        | "consent_expired"
        | "consent_missing"
        | "consent_revoked"
        | "policy_configuration_invalid"
      >;
    };

type LimitResult =
  | { ok: true; status: ProactiveLimitClassification }
  | {
      ok: false;
      status: ProactiveLimitClassification;
      reason: Extract<
        ProactiveReasonCode,
        | "cooldown_active"
        | "fatigue_limit_reached"
        | "frequency_limit_reached"
        | "policy_configuration_invalid"
      >;
    };

export type ProactivePolicyEvaluationResult =
  | {
      ok: true;
      input: ProactiveEngagementEvaluationInput;
      decision: ProactiveEngagementPolicyDecision;
      decisionDigest: string;
      idempotencyKey: string;
    }
  | { ok: false; error: "invalid_input" };

function dateFromIso(value: string): Date {
  return new Date(value);
}

function stableUnique<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function reasonList(...reasons: ProactiveReasonCode[]): ProactiveReasonCode[] {
  return stableUnique(reasons).sort((left, right) => left.localeCompare(right));
}

function decisionDigest(decision: ProactiveEngagementPolicyDecision): string {
  return canonicalSha256(
    PROACTIVE_POLICY_DECISION_DIGEST_DOMAIN,
    canonicalContractProjection(decision),
  );
}

function deterministicId(prefix: string, facts: unknown): string {
  const digest = canonicalSha256(
    `${PROACTIVE_POLICY_DECISION_DIGEST_DOMAIN}.${prefix}`,
    canonicalContractProjection(facts),
  );
  return `${prefix}.${digest.slice("sha256:".length, "sha256:".length + 32)}`;
}

function validDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function instantMillis(value: string): number {
  return Date.parse(value);
}

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localParts(date: Date, timeZone: string): LocalParts | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const result = {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour: value("hour"),
      minute: value("minute"),
      second: value("second"),
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
  } catch {
    return null;
  }
}

function localDateKey(parts: Pick<LocalParts, "year" | "month" | "day">): string {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function localDateTime(parts: LocalParts): string {
  return `${localDateKey(parts)}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
}

function minutesOfDay(parts: Pick<LocalParts, "hour" | "minute">): number {
  return parts.hour * 60 + parts.minute;
}

function minutesFromLocalTime(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function quietHoursStatus(
  input: ProactiveEngagementEvaluationInput,
  evaluatedParts: LocalParts | null,
): { status: ProactiveQuietHoursClassification; reason?: Extract<ProactiveReasonCode, "quiet_hours" | "timezone_invalid"> } {
  if (!evaluatedParts) return { status: "timezone_invalid", reason: "timezone_invalid" };
  if (input.quietHours.mode === "none") return { status: "not_configured" };
  if (input.quietHours.mode === "full_day") {
    return { status: "inside_quiet_hours", reason: "quiet_hours" };
  }
  const current = minutesOfDay(evaluatedParts);
  const start = minutesFromLocalTime(input.quietHours.startLocalTime);
  const end = minutesFromLocalTime(input.quietHours.endLocalTime);
  const inside = start < end
    ? current >= start && current < end
    : current >= start || current < end;
  return inside
    ? { status: "inside_quiet_hours", reason: "quiet_hours" }
    : { status: "outside_quiet_hours" };
}

function compareConsentFacts(left: ProactiveConsentFact, right: ProactiveConsentFact): number {
  const leftEffective = Date.parse(left.effectiveAt);
  const rightEffective = Date.parse(right.effectiveAt);
  if (leftEffective !== rightEffective) return rightEffective - leftEffective;
  if (left.revision !== right.revision) return right.revision - left.revision;
  const leftRecorded = Date.parse(left.recordedAt);
  const rightRecorded = Date.parse(right.recordedAt);
  if (leftRecorded !== rightRecorded) return rightRecorded - leftRecorded;
  return left.consentId.localeCompare(right.consentId);
}

function activeConsentFacts(
  input: ProactiveEngagementEvaluationInput,
  channel: ProactiveChannel | undefined,
): ProactiveConsentFact[] {
  const evaluatedAt = instantMillis(input.evaluatedAt);
  return input.consentFacts
    .filter((fact) =>
      fact.subject === "user" &&
      fact.purposeId === input.purposeId &&
      instantMillis(fact.effectiveAt) <= evaluatedAt &&
      (channel === undefined ? fact.channel === undefined : fact.channel === channel)
    )
    .sort(compareConsentFacts);
}

function hasConflictingNewestFacts(facts: readonly ProactiveConsentFact[]): boolean {
  if (facts.length < 2) return false;
  const [first, ...rest] = facts;
  const firstEffective = instantMillis(first.effectiveAt);
  const firstRecorded = instantMillis(first.recordedAt);
  return rest.some((fact) =>
    instantMillis(fact.effectiveAt) === firstEffective &&
    instantMillis(fact.recordedAt) === firstRecorded &&
    fact.revision === first.revision &&
    fact.state !== first.state
  );
}

function materialConsentState(
  fact: ProactiveConsentFact | undefined,
  evaluatedAt: string,
): ProactiveConsentFact["state"] | undefined {
  if (!fact) return undefined;
  if (fact.expiresAt && Date.parse(fact.expiresAt) <= Date.parse(evaluatedAt)) {
    return "expired";
  }
  return fact.state;
}

function consentEvaluation(input: ProactiveEngagementEvaluationInput): ConsentEvaluation {
  const purposeFacts = activeConsentFacts(input, undefined);
  if (hasConflictingNewestFacts(purposeFacts)) {
    return { ok: false, status: "missing", reason: "policy_configuration_invalid" };
  }
  const channelFactsExist = input.consentFacts.some((fact) =>
    fact.subject === "user" &&
    fact.purposeId === input.purposeId &&
    fact.channel !== undefined &&
    Date.parse(fact.effectiveAt) <= Date.parse(input.evaluatedAt)
  );
  const state = materialConsentState(purposeFacts[0], input.evaluatedAt);
  if (state === undefined) {
    return channelFactsExist
      ? { ok: true, status: "valid" }
      : { ok: false, status: "missing", reason: "consent_missing" };
  }
  if (state === "not_required") return { ok: true, status: "not_required" };
  if (state === "granted") return { ok: true, status: "valid" };
  if (state === "denied" || state === "unknown") {
    return { ok: false, status: "denied", reason: state === "unknown" ? "consent_missing" : "consent_denied" };
  }
  if (state === "revoked") return { ok: false, status: "revoked", reason: "consent_revoked" };
  return { ok: false, status: "expired", reason: "consent_expired" };
}

function channelConsentEvaluation(
  input: ProactiveEngagementEvaluationInput,
  channel: ProactiveChannel,
  purposeStatus: ProactiveConsentClassification,
): ChannelConsentEvaluation {
  if (purposeStatus === "not_required") return { ok: true, status: "not_required" };
  const facts = activeConsentFacts(input, channel);
  if (hasConflictingNewestFacts(facts)) {
    return { ok: false, status: "missing", reason: "policy_configuration_invalid" };
  }
  const state = materialConsentState(facts[0], input.evaluatedAt);
  if (state === undefined) {
    return { ok: false, status: "channel_denied", reason: "channel_not_consented" };
  }
  if (state === "not_required") return { ok: true, status: "not_required" };
  if (state === "granted") return { ok: true, status: "valid" };
  if (state === "denied" || state === "unknown") {
    return { ok: false, status: "channel_denied", reason: state === "unknown" ? "channel_not_consented" : "consent_denied" };
  }
  if (state === "revoked") return { ok: false, status: "revoked", reason: "consent_revoked" };
  return { ok: false, status: "expired", reason: "consent_expired" };
}

function relevantAttempts(input: ProactiveEngagementEvaluationInput): ProactiveAttemptSummary[] {
  return input.recentAttempts
    .filter((attempt) => attempt.purposeId === input.purposeId)
    .sort((left, right) => Date.parse(right.attemptedAt) - Date.parse(left.attemptedAt) ||
      left.attemptId.localeCompare(right.attemptId));
}

function attemptsOnLocalDay(
  attempts: readonly ProactiveAttemptSummary[],
  timezone: string,
  localDayKey: string,
  channel?: ProactiveChannel,
): ProactiveAttemptSummary[] {
  return attempts.filter((attempt) => {
    if (channel && attempt.channel !== channel) return false;
    const parts = localParts(dateFromIso(attempt.attemptedAt), timezone);
    return parts ? localDateKey(parts) === localDayKey : false;
  });
}

function attemptsInRollingWindow(
  attempts: readonly ProactiveAttemptSummary[],
  evaluatedAt: Date,
  windowMinutes: number,
  channel?: ProactiveChannel,
): ProactiveAttemptSummary[] {
  const start = evaluatedAt.getTime() - windowMinutes * 60_000;
  return attempts.filter((attempt) => {
    if (channel && attempt.channel !== channel) return false;
    const time = Date.parse(attempt.attemptedAt);
    return Number.isFinite(time) && time >= start && time <= evaluatedAt.getTime();
  });
}

function globalLimitStatus(
  input: ProactiveEngagementEvaluationInput,
  evaluatedAt: Date,
  evaluatedParts: LocalParts,
): LimitResult {
  const limits = input.limitPolicy;
  const attempts = relevantAttempts(input);
  if (limits.enforcement === "not_required" && attempts.length === 0) {
    return { ok: true, status: "not_configured" };
  }
  const dayKey = localDateKey(evaluatedParts);
  if (limits.maxAttemptsPerLocalDay !== undefined &&
    attemptsOnLocalDay(attempts, input.timezone, dayKey).length >= limits.maxAttemptsPerLocalDay) {
    return { ok: false, status: "frequency_limit_reached", reason: "frequency_limit_reached" };
  }
  if (limits.rollingWindowMinutes !== undefined &&
    limits.maxAttemptsPerRollingWindow !== undefined &&
    attemptsInRollingWindow(attempts, evaluatedAt, limits.rollingWindowMinutes).length >= limits.maxAttemptsPerRollingWindow) {
    return { ok: false, status: "frequency_limit_reached", reason: "frequency_limit_reached" };
  }
  if (limits.minCooldownMinutes !== undefined) {
    const latest = attempts[0];
    if (latest) {
      const elapsed = evaluatedAt.getTime() - Date.parse(latest.attemptedAt);
      if (elapsed >= 0 && elapsed < limits.minCooldownMinutes * 60_000) {
        return { ok: false, status: "cooldown_active", reason: "cooldown_active" };
      }
    }
  }
  if (limits.maxConsecutiveFailures !== undefined) {
    const failures = attempts.reduce((count, attempt) => {
      if (count.stop) return count;
      if (attempt.outcome === "failed") return { value: count.value + 1, stop: false };
      return { value: count.value, stop: true };
    }, { value: 0, stop: false }).value;
    if (failures >= limits.maxConsecutiveFailures) {
      return { ok: false, status: "fatigue_limit_reached", reason: "fatigue_limit_reached" };
    }
  }
  if (limits.maxRecentNoAnswers !== undefined &&
    attempts.filter((attempt) => attempt.outcome === "no_answer").length >= limits.maxRecentNoAnswers) {
    return { ok: false, status: "fatigue_limit_reached", reason: "fatigue_limit_reached" };
  }
  if (limits.maxRecentDismissals !== undefined &&
    attempts.filter((attempt) => attempt.outcome === "dismissed").length >= limits.maxRecentDismissals) {
    return { ok: false, status: "fatigue_limit_reached", reason: "fatigue_limit_reached" };
  }
  return { ok: true, status: limits.enforcement === "not_required" ? "not_configured" : "within_limit" };
}

function channelLimitAllowed(
  input: ProactiveEngagementEvaluationInput,
  evaluatedAt: Date,
  evaluatedParts: LocalParts,
  channel: ProactiveChannel,
): boolean {
  const limit = input.limitPolicy.channelLimits.find((item) => item.channel === channel);
  if (!limit) return true;
  const attempts = relevantAttempts(input);
  if (limit.maxAttemptsPerLocalDay !== undefined &&
    attemptsOnLocalDay(attempts, input.timezone, localDateKey(evaluatedParts), channel).length >= limit.maxAttemptsPerLocalDay) {
    return false;
  }
  if (limit.rollingWindowMinutes !== undefined &&
    limit.maxAttemptsPerRollingWindow !== undefined &&
    attemptsInRollingWindow(attempts, evaluatedAt, limit.rollingWindowMinutes, channel).length >= limit.maxAttemptsPerRollingWindow) {
    return false;
  }
  return true;
}

function orderedChannelChain(input: ProactiveEngagementEvaluationInput): ProactiveChannel[] {
  const candidates = input.channelCandidates
    .filter((candidate) => candidate.purposeId === input.purposeId)
    .sort((left, right) => left.preferenceRank - right.preferenceRank ||
      left.channel.localeCompare(right.channel))
    .map((candidate) => candidate.channel);
  return stableUnique([
    ...(input.channelPreferences.preferredChannel ? [input.channelPreferences.preferredChannel] : []),
    ...input.channelPreferences.fallbackChain,
    ...candidates,
  ]);
}

function voiceFallbackAllowed(
  input: ProactiveEngagementEvaluationInput,
  channel: ProactiveChannel,
): boolean {
  if (channel !== "voice_call") return true;
  const preferred = input.channelPreferences.preferredChannel;
  if (preferred === "voice_call") return true;
  if (!preferred) return false;
  return input.channelPreferences.fallbackPermissions.some((permission) =>
    permission.purposeId === input.purposeId &&
    permission.fromChannel === preferred &&
    permission.toChannel === "voice_call" &&
    permission.allowed
  );
}

function eligibleChannel(input: ProactiveEngagementEvaluationInput, evaluatedAt: Date, evaluatedParts: LocalParts, purposeConsentStatus: ProactiveConsentClassification):
  { channel?: ProactiveChannel; chain: ProactiveChannel[]; consentStatus: ProactiveConsentClassification; channelLimitBlocked: boolean; policyInvalid: boolean } {
  const chain = orderedChannelChain(input);
  const candidates = new Map(input.channelCandidates
    .filter((candidate) => candidate.purposeId === input.purposeId)
    .map((candidate) => [candidate.channel, candidate]));
  let lastConsentStatus = purposeConsentStatus;
  let channelLimitBlocked = false;
  let policyInvalid = false;
  for (const channel of chain) {
    const candidate = candidates.get(channel);
    if (!candidate) continue;
    if (candidate.availability === "unavailable") continue;
    if (!voiceFallbackAllowed(input, channel)) continue;
    const consent = channelConsentEvaluation(input, channel, purposeConsentStatus);
    lastConsentStatus = consent.status;
    if (!consent.ok) {
      if (consent.reason === "policy_configuration_invalid") policyInvalid = true;
      continue;
    }
    if (!channelLimitAllowed(input, evaluatedAt, evaluatedParts, channel)) {
      channelLimitBlocked = true;
      continue;
    }
    return { channel, chain, consentStatus: consent.status, channelLimitBlocked, policyInvalid };
  }
  return { chain, consentStatus: lastConsentStatus, channelLimitBlocked, policyInvalid };
}

function makeDecision(input: {
  source: ProactiveEngagementEvaluationInput;
  decision: "allow" | "block";
  proposedChannel?: ProactiveChannel;
  fallbackChainConsidered: ProactiveChannel[];
  reasonCodes: ProactiveReasonCode[];
  localEvaluatedAt: string;
  consentStatus: ProactiveConsentClassification;
  quietHoursStatus: ProactiveQuietHoursClassification;
  limitStatus: ProactiveLimitClassification;
  duplicateStatus: "duplicate_conflict" | "duplicate_same_digest" | "not_duplicate" | "unknown";
}): ProactiveEngagementPolicyDecision {
  const decisionId = deterministicId("engagement.decision", {
    policyVersion: PROACTIVE_ENGAGEMENT_POLICY_VERSION,
    evaluationId: input.source.evaluationId,
    scheduleOccurrenceId: input.source.scheduleOccurrenceId,
    decision: input.decision,
    proposedChannel: input.proposedChannel ?? null,
    reasonCodes: reasonList(...input.reasonCodes),
  });
  return proactiveEngagementPolicyDecisionSchema.parse({
    schemaVersion: input.source.schemaVersion,
    policyVersion: input.source.policyVersion,
    decisionId,
    evaluationId: input.source.evaluationId,
    scheduleOccurrenceId: input.source.scheduleOccurrenceId,
    scheduleId: input.source.scheduleId,
    purposeId: input.source.purposeId,
    decision: input.decision,
    ...(input.proposedChannel ? { proposedChannel: input.proposedChannel } : {}),
    fallbackChainConsidered: input.fallbackChainConsidered,
    reasonCodes: reasonList(...input.reasonCodes),
    evaluatedAt: input.source.evaluatedAt,
    localEvaluatedAt: input.localEvaluatedAt,
    timezone: input.source.timezone,
    consentStatus: input.consentStatus,
    quietHoursStatus: input.quietHoursStatus,
    limitStatus: input.limitStatus,
    duplicateStatus: input.duplicateStatus,
    source: input.source.source,
    shadowOnly: true,
    nonExecutable: true,
  });
}

export function evaluateParsedProactiveEngagementPolicy(
  input: ProactiveEngagementEvaluationInput,
): ProactivePolicyEvaluationResult {
  const idempotencyKey = proactiveEngagementIdempotencyKey({
    policyVersion: PROACTIVE_ENGAGEMENT_POLICY_VERSION,
    scheduleOccurrenceId: input.scheduleOccurrenceId,
    purposeId: input.purposeId,
  });
  const fallbackChainConsidered = orderedChannelChain(input);
  const evaluatedAt = dateFromIso(input.evaluatedAt);
  const dueAt = dateFromIso(input.dueAt);
  const evaluatedParts = localParts(evaluatedAt, input.timezone);
  const localEvaluatedAt = evaluatedParts ? localDateTime(evaluatedParts) : "invalid-timezone";
  const duplicate = input.existingAuditStates.find((state) =>
    state.policyVersion === input.policyVersion &&
    state.scheduleOccurrenceId === input.scheduleOccurrenceId &&
    state.purposeId === input.purposeId &&
    state.idempotencyKey === idempotencyKey
  );
  if (duplicate) {
    const decision = makeDecision({
      source: input,
      decision: "block",
      fallbackChainConsidered,
      reasonCodes: ["duplicate_occurrence"],
      localEvaluatedAt,
      consentStatus: "missing",
      quietHoursStatus: evaluatedParts ? "not_configured" : "timezone_invalid",
      limitStatus: "not_configured",
      duplicateStatus: "duplicate_same_digest",
    });
    return { ok: true, input, decision, decisionDigest: decisionDigest(decision), idempotencyKey };
  }
  if (!validDate(evaluatedAt) || !validDate(dueAt)) return { ok: false, error: "invalid_input" };
  if (dueAt.getTime() > evaluatedAt.getTime()) {
    const decision = makeDecision({
      source: input,
      decision: "block",
      fallbackChainConsidered,
      reasonCodes: ["schedule_not_due"],
      localEvaluatedAt,
      consentStatus: "missing",
      quietHoursStatus: evaluatedParts ? "not_configured" : "timezone_invalid",
      limitStatus: "not_configured",
      duplicateStatus: "not_duplicate",
    });
    return { ok: true, input, decision, decisionDigest: decisionDigest(decision), idempotencyKey };
  }
  if (!evaluatedParts) {
    const decision = makeDecision({
      source: input,
      decision: "block",
      fallbackChainConsidered,
      reasonCodes: ["timezone_invalid"],
      localEvaluatedAt,
      consentStatus: "missing",
      quietHoursStatus: "timezone_invalid",
      limitStatus: "not_configured",
      duplicateStatus: "not_duplicate",
    });
    return { ok: true, input, decision, decisionDigest: decisionDigest(decision), idempotencyKey };
  }
  const consent = consentEvaluation(input);
  if (!consent.ok) {
    const decision = makeDecision({
      source: input,
      decision: "block",
      fallbackChainConsidered,
      reasonCodes: [consent.reason],
      localEvaluatedAt,
      consentStatus: consent.status,
      quietHoursStatus: "not_configured",
      limitStatus: "not_configured",
      duplicateStatus: "not_duplicate",
    });
    return { ok: true, input, decision, decisionDigest: decisionDigest(decision), idempotencyKey };
  }
  const quiet = quietHoursStatus(input, evaluatedParts);
  if (quiet.reason) {
    const decision = makeDecision({
      source: input,
      decision: "block",
      fallbackChainConsidered,
      reasonCodes: [quiet.reason],
      localEvaluatedAt,
      consentStatus: consent.status,
      quietHoursStatus: quiet.status,
      limitStatus: "not_configured",
      duplicateStatus: "not_duplicate",
    });
    return { ok: true, input, decision, decisionDigest: decisionDigest(decision), idempotencyKey };
  }
  const limits = globalLimitStatus(input, evaluatedAt, evaluatedParts);
  if (!limits.ok) {
    const decision = makeDecision({
      source: input,
      decision: "block",
      fallbackChainConsidered,
      reasonCodes: [limits.reason],
      localEvaluatedAt,
      consentStatus: consent.status,
      quietHoursStatus: quiet.status,
      limitStatus: limits.status,
      duplicateStatus: "not_duplicate",
    });
    return { ok: true, input, decision, decisionDigest: decisionDigest(decision), idempotencyKey };
  }
  const selected = eligibleChannel(input, evaluatedAt, evaluatedParts, consent.status);
  if (!selected.channel) {
    const reason: ProactiveReasonCode = selected.policyInvalid
      ? "policy_configuration_invalid"
      : selected.channelLimitBlocked
      ? "frequency_limit_reached"
      : "no_eligible_channel";
    const decision = makeDecision({
      source: input,
      decision: "block",
      fallbackChainConsidered: selected.chain,
      reasonCodes: [reason],
      localEvaluatedAt,
      consentStatus: selected.consentStatus,
      quietHoursStatus: quiet.status,
      limitStatus: selected.channelLimitBlocked ? "frequency_limit_reached" : limits.status,
      duplicateStatus: "not_duplicate",
    });
    return { ok: true, input, decision, decisionDigest: decisionDigest(decision), idempotencyKey };
  }
  const preferred = input.channelPreferences.preferredChannel;
  const selectedPreferred = preferred === selected.channel;
  const decision = makeDecision({
    source: input,
    decision: "allow",
    proposedChannel: selected.channel,
    fallbackChainConsidered: selected.chain,
    reasonCodes: [
      consent.status === "not_required" ? "consent_valid" : "consent_valid",
      "outside_quiet_hours",
      "within_frequency_limit",
      selectedPreferred ? "eligible_preferred_channel" : "eligible_fallback_channel",
      "occurrence_not_previously_evaluated",
    ],
    localEvaluatedAt,
    consentStatus: selected.consentStatus,
    quietHoursStatus: quiet.status,
    limitStatus: limits.status === "not_configured" ? "within_limit" : limits.status,
    duplicateStatus: "not_duplicate",
  });
  return { ok: true, input, decision, decisionDigest: decisionDigest(decision), idempotencyKey };
}

export function evaluateProactiveEngagementPolicy(rawInput: unknown): ProactivePolicyEvaluationResult {
  let inertInput: unknown;
  try {
    inertInput = descriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, error: "invalid_input" };
  }
  const parsed = proactiveEngagementEvaluationInputSchema.safeParse(inertInput);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  return evaluateParsedProactiveEngagementPolicy(parsed.data);
}
