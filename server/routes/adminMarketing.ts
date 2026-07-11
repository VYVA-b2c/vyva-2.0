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
  const explicitRecipientIds = arrayFrom(row.recipients ?? row.recipientSnapshots ?? row.campaignRecipients ?? row.campaign_recipients).map((item) => {
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
  return Array.isArray(value) ? value : [];
}

function arrayOrSingleton(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

const LOVABLE_CONTENT_SOURCE_KEY = "__vyvaLovableContentSource";

const contentMediaArrayKeys = ["mediaAssets", "media_assets", "media", "images", "attachments"] as const;
const contentMediaUrlKeys = ["imageUrl", "image_url", "assetUrl", "asset_url", "thumbnailUrl", "thumbnail_url"] as const;

function withLovableContentSource(items: unknown[], sourceType: string) {
  return items.map((item) => ({
    ...asRecord(item),
    [LOVABLE_CONTENT_SOURCE_KEY]: sourceType,
  }));
}

function lovableContentPayload(payload: Record<string, unknown>) {
  return [
    ...withLovableContentSource(arrayFrom(payload.saved_email_templates ?? payload.savedEmailTemplates ?? payload.emailTemplates ?? payload.email_templates), "saved_email_template"),
    ...withLovableContentSource(arrayFrom(payload.templates), "template"),
    ...withLovableContentSource(arrayFrom(payload.content_briefs ?? payload.contentBriefs), "content_brief"),
    ...withLovableContentSource(arrayFrom(payload.contentAssets ?? payload.content_assets ?? payload.assets), "content_asset"),
    ...withLovableContentSource(arrayFrom(payload.content), "content"),
    ...withLovableContentSource(arrayFrom(payload.social_posts ?? payload.socialPosts), "social_post"),
  ];
}

function contentMediaAssetsFrom(row: Record<string, unknown>) {
  const nestedAssets = contentMediaArrayKeys.flatMap((key) => arrayFrom(row[key]));
  const urlAssets = contentMediaUrlKeys.map((key) => {
    const url = emptyToNull(textFrom(row, [key]));
    return url ? { url, sourceField: key } : null;
  }).filter((item): item is { url: string; sourceField: string } => Boolean(item));
  return [...nestedAssets, ...urlAssets];
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
    ["title", "name", "templateName", "template_name", "headline"],
    ["channel", "platform", "network"],
    ["language", "lang", "locale"],
    ["status"],
    ["subject", "emailSubject", "email_subject"],
    ["body", "copy", "text", "content", "contentBody", "content_body", "message", "caption", "description", "brief"],
    ["htmlBody", "html_body", "html", "renderedHtml", "rendered_html", "htmlContent", "html_content", "templateHtml", "template_html"],
    ["ctaLabel", "cta_label", "buttonText", "button_text"],
    ["ctaUrl", "cta_url", "link", "url"],
    ["designJson", "design_json", "design", "layout", "blocks", "templateJson", "template_json"],
    ["mediaAssets", "media_assets", "media", "images", "attachments", "imageUrl", "image_url", "assetUrl", "asset_url", "thumbnailUrl", "thumbnail_url"],
    ["updatedAt", "updated_at"],
  ],
  media: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["url", "src", "href", "originalUrl", "original_url"],
    ["localUrl", "local_url"],
    ["type", "kind", "assetType", "asset_type", "mimeType", "mime_type"],
    ["status", "importStatus", "import_status"],
    ["updatedAt", "updated_at"],
  ],
  contacts: [
    ["id", "externalId", "external_id", "lovableExternalId", "lovable_external_id"],
    ["name", "fullName", "full_name"],
    ["email"],
    ["phoneNumber", "phone_number", "phone"],
    ["whatsappNumber", "whatsapp_number", "whatsapp"],
    ["audienceType", "audience_type", "audience"],
    ["roleLabel", "role_label", "role"],
    ["companyName", "company_name", "company"],
    ["consentStatus", "consent_status"],
    ["channelAvailability", "channel_availability"],
    ["tags"],
    ["language", "lang", "locale"],
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
    ["scheduleStartsAt", "schedule_starts_at", "startsAt", "starts_at"],
    ["scheduleEndsAt", "schedule_ends_at", "endsAt", "ends_at"],
    ["timezone"],
    ["channels"],
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
    payload.flatMap((item) => Object.keys(asRecord(item)).filter((key) => key !== LOVABLE_CONTENT_SOURCE_KEY)),
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

function serializeAudience(row: MarketingAudienceRow, members: MarketingAudienceMemberRow[] = []) {
  const contactExternalIds = members
    .map((member) => member.contact_external_id)
    .filter((value): value is string => Boolean(value));
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
  return channel === "email" ? "enabled" : "locked";
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
        campaigns: bundle.campaignRows.filter((row) => row.audience_type === audienceType).length,
        contacts: contactRows.filter((row) => row.audience_type === audienceType).length,
      })),
      lockedSendCapabilities: channelSendCapabilities(),
      latestSyncRun: latestRuns[0] ? serializeSyncRun(latestRuns[0]) : null,
    });
  } catch (error) {
    console.error("[admin/marketing] summary failed", error);
    return res.status(500).json({ error: "Marketing summary could not be loaded." });
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
    return res.status(500).json({ error: "Marketing campaigns could not be loaded." });
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
    return res.status(500).json({ error: "Marketing analytics could not be loaded." });
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
    return res.status(500).json({ error: "Marketing campaign could not be created." });
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
    return res.status(500).json({ error: "Marketing campaign could not be updated." });
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
    return res.status(500).json({ error: "Marketing campaign could not be deleted." });
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
      body: content.body || campaign.objective || content.title,
      metadata: {
        subject,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        content_asset_id: content.id,
        content_title: content.title,
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

async function sendMarketingCampaignEmail(campaignId: string, actorLabel: string) {
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
  const contactRows = contactIds.length
    ? await db.select().from(marketingContacts).where(inArray(marketingContacts.id, contactIds))
    : [];
  const contactsById = new Map(contactRows.map((row) => [row.id, row]));
  const seenRecipients = new Set<string>();
  const sendableRecipients: MarketingCampaignRecipientRow[] = [];
  const skipped: Array<{ id: string; recipient: string; reason: string }> = [];

  for (const recipientRow of emailRecipients) {
    const normalizedRecipient = recipientRow.recipient.trim().toLowerCase();
    const contact = recipientRow.contact_id ? contactsById.get(recipientRow.contact_id) : null;
    const snapshot = asRecord(recipientRow.snapshot);
    const consentStatus = String(contact?.consent_status ?? snapshot.consentStatus ?? "").toLowerCase();
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
    body: content.body || campaign.objective || content.title,
    metadata: {
      subject,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      content_asset_id: content.id,
      content_title: content.title,
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
    const now = new Date();
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
        const result = await sendMarketingCampaignEmail(campaign.id, actor(req));
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
    return res.json({
      ok: failedCount === 0,
      checkedAt: now.toISOString(),
      dueCount: dueCampaigns.length,
      sentCount,
      failedCount,
      skippedCount,
      results,
    });
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
    return res.status(500).json({ error: "Marketing content could not be loaded." });
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
    return res.status(500).json({ error: "Marketing media assets could not be loaded." });
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
    return res.status(201).json({ ok: true, content: serializeContent(content) });
  } catch (error) {
    console.error("[admin/marketing] content create failed", error);
    return res.status(500).json({ error: "Marketing content could not be created." });
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
    return res.json({ ok: true, content: serializeContent(content) });
  } catch (error) {
    console.error("[admin/marketing] content update failed", error);
    return res.status(500).json({ error: "Marketing content could not be updated." });
  }
});

adminMarketingRouter.delete("/content/:contentId", async (req, res) => {
  try {
    const [content] = await db.select().from(marketingContentAssets).where(eq(marketingContentAssets.id, req.params.contentId)).limit(1);
    if (!content) return res.status(404).json({ error: "Marketing content not found." });
    await db.delete(marketingMediaAssets).where(eq(marketingMediaAssets.content_asset_id, content.id));
    await db.delete(marketingContentAssets).where(eq(marketingContentAssets.id, content.id));
    return res.json({ ok: true, deletedContentId: content.id });
  } catch (error) {
    console.error("[admin/marketing] content delete failed", error);
    return res.status(500).json({ error: "Marketing content could not be deleted." });
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
    return res.status(500).json({ error: "Marketing journeys could not be loaded." });
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
    return res.status(500).json({ error: "Marketing journey enrollments could not be loaded." });
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
    return res.status(500).json({ error: "Marketing journey could not be created." });
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
    return res.status(500).json({ error: "Marketing journey could not be updated." });
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
    return res.status(500).json({ error: "Marketing journey could not be deleted." });
  }
});

adminMarketingRouter.get("/audiences", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const [audienceRows, memberRows] = await Promise.all([
      db.select().from(marketingAudiences).orderBy(desc(marketingAudiences.updated_at)).limit(1000),
      db.select().from(marketingAudienceMembers).orderBy(asc(marketingAudienceMembers.created_at)).limit(100000),
    ]);
    const membersByAudience = groupBy(memberRows, (row) => row.audience_id);
    const audiences = audienceRows
      .map((row) => serializeAudience(row, membersByAudience.get(row.id)))
      .filter((audience) => !search || [
        audience.name,
        audience.description,
        audience.listType,
        audience.source,
        audience.lovableExternalId,
        ...audience.unmappedContactExternalIds,
      ].some((value) => textMatches(value, search)));
    return res.json({ audiences });
  } catch (error) {
    console.error("[admin/marketing] audiences load failed", error);
    return res.status(500).json({ error: "Marketing audiences could not be loaded." });
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
    const contactByExternalId = new Map(contactRows.map((row) => [row.lovable_external_id ?? "", row.id]).filter(([externalId]) => externalId));
    const members = contactExternalIds.length
      ? await db.insert(marketingAudienceMembers).values(contactExternalIds.map((contactExternalId) => ({
        audience_id: audience.id,
        contact_id: contactByExternalId.get(contactExternalId) ?? null,
        contact_external_id: contactExternalId,
        source: parsed.data.source,
        metadata: { manual_rule_builder: true, mapped: contactByExternalId.has(contactExternalId) },
        updated_at: now,
      }))).returning()
      : [];

    return res.status(201).json({ ok: true, audience: serializeAudience(audience, members) });
  } catch (error) {
    console.error("[admin/marketing] audience create failed", error);
    return res.status(500).json({ error: "Marketing audience could not be created." });
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
      const contactByExternalId = new Map(contactRows.map((row) => [row.lovable_external_id ?? "", row.id]).filter(([externalId]) => externalId));
      members = contactExternalIds.length
        ? await db.insert(marketingAudienceMembers).values(contactExternalIds.map((contactExternalId) => ({
          audience_id: audience.id,
          contact_id: contactByExternalId.get(contactExternalId) ?? null,
          contact_external_id: contactExternalId,
          source: audience.source,
          metadata: { manual_rule_builder: true, mapped: contactByExternalId.has(contactExternalId) },
          updated_at: now,
        }))).returning()
        : [];
    }
    return res.json({ ok: true, audience: serializeAudience(audience, members) });
  } catch (error) {
    console.error("[admin/marketing] audience update failed", error);
    return res.status(500).json({ error: "Marketing audience could not be updated." });
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
    return res.status(500).json({ error: "Marketing audience could not be deleted." });
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
    return res.status(500).json({ error: "Marketing contacts could not be loaded." });
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
    return res.status(500).json({ error: "Marketing contact could not be created." });
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
    return res.status(500).json({ error: "Marketing contact could not be updated." });
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
    return res.status(500).json({ error: "Marketing contact could not be deleted." });
  }
});

adminMarketingRouter.get("/sync/lovable", async (req, res) => {
  const hasUrl = Boolean(process.env.LOVABLE_MARKETING_API_URL?.trim());
  const hasBearerToken = Boolean(process.env.LOVABLE_MARKETING_API_KEY?.trim());
  const runs = await db.select().from(marketingSyncRuns).orderBy(desc(marketingSyncRuns.created_at)).limit(10);
  return res.json({
    provider: "lovable",
    configured: hasUrl && hasBearerToken,
    canRunSync: isSuperAdmin(req),
    requiredRunnerEmail: SUPER_ADMIN_EMAIL,
    apiUrl: safeUrlOrigin(process.env.LOVABLE_MARKETING_API_URL),
    mode: "one_way_into_vyva",
    realSendingLocked: false,
    lockedSendCapabilities: channelSendCapabilities(),
    runs: runs.map(serializeSyncRun),
  });
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
  const designJson = asRecord(row.designJson ?? row.design_json ?? row.design ?? row.layout ?? row.blocks ?? row.templateJson ?? row.template_json);
  const mediaAssets = contentMediaAssetsFrom(row);
  const title = textFrom(
    row,
    ["title", "name", "templateName", "template_name", "headline"],
    textFrom(row, ["subject", "emailSubject", "email_subject"], sourceType === "social_post" ? "Untitled social post" : "Untitled content"),
  );
  const { [LOVABLE_CONTENT_SOURCE_KEY]: _sourceMarker, ...lovableMetadata } = row;
  const payload = {
    title,
    channel: normalizeChannel(textFrom(row, ["channel", "platform", "network"], sourceType === "social_post" ? "instagram" : "email")),
    language: textFrom(row, ["language", "lang", "locale"], "en"),
    status: normalizeContentStatus(textFrom(row, ["status"], "draft")),
    subject: emptyToNull(textFrom(row, ["subject", "emailSubject", "email_subject"])),
    body: textFrom(row, ["body", "copy", "text", "content", "contentBody", "content_body", "message", "caption", "description", "brief"], ""),
    html_body: emptyToNull(textFrom(row, ["htmlBody", "html_body", "html", "renderedHtml", "rendered_html", "htmlContent", "html_content", "templateHtml", "template_html"])),
    cta_label: emptyToNull(textFrom(row, ["ctaLabel", "cta_label", "buttonText", "button_text"])),
    cta_url: emptyToNull(textFrom(row, ["ctaUrl", "cta_url", "link", "url"])),
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

async function replaceLovableMediaAssets(content: MarketingContentAssetRow, mediaAssets: unknown[], now: Date) {
  await db.delete(marketingMediaAssets).where(and(
    eq(marketingMediaAssets.content_asset_id, content.id),
    eq(marketingMediaAssets.source, "lovable"),
  ));
  const rows = mediaAssets.map((raw, index) => {
    const media = typeof raw === "string" ? { url: raw } : asRecord(raw);
    const originalUrl = emptyToNull(textFrom(media, ["url", "src", "href", "originalUrl", "original_url"]));
    if (!originalUrl) return null;
    const localUrl = emptyToNull(textFrom(media, ["localUrl", "local_url"]));
    const externalId = normalizeLovableId(media) ?? `${content.lovable_external_id ?? content.id}:media:${index}:${originalUrl}`;
    return {
      content_asset_id: content.id,
      source: "lovable",
      asset_type: textFrom(media, ["type", "kind", "assetType", "asset_type", "mimeType", "mime_type"], "unknown"),
      original_url: originalUrl,
      local_url: localUrl,
      status: textFrom(media, ["status", "importStatus", "import_status"], localUrl ? "mirrored" : "referenced"),
      lovable_external_id: externalId,
      metadata: { lovable: media },
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

async function upsertLovableContact(raw: unknown, now: Date) {
  const row = asRecord(raw);
  const externalId = normalizeLovableId(row);
  if (!externalId) return null;
  const metadata = asRecord(row.metadata);
  const segmentation = asRecord(row.segmentation ?? metadata.segmentation);
  const language = nestedText(segmentation, row, metadata, ["language", "lang", "locale"]);
  const category = nestedText(segmentation, row, metadata, ["category", "contactCategory", "contact_category"]);
  const vertical = nestedText(segmentation, row, metadata, ["vertical", "industry", "sector"]);
  const market = nestedText(segmentation, row, metadata, ["market", "country", "region"]);
  const email = emptyToNull(textFrom(row, ["email"]));
  const phoneNumber = emptyToNull(textFrom(row, ["phoneNumber", "phone_number", "phone"]));
  const whatsappNumber = emptyToNull(textFrom(row, ["whatsappNumber", "whatsapp_number", "whatsapp"]));
  const channelAvailability = {
    email: Boolean(email),
    phone: Boolean(phoneNumber),
    whatsapp: Boolean(whatsappNumber),
    ...asRecord(row.channelAvailability ?? row.channel_availability),
  };
  const payload = {
    audience_type: normalizeAudience(textFrom(row, ["audienceType", "audience_type", "audience"], "b2b")),
    full_name: textFrom(row, ["fullName", "full_name", "name"], ""),
    email,
    phone_number: phoneNumber,
    whatsapp_number: whatsappNumber,
    role_label: emptyToNull(textFrom(row, ["roleLabel", "role_label", "role"])),
    company_name: emptyToNull(textFrom(row, ["companyName", "company_name", "company"])),
    language,
    category,
    vertical,
    market,
    consent_status: (consentStatuses as readonly string[]).includes(textFrom(row, ["consentStatus", "consent_status"], "unknown"))
      ? textFrom(row, ["consentStatus", "consent_status"], "unknown")
      : "unknown",
    source: "lovable",
    channel_availability: channelAvailability,
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    lovable_external_id: externalId,
    last_synced_at: now,
    metadata: {
      lovable: row,
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
  const unmappedContactExternalIds = contactExternalIds.filter((contactExternalId) => !contactByExternalId.has(contactExternalId));
  const payload = {
    name: textFrom(row, ["name", "title"], "Untitled audience"),
    description: emptyToNull(textFrom(row, ["description"])),
    list_type: textFrom(row, ["listType", "list_type", "type"], "static"),
    rules: asRecord(row.rules ?? row.ruleConfig ?? row.rule_config ?? row.filters),
    source: "lovable",
    lovable_external_id: externalId,
    metadata: {
      lovable: row,
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
      contact_id: contactByExternalId.get(contactExternalId) ?? null,
      contact_external_id: contactExternalId,
      source: "lovable",
      metadata: {
        lovable_audience_external_id: externalId,
        mapped: contactByExternalId.has(contactExternalId),
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
  const explicitRows = arrayFrom(row.recipients ?? row.recipientSnapshots ?? row.campaignRecipients ?? row.campaign_recipients);
  const directContactExternalIds = campaignDirectContactExternalIds(row);
  const audienceExternalIds = campaignAudienceExternalIds(row);
  const audienceContactExternalIds = audienceExternalIds.flatMap((audienceExternalId) => audienceContactExternalIdsByAudienceExternalId.get(audienceExternalId) ?? []);
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
    const contact = contactExternalId ? contactRowByExternalId.get(contactExternalId) ?? null : null;
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
    const contact = contactRowByExternalId.get(contactExternalId) ?? null;
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
  const campaign = campaignExternalId ? campaignByExternalId.get(campaignExternalId) ?? null : null;
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
    schedule_starts_at: dateOrNull(dateTextFrom(row, ["scheduleStartsAt", "schedule_starts_at", "startsAt", "starts_at"])),
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

  const channelRows = arrayFrom(row.channels);
  const firstChannelRow = asRecord(channelRows[0]);
  const defaultChannel = normalizeChannel(textFrom(firstChannelRow, ["channel"], "email"));
  const defaultScheduledAt = dateOrNull(dateTextFrom(firstChannelRow, ["scheduledAt", "scheduled_at"])) ?? campaign.schedule_starts_at ?? null;
  if (channelRows.length) {
    await db.delete(marketingCampaignChannels).where(eq(marketingCampaignChannels.campaign_id, campaign.id));
    await db.insert(marketingCampaignChannels).values(channelRows.map((channelRaw) => {
      const channelRow = asRecord(channelRaw);
      const contentExternalId = textFrom(channelRow, ["contentExternalId", "content_external_id", "contentId", "content_id"]);
      const channel = normalizeChannel(textFrom(channelRow, ["channel"], "email"));
      return {
        campaign_id: campaign.id,
        channel,
        content_asset_id: contentByExternalId.get(contentExternalId) ?? null,
        scheduled_at: dateOrNull(dateTextFrom(channelRow, ["scheduledAt", "scheduled_at"])),
        status: normalizeCampaignStatus(textFrom(channelRow, ["status"], payload.status)),
        send_capability: sendCapabilityForChannel(channel),
        metadata: sendMetadataForChannel(channel, { lovable: channelRow }),
        updated_at: now,
      };
    }));
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
    recipientCount: recipientImport.recipientRows.length,
    unmappedRecipientExternalIds: recipientImport.unmappedContactExternalIds,
  };
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
    trigger_config: asRecord(row.triggerConfig ?? row.trigger_config),
    goal_type: emptyToNull(textFrom(row, ["goalType", "goal_type"])),
    goal_config: asRecord(row.goalConfig ?? row.goal_config),
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
  if (steps.length) {
    await db.delete(marketingJourneySteps).where(eq(marketingJourneySteps.journey_id, journey.id));
    await db.insert(marketingJourneySteps).values(steps.map((stepRaw, index) => {
      const step = asRecord(stepRaw);
      const contentExternalId = textFrom(step, ["contentExternalId", "content_external_id", "contentId", "content_id"]);
      const dayOffset = Number(step.dayOffset ?? step.day_offset ?? step.day ?? 0);
      const delayHours = Number(step.delayHours ?? step.delay_hours ?? (Number.isFinite(dayOffset) ? dayOffset * 24 : 0));
      return {
        journey_id: journey.id,
        step_order: Number(step.stepOrder ?? step.step_order ?? index),
        channel: normalizeChannel(textFrom(step, ["channel"], "email")),
        content_asset_id: contentByExternalId.get(contentExternalId) ?? null,
        delay_hours: Number.isFinite(delayHours) ? delayHours : 0,
        kind: textFrom(step, ["kind", "stepKind", "step_kind", "type"], "message"),
        day_offset: Number.isFinite(dayOffset) ? dayOffset : 0,
        template_kind: emptyToNull(textFrom(step, ["templateKind", "template_kind"])),
        template_ref: emptyToNull(textFrom(step, ["templateRef", "template_ref", "templateId", "template_id"])) ?? (contentExternalId || null),
        config: asRecord(step.config),
        status: normalizeJourneyStatus(textFrom(step, ["status"], "draft")),
        metadata: { lovable: step },
        updated_at: now,
      };
    }));
  }
  return journey;
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
  const journey = journeyExternalId ? journeyByExternalId.get(journeyExternalId) ?? null : null;
  if (!journey) return null;
  const contactExternalId = emptyToNull(textFrom(row, ["contactExternalId", "contact_external_id", "contactId", "contact_id", "externalId", "external_id"]));
  const contact = contactExternalId ? contactRowByExternalId.get(contactExternalId) ?? null : null;
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

  const eventPayload = [
    ...arrayFrom(row.events),
    ...arrayFrom(row.stepEvents),
    ...arrayFrom(row.step_events),
    ...arrayFrom(row.history),
  ];
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

adminMarketingRouter.post("/sync/lovable/run", async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const apiUrl = process.env.LOVABLE_MARKETING_API_URL?.trim();
  const apiKey = process.env.LOVABLE_MARKETING_API_KEY?.trim();
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
    const contactPayload = arrayFrom(payload.contacts);
    const campaignPayload = arrayFrom(payload.campaigns);
    const journeyPayload = arrayFrom(payload.journeys);
    const audiencePayload = arrayFrom(payload.audiences ?? payload.lists ?? payload.contactLists);
    const campaignMetricPayload = arrayFrom(payload.campaignMetrics ?? payload.campaign_metrics ?? payload.analytics ?? payload.metrics);
    const journeyEnrollmentPayload = arrayFrom(payload.journeyEnrollments ?? payload.journey_enrollments ?? payload.enrollments ?? payload.progress);
    const contentRows: MarketingContentAssetRow[] = [];
    let mediaAssetCount = 0;
    for (const item of contentPayload) {
      const result = await upsertLovableContent(item, now, actorLabel);
      if (!result) continue;
      contentRows.push(result.content);
      mediaAssetCount += result.mediaAssetCount;
    }
    const contentByExternalId = new Map(contentRows.map((item) => [item.lovable_external_id ?? "", item.id]).filter(([externalId]) => externalId));
    if (contentByExternalId.size < contentRows.length) {
      const ids = contentRows.map((item) => item.lovable_external_id).filter((value): value is string => Boolean(value));
      if (ids.length) {
        const rows = await db.select().from(marketingContentAssets).where(inArray(marketingContentAssets.lovable_external_id, ids));
        for (const item of rows) {
          if (item.lovable_external_id) contentByExternalId.set(item.lovable_external_id, item.id);
        }
      }
    }

    const contactRows = [];
    for (const item of contactPayload) {
      const contact = await upsertLovableContact(item, now);
      if (contact) contactRows.push(contact);
    }
    const contactRowByExternalId = new Map<string, MarketingContactRow>();
    for (const item of contactRows) {
      if (item.lovable_external_id) contactRowByExternalId.set(item.lovable_external_id, item);
    }
    const contactByExternalId = new Map(contactRows.map((item) => [item.lovable_external_id ?? "", item.id]).filter(([externalId]) => externalId));
    if (contactByExternalId.size < contactRows.length) {
      const ids = contactRows.map((item) => item.lovable_external_id).filter((value): value is string => Boolean(value));
      if (ids.length) {
        const rows = await db.select().from(marketingContacts).where(inArray(marketingContacts.lovable_external_id, ids));
        for (const item of rows) {
          if (item.lovable_external_id) contactByExternalId.set(item.lovable_external_id, item.id);
          if (item.lovable_external_id) contactRowByExternalId.set(item.lovable_external_id, item);
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
      if (audienceExternalId) audienceContactExternalIdsByAudienceExternalId.set(audienceExternalId, audienceContactExternalIds(audienceRow));
      const result = await upsertLovableAudience(item, now, actorLabel, contactByExternalId);
      if (!result) continue;
      audienceCount += 1;
      audienceMemberCount += result.memberCount;
      mappedAudienceMemberCount += result.mappedMemberCount;
      unmappedAudienceContactExternalIds.push(...result.unmappedContactExternalIds);
    }

    let campaignCount = 0;
    let campaignRecipientCount = 0;
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
      campaignRows.push(result.campaign);
      campaignRecipientCount += result.recipientCount;
      unmappedCampaignRecipientExternalIds.push(...result.unmappedRecipientExternalIds);
    }

    let journeyCount = 0;
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
      const journey = await upsertLovableJourney(item, now, actorLabel, contentByExternalId);
      if (journey) {
        journeyRows.push(journey);
        journeyCount += 1;
      }
    }

    const campaignByExternalId = new Map<string, MarketingCampaignRow>();
    for (const item of campaignRows) {
      if (item.lovable_external_id) campaignByExternalId.set(item.lovable_external_id, item);
    }
    const knownCampaignRows = await db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.updated_at)).limit(5000);
    for (const item of knownCampaignRows) {
      if (item.lovable_external_id) campaignByExternalId.set(item.lovable_external_id, item);
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
      if (item.lovable_external_id) journeyByExternalId.set(item.lovable_external_id, item);
    }
    const knownJourneyRows = await db.select().from(marketingJourneys).orderBy(desc(marketingJourneys.updated_at)).limit(5000);
    for (const item of knownJourneyRows) {
      if (item.lovable_external_id) journeyByExternalId.set(item.lovable_external_id, item);
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

    const nestedMediaAssetExportCount = contentPayload.reduce((count, item) => {
      const row = asRecord(item);
      return count + contentMediaAssetsFrom(row).length;
    }, 0);
    const exported = {
      campaigns: campaignPayload.length,
      contacts: contactPayload.length,
      content: contentPayload.length,
      mediaAssets: nestedMediaAssetExportCount,
      campaignMetrics: allCampaignMetricPayload.length,
      journeys: journeyPayload.length,
      journeyEnrollments: allJourneyEnrollmentPayload.length,
      audiences: audiencePayload.length,
    };
    const fieldCoverage = {
      content: fieldCoverageForPayload(contentPayload, fieldCoverageAliases.content),
      media: fieldCoverageForPayload(contentPayload.flatMap((item) => {
        const row = asRecord(item);
        return contentMediaAssetsFrom(row);
      }), fieldCoverageAliases.media),
      contacts: fieldCoverageForPayload(contactPayload, fieldCoverageAliases.contacts),
      campaigns: fieldCoverageForPayload(campaignPayload, fieldCoverageAliases.campaigns),
      campaignMetrics: fieldCoverageForPayload(allCampaignMetricPayload.map((item) => item.raw), fieldCoverageAliases.campaignMetrics),
      journeys: fieldCoverageForPayload(journeyPayload, fieldCoverageAliases.journeys),
      journeyEnrollments: fieldCoverageForPayload(allJourneyEnrollmentPayload.map((item) => item.raw), fieldCoverageAliases.journeyEnrollments),
      audiences: fieldCoverageForPayload(audiencePayload, fieldCoverageAliases.audiences),
    };
    const imported = {
      campaigns: campaignCount,
      contacts: contactRows.length,
      content: contentRows.length,
      mediaAssets: mediaAssetCount,
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
        mediaAssets: exported.mediaAssets - imported.mediaAssets,
        campaignMetrics: exported.campaignMetrics - imported.campaignMetrics,
        journeys: exported.journeys - imported.journeys,
        journeyEnrollments: exported.journeyEnrollments - imported.journeyEnrollments,
        audiences: exported.audiences - imported.audiences,
      },
      unmapped: {
        audienceContactExternalIdCount: uniqueUnmappedAudienceContactExternalIds.length,
        audienceContactExternalIds: uniqueUnmappedAudienceContactExternalIds.slice(0, 50),
        campaignRecipientExternalIdCount: uniqueUnmappedCampaignRecipientExternalIds.length,
        campaignRecipientExternalIds: uniqueUnmappedCampaignRecipientExternalIds.slice(0, 50),
      },
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
    const message = error instanceof Error ? error.message : "Lovable marketing sync failed.";
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
