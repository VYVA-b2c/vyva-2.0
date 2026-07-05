export const STORY_RECALL_MIN_SCORABLE_IDEA_UNITS = 3;

const GENERIC_IDEA_UNIT_TERMS = new Set([
  "action",
  "color",
  "colour",
  "einheit",
  "location",
  "main",
  "object",
  "quantity",
  "subject",
  "time",
  "unit",
  "unidad",
  "unite",
]);

export type StoryRecallScoringMethod = "idea_unit_match" | "word_count_fallback";

export type StoryRecallScoringFields = {
  word_count: number;
  score: number;
  max_score?: number;
  idea_units_recalled: number | null;
  recalled_idea_units: string[];
  total_idea_units: number;
  scoring_method: StoryRecallScoringMethod;
};

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function countStoryRecallWords(value: unknown) {
  const text = asText(value);
  if (!text) return 0;
  return text.split(/\s+/g).map((word) => word.trim()).filter(Boolean).length;
}

function normalizeForMatching(value: unknown) {
  return asText(value)
    .replace(/\u00df/g, "ss")
    .replace(/\u00e6/g, "ae")
    .replace(/\u0153/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokensFor(value: unknown) {
  const normalized = normalizeForMatching(value);
  return normalized ? normalized.split(/\s+/g).filter(Boolean) : [];
}

export function ideaUnitTerms(value: unknown) {
  return Array.from(new Set(
    tokensFor(String(value ?? "").replace(/[_-]+/g, " "))
      .filter((token) => token.length >= 3)
      .filter((token) => !/^\d+$/.test(token))
      .filter((token) => !GENERIC_IDEA_UNIT_TERMS.has(token)),
  ));
}

function ideaUnitList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asText(item)).filter(Boolean)
    : [];
}

export function buildStoryRecallScoringFields(
  recallText: unknown,
  ideaUnits: unknown,
): StoryRecallScoringFields {
  const wordCount = countStoryRecallWords(recallText);
  const units = ideaUnitList(ideaUnits);
  const scorableUnits = units
    .map((unit) => ({ unit, terms: ideaUnitTerms(unit) }))
    .filter((unit) => unit.terms.length > 0);

  if (scorableUnits.length < STORY_RECALL_MIN_SCORABLE_IDEA_UNITS) {
    return {
      word_count: wordCount,
      score: wordCount > 0 ? 1 : 0,
      idea_units_recalled: null,
      recalled_idea_units: [],
      total_idea_units: units.length,
      scoring_method: "word_count_fallback",
    };
  }

  const recalledTokens = new Set(tokensFor(recallText));
  const recalledUnits = scorableUnits
    .filter(({ terms }) => terms.some((term) => recalledTokens.has(term)))
    .map(({ unit }) => unit);

  return {
    word_count: wordCount,
    score: recalledUnits.length,
    max_score: units.length,
    idea_units_recalled: recalledUnits.length,
    recalled_idea_units: recalledUnits,
    total_idea_units: units.length,
    scoring_method: "idea_unit_match",
  };
}
