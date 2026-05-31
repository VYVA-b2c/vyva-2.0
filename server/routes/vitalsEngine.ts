import { Router } from "express";
import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import {
  buildDailySafetyCheck,
  DAILY_SAFETY_RULE_VERSION,
  mergeAiSafetySuggestion,
  statusShouldEscalate,
  type AiSafetySuggestion,
  type DailySafetyCheck,
  type MedicationSafetyContext,
  type SignalSummary,
  type TriageSafetyContext,
} from "../lib/dailySafetyCheck.js";
import {
  caregiverAlertWorkflowEvents,
  caregiverAlerts,
  medicationAdherence,
  profileMemberships,
  profiles,
  teamInvitations,
  triageReports,
  userHealthConditions,
  userMedications,
} from "../../shared/schema.js";
import {
  buildCaregiverAlertWorkflowPatch,
  caregiverAlertWorkflowStatuses,
  normalizeCaregiverAlertWorkflowStatus,
  type CaregiverAlertWorkflowRow,
} from "../lib/caregiverAlertWorkflow.js";

const router = Router();
router.use(requireUser);

const ANALYSIS_MODEL = "claude-sonnet-4-20250514";
const FALLBACK_MODEL_VERSION = "deterministic-fallback-v1";
const ALERT_TYPE = "vitals_safety_check";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const readingSchema = z.object({
  user_id: z.string().optional(),
  signal_type: z.string().min(1).max(80),
  value: z.coerce.number(),
  source: z.string().min(1).max(80).default("manual"),
  context_tag: z.string().min(1).max(80).default("general"),
  recorded_at: z.string().datetime().optional(),
  condition_tags: z.array(z.string()).optional().default([]),
});

const analyseSchema = z.object({
  user_id: z.string().optional(),
}).optional();

const acknowledgeSchema = z.object({
  analysis_id: z.string().uuid().optional(),
  action: z.enum(["recheck", "dismissed", "shared", "contacted_doctor", "urgent_guidance_followed"]),
});

const caregiverAlertWorkflowSchema = z.object({
  status: z.enum(caregiverAlertWorkflowStatuses),
  caregiver_note: z.string().max(2000).nullable().optional(),
  expected_workflow_version: z.coerce.number().int().min(1),
});

type RiskTier = "none" | "watch" | "notify" | "urgent";

type SignalReadingRow = {
  signal_type: string;
  context_tag: string | null;
  value: string | number;
  recorded_at: Date | string;
  source: string;
  deviation_pct: string | number | null;
};

type PatternWindowRow = {
  id?: string | null;
  analysed_at?: Date | string | null;
  safety_status?: string | null;
  risk_score?: number | null;
  risk_tier?: string | null;
  contributing_signals?: unknown;
  pattern_labels?: string[] | null;
  senior_message?: string | null;
  caregiver_note?: string | null;
  recommended_action?: string | null;
  alert_fired?: boolean | null;
  alert_channel?: string | null;
  model_version?: string | null;
  rule_version?: string | null;
  acknowledged_action?: string | null;
  acknowledged_at?: Date | string | null;
  resolved_at?: Date | string | null;
};

type CaregiverAlertRow = CaregiverAlertWorkflowRow & {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  sent_to?: string[] | null;
  created_at?: Date | string | null;
};

type CaregiverWorkflowActorRole = Extract<typeof profileMemberships.$inferSelect["role"], "caregiver" | "family" | "admin">;

function queryRows<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return Array.isArray(result) ? result as T[] : [];
}

function isCaregiverWorkflowActorRole(role: unknown): role is CaregiverWorkflowActorRole {
  return role === "caregiver" || role === "family" || role === "admin";
}

function daysAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function dosesPerDay(scheduledTimes: string[] | null | undefined): number {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes.length : 1;
}

function todayStartUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

function targetMatchesRequest(req: Request, profileId: string, requestedUserId?: string): boolean {
  if (!requestedUserId) return true;
  return requestedUserId === profileId || requestedUserId === req.user!.id;
}

async function resolveProfileId(req: Request): Promise<string> {
  try {
    const context = await getActiveProfileContext(req.user!.id);
    return context.profileId ?? req.user!.id;
  } catch (err) {
    console.warn("[vitals-engine] active profile lookup failed; using account id", err);
    return req.user!.id;
  }
}

async function resolveCaregiverWorkflowActor(req: Request) {
  const context = await getActiveProfileContext(req.user!.id);
  if (!context.profileId) {
    return { ok: false as const, status: 409, error: "No care profile selected" };
  }
  if (!isCaregiverWorkflowActorRole(context.role)) {
    return { ok: false as const, status: 403, error: "Caregiver workflow updates require an active caregiver role" };
  }
  return {
    ok: true as const,
    profileId: context.profileId,
    actorRole: context.role,
  };
}

async function getRecentReadings(userId: string, hours = 72): Promise<SignalReadingRow[]> {
  const result = await db.execute(sql`
    SELECT signal_type, value, recorded_at, source, deviation_pct, context_tag
    FROM vyva_signal_readings
    WHERE user_id = ${userId}
      AND recorded_at >= ${daysAgo(hours)}
      AND quality_flag = 'clean'
    ORDER BY recorded_at DESC
  `);
  return queryRows<SignalReadingRow>(result);
}

async function getLatestAnalysis(userId: string): Promise<PatternWindowRow | null> {
  const result = await db.execute(sql`
    SELECT *
    FROM vyva_pattern_windows
    WHERE user_id = ${userId}
    ORDER BY analysed_at DESC
    LIMIT 1
  `);
  return queryRows<PatternWindowRow>(result)[0] ?? null;
}

async function getAnalysisHistory(userId: string): Promise<PatternWindowRow[]> {
  const result = await db.execute(sql`
    SELECT *
    FROM vyva_pattern_windows
    WHERE user_id = ${userId}
    ORDER BY analysed_at DESC
    LIMIT 10
  `);
  return queryRows<PatternWindowRow>(result);
}

async function getBaselines(userId: string) {
  const result = await db.execute(sql`
    SELECT signal_type, context_tag, baseline_mean, baseline_stddev, sample_count, is_established, computed_at
    FROM vyva_user_baselines
    WHERE user_id = ${userId}
    ORDER BY signal_type, context_tag
  `);
  return queryRows<Record<string, unknown>>(result);
}

function caregiverAlertSelectFields() {
  return {
    id: caregiverAlerts.id,
    alert_type: caregiverAlerts.alert_type,
    severity: caregiverAlerts.severity,
    message: caregiverAlerts.message,
    sent_to: caregiverAlerts.sent_to,
    status: caregiverAlerts.status,
    acknowledged_at: caregiverAlerts.acknowledged_at,
    acknowledged_by: caregiverAlerts.acknowledged_by,
    contacted_at: caregiverAlerts.contacted_at,
    contacted_by: caregiverAlerts.contacted_by,
    resolved_at: caregiverAlerts.resolved_at,
    resolved_by: caregiverAlerts.resolved_by,
    caregiver_note: caregiverAlerts.caregiver_note,
    workflow_version: caregiverAlerts.workflow_version,
    created_at: caregiverAlerts.created_at,
  };
}

function caregiverAlertResponse(row: CaregiverAlertRow) {
  return {
    ...row,
    status: normalizeCaregiverAlertWorkflowStatus(row),
  };
}

async function getLatestAlerts(userId: string, limit = 3) {
  const rows = await db
    .select(caregiverAlertSelectFields())
    .from(caregiverAlerts)
    .where(eq(caregiverAlerts.user_id, userId))
    .orderBy(desc(caregiverAlerts.created_at))
    .limit(limit);
  return rows.map(caregiverAlertResponse);
}

async function getCaregiverAlert(userId: string, alertId: string) {
  const [row] = await db
    .select(caregiverAlertSelectFields())
    .from(caregiverAlerts)
    .where(and(
      eq(caregiverAlerts.id, alertId),
      eq(caregiverAlerts.user_id, userId),
    ))
    .limit(1);
  return row ? caregiverAlertResponse(row) : null;
}

function buildSignalSummary(readings: SignalReadingRow[]): SignalSummary[] {
  const signalMap = new Map<string, SignalReadingRow[]>();
  for (const reading of readings) {
    const key = `${reading.signal_type}|${reading.context_tag ?? "general"}`;
    signalMap.set(key, [...(signalMap.get(key) ?? []), reading]);
  }

  return [...signalMap.entries()]
    .map(([key, rows]) => {
      const [signalType, contextTag] = key.split("|");
      const values = rows.map((row) => numberOrNull(row.value)).filter((value): value is number => value !== null);
      const deviations = rows.map((row) => numberOrNull(row.deviation_pct)).filter((value): value is number => value !== null);
      const maxDeviation = deviations.length ? Math.max(...deviations.map(Math.abs)) : null;

      let trend = "stable";
      if (values.length >= 3) {
        const first = values[values.length - 1];
        const last = values[0];
        const change = ((last - first) / Math.abs(first || 1)) * 100;
        if (change > 15) trend = "rising";
        else if (change < -15) trend = "falling";
      }

      return {
        signal: signalType,
        context: contextTag,
        recent_values: values.slice(0, 5),
        deviations_pct: deviations.slice(0, 5),
        trend,
        max_deviation: maxDeviation,
        reading_count: rows.length,
      };
    })
    .sort((a, b) => (b.max_deviation ?? 0) - (a.max_deviation ?? 0));
}

async function getMedicationContext(userId: string): Promise<MedicationSafetyContext> {
  const todayStart = todayStartUTC();
  const thirtyDayStart = daysAgo(30 * 24);
  const [activeMeds, adherenceRows] = await Promise.all([
    db
      .select()
      .from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    db
      .select()
      .from(medicationAdherence)
      .where(and(eq(medicationAdherence.user_id, userId), gte(medicationAdherence.created_at, thirtyDayStart))),
  ]);

  const scheduledToday = activeMeds.reduce((sum, med) => sum + dosesPerDay(med.scheduled_times), 0);
  const takenToday = adherenceRows.filter((row) => row.status === "taken" && row.created_at >= todayStart).length;
  const missedOrLate30 = adherenceRows.filter((row) => ["missed", "skipped", "late"].includes(row.status)).length;

  return {
    activeMedicationCount: activeMeds.length,
    scheduledToday,
    takenToday,
    missedOrLate30,
  };
}

async function getLatestTriage(userId: string): Promise<TriageSafetyContext | null> {
  const [row] = await db
    .select()
    .from(triageReports)
    .where(eq(triageReports.user_id, userId))
    .orderBy(desc(triageReports.created_at))
    .limit(1);
  return row ?? null;
}

async function loadAnalysisContext(userId: string) {
  const [profile, conditionsRows, medsRows, readings, latestTriage, medication] = await Promise.all([
    db
      .select({
        full_name: profiles.full_name,
        language: profiles.language,
        language_preference: profiles.language_preference,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .orderBy(desc(profiles.created_at))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ condition: userHealthConditions.condition })
      .from(userHealthConditions)
      .where(and(eq(userHealthConditions.user_id, userId), eq(userHealthConditions.is_active, true))),
    db
      .select({
        medication_name: userMedications.medication_name,
        dosage: userMedications.dosage,
      })
      .from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    getRecentReadings(userId, 72),
    getLatestTriage(userId),
    getMedicationContext(userId),
  ]);

  const medications = medsRows.map((med) => med.dosage ? `${med.medication_name} ${med.dosage}` : med.medication_name);
  const signalSummary = buildSignalSummary(readings);
  const language = profile?.language_preference || profile?.language || "es";

  return {
    profile,
    language,
    conditions: conditionsRows.map((row) => row.condition),
    medications,
    readings,
    signalSummary,
    latestTriage,
    medication,
  };
}

function analysisResponse(row: PatternWindowRow | null, fallback?: DailySafetyCheck | null) {
  if (!row) return fallback ?? null;
  return {
    id: row.id ?? null,
    analysed_at: row.analysed_at ?? null,
    safety_status: row.safety_status ?? row.recommended_action ?? fallback?.safety_status ?? "steady",
    recommended_action: row.recommended_action ?? row.safety_status ?? fallback?.recommended_action ?? "steady",
    risk_score: row.risk_score ?? fallback?.risk_score ?? 0,
    risk_tier: row.risk_tier ?? fallback?.risk_tier ?? "none",
    contributing_signals: row.contributing_signals ?? fallback?.contributing_signals ?? {},
    pattern_labels: row.pattern_labels ?? fallback?.pattern_labels ?? [],
    senior_message: row.senior_message ?? fallback?.senior_message ?? null,
    caregiver_note: row.caregiver_note ?? fallback?.caregiver_note ?? null,
    alert_fired: row.alert_fired ?? false,
    alert_channel: row.alert_channel ?? null,
    model_version: row.model_version ?? FALLBACK_MODEL_VERSION,
    rule_version: row.rule_version ?? fallback?.rule_version ?? DAILY_SAFETY_RULE_VERSION,
    acknowledged_action: row.acknowledged_action ?? null,
    acknowledged_at: row.acknowledged_at ?? null,
    resolved_at: row.resolved_at ?? null,
  };
}

async function insertPatternWindow(userId: string, analysis: DailySafetyCheck, modelVersion: string) {
  const result = await db.execute(sql`
    INSERT INTO vyva_pattern_windows (
      user_id,
      safety_status,
      risk_score,
      risk_tier,
      contributing_signals,
      pattern_labels,
      senior_message,
      caregiver_note,
      recommended_action,
      alert_fired,
      model_version,
      rule_version
    )
    VALUES (
      ${userId},
      ${analysis.safety_status},
      ${analysis.risk_score},
      ${analysis.risk_tier},
      ${JSON.stringify(analysis.contributing_signals)}::jsonb,
      ${analysis.pattern_labels}::text[],
      ${analysis.senior_message},
      ${analysis.caregiver_note},
      ${analysis.recommended_action},
      false,
      ${modelVersion},
      ${analysis.rule_version}
    )
    RETURNING *
  `);
  return queryRows<PatternWindowRow>(result)[0] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nestedFlag(consent: Record<string, unknown>, section: string, key: string): unknown {
  const value = consent[section];
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function caregiverConsentAllows(consentValue: unknown): boolean {
  const consent = asRecord(consentValue);
  const candidates = [
    consent.caregiver_health_alerts,
    consent.caregiver_full_access,
    nestedFlag(consent, "caregiver", "health_alerts"),
    nestedFlag(consent, "caregiver", "full_access"),
    nestedFlag(consent, "careteam", "caregiver_health_alerts"),
    nestedFlag(consent, "communication_preferences", "caregiver_alerts"),
  ];
  if (candidates.some((value) => value === true)) return true;
  if (candidates.some((value) => value === false)) return false;
  return true;
}

function severityFor(status: DailySafetyCheck["safety_status"]) {
  if (status === "urgent_help") return "urgent";
  if (status === "contact_doctor") return "warning";
  return "info";
}

async function maybeRecordCaregiverAlert(userId: string, analysis: DailySafetyCheck) {
  if (!statusShouldEscalate(analysis.safety_status)) return null;

  const [profile, teamRows, recentOpenAlerts] = await Promise.all([
    db
      .select({
        caregiver_name: profiles.caregiver_name,
        caregiver_contact: profiles.caregiver_contact,
        data_sharing_consent: profiles.data_sharing_consent,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        name: teamInvitations.invitee_name,
        phone: teamInvitations.invitee_phone,
        email: teamInvitations.invitee_email,
        whatsapp: teamInvitations.invitee_whatsapp,
      })
      .from(teamInvitations)
      .where(and(
        eq(teamInvitations.senior_id, userId),
        eq(teamInvitations.status, "accepted"),
        eq(teamInvitations.can_receive_health_alerts, true),
      ))
      .limit(5),
    db
      .select()
      .from(caregiverAlerts)
      .where(and(
        eq(caregiverAlerts.user_id, userId),
        eq(caregiverAlerts.alert_type, ALERT_TYPE),
        isNull(caregiverAlerts.resolved_at),
        gte(caregiverAlerts.created_at, daysAgo(12)),
      ))
      .orderBy(desc(caregiverAlerts.created_at))
      .limit(1),
  ]);

  if (recentOpenAlerts[0]) return recentOpenAlerts[0];
  if (!caregiverConsentAllows(profile?.data_sharing_consent)) return null;

  const recipients = [
    profile?.caregiver_contact || profile?.caregiver_name || "",
    ...teamRows.map((row) => row.whatsapp || row.phone || row.email || row.name || ""),
  ].filter((value, index, values) => value && values.indexOf(value) === index);

  if (recipients.length === 0) return null;

  const [alert] = await db.insert(caregiverAlerts).values({
    user_id: userId,
    alert_type: ALERT_TYPE,
    severity: severityFor(analysis.safety_status),
    message: [
      analysis.caregiver_note ?? analysis.senior_message,
      `Recommended action: ${analysis.recommended_action.replace(/_/g, " ")}.`,
    ].filter(Boolean).join("\n"),
    sent_to: recipients,
  }).returning();

  return alert;
}

async function saveSignalReading(params: {
  userId: string;
  signalType: string;
  value: number;
  source: string;
  contextTag: string;
  recordedAt?: string;
  conditionTags: string[];
}) {
  const baselineResult = await db.execute(sql`
    SELECT baseline_mean
    FROM vyva_user_baselines
    WHERE user_id = ${params.userId}
      AND signal_type = ${params.signalType}
      AND context_tag = ${params.contextTag}
    LIMIT 1
  `);
  const baseline = queryRows<{ baseline_mean: string | number }>(baselineResult)[0];
  const baselineMean = numberOrNull(baseline?.baseline_mean);
  const deviationPct = baselineMean ? roundOne(((params.value - baselineMean) / baselineMean) * 100) : null;

  const readingResult = await db.execute(sql`
    INSERT INTO vyva_signal_readings (
      user_id,
      signal_type,
      value,
      recorded_at,
      source,
      context_tag,
      baseline_ref,
      deviation_pct,
      condition_tags
    )
    VALUES (
      ${params.userId},
      ${params.signalType},
      ${params.value},
      ${params.recordedAt ? new Date(params.recordedAt) : new Date()},
      ${params.source},
      ${params.contextTag},
      ${baselineMean},
      ${deviationPct},
      ${params.conditionTags}::text[]
    )
    RETURNING *
  `);
  return {
    reading: queryRows<Record<string, unknown>>(readingResult)[0],
    deviation_pct: deviationPct,
  };
}

router.post("/reading", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!targetMatchesRequest(req, profileId, parsed.data.user_id)) {
    return res.status(403).json({ error: "Cannot save readings for another user" });
  }

  try {
    const result = await saveSignalReading({
      userId: profileId,
      signalType: parsed.data.signal_type,
      value: parsed.data.value,
      source: parsed.data.source,
      contextTag: parsed.data.context_tag,
      recordedAt: parsed.data.recorded_at,
      conditionTags: parsed.data.condition_tags,
    });

    if (result.deviation_pct !== null && Math.abs(result.deviation_pct) > 25) {
      runAnalysis(profileId).catch((err) => console.error("[vitals-engine analysis trigger]", err));
    }

    return res.json(result);
  } catch (err) {
    console.error("[vitals-engine reading]", err);
    return res.status(500).json({ error: "Failed to save vitals reading" });
  }
});

router.post("/analyse", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  const parsed = analyseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!targetMatchesRequest(req, profileId, parsed.data?.user_id)) {
    return res.status(403).json({ error: "Cannot analyse readings for another user" });
  }

  try {
    const analysis = await runAnalysis(profileId);
    return res.json(analysis);
  } catch (err) {
    console.error("[vitals-engine analyse]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to analyse vitals" });
  }
});

router.post("/acknowledge", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  const parsed = acknowledgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = parsed.data.analysis_id
      ? await db.execute(sql`
          UPDATE vyva_pattern_windows
          SET acknowledged_action = ${parsed.data.action},
              acknowledged_at = NOW(),
              resolved_at = CASE WHEN ${parsed.data.action} = 'dismissed' THEN NOW() ELSE resolved_at END
          WHERE id = ${parsed.data.analysis_id}
            AND user_id = ${profileId}
          RETURNING *
        `)
      : await db.execute(sql`
          UPDATE vyva_pattern_windows
          SET acknowledged_action = ${parsed.data.action},
              acknowledged_at = NOW(),
              resolved_at = CASE WHEN ${parsed.data.action} = 'dismissed' THEN NOW() ELSE resolved_at END
          WHERE id = (
            SELECT id
            FROM vyva_pattern_windows
            WHERE user_id = ${profileId}
            ORDER BY analysed_at DESC
            LIMIT 1
          )
          RETURNING *
        `);

    const row = queryRows<PatternWindowRow>(result)[0];
    if (!row) return res.status(404).json({ error: "Analysis not found" });

    await db
      .update(caregiverAlerts)
      .set({
        resolved_at: new Date(),
        resolved_by: profileId,
      })
      .where(and(
        eq(caregiverAlerts.user_id, profileId),
        eq(caregiverAlerts.alert_type, ALERT_TYPE),
        isNull(caregiverAlerts.resolved_at),
      ));

    return res.json(analysisResponse(row));
  } catch (err) {
    console.error("[vitals-engine acknowledge]", err);
    return res.status(500).json({ error: "Failed to acknowledge safety check" });
  }
});

async function sendLatestVitalsIntelligence(profileId: string, res: Response) {
  try {
    const context = await loadAnalysisContext(profileId);
    const fallback = buildDailySafetyCheck({
      signalSummary: context.signalSummary,
      latestTriage: context.latestTriage,
      medication: context.medication,
      language: context.language,
    });
    const [analysis, baselines, alerts] = await Promise.all([
      getLatestAnalysis(profileId),
      getBaselines(profileId),
      getLatestAlerts(profileId, 3),
    ]);

    return res.json({
      analysis: analysisResponse(analysis, fallback),
      recent_readings: context.readings,
      baselines,
      latest_alert: alerts[0] ?? null,
      recent_alerts: alerts,
    });
  } catch (err) {
    console.error("[vitals-engine latest]", err);
    return res.status(500).json({ error: "Failed to load vitals intelligence" });
  }
}

router.get("/latest", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  return sendLatestVitalsIntelligence(profileId, res);
});

router.get("/latest/:requestedUserId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  if (!targetMatchesRequest(req, profileId, req.params.requestedUserId)) {
    return res.status(403).json({ error: "Cannot read readings for another user" });
  }
  return sendLatestVitalsIntelligence(profileId, res);
});

router.get("/history", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  try {
    const rows = await getAnalysisHistory(profileId);
    return res.json({ analyses: rows.map((row) => analysisResponse(row)) });
  } catch (err) {
    console.error("[vitals-engine history]", err);
    return res.status(500).json({ error: "Failed to load vitals safety history" });
  }
});

router.get("/caregiver/latest-alerts", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  try {
    const [alerts, analysis] = await Promise.all([
      getLatestAlerts(profileId, 5),
      getLatestAnalysis(profileId),
    ]);
    return res.json({
      alerts,
      latest_analysis: analysisResponse(analysis),
    });
  } catch (err) {
    console.error("[vitals-engine caregiver alerts]", err);
    return res.status(500).json({ error: "Failed to load caregiver safety alerts" });
  }
});

router.patch("/caregiver/alerts/:alertId/workflow", async (req: Request, res: Response) => {
  const actor = await resolveCaregiverWorkflowActor(req);
  if (!actor.ok) return res.status(actor.status).json({ error: actor.error });

  const parsed = caregiverAlertWorkflowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const profileId = actor.profileId;
    const current = await getCaregiverAlert(profileId, req.params.alertId);
    if (!current) return res.status(404).json({ error: "Caregiver alert not found" });

    const currentVersion = current.workflow_version ?? 1;
    if (parsed.data.expected_workflow_version !== currentVersion) {
      return res.status(409).json({
        code: "CAREGIVER_WORKFLOW_CONFLICT",
        error: "Caregiver alert workflow changed. Refresh and try again.",
        alert: current,
      });
    }

    const nextVersion = currentVersion + 1;
    const patch = buildCaregiverAlertWorkflowPatch(
      current,
      parsed.data,
      req.user!.id,
    );
    patch.workflow_version = nextVersion;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(caregiverAlerts)
        .set(patch)
        .where(and(
          eq(caregiverAlerts.id, req.params.alertId),
          eq(caregiverAlerts.user_id, profileId),
          eq(caregiverAlerts.workflow_version, currentVersion),
        ))
        .returning(caregiverAlertSelectFields());

      if (!row) return null;

      await tx.insert(caregiverAlertWorkflowEvents).values({
        alert_id: current.id,
        user_id: profileId,
        actor_user_id: req.user!.id,
        actor_role: actor.actorRole,
        from_status: normalizeCaregiverAlertWorkflowStatus(current),
        to_status: parsed.data.status,
        from_caregiver_note: current.caregiver_note ?? null,
        to_caregiver_note: Object.prototype.hasOwnProperty.call(parsed.data, "caregiver_note")
          ? parsed.data.caregiver_note ?? null
          : current.caregiver_note ?? null,
        from_workflow_version: currentVersion,
        to_workflow_version: nextVersion,
      });

      return row;
    });

    if (!updated) {
      const latest = await getCaregiverAlert(profileId, req.params.alertId);
      return res.status(409).json({
        code: "CAREGIVER_WORKFLOW_CONFLICT",
        error: "Caregiver alert workflow changed. Refresh and try again.",
        alert: latest,
      });
    }
    return res.json({ alert: caregiverAlertResponse(updated) });
  } catch (err) {
    console.error("[vitals-engine caregiver alert workflow]", err);
    return res.status(500).json({ error: "Failed to update caregiver alert workflow" });
  }
});

router.post("/baseline/update", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);

  try {
    const combosResult = await db.execute(sql`
      SELECT DISTINCT signal_type, context_tag
      FROM vyva_signal_readings
      WHERE user_id = ${profileId}
        AND quality_flag = 'clean'
        AND recorded_at >= ${daysAgo(14 * 24)}
    `);
    const combos = queryRows<{ signal_type: string; context_tag: string | null }>(combosResult);
    let updated = 0;

    for (const combo of combos) {
      const contextTag = combo.context_tag ?? "general";
      const readingsResult = await db.execute(sql`
        SELECT value
        FROM vyva_signal_readings
        WHERE user_id = ${profileId}
          AND signal_type = ${combo.signal_type}
          AND context_tag = ${contextTag}
          AND quality_flag = 'clean'
          AND recorded_at >= ${daysAgo(14 * 24)}
      `);

      const values = queryRows<{ value: string | number }>(readingsResult)
        .map((reading) => numberOrNull(reading.value))
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b);

      if (values.length < 3) continue;

      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
      const stddev = Math.sqrt(variance);
      const p25 = values[Math.floor((values.length - 1) * 0.25)];
      const p75 = values[Math.floor((values.length - 1) * 0.75)];

      await db.execute(sql`
        INSERT INTO vyva_user_baselines (
          user_id,
          signal_type,
          context_tag,
          baseline_mean,
          baseline_stddev,
          baseline_p25,
          baseline_p75,
          sample_count,
          is_established,
          computed_at
        )
        VALUES (
          ${profileId},
          ${combo.signal_type},
          ${contextTag},
          ${roundOne(mean)},
          ${roundOne(stddev)},
          ${roundOne(p25)},
          ${roundOne(p75)},
          ${values.length},
          ${values.length >= 10},
          NOW()
        )
        ON CONFLICT (user_id, signal_type, context_tag)
        DO UPDATE SET
          baseline_mean = EXCLUDED.baseline_mean,
          baseline_stddev = EXCLUDED.baseline_stddev,
          baseline_p25 = EXCLUDED.baseline_p25,
          baseline_p75 = EXCLUDED.baseline_p75,
          sample_count = EXCLUDED.sample_count,
          is_established = EXCLUDED.is_established,
          computed_at = NOW()
      `);
      updated += 1;
    }

    return res.json({ updated });
  } catch (err) {
    console.error("[vitals-engine baseline]", err);
    return res.status(500).json({ error: "Failed to update vitals baselines" });
  }
});

export async function runAnalysis(userId: string) {
  const context = await loadAnalysisContext(userId);
  const deterministic = buildDailySafetyCheck({
    signalSummary: context.signalSummary,
    latestTriage: context.latestTriage,
    medication: context.medication,
    language: context.language,
  });

  const aiSuggestion = await callClaude({
    name: context.profile?.full_name || "usted",
    conditions: context.conditions,
    medications: context.medications,
    language: context.language,
    signalSummary: context.signalSummary,
    deterministic,
  });

  const analysis = mergeAiSafetySuggestion(deterministic, aiSuggestion);
  const modelVersion = aiSuggestion ? ANALYSIS_MODEL : FALLBACK_MODEL_VERSION;
  const stored = await insertPatternWindow(userId, analysis, modelVersion);
  const alert = await maybeRecordCaregiverAlert(userId, analysis).catch((err) => {
    console.error("[vitals-engine caregiver alert]", err);
    return null;
  });

  if (alert && stored?.id) {
    await db.execute(sql`
      UPDATE vyva_pattern_windows
      SET alert_fired = true,
          alert_channel = 'caregiver_alerts'
      WHERE id = ${stored.id}
        AND user_id = ${userId}
    `);
  }

  return {
    ...analysis,
    id: stored?.id ?? null,
    analysed_at: stored?.analysed_at ?? null,
    alert_fired: Boolean(alert),
    alert_channel: alert ? "caregiver_alerts" : null,
    model_version: modelVersion,
  };
}

async function callClaude(input: {
  name: string;
  conditions: string[];
  medications: string[];
  language: string;
  signalSummary: SignalSummary[];
  deterministic: DailySafetyCheck;
}): Promise<AiSafetySuggestion | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (input.signalSummary.length < 2 && input.deterministic.safety_status === "recheck") return null;

  const system = `You are VYVA's wellness-first health intelligence analyst for older adults.

Return only valid JSON with these keys:
risk_score, risk_tier, contributing_signals, pattern_labels, senior_message, caregiver_note, recommended_action.

Allowed recommended_action values:
steady, recheck, share_with_caregiver, contact_doctor, urgent_help.

Rules:
- This is not diagnosis. Do not name a disease prediction.
- The deterministic safety layer is the minimum safety level. Do not downgrade it.
- A trend across related signals matters more than one mild reading.
- senior_message must be warm, practical, in the user's language, max 35 words.
- caregiver_note may be concise and slightly more clinical.
- If data is insufficient, keep the deterministic recommendation.`;

  const payload = {
    user: {
      name: input.name,
      conditions: input.conditions,
      medications: input.medications,
      language: input.language,
    },
    signal_window_hours: 72,
    deterministic_minimum: input.deterministic,
    signals: input.signalSummary,
  };

  try {
    const response = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: JSON.stringify(payload, null, 2) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    if (!text) return null;

    return JSON.parse(text) as AiSafetySuggestion;
  } catch (err) {
    console.warn("[vitals-engine claude fallback]", err);
    return null;
  }
}

export default router;
