import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeShoppingScreen from "./ConciergeShoppingScreen";
import { apiFetch } from "@/lib/queryClient";
import { buildShoppingRecommendations } from "../../shared/shopping";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    i18n: { language: "en" },
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderScreen(initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"] = ["/concierge/shopping"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ConciergeShoppingScreen />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("ConciergeShoppingScreen", () => {
  it("submits a need, renders recommendations, and saves a shortlist item", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse(buildShoppingRecommendations({
      needText: "Safer bathroom at night",
      category: "safe_home",
      priorities: ["safety", "accessibility"],
      locale: "en",
    })));

    renderScreen();

    fireEvent.change(screen.getByLabelText("What do you need help choosing?"), {
      target: { value: "Safer bathroom at night" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Any safe-home area/ }));
    fireEvent.click(screen.getByTestId("button-shopping-find"));

    expect(screen.getByText("Finding clear choices...")).toBeInTheDocument();

    await screen.findByTestId("shopping-recommendation-results");
    expect(screen.getByText("Best choices")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/shopping/recommendations", expect.objectContaining({
      method: "POST",
    }));

    const firstSave = screen.getAllByRole("button", { name: "Save choice" })[0];
    fireEvent.click(firstSave);

    await waitFor(() => {
      expect(screen.getByTestId("shopping-shortlist")).toBeInTheDocument();
      expect(screen.getByText("Shortlist: 1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Saved" })[0]);
    await waitFor(() => {
      expect(screen.queryByTestId("shopping-shortlist")).not.toBeInTheDocument();
      expect(screen.getByText("Shortlist: 0")).toBeInTheDocument();
    });
  });

  it("shows an accessible validation error before calling the API", () => {
    renderScreen();

    fireEvent.click(screen.getByTestId("button-shopping-find"));

    expect(screen.getByRole("alert")).toHaveTextContent("Write a short sentence");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("uses symptom report route prefill for a hydration order", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse(buildShoppingRecommendations({
      needText: "Hydration support with easy delivery",
      category: "groceries",
      priorities: ["delivery", "simplicity"],
      locale: "en",
    })));

    renderScreen([{
      pathname: "/concierge/shopping",
      state: {
        shoppingPrefill: {
          needText: "Hydration support with easy delivery",
          category: "groceries",
          priorities: ["delivery", "simplicity"],
        },
      },
    }]);

    expect(screen.getByLabelText("What do you need help choosing?")).toHaveValue("Hydration support with easy delivery");
    expect(screen.getByTestId("panel-shopping-route-prefill")).toHaveTextContent("Hydration delivery prepared");

    fireEvent.click(screen.getByTestId("button-shopping-prefill-find"));
    await screen.findByTestId("shopping-recommendation-results");

    const [, init] = apiFetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      needText: "Hydration support with easy delivery",
      category: "groceries",
      priorities: ["delivery", "simplicity"],
    });
  });

  it("shows specific API errors for missing Concierge access", async () => {
    apiFetchMock.mockResolvedValueOnce(errorResponse(403, {
      error: "Your current plan does not include concierge.",
      code: "ENTITLEMENT_REQUIRED",
    }));

    renderScreen();

    fireEvent.change(screen.getByLabelText("What do you need help choosing?"), {
      target: { value: "Safer bathroom at night" },
    });
    fireEvent.click(screen.getByTestId("button-shopping-find"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Concierge is not included");
    });
  });

  it("shows the local API guidance when the dev proxy fails", async () => {
    apiFetchMock.mockResolvedValueOnce(errorResponse(502, {
      error: "API proxy failed",
      code: "LOCAL_API_UNAVAILABLE",
    }));

    renderScreen();

    fireEvent.change(screen.getByLabelText("What do you need help choosing?"), {
      target: { value: "Safer bathroom at night" },
    });
    fireEvent.click(screen.getByTestId("button-shopping-find"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("backend on port 3001");
    });
  });

  it("turns no-match follow-up questions into a new shopping need", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse(buildShoppingRecommendations({
      needText: "purple headphones for an airplane",
      category: "safe_home",
      priorities: ["safety", "accessibility"],
      locale: "en",
    })));

    renderScreen();

    fireEvent.change(screen.getByLabelText("What do you need help choosing?"), {
      target: { value: "purple headphones for an airplane" },
    });
    fireEvent.click(screen.getByTestId("button-shopping-find"));

    await screen.findAllByRole("button", { name: /Safer bathroom at night/ });
    const followUpButtons = screen.getAllByRole("button", { name: /Safer bathroom at night/ });
    fireEvent.click(followUpButtons[followUpButtons.length - 1]);

    expect(screen.getByLabelText("What do you need help choosing?")).toHaveValue("Safer bathroom at night");
    expect(screen.queryByText("I do not have enough detail")).not.toBeInTheDocument();
  });
});
