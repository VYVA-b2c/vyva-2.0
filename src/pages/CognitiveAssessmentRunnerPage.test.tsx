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
  // Scores are computed on the server (shared/cognitiveAssessmentScoring.ts).
  const scorerOwnedKeys = ["score", "max_score", "scoring_method", "idea_units_recalled", "longest_span_forward", "unique_responses"];

  it("sends raw story recall text without scoring it", () => {
    const response = buildResponseData(storyTask({
      title: "Elaine's Window Curtain",
      idea_units: ["subject_elaine", "main_object_window_curtain", "action_clipped", "location_kitchen"],
    }), {
      text: "Elaine clipped the window curtain.",
      storyReadComplete: true,
    });

    expect(response).toEqual({
      text: "Elaine clipped the window curtain.",
      word_count: 5,
      title: "Elaine's Window Curtain",
      delayed: false,
      no_recall: false,
    });
  });

  it("sends digit span trials only", () => {
    const response = buildResponseData(runnerTask("digit_span", {}), {
      forwardSpan: 4,
      backwardSpan: 3,
      digitTrials: [
        { direction: "forward", length: 4, sequence: "3-7-5-1", answer: "3751", expected: "3751", correct: true },
      ],
      digitComplete: true,
    });

    expect(response.trials).toHaveLength(1);
    for (const key of scorerOwnedKeys) expect(response).not.toHaveProperty(key);
  });

  it("sends clock hand placement for the server to compare with the target", () => {
    const response = buildResponseData(runnerTask("clock_drawing", { target_time: "10:11" }), {
      clockHour: "10",
      clockMinute: "11",
      text: "",
    });

    expect(response).toMatchObject({
      target_time: "10:11",
      placed_hour: 10,
      placed_minute: 11,
      placement_complete: true,
      input_method: "clock_hand_placement",
    });
    for (const key of scorerOwnedKeys) expect(response).not.toHaveProperty(key);
  });

  it("sends unanswered questionnaire items as null instead of zero", () => {
    const response = buildResponseData(runnerTask("mood_screen", {
      items: [{ id: "phq2_1", text: "a" }, { id: "phq2_2", text: "b" }],
    }), { answers: { phq2_1: "2" } });

    expect(response.answers).toEqual([{ id: "phq2_1", value: 2 }, { id: "phq2_2", value: null }]);
  });
});
