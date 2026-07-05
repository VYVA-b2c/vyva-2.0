import { describe, expect, it } from "vitest";
import { buildResponseData } from "./CognitiveAssessmentRunnerPage";
import type { CognitiveAssessmentRunnerTask } from "../../shared/cognitiveAssessmentRunner";

function storyTask(content: Record<string, unknown>): CognitiveAssessmentRunnerTask {
  return {
    id: "story_recall_immediate",
    displayOrder: 2,
    label: "Story recall",
    domain: "Memory",
    taskType: "story_recall",
    contentSource: "item_bank",
    expectedDurationSec: 120,
    content,
    itemBankId: "story-1",
  };
}

describe("CognitiveAssessmentRunnerPage response builder", () => {
  it("adds idea-unit scoring fields to story recall responses", () => {
    const response = buildResponseData(storyTask({
      title: "Elaine's Window Curtain",
      idea_units: [
        "subject_elaine",
        "main_object_window_curtain",
        "action_clipped",
        "location_kitchen",
      ],
    }), {
      text: "Elaine clipped the window curtain.",
      storyReadComplete: true,
    });

    expect(response).toMatchObject({
      text: "Elaine clipped the window curtain.",
      title: "Elaine's Window Curtain",
      delayed: false,
      scoring_method: "idea_unit_match",
      idea_units_recalled: 3,
      recalled_idea_units: [
        "subject_elaine",
        "main_object_window_curtain",
        "action_clipped",
      ],
      total_idea_units: 4,
      score: 3,
      max_score: 4,
    });
  });

  it("keeps word-count fallback when story idea units are unusable", () => {
    const response = buildResponseData(storyTask({
      title: "Opaque story",
      idea_units: ["object", "main"],
    }), {
      text: "A few remembered fragments.",
      storyReadComplete: true,
    });

    expect(response).toMatchObject({
      word_count: 4,
      score: 1,
      idea_units_recalled: null,
      recalled_idea_units: [],
      total_idea_units: 2,
      scoring_method: "word_count_fallback",
    });
  });
});
