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
    if (path === "/api/admin/marketing/sync/source" && method === "GET") return jsonResponse(syncResponse);
    if (path === "/api/admin/marketing/sync/source/preview" && method === "GET") return jsonResponse(exportPreview);
    if (path === "/api/admin/marketing/sync/source/run" && method === "POST") return jsonResponse({ ok: true, summary: { campaigns: 1, content: 1, contacts: 1, journeys: 1 } });
    if (path === "/api/admin/marketing/campaigns" && method === "POST") return jsonResponse({ ok: true, campaign: campaigns[0] }, { status: 201 });
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
  it("shows the marketing admin home link, tabs, and filters without the global admin carousel", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Marketing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin home" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("navigation", { name: "Admin sections" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("marketing-send-readiness-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Total campaigns");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Audiences");
    expect(screen.getByTestId("marketing-dashboard-tab")).not.toHaveTextContent("Imported media refs");
    expect(screen.queryByTestId("marketing-lovable-import-coverage")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Analytics");
    fireEvent.click(within(screen.getByTestId("marketing-analytics-panel")).getByText("Analytics"));
    expect(screen.getByTestId("marketing-analytics-table")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-analytics-table")).toHaveTextContent("Overflow metric 10");
    expect(openMetadataPanel("marketing-analytics-metadata-metric-1")).toHaveTextContent("metric-provider-1");
    fireEvent.click(screen.getByTestId("button-marketing-open-metric-campaign-metric-1"));
    expect(screen.getByTestId("input-marketing-edit-campaign-name")).toHaveValue("Caregiver welcome");
    expect(screen.getByText('Opened campaign "Caregiver welcome" from imported analytics.')).toBeInTheDocument();
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Caregiver welcome")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-target-list-campaign-1")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-performance-panel")).toHaveTextContent("44");
    expect(screen.getByTestId("marketing-campaign-channel-link-channel-1")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-channel-link-channel-1-linkedin")).toHaveTextContent("LinkedIn");

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
    expect(screen.getByTestId("marketing-content-tab")).not.toHaveTextContent("Lovable content coverage");
    expect(screen.queryByTestId("marketing-missing-content-reference-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-content-library-table")).not.toHaveTextContent("Missing Lovable reference");
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
    expect(screen.queryByTestId("marketing-content-usage-content-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-preview-content-content-2"));

    expect(screen.getByTestId("marketing-content-preview")).toHaveTextContent("Customer preview");
    expect(screen.getByTestId("marketing-content-preview")).toHaveTextContent("HTML template available");
    expect(screen.getByTestId("marketing-content-preview")).toHaveTextContent("Plain text copy");
    expect(screen.queryByTitle("Preview Partner post")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("marketing-content-customer-preview-show-html-preview"));
    expect(screen.getByTitle("Preview Partner post")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-content-customer-preview-design")).toHaveTextContent("Lovable design preview");
    expect(screen.getByTestId("marketing-content-customer-preview-design")).toHaveTextContent("Partner hero");
    expect(screen.getByTestId("marketing-content-customer-preview-design")).toHaveTextContent("Lovable builder copy");
    expect(screen.getByTestId("marketing-content-customer-preview-design")).toHaveTextContent("CTA: Book a demo -> https://v2.vyva.life/demo");
    expect(within(screen.getByTestId("marketing-content-customer-preview-design")).getByAltText("Partner hero")).toHaveAttribute("src", "https://cdn.example.test/partner-design.png");
    expect(screen.getByTestId("marketing-content-origin-summary")).toHaveTextContent("Imported from Social post");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("VYVA updated");
    expect(screen.getByTestId("marketing-selected-content-usage")).toHaveTextContent("Used in campaigns and journeys");
    expect(screen.getByTestId("marketing-selected-content-usage")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Design blocks: 1");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Design keys: blocks");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Media refs: 1");
    expect(screen.getByTestId("marketing-content-customer-preview")).toHaveTextContent("partner.png");
    expect(within(screen.getByTestId("marketing-content-preview-panel")).getByAltText("partner.png")).toHaveAttribute("src", "https://cdn.example.test/partner.png");
    expect(openMetadataPanel("marketing-content-metadata-panel")).toHaveTextContent("extraLovableOnlyField");
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("https://cdn.example.test/partner.png");
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("Lovable ID: media-1");
    expect(screen.getByTestId("marketing-media-timeline-media-1")).toHaveTextContent("Synced");
    expect(screen.getByAltText("Partner post")).toHaveAttribute("src", "https://cdn.example.test/partner.png");

    fireEvent.click(within(screen.getByTestId("marketing-selected-content-usage")).getByTestId("button-marketing-open-content-usage-campaign:campaign-1:channel-1-linkedin"));
    expect(screen.getByTestId("input-marketing-edit-campaign-name")).toHaveValue("Caregiver welcome");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    expect(screen.getByTestId("marketing-calendar-scheduler")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-calendar-scheduler")).toHaveTextContent("List: Partners");
    expect(screen.getByTestId("marketing-calendar-unscheduled")).toHaveTextContent("Partner outreach");

    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
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
    expect(screen.getByTestId("marketing-contacts-view-switcher")).toHaveTextContent("Contacts (2)");
    expect(screen.getByTestId("marketing-contacts-view-switcher")).toHaveTextContent("Lists (1)");
    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));
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

  it("paginates the campaigns list to keep the page short", async () => {
    const pagedCampaigns = Array.from({ length: 7 }, (_, index) => ({
      ...campaigns[index % campaigns.length],
      id: `paged-campaign-${index + 1}`,
      name: `Paged campaign ${index + 1}`,
      lovableExternalId: `campaign:paged-${index + 1}`,
    }));

    renderPage({}, { campaigns: pagedCampaigns });

    await screen.findByRole("heading", { name: "Marketing" });
    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));

    expect(screen.getByTestId("marketing-campaign-page-label")).toHaveTextContent("Page 1 / 2");
    expect(screen.getByTestId("marketing-campaign-table")).toHaveTextContent("Paged campaign 1");
    expect(screen.getByTestId("marketing-campaign-table")).not.toHaveTextContent("Paged campaign 6");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-next-page"));
    expect(screen.getByTestId("marketing-campaign-page-label")).toHaveTextContent("Page 2 / 2");
    expect(screen.getByTestId("marketing-campaign-table")).toHaveTextContent("Paged campaign 6");

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "Paged campaign 1" } });
    expect(screen.queryByTestId("marketing-campaign-pagination")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-table")).toHaveTextContent("Paged campaign 1");
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
    expect(screen.getByTestId("marketing-content-customer-preview-design")).toHaveTextContent("Design block 9");

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
    fireEvent.click(screen.getByTestId("button-marketing-preview-campaign-content-channel-1-linkedin"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Partner post".');
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Partner post");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-campaign-content-channel-1-linkedin"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Editing "Partner post".');
    expect(screen.getByTestId("marketing-content-editor-panel")).toHaveTextContent("Partner post");

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
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));
    fireEvent.click(screen.getByTestId("marketing-campaign-channel-content-preview-1-preview"));

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
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/sync/source/run", expect.objectContaining({ method: "POST" }));
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
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/sync/source/preview", undefined);
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
    expect(screen.getByTestId("marketing-content-inline-preview-content-2-design")).toHaveTextContent("Lovable design preview");
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
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));

    expect(screen.getByTestId("marketing-campaign-edit-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-campaign-name")).toHaveValue("Caregiver welcome");
    expect(screen.getByTestId("input-marketing-edit-campaign-source")).toHaveValue("lovable");
    expect(screen.getByTestId("input-marketing-edit-campaign-lovable-id")).toHaveValue("lovable-campaign-1");
    expect(screen.getByTestId("textarea-marketing-edit-campaign-metadata")).toHaveValue(JSON.stringify({ extraCampaignField: "from-lovable", lovable: { originalStatus: "queued" }, targetAudience: { lovableExternalId: "lovable-audience-1" } }, null, 2));
    expect(screen.getByTestId("input-marketing-edit-campaign-schedule-end")).toHaveValue(toLocalInput("2026-07-06T11:00:00.000Z"));
    expect(screen.getByText("1 recipients are currently snapshotted for this campaign.")).toBeInTheDocument();
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
    fireEvent.click(screen.getByTestId("button-marketing-save-campaign"));

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
    expect(screen.getByTestId("button-marketing-delete-campaign-campaign-1")).toHaveTextContent("Confirm");
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
