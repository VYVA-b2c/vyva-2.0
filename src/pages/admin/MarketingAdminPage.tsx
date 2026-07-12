import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  UsersRound,
  Waypoints,
  X,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";

const CHANNELS = ["email", "whatsapp", "facebook", "instagram", "linkedin", "tiktok"] as const;
const AUDIENCES = ["b2c", "b2b", "both"] as const;
const TABS = ["dashboard", "journeys", "content", "calendar", "contacts", "settings"] as const;
const CAMPAIGN_STATUSES = ["draft", "scheduled", "published", "paused", "archived"] as const;
const JOURNEY_STATUSES = ["draft", "active", "paused", "archived"] as const;
const CONTENT_STATUSES = ["draft", "review", "approved", "published", "archived"] as const;
const CONSENT_STATUSES = ["unknown", "pending", "opted_in", "opted_out"] as const;

type Channel = typeof CHANNELS[number];
type Audience = typeof AUDIENCES[number];
type Tab = typeof TABS[number];
type ContactView = "contacts" | "lists";
type CampaignStatus = typeof CAMPAIGN_STATUSES[number];
type JourneyStatus = typeof JOURNEY_STATUSES[number];
type ContentStatus = typeof CONTENT_STATUSES[number];
type ConsentStatus = typeof CONSENT_STATUSES[number];
type CountOption = { value: string; label: string; count: number };

type MarketingSummary = {
  totals: {
    campaigns: number;
    journeys: number;
    content: number;
    mediaAssets?: number;
    contacts: number;
    audiences: number;
    journeyEnrollments?: number;
    thisWeek: number;
    scheduled: number;
    published: number;
  };
  analyticsTotals?: MarketingAnalyticsTotals;
  byChannel: Array<{ channel: Channel; campaigns: number; content: number }>;
  byAudience: Array<{ audienceType: Audience; campaigns: number; contacts: number }>;
  lockedSendCapabilities: SendCapability[];
  emailScheduler?: EmailSchedulerStatus;
  latestSyncRun: SyncRun | null;
};

type MarketingAnalyticsTotals = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  replied: number;
  socialEngagement: number;
};

type SendCapability = {
  channel: Channel;
  sendCapability: string;
  locked: boolean;
  note: string;
};

type EmailSchedulerStatus = {
  enabled: boolean;
  intervalMinutes: number;
  initialDelaySeconds: number;
  actor: string;
};

type CampaignChannel = {
  id: string;
  channel: Channel;
  contentAssetId: string | null;
  scheduledAt: string | null;
  status: string;
  sendCapability: string;
};

type CampaignRecipient = {
  id: string;
  campaignId: string;
  contactId: string | null;
  profileId: string | null;
  channel: Channel;
  recipient: string;
  status: string;
  scheduledAt: string | null;
  snapshot: unknown;
  communicationLogId: string | null;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  audienceType: Audience;
  objective: string;
  scheduleStartsAt: string | null;
  scheduleEndsAt: string | null;
  timezone: string;
  source: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
  channels: CampaignChannel[];
  recipientCount: number;
  recipients?: CampaignRecipient[];
};

type Journey = {
  id: string;
  name: string;
  status: string;
  audienceType: Audience;
  objective: string;
  triggerType: string | null;
  triggerConfig: Record<string, unknown>;
  goalType: string | null;
  goalConfig: Record<string, unknown>;
  exitOnGoal: boolean;
  source: string;
  lovableExternalId?: string | null;
  metadata?: Record<string, unknown>;
  steps: JourneyStep[];
};

type JourneyStep = {
  id: string;
  stepOrder: number;
  channel: Channel;
  contentAssetId: string | null;
  delayHours: number;
  kind: string;
  dayOffset: number;
  templateKind: string | null;
  templateRef: string | null;
  config?: Record<string, unknown>;
  status: string;
  metadata?: Record<string, unknown>;
};

type ContentAsset = {
  id: string;
  title: string;
  channel: Channel;
  language: string;
  status: string;
  subject: string | null;
  body: string;
  htmlBody?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  designJson?: Record<string, unknown>;
  mediaAssets?: unknown[];
  hasHtml?: boolean;
  hasDesign?: boolean;
  mediaAssetCount?: number;
  source: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
};

type MarketingMediaAsset = {
  id: string;
  contentAssetId: string | null;
  contentTitle?: string | null;
  source: string;
  assetType: string;
  originalUrl: string;
  localUrl: string | null;
  status: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
};

type MarketingCampaignMetric = MarketingAnalyticsTotals & {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  channel: string;
  metricDate: string | null;
  source: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
};

type JourneyEnrollment = {
  id: string;
  journeyId: string;
  journeyName: string | null;
  contactId: string | null;
  contactExternalId: string | null;
  status: string;
  currentStepOrder: number;
  enteredAt: string | null;
  exitedAt: string | null;
  lastActivityAt: string | null;
  source: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
  events: Array<{
    id: string;
    eventType: string;
    stepOrder: number;
    eventAt: string | null;
    channel: string | null;
    metadata?: Record<string, unknown>;
  }>;
};

type TestEmailResponse = {
  ok?: boolean;
  communication?: {
    id: string;
    recipient: string;
    status: string;
  };
  delivery?: {
    id: string;
    status: string;
    recipient: string;
    error?: string;
  } | null;
};

type CampaignEmailSendResponse = {
  ok?: boolean;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  campaign?: Campaign;
  delivery?: Array<{
    id: string;
    status: string;
    recipient: string;
    error?: string;
  }>;
};

type DueCampaignEmailSendResponse = {
  ok?: boolean;
  dueCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  results?: Array<{
    campaignId: string;
    campaignName: string;
    ok: boolean;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    error?: string | null;
  }>;
};

type MarketingContact = {
  id: string;
  audienceType: Audience;
  profileId?: string | null;
  organizationId?: string | null;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  roleLabel: string | null;
  companyName: string | null;
  consentStatus: ConsentStatus;
  source: string;
  channelAvailability?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags: string[];
  language: string | null;
  category: string | null;
  vertical: string | null;
  market: string | null;
  lists: string[];
  lovableExternalId: string | null;
};

type MarketingAudience = {
  id: string;
  name: string;
  description: string | null;
  listType: string;
  rules: Record<string, unknown>;
  source: string;
  lovableExternalId: string | null;
  memberCount: number;
  mappedMemberCount: number;
  contactExternalIds: string[];
  memberPreview: Array<{
    id: string;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
    whatsappNumber: string | null;
    companyName: string | null;
    roleLabel: string | null;
    lovableExternalId: string | null;
    contactExternalId: string | null;
  }>;
  unmappedContactExternalIds: string[];
  lastSyncedAt: string | null;
  metadata?: Record<string, unknown>;
};

type SyncRun = {
  id: string;
  provider: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  summary: Record<string, unknown>;
  error: string | null;
  createdBy: string | null;
  createdAt: string | null;
};

type LovableExportPreview = {
  ok: boolean;
  checkedAt: string;
  apiUrl: string | null;
  dataset: string;
  exportedAt: string | null;
  topLevelKeys: string[];
  summary: Record<string, unknown>;
  samples?: Record<string, unknown[]>;
  rawArraySamples?: Record<string, unknown[]>;
};

type SyncState = {
  provider: string;
  backendBuild?: string;
  configured: boolean;
  canRunSync: boolean;
  requiredRunnerEmail: string | null;
  apiUrl: string | null;
  mode: string;
  realSendingLocked: boolean;
  lockedSendCapabilities: SendCapability[];
  emailScheduler?: EmailSchedulerStatus;
  diagnostics?: {
    apiUrlSource?: string;
    tokenSource?: string | null;
    urlAliasPresent?: Record<string, boolean>;
    tokenAliasPresent?: Record<string, boolean>;
    hasDefaultEndpoint?: boolean;
    hasBearerToken?: boolean;
  };
  runs: SyncRun[];
};

type CampaignDraft = {
  name: string;
  audienceType: Audience;
  channel: Channel;
  contentAssetId: string;
  status: "draft" | "scheduled";
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  objective: string;
  targetAudienceId: string;
  recipientFilter: string;
  snapshotRecipients: boolean;
};

type CampaignEditDraft = {
  name: string;
  audienceType: Audience;
  channel: Channel;
  contentAssetId: string;
  status: CampaignStatus;
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  timezone: string;
  objective: string;
  targetAudienceId: string;
  source: string;
  lovableExternalId: string;
  metadataText: string;
  recipientFilter: string;
  snapshotRecipients: boolean;
  channels: CampaignChannelDraft[];
};

type CampaignChannelDraft = {
  id: string;
  channel: Channel;
  contentAssetId: string;
  status: CampaignStatus;
  scheduledAt: string;
};

type JourneyEditDraft = {
  name: string;
  audienceType: Audience;
  status: JourneyStatus;
  objective: string;
  targetAudienceId: string;
  source: string;
  lovableExternalId: string;
  metadataText: string;
  triggerType: string;
  triggerConfigText: string;
  goalType: string;
  goalConfigText: string;
  exitOnGoal: boolean;
  steps: JourneyStepDraft[];
};

type JourneyStepDraft = {
  id: string;
  channel: Channel;
  contentAssetId: string;
  delayHours: string;
  kind: string;
  templateKind: string;
  templateRef: string;
  status: JourneyStatus;
  configText: string;
  notes: string;
};

type ContentDraft = {
  title: string;
  channel: Channel;
  language: string;
  status: ContentStatus;
  subject: string;
  body: string;
  htmlBody: string;
  ctaLabel: string;
  ctaUrl: string;
  designJsonText: string;
  mediaAssetsText: string;
};

type ContentEditDraft = {
  title: string;
  channel: Channel;
  language: string;
  status: ContentStatus;
  subject: string;
  body: string;
  htmlBody: string;
  ctaLabel: string;
  ctaUrl: string;
  source: string;
  lovableExternalId: string;
  designJsonText: string;
  mediaAssetsText: string;
  metadataText: string;
};

type MediaEditDraft = {
  contentAssetId: string;
  assetType: string;
  originalUrl: string;
  localUrl: string;
  status: string;
  source: string;
  lovableExternalId: string;
  metadataText: string;
};

type ContactDraft = {
  fullName: string;
  audienceType: Audience;
  email: string;
  phoneNumber: string;
  whatsappNumber: string;
  roleLabel: string;
  companyName: string;
  language: string;
  category: string;
  vertical: string;
  market: string;
  tags: string;
};

type ContactEditDraft = ContactDraft & {
  consentStatus: ConsentStatus;
  profileId: string;
  organizationId: string;
  source: string;
  lovableExternalId: string;
  channelAvailabilityText: string;
  metadataText: string;
};

type AudienceDraft = {
  name: string;
  listType: string;
  description: string;
  rulesText: string;
  contactExternalIds: string;
};

type AudienceEditDraft = AudienceDraft & {
  source: string;
  lovableExternalId: string;
  metadataText: string;
};

const emptySummary: MarketingSummary = {
  totals: {
    campaigns: 0,
    journeys: 0,
    content: 0,
    mediaAssets: 0,
    contacts: 0,
    audiences: 0,
    journeyEnrollments: 0,
    thisWeek: 0,
    scheduled: 0,
    published: 0,
  },
  analyticsTotals: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, replied: 0, socialEngagement: 0 },
  byChannel: CHANNELS.map((channel) => ({ channel, campaigns: 0, content: 0 })),
  byAudience: AUDIENCES.map((audienceType) => ({ audienceType, campaigns: 0, contacts: 0 })),
  lockedSendCapabilities: CHANNELS.map((channel) => ({
    channel,
    sendCapability: channel === "email" ? "enabled" : channel === "whatsapp" ? "future_send_capable" : "planning_only",
    locked: channel !== "email",
    note: channel === "email" ? "Email sends use VYVA communications." : "Marketing sends are locked in this foundation.",
  })),
  emailScheduler: {
    enabled: false,
    intervalMinutes: 5,
    initialDelaySeconds: 30,
    actor: "marketing-email-scheduler",
  },
  latestSyncRun: null,
};

const emptySync: SyncState = {
  provider: "lovable",
  configured: false,
  canRunSync: false,
  requiredRunnerEmail: null,
  apiUrl: null,
  mode: "one_way_into_vyva",
  realSendingLocked: false,
  lockedSendCapabilities: emptySummary.lockedSendCapabilities,
  emailScheduler: emptySummary.emailScheduler,
  runs: [],
};

const channelLabel: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

const tabLabel: Record<Tab, string> = {
  dashboard: "Dashboard",
  journeys: "Journeys",
  content: "Content",
  calendar: "Calendar",
  contacts: "Contacts",
  settings: "Settings",
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatCalendarDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function formatCalendarTime(value: string | null) {
  if (!value) return "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function calendarDayKey(value: string | null) {
  if (!value) return "unscheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unscheduled";
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function statusClass(status: string) {
  if (["published", "active", "succeeded", "opted_in"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["scheduled", "running", "pending", "review"].includes(status)) return "bg-sky-50 text-sky-700";
  if (["failed", "opted_out"].includes(status)) return "bg-red-50 text-red-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-800";
}

function channelClass(channel: Channel) {
  if (channel === "whatsapp") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (channel === "email") return "bg-blue-50 text-blue-700 border-blue-100";
  if (channel === "instagram" || channel === "tiktok") return "bg-pink-50 text-pink-700 border-pink-100";
  if (channel === "linkedin" || channel === "facebook") return "bg-sky-50 text-sky-700 border-sky-100";
  return "bg-purple-50 text-purple-700 border-purple-100";
}

function lower(value: string | null | undefined) {
  return value?.toLowerCase() ?? "";
}

function splitTags(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function splitLines(value: string) {
  return Array.from(new Set(value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)));
}

function contactAudienceMemberId(contact: MarketingContact) {
  return contact.lovableExternalId || contact.id;
}

function parseAudienceMemberIds(draft: Pick<AudienceDraft, "contactExternalIds"> | null | undefined) {
  return splitLines(draft?.contactExternalIds ?? "");
}

function updateAudienceDraftMemberIds<T extends AudienceDraft>(draft: T, ids: string[]): T {
  return { ...draft, contactExternalIds: Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).join("\n") };
}

function audienceContactLabel(contact: MarketingContact) {
  const name = contact.fullName || contact.email || contact.phoneNumber || contact.whatsappNumber || "Unnamed contact";
  const details = [contact.email, contact.companyName, contact.roleLabel].filter(Boolean).join(" - ");
  return details ? `${name} (${details})` : name;
}

function contactMatchesMemberIds(contact: MarketingContact, memberIds: string[]) {
  const contactIds = [contact.id, contact.lovableExternalId].map((id) => lower(id)).filter(Boolean);
  return memberIds.some((id) => contactIds.includes(lower(id)));
}

function groupCount<T>(items: T[], keyForItem: (item: T) => string | null | undefined) {
  const result = new Map<string, number>();
  for (const item of items) {
    const key = keyForItem(item);
    if (!key) continue;
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function parseRulesText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function normalizeCampaignStatus(value: string): CampaignStatus {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus) ? value as CampaignStatus : "draft";
}

function normalizeJourneyStatus(value: string): JourneyStatus {
  return JOURNEY_STATUSES.includes(value as JourneyStatus) ? value as JourneyStatus : "draft";
}

function normalizeContentStatus(value: string): ContentStatus {
  return CONTENT_STATUSES.includes(value as ContentStatus) ? value as ContentStatus : "draft";
}

function jsonText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

function jsonArrayText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "";
  return JSON.stringify(value, null, 2);
}

function designShapeSummary(value: unknown) {
  const record = recordValue(value);
  const topLevelKeys = Object.keys(record);
  const arrayKeys = ["blocks", "sections", "elements", "nodes", "components", "rows"]
    .map((key) => ({ key, count: Array.isArray(record[key]) ? (record[key] as unknown[]).length : 0 }))
    .filter((item) => item.count > 0);
  return { topLevelKeys, arrayKeys };
}

function mediaUrlFrom(value: unknown) {
  if (typeof value === "string") return value;
  const record = recordValue(value);
  for (const key of ["url", "originalUrl", "original_url", "src", "href", "assetUrl", "asset_url", "imageUrl", "image_url"]) {
    const url = record[key];
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return "";
}

function contentMediaPreviewUrls(content: ContentAsset, linkedAssets: MarketingMediaAsset[]) {
  const embedded = Array.isArray(content.mediaAssets) ? content.mediaAssets.map(mediaUrlFrom) : [];
  const linked = linkedAssets.flatMap((asset) => [asset.originalUrl, asset.localUrl ?? ""]);
  return Array.from(new Set([...embedded, ...linked].map((url) => url.trim()).filter(Boolean))).slice(0, 6);
}

function isPreviewableImageUrl(url: string) {
  return /^data:image\//i.test(url) || /\.(png|jpe?g|gif|webp|avif|svg)(?:[?#].*)?$/i.test(url);
}

function isPreviewableVideoUrl(url: string) {
  return /^data:video\//i.test(url) || /\.(mp4|webm|ogg|mov|m4v)(?:[?#].*)?$/i.test(url);
}

function mediaPreviewLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname;
  } catch {
    return url;
  }
}

const designPreviewArrayKeys = ["blocks", "sections", "elements", "nodes", "components", "rows", "children", "items"] as const;
const designPreviewObjectKeys = ["content", "props", "settings", "data", "attributes", "style", "styles"] as const;
const designPreviewTitleKeys = ["headline", "heading", "title", "subject", "name", "label"] as const;
const designPreviewBodyKeys = ["body", "copy", "text", "description", "caption", "message", "content", "plainText", "plain_text", "subtitle"] as const;
const designPreviewCtaLabelKeys = ["ctaLabel", "cta_label", "buttonText", "button_text", "buttonLabel", "button_label", "linkText", "link_text"] as const;
const designPreviewCtaUrlKeys = ["ctaUrl", "cta_url", "buttonUrl", "button_url", "linkUrl", "link_url", "href", "url"] as const;
const designPreviewMediaKeys = ["imageUrl", "image_url", "src", "assetUrl", "asset_url", "mediaUrl", "media_url", "videoUrl", "video_url", "thumbnailUrl", "thumbnail_url", "coverImageUrl", "cover_image_url"] as const;

type DesignPreviewBlock = {
  key: string;
  type: string;
  title: string;
  body: string;
  mediaUrl: string;
  ctaLabel: string;
  ctaUrl: string;
};

function parsedDesignValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function designRecordText(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = parsedDesignValue(record[key]);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}

function designRecordMediaUrl(record: Record<string, unknown>) {
  for (const key of designPreviewMediaKeys) {
    const value = parsedDesignValue(record[key]);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = mediaUrlFrom(value);
      if (nested) return nested;
    }
  }
  return "";
}

function collectDesignPreviewBlocks(value: unknown, path = "design", seen = new Set<unknown>()): DesignPreviewBlock[] {
  const parsed = parsedDesignValue(value);
  if (!parsed || typeof parsed !== "object") return [];
  if (seen.has(parsed)) return [];
  seen.add(parsed);

  if (Array.isArray(parsed)) {
    return parsed.flatMap((item, index) => collectDesignPreviewBlocks(item, `${path}.${index}`, seen));
  }

  const record = parsed as Record<string, unknown>;
  const title = designRecordText(record, designPreviewTitleKeys);
  const body = designRecordText(record, designPreviewBodyKeys);
  const mediaUrl = designRecordMediaUrl(record);
  const ctaLabel = designRecordText(record, designPreviewCtaLabelKeys);
  const ctaUrl = designRecordText(record, designPreviewCtaUrlKeys);
  const type = designRecordText(record, ["type", "kind", "component", "blockType", "block_type"]) || "Block";
  const current = title || body || mediaUrl || ctaLabel || ctaUrl
    ? [{ key: path, type, title, body, mediaUrl, ctaLabel, ctaUrl }]
    : [];
  const children = [
    ...designPreviewArrayKeys.flatMap((key) => collectDesignPreviewBlocks(record[key], `${path}.${key}`, seen)),
    ...designPreviewObjectKeys.flatMap((key) => collectDesignPreviewBlocks(record[key], `${path}.${key}`, seen)),
  ];
  return [...current, ...children].slice(0, 8);
}

const lovableContentSourceLabels: Record<string, string> = {
  content: "Content",
  content_asset: "Content asset",
  saved_email_template: "Saved email template",
  template: "Template",
  content_brief: "Content brief",
  journey_step_preset: "Journey step preset",
  social_post: "Social post",
  missing_lovable_reference: "Missing Lovable reference",
};

function metadataString(value: unknown, key: string) {
  const item = recordValue(value)[key];
  return typeof item === "string" && item.trim() ? item.trim() : "";
}

function contentOriginKey(item: ContentAsset) {
  const sourceType = metadataString(item.metadata, "lovable_source_type");
  if (sourceType) return sourceType;
  return item.source || "vyva";
}

function contentSourceLabel(key: string) {
  if (key === "vyva") return "VYVA";
  if (key === "lovable") return "Lovable content";
  return lovableContentSourceLabels[key] ?? key.replace(/_/g, " ");
}

function contentOriginLabel(item: ContentAsset) {
  const sourceType = contentOriginKey(item);
  if (sourceType) return contentSourceLabel(sourceType);
  if (item.source === "lovable") return "Lovable content";
  return item.source;
}

const lovableContentSourceDetailKeys = [
  "id",
  "title",
  "name",
  "templateName",
  "template_name",
  "subject",
  "subjectLine",
  "subject_line",
  "channel",
  "platform",
  "network",
  "language",
  "locale",
  "status",
  "audienceType",
  "audience_type",
  "campaignId",
  "campaign_id",
  "journeyId",
  "journey_id",
  "templateKind",
  "template_kind",
  "tags",
  "hashtags",
  "category",
  "updatedAt",
  "updated_at",
  "createdAt",
  "created_at",
] as const;

function humanizeMetadataKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (match) => match.toUpperCase());
}

function sourceDetailParsedValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function sourceDetailText(value: unknown) {
  const parsed = sourceDetailParsedValue(value);
  if (parsed === null || parsed === undefined) return "";
  if (typeof parsed === "string") return parsed.trim();
  if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed);
  if (Array.isArray(parsed)) {
    const values = parsed
      .map((item) => sourceDetailText(item))
      .filter(Boolean);
    return values.length ? values.slice(0, 8).join(", ") : "";
  }
  return "";
}

function sourceDetailDisplayValue(key: string, value: unknown) {
  const text = sourceDetailText(value);
  if (!text) return "";
  if (/(^|_|\b)(created|updated|scheduled|published|sent|date|at)(_|$|\b)/i.test(key)) {
    const formatted = formatDate(text);
    if (formatted !== "Unknown" && formatted !== "Not scheduled") return formatted;
  }
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function lovableContentSourceDetails(content: ContentAsset) {
  const metadata = recordValue(content.metadata);
  const lovable = recordValue(metadata.lovable);
  if (content.source !== "lovable" && Object.keys(lovable).length === 0) return [];
  const rows = new Map<string, string>();
  if (content.lovableExternalId) rows.set("Lovable ID", content.lovableExternalId);
  rows.set("Source type", contentOriginLabel(content));
  for (const key of lovableContentSourceDetailKeys) {
    const value = sourceDetailDisplayValue(key, lovable[key]);
    if (value) rows.set(humanizeMetadataKey(key), value);
  }
  return Array.from(rows, ([label, value]) => ({ label, value }));
}

function contentAssetByReference(content: ContentAsset[], reference?: string | null) {
  const normalized = lower(reference);
  if (!normalized) return null;
  return content.find((item) => [
    item.id,
    item.lovableExternalId ?? "",
    `content:${item.lovableExternalId ?? ""}`,
    `content_asset:${item.lovableExternalId ?? ""}`,
    `saved_email_template:${item.lovableExternalId ?? ""}`,
    `social_post:${item.lovableExternalId ?? ""}`,
    `template:${item.lovableExternalId ?? ""}`,
    `content_brief:${item.lovableExternalId ?? ""}`,
  ].some((candidate) => lower(candidate) === normalized)) ?? null;
}

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newCampaignChannelDraft(channel: Channel = "email", status: CampaignStatus = "draft", scheduledAt = ""): CampaignChannelDraft {
  return {
    id: newDraftId(),
    channel,
    contentAssetId: "",
    status,
    scheduledAt,
  };
}

function emptyCampaignDraft(): CampaignDraft {
  return {
    name: "",
    audienceType: "b2c",
    channel: "email",
    contentAssetId: "",
    status: "draft",
    scheduleStartsAt: "",
    scheduleEndsAt: "",
    objective: "",
    targetAudienceId: "",
    recipientFilter: "",
    snapshotRecipients: false,
  };
}

function emptyContentDraft(): ContentDraft {
  return {
    title: "",
    channel: "email",
    language: "en",
    status: "draft",
    subject: "",
    body: "",
    htmlBody: "",
    ctaLabel: "",
    ctaUrl: "",
    designJsonText: "{}",
    mediaAssetsText: "[]",
  };
}

function campaignChannelDraftFromChannel(channel: CampaignChannel, fallbackStatus: CampaignStatus, fallbackSchedule: string): CampaignChannelDraft {
  return {
    id: channel.id || newDraftId(),
    channel: channel.channel,
    contentAssetId: channel.contentAssetId ?? "",
    status: normalizeCampaignStatus(channel.status || fallbackStatus),
    scheduledAt: toDateTimeLocal(channel.scheduledAt) || fallbackSchedule,
  };
}

function audienceReferencesFromRecord(value: unknown) {
  const record = recordValue(value);
  const refs: string[] = [];
  for (const key of ["targetAudienceId", "audienceId", "audienceListId", "listId", "lovableAudienceId", "audienceExternalId", "audience_external_id"]) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) refs.push(item.trim());
  }
  for (const key of ["audienceExternalIds", "audience_external_ids", "audienceIds", "audience_ids", "audiences", "lists", "contactLists", "contact_lists"]) {
    const item = record[key];
    if (Array.isArray(item)) {
      refs.push(...item.map((entry) => typeof entry === "string" ? entry.trim() : "").filter(Boolean));
    }
  }
  for (const key of ["targetAudience", "audienceList", "audience", "list"]) {
    const nested = recordValue(record[key]);
    for (const nestedKey of ["id", "lovableExternalId", "lovable_external_id", "externalId", "external_id", "name"]) {
      const item = nested[nestedKey];
      if (typeof item === "string" && item.trim()) refs.push(item.trim());
    }
  }
  const list = record.list;
  if (typeof list === "string" && list.trim()) refs.push(list.trim());
  return Array.from(new Set(refs));
}

function campaignTargetAudience(campaign: Campaign, audiences: MarketingAudience[]) {
  const metadata = recordValue(campaign.metadata);
  const refs = [
    ...audienceReferencesFromRecord(metadata),
    ...audienceReferencesFromRecord(metadata.lovable),
    ...(campaign.recipients ?? []).flatMap((recipient) => audienceReferencesFromRecord(recipient.snapshot)),
  ];
  return audiences.find((audience) => refs.some((reference) => audienceMatchesReference(audience, reference))) ?? null;
}

function campaignMetadataWithTarget(existingMetadata: unknown, targetAudience: MarketingAudience | null) {
  const metadata = { ...recordValue(existingMetadata) };
  for (const key of ["targetAudience", "targetAudienceId", "audienceId", "audienceListId", "listId", "lovableAudienceId", "audienceExternalId", "audience_external_id", "audienceList"]) {
    delete metadata[key];
  }
  const targetAudienceSnapshot = audienceSnapshot(targetAudience);
  return targetAudienceSnapshot
    ? {
        ...metadata,
        targetAudienceId: targetAudience.id,
        audienceExternalId: targetAudience.lovableExternalId ?? targetAudience.id,
        targetAudience: targetAudienceSnapshot,
      }
    : metadata;
}

function emptyCampaignEditDraft(): CampaignEditDraft {
  return {
    name: "",
    audienceType: "b2c",
    channel: "email",
    contentAssetId: "",
    status: "draft",
    scheduleStartsAt: "",
    scheduleEndsAt: "",
    timezone: "Europe/Madrid",
    objective: "",
    targetAudienceId: "",
    source: "vyva",
    lovableExternalId: "",
    metadataText: "",
    recipientFilter: "",
    snapshotRecipients: false,
    channels: [newCampaignChannelDraft()],
  };
}

function campaignEditDraftFromCampaign(campaign: Campaign, audiences: MarketingAudience[] = []): CampaignEditDraft {
  const status = normalizeCampaignStatus(campaign.status);
  const scheduleStartsAt = toDateTimeLocal(campaign.scheduleStartsAt);
  const scheduleEndsAt = toDateTimeLocal(campaign.scheduleEndsAt);
  const channels = campaign.channels.length
    ? campaign.channels.map((channel) => campaignChannelDraftFromChannel(channel, status, scheduleStartsAt))
    : [newCampaignChannelDraft("email", status, scheduleStartsAt)];
  const primaryChannel = channels[0];
  const targetAudience = campaignTargetAudience(campaign, audiences);
  return {
    name: campaign.name,
    audienceType: campaign.audienceType,
    channel: primaryChannel.channel,
    contentAssetId: primaryChannel.contentAssetId,
    status,
    scheduleStartsAt,
    scheduleEndsAt,
    timezone: campaign.timezone || "Europe/Madrid",
    objective: campaign.objective,
    targetAudienceId: targetAudience?.id ?? "",
    source: campaign.source ?? "vyva",
    lovableExternalId: campaign.lovableExternalId ?? "",
    metadataText: jsonText(campaign.metadata),
    recipientFilter: "",
    snapshotRecipients: false,
    channels,
  };
}

function campaignChannelsWithPrimary(draft: CampaignEditDraft) {
  const first = draft.channels[0] ?? newCampaignChannelDraft(draft.channel, draft.status, draft.scheduleStartsAt);
  return [
    {
      ...first,
      channel: draft.channel,
      contentAssetId: first.contentAssetId || draft.contentAssetId,
      status: draft.status,
      scheduledAt: draft.scheduleStartsAt,
    },
    ...draft.channels.slice(1),
  ];
}

function campaignChannelsPayload(draft: CampaignEditDraft) {
  return campaignChannelsWithPrimary(draft).map((channel) => ({
    channel: channel.channel,
    contentAssetId: channel.channel === "email" ? channel.contentAssetId || null : channel.contentAssetId || null,
    status: channel.status,
    scheduledAt: fromDateTimeLocal(channel.scheduledAt || draft.scheduleStartsAt),
  }));
}

function campaignChannelsMatch(draft: CampaignEditDraft, campaign: Campaign) {
  const drafted = campaignChannelsPayload(draft);
  if (drafted.length !== campaign.channels.length) return false;
  return drafted.every((channel, index) => {
    const saved = campaign.channels[index];
    if (!saved) return false;
    return channel.channel === saved.channel
      && (channel.contentAssetId ?? "") === (saved.contentAssetId ?? "")
      && channel.status === normalizeCampaignStatus(saved.status)
      && toDateTimeLocal(channel.scheduledAt) === toDateTimeLocal(saved.scheduledAt);
  });
}

function notesFromMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const notes = (value as Record<string, unknown>).notes;
  return typeof notes === "string" ? notes : "";
}

function emptyJourneyEditDraft(): JourneyEditDraft {
  return {
    name: "",
    audienceType: "b2c",
    status: "draft",
    objective: "",
    targetAudienceId: "",
    source: "vyva",
    lovableExternalId: "",
    metadataText: "",
    triggerType: "",
    triggerConfigText: "",
    goalType: "",
    goalConfigText: "",
    exitOnGoal: true,
    steps: [],
  };
}

function journeyStepDraftFromStep(step: JourneyStep): JourneyStepDraft {
  return {
    id: step.id || newDraftId(),
    channel: step.channel,
    contentAssetId: step.contentAssetId ?? "",
    delayHours: String(Math.max(0, step.delayHours ?? 0)),
    kind: step.kind || "message",
    templateKind: step.templateKind ?? "",
    templateRef: step.templateRef ?? "",
    status: normalizeJourneyStatus(step.status),
    configText: jsonText(step.config),
    notes: notesFromMetadata(step.metadata),
  };
}

function journeyAudienceReferenceFromConfig(value: unknown) {
  const config = recordValue(value);
  for (const key of ["targetAudienceId", "audienceId", "audienceListId", "listId", "lovableAudienceId", "audienceExternalId", "audience_external_id"]) {
    const item = config[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  const audienceList = recordValue(config.audienceList ?? config.audience ?? config.list);
  for (const key of ["id", "lovableExternalId", "lovable_external_id", "externalId", "external_id", "name"]) {
    const item = audienceList[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  const list = config.list;
  return typeof list === "string" && list.trim() ? list.trim() : "";
}

function audienceMatchesReference(audience: MarketingAudience, reference: string) {
  const normalized = lower(reference);
  return Boolean(normalized) && [audience.id, audience.name, audience.lovableExternalId ?? ""].some((item) => lower(item) === normalized);
}

function journeyTargetAudience(journey: Pick<Journey, "triggerConfig">, audiences: MarketingAudience[]) {
  const reference = journeyAudienceReferenceFromConfig(journey.triggerConfig);
  if (!reference) return null;
  return audiences.find((audience) => audienceMatchesReference(audience, reference)) ?? null;
}

function stripJourneyAudienceSelection(config: Record<string, unknown>) {
  const next = { ...config };
  for (const key of ["targetAudienceId", "audienceId", "audienceListId", "listId", "lovableAudienceId", "audienceExternalId", "audience_external_id", "audienceList"]) {
    delete next[key];
  }
  return next;
}

function journeyEditDraftFromJourney(journey: Journey, audiences: MarketingAudience[] = []): JourneyEditDraft {
  const targetAudience = journeyTargetAudience(journey, audiences);
  return {
    name: journey.name,
    audienceType: journey.audienceType,
    status: normalizeJourneyStatus(journey.status),
    objective: journey.objective,
    targetAudienceId: targetAudience?.id ?? "",
    source: journey.source ?? "vyva",
    lovableExternalId: journey.lovableExternalId ?? "",
    metadataText: jsonText(journey.metadata),
    triggerType: journey.triggerType ?? "",
    triggerConfigText: jsonText(journey.triggerConfig),
    goalType: journey.goalType ?? "",
    goalConfigText: jsonText(journey.goalConfig),
    exitOnGoal: journey.exitOnGoal,
    steps: journey.steps.map(journeyStepDraftFromStep),
  };
}

function newJourneyStepDraft(channel: Channel = "email"): JourneyStepDraft {
  return {
    id: newDraftId(),
    channel,
    contentAssetId: "",
    delayHours: "0",
    kind: "message",
    templateKind: "",
    templateRef: "",
    status: "draft",
    configText: "",
    notes: "",
  };
}

function parseJsonText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function parseJsonArrayText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed as unknown[];
  } catch {
    throw new Error(`${label} must be a valid JSON array.`);
  }
}

function nonNegativeInt(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function contentEditDraftFromContent(content: ContentAsset): ContentEditDraft {
  return {
    title: content.title,
    channel: content.channel,
    language: content.language || "en",
    status: normalizeContentStatus(content.status),
    subject: content.subject ?? "",
    body: content.body,
    htmlBody: content.htmlBody ?? "",
    ctaLabel: content.ctaLabel ?? "",
    ctaUrl: content.ctaUrl ?? "",
    source: content.source ?? "vyva",
    lovableExternalId: content.lovableExternalId ?? "",
    designJsonText: jsonText(content.designJson),
    mediaAssetsText: jsonArrayText(content.mediaAssets),
    metadataText: jsonText(content.metadata),
  };
}

function contentPayloadFromDraft(draft: ContentEditDraft) {
  return {
    title: draft.title.trim(),
    channel: draft.channel,
    language: draft.language.trim() || "en",
    status: draft.status,
    subject: draft.subject.trim() || null,
    body: draft.body,
    htmlBody: draft.htmlBody.trim() || null,
    ctaLabel: draft.ctaLabel.trim() || null,
    ctaUrl: draft.ctaUrl.trim() || null,
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    designJson: parseJsonText(draft.designJsonText, "Design JSON"),
    mediaAssets: parseJsonArrayText(draft.mediaAssetsText, "Media assets"),
    metadata: parseJsonText(draft.metadataText, "Content metadata"),
  };
}

function mediaEditDraftFromAsset(asset: MarketingMediaAsset): MediaEditDraft {
  return {
    contentAssetId: asset.contentAssetId ?? "",
    assetType: asset.assetType,
    originalUrl: asset.originalUrl,
    localUrl: asset.localUrl ?? "",
    status: asset.status,
    source: asset.source,
    lovableExternalId: asset.lovableExternalId ?? "",
    metadataText: jsonText(asset.metadata),
  };
}

function mediaPayloadFromDraft(draft: MediaEditDraft) {
  return {
    contentAssetId: draft.contentAssetId || null,
    assetType: draft.assetType.trim() || "unknown",
    originalUrl: draft.originalUrl.trim(),
    localUrl: draft.localUrl.trim() || null,
    status: draft.status.trim() || "referenced",
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    metadata: parseJsonText(draft.metadataText, "Media metadata"),
  };
}

function contactEditDraftFromContact(contact: MarketingContact): ContactEditDraft {
  return {
    fullName: contact.fullName,
    audienceType: contact.audienceType,
    profileId: contact.profileId ?? "",
    organizationId: contact.organizationId ?? "",
    email: contact.email ?? "",
    phoneNumber: contact.phoneNumber ?? "",
    whatsappNumber: contact.whatsappNumber ?? "",
    roleLabel: contact.roleLabel ?? "",
    companyName: contact.companyName ?? "",
    language: contact.language ?? "",
    category: contact.category ?? "",
    vertical: contact.vertical ?? "",
    market: contact.market ?? "",
    tags: contact.tags.join(", "),
    consentStatus: CONSENT_STATUSES.includes(contact.consentStatus) ? contact.consentStatus : "unknown",
    source: contact.source ?? "vyva",
    lovableExternalId: contact.lovableExternalId ?? "",
    channelAvailabilityText: jsonText(contact.channelAvailability),
    metadataText: jsonText(contact.metadata),
  };
}

function contactPayloadFromDraft(draft: ContactEditDraft) {
  const existingMetadata = parseJsonText(draft.metadataText, "Contact metadata");
  const existingSegmentation = recordValue(existingMetadata.segmentation);
  const channelAvailability = parseJsonText(draft.channelAvailabilityText, "Channel availability");
  return {
    fullName: draft.fullName,
    audienceType: draft.audienceType,
    profileId: draft.profileId.trim() || null,
    organizationId: draft.organizationId.trim() || null,
    email: draft.email || null,
    phoneNumber: draft.phoneNumber || null,
    whatsappNumber: draft.whatsappNumber || null,
    roleLabel: draft.roleLabel || null,
    companyName: draft.companyName || null,
    language: draft.language || null,
    category: draft.category || null,
    vertical: draft.vertical || null,
    market: draft.market || null,
    consentStatus: draft.consentStatus,
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    tags: splitTags(draft.tags),
    channelAvailability: {
      ...channelAvailability,
      email: Boolean(draft.email),
      phone: Boolean(draft.phoneNumber),
      whatsapp: Boolean(draft.whatsappNumber),
    },
    metadata: {
      ...existingMetadata,
      segmentation: {
        ...existingSegmentation,
        language: draft.language || null,
        category: draft.category || null,
        vertical: draft.vertical || null,
        market: draft.market || null,
      },
    },
  };
}

function audienceEditDraftFromAudience(audience: MarketingAudience): AudienceEditDraft {
  return {
    name: audience.name,
    listType: audience.listType || "dynamic",
    description: audience.description ?? "",
    rulesText: jsonText(audience.rules ?? {}),
    contactExternalIds: (audience.contactExternalIds ?? []).join("\n"),
    source: audience.source ?? "vyva",
    lovableExternalId: audience.lovableExternalId ?? "",
    metadataText: jsonText(audience.metadata),
  };
}

function audiencePayloadFromDraft(draft: AudienceEditDraft) {
  return {
    name: draft.name,
    listType: draft.listType || "dynamic",
    description: draft.description || null,
    rules: parseRulesText(draft.rulesText),
    contactExternalIds: splitLines(draft.contactExternalIds),
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    metadata: parseJsonText(draft.metadataText, "Audience metadata"),
  };
}

function journeyPayloadFromDraft(draft: JourneyEditDraft, targetAudience: MarketingAudience | null = null) {
  const triggerConfig = stripJourneyAudienceSelection(parseJsonText(draft.triggerConfigText, "Trigger config"));
  const targetAudienceSnapshot = audienceSnapshot(targetAudience);
  return {
    name: draft.name.trim(),
    audienceType: draft.audienceType,
    status: draft.status,
    objective: draft.objective,
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    metadata: parseJsonText(draft.metadataText, "Journey metadata"),
    triggerType: draft.triggerType.trim() || null,
    triggerConfig: targetAudienceSnapshot
      ? {
          ...triggerConfig,
          targetAudienceId: targetAudience.id,
          audienceExternalId: targetAudience.lovableExternalId ?? targetAudience.id,
          audienceList: targetAudienceSnapshot,
        }
      : triggerConfig,
    goalType: draft.goalType.trim() || null,
    goalConfig: parseJsonText(draft.goalConfigText, "Goal config"),
    exitOnGoal: draft.exitOnGoal,
    steps: draft.steps.map((step, index) => {
      const delayHours = nonNegativeInt(step.delayHours);
      return {
        stepOrder: index,
        channel: step.channel,
        contentAssetId: step.contentAssetId || null,
        delayHours,
        dayOffset: Math.floor(delayHours / 24),
        kind: step.kind.trim() || "message",
        templateKind: step.templateKind.trim() || null,
        templateRef: step.templateRef.trim() || null,
        status: step.status,
        config: parseJsonText(step.configText, `Step ${index + 1} config`),
        metadata: step.notes.trim() ? { notes: step.notes.trim() } : {},
      };
    }),
  };
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function campaignAllowsContact(campaignAudience: Audience, contactAudience: Audience) {
  return campaignAudience === "both" || contactAudience === "both" || contactAudience === campaignAudience;
}

function recipientForChannel(contact: MarketingContact, channel: Channel) {
  if (channel === "email") return contact.email;
  if (channel === "whatsapp") return contact.whatsappNumber || contact.phoneNumber;
  return contact.email || contact.whatsappNumber || contact.phoneNumber || contact.id;
}

function recipientSnapshot(contact: MarketingContact) {
  return {
    fullName: contact.fullName,
    email: contact.email,
    phoneNumber: contact.phoneNumber,
    whatsappNumber: contact.whatsappNumber,
    audienceType: contact.audienceType,
    companyName: contact.companyName,
    roleLabel: contact.roleLabel,
    consentStatus: contact.consentStatus,
    tags: contact.tags,
    lists: contact.lists,
  };
}

function contactMatchesAudienceList(contact: MarketingContact, audience: MarketingAudience | null) {
  if (!audience) return true;
  const contactExternalId = lower(contact.lovableExternalId);
  const externalIds = new Set(audience.contactExternalIds.map((id) => lower(id)));
  return Boolean(contactExternalId && externalIds.has(contactExternalId))
    || contact.lists.some((list) => lower(list) === lower(audience.name));
}

function audienceSnapshot(audience: MarketingAudience | null) {
  if (!audience) return null;
  return {
    id: audience.id,
    name: audience.name,
    listType: audience.listType,
    source: audience.source,
    lovableExternalId: audience.lovableExternalId,
    memberCount: audience.memberCount,
    mappedMemberCount: audience.mappedMemberCount,
  };
}

function objectValue(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
}

function recipientSnapshotLabel(recipient: CampaignRecipient) {
  return objectValue(recipient.snapshot, "fullName") || objectValue(recipient.snapshot, "email") || recipient.recipient;
}

function sumMarketingMetrics(metrics: MarketingCampaignMetric[]): MarketingAnalyticsTotals {
  return metrics.reduce((totals, metric) => ({
    sent: totals.sent + metric.sent,
    delivered: totals.delivered + metric.delivered,
    opened: totals.opened + metric.opened,
    clicked: totals.clicked + metric.clicked,
    bounced: totals.bounced + metric.bounced,
    unsubscribed: totals.unsubscribed + metric.unsubscribed,
    replied: totals.replied + metric.replied,
    socialEngagement: totals.socialEngagement + metric.socialEngagement,
  }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, replied: 0, socialEngagement: 0 });
}

function contactSearchText(contact: MarketingContact) {
  return [
    contact.id,
    contact.fullName,
    contact.email,
    contact.phoneNumber,
    contact.whatsappNumber,
    contact.consentStatus,
    contact.roleLabel,
    contact.companyName,
    contact.language,
    contact.category,
    contact.vertical,
    contact.market,
    contact.source,
    contact.lovableExternalId,
    contact.profileId,
    contact.organizationId,
    contact.channelAvailability,
    contact.metadata,
    ...(contact.tags ?? []),
    ...(contact.lists ?? []),
  ].map(searchableValue).join(" ");
}

function countedOptions(values: Array<string | null | undefined>): CountOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const rawValue of values) {
    const label = String(rawValue ?? "").trim();
    if (!label) continue;
    const value = label.toLowerCase();
    const current = counts.get(value);
    if (current) {
      current.count += 1;
    } else {
      counts.set(value, { label, count: 1 });
    }
  }
  return Array.from(counts.entries())
    .map(([value, item]) => ({ value, label: item.label, count: item.count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function valueMatchesFilter(value: string | null | undefined, filter: string) {
  return filter === "all" || String(value ?? "").trim().toLowerCase() === filter;
}

function searchableValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).toLowerCase();
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return "";
  }
}

function matchesSearch(search: string, values: unknown[]) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return values.map(searchableValue).join(" ").includes(query);
}

const syncCountLabels = {
  campaigns: "Campaigns",
  contacts: "Contacts",
  content: "Content",
  journeyStepPresetContent: "Journey step preset content",
  missingContentReferences: "Missing content references",
  mediaAssets: "Media assets",
  campaignChannels: "Campaign channels",
  campaignMetrics: "Campaign metrics",
  journeys: "Journeys",
  journeyEnrollments: "Journey enrollments",
  journeyStepEvents: "Journey step events",
  audiences: "Audiences",
  audienceMembers: "Audience members",
  mappedAudienceMembers: "Mapped members",
  campaignRecipients: "Campaign recipients",
} as const;

type SyncCountKey = keyof typeof syncCountLabels;

const lovableDestinationRows: Array<{
  key: string;
  label: string;
  sourceHint: string;
  destination: string;
  detail: string;
  countKeys: SyncCountKey[];
  contentSourceKeys?: string[];
}> = [
  {
    key: "email-templates",
    label: "Saved email templates",
    sourceHint: "saved_email_templates, emailTemplates",
    destination: "Content tab",
    detail: "Email subject, HTML, CTA, design data, and media become editable content assets.",
    countKeys: ["content"],
    contentSourceKeys: ["saved_email_template", "email_template", "marketing_email_template"],
  },
  {
    key: "social-posts",
    label: "Social posts",
    sourceHint: "social_posts, posts",
    destination: "Content tab",
    detail: "Platform, caption/body, image, and builder metadata become channel-specific content assets.",
    countKeys: ["content"],
    contentSourceKeys: ["social_post", "post", "marketing_social_post"],
  },
  {
    key: "content-briefs",
    label: "Content briefs",
    sourceHint: "content_briefs, briefs",
    destination: "Content tab",
    detail: "Planning copy and structured brief sections are preserved as content assets and metadata.",
    countKeys: ["content"],
    contentSourceKeys: ["content_brief", "brief", "marketing_content_brief"],
  },
  {
    key: "journey-step-presets",
    label: "Journey step presets",
    sourceHint: "journey steps with config.translations",
    destination: "Content tab and Journeys tab",
    detail: "Translated onboarding step copy hidden inside journey configs becomes editable content and is linked back to the journey step.",
    countKeys: ["journeyStepPresetContent"],
    contentSourceKeys: ["journey_step_preset"],
  },
  {
    key: "media",
    label: "Media assets",
    sourceHint: "media_assets, mediaAssets, images",
    destination: "Content > Media references",
    detail: "Standalone and content-linked image/file URLs are listed and can be linked to content.",
    countKeys: ["mediaAssets"],
  },
  {
    key: "contacts",
    label: "Contacts",
    sourceHint: "contacts, email_unsubscribes",
    destination: "Contacts tab",
    detail: "Names, email, phone, WhatsApp, company, role, consent, tags, and segmentation fields are searchable.",
    countKeys: ["contacts"],
  },
  {
    key: "lists",
    label: "Lists and audiences",
    sourceHint: "audiences, contact_lists, contact_list_members",
    destination: "Contacts tab > Lists",
    detail: "List rules, member IDs, mapped contacts, and unmapped members are shown together.",
    countKeys: ["audiences", "audienceMembers"],
  },
  {
    key: "campaigns",
    label: "Campaigns",
    sourceHint: "campaigns, campaign channels, recipients",
    destination: "Dashboard, Campaigns, Calendar",
    detail: "Schedules, channels, linked content, recipient snapshots, and email send controls live in campaign details.",
    countKeys: ["campaigns", "campaignChannels", "campaignRecipients"],
  },
  {
    key: "analytics",
    label: "Campaign metrics",
    sourceHint: "campaignMetrics, analytics, performance",
    destination: "Dashboard analytics",
    detail: "Sent, delivered, opened, clicked, bounced, unsubscribed, replied, and social engagement metrics are summarized.",
    countKeys: ["campaignMetrics"],
  },
  {
    key: "journeys",
    label: "Journeys",
    sourceHint: "journeys, journey_steps, enrollments, events",
    destination: "Journeys tab",
    detail: "Triggers, goals, steps, enrollment progress, and journey event history are editable or inspectable.",
    countKeys: ["journeys", "journeyEnrollments", "journeyStepEvents"],
  },
];

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function syncCountItems(summary: Record<string, unknown>, group: "exported" | "imported" | "skipped") {
  const source = recordValue(summary[group]);
  return (Object.keys(syncCountLabels) as SyncCountKey[])
    .map((key) => ({ key, label: syncCountLabels[key], value: numberValue(source[key]) }))
    .filter((item) => item.value > 0);
}

function syncCountValue(summary: Record<string, unknown>, group: "exported" | "imported" | "skipped", key: SyncCountKey) {
  return numberValue(recordValue(summary[group])[key]);
}

function syncParityItems(summary: Record<string, unknown>) {
  return (Object.keys(syncCountLabels) as SyncCountKey[])
    .map((key) => {
      const exported = syncCountValue(summary, "exported", key);
      const imported = syncCountValue(summary, "imported", key);
      const skipped = syncCountValue(summary, "skipped", key);
      const missing = Math.max(exported - imported - skipped, 0);
      return {
        key,
        label: syncCountLabels[key],
        exported,
        imported,
        skipped,
        missing,
        status: exported === 0 && imported > 0 ? "derived" : exported === 0 ? "empty" : missing > 0 ? "missing" : skipped > 0 ? "review" : "complete",
      };
    })
    .filter((item) => item.exported > 0 || item.imported > 0 || item.skipped > 0);
}

function syncUnmappedCount(summary: Record<string, unknown>) {
  return numberValue(recordValue(summary.unmapped).audienceContactExternalIdCount);
}

function syncUnmappedCampaignRecipientCount(summary: Record<string, unknown>) {
  return numberValue(recordValue(summary.unmapped).campaignRecipientExternalIdCount);
}

function syncUnmappedSample(summary: Record<string, unknown>) {
  const unmapped = recordValue(summary.unmapped);
  const ids = [
    ...(Array.isArray(unmapped.audienceContactExternalIds) ? unmapped.audienceContactExternalIds : []),
    ...(Array.isArray(unmapped.campaignRecipientExternalIds) ? unmapped.campaignRecipientExternalIds : []),
  ];
  return ids.map((id) => String(id)).filter(Boolean).slice(0, 5);
}

function syncContentSourceItems(summary: Record<string, unknown>) {
  return Object.entries(recordValue(summary.contentSourceCounts))
    .map(([key, value]) => ({ key, label: contentSourceLabel(key), value: numberValue(value) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function syncContentSourceCount(summary: Record<string, unknown>, keys: string[]) {
  const counts = recordValue(summary.contentSourceCounts);
  return keys.reduce((total, key) => total + numberValue(counts[key]), 0);
}

function syncDestinationCount(summary: Record<string, unknown>, row: typeof lovableDestinationRows[number]) {
  const sourceCount = row.contentSourceKeys?.length ? syncContentSourceCount(summary, row.contentSourceKeys) : 0;
  if (sourceCount) return sourceCount;
  const exported = row.countKeys.reduce((total, key) => total + syncCountValue(summary, "exported", key), 0);
  if (exported) return exported;
  return row.countKeys.reduce((total, key) => total + syncCountValue(summary, "imported", key), 0);
}

function syncFieldCoverageItems(summary: Record<string, unknown>) {
  const coverage = recordValue(summary.fieldCoverage);
  return Object.entries(coverage).map(([entity, value]) => {
    const item = recordValue(value);
    const exportedFields = Array.isArray(item.exportedFields) ? item.exportedFields.map(String).filter(Boolean) : [];
    const firstClassFields = Array.isArray(item.firstClassFields) ? item.firstClassFields.map(String).filter(Boolean) : [];
    const metadataOnlyFields = Array.isArray(item.metadataOnlyFields) ? item.metadataOnlyFields.map(String).filter(Boolean) : [];
    return {
      entity,
      exported: numberValue(item.exportedFieldCount),
      firstClass: numberValue(item.firstClassFieldCount),
      metadataOnly: numberValue(item.metadataOnlyFieldCount),
      exportedFields,
      firstClassFields,
      metadataOnlyFields,
    };
  }).filter((item) => item.exported > 0);
}

function syncCompletionMessage(summary?: Record<string, unknown>) {
  if (!summary) return "Lovable sync completed.";
  const nestedImported = syncCountItems(summary, "imported");
  const flatImported = (Object.keys(syncCountLabels) as SyncCountKey[])
    .map((key) => ({ key, label: syncCountLabels[key], value: numberValue(summary[key]) }))
    .filter((item) => item.value > 0);
  const imported = nestedImported.length ? nestedImported : flatImported;
  if (!imported.length) return "Lovable sync completed. No import counts were reported.";
  const visible = imported.slice(0, 6).map((item) => `${item.label}: ${item.value}`).join(", ");
  const hiddenCount = imported.length - 6;
  return `Lovable sync completed. Imported ${visible}${hiddenCount > 0 ? `, +${hiddenCount} more` : ""}.`;
}

function exportPreviewMessage(summary?: Record<string, unknown>) {
  if (!summary) return "Lovable export checked.";
  const exported = syncCountItems(summary, "exported");
  if (!exported.length) return "Lovable export checked. No export counts were reported.";
  const visible = exported.slice(0, 6).map((item) => `${item.label}: ${item.value}`).join(", ");
  const hiddenCount = exported.length - 6;
  return `Lovable export contains ${visible}${hiddenCount > 0 ? `, +${hiddenCount} more` : ""}.`;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(url, options);
  const body = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error((body && typeof body === "object" && "error" in body && body.error) || "Request failed");
  }
  return body as T;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-[#4d4351]">{label}</span>
      {children}
    </label>
  );
}

function MetadataPanel({ title, value, testId }: { title: string; value?: Record<string, unknown> | null; testId: string }) {
  if (!value || Array.isArray(value) || Object.keys(value).length === 0) return null;
  return (
    <details className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid={testId}>
      <summary className="cursor-pointer text-sm font-black text-[#241133]">{title}</summary>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs font-bold leading-relaxed text-[#5b4a46]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function LovableContentSourceDetails({ content }: { content: ContentAsset }) {
  const rows = lovableContentSourceDetails(content);
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50 p-3" data-testid="marketing-content-source-details">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-900">Lovable source details</p>
        <Pill className="bg-white text-violet-800">{contentOriginLabel(content)}</Pill>
      </div>
      <dl className="mt-3 grid gap-2 md:grid-cols-2">
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="rounded-lg bg-white px-3 py-2">
            <dt className="text-[11px] font-black uppercase tracking-[0.1em] text-[#8b7a73]">{row.label}</dt>
            <dd className="mt-1 break-words text-xs font-bold text-[#241133]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  return (
    <div className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
        <Icon size={19} aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-black text-[#241133]">{value}</p>
      <p className="mt-1 text-sm font-bold text-[#7d6b65]">{label}</p>
    </div>
  );
}

function MediaPreviewTile({ url, label, testId }: { url: string; label?: string; testId?: string }) {
  const mediaLabel = label || mediaPreviewLabel(url);
  if (isPreviewableImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-[#eadfd5] bg-white" data-testid={testId}>
        <img src={url} alt={mediaLabel} className="h-36 w-full object-cover" loading="lazy" />
        <span className="block truncate px-3 py-2 text-xs font-bold text-purple-700">{mediaLabel}</span>
      </a>
    );
  }
  if (isPreviewableVideoUrl(url)) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#eadfd5] bg-white" data-testid={testId}>
        <video src={url} controls preload="metadata" className="h-36 w-full bg-black object-cover" aria-label={mediaLabel} />
        <a href={url} target="_blank" rel="noreferrer" className="block truncate px-3 py-2 text-xs font-bold text-purple-700">{mediaLabel}</a>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex min-h-24 items-center rounded-xl border border-[#eadfd5] bg-white p-3 text-xs font-bold text-purple-700" data-testid={testId}>
      <span className="break-all">{mediaLabel}</span>
    </a>
  );
}

function LovableDesignPreview({ contentAsset }: { contentAsset: ContentAsset }) {
  const blocks = collectDesignPreviewBlocks(contentAsset.designJson);
  if (!blocks.length) return null;

  return (
    <div className="rounded-xl border border-purple-100 bg-[#fbf7ff] p-3" data-testid="marketing-content-design-preview">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">Lovable design preview</p>
          <p className="mt-1 text-xs font-bold text-[#7d6b65]">{blocks.length} visible design block{blocks.length === 1 ? "" : "s"} parsed from imported builder data.</p>
        </div>
        <Pill className="bg-purple-50 text-purple-800">Design rendered</Pill>
      </div>
      <div className="mt-3 grid gap-3">
        {blocks.map((block, index) => (
          <article key={`${block.key}-${index}`} className="overflow-hidden rounded-xl border border-[#eadfd5] bg-white">
            {block.mediaUrl ? (
              <MediaPreviewTile url={block.mediaUrl} label={block.title || contentAsset.title} testId={`marketing-content-design-media-${index}`} />
            ) : null}
            <div className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill className="bg-purple-50 text-purple-800">{humanizeMetadataKey(block.type)}</Pill>
                <span className="text-xs font-bold text-[#8b7a73]">{block.key}</span>
              </div>
              {block.title ? <h4 className="mt-2 text-base font-black text-[#241133]">{block.title}</h4> : null}
              {block.body && block.body !== block.title ? (
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#5b4a46]">{block.body}</p>
              ) : null}
              {block.ctaLabel || block.ctaUrl ? (
                <p className="mt-3 text-xs font-black text-purple-700">
                  CTA: {[block.ctaLabel, block.ctaUrl].filter(Boolean).join(" -> ")}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function LinkedContentPreview({ contentAsset, linkedMediaAssets, testId }: { contentAsset: ContentAsset | null; linkedMediaAssets: MarketingMediaAsset[]; testId: string }) {
  if (!contentAsset) {
    return (
      <div className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-3 text-sm font-bold text-[#8b7a73]" data-testid={testId}>
        No content selected for this channel.
      </div>
    );
  }

  const previewUrls = contentMediaPreviewUrls(contentAsset, linkedMediaAssets);
  return (
    <div className="rounded-xl border border-purple-100 bg-[#fbf7ff] p-3" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-purple-700">Linked content</p>
          <h4 className="mt-1 font-black text-[#241133]">{contentAsset.title}</h4>
          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{contentAsset.subject || contentAsset.body || "No copy yet."}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill className={channelClass(contentAsset.channel)}>{channelLabel[contentAsset.channel]}</Pill>
          <Pill className={statusClass(contentAsset.status)}>{contentAsset.status}</Pill>
          {contentAsset.source === "lovable" ? <Pill className="bg-violet-50 text-violet-700">{contentOriginLabel(contentAsset)}</Pill> : null}
          {contentAsset.hasHtml ? <Pill className="bg-blue-50 text-blue-800">HTML</Pill> : null}
          {contentAsset.hasDesign ? <Pill className="bg-purple-50 text-purple-800">Design data</Pill> : null}
          {previewUrls.length ? <Pill className="bg-emerald-50 text-emerald-800">{previewUrls.length} media</Pill> : null}
        </div>
      </div>
      {contentAsset.ctaLabel || contentAsset.ctaUrl ? (
        <p className="mt-2 text-xs font-bold text-[#7d6b65]">CTA: {[contentAsset.ctaLabel, contentAsset.ctaUrl].filter(Boolean).join(" -> ")}</p>
      ) : null}
      {contentAsset.body && contentAsset.body !== contentAsset.subject ? (
        <p className="mt-2 rounded-lg bg-white p-3 text-sm font-semibold text-[#5b4a46]">{contentAsset.body}</p>
      ) : null}
      {previewUrls.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {previewUrls.slice(0, 3).map((url) => (
            <MediaPreviewTile key={url} url={url} label={contentAsset.title} />
          ))}
        </div>
      ) : null}
      {contentAsset.lovableExternalId ? (
        <p className="mt-2 break-all text-xs font-bold text-[#8b7a73]">Lovable ID: {contentAsset.lovableExternalId}</p>
      ) : null}
    </div>
  );
}

function LockedSendPanel() {
  return (
    <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" data-testid="marketing-send-readiness-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700">
            <Send size={18} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black">Email campaign sending is enabled.</h3>
            <p className="mt-1 text-sm font-semibold text-emerald-800">Email sends use the existing VYVA communications dispatcher and Resend. WhatsApp and social channels remain planning-only for now.</p>
          </div>
        </div>
        <Pill className="bg-emerald-100 text-emerald-800"><CheckCircle2 size={13} className="mr-1" /> Email enabled</Pill>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#241133]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SyncRunDiagnostics({ run }: { run: SyncRun }) {
  const exported = syncCountItems(run.summary, "exported");
  const imported = syncCountItems(run.summary, "imported");
  const skipped = syncCountItems(run.summary, "skipped");
  const parity = syncParityItems(run.summary);
  const unmappedCount = syncUnmappedCount(run.summary);
  const unmappedCampaignRecipientCount = syncUnmappedCampaignRecipientCount(run.summary);
  const unmappedSample = syncUnmappedSample(run.summary);
  const fieldCoverage = syncFieldCoverageItems(run.summary);
  if (!exported.length && !imported.length && !skipped.length && !parity.length && !unmappedCount && !unmappedCampaignRecipientCount && !fieldCoverage.length) return null;
  return (
    <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 text-xs font-bold text-[#7d6b65]" data-testid={`marketing-sync-diagnostics-${run.id}`}>
      {parity.length ? (
        <div data-testid={`marketing-sync-parity-${run.id}`}>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">Parity checklist</p>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            {parity.map((item) => {
              const className = item.status === "missing"
                ? "border-red-100 bg-red-50 text-red-800"
                : item.status === "review"
                  ? "border-amber-100 bg-amber-50 text-amber-800"
                  : item.status === "derived"
                    ? "border-blue-100 bg-blue-50 text-blue-800"
                    : "border-emerald-100 bg-emerald-50 text-emerald-800";
              const detail = item.status === "missing"
                ? `${item.missing} missing`
                : item.status === "review"
                  ? `${item.skipped} skipped`
                  : item.status === "derived"
                    ? "derived"
                    : "complete";
              return (
                <div key={item.key} className={`rounded-lg border px-3 py-2 ${className}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black">{item.label}</span>
                    <span>{detail}</span>
                  </div>
                  <p className="mt-1 font-semibold">Lovable {item.exported} / VYVA {item.imported}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {exported.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">Exported by Lovable</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {exported.map((item) => <Pill key={`exported-${item.key}`} className="bg-blue-50 text-blue-800">{item.label}: {item.value}</Pill>)}
          </div>
        </div>
      ) : null}
      {imported.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">Imported into VYVA</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {imported.map((item) => <Pill key={`imported-${item.key}`} className="bg-emerald-50 text-emerald-800">{item.label}: {item.value}</Pill>)}
          </div>
        </div>
      ) : null}
      {skipped.length || unmappedCount || unmappedCampaignRecipientCount ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">Needs review</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {skipped.map((item) => <Pill key={`skipped-${item.key}`} className="bg-amber-50 text-amber-800">Skipped {item.label}: {item.value}</Pill>)}
            {unmappedCount ? <Pill className="bg-amber-50 text-amber-800">Unmapped list members: {unmappedCount}</Pill> : null}
            {unmappedCampaignRecipientCount ? <Pill className="bg-amber-50 text-amber-800">Unmapped campaign recipients: {unmappedCampaignRecipientCount}</Pill> : null}
          </div>
          {unmappedSample.length ? <p className="mt-2 font-semibold">Examples: {unmappedSample.join(", ")}</p> : null}
        </div>
      ) : null}
      {fieldCoverage.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">Field coverage</p>
          <div className="mt-1 grid gap-1.5">
            {fieldCoverage.map((item) => (
              <div key={item.entity} className="rounded-lg border border-[#f0e7df] bg-[#fffaf4] px-3 py-2">
                <p className="font-black text-[#241133]">{item.entity}: {item.firstClass} of {item.exported} fields mapped first-class</p>
                {item.metadataOnly ? (
                  <p className="mt-1 font-semibold">Metadata-only: {item.metadataOnlyFields.slice(0, 6).join(", ")}{item.metadataOnlyFields.length > 6 ? ` +${item.metadataOnlyFields.length - 6}` : ""}</p>
                ) : (
                  <p className="mt-1 font-semibold text-emerald-700">No extra metadata-only fields.</p>
                )}
                {(item.exportedFields.length || item.firstClassFields.length || item.metadataOnlyFields.length) ? (
                  <details className="mt-2 rounded-lg border border-[#eadfd5] bg-white p-2" data-testid={`marketing-sync-field-coverage-${run.id}-${item.entity}`}>
                    <summary className="cursor-pointer font-black text-[#241133]">View field map</summary>
                    <div className="mt-2 grid gap-2">
                      {item.metadataOnlyFields.length ? (
                        <p><span className="text-amber-800">Metadata-only:</span> {item.metadataOnlyFields.join(", ")}</p>
                      ) : null}
                      {item.firstClassFields.length ? (
                        <p><span className="text-emerald-800">Mapped first-class:</span> {item.firstClassFields.join(", ")}</p>
                      ) : null}
                      {item.exportedFields.length ? (
                        <p><span className="text-blue-800">All exported:</span> {item.exportedFields.join(", ")}</p>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <LovableDestinationMap summary={run.summary} />
    </div>
  );
}

function LovableImportCoveragePanel({
  run,
  title = "Lovable import coverage",
  subtitle = "Latest sync coverage across Lovable export and VYVA import.",
  focusKeys,
  onOpenSettings,
}: {
  run: SyncRun | null;
  title?: string;
  subtitle?: string;
  focusKeys?: SyncCountKey[];
  onOpenSettings: () => void;
}) {
  const parity = run ? syncParityItems(run.summary) : [];
  const focusedParity = focusKeys?.length
    ? focusKeys.flatMap((key) => parity.find((item) => item.key === key) ?? [])
    : parity;
  const contentSources = run ? syncContentSourceItems(run.summary) : [];
  const unmappedCount = run ? syncUnmappedCount(run.summary) : 0;
  const unmappedCampaignRecipientCount = run ? syncUnmappedCampaignRecipientCount(run.summary) : 0;
  const isFailed = run?.status === "failed";
  const coverageNote = !run
    ? "No Lovable sync has run yet. Run sync from Settings to import campaigns, content, contacts, lists, media, metrics, and journey history."
    : isFailed
      ? (run.error || "The last Lovable sync failed. Open Settings to inspect the error and retry.")
      : focusedParity.length
        ? "Use this as the quick truth table for what Lovable sent versus what VYVA stored."
        : "The last Lovable sync did not report import coverage counts.";

  return (
    <SectionCard
      title={title}
      subtitle={run ? `${subtitle} Last run: ${run.status} / ${formatDate(run.createdAt)}.` : subtitle}
      action={(
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-700"
          data-testid="button-marketing-open-sync-coverage-settings"
        >
          <Settings size={14} /> Sync settings
        </button>
      )}
    >
      <div className={`rounded-xl border p-3 text-sm font-bold ${isFailed ? "border-red-100 bg-red-50 text-red-800" : "border-blue-100 bg-blue-50 text-blue-900"}`} data-testid="marketing-lovable-import-coverage">
        <p>{coverageNote}</p>
        {focusedParity.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {focusedParity.map((item) => {
              const badgeClass = item.status === "missing"
                ? "bg-red-50 text-red-800"
                : item.status === "review"
                  ? "bg-amber-50 text-amber-800"
                  : item.status === "derived"
                    ? "bg-blue-50 text-blue-800"
                    : "bg-emerald-50 text-emerald-800";
              const detail = item.status === "missing"
                ? `${item.missing} missing`
                : item.status === "review"
                  ? `${item.skipped} skipped`
                  : item.status === "derived"
                    ? "derived"
                    : "complete";
              return (
                <div key={item.key} className="rounded-lg bg-white p-3 text-[#241133]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black">{item.label}</p>
                    <Pill className={badgeClass}>{detail}</Pill>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#7d6b65]">Lovable {item.exported} / VYVA {item.imported}</p>
                  {item.skipped ? <p className="mt-1 text-xs font-bold text-amber-800">Skipped: {item.skipped}</p> : null}
                </div>
              );
            })}
          </div>
        ) : null}
        {contentSources.length ? (
          <div className="mt-3 rounded-lg bg-white p-3" data-testid="marketing-lovable-content-source-buckets">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Lovable content buckets</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {contentSources.map((item) => <Pill key={item.key} className="bg-purple-50 text-purple-800">{item.label}: {item.value}</Pill>)}
            </div>
          </div>
        ) : null}
        {run ? <LovableDestinationMap summary={run.summary} /> : null}
        {unmappedCount || unmappedCampaignRecipientCount ? (
          <div className="mt-3 flex flex-wrap gap-1.5" data-testid="marketing-lovable-unmapped-summary">
            {unmappedCount ? <Pill className="bg-amber-50 text-amber-800">Unmapped list members: {unmappedCount}</Pill> : null}
            {unmappedCampaignRecipientCount ? <Pill className="bg-amber-50 text-amber-800">Unmapped campaign recipients: {unmappedCampaignRecipientCount}</Pill> : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function LovableDestinationMap({ summary }: { summary: Record<string, unknown> }) {
  const rows = lovableDestinationRows.map((row) => ({ ...row, count: syncDestinationCount(summary, row) }));
  const hasCounts = rows.some((row) => row.count > 0);
  return (
    <div className="mt-3 rounded-lg bg-white p-3" data-testid="marketing-lovable-destination-map">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Where Lovable data appears</p>
          <p className="mt-1 text-xs font-semibold text-[#8b7a73]">Use this map to find each imported Lovable source in VYVA after preview or sync.</p>
        </div>
        <Pill className={hasCounts ? "bg-emerald-50 text-emerald-800" : "bg-[#f5eee8] text-[#7d6b65]"}>{hasCounts ? "mapped" : "waiting for sync"}</Pill>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-[#f0e7df] bg-[#fffaf4] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-black text-[#241133]">{row.label}</p>
                <p className="mt-1 text-xs font-semibold text-[#8b7a73]">{row.sourceHint}</p>
              </div>
              <Pill className={row.count > 0 ? "bg-blue-50 text-blue-800" : "bg-[#f5eee8] text-[#7d6b65]"}>{row.count}</Pill>
            </div>
            <p className="mt-2 text-xs font-black text-purple-800">Destination: {row.destination}</p>
            <p className="mt-1 text-xs font-semibold text-[#5b4a46]">{row.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-[#E5D8CA] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const textareaClass = "min-h-[92px] w-full rounded-xl border border-[#E5D8CA] bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";

export default function MarketingAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [contactView, setContactView] = useState<ContactView>("contacts");
  const [summary, setSummary] = useState<MarketingSummary>(emptySummary);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [content, setContent] = useState<ContentAsset[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MarketingMediaAsset[]>([]);
  const [analyticsTotals, setAnalyticsTotals] = useState<MarketingAnalyticsTotals>(emptySummary.analyticsTotals ?? { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, replied: 0, socialEngagement: 0 });
  const [campaignMetrics, setCampaignMetrics] = useState<MarketingCampaignMetric[]>([]);
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [audiences, setAudiences] = useState<MarketingAudience[]>([]);
  const [journeyEnrollments, setJourneyEnrollments] = useState<JourneyEnrollment[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(emptySync);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState("");
  const [exportPreview, setExportPreview] = useState<LovableExportPreview | null>(null);
  const [exportPreviewRunning, setExportPreviewRunning] = useState(false);
  const [exportPreviewFeedback, setExportPreviewFeedback] = useState("");
  const [contactFeedback, setContactFeedback] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState("");
  const [campaignEmailSending, setCampaignEmailSending] = useState(false);
  const [campaignEmailFeedback, setCampaignEmailFeedback] = useState("");
  const [dueEmailSending, setDueEmailSending] = useState(false);
  const [dueEmailFeedback, setDueEmailFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [audienceFilter, setAudienceFilter] = useState<Audience | "all">("all");
  const [contentSourceFilter, setContentSourceFilter] = useState("all");
  const [contactSourceFilter, setContactSourceFilter] = useState("all");
  const [contactConsentFilter, setContactConsentFilter] = useState("all");
  const [contactLanguageFilter, setContactLanguageFilter] = useState("all");
  const [contactCategoryFilter, setContactCategoryFilter] = useState("all");
  const [contactVerticalFilter, setContactVerticalFilter] = useState("all");
  const [contactMarketFilter, setContactMarketFilter] = useState("all");
  const [contactListFilter, setContactListFilter] = useState("all");
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>(() => emptyCampaignDraft());
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignEditDraft, setCampaignEditDraft] = useState<CampaignEditDraft>(() => emptyCampaignEditDraft());
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [confirmingCampaignDeleteId, setConfirmingCampaignDeleteId] = useState<string | null>(null);
  const [confirmingCampaignSendId, setConfirmingCampaignSendId] = useState<string | null>(null);
  const [confirmingDueEmailSend, setConfirmingDueEmailSend] = useState(false);
  const [editingJourneyId, setEditingJourneyId] = useState<string | "new" | null>(null);
  const [journeyEditDraft, setJourneyEditDraft] = useState<JourneyEditDraft>(() => emptyJourneyEditDraft());
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeyFeedback, setJourneyFeedback] = useState("");
  const [confirmingJourneyDeleteId, setConfirmingJourneyDeleteId] = useState<string | null>(null);
  const [contentDraft, setContentDraft] = useState<ContentDraft>(() => emptyContentDraft());
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [contentEditDraft, setContentEditDraft] = useState<ContentEditDraft | null>(null);
  const [contentDrawerMode, setContentDrawerMode] = useState<"preview" | "edit" | null>(null);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentFeedback, setContentFeedback] = useState("");
  const [contentActionFeedback, setContentActionFeedback] = useState("");
  const [confirmingContentDeleteId, setConfirmingContentDeleteId] = useState<string | null>(null);
  const contentEditorPanelRef = useRef<HTMLDivElement | null>(null);
  const contentPreviewPanelRef = useRef<HTMLDivElement | null>(null);
  const [editingMediaAssetId, setEditingMediaAssetId] = useState<string | null>(null);
  const [mediaEditDraft, setMediaEditDraft] = useState<MediaEditDraft | null>(null);
  const [mediaSaving, setMediaSaving] = useState(false);
  const [mediaFeedback, setMediaFeedback] = useState("");
  const [confirmingMediaDeleteId, setConfirmingMediaDeleteId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<ContactDraft>({
    fullName: "",
    audienceType: "b2b",
    email: "",
    phoneNumber: "",
    whatsappNumber: "",
    roleLabel: "",
    companyName: "",
    language: "",
    category: "",
    vertical: "",
    market: "",
    tags: "",
  });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactEditDraft, setContactEditDraft] = useState<ContactEditDraft | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [confirmingContactDeleteId, setConfirmingContactDeleteId] = useState<string | null>(null);
  const [audienceDraft, setAudienceDraft] = useState<AudienceDraft>({ name: "", listType: "dynamic", description: "", rulesText: "{\n  \"market\": \"Spain\"\n}", contactExternalIds: "" });
  const [editingAudienceId, setEditingAudienceId] = useState<string | null>(null);
  const [audienceEditDraft, setAudienceEditDraft] = useState<AudienceEditDraft | null>(null);
  const [audienceSaving, setAudienceSaving] = useState(false);
  const [audienceFeedback, setAudienceFeedback] = useState("");
  const [confirmingAudienceDeleteId, setConfirmingAudienceDeleteId] = useState<string | null>(null);

  async function refreshAll() {
    const marketingDataRequest = Promise.all([
      api<MarketingSummary>("/api/admin/marketing/summary"),
      api<{ campaigns: Campaign[] }>("/api/admin/marketing/campaigns"),
      api<{ journeys: Journey[] }>("/api/admin/marketing/journeys"),
      api<{ enrollments: JourneyEnrollment[] }>("/api/admin/marketing/journey-enrollments"),
      api<{ content: ContentAsset[] }>("/api/admin/marketing/content"),
      api<{ mediaAssets: MarketingMediaAsset[] }>("/api/admin/marketing/media"),
      api<{ totals: MarketingAnalyticsTotals; metrics: MarketingCampaignMetric[] }>("/api/admin/marketing/analytics"),
      api<{ contacts: MarketingContact[] }>("/api/admin/marketing/contacts"),
      api<{ audiences: MarketingAudience[] }>("/api/admin/marketing/audiences"),
    ]).then(([summaryBody, campaignBody, journeyBody, enrollmentBody, contentBody, mediaBody, analyticsBody, contactBody, audienceBody]) => {
      setSummary(summaryBody);
      setCampaigns(campaignBody.campaigns);
      setJourneys(journeyBody.journeys);
      setJourneyEnrollments(enrollmentBody.enrollments);
      setContent(contentBody.content);
      setMediaAssets(mediaBody.mediaAssets);
      setAnalyticsTotals(analyticsBody.totals);
      setCampaignMetrics(analyticsBody.metrics);
      setContacts(contactBody.contacts);
      setAudiences(audienceBody.audiences);
    });

    const syncRequest = api<SyncState>("/api/admin/marketing/sync/lovable").then((syncBody) => {
      setSyncState(syncBody);
    });

    const [marketingResult, syncResult] = await Promise.allSettled([marketingDataRequest, syncRequest]);
    const failed = [marketingResult, syncResult].find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) {
      throw failed.reason instanceof Error ? failed.reason : new Error("Marketing admin data could not be refreshed.");
    }
  }

  useEffect(() => {
    refreshAll().catch((error) => setMessage(error.message));
  }, []);

  const contentTitleById = useMemo(() => new Map(content.map((item) => [item.id, item.title])), [content]);
  const contentSourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of content) {
      const key = contentOriginKey(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: contentSourceLabel(key), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [content]);

  const visibleCampaigns = useMemo(() => campaigns.filter((campaign) => {
    const targetAudience = campaignTargetAudience(campaign, audiences);
    const campaignMatchesSearch = matchesSearch(search, [
      campaign.id,
      campaign.name,
      campaign.objective,
      campaign.status,
      campaign.audienceType,
      campaign.scheduleStartsAt,
      campaign.scheduleEndsAt,
      campaign.timezone,
      campaign.source,
      campaign.lovableExternalId,
      campaign.metadata,
      targetAudience?.name,
      targetAudience?.lovableExternalId,
      ...(campaign.channels ?? []).flatMap((item) => [
        item.channel,
        item.status,
        item.sendCapability,
        item.scheduledAt,
        contentTitleById.get(item.contentAssetId ?? ""),
      ]),
      ...(campaign.recipients ?? []).flatMap((recipient) => [
        recipient.recipient,
        recipient.channel,
        recipient.status,
        recipient.snapshot,
      ]),
    ]);
    const matchesAudience = audienceFilter === "all" || campaign.audienceType === audienceFilter;
    const matchesChannel = channelFilter === "all" || campaign.channels.some((item) => item.channel === channelFilter);
    return campaignMatchesSearch && matchesAudience && matchesChannel;
  }), [campaigns, search, audienceFilter, channelFilter, audiences, contentTitleById]);

  const visibleContent = useMemo(() => content.filter((item) => {
    const contentMatchesSearch = matchesSearch(search, [
      item.id,
      item.title,
      item.channel,
      item.language,
      item.status,
      item.subject,
      item.body,
      item.htmlBody,
      item.ctaLabel,
      item.ctaUrl,
      item.source,
      item.lovableExternalId,
      item.designJson,
      item.mediaAssets,
      item.metadata,
    ]);
    const matchesChannel = channelFilter === "all" || item.channel === channelFilter;
    const matchesSource = contentSourceFilter === "all" || contentOriginKey(item) === contentSourceFilter;
    return contentMatchesSearch && matchesChannel && matchesSource;
  }), [content, search, channelFilter, contentSourceFilter]);

  const visibleContentIdSet = useMemo(() => new Set(visibleContent.map((item) => item.id)), [visibleContent]);

  const visibleMediaAssets = useMemo(() => mediaAssets.filter((item) => {
    const matchesText = matchesSearch(search, [
      item.id,
      item.contentAssetId,
      item.contentTitle,
      item.originalUrl,
      item.localUrl,
      item.assetType,
      item.status,
      item.source,
      item.lovableExternalId,
      item.metadata,
    ]);
    const matchesSource = contentSourceFilter === "all"
      || (item.contentAssetId ? visibleContentIdSet.has(item.contentAssetId) : item.source === contentSourceFilter);
    return matchesText && matchesSource;
  }), [mediaAssets, search, contentSourceFilter, visibleContentIdSet]);

  const contactSourceOptions = useMemo(() => countedOptions(contacts.map((contact) => contact.source)), [contacts]);
  const contactConsentOptions = useMemo(() => countedOptions(contacts.map((contact) => contact.consentStatus)), [contacts]);
  const contactLanguageOptions = useMemo(() => countedOptions(contacts.map((contact) => contact.language)), [contacts]);
  const contactCategoryOptions = useMemo(() => countedOptions(contacts.map((contact) => contact.category)), [contacts]);
  const contactVerticalOptions = useMemo(() => countedOptions(contacts.map((contact) => contact.vertical)), [contacts]);
  const contactMarketOptions = useMemo(() => countedOptions(contacts.map((contact) => contact.market)), [contacts]);
  const contactListOptions = useMemo(() => countedOptions(contacts.flatMap((contact) => contact.lists ?? [])), [contacts]);
  const contactFiltersActive = [
    contactSourceFilter,
    contactConsentFilter,
    contactLanguageFilter,
    contactCategoryFilter,
    contactVerticalFilter,
    contactMarketFilter,
    contactListFilter,
  ].some((value) => value !== "all");

  const visibleContacts = useMemo(() => contacts.filter((contact) => {
    const matchesSearch = !search || contactSearchText(contact).includes(search.toLowerCase());
    const matchesAudience = audienceFilter === "all" || contact.audienceType === audienceFilter;
    const matchesSource = valueMatchesFilter(contact.source, contactSourceFilter);
    const matchesConsent = valueMatchesFilter(contact.consentStatus, contactConsentFilter);
    const matchesLanguage = valueMatchesFilter(contact.language, contactLanguageFilter);
    const matchesCategory = valueMatchesFilter(contact.category, contactCategoryFilter);
    const matchesVertical = valueMatchesFilter(contact.vertical, contactVerticalFilter);
    const matchesMarket = valueMatchesFilter(contact.market, contactMarketFilter);
    const matchesList = contactListFilter === "all" || contact.lists.some((list) => valueMatchesFilter(list, contactListFilter));
    return matchesSearch && matchesAudience && matchesSource && matchesConsent && matchesLanguage && matchesCategory && matchesVertical && matchesMarket && matchesList;
  }), [contacts, search, audienceFilter, contactSourceFilter, contactConsentFilter, contactLanguageFilter, contactCategoryFilter, contactVerticalFilter, contactMarketFilter, contactListFilter]);

  const visibleAudiences = useMemo(() => audiences.filter((audience) => {
    return matchesSearch(search, [
      audience.id,
      audience.name,
      audience.description,
      audience.listType,
      audience.source,
      audience.lovableExternalId,
      audience.rules,
      audience.metadata,
      ...(audience.contactExternalIds ?? []),
      ...(audience.unmappedContactExternalIds ?? []),
      ...(audience.memberPreview ?? []).flatMap((member) => [
        member.fullName,
        member.email,
        member.phoneNumber,
        member.whatsappNumber,
        member.companyName,
        member.roleLabel,
        member.lovableExternalId,
        member.contactExternalId,
      ]),
    ]);
  }), [audiences, search]);
  const audienceDraftMemberIds = useMemo(() => parseAudienceMemberIds(audienceDraft), [audienceDraft]);
  const audienceEditMemberIds = useMemo(() => parseAudienceMemberIds(audienceEditDraft), [audienceEditDraft]);
  const audienceDraftMemberContacts = useMemo(
    () => contacts.filter((contact) => contactMatchesMemberIds(contact, audienceDraftMemberIds)),
    [contacts, audienceDraftMemberIds],
  );
  const audienceEditMemberContacts = useMemo(
    () => contacts.filter((contact) => contactMatchesMemberIds(contact, audienceEditMemberIds)),
    [contacts, audienceEditMemberIds],
  );
  const audienceDraftCandidateContacts = useMemo(
    () => contacts.filter((contact) => !contactMatchesMemberIds(contact, audienceDraftMemberIds)),
    [contacts, audienceDraftMemberIds],
  );
  const audienceEditCandidateContacts = useMemo(
    () => contacts.filter((contact) => !contactMatchesMemberIds(contact, audienceEditMemberIds)),
    [contacts, audienceEditMemberIds],
  );

  const visibleJourneys = useMemo(() => journeys.filter((journey) => {
    const targetAudience = journeyTargetAudience(journey, audiences);
    const journeyMatchesSearch = matchesSearch(search, [
      journey.id,
      journey.name,
      journey.objective,
      journey.status,
      journey.audienceType,
      journey.triggerType,
      journey.triggerConfig,
      journey.goalType,
      journey.goalConfig,
      journey.source,
      journey.lovableExternalId,
      journey.metadata,
      targetAudience?.name,
      targetAudience?.lovableExternalId,
      ...(journey.steps ?? []).flatMap((step) => [
        step.kind,
        step.channel,
        step.status,
        step.templateKind,
        step.templateRef,
        step.config,
        step.metadata,
        contentTitleById.get(step.contentAssetId ?? ""),
      ]),
    ]);
    const matchesAudience = audienceFilter === "all" || journey.audienceType === audienceFilter;
    const matchesChannel = channelFilter === "all" || journey.steps.some((step) => step.channel === channelFilter);
    return journeyMatchesSearch && matchesAudience && matchesChannel;
  }), [journeys, search, audienceFilter, channelFilter, audiences, contentTitleById]);

  const editingCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null, [campaigns, editingCampaignId]);
  const editingJourney = useMemo(() => editingJourneyId && editingJourneyId !== "new" ? journeys.find((journey) => journey.id === editingJourneyId) ?? null : null, [journeys, editingJourneyId]);
  const editingContent = useMemo(() => content.find((item) => item.id === editingContentId) ?? null, [content, editingContentId]);
  const editingMediaAsset = useMemo(() => mediaAssets.find((item) => item.id === editingMediaAssetId) ?? null, [mediaAssets, editingMediaAssetId]);
  const selectedContent = useMemo(() => selectedContentId ? visibleContent.find((item) => item.id === selectedContentId) ?? null : null, [selectedContentId, visibleContent]);
  const selectedContentMediaAssets = useMemo(() => {
    if (!selectedContent) return [];
    return mediaAssets.filter((item) => item.contentAssetId === selectedContent.id);
  }, [mediaAssets, selectedContent]);
  const selectedContentDesignSummary = useMemo(() => selectedContent ? designShapeSummary(selectedContent.designJson) : null, [selectedContent]);
  const selectedContentMediaPreviewUrls = useMemo(() => selectedContent ? contentMediaPreviewUrls(selectedContent, selectedContentMediaAssets) : [], [selectedContent, selectedContentMediaAssets]);
  const latestSyncRun = syncState.runs[0] ?? null;

  useEffect(() => {
    if (!selectedContentId || visibleContentIdSet.has(selectedContentId)) return;
    if (editingContentId === selectedContentId && contentEditDraft) return;
    setSelectedContentId(null);
    setContentDrawerMode(null);
    setContentActionFeedback("");
    if (editingContentId === selectedContentId) {
      setEditingContentId(null);
      setContentEditDraft(null);
      setContentFeedback("");
    }
  }, [selectedContentId, visibleContentIdSet, editingContentId, contentEditDraft]);

  const contentEmptyDiagnostic = useMemo(() => {
    if (content.length > 0 && visibleContent.length === 0) {
      return {
        title: "Content is loaded, but hidden by filters.",
        detail: `${content.length} content asset${content.length === 1 ? "" : "s"} are in VYVA. Clear search, channel, or content type filters to see them.`,
        action: "clear_filters" as const,
      };
    }
    if (content.length > 0) return null;
    if (!latestSyncRun) {
      return {
        title: "No Lovable content has been imported yet.",
        detail: "Run the one-way sync in Settings. If Lovable exports content, it will appear here as email templates, social posts, briefs, or assets.",
        action: "open_settings" as const,
      };
    }
    if (latestSyncRun.status === "failed") {
      return {
        title: "Last Lovable sync failed.",
        detail: latestSyncRun.error || "Open Settings to review the sync error, fix the export endpoint or token, then run sync again.",
        action: "open_settings" as const,
      };
    }
    const exportedContent = syncCountValue(latestSyncRun.summary, "exported", "content");
    const importedContent = syncCountValue(latestSyncRun.summary, "imported", "content") || numberValue(latestSyncRun.summary.content);
    const skippedContent = syncCountValue(latestSyncRun.summary, "skipped", "content");
    if (exportedContent > 0 && importedContent === 0) {
      return {
        title: "Lovable exported content, but VYVA did not import it.",
        detail: `Last sync saw ${exportedContent} content row${exportedContent === 1 ? "" : "s"}${skippedContent ? ` and skipped ${skippedContent}` : ""}. Open Settings to inspect skipped counts and field coverage.`,
        action: "open_settings" as const,
      };
    }
    if (importedContent > 0) {
      return {
        title: "Content was reported as imported, but none is loaded.",
        detail: "Refresh the admin page. If this stays empty, check the marketing content API and database rows.",
        action: "open_settings" as const,
      };
    }
    return {
      title: "Last sync did not receive content from Lovable.",
      detail: "Ask the Lovable export to include content, saved email templates, content briefs, social posts, templates, or assets, then run sync again.",
      action: "open_settings" as const,
    };
  }, [content.length, latestSyncRun, visibleContent.length]);
  const enrollmentsByJourneyId = useMemo(() => groupCount(journeyEnrollments, (item) => item.journeyId), [journeyEnrollments]);
  const activeEnrollmentsByJourneyId = useMemo(() => groupCount(journeyEnrollments.filter((item) => item.status === "active"), (item) => item.journeyId), [journeyEnrollments]);
  const emailContentAssets = useMemo(() => content.filter((item) => item.channel === "email" && item.status !== "archived"), [content]);
  const draftEmailChannel = campaignChannelsWithPrimary(campaignEditDraft).find((channel) => channel.channel === "email") ?? null;
  const selectedEmailContent = useMemo(
    () => emailContentAssets.find((item) => item.id === draftEmailChannel?.contentAssetId) ?? null,
    [draftEmailChannel?.contentAssetId, emailContentAssets],
  );
  const campaignDraftContentOptions = useMemo(
    () => content.filter((item) => item.channel === campaignDraft.channel && item.status !== "archived"),
    [campaignDraft.channel, content],
  );
  const campaignEditPrimaryContentOptions = useMemo(() => {
    const options = content.filter((item) => item.channel === campaignEditDraft.channel && item.status !== "archived");
    const selected = campaignEditDraft.contentAssetId ? content.find((item) => item.id === campaignEditDraft.contentAssetId) ?? null : null;
    return selected && !options.some((item) => item.id === selected.id) ? [selected, ...options] : options;
  }, [campaignEditDraft.channel, campaignEditDraft.contentAssetId, content]);
  const selectedCampaignDraftTargetAudience = useMemo(
    () => audiences.find((audience) => audience.id === campaignDraft.targetAudienceId) ?? null,
    [audiences, campaignDraft.targetAudienceId],
  );
  const editingContact = useMemo(() => contacts.find((contact) => contact.id === editingContactId) ?? null, [contacts, editingContactId]);
  const editingAudience = useMemo(() => audiences.find((audience) => audience.id === editingAudienceId) ?? null, [audiences, editingAudienceId]);
  const selectedCampaignTargetAudience = useMemo(
    () => audiences.find((audience) => audience.id === campaignEditDraft.targetAudienceId) ?? null,
    [audiences, campaignEditDraft.targetAudienceId],
  );
  const selectedJourneyTargetAudience = useMemo(
    () => audiences.find((audience) => audience.id === journeyEditDraft.targetAudienceId) ?? null,
    [audiences, journeyEditDraft.targetAudienceId],
  );

  const campaignDraftRecipientPreview = useMemo(() => {
    if (!campaignDraft.snapshotRecipients) return [];
    const filter = campaignDraft.recipientFilter.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!campaignAllowsContact(campaignDraft.audienceType, contact.audienceType)) return false;
      if (!contactMatchesAudienceList(contact, selectedCampaignDraftTargetAudience)) return false;
      if (!recipientForChannel(contact, campaignDraft.channel)) return false;
      return !filter || contactSearchText(contact).includes(filter);
    });
  }, [campaignDraft, contacts, selectedCampaignDraftTargetAudience]);

  const campaignRecipientPreview = useMemo(() => {
    if (!editingCampaignId || !campaignEditDraft.snapshotRecipients) return [];
    const filter = campaignEditDraft.recipientFilter.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!campaignAllowsContact(campaignEditDraft.audienceType, contact.audienceType)) return false;
      if (!contactMatchesAudienceList(contact, selectedCampaignTargetAudience)) return false;
      if (!recipientForChannel(contact, campaignEditDraft.channel)) return false;
      return !filter || contactSearchText(contact).includes(filter);
    });
  }, [campaignEditDraft, contacts, editingCampaignId, selectedCampaignTargetAudience]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    if (!campaignDraft.name.trim()) {
      setMessage("Campaign name is required before creating a draft.");
      return;
    }
    const scheduledAt = campaignDraft.scheduleStartsAt ? new Date(campaignDraft.scheduleStartsAt).toISOString() : null;
    const scheduleEndsAt = campaignDraft.scheduleEndsAt ? new Date(campaignDraft.scheduleEndsAt).toISOString() : null;
    const targetAudienceSnapshot = audienceSnapshot(selectedCampaignDraftTargetAudience);
    const recipients = campaignDraft.snapshotRecipients
      ? campaignDraftRecipientPreview.map((contact) => ({
        contactId: contact.id,
        channel: campaignDraft.channel,
        recipient: recipientForChannel(contact, campaignDraft.channel) ?? contact.id,
        status: "planned",
        scheduledAt,
        snapshot: {
          ...recipientSnapshot(contact),
          ...(targetAudienceSnapshot ? { audienceList: targetAudienceSnapshot } : {}),
        },
      }))
      : undefined;
    setCampaignSaving(true);
    setMessage("Creating campaign...");
    try {
      const result = await api<{ campaign: Campaign }>("/api/admin/marketing/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: campaignDraft.name,
          audienceType: campaignDraft.audienceType,
          status: campaignDraft.status,
          objective: campaignDraft.objective,
          scheduleStartsAt: scheduledAt,
          scheduleEndsAt,
          metadata: campaignMetadataWithTarget({}, selectedCampaignDraftTargetAudience),
          channels: [{
            channel: campaignDraft.channel,
            contentAssetId: campaignDraft.contentAssetId || null,
            status: campaignDraft.status,
            scheduledAt,
          }],
          ...(recipients ? { recipients } : {}),
        }),
      });
      setCampaigns((current) => [result.campaign, ...current.filter((campaign) => campaign.id !== result.campaign.id)]);
      setEditingCampaignId(result.campaign.id);
      setCampaignEditDraft(campaignEditDraftFromCampaign(result.campaign, audiences));
      setCampaignDraft(emptyCampaignDraft());
      const recipientMessage = campaignDraft.snapshotRecipients ? ` ${recipients?.length ?? 0} recipients snapshotted.` : "";
      setMessage(`Campaign draft created.${recipientMessage}`);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign could not be created.");
    } finally {
      setCampaignSaving(false);
    }
  }

  function startCampaignEdit(campaign: Campaign) {
    setEditingCampaignId(campaign.id);
    setCampaignEditDraft(campaignEditDraftFromCampaign(campaign, audiences));
    setConfirmingCampaignDeleteId(null);
    setConfirmingCampaignSendId(null);
    setMessage("");
    setTestEmailFeedback("");
    setCampaignEmailFeedback("");
  }

  function openCampaignFromCalendar(campaign: Campaign) {
    startCampaignEdit(campaign);
    setActiveTab("dashboard");
  }

  function cancelCampaignEdit() {
    setEditingCampaignId(null);
    setConfirmingCampaignDeleteId(null);
    setConfirmingCampaignSendId(null);
    setTestEmailFeedback("");
    setCampaignEmailFeedback("");
    setCampaignEditDraft(emptyCampaignEditDraft());
  }

  async function saveCampaignEdit(event: FormEvent, campaignId: string) {
    event.preventDefault();
    if (!campaignEditDraft.name.trim()) {
      setMessage("Campaign name is required before saving.");
      return;
    }
    const scheduledAt = fromDateTimeLocal(campaignEditDraft.scheduleStartsAt);
    const scheduleEndsAt = fromDateTimeLocal(campaignEditDraft.scheduleEndsAt);
    const existingMetadata = parseJsonText(campaignEditDraft.metadataText, "Campaign metadata");
    const targetAudienceSnapshot = audienceSnapshot(selectedCampaignTargetAudience);
    const recipients = campaignEditDraft.snapshotRecipients
      ? campaignRecipientPreview.map((contact) => ({
        contactId: contact.id,
        channel: campaignEditDraft.channel,
        recipient: recipientForChannel(contact, campaignEditDraft.channel) ?? contact.id,
        status: "planned",
        scheduledAt,
        snapshot: {
          ...recipientSnapshot(contact),
          ...(targetAudienceSnapshot ? { audienceList: targetAudienceSnapshot } : {}),
        },
      }))
      : undefined;
    setCampaignSaving(true);
    setMessage("Saving campaign...");
    try {
      await api(`/api/admin/marketing/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: campaignEditDraft.name,
          audienceType: campaignEditDraft.audienceType,
          status: campaignEditDraft.status,
          objective: campaignEditDraft.objective,
          scheduleStartsAt: scheduledAt,
          scheduleEndsAt,
          timezone: campaignEditDraft.timezone,
          source: campaignEditDraft.source.trim() || "vyva",
          lovableExternalId: campaignEditDraft.lovableExternalId.trim() || null,
          metadata: campaignMetadataWithTarget(existingMetadata, selectedCampaignTargetAudience),
          channels: campaignChannelsPayload(campaignEditDraft),
          ...(recipients ? { recipients } : {}),
        }),
      });
      const recipientMessage = campaignEditDraft.snapshotRecipients ? ` ${recipients?.length ?? 0} recipients snapshotted.` : "";
      setCampaignEditDraft((draft) => ({ ...draft, snapshotRecipients: false }));
      setCampaignEmailFeedback("");
      setTestEmailFeedback("");
      setMessage(`Campaign updated.${recipientMessage}`);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign could not be saved.");
    } finally {
      setCampaignSaving(false);
    }
  }

  function updateCampaignChannel(channelId: string, patch: Partial<CampaignChannelDraft>) {
    setCampaignEditDraft((draft) => {
      const channels = campaignChannelsWithPrimary(draft).map((channel) => (
        channel.id === channelId
          ? {
              ...channel,
              ...patch,
              contentAssetId: patch.channel && patch.channel !== channel.channel ? "" : patch.contentAssetId ?? channel.contentAssetId,
            }
          : channel
      ));
      const primary = channels[0] ?? newCampaignChannelDraft();
      return {
        ...draft,
        channels,
        channel: primary.channel,
        contentAssetId: primary.contentAssetId,
        status: primary.status,
        scheduleStartsAt: primary.scheduledAt,
      };
    });
    setCampaignEmailFeedback("");
    setTestEmailFeedback("");
  }

  function addCampaignChannel() {
    setCampaignEditDraft((draft) => ({
      ...draft,
      channels: [
        ...campaignChannelsWithPrimary(draft),
        newCampaignChannelDraft("linkedin", draft.status, draft.scheduleStartsAt),
      ],
    }));
    setCampaignEmailFeedback("");
    setTestEmailFeedback("");
  }

  function removeCampaignChannel(channelId: string) {
    setCampaignEditDraft((draft) => {
      const nextChannels = campaignChannelsWithPrimary(draft).filter((channel) => channel.id !== channelId);
      const channels = nextChannels.length ? nextChannels : [newCampaignChannelDraft("email", draft.status, draft.scheduleStartsAt)];
      const primary = channels[0];
      return {
        ...draft,
        channels,
        channel: primary.channel,
        contentAssetId: primary.contentAssetId,
        status: primary.status,
        scheduleStartsAt: primary.scheduledAt,
      };
    });
    setCampaignEmailFeedback("");
    setTestEmailFeedback("");
  }

  async function sendTestCampaignEmail(campaignId: string) {
    setTestEmailSending(true);
    setTestEmailFeedback("Sending test email...");
    try {
      const result = await api<TestEmailResponse>(`/api/admin/marketing/campaigns/${campaignId}/test-email`, { method: "POST" });
      const recipient = result.communication?.recipient || result.delivery?.recipient || "your admin email";
      setTestEmailFeedback(`Test email sent to ${recipient}.`);
      setMessage("Marketing test email sent.");
      await refreshAll();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Test email could not be sent.";
      setTestEmailFeedback(messageText);
      setMessage(messageText);
    } finally {
      setTestEmailSending(false);
    }
  }

  async function sendCampaignEmails(campaign: Campaign) {
    if (confirmingCampaignSendId !== campaign.id) {
      setConfirmingCampaignSendId(campaign.id);
      setCampaignEmailFeedback(`Click Confirm send to email ${campaign.recipientCount} saved recipient${campaign.recipientCount === 1 ? "" : "s"} for "${campaign.name}".`);
      return;
    }
    setCampaignEmailSending(true);
    setCampaignEmailFeedback("Sending campaign emails...");
    try {
      const result = await api<CampaignEmailSendResponse>(`/api/admin/marketing/campaigns/${campaign.id}/send-email`, { method: "POST" });
      const summaryText = `Campaign email sent to ${result.sentCount} recipient${result.sentCount === 1 ? "" : "s"}. ${result.failedCount ? `${result.failedCount} failed. ` : ""}${result.skippedCount ? `${result.skippedCount} skipped.` : ""}`.trim();
      setConfirmingCampaignSendId(null);
      setCampaignEmailFeedback(summaryText);
      setMessage(summaryText);
      await refreshAll();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Campaign email could not be sent.";
      setConfirmingCampaignSendId(null);
      setCampaignEmailFeedback(messageText);
      setMessage(messageText);
    } finally {
      setCampaignEmailSending(false);
    }
  }

  async function sendDueCampaignEmails() {
    if (!confirmingDueEmailSend) {
      setConfirmingDueEmailSend(true);
      setDueEmailFeedback("Click Confirm run due emails to send every due scheduled email campaign.");
      return;
    }
    setDueEmailSending(true);
    setDueEmailFeedback("Checking due scheduled email campaigns...");
    try {
      const result = await api<DueCampaignEmailSendResponse>("/api/admin/marketing/campaigns/send-due-email", { method: "POST" });
      const summaryText = result.dueCount === 0
        ? "No scheduled email campaigns are due."
        : `Due email run checked ${result.dueCount} campaign${result.dueCount === 1 ? "" : "s"}: ${result.sentCount} sent, ${result.failedCount} failed, ${result.skippedCount} skipped.`;
      setConfirmingDueEmailSend(false);
      setDueEmailFeedback(summaryText);
      setMessage(summaryText);
      await refreshAll();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Due scheduled emails could not be sent.";
      setConfirmingDueEmailSend(false);
      setDueEmailFeedback(messageText);
      setMessage(messageText);
    } finally {
      setDueEmailSending(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (confirmingCampaignDeleteId !== campaign.id) {
      setConfirmingCampaignDeleteId(campaign.id);
      setMessage(`Click Confirm delete to remove campaign "${campaign.name}".`);
      return;
    }
    setCampaignSaving(true);
    setMessage("Deleting campaign...");
    try {
      await api(`/api/admin/marketing/campaigns/${campaign.id}`, { method: "DELETE" });
      if (editingCampaignId === campaign.id) cancelCampaignEdit();
      setConfirmingCampaignDeleteId(null);
      setMessage("Campaign deleted.");
      await refreshAll();
    } catch (error) {
      setConfirmingCampaignDeleteId(null);
      setMessage(error instanceof Error ? error.message : "Campaign could not be deleted.");
    } finally {
      setCampaignSaving(false);
    }
  }

  function startNewJourney() {
    setEditingJourneyId("new");
    setJourneyEditDraft(emptyJourneyEditDraft());
    setConfirmingJourneyDeleteId(null);
    setJourneyFeedback("");
    setMessage("");
  }

  function startJourneyEdit(journey: Journey) {
    setEditingJourneyId(journey.id);
    setJourneyEditDraft(journeyEditDraftFromJourney(journey, audiences));
    setConfirmingJourneyDeleteId(null);
    setJourneyFeedback("");
    setMessage("");
  }

  function cancelJourneyEdit() {
    setEditingJourneyId(null);
    setJourneyEditDraft(emptyJourneyEditDraft());
    setConfirmingJourneyDeleteId(null);
    setJourneyFeedback("");
  }

  function updateJourneyStep(stepId: string, patch: Partial<JourneyStepDraft>) {
    setJourneyEditDraft((draft) => ({
      ...draft,
      steps: draft.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step),
    }));
  }

  function addJourneyStep() {
    setJourneyEditDraft((draft) => {
      const previousChannel = draft.steps.at(-1)?.channel ?? "email";
      return { ...draft, steps: [...draft.steps, newJourneyStepDraft(previousChannel)] };
    });
    setJourneyFeedback("");
  }

  function removeJourneyStep(stepId: string) {
    setJourneyEditDraft((draft) => ({ ...draft, steps: draft.steps.filter((step) => step.id !== stepId) }));
    setJourneyFeedback("");
  }

  function moveJourneyStep(stepId: string, direction: -1 | 1) {
    setJourneyEditDraft((draft) => {
      const currentIndex = draft.steps.findIndex((step) => step.id === stepId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= draft.steps.length) return draft;
      const steps = [...draft.steps];
      const [step] = steps.splice(currentIndex, 1);
      steps.splice(nextIndex, 0, step);
      return { ...draft, steps };
    });
    setJourneyFeedback("");
  }

  async function saveJourneyEdit(event: FormEvent) {
    event.preventDefault();
    if (!journeyEditDraft.name.trim()) {
      setJourneyFeedback("Journey name is required before saving.");
      return;
    }
    setJourneySaving(true);
    setJourneyFeedback("Saving journey...");
    try {
      const payload = journeyPayloadFromDraft(journeyEditDraft, selectedJourneyTargetAudience);
      const isNewJourney = editingJourneyId === "new";
      const result = await api<{ journey: Journey }>(
        isNewJourney ? "/api/admin/marketing/journeys" : `/api/admin/marketing/journeys/${editingJourneyId}`,
        {
          method: isNewJourney ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      await refreshAll();
      setJourneys((current) => [result.journey, ...current.filter((journey) => journey.id !== result.journey.id)]);
      setEditingJourneyId(result.journey.id);
      setJourneyEditDraft(journeyEditDraftFromJourney(result.journey, audiences));
      setJourneyFeedback(isNewJourney ? "Created." : "Updated.");
      setMessage(isNewJourney ? "Journey created." : "Journey updated.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Journey could not be saved.";
      setJourneyFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setJourneySaving(false);
    }
  }

  async function deleteJourney(journey: Journey) {
    if (confirmingJourneyDeleteId !== journey.id) {
      setConfirmingJourneyDeleteId(journey.id);
      setJourneyFeedback(`Click Confirm delete to remove journey "${journey.name}".`);
      return;
    }
    setJourneySaving(true);
    setJourneyFeedback("Deleting journey...");
    try {
      await api(`/api/admin/marketing/journeys/${journey.id}`, { method: "DELETE" });
      if (editingJourneyId === journey.id) cancelJourneyEdit();
      setConfirmingJourneyDeleteId(null);
      setJourneyFeedback("Deleted.");
      setMessage("Journey deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Journey could not be deleted.";
      setConfirmingJourneyDeleteId(null);
      setJourneyFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setJourneySaving(false);
    }
  }

  async function createContent(event: FormEvent) {
    event.preventDefault();
    setContentFeedback("");
    if (!contentDraft.title.trim()) {
      setContentFeedback("Content title is required before creating a draft.");
      return;
    }
    setContentSaving(true);
    try {
      const result = await api<{ content: ContentAsset }>("/api/admin/marketing/content", {
        method: "POST",
        body: JSON.stringify({
          title: contentDraft.title,
          channel: contentDraft.channel,
          language: contentDraft.language.trim() || "en",
          status: contentDraft.status,
          subject: contentDraft.subject || null,
          body: contentDraft.body,
          htmlBody: contentDraft.htmlBody.trim() || null,
          ctaLabel: contentDraft.ctaLabel.trim() || null,
          ctaUrl: contentDraft.ctaUrl.trim() || null,
          designJson: parseJsonText(contentDraft.designJsonText, "Design JSON"),
          mediaAssets: parseJsonArrayText(contentDraft.mediaAssetsText, "Media assets"),
        }),
      });
      setContentDraft(emptyContentDraft());
      setSelectedContentId(result.content.id);
      setEditingContentId(result.content.id);
      setContentEditDraft(contentEditDraftFromContent(result.content));
      setContentFeedback("Content draft created.");
      setContentActionFeedback("Content draft created. Editor opened.");
      setContentDrawerMode("edit");
      setMessage("Content draft created.");
      await refreshAll();
      scrollToContentPanel(contentEditorPanelRef);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Content draft could not be created.";
      setContentFeedback(errorMessage);
      setContentActionFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContentSaving(false);
    }
  }

  function scrollToContentPanel(ref: RefObject<HTMLDivElement | null>) {
    window.setTimeout(() => {
      if (typeof ref.current?.scrollIntoView === "function") {
        ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (typeof ref.current?.focus === "function") {
        ref.current.focus({ preventScroll: true });
      }
    }, 0);
  }

  function previewContent(contentAsset: ContentAsset) {
    setSelectedContentId(contentAsset.id);
    setEditingContentId(null);
    setContentEditDraft(null);
    setContentDrawerMode("preview");
    setConfirmingContentDeleteId(null);
    setContentActionFeedback(`Previewing "${contentAsset.title}".`);
    scrollToContentPanel(contentPreviewPanelRef);
  }

  function startContentEdit(contentAsset: ContentAsset) {
    setSelectedContentId(contentAsset.id);
    setEditingContentId(contentAsset.id);
    setContentEditDraft(contentEditDraftFromContent(contentAsset));
    setContentDrawerMode("edit");
    setConfirmingContentDeleteId(null);
    setContentFeedback("");
    setContentActionFeedback(`Editing "${contentAsset.title}".`);
    scrollToContentPanel(contentEditorPanelRef);
  }

  function cancelContentEdit() {
    setEditingContentId(null);
    setContentEditDraft(null);
    setContentDrawerMode(null);
    setContentFeedback("");
    setContentActionFeedback("");
    setConfirmingContentDeleteId(null);
  }

  function closeContentDrawer() {
    if (contentDrawerMode === "edit") {
      cancelContentEdit();
      return;
    }
    setContentDrawerMode(null);
    setContentActionFeedback("");
  }

  async function saveContentEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingContentId || !contentEditDraft) return;
    if (!contentEditDraft.title.trim()) {
      setContentFeedback("Content title is required before saving.");
      return;
    }
    setContentSaving(true);
    setContentFeedback("Saving content...");
    try {
      const result = await api<{ content: ContentAsset }>(`/api/admin/marketing/content/${editingContentId}`, {
        method: "PATCH",
        body: JSON.stringify(contentPayloadFromDraft(contentEditDraft)),
      });
      setSelectedContentId(result.content.id);
      setEditingContentId(result.content.id);
      setContentEditDraft(contentEditDraftFromContent(result.content));
      setContentDrawerMode("edit");
      setContentFeedback("Updated.");
      setContentActionFeedback(`Updated "${result.content.title}".`);
      setMessage("Content updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Content could not be saved.";
      setContentFeedback(errorMessage);
      setContentActionFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContentSaving(false);
    }
  }

  async function deleteContent(contentAsset: ContentAsset) {
    if (confirmingContentDeleteId !== contentAsset.id) {
      setConfirmingContentDeleteId(contentAsset.id);
      setContentActionFeedback(`Click Confirm delete to remove "${contentAsset.title}". Campaigns and journey steps will keep their records but lose this content link.`);
      return;
    }
    setContentSaving(true);
    setContentFeedback("Deleting content...");
    setContentActionFeedback(`Deleting "${contentAsset.title}"...`);
    try {
      await api(`/api/admin/marketing/content/${contentAsset.id}`, { method: "DELETE" });
      if (editingContentId === contentAsset.id) cancelContentEdit();
      if (selectedContentId === contentAsset.id) setSelectedContentId(null);
      if (editingContentId === contentAsset.id || selectedContentId === contentAsset.id) setContentDrawerMode(null);
      setConfirmingContentDeleteId(null);
      setContentFeedback("Deleted.");
      setContentActionFeedback(`Deleted "${contentAsset.title}".`);
      setMessage("Content deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Content could not be deleted.";
      setContentFeedback(errorMessage);
      setContentActionFeedback(errorMessage);
      setMessage(errorMessage);
      setConfirmingContentDeleteId(null);
    } finally {
      setContentSaving(false);
    }
  }

  function startMediaEdit(asset: MarketingMediaAsset) {
    setEditingMediaAssetId(asset.id);
    setMediaEditDraft(mediaEditDraftFromAsset(asset));
    setConfirmingMediaDeleteId(null);
    setMediaFeedback("");
  }

  function cancelMediaEdit() {
    setEditingMediaAssetId(null);
    setMediaEditDraft(null);
    setConfirmingMediaDeleteId(null);
    setMediaFeedback("");
  }

  async function saveMediaEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingMediaAssetId || !mediaEditDraft) return;
    if (!mediaEditDraft.originalUrl.trim()) {
      setMediaFeedback("Original URL is required before saving.");
      return;
    }
    setMediaSaving(true);
    setMediaFeedback("Saving media...");
    try {
      const result = await api<{ mediaAsset: MarketingMediaAsset }>(`/api/admin/marketing/media/${editingMediaAssetId}`, {
        method: "PATCH",
        body: JSON.stringify(mediaPayloadFromDraft(mediaEditDraft)),
      });
      setMediaAssets((current) => current.map((item) => item.id === result.mediaAsset.id ? result.mediaAsset : item));
      setEditingMediaAssetId(result.mediaAsset.id);
      setMediaEditDraft(mediaEditDraftFromAsset(result.mediaAsset));
      setMediaFeedback("Media updated.");
      setMessage("Marketing media updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Marketing media could not be updated.";
      setMediaFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setMediaSaving(false);
    }
  }

  async function deleteMediaAsset(asset: MarketingMediaAsset) {
    if (confirmingMediaDeleteId !== asset.id) {
      setConfirmingMediaDeleteId(asset.id);
      setMediaFeedback(`Click Confirm delete to remove this VYVA media reference. The original Lovable URL is not changed.`);
      return;
    }
    setMediaSaving(true);
    setMediaFeedback("Deleting media...");
    try {
      await api(`/api/admin/marketing/media/${asset.id}`, { method: "DELETE" });
      if (editingMediaAssetId === asset.id) cancelMediaEdit();
      setMediaAssets((current) => current.filter((item) => item.id !== asset.id));
      setConfirmingMediaDeleteId(null);
      setMediaFeedback("Media deleted.");
      setMessage("Marketing media deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Marketing media could not be deleted.";
      setConfirmingMediaDeleteId(null);
      setMediaFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setMediaSaving(false);
    }
  }

  async function createContact(event: FormEvent) {
    event.preventDefault();
    setContactFeedback("");
    setContactSaving(true);
    if (!contactDraft.fullName.trim() && !contactDraft.email.trim() && !contactDraft.phoneNumber.trim() && !contactDraft.whatsappNumber.trim()) {
      setContactFeedback("Add at least a name, email, phone, or WhatsApp before saving.");
      setContactSaving(false);
      return;
    }
    try {
      await api("/api/admin/marketing/contacts", {
        method: "POST",
        body: JSON.stringify({
          fullName: contactDraft.fullName,
          audienceType: contactDraft.audienceType,
          email: contactDraft.email || null,
          phoneNumber: contactDraft.phoneNumber || null,
          whatsappNumber: contactDraft.whatsappNumber || null,
          roleLabel: contactDraft.roleLabel || null,
          companyName: contactDraft.companyName || null,
          language: contactDraft.language || null,
          category: contactDraft.category || null,
          vertical: contactDraft.vertical || null,
          market: contactDraft.market || null,
          tags: splitTags(contactDraft.tags),
          metadata: {
            segmentation: {
              language: contactDraft.language || null,
              category: contactDraft.category || null,
              vertical: contactDraft.vertical || null,
              market: contactDraft.market || null,
            },
          },
          channelAvailability: {
            email: Boolean(contactDraft.email),
            phone: Boolean(contactDraft.phoneNumber),
            whatsapp: Boolean(contactDraft.whatsappNumber),
          },
        }),
      });
      setContactDraft({
        fullName: "",
        audienceType: "b2b",
        email: "",
        phoneNumber: "",
        whatsappNumber: "",
        roleLabel: "",
        companyName: "",
        language: "",
        category: "",
        vertical: "",
        market: "",
        tags: "",
      });
      setContactFeedback("Marketing contact created.");
      setMessage("Marketing contact created.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Marketing contact could not be created.";
      setContactFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContactSaving(false);
    }
  }

  function startContactEdit(contact: MarketingContact) {
    setEditingContactId(contact.id);
    setContactEditDraft(contactEditDraftFromContact(contact));
    setConfirmingContactDeleteId(null);
    setContactFeedback("");
  }

  function cancelContactEdit() {
    setEditingContactId(null);
    setContactEditDraft(null);
    setConfirmingContactDeleteId(null);
    setContactFeedback("");
  }

  async function saveContactEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingContactId || !contactEditDraft) return;
    if (!contactEditDraft.fullName.trim() && !contactEditDraft.email.trim() && !contactEditDraft.phoneNumber.trim() && !contactEditDraft.whatsappNumber.trim()) {
      setContactFeedback("Add at least a name, email, phone, or WhatsApp before saving.");
      return;
    }
    setContactSaving(true);
    setContactFeedback("Saving contact...");
    try {
      const result = await api<{ contact: MarketingContact }>(`/api/admin/marketing/contacts/${editingContactId}`, {
        method: "PATCH",
        body: JSON.stringify(contactPayloadFromDraft(contactEditDraft)),
      });
      setEditingContactId(result.contact.id);
      setContactEditDraft(contactEditDraftFromContact(result.contact));
      setContactFeedback("Contact updated.");
      setMessage("Marketing contact updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Marketing contact could not be updated.";
      setContactFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContactSaving(false);
    }
  }

  async function deleteContact(contact: MarketingContact) {
    if (confirmingContactDeleteId !== contact.id) {
      setConfirmingContactDeleteId(contact.id);
      setContactFeedback(`Click Confirm delete to remove "${contact.fullName || contact.email || contact.phoneNumber || "Unnamed contact"}". Audience memberships will be removed.`);
      return;
    }
    setContactSaving(true);
    setContactFeedback("Deleting contact...");
    try {
      await api(`/api/admin/marketing/contacts/${contact.id}`, { method: "DELETE" });
      if (editingContactId === contact.id) cancelContactEdit();
      setConfirmingContactDeleteId(null);
      setContactFeedback("Contact deleted.");
      setMessage("Marketing contact deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Marketing contact could not be deleted.";
      setConfirmingContactDeleteId(null);
      setContactFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContactSaving(false);
    }
  }

  async function createAudience(event: FormEvent) {
    event.preventDefault();
    setAudienceFeedback("");
    setAudienceSaving(true);
    if (!audienceDraft.name.trim()) {
      setAudienceFeedback("Audience name is required.");
      setAudienceSaving(false);
      return;
    }
    let rules: Record<string, unknown>;
    try {
      rules = parseRulesText(audienceDraft.rulesText);
    } catch {
      setAudienceFeedback("Rules must be valid JSON.");
      setAudienceSaving(false);
      return;
    }
    try {
      await api("/api/admin/marketing/audiences", {
        method: "POST",
        body: JSON.stringify({
          name: audienceDraft.name,
          listType: audienceDraft.listType || "dynamic",
          description: audienceDraft.description || null,
          rules,
          contactExternalIds: splitLines(audienceDraft.contactExternalIds),
          metadata: { created_from: "admin_rule_builder" },
        }),
      });
      setAudienceDraft({ name: "", listType: "dynamic", description: "", rulesText: "{\n  \"market\": \"Spain\"\n}", contactExternalIds: "" });
      setAudienceFeedback("Audience created.");
      setMessage("Audience created.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Audience could not be created.";
      setAudienceFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setAudienceSaving(false);
    }
  }

  function startAudienceEdit(audience: MarketingAudience) {
    setEditingAudienceId(audience.id);
    setAudienceEditDraft(audienceEditDraftFromAudience(audience));
    setConfirmingAudienceDeleteId(null);
    setAudienceFeedback("");
  }

  function cancelAudienceEdit() {
    setEditingAudienceId(null);
    setAudienceEditDraft(null);
    setConfirmingAudienceDeleteId(null);
    setAudienceFeedback("");
  }

  function addAudienceDraftContact(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;
    setAudienceDraft((draft) => updateAudienceDraftMemberIds(draft, [...parseAudienceMemberIds(draft), contactAudienceMemberId(contact)]));
  }

  function removeAudienceDraftContact(contact: MarketingContact) {
    setAudienceDraft((draft) => updateAudienceDraftMemberIds(
      draft,
      parseAudienceMemberIds(draft).filter((id) => !contactMatchesMemberIds(contact, [id])),
    ));
  }

  function addAudienceEditContact(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;
    setAudienceEditDraft((draft) => draft ? updateAudienceDraftMemberIds(draft, [...parseAudienceMemberIds(draft), contactAudienceMemberId(contact)]) : draft);
  }

  function removeAudienceEditContact(contact: MarketingContact) {
    setAudienceEditDraft((draft) => draft ? updateAudienceDraftMemberIds(
      draft,
      parseAudienceMemberIds(draft).filter((id) => !contactMatchesMemberIds(contact, [id])),
    ) : draft);
  }

  async function saveAudienceEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingAudienceId || !audienceEditDraft) return;
    setAudienceFeedback("");
    if (!audienceEditDraft.name.trim()) {
      setAudienceFeedback("Audience name is required.");
      return;
    }
    let payload: ReturnType<typeof audiencePayloadFromDraft>;
    try {
      payload = audiencePayloadFromDraft(audienceEditDraft);
    } catch {
      setAudienceFeedback("Rules must be valid JSON.");
      return;
    }
    setAudienceSaving(true);
    setAudienceFeedback("Saving audience...");
    try {
      const result = await api<{ audience: MarketingAudience }>(`/api/admin/marketing/audiences/${editingAudienceId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setEditingAudienceId(result.audience.id);
      setAudienceEditDraft(audienceEditDraftFromAudience(result.audience));
      setAudienceFeedback("Audience updated.");
      setMessage("Audience updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Audience could not be updated.";
      setAudienceFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setAudienceSaving(false);
    }
  }

  async function deleteAudience(audience: MarketingAudience) {
    if (confirmingAudienceDeleteId !== audience.id) {
      setConfirmingAudienceDeleteId(audience.id);
      setAudienceFeedback(`Click Confirm delete to remove list "${audience.name}". Contacts will stay in marketing contacts.`);
      return;
    }
    setAudienceSaving(true);
    setAudienceFeedback("Deleting audience...");
    try {
      await api(`/api/admin/marketing/audiences/${audience.id}`, { method: "DELETE" });
      if (editingAudienceId === audience.id) cancelAudienceEdit();
      setConfirmingAudienceDeleteId(null);
      setAudienceFeedback("Audience deleted.");
      setMessage("Audience deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Audience could not be deleted.";
      setConfirmingAudienceDeleteId(null);
      setAudienceFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setAudienceSaving(false);
    }
  }

  async function runLovableSync() {
    setSyncFeedback("");
    setMessage("Running Lovable sync...");
    setSyncRunning(true);
    try {
      const result = await api<{ summary?: Record<string, unknown> }>("/api/admin/marketing/sync/lovable/run", { method: "POST" });
      const completionMessage = syncCompletionMessage(result.summary);
      await refreshAll();
      setMessage(completionMessage);
      setSyncFeedback(completionMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lovable sync failed.";
      setMessage(errorMessage);
      setSyncFeedback(errorMessage);
    } finally {
      setSyncRunning(false);
    }
  }

  async function previewLovableExport() {
    setExportPreviewFeedback("");
    setMessage("Checking Lovable export...");
    setExportPreviewRunning(true);
    try {
      const result = await api<LovableExportPreview>("/api/admin/marketing/sync/lovable/preview");
      const completionMessage = exportPreviewMessage(result.summary);
      setExportPreview(result);
      setExportPreviewFeedback(completionMessage);
      setMessage(completionMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lovable export preview failed.";
      setExportPreview(null);
      setExportPreviewFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setExportPreviewRunning(false);
    }
  }

  const syncBlockedReason = !syncState.configured
    ? "Set VYVA_MARKETING_EXPORT_TOKEN or LOVABLE_MARKETING_API_KEY before running a sync. The default Lovable export endpoint is already built in, and can be overridden with VYVA_MARKETING_EXPORT_URL."
    : syncState.canRunSync === false
      ? `Only the super admin${syncState.requiredRunnerEmail ? ` (${syncState.requiredRunnerEmail})` : ""} can run Lovable sync.`
      : "";
  const syncButtonDisabled = Boolean(syncBlockedReason) || syncRunning;
  const exportPreviewButtonDisabled = Boolean(syncBlockedReason) || exportPreviewRunning || syncRunning;
  const syncFeedbackText = syncFeedback || syncBlockedReason;
  const syncFeedbackIsError = Boolean(syncBlockedReason) || /fail|error|unauthorized|forbidden|not configured|only the super admin/i.test(syncFeedback);
  const exportPreviewFeedbackIsError = /fail|error|unauthorized|forbidden|not configured|only the super admin/i.test(exportPreviewFeedback);
  const emailScheduler = syncState.emailScheduler ?? summary.emailScheduler ?? emptySummary.emailScheduler ?? {
    enabled: false,
    intervalMinutes: 5,
    initialDelaySeconds: 30,
    actor: "marketing-email-scheduler",
  };
  const syncDiagnostics = syncState.diagnostics;
  const tokenAliasPresent = syncDiagnostics?.tokenAliasPresent ?? {};
  const urlAliasPresent = syncDiagnostics?.urlAliasPresent ?? {};
  const yesNo = (value: boolean | undefined) => value ? "yes" : "no";
  const testEmailDisabled = !editingCampaign || testEmailSending || !draftEmailChannel?.contentAssetId;
  const hasUnsavedCampaignSendChanges = Boolean(editingCampaign && (
    campaignEditDraft.name !== editingCampaign.name ||
    campaignEditDraft.audienceType !== editingCampaign.audienceType ||
    campaignEditDraft.status !== normalizeCampaignStatus(editingCampaign.status) ||
    campaignEditDraft.scheduleStartsAt !== toDateTimeLocal(editingCampaign.scheduleStartsAt) ||
    campaignEditDraft.scheduleEndsAt !== toDateTimeLocal(editingCampaign.scheduleEndsAt) ||
    campaignEditDraft.timezone !== (editingCampaign.timezone || "Europe/Madrid") ||
    campaignEditDraft.objective !== editingCampaign.objective ||
    campaignEditDraft.targetAudienceId !== (campaignTargetAudience(editingCampaign, audiences)?.id ?? "") ||
    campaignEditDraft.source !== (editingCampaign.source || "vyva") ||
    campaignEditDraft.lovableExternalId !== (editingCampaign.lovableExternalId ?? "") ||
    campaignEditDraft.metadataText !== jsonText(editingCampaign.metadata) ||
    !campaignChannelsMatch(campaignEditDraft, editingCampaign) ||
    campaignEditDraft.snapshotRecipients
  ));
  const campaignEmailDisabled = !editingCampaign || campaignEmailSending || hasUnsavedCampaignSendChanges || !draftEmailChannel?.contentAssetId || editingCampaign.recipientCount <= 0;
  const testEmailBlockedReason = !draftEmailChannel
    ? "Add an Email channel before sending a test."
    : !draftEmailChannel.contentAssetId
      ? "Attach an email content asset before sending a test."
      : "";
  const campaignEmailBlockedReason = !draftEmailChannel
    ? "Add an Email channel before sending this campaign."
    : hasUnsavedCampaignSendChanges
      ? "Save campaign changes before sending."
      : !draftEmailChannel.contentAssetId
      ? "Attach an email content asset before sending."
      : editingCampaign && editingCampaign.recipientCount <= 0
        ? "Save a recipient snapshot before sending."
        : "";
  const testEmailFeedbackIsError = Boolean(testEmailFeedback && /fail|error|could not|attach|only/i.test(testEmailFeedback));
  const testEmailPromptIsBlocked = Boolean(!testEmailFeedback && testEmailBlockedReason);
  const campaignEmailFeedbackIsError = Boolean(campaignEmailFeedback && /fail|error|could not|attach|only|no eligible/i.test(campaignEmailFeedback));
  const campaignEmailPromptIsBlocked = Boolean(!campaignEmailFeedback && campaignEmailBlockedReason);
  const journeyFeedbackIsError = Boolean(journeyFeedback && /fail|error|could not|required|valid json/i.test(journeyFeedback));
  const savedCampaignRecipients = editingCampaign?.recipients ?? [];
  const visibleSavedCampaignRecipients = savedCampaignRecipients.slice(0, 8);
  const selectedCampaignMetrics = editingCampaign
    ? campaignMetrics.filter((metric) => metric.campaignId === editingCampaign.id)
    : [];
  const selectedCampaignMetricTotals = sumMarketingMetrics(selectedCampaignMetrics);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Marketing"
          subtitle="Campaign planning, Lovable migration, audiences, content, schedules, and email dispatch through the existing VYVA provider stack."
        >
          <button className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-3 font-bold text-white" onClick={() => refreshAll().catch((error) => setMessage(error.message))}>
            <RefreshCw size={16} /> Refresh
          </button>
          {message && <span className="rounded-xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 grid gap-4">
          <div className="overflow-hidden rounded-[18px] border border-purple-200 bg-[#2f2135] text-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-200">Marketing engine foundation</p>
                <h2 className="mt-2 text-3xl font-black">Plan campaigns now. Send email safely.</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold text-white/70">This module absorbs Lovable marketing data and sends saved email campaign snapshots through VYVA. WhatsApp and social channels remain planning-only until their provider controls are ready.</p>
              </div>
              <Pill className="bg-white/10 text-white"><CheckCircle2 size={13} className="mr-1" /> Email enabled</Pill>
            </div>
          </div>

          <LockedSendPanel />

          <div className="rounded-[14px] border border-[#eadfd5] bg-white p-2 shadow-sm">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Marketing admin sections">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-black transition ${
                    activeTab === tab ? "bg-purple-700 text-white shadow-sm" : "text-[#5b4a46] hover:bg-[#fbf8f5] hover:text-purple-700"
                  }`}
                  data-testid={`tab-marketing-${tab}`}
                >
                  {tabLabel[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm xl:grid-cols-[1fr_180px_180px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b7a73]" aria-hidden="true" />
              <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns, journeys, content, contacts, lists, or media" data-testid="input-marketing-search" />
            </label>
            <select className={inputClass} value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as Channel | "all")} aria-label="Channel filter">
              <option value="all">All channels</option>
              {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
            </select>
            <select className={inputClass} value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value as Audience | "all")} aria-label="Audience filter">
              <option value="all">All audiences</option>
              {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
            </select>
          </div>

          {activeTab === "dashboard" && (
            <div className="grid gap-4" data-testid="marketing-dashboard-tab">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Total campaigns" value={summary.totals.campaigns} icon={Megaphone} />
                <MetricCard label="Audiences" value={summary.totals.audiences} icon={UsersRound} />
                <MetricCard label="This week" value={summary.totals.thisWeek} icon={CalendarDays} />
                <MetricCard label="Scheduled" value={summary.totals.scheduled} icon={Clock} />
                <MetricCard label="Published" value={summary.totals.published} icon={CheckCircle2} />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Imported media refs" value={summary.totals.mediaAssets ?? mediaAssets.length} icon={ImageIcon} />
                <MetricCard label="Journey enrollments" value={summary.totals.journeyEnrollments ?? journeyEnrollments.length} icon={Activity} />
                <MetricCard label="Email/social sends tracked" value={analyticsTotals.sent} icon={BarChart3} />
                <MetricCard label="Clicks tracked" value={analyticsTotals.clicked} icon={CheckCircle2} />
              </div>

              <LovableImportCoveragePanel
                run={latestSyncRun}
                onOpenSettings={() => setActiveTab("settings")}
              />

              <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
                <SectionCard title="By channel" subtitle="Planning coverage across campaign channels.">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {summary.byChannel.map((item) => (
                      <div key={item.channel} className={`rounded-xl border p-3 ${channelClass(item.channel)}`}>
                        <p className="font-black">{channelLabel[item.channel]}</p>
                        <p className="mt-2 text-2xl font-black">{item.campaigns}</p>
                        <p className="text-xs font-bold opacity-80">campaign routes / {item.content} content assets</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="By audience" subtitle="B2C, B2B, and combined campaigns.">
                  <div className="grid gap-3">
                    {summary.byAudience.map((item) => (
                      <div key={item.audienceType} className="flex items-center justify-between rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <div>
                          <p className="font-black">{item.audienceType.toUpperCase()}</p>
                          <p className="text-xs font-bold text-[#8b7a73]">{item.campaigns} campaigns / {item.contacts} contacts</p>
                        </div>
                        <span className="text-sm font-black text-[#8b7a73]">Audience</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="Analytics snapshots" subtitle={`${campaignMetrics.length} imported performance rows from Lovable or future providers.`}>
                {campaignMetrics.length === 0 ? (
                  <EmptyState text="No campaign analytics imported yet." />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#eadfd5]" data-testid="marketing-analytics-table">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                        <tr>
                          <th className="px-4 py-3">Campaign</th>
                          <th className="px-4 py-3">Channel</th>
                          <th className="px-4 py-3">Sent</th>
                          <th className="px-4 py-3">Delivered</th>
                          <th className="px-4 py-3">Opened</th>
                          <th className="px-4 py-3">Clicked</th>
                          <th className="px-4 py-3">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignMetrics.slice(0, 8).map((metric) => (
                          <tr key={metric.id} className="border-t border-[#f0e7df]">
                            <td className="px-4 py-3 font-black">{metric.campaignName || metric.lovableExternalId || "Unlinked campaign"}</td>
                            <td className="px-4 py-3 font-bold">{metric.channel}</td>
                            <td className="px-4 py-3 font-bold">{metric.sent}</td>
                            <td className="px-4 py-3 font-bold">{metric.delivered}</td>
                            <td className="px-4 py-3 font-bold">{metric.opened}</td>
                            <td className="px-4 py-3 font-bold">{metric.clicked}</td>
                            <td className="px-4 py-3 font-bold">{metric.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Campaign planner" subtitle="Create draft or scheduled campaigns, choose imported content, and optionally snapshot eligible recipients. Email sending remains a separate explicit action.">
                <form className="grid gap-3" onSubmit={(event) => createCampaign(event).catch((error) => setMessage(error.message))}>
                  <div className="grid gap-3 xl:grid-cols-[1fr_130px_140px_1fr_180px_180px_auto]">
                    <Field label="Campaign name">
                      <input className={inputClass} value={campaignDraft.name} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Summer caregiver onboarding" data-testid="input-marketing-campaign-name" />
                    </Field>
                    <Field label="Audience">
                      <select className={inputClass} value={campaignDraft.audienceType} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, audienceType: event.target.value as Audience }))} data-testid="select-marketing-campaign-audience">
                        {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                      </select>
                    </Field>
                    <Field label="Channel">
                      <select
                        className={inputClass}
                        value={campaignDraft.channel}
                        onChange={(event) => setCampaignDraft((draft) => ({ ...draft, channel: event.target.value as Channel, contentAssetId: "" }))}
                        data-testid="select-marketing-campaign-channel"
                      >
                        {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                      </select>
                    </Field>
                    <Field label="Content asset">
                      <select className={inputClass} value={campaignDraft.contentAssetId} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, contentAssetId: event.target.value }))} data-testid="select-marketing-campaign-content">
                        <option value="">No content asset</option>
                        {campaignDraftContentOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                      </select>
                    </Field>
                    <Field label="Starts">
                      <input className={inputClass} type="datetime-local" value={campaignDraft.scheduleStartsAt} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, scheduleStartsAt: event.target.value, status: event.target.value ? "scheduled" : "draft" }))} data-testid="input-marketing-campaign-schedule" />
                    </Field>
                    <Field label="Ends">
                      <input className={inputClass} type="datetime-local" value={campaignDraft.scheduleEndsAt} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, scheduleEndsAt: event.target.value }))} data-testid="input-marketing-campaign-schedule-end" />
                    </Field>
                    <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" type="submit" disabled={campaignSaving} data-testid="button-marketing-create-campaign">
                      <Plus size={16} /> {campaignSaving ? "Creating..." : "Add campaign"}
                    </button>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto_160px]">
                    <Field label="Target list">
                      <select className={inputClass} value={campaignDraft.targetAudienceId} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, targetAudienceId: event.target.value }))} data-testid="select-marketing-campaign-target-audience">
                        <option value="">All eligible contacts</option>
                        {audiences.map((audience) => (
                          <option key={audience.id} value={audience.id}>
                            {audience.name} ({audience.mappedMemberCount}/{audience.memberCount} mapped)
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Recipient filter">
                      <input className={inputClass} value={campaignDraft.recipientFilter} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, recipientFilter: event.target.value }))} placeholder="Optional name, company, tag..." data-testid="input-marketing-campaign-recipient-filter" />
                    </Field>
                    <label className="mt-6 flex min-h-11 items-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 text-sm font-black text-[#241133]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-purple-700"
                        checked={campaignDraft.snapshotRecipients}
                        onChange={(event) => setCampaignDraft((draft) => ({ ...draft, snapshotRecipients: event.target.checked }))}
                        data-testid="checkbox-marketing-campaign-snapshot"
                      />
                      Snapshot now
                    </label>
                    <div className="rounded-xl border border-purple-100 bg-white p-3" data-testid="marketing-campaign-draft-recipient-preview">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Recipients</p>
                      <p className="mt-1 text-2xl font-black text-[#241133]">{campaignDraft.snapshotRecipients ? campaignDraftRecipientPreview.length : "-"}</p>
                    </div>
                  </div>
                  {selectedCampaignDraftTargetAudience ? (
                    <p className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-xs font-bold text-[#7d6b65]" data-testid="marketing-campaign-draft-target-audience-summary">
                      {selectedCampaignDraftTargetAudience.name}: {selectedCampaignDraftTargetAudience.mappedMemberCount} mapped / {selectedCampaignDraftTargetAudience.unmappedContactExternalIds.length} unmapped contacts.
                    </p>
                  ) : null}
                  <textarea className={textareaClass} value={campaignDraft.objective} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, objective: event.target.value }))} placeholder="Objective or internal notes" />
                </form>
              </SectionCard>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
                <SectionCard title="Campaign list" subtitle={`${visibleCampaigns.length} visible of ${campaigns.length} campaigns. Click a campaign to open full details.`}>
                  <CampaignTable
                    campaigns={visibleCampaigns}
                    activeCampaignId={editingCampaignId}
                    onEdit={startCampaignEdit}
                    onDelete={(campaign) => deleteCampaign(campaign).catch((error) => setMessage(error.message))}
                    actionsDisabled={campaignSaving}
                    confirmingDeleteId={confirmingCampaignDeleteId}
                  />
                </SectionCard>

                <SectionCard
                  title="Campaign details"
                  subtitle={editingCampaign ? "Edit metadata, channel content, schedule, and recipient snapshots." : "Select a campaign from the list to edit it."}
                  action={editingCampaign ? (
                    campaignEditDraft.channel === "email" ? <Pill className="bg-emerald-50 text-emerald-800">Email enabled</Pill> : <Pill className="bg-amber-50 text-amber-800">Planning only</Pill>
                  ) : null}
                >
                  {editingCampaign ? (
                    <form className="grid gap-4" onSubmit={(event) => saveCampaignEdit(event, editingCampaign.id).catch((error) => setMessage(error.message))} data-testid="marketing-campaign-edit-form">
                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="marketing-campaign-detail-panel">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Selected campaign</p>
                            <h3 className="mt-1 text-lg font-black text-[#241133]">{editingCampaign.name}</h3>
                            <p className="mt-1 text-sm font-bold text-[#7d6b65]">{editingCampaign.objective || "No objective yet."}</p>
                          </div>
                          <Pill className={statusClass(editingCampaign.status)}>{editingCampaign.status}</Pill>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-[#7d6b65]">
                          <div className="rounded-lg bg-white p-2">
                            <p className="uppercase tracking-[0.12em]">Source</p>
                            <p className="mt-1 text-[#241133]">{editingCampaign.source}</p>
                          </div>
                          <div className="rounded-lg bg-white p-2">
                            <p className="uppercase tracking-[0.12em]">Schedule</p>
                            <p className="mt-1 text-[#241133]">{formatDate(editingCampaign.scheduleStartsAt)}</p>
                            {editingCampaign.scheduleEndsAt ? (
                              <p className="mt-1 text-[#7d6b65]">Ends {formatDate(editingCampaign.scheduleEndsAt)}</p>
                            ) : null}
                          </div>
                          <div className="rounded-lg bg-white p-2">
                            <p className="uppercase tracking-[0.12em]">Timezone</p>
                            <p className="mt-1 text-[#241133]">{editingCampaign.timezone}</p>
                          </div>
                          <div className="rounded-lg bg-white p-2">
                            <p className="uppercase tracking-[0.12em]">Recipients</p>
                            <p className="mt-1 text-[#241133]">{editingCampaign.recipientCount}</p>
                          </div>
                        </div>
                        {editingCampaign.lovableExternalId ? (
                          <p className="mt-3 break-all rounded-lg bg-white p-2 text-xs font-bold text-[#7d6b65]">Lovable ID: {editingCampaign.lovableExternalId}</p>
                        ) : null}
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <Field label="Source">
                          <input className={inputClass} value={campaignEditDraft.source} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, source: event.target.value }))} data-testid="input-marketing-edit-campaign-source" />
                        </Field>
                        <Field label="Lovable ID">
                          <input className={inputClass} value={campaignEditDraft.lovableExternalId} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, lovableExternalId: event.target.value }))} data-testid="input-marketing-edit-campaign-lovable-id" />
                        </Field>
                      </div>
                      <Field label="Campaign metadata JSON">
                        <textarea className={`${textareaClass} min-h-[150px] font-mono text-xs`} value={campaignEditDraft.metadataText} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, metadataText: event.target.value }))} data-testid="textarea-marketing-edit-campaign-metadata" />
                      </Field>

                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="marketing-campaign-performance-panel">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#241133]">Performance</p>
                            <p className="text-xs font-bold text-[#8b7a73]">{selectedCampaignMetrics.length} imported metric rows linked to this campaign.</p>
                          </div>
                          <Pill className="bg-blue-50 text-blue-800">{selectedCampaignMetricTotals.sent} sent</Pill>
                        </div>
                        {selectedCampaignMetrics.length === 0 ? (
                          <p className="mt-3 rounded-lg bg-white p-3 text-sm font-bold text-[#8b7a73]">No performance metrics imported for this campaign yet.</p>
                        ) : (
                          <div className="mt-3 grid gap-3">
                            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-[#7d6b65] xl:grid-cols-4">
                              <div className="rounded-lg bg-white p-2">
                                <p className="uppercase tracking-[0.12em]">Delivered</p>
                                <p className="mt-1 text-lg font-black text-[#241133]">{selectedCampaignMetricTotals.delivered}</p>
                              </div>
                              <div className="rounded-lg bg-white p-2">
                                <p className="uppercase tracking-[0.12em]">Opened</p>
                                <p className="mt-1 text-lg font-black text-[#241133]">{selectedCampaignMetricTotals.opened}</p>
                              </div>
                              <div className="rounded-lg bg-white p-2">
                                <p className="uppercase tracking-[0.12em]">Clicked</p>
                                <p className="mt-1 text-lg font-black text-[#241133]">{selectedCampaignMetricTotals.clicked}</p>
                              </div>
                              <div className="rounded-lg bg-white p-2">
                                <p className="uppercase tracking-[0.12em]">Replies</p>
                                <p className="mt-1 text-lg font-black text-[#241133]">{selectedCampaignMetricTotals.replied}</p>
                              </div>
                            </div>
                            <div className="grid gap-2">
                              {selectedCampaignMetrics.slice(0, 4).map((metric) => (
                                <div key={metric.id} className="grid gap-2 rounded-lg bg-white p-2 text-xs font-bold text-[#7d6b65]">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>{formatDate(metric.metricDate)} / {metric.channel} / {metric.source}</span>
                                    <span>{metric.delivered} delivered, {metric.clicked} clicked</span>
                                  </div>
                                  <MetadataPanel title="Imported metric metadata" value={metric.metadata} testId={`marketing-campaign-metric-metadata-${metric.id}`} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3">
                        <Field label="Campaign name">
                          <input className={inputClass} value={campaignEditDraft.name} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, name: event.target.value }))} data-testid="input-marketing-edit-campaign-name" />
                        </Field>
                        <div className="grid gap-3 xl:grid-cols-2">
                          <Field label="Audience">
                            <select className={inputClass} value={campaignEditDraft.audienceType} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, audienceType: event.target.value as Audience }))} data-testid="select-marketing-edit-campaign-audience">
                              {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                            </select>
                          </Field>
                          <Field label="Status">
                            <select className={inputClass} value={campaignEditDraft.status} onChange={(event) => {
                              const status = event.target.value as CampaignStatus;
                              setCampaignEditDraft((draft) => {
                                const channels = campaignChannelsWithPrimary(draft);
                                return {
                                  ...draft,
                                  status,
                                  channels: channels.map((channel, index) => index === 0 ? { ...channel, status } : channel),
                                };
                              });
                            }} data-testid="select-marketing-edit-campaign-status">
                              {CAMPAIGN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </Field>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-2">
                          <Field label="Primary/send channel">
                            <select className={inputClass} value={campaignEditDraft.channel} onChange={(event) => {
                              const channel = event.target.value as Channel;
                              setCampaignEditDraft((draft) => {
                                const channels = campaignChannelsWithPrimary(draft);
                                const selectedContent = draft.contentAssetId ? content.find((item) => item.id === draft.contentAssetId) ?? null : null;
                                const firstContentAssetId = selectedContent?.channel === channel ? draft.contentAssetId : "";
                                return {
                                  ...draft,
                                  channel,
                                  contentAssetId: firstContentAssetId,
                                  channels: [
                                    { ...(channels[0] ?? newCampaignChannelDraft()), channel, contentAssetId: firstContentAssetId },
                                    ...channels.slice(1),
                                  ],
                                };
                              });
                            }} data-testid="select-marketing-edit-campaign-channel">
                              {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                            </select>
                          </Field>
                          <Field label="Primary content asset">
                            <select
                              className={inputClass}
                              value={campaignEditDraft.contentAssetId}
                              onChange={(event) => {
                                const contentAssetId = event.target.value;
                                setCampaignEditDraft((draft) => {
                                  const channels = campaignChannelsWithPrimary(draft);
                                  return {
                                    ...draft,
                                    contentAssetId,
                                    channels: channels.map((channel, index) => index === 0 ? { ...channel, contentAssetId } : channel),
                                  };
                                });
                              }}
                              data-testid="select-marketing-edit-campaign-content"
                            >
                              <option value="">Select {channelLabel[campaignEditDraft.channel]} content</option>
                              {campaignEditPrimaryContentOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                            </select>
                          </Field>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-3">
                          <Field label="Starts">
                            <input className={inputClass} type="datetime-local" value={campaignEditDraft.scheduleStartsAt} onChange={(event) => {
                              const scheduleStartsAt = event.target.value;
                              setCampaignEditDraft((draft) => {
                                const channels = campaignChannelsWithPrimary(draft);
                                return {
                                  ...draft,
                                  scheduleStartsAt,
                                  channels: channels.map((channel, index) => index === 0 ? { ...channel, scheduledAt: scheduleStartsAt } : channel),
                                };
                              });
                            }} data-testid="input-marketing-edit-campaign-schedule" />
                          </Field>
                          <Field label="Ends">
                            <input className={inputClass} type="datetime-local" value={campaignEditDraft.scheduleEndsAt} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, scheduleEndsAt: event.target.value }))} data-testid="input-marketing-edit-campaign-schedule-end" />
                          </Field>
                          <Field label="Timezone">
                            <input className={inputClass} value={campaignEditDraft.timezone} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, timezone: event.target.value }))} data-testid="input-marketing-edit-campaign-timezone" />
                          </Field>
                        </div>
                        <Field label="Objective">
                          <textarea className={textareaClass} value={campaignEditDraft.objective} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, objective: event.target.value }))} data-testid="input-marketing-edit-campaign-objective" />
                        </Field>
                        <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
                          <Field label="Target list">
                            <select
                              className={inputClass}
                              value={campaignEditDraft.targetAudienceId}
                              onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, targetAudienceId: event.target.value }))}
                              data-testid="select-marketing-edit-campaign-target-audience"
                            >
                              <option value="">All eligible contacts</option>
                              {audiences.map((audience) => (
                                <option key={audience.id} value={audience.id}>
                                  {audience.name} ({audience.mappedMemberCount}/{audience.memberCount} mapped)
                                </option>
                              ))}
                            </select>
                          </Field>
                          {selectedCampaignTargetAudience ? (
                            <div className="rounded-xl border border-purple-100 bg-white p-3 text-xs font-bold text-[#7d6b65]" data-testid="marketing-campaign-target-audience-summary">
                              <span className="text-[#241133]">{selectedCampaignTargetAudience.name}</span>
                              {" "}is a {selectedCampaignTargetAudience.source} {selectedCampaignTargetAudience.listType} list with {selectedCampaignTargetAudience.mappedMemberCount} mapped and {selectedCampaignTargetAudience.unmappedContactExternalIds.length} unmapped contacts.
                            </div>
                          ) : (
                            <div className="rounded-xl border border-[#eadfd5] bg-white p-3 text-xs font-bold text-[#8b7a73]">No imported list selected. Recipient snapshots will use all eligible contacts.</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="marketing-campaign-channels-editor">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#241133]">Campaign channels</p>
                            <p className="text-xs font-bold text-[#8b7a73]">Imported Lovable channels stay here. Email can send; social channels remain planning/tracking rows.</p>
                          </div>
                          <button type="button" onClick={addCampaignChannel} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-purple-700 px-3 text-xs font-black text-white" data-testid="button-marketing-add-campaign-channel">
                            <Plus size={14} /> Add channel
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {campaignChannelsWithPrimary(campaignEditDraft).map((channelDraft, index) => {
                            const channelContentAssets = content.filter((item) => item.channel === channelDraft.channel && item.status !== "archived");
                            const selectedChannelContent = channelDraft.contentAssetId ? content.find((item) => item.id === channelDraft.contentAssetId) : null;
                            const selectedChannelMediaAssets = selectedChannelContent ? mediaAssets.filter((item) => item.contentAssetId === selectedChannelContent.id) : [];
                            const options = selectedChannelContent && !channelContentAssets.some((item) => item.id === selectedChannelContent.id)
                              ? [selectedChannelContent, ...channelContentAssets]
                              : channelContentAssets;
                            return (
                              <div key={channelDraft.id} className="grid gap-3 rounded-xl border border-[#eadfd5] bg-white p-3" data-testid={`marketing-campaign-channel-row-${index}`}>
                                <div className="grid gap-3 xl:grid-cols-[150px_1fr_130px_190px_auto]">
                                  <Field label={index === 0 ? "Primary channel" : "Channel"}>
                                    <select
                                      className={inputClass}
                                      value={channelDraft.channel}
                                      onChange={(event) => updateCampaignChannel(channelDraft.id, { channel: event.target.value as Channel })}
                                      data-testid={`select-marketing-campaign-channel-${index}`}
                                    >
                                      {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="Content asset">
                                    <select
                                      className={inputClass}
                                      value={channelDraft.contentAssetId}
                                      onChange={(event) => updateCampaignChannel(channelDraft.id, { contentAssetId: event.target.value })}
                                      data-testid={`select-marketing-campaign-channel-content-${index}`}
                                    >
                                      <option value="">No content asset</option>
                                      {options.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="Status">
                                    <select className={inputClass} value={channelDraft.status} onChange={(event) => updateCampaignChannel(channelDraft.id, { status: event.target.value as CampaignStatus })} data-testid={`select-marketing-campaign-channel-status-${index}`}>
                                      {CAMPAIGN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="Scheduled at">
                                    <input className={inputClass} type="datetime-local" value={channelDraft.scheduledAt} onChange={(event) => updateCampaignChannel(channelDraft.id, { scheduledAt: event.target.value })} data-testid={`input-marketing-campaign-channel-schedule-${index}`} />
                                  </Field>
                                  <div className="flex items-end">
                                    <button type="button" onClick={() => removeCampaignChannel(channelDraft.id)} disabled={campaignChannelsWithPrimary(campaignEditDraft).length <= 1} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:bg-[#f5eee8] disabled:text-red-300" data-testid={`button-marketing-remove-campaign-channel-${index}`}>
                                      <Trash2 size={13} /> Remove
                                    </button>
                                  </div>
                                </div>
                                <LinkedContentPreview contentAsset={selectedChannelContent ?? null} linkedMediaAssets={selectedChannelMediaAssets} testId={`marketing-campaign-channel-content-preview-${index}`} />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#241133]">Saved recipients</p>
                            <p className="text-xs font-bold text-[#8b7a73]">{editingCampaign.recipientCount} recipients are currently snapshotted for this campaign.</p>
                          </div>
                          <Pill className="bg-purple-50 text-purple-800">{savedCampaignRecipients.length > 0 ? `${savedCampaignRecipients.length} shown` : "None saved"}</Pill>
                        </div>
                        {visibleSavedCampaignRecipients.length === 0 ? (
                          <p className="mt-3 rounded-lg bg-white p-3 text-sm font-bold text-[#8b7a73]">No recipient snapshot saved yet.</p>
                        ) : (
                          <div className="mt-3 grid gap-2">
                            {visibleSavedCampaignRecipients.map((recipient) => (
                              <div key={recipient.id} className="grid gap-2 rounded-lg bg-white p-2 text-sm font-bold">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="truncate text-[#241133]">{recipientSnapshotLabel(recipient)}</span>
                                  <Pill className={channelClass(recipient.channel)}>{recipient.status}</Pill>
                                </div>
                                <MetadataPanel title="Saved recipient snapshot" value={recordValue(recipient.snapshot)} testId={`marketing-campaign-recipient-snapshot-${recipient.id}`} />
                              </div>
                            ))}
                            {editingCampaign.recipientCount > visibleSavedCampaignRecipients.length ? (
                              <p className="text-xs font-bold text-[#8b7a73]">+{editingCampaign.recipientCount - visibleSavedCampaignRecipients.length} more saved recipients.</p>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <label className="flex flex-wrap items-center gap-3 text-sm font-black">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-purple-700"
                            checked={campaignEditDraft.snapshotRecipients}
                            onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, snapshotRecipients: event.target.checked }))}
                            data-testid="checkbox-marketing-edit-campaign-snapshot"
                          />
                          Replace saved recipients with a fresh Contacts snapshot
                        </label>
                        <p className="mt-1 text-xs font-bold text-[#8b7a73]">This stores planned recipients only. Sending is a separate explicit action.</p>
                        <p className="mt-1 text-xs font-bold text-[#8b7a73]">Email recipients can be sent after saving this snapshot. WhatsApp and social channels remain locked.</p>
                        {campaignEditDraft.snapshotRecipients ? (
                          <div className="mt-3 grid gap-3">
                            <Field label="Recipient filter">
                              <input className={inputClass} value={campaignEditDraft.recipientFilter} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, recipientFilter: event.target.value }))} placeholder="Filter by name, company, tag, market, list..." data-testid="input-marketing-edit-campaign-recipient-filter" />
                            </Field>
                            <div className="rounded-xl border border-purple-100 bg-white p-3" data-testid="marketing-campaign-recipient-preview">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Preview</p>
                              <p className="mt-1 text-2xl font-black text-[#241133]">{campaignRecipientPreview.length}</p>
                              <p className="text-xs font-bold text-[#8b7a73]">eligible planned recipients</p>
                            </div>
                            {campaignRecipientPreview.length === 0 ? (
                              <EmptyState text="No eligible contacts match this audience, channel, and filter." />
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {campaignRecipientPreview.slice(0, 12).map((contact) => (
                                  <Pill key={contact.id} className="bg-purple-50 text-purple-800">{contact.fullName || contact.email || contact.phoneNumber || contact.id}</Pill>
                                ))}
                                {campaignRecipientPreview.length > 12 ? <Pill className="bg-[#f5eee8] text-[#7d6b65]">+{campaignRecipientPreview.length - 12} more</Pill> : null}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-2">
                        <button type="submit" disabled={campaignSaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" data-testid="button-marketing-save-campaign">
                          <Save size={15} /> {campaignSaving ? "Saving..." : "Save campaign"}
                        </button>
                        <button
                          type="button"
                          disabled={testEmailDisabled}
                          onClick={() => editingCampaign ? void sendTestCampaignEmail(editingCampaign.id) : undefined}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                          data-testid="button-marketing-send-test-email"
                        >
                          <Send size={15} /> {testEmailSending ? "Sending test..." : "Send test email to me"}
                        </button>
                        <button
                          type="button"
                          disabled={campaignEmailDisabled}
                          onClick={() => editingCampaign ? void sendCampaignEmails(editingCampaign) : undefined}
                          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8] ${confirmingCampaignSendId === editingCampaign.id ? "bg-red-700" : "bg-purple-700"}`}
                          data-testid="button-marketing-send-campaign-email"
                        >
                          <Send size={15} /> {campaignEmailSending ? "Sending campaign..." : confirmingCampaignSendId === editingCampaign.id ? "Confirm send emails" : "Send campaign emails"}
                        </button>
                        <button type="button" onClick={cancelCampaignEdit} disabled={campaignSaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#2f2135] disabled:cursor-not-allowed disabled:text-[#9d8b9d]" data-testid="button-marketing-cancel-campaign">
                          <X size={15} /> Close details
                        </button>
                      </div>
                      {campaignEmailFeedback || campaignEmailBlockedReason ? (
                        <p
                          className={`rounded-xl px-4 py-3 text-sm font-bold ${campaignEmailFeedbackIsError ? "bg-red-50 text-red-800" : campaignEmailPromptIsBlocked ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
                          data-testid="marketing-campaign-email-feedback"
                        >
                          {campaignEmailFeedback || campaignEmailBlockedReason}
                        </p>
                      ) : null}
                      {testEmailFeedback || testEmailBlockedReason || selectedEmailContent ? (
                        <p
                          className={`rounded-xl px-4 py-3 text-sm font-bold ${testEmailFeedbackIsError ? "bg-red-50 text-red-800" : testEmailPromptIsBlocked ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
                          data-testid="marketing-test-email-feedback"
                        >
                          {testEmailFeedback || testEmailBlockedReason || `Ready to send a test using "${selectedEmailContent?.title}".`}
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <EmptyState text="No campaign selected." />
                  )}
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === "journeys" && (
            <div className="grid gap-4" data-testid="marketing-journeys-tab">
              <SectionCard
                title="Journeys"
                subtitle={`${visibleJourneys.length} visible of ${journeys.length} journeys in the planning foundation.`}
                action={(
                  <button
                    type="button"
                    onClick={startNewJourney}
                    disabled={journeySaving}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                    data-testid="button-marketing-new-journey"
                  >
                    <Plus size={15} /> New journey
                  </button>
                )}
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.35fr)]">
                  <div className="grid content-start gap-3">
                    {visibleJourneys.length === 0 ? <EmptyState text="No journeys match the filters." /> : visibleJourneys.map((journey) => {
                      const isActive = editingJourneyId === journey.id;
                      const journeyAudience = journeyTargetAudience(journey, audiences);
                      const journeyAudienceReference = journeyAudienceReferenceFromConfig(journey.triggerConfig);
                      return (
                        <article key={journey.id} className={`rounded-xl border p-4 ${isActive ? "border-purple-300 bg-purple-50" : "border-[#eadfd5] bg-[#fffaf4]"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-black">{journey.name}</h3>
                              <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{journey.objective || "No objective yet."}</p>
                              {journey.source === "lovable" ? <p className="mt-1 text-xs font-bold text-[#8b7a73]">Lovable source can reimport this after sync.</p> : null}
                              <p className="mt-1 text-xs font-bold text-[#7d6b65]">{activeEnrollmentsByJourneyId.get(journey.id) ?? 0} active / {enrollmentsByJourneyId.get(journey.id) ?? 0} total enrollments</p>
                              {(journey.triggerType || journey.goalType || journeyAudience || journeyAudienceReference) ? (
                                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-black" data-testid={`marketing-journey-logic-${journey.id}`}>
                                  {journey.triggerType ? <Pill className="bg-blue-50 text-blue-800">Trigger: {journey.triggerType}</Pill> : null}
                                  {journeyAudience || journeyAudienceReference ? <Pill className="bg-violet-50 text-violet-800">List: {journeyAudience?.name ?? journeyAudienceReference}</Pill> : null}
                                  {journey.goalType ? <Pill className="bg-emerald-50 text-emerald-800">Goal: {journey.goalType}</Pill> : null}
                                  <Pill className={journey.exitOnGoal ? "bg-purple-50 text-purple-800" : "bg-amber-50 text-amber-800"}>{journey.exitOnGoal ? "Exit on goal" : "Continue after goal"}</Pill>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Pill className={statusClass(journey.status)}>{journey.status}</Pill>
                              <Pill className="bg-purple-50 text-purple-700">{journey.audienceType.toUpperCase()}</Pill>
                              <button type="button" onClick={() => startJourneyEdit(journey)} disabled={journeySaving} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]" data-testid={`button-marketing-edit-journey-${journey.id}`}>
                                <Pencil size={14} /> Edit
                              </button>
                              <button type="button" onClick={() => deleteJourney(journey)} disabled={journeySaving} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:text-red-300" data-testid={`button-marketing-delete-journey-${journey.id}`}>
                                <Trash2 size={14} /> {confirmingJourneyDeleteId === journey.id ? "Confirm delete" : "Delete"}
                              </button>
                              {confirmingJourneyDeleteId === journey.id ? (
                                <p className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800" data-testid={`marketing-journey-delete-confirmation-${journey.id}`}>
                                  Click Confirm delete to remove this journey and its steps.
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {journey.steps.length === 0 ? <span className="text-sm font-bold text-[#8b7a73]">No steps yet.</span> : journey.steps.map((step) => (
                              <span key={step.id} className={`rounded-full border px-3 py-1 text-xs font-black ${channelClass(step.channel)}`}>
                                {step.stepOrder + 1}. {step.kind || "message"} / {channelLabel[step.channel]} / day {step.dayOffset ?? Math.floor(step.delayHours / 24)}
                                {step.templateRef ? ` / ${step.templateRef}` : ""}
                              </span>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {editingJourneyId ? (
                    <form
                      className="grid content-start gap-4 rounded-xl border border-[#eadfd5] bg-white p-4"
                      onSubmit={saveJourneyEdit}
                      data-testid="marketing-journey-editor-form"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-[#241133]">{editingJourneyId === "new" ? "New journey" : "Journey details"}</h3>
                          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">Build the sequence first. Sending remains controlled elsewhere.</p>
                        </div>
                        {editingJourney ? <Pill className={statusClass(editingJourney.status)}>{editingJourney.status}</Pill> : <Pill className="bg-amber-50 text-amber-800">draft</Pill>}
                      </div>

                      <div className="grid gap-3 xl:grid-cols-[1fr_140px_140px_240px]">
                        <Field label="Journey name">
                          <input className={inputClass} value={journeyEditDraft.name} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Caregiver onboarding sequence" disabled={journeySaving} data-testid="input-marketing-edit-journey-name" />
                        </Field>
                        <Field label="Audience">
                          <select className={inputClass} value={journeyEditDraft.audienceType} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, audienceType: event.target.value as Audience }))} disabled={journeySaving} data-testid="select-marketing-edit-journey-audience">
                            {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                          </select>
                        </Field>
                        <Field label="Status">
                          <select className={inputClass} value={journeyEditDraft.status} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, status: event.target.value as JourneyStatus }))} disabled={journeySaving} data-testid="select-marketing-edit-journey-status">
                            {JOURNEY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </Field>
                        <Field label="Target list">
                          <select className={inputClass} value={journeyEditDraft.targetAudienceId} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, targetAudienceId: event.target.value }))} disabled={journeySaving} data-testid="select-marketing-edit-journey-target-audience">
                            <option value="">No specific list</option>
                            {audiences.map((audience) => (
                              <option key={audience.id} value={audience.id}>{audience.name}</option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-4 py-3 text-sm font-bold text-[#6b5b54]" data-testid="marketing-journey-target-audience-summary">
                        {selectedJourneyTargetAudience ? (
                          <span>
                            {selectedJourneyTargetAudience.name}: {selectedJourneyTargetAudience.mappedMemberCount} mapped of {selectedJourneyTargetAudience.memberCount} members
                            {selectedJourneyTargetAudience.unmappedContactExternalIds.length ? `, ${selectedJourneyTargetAudience.unmappedContactExternalIds.length} unmapped` : ""}. Source {selectedJourneyTargetAudience.source}.
                          </span>
                        ) : (
                          <span>No target list selected. This journey can still use event trigger JSON.</span>
                        )}
                      </div>

                      <Field label="Objective / notes">
                        <textarea className={textareaClass} value={journeyEditDraft.objective} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, objective: event.target.value }))} disabled={journeySaving} data-testid="textarea-marketing-edit-journey-objective" />
                      </Field>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <Field label="Source">
                          <input className={inputClass} value={journeyEditDraft.source} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, source: event.target.value }))} disabled={journeySaving} data-testid="input-marketing-edit-journey-source" />
                        </Field>
                        <Field label="Lovable ID">
                          <input className={inputClass} value={journeyEditDraft.lovableExternalId} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, lovableExternalId: event.target.value }))} disabled={journeySaving} data-testid="input-marketing-edit-journey-lovable-id" />
                        </Field>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <Field label="Trigger type">
                          <input className={inputClass} value={journeyEditDraft.triggerType} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, triggerType: event.target.value }))} placeholder="signup, list_joined, date..." disabled={journeySaving} data-testid="input-marketing-edit-journey-trigger" />
                        </Field>
                        <Field label="Goal type">
                          <input className={inputClass} value={journeyEditDraft.goalType} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, goalType: event.target.value }))} placeholder="activation, reply, conversion..." disabled={journeySaving} data-testid="input-marketing-edit-journey-goal" />
                        </Field>
                        <Field label="Trigger config JSON">
                          <textarea className={`${textareaClass} min-h-[76px]`} value={journeyEditDraft.triggerConfigText} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, triggerConfigText: event.target.value }))} placeholder="{ }" disabled={journeySaving} data-testid="textarea-marketing-edit-journey-trigger-config" />
                        </Field>
                        <Field label="Goal config JSON">
                          <textarea className={`${textareaClass} min-h-[76px]`} value={journeyEditDraft.goalConfigText} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, goalConfigText: event.target.value }))} placeholder="{ }" disabled={journeySaving} data-testid="textarea-marketing-edit-journey-goal-config" />
                        </Field>
                      </div>

                      <label className="flex items-center gap-3 rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-4 py-3 text-sm font-black text-[#2f2135]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-purple-700"
                          checked={journeyEditDraft.exitOnGoal}
                          onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, exitOnGoal: event.target.checked }))}
                          disabled={journeySaving}
                          data-testid="checkbox-marketing-edit-journey-exit-on-goal"
                        />
                        Exit this journey when the goal is reached
                      </label>

                      <Field label="Journey metadata JSON">
                        <textarea className={`${textareaClass} min-h-[130px] font-mono text-xs`} value={journeyEditDraft.metadataText} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, metadataText: event.target.value }))} placeholder="{ }" disabled={journeySaving} data-testid="textarea-marketing-edit-journey-metadata" />
                      </Field>

                      <div className="grid gap-3 rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="marketing-journey-steps-builder">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="font-black text-[#241133]">Journey steps</h4>
                            <p className="mt-1 text-xs font-bold text-[#7d6b65]">Each step owns its channel, delay, content, and planning config.</p>
                          </div>
                          <button type="button" onClick={addJourneyStep} disabled={journeySaving} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-purple-700 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" data-testid="button-marketing-add-journey-step">
                            <Plus size={14} /> Add step
                          </button>
                        </div>

                        {journeyEditDraft.steps.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-[#eadfd5] bg-white p-4 text-center">
                            <p className="text-sm font-bold text-[#8b7a73]">No steps yet.</p>
                            <button type="button" onClick={addJourneyStep} disabled={journeySaving} className="mt-3 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]" data-testid="button-marketing-add-first-journey-step">
                              <Plus size={14} /> Add step
                            </button>
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {journeyEditDraft.steps.map((step, index) => {
                              const contentOptions = content.filter((item) => item.channel === step.channel && item.status !== "archived");
                              const selectedContentOption = contentAssetByReference(content, step.contentAssetId) ?? contentAssetByReference(content, step.templateRef);
                              const selectedStepMediaAssets = selectedContentOption ? mediaAssets.filter((item) => item.contentAssetId === selectedContentOption.id) : [];
                              const options = selectedContentOption && !contentOptions.some((item) => item.id === selectedContentOption.id)
                                ? [selectedContentOption, ...contentOptions]
                                : contentOptions;
                              return (
                                <div key={step.id} className="grid gap-3 rounded-xl border border-[#eadfd5] bg-white p-3" data-testid={`marketing-journey-step-${index}`}>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-black text-[#241133]">Step {index + 1}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      <button type="button" onClick={() => moveJourneyStep(step.id, -1)} disabled={journeySaving || index === 0} className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#eadfd5] bg-white px-2 text-xs font-black text-[#5b4a46] disabled:cursor-not-allowed disabled:text-[#b8abb8]" data-testid={`button-marketing-move-journey-step-up-${index}`}>
                                        <ArrowUp size={13} />
                                      </button>
                                      <button type="button" onClick={() => moveJourneyStep(step.id, 1)} disabled={journeySaving || index === journeyEditDraft.steps.length - 1} className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#eadfd5] bg-white px-2 text-xs font-black text-[#5b4a46] disabled:cursor-not-allowed disabled:text-[#b8abb8]" data-testid={`button-marketing-move-journey-step-down-${index}`}>
                                        <ArrowDown size={13} />
                                      </button>
                                      <button type="button" onClick={() => removeJourneyStep(step.id)} disabled={journeySaving} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:text-red-300" data-testid={`button-marketing-remove-journey-step-${index}`}>
                                        <Trash2 size={13} /> Remove
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid gap-3 xl:grid-cols-[120px_150px_1fr_130px]">
                                    <Field label="Delay hours">
                                      <input type="number" min="0" className={inputClass} value={step.delayHours} onChange={(event) => updateJourneyStep(step.id, { delayHours: event.target.value })} disabled={journeySaving} data-testid={`input-marketing-journey-step-delay-${index}`} />
                                    </Field>
                                    <Field label="Channel">
                                      <select className={inputClass} value={step.channel} onChange={(event) => updateJourneyStep(step.id, { channel: event.target.value as Channel, contentAssetId: "" })} disabled={journeySaving} data-testid={`select-marketing-journey-step-channel-${index}`}>
                                        {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                                      </select>
                                    </Field>
                                    <Field label="Content asset">
                                      <select className={inputClass} value={step.contentAssetId} onChange={(event) => updateJourneyStep(step.id, { contentAssetId: event.target.value })} disabled={journeySaving} data-testid={`select-marketing-journey-step-content-${index}`}>
                                        <option value="">No content asset</option>
                                        {options.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                                      </select>
                                    </Field>
                                    <Field label="Status">
                                      <select className={inputClass} value={step.status} onChange={(event) => updateJourneyStep(step.id, { status: event.target.value as JourneyStatus })} disabled={journeySaving} data-testid={`select-marketing-journey-step-status-${index}`}>
                                        {JOURNEY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                                      </select>
                                    </Field>
                                  </div>
                                  <div className="grid gap-3 xl:grid-cols-[150px_150px_1fr]">
                                    <Field label="Kind">
                                      <input className={inputClass} value={step.kind} onChange={(event) => updateJourneyStep(step.id, { kind: event.target.value })} placeholder="message" disabled={journeySaving} data-testid={`input-marketing-journey-step-kind-${index}`} />
                                    </Field>
                                    <Field label="Template kind">
                                      <input className={inputClass} value={step.templateKind} onChange={(event) => updateJourneyStep(step.id, { templateKind: event.target.value })} placeholder="email_template" disabled={journeySaving} data-testid={`input-marketing-journey-step-template-kind-${index}`} />
                                    </Field>
                                    <Field label="Template ref">
                                      <input className={inputClass} value={step.templateRef} onChange={(event) => updateJourneyStep(step.id, { templateRef: event.target.value })} placeholder="Lovable or VYVA template ID" disabled={journeySaving} data-testid={`input-marketing-journey-step-template-ref-${index}`} />
                                    </Field>
                                  </div>
                                  <LinkedContentPreview contentAsset={selectedContentOption} linkedMediaAssets={selectedStepMediaAssets} testId={`marketing-journey-step-content-preview-${index}`} />
                                  <div className="grid gap-3 xl:grid-cols-2">
                                    <Field label="Internal notes">
                                      <textarea className={`${textareaClass} min-h-[72px]`} value={step.notes} onChange={(event) => updateJourneyStep(step.id, { notes: event.target.value })} disabled={journeySaving} data-testid={`textarea-marketing-journey-step-notes-${index}`} />
                                    </Field>
                                    <Field label="Config JSON">
                                      <textarea className={`${textareaClass} min-h-[72px]`} value={step.configText} onChange={(event) => updateJourneyStep(step.id, { configText: event.target.value })} placeholder="{ }" disabled={journeySaving} data-testid={`textarea-marketing-journey-step-config-${index}`} />
                                    </Field>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {journeyFeedback ? (
                        <p className={`rounded-xl px-4 py-3 text-sm font-bold ${journeyFeedbackIsError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`} data-testid="marketing-journey-feedback" role="status">
                          {journeyFeedback}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={journeySaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" data-testid="button-marketing-save-journey">
                          <Save size={15} /> {journeySaving ? "Saving..." : editingJourneyId === "new" ? "Create journey" : "Save journey"}
                        </button>
                        <button type="button" onClick={cancelJourneyEdit} disabled={journeySaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#2f2135] disabled:cursor-not-allowed disabled:text-[#9d8b9d]" data-testid="button-marketing-cancel-journey">
                          <X size={15} /> Close details
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-6 text-center">
                      <div>
                        <Waypoints className="mx-auto text-purple-700" size={28} />
                        <p className="mt-3 text-sm font-black text-[#241133]">Select a journey or create a new one.</p>
                        <p className="mt-1 text-xs font-bold text-[#8b7a73]">Steps, trigger logic, and goals are edited here.</p>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>
              <SectionCard title="Journey progress" subtitle={`${journeyEnrollments.length} imported enrollment records and event history rows.`}>
                {journeyEnrollments.length === 0 ? (
                  <EmptyState text="No journey enrollments imported yet." />
                ) : (
                  <div className="grid gap-3" data-testid="marketing-journey-enrollments">
                    {journeyEnrollments.slice(0, 10).map((enrollment) => (
                      <article key={enrollment.id} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{enrollment.journeyName || enrollment.journeyId}</p>
                            <p className="mt-1 text-xs font-bold text-[#7d6b65]">{enrollment.contactExternalId || enrollment.contactId || "No contact linked"}</p>
                            <p className="mt-1 text-xs font-bold text-[#8b7a73]">
                              Entered {formatDate(enrollment.enteredAt)} · Last activity {formatDate(enrollment.lastActivityAt)}
                              {enrollment.exitedAt ? ` · Exited ${formatDate(enrollment.exitedAt)}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Pill className={statusClass(enrollment.status)}>{enrollment.status}</Pill>
                            <Pill className="bg-blue-50 text-blue-800">Step {enrollment.currentStepOrder}</Pill>
                            <Pill className="bg-violet-50 text-violet-700">{enrollment.source}</Pill>
                          </div>
                        </div>
                        {enrollment.lovableExternalId ? (
                          <p className="mt-2 break-all text-xs font-bold text-[#8b7a73]">Lovable enrollment ID: {enrollment.lovableExternalId}</p>
                        ) : null}
                        <MetadataPanel title="Imported enrollment metadata" value={enrollment.metadata} testId={`marketing-journey-enrollment-metadata-${enrollment.id}`} />
                        {enrollment.events.length ? (
                          <div className="mt-3 grid gap-2">
                            {enrollment.events.slice(0, 8).map((event) => (
                              <div key={event.id} className="rounded-lg border border-[#eadfd5] bg-white p-2" data-testid={`marketing-journey-event-${event.id}`}>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Pill className="bg-white text-[#5b4a46]">{event.eventType}</Pill>
                                  <Pill className="bg-blue-50 text-blue-800">Step {event.stepOrder}</Pill>
                                  {event.channel ? <Pill className={channelClass(event.channel as Channel)}>{event.channel}</Pill> : null}
                                  <span className="text-xs font-bold text-[#8b7a73]">{formatDate(event.eventAt)}</span>
                                </div>
                                <MetadataPanel title="Imported event metadata" value={event.metadata} testId={`marketing-journey-event-metadata-${event.id}`} />
                              </div>
                            ))}
                            {enrollment.events.length > 8 ? <Pill className="bg-[#f5eee8] text-[#7d6b65]">+{enrollment.events.length - 8}</Pill> : null}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs font-bold text-[#8b7a73]">No event history for this enrollment.</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {activeTab === "content" && (
            <div className="grid gap-4" data-testid="marketing-content-tab">
              <LovableImportCoveragePanel
                run={latestSyncRun}
                title="Lovable content coverage"
                subtitle="Quickly see whether Lovable exported templates, social posts, briefs, media, and campaign links."
                focusKeys={["content", "mediaAssets", "campaigns", "campaignChannels", "journeys"]}
                onOpenSettings={() => setActiveTab("settings")}
              />

              <SectionCard title="Content draft" subtitle="Create reusable campaign copy, templates, social posts, CTAs, HTML, and media references.">
                <form className="grid gap-3" onSubmit={(event) => createContent(event).catch((error) => setMessage(error.message))} data-testid="marketing-content-draft-form">
                  <div className="grid gap-3 xl:grid-cols-[1fr_170px_140px_120px]">
                    <Field label="Title">
                      <input className={inputClass} value={contentDraft.title} onChange={(event) => setContentDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Caregiver invite follow-up" disabled={contentSaving} data-testid="input-marketing-content-title" />
                    </Field>
                    <Field label="Channel">
                      <select className={inputClass} value={contentDraft.channel} onChange={(event) => setContentDraft((draft) => ({ ...draft, channel: event.target.value as Channel }))} disabled={contentSaving} data-testid="select-marketing-content-channel">
                        {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select className={inputClass} value={contentDraft.status} onChange={(event) => setContentDraft((draft) => ({ ...draft, status: event.target.value as ContentStatus }))} disabled={contentSaving} data-testid="select-marketing-content-status">
                        {CONTENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </Field>
                    <Field label="Language">
                      <input className={inputClass} value={contentDraft.language} onChange={(event) => setContentDraft((draft) => ({ ...draft, language: event.target.value }))} placeholder="en" disabled={contentSaving} data-testid="input-marketing-content-language" />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[1fr_220px_1fr]">
                    <Field label="Subject">
                      <input className={inputClass} value={contentDraft.subject} onChange={(event) => setContentDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="Optional subject" disabled={contentSaving} data-testid="input-marketing-content-subject" />
                    </Field>
                    <Field label="CTA label">
                      <input className={inputClass} value={contentDraft.ctaLabel} onChange={(event) => setContentDraft((draft) => ({ ...draft, ctaLabel: event.target.value }))} placeholder="Read more" disabled={contentSaving} data-testid="input-marketing-content-cta-label" />
                    </Field>
                    <Field label="CTA URL">
                      <input className={inputClass} value={contentDraft.ctaUrl} onChange={(event) => setContentDraft((draft) => ({ ...draft, ctaUrl: event.target.value }))} placeholder="https://..." disabled={contentSaving} data-testid="input-marketing-content-cta-url" />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <Field label="Plain copy">
                      <textarea className={textareaClass} value={contentDraft.body} onChange={(event) => setContentDraft((draft) => ({ ...draft, body: event.target.value }))} placeholder="Campaign copy" disabled={contentSaving} data-testid="textarea-marketing-content-body" />
                    </Field>
                    <Field label="HTML body">
                      <textarea className={`${textareaClass} font-mono text-xs`} value={contentDraft.htmlBody} onChange={(event) => setContentDraft((draft) => ({ ...draft, htmlBody: event.target.value }))} placeholder="<p>Optional HTML</p>" disabled={contentSaving} data-testid="textarea-marketing-content-html" />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <Field label="Design JSON">
                      <textarea className={`${textareaClass} font-mono text-xs`} value={contentDraft.designJsonText} onChange={(event) => setContentDraft((draft) => ({ ...draft, designJsonText: event.target.value }))} placeholder="{ }" disabled={contentSaving} data-testid="textarea-marketing-content-design-json" />
                    </Field>
                    <Field label="Media assets JSON">
                      <textarea className={`${textareaClass} font-mono text-xs`} value={contentDraft.mediaAssetsText} onChange={(event) => setContentDraft((draft) => ({ ...draft, mediaAssetsText: event.target.value }))} placeholder="[]" disabled={contentSaving} data-testid="textarea-marketing-content-media-assets" />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" type="submit" disabled={contentSaving} data-testid="button-marketing-add-content">
                      <FileText size={16} /> {contentSaving ? "Saving..." : "Add content"}
                    </button>
                  </div>
                </form>
                {contentFeedback && !contentEditDraft ? (
                  <p className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${contentFeedback.includes("failed") || contentFeedback.includes("required") || contentFeedback.includes("valid JSON") || contentFeedback.includes("could not") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`} data-testid="marketing-content-feedback">
                    {contentFeedback}
                  </p>
                ) : null}
              </SectionCard>
              <SectionCard
                title="Content library"
                subtitle={`${visibleContent.length} visible of ${content.length} assets.`}
                action={(
                  <select
                    className={`${inputClass} w-[240px]`}
                    value={contentSourceFilter}
                    onChange={(event) => setContentSourceFilter(event.target.value)}
                    aria-label="Content type filter"
                    data-testid="select-marketing-content-source-filter"
                  >
                    <option value="all">All content types ({content.length})</option>
                    {contentSourceOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                )}
              >
                <div className="grid gap-3">
                  {contentActionFeedback ? (
                    <p className={`rounded-xl px-4 py-3 text-sm font-bold ${contentActionFeedback.includes("failed") || contentActionFeedback.includes("required") || contentActionFeedback.includes("valid JSON") || contentActionFeedback.includes("could not") ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`} role="status" aria-live="polite" data-testid="marketing-content-action-feedback">
                      {contentActionFeedback}
                    </p>
                  ) : null}
                  {visibleContent.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-4" data-testid="marketing-content-empty-diagnostic">
                      <p className="text-center text-sm font-black text-[#241133]">{contentEmptyDiagnostic?.title ?? "No content matches the filters."}</p>
                      <p className="mx-auto mt-2 max-w-3xl text-center text-sm font-bold text-[#8b7a73]">
                        {contentEmptyDiagnostic?.detail ?? "Clear filters or run Lovable sync from Settings."}
                      </p>
                      {contentEmptyDiagnostic ? (
                        <div className="mt-3 flex justify-center">
                          {contentEmptyDiagnostic.action === "clear_filters" ? (
                            <button
                              type="button"
                              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-700"
                              onClick={() => {
                                setSearch("");
                                setChannelFilter("all");
                                setContentSourceFilter("all");
                              }}
                              data-testid="button-marketing-clear-content-filters"
                            >
                              Clear content filters
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex min-h-9 items-center justify-center rounded-xl bg-purple-700 px-3 text-xs font-black text-white"
                              onClick={() => setActiveTab("settings")}
                              data-testid="button-marketing-open-sync-settings"
                            >
                              Open sync settings
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#eadfd5]" data-testid="marketing-content-library-table">
                      <table className="min-w-[1180px] border-collapse text-left text-sm">
                        <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                          <tr>
                            <th className="px-4 py-3">Content</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Channel</th>
                            <th className="px-4 py-3">Language</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Design/media</th>
                            <th className="px-4 py-3">CTA</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleContent.map((item) => (
                            <tr key={item.id} className={`border-t border-[#f0e7df] align-top ${item.id === selectedContent?.id ? "bg-purple-50/60" : ""}`} data-testid={`marketing-content-row-${item.id}`}>
                              <td className="max-w-[360px] px-4 py-3">
                                <p className="font-black text-[#241133]">{item.title}</p>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#7d6b65]">{item.subject || item.body || "No copy yet."}</p>
                                {item.body && item.body !== item.subject ? (
                                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#8b7a73]">{item.body}</p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                                <Pill className={item.source === "lovable" ? "bg-violet-50 text-violet-700" : "bg-[#f5eee8] text-[#5b4a46]"}>
                                  {contentOriginLabel(item)}
                                </Pill>
                              </td>
                              <td className="px-4 py-3"><Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill></td>
                              <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{item.language}</td>
                              <td className="px-4 py-3"><Pill className={statusClass(item.status)}>{item.status}</Pill></td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {item.hasHtml ? <Pill className="bg-blue-50 text-blue-800">HTML</Pill> : null}
                                  {item.hasDesign ? <Pill className="bg-purple-50 text-purple-800">Design</Pill> : null}
                                  {item.mediaAssetCount ? <Pill className="bg-emerald-50 text-emerald-800">{item.mediaAssetCount} media</Pill> : null}
                                  {!item.hasHtml && !item.hasDesign && !item.mediaAssetCount ? <span className="text-xs font-bold text-[#8b7a73]">Plain copy</span> : null}
                                </div>
                              </td>
                              <td className="max-w-[220px] px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                {item.ctaLabel || item.ctaUrl ? [item.ctaLabel, item.ctaUrl].filter(Boolean).join(" -> ") : "-"}
                              </td>
                              <td className="max-w-[240px] px-4 py-3">
                                <p className="text-xs font-black text-[#241133]">{item.source}</p>
                                {item.lovableExternalId ? <p className="mt-1 break-all text-xs font-semibold text-[#7d6b65]">Lovable ID: {item.lovableExternalId}</p> : null}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" onClick={() => previewContent(item)} className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black ${item.id === selectedContent?.id && editingContentId !== item.id ? "border-purple-300 bg-purple-700 text-white" : "border-[#eadfd5] bg-white text-purple-700"}`} data-testid={`button-marketing-preview-content-${item.id}`}>
                                    <Eye size={13} /> {item.id === selectedContent?.id && editingContentId !== item.id ? "Previewing" : "Preview"}
                                  </button>
                                  <button type="button" onClick={() => startContentEdit(item)} className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${editingContentId === item.id ? "border-purple-300 bg-purple-700 text-white" : "border-[#eadfd5] bg-white text-purple-700"}`} disabled={contentSaving} data-testid={`button-marketing-edit-content-${item.id}`}>
                                    <Pencil size={13} /> {editingContentId === item.id ? "Editing" : "Edit"}
                                  </button>
                                  <button type="button" onClick={() => void deleteContent(item)} className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingContentDeleteId === item.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} disabled={contentSaving} data-testid={`button-marketing-delete-content-${item.id}`}>
                                    <Trash2 size={13} /> {confirmingContentDeleteId === item.id ? "Confirm delete" : "Delete"}
                                  </button>
                                  {confirmingContentDeleteId === item.id ? (
                                    <p className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800" data-testid={`marketing-content-delete-confirmation-${item.id}`}>
                                      Click Confirm delete to remove this content.
                                    </p>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </SectionCard>
              <div
                ref={contentEditorPanelRef}
                data-testid="marketing-content-editor-panel"
                role={contentDrawerMode === "edit" ? "dialog" : undefined}
                aria-modal={contentDrawerMode === "edit" ? true : undefined}
                tabIndex={contentDrawerMode === "edit" ? -1 : undefined}
                className={contentDrawerMode === "edit" ? "scroll-mt-6 rounded-2xl border-2 border-purple-200 bg-white p-3 shadow-xl" : "hidden"}
              >
                <SectionCard
                  title="Content editor"
                  subtitle={editingContent ? `Editing ${editingContent.title}` : "Select a content asset to edit imported or local copy."}
                  action={contentDrawerMode === "edit" ? (
                    <button type="button" onClick={closeContentDrawer} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#241133]" data-testid="button-marketing-close-content-drawer">
                      <X size={14} /> Close
                    </button>
                  ) : null}
                >
                  {contentEditDraft ? (
                    <form className="grid gap-4" onSubmit={(event) => void saveContentEdit(event)} data-testid="marketing-content-editor-form">
                    <div className="grid gap-3 xl:grid-cols-[1.4fr_160px_160px_120px]">
                      <Field label="Title">
                        <input className={inputClass} value={contentEditDraft.title} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, title: event.target.value }) : draft)} disabled={contentSaving} data-testid="input-marketing-edit-content-title" />
                      </Field>
                      <Field label="Channel">
                        <select className={inputClass} value={contentEditDraft.channel} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, channel: event.target.value as Channel }) : draft)} disabled={contentSaving} data-testid="select-marketing-edit-content-channel">
                          {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select className={inputClass} value={contentEditDraft.status} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, status: event.target.value as ContentStatus }) : draft)} disabled={contentSaving} data-testid="select-marketing-edit-content-status">
                          {CONTENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </Field>
                      <Field label="Language">
                        <input className={inputClass} value={contentEditDraft.language} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, language: event.target.value }) : draft)} disabled={contentSaving} data-testid="input-marketing-edit-content-language" />
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-[1fr_240px_1fr]">
                      <Field label="Subject">
                        <input className={inputClass} value={contentEditDraft.subject} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, subject: event.target.value }) : draft)} disabled={contentSaving} data-testid="input-marketing-edit-content-subject" />
                      </Field>
                      <Field label="CTA label">
                        <input className={inputClass} value={contentEditDraft.ctaLabel} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, ctaLabel: event.target.value }) : draft)} disabled={contentSaving} data-testid="input-marketing-edit-content-cta-label" />
                      </Field>
                      <Field label="CTA URL">
                        <input className={inputClass} value={contentEditDraft.ctaUrl} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, ctaUrl: event.target.value }) : draft)} disabled={contentSaving} data-testid="input-marketing-edit-content-cta-url" />
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <Field label="Source">
                        <input className={inputClass} value={contentEditDraft.source} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, source: event.target.value }) : draft)} disabled={contentSaving} data-testid="input-marketing-edit-content-source" />
                      </Field>
                      <Field label="Lovable ID">
                        <input className={inputClass} value={contentEditDraft.lovableExternalId} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, lovableExternalId: event.target.value }) : draft)} disabled={contentSaving} data-testid="input-marketing-edit-content-lovable-id" />
                      </Field>
                    </div>
                    <Field label="Plain copy">
                      <textarea className={textareaClass} value={contentEditDraft.body} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, body: event.target.value }) : draft)} disabled={contentSaving} data-testid="textarea-marketing-edit-content-body" />
                    </Field>
                    <Field label="HTML body">
                      <textarea className={`${textareaClass} min-h-[140px] font-mono text-xs`} value={contentEditDraft.htmlBody} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, htmlBody: event.target.value }) : draft)} disabled={contentSaving} data-testid="textarea-marketing-edit-content-html" />
                    </Field>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <Field label="Design JSON">
                        <textarea className={`${textareaClass} min-h-[160px] font-mono text-xs`} value={contentEditDraft.designJsonText} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, designJsonText: event.target.value }) : draft)} placeholder="{ }" disabled={contentSaving} data-testid="textarea-marketing-edit-content-design-json" />
                      </Field>
                      <Field label="Media assets JSON">
                        <textarea className={`${textareaClass} min-h-[160px] font-mono text-xs`} value={contentEditDraft.mediaAssetsText} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, mediaAssetsText: event.target.value }) : draft)} placeholder="[]" disabled={contentSaving} data-testid="textarea-marketing-edit-content-media-assets" />
                      </Field>
                    </div>
                    <Field label="Content metadata JSON">
                      <textarea className={`${textareaClass} min-h-[150px] font-mono text-xs`} value={contentEditDraft.metadataText} onChange={(event) => setContentEditDraft((draft) => draft ? ({ ...draft, metadataText: event.target.value }) : draft)} placeholder="{ }" disabled={contentSaving} data-testid="textarea-marketing-edit-content-metadata" />
                    </Field>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={contentSaving} data-testid="button-marketing-save-content">
                        <Save size={16} /> {contentSaving ? "Saving..." : "Save content"}
                      </button>
                      {editingContent ? (
                        <button type="button" onClick={() => void deleteContent(editingContent)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingContentDeleteId === editingContent.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} disabled={contentSaving} data-testid="button-marketing-delete-editing-content">
                          <Trash2 size={16} /> {confirmingContentDeleteId === editingContent.id ? "Confirm delete" : "Delete"}
                        </button>
                      ) : null}
                      <button type="button" onClick={cancelContentEdit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 font-black text-[#241133]" disabled={contentSaving}>
                        <X size={16} /> Close
                      </button>
                    </div>
                    {contentFeedback ? (
                      <p className={`rounded-xl px-4 py-3 text-sm font-bold ${contentFeedback.includes("failed") || contentFeedback.includes("required") || contentFeedback.includes("valid JSON") || contentFeedback.includes("could not") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`} data-testid="marketing-content-editor-feedback">
                        {contentFeedback}
                      </p>
                    ) : null}
                    </form>
                  ) : (
                    <EmptyState text="Select a content asset from the library." />
                  )}
                </SectionCard>
              </div>
              <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                <div
                  ref={contentPreviewPanelRef}
                  data-testid="marketing-content-preview-panel"
                  role={contentDrawerMode === "preview" ? "dialog" : undefined}
                  aria-modal={contentDrawerMode === "preview" ? true : undefined}
                  tabIndex={contentDrawerMode === "preview" ? -1 : undefined}
                  className={contentDrawerMode === "preview" ? "scroll-mt-6 rounded-2xl border-2 border-purple-200 bg-white p-3 shadow-xl" : "hidden"}
                >
                  <SectionCard
                    title="Content preview"
                    subtitle={selectedContent ? selectedContent.title : "Select a content asset to inspect."}
                    action={contentDrawerMode === "preview" ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedContent ? (
                          <button type="button" onClick={() => startContentEdit(selectedContent)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-purple-700 px-3 text-xs font-black text-white" data-testid="button-marketing-edit-previewed-content">
                            <Pencil size={14} /> Edit
                          </button>
                        ) : null}
                        <button type="button" onClick={closeContentDrawer} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#241133]" data-testid="button-marketing-close-content-drawer">
                          <X size={14} /> Close
                        </button>
                      </div>
                    ) : null}
                  >
                    {selectedContent ? (
                      <div className="grid gap-3" data-testid="marketing-content-preview">
                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Subject</p>
                        <p className="mt-1 font-black">{selectedContent.subject || selectedContent.title}</p>
                      </div>
                      {selectedContent.source === "lovable" ? (
                        <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm font-bold text-violet-900" data-testid="marketing-content-origin-summary">
                          Imported from {contentOriginLabel(selectedContent)}
                          {selectedContent.lovableExternalId ? (
                            <span className="break-all"> - Lovable ID: {selectedContent.lovableExternalId}</span>
                          ) : null}
                        </div>
                      ) : null}
                      <LovableContentSourceDetails content={selectedContent} />
                      {selectedContent.htmlBody ? (
                        <iframe
                          title={`Preview ${selectedContent.title}`}
                          sandbox=""
                          srcDoc={selectedContent.htmlBody}
                          className="h-[360px] w-full rounded-xl border border-[#eadfd5] bg-white"
                        />
                      ) : (
                        <div className="min-h-[180px] whitespace-pre-wrap rounded-xl border border-[#eadfd5] bg-white p-4 text-sm font-semibold leading-relaxed text-[#2f2135]">
                          {selectedContent.body || "No body copy yet."}
                        </div>
                      )}
                      <LovableDesignPreview contentAsset={selectedContent} />
                      <div className="grid gap-2 md:grid-cols-3">
                        <Pill className={selectedContent.hasDesign ? "bg-purple-50 text-purple-800" : "bg-[#f5eee8] text-[#7d6b65]"}>{selectedContent.hasDesign ? "Design JSON present" : "No design JSON"}</Pill>
                        <Pill className="bg-blue-50 text-blue-800">{selectedContent.language}</Pill>
                        <Pill className={channelClass(selectedContent.channel)}>{channelLabel[selectedContent.channel]}</Pill>
                      </div>
                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="marketing-content-design-media-summary">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Lovable design/media</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedContentDesignSummary?.arrayKeys.length ? selectedContentDesignSummary.arrayKeys.map((item) => (
                            <Pill key={item.key} className="bg-purple-50 text-purple-800">Design {item.key}: {item.count}</Pill>
                          )) : (
                            <Pill className="bg-[#f5eee8] text-[#7d6b65]">No builder arrays found</Pill>
                          )}
                          {selectedContentDesignSummary?.topLevelKeys.length ? (
                            <Pill className="bg-white text-[#5b4a46]">Design keys: {selectedContentDesignSummary.topLevelKeys.slice(0, 5).join(", ")}</Pill>
                          ) : null}
                          <Pill className={selectedContentMediaPreviewUrls.length ? "bg-emerald-50 text-emerald-800" : "bg-[#f5eee8] text-[#7d6b65]"}>
                            Media refs: {selectedContentMediaPreviewUrls.length}
                          </Pill>
                        </div>
                        {selectedContentMediaPreviewUrls.length ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="marketing-content-media-previews">
                            {selectedContentMediaPreviewUrls.map((url) => (
                              <MediaPreviewTile key={url} url={url} testId={`marketing-content-media-preview-${url}`} />
                            ))}
                          </div>
                        ) : null}
                        {selectedContentMediaPreviewUrls.length ? (
                          <div className="mt-3 grid gap-1">
                            {selectedContentMediaPreviewUrls.map((url) => (
                              <a key={url} className="break-all text-xs font-bold text-purple-700 underline" href={url} target="_blank" rel="noreferrer">{url}</a>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-[#8b7a73]">No imported media URLs attached to this content.</p>
                        )}
                      </div>
                      <MetadataPanel title="Imported content metadata" value={selectedContent.metadata} testId="marketing-content-metadata-panel" />
                      </div>
                    ) : (
                      <EmptyState text="No content available." />
                    )}
                  </SectionCard>
                </div>

                <SectionCard title="Media references" subtitle={`${visibleMediaAssets.length} visible of ${mediaAssets.length} imported media rows.`}>
                  {mediaFeedback && !mediaEditDraft ? (
                    <p className={`mb-3 rounded-xl px-4 py-3 text-sm font-bold ${mediaFeedback.toLowerCase().includes("updated") || mediaFeedback.toLowerCase().includes("deleted") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="marketing-media-feedback">
                      {mediaFeedback}
                    </p>
                  ) : null}
                  {mediaEditDraft ? (
                    <form className="mb-4 grid gap-3 rounded-xl border border-purple-100 bg-purple-50 p-3" onSubmit={(event) => void saveMediaEdit(event)} data-testid="marketing-media-editor-form">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[#241133]">Media editor</p>
                          <p className="text-xs font-bold text-[#7d6b65]">{editingMediaAsset?.originalUrl ?? "Editing imported media reference"}</p>
                        </div>
                        {editingMediaAsset ? <Pill className="bg-white text-purple-800">{editingMediaAsset.source}</Pill> : null}
                      </div>
                      <div className="grid gap-3 xl:grid-cols-[1fr_160px_160px]">
                        <Field label="Original URL">
                          <input className={inputClass} value={mediaEditDraft.originalUrl} onChange={(event) => setMediaEditDraft((draft) => draft ? ({ ...draft, originalUrl: event.target.value }) : draft)} disabled={mediaSaving} data-testid="input-marketing-edit-media-original-url" />
                        </Field>
                        <Field label="Type">
                          <input className={inputClass} value={mediaEditDraft.assetType} onChange={(event) => setMediaEditDraft((draft) => draft ? ({ ...draft, assetType: event.target.value }) : draft)} disabled={mediaSaving} data-testid="input-marketing-edit-media-type" />
                        </Field>
                        <Field label="Status">
                          <input className={inputClass} value={mediaEditDraft.status} onChange={(event) => setMediaEditDraft((draft) => draft ? ({ ...draft, status: event.target.value }) : draft)} disabled={mediaSaving} data-testid="input-marketing-edit-media-status" />
                        </Field>
                      </div>
                      <div className="grid gap-3 xl:grid-cols-3">
                        <Field label="Linked content">
                          <select className={inputClass} value={mediaEditDraft.contentAssetId} onChange={(event) => setMediaEditDraft((draft) => draft ? ({ ...draft, contentAssetId: event.target.value }) : draft)} disabled={mediaSaving} data-testid="select-marketing-edit-media-content">
                            <option value="">No linked content</option>
                            {content.map((item) => (
                              <option key={item.id} value={item.id}>{item.title}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Local URL">
                          <input className={inputClass} value={mediaEditDraft.localUrl} onChange={(event) => setMediaEditDraft((draft) => draft ? ({ ...draft, localUrl: event.target.value }) : draft)} disabled={mediaSaving} data-testid="input-marketing-edit-media-local-url" />
                        </Field>
                        <Field label="Lovable ID">
                          <input className={inputClass} value={mediaEditDraft.lovableExternalId} onChange={(event) => setMediaEditDraft((draft) => draft ? ({ ...draft, lovableExternalId: event.target.value }) : draft)} disabled={mediaSaving} data-testid="input-marketing-edit-media-lovable-id" />
                        </Field>
                      </div>
                      <Field label="Metadata JSON">
                        <textarea className={`${textareaClass} min-h-[120px] font-mono text-xs`} value={mediaEditDraft.metadataText} onChange={(event) => setMediaEditDraft((draft) => draft ? ({ ...draft, metadataText: event.target.value }) : draft)} disabled={mediaSaving} data-testid="textarea-marketing-edit-media-metadata" />
                      </Field>
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={mediaSaving} data-testid="button-marketing-save-media">
                          <Save size={15} /> {mediaSaving ? "Saving..." : "Save media"}
                        </button>
                        {editingMediaAsset ? (
                          <button type="button" onClick={() => void deleteMediaAsset(editingMediaAsset)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingMediaDeleteId === editingMediaAsset.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} disabled={mediaSaving} data-testid="button-marketing-delete-editing-media">
                            <Trash2 size={15} /> {confirmingMediaDeleteId === editingMediaAsset.id ? "Confirm delete" : "Delete"}
                          </button>
                        ) : null}
                        <button type="button" onClick={cancelMediaEdit} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#241133] disabled:cursor-not-allowed disabled:text-[#9d8b9d]" disabled={mediaSaving} data-testid="button-marketing-cancel-media">
                          <X size={15} /> Close
                        </button>
                        {mediaFeedback ? (
                          <p className={`rounded-xl px-4 py-3 text-sm font-bold ${mediaFeedback.toLowerCase().includes("updated") || mediaFeedback.toLowerCase().includes("deleted") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="marketing-media-feedback">
                            {mediaFeedback}
                          </p>
                        ) : null}
                      </div>
                    </form>
                  ) : null}
                  <div className="grid gap-3" data-testid="marketing-media-assets-list">
                    {visibleMediaAssets.length === 0 ? (
                      <EmptyState text="No media references imported yet." />
                    ) : visibleMediaAssets.slice(0, 12).map((asset) => (
                      <article key={asset.id} className={`rounded-xl border p-3 ${selectedContentMediaAssets.some((item) => item.id === asset.id) ? "border-purple-200 bg-purple-50" : "border-[#eadfd5] bg-[#fffaf4]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Pill className="bg-blue-50 text-blue-800">{asset.assetType}</Pill>
                            <Pill className="bg-violet-50 text-violet-700">{asset.source}</Pill>
                          </div>
                          <Pill className={statusClass(asset.status)}>{asset.status}</Pill>
                        </div>
                        <p className="mt-2 text-xs font-black text-[#241133]">{asset.contentTitle || "Unlinked content"}</p>
                        {asset.lovableExternalId ? <p className="mt-1 break-all text-xs font-bold text-[#7d6b65]">Lovable ID: {asset.lovableExternalId}</p> : null}
                        <div className="mt-3" data-testid={`marketing-media-preview-${asset.id}`}>
                          <MediaPreviewTile url={asset.localUrl || asset.originalUrl} label={asset.contentTitle || mediaPreviewLabel(asset.originalUrl)} />
                        </div>
                        <a className="mt-1 block break-all text-xs font-bold text-purple-700 underline" href={asset.originalUrl} target="_blank" rel="noreferrer">{asset.originalUrl}</a>
                        {asset.localUrl ? <p className="mt-1 break-all text-xs font-bold text-emerald-700">Local: {asset.localUrl}</p> : null}
                        <MetadataPanel title="Imported media metadata" value={asset.metadata} testId={`marketing-media-metadata-${asset.id}`} />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => startMediaEdit(asset)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]" disabled={mediaSaving} data-testid={`button-marketing-edit-media-${asset.id}`}>
                            <Pencil size={13} /> Edit
                          </button>
                          <button type="button" onClick={() => void deleteMediaAsset(asset)} className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingMediaDeleteId === asset.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} disabled={mediaSaving} data-testid={`button-marketing-delete-media-${asset.id}`}>
                            <Trash2 size={13} /> {confirmingMediaDeleteId === asset.id ? "Confirm delete" : "Delete"}
                          </button>
                          {confirmingMediaDeleteId === asset.id ? (
                            <p className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800" data-testid={`marketing-media-delete-confirmation-${asset.id}`}>
                              Click Confirm delete to remove this VYVA media reference.
                            </p>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="grid gap-4" data-testid="marketing-calendar-tab">
              <SectionCard
                title="Calendar"
                subtitle="Scheduled campaign timeline and unscheduled planning queue."
                action={(
                  <button
                    type="button"
                    onClick={() => void sendDueCampaignEmails()}
                    disabled={dueEmailSending}
                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8] ${confirmingDueEmailSend ? "bg-red-700" : "bg-purple-700"}`}
                    data-testid="button-marketing-run-due-email"
                  >
                    <Send size={15} /> {dueEmailSending ? "Running..." : confirmingDueEmailSend ? "Confirm run due emails" : "Run due emails"}
                  </button>
                )}
              >
                {dueEmailFeedback ? (
                  <p
                    className={`mb-3 rounded-xl px-4 py-3 text-sm font-bold ${/failed|could not|error/i.test(dueEmailFeedback) ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                    data-testid="marketing-due-email-feedback"
                  >
                    {dueEmailFeedback}
                  </p>
                ) : null}
                <MarketingCalendarView
                  campaigns={visibleCampaigns}
                  onEdit={openCampaignFromCalendar}
                  onDelete={(campaign) => void deleteCampaign(campaign)}
                  confirmingDeleteId={confirmingCampaignDeleteId}
                />
              </SectionCard>
              <SectionCard title="Scheduled campaign details" subtitle="Table view for scheduled records.">
                <CampaignTable
                  campaigns={visibleCampaigns.filter((campaign) => campaign.scheduleStartsAt || campaign.status === "scheduled")}
                  activeCampaignId={editingCampaignId}
                  onEdit={openCampaignFromCalendar}
                  onDelete={(campaign) => void deleteCampaign(campaign)}
                  confirmingDeleteId={confirmingCampaignDeleteId}
                />
              </SectionCard>
            </div>
          )}

          {activeTab === "contacts" && (
            <div className="grid gap-4" data-testid="marketing-contacts-tab">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#eadfd5] bg-white p-2 shadow-sm" data-testid="marketing-contacts-view-switcher">
                <button
                  type="button"
                  onClick={() => setContactView("contacts")}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${contactView === "contacts" ? "bg-purple-700 text-white" : "text-[#4b394f] hover:bg-purple-50"}`}
                  data-testid="button-marketing-contacts-view"
                >
                  <UsersRound size={15} /> Contacts ({contacts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setContactView("lists")}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${contactView === "lists" ? "bg-purple-700 text-white" : "text-[#4b394f] hover:bg-purple-50"}`}
                  data-testid="button-marketing-lists-view"
                >
                  <UsersRound size={15} /> Lists ({audiences.length})
                </button>
              </div>

              {contactView === "contacts" ? (
                <>
                  <SectionCard title="Contact draft" subtitle="Create B2B contacts or planning records before sync/cutover.">
                    <form className="grid gap-3" onSubmit={(event) => createContact(event).catch((error) => {
                      setContactFeedback(error.message);
                      setMessage(error.message);
                    })}>
                  <div className="grid gap-3 xl:grid-cols-[1.3fr_160px_1fr_1fr]">
                    <Field label="Name">
                      <input className={inputClass} value={contactDraft.fullName} onChange={(event) => setContactDraft((draft) => ({ ...draft, fullName: event.target.value }))} placeholder="Contact name" disabled={contactSaving} data-testid="input-marketing-contact-name" />
                    </Field>
                    <Field label="Audience">
                      <select className={inputClass} value={contactDraft.audienceType} onChange={(event) => setContactDraft((draft) => ({ ...draft, audienceType: event.target.value as Audience }))} disabled={contactSaving}>
                        {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                      </select>
                    </Field>
                    <Field label="Email">
                      <input className={inputClass} value={contactDraft.email} onChange={(event) => setContactDraft((draft) => ({ ...draft, email: event.target.value }))} placeholder="name@example.com" disabled={contactSaving} data-testid="input-marketing-contact-email" />
                    </Field>
                    <Field label="Phone">
                      <input className={inputClass} value={contactDraft.phoneNumber} onChange={(event) => setContactDraft((draft) => ({ ...draft, phoneNumber: event.target.value }))} placeholder="+34 ..." disabled={contactSaving} data-testid="input-marketing-contact-phone" />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-4">
                    <Field label="WhatsApp">
                      <input className={inputClass} value={contactDraft.whatsappNumber} onChange={(event) => setContactDraft((draft) => ({ ...draft, whatsappNumber: event.target.value }))} placeholder="Leave blank if same" disabled={contactSaving} data-testid="input-marketing-contact-whatsapp" />
                    </Field>
                    <Field label="Role">
                      <input className={inputClass} value={contactDraft.roleLabel} onChange={(event) => setContactDraft((draft) => ({ ...draft, roleLabel: event.target.value }))} placeholder="Founder, lead, caregiver..." disabled={contactSaving} data-testid="input-marketing-contact-role" />
                    </Field>
                    <Field label="Company">
                      <input className={inputClass} value={contactDraft.companyName} onChange={(event) => setContactDraft((draft) => ({ ...draft, companyName: event.target.value }))} placeholder="Organization" disabled={contactSaving} data-testid="input-marketing-contact-company" />
                    </Field>
                    <Field label="Tags">
                      <input className={inputClass} value={contactDraft.tags} onChange={(event) => setContactDraft((draft) => ({ ...draft, tags: event.target.value }))} placeholder="lead, partner, madrid" disabled={contactSaving} data-testid="input-marketing-contact-tags" />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                    <Field label="Language">
                      <input className={inputClass} value={contactDraft.language} onChange={(event) => setContactDraft((draft) => ({ ...draft, language: event.target.value }))} placeholder="en, es..." disabled={contactSaving} data-testid="input-marketing-contact-language" />
                    </Field>
                    <Field label="Category">
                      <input className={inputClass} value={contactDraft.category} onChange={(event) => setContactDraft((draft) => ({ ...draft, category: event.target.value }))} placeholder="Lead category" disabled={contactSaving} data-testid="input-marketing-contact-category" />
                    </Field>
                    <Field label="Vertical">
                      <input className={inputClass} value={contactDraft.vertical} onChange={(event) => setContactDraft((draft) => ({ ...draft, vertical: event.target.value }))} placeholder="Healthcare, public..." disabled={contactSaving} data-testid="input-marketing-contact-vertical" />
                    </Field>
                    <Field label="Market">
                      <input className={inputClass} value={contactDraft.market} onChange={(event) => setContactDraft((draft) => ({ ...draft, market: event.target.value }))} placeholder="Spain, UK..." disabled={contactSaving} data-testid="input-marketing-contact-market" />
                    </Field>
                    <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" type="submit" disabled={contactSaving} data-testid="button-marketing-add-contact">
                      <UsersRound size={16} /> {contactSaving ? "Saving..." : "Add contact"}
                    </button>
                  </div>
                  {contactFeedback && !contactEditDraft ? (
                    <p className={`rounded-xl px-4 py-3 text-sm font-bold ${contactFeedback.includes("created") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="marketing-contact-feedback">
                      {contactFeedback}
                    </p>
                  ) : null}
                    </form>
                  </SectionCard>
                  {contactEditDraft ? (
                    <SectionCard
                      title="Contact editor"
                      subtitle={editingContact ? `Editing ${editingContact.fullName || editingContact.email || editingContact.phoneNumber || "Unnamed contact"}.` : "Edit imported or manually created marketing contact data."}
                      action={editingContact ? <Pill className={statusClass(editingContact.source)}>{editingContact.source}</Pill> : null}
                    >
                      <form className="grid gap-3" onSubmit={(event) => void saveContactEdit(event)} data-testid="marketing-contact-editor-form">
                    <div className="grid gap-3 xl:grid-cols-[1.2fr_160px_180px]">
                      <Field label="Name">
                        <input className={inputClass} value={contactEditDraft.fullName} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, fullName: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-name" />
                      </Field>
                      <Field label="Audience">
                        <select className={inputClass} value={contactEditDraft.audienceType} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, audienceType: event.target.value as Audience }) : draft)} disabled={contactSaving} data-testid="select-marketing-edit-contact-audience">
                          {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                        </select>
                      </Field>
                      <Field label="Consent">
                        <select className={inputClass} value={contactEditDraft.consentStatus} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, consentStatus: event.target.value as ConsentStatus }) : draft)} disabled={contactSaving} data-testid="select-marketing-edit-contact-consent">
                          {CONSENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-3">
                      <Field label="Email">
                        <input className={inputClass} value={contactEditDraft.email} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, email: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-email" />
                      </Field>
                      <Field label="Phone">
                        <input className={inputClass} value={contactEditDraft.phoneNumber} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, phoneNumber: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-phone" />
                      </Field>
                      <Field label="WhatsApp">
                        <input className={inputClass} value={contactEditDraft.whatsappNumber} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, whatsappNumber: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-whatsapp" />
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-3">
                      <Field label="Role">
                        <input className={inputClass} value={contactEditDraft.roleLabel} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, roleLabel: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-role" />
                      </Field>
                      <Field label="Company">
                        <input className={inputClass} value={contactEditDraft.companyName} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, companyName: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-company" />
                      </Field>
                      <Field label="Tags">
                        <input className={inputClass} value={contactEditDraft.tags} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, tags: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-tags" />
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-4">
                      <Field label="Language">
                        <input className={inputClass} value={contactEditDraft.language} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, language: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-language" />
                      </Field>
                      <Field label="Category">
                        <input className={inputClass} value={contactEditDraft.category} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, category: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-category" />
                      </Field>
                      <Field label="Vertical">
                        <input className={inputClass} value={contactEditDraft.vertical} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, vertical: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-vertical" />
                      </Field>
                      <Field label="Market">
                        <input className={inputClass} value={contactEditDraft.market} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, market: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-market" />
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-4">
                      <Field label="Source">
                        <input className={inputClass} value={contactEditDraft.source} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, source: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-source" />
                      </Field>
                      <Field label="Lovable ID">
                        <input className={inputClass} value={contactEditDraft.lovableExternalId} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, lovableExternalId: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-lovable-id" />
                      </Field>
                      <Field label="Profile ID">
                        <input className={inputClass} value={contactEditDraft.profileId} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, profileId: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-profile-id" />
                      </Field>
                      <Field label="Organization ID">
                        <input className={inputClass} value={contactEditDraft.organizationId} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, organizationId: event.target.value }) : draft)} disabled={contactSaving} data-testid="input-marketing-edit-contact-organization-id" />
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <Field label="Channel availability JSON">
                        <textarea className={textareaClass} value={contactEditDraft.channelAvailabilityText} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, channelAvailabilityText: event.target.value }) : draft)} disabled={contactSaving} data-testid="textarea-marketing-edit-contact-channel-availability" />
                      </Field>
                      <Field label="Metadata JSON">
                        <textarea className={textareaClass} value={contactEditDraft.metadataText} onChange={(event) => setContactEditDraft((draft) => draft ? ({ ...draft, metadataText: event.target.value }) : draft)} disabled={contactSaving} data-testid="textarea-marketing-edit-contact-metadata" />
                      </Field>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={contactSaving} data-testid="button-marketing-save-contact">
                        <Save size={16} /> {contactSaving ? "Saving..." : "Save contact"}
                      </button>
                      {editingContact ? (
                        <button type="button" onClick={() => void deleteContact(editingContact)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingContactDeleteId === editingContact.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} disabled={contactSaving} data-testid="button-marketing-delete-editing-contact">
                          <Trash2 size={16} /> {confirmingContactDeleteId === editingContact.id ? "Confirm delete" : "Delete"}
                        </button>
                      ) : null}
                      <button type="button" onClick={cancelContactEdit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 font-black text-[#241133] disabled:cursor-not-allowed disabled:text-[#9d8b9d]" disabled={contactSaving} data-testid="button-marketing-cancel-contact">
                        <X size={16} /> Close
                      </button>
                      {contactFeedback ? (
                        <p className={`rounded-xl px-4 py-3 text-sm font-bold ${contactFeedback.toLowerCase().includes("updated") || contactFeedback.toLowerCase().includes("deleted") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="marketing-contact-editor-feedback">
                          {contactFeedback}
                        </p>
                      ) : null}
                    </div>
                      </form>
                    </SectionCard>
                  ) : null}
                  <SectionCard title="Contacts" subtitle={`${visibleContacts.length} visible of ${contacts.length} contacts.`}>
                    <div className="mb-3 grid gap-3 rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="marketing-contact-segmentation-filters">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[#241133]">Contact segmentation</p>
                          <p className="text-xs font-bold text-[#7d6b65]">Filter imported Lovable contacts by list, consent, market, language, category, vertical, and source.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setAudienceFilter("all");
                            setContactSourceFilter("all");
                            setContactConsentFilter("all");
                            setContactLanguageFilter("all");
                            setContactCategoryFilter("all");
                            setContactVerticalFilter("all");
                            setContactMarketFilter("all");
                            setContactListFilter("all");
                          }}
                          disabled={!search && audienceFilter === "all" && !contactFiltersActive}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                          data-testid="button-marketing-clear-contact-filters"
                        >
                          Clear filters
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Source">
                          <select className={inputClass} value={contactSourceFilter} onChange={(event) => setContactSourceFilter(event.target.value)} data-testid="select-marketing-contact-source-filter">
                            <option value="all">All sources ({contacts.length})</option>
                            {contactSourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
                          </select>
                        </Field>
                        <Field label="Consent">
                          <select className={inputClass} value={contactConsentFilter} onChange={(event) => setContactConsentFilter(event.target.value)} data-testid="select-marketing-contact-consent-filter">
                            <option value="all">All consent ({contacts.length})</option>
                            {contactConsentOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
                          </select>
                        </Field>
                        <Field label="Language">
                          <select className={inputClass} value={contactLanguageFilter} onChange={(event) => setContactLanguageFilter(event.target.value)} data-testid="select-marketing-contact-language-filter">
                            <option value="all">All languages ({contacts.length})</option>
                            {contactLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
                          </select>
                        </Field>
                        <Field label="List">
                          <select className={inputClass} value={contactListFilter} onChange={(event) => setContactListFilter(event.target.value)} data-testid="select-marketing-contact-list-filter">
                            <option value="all">All lists ({contacts.length})</option>
                            {contactListOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Category">
                          <select className={inputClass} value={contactCategoryFilter} onChange={(event) => setContactCategoryFilter(event.target.value)} data-testid="select-marketing-contact-category-filter">
                            <option value="all">All categories ({contacts.length})</option>
                            {contactCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
                          </select>
                        </Field>
                        <Field label="Vertical">
                          <select className={inputClass} value={contactVerticalFilter} onChange={(event) => setContactVerticalFilter(event.target.value)} data-testid="select-marketing-contact-vertical-filter">
                            <option value="all">All verticals ({contacts.length})</option>
                            {contactVerticalOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
                          </select>
                        </Field>
                        <Field label="Market">
                          <select className={inputClass} value={contactMarketFilter} onChange={(event) => setContactMarketFilter(event.target.value)} data-testid="select-marketing-contact-market-filter">
                            <option value="all">All markets ({contacts.length})</option>
                            {contactMarketOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
                          </select>
                        </Field>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-[#eadfd5]" data-testid="marketing-contacts-table">
                      <table className="min-w-[1500px] border-collapse text-left text-sm">
                        <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                          <tr>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">WhatsApp</th>
                            <th className="px-4 py-3">Audience</th>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Lang</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Vertical</th>
                            <th className="px-4 py-3">Market</th>
                            <th className="px-4 py-3">Tags / lists</th>
                            <th className="px-4 py-3">Consent</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleContacts.length === 0 ? (
                            <tr>
                              <td colSpan={15} className="px-4 py-6 text-center font-bold text-[#8b7a73]" data-testid="marketing-contact-empty-diagnostic">
                                {contacts.length ? "Contacts are loaded, but hidden by the current search or segmentation filters." : "No contacts imported yet."}
                              </td>
                            </tr>
                          ) : visibleContacts.map((contact) => {
                            const tagsAndLists = [
                              ...(contact.tags ?? []),
                              ...(contact.lists ?? []).map((list) => `List: ${list}`),
                            ];
                            return (
                              <tr key={contact.id} className="border-t border-[#f0e7df] align-top">
                                <td className="px-4 py-3">
                                  <p className="font-black">{contact.fullName || contact.email || contact.phoneNumber || "Unnamed contact"}</p>
                                  {contact.profileId ? <p className="mt-1 break-all text-xs font-semibold text-[#7d6b65]">Profile: {contact.profileId}</p> : null}
                                </td>
                                <td className="max-w-[220px] px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.email || "-"}</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.phoneNumber || "-"}</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.whatsappNumber || "-"}</td>
                                <td className="px-4 py-3 font-black">{contact.audienceType.toUpperCase()}</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.companyName || "-"}</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.roleLabel || "-"}</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.language || "-"}</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.category || "-"}</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.vertical || "-"}</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">{contact.market || "-"}</td>
                                <td className="max-w-[320px] px-4 py-3">
                                  {tagsAndLists.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {tagsAndLists.slice(0, 8).map((segment, index) => (
                                        <Pill key={`${segment}-${index}`} className="bg-purple-50 text-purple-800">{segment}</Pill>
                                      ))}
                                      {tagsAndLists.length > 8 ? <Pill className="bg-[#f5eee8] text-[#7d6b65]">+{tagsAndLists.length - 8}</Pill> : null}
                                    </div>
                                  ) : (
                                    <span className="text-xs font-bold text-[#8b7a73]">No tags or lists</span>
                                  )}
                                </td>
                                <td className="px-4 py-3"><Pill className={statusClass(contact.consentStatus)}>{contact.consentStatus}</Pill></td>
                                <td className="px-4 py-3">
                                  <div className="grid gap-2">
                                    <p className="font-bold">{contact.source}</p>
                                    {contact.lovableExternalId ? (
                                      <p className="break-all text-xs font-semibold text-[#7d6b65]">Lovable ID: {contact.lovableExternalId}</p>
                                    ) : null}
                                    {contact.profileId ? (
                                      <p className="break-all text-xs font-semibold text-[#7d6b65]">Profile: {contact.profileId}</p>
                                    ) : null}
                                    {contact.organizationId ? (
                                      <p className="break-all text-xs font-semibold text-[#7d6b65]">Org: {contact.organizationId}</p>
                                    ) : null}
                                    <MetadataPanel title="Imported contact data" value={contact.metadata} testId={`marketing-contact-metadata-${contact.id}`} />
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => startContactEdit(contact)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]" disabled={contactSaving} data-testid={`button-marketing-edit-contact-${contact.id}`}>
                                      <Pencil size={13} /> Edit
                                    </button>
                                    <button type="button" onClick={() => void deleteContact(contact)} className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingContactDeleteId === contact.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} disabled={contactSaving} data-testid={`button-marketing-delete-contact-${contact.id}`}>
                                      <Trash2 size={13} /> {confirmingContactDeleteId === contact.id ? "Confirm delete" : "Delete"}
                                    </button>
                                    {confirmingContactDeleteId === contact.id ? (
                                      <p className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800" data-testid={`marketing-contact-delete-confirmation-${contact.id}`}>
                                        Click Confirm delete to remove this marketing contact.
                                      </p>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                </>
              ) : (
                <>
                  <SectionCard title="List builder" subtitle="Store reusable Lovable-style lists with optional rules and contact external IDs.">
                    <form className="grid gap-3" onSubmit={(event) => createAudience(event).catch((error) => {
                      setAudienceFeedback(error.message);
                      setMessage(error.message);
                    })} data-testid="marketing-audience-builder">
                  <div className="grid gap-3 xl:grid-cols-[1fr_180px_1fr]">
                    <Field label="Audience name">
                      <input className={inputClass} value={audienceDraft.name} onChange={(event) => setAudienceDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Madrid partners" disabled={audienceSaving} data-testid="input-marketing-audience-name" />
                    </Field>
                    <Field label="List type">
                      <select className={inputClass} value={audienceDraft.listType} onChange={(event) => setAudienceDraft((draft) => ({ ...draft, listType: event.target.value }))} disabled={audienceSaving} data-testid="select-marketing-audience-type">
                        <option value="dynamic">dynamic</option>
                        <option value="static">static</option>
                        <option value="imported">imported</option>
                      </select>
                    </Field>
                    <Field label="Description">
                      <input className={inputClass} value={audienceDraft.description} onChange={(event) => setAudienceDraft((draft) => ({ ...draft, description: event.target.value }))} placeholder="Who this list is for" disabled={audienceSaving} data-testid="input-marketing-audience-description" />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <Field label="Rules JSON">
                      <textarea className={textareaClass} value={audienceDraft.rulesText} onChange={(event) => setAudienceDraft((draft) => ({ ...draft, rulesText: event.target.value }))} disabled={audienceSaving} data-testid="input-marketing-audience-rules" />
                    </Field>
                    <Field label="Members">
                      <div className="grid gap-2" data-testid="marketing-audience-member-picker">
                        <select
                          className={inputClass}
                          value=""
                          onChange={(event) => addAudienceDraftContact(event.target.value)}
                          disabled={audienceSaving || audienceDraftCandidateContacts.length === 0}
                          data-testid="select-marketing-audience-add-contact"
                        >
                          <option value="">{audienceDraftCandidateContacts.length ? "Add contact by name or email" : "All visible contacts are already listed"}</option>
                          {audienceDraftCandidateContacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>{audienceContactLabel(contact)}</option>
                          ))}
                        </select>
                        {audienceDraftMemberContacts.length ? (
                          <div className="grid gap-2" data-testid="marketing-audience-selected-members">
                            {audienceDraftMemberContacts.map((contact) => (
                              <div key={contact.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#eadfd5] bg-white px-3 py-2">
                                <span className="text-xs font-bold text-[#5b4a46]">{audienceContactLabel(contact)}</span>
                                <button type="button" onClick={() => removeAudienceDraftContact(contact)} className="text-xs font-black text-red-700" disabled={audienceSaving}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg bg-[#fffaf4] px-3 py-2 text-xs font-bold text-[#8b7a73]">No mapped contacts selected yet.</p>
                        )}
                        <textarea className={`${textareaClass} min-h-[76px] font-mono text-xs`} value={audienceDraft.contactExternalIds} onChange={(event) => setAudienceDraft((draft) => ({ ...draft, contactExternalIds: event.target.value }))} placeholder="contact:123, contact:456" disabled={audienceSaving} data-testid="input-marketing-audience-contact-ids" />
                      </div>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" type="submit" disabled={audienceSaving} data-testid="button-marketing-add-audience">
                      <UsersRound size={16} /> {audienceSaving ? "Saving..." : "Add audience"}
                    </button>
                    {audienceFeedback && !audienceEditDraft ? (
                      <p className={`rounded-xl px-4 py-3 text-sm font-bold ${audienceFeedback.includes("created") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="marketing-audience-feedback">
                      {audienceFeedback}
                    </p>
                  ) : null}
                </div>
                    </form>
                  </SectionCard>
                  {audienceEditDraft ? (
                    <SectionCard
                      title="List editor"
                      subtitle={editingAudience ? `Editing ${editingAudience.name}. Members are stored as Lovable contact external IDs.` : "Edit imported or manually created marketing lists."}
                      action={editingAudience ? <Pill className="bg-purple-50 text-purple-800">{editingAudience.source}</Pill> : null}
                    >
                      <form className="grid gap-3" onSubmit={(event) => void saveAudienceEdit(event)} data-testid="marketing-audience-editor-form">
                    <div className="grid gap-3 xl:grid-cols-[1fr_180px_1fr]">
                      <Field label="List name">
                        <input className={inputClass} value={audienceEditDraft.name} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, name: event.target.value }) : draft)} disabled={audienceSaving} data-testid="input-marketing-edit-audience-name" />
                      </Field>
                      <Field label="List type">
                        <select className={inputClass} value={audienceEditDraft.listType} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, listType: event.target.value }) : draft)} disabled={audienceSaving} data-testid="select-marketing-edit-audience-type">
                          <option value="dynamic">dynamic</option>
                          <option value="static">static</option>
                          <option value="imported">imported</option>
                        </select>
                      </Field>
                      <Field label="Description">
                        <input className={inputClass} value={audienceEditDraft.description} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, description: event.target.value }) : draft)} disabled={audienceSaving} data-testid="input-marketing-edit-audience-description" />
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <Field label="Rules JSON">
                        <textarea className={`${textareaClass} font-mono text-xs`} value={audienceEditDraft.rulesText} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, rulesText: event.target.value }) : draft)} disabled={audienceSaving} data-testid="textarea-marketing-edit-audience-rules" />
                      </Field>
                      <Field label="Members">
                        <div className="grid gap-2" data-testid="marketing-edit-audience-member-picker">
                          <select
                            className={inputClass}
                            value=""
                            onChange={(event) => addAudienceEditContact(event.target.value)}
                            disabled={audienceSaving || audienceEditCandidateContacts.length === 0}
                            data-testid="select-marketing-edit-audience-add-contact"
                          >
                            <option value="">{audienceEditCandidateContacts.length ? "Add contact by name or email" : "All visible contacts are already listed"}</option>
                            {audienceEditCandidateContacts.map((contact) => (
                              <option key={contact.id} value={contact.id}>{audienceContactLabel(contact)}</option>
                            ))}
                          </select>
                          {audienceEditMemberContacts.length ? (
                            <div className="grid gap-2" data-testid="marketing-edit-audience-selected-members">
                              {audienceEditMemberContacts.map((contact) => (
                                <div key={contact.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#eadfd5] bg-white px-3 py-2">
                                  <span className="text-xs font-bold text-[#5b4a46]">{audienceContactLabel(contact)}</span>
                                  <button type="button" onClick={() => removeAudienceEditContact(contact)} className="text-xs font-black text-red-700" disabled={audienceSaving} data-testid={`button-marketing-remove-audience-member-${contact.id}`}>
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-lg bg-[#fffaf4] px-3 py-2 text-xs font-bold text-[#8b7a73]">No mapped contacts selected yet.</p>
                          )}
                          {audienceEditMemberIds.length > audienceEditMemberContacts.length ? (
                            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                              {audienceEditMemberIds.length - audienceEditMemberContacts.length} imported member ID{audienceEditMemberIds.length - audienceEditMemberContacts.length === 1 ? "" : "s"} are not mapped to contacts yet and remain in the raw list below.
                            </p>
                          ) : null}
                          <textarea className={`${textareaClass} min-h-[76px] font-mono text-xs`} value={audienceEditDraft.contactExternalIds} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, contactExternalIds: event.target.value }) : draft)} placeholder="contact:123&#10;contact:456" disabled={audienceSaving} data-testid="textarea-marketing-edit-audience-contact-ids" />
                        </div>
                      </Field>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <Field label="Source">
                        <input className={inputClass} value={audienceEditDraft.source} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, source: event.target.value }) : draft)} disabled={audienceSaving} data-testid="input-marketing-edit-audience-source" />
                      </Field>
                      <Field label="Lovable ID">
                        <input className={inputClass} value={audienceEditDraft.lovableExternalId} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, lovableExternalId: event.target.value }) : draft)} disabled={audienceSaving} data-testid="input-marketing-edit-audience-lovable-id" />
                      </Field>
                    </div>
                    <Field label="List metadata JSON">
                      <textarea className={`${textareaClass} min-h-[130px] font-mono text-xs`} value={audienceEditDraft.metadataText} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, metadataText: event.target.value }) : draft)} disabled={audienceSaving} data-testid="textarea-marketing-edit-audience-metadata" />
                    </Field>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={audienceSaving} data-testid="button-marketing-save-audience">
                        <Save size={16} /> {audienceSaving ? "Saving..." : "Save list"}
                      </button>
                      {editingAudience ? (
                        <button type="button" onClick={() => void deleteAudience(editingAudience)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingAudienceDeleteId === editingAudience.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} disabled={audienceSaving} data-testid="button-marketing-delete-editing-audience">
                          <Trash2 size={16} /> {confirmingAudienceDeleteId === editingAudience.id ? "Confirm delete" : "Delete"}
                        </button>
                      ) : null}
                      <button type="button" onClick={cancelAudienceEdit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 font-black text-[#241133] disabled:cursor-not-allowed disabled:text-[#9d8b9d]" disabled={audienceSaving} data-testid="button-marketing-cancel-audience">
                        <X size={16} /> Close
                      </button>
                      {audienceFeedback ? (
                        <p className={`rounded-xl px-4 py-3 text-sm font-bold ${audienceFeedback.toLowerCase().includes("updated") || audienceFeedback.toLowerCase().includes("deleted") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="marketing-audience-editor-feedback">
                          {audienceFeedback}
                        </p>
                      ) : null}
                    </div>
                      </form>
                    </SectionCard>
                  ) : null}
                  <SectionCard title="Lists" subtitle={`${visibleAudiences.length} visible of ${audiences.length} imported lists.`}>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="marketing-audiences-list">
                      {visibleAudiences.length === 0 ? (
                        <EmptyState text="No imported lists match the filters." />
                      ) : visibleAudiences.map((audience) => {
                        const unmappedCount = audience.unmappedContactExternalIds.length;
                        return (
                          <div key={audience.id} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black">{audience.name}</p>
                                <p className="mt-1 text-xs font-bold text-[#7d6b65]">{audience.description || `${audience.listType} list`}</p>
                              </div>
                              <Pill className="bg-purple-50 text-purple-800">{audience.source}</Pill>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <Pill className="bg-blue-50 text-blue-800">{audience.memberCount} members</Pill>
                              <Pill className="bg-emerald-50 text-emerald-800">{audience.mappedMemberCount} mapped</Pill>
                              {unmappedCount ? <Pill className="bg-amber-50 text-amber-800">{unmappedCount} unmapped</Pill> : null}
                            </div>
                            {unmappedCount ? (
                              <p className="mt-2 text-xs font-semibold text-[#8b5d13]">Unmapped examples: {audience.unmappedContactExternalIds.slice(0, 3).join(", ")}</p>
                            ) : null}
                            {audience.memberPreview?.length ? (
                              <div className="mt-3 grid gap-2" data-testid={`marketing-audience-member-preview-${audience.id}`}>
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Mapped contacts</p>
                                {audience.memberPreview.slice(0, 5).map((member) => {
                                  const contactLine = member.email || member.whatsappNumber || member.phoneNumber || member.contactExternalId || "No channel";
                                  const roleLine = [member.roleLabel, member.companyName].filter(Boolean).join(" at ");
                                  return (
                                    <div key={`${member.id}-${member.contactExternalId ?? ""}`} className="rounded-lg border border-[#eadfd5] bg-white px-3 py-2">
                                      <p className="font-black text-[#241133]">{member.fullName || contactLine}</p>
                                      {roleLine ? <p className="mt-0.5 text-xs font-bold text-[#7d6b65]">{roleLine}</p> : null}
                                      <p className="mt-0.5 break-all text-xs font-semibold text-[#8b7a73]">{contactLine}</p>
                                    </div>
                                  );
                                })}
                                {audience.mappedMemberCount > audience.memberPreview.slice(0, 5).length ? (
                                  <Pill className="w-fit bg-[#f5eee8] text-[#7d6b65]">
                                    +{audience.mappedMemberCount - audience.memberPreview.slice(0, 5).length} more mapped contacts
                                  </Pill>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-3 rounded-lg bg-[#f5eee8] px-3 py-2 text-xs font-bold text-[#8b7a73]">No mapped contacts to preview yet.</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={() => startAudienceEdit(audience)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]" disabled={audienceSaving} data-testid={`button-marketing-edit-audience-${audience.id}`}>
                                <Pencil size={13} /> Edit
                              </button>
                              <button type="button" onClick={() => void deleteAudience(audience)} className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingAudienceDeleteId === audience.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} disabled={audienceSaving} data-testid={`button-marketing-delete-audience-${audience.id}`}>
                                <Trash2 size={13} /> {confirmingAudienceDeleteId === audience.id ? "Confirm delete" : "Delete"}
                              </button>
                              {confirmingAudienceDeleteId === audience.id ? (
                                <p className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800" data-testid={`marketing-audience-delete-confirmation-${audience.id}`}>
                                  Click Confirm delete to remove this list and membership rows.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                </>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]" data-testid="marketing-settings-tab">
              <SectionCard
                title="Lovable sync"
                subtitle="One-way import into VYVA. Nothing is written back to Lovable."
                action={<Pill className={syncState.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}>{syncState.configured ? "Configured" : "Not configured"}</Pill>}
              >
                <div className="grid gap-3">
                  <div className="rounded-xl bg-[#fffaf4] p-4">
                    <p className="text-sm font-bold text-[#7d6b65]">Mode</p>
                    <p className="font-black">{syncState.mode}</p>
                    <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Endpoint: {syncState.apiUrl ?? "Default Lovable export endpoint"}</p>
                    <div className="mt-3 rounded-xl border border-[#eadfd5] bg-white p-3 text-xs font-bold text-[#7d6b65]" data-testid="marketing-sync-env-diagnostics">
                      <p className="text-sm font-black text-[#2f2135]">Server configuration check</p>
                      {syncDiagnostics ? (
                        <div className="mt-2 grid gap-1">
                          <p>Endpoint source: {syncDiagnostics.apiUrlSource ?? "unknown"}{syncDiagnostics.hasDefaultEndpoint ? " (built-in default)" : ""}</p>
                          <p>Bearer token available: {yesNo(syncDiagnostics.hasBearerToken)}</p>
                          <p>VYVA_MARKETING_EXPORT_TOKEN: {yesNo(tokenAliasPresent.VYVA_MARKETING_EXPORT_TOKEN)}</p>
                          <p>LOVABLE_MARKETING_API_KEY: {yesNo(tokenAliasPresent.LOVABLE_MARKETING_API_KEY)}</p>
                          <p>VYVA_MARKETING_EXPORT_URL: {yesNo(urlAliasPresent.VYVA_MARKETING_EXPORT_URL)}</p>
                          <p>LOVABLE_MARKETING_API_URL: {yesNo(urlAliasPresent.LOVABLE_MARKETING_API_URL)}</p>
                          <p>Token source: {syncDiagnostics.tokenSource ?? "none"}</p>
                          <p>Sync API build: {syncState.backendBuild ?? "unavailable"}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-red-700">Sync configuration status is unavailable. A marketing data request may have failed before this status loaded, or the deployment may still be running an older backend bundle.</p>
                      )}
                    </div>
                    <div className="mt-3 rounded-xl border border-[#eadfd5] bg-white p-3" data-testid="marketing-email-scheduler-status">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-[#2f2135]">Scheduled email automation</p>
                        <Pill className={emailScheduler.enabled ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}>
                          {emailScheduler.enabled ? "Enabled" : "Disabled"}
                        </Pill>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                        {emailScheduler.enabled
                          ? `Runs every ${emailScheduler.intervalMinutes} min after a ${emailScheduler.initialDelaySeconds}s startup delay.`
                          : "Manual Run due emails button only. Set MARKETING_EMAIL_SCHEDULER_ENABLED=true to automate scheduled email campaigns."}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#8b7a73]">Actor: {emailScheduler.actor}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={exportPreviewButtonDisabled}
                      onClick={() => void previewLovableExport()}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-4 font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                      data-testid="button-marketing-preview-export"
                    >
                      <Eye size={16} /> {exportPreviewRunning ? "Checking export..." : "Check Lovable export"}
                    </button>
                    <button
                      type="button"
                      disabled={syncButtonDisabled}
                      onClick={() => void runLovableSync()}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                      data-testid="button-marketing-run-sync"
                    >
                      <RefreshCw size={16} className={syncRunning ? "animate-spin" : ""} /> {syncRunning ? "Running sync..." : "Run one-way sync"}
                    </button>
                  </div>
                  {exportPreviewFeedback ? (
                    <p
                      className={`rounded-xl px-4 py-3 text-sm font-bold ${exportPreviewFeedbackIsError ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}
                      data-testid="marketing-export-preview-feedback"
                    >
                      {exportPreviewFeedback}
                    </p>
                  ) : null}
                  {exportPreview ? <LovableExportPreviewDiagnostics preview={exportPreview} /> : null}
                  {syncFeedbackText ? (
                    <p
                      className={`rounded-xl px-4 py-3 text-sm font-bold ${syncFeedbackIsError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                      data-testid="marketing-sync-feedback"
                    >
                      {syncFeedbackText}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    {syncState.runs.length === 0 ? <EmptyState text="No Lovable sync runs yet." /> : syncState.runs.map((run) => (
                      <div key={run.id} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Pill className={statusClass(run.status)}>{run.status}</Pill>
                          <span className="text-xs font-bold text-[#7d6b65]">{formatDate(run.createdAt)}</span>
                        </div>
                        {run.error ? <p className="mt-2 text-sm font-bold text-red-700">{run.error}</p> : null}
                        <SyncRunDiagnostics run={run} />
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Channel send readiness" subtitle="Email is enabled through VYVA. Other channels remain locked for now.">
                <div className="grid gap-3">
                  {syncState.lockedSendCapabilities.map((item) => (
                    <div key={item.channel} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                        <Pill className={item.locked ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}>{item.locked ? "Locked" : "Enabled"}</Pill>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#7d6b65]">{item.note}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function LovableExportPreviewDiagnostics({ preview }: { preview: LovableExportPreview }) {
  const exported = syncCountItems(preview.summary, "exported");
  const contentSourceCounts = Object.entries(recordValue(preview.summary.contentSourceCounts))
    .map(([key, value]) => ({ key, value: numberValue(value) }))
    .filter((item) => item.value > 0);
  const fieldCoverage = syncFieldCoverageItems(preview.summary);
  const sampleRows = Object.fromEntries(
    Object.entries(recordValue(preview.samples)).filter(([, value]) => Array.isArray(value) && value.length > 0),
  );
  const rawArraySamples = Object.fromEntries(
    Object.entries(recordValue(preview.rawArraySamples)).filter(([, value]) => Array.isArray(value) && value.length > 0),
  );

  return (
    <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold text-blue-950" data-testid="marketing-export-preview">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="uppercase tracking-[0.12em] text-blue-800">Lovable export preview</p>
          <p className="mt-1 text-sm font-black">Dataset: {preview.dataset || "unknown"}</p>
          {preview.exportedAt ? <p className="mt-1 text-xs font-semibold">Exported at {formatDate(preview.exportedAt)}</p> : null}
        </div>
        <Pill className="bg-white text-blue-800">Preview only</Pill>
      </div>
      {exported.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-blue-800">Available to import</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {exported.map((item) => <Pill key={`preview-exported-${item.key}`} className="bg-white text-blue-800">{item.label}: {item.value}</Pill>)}
          </div>
        </div>
      ) : <p className="rounded-lg bg-white p-3 text-sm font-black text-amber-800">Lovable returned no recognized marketing rows.</p>}
      {contentSourceCounts.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-blue-800">Content source buckets</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {contentSourceCounts.map((item) => <Pill key={item.key} className="bg-white text-purple-800">{item.key}: {item.value}</Pill>)}
          </div>
        </div>
      ) : null}
      {preview.topLevelKeys.length ? (
        <p className="rounded-lg bg-white p-3 font-semibold text-[#5b4a46]">
          Top-level export keys: {preview.topLevelKeys.slice(0, 18).join(", ")}{preview.topLevelKeys.length > 18 ? `, +${preview.topLevelKeys.length - 18} more` : ""}
        </p>
      ) : null}
      {fieldCoverage.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-blue-800">Field coverage before import</p>
          <div className="mt-1 grid gap-1.5">
            {fieldCoverage.map((item) => (
              <div key={item.entity} className="rounded-lg bg-white px-3 py-2">
                <p className="font-black text-[#241133]">{item.entity}: {item.firstClass} of {item.exported} fields mapped first-class</p>
                {item.metadataOnly ? (
                  <p className="mt-1 font-semibold">Metadata-only: {item.metadataOnlyFields.slice(0, 6).join(", ")}{item.metadataOnlyFields.length > 6 ? ` +${item.metadataOnlyFields.length - 6}` : ""}</p>
                ) : <p className="mt-1 font-semibold text-emerald-800">All exported fields are mapped first-class.</p>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <LovableDestinationMap summary={preview.summary} />
      <MetadataPanel title="Recognized sample rows from Lovable" value={sampleRows} testId="marketing-export-preview-samples" />
      <MetadataPanel title="Raw top-level Lovable array samples" value={rawArraySamples} testId="marketing-export-preview-raw-samples" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-4 text-center text-sm font-bold text-[#8b7a73]">{text}</p>;
}

function CampaignTable({ campaigns, activeCampaignId, onEdit, onDelete, actionsDisabled = false, confirmingDeleteId = null }: { campaigns: Campaign[]; activeCampaignId?: string | null; onEdit?: (campaign: Campaign) => void; onDelete?: (campaign: Campaign) => void; actionsDisabled?: boolean; confirmingDeleteId?: string | null }) {
  const showActions = Boolean(onEdit || onDelete);
  return (
    <div className="overflow-x-auto rounded-xl border border-[#eadfd5]" data-testid="marketing-campaign-table">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
          <tr>
            <th className="px-4 py-3">Campaign</th>
            <th className="px-4 py-3">Audience</th>
            <th className="px-4 py-3">Channels</th>
            <th className="px-4 py-3">Schedule</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Recipients</th>
            {showActions ? <th className="px-4 py-3">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr><td colSpan={showActions ? 7 : 6} className="px-4 py-6 text-center font-bold text-[#8b7a73]">No campaigns match the filters.</td></tr>
          ) : campaigns.map((campaign) => {
            const isActive = activeCampaignId === campaign.id;
            const deleteIsArmed = confirmingDeleteId === campaign.id;
            return (
            <tr
              key={campaign.id}
              className={`border-t border-[#f0e7df] ${onEdit && !actionsDisabled ? "cursor-pointer hover:bg-purple-50" : ""} ${isActive ? "bg-purple-50" : ""}`}
              onClick={onEdit && !actionsDisabled ? () => onEdit(campaign) : undefined}
              onKeyDown={onEdit && !actionsDisabled ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEdit(campaign);
                }
              } : undefined}
              role={onEdit && !actionsDisabled ? "button" : undefined}
              tabIndex={onEdit && !actionsDisabled ? 0 : undefined}
              aria-selected={isActive || undefined}
              data-testid={`row-marketing-campaign-${campaign.id}`}
            >
              <td className="px-4 py-3">
                <p className="font-black">{campaign.name}</p>
                <p className="text-xs font-semibold text-[#7d6b65]">{campaign.objective || campaign.source}</p>
              </td>
              <td className="px-4 py-3 font-black">{campaign.audienceType.toUpperCase()}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {campaign.channels.length === 0 ? <span className="text-xs font-bold text-[#8b7a73]">No channels</span> : campaign.channels.map((item) => (
                    <Pill key={item.id} className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 font-bold text-[#7d6b65]">
                <p>{formatDate(campaign.scheduleStartsAt)}</p>
                {campaign.scheduleEndsAt ? <p className="text-xs">Ends {formatDate(campaign.scheduleEndsAt)}</p> : null}
              </td>
              <td className="px-4 py-3"><Pill className={statusClass(campaign.status)}>{campaign.status}</Pill></td>
              <td className="px-4 py-3 font-black">{campaign.recipientCount}</td>
              {showActions ? (
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {onEdit ? (
                      <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(campaign); }} disabled={actionsDisabled} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]" data-testid={`button-marketing-edit-campaign-${campaign.id}`}>
                        <Pencil size={14} /> Edit
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(campaign); }} disabled={actionsDisabled} className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] disabled:text-red-300 ${deleteIsArmed ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} data-testid={`button-marketing-delete-campaign-${campaign.id}`}>
                        <Trash2 size={14} /> {deleteIsArmed ? "Confirm delete" : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MarketingCalendarView({ campaigns, onEdit, onDelete, confirmingDeleteId = null }: { campaigns: Campaign[]; onEdit: (campaign: Campaign) => void; onDelete: (campaign: Campaign) => void; confirmingDeleteId?: string | null }) {
  const scheduledCampaigns = [...campaigns]
    .filter((campaign) => campaign.scheduleStartsAt)
    .sort((a, b) => new Date(a.scheduleStartsAt ?? 0).getTime() - new Date(b.scheduleStartsAt ?? 0).getTime());
  const unscheduledCampaigns = campaigns.filter((campaign) => !campaign.scheduleStartsAt);
  const days = scheduledCampaigns.reduce<Array<{ key: string; campaigns: Campaign[] }>>((result, campaign) => {
    const key = calendarDayKey(campaign.scheduleStartsAt);
    const existing = result.find((item) => item.key === key);
    if (existing) existing.campaigns.push(campaign);
    else result.push({ key, campaigns: [campaign] });
    return result;
  }, []);

  if (!campaigns.length) return <EmptyState text="No campaigns match the filters." />;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" data-testid="marketing-calendar-scheduler">
      <div className="grid content-start gap-3" data-testid="marketing-calendar-timeline">
        {days.length === 0 ? (
          <EmptyState text="No scheduled campaigns match the filters." />
        ) : days.map((day) => (
          <section key={day.key} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-black text-[#241133]">{formatCalendarDay(day.key)}</h3>
              <Pill className="bg-sky-50 text-sky-700">{day.campaigns.length} scheduled</Pill>
            </div>
            <div className="grid gap-2">
              {day.campaigns.map((campaign) => (
                <article key={campaign.id} className="rounded-xl border border-[#eadfd5] bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                        <Clock size={13} aria-hidden="true" /> {formatCalendarTime(campaign.scheduleStartsAt)}
                      </p>
                      {campaign.scheduleEndsAt ? (
                        <p className="mt-1 text-xs font-bold text-[#7d6b65]">Ends {formatCalendarTime(campaign.scheduleEndsAt)}</p>
                      ) : null}
                      <h4 className="mt-1 font-black text-[#241133]">{campaign.name}</h4>
                      <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{campaign.objective || campaign.source}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Pill className={statusClass(campaign.status)}>{campaign.status}</Pill>
                      <Pill className="bg-purple-50 text-purple-700">{campaign.audienceType.toUpperCase()}</Pill>
                      <Pill className="bg-[#f5eee8] text-[#7d6b65]">{campaign.recipientCount} recipients</Pill>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {campaign.channels.length === 0 ? (
                        <span className="text-xs font-bold text-[#8b7a73]">No channels</span>
                      ) : campaign.channels.map((item) => (
                        <Pill key={item.id} className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onEdit(campaign)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700" data-testid={`button-marketing-calendar-edit-${campaign.id}`}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button type="button" onClick={() => onDelete(campaign)} className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black ${confirmingDeleteId === campaign.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`} data-testid={`button-marketing-calendar-delete-${campaign.id}`}>
                        <Trash2 size={14} /> {confirmingDeleteId === campaign.id ? "Confirm delete" : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="grid content-start gap-3 rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="marketing-calendar-unscheduled">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-[#241133]">Unscheduled drafts</h3>
          <Pill className="bg-amber-50 text-amber-800">{unscheduledCampaigns.length}</Pill>
        </div>
        {unscheduledCampaigns.length === 0 ? (
          <EmptyState text="No unscheduled campaigns." />
        ) : unscheduledCampaigns.map((campaign) => (
          <button
            key={campaign.id}
            type="button"
            onClick={() => onEdit(campaign)}
            className="rounded-xl border border-[#eadfd5] bg-white p-3 text-left transition hover:border-purple-200 hover:bg-purple-50"
            data-testid={`button-marketing-calendar-unscheduled-${campaign.id}`}
          >
            <span className="block font-black text-[#241133]">{campaign.name}</span>
            <span className="mt-1 block text-xs font-bold text-[#7d6b65]">{campaign.objective || campaign.source}</span>
            <span className="mt-2 flex flex-wrap gap-1.5">
              <Pill className={statusClass(campaign.status)}>{campaign.status}</Pill>
              <Pill className="bg-purple-50 text-purple-700">{campaign.audienceType.toUpperCase()}</Pill>
            </span>
          </button>
        ))}
      </aside>
    </div>
  );
}
