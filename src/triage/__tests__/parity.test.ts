import { describe, expect, it } from "vitest";
import {
  TRIAGE_PROTOCOLS,
  evaluateTriage,
  type TriageRuleRiskFlags,
  type TriageVitals,
} from "../index.js";

function decision(
  symptomId: string,
  answerIds: string[],
  risks: TriageRuleRiskFlags = {},
  hasCriticalRedFlag = false,
  vitals: TriageVitals = {},
) {
  return evaluateTriage({
    locale: "en",
    symptomId,
    answerIds: new Set(answerIds),
    risks,
    hasCriticalRedFlag,
    ...vitals,
  });
}

describe("triage engine v1 parity", () => {
  it("keeps the current twelve production symptom protocols", () => {
    expect(Object.keys(TRIAGE_PROTOCOLS).sort()).toEqual([
      "breathing",
      "chest",
      "confusion",
      "dizzy",
      "fall",
      "fever",
      "other",
      "pain",
      "skin",
      "stomach",
      "tired",
      "urinary",
    ]);
  });

  it.each([
    ["chest discomfort", "chest", ["chest_now"], { heartDisease: true }, false, {}, "doctor_today", "urgent"],
    ["pain/headache", "pain", ["sudden_severe"], { hypertension: true }, true, {}, "emergency", "urgent"],
    ["breathing", "breathing", ["cannot_speak_breathing"], { copd: true }, true, {}, "emergency", "urgent"],
    ["fever", "fever", ["high_fever"], {}, false, { temperatureC: 38.2 }, "doctor_today", "urgent"],
    ["dizziness/faintness", "dizzy", ["standing_dizziness"], { diureticMedication: true }, false, { systolicBp: 96 }, "doctor_today", "urgent"],
    ["very tired/weak", "tired", ["infection_signs"], { kidneyDisease: true, diureticMedication: true }, false, {}, "doctor_today", "urgent"],
    ["stomach/bowel", "stomach", ["constipation_passing_gas"], {}, false, {}, "doctor_24_48", "routine"],
    ["urine problem", "urinary", ["no_red_flag", "mild"], {}, false, {}, "doctor_24_48", "routine"],
    ["fall/injury", "fall", ["no_red_flag", "mild", "better"], {}, false, {}, "monitor", "monitor"],
    ["skin/wound/rash", "skin", ["wound_spreading"], { recentSurgery: true }, false, {}, "doctor_today", "urgent"],
    ["confusion", "confusion", ["sudden_confusion"], {}, true, {}, "emergency", "urgent"],
    ["something else", "other", ["not_sure_duration", "not_sure_severity"], {}, false, {}, "doctor_24_48", "routine"],
  ])("preserves %s path outcome", (_name, symptomId, answerIds, risks, hasCriticalRedFlag, vitals, expectedLevel, expectedUrgency) => {
    const result = decision(
      symptomId as string,
      answerIds as string[],
      risks as TriageRuleRiskFlags,
      Boolean(hasCriticalRedFlag),
      vitals as TriageVitals,
    );

    expect(result.level).toBe(expectedLevel);
    expect(result.urgency).toBe(expectedUrgency);
  });

  it.each([
    ["BP crisis with chest context", "chest", ["chest_now"], {}, false, { systolicBp: 182, diastolicBp: 121 }, "emergency"],
    ["BP crisis alone", "other", ["no_red_flag"], { hypertension: true }, false, { systolicBp: 185, diastolicBp: 122 }, "doctor_today"],
    ["SpO2 92", "breathing", ["walking_only"], {}, false, { oxygenSaturation: 92 }, "doctor_today"],
    ["SpO2 88", "breathing", ["walking_only"], {}, false, { oxygenSaturation: 88 }, "emergency"],
    ["RR 21", "fever", ["no_red_flag"], {}, false, { respiratoryRate: 21 }, "doctor_today"],
    ["RR 25", "fever", ["no_red_flag"], {}, false, { respiratoryRate: 25 }, "emergency"],
    ["low glucose", "dizzy", ["no_red_flag"], { diabetes: true }, false, { glucoseMgdl: 68 }, "doctor_today"],
    ["severe low glucose with confusion", "confusion", ["no_red_flag"], { diabetes: true }, false, { glucoseMgdl: 52 }, "emergency"],
    ["DKA/HHS high glucose pattern", "stomach", ["no_red_flag"], { diabetes: true }, false, { glucoseMgdl: 320 }, "emergency"],
    ["stroke FAST-style red flag", "dizzy", ["stroke_sign"], { strokeHistory: true }, true, {}, "emergency"],
    ["anticoagulant head injury", "fall", ["head_hit_blood_thinner"], { bloodThinner: true }, false, {}, "doctor_today"],
    ["profile modifier escalation", "urinary", ["no_red_flag", "mild"], { diabetes: true }, false, {}, "doctor_today"],
  ])("preserves threshold and escalation parity for %s", (_name, symptomId, answerIds, risks, hasCriticalRedFlag, vitals, expectedLevel) => {
    const result = decision(
      symptomId as string,
      answerIds as string[],
      risks as TriageRuleRiskFlags,
      Boolean(hasCriticalRedFlag),
      vitals as TriageVitals,
    );

    expect(result.level).toBe(expectedLevel);
  });
});
