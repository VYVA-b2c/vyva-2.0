import { dispatchQueuedCommunications } from "../../server/services/communicationDispatcher.js";
import { runDailyCheckinNoResponseSweep } from "../../server/services/dailyCheckinMonitor.js";
import { runMarketingEmailSchedulerOnce } from "../../server/services/marketingEmailScheduler.js";
import { runMedicationRefillSweep } from "../../server/services/medicationRefillMonitor.js";
import { runProactiveOutreachSweep } from "../../server/engagement/proactiveOutreachSweep.js";

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponseLike = {
  status(code: number): VercelResponseLike;
  json(body: unknown): void;
};

export const config = {
  maxDuration: 300,
};

function isAuthorized(req: VercelRequestLike): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization;
  return Boolean(secret && authorization === `Bearer ${secret}`);
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

  const results = await Promise.allSettled([
    dispatchQueuedCommunications(Number(process.env.COMMUNICATION_DISPATCH_BATCH_SIZE ?? 25)),
    runDailyCheckinNoResponseSweep(),
    runMarketingEmailSchedulerOnce(),
    runMedicationRefillSweep(),
    runProactiveOutreachSweep(),
  ]);
  const failures = results.filter((result) => result.status === "rejected");

  res.status(failures.length ? 500 : 200).json({
    ok: failures.length === 0,
    completed: results.length - failures.length,
    failed: failures.length,
  });
}
