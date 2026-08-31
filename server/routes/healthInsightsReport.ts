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

type DailyContentType = "exercise" | "meal" | "tip" | "article";
type DailyContentRow = {
  id: string;
  content_type: DailyContentType;
  title: string;
  description: string;
  detail_text: string | null;
  source_label: string | null;
  source_url: string | null;
  condition_tags: string[];
  pillar_tag: PreventionPillar | null;
  time_of_day: string | null;
  language: string;
  rotation_weight: number;
};

type PreventionRefreshTrigger =
  | "symptom_logged"
  | "vitals_deviation"
  | "adherence_drop"
  | "cognitive_drop"
  | "mood_decline"
  | "user_requested"
  | "scheduled";

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

type PreventionPillar = "heart" | "brain" | "strength" | "nourishment" | "calm";
type PreventionPillarStatus = "thriving" | "steady" | "needs_attention" | "priority_focus";
type PreventionPillarScores = Record<PreventionPillar, PreventionPillarStatus>;
type PreventionRecommendation = { action: string; why: string };
type PreventionRecommendations = Record<PreventionPillar, PreventionRecommendation[]>;
type CrossPillarPattern = {
  pattern: string;
  fired: boolean;
  severity: "needs_attention" | "priority_focus";
  pillars_affected: PreventionPillar[];
};

type LongevityPreventionPlan = {
  id: string | null;
  user_id: string;
  generated_at: Date | string | null;
  period_start: Date;
  period_end: Date;
  pillar_heart: PreventionPillarStatus;
  pillar_brain: PreventionPillarStatus;
  pillar_strength: PreventionPillarStatus;
  pillar_nourishment: PreventionPillarStatus;
  pillar_calm: PreventionPillarStatus;
  pillar_heart_signals: SummaryMap;
  pillar_brain_signals: SummaryMap;
  pillar_strength_signals: SummaryMap;
  pillar_nourishment_signals: SummaryMap;
  pillar_calm_signals: SummaryMap;
  cross_pillar_patterns: CrossPillarPattern[];
  recommendations: PreventionRecommendations;
  priority_intervention: string | null;
  priority_why: string | null;
  plan_narrative_senior: string | null;
  plan_narrative_caregiver: string | null;
  plan_abstract_gp: string | null;
  trajectory: "improving" | "stable" | "declining" | "first";
  source_signals: Record<string, boolean>;
  confidence: string | number | null;
  priority_pillar: PreventionPillar | null;
  status: "active" | "superseded" | "archived";
};

type LongevityActionEventType = "shown" | "opened" | "done" | "too_hard" | "not_relevant";

type LongevityActionEventRow = {
  action_key: string;
  action_title: string;
  event_type: LongevityActionEventType;
  pillar: PreventionPillar | null;
  barrier: string | null;
  source_context: Record<string, unknown> | null;
  created_at: Date | string;
};

type LongevityCompanionSignal = {
  id: string;
  label: string;
  detail: string;
  source: "profile" | "medication" | "brain" | "check-in" | "symptom" | "vitals" | "feedback";
  pillar: PreventionPillar | null;
  tone: "steady" | "attention" | "positive";
};

type LongevityCompanionAction = {
  action_key: string;
  title: string;
  detail: string;
  pillar: PreventionPillar | null;
  route: string | null;
  prompt: string;
  source: "monthly_plan" | "daily_content" | "feedback_memory" | "fallback";
};

type LongevityCareSummary = {
  title: string;
  bullets: string[];
  share_text: string;
};

type LongevityCompanionPayload = {
  plan: LongevityPreventionPlan;
  todayFocus: {
    pillar: PreventionPillar | null;
    label: string;
    headline: string;
    summary: string;
  };
  whyToday: string;
  primaryAction: LongevityCompanionAction;
  supportAction: LongevityCompanionAction;
  careSummary: LongevityCareSummary;
  signalsUsed: LongevityCompanionSignal[];
  dailyContent: {
    exercise: DailyContentRow | null;
    meal: DailyContentRow | null;
    tip: DailyContentRow | null;
    articles: DailyContentRow[];
  };
  feedbackHistory: LongevityActionEventRow[];
};

const PREVENTION_PILLARS: PreventionPillar[] = ["heart", "brain", "strength", "nourishment", "calm"];
const PREVENTION_STATUS_RANK: Record<PreventionPillarStatus, number> = {
  thriving: 0,
  steady: 1,
  needs_attention: 2,
  priority_focus: 3,
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

function storageUserId(profileId: string, _accountUserId?: string): string {
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

function dailyContentTagsFor(conditions: string[], includeAll = true): string[] {
  const tags = new Set<string>();
  if (includeAll) tags.add("all");

  for (const condition of conditions) {
    const normalized = normalizeConditionTag(condition);
    if (!normalized) continue;
    tags.add(normalized);
    if (normalized === "alzheimers") tags.add("brain");
    if (normalized === "falls") tags.add("strength");
    if (normalized === "anxiety") tags.add("calm");
  }

  return Array.from(tags);
}

function todaySeed(): string {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000)).toString();
}

function normalizeLanguage(value: string | null | undefined): string {
  const language = String(value ?? "es").trim().toLowerCase().slice(0, 2);
  return language || "es";
}

async function getRecentDailyContentIds(userId: string): Promise<string[]> {
  const rows = await optionalQuery<{ content_id: string }>("longevity_daily_content_log", `
    select content_id::text as content_id
    from public.longevity_daily_content_log
    where user_id = $1 and shown_on >= current_date - interval '14 days'
  `, [userId]);
  return rows.map((row) => row.content_id).filter(Boolean);
}

async function pickDailyContentRows(input: {
  type: DailyContentType;
  language: string;
  conditionTags: string[];
  recentIds: string[];
  daySeed: string;
  allowAllFallback: boolean;
  limit: number;
}): Promise<DailyContentRow[]> {
  const tags = input.conditionTags.length > 0 ? input.conditionTags : ["__none__"];
  const rows = await optionalQuery<DailyContentRow>("longevity_daily_content", `
    select id::text, content_type, title, description, detail_text, source_label, source_url,
           condition_tags, pillar_tag, time_of_day, language, rotation_weight
    from public.longevity_daily_content
    where content_type = $1
      and language = $2
      and is_active = true
      and (
        condition_tags && $3::text[]
        or ($6::boolean = true and 'all' = any(condition_tags))
      )
      and (coalesce(array_length($4::uuid[], 1), 0) = 0 or id <> all($4::uuid[]))
    order by
      case when condition_tags && $3::text[] and not ('all' = any(condition_tags)) then 0 else 1 end,
      rotation_weight desc,
      abs(hashtext(id::text || $5::text))
    limit $7
  `, [input.type, input.language, tags, input.recentIds, input.daySeed, input.allowAllFallback, input.limit]);

  if (rows.length > 0 || input.language === "es") return rows;
  return pickDailyContentRows({ ...input, language: "es" });
}

function logDailyContentShown(userId: string, rows: DailyContentRow[]): void {
  const shownIds = rows.map((row) => row.id).filter(Boolean);
  if (shownIds.length === 0) return;
  void optionalQuery("longevity_daily_content_log", `
    insert into public.longevity_daily_content_log (user_id, content_id, shown_on)
    select $1, unnest($2::uuid[]), current_date
    on conflict (user_id, content_id, shown_on) do nothing
  `, [userId, shownIds]);
}

async function getDailyContentBundle(userId: string, conditions: string[], profile: ProfileSummary) {
  const [recentIds] = await Promise.all([getRecentDailyContentIds(userId)]);
  const language = normalizeLanguage(profile.language_preference);
  const conditionTags = dailyContentTagsFor(conditions, false);
  const seed = todaySeed();

  const [exerciseRows, mealRows, tipRows, articleRows] = await Promise.all([
    pickDailyContentRows({ type: "exercise", language, conditionTags, recentIds, daySeed: seed, allowAllFallback: true, limit: 1 }),
    pickDailyContentRows({ type: "meal", language, conditionTags, recentIds, daySeed: seed, allowAllFallback: true, limit: 1 }),
    pickDailyContentRows({ type: "tip", language, conditionTags, recentIds, daySeed: seed, allowAllFallback: true, limit: 1 }),
    conditionTags.length > 0
      ? pickDailyContentRows({ type: "article", language, conditionTags, recentIds, daySeed: seed, allowAllFallback: false, limit: 2 })
      : Promise.resolve([]),
  ]);

  const bundle = {
    exercise: exerciseRows[0] ?? null,
    meal: mealRows[0] ?? null,
    tip: tipRows[0] ?? null,
    articles: articleRows.slice(0, 2),
  };
  logDailyContentShown(userId, [bundle.exercise, bundle.meal, bundle.tip, ...bundle.articles].filter((row): row is DailyContentRow => Boolean(row)));
  return bundle;
}

function worstPreventionPillar(scores: PreventionPillarScores): PreventionPillar | null {
  return [...PREVENTION_PILLARS]
    .sort((a, b) => PREVENTION_STATUS_RANK[scores[b]] - PREVENTION_STATUS_RANK[scores[a]])[0] ?? null;
}

const PREVENTION_REFRESH_TRIGGERS = new Set<PreventionRefreshTrigger>([
  "symptom_logged",
  "vitals_deviation",
  "adherence_drop",
  "cognitive_drop",
  "mood_decline",
  "user_requested",
  "scheduled",
]);

function normalizePreventionRefreshTrigger(value: unknown): PreventionRefreshTrigger {
  return PREVENTION_REFRESH_TRIGGERS.has(value as PreventionRefreshTrigger)
    ? value as PreventionRefreshTrigger
    : "user_requested";
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

function asSummary(value: SummaryMap): Record<string, unknown> {
  return value ?? {};
}

function numericValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function conditionIncludes(conditions: string[], name: string): boolean {
  return conditions.some((condition) => normalizeConditionTag(condition) === name || condition.toLowerCase().includes(name));
}

export function scorePillarHeart(input: {
  vitals: SummaryMap;
  meds: SummaryMap;
  conditions: string[];
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.vitals && !input.meds) return "steady";
  const vitals = asSummary(input.vitals);
  const meds = asSummary(input.meds);
  let score = 0;
  if (vitals.hr_trend === "elevated") score += 2;
  if (vitals.hr_trend === "significantly_elevated") score += 3;
  if (vitals.hrv_trend === "declining") score += 2;
  if (vitals.bp_deviation === true) score += 2;
  const adherence = numericValue(meds.cardiac_adherence_pct ?? meds.adherence_pct, 100);
  if (adherence < 70) score += 2;
  if (adherence < 50) score += 1;
  const weighted = score
    * numericValue(input.conditionProfile.weighted_domains.vitals, 1)
    * numericValue(input.conditionProfile.escalation_sensitivity, 1);
  if (weighted >= 6) return "priority_focus";
  if (weighted >= 3) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function scorePillarBrain(input: {
  cognitive: SummaryMap;
  mood: SummaryMap;
  conditions: string[];
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.cognitive && !input.mood) return "steady";
  const cognitive = asSummary(input.cognitive);
  const mood = asSummary(input.mood);
  let score = 0;
  if (cognitive.accuracy_trend === "declining") score += 2;
  if (numericValue(cognitive.tier_delta) < -1) score += 2;
  const sessions = numericValue(cognitive.sessions_this_month ?? cognitive.sessions_this_week);
  if (sessions < 4) score += 1;
  if (sessions === 0) score += 2;
  if (mood.trend === "negative") score += 1;
  if (mood.trend === "significantly_negative") score += 2;
  if (sessions === 0 && numericValue(mood.check_ins_logged) < 4) score += 2;
  const weighted = score
    * numericValue(input.conditionProfile.weighted_domains.cognitive, 1)
    * numericValue(input.conditionProfile.escalation_sensitivity, 1);
  if (weighted >= 6) return "priority_focus";
  if (weighted >= 3) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function scorePillarStrength(input: {
  vitals: SummaryMap;
  conditions: string[];
  symptoms: SummaryMap;
  medicationCount: number;
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.vitals && !input.symptoms && input.conditions.length === 0 && input.medicationCount === 0) return "steady";
  const symptoms = asSummary(input.symptoms);
  let score = conditionIncludes(input.conditions, "falls") ? 2 : 0;
  const symptomText = `${String(symptoms.latest_chief_complaint ?? "")} ${JSON.stringify(symptoms.episodes ?? [])}`.toLowerCase();
  const matches = symptomText.match(/dizz|weak|unstead|fall/g) ?? [];
  if (matches.length > 0) score += 2;
  if (matches.length > 2) score += 1;
  if (input.medicationCount >= 5) score += 1;
  const weighted = score
    * numericValue(input.conditionProfile.weighted_domains.move, 1)
    * numericValue(input.conditionProfile.escalation_sensitivity, 1);
  if (weighted >= 5) return "priority_focus";
  if (weighted >= 2) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function scorePillarNourishment(input: {
  meds: SummaryMap;
  mood: SummaryMap;
  conditions: string[];
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.meds && !input.mood && input.conditions.length === 0) return "steady";
  const meds = asSummary(input.meds);
  const mood = asSummary(input.mood);
  const active = Array.isArray(meds.active) ? meds.active as Array<Record<string, unknown>> : [];
  let score = active.some((med) => String(med.name ?? "").toLowerCase().includes("metformin")) ? 1 : 0;
  if (active.some((med) => String(med.therapeutic_class ?? "").toLowerCase().includes("diuretic"))) score += 1;
  if (mood.trend === "negative" && mood.fatigue_signals === true) score += 1;
  if (conditionIncludes(input.conditions, "oncology")) score += 2;
  const weighted = score
    * numericValue(input.conditionProfile.weighted_domains.eat, 1)
    * numericValue(input.conditionProfile.escalation_sensitivity, 1);
  if (weighted >= 4) return "priority_focus";
  if (weighted >= 2) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function scorePillarCalm(input: {
  mood: SummaryMap;
  vitals: SummaryMap;
  conditions: string[];
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.mood && !input.vitals && input.conditions.length === 0) return "steady";
  const mood = asSummary(input.mood);
  const vitals = asSummary(input.vitals);
  let score = 0;
  if (mood.trend === "negative") score += 2;
  if (mood.trend === "significantly_negative") score += 3;
  const checkIns = numericValue(mood.check_ins_logged);
  if (checkIns < 4) score += 1;
  if (checkIns === 0) score += 2;
  if (vitals.hrv_trend === "declining") score += 1;
  const baseSensitivity = numericValue(input.conditionProfile.escalation_sensitivity, 1);
  const sensitivity = conditionIncludes(input.conditions, "anxiety") ? Math.min(baseSensitivity, 0.8) : baseSensitivity;
  const weighted = score * numericValue(input.conditionProfile.weighted_domains.mood, 1) * sensitivity;
  if (weighted >= 5) return "priority_focus";
  if (weighted >= 2) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function detectCrossPillarPatterns(input: {
  pillarScores: PreventionPillarScores;
  vitals: SummaryMap;
  meds: SummaryMap;
  cognitive: SummaryMap;
  mood: SummaryMap;
  symptoms: SummaryMap;
}): CrossPillarPattern[] {
  const vitals = asSummary(input.vitals);
  const meds = asSummary(input.meds);
  const cognitive = asSummary(input.cognitive);
  const mood = asSummary(input.mood);
  const sessions = numericValue(cognitive.sessions_this_month ?? cognitive.sessions_this_week);
  const activeCount = numericValue(meds.active_count ?? meds.active_medications);
  const adherence = numericValue(meds.overall_adherence_pct ?? meds.adherence_pct, 100);
  return [
    { pattern: "silent_withdrawal_spiral", fired: sessions === 0 && mood.trend === "negative" && numericValue(mood.check_ins_logged) < 3, severity: "priority_focus", pillars_affected: ["brain", "calm"] },
    { pattern: "sleep_cognitive_loop", fired: numericValue(mood.morning_vs_evening_delta) < -1.5 && cognitive.accuracy_trend === "declining", severity: "needs_attention", pillars_affected: ["brain", "calm"] },
    { pattern: "medication_cascade", fired: activeCount >= 5 && adherence < 70 && mood.trend === "negative", severity: "needs_attention", pillars_affected: ["nourishment", "calm"] },
    { pattern: "cardiovascular_cognitive_convergence", fired: vitals.hr_trend === "elevated" && cognitive.accuracy_trend === "declining", severity: "needs_attention", pillars_affected: ["heart", "brain"] },
    { pattern: "nutritional_decline", fired: mood.fatigue_signals === true && activeCount >= 3 && mood.trend === "negative", severity: "needs_attention", pillars_affected: ["nourishment", "strength"] },
  ];
}

export function resolvePriorityPillar(scores: PreventionPillarScores, conditions: string[]): PreventionPillar | null {
  const candidates = PREVENTION_PILLARS.filter((pillar) => scores[pillar] === "priority_focus");
  if (candidates.length === 0) return null;
  const preferred = conditionIncludes(conditions, "alzheimers") ? "brain"
    : conditionIncludes(conditions, "heart") ? "heart"
      : conditionIncludes(conditions, "falls") ? "strength"
        : null;
  return preferred && candidates.includes(preferred) ? preferred : candidates[0];
}

export function enforceSinglePriority(scores: PreventionPillarScores, priority: PreventionPillar | null): PreventionPillarScores {
  return Object.fromEntries(PREVENTION_PILLARS.map((pillar) => [
    pillar,
    scores[pillar] === "priority_focus" && pillar !== priority ? "needs_attention" : scores[pillar],
  ])) as PreventionPillarScores;
}

function computePreventionTrajectory(scores: PreventionPillarScores, previous: LongevityPreventionPlan | null): LongevityPreventionPlan["trajectory"] {
  if (!previous) return "first";
  const currentTotal = PREVENTION_PILLARS.reduce((total, pillar) => total + PREVENTION_STATUS_RANK[scores[pillar]], 0);
  const previousTotal = PREVENTION_PILLARS.reduce((total, pillar) => total + PREVENTION_STATUS_RANK[previous[`pillar_${pillar}`]], 0);
  if (currentTotal < previousTotal) return "improving";
  if (currentTotal > previousTotal) return "declining";
  return "stable";
}

const PREVENTION_RECOMMENDATIONS: Record<PreventionPillar, Record<PreventionPillarStatus, PreventionRecommendation[]>> = {
  heart: {
    thriving: [{ action: "Keep your daily walk going", why: "Consistency supports your heart over time." }, { action: "Keep medicine timing consistent", why: "A regular routine makes daily care easier." }],
    steady: [{ action: "Walk after lunch four days this week", why: "A steady walk supports circulation and energy." }, { action: "Use less salt at one meal each day", why: "Small changes can support your heart." }],
    needs_attention: [{ action: "Take a steady walk four days this week", why: "Regular movement is a strong heart-health habit." }, { action: "Set a daily medicine reminder", why: "A simple reminder supports consistency." }],
    priority_focus: [{ action: "Start with a gentle walk today", why: "Movement is the most useful step for this month." }, { action: "Check today's medicine routine", why: "Consistency matters most right now." }],
  },
  brain: {
    thriving: [{ action: "Keep up your Brain Coach sessions", why: "Regular challenge supports the progress you have built." }, { action: "Call someone you enjoy this week", why: "Connection supports memory and wellbeing." }],
    steady: [{ action: "Try Brain Coach each day this week", why: "Regularity matters more than duration." }, { action: "Aim for the same bedtime each night", why: "Rest supports attention and memory." }],
    needs_attention: [{ action: "Try ten minutes of Brain Coach daily", why: "A short streak can rebuild momentum." }, { action: "Plan one meaningful conversation", why: "Social connection keeps the mind engaged." }],
    priority_focus: [{ action: "Set a consistent bedtime starting tonight", why: "Rest is the foundation for this month's brain focus." }, { action: "Open Brain Coach once each day", why: "Small, regular sessions support continuity." }],
  },
  strength: {
    thriving: [{ action: "Keep moving every day", why: "Any comfortable movement counts." }, { action: "Include protein at each meal", why: "Daily protein supports muscle." }],
    steady: [{ action: "Try ten minutes of chair exercises daily", why: "Seated strength work supports stability." }, { action: "Clear your walking path tonight", why: "A clear route makes movement easier and safer." }],
    needs_attention: [{ action: "Do chair exercises each morning", why: "A routine is easier to maintain than occasional exercise." }, { action: "Walk through your home and remove obstacles", why: "A clear home supports confident movement." }],
    priority_focus: [{ action: "Begin with ten minutes of seated strength work", why: "Strength is the most useful focus this month." }, { action: "Arrange a home safety check this week", why: "Practical changes can support stability." }],
  },
  nourishment: {
    thriving: [{ action: "Keep adding colour to your plate", why: "Variety supports balanced eating." }, { action: "Keep water within easy reach", why: "Regular hydration supports energy and clarity." }],
    steady: [{ action: "Add a protein food to each meal", why: "Daily protein supports strength and recovery." }, { action: "Set simple water reminders", why: "A prompt makes hydration easier to remember." }],
    needs_attention: [{ action: "Choose protein first at each meal", why: "This is a simple way to support daily nourishment." }, { action: "Ask VYVA for an easy meal idea", why: "A little planning can make meals easier." }],
    priority_focus: [{ action: "Plan protein and water for today", why: "These are the most useful nourishment steps this month." }, { action: "Ask Concierge to help plan this week's food", why: "Practical support can make the plan easier." }],
  },
  calm: {
    thriving: [{ action: "Repeat the wind-down that worked recently", why: "Keeping the same cue protects a routine that already feels manageable." }, { action: "Keep one quiet pause in the day", why: "A familiar pause is easier to keep than a new habit." }],
    steady: [{ action: "Open the Breath Garden for two minutes", why: "A short reset fits days when calm support is useful." }, { action: "Choose tonight's wind-down time", why: "A predictable evening gives the day a softer landing." }],
    needs_attention: [{ action: "Start with one two-minute Breath Garden reset", why: "The step stays small while mood or rest signals need support." }, { action: "Message someone who lifts your spirits", why: "Connection can make a difficult day feel lighter." }],
    priority_focus: [{ action: "Pick one calm reset after breakfast", why: "Anchoring the step to an existing moment makes it easier to repeat." }, { action: "Make one meaningful social contact today", why: "Connection supports emotional wellbeing." }],
  },
};

const PILLAR_LABELS: Record<PreventionPillar, string> = {
  heart: "Heart and circulation",
  brain: "Brain and memory",
  strength: "Strength and stability",
  nourishment: "Nourishment",
  calm: "Calm and recovery",
};

function lowerFirstText(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function sentence(value: string): string {
  const clean = oneLine(value);
  if (!clean) return clean;
  return /[.!?]$/.test(clean) ? clean : clean + ".";
}

function actionKeyFor(pillar: PreventionPillar | null, title: string): string {
  const slug = oneLine(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
  return `${pillar ?? "general"}:${slug || "action"}`;
}

function statusForPillar(plan: LongevityPreventionPlan, pillar: PreventionPillar): PreventionPillarStatus {
  return plan[`pillar_${pillar}`];
}

function priorityPillarForPlan(plan: LongevityPreventionPlan): PreventionPillar | null {
  if (plan.priority_pillar) return plan.priority_pillar;
  return worstPreventionPillar({
    heart: plan.pillar_heart,
    brain: plan.pillar_brain,
    strength: plan.pillar_strength,
    nourishment: plan.pillar_nourishment,
    calm: plan.pillar_calm,
  });
}

function conditionTagLabel(tag: string): string {
  if (tag === "alzheimers") return "memory";
  if (tag === "falls") return "mobility";
  if (tag === "heart") return "heart";
  if (tag === "diabetes") return "glucose";
  if (tag === "anxiety") return "calm";
  if (tag === "oncology") return "oncology";
  return tag;
}

function signal(
  id: string,
  label: string,
  detail: string,
  source: LongevityCompanionSignal["source"],
  pillar: PreventionPillar | null,
  tone: LongevityCompanionSignal["tone"] = "attention",
): LongevityCompanionSignal {
  return { id, label, detail: sentence(detail), source, pillar, tone };
}

function buildCompanionSignals(input: {
  conditions: string[];
  vitals: SummaryMap;
  meds: SummaryMap;
  cognitive: SummaryMap;
  mood: SummaryMap;
  symptoms: SummaryMap;
  feedbackHistory: LongevityActionEventRow[];
}): LongevityCompanionSignal[] {
  const signals: LongevityCompanionSignal[] = [];
  const conditionTags = Array.from(new Set(input.conditions.map(normalizeConditionTag).filter((tag): tag is string => Boolean(tag))));
  if (conditionTags.length > 0) {
    const labels = conditionTags.slice(0, 3).map(conditionTagLabel).join(", ");
    signals.push(signal("profile-conditions", "Profile context", `Your profile includes ${labels} context`, "profile", null, "steady"));
  }

  const meds = asSummary(input.meds);
  const missedDoses = numericValue(meds.missed_doses);
  const activeMeds = numericValue(meds.active_medications);
  if (missedDoses > 0) {
    signals.push(signal("meds-missed", "Medicine routine", `${missedDoses} missed or late medicine logs appeared in the recent window`, "medication", "heart"));
  } else if (activeMeds > 0) {
    signals.push(signal("meds-active", "Medicine routine", `${activeMeds} active medicines are part of the plan context`, "medication", "heart", "steady"));
  }

  const cognitive = asSummary(input.cognitive);
  const sessions = numericValue(cognitive.sessions_this_week ?? cognitive.sessions_this_month);
  if (input.cognitive && sessions === 0) {
    signals.push(signal("brain-no-sessions", "Brain Coach", "No recent Brain Coach sessions are logged", "brain", "brain"));
  } else if (input.cognitive && sessions > 0) {
    signals.push(signal("brain-sessions", "Brain Coach", `${sessions} recent Brain Coach sessions are logged`, "brain", "brain", "positive"));
  }
  if (cognitive.accuracy_trend === "declining") {
    signals.push(signal("brain-trend", "Brain Coach", "Recent Brain Coach accuracy has been lower", "brain", "brain"));
  }

  const mood = asSummary(input.mood);
  const poorSleep = numericValue(mood.poor_sleep_count);
  const checkIns = numericValue(mood.check_ins_logged);
  if (poorSleep > 0) {
    signals.push(signal("sleep-checkins", "Sleep check-ins", `${poorSleep} poor-sleep check-ins are in the recent window`, "check-in", "calm"));
  }
  if (mood.trend === "negative") {
    signals.push(signal("mood-trend", "Check-ins", "Recent check-ins point to lower energy or mood", "check-in", "calm"));
  } else if (checkIns > 0) {
    signals.push(signal("checkins-present", "Check-ins", `${checkIns} recent check-ins are available`, "check-in", "calm", "steady"));
  }

  const symptoms = asSummary(input.symptoms);
  const complaint = oneLine(String(symptoms.latest_chief_complaint ?? ""));
  if (complaint) {
    signals.push(signal("latest-symptom", "Recent symptom", `Latest symptom report: ${complaint}`, "symptom", "strength"));
  }

  const vitals = asSummary(input.vitals);
  const latestMessage = oneLine(String(vitals.latest_message ?? ""));
  const patterns = arrayOfText(vitals.pattern_labels);
  if (latestMessage) {
    signals.push(signal("vitals-message", "Vitals", latestMessage, "vitals", "heart"));
  } else if (patterns.length > 0) {
    signals.push(signal("vitals-patterns", "Vitals", `Recent readings include ${patterns.slice(0, 2).join(" and ")}`, "vitals", "heart"));
  }

  const recentHard = input.feedbackHistory.find((event) => event.event_type === "too_hard");
  const recentIrrelevant = input.feedbackHistory.find((event) => event.event_type === "not_relevant");
  if (recentHard) {
    signals.push(signal("feedback-hard", "Your feedback", `"${recentHard.action_title}" was marked too hard recently`, "feedback", recentHard.pillar, "steady"));
  } else if (recentIrrelevant) {
    signals.push(signal("feedback-not-relevant", "Your feedback", `"${recentIrrelevant.action_title}" was marked not relevant recently`, "feedback", recentIrrelevant.pillar, "steady"));
  }

  return signals.slice(0, 8);
}

function eventAgeDays(event: LongevityActionEventRow): number {
  const date = new Date(event.created_at);
  if (Number.isNaN(date.getTime())) return 999;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

function suppressedActionKeys(feedbackHistory: LongevityActionEventRow[]): Set<string> {
  const keys = new Set<string>();
  for (const event of feedbackHistory) {
    const age = eventAgeDays(event);
    if (event.event_type === "not_relevant" && age <= 30) keys.add(event.action_key);
    if (event.event_type === "too_hard" && age <= 7) keys.add(event.action_key);
    if (event.event_type === "done" && age <= 1) keys.add(event.action_key);
  }
  return keys;
}

function routeForCompanionAction(title: string, pillar: PreventionPillar | null): string | null {
  const text = title.toLowerCase();
  if (text.includes("brain coach") || pillar === "brain") return "/mind";
  if (text.includes("breath") || text.includes("breathing") || pillar === "calm") return "/games/breath-garden";
  if (text.includes("walk") || text.includes("chair") || text.includes("strength") || pillar === "strength") return "/health/exercises/gentle-walk";
  if (text.includes("medicine") || text.includes("medication")) return "/health/medications";
  if (text.includes("food") || text.includes("protein") || text.includes("water") || pillar === "nourishment") return null;
  if (text.includes("concierge")) return "/concierge";
  return null;
}

function fallbackRecommendationForPillar(pillar: PreventionPillar | null): PreventionRecommendation {
  if (pillar === "brain") return { action: "Open one familiar Brain Coach round", why: "One familiar round keeps the step small and specific." };
  if (pillar === "heart") return { action: "Take a short walk after lunch", why: "A walk tied to lunch is easier to remember." };
  if (pillar === "strength") return { action: "Do one supported chair-strength round", why: "Supported movement keeps the step practical." };
  if (pillar === "nourishment") return { action: "Choose protein with your next meal", why: "Protein with a meal is a clear nourishment step." };
  if (pillar === "calm") return { action: "Open a two-minute breathing reset", why: "Two minutes is enough to start." };
  return { action: "Choose one small wellbeing step", why: "One clear step makes the plan easier to begin." };
}

function bestSignalForPillar(signals: LongevityCompanionSignal[], pillar: PreventionPillar | null): LongevityCompanionSignal | null {
  return signals.find((item) => item.pillar === pillar && item.source !== "feedback")
    ?? signals.find((item) => item.pillar === pillar)
    ?? signals.find((item) => item.source !== "profile")
    ?? signals[0]
    ?? null;
}

function recommendationToAction(
  recommendation: PreventionRecommendation,
  pillar: PreventionPillar | null,
  signals: LongevityCompanionSignal[],
  whyToday: string,
): LongevityCompanionAction {
  const actionSignal = bestSignalForPillar(signals, pillar);
  const detail = recommendation.why || actionSignal?.detail || whyToday;
  return {
    action_key: actionKeyFor(pillar, recommendation.action),
    title: recommendation.action,
    detail: sentence(detail),
    pillar,
    route: routeForCompanionAction(recommendation.action, pillar),
    prompt: `Help me with today's longevity step: ${recommendation.action}. Context: ${whyToday}`,
    source: "monthly_plan",
  };
}

function pickPrimaryRecommendation(
  plan: LongevityPreventionPlan,
  pillar: PreventionPillar | null,
  feedbackHistory: LongevityActionEventRow[],
): PreventionRecommendation {
  const suppressed = suppressedActionKeys(feedbackHistory);
  const planned = pillar ? (safeJson<PreventionRecommendations>(plan.recommendations, {} as PreventionRecommendations)[pillar] ?? []) : [];
  const fromPriority = plan.priority_intervention
    ? [{ action: plan.priority_intervention, why: plan.priority_why ?? planned[0]?.why ?? "This is the current priority step." }]
    : [];
  const candidates = [...fromPriority, ...planned];
  return candidates.find((item) => !suppressed.has(actionKeyFor(pillar, item.action))) ?? fallbackRecommendationForPillar(pillar);
}

function dailyContentToAction(content: DailyContentRow, pillar: PreventionPillar | null, whyToday: string): LongevityCompanionAction {
  return {
    action_key: actionKeyFor(content.pillar_tag ?? pillar, content.title),
    title: content.title,
    detail: sentence(content.description),
    pillar: content.pillar_tag ?? pillar,
    route: null,
    prompt: `Help me make this longevity step easy today: ${content.title}. Context: ${whyToday}`,
    source: "daily_content",
  };
}

function supportActionFor(input: {
  pillar: PreventionPillar | null;
  dailyContent: LongevityCompanionPayload["dailyContent"];
  feedbackHistory: LongevityActionEventRow[];
  whyToday: string;
}): LongevityCompanionAction {
  const recentHard = input.feedbackHistory.find((event) => event.event_type === "too_hard" && (!input.pillar || event.pillar === input.pillar));
  if (recentHard) {
    const title = "Make today's version smaller";
    return {
      action_key: actionKeyFor(input.pillar, title),
      title,
      detail: `You marked "${recentHard.action_title}" too hard, so start with the first two minutes only.`,
      pillar: input.pillar,
      route: null,
      prompt: `Make a smaller version of today's longevity step. Context: ${input.whyToday}`,
      source: "feedback_memory",
    };
  }

  const contentOptions = [input.dailyContent.tip, input.dailyContent.exercise, input.dailyContent.meal]
    .filter((item): item is DailyContentRow => Boolean(item));
  const matchedContent = contentOptions.find((item) => item.pillar_tag === input.pillar) ?? contentOptions[0];
  if (matchedContent) return dailyContentToAction(matchedContent, input.pillar, input.whyToday);

  const recommendation = fallbackRecommendationForPillar(input.pillar);
  return {
    action_key: actionKeyFor(input.pillar, "support-" + recommendation.action),
    title: recommendation.action,
    detail: sentence(recommendation.why),
    pillar: input.pillar,
    route: routeForCompanionAction(recommendation.action, input.pillar),
    prompt: `Help me make this easier today: ${recommendation.action}. Context: ${input.whyToday}`,
    source: "fallback",
  };
}

function buildWhyToday(pillar: PreventionPillar | null, signals: LongevityCompanionSignal[], plan: LongevityPreventionPlan): string {
  const label = pillar ? PILLAR_LABELS[pillar] : "Longevity";
  const strongest = bestSignalForPillar(signals, pillar);
  if (strongest) {
    return sentence(`${label} comes first today because ${lowerFirstText(strongest.detail)}`);
  }
  if (plan.priority_why) return sentence(plan.priority_why);
  return sentence(`${label} is the current monthly focus, so VYVA is starting with one small action today`);
}

function buildCareSummary(input: {
  profile: ProfileSummary;
  whyToday: string;
  primaryAction: LongevityCompanionAction;
  supportAction: LongevityCompanionAction;
  signals: LongevityCompanionSignal[];
}): LongevityCareSummary {
  const title = `Longevity summary for ${input.profile.first_name}`;
  const bullets = [
    input.whyToday,
    `Next step: ${input.primaryAction.title}.`,
    `Support step: ${input.supportAction.title}.`,
    ...input.signals.slice(0, 3).map((item) => `${item.label}: ${item.detail}`),
  ].map(sentence);
  return {
    title,
    bullets,
    share_text: [title, ...bullets.map((item) => "- " + item)].join("\n"),
  };
}

function buildTodayFocusHeadline(profile: ProfileSummary, pillar: PreventionPillar | null, strongestSignal: LongevityCompanionSignal | null): string {
  const lead = profile.first_name ? `${profile.first_name}, ` : "";
  if (pillar === "brain") {
    if (strongestSignal?.id === "brain-no-sessions") return `${lead}restart Brain Coach gently today`;
    if (strongestSignal?.id === "brain-trend") return `${lead}keep memory practice small today`;
    return `${lead}keep memory practice simple today`;
  }
  if (pillar === "heart") {
    if (strongestSignal?.id === "meds-missed") return `${lead}steady the medicine routine today`;
    return `${lead}support circulation with one small step`;
  }
  if (pillar === "strength") {
    if (strongestSignal?.id === "latest-symptom") return `${lead}keep movement practical today`;
    return `${lead}support stability with one small move`;
  }
  if (pillar === "nourishment") return `${lead}make food and water easier today`;
  if (pillar === "calm") {
    if (strongestSignal?.id === "sleep-checkins") return `${lead}make today easier on rest`;
    return `${lead}start with one calmer moment today`;
  }
  return `${lead}start with one useful step today`;
}

function fallbackPreventionPlan(userId: string): LongevityPreventionPlan {
  return {
    id: null,
    user_id: userId,
    generated_at: null,
    period_start: daysAgo(90),
    period_end: new Date(),
    pillar_heart: "steady",
    pillar_brain: "steady",
    pillar_strength: "steady",
    pillar_nourishment: "steady",
    pillar_calm: "steady",
    pillar_heart_signals: null,
    pillar_brain_signals: null,
    pillar_strength_signals: null,
    pillar_nourishment_signals: null,
    pillar_calm_signals: null,
    cross_pillar_patterns: [],
    recommendations: preventionRecommendations({ heart: "steady", brain: "steady", strength: "steady", nourishment: "steady", calm: "steady" }),
    priority_intervention: null,
    priority_why: null,
    plan_narrative_senior: null,
    plan_narrative_caregiver: null,
    plan_abstract_gp: null,
    trajectory: "first",
    source_signals: {},
    confidence: 0.25,
    priority_pillar: null,
    status: "active",
  };
}

export function composeLongevityCompanionPayload(input: {
  plan: LongevityPreventionPlan;
  profile: ProfileSummary;
  conditions: string[];
  vitals: SummaryMap;
  meds: SummaryMap;
  cognitive: SummaryMap;
  mood: SummaryMap;
  symptoms: SummaryMap;
  dailyContent: LongevityCompanionPayload["dailyContent"];
  feedbackHistory: LongevityActionEventRow[];
}): LongevityCompanionPayload {
  const priorityPillar = priorityPillarForPlan(input.plan);
  const signals = buildCompanionSignals(input);
  const whyToday = buildWhyToday(priorityPillar, signals, input.plan);
  const primaryRecommendation = pickPrimaryRecommendation(input.plan, priorityPillar, input.feedbackHistory);
  const primaryAction = recommendationToAction(primaryRecommendation, priorityPillar, signals, whyToday);
  const supportAction = supportActionFor({ pillar: priorityPillar, dailyContent: input.dailyContent, feedbackHistory: input.feedbackHistory, whyToday });
  const focusLabel = priorityPillar ? PILLAR_LABELS[priorityPillar] : "Longevity";
  const strongestSignal = bestSignalForPillar(signals, priorityPillar);
  const headline = buildTodayFocusHeadline(input.profile, priorityPillar, strongestSignal);

  return {
    plan: input.plan,
    todayFocus: {
      pillar: priorityPillar,
      label: focusLabel,
      headline,
      summary: strongestSignal?.detail ?? whyToday,
    },
    whyToday,
    primaryAction,
    supportAction,
    careSummary: buildCareSummary({ profile: input.profile, whyToday, primaryAction, supportAction, signals }),
    signalsUsed: signals,
    dailyContent: input.dailyContent,
    feedbackHistory: input.feedbackHistory,
  };
}

async function getRecentPlanActionEvents(userId: string): Promise<LongevityActionEventRow[]> {
  return optionalQuery<LongevityActionEventRow>("longevity_action_events", `
    select action_key, action_title, event_type, pillar, barrier, source_context, created_at
    from public.longevity_action_events
    where user_id = $1
      and created_at >= now() - interval '30 days'
    order by created_at desc
    limit 40
  `, [userId]);
}

async function getFreshPreventionPlan(userId: string): Promise<LongevityPreventionPlan> {
  const stored = await getLatestPreventionPlan(userId);
  if (stored && stored.generated_at && Date.now() - new Date(stored.generated_at).getTime() < 35 * 24 * 60 * 60 * 1000) {
    return stored;
  }
  return runPreventionPlanSynthesis(userId);
}

function normalizePreventionPillar(value: unknown): PreventionPillar | null {
  return PREVENTION_PILLARS.includes(value as PreventionPillar) ? value as PreventionPillar : null;
}

function normalizeLongevityActionEventType(value: unknown): LongevityActionEventType | null {
  return ["shown", "opened", "done", "too_hard", "not_relevant"].includes(String(value))
    ? value as LongevityActionEventType
    : null;
}

async function recordLongevityActionEvent(input: {
  userId: string;
  planId: string | null;
  pillar: PreventionPillar | null;
  actionKey: string;
  actionTitle: string;
  eventType: LongevityActionEventType;
  barrier: string | null;
  sourceContext: Record<string, unknown>;
}): Promise<void> {
  await optionalQuery("longevity_action_events", `
    insert into public.longevity_action_events
      (user_id, plan_id, pillar, action_key, action_title, event_type, barrier, source_context)
    values ($1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb)
  `, [
    input.userId,
    input.planId,
    input.pillar,
    input.actionKey,
    input.actionTitle,
    input.eventType,
    input.barrier,
    JSON.stringify(input.sourceContext),
  ]);
}

async function getLatestPreventionPlan(userId: string): Promise<LongevityPreventionPlan | null> {
  const rows = await optionalQuery<LongevityPreventionPlan>("longevity_prevention_plans", `
    select * from public.longevity_prevention_plans
    where user_id = $1 and status = 'active'
    order by generated_at desc limit 1
  `, [userId]);
  return rows[0] ?? null;
}

function preventionRecommendations(scores: PreventionPillarScores): PreventionRecommendations {
  return Object.fromEntries(PREVENTION_PILLARS.map((pillar) => [pillar, PREVENTION_RECOMMENDATIONS[pillar][scores[pillar]]])) as PreventionRecommendations;
}

async function synthesizePreventionPlan(input: {
  pillarScores: PreventionPillarScores;
  priorityPillar: PreventionPillar | null;
  crossPillarPatterns: CrossPillarPattern[];
  conditionProfile: ConditionProfile;
  profile: ProfileSummary;
}): Promise<{
  recommendations: PreventionRecommendations;
  seniorNarrative: string;
  caregiverNarrative: string;
  gpAbstract: string;
  priorityIntervention: string;
  priorityWhy: string;
}> {
  const recommendations = preventionRecommendations(input.pillarScores);
  const focus = input.priorityPillar ?? [...PREVENTION_PILLARS].sort((a, b) => PREVENTION_STATUS_RANK[input.pillarScores[b]] - PREVENTION_STATUS_RANK[input.pillarScores[a]])[0];
  const first = recommendations[focus][0];
  const fallback = {
    recommendations,
    seniorNarrative: `${input.profile.first_name}, this month we are keeping your plan simple and practical. Your main focus is ${focus}, with small steps you can build into your day. Start with one action and add more only when it feels comfortable.`,
    caregiverNarrative: `Monthly wellness plan generated from available 90-day signals. Primary lifestyle domain: ${focus}.`,
    gpAbstract: `A 90-day general-wellness summary was generated across heart, cognitive, strength, nourishment, and calm domains. The current lifestyle focus is ${focus}.`,
    priorityIntervention: first?.action ?? "Choose one small wellbeing action today",
    priorityWhy: first?.why ?? "One clear step makes the plan easier to begin.",
  };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const fired = input.crossPillarPatterns.filter((pattern) => pattern.fired).map((pattern) => pattern.pattern);
  const system = `You write VYVA monthly longevity wellness plans for adults 65+.
Condition context: ${input.conditionProfile.framing_note}
Never diagnose, predict illness, recommend medication changes, or use these words in senior-facing text: risk, elevated, abnormal, diagnosis, critical, dangerous.
Every recommendation is a lifestyle action. For clinical matters say "worth discussing with your doctor."
Senior text: warm, personal, 3-5 sentences, first name ${input.profile.first_name}, language ${input.profile.language_preference || "es"}.
Caregiver and GP text: factual, in English. The deterministic statuses are fixed and must not be changed.`;
  const prompt = `Pillar statuses: ${JSON.stringify(input.pillarScores)}
Priority pillar: ${focus}
Patterns: ${fired.length ? fired.join(", ") : "none"}
Actions: ${JSON.stringify(recommendations)}
Produce exactly:
SENIOR_NARRATIVE: [text]
PRIORITY_INTERVENTION: [one verb-led sentence]
PRIORITY_WHY: [one sentence]
CAREGIVER_NARRATIVE: [text]
GP_ABSTRACT: [one paragraph]`;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    const text = block?.type === "text" ? block.text : "";
    const read = (label: string, next?: string) => text.match(new RegExp(`${label}:\\s*([\\s\\S]+?)${next ? `(?=${next}:|$)` : "$"}`, "i"))?.[1]?.trim() ?? "";
    return {
      recommendations,
      seniorNarrative: read("SENIOR_NARRATIVE", "PRIORITY_INTERVENTION") || fallback.seniorNarrative,
      priorityIntervention: read("PRIORITY_INTERVENTION", "PRIORITY_WHY") || fallback.priorityIntervention,
      priorityWhy: read("PRIORITY_WHY", "CAREGIVER_NARRATIVE") || fallback.priorityWhy,
      caregiverNarrative: read("CAREGIVER_NARRATIVE", "GP_ABSTRACT") || fallback.caregiverNarrative,
      gpAbstract: read("GP_ABSTRACT") || fallback.gpAbstract,
    };
  } catch (err) {
    console.error("[PreventionPlan] LLM synthesis failed:", err);
    return fallback;
  }
}

export async function runPreventionPlanSynthesis(userId: string): Promise<LongevityPreventionPlan> {
  if (!userId.trim()) throw new Error("A profile ID is required for prevention plan synthesis");
  const periodEnd = new Date();
  const periodStart = daysAgo(90);
  const [vitals, meds, cognitive, mood, symptoms, conditions, profile] = await Promise.all([
    getVitalsSummary(userId, periodStart),
    getMedicationSummary(userId, periodStart),
    getCognitiveSummary(userId, periodStart),
    getMoodSummary(userId, periodStart),
    getSymptomSummary(userId, periodStart),
    getUserConditions(userId),
    getUserProfile(userId),
  ]);
  const conditionProfile = await getConditionProfile(conditions);
  const medicationCount = numericValue(asSummary(meds).active_medications);
  const scores: PreventionPillarScores = {
    heart: scorePillarHeart({ vitals, meds, conditions, conditionProfile }),
    brain: scorePillarBrain({ cognitive, mood, conditions, conditionProfile }),
    strength: scorePillarStrength({ vitals, conditions, symptoms, medicationCount, conditionProfile }),
    nourishment: scorePillarNourishment({ meds, mood, conditions, conditionProfile }),
    calm: scorePillarCalm({ mood, vitals, conditions, conditionProfile }),
  };
  const patterns = detectCrossPillarPatterns({ pillarScores: scores, vitals, meds, cognitive, mood, symptoms });
  const priorityPillar = resolvePriorityPillar(scores, conditions);
  const finalScores = enforceSinglePriority(scores, priorityPillar);
  const synthesis = await synthesizePreventionPlan({ pillarScores: finalScores, priorityPillar, crossPillarPatterns: patterns, conditionProfile, profile });
  const previous = await getLatestPreventionPlan(userId);
  const trajectory = computePreventionTrajectory(finalScores, previous);
  const sourceSignals = { vitals: vitals !== null, medications: meds !== null, cognitive: cognitive !== null, mood: mood !== null, symptoms: symptoms !== null };

  await pool.query("update public.longevity_prevention_plans set status = 'superseded' where user_id = $1 and status = 'active'", [userId]);
  const result = await pool.query<LongevityPreventionPlan>(`
    insert into public.longevity_prevention_plans (
      user_id, period_start, period_end, pillar_heart, pillar_brain, pillar_strength, pillar_nourishment, pillar_calm,
      pillar_heart_signals, pillar_brain_signals, pillar_strength_signals, pillar_nourishment_signals, pillar_calm_signals,
      cross_pillar_patterns, recommendations, priority_intervention, priority_why, priority_pillar,
      plan_narrative_senior, plan_narrative_caregiver, plan_abstract_gp, trajectory, source_signals, confidence, status
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,
      $14::jsonb,$15::jsonb,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24,'active'
    ) returning *
  `, [
    userId, periodStart, periodEnd, finalScores.heart, finalScores.brain, finalScores.strength, finalScores.nourishment, finalScores.calm,
    JSON.stringify(vitals), JSON.stringify(cognitive), JSON.stringify({ vitals, symptoms }), JSON.stringify({ meds, mood }), JSON.stringify({ mood, vitals }),
    JSON.stringify(patterns), JSON.stringify(synthesis.recommendations), synthesis.priorityIntervention, synthesis.priorityWhy, priorityPillar,
    synthesis.seniorNarrative, synthesis.caregiverNarrative, synthesis.gpAbstract, trajectory, JSON.stringify(sourceSignals), computeConfidence(sourceSignals),
  ]);
  return result.rows[0];
}

export async function triggerPreventionPlanRefresh(input: {
  userId: string;
  triggerType?: unknown;
  triggerData?: unknown;
}): Promise<{ ran: boolean; reason?: "debounced" | "missing_user" }> {
  const userId = input.userId.trim();
  if (!userId) return { ran: false, reason: "missing_user" };

  const triggerType = normalizePreventionRefreshTrigger(input.triggerType);
  const recentRun = await optionalQuery<{ id: string }>("longevity_synthesis_events", `
    select id
    from public.longevity_synthesis_events
    where user_id = $1
      and synthesis_ran = true
      and created_at > now() - interval '6 hours'
    limit 1
  `, [userId]);

  const shouldRun = recentRun.length === 0;
  await optionalQuery("longevity_synthesis_events", `
    insert into public.longevity_synthesis_events (user_id, trigger_type, trigger_data, synthesis_ran)
    values ($1, $2, $3::jsonb, $4)
  `, [userId, triggerType, JSON.stringify(input.triggerData ?? {}), shouldRun]);

  if (!shouldRun) return { ran: false, reason: "debounced" };

  void runPreventionPlanSynthesis(userId).catch((err) => {
    console.error(`[PreventionPlan] Event-driven synthesis failed for ${userId}:`, err);
  });

  return { ran: true };
}

async function hasAtLeastThirtyDaysOfData(userId: string): Promise<boolean> {
  const candidates = await Promise.all([
    optionalQuery<{ first_at: Date | null }>("vyva_signal_readings", "select min(recorded_at) as first_at from public.vyva_signal_readings where user_id::text = $1", [userId]),
    optionalQuery<{ first_at: Date | null }>("medication_adherence", "select min(created_at) as first_at from public.medication_adherence where user_id = $1", [userId]),
    optionalQuery<{ first_at: Date | null }>("triage_reports", "select min(created_at) as first_at from public.triage_reports where user_id = $1", [userId]),
    optionalQuery<{ first_at: Date | null }>("checkin_sessions", "select min(completed_at) as first_at from public.checkin_sessions where user_id = $1", [userId]),
    optionalQuery<{ first_at: Date | null }>("cognitive_session_index", "select min(played_at) as first_at from public.cognitive_session_index where user_id = $1", [userId]),
  ]);
  return candidates.some((rows) => rows[0]?.first_at && new Date(rows[0].first_at).getTime() <= daysAgo(30).getTime());
}

async function wasPlanNudgeShownThisMonth(userId: string): Promise<boolean> {
  const rows = await optionalQuery<{ count: string | number }>("insight_outcomes", `
    select count(*)::int from public.insight_outcomes
    where user_id = $1::uuid and delivered_surface = 'smart_nudge' and action_taken = 'other'
      and delivered_at >= date_trunc('month', now())
  `, [userId]);
  return numericValue(rows[0]?.count) > 0;
}

async function markPlanNudgeShown(userId: string): Promise<void> {
  await optionalQuery("insight_outcomes", `
    insert into public.insight_outcomes (user_id, tier_at_generation, delivered_surface, action_taken)
    values ($1::uuid, 1, 'smart_nudge', 'other')
  `, [userId]);
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

router.get("/prevention/plan/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);
  try {
    return res.json(await getFreshPreventionPlan(userId));
  } catch (err) {
    console.error("[PreventionPlan] GET error:", err);
    return res.json(fallbackPreventionPlan(userId));
  }
});

router.get("/prevention/companion/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);
  const periodStart = daysAgo(14);

  try {
    const plan = await getFreshPreventionPlan(userId);
    const [profile, conditions, vitals, meds, cognitive, mood, symptoms, feedbackHistory] = await Promise.all([
      getUserProfile(userId),
      getUserConditions(userId),
      getVitalsSummary(userId, periodStart),
      getMedicationSummary(userId, periodStart),
      getCognitiveSummary(userId, periodStart),
      getMoodSummary(userId, periodStart),
      getSymptomSummary(userId, periodStart),
      getRecentPlanActionEvents(userId),
    ]);
    const dailyContent = await getDailyContentBundle(userId, conditions, profile);
    return res.json(composeLongevityCompanionPayload({
      plan,
      profile,
      conditions,
      vitals,
      meds,
      cognitive,
      mood,
      symptoms,
      dailyContent,
      feedbackHistory,
    }));
  } catch (err) {
    console.error("[PreventionCompanion] GET error:", err);
    const profile = await getUserProfile(userId).catch(() => FALLBACK_PROFILE);
    const plan = fallbackPreventionPlan(userId);
    return res.json(composeLongevityCompanionPayload({
      plan,
      profile,
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: null,
      mood: null,
      symptoms: null,
      dailyContent: { exercise: null, meal: null, tip: null, articles: [] },
      feedbackHistory: [],
    }));
  }
});

router.get("/prevention/daily-content/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const [conditions, profile] = await Promise.all([
      getUserConditions(userId),
      getUserProfile(userId),
    ]);
    return res.json(await getDailyContentBundle(userId, conditions, profile));
  } catch (err) {
    console.error("[DailyContent] GET error:", err);
    return res.json({ exercise: null, meal: null, tip: null, articles: [] });
  }
});

router.post("/prevention/feedback", async (req: Request, res: Response) => {
  const rawUserId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  const profileId = await resolveProfileId(req, res, rawUserId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);
  const eventType = normalizeLongevityActionEventType(req.body?.eventType);
  const actionKey = oneLine(typeof req.body?.actionKey === "string" ? req.body.actionKey : "");
  const actionTitle = oneLine(typeof req.body?.actionTitle === "string" ? req.body.actionTitle : "");
  const barrier = typeof req.body?.barrier === "string" && req.body.barrier.trim() ? truncate(req.body.barrier, 160) : null;
  const sourceContext = typeof req.body?.sourceContext === "object" && req.body.sourceContext !== null
    ? req.body.sourceContext as Record<string, unknown>
    : {};

  if (!eventType || !actionKey || !actionTitle) {
    return res.status(400).json({ success: false, error: "Invalid feedback payload" });
  }

  try {
    await recordLongevityActionEvent({
      userId,
      planId: isUuid(req.body?.planId) ? req.body.planId : null,
      pillar: normalizePreventionPillar(req.body?.pillar),
      actionKey: truncate(actionKey, 96),
      actionTitle: truncate(actionTitle, 180),
      eventType,
      barrier,
      sourceContext,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[PreventionFeedback] POST error:", err);
    return res.status(500).json({ success: false });
  }
});

router.post("/prevention/daily-content/engage", async (req: Request, res: Response) => {
  const rawUserId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  const profileId = await resolveProfileId(req, res, rawUserId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);
  const contentId = typeof req.body?.contentId === "string" ? req.body.contentId : "";

  if (!isUuid(contentId)) {
    return res.status(400).json({ success: false, error: "Invalid content id" });
  }

  try {
    await optionalQuery("longevity_daily_content_log", `
      update public.longevity_daily_content_log
      set engaged = true
      where user_id = $1 and content_id = $2::uuid and shown_on = current_date
    `, [userId, contentId]);
    return res.json({ success: true });
  } catch (err) {
    console.error("[DailyContent] engage error:", err);
    return res.json({ success: false });
  }
});

router.get("/prevention/pillar-status/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const periodStart = daysAgo(14);
    const [vitals, meds, cognitive, mood, symptoms, conditions] = await Promise.all([
      getVitalsSummary(userId, periodStart),
      getMedicationSummary(userId, periodStart),
      getCognitiveSummary(userId, periodStart),
      getMoodSummary(userId, periodStart),
      getSymptomSummary(userId, periodStart),
      getUserConditions(userId),
    ]);
    const conditionProfile = await getConditionProfile(conditions);
    const medicationCount = numericValue(asSummary(meds).active_medications);
    const scores: PreventionPillarScores = {
      heart: scorePillarHeart({ vitals, meds, conditions, conditionProfile }),
      brain: scorePillarBrain({ cognitive, mood, conditions, conditionProfile }),
      strength: scorePillarStrength({ vitals, conditions, symptoms, medicationCount, conditionProfile }),
      nourishment: scorePillarNourishment({ meds, mood, conditions, conditionProfile }),
      calm: scorePillarCalm({ mood, vitals, conditions, conditionProfile }),
    };
    const priorityPillar = resolvePriorityPillar(scores, conditions) ?? worstPreventionPillar(scores);
    const statuses = enforceSinglePriority(scores, priorityPillar);

    return res.json({ statuses, priority_pillar: priorityPillar });
  } catch (err) {
    console.error("[PillarStatus] GET error:", err);
    return res.json({
      statuses: { heart: "steady", brain: "steady", strength: "steady", nourishment: "steady", calm: "steady" },
      priority_pillar: null,
    });
  }
});

router.post("/prevention/refresh", async (req: Request, res: Response) => {
  const rawUserId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  const profileId = await resolveProfileId(req, res, rawUserId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const result = await triggerPreventionPlanRefresh({
      userId,
      triggerType: req.body?.triggerType,
      triggerData: req.body?.triggerData,
    });
    return res.json(result);
  } catch (err) {
    console.error("[PreventionPlan] refresh error:", err);
    return res.status(500).json({ ran: false, error: "Failed to refresh plan" });
  }
});

// Longevity is canonical; /agewell remains a compatibility alias for already
// deployed clients and database delivery records.
router.get(["/longevity/today/:userId", "/agewell/today/:userId"], async (req: Request, res: Response) => {
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
    console.error("[Longevity] /today error:", err);
    res.json(safeFallbackToday());
  }
});

router.post(["/longevity/feedback", "/agewell/feedback"], async (req: Request, res: Response) => {
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
    console.error("[Longevity] /feedback error:", err);
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

    const now = new Date();
    if (now.getDay() === 1 && now.getDate() <= 7) {
      const latestPlan = await getLatestPreventionPlan(userId);
      if (latestPlan && !(await wasPlanNudgeShownThisMonth(userId))) {
        const profile = await getUserProfile(userId);
        await markPlanNudgeShown(userId);
        return res.json({
          type: "prevention_plan",
          color: "#6B21A8",
          message: `Tu plan del mes está listo, ${profile.first_name}.`,
          action_route: "/health/prevention-plan",
        });
      }
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
      try {
        if (await hasAtLeastThirtyDaysOfData(userId)) {
          await runPreventionPlanSynthesis(userId);
        } else {
          console.log(`[PreventionPlan] Skipped ${userId}; fewer than 30 days of data.`);
        }
      } catch (err) {
        console.error(`[PreventionPlan] Monthly synthesis failed for ${userId}:`, err);
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

// TODO: Wire the Longevity UI to /api/longevity/today/:userId.
// TODO: ElevenLabs voice delivery for synthesized senior recommendations.
// TODO: GP-ready PDF export from monthly health_insight_reports.
// TODO: Caregiver dashboard report view from health_insight_reports.
// TODO: Aggregate operator view grouped by report_type, generated_at, and severity_tier.
// TODO: GP-ready PDF export from plan_abstract_gp in the care-team accordion.
// TODO: ElevenLabs voice delivery for the senior narrative and pillar actions.
// TODO: Month-over-month trajectory visualisation after at least two stored plans.
// TODO: Outcome learning from Done and Skip feedback after at least three months.

export default router;
