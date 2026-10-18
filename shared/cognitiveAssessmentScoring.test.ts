import { describe, expect, it } from "vitest";
import {
  buildScoredResponseData,
  sameWord,
  scoreCognitiveTask,
  scoreSimilarityAnswer,
  scoreStoryRecallText,
  zonedNow,
  type CognitiveScoringContext,
} from "./cognitiveAssessmentScoring";

// Thursday 2026-10-08, 10:30 in Madrid (08:30 UTC).
const context: CognitiveScoringContext = {
  now: new Date("2026-10-08T08:30:00Z"),
  timezone: "Europe/Madrid",
  language: "en",
  profile: { countryCode: "ES", city: "Tarifa", region: "Andalucía" },
};

function score(taskId: string, content: Record<string, unknown>, response: Record<string, unknown>, scoringConfig = {}) {
  return scoreCognitiveTask({ taskId, content, response, scoringConfig, context });
}

const orientationForm = (items: Array<[string, string]>) => ({
  items: items.map(([prompt_key, expected]) => ({ prompt_key, expected })),
});

describe("orientation", () => {
  it("checks answers against the member's local date and profile, not just whether they were typed", () => {
    const content = orientationForm([
      ["what_year", "current_year_dynamic"],
      ["what_month", "current_month_dynamic"],
      ["what_day_of_week", "current_day_of_week_dynamic"],
      ["what_country", "user_profile_country"],
      ["what_city", "user_profile_city"],
    ]);
    const right = score("orientation", content, {
      items: [
        { prompt_key: "what_year", answer: "2026" },
        { prompt_key: "what_month", answer: "October" },
        { prompt_key: "what_day_of_week", answer: "thursday" },
        { prompt_key: "what_country", answer: "Spain" },
        { prompt_key: "what_city", answer: "tarifa" },
      ],
    });
    expect(right.score).toBe(5);
    expect(right.max_score).toBe(5);

    const wrong = score("orientation", content, {
      items: [
        { prompt_key: "what_year", answer: "1999" },
        { prompt_key: "what_month", answer: "Banana" },
        { prompt_key: "what_day_of_week", answer: "Monday" },
        { prompt_key: "what_country", answer: "France" },
        { prompt_key: "what_city", answer: "Madrid" },
      ],
    });
    expect(wrong.score).toBe(0);
  });

  it("accepts month and weekday names in all five languages", () => {
    const content = orientationForm([["what_month", "x"], ["what_day_of_week", "x"]]);
    for (const [month, day] of [["octubre", "jueves"], ["Oktober", "Donnerstag"], ["octobre", "jeudi"], ["outubro", "quinta-feira"]]) {
      const res = score("orientation", content, {
        items: [{ prompt_key: "what_month", answer: month }, { prompt_key: "what_day_of_week", answer: day }],
      });
      expect(res.score).toBe(2);
    }
  });

  it("uses the member's timezone for the day boundary", () => {
    // 23:30 UTC on Wednesday is already Thursday in Madrid.
    expect(zonedNow(new Date("2026-10-07T23:30:00Z"), "Europe/Madrid").weekday).toBe(4);
  });

  it("excludes items that cannot be checked instead of counting them", () => {
    const res = scoreCognitiveTask({
      taskId: "orientation",
      content: orientationForm([["what_year", "x"], ["what_home_type", "user_profile_home_type"], ["what_city", "user_profile_city"]]),
      response: { items: [{ prompt_key: "what_year", answer: "2026" }, { prompt_key: "what_home_type", answer: "flat" }, { prompt_key: "what_city", answer: "Cadiz" }] },
      scoringConfig: {},
      context: { ...context, profile: { countryCode: "ES" } },
    });
    expect(res.score).toBe(1);
    expect(res.max_score).toBe(1);
    expect(res.flags).toEqual(expect.arrayContaining([
      "unscorable:what_home_type:no_reference_data",
      "unscorable:what_city:profile_city_missing",
    ]));
  });

  it("honours a fixed country on the form and southern-hemisphere seasons", () => {
    const fixed = score("orientation", orientationForm([["what_country", "de"]]), {
      items: [{ prompt_key: "what_country", answer: "Deutschland" }],
    });
    expect(fixed.score).toBe(1);

    const southern = scoreCognitiveTask({
      taskId: "orientation",
      content: orientationForm([["what_season", "current_season_dynamic"]]),
      response: { items: [{ prompt_key: "what_season", answer: "spring" }] },
      scoringConfig: {},
      context: { ...context, profile: { countryCode: "AR" } },
    });
    expect(southern.score).toBe(1);
  });
});

describe("story recall", () => {
  const legacyUnits = [
    "subject_hazel", "main_object_fruit_bowl", "action_arranged", "object_fruit", "color_blue", "object_bowl",
    "time_afternoon", "action_placed", "quantity_two", "object_oranges", "quantity_three", "object_plums",
    "color_green", "object_apple", "object_around", "object_edge", "action_set", "action_folded",
    "object_cloth", "action_moved", "location_table",
  ];

  it("collapses duplicated title units and drops function words in legacy slug lists", () => {
    const res = scoreStoryRecallText("", legacyUnits);
    // fruit/bowl collapse into main_object_fruit_bowl; "around" is a function word.
    expect(res.details.total_idea_units).toBe(legacyUnits.length - 3);
    expect(res.flags).toContain("legacy_idea_units");
    expect(res.needs_review).toBe(true);
  });

  it("matches inflected forms", () => {
    expect(sameWord("curtain", "curtains")).toBe(true);
    expect(sameWord("clip", "clipped")).toBe(true);
    expect(sameWord("set", "settle")).toBe(false);
    const res = scoreStoryRecallText("Hazel put orange slices and plum in a bowl", legacyUnits);
    expect(res.details.recalled_idea_units).toEqual(expect.arrayContaining(["object_oranges", "object_plums"]));
  });

  it("requires every key word of a proposition unit, with variants", () => {
    const units = [
      { id: "boats_in_basin", required: [["boat", "boats", "ship"], ["basin", "tub", "bowl"]] },
      { id: "blue_flag", required: [["blue"], ["flag"]] },
      { id: "patio", required: [["patio", "terrace"]] },
    ];
    expect(scoreStoryRecallText("toy ships in a tub on the terrace", units).score).toBe(2);
    // A single shared word no longer earns a unit.
    expect(scoreStoryRecallText("something blue", units).score).toBe(0);
    expect(scoreStoryRecallText("toy ships", units).scoring_method).toBe("idea_unit_propositions_v1");
  });

  it("returns null rather than a token score when there are no usable idea units", () => {
    const res = scoreStoryRecallText("lots of words here", ["object_still"]);
    expect(res.score).toBeNull();
  });

  it("scores no recall as zero", () => {
    expect(scoreStoryRecallText("", legacyUnits, true).score).toBe(0);
  });
});

describe("fluency", () => {
  it("phonemic: rejects words with the wrong letter and counts inflections as repetitions", () => {
    const res = score("fluency_phonemic", { letter: "F" }, { words: ["fish", "fishes", "frog", "apple", "f", "Fork"] });
    expect(res.score).toBe(3);
    expect(res.details.repetitions).toEqual(["fishes"]);
    expect(res.details.intrusions).toEqual(["apple", "f"]);
    expect(res.needs_review).toBe(false);
  });

  it("semantic without a validity list: counts unique words but holds for review", () => {
    const res = score("fluency_semantic", { category: "animals" }, { words: ["dog", "cat", "cats", "asdf"] });
    expect(res.score).toBe(3);
    expect(res.needs_review).toBe(true);
    expect(res.flags).toContain("no_validity_list");
  });

  it("semantic with a list rejects non-members", () => {
    const res = score("fluency_semantic", { category: "animals", acceptable_responses: ["dog", "cat", "horse"] }, { words: ["dog", "asdf", "horses"] });
    expect(res.score).toBe(2);
    expect(res.details.intrusions).toEqual(["asdf"]);
  });

  it("splits a voice transcript", () => {
    const res = score("fluency_phonemic", { letter: "S" }, { transcript: "sun, sock sand table" });
    expect(res.score).toBe(3);
  });
});

describe("digit span", () => {
  const content = {
    forward_trials: [{ length: 3, sequences: ["4-8-2", "6-1-9"] }, { length: 4, sequences: ["3-7-5-1"] }],
    backward_trials: [{ length: 2, sequences: ["2-4"] }, { length: 3, sequences: ["6-2-9"] }],
  };

  it("recomputes spans from the trials and ignores client claims", () => {
    const res = score("digit_span", content, {
      longest_span_forward: 9,
      trials: [
        { direction: "forward", sequence: "4-8-2", answer: "482", correct: true },
        { direction: "forward", sequence: "3-7-5-1", answer: "3751", correct: false },
        { direction: "backward", sequence: "2-4", answer: "42" },
        { direction: "backward", sequence: "6-2-9", answer: "629", correct: true },
      ],
    }, { forward_max_length: 9, backward_max_length: 8 });
    expect(res.details.longest_span_forward).toBe(4);
    expect(res.details.longest_span_backward).toBe(2);
    expect(res.score).toBe(6);
    expect(res.max_score).toBe(17);
  });

  it("ignores sequences that were never served", () => {
    const res = score("digit_span", content, { trials: [{ direction: "forward", sequence: "1-2-3-4-5-6-7-8-9", answer: "123456789" }] });
    expect(res.score).toBe(0);
    expect(res.flags).toContain("unserved_sequence_ignored");
  });
});

describe("similarities", () => {
  const appleOrange = {
    pair: ["apple", "orange"],
    abstract_answer_examples: ["They are both fruit.", "Both are foods."],
    concrete_answer_examples: ["You can eat both.", "They both grow on trees."],
  };

  it("applies 2 / 1 / 0 from the example lists", () => {
    expect(scoreSimilarityAnswer("fruits", appleOrange).points).toBe(2);
    expect(scoreSimilarityAnswer("you eat them", appleOrange).points).toBe(1);
    expect(scoreSimilarityAnswer("I don't know", appleOrange)).toMatchObject({ points: 0, needs_review: false });
  });

  it("holds an unmatched real answer for review instead of silently giving 0", () => {
    expect(scoreSimilarityAnswer("they are round", appleOrange)).toMatchObject({ points: 0, needs_review: true });
  });

  it("does not credit any non-empty text", () => {
    const res = score("similarities", {
      items: [{ id: "a", content: appleOrange }, { id: "b", content: { ...appleOrange, pair: ["cat", "dog"], abstract_answer_examples: ["animals"], concrete_answer_examples: ["fur"] } }],
    }, { responses: [{ item_bank_id: "a", answer: "fruit" }, { item_bank_id: "b", answer: "xyz" }] }, { max_score_per_item: 2 });
    expect(res.score).toBe(2);
    expect(res.max_score).toBe(4);
    expect(res.needs_review).toBe(true);
  });
});

describe("clock", () => {
  it("compares the hands with the target time", () => {
    expect(score("clock_drawing", { target_time: "10:11" }, { placed_hour: 10, placed_minute: 11 }).score).toBe(2);
    expect(score("clock_drawing", { target_time: "10:11" }, { placed_hour: 11, placed_minute: 10 }).score).toBe(0);
    expect(score("clock_drawing", { target_time: "2:45" }, { placed_hour: 2, placed_minute: 15 }).score).toBe(1);
  });

  it("leaves a voice description unscored", () => {
    const res = score("clock_drawing", { target_time: "3:40" }, { text: "twelve at the top, hands at three and eight" });
    expect(res.score).toBeNull();
    expect(res.needs_review).toBe(true);
  });
});

describe("questionnaires", () => {
  const phq2 = {
    items: [{ id: "phq2_1", text: "a" }, { id: "phq2_2", text: "b" }],
    scale: [0, 1, 2, 3].map((value) => ({ value, label: String(value) })),
  };

  it("flags a threshold only when the config cites a source", () => {
    const response = { answers: [{ id: "phq2_1", value: 2 }, { id: "phq2_2", value: 1 }] };
    const sourced = score("mood_screen", phq2, response, { instrument: "PHQ-2", threshold_flag: 3, threshold_source: "Kroenke 2003" });
    expect(sourced.score).toBe(3);
    expect(sourced.max_score).toBe(6);
    expect(sourced.flags).toContain("threshold_met");
    const unsourced = score("function_iadl", phq2, response, { instrument: "IADL_subset", threshold_flag: 3 });
    expect(unsourced.flags).not.toContain("threshold_met");
  });

  it("returns null when an answer is missing or off-scale", () => {
    const res = score("mood_screen", phq2, { answers: [{ id: "phq2_1", value: 2 }, { id: "phq2_2", value: 9 }] });
    expect(res.score).toBeNull();
  });
});

describe("buildScoredResponseData", () => {
  it("overwrites client-supplied scores with the scorer's", () => {
    const scoring = score("clock_drawing", { target_time: "10:11" }, { placed_hour: 1, placed_minute: 1, score: 99 });
    const data = buildScoredResponseData({ placed_hour: 1, placed_minute: 1, score: 99, max_score: 99 }, scoring);
    expect(data.score).toBe(0);
    expect(data.max_score).toBe(2);
    expect(data.scoring_version).toBe("cc_scoring_v2");
  });
});
