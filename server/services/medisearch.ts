import crypto from "node:crypto";

const MEDISEARCH_URL = "https://api.backend.medisearch.io/sse/medichat";

type MediSearchArticle = {
  title?: string;
  url?: string;
  authors?: string[];
  year?: string;
  tldr?: string;
  journal?: string;
};

export type MediSearchTriageContext = {
  answer: string;
  followups: string[];
  articles: MediSearchArticle[];
  conversationId: string;
};

type TriageWizardContext = {
  mode?: "with_vitals" | "without_vitals";
  vitalsScanCompleted?: boolean;
  vitals?: { bpm?: number | null; respiratoryRate?: number | null };
  quickAnswers?: Array<{ id: string; label: string; value: string; kind?: string }>;
};

export type MediSearchChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type MediSearchRequest = {
  symptomText?: string;
  conversation?: MediSearchChatMessage[];
  conversationId?: string;
  locale: string;
  wizard?: TriageWizardContext;
  timeoutMs?: number;
};

function languageName(locale: string) {
  const base = locale.split("-")[0].toLowerCase();
  const map: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    pt: "Portuguese",
    de: "German",
    it: "Italian",
  };
  return map[base] ?? "English";
}

function wizardContextLine(wizard?: TriageWizardContext) {
  if (!wizard) return "";
  const parts = [
    wizard.mode === "with_vitals" ? "User chose a vitals scan first." : null,
    wizard.mode === "without_vitals" ? "User skipped vitals scan." : null,
    typeof wizard.vitals?.bpm === "number" ? `Pulse estimate: ${wizard.vitals.bpm} bpm.` : null,
    typeof wizard.vitals?.respiratoryRate === "number" ? `Respiratory rate estimate: ${wizard.vitals.respiratoryRate} breaths/min.` : null,
    wizard.quickAnswers?.length
      ? `Tapped answers: ${wizard.quickAnswers.map((answer) => answer.label).join(", ")}.`
      : null,
  ].filter(Boolean);
  return parts.length ? ` Context: ${parts.join(" ")}` : "";
}

function cleanFollowups(items: unknown[]) {
  const seen = new Set<string>();
  const followups: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const text = item.replace(/\s+/g, " ").trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    followups.push(text);
    if (followups.length >= 3) break;
  }
  return followups;
}

export function buildMediSearchConversation({
  symptomText,
  conversation,
  wizard,
}: {
  symptomText?: string;
  conversation?: MediSearchChatMessage[];
  wizard?: TriageWizardContext;
}) {
  const sourceTurns = conversation?.length
    ? conversation
    : symptomText
      ? [{ role: "user" as const, content: symptomText }]
      : [];
  const turns: MediSearchChatMessage[] = [];

  for (const turn of sourceTurns) {
    if ((turn.role !== "user" && turn.role !== "assistant") || typeof turn.content !== "string") continue;
    const content = turn.content.replace(/\s+/g, " ").trim();
    if (!content) continue;
    if (turns.length === 0) {
      if (turn.role !== "user") continue;
      turns.push({ role: turn.role, content });
      continue;
    }
    const previous = turns[turns.length - 1];
    if (previous.role === turn.role) {
      previous.content = `${previous.content}\n${content}`;
    } else {
      turns.push({ role: turn.role, content });
    }
  }

  while (turns.length && turns[turns.length - 1].role !== "user") {
    turns.pop();
  }
  if (!turns.length) return [];

  return turns.map((turn, index) => {
    if (index !== 0) return turn.content;
    return `For an elderly symptom-check app, provide concise medical context and red flags to ask about. User symptom: ${turn.content}.${wizardContextLine(wizard)}`;
  });
}

export function parseMediSearchSsePayload(raw: string, conversationId: string): MediSearchTriageContext {
  const result: MediSearchTriageContext = { answer: "", followups: [], articles: [], conversationId };

  for (const block of raw.split(/\n\n+/)) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());

    for (const dataLine of dataLines) {
      if (!dataLine || dataLine === "[DONE]") continue;
      try {
        const payload = JSON.parse(dataLine) as {
          event?: string;
          data?: unknown;
        };
        if (payload.event === "llm_response" && typeof payload.data === "string") {
          result.answer += payload.data;
        } else if (payload.event === "followups" && Array.isArray(payload.data)) {
          result.followups = cleanFollowups(payload.data);
        } else if (payload.event === "articles" && Array.isArray(payload.data)) {
          result.articles = payload.data.filter((item): item is MediSearchArticle => typeof item === "object" && item !== null);
        } else if (payload.event === "error" && typeof payload.data === "string") {
          throw new Error(payload.data);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("error_")) throw err;
      }
    }
  }

  return result;
}

export async function getMediSearchTriageContext({
  symptomText,
  conversation,
  conversationId,
  locale,
  wizard,
  timeoutMs = 8000,
}: MediSearchRequest): Promise<MediSearchTriageContext | null> {
  const apiKey = process.env.MEDISEARCH_API_KEY ?? "";
  const medisearchConversation = buildMediSearchConversation({ symptomText, conversation, wizard });
  if (!apiKey || medisearchConversation.length === 0 || medisearchConversation[medisearchConversation.length - 1].length < 3) return null;
  const resolvedConversationId = typeof conversationId === "string" && conversationId.trim()
    ? conversationId.trim()
    : crypto.randomUUID();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(MEDISEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        conversation: medisearchConversation,
        key: apiKey,
        id: resolvedConversationId,
        settings: {
          language: languageName(locale),
          model_type: "standard",
          followup_count: 3,
          system_prompt:
            "Use simple language. Do not diagnose. Focus on red flags, safe follow-up questions, and when urgent care may be needed.",
          filters: {
            sources: ["internationalHealthGuidelines", "medicineGuidelines", "scientificArticles"],
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn("[medisearch] request failed", response.status);
      return null;
    }

    const raw = await response.text();
    const parsed = parseMediSearchSsePayload(raw, resolvedConversationId);
    if (!parsed.answer && parsed.followups.length === 0 && parsed.articles.length === 0) return null;
    return parsed;
  } catch (err) {
    console.warn("[medisearch] unavailable", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
