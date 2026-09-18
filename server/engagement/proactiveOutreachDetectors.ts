import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../db.js";
import { advisorUserAgentState, scamChecks } from "../../shared/schema.js";
import type { ProactiveOutreachCandidate } from "./proactiveOutreachContext.js";

const WELLNESS_SILENCE_DAYS = 7;
const SCAM_SIGNAL_LOOKBACK_HOURS = 24;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * "Silence" detector: the Wellness Coach (amara) noticing a user who used to
 * talk to it has gone quiet. advisorUserAgentState.user_id doubles as the
 * profile id here - these advisor features don't have a separate multi-profile
 * concept the way checkins.ts does.
 */
export async function detectWellnessSilenceCandidates(now = new Date()): Promise<ProactiveOutreachCandidate[]> {
  const cutoff = new Date(now.getTime() - WELLNESS_SILENCE_DAYS * 24 * 60 * 60_000);
  const rows = await db
    .select({ userId: advisorUserAgentState.user_id, lastMessageAt: advisorUserAgentState.last_message_at })
    .from(advisorUserAgentState)
    .where(and(
      eq(advisorUserAgentState.agent_slug, "amara"),
      lt(advisorUserAgentState.last_message_at, cutoff),
    ));

  return rows
    // Only users who had actually engaged before - "went quiet", not "never used it".
    .filter((row): row is { userId: string; lastMessageAt: Date } => row.lastMessageAt !== null)
    .map((row) => ({
      userId: row.userId,
      profileId: row.userId,
      reasonSummary: "I'm reaching out because your Wellness Coach noticed it's been a while since your last check-in, and wanted to see how you're doing.",
      scheduleOccurrenceId: `proactive_outreach.wellness_silence.${row.userId}.${dateKey(now)}`,
      scheduleId: "proactive_outreach.wellness_silence",
      source: "scheduled_interaction" as const,
    }));
}

/**
 * "Signal" detector: the Scam Protector (diego) flagged something the user
 * shared as suspicious or an outright scam, worth a human-sounding follow-up
 * rather than leaving it as a silent record.
 */
export async function detectScamSignalCandidates(now = new Date()): Promise<ProactiveOutreachCandidate[]> {
  const cutoff = new Date(now.getTime() - SCAM_SIGNAL_LOOKBACK_HOURS * 60 * 60_000);
  const rows = await db
    .select({ id: scamChecks.id, userId: scamChecks.user_id, riskLevel: scamChecks.risk_level })
    .from(scamChecks)
    .where(and(
      gte(scamChecks.checked_at, cutoff),
      inArray(scamChecks.risk_level, ["Suspicious", "Scam"]),
    ));

  return rows.map((row) => ({
    userId: row.userId,
    profileId: row.userId,
    reasonSummary: row.riskLevel === "Scam"
      ? "I'm reaching out because your Scam Protector flagged something you shared as a likely scam, and wanted to make sure you're okay and follow up."
      : "I'm reaching out because your Scam Protector flagged something you shared as worth a second look, and wanted to check in about it.",
    scheduleOccurrenceId: `proactive_outreach.scam_signal.${row.id}`,
    scheduleId: "proactive_outreach.scam_signal",
    source: "communication_log" as const,
  }));
}
