import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ParticipateEventsAdminPage from "./ParticipateEventsAdminPage";
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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
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

    if (path === "/api/admin/social/participate/events" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const created: AdminParticipationEvent = {
        ...madridEvent,
        id: body.eventKey,
        eventKey: body.eventKey,
        titleEn: body.titleEn,
        titleEs: body.titleEs,
        titleDe: body.titleDe,
        city: body.city,
        countryCode: body.countryCode,
        status: body.status,
        safetyStatus: body.safetyStatus,
        responseCounts: baseCounts,
        checkRequestCount: 0,
      };
      events = [created, ...events];
      return Promise.resolve(jsonResponse({ ok: true, event: created }));
    }

    if (typeof path === "string" && path.startsWith("/api/admin/social/participate/events/") && method === "PATCH") {
      const eventKey = path.split("/").pop() ?? "";
      const body = JSON.parse(String(init?.body ?? "{}"));
      events = events.map((event) => event.eventKey === eventKey ? { ...event, ...body } : event);
      return Promise.resolve(jsonResponse({ ok: true, event: events.find((event) => event.eventKey === eventKey) }));
    }

    return Promise.resolve(new Response(JSON.stringify({ error: `Unexpected call: ${method} ${path}` }), { status: 500 }));
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/participate-events"]}>
      <ParticipateEventsAdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("ParticipateEventsAdminPage", () => {
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
    fireEvent.change(screen.getAllByLabelText("City")[0], { target: { value: "Valencia" } });
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
    fireEvent.change(screen.getAllByLabelText("City")[1], { target: { value: "Barcelona" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Save event/ })[0]);

    await waitFor(() => {
      const patch = apiFetchMock.mock.calls.find(([path, init]) => (
        path === "/api/admin/social/participate/events/valencia-art-hour" && init?.method === "PATCH"
      ));
      expect(patch).toBeTruthy();
      expect(String(patch?.[1]?.body)).toContain("Barcelona");
    });
  }, 15_000);

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
