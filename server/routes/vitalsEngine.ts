import { Router } from "express";
import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { profiles } from "../../shared/schema.js";

const router = Router();
router.use(requireUser);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ANALYSIS_MODEL = "claude-sonnet-4-20250514";

const readingSchema = z.object({
  signal_type: z.string().min(1).max(80),
  value: z.coerce.number(),
  source: z.string().min(1).max(80).default("manual"),
  context_tag: z.string().min(1).max(80).default("general"),
  recorded_at: z.string().datetime().optional(),
});

type RiskTier = "none" | "watch" | "notify" | "urgent";

interface ClaudeAnalysis {
  risk_score: number;
  risk_tier: RiskTier;
  contributing_signals: Record<string, unknown>;
  pattern_labels: string[];
  senior_message: string | null;
  caregiver_note: string | null;
  recommended_action: string | null;
}

interface SignalReadingRow {
  signal_type: string;
  context_tag: string | null;
  value: string | number;
  recorded_at: Date | string;
  source: string;
  deviation_pct: string | number | null;
}

function queryRows<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return Array.isArray(result) ? result as T[] : [];
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

function normalizeAnalysis(raw: Partial<ClaudeAnalysis>): ClaudeAnalysis {
  const riskScore = Math.max(0, Math.min(100, Math.round(Number(raw.risk_score ?? 0))));
  const riskTier = ["none", "watch", "notify", "urgent"].includes(String(raw.risk_tier))
    ? raw.risk_tier as RiskTier
    : riskScore >= 75
      ? "urgent"
      : riskScore >= 50
        ? "notify"
        : riskScore >= 30
          ? "watch"
          : "none";

  return {
    risk_score: riskScore,
    risk_tier: riskTier,
    contributing_signals:
      raw.contributing_signals && typeof raw.contributing_signals === "object"
        ? raw.contributing_signals
        : {},
    pattern_labels: Array.isArray(raw.pattern_labels) ? raw.pattern_labels.map(String) : [],
    senior_message: typeof raw.senior_message === "string" && raw.senior_message.trim() ? raw.senior_message.trim() : null,
    caregiver_note: typeof raw.caregiver_note === "string" && raw.caregiver_note.trim() ? raw.caregiver_note.trim() : null,
    recommended_action:
      typeof raw.recommended_action === "string" && raw.recommended_action.trim()
        ? raw.recommended_action.trim()
        : null,
  };
}

async function insertPatternWindow(userId: string, analysis: ClaudeAnalysis) {
  const result = await db.execute(sql`
    INSERT INTO vyva_pattern_windows (
      user_id,
      risk_score,
      risk_tier,
      contributing_signals,
      pattern_labels,
      senior_message,
      caregiver_note,
      recommended_action,
      alert_fired
    )
    VALUES (
      ${userId},
      ${analysis.risk_score},
      ${analysis.risk_tier},
      ${JSON.stringify(analysis.contributing_signals)}::jsonb,
      ${analysis.pattern_labels}::text[],
      ${analysis.senior_message},
      ${analysis.caregiver_note},
      ${analysis.recommended_action},
      ${["notify", "urgent"].includes(analysis.risk_tier)}
    )
    RETURNING *
  `);
  return queryRows<Record<string, unknown>>(result)[0] ?? null;
}

router.post("/reading", async (req: Request, res: Response) => {
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const { signal_type, value, source, context_tag, recorded_at } = parsed.data;

  try {
    const baselineResult = await db.execute(sql`
      SELECT baseline_mean
      FROM vyva_user_baselines
      WHERE user_id = ${userId}
        AND signal_type = ${signal_type}
        AND context_tag = ${context_tag}
      LIMIT 1
    `);
    const baseline = queryRows<{ baseline_mean: string | number }>(baselineResult)[0];
    const baselineMean = numberOrNull(baseline?.baseline_mean);
    const deviationPct = baselineMean ? roundOne(((value - baselineMean) / baselineMean) * 100) : null;

    const readingResult = await db.execute(sql`
      INSERT INTO vyva_signal_readings (
        user_id,
        signal_type,
        value,
        recorded_at,
        source,
        context_tag,
        baseline_ref,
        deviation_pct
      )
      VALUES (
        ${userId},
        ${signal_type},
        ${value},
        ${recorded_at ? new Date(recorded_at) : new Date()},
        ${source},
        ${context_tag},
        ${baselineMean},
        ${deviationPct}
      )
      RETURNING *
    `);
    const reading = queryRows<Record<string, unknown>>(readingResult)[0];

    if (deviationPct !== null && Math.abs(deviationPct) > 25) {
      runAnalysis(userId).catch((err) => console.error("[vitals-engine analysis trigger]", err));
    }

    return res.json({ reading, deviation_pct: deviationPct });
  } catch (err) {
    console.error("[vitals-engine reading]", err);
    return res.status(500).json({ error: "Failed to save vitals reading" });
  }
});

router.post("/analyse", async (req: Request, res: Response) => {
  try {
    const analysis = await runAnalysis(req.user!.id);
    return res.json(analysis);
  } catch (err) {
    console.error("[vitals-engine analyse]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to analyse vitals" });
  }
});

router.get("/latest", async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const analysisResult = await db.execute(sql`
      SELECT *
      FROM vyva_pattern_windows
      WHERE user_id = ${userId}
      ORDER BY analysed_at DESC
      LIMIT 1
    `);
    const readingsResult = await db.execute(sql`
      SELECT signal_type, value, recorded_at, source, deviation_pct, context_tag
      FROM vyva_signal_readings
      WHERE user_id = ${userId}
        AND recorded_at >= ${daysAgo(72)}
      ORDER BY recorded_at DESC
    `);

    return res.json({
      analysis: queryRows<Record<string, unknown>>(analysisResult)[0] ?? null,
      recent_readings: queryRows<SignalReadingRow>(readingsResult),
    });
  } catch (err) {
    console.error("[vitals-engine latest]", err);
    return res.status(500).json({ error: "Failed to load vitals intelligence" });
  }
});

router.post("/baseline/update", async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const combosResult = await db.execute(sql`
      SELECT DISTINCT signal_type, context_tag
      FROM vyva_signal_readings
      WHERE user_id = ${userId}
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
        WHERE user_id = ${userId}
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

      await db.execute(sql`
        INSERT INTO vyva_user_baselines (
          user_id,
          signal_type,
          context_tag,
          baseline_mean,
          baseline_stddev,
          sample_count,
          is_established,
          computed_at
        )
        VALUES (
          ${userId},
          ${combo.signal_type},
          ${contextTag},
          ${roundOne(mean)},
          ${roundOne(stddev)},
          ${values.length},
          ${values.length >= 10},
          NOW()
        )
        ON CONFLICT (user_id, signal_type, context_tag)
        DO UPDATE SET
          baseline_mean = EXCLUDED.baseline_mean,
          baseline_stddev = EXCLUDED.baseline_stddev,
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
  const [profile] = await db
    .select({
      full_name: profiles.full_name,
      language_preference: profiles.language_preference,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .orderBy(desc(profiles.created_at))
    .limit(1);

  const [conditionsResult, medicationsResult, readingsResult] = await Promise.all([
    db.execute(sql`
      SELECT condition
      FROM user_health_conditions
      WHERE user_id = ${userId}
        AND is_active = true
    `),
    db.execute(sql`
      SELECT name, dosage
      FROM medications
      WHERE user_id = ${userId}
        AND is_active = true
    `),
    db.execute(sql`
      SELECT signal_type, context_tag, value, recorded_at, source, deviation_pct
      FROM vyva_signal_readings
      WHERE user_id = ${userId}
        AND quality_flag = 'clean'
        AND recorded_at >= ${daysAgo(72)}
      ORDER BY recorded_at DESC
    `),
  ]);

  const conditions = queryRows<{ condition: string }>(conditionsResult).map((row) => row.condition);
  const medications = queryRows<{ name: string; dosage: string | null }>(medicationsResult)
    .map((med) => med.dosage ? `${med.name} ${med.dosage}` : med.name);
  const readings = queryRows<SignalReadingRow>(readingsResult);

  if (readings.length === 0) {
    const emptyAnalysis = normalizeAnalysis({ risk_score: 0, risk_tier: "none", senior_message: null });
    const stored = await insertPatternWindow(userId, emptyAnalysis);
    return { ...emptyAnalysis, id: stored?.id ?? null };
  }

  const signalMap = new Map<string, SignalReadingRow[]>();
  for (const reading of readings) {
    const key = `${reading.signal_type}|${reading.context_tag ?? "general"}`;
    signalMap.set(key, [...(signalMap.get(key) ?? []), reading]);
  }

  const signalSummary = [...signalMap.entries()]
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

  const analysis = await callClaude({
    name: profile?.full_name || "usted",
    conditions,
    medications,
    language: profile?.language_preference || "es",
    signalSummary,
  });
  const stored = await insertPatternWindow(userId, analysis);
  return { ...analysis, id: stored?.id ?? null };
}

async function callClaude(input: {
  name: string;
  conditions: string[];
  medications: string[];
  language: string;
  signalSummary: unknown[];
}): Promise<ClaudeAnalysis> {
  if (input.signalSummary.length < 3) {
    return normalizeAnalysis({ risk_score: 0, risk_tier: "none", senior_message: null });
  }

  const system = `You are VYVA's health intelligence analyst for seniors.

Identify whether a 72-hour vitals signal window suggests an emerging concern in the next 12-72 hours.
Return only valid JSON with these keys:
risk_score, risk_tier, contributing_signals, pattern_labels, senior_message, caregiver_note, recommended_action.

Rules:
- A trend across related signals matters more than one high reading.
- Risk score 0-29 none, 30-49 watch, 50-74 notify, 75+ urgent.
- senior_message must be warm, in the user's language, max 35 words, and avoid alarming medical jargon.
- caregiver_note may be clinical and concise.
- If data is insufficient, return risk_score 0 and risk_tier none.`;

  const payload = {
    user: {
      name: input.name,
      conditions: input.conditions,
      medications: input.medications,
      language: input.language,
    },
    signal_window_hours: 72,
    signals: input.signalSummary,
  };

  const response = await anthropic.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: JSON.stringify(payload, null, 2) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  if (!text) return normalizeAnalysis({ risk_score: 0, risk_tier: "none", senior_message: null });

  try {
    return normalizeAnalysis(JSON.parse(text) as Partial<ClaudeAnalysis>);
  } catch {
    console.error("[vitals-engine claude parse]", text);
    return normalizeAnalysis({ risk_score: 0, risk_tier: "none", senior_message: null });
  }
}

export default router;
