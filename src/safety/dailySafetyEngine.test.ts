import { describe, expect, it } from "vitest";
import {
  buildDailySafetyCheck,
  deriveRiskTier,
  maxSafetyStatus,
  normalizeSafetyStatus,
  statusShouldEscalate,
  type DailySafetyInput,
  type SignalSummary,
} from "./dailySafetyEngine";

function signal(overrides: Partial<SignalSummary> = {}): SignalSummary {
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

describe("daily safety pure engine", () => {
  it("returns the same output for the same input without mutating it", () => {
    const input: DailySafetyInput = {
      signalSummary: [
        signal({
          signal: "sleep_quality_score",
          recent_values: [6],
          deviations_pct: [30],
          max_deviation: 30,
          reading_count: 1,
        }),
      ],
      language: "en",
    };
    const snapshot = JSON.stringify(input);

    const first = buildDailySafetyCheck(input);
    const second = buildDailySafetyCheck(input);

    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("keeps oxygen saturation at an urgent safety floor", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "oxygen_saturation", recent_values: [88] })],
      language: "en",
    });

    expect(result.safety_status).toBe("urgent_help");
    expect(result.risk_tier).toBe("urgent");
    expect(result.pattern_labels).toContain("oxygen");
    expect(statusShouldEscalate(result.safety_status)).toBe(true);
  });

  it("escalates repeated medication misses without needing UI context", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal()],
      medication: {
        activeMedicationCount: 3,
        scheduledToday: 2,
        takenToday: 1,
        missedOrLate30: 3,
      },
      language: "en",
    });

    expect(result.safety_status).toBe("share_with_caregiver");
    expect(result.risk_tier).toBe("notify");
    expect(result.pattern_labels).toEqual(expect.arrayContaining([
      "medication_check",
      "medication_adherence_support",
    ]));
    expect(result.caregiver_note).toMatch(/missed, skipped, or late medication/i);
  });

  it("normalizes external status aliases through deterministic helpers", () => {
    expect(normalizeSafetyStatus("doctor_today")).toBe("contact_doctor");
    expect(normalizeSafetyStatus("notify_caregiver")).toBe("share_with_caregiver");
    expect(normalizeSafetyStatus("emergency")).toBe("urgent_help");
    expect(maxSafetyStatus("recheck", "urgent_help")).toBe("urgent_help");
    expect(deriveRiskTier("steady", 80)).toBe("urgent");
  });
});
