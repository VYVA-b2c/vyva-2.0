import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CareTeamFlow from "./CareTeamFlow";
import { queryClient } from "@/lib/queryClient";

vi.mock("@/i18n", () => ({
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : key),
  }),
}));

vi.mock("@/components/onboarding/SpeakItOverlay", () => ({
  default: () => null,
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({ label, testId }: { label?: string; testId?: string }) => (
    <button type="button" data-testid={testId}>
      {label}
    </button>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderCareTeamFlow() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CareTeamFlow />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubResizeObserver() {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
}

describe("CareTeamFlow", () => {
  afterEach(() => {
    queryClient.clear();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("allows continuing with name and phone when optional email is blank", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ members: [] })));
    stubResizeObserver();

    renderCareTeamFlow();

    fireEvent.click(await screen.findByTestId("button-careteam-step1-continue"));

    const continueButton = screen.getByTestId("button-careteam-step2-continue");
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-careteam-name"), {
      target: { value: "Hassoun Assad" },
    });
    fireEvent.change(screen.getByTestId("input-careteam-phone"), {
      target: { value: "+34671442638" },
    });

    await waitFor(() => expect(continueButton).not.toBeDisabled());
  });

  it("shows a voice-first roster overview when care team members exist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      members: [
        {
          id: "member-1",
          invitee_name: "Hassan Assad",
          invitee_phone: "+34671442638",
          invitee_email: null,
          role: "caregiver",
          relationship: "son",
          status: "pending",
          created_at: "2026-07-01T08:00:00.000Z",
          expires_at: "2026-07-08T08:00:00.000Z",
          accepted_at: null,
          latest_delivery_status: "sent",
          latest_delivery_channel: "email",
          latest_delivery_at: "2026-07-01T08:00:00.000Z",
        },
      ],
    })));
    stubResizeObserver();

    renderCareTeamFlow();

    expect(await screen.findByTestId("careteam-roster-hero")).toBeInTheDocument();
    expect(screen.getByTestId("button-careteam-talk-to-vyva")).toBeInTheDocument();
    expect(screen.getByTestId("careteam-roster-metric-pending")).toHaveTextContent("1");
    expect(screen.getByTestId("card-careteam-member-member-1")).toBeInTheDocument();
    expect(screen.queryByTestId("careteam-sharing-highlights")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-careteam-roster-step-sharing"));
    expect(screen.getByTestId("careteam-sharing-highlights")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-careteam-roster-step-invite"));
    expect(screen.getByTestId("careteam-invite-panel")).toBeInTheDocument();
    expect(screen.getByTestId("button-careteam-add-another")).toBeInTheDocument();
  });

  it("fails fast into a retry state when the care team API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      code: "LOCAL_API_UNAVAILABLE",
      error: "API proxy failed",
    }, 502)));
    stubResizeObserver();

    renderCareTeamFlow();

    expect(await screen.findByTestId("careteam-roster-error")).toBeInTheDocument();
    expect(screen.getByTestId("button-careteam-retry")).toBeInTheDocument();
    expect(screen.getByTestId("button-careteam-error-add")).toBeInTheDocument();
    expect(screen.queryByText("onboarding.careTeam.loading")).not.toBeInTheDocument();
  });

  it("uses demo roster data for explicit localhost preview when the API is unavailable", async () => {
    window.history.replaceState({}, "", "/onboarding/profile/care-team?local_preview=1");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      code: "LOCAL_API_UNAVAILABLE",
      error: "API proxy failed",
    }, 502)));
    stubResizeObserver();

    renderCareTeamFlow();

    expect(await screen.findByTestId("careteam-roster-hero")).toBeInTheDocument();
    expect(screen.getByTestId("card-careteam-member-local-preview-hassan")).toBeInTheDocument();
    expect(screen.getByTestId("card-careteam-member-local-preview-gp")).toBeInTheDocument();
    expect(screen.getByTestId("careteam-member-context-local-preview-hassan")).toHaveTextContent("15 min away");
    expect(screen.getByTestId("careteam-member-context-local-preview-hassan")).toHaveTextContent("Calle San Miguel 14, Tarifa");
    expect(screen.getByTestId("careteam-member-context-local-preview-hassan")).toHaveTextContent("hassan@example.com");
    expect(screen.getByTestId("careteam-member-context-local-preview-gp")).toHaveTextContent("Primary clinic");
    expect(screen.getByTestId("careteam-member-context-local-preview-gp")).toHaveTextContent("clinic@example.com");
    expect(screen.getByTestId("button-careteam-edit-local-preview-gp")).toBeInTheDocument();
    expect(screen.queryByTestId("careteam-roster-error")).not.toBeInTheDocument();
  });
});
