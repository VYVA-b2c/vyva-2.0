export const CONTENT_UPLOAD_LANGUAGES = ["es", "de", "en", "fr", "pt"] as const;

export const CONTENT_UPLOAD_TYPES = [
  "cc_story_recall",
  "cc_similarities",
] as const;

export const CONTENT_UPLOAD_TYPE_OPTIONS: Array<{ value: BulkUploadContentType; label: string }> = [
  { value: "cc_story_recall", label: "CC Story Recall" },
  { value: "cc_similarities", label: "CC Similarities" },
];

export type BulkUploadLanguage = typeof CONTENT_UPLOAD_LANGUAGES[number];
export type BulkUploadContentType = typeof CONTENT_UPLOAD_TYPES[number];

export type BulkUploadInsertTable =
  | "cc_item_bank";

export type BulkUploadInsertRow = Record<string, unknown>;

export type BulkUploadValidItem = {
  index: number;
  item: Record<string, unknown>;
  table: BulkUploadInsertTable;
  row: BulkUploadInsertRow;
};

export type BulkUploadInvalidItem = {
  index: number;
  reason: string;
};

export type BulkUploadPreview = {
  totalItems: number;
  validItems: BulkUploadValidItem[];
  invalidItems: BulkUploadInvalidItem[];
};

export type BulkUploadBuildOptions = {
  skipAdminReview: boolean;
  reviewedBy: string;
  reviewedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && value >= min && value <= max;
}

function extractItemsFromParsedJson(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!isRecord(parsed)) return [parsed];

  const wrapperKeys = ["items", "data", "records", "rows", "stories", "similarities", "hooks", "prompts"];
  for (const key of wrapperKeys) {
    if (Array.isArray(parsed[key])) return parsed[key] as unknown[];
  }

  return [parsed];
}

function reasonList(reasons: string[]): string {
  return reasons.join("; ");
}

function reviewFields(options: BulkUploadBuildOptions) {
  return {
    source: options.skipAdminReview ? "human_written" : "ai_generated",
    is_active: options.skipAdminReview,
    reviewed_at: options.skipAdminReview ? options.reviewedAt : null,
    reviewed_by: options.skipAdminReview ? options.reviewedBy : null,
  };
}

function validateCcStoryRecall(
  item: Record<string, unknown>,
  language: BulkUploadLanguage,
  options: BulkUploadBuildOptions,
): Omit<BulkUploadValidItem, "index"> | { reason: string } {
  const reasons: string[] = [];
  if (!nonEmptyString(item.title)) reasons.push("title must be a non-empty string");
  if (!nonEmptyString(item.body)) reasons.push("body must be a non-empty string");
  if (!Array.isArray(item.idea_units) || item.idea_units.length === 0) reasons.push("idea_units must be a non-empty array");
  if (!integerInRange(item.word_count, 40, 60)) reasons.push("word_count must be an integer between 40 and 60");
  if (!integerInRange(item.estimated_grade_level, 3, 5)) reasons.push("estimated_grade_level must be an integer between 3 and 5");
  if (reasons.length) return { reason: reasonList(reasons) };

  return {
    item,
    table: "cc_item_bank",
    row: {
      task_definition_id: "story_recall_immediate",
      language,
      difficulty_tier: 1,
      item_family_id: null,
      content: item,
      rejected: false,
      ...reviewFields(options),
    },
  };
}

function validateCcSimilarities(
  item: Record<string, unknown>,
  language: BulkUploadLanguage,
  options: BulkUploadBuildOptions,
): Omit<BulkUploadValidItem, "index"> | { reason: string } {
  const reasons: string[] = [];
  if (
    !Array.isArray(item.pair)
    || item.pair.length !== 2
    || !item.pair.every(nonEmptyString)
  ) {
    reasons.push("pair must be an array of exactly 2 non-empty strings");
  }
  if (!nonEmptyStringArray(item.abstract_answer_examples)) {
    reasons.push("abstract_answer_examples must be a non-empty array of strings");
  }
  if (!nonEmptyStringArray(item.concrete_answer_examples)) {
    reasons.push("concrete_answer_examples must be a non-empty array of strings");
  }
  if (!integerInRange(item.difficulty_tier, 1, 5)) {
    reasons.push("difficulty_tier must be an integer between 1 and 5");
  }
  if (reasons.length) return { reason: reasonList(reasons) };

  return {
    item,
    table: "cc_item_bank",
    row: {
      task_definition_id: "similarities",
      language,
      difficulty_tier: item.difficulty_tier,
      item_family_id: null,
      content: item,
      rejected: false,
      ...reviewFields(options),
    },
  };
}

export function parseBulkUploadJson(jsonText: string): unknown[] {
  const parsed = JSON.parse(jsonText) as unknown;
  return extractItemsFromParsedJson(parsed);
}

export function validateBulkUploadItems(
  contentType: BulkUploadContentType,
  language: BulkUploadLanguage,
  rawItems: unknown[],
  options: BulkUploadBuildOptions = {
    skipAdminReview: false,
    reviewedAt: "",
    reviewedBy: "",
  },
): BulkUploadPreview {
  const validItems: BulkUploadValidItem[] = [];
  const invalidItems: BulkUploadInvalidItem[] = [];

  rawItems.forEach((rawItem, index) => {
    if (!isRecord(rawItem)) {
      invalidItems.push({ index, reason: "item must be a JSON object" });
      return;
    }

    const result = contentType === "cc_story_recall"
      ? validateCcStoryRecall(rawItem, language, options)
      : validateCcSimilarities(rawItem, language, options);

    if ("reason" in result) {
      invalidItems.push({ index, reason: result.reason });
      return;
    }

    validItems.push({ ...result, index });
  });

  return {
    totalItems: rawItems.length,
    validItems,
    invalidItems,
  };
}
