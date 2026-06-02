import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SafeHomeScreen, { safeHomeQuoteState, safeHomeShoppingState } from "./SafeHomeScreen";

const queryResultMock = vi.fn();
let profileMock = {
  caregiverName: "Maria",
  caregiverContact: "+34 612 345 678",
};

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => queryResultMock(),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useVoiceActionFulfillment", () => ({
  useVoiceActionFulfillment: () => ({
    action: null,
    isActiveActionAccepted: false,
    acceptActiveAction: vi.fn(),
    completeActiveAction: vi.fn(),
    payloadValue: () => "",
  }),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => <div data-testid="voice-action-panel" />,
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    profile: profileMock,
    isLoading: false,
    fullName: "",
    initials: "",
    firstName: "",
  }),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: "en" },
      t: (_key: string, fallback?: string, options?: Record<string, string>) => {
        let value = fallback ?? _key;
        for (const [key, replacement] of Object.entries(options ?? {})) {
          value = value.replace(`{{${key}}}`, replacement);
        }
        return value;
      },
    }),
  };
});

const scan = {
  id: "scan-1",
  risk_level: "high risk",
  result_title: "Loose rug in hallway",
  hazards: ["Loose rug", "Poor lighting"],
  advice: "Remove the rug and add a night light.",
  image_data: null,
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

function renderSafeHome() {
  return render(
    <MemoryRouter initialEntries={["/safe-home"]}>
      <Routes>
        <Route path="/safe-home" element={<SafeHomeScreen />} />
        <Route path="/concierge" element={<LocationProbe />} />
        <Route path="/concierge/shopping" element={<LocationProbe />} />
        <Route path="/onboarding/profile/care-team" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Safe-home scan service actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMock = {
      caregiverName: "Maria",
      caregiverContact: "+34 612 345 678",
    };
    queryResultMock.mockReturnValue({
      data: [scan],
      isLoading: false,
    });
  });

  it("builds safe-home shopping and quote prefill from scan findings", () => {
    const actionScan = {
      resultTitle: scan.result_title,
      hazards: scan.hazards,
      advice: scan.advice,
    };

    expect(safeHomeShoppingState(actionScan, "en")).toEqual({
      shoppingPrefill: {
        needText: expect.stringContaining("Loose rug"),
        category: "safe_home",
        priorities: ["safety", "simplicity", "delivery"],
      },
    });

    expect(safeHomeQuoteState(actionScan, "en")).toEqual({
      conciergePrefill: {
        kind: "home_care_quote",
        source: "safe_home_scan",
        message: expect.stringContaining("home safety quote"),
      },
    });
  });

  it("routes a saved scan to safety-aid shopping with scan context", async () => {
    renderSafeHome();

    fireEvent.click(screen.getByText("Loose rug in hallway"));
    fireEvent.click(screen.getByTestId("button-safe-home-order-aids-scan-1"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge/shopping"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"safe_home\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Loose rug");
  });

  it("renders a direct care-team call from scan findings", async () => {
    renderSafeHome();

    fireEvent.click(screen.getByText("Loose rug in hallway"));

    expect(screen.getByTestId("button-safe-home-call-caregiver-scan-1")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-safe-home-call-caregiver-scan-1")).toHaveTextContent("Call Maria");
  });

  it("routes to care-team setup when no caregiver contact is saved", async () => {
    profileMock = {
      caregiverName: "",
      caregiverContact: "",
    };
    renderSafeHome();

    fireEvent.click(screen.getByText("Loose rug in hallway"));
    fireEvent.click(screen.getByTestId("button-safe-home-add-caregiver-scan-1"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/onboarding/profile/care-team"));
  });

  it("routes a saved scan to a prefilled home-safety quote request", async () => {
    renderSafeHome();

    fireEvent.click(screen.getByText("Loose rug in hallway"));
    fireEvent.click(screen.getByTestId("button-safe-home-request-quote-scan-1"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"safe_home_scan\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"home_care_quote\"");
  });
});
