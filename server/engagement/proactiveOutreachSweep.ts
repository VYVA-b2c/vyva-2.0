import {
  detectScamSignalCandidates,
  detectWellnessSilenceCandidates,
} from "./proactiveOutreachDetectors.js";
import {
  buildProactiveOutreachRuntimeInput,
  type ProactiveOutreachCandidate,
} from "./proactiveOutreachContext.js";
import {
  runPreventiveOutboundCallEntry,
  type PreventiveOutboundCallRuntimeOutcome,
} from "./preventiveOutboundCallRuntime.js";

export type ProactiveOutreachSweepResult = Readonly<{
  candidatesConsidered: number;
  outcomes: Partial<Record<PreventiveOutboundCallRuntimeOutcome, number>>;
}>;

async function processCandidate(
  candidate: ProactiveOutreachCandidate,
  outcomes: Partial<Record<PreventiveOutboundCallRuntimeOutcome, number>>,
): Promise<void> {
  const runtimeInput = await buildProactiveOutreachRuntimeInput(candidate);
  const result = await runPreventiveOutboundCallEntry(runtimeInput);
  outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
}

/**
 * Runs both detector jobs and, for every candidate, gathers context and hands
 * it to the unchanged preventive-outbound-call runtime/policy engine. This is
 * the "job" a scheduler calls; nothing here decides whether a call actually
 * goes out - that's entirely proactivePolicy.ts's and the runtime's job.
 */
export async function runProactiveOutreachSweep(now = new Date()): Promise<ProactiveOutreachSweepResult> {
  const [wellnessSilence, scamSignal] = await Promise.all([
    detectWellnessSilenceCandidates(now).catch((error) => {
      console.error("[proactive-outreach] wellness silence detector failed:", error);
      return [];
    }),
    detectScamSignalCandidates(now).catch((error) => {
      console.error("[proactive-outreach] scam signal detector failed:", error);
      return [];
    }),
  ]);

  const candidates = [...wellnessSilence, ...scamSignal];
  const outcomes: Partial<Record<PreventiveOutboundCallRuntimeOutcome, number>> = {};

  for (const candidate of candidates) {
    try {
      await processCandidate(candidate, outcomes);
    } catch (error) {
      console.error("[proactive-outreach] candidate evaluation failed:", candidate.scheduleOccurrenceId, error);
      outcomes.invalid_input = (outcomes.invalid_input ?? 0) + 1;
    }
  }

  return { candidatesConsidered: candidates.length, outcomes };
}

export function startProactiveOutreachMonitor(): boolean {
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_PROACTIVE_OUTREACH_MONITOR === "true") {
    return false;
  }
  const intervalMinutes = Math.max(15, Number(process.env.PROACTIVE_OUTREACH_MONITOR_INTERVAL_MINUTES ?? 60));
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runProactiveOutreachSweep();
      if (result.candidatesConsidered) {
        console.log("[proactive-outreach] sweep complete", result);
      }
    } catch (error) {
      console.error("[proactive-outreach] sweep failed:", error);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 30_000);
  setInterval(run, intervalMinutes * 60_000);
  return true;
}
