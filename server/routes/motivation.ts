import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { loadBrainCoachProgressForUser } from "./games.js";
import {
  buildMotivationMilestoneCandidates,
  parseMotivationMilestoneId,
  prioritizeMotivationMilestones,
} from "../lib/motivationMilestones.js";

const router = Router();

const acknowledgeBodySchema = z.object({
  achieved_value: z.number().int().min(0).optional(),
  source_ref: z.record(z.unknown()).optional(),
});

let motivationTablesPromise: Promise<void> | null = null;

async function ensureMotivationTables() {
  if (!motivationTablesPromise) {
    motivationTablesPromise = pool.query(`
      create table if not exists user_milestone_acknowledgements (
        user_id text not null,
        domain text not null,
        metric text not null,
        threshold integer not null,
        achieved_value integer not null,
        acknowledged_at timestamptz not null default now(),
        source_ref jsonb not null default '{}'::jsonb,
        primary key (user_id, domain, metric, threshold)
      );

      create index if not exists user_milestone_acknowledgements_user_idx
        on user_milestone_acknowledgements (user_id, acknowledged_at desc);
    `).then(() => undefined);
  }
  return motivationTablesPromise;
}

async function resolveActiveProfileId(accountUserId: string): Promise<string> {
  try {
    const context = await getActiveProfileContext(accountUserId);
    return context.profileId ?? accountUserId;
  } catch (error) {
    console.warn("[motivation] active profile resolution failed; using account id:", error);
    return accountUserId;
  }
}

async function loadDailyCheckinTrend(profileId: string) {
  try {
    const result = await pool.query(
      `select streak_days, best_streak, total_checkins
       from checkin_trend_state
       where user_id = $1
       limit 1`,
      [profileId],
    );
    const row = result.rows[0] as {
      streak_days?: number | string | null;
      best_streak?: number | string | null;
      total_checkins?: number | string | null;
    } | undefined;
    return {
      streak_days: Number(row?.streak_days ?? 0) || 0,
      best_streak: Number(row?.best_streak ?? 0) || 0,
      total_checkins: Number(row?.total_checkins ?? 0) || 0,
    };
  } catch (error) {
    console.warn("[motivation] check-in trend could not be loaded:", error);
    return { streak_days: 0, best_streak: 0, total_checkins: 0 };
  }
}

async function loadBrainCoachMilestoneProgress(accountUserId: string) {
  try {
    return await loadBrainCoachProgressForUser(accountUserId);
  } catch (error) {
    console.warn("[motivation] Brain Coach progress could not be loaded:", error);
    return {
      summary: {
        streakDays: 0,
        totalSessions: 0,
        completedSessions: 0,
        lastPlayedAt: null,
      },
    };
  }
}

async function loadAcknowledgedKeys(accountUserId: string) {
  const result = await pool.query(
    `select domain, metric, threshold
     from user_milestone_acknowledgements
     where user_id = $1`,
    [accountUserId],
  );
  return new Set(
    result.rows.map((row: { domain: string; metric: string; threshold: number | string }) => (
      `${row.domain}:${row.metric}:${Number(row.threshold)}`
    )),
  );
}

export async function pendingMotivationMilestonesHandler(req: Request, res: Response) {
  try {
    await ensureMotivationTables();

    const accountUserId = req.user!.id;
    const profileId = await resolveActiveProfileId(accountUserId);
    const [checkinTrend, brainCoachProgress, acknowledged] = await Promise.all([
      loadDailyCheckinTrend(profileId),
      loadBrainCoachMilestoneProgress(accountUserId),
      loadAcknowledgedKeys(accountUserId),
    ]);

    const candidates = prioritizeMotivationMilestones([
      ...buildMotivationMilestoneCandidates({
        domain: "daily_checkin",
        achievedValue: checkinTrend.streak_days,
        sourceRef: {
          profile_id: profileId,
          best_streak: checkinTrend.best_streak,
          total_checkins: checkinTrend.total_checkins,
        },
      }),
      ...buildMotivationMilestoneCandidates({
        domain: "brain_coach",
        achievedValue: brainCoachProgress.summary.streakDays,
        sourceRef: {
          total_sessions: brainCoachProgress.summary.totalSessions,
          completed_sessions: brainCoachProgress.summary.completedSessions,
          last_played_at: brainCoachProgress.summary.lastPlayedAt,
        },
      }),
    ]).filter((candidate) => !acknowledged.has(candidate.id));

    return res.json({ milestones: candidates });
  } catch (error) {
    console.error("[motivation] pending milestones failed:", error);
    return res.status(500).json({ error: "Milestones could not be loaded." });
  }
}

export async function acknowledgeMotivationMilestoneHandler(req: Request, res: Response) {
  const milestone = parseMotivationMilestoneId(req.params.id);
  if (!milestone) {
    return res.status(400).json({ error: "Unknown milestone." });
  }

  const parsed = acknowledgeBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid milestone acknowledgement." });
  }

  try {
    await ensureMotivationTables();

    const achievedValue = parsed.data.achieved_value ?? milestone.threshold;
    await pool.query(
      `insert into user_milestone_acknowledgements (
         user_id, domain, metric, threshold, achieved_value, source_ref
       ) values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (user_id, domain, metric, threshold) do update set
         achieved_value = greatest(user_milestone_acknowledgements.achieved_value, excluded.achieved_value),
         source_ref = user_milestone_acknowledgements.source_ref || excluded.source_ref`,
      [
        req.user!.id,
        milestone.domain,
        milestone.metric,
        milestone.threshold,
        achievedValue,
        JSON.stringify(parsed.data.source_ref ?? {}),
      ],
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("[motivation] acknowledge milestone failed:", error);
    return res.status(500).json({ error: "Milestone could not be acknowledged." });
  }
}

router.use(requireUser);
router.get("/milestones/pending", pendingMotivationMilestonesHandler);
router.post("/milestones/:id/acknowledge", acknowledgeMotivationMilestoneHandler);

export default router;
