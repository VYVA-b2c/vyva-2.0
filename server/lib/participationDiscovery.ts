import OpenAI from "openai";
import type {
  AdminParticipationEvent,
  ParticipationEventFormat,
  ParticipationHelperAction,
} from "../../src/social/types.js";

type DiscoveryFormatPreference = ParticipationEventFormat | "any";

export type DiscoverParticipationInput = {
  city: string;
  countryCode?: string | null;
  locality?: string | null;
  postalCode?: string | null;
  radiusKm?: number | null;
  venueHints?: string[];
  languageCodes?: string[];
  interests?: string[];
  refinementTags?: string[];
  format?: DiscoveryFormatPreference;
  maxResults?: number;
};

export type DiscoveryRejectedCandidate = {
  title?: string;
  reason: string;
};

export type ParticipationDiscoveryResult = {
  candidates: AdminParticipationEvent[];
  rejected: DiscoveryRejectedCandidate[];
  query: {
    city: string;
    countryCode: string | null;
    locality: string | null;
    postalCode: string | null;
    radiusKm: number | null;
    venueHints: string[];
    languageCodes: string[];
    interests: string[];
    refinementTags: string[];
    format: DiscoveryFormatPreference;
    maxResults: number;
  };
  model: string;
  generatedAt: string;
};

export class ParticipationDiscoveryError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = "DISCOVERY_FAILED") {
    super(message);
    this.name = "ParticipationDiscoveryError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

type AiCandidate = {
  eventKey?: string;
  titleEn?: string;
  titleEs?: string;
  titleDe?: string;
  summaryEn?: string;
  summaryEs?: string;
  summaryDe?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  descriptionDe?: string;
  format?: string;
  locationLabel?: string;
  city?: string | null;
  locality?: string | null;
  countryCode?: string | null;
  timeLabelEn?: string;
  timeLabelEs?: string;
  timeLabelDe?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  costLabelEn?: string;
  costLabelEs?: string;
  costLabelDe?: string;
  languageCodes?: string[];
  tags?: string[];
  interestTags?: string[];
  accessibilityTags?: string[];
  helperActions?: string[];
  sourceUrl?: string | null;
  sourceTitle?: string;
  evidence?: string;
};

type AiDiscoveryResponse = {
  candidates?: AiCandidate[];
};

const SUPPORTED_LANGUAGES = ["en", "es", "de"];
const FORMAT_OPTIONS: ParticipationEventFormat[] = ["nearby", "online", "hybrid"];
const HELPER_ACTIONS: ParticipationHelperAction[] = ["check_details", "transport", "reminder", "bring_friend"];
const emptyCounts = { interested: 0, maybe: 0, not_for_me: 0 };

const candidateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "eventKey",
    "titleEn",
    "titleEs",
    "titleDe",
    "summaryEn",
    "summaryEs",
    "summaryDe",
    "descriptionEn",
    "descriptionEs",
    "descriptionDe",
    "format",
    "locationLabel",
    "city",
    "locality",
    "countryCode",
    "timeLabelEn",
    "timeLabelEs",
    "timeLabelDe",
    "startsAt",
    "endsAt",
    "costLabelEn",
    "costLabelEs",
    "costLabelDe",
    "languageCodes",
    "tags",
    "interestTags",
    "accessibilityTags",
    "helperActions",
    "sourceUrl",
    "sourceTitle",
    "evidence",
  ],
  properties: {
    eventKey: { type: "string", maxLength: 120 },
    titleEn: { type: "string", maxLength: 140 },
    titleEs: { type: "string", maxLength: 140 },
    titleDe: { type: "string", maxLength: 140 },
    summaryEn: { type: "string", maxLength: 260 },
    summaryEs: { type: "string", maxLength: 260 },
    summaryDe: { type: "string", maxLength: 260 },
    descriptionEn: { type: "string", maxLength: 600 },
    descriptionEs: { type: "string", maxLength: 600 },
    descriptionDe: { type: "string", maxLength: 600 },
    format: { type: "string", enum: FORMAT_OPTIONS },
    locationLabel: { type: "string", maxLength: 160 },
    city: { type: ["string", "null"], maxLength: 120 },
    locality: { type: ["string", "null"], maxLength: 120 },
    countryCode: { type: ["string", "null"], maxLength: 2 },
    timeLabelEn: { type: "string", maxLength: 120 },
    timeLabelEs: { type: "string", maxLength: 120 },
    timeLabelDe: { type: "string", maxLength: 120 },
    startsAt: { type: ["string", "null"] },
    endsAt: { type: ["string", "null"] },
    costLabelEn: { type: "string", maxLength: 120 },
    costLabelEs: { type: "string", maxLength: 120 },
    costLabelDe: { type: "string", maxLength: 120 },
    languageCodes: { type: "array", maxItems: 8, items: { type: "string", maxLength: 8 } },
    tags: { type: "array", maxItems: 16, items: { type: "string", maxLength: 60 } },
    interestTags: { type: "array", maxItems: 16, items: { type: "string", maxLength: 60 } },
    accessibilityTags: { type: "array", maxItems: 12, items: { type: "string", maxLength: 60 } },
    helperActions: { type: "array", maxItems: 4, items: { type: "string", enum: HELPER_ACTIONS } },
    sourceUrl: { type: "string" },
    sourceTitle: { type: "string", maxLength: 160 },
    evidence: { type: "string", maxLength: 500 },
  },
};

const discoverySchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 12,
      items: candidateSchema,
    },
  },
};

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
}

function cleanList(values: unknown, maxItems: number, fallback: string[] = []) {
  const list = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[,;|\n]/)
      : [];
  const cleaned = Array.from(new Set(list
    .map((item) => String(item).trim())
    .filter(Boolean)));
  return (cleaned.length ? cleaned : fallback).slice(0, maxItems);
}

function normalizeCountry(value: unknown, fallback?: string | null) {
  const cleaned = cleanText(value, cleanText(fallback)).toUpperCase().replace(/[^A-Z]/g, "");
  return cleaned ? cleaned.slice(0, 2) : null;
}

function normalizeLanguages(values: unknown, fallback: string[]) {
  const normalized = cleanList(values, 8, fallback)
    .map((language) => language.toLowerCase().split("-")[0])
    .filter((language) => SUPPORTED_LANGUAGES.includes(language));
  return normalized.length ? Array.from(new Set(normalized)) : fallback;
}

function normalizeFormat(value: unknown, fallback: DiscoveryFormatPreference): ParticipationEventFormat {
  const cleaned = cleanText(value).toLowerCase();
  if (FORMAT_OPTIONS.includes(cleaned as ParticipationEventFormat)) return cleaned as ParticipationEventFormat;
  return fallback === "any" ? "nearby" : fallback;
}

function normalizeHelperActions(values: unknown): ParticipationHelperAction[] {
  const actions = cleanList(values, 4, ["check_details"])
    .filter((value): value is ParticipationHelperAction => HELPER_ACTIONS.includes(value as ParticipationHelperAction));
  return actions.length ? actions : ["check_details"];
}

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || fallback;
}

function validSourceUrl(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeIso(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeQuery(input: DiscoverParticipationInput) {
  const city = truncate(cleanText(input.city), 120);
  const countryCode = normalizeCountry(input.countryCode, null);
  const locality = truncate(cleanText(input.locality), 200) || null;
  const postalCode = truncate(cleanText(input.postalCode), 32) || null;
  const radiusValue = Number(input.radiusKm);
  const radiusKm = Number.isFinite(radiusValue) ? Math.max(0.5, Math.min(50, radiusValue)) : null;
  const venueHints = cleanList(input.venueHints, 12);
  const languageCodes = normalizeLanguages(input.languageCodes, ["en", "es", "de"]);
  const interests = cleanList(input.interests, 12);
  const refinementTags = cleanList(input.refinementTags, 16);
  const format = input.format && ["nearby", "online", "hybrid", "any"].includes(input.format) ? input.format : "nearby";
  const maxResults = Math.max(1, Math.min(12, Number(input.maxResults ?? 6)));
  return { city, countryCode, locality, postalCode, radiusKm, venueHints, languageCodes, interests, refinementTags, format, maxResults };
}

function extractOutputText(response: unknown) {
  const direct = (response as { output_text?: unknown })?.output_text;
  if (typeof direct === "string") return direct;

  const output = (response as { output?: unknown })?.output;
  if (!Array.isArray(output)) return "";
  return output
    .flatMap((item) => Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [])
    .map((content) => {
      if ((content as { type?: string }).type === "output_text") {
        return cleanText((content as { text?: unknown }).text);
      }
      return "";
    })
    .join("");
}

function parseAiResponse(response: unknown): AiDiscoveryResponse {
  const outputText = extractOutputText(response);
  if (!outputText) {
    throw new ParticipationDiscoveryError("AI discovery returned no structured preview.", 502);
  }
  try {
    const parsed = JSON.parse(outputText) as AiDiscoveryResponse;
    return parsed && typeof parsed === "object" ? parsed : { candidates: [] };
  } catch {
    throw new ParticipationDiscoveryError("AI discovery returned unreadable structured data.", 502);
  }
}

function normalizeCandidate(
  candidate: AiCandidate,
  index: number,
  query: ReturnType<typeof normalizeQuery>,
  generatedAt: string,
  model: string,
): { event?: AdminParticipationEvent; rejected?: DiscoveryRejectedCandidate } {
  const sourceUrl = validSourceUrl(candidate.sourceUrl);
  const title = truncate(cleanText(candidate.titleEn || candidate.titleEs || candidate.titleDe), 140);
  if (!sourceUrl) {
    return { rejected: { title, reason: "Missing source URL" } };
  }
  if (!title) {
    return { rejected: { reason: "Missing title" } };
  }

  const eventKey = slugify(cleanText(candidate.eventKey, title), `ai-discovery-${index + 1}`);
  const format = normalizeFormat(candidate.format, query.format);
  const languages = normalizeLanguages(candidate.languageCodes, query.languageCodes);
  const sourceTitle = truncate(cleanText(candidate.sourceTitle), 160);
  const evidence = truncate(cleanText(candidate.evidence, sourceTitle || sourceUrl), 500);
  const locality = truncate(cleanText(candidate.locality), 120);

  const event: AdminParticipationEvent = {
    id: eventKey,
    eventKey,
    titleEn: title,
    titleEs: truncate(cleanText(candidate.titleEs, title), 140),
    titleDe: truncate(cleanText(candidate.titleDe, title), 140),
    summaryEn: truncate(cleanText(candidate.summaryEn, "AI discovered public activity candidate."), 260),
    summaryEs: truncate(cleanText(candidate.summaryEs, cleanText(candidate.summaryEn, "Actividad publica descubierta por IA.")), 260),
    summaryDe: truncate(cleanText(candidate.summaryDe, cleanText(candidate.summaryEn, "Von KI gefundene offentliche Aktivitat.")), 260),
    descriptionEn: truncate(cleanText(candidate.descriptionEn, cleanText(candidate.summaryEn)), 600),
    descriptionEs: truncate(cleanText(candidate.descriptionEs, cleanText(candidate.summaryEs)), 600),
    descriptionDe: truncate(cleanText(candidate.descriptionDe, cleanText(candidate.summaryDe)), 600),
    format,
    locationLabel: truncate(cleanText(candidate.locationLabel, format === "online" ? "Online" : query.city), 160),
    city: cleanText(candidate.city, query.city) || null,
    countryCode: normalizeCountry(candidate.countryCode, query.countryCode),
    timeLabelEn: truncate(cleanText(candidate.timeLabelEn, "Time to be checked"), 120),
    timeLabelEs: truncate(cleanText(candidate.timeLabelEs, "Hora por confirmar"), 120),
    timeLabelDe: truncate(cleanText(candidate.timeLabelDe, "Zeit wird gepruft"), 120),
    startsAt: normalizeIso(candidate.startsAt),
    endsAt: normalizeIso(candidate.endsAt),
    costLabelEn: truncate(cleanText(candidate.costLabelEn, "Cost to be checked"), 120),
    costLabelEs: truncate(cleanText(candidate.costLabelEs, "Coste por confirmar"), 120),
    costLabelDe: truncate(cleanText(candidate.costLabelDe, "Kosten werden gepruft"), 120),
    languageCodes: languages,
    tags: cleanList(candidate.tags, 16),
    interestTags: cleanList(candidate.interestTags, 16, query.interests),
    accessibilityTags: cleanList(candidate.accessibilityTags, 12),
    helperActions: normalizeHelperActions(candidate.helperActions),
    source: "ai-discovery",
    sourceUrl,
    status: "draft",
    isCurated: true,
    needsLiveCheck: true,
    safetyStatus: "needs_review",
    metadata: {
      ...(locality ? { locality } : {}),
      discovery: {
        generatedAt,
        query,
        sourceUrls: [sourceUrl],
        evidence,
        model,
      },
    },
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    responseCounts: { ...emptyCounts },
    checkRequestCount: 0,
  };

  return { event };
}

function comparableText(value?: string | null) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function comparableUrl(value?: string | null) {
  const raw = cleanText(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${url.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return comparableText(raw);
  }
}

function dateKey(value?: string | null) {
  const trimmed = cleanText(value);
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : "";
}

function candidateDuplicateKeys(candidate: AdminParticipationEvent) {
  const title = comparableText(candidate.titleEn || candidate.titleEs || candidate.titleDe);
  const sourceUrl = comparableUrl(candidate.sourceUrl);
  const city = comparableText(candidate.city);
  const location = comparableText(candidate.locationLabel);
  const start = dateKey(candidate.startsAt) || comparableText(candidate.timeLabelEn);
  return [
    candidate.eventKey ? `event:${candidate.eventKey}` : "",
    sourceUrl && title ? `source-title:${sourceUrl}:${title}` : "",
    title && city && location ? `title-city-location:${title}:${city}:${location}` : "",
    title && location && start ? `title-location-time:${title}:${location}:${start}` : "",
  ].filter(Boolean);
}

function buildPrompt(query: ReturnType<typeof normalizeQuery>) {
  const today = new Date().toISOString().slice(0, 10);
  const localFocus = [
    query.locality ? `neighbourhood, district, or nearby area: ${query.locality}` : null,
    query.postalCode ? `postcode or local anchor: ${query.postalCode}` : null,
    query.radiusKm ? `preferred radius: within about ${query.radiusKm} km` : null,
  ].filter(Boolean).join("; ") || "city-wide only if no more specific locality was provided";
  const venueFocus = query.venueHints.length
    ? query.venueHints.join(", ")
    : "libraries, community centres, museums, parks, cultural centres, senior-friendly public venues";
  return [
    `Today is ${today}. Find a shortlist of ${query.maxResults} public activity or event candidates for older adults in ${query.city}${query.countryCode ? `, ${query.countryCode}` : ""}.`,
    `Return the full shortlist when enough sourced candidates exist. Do not stop after the first good result; diversify by venue, day, and activity type. If fewer than ${query.maxResults} suitable sourced candidates exist, return every suitable one you can verify.`,
    `Locality focus: ${localFocus}. Prioritize candidates physically in or very near this focus area before suggesting wider city results.`,
    `Preferred venue or source types: ${venueFocus}.`,
    `Preferred format: ${query.format}. Interests or tags: ${query.interests.length ? query.interests.join(", ") : "balanced community activities"}.`,
    `Result refinements: ${query.refinementTags.length ? query.refinementTags.join(", ") : "no extra refinements"}. Use these to improve result quality, but keep at least a few good candidates if exact matches are scarce.`,
    `Languages to support in the saved record: ${query.languageCodes.join(", ")}. Return English, Spanish, and German fields even when the event itself is in fewer languages.`,
    "Prioritize libraries, community centers, museums, parks, gentle movement, music, crafts, language or culture groups, local history, and low-pressure learning.",
    "Make locationLabel specific enough for an admin to judge locality, such as venue plus neighbourhood or postcode area when the source supports it.",
    "Avoid generic city-wide directories when a neighbourhood, postcode, radius, or venue focus was supplied unless the source clearly identifies a relevant local branch or venue.",
    "Avoid medical treatment claims, dating, private contact exchange, gambling, expensive sales pressure, unverified transport offers, or anything unsafe for a senior-friendly concierge review.",
    "Every candidate must have a public sourceUrl. Use source evidence to summarize what the page supports. Do not invent dates, prices, or venue details; say they need checking when unclear.",
    "Set locationLabel to the most precise public location the source supports: venue name plus street, neighborhood, meeting point, or online room name. Avoid city-only locationLabel values unless no better detail is available.",
    "Set city to the broad city or town used for matching. Set locality to the more specific municipality, district, neighborhood, barrio, suburb, or borough when the source supports one; otherwise use null.",
  ].join("\n");
}

export async function discoverParticipationEvents(input: DiscoverParticipationInput): Promise<ParticipationDiscoveryResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ParticipationDiscoveryError(
      "AI discovery needs OPENAI_API_KEY before it can search for activities. Nothing was created.",
      503,
      "OPENAI_API_KEY_MISSING",
    );
  }

  const query = normalizeQuery(input);
  if (!query.city) {
    throw new ParticipationDiscoveryError("City is required for activity discovery.", 400, "CITY_REQUIRED");
  }

  const model = process.env.OPENAI_ACTIVITY_DISCOVERY_MODEL ?? "gpt-4.1-mini";
  const generatedAt = new Date().toISOString();
  const client = new OpenAI({ apiKey });

  const discoveryRequest = {
    model,
    instructions: [
      "You are helping VYVA admins discover public activity candidates for older adults.",
      "Return only structured JSON matching the schema. The admin will review and edit before anything is saved.",
      "Never mark candidates as published, approved, booked, contacted, or verified.",
    ].join("\n"),
    input: buildPrompt(query),
    tools: [{ type: "web_search", search_context_size: "medium" }],
    include: ["web_search_call.action.sources"],
    max_output_tokens: 8000,
    text: {
      format: {
        type: "json_schema",
        name: "participation_activity_discovery",
        strict: true,
        schema: discoverySchema,
      },
    },
  };
  const response = await client.responses.create(discoveryRequest as unknown as Parameters<typeof client.responses.create>[0]);

  const parsed = parseAiResponse(response);
  const candidates: AdminParticipationEvent[] = [];
  const rejected: DiscoveryRejectedCandidate[] = [];
  const seenCandidateKeys = new Set<string>();
  for (const [index, candidate] of (parsed.candidates ?? []).entries()) {
    const normalized = normalizeCandidate(candidate, index, query, generatedAt, model);
    if (normalized.event) {
      const keys = candidateDuplicateKeys(normalized.event);
      if (keys.some((key) => seenCandidateKeys.has(key))) {
        rejected.push({ title: normalized.event.titleEn, reason: "Duplicate AI result" });
      } else {
        keys.forEach((key) => seenCandidateKeys.add(key));
        candidates.push(normalized.event);
      }
    }
    if (normalized.rejected) rejected.push(normalized.rejected);
  }

  return {
    candidates,
    rejected,
    query,
    model,
    generatedAt,
  };
}
