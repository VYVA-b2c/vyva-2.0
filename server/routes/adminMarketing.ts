import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { dispatchCommunicationsByIds } from "../services/communicationDispatcher.js";
import {
  communicationsLog,
  marketingAudienceMembers,
  marketingAudiences,
  marketingCampaignChannels,
  marketingCampaignMetrics,
  marketingCampaignRecipients,
  marketingCampaigns,
  marketingContacts,
  marketingContentAssets,
  marketingJourneyEnrollments,
  marketingJourneySteps,
  marketingJourneyStepEvents,
  marketingJourneys,
  marketingMediaAssets,
  marketingSyncRuns,
  type MarketingAudienceMemberRow,
  type MarketingAudienceRow,
  type MarketingCampaignChannelRow,
  type MarketingCampaignMetricRow,
  type MarketingCampaignRecipientRow,
  type MarketingCampaignRow,
  type MarketingContactRow,
  type MarketingContentAssetRow,
  type MarketingJourneyEnrollmentRow,
  type MarketingJourneyRow,
  type MarketingJourneyStepRow,
  type MarketingJourneyStepEventRow,
  type MarketingMediaAssetRow,
  type MarketingSyncRunRow,
} from "../../shared/schema.js";

export const adminMarketingRouter = Router();

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
const DEFAULT_LOVABLE_MARKETING_EXPORT_URL = "https://hecijzbvpxeagcapxwwn.supabase.co/functions/v1/marketing-export";
const MARKETING_SYNC_STATUS_BUILD = "marketing-sync-status-2026-07-12-no-cache";

function marketingSchemaErrorMessage(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const missingRelation = /relation "([^"]+)" does not exist/i.exec(message)?.[1];
  const missingColumn = /column (?:"?([^"\s]+)"?\.)?"?([^"\s]+)"? does not exist/i.exec(message)?.[2];
  if (code === "42P01" || missingRelation) {
    return `Marketing database schema is behind this build. Missing table "${missingRelation ?? "unknown"}". Apply the committed marketing migrations through 0064_marketing_parity_completion.sql, then retry.`;
  }
  if (code === "42703" || missingColumn) {
    return `Marketing database schema is behind this build. Missing column "${missingColumn ?? "unknown"}". Apply the committed marketing migrations through 0064_marketing_parity_completion.sql, then retry.`;
  }
  return fallback;
}

const marketingChannels = ["email", "whatsapp", "facebook", "instagram", "linkedin", "tiktok"] as const;
const audienceTypes = ["b2c", "b2b", "both"] as const;
const campaignStatuses = ["draft", "scheduled", "published", "paused", "archived"] as const;
const contentStatuses = ["draft", "review", "approved", "published", "archived"] as const;
const journeyStatuses = ["draft", "active", "paused", "archived"] as const;
const consentStatuses = ["unknown", "pending", "opted_in", "opted_out"] as const;
const recipientStatuses = ["planned", "blocked", "sent", "failed"] as const;

adminMarketingRouter.use((req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  return next();
});

const channelSchema = z.enum(marketingChannels);
const audienceTypeSchema = z.enum(audienceTypes);
const campaignStatusSchema = z.enum(campaignStatuses);
const contentStatusSchema = z.enum(contentStatuses);
const journeyStatusSchema = z.enum(journeyStatuses);
const consentStatusSchema = z.enum(consentStatuses);
const metadataSchema = z.record(z.unknown()).optional().default({});

const nullableDateSchema = z.string().datetime().nullable().optional();
const nullableUuidSchema = z.string().uuid().nullable().optional();

const campaignChannelInputSchema = z.object({
  channel: channelSchema,
  contentAssetId: nullableUuidSchema,
  scheduledAt: nullableDateSchema,
  status: campaignStatusSchema.optional().default("draft"),
  sendCapability: z.enum(["enabled", "locked", "future_send_capable", "planning_only"]).optional().default("locked"),
  metadata: metadataSchema,
});

const campaignRecipientInputSchema = z.object({
  contactId: nullableUuidSchema,
  profileId: z.string().trim().min(1).max(160).nullable().optional(),
  channel: channelSchema,
  recipient: z.string().trim().min(1).max(320),
  status: z.enum(["planned", "blocked", "sent", "failed"]).optional().default("planned"),
  scheduledAt: nullableDateSchema,
  snapshot: metadataSchema,
});

const campaignBodySchema = z.object({
  name: z.string().trim().min(1).max(180),
  status: campaignStatusSchema.optional().default("draft"),
  audienceType: audienceTypeSchema.optional().default("b2c"),
  objective: z.string().trim().max(500).optional().default(""),
  scheduleStartsAt: nullableDateSchema,
  scheduleEndsAt: nullableDateSchema,
  timezone: z.string().trim().min(1).max(80).optional().default("Europe/Madrid"),
  source: z.string().trim().min(1).max(80).optional().default("vyva"),
  lovableExternalId: z.string().trim().max(160).nullable().optional(),
  metadata: metadataSchema,
  channels: z.array(campaignChannelInputSchema).max(12).optional().default([]),
  recipients: z.array(campaignRecipientInputSchema).max(2000).optional().default([]),
});

const campaignPatchSchema = campaignBodySchema.partial();

const contentBodySchema = z.object({
  title: z.string().trim().min(1).max(180),
  channel: channelSchema,
  language: z.string().trim().min(2).max(12).optional().default("en"),
  status: contentStatusSchema.optional().default("draft"),
  subject: z.string().trim().max(240).nullable().optional(),
  body: z.string().trim().max(12000).optional().default(""),
  htmlBody: z.string().trim().max(100000).nullable().optional(),
  ctaLabel: z.string().trim().max(80).nullable().optional(),
  ctaUrl: z.string().trim().max(500).nullable().optional(),
  designJson: metadataSchema,
  mediaAssets: z.array(z.unknown()).max(250).optional().default([]),
  source: z.string().trim().min(1).max(80).optional().default("vyva"),
  lovableExternalId: z.string().trim().max(160).nullable().optional(),
  metadata: metadataSchema,
});

const contentPatchSchema = contentBodySchema.partial();

const mediaPatchSchema = z.object({
  contentAssetId: nullableUuidSchema,
  source: z.string().trim().min(1).max(80).optional(),
  assetType: z.string().trim().min(1).max(80).optional(),
  originalUrl: z.string().trim().min(1).max(1000).optional(),
  localUrl: z.string().trim().max(1000).nullable().optional(),
  status: z.string().trim().min(1).max(80).optional(),
  lovableExternalId: z.string().trim().max(160).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const journeyStepInputSchema = z.object({
  stepOrder: z.number().int().min(0).max(1000),
  channel: channelSchema,
  contentAssetId: nullableUuidSchema,
  delayHours: z.number().int().min(0).max(24 * 365).optional().default(0),
  kind: z.string().trim().min(1).max(80).optional().default("message"),
  dayOffset: z.number().int().min(0).max(3650).optional().default(0),
  templateKind: z.string().trim().max(80).nullable().optional(),
  templateRef: z.string().trim().max(240).nullable().optional(),
  config: metadataSchema,
  status: journeyStatusSchema.optional().default("draft"),
  metadata: metadataSchema,
});

const journeyBodySchema = z.object({
  name: z.string().trim().min(1).max(180),
  status: journeyStatusSchema.optional().default("draft"),
  audienceType: audienceTypeSchema.optional().default("b2c"),
  objective: z.string().trim().max(500).optional().default(""),
  triggerType: z.string().trim().max(120).nullable().optional(),
  triggerConfig: metadataSchema,
  goalType: z.string().trim().max(120).nullable().optional(),
  goalConfig: metadataSchema,
  exitOnGoal: z.boolean().optional().default(true),
  source: z.string().trim().min(1).max(80).optional().default("vyva"),
  lovableExternalId: z.string().trim().max(160).nullable().optional(),
  metadata: metadataSchema,
  steps: z.array(journeyStepInputSchema).max(80).optional().default([]),
});

const journeyPatchSchema = journeyBodySchema.partial();

const contactBodySchema = z.object({
  audienceType: audienceTypeSchema.optional().default("b2b"),
  profileId: z.string().trim().min(1).max(160).nullable().optional(),
  organizationId: nullableUuidSchema,
  fullName: z.string().trim().max(180).optional().default(""),
  email: z.string().trim().email().max(320).nullable().optional(),
  phoneNumber: z.string().trim().max(60).nullable().optional(),
  whatsappNumber: z.string().trim().max(60).nullable().optional(),
  roleLabel: z.string().trim().max(120).nullable().optional(),
  companyName: z.string().trim().max(180).nullable().optional(),
  language: z.string().trim().max(24).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  vertical: z.string().trim().max(120).nullable().optional(),
  market: z.string().trim().max(120).nullable().optional(),
  consentStatus: consentStatusSchema.optional().default("unknown"),
  source: z.string().trim().min(1).max(80).optional().default("vyva"),
  channelAvailability: metadataSchema,
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
  lovableExternalId: z.string().trim().max(160).nullable().optional(),
  metadata: metadataSchema,
});

const contactPatchSchema = contactBodySchema.partial();

const audienceBodySchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(600).nullable().optional(),
  listType: z.string().trim().min(1).max(80).optional().default("dynamic"),
  rules: metadataSchema,
  source: z.string().trim().min(1).max(80).optional().default("vyva"),
  lovableExternalId: z.string().trim().max(160).nullable().optional(),
  metadata: metadataSchema,
  contactExternalIds: z.array(z.string().trim().min(1).max(240)).max(10000).optional().default([]),
});

const audiencePatchSchema = audienceBodySchema.partial();

function actor(req: Request) {
  return String(req.user?.email ?? req.user?.id ?? "admin");
}

function isSuperAdmin(req: Request) {
  return typeof req.user?.email === "string" && req.user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

function requireSuperAdmin(req: Request, res: Response, action = "run Lovable marketing sync") {
  if (isSuperAdmin(req)) return true;
  res.status(403).json({ error: `Only the super admin can ${action}.` });
  return false;
}

function safeUrlOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return "invalid-url";
  }
}

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function lovableMarketingApiUrl() {
  return envValue("LOVABLE_MARKETING_API_URL", "VYVA_MARKETING_EXPORT_URL") || DEFAULT_LOVABLE_MARKETING_EXPORT_URL;
}

function lovableMarketingApiKey() {
  return envValue("LOVABLE_MARKETING_API_KEY", "VYVA_MARKETING_EXPORT_TOKEN");
}

function envKeyPresence(keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, Boolean(process.env[key]?.trim())]));
}

function firstPresentEnvKey(keys: string[]) {
  return keys.find((key) => Boolean(process.env[key]?.trim())) ?? null;
}

function lovableMarketingSyncDiagnostics(apiUrl: string, apiKey: string) {
  const urlKeys = ["LOVABLE_MARKETING_API_URL", "VYVA_MARKETING_EXPORT_URL"];
  const tokenKeys = ["LOVABLE_MARKETING_API_KEY", "VYVA_MARKETING_EXPORT_TOKEN"];
  return {
    apiUrlSource: firstPresentEnvKey(urlKeys) ?? "default",
    tokenSource: firstPresentEnvKey(tokenKeys),
    urlAliasPresent: envKeyPresence(urlKeys),
    tokenAliasPresent: envKeyPresence(tokenKeys),
    hasDefaultEndpoint: apiUrl === DEFAULT_LOVABLE_MARKETING_EXPORT_URL,
    hasBearerToken: Boolean(apiKey),
  };
}

function marketingEmailSchedulerStatus() {
  const enabled = process.env.MARKETING_EMAIL_SCHEDULER_ENABLED === "true";
  const intervalMinutes = Math.max(1, Number(process.env.MARKETING_EMAIL_SCHEDULER_INTERVAL_MINUTES ?? 5));
  const initialDelaySeconds = Math.max(5, Number(process.env.MARKETING_EMAIL_SCHEDULER_INITIAL_DELAY_SECONDS ?? 30));
  return {
    enabled,
    intervalMinutes,
    initialDelaySeconds,
    actor: process.env.MARKETING_EMAIL_SCHEDULER_ACTOR?.trim() || "marketing-email-scheduler",
  };
}

function dateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseJsonLike(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function jsonRecordFromLovable(value: unknown) {
  return asRecord(parseJsonLike(value));
}

function textFrom(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function numberFrom(row: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
    }
  }
  return fallback;
}

function textArrayFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item.trim();
    const row = asRecord(item);
    return textFrom(row, ["name", "title", "label", "id"]);
  }).filter(Boolean);
}

function uniqueTextArray(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function textFromSources(sources: Array<Record<string, unknown>>, keys: string[], fallback = "") {
  for (const source of sources) {
    const value = textFrom(source, keys);
    if (value) return value;
  }
  return fallback;
}

function splitTextList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item.trim();
      const row = asRecord(item);
      return textFrom(row, ["name", "title", "label", "value", "id"]);
    }).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function contactFieldSources(row: Record<string, unknown>) {
  const metadata = jsonRecordFromLovable(row.metadata);
  return [
    row,
    asRecord(row.contact),
    asRecord(row.profile),
    asRecord(row.properties),
    asRecord(row.fields),
    asRecord(row.customFields ?? row.custom_fields),
    metadata,
    asRecord(metadata.lovable),
    asRecord(metadata.contact),
    asRecord(metadata.profile),
    asRecord(metadata.properties),
    asRecord(metadata.fields),
    asRecord(metadata.customFields ?? metadata.custom_fields),
  ];
}

function contactText(row: Record<string, unknown>, keys: string[], fallback = "") {
  return textFromSources(contactFieldSources(row), keys, fallback);
}

function contentFieldSources(row: Record<string, unknown>) {
  const metadata = jsonRecordFromLovable(row.metadata);
  return [
    row,
    asRecord(row.content),
    asRecord(row.asset),
    asRecord(row.template),
    asRecord(row.emailTemplate ?? row.email_template),
    asRecord(row.socialPost ?? row.social_post ?? row.post),
    asRecord(row.contentBrief ?? row.content_brief ?? row.brief),
    asRecord(row.properties),
    asRecord(row.fields),
    asRecord(row.customFields ?? row.custom_fields),
    metadata,
    asRecord(metadata.lovable),
    asRecord(metadata.content),
    asRecord(metadata.asset),
    asRecord(metadata.template),
    asRecord(metadata.emailTemplate ?? metadata.email_template),
    asRecord(metadata.socialPost ?? metadata.social_post ?? metadata.post),
    asRecord(metadata.contentBrief ?? metadata.content_brief ?? metadata.brief),
    asRecord(metadata.properties),
    asRecord(metadata.fields),
    asRecord(metadata.customFields ?? metadata.custom_fields),
  ];
}

function contentText(row: Record<string, unknown>, keys: string[], fallback = "") {
  return textFromSources(contentFieldSources(row), keys, fallback);
}

function contentValues(row: Record<string, unknown>, keys: readonly string[]) {
  return contentFieldSources(row).flatMap((source) => (
    keys.map((key) => [source[key], key] as [unknown, string])
  ));
}

function contactFullName(row: Record<string, unknown>) {
  const explicit = emptyToNull(contactText(row, ["fullName", "full_name", "name", "displayName", "display_name"]));
  if (explicit) return explicit;
  return uniqueTextArray([
    emptyToNull(contactText(row, ["firstName", "first_name", "givenName", "given_name"])),
    emptyToNull(contactText(row, ["lastName", "last_name", "familyName", "family_name", "surname"])),
  ]).join(" ");
}

function normalizeConsentStatus(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["opted_out", "unsubscribed", "unsubscribe", "do_not_contact", "blocked", "false", "no"].includes(normalized)) return "opted_out";
  if (["opted_in", "subscribed", "subscribe", "active", "true", "yes", "consented"].includes(normalized)) return "opted_in";
  if (["pending", "invited", "needs_consent"].includes(normalized)) return "pending";
  return "unknown";
}

function audienceContactExternalIds(row: Record<string, unknown>) {
  const memberIds = arrayFrom(row.members).map((item) => {
    const member = asRecord(item);
    return textFrom(member, ["contactExternalId", "contact_external_id", "contactId", "contact_id", "externalId", "external_id", "id"]);
  });
  return uniqueTextArray([
    ...textArrayFrom(row.contactExternalIds),
    ...textArrayFrom(row.contact_external_ids),
    ...textArrayFrom(row.contactIds),
    ...textArrayFrom(row.contact_ids),
    ...memberIds,
  ]);
}

function campaignAudienceExternalIds(row: Record<string, unknown>) {
  return uniqueTextArray([
    emptyToNull(textFrom(row, ["audienceExternalId", "audience_external_id", "audienceId", "audience_id"])),
    ...textArrayFrom(row.audienceExternalIds),
    ...textArrayFrom(row.audience_external_ids),
    ...textArrayFrom(row.audienceIds),
    ...textArrayFrom(row.audience_ids),
    ...textArrayFrom(row.audiences),
  ]);
}

function campaignDirectContactExternalIds(row: Record<string, unknown>) {
  const explicitRecipientIds = campaignRecipientPayload(row).map((item) => {
    const recipient = asRecord(item);
    return textFrom(recipient, ["contactExternalId", "contact_external_id", "contactId", "contact_id", "externalId", "external_id", "id"]);
  });
  return uniqueTextArray([
    ...textArrayFrom(row.contactExternalIds),
    ...textArrayFrom(row.contact_external_ids),
    ...textArrayFrom(row.contactIds),
    ...textArrayFrom(row.contact_ids),
    ...explicitRecipientIds,
  ]);
}

function nestedText(primary: Record<string, unknown>, secondary: Record<string, unknown>, tertiary: Record<string, unknown>, keys: string[]) {
  return emptyToNull(textFrom(primary, keys))
    ?? emptyToNull(textFrom(secondary, keys))
    ?? emptyToNull(textFrom(tertiary, keys));
}

function dateTextFrom(row: Record<string, unknown>, keys: string[]) {
  const value = textFrom(row, keys);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function arrayFrom(value: unknown): unknown[] {
  const parsed = parseJsonLike(value);
  return Array.isArray(parsed) ? parsed : [];
}

function arrayOrSingleton(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

const LOVABLE_CONTENT_SOURCE_KEY = "__vyvaLovableContentSource";
const LOVABLE_AUDIENCE_MEMBER_ROWS_KEY = "__vyvaLovableAudienceMemberRows";
const LOVABLE_CONTACT_UNSUBSCRIBE_ROWS_KEY = "__vyvaLovableEmailUnsubscribeRows";

const contentTitleKeys = ["title", "name", "templateName", "template_name", "headline", "label"] as const;
const contentSubjectKeys = ["subject", "subjectLine", "subject_line", "emailSubject", "email_subject", "previewText", "preview_text"] as const;
const contentBodyKeys = [
  "body",
  "copy",
  "text",
  "content",
  "contentBody",
  "content_body",
  "message",
  "caption",
  "description",
  "brief",
  "plainText",
  "plain_text",
  "plainTextContent",
  "plain_text_content",
  "postContent",
  "post_content",
] as const;
const contentHtmlKeys = [
  "htmlBody",
  "html_body",
  "bodyHtml",
  "body_html",
  "html",
  "renderedHtml",
  "rendered_html",
  "htmlContent",
  "html_content",
  "contentHtml",
  "content_html",
  "emailHtml",
  "email_html",
  "emailBodyHtml",
  "email_body_html",
  "templateHtml",
  "template_html",
] as const;
const contentCtaLabelKeys = ["ctaLabel", "cta_label", "buttonText", "button_text", "buttonLabel", "button_label", "callToAction", "call_to_action"] as const;
const contentCtaUrlKeys = ["ctaUrl", "cta_url", "buttonUrl", "button_url", "link", "url", "targetUrl", "target_url"] as const;
const contentMediaArrayKeys = ["mediaAssets", "media_assets", "media", "images", "attachments", "gallery", "files"] as const;
const contentMediaUrlKeys = [
  "imageUrl",
  "image_url",
  "assetUrl",
  "asset_url",
  "thumbnailUrl",
  "thumbnail_url",
  "coverImageUrl",
  "cover_image_url",
  "featuredImageUrl",
  "featured_image_url",
  "mediaUrl",
  "media_url",
  "videoUrl",
  "video_url",
] as const;
const mediaContentRefKeys = [
  "contentAssetId",
  "content_asset_id",
  "contentExternalId",
  "content_external_id",
  "contentId",
  "content_id",
  "templateId",
  "template_id",
  "emailTemplateId",
  "email_template_id",
  "socialPostId",
  "social_post_id",
  "assetOwnerId",
  "asset_owner_id",
  "parentId",
  "parent_id",
] as const;

function withLovableContentSource(items: unknown[], sourceType: string) {
  return items.map((item) => ({
    ...asRecord(item),
    [LOVABLE_CONTENT_SOURCE_KEY]: sourceType,
  }));
}

function lovableContentPayload(payload: Record<string, unknown>) {
  return [
    ...withLovableContentSource(arrayFrom(payload.saved_email_templates ?? payload.savedEmailTemplates ?? payload.emailTemplates ?? payload.email_templates ?? payload.marketing_email_templates), "saved_email_template"),
    ...withLovableContentSource(arrayFrom(payload.templates ?? payload.marketing_templates), "template"),
    ...withLovableContentSource(arrayFrom(payload.content_briefs ?? payload.contentBriefs ?? payload.briefs ?? payload.marketing_content_briefs), "content_brief"),
    ...withLovableContentSource(arrayFrom(payload.contentAssets ?? payload.content_assets ?? payload.marketing_content_assets ?? payload.assets), "content_asset"),
    ...withLovableContentSource(arrayFrom(payload.content), "content"),
    ...withLovableContentSource(arrayFrom(payload.social_posts ?? payload.socialPosts ?? payload.posts ?? payload.marketing_social_posts), "social_post"),
  ];
}

function lovableMediaPayload(payload: Record<string, unknown>) {
  return arrayFrom(
    payload.mediaAssets
      ?? payload.media_assets
      ?? payload.marketing_media_assets
      ?? payload.media
      ?? payload.images
      ?? payload.attachments,
  ).map(asRecord);
}

function contentMediaAssetsFrom(row: Record<string, unknown>) {
  const nestedAssets = contentValues(row, contentMediaArrayKeys).flatMap(([value]) => arrayFrom(value));
  const urlAssets = contentMediaUrlKeys.flatMap((key) => {
    const url = emptyToNull(contentText(row, [key]));
    return url ? { url, sourceField: key } : null;
  }).filter((item): item is { url: string; sourceField: string } => Boolean(item));
  const seen = new Set<string>();
  return [...nestedAssets, ...urlAssets].filter((asset) => {
    const key = JSON.stringify(asset);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lovableAudiencePayload(payload: Record<string, unknown>) {
  const audienceRows = arrayFrom(payload.audiences ?? payload.lists ?? payload.contactLists ?? payload.contact_lists).map(asRecord);
  const memberRows = arrayFrom(payload.contact_list_members ?? payload.contactListMembers).map(asRecord);
  if (!memberRows.length) return audienceRows;

  const membersByListId = new Map<string, Record<string, unknown>[]>();
  for (const member of memberRows) {
    const listId = emptyToNull(textFrom(member, ["audienceExternalId", "audience_external_id", "audienceId", "audience_id", "contactListId", "contact_list_id", "listId", "list_id"]));
    if (!listId) continue;
    const current = membersByListId.get(listId) ?? [];
    current.push(member);
    membersByListId.set(listId, current);
  }

  return audienceRows.map((audience) => {
    const audienceExternalId = normalizeLovableId(audience);
    const members = audienceExternalId
      ? externalIdVariants(audienceExternalId, ["audience", "list", "contact_list"]).flatMap((variant) => membersByListId.get(variant) ?? [])
      : [];
    if (!members.length) return audience;
    const memberContactExternalIds = members.map((member) => (
      textFrom(member, ["contactExternalId", "contact_external_id", "contactId", "contact_id", "externalId", "external_id", "id"])
    ));
    return {
      ...audience,
      members: [
        ...arrayFrom(audience.members),
        ...members.map((member) => ({
          ...member,
          contactExternalId: textFrom(member, ["contactExternalId", "contact_external_id", "contactId", "contact_id", "externalId", "external_id", "id"]),
        })),
      ],
      contactExternalIds: uniqueTextArray([
        ...textArrayFrom(audience.contactExternalIds),
        ...textArrayFrom(audience.contact_external_ids),
        ...textArrayFrom(audience.contactIds),
        ...textArrayFrom(audience.contact_ids),
        ...memberContactExternalIds,
      ]),
      [LOVABLE_AUDIENCE_MEMBER_ROWS_KEY]: members,
    };
  });
}

function journeyStepJourneyExternalId(step: Record<string, unknown>) {
  return emptyToNull(textFrom(step, [
    "journeyExternalId",
    "journey_external_id",
    "journeyId",
    "journey_id",
    "workflowId",
    "workflow_id",
  ]));
}

function journeyStepMergeKey(step: Record<string, unknown>, index: number) {
  return normalizeLovableId(step)
    ?? emptyToNull(textFrom(step, ["stepOrder", "step_order", "order", "position"]))
    ?? `index:${index}`;
}

function mergeJourneySteps(existingSteps: unknown[], rawSteps: Record<string, unknown>[]) {
  if (!rawSteps.length) return existingSteps;
  const merged = new Map<string, Record<string, unknown>>();
  existingSteps.map(asRecord).forEach((step, index) => {
    merged.set(journeyStepMergeKey(step, index), step);
  });
  rawSteps.forEach((step, index) => {
    merged.set(journeyStepMergeKey(step, index), step);
  });
  return Array.from(merged.values());
}

function lovableJourneyPayload(payload: Record<string, unknown>) {
  const journeyRows = arrayFrom(payload.journeys).map(asRecord);
  const stepRows = arrayFrom(payload.journey_steps ?? payload.journeySteps).map(asRecord);
  if (!stepRows.length) return journeyRows;

  const stepsByJourneyId = new Map<string, Record<string, unknown>[]>();
  for (const step of stepRows) {
    const journeyExternalId = journeyStepJourneyExternalId(step);
    if (!journeyExternalId) continue;
    const current = stepsByJourneyId.get(journeyExternalId) ?? [];
    current.push(step);
    stepsByJourneyId.set(journeyExternalId, current);
  }

  return journeyRows.map((journey) => {
    const journeyExternalId = normalizeLovableId(journey);
    const rawSteps = journeyExternalId
      ? externalIdVariants(journeyExternalId, ["journey", "workflow"]).flatMap((variant) => stepsByJourneyId.get(variant) ?? [])
      : [];
    if (!rawSteps.length) return journey;
    return {
      ...journey,
      steps: mergeJourneySteps(arrayFrom(journey.steps), rawSteps),
    };
  });
}

function lovableJourneyEnrollmentPayload(payload: Record<string, unknown>) {
  return arrayFrom(payload.journeyEnrollments ?? payload.journey_enrollments ?? payload.enrollments ?? payload.progress);
}

function lovableJourneyStepEventPayload(payload: Record<string, unknown>) {
  return arrayFrom(
    payload.journeyStepEvents
      ?? payload.journey_step_events
      ?? payload.stepEvents
      ?? payload.step_events
      ?? payload.journeyEvents
      ?? payload.journey_events
      ?? payload.marketing_journey_step_events,
  );
}

function journeyStepHasPresetTranslations(raw: unknown) {
  const step = asRecord(raw);
  const config = jsonRecordFromLovable(step.config);
  const translations = jsonRecordFromLovable(config.translations);
  return Object.values(translations).some((value) => Object.keys(asRecord(value)).length > 0);
}

function journeyStepPresetContentExportCount(journeyPayload: unknown[]) {
  return journeyPayload.reduce((count, item) => (
    count + arrayFrom(asRecord(item).steps).filter(journeyStepHasPresetTranslations).length
  ), 0);
}

function journeyEnrollmentEventPayload(row: Record<string, unknown>) {
  return [
    ...arrayFrom(row.events),
    ...arrayFrom(row.stepEvents),
    ...arrayFrom(row.step_events),
    ...arrayFrom(row.history),
  ];
}

function lovableContactPayload(payload: Record<string, unknown>) {
  const contactRows = arrayFrom(payload.contacts).map(asRecord);
  const unsubscribeRows = arrayFrom(payload.email_unsubscribes ?? payload.emailUnsubscribes).map(asRecord);
  if (!unsubscribeRows.length) return contactRows;

  const unsubscribesByEmail = new Map<string, Record<string, unknown>[]>();
  for (const row of unsubscribeRows) {
    const email = emptyToNull(textFrom(row, ["email", "contactEmail", "contact_email", "recipient", "emailAddress", "email_address"]))?.toLowerCase();
    if (!email) continue;
    const current = unsubscribesByEmail.get(email) ?? [];
    current.push(row);
    unsubscribesByEmail.set(email, current);
  }

  const contactEmails = new Set<string>();
  const contactsWithUnsubscribes = contactRows.map((contact) => {
    const email = emptyToNull(contactText(contact, ["email", "emailAddress", "email_address"]))?.toLowerCase();
    if (email) contactEmails.add(email);
    const unsubscribeMatches = email ? unsubscribesByEmail.get(email) ?? [] : [];
    if (!unsubscribeMatches.length) return contact;
    return {
      ...contact,
      consentStatus: "opted_out",
      [LOVABLE_CONTACT_UNSUBSCRIBE_ROWS_KEY]: unsubscribeMatches,
    };
  });
  const suppressionOnlyContacts = unsubscribeRows.flatMap((row) => {
    const email = emptyToNull(textFrom(row, ["email", "contactEmail", "contact_email", "recipient", "emailAddress", "email_address"]))?.toLowerCase();
    if (!email || contactEmails.has(email)) return [];
    contactEmails.add(email);
    return [{
      id: normalizeLovableId(row) ?? `unsubscribe:${email}`,
      fullName: textFrom(row, ["name", "fullName", "full_name", "contactName", "contact_name"], email),
      email,
      audienceType: "both",
      consentStatus: "opted_out",
      channelAvailability: { email: true },
      tags: ["lovable_unsubscribe"],
      metadata: { lovable_unsubscribe: row },
      [LOVABLE_CONTACT_UNSUBSCRIBE_ROWS_KEY]: [row],
    }];
  });

  return [...contactsWithUnsubscribes, ...suppressionOnlyContacts];
}

function campaignChildCampaignExternalId(row: Record<string, unknown>) {
  return emptyToNull(textFrom(row, [
    "campaignExternalId",
    "campaign_external_id",
    "campaignId",
    "campaign_id",
    "campaign",
  ]));
}

function explicitChildMergeKey(row: Record<string, unknown>) {
  return normalizeLovableId(row)
    ?? emptyToNull(textFrom(row, ["externalKey", "external_key"]));
}

function campaignChannelMergeKey(row: Record<string, unknown>, index: number) {
  const explicit = explicitChildMergeKey(row);
  if (explicit) return explicit;
  const channel = normalizeChannel(textFrom(row, ["channel", "platform", "network"], "email"));
  const contentExternalId = lovableContentReference(row);
  const scheduledAt = dateTextFrom(row, ["scheduledAt", "scheduled_at", "scheduleStartsAt", "schedule_starts_at", "startsAt", "starts_at", "publishAt", "publish_at", "sendAt", "send_at"]) ?? "";
  const status = textFrom(row, ["channelStatus", "channel_status", "status"]);
  return `channel:${channel}:${contentExternalId}:${scheduledAt}:${status}:index:${index}`;
}

function campaignRecipientMergeKey(row: Record<string, unknown>, index: number) {
  const explicit = explicitChildMergeKey(row);
  if (explicit) return explicit;
  const channel = normalizeChannel(textFrom(row, ["channel"], "email"));
  const recipientRef = emptyToNull(textFrom(row, [
    "recipient",
    "email",
    "phoneNumber",
    "phone_number",
    "whatsappNumber",
    "whatsapp_number",
    "phone",
    "whatsapp",
    "contactExternalId",
    "contact_external_id",
    "contactId",
    "contact_id",
    "externalId",
    "external_id",
  ]));
  return recipientRef ? `recipient:${channel}:${recipientRef}` : `recipient:${channel}:index:${index}`;
}

function mergeCampaignChildRows(
  existingRows: unknown[],
  rawRows: Record<string, unknown>[],
  keyForRow: (row: Record<string, unknown>, index: number) => string,
) {
  if (!rawRows.length) return existingRows;
  const merged = new Map<string, Record<string, unknown>>();
  existingRows.map(asRecord).forEach((row, index) => {
    merged.set(keyForRow(row, index), row);
  });
  rawRows.forEach((row, index) => {
    merged.set(keyForRow(row, index), row);
  });
  return Array.from(merged.values());
}

function groupCampaignChildRows(rows: Record<string, unknown>[]) {
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const campaignExternalId = campaignChildCampaignExternalId(row);
    if (!campaignExternalId) continue;
    const current = grouped.get(campaignExternalId) ?? [];
    current.push(row);
    grouped.set(campaignExternalId, current);
  }
  return grouped;
}

function campaignChildRowsForCampaign(grouped: Map<string, Record<string, unknown>[]>, campaignExternalId: string) {
  return externalIdVariants(campaignExternalId, ["campaign"]).flatMap((variant) => grouped.get(variant) ?? []);
}

function lovableCampaignChannelRows(payload: Record<string, unknown>) {
  return arrayFrom(payload.campaign_channels ?? payload.campaignChannels ?? payload.marketing_campaign_channels).map(asRecord);
}

function lovableCampaignRecipientRows(payload: Record<string, unknown>) {
  return arrayFrom(payload.campaign_recipients ?? payload.campaignRecipients ?? payload.recipient_snapshots ?? payload.recipientSnapshots ?? payload.marketing_campaign_recipients).map(asRecord);
}

function campaignRecipientPayload(row: Record<string, unknown>) {
  return arrayFrom(row.recipients ?? row.recipientSnapshots ?? row.campaignRecipients ?? row.campaign_recipients);
}

function campaignRecipientSourceCount(row: Record<string, unknown>, audienceContactExternalIdsByAudienceExternalId: Map<string, string[]>) {
  const explicitCount = campaignRecipientPayload(row).length;
  const directCount = campaignDirectContactExternalIds(row).length;
  const audienceCount = campaignAudienceExternalIds(row).reduce((count, audienceExternalId) => (
    count + (lookupByExternalId(audienceContactExternalIdsByAudienceExternalId, audienceExternalId, ["audience", "list", "contact_list"])?.length ?? 0)
  ), 0);
  return Math.max(explicitCount, directCount + audienceCount);
}

function lovableExportSummary(payload: Record<string, unknown>) {
  const contentPayload = lovableContentPayload(payload);
  const standaloneMediaPayload = lovableMediaPayload(payload);
  const contactPayload = lovableContactPayload(payload);
  const campaignPayload = lovableCampaignPayload(payload);
  const journeyPayload = lovableJourneyPayload(payload);
  const audiencePayload = lovableAudiencePayload(payload);
  const campaignMetricPayload = arrayFrom(payload.campaignMetrics ?? payload.campaign_metrics ?? payload.analytics ?? payload.metrics);
  const journeyEnrollmentPayload = lovableJourneyEnrollmentPayload(payload);
  const journeyStepEventPayload = lovableJourneyStepEventPayload(payload);
  const audienceContactExternalIdsByAudienceExternalId = new Map<string, string[]>();

  for (const item of audiencePayload) {
    const audienceRow = asRecord(item);
    const audienceExternalId = normalizeLovableId(audienceRow);
    if (!audienceExternalId) continue;
    for (const variant of externalIdVariants(audienceExternalId, ["audience", "list", "contact_list"])) {
      audienceContactExternalIdsByAudienceExternalId.set(variant, audienceContactExternalIds(audienceRow));
    }
  }

  const nestedMediaAssetExportCount = contentPayload.reduce((count, item) => count + contentMediaAssetsFrom(asRecord(item)).length, 0);
  const mediaAssetExportCount = nestedMediaAssetExportCount + standaloneMediaPayload.length;
  const campaignChannelExportCount = campaignPayload.reduce((count, item) => count + campaignChannelPayload(asRecord(item)).length, 0);
  const campaignRecipientExportCount = campaignPayload.reduce((count, item) => (
    count + campaignRecipientSourceCount(asRecord(item), audienceContactExternalIdsByAudienceExternalId)
  ), 0);
  const nestedJourneyStepEventExportCount = journeyEnrollmentPayload.reduce((count, item) => count + journeyEnrollmentEventPayload(asRecord(item)).length, 0);
  const journeyStepPresetExportCount = journeyStepPresetContentExportCount(journeyPayload);
  const contentSourceCounts = contentPayload.reduce<Record<string, number>>((counts, item) => {
    const sourceType = String(asRecord(item)[LOVABLE_CONTENT_SOURCE_KEY] ?? "content");
    counts[sourceType] = (counts[sourceType] ?? 0) + 1;
    return counts;
  }, {});
  if (journeyStepPresetExportCount) {
    contentSourceCounts.journey_step_preset = journeyStepPresetExportCount;
  }

  return {
    exported: {
      campaigns: campaignPayload.length,
      contacts: contactPayload.length,
      content: contentPayload.length,
      journeyStepPresetContent: journeyStepPresetExportCount,
      mediaAssets: mediaAssetExportCount,
      campaignChannels: campaignChannelExportCount,
      campaignRecipients: campaignRecipientExportCount,
      campaignMetrics: campaignMetricPayload.length,
      journeys: journeyPayload.length,
      journeyEnrollments: journeyEnrollmentPayload.length,
      journeyStepEvents: nestedJourneyStepEventExportCount + journeyStepEventPayload.length,
      audiences: audiencePayload.length,
    },
    contentSourceCounts,
    fieldCoverage: {
      content: fieldCoverageForPayload(contentPayload, fieldCoverageAliases.content),
      media: fieldCoverageForPayload([...contentPayload.flatMap((item) => contentMediaAssetsFrom(asRecord(item))), ...standaloneMediaPayload], fieldCoverageAliases.media),
      contacts: fieldCoverageForPayload(contactPayload, fieldCoverageAliases.contacts),
      campaigns: fieldCoverageForPayload(campaignPayload, fieldCoverageAliases.campaigns),
      campaignMetrics: fieldCoverageForPayload(campaignMetricPayload, fieldCoverageAliases.campaignMetrics),
      journeys: fieldCoverageForPayload(journeyPayload, fieldCoverageAliases.journeys),
      journeyEnrollments: fieldCoverageForPayload(journeyEnrollmentPayload, fieldCoverageAliases.journeyEnrollments),
      journeyStepEvents: fieldCoverageForPayload([...journeyEnrollmentPayload.flatMap((item) => journeyEnrollmentEventPayload(asRecord(item))), ...journeyStepEventPayload], fieldCoverageAliases.journeyStepEvents),
      audiences: fieldCoverageForPayload(audiencePayload, fieldCoverageAliases.audiences),
    },
  };
}

function previewSampleValue(value: unknown, depth = 0): unknown {
  const parsed = parseJsonLike(value);
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    return trimmed.length > 700 ? `${trimmed.slice(0, 700)}...` : trimmed;
  }
  if (typeof parsed === "number" || typeof parsed === "boolean" || parsed === null || parsed === undefined) return parsed ?? null;
  if (Array.isArray(parsed)) {
    const items = parsed.slice(0, 4).map((item) => previewSampleValue(item, depth + 1));
    return parsed.length > 4 ? [...items, `+${parsed.length - 4} more`] : items;
  }
  if (typeof parsed !== "object") return String(parsed);
  const row = asRecord(parsed);
  if (depth >= 4) return { keys: Object.keys(row).slice(0, 16) };
  const entries = Object.entries(row).slice(0, 18).map(([key, nested]) => [key, previewSampleValue(nested, depth + 1)] as const);
  const sample = Object.fromEntries(entries);
  const remaining = Object.keys(row).length - entries.length;
  return remaining > 0 ? { ...sample, __truncatedKeys: remaining } : sample;
}

function previewSampleRows(rows: unknown[], limit = 3) {
  return rows.slice(0, limit).map((row) => previewSampleValue(row));
}

function topLevelArraySamples(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, previewSampleRows(value as unknown[], 2)]),
  );
}

function lovableExportSamples(payload: Record<string, unknown>) {
  const contentPayload = lovableContentPayload(payload);
  const standaloneMediaPayload = lovableMediaPayload(payload);
  const contactPayload = lovableContactPayload(payload);
  const campaignPayload = lovableCampaignPayload(payload);
  const journeyPayload = lovableJourneyPayload(payload);
  const audiencePayload = lovableAudiencePayload(payload);
  const campaignMetricPayload = arrayFrom(payload.campaignMetrics ?? payload.campaign_metrics ?? payload.analytics ?? payload.metrics);
  const journeyEnrollmentPayload = lovableJourneyEnrollmentPayload(payload);
  const journeyStepEventPayload = lovableJourneyStepEventPayload(payload);
  return Object.fromEntries(Object.entries({
    content: previewSampleRows(contentPayload),
    media: previewSampleRows([...contentPayload.flatMap((item) => contentMediaAssetsFrom(asRecord(item))), ...standaloneMediaPayload]),
    contacts: previewSampleRows(contactPayload),
    campaigns: previewSampleRows(campaignPayload),
    campaignMetrics: previewSampleRows(campaignMetricPayload),
    journeys: previewSampleRows(journeyPayload),
    journeyEnrollments: previewSampleRows(journeyEnrollmentPayload),
    journeyStepEvents: previewSampleRows([...journeyEnrollmentPayload.flatMap((item) => journeyEnrollmentEventPayload(asRecord(item))), ...journeyStepEventPayload]),
    audiences: previewSampleRows(audiencePayload),
  }).filter(([, rows]) => rows.length > 0));
}

function lovableCampaignPayload(payload: Record<string, unknown>) {
  const campaignRows = arrayFrom(payload.campaigns).map(asRecord);
  const channelsByCampaignId = groupCampaignChildRows(lovableCampaignChannelRows(payload));
  const recipientsByCampaignId = groupCampaignChildRows(lovableCampaignRecipientRows(payload));
  if (!channelsByCampaignId.size && !recipientsByCampaignId.size) return campaignRows;

  return campaignRows.map((campaign) => {
    const campaignExternalId = normalizeLovableId(campaign);
    if (!campaignExternalId) return campaign;
    const channelRows = campaignChildRowsForCampaign(channelsByCampaignId, campaignExternalId);
    const recipientRows = campaignChildRowsForCampaign(recipientsByCampaignId, campaignExternalId);
    if (!channelRows.length && !recipientRows.length) return campaign;
    return {
      ...campaign,
      channels: mergeCampaignChildRows(arrayFrom(campaign.channels), channelRows, campaignChannelMergeKey),
      recipients: mergeCampaignChildRows(campaignRecipientPayload(campaign), recipientRows, campaignRecipientMergeKey),
    };
  });
}

const contentReferenceKeys = [
  "contentExternalId",
  "content_external_id",
  "contentId",
  "content_id",
  "contentAssetId",
  "content_asset_id",
  "templateId",
  "template_id",
  "emailTemplateId",
  "email_template_id",
  "socialPostId",
  "social_post_id",
  "templateRef",
  "template_ref",
] as const;

function lovableContentReference(row: Record<string, unknown>) {
  return textFrom(row, [...contentReferenceKeys]);
}

function contentIdForLovableReference(contentByExternalId: Map<string, string>, externalId: string) {
  return lookupByExternalId(contentByExternalId, externalId, ["content", "content_asset", "saved_email_template", "social_post", "template", "content_brief", "journey_step_preset"]) ?? null;
}

function lovableReferenceSourceType(externalId: string) {
  const trimmed = externalId.trim();
  if (!trimmed.includes(":")) return "missing_lovable_reference";
  const prefix = trimmed.split(":")[0]?.trim();
  if (!prefix) return "missing_lovable_reference";
  if (["content", "content_asset", "saved_email_template", "social_post", "template", "content_brief", "journey_step_preset"].includes(prefix)) {
    return prefix;
  }
  return "missing_lovable_reference";
}

function lovableReferenceSourceLabel(sourceType: string) {
  if (sourceType === "saved_email_template") return "email template";
  if (sourceType === "social_post") return "social post";
  if (sourceType === "content_brief") return "content brief";
  if (sourceType === "journey_step_preset") return "journey step preset";
  if (sourceType === "template") return "template";
  if (sourceType === "content" || sourceType === "content_asset") return "content";
  return "content reference";
}

function campaignChannelPayload(row: Record<string, unknown>) {
  const channelRows = arrayFrom(row.channels);
  if (channelRows.length) return channelRows;
  const channel = textFrom(row, ["channel", "platform", "network"]);
  const contentExternalId = lovableContentReference(row);
  const scheduledAt = dateTextFrom(row, ["scheduledAt", "scheduled_at", "scheduleStartsAt", "schedule_starts_at", "startsAt", "starts_at", "publishAt", "publish_at", "sendAt", "send_at"]);
  const hasChannelData = channel || contentExternalId || scheduledAt || textFrom(row, ["channelStatus", "channel_status"]);
  if (!hasChannelData) return [];
  return [{
    channel: channel || "email",
    contentExternalId,
    scheduledAt,
    status: textFrom(row, ["channelStatus", "channel_status", "status"], "draft"),
    lovable: row,
  }];
}

function booleanFrom(row: Record<string, unknown>, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
  }
  return fallback;
}

const fieldCoverageAliases = {
  content: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["metadata", "content", "asset", "template", "emailTemplate", "email_template", "socialPost", "social_post", "post", "contentBrief", "content_brief", "properties", "fields", "customFields", "custom_fields"],
    [...contentTitleKeys],
    ["channel", "platform", "network"],
    ["language", "lang", "locale"],
    ["status"],
    [...contentSubjectKeys],
    [...contentBodyKeys],
    [...contentHtmlKeys],
    [...contentCtaLabelKeys],
    [...contentCtaUrlKeys],
    ["designJson", "design_json", "design", "emailDesign", "email_design", "layout", "blocks", "sections", "components", "canvas", "builderJson", "builder_json", "templateJson", "template_json"],
    [...contentMediaArrayKeys, ...contentMediaUrlKeys],
    ["updatedAt", "updated_at"],
  ],
  media: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["url", "src", "href", "originalUrl", "original_url", "assetUrl", "asset_url", "imageUrl", "image_url", "thumbnailUrl", "thumbnail_url"],
    ["localUrl", "local_url"],
    ["type", "kind", "assetType", "asset_type", "mimeType", "mime_type"],
    ["contentAssetId", "content_asset_id", "contentExternalId", "content_external_id", "contentId", "content_id", "templateId", "template_id", "emailTemplateId", "email_template_id", "socialPostId", "social_post_id"],
    ["status", "importStatus", "import_status"],
    ["updatedAt", "updated_at"],
  ],
  contacts: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["metadata", "contact", "profile", "properties", "fields", "customFields", "custom_fields"],
    ["name", "fullName", "full_name", "displayName", "display_name", "firstName", "first_name", "givenName", "given_name", "lastName", "last_name", "familyName", "family_name", "surname"],
    ["email", "emailAddress", "email_address"],
    ["phoneNumber", "phone_number", "phone", "mobileNumber", "mobile_number", "mobile", "telephone"],
    ["whatsappNumber", "whatsapp_number", "whatsapp", "whatsAppNumber", "whats_app_number"],
    ["audienceType", "audience_type", "audience"],
    ["roleLabel", "role_label", "role", "jobTitle", "job_title", "title", "position"],
    ["companyName", "company_name", "company", "organization", "organizationName", "organization_name", "organisation", "organisationName", "organisation_name"],
    ["consentStatus", "consent_status"],
    ["channelAvailability", "channel_availability"],
    ["tags"],
    ["lists", "listNames", "list_names", "audiences", "memberships", "segments", "segmentNames", "segment_names"],
    ["language", "lang", "locale", "preferredLanguage", "preferred_language"],
    ["category", "contactCategory", "contact_category"],
    ["vertical", "industry", "sector"],
    ["market", "country", "region"],
    ["updatedAt", "updated_at"],
  ],
  campaigns: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["name", "title"],
    ["status"],
    ["audienceType", "audience_type", "audience"],
    ["objective", "description"],
    ["scheduleStartsAt", "schedule_starts_at", "startsAt", "starts_at", "scheduledAt", "scheduled_at", "publishAt", "publish_at", "sendAt", "send_at"],
    ["scheduleEndsAt", "schedule_ends_at", "endsAt", "ends_at"],
    ["timezone"],
    ["channels", "channel", "platform", "network"],
    ["contentExternalId", "content_external_id", "contentId", "content_id", "contentAssetId", "content_asset_id", "templateId", "template_id", "emailTemplateId", "email_template_id", "socialPostId", "social_post_id"],
    ["metrics", "analytics", "performance"],
    ["recipients", "recipientSnapshots", "campaignRecipients", "campaign_recipients"],
    ["contactExternalIds", "contact_external_ids", "contactIds", "contact_ids"],
    ["audienceExternalIds", "audience_external_ids", "audienceIds", "audience_ids", "audiences"],
    ["updatedAt", "updated_at"],
  ],
  campaignMetrics: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["campaignExternalId", "campaign_external_id", "campaignId", "campaign_id"],
    ["channel"],
    ["metricDate", "metric_date", "date", "updatedAt", "updated_at"],
    ["sent"],
    ["delivered"],
    ["opened", "opens"],
    ["clicked", "clicks"],
    ["bounced", "bounces"],
    ["unsubscribed", "unsubscribes"],
    ["replied", "replies"],
    ["socialEngagement", "social_engagement", "engagements"],
  ],
  journeys: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["name", "title"],
    ["status"],
    ["audienceType", "audience_type", "audience"],
    ["objective", "description"],
    ["triggerType", "trigger_type"],
    ["triggerConfig", "trigger_config"],
    ["goalType", "goal_type"],
    ["goalConfig", "goal_config"],
    ["exitOnGoal", "exit_on_goal"],
    ["steps"],
    ["enrollments", "progress"],
    ["updatedAt", "updated_at"],
  ],
  journeyEnrollments: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["journeyExternalId", "journey_external_id", "journeyId", "journey_id"],
    ["contactExternalId", "contact_external_id", "contactId", "contact_id"],
    ["status"],
    ["currentStepOrder", "current_step_order", "stepOrder", "step_order"],
    ["enteredAt", "entered_at"],
    ["exitedAt", "exited_at"],
    ["lastActivityAt", "last_activity_at"],
    ["events", "stepEvents", "step_events", "history"],
  ],
  journeyStepEvents: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["enrollmentExternalId", "enrollment_external_id", "journeyEnrollmentId", "journey_enrollment_id", "enrollmentId", "enrollment_id"],
    ["journeyExternalId", "journey_external_id", "journeyId", "journey_id"],
    ["contactExternalId", "contact_external_id", "contactId", "contact_id"],
    ["stepOrder", "step_order", "order"],
    ["eventType", "event_type", "type", "status"],
    ["eventAt", "event_at", "createdAt", "created_at", "updatedAt", "updated_at"],
    ["channel"],
  ],
  audiences: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["name", "title"],
    ["description"],
    ["listType", "list_type", "type"],
    ["rules", "ruleConfig", "rule_config", "filters"],
    ["contactExternalIds", "contact_external_ids", "contactIds", "contact_ids", "members"],
    ["updatedAt", "updated_at"],
  ],
} as const;

function fieldCoverageForPayload(payload: unknown[], aliasGroups: readonly (readonly string[])[]) {
  const exportedFields = Array.from(new Set(
    payload.flatMap((item) => Object.keys(asRecord(item)).filter((key) => !key.startsWith("__vyva"))),
  )).sort();
  const firstClassFields = exportedFields.filter((field) => aliasGroups.some((aliases) => (aliases as readonly string[]).includes(field)));
  const metadataOnlyFields = exportedFields.filter((field) => !firstClassFields.includes(field));
  return {
    exportedFieldCount: exportedFields.length,
    firstClassFieldCount: firstClassFields.length,
    metadataOnlyFieldCount: metadataOnlyFields.length,
    exportedFields,
    firstClassFields,
    metadataOnlyFields,
  };
}

function normalizeChannel(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "whats_app") return "whatsapp";
  if ((marketingChannels as readonly string[]).includes(normalized)) return normalized as typeof marketingChannels[number];
  return "email";
}

function normalizeAudience(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "b2b" || normalized === "business") return "b2b";
  if (normalized === "both" || normalized === "all") return "both";
  return "b2c";
}

function audienceMatchesTarget(rowAudience: string, targetAudience: string) {
  if (targetAudience === "both") return true;
  return rowAudience === targetAudience || rowAudience === "both";
}

function normalizeCampaignStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if ((campaignStatuses as readonly string[]).includes(normalized)) return normalized as typeof campaignStatuses[number];
  if (normalized === "active") return "scheduled";
  return "draft";
}

function normalizeContentStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if ((contentStatuses as readonly string[]).includes(normalized)) return normalized as typeof contentStatuses[number];
  if (normalized === "active") return "published";
  return "draft";
}

function normalizeJourneyStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if ((journeyStatuses as readonly string[]).includes(normalized)) return normalized as typeof journeyStatuses[number];
  if (normalized === "published" || normalized === "scheduled") return "active";
  return "draft";
}

function normalizeRecipientStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if ((recipientStatuses as readonly string[]).includes(normalized)) return normalized as typeof recipientStatuses[number];
  return "planned";
}

function normalizeLovableId(row: Record<string, unknown>) {
  return emptyToNull(textFrom(row, ["lovableExternalId", "lovable_external_id", "externalId", "external_id", "id"]));
}

function externalIdVariants(externalId: string | null | undefined, prefixes: string[] = []) {
  const trimmed = emptyToNull(externalId);
  if (!trimmed) return [];
  const variants = [trimmed];
  if (trimmed.includes(":")) {
    const raw = trimmed.split(":").slice(1).join(":");
    if (raw) variants.push(raw);
  } else {
    variants.push(...prefixes.map((prefix) => `${prefix}:${trimmed}`));
  }
  return Array.from(new Set(variants));
}

function lookupByExternalId<T>(map: Map<string, T>, externalId: string | null | undefined, prefixes: string[] = []) {
  for (const variant of externalIdVariants(externalId, prefixes)) {
    const value = map.get(variant);
    if (value !== undefined) return value;
  }
  return undefined;
}

function addExternalIdVariants<T>(map: Map<string, T>, externalId: string | null | undefined, value: T, prefixes: string[] = []) {
  for (const variant of externalIdVariants(externalId, prefixes)) {
    map.set(variant, value);
  }
}

function marketingContactIdLookup(contactRows: MarketingContactRow[]) {
  const contactByExternalId = new Map<string, string>();
  for (const row of contactRows) {
    contactByExternalId.set(row.id, row.id);
    addExternalIdVariants(contactByExternalId, row.lovable_external_id, row.id, ["contact"]);
  }
  return contactByExternalId;
}

function jsonObjectFromLovable(value: unknown, arrayKey: string) {
  const parsed = parseJsonLike(value);
  if (Array.isArray(parsed)) return { [arrayKey]: parsed };
  return asRecord(parsed);
}

function contentDesignJson(row: Record<string, unknown>) {
  const candidates: Array<[unknown, string]> = [
    ...contentValues(row, [
      "designJson",
      "design_json",
      "design",
      "emailDesign",
      "email_design",
      "layout",
      "blocks",
      "sections",
      "components",
      "canvas",
      "builderJson",
      "builder_json",
      "templateJson",
      "template_json",
    ]),
    ...contentValues(row, contentBodyKeys),
  ];
  for (const [value, key] of candidates) {
    const object = jsonObjectFromLovable(value, key);
    if (Object.keys(object).length > 0) return object;
  }
  return {};
}

const designTextKeys = new Set([
  "body",
  "buttonText",
  "button_text",
  "caption",
  "content",
  "copy",
  "description",
  "headline",
  "heading",
  "label",
  "message",
  "plainText",
  "plain_text",
  "preheader",
  "previewText",
  "preview_text",
  "subtitle",
  "subject",
  "text",
  "title",
  "value",
]);

function isUsefulDesignText(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 3) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^[#._a-z0-9-]+$/i.test(trimmed) && !trimmed.includes(" ")) return false;
  return true;
}

function collectDesignText(value: unknown, parentKey = "", seen = new Set<unknown>()): string[] {
  const parsed = parseJsonLike(value);
  if (typeof parsed === "string") {
    return designTextKeys.has(parentKey) && isUsefulDesignText(parsed) ? [parsed.trim()] : [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  if (seen.has(parsed)) return [];
  seen.add(parsed);
  if (Array.isArray(parsed)) return parsed.flatMap((item) => collectDesignText(item, parentKey, seen));
  return Object.entries(parsed as Record<string, unknown>).flatMap(([key, nested]) => collectDesignText(nested, key, seen));
}

function contentBodyFromDesign(designJson: Record<string, unknown>) {
  return uniqueTextArray(collectDesignText(designJson)).slice(0, 12).join("\n\n");
}

function contentBodyFromRow(row: Record<string, unknown>) {
  for (const key of contentBodyKeys) {
    const value = contentFieldSources(row).find((source) => source[key] !== undefined)?.[key];
    if (typeof value === "string" && value.trim()) {
      const parsed = parseJsonLike(value);
      if (typeof parsed === "string") return parsed.trim();
      const extracted = uniqueTextArray(collectDesignText(parsed, key)).slice(0, 12).join("\n\n");
      if (extracted) return extracted;
      continue;
    }
    const extracted = uniqueTextArray(collectDesignText(value, key)).slice(0, 12).join("\n\n");
    if (extracted) return extracted;
  }
  return "";
}

function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

function marketingContentPlainBody(content: MarketingContentAssetRow, campaignObjective = "") {
  return content.body?.trim()
    || (content.html_body ? textFromHtml(content.html_body) : "")
    || campaignObjective
    || content.title;
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function serializeContent(row: MarketingContentAssetRow) {
  const mediaAssets = Array.isArray(row.media_assets) ? row.media_assets : [];
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    language: row.language,
    status: row.status,
    subject: row.subject,
    body: row.body,
    htmlBody: row.html_body,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    designJson: row.design_json,
    mediaAssets,
    hasHtml: Boolean(row.html_body?.trim()),
    hasDesign: Object.keys(asRecord(row.design_json)).length > 0,
    mediaAssetCount: mediaAssets.length,
    source: row.source,
    lovableExternalId: row.lovable_external_id,
    metadata: row.metadata,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeMediaAsset(row: MarketingMediaAssetRow) {
  return {
    id: row.id,
    contentAssetId: row.content_asset_id,
    source: row.source,
    assetType: row.asset_type,
    originalUrl: row.original_url,
    localUrl: row.local_url,
    status: row.status,
    lovableExternalId: row.lovable_external_id,
    metadata: row.metadata,
    lastSyncedAt: iso(row.last_synced_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeCampaignChannel(row: MarketingCampaignChannelRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    channel: row.channel,
    contentAssetId: row.content_asset_id,
    scheduledAt: iso(row.scheduled_at),
    status: row.status,
    sendCapability: row.send_capability,
    metadata: row.metadata,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeCampaignMetric(row: MarketingCampaignMetricRow, campaignName?: string | null) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignName: campaignName ?? null,
    channel: row.channel,
    metricDate: iso(row.metric_date),
    sent: row.sent,
    delivered: row.delivered,
    opened: row.opened,
    clicked: row.clicked,
    bounced: row.bounced,
    unsubscribed: row.unsubscribed,
    replied: row.replied,
    socialEngagement: row.social_engagement,
    source: row.source,
    lovableExternalId: row.lovable_external_id,
    metadata: row.metadata,
    lastSyncedAt: iso(row.last_synced_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeRecipient(row: MarketingCampaignRecipientRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contactId: row.contact_id,
    profileId: row.profile_id,
    channel: row.channel,
    recipient: row.recipient,
    status: row.status,
    scheduledAt: iso(row.scheduled_at),
    snapshot: row.snapshot,
    communicationLogId: row.communication_log_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeCampaign(row: MarketingCampaignRow, channels: MarketingCampaignChannelRow[] = [], recipients: MarketingCampaignRecipientRow[] = []) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    audienceType: row.audience_type,
    objective: row.objective,
    scheduleStartsAt: iso(row.schedule_starts_at),
    scheduleEndsAt: iso(row.schedule_ends_at),
    timezone: row.timezone,
    source: row.source,
    lovableExternalId: row.lovable_external_id,
    metadata: row.metadata,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    channels: channels.map(serializeCampaignChannel),
    recipientCount: recipients.length,
    recipients: recipients.slice(0, 100).map(serializeRecipient),
  };
}

function serializeJourneyStep(row: MarketingJourneyStepRow) {
  return {
    id: row.id,
    journeyId: row.journey_id,
    stepOrder: row.step_order,
    channel: row.channel,
    contentAssetId: row.content_asset_id,
    delayHours: row.delay_hours,
    kind: row.kind,
    dayOffset: row.day_offset,
    templateKind: row.template_kind,
    templateRef: row.template_ref,
    config: row.config,
    status: row.status,
    metadata: row.metadata,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeJourney(row: MarketingJourneyRow, steps: MarketingJourneyStepRow[] = []) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    audienceType: row.audience_type,
    objective: row.objective,
    triggerType: row.trigger_type,
    triggerConfig: row.trigger_config,
    goalType: row.goal_type,
    goalConfig: row.goal_config,
    exitOnGoal: row.exit_on_goal,
    source: row.source,
    lovableExternalId: row.lovable_external_id,
    metadata: row.metadata,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    steps: steps.map(serializeJourneyStep),
  };
}

function serializeContact(row: MarketingContactRow, audienceListNames: string[] = []) {
  const metadata = asRecord(row.metadata);
  const lovable = asRecord(metadata.lovable);
  const segmentation = asRecord(metadata.segmentation);
  const lists = [
    ...audienceListNames,
    ...textArrayFrom(lovable.lists),
    ...textArrayFrom(lovable.listNames),
    ...textArrayFrom(lovable.audiences),
    ...textArrayFrom(lovable.memberships),
    ...textArrayFrom(metadata.lists),
  ];
  return {
    id: row.id,
    audienceType: row.audience_type,
    profileId: row.profile_id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    whatsappNumber: row.whatsapp_number,
    roleLabel: row.role_label,
    companyName: row.company_name,
    consentStatus: row.consent_status,
    source: row.source,
    channelAvailability: row.channel_availability,
    tags: row.tags ?? [],
    language: row.language ?? nestedText(segmentation, lovable, metadata, ["language", "lang", "locale"]),
    category: row.category ?? nestedText(segmentation, lovable, metadata, ["category", "contactCategory", "contact_category"]),
    vertical: row.vertical ?? nestedText(segmentation, lovable, metadata, ["vertical", "industry", "sector"]),
    market: row.market ?? nestedText(segmentation, lovable, metadata, ["market", "country", "region"]),
    lists: Array.from(new Set(lists)),
    lovableExternalId: row.lovable_external_id,
    lastSyncedAt: iso(row.last_synced_at),
    metadata: row.metadata,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeAudience(
  row: MarketingAudienceRow,
  members: MarketingAudienceMemberRow[] = [],
  contactsById: Map<string, MarketingContactRow> = new Map(),
) {
  const contactExternalIds = members
    .map((member) => member.contact_external_id)
    .filter((value): value is string => Boolean(value));
  const memberPreview = members.flatMap((member) => {
    if (!member.contact_id) return [];
    const contact = contactsById.get(member.contact_id);
    if (!contact) return [];
    return [{
      id: contact.id,
      fullName: contact.full_name,
      email: contact.email,
      phoneNumber: contact.phone_number,
      whatsappNumber: contact.whatsapp_number,
      companyName: contact.company_name,
      roleLabel: contact.role_label,
      lovableExternalId: contact.lovable_external_id,
      contactExternalId: member.contact_external_id,
    }];
  }).slice(0, 12);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    listType: row.list_type,
    rules: row.rules,
    source: row.source,
    lovableExternalId: row.lovable_external_id,
    memberCount: members.length,
    mappedMemberCount: members.filter((member) => Boolean(member.contact_id)).length,
    contactExternalIds,
    memberPreview,
    unmappedContactExternalIds: members.filter((member) => !member.contact_id).map((member) => member.contact_external_id),
    lastSyncedAt: iso(row.last_synced_at),
    metadata: row.metadata,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeJourneyStepEvent(row: MarketingJourneyStepEventRow) {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    journeyId: row.journey_id,
    stepId: row.step_id,
    stepOrder: row.step_order,
    eventType: row.event_type,
    eventAt: iso(row.event_at),
    channel: row.channel,
    source: row.source,
    lovableExternalId: row.lovable_external_id,
    metadata: row.metadata,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeJourneyEnrollment(row: MarketingJourneyEnrollmentRow, events: MarketingJourneyStepEventRow[] = []) {
  return {
    id: row.id,
    journeyId: row.journey_id,
    contactId: row.contact_id,
    contactExternalId: row.contact_external_id,
    status: row.status,
    currentStepOrder: row.current_step_order,
    enteredAt: iso(row.entered_at),
    exitedAt: iso(row.exited_at),
    lastActivityAt: iso(row.last_activity_at),
    source: row.source,
    lovableExternalId: row.lovable_external_id,
    metadata: row.metadata,
    events: events.map(serializeJourneyStepEvent),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function serializeSyncRun(row: MarketingSyncRunRow) {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    cursor: row.cursor,
    summary: row.summary,
    error: row.error,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

function channelSendCapabilities() {
  return marketingChannels.map((channel) => ({
    channel,
    sendCapability: channel === "email" ? "enabled" : channel === "whatsapp" ? "future_send_capable" : "planning_only",
    locked: channel !== "email",
    note: channel === "email"
      ? "Email campaign dispatch uses the existing communications dispatcher and Resend provider."
      : channel === "whatsapp"
        ? "WhatsApp marketing dispatch remains locked until consent and template controls are enabled."
        : "Planning/tracking only until social platform integrations are added.",
  }));
}

function sendCapabilityForChannel(channel: string) {
  if (channel === "email") return "enabled";
  if (channel === "whatsapp") return "future_send_capable";
  return "planning_only";
}

function sendMetadataForChannel(channel: string, metadata: Record<string, unknown>) {
  return channel === "email"
    ? { ...metadata, send_locked: false, provider: "communicationDispatcher" }
    : { ...metadata, send_locked: true };
}

function startOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(date = new Date()) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 7);
  return next;
}

async function loadCampaignsBundle() {
  const [campaignRows, channelRows, recipientRows] = await Promise.all([
    db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.updated_at)).limit(500),
    db.select().from(marketingCampaignChannels).orderBy(asc(marketingCampaignChannels.created_at)).limit(2000),
    db.select().from(marketingCampaignRecipients).orderBy(desc(marketingCampaignRecipients.created_at)).limit(5000),
  ]);
  return { campaignRows, channelRows, recipientRows };
}

function groupBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    if (!groupKey) continue;
    const group = map.get(groupKey) ?? [];
    group.push(row);
    map.set(groupKey, group);
  }
  return map;
}

function textMatches(value: unknown, search: string) {
  if (!search) return true;
  return typeof value === "string" && value.toLowerCase().includes(search);
}

adminMarketingRouter.get("/summary", async (_req, res) => {
  try {
    const [contentRows, mediaRows, metricRows, contactRows, audienceRows, journeyRows, enrollmentRows, latestRuns, bundle] = await Promise.all([
      db.select().from(marketingContentAssets).orderBy(desc(marketingContentAssets.updated_at)).limit(1000),
      db.select().from(marketingMediaAssets).orderBy(desc(marketingMediaAssets.updated_at)).limit(2000),
      db.select().from(marketingCampaignMetrics).orderBy(desc(marketingCampaignMetrics.updated_at)).limit(5000),
      db.select().from(marketingContacts).orderBy(desc(marketingContacts.updated_at)).limit(2000),
      db.select().from(marketingAudiences).orderBy(desc(marketingAudiences.updated_at)).limit(1000),
      db.select().from(marketingJourneys).orderBy(desc(marketingJourneys.updated_at)).limit(500),
      db.select().from(marketingJourneyEnrollments).orderBy(desc(marketingJourneyEnrollments.updated_at)).limit(5000),
      db.select().from(marketingSyncRuns).orderBy(desc(marketingSyncRuns.created_at)).limit(5),
      loadCampaignsBundle(),
    ]);

    const weekStart = startOfWeek();
    const weekEnd = endOfWeek();
    const campaignChannelCounts = new Map<string, number>();
    for (const row of bundle.channelRows) {
      campaignChannelCounts.set(row.channel, (campaignChannelCounts.get(row.channel) ?? 0) + 1);
    }
    const contentChannelCounts = new Map<string, number>();
    for (const row of contentRows) {
      contentChannelCounts.set(row.channel, (contentChannelCounts.get(row.channel) ?? 0) + 1);
    }
    const analyticsTotals = metricRows.reduce((totals, row) => ({
      sent: totals.sent + row.sent,
      delivered: totals.delivered + row.delivered,
      opened: totals.opened + row.opened,
      clicked: totals.clicked + row.clicked,
      bounced: totals.bounced + row.bounced,
      unsubscribed: totals.unsubscribed + row.unsubscribed,
      replied: totals.replied + row.replied,
      socialEngagement: totals.socialEngagement + row.social_engagement,
    }), {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      replied: 0,
      socialEngagement: 0,
    });

    return res.json({
      totals: {
        campaigns: bundle.campaignRows.length,
        journeys: journeyRows.length,
        content: contentRows.length,
        mediaAssets: mediaRows.length,
        contacts: contactRows.length,
        audiences: audienceRows.length,
        journeyEnrollments: enrollmentRows.length,
        thisWeek: bundle.campaignRows.filter((row) => row.schedule_starts_at && row.schedule_starts_at >= weekStart && row.schedule_starts_at < weekEnd).length,
        scheduled: bundle.campaignRows.filter((row) => row.status === "scheduled").length,
        published: bundle.campaignRows.filter((row) => row.status === "published").length,
      },
      analyticsTotals,
      byChannel: marketingChannels.map((channel) => ({
        channel,
        campaigns: campaignChannelCounts.get(channel) ?? 0,
        content: contentChannelCounts.get(channel) ?? 0,
      })),
      byAudience: audienceTypes.map((audienceType) => ({
        audienceType,
        campaigns: bundle.campaignRows.filter((row) => audienceMatchesTarget(row.audience_type, audienceType)).length,
        contacts: contactRows.filter((row) => audienceMatchesTarget(row.audience_type, audienceType)).length,
      })),
      lockedSendCapabilities: channelSendCapabilities(),
      emailScheduler: marketingEmailSchedulerStatus(),
      latestSyncRun: latestRuns[0] ? serializeSyncRun(latestRuns[0]) : null,
    });
  } catch (error) {
    console.error("[admin/marketing] summary failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing summary could not be loaded.") });
  }
});

adminMarketingRouter.get("/campaigns", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const status = String(req.query.status ?? "all");
    const audience = String(req.query.audience ?? "all");
    const { campaignRows, channelRows, recipientRows } = await loadCampaignsBundle();
    const channelsByCampaign = groupBy(channelRows, (row) => row.campaign_id);
    const recipientsByCampaign = groupBy(recipientRows, (row) => row.campaign_id);
    const campaigns = campaignRows
      .filter((row) => status === "all" || row.status === status)
      .filter((row) => audience === "all" || row.audience_type === audience)
      .filter((row) => !search || textMatches(row.name, search) || textMatches(row.objective, search) || textMatches(row.source, search))
      .map((row) => serializeCampaign(row, channelsByCampaign.get(row.id), recipientsByCampaign.get(row.id)));
    return res.json({ campaigns });
  } catch (error) {
    console.error("[admin/marketing] campaigns load failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing campaigns could not be loaded.") });
  }
});

adminMarketingRouter.get("/analytics", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const channel = String(req.query.channel ?? "all");
    const [metricRows, campaignRows] = await Promise.all([
      db.select().from(marketingCampaignMetrics).orderBy(desc(marketingCampaignMetrics.updated_at)).limit(5000),
      db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.updated_at)).limit(1000),
    ]);
    const campaignNameById = new Map(campaignRows.map((row) => [row.id, row.name]));
    const metrics = metricRows
      .filter((row) => channel === "all" || row.channel === channel)
      .filter((row) => !search || textMatches(row.channel, search) || textMatches(row.source, search) || textMatches(row.lovable_external_id, search) || textMatches(campaignNameById.get(row.campaign_id ?? ""), search))
      .map((row) => serializeCampaignMetric(row, campaignNameById.get(row.campaign_id ?? "")));
    const totals = metrics.reduce((sum, row) => ({
      sent: sum.sent + row.sent,
      delivered: sum.delivered + row.delivered,
      opened: sum.opened + row.opened,
      clicked: sum.clicked + row.clicked,
      bounced: sum.bounced + row.bounced,
      unsubscribed: sum.unsubscribed + row.unsubscribed,
      replied: sum.replied + row.replied,
      socialEngagement: sum.socialEngagement + row.socialEngagement,
    }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, replied: 0, socialEngagement: 0 });
    return res.json({ totals, metrics });
  } catch (error) {
    console.error("[admin/marketing] analytics load failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing analytics could not be loaded.") });
  }
});

adminMarketingRouter.post("/campaigns", async (req, res) => {
  const parsed = campaignBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const now = new Date();
    const [campaign] = await db.insert(marketingCampaigns).values({
      name: parsed.data.name,
      status: parsed.data.status,
      audience_type: parsed.data.audienceType,
      objective: parsed.data.objective,
      schedule_starts_at: dateOrNull(parsed.data.scheduleStartsAt),
      schedule_ends_at: dateOrNull(parsed.data.scheduleEndsAt),
      timezone: parsed.data.timezone,
      source: parsed.data.source,
      lovable_external_id: emptyToNull(parsed.data.lovableExternalId),
      metadata: parsed.data.metadata,
      created_by: actor(req),
      updated_by: actor(req),
      updated_at: now,
    }).returning();

    const channels = parsed.data.channels.length
      ? await db.insert(marketingCampaignChannels).values(parsed.data.channels.map((item) => ({
        campaign_id: campaign.id,
        channel: item.channel,
        content_asset_id: item.contentAssetId ?? null,
        scheduled_at: dateOrNull(item.scheduledAt),
        status: item.status,
        send_capability: sendCapabilityForChannel(item.channel),
        metadata: sendMetadataForChannel(item.channel, item.metadata),
        updated_at: now,
      }))).returning()
      : [];

    const recipients = parsed.data.recipients.length
      ? await db.insert(marketingCampaignRecipients).values(parsed.data.recipients.map((item) => ({
        campaign_id: campaign.id,
        contact_id: item.contactId ?? null,
        profile_id: item.profileId ?? null,
        channel: item.channel,
        recipient: item.recipient,
        status: item.status,
        scheduled_at: dateOrNull(item.scheduledAt),
        snapshot: { ...item.snapshot, dispatch_locked: true, source: "marketing_admin_snapshot" },
      }))).returning()
      : [];

    return res.status(201).json({ ok: true, campaign: serializeCampaign(campaign, channels, recipients) });
  } catch (error) {
    console.error("[admin/marketing] campaign create failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing campaign could not be created.") });
  }
});

adminMarketingRouter.patch("/campaigns/:campaignId", async (req, res) => {
  const parsed = campaignPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const bodyRecord = asRecord(req.body);

  const patch: Partial<typeof marketingCampaigns.$inferInsert> = {
    updated_at: new Date(),
    updated_by: actor(req),
  };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.audienceType !== undefined) patch.audience_type = parsed.data.audienceType;
  if (parsed.data.objective !== undefined) patch.objective = parsed.data.objective;
  if (parsed.data.scheduleStartsAt !== undefined) patch.schedule_starts_at = dateOrNull(parsed.data.scheduleStartsAt);
  if (parsed.data.scheduleEndsAt !== undefined) patch.schedule_ends_at = dateOrNull(parsed.data.scheduleEndsAt);
  if (parsed.data.timezone !== undefined) patch.timezone = parsed.data.timezone;
  if (parsed.data.source !== undefined) patch.source = parsed.data.source;
  if (parsed.data.lovableExternalId !== undefined) patch.lovable_external_id = emptyToNull(parsed.data.lovableExternalId);
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;

  try {
    const [campaign] = await db.update(marketingCampaigns)
      .set(patch)
      .where(eq(marketingCampaigns.id, req.params.campaignId))
      .returning();
    if (!campaign) return res.status(404).json({ error: "Marketing campaign not found." });
    const now = new Date();
    if (Object.prototype.hasOwnProperty.call(bodyRecord, "channels")) {
      await db.delete(marketingCampaignChannels).where(eq(marketingCampaignChannels.campaign_id, campaign.id));
      if (parsed.data.channels.length) {
        await db.insert(marketingCampaignChannels).values(parsed.data.channels.map((item) => ({
          campaign_id: campaign.id,
          channel: item.channel,
          content_asset_id: item.contentAssetId ?? null,
          scheduled_at: dateOrNull(item.scheduledAt),
          status: item.status,
          send_capability: sendCapabilityForChannel(item.channel),
          metadata: sendMetadataForChannel(item.channel, item.metadata),
          updated_at: now,
        })));
      }
    }
    if (Object.prototype.hasOwnProperty.call(bodyRecord, "recipients")) {
      await db.delete(marketingCampaignRecipients).where(eq(marketingCampaignRecipients.campaign_id, campaign.id));
      if (parsed.data.recipients.length) {
        await db.insert(marketingCampaignRecipients).values(parsed.data.recipients.map((item) => ({
          campaign_id: campaign.id,
          contact_id: item.contactId ?? null,
          profile_id: item.profileId ?? null,
          channel: item.channel,
          recipient: item.recipient,
          status: item.status,
          scheduled_at: dateOrNull(item.scheduledAt),
          snapshot: { ...item.snapshot, dispatch_locked: true, source: "marketing_admin_snapshot" },
        })));
      }
    }
    const [channels, recipients] = await Promise.all([
      db.select().from(marketingCampaignChannels).where(eq(marketingCampaignChannels.campaign_id, campaign.id)).orderBy(asc(marketingCampaignChannels.created_at)),
      db.select().from(marketingCampaignRecipients).where(eq(marketingCampaignRecipients.campaign_id, campaign.id)).orderBy(desc(marketingCampaignRecipients.created_at)),
    ]);
    return res.json({ ok: true, campaign: serializeCampaign(campaign, channels, recipients) });
  } catch (error) {
    console.error("[admin/marketing] campaign update failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing campaign could not be updated.") });
  }
});

adminMarketingRouter.delete("/campaigns/:campaignId", async (req, res) => {
  try {
    const [campaign] = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, req.params.campaignId)).limit(1);
    if (!campaign) return res.status(404).json({ error: "Marketing campaign not found." });
    await db.delete(marketingCampaignRecipients).where(eq(marketingCampaignRecipients.campaign_id, campaign.id));
    await db.delete(marketingCampaignChannels).where(eq(marketingCampaignChannels.campaign_id, campaign.id));
    await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, campaign.id));
    return res.json({ ok: true, deletedCampaignId: campaign.id });
  } catch (error) {
    console.error("[admin/marketing] campaign delete failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing campaign could not be deleted.") });
  }
});

adminMarketingRouter.post("/campaigns/:campaignId/test-email", async (req, res) => {
  if (!requireSuperAdmin(req, res, "send marketing test emails")) return;
  const recipient = req.user?.email?.trim();
  if (!recipient) return res.status(400).json({ error: "Your admin account needs an email address for a test send." });

  try {
    const [campaign] = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, req.params.campaignId)).limit(1);
    if (!campaign) return res.status(404).json({ error: "Marketing campaign not found." });

    const channelRows = await db.select()
      .from(marketingCampaignChannels)
      .where(eq(marketingCampaignChannels.campaign_id, campaign.id))
      .orderBy(asc(marketingCampaignChannels.created_at));
    const emailChannel = channelRows.find((row) => row.channel === "email");
    if (!emailChannel) return res.status(400).json({ error: "Add an Email channel before sending a test email." });
    if (!emailChannel.content_asset_id) return res.status(400).json({ error: "Attach an email content asset before sending a test email." });

    const [content] = await db.select()
      .from(marketingContentAssets)
      .where(eq(marketingContentAssets.id, emailChannel.content_asset_id))
      .limit(1);
    if (!content) return res.status(400).json({ error: "The selected email content asset could not be found." });
    if (content.channel !== "email") return res.status(400).json({ error: "The selected content asset is not an email asset." });

    const subject = `[TEST] ${content.subject || content.title}`;
    const [communication] = await db.insert(communicationsLog).values({
      user_id: String(req.user?.id ?? req.user?.email ?? ""),
      channel: "email",
      recipient,
      purpose: "marketing_campaign_test",
      status: "queued",
      body: marketingContentPlainBody(content, campaign.objective),
      metadata: {
        subject,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        content_asset_id: content.id,
        content_title: content.title,
        htmlBody: content.html_body,
        ctaLabel: content.cta_label,
        ctaUrl: content.cta_url,
        initiated_by: actor(req),
        marketing_test_send: true,
      },
    }).returning();

    const dispatchResult = await dispatchCommunicationsByIds([communication.id]);
    const delivery = dispatchResult.results[0] ?? null;
    if (!delivery || delivery.status === "failed") {
      return res.status(502).json({
        error: delivery?.error || "Test email could not be sent.",
        communication: { id: communication.id, recipient, status: "failed" },
        delivery,
      });
    }

    return res.json({
      ok: true,
      communication: { id: communication.id, recipient, status: delivery.status },
      delivery,
    });
  } catch (error) {
    console.error("[admin/marketing] campaign test email failed", error);
    return res.status(500).json({ error: "Marketing test email could not be sent." });
  }
});

export async function sendMarketingCampaignEmail(campaignId: string, actorLabel: string) {
  const [campaign] = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, campaignId)).limit(1);
  if (!campaign) return { statusCode: 404, body: { error: "Marketing campaign not found." } };

  const [allChannelRows, allRecipientRows] = await Promise.all([
    db.select().from(marketingCampaignChannels).where(eq(marketingCampaignChannels.campaign_id, campaign.id)).orderBy(asc(marketingCampaignChannels.created_at)),
    db.select().from(marketingCampaignRecipients).where(eq(marketingCampaignRecipients.campaign_id, campaign.id)).orderBy(asc(marketingCampaignRecipients.created_at)),
  ]);
  const channelRows = allChannelRows.filter((row) => row.campaign_id === campaign.id);
  const recipientRows = allRecipientRows.filter((row) => row.campaign_id === campaign.id);
  const emailChannel = channelRows.find((row) => row.channel === "email");
  if (!emailChannel) return { statusCode: 400, body: { error: "Add an Email channel before sending this campaign." } };
  if (!emailChannel.content_asset_id) return { statusCode: 400, body: { error: "Attach an email content asset before sending this campaign." } };

  const [content] = await db.select()
    .from(marketingContentAssets)
    .where(eq(marketingContentAssets.id, emailChannel.content_asset_id))
    .limit(1);
  if (!content) return { statusCode: 400, body: { error: "The selected email content asset could not be found." } };
  if (content.channel !== "email") return { statusCode: 400, body: { error: "The selected content asset is not an email asset." } };

  const emailRecipients = recipientRows.filter((row) => row.channel === "email" && row.recipient?.trim());
  if (!emailRecipients.length) return { statusCode: 400, body: { error: "Snapshot email recipients before sending this campaign." } };

  const contactIds = Array.from(new Set(emailRecipients.map((row) => row.contact_id).filter(Boolean))) as string[];
  const recipientEmails = Array.from(new Set(emailRecipients.map((row) => row.recipient.trim().toLowerCase()).filter(Boolean)));
  const contactRows = contactIds.length
    ? await db.select().from(marketingContacts).where(inArray(marketingContacts.id, contactIds))
    : [];
  const emailContactRows = recipientEmails.length
    ? await db.select().from(marketingContacts).where(inArray(marketingContacts.email, recipientEmails))
    : [];
  const contactsById = new Map(contactRows.map((row) => [row.id, row]));
  const contactsByEmail = new Map<string, MarketingContactRow>();
  for (const row of emailContactRows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    const existing = contactsByEmail.get(email);
    if (!existing || row.consent_status === "opted_out") contactsByEmail.set(email, row);
  }
  const seenRecipients = new Set<string>();
  const sendableRecipients: MarketingCampaignRecipientRow[] = [];
  const skipped: Array<{ id: string; recipient: string; reason: string }> = [];

  for (const recipientRow of emailRecipients) {
    const normalizedRecipient = recipientRow.recipient.trim().toLowerCase();
    const linkedContact = recipientRow.contact_id ? contactsById.get(recipientRow.contact_id) : null;
    const emailContact = contactsByEmail.get(normalizedRecipient) ?? null;
    const snapshot = asRecord(recipientRow.snapshot);
    const consentStatus = String(
      emailContact?.consent_status === "opted_out"
        ? "opted_out"
        : linkedContact?.consent_status ?? emailContact?.consent_status ?? snapshot.consentStatus ?? "",
    ).toLowerCase();
    if (recipientRow.status === "sent") {
      skipped.push({ id: recipientRow.id, recipient: recipientRow.recipient, reason: "already_sent" });
      continue;
    }
    if (recipientRow.status === "blocked" || consentStatus === "opted_out") {
      skipped.push({ id: recipientRow.id, recipient: recipientRow.recipient, reason: consentStatus === "opted_out" ? "opted_out" : "blocked" });
      continue;
    }
    if (seenRecipients.has(normalizedRecipient)) {
      skipped.push({ id: recipientRow.id, recipient: recipientRow.recipient, reason: "duplicate_recipient" });
      continue;
    }
    seenRecipients.add(normalizedRecipient);
    sendableRecipients.push(recipientRow);
  }

  if (!sendableRecipients.length) {
    return {
      statusCode: 400,
      body: {
        error: "No eligible unsent email recipients are available for this campaign.",
        skippedCount: skipped.length,
        skipped,
      },
    };
  }

  const now = new Date();
  const subject = content.subject || content.title;
  const communicationRows = await db.insert(communicationsLog).values(sendableRecipients.map((recipientRow) => ({
    user_id: recipientRow.profile_id ?? recipientRow.contact_id ?? campaign.id,
    channel: "email",
    recipient: recipientRow.recipient.trim(),
    purpose: "marketing_campaign_email",
    status: "queued",
    body: marketingContentPlainBody(content, campaign.objective),
    metadata: {
      subject,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      content_asset_id: content.id,
      content_title: content.title,
      htmlBody: content.html_body,
      ctaLabel: content.cta_label,
      ctaUrl: content.cta_url,
      marketing_campaign_send: true,
      marketing_recipient_id: recipientRow.id,
      contact_id: recipientRow.contact_id,
      profile_id: recipientRow.profile_id,
      initiated_by: actorLabel,
    },
  }))).returning();

  const dispatchResult = await dispatchCommunicationsByIds(communicationRows.map((row) => row.id));
  const deliveryById = new Map(dispatchResult.results.map((delivery) => [delivery.id, delivery]));
  let sentCount = 0;
  let failedCount = 0;

  for (let index = 0; index < sendableRecipients.length; index += 1) {
    const recipientRow = sendableRecipients[index];
    const communication = communicationRows[index];
    const delivery = communication ? deliveryById.get(communication.id) : null;
    const sent = delivery?.status === "sent";
    if (sent) sentCount += 1;
    else failedCount += 1;
    await db.update(marketingCampaignRecipients).set({
      status: sent ? "sent" : "failed",
      communication_log_id: communication?.id ?? null,
      updated_at: now,
      snapshot: {
        ...asRecord(recipientRow.snapshot),
        dispatch_attempted_at: now.toISOString(),
        dispatch_status: sent ? "sent" : "failed",
        dispatch_error: delivery?.error ?? null,
        communication_log_id: communication?.id ?? null,
      },
    }).where(eq(marketingCampaignRecipients.id, recipientRow.id)).returning();
  }

  const sendSummary = {
    sent: sentCount,
    failed: failedCount,
    skipped: skipped.length,
    attempted: sendableRecipients.length,
    content_asset_id: content.id,
    sent_at: now.toISOString(),
  };
  const [updatedCampaign] = await db.update(marketingCampaigns).set({
    status: sentCount > 0 ? "published" : campaign.status,
    updated_at: now,
    updated_by: actorLabel,
    metadata: {
      ...asRecord(campaign.metadata),
      last_email_send: sendSummary,
    },
  }).where(eq(marketingCampaigns.id, campaign.id)).returning();

  const [freshCampaignRows, freshRecipientRows] = await Promise.all([
    db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, campaign.id)).limit(1),
    db.select().from(marketingCampaignRecipients).where(eq(marketingCampaignRecipients.campaign_id, campaign.id)).orderBy(desc(marketingCampaignRecipients.created_at)),
  ]);
  const freshCampaign = freshCampaignRows[0] ?? updatedCampaign ?? campaign;

  return {
    statusCode: 200,
    body: {
      ok: failedCount === 0,
      sentCount,
      failedCount,
      skippedCount: skipped.length,
      skipped,
      delivery: dispatchResult.results,
      campaign: serializeCampaign(freshCampaign, channelRows, freshRecipientRows),
    },
  };
}

export async function sendDueMarketingCampaignEmails(actorLabel: string, now = new Date()) {
  const [campaignRows, channelRows] = await Promise.all([
    db.select().from(marketingCampaigns).where(eq(marketingCampaigns.status, "scheduled")).orderBy(asc(marketingCampaigns.schedule_starts_at)),
    db.select().from(marketingCampaignChannels).where(eq(marketingCampaignChannels.channel, "email")).orderBy(asc(marketingCampaignChannels.scheduled_at)),
  ]);
  const emailChannelByCampaign = new Map(channelRows.filter((row) => row.channel === "email").map((row) => [row.campaign_id, row]));
  const dueCampaigns = campaignRows.filter((campaign) => campaign.status === "scheduled").filter((campaign) => {
    const emailChannel = emailChannelByCampaign.get(campaign.id);
    if (!emailChannel) return false;
    const dueAt = emailChannel.scheduled_at ?? campaign.schedule_starts_at;
    return Boolean(dueAt && dueAt <= now);
  });

  const results = [];
  for (const campaign of dueCampaigns) {
    try {
      const result = await sendMarketingCampaignEmail(campaign.id, actorLabel);
      const body = asRecord(result.body);
      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        statusCode: result.statusCode,
        ok: result.statusCode >= 200 && result.statusCode < 300 && body.ok !== false,
        sentCount: numberFrom(body, ["sentCount"]),
        failedCount: numberFrom(body, ["failedCount"]),
        skippedCount: numberFrom(body, ["skippedCount"]),
        error: typeof body.error === "string" ? body.error : null,
      });
    } catch (error) {
      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        statusCode: 500,
        ok: false,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        error: error instanceof Error ? error.message : "Campaign email could not be sent.",
      });
    }
  }

  const sentCount = results.reduce((sum, item) => sum + item.sentCount, 0);
  const failedCount = results.reduce((sum, item) => sum + item.failedCount + (item.statusCode >= 500 ? 1 : 0), 0);
  const skippedCount = results.reduce((sum, item) => sum + item.skippedCount + (item.statusCode >= 400 && item.statusCode < 500 ? 1 : 0), 0);
  return {
    ok: failedCount === 0,
    checkedAt: now.toISOString(),
    dueCount: dueCampaigns.length,
    sentCount,
    failedCount,
    skippedCount,
    results,
  };
}

adminMarketingRouter.post("/campaigns/:campaignId/send-email", async (req, res) => {
  if (!requireSuperAdmin(req, res, "send marketing campaign emails")) return;

  try {
    const result = await sendMarketingCampaignEmail(req.params.campaignId, actor(req));
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("[admin/marketing] campaign email send failed", error);
    return res.status(500).json({ error: "Marketing campaign email could not be sent." });
  }
});

adminMarketingRouter.post("/campaigns/send-due-email", async (req, res) => {
  if (!requireSuperAdmin(req, res, "send due scheduled marketing emails")) return;

  try {
    return res.json(await sendDueMarketingCampaignEmails(actor(req)));
  } catch (error) {
    console.error("[admin/marketing] due campaign email send failed", error);
    return res.status(500).json({ error: "Due scheduled marketing emails could not be sent." });
  }
});

adminMarketingRouter.get("/content", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const channel = String(req.query.channel ?? "all");
    const status = String(req.query.status ?? "all");
    const rows = await db.select().from(marketingContentAssets).orderBy(desc(marketingContentAssets.updated_at)).limit(1000);
    const content = rows
      .filter((row) => channel === "all" || row.channel === channel)
      .filter((row) => status === "all" || row.status === status)
      .filter((row) => !search || textMatches(row.title, search) || textMatches(row.subject, search) || textMatches(row.body, search) || textMatches(row.html_body, search))
      .map(serializeContent);
    return res.json({ content });
  } catch (error) {
    console.error("[admin/marketing] content load failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing content could not be loaded.") });
  }
});

adminMarketingRouter.get("/media", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const status = String(req.query.status ?? "all");
    const [mediaRows, contentRows] = await Promise.all([
      db.select().from(marketingMediaAssets).orderBy(desc(marketingMediaAssets.updated_at)).limit(2000),
      db.select().from(marketingContentAssets).orderBy(desc(marketingContentAssets.updated_at)).limit(1000),
    ]);
    const contentTitleById = new Map(contentRows.map((row) => [row.id, row.title]));
    const mediaAssets = mediaRows
      .filter((row) => status === "all" || row.status === status)
      .filter((row) => !search || textMatches(row.original_url, search) || textMatches(row.local_url, search) || textMatches(row.asset_type, search) || textMatches(contentTitleById.get(row.content_asset_id ?? ""), search))
      .map((row) => ({
        ...serializeMediaAsset(row),
        contentTitle: contentTitleById.get(row.content_asset_id ?? "") ?? null,
      }));
    return res.json({ mediaAssets });
  } catch (error) {
    console.error("[admin/marketing] media load failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing media assets could not be loaded.") });
  }
});

adminMarketingRouter.patch("/media/:mediaId", async (req, res) => {
  const parsed = mediaPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const patch: Partial<typeof marketingMediaAssets.$inferInsert> = {
    updated_at: new Date(),
  };
  if (parsed.data.contentAssetId !== undefined) patch.content_asset_id = parsed.data.contentAssetId ?? null;
  if (parsed.data.source !== undefined) patch.source = parsed.data.source;
  if (parsed.data.assetType !== undefined) patch.asset_type = parsed.data.assetType;
  if (parsed.data.originalUrl !== undefined) patch.original_url = parsed.data.originalUrl;
  if (parsed.data.localUrl !== undefined) patch.local_url = emptyToNull(parsed.data.localUrl);
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.lovableExternalId !== undefined) patch.lovable_external_id = emptyToNull(parsed.data.lovableExternalId);
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
  try {
    const [asset] = await db.update(marketingMediaAssets).set(patch).where(eq(marketingMediaAssets.id, req.params.mediaId)).returning();
    if (!asset) return res.status(404).json({ error: "Marketing media asset not found." });
    const [content] = asset.content_asset_id
      ? await db.select().from(marketingContentAssets).where(eq(marketingContentAssets.id, asset.content_asset_id)).limit(1)
      : [];
    return res.json({
      ok: true,
      mediaAsset: {
        ...serializeMediaAsset(asset),
        contentTitle: content?.title ?? null,
      },
    });
  } catch (error) {
    console.error("[admin/marketing] media update failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing media asset could not be updated.") });
  }
});

adminMarketingRouter.delete("/media/:mediaId", async (req, res) => {
  try {
    const [asset] = await db.select().from(marketingMediaAssets).where(eq(marketingMediaAssets.id, req.params.mediaId)).limit(1);
    if (!asset) return res.status(404).json({ error: "Marketing media asset not found." });
    await db.delete(marketingMediaAssets).where(eq(marketingMediaAssets.id, asset.id));
    return res.json({ ok: true, deletedMediaAssetId: asset.id });
  } catch (error) {
    console.error("[admin/marketing] media delete failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing media asset could not be deleted.") });
  }
});

adminMarketingRouter.post("/content", async (req, res) => {
  const parsed = contentBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const [content] = await db.insert(marketingContentAssets).values({
      title: parsed.data.title,
      channel: parsed.data.channel,
      language: parsed.data.language,
      status: parsed.data.status,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      html_body: parsed.data.htmlBody ?? null,
      cta_label: parsed.data.ctaLabel ?? null,
      cta_url: parsed.data.ctaUrl ?? null,
      design_json: parsed.data.designJson,
      media_assets: parsed.data.mediaAssets,
      source: parsed.data.source,
      lovable_external_id: emptyToNull(parsed.data.lovableExternalId),
      metadata: parsed.data.metadata,
      created_by: actor(req),
      updated_by: actor(req),
      updated_at: new Date(),
    }).returning();
    await replaceContentMediaAssetReferences(content, parsed.data.mediaAssets, new Date(), parsed.data.source);
    return res.status(201).json({ ok: true, content: serializeContent(content) });
  } catch (error) {
    console.error("[admin/marketing] content create failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing content could not be created.") });
  }
});

adminMarketingRouter.patch("/content/:contentId", async (req, res) => {
  const parsed = contentPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const patch: Partial<typeof marketingContentAssets.$inferInsert> = {
    updated_at: new Date(),
    updated_by: actor(req),
  };
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.channel !== undefined) patch.channel = parsed.data.channel;
  if (parsed.data.language !== undefined) patch.language = parsed.data.language;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.subject !== undefined) patch.subject = parsed.data.subject ?? null;
  if (parsed.data.body !== undefined) patch.body = parsed.data.body;
  if (parsed.data.htmlBody !== undefined) patch.html_body = parsed.data.htmlBody ?? null;
  if (parsed.data.ctaLabel !== undefined) patch.cta_label = parsed.data.ctaLabel ?? null;
  if (parsed.data.ctaUrl !== undefined) patch.cta_url = parsed.data.ctaUrl ?? null;
  if (parsed.data.designJson !== undefined) patch.design_json = parsed.data.designJson;
  if (parsed.data.mediaAssets !== undefined) patch.media_assets = parsed.data.mediaAssets;
  if (parsed.data.source !== undefined) patch.source = parsed.data.source;
  if (parsed.data.lovableExternalId !== undefined) patch.lovable_external_id = emptyToNull(parsed.data.lovableExternalId);
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
  try {
    const [content] = await db.update(marketingContentAssets).set(patch).where(eq(marketingContentAssets.id, req.params.contentId)).returning();
    if (!content) return res.status(404).json({ error: "Marketing content not found." });
    if (parsed.data.mediaAssets !== undefined) {
      await replaceContentMediaAssetReferences(content, parsed.data.mediaAssets, new Date(), content.source);
    }
    return res.json({ ok: true, content: serializeContent(content) });
  } catch (error) {
    console.error("[admin/marketing] content update failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing content could not be updated.") });
  }
});

adminMarketingRouter.delete("/content/:contentId", async (req, res) => {
  try {
    const [content] = await db.select().from(marketingContentAssets).where(eq(marketingContentAssets.id, req.params.contentId)).limit(1);
    if (!content) return res.status(404).json({ error: "Marketing content not found." });
    const [campaignRefs, journeyRefs] = await Promise.all([
      db.select().from(marketingCampaignChannels).where(eq(marketingCampaignChannels.content_asset_id, content.id)).limit(1),
      db.select().from(marketingJourneySteps).where(eq(marketingJourneySteps.content_asset_id, content.id)).limit(1),
    ]);
    const now = new Date();
    await Promise.all([
      campaignRefs.length
        ? db.update(marketingCampaignChannels).set({ content_asset_id: null, updated_at: now }).where(eq(marketingCampaignChannels.content_asset_id, content.id))
        : Promise.resolve(),
      journeyRefs.length
        ? db.update(marketingJourneySteps).set({ content_asset_id: null, updated_at: now }).where(eq(marketingJourneySteps.content_asset_id, content.id))
        : Promise.resolve(),
    ]);
    await db.delete(marketingMediaAssets).where(eq(marketingMediaAssets.content_asset_id, content.id));
    await db.delete(marketingContentAssets).where(eq(marketingContentAssets.id, content.id));
    return res.json({ ok: true, deletedContentId: content.id });
  } catch (error) {
    console.error("[admin/marketing] content delete failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing content could not be deleted.") });
  }
});

adminMarketingRouter.get("/journeys", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const status = String(req.query.status ?? "all");
    const [journeyRows, stepRows] = await Promise.all([
      db.select().from(marketingJourneys).orderBy(desc(marketingJourneys.updated_at)).limit(500),
      db.select().from(marketingJourneySteps).orderBy(asc(marketingJourneySteps.step_order)).limit(3000),
    ]);
    const stepsByJourney = groupBy(stepRows, (row) => row.journey_id);
    const journeys = journeyRows
      .filter((row) => status === "all" || row.status === status)
      .filter((row) => !search || textMatches(row.name, search) || textMatches(row.objective, search))
      .map((row) => serializeJourney(row, stepsByJourney.get(row.id)));
    return res.json({ journeys });
  } catch (error) {
    console.error("[admin/marketing] journeys load failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing journeys could not be loaded.") });
  }
});

adminMarketingRouter.get("/journey-enrollments", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const status = String(req.query.status ?? "all");
    const [enrollmentRows, eventRows, journeyRows] = await Promise.all([
      db.select().from(marketingJourneyEnrollments).orderBy(desc(marketingJourneyEnrollments.updated_at)).limit(5000),
      db.select().from(marketingJourneyStepEvents).orderBy(desc(marketingJourneyStepEvents.event_at)).limit(20000),
      db.select().from(marketingJourneys).orderBy(desc(marketingJourneys.updated_at)).limit(1000),
    ]);
    const eventsByEnrollment = groupBy(eventRows, (row) => row.enrollment_id);
    const journeyNameById = new Map(journeyRows.map((row) => [row.id, row.name]));
    const enrollments = enrollmentRows
      .filter((row) => status === "all" || row.status === status)
      .filter((row) => !search || textMatches(row.contact_external_id, search) || textMatches(row.status, search) || textMatches(journeyNameById.get(row.journey_id), search))
      .map((row) => ({
        ...serializeJourneyEnrollment(row, eventsByEnrollment.get(row.id)),
        journeyName: journeyNameById.get(row.journey_id) ?? null,
      }));
    return res.json({ enrollments });
  } catch (error) {
    console.error("[admin/marketing] journey enrollments load failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing journey enrollments could not be loaded.") });
  }
});

adminMarketingRouter.post("/journeys", async (req, res) => {
  const parsed = journeyBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const now = new Date();
    const [journey] = await db.insert(marketingJourneys).values({
      name: parsed.data.name,
      status: parsed.data.status,
      audience_type: parsed.data.audienceType,
      objective: parsed.data.objective,
      trigger_type: parsed.data.triggerType ?? null,
      trigger_config: parsed.data.triggerConfig,
      goal_type: parsed.data.goalType ?? null,
      goal_config: parsed.data.goalConfig,
      exit_on_goal: parsed.data.exitOnGoal,
      source: parsed.data.source,
      lovable_external_id: emptyToNull(parsed.data.lovableExternalId),
      metadata: parsed.data.metadata,
      created_by: actor(req),
      updated_by: actor(req),
      updated_at: now,
    }).returning();
    const steps = parsed.data.steps.length
      ? await db.insert(marketingJourneySteps).values(parsed.data.steps.map((step) => ({
        journey_id: journey.id,
        step_order: step.stepOrder,
        channel: step.channel,
        content_asset_id: step.contentAssetId ?? null,
        delay_hours: step.delayHours,
        kind: step.kind,
        day_offset: step.dayOffset,
        template_kind: step.templateKind ?? null,
        template_ref: step.templateRef ?? null,
        config: step.config,
        status: step.status,
        metadata: step.metadata,
        updated_at: now,
      }))).returning()
      : [];
    return res.status(201).json({ ok: true, journey: serializeJourney(journey, steps) });
  } catch (error) {
    console.error("[admin/marketing] journey create failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing journey could not be created.") });
  }
});

adminMarketingRouter.patch("/journeys/:journeyId", async (req, res) => {
  const parsed = journeyPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const patch: Partial<typeof marketingJourneys.$inferInsert> = {
    updated_at: new Date(),
    updated_by: actor(req),
  };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.audienceType !== undefined) patch.audience_type = parsed.data.audienceType;
  if (parsed.data.objective !== undefined) patch.objective = parsed.data.objective;
  if (parsed.data.triggerType !== undefined) patch.trigger_type = parsed.data.triggerType ?? null;
  if (parsed.data.triggerConfig !== undefined) patch.trigger_config = parsed.data.triggerConfig;
  if (parsed.data.goalType !== undefined) patch.goal_type = parsed.data.goalType ?? null;
  if (parsed.data.goalConfig !== undefined) patch.goal_config = parsed.data.goalConfig;
  if (parsed.data.exitOnGoal !== undefined) patch.exit_on_goal = parsed.data.exitOnGoal;
  if (parsed.data.source !== undefined) patch.source = parsed.data.source;
  if (parsed.data.lovableExternalId !== undefined) patch.lovable_external_id = emptyToNull(parsed.data.lovableExternalId);
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
  try {
    const [journey] = await db.update(marketingJourneys).set(patch).where(eq(marketingJourneys.id, req.params.journeyId)).returning();
    if (!journey) return res.status(404).json({ error: "Marketing journey not found." });
    if (parsed.data.steps) {
      await db.delete(marketingJourneySteps).where(eq(marketingJourneySteps.journey_id, journey.id));
      if (parsed.data.steps.length) {
        await db.insert(marketingJourneySteps).values(parsed.data.steps.map((step) => ({
          journey_id: journey.id,
          step_order: step.stepOrder,
          channel: step.channel,
          content_asset_id: step.contentAssetId ?? null,
          delay_hours: step.delayHours,
          kind: step.kind,
          day_offset: step.dayOffset,
          template_kind: step.templateKind ?? null,
          template_ref: step.templateRef ?? null,
          config: step.config,
          status: step.status,
          metadata: step.metadata,
          updated_at: new Date(),
        })));
      }
    }
    const steps = await db.select().from(marketingJourneySteps).where(eq(marketingJourneySteps.journey_id, journey.id)).orderBy(asc(marketingJourneySteps.step_order));
    return res.json({ ok: true, journey: serializeJourney(journey, steps) });
  } catch (error) {
    console.error("[admin/marketing] journey update failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing journey could not be updated.") });
  }
});

adminMarketingRouter.delete("/journeys/:journeyId", async (req, res) => {
  try {
    const [journey] = await db.select().from(marketingJourneys).where(eq(marketingJourneys.id, req.params.journeyId)).limit(1);
    if (!journey) return res.status(404).json({ error: "Marketing journey not found." });
    await db.delete(marketingJourneySteps).where(eq(marketingJourneySteps.journey_id, journey.id));
    await db.delete(marketingJourneys).where(eq(marketingJourneys.id, journey.id));
    return res.json({ ok: true, deletedJourneyId: journey.id });
  } catch (error) {
    console.error("[admin/marketing] journey delete failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing journey could not be deleted.") });
  }
});

adminMarketingRouter.get("/audiences", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const [audienceRows, memberRows, contactRows] = await Promise.all([
      db.select().from(marketingAudiences).orderBy(desc(marketingAudiences.updated_at)).limit(1000),
      db.select().from(marketingAudienceMembers).orderBy(asc(marketingAudienceMembers.created_at)).limit(100000),
      db.select().from(marketingContacts).orderBy(desc(marketingContacts.updated_at)).limit(10000),
    ]);
    const membersByAudience = groupBy(memberRows, (row) => row.audience_id);
    const contactsById = new Map(contactRows.map((row) => [row.id, row]));
    const audiences = audienceRows
      .map((row) => serializeAudience(row, membersByAudience.get(row.id), contactsById))
      .filter((audience) => !search || [
        audience.name,
        audience.description,
        audience.listType,
        audience.source,
        audience.lovableExternalId,
        ...audience.unmappedContactExternalIds,
        ...audience.memberPreview.flatMap((member) => [
          member.fullName,
          member.email,
          member.phoneNumber,
          member.whatsappNumber,
          member.companyName,
          member.roleLabel,
          member.lovableExternalId,
          member.contactExternalId,
        ]),
      ].some((value) => textMatches(value, search)));
    return res.json({ audiences });
  } catch (error) {
    console.error("[admin/marketing] audiences load failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing audiences could not be loaded.") });
  }
});

adminMarketingRouter.post("/audiences", async (req, res) => {
  const parsed = audienceBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const now = new Date();
    const contactExternalIds = uniqueTextArray(parsed.data.contactExternalIds);
    const [audience] = await db.insert(marketingAudiences).values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      list_type: parsed.data.listType,
      rules: parsed.data.rules,
      source: parsed.data.source,
      lovable_external_id: emptyToNull(parsed.data.lovableExternalId),
      metadata: parsed.data.metadata,
      created_by: actor(req),
      updated_by: actor(req),
      updated_at: now,
    }).returning();

    const contactRows = contactExternalIds.length ? await db.select().from(marketingContacts).orderBy(desc(marketingContacts.updated_at)).limit(10000) : [];
    const contactByExternalId = marketingContactIdLookup(contactRows);
    const members = contactExternalIds.length
      ? await db.insert(marketingAudienceMembers).values(contactExternalIds.map((contactExternalId) => {
        const contactId = lookupByExternalId(contactByExternalId, contactExternalId, ["contact"]) ?? null;
        return {
          audience_id: audience.id,
          contact_id: contactId,
          contact_external_id: contactExternalId,
          source: parsed.data.source,
          metadata: { manual_rule_builder: true, mapped: Boolean(contactId) },
          updated_at: now,
        };
      })).returning()
      : [];

    const contactsById = new Map(contactRows.map((row) => [row.id, row]));
    return res.status(201).json({ ok: true, audience: serializeAudience(audience, members, contactsById) });
  } catch (error) {
    console.error("[admin/marketing] audience create failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing audience could not be created.") });
  }
});

adminMarketingRouter.patch("/audiences/:audienceId", async (req, res) => {
  const parsed = audiencePatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const bodyRecord = asRecord(req.body);
  const now = new Date();
  const patch: Partial<typeof marketingAudiences.$inferInsert> = {
    updated_at: now,
    updated_by: actor(req),
  };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description ?? null;
  if (parsed.data.listType !== undefined) patch.list_type = parsed.data.listType;
  if (parsed.data.rules !== undefined) patch.rules = parsed.data.rules;
  if (parsed.data.source !== undefined) patch.source = parsed.data.source;
  if (parsed.data.lovableExternalId !== undefined) patch.lovable_external_id = emptyToNull(parsed.data.lovableExternalId);
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;

  try {
    const [audience] = await db.update(marketingAudiences).set(patch).where(eq(marketingAudiences.id, req.params.audienceId)).returning();
    if (!audience) return res.status(404).json({ error: "Marketing audience not found." });
    let members = await db.select().from(marketingAudienceMembers).where(eq(marketingAudienceMembers.audience_id, audience.id)).orderBy(asc(marketingAudienceMembers.created_at));
    if (Object.prototype.hasOwnProperty.call(bodyRecord, "contactExternalIds")) {
      const contactExternalIds = uniqueTextArray(parsed.data.contactExternalIds ?? []);
      await db.delete(marketingAudienceMembers).where(eq(marketingAudienceMembers.audience_id, audience.id));
      const contactRows = contactExternalIds.length ? await db.select().from(marketingContacts).orderBy(desc(marketingContacts.updated_at)).limit(10000) : [];
      const contactByExternalId = marketingContactIdLookup(contactRows);
      members = contactExternalIds.length
        ? await db.insert(marketingAudienceMembers).values(contactExternalIds.map((contactExternalId) => {
          const contactId = lookupByExternalId(contactByExternalId, contactExternalId, ["contact"]) ?? null;
          return {
            audience_id: audience.id,
            contact_id: contactId,
            contact_external_id: contactExternalId,
            source: audience.source,
            metadata: { manual_rule_builder: true, mapped: Boolean(contactId) },
            updated_at: now,
          };
        })).returning()
        : [];
    }
    const memberContactIds = members.map((member) => member.contact_id).filter((value): value is string => Boolean(value));
    const contactRows = memberContactIds.length
      ? await db.select().from(marketingContacts).where(inArray(marketingContacts.id, memberContactIds)).limit(10000)
      : [];
    const contactsById = new Map(contactRows.map((row) => [row.id, row]));
    return res.json({ ok: true, audience: serializeAudience(audience, members, contactsById) });
  } catch (error) {
    console.error("[admin/marketing] audience update failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing audience could not be updated.") });
  }
});

adminMarketingRouter.delete("/audiences/:audienceId", async (req, res) => {
  try {
    const [audience] = await db.select().from(marketingAudiences).where(eq(marketingAudiences.id, req.params.audienceId)).limit(1);
    if (!audience) return res.status(404).json({ error: "Marketing audience not found." });
    await db.delete(marketingAudienceMembers).where(eq(marketingAudienceMembers.audience_id, audience.id));
    await db.delete(marketingAudiences).where(eq(marketingAudiences.id, audience.id));
    return res.json({ ok: true, deletedAudienceId: audience.id });
  } catch (error) {
    console.error("[admin/marketing] audience delete failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing audience could not be deleted.") });
  }
});

adminMarketingRouter.get("/contacts", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const audience = String(req.query.audience ?? "all");
    const [rows, audienceRows, memberRows] = await Promise.all([
      db.select().from(marketingContacts).orderBy(desc(marketingContacts.updated_at)).limit(2000),
      db.select().from(marketingAudiences).orderBy(desc(marketingAudiences.updated_at)).limit(1000),
      db.select().from(marketingAudienceMembers).orderBy(asc(marketingAudienceMembers.created_at)).limit(100000),
    ]);
    const audienceNameById = new Map(audienceRows.map((row) => [row.id, row.name]));
    const audienceNamesByContactId = new Map<string, string[]>();
    for (const member of memberRows) {
      if (!member.contact_id) continue;
      const name = audienceNameById.get(member.audience_id);
      if (!name) continue;
      const names = audienceNamesByContactId.get(member.contact_id) ?? [];
      names.push(name);
      audienceNamesByContactId.set(member.contact_id, names);
    }
    const contacts = rows
      .filter((row) => audience === "all" || row.audience_type === audience)
      .filter((row) => {
        if (!search) return true;
        const serialized = serializeContact(row, audienceNamesByContactId.get(row.id) ?? []);
        return [
          serialized.fullName,
          serialized.email,
          serialized.phoneNumber,
          serialized.whatsappNumber,
          serialized.companyName,
          serialized.roleLabel,
          serialized.language,
          serialized.category,
          serialized.vertical,
          serialized.market,
          serialized.source,
          ...serialized.tags,
          ...serialized.lists,
        ].some((value) => textMatches(value, search));
      })
      .map((row) => serializeContact(row, audienceNamesByContactId.get(row.id) ?? []));
    return res.json({ contacts });
  } catch (error) {
    console.error("[admin/marketing] contacts load failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing contacts could not be loaded.") });
  }
});

adminMarketingRouter.post("/contacts", async (req, res) => {
  const parsed = contactBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const [contact] = await db.insert(marketingContacts).values({
      audience_type: parsed.data.audienceType,
      profile_id: parsed.data.profileId ?? null,
      organization_id: parsed.data.organizationId ?? null,
      full_name: parsed.data.fullName,
      email: parsed.data.email ?? null,
      phone_number: parsed.data.phoneNumber ?? null,
      whatsapp_number: parsed.data.whatsappNumber ?? null,
      role_label: parsed.data.roleLabel ?? null,
      company_name: parsed.data.companyName ?? null,
      language: parsed.data.language ?? null,
      category: parsed.data.category ?? null,
      vertical: parsed.data.vertical ?? null,
      market: parsed.data.market ?? null,
      consent_status: parsed.data.consentStatus,
      source: parsed.data.source,
      channel_availability: parsed.data.channelAvailability,
      tags: parsed.data.tags,
      lovable_external_id: emptyToNull(parsed.data.lovableExternalId),
      metadata: parsed.data.metadata,
      updated_at: new Date(),
    }).returning();
    return res.status(201).json({ ok: true, contact: serializeContact(contact) });
  } catch (error) {
    console.error("[admin/marketing] contact create failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing contact could not be created.") });
  }
});

adminMarketingRouter.patch("/contacts/:contactId", async (req, res) => {
  const parsed = contactPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const patch: Partial<typeof marketingContacts.$inferInsert> = { updated_at: new Date() };
  if (parsed.data.audienceType !== undefined) patch.audience_type = parsed.data.audienceType;
  if (parsed.data.profileId !== undefined) patch.profile_id = parsed.data.profileId ?? null;
  if (parsed.data.organizationId !== undefined) patch.organization_id = parsed.data.organizationId ?? null;
  if (parsed.data.fullName !== undefined) patch.full_name = parsed.data.fullName;
  if (parsed.data.email !== undefined) patch.email = parsed.data.email ?? null;
  if (parsed.data.phoneNumber !== undefined) patch.phone_number = parsed.data.phoneNumber ?? null;
  if (parsed.data.whatsappNumber !== undefined) patch.whatsapp_number = parsed.data.whatsappNumber ?? null;
  if (parsed.data.roleLabel !== undefined) patch.role_label = parsed.data.roleLabel ?? null;
  if (parsed.data.companyName !== undefined) patch.company_name = parsed.data.companyName ?? null;
  if (parsed.data.language !== undefined) patch.language = parsed.data.language ?? null;
  if (parsed.data.category !== undefined) patch.category = parsed.data.category ?? null;
  if (parsed.data.vertical !== undefined) patch.vertical = parsed.data.vertical ?? null;
  if (parsed.data.market !== undefined) patch.market = parsed.data.market ?? null;
  if (parsed.data.consentStatus !== undefined) patch.consent_status = parsed.data.consentStatus;
  if (parsed.data.source !== undefined) patch.source = parsed.data.source;
  if (parsed.data.channelAvailability !== undefined) patch.channel_availability = parsed.data.channelAvailability;
  if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
  if (parsed.data.lovableExternalId !== undefined) patch.lovable_external_id = emptyToNull(parsed.data.lovableExternalId);
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
  try {
    const [contact] = await db.update(marketingContacts).set(patch).where(eq(marketingContacts.id, req.params.contactId)).returning();
    if (!contact) return res.status(404).json({ error: "Marketing contact not found." });
    return res.json({ ok: true, contact: serializeContact(contact) });
  } catch (error) {
    console.error("[admin/marketing] contact update failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing contact could not be updated.") });
  }
});

adminMarketingRouter.delete("/contacts/:contactId", async (req, res) => {
  try {
    const [contact] = await db.select().from(marketingContacts).where(eq(marketingContacts.id, req.params.contactId)).limit(1);
    if (!contact) return res.status(404).json({ error: "Marketing contact not found." });
    await db.delete(marketingAudienceMembers).where(eq(marketingAudienceMembers.contact_id, contact.id));
    await db.delete(marketingContacts).where(eq(marketingContacts.id, contact.id));
    return res.json({ ok: true, deletedContactId: contact.id });
  } catch (error) {
    console.error("[admin/marketing] contact delete failed", error);
    return res.status(500).json({ error: marketingSchemaErrorMessage(error, "Marketing contact could not be deleted.") });
  }
});

adminMarketingRouter.get("/sync/lovable", async (req, res) => {
  const apiUrl = lovableMarketingApiUrl();
  const apiKey = lovableMarketingApiKey();
  const hasUrl = Boolean(apiUrl);
  const hasBearerToken = Boolean(apiKey);
  const runs = await db.select().from(marketingSyncRuns).orderBy(desc(marketingSyncRuns.created_at)).limit(10);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-VYVA-Marketing-Sync-Build", MARKETING_SYNC_STATUS_BUILD);
  return res.json({
    provider: "lovable",
    backendBuild: MARKETING_SYNC_STATUS_BUILD,
    configured: hasUrl && hasBearerToken,
    canRunSync: isSuperAdmin(req),
    requiredRunnerEmail: SUPER_ADMIN_EMAIL,
    apiUrl: safeUrlOrigin(apiUrl),
    mode: "one_way_into_vyva",
    realSendingLocked: false,
    lockedSendCapabilities: channelSendCapabilities(),
    emailScheduler: marketingEmailSchedulerStatus(),
    diagnostics: lovableMarketingSyncDiagnostics(apiUrl, apiKey),
    runs: runs.map(serializeSyncRun),
  });
});

adminMarketingRouter.get("/sync/lovable/preview", async (req, res) => {
  if (!requireSuperAdmin(req, res, "preview the Lovable marketing export")) return;

  const apiUrl = lovableMarketingApiUrl();
  const apiKey = lovableMarketingApiKey();
  if (!apiUrl || !apiKey) {
    return res.status(409).json({ error: "Lovable marketing sync is not configured." });
  }

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    const payload = await response.json().catch(async () => ({ error: await response.text().catch(() => response.statusText) })) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(payload.error ?? payload.message ?? `Lovable export preview failed with ${response.status}`));

    const summary = lovableExportSummary(payload);
    return res.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      apiUrl: safeUrlOrigin(apiUrl),
      dataset: textFrom(payload, ["dataset", "environment", "source"], "unknown"),
      exportedAt: textFrom(payload, ["exportedAt", "exported_at", "updatedAt", "updated_at"]),
      topLevelKeys: Object.keys(payload).sort(),
      summary,
      samples: lovableExportSamples(payload),
      rawArraySamples: topLevelArraySamples(payload),
    });
  } catch (error) {
    console.error("[admin/marketing] lovable export preview failed", error);
    return res.status(502).json({ error: error instanceof Error ? error.message : "Lovable export preview failed." });
  }
});

async function upsertLovableContent(raw: unknown, now: Date, actorLabel: string) {
  const row = asRecord(raw);
  const sourceType = textFrom(row, [LOVABLE_CONTENT_SOURCE_KEY], "content");
  const rawExternalId = normalizeLovableId(row);
  const externalId = rawExternalId && (sourceType === "content" || rawExternalId.includes(":"))
    ? rawExternalId
    : rawExternalId
      ? `${sourceType}:${rawExternalId}`
      : null;
  if (!externalId) return null;
  const designJson = contentDesignJson(row);
  const mediaAssets = contentMediaAssetsFrom(row);
  const explicitBody = contentBodyFromRow(row);
  const designBody = contentBodyFromDesign(designJson);
  const htmlBody = emptyToNull(contentText(row, [...contentHtmlKeys]));
  const htmlText = htmlBody ? textFromHtml(htmlBody) : "";
  const title = contentText(
    row,
    [...contentTitleKeys],
    contentText(row, [...contentSubjectKeys], sourceType === "social_post" ? "Untitled social post" : "Untitled content"),
  );
  const { [LOVABLE_CONTENT_SOURCE_KEY]: _sourceMarker, ...lovableMetadata } = row;
  const payload = {
    title,
    channel: normalizeChannel(contentText(row, ["channel", "platform", "network"], sourceType === "social_post" ? "instagram" : "email")),
    language: contentText(row, ["language", "lang", "locale"], "en"),
    status: normalizeContentStatus(contentText(row, ["status"], "draft")),
    subject: emptyToNull(contentText(row, [...contentSubjectKeys])),
    body: explicitBody || designBody || htmlText,
    html_body: htmlBody,
    cta_label: emptyToNull(contentText(row, [...contentCtaLabelKeys])),
    cta_url: emptyToNull(contentText(row, [...contentCtaUrlKeys])),
    design_json: designJson,
    media_assets: mediaAssets,
    source: "lovable",
    lovable_external_id: externalId,
    metadata: { lovable: lovableMetadata, lovable_source_type: sourceType },
    updated_by: actorLabel,
    updated_at: now,
  };
  const [content] = await db.insert(marketingContentAssets)
    .values({ ...payload, created_by: actorLabel })
    .onConflictDoUpdate({ target: marketingContentAssets.lovable_external_id, set: payload })
    .returning();
  const mediaAssetCount = await replaceLovableMediaAssets(content, mediaAssets, now);
  return { content, mediaAssetCount };
}

async function upsertMissingLovableContentReference(
  externalId: string,
  channel: string,
  now: Date,
  actorLabel: string,
  context: Record<string, unknown>,
) {
  const normalizedExternalId = emptyToNull(externalId);
  if (!normalizedExternalId) return null;
  const sourceType = lovableReferenceSourceType(normalizedExternalId);
  const sourceLabel = lovableReferenceSourceLabel(sourceType);
  const title = `Missing Lovable ${sourceLabel}: ${normalizedExternalId}`;
  const body = [
    `Lovable referenced ${normalizedExternalId}, but the export did not include the content body, HTML, design, or media for this item.`,
    "Run sync again after Lovable exports the referenced item, or replace this placeholder with the real content in VYVA.",
  ].join("\n\n");
  const payload = {
    title,
    channel: normalizeChannel(channel),
    language: "en",
    status: "draft",
    subject: null,
    body,
    html_body: null,
    cta_label: null,
    cta_url: null,
    design_json: {
      missing_lovable_reference: true,
      external_id: normalizedExternalId,
      source_type: sourceType,
      context,
    },
    media_assets: [],
    source: "lovable",
    lovable_external_id: normalizedExternalId,
    metadata: {
      lovable_missing_reference: true,
      lovable_source_type: "missing_lovable_reference",
      referenced_source_type: sourceType,
      referenced_source_label: sourceLabel,
      external_id: normalizedExternalId,
      ...context,
    },
    updated_by: actorLabel,
    updated_at: now,
  };
  const [content] = await db.insert(marketingContentAssets)
    .values({ ...payload, created_by: actorLabel })
    .onConflictDoUpdate({ target: marketingContentAssets.lovable_external_id, set: payload })
    .returning();
  return content;
}

async function replaceContentMediaAssetReferences(content: MarketingContentAssetRow, mediaAssets: unknown[], now: Date, source = content.source || "vyva") {
  const normalizedSource = source.trim() || "vyva";
  await db.delete(marketingMediaAssets).where(and(
    eq(marketingMediaAssets.content_asset_id, content.id),
    eq(marketingMediaAssets.source, normalizedSource),
  ));
  const rows = mediaAssets.map((raw, index) => {
    const media = typeof raw === "string" ? { url: raw } : asRecord(raw);
    const originalUrl = emptyToNull(textFrom(media, ["url", "src", "href", "originalUrl", "original_url", ...contentMediaUrlKeys]));
    if (!originalUrl) return null;
    const localUrl = emptyToNull(textFrom(media, ["localUrl", "local_url"]));
    const externalId = normalizeLovableId(media) ?? `${normalizedSource}:${content.lovable_external_id ?? content.id}:media:${index}:${originalUrl}`;
    return {
      content_asset_id: content.id,
      source: normalizedSource,
      asset_type: textFrom(media, ["type", "kind", "assetType", "asset_type", "mimeType", "mime_type"], "unknown"),
      original_url: originalUrl,
      local_url: localUrl,
      status: textFrom(media, ["status", "importStatus", "import_status"], localUrl ? "mirrored" : "referenced"),
      lovable_external_id: externalId,
      metadata: normalizedSource === "lovable" ? { lovable: media } : { media, source: "content_media_assets" },
      last_synced_at: now,
      updated_at: now,
    };
  }).filter((row): row is typeof marketingMediaAssets.$inferInsert => Boolean(row));
  if (!rows.length) return 0;
  for (const row of rows) {
    await db.insert(marketingMediaAssets)
      .values(row)
      .onConflictDoUpdate({ target: marketingMediaAssets.lovable_external_id, set: row });
  }
  return rows.length;
}

async function replaceLovableMediaAssets(content: MarketingContentAssetRow, mediaAssets: unknown[], now: Date) {
  return replaceContentMediaAssetReferences(content, mediaAssets, now, "lovable");
}

async function upsertLovableStandaloneMedia(
  raw: Record<string, unknown>,
  now: Date,
  contentByExternalId: Map<string, string>,
  index: number,
) {
  const originalUrl = emptyToNull(textFrom(raw, ["url", "src", "href", "originalUrl", "original_url", "assetUrl", "asset_url", "imageUrl", "image_url", "thumbnailUrl", "thumbnail_url"]))
    ?? emptyToNull(textFrom(raw, ["localUrl", "local_url"]));
  if (!originalUrl) return false;
  const localUrl = emptyToNull(textFrom(raw, ["localUrl", "local_url"]));
  const contentRef = emptyToNull(textFrom(raw, [...mediaContentRefKeys]));
  const contentAssetId = lookupByExternalId(
    contentByExternalId,
    contentRef,
    ["content", "content_asset", "saved_email_template", "social_post", "template", "content_brief"],
  );
  const externalId = normalizeLovableId(raw) ?? `${contentRef ?? "standalone"}:media:${index}:${originalUrl}`;
  const row = {
    content_asset_id: contentAssetId ?? null,
    source: "lovable",
    asset_type: textFrom(raw, ["type", "kind", "assetType", "asset_type", "mimeType", "mime_type"], "unknown"),
    original_url: originalUrl,
    local_url: localUrl,
    status: textFrom(raw, ["status", "importStatus", "import_status"], localUrl ? "mirrored" : "referenced"),
    lovable_external_id: externalId,
    metadata: {
      lovable: raw,
      content_external_ref: contentRef,
      linked_content_asset_id: contentAssetId ?? null,
    },
    last_synced_at: now,
    updated_at: now,
  };
  await db.insert(marketingMediaAssets)
    .values(row)
    .onConflictDoUpdate({ target: marketingMediaAssets.lovable_external_id, set: row });
  return true;
}

async function upsertLovableContact(raw: unknown, now: Date) {
  const row = asRecord(raw);
  const externalId = normalizeLovableId(row);
  if (!externalId) return null;
  const { [LOVABLE_CONTACT_UNSUBSCRIBE_ROWS_KEY]: unsubscribeRows, ...lovableMetadata } = row;
  const metadata = jsonRecordFromLovable(row.metadata);
  const segmentation = jsonRecordFromLovable(row.segmentation ?? metadata.segmentation);
  const contactSources = contactFieldSources(row);
  const language = emptyToNull(textFromSources([segmentation, ...contactSources], ["language", "lang", "locale", "preferredLanguage", "preferred_language"]));
  const category = emptyToNull(textFromSources([segmentation, ...contactSources], ["category", "contactCategory", "contact_category"]));
  const vertical = emptyToNull(textFromSources([segmentation, ...contactSources], ["vertical", "industry", "sector"]));
  const market = emptyToNull(textFromSources([segmentation, ...contactSources], ["market", "country", "region"]));
  const email = emptyToNull(contactText(row, ["email", "emailAddress", "email_address"]));
  const phoneNumber = emptyToNull(contactText(row, ["phoneNumber", "phone_number", "phone", "mobileNumber", "mobile_number", "mobile", "telephone"]));
  const whatsappNumber = emptyToNull(contactText(row, ["whatsappNumber", "whatsapp_number", "whatsapp", "whatsAppNumber", "whats_app_number"]));
  const consentStatus = normalizeConsentStatus(contactText(row, ["consentStatus", "consent_status", "subscriptionStatus", "subscription_status", "emailStatus", "email_status"], "unknown"));
  const channelAvailability = {
    email: Boolean(email),
    phone: Boolean(phoneNumber),
    whatsapp: Boolean(whatsappNumber),
    ...jsonRecordFromLovable(row.channelAvailability ?? row.channel_availability),
  };
  const contactListTags = uniqueTextArray(contactSources.flatMap((source) => [
    ...splitTextList(source.lists),
    ...splitTextList(source.listNames ?? source.list_names),
    ...splitTextList(source.audiences),
    ...splitTextList(source.memberships),
    ...splitTextList(source.segments),
    ...splitTextList(source.segmentNames ?? source.segment_names),
  ])).map((list) => `List: ${list}`);
  const payload = {
    audience_type: normalizeAudience(textFrom(row, ["audienceType", "audience_type", "audience"], "b2b")),
    full_name: contactFullName(row),
    email,
    phone_number: phoneNumber,
    whatsapp_number: whatsappNumber,
    role_label: emptyToNull(contactText(row, ["roleLabel", "role_label", "role", "jobTitle", "job_title", "title", "position"])),
    company_name: emptyToNull(contactText(row, ["companyName", "company_name", "company", "organization", "organizationName", "organization_name", "organisation", "organisationName", "organisation_name"])),
    language,
    category,
    vertical,
    market,
    consent_status: consentStatus,
    source: "lovable",
    channel_availability: channelAvailability,
    tags: uniqueTextArray([
      ...contactSources.flatMap((source) => [
        ...splitTextList(source.tags),
        ...splitTextList(source.tagNames ?? source.tag_names),
        ...splitTextList(source.labels),
      ]),
      ...contactListTags,
    ]),
    lovable_external_id: externalId,
    last_synced_at: now,
    metadata: {
      lovable: lovableMetadata,
      lovable_email_unsubscribe_rows: arrayFrom(unsubscribeRows),
      segmentation: { language, category, vertical, market },
    },
    updated_at: now,
  };
  const [contact] = await db.insert(marketingContacts)
    .values(payload)
    .onConflictDoUpdate({ target: marketingContacts.lovable_external_id, set: payload })
    .returning();
  return contact;
}

async function upsertLovableAudience(raw: unknown, now: Date, actorLabel: string, contactByExternalId: Map<string, string>) {
  const row = asRecord(raw);
  const externalId = normalizeLovableId(row);
  if (!externalId) return null;
  const contactExternalIds = audienceContactExternalIds(row);
  const unmappedContactExternalIds = contactExternalIds.filter((contactExternalId) => !lookupByExternalId(contactByExternalId, contactExternalId, ["contact"]));
  const { [LOVABLE_AUDIENCE_MEMBER_ROWS_KEY]: listMemberRows, ...lovableMetadata } = row;
  const payload = {
    name: textFrom(row, ["name", "title"], "Untitled audience"),
    description: emptyToNull(textFrom(row, ["description"])),
    list_type: textFrom(row, ["listType", "list_type", "type"], "static"),
    rules: jsonRecordFromLovable(row.rules ?? row.ruleConfig ?? row.rule_config ?? row.filters),
    source: "lovable",
    lovable_external_id: externalId,
    metadata: {
      lovable: lovableMetadata,
      lovable_list_member_rows: arrayFrom(listMemberRows),
      contact_external_ids: contactExternalIds,
      unmapped_contact_external_ids: unmappedContactExternalIds,
    },
    updated_by: actorLabel,
    last_synced_at: now,
    updated_at: now,
  };
  const [audience] = await db.insert(marketingAudiences)
    .values({ ...payload, created_by: actorLabel })
    .onConflictDoUpdate({ target: marketingAudiences.lovable_external_id, set: payload })
    .returning();

  await db.delete(marketingAudienceMembers).where(eq(marketingAudienceMembers.audience_id, audience.id));
  if (contactExternalIds.length) {
    await db.insert(marketingAudienceMembers).values(contactExternalIds.map((contactExternalId) => ({
      audience_id: audience.id,
      contact_id: lookupByExternalId(contactByExternalId, contactExternalId, ["contact"]) ?? null,
      contact_external_id: contactExternalId,
      source: "lovable",
      metadata: {
        lovable_audience_external_id: externalId,
        mapped: Boolean(lookupByExternalId(contactByExternalId, contactExternalId, ["contact"])),
      },
      updated_at: now,
    })));
  }

  return {
    audience,
    memberCount: contactExternalIds.length,
    mappedMemberCount: contactExternalIds.length - unmappedContactExternalIds.length,
    unmappedContactExternalIds,
  };
}

function recipientValueForContact(contact: MarketingContactRow, channel: typeof marketingChannels[number]) {
  if (channel === "email") return contact.email;
  if (channel === "whatsapp") return contact.whatsapp_number || contact.phone_number;
  return contact.email || contact.whatsapp_number || contact.phone_number || contact.id;
}

function lovableCampaignRecipients(
  row: Record<string, unknown>,
  campaign: MarketingCampaignRow,
  defaultChannel: typeof marketingChannels[number],
  defaultScheduledAt: Date | null,
  contactRowByExternalId: Map<string, MarketingContactRow>,
  audienceContactExternalIdsByAudienceExternalId: Map<string, string[]>,
) {
  const explicitRows = campaignRecipientPayload(row);
  const directContactExternalIds = campaignDirectContactExternalIds(row);
  const audienceExternalIds = campaignAudienceExternalIds(row);
  const audienceContactExternalIds = audienceExternalIds.flatMap((audienceExternalId) => (
    lookupByExternalId(audienceContactExternalIdsByAudienceExternalId, audienceExternalId, ["audience", "list", "contact_list"]) ?? []
  ));
  const referencedContactExternalIds = uniqueTextArray([...directContactExternalIds, ...audienceContactExternalIds]);
  const hasRecipientSource = explicitRows.length > 0 || directContactExternalIds.length > 0 || audienceExternalIds.length > 0;
  const unmappedContactExternalIds: string[] = [];
  const recipientRows: Array<typeof marketingCampaignRecipients.$inferInsert> = [];
  const seen = new Set<string>();

  function pushRecipient(input: {
    contactExternalId: string | null;
    contact: MarketingContactRow | null;
    channel: typeof marketingChannels[number];
    recipient: string;
    status: typeof recipientStatuses[number];
    scheduledAt: Date | null;
    snapshot: Record<string, unknown>;
  }) {
    const key = `${input.channel}:${input.recipient}`;
    if (!input.recipient || seen.has(key)) return;
    seen.add(key);
    recipientRows.push({
      campaign_id: campaign.id,
      contact_id: input.contact?.id ?? null,
      profile_id: input.contact?.profile_id ?? null,
      channel: input.channel,
      recipient: input.recipient,
      status: input.status,
      scheduled_at: input.scheduledAt,
      snapshot: {
        ...input.snapshot,
        source: "lovable_campaign_import",
        dispatch_locked: true,
        contact_external_id: input.contactExternalId,
        campaign_external_id: campaign.lovable_external_id,
      },
      updated_at: new Date(),
    });
  }

  for (const explicitRaw of explicitRows) {
    const explicit = asRecord(explicitRaw);
    const contactExternalId = emptyToNull(textFrom(explicit, ["contactExternalId", "contact_external_id", "contactId", "contact_id", "externalId", "external_id", "id"]));
    const contact = contactExternalId ? lookupByExternalId(contactRowByExternalId, contactExternalId, ["contact"]) ?? null : null;
    const channel = normalizeChannel(textFrom(explicit, ["channel"], defaultChannel));
    const fallbackRecipient = textFrom(explicit, ["recipient", "email", "phoneNumber", "phone_number", "whatsappNumber", "whatsapp_number", "phone", "whatsapp"]);
    const recipient = fallbackRecipient || (contact ? recipientValueForContact(contact, channel) ?? "" : "");
    if (contactExternalId && !contact) unmappedContactExternalIds.push(contactExternalId);
    pushRecipient({
      contactExternalId,
      contact,
      channel,
      recipient,
      status: normalizeRecipientStatus(textFrom(explicit, ["status"], "planned")),
      scheduledAt: dateOrNull(dateTextFrom(explicit, ["scheduledAt", "scheduled_at"])) ?? defaultScheduledAt,
      snapshot: { lovable: explicit },
    });
  }

  for (const contactExternalId of referencedContactExternalIds) {
    const contact = lookupByExternalId(contactRowByExternalId, contactExternalId, ["contact"]) ?? null;
    if (!contact) {
      unmappedContactExternalIds.push(contactExternalId);
      continue;
    }
    const recipient = recipientValueForContact(contact, defaultChannel) ?? "";
    pushRecipient({
      contactExternalId,
      contact,
      channel: defaultChannel,
      recipient,
      status: "planned",
      scheduledAt: defaultScheduledAt,
      snapshot: {
        fullName: contact.full_name,
        email: contact.email,
        phoneNumber: contact.phone_number,
        whatsappNumber: contact.whatsapp_number,
        audienceType: contact.audience_type,
        companyName: contact.company_name,
        roleLabel: contact.role_label,
        consentStatus: contact.consent_status,
        sourceAudienceExternalIds: audienceExternalIds,
      },
    });
  }

  return {
    hasRecipientSource,
    recipientRows,
    unmappedContactExternalIds: Array.from(new Set(unmappedContactExternalIds)),
  };
}

function normalizeMetricChannel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "all" || normalized === "mixed") return "all";
  return normalizeChannel(normalized);
}

async function upsertLovableCampaignMetric(
  raw: unknown,
  now: Date,
  campaignByExternalId: Map<string, MarketingCampaignRow>,
  fallbackCampaignExternalId: string | null,
  index: number,
) {
  const row = asRecord(raw);
  const campaignExternalId = emptyToNull(textFrom(row, ["campaignExternalId", "campaign_external_id", "campaignId", "campaign_id"])) ?? fallbackCampaignExternalId;
  const campaign = campaignExternalId ? lookupByExternalId(campaignByExternalId, campaignExternalId, ["campaign"]) ?? null : null;
  const channel = normalizeMetricChannel(textFrom(row, ["channel"], "all"));
  const metricDate = dateOrNull(dateTextFrom(row, ["metricDate", "metric_date", "date", "updatedAt", "updated_at"]));
  const externalId = normalizeLovableId(row)
    ?? `${campaignExternalId ?? "unlinked"}:metric:${channel}:${metricDate?.toISOString() ?? index}`;
  const payload = {
    campaign_id: campaign?.id ?? null,
    channel,
    metric_date: metricDate,
    sent: numberFrom(row, ["sent"]),
    delivered: numberFrom(row, ["delivered"]),
    opened: numberFrom(row, ["opened", "opens"]),
    clicked: numberFrom(row, ["clicked", "clicks"]),
    bounced: numberFrom(row, ["bounced", "bounces"]),
    unsubscribed: numberFrom(row, ["unsubscribed", "unsubscribes"]),
    replied: numberFrom(row, ["replied", "replies"]),
    social_engagement: numberFrom(row, ["socialEngagement", "social_engagement", "engagements"]),
    source: "lovable",
    lovable_external_id: externalId,
    metadata: { lovable: row, campaign_external_id: campaignExternalId },
    last_synced_at: now,
    updated_at: now,
  };
  const [metric] = await db.insert(marketingCampaignMetrics)
    .values(payload)
    .onConflictDoUpdate({ target: marketingCampaignMetrics.lovable_external_id, set: payload })
    .returning();
  return metric;
}

async function upsertLovableCampaign(
  raw: unknown,
  now: Date,
  actorLabel: string,
  contentByExternalId: Map<string, string>,
  contactRowByExternalId: Map<string, MarketingContactRow>,
  audienceContactExternalIdsByAudienceExternalId: Map<string, string[]>,
) {
  const row = asRecord(raw);
  const externalId = normalizeLovableId(row);
  if (!externalId) return null;
  const payload = {
    name: textFrom(row, ["name", "title"], "Untitled campaign"),
    status: normalizeCampaignStatus(textFrom(row, ["status"], "draft")),
    audience_type: normalizeAudience(textFrom(row, ["audienceType", "audience_type", "audience"], "b2c")),
    objective: textFrom(row, ["objective", "description"], ""),
    schedule_starts_at: dateOrNull(dateTextFrom(row, ["scheduleStartsAt", "schedule_starts_at", "startsAt", "starts_at", "scheduledAt", "scheduled_at", "publishAt", "publish_at", "sendAt", "send_at"])),
    schedule_ends_at: dateOrNull(dateTextFrom(row, ["scheduleEndsAt", "schedule_ends_at", "endsAt", "ends_at"])),
    timezone: textFrom(row, ["timezone"], "Europe/Madrid"),
    source: "lovable",
    lovable_external_id: externalId,
    metadata: { lovable: row },
    updated_by: actorLabel,
    updated_at: now,
  };
  const [campaign] = await db.insert(marketingCampaigns)
    .values({ ...payload, created_by: actorLabel })
    .onConflictDoUpdate({ target: marketingCampaigns.lovable_external_id, set: payload })
    .returning();

  const channelRows = campaignChannelPayload(row);
  const firstChannelRow = asRecord(channelRows[0]);
  const defaultChannel = normalizeChannel(textFrom(firstChannelRow, ["channel", "platform", "network"], "email"));
  const defaultScheduledAt = dateOrNull(dateTextFrom(firstChannelRow, ["scheduledAt", "scheduled_at"])) ?? campaign.schedule_starts_at ?? null;
  let missingContentReferenceCount = 0;
  if (channelRows.length) {
    await db.delete(marketingCampaignChannels).where(eq(marketingCampaignChannels.campaign_id, campaign.id));
    const campaignChannelRows: Array<typeof marketingCampaignChannels.$inferInsert> = [];
    for (const channelRaw of channelRows) {
      const channelRow = asRecord(channelRaw);
      const contentExternalId = lovableContentReference(channelRow);
      const channel = normalizeChannel(textFrom(channelRow, ["channel", "platform", "network"], "email"));
      let contentAssetId = contentIdForLovableReference(contentByExternalId, contentExternalId);
      if (!contentAssetId && contentExternalId) {
        const placeholder = await upsertMissingLovableContentReference(contentExternalId, channel, now, actorLabel, {
          context: "campaign_channel",
          campaign_external_id: externalId,
          campaign_name: campaign.name,
          channel,
          lovable_channel: channelRow,
        });
        if (placeholder) {
          missingContentReferenceCount += 1;
          contentAssetId = placeholder.id;
          addExternalIdVariants(contentByExternalId, placeholder.lovable_external_id, placeholder.id, ["content", "content_asset", "saved_email_template", "social_post", "template", "content_brief"]);
        }
      }
      campaignChannelRows.push({
        campaign_id: campaign.id,
        channel,
        content_asset_id: contentAssetId,
        scheduled_at: dateOrNull(dateTextFrom(channelRow, ["scheduledAt", "scheduled_at"])),
        status: normalizeCampaignStatus(textFrom(channelRow, ["status"], payload.status)),
        send_capability: sendCapabilityForChannel(channel),
        metadata: sendMetadataForChannel(channel, { lovable: channelRow }),
        updated_at: now,
      });
    }
    await db.insert(marketingCampaignChannels).values(campaignChannelRows);
  }
  const recipientImport = lovableCampaignRecipients(
    row,
    campaign,
    defaultChannel,
    defaultScheduledAt,
    contactRowByExternalId,
    audienceContactExternalIdsByAudienceExternalId,
  );
  if (recipientImport.hasRecipientSource) {
    await db.delete(marketingCampaignRecipients).where(eq(marketingCampaignRecipients.campaign_id, campaign.id));
    if (recipientImport.recipientRows.length) {
      await db.insert(marketingCampaignRecipients).values(recipientImport.recipientRows);
    }
  }
  return {
    campaign,
    channelCount: channelRows.length,
    recipientCount: recipientImport.recipientRows.length,
    missingContentReferenceCount,
    unmappedRecipientExternalIds: recipientImport.unmappedContactExternalIds,
  };
}

async function upsertLovableJourneyStepPresetContent(
  step: Record<string, unknown>,
  journey: MarketingJourneyRow,
  now: Date,
  actorLabel: string,
  index: number,
) {
  const config = jsonRecordFromLovable(step.config);
  const translations = jsonRecordFromLovable(config.translations);
  const translationEntries = Object.entries(translations)
    .map(([language, value]) => ({ language, value: asRecord(value) }))
    .filter((entry) => Object.keys(entry.value).length > 0);
  if (!translationEntries.length) return null;

  const templateRef = emptyToNull(textFrom(step, ["templateRef", "template_ref", "templateId", "template_id"]));
  const stepExternalId = normalizeLovableId(step);
  const externalId = templateRef
    ? `journey_step_preset:${templateRef}`
    : stepExternalId
      ? `journey_step_preset:${stepExternalId}`
      : `journey_step_preset:${journey.lovable_external_id ?? journey.id}:${index}`;
  const defaultLanguage = emptyToNull(textFrom(config, ["default_language", "defaultLanguage"]))
    ?? translationEntries[0]?.language
    ?? "en";
  const defaultTranslation = translationEntries.find((entry) => entry.language === defaultLanguage)?.value
    ?? translationEntries[0]?.value
    ?? {};
  const headline = emptyToNull(textFrom(defaultTranslation, ["headline", "title", "name"]));
  const subject = emptyToNull(textFrom(defaultTranslation, ["subject", "subjectLine", "subject_line"]));
  const body = textFrom(defaultTranslation, ["body", "copy", "text", "message"], "");
  const ctaLabel = emptyToNull(textFrom(defaultTranslation, ["cta", "ctaLabel", "cta_label", "buttonLabel", "button_label"]));
  const title = headline
    ?? subject
    ?? `${journey.name} step ${Number(step.order ?? step.stepOrder ?? step.step_order ?? index) || index + 1}`;
  const payload = {
    title,
    channel: normalizeChannel(textFrom(step, ["channel"], "email")),
    language: defaultLanguage,
    status: normalizeContentStatus(textFrom(step, ["status"], "draft")),
    subject,
    body,
    html_body: null,
    cta_label: ctaLabel,
    cta_url: emptyToNull(textFrom(defaultTranslation, ["ctaUrl", "cta_url", "buttonUrl", "button_url", "url", "link"])),
    design_json: { translations, default_language: defaultLanguage, journey_step_config: config },
    media_assets: [],
    source: "lovable",
    lovable_external_id: externalId,
    metadata: {
      lovable: step,
      lovable_source_type: "journey_step_preset",
      journey_external_id: journey.lovable_external_id,
      journey_name: journey.name,
      template_ref: templateRef,
    },
    updated_by: actorLabel,
    updated_at: now,
  };
  const [content] = await db.insert(marketingContentAssets)
    .values({ ...payload, created_by: actorLabel })
    .onConflictDoUpdate({ target: marketingContentAssets.lovable_external_id, set: payload })
    .returning();
  return content;
}

async function upsertLovableJourney(raw: unknown, now: Date, actorLabel: string, contentByExternalId: Map<string, string>) {
  const row = asRecord(raw);
  const externalId = normalizeLovableId(row);
  if (!externalId) return null;
  const payload = {
    name: textFrom(row, ["name", "title"], "Untitled journey"),
    status: normalizeJourneyStatus(textFrom(row, ["status"], "draft")),
    audience_type: normalizeAudience(textFrom(row, ["audienceType", "audience_type", "audience"], "b2c")),
    objective: textFrom(row, ["objective", "description"], ""),
    trigger_type: emptyToNull(textFrom(row, ["triggerType", "trigger_type"])),
    trigger_config: jsonRecordFromLovable(row.triggerConfig ?? row.trigger_config),
    goal_type: emptyToNull(textFrom(row, ["goalType", "goal_type"])),
    goal_config: jsonRecordFromLovable(row.goalConfig ?? row.goal_config),
    exit_on_goal: booleanFrom(row, ["exitOnGoal", "exit_on_goal"], true),
    source: "lovable",
    lovable_external_id: externalId,
    metadata: { lovable: row },
    updated_by: actorLabel,
    updated_at: now,
  };
  const [journey] = await db.insert(marketingJourneys)
    .values({ ...payload, created_by: actorLabel })
    .onConflictDoUpdate({ target: marketingJourneys.lovable_external_id, set: payload })
    .returning();
  const steps = arrayFrom(row.steps);
  let presetContentCount = 0;
  let missingContentReferenceCount = 0;
  if (steps.length) {
    await db.delete(marketingJourneySteps).where(eq(marketingJourneySteps.journey_id, journey.id));
    const stepRows: Array<typeof marketingJourneySteps.$inferInsert> = [];
    for (let index = 0; index < steps.length; index += 1) {
      const stepRaw = steps[index];
      const step = asRecord(stepRaw);
      const contentExternalId = lovableContentReference(step);
      const channel = normalizeChannel(textFrom(step, ["channel"], "email"));
      const dayOffset = Number(step.dayOffset ?? step.day_offset ?? step.day ?? 0);
      const delayHours = Number(step.delayHours ?? step.delay_hours ?? (Number.isFinite(dayOffset) ? dayOffset * 24 : 0));
      const presetContent = await upsertLovableJourneyStepPresetContent(step, journey, now, actorLabel, index);
      if (presetContent) {
        presetContentCount += 1;
        addExternalIdVariants(contentByExternalId, presetContent.lovable_external_id, presetContent.id, ["content", "content_asset", "journey_step_preset"]);
      }
      const templateRef = emptyToNull(textFrom(step, ["templateRef", "template_ref", "templateId", "template_id"])) ?? (contentExternalId || null);
      let contentAssetId = presetContent?.id ?? contentIdForLovableReference(contentByExternalId, contentExternalId || templateRef || "");
      if (!contentAssetId && contentExternalId) {
        const placeholder = await upsertMissingLovableContentReference(contentExternalId, channel, now, actorLabel, {
          context: "journey_step",
          journey_external_id: externalId,
          journey_name: journey.name,
          step_order: Number(step.stepOrder ?? step.step_order ?? index),
          channel,
          lovable_step: step,
        });
        if (placeholder) {
          missingContentReferenceCount += 1;
          contentAssetId = placeholder.id;
          addExternalIdVariants(contentByExternalId, placeholder.lovable_external_id, placeholder.id, ["content", "content_asset", "saved_email_template", "social_post", "template", "content_brief"]);
        }
      }
      stepRows.push({
        journey_id: journey.id,
        step_order: Number(step.stepOrder ?? step.step_order ?? index),
        channel,
        content_asset_id: contentAssetId,
        delay_hours: Number.isFinite(delayHours) ? delayHours : 0,
        kind: textFrom(step, ["kind", "stepKind", "step_kind", "type"], "message"),
        day_offset: Number.isFinite(dayOffset) ? dayOffset : 0,
        template_kind: emptyToNull(textFrom(step, ["templateKind", "template_kind"])),
        template_ref: templateRef,
        config: jsonRecordFromLovable(step.config),
        status: normalizeJourneyStatus(textFrom(step, ["status"], "draft")),
        metadata: { lovable: step },
        updated_at: now,
      });
    }
    await db.insert(marketingJourneySteps).values(stepRows);
  }
  return { journey, presetContentCount, missingContentReferenceCount };
}

async function upsertLovableJourneyEnrollment(
  raw: unknown,
  now: Date,
  journeyByExternalId: Map<string, MarketingJourneyRow>,
  contactRowByExternalId: Map<string, MarketingContactRow>,
  stepByJourneyAndOrder: Map<string, MarketingJourneyStepRow>,
  fallbackJourneyExternalId: string | null,
  index: number,
) {
  const row = asRecord(raw);
  const journeyExternalId = emptyToNull(textFrom(row, ["journeyExternalId", "journey_external_id", "journeyId", "journey_id"])) ?? fallbackJourneyExternalId;
  const journey = journeyExternalId ? lookupByExternalId(journeyByExternalId, journeyExternalId, ["journey", "workflow"]) ?? null : null;
  if (!journey) return null;
  const contactExternalId = emptyToNull(textFrom(row, ["contactExternalId", "contact_external_id", "contactId", "contact_id", "externalId", "external_id"]));
  const contact = contactExternalId ? lookupByExternalId(contactRowByExternalId, contactExternalId, ["contact"]) ?? null : null;
  const currentStepOrder = numberFrom(row, ["currentStepOrder", "current_step_order", "stepOrder", "step_order"], 0);
  const externalId = normalizeLovableId(row)
    ?? `${journeyExternalId}:enrollment:${contactExternalId ?? index}`;
  const payload = {
    journey_id: journey.id,
    contact_id: contact?.id ?? null,
    contact_external_id: contactExternalId,
    status: textFrom(row, ["status"], "active"),
    current_step_order: currentStepOrder,
    entered_at: dateOrNull(dateTextFrom(row, ["enteredAt", "entered_at"])),
    exited_at: dateOrNull(dateTextFrom(row, ["exitedAt", "exited_at"])),
    last_activity_at: dateOrNull(dateTextFrom(row, ["lastActivityAt", "last_activity_at", "updatedAt", "updated_at"])),
    source: "lovable",
    lovable_external_id: externalId,
    metadata: { lovable: row, journey_external_id: journeyExternalId },
    updated_at: now,
  };
  const [enrollment] = await db.insert(marketingJourneyEnrollments)
    .values(payload)
    .onConflictDoUpdate({ target: marketingJourneyEnrollments.lovable_external_id, set: payload })
    .returning();

  const eventPayload = journeyEnrollmentEventPayload(row);
  await db.delete(marketingJourneyStepEvents).where(and(
    eq(marketingJourneyStepEvents.enrollment_id, enrollment.id),
    eq(marketingJourneyStepEvents.source, "lovable"),
  ));
  if (!eventPayload.length) return { enrollment, eventCount: 0 };

  const eventRows = eventPayload.map((rawEvent, eventIndex) => {
    const event = asRecord(rawEvent);
    const stepOrder = numberFrom(event, ["stepOrder", "step_order", "order"], currentStepOrder);
    const step = stepByJourneyAndOrder.get(`${journey.id}:${stepOrder}`) ?? null;
    const eventType = textFrom(event, ["eventType", "event_type", "type", "status"], "planned");
    return {
      enrollment_id: enrollment.id,
      journey_id: journey.id,
      step_id: step?.id ?? null,
      step_order: stepOrder,
      event_type: eventType,
      event_at: dateOrNull(dateTextFrom(event, ["eventAt", "event_at", "createdAt", "created_at", "updatedAt", "updated_at"])),
      channel: emptyToNull(textFrom(event, ["channel"])),
      source: "lovable",
      lovable_external_id: normalizeLovableId(event) ?? `${externalId}:event:${eventIndex}:${eventType}`,
      metadata: { lovable: event },
      updated_at: now,
    };
  });
  await db.insert(marketingJourneyStepEvents).values(eventRows);
  return { enrollment, eventCount: eventRows.length };
}

async function upsertLovableJourneyStepEvent(
  raw: unknown,
  now: Date,
  enrollmentByExternalId: Map<string, MarketingJourneyEnrollmentRow>,
  enrollmentByJourneyAndContact: Map<string, MarketingJourneyEnrollmentRow>,
  journeyByExternalId: Map<string, MarketingJourneyRow>,
  stepByJourneyAndOrder: Map<string, MarketingJourneyStepRow>,
  index: number,
) {
  const row = asRecord(raw);
  const enrollmentExternalId = emptyToNull(textFrom(row, [
    "enrollmentExternalId",
    "enrollment_external_id",
    "journeyEnrollmentId",
    "journey_enrollment_id",
    "enrollmentId",
    "enrollment_id",
  ]));
  let enrollment = enrollmentExternalId
    ? lookupByExternalId(enrollmentByExternalId, enrollmentExternalId, ["enrollment", "journey_enrollment"])
    : null;
  if (!enrollment) {
    const journeyExternalId = emptyToNull(textFrom(row, ["journeyExternalId", "journey_external_id", "journeyId", "journey_id"]));
    const journey = journeyExternalId ? lookupByExternalId(journeyByExternalId, journeyExternalId, ["journey", "workflow"]) : null;
    const contactExternalId = emptyToNull(textFrom(row, ["contactExternalId", "contact_external_id", "contactId", "contact_id"]));
    if (journey && contactExternalId) {
      enrollment = enrollmentByJourneyAndContact.get(`${journey.id}:${contactExternalId}`) ?? null;
    }
  }
  if (!enrollment) return null;

  const stepOrder = numberFrom(row, ["stepOrder", "step_order", "order"], enrollment.current_step_order);
  const step = stepByJourneyAndOrder.get(`${enrollment.journey_id}:${stepOrder}`) ?? null;
  const eventType = textFrom(row, ["eventType", "event_type", "type", "status"], "planned");
  const externalId = normalizeLovableId(row)
    ?? `${enrollment.lovable_external_id ?? enrollment.id}:event:${index}:${eventType}`;
  const payload = {
    enrollment_id: enrollment.id,
    journey_id: enrollment.journey_id,
    step_id: step?.id ?? null,
    step_order: stepOrder,
    event_type: eventType,
    event_at: dateOrNull(dateTextFrom(row, ["eventAt", "event_at", "createdAt", "created_at", "updatedAt", "updated_at"])),
    channel: emptyToNull(textFrom(row, ["channel"])),
    source: "lovable",
    lovable_external_id: externalId,
    metadata: { lovable: row, enrollment_external_id: enrollmentExternalId },
    updated_at: now,
  };
  const [event] = await db.insert(marketingJourneyStepEvents)
    .values(payload)
    .onConflictDoUpdate({ target: marketingJourneyStepEvents.lovable_external_id, set: payload })
    .returning();
  return event;
}

adminMarketingRouter.post("/sync/lovable/run", async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const apiUrl = lovableMarketingApiUrl();
  const apiKey = lovableMarketingApiKey();
  if (!apiUrl || !apiKey) {
    return res.status(409).json({ error: "Lovable marketing sync is not configured." });
  }

  const now = new Date();
  const [run] = await db.insert(marketingSyncRuns).values({
    provider: "lovable",
    status: "running",
    started_at: now,
    created_by: actor(req),
    summary: {},
  }).returning();

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    const payload = await response.json().catch(async () => ({ error: await response.text().catch(() => response.statusText) })) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(payload.error ?? payload.message ?? `Lovable sync failed with ${response.status}`));

    const actorLabel = actor(req);
    const contentPayload = lovableContentPayload(payload);
    const standaloneMediaPayload = lovableMediaPayload(payload);
    const contactPayload = lovableContactPayload(payload);
    const campaignPayload = lovableCampaignPayload(payload);
    const journeyPayload = lovableJourneyPayload(payload);
    const audiencePayload = lovableAudiencePayload(payload);
    const campaignMetricPayload = arrayFrom(payload.campaignMetrics ?? payload.campaign_metrics ?? payload.analytics ?? payload.metrics);
    const journeyEnrollmentPayload = lovableJourneyEnrollmentPayload(payload);
    const journeyStepEventPayload = lovableJourneyStepEventPayload(payload);
    const contentRows: MarketingContentAssetRow[] = [];
    let mediaAssetCount = 0;
    for (const item of contentPayload) {
      const result = await upsertLovableContent(item, now, actorLabel);
      if (!result) continue;
      contentRows.push(result.content);
      mediaAssetCount += result.mediaAssetCount;
    }
    const contentByExternalId = new Map<string, string>();
    for (const item of contentRows) {
      addExternalIdVariants(contentByExternalId, item.lovable_external_id, item.id, ["content", "content_asset", "saved_email_template", "social_post", "template", "content_brief"]);
    }
    const existingContentRows = await db.select({
      id: marketingContentAssets.id,
      lovable_external_id: marketingContentAssets.lovable_external_id,
    }).from(marketingContentAssets).limit(5000);
    for (const item of existingContentRows) {
      if (item.lovable_external_id) {
        addExternalIdVariants(contentByExternalId, item.lovable_external_id, item.id, ["content", "content_asset", "saved_email_template", "social_post", "template", "content_brief", "journey_step_preset"]);
      }
    }
    for (const [index, item] of standaloneMediaPayload.entries()) {
      if (await upsertLovableStandaloneMedia(item, now, contentByExternalId, index)) mediaAssetCount += 1;
    }

    const contactRows = [];
    for (const item of contactPayload) {
      const contact = await upsertLovableContact(item, now);
      if (contact) contactRows.push(contact);
    }
    const contactRowByExternalId = new Map<string, MarketingContactRow>();
    for (const item of contactRows) {
      addExternalIdVariants(contactRowByExternalId, item.lovable_external_id, item, ["contact"]);
    }
    const contactByExternalId = new Map<string, string>();
    for (const item of contactRows) {
      addExternalIdVariants(contactByExternalId, item.lovable_external_id, item.id, ["contact"]);
    }
    if (contactByExternalId.size < contactRows.length) {
      const ids = contactRows.map((item) => item.lovable_external_id).filter((value): value is string => Boolean(value));
      if (ids.length) {
        const rows = await db.select().from(marketingContacts).where(inArray(marketingContacts.lovable_external_id, ids));
        for (const item of rows) {
          addExternalIdVariants(contactByExternalId, item.lovable_external_id, item.id, ["contact"]);
          addExternalIdVariants(contactRowByExternalId, item.lovable_external_id, item, ["contact"]);
        }
      }
    }

    let audienceCount = 0;
    let audienceMemberCount = 0;
    let mappedAudienceMemberCount = 0;
    const unmappedAudienceContactExternalIds: string[] = [];
    const audienceContactExternalIdsByAudienceExternalId = new Map<string, string[]>();
    for (const item of audiencePayload) {
      const audienceRow = asRecord(item);
      const audienceExternalId = normalizeLovableId(audienceRow);
      if (audienceExternalId) {
        for (const variant of externalIdVariants(audienceExternalId, ["audience", "list", "contact_list"])) {
          audienceContactExternalIdsByAudienceExternalId.set(variant, audienceContactExternalIds(audienceRow));
        }
      }
      const result = await upsertLovableAudience(item, now, actorLabel, contactByExternalId);
      if (!result) continue;
      audienceCount += 1;
      audienceMemberCount += result.memberCount;
      mappedAudienceMemberCount += result.mappedMemberCount;
      unmappedAudienceContactExternalIds.push(...result.unmappedContactExternalIds);
    }

    let campaignCount = 0;
    let campaignChannelCount = 0;
    let campaignRecipientCount = 0;
    let missingContentReferenceCount = 0;
    const unmappedCampaignRecipientExternalIds: string[] = [];
    const campaignRows: MarketingCampaignRow[] = [];
    const nestedCampaignMetricPayload: Array<{ raw: unknown; campaignExternalId: string | null; index: number }> = [];
    for (const item of campaignPayload) {
      const campaignRow = asRecord(item);
      const campaignExternalId = normalizeLovableId(campaignRow);
      const nestedMetrics = [
        ...arrayOrSingleton(campaignRow.metrics),
        ...arrayOrSingleton(campaignRow.analytics),
        ...arrayOrSingleton(campaignRow.performance),
      ];
      nestedMetrics.forEach((raw, index) => nestedCampaignMetricPayload.push({ raw, campaignExternalId, index }));
      const result = await upsertLovableCampaign(
        item,
        now,
        actorLabel,
        contentByExternalId,
        contactRowByExternalId,
        audienceContactExternalIdsByAudienceExternalId,
      );
      if (!result) continue;
      campaignCount += 1;
      campaignChannelCount += result.channelCount;
      campaignRows.push(result.campaign);
      campaignRecipientCount += result.recipientCount;
      missingContentReferenceCount += result.missingContentReferenceCount;
      unmappedCampaignRecipientExternalIds.push(...result.unmappedRecipientExternalIds);
    }

    let journeyCount = 0;
    let journeyStepPresetContentCount = 0;
    const journeyRows: MarketingJourneyRow[] = [];
    const nestedJourneyEnrollmentPayload: Array<{ raw: unknown; journeyExternalId: string | null; index: number }> = [];
    for (const item of journeyPayload) {
      const journeyRaw = asRecord(item);
      const journeyExternalId = normalizeLovableId(journeyRaw);
      const nestedEnrollments = [
        ...arrayOrSingleton(journeyRaw.enrollments),
        ...arrayOrSingleton(journeyRaw.progress),
      ];
      nestedEnrollments.forEach((raw, index) => nestedJourneyEnrollmentPayload.push({ raw, journeyExternalId, index }));
      const result = await upsertLovableJourney(item, now, actorLabel, contentByExternalId);
      if (result) {
        journeyRows.push(result.journey);
        journeyStepPresetContentCount += result.presetContentCount;
        missingContentReferenceCount += result.missingContentReferenceCount;
        journeyCount += 1;
      }
    }

    const campaignByExternalId = new Map<string, MarketingCampaignRow>();
    for (const item of campaignRows) {
      addExternalIdVariants(campaignByExternalId, item.lovable_external_id, item, ["campaign"]);
    }
    const knownCampaignRows = await db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.updated_at)).limit(5000);
    for (const item of knownCampaignRows) {
      addExternalIdVariants(campaignByExternalId, item.lovable_external_id, item, ["campaign"]);
    }
    let campaignMetricCount = 0;
    const allCampaignMetricPayload = [
      ...campaignMetricPayload.map((raw, index) => ({ raw, campaignExternalId: null as string | null, index })),
      ...nestedCampaignMetricPayload,
    ];
    for (const item of allCampaignMetricPayload) {
      if (await upsertLovableCampaignMetric(item.raw, now, campaignByExternalId, item.campaignExternalId, item.index)) campaignMetricCount += 1;
    }

    const journeyByExternalId = new Map<string, MarketingJourneyRow>();
    for (const item of journeyRows) {
      addExternalIdVariants(journeyByExternalId, item.lovable_external_id, item, ["journey", "workflow"]);
    }
    const knownJourneyRows = await db.select().from(marketingJourneys).orderBy(desc(marketingJourneys.updated_at)).limit(5000);
    for (const item of knownJourneyRows) {
      addExternalIdVariants(journeyByExternalId, item.lovable_external_id, item, ["journey", "workflow"]);
    }
    const knownJourneySteps = await db.select().from(marketingJourneySteps).orderBy(asc(marketingJourneySteps.step_order)).limit(20000);
    const stepByJourneyAndOrder = new Map(knownJourneySteps.map((step) => [`${step.journey_id}:${step.step_order}`, step]));
    let journeyEnrollmentCount = 0;
    let journeyStepEventCount = 0;
    const allJourneyEnrollmentPayload = [
      ...journeyEnrollmentPayload.map((raw, index) => ({ raw, journeyExternalId: null as string | null, index })),
      ...nestedJourneyEnrollmentPayload,
    ];
    for (const item of allJourneyEnrollmentPayload) {
      const result = await upsertLovableJourneyEnrollment(
        item.raw,
        now,
        journeyByExternalId,
        contactRowByExternalId,
        stepByJourneyAndOrder,
        item.journeyExternalId,
        item.index,
      );
      if (!result) continue;
      journeyEnrollmentCount += 1;
      journeyStepEventCount += result.eventCount;
    }
    if (journeyStepEventPayload.length) {
      const knownEnrollments = await db.select().from(marketingJourneyEnrollments).orderBy(desc(marketingJourneyEnrollments.updated_at)).limit(50000);
      const enrollmentByExternalId = new Map<string, MarketingJourneyEnrollmentRow>();
      const enrollmentByJourneyAndContact = new Map<string, MarketingJourneyEnrollmentRow>();
      for (const enrollment of knownEnrollments) {
        addExternalIdVariants(enrollmentByExternalId, enrollment.lovable_external_id, enrollment, ["enrollment", "journey_enrollment"]);
        if (enrollment.contact_external_id) {
          enrollmentByJourneyAndContact.set(`${enrollment.journey_id}:${enrollment.contact_external_id}`, enrollment);
        }
      }
      for (const [index, item] of journeyStepEventPayload.entries()) {
        if (await upsertLovableJourneyStepEvent(
          item,
          now,
          enrollmentByExternalId,
          enrollmentByJourneyAndContact,
          journeyByExternalId,
          stepByJourneyAndOrder,
          index,
        )) journeyStepEventCount += 1;
      }
    }

    const nestedMediaAssetExportCount = contentPayload.reduce((count, item) => {
      const row = asRecord(item);
      return count + contentMediaAssetsFrom(row).length;
    }, 0);
    const mediaAssetExportCount = nestedMediaAssetExportCount + standaloneMediaPayload.length;
    const campaignChannelExportCount = campaignPayload.reduce((count, item) => count + campaignChannelPayload(asRecord(item)).length, 0);
    const campaignRecipientExportCount = campaignPayload.reduce((count, item) => (
      count + campaignRecipientSourceCount(asRecord(item), audienceContactExternalIdsByAudienceExternalId)
    ), 0);
    const nestedJourneyStepEventExportCount = journeyEnrollmentPayload.reduce((count, item) => (
      count + journeyEnrollmentEventPayload(asRecord(item)).length
    ), 0);
    const journeyStepPresetExportCount = journeyStepPresetContentExportCount(journeyPayload);
    const contentSourceCounts = contentPayload.reduce<Record<string, number>>((counts, item) => {
      const sourceType = String(asRecord(item)[LOVABLE_CONTENT_SOURCE_KEY] ?? "content");
      counts[sourceType] = (counts[sourceType] ?? 0) + 1;
      return counts;
    }, {});
    if (journeyStepPresetExportCount || journeyStepPresetContentCount) {
      contentSourceCounts.journey_step_preset = Math.max(journeyStepPresetExportCount, journeyStepPresetContentCount);
    }
    if (missingContentReferenceCount) {
      contentSourceCounts.missing_lovable_reference = missingContentReferenceCount;
    }
    const exported = {
      campaigns: campaignPayload.length,
      contacts: contactPayload.length,
      content: contentPayload.length,
      journeyStepPresetContent: journeyStepPresetExportCount,
      mediaAssets: mediaAssetExportCount,
      campaignChannels: campaignChannelExportCount,
      campaignRecipients: campaignRecipientExportCount,
      campaignMetrics: allCampaignMetricPayload.length,
      journeys: journeyPayload.length,
      journeyEnrollments: allJourneyEnrollmentPayload.length,
      journeyStepEvents: nestedJourneyStepEventExportCount + journeyStepEventPayload.length,
      audiences: audiencePayload.length,
    };
    const fieldCoverage = {
      content: fieldCoverageForPayload(contentPayload, fieldCoverageAliases.content),
      media: fieldCoverageForPayload([...contentPayload.flatMap((item) => {
        const row = asRecord(item);
        return contentMediaAssetsFrom(row);
      }), ...standaloneMediaPayload], fieldCoverageAliases.media),
      contacts: fieldCoverageForPayload(contactPayload, fieldCoverageAliases.contacts),
      campaigns: fieldCoverageForPayload(campaignPayload, fieldCoverageAliases.campaigns),
      campaignMetrics: fieldCoverageForPayload(allCampaignMetricPayload.map((item) => item.raw), fieldCoverageAliases.campaignMetrics),
      journeys: fieldCoverageForPayload(journeyPayload, fieldCoverageAliases.journeys),
      journeyEnrollments: fieldCoverageForPayload(allJourneyEnrollmentPayload.map((item) => item.raw), fieldCoverageAliases.journeyEnrollments),
      journeyStepEvents: fieldCoverageForPayload([
        ...journeyEnrollmentPayload.flatMap((item) => journeyEnrollmentEventPayload(asRecord(item))),
        ...journeyStepEventPayload,
      ], fieldCoverageAliases.journeyStepEvents),
      audiences: fieldCoverageForPayload(audiencePayload, fieldCoverageAliases.audiences),
    };
    const imported = {
      campaigns: campaignCount,
      contacts: contactRows.length,
      content: contentRows.length,
      journeyStepPresetContent: journeyStepPresetContentCount,
      missingContentReferences: missingContentReferenceCount,
      mediaAssets: mediaAssetCount,
      campaignChannels: campaignChannelCount,
      campaignMetrics: campaignMetricCount,
      journeys: journeyCount,
      journeyEnrollments: journeyEnrollmentCount,
      journeyStepEvents: journeyStepEventCount,
      audiences: audienceCount,
      audienceMembers: audienceMemberCount,
      mappedAudienceMembers: mappedAudienceMemberCount,
      campaignRecipients: campaignRecipientCount,
    };
    const uniqueUnmappedAudienceContactExternalIds = Array.from(new Set(unmappedAudienceContactExternalIds));
    const uniqueUnmappedCampaignRecipientExternalIds = Array.from(new Set(unmappedCampaignRecipientExternalIds));
    const summary = {
      ...imported,
      exported,
      imported,
      skipped: {
        campaigns: exported.campaigns - imported.campaigns,
        contacts: exported.contacts - imported.contacts,
        content: exported.content - imported.content,
        journeyStepPresetContent: exported.journeyStepPresetContent - imported.journeyStepPresetContent,
        mediaAssets: exported.mediaAssets - imported.mediaAssets,
        campaignChannels: exported.campaignChannels - imported.campaignChannels,
        campaignRecipients: exported.campaignRecipients - imported.campaignRecipients,
        campaignMetrics: exported.campaignMetrics - imported.campaignMetrics,
        journeys: exported.journeys - imported.journeys,
        journeyEnrollments: exported.journeyEnrollments - imported.journeyEnrollments,
        journeyStepEvents: exported.journeyStepEvents - imported.journeyStepEvents,
        audiences: exported.audiences - imported.audiences,
      },
      unmapped: {
        audienceContactExternalIdCount: uniqueUnmappedAudienceContactExternalIds.length,
        audienceContactExternalIds: uniqueUnmappedAudienceContactExternalIds.slice(0, 50),
        campaignRecipientExternalIdCount: uniqueUnmappedCampaignRecipientExternalIds.length,
        campaignRecipientExternalIds: uniqueUnmappedCampaignRecipientExternalIds.slice(0, 50),
      },
      contentSourceCounts,
      fieldCoverage,
      mode: "one_way_into_vyva",
      dispatch_locked: true,
    };
    const [completed] = await db.update(marketingSyncRuns).set({
      status: "succeeded",
      completed_at: new Date(),
      cursor: typeof payload.cursor === "string" ? payload.cursor : null,
      summary,
    }).where(eq(marketingSyncRuns.id, run.id)).returning();
    return res.json({ ok: true, run: serializeSyncRun(completed), summary });
  } catch (error) {
    const message = marketingSchemaErrorMessage(error, error instanceof Error ? error.message : "Lovable marketing sync failed.");
    const [failed] = await db.update(marketingSyncRuns).set({
      status: "failed",
      completed_at: new Date(),
      error: message,
      summary: { mode: "one_way_into_vyva", dispatch_locked: true },
    }).where(eq(marketingSyncRuns.id, run.id)).returning();
    console.error("[admin/marketing] lovable sync failed", error);
    return res.status(502).json({ error: message, run: serializeSyncRun(failed) });
  }
});
