import crypto from "node:crypto";
import { normalizeInboundEmailAddress } from "../../shared/conciergeInboundReplies.js";

const REPLY_ADDRESS_ENV_KEYS = [
  "CONCIERGE_EMAIL_INBOUND_ADDRESS",
  "CONCIERGE_EMAIL_REPLY_ADDRESS",
] as const;

const REPLY_SECRET_ENV_KEYS = [
  "CONCIERGE_EMAIL_REPLY_SECRET",
  "RESEND_WEBHOOK_SECRET",
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstEnvironmentValue(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function routingSecret(): string | null {
  return firstEnvironmentValue(REPLY_SECRET_ENV_KEYS);
}

function routingAddress(): string | null {
  const value = normalizeInboundEmailAddress(firstEnvironmentValue(REPLY_ADDRESS_ENV_KEYS));
  return value.includes("@") ? value : null;
}

function taskSignature(pendingId: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`concierge-email-reply:${pendingId}`).digest("hex").slice(0, 24);
}

function signatureMatches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function conciergeInboundEmailRoutingConfigured(): boolean {
  return Boolean(routingAddress() && routingSecret());
}

export function conciergeReplyAddressForPendingTask(pendingId: string | null | undefined): string | null {
  if (!pendingId || !UUID_PATTERN.test(pendingId)) return null;
  const address = routingAddress();
  const secret = routingSecret();
  if (!address || !secret) return null;
  const [localPart, domain] = address.split("@");
  const baseLocalPart = localPart.split("+")[0];
  return `${baseLocalPart}+vyva.${pendingId}.${taskSignature(pendingId, secret)}@${domain}`;
}

export function pendingIdFromConciergeReplyRecipient(recipient: string | null | undefined): string | null {
  const address = normalizeInboundEmailAddress(recipient);
  const configuredAddress = routingAddress();
  const secret = routingSecret();
  if (!address || !configuredAddress || !secret) return null;

  const [configuredLocalPart, configuredDomain] = configuredAddress.split("@");
  const baseLocalPart = configuredLocalPart.split("+")[0].toLowerCase();
  const [localPart, domain] = address.split("@");
  if (domain !== configuredDomain.toLowerCase()) return null;

  const prefix = `${baseLocalPart}+vyva.`;
  if (!localPart.startsWith(prefix)) return null;
  const route = localPart.slice(prefix.length);
  const separator = route.lastIndexOf(".");
  if (separator < 0) return null;
  const pendingId = route.slice(0, separator);
  const signature = route.slice(separator + 1);
  if (!UUID_PATTERN.test(pendingId)) return null;
  return signatureMatches(signature, taskSignature(pendingId, secret)) ? pendingId : null;
}
