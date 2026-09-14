import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DevicesSection from "./DevicesSection";
import DietSection from "./DietSection";
import CognitiveSection from "./CognitiveSection";
import HobbiesSection from "./HobbiesSection";
import ProvidersSection from "./ProvidersSection";
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

vi.mock("@/components/onboarding/PlacesSearch", () => ({
  CATEGORY_TYPES: {},
  PlacesSearch: () => <input data-testid="mock-places-search" placeholder="Search provider..." />,
}));

vi.mock("@/components/onboarding/MerchantDetailSheet", () => ({
  MerchantDetailSheet: ({ open }: { open: boolean }) => open ? <div data-testid="sheet-merchant-detail" /> : null,
}));

let spokenTranscript = "";

vi.mock("@/components/onboarding/SpeakItOverlay", () => ({
  default: ({ title, onDone, onCancel }: {
    title: string;
    onDone: (transcript: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="mock-speak-it-overlay" aria-label={title}>
      <button type="button" data-testid="button-mock-speak-it-done" onClick={() => onDone(spokenTranscript)}>
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

function seedOnboardingState(profile: Record<string, unknown> = {}) {
  const state = {
    profile,
    onboardingState: {},
    account: { id: "user-1", activeProfileId: "user-1", role: "elder" },
  };
  queryClient.clear();
  queryClient.setQueryData(["/api/onboarding/state"], state);
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(state)));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
}

function renderSection(section: ReactNode, initialState: Record<string, unknown> = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: "/onboarding/profile", state: initialState }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

describe("Onboarding Agent profile expansion PR B", () => {
  beforeEach(() => {
    window.localStorage.clear();
    spokenTranscript = "";
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true }));
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("reviews Devices voice input before local apply and never autosaves selection changes", async () => {
    seedOnboardingState();
    renderSection(<DevicesSection />);

    expect(await screen.findByTestId("button-section-companion-primary-voice-action")).toHaveTextContent("Add by voice");
    expect(screen.queryByTestId("button-devices-speak-it")).not.toBeInTheDocument();

    spokenTranscript = "I use a Fitbit and a blood pressure monitor";
    fireEvent.click(screen.getByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-devices-voice-draft")).toHaveTextContent("Review devices");
    expect(sectionPostCalls("/api/onboarding/section/devices")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-confirm"));
    expect(screen.getByTestId("button-device-bp_monitor")).toHaveAttribute("data-testid", "button-device-bp_monitor");
    expect(sectionPostCalls("/api/onboarding/section/devices")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-device-smartwatch"));
    vi.useFakeTimers();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();
    expect(sectionPostCalls("/api/onboarding/section/devices")).toHaveLength(0);
  });

  it("reviews Diet voice input and keeps tactile controls unchanged", async () => {
    seedOnboardingState();
    renderSection(<DietSection />);

    spokenTranscript = "I am Gluten-free and Low salt";
    fireEvent.click(await screen.findByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-diet-voice-draft")).toHaveTextContent("Gluten-free");
    expect(sectionPostCalls("/api/onboarding/section/diet")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-confirm"));
    expect(sectionPostCalls("/api/onboarding/section/diet")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-section-companion-mode-tactile"));
    await waitFor(() => expect(screen.getByTestId("button-diet-speak-it")).toBeInTheDocument());
  });

  it("reviews Cognitive voice input before applying preferences", async () => {
    seedOnboardingState();
    renderSection(<CognitiveSection />);

    spokenTranscript = "Mild support, 10 minute sessions, slower pace, simpler language";
    fireEvent.click(await screen.findByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-cognitive-voice-draft")).toHaveTextContent("Mild support");
    expect(sectionPostCalls("/api/onboarding/section/cognitive")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-confirm"));
    expect(sectionPostCalls("/api/onboarding/section/cognitive")).toHaveLength(0);
  });

  it("supports Hobbies correction/try-again and waits for explicit save", async () => {
    seedOnboardingState();
    renderSection(<HobbiesSection />);

    spokenTranscript = "I love walking, reading and cooking";
    fireEvent.click(await screen.findByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-hobbies-voice-draft")).toHaveTextContent("Walking");
    fireEvent.click(screen.getByTestId("button-profile-voice-draft-remove-walking"));
    expect(screen.getByTestId("panel-hobbies-voice-draft")).not.toHaveTextContent("Walking");
    fireEvent.click(screen.getByTestId("button-profile-voice-draft-try-again"));
    expect(await screen.findByTestId("mock-speak-it-overlay")).toBeInTheDocument();
    expect(sectionPostCalls("/api/onboarding/section/hobbies")).toHaveLength(0);
  });

  it("reviews Providers voice details and keeps provider mutations local until section save", async () => {
    seedOnboardingState({ data_sharing_consent: { providers: { providers: [] } } });
    renderSection(<ProvidersSection />, { setupFocus: "doctor_clinic" });

    spokenTranscript = "Provider is Zamora Clinic phone +34 600 000 000 email clinic@example.com";
    fireEvent.click(await screen.findByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(await screen.findByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-providers-voice-draft")).toHaveTextContent("Zamora Clinic");
    expect(sectionPostCalls("/api/onboarding/section/providers")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-confirm"));
    expect(screen.getByTestId("input-manual-name")).toHaveValue("Zamora Clinic");
    expect(screen.getByTestId("input-manual-phone")).toHaveValue("+34 600 000 000");

    fireEvent.click(screen.getByTestId("button-manual-add"));
    expect(sectionPostCalls("/api/onboarding/section/providers")).toHaveLength(0);
    expect(screen.getByTestId("list-saved-providers")).toHaveTextContent("Zamora Clinic");
  });

  it("keeps PR-B profile sections usable at mobile width with long labels and tactile mode available", async () => {
    const longLabel =
      "Una etiqueta traducida extraordinariamente larga para comprobar que la interfaz sigue siendo utilizable en móvil";
    const cases: Array<{
      section: ReactNode;
      expectedText: RegExp | string;
      tactileProbe: string;
      profile?: Record<string, unknown>;
      initialState?: Record<string, unknown>;
    }> = [
      {
        section: <DevicesSection />,
        expectedText: /Devices|Useful tech/i,
        tactileProbe: "button-device-smartwatch",
        profile: {
          device_access: {
            devices: [longLabel],
            accessibility_features: [`${longLabel} con más detalle`],
          },
        },
      },
      {
        section: <DietSection />,
        expectedText: /Diet|Dietary/i,
        tactileProbe: "button-diet-speak-it",
        profile: {
          preferences: {
            diet: [longLabel],
            dietary_notes: `${longLabel} sin desbordar el contenido visible`,
          },
        },
      },
      {
        section: <HobbiesSection />,
        expectedText: /Hobbies|Interests/i,
        tactileProbe: "button-hobbies-speak-it",
        profile: {
          preferences: {
            hobbies: [longLabel],
            activity_preferences: { notes: `${longLabel} para actividades compartidas` },
          },
        },
      },
      {
        section: <CognitiveSection />,
        expectedText: /Cognitive|Memory/i,
        tactileProbe: "button-cognitive-speak-it",
        profile: {
          preferences: {
            cognitive: {
              memory_support: "mild",
              notes: longLabel,
            },
          },
        },
      },
      {
        section: <ProvidersSection />,
        expectedText: longLabel,
        tactileProbe: "list-saved-providers",
        profile: {
          data_sharing_consent: {
            providers: {
              providers: [
                {
                  name: longLabel,
                  role: "doctor_clinic",
                  phone: "+34 600 111 222",
                  is_trusted: true,
                  is_default: true,
                },
              ],
            },
          },
        },
        initialState: { setupFocus: "doctor_clinic" },
      },
    ];

    window.innerWidth = 390;
    window.dispatchEvent(new Event("resize"));

    for (const item of cases) {
      cleanup();
      window.localStorage.clear();
      seedOnboardingState(item.profile);
      renderSection(item.section, item.initialState);

      expect(await screen.findByTestId("onboarding-companion-mode-chip")).toHaveTextContent("Voice");
      expect(await screen.findByTestId("button-section-companion-primary-voice-action")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("button-section-companion-mode-tactile"));
      await waitFor(() => expect(screen.getByTestId(item.tactileProbe)).toBeInTheDocument());
      expect(screen.getAllByText(item.expectedText).length).toBeGreaterThan(0);
    }
  });
});
