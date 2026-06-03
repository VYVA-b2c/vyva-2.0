import { describe, expect, it } from "vitest";
import { compactReportRecommendations } from "./reportRecommendations";

describe("compactReportRecommendations", () => {
  it("keeps one doctor timing step and removes repeated escalation wording", () => {
    const result = compactReportRecommendations([
      "Talk to a doctor within 24-48 hours if this remains unclear.",
      "Contact your doctor or clinic within 24-48 hours if this continues.",
      "Use this report to explain the symptom clearly.",
      "Seek same-day help if it gets worse or feels unusual for you.",
      "Keep track of any changes in your symptoms",
    ], { level: "doctor_24_48" });

    expect(result).toEqual([
      "Talk to a doctor within 24-48 hours if this remains unclear.",
      "Use this report to explain the symptom clearly.",
      "Keep track of any changes in your symptoms",
    ]);
  });
});
