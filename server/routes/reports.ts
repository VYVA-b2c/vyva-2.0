import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db } from "../db.js";
import { caregiverAlerts, profiles, triageReports, vitalsReadings, medicationAdherence, userMedications } from "../../shared/schema.js";
import { z } from "zod";

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";
const READING_SOURCES = ["phone_estimate", "manual_entry", "connected_device", "clinical"] as const;
type ReadingSource = typeof READING_SOURCES[number];

type SignalReadingRow = {
  signal_type: string;
  value: string | number;
  recorded_at: Date | string;
  source: ReadingSource | string;
  context_tag: string | null;
};

function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

const router = Router();

function queryRows<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return Array.isArray(result) ? result as T[] : [];
}

// ─── Storage helpers ───────────────────────────────────────────────────────────

async function saveTriageReport(params: {
  userId: string;
  chief_complaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  ai_summary?: string | null;
  next_step_label?: string | null;
  next_step_level?: string | null;
  triage_reasons?: string[];
  watch_signs?: string[];
  profile_considerations?: string[];
  vitals_notes?: string[];
  bpm?: number | null;
  respiratory_rate?: number | null;
  duration_seconds?: number | null;
}) {
  const [row] = await db.insert(triageReports).values({
    user_id: params.userId,
    chief_complaint: params.chief_complaint,
    symptoms: params.symptoms,
    urgency: params.urgency,
    recommendations: params.recommendations,
    disclaimer: params.disclaimer,
    ai_summary: params.ai_summary ?? null,
    next_step_label: params.next_step_label ?? null,
    next_step_level: params.next_step_level ?? null,
    triage_reasons: params.triage_reasons ?? [],
    watch_signs: params.watch_signs ?? [],
    profile_considerations: params.profile_considerations ?? [],
    vitals_notes: params.vitals_notes ?? [],
    bpm: params.bpm ?? null,
    respiratory_rate: params.respiratory_rate ?? null,
    duration_seconds: params.duration_seconds ?? null,
  }).returning();
  return row;
}

async function recordTriageReportHandoff(params: {
  userId: string;
  chief_complaint: string;
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
}) {
  const [profile] = await db
    .select({
      caregiver_name: profiles.caregiver_name,
      caregiver_contact: profiles.caregiver_contact,
      gp_name: profiles.gp_name,
      gp_phone: profiles.gp_phone,
    })
    .from(profiles)
    .where(eq(profiles.id, params.userId))
    .limit(1);

  const sentTo = [
    profile?.gp_name || profile?.gp_phone ? profile.gp_name || "doctor" : "",
    profile?.caregiver_name || profile?.caregiver_contact ? profile.caregiver_name || "caregiver" : "",
  ].filter(Boolean);

  if (sentTo.length === 0) return sentTo;

  await db.insert(caregiverAlerts).values({
    user_id: params.userId,
    alert_type: "triage_report",
    severity: params.urgency,
    message: [
      `Symptom report: ${params.chief_complaint}`,
      params.recommendations.length ? `Next: ${params.recommendations[0]}` : "",
    ].filter(Boolean).join("\n"),
    sent_to: sentTo,
  });

  return sentTo;
}

async function saveVitalsReading(params: {
  userId: string;
  bpm: number;
  respiratory_rate?: number | null;
  source?: ReadingSource;
}) {
  const [row] = await db.insert(vitalsReadings).values({
    user_id: params.userId,
    bpm: params.bpm,
    respiratory_rate: params.respiratory_rate ?? null,
  }).returning();

  mirrorVitalsScanToEngine({
    userId: params.userId,
    bpm: params.bpm,
    respiratoryRate: params.respiratory_rate ?? null,
    source: params.source ?? "phone_estimate",
  }).catch((err) => console.error("[reports/vitals mirror]", err));

  return row;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function mirrorVitalsScanToEngine(params: {
  userId: string;
  bpm: number;
  respiratoryRate?: number | null;
  source: ReadingSource;
}) {
  if (!looksLikeUuid(params.userId)) return;

  const entries = [
    { signalType: "resting_hr_bpm", value: params.bpm },
    ...(params.respiratoryRate != null ? [{ signalType: "respiratory_rate", value: params.respiratoryRate }] : []),
  ];

  for (const entry of entries) {
    await db.execute(sql`
      INSERT INTO vyva_signal_readings (
        user_id,
        signal_type,
        value,
        source,
        context_tag
      )
      VALUES (
        ${params.userId},
        ${entry.signalType},
        ${entry.value},
        ${params.source},
        'camera_scan'
      )
    `);
  }
}

async function getLatestTriageReport(userId: string) {
  const rows = await db.select().from(triageReports)
    .where(eq(triageReports.user_id, userId))
    .orderBy(desc(triageReports.created_at))
    .limit(1);
  return rows[0] ?? null;
}

async function getLatestVitalsReading(userId: string) {
  const rows = await db.select().from(vitalsReadings)
    .where(eq(vitalsReadings.user_id, userId))
    .orderBy(desc(vitalsReadings.recorded_at))
    .limit(1);
  return rows[0] ?? null;
}

async function getLatestSignalReadings(userId: string): Promise<SignalReadingRow[]> {
  if (!looksLikeUuid(userId)) return [];
  const result = await db.execute(sql`
    SELECT signal_type, value, recorded_at, source, context_tag
    FROM (
      SELECT
        signal_type,
        value,
        recorded_at,
        source,
        context_tag,
        row_number() OVER (PARTITION BY signal_type ORDER BY recorded_at DESC) AS rn
      FROM vyva_signal_readings
      WHERE user_id = ${userId}
    ) ranked
    WHERE rn = 1
    ORDER BY recorded_at DESC
    LIMIT 12
  `);
  return queryRows<SignalReadingRow>(result);
}

async function getSignalHistory(userId: string, days = 30): Promise<SignalReadingRow[]> {
  if (!looksLikeUuid(userId)) return [];
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const result = await db.execute(sql`
    SELECT signal_type, value, recorded_at, source, context_tag
    FROM vyva_signal_readings
    WHERE user_id = ${userId}
      AND recorded_at >= ${cutoff}
    ORDER BY recorded_at ASC
    LIMIT 120
  `);
  return queryRows<SignalReadingRow>(result);
}

async function getVitalsHistory(userId: string, days = 30) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return db.select().from(vitalsReadings)
    .where(and(
      eq(vitalsReadings.user_id, userId),
      gte(vitalsReadings.recorded_at, cutoff),
    ))
    .orderBy(vitalsReadings.recorded_at)
    .limit(50);
}

async function getTodayMedSummary(userId: string) {
  const todayStart = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const [todayLogs, activeMeds] = await Promise.all([
    db.select().from(medicationAdherence)
      .where(and(
        eq(medicationAdherence.user_id, userId),
        gte(medicationAdherence.created_at, todayStart),
      )),
    db.select().from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
  ]);
  const taken = todayLogs.filter(l => l.status === "taken").length;
  const total = activeMeds.length;
  const adherencePct = total > 0 ? Math.round((taken / total) * 100) : null;
  return { taken, total, adherencePct };
}

// ─── POST /triage ─────────────────────────────────────────────────────────────
const triageSchema = z.object({
  chief_complaint:   z.string(),
  symptoms:          z.array(z.string()).default([]),
  urgency:           z.enum(["urgent", "routine", "monitor"]),
  recommendations:   z.array(z.string()).default([]),
  disclaimer:        z.string().default(""),
  ai_summary:        z.string().nullable().optional(),
  next_step_label:   z.string().nullable().optional(),
  next_step_level:   z.enum(["emergency", "doctor_today", "doctor_24_48", "monitor"]).nullable().optional(),
  triage_reasons:    z.array(z.string()).default([]),
  watch_signs:       z.array(z.string()).default([]),
  profile_considerations: z.array(z.string()).default([]),
  vitals_notes:      z.array(z.string()).default([]),
  bpm:               z.number().int().nullable().optional(),
  respiratory_rate:  z.number().int().nullable().optional(),
  duration_seconds:  z.number().int().nonnegative().nullable().optional(),
});

router.post("/triage", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = triageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }
  try {
    const row = await saveTriageReport({ userId, ...parsed.data });
    const sentTo = await recordTriageReportHandoff({
      userId,
      chief_complaint: parsed.data.chief_complaint,
      urgency: parsed.data.urgency,
      recommendations: parsed.data.recommendations,
    }).catch((err) => {
      console.error("[reports/triage handoff]", err);
      return [];
    });
    return res.status(201).json({ ...row, sent_to: sentTo });
  } catch (err) {
    console.error("[reports/triage POST]", err);
    return res.status(500).json({ error: "Failed to save triage report" });
  }
});

// ─── POST /vitals ─────────────────────────────────────────────────────────────
const vitalsSchema = z.object({
  bpm:              z.number().int().min(30).max(250),
  respiratory_rate: z.number().int().min(6).max(60).nullable().optional(),
  source:           z.enum(READING_SOURCES).default("phone_estimate"),
});

router.post("/vitals", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = vitalsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }
  try {
    const row = await saveVitalsReading({ userId, ...parsed.data });
    return res.status(201).json(row);
  } catch (err) {
    console.error("[reports/vitals POST]", err);
    return res.status(500).json({ error: "Failed to save vitals reading" });
  }
});

// ─── GET /summary ─────────────────────────────────────────────────────────────
router.get("/summary", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    const [latestTriage, latestVitals, todayMeds] = await Promise.all([
      getLatestTriageReport(userId),
      getLatestVitalsReading(userId),
      getTodayMedSummary(userId),
    ]);
    const latestSignals = await getLatestSignalReadings(userId).catch((err) => {
      console.warn("[reports/summary signals]", err);
      return [];
    });
    return res.json({ latestTriage, latestVitals, latestSignals, todayMeds });
  } catch (err) {
    console.error("[reports/summary GET]", err);
    return res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// ─── GET /vitals/history ─────────────────────────────────────────────────────
router.get("/vitals/history", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    const [readings, signalReadings] = await Promise.all([
      getVitalsHistory(userId, 30),
      getSignalHistory(userId, 30).catch((err) => {
        console.warn("[reports/vitals/history signals]", err);
        return [];
      }),
    ]);
    return res.json({ readings, signalReadings });
  } catch (err) {
    console.error("[reports/vitals/history GET]", err);
    return res.status(500).json({ error: "Failed to fetch vitals history" });
  }
});

// ─── GET /triage/:id ─────────────────────────────────────────────────────────
router.get("/triage/:id", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.params;
  try {
    const [row] = await db.select().from(triageReports)
      .where(and(eq(triageReports.id, id), eq(triageReports.user_id, userId)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    console.error("[reports/triage/:id GET]", err);
    return res.status(500).json({ error: "Failed to fetch report" });
  }
});

export default router;
