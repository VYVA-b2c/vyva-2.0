import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConditionsSection from "./ConditionsSection";
import MedicationsSection from "./MedicationsSection";
import AllergiesSection from "./AllergiesSection";
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

vi.mock("@/components/onboarding/SpeakItOverlay", () => ({
  default: () => null,
}));

vi.mock("@/components/VoiceMedsModal", () => ({
  default: () => null,
}));

vi.mock("@/components/VoiceAllergiesModal", () => ({
  default: () => null,
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

function lastPostedBody() {
  const postCall = apiFetchMock.mock.calls.find(([, init]) => init?.method === "POST");
  if (!postCall) throw new Error("No POST request was made");
  return JSON.parse((postCall[1]?.body ?? "{}") as string) as Record<string, unknown>;
}

describe("profile section reviewed-empty choices", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true }));
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("keeps health incomplete until no known conditions is selected", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    const save = await screen.findByTestId("button-conditions-save");
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-conditions-no-known"));
    expect(save).toBeEnabled();

    fireEvent.click(save);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/onboarding/section/conditions",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(lastPostedBody()).toMatchObject({
      health_conditions: [],
      no_known_conditions: true,
    });
  });

  it("clears the no known conditions choice when a condition is added", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    fireEvent.click(await screen.findByTestId("button-conditions-no-known"));
    expect(screen.getByTestId("button-conditions-no-known")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("accordion-heart"));
    fireEvent.click(screen.getByTestId("card-condition-hypertension"));
    expect(screen.getByTestId("button-conditions-no-known")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("button-conditions-save"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      health_conditions: ["Hypertension"],
      no_known_conditions: false,
    });
  });

  it("keeps optional daily-life context compact until requested", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    const dailyLifeButton = await screen.findByTestId("button-conditions-daily-life");
    expect(dailyLifeButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Living situation")).not.toBeInTheDocument();

    fireEvent.click(dailyLifeButton);

    expect(dailyLifeButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Mobility")).toBeInTheDocument();
    expect(screen.getByText("Living situation")).toBeInTheDocument();
  });

  it("keeps medications incomplete until no current medications is selected", async () => {
    seedOnboardingState();
    renderSection(<MedicationsSection />);

    const save = await screen.findByTestId("button-meds-save");
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-meds-no-current"));
    expect(save).toBeEnabled();

    fireEvent.click(save);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/onboarding/section/medications",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(lastPostedBody()).toMatchObject({
      medications: [],
      no_known_medications: true,
    });
  });

  it("clears the no current medications choice when a medication is entered", async () => {
    seedOnboardingState();
    renderSection(<MedicationsSection />);

    fireEvent.click(await screen.findByTestId("button-meds-no-current"));
    expect(screen.getByTestId("button-meds-no-current")).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByTestId("input-med-name-0"), { target: { value: "Metformin" } });
    expect(screen.getByTestId("button-meds-no-current")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("button-meds-save"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      medications: [{ medication_name: "Metformin" }],
      no_known_medications: false,
    });
  });

  it("keeps allergies incomplete until no known allergies is selected", async () => {
    seedOnboardingState();
    renderSection(<AllergiesSection />);

    const save = await screen.findByTestId("button-allergies-save");
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-allergies-no-known"));
    expect(save).toBeEnabled();

    fireEvent.click(save);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/onboarding/section/medications",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(lastPostedBody()).toMatchObject({
      known_allergies: [],
      no_known_allergies: true,
    });
  });

  it("clears the no known allergies choice when an allergy is added", async () => {
    seedOnboardingState();
    renderSection(<AllergiesSection />);

    fireEvent.click(await screen.findByTestId("button-allergies-no-known"));
    expect(screen.getByTestId("button-allergies-no-known")).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByTestId("input-allergies-new"), { target: { value: "Penicillin" } });
    fireEvent.click(screen.getByTestId("button-allergies-add"));
    expect(screen.getByTestId("button-allergies-no-known")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("button-allergies-save"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      known_allergies: ["Penicillin"],
      no_known_allergies: false,
    });
  });
});
