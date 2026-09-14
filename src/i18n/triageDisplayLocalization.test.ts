import { describe, expect, it } from "vitest";
import {
  TRIAGE_SYMPTOM_IDS,
  triageWizardNodeFor,
  type TriageWizardMatrixStage,
} from "../../server/lib/triageWizardMatrix";
import {
  localizeTriageAnswerLabel,
  localizeTriageQuestion,
} from "../../shared/triageDisplayLocalization";

const stages: TriageWizardMatrixStage[] = ["red_flag", "duration", "severity", "trend"];

describe("French triage display localization", () => {
  it("covers every question and answer in the canonical triage matrix", () => {
    const nodes = TRIAGE_SYMPTOM_IDS.flatMap((symptomId) =>
      stages.map((stage) => triageWizardNodeFor(stage, symptomId)),
    );

    nodes.push(triageWizardNodeFor("symptom"));
    nodes.push(triageWizardNodeFor("location", "pain"));

    for (const painLocation of ["head_neck_pain", "back_pain", "belly_side_pain", "limb_joint_pain"]) {
      nodes.push(triageWizardNodeFor("red_flag", "pain", new Set([painLocation])));
      nodes.push(triageWizardNodeFor("trend", "pain", new Set([painLocation])));
    }

    for (const context of ["anxiety_context", "medication_context"]) {
      for (const stage of ["red_flag", "severity", "trend"] as const) {
        nodes.push(triageWizardNodeFor(stage, "other", new Set([context])));
      }
    }

    const missingQuestions = [...new Set(nodes
      .map((node) => node.question.en)
      .filter((question) => localizeTriageQuestion("fr", question) === question))];
    const missingLabels = [...new Set(nodes
      .flatMap((node) => node.replies.map((reply) => reply.label.en))
      .filter((label) => localizeTriageAnswerLabel("fr", label) === label))];

    expect(missingQuestions).toEqual([]);
    expect(missingLabels).toEqual([]);
  });

  it("leaves backend-facing values and non-French display text untouched", () => {
    expect(localizeTriageAnswerLabel("en", "It is ongoing and not improving"))
      .toBe("It is ongoing and not improving");
    expect(localizeTriageQuestion("es", "When did this start?"))
      .toBe("When did this start?");
  });
});
