import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import AdminContentIndexPage from "./AdminContentIndexPage";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "admin@example.com", role: "admin" }, logout: vi.fn() }),
}));

const apiFetchMock = vi.mocked(apiFetch);

const response = {
  generatedAt: "2026-07-17T09:00:00.000Z",
  summary: { total: 2, published: 2, needsAttention: 1, routeIssues: 1, languageGaps: 0, unavailableSources: 0, byType: { home_card: 1, curated_activity: 0, lesson: 1, room_prompt: 0 } },
  sources: [
    { type: "home_card", available: true, message: null },
    { type: "curated_activity", available: true, message: null },
    { type: "lesson", available: true, message: null },
    { type: "room_prompt", available: true, message: null },
  ],
  items: [
    {
      key: "home_card:music_hour",
      sourceId: "music_hour",
      type: "home_card",
      title: "Music Hour",
      subtitle: "Personalized Today card rule",
      status: "published",
      languageCoverage: { mode: "universal", available: ["en", "es", "fr", "de", "it", "pt"], expected: ["en", "es", "fr", "de", "it", "pt"], missing: [] },
      missingContent: ["Destination route"],
      route: "/",
      routeStatus: "missing",
      editorUrl: "/admin/home-cards?focus=music_hour",
      updatedAt: "2026-07-17T08:00:00.000Z",
    },
    {
      key: "lesson:rainbows",
      sourceId: "rainbows",
      type: "lesson",
      title: "Rainbows",
      subtitle: "Science lesson family",
      status: "published",
      languageCoverage: { mode: "localized", available: ["en", "es", "fr", "de", "it", "pt"], expected: ["en", "es", "fr", "de", "it", "pt"], missing: [] },
      missingContent: [],
      route: "/learn",
      routeStatus: "ready",
      editorUrl: "/admin/learning-library?focus=lesson-en",
      updatedAt: "2026-07-17T07:00:00.000Z",
    },
  ],
};

afterEach(() => apiFetchMock.mockReset());

describe("AdminContentIndexPage", () => {
  it("shows readiness signals, filters content, and links to source editors", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/content-index"]}>
        <AdminContentIndexPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Music Hour")).toBeInTheDocument();
    expect(screen.getByText("Rainbows")).toBeInTheDocument();
    expect(screen.getByText("Route needs fixing; Destination route")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Music Hour" })).toHaveAttribute("href", "/admin/home-cards?focus=music_hour");

    fireEvent.change(screen.getByTestId("content-index-search"), { target: { value: "rainbows" } });
    const list = screen.getByTestId("content-index-list");
    expect(within(list).getByText("Rainbows")).toBeInTheDocument();
    expect(within(list).queryByText("Music Hour")).not.toBeInTheDocument();
  });
});
