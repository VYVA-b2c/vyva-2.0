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
    { channel: "sms", campaigns: 0, content: 0 },
    { channel: "phone", campaigns: 0, content: 0 },
    { channel: "print", campaigns: 0, content: 0 },
    { channel: "event", campaigns: 0, content: 0 },
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
    { channel: "sms", sendCapability: "planning_only", locked: true, note: "Direct/offline planning only." },
    { channel: "phone", sendCapability: "planning_only", locked: true, note: "Direct/offline planning only." },
    { channel: "print", sendCapability: "planning_only", locked: true, note: "Direct/offline planning only." },
    { channel: "event", sendCapability: "planning_only", locked: true, note: "Direct/offline planning only." },
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
      config: {
        default_language: "en",
        translations: {
          en: {
            title: "Welcome email",
            subject: "Welcome to VYVA",
            body: "Hello from Source",
            ctaLabel: "Open VYVA",
            ctaUrl: "https://v2.vyva.life",
          },
          es: {
            title: "Correo de bienvenida",
            subject: "Bienvenido a VYVA",
            body: "Hola desde Source",
          },
        },
      },
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
        body: "Source builder copy",
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
      extraSourceOnlyField: "kept",
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

const missingLovableContent = {
  id: "content-missing-lovable",
  title: "Birthday wishes Source template",
  channel: "email",
  language: "en",
  status: "draft",
  subject: null,
  body: "",
  htmlBody: null,
  ctaLabel: null,
  ctaUrl: null,
  designJson: {},
  mediaAssets: [],
  hasHtml: false,
  hasDesign: false,
  mediaAssetCount: 0,
  source: "lovable",
  lovableExternalId: "email_template:6199c1eb-75ca-4347-a619-f7f5a7af989d",
  createdAt: "2026-07-05T08:50:00.000Z",
  updatedAt: "2026-07-05T09:00:00.000Z",
  metadata: {
    lovable_source_type: "missing_lovable_reference",
    lovable: {
      campaignName: "Birthday Wishes",
      contentExternalId: "email_template:6199c1eb-75ca-4347-a619-f7f5a7af989d",
    },
  },
};

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
        fullName: `Source list member ${memberNumber}`,
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
      SOURCE_MARKETING_API_URL: false,
      VYVA_MARKETING_EXPORT_URL: false,
    },
    tokenAliasPresent: {
      SOURCE_MARKETING_API_KEY: false,
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
        apiUrl: "https://source.example.test",
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
          exportedFields: ["body", "channel", "emailTemplate.previewText", "extraSourceOnlyField", "id", "status", "subject", "template.html_content", "title"],
          firstClassFields: ["body", "channel", "emailTemplate.previewText", "id", "status", "subject", "template.html_content", "title"],
          metadataOnlyFields: ["extraSourceOnlyField"],
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
  apiUrl: "https://source.example.test",
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
        exportedFields: ["body", "channel", "emailTemplate.previewText", "extraSourceOnlyField", "id", "status", "subject", "template.html_content", "title"],
        firstClassFields: ["body", "channel", "emailTemplate.previewText", "id", "status", "subject", "template.html_content", "title"],
        metadataOnlyFields: ["extraSourceOnlyField"],
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
  audiences?: unknown[];
  analytics?: typeof analytics;
} = {}) {
  const syncResponse = { ...sync, ...syncOverride };
  let campaignsResponse = dataOverride.campaigns ?? campaigns;
  let contactsResponse = dataOverride.contacts ?? contacts;
  let contentResponse = dataOverride.content ?? content;
  const mediaAssetsResponse = dataOverride.mediaAssets ?? mediaAssets;
  let audiencesResponse = dataOverride.audiences ?? audiences;
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
    if (path === "/api/admin/marketing/audiences" && method === "GET") return jsonResponse({ audiences: audiencesResponse });
    if (path === "/api/admin/marketing/sync/source" && method === "GET") return jsonResponse(syncResponse);
    if (path === "/api/admin/marketing/sync/source/preview" && method === "GET") return jsonResponse(exportPreview);
    if (path === "/api/admin/marketing/sync/source/run" && method === "POST") return jsonResponse({ ok: true, summary: { campaigns: 1, content: 1, contacts: 1, journeys: 1 } });
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
    if (path === "/api/admin/marketing/campaigns/campaign-1" && method === "PATCH") return jsonResponse({ ok: true, campaign: campaignFromRequestBody("campaign-1", init) });
    if (path === "/api/admin/marketing/campaigns/campaign-2" && method === "PATCH") {
      const updatedCampaign = campaignFromRequestBody("campaign-2", init);
      campaignsResponse = campaignsResponse.map((campaign) => (campaign as { id?: string }).id === "campaign-2" ? updatedCampaign : campaign);
      return jsonResponse({ ok: true, campaign: updatedCampaign });
    }
    if (path === "/api/admin/marketing/campaigns/campaign-1" && method === "DELETE") return jsonResponse({ ok: true, deletedCampaignId: "campaign-1" });
    if (path === "/api/admin/marketing/campaigns/campaign-1/test-email" && method === "POST") return jsonResponse({ ok: true, communication: { id: "comm-1", recipient: "karim.assad@mokadigital.net", status: "sent" }, delivery: { id: "comm-1", recipient: "karim.assad@mokadigital.net", status: "sent" } });
    if (path === "/api/admin/marketing/campaigns/campaign-1/send-email" && method === "POST") return jsonResponse({ ok: true, sentCount: 1, failedCount: 0, skippedCount: 0, campaign: { ...campaigns[0], status: "published" }, delivery: [{ id: "comm-2", recipient: "karim@example.com", status: "sent" }] });
    if (path === "/api/admin/marketing/campaigns/send-due-email" && method === "POST") return jsonResponse({ ok: true, dueCount: 1, sentCount: 1, failedCount: 0, skippedCount: 0, results: [{ campaignId: "campaign-1", campaignName: "Caregiver welcome", ok: true, sentCount: 1, failedCount: 0, skippedCount: 0 }] });
    if (path === "/api/admin/marketing/journeys" && method === "POST") return jsonResponse({ ok: true, journey: journeyFromRequestBody("journey-created", init) }, { status: 201 });
    if (path === "/api/admin/marketing/journeys/journey-1" && method === "PATCH") return jsonResponse({ ok: true, journey: journeyFromRequestBody("journey-1", init) });
    if (path === "/api/admin/marketing/journeys/journey-1" && method === "DELETE") return jsonResponse({ ok: true, deletedJourneyId: "journey-1" });
    if (path === "/api/admin/marketing/content" && method === "POST") {
      const createdContent = contentFromRequestBody("content-created", init);
      contentResponse = [createdContent, ...contentResponse.filter((item) => (item as { id?: string }).id !== createdContent.id)];
      return jsonResponse({ ok: true, content: createdContent }, { status: 201 });
    }
    const contentPatchMatch = path.match(/^\/api\/admin\/marketing\/content\/([^/]+)$/);
    if (contentPatchMatch && method === "PATCH") {
      const updatedContent = contentFromRequestBody(contentPatchMatch[1], init);
      contentResponse = [updatedContent, ...contentResponse.filter((item) => (item as { id?: string }).id !== updatedContent.id)];
      return jsonResponse({ ok: true, content: updatedContent });
    }
    if (path === "/api/admin/marketing/content/content-2" && method === "PATCH") return jsonResponse({ ok: true, content: contentFromRequestBody("content-2", init) });
    if (path === "/api/admin/marketing/content/content-2" && method === "DELETE") return jsonResponse({ ok: true, deletedContentId: "content-2" });
    if (path === "/api/admin/marketing/media/media-1" && method === "PATCH") return jsonResponse({ ok: true, mediaAsset: mediaFromRequestBody("media-1", init) });
    if (path === "/api/admin/marketing/media/media-1" && method === "DELETE") return jsonResponse({ ok: true, deletedMediaAssetId: "media-1" });
    if (path === "/api/admin/marketing/contacts" && method === "POST") return jsonResponse({ ok: true, contact: contacts[1] }, { status: 201 });
    const contactPatchMatch = path.match(/^\/api\/admin\/marketing\/contacts\/([^/]+)$/);
    if (contactPatchMatch && method === "PATCH") {
      const updatedContact = contactFromRequestBody(contactPatchMatch[1], init);
      contactsResponse = contactsResponse.map((contact) => (contact as { id?: string }).id === updatedContact.id ? updatedContact : contact);
      return jsonResponse({ ok: true, contact: updatedContact });
    }
    if (path === "/api/admin/marketing/contacts/contact-2" && method === "DELETE") return jsonResponse({ ok: true, deletedContactId: "contact-2" });
    if (path === "/api/admin/marketing/audiences" && method === "POST") {
      const createdAudience = audienceFromRequestBody("audience-created", init);
      audiencesResponse = [createdAudience, ...audiencesResponse.filter((item) => (item as { id?: string }).id !== createdAudience.id)];
      return jsonResponse({ ok: true, audience: createdAudience }, { status: 201 });
    }
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
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Marketing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Marketing.*Campaigns, contacts and sync/i })).toBeInTheDocument();
    expect(screen.getByTestId("marketing-send-readiness-panel")).toHaveTextContent("Email campaign sending is enabled");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Total campaigns");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Audiences");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Imported media refs");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Journey enrollments");
    expect(screen.getByTestId("marketing-lovable-import-coverage")).toHaveTextContent("Source 2 / VYVA 2");
    expect(screen.getByTestId("marketing-lovable-import-coverage")).toHaveTextContent("Saved email template: 1");
    expect(screen.getByTestId("marketing-lovable-import-coverage")).toHaveTextContent("Social post: 1");
    expect(screen.getByTestId("marketing-lovable-import-coverage")).toHaveTextContent("Unmapped list members: 1");
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Analytics snapshots");
    expect(screen.getByTestId("marketing-performance-insights")).toHaveTextContent("Best engagement");
    expect(screen.getByTestId("marketing-performance-insights")).toHaveTextContent("68% open rate");
    expect(screen.getByTestId("marketing-performance-insights")).toHaveTextContent("CTA opportunity");
    expect(screen.getByTestId("marketing-performance-insights")).toHaveTextContent("9% click rate");
    expect(screen.getByTestId("marketing-performance-insights")).toHaveTextContent("Deliverability clean");
    expect(screen.getByTestId("marketing-ai-command-launcher")).toHaveTextContent("AI campaign command");
    expect(screen.getByTestId("marketing-ai-command-suggestions")).toHaveTextContent("Relationship queue");
    expect(screen.getByTestId("marketing-ai-command-suggestions")).toHaveTextContent("Performance follow-up");
    expect(screen.getByTestId("marketing-ai-command-suggestions")).toHaveTextContent("Partner webinar");
    expect(screen.getByTestId("marketing-ai-command-suggestions")).toHaveTextContent("Home care agency");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-suggestion-relationship-partner-nurture"));
    expect((screen.getByTestId("textarea-marketing-ai-command") as HTMLTextAreaElement).value).toContain("b2b partner nurture queue");
    expect((screen.getByTestId("textarea-marketing-ai-command") as HTMLTextAreaElement).value).toContain("Hassan Partner");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-suggestion-performance-follow-up"));
    expect((screen.getByTestId("textarea-marketing-ai-command") as HTMLTextAreaElement).value).toContain("latest performance signal");
    expect((screen.getByTestId("textarea-marketing-ai-command") as HTMLTextAreaElement).value).toContain("click rate");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-suggestion-home-care-agency"));
    expect(screen.getByTestId("textarea-marketing-ai-command")).toHaveValue("Create a home care agency outreach pathway by email, LinkedIn, WhatsApp, phone, print, Facebook, and event handoff.");
    expect(screen.getByTestId("textarea-marketing-campaign-intent")).toHaveValue("Create a home care agency outreach pathway by email, LinkedIn, WhatsApp, phone, print, Facebook, and event handoff.");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Brief matched to Home care agency outreach");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("Home care agency outreach");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-ai-command-route-email")).toHaveTextContent("VYVA send");
    expect(screen.getByTestId("marketing-ai-command-route-phone")).toHaveTextContent("Manual handoff");
    expect(screen.getByTestId("marketing-ai-command-route-print")).toHaveTextContent("Manual handoff");
    expect(screen.getByTestId("marketing-ai-command-route-event")).toHaveTextContent("Manual handoff");
    fireEvent.change(screen.getByTestId("textarea-marketing-ai-command"), {
      target: { value: "Create a care home residence outreach pathway by email, LinkedIn, WhatsApp, phone, print, Facebook, and event handoff." },
    });
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-run"));
    expect(screen.getByTestId("textarea-marketing-campaign-intent")).toHaveValue("Create a care home residence outreach pathway by email, LinkedIn, WhatsApp, phone, print, Facebook, and event handoff.");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Brief matched to Care home residence outreach");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("Care home residence outreach");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-suggestion-partner-webinar"));
    expect(screen.getByTestId("textarea-marketing-ai-command")).toHaveValue("Invite Madrid partners to a practical webinar by email and LinkedIn.");
    expect(screen.getByTestId("textarea-marketing-campaign-intent")).toHaveValue("Invite Madrid partners to a practical webinar by email and LinkedIn.");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Brief matched to Partner webinar");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("AI understood");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("Partner webinar");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("Email and LinkedIn");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("Expert / Local relevance");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("Next: build the plan");
    expect(screen.getByTestId("marketing-channel-publishing-board")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-channel-publishing-board")).toHaveTextContent("VYVA send");
    expect(screen.getByTestId("marketing-channel-publishing-board")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-channel-publishing-board")).toHaveTextContent("Manual social");
    expect(screen.getByTestId("button-marketing-channel-publishing-linkedin")).toHaveTextContent("Partner outreach");
    fireEvent.click(screen.getByTestId("button-marketing-copy-channel-publishing-plan"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA channel publishing plan"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Email - VYVA send"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn - Manual social"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Every manual publish must be tracked back to the campaign"));
    expect(screen.getByTestId("marketing-channel-publishing-board-feedback")).toHaveTextContent("Channel publishing plan copied.");
    expect(screen.getByTestId("marketing-audience-summary-actions")).toHaveTextContent("View contacts");
    expect(screen.getByTestId("marketing-audience-summary-actions")).toHaveTextContent("Start campaign");
    fireEvent.click(screen.getByTestId("button-marketing-channel-publishing-linkedin"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Partner outreach");
    expect(screen.getByText('Opened "Partner outreach" to fix the creative gap: LinkedIn.')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-performance-insight-cta-opportunity"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByText('Opened "Caregiver welcome" to improve the CTA from performance data.')).toBeInTheDocument();
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
    expect(screen.getByTestId("marketing-campaign-row-readiness-campaign-1")).toHaveTextContent("Review consent");
    expect(screen.getByTestId("marketing-campaign-row-readiness-campaign-1")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-row-copy-next-brief-campaign-1"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign next-action brief"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Campaign: Caregiver welcome"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Recommended next action: Review consent"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("AI task:"));
    expect(screen.getByTestId("marketing-campaign-row-copy-next-brief-feedback-campaign-1")).toHaveTextContent("AI next-step brief copied.");
    expect(screen.getByTestId("marketing-campaign-channel-link-channel-1")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-campaign-channel-link-channel-1-linkedin")).toHaveTextContent("Partner post");

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "Warm B2B" } });
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Partner outreach")).toBeInTheDocument();
    expect(within(screen.getByTestId("marketing-campaign-table")).queryByText("Caregiver welcome")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-row-readiness-campaign-2")).toHaveTextContent("Needs content");
    expect(screen.getByTestId("marketing-campaign-row-readiness-campaign-2")).toHaveTextContent("Attach content for LinkedIn");

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "partner" } });
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    expect(screen.getByTestId("marketing-journeys-tab")).toHaveTextContent("B2B nurture");
    expect(screen.getByTestId("marketing-journey-command-center")).toHaveTextContent("Review this draft and decide whether it should go active");
    expect(screen.getByTestId("marketing-journey-command-stat-content")).toHaveTextContent("1/1");
    expect(screen.getByTestId("marketing-journey-command-stat-activity")).toHaveTextContent("1 enrollment");
    expect(screen.getByTestId("marketing-journey-ai-command-brief")).toHaveTextContent("VYVA journey AI command brief");
    expect((screen.getByTestId("textarea-marketing-journey-ai-command-brief") as HTMLTextAreaElement).value).toEqual(
      expect.stringContaining("B2B nurture: draft; B2B"),
    );
    expect(screen.getByTestId("marketing-journey-activation-packet")).toHaveTextContent("Can this journey safely move toward active?");
    expect(screen.getByTestId("marketing-journey-activation-packet")).toHaveTextContent("B2B nurture");
    expect(screen.getByTestId("marketing-journey-activation-checklist")).toHaveTextContent("Visible steps");
    expect(screen.getByTestId("marketing-journey-activation-checklist")).toHaveTextContent("Linked content");
    expect(screen.getByTestId("marketing-journey-activation-checklist")).toHaveTextContent("Trigger and goal");
    fireEvent.click(screen.getByTestId("button-marketing-copy-journey-activation-packet"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA journey activation packet"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Target journey: B2B nurture"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Activation checklist:"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("AI task: Review this journey activation packet"));
    expect(screen.getByTestId("marketing-journey-activation-packet-feedback")).toHaveTextContent("Journey activation packet copied.");
    fireEvent.click(screen.getByTestId("button-marketing-journey-command-launch-ready"));
    expect(screen.getByTestId("marketing-journey-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-journey-name")).toHaveValue("B2B nurture");
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
    expect(screen.getByTestId("marketing-journey-enrollments")).toHaveTextContent("Source enrollment ID: enrollment-1");
    expect(screen.getByTestId("marketing-journey-enrollments")).toHaveTextContent("Entered");
    expect(screen.getByTestId("marketing-journey-enrollments")).toHaveTextContent("Last activity");
    expect(openMetadataPanel("marketing-journey-enrollment-metadata-enrollment-1")).toHaveTextContent("partners-july");
    expect(screen.getByTestId("marketing-journey-event-event-1")).toHaveTextContent("entered");
    expect(screen.getByTestId("marketing-journey-event-event-1")).toHaveTextContent("email");
    expect(screen.getByTestId("marketing-journey-event-event-10")).toHaveTextContent("event-10");
    expect(openMetadataPanel("marketing-journey-event-metadata-event-1")).toHaveTextContent("automation-log");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Source content coverage");
    expect(screen.getByTestId("marketing-lovable-content-source-buckets")).toHaveTextContent("Saved email template: 1");
    expect(screen.getByTestId("marketing-lovable-content-source-buckets")).toHaveTextContent("Social post: 1");
    expect(screen.getByTestId("marketing-lovable-content-source-buckets")).toHaveTextContent("Missing Source reference: 1");
    expect(screen.getByTestId("marketing-lovable-field-coverage")).toHaveTextContent("content: 8 editable, 1 preserved of 9 exported fields");
    expect(screen.getByTestId("marketing-lovable-field-coverage")).toHaveTextContent("Mapped: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    const contentImportCoverage = openMetadataPanel("marketing-lovable-field-map-content");
    expect(contentImportCoverage).toHaveTextContent("Preserved in Source metadata: extraSourceOnlyField");
    expect(contentImportCoverage).toHaveTextContent("Mapped first-class: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(contentImportCoverage).toHaveTextContent("All exported: body, channel, emailTemplate.previewText, extraSourceOnlyField, id, status, subject, template.html_content, title");
    expect(screen.getByTestId("marketing-missing-content-reference-panel")).toHaveTextContent("Source referenced content that was not exported.");
    expect(screen.getByTestId("marketing-missing-content-reference-panel")).toHaveTextContent("1 campaign or journey content reference");
    fireEvent.click(screen.getByTestId("button-marketing-show-missing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Source content placeholders");
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
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Source ID: lovable-content-2");
    expect(screen.getByTestId("marketing-content-timeline-content-2")).toHaveTextContent("Updated");
    expect(screen.getByTestId("marketing-content-usage-content-2")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-content-usage-content-2")).toHaveTextContent("LinkedIn campaign channel");
    expect(screen.getByTestId("marketing-content-usage-content-1")).toHaveTextContent("B2B nurture");
    expect(screen.getByTestId("marketing-content-usage-content-1")).toHaveTextContent("Step 1: message / Email / day 3");

    fireEvent.click(screen.getByTestId("button-marketing-preview-content-content-2"));

    expect(screen.getByTestId("marketing-content-preview")).toHaveTextContent("Design JSON present");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("Source design preview");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("Partner hero");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("Source builder copy");
    expect(screen.getByTestId("marketing-content-design-preview")).toHaveTextContent("CTA: Book a demo -> https://v2.vyva.life/demo");
    expect(within(screen.getByTestId("marketing-content-design-preview")).getByAltText("Partner hero")).toHaveAttribute("src", "https://cdn.example.test/partner-design.png");
    expect(screen.getByTestId("marketing-content-origin-summary")).toHaveTextContent("Imported from Social post");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("VYVA updated");
    expect(screen.getByTestId("marketing-selected-content-usage")).toHaveTextContent("Used in campaigns and journeys");
    expect(screen.getByTestId("marketing-selected-content-usage")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-content-reuse-brief")).toHaveTextContent("Adapt this asset into the next channel");
    expect(screen.getByTestId("marketing-content-reuse-brief-channels")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-content-reuse-brief-channels")).toHaveTextContent("WhatsApp");
    fireEvent.click(screen.getByTestId("button-marketing-copy-content-reuse-brief"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA content reuse brief"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Asset: Partner post"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Suggested adaptations:"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("AI task: Reuse this content asset"));
    expect(screen.getByTestId("marketing-content-reuse-brief-feedback")).toHaveTextContent("Content reuse brief copied.");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Design blocks: 1");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Design keys: blocks");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("Media refs: 1");
    expect(screen.getByTestId("marketing-content-design-media-summary")).toHaveTextContent("https://cdn.example.test/partner.png");
    expect(within(screen.getByTestId("marketing-content-preview-panel")).getByAltText("partner.png")).toHaveAttribute("src", "https://cdn.example.test/partner.png");
    expect(openMetadataPanel("marketing-content-metadata-panel")).toHaveTextContent("extraSourceOnlyField");
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("https://cdn.example.test/partner.png");
    expect(screen.getByTestId("marketing-media-assets-list")).toHaveTextContent("Source ID: media-1");
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
    expect(screen.getByTestId("marketing-contact-work-queues")).toHaveTextContent("Relationship work queues");
    expect(screen.getByTestId("marketing-contact-work-queue-consent-cleanup")).toHaveTextContent("2 contacts");
    expect(screen.getByTestId("marketing-contact-work-queue-partner-nurture")).toHaveTextContent("1 partner");
    expect(screen.getByTestId("marketing-contact-work-queue-family-onboarding")).toHaveTextContent("1 contact");
    expect(screen.getByTestId("marketing-contact-work-queue-local-market")).toHaveTextContent("1 localised");
    expect(screen.getByTestId("marketing-contact-work-queue-segmentation-gaps")).toHaveTextContent("1 gap");
    expect(screen.getByTestId("marketing-contact-priority-move")).toHaveTextContent("Recommended relationship move");
    expect(screen.getByTestId("marketing-contact-priority-move")).toHaveTextContent("B2B partner nurture");
    expect(screen.getByTestId("marketing-contact-priority-move")).toHaveTextContent("1 partner");
    expect(screen.getByTestId("marketing-contact-priority-move")).toHaveTextContent("Sample: Hassan Partner");
    expect(screen.getByTestId("button-marketing-contact-priority-studio")).toHaveTextContent("Open partner play");
    expect(screen.getByTestId("marketing-contact-operating-path")).toHaveTextContent("Daily relationship path");
    expect(screen.getByTestId("marketing-contact-operating-path-consent")).toHaveTextContent("Clean consent");
    expect(screen.getByTestId("marketing-contact-operating-path-segment")).toHaveTextContent("Sharpen segments");
    expect(screen.getByTestId("marketing-contact-operating-path-list")).toHaveTextContent("Save a relationship list");
    expect(screen.getByTestId("marketing-contact-operating-path-campaign")).toHaveTextContent("Open the campaign play");
    expect(screen.getByTestId("marketing-contact-cadence-board")).toHaveTextContent("Relationship cadence");
    expect(screen.getByTestId("marketing-contact-cadence-today")).toHaveTextContent("Today");
    expect(screen.getByTestId("marketing-contact-cadence-today")).toHaveTextContent("Consent cleanup");
    expect(screen.getByTestId("marketing-contact-cadence-this-week")).toHaveTextContent("This week");
    expect(screen.getByTestId("marketing-contact-cadence-this-week")).toHaveTextContent("B2B partner nurture");
    expect(screen.getByTestId("marketing-contact-cadence-before-publish")).toHaveTextContent("Before publish");
    expect(screen.getByTestId("marketing-contact-cadence-before-publish")).toHaveTextContent("Segmentation gaps");
    expect(screen.getByTestId("marketing-contact-cadence-prompt-this-week")).toHaveTextContent("Draft a one-week B2B partner nurture play");
    fireEvent.click(screen.getByTestId("button-marketing-contact-cadence-show-today"));
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent('Showing "Consent cleanup" queue: 2 contacts.');
    fireEvent.click(screen.getByTestId("button-marketing-clear-contact-filters"));
    fireEvent.click(screen.getByTestId("button-marketing-contact-cadence-studio-this-week"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Relationship queue loaded: B2B partner nurture.");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-clear-contact-filters"));
    fireEvent.click(screen.getByTestId("button-marketing-contact-operating-path-segment"));
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent('Showing "Segmentation gaps" queue: 1 gap.');
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("1 visible of 2 contacts");
    fireEvent.click(screen.getByTestId("button-marketing-clear-contact-filters"));
    expect(screen.getByTestId("marketing-contact-command-brief")).toHaveTextContent("Relationship command brief");
    expect(screen.getByTestId("marketing-contact-command-brief")).toHaveTextContent("One weekly operating plan");
    const commandBrief = screen.getByTestId("textarea-marketing-contact-command-brief") as HTMLTextAreaElement;
    expect(commandBrief.value).toContain("Relationship command brief");
    expect(commandBrief.value).toContain("B2B partner nurture: 1 partner");
    expect(commandBrief.value).toContain("AI planning prompt");
    const commandClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: commandClipboardWriteText },
    });
    fireEvent.click(screen.getByTestId("button-marketing-copy-contact-command-brief"));
    await waitFor(() => {
      expect(commandClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Relationship command brief"));
    });
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Relationship command brief copied.");
    expect(screen.getByTestId("marketing-contact-relationship-run-sheet")).toHaveTextContent("Relationship run sheet");
    expect(screen.getByTestId("marketing-contact-relationship-run-sheet")).toHaveTextContent("Priority: B2B partner nurture");
    const relationshipRunSheet = screen.getByTestId("textarea-marketing-contact-relationship-run-sheet") as HTMLTextAreaElement;
    expect(relationshipRunSheet.value).toContain("VYVA relationship run sheet");
    expect(relationshipRunSheet.value).toContain("Priority move:");
    expect(relationshipRunSheet.value).toContain("B2B partner nurture");
    expect(relationshipRunSheet.value).toContain("Operating rule:");
    fireEvent.click(screen.getByTestId("button-marketing-copy-contact-relationship-run-sheet"));
    await waitFor(() => {
      expect(commandClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA relationship run sheet"));
    });
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Relationship run sheet copied.");
    fireEvent.click(screen.getByTestId("button-marketing-contact-work-queue-show-partner-nurture"));
    expect(screen.getByTestId("select-marketing-contact-list-filter")).toHaveValue("all");
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent('Showing "B2B partner nurture" queue: 1 partner.');
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("1 visible of 2 contacts");
    fireEvent.click(screen.getByTestId("button-marketing-clear-contact-filters"));
    fireEvent.click(screen.getByTestId("button-marketing-contact-work-queue-list-partner-nurture"));
    expect(screen.getByTestId("button-marketing-lists-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("input-marketing-audience-name")).toHaveValue("B2B partner nurture list");
    expect(screen.getByTestId("select-marketing-audience-type")).toHaveValue("static");
    expect(screen.getByTestId("input-marketing-audience-description")).toHaveValue("Use partner/list/company signals to start a credible outreach sequence. Built from 1 partner.");
    expect(screen.getByTestId("input-marketing-audience-contact-ids")).toHaveValue("lovable-contact-2");
    const workQueueAudienceRules = screen.getByTestId("input-marketing-audience-rules") as HTMLTextAreaElement;
    expect(workQueueAudienceRules.value).toContain('"source": "relationship_work_queue"');
    expect(workQueueAudienceRules.value).toContain('"queue": "partner-nurture"');
    expect(screen.getByTestId("marketing-audience-feedback")).toHaveTextContent("B2B partner nurture queue loaded as a list with 1 partner.");
    fireEvent.click(screen.getByTestId("button-marketing-contact-work-queue-studio-partner-nurture"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Relationship queue loaded: B2B partner nurture.");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("B2B partner introduction");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-contacts-view"));
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
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Source ID: lovable-contact-2");
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
    expect(screen.getByTestId("marketing-contact-next-move")).toHaveTextContent("Best next relationship move");
    expect(screen.getByTestId("marketing-contact-next-move")).toHaveTextContent("Review consent before outreach");
    expect(screen.getByTestId("marketing-contact-next-move")).toHaveTextContent("Review consent: pending.");
    expect(screen.getByTestId("marketing-contact-next-move")).toHaveTextContent("75% ready");
    expect(screen.getByTestId("button-marketing-contact-next-move")).toHaveTextContent("Review contact");
    expect(screen.getByTestId("marketing-contact-action-queue")).toHaveTextContent("Relationship action queue");
    expect(screen.getByTestId("marketing-contact-action-queue-consent")).toHaveTextContent("Review consent");
    expect(screen.getByTestId("marketing-contact-action-queue-consent")).toHaveTextContent("Current status is pending");
    expect(screen.getByTestId("marketing-contact-action-queue-template")).toHaveTextContent("Use Email starter");
    expect(screen.getByTestId("marketing-contact-action-queue-brief")).toHaveTextContent("Copy AI relationship brief");
    expect(screen.getByTestId("button-marketing-contact-action-queue-consent")).toHaveTextContent("Review contact");
    expect(screen.getByTestId("marketing-contact-relationship-brief")).toHaveTextContent("Consent review first");
    expect(screen.getByTestId("marketing-contact-relationship-brief")).toHaveTextContent("Primary route: Email");
    expect(screen.getByTestId("marketing-contact-relationship-brief")).toHaveTextContent('Start with "Community partner introduction email" on Email.');
    expect(screen.getByTestId("marketing-contact-relationship-brief")).toHaveTextContent("Partner outreach for Partner at Moka Digital with Spain / healthcare / lead.");
    expect(screen.getByTestId("marketing-contact-relationship-brief")).toHaveTextContent('Connect it to "Partner outreach" or create a focused Partners follow-up.');
    expect(screen.getByTestId("marketing-contact-relationship-brief")).toHaveTextContent("Review consent: pending.");
    expect(screen.getByTestId("marketing-contact-next-message")).toHaveTextContent("Next message preview");
    expect(screen.getByTestId("marketing-contact-next-message")).toHaveTextContent("Community partner introduction email");
    expect(screen.getByTestId("marketing-contact-next-message")).toHaveTextContent("hassan@example.com");
    expect(screen.getByTestId("marketing-contact-next-message")).toHaveTextContent("Review consent before sending: pending.");
    expect(screen.getByTestId("marketing-contact-follow-up-kit")).toHaveTextContent("Relationship follow-up kit");
    expect(screen.getByTestId("marketing-contact-follow-up-step-first-touch")).toHaveTextContent("First touch");
    expect(screen.getByTestId("marketing-contact-follow-up-step-first-touch")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-contact-follow-up-step-second-touch")).toHaveTextContent("Second touch");
    expect(screen.getByTestId("marketing-contact-follow-up-step-relationship-note")).toHaveTextContent("Relationship note");
    expect((screen.getByTestId("textarea-marketing-contact-follow-up-kit") as HTMLTextAreaElement).value).toContain("Consent-safe AI prompt");
    const relationshipClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: relationshipClipboardWriteText },
    });
    fireEvent.click(screen.getByTestId("button-marketing-copy-contact-relationship-brief"));
    await waitFor(() => {
      expect(relationshipClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA relationship brief"));
    });
    expect(relationshipClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Contact: Hassan Partner"));
    expect(relationshipClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("AI task: Turn this relationship brief into the next best contact-specific message"));
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Relationship brief copied.");
    fireEvent.click(screen.getByTestId("button-marketing-copy-contact-next-message"));
    await waitFor(() => {
      expect(relationshipClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA next relationship message"));
    });
    expect(relationshipClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Contact: Hassan Partner"));
    expect(relationshipClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Recipient: hassan@example.com"));
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Relationship message copied.");
    fireEvent.click(screen.getByTestId("button-marketing-contact-action-queue-brief"));
    await waitFor(() => {
      expect(relationshipClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("AI task: Turn this relationship brief into the next best contact-specific message"));
    });
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Relationship brief copied.");
    fireEvent.click(screen.getByTestId("button-marketing-copy-contact-follow-up-kit"));
    await waitFor(() => {
      expect(relationshipClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Relationship follow-up kit: Hassan Partner"));
    });
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Relationship follow-up kit copied.");
    fireEvent.click(screen.getByTestId("button-marketing-contact-next-move"));
    expect(screen.getByTestId("marketing-contact-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-contact-name")).toHaveValue("Hassan Partner");
    fireEvent.click(screen.getByTestId("button-marketing-cancel-contact"));
    expect(screen.getByTestId("marketing-contact-template-recommendations")).toHaveTextContent("Suggested templates");
    expect(screen.getByTestId("marketing-contact-template-email-community-partner-introduction")).toHaveTextContent("Community partner introduction email");
    expect(screen.getByTestId("marketing-contact-template-email-community-partner-introduction")).toHaveTextContent("Email ready");
    expect(screen.getByTestId("marketing-contact-template-email-community-partner-introduction")).toHaveTextContent("B2B relationship match");
    expect(screen.getByTestId("marketing-contact-template-email-community-partner-introduction")).toHaveTextContent("Partner-ready");
    expect(screen.queryByTestId("marketing-contact-template-linkedin-family-proof-article")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-use-contact-template-email-community-partner-introduction"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent('Template "Community partner introduction email" applied for Hassan Partner.');
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Community partner introduction email campaign");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect(screen.getByTestId("input-marketing-campaign-recipient-filter")).toHaveValue("hassan@example.com");
    let relationshipCampaignIntent = (screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value;
    expect(relationshipCampaignIntent).toContain("Relationship campaign for Hassan Partner.");
    expect(relationshipCampaignIntent).toContain('Starter template: "Community partner introduction email" on Email.');
    expect(relationshipCampaignIntent).toContain("Consent status: pending.");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-view-contact-contact-2"));
    fireEvent.click(screen.getByTestId("button-marketing-build-contact-campaign-contact-2"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Studio focused on Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("B2B partner introduction");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect(screen.getByTestId("input-marketing-campaign-recipient-filter")).toHaveValue("hassan@example.com");
    relationshipCampaignIntent = (screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value;
    expect(relationshipCampaignIntent).toContain("Channels: Email + LinkedIn.");
    expect(relationshipCampaignIntent).toContain("Goal: open a partner conversation, reply, or demo request.");
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
    expect(screen.getByTestId("marketing-audience-strategy-audience-1")).toHaveTextContent("AI audience strategy");
    expect(screen.getByTestId("marketing-audience-strategy-audience-1")).toHaveTextContent("Build a proof-led partner sequence");
    expect(screen.getByTestId("marketing-audience-strategy-audience-1")).toHaveTextContent("1/1 reachable");
    expect(screen.getByTestId("marketing-audience-strategy-audience-1")).toHaveTextContent("Best: Email");
    expect(screen.getByTestId("marketing-audience-strategy-audience-1")).toHaveTextContent("1 consent review");
    const audienceLaunchChecklist = screen.getByTestId("marketing-audience-launch-checklist-audience-1");
    expect(audienceLaunchChecklist).toHaveTextContent("List mapping");
    expect(audienceLaunchChecklist).toHaveTextContent("1/2 mapped; 1 imported member ID still need matching.");
    expect(audienceLaunchChecklist).toHaveTextContent("Reachable channels");
    expect(audienceLaunchChecklist).toHaveTextContent("1 contact reachable: 1 email, 1 WhatsApp.");
    expect(audienceLaunchChecklist).toHaveTextContent("Consent");
    expect(audienceLaunchChecklist).toHaveTextContent("1 contact need consent review before automation.");
    expect(audienceLaunchChecklist).toHaveTextContent("Personalisation data");
    expect(audienceLaunchChecklist).toHaveTextContent("Segments are ready:");
    expect(audienceLaunchChecklist).toHaveTextContent("Campaign route");
    expect(audienceLaunchChecklist).toHaveTextContent("Email is recommended, but fix reach/consent before publishing.");
    expect(screen.getByTestId("marketing-audience-launch-checklist-audience-1-mapping")).toHaveTextContent("Needs action");
    expect(screen.getByTestId("marketing-audience-launch-checklist-audience-1-reach")).toHaveTextContent("Ready");
    expect(screen.getByTestId("marketing-audience-launch-checklist-audience-1-consent")).toHaveTextContent("Needs action");
    expect(screen.getByTestId("marketing-audience-launch-checklist-audience-1-route")).toHaveTextContent("Needs action");
    const audienceStrategyBrief = screen.getByTestId("textarea-marketing-audience-strategy-audience-1") as HTMLTextAreaElement;
    expect(audienceStrategyBrief.value).toContain("VYVA audience strategy brief: Partners");
    expect(audienceStrategyBrief.value).toContain("Audience fit: B2B");
    const audienceClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: audienceClipboardWriteText },
    });
    fireEvent.click(screen.getByTestId("button-marketing-copy-audience-strategy-audience-1"));
    await waitFor(() => {
      expect(audienceClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA audience strategy brief: Partners"));
    });
    expect(screen.getByTestId("marketing-audience-feedback")).toHaveTextContent("Audience strategy brief copied.");
    fireEvent.click(screen.getByTestId("button-marketing-build-audience-campaign-audience-1"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Audience loaded: Partners.");
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("audience-1");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("VYVA audience strategy brief: Partners");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));
    fireEvent.click(screen.getByTestId("button-marketing-open-audience-member-contact-audience-1-contact-2"));
    expect(screen.getByTestId("button-marketing-contacts-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("marketing-contact-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-contact-editor-feedback")).toHaveTextContent('Editing "Hassan Partner".');
    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("Source list member 5");
    expect(within(screen.getByTestId("marketing-audience-member-preview-audience-1")).queryByText("Source list member 7")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-toggle-audience-members-audience-1"));
    expect(screen.getByTestId("marketing-audience-member-preview-audience-1")).toHaveTextContent("Source list member 7");
    expect(screen.getByTestId("button-marketing-toggle-audience-members-audience-1")).toHaveTextContent("Collapse members");

    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Not configured");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("Endpoint source: default");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("Bearer token available: no");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("VYVA_MARKETING_EXPORT_TOKEN: no");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("SOURCE_MARKETING_API_KEY: no");
    expect(screen.getByTestId("marketing-sync-env-diagnostics")).toHaveTextContent("Sync API build: marketing-sync-status-2026-07-12-no-cache");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Email is enabled through VYVA");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Enabled");
    expect(screen.getByTestId("marketing-email-scheduler-status")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("marketing-email-scheduler-status")).toHaveTextContent("Manual Run due emails button only");
    expect(screen.getByTestId("marketing-source-sync-setup-run-sheet")).toHaveTextContent("Setup run sheet");
    expect(screen.getByTestId("marketing-source-sync-setup-run-sheet")).toHaveTextContent("Needs token");
    expect(screen.getByTestId("marketing-source-sync-setup-run-sheet")).toHaveTextContent("Manual due-email run");
    const syncSetupRunSheet = screen.getByTestId("textarea-marketing-source-sync-setup-run-sheet") as HTMLTextAreaElement;
    expect(syncSetupRunSheet.value).toContain("VYVA Source sync setup run sheet");
    expect(syncSetupRunSheet.value).toContain("Configured: no");
    expect(syncSetupRunSheet.value).toContain("Next action:");
    expect(syncSetupRunSheet.value).toContain("Add VYVA_MARKETING_EXPORT_TOKEN or SOURCE_MARKETING_API_KEY");
    clipboardWriteText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
    fireEvent.click(screen.getByTestId("button-marketing-copy-source-sync-setup-run-sheet"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA Source sync setup run sheet"));
    });
    expect(screen.getByTestId("marketing-source-sync-setup-run-sheet-feedback")).toHaveTextContent("Source sync setup run sheet copied.");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("Dataset: live");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("Exported at");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("Endpoint: https://source.example.test");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("Cursor: cursor-1");
    expect(screen.getByTestId("marketing-sync-export-metadata-sync-1")).toHaveTextContent("saved_email_templates");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Exported by source");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Audiences: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Media assets: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Campaign metrics: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Journey enrollments: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Campaign recipients: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Unmapped list members: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Unmapped campaign recipients: 1");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("Content");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("complete");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("Source 2 / VYVA 2");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("Mapped members");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("VYVA-only");
    expect(screen.getByTestId("marketing-sync-parity-sync-1")).toHaveTextContent("local, manually created, or derived records");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("content: 8 editable, 1 preserved of 9 exported fields");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Mapped first-class: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("contacts: 11 editable of 11 exported fields");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Mapped first-class: audienceType, email, id, name, phoneNumber, profile.crmScore, profile.emailAddress, profile.firstName, tags, updatedAt, vertical");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Preserved in Source metadata: extraSourceOnlyField");
    const contentCoverage = openMetadataPanel("marketing-sync-field-coverage-sync-1-content");
    expect(contentCoverage).toHaveTextContent("Preserved in Source metadata: extraSourceOnlyField");
    expect(contentCoverage).toHaveTextContent("Mapped first-class: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(contentCoverage).toHaveTextContent("All exported: body, channel, emailTemplate.previewText, extraSourceOnlyField, id, status, subject, template.html_content, title");
    const syncDestinationMap = screen.getAllByTestId("marketing-lovable-destination-map")[0];
    expect(syncDestinationMap).toHaveTextContent("Where Source data appears");
    expect(syncDestinationMap).toHaveTextContent("Saved email templates");
    expect(syncDestinationMap).toHaveTextContent("Content tab");
    expect(syncDestinationMap).toHaveTextContent("Lists and audiences");
    expect(syncDestinationMap).toHaveTextContent("Contacts tab > Lists");
    expect(syncDestinationMap).toHaveTextContent("Campaigns");
    expect(syncDestinationMap).toHaveTextContent("Dashboard, Campaigns, Calendar");
    expect(screen.getByTestId("button-marketing-run-sync")).toBeDisabled();
    expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("VYVA_MARKETING_EXPORT_TOKEN or SOURCE_MARKETING_API_KEY");
    expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("default Source export endpoint is already built in");
  }, 45_000);

  it("turns dashboard audience summaries into contact and campaign actions", async () => {
    renderPage();

    await screen.findByTestId("marketing-audience-summary-actions");
    fireEvent.click(screen.getByTestId("button-marketing-audience-summary-campaign-b2b"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Audience starter loaded: B2B / Partner outreach.");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain(
      "Introduce VYVA to a partner, venue, or professional contact",
    );

    fireEvent.click(screen.getByTestId("button-marketing-audience-summary-contacts-b2b"));
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Showing B2B contacts from the audience summary.");
  });

  it("turns global search matches into direct open actions", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Marketing" });
    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "partner" } });

    expect(screen.getByTestId("marketing-smart-search-results")).toHaveTextContent('Best matches for "partner"');
    expect(screen.getByTestId("marketing-smart-search-results")).toHaveTextContent("Campaign");
    expect(screen.getByTestId("marketing-smart-search-results")).toHaveTextContent("Journey");
    expect(screen.getByTestId("marketing-smart-search-results")).toHaveTextContent("Content");
    expect(screen.getByTestId("marketing-smart-search-results")).toHaveTextContent("Contact");
    expect(screen.getByTestId("marketing-smart-search-results")).toHaveTextContent("Audience");
    expect(screen.getByTestId("marketing-smart-search-results")).toHaveTextContent("Media");

    fireEvent.click(screen.getByTestId("button-marketing-smart-search-open-content-content-2"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Partner post".');
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Partner post");

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "hassan" } });
    fireEvent.click(screen.getByTestId("button-marketing-smart-search-open-contact-contact-2"));
    expect(screen.getByTestId("marketing-contact-relationship-panel")).toHaveTextContent("Hassan Partner");
  });

  it("applies saved marketing views to tabs and filters", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Marketing" });
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Email launch");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("AI command center");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Publish today");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Channel command");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Performance follow-up");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Relationship queue");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Audience builder");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Consent review");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Offline field run");
    expect(screen.getByTestId("marketing-saved-views")).toHaveTextContent("Template factory");

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-partner"));
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Hassan Partner");
    expect(screen.getByLabelText("Audience filter")).toHaveValue("b2b");
    expect(screen.getByTestId("input-marketing-search")).toHaveValue("partner");

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-ai"));
    expect(screen.getByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByTestId("textarea-marketing-ai-command")).toHaveValue("Create a multi-channel VYVA campaign for the highest-priority audience using email, WhatsApp, LinkedIn, and one manual follow-up route.");
    expect(screen.getByTestId("marketing-ai-command-suggestions")).toHaveTextContent("AI understood");
    expect(screen.getByText("Saved view: AI command center. Describe the campaign you want and let VYVA map audience, channels, templates, and publishing steps.")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent("Saved view: AI command center.");

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-consent"));
    expect(screen.getByTestId("marketing-contacts-tab")).toBeInTheDocument();
    expect(screen.getByTestId("select-marketing-contact-consent-filter")).toHaveValue("pending");
    expect(screen.getByTestId("marketing-contact-consent-triage")).toHaveTextContent("Clear the first blockers");

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-source"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Source sync");

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-publish"));
    expect(screen.getByTestId("marketing-calendar-tab")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-calendar-scheduler")).toHaveTextContent("Publishing ops queue");
    expect(screen.getByText("Saved view: publish today. Review scheduled campaigns, due sends, channel handoffs, and launch blockers.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-channels"));
    expect(screen.getByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-channel-publishing-board")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-channel-publishing-board-feedback")).toHaveTextContent("Saved view: channel command.");

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-performance"));
    expect(screen.getByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-performance-insights")).toHaveTextContent("Best engagement");
    expect(screen.getByText("Saved view: performance follow-up. Review engagement signals, winners, weak spots, and campaigns that need a next action.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-relationships"));
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent('Showing "B2B partner nurture" queue: 1 partner.');
    expect(screen.getByText("Saved view: relationship queue. B2B partner nurture is ready for review.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-audiences"));
    expect(screen.getByTestId("button-marketing-lists-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("marketing-audience-builder")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-audience-feedback")).toHaveTextContent("Saved view: audience builder.");

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-offline"));
    expect(screen.getByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByLabelText("Channel filter")).toHaveValue("event");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Launch mode loaded: Local / offline event");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");

    fireEvent.click(screen.getByTestId("button-marketing-saved-view-templates"));
    expect(screen.getByTestId("marketing-content-tab")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Saved view: template factory.");
    expect(screen.getByTestId("marketing-template-command-queue")).toHaveTextContent("Template command queue");
  });

  it("turns a standalone contact into a reusable campaign audience before opening the studio", async () => {
    renderPage({}, { audiences: [] });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-view-contact-contact-1"));

    expect(screen.getByTestId("marketing-contact-relationship-context")).toHaveTextContent("No list match yet");
    expect(screen.getByTestId("button-marketing-build-contact-campaign-contact-1")).toHaveTextContent("Save list + build");

    fireEvent.click(screen.getByTestId("button-marketing-build-contact-campaign-contact-1"));

    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Studio focused on Karim Assad");
    });

    const singleContactAudiencePost = apiFetchMock.mock.calls.find(([path, init]) => {
      if (path !== "/api/admin/marketing/audiences" || init?.method !== "POST") return false;
      const body = JSON.parse(String(init.body ?? "{}"));
      return body.metadata?.created_from === "relationship_contact_build_campaign";
    });
    expect(singleContactAudiencePost).toBeTruthy();
    expect(JSON.parse(String(singleContactAudiencePost?.[1]?.body ?? "{}"))).toMatchObject({
      name: "Karim Assad relationship list",
      listType: "static",
      contactExternalIds: ["contact-1"],
      source: "vyva_relationship_contact",
      rules: {
        source: "single_contact_relationship",
        contactId: "contact-1",
        contactExternalId: "contact-1",
        audienceType: "b2c",
        consentStatus: "unknown",
      },
    });
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("audience-created");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-created");
    expect(screen.getByText("Campaign studio is ready for Karim Assad. Generate AI copy or use the recommended channel pack.")).toBeInTheDocument();
  });

  it("turns the AI command interpretation into matched template actions", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    renderPage();

    expect(await screen.findByTestId("marketing-ai-command-launcher")).toHaveTextContent("AI campaign command");
    expect(screen.getByTestId("marketing-ai-outcome-starters")).toHaveTextContent("Grow partners");
    expect(screen.getByTestId("marketing-ai-outcome-starters")).toHaveTextContent("Activate families");
    expect(screen.getByTestId("marketing-ai-outcome-starters")).toHaveTextContent("Fill a local event");
    expect(screen.getByTestId("marketing-ai-outcome-starters")).toHaveTextContent("Improve what worked");
    fireEvent.click(screen.getByTestId("button-marketing-ai-outcome-starter-grow-partners"));
    expect(screen.getByTestId("textarea-marketing-ai-command")).toHaveValue("Create a B2B partner growth campaign for local clinics, pharmacies, care agencies, and residences using email, LinkedIn, WhatsApp, phone, print, and one relationship follow-up owner.");
    expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent("Outcome loaded: Grow partners.");
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("AI understood");
    expect(screen.getByTestId("marketing-ai-command-route-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-ai-command-route-preview")).toHaveTextContent("LinkedIn");

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-suggestion-partner-webinar"));
    expect(screen.getByTestId("marketing-ai-command-plan")).toHaveTextContent("AI understood");
    expect(screen.getByTestId("marketing-ai-command-route-preview")).toHaveTextContent("Launch route preview");
    expect(screen.getByTestId("marketing-ai-command-route-email")).toHaveTextContent("VYVA send");
    expect(screen.getByTestId("marketing-ai-command-route-linkedin")).toHaveTextContent("Manual handoff");
    expect(screen.getByTestId("marketing-ai-command-audience-quality")).toHaveTextContent("Audience quality");
    expect(screen.getByTestId("marketing-ai-command-audience-quality")).toHaveTextContent("1 matched / 1 reachable");
    expect(screen.getByTestId("marketing-ai-command-audience-quality")).toHaveTextContent("0 opted in");
    expect(screen.getByTestId("marketing-ai-command-audience-quality")).toHaveTextContent("1 consent review");
    expect(screen.getByTestId("marketing-ai-command-audience-channel-coverage")).toHaveTextContent("Email 1");
    expect(screen.getByTestId("marketing-ai-command-audience-channel-coverage")).toHaveTextContent("LinkedIn 1");
    expect(screen.getByTestId("marketing-ai-command-rationale")).toHaveTextContent("Why VYVA chose this");
    expect(screen.getByTestId("marketing-ai-command-rationale")).toHaveTextContent("Partner webinar play");
    expect(screen.getByTestId("marketing-ai-command-rationale")).toHaveTextContent("Partners list");
    expect(screen.getByTestId("marketing-ai-command-rationale")).toHaveTextContent("1 matched");
    expect(screen.getByTestId("marketing-ai-command-rationale")).toHaveTextContent("1 reachable");
    expect(screen.getByTestId("marketing-ai-command-rationale")).toHaveTextContent("2/4 publish steps ready");
    expect(screen.getByTestId("marketing-ai-command-recommended-next")).toHaveTextContent("Recommended next");
    expect(screen.getByTestId("marketing-ai-command-recommended-next")).toHaveTextContent("Review consent first");
    expect(screen.getByTestId("button-marketing-ai-command-recommended-next")).toHaveTextContent("Review consent");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-copy-rationale"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA AI recommendation rationale"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Recommended play: Partner webinar"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Signals used"));
    expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent("AI recommendation rationale copied.");
    expect(screen.getByTestId("button-marketing-ai-command-copy-route-linkedin")).toHaveTextContent("Copy handoff");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-copy-route-linkedin"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA LinkedIn publishing handoff"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Owner: Partner owner"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Save the published URL, reply outcome, or manual send note back on the campaign."));
    expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent("LinkedIn route brief copied.");
    expect(screen.getByTestId("marketing-ai-command-publish-path")).toHaveTextContent("Path to publish");
    expect(screen.getByTestId("marketing-ai-command-publish-path-templates")).toHaveTextContent("Template pack matched");
    expect(screen.getByTestId("marketing-ai-command-publish-path-records")).toHaveTextContent("Create campaign kit");
    expect(screen.getByTestId("marketing-ai-command-publish-path-dispatch")).toHaveTextContent("Review send and handoffs");
    expect(screen.getByTestId("marketing-ai-command-publish-path-follow-up")).toHaveTextContent("Track relationship follow-up");
    expect(screen.getByTestId("button-marketing-ai-command-create-kit")).toHaveTextContent("Create kit");
    expect(screen.getByTestId("button-marketing-ai-command-open-pack")).toHaveTextContent("Open templates");
    expect(screen.getByTestId("button-marketing-ai-command-customize-pack")).toHaveTextContent("Customize pack");
    expect(screen.getByTestId("button-marketing-ai-command-copy-brief")).toHaveTextContent("Copy brief");

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-copy-brief"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA AI campaign command launch brief"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn: Manual handoff"));
    expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent("AI command launch brief copied.");

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-create-kit"));
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Created Professional referral webinar campaign plan");
    });
    expect(screen.getByTestId("marketing-ai-command-created-kit")).toHaveTextContent("Launch kit created");
    expect(screen.getByTestId("marketing-ai-command-created-kit")).toHaveTextContent("Professional referral webinar campaign plan");
    expect(screen.getByTestId("marketing-ai-command-created-kit-routes")).toHaveTextContent("Email and LinkedIn");
    expect(screen.getByTestId("marketing-ai-command-created-kit-recipients")).toHaveTextContent("2");
    expect(screen.getByTestId("marketing-ai-command-created-kit-assets")).toHaveTextContent("new");
    expect(screen.getByTestId("marketing-ai-command-created-kit-next-actions")).toHaveTextContent("Next moves");
    expect(screen.getByTestId("marketing-ai-command-created-kit-next-actions")).toHaveTextContent("Send email safely");
    expect(screen.getByTestId("marketing-ai-command-created-kit-next-actions")).toHaveTextContent("Log LinkedIn handoffs and replies.");
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Professional referral webinar campaign plan");
    expect(screen.getByTestId("marketing-ai-command-created-kit-action-buttons")).toHaveTextContent("Open campaign");
    expect(screen.getByTestId("marketing-ai-command-created-kit-action-buttons")).toHaveTextContent("Review email send");
    expect(screen.getByTestId("marketing-ai-command-created-kit-action-buttons")).toHaveTextContent("Prepare handoffs");

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-open-email-review"));
    expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent('Opened "Professional referral webinar campaign plan" for email send review.');
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("Email send review opened");

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-open-handoff-review"));
    expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent("LinkedIn handoff review");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("Manual handoff review opened for LinkedIn");

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-open-created-campaign"));
    expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent('Opened "Professional referral webinar campaign plan" in campaign details.');

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-customize-pack"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("AI command matched");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("improve the sequence with AI");

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-open-pack"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Template pathfinder");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing AI-matched template pack");
    expect(screen.getByTestId("marketing-template-pack-professional-referral-webinar")).toHaveTextContent("Viewing");
  });

  it("shows local AI command create errors instead of feeling dead", async () => {
    renderPage();

    expect(await screen.findByTestId("marketing-ai-command-launcher")).toHaveTextContent("AI campaign command");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-suggestion-partner-webinar"));

    const baseImplementation = apiFetchMock.getMockImplementation();
    apiFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? "GET";
      if (path === "/api/admin/marketing/campaigns" && method === "POST") {
        return jsonResponse({ error: "Campaign save refused" }, { status: 500 });
      }
      return baseImplementation?.(input, init) ?? jsonResponse({});
    });

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-create-kit"));

    await waitFor(() => {
      expect(screen.getByTestId("marketing-ai-command-feedback")).toHaveTextContent("Create failed: Campaign save refused");
    });
    expect(screen.queryByTestId("marketing-ai-command-created-kit")).not.toBeInTheDocument();
  });

  it("opens AI command audience blockers in the contacts work queue", async () => {
    renderPage();

    await screen.findByTestId("marketing-ai-command-launcher");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-suggestion-partner-webinar"));

    expect(screen.getByTestId("marketing-ai-command-audience-quality")).toHaveTextContent("1 consent review");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-recommended-next"));

    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("1 visible of 2 contacts");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Work queue: 1 selected");
    expect(screen.getByTestId("marketing-contacts-table")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-contacts-table")).not.toHaveTextContent("Karim Assad");
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("Showing 1 consent review contact from the AI campaign plan.");
  });

  it("saves the AI command matched contacts as a reusable audience", async () => {
    renderPage();

    await screen.findByTestId("marketing-ai-command-launcher");
    fireEvent.click(screen.getByTestId("button-marketing-ai-command-suggestion-partner-webinar"));

    fireEvent.click(screen.getByTestId("button-marketing-ai-command-save-audience"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/audiences", expect.objectContaining({ method: "POST" }));
    });
    const audiencePostCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/audiences" && init?.method === "POST");
    const body = JSON.parse(String(audiencePostCall?.[1]?.body ?? "{}"));
    expect(body).toMatchObject({
      name: "AI: Partner webinar",
      listType: "static",
      source: "vyva_ai_campaign_command",
      contactExternalIds: ["lovable-contact-2"],
      rules: {
        source: "ai_campaign_command",
        playId: "partner-webinar",
        playLabel: "Partner webinar",
        audienceType: "b2b",
        channels: ["email", "linkedin"],
        targetAudienceId: "audience-1",
        targetAudienceName: "Partners",
      },
      metadata: {
        created_from: "ai_campaign_command",
        playId: "partner-webinar",
        channels: ["email", "linkedin"],
        reachableContacts: 1,
      },
    });
    expect(body.metadata.audienceQuality).toMatchObject({ total: 1, needsReview: 1 });
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Lists");
    expect(screen.getByTestId("marketing-audience-editor-feedback")).toHaveTextContent('Saved AI audience "AI: Partner webinar" with 1 member.');
  });

  it("prepares an editable replacement draft for missing Source content references", async () => {
    renderPage({}, { content: [...content, missingLovableContent] });

    expect(await screen.findByRole("heading", { name: "Marketing" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    const missingPanel = screen.getByTestId("marketing-missing-content-reference-panel");
    expect(missingPanel).toHaveTextContent("Birthday wishes Source template");
    expect(missingPanel).toHaveTextContent("Open repair draft");
    expect(missingPanel).toHaveTextContent("Repair checklist");
    expect(missingPanel).toHaveTextContent("Source ask");
    expect(missingPanel).toHaveTextContent("email template");
    expect(missingPanel).toHaveTextContent("Used by Campaign: Birthday Wishes");

    fireEvent.click(screen.getByTestId(`button-marketing-repair-missing-content-${missingLovableContent.id}`));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("AI replacement draft prepared");
    expect(screen.getByTestId(`marketing-content-editor-open-${missingLovableContent.id}`)).toHaveTextContent("Editor panel opened");
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Birthday wishes Source template");
    expect(screen.getByTestId("select-marketing-edit-content-status")).toHaveValue("draft");
    expect(screen.getByTestId("input-marketing-edit-content-subject")).toHaveValue("Birthday wishes Source template: ready for review");
    expect(screen.getByTestId("input-marketing-edit-content-cta-label")).toHaveValue("Review in VYVA");
    expect(screen.getByTestId("input-marketing-edit-content-cta-url")).toHaveValue("https://v2.vyva.life");
    const repairBody = screen.getByTestId("textarea-marketing-edit-content-body") as HTMLTextAreaElement;
    const repairHtml = screen.getByTestId("textarea-marketing-edit-content-html") as HTMLTextAreaElement;
    const repairDesign = screen.getByTestId("textarea-marketing-edit-content-design-json") as HTMLTextAreaElement;
    const repairMetadata = screen.getByTestId("textarea-marketing-edit-content-metadata") as HTMLTextAreaElement;
    expect(repairBody.value).toContain("Birthday Wishes");
    expect(repairBody.value).toContain("Repair checklist");
    expect(repairBody.value).toContain("Source request prompt");
    expect(repairBody.value).toContain("Review tone, offer, audience, and compliance before saving.");
    expect(repairHtml.value).toContain("Birthday Wishes");
    expect(repairHtml.value).toContain("Subject line and HTML body");
    expect(repairDesign.value).toContain("marketing_missing_lovable_reference_repair");
    expect(repairDesign.value).toContain("replacement draft");
    expect(repairDesign.value).toContain("Design/media references");
    expect(repairMetadata.value).toContain("repairDraft");
    expect(repairMetadata.value).toContain("source_repaired_draft");
    expect(repairMetadata.value).toContain("original_lovable_source_type");
    expect(repairMetadata.value).toContain("sourceRequestPrompt");
    expect(repairMetadata.value).toContain("email_template:6199c1eb-75ca-4347-a619-f7f5a7af989d");

    fireEvent.click(screen.getByTestId(`button-marketing-repair-content-${missingLovableContent.id}`));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("AI replacement draft prepared");

    fireEvent.click(screen.getByTestId(`button-marketing-save-repair-content-${missingLovableContent.id}`));

    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Saved AI replacement draft");
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === `/api/admin/marketing/content/${missingLovableContent.id}` && init?.method === "PATCH");
    expect(patchCall).toBeTruthy();
    const payload = JSON.parse(String(patchCall?.[1]?.body ?? "{}"));
    expect(payload.metadata.lovable_source_type).toBe("source_repaired_draft");
    expect(payload.metadata.original_lovable_source_type).toBe("missing_lovable_reference");
    expect(payload.metadata.repairDraft.sourceReference).toBe("email_template:6199c1eb-75ca-4347-a619-f7f5a7af989d");
    expect(payload.metadata.repairDraft.reviewChecklist).toContain("Subject line and HTML body");
    expect(payload.metadata.repairDraft.whereUsed).toContain("Campaign: Birthday Wishes");
    await waitFor(() => {
      expect(screen.queryByTestId("marketing-missing-content-reference-panel")).not.toBeInTheDocument();
    });
  });

  it("opens the missing creative repair draft from dashboard blockers", async () => {
    renderPage({}, { content: [...content, missingLovableContent] });

    expect(await screen.findByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByTestId("button-marketing-action-missing-content")).toHaveTextContent("Draft replacement");
    expect(screen.getByTestId("button-marketing-launch-lane-creative")).toHaveTextContent("Draft replacement");
    expect(screen.getByTestId("button-marketing-workflow-coach-creative")).toHaveTextContent("Draft replacement");

    fireEvent.click(screen.getByTestId("button-marketing-action-missing-content"));

    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Source content coverage");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("AI replacement draft prepared");
    expect(screen.getByTestId(`marketing-content-editor-open-${missingLovableContent.id}`)).toHaveTextContent("Editor panel opened");
    expect(screen.getByTestId("input-marketing-edit-content-subject")).toHaveValue("Birthday wishes Source template: ready for review");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-launch-lane-creative"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("AI replacement draft prepared");
  });

  it("loads consent-safe campaign planning from the dashboard audience blocker", async () => {
    renderPage({}, {
      audiences: [{
        ...audiences[0],
        memberCount: 1,
        mappedMemberCount: 1,
        contactExternalIds: ["lovable-contact-2"],
        unmappedContactExternalIds: [],
      }],
    });

    expect(await screen.findByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByTestId("button-marketing-launch-lane-audience")).toHaveTextContent("Prepare consent check");
    expect(screen.getByTestId("button-marketing-workflow-coach-audience")).toHaveTextContent("Prepare consent check");

    fireEvent.click(screen.getByTestId("button-marketing-launch-lane-audience"));

    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Consent-safe re-permission plan loaded");
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Recipient snapshots are off");
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("__no_reviewed_audience__");
    const intentBrief = screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement;
    expect(intentBrief.value).toContain("Consent re-permission campaign.");
    expect(intentBrief.value).toContain("Do not message opted-out contacts.");
  });

  it("shows tracked manual outcomes in campaign performance scans", async () => {
    const manuallyTrackedCampaign = {
      ...campaigns[1],
      status: "scheduled",
      scheduleStartsAt: "2026-07-07T09:00:00.000Z",
      metadata: {
        manualPublishResults: [{
          channel: "linkedin",
          result: "needs_follow_up",
          url: "https://linkedin.com/posts/vyva-partner-outreach",
          notes: "Follow up with two commenters.",
          publishedAt: "2026-07-07T09:00:00.000Z",
          recordedAt: "2026-07-07T10:00:00.000Z",
          audienceReached: 88,
          engagements: 6,
        }],
      },
    };

    renderPage({}, { campaigns: [campaigns[0], manuallyTrackedCampaign] });

    await screen.findByTestId("marketing-dashboard-tab");

    const performance = screen.getByTestId("marketing-campaign-performance-campaign-2");
    expect(performance).toHaveTextContent("No imported metrics");
    expect(performance).toHaveTextContent("1 tracked manual");
    expect(performance).toHaveTextContent("LinkedIn needs follow-up");
    expect(performance).toHaveTextContent("88 reached");
    expect(performance).toHaveTextContent("6 engagements");
    expect(performance).toHaveTextContent("1 follow-up");
    expect(screen.getByTestId("marketing-campaign-performance-campaign-2-manual")).toHaveTextContent("Latest manual result");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    const calendarPerformance = screen.getByTestId("marketing-calendar-performance-campaign-2");
    expect(calendarPerformance).toHaveTextContent("1 tracked manual");
    expect(calendarPerformance).toHaveTextContent("LinkedIn needs follow-up");
  });

  it("turns imported campaign performance into editable experiment drafts", async () => {
    renderPage();

    expect(await screen.findByTestId("marketing-experiment-planner")).toHaveTextContent("Draft a CTA experiment");
    expect(screen.getByTestId("marketing-experiment-planner")).toHaveTextContent("9% click rate");
    expect(screen.getByTestId("marketing-experiment-planner")).toHaveTextContent("Build a follow-up from the winner");

    fireEvent.click(screen.getByTestId("button-marketing-experiment-cta-campaign-1"));

    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Content draft");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Drafted CTA experiment from "Caregiver welcome"');
    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Welcome email - CTA test");
    expect(screen.getByTestId("input-marketing-content-subject")).toHaveValue("Welcome to VYVA");
    expect(screen.getByTestId("input-marketing-content-cta-label")).toHaveValue("Take the next step");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("Experiment note: Use one direct call to action");
    expect((screen.getByTestId("textarea-marketing-content-design-json") as HTMLTextAreaElement).value).toContain("marketing_performance_experiment");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Campaign AI brief also updated");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent('Performance brief loaded from "Caregiver welcome"');
    const campaignExperimentBrief = screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement;
    expect(campaignExperimentBrief.value).toContain('Performance experiment from "Caregiver welcome".');
    expect(campaignExperimentBrief.value).toContain("Signal: 9% click rate");
    expect(campaignExperimentBrief.value).toContain("Experiment: CTA clarity test.");
    expect(campaignExperimentBrief.value).toContain("AI direction: Write a variant with one direct call to action");
    expect(campaignExperimentBrief.value).toContain("Goal: create the next campaign/content variant");
  });

  it("guides content drafts with safe personalization tokens and an AI brief", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    const panel = screen.getByTestId("marketing-content-personalization-panel");
    expect(panel).toHaveTextContent("Personalization readiness");
    expect(panel).toHaveTextContent("No tokens yet");
    expect(screen.getByTestId("marketing-content-quality-panel")).toHaveTextContent("AI quality pass");
    expect(screen.getByTestId("marketing-content-quality-copy")).toHaveTextContent("Add title and body copy before this asset can be used.");

    fireEvent.change(screen.getByTestId("input-marketing-content-title"), { target: { value: "Partner intro" } });
    fireEvent.click(screen.getByTestId("button-marketing-content-insert-subject-first-name"));
    fireEvent.click(screen.getByTestId("button-marketing-content-insert-token-company_name"));
    fireEvent.change(screen.getByTestId("input-marketing-content-cta-label"), { target: { value: "Book intro" } });

    expect(screen.getByTestId("input-marketing-content-subject")).toHaveValue("{{first_name}}");
    expect(screen.getByTestId("textarea-marketing-content-body")).toHaveValue("{{company_name}}");
    expect(screen.getByTestId("marketing-content-personalization-coverage")).toHaveTextContent("{{first_name}}");
    expect(screen.getByTestId("marketing-content-personalization-coverage")).toHaveTextContent("{{company_name}}");
    expect(screen.getByTestId("marketing-content-personalization-preview")).toHaveTextContent("Hassan");
    expect(screen.getByTestId("marketing-content-personalization-preview")).toHaveTextContent("Moka Digital");
    expect(screen.getByTestId("marketing-content-quality-copy")).toHaveTextContent("named asset title");
    expect(screen.getByTestId("marketing-content-quality-channel-fit")).toHaveTextContent("Email has a subject");
    expect(screen.getByTestId("marketing-content-quality-cta")).toHaveTextContent("Book intro");
    expect(screen.getByTestId("marketing-content-quality-personalization")).toHaveTextContent("2 supported merge fields");

    fireEvent.click(screen.getByTestId("button-marketing-content-copy-personalization-brief"));

    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA content personalization AI brief")));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Use only the merge tokens listed above"));
    expect(screen.getByTestId("marketing-content-feedback")).toHaveTextContent("Personalization AI brief copied.");

    fireEvent.click(screen.getByTestId("button-marketing-content-copy-quality-brief"));

    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA content quality AI brief")));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Make this asset more publish-ready"));
    expect(screen.getByTestId("marketing-content-feedback")).toHaveTextContent("Content quality AI brief copied.");
  });

  it("surfaces recommended next actions and routes to the right work area", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
    const snapshotCampaign = {
      ...campaigns[0],
      id: "campaign-snapshot",
      name: "Birthday Wishes",
      audienceType: "b2b",
      recipientCount: 0,
      recipients: [],
      channels: [{
        ...campaigns[0].channels[0],
        id: "channel-snapshot-email",
        contentAssetId: "content-1",
      }],
    };

    renderPage({}, { campaigns: [campaigns[0], snapshotCampaign, campaigns[1]] });

    await screen.findByTestId("marketing-dashboard-tab");

    expect(screen.getByText("Marketing cockpit")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-cockpit")).toHaveTextContent("Do first");
    expect(screen.getByTestId("marketing-cockpit")).toHaveTextContent("Source");
    expect(screen.getByTestId("marketing-cockpit")).toHaveTextContent("Audience");
    expect(screen.getByTestId("marketing-cockpit")).toHaveTextContent("Creative");
    fireEvent.click(screen.getByTestId("button-marketing-cockpit-primary"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Source sync");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    expect(screen.getByTestId("marketing-command-priority-strip")).toHaveTextContent("Next best move");
    expect(screen.getByTestId("marketing-command-priority-strip")).toHaveTextContent("Finish Source sync setup");
    expect(screen.getByTestId("marketing-command-priority-strip")).toHaveTextContent("The export endpoint is ready");
    expect(screen.getByTestId("marketing-publishing-queue")).toHaveTextContent("Today's campaign worklist");
    expect(screen.getByTestId("marketing-publishing-queue")).toHaveTextContent("Consent review before email");
    expect(screen.getByTestId("marketing-publishing-queue")).toHaveTextContent("Snapshot scheduled recipients");
    expect(screen.getByTestId("marketing-publishing-queue")).toHaveTextContent("Fix campaign creative gap");
    expect(screen.getByTestId("marketing-publishing-queue")).toHaveTextContent("Prepare manual channel handoff");
    fireEvent.click(screen.getByTestId("button-marketing-publishing-queue-recipient-consent"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-publishing-queue-recipient-snapshot"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Birthday Wishes");
    expect(screen.getByTestId("checkbox-marketing-edit-campaign-snapshot")).toBeChecked();
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("Recipient snapshot is enabled");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    expect(screen.getByTestId("marketing-operator-brief")).toHaveTextContent("Daily AI operator brief");
    expect(screen.getByTestId("marketing-operator-brief")).toHaveTextContent("One work order");
    expect(screen.getByTestId("button-marketing-operator-brief-priority")).toHaveTextContent("Finish Source sync setup");
    expect(screen.getByTestId("button-marketing-operator-brief-creative")).toHaveTextContent("Creative coverage");
    const operatorBrief = screen.getByTestId("textarea-marketing-operator-brief") as HTMLTextAreaElement;
    expect(operatorBrief.value).toContain("VYVA marketing daily operator brief");
    expect(operatorBrief.value).toContain("Next best move: Finish Source sync setup");
    expect(operatorBrief.value).toContain("Operating rules:");
    fireEvent.click(screen.getByTestId("button-marketing-copy-operator-brief"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA marketing daily operator brief"));
    });
    expect(screen.getByTestId("marketing-operator-brief-feedback")).toHaveTextContent("Daily operator brief copied.");
    fireEvent.click(screen.getByTestId("button-marketing-priority-action-sync-config"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Source sync");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    expect(screen.getByTestId("marketing-source-coverage-review-panel")).toHaveTextContent("Review imported Source data");
    expect(screen.getByTestId("marketing-source-review-queue")).toHaveTextContent("Post-sync review queue");
    expect(screen.getByTestId("marketing-source-review-queue")).toHaveTextContent("Creative library");
    expect(screen.getByTestId("marketing-source-review-queue")).toHaveTextContent("1 Source reference");
    expect(screen.getByTestId("marketing-source-review-queue")).toHaveTextContent("Audience mapping");
    expect(screen.getByTestId("marketing-source-review-queue")).toHaveTextContent("1 unmapped list member");
    fireEvent.click(screen.getByTestId("button-marketing-source-review-queue-lists"));
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Lists");
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("Partners");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-source-coverage-review-journeys"));
    expect(screen.getByTestId("marketing-journeys-tab")).toBeInTheDocument();
    expect(screen.getByText("Opened Journeys from Source sync.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    expect(screen.getByTestId("marketing-workflow-coach")).toHaveTextContent("Workflow coach");
    expect(screen.getByTestId("marketing-workflow-coach")).toHaveTextContent("Do first");
    expect(screen.getByTestId("marketing-workflow-coach")).toHaveTextContent("Audience");
    expect(screen.getByTestId("marketing-workflow-coach")).toHaveTextContent("Creative");
    expect(screen.getByTestId("marketing-workflow-coach")).toHaveTextContent("Launch");
    fireEvent.click(screen.getByTestId("button-marketing-workflow-coach-creative"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Source content coverage");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Source content placeholders");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    expect(screen.getByTestId("marketing-opportunity-radar")).toHaveTextContent("AI opportunity radar");
    expect(screen.getByTestId("marketing-opportunity-radar")).toHaveTextContent("AI ranked");
    expect(screen.getByTestId("marketing-opportunity-radar")).toHaveTextContent("Event reminder");
    expect(screen.getByTestId("marketing-opportunity-radar")).toHaveTextContent("B2B partner nurture");
    expect(screen.getByTestId("button-marketing-opportunity-relationship-partner-nurture")).toHaveTextContent("Show partners");
    expect(screen.getByTestId("button-marketing-opportunity-create-relationship-partner-nurture")).toHaveTextContent("Open partner play");
    expect(screen.getByTestId("button-marketing-opportunity-play-event-reminder")).toHaveTextContent("Load in studio");
    expect(screen.getByTestId("button-marketing-opportunity-create-play-event-reminder")).toHaveTextContent("Create full launch kit");
    fireEvent.click(screen.getByTestId("button-marketing-opportunity-relationship-partner-nurture"));
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("1 visible of 2 contacts");
    expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent('Showing "B2B partner nurture" queue: 1 partner.');
    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-opportunity-create-relationship-partner-nurture"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Relationship queue loaded: B2B partner nurture.");
    fireEvent.click(screen.getByTestId("button-marketing-opportunity-play-event-reminder"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Playbook loaded: Event reminder");

    expect(screen.getByTestId("marketing-launch-lane")).toHaveTextContent("Shortest path to a publishable campaign");
    expect(screen.getByTestId("marketing-launch-lane")).toHaveTextContent("Import");
    expect(screen.getByTestId("marketing-launch-lane")).toHaveTextContent("Audience");
    expect(screen.getByTestId("marketing-launch-lane")).toHaveTextContent("Creative");
    expect(screen.getByTestId("marketing-launch-lane")).toHaveTextContent("Launch");

    fireEvent.click(screen.getByTestId("button-marketing-launch-lane-creative"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Source content coverage");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Source content placeholders");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Finish Source sync setup");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Review recipient consent");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Replace missing Source content");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Review audience mapping");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Fix campaign creative gap");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("LinkedIn content");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Add recipient snapshots");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Birthday Wishes");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Create a full launch kit");
    expect(screen.getByTestId("button-marketing-action-template-launch-kit")).toHaveTextContent("Create full launch kit");
    expect(screen.getByTestId("marketing-action-center")).toHaveTextContent("Prepare manual channel handoff");
    expect(screen.getByTestId("button-marketing-campaign-row-next-campaign-1")).toHaveTextContent("Review consent");
    expect(screen.getByTestId("button-marketing-campaign-row-next-campaign-2")).toHaveTextContent("Attach content");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-row-next-campaign-2"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Fix the creative gap");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("Creative accelerator opened");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("LinkedIn content");
    expect(screen.getByTestId("marketing-campaign-creative-rescue-brief")).toHaveTextContent("AI creative rescue brief");
    expect(screen.getByTestId("marketing-campaign-creative-rescue-brief")).toHaveTextContent("1 route to rescue");
    const creativeRescueBrief = screen.getByTestId("textarea-marketing-campaign-creative-rescue-brief") as HTMLTextAreaElement;
    expect(creativeRescueBrief.value).toContain("VYVA creative rescue brief");
    expect(creativeRescueBrief.value).toContain("Campaign: Partner outreach");
    expect(creativeRescueBrief.value).toContain("Missing routes: LinkedIn");
    expect(creativeRescueBrief.value).toContain("Asset title: Partner outreach LinkedIn content");
    expect(creativeRescueBrief.value).toContain("Template hints:");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-copy-creative-rescue-brief"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA creative rescue brief"));
    });
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Creative rescue brief copied.");
    expect(screen.getByTestId("marketing-campaign-readiness-panel")).toHaveTextContent("Content");
    expect(screen.getByTestId("marketing-campaign-readiness-panel")).toHaveTextContent("Add content for LinkedIn");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-action-campaign-audience"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Birthday Wishes");
    expect(screen.getByTestId("checkbox-marketing-edit-campaign-snapshot")).toBeChecked();
    expect(screen.getByTestId("marketing-campaign-recipient-preview")).toHaveTextContent("1");
    expect(screen.getByTestId("marketing-campaign-recipient-preview")).toHaveTextContent("1 channel snapshot");
    expect(screen.getByTestId("button-marketing-readiness-save-campaign")).toHaveTextContent("Save + snapshot recipients");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("Recipient snapshot is enabled");
    expect(screen.getByText('Opened "Birthday Wishes" to snapshot campaign recipients.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-action-recipient-consent"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending");
    expect(screen.getByText('Opened "Caregiver welcome" to review recipient consent before sending.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-action-missing-content"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Source content coverage");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Source content placeholders");
    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("Content is loaded, but hidden by filters.");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-action-audience-mapping"));
    expect(screen.getByTestId("button-marketing-lists-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("marketing-audience-builder")).toHaveTextContent("Rules JSON");
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("Partners");

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-action-campaign-content"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Fix the creative gap");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("Creative accelerator opened");
    expect(screen.getByText('Opened "Partner outreach" to fix the creative gap: LinkedIn.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("tab-marketing-dashboard"));
    fireEvent.click(screen.getByTestId("button-marketing-action-manual-handoff"));
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByText('Opened "Caregiver welcome" to prepare non-email channel handoff.')).toBeInTheDocument();
  }, 30000);

  it("routes due ready email campaigns from the publishing queue to final review", async () => {
    const dueAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dueCampaign = {
      ...campaigns[0],
      scheduleStartsAt: dueAt,
      channels: campaigns[0].channels.map((channel) => channel.channel === "email" ? { ...channel, scheduledAt: dueAt } : channel),
      recipients: [{
        ...campaigns[0].recipients[0],
        contactId: "contact-2",
        snapshot: { fullName: "Hassan Partner", email: "hassan@example.com", contact_external_id: "lovable-contact-2" },
      }],
    };
    const optedInContacts = contacts.map((contact) => contact.id === "contact-2" ? { ...contact, consentStatus: "opted_in" } : contact);

    renderPage({}, { campaigns: [dueCampaign], contacts: optedInContacts });

    await screen.findByTestId("marketing-dashboard-tab");

    expect(screen.getByTestId("marketing-publishing-queue")).toHaveTextContent("Due email ready for final review");
    expect(screen.getByTestId("marketing-publishing-queue")).toHaveTextContent("Due now");
    expect(screen.getByTestId("button-marketing-publishing-queue-due-email")).toHaveTextContent("Open send review");

    fireEvent.click(screen.getByTestId("button-marketing-publishing-queue-due-email"));

    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("is due now");
    expect(screen.getByText('Opened "Caregiver welcome" for due email review.')).toBeInTheDocument();
  });

  it("guides campaign creation through compose audience preview and launch steps", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");

    const launchPath = screen.getByTestId("marketing-campaign-guided-launch-path");
    expect(launchPath).toHaveTextContent("Compose, choose the audience, preview, then schedule or send");
    expect(screen.getByTestId("marketing-campaign-launch-decision")).toHaveTextContent("Launch decision");
    expect(screen.getByTestId("marketing-campaign-launch-decision-title")).toHaveTextContent("Name the campaign first");
    expect(screen.getByTestId("button-marketing-campaign-launch-decision")).toHaveTextContent("Name campaign");
    expect(screen.getByTestId("marketing-campaign-guided-step-compose")).toHaveTextContent("Name the campaign");
    expect(screen.getByTestId("marketing-campaign-guided-step-audience")).toHaveTextContent("eligible");
    expect(screen.getByTestId("marketing-campaign-guided-step-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-guided-step-launch")).toHaveTextContent("Draft first");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-guided-step-compose"));
    expect(screen.getByText("Start with a clear campaign name. The guide will unlock content, audience, preview, and launch steps as you go.")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "Guided caregiver launch" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-content"), { target: { value: "content-1" } });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-guided-step-compose")).toHaveTextContent("1/1 content linked");
    });
    expect(screen.getByTestId("marketing-campaign-launch-decision-title")).toHaveTextContent("Review consent before send");
    expect(screen.getByTestId("button-marketing-campaign-launch-decision")).toHaveTextContent("Review audience");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-guided-step-audience"));

    await waitFor(() => {
      expect(screen.getByTestId("checkbox-marketing-campaign-snapshot")).toBeChecked();
    });
    expect(screen.getByText("Recipient snapshot enabled. Review the count, then preview or save the campaign.")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-launch-decision-title")).toHaveTextContent("Review consent before send");
  });

  it("promotes recommended campaigns from the dashboard into the campaign studio", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");

    expect(screen.getByTestId("marketing-campaign-cockpit")).toHaveTextContent("Recommended campaigns");
    expect(screen.getByTestId("marketing-campaign-cockpit")).toHaveTextContent("Pick the next useful campaign in one glance");
    expect(screen.getByTestId("marketing-campaign-cockpit")).toHaveTextContent("smart picks");
    expect(screen.getByTestId("marketing-campaign-cockpit")).toHaveTextContent("Event reminder");
    expect(screen.getByTestId("marketing-campaign-cockpit-card-event-reminder")).toHaveTextContent("reachable contact");
    expect(screen.getByTestId("marketing-campaign-cockpit-card-event-reminder")).toHaveTextContent("matching starter template");
    expect(screen.getByTestId("marketing-campaign-cockpit-card-event-reminder")).toHaveTextContent("Best list: Partners");
    expect(screen.getByTestId("marketing-campaign-cockpit-card-event-reminder")).toHaveTextContent("Pack: Local event relationship");
    expect(screen.getByTestId("marketing-campaign-cockpit-output-event-reminder")).toHaveTextContent("Creation preview");
    expect(screen.getByTestId("marketing-campaign-cockpit-output-event-reminder")).toHaveTextContent("6 content assets");
    expect(screen.getByTestId("marketing-campaign-cockpit-output-event-reminder")).toHaveTextContent("channel routes");
    expect(screen.getByTestId("marketing-campaign-cockpit-output-event-reminder")).toHaveTextContent("recipient snapshot");
    expect(screen.getByTestId("marketing-campaign-cockpit-output-event-reminder")).toHaveTextContent("Email review plus manual handoffs");
    expect(screen.getByTestId("button-marketing-cockpit-create-event-reminder")).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("button-marketing-cockpit-load-event-reminder"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Playbook loaded: Event reminder");
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");

    fireEvent.click(screen.getByTestId("button-marketing-cockpit-create-event-reminder"));

    await waitFor(() => {
      const packCampaignPost = apiFetchMock.mock.calls.find(([path, init]) => {
        if (path !== "/api/admin/marketing/campaigns" || init?.method !== "POST") return false;
        const payload = JSON.parse(String(init.body ?? "{}"));
        return payload.metadata?.templatePackPlan?.packId === "local-event-relationship";
      });
      expect(packCampaignPost).toBeTruthy();
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Created Local event relationship campaign plan");
  });

  it("creates a campaign pack directly from the opportunity radar", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");

    const radarCreateButton = screen.getByTestId("button-marketing-opportunity-create-play-event-reminder");
    expect(radarCreateButton).toHaveTextContent("Create full launch kit");
    expect(radarCreateButton).not.toBeDisabled();

    fireEvent.click(radarCreateButton);

    await waitFor(() => {
      const packCampaignPost = apiFetchMock.mock.calls.find(([path, init]) => {
        if (path !== "/api/admin/marketing/campaigns" || init?.method !== "POST") return false;
        const payload = JSON.parse(String(init.body ?? "{}"));
        return payload.metadata?.templatePackPlan?.packId === "local-event-relationship";
      });
      expect(packCampaignPost).toBeTruthy();
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Created Local event relationship campaign plan");
  });

  it("shows all imported Source details instead of hiding rows behind preview caps", async () => {
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
            body: `Source builder copy ${index + 1}`,
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

  it("searches imported Source IDs, metadata, media, lists, and journey steps", async () => {
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

  it("filters Source contacts by source, consent, segmentation fields, and lists", async () => {
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

  it("loads smart audience recipes into the list builder and campaign studio", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));

    expect(screen.getByTestId("marketing-audience-recipes")).toHaveTextContent("Partner prospects");
    expect(screen.getByTestId("marketing-audience-recipe-partner-prospects")).toHaveTextContent("1 partner");
    expect(screen.getByTestId("marketing-audience-recipe-caregiver-onboarding")).toHaveTextContent("1 contact");
    expect(screen.getByTestId("marketing-audience-recipe-consent-cleanup")).toHaveTextContent("2 contacts");

    fireEvent.click(screen.getByTestId("button-marketing-audience-recipe-fill-partner-prospects"));
    expect(screen.getByTestId("input-marketing-audience-name")).toHaveValue("Partner prospects");
    expect(screen.getByTestId("select-marketing-audience-type")).toHaveValue("static");
    expect(screen.getByTestId("input-marketing-audience-description")).toHaveValue("B2B leads, providers, and partner contacts with a reachable channel.");
    expect(screen.getByTestId("input-marketing-audience-rules")).toHaveValue(JSON.stringify({ audienceType: "b2b", category: ["partner", "lead", "provider"], consent: "not_opted_out" }, null, 2));
    expect(screen.getByTestId("input-marketing-audience-contact-ids")).toHaveValue("lovable-contact-2");
    expect(screen.getByTestId("marketing-audience-feedback")).toHaveTextContent("Partner prospects recipe loaded with 1 partner.");

    fireEvent.click(screen.getByTestId("button-marketing-audience-recipe-studio-partner-prospects"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Partner prospects recipe loaded: 1 partner.");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("input-marketing-campaign-recipient-filter")).toHaveValue("Partners");
  });

  it("filters the content library by imported source data type", async () => {
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

  it("explains empty content when Source sync has not imported anything yet", async () => {
    renderPage({ runs: [] }, { content: [], mediaAssets: [] });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("No Source content has been imported yet.");
    expect(screen.getByTestId("marketing-content-empty-diagnostic")).toHaveTextContent("Run the one-way sync in Settings");

    fireEvent.click(screen.getByTestId("button-marketing-open-sync-settings"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Source sync");
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
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));

    expect(screen.getByTestId("marketing-calendar-scheduler")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-calendar-command-strip")).toHaveTextContent("Due email");
    expect(screen.getByTestId("button-marketing-calendar-command-due-email")).toHaveTextContent("1");
    expect(screen.getByTestId("button-marketing-calendar-command-due-email")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("button-marketing-calendar-command-unscheduled")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("button-marketing-calendar-command-handoff")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("button-marketing-calendar-command-content-gaps")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-calendar-ai-planner")).toHaveTextContent("AI schedule planner");
    expect(screen.getByTestId("marketing-calendar-ai-planner")).toHaveTextContent("Send due email now");
    expect(screen.getByTestId("marketing-calendar-ai-planner")).toHaveTextContent("Fix content gap");
    expect(screen.getByTestId("marketing-calendar-ai-planner")).toHaveTextContent("Prepare manual handoff");
    expect(screen.getByTestId("marketing-calendar-publish-run-sheet")).toHaveTextContent("Daily publish run sheet");
    expect(screen.getByTestId("marketing-calendar-ops-queue")).toHaveTextContent("Publishing ops queue");
    expect(screen.getByTestId("button-marketing-calendar-ops-queue-send-email")).toHaveTextContent("1");
    expect(screen.getByTestId("button-marketing-calendar-ops-queue-send-email")).toHaveTextContent("Send due email campaigns");
    expect(screen.getByTestId("button-marketing-calendar-ops-queue-fix-content")).toHaveTextContent("1");
    expect(screen.getByTestId("button-marketing-calendar-ops-queue-fix-content")).toHaveTextContent("Fix content blockers");
    expect(screen.getByTestId("button-marketing-calendar-ops-queue-snapshot-recipients")).toHaveTextContent("0");
    expect(screen.getByTestId("button-marketing-calendar-ops-queue-manual-handoff")).toHaveTextContent("1");
    expect(screen.getByTestId("button-marketing-calendar-ops-queue-schedule-drafts")).toHaveTextContent("0");
    const publishRunSheet = screen.getByTestId("textarea-marketing-calendar-publish-run-sheet") as HTMLTextAreaElement;
    expect(publishRunSheet.value).toContain("VYVA daily publishing run sheet");
    expect(publishRunSheet.value).toContain("Due email campaigns:");
    expect(publishRunSheet.value).toContain("Caregiver welcome: 1 recipient");
    expect(publishRunSheet.value).toContain("Manual handoffs:");
    expect(publishRunSheet.value).toContain("Partner outreach");
    fireEvent.click(screen.getByTestId("button-marketing-calendar-copy-run-sheet"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA daily publishing run sheet"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Operating rule: email can be sent from VYVA after review"));
    expect(screen.getByTestId("marketing-calendar-publish-run-sheet-feedback")).toHaveTextContent("Daily publishing run sheet copied.");
    expect(screen.getByTestId("button-marketing-calendar-ai-plan-content-gap")).toHaveTextContent("Before scheduling");
    expect(screen.getByTestId("button-marketing-calendar-ai-plan-content-gap")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-calendar-timeline")).toHaveTextContent("1 scheduled");
    expect(screen.getByTestId("marketing-calendar-channel-link-channel-1")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-calendar-performance-campaign-1")).toHaveTextContent("66 sent");
    expect(screen.getByTestId("marketing-calendar-performance-campaign-1")).toHaveTextContent("44 opened");
    expect(screen.getByTestId("marketing-calendar-unscheduled")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-calendar-unscheduled-channel-link-channel-2")).toHaveTextContent("No content linked");
    expect(screen.getByTestId("marketing-calendar-unscheduled-performance-campaign-2")).toHaveTextContent("No imported metrics");

    fireEvent.click(screen.getByTestId("button-marketing-calendar-ai-plan-content-gap"));
    expect(screen.getByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-edit-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-campaign-name")).toHaveValue("Partner outreach");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    fireEvent.click(screen.getByTestId("button-marketing-calendar-ops-queue-send-email"));

    expect(screen.getByTestId("marketing-dashboard-tab")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-edit-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-campaign-name")).toHaveValue("Caregiver welcome");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    fireEvent.click(screen.getByTestId("button-marketing-calendar-command-due-email"));

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
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Source ID: lovable-content-2");

    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-journey-journey-1"));
    fireEvent.click(screen.getByTestId("marketing-journey-step-content-preview-0-edit"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Editing "Welcome email".');
    expect(screen.getByTestId("marketing-content-editor-panel")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Welcome email");
  });

  it("opens Source content from campaign, calendar, and journey overview references", async () => {
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

  it("explains when the current admin cannot run Source sync", async () => {
    renderPage({ configured: true, canRunSync: false, apiUrl: "https://source.example.test" });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-settings"));

    expect(screen.getByTestId("button-marketing-run-sync")).toBeDisabled();
    expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("Only the super admin (karim.assad@mokadigital.net) can run Source sync.");
  });

  it("shows inline Source sync progress and completion after clicking", async () => {
    renderPage({ configured: true, canRunSync: true, apiUrl: "https://source.example.test" });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    fireEvent.click(screen.getByTestId("button-marketing-run-sync"));

    expect(screen.getByTestId("button-marketing-run-sync")).toHaveTextContent("Running sync...");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/sync/source/run", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("Source sync completed. Imported Campaigns: 1, Contacts: 1, Content: 1, Journeys: 1.");
    });
    expect(screen.getByTestId("marketing-source-review-panel")).toHaveTextContent("Review imported data");
    expect(screen.getByTestId("button-marketing-source-review-content")).toHaveTextContent("Content");
    expect(screen.getByTestId("button-marketing-source-review-content")).toHaveTextContent("1");

    fireEvent.click(screen.getByTestId("button-marketing-source-review-content"));

    expect(screen.getByTestId("marketing-content-tab")).toBeInTheDocument();
    expect(screen.getByText("Opened Content from Source sync.")).toBeInTheDocument();
  });

  it("previews the Source export before importing rows", async () => {
    renderPage({ configured: true, canRunSync: true, apiUrl: "https://source.example.test" });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    fireEvent.click(screen.getByTestId("button-marketing-preview-export"));

    expect(screen.getByTestId("button-marketing-preview-export")).toHaveTextContent("Checking export...");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/sync/source/preview", undefined);
    });

    expect(screen.getByTestId("marketing-export-preview-feedback")).toHaveTextContent("Source export contains");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("Content: 2");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("saved_email_template: 1");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("social_post: 1");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("Top-level export keys");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("content: 8 editable, 1 preserved of 9 exported fields");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("Mapped: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(screen.getByTestId("marketing-export-preview")).toHaveTextContent("Preserved in Source metadata: extraSourceOnlyField");
    const previewContentCoverage = openMetadataPanel("marketing-export-field-coverage-content");
    expect(previewContentCoverage).toHaveTextContent("Preserved in Source metadata: extraSourceOnlyField");
    expect(previewContentCoverage).toHaveTextContent("Mapped first-class: body, channel, emailTemplate.previewText, id, status, subject, template.html_content, title");
    expect(previewContentCoverage).toHaveTextContent("All exported: body, channel, emailTemplate.previewText, extraSourceOnlyField, id, status, subject, template.html_content, title");
    const previewDestinationMap = screen.getAllByTestId("marketing-lovable-destination-map").at(-1);
    expect(previewDestinationMap).toHaveTextContent("Where Source data appears");
    expect(previewDestinationMap).toHaveTextContent("Social posts");
    expect(previewDestinationMap).toHaveTextContent("Content tab");
    expect(previewDestinationMap).toHaveTextContent("Journeys");
    expect(previewDestinationMap).toHaveTextContent("Journeys tab");
    expect(screen.getByTestId("marketing-source-review-panel")).toHaveTextContent("Review available Source data");

    fireEvent.click(screen.getByTestId("button-marketing-source-review-lists"));

    expect(screen.getByTestId("marketing-contacts-tab")).toBeInTheDocument();
    expect(screen.getByTestId("button-marketing-lists-view")).toHaveClass("bg-purple-700");

    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    expect(screen.getByTestId("marketing-export-preview-samples")).toHaveTextContent("Recognized sample rows");
    expect(screen.getByTestId("marketing-export-preview-samples")).toHaveTextContent("template_name");
    expect(screen.getByTestId("marketing-export-preview-raw-samples")).toHaveTextContent("social_posts");
  });

  it("shows a copyable playbook for curated template packs", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    expect(screen.getByTestId("marketing-template-pack-playbook-caregiver-invite-activation")).toHaveTextContent("Pack playbook");
    expect(screen.getByTestId("marketing-template-pack-playbook-caregiver-invite-activation")).toHaveTextContent("Use Caregiver invite acceptance email first");
    expect(screen.getByTestId("marketing-template-pack-playbook-caregiver-invite-activation")).toHaveTextContent("7 steps");
    expect(screen.getByTestId("marketing-template-pack-community-partner-launch")).toHaveTextContent("Community partner launch");
    expect(screen.getByTestId("marketing-template-pack-community-partner-launch")).toHaveTextContent("6 channels");
    expect(screen.getByTestId("marketing-template-pack-playbook-community-partner-launch")).toHaveTextContent("Use Community partner introduction email first");
    expect(screen.getByTestId("button-marketing-template-pack-copy-visual-kit-community-partner-launch")).toHaveTextContent("Copy visual kit");
    expect(screen.getByTestId("button-marketing-template-pack-copy-playbook-caregiver-invite-activation")).toHaveTextContent("Copy playbook");
    expect(screen.getByTestId("button-marketing-template-pack-copy-visual-kit-caregiver-invite-activation")).toHaveTextContent("Copy visual kit");
    expect(screen.getByTestId("marketing-template-pack-controls")).toHaveTextContent("Pack chooser");
    expect(screen.getByTestId("select-marketing-template-pack-sort")).toHaveValue("recommended");
    fireEvent.change(screen.getByTestId("select-marketing-template-pack-sort"), { target: { value: "reach" } });
    expect(screen.getByTestId("select-marketing-template-pack-sort")).toHaveValue("reach");
    expect(screen.getByTestId("marketing-template-pack-kit-glance-caregiver-invite-activation")).toHaveTextContent("Kit at a glance");
    expect(screen.getByTestId("marketing-template-pack-kit-glance-caregiver-invite-activation")).toHaveTextContent("Reach");
    expect(screen.getByTestId("marketing-template-pack-kit-glance-caregiver-invite-activation")).toHaveTextContent("Assets");
    expect(screen.getByTestId("marketing-template-pack-kit-glance-caregiver-invite-activation")).toHaveTextContent("Email send");
    expect(screen.getByTestId("marketing-template-pack-kit-glance-caregiver-invite-activation")).toHaveTextContent("Manual handoff");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-playbook-caregiver-invite-activation"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA template pack playbook"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Caregiver invite activation"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Publish checklist:"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Caregiver invite activation playbook copied.");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-visual-kit-caregiver-invite-activation"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA template pack visual kit"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Asset design briefs:"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("AI/design task: Turn this pack into a polished visual campaign kit"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Caregiver invite activation visual kit copied.");
  });

  it("applies content templates into the draft form", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Referral ask email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok feature demo script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn family proof article");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("WhatsApp partner proof nudge");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Trust review request email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Local event invite email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok event day script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Care confidence reactivation email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Clinic referral intro email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("SMS local event reminder");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Phone partner follow-up script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Community flyer copy");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Community partner introduction email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Community partner one-pager");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Community partner phone check-in");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Local event host handoff brief");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Neighbourhood event run sheet");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Partner event follow-up SMS");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn family event recap");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Monthly care digest email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Daily routine activation email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok monthly care snapshot script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable monthly care summary card");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Routine reminder SMS");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Family referral ask email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Family referral call script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable family referral card");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Seasonal wellbeing check-in email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Seasonal wellbeing phone check script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable seasonal check-in card");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Premium family plan email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Instagram Premium benefits carousel");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable Premium family one-pager");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Caregiver invite acceptance email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Caregiver invite WhatsApp reminder");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable caregiver invite one-pager");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Professional webinar invitation email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Professional webinar call script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Professional webinar run sheet");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Full-channel launch email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Full-channel launch phone script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Full-channel launch TikTok script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Press and partner announcement email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Press partner briefing run sheet");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Home care agency intro email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Home care agency intro call script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Care home residence intro email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Care home residence director call script");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Template gallery");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("ready-to-adapt VYVA templates");
    expect(screen.getByTestId("marketing-content-template-visual-preview-caregiver-email-welcome")).toHaveTextContent("email-card");
    expect(screen.getByTestId("marketing-content-template-visual-preview-caregiver-email-welcome")).toHaveTextContent("Welcome to VYVA, {{first_name}}");
    expect(screen.getByTestId("marketing-content-template-visual-preview-caregiver-email-welcome")).toHaveTextContent("CTA: Open care dashboard");
    expect(screen.getByTestId("marketing-content-template-palette-caregiver-email-welcome").querySelectorAll("span")).toHaveLength(3);
    expect(screen.getByTestId("marketing-content-template-design-brief-caregiver-email-welcome")).toHaveTextContent("Layout: email-card");
    expect(screen.getByTestId("marketing-content-template-design-brief-caregiver-email-welcome")).toHaveTextContent("Blocks: Care team access");
    expect(screen.getByTestId("marketing-content-template-design-brief-caregiver-email-welcome")).toHaveTextContent("CTA: Open care dashboard");
    expect(screen.getByTestId("marketing-content-template-visual-preview-instagram-trust-carousel")).toHaveTextContent("instagram-proof-carousel");
    expect(screen.getByTestId("marketing-content-template-visual-preview-instagram-trust-carousel")).toHaveTextContent("What changed today?");
    expect(screen.getByTestId("marketing-content-template-visual-preview-instagram-trust-carousel")).toHaveTextContent("Visual: warm illustrated care loop");
    expect(screen.getByTestId("marketing-content-template-design-brief-instagram-trust-carousel")).toHaveTextContent("Layout: instagram-proof-carousel");
    expect(screen.getByTestId("marketing-content-template-design-brief-instagram-trust-carousel")).toHaveTextContent("Visual: warm illustrated care loop");
    expect(screen.getByTestId("marketing-content-template-design-brief-instagram-trust-carousel")).toHaveTextContent("Slides: What changed today?");
    expect(screen.getByTestId("marketing-content-template-design-brief-tiktok-feature-demo")).toHaveTextContent("Layout: short-video-demo");
    expect(screen.getByTestId("marketing-content-template-design-brief-tiktok-feature-demo")).toHaveTextContent("Beats: hook / screen demo");
    expect(screen.getByTestId("marketing-recommended-launch-kit")).toHaveTextContent("Recommended launch kit");
    expect(screen.getByTestId("marketing-recommended-launch-kit")).toHaveTextContent("starter templates");
    expect(screen.getByTestId("marketing-recommended-launch-kit")).toHaveTextContent("AI command ready");
    expect(screen.getByTestId("marketing-template-pathfinder")).toHaveTextContent("Activate families");
    expect(screen.getByTestId("marketing-template-pathfinder")).toHaveTextContent("Build provider referrals");
    expect(screen.getByTestId("marketing-template-command-queue")).toHaveTextContent("Template command queue");
    expect(screen.getByTestId("button-marketing-template-command-recommended-kit")).toHaveTextContent("Create recommended launch kit");
    expect(screen.getByTestId("button-marketing-template-command-customize-kit")).toHaveTextContent("Customize in studio");
    expect(screen.getByTestId("button-marketing-template-command-generate-pack")).toHaveTextContent("Grow template library");
    expect(screen.getByTestId("button-marketing-template-command-pathfinder")).toHaveTextContent("Use pathfinder route");
    expect(screen.getByTestId("button-marketing-template-command-matchmaker")).toHaveTextContent("Use best-fit template");
    expect(screen.getByTestId("marketing-template-path-family-activation")).toHaveTextContent("Family onboarding");
    expect(screen.getByTestId("marketing-template-path-provider-growth")).toHaveTextContent("Clinic and pharmacy referral");
    fireEvent.click(screen.getByTestId("button-marketing-template-path-open-family-activation"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing pathfinder route: Activate families");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Clinic referral intro email");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));
    expect(screen.getByTestId("marketing-template-packs")).toHaveTextContent("Family onboarding");
    expect(screen.getByTestId("marketing-template-pack-caregiver-invite-activation")).toHaveTextContent("Caregiver invite activation");
    expect(screen.getByTestId("marketing-template-pack-caregiver-invite-activation")).toHaveTextContent("7 templates");
    expect(screen.getByTestId("marketing-template-pack-caregiver-invite-activation")).toHaveTextContent("AI pack prompt");
    expect(screen.getByTestId("marketing-template-pack-caregiver-invite-activation")).toHaveTextContent("Print / direct mail");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-caregiver-invite-activation"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Caregiver invite activation template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Caregiver invite acceptance email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Caregiver invite WhatsApp reminder");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Caregiver invite SMS reminder");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn caregiver access partner note");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Clinic referral intro email");
    expect(screen.getByTestId("marketing-template-pack-sequence-caregiver-invite-activation")).toHaveTextContent("Accept access");
    expect(screen.getByTestId("marketing-template-pack-sequence-caregiver-invite-activation")).toHaveTextContent("Partner workflow");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-ai-caregiver-invite-activation"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Caregiver invite activation"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Caregiver invite acceptance email"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Caregiver invite activation AI command copied.");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-caregiver-invite-activation"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Caregiver invite activation");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Caregiver invite activation pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-monthly-care-digest")).toHaveTextContent("Monthly care digest");
    expect(screen.getByTestId("marketing-template-pack-monthly-care-digest")).toHaveTextContent("7 templates");
    expect(screen.getByTestId("marketing-template-pack-monthly-care-digest")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-ai-monthly-care-digest"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA template pack AI command"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Monthly care digest"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Available templates:"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("AI task: Adapt this pack into a polished, publish-ready campaign plan."));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Monthly care digest AI command copied.");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-monthly-care-digest"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Monthly care digest template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Monthly care digest email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Monthly care check-in WhatsApp");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn monthly care operations note");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok monthly care snapshot script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable monthly care summary card");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-monthly-care-digest")).toHaveTextContent("Family digest");
    expect(screen.getByTestId("marketing-template-pack-sequence-monthly-care-digest")).toHaveTextContent("Partner operations note");
    expect(screen.getByTestId("marketing-template-pack-sequence-monthly-care-digest")).toHaveTextContent("Short care snapshot");
    expect(screen.getByTestId("marketing-template-pack-sequence-monthly-care-digest")).toHaveTextContent("Family review card");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-monthly-care-digest"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Monthly care digest");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Monthly care digest pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-start-monthly-care-digest"));
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Monthly care digest email campaign");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2c");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign starter applied from \"Monthly care digest email\"");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Campaign starter applied from Monthly care digest");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-care-transition-support")).toHaveTextContent("Care transition support");
    expect(screen.getByTestId("marketing-template-pack-care-transition-support")).toHaveTextContent("7 templates");
    expect(screen.getByTestId("marketing-template-pack-care-transition-support")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-care-transition-support"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Care transition support template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Care transition checklist email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Care transition phone follow-up script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable care transition handoff");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-care-transition-support")).toHaveTextContent("Transition checklist");
    expect(screen.getByTestId("marketing-template-pack-sequence-care-transition-support")).toHaveTextContent("Follow-up call");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-care-transition-support"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Care transition support");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Care transition support pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-family-referral-ambassador")).toHaveTextContent("Family referral ambassador");
    expect(screen.getByTestId("marketing-template-pack-family-referral-ambassador")).toHaveTextContent("8 templates");
    expect(screen.getByTestId("marketing-template-pack-family-referral-ambassador")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-family-referral-ambassador"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Family referral ambassador template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Family referral ask email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Family referral WhatsApp forward");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Family referral call script");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-family-referral-ambassador")).toHaveTextContent("Warm referral ask");
    expect(screen.getByTestId("marketing-template-pack-sequence-family-referral-ambassador")).toHaveTextContent("Referral card");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-family-referral-ambassador"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Family referral ambassador");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Family referral ambassador pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-seasonal-wellbeing-check")).toHaveTextContent("Seasonal wellbeing check");
    expect(screen.getByTestId("marketing-template-pack-seasonal-wellbeing-check")).toHaveTextContent("8 templates");
    expect(screen.getByTestId("marketing-template-pack-seasonal-wellbeing-check")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-seasonal-wellbeing-check"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Seasonal wellbeing check template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Seasonal wellbeing check-in email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Seasonal WhatsApp check-in");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Seasonal wellbeing phone check script");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-seasonal-wellbeing-check")).toHaveTextContent("Family check-in");
    expect(screen.getByTestId("marketing-template-pack-sequence-seasonal-wellbeing-check")).toHaveTextContent("Human check");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-seasonal-wellbeing-check"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Seasonal wellbeing check");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Seasonal wellbeing check pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-trust-and-review")).toHaveTextContent("Trust and review");
    expect(screen.getByTestId("marketing-template-pack-trust-and-review")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-trust-and-review"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Trust and review template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Trust review request email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Instagram trust carousel");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-trust-and-review")).toHaveTextContent("Ask for one moment");
    expect(screen.getByTestId("marketing-template-pack-sequence-trust-and-review")).toHaveTextContent("Partner proof");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-trust-and-review"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Trust and review");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Trust and review pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));
    expect(screen.getByTestId("marketing-template-pack-local-event-relationship")).toHaveTextContent("Local event relationship");
    expect(screen.getByTestId("marketing-template-pack-local-event-relationship")).toHaveTextContent("6 templates");
    expect(screen.getByTestId("marketing-template-pack-local-event-relationship")).toHaveTextContent("AI pack prompt");
    expect(screen.getByTestId("marketing-template-pack-local-event-operations")).toHaveTextContent("Local event operations");
    expect(screen.getByTestId("marketing-template-pack-local-event-operations")).toHaveTextContent("9 templates");
    expect(screen.getByTestId("marketing-template-pack-local-event-operations")).toHaveTextContent("AI pack prompt");
    expect(screen.getByTestId("marketing-template-pack-offline-direct-outreach")).toHaveTextContent("Offline and direct outreach");
    expect(screen.getByTestId("marketing-template-pack-offline-direct-outreach")).toHaveTextContent("4 templates");
    expect(screen.getByTestId("marketing-template-pack-offline-direct-outreach")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-local-event-relationship"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Local event relationship template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Local event invite email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn community partner invite");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok event day script");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-local-event-relationship")).toHaveTextContent("Public local invite");
    expect(screen.getByTestId("marketing-template-pack-sequence-local-event-relationship")).toHaveTextContent("Partner handoff");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-local-event-relationship"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("uplifting");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Local event relationship");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Local event relationship pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-local-event-operations"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Local event operations template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Neighbourhood event run sheet");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Partner event confirmation SMS");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Partner event follow-up log");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn family event recap");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-local-event-operations")).toHaveTextContent("Run sheet");
    expect(screen.getByTestId("marketing-template-pack-sequence-local-event-operations")).toHaveTextContent("Partner follow-up");
    expect(screen.getByTestId("marketing-template-pack-sequence-local-event-operations")).toHaveTextContent("Family recap");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-local-event-operations"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("event");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("direct");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Local event operations");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Local event operations pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-offline-direct-outreach"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Offline and direct outreach template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("SMS local event reminder");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Phone partner follow-up script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Community flyer copy");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Local event host handoff brief");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-offline-direct-outreach")).toHaveTextContent("Print handoff");
    expect(screen.getByTestId("marketing-template-pack-sequence-offline-direct-outreach")).toHaveTextContent("Host handoff");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-offline-direct-outreach"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("event");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("direct");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Offline and direct outreach");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-campaign-studio-publish-queue-phone")).toHaveTextContent("Call queue or concierge handoff");
    expect(screen.getByTestId("marketing-campaign-studio-publish-queue-print")).toHaveTextContent("Print vendor, venue, clinic, pharmacy, or local partner");
    expect(screen.getByTestId("marketing-campaign-studio-publish-queue-event")).toHaveTextContent("Venue, host, partner team, or community calendar");
    expect(screen.getByTestId("marketing-campaign-studio-publishing-route-event")).toHaveTextContent("Local event run sheet");
    expect(screen.getByTestId("marketing-campaign-studio-publishing-route-event")).toHaveTextContent("Event / local ops");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Offline and direct outreach pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-care-confidence-reactivation")).toHaveTextContent("Care confidence reactivation");
    expect(screen.getByTestId("marketing-template-pack-care-confidence-reactivation")).toHaveTextContent("6 templates");
    expect(screen.getByTestId("marketing-template-pack-care-confidence-reactivation")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-care-confidence-reactivation"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Care confidence reactivation template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Care confidence reactivation email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn care confidence partner note");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok care confidence reset script");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-care-confidence-reactivation")).toHaveTextContent("Restart routine");
    expect(screen.getByTestId("marketing-template-pack-sequence-care-confidence-reactivation")).toHaveTextContent("Partner workflow note");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-care-confidence-reactivation"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Care confidence reactivation");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Care confidence reactivation pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-routine-activation")).toHaveTextContent("Routine activation");
    expect(screen.getByTestId("marketing-template-pack-routine-activation")).toHaveTextContent("6 templates");
    expect(screen.getByTestId("marketing-template-pack-routine-activation")).toHaveTextContent("AI pack prompt");
    expect(screen.getByTestId("marketing-template-pack-routine-activation")).toHaveTextContent("SMS");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-routine-activation"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Routine activation template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Daily routine activation email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Routine activation WhatsApp nudge");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Routine reminder SMS");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok routine demo script");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-routine-activation")).toHaveTextContent("Opted-in reminder");
    expect(screen.getByTestId("marketing-template-pack-sequence-routine-activation")).toHaveTextContent("Short demo");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-ai-routine-activation"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Routine activation"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Routine reminder SMS"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Routine activation AI command copied.");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-routine-activation"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Routine activation");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Routine activation pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-premium-family-upgrade")).toHaveTextContent("Premium family upgrade");
    expect(screen.getByTestId("marketing-template-pack-premium-family-upgrade")).toHaveTextContent("6 templates");
    expect(screen.getByTestId("marketing-template-pack-premium-family-upgrade")).toHaveTextContent("AI pack prompt");
    expect(screen.getByTestId("marketing-template-pack-premium-family-upgrade")).toHaveTextContent("Print / direct mail");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-premium-family-upgrade"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Premium family upgrade template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Premium family plan email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Premium family WhatsApp nudge");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn Premium care operations note");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-premium-family-upgrade")).toHaveTextContent("Premium value story");
    expect(screen.getByTestId("marketing-template-pack-sequence-premium-family-upgrade")).toHaveTextContent("One-page handoff");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-ai-premium-family-upgrade"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Premium family upgrade"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Premium family plan email"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Premium family upgrade AI command copied.");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-premium-family-upgrade"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Premium family upgrade");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Premium family upgrade pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-home-care-agency-outreach")).toHaveTextContent("Home care agency outreach");
    expect(screen.getByTestId("marketing-template-pack-home-care-agency-outreach")).toHaveTextContent("7 templates");
    expect(screen.getByTestId("marketing-template-pack-home-care-agency-outreach")).toHaveTextContent("AI pack prompt");
    expect(screen.getByTestId("marketing-template-pack-home-care-agency-outreach")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-template-pack-home-care-agency-outreach")).toHaveTextContent("Print / direct mail");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-home-care-agency-outreach"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Home care agency outreach template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Home care agency intro email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn home care agency operations post");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Home care agency intro call script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable home care agency one-pager");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-home-care-agency-outreach")).toHaveTextContent("Agency intro");
    expect(screen.getByTestId("marketing-template-pack-sequence-home-care-agency-outreach")).toHaveTextContent("Intro call");
    expect(screen.getByTestId("marketing-template-pack-sequence-home-care-agency-outreach")).toHaveTextContent("Agency roundtable");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-ai-home-care-agency-outreach"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Home care agency outreach"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Home care agency intro email"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Home care agency outreach AI command copied.");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-home-care-agency-outreach"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Home care agency outreach");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Home care agency outreach pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-care-home-residence-outreach")).toHaveTextContent("Care home residence outreach");
    expect(screen.getByTestId("marketing-template-pack-care-home-residence-outreach")).toHaveTextContent("7 templates");
    expect(screen.getByTestId("marketing-template-pack-care-home-residence-outreach")).toHaveTextContent("AI pack prompt");
    expect(screen.getByTestId("marketing-template-pack-care-home-residence-outreach")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-template-pack-care-home-residence-outreach")).toHaveTextContent("Print / direct mail");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-care-home-residence-outreach"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Care home residence outreach template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Care home residence intro email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn care home residence director post");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Care home residence director call script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Printable care home residence one-pager");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-care-home-residence-outreach")).toHaveTextContent("Residence intro");
    expect(screen.getByTestId("marketing-template-pack-sequence-care-home-residence-outreach")).toHaveTextContent("Director call");
    expect(screen.getByTestId("marketing-template-pack-sequence-care-home-residence-outreach")).toHaveTextContent("Residence briefing");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-ai-care-home-residence-outreach"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Care home residence outreach"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Care home residence intro email"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Care home residence outreach AI command copied.");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-care-home-residence-outreach"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Care home residence outreach");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Care home residence outreach pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-clinic-pharmacy-referral")).toHaveTextContent("Clinic and pharmacy referral");
    expect(screen.getByTestId("marketing-template-pack-clinic-pharmacy-referral")).toHaveTextContent("6 templates");
    expect(screen.getByTestId("marketing-template-pack-clinic-pharmacy-referral")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-clinic-pharmacy-referral"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Clinic and pharmacy referral template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Clinic referral intro email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("WhatsApp pharmacy care pathway nudge");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("TikTok referral pathway explainer script");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-clinic-pharmacy-referral")).toHaveTextContent("Referral intro");
    expect(screen.getByTestId("marketing-template-pack-sequence-clinic-pharmacy-referral")).toHaveTextContent("Pharmacy nudge");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-clinic-pharmacy-referral"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Clinic and pharmacy referral");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Clinic and pharmacy referral pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-professional-referral-webinar")).toHaveTextContent("Professional referral webinar");
    expect(screen.getByTestId("marketing-template-pack-professional-referral-webinar")).toHaveTextContent("7 templates");
    expect(screen.getByTestId("marketing-template-pack-professional-referral-webinar")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-professional-referral-webinar"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Professional referral webinar template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Professional webinar invitation email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Professional webinar LinkedIn post");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Professional webinar run sheet");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-professional-referral-webinar")).toHaveTextContent("Professional invite");
    expect(screen.getByTestId("marketing-template-pack-sequence-professional-referral-webinar")).toHaveTextContent("Host run sheet");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-professional-referral-webinar"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Professional referral webinar");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Professional referral webinar pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-post-webinar-relationship-follow-up")).toHaveTextContent("Post-webinar relationship follow-up");
    expect(screen.getByTestId("marketing-template-pack-post-webinar-relationship-follow-up")).toHaveTextContent("7 templates");
    expect(screen.getByTestId("marketing-template-pack-post-webinar-relationship-follow-up")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-post-webinar-relationship-follow-up"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Post-webinar relationship follow-up template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Post-webinar recap email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Post-webinar discovery call script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Post-webinar follow-up log");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-post-webinar-relationship-follow-up")).toHaveTextContent("Recap and resource");
    expect(screen.getByTestId("marketing-template-pack-sequence-post-webinar-relationship-follow-up")).toHaveTextContent("Follow-up log");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-post-webinar-relationship-follow-up"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Post-webinar relationship follow-up");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Post-webinar relationship follow-up pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-full-channel-launch-announcement")).toHaveTextContent("Full-channel launch announcement");
    expect(screen.getByTestId("marketing-template-pack-full-channel-launch-announcement")).toHaveTextContent("10 templates");
    expect(screen.getByTestId("marketing-template-pack-full-channel-launch-announcement")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-full-channel-launch-announcement"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Full-channel launch announcement template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Full-channel launch email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Full-channel launch phone script");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Full-channel launch TikTok script");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-full-channel-launch-announcement")).toHaveTextContent("Primary email");
    expect(screen.getByTestId("marketing-template-pack-sequence-full-channel-launch-announcement")).toHaveTextContent("Team briefing");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-ai-full-channel-launch-announcement"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Full-channel launch announcement"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Full-channel launch email"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Full-channel launch announcement AI command copied.");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-full-channel-launch-announcement"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("uplifting");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Full-channel launch announcement");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Full-channel launch announcement pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-press-partner-announcement")).toHaveTextContent("Press and partner announcement");
    expect(screen.getByTestId("marketing-template-pack-press-partner-announcement")).toHaveTextContent("6 templates");
    expect(screen.getByTestId("marketing-template-pack-press-partner-announcement")).toHaveTextContent("AI pack prompt");
    expect(screen.getByTestId("marketing-template-pack-press-partner-announcement")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-template-pack-press-partner-announcement")).toHaveTextContent("Print / direct mail");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-press-partner-announcement"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Press and partner announcement template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Press and partner announcement email");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("LinkedIn press partner announcement");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Press partner briefing run sheet");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-press-partner-announcement")).toHaveTextContent("Media pitch");
    expect(screen.getByTestId("marketing-template-pack-sequence-press-partner-announcement")).toHaveTextContent("Briefing session");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-copy-ai-press-partner-announcement"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Pack: Press and partner announcement"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Press and partner announcement email"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Press and partner announcement AI command copied.");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-press-partner-announcement"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Press and partner announcement");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Press and partner announcement pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));

    expect(screen.getByTestId("marketing-template-pack-partner-growth")).toHaveTextContent("Partner growth");
    expect(screen.getByTestId("marketing-template-pack-partner-growth")).toHaveTextContent("AI pack prompt");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-partner-growth"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing Partner growth template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("Partner demo LinkedIn post");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("WhatsApp partner proof nudge");
    expect(screen.getByTestId("marketing-content-template-gallery")).not.toHaveTextContent("Caregiver welcome email");
    expect(screen.getByTestId("marketing-template-pack-sequence-partner-growth")).toHaveTextContent("Partner proof post");
    expect(screen.getByTestId("marketing-template-pack-sequence-partner-growth")).toHaveTextContent("Proof nudge");
    expect(screen.getByTestId("marketing-template-pack-sequence-partner-growth")).toHaveTextContent("Referral ask");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-studio-partner-growth"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Partner growth");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Loaded Partner growth pack into the campaign studio");
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-start-partner-growth"));
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Partner demo LinkedIn post campaign");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign starter applied from \"Partner demo LinkedIn post\"");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Campaign starter applied from Partner growth");
    fireEvent.click(screen.getByTestId("button-marketing-clear-template-filters"));
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("25");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("10");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("TikTok");
    expect(screen.getByTestId("marketing-template-coverage")).toHaveTextContent("9");
    expect(screen.getByTestId("marketing-template-coverage-matrix")).toHaveTextContent("Channel x audience matrix");
    expect(screen.getByTestId("marketing-template-coverage-matrix")).toHaveTextContent("Target: 3 per pack");
    expect(screen.getByTestId("button-marketing-template-matrix-event-b2c")).toHaveTextContent("4");
    expect(screen.getByTestId("button-marketing-template-matrix-event-b2c")).toHaveTextContent("Strong");
    expect(screen.getByTestId("button-marketing-template-matrix-sms-b2b")).toHaveTextContent("6");
    expect(screen.getByTestId("button-marketing-template-matrix-sms-b2b")).toHaveTextContent("Strong");
    expect(screen.getByTestId("button-marketing-template-matrix-linkedin-b2c")).toHaveTextContent("4");
    expect(screen.getByTestId("button-marketing-template-matrix-linkedin-b2c")).toHaveTextContent("Strong");
    fireEvent.click(screen.getByTestId("button-marketing-template-matrix-whatsapp-b2b"));
    expect(screen.getByTestId("select-marketing-template-channel")).toHaveValue("whatsapp");
    expect(screen.getByTestId("select-marketing-template-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing WhatsApp B2B template pack");
    expect(screen.getByTestId("marketing-content-template-gallery")).toHaveTextContent("WhatsApp partner proof nudge");
    expect(screen.getByTestId("marketing-template-gap-suggestions")).toHaveTextContent("Template coverage is balanced");
    expect(screen.getByTestId("marketing-template-gap-autopilot")).toHaveTextContent("AI coverage autopilot");
    expect(screen.getByTestId("marketing-template-gap-autopilot")).toHaveTextContent("Coverage is balanced. Expand the library.");
    expect(screen.getByTestId("marketing-template-gap-autopilot")).toHaveTextContent("Next batch: 4 AI drafts");
    expect(screen.getByTestId("marketing-template-gap-autopilot-batch")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-template-gap-autopilot-batch")).toHaveTextContent("4/3+");
    expect(screen.getByTestId("marketing-template-gap-autopilot-brief")).toHaveTextContent("AI pack brief");
    const templateGapBrief = screen.getByTestId("textarea-marketing-template-gap-autopilot-brief") as HTMLTextAreaElement;
    expect(templateGapBrief.value).toContain("VYVA template coverage AI pack brief");
    expect(templateGapBrief.value).toContain("Mode: library expansion");
    expect(templateGapBrief.value).toContain("Draft requirements:");
    expect(templateGapBrief.value).toContain("Local event");
    fireEvent.click(screen.getByTestId("button-marketing-template-gap-autopilot-copy-brief"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA template coverage AI pack brief"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Next operator action: generate the pack"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Template coverage AI pack brief copied.");
    expect(screen.getByTestId("button-marketing-template-gap-autopilot-generate")).toHaveTextContent("Generate next pack");
    expect(screen.getByTestId("button-marketing-template-gap-autopilot-generate")).not.toBeDisabled();
    expect(screen.getByTestId("button-marketing-template-gap-autopilot-studio")).toHaveTextContent("Open next expansion in studio");
    expect(screen.getByTestId("button-marketing-template-gap-autopilot-studio")).not.toBeDisabled();
    expect(screen.queryByTestId("marketing-template-gap-pack")).not.toBeInTheDocument();

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
  }, 60000);

  it("creates saved content assets from a curated template pack", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-create-assets-monthly-care-digest"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Creating 5 Monthly care digest content assets");

    await waitFor(() => {
      const contentPosts = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
      expect(contentPosts).toHaveLength(5);
    });

    const contentPosts = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    const postBodies = contentPosts.map(([, init]) => JSON.parse(String(init?.body ?? "{}")));
    expect(postBodies[0]).toMatchObject({
      title: "Monthly care digest email",
      channel: "email",
      source: "vyva",
      lovableExternalId: null,
      metadata: expect.objectContaining({
        generatedFrom: "template_pack",
        packId: "monthly-care-digest",
        packTitle: "Monthly care digest",
        templateTitle: "Monthly care digest email",
        studioPlayId: "monthly-care-digest",
        tone: "warm",
        angle: "proof",
      }),
    });
    expect(new Set(postBodies.map((body) => body.metadata.templateId)).size).toBe(5);
    expect(postBodies.some((body) => body.channel === "whatsapp")).toBe(true);
    expect(postBodies.every((body) => typeof body.metadata.aiPrompt === "string" && body.metadata.aiPrompt.length > 20)).toBe(true);

    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Created 5 Monthly care digest content assets");
    });
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("First asset opened for review.");
    expect(screen.getByTestId("marketing-content-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Monthly care digest email");
    expect((screen.getByTestId("textarea-marketing-edit-content-metadata") as HTMLTextAreaElement).value).toContain("template_pack");
  });

  it("creates a reviewable campaign plan from a curated template pack", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    expect(screen.getByTestId("marketing-template-pack-partner-growth")).toHaveTextContent("Best next action");
    expect(screen.getByTestId("button-marketing-template-pack-create-campaign-partner-growth")).toHaveTextContent("Create full launch kit");

    fireEvent.click(screen.getByTestId("button-marketing-template-pack-create-campaign-partner-growth"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Creating Partner growth campaign plan");

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns", expect.objectContaining({ method: "POST" }));
    });

    const contentPosts = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    expect(contentPosts).toHaveLength(7);
    const contentBodies = contentPosts.map(([, init]) => JSON.parse(String(init?.body ?? "{}")));
    expect(contentBodies[0]).toMatchObject({
      title: "Partner demo LinkedIn post",
      channel: "linkedin",
      source: "vyva",
      lovableExternalId: null,
      metadata: expect.objectContaining({
        generatedFrom: "template_pack_campaign_plan",
        packId: "partner-growth",
        packTitle: "Partner growth",
        templateId: "linkedin-partner-demo",
        studioPlayId: "b2b-partner-outreach",
      }),
    });
    expect(new Set(contentBodies.map((body) => body.metadata.templateId)).size).toBe(7);

    const campaignPost = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/campaigns" && init?.method === "POST");
    const campaignPayload = JSON.parse(String(campaignPost?.[1]?.body ?? "{}"));
    expect(campaignPayload).toMatchObject({
      name: "Partner growth campaign plan",
      audienceType: "b2b",
      status: "draft",
      metadata: {
        targetAudienceId: "audience-1",
        audienceExternalId: "lovable-audience-1",
        templatePackPlan: expect.objectContaining({
          generatedFrom: "template_pack_campaign_plan",
          packId: "partner-growth",
          routeChannels: ["linkedin", "whatsapp", "email", "facebook"],
          launchPacket: expect.objectContaining({
            version: 1,
            generatedFrom: "template_pack_campaign_plan",
            packTitle: "Partner growth",
            routeSummary: expect.stringContaining("4 planned recipient routes"),
            channels: expect.arrayContaining([
              expect.objectContaining({
                channel: "linkedin",
                channelLabel: "LinkedIn",
                contentTitle: "Partner demo LinkedIn post",
                sendMode: "Manual social publishing/tracking",
                owner: "Social/content owner",
                recipientCount: 1,
              }),
              expect.objectContaining({
                channel: "email",
                channelLabel: "Email",
                sendMode: "VYVA email review/send",
                nextAction: expect.stringContaining("send a test"),
              }),
            ]),
            reviewChecklist: expect.arrayContaining([
              "Review every linked content asset before launch.",
              "Log outcomes so follow-up campaigns can use real relationship signals.",
            ]),
            visualBriefs: expect.arrayContaining([
              expect.objectContaining({ key: "hero", title: "Campaign hero" }),
              expect.objectContaining({ key: "social", title: "Social creative set" }),
            ]),
            followUpPlays: expect.arrayContaining([
              expect.objectContaining({ key: "reply", trigger: "Reply, comment, or WhatsApp response" }),
            ]),
            outcomeTrackers: expect.arrayContaining([
              expect.objectContaining({ key: "response", metric: "Replies, clicks, and social engagement" }),
            ]),
          }),
        }),
      },
    });
    expect(campaignPayload.objective).toContain("Open and nurture B2B relationships");
    expect(campaignPayload.objective).toContain("Review note: this creates a draft plan only");
    expect(campaignPayload.channels).toHaveLength(4);
    expect(campaignPayload.channels).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: "linkedin", contentAssetId: "content-created", status: "draft", sendCapability: "planning_only" }),
      expect.objectContaining({ channel: "whatsapp", contentAssetId: "content-created", status: "draft", sendCapability: "planning_only" }),
      expect.objectContaining({ channel: "email", contentAssetId: "content-created", status: "draft", sendCapability: "enabled" }),
      expect.objectContaining({ channel: "facebook", contentAssetId: "content-created", status: "draft", sendCapability: "planning_only" }),
    ]));
    expect(campaignPayload.recipients).toHaveLength(4);
    expect(campaignPayload.recipients[0]).toMatchObject({
      contactId: "contact-2",
      channel: "linkedin",
      status: "planned",
      snapshot: expect.objectContaining({
        templatePackId: "partner-growth",
        audienceList: expect.objectContaining({ id: "audience-1", name: "Partners" }),
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Created Partner growth campaign plan with 4 channel routes");
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("4 recipient snapshots");
    expect(screen.getByTestId("marketing-campaign-edit-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-campaign-name")).toHaveValue("Partner growth campaign plan");
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Partner growth campaign plan");
    expect(screen.getByTestId("marketing-campaign-saved-launch-packet")).toHaveTextContent("Saved launch packet");
    expect(screen.getByTestId("marketing-campaign-saved-launch-packet")).toHaveTextContent("Partner growth");
    expect(screen.getByTestId("marketing-campaign-saved-launch-checklist")).toHaveTextContent("Launch checklist");
    expect(screen.getByTestId("marketing-campaign-saved-launch-checklist")).toHaveTextContent("Email send");
    expect(screen.getByTestId("marketing-campaign-saved-launch-checklist")).toHaveTextContent("Manual handoff");
    expect(screen.getByTestId("marketing-campaign-saved-launch-checklist")).toHaveTextContent("Follow-up");
    expect(screen.getByTestId("button-marketing-copy-saved-launch-checklist")).toHaveTextContent("Copy checklist");
    expect(screen.getByTestId("marketing-campaign-saved-launch-packet-routes")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-saved-launch-packet-routes")).toHaveTextContent("VYVA email review/send");
    expect((screen.getByTestId("textarea-marketing-campaign-saved-launch-packet") as HTMLTextAreaElement).value).toContain("VYVA saved launch packet");
    expect((screen.getByTestId("textarea-marketing-campaign-saved-launch-packet") as HTMLTextAreaElement).value).toContain("Follow-up plays:");
  });

  it("loads template packs into editable journey drafts with visible sequence steps", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-template-pack-journey-partner-growth"));

    expect(screen.getByTestId("marketing-journey-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-journey-name")).toHaveValue("Partner growth journey");
    expect(screen.getByTestId("select-marketing-edit-journey-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-edit-journey-status")).toHaveValue("draft");
    expect(screen.getByTestId("select-marketing-edit-journey-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("input-marketing-edit-journey-trigger")).toHaveValue("list_joined");
    expect(screen.getByTestId("input-marketing-edit-journey-goal")).toHaveValue("reply");
    expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Loaded Partner growth journey");
    expect(screen.getByTestId("marketing-journey-steps-builder")).toHaveTextContent("Partner proof post");
    expect(screen.getByTestId("marketing-journey-steps-builder")).toHaveTextContent("Proof nudge");
    expect(screen.getByTestId("marketing-journey-steps-builder")).toHaveTextContent("Referral ask");
    expect(screen.getByTestId("select-marketing-journey-step-channel-0")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-journey-step-channel-1")).toHaveValue("whatsapp");
    expect(screen.getByTestId("select-marketing-journey-step-channel-2")).toHaveValue("email");
    expect(screen.getByTestId("input-marketing-journey-step-delay-0")).toHaveValue(0);
    expect(screen.getByTestId("input-marketing-journey-step-delay-1")).toHaveValue(48);
    expect(screen.getByTestId("input-marketing-journey-step-delay-2")).toHaveValue(120);
    expect((screen.getByTestId("textarea-marketing-edit-journey-metadata") as HTMLTextAreaElement).value).toContain("partner-growth");
    expect((screen.getByTestId("textarea-marketing-journey-step-config-0") as HTMLTextAreaElement).value).toContain("template_pack");
    expect((screen.getByTestId("textarea-marketing-journey-step-config-0") as HTMLTextAreaElement).value).toContain("linkedin-partner-demo");
    expect(screen.getByTestId("marketing-journey-sequence-run-sheet")).toHaveTextContent("Sequence run sheet");
    expect(screen.getByTestId("marketing-journey-sequence-run-sheet")).toHaveTextContent("3 steps");
    expect(screen.getByTestId("marketing-journey-sequence-run-sheet")).toHaveTextContent("LinkedIn, WhatsApp, and Email");
    const journeyRunSheet = screen.getByTestId("textarea-marketing-journey-sequence-run-sheet") as HTMLTextAreaElement;
    expect(journeyRunSheet.value).toContain("VYVA journey sequence run sheet");
    expect(journeyRunSheet.value).toContain("Journey: Partner growth journey");
    expect(journeyRunSheet.value).toContain("1. message via LinkedIn after immediately");
    expect(journeyRunSheet.value).toContain("3. message via Email after 120h / day 5");
    expect(journeyRunSheet.value).toContain("AI task:");
    const journeyRunSheetClipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: journeyRunSheetClipboard },
    });
    fireEvent.click(screen.getByTestId("button-marketing-copy-journey-sequence-run-sheet"));
    await waitFor(() => {
      expect(journeyRunSheetClipboard).toHaveBeenCalledWith(expect.stringContaining("VYVA journey sequence run sheet"));
    });
    expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Journey sequence run sheet copied.");
    expect(screen.getByTestId("button-marketing-draft-journey-step-content")).toHaveTextContent("Draft 3 missing content");

    fireEvent.click(screen.getByTestId("button-marketing-draft-journey-step-content"));
    expect(screen.getByTestId("button-marketing-draft-journey-step-content")).toHaveTextContent("Drafting");
    await waitFor(() => {
      expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Drafted and linked 3 content assets");
    });
    expect(screen.getByTestId("button-marketing-draft-journey-step-content")).toHaveTextContent("All content linked");
    const journeyStepAiCalls = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    const journeyStepContentPosts = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    expect(journeyStepAiCalls).toHaveLength(3);
    expect(journeyStepContentPosts).toHaveLength(3);
    expect(JSON.parse(String(journeyStepAiCalls[0]?.[1]?.body ?? "{}"))).toMatchObject({
      playLabel: "Partner growth journey",
      playCategory: "journey",
      audienceType: "b2b",
      channel: "linkedin",
      targetAudienceName: "Partners",
    });
    expect(JSON.parse(String(journeyStepContentPosts[0]?.[1]?.body ?? "{}"))).toMatchObject({
      channel: "linkedin",
      status: "draft",
      source: "vyva",
      metadata: { generatedFrom: "journey_step_ai", journeyName: "Partner growth journey", stepIndex: 0 },
    });
    expect(screen.getByTestId("select-marketing-journey-step-content-0")).toHaveValue("content-created");
    expect((screen.getByTestId("textarea-marketing-journey-step-config-0") as HTMLTextAreaElement).value).toContain("generatedContentAssetId");

    fireEvent.click(screen.getByTestId("button-marketing-save-journey"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys", expect.objectContaining({ method: "POST" }));
    });
    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/journeys" && init?.method === "POST");
    const payload = JSON.parse(String(postCall?.[1]?.body));
    expect(payload).toMatchObject({
      name: "Partner growth journey",
      audienceType: "b2b",
      status: "draft",
      triggerType: "list_joined",
      triggerConfig: {
        source: "template_pack",
        packId: "partner-growth",
        targetAudienceId: "audience-1",
      },
      goalType: "reply",
      goalConfig: {
        source: "template_pack",
        packId: "partner-growth",
        suggestedReviewDays: 14,
      },
    });
    expect(payload.steps).toHaveLength(3);
    expect(payload.steps[0]).toMatchObject({
      stepOrder: 0,
      channel: "linkedin",
      contentAssetId: "content-created",
      delayHours: 0,
      dayOffset: 0,
      templateKind: "content_asset",
      templateRef: "content-created",
      config: { source: "template_pack", packId: "partner-growth", sequenceOffset: "Day 0", generatedContentAssetId: "content-created" },
    });
    expect(payload.steps[1]).toMatchObject({ channel: "whatsapp", contentAssetId: "content-created", delayHours: 48, dayOffset: 2, templateRef: "content-created" });
    expect(payload.steps[2]).toMatchObject({ channel: "email", contentAssetId: "content-created", delayHours: 120, dayOffset: 5, templateRef: "content-created" });
  });

  it("recommends best-fit templates and starts a campaign from the matchmaker", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    const matchmaker = within(screen.getByTestId("marketing-template-matchmaker"));
    expect(matchmaker.getByText("Caregiver welcome email")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-template-match-caregiver-email-welcome")).toHaveTextContent("1 reachable via Email");
    expect(screen.getByTestId("marketing-template-matchmaker-brief")).toHaveTextContent("Recommended starter");
    expect(screen.getByTestId("marketing-template-matchmaker-brief")).toHaveTextContent("Caregiver education mini-guide");
    expect(screen.getByTestId("marketing-template-matchmaker-brief")).toHaveTextContent("1 reachable via Email");
    expect(screen.getByTestId("marketing-template-selection-coach")).toHaveTextContent("Use this first");
    expect(screen.getByTestId("marketing-template-selection-coach")).toHaveTextContent("Ready now");
    fireEvent.click(screen.getByTestId("button-marketing-matchmaker-copy-selection-brief"));
    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA template selection brief")));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Use first: Caregiver education mini-guide"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Template selection brief copied.");

    fireEvent.click(screen.getByTestId("button-marketing-matchmaker-use-best"));
    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Caregiver education mini-guide");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Template applied: Caregiver education mini-guide");

    fireEvent.change(screen.getByTestId("select-marketing-template-channel"), { target: { value: "linkedin" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-audience"), { target: { value: "b2b" } });
    fireEvent.change(screen.getByTestId("select-marketing-template-category"), { target: { value: "B2B partner" } });

    const filteredMatchmaker = within(screen.getByTestId("marketing-template-matchmaker"));
    expect(filteredMatchmaker.getByText("Partner demo LinkedIn post")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-template-match-linkedin-partner-demo")).toHaveTextContent("1 reachable via LinkedIn");
    expect(screen.getByTestId("marketing-template-matchmaker-brief")).toHaveTextContent("Partner demo LinkedIn post");
    expect(screen.getByTestId("marketing-template-matchmaker-brief")).toHaveTextContent("Pack: Partner growth");

    fireEvent.click(screen.getByTestId("button-marketing-matchmaker-start-best"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Partner demo LinkedIn post campaign");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign starter applied from \"Partner demo LinkedIn post\"");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("AI brief and channel pack are ready");
    const partnerTemplateBrief = screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement;
    expect(partnerTemplateBrief.value).toContain('Template campaign from "Partner demo LinkedIn post".');
    expect(partnerTemplateBrief.value).toContain("Audience/list: Partners.");
    expect(partnerTemplateBrief.value).toContain("Channels: LinkedIn");
    expect(partnerTemplateBrief.value).toContain("AI direction: adapt this into a polished campaign pack");
  });

  it("surfaces a recommended launch kit above the template library", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    expect(screen.getByTestId("marketing-recommended-launch-kit")).toHaveTextContent("Recommended launch kit");
    expect(screen.getByTestId("marketing-recommended-launch-kit")).toHaveTextContent("starter templates");
    expect(screen.getByTestId("marketing-recommended-launch-kit")).toHaveTextContent("AI command ready");
    expect(screen.getByTestId("marketing-recommended-launch-kit-preview")).toHaveTextContent("Before you create");
    expect(screen.getByTestId("marketing-recommended-launch-kit-preview")).toHaveTextContent("Reach");
    expect(screen.getByTestId("marketing-recommended-launch-kit-preview")).toHaveTextContent("Assets");
    expect(screen.getByTestId("marketing-recommended-launch-kit-preview")).toHaveTextContent("Email send");
    expect(screen.getByTestId("marketing-recommended-launch-kit-preview")).toHaveTextContent("Manual handoff");

    fireEvent.click(screen.getByTestId("button-marketing-recommended-launch-kit-copy-ai"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA template pack AI command"));
    });
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("AI command copied");

    fireEvent.click(screen.getByTestId("button-marketing-recommended-launch-kit-open"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Showing recommended launch kit");

    fireEvent.click(screen.getByTestId("button-marketing-recommended-launch-kit-studio"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded");
  });

  it("starts a campaign planner draft from a content template", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-start-campaign-template-caregiver-email-welcome"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Caregiver welcome email campaign");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2c");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    const templateCampaignObjective = screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement;
    expect(templateCampaignObjective.value).toContain('Template campaign from "Caregiver welcome email".');
    expect(templateCampaignObjective.value).toContain("A warm first email for a family caregiver");
    expect(templateCampaignObjective.value).toContain("AI direction: adapt this into a polished campaign pack");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign starter applied from \"Caregiver welcome email\"");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("AI brief and channel pack are ready");
    const templateCampaignBrief = screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement;
    expect(templateCampaignBrief.value).toContain('Template campaign from "Caregiver welcome email".');
    expect(templateCampaignBrief.value).toContain("Starting hook: \"Welcome to VYVA, {{first_name}}\".");
    expect(templateCampaignBrief.value).toContain("Goal: create the saved content asset");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Caregiver welcome email");
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("email");
    expect((screen.getByTestId("textarea-marketing-content-body") as HTMLTextAreaElement).value).toContain("You are now connected to {{elder_name}}'s care circle");
  });

  it("starts a campaign planner draft from a saved content asset", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-start-campaign-content-content-2"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Partner post campaign");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-campaign-content")).toHaveValue("content-2");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("checkbox-marketing-campaign-snapshot")).toBeChecked();
    expect(screen.getByTestId("marketing-campaign-draft-recipient-preview")).toHaveTextContent("1");
    expect((screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement).value).toContain('Campaign starter created from saved content asset "Partner post".');
    expect((screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement).value).toContain("CTA: Read more (https://v2.vyva.life/partners).");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent('Campaign starter loaded from "Partner post".');
    expect(screen.getByTestId("marketing-campaign-content-handoff")).toHaveTextContent("Partner post is loaded into the campaign studio.");
    expect(screen.getByTestId("marketing-campaign-content-handoff")).toHaveTextContent("Loaded from Content");
    expect(screen.getByTestId("marketing-campaign-content-handoff-summary")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-content-handoff-summary")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-content-handoff-summary")).toHaveTextContent("None");
    expect(screen.getByTestId("button-marketing-campaign-handoff-edit-content")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-campaign-handoff-preview-content"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Partner post".');
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Partner post");
  });

  it("turns previewed content into a campaign starter", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-preview-content-content-2"));

    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("button-marketing-campaign-previewed-content")).toHaveTextContent("Use in campaign");
    expect(screen.getByTestId("button-marketing-duplicate-previewed-content")).toHaveTextContent("Duplicate");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-previewed-content"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Partner post campaign");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-campaign-content")).toHaveValue("content-2");
    expect(screen.getByTestId("marketing-campaign-content-handoff")).toHaveTextContent("Partner post is loaded into the campaign studio.");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent('Campaign starter loaded from "Partner post".');
    expect(screen.getByText("Campaign starter loaded from Partner post. Review the planner, then add the campaign.")).toBeInTheDocument();
  });

  it("loads a smart campaign planner starter with audience, content, and recipients", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");

    const starterPanel = within(screen.getByTestId("marketing-campaign-planner-recipes"));
    expect(starterPanel.getByText("Partner outreach")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-planner-copilot")).toHaveTextContent("Campaign copilot");
    expect(screen.getByTestId("marketing-campaign-planner-copilot-next-action")).toHaveTextContent("Start from the best campaign");
    expect(screen.getByTestId("button-marketing-campaign-planner-copilot-action")).toHaveTextContent("Load best starter");
    expect(screen.getByTestId("marketing-campaign-planner-action-queue")).toHaveTextContent("Launch action queue");
    expect(screen.getByTestId("marketing-campaign-planner-action-queue-name")).toHaveTextContent("Name the campaign");
    expect(screen.getByTestId("button-marketing-campaign-planner-action-queue-name")).toHaveTextContent("Name campaign");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-planner-copilot-action"));

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("B2B partner introduction");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-campaign-content")).toHaveValue("content-2");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("checkbox-marketing-campaign-snapshot")).toBeChecked();
    expect(screen.getByTestId("marketing-campaign-draft-recipient-preview")).toHaveTextContent("1");
    expect(screen.getByTestId("marketing-campaign-audience-reach-preview")).toHaveTextContent("Audience reach preview");
    expect(screen.getByTestId("marketing-campaign-audience-reach-summary")).toHaveTextContent("1 reachable contact before save");
    expect(screen.getByTestId("marketing-campaign-audience-reach-preview")).toHaveTextContent("Partners is the selected list");
    expect(screen.getByTestId("marketing-campaign-audience-reach-channels")).toHaveTextContent("LinkedIn: 1");
    expect(screen.getByTestId("marketing-campaign-audience-reach-channels")).toHaveTextContent("Email: 1");
    expect(screen.getByTestId("marketing-campaign-audience-reach-consent")).toHaveTextContent("0 opted in");
    expect(screen.getByTestId("marketing-campaign-audience-reach-consent")).toHaveTextContent("1 need review");
    expect(screen.getByTestId("marketing-campaign-audience-reach-snapshot")).toHaveTextContent("1 on save");
    expect(screen.getByTestId("marketing-campaign-audience-reach-samples")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-launch-decision-title")).toHaveTextContent("Review consent before send");
    expect(screen.getByTestId("marketing-campaign-launch-decision-detail")).toHaveTextContent("do not treat this as send-ready");
    expect(screen.getByTestId("button-marketing-campaign-launch-decision")).toHaveTextContent("Review audience");
    expect(screen.getByTestId("marketing-campaign-planner-action-queue")).toHaveTextContent("What to do before this campaign goes live");
    expect(screen.getByTestId("marketing-campaign-planner-action-queue-consent")).toHaveTextContent("Review consent before send");
    expect(screen.getByTestId("marketing-campaign-planner-action-queue-consent")).toHaveTextContent("1 reachable contact need consent review");
    expect(screen.getByTestId("marketing-campaign-planner-action-queue-create")).toHaveTextContent("Review consent before send");
    expect(screen.getByTestId("button-marketing-campaign-planner-action-queue-create")).toHaveTextContent("Review audience");
    expect((screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement).value).toContain("Start a partner conversation");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Starter loaded: Partner outreach with Partner post");
    expect(screen.getByTestId("marketing-campaign-draft-readiness")).toHaveTextContent("Ready to add");
    expect(screen.getByTestId("marketing-campaign-draft-readiness-content")).toHaveTextContent("2 content assets linked across LinkedIn and Email");
    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("2/2 linked");
    expect(screen.getByTestId("marketing-campaign-channel-packs")).toHaveTextContent("2 routes");
    expect(screen.getByTestId("marketing-campaign-draft-readiness-channels")).toHaveTextContent("LinkedIn and Email");
    expect(screen.getByTestId("marketing-campaign-draft-readiness-channel")).toHaveTextContent("LinkedIn and Email will be saved for planning or manual handoff");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline")).toHaveTextContent("Launch order");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline")).toHaveTextContent("Channel-by-channel operator plan");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline-linkedin")).toHaveTextContent("1");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline-linkedin")).toHaveTextContent("Partner proof post");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline-linkedin")).toHaveTextContent("Partner owner");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline-linkedin")).toHaveTextContent("1 recipient");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline-email")).toHaveTextContent("2");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline-email")).toHaveTextContent("Primary email send");
    expect(screen.getByTestId("marketing-campaign-draft-launch-timeline-email")).toHaveTextContent("VYVA send");
    expect(screen.getByTestId("marketing-campaign-planner-copilot-next-action")).toHaveTextContent("Ready to add");
    expect(screen.getByTestId("button-marketing-campaign-planner-copilot-action")).toHaveTextContent("Add campaign");
    expect(screen.getByTestId("marketing-campaign-planner-launch-brief")).toHaveTextContent("AI launch brief");
    const launchBrief = screen.getByTestId("textarea-marketing-campaign-planner-launch-brief") as HTMLTextAreaElement;
    expect(launchBrief.value).toContain("VYVA campaign launch AI brief");
    expect(launchBrief.value).toContain("Campaign: B2B partner introduction");
    expect(launchBrief.value).toContain("Audience: B2B - Partners (1/2 mapped)");
    expect(launchBrief.value).toContain("Channels: LinkedIn and Email");
    expect(launchBrief.value).toContain("Recipients: 1 snapshotted from 1 eligible");
    expect(launchBrief.value).toContain("- LinkedIn: Partner post");
    expect(launchBrief.value).toContain("- Email: Welcome email");
    expect(launchBrief.value).toContain("AI task: Turn this into a polished launch-ready campaign pack.");
    fireEvent.click(screen.getByTestId("button-marketing-copy-campaign-planner-launch-brief"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign launch AI brief"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Channels: LinkedIn and Email"));
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign launch AI brief copied.");
    });
    fireEvent.click(screen.getByTestId("button-marketing-copy-campaign-audience-reach-brief"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign audience reach brief"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Audience/list: Partners"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("- LinkedIn: 1 reachable"));
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign audience reach brief copied.");
    });
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

    expect(screen.getByTestId("marketing-campaign-planner-copilot-next-action")).toHaveTextContent("Create missing content");
    expect(screen.getByTestId("button-marketing-campaign-planner-copilot-action")).toHaveTextContent("Create 1 missing asset");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-planner-copilot-action"));

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
    expect(screen.getByTestId("marketing-campaign-draft-readiness-content")).toHaveTextContent("1 content asset linked across Facebook");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Created and linked missing route content for Facebook.");
  });

  it("generates editable AI copy from the campaign planner", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "Partner webinar follow-up" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-audience"), { target: { value: "b2b" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-channel"), { target: { value: "linkedin" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-target-audience"), { target: { value: "audience-1" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-campaign-objective"), {
      target: { value: "Invite care providers to a practical webinar about family support." },
    });

    expect(screen.getByTestId("marketing-campaign-planner-ai-copywriter")).toHaveTextContent("AI copywriter");
    expect(screen.getByTestId("marketing-campaign-planner-ai-context")).toHaveTextContent("Partner webinar");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-planner-ai-copy"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/ai/campaign-draft", expect.objectContaining({ method: "POST" }));
    });
    const aiCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(JSON.parse(String(aiCall?.[1]?.body))).toMatchObject({
      playLabel: "Partner webinar",
      audienceType: "b2b",
      channel: "linkedin",
      tone: "expert",
      targetAudienceName: "Partners",
      campaignName: "Partner webinar follow-up",
      contentTitle: "Partner webinar follow-up LinkedIn content",
      campaignBrief: "Invite care providers to a practical webinar about family support.",
    });

    await waitFor(() => {
      expect(screen.getByTestId("input-marketing-content-title")).toHaveValue("Partner webinar AI content");
    });
    expect(screen.getByTestId("select-marketing-content-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("input-marketing-content-subject")).toHaveValue("AI subject line");
    expect(screen.getByTestId("textarea-marketing-content-body")).toHaveTextContent("AI body copy with stronger channel direction.");
    expect(screen.getByTestId("textarea-marketing-content-design-json")).toHaveTextContent("\"generator\": \"marketing_campaign_planner_ai\"");
    expect(screen.getByTestId("textarea-marketing-content-design-json")).toHaveTextContent("\"playId\": \"partner-webinar\"");
    expect(screen.getByTestId("marketing-content-feedback")).toHaveTextContent("AI copy drafted for LinkedIn.");
    expect(screen.getByText("AI content draft is ready. Save it in Content, then attach the saved asset to the campaign.")).toBeInTheDocument();
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

  it("creates and links missing campaign route content from the planner", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "Care team nudge" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-campaign-objective"), { target: { value: "Invite families to try a calmer care-team update." } });
    fireEvent.click(screen.getByTestId("button-marketing-campaign-pack-care-team"));
    fireEvent.change(screen.getByTestId("select-marketing-campaign-content"), { target: { value: "content-1" } });

    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("WhatsApp content");
    expect(screen.getByTestId("select-marketing-campaign-route-content-whatsapp")).toHaveValue("");
    expect(screen.getByTestId("marketing-campaign-launch-preview")).toHaveTextContent("Launch preview");
    expect(screen.getByTestId("marketing-campaign-launch-preview-email")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-campaign-launch-preview-email")).toHaveTextContent("VYVA send");
    expect(screen.getByTestId("marketing-campaign-launch-preview-whatsapp")).toHaveTextContent("No WhatsApp content linked");
    expect(screen.getByTestId("marketing-campaign-launch-preview-whatsapp")).toHaveTextContent("Needs content");
    fireEvent.click(screen.getByTestId("button-marketing-create-link-route-content-whatsapp"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });
    const routeContentPost = apiFetchMock.mock.calls
      .filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")))
      .find((body) => body.channel === "whatsapp");

    expect(routeContentPost).toMatchObject({
      title: "Care team nudge WhatsApp content",
      channel: "whatsapp",
      status: "draft",
      body: expect.stringContaining("Invite families to try a calmer care-team update."),
      designJson: expect.objectContaining({
        generator: "marketing_campaign_planner",
        channel: "whatsapp",
      }),
    });
    await waitFor(() => {
      expect(screen.getByTestId("select-marketing-campaign-route-content-whatsapp")).toHaveValue("content-created");
    });
    expect(screen.getByTestId("marketing-campaign-launch-preview")).toHaveTextContent("2/2 ready");
    expect(screen.getByTestId("marketing-campaign-launch-preview-whatsapp")).toHaveTextContent("Care team nudge WhatsApp content");
    expect(screen.getByTestId("marketing-campaign-launch-preview-whatsapp")).toHaveTextContent("Provider-ready");
    expect(screen.getByTestId("marketing-campaign-draft-readiness")).toHaveTextContent("2 content assets linked across Email and WhatsApp.");
    expect(screen.getByText("Created and linked WhatsApp route content.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-preview-campaign-launch-content-whatsapp"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Previewing "Care team nudge WhatsApp content".');
  });

  it("creates and links all missing campaign route content from the planner", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "Full launch push" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-campaign-objective"), { target: { value: "Launch the new family update story across every route." } });
    fireEvent.click(screen.getByTestId("button-marketing-campaign-pack-full-launch"));
    fireEvent.change(screen.getByTestId("select-marketing-campaign-content"), { target: { value: "content-1" } });

    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("Create 4 missing");
    fireEvent.click(screen.getByTestId("button-marketing-create-link-all-route-content"));

    await waitFor(() => {
      const contentPosts = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
      expect(contentPosts).toHaveLength(4);
    });
    const routeContentPosts = apiFetchMock.mock.calls
      .filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")));

    expect(routeContentPosts.map((body) => body.channel).sort()).toEqual(["facebook", "instagram", "linkedin", "whatsapp"]);
    expect(routeContentPosts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Full launch push WhatsApp content",
        channel: "whatsapp",
        body: expect.stringContaining("Launch the new family update story across every route."),
        designJson: expect.objectContaining({ generator: "marketing_campaign_planner", channel: "whatsapp" }),
      }),
      expect.objectContaining({
        title: "Full launch push Facebook content",
        channel: "facebook",
        designJson: expect.objectContaining({ generator: "marketing_campaign_planner", channel: "facebook" }),
      }),
      expect.objectContaining({
        title: "Full launch push Instagram content",
        channel: "instagram",
        designJson: expect.objectContaining({ generator: "marketing_campaign_planner", channel: "instagram" }),
      }),
      expect.objectContaining({
        title: "Full launch push LinkedIn content",
        channel: "linkedin",
        designJson: expect.objectContaining({ generator: "marketing_campaign_planner", channel: "linkedin" }),
      }),
    ]));

    await waitFor(() => {
      expect(screen.getByTestId("select-marketing-campaign-route-content-whatsapp")).toHaveValue("content-created");
      expect(screen.getByTestId("select-marketing-campaign-route-content-facebook")).toHaveValue("content-created");
      expect(screen.getByTestId("select-marketing-campaign-route-content-instagram")).toHaveValue("content-created");
      expect(screen.getByTestId("select-marketing-campaign-route-content-linkedin")).toHaveValue("content-created");
    });
    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("5/5 linked");
    expect(screen.getByTestId("marketing-campaign-draft-readiness")).toHaveTextContent("5 content assets linked across Email, WhatsApp, Facebook, Instagram, and LinkedIn.");
    expect(screen.getAllByText("Created and linked missing route content for WhatsApp, Facebook, Instagram, and LinkedIn.")).not.toHaveLength(0);
  });

  it("edits and deletes imported content assets", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    fireEvent.click(screen.getByTestId("button-marketing-delete-content-content-2"));
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Click Confirm delete to remove "Partner post".');
    expect(screen.getByTestId("button-marketing-delete-content-content-2")).toHaveTextContent("Confirm delete");
    expect(screen.getByTestId("marketing-content-action-card-content-2")).toHaveTextContent("Confirm delete?");
    expect(screen.getByTestId("marketing-content-action-card-content-2")).toHaveTextContent("Source is not changed.");
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
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Source design data");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("1 media refs");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("CTA: Read more -> https://v2.vyva.life/partners");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Source ID: lovable-content-2");
    expect(screen.getByTestId("marketing-content-preview-open-content-2")).toHaveTextContent("Focus preview");
    expect(screen.getByTestId("marketing-content-inline-preview-content-2")).toHaveTextContent("Partner update");
    expect(screen.getByTestId("marketing-content-inline-preview-content-2")).toHaveTextContent("Source design preview");
    expect(screen.getByTestId("marketing-content-inline-preview-content-2")).toHaveTextContent("Media references");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveAttribute("role", "dialog");
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveClass("fixed");
    expect(screen.getByTestId("marketing-content-preview-panel")).toHaveClass("z-[9999]");
    expect(screen.getByTestId("marketing-content-preview")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-content-source-details")).toHaveTextContent("Imported source details");
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

  it("duplicates imported content as a clean editable draft", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-duplicate-content-content-2"));

    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Creating editable draft copy of "Partner post"');

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });

    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    const postPayload = JSON.parse(String(postCall?.[1]?.body ?? "{}"));
    expect(postPayload).toMatchObject({
      title: "Copy of Partner post",
      channel: "linkedin",
      language: "en",
      status: "draft",
      subject: null,
      body: "Partner update",
      htmlBody: "<h1>Partner update</h1>",
      ctaLabel: "Read more",
      ctaUrl: "https://v2.vyva.life/partners",
      source: "vyva_duplicate",
      lovableExternalId: null,
      designJson: content[1].designJson,
      mediaAssets: content[1].mediaAssets,
      metadata: expect.objectContaining({
        extraSourceOnlyField: "kept",
        lovable_source_type: "social_post",
        duplicatedFrom: {
          contentId: "content-2",
          title: "Partner post",
          source: "lovable",
          lovableExternalId: "lovable-content-2",
          duplicatedAt: expect.any(String),
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-form")).toBeInTheDocument();
      expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Copy of Partner post");
    });
    expect(screen.getByTestId("select-marketing-edit-content-status")).toHaveValue("draft");
    expect(screen.getByTestId("input-marketing-edit-content-source")).toHaveValue("vyva_duplicate");
    expect(screen.getByTestId("input-marketing-edit-content-lovable-id")).toHaveValue("");
    expect(screen.getByTestId("textarea-marketing-edit-content-html")).toHaveValue("<h1>Partner update</h1>");
    expect(screen.getByTestId("textarea-marketing-edit-content-design-json")).toHaveValue(JSON.stringify(content[1].designJson, null, 2));
    expect(screen.getByTestId("textarea-marketing-edit-content-media-assets")).toHaveValue(JSON.stringify(content[1].mediaAssets, null, 2));
    expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("Created.");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent('Created editable draft copy "Copy of Partner post".');
  });

  it("polishes imported content with AI before saving the same content record", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-content-content-2"));

    expect(screen.getByTestId("marketing-content-ai-polish-panel")).toHaveTextContent("AI polish");
    expect(screen.getByTestId("marketing-content-next-action")).toHaveTextContent("Content copilot");
    expect(screen.getByTestId("marketing-content-next-action-title")).toHaveTextContent("Polish with AI");
    expect(screen.getByTestId("marketing-content-next-action-copy")).toHaveTextContent("Ready");
    expect(screen.getByTestId("marketing-content-next-action-cta")).toHaveTextContent("Ready");
    expect(screen.getByTestId("marketing-content-next-action-polish")).toHaveTextContent("Suggested");
    expect(screen.getByTestId("button-marketing-content-next-action")).toHaveTextContent("Polish with AI");
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Partner post");
    expect(screen.getByTestId("textarea-marketing-edit-content-body")).toHaveValue("Partner update");

    fireEvent.change(screen.getByTestId("select-marketing-content-polish-tone"), { target: { value: "direct" } });
    fireEvent.click(screen.getByTestId("button-marketing-content-next-action"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/ai/campaign-draft", expect.objectContaining({ method: "POST" }));
    });
    const aiCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(JSON.parse(String(aiCall?.[1]?.body))).toMatchObject({
      playLabel: "Content polish",
      playCategory: "content_editor",
      audienceType: "both",
      channel: "linkedin",
      tone: "direct",
      campaignName: "Partner post",
      contentTitle: "Partner post",
      subjectSeed: "Partner post",
      bodySeed: "Partner update",
      ctaLabel: "Read more",
      ctaUrl: "https://v2.vyva.life/partners",
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("AI polish applied.");
    });
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Partner post");
    expect(screen.getByTestId("input-marketing-edit-content-subject")).toHaveValue("AI subject line");
    expect(screen.getByTestId("textarea-marketing-edit-content-body")).toHaveValue("AI body copy with stronger channel direction.");
    expect(screen.getByTestId("input-marketing-edit-content-cta-label")).toHaveValue("AI CTA");
    expect(screen.getByTestId("input-marketing-edit-content-cta-url")).toHaveValue("https://v2.vyva.life/ai");
    expect(screen.getByTestId("marketing-content-next-action-title")).toHaveTextContent("Create a channel pack");
    expect(screen.getByTestId("marketing-content-next-action-polish")).toHaveTextContent("Applied");
    expect(screen.getByTestId("marketing-content-next-action-variants")).toHaveTextContent("None");
    expect(screen.getByTestId("button-marketing-content-next-action")).toHaveTextContent("Create full pack");

    const polishedDesign = JSON.parse((screen.getByTestId("textarea-marketing-edit-content-design-json") as HTMLTextAreaElement).value);
    expect(polishedDesign).toMatchObject({
      blocks: [{ type: "hero" }],
      aiPolish: {
        generator: "marketing_content_ai_polish",
        source: "openai",
        tone: "direct",
        modelHints: { generator: "test-ai" },
      },
    });
    const polishedMetadata = JSON.parse((screen.getByTestId("textarea-marketing-edit-content-metadata") as HTMLTextAreaElement).value);
    expect(polishedMetadata).toMatchObject({
      extraSourceOnlyField: "kept",
      aiPolishHistory: [{
        source: "openai",
        tone: "direct",
        previousSubject: null,
        previousBodyPreview: "Partner update",
      }],
    });

    fireEvent.click(screen.getByTestId("button-marketing-save-content"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content/content-2", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content/content-2" && init?.method === "PATCH");
    const patchPayload = JSON.parse(String(patchCall?.[1]?.body));
    expect(patchPayload).toMatchObject({
      title: "Partner post",
      channel: "linkedin",
      subject: "AI subject line",
      body: "AI body copy with stronger channel direction.",
      ctaLabel: "AI CTA",
      ctaUrl: "https://v2.vyva.life/ai",
      source: "lovable",
      lovableExternalId: "lovable-content-2",
      metadata: {
        extraSourceOnlyField: "kept",
        aiPolishHistory: [{
          source: "openai",
          tone: "direct",
        }],
      },
    });
    expect(patchPayload.designJson.aiPolish).toMatchObject({ generator: "marketing_content_ai_polish", tone: "direct" });
  });

  it("generates starter copy for imported content that has no body yet", async () => {
    renderPage({}, { content: [missingLovableContent, ...content] });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-content-content-missing-lovable"));

    expect(screen.getByTestId("marketing-content-ai-polish-panel")).toHaveTextContent("AI polish");
    expect(screen.getByTestId("marketing-content-next-action")).toHaveTextContent("Content copilot");
    expect(screen.getByTestId("marketing-content-next-action-title")).toHaveTextContent("Generate starter copy");
    expect(screen.getByTestId("marketing-content-next-action-copy")).toHaveTextContent("Missing");
    expect(screen.getByTestId("marketing-content-next-action-copy")).toHaveTextContent("Generate starter copy");
    expect(screen.getByTestId("button-marketing-content-next-action")).toHaveTextContent("Generate copy");
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Birthday wishes Source template");
    expect(screen.getByTestId("textarea-marketing-edit-content-body")).toHaveValue("");

    fireEvent.click(screen.getByTestId("button-marketing-content-next-action"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/ai/campaign-draft", expect.objectContaining({ method: "POST" }));
    });
    const aiCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(JSON.parse(String(aiCall?.[1]?.body))).toMatchObject({
      playLabel: "Content starter copy",
      playCategory: "content_starter",
      audienceType: "both",
      channel: "email",
      tone: "warm",
      campaignName: "Birthday wishes Source template",
      contentTitle: "Birthday wishes Source template",
      subjectSeed: "Birthday wishes Source template",
      bodySeed: "Birthday wishes Source template",
      ctaLabel: "Learn more",
      ctaUrl: "https://v2.vyva.life",
      language: "en",
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("AI starter copy generated.");
    });
    expect(screen.getByTestId("input-marketing-edit-content-subject")).toHaveValue("AI email subject line");
    expect(screen.getByTestId("textarea-marketing-edit-content-body")).toHaveValue("AI email body copy with stronger channel direction.");
    expect(screen.getByTestId("textarea-marketing-edit-content-html")).toHaveValue("<p>AI email body copy with stronger channel direction.</p>");
    expect(screen.getByTestId("input-marketing-edit-content-cta-label")).toHaveValue("AI CTA");
    expect(screen.getByTestId("input-marketing-edit-content-cta-url")).toHaveValue("https://v2.vyva.life/ai");
    expect(screen.getByTestId("marketing-content-next-action-title")).toHaveTextContent("Create a channel pack");
    expect(screen.getByTestId("marketing-content-next-action-copy")).toHaveTextContent("Ready");
    expect(screen.getByTestId("marketing-content-next-action-polish")).toHaveTextContent("Applied");

    const starterDesign = JSON.parse((screen.getByTestId("textarea-marketing-edit-content-design-json") as HTMLTextAreaElement).value);
    expect(starterDesign).toMatchObject({
      aiStarterCopy: {
        generator: "marketing_content_ai_starter",
        source: "openai",
        tone: "warm",
        modelHints: { generator: "test-ai" },
      },
    });
    const starterMetadata = JSON.parse((screen.getByTestId("textarea-marketing-edit-content-metadata") as HTMLTextAreaElement).value);
    expect(starterMetadata).toMatchObject({
      lovable_source_type: "missing_lovable_reference",
      aiStarterHistory: [{
        source: "openai",
        tone: "warm",
        previousSubject: null,
        previousBodyPreview: null,
        sourceType: "missing_lovable_reference",
        sourceId: "email_template:6199c1eb-75ca-4347-a619-f7f5a7af989d",
      }],
    });
    expect(apiFetchMock.mock.calls.some(([path, init]) => path === "/api/admin/marketing/content/content-missing-lovable" && init?.method === "PATCH")).toBe(false);
  });

  it("surfaces AI copy rescue for empty imported content from the library", async () => {
    renderPage({}, { content: [missingLovableContent, ...content] });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));

    const rescuePanel = screen.getByTestId("marketing-content-copy-rescue");
    expect(rescuePanel).toHaveTextContent("AI copy rescue");
    expect(rescuePanel).toHaveTextContent("1 visible need copy");
    expect(rescuePanel).toHaveTextContent("Turn empty Source assets into editable campaign copy.");
    expect(screen.getByTestId("button-marketing-generate-copy-content-content-missing-lovable")).toHaveTextContent("Generate copy");

    fireEvent.click(screen.getByTestId("button-marketing-content-copy-rescue-next"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/ai/campaign-draft", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("AI starter copy generated.");
    });

    expect(screen.getByTestId("marketing-content-editor-open-content-missing-lovable")).toHaveTextContent("Editor panel opened.");
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Birthday wishes Source template");
    expect(screen.getByTestId("input-marketing-edit-content-subject")).toHaveValue("AI email subject line");
    expect(screen.getByTestId("textarea-marketing-edit-content-body")).toHaveValue("AI email body copy with stronger channel direction.");
    expect(screen.getByTestId("marketing-content-action-feedback")).toHaveTextContent("Review and save it.");
    expect(screen.getByTestId("button-marketing-content-copy-rescue-next")).toHaveTextContent("Generate next missing copy");
    expect(apiFetchMock.mock.calls.some(([path, init]) => path === "/api/admin/marketing/content/content-missing-lovable" && init?.method === "PATCH")).toBe(false);
  });

  it("creates a localized content variant with AI without changing the imported original", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-content-content-2"));

    fireEvent.change(screen.getByTestId("select-marketing-content-localize-language"), { target: { value: "es" } });
    fireEvent.click(screen.getByTestId("button-marketing-localize-content-ai"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });
    const aiCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(JSON.parse(String(aiCall?.[1]?.body))).toMatchObject({
      playLabel: "Content localization",
      playCategory: "content_localization",
      audienceType: "both",
      channel: "linkedin",
      tone: "warm",
      campaignName: "Partner post",
      contentTitle: "Partner post (Spanish)",
      subjectSeed: "Partner post",
      bodySeed: "Partner update",
      ctaLabel: "Read more",
      ctaUrl: "https://v2.vyva.life/partners",
      language: "es",
    });

    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    const postPayload = JSON.parse(String(postCall?.[1]?.body));
    expect(postPayload).toMatchObject({
      title: "Content localization AI content",
      channel: "linkedin",
      language: "es",
      status: "draft",
      subject: "AI subject line",
      body: "AI body copy with stronger channel direction.",
      ctaLabel: "AI CTA",
      ctaUrl: "https://v2.vyva.life/ai",
      source: "vyva",
      lovableExternalId: null,
      mediaAssets: [{ url: "https://cdn.example.test/partner.png" }],
      metadata: {
        extraSourceOnlyField: "kept",
        localizedFromContentId: "content-2",
        localizedFromSourceExternalId: "lovable-content-2",
        localization: {
          sourceLanguage: "en",
          targetLanguage: "es",
          targetLanguageLabel: "Spanish",
          source: "openai",
        },
      },
    });
    expect(postPayload.designJson).toMatchObject({
      blocks: [{ type: "hero" }],
      aiLocalization: {
        generator: "marketing_content_ai_localization",
        source: "openai",
        sourceContentId: "content-2",
        sourceLanguage: "en",
        targetLanguage: "es",
        targetLanguageLabel: "Spanish",
        modelHints: { generator: "test-ai" },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("Spanish draft created.");
    });
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Content localization AI content");
    expect(screen.getByTestId("input-marketing-edit-content-language")).toHaveValue("es");
    expect(screen.getByTestId("textarea-marketing-edit-content-body")).toHaveValue("AI body copy with stronger channel direction.");
    expect(apiFetchMock.mock.calls.some(([path, init]) => path === "/api/admin/marketing/content/content-2" && init?.method === "PATCH")).toBe(false);
  });

  it("creates an AI channel variant from existing content", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-content-content-2"));

    expect(screen.getByTestId("select-marketing-content-variant-channel")).toHaveValue("email");
    fireEvent.click(screen.getByTestId("button-marketing-channel-variant-content-ai"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });
    const aiCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(JSON.parse(String(aiCall?.[1]?.body))).toMatchObject({
      playLabel: "Channel variant",
      playCategory: "content_channel_variant",
      audienceType: "both",
      channel: "email",
      tone: "warm",
      campaignName: "Partner post",
      contentTitle: "Partner post - Email",
      subjectSeed: "Partner post",
      bodySeed: "Partner update",
      ctaLabel: "Read more",
      ctaUrl: "https://v2.vyva.life/partners",
      language: "en",
    });

    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    const postPayload = JSON.parse(String(postCall?.[1]?.body));
    expect(postPayload).toMatchObject({
      title: "Channel variant email AI content",
      channel: "email",
      language: "en",
      status: "draft",
      subject: "AI email subject line",
      body: "AI email body copy with stronger channel direction.",
      htmlBody: "<p>AI email body copy with stronger channel direction.</p>",
      ctaLabel: "AI CTA",
      ctaUrl: "https://v2.vyva.life/ai",
      source: "vyva",
      lovableExternalId: null,
      mediaAssets: [{ url: "https://cdn.example.test/partner.png" }],
      metadata: {
        extraSourceOnlyField: "kept",
        channelVariantFromContentId: "content-2",
        channelVariantFromSourceExternalId: "lovable-content-2",
        channelVariant: {
          source: "openai",
          sourceChannel: "linkedin",
          targetChannel: "email",
          sourceLanguage: "en",
        },
      },
    });
    expect(postPayload.designJson).toMatchObject({
      blocks: [{ type: "hero" }],
      aiChannelVariant: {
        generator: "marketing_content_ai_channel_variant",
        source: "openai",
        sourceContentId: "content-2",
        sourceChannel: "linkedin",
        targetChannel: "email",
        modelHints: { generator: "test-ai" },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("Email draft created.");
    });
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Channel variant email AI content");
    expect(screen.getByTestId("select-marketing-edit-content-channel")).toHaveValue("email");
    expect(screen.getByTestId("textarea-marketing-edit-content-html")).toHaveValue("<p>AI email body copy with stronger channel direction.</p>");
    expect(apiFetchMock.mock.calls.some(([path, init]) => path === "/api/admin/marketing/content/content-2" && init?.method === "PATCH")).toBe(false);
  });

  it("creates a full AI channel pack from existing content", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-content-content-2"));
    fireEvent.click(screen.getByTestId("button-marketing-channel-pack-content-ai"));

    await waitFor(() => {
      const contentPosts = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
      expect(contentPosts).toHaveLength(9);
    });

    const aiCalls = apiFetchMock.mock.calls
      .filter(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")));
    expect(aiCalls.map((payload) => payload.channel)).toEqual(["email", "whatsapp", "sms", "phone", "print", "event", "facebook", "instagram", "tiktok"]);
    expect(aiCalls.every((payload) => payload.playCategory === "content_channel_variant")).toBe(true);
    expect(aiCalls.every((payload) => payload.campaignName === "Partner post")).toBe(true);

    const postPayloads = apiFetchMock.mock.calls
      .filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body ?? "{}")));
    expect(postPayloads.map((payload) => payload.channel)).toEqual(["email", "whatsapp", "sms", "phone", "print", "event", "facebook", "instagram", "tiktok"]);
    expect(postPayloads.every((payload) => payload.source === "vyva" && payload.lovableExternalId === null)).toBe(true);
    expect(postPayloads.every((payload) => payload.metadata.channelVariantFromContentId === "content-2")).toBe(true);
    expect(postPayloads.every((payload) => payload.designJson.aiChannelVariant.sourceChannel === "linkedin")).toBe(true);
    expect(postPayloads.find((payload) => payload.channel === "email")?.htmlBody).toBe("<p>AI email body copy with stronger channel direction.</p>");
    expect(postPayloads.find((payload) => payload.channel === "whatsapp")?.htmlBody).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId("marketing-content-editor-feedback")).toHaveTextContent("9 channel drafts created.");
    });
    expect(screen.getByTestId("input-marketing-edit-content-title")).toHaveValue("Channel variant email AI content");
    expect(screen.getByTestId("select-marketing-edit-content-channel")).toHaveValue("email");
    expect(apiFetchMock.mock.calls.some(([path, init]) => path === "/api/admin/marketing/content/content-2" && init?.method === "PATCH")).toBe(false);
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
    fireEvent.change(screen.getByTestId("select-marketing-contact-consent"), { target: { value: "opted_in" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-role"), { target: { value: "Director" } });
    fireEvent.change(screen.getByTestId("input-marketing-contact-company"), { target: { value: "New Org" } });
    fireEvent.click(screen.getByTestId("button-marketing-contact-language-option-es"));
    fireEvent.click(screen.getByTestId("button-marketing-contact-category-option-partner"));
    fireEvent.click(screen.getByTestId("button-marketing-contact-vertical-option-healthcare"));
    fireEvent.click(screen.getByTestId("button-marketing-contact-market-option-spain"));
    expect(screen.getByTestId("input-marketing-contact-language")).toHaveValue("es");
    expect(screen.getByTestId("input-marketing-contact-category")).toHaveValue("partner");
    expect(screen.getByTestId("input-marketing-contact-vertical")).toHaveValue("healthcare");
    expect(screen.getByTestId("input-marketing-contact-market")).toHaveValue("Spain");
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
      consentStatus: "opted_in",
      roleLabel: "Director",
      companyName: "New Org",
      language: "es",
      category: "partner",
      vertical: "healthcare",
      market: "Spain",
      tags: ["partner", "madrid"],
      metadata: {
        segmentation: {
          language: "es",
          category: "partner",
          vertical: "healthcare",
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
    fireEvent.change(screen.getByTestId("input-marketing-audience-rules"), { target: { value: "{\"market\":\"Spain\",\"vertical\":\"healthcare\"}" } });
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
      rules: { market: "Spain", vertical: "healthcare" },
      contactExternalIds: ["lovable-contact-2", "missing-contact"],
    });
  });

  it("loads consent cleanup as a consent-safe re-permission campaign", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));

    expect(screen.getByTestId("marketing-contact-work-queue-consent-cleanup")).toHaveTextContent("Prepare a consent-safe re-permission plan");
    expect(screen.getByTestId("button-marketing-contact-work-queue-studio-consent-cleanup")).toHaveTextContent("Prepare consent check");

    fireEvent.click(screen.getByTestId("button-marketing-contact-work-queue-studio-consent-cleanup"));

    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Consent-safe re-permission plan loaded");
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Recipient snapshots are off");
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("__no_reviewed_audience__");
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveTextContent("No reviewed list selected");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("");
    const intentBrief = screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement;
    expect(intentBrief.value).toContain("Consent re-permission campaign.");
    expect(intentBrief.value).toContain("Do not message opted-out contacts.");
    expect(intentBrief.value).toContain("pending/unknown");
  });

  it("opens the first consent cleanup contact directly from the work queue", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));

    fireEvent.click(screen.getByTestId("button-marketing-contact-work-queue-review-consent-cleanup"));

    expect(screen.getByTestId("marketing-contact-editor-feedback")).toHaveTextContent('Reviewing "Karim Assad". Update consent or contact details, then save.');
    expect(screen.getByText("Contact editor")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-contact-name")).toHaveValue("Karim Assad");
    expect(screen.getByTestId("select-marketing-edit-contact-consent")).toHaveValue("unknown");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("2 visible of 2 contacts");
  });

  it("updates consent directly from the consent triage queue", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));

    expect(screen.getByTestId("marketing-contact-consent-triage")).toHaveTextContent("Clear the first blockers");
    expect(screen.getByTestId("marketing-contact-consent-triage-row-contact-1")).toHaveTextContent("unknown");

    fireEvent.click(screen.getByTestId("button-marketing-consent-triage-opted-in-contact-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/contacts/contact-1", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/contacts/contact-1" && init?.method === "PATCH");
    const patchBody = JSON.parse(String(patchCall?.[1]?.body));
    expect(patchBody).toMatchObject({
      fullName: "Karim Assad",
      consentStatus: "opted_in",
      whatsappNumber: "+34600000001",
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent('"Karim Assad" marked opted_in.');
    });
    expect(screen.queryByTestId("marketing-contact-consent-triage-row-contact-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-contact-consent-triage-row-contact-2")).toHaveTextContent("pending");
  });

  it("bulk marks visible unknown consent contacts as pending review", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));

    expect(screen.getByTestId("button-marketing-consent-triage-bulk-pending")).toHaveTextContent("Mark 1 unknown pending");

    fireEvent.click(screen.getByTestId("button-marketing-consent-triage-bulk-pending"));

    await waitFor(() => {
      expect(screen.getByTestId("marketing-contact-feedback")).toHaveTextContent("1 visible unknown contact marked pending review");
    });

    const contactOnePatch = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/contacts/contact-1" && init?.method === "PATCH");
    expect(contactOnePatch).toBeTruthy();
    const contactOnePayload = JSON.parse(String(contactOnePatch?.[1]?.body));
    expect(contactOnePayload.consentStatus).toBe("pending");
    expect(contactOnePayload.metadata.consentReview).toMatchObject({
      action: "bulk_mark_pending",
      status: "pending",
      source: "marketing_admin",
    });
    expect(apiFetchMock.mock.calls.some(([path, init]) => path === "/api/admin/marketing/contacts/contact-2" && init?.method === "PATCH")).toBe(false);
    expect(screen.getByTestId("marketing-contact-consent-triage-row-contact-1")).toHaveTextContent("pending");
  });

  it("builds consent cleanup review lists without opted-out contacts", async () => {
    renderPage({}, {
      contacts: [
        ...contacts,
        {
          ...contacts[1],
          id: "contact-3",
          profileId: null,
          organizationId: null,
          fullName: "Opted Out Lead",
          email: "optedout@example.com",
          phoneNumber: null,
          whatsappNumber: null,
          roleLabel: null,
          companyName: null,
          consentStatus: "opted_out",
          tags: [],
          language: "en",
          category: "lead",
          vertical: "healthcare",
          market: "Spain",
          lists: [],
          lovableExternalId: "lovable-contact-3",
          channelAvailability: { email: true },
        },
      ],
    });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));

    expect(screen.getByTestId("marketing-contact-work-queue-consent-cleanup")).toHaveTextContent("3 contacts");
    fireEvent.click(screen.getByTestId("button-marketing-contact-work-queue-list-consent-cleanup"));

    expect(screen.getByTestId("button-marketing-lists-view")).toHaveClass("bg-purple-700");
    expect(screen.getByTestId("input-marketing-audience-name")).toHaveValue("Consent review list");
    expect(screen.getByTestId("input-marketing-audience-description")).toHaveValue("Prepare a consent-safe re-permission plan. Opted-out contacts stay in review and are excluded from campaign snapshots. Built from 2 pending/unknown contacts. Excluded 1 opted-out contact.");
    const consentMemberIds = screen.getByTestId("input-marketing-audience-contact-ids") as HTMLTextAreaElement;
    expect(consentMemberIds.value).toBe("contact-1\nlovable-contact-2");
    expect(consentMemberIds.value).not.toContain("lovable-contact-3");
    const consentRules = JSON.parse((screen.getByTestId("input-marketing-audience-rules") as HTMLTextAreaElement).value);
    expect(consentRules).toMatchObject({
      source: "relationship_work_queue",
      queue: "consent-cleanup",
      contactCount: 3,
      listContactCount: 2,
      excludedOptedOutCount: 1,
      requiresReview: true,
      consentStatuses: ["unknown", "pending"],
    });
    expect(screen.getByTestId("marketing-audience-feedback")).toHaveTextContent("Consent cleanup queue loaded as a review list with 2 contacts. Excluded 1 opted-out contact.");
  });

  it("saves the current contact filters as a reusable audience", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.change(screen.getByTestId("select-marketing-contact-market-filter"), { target: { value: "spain" } });

    expect(screen.getByTestId("marketing-filtered-audience-builder")).toHaveTextContent("Save this filtered view as an audience");
    expect(screen.getByTestId("marketing-filtered-audience-filter-summary")).toHaveTextContent("Market: Spain");
    expect(screen.getByTestId("marketing-filtered-audience-count")).toHaveTextContent("1");
    expect(screen.getByTestId("marketing-filtered-audience-reach")).toHaveTextContent("1");
    const filteredAudienceRules = screen.getByTestId("textarea-marketing-filtered-audience-rules") as HTMLTextAreaElement;
    expect(filteredAudienceRules.value).toContain('"market": "spain"');
    expect(filteredAudienceRules.value).toContain("lovable-contact-2");

    fireEvent.change(screen.getByTestId("input-marketing-filtered-audience-name"), { target: { value: "Spain partner segment" } });
    fireEvent.click(screen.getByTestId("button-marketing-save-filtered-audience"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/audiences", expect.objectContaining({ method: "POST" }));
    });

    const audiencePostCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/audiences" && init?.method === "POST");
    expect(JSON.parse(String(audiencePostCall?.[1]?.body))).toMatchObject({
      name: "Spain partner segment",
      listType: "static",
      source: "vyva_filtered_segment",
      contactExternalIds: ["lovable-contact-2"],
      rules: expect.objectContaining({
        source: "filtered_contact_view",
        filters: { market: "spain" },
        contactCount: 1,
        reachableContacts: 1,
        consentReviewCount: 1,
      }),
      metadata: expect.objectContaining({
        created_from: "filtered_contact_view",
        filterLabels: ["Market: Spain"],
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId("button-marketing-lists-view")).toHaveClass("bg-purple-700");
    });
    expect(screen.getByTestId("marketing-audience-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-audience-editor-feedback")).toHaveTextContent('Created filtered audience "Spain partner segment"');
  });

  it("turns the current contact filters into a campaign studio audience", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.change(screen.getByTestId("select-marketing-contact-market-filter"), { target: { value: "spain" } });
    fireEvent.change(screen.getByTestId("input-marketing-filtered-audience-name"), { target: { value: "Spain partner segment" } });

    fireEvent.click(screen.getByTestId("button-marketing-save-filtered-audience-build-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/audiences", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent('Audience loaded: Spain partner segment.');
    });

    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("audience-created");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("VYVA audience strategy brief: Spain partner segment");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-created");
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
    fireEvent.click(screen.getByTestId("button-marketing-edit-contact-language-option-es"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-contact-category-option-partner"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-contact-vertical-option-elder-care"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-contact-market-option-madrid"));
    expect(screen.getByTestId("input-marketing-edit-contact-language")).toHaveValue("es");
    expect(screen.getByTestId("input-marketing-edit-contact-category")).toHaveValue("partner");
    expect(screen.getByTestId("input-marketing-edit-contact-vertical")).toHaveValue("elder care");
    expect(screen.getByTestId("input-marketing-edit-contact-market")).toHaveValue("Madrid");
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
      vertical: "elder care",
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
          vertical: "elder care",
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

  it("duplicates imported marketing audiences as editable VYVA lists", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    fireEvent.click(screen.getByTestId("button-marketing-lists-view"));

    fireEvent.click(screen.getByTestId("button-marketing-duplicate-audience-audience-1"));
    expect(screen.getByTestId("marketing-audience-feedback")).toHaveTextContent('Creating editable copy of "Partners"');

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/audiences", expect.objectContaining({ method: "POST" }));
    });

    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/audiences" && init?.method === "POST");
    const postPayload = JSON.parse(String(postCall?.[1]?.body ?? "{}"));
    expect(postPayload).toMatchObject({
      name: "Copy of Partners",
      listType: "static",
      description: "Imported partner list",
      rules: { market: "Spain" },
      contactExternalIds: ["lovable-contact-2", "missing-contact"],
      source: "vyva_duplicate",
      lovableExternalId: null,
      metadata: expect.objectContaining({
        lovable: { sourceList: "Partners" },
        duplicatedFrom: {
          audienceId: "audience-1",
          name: "Partners",
          source: "lovable",
          lovableExternalId: "lovable-audience-1",
          duplicatedAt: expect.any(String),
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId("marketing-audience-editor-form")).toBeInTheDocument();
      expect(screen.getByTestId("input-marketing-edit-audience-name")).toHaveValue("Copy of Partners");
    });
    expect(screen.getByTestId("input-marketing-edit-audience-source")).toHaveValue("vyva_duplicate");
    expect(screen.getByTestId("input-marketing-edit-audience-lovable-id")).toHaveValue("");
    expect(screen.getByTestId("textarea-marketing-edit-audience-contact-ids")).toHaveValue("lovable-contact-2\nmissing-contact");
    expect(screen.getByTestId("textarea-marketing-edit-audience-rules")).toHaveValue(JSON.stringify({ market: "Spain" }, null, 2));
    expect(screen.getByTestId("marketing-audience-editor-feedback")).toHaveTextContent('Created editable list copy "Copy of Partners".');
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

  it("loads smart journey starters into editable journey details", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));

    expect(screen.getByTestId("marketing-journey-starters")).toHaveTextContent("Partner nurture journey");
    expect(screen.getByTestId("marketing-journey-starters")).toHaveTextContent("Caregiver activation journey");

    fireEvent.click(screen.getByTestId("button-marketing-journey-starter-partner-nurture"));

    expect(screen.getByTestId("marketing-journey-editor-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-marketing-edit-journey-name")).toHaveValue("Partner nurture journey");
    expect(screen.getByTestId("select-marketing-edit-journey-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-edit-journey-status")).toHaveValue("draft");
    expect(screen.getByTestId("select-marketing-edit-journey-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("input-marketing-edit-journey-trigger")).toHaveValue("list_joined");
    expect(screen.getByTestId("input-marketing-edit-journey-goal")).toHaveValue("reply");
    expect(screen.getByTestId("marketing-journey-target-audience-summary")).toHaveTextContent("Partners: 1 mapped of 2 members");
    expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Loaded Partner nurture journey");
    expect(screen.getByTestId("marketing-journey-steps-builder")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-journey-steps-builder")).toHaveTextContent("Welcome email");
    expect((screen.getByTestId("textarea-marketing-edit-journey-trigger-config") as HTMLTextAreaElement).value).toContain("journey_starter");

    fireEvent.click(screen.getByTestId("button-marketing-save-journey"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys", expect.objectContaining({ method: "POST" }));
    });
    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/journeys" && init?.method === "POST");
    const payload = JSON.parse(String(postCall?.[1]?.body));
    expect(payload).toMatchObject({
      name: "Partner nurture journey",
      audienceType: "b2b",
      status: "draft",
      triggerType: "list_joined",
      triggerConfig: { source: "journey_starter", targetAudienceId: "audience-1" },
      goalType: "reply",
      goalConfig: { withinDays: 14 },
    });
    expect(payload.steps).toHaveLength(2);
    expect(payload.steps[0]).toMatchObject({ channel: "linkedin", contentAssetId: "content-2", delayHours: 0 });
    expect(payload.steps[1]).toMatchObject({ channel: "email", contentAssetId: "content-1", delayHours: 72 });
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
    expect(screen.getByTestId("marketing-journey-copilot")).toHaveTextContent("Journey copilot");
    expect(screen.getByTestId("marketing-journey-copilot-next-action")).toHaveTextContent("Name journey first");
    expect(screen.getByTestId("button-marketing-journey-copilot-action")).toHaveTextContent("Name journey");
    expect(screen.getByTestId("button-marketing-add-first-journey-step")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-save-journey"));
    expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Journey name is required");

    fireEvent.change(screen.getByTestId("input-marketing-edit-journey-name"), { target: { value: "New onboarding" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-journey-objective"), { target: { value: "Create a useful draft first" } });
    expect(screen.getByTestId("marketing-journey-copilot-next-action")).toHaveTextContent("Define the trigger");
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

  it("exposes imported journey step translations as editable first-class fields", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-journey-journey-1"));

    const variantsPanel = screen.getByTestId("marketing-journey-step-language-variants-0");
    expect(variantsPanel).toHaveTextContent("Step language variants");
    expect(variantsPanel).toHaveTextContent("English (en)");
    expect(variantsPanel).toHaveTextContent("Spanish (es)");
    expect(screen.getByTestId("input-marketing-journey-step-default-language-0")).toHaveValue("en");
    expect(screen.getByTestId("input-marketing-journey-step-translation-subject-0-en")).toHaveValue("Welcome to VYVA");
    expect(screen.getByTestId("textarea-marketing-journey-step-translation-body-0-es")).toHaveValue("Hola desde Source");

    fireEvent.change(screen.getByTestId("textarea-marketing-journey-step-translation-body-0-en"), { target: { value: "Updated English body" } });
    fireEvent.change(screen.getByTestId("input-marketing-journey-step-translation-subject-0-es"), { target: { value: "Asunto actualizado" } });
    fireEvent.change(screen.getByTestId("input-marketing-journey-step-default-language-0"), { target: { value: "es" } });
    fireEvent.click(screen.getByTestId("button-marketing-save-journey"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys/journey-1", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/journeys/journey-1" && init?.method === "PATCH");
    const payload = JSON.parse(String(patchCall?.[1]?.body));
    expect(payload.steps[0].config).toMatchObject({
      default_language: "es",
      translations: {
        en: {
          body: "Updated English body",
          subject: "Welcome to VYVA",
        },
        es: {
          body: "Hola desde Source",
          subject: "Asunto actualizado",
        },
      },
    });
  });

  it("turns an imported journey step translation into a reusable content asset", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-journey-journey-1"));

    fireEvent.click(screen.getByTestId("button-marketing-create-journey-step-translation-content-0-en"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });
    const contentPostCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    const contentPayload = JSON.parse(String(contentPostCall?.[1]?.body));
    expect(contentPayload).toMatchObject({
      title: "Welcome email",
      channel: "email",
      language: "en",
      status: "draft",
      subject: "Welcome to VYVA",
      body: "Hello from Source",
      htmlBody: "<p>Hello from Source</p>",
      ctaLabel: "Open VYVA",
      ctaUrl: "https://v2.vyva.life",
      source: "vyva",
      lovableExternalId: null,
      designJson: {
        generator: "marketing_journey_step_translation",
        journeyName: "B2B nurture",
        stepIndex: 0,
        stepId: "step-1",
        channel: "email",
        language: "en",
      },
      metadata: {
        generatedFrom: "journey_step_translation",
        journeyName: "B2B nurture",
        stepIndex: 0,
        stepId: "step-1",
        language: "en",
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("select-marketing-journey-step-content-0")).toHaveValue("content-created");
    });
    expect(screen.getByTestId("input-marketing-journey-step-template-kind-0")).toHaveValue("content_asset");
    expect(screen.getByTestId("input-marketing-journey-step-template-ref-0")).toHaveValue("content-created");
    expect(screen.getByTestId("marketing-journey-feedback")).toHaveTextContent("Created en content asset and linked step 1");

    fireEvent.click(screen.getByTestId("button-marketing-save-journey"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys/journey-1", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/journeys/journey-1" && init?.method === "PATCH");
    const journeyPayload = JSON.parse(String(patchCall?.[1]?.body));
    expect(journeyPayload.steps[0]).toMatchObject({
      contentAssetId: "content-created",
      templateKind: "content_asset",
      templateRef: "content-created",
    });
    expect(journeyPayload.steps[0].config).toMatchObject({
      generatedContentAssetId: "content-created",
      generatedContentTitle: "Welcome email",
      translationContentAssetIds: {
        en: "content-created",
      },
    });
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
    expect(screen.getByTestId("marketing-journey-copilot")).toHaveTextContent("Journey copilot");
    expect(screen.getByTestId("marketing-journey-copilot-score")).toHaveTextContent("planning ready");
    expect(screen.getByTestId("marketing-journey-copilot-content")).toHaveTextContent("1/1 steps have linked content");
    expect(screen.getByTestId("button-marketing-journey-copilot-action")).toHaveTextContent("Save journey");
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
    expect(screen.getByTestId("marketing-campaign-studio-categories")).toHaveTextContent("31");
    expect(screen.getByTestId("marketing-campaign-studio-playbook-recommendations")).toHaveTextContent("Best next campaigns from your data");
    expect(screen.getByTestId("marketing-campaign-studio-playbook-recommendations")).toHaveTextContent("Event reminder");
    expect(screen.getByTestId("marketing-campaign-launch-mode-chooser")).toHaveTextContent("Choose launch mode");
    expect(screen.getByTestId("marketing-campaign-launch-mode-chooser")).toHaveTextContent("Sendable email campaign");
    expect(screen.getByTestId("marketing-campaign-launch-mode-chooser")).toHaveTextContent("Local / offline event");
    expect(screen.getByTestId("marketing-campaign-launch-mode-chooser")).toHaveTextContent("Community partner launch");
    expect(screen.getByTestId("marketing-campaign-launch-mode-chooser")).toHaveTextContent("Press / partner announcement");
    expect(screen.getByTestId("marketing-campaign-launch-mode-pack-community-partner-launch")).toHaveTextContent("Template pack: Community partner launch");
    expect(screen.getByTestId("marketing-campaign-launch-mode-pack-community-partner-launch")).toHaveTextContent("6 starter templates");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-launch-mode-community-partner-launch"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Launch mode loaded: Community partner launch with Community partner launch template pack.");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Community partner launch");
    expect(screen.getByTestId("marketing-campaign-launch-mode-pack-press-partner-announcement")).toHaveTextContent("Template pack: Press and partner announcement");
    expect(screen.getByTestId("marketing-campaign-launch-mode-pack-press-partner-announcement")).toHaveTextContent("6 starter templates");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-launch-mode-press-partner-announcement"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Launch mode loaded: Press / partner announcement with Press and partner announcement template pack.");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-campaign-launch-mode-chooser")).toHaveTextContent("Full-channel launch packet");
    expect(screen.getByTestId("marketing-campaign-launch-mode-pack-full-channel-launch")).toHaveTextContent("Template pack: Full-channel launch announcement");
    expect(screen.getByTestId("marketing-campaign-launch-mode-pack-full-channel-launch")).toHaveTextContent("10 starter templates");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-launch-mode-full-channel-launch"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Launch mode loaded: Full-channel launch packet with Full-channel launch announcement template pack.");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-campaign-launch-mode-pack-local-offline")).toHaveTextContent("Template pack: Local event operations");
    expect(screen.getByTestId("marketing-campaign-launch-mode-pack-local-offline")).toHaveTextContent("9 starter templates");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-launch-mode-local-offline"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Launch mode loaded: Local / offline event with Local event operations template pack.");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("event");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Local event operations");
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
    fireEvent.change(screen.getByTestId("select-marketing-campaign-studio-channel"), { target: { value: "tiktok" } });
    expect(screen.getByTestId("marketing-campaign-studio-audience-recommendation")).toHaveTextContent("Switch to LinkedIn before creating this campaign.");
    expect(screen.getByTestId("button-marketing-campaign-studio-use-best-channel")).toHaveTextContent("Use LinkedIn route");
    expect(screen.getByTestId("marketing-campaign-studio-command-title")).toHaveTextContent("Switch to the strongest route");
    expect(screen.getByTestId("marketing-campaign-studio-command-detail")).toHaveTextContent("Use LinkedIn as the primary route");
    expect(screen.getByTestId("button-marketing-campaign-studio-command-primary")).toHaveTextContent("Use LinkedIn route");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-use-best-channel"));
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Primary route switched to LinkedIn for better reach (1 reachable contact).");
    expect(screen.queryByTestId("marketing-campaign-studio-channel-copy-tiktok")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-studio-production-controls")).toHaveTextContent("Owner and metric are set before launch");
    expect(screen.getByTestId("marketing-campaign-studio-production-owner")).toHaveTextContent("Partner owner");
    expect(screen.getByTestId("marketing-campaign-studio-production-metric")).toHaveTextContent("Partner replies, pathway review calls, and warm introductions");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-studio-owner"), { target: { value: "Karim campaign owner" } });
    fireEvent.change(screen.getByTestId("input-marketing-campaign-studio-success-metric"), { target: { value: "10 partner review calls booked" } });
    expect(screen.getByTestId("marketing-campaign-studio-production-owner")).toHaveTextContent("Karim campaign owner");
    expect(screen.getByTestId("marketing-campaign-studio-production-metric")).toHaveTextContent("10 partner review calls booked");
    fireEvent.change(screen.getByTestId("select-marketing-campaign-studio-tone"), { target: { value: "direct" } });
    expect(screen.getByTestId("marketing-campaign-studio-smart-schedule")).toHaveTextContent("Pick a practical publish window");
    expect(screen.getByTestId("marketing-campaign-studio-smart-schedule")).toHaveTextContent("Partner morning");
    expect(screen.getByTestId("button-marketing-campaign-studio-use-best-schedule")).toHaveTextContent("Use Partner morning");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-use-best-schedule"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Schedule set: Partner morning");
    expect(screen.getByTestId("button-marketing-campaign-studio-schedule-primary")).toHaveTextContent("Selected");
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
    expect(screen.getByTestId("marketing-campaign-studio-segment-personalization")).toHaveTextContent("Segment personalization matrix");
    expect(screen.getByTestId("marketing-campaign-studio-segment-personalization-market-spain")).toHaveTextContent("Spain");
    expect(screen.getByTestId("marketing-campaign-studio-segment-personalization-market-spain")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-segment-personalization-market-spain")).toHaveTextContent("Lead with local usefulness");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-segment-personalization"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign segment personalization matrix"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Market: Spain"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign segment personalization matrix copied.");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-mix")).toHaveTextContent("Recipient mix");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-mix-channel-linkedin")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-mix-channel-linkedin")).toHaveTextContent("1/1");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-mix-segments")).toHaveTextContent("Spain 1");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-mix-route-gaps")).toHaveTextContent("0 missing route");
    expect(screen.getByTestId("marketing-campaign-studio-recipient-mix-consent-watch")).toHaveTextContent("1 to review");
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
    expect(screen.getByTestId("marketing-campaign-studio-channel-copy-board")).toHaveTextContent("Channel copy board");
    expect(screen.getByTestId("marketing-campaign-studio-channel-copy-board")).toHaveTextContent("Publishable copy for every selected route");
    expect(screen.getByTestId("marketing-campaign-studio-copy-board-linkedin")).toHaveTextContent("LinkedIn copy block");
    expect(screen.getByTestId("marketing-campaign-studio-copy-board-linkedin")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-studio-copy-board-linkedin")).toHaveTextContent("Publish manually in LinkedIn");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-channel-copy-linkedin"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn campaign copy block"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("LinkedIn copy block copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-channel-copy-board"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign channel copy board"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Publishing note: Publish manually in LinkedIn"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign channel copy board copied.");
    expect(screen.getByTestId("marketing-campaign-studio-distribution-checklist")).toHaveTextContent("Distribution checklist");
    expect(screen.getByTestId("marketing-campaign-studio-distribution-checklist")).toHaveTextContent("Where to publish and what proof to capture");
    expect(screen.getByTestId("marketing-campaign-studio-distribution-checklist-linkedin")).toHaveTextContent("LinkedIn publishing checklist");
    expect(screen.getByTestId("marketing-campaign-studio-distribution-checklist-linkedin")).toHaveTextContent("LinkedIn post composer");
    expect(screen.getByTestId("marketing-campaign-studio-distribution-checklist-linkedin")).toHaveTextContent("Published URL");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-distribution-checklist"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign distribution checklist"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn distribution checklist"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign distribution checklist copied.");
    expect(screen.getByTestId("marketing-campaign-studio-creative-direction")).toHaveTextContent("Creative direction board");
    expect(screen.getByTestId("marketing-campaign-studio-creative-direction-linkedin")).toHaveTextContent("LinkedIn creative direction");
    expect(screen.getByTestId("marketing-campaign-studio-creative-direction-linkedin")).toHaveTextContent("Visual:");
    expect(screen.getByTestId("marketing-campaign-studio-creative-direction-linkedin")).toHaveTextContent("Social square image prompt");
    expect(screen.getByTestId("marketing-campaign-studio-creative-direction-linkedin")).toHaveTextContent("Publish manually in the platform");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-creative-direction"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign creative direction board"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn creative direction"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign creative direction board copied.");
    expect(screen.getByTestId("marketing-campaign-studio-brand-review")).toHaveTextContent("Brand review board");
    expect(screen.getByTestId("marketing-campaign-studio-brand-review-brand")).toHaveTextContent("Brand fit");
    expect(screen.getByTestId("marketing-campaign-studio-brand-review-claims")).toHaveTextContent("No risky claim flagged");
    expect(screen.getByTestId("marketing-campaign-studio-brand-review-channels")).toHaveTextContent("1 route");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-brand-review"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign brand review board"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Reviewer instruction"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign brand review board copied.");
    expect(screen.getByTestId("marketing-campaign-studio-production-load")).toHaveTextContent("Production workload");
    expect(screen.getByTestId("marketing-campaign-studio-production-load")).toHaveTextContent("20 min");
    expect(screen.getByTestId("marketing-campaign-studio-production-load")).toHaveTextContent("Manual work planned");
    expect(screen.getByTestId("marketing-campaign-studio-production-load-linkedin")).toHaveTextContent("Social publishing owner");
    expect(screen.getByTestId("marketing-campaign-studio-production-load-linkedin")).toHaveTextContent("Planning");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-production-load"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign production workload"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn production task"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign production workload copied.");
    expect(screen.getByTestId("marketing-campaign-studio-template-production")).toHaveTextContent("Template production kit");
    expect(screen.getByTestId("marketing-campaign-studio-template-production")).toHaveTextContent("Turn the plan into attractive channel templates");
    expect(screen.getByTestId("marketing-campaign-studio-template-production-linkedin")).toHaveTextContent("LinkedIn post");
    expect(screen.getByTestId("marketing-campaign-studio-template-production-linkedin")).toHaveTextContent("Market: Spain");
    expect(screen.getByTestId("marketing-campaign-studio-template-production-linkedin")).toHaveTextContent("Coverage:");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-template-production"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign template production kit"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn template production brief"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("AI instruction: produce attractive, channel-native templates"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign template production kit copied.");
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
    expect(screen.getByTestId("marketing-campaign-studio-launch-assistant")).toHaveTextContent("Recommended now");
    expect(screen.getByTestId("marketing-campaign-studio-launch-assistant")).toHaveTextContent("Polish this into a stronger campaign");
    expect(screen.getByTestId("marketing-campaign-studio-launch-assistant-output")).toHaveTextContent("1 content asset");
    expect(screen.getByTestId("marketing-campaign-studio-launch-assistant-output")).toHaveTextContent("1 LinkedIn campaign route");
    expect(screen.getByTestId("button-marketing-campaign-studio-assistant-primary")).toHaveTextContent("Improve with AI");
    expect(screen.getByTestId("button-marketing-campaign-studio-assistant-secondary")).toHaveTextContent("Create now");
    expect(screen.getByTestId("marketing-campaign-studio-command-center")).toHaveTextContent("Launch command center");
    expect(screen.getByTestId("marketing-campaign-studio-command-title")).toHaveTextContent("Polish this into a stronger campaign");
    expect(screen.getByTestId("marketing-campaign-studio-command-detail")).toHaveTextContent("Improve with AI");
    expect(screen.getByTestId("marketing-campaign-studio-command-channels")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-command-channels")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-studio-command-stat-readiness")).toHaveTextContent("4/6");
    expect(screen.getByTestId("marketing-campaign-studio-command-stat-channels")).toHaveTextContent("1");
    expect(screen.getByTestId("marketing-campaign-studio-command-stat-reach")).toHaveTextContent("1");
    expect(screen.getByTestId("marketing-campaign-studio-command-stat-ai")).toHaveTextContent("0/1");
    expect(screen.getByTestId("marketing-campaign-studio-section-map")).toHaveTextContent("Studio section map");
    expect(screen.getByTestId("marketing-campaign-studio-section-map")).toHaveTextContent("6 workflow areas");
    expect(screen.getByTestId("button-marketing-campaign-studio-section-audience")).toHaveTextContent("Audience");
    expect(screen.getByTestId("button-marketing-campaign-studio-section-audience")).toHaveTextContent("1 selected");
    expect(screen.getByTestId("button-marketing-campaign-studio-section-templates")).toHaveTextContent("Templates");
    expect(screen.getByTestId("button-marketing-campaign-studio-section-templates")).toHaveTextContent("Prompts and merge tokens");
    expect(screen.getByTestId("button-marketing-campaign-studio-section-publishing")).toHaveTextContent("Publishing");
    expect(screen.getByTestId("button-marketing-campaign-studio-section-follow-up")).toHaveTextContent("Follow-up");
    expect(screen.getByTestId("marketing-campaign-studio-action-queue")).toHaveTextContent("Action queue");
    expect(screen.getByTestId("marketing-campaign-studio-action-queue")).toHaveTextContent("always has an obvious next click");
    expect(screen.getByTestId("marketing-campaign-studio-action-queue-copy")).toHaveTextContent("Polish the channel copy");
    expect(screen.getByTestId("button-marketing-campaign-studio-action-queue-copy")).toHaveTextContent("Improve with AI");
    expect(screen.getByTestId("marketing-campaign-studio-action-queue-create")).toHaveTextContent("Create campaign records");
    expect(screen.getByTestId("button-marketing-campaign-studio-action-queue-create")).toHaveTextContent("Create now");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-action-queue"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign action queue"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign action queue copied.");
    expect(screen.getByTestId("marketing-campaign-studio-brief-scorecard")).toHaveTextContent("Brief scorecard");
    expect(screen.getByTestId("marketing-campaign-studio-brief-scorecard")).toHaveTextContent("Checks whether the campaign idea");
    expect(screen.getByTestId("marketing-campaign-studio-brief-scorecard-play")).toHaveTextContent("B2B partner introduction");
    expect(screen.getByTestId("marketing-campaign-studio-brief-scorecard-hook")).toHaveTextContent("Partner outreach: proof point");
    expect(screen.getByTestId("marketing-campaign-studio-brief-scorecard-audience")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-studio-brief-scorecard-channels")).toHaveTextContent("LinkedIn");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-brief-scorecard"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign brief scorecard"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign brief scorecard copied.");
    expect(screen.getByTestId("marketing-campaign-studio-ai-command-brief")).toHaveTextContent("AI launch brief");
    const studioAiBrief = screen.getByTestId("textarea-marketing-campaign-studio-ai-command-brief") as HTMLTextAreaElement;
    expect(studioAiBrief.value).toContain("VYVA campaign studio AI command brief");
    expect(studioAiBrief.value).toContain("Owner: Karim campaign owner");
    expect(studioAiBrief.value).toContain("Success metric: 10 partner review calls booked");
    expect(studioAiBrief.value).toContain("Recommended next step: Improve with AI if you want a more tailored draft, or create the campaign now.");
    expect(studioAiBrief.value).toContain("Channel execution:");
    expect(studioAiBrief.value).toContain("Tracking links:");
    expect(studioAiBrief.value).toContain("utm_medium=linkedin");
    expect(studioAiBrief.value).toContain("AI task:");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-ai-command-brief"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign studio AI command brief"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("AI launch brief copied.");
    expect(screen.getByTestId("marketing-campaign-studio-execution-map")).toHaveTextContent("Channel execution map");
    expect(screen.getByTestId("marketing-campaign-studio-execution-map")).toHaveTextContent("1 route");
    expect(screen.getByTestId("marketing-campaign-studio-execution-map-linkedin")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-execution-map-linkedin")).toHaveTextContent("Manual publishing");
    expect(screen.getByTestId("marketing-campaign-studio-execution-map-linkedin")).toHaveTextContent("Create the LinkedIn plan, then publish or track it outside VYVA.");
    expect(screen.getByTestId("marketing-campaign-studio-execution-map-linkedin")).toHaveTextContent("1 recipient");
    expect(screen.getByTestId("marketing-campaign-studio-execution-map-linkedin")).toHaveTextContent("Handoff route");
    expect(screen.getByTestId("button-marketing-campaign-studio-execution-map-copy-linkedin")).toHaveTextContent("Copy run sheet");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-execution-map-copy-linkedin"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn publishing run sheet"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("LinkedIn publishing run sheet copied.");
    expect(screen.getByTestId("marketing-campaign-studio-launch-path")).toHaveTextContent("Recommended launch path");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-path-goal")).toHaveTextContent("B2B partner introduction");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-path-audience")).toHaveTextContent("Partners");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-path-channels")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-path-templates")).toHaveTextContent("Template pack");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-path-templates")).toHaveTextContent("templates cover");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-path-templates")).toHaveTextContent("Customize kit");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-path-plan")).toHaveTextContent("Create full launch kit");
    expect(screen.getByTestId("button-marketing-campaign-studio-command-primary")).toHaveTextContent("Improve with AI");
    expect(screen.getByTestId("button-marketing-campaign-studio-command-secondary")).toHaveTextContent("Create now");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-command-copy-packet"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign launch packet"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("One-page launch packet copied.");
    expect(screen.getByTestId("marketing-campaign-studio-launch-sequence")).toHaveTextContent("Launch sequence");
    expect(screen.getByTestId("marketing-campaign-studio-launch-sequence")).toHaveTextContent("Next best actions");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-audience")).toHaveTextContent("Audience list selected");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-copy")).toHaveTextContent("Improve with AI");
    expect(screen.getByTestId("button-marketing-campaign-studio-launch-create")).toHaveTextContent("Create now");
    expect(screen.getByTestId("marketing-campaign-studio-launch-packet")).toHaveTextContent("One-page launch packet");
    expect(screen.getByTestId("marketing-campaign-studio-launch-packet")).toHaveTextContent("Copy the whole campaign handoff");
    const launchPacket = screen.getByTestId("textarea-marketing-campaign-studio-launch-packet") as HTMLTextAreaElement;
    expect(launchPacket.value).toContain("VYVA campaign launch packet");
    expect(launchPacket.value).toContain("Campaign: B2B partner introduction");
    expect(launchPacket.value).toContain("Owner: Karim campaign owner");
    expect(launchPacket.value).toContain("Success metric: 10 partner review calls booked");
    expect(launchPacket.value).toContain("Hook: A gentle invite: Partner outreach: proof point");
    expect(launchPacket.value).toContain("Audience: Partners (B2B)");
    expect(launchPacket.value).toContain("Channel plan:");
    expect(launchPacket.value).toContain("LinkedIn: Manual publishing");
    expect(launchPacket.value).toContain("Tracking links:");
    expect(launchPacket.value).toContain("utm_campaign=b2b-partner-introduction");
    expect(launchPacket.value).toContain("Relationship follow-up:");
    expect(launchPacket.value).toContain("Outcome tracking:");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-launch-packet"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign launch packet"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("One-page launch packet copied.");
    expect(screen.getByTestId("marketing-campaign-studio-publishing-assistant")).toHaveTextContent("Channel publishing assistant");
    expect(screen.getByTestId("marketing-campaign-studio-publish-queue")).toHaveTextContent("Publish queue");
    expect(screen.getByTestId("marketing-campaign-studio-publish-queue-linkedin")).toHaveTextContent("Social/media owner");
    expect(screen.getByTestId("marketing-campaign-studio-publish-queue-linkedin")).toHaveTextContent("LinkedIn post, page, campaign manager, or creator workflow");
    expect(screen.getByTestId("marketing-campaign-studio-publish-queue-linkedin")).toHaveTextContent("platform URL");
    expect(screen.getByTestId("marketing-campaign-studio-publishing-route-linkedin")).toHaveTextContent("LinkedIn publish and track");
    expect(screen.getByTestId("marketing-campaign-studio-publishing-route-linkedin")).toHaveTextContent("Social publish");
    const linkedinRunSheet = screen.getByTestId("textarea-marketing-campaign-studio-publishing-linkedin") as HTMLTextAreaElement;
    expect(linkedinRunSheet.value).toContain("LinkedIn publishing run sheet");
    expect(linkedinRunSheet.value).toContain("Owner: Social/media owner");
    expect(linkedinRunSheet.value).toContain("Destination: LinkedIn post, page, campaign manager, or creator workflow");
    expect(linkedinRunSheet.value).toContain("Platform URL or message batch");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-publishing-linkedin"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn publishing run sheet"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("LinkedIn publishing run sheet copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-publishing-guide"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Track after publish"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Channel publishing guide copied.");
    expect(screen.getByTestId("marketing-campaign-studio-follow-up-loop")).toHaveTextContent("Relationship follow-up loop");
    expect(screen.getByTestId("marketing-campaign-studio-follow-up-warm-reply")).toHaveTextContent("Warm reply or demo request");
    expect(screen.getByTestId("marketing-campaign-studio-follow-up-clicked-no-reply")).toHaveTextContent("Clicked or opened, no reply");
    const warmReplyPlay = screen.getByTestId("textarea-marketing-campaign-studio-follow-up-warm-reply") as HTMLTextAreaElement;
    expect(warmReplyPlay.value).toContain("Warm reply follow-up");
    expect(warmReplyPlay.value).toContain("Relationship notes to capture");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-follow-up-warm-reply"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Warm reply follow-up"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Warm reply or demo request copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-follow-up-playbook"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Consent and relationship cleanup"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Relationship follow-up playbook copied.");
    expect(screen.getByTestId("marketing-campaign-studio-outcome-tracker")).toHaveTextContent("Outcome tracker");
    expect(screen.getByTestId("marketing-campaign-studio-outcome-human-response")).toHaveTextContent("Human responses");
    expect(screen.getByTestId("marketing-campaign-studio-outcome-next-campaign")).toHaveTextContent("Next campaign move");
    const outcomeTracker = screen.getByTestId("textarea-marketing-campaign-studio-outcome-human-response") as HTMLTextAreaElement;
    expect(outcomeTracker.value).toContain("Human response outcome log");
    expect(outcomeTracker.value).toContain("Relationship goal");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-outcome-human-response"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Human response outcome log"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Human responses copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-outcome-tracker"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Next campaign decision sheet"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Outcome tracker pack copied.");
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
    expect(screen.getByTestId("marketing-campaign-studio-visual-kit")).toHaveTextContent("AI visual production pack");
    expect(screen.getByTestId("marketing-campaign-studio-visual-kit")).toHaveTextContent("Email hero image prompt");
    expect(screen.getByTestId("marketing-campaign-studio-visual-kit")).toHaveTextContent("Short video / story storyboard");
    const heroPrompt = screen.getByTestId("textarea-marketing-campaign-studio-visual-email-hero") as HTMLTextAreaElement;
    expect(heroPrompt.value).toContain("Audience: Partners");
    expect(heroPrompt.value).toContain("no readable text inside the image");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-visual-social-square"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Social square image prompt"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Social square image prompt copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-visual-kit"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Print / QR layout brief"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Visual asset kit copied.");
    expect(screen.getByTestId("marketing-campaign-studio-approval-pack")).toHaveTextContent("Approval and publishing");
    expect(screen.getByTestId("marketing-campaign-studio-approval-pack")).toHaveTextContent("Approval brief");
    expect(screen.getByTestId("marketing-campaign-studio-approval-pack")).toHaveTextContent("Publishing checklist");
    const approvalBrief = screen.getByTestId("textarea-marketing-campaign-studio-approval-approval-brief") as HTMLTextAreaElement;
    expect(approvalBrief.value).toContain("Campaign approval brief");
    expect(approvalBrief.value).toContain("Audience: Partners");
    expect(approvalBrief.value).toContain("Owner: Karim campaign owner");
    expect(approvalBrief.value).toContain("Success metric: 10 partner review calls booked");
    expect(approvalBrief.value).toContain("CTA: I want the details");
    expect(approvalBrief.value).toContain("Channel execution:");
    const publishingChecklist = screen.getByTestId("textarea-marketing-campaign-studio-approval-publishing-checklist") as HTMLTextAreaElement;
    expect(publishingChecklist.value).toContain("Campaign publishing checklist");
    expect(publishingChecklist.value).toContain("Channel plan:");
    expect(publishingChecklist.value).toContain("LinkedIn: Manual publishing");
    expect(publishingChecklist.value).toContain("Human/offline handoffs:");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-approval-pack"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Campaign publishing checklist"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Approval and publishing pack copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-launch-copy"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/ai/campaign-draft", expect.objectContaining({ method: "POST" }));
    });
    const aiDraftCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(JSON.parse(String(aiDraftCall?.[1]?.body ?? "{}"))).toMatchObject({
      angle: "proof",
      angleGuidance: expect.stringContaining("Lead with proof"),
      ownerName: "Karim campaign owner",
      successMetric: "10 partner review calls booked",
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
  }, 60000);

  it("recommends and loads template packs directly inside the campaign studio", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
    renderPage();

    expect(await screen.findByTestId("marketing-campaign-studio")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-play-b2b-partner-outreach"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign play loaded: Partner outreach with LinkedIn and Email.");

    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Best-fit template packs");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-partner-growth")).toHaveTextContent("Partner growth");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-partner-growth")).toHaveTextContent("7 templates");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-partner-growth")).toHaveTextContent("Built for Partner outreach");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-preview-partner-growth")).toHaveTextContent("Creation preview");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-preview-partner-growth")).toHaveTextContent("new assets if saved from this pack");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-preview-partner-growth")).toHaveTextContent("Covers selected route pack");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-template-pack-ai-partner-growth"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA template pack AI command"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Partner growth AI command copied.");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-template-pack-partner-growth"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Template pack loaded: Partner growth");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("linkedin");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-timeline")).toHaveTextContent("Channel launch timeline");
    expect(screen.getByTestId("marketing-campaign-studio-channel-timeline-linkedin")).toHaveTextContent("Partner proof post");
    expect(screen.getByTestId("marketing-campaign-studio-channel-timeline-linkedin")).toHaveTextContent("Partner owner");
    expect(screen.getByTestId("marketing-campaign-studio-channel-timeline-email")).toHaveTextContent("Primary email send");
    expect(screen.getByTestId("marketing-campaign-studio-channel-timeline-whatsapp")).toHaveTextContent("Direct reply nudge");
    expect(screen.getByTestId("marketing-campaign-studio-tracking-links")).toHaveTextContent("Use one CTA, track every route");
    expect(screen.getByTestId("marketing-campaign-studio-tracking-link-linkedin")).toHaveTextContent("utm_source=vyva");
    expect(screen.getByTestId("marketing-campaign-studio-tracking-link-linkedin")).toHaveTextContent("utm_medium=linkedin");
    expect(screen.getByTestId("marketing-campaign-studio-tracking-link-email")).toHaveTextContent("VYVA email link");
    expect(screen.getByTestId("marketing-campaign-studio-localization")).toHaveTextContent("Localization readiness");
    expect(screen.getByTestId("marketing-campaign-studio-localization-en")).toHaveTextContent("English");
    expect(screen.getByTestId("marketing-campaign-studio-localization-en")).toHaveTextContent("2/4 routes");
    expect(screen.getByTestId("marketing-campaign-studio-localization-en")).toHaveTextContent("Needs localized WhatsApp and Facebook copy");
    expect(screen.getByTestId("marketing-campaign-studio-relationship-follow-up")).toHaveTextContent("Relationship follow-up plan");
    expect(screen.getByTestId("marketing-campaign-studio-relationship-follow-up-warm-reply")).toHaveTextContent("Warm reply or demo request");
    expect(screen.getByTestId("marketing-campaign-studio-relationship-follow-up-clicked-no-reply")).toHaveTextContent("Clicked or opened, no reply");
    expect(screen.getByTestId("marketing-campaign-studio-relationship-follow-up-silent-audience")).toHaveTextContent("No response after 5 days");
    expect(screen.getByTestId("marketing-campaign-studio-test-preview")).toHaveTextContent("Test preview");
    expect(screen.getByTestId("marketing-campaign-studio-test-preview-linkedin")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-test-preview-linkedin")).toHaveTextContent("Sample:");
    expect(screen.getByTestId("marketing-campaign-studio-test-preview-linkedin")).toHaveTextContent("CTA:");
    expect(screen.getByTestId("marketing-campaign-studio-reusable-assets")).toHaveTextContent("Reusable assets");
    expect(screen.getByTestId("marketing-campaign-studio-reusable-asset-linkedin")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-campaign-studio-reusable-asset-linkedin")).toHaveTextContent("Imported Source asset");
    expect(screen.getByTestId("marketing-campaign-studio-preflight")).toHaveTextContent("Preflight review");
    expect(screen.getByTestId("marketing-campaign-studio-preflight-audience")).toHaveTextContent("Audience and consent");
    expect(screen.getByTestId("marketing-campaign-studio-preflight-content")).toHaveTextContent("Content and reusable assets");
    expect(screen.getByTestId("marketing-campaign-studio-preflight-tracking")).toHaveTextContent("CTA and tracking");
    expect(screen.getByTestId("marketing-campaign-studio-delivery-map")).toHaveTextContent("Audience delivery map");
    expect(screen.getByTestId("marketing-campaign-studio-delivery-map-counts")).toHaveTextContent("Opted in");
    expect(screen.getByTestId("marketing-campaign-studio-delivery-map-counts")).toHaveTextContent("Needs review");
    expect(screen.getByTestId("marketing-campaign-studio-delivery-exclusion-contact-2")).toHaveTextContent("Consent pending");
    expect(screen.getByTestId("marketing-campaign-studio-delivery-exclusion-contact-2")).toHaveTextContent("LinkedIn");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-use-reusable-asset-linkedin"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("LinkedIn reusable asset loaded: Partner post.");
    expect(screen.getByTestId("marketing-campaign-studio-test-preview-linkedin")).toHaveTextContent("Read more");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-channel-timeline"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Campaign launch timeline"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Channel launch timeline copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-tracking-links"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign tracking links"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign tracking links copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-localization"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign localization brief"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Language coverage:"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign localization brief copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-relationship-follow-up"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign relationship follow-up brief"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Operating rule: replies, clicks, silence, opt-outs, and manual outcomes"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign relationship follow-up brief copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-preflight"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign preflight review"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign preflight review copied.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-copy-test-preview-linkedin"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA channel test preview"));
    });
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("LinkedIn test preview copied.");
  });

  it("shows a channel route board and updates campaign studio routes", async () => {
    renderPage();

    expect(await screen.findByTestId("marketing-campaign-studio")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-play-b2b-partner-outreach"));
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Campaign play loaded: Partner outreach with LinkedIn and Email.");

    expect(screen.getByTestId("marketing-campaign-studio-channel-route-board")).toHaveTextContent("Channel route board");
    expect(screen.getByTestId("marketing-campaign-studio-channel-route-linkedin")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-route-linkedin")).toHaveTextContent("Manual handoff");
    expect(screen.getByTestId("marketing-campaign-studio-channel-route-linkedin")).toHaveTextContent("Selected");
    expect(screen.getByTestId("marketing-campaign-studio-channel-route-linkedin")).toHaveTextContent("Primary");
    expect(screen.getByTestId("marketing-campaign-studio-channel-route-email")).toHaveTextContent("VYVA send");
    expect(screen.getByTestId("marketing-campaign-studio-channel-route-email")).toHaveTextContent("Selected");
    expect(screen.getByTestId("marketing-campaign-studio-optimized-pack-preview")).toHaveTextContent("Smart route optimizer");
    expect(screen.getByTestId("marketing-campaign-studio-optimized-pack-preview")).toHaveTextContent("Best pack now");
    expect(screen.getByTestId("marketing-campaign-studio-optimized-pack-route-linkedin")).toHaveTextContent("Primary");
    expect(screen.getByTestId("marketing-campaign-studio-launch-kit-coverage")).toHaveTextContent("Launch kit coverage");
    expect(screen.getByTestId("marketing-campaign-studio-launch-kit-coverage-social")).toHaveTextContent("Covered");
    expect(screen.getByTestId("marketing-campaign-studio-launch-kit-coverage-email")).toHaveTextContent("Covered");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-optimized-pack"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Optimized channel pack applied");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-route-primary-email"));

    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Email is now the primary campaign route.");
    expect(screen.getByTestId("marketing-campaign-studio-channel-route-email")).toHaveTextContent("Primary");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-route-toggle-linkedin"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("LinkedIn removed from the campaign route plan.");
    expect(within(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).queryByText("LinkedIn")).not.toBeInTheDocument();
  });

  it("turns relationship opportunities into campaign studio setup", async () => {
    renderPage();

    expect(await screen.findByTestId("marketing-campaign-studio")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-studio-relationship-opportunities")).toHaveTextContent("Turn audience signals into campaigns");
    expect(screen.getByTestId("marketing-campaign-studio-relationship-queue-partner-nurture")).toHaveTextContent("B2B partner nurture");
    expect(screen.getByTestId("marketing-campaign-studio-relationship-queue-partner-nurture")).toHaveTextContent("1 partner");
    expect(screen.getByTestId("marketing-campaign-studio-relationship-queue-partner-nurture")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-relationship-queue-partner-nurture")).toHaveTextContent("LinkedIn");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-relationship-use-partner-nurture"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Relationship queue loaded: B2B partner nurture");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-preview")).toHaveTextContent("B2B partner introduction");
    expect(screen.getByTestId("input-marketing-campaign-recipient-filter")).toHaveValue("hassan@example.com");
  });

  it("matches a plain-language campaign intent into a studio plan", async () => {
    renderPage();

    expect(await screen.findByTestId("marketing-campaign-studio")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-intent-brief")).toHaveTextContent("Tell VYVA what you want to run");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Grow partner pipeline");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Build clinic referral path");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Launch community partner path");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Support care transition");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Grow family referrals");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Run seasonal wellbeing check");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Run local event operations");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Reactivate quiet families");
    expect(screen.getByTestId("marketing-campaign-goal-presets")).toHaveTextContent("Pack: Care confidence reactivation");
    expect(screen.getByTestId("button-marketing-campaign-goal-grow-partner-pipeline")).toHaveTextContent("Ready");
    expect(screen.getByTestId("button-marketing-campaign-goal-grow-partner-pipeline")).toHaveTextContent("1 reachable contact");
    expect(screen.getByTestId("button-marketing-campaign-goal-grow-partner-pipeline")).toHaveTextContent("starter template");
    expect(screen.getByTestId("button-marketing-campaign-goal-grow-partner-pipeline")).toHaveTextContent("Best list: Partners");
    expect(screen.getByTestId("button-marketing-campaign-goal-reactivate-quiet-families")).toHaveTextContent("Ready");
    expect(screen.getByTestId("button-marketing-campaign-goal-reactivate-quiet-families")).toHaveTextContent("1 reachable contact");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Monthly care digest");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Partner webinar");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Community partner launch");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Clinic referral");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Care transition");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Family referral");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Seasonal check-in");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Event run sheet");
    expect(screen.getByTestId("marketing-campaign-intent-quick-starts")).toHaveTextContent("Routine activation");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-goal-reactivate-quiet-families"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Goal preset matched to Reactivation");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Care confidence reactivation template pack");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Care confidence reactivation");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("Reactivate quiet family contacts");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Audience reactivation");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-intent-quick-monthly-care-digest"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Quick idea matched to Monthly care digest");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("monthly care digest");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Monthly care digest");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-intent-quick-routine-activation"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Quick idea matched to Routine activation");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Routine activation");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("Activate new users into one repeatable VYVA routine");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Daily routine activation");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-intent-quick-clinic-referral"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Quick idea matched to Clinic referral pathway");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Clinic and pharmacy referral");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("clinic and pharmacy referral pathway");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("TikTok");
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Clinic referral pathway");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-intent-quick-community-partner-launch"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Quick idea matched to Community partner launch");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Community partner launch");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("community partner launch");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Community partner launch");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-intent-quick-care-transition"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Quick idea matched to Care transition support");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Care transition support");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("care transition campaign");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Care transition support");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("both");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-intent-quick-family-referral"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Quick idea matched to Family referral ambassador");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Family referral ambassador");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("family referral and ambassador campaign");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Instagram");
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Family referral ambassador");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("both");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-intent-quick-seasonal-wellbeing"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Quick idea matched to Seasonal check-in");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Seasonal wellbeing check");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("seasonal wellbeing check-in");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("warm");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Print / direct mail");
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Seasonal care check-in");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2c");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-goal-run-local-event-operations"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Goal preset matched to Local event");
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Local event operations template pack");
    expect(screen.getByTestId("marketing-campaign-studio-template-pack-recommendations")).toHaveTextContent("Local event operations");
    expect((screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement).value).toContain("Run a local community event");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("event");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("direct");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Local event");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("SMS");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");

    fireEvent.change(screen.getByTestId("textarea-marketing-campaign-intent"), {
      target: { value: "Invite Madrid partners to a practical webinar by email and LinkedIn." },
    });
    fireEvent.click(screen.getByTestId("button-marketing-apply-campaign-intent"));

    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("Brief matched to Partner webinar");
    expect(screen.getByTestId("select-marketing-campaign-studio-tone")).toHaveValue("expert");
    expect(screen.getByTestId("select-marketing-campaign-studio-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-studio-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("marketing-campaign-studio-category-hint")).toHaveTextContent("B2B outreach");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-studio-channel-pack-preview")).toHaveTextContent("LinkedIn");

    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Partner webinar invitation");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2b");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("input-marketing-campaign-recipient-filter")).toHaveValue("Partners");
    expect((screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement).value).toContain("Campaign brief: Invite Madrid partners");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-studio-launch-copy"));
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent("AI drafts generated for 2 channels");
    });
    const aiDraftCalls = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/ai/campaign-draft" && init?.method === "POST");
    expect(aiDraftCalls.map(([, init]) => JSON.parse(String(init?.body ?? "{}")).channel)).toEqual(["email", "linkedin"]);
    expect(aiDraftCalls.map(([, init]) => JSON.parse(String(init?.body ?? "{}")).campaignBrief)).toEqual([
      "Invite Madrid partners to a practical webinar by email and LinkedIn.",
      "Invite Madrid partners to a practical webinar by email and LinkedIn.",
    ]);
  });

  it("creates linked campaign and content directly from the smart studio", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
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
    expect(aiDraftCalls.map(([, init]) => JSON.parse(String(init?.body ?? "{}")).angle)).toEqual(["proof", "proof"]);
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
        angle: "proof",
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
        angle: "proof",
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
          angle: "proof",
          generatedSource: "openai",
          selectedChannels: ["linkedin", "email"],
        },
        relationshipFollowUpPlan: [
          expect.objectContaining({
            key: "warm-reply",
            title: "Warm reply or demo request",
            owner: "Partner/sales owner",
          }),
          expect.objectContaining({
            key: "clicked-no-reply",
            title: "Clicked or opened, no reply",
          }),
          expect.objectContaining({
            key: "silent-audience",
            title: "No response after 5 days",
          }),
          expect.objectContaining({
            key: "opt-out-cleanup",
            title: "Opt-out, wrong fit, or bad contact",
          }),
        ],
        relationshipFollowUpBrief: expect.stringContaining("VYVA campaign relationship follow-up brief"),
        studioLaunchKit: {
          generatedFrom: "marketing_campaign_studio",
          playId: "b2b-partner-outreach",
          playTitle: "Partner outreach",
          selectedChannels: ["linkedin", "email"],
          primaryChannel: "linkedin",
          launchPacketText: expect.stringContaining("VYVA campaign launch packet"),
          routeSummary: "LinkedIn + Email",
          executionPlan: [
            expect.objectContaining({
              channel: "linkedin",
              sendMode: "Manual publishing",
              nextAction: expect.stringContaining("publish or track it outside VYVA"),
              recipientCount: 1,
            }),
            expect.objectContaining({
              channel: "email",
              sendMode: "VYVA email send",
              nextAction: expect.stringContaining("send from the campaign details"),
              recipientCount: 1,
            }),
          ],
          channelCopyBoard: expect.objectContaining({
            text: expect.stringContaining("VYVA campaign channel copy board"),
            items: expect.arrayContaining([
              expect.objectContaining({
                channel: "linkedin",
                title: "LinkedIn copy block",
                sampleContact: "Hassan Partner",
                publishNote: expect.stringContaining("Publish manually in LinkedIn"),
                text: expect.stringContaining("LinkedIn campaign copy block"),
              }),
              expect.objectContaining({
                channel: "email",
                title: "Email copy block",
                text: expect.stringContaining("Email campaign copy block"),
              }),
            ]),
          }),
          distributionChecklist: expect.objectContaining({
            text: expect.stringContaining("VYVA campaign distribution checklist"),
            items: expect.arrayContaining([
              expect.objectContaining({
                channel: "linkedin",
                title: "LinkedIn publishing checklist",
                destination: "LinkedIn post composer",
                proofToCapture: expect.stringContaining("Published URL"),
                text: expect.stringContaining("LinkedIn distribution checklist"),
              }),
              expect.objectContaining({
                channel: "email",
                title: "Email publishing checklist",
                destination: "VYVA campaign details > Email send review",
                text: expect.stringContaining("Email distribution checklist"),
              }),
            ]),
          }),
          segmentPersonalization: expect.objectContaining({
            text: expect.stringContaining("VYVA campaign segment personalization matrix"),
            items: expect.arrayContaining([
              expect.objectContaining({
                basis: "Market",
                label: "Spain",
                bestChannel: "linkedin",
                opener: expect.stringContaining("Spain"),
                proofAngle: expect.stringContaining("local usefulness"),
              }),
            ]),
          }),
          publishingRunSheets: [
            expect.objectContaining({
              channel: "linkedin",
              text: expect.stringContaining("LinkedIn publishing run sheet"),
            }),
            expect.objectContaining({
              channel: "email",
              text: expect.stringContaining("Email publishing run sheet"),
            }),
          ],
          creativeDirections: [
            expect.objectContaining({
              channel: "linkedin",
              title: "LinkedIn creative direction",
              assetTitle: "Social square image prompt",
              text: expect.stringContaining("LinkedIn creative direction"),
            }),
            expect.objectContaining({
              channel: "email",
              title: "Email creative direction",
              assetTitle: "Email hero image prompt",
              text: expect.stringContaining("Email creative direction"),
            }),
          ],
          brandReview: expect.objectContaining({
            state: "ready",
            text: expect.stringContaining("VYVA campaign brand review board"),
            items: expect.arrayContaining([
              expect.objectContaining({
                key: "brand",
                title: "Brand fit",
              }),
              expect.objectContaining({
                key: "claims",
                value: "No risky claim flagged",
              }),
              expect.objectContaining({
                key: "handoff",
                title: "Production handoff",
              }),
            ]),
          }),
          productionLoad: expect.objectContaining({
            state: "planning",
            summary: "Manual work planned",
            totalMinutes: 45,
            text: expect.stringContaining("VYVA campaign production workload"),
            items: expect.arrayContaining([
              expect.objectContaining({
                channel: "linkedin",
                owner: "Social publishing owner",
                estimateMinutes: 20,
                text: expect.stringContaining("LinkedIn production task"),
              }),
              expect.objectContaining({
                channel: "email",
                owner: "Partner owner",
                estimateMinutes: 25,
                text: expect.stringContaining("Email production task"),
              }),
            ]),
          }),
          templateProduction: expect.objectContaining({
            state: "ready",
            text: expect.stringContaining("VYVA campaign template production kit"),
            items: expect.arrayContaining([
              expect.objectContaining({
                channel: "linkedin",
                contentType: "LinkedIn post",
                audienceSegment: "Market: Spain",
                text: expect.stringContaining("LinkedIn template production brief"),
              }),
              expect.objectContaining({
                channel: "email",
                contentType: "Email template",
                personalizationTokens: expect.arrayContaining(["{{first_name}}", "{{company_name}}"]),
                text: expect.stringContaining("Email template production brief"),
              }),
            ]),
          }),
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
    expect(screen.getByTestId("marketing-campaign-action-queue")).toHaveTextContent("Next actions");
    expect(screen.getByTestId("marketing-campaign-action-queue")).toHaveTextContent("Copy channel run sheets");
    expect(screen.getByTestId("marketing-campaign-action-queue")).toHaveTextContent("Copy full launch packet");
    expect(screen.getByTestId("button-marketing-campaign-action-copy-run-sheets")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-saved-launch-packet")).toHaveTextContent("Partner outreach");
    expect(screen.getByTestId("marketing-campaign-saved-launch-packet")).toHaveTextContent("2 routes");
    expect(screen.getByTestId("marketing-campaign-saved-run-sheets")).toHaveTextContent("Operator run sheets");
    expect(screen.getByTestId("marketing-campaign-saved-run-sheet-list")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("marketing-campaign-saved-run-sheet-list")).toHaveTextContent("Email review and send");
    expect(screen.getByTestId("marketing-campaign-saved-approval-pack")).toHaveTextContent("Approval brief");
    expect(screen.getByTestId("marketing-campaign-saved-distribution-checklist")).toHaveTextContent("Distribution checklist");
    expect(screen.getByTestId("marketing-campaign-saved-distribution-checklist-items")).toHaveTextContent("LinkedIn publishing checklist");
    expect(screen.getByTestId("marketing-campaign-saved-distribution-checklist-items")).toHaveTextContent("LinkedIn post composer");
    expect(screen.getByTestId("marketing-campaign-saved-distribution-checklist-items")).toHaveTextContent("Email publishing checklist");
    expect(screen.getByTestId("marketing-campaign-saved-distribution-checklist-items")).toHaveTextContent("VYVA campaign details > Email send review");
    fireEvent.click(screen.getByTestId("button-marketing-copy-saved-distribution-checklist"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign distribution checklist"));
    });
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Saved distribution checklist copied.");
    expect(screen.getByTestId("button-marketing-copy-saved-run-sheet-linkedin")).toBeInTheDocument();
    expect((screen.getByTestId("textarea-marketing-campaign-saved-launch-packet") as HTMLTextAreaElement).value).toContain("VYVA campaign launch packet");
    expect((screen.getByTestId("textarea-marketing-campaign-saved-launch-packet") as HTMLTextAreaElement).value).toContain("Channel plan:");
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

  it("creates multi-channel planner packs without auto-dispatching", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-pack-partner"));
    expect(screen.getByTestId("marketing-campaign-channel-packs")).toHaveTextContent("2 routes");
    expect(screen.getByTestId("marketing-campaign-draft-readiness-channels")).toHaveTextContent("Email and LinkedIn");

    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "Partner launch pack" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-audience"), { target: { value: "b2b" } });
    fireEvent.change(screen.getByTestId("select-marketing-campaign-content"), { target: { value: "content-1" } });
    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("1/2 linked");
    fireEvent.change(screen.getByTestId("select-marketing-campaign-route-content-linkedin"), { target: { value: "content-2" } });
    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("2/2 linked");
    expect(screen.getByTestId("marketing-campaign-draft-readiness-content")).toHaveTextContent("2 content assets linked across Email and LinkedIn");
    fireEvent.change(screen.getByTestId("select-marketing-campaign-target-audience"), { target: { value: "audience-1" } });
    fireEvent.change(screen.getByTestId("input-marketing-campaign-recipient-filter"), { target: { value: "Hassan" } });
    fireEvent.click(screen.getByTestId("checkbox-marketing-campaign-snapshot"));
    expect(screen.getByTestId("marketing-campaign-draft-recipient-preview")).toHaveTextContent("1");

    fireEvent.click(screen.getByTestId("button-marketing-create-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns", expect.objectContaining({ method: "POST" }));
    });
    const postCalls = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/campaigns" && init?.method === "POST");
    const postCall = postCalls[postCalls.length - 1];
    const postBody = JSON.parse(String(postCall?.[1]?.body));
    expect(postBody).toMatchObject({
      name: "Partner launch pack",
      audienceType: "b2b",
      channels: [
        { channel: "email", contentAssetId: "content-1" },
        { channel: "linkedin", contentAssetId: "content-2" },
      ],
      metadata: {
        planner: {
          primaryChannel: "email",
          selectedChannels: ["email", "linkedin"],
          channelPack: "partner",
          contentAssetIds: {
            email: "content-1",
            linkedin: "content-2",
          },
        },
      },
    });
    expect(postBody.recipients).toEqual(expect.arrayContaining([
      expect.objectContaining({ contactId: "contact-2", channel: "email", recipient: "hassan@example.com" }),
      expect.objectContaining({ contactId: "contact-2", channel: "linkedin", recipient: "hassan@example.com" }),
    ]));
    expect(postBody.recipients).toHaveLength(2);
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

  it("starts a relationship follow-up campaign from campaign results", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));

    expect(screen.getByTestId("marketing-campaign-relationship-follow-up")).toHaveTextContent("Responder nurture");
    expect(screen.getByTestId("marketing-campaign-relationship-follow-up-responders")).toHaveTextContent("8 signals");
    fireEvent.click(screen.getByTestId("button-marketing-start-relationship-follow-up"));

    expect(screen.queryByTestId("marketing-campaign-edit-form")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-studio-feedback")).toHaveTextContent('Follow-up campaign starter loaded from "Caregiver welcome".');
    expect(screen.getByTestId("input-marketing-campaign-name")).toHaveValue("Caregiver welcome responder follow-up");
    expect(screen.getByTestId("select-marketing-campaign-audience")).toHaveValue("b2c");
    expect(screen.getByTestId("select-marketing-campaign-channel")).toHaveValue("email");
    expect(screen.getByTestId("select-marketing-campaign-content")).toHaveValue("content-1");
    expect(screen.getByTestId("select-marketing-campaign-target-audience")).toHaveValue("audience-1");
    expect(screen.getByTestId("checkbox-marketing-campaign-snapshot")).toBeChecked();
    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("2/3 linked");
    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("WhatsApp");
    expect(screen.getByTestId("marketing-campaign-route-content-map")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("select-marketing-campaign-route-content-whatsapp")).toHaveValue("");
    expect(screen.getByTestId("select-marketing-campaign-route-content-linkedin")).toHaveValue("content-2");
    expect(screen.getByTestId("marketing-campaign-draft-recipient-preview")).toHaveTextContent("0");
    expect(screen.getByTestId("marketing-campaign-draft-readiness-recipients")).toHaveTextContent("No eligible recipients match these channels, list, and filter.");
    const intent = screen.getByTestId("textarea-marketing-campaign-intent") as HTMLTextAreaElement;
    expect(intent.value).toContain('Relationship follow-up from "Caregiver welcome".');
    expect(intent.value).toContain("Target list: Partners.");
    expect(intent.value).toContain("Recommended channels: Email, WhatsApp, and LinkedIn.");
    expect(intent.value).toContain("Signals: 8 engagement signals; 1 manual route to track.");
    expect(intent.value).toContain("VYVA relationship follow-up brief");
    const objective = screen.getByTestId("textarea-marketing-campaign-objective") as HTMLTextAreaElement;
    expect(objective.value).toContain('Follow-up campaign generated from "Caregiver welcome".');
    expect(objective.value).toContain("Audience/list: Partners.");
    expect(objective.value).toContain("Channels: Email, WhatsApp, and LinkedIn.");
  });

  it("duplicates an existing campaign as a clean editable draft", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));
    fireEvent.click(screen.getByTestId("button-marketing-duplicate-selected-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns", expect.objectContaining({ method: "POST" }));
    });
    const postCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/campaigns" && init?.method === "POST");
    const postBody = JSON.parse(String(postCall?.[1]?.body));

    expect(postBody).toMatchObject({
      name: "Copy of Caregiver welcome",
      audienceType: "b2c",
      status: "draft",
      objective: "Invite caregivers",
      scheduleStartsAt: null,
      scheduleEndsAt: null,
      timezone: "Europe/Madrid",
      source: "vyva_duplicate",
      lovableExternalId: null,
    });
    expect(postBody).not.toHaveProperty("recipients");
    expect(postBody.channels).toEqual([
      expect.objectContaining({ channel: "email", contentAssetId: "content-1", status: "draft", scheduledAt: null }),
      expect.objectContaining({ channel: "linkedin", contentAssetId: "content-2", status: "draft", scheduledAt: null }),
    ]);
    expect(postBody.metadata).toMatchObject({
      extraCampaignField: "from-lovable",
      lovable: { originalStatus: "queued" },
      targetAudience: { lovableExternalId: "lovable-audience-1" },
      duplicatedFrom: {
        campaignId: "campaign-1",
        name: "Caregiver welcome",
        source: "lovable",
        lovableExternalId: "lovable-campaign-1",
      },
    });
    expect(postBody.metadata.duplicatedFrom.duplicatedAt).toEqual(expect.any(String));

    await waitFor(() => {
      expect(screen.getByTestId("input-marketing-edit-campaign-name")).toHaveValue("Copy of Caregiver welcome");
    });
    expect(screen.getByTestId("select-marketing-edit-campaign-status")).toHaveValue("draft");
    expect(screen.getByTestId("input-marketing-edit-campaign-schedule")).toHaveValue("");
    expect(screen.getByTestId("input-marketing-edit-campaign-schedule-end")).toHaveValue("");
    expect(screen.getByTestId("input-marketing-edit-campaign-source")).toHaveValue("vyva_duplicate");
    expect(screen.getByTestId("input-marketing-edit-campaign-lovable-id")).toHaveValue("");
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("0");
  });

  it("edits, snapshots recipients for, blocks pending-consent sends, and deletes campaigns", async () => {
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
    expect(screen.getByTestId("marketing-campaign-operator-brief")).toHaveTextContent("Next best action");
    expect(screen.getByTestId("marketing-campaign-operator-brief-next")).toHaveTextContent("Launch email");
    expect(screen.getByTestId("marketing-campaign-operator-brief-reach")).toHaveTextContent("1 saved");
    expect(screen.getByTestId("marketing-campaign-operator-brief-creative")).toHaveTextContent("2/2 linked");
    expect(screen.getByTestId("marketing-campaign-operator-brief-channels")).toHaveTextContent("Email can send in VYVA; LinkedIn stay as manual handoff.");
    expect(screen.getByTestId("marketing-campaign-operator-next-action")).toHaveTextContent("Operator next action");
    expect(screen.getByTestId("marketing-campaign-operator-next-action")).toHaveTextContent("Launch email");
    expect(screen.getByTestId("marketing-campaign-operator-next-action")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending.");
    expect(screen.getByTestId("marketing-campaign-operator-next-action-summary")).toHaveTextContent("Email + manual");
    expect(screen.getByTestId("marketing-campaign-operator-next-action-summary")).toHaveTextContent("1 email route + 1 manual route");
    expect(screen.getByTestId("button-marketing-campaign-operator-next-action")).toHaveTextContent("Send campaign email");
    expect(screen.getByTestId("marketing-campaign-copilot")).toHaveTextContent("Campaign copilot");
    expect(screen.getByTestId("marketing-campaign-copilot")).toHaveTextContent("One guided step before launch");
    expect(screen.getByTestId("marketing-campaign-copilot-action-consent")).toHaveTextContent("Review recipient consent");
    expect(screen.getByTestId("marketing-campaign-copilot-action-consent")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-copilot-action-manual")).toHaveTextContent("Track manual channel");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-copilot-copy-brief"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign copilot command"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Recommended admin actions:"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Campaign copilot command copied.");
    expect(screen.getByTestId("marketing-campaign-operator-sheet")).toHaveTextContent("Operator sheet");
    expect(screen.getByTestId("marketing-campaign-operator-sheet-who")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-campaign-operator-sheet-who")).toHaveTextContent("1 saved recipient");
    expect(screen.getByTestId("marketing-campaign-operator-sheet-what")).toHaveTextContent("2/2 assets linked");
    expect(screen.getByTestId("marketing-campaign-operator-sheet-where")).toHaveTextContent("Email, LinkedIn");
    expect(screen.getByTestId("marketing-campaign-operator-sheet-risk")).toHaveTextContent("Review before launch");
    fireEvent.click(screen.getByTestId("button-marketing-copy-campaign-operator-sheet"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign operator sheet"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Risk gate: 1 saved email recipient needs opted-in consent before sending."));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Campaign operator sheet copied.");
    expect(screen.getByTestId("marketing-campaign-launch-decision")).toHaveTextContent("Launch decision");
    expect(screen.getByTestId("marketing-campaign-launch-decision")).toHaveTextContent("Review before launch");
    expect(screen.getByTestId("marketing-campaign-launch-decision")).toHaveTextContent("consent review");
    expect(screen.getByTestId("button-marketing-launch-decision-primary")).toHaveTextContent("Open contact");
    fireEvent.click(screen.getByTestId("button-marketing-copy-launch-decision"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA launch decision"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Decision: Review before launch"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Launch decision copied.");
    expect(screen.getByTestId("marketing-campaign-workspace-map")).toHaveTextContent("Campaign workspace");
    expect(screen.getByTestId("marketing-campaign-workspace-map-setup")).toHaveTextContent("Campaign setup");
    expect(screen.getByTestId("marketing-campaign-workspace-map-creative")).toHaveTextContent("2/2 linked");
    expect(screen.getByTestId("marketing-campaign-workspace-map-audience")).toHaveTextContent("1 saved");
    expect(screen.getByTestId("marketing-campaign-workspace-map-publish")).toHaveTextContent("Needs setup");
    expect(screen.getByTestId("marketing-campaign-workspace-map-follow-up")).toHaveTextContent("8 signals");
    expect(screen.getByTestId("button-marketing-campaign-workspace-map-follow-up")).toHaveTextContent("Start follow-up");
    expect(screen.getByTestId("marketing-campaign-launch-control")).toHaveTextContent("Launch control");
    expect(screen.getByTestId("marketing-campaign-launch-control-send")).toHaveTextContent("VYVA send");
    expect(screen.getByTestId("marketing-campaign-launch-control-send")).toHaveTextContent("Needs setup");
    expect(screen.getByTestId("marketing-campaign-launch-control-send")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending");
    expect(screen.getByTestId("marketing-campaign-launch-control-manual")).toHaveTextContent("Manual channels");
    expect(screen.getByTestId("marketing-campaign-launch-control-manual")).toHaveTextContent("1 route");
    expect(screen.getByTestId("button-marketing-campaign-launch-control-manual")).toHaveTextContent("Track first result");
    expect(screen.getByTestId("marketing-campaign-launch-control-audience")).toHaveTextContent("1 saved");
    expect(screen.getByTestId("marketing-campaign-launch-control-relationship")).toHaveTextContent("8 signals");
    expect(screen.getByTestId("marketing-campaign-approval-pass")).toHaveTextContent("Approval pass");
    expect(screen.getByTestId("marketing-campaign-approval-pass")).toHaveTextContent("2 approval items need review");
    expect(screen.getByTestId("marketing-campaign-approval-content")).toHaveTextContent("2 linked");
    expect(screen.getByTestId("marketing-campaign-approval-claims")).toHaveTextContent("No obvious medical");
    expect(screen.getByTestId("marketing-campaign-approval-consent")).toHaveTextContent("1 saved email recipient needs consent review");
    expect(screen.getByTestId("marketing-campaign-approval-tracking")).toHaveTextContent("Plan to track LinkedIn results");
    const approvalNote = screen.getByTestId("textarea-marketing-campaign-approval-note") as HTMLTextAreaElement;
    expect(approvalNote.value).toContain("VYVA campaign approval note");
    expect(approvalNote.value).toContain("Approval status: 2 approval items need review");
    expect(approvalNote.value).toContain("Publish only after the review items are accepted");
    fireEvent.click(screen.getByTestId("button-marketing-copy-campaign-approval-note"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign approval note"));
    });
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Campaign approval note copied.");
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Creative accelerator");
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Creative is ready to improve");
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("2/2");
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("No creative gaps");
    expect(screen.getByTestId("button-marketing-campaign-preview-first-content")).toHaveTextContent("Preview first content");
    expect(screen.getByTestId("button-marketing-campaign-copy-ai-creative-brief")).toHaveTextContent("Copy AI brief");
    expect(screen.getByTestId("marketing-campaign-creative-variant-prompts")).toHaveTextContent("AI variant prompts");
    expect(screen.getByTestId("marketing-campaign-creative-variant-prompt-subject")).toHaveTextContent("Subject/hook test");
    expect(screen.getByTestId("marketing-campaign-creative-variant-prompt-cta")).toHaveTextContent("CTA test");
    expect(screen.getByTestId("marketing-campaign-creative-variant-prompt-follow-up")).toHaveTextContent("Follow-up touch");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-copy-creative-variant-subject"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign subject/hook variant prompt"));
    });
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Subject/hook test copied.");
    expect(screen.getByTestId("marketing-campaign-ai-command-brief")).toHaveTextContent("AI command brief");
    const aiCommandBrief = screen.getByTestId("textarea-marketing-campaign-ai-command-brief") as HTMLTextAreaElement;
    expect(aiCommandBrief.value).toContain("VYVA campaign AI command brief");
    expect(aiCommandBrief.value).toContain("Campaign: Caregiver welcome");
    expect(aiCommandBrief.value).toContain("Current readiness:");
    expect(aiCommandBrief.value).toContain("Channel plan:");
    expect(aiCommandBrief.value).toContain("Linked content to improve:");
    expect(aiCommandBrief.value).toContain("Performance signals:");
    expect(aiCommandBrief.value).toContain("AI task:");
    fireEvent.click(screen.getByTestId("button-marketing-copy-campaign-ai-command-brief"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign AI command brief"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Suggest the next relationship follow-up"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Campaign AI command brief copied.");
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
    expect(screen.getByTestId("marketing-campaign-launch-step-launch")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending.");
    expect(screen.getByTestId("marketing-campaign-channel-workflow")).toHaveTextContent("From draft to tracked result");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-email")).toHaveTextContent("Email send workflow");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-email-content")).toHaveTextContent("Welcome email");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-email-audience")).toHaveTextContent("1 saved recipient");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-email-publish")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-email-track")).toHaveTextContent("10 imported metric rows");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-linkedin")).toHaveTextContent("LinkedIn handoff workflow");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-linkedin-content")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-linkedin-publish")).toHaveTextContent("Manual publishing");
    expect(screen.getByTestId("marketing-campaign-channel-workflow-linkedin-track")).toHaveTextContent("Track outcome after handoff");
    expect(screen.getByTestId("marketing-campaign-channel-runbook")).toHaveTextContent("One copyable route plan");
    expect(screen.getByTestId("marketing-campaign-channel-runbook-email")).toHaveTextContent("Email");
    expect(screen.getByTestId("marketing-campaign-channel-runbook-linkedin")).toHaveTextContent("Track result / Preview content");
    fireEvent.click(screen.getByTestId("button-marketing-copy-campaign-channel-runbook"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign channel runbook"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Working order:"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn: Blocked - LinkedIn handoff workflow"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Operator note: keep non-email publishing manual"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Campaign channel runbook copied.");
    expect(screen.getByTestId("button-marketing-campaign-channel-workflow-primary-linkedin")).toHaveTextContent("Track result");
    expect(screen.getByTestId("button-marketing-campaign-channel-workflow-secondary-linkedin")).toHaveTextContent("Preview content");
    expect(screen.getByTestId("marketing-campaign-publish-kit")).toHaveTextContent("Channel handoff plan");
    expect(screen.getByTestId("marketing-campaign-publish-kit-email")).toHaveTextContent("VYVA email send");
    expect(screen.getByTestId("marketing-campaign-publish-kit-email")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending");
    expect(screen.getByTestId("marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Manual publishing");
    expect(screen.getByTestId("marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Preview the content, then publish or track it in the channel tool.");
    expect(screen.getByTestId("button-marketing-campaign-publish-kit-secondary-linkedin")).toHaveTextContent("Track result");
    expect(screen.getByTestId("marketing-campaign-channel-action-queue")).toHaveTextContent("Next channel actions");
    expect(screen.getByTestId("marketing-campaign-channel-action-email")).toHaveTextContent("Fix email send blocker");
    expect(screen.getByTestId("marketing-campaign-channel-action-linkedin")).toHaveTextContent("Publish manually");
    expect(screen.getByTestId("marketing-campaign-channel-action-linkedin")).toHaveTextContent("No manual result saved yet.");
    expect(screen.getByTestId("button-marketing-campaign-channel-action-primary-linkedin")).toHaveTextContent("Copy handoff");
    expect(screen.getByTestId("button-marketing-campaign-channel-action-secondary-linkedin")).toHaveTextContent("Track result");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-channel-action-primary-linkedin"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Channel: LinkedIn"));
    });
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("LinkedIn handoff brief copied.");
    fireEvent.click(screen.getByTestId("button-marketing-copy-publish-copy-packet"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA campaign publish copy packet"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Email\n\nSubject: Welcome to VYVA"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("LinkedIn"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Partner update"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Read more: https://v2.vyva.life/partners"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Campaign publish copy packet copied.");
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
    expect(linkedinHandoffBrief.value).toContain("Source content ID: lovable-content-2");
    expect(screen.getByTestId("button-marketing-copy-publish-copy-linkedin")).toHaveTextContent("Copy publish copy");
    fireEvent.click(screen.getByTestId("button-marketing-copy-publish-copy-linkedin"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Partner update"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Read more: https://v2.vyva.life/partners"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Media refs:\n- https://cdn.example.test/partner.png"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("LinkedIn publish copy copied.");
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
    expect(screen.getByTestId("marketing-campaign-relationship-follow-up")).toHaveTextContent("What should happen after this campaign?");
    expect(screen.getByTestId("marketing-campaign-relationship-follow-up-responders")).toHaveTextContent("8 signals");
    expect(screen.getByTestId("marketing-campaign-relationship-follow-up-responders")).toHaveTextContent("1 reply");
    expect(screen.getByTestId("marketing-campaign-relationship-follow-up-handoff")).toHaveTextContent("1 route");
    expect(screen.getByTestId("marketing-campaign-relationship-follow-up-next-campaign")).toHaveTextContent("Responder nurture");
    fireEvent.click(screen.getByTestId("button-marketing-copy-relationship-follow-up"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA relationship follow-up brief"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Segment responders"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Manual follow-ups needed: 0"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Recipient follow-up queue:"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Hassan Partner via Email"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Campaign relationship follow-up brief copied.");
    expect(screen.getByTestId("marketing-campaign-recipient-follow-up-queue")).toHaveTextContent("Who should be followed up?");
    expect(screen.getByTestId("marketing-campaign-recipient-follow-up-recipient-1")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-campaign-recipient-follow-up-recipient-1")).toHaveTextContent("Review consent (pending)");
    expect(screen.getByTestId("button-marketing-open-recipient-follow-up-contact-recipient-1")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-marketing-copy-recipient-follow-up-recipient-1"));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("VYVA personal relationship follow-up"));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Recipient: Hassan Partner"));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("Consent: pending"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("Hassan Partner follow-up prompt copied.");
    expect(screen.getByTestId("marketing-campaign-channels-editor")).toHaveTextContent("LinkedIn");
    expect(screen.getByTestId("select-marketing-campaign-channel-content-1")).toHaveValue("content-2");
    expect(screen.getByTestId("marketing-campaign-manual-publish-tracker")).toHaveTextContent("Record what happened outside VYVA");
    expect(screen.getByTestId("marketing-campaign-manual-publish-results")).toHaveTextContent("No manual results recorded yet.");
    fireEvent.click(screen.getByTestId("button-marketing-campaign-publish-kit-secondary-linkedin"));
    expect(screen.getByTestId("marketing-campaign-handoff-copy-feedback")).toHaveTextContent("LinkedIn result tracker opened.");
    expect(screen.getByTestId("marketing-campaign-manual-publish-feedback")).toHaveTextContent("Add the LinkedIn publish result below");
    expect(screen.getByTestId("select-marketing-campaign-channel-status-1")).toHaveValue("published");
    expect(screen.getByTestId("marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Save campaign changes so this channel uses the latest content");
    expect(screen.getByTestId("button-marketing-campaign-publish-kit-secondary-linkedin")).toBeDisabled();
    expect(screen.getByTestId("select-marketing-manual-publish-channel")).toHaveValue("linkedin");
    fireEvent.change(screen.getByTestId("input-marketing-manual-publish-url"), { target: { value: "https://linkedin.com/posts/vyva-caregiver-welcome" } });
    fireEvent.change(screen.getByTestId("input-marketing-manual-publish-at"), { target: { value: "2026-07-06T10:30" } });
    fireEvent.change(screen.getByTestId("input-marketing-manual-publish-reached"), { target: { value: "240" } });
    fireEvent.change(screen.getByTestId("input-marketing-manual-publish-engagements"), { target: { value: "18" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-manual-publish-notes"), { target: { value: "Published by Karim; follow up with commenters tomorrow." } });
    fireEvent.click(screen.getByTestId("button-marketing-save-manual-publish-result"));

    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-manual-publish-feedback")).toHaveTextContent("LinkedIn publish result saved.");
    });
    const manualPatchCall = apiFetchMock.mock.calls.find(([path, init]) => {
      if (path !== "/api/admin/marketing/campaigns/campaign-1" || init?.method !== "PATCH") return false;
      const body = JSON.parse(String(init.body ?? "{}"));
      return Array.isArray(body.metadata?.manualPublishResults);
    });
    const manualPatchBody = JSON.parse(String(manualPatchCall?.[1]?.body));
    expect(manualPatchBody.metadata.manualPublishResults[0]).toMatchObject({
      channel: "linkedin",
      result: "published",
      url: "https://linkedin.com/posts/vyva-caregiver-welcome",
      notes: "Published by Karim; follow up with commenters tomorrow.",
      publishedAt: new Date("2026-07-06T10:30").toISOString(),
      audienceReached: 240,
      engagements: 18,
    });
    expect(manualPatchBody.channels).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: "linkedin", contentAssetId: "content-2", status: "published" }),
    ]));
    expect(screen.getByTestId("marketing-campaign-manual-publish-results")).toHaveTextContent("240 reached");
    expect(screen.getByTestId("marketing-campaign-manual-publish-results")).toHaveTextContent("18 engagements");
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
    expect(socialContentPreview).toHaveTextContent("Source ID: lovable-content-2");
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
    expect(screen.getByTestId("marketing-campaign-recipient-preview")).toHaveTextContent("2 channel snapshots");
    expect(screen.getByTestId("button-marketing-readiness-save-campaign")).toHaveTextContent("Save + snapshot recipients");
    expect(screen.getByTestId("marketing-campaign-readiness-email")).toHaveTextContent("Save campaign changes before test/live email send.");
    expect(screen.getByTestId("marketing-campaign-launch-step-test")).toHaveTextContent("Save before test");
    expect(screen.getByTestId("marketing-campaign-launch-step-launch")).toHaveTextContent("Save campaign changes before sending.");
    fireEvent.click(screen.getByTestId("button-marketing-readiness-save-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1", expect.objectContaining({ method: "PATCH" }));
    });
    const campaignPatchCalls = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/campaigns/campaign-1" && init?.method === "PATCH");
    const patchCall = campaignPatchCalls[campaignPatchCalls.length - 1];
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
        { channel: "linkedin", contentAssetId: "content-2", status: "published" },
      ],
    });
    expect(patchBody.recipients).toHaveLength(2);
    expect(patchBody.recipients).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contactId: "contact-2",
        channel: "email",
        recipient: "hassan@example.com",
        status: "planned",
        snapshot: expect.objectContaining({
          fullName: "Hassan Partner",
          editorChannel: "email",
          audienceList: expect.objectContaining({
            name: "Partners",
            source: "lovable",
            lovableExternalId: "lovable-audience-1",
          }),
        }),
      }),
      expect.objectContaining({
        contactId: "contact-2",
        channel: "linkedin",
        recipient: "hassan@example.com",
        status: "planned",
        snapshot: expect.objectContaining({
          fullName: "Hassan Partner",
          editorChannel: "linkedin",
          audienceList: expect.objectContaining({
            name: "Partners",
            source: "lovable",
            lovableExternalId: "lovable-audience-1",
          }),
        }),
      }),
    ]));
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

    expect(screen.getByTestId("button-marketing-send-campaign-email")).toBeDisabled();
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("1 saved email recipient needs opted-in consent before sending.");
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1/send-email", expect.anything());

    fireEvent.click(screen.getByTestId("button-marketing-delete-campaign-campaign-1"));
    expect(screen.getByTestId("button-marketing-delete-campaign-campaign-1")).toHaveTextContent("Confirm delete");
    expect(screen.getByTestId("marketing-campaign-delete-confirmation-campaign-1")).toHaveTextContent("Click Confirm delete to remove this campaign, its channels, and recipient snapshots.");
    fireEvent.click(screen.getByTestId("button-marketing-delete-campaign-campaign-1"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1", expect.objectContaining({ method: "DELETE" }));
    });
  }, 30000);

  it("sends email campaigns when saved recipients are opted in", async () => {
    renderPage({}, {
      contacts: contacts.map((contact) => contact.id === "contact-2" ? { ...contact, consentStatus: "opted_in" } : contact),
    });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));

    expect(screen.getByTestId("marketing-campaign-approval-consent")).toHaveTextContent("Saved email recipients are mapped with opted-in consent");
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

  it("suggests existing content matches for missing campaign routes", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-2"));

    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Fix the creative gap");
    expect(screen.getByTestId("marketing-campaign-content-match-panel")).toHaveTextContent("Smart content match");
    expect(screen.getByTestId("marketing-campaign-content-match-linkedin-0")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-campaign-content-match-linkedin-0")).toHaveTextContent("Imported from Source");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-use-content-match-linkedin-0"));

    expect(screen.getByTestId("select-marketing-edit-campaign-content")).toHaveValue("content-2");
    expect(screen.getByTestId("select-marketing-campaign-channel-content-0")).toHaveValue("content-2");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("LinkedIn content match attached: Partner post. Save the campaign to keep it.");
    expect(screen.queryByTestId("marketing-campaign-content-match-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Creative is ready to improve");

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

  it("applies all smart content matches for multi-channel campaign gaps", async () => {
    const campaignWithMultipleCreativeGaps = {
      ...campaigns[1],
      objective: "Warm partner B2B leads with email and LinkedIn outreach.",
      channels: [
        { id: "channel-2-email", channel: "email", contentAssetId: null, scheduledAt: null, status: "draft", sendCapability: "enabled" },
        { id: "channel-2-linkedin", channel: "linkedin", contentAssetId: null, scheduledAt: null, status: "draft", sendCapability: "planning_only" },
      ],
    };
    const partnerEmailContent = {
      id: "content-3",
      title: "Partner outreach email",
      channel: "email",
      language: "en",
      status: "draft",
      subject: "Partner outreach",
      body: "Warm partner B2B leads with email outreach.",
      source: "lovable",
      lovableExternalId: "lovable-content-3",
    };

    renderPage({}, {
      campaigns: [campaigns[0], campaignWithMultipleCreativeGaps],
      content: [...content, partnerEmailContent],
    });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-2"));

    expect(screen.getByTestId("marketing-campaign-content-match-panel")).toHaveTextContent("2 suggestions");
    expect(screen.getByTestId("marketing-campaign-content-match-email-0")).toHaveTextContent("Partner outreach email");
    expect(screen.getByTestId("marketing-campaign-content-match-linkedin-1")).toHaveTextContent("Partner post");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-use-all-content-matches"));

    expect(screen.getByTestId("select-marketing-edit-campaign-content")).toHaveValue("content-3");
    expect(screen.getByTestId("select-marketing-campaign-channel-content-0")).toHaveValue("content-3");
    expect(screen.getByTestId("select-marketing-campaign-channel-content-1")).toHaveValue("content-2");
    expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("2 content matches attached. Save the campaign to keep them.");
    expect(screen.queryByTestId("marketing-campaign-content-match-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-marketing-save-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-2", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/campaigns/campaign-2" && init?.method === "PATCH");
    const patchBody = JSON.parse(String(patchCall?.[1]?.body));
    expect(patchBody.channels).toEqual([
      expect.objectContaining({
        channel: "email",
        contentAssetId: "content-3",
      }),
      expect.objectContaining({
        channel: "linkedin",
        contentAssetId: "content-2",
      }),
    ]);
  });

  it("creates and links missing campaign channel content from the creative accelerator", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-2"));

    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Fix the creative gap");
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Create the missing LinkedIn content");
    expect(screen.getByTestId("button-marketing-campaign-create-missing-content")).toHaveTextContent("Create LinkedIn content");
    expect(screen.getByTestId("marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Content: Missing");
    expect(screen.getByTestId("marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Create a starter asset here");
    expect(screen.getByTestId("button-marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Create & link content");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-create-missing-content"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/content", expect.objectContaining({ method: "POST" }));
    });
    const contentPostCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
    const contentPostBody = JSON.parse(String(contentPostCall?.[1]?.body));
    expect(contentPostBody).toMatchObject({
      title: "Partner outreach LinkedIn content",
      channel: "linkedin",
      language: "en",
      status: "draft",
      body: expect.stringContaining("Warm B2B leads"),
      ctaLabel: "Book a demo",
      ctaUrl: "https://v2.vyva.life/demo",
    });
    expect(contentPostBody.designJson).toMatchObject({
      generator: "marketing_campaign_planner",
      campaignName: "Partner outreach",
      audienceType: "b2b",
      channel: "linkedin",
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-2", expect.objectContaining({ method: "PATCH" }));
    });
    const campaignPatchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/campaigns/campaign-2" && init?.method === "PATCH");
    const campaignPatchBody = JSON.parse(String(campaignPatchCall?.[1]?.body));
    expect(campaignPatchBody.channels).toEqual([
      expect.objectContaining({
        channel: "linkedin",
        contentAssetId: "content-created",
        status: "draft",
      }),
    ]);
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("LinkedIn content created, linked, and saved to this campaign.");
    });
    expect(screen.getByTestId("marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Content: Partner outreach LinkedIn content");
    expect(screen.getByTestId("button-marketing-campaign-publish-kit-linkedin")).toHaveTextContent("Preview content");
  });

  it("creates all missing campaign channel content from the creative accelerator", async () => {
    renderPage({}, {
      campaigns: [
        campaigns[0],
        {
          ...campaigns[1],
          channels: [
            { id: "channel-2", channel: "linkedin", contentAssetId: null, scheduledAt: null, status: "draft", sendCapability: "locked" },
            { id: "channel-2-whatsapp", channel: "whatsapp", contentAssetId: null, scheduledAt: null, status: "draft", sendCapability: "future_send_capable" },
          ],
        },
      ],
    });

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-2"));

    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("Fix the creative gap");
    expect(screen.getByTestId("marketing-campaign-creative-accelerator")).toHaveTextContent("LinkedIn, WhatsApp");
    expect(screen.getByTestId("button-marketing-campaign-create-missing-content")).toHaveTextContent("Create all 2 missing assets");

    fireEvent.click(screen.getByTestId("button-marketing-campaign-create-missing-content"));

    await waitFor(() => {
      const postCalls = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST");
      expect(postCalls).toHaveLength(2);
    });
    const contentPostBodies = apiFetchMock.mock.calls
      .filter(([path, init]) => path === "/api/admin/marketing/content" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body))) as Array<{ title: string; channel: string; body: string; ctaLabel: string; ctaUrl: string }>;
    expect(contentPostBodies.map((body) => body.channel)).toEqual(["linkedin", "whatsapp"]);
    expect(contentPostBodies[0]).toMatchObject({
      title: "Partner outreach LinkedIn content",
      channel: "linkedin",
      body: expect.stringContaining("Warm B2B leads"),
    });
    expect(contentPostBodies[1]).toMatchObject({
      title: "Partner outreach WhatsApp content",
      channel: "whatsapp",
      body: expect.stringContaining("Warm B2B leads"),
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-2", expect.objectContaining({ method: "PATCH" }));
    });
    const campaignPatchCalls = apiFetchMock.mock.calls.filter(([path, init]) => path === "/api/admin/marketing/campaigns/campaign-2" && init?.method === "PATCH");
    const latestCampaignPatch = campaignPatchCalls[campaignPatchCalls.length - 1];
    const campaignPatchBody = JSON.parse(String(latestCampaignPatch?.[1]?.body));
    expect(campaignPatchBody.channels).toEqual([
      expect.objectContaining({
        channel: "linkedin",
        contentAssetId: "content-created",
        status: "draft",
      }),
      expect.objectContaining({
        channel: "whatsapp",
        contentAssetId: "content-created",
        status: "draft",
      }),
    ]);
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("2 channel content assets created, linked, and saved to this campaign.");
    });
  });
});
