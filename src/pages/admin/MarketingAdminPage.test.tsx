import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import MarketingAdminPage from "./MarketingAdminPage";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "karim.assad@mokadigital.net", role: "admin" },
    logout: vi.fn(),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

const summary = {
  totals: {
    campaigns: 2,
    journeys: 1,
    content: 2,
    mediaAssets: 1,
    contacts: 2,
    audiences: 1,
    journeyEnrollments: 1,
    thisWeek: 1,
    scheduled: 1,
    published: 0,
  },
  analyticsTotals: { sent: 12, delivered: 11, opened: 8, clicked: 4, bounced: 0, unsubscribed: 0, replied: 1, socialEngagement: 3 },
  byChannel: [
    { channel: "email", campaigns: 1, content: 1 },
    { channel: "whatsapp", campaigns: 1, content: 1 },
    { channel: "facebook", campaigns: 0, content: 0 },
    { channel: "instagram", campaigns: 0, content: 0 },
    { channel: "linkedin", campaigns: 0, content: 0 },
    { channel: "tiktok", campaigns: 0, content: 0 },
  ],
  byAudience: [
    { audienceType: "b2c", campaigns: 1, contacts: 1 },
    { audienceType: "b2b", campaigns: 1, contacts: 1 },
    { audienceType: "both", campaigns: 0, contacts: 0 },
  ],
  lockedSendCapabilities: [
    { channel: "email", sendCapability: "enabled", locked: false, note: "Email campaign dispatch uses Resend." },
    { channel: "whatsapp", sendCapability: "future_send_capable", locked: true, note: "Provider dispatch is locked." },
    { channel: "facebook", sendCapability: "planning_only", locked: true, note: "Planning only." },
    { channel: "instagram", sendCapability: "planning_only", locked: true, note: "Planning only." },
    { channel: "linkedin", sendCapability: "planning_only", locked: true, note: "Planning only." },
    { channel: "tiktok", sendCapability: "planning_only", locked: true, note: "Planning only." },
  ],
  emailScheduler: {
    enabled: false,
    intervalMinutes: 5,
    initialDelaySeconds: 30,
    actor: "marketing-email-scheduler",
  },
  latestSyncRun: null,
};

const campaigns = [
  {
    id: "campaign-1",
    name: "Caregiver welcome",
    status: "scheduled",
    audienceType: "b2c",
    objective: "Invite caregivers",
    scheduleStartsAt: "2026-07-06T09:00:00.000Z",
    scheduleEndsAt: "2026-07-06T11:00:00.000Z",
    timezone: "Europe/Madrid",
    source: "lovable",
    lovableExternalId: "lovable-campaign-1",
    metadata: { extraCampaignField: "from-lovable", lovable: { originalStatus: "queued" }, targetAudience: { lovableExternalId: "lovable-audience-1" } },
    channels: [
      { id: "channel-1", channel: "email", contentAssetId: "content-1", scheduledAt: "2026-07-06T09:00:00.000Z", status: "scheduled", sendCapability: "enabled" },
      { id: "channel-1-linkedin", channel: "linkedin", contentAssetId: "content-2", scheduledAt: "2026-07-06T10:00:00.000Z", status: "draft", sendCapability: "planning_only" },
    ],
    recipientCount: 1,
    recipients: [{
      id: "recipient-1",
      campaignId: "campaign-1",
      contactId: null,
      profileId: null,
      channel: "email",
      recipient: "hassan@example.com",
      status: "planned",
      scheduledAt: "2026-07-06T09:00:00.000Z",
      snapshot: { fullName: "Hassan Partner", email: "hassan@example.com", contact_external_id: "lovable-contact-2", lovableSource: "recipient-export" },
      communicationLogId: null,
      createdAt: "2026-07-05T09:00:00.000Z",
      updatedAt: "2026-07-05T09:00:00.000Z",
    }],
  },
  {
    id: "campaign-2",
    name: "Partner outreach",
    status: "draft",
    audienceType: "b2b",
    objective: "Warm B2B leads",
    scheduleStartsAt: null,
    scheduleEndsAt: null,
    timezone: "Europe/Madrid",
    source: "lovable",
    lovableExternalId: "lovable-campaign-2",
    channels: [{ id: "channel-2", channel: "linkedin", contentAssetId: null, scheduledAt: null, status: "draft", sendCapability: "locked" }],
    recipientCount: 4,
    recipients: [],
  },
];

const journeys = [
  {
    id: "journey-1",
    name: "B2B nurture",
    status: "draft",
    audienceType: "b2b",
    objective: "Convert partners",
    triggerType: "signup",
    triggerConfig: { source: "lovable", audienceExternalId: "lovable-audience-1" },
    goalType: "activation",
    goalConfig: { event: "first_login" },
    exitOnGoal: false,
    source: "lovable",
    lovableExternalId: "lovable-journey-1",
    metadata: { lovable: { triggerWindow: "morning" } },
    steps: [{
      id: "step-1",
      stepOrder: 0,
      channel: "email",
      delayHours: 72,
      kind: "message",
      dayOffset: 3,
      templateKind: "email_template",
      templateRef: "content-1",
      status: "draft",
    }],
  },
];

const content = [
  {
    id: "content-1",
    title: "Welcome email",
    channel: "email",
    language: "en",
    status: "draft",
    subject: "Welcome to VYVA",
    body: "Hello",
    source: "vyva",
    lovableExternalId: null,
  },
  {
    id: "content-2",
    title: "Partner post",
    channel: "linkedin",
    language: "en",
    status: "draft",
    subject: null,
    body: "Partner update",
    htmlBody: "<h1>Partner update</h1>",
    ctaLabel: "Read more",
    ctaUrl: "https://v2.vyva.life/partners",
    designJson: {
      blocks: [{
        type: "hero",
        headline: "Partner hero",
        body: "Lovable builder copy",
        imageUrl: "https://cdn.example.test/partner-design.png",
        ctaLabel: "Book a demo",
        ctaUrl: "https://v2.vyva.life/demo",
      }],
    },
    mediaAssets: [{ url: "https://cdn.example.test/partner.png" }],
    hasHtml: true,
    hasDesign: true,
    mediaAssetCount: 1,
    source: "lovable",
    lovableExternalId: "lovable-content-2",
    createdAt: "2026-07-05T08:55:00.000Z",
    updatedAt: "2026-07-05T09:00:00.000Z",
    metadata: {
      extraLovableOnlyField: "kept",
      lovable_source_type: "social_post",
      lovable: {
        tone: "partner",
        platform: "linkedin",
        tags: ["b2b", "partners"],
        updatedAt: "2026-07-05T09:00:00.000Z",
      },
    },
  },
];

const mediaAssets = [
  {
    id: "media-1",
    contentAssetId: "content-2",
    contentTitle: "Partner post",
    source: "lovable",
    assetType: "image",
    originalUrl: "https://cdn.example.test/partner.png",
    localUrl: null,
    status: "referenced",
    lovableExternalId: "media-1",
    lastSyncedAt: "2026-07-05T09:01:00.000Z",
    updatedAt: "2026-07-05T09:01:00.000Z",
    metadata: { lovable: { altText: "Partner hero image" } },
  },
];

const analytics = {
  totals: { sent: 12, delivered: 11, opened: 8, clicked: 4, bounced: 0, unsubscribed: 0, replied: 1, socialEngagement: 3 },
  metrics: [{
    id: "metric-1",
    campaignId: "campaign-1",
    campaignName: "Caregiver welcome",
    channel: "email",
    metricDate: "2026-07-06T09:00:00.000Z",
    sent: 12,
    delivered: 11,
    opened: 8,
    clicked: 4,
    bounced: 0,
    unsubscribed: 0,
    replied: 1,
    socialEngagement: 3,
    source: "lovable",
    lovableExternalId: "metric-1",
    metadata: { lovable: { providerMetricId: "metric-provider-1" } },
  },
  ...Array.from({ length: 9 }, (_, index) => {
    const metricNumber = index + 2;
    return {
      id: `metric-${metricNumber}`,
      campaignId: "campaign-1",
      campaignName: `Overflow metric ${metricNumber}`,
      channel: "email",
      metricDate: "2026-07-06T09:00:00.000Z",
      sent: metricNumber,
      delivered: metricNumber,
      opened: index,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      replied: 0,
      socialEngagement: 0,
      source: "lovable",
      lovableExternalId: `metric-${metricNumber}`,
      metadata: { lovable: { providerMetricId: `metric-provider-${metricNumber}` } },
    };
  })],
};

const journeyEnrollments = [
  {
    id: "enrollment-1",
    journeyId: "journey-1",
    journeyName: "B2B nurture",
    contactId: null,
    contactExternalId: "lovable-contact-2",
    status: "active",
    currentStepOrder: 0,
    enteredAt: "2026-07-05T09:00:00.000Z",
    exitedAt: null,
    lastActivityAt: "2026-07-05T09:30:00.000Z",
    source: "lovable",
    lovableExternalId: "enrollment-1",
    metadata: { lovable: { cohort: "partners-july" } },
    events: [{
      id: "event-1",
      eventType: "entered",
      stepOrder: 0,
      eventAt: "2026-07-05T09:00:00.000Z",
      channel: "email",
      metadata: { lovable: { eventSource: "automation-log" } },
    },
    ...Array.from({ length: 9 }, (_, index) => {
      const eventNumber = index + 2;
      return {
        id: `event-${eventNumber}`,
        eventType: `event-${eventNumber}`,
        stepOrder: eventNumber,
        eventAt: "2026-07-05T09:30:00.000Z",
        channel: "email",
        metadata: { lovable: { eventSource: `automation-log-${eventNumber}` } },
      };
    })],
  },
  ...Array.from({ length: 10 }, (_, index) => {
    const enrollmentNumber = index + 2;
    return {
      id: `enrollment-${enrollmentNumber}`,
      journeyId: "journey-1",
      journeyName: "B2B nurture",
      contactId: "contact-2",
      contactExternalId: `lovable-contact-overflow-${enrollmentNumber}`,
      status: "active",
      currentStepOrder: 0,
      enteredAt: "2026-07-05T09:00:00.000Z",
      exitedAt: null,
      lastActivityAt: "2026-07-05T09:30:00.000Z",
      source: "lovable",
      lovableExternalId: `enrollment-${enrollmentNumber}`,
      metadata: { lovable: { cohort: "partners-july" } },
      events: [],
    };
  }),
];

const contacts = [
  {
    id: "contact-1",
    audienceType: "b2c",
    fullName: "Karim Assad",
    email: "karim@example.com",
    phoneNumber: null,
    whatsappNumber: "+34600000001",
    roleLabel: null,
    companyName: null,
    consentStatus: "unknown",
    source: "vyva",
    tags: [],
    language: null,
    category: null,
    vertical: null,
    market: null,
    lists: [],
    lovableExternalId: null,
  },
  {
    id: "contact-2",
    audienceType: "b2b",
    profileId: "profile-2",
    organizationId: "11111111-1111-4111-8111-111111111111",
    fullName: "Hassan Partner",
    email: "hassan@example.com",
    phoneNumber: "+34 983 419 300",
    whatsappNumber: "+34 770 900 123",
    roleLabel: "Partner",
    companyName: "Moka Digital",
    consentStatus: "pending",
    source: "lovable",
    tags: ["partner", "madrid"],
    language: "en",
    category: "lead",
    vertical: "healthcare",
    market: "Spain",
    lists: ["Partners"],
    lovableExternalId: "lovable-contact-2",
    lastSyncedAt: "2026-07-05T09:02:00.000Z",
    updatedAt: "2026-07-05T09:02:00.000Z",
    channelAvailability: { email: true, linkedin: true, whatsapp: false, source: "lovable" },
    metadata: {
      lovable: {
        persona: "partner-lead",
        profile: {
          emailAddress: "profile-lead@example.com",
          crmScore: 87,
        },
      },
      segmentation: { lifecycle: "lead" },
    },
  },
];

const audiences = [
  {
    id: "audience-1",
    name: "Partners",
    description: "Imported partner list",
    listType: "static",
    rules: { market: "Spain" },
    source: "lovable",
    lovableExternalId: "lovable-audience-1",
    memberCount: 2,
    mappedMemberCount: 1,
    contactExternalIds: ["lovable-contact-2", "missing-contact"],
    memberPreview: [{
      id: "contact-2",
      fullName: "Hassan Partner",
      email: "hassan@example.com",
      phoneNumber: "+34 983 419 300",
      whatsappNumber: "+34 770 900 123",
      companyName: "Moka Digital",
      roleLabel: "Partner",
      lovableExternalId: "lovable-contact-2",
      contactExternalId: "lovable-contact-2",
    },
    ...Array.from({ length: 6 }, (_, index) => {
      const memberNumber = index + 2;
      return {
        id: `preview-contact-${memberNumber}`,
        fullName: `Lovable list member ${memberNumber}`,
        email: `list-member-${memberNumber}@example.com`,
        phoneNumber: null,
        whatsappNumber: null,
        companyName: "Imported List Co",
        roleLabel: "Lead",
        lovableExternalId: `lovable-list-member-${memberNumber}`,
        contactExternalId: `lovable-list-member-${memberNumber}`,
      };
    })],
    unmappedContactExternalIds: ["missing-contact"],
    lastSyncedAt: "2026-07-05T09:00:00.000Z",
    updatedAt: "2026-07-05T09:00:00.000Z",
    metadata: { lovable: { sourceList: "Partners" } },
  },
];

const sync = {
  provider: "lovable",
  backendBuild: "marketing-sync-status-2026-07-12-no-cache",
  configured: false,
  canRunSync: true,
  requiredRunnerEmail: "karim.assad@mokadigital.net",
  apiUrl: null,
  mode: "one_way_into_vyva",
  realSendingLocked: false,
  lockedSendCapabilities: summary.lockedSendCapabilities,
  emailScheduler: summary.emailScheduler,
  diagnostics: {
    apiUrlSource: "default",
    tokenSource: null,
    urlAliasPresent: {
      LOVABLE_MARKETING_API_URL: false,
      VYVA_MARKETING_EXPORT_URL: false,
    },
    tokenAliasPresent: {
      LOVABLE_MARKETING_API_KEY: false,
      VYVA_MARKETING_EXPORT_TOKEN: false,
    },
    hasDefaultEndpoint: true,
    hasBearerToken: false,
  },
  runs: [{
    id: "sync-1",
    provider: "lovable",
    status: "succeeded",
    startedAt: "2026-07-05T09:00:00.000Z",
    completedAt: "2026-07-05T09:01:00.000Z",
    summary: {
      exported: { campaigns: 2, contacts: 2, content: 2, mediaAssets: 1, campaignMetrics: 1, journeys: 1, journeyEnrollments: 1, audiences: 1 },
      imported: { campaigns: 2, contacts: 2, content: 2, mediaAssets: 1, campaignMetrics: 1, journeys: 1, journeyEnrollments: 1, journeyStepEvents: 1, audiences: 1, audienceMembers: 2, mappedAudienceMembers: 1, campaignRecipients: 1, missingContentReferences: 1 },
      skipped: {},
      exportMetadata: {
        dataset: "live",
        exportedAt: "2026-07-05T09:01:30.000Z",
        cursor: "cursor-1",
        apiUrl: "https://lovable.example.test",
        topLevelKeys: ["campaigns", "contacts", "exportedAt", "journey_step_events", "saved_email_templates", "social_posts"],
      },
      contentSourceCounts: { saved_email_template: 1, social_post: 1, missing_lovable_reference: 1 },
      unmapped: {
        audienceContactExternalIdCount: 1,
        audienceContactExternalIds: ["missing-contact"],
        campaignRecipientExternalIdCount: 1,
        campaignRecipientExternalIds: ["missing-contact"],
      },
      fieldCoverage: {
        content: {
          exportedFieldCount: 9,
          firstClassFieldCount: 8,
          metadataOnlyFieldCount: 1,
          exportedFields: ["body", "channel", "emailTemplate.previewText", "extraLovableOnlyField", "id", "status", "subject", "template.html_content", "title"],
          firstClassFields: ["body", "channel", "emailTemplate.previewText", "id", "status", "subject", "template.html_content", "title"],
          metadataOnlyFields: ["extraLovableOnlyField"],
        },
        contacts: {
          exportedFieldCount: 11,
          firstClassFieldCount: 11,
          metadataOnlyFieldCount: 0,
          exportedFields: ["audienceType", "email", "id", "name", "phoneNumber", "profile.emailAddress", "profile.firstName", "profile.crmScore", "tags", "updatedAt", "vertical"],
          firstClassFields: ["audienceType", "email", "id", "name", "phoneNumber", "profile.crmScore", "profile.emailAddress", "profile.firstName", "tags", "updatedAt", "vertical"],
          metadataOnlyFields: [],
        },
      },
    },
    error: null,
    createdBy: "karim.assad@mokadigital.net",
    createdAt: "2026-07-05T09:00:00.000Z",
  }],
};

const exportPreview = {
  ok: true,
  checkedAt: "2026-07-05T09:02:00.000Z",
  apiUrl: "https://lovable.example.test",
  dataset: "live",
  exportedAt: "2026-07-05T09:01:30.000Z",
  topLevelKeys: ["campaigns", "contacts", "exportedAt", "journey_step_events", "saved_email_templates", "social_posts"],
  summary: {
    exported: { campaigns: 1, contacts: 2, content: 2, mediaAssets: 1, journeys: 1, journeyStepEvents: 1 },
    contentSourceCounts: { saved_email_template: 1, social_post: 1 },
    fieldCoverage: {
      content: {
        exportedFieldCount: 9,
        firstClassFieldCount: 8,
        metadataOnlyFieldCount: 1,
        exportedFields: ["body", "channel", "emailTemplate.previewText", "extraLovableOnlyField", "id", "status", "subject", "template.html_content", "title"],
        firstClassFields: ["body", "channel", "emailTemplate.previewText", "id", "status", "subject", "template.html_content", "title"],
        metadataOnlyFields: ["extraLovableOnlyField"],
      },
    },
  },
  samples: {
    content: [{ id: "template-1", template_name: "Welcome", html_content: "<p>Hello</p>" }],
    contacts: [{ id: "contact-1", name: "Hassan", email: "hassan@example.com" }],
    media: [{ url: "https://cdn.example.test/post.png", sourceField: "image_url" }],
  },
  rawArraySamples: {
    saved_email_templates: [{ id: "template-1", template_name: "Welcome", html_content: "<p>Hello</p>" }],
    social_posts: [{ id: "post-1", platform: "linkedin", caption: "Partner update" }],
  },
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function openMetadataPanel(testId: string) {
  const panel = screen.getByTestId(testId);
  const summary = panel.querySelector("summary");
  if (!summary) throw new Error(`Missing metadata summary for ${testId}`);
  fireEvent.click(summary);
  return panel;
}

function journeyFromRequestBody(id: string, init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}"));
  return {
    id,
    name: body.name ?? "Untitled journey",
    status: body.status ?? "draft",
    audienceType: body.audienceType ?? "b2c",
    objective: body.objective ?? "",
    triggerType: body.triggerType ?? null,
    triggerConfig: body.triggerConfig ?? {},
    goalType: body.goalType ?? null,
    goalConfig: body.goalConfig ?? {},
    exitOnGoal: body.exitOnGoal ?? true,
    source: body.source ?? "vyva",
    lovableExternalId: body.lovableExternalId ?? null,
    metadata: body.metadata ?? {},
    steps: (body.steps ?? []).map((step: Record<string, unknown>, index: number) => ({
      id: `${id}-step-${index + 1}`,
      stepOrder: step.stepOrder ?? index,
      channel: step.channel ?? "email",
      contentAssetId: step.contentAssetId ?? null,
      delayHours: step.delayHours ?? 0,
      kind: step.kind ?? "message",
      dayOffset: step.dayOffset ?? 0,
      templateKind: step.templateKind ?? null,
      templateRef: step.templateRef ?? null,
      config: step.config ?? {},
      status: step.status ?? "draft",
      metadata: step.metadata ?? {},
    })),
  };
}

function campaignFromRequestBody(id: string, init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}"));
  const channels = Array.isArray(body.channels) ? body.channels : [];
  const recipients = Array.isArray(body.recipients) ? body.recipients : [];
  return {
    id,
    name: body.name ?? "Untitled campaign",
    status: body.status ?? "draft",
    audienceType: body.audienceType ?? "b2c",
    objective: body.objective ?? "",
    scheduleStartsAt: body.scheduleStartsAt ?? null,
    scheduleEndsAt: body.scheduleEndsAt ?? null,
    timezone: body.timezone ?? "Europe/Madrid",
    source: body.source ?? "vyva",
    lovableExternalId: body.lovableExternalId ?? null,
    metadata: body.metadata ?? {},
    channels: channels.map((channel: Record<string, unknown>, index: number) => ({
      id: `${id}-channel-${index + 1}`,
      campaignId: id,
      channel: channel.channel ?? "email",
      contentAssetId: channel.contentAssetId ?? null,
      scheduledAt: channel.scheduledAt ?? body.scheduleStartsAt ?? null,
      status: channel.status ?? body.status ?? "draft",
      sendCapability: channel.channel === "email" ? "enabled" : channel.channel === "whatsapp" ? "future_send_capable" : "planning_only",
    })),
    recipientCount: recipients.length,
    recipients: recipients.map((recipient: Record<string, unknown>, index: number) => ({
      id: `${id}-recipient-${index + 1}`,
      campaignId: id,
      contactId: recipient.contactId ?? null,
      profileId: recipient.profileId ?? null,
      channel: recipient.channel ?? "email",
      recipient: recipient.recipient ?? "",
      status: recipient.status ?? "planned",
      scheduledAt: recipient.scheduledAt ?? body.scheduleStartsAt ?? null,
      snapshot: recipient.snapshot ?? {},
      communicationLogId: null,
      createdAt: "2026-07-05T09:00:00.000Z",
      updatedAt: "2026-07-05T09:00:00.000Z",
    })),
  };
}

function contentFromRequestBody(id: string, init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}"));
  return {
    id,
    title: body.title ?? "Untitled content",
    channel: body.channel ?? "email",
    language: body.language ?? "en",
    status: body.status ?? "draft",
    subject: body.subject ?? null,
    body: body.body ?? "",
    htmlBody: body.htmlBody ?? null,
    ctaLabel: body.ctaLabel ?? null,
    ctaUrl: body.ctaUrl ?? null,
    designJson: body.designJson ?? {},
    mediaAssets: body.mediaAssets ?? [],
    hasHtml: Boolean(body.htmlBody),
    hasDesign: Boolean(body.designJson && Object.keys(body.designJson).length),
    mediaAssetCount: Array.isArray(body.mediaAssets) ? body.mediaAssets.length : 0,
    source: body.source ?? "vyva",
    lovableExternalId: body.lovableExternalId ?? null,
    metadata: body.metadata ?? {},
  };
}

function mediaFromRequestBody(id: string, init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}"));
  return {
    id,
    contentAssetId: body.contentAssetId ?? null,
    contentTitle: body.contentAssetId === "content-1" ? "Welcome email" : body.contentAssetId === "content-2" ? "Partner post" : null,
    source: body.source ?? "vyva",
    assetType: body.assetType ?? "unknown",
    originalUrl: body.originalUrl ?? "",
    localUrl: body.localUrl ?? null,
    status: body.status ?? "referenced",
    lovableExternalId: body.lovableExternalId ?? null,
    metadata: body.metadata ?? {},
  };
}

function contactFromRequestBody(id: string, init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}"));
  return {
    id,
    audienceType: body.audienceType ?? "b2b",
    profileId: body.profileId ?? null,
    organizationId: body.organizationId ?? null,
    fullName: body.fullName ?? "",
    email: body.email ?? null,
    phoneNumber: body.phoneNumber ?? null,
    whatsappNumber: body.whatsappNumber ?? null,
    roleLabel: body.roleLabel ?? null,
    companyName: body.companyName ?? null,
    consentStatus: body.consentStatus ?? "unknown",
    source: body.source ?? "vyva",
    channelAvailability: body.channelAvailability ?? {},
    metadata: body.metadata ?? {},
    tags: body.tags ?? [],
    language: body.language ?? null,
    category: body.category ?? null,
    vertical: body.vertical ?? null,
    market: body.market ?? null,
    lists: [],
    lovableExternalId: body.lovableExternalId ?? null,
  };
}

function audienceFromRequestBody(id: string, init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}"));
  const contactExternalIds = body.contactExternalIds ?? [];
  return {
    id,
    name: body.name ?? "Untitled list",
    description: body.description ?? null,
    listType: body.listType ?? "dynamic",
    rules: body.rules ?? {},
    source: body.source ?? "vyva",
    lovableExternalId: body.lovableExternalId ?? null,
    memberCount: contactExternalIds.length,
    mappedMemberCount: contactExternalIds.filter((value: string) => value === "lovable-contact-2").length,
    contactExternalIds,
    memberPreview: contactExternalIds.includes("lovable-contact-2") ? [{
      id: "contact-2",
      fullName: "Hassan Partner",
      email: "hassan@example.com",
      phoneNumber: "+34 983 419 300",
      whatsappNumber: "+34 770 900 123",
      companyName: "Moka Digital",
      roleLabel: "Partner",
      lovableExternalId: "lovable-contact-2",
      contactExternalId: "lovable-contact-2",
    }] : [],
    unmappedContactExternalIds: contactExternalIds.filter((value: string) => value !== "lovable-contact-2"),
    lastSyncedAt: null,
    metadata: body.metadata ?? {},
  };
}

function renderPage(syncOverride: Partial<typeof sync> = {}, dataOverride: {
  campaigns?: unknown[];
  contacts?: unknown[];
  content?: unknown[];
  mediaAssets?: unknown[];
  analytics?: typeof analytics;
} = {}) {
  const syncResponse = { ...sync, ...syncOverride };
  const campaignsResponse = dataOverride.campaigns ?? campaigns;
  const contactsResponse = dataOverride.contacts ?? contacts;
  const contentResponse = dataOverride.content ?? content;
  const mediaAssetsResponse = dataOverride.mediaAssets ?? mediaAssets;
  const analyticsResponse = dataOverride.analytics ?? analytics;
  apiFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path === "/api/admin/marketing/summary") return jsonResponse(summary);
    if (path === "/api/admin/marketing/campaigns" && method === "GET") return jsonResponse({ campaigns: campaignsResponse });
    if (path === "/api/admin/marketing/journeys" && method === "GET") return jsonResponse({ journeys });
    if (path === "/api/admin/marketing/journey-enrollments" && method === "GET") return jsonResponse({ enrollments: journeyEnrollments });
    if (path === "/api/admin/marketing/content" && method === "GET") return jsonResponse({ content: contentResponse });
    if (path === "/api/admin/marketing/media" && method === "GET") return jsonResponse({ mediaAssets: mediaAssetsResponse });
    if (path === "/api/admin/marketing/analytics" && method === "GET") return jsonResponse(analyticsResponse);
    if (path === "/api/admin/marketing/contacts" && method === "GET") return jsonResponse({ contacts: contactsResponse });
    if (path === "/api/admin/marketing/audiences" && method === "GET") return jsonResponse({ audiences });
    if (path === "/api/admin/marketing/sync/lovable" && method === "GET") return jsonResponse(syncResponse);
    if (path === "/api/admin/marketing/sync/lovable/preview" && method === "GET") return jsonResponse(exportPreview);
    if (path === "/api/admin/marketing/sync/lovable/run" && method === "POST") return jsonResponse({ ok: true, summary: { campaigns: 1, content: 1, contacts: 1, journeys: 1 } });
    if (path === "/api/admin/marketing/ai/campaign-draft" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({
        ok: true,
        configured: true,
        source: "openai",
        note: null,
        draft: {
          campaignName: `${body.playLabel} AI campaign`,
          contentTitle: body.channel === "linkedin" ? `${body.playLabel} AI content` : `${body.playLabel} ${body.channel} AI content`,
          objective: `AI objective for ${body.targetAudienceName}`,
          subject: body.channel === "linkedin" ? "AI subject line" : `AI ${body.channel} subject line`,
          body: body.channel === "linkedin" ? "AI body copy with stronger channel direction." : `AI ${body.channel} body copy with stronger channel direction.`,
          ctaLabel: "AI CTA",
          ctaUrl: "https://v2.vyva.life/ai",
          language: "en",
          designJson: { generator: "test-ai" },
        },
      });
    }
    if (path === "/api/admin/marketing/campaigns" && method === "POST") return jsonResponse({ ok: true, campaign: campaignFromRequestBody("campaign-created", init) }, { status: 201 });
    if (path === "/api/admin/marketing/campaigns/campaign-1" && method === "PATCH") return jsonResponse({ ok: true, campaign: campaigns[0] });
    if (path === "/api/admin/marketing/campaigns/campaign-2" && method === "PATCH") return jsonResponse({ ok: true, campaign: campaigns[1] });
    if (path === "/api/admin/marketing/campaigns/campaign-1" && method === "DELETE") return jsonResponse({ ok: true, deletedCampaignId: "campaign-1" });
    if (path === "/api/admin/marketing/campaigns/campaign-1/test-email" && method === "POST") return jsonResponse({ ok: true, communication: { id: "comm-1", recipient: "karim.assad@mokadigital.net", status: "sent" }, delivery: { id: "comm-1", recipient: "karim.assad@mokadigital.net", status: "sent" } });
    if (path === "/api/admin/marketing/campaigns/campaign-1/send-email" && method === "POST") return jsonResponse({ ok: true, sentCount: 1, failedCount: 0, skippedCount: 0, campaign: { ...campaigns[0], status: "published" }, delivery: [{ id: "comm-2", recipient: "karim@example.com", status: "sent" }] });
    if (path === "/api/admin/marketing/campaigns/send-due-email" && method === "POST") return jsonResponse({ ok: true, dueCount: 1, sentCount: 1, failedCount: 0, skippedCount: 0, results: [{ campaignId: "campaign-1", campaignName: "Caregiver welcome", ok: true, sentCount: 1, failedCount: 0, skippedCount: 0 }] });
    if (path === "/api/admin/marketing/journeys" && method === "POST") return jsonResponse({ ok: true, journey: journeyFromRequestBody("journey-created", init) }, { status: 201 });
    if (path === "/api/admin/marketing/journeys/journey-1" && method === "PATCH") return jsonResponse({ ok: true, journey: journeyFromRequestBody("journey-1", init) });
    if (path === "/api/admin/marketing/journeys/journey-1" && method === "DELETE") return jsonResponse({ ok: true, deletedJourneyId: "journey-1" });
    if (path === "/api/admin/marketing/content" && method === "POST") return jsonResponse({ ok: true, content: contentFromRequestBody("content-created", init) }, { status: 201 });
    if (path === "/api/admin/marketing/content/content-2" && method === "PATCH") return jsonResponse({ ok: true, content: contentFromRequestBody("content-2", init) });
    if (path === "/api/admin/marketing/content/content-2" && method === "DELETE") return jsonResponse({ ok: true, deletedContentId: "content-2" });
    if (path === "/api/admin/marketing/media/media-1" && method === "PATCH") return jsonResponse({ ok: true, mediaAsset: mediaFromRequestBody("media-1", init) });
    if (path === "/api/admin/marketing/media/media-1" && method === "DELETE") return jsonResponse({ ok: true, deletedMediaAssetId: "media-1" });
    if (path === "/api/admin/marketing/contacts" && method === "POST") return jsonResponse({ ok: true, contact: contacts[1] }, { status: 201 });
    if (path === "/api/admin/marketing/contacts/contact-2" && method === "PATCH") return jsonResponse({ ok: true, contact: contactFromRequestBody("contact-2", init) });
    if (path === "/api/admin/marketing/contacts/contact-2" && method === "DELETE") return jsonResponse({ ok: true, deletedContactId: "contact-2" });
    if (path === "/api/admin/marketing/audiences" && method === "POST") return jsonResponse({ ok: true, audience: audiences[0] }, { status: 201 });
    if (path === "/api/admin/marketing/audiences/audience-1" && method === "PATCH") return jsonResponse({ ok: true, audience: audienceFromRequestBody("audience-1", init) });
    if (path === "/api/admin/marketing/audiences/audience-1" && method === "DELETE") return jsonResponse({ ok: true, deletedAudienceId: "audience-1" });
    return jsonResponse({ error: `Unexpected request: ${method} ${path}` }, { status: 500 });
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/marketing"]}>
      <MarketingAdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("MarketingAdminPage", () => {
  it("shows the marketing admin nav, tabs, filters, and email send readiness", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Marketing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Marketing.*Campaigns, contacts and sync/i })).toBeInTheDocument();
    expect(screen.getByTestId("marketing-send-readiness-panel")).toHaveTextContent("Email campaign sending is enabled");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Total campaigns");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Audiences");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Imported media refs");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Journey enrollments");
    expect(screen.getByTestId("marketing-lovable-import-coverage")).toHaveTextContent("Lovable 2 / VYVA 2");
    expect(screen.getByTestId("marketing-lovable-import-coverage")).toHaveTextContent("Saved email template: 1");
    expect(screen.getByTestId("marketing-lovable-import-coverage")).toHaveTextContent("Social post: 1");
    expect(screen.getByTestId("marketing-lovable-import-coverage")).toHaveTextContent("Unmapped list members: 1");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Analytics snapshots");
    expect(screen.getByTestId("marketing-analytics-table")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-analytics-table")).toHaveTextContent("Overflow metric 10");
    expect(openMetadataPanel("marketing-analytics-metadata-metric-1")).toHaveTextContent("metric-provider-1");
    fireEvent.click(screen.getByTestId("button-marketing-open-metric-campaign-metric-1"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByText('Opened campaign "Caregiver welcome" from imported analytics.')).toBeInTheDocument();
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Caregiver welcome")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-target-list-campaign-1")).toHaveTextContent("List: Partners");
    expect(screen.getByTestId("marketing-campaign-target-list-campaign-1")).toHaveTextContent("1/2 mapped");
    expect(screen.getByTestId("marketing-campaign-performance-campaign-1")).toHaveTextContent("66 sent");
    expect(screen.getByTestId("marketing-campaign-performance-campaign-1")).toHaveTextContent("44 opened");
    expect(screen.getByTestId("marketing-campaign-performance-campaign-1")).toHaveTextContent("4 clicked");
    expect(screen.getByTestId("marketing-campaign-channel-link-channel-1")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-campaign-channel-link-channel-1-linkedin")).toHaveTextContent("Partner post");

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "Warm B2B" } });
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Partner outreach")).toBeInTheDocument();
    expect(within(screen.getByTestId("marketing-campaign-table")).queryByText("Caregiver welcome")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "partner" } });
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    expect(screen.getByTestId("marketing-journeys-tab")).toHaveTextContent("B2B nurture");
    expect(screen.queryByText("First channel")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-journey-logic-journey-1")).toHaveTextContent("Trigger: signup");
    expect(screen.getByTestId("marketing-journey-logic-journey-1")).toHaveTextContent("List: Partners");
    expect(screen.getByTestId("marketing-journey-logic-journey-1")).toHaveTextContent("Goal: activation");
    expect(screen.getByTestId("marketing-journeys-tab")).toHaveTextContent("message / Email / day 3 / Welcome email");
    expect(screen.getByTestId("marketing-journey-enrollments")).toHaveTextContent("lovable-contact-2");
    expect(screen.getByTestId("marketing-journey-enrollment-contact-enrollment-1")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-journey-enrollment-contact-enrollment-1")).toHaveTextContent("hassan@example.com");
    expect(screen.getByTestId("marketing-journey-enrollment-contact-enrollment-1")).toHaveTextContent("Moka Digital");
    expect(screen.getByTestId("marketing-journey-enrollment-contact-enrollment-1")).toHaveTextContent("Linked from lovable-contact-2");
    expect(screen.getByTestId("marketing-journey-enrollments")).toHaveTextContent("lovable-contact-overflow-11");
    expect(screen.getByTestId("marketing-journey-enrollments")).toHaveTextContent("Lovable enrollment ID: enrollment-1");
    expect(screen.getByTestId("marketing-journey-enrollments")).toHaveTextContent("Entered");
    expect(screen.getByTestId("marketing-journey-enrollments")).toHaveTextContent("Last activity");
    expect(openMetadataPanel("marketing-journey-enrollment-metadata-enrollment-1")).toHaveTextContent("partners-july");
    expect(screen.getByTestId("marketing-journey-event-event-1")).toHaveTextContent("entered");
    expect(screen.getByTestId("marketing-journey-event-event-1")).toHaveTextContent("email");
    expect(screen.getByTestId("marketing-journey-event-event-10")).toHaveTextContent("event-10");
    expect(openMetadataPanel("marketing-journey-event-metadata-event-1")).toHaveTextContent("automation-log");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Lovable content coverage");
    expect(screen.getByTestId("marketing-lovable-content-source-buckets")).toHaveTextContent("Saved email template: 1");
    expect(screen.getByTestId("marketing-lovable-content-source-buckets")).toHaveTextContent("Social post: 1");
    expect(screen.getByTestId("marketing-lovable-content-source-buckets")).toHaveTextContent("Missing Lovable reference: 1");
    expect(screen.getByTestId("marketing-lovable-field-coverage")).toHaveTextContent("content: 8 of 9 fields mapped first-class");
    expect(screen.getByTestId("marketing-lovable-field-coverage")).toHaveTextContent("Mapped: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    const contentImportCoverage = openMetadataPanel("marketing-lovable-field-map-content");
    expect(contentImportCoverage).toHaveTextContent("Metadata-only: extraLovableOnlyField");
    expect(contentImportCoverage).toHaveTextContent("Mapped first-class: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(contentImportCoverage).toHaveTextContent("All exported: body, channel, emailTemplate.previewText, extraLovableOnlyField, id, status, subject, template.html_content, title");
    expect(screen.getByTestId("marketing-missing-content-reference-panel")).toHaveTextContent("Lovable referenced content that was not exported.");
    expect(screen.getByTestId("marketing-missing-content-reference-panel")).toHaveTextContent("1 campaign or journey content reference");
    fireEvent.click(screen.getByTestId("button-marketing-show-missing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Lovable content placeholders");
    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("Content is loaded, but hidden by filters.");
    fireEvent.click(screen.getByTestId("button-marketing-clear-content-filters"));
    expect(screen.getByTestId("marketing-content-library-table")).toHaveTextContent("Content");
    expect(screen.getByTestId("marketing-content-library-table")).toHaveTextContent("Type");
    expect(screen.getByTestId("marketing-content-library-table")).toHaveTextContent("Design/media");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("HTML");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Design");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("1 media");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Read more -> https://v2.vyva.life/partners");
    expect(screen.getByTestId("marketing-content-library-table")).toHaveTextContent("Social post");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Lovable ID: lovable-content-2");
    expect(screen.getByTestId("marketing-content-timeline-content-2")).toHaveTextContent("Updated");
    expect(screen.getByTestId("marketing-content-usage-content-2")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-content-usage-content-2")).toHaveTextContent("LinkedIn campaign channel");
    expect(screen.getByTestId("marketing-content-usage-content-1")).toHaveTextContent("B2B nurture");
    expect(screen.getByTestId("marketing-content-usage-content-1")).toHaveTextContent("Step 1: message / Email / day 3");

    fireEvent.click(screen.getByTestId("button-marketing-preview-content-content-2"));

    expect(screen.getByTestId("marketing-content-preview")).toHaveTextContent("Design JSON present");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("Lovable design preview");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("Partner hero");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("Lovable builder copy");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("CTA: Book a demo -> https://v2.vyva.life/demo");
    expect(within(screen.getByTestId("marketing-content-design-preview")).getByAltText("Partner hero")).toHaveAttribute("src", "https://cdn.example.test/partner-design.png");
    expect(screen.getByTestId("marketing-content-origin-summary")).toHaveTextContent("Imported from Social post");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("VYVA updated");
    expect(screen.getByTestId("marketing-selected-content-usage")).toHaveTextContent("Used in campaigns and journeys");
    expect(screen.getByTestId("marketing-selected-content-usage")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Design blocks: 1");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Design keys: blocks");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Media refs: 1");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("https://cdn.example.test/partner.png");
    expect(within(screen.getByTestId("marketing-content-preview-panel")).getByAltText("partner.png")).toHaveAttribute("src", "https://cdn.example.test/partner.png");
    expect(openMetadataPanel("marketing-content-metadata-panel")).toHaveTextContent("extraLovableOnlyField");
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("https://cdn.example.test/partner.png");
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("Lovable ID: media-1");
    expect(screen.getByTestId("marketing-media-timeline-media-1")).toHaveTextContent("Synced");
    expect(screen.getByAltText("Partner post")).toHaveAttribute("src", "https://cdn.example.test/partner.png");

    fireEvent.click(within(screen.getByTestId("marketing-selected-content-usage")).getByTestId("button-marketing-open-content-usage-campaign:campaign-1:channel-1-linkedin"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    expect(screen.getByTestId("marketing-calendar-scheduler")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-calendar-scheduler")).toHaveTextContent("List: Partners");
    expect(screen.getByTestId("marketing-calendar-unscheduled")).toHaveTextContent("Partner outreach");

    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    expect(screen.getByTestId("marketing-audience-health-panel")).toHaveTextContent("Audience health");
    expect(screen.getByTestId("marketing-audience-health-panel")).toHaveTextContent("Relationship readiness");
    expect(screen.getByTestId("marketing-audience-health-score")).toHaveTextContent("50%");
    expect(screen.getByTestId("button-marketing-audience-health-reach")).toHaveTextContent("2/2");
    expect(screen.getByTestId("button-marketing-audience-health-consent")).toHaveTextContent("2 contacts need review");
    expect(screen.getByTestId("button-marketing-audience-health-segmentation")).toHaveTextContent("1/2");
    expect(screen.getByTestId("button-marketing-audience-health-lists")).toHaveTextContent("1 imported list member ID");
    fireEvent.click(screen.getByTestId("button-marketing-audience-health-consent"));
    expect(screen.getByTestId("select-marketing-contact-consent-filter")).toHaveValue("pending");
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Showing pending contacts for consent cleanup.");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("1 visible of 2 contacts");
    fireEvent.click(screen.getByTestId("button-marketing-clear-contact-filters"));
    expect(screen.getByTestId("marketing-contacts-table")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("hassan@example.com");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("+34 983 419 300");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("+34 770 900 123");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Moka Digital");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Partner");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("en");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("lead");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("healthcare");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Spain");
    expect(screen.getByTestId("marketing-contact-profile-signals-contact-2")).toHaveTextContent("CRM: 87");
    expect(screen.getByTestId("marketing-contact-profile-signals-contact-2")).toHaveTextContent("Lifecycle: lead");
    expect(screen.getByTestId("marketing-contact-profile-signals-contact-2")).toHaveTextContent("Persona: partner-lead");
    expect(screen.getByTestId("marketing-contact-profile-signals-contact-2")).toHaveTextContent("Profile email: profile-lead@example.com");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("madrid");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("List: Partners");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Lovable ID: lovable-contact-2");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Profile: profile-2");
    expect(screen.getByTestId("marketing-contact-timeline-contact-2")).toHaveTextContent("Synced");
    expect(openMetadataPanel("marketing-contact-metadata-contact-2")).toHaveTextContent("partner-lead");
    fireEvent.click(screen.getByTestId("button-marketing-view-contact-contact-2"));
    expect(screen.getByTestId("marketing-contact-relationship-panel")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-contact-relationship-score")).toHaveTextContent("75% ready");
    expect(screen.getByTestId("marketing-contact-relationship-channels")).toHaveTextContent("hassan@example.com");
    expect(screen.getByTestId("marketing-contact-relationship-context")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-contact-relationship-context")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-contact-relationship-context")).toHaveTextContent("B2B nurture");
    expect(screen.getByTestId("marketing-contact-next-actions")).toHaveTextContent("Review consent: pending.");
    expect(screen.getByTestId("marketing-contact-template-recommendations")).toHaveTextContent("Suggested templates");
    expect(screen.getByTestId("marketing-contact-template-whatsapp-partner-proof-nudge")).toHaveTextContent("WhatsApp partner proof nudge");
    expect(screen.getByTestId("marketing-contact-template-whatsapp-partner-proof-nudge")).toHaveTextContent("WhatsApp ready");
    expect(screen.getByTestId("marketing-contact-template-whatsapp-partner-proof-nudge")).toHaveTextContent("B2B relationship match");
    expect(screen.getByTestId("marketing-contact-template-whatsapp-partner-proof-nudge")).toHaveTextContent("Partner-ready");
    expect(screen.queryByTestId("marketing-contact-template-linkedin-family-proof-article")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-use-contact-template-whatsapp-partner-proof-nudge"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent('Template "WhatsApp partner proof nudge" applied for Hassan Partner.');
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("WhatsApp partner proof nudge campaign");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("whatsapp");
    expect(screen.getByTestId("input-marketing-campaign-recipient-filter")).toHaveValue("hassan@example.com");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-view-contact-contact-2"));
    fireEvent.click(screen.getByTestId("button-marketing-build-contact-campaign-contact-2"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Studio focused on Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("B2B partner introduction");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect(screen.getByTestId("input-marketing-campaign-recipient-filter")).toHaveValue("hassan@example.com");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    expect(screen.getByTestId("marketing-contacts-view-switcher")).toHaveTextContent("Contacts (2)");
    expect(screen.getByTestId("marketing-contacts-view-switcher")).toHaveTextContent("Lists (1)");
    fireEvent.click(screen.getByTestId("button-marketing-audience-health-lists"));
    expect(screen.getByTestId("button-marketing-lists-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("marketing-audience-feedback")).toHaveTextContent('Reviewing unmapped members in "Partners".');
    expect(screen.getByTestId("marketing-audience-builder")).toHaveTextContent("Rules JSON");
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("1 unmapped");
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("Synced");
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("List member preview");
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("Partner at Moka Digital");
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("hassan@example.com");
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("Mapped");
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("Imported only");
    fireEvent.click(screen.getByTestId("button-marketing-open-audience-member-contact-audience-1-contact-2"));
    expect(screen.getByTestId("button-marketing-contacts-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("marketing-contact-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-contact-editor-feedback")).toHaveTextContent('Editing "Hassan Partner".');
    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("Lovable list member 5");
    expect(within(screen.getByTestId("marketing-audience-member-preview-audience-1")).queryByText("Lovable list member 7")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-toggle-audience-members-audience-1"));
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("Lovable list member 7");
    expect(screen.getByTestId("button-marketing-toggle-audience-members-audience-1")).toHaveTextContent("Collapse members");

    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Not configured");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("Endpoint source: default");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("Bearer token available: no");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("VYVA_MARKETING_EXPORT_TOKEN: no");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("LOVABLE_MARKETING_API_KEY: no");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("Sync API build: marketing-sync-status-2026-07-12-no-cache");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Email is enabled through VYVA");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Enabled");
    expect(screen.getByTestId("marketing-email-scheduler-status")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("marketing-email-scheduler-status")).toHaveTextContent("Manual Run due emails button only");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("Dataset: live");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("Exported at");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("Endpoint: https://lovable.example.test");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("Cursor: cursor-1");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("saved_email_templates");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Exported by Lovable");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Audiences: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Media assets: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Campaign metrics: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Journey enrollments: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Campaign recipients: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Unmapped list members: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Unmapped campaign recipients: 1");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("Content");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("complete");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("Lovable 2 / VYVA 2");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("Mapped members");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("derived");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("content: 8 of 9 fields mapped first-class");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Mapped first-class: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("contacts: 11 of 11 fields mapped first-class");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Mapped first-class: audienceType, email, id, name, phoneNumber, profile.crmScore, profile.emailAddress, profile.firstName, tags, updatedAt, vertical");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Metadata-only: extraLovableOnlyField");
    const contentCoverage = openMetadataPanel("marketing-sync-field-coverage-sync-1-content");
    expect(contentCoverage).toHaveTextContent("Metadata-only: extraLovableOnlyField");
    expect(contentCoverage).toHaveTextContent("Mapped first-class: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(contentCoverage).toHaveTextContent("All exported: body, channel, emailTemplate.previewText, extraLovableOnlyField, id, status, subject, template.html_content, title");
    const syncDestinationMap = screen.getAllByTestId("marketing-lovable-destination-map")[0];
    expect(syncDestinationMap).toHaveTextContent("Where Lovable data appears");
    expect(syncDestinationMap).toHaveTextContent("Saved email templates");
    expect(syncDestinationMap).toHaveTextContent("Content tab");
    expect(syncDestinationMap).toHaveTextContent("Lists and audiences");
    expect(syncDestinationMap).toHaveTextContent("Contacts tab > Lists");
    expect(syncDestinationMap).toHaveTextContent("Campaigns");
    expect(syncDestinationMap).toHaveTextContent("Dashboard, Campaigns, Calendar");
    expect(screen.getByTestId("button-marketing-run-sync")).toBeDisabled();
    expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("VYVA_MARKETING_EXPORT_TOKEN or LOVABLE_MARKETING_API_KEY");
    expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("default Lovable export endpoint is already built in");
  });

  it("surfaces recommended next actions and routes to the right work area", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");

    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Finish Lovable sync setup");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Review ready email send");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Replace missing Lovable content");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Review audience mapping");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Attach campaign content");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Prepare manual channel handoff");

    fireEvent.click(screen.getByTestId("button-marketing-action-ready-email"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-campaign-readiness-panel")).toHaveTextContent("Email send");
    expect(screen.getByText('Opened "Caregiver welcome" for final email review.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-action-missing-content"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Lovable content coverage");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Lovable content placeholders");
    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("Content is loaded, but hidden by filters.");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-action-audience-mapping"));
    expect(screen.getByTestId("button-marketing-lists-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("marketing-audience-builder")).toHaveTextContent("Rules JSON");
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("Partners");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-action-campaign-content"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Partner outreach");
    expect(screen.getByText('Opened "Partner outreach" to attach missing channel content.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-action-manual-handoff"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByText('Opened "Caregiver welcome" to prepare non-email channel handoff.')).toBeInTheDocument();
  });

  it("shows all imported Lovable details instead of hiding rows behind preview caps", async () => {
    const manyRecipients = Array.from({ length: 105 }, (_, index) => {
      const recipientNumber = index + 1;
      return {
        id: `recipient-${recipientNumber}`,
        campaignId: "campaign-1",
        contactId: null,
        profileId: null,
        channel: "email",
        recipient: `caregiver-${recipientNumber}@example.com`,
        status: "planned",
        scheduledAt: "2026-07-06T09:00:00.000Z",
        snapshot: {
          fullName: `Caregiver ${recipientNumber}`,
          email: `caregiver-${recipientNumber}@example.com`,
          lovableSource: `recipient-export-${recipientNumber}`,
        },
        communicationLogId: null,
        createdAt: "2026-07-05T09:00:00.000Z",
        updatedAt: "2026-07-05T09:00:00.000Z",
      };
    });
    const manyMediaAssets = [
      ...mediaAssets,
      ...Array.from({ length: 12 }, (_, index) => {
        const mediaNumber = index + 2;
        return {
          id: `media-${mediaNumber}`,
          contentAssetId: null,
          contentTitle: null,
          source: "lovable",
          assetType: "image",
          originalUrl: `https://cdn.example.test/asset-${mediaNumber}.png`,
          localUrl: null,
          status: "referenced",
          lovableExternalId: `media-${mediaNumber}`,
          metadata: { lovable: { altText: `Imported media ${mediaNumber}` } },
        };
      }),
    ];
    const expandedContact = {
      ...contacts[1],
      tags: Array.from({ length: 10 }, (_, index) => `tag-${index + 1}`),
      lists: ["Partners", "Priority", "Madrid", "Care homes"],
    };
    const expandedContent = [
      content[0],
      {
        ...content[1],
        designJson: {
          blocks: Array.from({ length: 9 }, (_, index) => ({
            type: "section",
            headline: `Design block ${index + 1}`,
            body: `Lovable builder copy ${index + 1}`,
            imageUrl: `https://cdn.example.test/design-${index + 1}.png`,
          })),
        },
        mediaAssets: Array.from({ length: 7 }, (_, index) => ({
          url: `https://cdn.example.test/embedded-${index + 1}.png`,
        })),
      },
    ];
    const expandedCampaigns = [
      { ...campaigns[0], recipientCount: manyRecipients.length, recipients: manyRecipients },
      {
        ...campaigns[1],
        channels: ["linkedin", "instagram", "facebook", "tiktok", "whatsapp"].map((channel) => ({
          id: `channel-2-${channel}`,
          channel,
          contentAssetId: null,
          scheduledAt: null,
          status: "draft",
          sendCapability: channel === "whatsapp" ? "future_send_capable" : "planning_only",
        })),
      },
    ];

    renderPage({}, {
      campaigns: expandedCampaigns,
      contacts: [contacts[0], expandedContact],
      content: expandedContent,
      mediaAssets: manyMediaAssets,
    });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));

    expect(openMetadataPanel("marketing-campaign-metric-metadata-metric-10")).toHaveTextContent("metric-provider-10");
    expect(screen.getByTestId("marketing-campaign-edit-form")).toHaveTextContent("Caregiver 105");
    expect(openMetadataPanel("marketing-campaign-recipient-snapshot-recipient-105")).toHaveTextContent("recipient-export-105");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("https://cdn.example.test/asset-13.png");
    fireEvent.click(screen.getByTestId("button-marketing-preview-content-content-2"));
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("embedded-7.png");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("Design block 9");

    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    expect(screen.getByTestId("marketing-contacts-table")).toHaveTextContent("tag-10");
    expect(screen.getByTestId("marketing-contacts-table")).toHaveTextContent("List: Care homes");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    expect(screen.getByTestId("marketing-calendar-unscheduled-channel-link-channel-2-tiktok")).toHaveTextContent("TikTok");
  });

  it("searches imported Lovable IDs, metadata, media, lists, and journey steps", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "recipient-export" } });
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Caregiver welcome")).toBeInTheDocument();
    expect(within(screen.getByTestId("marketing-campaign-table")).queryByText("Partner outreach")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "triggerWindow" } });
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    expect(screen.getByTestId("marketing-journeys-tab")).toHaveTextContent("B2B nurture");

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "partner hero image" } });
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("https://cdn.example.test/partner.png");

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "lovable-audience-1" } });
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("Partners");
  });

  it("filters Lovable contacts by source, consent, segmentation fields, and lists", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));

    expect(screen.getByTestId("marketing-contact-segmentation-filters")).toHaveTextContent("lovable (1)");
    expect(screen.getByTestId("marketing-contact-segmentation-filters")).toHaveTextContent("pending (1)");
    expect(screen.getByTestId("marketing-contact-segmentation-filters")).toHaveTextContent("en (1)");
    expect(screen.getByTestId("marketing-contact-segmentation-filters")).toHaveTextContent("lead (1)");
    expect(screen.getByTestId("marketing-contact-segmentation-filters")).toHaveTextContent("healthcare (1)");
    expect(screen.getByTestId("marketing-contact-segmentation-filters")).toHaveTextContent("Spain (1)");
    expect(screen.getByTestId("marketing-contact-segmentation-filters")).toHaveTextContent("Partners (1)");

    fireEvent.change(screen.getByTestId("select-marketing-contact-market-filter"), { target: { value: "spain" } });
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("1 visible of 2 contacts");
    expect(screen.getByTestId("marketing-contacts-table")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-contacts-table")).not.toHaveTextContent("Karim Assad");

    fireEvent.change(screen.getByTestId("select-marketing-contact-list-filter"), { target: { value: "partners" } });
    expect(screen.getByTestId("marketing-contacts-table")).toHaveTextContent("List: Partners");

    fireEvent.change(screen.getByTestId("select-marketing-contact-source-filter"), { target: { value: "vyva" } });
    expect(screen.getByTestId("marketing-contact-empty-diagnostic")).toHaveTextContent("Contacts are loaded, but hidden");

    fireEvent.click(screen.getByTestId("button-marketing-clear-contact-filters"));
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("2 visible of 2 contacts");
    expect(screen.getByTestId("marketing-contacts-table")).toHaveTextContent("Karim Assad");
    expect(screen.getByTestId("marketing-contacts-table")).toHaveTextContent("Hassan Partner");
  });

  it("filters the content library by imported Lovable source type", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    expect(screen.getByTestId("select-marketing-content-source-filter")).toHaveTextContent("Social post (1)");
    expect(screen.getByTestId("select-marketing-content-source-filter")).toHaveTextContent("VYVA (1)");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Partner post");

    fireEvent.change(screen.getByTestId("select-marketing-content-source-filter"), { target: { value: "social_post" } });

    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("1 visible of 2 assets");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-content-tab")).not.toHaveTextContent("Welcome email");

    fireEvent.click(screen.getByTestId("button-marketing-preview-content-content-2"));

    expect(screen.getByTestId("marketing-content-origin-summary")).toHaveTextContent("Imported from Social post");
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("https://cdn.example.test/partner.png");

    fireEvent.change(screen.getByTestId("select-marketing-content-source-filter"), { target: { value: "vyva" } });

    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("1 visible of 2 assets");
    expect(screen.getByTestId("marketing-content-library-table")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-content-library-table")).not.toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-content-origin-summary")).toHaveTextContent("Imported from Social post");
  });

  it("explains empty content when Lovable sync has not imported anything yet", async () => {
    renderPage({ runs: [] }, { content: [], mediaAssets: [] });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("No Lovable content has been imported yet.");
    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("Run the one-way sync in Settings");

    fireEvent.click(screen.getByTestId("button-marketing-open-sync-settings"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Lovable sync");
  });

  it("explains when content exists but filters hide every asset", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "no matching content" } });

    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("Content is loaded, but hidden by filters.");
    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("2 content assets are in VYVA");

    fireEvent.click(screen.getByTestId("button-marketing-clear-content-filters"));
    expect(screen.getByTestId("input-marketing-search")).toHaveValue("");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Partner post");
  });

  it("shows scheduled and unscheduled campaigns in the calendar and opens campaign details", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));

    expect(screen.getByTestId("marketing-calendar-scheduler")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-calendar-timeline")).toHaveTextContent("1 scheduled");
    expect(screen.getByTestId("marketing-calendar-channel-link-channel-1")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-calendar-performance-campaign-1")).toHaveTextContent("66 sent");
    expect(screen.getByTestId("marketing-calendar-performance-campaign-1")).toHaveTextContent("44 opened");
    expect(screen.getByTestId("marketing-calendar-unscheduled")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-calendar-unscheduled-channel-link-channel-2")).toHaveTextContent("No content linked");
    expect(screen.getByTestId("marketing-calendar-unscheduled-performance-campaign-2")).toHaveTextContent("No imported metrics");

    fireEvent.click(screen.getByTestId("button-marketing-calendar-edit-campaign-1"));

    expect(screen.getByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-edit-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-campaign-name")).toHaveValue("Caregiver welcome");
  });

  it("opens linked content records from campaign and journey previews even when content filters hide them", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.change(screen.getByTestId("select-marketing-content-source-filter"), { target: { value: "vyva" } });

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));
    fireEvent.click(screen.getByTestId("marketing-campaign-channel-content-preview-1-preview"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Partner post".');
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Lovable ID: lovable-content-2");

    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-journey-journey-1"));
    fireEvent.click(screen.getByTestId("marketing-journey-step-content-preview-0-edit"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Editing "Welcome email".');
    expect(screen.getByTestId("marketing-content-editor-panel")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Welcome email");
  });

  it("opens Lovable content from campaign, calendar, and journey overview references", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("button-marketing-preview-campaign-content-channel-1-linkedin"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Partner post".');
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Partner post");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-calendar-content-channel-1"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Editing "Welcome email".');
    expect(screen.getByTestId("marketing-content-editor-panel")).toHaveTextContent("Welcome email");

    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    fireEvent.click(screen.getByTestId("button-marketing-preview-journey-step-content-step-1"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Welcome email".');
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Welcome email");
  });

  it("explains when the current admin cannot run Lovable sync", async () => {
    renderPage({ configured: true, canRunSync: false, apiUrl: "https://lovable.example.test" });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-settings"));

    expect(screen.getByTestId("button-marketing-run-sync")).toBeDisabled();
    expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("Only the super admin (karim.assad@mokadigital.net) can run Lovable sync.");
  });

  it("shows inline Lovable sync progress and completion after clicking", async () => {
    renderPage({ configured: true, canRunSync: true, apiUrl: "https://lovable.example.test" });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    fireEvent.click(screen.getByTestId("button-marketing-run-sync"));

    expect(screen.getByTestId("button-marketing-run-sync")).toHaveTextContent("Running sync...");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/sync/lovable/run", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("Lovable sync completed. Imported Campaigns: 1, Contacts: 1, Content: 1, Journeys: 1.");
    });
  });

  it("previews the Lovable export before importing rows", async () => {
    renderPage({ configured: true, canRunSync: true, apiUrl: "https://lovable.example.test" });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    fireEvent.click(screen.getByTestId("button-marketing-preview-export"));

    expect(screen.getByTestId("button-marketing-preview-export")).toHaveTextContent("Checking export...");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/sync/lovable/preview", undefined);
    });

    expect(screen.getByTestId("marketing-export-preview-feedback")).toHaveTextContent("Lovable export contains");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("Content: 2");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("saved_email_template: 1");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("social_post: 1");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("Top-level export keys");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("content: 8 of 9 fields mapped first-class");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("Mapped: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("Metadata-only: extraLovableOnlyField");
    const previewContentCoverage = openMetadataPanel("marketing-export-field-coverage-content");
    expect(previewContentCoverage).toHaveTextContent("Metadata-only: extraLovableOnlyField");
    expect(previewContentCoverage).toHaveTextContent("Mapped first-class: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(previewContentCoverage).toHaveTextContent("All exported: body, channel, emailTemplate.previewText, extraLovableOnlyField, id, status, subject, template.html_content, title");
    const previewDestinationMap = screen.getAllByTestId("marketing-lovable-destination-map").at(-1);
    expect(previewDestinationMap).toHaveTextContent("Where Lovable data appears");
    expect(previewDestinationMap).toHaveTextContent("Social posts");
    expect(previewDestinationMap).toHaveTextContent("Content tab");
    expect(previewDestinationMap).toHaveTextContent("Journeys");
    expect(previewDestinationMap).toHaveTextContent("Journeys tab");
    expect(screen.getByTestId("marketing-export-preview-samples")).toHaveTextContent("Recognized sample rows");
    expect(screen.getByTestId("marketing-export-preview-samples")).toHaveTextContent("template_name");
    expect(screen.getByTestId("marketing-export-preview-raw-samples")).toHaveTextContent("social_posts");
  });

  it("applies content templates into the draft form", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Referral ask email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok feature demo script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn family proof article");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("WhatsApp partner proof nudge");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("29 templates");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("7");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("TikTok");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("3");
    expect(screen.getByTestId("marketing-template-coverage-matrix")).toHaveTextContent("Channel x audience matrix");
    expect(screen.getByTestId("marketing-template-coverage-matrix")).toHaveTextContent("Target: 3 per pack");
    fireEvent.click(screen.getByTestId("button-marketing-template-matrix-whatsapp-b2b"));
    expect(screen.getByTestId("select-marketing-template-channel")).toHaveValue("whatsapp");
    expect(screen.getByTestId("select-marketing-template-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing WhatsApp B2B template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("WhatsApp partner proof nudge");
    expect(screen.getByTestId("marketing-template-gap-suggestions")).toHaveTextContent("LinkedIn B2C starter");
    expect(screen.getByTestId("marketing-template-gap-suggestions")).toHaveTextContent("WhatsApp B2B starter");
    expect(screen.getByTestId("marketing-template-gap-whatsapp-b2b")).toHaveTextContent("AI starter prompt");
    expect(screen.getByTestId("marketing-template-gap-pack")).toHaveTextContent("Build a starter pack");
    expect(screen.getByTestId("button-marketing-template-gap-pack-ai")).toHaveTextContent("Draft top 2 with AI");

    fireEvent.click(screen.getByTestId("button-marketing-template-gap-pack-ai"));
    expect(screen.getByTestId("button-marketing-template-gap-pack-ai")).toHaveTextContent("Creating pack...");
    expect(screen.getByTestId("marketing-template-gap-pack-progress")).toHaveTextContent("Creating");
    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("AI gap pack created: 2 template drafts");
    });
    expect(screen.getByTestId("marketing-content-editor-form")).toBeInTheDocument();
    expect((screen.getByTestId("input-marketing-edit-content-title") as HTMLInputElement).value).toContain("AI content");
    const gapPackAiCalls = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    const gapPackContentPosts = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    expect(gapPackAiCalls).toHaveLength(2);
    expect(gapPackContentPosts).toHaveLength(2);
    expect(JSON.parse(String(gapPackContentPosts[0]?.[1]?.body ?? "{}"))).toMatchObject({
      status: "draft",
      source: "vyva",
      metadata: { generatedFrom: "template_gap_pack" },
    });

    fireEvent.click(screen.getByTestId("button-marketing-template-gap-studio-whatsapp-b2b"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("whatsapp");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template gap loaded: WhatsApp B2B starter");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Studio loaded from gap: WhatsApp B2B starter");

    fireEvent.click(screen.getByTestId("button-marketing-template-gap-ai-whatsapp-b2b"));
    expect(screen.getByTestId("button-marketing-template-gap-ai-whatsapp-b2b")).toHaveTextContent("Generating...");
    await waitFor(() => {
      expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Community co-host whatsapp AI content");
    });
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("AI draft generated from gap: WhatsApp B2B starter");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("AI whatsapp body copy");
    expect((screen.getByTestId("textarea-marketing-content-design-json") as HTMLTextAreaElement).value).toContain("marketing_template_gap_ai");
    const gapAiCallBody = apiFetchMock.mock.calls
      .filter(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")))
      .find((body) => body.contentTitle === "WhatsApp B2B starter");
    expect(gapAiCallBody).toMatchObject({
      audienceType: "b2b",
      channel: "whatsapp",
      tone: "expert",
      angle: "proof",
      contentTitle: "WhatsApp B2B starter",
    });

    fireEvent.click(screen.getByTestId("button-marketing-template-gap-whatsapp-b2b"));
    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("WhatsApp B2B starter");
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("whatsapp");
    expect(screen.getByTestId("input-marketing-content-cta-label")).toHaveValue("Book a demo");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("Help care teams");
    expect((screen.getByTestId("textarea-marketing-content-design-json") as HTMLTextAreaElement).value).toContain("marketing_template_gap_suggestion");
    expect(screen.getByTestId("select-marketing-template-channel")).toHaveValue("whatsapp");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Gap starter drafted: WhatsApp B2B starter");

    fireEvent.click(screen.getByTestId("button-marketing-template-filter-channel-tiktok"));
    expect(screen.getByTestId("select-marketing-template-channel")).toHaveValue("tiktok");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok feature demo script");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");

    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));
    fireEvent.change(screen.getByTestId("input-marketing-template-search"), { target: { value: "family proof" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-channel"), { target: { value: "linkedin" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-audience"), { target: { value: "b2c" } });

    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn family proof article");
    fireEvent.click(screen.getByTestId("button-marketing-use-content-template-linkedin-family-proof-article"));

    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("LinkedIn family proof article");
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("linkedin");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("Families rarely need more messages");
    expect((screen.getByTestId("textarea-marketing-content-design-json") as HTMLTextAreaElement).value).toContain("linkedin-family-article");
    expect(screen.getByTestId("marketing-content-feedback")).toHaveTextContent("Template applied: LinkedIn family proof article");

    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));
    fireEvent.change(screen.getByTestId("input-marketing-template-search"), { target: { value: "profile" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-channel"), { target: { value: "whatsapp" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-audience"), { target: { value: "b2c" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-category"), { target: { value: "Onboarding" } });

    const filteredGallery = within(screen.getByTestId("marketing-content-template-gallery"));
    expect(filteredGallery.getByText("Profile completion WhatsApp nudge")).toBeInTheDocument();
    expect(filteredGallery.queryByText("Caregiver welcome email")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-use-content-template-whatsapp-profile-nudge"));

    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Profile completion WhatsApp nudge");
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("whatsapp");
    expect(screen.getByTestId("input-marketing-content-cta-label")).toHaveValue("Complete profile");
    expect(screen.getByTestId("input-marketing-content-cta-url")).toHaveValue("https://v2.vyva.life/profile");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("Hi {{first_name}}");
    expect((screen.getByTestId("textarea-marketing-content-design-json") as HTMLTextAreaElement).value).toContain("marketing_content_template_gallery");
    expect(screen.getByTestId("marketing-content-feedback")).toHaveTextContent("Template applied: Profile completion WhatsApp nudge");
  });

  it("recommends best-fit templates and starts a campaign from the matchmaker", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    const matchmaker = within(screen.getByTestId("marketing-template-matchmaker"));
    expect(matchmaker.getByText("Caregiver welcome email")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-template-match-caregiver-email-welcome")).toHaveTextContent("1 reachable via Email");

    fireEvent.change(screen.getByTestId("select-marketing-template-channel"), { target: { value: "linkedin" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-audience"), { target: { value: "b2b" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-category"), { target: { value: "B2B partner" } });

    const filteredMatchmaker = within(screen.getByTestId("marketing-template-matchmaker"));
    expect(filteredMatchmaker.getByText("Partner demo LinkedIn post")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-template-match-linkedin-partner-demo")).toHaveTextContent("1 reachable via LinkedIn");

    fireEvent.click(screen.getByTestId("button-marketing-match-start-linkedin-partner-demo"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Partner demo LinkedIn post campaign");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign starter applied from \"Partner demo LinkedIn post\"");
  });

  it("starts a campaign planner draft from a content template", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-start-campaign-template-caregiver-email-welcome"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Caregiver welcome email campaign");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2c");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect((screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement).value).toContain("A warm first email for a family caregiver");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign starter applied from \"Caregiver welcome email\"");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Caregiver welcome email");
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("email");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("You are now connected to {{elder_name}}'s care circle");
  });

  it("loads a smart campaign planner starter with audience, content, and recipients", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");

    const starterPanel = within(screen.getByTestId("marketing-campaign-planner-recipes"));
    expect(starterPanel.getByText("Partner outreach")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-campaign-recipe-b2b-partner-outreach"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("B2B partner introduction");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-campaign-content")).toHaveValue("content-2");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("checkbox-marketing-campaign-snapshot")).toBeChecked();
    expect(screen.getByTestId("marketing-campaign-draft-recipient-preview")).toHaveTextContent("1");
    expect((screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement).value).toContain("Start a partner conversation");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Starter loaded: Partner outreach with Partner post");
    expect(screen.getByTestId("marketing-campaign-draft-readiness")).toHaveTextContent("Ready to add");
    expect(screen.getByTestId("marketing-campaign-draft-readiness-content")).toHaveTextContent("Partner post is linked for LinkedIn");
    expect(screen.getByTestId("marketing-campaign-draft-readiness-channel")).toHaveTextContent("LinkedIn will be saved for planning or manual handoff");
  });

  it("drafts missing campaign content directly from the planner", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "Community proof post" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-audience"), { target: { value: "b2c" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-channel"), { target: { value: "facebook" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-campaign-objective"), {
      target: { value: "Show families how VYVA turns daily check-ins into calmer care decisions." },
    });

    expect(screen.getByTestId("marketing-campaign-draft-readiness-content")).toHaveTextContent("No active Facebook content assets yet.");
    fireEvent.click(screen.getByTestId("button-marketing-draft-content-from-campaign"));

    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Community proof post Facebook content");
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("facebook");
    expect(screen.getByTestId("input-marketing-content-subject")).toHaveValue("");
    expect(screen.getByTestId("textarea-marketing-content-body")).toHaveTextContent("Show families how VYVA turns daily check-ins into calmer care decisions.");
    expect(screen.getByTestId("textarea-marketing-content-design-json")).toHaveTextContent("\"generator\": \"marketing_campaign_planner\"");
    expect(screen.getByTestId("textarea-marketing-content-design-json")).toHaveTextContent("\"channel\": \"facebook\"");
    expect(screen.getByTestId("marketing-content-feedback")).toHaveTextContent("Drafted Facebook content from the campaign planner.");
  });

  it("creates and links missing campaign content from the planner", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "Community proof post" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-channel"), { target: { value: "facebook" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-campaign-objective"), {
      target: { value: "Show families how VYVA turns daily check-ins into calmer care decisions." },
    });

    fireEvent.click(screen.getByTestId("button-marketing-create-link-content-from-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });
    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      title: "Community proof post Facebook content",
      channel: "facebook",
      status: "draft",
      body: expect.stringContaining("Show families how VYVA turns daily check-ins into calmer care decisions."),
      designJson: expect.objectContaining({
        generator: "marketing_campaign_planner",
        channel: "facebook",
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId("select-marketing-campaign-content")).toHaveValue("content-created");
    });
    expect(screen.getByTestId("marketing-campaign-draft-readiness-content")).toHaveTextContent("Community proof post Facebook content is linked for Facebook");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Created and linked Community proof post Facebook content");
  });

  it("creates rich marketing content drafts", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.change(screen.getByTestId("input-marketing-content-title"), { target: { value: "Rich content draft" } });
    fireEvent.change(screen.getByTestId("select-marketing-content-channel"), { target: { value: "linkedin" } });
    fireEvent.change(screen.getByTestId("select-marketing-content-status"), { target: { value: "review" } });
    fireEvent.change(screen.getByTestId("input-marketing-content-language"), { target: { value: "es" } });
    fireEvent.change(screen.getByTestId("input-marketing-content-subject"), { target: { value: "Subject line" } });
    fireEvent.change(screen.getByTestId("input-marketing-content-cta-label"), { target: { value: "Open" } });
    fireEvent.change(screen.getByTestId("input-marketing-content-cta-url"), { target: { value: "https://v2.vyva.life/open" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-content-body"), { target: { value: "Plain copy" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-content-html"), { target: { value: "<p>HTML copy</p>" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-content-design-json"), { target: { value: "{\"blocks\":[{\"type\":\"hero\"}]}" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-content-media-assets"), { target: { value: "[{\"url\":\"https://cdn.example.test/rich.png\"}]" } });
    fireEvent.click(screen.getByTestId("button-marketing-add-content"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });
    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      title: "Rich content draft",
      channel: "linkedin",
      status: "review",
      language: "es",
      subject: "Subject line",
      body: "Plain copy",
      htmlBody: "<p>HTML copy</p>",
      ctaLabel: "Open",
      ctaUrl: "https://v2.vyva.life/open",
      designJson: { blocks: [{ type: "hero" }] },
      mediaAssets: [{ url: "https://cdn.example.test/rich.png" }],
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("Content draft created.");
    });
  });

  it("edits and deletes imported content assets", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    fireEvent.click(screen.getByTestId("button-marketing-delete-content-content-2"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Click Confirm delete to remove "Partner post".');
    expect(screen.getByTestId("button-marketing-delete-content-content-2")).toHaveTextContent("Confirm delete");
    expect(screen.getByTestId("marketing-content-action-card-content-2")).toHaveTextContent("Confirm delete?");
    expect(screen.getByTestId("marketing-content-action-card-content-2")).toHaveTextContent("Lovable is not changed.");
    expect(screen.getByTestId("marketing-content-delete-confirmation-content-2")).toHaveTextContent("Click Confirm delete to remove this content.");
    fireEvent.click(screen.getByTestId("button-marketing-delete-content-content-2"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content/content-2", expect.objectContaining({ method: "DELETE" }));
    });
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Deleted "Partner post".');

    fireEvent.click(screen.getByTestId("button-marketing-preview-content-content-2"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Partner post".');
    expect(screen.getByTestId("marketing-content-action-card-content-2")).toHaveTextContent("Preview opened.");
    expect(screen.getByTestId("marketing-content-action-card-content-2")).toHaveTextContent("Partner update");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Preview panel opened.");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Partner update");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Social post");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Rendered HTML available");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Lovable design data");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("1 media refs");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("CTA: Read more -> https://v2.vyva.life/partners");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Lovable ID: lovable-content-2");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Focus preview");
    expect(screen.getByTestId("marketing-content-inline-preview-content-2")).toHaveTextContent("Partner update");
    expect(screen.getByTestId("marketing-content-inline-preview-content-2")).toHaveTextContent("Lovable design preview");
    expect(screen.getByTestId("marketing-content-inline-preview-content-2")).toHaveTextContent("Media references");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveAttribute("role", "dialog");
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveClass("fixed");
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveClass("z-[9999]");
    expect(screen.getByTestId("marketing-content-preview")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("Lovable source details");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("Source type");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("Social post");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("Platform");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("linkedin");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("Tags");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("b2b, partners");
    expect(screen.getByTestId("button-marketing-edit-previewed-content")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-edit-previewed-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Editing "Partner post".');

    fireEvent.click(screen.getByTestId("button-marketing-edit-content-content-2"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Editing "Partner post".');
    expect(screen.getByTestId("marketing-content-action-card-content-2")).toHaveTextContent("Editor opened.");
    expect(screen.getByTestId("marketing-content-action-card-content-2")).toHaveTextContent("Changes save to this VYVA content record.");
    expect(screen.getByTestId("marketing-content-editor-open-content-2")).toHaveTextContent("Editor panel opened.");
    expect(screen.getByTestId("marketing-content-editor-open-content-2")).toHaveTextContent("Edit and save this content directly here.");
    expect(screen.getByTestId("marketing-content-editor-open-content-2")).toHaveTextContent("Full editor");
    expect(screen.getByTestId("marketing-content-inline-editor-content-2")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-inline-edit-content-title-content-2")).toHaveValue("Partner post");
    expect(screen.getByTestId("textarea-marketing-inline-edit-content-body-content-2")).toHaveValue("Partner update");

    expect(screen.getByTestId("marketing-content-editor-panel")).toHaveAttribute("role", "dialog");
    expect(screen.getByTestId("marketing-content-editor-panel")).toHaveClass("fixed");
    expect(screen.getByTestId("marketing-content-editor-panel")).toHaveClass("z-[9999]");
    expect(screen.getByTestId("marketing-content-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Partner post");
    expect(screen.getByTestId("input-marketing-edit-content-source")).toHaveValue("lovable");
    expect(screen.getByTestId("input-marketing-edit-content-lovable-id")).toHaveValue("lovable-content-2");
    expect(screen.getByTestId("textarea-marketing-edit-content-metadata")).toHaveValue(JSON.stringify(content[1].metadata, null, 2));

    fireEvent.change(screen.getByTestId("input-marketing-edit-content-title"), { target: { value: "Updated partner post" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-content-channel"), { target: { value: "instagram" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-content-status"), { target: { value: "approved" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-content-language"), { target: { value: "es" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-content-subject"), { target: { value: "Updated subject" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-content-cta-label"), { target: { value: "Open" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-content-cta-url"), { target: { value: "https://v2.vyva.life/open" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-content-body"), { target: { value: "Updated plain copy" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-content-html"), { target: { value: "<p>Updated HTML</p>" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-content-design-json"), { target: { value: "{\"blocks\":[{\"type\":\"text\"}]}" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-content-media-assets"), { target: { value: "[{\"url\":\"https://cdn.example.test/new.png\"}]" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-content-metadata"), { target: { value: JSON.stringify({ ...content[1].metadata, review: "done" }) } });
    fireEvent.click(screen.getByTestId("button-marketing-save-content"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content/content-2", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content/content-2" && init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      title: "Updated partner post",
      channel: "instagram",
      status: "approved",
      language: "es",
      subject: "Updated subject",
      body: "Updated plain copy",
      htmlBody: "<p>Updated HTML</p>",
      ctaLabel: "Open",
      ctaUrl: "https://v2.vyva.life/open",
      source: "lovable",
      lovableExternalId: "lovable-content-2",
      designJson: { blocks: [{ type: "text" }] },
      mediaAssets: [{ url: "https://cdn.example.test/new.png" }],
      metadata: { ...content[1].metadata, review: "done" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("Updated.");
    });

    fireEvent.click(screen.getByTestId("button-marketing-delete-editing-content"));
    expect(screen.getByTestId("button-marketing-delete-editing-content")).toHaveTextContent("Confirm delete");
    fireEvent.click(screen.getByTestId("button-marketing-delete-editing-content"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content/content-2", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("edits and deletes imported media references", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("https://cdn.example.test/partner.png");
    expect(openMetadataPanel("marketing-media-metadata-media-1")).toHaveTextContent("Partner hero image");

    fireEvent.click(screen.getByTestId("button-marketing-preview-media-content-media-1"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Partner post".');
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Partner post");
    fireEvent.click(screen.getByTestId("button-marketing-edit-media-content-media-1"));
    expect(screen.getByTestId("marketing-content-editor-panel")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Partner post");

    fireEvent.click(screen.getByTestId("button-marketing-delete-media-media-1"));
    expect(screen.getByTestId("button-marketing-delete-media-media-1")).toHaveTextContent("Confirm delete");
    expect(screen.getByTestId("marketing-media-delete-confirmation-media-1")).toHaveTextContent("Click Confirm delete to remove this VYVA media reference.");
    fireEvent.click(screen.getByTestId("button-marketing-delete-media-media-1"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/media/media-1", expect.objectContaining({ method: "DELETE" }));
    });
    expect(screen.getByTestId("marketing-media-feedback")).toHaveTextContent("Media deleted.");

    fireEvent.click(screen.getByTestId("button-marketing-edit-media-media-1"));
    expect(screen.getByTestId("marketing-media-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-media-original-url")).toHaveValue("https://cdn.example.test/partner.png");

    fireEvent.change(screen.getByTestId("input-marketing-edit-media-original-url"), { target: { value: "https://cdn.example.test/partner-updated.png" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-media-type"), { target: { value: "hero_image" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-media-status"), { target: { value: "approved" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-media-content"), { target: { value: "content-1" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-media-local-url"), { target: { value: "/media/partner-updated.png" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-media-lovable-id"), { target: { value: "media-updated" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-media-metadata"), { target: { value: "{\"altText\":\"Updated hero\"}" } });
    fireEvent.click(screen.getByTestId("button-marketing-save-media"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/media/media-1", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/media/media-1" && init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      originalUrl: "https://cdn.example.test/partner-updated.png",
      assetType: "hero_image",
      status: "approved",
      contentAssetId: "content-1",
      localUrl: "/media/partner-updated.png",
      lovableExternalId: "media-updated",
      metadata: { altText: "Updated hero" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-media-feedback")).toHaveTextContent("Media updated.");
    });

    fireEvent.click(screen.getByTestId("button-marketing-delete-editing-media"));
    expect(screen.getByTestId("button-marketing-delete-editing-media")).toHaveTextContent("Confirm delete");
    fireEvent.click(screen.getByTestId("button-marketing-delete-editing-media"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/media/media-1", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("validates and creates richer marketing contacts", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));

    fireEvent.click(screen.getByTestId("button-marketing-add-contact"));
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Add at least a name, email, phone, or WhatsApp");

    fireEvent.change(screen.getByTestId("input-marketing-contact-name"), { target: { value: "New Partner" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-phone"), { target: { value: "+34 600 000 002" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-whatsapp"), { target: { value: "+34 600 000 003" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-role"), { target: { value: "Director" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-company"), { target: { value: "New Org" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-language"), { target: { value: "es" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-category"), { target: { value: "partner" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-vertical"), { target: { value: "health" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-market"), { target: { value: "Spain" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-tags"), { target: { value: "partner, madrid" } });
    fireEvent.click(screen.getByTestId("button-marketing-add-contact"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/contacts", expect.objectContaining({ method: "POST" }));
    });
    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/contacts" && init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      fullName: "New Partner",
      email: "new@example.com",
      phoneNumber: "+34 600 000 002",
      whatsappNumber: "+34 600 000 003",
      roleLabel: "Director",
      companyName: "New Org",
      language: "es",
      category: "partner",
      vertical: "health",
      market: "Spain",
      tags: ["partner", "madrid"],
      metadata: {
        segmentation: {
          language: "es",
          category: "partner",
          vertical: "health",
          market: "Spain",
        },
      },
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Marketing contact created.");
    });

    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));
    fireEvent.change(screen.getByTestId("input-marketing-audience-name"), { target: { value: "Madrid partners" } });
    fireEvent.change(screen.getByTestId("input-marketing-audience-description"), { target: { value: "Partners in Spain" } });
    fireEvent.change(screen.getByTestId("input-marketing-audience-rules"), { target: { value: "{\"market\":\"Spain\",\"vertical\":\"health\"}" } });
    fireEvent.change(screen.getByTestId("input-marketing-audience-contact-ids"), { target: { value: "lovable-contact-2\nmissing-contact" } });
    fireEvent.click(screen.getByTestId("button-marketing-add-audience"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/audiences", expect.objectContaining({ method: "POST" }));
    });
    const audiencePostCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/audiences" && init?.method === "POST");
    expect(JSON.parse(String(audiencePostCall?.[1]?.body))).toMatchObject({
      name: "Madrid partners",
      description: "Partners in Spain",
      listType: "dynamic",
      rules: { market: "Spain", vertical: "health" },
      contactExternalIds: ["lovable-contact-2", "missing-contact"],
    });
  });

  it("edits and deletes imported marketing contacts", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));

    fireEvent.click(screen.getByTestId("button-marketing-delete-contact-contact-2"));
    expect(screen.getByTestId("button-marketing-delete-contact-contact-2")).toHaveTextContent("Confirm delete");
    expect(screen.getByTestId("marketing-contact-delete-confirmation-contact-2")).toHaveTextContent("Click Confirm delete to remove this marketing contact.");
    fireEvent.click(screen.getByTestId("button-marketing-delete-contact-contact-2"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/contacts/contact-2", expect.objectContaining({ method: "DELETE" }));
    });
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Contact deleted.");

    fireEvent.click(screen.getByTestId("button-marketing-edit-contact-contact-2"));

    expect(screen.getByTestId("marketing-contact-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-contact-name")).toHaveValue("Hassan Partner");
    expect(screen.getByTestId("input-marketing-edit-contact-source")).toHaveValue("lovable");
    expect(screen.getByTestId("input-marketing-edit-contact-lovable-id")).toHaveValue("lovable-contact-2");
    expect(screen.getByTestId("input-marketing-edit-contact-profile-id")).toHaveValue("profile-2");
    expect(screen.getByTestId("input-marketing-edit-contact-organization-id")).toHaveValue("11111111-1111-4111-8111-111111111111");
    expect(screen.getByTestId("textarea-marketing-edit-contact-channel-availability")).toHaveValue(JSON.stringify({ email: true, linkedin: true, whatsapp: false, source: "lovable" }, null, 2));
    expect(screen.getByTestId("textarea-marketing-edit-contact-metadata")).toHaveValue(JSON.stringify(contacts[1].metadata, null, 2));

    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-name"), { target: { value: "Updated Partner" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-contact-audience"), { target: { value: "both" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-contact-consent"), { target: { value: "opted_in" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-email"), { target: { value: "updated@example.com" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-phone"), { target: { value: "+34 600 000 004" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-whatsapp"), { target: { value: "+34 600 000 005" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-role"), { target: { value: "Growth lead" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-company"), { target: { value: "Updated Org" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-language"), { target: { value: "es" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-category"), { target: { value: "partner" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-vertical"), { target: { value: "care" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-market"), { target: { value: "Madrid" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-contact-tags"), { target: { value: "partner, priority" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-contact-channel-availability"), {
      target: { value: JSON.stringify({ email: true, linkedin: true, whatsapp: false, source: "lovable" }, null, 2) },
    });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-contact-metadata"), {
      target: { value: JSON.stringify({ lovable: { persona: "partner-lead" }, segmentation: { lifecycle: "lead" }, notes: "edited" }, null, 2) },
    });
    fireEvent.click(screen.getByTestId("button-marketing-save-contact"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/contacts/contact-2", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/contacts/contact-2" && init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      fullName: "Updated Partner",
      audienceType: "both",
      profileId: "profile-2",
      organizationId: "11111111-1111-4111-8111-111111111111",
      email: "updated@example.com",
      phoneNumber: "+34 600 000 004",
      whatsappNumber: "+34 600 000 005",
      roleLabel: "Growth lead",
      companyName: "Updated Org",
      language: "es",
      category: "partner",
      vertical: "care",
      market: "Madrid",
      consentStatus: "opted_in",
      source: "lovable",
      lovableExternalId: "lovable-contact-2",
      tags: ["partner", "priority"],
      channelAvailability: {
        email: true,
        phone: true,
        whatsapp: true,
        linkedin: true,
        source: "lovable",
      },
      metadata: {
        lovable: { persona: "partner-lead" },
        segmentation: {
          lifecycle: "lead",
          language: "es",
          category: "partner",
          vertical: "care",
          market: "Madrid",
        },
        notes: "edited",
      },
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-contact-editor-feedback")).toHaveTextContent("Contact updated.");
    });

    fireEvent.click(screen.getByTestId("button-marketing-delete-editing-contact"));
    expect(screen.getByTestId("button-marketing-delete-editing-contact")).toHaveTextContent("Confirm delete");
    fireEvent.click(screen.getByTestId("button-marketing-delete-editing-contact"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/contacts/contact-2", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("edits and deletes imported marketing audiences", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));

    fireEvent.click(screen.getByTestId("button-marketing-delete-audience-audience-1"));
    expect(screen.getByTestId("button-marketing-delete-audience-audience-1")).toHaveTextContent("Confirm delete");
    expect(screen.getByTestId("marketing-audience-delete-confirmation-audience-1")).toHaveTextContent("Click Confirm delete to remove this list and membership rows.");
    fireEvent.click(screen.getByTestId("button-marketing-delete-audience-audience-1"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/audiences/audience-1", expect.objectContaining({ method: "DELETE" }));
    });
    expect(screen.getByTestId("marketing-audience-feedback")).toHaveTextContent("Audience deleted.");

    fireEvent.click(screen.getByTestId("button-marketing-edit-audience-audience-1"));

    expect(screen.getByTestId("marketing-audience-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-audience-name")).toHaveValue("Partners");
    expect(screen.getByTestId("textarea-marketing-edit-audience-contact-ids")).toHaveValue("lovable-contact-2\nmissing-contact");
    expect(screen.getByTestId("marketing-edit-audience-member-picker")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-edit-audience-member-picker")).toHaveTextContent("1 imported member ID");
    fireEvent.click(screen.getByTestId("button-marketing-remove-audience-member-contact-2"));
    expect(screen.getByTestId("textarea-marketing-edit-audience-contact-ids")).toHaveValue("missing-contact");
    fireEvent.change(screen.getByTestId("select-marketing-edit-audience-add-contact"), { target: { value: "contact-2" } });
    expect(screen.getByTestId("textarea-marketing-edit-audience-contact-ids")).toHaveValue("missing-contact\nlovable-contact-2");
    expect(screen.getByTestId("input-marketing-edit-audience-source")).toHaveValue("lovable");
    expect(screen.getByTestId("input-marketing-edit-audience-lovable-id")).toHaveValue("lovable-audience-1");
    expect(screen.getByTestId("textarea-marketing-edit-audience-metadata")).toHaveValue(JSON.stringify({ lovable: { sourceList: "Partners" } }, null, 2));

    fireEvent.change(screen.getByTestId("input-marketing-edit-audience-name"), { target: { value: "Updated partners" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-audience-type"), { target: { value: "static" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-audience-description"), { target: { value: "Updated partner list" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-audience-rules"), { target: { value: "{\"market\":\"Madrid\",\"vertical\":\"care\"}" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-audience-contact-ids"), { target: { value: "lovable-contact-2\nnew-unmapped-contact" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-audience-metadata"), { target: { value: "{\"lovable\":{\"sourceList\":\"Partners\"},\"review\":\"done\"}" } });
    fireEvent.click(screen.getByTestId("button-marketing-save-audience"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/audiences/audience-1", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/audiences/audience-1" && init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      name: "Updated partners",
      listType: "static",
      description: "Updated partner list",
      rules: { market: "Madrid", vertical: "care" },
      contactExternalIds: ["lovable-contact-2", "new-unmapped-contact"],
      source: "lovable",
      lovableExternalId: "lovable-audience-1",
      metadata: { lovable: { sourceList: "Partners" }, review: "done" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-audience-editor-feedback")).toHaveTextContent("Audience updated.");
    });

    fireEvent.click(screen.getByTestId("button-marketing-delete-editing-audience"));
    expect(screen.getByTestId("button-marketing-delete-editing-audience")).toHaveTextContent("Confirm delete");
    fireEvent.click(screen.getByTestId("button-marketing-delete-editing-audience"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/audiences/audience-1", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("creates a blank journey draft and keeps the editor open", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    fireEvent.click(screen.getByTestId("button-marketing-new-journey"));

    expect(screen.getByTestId("marketing-journey-editor-form")).toBeInTheDocument();
    expect(screen.queryByText("First channel")).not.toBeInTheDocument();
    expect(screen.getByTestId("select-marketing-edit-journey-target-audience")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-journey-target-audience-summary")).toHaveTextContent("No target list selected");
    expect(screen.getByTestId("button-marketing-add-first-journey-step")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-save-journey"));
    expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Journey name is required");

    fireEvent.change(screen.getByTestId("input-marketing-edit-journey-name"), { target: { value: "New onboarding" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-journey-objective"), { target: { value: "Create a useful draft first" } });
    fireEvent.click(screen.getByTestId("button-marketing-save-journey"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys", expect.objectContaining({ method: "POST" }));
    });
    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/journeys" && init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      name: "New onboarding",
      status: "draft",
      audienceType: "b2c",
      objective: "Create a useful draft first",
      steps: [],
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Created.");
    });
    expect(screen.getByTestId("marketing-journeys-tab")).toHaveTextContent("New onboarding");
    expect(screen.getByTestId("button-marketing-save-journey")).toHaveTextContent("Save journey");
  });

  it("edits journey logic, steps, ordering, and deletes journey records", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-journey-journey-1"));

    expect(screen.getByTestId("marketing-journey-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("select-marketing-edit-journey-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("marketing-journey-target-audience-summary")).toHaveTextContent("Partners: 1 mapped of 2 members");
    expect(screen.getByTestId("input-marketing-edit-journey-source")).toHaveValue("lovable");
    expect(screen.getByTestId("input-marketing-edit-journey-lovable-id")).toHaveValue("lovable-journey-1");
    expect(screen.getByTestId("textarea-marketing-edit-journey-metadata")).toHaveValue(JSON.stringify({ lovable: { triggerWindow: "morning" } }, null, 2));
    const journeyStepPreview = screen.getByTestId("marketing-journey-step-content-preview-0");
    expect(journeyStepPreview).toHaveTextContent("Linked content");
    expect(journeyStepPreview).toHaveTextContent("Welcome email");
    expect(journeyStepPreview).toHaveTextContent("Welcome to VYVA");
    expect(journeyStepPreview).toHaveTextContent("Hello");
    expect(screen.getByTestId("marketing-journey-step-content-preview-0-preview")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-journey-step-content-preview-0-edit")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("input-marketing-edit-journey-name"), { target: { value: "Updated nurture" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-journey-objective"), { target: { value: "Updated objective" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-journey-audience"), { target: { value: "both" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-journey-status"), { target: { value: "paused" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-journey-trigger"), { target: { value: "list_joined" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-journey-target-audience"), { target: { value: "audience-1" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-journey-trigger-config"), { target: { value: "{\"list\":\"partners\"}" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-journey-goal"), { target: { value: "reply" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-journey-goal-config"), { target: { value: "{\"withinDays\":14}" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-journey-metadata"), { target: { value: "{\"lovable\":{\"triggerWindow\":\"morning\"},\"review\":\"done\"}" } });
    fireEvent.click(screen.getByTestId("checkbox-marketing-edit-journey-exit-on-goal"));

    fireEvent.click(screen.getByTestId("button-marketing-add-journey-step"));
    fireEvent.click(screen.getByTestId("button-marketing-remove-journey-step-0"));
    fireEvent.change(screen.getByTestId("input-marketing-journey-step-delay-0"), { target: { value: "48" } });
    fireEvent.change(screen.getByTestId("select-marketing-journey-step-channel-0"), { target: { value: "whatsapp" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-journey-step-notes-0"), { target: { value: "Check WhatsApp reply window" } });

    fireEvent.click(screen.getByTestId("button-marketing-add-journey-step"));
    fireEvent.change(screen.getByTestId("select-marketing-journey-step-channel-1"), { target: { value: "email" } });
    fireEvent.change(screen.getByTestId("select-marketing-journey-step-content-1"), { target: { value: "content-1" } });
    fireEvent.change(screen.getByTestId("input-marketing-journey-step-template-kind-1"), { target: { value: "email_template" } });
    fireEvent.change(screen.getByTestId("input-marketing-journey-step-template-ref-1"), { target: { value: "welcome-template" } });
    fireEvent.click(screen.getByTestId("button-marketing-move-journey-step-up-1"));

    fireEvent.click(screen.getByTestId("button-marketing-save-journey"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys/journey-1", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/journeys/journey-1" && init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      name: "Updated nurture",
      objective: "Updated objective",
      audienceType: "both",
      status: "paused",
      triggerType: "list_joined",
      triggerConfig: {
        list: "partners",
        targetAudienceId: "audience-1",
        audienceExternalId: "lovable-audience-1",
        audienceList: {
          name: "Partners",
          source: "lovable",
          lovableExternalId: "lovable-audience-1",
        },
      },
      goalType: "reply",
      goalConfig: { withinDays: 14 },
      exitOnGoal: true,
      source: "lovable",
      lovableExternalId: "lovable-journey-1",
      metadata: { lovable: { triggerWindow: "morning" }, review: "done" },
    });
    expect(JSON.parse(String(patchCall?.[1]?.body)).steps).toMatchObject([
      {
        stepOrder: 0,
        channel: "email",
        contentAssetId: "content-1",
        templateKind: "email_template",
        templateRef: "welcome-template",
      },
      {
        stepOrder: 1,
        channel: "whatsapp",
        delayHours: 48,
        dayOffset: 2,
        metadata: { notes: "Check WhatsApp reply window" },
      },
    ]);
    await waitFor(() => {
      expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Updated.");
    });

    fireEvent.click(screen.getByTestId("button-marketing-delete-journey-journey-1"));
    expect(screen.getByTestId("button-marketing-delete-journey-journey-1")).toHaveTextContent("Confirm delete");
    expect(screen.getByTestId("marketing-journey-delete-confirmation-journey-1")).toHaveTextContent("Click Confirm delete to remove this journey and its steps.");
    fireEvent.click(screen.getByTestId("button-marketing-delete-journey-journey-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys/journey-1", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("generates a smart campaign brief into the planner and content draft", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
    renderPage();

    expect(await screen.findByTestId("marketing-campaign-studio")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-studio-categories")).toHaveTextContent("All plays");
    expect(screen.getByTestId("marketing-campaign-studio-categories")).toHaveTextContent("22");
    expect(screen.getByTestId("marketing-campaign-studio-playbook-recommendations")).toHaveTextContent("Best next campaigns from your data");
    expect(screen.getByTestId("marketing-campaign-studio-playbook-recommendations")).toHaveTextContent("Event reminder");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-playbook-event-reminder"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Playbook loaded: Event reminder");
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-category-social"));
    expect(screen.getByTestId("marketing-campaign-studio-category-hint")).toHaveTextContent("Facebook, Instagram, LinkedIn, and TikTok");
    expect(screen.getByTestId("button-marketing-campaign-studio-play-instagram-proof-point")).toBeInTheDocument();
    expect(screen.queryByTestId("button-marketing-campaign-studio-play-b2b-partner-outreach")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-category-all"));
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-play-b2b-partner-outreach"));
    fireEvent.change(screen.getByTestId("select-marketing-campaign-studio-tone"), { target: { value: "direct" } });
    expect(screen.getByTestId("marketing-campaign-studio-smart-schedule")).toHaveTextContent("Pick a practical publish window");
    expect(screen.getByTestId("marketing-campaign-studio-smart-schedule")).toHaveTextContent("Partner morning");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-schedule-relationship"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Schedule set: Follow-up afternoon");
    expect(screen.getByTestId("button-marketing-campaign-studio-schedule-relationship")).toHaveTextContent("Selected");

    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("B2B partner introduction");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-studio-angles")).toHaveTextContent("Choose how the campaign leads");
    expect(screen.getByTestId("marketing-campaign-studio-angles")).toHaveTextContent("Proof-led");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-angle-proof"));
    expect(screen.getByTestId("button-marketing-campaign-studio-angle-proof")).toHaveTextContent("Selected");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("Partner outreach: proof point");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("Proof-led");
    expect(screen.getByTestId("marketing-campaign-studio-audience-intel")).toHaveTextContent("Reach and fit");
    expect(screen.getByTestId("marketing-campaign-studio-audience-intel-reach")).toHaveTextContent("1/1");
    expect(screen.getByTestId("marketing-campaign-studio-audience-intel-best-channel")).toHaveTextContent("LinkedIn 1");
    expect(screen.getByTestId("marketing-campaign-studio-audience-intel-consent")).toHaveTextContent("1 pending/unknown and 0 opted out");
    expect(screen.getByTestId("marketing-campaign-studio-audience-intel-localization")).toHaveTextContent("Spain 1");
    expect(screen.getByTestId("marketing-campaign-studio-audience-recommendation")).toHaveTextContent("Review 1 unmapped list member from Partners");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-sample")).toHaveTextContent("Reachable contact sample");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-sample")).toHaveTextContent("1/1 shown");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-sample-contact-2")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-sample-contact-2")).toHaveTextContent("Moka Digital / Partner / Spain");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-sample-contact-2")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-launch-brief")).toHaveTextContent("Campaign plan at a glance");
    expect(screen.getByTestId("marketing-campaign-studio-launch-brief-play")).toHaveTextContent("B2B partner introduction");
    expect(screen.getByTestId("marketing-campaign-studio-launch-brief-hook")).toHaveTextContent("Partner outreach: proof point");
    expect(screen.getByTestId("marketing-campaign-studio-launch-brief-audience")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-studio-launch-brief-channels")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-creative-variants")).toHaveTextContent("Smart creative variants");
    expect(screen.getByTestId("marketing-campaign-studio-creative-variant-proof-led")).toHaveTextContent("Proof-led");
    expect(screen.getByTestId("button-marketing-campaign-studio-variant-soft-invite")).toHaveTextContent("I want the details");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-variant-soft-invite"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Creative variant applied: Soft invite.");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("A gentle invite:");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("CTA: I want the details");
    expect(screen.getByTestId("marketing-campaign-studio-creative-quality")).toHaveTextContent("Copy checks before create");
    expect(screen.getByTestId("marketing-campaign-studio-creative-quality-subject")).toHaveTextContent("Opening hook");
    expect(screen.getByTestId("marketing-campaign-studio-creative-quality-cta")).toHaveTextContent("Ready");
    expect(screen.getByTestId("marketing-campaign-studio-creative-quality-channel-fit")).toHaveTextContent("LinkedIn has one focused draft ready for review.");
    expect(screen.getByTestId("marketing-campaign-studio-personalization-preview")).toHaveTextContent("Merge field preview");
    expect(screen.getByTestId("marketing-campaign-studio-personalization-tokens")).toHaveTextContent("{{first_name}} 1/1");
    expect(screen.getByTestId("marketing-campaign-studio-personalization-sample")).toHaveTextContent("Sample for Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-studio-personalization-sample")).toHaveTextContent("Hi Hassan,");
    expect(screen.getByTestId("marketing-campaign-studio-readiness")).toHaveTextContent("Studio readiness");
    expect(screen.getByTestId("marketing-campaign-studio-readiness-recipients")).toHaveTextContent("1 eligible recipient will be snapshotted.");
    expect(screen.getByTestId("marketing-campaign-studio-readiness-channel")).toHaveTextContent("Planning");
    expect(screen.getByTestId("marketing-campaign-studio-next-step")).toHaveTextContent("Improve with AI");
    expect(screen.getByTestId("marketing-campaign-studio-launch-sequence")).toHaveTextContent("Launch sequence");
    expect(screen.getByTestId("marketing-campaign-studio-launch-sequence")).toHaveTextContent("Next best actions");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-audience")).toHaveTextContent("Audience list selected");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-copy")).toHaveTextContent("Improve with AI");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-create")).toHaveTextContent("Create now");
    expect(screen.getByTestId("marketing-campaign-studio-offline-kit")).toHaveTextContent("Offline and human handoff");
    expect(screen.getByTestId("marketing-campaign-studio-offline-kit")).toHaveTextContent("Phone call script");
    expect(screen.getByTestId("marketing-campaign-studio-offline-kit")).toHaveTextContent("Flyer / poster brief");
    const phoneScript = screen.getByTestId("textarea-marketing-campaign-studio-offline-phone") as HTMLTextAreaElement;
    expect(phoneScript.value).toContain("Sample contact: Hassan Partner");
    expect(phoneScript.value).toContain("Opening: Hi Hassan");
    expect(phoneScript.value).toContain("Key message:");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-offline-phone"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Phone call script"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Phone call script copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-offline-kit"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Partner handoff note"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Offline handoff kit copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-launch-copy"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/ai/campaign-draft", expect.objectContaining({ method: "POST" }));
    });
    const aiDraftCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(JSON.parse(String(aiDraftCall?.[1]?.body ?? "{}"))).toMatchObject({
      angle: "proof",
      angleGuidance: expect.stringContaining("Lead with proof"),
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("AI draft generated");
    });
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("Partner outreach AI campaign");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("AI draft");
    expect(screen.getByTestId("marketing-campaign-studio-creative-quality-channel-fit")).toHaveTextContent("AI adapted all 1 selected channel draft.");
    expect(screen.getByTestId("marketing-campaign-studio-launch-brief-creative")).toHaveTextContent("AI-polished pack");
    expect(screen.getByTestId("marketing-campaign-studio-readiness-ai")).toHaveTextContent("Ready");
    expect(screen.getByTestId("marketing-campaign-studio-next-step")).toHaveTextContent("Create the LinkedIn planning campaign");
    fireEvent.click(screen.getByTestId("button-marketing-apply-studio-draft"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Partner outreach AI campaign");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-1");
    expect((screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement).value).toContain("AI objective for Partners");
    expect(screen.getByTestId("marketing-campaign-draft-recipient-preview")).toHaveTextContent("1");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Draft applied");

    fireEvent.click(screen.getByTestId("button-marketing-open-studio-content-draft"));
    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Partner outreach AI content");
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("linkedin");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("AI body copy");
    expect((screen.getByTestId("textarea-marketing-content-design-json") as HTMLTextAreaElement).value).toContain("\"angle\": \"proof\"");
  });

  it("creates linked campaign and content directly from the smart studio", async () => {
    renderPage();

    expect(await screen.findByTestId("marketing-campaign-studio")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-play-b2b-partner-outreach"));
    fireEvent.change(screen.getByTestId("select-marketing-campaign-studio-tone"), { target: { value: "direct" } });
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack")).toHaveTextContent("Plan once, adapt by channel");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-recommended-pack"));
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-execution-plan")).toHaveTextContent("What happens after create");
    expect(screen.getByTestId("marketing-campaign-studio-execution-plan-linkedin")).toHaveTextContent("Manual publishing");
    expect(screen.getByTestId("marketing-campaign-studio-execution-plan-linkedin")).toHaveTextContent("publish or track it outside VYVA");
    expect(screen.getByTestId("marketing-campaign-studio-execution-plan-email")).toHaveTextContent("VYVA email send");
    expect(screen.getByTestId("marketing-campaign-studio-execution-plan-email")).toHaveTextContent("send from the campaign details");
    expect(screen.getByTestId("marketing-campaign-studio-creative-quality-channel-fit")).toHaveTextContent("0/2 selected channels have AI-polished copy.");
    expect(screen.getByTestId("marketing-campaign-studio-launch-sequence")).toHaveTextContent("Create 2 content assets");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-review")).toHaveTextContent("Review before email send");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-launch-copy"));

    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("AI drafts generated for 2 channels");
    });
    const aiDraftCalls = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(aiDraftCalls.map(([, init]) => JSON.parse(String(init?.body ?? "{}")).channel)).toEqual(["linkedin", "email"]);
    expect(aiDraftCalls.map(([, init]) => JSON.parse(String(init?.body ?? "{}")).angle)).toEqual(["balanced", "balanced"]);
    expect(screen.getByTestId("marketing-campaign-studio-creative-quality-channel-fit")).toHaveTextContent("AI adapted all 2 selected channel drafts.");
    expect(screen.getByTestId("marketing-campaign-studio-readiness-ai")).toHaveTextContent("Ready");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-copy")).toHaveTextContent("Refresh AI");
    expect(screen.getByTestId("marketing-campaign-studio-channel-copy-email")).toHaveTextContent("Partner outreach email AI content");
    expect(screen.getByTestId("marketing-campaign-studio-channel-copy-email")).toHaveTextContent("VYVA email send");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-focus-channel-email"));
    expect(screen.getByTestId("marketing-campaign-studio-channel-copy-email")).toHaveTextContent("Focused");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("Partner outreach AI campaign");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("AI email subject line");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-use-channel-email"));
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Partner outreach AI campaign");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Email draft applied to the planner and content draft.");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Partner outreach email AI content");
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("email");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("AI email body copy");
    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-focus-channel-linkedin"));
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("Partner outreach AI campaign");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-launch-create"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns", expect.objectContaining({ method: "POST" }));
    });

    const contentPosts = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    expect(contentPosts).toHaveLength(2);
    const contentPost = contentPosts.find(([, init]) => JSON.parse(String(init?.body ?? "{}")).channel === "linkedin");
    const contentBody = JSON.parse(String(contentPost?.[1]?.body));
    expect(contentBody).toMatchObject({
      title: "Partner outreach AI content",
      channel: "linkedin",
      language: "en",
      status: "draft",
      subject: "AI subject line",
      body: "AI body copy with stronger channel direction.",
      ctaLabel: "AI CTA",
      ctaUrl: "https://v2.vyva.life/ai",
      designJson: {
        generator: "marketing_campaign_studio",
        playId: "b2b-partner-outreach",
        source: "openai",
        angle: "balanced",
      },
    });
    const emailContentBody = JSON.parse(String(contentPosts.find(([, init]) => JSON.parse(String(init?.body ?? "{}")).channel === "email")?.[1]?.body));
    expect(emailContentBody).toMatchObject({
      channel: "email",
      title: "Partner outreach email AI content",
      subject: "AI email subject line",
      body: "AI email body copy with stronger channel direction.",
      designJson: {
        generator: "marketing_campaign_studio",
        source: "openai",
        angle: "balanced",
        channel: "email",
        primaryChannel: "linkedin",
      },
    });

    const campaignPost = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/campaigns" && init?.method === "POST");
    const campaignBody = JSON.parse(String(campaignPost?.[1]?.body));
    expect(campaignBody).toMatchObject({
      name: "Partner outreach AI campaign",
      audienceType: "b2b",
      status: "scheduled",
      objective: "AI objective for Partners",
      channels: [
        { channel: "linkedin", contentAssetId: "content-created", status: "scheduled", sendCapability: "planning_only" },
        { channel: "email", contentAssetId: "content-created", status: "scheduled", sendCapability: "enabled" },
      ],
      recipients: [{
        contactId: "contact-2",
        channel: "linkedin",
        recipient: "hassan@example.com",
        status: "planned",
      }, {
        contactId: "contact-2",
        channel: "email",
        recipient: "hassan@example.com",
        status: "planned",
      }],
      metadata: {
        generatedContentAssetId: "content-created",
        generatedContentAssetIds: {
          linkedin: "content-created",
          email: "content-created",
        },
        studio: {
          playId: "b2b-partner-outreach",
          angle: "balanced",
          generatedSource: "openai",
          selectedChannels: ["linkedin", "email"],
        },
        targetAudience: {
          name: "Partners",
          lovableExternalId: "lovable-audience-1",
        },
      },
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent('Created "Partner outreach AI campaign" across 2 channels with 2 recipient snapshots ready.');
    });
    expect(screen.getByTestId("marketing-campaign-edit-form")).toHaveTextContent("Partner outreach AI campaign");
  });

  it("creates campaign metadata without auto-dispatching", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "New draft" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-audience"), { target: { value: "b2b" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-content"), { target: { value: "content-1" } });
    fireEvent.change(screen.getByTestId("input-marketing-campaign-schedule"), { target: { value: "2026-07-08T10:30" } });
    fireEvent.change(screen.getByTestId("input-marketing-campaign-schedule-end"), { target: { value: "2026-07-08T12:00" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-target-audience"), { target: { value: "audience-1" } });
    expect(screen.getByTestId("marketing-campaign-draft-target-audience-summary")).toHaveTextContent("1 mapped");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-recipient-filter"), { target: { value: "Hassan" } });
    fireEvent.click(screen.getByTestId("checkbox-marketing-campaign-snapshot"));
    expect(screen.getByTestId("marketing-campaign-draft-recipient-preview")).toHaveTextContent("1");
    fireEvent.click(screen.getByTestId("button-marketing-create-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns", expect.objectContaining({ method: "POST" }));
    });
    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/campaigns" && init?.method === "POST");
    const postBody = JSON.parse(String(postCall?.[1]?.body));
    expect(postBody).toMatchObject({
      name: "New draft",
      audienceType: "b2b",
      status: "scheduled",
      scheduleStartsAt: new Date("2026-07-08T10:30").toISOString(),
      scheduleEndsAt: new Date("2026-07-08T12:00").toISOString(),
      channels: [{ channel: "email", contentAssetId: "content-1" }],
      metadata: {
        targetAudience: {
          name: "Partners",
          lovableExternalId: "lovable-audience-1",
        },
      },
      recipients: [{
        contactId: "contact-2",
        recipient: "hassan@example.com",
        scheduledAt: new Date("2026-07-08T10:30").toISOString(),
        snapshot: {
          fullName: "Hassan Partner",
          audienceList: {
            name: "Partners",
            lovableExternalId: "lovable-audience-1",
          },
        },
      }],
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1/send-email", expect.anything());
  });

  it("runs due scheduled email campaigns from the calendar tab", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    fireEvent.click(screen.getByTestId("button-marketing-run-due-email"));
    expect(screen.getByTestId("button-marketing-run-due-email")).toHaveTextContent("Confirm run due emails");
    fireEvent.click(screen.getByTestId("button-marketing-run-due-email"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/send-due-email", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-due-email-feedback")).toHaveTextContent("1 sent");
    });
  });

  it("opens contacts from imported campaign recipient snapshots", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));
    expect(screen.getByTestId("marketing-campaign-recipient-contact-recipient-1")).toHaveTextContent("Hassan Partner");

    fireEvent.click(screen.getByTestId("button-marketing-open-recipient-contact-recipient-1"));

    expect(screen.getByTestId("button-marketing-contacts-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("marketing-contact-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-contact-editor-feedback")).toHaveTextContent('Editing "Hassan Partner".');
    expect(screen.getByTestId("input-marketing-edit-contact-lovable-id")).toHaveValue("lovable-contact-2");
  });

  it("edits, snapshots recipients for, sends email campaigns, and deletes campaigns", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));

    expect(screen.getByTestId("marketing-campaign-edit-form")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("input-marketing-edit-campaign-source")).toHaveValue("lovable");
    expect(screen.getByTestId("input-marketing-edit-campaign-lovable-id")).toHaveValue("lovable-campaign-1");
    expect(screen.getByTestId("textarea-marketing-edit-campaign-metadata")).toHaveValue(JSON.stringify({ extraCampaignField: "from-lovable", lovable: { originalStatus: "queued" }, targetAudience: { lovableExternalId: "lovable-audience-1" } }, null, 2));
    expect(screen.getByTestId("input-marketing-edit-campaign-schedule-end")).toHaveValue(toLocalInput("2026-07-06T11:00:00.000Z"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Ends");
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("1");
    expect(screen.getByTestId("marketing-campaign-readiness-panel")).toHaveTextContent("Campaign readiness");
    expect(screen.getByTestId("marketing-campaign-readiness-panel")).toHaveTextContent("5/6 ready");
    expect(screen.getByTestId("marketing-campaign-readiness-content")).toHaveTextContent("Ready");
    expect(screen.getByTestId("marketing-campaign-readiness-recipients")).toHaveTextContent("1 saved recipient");
    expect(screen.getByTestId("marketing-campaign-readiness-email")).toHaveTextContent("Email can use the existing VYVA dispatcher");
    expect(screen.getByTestId("marketing-campaign-readiness-other-channels")).toHaveTextContent("Planning");
    expect(screen.getByTestId("marketing-campaign-launch-sequence")).toHaveTextContent("Next steps for this campaign");
    expect(screen.getByTestId("marketing-campaign-launch-step-content")).toHaveTextContent("Preview content");
    expect(screen.getByTestId("marketing-campaign-launch-step-audience")).toHaveTextContent("Partners: 1/2 contacts mapped");
    expect(screen.getByTestId("marketing-campaign-launch-step-recipients")).toHaveTextContent("1 saved recipient");
    expect(screen.getByTestId("marketing-campaign-launch-step-test")).toHaveTextContent("Send test email");
    expect(screen.getByTestId("marketing-campaign-launch-step-launch")).toHaveTextContent("Send campaign email");
    expect(screen.getByTestId("marketing-campaign-publish-kit")).toHaveTextContent("Channel handoff plan");
    expect(screen.getByTestId("marketing-campaign-publish-kit-email")).toHaveTextContent("VYVA email send");
    expect(screen.getByTestId("marketing-campaign-publish-kit-email")).toHaveTextContent("1 saved recipient can be sent through VYVA email");
    expect(screen.getByTestId("marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Manual publishing");
    expect(screen.getByTestId("marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Preview the content, then publish or track it in the channel tool.");
    fireEvent.click(screen.getByTestId("button-marketing-copy-launch-packet"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign launch packet"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Campaign: Caregiver welcome"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Email channel"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn channel"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Campaign launch packet copied.");
    expect(screen.getByTestId("marketing-campaign-handoff-brief-linkedin")).toHaveTextContent("Manual channel brief");
    const linkedinHandoffBrief = screen.getByTestId("textarea-marketing-campaign-handoff-brief-linkedin") as HTMLTextAreaElement;
    expect(linkedinHandoffBrief.value).toContain("Campaign: Caregiver welcome");
    expect(linkedinHandoffBrief.value).toContain("Channel: LinkedIn");
    expect(linkedinHandoffBrief.value).toContain("Copy:\nPartner update");
    expect(linkedinHandoffBrief.value).toContain("CTA: Read more - https://v2.vyva.life/partners");
    expect(linkedinHandoffBrief.value).toContain("Media:\n- https://cdn.example.test/partner.png");
    expect(linkedinHandoffBrief.value).toContain("Lovable content ID: lovable-content-2");
    fireEvent.click(screen.getByTestId("button-marketing-copy-handoff-brief-linkedin"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Channel: LinkedIn"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Copy:\nPartner update"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("LinkedIn handoff brief copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-publish-kit-linkedin"));
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Partner post");
    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));
    expect(screen.getByTestId("marketing-campaign-performance-panel")).toHaveTextContent("66 sent");
    expect(openMetadataPanel("marketing-campaign-metric-metadata-metric-1")).toHaveTextContent("metric-provider-1");
    expect(screen.getByTestId("marketing-campaign-performance-panel")).toHaveTextContent("44");
    expect(screen.getByTestId("marketing-campaign-performance-panel")).toHaveTextContent("4");
    expect(screen.getByTestId("marketing-campaign-channels-editor")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("select-marketing-campaign-channel-content-1")).toHaveValue("content-2");
    const emailContentPreview = screen.getByTestId("marketing-campaign-channel-content-preview-0");
    expect(emailContentPreview).toHaveTextContent("Linked content");
    expect(emailContentPreview).toHaveTextContent("Welcome email");
    expect(emailContentPreview).toHaveTextContent("Welcome to VYVA");
    expect(emailContentPreview).toHaveTextContent("Hello");
    const socialContentPreview = screen.getByTestId("marketing-campaign-channel-content-preview-1");
    expect(socialContentPreview).toHaveTextContent("Partner post");
    expect(socialContentPreview).toHaveTextContent("Partner update");
    expect(socialContentPreview).toHaveTextContent("CTA: Read more -> https://v2.vyva.life/partners");
    expect(socialContentPreview).toHaveTextContent("Social post");
    expect(socialContentPreview).toHaveTextContent("Lovable ID: lovable-content-2");
    expect(within(socialContentPreview).getByAltText("Partner post")).toHaveAttribute("src", "https://cdn.example.test/partner.png");
    expect(screen.getByTestId("marketing-campaign-channel-content-preview-1-preview")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-channel-content-preview-0-edit")).toBeInTheDocument();
    expect(screen.getByTestId("select-marketing-edit-campaign-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("marketing-campaign-target-audience-summary")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-recipient-contact-recipient-1")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-recipient-contact-recipient-1")).toHaveTextContent("hassan@example.com");
    expect(screen.getByTestId("marketing-campaign-recipient-contact-recipient-1")).toHaveTextContent("Moka Digital");
    expect(screen.getByTestId("button-marketing-open-recipient-contact-recipient-1")).toBeInTheDocument();
    expect(openMetadataPanel("marketing-campaign-recipient-snapshot-recipient-1")).toHaveTextContent("recipient-export");
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-name"), { target: { value: "Updated campaign" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-objective"), { target: { value: "Updated objective" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-timezone"), { target: { value: "Europe/London" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-schedule-end"), { target: { value: "2026-07-09T12:30" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-campaign-audience"), { target: { value: "both" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-campaign-channel"), { target: { value: "email" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-campaign-status"), { target: { value: "scheduled" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-campaign-metadata"), {
      target: { value: JSON.stringify({ extraCampaignField: "from-lovable", lovable: { originalStatus: "queued" }, importNote: "reviewed" }, null, 2) },
    });
    fireEvent.click(screen.getByTestId("checkbox-marketing-edit-campaign-snapshot"));
    fireEvent.change(screen.getByTestId("select-marketing-edit-campaign-target-audience"), { target: { value: "audience-1" } });
    expect(screen.getByTestId("marketing-campaign-target-audience-summary")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-target-audience-summary")).toHaveTextContent("1 mapped");
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-recipient-filter"), { target: { value: "Hassan" } });

    expect(screen.getByTestId("marketing-campaign-recipient-preview")).toHaveTextContent("1");
    expect(screen.getByTestId("button-marketing-readiness-save-campaign")).toHaveTextContent("Save + snapshot recipients");
    expect(screen.getByTestId("marketing-campaign-readiness-email")).toHaveTextContent("Save campaign changes before test/live email send.");
    expect(screen.getByTestId("marketing-campaign-launch-step-test")).toHaveTextContent("Save before test");
    expect(screen.getByTestId("marketing-campaign-launch-step-launch")).toHaveTextContent("Save campaign changes before sending.");
    fireEvent.click(screen.getByTestId("button-marketing-readiness-save-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/campaigns/campaign-1" && init?.method === "PATCH");
    const patchBody = JSON.parse(String(patchCall?.[1]?.body));
    expect(patchBody).toMatchObject({
      name: "Updated campaign",
      objective: "Updated objective",
      audienceType: "both",
      status: "scheduled",
      scheduleEndsAt: new Date("2026-07-09T12:30").toISOString(),
      timezone: "Europe/London",
      source: "lovable",
      lovableExternalId: "lovable-campaign-1",
      metadata: {
        extraCampaignField: "from-lovable",
        lovable: { originalStatus: "queued" },
        importNote: "reviewed",
        targetAudience: {
          name: "Partners",
          lovableExternalId: "lovable-audience-1",
        },
      },
      channels: [
        { channel: "email", contentAssetId: "content-1", status: "scheduled" },
        { channel: "linkedin", contentAssetId: "content-2", status: "draft" },
      ],
    });
    expect(patchBody.recipients).toHaveLength(1);
    expect(patchBody.recipients[0]).toMatchObject({
      contactId: "contact-2",
      channel: "email",
      recipient: "hassan@example.com",
      status: "planned",
      snapshot: {
        fullName: "Hassan Partner",
        audienceList: {
          name: "Partners",
          source: "lovable",
          lovableExternalId: "lovable-audience-1",
        },
      },
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1/send-email", expect.anything());

    fireEvent.click(screen.getByTestId("button-marketing-edit-campaign-campaign-1"));
    expect(screen.getByTestId("select-marketing-edit-campaign-content")).toHaveValue("content-1");
    expect(screen.getByTestId("button-marketing-send-test-email")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-marketing-send-test-email"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1/test-email", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-test-email-feedback")).toHaveTextContent("Test email sent to karim.assad@mokadigital.net.");
    });

    expect(screen.getByTestId("button-marketing-send-campaign-email")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-marketing-send-campaign-email"));
    expect(screen.getByTestId("button-marketing-send-campaign-email")).toHaveTextContent("Confirm send emails");
    fireEvent.click(screen.getByTestId("button-marketing-send-campaign-email"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1/send-email", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("Campaign email sent to 1 recipient.");
    });

    fireEvent.click(screen.getByTestId("button-marketing-delete-campaign-campaign-1"));
    expect(screen.getByTestId("button-marketing-delete-campaign-campaign-1")).toHaveTextContent("Confirm delete");
    expect(screen.getByTestId("marketing-campaign-delete-confirmation-campaign-1")).toHaveTextContent("Click Confirm delete to remove this campaign, its channels, and recipient snapshots.");
    fireEvent.click(screen.getByTestId("button-marketing-delete-campaign-campaign-1"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("lets imported social campaigns use social content as the primary campaign asset", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-2"));

    expect(screen.getByTestId("select-marketing-edit-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-edit-campaign-content")).not.toBeDisabled();
    expect(screen.getByTestId("select-marketing-edit-campaign-content")).toHaveTextContent("Partner post");

    fireEvent.change(screen.getByTestId("select-marketing-edit-campaign-content"), { target: { value: "content-2" } });
    expect(screen.getByTestId("marketing-campaign-channel-content-preview-0")).toHaveTextContent("Partner post");

    fireEvent.click(screen.getByTestId("button-marketing-save-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-2", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/campaigns/campaign-2" && init?.method === "PATCH");
    const patchBody = JSON.parse(String(patchCall?.[1]?.body));
    expect(patchBody.channels).toEqual([
      expect.objectContaining({
        channel: "linkedin",
        contentAssetId: "content-2",
      }),
    ]);
  });
});
