import { raw } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a medication data extraction assistant. Extract structured medication information from a user's spoken description.

Return a JSON object with these optional fields:
- name: medication name (string)
- dosage: dosage amount and unit like "500mg" (string)
- frequency: one of "once_daily", "twice_daily", "three_daily", "as_needed" — pick the closest match (string)
- times: time(s) to take it like "08:00" or "08:00, 20:00" (string)
- withFood: one of "with_food", "without_food", "doesnt_matter" (string)
- prescribedBy: prescriber name (string)

All fields are optional. Only include a field if the user mentioned it. Do not invent details. Return only valid JSON, no markdown.`;

interface ParsedMedication {
  name?: string;
  dosage?: string;
  frequency?: string;
  times?: string;
  withFood?: string;
  prescribedBy?: string;
}

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mpga": "mpga",
  "audio/m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export const medsVoiceTranscribeAudioBody = raw({ type: ["audio/*", "application/octet-stream"], limit: "8mb" });

function audioMimeType(req: Request) {
  const rawType = String(req.headers["content-type"] ?? "audio/webm").split(";")[0]?.trim().toLowerCase();
  return rawType && rawType !== "application/octet-stream" ? rawType : "audio/webm";
}

function audioFileNameFor(mimeType: string) {
  return `medication-voice.${AUDIO_EXTENSION_BY_MIME[mimeType] ?? "webm"}`;
}

function emptyResult(): ParsedMedication {
  return {};
}

export async function medsVoiceTranscribeHandler(req: Request, res: Response) {
  const audio = Buffer.isBuffer(req.body) ? req.body : null;
  if (!audio || audio.length < 32) {
    return res.status(400).json({ error: "audio is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return res.status(503).json({ error: "Voice transcription is not configured." });
  }

  try {
    const mimeType = audioMimeType(req);
    const client = new OpenAI({ apiKey });
    const file = await OpenAI.toFile(audio, audioFileNameFor(mimeType), { type: mimeType });
    const transcription = await client.audio.transcriptions.create({
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
      file,
      prompt: "Medication details for a medication list. Transcribe the user's words plainly, preserving medication names, dosage, frequency, timing, food instructions, and prescriber names.",
    });

    const transcript = transcription.text.trim();
    if (!transcript) return res.status(422).json({ error: "No speech detected." });
    return res.json({ transcript });
  } catch (err) {
    console.error("[meds-voice-transcribe] Error:", err);
    return res.status(500).json({ error: "Failed to transcribe medication voice input." });
  }
}

export async function medsVoiceParseHandler(req: Request, res: Response) {
  const { transcript } = req.body as { transcript?: string };

  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return res.status(400).json({ error: "transcript is required", ...emptyResult() });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[meds-voice-parse] OPENAI_API_KEY not set — returning empty result");
    return res.json(emptyResult());
  }

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript.trim() },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 256,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const result: ParsedMedication = {};
    if (typeof parsed.name === "string" && parsed.name.trim()) result.name = parsed.name.trim();
    if (typeof parsed.dosage === "string" && parsed.dosage.trim()) result.dosage = parsed.dosage.trim();
    if (typeof parsed.frequency === "string" && parsed.frequency.trim()) result.frequency = parsed.frequency.trim();
    if (typeof parsed.times === "string" && parsed.times.trim()) result.times = parsed.times.trim();
    if (typeof parsed.withFood === "string" && parsed.withFood.trim()) result.withFood = parsed.withFood.trim();
    if (typeof parsed.prescribedBy === "string" && parsed.prescribedBy.trim()) result.prescribedBy = parsed.prescribedBy.trim();

    return res.json(result);
  } catch (err) {
    console.error("[meds-voice-parse] Error:", err);
    return res.json(emptyResult());
  }
}
