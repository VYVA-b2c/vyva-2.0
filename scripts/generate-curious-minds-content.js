#!/usr/bin/env node

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const HOOKS_PER_CATEGORY = Number(process.env.HOOKS_PER_CATEGORY || 25);
const PROMPTS_PER_TYPE = Number(process.env.PROMPTS_PER_TYPE || 50);
const LANGUAGES = (process.env.LANGUAGES || "es,de,en").split(",").map((item) => item.trim()).filter(Boolean);
const DRY_RUN = process.env.DRY_RUN === "true";

const CATEGORIES = [
  "nature",
  "animals",
  "body",
  "weather",
  "food",
  "history",
  "everyday_objects",
  "science",
];

const PROMPT_TYPES = ["alternate_uses", "what_if", "connections"];

const LANGUAGE_LABELS = {
  es: "Spanish",
  de: "German",
  en: "English",
};

const CULTURAL_NOTES = {
  es: "Write for Spanish-speaking seniors, culturally natural for Spain - not a direct translation from English.",
  de: "Write for German-speaking seniors, culturally natural for Germany - not a direct translation from English.",
  en: "Write naturally in English for English-speaking seniors.",
};

const PROMPT_LANGUAGE_PATTERNS = {
  es: {
    alternateUses: "\"¿Cuántos usos distintos se te ocurren para [objeto], además de [uso obvio]?\"",
    whatIfStarter: "\"¿Y si...?\"",
    connections: "\"¿Qué tienen en común [cosa 1] y [cosa 2]?\"",
  },
  de: {
    alternateUses: "\"Wie viele verschiedene Verwendungsmöglichkeiten fallen dir für [Gegenstand] ein, außer [offensichtliche Verwendung]?\"",
    whatIfStarter: "\"Was wäre, wenn...?\"",
    connections: "\"Was haben [Ding 1] und [Ding 2] gemeinsam?\"",
  },
  en: {
    alternateUses: "\"How many different uses can you think of for a/an [object], besides [its obvious use]?\"",
    whatIfStarter: "\"What if...?\"",
    connections: "\"What do [thing 1] and [thing 2] have in common?\"",
  },
};

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

function normalizeJsonText(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseGeneratedItems(content) {
  const parsed = JSON.parse(normalizeJsonText(content));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.hooks)) return parsed.hooks;
  if (Array.isArray(parsed.prompts)) return parsed.prompts;
  throw new Error("OpenAI response did not contain a JSON array or an items array.");
}

async function callOpenAI(prompt, maxTokens) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = { error: { message: responseText } };
  }

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${payload.error?.message || response.statusText}`);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI response did not include choices[0].message.content.");

  return parseGeneratedItems(content);
}

async function generateHooksBatch(language, category, count = 10) {
  const languageLabel = LANGUAGE_LABELS[language] || language;
  const culturalNote = CULTURAL_NOTES[language] || CULTURAL_NOTES.en;

  const prompt = `Generate ${count} short "curiosity hook" facts in ${languageLabel} for a cognitive wellness app used by seniors aged 65+. ${culturalNote}

Category: ${category}

Each item needs:
- "fact_prompt": a short, warm, intriguing QUESTION that makes someone want to guess before knowing the answer.
- "fact_answer": a brief, warm, satisfying explanation (1-2 sentences, plain language, no jargon).

Rules:
- Never include anything distressing, medical, political, religious, or related to death, illness, or grief.
- Tone: warm, gently surprising, conversational - like a kind friend sharing something interesting, never quiz-show or academic.
- Facts must be genuinely true and verifiable.
- Avoid anything that could feel patronising to an intelligent older adult.

Respond ONLY with a JSON object, no markdown, no explanation:
{"items":[{"fact_prompt":"...","fact_answer":"..."}]}`;

  return callOpenAI(prompt, 2500);
}

async function generatePromptsBatch(language, promptType, count = 10) {
  const languageLabel = LANGUAGE_LABELS[language] || language;
  const culturalNote = CULTURAL_NOTES[language] || CULTURAL_NOTES.en;
  const patterns = PROMPT_LANGUAGE_PATTERNS[language] || PROMPT_LANGUAGE_PATTERNS.en;

  const typeInstructions = {
    alternate_uses: `Generate ${count} everyday objects, each phrased naturally in ${languageLabel} with this pattern: ${patterns.alternateUses} Pick objects that are common, tangible, and familiar to seniors (umbrella, spoon, newspaper, scarf, shoebox, blanket, etc.) - never abstract or technical objects.`,
    what_if: `Generate ${count} gentle, playful hypothetical questions in ${languageLabel} starting naturally like ${patterns.whatIfStarter}. Keep them light and imaginative - never dystopian, frightening, or about death/illness.`,
    connections: `Generate ${count} pairs of everyday things and ask naturally in ${languageLabel} with this pattern: ${patterns.connections} Pick pairs with a genuinely interesting, non-obvious connection.`,
  }[promptType];

  const prompt = `Generate divergent-thinking conversation prompts for a cognitive wellness app used by seniors 65+. ${culturalNote}

${typeInstructions}

Rules:
- Never include anything distressing, medical, political, religious, or related to death, illness, or grief.
- Tone: warm, gently curious, and conversational.
- Do not imply there is one correct or best answer.
- Avoid anything that could feel patronising to an intelligent older adult.

Respond ONLY with a JSON object, no markdown, no explanation:
{"items":[{"prompt_text":"...","topic":"..."}]}`;

  return callOpenAI(prompt, 3500);
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  if (DRY_RUN) {
    console.log(`[dry-run] ${table}: ${rows.length} rows`);
    console.log(JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase insert failed for ${table}: ${response.status} ${text}`);
  }
}

function cleanText(value) {
  return String(value || "").trim();
}

function buildHookRows(items, language, category) {
  return items
    .map((item) => ({
      fact_prompt: cleanText(item.fact_prompt),
      fact_answer: cleanText(item.fact_answer),
      category,
      language,
      source: "ai_generated",
      is_active: false,
    }))
    .filter((item) => item.fact_prompt && item.fact_answer);
}

function buildPromptRows(items, language, promptType) {
  return items
    .map((item) => ({
      prompt_type: promptType,
      prompt_text: cleanText(item.prompt_text),
      topic: cleanText(item.topic),
      language,
      source: "ai_generated",
      is_active: false,
    }))
    .filter((item) => item.prompt_text && item.topic);
}

async function main() {
  requireEnv("OPENAI_API_KEY", OPENAI_API_KEY);
  if (!DRY_RUN) {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  }

  console.log(`Generating Curious Minds drafts with ${OPENAI_MODEL}`);
  console.log(`Languages: ${LANGUAGES.join(", ")}`);

  for (const language of LANGUAGES) {
    for (const category of CATEGORIES) {
      console.log(`Generating hooks: ${language}/${category}`);
      const rows = buildHookRows(await generateHooksBatch(language, category, HOOKS_PER_CATEGORY), language, category);
      await insertRows("curious_minds_hooks", rows);
      console.log(`Inserted draft hooks: ${rows.length}`);
    }

    for (const promptType of PROMPT_TYPES) {
      console.log(`Generating prompts: ${language}/${promptType}`);
      const rows = buildPromptRows(await generatePromptsBatch(language, promptType, PROMPTS_PER_TYPE), language, promptType);
      await insertRows("curious_minds_prompts", rows);
      console.log(`Inserted draft prompts: ${rows.length}`);
    }
  }

  console.log("Curious Minds draft generation complete. All rows are inactive until reviewed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
