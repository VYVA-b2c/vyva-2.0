import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import * as lifecycleService from "../services/lifecycle.js";

const router = Router();

const publicEntryPointSchema = z.enum(["form", "phone", "whatsapp"]);
const userTypeSchema = z.enum(["elder", "family"]).default("elder");

const contactSchema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
});

const publicIntakeSchema = z.object({
  user_type: userTypeSchema,
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  organization_id: z.string().uuid().optional().nullable(),
  tier: z.string().trim().min(1).default("free"),
  source_payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  elder: contactSchema.optional(),
  family: contactSchema.optional(),
});

const twilioLikeSchema = z.object({
  From: z.string().optional(),
  Body: z.string().optional(),
  ProfileName: z.string().optional(),
  Caller: z.string().optional(),
  CallSid: z.string().optional(),
  MessageSid: z.string().optional(),
}).passthrough();

function publicBaseUrl(req: { protocol: string; get(name: string): string | undefined }) {
  return process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
}

function stripWhatsappPrefix(value?: string) {
  return value?.replace(/^whatsapp:/i, "").trim() ?? "";
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function inferNameFromPayload(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  return textValue(record.name)
    || textValue(record.full_name)
    || textValue(record.ProfileName)
    || textValue(record.caller_name)
    || fallback;
}

function inferPhoneFromPayload(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  return textValue(record.phone)
    || stripWhatsappPrefix(textValue(record.From))
    || textValue(record.Caller)
    || textValue(record.caller_phone)
    || textValue(record.phone_number);
}

function intakePayload(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const record = body as Record<string, unknown>;
  const nested = record.collected_data ?? record.collectedData ?? record.intake;
  if (nested && typeof nested === "object") {
    return {
      ...record,
      ...(nested as Record<string, unknown>),
      source_payload: {
        raw: record,
        collected_data: nested,
      },
    };
  }
  return body;
}

function normalizePublicIntake(entryPoint: "form" | "phone" | "whatsapp", body: unknown) {
  const payload = intakePayload(body);
  const parsed = publicIntakeSchema.safeParse(payload);
  const twilioLike = twilioLikeSchema.safeParse(payload);
  if (!parsed.success && !twilioLike.success) return { error: parsed.success ? undefined : parsed.error };

  const data = parsed.success
    ? parsed.data
    : {
      user_type: "elder" as const,
      name: inferNameFromPayload(payload, entryPoint === "phone" ? "Phone caller" : "WhatsApp contact"),
      phone: inferPhoneFromPayload(payload),
      email: "",
      tier: "free",
      source_payload: payload && typeof payload === "object" ? payload as Record<string, unknown> : {},
      metadata: {},
    };

  const family = data.family ?? { name: data.name, phone: data.phone, email: data.email };
  const isFamily = data.user_type === "family";
  const name = isFamily ? family.name : data.name;
  const phone = isFamily ? family.phone : data.phone;

  if (!name?.trim() || !phone?.trim()) {
    return { validationError: "Name and phone are required." };
  }

  return {
    intake: {
      name: name.trim(),
      phone: phone.trim(),
      email: isFamily ? family.email || undefined : data.email || undefined,
      user_type: data.user_type,
      entry_point: entryPoint,
      organization_id: data.organization_id ?? null,
      tier: data.tier,
      elder: isFamily ? data.elder : undefined,
      source_payload: {
        ...(data.source_payload ?? {}),
        raw: body && typeof body === "object" ? body : undefined,
      },
      metadata: data.metadata ?? {},
    },
  };
}

async function handlePublicIntake(entryPoint: "form" | "phone" | "whatsapp", req: Request, res: Response) {
  const normalized = normalizePublicIntake(entryPoint, req.body);
  if ("error" in normalized) return res.status(400).json({ error: normalized.error?.errors[0]?.message ?? "Invalid intake payload" });
  if ("validationError" in normalized) return res.status(400).json({ error: normalized.validationError });

  const result = await lifecycleService.createLifecycleIntake(normalized.intake);
  if ("error" in result) return res.status(400).json({ error: result.error });

  if (result.intake.user_type === "family") {
    const attempt = await lifecycleService.triggerConsentAttempt(result.intake.id);
    return res.status(201).json({
      intake: result.intake,
      next_action: "consent_queued",
      consent_attempt: attempt,
    });
  }

  const linkResult = await lifecycleService.sendIntakeLink(result.intake.id, publicBaseUrl(req));
  return res.status(201).json({
    intake: result.intake,
    next_action: "link_queued",
    access_link: linkResult?.link ?? null,
    communication: linkResult?.communication ?? null,
  });
}

router.post("/form", async (req, res) => {
  await handlePublicIntake("form", req, res);
});

router.post("/phone", async (req, res) => {
  await handlePublicIntake("phone", req, res);
});

router.post("/whatsapp", async (req, res) => {
  await handlePublicIntake("whatsapp", req, res);
});

export default router;
