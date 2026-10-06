import type { Request, Response } from "express";
import OpenAI from "openai";
import {
  emptyDocumentHelpReading,
  normaliseDocumentHelpReading,
  type DocumentHelpReading,
} from "../../shared/documentHelpReading.js";
import { extractPdfText } from "./offers.js";

type ReaderKind = "insurance-letter" | "claim" | "government-form" | "call-email" | "not-sure";

const KIND_FOCUS: Record<ReaderKind, string> = {
  "insurance-letter": "The member wants to understand a letter or bill. Focus on who sent it, what it is about, amounts owed, and any date they must act by.",
  claim: "The member wants to claim money back or make a claim. Focus on amounts paid or reimbursable, the organisation to claim from, and any claim deadline.",
  "government-form": "The member needs to fill in a form. Focus on what the form is for, which office it goes to, the deadline, and which sections ask for information.",
  "call-email": "The member needs to contact an office about this document. Focus on who to contact, why, and any date to respond by.",
  "not-sure": "The member is not sure what this document is. Explain plainly what it is and whether it asks them to do anything.",
};

function readerLanguage(locale: unknown): string {
  const base = typeof locale === "string" ? locale.split("-")[0].toLowerCase() : "es";
  const names: Record<string, string> = {
    es: "Spanish",
    en: "English",
    de: "German",
    fr: "French",
    it: "Italian",
    pt: "Portuguese",
  };
  return names[base] ?? "Spanish";
}

function readerKind(value: unknown): ReaderKind {
  return typeof value === "string" && value in KIND_FOCUS ? value as ReaderKind : "not-sure";
}

export function buildDocumentHelpPrompt(locale: unknown, kind: unknown, today: Date = new Date()): string {
  const language = readerLanguage(locale);
  return [
    "You help an older adult understand a letter, bill, claim or form. Read only what is printed.",
    KIND_FOCUS[readerKind(kind)],
    `Write every human-readable value in ${language}, in short plain sentences without jargon. Today is ${today.toISOString().slice(0, 10)}.`,
    "Never invent anything. If something is not clearly printed, leave it out or use null. Never guess a year.",
    "Privacy: never copy account numbers, IBANs, card numbers, policy or member numbers, ID numbers, signatures, or personal addresses. Only report whether a reference number is present.",
    "Do not give legal, medical or financial advice. Describe what the document says and asks for.",
    "Return JSON only with this shape:",
    JSON.stringify({
      status: "read | unreadable",
      document_type_label: "short label, e.g. 'Insurance bill' or null",
      organization: "who sent it or null",
      summary: "2-3 plain sentences: what this is and what it asks, or null",
      dates: [{ label: "what the date is for", date: "YYYY-MM-DD or null if not a full date", text: "date exactly as printed", is_deadline: true, confidence: "high | medium | low" }],
      amounts: [{ label: "what the amount is", amount: 0, currency: "EUR", kind: "due | reimbursable | paid | other", confidence: "high | medium | low" }],
      requested_actions: ["what the document asks the reader to do"],
      terms: [{ term: "difficult word in the document", explanation: "one plain sentence" }],
      unclear: ["anything cut off, blurry, missing pages, or contradictory"],
      has_reference_number: false,
      confidence: "high | medium | low",
    }),
    "Use status 'unreadable' when the image is not a document or cannot be read. Keep at most 6 dates, 6 amounts, 5 actions, 5 terms.",
  ].join("\n");
}

export async function readDocumentHelpHandler(req: Request, res: Response) {
  const { image, locale = "es", kind } = (req.body ?? {}) as { image?: unknown; locale?: unknown; kind?: unknown };

  if (typeof image !== "string" || !image) {
    return res.status(400).json({ error: "image or PDF (base64 data URL) is required" });
  }
  const match = image.match(/^data:((?:image\/[a-zA-Z+.-]+)|application\/pdf);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "document must be an image or PDF base64 data URL" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[document-help/read] OPENAI_API_KEY not set");
    return res.json(emptyDocumentHelpReading("unavailable"));
  }

  const [, mimeType, base64Data] = match;
  try {
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = mimeType === "application/pdf"
      ? [{ type: "text", text: `Extracted PDF text:\n${await extractPdfText(base64Data)}` }]
      : [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: "high" } },
          { type: "text", text: "Read this document." },
        ];
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildDocumentHelpPrompt(locale, kind) },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 1100,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[document-help/read] Failed to parse model JSON");
      return res.json(emptyDocumentHelpReading("unreadable"));
    }
    const reading: DocumentHelpReading = normaliseDocumentHelpReading(parsed);
    return res.json(reading);
  } catch (err) {
    console.error("[document-help/read] Reader error:", err instanceof Error ? err.message : err);
    return res.json(emptyDocumentHelpReading("unavailable"));
  }
}
