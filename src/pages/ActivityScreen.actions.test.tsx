import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivityScreen from "./ActivityScreen";

const queryMock = vi.fn();
const mutateMock = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: unknown[] }) => queryMock(options.queryKey),
    useMutation: () => ({
      mutate: mutateMock,
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
    expect(screen.getByTestId("route-state")).toHaveTextContent("20 minute Walking activity");
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

  it("shows today's gentle routine above the exercise library", () => {
    renderActivity();

    const routineSection = screen.getByTestId("section-todays-gentle-routine");
    const exerciseSection = screen.getByTestId("section-gentle-exercises");

    expect(routineSection).toHaveTextContent("Today's gentle routine");
    expect(routineSection).toHaveTextContent("Start routine");
    expect(screen.getAllByTestId(/^senior-routine-preview-/)).toHaveLength(3);
    expect(routineSection.compareDocumentPosition(exerciseSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens the daily routine sheet and moves through all 3 stages", () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("button-start-senior-routine"));

    expect(screen.getByRole("dialog")).toHaveTextContent("Step 1 of 3");
    expect(screen.getByTestId("senior-routine-stepper")).toHaveTextContent("Step 1 of 3");

    fireEvent.click(screen.getByTestId("button-next-senior-routine"));
    expect(screen.getByTestId("senior-routine-stepper")).toHaveTextContent("Step 2 of 3");

    fireEvent.click(screen.getByTestId("button-next-senior-routine"));
    expect(screen.getByTestId("senior-routine-stepper")).toHaveTextContent("Step 3 of 3");
    expect(screen.getByTestId("button-finish-senior-routine")).toHaveTextContent("Finish routine");
    expect(screen.getByRole("dialog")).toHaveTextContent("Move gently. Stop if you feel pain, dizzy, or short of breath.");

    fireEvent.click(screen.getByTestId("button-back-senior-routine"));
    expect(screen.getByTestId("senior-routine-stepper")).toHaveTextContent("Step 2 of 3");
  });

  it("finishes the daily routine as a 10 minute Gentle routine log", () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("button-start-senior-routine"));
    fireEvent.click(screen.getByTestId("button-next-senior-routine"));
    fireEvent.click(screen.getByTestId("button-next-senior-routine"));
    fireEvent.click(screen.getByTestId("button-finish-senior-routine"));

    expect(mutateMock).toHaveBeenCalledWith(
      { activity_type: "GentleRoutine", duration_minutes: 10 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("shows the senior-friendly gentle exercise cards", () => {
    renderActivity();

    expect(screen.getByTestId("section-gentle-exercises")).toHaveTextContent("Gentle exercises");
    expect(screen.getAllByTestId(/^senior-exercise-card-/)).toHaveLength(12);
    expect(screen.getByTestId("senior-exercise-group-strength")).toHaveTextContent("3 cards");
    expect(screen.getByTestId("senior-exercise-group-balance")).toHaveTextContent("3 cards");
    expect(screen.getByTestId("senior-exercise-group-mobility")).toHaveTextContent("3 cards");
    expect(screen.getByTestId("senior-exercise-group-calm")).toHaveTextContent("3 cards");
    expect(screen.getByTestId("senior-exercise-card-chair-yoga")).toHaveTextContent("Chair yoga");
    expect(screen.getByTestId("senior-exercise-card-tai-chi")).toHaveTextContent("Tai chi");
    expect(screen.getByTestId("senior-exercise-card-seated-strength")).toHaveTextContent("Seated strength");
    expect(screen.getByTestId("senior-exercise-card-calm-breathing")).toHaveTextContent("Calm breathing");
    expect(screen.getByTestId("senior-exercise-card-sit-to-stand")).toHaveTextContent("Sit-to-stand");
    expect(screen.getByTestId("senior-exercise-card-heel-raises")).toHaveTextContent("Heel raises");
    expect(screen.getByTestId("senior-exercise-card-wall-push-ups")).toHaveTextContent("Wall push-ups");
    expect(screen.getByTestId("senior-exercise-card-ankle-mobility")).toHaveTextContent("Ankle mobility");
    expect(screen.getByTestId("senior-exercise-card-chest-opener")).toHaveTextContent("Chest opener");
    expect(screen.getByTestId("senior-exercise-card-side-steps")).toHaveTextContent("Side steps");
    expect(screen.getByTestId("senior-exercise-card-hand-breathing")).toHaveTextContent("Hand breathing");
    expect(screen.getByTestId("senior-exercise-card-shoulder-release")).toHaveTextContent("Shoulder release");
  });

  it("opens guided detail for a gentle exercise", () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("senior-exercise-card-tai-chi"));

    expect(screen.getByRole("dialog")).toHaveTextContent("Tai chi");
    expect(screen.getByRole("dialog")).toHaveTextContent("Why it helps");
    expect(screen.getByRole("dialog")).toHaveTextContent("Vyva tip");
    expect(screen.getByRole("dialog")).toHaveTextContent("Shift weight gently from one foot to the other.");
    expect(screen.getByRole("dialog")).toHaveTextContent("Move gently. Stop if you feel pain, dizzy, or short of breath.");
  });

  it("uses a guided exercise to preselect 10 minutes for logging", () => {
    renderActivity();

    fireEvent.click(screen.getByTestId("senior-exercise-card-chair-yoga"));
    fireEvent.click(screen.getByTestId("button-use-senior-exercise-chair-yoga"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("senior-exercise-card-chair-yoga")).toHaveTextContent("Ready");
    expect(screen.getByTestId("button-log-activity")).toBeEnabled();
    expect(screen.getByTestId("button-log-activity")).toHaveTextContent("Log 10m Chair yoga");
    expect(screen.queryByTestId("activity-support-actions")).not.toBeInTheDocument();
  });

  it("shows senior exercise labels in today's summary instead of falling back to walking", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/home-scan") return { data: [] };
      if (key === "/api/activity") {
        return {
          data: {
            entries: [{
              id: "activity-1",
              user_id: "user-1",
              activity_type: "WallPushUps",
              duration_minutes: 10,
              calories: 40,
              logged_at: "2026-06-04T08:30:00.000Z",
            }],
            total_active_minutes: 10,
            total_calories: 40,
            today_steps: 0,
          },
          isLoading: false,
        };
      }
      return {};
    });

    renderActivity();

    expect(screen.getByTestId("row-activity-0")).toHaveTextContent("Wall push-ups");
    expect(screen.getByTestId("row-activity-0")).not.toHaveTextContent("Walking");
    expect(screen.getByTestId("row-activity-0").querySelector("svg")).not.toBeNull();
  });

  it("shows Gentle routine labels in today's summary instead of falling back to walking", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/home-scan") return { data: [] };
      if (key === "/api/activity") {
        return {
          data: {
            entries: [{
              id: "activity-1",
              user_id: "user-1",
              activity_type: "GentleRoutine",
              duration_minutes: 10,
              calories: 30,
              logged_at: "2026-06-04T08:30:00.000Z",
            }],
            total_active_minutes: 10,
            total_calories: 30,
            today_steps: 0,
          },
          isLoading: false,
        };
      }
      return {};
    });

    renderActivity();

    expect(screen.getByTestId("row-activity-0")).toHaveTextContent("Gentle routine");
    expect(screen.getByTestId("row-activity-0")).not.toHaveTextContent("Walking");
    expect(screen.getByTestId("row-activity-0").querySelector("svg")).not.toBeNull();
  });
});
