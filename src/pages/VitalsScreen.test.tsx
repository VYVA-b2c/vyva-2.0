import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import VitalsScreen from "./VitalsScreen";

const mocks = vi.hoisted(() => ({
  trackerProps: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
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
  it("renders the dedicated Vitals experience without Longevity content", () => {
    render(
      <MemoryRouter>
        <VitalsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Vitals" })).toBeVisible();
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
});
