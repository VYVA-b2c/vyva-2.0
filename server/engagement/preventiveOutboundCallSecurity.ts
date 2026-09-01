import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { proactiveDescriptorSafeDeepInertClone } from "../../shared/engagement/proactiveEngagement.js";

export const PREVENTIVE_OUTBOUND_CALL_FLOW_ID = "health.preventive_check" as const;
export const PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION = "1.0.0" as const;
export const PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID = "daily_wellbeing_check" as const;
export const PREVENTIVE_OUTBOUND_CALL_CHANNEL = "voice_call" as const;
export const PREVENTIVE_OUTBOUND_CALL_TRIGGER_SOURCE = "outbound_call" as const;
export const PREVENTIVE_OUTBOUND_CALL_CONFIRMATION_TOKEN_HEADER = "x-vyva-preventive-call-token" as const;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
export const PREVENTIVE_OUTBOUND_CALL_PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
export const PREVENTIVE_OUTBOUND_CALL_TWILIO_CALL_SID_PATTERN = /^CA[a-fA-F0-9]{32}$/u;

export type PreventiveOutboundCallConfirmationToken = Readonly<{
  token: string;
  tokenDigest: string;
}>;

export function sha256Digest(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function generatePreventiveOutboundCallConfirmationToken(): PreventiveOutboundCallConfirmationToken {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenDigest: sha256Digest(token) };
}

export function parsePreventiveOutboundCallConfirmationToken(rawInput: unknown):
  | { ok: true; token: string; tokenDigest: string }
  | { ok: false; reason: "token_not_inert" | "token_invalid" } {
  let inert: unknown;
  try {
    inert = proactiveDescriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, reason: "token_not_inert" };
  }
  if (typeof inert !== "string" || !TOKEN_PATTERN.test(inert)) {
    return { ok: false, reason: "token_invalid" };
  }
  return { ok: true, token: inert, tokenDigest: sha256Digest(inert) };
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

export function normalizeE164Phone(rawInput: unknown):
  | { ok: true; phoneE164: string; phoneDigest: string; phoneLast4: string }
  | { ok: false; reason: "phone_not_inert" | "phone_invalid" } {
  let inert: unknown;
  try {
    inert = proactiveDescriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, reason: "phone_not_inert" };
  }
  if (typeof inert !== "string" ||
    inert !== inert.trim() ||
    /\s/u.test(inert) ||
    !E164_PATTERN.test(inert)) {
    return { ok: false, reason: "phone_invalid" };
  }
  return {
    ok: true,
    phoneE164: inert,
    phoneDigest: sha256Digest(inert),
    phoneLast4: inert.slice(-4),
  };
}

export function isSafeProviderReference(value: string | null | undefined): value is string {
  return typeof value === "string" &&
    value === value.trim() &&
    PREVENTIVE_OUTBOUND_CALL_PROVIDER_ID_PATTERN.test(value);
}

export function normalizePublicWebhookBaseUrl(rawInput: unknown):
  | { ok: true; baseUrl: string }
  | { ok: false; reason: "url_not_inert" | "url_invalid" } {
  let inert: unknown;
  try {
    inert = proactiveDescriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, reason: "url_not_inert" };
  }
  if (typeof inert !== "string" || inert !== inert.trim() || inert.length > 512) {
    return { ok: false, reason: "url_invalid" };
  }
  try {
    const parsed = new URL(inert);
    if (parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".localhost") ||
      parsed.hostname.endsWith(".local")) {
      return { ok: false, reason: "url_invalid" };
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
    parsed.search = "";
    return { ok: true, baseUrl: parsed.toString().replace(/\/$/u, "") };
  } catch {
    return { ok: false, reason: "url_invalid" };
  }
}

export const preventiveOutboundCallConfirmationBodySchema = z.object({
  providerConversationId: z.string()
    .min(1)
    .max(160)
    .regex(PREVENTIVE_OUTBOUND_CALL_PROVIDER_ID_PATTERN),
  twilioCallSid: z.string()
    .regex(PREVENTIVE_OUTBOUND_CALL_TWILIO_CALL_SID_PATTERN),
  confirmed: z.literal(true),
}).strict();

export type PreventiveOutboundCallConfirmationBody =
  z.infer<typeof preventiveOutboundCallConfirmationBodySchema>;
