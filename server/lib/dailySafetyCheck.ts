import {
  deriveRiskTier,
  maxSafetyStatus,
  normalizeSafetyStatus,
  statusToRiskScore,
  type DailySafetyCheck,
  type RiskTier,
} from "../../src/safety/dailySafetyEngine.js";

export {
  DAILY_SAFETY_RULE_VERSION,
  buildDailySafetyCheck,
  deriveRiskTier,
  maxSafetyStatus,
  normalizeSafetyStatus,
  riskTierForScore,
  statusShouldEscalate,
  statusToRiskScore,
  statusToRiskTier,
} from "../../src/safety/dailySafetyEngine.js";

export type {
  CaregiverEscalationContext,
  DailySafetyCheck,
  DailySafetyInput,
  MedicationSafetyContext,
  RiskTier,
  SafetySymptomPattern,
  SafetyStatus,
  SignalSummary,
  TriageSafetyContext,
} from "../../src/safety/dailySafetyEngine.js";

export type AiSafetySuggestion = Partial<{
  risk_score: number;
  risk_tier: RiskTier;
  contributing_signals: Record<string, unknown>;
  pattern_labels: string[];
  senior_message: string | null;
  caregiver_note: string | null;
  recommended_action: string | null;
}>;

function clampScore(value: unknown): number {
  const score = Math.round(Number(value));
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

export function mergeAiSafetySuggestion(
  base: DailySafetyCheck,
  ai: AiSafetySuggestion | null | undefined,
): DailySafetyCheck {
  if (!ai) return base;

  const aiScore = clampScore(ai.risk_score);
  const aiStatus = normalizeSafetyStatus(ai.recommended_action) ?? (
    ai.risk_tier === "urgent" ? "urgent_help" :
    ai.risk_tier === "notify" ? "contact_doctor" :
    ai.risk_tier === "watch" ? "recheck" :
    null
  );
  const mergedStatus = aiStatus ? maxSafetyStatus(base.safety_status, aiStatus) : base.safety_status;
  const mergedScore = Math.max(base.risk_score, aiScore, statusToRiskScore(mergedStatus));

  return {
    ...base,
    safety_status: mergedStatus,
    recommended_action: mergedStatus,
    risk_score: mergedScore,
    risk_tier: deriveRiskTier(mergedStatus, mergedScore),
    senior_message: typeof ai.senior_message === "string" && ai.senior_message.trim()
      ? ai.senior_message.trim()
      : base.senior_message,
    caregiver_note: typeof ai.caregiver_note === "string" && ai.caregiver_note.trim()
      ? ai.caregiver_note.trim()
      : base.caregiver_note,
    contributing_signals: {
      ...base.contributing_signals,
      ai_contributing_signals: ai.contributing_signals && typeof ai.contributing_signals === "object"
        ? ai.contributing_signals
        : {},
    },
    pattern_labels: Array.from(new Set([
      ...base.pattern_labels,
      ...(Array.isArray(ai.pattern_labels) ? ai.pattern_labels.map(String) : []),
    ])).slice(0, 8),
  };
}
