import {
  runHealthInsightsOutcomeFollowUpJob,
  runMonthlyHealthInsightsJob,
  runWeeklyHealthInsightsJob,
  type HealthInsightsJobResult,
} from "../../server/routes/healthInsightsReport.js";
import {
  getHealthInsightsCronActions,
  type HealthInsightsCronAction,
} from "../../server/services/healthInsightsCronSchedule.js";

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponseLike = {
  status(code: number): VercelResponseLike;
  json(body: unknown): void;
};

export const config = {
  maxDuration: 800,
};

function isAuthorized(req: VercelRequestLike): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.authorization === `Bearer ${secret}`);
}

async function runAction(action: HealthInsightsCronAction): Promise<HealthInsightsJobResult> {
  if (action === "weekly") return runWeeklyHealthInsightsJob();
  if (action === "monthly") return runMonthlyHealthInsightsJob();
  return runHealthInsightsOutcomeFollowUpJob();
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }
  if (!isAuthorized(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const timeZone = process.env.HEALTH_INSIGHTS_CRON_TIMEZONE ?? "Europe/Madrid";
  const actions = getHealthInsightsCronActions(new Date(), timeZone);
  if (actions.length === 0) {
    res.status(200).json({ ok: true, skipped: true, actions: [] });
    return;
  }

  const settled = await Promise.allSettled(actions.map(async (action) => ({
    action,
    result: await runAction(action),
  })));
  const completed = settled
    .filter((result): result is PromiseFulfilledResult<{ action: HealthInsightsCronAction; result: HealthInsightsJobResult }> => result.status === "fulfilled")
    .map((result) => ({ action: result.value.action, ...result.value.result }));
  const failed = settled.filter((result) => result.status === "rejected").length
    + completed.reduce((total, result) => total + result.failed, 0);

  res.status(failed ? 500 : 200).json({
    ok: failed === 0,
    skipped: false,
    actions: completed,
    failed,
  });
}
