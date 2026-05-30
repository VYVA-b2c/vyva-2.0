import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import { db, pool } from "../db.js";
import { caregiverAlerts, profiles, triageReports, vitalsReadings, medicationAdherence, userMedications } from "../../shared/schema.js";
import { z } from "zod";

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";

function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

const router = Router();

// ─── Storage helpers ───────────────────────────────────────────────────────────

let reportsPersistencePromise: Promise<void> | null = null;

async function ensureReportsPersistenceTables() {
  if (!reportsPersistencePromise) {
    reportsPersistencePromise = (async () => {
      await pool.query(`
        create table if not exists triage_reports (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          chief_complaint text not null,
          symptoms text[] not null default '{}',
          urgency text not null,
          recommendations text[] not null default '{}',
          disclaimer text not null default '',
          ai_summary text,
          next_step_label text,
          next_step_level text,
          triage_reasons text[] not null default '{}',
          watch_signs text[] not null default '{}',
          profile_considerations text[] not null default '{}',
          vitals_notes text[] not null default '{}',
          bpm integer,
          respiratory_rate integer,
          duration_seconds integer,
          created_at timestamptz not null default now()
        )
      `);

      await pool.query(`
        alter table triage_reports
          add column if not exists symptoms text[] not null default '{}',
          add column if not exists recommendations text[] not null default '{}',
          add column if not exists disclaimer text not null default '',
          add column if not exists ai_summary text,
          add column if not exists next_step_label text,
          add column if not exists next_step_level text,
          add column if not exists triage_reasons text[] not null default '{}',
          add column if not exists watch_signs text[] not null default '{}',
          add column if not exists profile_considerations text[] not null default '{}',
          add column if not exists vitals_notes text[] not null default '{}',
          add column if not exists bpm integer,
          add column if not exists respiratory_rate integer,
          add column if not exists duration_seconds integer,
          add column if not exists created_at timestamptz not null default now()
      `);

      await pool.query(`
        create table if not exists vitals_readings (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          bpm integer,
          respiratory_rate integer,
          metric_type text,
          value text,
          recorded_at timestamptz not null default now()
        )
      `);

      await pool.query(`
        alter table vitals_readings
          add column if not exists bpm integer,
          add column if not exists respiratory_rate integer,
          add column if not exists metric_type text,
          add column if not exists value text,
          add column if not exists recorded_at timestamptz not null default now()
      `);

      await pool.query(`create index if not exists triage_reports_user_id_idx on triage_reports (user_id)`);
      await pool.query(`create index if not exists vitals_readings_user_id_idx on vitals_readings (user_id)`);
    })().catch((err) => {
      reportsPersistencePromise = null;
      throw err;
    });
  }

  return reportsPersistencePromise;
}

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
  await ensureReportsPersistenceTables();
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
}) {
  await ensureReportsPersistenceTables();
  const [row] = await db.insert(vitalsReadings).values({
    user_id: params.userId,
    bpm: params.bpm,
    respiratory_rate: params.respiratory_rate ?? null,
  }).returning();
  return row;
}

async function getLatestTriageReport(userId: string) {
  await ensureReportsPersistenceTables();
  const rows = await db.select().from(triageReports)
    .where(eq(triageReports.user_id, userId))
    .orderBy(desc(triageReports.created_at))
    .limit(1);
  return rows[0] ?? null;
}

async function getLatestVitalsReading(userId: string) {
  await ensureReportsPersistenceTables();
  const rows = await db.select().from(vitalsReadings)
    .where(eq(vitalsReadings.user_id, userId))
    .orderBy(desc(vitalsReadings.recorded_at))
    .limit(1);
  return rows[0] ?? null;
}

async function getVitalsHistory(userId: string, days = 30) {
  await ensureReportsPersistenceTables();
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

type TodayMedSummary = Awaited<ReturnType<typeof getTodayMedSummary>>;

const emptyTodayMedSummary: TodayMedSummary = { taken: 0, total: 0, adherencePct: null };

type ReportsSummaryLoaders = {
  latestTriage: (userId: string) => Promise<Awaited<ReturnType<typeof getLatestTriageReport>>>;
  latestVitals: (userId: string) => Promise<Awaited<ReturnType<typeof getLatestVitalsReading>>>;
  todayMeds: (userId: string) => Promise<Awaited<ReturnType<typeof getTodayMedSummary>>>;
};

const defaultReportsSummaryLoaders: ReportsSummaryLoaders = {
  latestTriage: getLatestTriageReport,
  latestVitals: getLatestVitalsReading,
  todayMeds: getTodayMedSummary,
};

async function safeReportPart<T>(label: string, fallback: T, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    console.warn(`[reports] ${label} unavailable`, err);
    return fallback;
  }
}

export async function loadReportsSummary(userId: string, loaders: ReportsSummaryLoaders = defaultReportsSummaryLoaders) {
  const [latestTriage, latestVitals, todayMeds] = await Promise.all([
    safeReportPart("latest triage", null, () => loaders.latestTriage(userId)),
    safeReportPart("latest vitals", null, () => loaders.latestVitals(userId)),
    safeReportPart("today medication summary", emptyTodayMedSummary, () => loaders.todayMeds(userId)),
  ]);

  return { latestTriage, latestVitals, todayMeds };
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
    return res.json(await loadReportsSummary(userId));
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
    const readings = await getVitalsHistory(userId, 30);
    return res.json({ readings });
  } catch (err) {
    console.warn("[reports/vitals/history GET] unavailable", err);
    return res.json({ readings: [] });
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
