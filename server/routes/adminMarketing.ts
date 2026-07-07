import { Router, type Request, type Response } from "express";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  marketingCampaignChannels,
  marketingCampaignRecipients,
  marketingCampaigns,
  marketingContacts,
  marketingContentAssets,
  marketingJourneySteps,
  marketingJourneys,
  marketingSyncRuns,
  type MarketingCampaignChannelRow,
  type MarketingCampaignRecipientRow,
  type MarketingCampaignRow,
  type MarketingContactRow,
  type MarketingContentAssetRow,
  type MarketingJourneyRow,
  type MarketingJourneyStepRow,
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
  sendCapability: z.enum(["locked", "future_send_capable", "planning_only"]).optional().default("locked"),
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
  ctaLabel: z.string().trim().max(80).nullable().optional(),
  ctaUrl: z.string().trim().max(500).nullable().optional(),
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
  status: journeyStatusSchema.optional().default("draft"),
  metadata: metadataSchema,
});

const journeyBodySchema = z.object({
  name: z.string().trim().min(1).max(180),
  status: journeyStatusSchema.optional().default("draft"),
  audienceType: audienceTypeSchema.optional().default("b2c"),
  objective: z.string().trim().max(500).optional().default(""),
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
  consentStatus: consentStatusSchema.optional().default("unknown"),
  source: z.string().trim().min(1).max(80).optional().default("vyva"),
  channelAvailability: metadataSchema,
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
  lovableExternalId: z.string().trim().max(160).nullable().optional(),
  metadata: metadataSchema,
});

const contactPatchSchema = contactBodySchema.partial();

function actor(req: Request) {
  return String(req.user?.email ?? req.user?.id ?? "admin");
}

function isSuperAdmin(req: Request) {
  return typeof req.user?.email === "string" && req.user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

function requireSuperAdmin(req: Request, res: Response) {
  if (isSuperAdmin(req)) return true;
  res.status(403).json({ error: "Only the super admin can run Lovable marketing sync." });
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

function textArrayFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item.trim();
    const row = asRecord(item);
    return textFrom(row, ["name", "title", "label", "id"]);
  }).filter(Boolean);
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

function normalizeLovableId(row: Record<string, unknown>) {
  return emptyToNull(textFrom(row, ["lovableExternalId", "lovable_external_id", "externalId", "external_id", "id"]));
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function serializeContent(row: MarketingContentAssetRow) {
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    language: row.language,
    status: row.status,
    subject: row.subject,
    body: row.body,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    source: row.source,
    lovableExternalId: row.lovable_external_id,
    metadata: row.metadata,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
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

function serializeContact(row: MarketingContactRow) {
  const metadata = asRecord(row.metadata);
  const lovable = asRecord(metadata.lovable);
  const segmentation = asRecord(metadata.segmentation);
  const lists = [
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
    language: nestedText(segmentation, lovable, metadata, ["language", "lang", "locale"]),
    category: nestedText(segmentation, lovable, metadata, ["category", "contactCategory", "contact_category"]),
    vertical: nestedText(segmentation, lovable, metadata, ["vertical", "industry", "sector"]),
    market: nestedText(segmentation, lovable, metadata, ["market", "country", "region"]),
    lists: Array.from(new Set(lists)),
    lovableExternalId: row.lovable_external_id,
    lastSyncedAt: iso(row.last_synced_at),
    metadata: row.metadata,
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
    sendCapability: channel === "email" || channel === "whatsapp" ? "future_send_capable" : "planning_only",
    locked: true,
    note: channel === "email" || channel === "whatsapp"
      ? "Provider dispatch is intentionally locked for the marketing foundation."
      : "Planning/tracking only until social platform integrations are added.",
  }));
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
    const [contentRows, contactRows, journeyRows, latestRuns, bundle] = await Promise.all([
      db.select().from(marketingContentAssets).orderBy(desc(marketingContentAssets.updated_at)).limit(1000),
      db.select().from(marketingContacts).orderBy(desc(marketingContacts.updated_at)).limit(2000),
      db.select().from(marketingJourneys).orderBy(desc(marketingJourneys.updated_at)).limit(500),
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

    return res.json({
      totals: {
        campaigns: bundle.campaignRows.length,
        journeys: journeyRows.length,
        content: contentRows.length,
        contacts: contactRows.length,
        thisWeek: bundle.campaignRows.filter((row) => row.schedule_starts_at && row.schedule_starts_at >= weekStart && row.schedule_starts_at < weekEnd).length,
        scheduled: bundle.campaignRows.filter((row) => row.status === "scheduled").length,
        published: bundle.campaignRows.filter((row) => row.status === "published").length,
      },
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
        send_capability: "locked",
        metadata: { ...item.metadata, send_locked: true },
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

adminMarketingRouter.get("/content", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const channel = String(req.query.channel ?? "all");
    const status = String(req.query.status ?? "all");
    const rows = await db.select().from(marketingContentAssets).orderBy(desc(marketingContentAssets.updated_at)).limit(1000);
    const content = rows
      .filter((row) => channel === "all" || row.channel === channel)
      .filter((row) => status === "all" || row.status === status)
      .filter((row) => !search || textMatches(row.title, search) || textMatches(row.subject, search) || textMatches(row.body, search))
      .map(serializeContent);
    return res.json({ content });
  } catch (error) {
    console.error("[admin/marketing] content load failed", error);
    return res.status(500).json({ error: "Marketing content could not be loaded." });
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
      cta_label: parsed.data.ctaLabel ?? null,
      cta_url: parsed.data.ctaUrl ?? null,
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
  if (parsed.data.ctaLabel !== undefined) patch.cta_label = parsed.data.ctaLabel ?? null;
  if (parsed.data.ctaUrl !== undefined) patch.cta_url = parsed.data.ctaUrl ?? null;
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

adminMarketingRouter.get("/contacts", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const audience = String(req.query.audience ?? "all");
    const rows = await db.select().from(marketingContacts).orderBy(desc(marketingContacts.updated_at)).limit(2000);
    const contacts = rows
      .filter((row) => audience === "all" || row.audience_type === audience)
      .filter((row) => {
        if (!search) return true;
        const serialized = serializeContact(row);
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
      .map(serializeContact);
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
    realSendingLocked: true,
    lockedSendCapabilities: channelSendCapabilities(),
    runs: runs.map(serializeSyncRun),
  });
});

async function upsertLovableContent(raw: unknown, now: Date, actorLabel: string) {
  const row = asRecord(raw);
  const externalId = normalizeLovableId(row);
  if (!externalId) return null;
  const payload = {
    title: textFrom(row, ["title", "name"], "Untitled content"),
    channel: normalizeChannel(textFrom(row, ["channel"], "email")),
    language: textFrom(row, ["language", "locale"], "en"),
    status: normalizeContentStatus(textFrom(row, ["status"], "draft")),
    subject: emptyToNull(textFrom(row, ["subject"])),
    body: textFrom(row, ["body", "copy", "text"], ""),
    cta_label: emptyToNull(textFrom(row, ["ctaLabel", "cta_label"])),
    cta_url: emptyToNull(textFrom(row, ["ctaUrl", "cta_url"])),
    source: "lovable",
    lovable_external_id: externalId,
    metadata: { lovable: row },
    updated_by: actorLabel,
    updated_at: now,
  };
  const [content] = await db.insert(marketingContentAssets)
    .values({ ...payload, created_by: actorLabel })
    .onConflictDoUpdate({ target: marketingContentAssets.lovable_external_id, set: payload })
    .returning();
  return content;
}

async function upsertLovableContact(raw: unknown, now: Date) {
  const row = asRecord(raw);
  const externalId = normalizeLovableId(row);
  if (!externalId) return null;
  const payload = {
    audience_type: normalizeAudience(textFrom(row, ["audienceType", "audience_type", "audience"], "b2b")),
    full_name: textFrom(row, ["fullName", "full_name", "name"], ""),
    email: emptyToNull(textFrom(row, ["email"])),
    phone_number: emptyToNull(textFrom(row, ["phoneNumber", "phone_number", "phone"])),
    whatsapp_number: emptyToNull(textFrom(row, ["whatsappNumber", "whatsapp_number", "whatsapp"])),
    role_label: emptyToNull(textFrom(row, ["roleLabel", "role_label", "role"])),
    company_name: emptyToNull(textFrom(row, ["companyName", "company_name", "company"])),
    consent_status: (consentStatuses as readonly string[]).includes(textFrom(row, ["consentStatus", "consent_status"], "unknown"))
      ? textFrom(row, ["consentStatus", "consent_status"], "unknown")
      : "unknown",
    source: "lovable",
    channel_availability: asRecord(row.channelAvailability ?? row.channel_availability),
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    lovable_external_id: externalId,
    last_synced_at: now,
    metadata: { lovable: row },
    updated_at: now,
  };
  const [contact] = await db.insert(marketingContacts)
    .values(payload)
    .onConflictDoUpdate({ target: marketingContacts.lovable_external_id, set: payload })
    .returning();
  return contact;
}

async function upsertLovableCampaign(raw: unknown, now: Date, actorLabel: string, contentByExternalId: Map<string, string>) {
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
  if (channelRows.length) {
    await db.delete(marketingCampaignChannels).where(eq(marketingCampaignChannels.campaign_id, campaign.id));
    await db.insert(marketingCampaignChannels).values(channelRows.map((channelRaw) => {
      const channelRow = asRecord(channelRaw);
      const contentExternalId = textFrom(channelRow, ["contentExternalId", "content_external_id", "contentId", "content_id"]);
      return {
        campaign_id: campaign.id,
        channel: normalizeChannel(textFrom(channelRow, ["channel"], "email")),
        content_asset_id: contentByExternalId.get(contentExternalId) ?? null,
        scheduled_at: dateOrNull(dateTextFrom(channelRow, ["scheduledAt", "scheduled_at"])),
        status: normalizeCampaignStatus(textFrom(channelRow, ["status"], payload.status)),
        send_capability: "locked",
        metadata: { lovable: channelRow, send_locked: true },
        updated_at: now,
      };
    }));
  }
  return campaign;
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
      return {
        journey_id: journey.id,
        step_order: Number(step.stepOrder ?? step.step_order ?? index),
        channel: normalizeChannel(textFrom(step, ["channel"], "email")),
        content_asset_id: contentByExternalId.get(contentExternalId) ?? null,
        delay_hours: Number(step.delayHours ?? step.delay_hours ?? 0),
        status: normalizeJourneyStatus(textFrom(step, ["status"], "draft")),
        metadata: { lovable: step },
        updated_at: now,
      };
    }));
  }
  return journey;
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
    const contentRows = [];
    for (const item of arrayFrom(payload.content ?? payload.contentAssets ?? payload.assets)) {
      const content = await upsertLovableContent(item, now, actorLabel);
      if (content) contentRows.push(content);
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

    let contactCount = 0;
    for (const item of arrayFrom(payload.contacts)) {
      if (await upsertLovableContact(item, now)) contactCount += 1;
    }

    let campaignCount = 0;
    for (const item of arrayFrom(payload.campaigns)) {
      if (await upsertLovableCampaign(item, now, actorLabel, contentByExternalId)) campaignCount += 1;
    }

    let journeyCount = 0;
    for (const item of arrayFrom(payload.journeys)) {
      if (await upsertLovableJourney(item, now, actorLabel, contentByExternalId)) journeyCount += 1;
    }

    const summary = {
      campaigns: campaignCount,
      contacts: contactCount,
      content: contentRows.length,
      journeys: journeyCount,
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
