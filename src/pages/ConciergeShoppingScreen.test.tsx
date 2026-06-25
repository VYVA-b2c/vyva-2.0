import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeShoppingScreen from "./ConciergeShoppingScreen";
import { apiFetch } from "@/lib/queryClient";
import { buildShoppingRecommendations, getStaticShoppingSupportPackages } from "../../shared/shopping";

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

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state)}</span>
    </>
  );
}

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

function mockShoppingApi(nextRecommendationResponse?: Response) {
  apiFetchMock.mockImplementation((path) => {
    if (path === "/api/concierge/shopping/support-packages") {
      return Promise.resolve(jsonResponse({ source: "static", packages: getStaticShoppingSupportPackages() }));
    }
    if (path === "/api/concierge/shopping/recommendations" && nextRecommendationResponse) {
      return Promise.resolve(nextRecommendationResponse);
    }
    return Promise.resolve(errorResponse(500, { error: "Unexpected API call" }));
  });
}

function mockShoppingApiWithPackages(packages: unknown[], nextRecommendationResponse?: Response) {
  apiFetchMock.mockImplementation((path) => {
    if (path === "/api/concierge/shopping/support-packages") {
      return Promise.resolve(jsonResponse({ source: "database", packages }));
    }
    if (path === "/api/concierge/shopping/recommendations" && nextRecommendationResponse) {
      return Promise.resolve(nextRecommendationResponse);
    }
    return Promise.resolve(errorResponse(500, { error: "Unexpected API call" }));
  });
}

function renderScreen(initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"] = ["/concierge/shopping"]) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={initialEntries}>
      <LocationProbe />
      <ConciergeShoppingScreen />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("ConciergeShoppingScreen", () => {
  it("submits a need, renders recommendations, and saves a shortlist item", async () => {
    mockShoppingApi(jsonResponse(buildShoppingRecommendations({
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

  it("shows an accessible validation error before calling the API", async () => {
    mockShoppingApi();
    renderScreen();
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/shopping/support-packages");
    });

    fireEvent.click(screen.getByTestId("button-shopping-find"));

    expect(screen.getByRole("alert")).toHaveTextContent("Write a short sentence");
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/concierge/shopping/recommendations", expect.anything());
  });

  it("uses symptom report route prefill for a hydration order", async () => {
    mockShoppingApi(jsonResponse(buildShoppingRecommendations({
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
          packageId: "hydration_support",
          sourceRecommendation: "Stay hydrated and drink fluids",
        },
      },
    }]);

    expect(screen.getByLabelText("What do you need help choosing?")).toHaveValue("Hydration support with easy delivery");
    expect(await screen.findByTestId("shopping-support-packages")).toHaveTextContent("Hydration support");
    expect(screen.getByTestId("shopping-support-packages")).toHaveTextContent("No checkout starts here.");

    fireEvent.click(screen.getByTestId("button-shopping-find"));
    await screen.findByTestId("shopping-recommendation-results");

    const [, init] = apiFetchMock.mock.calls.find(([path]) => path === "/api/concierge/shopping/recommendations") ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      needText: "Hydration support with easy delivery",
      category: "groceries",
      packageId: "hydration_support",
    });
    expect(body.priorities).toEqual(expect.arrayContaining(["delivery", "simplicity", "accessibility"]));
    expect(body.constraints).toEqual(expect.arrayContaining(["easy-open packaging and simple instructions"]));
  });

  it("renders backend support packages when the API provides them", async () => {
    mockShoppingApiWithPackages([{
      id: "custom_vyva_package",
      label: { en: "Custom VYVA package", es: "Paquete VYVA" },
      description: { en: "Admin-approved package copy.", es: "Copia aprobada por admin." },
      needText: { en: "Custom package support", es: "Apoyo de paquete" },
      category: "groceries",
      priorities: ["simplicity"],
      constraints: { en: ["admin approved"], es: ["aprobado por admin"] },
      ctaLabel: { en: "Compare custom", es: "Comparar" },
      productIds: ["small-water-bottle-multipack"],
    }]);

    renderScreen([{
      pathname: "/concierge/shopping",
      state: {
        shoppingPrefill: {
          needText: "Custom package support",
          category: "groceries",
          priorities: ["simplicity"],
          packageId: "custom_vyva_package",
        },
      },
    }]);

    expect(await screen.findByText("Custom VYVA package")).toBeInTheDocument();
    expect(screen.getByTestId("shopping-support-packages")).toHaveTextContent("Admin-approved package copy.");
  });

  it("lets users switch between preconfigured support packages", async () => {
    mockShoppingApi();
    renderScreen([{
      pathname: "/concierge/shopping",
      state: {
        shoppingPrefill: {
          needText: "Hydration support with easy delivery",
          category: "groceries",
          priorities: ["delivery", "simplicity"],
          packageId: "hydration_support",
          sourceRecommendation: "Stay hydrated and drink fluids",
        },
      },
    }]);

    expect(await screen.findByTestId("shopping-support-packages")).toHaveTextContent("Choose a support package");

    fireEvent.click(screen.getByTestId("button-shopping-package-easy_meals"));

    expect((screen.getByLabelText("What do you need help choosing?") as HTMLTextAreaElement).value).toContain("Easy meals");
    expect(screen.getByLabelText("Avoid")).toHaveValue("easy to open, simple preparation");
    expect(screen.getByTestId("button-shopping-package-easy_meals")).toHaveAttribute("aria-pressed", "true");
  });

  it("routes the home support package to Concierge instead of product checkout", async () => {
    mockShoppingApi();
    renderScreen([{
      pathname: "/concierge/shopping",
      state: {
        shoppingPrefill: {
          needText: "Hydration support with easy delivery",
          category: "groceries",
          priorities: ["delivery", "simplicity"],
          packageId: "hydration_support",
          sourceRecommendation: "Have someone stay nearby tonight",
        },
      },
    }]);

    await screen.findByTestId("shopping-support-packages");
    fireEvent.click(screen.getByTestId("button-shopping-package-home_support"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"home_care_quote\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"symptom_report\"");
    });
  });

  it("shows specific API errors for missing Concierge access", async () => {
    mockShoppingApi(errorResponse(403, {
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
    mockShoppingApi(errorResponse(502, {
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
    mockShoppingApi(jsonResponse(buildShoppingRecommendations({
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

  it("flags suspicious seller details and prepares a trusted review", async () => {
    mockShoppingApi();
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /Check product/ }));
    fireEvent.change(screen.getByLabelText("Product, label, message, or website"), {
      target: { value: "Seller asks me to pay by gift card for a discounted blood pressure monitor." },
    });
    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "180" },
    });
    fireEvent.change(screen.getByLabelText("Seller or website"), {
      target: { value: "unknown seller" },
    });
    fireEvent.click(screen.getByTestId("button-shopping-safety-check"));

    expect(screen.getByTestId("shopping-safety-result")).toHaveTextContent("Ask someone you trust");

    fireEvent.click(screen.getByRole("button", { name: "Ask trusted person" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"shopping_review\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("gift card");
    });
  });
});
