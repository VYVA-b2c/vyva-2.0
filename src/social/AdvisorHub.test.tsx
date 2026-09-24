import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdvisorHub from "./AdvisorHub";
import type { AdvisorHubResponse, AdvisorSlug, AdvisorSummary } from "../../shared/advisors";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: () => queryMock() };
});

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

const slugs: AdvisorSlug[] = ["amara", "nora", "tomas", "elena", "diego", "ines", "sabio", "marta"];

function makeAdvisor(slug: AdvisorSlug, sortOrder: number): AdvisorSummary {
  return {
    slug,
    name: slug,
    role: "Legacy role",
    shortRole: "Legacy short role",
    intro: "Legacy intro",
    starter: "Legacy starter",
    sortOrder,
    iconKey: "coach",
    chipBg: "#F1EAFB",
    iconColor: "#7024C4",
    recencyLabel: "Never talked",
    sessionCount: 0,
    lastMessageAt: null,
  };
}

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
  advisors: [...slugs].reverse().map(makeAdvisor),
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
    window.sessionStorage.clear();
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "light");
    window.scrollTo = vi.fn();
    queryMock.mockReset();
    queryMock.mockReturnValue({ data: advisorResponse, isLoading: false, isError: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the canonical shell and function-first expert cards", () => {
    renderHub();

    const screenRoot = screen.getByTestId("advisor-hub-screen");
    expect(screenRoot).toHaveAttribute("data-home-master-theme", "light");
    expect(screenRoot).toHaveAttribute("data-shell-contract", "home.production");
    expect(screen.getByRole("heading", { name: "My Team" })).toBeInTheDocument();
    expect(screen.queryByText("Choose an expert")).not.toBeInTheDocument();
    expect(screen.queryByText("Who can help today?")).not.toBeInTheDocument();

    expect(slugs.map((slug) => screen.getByTestId(`button-advisor-${slug}`).textContent)).toEqual([
      "Wellness CoachMovement, energy and balance",
      "Nutrition ExpertMeals, appetite and hydration",
      "Hobby CompanionActivities matched to your interests",
      "Savings GuideBills, prices and everyday costs",
      "Scam ProtectorCheck suspicious messages and calls",
      "Benefits FinderFind support you may be missing",
      "Senior Home FinderCompare suitable living options",
      "Outings CompanionPlan accessible local activities",
    ]);
    expect(screen.getByTestId("button-advisor-amara")).toHaveAccessibleName(
      "Wellness Coach. Movement, energy and balance",
    );
  });

  it("inherits the persisted dark theme", () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");
    renderHub();

    expect(screen.getByTestId("advisor-hub-screen")).toHaveAttribute("data-home-master-theme", "dark");
  });

  it("renders the empty state safely for an incomplete transitional response", () => {
    queryMock.mockReturnValue({ data: {}, isLoading: false, isError: false });
    renderHub();

    expect(screen.getByText("Your experts are not available right now.")).toBeInTheDocument();
    expect(screen.getByTestId("advisor-hub-screen")).toBeInTheDocument();
  });

  it("paginates four expert cards at a time on mobile", () => {
    renderHub();

    expect(screen.getByText("Wellness Coach")).toHaveClass("font-display", "text-[20px]", "font-semibold", "md:text-[24px]");
    expect(screen.getByText("Movement, energy and balance")).toHaveClass("font-body", "text-[14px]", "font-bold", "md:text-[15px]");
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("button-advisor-amara")).not.toHaveClass("hidden");
    expect(screen.getByTestId("button-advisor-diego")).toHaveClass("advisor-team-card--other-page");

    fireEvent.click(screen.getByTestId("button-advisor-page-next"));

    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("button-advisor-amara")).toHaveClass("advisor-team-card--other-page");
    expect(screen.getByTestId("button-advisor-diego")).not.toHaveClass("hidden");
    expect(window.sessionStorage.getItem("vyva:community-expert-page")).toBe("1");
  });

  it("opens an expert chat using the existing stable slug", () => {
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
