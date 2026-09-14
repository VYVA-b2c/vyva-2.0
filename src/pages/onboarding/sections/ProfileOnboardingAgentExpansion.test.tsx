import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BasicsSection from "./BasicsSection";
import AddressSection from "./AddressSection";
import EmergencySection from "./EmergencySection";
import { apiFetch, queryClient } from "@/lib/queryClient";

vi.mock("@/i18n", () => ({
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

let spokenTranscript = "";

vi.mock("@/components/onboarding/SpeakItOverlay", () => ({
  default: ({ title, onDone, onCancel }: {
    title: string;
    onDone: (transcript: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="mock-speak-it-overlay" aria-label={title}>
      <button
        type="button"
        data-testid="button-mock-speak-it-done"
        onClick={() => onDone(spokenTranscript)}
      >
        Finish speaking
      </button>
      <button type="button" data-testid="button-mock-speak-it-cancel" onClick={onCancel}>
        Cancel speaking
      </button>
    </div>
  ),
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function onboardingState(profile: Record<string, unknown> = {}) {
  return {
    profile,
    onboardingState: {},
    account: { id: "user-1", activeProfileId: "user-1", role: "elder" },
  };
}

function seedOnboardingState(profile: Record<string, unknown> = {}) {
  const state = onboardingState(profile);
  queryClient.clear();
  queryClient.setQueryData(["/api/onboarding/state"], state);
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(state)));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
}

function renderSection(section: ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {section}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function sectionPostCalls(endpoint: string) {
  return apiFetchMock.mock.calls.filter(
    ([url, init]) => url === endpoint && init?.method === "POST",
  );
}

describe("Onboarding Agent profile expansion", () => {
  beforeEach(() => {
    window.localStorage.clear();
    spokenTranscript = "";
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (url) => {
      if (url === "/api/address-voice-parse") {
        return jsonResponse({
          address: {
            address_line_1: "42 Calle Mayor",
            city: "Zamora",
            region: "Castilla y Leon",
            postcode: "49001",
            country: "Spain",
          },
        });
      }
      return jsonResponse({ ok: true });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("registers Basic details with the agent and reviews spoken details before local apply", async () => {
    seedOnboardingState();
    renderSection(<BasicsSection />);

    expect(await screen.findByTestId("onboarding-companion-mode-chip")).toHaveTextContent("Voice");
    expect(screen.getByTestId("button-section-companion-primary-voice-action")).toHaveTextContent("Tell VYVA");
    expect(screen.queryByTestId("button-basics-speak-it")).not.toBeInTheDocument();

    spokenTranscript = "My name is Karim Haddad and my email is karim@example.com phone +34 612 345 678";
    fireEvent.click(screen.getByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-basics-voice-draft")).toHaveTextContent("Review your basics");
    expect(screen.getByText("Karim Haddad")).toBeInTheDocument();
    expect(screen.getByText("karim@example.com")).toBeInTheDocument();
    expect(sectionPostCalls("/api/onboarding/basics")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-confirm"));

    expect(screen.getByTestId("input-basics-full-name")).toHaveValue("Karim Haddad");
    expect(screen.getByTestId("input-basics-email")).toHaveValue("karim@example.com");
    expect(sectionPostCalls("/api/onboarding/basics")).toHaveLength(0);
  });

  it("keeps Basic details tactile controls visible and does not autosave manual edits", async () => {
    seedOnboardingState();
    renderSection(<BasicsSection />);

    fireEvent.click(await screen.findByTestId("button-section-companion-mode-tactile"));
    await waitFor(() => expect(screen.getByTestId("button-basics-speak-it")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("input-basics-full-name"), {
      target: { value: "A very long translated full name for responsive safety" },
    });
    vi.useFakeTimers();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    expect(sectionPostCalls("/api/onboarding/basics")).toHaveLength(0);
  });

  it("registers Address with the agent, hides the duplicate voice card in Voice mode, and waits for save", async () => {
    seedOnboardingState();
    renderSection(<AddressSection />);

    expect(await screen.findByTestId("button-section-companion-primary-voice-action")).toHaveTextContent("Speak it");
    expect(screen.queryByTestId("button-address-speak-it")).not.toBeInTheDocument();

    spokenTranscript = "42 Calle Mayor, Zamora, 49001, Spain";
    fireEvent.click(screen.getByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-address-voice-draft")).toHaveTextContent("Review home address");
    expect(screen.getByText("42 Calle Mayor")).toBeInTheDocument();
    expect(screen.getByText("Zamora")).toBeInTheDocument();
    expect(sectionPostCalls("/api/onboarding/section/address")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-confirm"));

    expect(screen.getByTestId("input-address-line1")).toHaveValue("42 Calle Mayor");
    expect(screen.getByTestId("input-address-city")).toHaveValue("Zamora");
    expect(sectionPostCalls("/api/onboarding/section/address")).toHaveLength(0);
  });

  it("supports Address correction and tactile mode without premature POST", async () => {
    seedOnboardingState();
    renderSection(<AddressSection />);

    spokenTranscript = "42 Calle Mayor, Zamora, 49001, Spain";
    fireEvent.click(await screen.findByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    const review = await screen.findByTestId("panel-address-voice-draft");
    fireEvent.click(screen.getByTestId("button-profile-voice-draft-remove-city"));
    expect(review).not.toHaveTextContent("Zamora");

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-try-again"));
    expect(await screen.findByTestId("mock-speak-it-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-mock-speak-it-cancel"));
    fireEvent.click(screen.getByTestId("button-section-companion-mode-tactile"));
    await waitFor(() => expect(screen.getByTestId("button-address-speak-it")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("input-address-line1"), {
      target: { value: "Avenida de una etiqueta traducida muy larga 123" },
    });
    vi.useFakeTimers();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    expect(sectionPostCalls("/api/onboarding/section/address")).toHaveLength(0);
  });

  it("registers Emergency contact with review, skip command, and explicit save only", async () => {
    seedOnboardingState();
    renderSection(<EmergencySection />);

    expect(await screen.findByTestId("button-section-companion-primary-voice-action")).toHaveTextContent("Add by voice");
    expect(screen.queryByTestId("button-emergency-speak-it")).not.toBeInTheDocument();

    spokenTranscript = "skip this";
    fireEvent.click(screen.getByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));
    expect(screen.queryByTestId("panel-emergency-voice-draft")).not.toBeInTheDocument();

    spokenTranscript = "My emergency contact is Sara my daughter phone +34 612 345 678";
    fireEvent.click(screen.getByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-emergency-voice-draft")).toHaveTextContent("Review emergency contact");
    expect(screen.getByText("Sara")).toBeInTheDocument();
    expect(screen.getByText("+34 612 345 678")).toBeInTheDocument();
    expect(sectionPostCalls("/api/onboarding/section/emergency")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-confirm"));

    expect(screen.getByTestId("input-emergency-name")).toHaveValue("Sara");
    expect(screen.getByTestId("input-emergency-primary-phone")).toHaveValue("+34 612 345 678");
    expect(sectionPostCalls("/api/onboarding/section/emergency")).toHaveLength(0);
  });

  it("keeps Emergency tactile controls visible on mobile-sized layouts without autosave", async () => {
    seedOnboardingState();
    window.innerWidth = 390;
    renderSection(<EmergencySection />);

    fireEvent.click(await screen.findByTestId("button-section-companion-mode-tactile"));
    await waitFor(() => expect(screen.getByTestId("button-emergency-speak-it")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("input-emergency-name"), {
      target: { value: "Nombre traducido extraordinariamente largo" },
    });
    fireEvent.change(screen.getByTestId("input-emergency-primary-phone"), {
      target: { value: "+34 600 000 000" },
    });
    vi.useFakeTimers();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    expect(sectionPostCalls("/api/onboarding/section/emergency")).toHaveLength(0);
  });
});
