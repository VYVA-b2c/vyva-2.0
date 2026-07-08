import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { isRelationSchemaUnavailableError } from "../lib/dbCompatibility.js";
import {
  followUpExpiresAt,
  isFollowUpExpired,
  isFollowUpVisible,
  normalizeSnoozeHours,
  snoozedUntilFrom,
  type HealthFollowUpLifecycleStatus,
} from "../lib/healthFollowUpLifecycle.js";
import { requireActiveProfileId } from "../lib/profileAccess.js";
import { buildPreventionFocus, type PreventionLoopContext, type PreventionVitalReading } from "../lib/preventionFocus.js";
import {
  healthFollowUpLifecycle,
  medicationAdherence,
  medicationSafetySignals,
  profiles,
  triageReports,
  userHealthConditions,
  userMedications,
  vitalsReadings,
  vyvaPatternWindows,
  vyvaSignalReadings,
} from "../../shared/schema.js";

const router = Router();

function startOfTodayUTC() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function scheduledDoseCount(times: string[] | null | undefined): number {
  const count = (times ?? []).filter((time) => typeof time === "string" && time.trim()).length;
  return count || 1;
}

function arrayOfText(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function objectSection(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isOptionalSchemaError(err: unknown, relation: string): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return isRelationSchemaUnavailableError(err, relation) || (
    message.includes("does not exist") &&
    message.includes(relation)
  );
}

async function safeRows<T>(label: string, query: PromiseLike<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch (err) {
    if (isOptionalSchemaError(err, label)) {
      console.warn(`[health-prevention] Optional ${label} data unavailable; continuing without it.`);
      return [];
    }
    throw err;
  }
}

function legacyVitalsToPreventionReading(row: typeof vitalsReadings.$inferSelect): PreventionVitalReading {
  return {
    signalType: row.metric_type ?? (row.bpm != null ? "resting_hr_bpm" : row.respiratory_rate != null ? "respiratory_rate" : null),
    metricType: row.metric_type,
    value: row.value ?? row.bpm ?? row.respiratory_rate ?? null,
    recordedAt: row.recorded_at,
  };
}

function signalReadingToPreventionReading(row: typeof vyvaSignalReadings.$inferSelect): PreventionVitalReading {
  return {
    signalType: row.signal_type,
    value: row.value,
    unit: row.unit,
    recordedAt: row.recorded_at,
  };
}

function latestDate(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function parseLearningContext(value: unknown): PreventionLoopContext | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value) as PreventionLoopContext;
    const clientHour = typeof parsed.clientHour === "number" && Number.isFinite(parsed.clientHour)
      ? Math.max(0, Math.min(23, Math.floor(parsed.clientHour)))
      : undefined;
    const recentFeedback = Array.isArray(parsed.recentFeedback)
      ? parsed.recentFeedback
        .filter((item) => item && typeof item === "object" && typeof item.actionId === "string" && typeof item.feedback === "string")
        .slice(0, 30)
      : undefined;
    const dismissedFollowUpIds = Array.isArray(parsed.dismissedFollowUpIds)
      ? parsed.dismissedFollowUpIds
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 20)
      : undefined;
    return {
      ...(clientHour != null ? { clientHour } : {}),
      ...(recentFeedback?.length ? { recentFeedback } : {}),
      ...(dismissedFollowUpIds?.length ? { dismissedFollowUpIds } : {}),
    };
  } catch {
    return undefined;
  }
}

type TriageReportRow = typeof triageReports.$inferSelect;
type FollowUpLifecycleRow = typeof healthFollowUpLifecycle.$inferSelect;

function isoOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeFollowUpLifecycle(row: FollowUpLifecycleRow | null | undefined) {
  if (!row) return null;
  return {
    status: row.status,
    snoozedUntil: isoOrNull(row.snoozed_until),
    expiresAt: isoOrNull(row.expires_at),
    resolvedAt: isoOrNull(row.resolved_at),
  };
}

async function safeLifecycleRows(profileId: string, reportIds: string[]): Promise<FollowUpLifecycleRow[]> {
  if (!reportIds.length) return [];
  return safeRows("health_follow_up_lifecycle", db
    .select()
    .from(healthFollowUpLifecycle)
    .where(and(
      eq(healthFollowUpLifecycle.user_id, profileId),
      inArray(healthFollowUpLifecycle.triage_report_id, reportIds),
    )));
}

async function upsertFollowUpLifecycleStatus(params: {
  profileId: string;
  report: Pick<TriageReportRow, "id" | "created_at">;
  status: HealthFollowUpLifecycleStatus;
  now: Date;
  source?: string;
  snoozedUntil?: Date | null;
  metadata?: Record<string, unknown>;
}): Promise<FollowUpLifecycleRow | null> {
  const resolvedAt = params.status === "handled" || params.status === "expired" ? params.now : null;
  const expiresAt = followUpExpiresAt(params.report.created_at);
  try {
    const [row] = await db.insert(healthFollowUpLifecycle).values({
      user_id: params.profileId,
      triage_report_id: params.report.id,
      status: params.status,
      source: params.source ?? "prevention",
      snoozed_until: params.status === "snoozed" ? params.snoozedUntil ?? snoozedUntilFrom(params.now) : null,
      expires_at: expiresAt,
      resolved_at: resolvedAt,
      metadata: params.metadata ?? {},
      updated_at: params.now,
    }).onConflictDoUpdate({
      target: [healthFollowUpLifecycle.user_id, healthFollowUpLifecycle.triage_report_id],
      set: {
        status: params.status,
        source: params.source ?? "prevention",
        snoozed_until: params.status === "snoozed" ? params.snoozedUntil ?? snoozedUntilFrom(params.now) : null,
        expires_at: expiresAt,
        resolved_at: resolvedAt,
        metadata: params.metadata ?? {},
        updated_at: params.now,
      },
    }).returning();
    return row ?? null;
  } catch (err) {
    if (isOptionalSchemaError(err, "health_follow_up_lifecycle")) {
      console.warn("[health-prevention] Follow-up lifecycle table unavailable; continuing without persisted lifecycle.");
      return null;
    }
    throw err;
  }
}

function lifecycleMap(rows: FollowUpLifecycleRow[]): Map<string, FollowUpLifecycleRow> {
  return new Map(rows.map((row) => [row.triage_report_id, row]));
}

router.get("/prevention", async (req: Request, res: Response) => {
  const accountUserId = req.user?.id;
  if (!accountUserId) return res.status(401).json({ error: "Not authenticated" });

  const profileId = await requireActiveProfileId(accountUserId, res);
  if (!profileId) return;

  try {
    const loopContext = parseLearningContext(req.query.learning);
    const todayStart = startOfTodayUTC();
    const thirtyDaysAgo = daysAgo(30);

    const [
      profileRows,
      conditionRows,
      activeMedicationRows,
      adherenceRows,
      latestTriageRows,
      latestVitalsRows,
      latestSignalRows,
      latestAnalysisRows,
      safetySignalRows,
    ] = await Promise.all([
      safeRows("profiles", db
        .select({
          data_sharing_consent: profiles.data_sharing_consent,
          known_allergies: profiles.known_allergies,
        })
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1)),
      safeRows("user_health_conditions", db
        .select({ condition: userHealthConditions.condition })
        .from(userHealthConditions)
        .where(and(eq(userHealthConditions.user_id, profileId), eq(userHealthConditions.is_active, true)))
        .limit(50)),
      safeRows("user_medications", db
        .select()
        .from(userMedications)
        .where(and(eq(userMedications.user_id, profileId), eq(userMedications.active, true)))
        .limit(50)),
      safeRows("medication_adherence", db
        .select()
        .from(medicationAdherence)
        .where(and(eq(medicationAdherence.user_id, profileId), gte(medicationAdherence.created_at, thirtyDaysAgo)))
        .limit(200)),
      safeRows("triage_reports", db
        .select()
        .from(triageReports)
        .where(eq(triageReports.user_id, profileId))
        .orderBy(desc(triageReports.created_at))
        .limit(10)),
      safeRows("vitals_readings", db
        .select()
        .from(vitalsReadings)
        .where(eq(vitalsReadings.user_id, profileId))
        .orderBy(desc(vitalsReadings.recorded_at))
        .limit(12)),
      safeRows("vyva_signal_readings", db
        .select()
        .from(vyvaSignalReadings)
        .where(eq(vyvaSignalReadings.user_id, profileId))
        .orderBy(desc(vyvaSignalReadings.recorded_at))
        .limit(12)),
      safeRows("vyva_pattern_windows", db
        .select()
        .from(vyvaPatternWindows)
        .where(eq(vyvaPatternWindows.user_id, profileId))
        .orderBy(desc(vyvaPatternWindows.analysed_at))
        .limit(1)),
      safeRows("medication_safety_signals", db
        .select()
        .from(medicationSafetySignals)
        .where(and(
          eq(medicationSafetySignals.user_id, profileId),
          inArray(medicationSafetySignals.status, ["open", "linked"]),
        ))
        .orderBy(desc(medicationSafetySignals.detected_at))
        .limit(5)),
    ]);

    const profile = profileRows[0] ?? null;
    const consent = objectSection(profile?.data_sharing_consent);
    const conditionsSection = objectSection(consent.conditions);
    const dietSection = objectSection(consent.diet);
    const allergiesSection = objectSection(consent.allergies);
    const profileConditions = arrayOfText(conditionsSection.health_conditions);
    const rowConditions = conditionRows.map((row) => row.condition).filter(Boolean);
    const conditions = Array.from(new Set([...profileConditions, ...rowConditions]));
    const dietaryPreferences = arrayOfText(dietSection.dietary_preferences);
    const dietaryNotes = typeof dietSection.dietary_notes === "string"
      ? dietSection.dietary_notes.trim()
      : typeof dietSection.notes === "string"
        ? dietSection.notes.trim()
        : null;
    const consentAllergies = arrayOfText(allergiesSection.known_allergies);
    const profileAllergies = arrayOfText(profile?.known_allergies);
    const allergies = Array.from(new Set([...profileAllergies, ...consentAllergies]));
    const noKnownAllergies = allergiesSection.no_known_allergies === true;
    const mobilityLevel = typeof conditionsSection.mobility_level === "string" ? conditionsSection.mobility_level : null;
    const livingSituation = typeof conditionsSection.living_situation === "string" ? conditionsSection.living_situation : null;

    const recentVitals = [
      ...latestSignalRows.map(signalReadingToPreventionReading),
      ...latestVitalsRows.map(legacyVitalsToPreventionReading),
    ].sort((a, b) => latestDate(b.recordedAt) - latestDate(a.recordedAt));

    const scheduledToday = activeMedicationRows.reduce((total, med) => total + scheduledDoseCount(med.scheduled_times), 0);
    const takenToday = adherenceRows.filter((row) => row.status === "taken" && row.created_at >= todayStart).length;
    const missedOrLate30 = adherenceRows.filter((row) => ["missed", "skipped", "late"].includes(row.status)).length;
    const now = new Date();
    const dismissedFollowUpIds = new Set(loopContext?.dismissedFollowUpIds ?? []);
    const triageReportIds = latestTriageRows.map((row) => row.id).filter(Boolean);
    const followUpLifecycles = lifecycleMap(await safeLifecycleRows(profileId, triageReportIds));
    for (const report of latestTriageRows) {
      if (dismissedFollowUpIds.has(report.id)) {
        const row = await upsertFollowUpLifecycleStatus({
          profileId,
          report,
          status: "handled",
          now,
          source: "local-dismissal-sync",
          metadata: { reason: "client_dismissed_follow_up" },
        });
        if (row) followUpLifecycles.set(report.id, row);
        continue;
      }
      if (isFollowUpExpired(report.created_at, now)) {
        const existing = followUpLifecycles.get(report.id);
        if (existing?.status !== "handled" && existing?.status !== "expired") {
          const row = await upsertFollowUpLifecycleStatus({
            profileId,
            report,
            status: "expired",
            now,
            source: "auto-expiry",
            metadata: { reason: "follow_up_window_elapsed" },
          });
          if (row) followUpLifecycles.set(report.id, row);
        }
      }
    }
    const activeLatestTriage = latestTriageRows.find((report) =>
      !dismissedFollowUpIds.has(report.id)
      && isFollowUpVisible(followUpLifecycles.get(report.id), report.created_at, now)
    ) ?? null;
    const activeFollowUpLifecycle = activeLatestTriage
      ? await upsertFollowUpLifecycleStatus({
        profileId,
        report: activeLatestTriage,
        status: "active",
        now,
        source: "prevention",
        metadata: { reason: "selected_prevention_follow_up" },
      })
      : null;
    const latestAnalysis = latestAnalysisRows[0] ?? null;

    const focus = buildPreventionFocus({
      conditions,
      dietaryPreferences,
      dietaryNotes,
      allergies,
      noKnownAllergies,
      mobilityLevel,
      livingSituation,
      activeMedications: activeMedicationRows.map((med) => ({
        medicationName: med.medication_name,
        dosage: med.dosage,
        frequency: med.frequency,
        scheduledTimes: med.scheduled_times,
      })),
      adherence: {
        scheduledToday,
        takenToday,
        missedOrLate30,
      },
      latestVitals: recentVitals[0] ?? null,
      recentVitals,
      latestVitalsAnalysis: latestAnalysis
        ? {
          safetyStatus: latestAnalysis.safety_status,
          riskTier: latestAnalysis.risk_tier,
          riskScore: latestAnalysis.risk_score,
          patternLabels: latestAnalysis.pattern_labels ?? [],
          seniorMessage: latestAnalysis.senior_message,
          recommendedAction: latestAnalysis.recommended_action,
          analysedAt: latestAnalysis.analysed_at,
        }
        : null,
      latestSymptomReport: activeLatestTriage
        ? {
          id: activeLatestTriage.id,
          chiefComplaint: activeLatestTriage.chief_complaint,
          urgency: activeLatestTriage.urgency,
          nextStepLabel: activeLatestTriage.next_step_label,
          nextStepLevel: activeLatestTriage.next_step_level,
          watchSigns: activeLatestTriage.watch_signs,
          createdAt: activeLatestTriage.created_at,
        }
        : null,
      medicationSafetySignals: safetySignalRows.map((row) => ({
        signalType: row.signal_type,
        severity: row.severity,
        title: row.title,
        summary: row.summary,
        medicationName: row.medication_name,
        detectedAt: row.detected_at,
      })),
      loopContext,
    });

    if (focus.followUp && activeFollowUpLifecycle) {
      focus.followUp = {
        ...focus.followUp,
        lifecycle: serializeFollowUpLifecycle(activeFollowUpLifecycle),
      };
    }

    return res.json(focus);
  } catch (err) {
    console.error("[health-prevention] GET /api/health/prevention failed", err);
    return res.status(500).json({ error: "Failed to build prevention focus" });
  }
});

router.post("/prevention/follow-ups/:reportId/lifecycle", async (req: Request, res: Response) => {
  const accountUserId = req.user?.id;
  if (!accountUserId) return res.status(401).json({ error: "Not authenticated" });

  const profileId = await requireActiveProfileId(accountUserId, res);
  if (!profileId) return;

  const reportId = String(req.params.reportId ?? "").trim();
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!reportId) return res.status(400).json({ error: "Missing follow-up report id" });
  if (action !== "handled" && action !== "snoozed" && action !== "active") {
    return res.status(400).json({ error: "Invalid follow-up lifecycle action" });
  }

  try {
    const [report] = await safeRows("triage_reports", db
      .select()
      .from(triageReports)
      .where(and(eq(triageReports.id, reportId), eq(triageReports.user_id, profileId)))
      .limit(1));

    if (!report) return res.status(404).json({ error: "Follow-up report not found" });

    const now = new Date();
    if (isFollowUpExpired(report.created_at, now) && action !== "handled") {
      const row = await upsertFollowUpLifecycleStatus({
        profileId,
        report,
        status: "expired",
        now,
        source: "auto-expiry",
        metadata: { reason: "follow_up_window_elapsed" },
      });
      return res.status(409).json({
        error: "Follow-up has expired",
        followUp: serializeFollowUpLifecycle(row),
      });
    }

    const status = action === "active" ? "active" : action as HealthFollowUpLifecycleStatus;
    const snoozeHours = action === "snoozed" ? normalizeSnoozeHours(body.snoozeHours) : undefined;
    const row = await upsertFollowUpLifecycleStatus({
      profileId,
      report,
      status,
      now,
      source: "user-action",
      snoozedUntil: action === "snoozed" ? snoozedUntilFrom(now, snoozeHours) : null,
      metadata: {
        action,
        ...(snoozeHours ? { snoozeHours } : {}),
      },
    });

    if (!row) {
      return res.status(503).json({ error: "Follow-up lifecycle is not available yet" });
    }

    return res.json({ followUp: serializeFollowUpLifecycle(row) });
  } catch (err) {
    console.error("[health-prevention] POST /api/health/prevention/follow-ups/:reportId/lifecycle failed", err);
    return res.status(500).json({ error: "Failed to update follow-up" });
  }
});

export default router;
