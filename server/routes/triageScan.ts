import type { Request, Response } from "express";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import {
  isTriageScanConcernLevel,
  isTriageScanType,
  triageScanLabel,
  type TriageScanConcernLevel,
  type TriageScanResult,
  type TriageScanType,
} from "../../shared/triageScans.js";
import { languageName, normalizeAppLanguage } from "../../shared/language.js";

const PHOTO_SCAN_TYPES = new Set<TriageScanType>(["wound_photo", "urine_photo", "stool_photo"]);

function normalizedLocale(raw: unknown) {
  return normalizeAppLanguage(typeof raw === "string" ? raw : null, "en");
}

function parseImageDataUrl(raw: unknown): { mimeType: string; base64Data: string } | null {
  if (typeof raw !== "string") return null;
  const match = raw.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return null;
  const base64Data = match[2].replace(/\s/g, "");
  if (base64Data.length < 32 || base64Data.length > 12_000_000 || base64Data.length % 4 !== 0) return null;
  return { mimeType: match[1] === "image/jpg" ? "image/jpeg" : match[1], base64Data };
}

function buildPrompt(type: TriageScanType, locale: string) {
  const language = languageName(normalizeAppLanguage(locale, "en"));
  const translationInstruction =
    `\n- Write "summary" and each item in "findings" in ${language}. Keep "concernLevel" in English.`;

  const common = `You are a cautious medical image assistant inside an optional symptom triage flow for older adults.
Analyze only visible appearance. Do not diagnose disease.
Return JSON only with this exact shape:
{
  "concernLevel": "normal" | "watch" | "urgent",
  "summary": "<one short sentence, appearance-only>",
  "findings": ["<visible finding 1>", "<visible finding 2>"]
}

Safety:
- The scan may clarify or escalate triage, never downgrade emergency symptoms.
- If the image is unclear or irrelevant, use "watch", say the image is unclear, and suggest continuing with symptoms.
- Keep findings short and concrete.
- Do not include raw image data, personal identifiers, or a diagnosis.${translationInstruction}`;

  if (type === "wound_photo") {
    return `${common}

Wound or skin photo focus:
- Look for visible spreading redness, warmth-looking swelling, drainage/pus, red streaking, dark tissue, heavy bleeding, open wound edges, rash pattern, or bruising.
- Use "urgent" for visible pus/drainage with spreading redness, red streaking, dark tissue, heavy bleeding, or a large/deep-looking wound.
- Use "watch" for mild redness, swelling, bruising, rash, unclear view, or appearance that should be watched.`;
  }

  if (type === "urine_photo") {
    return `${common}

Urine appearance photo focus:
- Look only at visible color or cloudiness: red/pink/brown urine, very dark urine, cloudy urine, or unusual sediment.
- Do not diagnose UTI, kidney stones, dehydration, or bleeding from a photo.
- Use "urgent" only for clearly red/bloody or cola-brown urine appearance.
- Use "watch" for cloudiness, very dark yellow/amber urine, sediment, or unclear view.`;
  }

  return `${common}

Stool appearance photo focus:
- Look only at visible appearance: black/tarry-looking stool, red blood, maroon color, pale/grey stool, watery stool, mucus, or unusual color.
- Do not diagnose gastrointestinal bleeding, infection, or bowel disease from a photo.
- Use "urgent" for black/tarry-looking stool or obvious red/maroon blood.
- Use "watch" for pale/grey stool, mucus, very watery stool, unusual color, or unclear view.`;
}

function fallbackResult(type: TriageScanType, locale: string): TriageScanResult {
  const isSpanish = locale === "es";
  return {
    id: randomUUID(),
    type,
    label: triageScanLabel(type),
    concernLevel: "watch",
    summary: isSpanish
      ? "No se pudo analizar la foto ahora; continua con tus sintomas."
      : "The photo could not be analyzed right now; continue with your symptoms.",
    findings: [
      isSpanish
        ? "La foto no se guardo."
        : "The photo was not saved.",
    ],
    capturedAt: new Date().toISOString(),
  };
}

function parseConcern(raw: unknown): TriageScanConcernLevel {
  return isTriageScanConcernLevel(raw) ? raw : "watch";
}

function sanitizeFindings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export async function triageScanHandler(req: Request, res: Response) {
  const { type: rawType, image, locale: rawLocale } = req.body as {
    type?: unknown;
    image?: unknown;
    locale?: unknown;
    symptomId?: unknown;
  };

  if (!isTriageScanType(rawType) || !PHOTO_SCAN_TYPES.has(rawType)) {
    return res.status(400).json({ error: "type must be wound_photo, urine_photo, or stool_photo" });
  }

  const parsedImage = parseImageDataUrl(image);
  if (!parsedImage) {
    return res.status(400).json({ error: "image must be a valid base64 image data URL" });
  }

  const locale = normalizedLocale(rawLocale);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[triage-scan] OPENAI_API_KEY not set; returning non-persisted fallback");
    return res.json(fallbackResult(rawType, locale));
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildPrompt(rawType, locale) },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${parsedImage.mimeType};base64,${parsedImage.base64Data}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: "Analyze this optional triage scan. Return appearance-only JSON.",
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 350,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: { concernLevel?: unknown; summary?: unknown; findings?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[triage-scan] Failed to parse OpenAI JSON:", raw.slice(0, 200));
      return res.json(fallbackResult(rawType, locale));
    }

    const summary = typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : fallbackResult(rawType, locale).summary;

    const result: TriageScanResult = {
      id: randomUUID(),
      type: rawType,
      label: triageScanLabel(rawType),
      concernLevel: parseConcern(parsed.concernLevel),
      summary,
      findings: sanitizeFindings(parsed.findings),
      capturedAt: new Date().toISOString(),
    };

    return res.json(result);
  } catch (err) {
    console.error("[triage-scan] OpenAI error:", err);
    return res.json(fallbackResult(rawType, locale));
  }
}
