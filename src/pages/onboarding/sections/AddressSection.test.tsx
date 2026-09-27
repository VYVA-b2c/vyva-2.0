import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AddressSection from "./AddressSection";

const state = vi.hoisted(() => ({ language: "fr", api: vi.fn(), toast: vi.fn(), invalidate: vi.fn(), noop: vi.fn() }));
vi.mock("@/i18n", () => ({ useLanguage: () => ({ language: state.language }) }));
vi.mock("@/lib/queryClient", () => ({ apiFetch: (...args: unknown[]) => state.api(...args), queryClient: { invalidateQueries: (...args: unknown[]) => state.invalidate(...args) } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/components/onboarding/PhoneFrame", () => ({ PhoneFrame: ({ children, subtitle }: { children: ReactNode; subtitle: string }) => <main><h1>{subtitle}</h1>{children}</main> }));
vi.mock("@/components/onboarding/ProfileSectionHero", () => ({ seniorInputClassName: "", ProfileSectionHero: () => null }));
vi.mock("@/components/onboarding/ProfileSectionControls", () => ({ ProfileVoiceAction: () => null }));
vi.mock("@/components/onboarding/OnboardingCompanionTarget", () => ({ OnboardingCompanionTarget: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/onboarding/ProfileVoiceDraftReview", () => ({ ProfileVoiceDraftReview: () => null }));
vi.mock("@/components/onboarding/SpeakItOverlay", () => ({ default: () => null }));
vi.mock("@/components/onboarding/useOnboardingAgent", () => ({ useOnboardingAgent: () => ({ mode: "touch", setMode: state.noop, setGuidance: state.noop, clearGuidance: state.noop, registerVoiceAction: state.noop }) }));
vi.mock("@/components/onboarding/useOnboardingElevenLabsSectionRuntime", () => ({ useOnboardingElevenLabsSectionRuntime: () => ({ startRuntimeCapture: state.noop }) }));

const saved = { address_line_1: "6 Calle Test", address_line_2: "2A", city: "Tarifa", region: "Andalucia", postcode: "11380", country_code: "ES" };
const json = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
function RouteProbe() { return <span data-testid="route">{useLocation().pathname}</span>; }
function renderAddress() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async () => ({ profile: saved }) } } });
  const tree = () => <QueryClientProvider client={client}><MemoryRouter><AddressSection /><RouteProbe /></MemoryRouter></QueryClientProvider>;
  const view = render(tree());
  return { ...view, switchLanguage: (language: string) => { state.language = language; view.rerender(tree()); } };
}
function detectLocation() {
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 36, longitude: -5.6, accuracy: 20 } } as GeolocationPosition) } });
}

describe("address language and detection state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.language = "fr";
    state.api.mockResolvedValue(json({}));
    state.invalidate.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["en", "es", "fr", "de", "it", "pt"])("retains saved values while switching to %s", async language => {
    const view = renderAddress();
    await waitFor(() => expect(screen.getByTestId("input-address-city")).toHaveValue("Tarifa"));
    view.switchLanguage(language);
    expect(screen.getByTestId("input-address-line1")).toHaveValue(saved.address_line_1);
    expect(screen.getByTestId("input-address-postcode")).toHaveValue("11380");
    expect(screen.getByTestId("select-address-country")).not.toHaveTextContent("Other");
    fireEvent.click(screen.getByTestId("button-address-save"));
    await waitFor(() => expect(state.api).toHaveBeenCalledWith("/api/onboarding/section/address", expect.objectContaining({ body: JSON.stringify({ address_line_1: saved.address_line_1, address_line_2: "2A", city: "Tarifa", region: "Andalucia", postcode: "11380", country_code: "Spain" }) })));
    await waitFor(() => expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ["/api/profile"] }));
    expect(screen.getByTestId("route")).toHaveTextContent("/onboarding/complete/address");
  });

  it("preserves the existing address after lookup failure and explains that it can still be saved", async () => {
    detectLocation();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    state.api.mockRejectedValueOnce(new Error("offline"));
    renderAddress();
    await waitFor(() => expect(screen.getByTestId("input-address-city")).toHaveValue("Tarifa"));
    fireEvent.click(screen.getByTestId("button-address-detect-location"));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Recherche d’adresse indisponible", description: expect.stringContaining("n’a pas changé") })));
    expect(screen.getByTestId("input-address-line1")).toHaveValue(saved.address_line_1);
    fireEvent.click(screen.getByTestId("button-address-save"));
    await waitFor(() => expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ["/api/profile"] }));
  });

  it("uses ISO country codes and does not combine a detected city with the old street", async () => {
    detectLocation();
    state.api.mockResolvedValueOnce(json({ address: { city: "Paris", country: "France", country_code: "FR" } }));
    renderAddress();
    await waitFor(() => expect(screen.getByTestId("input-address-city")).toHaveValue("Tarifa"));
    fireEvent.click(screen.getByTestId("button-address-detect-location"));
    await waitFor(() => expect(screen.getByTestId("input-address-city")).toHaveValue("Paris"));
    expect(screen.getByTestId("input-address-line1")).toHaveValue("");
    expect(screen.getByTestId("input-address-postcode")).toHaveValue("");
    expect(screen.getByTestId("select-address-country")).toHaveTextContent("France");
  });
});
