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
    contacts: 2,
    audiences: 1,
    thisWeek: 1,
    scheduled: 1,
    published: 0,
  },
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
    timezone: "Europe/Madrid",
    source: "vyva",
    lovableExternalId: null,
    channels: [{ id: "channel-1", channel: "email", contentAssetId: "content-1", scheduledAt: "2026-07-06T09:00:00.000Z", status: "scheduled", sendCapability: "enabled" }],
    recipientCount: 1,
    recipients: [{
      id: "recipient-1",
      campaignId: "campaign-1",
      contactId: "contact-1",
      profileId: null,
      channel: "email",
      recipient: "karim@example.com",
      status: "planned",
      scheduledAt: "2026-07-06T09:00:00.000Z",
      snapshot: { fullName: "Karim Assad", email: "karim@example.com" },
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
    triggerConfig: { source: "lovable" },
    goalType: "activation",
    goalConfig: { event: "first_login" },
    exitOnGoal: false,
    source: "lovable",
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
    designJson: { blocks: [{ type: "hero" }] },
    mediaAssets: [{ url: "https://cdn.example.test/partner.png" }],
    hasHtml: true,
    hasDesign: true,
    mediaAssetCount: 1,
    source: "lovable",
    lovableExternalId: "lovable-content-2",
  },
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
    fullName: "Hassan Partner",
    email: "hassan@example.com",
    phoneNumber: null,
    whatsappNumber: null,
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
    unmappedContactExternalIds: ["missing-contact"],
    lastSyncedAt: "2026-07-05T09:00:00.000Z",
  },
];

const sync = {
  provider: "lovable",
  configured: false,
  canRunSync: true,
  requiredRunnerEmail: "karim.assad@mokadigital.net",
  apiUrl: null,
  mode: "one_way_into_vyva",
  realSendingLocked: false,
  lockedSendCapabilities: summary.lockedSendCapabilities,
  runs: [{
    id: "sync-1",
    provider: "lovable",
    status: "succeeded",
    startedAt: "2026-07-05T09:00:00.000Z",
    completedAt: "2026-07-05T09:01:00.000Z",
    summary: {
      exported: { campaigns: 2, contacts: 2, content: 2, journeys: 1, audiences: 1 },
      imported: { campaigns: 2, contacts: 2, content: 2, journeys: 1, audiences: 1, audienceMembers: 2, mappedAudienceMembers: 1, campaignRecipients: 1 },
      skipped: {},
      unmapped: {
        audienceContactExternalIdCount: 1,
        audienceContactExternalIds: ["missing-contact"],
        campaignRecipientExternalIdCount: 1,
        campaignRecipientExternalIds: ["missing-contact"],
      },
      fieldCoverage: {
        content: {
          exportedFieldCount: 7,
          firstClassFieldCount: 6,
          metadataOnlyFieldCount: 1,
          metadataOnlyFields: ["extraLovableOnlyField"],
        },
        contacts: {
          exportedFieldCount: 8,
          firstClassFieldCount: 8,
          metadataOnlyFieldCount: 0,
          metadataOnlyFields: [],
        },
      },
    },
    error: null,
    createdBy: "karim.assad@mokadigital.net",
    createdAt: "2026-07-05T09:00:00.000Z",
  }],
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function renderPage(syncOverride: Partial<typeof sync> = {}) {
  const syncResponse = { ...sync, ...syncOverride };
  apiFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path === "/api/admin/marketing/summary") return jsonResponse(summary);
    if (path === "/api/admin/marketing/campaigns" && method === "GET") return jsonResponse({ campaigns });
    if (path === "/api/admin/marketing/journeys" && method === "GET") return jsonResponse({ journeys });
    if (path === "/api/admin/marketing/content" && method === "GET") return jsonResponse({ content });
    if (path === "/api/admin/marketing/contacts" && method === "GET") return jsonResponse({ contacts });
    if (path === "/api/admin/marketing/audiences" && method === "GET") return jsonResponse({ audiences });
    if (path === "/api/admin/marketing/sync/lovable" && method === "GET") return jsonResponse(syncResponse);
    if (path === "/api/admin/marketing/sync/lovable/run" && method === "POST") return jsonResponse({ ok: true, summary: { campaigns: 1, content: 1, contacts: 1, journeys: 1 } });
    if (path === "/api/admin/marketing/campaigns" && method === "POST") return jsonResponse({ ok: true, campaign: campaigns[0] }, { status: 201 });
    if (path === "/api/admin/marketing/campaigns/campaign-1" && method === "PATCH") return jsonResponse({ ok: true, campaign: campaigns[0] });
    if (path === "/api/admin/marketing/campaigns/campaign-1" && method === "DELETE") return jsonResponse({ ok: true, deletedCampaignId: "campaign-1" });
    if (path === "/api/admin/marketing/campaigns/campaign-1/test-email" && method === "POST") return jsonResponse({ ok: true, communication: { id: "comm-1", recipient: "karim.assad@mokadigital.net", status: "sent" }, delivery: { id: "comm-1", recipient: "karim.assad@mokadigital.net", status: "sent" } });
    if (path === "/api/admin/marketing/campaigns/campaign-1/send-email" && method === "POST") return jsonResponse({ ok: true, sentCount: 1, failedCount: 0, skippedCount: 0, campaign: { ...campaigns[0], status: "published" }, delivery: [{ id: "comm-2", recipient: "karim@example.com", status: "sent" }] });
    if (path === "/api/admin/marketing/journeys" && method === "POST") return jsonResponse({ ok: true, journey: journeys[0] }, { status: 201 });
    if (path === "/api/admin/marketing/journeys/journey-1" && method === "PATCH") return jsonResponse({ ok: true, journey: journeys[0] });
    if (path === "/api/admin/marketing/journeys/journey-1" && method === "DELETE") return jsonResponse({ ok: true, deletedJourneyId: "journey-1" });
    if (path === "/api/admin/marketing/contacts" && method === "POST") return jsonResponse({ ok: true, contact: contacts[1] }, { status: 201 });
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
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Caregiver welcome")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "partner" } });
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Partner outreach")).toBeInTheDocument();
    expect(within(screen.getByTestId("marketing-campaign-table")).queryByText("Caregiver welcome")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    expect(screen.getByTestId("marketing-journeys-tab")).toHaveTextContent("B2B nurture");
    expect(screen.getByTestId("marketing-journey-logic-journey-1")).toHaveTextContent("Trigger: signup");
    expect(screen.getByTestId("marketing-journey-logic-journey-1")).toHaveTextContent("Goal: activation");
    expect(screen.getByTestId("marketing-journeys-tab")).toHaveTextContent("message / Email / day 3 / content-1");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Partner post");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("HTML");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Design data");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("1 media");
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("CTA: Read more -> https://v2.vyva.life/partners");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    expect(screen.getByTestId("marketing-calendar-tab")).toHaveTextContent("No campaigns match the filters.");

    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Vertical: healthcare");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("List: Partners");
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("Partners");
    expect(screen.getByTestId("marketing-audiences-list")).toHaveTextContent("1 unmapped");

    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Not configured");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Email is enabled through VYVA");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Enabled");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Exported by Lovable");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Audiences: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Campaign recipients: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Unmapped list members: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Unmapped campaign recipients: 1");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("content: 6 of 7 fields mapped first-class");
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Metadata-only: extraLovableOnlyField");
    expect(screen.getByTestId("button-marketing-run-sync")).toBeDisabled();
    expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("Set LOVABLE_MARKETING_API_URL");
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
      expect(screen.getByTestId("marketing-sync-feedback")).toHaveTextContent("Lovable sync completed.");
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
  });

  it("edits and deletes journey metadata", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    fireEvent.click(screen.getByTestId("button-marketing-edit-journey-journey-1"));

    expect(screen.getByTestId("marketing-journey-edit-form-journey-1")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("input-marketing-edit-journey-name-journey-1"), { target: { value: "Updated nurture" } });
    fireEvent.change(screen.getByTestId("textarea-marketing-edit-journey-objective-journey-1"), { target: { value: "Updated objective" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-journey-audience-journey-1"), { target: { value: "both" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-journey-status-journey-1"), { target: { value: "paused" } });
    fireEvent.click(screen.getByTestId("button-marketing-save-journey-journey-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys/journey-1", expect.objectContaining({ method: "PATCH" }));
    });
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/admin/marketing/journeys/journey-1" && init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      name: "Updated nurture",
      objective: "Updated objective",
      audienceType: "both",
      status: "paused",
    });

    fireEvent.click(screen.getByTestId("button-marketing-delete-journey-journey-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/journeys/journey-1", expect.objectContaining({ method: "DELETE" }));
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Delete journey"));
    confirmSpy.mockRestore();
  });

  it("creates campaign metadata without auto-dispatching", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "New draft" } });
    fireEvent.click(screen.getByTestId("button-marketing-create-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns", expect.objectContaining({ method: "POST" }));
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1/send-email", expect.anything());
  });

  it("edits, snapshots recipients for, sends email campaigns, and deletes campaigns", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.click(screen.getByTestId("row-marketing-campaign-campaign-1"));

    expect(screen.getByTestId("marketing-campaign-edit-form")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("Caregiver welcome");
    expect(screen.getByTestId("marketing-campaign-detail-panel")).toHaveTextContent("1");
    expect(screen.getByText("Karim Assad")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-name"), { target: { value: "Updated campaign" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-objective"), { target: { value: "Updated objective" } });
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-timezone"), { target: { value: "Europe/London" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-campaign-channel"), { target: { value: "email" } });
    fireEvent.change(screen.getByTestId("select-marketing-edit-campaign-status"), { target: { value: "scheduled" } });
    fireEvent.click(screen.getByTestId("checkbox-marketing-edit-campaign-snapshot"));
    fireEvent.change(screen.getByTestId("input-marketing-edit-campaign-recipient-filter"), { target: { value: "Karim" } });

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
      status: "scheduled",
      timezone: "Europe/London",
      channels: [{ channel: "email", contentAssetId: "content-1", status: "scheduled" }],
    });
    expect(patchBody.recipients).toHaveLength(1);
    expect(patchBody.recipients[0]).toMatchObject({
      contactId: "contact-1",
      channel: "email",
      recipient: "karim@example.com",
      status: "planned",
      snapshot: { fullName: "Karim Assad" },
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

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1/send-email", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("marketing-campaign-email-feedback")).toHaveTextContent("Campaign email sent to 1 recipient.");
    });

    fireEvent.click(screen.getByTestId("button-marketing-delete-campaign-campaign-1"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns/campaign-1", expect.objectContaining({ method: "DELETE" }));
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Delete campaign"));
    confirmSpy.mockRestore();
  });
});
