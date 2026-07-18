import type { ConciergeProviderTaskStatus } from "./conciergeProviderReplies";
import {
  buildConciergeProviderReplyResolution,
  type ConciergeProviderReplyResolution,
} from "./conciergeProviderReplyResolution";

export const CONCIERGE_INBOUND_REPLY_MATCH_STATUSES = [
  "processing",
  "matched",
  "unmatched",
  "ignored",
  "failed",
] as const;

export type ConciergeInboundReplyMatchStatus = (typeof CONCIERGE_INBOUND_REPLY_MATCH_STATUSES)[number];

export type ConciergeInboundReplyClassification = {
  status: Extract<ConciergeProviderTaskStatus, "reply_received" | "action_needed">;
  reply: string;
  summary: string;
  actionNeeded: boolean;
  resolution: ConciergeProviderReplyResolution;
};

export type ConciergeInboundReplyCandidate = {
  id: string;
  userLabel: string;
  providerName: string;
  actionSummary: string;
  updatedAt: string | null;
};

export type ConciergeInboundReplyReviewItem = {
  id: string;
  senderEmail: string;
  subject: string;
  preview: string;
  receivedAt: string;
  matchReason: string | null;
  candidates: ConciergeInboundReplyCandidate[];
};

const ACTION_REQUEST_PATTERNS = [
  /\?/,
  /\b(?:please|kindly)\s+(?:send|provide|confirm|share|reply|complete|choose|tell)\b/i,
  /\b(?:can|could|would)\s+you\b/i,
  /\bwe\s+(?:still\s+)?need\b/i,
  /\blet\s+us\s+know\b/i,
  /\b(?:what|which|when|where|who|how)\b/i,
  /\bpor\s+favor\s+(?:env[ií]e|confirme|comparta|responda|complete|indique)\b/i,
  /\b(?:puede|podr[ií]a)\s+(?:usted\s+)?(?:enviar|confirmar|compartir|responder|indicar)\b/i,
  /\bnecesitamos\b/i,
  /\b(?:qu[eé]|cu[aá]l|cu[aá]ndo|d[oó]nde|qui[eé]n|c[oó]mo)\b/i,
  /\b(?:merci|veuillez)\s+(?:envoyer|confirmer|indiquer|r[eé]pondre)\b/i,
  /\b(?:pouvez-vous|nous\s+avons\s+besoin)\b/i,
  /\b(?:bitte)\s+(?:senden|best[aä]tigen|angeben|antworten)\b/i,
  /\b(?:k[oö]nnen\s+sie|wir\s+ben[oö]tigen)\b/i,
  /\b(?:per\s+favore)\s+(?:inviare|confermare|indicare|rispondere)\b/i,
  /\b(?:pu[oò]\s+inviare|abbiamo\s+bisogno)\b/i,
];

const QUOTED_REPLY_MARKERS = [
  /^-{2,}\s*original message\s*-{2,}$/i,
  /^on .+ wrote:$/i,
  /^el .+ escribi[oó]:$/i,
  /^le .+ a [eé]crit\s*:$/i,
  /^am .+ schrieb .+:$/i,
  /^il .+ ha scritto:$/i,
];

function compactWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeInboundEmailAddress(value: string | null | undefined): string {
  const trimmed = value?.trim().toLowerCase() ?? "";
  const angleAddress = trimmed.match(/<([^<>\s]+@[^<>\s]+)>/);
  return (angleAddress?.[1] ?? trimmed.replace(/^mailto:/, "")).trim();
}

export function plainTextFromInboundHtml(value: string | null | undefined): string {
  if (!value) return "";
  return compactWhitespace(value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"));
}

export function extractInboundReplyText(value: string | null | undefined): string {
  if (!value) return "";
  const kept: string[] = [];
  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (QUOTED_REPLY_MARKERS.some((pattern) => pattern.test(trimmed))) break;
    if (trimmed === "--") break;
    if (trimmed.startsWith(">")) continue;
    kept.push(line);
  }
  return compactWhitespace(kept.join("\n")).slice(0, 12_000);
}

export function classifyConciergeInboundReply(input: {
  text?: string | null;
  html?: string | null;
  subject?: string | null;
}): ConciergeInboundReplyClassification {
  const fallbackText = plainTextFromInboundHtml(input.html);
  const reply = extractInboundReplyText(input.text || fallbackText)
    || input.subject?.trim()
    || "Provider replied by email.";
  const resolution = buildConciergeProviderReplyResolution({
    reply,
    subject: input.subject,
    channel: "email",
  });
  const actionNeeded = resolution.primaryAction !== "mark_complete"
    || ACTION_REQUEST_PATTERNS.some((pattern) => pattern.test(reply));
  const summary = resolution.summary;
  return {
    status: actionNeeded ? "action_needed" : "reply_received",
    reply,
    summary,
    actionNeeded,
    resolution,
  };
}
