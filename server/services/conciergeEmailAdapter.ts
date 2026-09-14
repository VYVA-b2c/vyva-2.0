import { sendOperationalEmail, type SentEmailResult } from "../lib/email.js";
import { resolveEmailFromAddress } from "../lib/emailSenderConfig.js";
import { conciergeReplyAddressForPendingTask } from "./conciergeInboundEmailRouting.js";

const OWNED_EMAIL_ADAPTER_FLAGS = [
  "CONCIERGE_EMAIL_OWNED_ADAPTER_ENABLED",
  "CONCIERGE_EMAIL_INTERNAL_ADAPTER_ENABLED",
  "CONCIERGE_OWNED_EMAIL_ADAPTER_ENABLED",
];

const PILOT_RECIPIENT_ENV_KEYS = [
  "CONCIERGE_EMAIL_PILOT_RECIPIENTS",
  "CONCIERGE_EMAIL_PILOT_RECIPIENT",
  "CONCIERGE_EMAIL_PILOT_ALLOWLIST",
  "CONCIERGE_EMAIL_LIVE_ALLOWLIST",
];

function envValue(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function envFlag(keys: string[]): boolean {
  return keys.some((key) => {
    const value = envValue(key).toLowerCase();
    return value === "1" || value === "true" || value === "yes" || value === "ready" || value === "enabled";
  });
}

function splitRecipients(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function firstText(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(payload[key]);
    if (value) return value;
  }
  return null;
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isOwnedConciergeEmailAdapterEnabled(): boolean {
  return envFlag(OWNED_EMAIL_ADAPTER_FLAGS);
}

export function conciergeEmailPilotRecipients(): string[] {
  return Array.from(new Set(PILOT_RECIPIENT_ENV_KEYS.flatMap((key) => splitRecipients(envValue(key)))));
}

export function ownedConciergeEmailAdapterReference(): string | null {
  return isOwnedConciergeEmailAdapterEnabled()
    ? OWNED_EMAIL_ADAPTER_FLAGS.find((key) => envFlag([key])) ?? OWNED_EMAIL_ADAPTER_FLAGS[0]
    : null;
}

export function ownedConciergeEmailAdapterConfigured(): boolean {
  return Boolean(
    isOwnedConciergeEmailAdapterEnabled()
      && envValue("RESEND_API_KEY")
      && resolveEmailFromAddress({ allowDevelopmentFallback: false })
      && conciergeEmailPilotRecipients().length > 0,
  );
}

export function ownedConciergeEmailAdapterBlockers(): string[] {
  if (!isOwnedConciergeEmailAdapterEnabled()) return [];
  const blockers: string[] = [];
  if (!envValue("RESEND_API_KEY")) blockers.push("Resend API key is not configured.");
  if (!resolveEmailFromAddress({ allowDevelopmentFallback: false })) blockers.push("Email sender address is not configured.");
  if (conciergeEmailPilotRecipients().length === 0) blockers.push("Controlled pilot inbox allowlist is not configured.");
  return blockers;
}

export function conciergeEmailPilotRecipientBlocker(recipient: string | null | undefined): string | null {
  const normalized = recipient?.trim().toLowerCase() ?? "";
  if (!normalized) return "pilot_email_recipient_missing";
  const allowed = conciergeEmailPilotRecipients();
  if (!allowed.length) return "pilot_email_allowlist_missing";
  return allowed.includes(normalized) ? null : "pilot_email_recipient_not_allowlisted";
}

export function buildConciergePilotEmail(input: {
  payload?: Record<string, unknown> | null;
  providerName?: string | null;
  recipient: string;
  summary?: string | null;
  pendingId?: string | null;
  userId?: string | null;
}): { subject: string; text: string; html: string } {
  const payload = input.payload ?? {};
  const subject = firstText(payload, ["email_subject", "subject", "draft_subject"])
    ?? `VYVA Concierge: ${input.summary?.trim() || "request"}`;
  const body = firstText(payload, ["email_body", "message_body", "draft_body", "draft_message", "message", "body"])
    ?? input.summary?.trim()
    ?? "VYVA Concierge request.";
  const metadata = [
    `Provider: ${input.providerName?.trim() || "Pilot provider"}`,
    `Recipient: ${input.recipient}`,
    input.pendingId ? `Pending task: ${input.pendingId}` : null,
    input.userId ? `User: ${input.userId}` : null,
  ].filter(Boolean).join("\n");
  const footer = [
    "Sent by VYVA Concierge after explicit user confirmation.",
    "This pilot email is restricted to a team-controlled recipient allowlist.",
  ].join(" ");
  const textBody = [body, metadata, footer].filter(Boolean).join("\n\n");
  const htmlBody = textBody
    .split("\n\n")
    .map((paragraph) => `<p>${htmlEscape(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return {
    subject,
    text: textBody,
    html: `<!doctype html><html><body>${htmlBody}</body></html>`,
  };
}

export async function sendOwnedConciergeEmailAdapter(input: {
  payload?: Record<string, unknown> | null;
  providerName?: string | null;
  recipient: string;
  summary?: string | null;
  pendingId?: string | null;
  userId?: string | null;
}): Promise<SentEmailResult> {
  const email = buildConciergePilotEmail(input);
  return sendOperationalEmail({
    to: input.recipient,
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: conciergeReplyAddressForPendingTask(input.pendingId),
    debugLabel: "Concierge pilot",
    allowDevelopmentLog: false,
  });
}
