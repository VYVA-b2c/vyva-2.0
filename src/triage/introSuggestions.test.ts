import { describe, expect, it } from "vitest";
import { buildPersonalizedTriageSuggestions, extractTriageProfileSignals } from "./introSuggestions";

describe("extractTriageProfileSignals", () => {
  it("extracts source-aware signals from profile, medicines, vitals, adherence, and reports", () => {
    const signals = extractTriageProfileSignals({
      healthContext: "Care plan notes mention low immunity and recent surgery.",
      conditions: "Diabetes, asthma, heart disease, CKD, stroke history, Parkinson's, liver disease, recurrent UTI",
      allergies: "Medicine allergy with rash",
      medications: "metformin, apixaban, prednisone, zolpidem",
      latestVitals: "Latest vitals: glucose high, blood pressure elevated, oxygen 92%",
      vitalsTrend: "Vitals trend: breathing rate rising and renal marker noted",
      latestSymptomReport: "Recent report: wound redness, confusion, urine burning",
      medicationAdherence: "Missed dose and refill running out",
      medicationInteraction: "Possible interaction causing dizziness",
    });

    expect(signals.hasProfileContext).toBe(true);
    expect(signals.diabetes.active).toBe(true);
    expect(signals.respiratory.active).toBe(true);
    expect(signals.heartBp.active).toBe(true);
    expect(signals.kidney.active).toBe(true);
    expect(signals.strokeCognitiveParkinson.active).toBe(true);
    expect(signals.immunosuppression.active).toBe(true);
    expect(signals.surgeryWound.active).toBe(true);
    expect(signals.liver.active).toBe(true);
    expect(signals.uti.active).toBe(true);
    expect(signals.medicationRisk.active).toBe(true);
    expect(signals.medicationAdherence.reasonCode).toBe("medicine_match");
    expect(signals.medicationInteraction.reasonCode).toBe("condition_match");
    expect(signals.recentVitals.reasonCode).toBe("recent_vitals");
    expect(signals.recentReport.reasonCode).toBe("recent_report");
  });

  it("keeps medicine-only context separate from condition matches", () => {
    const signals = extractTriageProfileSignals({
      medications: "zolpidem and furosemide",
      medicationAdherence: "Refill running out",
    });

    expect(signals.medicationRisk.reasonCode).toBe("medicine_match");
    expect(signals.medicationAdherence.reasonCode).toBe("medicine_match");
    expect(signals.medicationRisk.sources).toContain("medications");
  });
});

describe("buildPersonalizedTriageSuggestions", () => {
  it("ranks safety-relevant profile suggestions ahead of recent and fallback suggestions", () => {
    const suggestions = buildPersonalizedTriageSuggestions({
      conditions: "heart disease atrial fibrillation high blood pressure",
      latestSymptomReport: "Recent report: dizziness with monitor next step",
      latestVitals: "blood pressure 150/90",
    }, "en");

    const ids = suggestions.map((suggestion) => suggestion.id);
    expect(ids[0]).toBe("heart-chest-pressure");
    expect(ids).toContain("recent-symptom-followup");
    expect(ids.indexOf("heart-chest-pressure")).toBeLessThan(ids.indexOf("recent-symptom-followup"));
    expect(suggestions.find((suggestion) => suggestion.id === "heart-chest-pressure")?.score)
      .toBeGreaterThan(suggestions.find((suggestion) => suggestion.id === "recent-symptom-followup")?.score ?? 0);
  });

  it("returns expanded approved concern and improvement suggestions from profile signals", () => {
    const suggestions = buildPersonalizedTriageSuggestions({
      conditions: "diabetes COPD heart disease osteoporosis fall risk",
      medications: "metformin apixaban",
      latestVitals: "glucose 240 mg/dL and blood pressure 150/90",
      vitalsTrend: "oxygen lower than usual",
      medicationAdherence: "Missed dose and refill needed",
      medicationInteraction: "Possible medicine interaction",
    }, "en");

    const ids = suggestions.map((suggestion) => suggestion.id);
    expect(ids).toContain("heart-chest-pressure");
    expect(ids).toContain("breathing-harder");
    expect(ids).toContain("fall-or-injury");
    expect(ids).toContain("diabetes-urine");
    expect(ids).toContain("heart-bp-check");
    expect(ids).toContain("diabetes-glucose-check");
    expect(ids).toContain("breathing-check");
    expect(ids).toContain("safe-home-review");
    expect(ids).toContain("med-review");
  });

  it("adds new safety groups for immune, wound, neurologic, liver, and UTI contexts", () => {
    const cases = [
      ["immune-fever-infection", { healthContext: "Low immunity after oncology treatment." }],
      ["wound-change", { latestSymptomReport: "Recent report: wound redness and drainage" }],
      ["neuro-weak-speech", { conditions: "stroke history Parkinson's" }],
      ["liver-swelling-confusion", { conditions: "liver disease" }],
      ["uti-urine-discomfort", { conditions: "recurrent UTI" }],
    ] as const;

    for (const [expectedId, memory] of cases) {
      expect(buildPersonalizedTriageSuggestions(memory, "en").map((suggestion) => suggestion.id)).toContain(expectedId);
    }
  });

  it("keeps visible copy private while returning reason metadata", () => {
    const suggestions = buildPersonalizedTriageSuggestions({
      conditions: "diabetes COPD cancer kidney disease liver disease",
      medications: "metformin apixaban prednisone",
    }, "en");

    const visibleCopy = suggestions.map((suggestion) => `${suggestion.label} ${suggestion.description}`).join(" ");
    expect(visibleCopy).not.toMatch(/\b(diabetes|copd|asthma|cancer|kidney disease|liver disease|metformin|apixaban|prednisone)\b/i);
    expect(suggestions.some((suggestion) => suggestion.reasonCode === "condition_match")).toBe(true);
    expect(suggestions.every((suggestion) => typeof suggestion.score === "number")).toBe(true);
  });

  it("deduplicates and caps each lane", () => {
    const suggestions = buildPersonalizedTriageSuggestions({
      conditions: "diabetes COPD heart disease atrial fibrillation high blood pressure osteoporosis fall risk dementia depression kidney disease UTI stroke Parkinson liver disease cancer recent surgery",
      medications: "metformin apixaban zolpidem furosemide prednisone",
      latestVitals: "oxygen saturation 92%, glucose 260 mg/dL, blood pressure 160/95",
      vitalsTrend: "respiratory rate rising and blood pressure high",
      latestSymptomReport: "Recent report: fall with pain, confusion, wound redness, urine burning",
      medicationAdherence: "missed dose and refill needed",
      medicationInteraction: "possible interaction",
    }, "en");

    expect(new Set(suggestions.map((suggestion) => suggestion.id)).size).toBe(suggestions.length);
    expect(suggestions.filter((suggestion) => suggestion.kind === "common_concern")).toHaveLength(6);
    expect(suggestions.filter((suggestion) => suggestion.kind === "health_improvement")).toHaveLength(5);
  });

  it("falls back gracefully when no profile context exists", () => {
    const suggestions = buildPersonalizedTriageSuggestions(undefined, "en");

    expect(suggestions.every((suggestion) => suggestion.source === "fallback")).toBe(true);
    expect(suggestions.every((suggestion) => suggestion.reasonCode === "fallback")).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.kind === "common_concern")).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.kind === "health_improvement")).toBe(true);
    expect(suggestions.find((suggestion) => suggestion.id === "fallback-vitals")?.route).toBe("/health/vitals");
  });

  it("localizes labels for exposed app languages", () => {
    const suggestions = buildPersonalizedTriageSuggestions({ conditions: "diabetes" }, "es");

    expect(suggestions.find((suggestion) => suggestion.id === "diabetes-urine")?.label).toBe("Dolor o urgencia al orinar");
  });
});
