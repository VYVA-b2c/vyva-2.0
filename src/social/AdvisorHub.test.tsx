import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdvisorHub from "./AdvisorHub";
import type { AdvisorHubResponse } from "../../shared/advisors";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => queryMock(),
  };
});

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

const advisorResponse: AdvisorHubResponse = {
  language: "en",
  ui: {
    backToCommunity: "Back to Community",
    eyebrow: "MY EXPERTS",
    title: "Choose an expert",
    instruction: "Tap an expert to talk.",
    loading: "Preparing your experts...",
    empty: "Your experts are not available right now.",
    neverTalked: "Never talked",
    today: "Today",
    yesterday: "Yesterday",
    daysAgo: (days) => `${days} days ago`,
    lastWeek: "Last week",
    startTalking: "Start talking",
    inputPlaceholder: "Write a message...",
    send: "Send",
    micIdle: "Talk by voice",
    micListening: "Listening",
    retry: "Try again",
    sendError: "Could not send. Try again.",
    disclaimerLabel: "Important note",
  },
  advisors: [
    {
      slug: "amara",
      name: "Amara",
      role: "Coach",
      shortRole: "Movement",
      intro: "Gentle movement, balance, Tai chi, chair yoga, and light strength.",
      starter: "Would you like to move seated, with chair support, or a little more actively?",
      disclaimerText: "Amara shares gentle movement guidance. Stop if you feel pain, dizzy, or short of breath.",
      sortOrder: 5,
      iconKey: "coach",
      chipBg: "#E8F7EF",
      iconColor: "#0A7C4E",
      recencyLabel: "Never talked",
      sessionCount: 0,
      lastMessageAt: null,
    },
    {
      slug: "nora",
      name: "Nora",
      role: "Nutrition",
      shortRole: "Meals",
      intro: "Hi, I am Nora.",
      starter: "What would you like help planning today?",
      disclaimerText: "General information only.",
      sortOrder: 10,
      iconKey: "nutrition",
      chipBg: "#E4F3E7",
      iconColor: "#3F8752",
      recencyLabel: "Never talked",
      sessionCount: 0,
      lastMessageAt: null,
    },
    {
      slug: "tomas",
      name: "Tomas",
      role: "Garden",
      shortRole: "Plants",
      intro: "Hi, I am Tomas.",
      starter: "Which plant?",
      sortOrder: 20,
      iconKey: "garden",
      chipBg: "#F6E7DE",
      iconColor: "#B4623E",
      recencyLabel: "Yesterday",
      sessionCount: 1,
      lastMessageAt: "2026-07-06T12:00:00.000Z",
    },
  ],
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderHub() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/social-rooms/experts"]}>
      <Routes>
        <Route path="/social-rooms" element={<LocationProbe />} />
        <Route path="/social-rooms/experts" element={<><AdvisorHub /><LocationProbe /></>} />
        <Route path="/social-rooms/experts/:agentSlug" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdvisorHub", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockReturnValue({ data: advisorResponse, isLoading: false, isError: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the expert hub as compact visual cards", () => {
    renderHub();

    expect(screen.getByTestId("advisor-hub-screen")).toBeInTheDocument();
    expect(screen.getByText("MY EXPERTS")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose an expert" })).toBeInTheDocument();

    const list = screen.getByTestId("advisor-list");
    expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "AmaraCoachMovement",
      "NoraNutritionMeals",
      "TomasGardenPlants",
    ]);
    expect(screen.getByTestId("button-advisor-amara")).toHaveAccessibleName(
      "Amara Coach. Gentle movement, balance, Tai chi, chair yoga, and light strength.",
    );
    expect(screen.getByTestId("button-advisor-nora")).toHaveAccessibleName("Nora Nutrition. Hi, I am Nora.");
  });

  it("opens an expert chat", () => {
    renderHub();

    fireEvent.click(screen.getByTestId("button-advisor-nora"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/experts/nora");
  });

  it("returns to Community from back", () => {
    renderHub();

    fireEvent.click(screen.getByTestId("button-advisor-hub-back"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms");
  });
});
