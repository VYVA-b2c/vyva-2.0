import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GPSection from "./GPSection";
import { apiFetch, queryClient } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

vi.mock("@/components/onboarding/PlacesSearch", () => ({
  PlacesSearch: () => (
    <input
      data-testid="mock-gp-places-search"
      placeholder="Search GP surgery or practice..."
    />
  ),
}));

const apiFetchMock = vi.mocked(apiFetch);

function seedOnboardingState() {
  queryClient.clear();
  queryClient.setQueryData(["/api/onboarding/state"], {
    profile: {},
    onboardingState: {},
    account: { id: "user-1", activeProfileId: "user-1", role: "elder" },
  });
}

function renderGpSection() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GPSection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("GPSection onboarding companion mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedOnboardingState();
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  it("shows the shared Voice/Tactile switch without saving GP details while switching modes", async () => {
    renderGpSection();

    expect(await screen.findByTestId("onboarding-companion-mode-chip")).toBeVisible();
    expect(screen.getByTestId("button-section-companion-mode-voice")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(screen.getByTestId("button-section-companion-mode-tactile"));

    await waitFor(() =>
      expect(screen.getByTestId("button-section-companion-mode-tactile")).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(screen.getByTestId("button-gp-voice")).toBeVisible();

    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/onboarding/section/gp",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
