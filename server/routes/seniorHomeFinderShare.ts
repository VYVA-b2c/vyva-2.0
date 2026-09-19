import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";

let shareTablePromise: Promise<void> | null = null;

// Mirrors checkin_report_shares in server/routes/checkins.ts: a token-based,
// expiring, jsonb-payload share link — replicated here rather than shared,
// since the two report shapes are unrelated.
async function ensureSeniorHomeFinderShareTable() {
  if (!shareTablePromise) {
    shareTablePromise = pool.query(`
      create table if not exists senior_home_finder_report_shares (
        token text primary key,
        user_id text not null,
        language text not null default 'en',
        profile_name text,
        report_payload jsonb not null,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null default (now() + interval '30 days')
      )
    `).then(() => undefined);
  }
  return shareTablePromise;
}

const shareBodySchema = z.object({
  language: z.string().max(12).optional().default("en"),
  name: z.string().max(120).optional().default(""),
  summary: z.string().trim().min(1).max(6000),
});

type SeniorHomeFinderReportPayload = {
  name: string;
  language: string;
  summary: string;
};

function resolveUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

// Only created when the user explicitly asks to share their Senior Home
// Finder shortlist — never generated automatically from a conversation.
export async function createSeniorHomeFinderShareHandler(req: Request, res: Response) {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = shareBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A summary to share is required." });

  const token = randomUUID();
  const { name, language, summary } = parsed.data;
  const payload: SeniorHomeFinderReportPayload = { name, language, summary };

  try {
    await ensureSeniorHomeFinderShareTable();
    await pool.query(
      `insert into senior_home_finder_report_shares (token, user_id, language, profile_name, report_payload)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [token, userId, language, name || null, JSON.stringify(payload)],
    );
    return res.json({ token });
  } catch (err) {
    console.error("[senior-home-finder] share link creation failed:", err);
    return res.status(500).json({ error: "Failed to create share link" });
  }
}

export async function sharedSeniorHomeFinderReportHandler(req: Request, res: Response) {
  const token = String(req.params.token ?? "");
  if (!token || token.length > 80) {
    return res.status(404).json({ error: "Report not found" });
  }

  try {
    await ensureSeniorHomeFinderShareTable();
    const result = await pool.query(
      `select report_payload, created_at, expires_at
       from senior_home_finder_report_shares
       where token = $1 and expires_at > now()
       limit 1`,
      [token],
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.json({
      report: row.report_payload,
      created_at: row.created_at,
      expires_at: row.expires_at,
    });
  } catch (err) {
    console.error("[senior-home-finder] shared report failed:", err);
    return res.status(500).json({ error: "Failed to load shared report" });
  }
}
