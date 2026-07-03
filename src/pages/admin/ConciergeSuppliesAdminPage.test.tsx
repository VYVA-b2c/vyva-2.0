import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeSuppliesAdminPage from "./ConciergeSuppliesAdminPage";
import { apiFetch } from "@/lib/queryClient";
import { buildShoppingRecommendations, STATIC_SHOPPING_CATALOG } from "../../../shared/shopping";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "admin@example.com", role: "admin" },
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

const adminProduct = {
  product_id: "small-water-bottle-multipack",
  category: "groceries",
  name: { en: "Small water bottle multipack", es: "Pack de botellas pequenas de agua" },
  price_label: { en: "Low cost", es: "Precio bajo" },
  description: { en: "Small bottles that are easier to lift.", es: "Botellas pequenas mas faciles de levantar." },
  benefits: { en: ["Easy to keep nearby"], es: ["Facil de tener cerca"] },
  tags: ["hydration", "water", "simple", "delivery"],
  suitability: { en: ["Good when drinks need to be close"], es: ["Buena si las bebidas deben estar cerca"] },
  cautions: { en: ["Ask a clinician if fluids are restricted."], es: ["Consulte si tiene restriccion de liquidos."] },
  accessibility_notes: { en: ["Choose easy-open caps."], es: ["Elija tapones faciles."] },
  availability_label: { en: "Usually easy to order with groceries", es: "Suele pedirse con la compra" },
  price_tier: "low",
  is_enabled: true,
  priority: 96,
  admin_notes: "",
};

const adminPackage = {
  package_id: "hydration_support",
  label: { en: "Hydration support", es: "Apoyo de hidratacion" },
  description: { en: "Compare hydration supplies.", es: "Compare suministros de hidratacion." },
  need_text: { en: "Hydration support", es: "Apoyo de hidratacion" },
  category: "groceries",
  priorities: ["delivery", "simplicity"],
  constraints: { en: ["no heavy lifting"], es: ["sin cargar peso"] },
  cta_label: { en: "Compare hydration", es: "Comparar hidratacion" },
  service_request: false,
  is_enabled: true,
  priority: 90,
  product_ids: ["small-water-bottle-multipack"],
  admin_notes: "",
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage({
  products = [adminProduct],
  packages = [adminPackage],
} = {}) {
  apiFetchMock.mockImplementation((path, init) => {
    const method = init?.method ?? "GET";
    if (path === "/api/admin/concierge/shopping/products" && method === "GET") {
      return Promise.resolve(jsonResponse({ products }));
    }
    if (path === "/api/admin/concierge/shopping/packages" && method === "GET") {
      return Promise.resolve(jsonResponse({ packages }));
    }
    if (path === "/api/admin/concierge/shopping/products/small-water-bottle-multipack" && method === "PATCH") {
      return Promise.resolve(jsonResponse({ product: adminProduct }));
    }
    if (path === "/api/admin/concierge/shopping/packages/hydration_support" && method === "PATCH") {
      return Promise.resolve(jsonResponse({ package: adminPackage }));
    }
    if (path === "/api/admin/concierge/shopping/preview" && method === "POST") {
      return Promise.resolve(jsonResponse(buildShoppingRecommendations({
        needText: "Hydration support",
        category: "groceries",
        priorities: ["delivery", "simplicity"],
        packageId: "hydration_support",
        locale: "en",
      }, {
        catalog: STATIC_SHOPPING_CATALOG,
        packageProductIds: ["small-water-bottle-multipack"],
      })));
    }
    return Promise.resolve(new Response(JSON.stringify({ error: "Unexpected call" }), { status: 500 }));
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/concierge-supplies"]}>
      <ConciergeSuppliesAdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("ConciergeSuppliesAdminPage", () => {
  it("filters catalog health queues across products and packages", async () => {
    const disabledProduct = {
      ...adminProduct,
      product_id: "disabled-shower-stool",
      category: "mobility_aids",
      name: { en: "Disabled shower stool", es: "Taburete de ducha desactivado" },
      is_enabled: false,
    };
    const unlinkedPackage = {
      ...adminPackage,
      package_id: "empty_enabled_package",
      label: { en: "Empty enabled package", es: "Paquete activo vacio" },
      product_ids: [],
      service_request: false,
      is_enabled: true,
    };
    const servicePackage = {
      ...adminPackage,
      package_id: "concierge_service_request",
      label: { en: "Concierge service request", es: "Solicitud a Concierge" },
      product_ids: [],
      service_request: true,
    };

    renderPage({
      products: [adminProduct, disabledProduct],
      packages: [adminPackage, unlinkedPackage, servicePackage],
    });

    expect(await screen.findByTestId("admin-shopping-catalog-queue")).toHaveTextContent("Showing 2 of 2 products and 3 of 3 packages.");
    const productsList = screen.getByTestId("admin-shopping-products");
    const packagesList = screen.getByTestId("admin-shopping-packages");
    expect(within(productsList).getByText("small-water-bottle-multipack")).toBeInTheDocument();
    expect(within(productsList).getByText("disabled-shower-stool")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("admin-shopping-queue-hidden"));

    expect(screen.getByTestId("admin-shopping-catalog-queue")).toHaveTextContent("Showing 1 of 2 products and 0 of 3 packages.");
    expect(within(productsList).getByText("disabled-shower-stool")).toBeInTheDocument();
    expect(within(productsList).queryByText("small-water-bottle-multipack")).not.toBeInTheDocument();
    expect(within(packagesList).getByText("No packages match this catalog queue.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("admin-shopping-queue-package_gaps"));

    expect(screen.getByTestId("admin-shopping-catalog-queue")).toHaveTextContent("Showing 0 of 2 products and 1 of 3 packages.");
    expect(within(productsList).getByText("No supply items match this catalog queue.")).toBeInTheDocument();
    expect(within(packagesList).getByText("empty_enabled_package")).toBeInTheDocument();
    expect(within(packagesList).queryByText("hydration_support")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("admin-shopping-clear-catalog-queue"));

    expect(within(productsList).getByText("small-water-bottle-multipack")).toBeInTheDocument();
    expect(within(packagesList).getByText("hydration_support")).toBeInTheDocument();
  });

  it("loads, edits, saves, assigns, and previews curated supply packages", async () => {
    renderPage();

    expect((await screen.findAllByText("small-water-bottle-multipack")).length).toBeGreaterThan(0);
    expect(screen.getByText("hydration_support")).toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText("Name EN")[1], {
      target: { value: "Small bottles edited" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save item" }));

    await waitFor(() => {
      const productPatch = apiFetchMock.mock.calls.find(([path, init]) => (
        path === "/api/admin/concierge/shopping/products/small-water-bottle-multipack" && init?.method === "PATCH"
      ));
      expect(productPatch).toBeTruthy();
      expect(String(productPatch?.[1]?.body)).toContain("Small bottles edited");
    });

    fireEvent.change(screen.getByLabelText("Linked product IDs"), {
      target: { value: "small-water-bottle-multipack" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save package" }));

    await waitFor(() => {
      const packagePatch = apiFetchMock.mock.calls.find(([path, init]) => (
        path === "/api/admin/concierge/shopping/packages/hydration_support" && init?.method === "PATCH"
      ));
      expect(packagePatch).toBeTruthy();
      expect(String(packagePatch?.[1]?.body)).toContain("small-water-bottle-multipack");
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByTestId("admin-shopping-preview-results")).toHaveTextContent("Small water bottle multipack");
  }, 15_000);
});
