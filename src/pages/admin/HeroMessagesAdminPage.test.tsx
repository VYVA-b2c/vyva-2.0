import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import HeroMessagesAdminPage from "./HeroMessagesAdminPage";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "admin@example.com" },
    logout: vi.fn(),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function rowWithHeadline(headline: string) {
  return {
    message_id: "health-admin",
    surface: "health",
    reason: "evergreen",
    priority: 120,
    cooldown_hours: 0,
    periods: [],
    safety_levels: [],
    event_types: [],
    activity_types: [],
    copy: {
      es: { sourceText: "Salud", headline, subtitle: "Revision diaria", ctaLabel: "Hablar" },
      en: { sourceText: "Health", headline: "Care now", subtitle: "Daily review", ctaLabel: "Talk" },
    },
    is_enabled: true,
    admin_notes: "",
    updated_at: "2026-05-31T10:00:00.000Z",
  };
}

function renderPage() {
  let rows = [rowWithHeadline("VYVA")];
  apiFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/metrics")) {
      return jsonResponse({
        metrics: [
          { surface: "health", message_id: "health-admin", language: "es", source: "managed", event_type: "impression", count: 12 },
          { surface: "health", message_id: "health-admin", language: "es", source: "managed", event_type: "cta_click", count: 3 },
        ],
      });
    }
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      rows = [{
        ...body,
        updated_at: "2026-05-31T11:00:00.000Z",
      }];
      return jsonResponse({ message: rows[0] });
    }
    return jsonResponse({ messages: rows });
  });

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/hero-messages"]}>
      <HeroMessagesAdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("HeroMessagesAdminPage", () => {
  it("shows the live overview with source, warnings, and aggregate metrics", async () => {
    renderPage();

    const healthCard = await screen.findByTestId("card-hero-overview-health");

    expect(within(healthCard).getByTestId("hero-active-health")).toHaveTextContent("VYVA");
    expect(within(healthCard).getByText("Managed")).toBeInTheDocument();
    expect(within(healthCard).getByText("Headline is too generic")).toBeInTheDocument();
    expect(within(healthCard).getByText("12")).toBeInTheDocument();
    expect(within(healthCard).getByText("3")).toBeInTheDocument();
    expect(within(healthCard).getByText("25.0%")).toBeInTheDocument();
  });

  it("previews the selected language and blocks invalid copy", async () => {
    renderPage();

    expect(await screen.findByTestId("hero-preview-headline")).toHaveTextContent("VYVA");

    fireEvent.change(screen.getByLabelText("Headline (ES)"), {
      target: { value: "This headline is intentionally far too long" },
    });

    expect(screen.getByTestId("hero-preview-headline")).toHaveTextContent("This headline is intentionally far too long");
    expect(screen.getAllByText("Headline too long").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /save hero message/i })).toBeDisabled();
  });

  it("direct saves edits and refreshes the overview", async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText("Headline (ES)"), {
      target: { value: "Care now" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save hero message/i }));

    await waitFor(() => {
      const postCall = apiFetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeTruthy();
      const body = JSON.parse(String(postCall?.[1]?.body));
      expect(body.copy.es.headline).toBe("Care now");
    });

    await waitFor(() => {
      expect(within(screen.getByTestId("card-hero-overview-health")).getByTestId("hero-active-health")).toHaveTextContent("Care now");
    });
  });
});
