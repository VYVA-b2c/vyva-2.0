import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivityScreen from "./ActivityScreen";

const queryMock = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: unknown[] }) => queryMock(options.queryKey),
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
    }),
  };
});

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ firstName: "Karim" }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="voice-hero">{children}</div>,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: "en" },
      t: (key: string, fallbackOrValues?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
        const raw = typeof fallbackOrValues === "string" ? fallbackOrValues : key;
        const interpolation = typeof fallbackOrValues === "object" ? fallbackOrValues : values;
        return raw.replace(/\{\{(\w+)\}\}/g, (_match, token) => String(interpolation?.[token] ?? `{{${token}}}`));
      },
    }),
  };
});

const homeScan = {
  id: "scan-1",
  risk_level: "high risk",
  result_title: "Loose rug in hallway",
  hazards: ["Loose rug", "Poor lighting"],
  advice: "Remove the rug and add a night light.",
  scanned_at: "2026-06-01T10:00:00.000Z",
};

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <div data-testid="route-state">{JSON.stringify(location.state ?? {})}</div>
    </>
  );
}

function renderActivity(initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"] = ["/activity"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/activity" element={<ActivityScreen />} />
        <Route path="/concierge" element={<LocationProbe />} />
        <Route path="/concierge/shopping" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Activity safe-home service actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/home-scan") return { data: [homeScan] };
      if (key === "/api/activity") {
        return {
          data: {
            entries: [],
            total_active_minutes: 0,
            total_calories: 0,
            today_steps: 0,
          },
          isLoading: false,
        };
      }
      return {};
    });
  });

  it("shows safe-home service actions in the Activity scan preview", () => {
    renderActivity();

    expect(screen.getByTestId("activity-safe-home-actions-scan-1")).toHaveTextContent("Order safety aids");
    expect(screen.getByTestId("activity-safe-home-actions-scan-1")).toHaveTextContent("Request quote");
  });

  it("routes Activity safe-home shopping action with scan context", async () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("button-activity-safe-home-order-aids-scan-1"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge/shopping"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"safe_home\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Loose rug");
  });

  it("routes Activity safe-home quote action with scan context", async () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("button-activity-safe-home-request-quote-scan-1"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"home_care_quote\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"safe_home_scan\"");
  });

  it("shows transport and companion support after selecting an outing activity", () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("button-activity-walking"));

    expect(screen.getByTestId("activity-support-actions")).toHaveTextContent("Need help going out?");
    expect(screen.getByTestId("button-activity-book-ride")).toHaveTextContent("Book ride");
    expect(screen.getByTestId("button-activity-arrange-companion")).toHaveTextContent("Arrange companion");
  });

  it("does not show outing support for non-outing activities", () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("button-activity-breathing"));

    expect(screen.queryByTestId("activity-support-actions")).not.toBeInTheDocument();
  });

  it("routes activity ride support to Concierge with prepared context", async () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("button-activity-walking"));
    fireEvent.click(screen.getByTestId("button-activity-book-ride"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"ride\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"activity_support\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("20 minute activity.types.walking activity");
  });

  it("routes activity companion support to Concierge as a confirmation-first task", async () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("button-activity-exercise"));
    fireEvent.click(screen.getByTestId("button-activity-arrange-companion"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"task\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"activity_support\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("trusted companion");
    expect(screen.getByTestId("route-state")).toHaveTextContent("confirm before contacting");
  });

  it("honors a preselected route activity for quick logging", () => {
    renderActivity([{ pathname: "/activity", state: { preselectActivity: "Breathing", duration: 10 } }]);

    expect(screen.getByTestId("button-activity-breathing")).toHaveStyle({ border: "2px solid #0F766E" });
    expect(screen.getByTestId("button-log-activity")).toBeEnabled();
  });
});
