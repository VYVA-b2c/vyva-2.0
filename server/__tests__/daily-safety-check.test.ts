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

  it("returns deterministic safety guidance in French", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "bp_diastolic", recent_values: [104] })],
      language: "fr",
    });

    expect(result.safety_status).toBe("contact_doctor");
    expect(result.senior_message).toBe("VYVA a détecté un changement qui mérite un avis médical aujourd’hui. Partagez ce résumé si vous le pouvez.");
    expect(result.senior_message).not.toMatch(/noticed|medical advice|share this summary/i);
  });

  it("keeps a single mild abnormal value at recheck", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "bp_systolic", recent_values: [145] })],
      language: "en",
    });

    expect(result.safety_status).toBe("recheck");
    expect(result.risk_tier).toBe("watch");
  });

  it("uses diastolic blood pressure in safety checks", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "bp_diastolic", recent_values: [104] })],
      language: "en",
    });

    expect(result.safety_status).toBe("contact_doctor");
    expect(result.contributing_signals.reasons).toEqual([
      expect.stringMatching(/bottom number is 104/i),
    ]);
  });

  it("treats meaningful weight increases as a vitals signal", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [
        signal({
          signal: "weight_kg",
          recent_values: [84],
          deviations_pct: [5.5],
          max_deviation: 5.5,
          reading_count: 2,
        }),
      ],
      language: "en",
    });

    expect(result.safety_status).toBe("contact_doctor");
    expect(result.contributing_signals.reasons).toEqual([
      expect.stringMatching(/weight is up 5.5%/i),
    ]);
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

  it("treats abnormal phone-estimated pulse as a confirmation request", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [
        signal({
          signal: "resting_hr_bpm",
          recent_values: [132],
          latest_source: "phone_estimate",
          source_confidence: "low",
          source_confidence_reason: "estimated from the phone camera",
        }),
      ],
      language: "en",
    });

    expect(result.safety_status).toBe("recheck");
    expect(result.senior_message).toMatch(/recheck/i);
    expect(result.contributing_signals.signal_findings).toEqual([
      expect.objectContaining({
        status: "recheck",
        reason: expect.stringMatching(/phone estimate/i),
      }),
    ]);
  });

  it("still escalates high-confidence device pulse readings", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [
        signal({
          signal: "resting_hr_bpm",
          recent_values: [132],
          latest_source: "connected_device",
          source_confidence: "high",
          source_confidence_reason: "recorded from a connected device",
        }),
      ],
      language: "en",
    });

    expect(result.safety_status).toBe("urgent_help");
    expect(result.risk_tier).toBe("urgent");
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

  it("does not escalate low-confidence baseline shifts without confirmation", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [
        signal({
          signal: "resting_hr_bpm",
          recent_values: [92, 90],
          deviations_pct: [38, 34],
          max_deviation: 38,
          reading_count: 2,
          latest_source: "phone_estimate",
          source_confidence: "low",
        }),
      ],
      language: "en",
    });

    expect(result.safety_status).toBe("recheck");
    expect(result.pattern_labels).not.toContain("repeated_baseline_shift");
    expect(result.contributing_signals.reasons).toEqual([
      expect.stringMatching(/phone estimate/i),
    ]);
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
