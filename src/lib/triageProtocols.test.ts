import { describe, expect, it } from "vitest";
import { evaluateTriageRules, TRIAGE_PROTOCOLS } from "../../server/lib/triageRules.js";

function decision(
  symptomId: string,
  answerIds: string[],
  risks = {},
  hasCriticalRedFlag = false,
) {
  return evaluateTriageRules({
    locale: "en",
    symptomId,
    answerIds: new Set(answerIds),
    risks,
    hasCriticalRedFlag,
  });
}

describe("senior triage protocols", () => {
  it("defines a protocol for every symptom path exposed by the wizard", () => {
    expect(Object.keys(TRIAGE_PROTOCOLS).sort()).toEqual([
      "breathing",
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

  it("treats blue lips or confusion with breathing symptoms as emergency", () => {
    const result = decision("breathing", ["blue_confused"], {}, true);

    expect(result.level).toBe("emergency");
    expect(result.nextStepLabel).toContain("Call emergency");
    expect(result.recommendations.join(" ")).toContain("emergency");
  });

  it("does not leave mild urinary symptoms as empty watch-only advice", () => {
    const result = decision("urinary", ["no_red_flag", "mild", "same"]);

    expect(result.level).toBe("doctor_24_48");
    expect(result.recommendations.join(" ")).toContain("24-48");
    expect(result.watchSigns.join(" ")).toContain("Fever");
  });

  it("raises urinary symptoms to same-day advice when diabetes is in the profile", () => {
    const result = decision("urinary", ["no_red_flag", "mild"], { diabetes: true });

    expect(result.level).toBe("doctor_today");
    expect(result.profileConsiderations.join(" ")).toContain("Diabetes");
  });

  it("raises a fall with blood thinner history even without a selected head-hit emergency", () => {
    const result = decision("fall", ["no_red_flag", "mild"], { bloodThinner: true });

    expect(result.level).toBe("doctor_today");
    expect(result.profileConsiderations.join(" ")).toContain("Blood thinner");
  });

  it("treats sudden confusion as emergency", () => {
    const result = decision("confusion", ["sudden_confusion"], {}, true);

    expect(result.level).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("confusion");
  });

  it("escalates unclear symptoms instead of pretending certainty", () => {
    const result = decision("other", ["not_sure_duration", "not_sure_severity"]);

    expect(result.level).toBe("doctor_24_48");
    expect(result.reasons.join(" ")).toContain("unclear");
  });
});
