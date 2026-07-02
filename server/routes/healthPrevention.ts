import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { isRelationSchemaUnavailableError } from "../lib/dbCompatibility.js";
import { requireActiveProfileId } from "../lib/profileAccess.js";
import { buildPreventionFocus, type PreventionLoopContext, type PreventionVitalReading } from "../lib/preventionFocus.js";
import {
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
    return {
      ...(clientHour != null ? { clientHour } : {}),
      ...(recentFeedback?.length ? { recentFeedback } : {}),
    };
  } catch {
    return undefined;
  }
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
        .limit(1)),
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
    const latestTriage = latestTriageRows[0] ?? null;
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
      latestSymptomReport: latestTriage
        ? {
          id: latestTriage.id,
          chiefComplaint: latestTriage.chief_complaint,
          urgency: latestTriage.urgency,
          nextStepLabel: latestTriage.next_step_label,
          nextStepLevel: latestTriage.next_step_level,
          watchSigns: latestTriage.watch_signs,
          createdAt: latestTriage.created_at,
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

    return res.json(focus);
  } catch (err) {
    console.error("[health-prevention] GET /api/health/prevention failed", err);
    return res.status(500).json({ error: "Failed to build prevention focus" });
  }
});

export default router;
