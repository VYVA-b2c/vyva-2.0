import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type LiveChatRole = "user" | "assistant";

export interface LiveChatTurn {
  role: LiveChatRole;
  content: string;
}

export interface LiveChatRequestBody {
  message?: unknown;
  history?: unknown;
  locale?: unknown;
}

export interface LiveChatResult {
  reply: string;
  source: "live" | "fallback";
  provider?: "openai" | "anthropic";
  reason?: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 12;

function cleanText(value: unknown, maxLength = MAX_MESSAGE_LENGTH): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeLiveChatInput(body: LiveChatRequestBody) {
  const message = cleanText(body.message);
  const locale = cleanText(body.locale, 16).split("-")[0].toLowerCase() || "en";
  const history = Array.isArray(body.history)
    ? body.history
        .filter((turn): turn is LiveChatTurn => {
          const raw = turn as Partial<LiveChatTurn>;
          return (
            (raw.role === "user" || raw.role === "assistant") &&
            typeof raw.content === "string" &&
            raw.content.trim().length > 0
          );
        })
        .map((turn) => ({
          role: turn.role,
          content: turn.content.trim().slice(0, MAX_MESSAGE_LENGTH),
        }))
        .slice(-MAX_HISTORY_TURNS)
    : [];

  return { message, history, locale };
}

function languageInstruction(locale: string): string {
  const names: Record<string, string> = {
    de: "German",
    en: "English",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    pt: "Portuguese",
  };
  return names[locale] ?? "the user's language";
}

function buildSystemPrompt(locale: string) {
  return [
    `You are VYVA, a warm, calm companion for older adults. Reply entirely in ${languageInstruction(locale)}.`,
    "Keep answers short, friendly, and practical. Prefer 2 to 5 sentences unless the user asks for detail.",
    "Do not pretend you booked, bought, called, emailed, diagnosed, or verified anything unless the app explicitly provides that result.",
    "For health questions, give general information only. Do not diagnose. If symptoms sound urgent or dangerous, tell the user to contact local emergency services or a clinician now.",
    "If the user asks for help arranging something, say VYVA can help prepare the next step and will ask before contacting anyone.",
  ].join("\n");
}

function fallbackReply(message: string, locale: string): string {
  const lower = message.toLowerCase();
  if (locale === "es") {
    if (lower.includes("doctor") || lower.includes("medico")) {
      return "Puedo ayudarte a preparar el siguiente paso. Dime que necesitas y VYVA lo organizara para que confirmes antes de contactar a nadie.";
    }
    return "Estoy aqui contigo. Dime un poco mas y te ayudare a elegir el siguiente paso de forma sencilla.";
  }
  if (lower.includes("doctor") || lower.includes("appointment")) {
    return "I can help prepare the next step. Tell me what you need, and VYVA will keep it ready for you to confirm before anyone is contacted.";
  }
  return "I am here with you. Tell me a little more, and I will help you choose the next simple step.";
}

async function generateWithOpenAI(input: {
  message: string;
  history: LiveChatTurn[];
  locale: string;
  apiKey: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey: input.apiKey });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(input.locale) },
    ...input.history.map((turn) => ({ role: turn.role, content: turn.content }) as OpenAI.Chat.ChatCompletionMessageParam),
    { role: "user", content: input.message },
  ];
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
    temperature: 0.65,
    max_tokens: 450,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

async function generateWithAnthropic(input: {
  message: string;
  history: LiveChatTurn[];
  locale: string;
  apiKey: string;
}): Promise<string> {
  const client = new Anthropic({ apiKey: input.apiKey });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_CHAT_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
    system: buildSystemPrompt(input.locale),
    messages: [
      ...input.history,
      { role: "user" as const, content: input.message },
    ],
    temperature: 0.65,
    max_tokens: 450,
  });
  return response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();
}

export async function generateLiveChatReply(rawBody: LiveChatRequestBody): Promise<LiveChatResult> {
  const { message, history, locale } = normalizeLiveChatInput(rawBody);
  if (!message) {
    return { reply: fallbackReply("", locale), source: "fallback", reason: "missing_message" };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!openAiKey && !anthropicKey) {
    return {
      reply: fallbackReply(message, locale),
      source: "fallback",
      reason: "missing_ai_key",
    };
  }

  try {
    if (openAiKey) {
      const reply = await generateWithOpenAI({ message, history, locale, apiKey: openAiKey });
      if (reply) return { reply, source: "live", provider: "openai" };
    } else if (anthropicKey) {
      const reply = await generateWithAnthropic({ message, history, locale, apiKey: anthropicKey });
      if (reply) return { reply, source: "live", provider: "anthropic" };
    }
  } catch (error) {
    console.error("[live-chat] AI response failed", error);
    return { reply: fallbackReply(message, locale), source: "fallback", reason: "ai_error" };
  }

  return { reply: fallbackReply(message, locale), source: "fallback", reason: "empty_ai_response" };
}
