import { createECDH, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { proactiveDescriptorSafeDeepInertClone } from "../../shared/engagement/proactiveEngagement.js";

export const PREVENTIVE_WEB_PUSH_FLOW_ID = "health.preventive_check" as const;
export const PREVENTIVE_WEB_PUSH_FLOW_VERSION = "1.0.0" as const;
export const PREVENTIVE_WEB_PUSH_PURPOSE_ID = "daily_wellbeing_check" as const;
export const PREVENTIVE_WEB_PUSH_CHANNEL = "web_push" as const;
export const PREVENTIVE_WEB_PUSH_ALLOWED_ROUTE = "/health/check-in" as const;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const ENDPOINT_MAX_LENGTH = 2048;
const P256_PUBLIC_KEY_BYTES = 65;
const P256_UNCOMPRESSED_PREFIX = 0x04;
const WEB_PUSH_AUTH_BYTES = 16;
const VAPID_PRIVATE_KEY_BYTES = 32;

const ALLOWED_WEB_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
]);

const ALLOWED_WEB_PUSH_HOST_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com",
  ".wns.windows.com",
];

export type PreventiveWebPushSubscriptionInput = Readonly<{
  endpoint: string;
  expirationTime?: number | null;
  keys: Readonly<{
    p256dh: string;
    auth: string;
  }>;
  contentEncoding?: "aes128gcm";
  userAgent?: string;
}>;

export type NormalizedPreventiveWebPushSubscription = Readonly<{
  endpoint: string;
  endpointDigest: string;
  expirationTime: number | null;
  keys: Readonly<{
    p256dh: string;
    auth: string;
  }>;
  contentEncoding: "aes128gcm";
  userAgent: string | null;
}>;

export type PreventiveWebPushEntryToken = Readonly<{
  token: string;
  tokenDigest: string;
}>;

const subscriptionInputSchema = z.object({
  endpoint: z.string().min(1).max(ENDPOINT_MAX_LENGTH),
  expirationTime: z.number().int().min(0).nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(80).max(120),
    auth: z.string().min(16).max(40),
  }).strict(),
  contentEncoding: z.literal("aes128gcm").optional(),
  userAgent: z.string().min(1).max(512).optional(),
}).strict();

export type CanonicalBase64UrlDecodeResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; reason: "base64url_invalid" | "base64url_noncanonical" | "decoded_length_invalid" | "decoded_value_degenerate" };

function allBytesEqual(bytes: Buffer, value: number): boolean {
  return bytes.length > 0 && bytes.every((byte) => byte === value);
}

export function decodeCanonicalBase64Url(input: {
  value: string | undefined;
  minTextLength: number;
  maxTextLength: number;
  expectedDecodedLength?: number;
}): CanonicalBase64UrlDecodeResult {
  const value = input.value;
  if (!value ||
    value !== value.trim() ||
    /\s/u.test(value) ||
    value.length < input.minTextLength ||
    value.length > input.maxTextLength ||
    value.includes("=") ||
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1) {
    return { ok: false, reason: "base64url_invalid" };
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(value, "base64url");
  } catch {
    return { ok: false, reason: "base64url_invalid" };
  }
  if (Buffer.from(bytes).toString("base64url") !== value) {
    return { ok: false, reason: "base64url_noncanonical" };
  }
  if (input.expectedDecodedLength !== undefined && bytes.length !== input.expectedDecodedLength) {
    return { ok: false, reason: "decoded_length_invalid" };
  }
  if (allBytesEqual(bytes, 0)) {
    return { ok: false, reason: "decoded_value_degenerate" };
  }
  return { ok: true, bytes };
}

function isValidP256PublicPoint(bytes: Buffer): boolean {
  if (bytes.length !== P256_PUBLIC_KEY_BYTES || bytes[0] !== P256_UNCOMPRESSED_PREFIX) return false;
  try {
    const verifier = createECDH("prime256v1");
    verifier.generateKeys();
    verifier.computeSecret(bytes);
    return true;
  } catch {
    return false;
  }
}

export function isValidWebPushP256dh(value: string | undefined): value is string {
  const decoded = decodeCanonicalBase64Url({
    value,
    minTextLength: 80,
    maxTextLength: 120,
    expectedDecodedLength: P256_PUBLIC_KEY_BYTES,
  });
  return decoded.ok && isValidP256PublicPoint(decoded.bytes);
}

export function isValidWebPushAuthSecret(value: string | undefined): value is string {
  const decoded = decodeCanonicalBase64Url({
    value,
    minTextLength: 16,
    maxTextLength: 40,
    expectedDecodedLength: WEB_PUSH_AUTH_BYTES,
  });
  return decoded.ok;
}

export function isValidVapidPublicKeyMaterial(value: string | undefined): value is string {
  const decoded = decodeCanonicalBase64Url({
    value,
    minTextLength: 80,
    maxTextLength: 120,
    expectedDecodedLength: P256_PUBLIC_KEY_BYTES,
  });
  return decoded.ok && isValidP256PublicPoint(decoded.bytes);
}

export function isValidVapidPrivateKeyMaterial(value: string | undefined): value is string {
  const decoded = decodeCanonicalBase64Url({
    value,
    minTextLength: 32,
    maxTextLength: 64,
    expectedDecodedLength: VAPID_PRIVATE_KEY_BYTES,
  });
  if (!decoded.ok) return false;
  try {
    const verifier = createECDH("prime256v1");
    verifier.setPrivateKey(decoded.bytes);
    verifier.getPublicKey();
    return true;
  } catch {
    return false;
  }
}

export function isValidVapidKeyPair(input: {
  publicKey: string | undefined;
  privateKey: string | undefined;
}): boolean {
  const publicDecoded = decodeCanonicalBase64Url({
    value: input.publicKey,
    minTextLength: 80,
    maxTextLength: 120,
    expectedDecodedLength: P256_PUBLIC_KEY_BYTES,
  });
  const privateDecoded = decodeCanonicalBase64Url({
    value: input.privateKey,
    minTextLength: 32,
    maxTextLength: 64,
    expectedDecodedLength: VAPID_PRIVATE_KEY_BYTES,
  });
  if (!publicDecoded.ok || !privateDecoded.ok) return false;
  if (!isValidP256PublicPoint(publicDecoded.bytes)) return false;
  try {
    const verifier = createECDH("prime256v1");
    verifier.setPrivateKey(privateDecoded.bytes);
    const derived = verifier.getPublicKey();
    return derived.length === publicDecoded.bytes.length && timingSafeEqual(derived, publicDecoded.bytes);
  } catch {
    return false;
  }
}

export function sha256Digest(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function isAllowedWebPushEndpointHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (isIP(normalized) !== 0) return false;
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
    return false;
  }
  if (ALLOWED_WEB_PUSH_HOSTS.has(normalized)) return true;
  return ALLOWED_WEB_PUSH_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function isSafeWebPushEndpoint(endpoint: string): boolean {
  if (endpoint !== endpoint.trim()) return false;
  if (/\s/.test(endpoint) || endpoint.length > ENDPOINT_MAX_LENGTH) return false;
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password || parsed.hash) return false;
  if (parsed.port && parsed.port !== "443") return false;
  if (!isAllowedWebPushEndpointHost(parsed.hostname)) return false;
  return true;
}

export function normalizePreventiveWebPushSubscription(
  rawInput: unknown,
): { ok: true; subscription: NormalizedPreventiveWebPushSubscription } | { ok: false; reason: string } {
  let inert: unknown;
  try {
    inert = proactiveDescriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, reason: "subscription_not_inert" };
  }
  const parsed = subscriptionInputSchema.safeParse(inert);
  if (!parsed.success) return { ok: false, reason: "subscription_invalid_shape" };
  if (!isSafeWebPushEndpoint(parsed.data.endpoint)) {
    return { ok: false, reason: "subscription_endpoint_unsafe" };
  }
  if (!isValidWebPushP256dh(parsed.data.keys.p256dh)) {
    return { ok: false, reason: "subscription_p256dh_invalid" };
  }
  if (!isValidWebPushAuthSecret(parsed.data.keys.auth)) {
    return { ok: false, reason: "subscription_auth_invalid" };
  }
  return {
    ok: true,
    subscription: {
      endpoint: parsed.data.endpoint,
      endpointDigest: sha256Digest(parsed.data.endpoint),
      expirationTime: parsed.data.expirationTime ?? null,
      keys: {
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
      contentEncoding: "aes128gcm",
      userAgent: parsed.data.userAgent ?? null,
    },
  };
}

export function generatePreventiveWebPushEntryToken(): PreventiveWebPushEntryToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenDigest: sha256Digest(token),
  };
}

export function parsePreventiveWebPushEntryToken(rawInput: unknown):
  { ok: true; token: string; tokenDigest: string } | { ok: false; reason: string } {
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
