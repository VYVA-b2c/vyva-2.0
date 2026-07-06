import { describe, expect, it } from "vitest";
import { buildGuidancePlan } from "../index.js";
import type { TriageWizardContext } from "../index.js";

describe("guidance protocol map", () => {
  it("uses profile and useful vitals to raise confidence for dizziness", () => {
    const wizard: TriageWizardContext = {
      quickAnswers: [
        { id: "dizzy", label: "Dizzy", value: "I feel dizzy.", kind: "symptom" },
        { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" },
      ],
      vitals: { systolicBp: 126, diastolicBp: 78 },
    };

    const plan = buildGuidancePlan({
      locale: "en",
      stage: "severity",
      wizard,
      healthMemory: { conditions: "Hypertension and high blood pressure." },
    });

    expect(plan.protocolId).toBe("dizziness");
    expect(plan.profileContextUsed).toBe(true);
    expect(plan.priorityLabel).toBe("Profile-aware");
    expect(plan.confidence.score).toBe(5);
    expect(plan.usefulSignals).toContainEqual(expect.objectContaining({ id: "blood_pressure", status: "available" }));
  });

  it("classifies medicine-related concerns even when the symptom path is general", () => {
    const wizard: TriageWizardContext = {
      quickAnswers: [
        { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
        { id: "medication_context", label: "Medicine change", value: "This may be related to a medicine.", kind: "free_text" },
      ],
    };

    const plan = buildGuidancePlan({
      locale: "en",
      stage: "red_flag",
      wizard,
      messages: [{ role: "user", content: "I feel strange after a new pill." }],
      healthMemory: { medications: "Aspirin, sleeping pill as needed." },
    });

    expect(plan.protocolId).toBe("medication");
    expect(plan.protocolLabel).toBe("Medication-related change");
    expect(plan.nextQuestionFocus).toContain("medicine changes");
    expect(plan.confidence.missing).toContain("safety warning signs");
  });

  it("keeps early confidence honest when useful signals are missing", () => {
    const wizard: TriageWizardContext = {
      quickAnswers: [
        { id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" },
      ],
    };

    const plan = buildGuidancePlan({
      locale: "en",
      stage: "red_flag",
      wizard,
    });

    expect(plan.protocolId).toBe("chest_breathing");
    expect(plan.confidence.score).toBe(2);
    expect(plan.confidence.label).toBe("Early confidence");
    expect(plan.usefulSignals).toContainEqual(expect.objectContaining({ id: "oxygen", status: "missing" }));
  });
});

