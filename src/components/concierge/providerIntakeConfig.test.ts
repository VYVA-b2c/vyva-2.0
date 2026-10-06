import { describe, expect, it } from "vitest";
import { intakeMustHaveLabels, intakeSearchTerms, providerIntakeQuestions } from "./providerIntakeConfig";

describe("provider intake configuration", () => {
  it.each(["specialist", "personal-care", "residence", "care", "transport", "pharmacy", "home-service", "shopping-seller"])("defines focused questions for %s", (mode) => {
    const questions = providerIntakeQuestions(mode);
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
  });

  it("turns explicit answers into search terms and must-haves", () => {
    const intake = { mode: "transport", serviceType: "Medical appointment", answers: { mobility_transport: ["wheelchair"] }, mustHaveAnswerIds: ["mobility_transport"], additionalDetails: "Return journey" };
    expect(intakeSearchTerms(intake, "en")).toContain("Wheelchair space");
    expect(intakeMustHaveLabels(intake, "en")).toEqual(["Wheelchair space"]);
  });
});
