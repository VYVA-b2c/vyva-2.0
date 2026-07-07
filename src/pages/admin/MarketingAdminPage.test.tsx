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
    { channel: "email", sendCapability: "future_send_capable", locked: true, note: "Provider dispatch is locked." },
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
    channels: [{ id: "channel-1", channel: "email", scheduledAt: "2026-07-06T09:00:00.000Z", status: "scheduled", sendCapability: "locked" }],
    recipientCount: 0,
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
    channels: [{ id: "channel-2", channel: "linkedin", scheduledAt: null, status: "draft", sendCapability: "locked" }],
    recipientCount: 4,
  },
];

const journeys = [
  {
    id: "journey-1",
    name: "B2B nurture",
    status: "draft",
    audienceType: "b2b",
    objective: "Convert partners",
    source: "lovable",
    steps: [{ id: "step-1", stepOrder: 0, channel: "email", delayHours: 0, status: "draft" }],
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

const sync = {
  provider: "lovable",
  configured: false,
  canRunSync: true,
  requiredRunnerEmail: "karim.assad@mokadigital.net",
  apiUrl: null,
  mode: "one_way_into_vyva",
  realSendingLocked: true,
  lockedSendCapabilities: summary.lockedSendCapabilities,
  runs: [],
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
    if (path === "/api/admin/marketing/sync/lovable" && method === "GET") return jsonResponse(syncResponse);
    if (path === "/api/admin/marketing/sync/lovable/run" && method === "POST") return jsonResponse({ ok: true, summary: { campaigns: 1, content: 1, contacts: 1, journeys: 1 } });
    if (path === "/api/admin/marketing/campaigns" && method === "POST") return jsonResponse({ ok: true, campaign: campaigns[0] }, { status: 201 });
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
  it("shows the marketing admin nav, tabs, filters, and locked send state", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Marketing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Marketing.*Campaigns, contacts and sync/i })).toBeInTheDocument();
    expect(screen.getByTestId("marketing-send-locked-panel")).toHaveTextContent("Campaign sending is locked");
    expect(screen.getByTestId("button-marketing-send-locked")).toBeDisabled();
    expect(screen.getByTestId("marketing-dashboard-tab")).toHaveTextContent("Total campaigns");
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Caregiver welcome")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-marketing-search"), { target: { value: "partner" } });
    expect(within(screen.getByTestId("marketing-campaign-table")).getByText("Partner outreach")).toBeInTheDocument();
    expect(within(screen.getByTestId("marketing-campaign-table")).queryByText("Caregiver welcome")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("tab-marketing-journeys"));
    expect(screen.getByTestId("marketing-journeys-tab")).toHaveTextContent("B2B nurture");

    fireEvent.click(screen.getByTestId("tab-marketing-content"));
    expect(screen.getByTestId("marketing-content-tab")).toHaveTextContent("Partner post");

    fireEvent.click(screen.getByTestId("tab-marketing-calendar"));
    expect(screen.getByTestId("marketing-calendar-tab")).toHaveTextContent("No campaigns match the filters.");

    fireEvent.click(screen.getByTestId("tab-marketing-contacts"));
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Hassan Partner");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("Vertical: healthcare");
    expect(screen.getByTestId("marketing-contacts-tab")).toHaveTextContent("List: Partners");

    fireEvent.click(screen.getByTestId("tab-marketing-settings"));
    expect(screen.getByTestId("marketing-settings-tab")).toHaveTextContent("Not configured");
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

  it("creates campaign metadata without exposing a send action", async () => {
    renderPage();

    await screen.findByTestId("marketing-dashboard-tab");
    fireEvent.change(screen.getByTestId("input-marketing-campaign-name"), { target: { value: "New draft" } });
    fireEvent.click(screen.getByTestId("button-marketing-create-campaign"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/campaigns", expect.objectContaining({ method: "POST" }));
    });
    expect(screen.getByTestId("button-marketing-send-locked")).toBeDisabled();
  });
});
