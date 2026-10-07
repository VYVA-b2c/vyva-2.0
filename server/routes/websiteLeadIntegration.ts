import { timingSafeEqual } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { marketingContacts } from "../../shared/schema.js";

const websiteLeadIntegrationRouter = Router();

const stringOrNull = z.string().nullable().optional();
const booleanOrNull = z.boolean().nullable().optional();

const websiteLeadSchema = z.object({
  id: z.string().uuid(),
  name: stringOrNull,
  email: stringOrNull,
  organization: stringOrNull,
  role: stringOrNull,
  resident_count: stringOrNull,
  region: stringOrNull,
  phone: stringOrNull,
  language: stringOrNull,
  consent_given: booleanOrNull,
  lead_context: z.record(z.unknown()).nullable().optional(),
  cta_source: stringOrNull,
  source: stringOrNull,
  page_path: stringOrNull,
  referrer: stringOrNull,
  utm_source: stringOrNull,
  utm_medium: stringOrNull,
  utm_campaign: stringOrNull,
  created_at: stringOrNull,
}).passthrough();

const syncBodySchema = z.union([
  z.object({ lead: websiteLeadSchema }),
  websiteLeadSchema,
]).transform((value) => "lead" in value ? value.lead : value);

type WebsiteLead = z.infer<typeof websiteLeadSchema>;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function contextText(lead: WebsiteLead, ...keys: string[]) {
  const context = lead.lead_context ?? {};
  for (const key of keys) {
    const value = context[key];
    if (Array.isArray(value)) {
      const text = value.map(cleanText).filter(Boolean).join(", ");
      if (text) return text;
      continue;
    }
    const text = optionalText(value);
    if (text) return text;
  }
  return null;
}

function slug(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tag(prefix: string, value: unknown) {
  const normalized = slug(value);
  return normalized ? `${prefix}:${normalized}`.slice(0, 80) : null;
}

function uniqueTags(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).slice(0, 40);
}

function allLeadText(lead: WebsiteLead) {
  return [
    lead.cta_source,
    lead.source,
    lead.page_path,
    lead.organization,
    lead.role,
    lead.region,
    contextText(lead, "Selected form type", "Form", "Request type", "Request path", "Sector", "Vertical"),
  ].map(cleanText).join(" ").toLowerCase();
}

function inferAudienceType(lead: WebsiteLead) {
  const text = allLeadText(lead);
  if (text.match(/\b(organisation|organization|business|b2b|provider|partner|care-home|care home|hospital|clinic|nhs|healthcare|insurance|government|ngo|municipality)\b/)) {
    return "b2b";
  }
  if (text.match(/\b(parent|family|families|for-parent|for-self|companion|b2c)\b/)) {
    return "b2c";
  }
  return lead.organization ? "b2b" : "both";
}

function inferCategory(lead: WebsiteLead) {
  const text = allLeadText(lead);
  if (text.includes("hospital") || text.includes("discharge")) return "vertical_solution";
  if (text.includes("try_now") || text.includes("talk to vyva") || text.includes("hablar con vyva")) return "talk_to_vyva";
  if (text.includes("demo")) return "demo_request";
  if (text.includes("contact")) return "contact_request";
  if (text.includes("callback")) return "callback_request";
  return "website_lead";
}

function inferVertical(lead: WebsiteLead) {
  const text = allLeadText(lead);
  if (text.match(/\b(hospital|discharge|post-discharge|post discharge)\b/)) return "hospital_discharge";
  if (text.match(/\b(healthcare|clinic|nhs|medicine|surgery|care team)\b/)) return "healthcare";
  if (text.match(/\b(government|council|municipality|public-sector|public sector)\b/)) return "government";
  if (text.match(/\b(ngo|charity|nonprofit|non-profit)\b/)) return "ngo";
  if (text.match(/\b(insurer|insurance|payer)\b/)) return "insurance";
  if (text.match(/\b(telco|telecom|operator)\b/)) return "telecom";
  if (text.match(/\b(care-home|care home|senior living|residence)\b/)) return "senior_care";
  if (text.match(/\b(companion|family|parent)\b/)) return "companion";
  return null;
}

function consentStatus(lead: WebsiteLead) {
  if (lead.consent_given === true) return "opted_in";
  if (lead.consent_given === false) return "opted_out";
  return "unknown";
}

function hasWhatsappIntent(lead: WebsiteLead) {
  const text = [
    contextText(lead, "Preferred channel", "Channel", "Contact channel", "WhatsApp"),
    lead.cta_source,
    lead.source,
  ].map(cleanText).join(" ").toLowerCase();
  return text.includes("whatsapp") || text.includes("whats app");
}

export function buildWebsiteLeadContactPayload(lead: WebsiteLead, now = new Date()) {
  const phoneNumber = optionalText(lead.phone) ?? contextText(lead, "Phone", "Telephone", "Mobile", "Phone number");
  const category = inferCategory(lead);
  const vertical = inferVertical(lead);
  const selectedFormType = contextText(lead, "Selected form type", "Request type", "Form");
  const requestPath = contextText(lead, "Request path");
  const lastAction = contextText(lead, "Last tracked action", "Last clicked label", "Last tracked action label");
  const externalId = `website-lead:${lead.id}`;

  return {
    audience_type: inferAudienceType(lead),
    full_name: optionalText(lead.name) ?? "Website lead",
    email: optionalText(lead.email),
    phone_number: phoneNumber,
    whatsapp_number: hasWhatsappIntent(lead) ? phoneNumber : null,
    role_label: optionalText(lead.role),
    company_name: optionalText(lead.organization),
    language: optionalText(lead.language) ?? contextText(lead, "Language", "Locale"),
    category,
    vertical,
    market: optionalText(lead.region) ?? contextText(lead, "Market", "Country", "Region"),
    consent_status: consentStatus(lead),
    source: "website_leads",
    channel_availability: {
      email: Boolean(optionalText(lead.email)),
      phone: Boolean(phoneNumber),
      whatsapp: Boolean(phoneNumber && hasWhatsappIntent(lead)),
    },
    tags: uniqueTags([
      "website-lead",
      "source:website",
      tag("lead-source", lead.source),
      tag("cta", lead.cta_source),
      tag("category", category),
      tag("vertical", vertical),
      tag("audience", inferAudienceType(lead)),
      tag("language", lead.language),
      tag("market", lead.region),
      tag("form", selectedFormType),
      tag("path", requestPath),
      tag("last-action", lastAction),
    ]),
    lovable_external_id: externalId,
    last_synced_at: now,
    metadata: {
      syncedFrom: "vyva-website",
      syncedAt: now.toISOString(),
      websiteLeadId: lead.id,
      selectedFormType,
      requestPath,
      lastAction,
      attribution: {
        pagePath: optionalText(lead.page_path),
        referrer: optionalText(lead.referrer),
        utmSource: optionalText(lead.utm_source),
        utmMedium: optionalText(lead.utm_medium),
        utmCampaign: optionalText(lead.utm_campaign),
        submittedAt: optionalText(lead.created_at),
      },
      websiteLead: lead,
    },
    updated_at: now,
  };
}

function validSharedSecret(received: string | undefined) {
  const expected = process.env.WEBSITE_LEAD_SYNC_SECRET;
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

websiteLeadIntegrationRouter.post("/", async (req, res) => {
  if (!process.env.WEBSITE_LEAD_SYNC_SECRET) {
    return res.status(503).json({ error: "Website lead sync is not configured." });
  }

  if (!validSharedSecret(req.header("x-vyva-website-lead-secret"))) {
    return res.status(401).json({ error: "Unauthorized website lead sync." });
  }

  const parsed = syncBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const payload = buildWebsiteLeadContactPayload(parsed.data);
    const [contact] = await db.insert(marketingContacts)
      .values(payload)
      .onConflictDoUpdate({ target: marketingContacts.lovable_external_id, set: payload })
      .returning();

    return res.status(200).json({
      ok: true,
      contactId: contact?.id ?? null,
      externalId: payload.lovable_external_id,
      tags: payload.tags,
    });
  } catch (error) {
    console.error("[integrations/website-leads] sync failed", error);
    return res.status(500).json({ error: "Website lead could not be synced to admin marketing contacts." });
  }
});

export default websiteLeadIntegrationRouter;
