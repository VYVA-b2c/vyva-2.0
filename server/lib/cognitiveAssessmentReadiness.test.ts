import { describe, expect, it } from "vitest";
import {
  COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS,
  COGNITIVE_ASSESSMENT_LANGUAGES,
  COGNITIVE_ASSESSMENT_STATIC_TASK_IDS,
} from "../../shared/cognitiveAssessmentReadiness.js";
import {
  cognitiveReadinessBlockersForLanguage,
  evaluateCognitiveAssessmentReadiness,
  type CognitiveReadinessInput,
} from "./cognitiveAssessmentReadiness.js";

function staticContentForAllLanguages() {
  return {
    languages: Object.fromEntries(COGNITIVE_ASSESSMENT_LANGUAGES.map((language) => [language, {}])),
  };
}

function fullReadinessInput(): CognitiveReadinessInput {
  return {
    generatedAt: "2026-07-05T12:00:00.000Z",
    taskDefinitions: COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS.map((id) => ({
      id,
      content_source: COGNITIVE_ASSESSMENT_STATIC_TASK_IDS.includes(id as typeof COGNITIVE_ASSESSMENT_STATIC_TASK_IDS[number])
        ? "static"
        : "item_bank",
      content_static: COGNITIVE_ASSESSMENT_STATIC_TASK_IDS.includes(id as typeof COGNITIVE_ASSESSMENT_STATIC_TASK_IDS[number])
        ? staticContentForAllLanguages()
        : null,
    })),
    itemCounts: COGNITIVE_ASSESSMENT_LANGUAGES.flatMap((language) => [
      { task_definition_id: "story_recall_immediate", language, active_count: 120 },
      { task_definition_id: "similarities", language, active_count: 120 },
      { task_definition_id: "fluency_semantic", language, active_count: 4 },
      { task_definition_id: "fluency_phonemic", language, active_count: 3 },
    ]),
    rotationCounts: COGNITIVE_ASSESSMENT_LANGUAGES.map((language) => ({
      language,
      active_count: 4,
    })),
  };
}

describe("cognitive assessment readiness", () => {
  it("marks the full 12-step, 5-language setup as ready", () => {
    const readiness = evaluateCognitiveAssessmentReadiness(fullReadinessInput());

    expect(readiness.ready).toBe(true);
    expect(readiness.taskDefinitions).toMatchObject({
      ready: true,
      activeCount: 12,
      expectedCount: 12,
      missingIds: [],
      unexpectedIds: [],
    });
    expect(readiness.languages).toHaveLength(5);
    expect(readiness.languages.every((language) => language.ready)).toBe(true);
  });

  it("flags the old two-task production state as not ready", () => {
    const input = fullReadinessInput();
    input.taskDefinitions = input.taskDefinitions.filter((definition) => (
      definition.id === "story_recall_immediate" || definition.id === "similarities"
    ));

    const readiness = evaluateCognitiveAssessmentReadiness(input);

    expect(readiness.ready).toBe(false);
    expect(readiness.taskDefinitions.ready).toBe(false);
    expect(readiness.taskDefinitions.activeCount).toBe(2);
    expect(readiness.taskDefinitions.missingIds).toContain("orientation");
    expect(cognitiveReadinessBlockersForLanguage(readiness, "en")).toContain("Task definitions are incomplete (2/12).");
  });

  it("blocks only the language that is missing uploaded item-bank content", () => {
    const input = fullReadinessInput();
    input.itemCounts = input.itemCounts.filter((row) => !(
      row.language === "fr" && row.task_definition_id === "similarities"
    ));

    const readiness = evaluateCognitiveAssessmentReadiness(input);
    const french = readiness.languages.find((language) => language.language === "fr");
    const english = readiness.languages.find((language) => language.language === "en");

    expect(readiness.ready).toBe(false);
    expect(french?.ready).toBe(false);
    expect(french?.blockers).toContain("Similarities: 0/4");
    expect(english?.ready).toBe(true);
  });
});
