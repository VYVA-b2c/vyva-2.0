import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CareTeamFlow from "./CareTeamFlow";
import { queryClient } from "@/lib/queryClient";

vi.mock("@/i18n", () => ({
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("@/components/onboarding/SpeakItOverlay", () => ({
  default: () => null,
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
      <MemoryRouter>
        <CareTeamFlow />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CareTeamFlow", () => {
  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("allows continuing with name and phone when optional email is blank", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ members: [] })));
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

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
});
