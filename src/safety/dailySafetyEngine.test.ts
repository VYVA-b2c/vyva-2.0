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

  it("keeps BP crisis readings at doctor contact unless concerning symptoms are present", () => {
    const systolicOnly = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "bp_systolic", recent_values: [190] })],
      language: "en",
    });
    const diastolicOnly = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "bp_diastolic", recent_values: [121] })],
      language: "en",
    });

    expect(systolicOnly.safety_status).toBe("contact_doctor");
    expect(diastolicOnly.safety_status).toBe("contact_doctor");
    expect(systolicOnly.risk_tier).toBe("notify");
    expect(diastolicOnly.risk_tier).toBe("notify");
  });

  it("escalates BP crisis readings to urgent help when crisis symptoms are present", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "bp_systolic", recent_values: [190] })],
      symptomPattern: { severeHeadache: true, visionChange: true },
      language: "en",
    });

    expect(result.safety_status).toBe("urgent_help");
    expect(result.risk_tier).toBe("urgent");
    expect(result.pattern_labels).toContain("bp_crisis_symptoms");
  });

  it("maps respiratory rate 21-24 to doctor contact and 25+ to urgent help", () => {
    const mildlyRaised = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "respiratory_rate", recent_values: [22] })],
      language: "en",
    });
    const thresholdRaised = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "respiratory_rate", recent_values: [24] })],
      language: "en",
    });
    const urgent = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "respiratory_rate", recent_values: [25] })],
      language: "en",
    });

    expect(mildlyRaised.safety_status).toBe("contact_doctor");
    expect(thresholdRaised.safety_status).toBe("contact_doctor");
    expect(urgent.safety_status).toBe("urgent_help");
  });

  it("maps oxygen saturation 89-92 to doctor contact", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "oxygen_saturation", recent_values: [90] })],
      language: "en",
    });

    expect(result.safety_status).toBe("contact_doctor");
    expect(result.risk_tier).toBe("notify");
  });

  it("uses DKA/HHS pattern symptoms to escalate glucose 300+ to urgent help", () => {
    const glucoseAlone = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "glucose_mgdl", recent_values: [320] })],
      language: "en",
    });
    const glucoseWithPattern = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "glucose_mgdl", recent_values: [320] })],
      symptomPattern: { vomiting: true, dehydration: true },
      language: "en",
    });

    expect(glucoseAlone.safety_status).toBe("contact_doctor");
    expect(glucoseWithPattern.safety_status).toBe("urgent_help");
    expect(glucoseWithPattern.pattern_labels).toContain("dka_hhs_pattern");
  });

  it("marks caregiver escalation when urgent help affects someone living alone with consented caregiver support", () => {
    const result = buildDailySafetyCheck({
      signalSummary: [signal({ signal: "respiratory_rate", recent_values: [25] })],
      caregiver: {
        livesAlone: true,
        caregiverConsent: true,
        caregiverAvailable: true,
      },
      language: "en",
    });

    expect(result.safety_status).toBe("urgent_help");
    expect(result.pattern_labels).toContain("caregiver_escalation");
    expect(result.contributing_signals).toMatchObject({
      caregiver_escalation: {
        should_alert: true,
        lives_alone: true,
        caregiver_consent: true,
        caregiver_available: true,
      },
    });
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
