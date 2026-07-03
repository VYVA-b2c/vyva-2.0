import { describe, expect, it } from "vitest";
import { parseBulkUploadJson, validateBulkUploadItems } from "../../shared/contentBulkUpload";

const reviewOptions = {
  skipAdminReview: true,
  reviewedAt: "2026-07-04T12:00:00.000Z",
  reviewedBy: "admin@example.com",
};

describe("content bulk upload validation", () => {
  it("accepts valid CC story recall rows and maps them to cc_item_bank", () => {
    const preview = validateBulkUploadItems("cc_story_recall", "fr", [{
      title: "Le jardin",
      body: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone thirtytwo thirtythree thirtyfour thirtyfive thirtysix thirtyseven thirtyeight thirtynine forty fortyone",
      idea_units: ["garden", "morning"],
      word_count: 41,
      estimated_grade_level: 4,
    }], reviewOptions);

    expect(preview.invalidItems).toHaveLength(0);
    expect(preview.validItems).toHaveLength(1);
    expect(preview.validItems[0].table).toBe("cc_item_bank");
    expect(preview.validItems[0].row).toMatchObject({
      task_definition_id: "story_recall_immediate",
      language: "fr",
      difficulty_tier: 1,
      item_family_id: null,
      is_active: true,
      source: "human_written",
      reviewed_by: "admin@example.com",
    });
  });

  it("skips invalid CC similarities rows without blocking valid rows", () => {
    const preview = validateBulkUploadItems("cc_similarities", "pt", [
      {
        pair: ["maca", "banana"],
        abstract_answer_examples: ["frutas"],
        concrete_answer_examples: ["comida"],
        difficulty_tier: 2,
      },
      {
        pair: ["sol"],
        abstract_answer_examples: [],
        concrete_answer_examples: ["coisas"],
        difficulty_tier: 9,
      },
    ], { ...reviewOptions, skipAdminReview: false });

    expect(preview.validItems).toHaveLength(1);
    expect(preview.invalidItems).toHaveLength(1);
    expect(preview.validItems[0].row).toMatchObject({
      task_definition_id: "similarities",
      language: "pt",
      difficulty_tier: 2,
      is_active: false,
      source: "ai_generated",
      reviewed_at: null,
      reviewed_by: null,
    });
    expect(preview.invalidItems[0].reason).toContain("pair must be an array of exactly 2");
  });

  it("accepts common JSON wrapper shapes", () => {
    const rows = parseBulkUploadJson(JSON.stringify({ items: [{ fact_prompt: "A?", fact_answer: "B", category: "science" }] }));

    expect(rows).toHaveLength(1);
  });

  it("maps valid Scent Memory prompts to the existing scent table", () => {
    const preview = validateBulkUploadItems("scent_memory_prompts", "en", [{
      scent_name: "Coffee",
      scent_description: "A warm kitchen smell",
      guiding_question: "What morning does this bring to mind?",
      category: "home",
    }], reviewOptions);

    expect(preview.invalidItems).toHaveLength(0);
    expect(preview.validItems[0].table).toBe("scent_memory_prompts");
    expect(preview.validItems[0].row).toMatchObject({
      scent_name: "Coffee",
      language: "en",
      rejected: false,
      is_active: true,
      source: "human_written",
    });
  });
});
