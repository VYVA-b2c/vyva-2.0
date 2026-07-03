import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import HomeCardsAdminPage from "./HomeCardsAdminPage";

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

const baseCard = {
  id: "card-1",
  card_id: "music_hour",
  is_enabled: true,
  emoji: "*",
  bg: "#ECFDF3",
  badge_bg: "#D1FAE5",
  badge_text: "#047857",
  route: "/social-rooms/music-salon",
  base_priority: 80,
  condition_keywords: [],
  hobby_keywords: ["music"],
  avoid_condition_keywords: [],
  admin_notes: "",
  updated_at: "2026-06-24T09:00:00.000Z",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function renderPage(cards = [baseCard]) {
  apiFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path === "/api/admin/lifecycle/home-plan-cards" && method === "GET") {
      return jsonResponse({ cards });
    }
    if (path.startsWith("/api/admin/lifecycle/home-plan-cards/") && method === "PATCH") {
      return jsonResponse({ card: cards[0] });
    }
    if (path === "/api/admin/lifecycle/home-plan-cards" && method === "POST") {
      return jsonResponse({ card: cards[0] });
    }
    return jsonResponse({ error: `Unexpected request: ${method} ${path}` }, { status: 500 });
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/home-cards"]}>
      <HomeCardsAdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("HomeCardsAdminPage", () => {
  it("filters card health queues", async () => {
    const disabledRootCard = {
      ...baseCard,
      id: "card-2",
      card_id: "root_route_card",
      is_enabled: false,
      route: "/",
      hobby_keywords: [],
    };
    const exclusionCard = {
      ...baseCard,
      id: "card-3",
      card_id: "mobility_sensitive_card",
      route: "/my-account",
      hobby_keywords: [],
      avoid_condition_keywords: ["mobility_severe"],
    };

    renderPage([baseCard, disabledRootCard, exclusionCard]);

    expect(await screen.findByTestId("admin-home-card-queue")).toHaveTextContent("Showing 3 of 3 cards.");
    const list = screen.getByTestId("admin-home-card-list");
    expect(within(list).getByText("music_hour")).toBeInTheDocument();
    expect(within(list).getByText("root_route_card")).toBeInTheDocument();
    expect(within(list).getByText("mobility_sensitive_card")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("admin-home-card-queue-hidden"));

    expect(screen.getByTestId("admin-home-card-queue")).toHaveTextContent("Showing 1 of 3 cards.");
    expect(within(list).getByText("root_route_card")).toBeInTheDocument();
    expect(within(list).queryByText("music_hour")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("admin-home-card-queue-route_gaps"));

    expect(within(list).getByText("root_route_card")).toBeInTheDocument();
    expect(within(list).queryByText("mobility_sensitive_card")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("admin-home-card-queue-exclusions"));

    expect(within(list).getByText("mobility_sensitive_card")).toBeInTheDocument();
    expect(within(list).queryByText("root_route_card")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("admin-home-card-clear-queue"));

    expect(within(list).getByText("music_hour")).toBeInTheDocument();
  });
});
