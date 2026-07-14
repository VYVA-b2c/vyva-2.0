import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SafeHomeScreen, { safeHomeQuoteState, safeHomeShoppingState } from "./SafeHomeScreen";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";

const queryResultMock = vi.fn();
const { invalidateQueriesMock, savePlanMock, toastMock } = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
  savePlanMock: vi.fn(),
  toastMock: vi.fn(),
}));
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
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
  queryClient: { invalidateQueries: invalidateQueriesMock },
}));

vi.mock("@/lib/showVyvaActionExecutorClient", () => ({
  saveShowVyvaActionExecutionPlan: savePlanMock,
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
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/safe-home"]}>
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
    savePlanMock.mockResolvedValue({ pendingId: "show-vyva-action-1" });
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
        flowReference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
        actionLabel: "Request safety quote",
        summary: "VYVA prepares home-safety help and keeps it pending for confirmation.",
        message: expect.stringContaining("home safety quote"),
      },
    });
  });

  it("routes a saved scan to safety-aid shopping with scan context", async () => {
    renderSafeHome();

    fireEvent.click(screen.getByText("Loose rug in hallway"));
    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-buy_safety_aid-scan-1"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge/shopping"));
    expect(savePlanMock).toHaveBeenCalledWith(expect.objectContaining({
      targetRoute: "/concierge/shopping",
      triggerRequest: expect.objectContaining({ auto_start: false }),
    }));
    expect(savePlanMock.mock.calls[0][0].triggerRequest.action_payload).toMatchObject({
      show_vyva_action_id: "buy_safety_aid",
      user_confirmed: false,
      no_external_action_without_confirmation: true,
    });
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"safe_home\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Loose rug");
  });

  it("saves a care-team call draft from scan findings", async () => {
    renderSafeHome();

    fireEvent.click(screen.getByText("Loose rug in hallway"));

    expect(screen.getByTestId("show-vyva-follow-up-scan-1")).toBeInTheDocument();
    expect(screen.getByText("Next home-safety step")).toBeInTheDocument();
    expect(screen.getByTestId("button-show-vyva-follow-up-call_care_team-scan-1")).toHaveTextContent("Call Maria");

    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-call_care_team-scan-1"));

    await waitFor(() => expect(savePlanMock).toHaveBeenCalled());
    expect(savePlanMock.mock.calls[0][0].triggerRequest).toMatchObject({
      provider_name: "Maria",
      provider_phone: "+34 612 345 678",
      auto_start: false,
    });
    expect(savePlanMock.mock.calls[0][0].triggerRequest.action_payload).toMatchObject({
      show_vyva_action_id: "call_care_team",
      requested_tool: "phone_call",
      user_confirmed: false,
      no_external_action_without_confirmation: true,
    });
  });

  it("routes to care-team setup when no caregiver contact is saved", async () => {
    profileMock = {
      caregiverName: "",
      caregiverContact: "",
    };
    renderSafeHome();

    fireEvent.click(screen.getByText("Loose rug in hallway"));
    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-call_care_team-scan-1"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/onboarding/profile/care-team"));
    expect(savePlanMock).not.toHaveBeenCalled();
  });

  it("routes a saved scan to a prefilled home-safety quote request", async () => {
    renderSafeHome();

    fireEvent.click(screen.getByText("Loose rug in hallway"));
    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-request_quote-scan-1"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(savePlanMock).toHaveBeenCalledWith(expect.objectContaining({
      targetRoute: "/concierge",
      triggerRequest: expect.objectContaining({ use_case: "home_service", auto_start: false }),
    }));
    expect(savePlanMock.mock.calls[0][0].triggerRequest.action_payload).toMatchObject({
      show_vyva_action_id: "request_quote",
      flow_reference: "FLOW_HOME_SERVICE",
      user_confirmed: false,
      confirmation_required_before_action: true,
    });
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"safe_home_scan\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"home_care_quote\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.safeHomeSupport);
    expect(screen.getByTestId("route-state")).toHaveTextContent("Request safety quote");
  });

  it("routes pasted home-safety concerns through Show VYVA", async () => {
    renderSafeHome();

    fireEvent.click(screen.getByTestId("button-show-vyva-source-paste"));
    fireEvent.change(screen.getByTestId("textarea-show-vyva-paste"), {
      target: { value: "Loose rug near the stairs" },
    });
    fireEvent.click(screen.getByTestId("button-show-vyva-submit-paste"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"safe_home_scan\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.safeHomeSupport);
    expect(screen.getByTestId("route-state")).toHaveTextContent("Loose rug near the stairs");
  });
});
