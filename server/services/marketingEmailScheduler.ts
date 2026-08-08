import {
  runDueMarketingJourneyEmails,
  sendDueMarketingCampaignEmails,
} from "../routes/adminMarketing.js";

let schedulerStarted = false;
let schedulerRunning = false;

export function getMarketingEmailSchedulerStatus() {
  const enabled = process.env.MARKETING_EMAIL_SCHEDULER_ENABLED === "true";
  const journeysEnabled = process.env.MARKETING_JOURNEY_EMAIL_SCHEDULER_ENABLED !== "false";
  const intervalMinutes = Math.max(1, Number(process.env.MARKETING_EMAIL_SCHEDULER_INTERVAL_MINUTES ?? 5));
  const initialDelaySeconds = Math.max(5, Number(process.env.MARKETING_EMAIL_SCHEDULER_INITIAL_DELAY_SECONDS ?? 30));
  return {
    enabled,
    journeysEnabled,
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
    const [campaigns, journeys] = await Promise.all([
      status.enabled
        ? sendDueMarketingCampaignEmails(status.actor, now)
        : Promise.resolve({ dueCount: 0, sentCount: 0, failedCount: 0 }),
      status.journeysEnabled
        ? runDueMarketingJourneyEmails(status.actor, now)
        : Promise.resolve({ dueCount: 0, sentCount: 0, completedCount: 0, failedCount: 0 }),
    ]);
    if (
      campaigns.dueCount > 0 ||
      campaigns.failedCount > 0 ||
      journeys.dueCount > 0 ||
      journeys.failedCount > 0
    ) {
      console.log(
        `[marketing-email-scheduler] campaigns: ${campaigns.sentCount} sent, ${campaigns.failedCount} failed; journey steps: ${journeys.sentCount} sent, ${journeys.failedCount} failed`,
      );
    }
    return {
      skipped: false,
      result: { ...campaigns, journeys },
    };
  } finally {
    schedulerRunning = false;
  }
}

export function startMarketingEmailScheduler() {
  if (process.env.NODE_ENV === "test") return false;
  if (schedulerStarted) return false;

  const status = getMarketingEmailSchedulerStatus();
  if (!status.enabled && !status.journeysEnabled) return false;

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
