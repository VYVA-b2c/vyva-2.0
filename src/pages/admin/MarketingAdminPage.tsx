import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
type CampaignStatus = typeof CAMPAIGN_STATUSES[number];
type JourneyStatus = typeof JOURNEY_STATUSES[number];
type ContentStatus = typeof CONTENT_STATUSES[number];
type ConsentStatus = typeof CONSENT_STATUSES[number];

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

type SyncState = {
  provider: string;
  configured: boolean;
  canRunSync: boolean;
  requiredRunnerEmail: string | null;
  apiUrl: string | null;
  mode: string;
  realSendingLocked: boolean;
  lockedSendCapabilities: SendCapability[];
  runs: SyncRun[];
};

type CampaignDraft = {
  name: string;
  audienceType: Audience;
  channel: Channel;
  status: "draft" | "scheduled";
  scheduleStartsAt: string;
  objective: string;
};

type CampaignEditDraft = {
  name: string;
  audienceType: Audience;
  channel: Channel;
  contentAssetId: string;
  status: CampaignStatus;
  scheduleStartsAt: string;
  timezone: string;
  objective: string;
  recipientFilter: string;
  snapshotRecipients: boolean;
};

type JourneyEditDraft = {
  name: string;
  audienceType: Audience;
  status: JourneyStatus;
  objective: string;
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
  subject: string;
  body: string;
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
  designJsonText: string;
  mediaAssetsText: string;
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
};

type AudienceDraft = {
  name: string;
  listType: string;
  description: string;
  rulesText: string;
  contactExternalIds: string;
};

type AudienceEditDraft = AudienceDraft;

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
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
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

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

function journeyEditDraftFromJourney(journey: Journey): JourneyEditDraft {
  return {
    name: journey.name,
    audienceType: journey.audienceType,
    status: normalizeJourneyStatus(journey.status),
    objective: journey.objective,
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
    designJsonText: jsonText(content.designJson),
    mediaAssetsText: jsonArrayText(content.mediaAssets),
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
    designJson: parseJsonText(draft.designJsonText, "Design JSON"),
    mediaAssets: parseJsonArrayText(draft.mediaAssetsText, "Media assets"),
  };
}

function contactEditDraftFromContact(contact: MarketingContact): ContactEditDraft {
  return {
    fullName: contact.fullName,
    audienceType: contact.audienceType,
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
  };
}

function contactPayloadFromDraft(draft: ContactEditDraft) {
  return {
    fullName: draft.fullName,
    audienceType: draft.audienceType,
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
    tags: splitTags(draft.tags),
    channelAvailability: {
      email: Boolean(draft.email),
      phone: Boolean(draft.phoneNumber),
      whatsapp: Boolean(draft.whatsappNumber),
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
  };
}

function audiencePayloadFromDraft(draft: AudienceEditDraft) {
  return {
    name: draft.name,
    listType: draft.listType || "dynamic",
    description: draft.description || null,
    rules: parseRulesText(draft.rulesText),
    contactExternalIds: splitLines(draft.contactExternalIds),
  };
}

function journeyPayloadFromDraft(draft: JourneyEditDraft) {
  return {
    name: draft.name.trim(),
    audienceType: draft.audienceType,
    status: draft.status,
    objective: draft.objective,
    triggerType: draft.triggerType.trim() || null,
    triggerConfig: parseJsonText(draft.triggerConfigText, "Trigger config"),
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
    contact.fullName,
    contact.email,
    contact.phoneNumber,
    contact.whatsappNumber,
    contact.roleLabel,
    contact.companyName,
    contact.language,
    contact.category,
    contact.vertical,
    contact.market,
    contact.source,
    ...(contact.tags ?? []),
    ...(contact.lists ?? []),
  ].map((value) => lower(value)).join(" ");
}

function contactDirectChannels(contact: MarketingContact) {
  return [
    contact.email ? `Email: ${contact.email}` : "",
    contact.phoneNumber ? `Phone: ${contact.phoneNumber}` : "",
    contact.whatsappNumber ? `WhatsApp: ${contact.whatsappNumber}` : "",
  ].filter(Boolean);
}

function contactSegments(contact: MarketingContact) {
  return [
    contact.language ? `Lang: ${contact.language}` : "",
    contact.category ? `Category: ${contact.category}` : "",
    contact.vertical ? `Vertical: ${contact.vertical}` : "",
    contact.market ? `Market: ${contact.market}` : "",
    ...(contact.tags ?? []),
    ...(contact.lists ?? []).map((list) => `List: ${list}`),
  ].filter(Boolean);
}

const syncCountLabels = {
  campaigns: "Campaigns",
  contacts: "Contacts",
  content: "Content",
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

function syncFieldCoverageItems(summary: Record<string, unknown>) {
  const coverage = recordValue(summary.fieldCoverage);
  return Object.entries(coverage).map(([entity, value]) => {
    const item = recordValue(value);
    const metadataOnlyFields = Array.isArray(item.metadataOnlyFields) ? item.metadataOnlyFields.map(String).filter(Boolean) : [];
    return {
      entity,
      exported: numberValue(item.exportedFieldCount),
      firstClass: numberValue(item.firstClassFieldCount),
      metadataOnly: numberValue(item.metadataOnlyFieldCount),
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
  const unmappedCount = syncUnmappedCount(run.summary);
  const unmappedCampaignRecipientCount = syncUnmappedCampaignRecipientCount(run.summary);
  const unmappedSample = syncUnmappedSample(run.summary);
  const fieldCoverage = syncFieldCoverageItems(run.summary);
  if (!exported.length && !imported.length && !skipped.length && !unmappedCount && !unmappedCampaignRecipientCount && !fieldCoverage.length) return null;
  return (
    <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 text-xs font-bold text-[#7d6b65]" data-testid={`marketing-sync-diagnostics-${run.id}`}>
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
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-[#E5D8CA] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const textareaClass = "min-h-[92px] w-full rounded-xl border border-[#E5D8CA] bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";

export default function MarketingAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
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
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>({ name: "", audienceType: "b2c", channel: "email", status: "draft", scheduleStartsAt: "", objective: "" });
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignEditDraft, setCampaignEditDraft] = useState<CampaignEditDraft>({
    name: "",
    audienceType: "b2c",
    channel: "email",
    contentAssetId: "",
    status: "draft",
    scheduleStartsAt: "",
    timezone: "Europe/Madrid",
    objective: "",
    recipientFilter: "",
    snapshotRecipients: false,
  });
  const [editingJourneyId, setEditingJourneyId] = useState<string | "new" | null>(null);
  const [journeyEditDraft, setJourneyEditDraft] = useState<JourneyEditDraft>(() => emptyJourneyEditDraft());
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeyFeedback, setJourneyFeedback] = useState("");
  const [contentDraft, setContentDraft] = useState<ContentDraft>({ title: "", channel: "email", subject: "", body: "" });
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [contentEditDraft, setContentEditDraft] = useState<ContentEditDraft | null>(null);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentFeedback, setContentFeedback] = useState("");
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
  const [audienceDraft, setAudienceDraft] = useState<AudienceDraft>({ name: "", listType: "dynamic", description: "", rulesText: "{\n  \"market\": \"Spain\"\n}", contactExternalIds: "" });
  const [editingAudienceId, setEditingAudienceId] = useState<string | null>(null);
  const [audienceEditDraft, setAudienceEditDraft] = useState<AudienceEditDraft | null>(null);
  const [audienceSaving, setAudienceSaving] = useState(false);
  const [audienceFeedback, setAudienceFeedback] = useState("");

  async function refreshAll() {
    const [summaryBody, campaignBody, journeyBody, enrollmentBody, contentBody, mediaBody, analyticsBody, contactBody, audienceBody, syncBody] = await Promise.all([
      api<MarketingSummary>("/api/admin/marketing/summary"),
      api<{ campaigns: Campaign[] }>("/api/admin/marketing/campaigns"),
      api<{ journeys: Journey[] }>("/api/admin/marketing/journeys"),
      api<{ enrollments: JourneyEnrollment[] }>("/api/admin/marketing/journey-enrollments"),
      api<{ content: ContentAsset[] }>("/api/admin/marketing/content"),
      api<{ mediaAssets: MarketingMediaAsset[] }>("/api/admin/marketing/media"),
      api<{ totals: MarketingAnalyticsTotals; metrics: MarketingCampaignMetric[] }>("/api/admin/marketing/analytics"),
      api<{ contacts: MarketingContact[] }>("/api/admin/marketing/contacts"),
      api<{ audiences: MarketingAudience[] }>("/api/admin/marketing/audiences"),
      api<SyncState>("/api/admin/marketing/sync/lovable"),
    ]);
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
    setSyncState(syncBody);
  }

  useEffect(() => {
    refreshAll().catch((error) => setMessage(error.message));
  }, []);

  const visibleCampaigns = useMemo(() => campaigns.filter((campaign) => {
    const matchesSearch = !search || lower(campaign.name).includes(search.toLowerCase()) || lower(campaign.objective).includes(search.toLowerCase());
    const matchesAudience = audienceFilter === "all" || campaign.audienceType === audienceFilter;
    const matchesChannel = channelFilter === "all" || campaign.channels.some((item) => item.channel === channelFilter);
    return matchesSearch && matchesAudience && matchesChannel;
  }), [campaigns, search, audienceFilter, channelFilter]);

  const visibleContent = useMemo(() => content.filter((item) => {
    const matchesSearch = !search || lower(item.title).includes(search.toLowerCase()) || lower(item.subject).includes(search.toLowerCase()) || lower(item.body).includes(search.toLowerCase());
    const matchesChannel = channelFilter === "all" || item.channel === channelFilter;
    return matchesSearch && matchesChannel;
  }), [content, search, channelFilter]);

  const visibleMediaAssets = useMemo(() => mediaAssets.filter((item) => {
    const haystack = [item.contentTitle, item.originalUrl, item.localUrl, item.assetType, item.status, item.source].map((value) => lower(value)).join(" ");
    return !search || haystack.includes(search.toLowerCase());
  }), [mediaAssets, search]);

  const visibleContacts = useMemo(() => contacts.filter((contact) => {
    const matchesSearch = !search || contactSearchText(contact).includes(search.toLowerCase());
    const matchesAudience = audienceFilter === "all" || contact.audienceType === audienceFilter;
    return matchesSearch && matchesAudience;
  }), [contacts, search, audienceFilter]);

  const visibleAudiences = useMemo(() => audiences.filter((audience) => {
    const haystack = [
      audience.name,
      audience.description,
      audience.listType,
      audience.source,
      audience.lovableExternalId,
      ...(audience.unmappedContactExternalIds ?? []),
    ].map((value) => lower(value)).join(" ");
    return !search || haystack.includes(search.toLowerCase());
  }), [audiences, search]);

  const editingCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null, [campaigns, editingCampaignId]);
  const editingJourney = useMemo(() => editingJourneyId && editingJourneyId !== "new" ? journeys.find((journey) => journey.id === editingJourneyId) ?? null : null, [journeys, editingJourneyId]);
  const editingContent = useMemo(() => content.find((item) => item.id === editingContentId) ?? null, [content, editingContentId]);
  const selectedContent = useMemo(() => content.find((item) => item.id === selectedContentId) ?? visibleContent[0] ?? null, [content, selectedContentId, visibleContent]);
  const selectedContentMediaAssets = useMemo(() => {
    if (!selectedContent) return [];
    return mediaAssets.filter((item) => item.contentAssetId === selectedContent.id);
  }, [mediaAssets, selectedContent]);
  const enrollmentsByJourneyId = useMemo(() => groupCount(journeyEnrollments, (item) => item.journeyId), [journeyEnrollments]);
  const activeEnrollmentsByJourneyId = useMemo(() => groupCount(journeyEnrollments.filter((item) => item.status === "active"), (item) => item.journeyId), [journeyEnrollments]);
  const emailContentAssets = useMemo(() => content.filter((item) => item.channel === "email" && item.status !== "archived"), [content]);
  const selectedEmailContent = useMemo(
    () => emailContentAssets.find((item) => item.id === campaignEditDraft.contentAssetId) ?? null,
    [campaignEditDraft.contentAssetId, emailContentAssets],
  );
  const editingContact = useMemo(() => contacts.find((contact) => contact.id === editingContactId) ?? null, [contacts, editingContactId]);
  const editingAudience = useMemo(() => audiences.find((audience) => audience.id === editingAudienceId) ?? null, [audiences, editingAudienceId]);

  const campaignRecipientPreview = useMemo(() => {
    if (!editingCampaignId || !campaignEditDraft.snapshotRecipients) return [];
    const filter = campaignEditDraft.recipientFilter.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!campaignAllowsContact(campaignEditDraft.audienceType, contact.audienceType)) return false;
      if (!recipientForChannel(contact, campaignEditDraft.channel)) return false;
      return !filter || contactSearchText(contact).includes(filter);
    });
  }, [campaignEditDraft, contacts, editingCampaignId]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    if (!campaignDraft.name.trim()) {
      setMessage("Campaign name is required before creating a draft.");
      return;
    }
    await api("/api/admin/marketing/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: campaignDraft.name,
        audienceType: campaignDraft.audienceType,
        status: campaignDraft.status,
        objective: campaignDraft.objective,
        scheduleStartsAt: campaignDraft.scheduleStartsAt ? new Date(campaignDraft.scheduleStartsAt).toISOString() : null,
        channels: [{ channel: campaignDraft.channel, status: campaignDraft.status, scheduledAt: campaignDraft.scheduleStartsAt ? new Date(campaignDraft.scheduleStartsAt).toISOString() : null }],
      }),
    });
    setCampaignDraft({ name: "", audienceType: "b2c", channel: "email", status: "draft", scheduleStartsAt: "", objective: "" });
    setMessage("Campaign draft created. Sending remains locked.");
    await refreshAll();
  }

  function startCampaignEdit(campaign: Campaign) {
    const firstChannel = campaign.channels[0];
    setEditingCampaignId(campaign.id);
    setCampaignEditDraft({
      name: campaign.name,
      audienceType: campaign.audienceType,
      channel: firstChannel?.channel ?? "email",
      contentAssetId: firstChannel?.contentAssetId ?? "",
      status: normalizeCampaignStatus(campaign.status),
      scheduleStartsAt: toDateTimeLocal(campaign.scheduleStartsAt),
      timezone: campaign.timezone || "Europe/Madrid",
      objective: campaign.objective,
      recipientFilter: "",
      snapshotRecipients: false,
    });
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
    setTestEmailFeedback("");
    setCampaignEmailFeedback("");
    setCampaignEditDraft({
      name: "",
      audienceType: "b2c",
      channel: "email",
      contentAssetId: "",
      status: "draft",
      scheduleStartsAt: "",
      timezone: "Europe/Madrid",
      objective: "",
      recipientFilter: "",
      snapshotRecipients: false,
    });
  }

  async function saveCampaignEdit(event: FormEvent, campaignId: string) {
    event.preventDefault();
    if (!campaignEditDraft.name.trim()) {
      setMessage("Campaign name is required before saving.");
      return;
    }
    const scheduledAt = fromDateTimeLocal(campaignEditDraft.scheduleStartsAt);
    const recipients = campaignEditDraft.snapshotRecipients
      ? campaignRecipientPreview.map((contact) => ({
        contactId: contact.id,
        channel: campaignEditDraft.channel,
        recipient: recipientForChannel(contact, campaignEditDraft.channel) ?? contact.id,
        status: "planned",
        scheduledAt,
        snapshot: recipientSnapshot(contact),
      }))
      : undefined;
    await api(`/api/admin/marketing/campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: campaignEditDraft.name,
        audienceType: campaignEditDraft.audienceType,
        status: campaignEditDraft.status,
        objective: campaignEditDraft.objective,
        scheduleStartsAt: scheduledAt,
        timezone: campaignEditDraft.timezone,
        channels: [{
          channel: campaignEditDraft.channel,
          contentAssetId: campaignEditDraft.channel === "email" ? campaignEditDraft.contentAssetId || null : null,
          status: campaignEditDraft.status,
          scheduledAt,
        }],
        ...(recipients ? { recipients } : {}),
      }),
    });
    const recipientMessage = campaignEditDraft.snapshotRecipients ? ` ${recipients?.length ?? 0} recipients snapshotted.` : "";
    setCampaignEditDraft((draft) => ({ ...draft, snapshotRecipients: false }));
    setCampaignEmailFeedback("");
    setTestEmailFeedback("");
    setMessage(`Campaign updated.${recipientMessage}`);
    await refreshAll();
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
    if (!window.confirm(`Send email campaign "${campaign.name}" to ${campaign.recipientCount} saved recipient${campaign.recipientCount === 1 ? "" : "s"} now?`)) return;
    setCampaignEmailSending(true);
    setCampaignEmailFeedback("Sending campaign emails...");
    try {
      const result = await api<CampaignEmailSendResponse>(`/api/admin/marketing/campaigns/${campaign.id}/send-email`, { method: "POST" });
      const summaryText = `Campaign email sent to ${result.sentCount} recipient${result.sentCount === 1 ? "" : "s"}. ${result.failedCount ? `${result.failedCount} failed. ` : ""}${result.skippedCount ? `${result.skippedCount} skipped.` : ""}`.trim();
      setCampaignEmailFeedback(summaryText);
      setMessage(summaryText);
      await refreshAll();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Campaign email could not be sent.";
      setCampaignEmailFeedback(messageText);
      setMessage(messageText);
    } finally {
      setCampaignEmailSending(false);
    }
  }

  async function sendDueCampaignEmails() {
    if (!window.confirm("Send all due scheduled email campaigns now?")) return;
    setDueEmailSending(true);
    setDueEmailFeedback("Checking due scheduled email campaigns...");
    try {
      const result = await api<DueCampaignEmailSendResponse>("/api/admin/marketing/campaigns/send-due-email", { method: "POST" });
      const summaryText = result.dueCount === 0
        ? "No scheduled email campaigns are due."
        : `Due email run checked ${result.dueCount} campaign${result.dueCount === 1 ? "" : "s"}: ${result.sentCount} sent, ${result.failedCount} failed, ${result.skippedCount} skipped.`;
      setDueEmailFeedback(summaryText);
      setMessage(summaryText);
      await refreshAll();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Due scheduled emails could not be sent.";
      setDueEmailFeedback(messageText);
      setMessage(messageText);
    } finally {
      setDueEmailSending(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!window.confirm(`Delete campaign "${campaign.name}"? This removes the local VYVA planning record.`)) return;
    await api(`/api/admin/marketing/campaigns/${campaign.id}`, { method: "DELETE" });
    if (editingCampaignId === campaign.id) cancelCampaignEdit();
    setMessage("Campaign deleted.");
    await refreshAll();
  }

  function startNewJourney() {
    setEditingJourneyId("new");
    setJourneyEditDraft(emptyJourneyEditDraft());
    setJourneyFeedback("");
    setMessage("");
  }

  function startJourneyEdit(journey: Journey) {
    setEditingJourneyId(journey.id);
    setJourneyEditDraft(journeyEditDraftFromJourney(journey));
    setJourneyFeedback("");
    setMessage("");
  }

  function cancelJourneyEdit() {
    setEditingJourneyId(null);
    setJourneyEditDraft(emptyJourneyEditDraft());
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
      const payload = journeyPayloadFromDraft(journeyEditDraft);
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
      setJourneyEditDraft(journeyEditDraftFromJourney(result.journey));
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
    if (!window.confirm(`Delete journey "${journey.name}"? This removes the local VYVA planning record.`)) return;
    setJourneySaving(true);
    setJourneyFeedback("Deleting journey...");
    try {
      await api(`/api/admin/marketing/journeys/${journey.id}`, { method: "DELETE" });
      if (editingJourneyId === journey.id) cancelJourneyEdit();
      setJourneyFeedback("Deleted.");
      setMessage("Journey deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Journey could not be deleted.";
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
          subject: contentDraft.subject || null,
          body: contentDraft.body,
        }),
      });
      setContentDraft({ title: "", channel: "email", subject: "", body: "" });
      setSelectedContentId(result.content.id);
      setEditingContentId(result.content.id);
      setContentEditDraft(contentEditDraftFromContent(result.content));
      setContentFeedback("Content draft created.");
      setMessage("Content draft created.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Content draft could not be created.";
      setContentFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContentSaving(false);
    }
  }

  function startContentEdit(contentAsset: ContentAsset) {
    setSelectedContentId(contentAsset.id);
    setEditingContentId(contentAsset.id);
    setContentEditDraft(contentEditDraftFromContent(contentAsset));
    setContentFeedback("");
  }

  function cancelContentEdit() {
    setEditingContentId(null);
    setContentEditDraft(null);
    setContentFeedback("");
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
      setContentFeedback("Updated.");
      setMessage("Content updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Content could not be saved.";
      setContentFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContentSaving(false);
    }
  }

  async function deleteContent(contentAsset: ContentAsset) {
    if (!window.confirm(`Delete content "${contentAsset.title}"? Campaigns and journey steps will keep their records but lose this content link.`)) return;
    setContentSaving(true);
    setContentFeedback("Deleting content...");
    try {
      await api(`/api/admin/marketing/content/${contentAsset.id}`, { method: "DELETE" });
      if (editingContentId === contentAsset.id) cancelContentEdit();
      if (selectedContentId === contentAsset.id) setSelectedContentId(null);
      setContentFeedback("Deleted.");
      setMessage("Content deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Content could not be deleted.";
      setContentFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContentSaving(false);
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
    setContactFeedback("");
  }

  function cancelContactEdit() {
    setEditingContactId(null);
    setContactEditDraft(null);
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
    if (!window.confirm(`Delete contact "${contact.fullName || contact.email || contact.phoneNumber || "Unnamed contact"}"? Audience memberships will be removed and campaign/journey history will keep its records.`)) return;
    setContactSaving(true);
    setContactFeedback("Deleting contact...");
    try {
      await api(`/api/admin/marketing/contacts/${contact.id}`, { method: "DELETE" });
      if (editingContactId === contact.id) cancelContactEdit();
      setContactFeedback("Contact deleted.");
      setMessage("Marketing contact deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Marketing contact could not be deleted.";
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
    setAudienceFeedback("");
  }

  function cancelAudienceEdit() {
    setEditingAudienceId(null);
    setAudienceEditDraft(null);
    setAudienceFeedback("");
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
    if (!window.confirm(`Delete list "${audience.name}"? Contacts will stay in marketing contacts; only this list and its memberships are removed.`)) return;
    setAudienceSaving(true);
    setAudienceFeedback("Deleting audience...");
    try {
      await api(`/api/admin/marketing/audiences/${audience.id}`, { method: "DELETE" });
      if (editingAudienceId === audience.id) cancelAudienceEdit();
      setAudienceFeedback("Audience deleted.");
      setMessage("Audience deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Audience could not be deleted.";
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

  const syncBlockedReason = !syncState.configured
    ? "Set LOVABLE_MARKETING_API_URL and LOVABLE_MARKETING_API_KEY before running a sync."
    : syncState.canRunSync === false
      ? `Only the super admin${syncState.requiredRunnerEmail ? ` (${syncState.requiredRunnerEmail})` : ""} can run Lovable sync.`
      : "";
  const syncButtonDisabled = Boolean(syncBlockedReason) || syncRunning;
  const syncFeedbackText = syncFeedback || syncBlockedReason;
  const syncFeedbackIsError = Boolean(syncBlockedReason) || /fail|error|unauthorized|forbidden|not configured|only the super admin/i.test(syncFeedback);
  const testEmailDisabled = !editingCampaign || testEmailSending || campaignEditDraft.channel !== "email" || !campaignEditDraft.contentAssetId;
  const savedCampaignChannel = editingCampaign?.channels[0] ?? null;
  const hasUnsavedCampaignSendChanges = Boolean(editingCampaign && (
    campaignEditDraft.name !== editingCampaign.name ||
    campaignEditDraft.audienceType !== editingCampaign.audienceType ||
    campaignEditDraft.status !== normalizeCampaignStatus(editingCampaign.status) ||
    campaignEditDraft.scheduleStartsAt !== toDateTimeLocal(editingCampaign.scheduleStartsAt) ||
    campaignEditDraft.timezone !== (editingCampaign.timezone || "Europe/Madrid") ||
    campaignEditDraft.objective !== editingCampaign.objective ||
    campaignEditDraft.channel !== (savedCampaignChannel?.channel ?? "email") ||
    campaignEditDraft.contentAssetId !== (savedCampaignChannel?.contentAssetId ?? "") ||
    campaignEditDraft.snapshotRecipients
  ));
  const campaignEmailDisabled = !editingCampaign || campaignEmailSending || hasUnsavedCampaignSendChanges || campaignEditDraft.channel !== "email" || !campaignEditDraft.contentAssetId || editingCampaign.recipientCount <= 0;
  const testEmailBlockedReason = campaignEditDraft.channel !== "email"
    ? "Test sending is email-only in this first unlock."
    : !campaignEditDraft.contentAssetId
      ? "Attach an email content asset before sending a test."
      : "";
  const campaignEmailBlockedReason = campaignEditDraft.channel !== "email"
    ? "Campaign sending is email-only right now."
    : hasUnsavedCampaignSendChanges
      ? "Save campaign changes before sending."
      : !campaignEditDraft.contentAssetId
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
              <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns, content, or contacts" data-testid="input-marketing-search" />
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
                  <div className="overflow-hidden rounded-xl border border-[#eadfd5]" data-testid="marketing-analytics-table">
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

              <SectionCard title="Campaign planner" subtitle="Create draft or scheduled campaign metadata. No provider dispatch is triggered.">
                <form className="grid gap-3 xl:grid-cols-[1fr_160px_160px_200px_auto]" onSubmit={(event) => createCampaign(event).catch((error) => setMessage(error.message))}>
                  <Field label="Campaign name">
                    <input className={inputClass} value={campaignDraft.name} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Summer caregiver onboarding" data-testid="input-marketing-campaign-name" />
                  </Field>
                  <Field label="Audience">
                    <select className={inputClass} value={campaignDraft.audienceType} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, audienceType: event.target.value as Audience }))}>
                      {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                    </select>
                  </Field>
                  <Field label="Channel">
                    <select className={inputClass} value={campaignDraft.channel} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, channel: event.target.value as Channel }))}>
                      {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                    </select>
                  </Field>
                  <Field label="Schedule">
                    <input className={inputClass} type="datetime-local" value={campaignDraft.scheduleStartsAt} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, scheduleStartsAt: event.target.value, status: event.target.value ? "scheduled" : "draft" }))} />
                  </Field>
                  <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white" type="submit" data-testid="button-marketing-create-campaign">
                    <Plus size={16} /> Add campaign
                  </button>
                </form>
                <textarea className={`${textareaClass} mt-3`} value={campaignDraft.objective} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, objective: event.target.value }))} placeholder="Objective or internal notes" />
              </SectionCard>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
                <SectionCard title="Campaign list" subtitle={`${visibleCampaigns.length} visible of ${campaigns.length} campaigns. Click a campaign to open full details.`}>
                  <CampaignTable
                    campaigns={visibleCampaigns}
                    activeCampaignId={editingCampaignId}
                    onEdit={startCampaignEdit}
                    onDelete={(campaign) => deleteCampaign(campaign).catch((error) => setMessage(error.message))}
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

                      <MetadataPanel title="Imported campaign metadata" value={editingCampaign.metadata} testId="marketing-campaign-metadata-panel" />

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
                            <select className={inputClass} value={campaignEditDraft.status} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, status: event.target.value as CampaignStatus }))} data-testid="select-marketing-edit-campaign-status">
                              {CAMPAIGN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </Field>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-2">
                          <Field label="Channel">
                            <select className={inputClass} value={campaignEditDraft.channel} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, channel: event.target.value as Channel, contentAssetId: event.target.value === "email" ? draft.contentAssetId : "" }))} data-testid="select-marketing-edit-campaign-channel">
                              {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                            </select>
                          </Field>
                          <Field label="Email content">
                            <select
                              className={inputClass}
                              value={campaignEditDraft.contentAssetId}
                              disabled={campaignEditDraft.channel !== "email"}
                              onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, contentAssetId: event.target.value }))}
                              data-testid="select-marketing-edit-campaign-content"
                            >
                              <option value="">{campaignEditDraft.channel === "email" ? "Select email content" : "Email only"}</option>
                              {emailContentAssets.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                            </select>
                          </Field>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-2">
                          <Field label="Schedule">
                            <input className={inputClass} type="datetime-local" value={campaignEditDraft.scheduleStartsAt} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, scheduleStartsAt: event.target.value }))} data-testid="input-marketing-edit-campaign-schedule" />
                          </Field>
                          <Field label="Timezone">
                            <input className={inputClass} value={campaignEditDraft.timezone} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, timezone: event.target.value }))} data-testid="input-marketing-edit-campaign-timezone" />
                          </Field>
                        </div>
                        <Field label="Objective">
                          <textarea className={textareaClass} value={campaignEditDraft.objective} onChange={(event) => setCampaignEditDraft((draft) => ({ ...draft, objective: event.target.value }))} data-testid="input-marketing-edit-campaign-objective" />
                        </Field>
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
                        <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white" data-testid="button-marketing-save-campaign">
                          <Save size={15} /> Save campaign
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
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                          data-testid="button-marketing-send-campaign-email"
                        >
                          <Send size={15} /> {campaignEmailSending ? "Sending campaign..." : "Send campaign emails"}
                        </button>
                        <button type="button" onClick={cancelCampaignEdit} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#2f2135]" data-testid="button-marketing-cancel-campaign">
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
                subtitle={`${journeys.length} journeys in the planning foundation.`}
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
                    {journeys.length === 0 ? <EmptyState text="No journeys yet." /> : journeys.map((journey) => {
                      const isActive = editingJourneyId === journey.id;
                      return (
                        <article key={journey.id} className={`rounded-xl border p-4 ${isActive ? "border-purple-300 bg-purple-50" : "border-[#eadfd5] bg-[#fffaf4]"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-black">{journey.name}</h3>
                              <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{journey.objective || "No objective yet."}</p>
                              {journey.source === "lovable" ? <p className="mt-1 text-xs font-bold text-[#8b7a73]">Lovable source can reimport this after sync.</p> : null}
                              <p className="mt-1 text-xs font-bold text-[#7d6b65]">{activeEnrollmentsByJourneyId.get(journey.id) ?? 0} active / {enrollmentsByJourneyId.get(journey.id) ?? 0} total enrollments</p>
                              {(journey.triggerType || journey.goalType) ? (
                                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-black" data-testid={`marketing-journey-logic-${journey.id}`}>
                                  {journey.triggerType ? <Pill className="bg-blue-50 text-blue-800">Trigger: {journey.triggerType}</Pill> : null}
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
                                <Trash2 size={14} /> Delete
                              </button>
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

                      <div className="grid gap-3 xl:grid-cols-[1fr_150px_150px]">
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
                      </div>

                      <Field label="Objective / notes">
                        <textarea className={textareaClass} value={journeyEditDraft.objective} onChange={(event) => setJourneyEditDraft((draft) => ({ ...draft, objective: event.target.value }))} disabled={journeySaving} data-testid="textarea-marketing-edit-journey-objective" />
                      </Field>

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

                      <MetadataPanel title="Imported journey metadata" value={editingJourney?.metadata} testId="marketing-journey-metadata-panel" />

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
                              const selectedContentOption = step.contentAssetId ? content.find((item) => item.id === step.contentAssetId) : null;
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
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Pill className={statusClass(enrollment.status)}>{enrollment.status}</Pill>
                            <Pill className="bg-blue-50 text-blue-800">Step {enrollment.currentStepOrder}</Pill>
                          </div>
                        </div>
                        {enrollment.events.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {enrollment.events.slice(0, 8).map((event) => (
                              <Pill key={event.id} className="bg-white text-[#5b4a46]">{event.eventType} / step {event.stepOrder}</Pill>
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
              <SectionCard title="Content draft" subtitle="Reusable campaign copy by channel and language.">
                <form className="grid gap-3 xl:grid-cols-[1fr_180px_1fr_auto]" onSubmit={(event) => createContent(event).catch((error) => setMessage(error.message))}>
                  <Field label="Title">
                    <input className={inputClass} value={contentDraft.title} onChange={(event) => setContentDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Caregiver invite follow-up" disabled={contentSaving} data-testid="input-marketing-content-title" />
                  </Field>
                  <Field label="Channel">
                    <select className={inputClass} value={contentDraft.channel} onChange={(event) => setContentDraft((draft) => ({ ...draft, channel: event.target.value as Channel }))} disabled={contentSaving}>
                      {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                    </select>
                  </Field>
                  <Field label="Subject">
                    <input className={inputClass} value={contentDraft.subject} onChange={(event) => setContentDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="Optional subject" disabled={contentSaving} />
                  </Field>
                  <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" type="submit" disabled={contentSaving} data-testid="button-marketing-add-content">
                    <FileText size={16} /> {contentSaving ? "Saving..." : "Add content"}
                  </button>
                </form>
                <textarea className={`${textareaClass} mt-3`} value={contentDraft.body} onChange={(event) => setContentDraft((draft) => ({ ...draft, body: event.target.value }))} placeholder="Campaign copy" disabled={contentSaving} />
                {contentFeedback && !contentEditDraft ? (
                  <p className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${contentFeedback.includes("failed") || contentFeedback.includes("required") || contentFeedback.includes("valid JSON") || contentFeedback.includes("could not") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`} data-testid="marketing-content-feedback">
                    {contentFeedback}
                  </p>
                ) : null}
              </SectionCard>
              <SectionCard title="Content library" subtitle={`${visibleContent.length} visible of ${content.length} assets.`}>
                <div className="grid gap-3">
                  {visibleContent.length === 0 ? <EmptyState text="No content matches the filters." /> : visibleContent.map((item) => (
                    <article key={item.id} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{item.title}</h3>
                          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{item.subject || item.body || "No copy yet."}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.hasHtml ? <Pill className="bg-blue-50 text-blue-800">HTML</Pill> : null}
                            {item.hasDesign ? <Pill className="bg-purple-50 text-purple-800">Design data</Pill> : null}
                            {item.mediaAssetCount ? <Pill className="bg-emerald-50 text-emerald-800">{item.mediaAssetCount} media</Pill> : null}
                            {item.ctaLabel || item.ctaUrl ? <Pill className="bg-amber-50 text-amber-800">CTA</Pill> : null}
                          </div>
                          {item.ctaLabel || item.ctaUrl ? (
                            <p className="mt-2 text-xs font-bold text-[#7d6b65]">CTA: {[item.ctaLabel, item.ctaUrl].filter(Boolean).join(" -> ")}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                          <Pill className={statusClass(item.status)}>{item.status}</Pill>
                          {item.source === "lovable" ? <Pill className="bg-violet-50 text-violet-700">Lovable</Pill> : null}
                          <button type="button" onClick={() => setSelectedContentId(item.id)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700" data-testid={`button-marketing-preview-content-${item.id}`}>
                            <Eye size={13} /> Preview
                          </button>
                          <button type="button" onClick={() => startContentEdit(item)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700" disabled={contentSaving} data-testid={`button-marketing-edit-content-${item.id}`}>
                            <Pencil size={13} /> Edit
                          </button>
                          <button type="button" onClick={() => void deleteContent(item)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:bg-[#f5eee8]" disabled={contentSaving} data-testid={`button-marketing-delete-content-${item.id}`}>
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Content editor" subtitle={editingContent ? `Editing ${editingContent.title}` : "Select a content asset to edit imported or local copy."}>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={contentSaving} data-testid="button-marketing-save-content">
                        <Save size={16} /> {contentSaving ? "Saving..." : "Save content"}
                      </button>
                      {editingContent ? (
                        <button type="button" onClick={() => void deleteContent(editingContent)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 font-black text-red-700 disabled:cursor-not-allowed disabled:bg-[#f5eee8]" disabled={contentSaving} data-testid="button-marketing-delete-editing-content">
                          <Trash2 size={16} /> Delete
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
              <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                <SectionCard title="Content preview" subtitle={selectedContent ? selectedContent.title : "Select a content asset to inspect."}>
                  {selectedContent ? (
                    <div className="grid gap-3" data-testid="marketing-content-preview">
                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Subject</p>
                        <p className="mt-1 font-black">{selectedContent.subject || selectedContent.title}</p>
                      </div>
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
                      <div className="grid gap-2 md:grid-cols-3">
                        <Pill className={selectedContent.hasDesign ? "bg-purple-50 text-purple-800" : "bg-[#f5eee8] text-[#7d6b65]"}>{selectedContent.hasDesign ? "Design JSON present" : "No design JSON"}</Pill>
                        <Pill className="bg-blue-50 text-blue-800">{selectedContent.language}</Pill>
                        <Pill className={channelClass(selectedContent.channel)}>{channelLabel[selectedContent.channel]}</Pill>
                      </div>
                      <MetadataPanel title="Imported content metadata" value={selectedContent.metadata} testId="marketing-content-metadata-panel" />
                    </div>
                  ) : (
                    <EmptyState text="No content available." />
                  )}
                </SectionCard>

                <SectionCard title="Media references" subtitle={`${visibleMediaAssets.length} visible of ${mediaAssets.length} imported media rows.`}>
                  <div className="grid gap-3" data-testid="marketing-media-assets-list">
                    {visibleMediaAssets.length === 0 ? (
                      <EmptyState text="No media references imported yet." />
                    ) : visibleMediaAssets.slice(0, 12).map((asset) => (
                      <article key={asset.id} className={`rounded-xl border p-3 ${selectedContentMediaAssets.some((item) => item.id === asset.id) ? "border-purple-200 bg-purple-50" : "border-[#eadfd5] bg-[#fffaf4]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Pill className="bg-blue-50 text-blue-800">{asset.assetType}</Pill>
                          <Pill className={statusClass(asset.status)}>{asset.status}</Pill>
                        </div>
                        <p className="mt-2 text-xs font-black text-[#241133]">{asset.contentTitle || "Unlinked content"}</p>
                        <a className="mt-1 block break-all text-xs font-bold text-purple-700 underline" href={asset.originalUrl} target="_blank" rel="noreferrer">{asset.originalUrl}</a>
                        {asset.localUrl ? <p className="mt-1 break-all text-xs font-bold text-emerald-700">Local: {asset.localUrl}</p> : null}
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
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                    data-testid="button-marketing-run-due-email"
                  >
                    <Send size={15} /> {dueEmailSending ? "Running..." : "Run due emails"}
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
                />
              </SectionCard>
              <SectionCard title="Scheduled campaign details" subtitle="Table view for scheduled records.">
                <CampaignTable
                  campaigns={visibleCampaigns.filter((campaign) => campaign.scheduleStartsAt || campaign.status === "scheduled")}
                  activeCampaignId={editingCampaignId}
                  onEdit={openCampaignFromCalendar}
                  onDelete={(campaign) => void deleteCampaign(campaign)}
                />
              </SectionCard>
            </div>
          )}

          {activeTab === "contacts" && (
            <div className="grid gap-4" data-testid="marketing-contacts-tab">
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
                    <MetadataPanel title="Imported contact metadata" value={editingContact?.metadata} testId="marketing-contact-metadata-panel" />
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={contactSaving} data-testid="button-marketing-save-contact">
                        <Save size={16} /> {contactSaving ? "Saving..." : "Save contact"}
                      </button>
                      {editingContact ? (
                        <button type="button" onClick={() => void deleteContact(editingContact)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 font-black text-red-700 disabled:cursor-not-allowed disabled:bg-[#f5eee8]" disabled={contactSaving} data-testid="button-marketing-delete-editing-contact">
                          <Trash2 size={16} /> Delete
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
              <SectionCard title="Audience rule builder" subtitle="Store reusable list rules and optional Lovable contact external IDs.">
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
                    <Field label="Contact external IDs">
                      <textarea className={textareaClass} value={audienceDraft.contactExternalIds} onChange={(event) => setAudienceDraft((draft) => ({ ...draft, contactExternalIds: event.target.value }))} placeholder="contact:123, contact:456" disabled={audienceSaving} data-testid="input-marketing-audience-contact-ids" />
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
                      <Field label="Contact external IDs">
                        <textarea className={`${textareaClass} font-mono text-xs`} value={audienceEditDraft.contactExternalIds} onChange={(event) => setAudienceEditDraft((draft) => draft ? ({ ...draft, contactExternalIds: event.target.value }) : draft)} placeholder="contact:123&#10;contact:456" disabled={audienceSaving} data-testid="textarea-marketing-edit-audience-contact-ids" />
                      </Field>
                    </div>
                    <MetadataPanel title="Imported list metadata" value={editingAudience?.metadata} testId="marketing-audience-metadata-panel" />
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={audienceSaving} data-testid="button-marketing-save-audience">
                        <Save size={16} /> {audienceSaving ? "Saving..." : "Save list"}
                      </button>
                      {editingAudience ? (
                        <button type="button" onClick={() => void deleteAudience(editingAudience)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 font-black text-red-700 disabled:cursor-not-allowed disabled:bg-[#f5eee8]" disabled={audienceSaving} data-testid="button-marketing-delete-editing-audience">
                          <Trash2 size={16} /> Delete
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
              <SectionCard title="Audiences / lists" subtitle={`${visibleAudiences.length} visible of ${audiences.length} imported lists.`}>
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
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => startAudienceEdit(audience)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]" disabled={audienceSaving} data-testid={`button-marketing-edit-audience-${audience.id}`}>
                            <Pencil size={13} /> Edit
                          </button>
                          <button type="button" onClick={() => void deleteAudience(audience)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:bg-[#f5eee8]" disabled={audienceSaving} data-testid={`button-marketing-delete-audience-${audience.id}`}>
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
              <SectionCard title="Contacts" subtitle={`${visibleContacts.length} visible of ${contacts.length} contacts.`}>
                <div className="overflow-hidden rounded-xl border border-[#eadfd5]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                      <tr>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Audience</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3">Segments</th>
                        <th className="px-4 py-3">Channels</th>
                        <th className="px-4 py-3">Consent</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleContacts.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-6 text-center font-bold text-[#8b7a73]">No contacts match the filters.</td></tr>
                      ) : visibleContacts.map((contact) => {
                        const directChannels = contactDirectChannels(contact);
                        const segments = contactSegments(contact);
                        return (
                          <tr key={contact.id} className="border-t border-[#f0e7df] align-top">
                            <td className="px-4 py-3">
                              <p className="font-black">{contact.fullName || contact.email || contact.phoneNumber || "Unnamed contact"}</p>
                              <p className="mt-1 text-xs font-semibold text-[#7d6b65]">{contact.email || contact.phoneNumber || contact.whatsappNumber || "No direct contact"}</p>
                            </td>
                            <td className="px-4 py-3 font-black">{contact.audienceType.toUpperCase()}</td>
                            <td className="px-4 py-3 text-xs font-bold text-[#7d6b65]">
                              <p>{contact.companyName || "No company"}</p>
                              <p>{contact.roleLabel || "No role"}</p>
                            </td>
                            <td className="max-w-[360px] px-4 py-3">
                              {segments.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {segments.slice(0, 8).map((segment, index) => (
                                    <Pill key={`${segment}-${index}`} className="bg-purple-50 text-purple-800">{segment}</Pill>
                                  ))}
                                  {segments.length > 8 ? <Pill className="bg-[#f5eee8] text-[#7d6b65]">+{segments.length - 8}</Pill> : null}
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-[#8b7a73]">No segment fields yet</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-[#7d6b65]">{directChannels.join(" / ") || "No direct channel"}</td>
                            <td className="px-4 py-3"><Pill className={statusClass(contact.consentStatus)}>{contact.consentStatus}</Pill></td>
                            <td className="px-4 py-3 font-bold">{contact.source}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => startContactEdit(contact)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]" disabled={contactSaving} data-testid={`button-marketing-edit-contact-${contact.id}`}>
                                  <Pencil size={13} /> Edit
                                </button>
                                <button type="button" onClick={() => void deleteContact(contact)} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:bg-[#f5eee8]" disabled={contactSaving} data-testid={`button-marketing-delete-contact-${contact.id}`}>
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
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
                    <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Endpoint: {syncState.apiUrl ?? "Set LOVABLE_MARKETING_API_URL"}</p>
                  </div>
                  <button
                    type="button"
                    disabled={syncButtonDisabled}
                    onClick={() => void runLovableSync()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                    data-testid="button-marketing-run-sync"
                  >
                    <RefreshCw size={16} className={syncRunning ? "animate-spin" : ""} /> {syncRunning ? "Running sync..." : "Run one-way sync"}
                  </button>
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

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-4 text-center text-sm font-bold text-[#8b7a73]">{text}</p>;
}

function CampaignTable({ campaigns, activeCampaignId, onEdit, onDelete }: { campaigns: Campaign[]; activeCampaignId?: string | null; onEdit?: (campaign: Campaign) => void; onDelete?: (campaign: Campaign) => void }) {
  const showActions = Boolean(onEdit || onDelete);
  return (
    <div className="overflow-hidden rounded-xl border border-[#eadfd5]" data-testid="marketing-campaign-table">
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
            return (
            <tr
              key={campaign.id}
              className={`border-t border-[#f0e7df] ${onEdit ? "cursor-pointer hover:bg-purple-50" : ""} ${isActive ? "bg-purple-50" : ""}`}
              onClick={onEdit ? () => onEdit(campaign) : undefined}
              onKeyDown={onEdit ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEdit(campaign);
                }
              } : undefined}
              role={onEdit ? "button" : undefined}
              tabIndex={onEdit ? 0 : undefined}
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
              <td className="px-4 py-3 font-bold text-[#7d6b65]">{formatDate(campaign.scheduleStartsAt)}</td>
              <td className="px-4 py-3"><Pill className={statusClass(campaign.status)}>{campaign.status}</Pill></td>
              <td className="px-4 py-3 font-black">{campaign.recipientCount}</td>
              {showActions ? (
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {onEdit ? (
                      <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(campaign); }} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700" data-testid={`button-marketing-edit-campaign-${campaign.id}`}>
                        <Pencil size={14} /> Edit
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(campaign); }} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700" data-testid={`button-marketing-delete-campaign-${campaign.id}`}>
                        <Trash2 size={14} /> Delete
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

function MarketingCalendarView({ campaigns, onEdit, onDelete }: { campaigns: Campaign[]; onEdit: (campaign: Campaign) => void; onDelete: (campaign: Campaign) => void }) {
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
                      <button type="button" onClick={() => onDelete(campaign)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700" data-testid={`button-marketing-calendar-delete-${campaign.id}`}>
                        <Trash2 size={14} /> Delete
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
