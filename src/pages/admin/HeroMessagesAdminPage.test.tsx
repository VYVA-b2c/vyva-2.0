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

function renderPage(initialRows = [rowWithHeadline("VYVA")]) {
  let rows = initialRows;
  apiFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/metrics")) {
      return jsonResponse({
        metrics: [
          { surface: "health", message_id: "health-admin", language: "es", source: "managed", event_type: "impression", count: 12 },
          { surface: "health", message_id: "health-admin", language: "es", source: "managed", event_type: "cta_click", count: 3 },
          { surface: "health", message_id: "health-admin", language: "es", source: "managed", event_type: "deferred", count: 2 },
          { surface: "health", message_id: "health-admin", language: "es", source: "managed", event_type: "dismissed", count: 1 },
          { surface: "health", message_id: "health-admin", language: "es", source: "managed", event_type: "completed", count: 4 },
          { surface: "health", message_id: "health-admin", language: "es", source: "managed", event_type: "voice_engaged", count: 5 },
        ],
      });
    }
    if (url.endsWith("/hero-messages/translate") && init?.method === "POST") {
      return jsonResponse({
        translations: {
          en: { sourceText: "VYVA", headline: "A gentle check-in", subtitle: "How are you today?", ctaLabel: "Talk" },
          de: { sourceText: "VYVA", headline: "Eine sanfte Nachfrage", subtitle: "Wie geht es Ihnen heute?", ctaLabel: "Sprechen" },
        },
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
    expect(within(healthCard).getByText("2")).toBeInTheDocument();
    expect(within(healthCard).getByText("1")).toBeInTheDocument();
    expect(within(healthCard).getByText("4")).toBeInTheDocument();
    expect(within(healthCard).getByText("5")).toBeInTheDocument();
    expect(within(healthCard).getByText("Deferred")).toBeInTheDocument();
    expect(within(healthCard).getByText("Completed")).toBeInTheDocument();
    expect(within(healthCard).getByText("Voice")).toBeInTheDocument();
    expect(within(healthCard).getByText(/25\.0% open rate/)).toBeInTheDocument();
  });

  it("explains why the simulated user sees the selected Home message", async () => {
    renderPage();

    const explanation = await screen.findByTestId("home-message-decision-preview");

    expect(within(explanation).getByText("Why this user sees this message now")).toBeInTheDocument();
    expect(within(explanation).getByText(/Calm greeting|VYVA/)).toBeInTheDocument();
    expect(within(explanation).getAllByText(/[+-]?\d+/).length).toBeGreaterThan(0);
  });

  it("filters the live overview by operational attention state", async () => {
    renderPage();

    expect(await screen.findByTestId("card-hero-overview-health")).toBeInTheDocument();
    expect(screen.getByTestId("card-hero-overview-home")).toBeInTheDocument();
    expect(screen.getByTestId("hero-overview-filter-count")).toHaveTextContent("Showing 11 of 11 surfaces.");

    fireEvent.click(screen.getByTestId("button-hero-overview-filter-managed"));

    expect(screen.getByTestId("hero-overview-filter-count")).toHaveTextContent("Showing 1 of 11 surfaces.");
    expect(screen.getByTestId("card-hero-overview-health")).toBeInTheDocument();
    expect(screen.queryByTestId("card-hero-overview-home")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-hero-overview-filter-needs_attention"));

    expect(screen.getByTestId("hero-overview-filter-count")).toHaveTextContent("Showing 2 of 11 surfaces.");
    expect(screen.getByTestId("card-hero-overview-health")).toBeInTheDocument();
  });

  it("searches the message catalog without losing the selected editor", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("hero-preview-headline")).toHaveTextContent("VYVA");
    });

    fireEvent.change(screen.getByPlaceholderText("Message, surface, reason, or copy"), {
      target: { value: "health-admin" },
    });

    expect(screen.getByText(/1 of \d+ messages/)).toBeInTheDocument();
    expect(screen.getByText("health-admin / priority 120")).toBeInTheDocument();
    expect(screen.getByTestId("hero-preview-headline")).toHaveTextContent("VYVA");
  });

  it("previews the selected language and blocks invalid copy", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("hero-preview-headline")).toHaveTextContent("VYVA");
    });

    fireEvent.change(screen.getByLabelText("Headline (ES)"), {
      target: { value: "This headline is intentionally far too long" },
    });

    expect(screen.getByTestId("hero-preview-headline")).toHaveTextContent("This headline is intentionally far too long");
    expect(screen.getAllByText("Headline too long").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /save hero message/i })).toBeDisabled();
  });

  it("translates one base message into selected draft languages for review", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /^new$/i }));

    expect(screen.getByRole("heading", { name: "Create a message" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Spanish" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "English" })).not.toBeChecked();

    fireEvent.change(screen.getByLabelText("New message headline"), {
      target: { value: "Un control amable" },
    });
    fireEvent.change(screen.getByLabelText("New message supporting text"), {
      target: { value: "Como estas hoy?" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "English" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "German" }));
    fireEvent.click(screen.getByRole("button", { name: /create translations/i }));

    expect(await screen.findByTestId("hero-preview-headline")).toHaveTextContent("Un control amable");
    const translateCall = apiFetchMock.mock.calls.find(([input]) => String(input).endsWith("/hero-messages/translate"));
    expect(translateCall).toBeTruthy();
    expect(JSON.parse(String(translateCall?.[1]?.body))).toEqual({
      sourceLanguage: "es",
      targetLanguages: ["en", "de"],
      copy: expect.objectContaining({
        headline: "Un control amable",
        subtitle: "Como estas hoy?",
      }),
    });
    const languageSelect = screen.getAllByRole("combobox", { name: "Language" })
      .find((element) => element.textContent?.includes("French (add)"));
    expect(languageSelect).toBeDefined();
    expect(languageSelect).toHaveTextContent("Spanish");
    expect(languageSelect).toHaveTextContent("English");
    expect(languageSelect).toHaveTextContent("German");
    expect(languageSelect).toHaveTextContent("French (add)");

    fireEvent.click(screen.getByRole("button", { name: /save hero message/i }));

    await waitFor(() => {
      const postCalls = apiFetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
      const body = JSON.parse(String(postCalls.at(-1)?.[1]?.body));
      expect(body.copy.es.headline).toBe("Un control amable");
      expect(body.copy.en.headline).toBe("A gentle check-in");
      expect(body.copy.de.headline).toBe("Eine sanfte Nachfrage");
      expect(body.copy.fr).toBeUndefined();
    });
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

  it("supports a Home voice preview with only approved actions", async () => {
    renderPage([{
      ...rowWithHeadline("Your health check is ready"),
      message_id: "home-voice-health-check",
      surface: "home_voice",
      copy: {
        es: {
          sourceText: "Salud",
          headline: "Tu control esta listo",
          subtitle: "Solo tardara un momento",
          ctaLabel: "Empezar",
          actionId: "health",
        },
        en: {
          sourceText: "Health",
          headline: "Your health check is ready",
          subtitle: "It will only take a moment",
          ctaLabel: "Start",
          actionId: "health",
        },
      },
    }]);

    expect(await screen.findByTestId("select-home-hero-action")).toHaveValue("health");
    expect(screen.getByTestId("hero-preview-headline")).toHaveTextContent("Tu control esta listo");
    expect(screen.getByText("Empezar")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("select-home-hero-action"), {
      target: { value: "prevention" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save hero message/i }));

    await waitFor(() => {
      const postCall = apiFetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeTruthy();
      const body = JSON.parse(String(postCall?.[1]?.body));
      expect(body.copy.es.actionId).toBe("prevention");
    });
  });
});
