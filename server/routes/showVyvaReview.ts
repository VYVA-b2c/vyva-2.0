import type { Request, Response } from "express";
import OpenAI from "openai";
import { languageName, languageText, normalizeAppLanguage } from "../../shared/language.js";
import {
  SHOW_VYVA_USE_CASE_IDS,
  getShowVyvaUseCase,
  type ShowVyvaCaptureSource,
  type ShowVyvaUseCaseId,
} from "../../shared/showVyvaFlow.js";
import {
  buildShowVyvaReviewContract,
  type ShowVyvaReviewConfidenceLevel,
  type ShowVyvaReviewContract,
  type ShowVyvaReviewRiskLevel,
} from "../../shared/showVyvaReviewContract.js";

const VALID_USE_CASE_IDS = new Set<string>(Object.values(SHOW_VYVA_USE_CASE_IDS));
const VALID_SOURCES = new Set<ShowVyvaCaptureSource>(["camera", "upload"]);
const VALID_RISK_LEVELS = new Set<ShowVyvaReviewRiskLevel>(["low", "medium", "high", "unknown"]);
const VALID_CONFIDENCE_LEVELS = new Set<ShowVyvaReviewConfidenceLevel>(["low", "medium", "high"]);

type ShowVyvaReviewRequest = {
  image?: string;
  language?: string;
  useCaseId?: string;
  source?: string;
  question?: string;
  fileName?: string;
  mimeType?: string;
};

type ModelReview = {
  concernSummary?: unknown;
  riskLevel?: unknown;
  confidenceLevel?: unknown;
  verifiedObservations?: unknown;
  warningSigns?: unknown;
  unknowns?: unknown;
  safeNextSteps?: unknown;
};

const USE_CASE_GUIDANCE: Record<ShowVyvaUseCaseId, string> = {
  scam_check: [
    "Review for fraud or manipulation indicators without claiming an identity is genuine.",
    "Treat urgency, payment requests, credential requests, impersonation, suspicious links, and unusual contact details as possible warning signs.",
    "Never advise replying, paying, calling a supplied number, or opening a link.",
  ].join(" "),
  medicine_or_otc: [
    "Read only visible label details such as product name, strength, ingredients, warnings, expiry, and package condition.",
    "Do not diagnose, recommend a dose, change prescribed treatment, or claim the product is safe for this person.",
    "Direct medicine-specific questions to a pharmacist or clinician.",
  ].join(" "),
  document_help: [
    "Explain the visible purpose, dates, amounts, requested actions, contact details, and deadlines in plain language.",
    "Do not provide legal or financial advice and do not claim the document is authentic.",
    "Call out missing pages, unreadable text, unclear obligations, and anything requiring professional confirmation.",
  ].join(" "),
  provider_or_deal: [
    "Identify visible provider details, prices, inclusions, exclusions, dates, terms, and accessibility or coverage claims.",
    "Do not invent reputation, availability, distance, coverage, or a comparison score.",
    "Make clear which claims require an independent source or direct provider confirmation.",
  ].join(" "),
  health_or_home_photo: [
    "Describe only what is visibly present and use cautious, non-diagnostic language.",
    "Do not diagnose, prescribe, or declare a health or home situation safe.",
    "If the image suggests urgent danger, recommend immediate local help without overstating certainty.",
  ].join(" "),
};

function stringList(value: unknown, limit = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function text(value: unknown, fallback: string, maxLength = 240): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function parseImageDataUrl(image: string): { mimeType: string; dataUrl: string } | null {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (!match) return null;
  return { mimeType: match[1], dataUrl: image };
}

export function buildShowVyvaVisualReviewPrompt(input: {
  useCaseId: ShowVyvaUseCaseId;
  language: string;
  question?: string;
}): string {
  const useCase = getShowVyvaUseCase(input.useCaseId);
  const outputLanguage = languageName(normalizeAppLanguage(input.language, "en"));
  const question = input.question?.trim() || useCase.prompt;

  return `You are VYVA's visual evidence assistant for older adults. Review one image or the rendered first page of a document.

Purpose: ${useCase.label}.
User question: ${question}
Specific safety guidance: ${USE_CASE_GUIDANCE[input.useCaseId]}

Return valid JSON only with this exact shape:
{
  "concernSummary": "short neutral title",
  "riskLevel": "low | medium | high | unknown",
  "confidenceLevel": "low | medium | high",
  "verifiedObservations": ["facts directly visible or legible in the item"],
  "warningSigns": ["possible concern, clearly phrased as a warning rather than a fact"],
  "unknowns": ["important identity, authenticity, context, missing-page, image-quality, or external facts that cannot be confirmed"],
  "safeNextSteps": ["safe action that does not itself send, call, pay, book, upload externally, submit, or share"]
}

Rules:
- Separate observation from inference. Never place an inference in verifiedObservations.
- Do not identify a person from an image.
- Do not claim a sender, company, product, document, diagnosis, price, reputation, or service is genuine unless the image itself proves only that visible fact.
- Include at least one unknown unless the question truly has no material uncertainty.
- If text is unreadable or the item does not match the purpose, say so and use riskLevel "unknown" and confidenceLevel "low".
- Keep each list item concise and useful. Use no more than four items per list.
- Nothing in this review authorises an external action. The user confirms separately before anything is sent, called, bought, booked, uploaded externally, submitted, or shared.
- Write concernSummary and every list item in ${outputLanguage}. Keep riskLevel and confidenceLevel in English exactly as specified.`;
}

export function normaliseShowVyvaModelReview(input: {
  useCaseId: ShowVyvaUseCaseId;
  source: Extract<ShowVyvaCaptureSource, "camera" | "upload">;
  question?: string;
  fileName?: string;
  mimeType?: string;
  model: ModelReview;
}): ShowVyvaReviewContract {
  const useCase = getShowVyvaUseCase(input.useCaseId);
  const riskLevel = VALID_RISK_LEVELS.has(input.model.riskLevel as ShowVyvaReviewRiskLevel)
    ? input.model.riskLevel as ShowVyvaReviewRiskLevel
    : "unknown";
  const confidenceLevel = VALID_CONFIDENCE_LEVELS.has(input.model.confidenceLevel as ShowVyvaReviewConfidenceLevel)
    ? input.model.confidenceLevel as ShowVyvaReviewConfidenceLevel
    : "low";
  const verifiedObservations = stringList(input.model.verifiedObservations);
  const warningSigns = stringList(input.model.warningSigns);
  const unknowns = stringList(input.model.unknowns);
  const safeNextSteps = stringList(input.model.safeNextSteps);

  return buildShowVyvaReviewContract({
    useCaseId: input.useCaseId,
    source: input.source,
    fileName: input.fileName,
    mimeType: input.mimeType,
    concernSummary: text(input.model.concernSummary, useCase.label, 120),
    riskLevel,
    confidenceLevel,
    verifiedObservations,
    warningSigns,
    unknowns,
    noticed: [...verifiedObservations, ...warningSigns, ...unknowns],
    safeNextSteps,
  });
}

function fallbackContract(input: {
  useCaseId: ShowVyvaUseCaseId;
  source: Extract<ShowVyvaCaptureSource, "camera" | "upload">;
  language?: string;
  fileName?: string;
  mimeType?: string;
}): ShowVyvaReviewContract {
  const copy = languageText(input.language, {
    es: {
      title: "Revision no disponible",
      received: "VYVA recibio el elemento, pero no pudo completar la revision visual.",
      unknown: "No se pudieron confirmar el contenido, la autenticidad, el contexto ni el riesgo.",
      next: "Prueba otra vez con una imagen clara o pide a alguien de confianza que la revise.",
    },
    en: {
      title: "Review unavailable",
      received: "VYVA received the item but could not complete the visual review.",
      unknown: "The contents, authenticity, context, and risk could not be confirmed.",
      next: "Try again with a clear image, or ask a trusted person to review it.",
    },
    fr: {
      title: "Analyse indisponible",
      received: "VYVA a recu l'element, mais n'a pas pu terminer l'analyse visuelle.",
      unknown: "Le contenu, l'authenticite, le contexte et le risque n'ont pas pu etre confirmes.",
      next: "Reessayez avec une image nette ou demandez a une personne de confiance de la verifier.",
    },
    de: {
      title: "Prufung nicht verfugbar",
      received: "VYVA hat das Element erhalten, konnte die visuelle Prufung aber nicht abschliessen.",
      unknown: "Inhalt, Echtheit, Kontext und Risiko konnten nicht bestatigt werden.",
      next: "Versuchen Sie es mit einem klaren Bild erneut oder bitten Sie eine Vertrauensperson um Prufung.",
    },
    it: {
      title: "Revisione non disponibile",
      received: "VYVA ha ricevuto l'elemento ma non ha potuto completare la revisione visiva.",
      unknown: "Non e stato possibile confermare contenuto, autenticita, contesto e rischio.",
      next: "Riprova con un'immagine nitida o chiedi a una persona fidata di controllarla.",
    },
    pt: {
      title: "Revisao indisponivel",
      received: "A VYVA recebeu o item, mas nao conseguiu concluir a revisao visual.",
      unknown: "Nao foi possivel confirmar o conteudo, a autenticidade, o contexto ou o risco.",
      next: "Tente novamente com uma imagem nitida ou peca a uma pessoa de confianca para rever.",
    },
  });
  return buildShowVyvaReviewContract({
    ...input,
    concernSummary: copy.title,
    riskLevel: "unknown",
    confidenceLevel: "low",
    verifiedObservations: [copy.received],
    warningSigns: [],
    unknowns: [copy.unknown],
    safeNextSteps: [copy.next],
  });
}

export async function showVyvaReviewHandler(req: Request, res: Response) {
  const body = req.body as ShowVyvaReviewRequest;
  if (!body.image || typeof body.image !== "string") {
    return res.status(400).json({ error: "image is required" });
  }
  if (!body.useCaseId || !VALID_USE_CASE_IDS.has(body.useCaseId)) {
    return res.status(400).json({ error: "valid useCaseId is required" });
  }
  if (!body.source || !VALID_SOURCES.has(body.source as ShowVyvaCaptureSource)) {
    return res.status(400).json({ error: "source must be camera or upload" });
  }

  const image = parseImageDataUrl(body.image);
  if (!image) return res.status(400).json({ error: "image must be a base64 image data URL" });

  const useCaseId = body.useCaseId as ShowVyvaUseCaseId;
  const source = body.source as Extract<ShowVyvaCaptureSource, "camera" | "upload">;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.json({
      ...fallbackContract({ useCaseId, source, language: body.language, fileName: body.fileName, mimeType: body.mimeType }),
      isFallback: true,
    });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: buildShowVyvaVisualReviewPrompt({
            useCaseId,
            language: body.language ?? "en",
            question: body.question,
          }),
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image.dataUrl, detail: "high" } },
            { type: "text", text: "Review this item using the requested evidence structure." },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 900,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const model = JSON.parse(raw) as ModelReview;
    return res.json(normaliseShowVyvaModelReview({
      useCaseId,
      source,
      question: body.question,
      fileName: body.fileName,
      mimeType: body.mimeType,
      model,
    }));
  } catch (error) {
    console.error("[show-vyva-review] review failed", error instanceof Error ? error.message : "unknown error");
    return res.json({
      ...fallbackContract({ useCaseId, source, language: body.language, fileName: body.fileName, mimeType: body.mimeType }),
      isFallback: true,
    });
  }
}
