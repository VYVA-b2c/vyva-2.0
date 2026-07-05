import { describe, expect, it } from "vitest";
import {
  buildStoryRecallScoringFields,
  ideaUnitTerms,
} from "./cognitiveStoryRecallScoring";

describe("cognitive story recall scoring", () => {
  it("derives meaningful terms from semantic idea-unit identifiers", () => {
    expect(ideaUnitTerms("main_object_window_curtain")).toEqual(["window", "curtain"]);
    expect(ideaUnitTerms("action_smoothed")).toEqual(["smoothed"]);
    expect(ideaUnitTerms("location_kitchen")).toEqual(["kitchen"]);
  });

  it("counts each recalled idea unit once from free text", () => {
    const result = buildStoryRecallScoringFields(
      "Elaine clipped the curtain. The curtain was white, white, white.",
      [
        "subject_elaine",
        "main_object_window_curtain",
        "action_clipped",
        "object_white",
        "location_kitchen",
      ],
    );

    expect(result).toMatchObject({
      scoring_method: "idea_unit_match",
      word_count: 10,
      score: 4,
      max_score: 5,
      idea_units_recalled: 4,
      total_idea_units: 5,
    });
    expect(result.recalled_idea_units).toEqual([
      "subject_elaine",
      "main_object_window_curtain",
      "action_clipped",
      "object_white",
    ]);
  });

  it("does not double-count repeated words for a single idea unit", () => {
    const result = buildStoryRecallScoringFields(
      "curtain curtain curtain",
      ["object_curtain", "object_stool", "object_window"],
    );

    expect(result.scoring_method).toBe("idea_unit_match");
    expect(result.idea_units_recalled).toBe(1);
    expect(result.recalled_idea_units).toEqual(["object_curtain"]);
  });

  it("falls back to word-count scoring when idea units are not scorable", () => {
    const result = buildStoryRecallScoringFields(
      "I remember a curtain and a kitchen.",
      ["object", "action_1", "main"],
    );

    expect(result).toMatchObject({
      scoring_method: "word_count_fallback",
      word_count: 7,
      score: 1,
      idea_units_recalled: null,
      recalled_idea_units: [],
      total_idea_units: 3,
    });
  });
});
