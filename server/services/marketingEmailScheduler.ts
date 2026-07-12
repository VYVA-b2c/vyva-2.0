import { sendDueMarketingCampaignEmails } from "../routes/adminMarketing.js";

let schedulerStarted = false;
let schedulerRunning = false;

export function getMarketingEmailSchedulerStatus() {
  const enabled = process.env.MARKETING_EMAIL_SCHEDULER_ENABLED === "true";
  const intervalMinutes = Math.max(1, Number(process.env.MARKETING_EMAIL_SCHEDULER_INTERVAL_MINUTES ?? 5));
  const initialDelaySeconds = Math.max(5, Number(process.env.MARKETING_EMAIL_SCHEDULER_INITIAL_DELAY_SECONDS ?? 30));
  return {
    enabled,
    intervalMinutes,
    initialDelaySeconds,
    actor: process.env.MARKETING_EMAIL_SCHEDULER_ACTOR?.trim() || "marketing-email-scheduler",
  };
}

export async function runMarketingEmailSchedulerOnce(now = new Date()) {
  if (schedulerRunning) {
    return { skipped: true, reason: "already_running" };
  }

  schedulerRunning = true;
  try {
    const status = getMarketingEmailSchedulerStatus();
    const result = await sendDueMarketingCampaignEmails(status.actor, now);
    if (result.dueCount > 0 || result.failedCount > 0) {
      console.log(
        `[marketing-email-scheduler] checked ${result.dueCount} due campaign(s), sent ${result.sentCount}, failed ${result.failedCount}, skipped ${result.skippedCount}`,
      );
    }
    return { skipped: false, result };
  } finally {
    schedulerRunning = false;
  }
}

export function startMarketingEmailScheduler() {
  if (process.env.NODE_ENV === "test") return false;
  if (schedulerStarted) return false;

  const status = getMarketingEmailSchedulerStatus();
  if (!status.enabled) return false;

  schedulerStarted = true;
  const run = () => {
    runMarketingEmailSchedulerOnce().catch((error) => {
      console.error("[marketing-email-scheduler] run failed", error);
    });
  };

  const first = setTimeout(run, status.initialDelaySeconds * 1000);
  first.unref?.();
  const interval = setInterval(run, status.intervalMinutes * 60_000);
  interval.unref?.();
  return true;
}
