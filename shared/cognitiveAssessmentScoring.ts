// Single scoring module for Cognitive Compass task responses.
//
// The server calls scoreCognitiveTask() when a response is saved, for every input
// mode (wizard today, voice next), so scoring lives in exactly one place. It reads
// the task's scoring_config where that config is meaningful, and the content that
// was actually served for the step.
//
// Scientific-integrity rule: nothing here invents norms or cut-offs. Thresholds are
// only flagged when scoring_config carries a `threshold_source`. Where a response
// cannot be scored reliably the score is null (unscorable) or `needs_review` is set,
// rather than guessing.

export const COGNITIVE_SCORING_VERSION = "cc_scoring_v2";

export type ScoringLanguage = "en" | "es" | "de" | "fr" | "pt";

export type CognitiveScoringContext = {
  /** Moment the member answered. */
  now: Date;
  /** IANA timezone of the member. */
  timezone: string;
  language: ScoringLanguage;
  profile: {
    countryCode?: string | null;
    city?: string | null;
    region?: string | null;
  };
};

export type CognitiveScoringInput = {
  taskId: string;
  scoringConfig: Record<string, unknown>;
  /** Content served for this step (runner task content). */
  content: Record<string, unknown>;
  /** Raw response as submitted by the client. */
  response: Record<string, unknown>;
  context: CognitiveScoringContext;
};

export type CognitiveScoringResult = {
  /** null = this response cannot be scored (it is still saved). */
  score: number | null;
  max_score: number | null;
  scoring_method: string;
  scoring_version: string;
  needs_review: boolean;
  flags: string[];
  /** Task-specific fields, merged into response_data. */
  details: Record<string, unknown>;
};

const QUESTIONNAIRE_TASKS = new Set(["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"]);

// ---------------------------------------------------------------------------
// Small helpers

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Lowercase, strip accents and punctuation. "Größe!" -> "grosse". */
export function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(value: unknown) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Loose same-word test that tolerates inflection across the five languages
 * (curtain/curtains, clip/clipped, Blume/Blumen, flor/flores). Product rule, not a
 * linguistic stemmer: equal, a plain -s/-es plural, or a shared prefix of at
 * least 4 letters with the longer word adding at most 3 more letters.
 */
export function sameWord(a: string, b: string) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 3 && (long === `${short}s` || long === `${short}es`)) return true;
  if (short.length < 4) return false;
  return long.startsWith(short) && long.length - short.length <= 3;
}

function containsWord(tokens: string[], term: string) {
  return tokens.some((token) => sameWord(token, term));
}

// Function words and fillers in all five languages. Never count as content.
const STOPWORDS = new Set([
  // en
  "the", "and", "a", "an", "of", "to", "in", "on", "at", "for", "with", "by", "from", "into", "onto", "over",
  "under", "is", "was", "were", "are", "be", "been", "it", "its", "he", "she", "they", "them", "his", "her",
  "their", "i", "you", "we", "my", "your", "our", "this", "that", "these", "those", "then", "there", "here",
  "so", "but", "or", "as", "up", "down", "out", "off", "very", "just", "also", "both", "can", "could",
  "would", "should", "will", "had", "has", "have", "did", "do", "does", "not", "no", "yes", "some", "any",
  "one", "ones", "thing", "things", "something", "use", "used", "make", "made", "help", "helps", "still",
  "enough", "sure", "where", "when", "what", "which", "who", "how", "like", "other", "another", "each",
  "about", "around", "along", "through", "between", "until", "toward", "towards", "away", "below", "above",
  "inside", "outside", "again", "once", "more", "most", "much", "many", "little", "bit",
  // es
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "y", "e", "o", "u", "en", "con", "por",
  "para", "que", "es", "son", "fue", "era", "se", "su", "sus", "lo", "le", "les", "al", "ambos", "ambas",
  "pero", "como", "muy", "mas", "cosa", "cosas", "algo", "sirven", "sirve", "pueden", "puede",
  // de
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "und", "oder", "mit",
  "von", "zu", "im", "ist", "sind", "war", "sie", "er", "es", "beide", "beiden", "auch", "sehr", "ding",
  "dinge", "etwas", "kann", "koennen", "man",
  // fr
  "le", "les", "une", "des", "du", "et", "ou", "avec", "pour", "par", "dans", "sur", "est", "sont", "ils",
  "elles", "il", "elle", "tous", "deux", "chose", "choses", "peut", "peuvent", "tres", "aussi",
  // pt
  "o", "os", "as", "um", "uma", "uns", "umas", "do", "da", "dos", "das", "no", "na", "nos", "nas", "com",
  "para", "por", "sao", "foi", "ele", "ela", "eles", "elas", "ambos", "coisa", "coisas", "pode", "podem",
]);

function contentTerms(value: unknown, exclude: string[] = []) {
  return Array.from(new Set(
    tokenize(value)
      .filter((token) => token.length >= 3)
      .filter((token) => !/^\d+$/.test(token))
      .filter((token) => !STOPWORDS.has(token))
      .filter((token) => !exclude.some((word) => sameWord(word, token))),
  ));
}

const DONT_KNOW_PATTERNS = [
  /\b(i )?(do not|dont|don t) know\b/, /\bno idea\b/, /\bnot sure\b/, /\bpass\b/,
  /\bno se\b/, /\bni idea\b/, /\bweiss (ich )?nicht\b/, /\bkeine ahnung\b/,
  /\bje ne sais pas\b/, /\baucune idee\b/, /\bnao sei\b/,
];

function isDontKnow(text: string) {
  const normalized = normalizeText(text);
  return !normalized || DONT_KNOW_PATTERNS.some((pattern) => pattern.test(normalized));
}

function result(
  score: number | null,
  maxScore: number | null,
  method: string,
  details: Record<string, unknown>,
  flags: string[] = [],
  needsReview = false,
): CognitiveScoringResult {
  return {
    score,
    max_score: maxScore,
    scoring_method: method,
    scoring_version: COGNITIVE_SCORING_VERSION,
    needs_review: needsReview,
    flags,
    details,
  };
}

// ---------------------------------------------------------------------------
// Orientation

const MONTHS: Record<ScoringLanguage, string[]> = {
  en: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  de: ["januar", "februar", "maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"],
  fr: ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"],
  pt: ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
};
// "März" normalises to "marz"; accept both spellings.
const MONTH_ALIASES: Record<string, number> = { marz: 2, setiembre: 8, jaenner: 0, janner: 0 };

// Index 0 = Sunday, matching Date.getDay().
const WEEKDAYS: Record<ScoringLanguage, string[]> = {
  en: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
  es: ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  de: ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"],
  fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  pt: ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
};
const WEEKDAY_ALIASES: Record<string, number> = { sonnabend: 6 };

type Season = "spring" | "summer" | "autumn" | "winter";
const SEASON_WORDS: Record<Season, string[]> = {
  spring: ["spring", "primavera", "fruehling", "fruhling", "fruehjahr", "printemps"],
  summer: ["summer", "verano", "sommer", "ete", "verao"],
  autumn: ["autumn", "fall", "otono", "herbst", "automne", "outono"],
  winter: ["winter", "invierno", "hiver", "inverno"],
};
const SEASON_ORDER: Season[] = ["winter", "spring", "summer", "autumn"];

type DayPart = "morning" | "afternoon" | "evening" | "night";
const DAY_PART_WORDS: Record<DayPart, string[]> = {
  morning: ["morning", "manana", "morgen", "vormittag", "matin", "matinee", "manha"],
  afternoon: ["afternoon", "tarde", "nachmittag", "mittag", "apres midi", "apresmidi"],
  evening: ["evening", "noche", "abend", "soir", "soiree", "noite", "tarde noche"],
  night: ["night", "noche", "nacht", "nuit", "noite", "madrugada"],
};

// Southern-hemisphere countries where seasons are inverted.
const SOUTHERN_HEMISPHERE = new Set(["AR", "AU", "BO", "BR", "CL", "NZ", "PY", "PE", "UY", "ZA", "AO", "MZ", "NA"]);

const COUNTRY_NAMES: Record<string, string[]> = {
  ES: ["spain", "espana", "spanien", "espagne", "espanha"],
  DE: ["germany", "alemania", "deutschland", "allemagne", "alemanha"],
  FR: ["france", "francia", "frankreich", "franca"],
  PT: ["portugal"],
  GB: ["united kingdom", "uk", "britain", "great britain", "england", "scotland", "wales", "reino unido", "inglaterra", "grossbritannien", "england", "royaume uni", "angleterre"],
  IE: ["ireland", "irlanda", "irland", "irlande"],
  US: ["united states", "usa", "america", "estados unidos", "vereinigte staaten", "etats unis", "eua"],
  AT: ["austria", "oesterreich", "osterreich", "autriche"],
  CH: ["switzerland", "suiza", "schweiz", "suisse", "suica"],
  IT: ["italy", "italia", "italien", "italie"],
  NL: ["netherlands", "holland", "paises bajos", "holanda", "niederlande", "pays bas", "paises baixos"],
  BE: ["belgium", "belgica", "belgien", "belgique"],
  LU: ["luxembourg", "luxemburgo", "luxemburg"],
  MX: ["mexico", "mexiko", "mexique"],
  AR: ["argentina", "argentinien", "argentine"],
  BR: ["brazil", "brasil", "brasilien", "bresil"],
};

type ZonedNow = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

export function zonedNow(now: Date, timezone: string): ZonedNow {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return zonedNow(now, "UTC");
  }
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
    day: Number(get("day")),
    weekday: weekdayIndex,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
  };
}

function numbersIn(text: string) {
  return (text.match(/\d+/g) ?? []).map(Number);
}

function matchIndex(tokens: string[], lists: string[][], aliases: Record<string, number>) {
  const found = new Set<number>();
  for (const list of lists) {
    list.forEach((word, index) => {
      if (tokens.includes(word)) found.add(index);
    });
  }
  for (const [alias, index] of Object.entries(aliases)) {
    if (tokens.includes(alias)) found.add(index);
  }
  return found;
}

function seasonFor(month: number, day: number, southern: boolean): { season: Season; alsoAccepted: Season | null } {
  // Meteorological seasons (Dec–Feb winter in the north). In the first week of a
  // new season the previous one is also accepted, and in the last week of a season
  // the next one is — product rule.
  const northern: Season = month === 11 || month <= 1 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn";
  const index = (SEASON_ORDER.indexOf(northern) + (southern ? 2 : 0)) % 4;
  const season = SEASON_ORDER[index];
  const firstMonthOfSeason = [11, 2, 5, 8].includes(month);
  const lastMonthOfSeason = [1, 4, 7, 10].includes(month);
  const alsoAccepted = firstMonthOfSeason && day <= 7
    ? SEASON_ORDER[(index + 3) % 4]
    : lastMonthOfSeason && day >= 24
      ? SEASON_ORDER[(index + 1) % 4]
      : null;
  return { season, alsoAccepted };
}

function dayPartsFor(hour: number): DayPart[] {
  // Overlapping windows: answers near a boundary are accepted either way — product rule.
  const parts: DayPart[] = [];
  if (hour >= 5 && hour < 13) parts.push("morning");
  if (hour >= 12 && hour < 19) parts.push("afternoon");
  if (hour >= 18 && hour < 23) parts.push("evening");
  if (hour >= 21 || hour < 6) parts.push("night");
  return parts;
}

function placeMatches(answer: string, expected: string | null | undefined) {
  const want = normalizeText(expected);
  const got = normalizeText(answer);
  if (!want || !got) return false;
  return got === want || got.includes(want) || (want.length >= 4 && want.includes(got) && got.length >= 4);
}

type OrientationItemResult = {
  prompt_key: string;
  answer: string;
  status: "correct" | "incorrect" | "unscorable" | "no_answer";
  reason?: string;
};

function scoreOrientationItem(
  promptKey: string,
  expected: string,
  answer: string,
  context: CognitiveScoringContext,
  when: ZonedNow,
): OrientationItemResult {
  const base = { prompt_key: promptKey, answer };
  if (!normalizeText(answer)) return { ...base, status: "no_answer" };
  const tokens = tokenize(answer);
  const normalized = normalizeText(answer);
  const nums = numbersIn(normalized);
  const allLanguages = Object.keys(MONTHS) as ScoringLanguage[];
  const ok = (correct: boolean): OrientationItemResult => ({ ...base, status: correct ? "correct" : "incorrect" });
  const unscorable = (reason: string): OrientationItemResult => ({ ...base, status: "unscorable", reason });

  switch (promptKey) {
    case "what_year":
      return ok(nums.includes(when.year));
    case "what_month": {
      const named = matchIndex(tokens, allLanguages.map((lang) => MONTHS[lang]), MONTH_ALIASES);
      return ok(named.has(when.month) || (named.size === 0 && nums.includes(when.month + 1)));
    }
    case "what_day_of_week": {
      const named = matchIndex(tokens, allLanguages.map((lang) => WEEKDAYS[lang]), WEEKDAY_ALIASES);
      return ok(named.has(when.weekday));
    }
    case "what_date":
      return ok(nums.includes(when.day));
    case "what_season": {
      const southern = SOUTHERN_HEMISPHERE.has(String(context.profile.countryCode ?? "").toUpperCase());
      const { season, alsoAccepted } = seasonFor(when.month, when.day, southern);
      const said = (Object.keys(SEASON_WORDS) as Season[]).filter((key) => SEASON_WORDS[key].some((word) => tokens.includes(word)));
      return ok(said.includes(season) || (alsoAccepted !== null && said.includes(alsoAccepted)));
    }
    case "morning_or_afternoon": {
      const accepted = dayPartsFor(when.hour);
      const said = (Object.keys(DAY_PART_WORDS) as DayPart[]).filter((key) =>
        DAY_PART_WORDS[key].some((word) => (word.includes(" ") ? normalized.includes(word) : tokens.includes(word))));
      return ok(said.some((part) => accepted.includes(part)));
    }
    case "what_time_hour": {
      // "About what hour": ±1 hour, 12- or 24-hour clock.
      const candidates = nums.filter((value) => value >= 0 && value <= 24);
      const minutesNow = when.hour * 60 + when.minute;
      const close = candidates.some((value) => [value % 24, (value + 12) % 24].some((hour) => {
        const diff = Math.abs(hour * 60 - minutesNow);
        return Math.min(diff, 1440 - diff) <= 90;
      }));
      return ok(close);
    }
    case "what_country": {
      // Forms either name a fixed country ("es") or defer to the member's profile.
      const code = (/^[a-z]{2}$/i.test(expected) ? expected : String(context.profile.countryCode ?? "")).toUpperCase();
      const names = COUNTRY_NAMES[code];
      if (!names) return unscorable(code ? `no_country_names_for_${code}` : "profile_country_missing");
      return ok(names.some((name) => (name.includes(" ") ? normalized.includes(name) : tokens.includes(name))));
    }
    case "what_city":
      if (!normalizeText(context.profile.city)) return unscorable("profile_city_missing");
      return ok(placeMatches(answer, context.profile.city));
    case "what_region":
    case "what_bundesland":
    case "what_departement":
    case "what_distrito":
    case "what_concelho":
      if (!normalizeText(context.profile.region)) return unscorable("profile_region_missing");
      return ok(placeMatches(answer, context.profile.region));
    case "what_home_type":
      return unscorable("no_reference_data");
    default:
      return unscorable("unknown_prompt");
  }
}

function scoreOrientation(input: CognitiveScoringInput): CognitiveScoringResult {
  const when = zonedNow(input.context.now, input.context.timezone);
  const answers = new Map<string, string>();
  for (const item of asArray(input.response.items)) {
    const record = asRecord(item);
    answers.set(asText(record.prompt_key), asText(record.answer));
  }
  const items = asArray(input.content.items).map(asRecord).map((item) => {
    const promptKey = asText(item.prompt_key);
    return scoreOrientationItem(promptKey, asText(item.expected), answers.get(promptKey) ?? "", input.context, when);
  });
  const scorable = items.filter((item) => item.status !== "unscorable");
  const correct = scorable.filter((item) => item.status === "correct").length;
  const unscorable = items.filter((item) => item.status === "unscorable");
  return result(
    scorable.length ? correct : null,
    scorable.length || null,
    "orientation_checked_v1",
    { items, correct_count: correct, scorable_count: scorable.length },
    unscorable.map((item) => `unscorable:${item.prompt_key}:${item.reason}`),
  );
}

// ---------------------------------------------------------------------------
// Story recall (immediate and delayed)

/**
 * Proposition-format idea unit: every group in `required` must be present; each
 * group lists accepted variants. Example:
 *   { id: "boats_in_basin", text: "floated toy boats in a basin",
 *     required: [["boat", "boats", "ship"], ["basin", "tub", "bowl"]] }
 */
export type PropositionIdeaUnit = { id: string; text?: string; required: string[][] };

const LEGACY_PREFIXES = ["main_object_", "subject_", "object_", "action_", "location_", "time_", "quantity_", "color_"];

// Adverbs and filler verbs the July 2026 generator tagged as "objects".
const LEGACY_NON_IDEAS = new Set([
  "gently", "softly", "slightly", "carefully", "slowly", "firmly", "twice", "took", "saw", "said", "went",
  "came", "gave", "look", "let", "put", "check", "thank", "last", "first", "next", "nearby", "together",
]);

function legacyUnitTerms(unit: string) {
  const prefix = LEGACY_PREFIXES.find((candidate) => unit.startsWith(candidate)) ?? "";
  return contentTerms(unit.slice(prefix.length).replace(/[_-]+/g, " "))
    .filter((term) => !LEGACY_NON_IDEAS.has(term));
}

function parsePropositionUnits(value: unknown): PropositionIdeaUnit[] | null {
  const units = asArray(value);
  if (units.length === 0 || !units.every((unit) => unit && typeof unit === "object")) return null;
  const parsed = units.map(asRecord).map((unit, index) => ({
    id: asText(unit.id) || `unit_${index + 1}`,
    text: asText(unit.text) || undefined,
    required: asArray(unit.required)
      .map((group) => asArray(group).map((word) => normalizeText(word)).filter(Boolean))
      .filter((group) => group.length > 0),
  }));
  return parsed.every((unit) => unit.required.length > 0) ? parsed : null;
}

/**
 * Legacy slug units (e.g. "object_curtain") as generated in the July 2026 batch.
 * Function words are dropped, and per-word units already covered by the main
 * object (main_object_toy_boats + object_toy + object_boats) collapse into one.
 */
function legacyUnits(value: unknown): PropositionIdeaUnit[] {
  const slugs = asArray(value).map(asText).filter(Boolean);
  const mainTerms = slugs
    .filter((slug) => slug.startsWith("main_object_"))
    .flatMap(legacyUnitTerms);
  const units: PropositionIdeaUnit[] = [];
  for (const slug of slugs) {
    const terms = legacyUnitTerms(slug);
    if (terms.length === 0) continue;
    const isMain = slug.startsWith("main_object_");
    if (!isMain && terms.every((term) => mainTerms.includes(term))) continue;
    // A slug unit is recalled when any of its words is recalled.
    units.push({ id: slug, required: [terms] });
  }
  return units;
}

export function scoreStoryRecallText(recallText: unknown, ideaUnitsValue: unknown, noRecall = false) {
  const text = asText(recallText);
  const wordCount = tokenize(text).length;
  const propositions = parsePropositionUnits(ideaUnitsValue);
  const units = propositions ?? legacyUnits(ideaUnitsValue);
  const method = propositions ? "idea_unit_propositions_v1" : "idea_unit_legacy_slugs_v2";

  if (units.length < 3) {
    return result(null, null, "unscorable_no_idea_units", {
      word_count: wordCount,
      idea_units_recalled: null,
      recalled_idea_units: [],
      total_idea_units: units.length,
    }, ["idea_units_missing"], wordCount > 0);
  }

  const tokens = noRecall ? [] : tokenize(text).filter((token) => !STOPWORDS.has(token));
  const recalled = units.filter((unit) => unit.required.every((group) => group.some((word) => containsWord(tokens, word))));
  return result(
    recalled.length,
    units.length,
    method,
    {
      word_count: wordCount,
      idea_units_recalled: recalled.length,
      recalled_idea_units: recalled.map((unit) => unit.id),
      total_idea_units: units.length,
    },
    propositions ? [] : ["legacy_idea_units"],
    !propositions,
  );
}

function scoreStoryRecall(input: CognitiveScoringInput) {
  const text = asText(input.response.text) || asText(input.response.transcript);
  return scoreStoryRecallText(text, input.content.idea_units, Boolean(input.response.no_recall));
}

// ---------------------------------------------------------------------------
// Verbal fluency

function responseWords(response: Record<string, unknown>) {
  const listed = asArray(response.words).map(asText).filter(Boolean);
  if (listed.length) return listed;
  const text = asText(response.transcript) || asText(response.text);
  return text.split(/[\n,;]+|\s+/g).map((word) => word.trim()).filter(Boolean);
}

function scoreFluency(input: CognitiveScoringInput): CognitiveScoringResult {
  const words = responseWords(input.response);
  const letter = normalizeText(input.content.letter).slice(0, 1);
  const acceptable = asArray(input.content.acceptable_responses).map(normalizeText).filter(Boolean);
  const valid: string[] = [];
  const repetitions: string[] = [];
  const intrusions: string[] = [];

  for (const raw of words) {
    const word = normalizeText(raw);
    if (!/[a-z]/.test(word) || word.replace(/\s/g, "").length < 2) {
      intrusions.push(raw);
      continue;
    }
    if (letter && !word.startsWith(letter)) {
      intrusions.push(raw);
      continue;
    }
    if (acceptable.length && !acceptable.some((entry) => sameWord(entry, word))) {
      intrusions.push(raw);
      continue;
    }
    // Inflected forms of a word already given count as repetitions (product rule).
    if (valid.some((existing) => sameWord(normalizeText(existing), word))) {
      repetitions.push(raw);
      continue;
    }
    valid.push(raw);
  }

  const validated = Boolean(letter) || acceptable.length > 0;
  const flags: string[] = [];
  if (!validated) flags.push("no_validity_list");
  if (letter) flags.push("proper_nouns_not_checked");
  return result(
    valid.length,
    null,
    letter ? "phonemic_fluency_v1" : validated ? "semantic_fluency_listed_v1" : "semantic_fluency_unvalidated_v1",
    {
      words,
      unique_responses: valid,
      valid_count: valid.length,
      repetitions,
      intrusions,
      prompt: asText(input.content.letter) || asText(input.content.category),
    },
    flags,
    !validated,
  );
}

// ---------------------------------------------------------------------------
// Digit span

function digitsOf(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function scoreDigitSpan(input: CognitiveScoringInput): CognitiveScoringResult {
  const config = input.scoringConfig;
  const forwardMax = asNumber(config.forward_max_length) ?? 9;
  const backwardMax = asNumber(config.backward_max_length) ?? 8;
  const served = new Set(
    ["forward_trials", "backward_trials"].flatMap((key) =>
      asArray(input.content[key]).flatMap((trial) => asArray(asRecord(trial).sequences).map(digitsOf))),
  );

  const trials = asArray(input.response.trials ?? input.response.digitTrials).map(asRecord).map((trial) => {
    const direction = asText(trial.direction) === "backward" ? "backward" : "forward";
    const shown = digitsOf(trial.sequence);
    const expected = direction === "forward" ? shown : shown.split("").reverse().join("");
    const answer = digitsOf(trial.answer);
    return {
      direction,
      length: shown.length,
      sequence: asText(trial.sequence),
      answer,
      expected,
      correct: shown.length > 0 && answer === expected,
      served: served.has(shown),
    };
  });

  const longest = (direction: string) => trials
    .filter((trial) => trial.direction === direction && trial.correct && trial.served)
    .reduce((max, trial) => Math.max(max, trial.length), 0);
  const forward = longest("forward");
  const backward = longest("backward");
  const flags = trials.some((trial) => !trial.served) ? ["unserved_sequence_ignored"] : [];

  if (trials.length === 0) {
    return result(null, forwardMax + backwardMax, "digit_span_longest_v1", { trials }, ["no_trials"]);
  }
  return result(
    forward + backward,
    forwardMax + backwardMax,
    "digit_span_longest_v1",
    { trials, longest_span_forward: forward, longest_span_backward: backward },
    flags,
  );
}

// ---------------------------------------------------------------------------
// Similarities (2 = shared category/essential function, 1 = shared property, 0 = other)

const GENERIC_ANSWER_WORDS = new Set([
  "they", "both", "are", "can", "used", "use", "help", "helps", "things", "thing", "something", "common",
  "people", "person", "someone", "you", "your", "kind", "type", "sort", "way", "place", "small", "big",
]);

function exampleTerms(examples: unknown, pair: string[]) {
  return new Set(
    asArray(examples)
      .flatMap((example) => contentTerms(example, pair))
      .filter((term) => !GENERIC_ANSWER_WORDS.has(term)),
  );
}

export function scoreSimilarityAnswer(answer: string, itemContent: Record<string, unknown>) {
  const pair = asArray(itemContent.pair).map(normalizeText).flatMap((word) => word.split(" "));
  if (isDontKnow(answer)) return { points: 0, basis: "no_answer", needs_review: false };

  const rubric = asRecord(itemContent.scoring_rubric);
  const twoTerms = rubric.two ? new Set(asArray(rubric.two).map(normalizeText)) : exampleTerms(itemContent.abstract_answer_examples, pair);
  const oneTerms = rubric.one ? new Set(asArray(rubric.one).map(normalizeText)) : exampleTerms(itemContent.concrete_answer_examples, pair);
  // A term listed at both levels says nothing about the level.
  for (const term of Array.from(twoTerms)) {
    if (oneTerms.has(term)) {
      twoTerms.delete(term);
      oneTerms.delete(term);
    }
  }
  const tokens = tokenize(answer);
  if (Array.from(twoTerms).some((term) => containsWord(tokens, term))) return { points: 2, basis: "abstract_match", needs_review: false };
  if (Array.from(oneTerms).some((term) => containsWord(tokens, term))) return { points: 1, basis: "concrete_match", needs_review: false };
  // A real answer that matches neither list may still be right: hold for review.
  return { points: 0, basis: "unmatched", needs_review: true };
}

function scoreSimilarities(input: CognitiveScoringInput): CognitiveScoringResult {
  const answers = new Map<string, string>();
  for (const response of asArray(input.response.responses)) {
    const record = asRecord(response);
    answers.set(asText(record.item_bank_id), asText(record.answer));
  }
  const items = asArray(input.content.items).map(asRecord);
  const scored = items.map((item) => {
    const id = asText(item.id);
    const content = asRecord(item.content);
    const answer = answers.get(id) ?? "";
    return {
      item_bank_id: id,
      pair: asArray(content.pair).map(String),
      difficulty_tier: asNumber(item.difficultyTier ?? content.difficulty_tier),
      answer,
      ...scoreSimilarityAnswer(answer, content),
    };
  });
  const maxPerItem = asNumber(input.scoringConfig.max_score_per_item) ?? 2;
  const needsReview = scored.some((item) => item.needs_review);
  return result(
    scored.reduce((sum, item) => sum + item.points, 0),
    scored.length * maxPerItem,
    "similarities_example_match_v1",
    {
      responses: scored,
      answered_count: scored.filter((item) => item.basis !== "no_answer").length,
      unmatched_count: scored.filter((item) => item.needs_review).length,
    },
    needsReview ? ["unmatched_answers"] : [],
    needsReview,
  );
}

// ---------------------------------------------------------------------------
// Clock (wizard: setting hands to a target time)

function scoreClock(input: CognitiveScoringInput): CognitiveScoringResult {
  const target = asText(input.content.target_time);
  const match = target.match(/^(\d{1,2}):(\d{2})$/);
  const placedHour = asNumber(input.response.placed_hour ?? input.response.clockHour);
  const placedMinute = asNumber(input.response.placed_minute ?? input.response.clockMinute);
  const details = { target_time: target, placed_hour: placedHour, placed_minute: placedMinute };

  if (!match || placedHour === null || placedMinute === null) {
    // Voice descriptions of a clock have no validated scoring method.
    return result(null, null, "clock_unscored", details, [match ? "no_hand_placement" : "no_target_time"], Boolean(asText(input.response.text)));
  }
  const targetHour = Number(match[1]) % 12 || 12;
  const targetMinute = Number(match[2]);
  const hourCorrect = (placedHour % 12 || 12) === targetHour;
  const minuteCorrect = placedMinute === targetMinute;
  const score = Number(hourCorrect) + Number(minuteCorrect);
  return result(score, 2, "clock_setting_v1", {
    ...details,
    hour_correct: hourCorrect,
    minute_correct: minuteCorrect,
    clock_score: score,
  });
}

// ---------------------------------------------------------------------------
// Questionnaires (PHQ-2, sleep/energy, IADL subset, subjective concern)

function scoreQuestionnaire(input: CognitiveScoringInput): CognitiveScoringResult {
  const scale = asArray(input.content.scale).map(asRecord);
  const allowed = new Set(scale.map((entry) => asNumber(entry.value)).filter((value): value is number => value !== null));
  const maxValue = allowed.size ? Math.max(...allowed) : null;
  const items = asArray(input.content.items).map(asRecord);
  const given = new Map<string, number | null>();
  for (const answer of asArray(input.response.answers)) {
    const record = asRecord(answer);
    given.set(asText(record.id), asNumber(record.value));
  }

  const answers = items.map((item) => {
    const id = asText(item.id);
    const value = given.get(id) ?? null;
    const valid = value !== null && allowed.has(value);
    const label = scale.find((entry) => asNumber(entry.value) === value);
    return { id, text: asText(item.text), value: valid ? value : null, label: valid ? asText(label?.label) : "" };
  });
  const missing = answers.filter((answer) => answer.value === null);
  const instrument = asText(input.scoringConfig.instrument) || asText(input.content.instrument) || input.taskId;
  if (missing.length) {
    return result(null, null, `${instrument}_sum_v1`, { instrument, answers }, [`missing_answers:${missing.length}`]);
  }

  const score = answers.reduce((sum, answer) => sum + (answer.value ?? 0), 0);
  const flags: string[] = [];
  const threshold = asNumber(input.scoringConfig.threshold_flag);
  const thresholdSource = asText(input.scoringConfig.threshold_source);
  // Only sourced thresholds raise a flag.
  if (threshold !== null && thresholdSource && score >= threshold) flags.push("threshold_met");
  return result(
    score,
    maxValue === null ? null : maxValue * items.length,
    `${instrument}_sum_v1`,
    { instrument, answers, sum: score, ...(flags.length ? { threshold_source: thresholdSource } : {}) },
    flags,
  );
}

// ---------------------------------------------------------------------------

export function scoreCognitiveTask(input: CognitiveScoringInput): CognitiveScoringResult {
  const { taskId } = input;
  if (taskId === "orientation") return scoreOrientation(input);
  if (taskId === "story_recall_immediate" || taskId === "story_recall_delayed") return scoreStoryRecall(input);
  if (taskId === "fluency_semantic" || taskId === "fluency_phonemic") return scoreFluency(input);
  if (taskId === "digit_span") return scoreDigitSpan(input);
  if (taskId === "similarities") return scoreSimilarities(input);
  if (taskId === "clock_drawing") return scoreClock(input);
  if (QUESTIONNAIRE_TASKS.has(taskId)) return scoreQuestionnaire(input);
  return result(null, null, "unscored_unknown_task", {}, ["unknown_task"], true);
}

// Fields a client may send that only the scorer is allowed to set.
const SCORER_OWNED_KEYS = [
  "score", "max_score", "maxScore", "raw_score", "total_score", "correct_count", "sum", "clock_score",
  "idea_units_recalled", "recalled_idea_units", "total_idea_units", "scoring_method", "scoring_version",
  "longest_span_forward", "longest_span_backward", "unique_responses", "valid_responses", "needs_review",
  "scoring_flags", "threshold_source",
];

/** Raw client response + scoring result -> the response_data row to store. */
export function buildScoredResponseData(
  rawResponse: Record<string, unknown>,
  scoring: CognitiveScoringResult,
): Record<string, unknown> {
  const raw = { ...rawResponse };
  for (const key of SCORER_OWNED_KEYS) delete raw[key];
  return {
    ...raw,
    ...scoring.details,
    score: scoring.score,
    max_score: scoring.max_score,
    scoring_method: scoring.scoring_method,
    scoring_version: scoring.scoring_version,
    needs_review: scoring.needs_review,
    scoring_flags: scoring.flags,
  };
}
