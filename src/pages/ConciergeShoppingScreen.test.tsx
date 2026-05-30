import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeShoppingScreen from "./ConciergeShoppingScreen";
import { apiFetch } from "@/lib/queryClient";
import { buildShoppingRecommendations } from "../../shared/shopping";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("react-i18next", () => ({
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

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/concierge/shopping"]}>
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
      needText: "I need bathroom safety",
      category: "mobility_aids",
      priorities: ["safety", "accessibility"],
      locale: "en",
    })));

    renderScreen();

    fireEvent.change(screen.getByLabelText("What do you need help choosing?"), {
      target: { value: "I need bathroom safety" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Mobility aids/ }));
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
  });

  it("shows an accessible validation error before calling the API", () => {
    renderScreen();

    fireEvent.click(screen.getByTestId("button-shopping-find"));

    expect(screen.getByRole("alert")).toHaveTextContent("Write a short sentence");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
