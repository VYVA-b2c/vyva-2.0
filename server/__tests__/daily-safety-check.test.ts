import { describe, expect, it } from "vitest";
import {
  buildDailySafetyCheck,
  mergeAiSafetySuggestion,
  type SignalSummary,
} from "../lib/dailySafetyCheck.js";

function signal(overrides: Partial<SignalSummary>): SignalSummary {
  return {
    signal: "resting_hr_bpm",
    context: "general",
    recent_values: [72],
    deviations_pct: [],
    trend: "stable",
    max_deviation: null,
    reading_count: 1,
    ...overrides,
  };
}

describe("daily safety check rules", () => {
  it("asks for a recheck when no data exists instead of calling the user steady", () => {
    const result = buildDailySafetyCheck({ signalSummary: [], language: "en" });

    expect(result.safety_status).toBe("recheck");
    expect(result.recommended_action).toBe("recheck");
    expect(result.senior_message).toMatch(/complete today's check/i);
  });

  it("keeps a single mild abnormal value at recheck", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "bp_systolic", recent_values: [145] })],
      language: "en",
    });

    expect(result.safety_status).toBe("recheck");
    expect(result.risk_tier).toBe("watch");
  });

  it("raises repeated baseline deviation to caregiver sharing", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [
        signal({
          signal: "resting_hr_bpm",
          recent_values: [92, 90],
          deviations_pct: [28, 27],
          max_deviation: 28,
          reading_count: 2,
        }),
      ],
      language: "en",
    });

    expect(result.safety_status).toBe("share_with_caregiver");
    expect(result.pattern_labels).toContain("repeated_baseline_shift");
  });

  it("raises multiple baseline deviations to doctor contact", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [
        signal({ signal: "resting_hr_bpm", deviations_pct: [28], max_deviation: 28, reading_count: 1 }),
        signal({ signal: "sleep_quality_score", recent_values: [6], deviations_pct: [32], max_deviation: 32, reading_count: 1 }),
      ],
      language: "en",
    });

    expect(result.safety_status).toBe("contact_doctor");
    expect(result.pattern_labels).toContain("multi_signal_shift");
  });

  it("does not let AI downgrade an emergency safety floor", () => {
    const base = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "respiratory_rate", recent_values: [32] })],
      language: "en",
    });

    const merged = mergeAiSafetySuggestion(base, {
      risk_score: 5,
      risk_tier: "none",
      recommended_action: "steady",
      senior_message: "Everything looks calm.",
    });

    expect(base.safety_status).toBe("urgent_help");
    expect(merged.safety_status).toBe("urgent_help");
    expect(merged.risk_tier).toBe("urgent");
  });

  it("uses recent emergency triage as urgent guidance", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ recent_values: [72] })],
      latestTriage: {
        chief_complaint: "Chest pressure",
        next_step_level: "emergency",
        next_step_label: "Call emergency services now",
      },
      language: "en",
    });

    expect(result.safety_status).toBe("urgent_help");
    expect(result.contributing_signals.latest_triage).toMatchObject({
      next_step_level: "emergency",
    });
  });
});
