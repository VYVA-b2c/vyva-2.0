import { Router } from "express";
import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import cron from "node-cron";
import { pool } from "../db.js";
import { requireActiveProfileId } from "../lib/profileAccess.js";
import { isRelationSchemaUnavailableError } from "../lib/dbCompatibility.js";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HERO_MODEL = process.env.HEALTH_INSIGHTS_HERO_MODEL ?? "claude-sonnet-4-20250514";
const SYNTHESIS_MODEL = process.env.HEALTH_INSIGHTS_SYNTHESIS_MODEL ?? "claude-sonnet-4-20250514";

type ReportType = "weekly" | "monthly";
type DeliveredSurface = "caregiver_dashboard" | "senior_card" | "smart_nudge" | "agewell_plan";
type ActionOutcome = "done" | "hard" | "skip";

type HealthInsightReport = {
  id: string;
  user_id: string;
  report_type: ReportType;
  generated_at: Date;
  period_start: Date;
  period_end: Date;
  severity_tier: number;
  confidence: string | number;
  source_signals: Record<string, unknown>;
  vitals_summary: Record<string, unknown> | null;
  medication_summary: Record<string, unknown> | null;
  cognitive_summary: Record<string, unknown> | null;
  mood_summary: Record<string, unknown> | null;
  symptom_summary: Record<string, unknown> | null;
  concierge_summary: Record<string, unknown> | null;
  correlation_flags: CorrelationFlag[];
  synthesized_recommendation_caregiver: string | null;
  synthesized_recommendation_senior: string | null;
  focus_domain: string | null;
  recommend_clinician: boolean;
  status: string;
};

type ProfileSummary = {
  first_name: string;
  language_preference: string;
  timezone: string;
  full_name?: string | null;
};

type AgeWellAction = {
  id: string;
  category: string;
  label: string;
  description: string;
  destination_type: string;
  destination_path: string | null;
  condition_tags: string[];
  tier_min: number;
};

type RealtimeSignals = {
  tierRaise: number;
  urgentFlags: string[];
};

type DomainTiers = Record<string, number>;

type CorrelationFlag = {
  rule: string;
  fired: boolean;
  domains: string[];
  severity: number;
};

type SummaryMap = Record<string, unknown> | null;

type SynthesisInput = {
  vitals: SummaryMap;
  meds: SummaryMap;
  cognitive: SummaryMap;
  mood: SummaryMap;
  symptoms: SummaryMap;
  concierge: SummaryMap;
};

type ConditionProfile = {
  weighted_domains: Record<string, number>;
  framing_note: string;
  escalation_sensitivity: number;
};

type PendingOutcome = {
  id: string;
  user_id: string;
  report_id: string | null;
  action_id: string | null;
  tier_at_generation: number;
  delivered_surface: DeliveredSurface;
};

const FALLBACK_PROFILE: ProfileSummary = {
  first_name: "there",
  language_preference: "es",
  timezone: "Europe/Madrid",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ZERO = "00000000-0000-0000-0000-000000000000";

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

function todayStart(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function tomorrowFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function safeJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function arrayOfText(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function oneLine(value: string | null | undefined, fallback = ""): string {
  return (value ?? fallback).replace(/\s+/g, " ").trim();
}

function truncate(text: string | null | undefined, maxChars: number): string {
  const clean = oneLine(text);
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
}

function riskTierRank(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.min(5, Math.round(value)));
  const text = String(value ?? "").toLowerCase();
  if (["urgent", "critical", "severe", "5"].includes(text)) return 5;
  if (["notify", "high", "4"].includes(text)) return 4;
  if (["watch", "medium", "3"].includes(text)) return 3;
  if (["low", "2"].includes(text)) return 2;
  return 1;
}

function normalizeConditionTag(value: string): string | null {
  const text = value.toLowerCase();
  if (text.includes("diabetes") || text.includes("glucose")) return "diabetes";
  if (text.includes("heart") || text.includes("cardiac") || text.includes("blood pressure") || text.includes("hypertension")) return "heart";
  if (text.includes("fall") || text.includes("mobility") || text.includes("balance")) return "falls";
  if (text.includes("asthma") || text.includes("copd") || text.includes("breath")) return "asthma";
  if (text.includes("anxiety") || text.includes("stress") || text.includes("panic")) return "anxiety";
  if (text.includes("alzheimer") || text.includes("dementia") || text.includes("memory")) return "alzheimers";
  if (text.includes("cancer") || text.includes("oncology") || text.includes("chemo")) return "oncology";
  return null;
}

function categoryMatchesFocus(category: string, focus?: string | null): boolean {
  const normalized = String(focus ?? "").toLowerCase();
  if (!normalized) return false;
  if (normalized.includes(category.toLowerCase())) return true;
  if (normalized.includes("med") && category === "medicine") return true;
  if (normalized.includes("symptom") && category === "follow-up") return true;
  if (normalized.includes("vital") && category === "follow-up") return true;
  if (normalized.includes("heart") && ["eat", "move", "medicine"].includes(category)) return true;
  if (normalized.includes("fall") && ["home", "move"].includes(category)) return true;
  return false;
}

function routeForAction(action: AgeWellAction): string | null {
  if (action.destination_type === "route" || action.destination_type === "game") return action.destination_path;
  if (action.destination_type === "concierge") return action.destination_path ?? "/concierge";
  return action.destination_path;
}

function safeFallbackToday() {
  return {
    tier: 1,
    focus_label: "general",
    hero_copy: "Hola.",
    insight_text: "Aqui tienes tu plan para hoy.",
    actions: [],
    data_completeness: {},
    report_generated_at: null,
  };
}

function nullNudge() {
  return { type: null, color: null, message: null, action_route: null };
}

async function safeQuery<T>(label: string, text: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await pool.query<T>(text, params);
    return result.rows;
  } catch (err) {
    if (isRelationSchemaUnavailableError(err, label)) {
      console.warn(`[health-insights] Optional ${label} data unavailable; continuing without it.`);
      return [];
    }
    throw err;
  }
}

async function optionalQuery<T>(label: string, text: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await safeQuery<T>(label, text, params);
  } catch (err) {
    console.warn(`[health-insights] ${label} query failed; continuing without it.`, err);
    return [];
  }
}

async function resolveProfileId(req: Request, res: Response, requestedUserId?: string): Promise<string | null> {
  const accountUserId = req.user?.id;
  if (!accountUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const activeProfileId = await requireActiveProfileId(accountUserId, res);
  if (!activeProfileId) return null;

  if (requestedUserId && requestedUserId !== accountUserId && requestedUserId !== activeProfileId) {
    res.status(403).json({ error: "Not allowed for this care profile" });
    return null;
  }

  return activeProfileId;
}

function storageUserId(profileId: string, accountUserId?: string): string {
  if (isUuid(profileId)) return profileId;
  if (isUuid(accountUserId)) return accountUserId;
  return profileId;
}

async function getLatestReport(userId: string, reportType: ReportType): Promise<HealthInsightReport | null> {
  if (!isUuid(userId)) return null;
  const rows = await optionalQuery<HealthInsightReport>("health_insight_reports", `
    select *
    from public.health_insight_reports
    where user_id = $1::uuid
      and report_type = $2
      and status = 'active'
    order by generated_at desc
    limit 1
  `, [userId, reportType]);
  return rows[0] ?? null;
}

async function getUserProfile(userId: string): Promise<ProfileSummary> {
  const rows = await optionalQuery<{
    full_name: string | null;
    preferred_name: string | null;
    language_preference: string | null;
    language: string | null;
    timezone: string | null;
  }>("profiles", `
    select full_name, preferred_name, language_preference, language, timezone
    from public.profiles
    where id = $1
    limit 1
  `, [userId]);

  const profile = rows[0];
  if (!profile) return FALLBACK_PROFILE;
  const firstName = oneLine(profile.preferred_name || profile.full_name)?.split(" ")[0] || "there";
  return {
    first_name: firstName,
    language_preference: profile.language_preference || profile.language || "es",
    timezone: profile.timezone || "Europe/Madrid",
    full_name: profile.full_name,
  };
}

async function getUserConditions(userId: string): Promise<string[]> {
  const conditionRows = isUuid(userId)
    ? await optionalQuery<{ condition: string }>("user_health_conditions", `
        select condition
        from public.user_health_conditions
        where user_id = $1::uuid and is_active = true
        limit 50
      `, [userId])
    : [];

  const profileRows = await optionalQuery<{ data_sharing_consent: unknown }>("profiles", `
    select data_sharing_consent
    from public.profiles
    where id = $1
    limit 1
  `, [userId]);

  const consent = safeJson<Record<string, unknown>>(profileRows[0]?.data_sharing_consent, {});
  const conditions = safeJson<Record<string, unknown>>(consent.conditions, {});
  const profileConditions = arrayOfText(conditions.health_conditions);

  return Array.from(new Set([
    ...conditionRows.map((row) => row.condition),
    ...profileConditions,
  ].filter(Boolean)));
}

async function getConditionProfile(conditions: string[]): Promise<ConditionProfile> {
  const tags = Array.from(new Set(conditions.map(normalizeConditionTag).filter((tag): tag is string => Boolean(tag))));
  const rows = tags.length
    ? await optionalQuery<{
        weighted_domains: Record<string, number>;
        framing_note: string;
        escalation_sensitivity: string | number;
      }>("condition_intelligence_profiles", `
        select weighted_domains, framing_note, escalation_sensitivity
        from public.condition_intelligence_profiles
        where is_active = true and condition_name = any($1::text[])
      `, [tags])
    : [];

  const defaultRows = await optionalQuery<{
    weighted_domains: Record<string, number>;
    framing_note: string;
    escalation_sensitivity: string | number;
  }>("condition_intelligence_profiles", `
    select weighted_domains, framing_note, escalation_sensitivity
    from public.condition_intelligence_profiles
    where condition_name = 'default'
    limit 1
  `);

  const base = defaultRows[0] ?? {
    weighted_domains: { vitals: 1, medication: 1, cognitive: 1, mood: 1, symptom: 1 },
    framing_note: "No specific condition profile. Apply equal domain weighting. Use standard wellness framing.",
    escalation_sensitivity: 1,
  };

  if (rows.length === 0) {
    return {
      weighted_domains: safeJson(base.weighted_domains, {}),
      framing_note: base.framing_note,
      escalation_sensitivity: Number(base.escalation_sensitivity) || 1,
    };
  }

  const merged: Record<string, number> = { ...safeJson(base.weighted_domains, {}) };
  const notes: string[] = [];
  let sensitivity = Number(base.escalation_sensitivity) || 1;
  for (const row of rows) {
    const weights = safeJson<Record<string, number>>(row.weighted_domains, {});
    for (const [domain, weight] of Object.entries(weights)) {
      merged[domain] = Math.max(merged[domain] ?? 1, Number(weight) || 1);
    }
    notes.push(row.framing_note);
    sensitivity = Math.max(sensitivity, Number(row.escalation_sensitivity) || 1);
  }

  return {
    weighted_domains: merged,
    framing_note: notes.join(" "),
    escalation_sensitivity: sensitivity,
  };
}

function computeConfidence(sourceSignals: Record<string, boolean>): number {
  const values = Object.values(sourceSignals);
  if (values.length === 0) return 0.25;
  const filled = values.filter(Boolean).length;
  return Math.max(0.25, Math.min(0.95, Math.round((filled / values.length) * 100) / 100));
}

function computeDomainTiers(data: SynthesisInput): DomainTiers {
  const vitalsTier = data.vitals ? Math.max(1, riskTierRank((data.vitals as Record<string, unknown>).risk_tier)) : 1;
  const medicationAdherence = Number((data.meds as Record<string, unknown> | null)?.adherence_pct ?? 100);
  const missedDoses = Number((data.meds as Record<string, unknown> | null)?.missed_doses ?? 0);
  const medicationTier = missedDoses >= 3 || medicationAdherence < 60 ? 4 : missedDoses >= 1 || medicationAdherence < 80 ? 3 : 1;
  const cognitiveTrend = String((data.cognitive as Record<string, unknown> | null)?.accuracy_trend ?? "stable");
  const cognitiveTier = cognitiveTrend === "declining" ? 3 : Number((data.cognitive as Record<string, unknown> | null)?.sessions_this_week ?? 1) === 0 ? 2 : 1;
  const moodTrend = String((data.mood as Record<string, unknown> | null)?.trend ?? "stable");
  const moodTier = moodTrend === "negative" ? 3 : Number((data.mood as Record<string, unknown> | null)?.poor_sleep_count ?? 0) >= 3 ? 2 : 1;
  const symptomUrgency = String((data.symptoms as Record<string, unknown> | null)?.latest_urgency ?? "").toLowerCase();
  const symptomTier = symptomUrgency.includes("urgent") || symptomUrgency.includes("emergency")
    ? 4
    : Number((data.symptoms as Record<string, unknown> | null)?.episodes_count ?? 0) > 0 ? 3 : 1;
  const conciergeDrop = Number((data.concierge as Record<string, unknown> | null)?.usage_delta ?? 0);
  const conciergeTier = conciergeDrop < -40 ? 3 : 1;

  return {
    vitals: vitalsTier,
    medication: medicationTier,
    cognitive: cognitiveTier,
    mood: moodTier,
    symptom: symptomTier,
    concierge: conciergeTier,
  };
}

function runCorrelationRules(data: SynthesisInput & { domainTiers: DomainTiers; sustained_low?: boolean }): CorrelationFlag[] {
  return [
    {
      rule: "adherence_mood_correlation",
      fired: Number((data.meds as Record<string, unknown> | null)?.adherence_pct ?? 100) < 70
        && (data.mood as Record<string, unknown> | null)?.trend === "negative",
      domains: ["medication", "mood"],
      severity: 3,
    },
    {
      rule: "cognitive_vitals_correlation",
      fired: (data.cognitive as Record<string, unknown> | null)?.accuracy_trend === "declining"
        && riskTierRank((data.vitals as Record<string, unknown> | null)?.risk_tier) >= 3,
      domains: ["cognitive", "vitals"],
      severity: 3,
    },
    {
      rule: "withdrawal_pattern",
      fired: Number((data.concierge as Record<string, unknown> | null)?.usage_delta ?? 0) < -40
        && Number((data.cognitive as Record<string, unknown> | null)?.sessions_this_week ?? 1) === 0
        && Number((data.mood as Record<string, unknown> | null)?.check_ins_logged ?? 3) < 2,
      domains: ["concierge", "cognitive", "mood"],
      severity: 4,
    },
    {
      rule: "symptom_medication_correlation",
      fired: Number((data.symptoms as Record<string, unknown> | null)?.episodes_count ?? 0) > 0
        && Number((data.meds as Record<string, unknown> | null)?.missed_doses ?? 0) >= 2,
      domains: ["symptom", "medication"],
      severity: 3,
    },
    {
      rule: "sustained_low_tier",
      fired: data.sustained_low === true,
      domains: ["all"],
      severity: 3,
    },
  ];
}

function applyConditionWeights(domainTiers: DomainTiers, weights: Record<string, number>): DomainTiers {
  const weighted: DomainTiers = {};
  for (const [domain, tier] of Object.entries(domainTiers)) {
    const aliasWeight = domain === "symptom" ? weights.symptom ?? weights.symptoms : undefined;
    const weight = Number(weights[domain] ?? aliasWeight ?? 1);
    weighted[domain] = Math.max(1, Math.min(5, Math.ceil(tier * weight)));
  }
  return weighted;
}

function getTopDomain(domainTiers: DomainTiers): string {
  return Object.entries(domainTiers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";
}

function scheduledDoseCount(times: unknown): number {
  const list = arrayOfText(times);
  return Math.max(1, list.length);
}

async function getVitalsSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const uuidRows = isUuid(userId)
    ? await optionalQuery<{
        risk_tier: string | null;
        risk_score: number | null;
        safety_status: string | null;
        pattern_labels: string[] | null;
        senior_message: string | null;
        analysed_at: Date | null;
      }>("vyva_pattern_windows", `
        select risk_tier, risk_score, safety_status, pattern_labels, senior_message, analysed_at
        from public.vyva_pattern_windows
        where user_id = $1::uuid and analysed_at >= $2
        order by analysed_at desc
        limit 1
      `, [userId, periodStart])
    : [];

  const signalRows = isUuid(userId)
    ? await optionalQuery<{
        signal_type: string;
        value: string | number;
        unit: string | null;
        recorded_at: Date;
      }>("vyva_signal_readings", `
        select distinct on (signal_type) signal_type, value, unit, recorded_at
        from public.vyva_signal_readings
        where user_id = $1::uuid and recorded_at >= $2
        order by signal_type, recorded_at desc
      `, [userId, periodStart])
    : [];

  const legacyRows = await optionalQuery<{
    bpm: number | null;
    respiratory_rate: number | null;
    metric_type: string | null;
    value: string | null;
    recorded_at: Date;
  }>("vitals_readings", `
    select bpm, respiratory_rate, metric_type, value, recorded_at
    from public.vitals_readings
    where user_id = $1 and recorded_at >= $2
    order by recorded_at desc
    limit 8
  `, [userId, periodStart]);

  if (uuidRows.length === 0 && signalRows.length === 0 && legacyRows.length === 0) return null;
  const latestWindow = uuidRows[0] ?? null;
  return {
    risk_tier: latestWindow?.risk_tier ?? "none",
    risk_score: latestWindow?.risk_score ?? 0,
    safety_status: latestWindow?.safety_status ?? "steady",
    pattern_labels: latestWindow?.pattern_labels ?? [],
    latest_message: latestWindow?.senior_message ?? null,
    latest_signals: signalRows,
    legacy_readings: legacyRows,
  };
}

async function getMedicationSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const meds = await optionalQuery<{ medication_name: string; scheduled_times: string[] | null }>("user_medications", `
    select medication_name, scheduled_times
    from public.user_medications
    where user_id = $1 and active = true
    limit 100
  `, [userId]);

  const adherence = await optionalQuery<{ status: string; created_at: Date }>("medication_adherence", `
    select status, created_at
    from public.medication_adherence
    where user_id = $1 and created_at >= $2
    order by created_at desc
    limit 500
  `, [userId, periodStart]);

  if (meds.length === 0 && adherence.length === 0) return null;
  const scheduledDoses = meds.reduce((total, med) => total + scheduledDoseCount(med.scheduled_times), 0);
  const taken = adherence.filter((row) => row.status === "taken").length;
  const missed = adherence.filter((row) => ["missed", "skipped", "late"].includes(row.status)).length;
  const denominator = taken + missed || scheduledDoses || 1;

  return {
    active_medications: meds.length,
    scheduled_daily_doses: scheduledDoses,
    taken_logs: taken,
    missed_doses: missed,
    adherence_pct: Math.round((taken / denominator) * 100),
  };
}

async function getCognitiveSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const rows = await optionalQuery<{
    sessions_this_week: string | number;
    completed_sessions: string | number;
    avg_accuracy: string | number | null;
    last_played_at: Date | null;
  }>("cognitive_session_index", `
    select
      count(*)::int as sessions_this_week,
      count(*) filter (where completed = true)::int as completed_sessions,
      avg(accuracy_pct) as avg_accuracy,
      max(played_at) as last_played_at
    from public.cognitive_session_index
    where user_id = $1 and played_at >= $2
  `, [userId, periodStart]);

  const summary = rows[0];
  if (!summary || Number(summary.sessions_this_week) === 0) return null;
  const avgAccuracy = Number(summary.avg_accuracy ?? 0);
  return {
    sessions_this_week: Number(summary.sessions_this_week),
    completed_sessions: Number(summary.completed_sessions),
    avg_accuracy: Number.isFinite(avgAccuracy) ? Math.round(avgAccuracy) : null,
    accuracy_trend: avgAccuracy > 0 && avgAccuracy < 55 ? "declining" : "stable",
    last_played_at: summary.last_played_at,
  };
}

async function getMoodSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const rows = await optionalQuery<{
    check_ins_logged: string | number;
    avg_energy: string | number | null;
    poor_sleep_count: string | number;
    latest_mood: string | null;
  }>("checkin_sessions", `
    select
      count(*)::int as check_ins_logged,
      avg(energy_level) as avg_energy,
      count(*) filter (where sleep_quality in ('poor','bad','low'))::int as poor_sleep_count,
      (array_agg(mood order by completed_at desc))[1] as latest_mood
    from public.checkin_sessions
    where user_id = $1 and completed_at >= $2
  `, [userId, periodStart]);

  const trendRows = await optionalQuery<{
    consecutive_low_mood: number;
    consecutive_poor_sleep: number;
    caregiver_flag_active: boolean;
  }>("checkin_trend_state", `
    select consecutive_low_mood, consecutive_poor_sleep, caregiver_flag_active
    from public.checkin_trend_state
    where user_id = $1
    limit 1
  `, [userId]);

  const summary = rows[0];
  const checkIns = Number(summary?.check_ins_logged ?? 0);
  if (checkIns === 0 && trendRows.length === 0) return null;
  const avgEnergy = Number(summary?.avg_energy ?? 0);
  const trendState = trendRows[0];
  const negative = (trendState?.consecutive_low_mood ?? 0) >= 2
    || (trendState?.caregiver_flag_active ?? false)
    || (Number.isFinite(avgEnergy) && avgEnergy > 0 && avgEnergy < 45);

  return {
    check_ins_logged: checkIns,
    avg_energy: Number.isFinite(avgEnergy) ? Math.round(avgEnergy) : null,
    poor_sleep_count: Number(summary?.poor_sleep_count ?? trendState?.consecutive_poor_sleep ?? 0),
    latest_mood: summary?.latest_mood ?? null,
    trend: negative ? "negative" : "stable",
  };
}

async function getSymptomSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const rows = await optionalQuery<{
    episodes_count: string | number;
    latest_urgency: string | null;
    latest_chief_complaint: string | null;
    latest_created_at: Date | null;
  }>("triage_reports", `
    select
      count(*)::int as episodes_count,
      (array_agg(urgency order by created_at desc))[1] as latest_urgency,
      (array_agg(chief_complaint order by created_at desc))[1] as latest_chief_complaint,
      max(created_at) as latest_created_at
    from public.triage_reports
    where user_id = $1 and created_at >= $2
  `, [userId, periodStart]);

  const summary = rows[0];
  if (!summary || Number(summary.episodes_count) === 0) return null;
  return {
    episodes_count: Number(summary.episodes_count),
    latest_urgency: summary.latest_urgency,
    latest_chief_complaint: summary.latest_chief_complaint,
    latest_created_at: summary.latest_created_at,
  };
}

async function getConciergeSummary(userId: string, periodStart: Date, windowDays: number): Promise<SummaryMap> {
  const previousStart = new Date(periodStart.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await optionalQuery<{
    current_count: string | number;
    previous_count: string | number;
    latest_use_case: string | null;
  }>("concierge_sessions", `
    select
      count(*) filter (where started_at >= $2)::int as current_count,
      count(*) filter (where started_at >= $3 and started_at < $2)::int as previous_count,
      (array_agg(use_case order by started_at desc))[1] as latest_use_case
    from public.concierge_sessions
    where user_id = $1 and started_at >= $3
  `, [userId, periodStart, previousStart]);

  const summary = rows[0];
  if (!summary) return null;
  const current = Number(summary.current_count ?? 0);
  const previous = Number(summary.previous_count ?? 0);
  if (current === 0 && previous === 0) return null;
  const usageDelta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
  return {
    current_count: current,
    previous_count: previous,
    usage_delta: usageDelta,
    latest_use_case: summary.latest_use_case,
  };
}

async function isSustainedLowTier(userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const rows = await optionalQuery<{ count: string | number }>("health_insight_reports", `
    select count(*)::int
    from public.health_insight_reports
    where user_id = $1::uuid
      and status = 'active'
      and generated_at >= now() - interval '21 days'
      and severity_tier >= 3
  `, [userId]);
  return Number(rows[0]?.count ?? 0) >= 2;
}

async function checkRealTimeSignals(userId: string, since?: Date | string | null): Promise<RealtimeSignals> {
  const from = since ? new Date(since) : todayStart();
  const urgentFlags: string[] = [];
  let tierRaise = 1;

  const missedMed = await checkMissedMedicationToday(userId);
  if (missedMed) {
    urgentFlags.push(missedMed.message);
    tierRaise = Math.max(tierRaise, 3);
  }

  const symptomRows = await optionalQuery<{ chief_complaint: string | null; urgency: string | null }>("triage_reports", `
    select chief_complaint, urgency
    from public.triage_reports
    where user_id = $1 and created_at >= now() - interval '24 hours'
    order by created_at desc
    limit 1
  `, [userId]);
  if (symptomRows[0]) {
    urgentFlags.push(`Recent symptom: ${symptomRows[0].chief_complaint ?? "new report"}`);
    tierRaise = Math.max(tierRaise, symptomRows[0].urgency?.toLowerCase().includes("urgent") ? 4 : 3);
  }

  if (isUuid(userId)) {
    const patternRows = await optionalQuery<{ risk_tier: string; senior_message: string | null }>("vyva_pattern_windows", `
      select risk_tier, senior_message
      from public.vyva_pattern_windows
      where user_id = $1::uuid and analysed_at >= $2
      order by analysed_at desc
      limit 1
    `, [userId, from]);
    if (patternRows[0] && riskTierRank(patternRows[0].risk_tier) >= 3) {
      urgentFlags.push(patternRows[0].senior_message ?? "Vitals pattern needs attention");
      tierRaise = Math.max(tierRaise, riskTierRank(patternRows[0].risk_tier));
    }
  }

  return { tierRaise, urgentFlags: urgentFlags.slice(0, 4) };
}

async function selectActions(userId: string, tier: number, focusDomain: string | null | undefined, conditions: string[]): Promise<AgeWellAction[]> {
  const conditionTags = Array.from(new Set(["all", ...conditions.map(normalizeConditionTag).filter((tag): tag is string => Boolean(tag))]));
  const rows = await optionalQuery<AgeWellAction>("agewell_action_library", `
    select id, category, label, description, destination_type, destination_path,
           condition_tags, tier_min
    from public.agewell_action_library
    where is_active = true
      and language = $1
      and tier_min <= $2
      and (condition_tags && $3::text[] or 'all' = any(condition_tags))
      and (
        last_shown_at is null
        or last_outcome = 'hard'
        or (last_outcome = 'done' and last_shown_at < now() - avoid_after_done * interval '1 day')
        or (last_outcome = 'skip' and last_shown_at < now() - avoid_after_skip * interval '1 day')
      )
    order by
      case when category = $4 then 0 else 1 end,
      tier_min desc,
      coalesce(last_shown_at, '1970-01-01'::timestamptz) asc
    limit 24
  `, ["es", tier, conditionTags, focusDomain ?? ""]);

  if (rows.length === 0) return [];
  const picked: AgeWellAction[] = [];
  const add = (candidate?: AgeWellAction) => {
    if (candidate && !picked.some((action) => action.id === candidate.id)) picked.push(candidate);
  };

  add(rows.find((action) => categoryMatchesFocus(action.category, focusDomain)));
  add(rows.find((action) => action.category === "eat"));
  add(rows.find((action) => ["move", "calm"].includes(action.category)));
  add(rows.find((action) => ["avoid", "medicine", "home", "follow-up", "sleep"].includes(action.category)));

  for (const row of rows) {
    if (picked.length >= 3) break;
    add(row);
  }

  return picked.slice(0, 3).map((action) => ({
    ...action,
    destination_path: routeForAction(action),
  }));
}

async function generateDailyHeroCopy(input: {
  report: HealthInsightReport | null;
  effectiveTier: number;
  urgentFlags: string[];
  userProfile: ProfileSummary;
}): Promise<{ heroCopy: string; insightText: string }> {
  const { report, effectiveTier, urgentFlags, userProfile } = input;
  const tierContext: Record<number, string> = {
    1: "The user is broadly well-managed.",
    2: "There are one or two things worth gentle attention.",
    3: "There is something worth flagging to a doctor soon.",
    4: "There are meaningful signals worth caregiver awareness.",
    5: "There is an urgent signal; tone must still be calm, not alarming.",
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      heroCopy: `Hola, ${userProfile.first_name}.`,
      insightText: report?.synthesized_recommendation_senior
        ? truncate(report.synthesized_recommendation_senior, 90)
        : "Aqui tienes tu plan para hoy.",
    };
  }

  const prompt = `You are VYVA, a warm AI companion for seniors 65+.

Generate exactly two things:
1. HERO: One warm, personal sentence (max 12 words).
2. INSIGHT: One sentence explaining today's health focus (max 20 words).

Rules:
- User's first name: ${userProfile.first_name}
- Severity today: ${tierContext[effectiveTier] ?? tierContext[1]}
- Focus domain: ${report?.focus_domain ?? "general wellbeing"}
- Urgent signals: ${urgentFlags.length > 0 ? urgentFlags.join(", ") : "none"}
- Weekly summary: ${report?.synthesized_recommendation_senior ?? "No recent report; use general wellness framing."}
- Language: ${userProfile.language_preference ?? "es"}
- NEVER use: risk, elevated, abnormal, diagnosis, critical, dangerous
- NEVER suggest medication changes or dosage
- Tone: warm, calm, personal

Respond in this exact format only:
HERO: [sentence]
INSIGHT: [sentence]`;

  try {
    const responsePromise = anthropic.messages.create({
      model: HERO_MODEL,
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });
    const response = await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("hero copy timeout")), 1200)),
    ]);
    const block = response.content[0];
    const text = block?.type === "text" ? block.text : "";
    const heroMatch = text.match(/HERO:\s*(.+)/i);
    const insightMatch = text.match(/INSIGHT:\s*(.+)/i);
    return {
      heroCopy: heroMatch?.[1]?.trim() ?? `Hola, ${userProfile.first_name}.`,
      insightText: insightMatch?.[1]?.trim() ?? "Aqui tienes tu plan para hoy.",
    };
  } catch (err) {
    console.warn("[health-insights] Hero copy fallback used.", err);
    return {
      heroCopy: `Hola, ${userProfile.first_name}.`,
      insightText: "Aqui tienes tu plan para hoy.",
    };
  }
}

async function logDelivery(userId: string, reportId: string | null, actionId: string | null, surface: DeliveredSurface, tier: number): Promise<void> {
  if (!isUuid(userId)) return;
  await optionalQuery("insight_outcomes", `
    insert into public.insight_outcomes
      (user_id, report_id, action_id, tier_at_generation, delivered_surface, delivered_at)
    values ($1::uuid, nullif($2, $5)::uuid, nullif($3, $5)::uuid, $4, $6, now())
  `, [userId, reportId ?? UUID_ZERO, actionId ?? UUID_ZERO, Math.max(1, Math.min(5, tier)), UUID_ZERO, surface]);
}

async function updateFeedback(userId: string, actionId: string, outcome: ActionOutcome, reportId?: string | null): Promise<void> {
  if (!isUuid(userId) || !isUuid(actionId)) return;
  const report = reportId && isUuid(reportId) ? await getReportById(userId, reportId) : null;
  const existing = await optionalQuery<{ id: string }>("insight_outcomes", `
    select id
    from public.insight_outcomes
    where user_id = $1::uuid
      and action_id = $2::uuid
      and delivered_surface = 'agewell_plan'
      and delivered_at >= now() - interval '1 day'
    order by delivered_at desc
    limit 1
  `, [userId, actionId]);

  if (existing[0]) {
    await optionalQuery("insight_outcomes", `
      update public.insight_outcomes
      set acknowledged_at = now(),
          acknowledged_by = 'senior',
          action_taken = $1,
          follow_up_check_at = case when $1 = 'done' then now() + interval '7 days' else follow_up_check_at end
      where id = $2::uuid
    `, [outcome, existing[0].id]);
  } else {
    await optionalQuery("insight_outcomes", `
      insert into public.insight_outcomes
        (user_id, report_id, action_id, tier_at_generation, delivered_surface,
         acknowledged_at, acknowledged_by, action_taken, follow_up_check_at)
      values ($1::uuid, nullif($2, $6)::uuid, $3::uuid, $4, 'agewell_plan',
              now(), 'senior', $5,
              case when $5 = 'done' then now() + interval '7 days' else null end)
    `, [userId, report?.id ?? UUID_ZERO, actionId, report?.severity_tier ?? 1, outcome, UUID_ZERO]);
  }

  await optionalQuery("agewell_action_library", `
    update public.agewell_action_library
    set last_shown_at = now(), last_outcome = $1
    where id = $2::uuid
  `, [outcome, actionId]);
}

async function getReportById(userId: string, reportId: string): Promise<HealthInsightReport | null> {
  if (!isUuid(userId) || !isUuid(reportId)) return null;
  const rows = await optionalQuery<HealthInsightReport>("health_insight_reports", `
    select *
    from public.health_insight_reports
    where user_id = $1::uuid and id = $2::uuid
    limit 1
  `, [userId, reportId]);
  return rows[0] ?? null;
}

async function checkMissedMedicationToday(userId: string): Promise<{ message: string } | null> {
  const meds = await optionalQuery<{ medication_name: string; scheduled_times: string[] | null }>("user_medications", `
    select medication_name, scheduled_times
    from public.user_medications
    where user_id = $1 and active = true
    limit 50
  `, [userId]);
  if (meds.length === 0) return null;

  const takenRows = await optionalQuery<{ count: string | number }>("medication_adherence", `
    select count(*)::int
    from public.medication_adherence
    where user_id = $1 and status = 'taken' and created_at >= $2
  `, [userId, todayStart()]);
  const due = meds.reduce((total, med) => total + scheduledDoseCount(med.scheduled_times), 0);
  const taken = Number(takenRows[0]?.count ?? 0);
  if (due > taken) {
    const remaining = due - taken;
    return { message: remaining === 1 ? "One medicine dose still needs attention." : `${remaining} medicine doses still need attention.` };
  }
  return null;
}

async function wasNudgeShownToday(userId: string, reportId: string): Promise<boolean> {
  if (!isUuid(userId) || !isUuid(reportId)) return false;
  const rows = await optionalQuery<{ count: string | number }>("insight_outcomes", `
    select count(*)::int
    from public.insight_outcomes
    where user_id = $1::uuid
      and report_id = $2::uuid
      and delivered_surface = 'smart_nudge'
      and delivered_at >= $3
  `, [userId, reportId, todayStart()]);
  return Number(rows[0]?.count ?? 0) > 0;
}

async function checkBrainCoachDue(userId: string): Promise<{ message: string } | null> {
  const rows = await optionalQuery<{ recent_sessions: string | number; today_sessions: string | number }>("cognitive_session_index", `
    select
      count(*) filter (where played_at >= now() - interval '14 days')::int as recent_sessions,
      count(*) filter (where played_at >= $2)::int as today_sessions
    from public.cognitive_session_index
    where user_id = $1 and played_at >= now() - interval '14 days'
  `, [userId, todayStart()]);
  const row = rows[0];
  if (row && Number(row.recent_sessions) > 0 && Number(row.today_sessions) === 0) {
    return { message: "A short mind check is ready today." };
  }
  return null;
}

async function checkUpcomingAppointment(userId: string): Promise<{ message: string } | null> {
  const rows = await optionalQuery<{ title: string; scheduled_for: Date }>("scheduled_events", `
    select title, scheduled_for
    from public.scheduled_events
    where user_id = $1
      and status in ('upcoming','scheduled')
      and scheduled_for between now() and now() + interval '48 hours'
    order by scheduled_for asc
    limit 1
  `, [userId]);
  if (!rows[0]) return null;
  return { message: `Upcoming: ${truncate(rows[0].title, 80)}` };
}

async function getUserStreak(userId: string): Promise<{ days: number; message: string } | null> {
  const rows = await optionalQuery<{ streak_days: number }>("checkin_trend_state", `
    select streak_days
    from public.checkin_trend_state
    where user_id = $1
    limit 1
  `, [userId]);
  const days = Number(rows[0]?.streak_days ?? 0);
  return days > 1 ? { days, message: `${days} days of check-ins. Keep the rhythm.` } : null;
}

async function getActiveUserIds(): Promise<string[]> {
  const since = daysAgo(30);
  const sources = await Promise.all([
    optionalQuery<{ user_id: string }>("vyva_signal_readings", "select distinct user_id::text from public.vyva_signal_readings where created_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("medication_adherence", "select distinct user_id from public.medication_adherence where created_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("triage_reports", "select distinct user_id from public.triage_reports where created_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("checkin_sessions", "select distinct user_id from public.checkin_sessions where created_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("cognitive_session_index", "select distinct user_id from public.cognitive_session_index where played_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("concierge_sessions", "select distinct user_id from public.concierge_sessions where started_at >= $1 limit 500", [since]),
  ]);
  return Array.from(new Set(sources.flat().map((row) => row.user_id).filter(isUuid)));
}

async function runLLMSynthesis(input: {
  severity_tier: number;
  focus_domain: string;
  domainSummaries: SynthesisInput;
  correlationFlags: CorrelationFlag[];
  conditionFramingNote: string;
  profile: ProfileSummary;
  reportType: ReportType;
  windowDays: number;
}): Promise<{ caregiverText: string; seniorText: string }> {
  const { severity_tier, focus_domain, domainSummaries, correlationFlags, conditionFramingNote, profile, reportType, windowDays } = input;
  const fallback = {
    seniorText: `Hola, ${profile.first_name}. VYVA has prepared a calm ${focus_domain} focus for this week.`,
    caregiverText: "Deterministic signals are available in the domain summaries.",
  };

  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  const tierLabels: Record<number, string> = {
    1: "broadly well-managed; positive framing, gentle tips only",
    2: "one or two things worth attention; no alarm",
    3: "worth flagging to a doctor; calm, factual, clear action",
    4: "caregiver should be aware; factual, specific, not alarming",
    5: "urgent; calm, clear, immediate action required",
  };
  const firedRules = correlationFlags.filter((flag) => flag.fired).map((flag) => flag.rule);
  const system = `You are VYVA's health analysis engine.
Condition framing: ${conditionFramingNote}
NEVER produce a diagnosis, prognosis, or dosage instruction.
NEVER use: risk, elevated, abnormal, dangerous, critical, disease progression.
Regulatory constraint: general wellness guidance only, not clinical decision support.
The deterministic tier (${severity_tier}) is fixed; reflect it, do not override it.
Senior text: warm, <=3 sentences, no jargon, first name ${profile.first_name}, language ${profile.language_preference ?? "es"}.
Caregiver text: factual, domain-by-domain rationale, always in English.`;
  const user = `Report: ${reportType} (${windowDays}-day window)
Tier: ${severity_tier}; ${tierLabels[severity_tier] ?? tierLabels[1]}
Focus: ${focus_domain}
Domain summaries: ${JSON.stringify(domainSummaries, null, 2)}
Correlation rules fired: ${firedRules.length > 0 ? firedRules.join(", ") : "none"}

Produce exactly:
SENIOR_TEXT: [warm, personal, <=3 sentences, in ${profile.language_preference ?? "es"}]
CAREGIVER_TEXT: [factual rationale citing signals, in English]`;

  try {
    const response = await anthropic.messages.create({
      model: SYNTHESIS_MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = response.content[0];
    const text = block?.type === "text" ? block.text : "";
    const seniorMatch = text.match(/SENIOR_TEXT:\s*([\s\S]+?)(?=CAREGIVER_TEXT:|$)/i);
    const caregiverMatch = text.match(/CAREGIVER_TEXT:\s*([\s\S]+?)$/i);
    return {
      seniorText: seniorMatch?.[1]?.trim() || fallback.seniorText,
      caregiverText: caregiverMatch?.[1]?.trim() || fallback.caregiverText,
    };
  } catch (err) {
    console.error("[health-insights] LLM synthesis failed:", err);
    return fallback;
  }
}

export async function runFullSynthesis(userId: string, reportType: ReportType, windowDays: number): Promise<void> {
  if (!isUuid(userId)) return;
  const periodEnd = new Date();
  const periodStart = daysAgo(windowDays);

  const [vitals, meds, cognitive, mood, symptoms, concierge, conditions, profile, sustainedLow] = await Promise.all([
    getVitalsSummary(userId, periodStart),
    getMedicationSummary(userId, periodStart),
    getCognitiveSummary(userId, periodStart),
    getMoodSummary(userId, periodStart),
    getSymptomSummary(userId, periodStart),
    getConciergeSummary(userId, periodStart, windowDays),
    getUserConditions(userId),
    getUserProfile(userId),
    isSustainedLowTier(userId),
  ]);

  const sourceSignals = {
    vitals: vitals !== null,
    medications: meds !== null,
    cognitive: cognitive !== null,
    mood: mood !== null,
    symptoms: symptoms !== null,
    concierge: concierge !== null,
  };
  const domainSummaries = { vitals, meds, cognitive, mood, symptoms, concierge };
  const domainTiers = computeDomainTiers(domainSummaries);
  const correlationFlags = runCorrelationRules({ ...domainSummaries, domainTiers, sustained_low: sustainedLow });
  const correlationFloorTier = correlationFlags
    .filter((flag) => flag.fired)
    .reduce((max, flag) => Math.max(max, flag.severity ?? 1), 1);
  const conditionProfile = await getConditionProfile(conditions);
  const weightedTiers = applyConditionWeights(domainTiers, conditionProfile.weighted_domains);
  const severityTier = Math.min(5, Math.max(1, correlationFloorTier, ...Object.values(weightedTiers)));
  const focusDomain = getTopDomain(weightedTiers);
  const synthesis = await runLLMSynthesis({
    severity_tier: severityTier,
    focus_domain: focusDomain,
    domainSummaries,
    correlationFlags,
    conditionFramingNote: conditionProfile.framing_note,
    profile,
    reportType,
    windowDays,
  });

  await pool.query(`
    update public.health_insight_reports
    set status = 'superseded'
    where user_id = $1::uuid and report_type = $2 and status = 'active'
  `, [userId, reportType]);

  await pool.query(`
    insert into public.health_insight_reports (
      user_id, report_type, period_start, period_end,
      severity_tier, confidence, source_signals,
      vitals_summary, medication_summary, cognitive_summary,
      mood_summary, symptom_summary, concierge_summary,
      correlation_flags, synthesized_recommendation_caregiver,
      synthesized_recommendation_senior, focus_domain,
      recommend_clinician, status
    ) values (
      $1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18,'active'
    )
  `, [
    userId,
    reportType,
    periodStart,
    periodEnd,
    severityTier,
    computeConfidence(sourceSignals),
    JSON.stringify(sourceSignals),
    JSON.stringify(vitals),
    JSON.stringify(meds),
    JSON.stringify(cognitive),
    JSON.stringify(mood),
    JSON.stringify(symptoms),
    JSON.stringify(concierge),
    JSON.stringify(correlationFlags),
    synthesis.caregiverText,
    synthesis.seniorText,
    focusDomain,
    severityTier >= 3,
  ]);
}

async function getPendingFollowUps(): Promise<PendingOutcome[]> {
  return optionalQuery<PendingOutcome>("insight_outcomes", `
    select id, user_id, report_id, action_id, tier_at_generation, delivered_surface
    from public.insight_outcomes
    where resolved = false
      and follow_up_check_at is not null
      and follow_up_check_at <= now()
    order by follow_up_check_at asc
    limit 500
  `);
}

async function computeMetricDelta(outcome: PendingOutcome): Promise<Record<string, unknown>> {
  const report = outcome.report_id ? await getReportById(outcome.user_id, outcome.report_id) : null;
  const currentVitals = await getVitalsSummary(outcome.user_id, daysAgo(7));
  const currentMeds = await getMedicationSummary(outcome.user_id, daysAgo(7));
  const currentMood = await getMoodSummary(outcome.user_id, daysAgo(7));
  return {
    generated_at: new Date().toISOString(),
    tier_at_generation: outcome.tier_at_generation,
    focus_domain: report?.focus_domain ?? null,
    before: {
      vitals: report?.vitals_summary ?? null,
      medication: report?.medication_summary ?? null,
      mood: report?.mood_summary ?? null,
    },
    after: {
      vitals: currentVitals,
      medication: currentMeds,
      mood: currentMood,
    },
  };
}

async function resolvePendingOutcomes(): Promise<void> {
  const pending = await getPendingFollowUps();
  for (const outcome of pending) {
    try {
      const delta = await computeMetricDelta(outcome);
      await pool.query(`
        update public.insight_outcomes
        set outcome_metric_delta = $1::jsonb, resolved = true
        where id = $2::uuid
      `, [JSON.stringify(delta), outcome.id]);
    } catch (err) {
      console.error(`[health-insights] Outcome follow-up failed for ${outcome.id}:`, err);
    }
  }
}

router.get("/agewell/today/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const latestReport = await getLatestReport(userId, "weekly");
    const realTimeSignals = await checkRealTimeSignals(userId, latestReport?.generated_at);
    const effectiveTier = Math.min(5, Math.max(latestReport?.severity_tier ?? 1, realTimeSignals.tierRaise));
    const userConditions = await getUserConditions(userId);
    const [actions, userProfile] = await Promise.all([
      selectActions(userId, effectiveTier, latestReport?.focus_domain, userConditions),
      getUserProfile(userId),
    ]);
    const { heroCopy, insightText } = await generateDailyHeroCopy({
      report: latestReport,
      effectiveTier,
      urgentFlags: realTimeSignals.urgentFlags,
      userProfile,
    });

    if (latestReport?.id) {
      await logDelivery(userId, latestReport.id, null, "agewell_plan", effectiveTier);
    }

    res.json({
      tier: effectiveTier,
      focus_label: latestReport?.focus_domain ?? "general",
      hero_copy: heroCopy,
      insight_text: insightText,
      actions,
      data_completeness: latestReport?.source_signals ?? {},
      report_generated_at: latestReport?.generated_at ?? null,
    });
  } catch (err) {
    console.error("[AgeWell] /today error:", err);
    res.json(safeFallbackToday());
  }
});

router.post("/agewell/feedback", async (req: Request, res: Response) => {
  const { userId: rawUserId, actionId, outcome, reportId } = req.body ?? {};
  const profileId = await resolveProfileId(req, res, rawUserId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  if (!["done", "hard", "skip"].includes(outcome) || !isUuid(actionId)) {
    res.status(400).json({ success: false, error: "Invalid feedback payload" });
    return;
  }

  try {
    await updateFeedback(userId, actionId, outcome, reportId);
    res.json({ success: true });
  } catch (err) {
    console.error("[AgeWell] /feedback error:", err);
    res.status(500).json({ success: false });
  }
});

router.get("/smart-nudge/current/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const missedMed = await checkMissedMedicationToday(userId);
    if (missedMed) {
      return res.json({
        type: "medication",
        color: "#E74C43",
        message: missedMed.message,
        action_route: "/health/medications",
      });
    }

    const report = await getLatestReport(userId, "weekly");
    if (report && report.status === "active" && !(await wasNudgeShownToday(userId, report.id))) {
      if (report.severity_tier === 5) {
        await logDelivery(userId, report.id, null, "smart_nudge", 5);
        return res.json({
          type: "emergency",
          color: "#E74C43",
          message: truncate(report.synthesized_recommendation_senior, 100),
          action_route: "/health",
        });
      }
      if (report.severity_tier === 4) {
        await logDelivery(userId, report.id, null, "smart_nudge", 4);
        return res.json({
          type: "alert",
          color: "#E74C43",
          message: truncate(report.synthesized_recommendation_senior, 100),
          action_route: "/health",
        });
      }
      if (report.severity_tier === 3) {
        await logDelivery(userId, report.id, null, "smart_nudge", 3);
        return res.json({
          type: "doctor",
          color: "#6B21A8",
          message: truncate(report.synthesized_recommendation_senior, 100),
          action_route: "/health",
        });
      }
    }

    const brainCoachDue = await checkBrainCoachDue(userId);
    if (brainCoachDue) {
      return res.json({
        type: "brain_coach",
        color: "#F59E0B",
        message: brainCoachDue.message,
        action_route: "/mind-memory",
      });
    }

    const appointment = await checkUpcomingAppointment(userId);
    if (appointment) {
      return res.json({
        type: "appointment",
        color: "#6B21A8",
        message: appointment.message,
        action_route: "/concierge",
      });
    }

    if (report && report.severity_tier === 2 && !(await wasNudgeShownToday(userId, report.id))) {
      await logDelivery(userId, report.id, null, "smart_nudge", 2);
      return res.json({
        type: "suggestion",
        color: "#F59E0B",
        message: truncate(report.synthesized_recommendation_senior, 100),
        action_route: "/health",
      });
    }

    const streak = await getUserStreak(userId);
    if (streak && streak.days > 1) {
      return res.json({
        type: "streak",
        color: "#149A63",
        message: streak.message,
        action_route: "/mind-memory",
      });
    }

    res.json(nullNudge());
  } catch (err) {
    console.error("[SmartNudge] error:", err);
    res.json(nullNudge());
  }
});

let jobsRegistered = false;
export function registerHealthInsightsJobs(): void {
  if (jobsRegistered || process.env.NODE_ENV === "test" || process.env.DISABLE_HEALTH_INSIGHTS_CRON === "true") return;
  jobsRegistered = true;
  const timezone = process.env.HEALTH_INSIGHTS_CRON_TIMEZONE ?? "Europe/Madrid";

  cron.schedule("0 3 * * 1", async () => {
    console.log("[InsightsEngine] Weekly synthesis starting...");
    const activeUsers = await getActiveUserIds();
    for (const userId of activeUsers) {
      try {
        await runFullSynthesis(userId, "weekly", 7);
      } catch (err) {
        console.error(`[InsightsEngine] Weekly failed for ${userId}:`, err);
      }
    }
    console.log("[InsightsEngine] Weekly synthesis complete.");
  }, { timezone });

  cron.schedule("0 3 * * 1", async () => {
    const now = new Date();
    if (now.getDate() > 7) {
      console.log("[InsightsEngine] Monthly guard skipped; not first Monday window.");
      return;
    }
    console.log("[InsightsEngine] Monthly deep report starting...");
    const activeUsers = await getActiveUserIds();
    for (const userId of activeUsers) {
      try {
        await runFullSynthesis(userId, "monthly", 30);
      } catch (err) {
        console.error(`[InsightsEngine] Monthly failed for ${userId}:`, err);
      }
    }
    console.log("[InsightsEngine] Monthly deep report complete.");
  }, { timezone });

  cron.schedule("0 4 * * *", async () => {
    console.log("[InsightsEngine] Outcome follow-up starting...");
    await resolvePendingOutcomes();
    console.log("[InsightsEngine] Outcome follow-up complete.");
  }, { timezone });
}

// TODO: Wire SignosScreen.tsx to /api/agewell/today/:userId.
// TODO: ElevenLabs voice delivery for synthesized senior recommendations.
// TODO: GP-ready PDF export from monthly health_insight_reports.
// TODO: Caregiver dashboard report view from health_insight_reports.
// TODO: Aggregate operator view grouped by report_type, generated_at, and severity_tier.

export default router;
