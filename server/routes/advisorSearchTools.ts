import type { Request, Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { buildParticipationPulse } from "../lib/participation.js";
import { advisorUsesLiveSearch } from "../lib/advisorVoice.js";
import { verifyAdvisorSearchToolToken } from "../lib/jwt.js";

const toolSchema = z.object({
  user_id: z.string().min(1),
  conversation_id: z.string().min(1),
  advisor_slug: z.enum(["ines", "sabio", "marta"]),
  advisor_search_tool_token: z.string().min(1),
  query: z.string().trim().min(2).max(500),
  language: z.string().trim().max(16).optional(),
  country_code: z.string().trim().length(2).optional(),
});

const OFFICIAL_BENEFITS_DOMAINS: Record<string, string[]> = {
  ES: ["seg-social.es", "inclusion.gob.es", "sepe.es", "imserso.es", "europa.eu"],
  DE: ["deutsche-rentenversicherung.de", "arbeitsagentur.de", "bund.de", "europa.eu"],
  FR: ["service-public.fr", "caf.fr", "lassuranceretraite.fr", "europa.eu"],
  IT: ["inps.it", "gov.it", "europa.eu"],
  GB: ["gov.uk", "nhs.uk", "europa.eu"],
  IE: ["gov.ie", "citizensinformation.ie", "europa.eu"],
};

// Conservative sources only. If a country is not represented we return the
// EU-level sources rather than quietly widening a benefits search to the web.
const DEFAULT_BENEFITS_DOMAINS = ["europa.eu"];
const SENIOR_HOME_SOURCE_DOMAINS = [
  "cqc.org.uk", "careinspectorate.com", "imserso.es", "bund.de",
  "service-public.fr", "europa.eu",
];

function language(value?: string) {
  const base = value?.toLowerCase().split("-")[0];
  return base === "es" || base === "de" ? base : "en";
}

function responseText(response: unknown) {
  const text = (response as { output_text?: unknown })?.output_text;
  return typeof text === "string" ? text.trim() : "";
}

async function webSearch(input: { query: string; domains: string[]; purpose: string }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "Live search is not configured." };
  const client = new OpenAI({ apiKey });
  const generatedAt = new Date().toISOString();
  const response = await client.responses.create({
    model: process.env.OPENAI_ADVISOR_SEARCH_MODEL ?? "gpt-4.1-mini",
    instructions: [
      `You are sourcing information for VYVA's ${input.purpose}.`,
      "Return no more than 4 concise results. Every result must include source name, source URL, and the date accessed.",
      "Describe each result as worth checking, never guaranteed or final. Do not invent a source, date, eligibility, availability, price, or care claim.",
    ].join(" "),
    input: input.query,
    tools: [{
      type: "web_search",
      search_context_size: "medium",
      ...(input.domains.length ? { filters: { allowed_domains: input.domains } } : {}),
    }] as unknown as Parameters<typeof client.responses.create>[0]["tools"],
    include: ["web_search_call.action.sources"],
    max_output_tokens: 900,
  } as Parameters<typeof client.responses.create>[0]);
  const result = responseText(response);
  return result
    ? { ok: true, source: "web", accessed_at: generatedAt, results: result }
    : { ok: false, error: "No current results were found from approved sources." };
}

async function outingsSearch(userId: string, query: string, rawLanguage?: string) {
  const pulse = await buildParticipationPulse({ userId, language: language(rawLanguage) });
  const events = [pulse.featuredEvent, ...pulse.recommendations]
    .filter((event) => `${event.title} ${event.summary} ${event.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 4);
  const candidates = events.length ? events : [pulse.featuredEvent, ...pulse.recommendations].slice(0, 4);
  if (candidates.length) {
    return {
      ok: true,
      source: "vyva_curated_events",
      accessed_at: pulse.generatedAt,
      results: candidates.map((event) => ({
        title: event.title,
        summary: event.summary,
        location: event.locationLabel,
        time: event.timeLabel,
        source_name: event.source,
        source_url: event.sourceUrl ?? "",
        date: pulse.generatedAt,
        worth_checking: true,
      })),
    };
  }
  return webSearch({ query, domains: [], purpose: "Outings Companion" });
}

export async function advisorLiveSearchToolHandler(req: Request, res: Response) {
  const parsed = toolSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid advisor search request." });
  const input = parsed.data;
  const verified = await verifyAdvisorSearchToolToken(input.advisor_search_tool_token);
  if (!verified || verified.userId !== input.user_id || verified.conversationId !== input.conversation_id || verified.advisorSlug !== input.advisor_slug) {
    return res.status(403).json({ ok: false, error: "Invalid or expired advisor search token." });
  }
  if (!advisorUsesLiveSearch(input.advisor_slug)) return res.status(403).json({ ok: false, error: "This advisor cannot use live search." });

  try {
    if (input.advisor_slug === "marta") {
      return res.json(await outingsSearch(input.user_id, input.query, input.language));
    }
    if (input.advisor_slug === "ines") {
      const country = input.country_code?.toUpperCase() ?? "";
      const domains = OFFICIAL_BENEFITS_DOMAINS[country] ?? DEFAULT_BENEFITS_DOMAINS;
      return res.json(await webSearch({ query: input.query, domains, purpose: "Benefits Finder" }));
    }
    return res.json(await webSearch({
      query: input.query,
      domains: SENIOR_HOME_SOURCE_DOMAINS,
      purpose: "Senior Home Finder",
    }));
  } catch (error) {
    console.error("[advisor search tool]", error);
    return res.status(502).json({ ok: false, error: "Live search could not be completed. Please try again." });
  }
}
