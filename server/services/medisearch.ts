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
};

type TriageWizardContext = {
  mode?: "with_vitals" | "without_vitals";
  vitalsScanCompleted?: boolean;
  vitals?: { bpm?: number | null; respiratoryRate?: number | null };
  quickAnswers?: Array<{ id: string; label: string; value: string; kind?: string }>;
};

type MediSearchRequest = {
  symptomText: string;
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

function parseSsePayload(raw: string): MediSearchTriageContext {
  const result: MediSearchTriageContext = { answer: "", followups: [], articles: [] };

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
          result.followups = payload.data.filter((item): item is string => typeof item === "string");
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
  locale,
  wizard,
  timeoutMs = 8000,
}: MediSearchRequest): Promise<MediSearchTriageContext | null> {
  const apiKey = process.env.MEDISEARCH_API_KEY ?? "";
  const cleanedSymptomText = symptomText.trim();
  if (!apiKey || cleanedSymptomText.length < 3) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(MEDISEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        conversation: [
          `For an elderly symptom-check app, provide concise medical context and red flags to ask about. User symptom: ${cleanedSymptomText}.${wizardContextLine(wizard)}`,
        ],
        key: apiKey,
        id: crypto.randomUUID(),
        settings: {
          language: languageName(locale),
          model_type: "standard",
          followup_count: 4,
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
    const parsed = parseSsePayload(raw);
    if (!parsed.answer && parsed.followups.length === 0 && parsed.articles.length === 0) return null;
    return parsed;
  } catch (err) {
    console.warn("[medisearch] unavailable", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
