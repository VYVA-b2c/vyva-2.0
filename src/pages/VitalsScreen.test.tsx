import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VitalsScreen from "./VitalsScreen";

const mocks = vi.hoisted(() => ({
  trackerProps: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => ({ data: { conditions: ["hypertension"] } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    profile: {
      country: "GB",
      gpName: "Dr Smith",
      gpPhone: "+441234567890",
      gpEmail: "gp@example.com",
      caregiverContact: "+449876543210",
    },
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/components/VitalsTracker", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.trackerProps(props);
    return <div data-testid="vitals-tracker">Vitals tracker</div>;
  },
}));

describe("VitalsScreen", () => {
  beforeEach(() => {
    mocks.trackerProps.mockClear();
  });

  it("renders the dedicated Vitals experience without Longevity content", () => {
    render(
      <MemoryRouter>
        <VitalsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Vitals" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Vitals" })).toHaveClass("font-display", "font-semibold");
    expect(screen.getByTestId("vitals-page")).toHaveAttribute("data-header-contract", "detail.voice-touch");
    expect(screen.getByTestId("vitals-page")).toHaveAttribute("data-shell-contract", "home.production");
    expect(screen.getByTestId("button-vitals-header-voice")).toHaveAccessibleName("Talk to VYVA");
    expect(screen.getByTestId("vitals-tracker")).toBeVisible();
    expect(screen.queryByText("Longevity Plan")).not.toBeInTheDocument();
    expect(mocks.trackerProps).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-123",
      userConditions: ["hypertension"],
      language: "en",
      country: "GB",
      gpName: "Dr Smith",
      gpPhone: "+441234567890",
      gpEmail: "gp@example.com",
      caregiverContact: "+449876543210",
    }));
  });

  it("renders representative readings for the local Vitals preview", () => {
    const previewData = {
      analysis: {
        safety_status: "steady" as const,
        senior_message: "Your latest readings look steady.",
      },
      recent_readings: [],
      latest_alert: null,
    };

    render(
      <MemoryRouter>
        <VitalsScreen
          previewData={previewData}
          previewConditions={["hypertension"]}
          backPath="/dev/home-master/health"
        />
      </MemoryRouter>,
    );

    expect(mocks.trackerProps).toHaveBeenCalledWith(expect.objectContaining({
      userId: "preview-user",
      userConditions: ["hypertension"],
      previewData,
    }));
  });
});
