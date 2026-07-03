export const CONTENT_UPLOAD_LANGUAGES = ["es", "de", "en", "fr", "pt"] as const;

export const CONTENT_UPLOAD_TYPES = [
  "cc_story_recall",
  "cc_similarities",
  "curious_minds_hooks",
  "curious_minds_prompts",
  "scent_memory_prompts",
] as const;

export const CONTENT_UPLOAD_TYPE_OPTIONS: Array<{ value: BulkUploadContentType; label: string }> = [
  { value: "cc_story_recall", label: "CC Story Recall" },
  { value: "cc_similarities", label: "CC Similarities" },
  { value: "curious_minds_hooks", label: "Curious Minds Hooks" },
  { value: "curious_minds_prompts", label: "Curious Minds Prompts" },
  { value: "scent_memory_prompts", label: "Scent Memory Prompts" },
];

export type BulkUploadLanguage = typeof CONTENT_UPLOAD_LANGUAGES[number];
export type BulkUploadContentType = typeof CONTENT_UPLOAD_TYPES[number];

export type BulkUploadInsertTable =
  | "cc_item_bank"
  | "curious_minds_hooks"
  | "curious_minds_prompts"
  | "scent_memory_prompts";

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

const CURIOUS_HOOK_CATEGORIES = [
  "nature",
  "animals",
  "body",
  "weather",
  "food",
  "history",
  "everyday_objects",
  "science",
] as const;

const CURIOUS_PROMPT_TYPES = ["alternate_uses", "what_if", "connections"] as const;
const SCENT_MEMORY_CATEGORIES = ["food", "nature", "home", "season", "place", "occasion"] as const;

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

function enumValue<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
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

function validateCuriousMindsHook(
  item: Record<string, unknown>,
  language: BulkUploadLanguage,
  options: BulkUploadBuildOptions,
): Omit<BulkUploadValidItem, "index"> | { reason: string } {
  const reasons: string[] = [];
  if (!nonEmptyString(item.fact_prompt)) reasons.push("fact_prompt must be a non-empty string");
  if (!nonEmptyString(item.fact_answer)) reasons.push("fact_answer must be a non-empty string");
  if (!enumValue(item.category, CURIOUS_HOOK_CATEGORIES)) {
    reasons.push(`category must be one of ${CURIOUS_HOOK_CATEGORIES.join(", ")}`);
  }
  if (reasons.length) return { reason: reasonList(reasons) };

  return {
    item,
    table: "curious_minds_hooks",
    row: {
      fact_prompt: String(item.fact_prompt).trim(),
      fact_answer: String(item.fact_answer).trim(),
      category: item.category,
      language,
      ...reviewFields(options),
    },
  };
}

function validateCuriousMindsPrompt(
  item: Record<string, unknown>,
  language: BulkUploadLanguage,
  options: BulkUploadBuildOptions,
): Omit<BulkUploadValidItem, "index"> | { reason: string } {
  const reasons: string[] = [];
  if (!enumValue(item.prompt_type, CURIOUS_PROMPT_TYPES)) {
    reasons.push(`prompt_type must be one of ${CURIOUS_PROMPT_TYPES.join(", ")}`);
  }
  if (!nonEmptyString(item.prompt_text)) reasons.push("prompt_text must be a non-empty string");
  if (!nonEmptyString(item.topic)) reasons.push("topic must be a non-empty string");
  if (reasons.length) return { reason: reasonList(reasons) };

  return {
    item,
    table: "curious_minds_prompts",
    row: {
      prompt_type: item.prompt_type,
      prompt_text: String(item.prompt_text).trim(),
      topic: String(item.topic).trim(),
      language,
      ...reviewFields(options),
    },
  };
}

function validateScentMemoryPrompt(
  item: Record<string, unknown>,
  language: BulkUploadLanguage,
  options: BulkUploadBuildOptions,
): Omit<BulkUploadValidItem, "index"> | { reason: string } {
  const reasons: string[] = [];
  if (!nonEmptyString(item.scent_name)) reasons.push("scent_name must be a non-empty string");
  if (!nonEmptyString(item.scent_description)) reasons.push("scent_description must be a non-empty string");
  if (!nonEmptyString(item.guiding_question)) reasons.push("guiding_question must be a non-empty string");
  if (!enumValue(item.category, SCENT_MEMORY_CATEGORIES)) {
    reasons.push(`category must be one of ${SCENT_MEMORY_CATEGORIES.join(", ")}`);
  }
  if (reasons.length) return { reason: reasonList(reasons) };

  return {
    item,
    table: "scent_memory_prompts",
    row: {
      scent_name: String(item.scent_name).trim(),
      scent_description: String(item.scent_description).trim(),
      guiding_question: String(item.guiding_question).trim(),
      category: item.category,
      language,
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
      : contentType === "cc_similarities"
        ? validateCcSimilarities(rawItem, language, options)
        : contentType === "curious_minds_hooks"
          ? validateCuriousMindsHook(rawItem, language, options)
          : contentType === "curious_minds_prompts"
            ? validateCuriousMindsPrompt(rawItem, language, options)
            : validateScentMemoryPrompt(rawItem, language, options);

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
