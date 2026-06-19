import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq, gte, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { vitalsReadings, vyvaSignalReadings } from "../../shared/schema.js";
import {
  VITALS_READING_SOURCES,
  normalizeVitalsSource,
  vitalsEvidenceFor,
  type VitalsReadingSource,
} from "../../shared/vitalsEvidence.js";
import { unitForSignal, type VitalsSignalKey } from "../../shared/vitalsSignalCatalog.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

const METRIC_TYPES = ["hr", "rr", "bp"] as const;
export type MetricType = typeof METRIC_TYPES[number];
type ReadingSource = VitalsReadingSource;
export type MetricReading = {
  value: string;
  recorded_at: Date;
  source: ReadingSource;
  signal_type?: string | null;
};
export type VitalsSummaryEntry = {
  latest_value: string | null;
  latest_recorded_at: string | null;
  latest_source: ReadingSource | null;
  latest_source_confidence: "low" | "medium" | "high" | null;
  latest_source_confidence_reason: string | null;
  latest_source_display_label: string | null;
  latest_source_context_label: string | null;
  trend: (string | null)[];
  has_data: boolean;
};
export type VitalsSummaryByMetric = Record<MetricType, MetricReading[]>;
type EngineSummaryRow = Pick<typeof vyvaSignalReadings.$inferSelect, "signal_type" | "value" | "recorded_at" | "source">;

const postBodySchema = z.object({
  metric_type: z.enum(METRIC_TYPES),
  value: z.string().min(1).max(20),
  source: z.enum(VITALS_READING_SOURCES).default("manual_entry"),
});

const ENGINE_SIGNAL_BY_METRIC: Record<MetricType, string> = {
  hr: "resting_hr_bpm",
  rr: "respiratory_rate",
  bp: "bp_systolic",
};
const SUMMARY_ENGINE_SIGNAL_TYPES = ["resting_hr_bpm", "respiratory_rate", "bp_systolic", "bp_diastolic"] as const;

function numericMetricValue(metricType: MetricType, value: string): number | null {
  const raw = metricType === "bp" ? value.split("/")[0] : value;
  const parsed = Number.parseFloat(raw.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfDayUTC(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
}

function dateStringUTC(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function sourceForRow(row: typeof vitalsReadings.$inferSelect): ReadingSource {
  if (row.metric_type && row.value) return "manual_entry";
  if (row.bpm != null || row.respiratory_rate != null) return "phone_estimate";
  return "manual_entry";
}

function rowToMetricEntries(row: typeof vitalsReadings.$inferSelect): Array<{ metric: MetricType } & MetricReading> {
  const source = sourceForRow(row);
  if (row.metric_type && row.value) {
    const mt = row.metric_type as MetricType;
    if (METRIC_TYPES.includes(mt)) {
      return [{ metric: mt, value: row.value, recorded_at: row.recorded_at, source, signal_type: ENGINE_SIGNAL_BY_METRIC[mt] }];
    }
  }
  const entries: Array<{ metric: MetricType } & MetricReading> = [];
  if (row.bpm != null) entries.push({ metric: "hr", value: String(row.bpm), recorded_at: row.recorded_at, source, signal_type: "resting_hr_bpm" });
  if (row.respiratory_rate != null) entries.push({ metric: "rr", value: String(row.respiratory_rate), recorded_at: row.recorded_at, source, signal_type: "respiratory_rate" });
  return entries;
}

function engineValue(value: string | number): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(1)));
}

function engineSource(source: string | null | undefined): ReadingSource {
  return normalizeVitalsSource(source);
}

export function engineRowsToMetricEntries(rows: EngineSummaryRow[]): Array<{ metric: MetricType } & MetricReading> {
  const entries: Array<{ metric: MetricType } & MetricReading> = [];

  for (const row of rows) {
    if (row.signal_type === "resting_hr_bpm") {
      entries.push({
        metric: "hr",
        value: engineValue(row.value),
        recorded_at: row.recorded_at,
        source: engineSource(row.source),
        signal_type: row.signal_type,
      });
    }
    if (row.signal_type === "respiratory_rate") {
      entries.push({
        metric: "rr",
        value: engineValue(row.value),
        recorded_at: row.recorded_at,
        source: engineSource(row.source),
        signal_type: row.signal_type,
      });
    }
  }

  const diastolicRows = rows.filter((row) => row.signal_type === "bp_diastolic");
  for (const systolic of rows.filter((row) => row.signal_type === "bp_systolic")) {
    const systolicTime = systolic.recorded_at.getTime();
    const matchingDiastolic = diastolicRows.find((row) => Math.abs(row.recorded_at.getTime() - systolicTime) <= 5 * 60 * 1000);
    entries.push({
      metric: "bp",
      value: matchingDiastolic ? `${engineValue(systolic.value)}/${engineValue(matchingDiastolic.value)}` : engineValue(systolic.value),
      recorded_at: systolic.recorded_at,
      source: engineSource(systolic.source),
      signal_type: systolic.signal_type,
    });
  }

  return entries;
}

export function buildVitalsSummary(byMetric: VitalsSummaryByMetric): {
  summary: Record<string, VitalsSummaryEntry>;
  compliance_days: boolean[];
} {
  for (const metric of METRIC_TYPES) {
    byMetric[metric].sort((a, b) => b.recorded_at.getTime() - a.recorded_at.getTime());
  }

  const summary: Record<string, VitalsSummaryEntry> = {};

  for (const metric of METRIC_TYPES) {
    const readings = byMetric[metric];
    const latest = readings[0] ?? null;
    const evidence = latest ? vitalsEvidenceFor(latest.source, latest.signal_type ?? ENGINE_SIGNAL_BY_METRIC[metric]) : null;

    const dayMap: Record<string, string> = {};
    for (const r of readings) {
      const dayKey = r.recorded_at.toISOString().slice(0, 10);
      if (!dayMap[dayKey]) dayMap[dayKey] = r.value;
    }

    const trend: (string | null)[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = dateStringUTC(i);
      trend.push(dayMap[day] ?? null);
    }

    summary[metric] = {
      latest_value: latest?.value ?? null,
      latest_recorded_at: latest?.recorded_at.toISOString() ?? null,
      latest_source: latest?.source ?? null,
      latest_source_confidence: evidence?.confidence ?? null,
      latest_source_confidence_reason: evidence?.reason ?? null,
      latest_source_display_label: evidence?.displayLabel ?? null,
      latest_source_context_label: evidence?.contextLabel ?? null,
      trend,
      has_data: readings.length > 0,
    };
  }

  const complianceDays: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = dateStringUTC(i);
    const hasReading = METRIC_TYPES.some(
      (m) => byMetric[m].some((r) => r.recorded_at.toISOString().slice(0, 10) === day),
    );
    complianceDays.push(hasReading);
  }

  return { summary, compliance_days: complianceDays };
}

async function mirrorToVitalsEngine(userId: string, metricType: MetricType, value: string, source: ReadingSource) {
  const numeric = numericMetricValue(metricType, value);
  if (numeric == null) return;
  const signalType = ENGINE_SIGNAL_BY_METRIC[metricType] as VitalsSignalKey;

  await db.execute(sql`
    INSERT INTO vyva_signal_readings (
      user_id,
      signal_type,
      value,
      source,
      capture_method,
      unit,
      context_tag
    )
    VALUES (
      ${userId},
      ${signalType},
      ${numeric},
      ${source},
      ${source === "phone_estimate" ? "phone_camera" : "manual"},
      ${unitForSignal(signalType)},
      'general'
    )
  `);

  if (metricType === "bp" && value.includes("/")) {
    const diastolic = Number.parseFloat(value.split("/")[1]?.trim() ?? "");
    if (Number.isFinite(diastolic)) {
      await db.execute(sql`
        INSERT INTO vyva_signal_readings (
          user_id,
          signal_type,
          value,
          source,
          capture_method,
          unit,
          context_tag
        )
        VALUES (
          ${userId},
          'bp_diastolic',
          ${diastolic},
          ${source},
          'manual',
          ${unitForSignal("bp_diastolic")},
          'general'
        )
      `);
    }
  }
}

router.get("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const sevenDaysAgo = startOfDayUTC(6);

  try {
    const rows = await db
      .select()
      .from(vitalsReadings)
      .where(
        and(
          eq(vitalsReadings.user_id, userId),
          gte(vitalsReadings.recorded_at, sevenDaysAgo),
        ),
      )
      .orderBy(desc(vitalsReadings.recorded_at));

    const byMetric: Record<MetricType, MetricReading[]> = {
      hr: [], rr: [], bp: [],
    };

    for (const row of rows) {
      for (const { metric, ...reading } of rowToMetricEntries(row)) {
        byMetric[metric].push(reading);
      }
    }

    try {
      const signalRows = await db
        .select()
        .from(vyvaSignalReadings)
        .where(
          and(
            eq(vyvaSignalReadings.user_id, userId),
            gte(vyvaSignalReadings.recorded_at, sevenDaysAgo),
            inArray(vyvaSignalReadings.signal_type, [...SUMMARY_ENGINE_SIGNAL_TYPES]),
          ),
        )
        .orderBy(desc(vyvaSignalReadings.recorded_at));

      for (const { metric, ...reading } of engineRowsToMetricEntries(signalRows)) {
        byMetric[metric].push(reading);
      }
    } catch (signalErr) {
      console.warn("[vitals GET signal readings]", signalErr);
    }

    const { summary, compliance_days: complianceDays } = buildVitalsSummary(byMetric);

    return res.json({ summary, compliance_days: complianceDays });
  } catch (err) {
    console.error("[vitals GET]", err);
    return res.status(500).json({ error: "Failed to fetch vitals readings" });
  }
});

router.post("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const parsed = postBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { metric_type, value, source } = parsed.data;

  try {
    const [entry] = await db
      .insert(vitalsReadings)
      .values({ user_id: userId, metric_type, value })
      .returning();

    mirrorToVitalsEngine(userId, metric_type, value, source).catch((mirrorErr) => {
      console.error("[vitals POST mirror]", mirrorErr);
    });

    return res.status(201).json(entry);
  } catch (err) {
    console.error("[vitals POST]", err);
    return res.status(500).json({ error: "Failed to save vitals reading" });
  }
});

export default router;
