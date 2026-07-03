import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CuratedActivitiesAdminPage from "./CuratedActivitiesAdminPage";
import { apiFetch } from "@/lib/queryClient";
import type { AdminParticipationEvent } from "@/social/types";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "admin@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

const baseCounts = { interested: 0, maybe: 0, not_for_me: 0 };

const madridEvent: AdminParticipationEvent = {
  id: "madrid-garden-walk",
  eventKey: "madrid-garden-walk",
  titleEs: "Paseo suave por el jardin",
  titleDe: "Sanfter Gartenspaziergang",
  titleEn: "Gentle garden walk",
  summaryEs: "Paseo tranquilo con bancos cerca.",
  summaryDe: "Ruhiger Spaziergang mit Sitzgelegenheiten.",
  summaryEn: "A quiet walk with nearby benches.",
  descriptionEs: "",
  descriptionDe: "",
  descriptionEn: "",
  format: "nearby",
  locationLabel: "Retiro area",
  city: "Madrid",
  countryCode: "ES",
  timeLabelEs: "Miercoles por la manana",
  timeLabelDe: "Mittwochvormittag",
  timeLabelEn: "Wednesday morning",
  startsAt: null,
  endsAt: null,
  costLabelEs: "Gratis",
  costLabelDe: "Kostenlos",
  costLabelEn: "Free",
  languageCodes: ["en", "es"],
  tags: ["walking", "garden"],
  interestTags: ["nature", "walking"],
  accessibilityTags: ["step-free", "benches"],
  helperActions: ["check_details", "transport"],
  source: "admin",
  sourceUrl: null,
  status: "active",
  isCurated: true,
  needsLiveCheck: true,
  safetyStatus: "approved",
  metadata: {},
  createdBy: "admin@example.com",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z",
  responseCounts: { interested: 3, maybe: 1, not_for_me: 0 },
  checkRequestCount: 2,
};

const onlineEvent: AdminParticipationEvent = {
  ...madridEvent,
  id: "online-music-hour",
  eventKey: "online-music-hour",
  titleEs: "Musica online",
  titleDe: "Online-Musik",
  titleEn: "Online music hour",
  city: null,
  countryCode: null,
  format: "online",
  locationLabel: "Online",
  responseCounts: { ...baseCounts, interested: 1 },
  checkRequestCount: 0,
};

const discoveryCandidate: AdminParticipationEvent = {
  ...madridEvent,
  id: "madrid-library-music",
  eventKey: "madrid-library-music",
  titleEn: "Library music morning",
  titleEs: "Musica matinal en la biblioteca",
  titleDe: "Musikvormittag in der Bibliothek",
  summaryEn: "A calm public music session.",
  summaryEs: "Una sesion publica de musica tranquila.",
  summaryDe: "Eine ruhige offentliche Musikrunde.",
  locationLabel: "Central library",
  timeLabelEn: "Time to be checked",
  costLabelEn: "Free",
  source: "ai-discovery",
  sourceUrl: "https://example.org/library-music",
  status: "draft",
  safetyStatus: "needs_review",
  responseCounts: baseCounts,
  checkRequestCount: 0,
  metadata: {
    discovery: {
      generatedAt: "2026-07-03T10:00:00.000Z",
      query: { city: "Madrid" },
      sourceUrls: ["https://example.org/library-music"],
      evidence: "The source lists a public music event at the library.",
      model: "gpt-4.1-mini",
    },
  },
};

const secondDiscoveryCandidate: AdminParticipationEvent = {
  ...discoveryCandidate,
  id: "madrid-art-workshop",
  eventKey: "madrid-art-workshop",
  titleEn: "Art workshop",
  sourceUrl: "https://example.org/art-workshop",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage(
  discovered: AdminParticipationEvent[] = [discoveryCandidate],
  options: { patchError?: unknown } = {},
) {
  let events = [madridEvent, onlineEvent].map((event) => ({ ...event }));

  apiFetchMock.mockImplementation((path, init) => {
    const method = init?.method ?? "GET";

    if (path === "/api/admin/social/participate/events" && method === "GET") {
      return Promise.resolve(jsonResponse({ events }));
    }

    if (path === "/api/admin/social/participate/activity" && method === "GET") {
      return Promise.resolve(jsonResponse({
        activity: {
          checks: [
            { id: "check-1", eventKey: "madrid-garden-walk", status: "requested", userId: "senior-1" },
          ],
          responses: [],
          notifications: [],
        },
      }));
    }

    if (path === "/api/admin/social/participate/discover" && method === "POST") {
      return Promise.resolve(jsonResponse({ ok: true, candidates: discovered, rejected: [] }));
    }

    if (path === "/api/admin/social/participate/events" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const created: AdminParticipationEvent = {
        ...madridEvent,
        ...body,
        id: body.eventKey,
        eventKey: body.eventKey,
        responseCounts: baseCounts,
        checkRequestCount: 0,
      };
      events = [created, ...events];
      return Promise.resolve(jsonResponse({ ok: true, event: created }, 201));
    }

    if (typeof path === "string" && path.startsWith("/api/admin/social/participate/events/") && method === "PATCH") {
      if (options.patchError) {
        return Promise.resolve(jsonResponse(options.patchError, 400));
      }
      const eventKey = path.split("/").pop() ?? "";
      const body = JSON.parse(String(init?.body ?? "{}"));
      events = events.map((event) => event.eventKey === eventKey ? { ...event, ...body } : event);
      return Promise.resolve(jsonResponse({ ok: true, event: events.find((event) => event.eventKey === eventKey) }));
    }

    return Promise.resolve(new Response(JSON.stringify({ error: `Unexpected call: ${method} ${path}` }), { status: 500 }));
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/curated-activities"]}>
      <CuratedActivitiesAdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("CuratedActivitiesAdminPage", () => {
  it("offers a downloadable activity import template", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "What's On" })).toBeInTheDocument();
    expect((await screen.findAllByText("madrid-garden-walk")).length).toBeGreaterThan(0);
    const link = screen.getByRole("link", { name: /Download template/ });

    expect(link).toHaveAttribute("download", "vyva-activities-template.csv");
    expect(link.getAttribute("href")).toContain("eventKey");
    expect(link.getAttribute("href")).toContain("interests");
    expect(link.getAttribute("href")).toContain("needs_review");
  });

  it("calls AI discovery and renders the full preview list with details", async () => {
    renderPage([discoveryCandidate, secondDiscoveryCandidate]);

    expect((await screen.findAllByText("madrid-garden-walk")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByTestId("admin-discovery-city"), { target: { value: "Valencia" } });
    fireEvent.change(screen.getByTestId("admin-discovery-country"), { target: { value: "PT" } });
    fireEvent.click(screen.getByTestId("admin-interest-crafts"));
    fireEvent.click(screen.getByTestId("admin-refinement-outdoor"));
    fireEvent.click(screen.getByTestId("admin-language-de"));
    fireEvent.click(screen.getByTestId("admin-format-hybrid"));
    fireEvent.click(screen.getByTestId("admin-discovery-find"));

    expect(await screen.findByTestId("admin-discovery-preview")).toBeInTheDocument();
    expect(screen.getByText("2 candidates found. 0 selected for draft save.")).toBeInTheDocument();
    expect(screen.getByText("Library music morning")).toBeInTheDocument();
    expect(screen.getByText("Art workshop")).toBeInTheDocument();
    const sourceHrefs = screen.getAllByRole("link", { name: /Source link/ }).map((link) => link.getAttribute("href"));
    expect(sourceHrefs).toContain("https://example.org/library-music");
    expect(sourceHrefs).toContain("https://example.org/art-workshop");

    fireEvent.click(screen.getAllByRole("button", { name: /View details/ })[0]);
    expect(screen.getByDisplayValue("Library music morning")).toBeInTheDocument();

    const discoverCall = apiFetchMock.mock.calls.find(([path, init]) => (
      path === "/api/admin/social/participate/discover" && init?.method === "POST"
    ));
    expect(discoverCall).toBeTruthy();
    expect(JSON.parse(String(discoverCall?.[1]?.body))).toMatchObject({
      city: "Valencia",
      countryCode: "PT",
      interests: expect.arrayContaining(["music", "walking", "art", "crafts"]),
      refinementTags: expect.arrayContaining(["free", "indoor", "wheelchair friendly", "outdoor"]),
      languageCodes: ["en", "es"],
      format: "hybrid",
      maxResults: 6,
    });
  });

  it("saves only checked AI candidates as draft review items", async () => {
    renderPage([discoveryCandidate, secondDiscoveryCandidate]);

    expect((await screen.findAllByText("madrid-garden-walk")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("admin-discovery-find"));
    expect(await screen.findByText("Art workshop")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Select Library music morning/));
    fireEvent.click(screen.getByTestId("admin-discovery-save"));

    await waitFor(() => {
      const posts = apiFetchMock.mock.calls.filter(([path, init]) => (
        path === "/api/admin/social/participate/events" && init?.method === "POST"
      ));
      expect(posts).toHaveLength(1);
      const body = JSON.parse(String(posts[0][1]?.body));
      expect(body).toMatchObject({
        eventKey: "madrid-library-music",
        source: "ai-discovery",
        status: "draft",
        safetyStatus: "needs_review",
        isCurated: true,
        needsLiveCheck: true,
      });
      expect(body.eventKey).not.toBe("madrid-art-workshop");
    });

    expect(await screen.findByText("madrid-library-music")).toBeInTheDocument();
    expect(screen.getAllByText("draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("needs_review").length).toBeGreaterThan(0);
  });

  it("manages city coverage, creates drafts, and saves event changes", async () => {
    renderPage();

    expect((await screen.findAllByText("madrid-garden-walk")).length).toBeGreaterThan(0);
    expect(screen.getByText("Online fallback available")).toBeInTheDocument();
    expect(screen.getByText("Madrid, ES")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("City filter"), { target: { value: "Valencia" } });
    expect(screen.getByText(/Valencia has no active approved local events/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Event key"), { target: { value: "valencia-art-hour" } });
    fireEvent.change(screen.getAllByLabelText("Title EN")[0], { target: { value: "Valencia art hour" } });
    fireEvent.change(screen.getAllByLabelText("Title ES")[0], { target: { value: "Arte en Valencia" } });
    fireEvent.change(screen.getAllByLabelText("Title DE")[0], { target: { value: "Kunst in Valencia" } });
    fireEvent.change(screen.getAllByLabelText("City")[1], { target: { value: "Valencia" } });
    fireEvent.click(screen.getByRole("button", { name: /Add event/ }));

    await waitFor(() => {
      const post = apiFetchMock.mock.calls.find(([path, init]) => (
        path === "/api/admin/social/participate/events" && init?.method === "POST"
      ));
      expect(post).toBeTruthy();
      expect(String(post?.[1]?.body)).toContain("valencia-art-hour");
      expect(String(post?.[1]?.body)).toContain("Valencia");
    });

    expect(await screen.findByText("valencia-art-hour")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Save event/ }).length).toBeGreaterThan(0);
    });
    fireEvent.change(screen.getByLabelText("City filter"), { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Save event/ }).length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getAllByLabelText("City")[2], { target: { value: "Barcelona" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Save event/ })[0]);

    await waitFor(() => {
      const patch = apiFetchMock.mock.calls.find(([path, init]) => (
        path === "/api/admin/social/participate/events/valencia-art-hour" && init?.method === "PATCH"
      ));
      expect(patch).toBeTruthy();
      expect(String(patch?.[1]?.body)).toContain("Barcelona");
    });
    expect(await screen.findByTestId("admin-event-save-feedback-valencia-art-hour")).toHaveTextContent("valencia-art-hour saved.");
  }, 15_000);

  it("shows event save errors next to the clicked event", async () => {
    renderPage([discoveryCandidate], {
      patchError: {
        error: {
          formErrors: [],
          fieldErrors: {
            sourceUrl: ["Invalid url"],
          },
        },
      },
    });

    expect((await screen.findAllByText("madrid-garden-walk")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Save event/ })[0]);

    expect(await screen.findByTestId("admin-event-save-feedback-madrid-garden-walk")).toHaveTextContent("sourceUrl: Invalid url");
  });

  it("imports uploaded activities through the existing admin event endpoint", async () => {
    renderPage();

    expect((await screen.findAllByText("madrid-garden-walk")).length).toBeGreaterThan(0);

    const file = new File([
      [
        "title,summary,city,country,format,interests,accessibility",
        "Community choir,A gentle singalong for older adults,Valencia,ES,nearby,music; social,seated",
      ].join("\n"),
    ], "activities.csv", { type: "text/csv" });

    fireEvent.change(screen.getByTestId("admin-participate-upload-input"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      const post = apiFetchMock.mock.calls.find(([path, init]) => (
        path === "/api/admin/social/participate/events"
        && init?.method === "POST"
        && String(init?.body).includes("community-choir")
      ));
      expect(post).toBeTruthy();
      expect(String(post?.[1]?.body)).toContain("Community choir");
      expect(String(post?.[1]?.body)).toContain("Valencia");
      expect(String(post?.[1]?.body)).toContain("needs_review");
    });

    expect(await screen.findByText(/1 activity imported from activities.csv/)).toBeInTheDocument();
    expect(await screen.findByText("community-choir")).toBeInTheDocument();
  }, 15_000);
});
