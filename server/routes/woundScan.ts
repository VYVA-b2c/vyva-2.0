import type { Request, Response } from "express";
import OpenAI from "openai";
import { desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { woundScans } from "../../shared/schema.js";
import { languageName, normalizeAppLanguage } from "../../shared/language.js";

const DEMO_USER_ID = "demo-user";

const IMAGE_TYPES = new Set([
  "xray",
  "wound_photo",
  "stool_image",
  "urine_image",
  "fluid_image",
  "bruise_photo",
  "skin_lesion",
  "other_medical_image",
  "unclear",
]);

type VisualScanImageType =
  | "xray"
  | "wound_photo"
  | "stool_image"
  | "urine_image"
  | "fluid_image"
  | "bruise_photo"
  | "skin_lesion"
  | "other_medical_image"
  | "unclear";

type VisualScanResult = {
  severity: "Minor" | "Moderate" | "Serious";
  resultTitle: string;
  advice: string;
  imageType: VisualScanImageType;
  visibleObservations: string[];
  potentialConcerns: string[];
  uncertainty: string[];
  recommendedNextStep: string;
  isFallback?: boolean;
};

function buildSystemPrompt(locale: string): string {
  const language = languageName(normalizeAppLanguage(locale, "en"));
  const translationInstruction =
    `\n- Translate ONLY resultTitle, advice, visibleObservations, potentialConcerns, uncertainty, and recommendedNextStep into ${language}. severity and imageType must remain in English exactly as specified.`;

  return `You are a compassionate medical image understanding assistant for older adults and their caregivers.
Your role is assistive description and triage support only. Describe visible findings; do not diagnose.

Respond in JSON with this exact structure:
{
  "severity": "<one of: Minor | Moderate | Serious>",
  "imageType": "<one of: xray | wound_photo | stool_image | urine_image | fluid_image | bruise_photo | skin_lesion | other_medical_image | unclear>",
  "resultTitle": "<short neutral title>",
  "visibleObservations": ["<plain visible observation>", "<plain visible observation>"],
  "potentialConcerns": ["<cautious concern to review, if any>"],
  "uncertainty": ["<image quality or clinical limitation>"],
  "recommendedNextStep": "<one clear next step using cautious language>",
  "advice": "<2-3 sentences combining the observations, concerns, limits, and next step in warm plain language>"
}

Guidelines:
- First classify the image type.
- Describe only visible findings. Do not state a diagnosis as fact.
- Do not say the image is definitely safe or unsafe.
- Do not prescribe treatment, antibiotics, medicines, or procedures.
- X-rays: describe visible structures or possible visible abnormalities only. Do not diagnose fractures or replace radiologist review.
- Wounds, bruises, and skin: describe visible redness, swelling, drainage, discoloration, wound edges, symmetry, or spread. Do not diagnose infection, cancer, or fracture.
- Stool, urine, and fluids: describe visible color, consistency, blood-like appearance, cloudiness, or unusual appearance. Do not diagnose gastrointestinal, urinary, or internal bleeding conditions.
- Escalate cautiously for visible severe bleeding, obvious deformity, rapidly spreading redness, black/tarry stool-like appearance, severe swelling, signs that may suggest infection, or poor image quality with concerning context.
- If concerning, say "may warrant prompt clinician review" or "if symptoms are severe or worsening, seek urgent medical attention."
- If unclear, imageType must be "unclear", severity "Minor" or "Moderate", and recommendedNextStep should ask for a clearer image or clinician review if symptoms are concerning.
- Do not include a disclaimer in the JSON; it is added separately by the application.
- Always respond ONLY with valid JSON, no extra text.${translationInstruction}`;
}

function fallbackResult(): VisualScanResult {
  return {
    severity: "Minor",
    imageType: "unclear",
    resultTitle: "Analysis Unavailable",
    visibleObservations: [],
    potentialConcerns: ["The image could not be reviewed right now."],
    uncertainty: ["The assistant could not complete the image review."],
    recommendedNextStep: "Please try again, or contact a healthcare professional if you are concerned.",
    advice:
      "We were unable to analyze the image right now. Please try again, or if you are concerned, contact a healthcare professional.",
    isFallback: true,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 4)
    : [];
}

function normalizeImageType(value: unknown): VisualScanImageType {
  return typeof value === "string" && IMAGE_TYPES.has(value) ? value as VisualScanImageType : "unclear";
}

export async function woundScanHandler(req: Request, res: Response) {
  const { image, language } = req.body as { image?: string; language?: string };

  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image (base64 data URL) is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[wound-scan] OPENAI_API_KEY not set - returning fallback");
    return res.json(fallbackResult());
  }

  const match = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "image must be a base64 data URL" });
  }
  const mimeType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const base64Data = match[2];

  const locale = typeof language === "string" ? language.split("-")[0].toLowerCase() : "en";
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildSystemPrompt(locale) },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: "Please classify and review this medical-looking image as an assistive visual health scan. Return only the requested JSON.",
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[wound-scan] Failed to parse OpenAI JSON:", raw);
      return res.json(fallbackResult());
    }

    const VALID_SEVERITIES = new Set(["Minor", "Moderate", "Serious"]);
    const rawSeverity = typeof parsed.severity === "string" ? parsed.severity : "";
    const severity = VALID_SEVERITIES.has(rawSeverity) ? rawSeverity as VisualScanResult["severity"] : "Minor";
    const imageType = normalizeImageType(parsed.imageType ?? parsed.image_type);
    const visibleObservations = stringList(parsed.visibleObservations ?? parsed.visible_observations);
    const potentialConcerns = stringList(parsed.potentialConcerns ?? parsed.potential_concerns);
    const uncertainty = stringList(parsed.uncertainty);
    const recommendedNextStep =
      typeof (parsed.recommendedNextStep ?? parsed.recommended_next_step) === "string"
        ? String(parsed.recommendedNextStep ?? parsed.recommended_next_step).trim()
        : "";
    const resultTitle =
      typeof parsed.resultTitle === "string" && parsed.resultTitle.trim()
        ? parsed.resultTitle.trim()
        : "Visual Health Scan";
    const advice =
      typeof parsed.advice === "string" && parsed.advice.trim()
        ? parsed.advice.trim()
        : recommendedNextStep || fallbackResult().advice;

    try {
      await db.insert(woundScans).values({
        user_id: userId,
        severity,
        result_title: resultTitle,
        advice,
        image_data: image,
      });
    } catch (dbErr) {
      console.error("[wound-scan] Failed to persist scan result:", dbErr);
    }

    return res.json({
      severity,
      resultTitle,
      advice,
      imageType,
      visibleObservations,
      potentialConcerns,
      uncertainty,
      recommendedNextStep,
    });
  } catch (err) {
    console.error("[wound-scan] OpenAI error:", err);
    return res.json(fallbackResult());
  }
}

export async function woundScanHistoryHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;
  try {
    const rows = await db
      .select()
      .from(woundScans)
      .where(eq(woundScans.user_id, userId))
      .orderBy(desc(woundScans.scanned_at))
      .limit(50);
    return res.json(rows);
  } catch (err) {
    console.error("[wound-scan] history fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch scan history" });
  }
}

export async function woundScanDeleteHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }
  try {
    const rows = await db
      .select({ user_id: woundScans.user_id })
      .from(woundScans)
      .where(eq(woundScans.id, id))
      .limit(1);
    if (!rows[0]) {
      return res.status(404).json({ error: "Not found" });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(woundScans).where(eq(woundScans.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("[wound-scan] delete error:", err);
    return res.status(500).json({ error: "Failed to delete scan" });
  }
}
