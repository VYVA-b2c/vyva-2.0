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

function runnerTask(id: string, content: Record<string, unknown>): CognitiveAssessmentRunnerTask {
  return {
    id,
    displayOrder: 1,
    label: id,
    domain: "Assessment",
    taskType: id,
    contentSource: "static",
    expectedDurationSec: 60,
    content,
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

  it("saves guided digit span trials with span totals", () => {
    const response = buildResponseData(runnerTask("digit_span", {}), {
      forwardSpan: 4,
      backwardSpan: 3,
      digitTrials: [
        { direction: "forward", length: 4, sequence: "3-7-5-1", answer: "3751", expected: "3751", correct: true },
      ],
      digitComplete: true,
    });

    expect(response).toMatchObject({
      longest_span_forward: 4,
      longest_span_backward: 3,
      scoring_method: "guided_digit_span",
      score: 7,
      max_score: 17,
    });
    expect(response.trials).toHaveLength(1);
  });

  it("saves clock hand placement without creating a clinical clock score", () => {
    const response = buildResponseData(runnerTask("clock_drawing", { target_time: "10:11" }), {
      clockHour: "10",
      clockMinute: "11",
      text: "",
    });

    expect(response).toMatchObject({
      text: "Placed clock hands at 10:11.",
      target_time: "10:11",
      placed_hour: 10,
      placed_minute: 11,
      placement_complete: true,
      input_method: "clock_hand_placement",
      score: 1,
    });
    expect(response).not.toHaveProperty("clock_score");
  });
});
