import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MedicationRefillsScreen from "./MedicationRefillsScreen";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...original, apiFetch: vi.fn() };
});

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
  };
});

const apiFetchMock = vi.mocked(apiFetch);

const medicine = {
  medicineId: "medicine-1",
  medicineName: "Metformin",
  strength: "500mg once daily",
  doseUnit: "tablet",
  unitsPerDose: 1,
  dailyFrequency: 1,
  refillAlertDays: 7,
  inventoryTrackingEnabled: true,
  estimatedQuantity: 18,
  daysRemaining: 18,
  projectedRunOutDate: "2026-09-17",
  status: "on_track" as const,
  confidence: "high" as const,
  calculationReason: "Based on the latest stock count and daily routine.",
  updatedAt: "2026-08-30T10:00:00Z",
  updatedBy: { name: "Rosa", role: "elder" },
  history: [{ id: "event-1", type: "stock_count" as const, quantity: 18, unit: "tablet", occurredOn: "2026-08-30", source: "manual", updatedBy: "Rosa", actorRole: "elder" }],
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => ({
          profileId: "profile-1",
          actorRole: "elder",
          permissions: { manage_inventory: true },
          medicines: [medicine],
        }),
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/meds/refills"]}>
        <MedicationRefillsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MedicationRefillsScreen", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("shows the forecast, confidence, attribution, and reminder-only boundary", async () => {
    renderScreen();
    expect(await screen.findByText("You have about 18 days left")).toBeInTheDocument();
    expect(screen.getAllByText("18 tablets").length).toBeGreaterThan(0);
    expect(screen.getByText(/High confidence · Updated by Rosa/)).toBeInTheDocument();
    expect(screen.getByText(/VYVA never orders or contacts anyone/)).toBeInTheDocument();
  });

  it("reviews a manual purchase before saving and shows recalculated coverage", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      summary: { ...medicine, estimatedQuantity: 46, daysRemaining: 46, projectedRunOutDate: "2026-10-15" },
    }), { status: 201, headers: { "Content-Type": "application/json" } }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-update-medicine-supply"));
    fireEvent.click(screen.getByTestId("button-refill-manual"));
    expect(screen.getByTestId("refill-draft-projection")).toHaveTextContent("Confirm the quantity and routine");
    fireEvent.change(screen.getByTestId("input-refill-quantity"), { target: { value: "28" } });
    expect(screen.getByTestId("refill-draft-projection")).toHaveTextContent("Projected run-out date");
    fireEvent.click(screen.getByTestId("button-refill-save"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock.mock.calls[0]?.[0]).toBe("/api/meds/refills/me/medicines/medicine-1/purchases");
    expect(JSON.parse(String(apiFetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      quantity: 28,
      doseUnit: "tablet",
      unitsPerDose: 1,
      dailyFrequency: 1,
      refillAlertDays: 7,
      source: "manual",
    });
    expect(await screen.findByText("About 46 days covered")).toBeInTheDocument();
    expect(screen.getByText(/No order was placed and nobody was contacted/)).toBeInTheDocument();
  });

  it("sends an absolute count to the stock-count endpoint", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({ summary: { ...medicine, estimatedQuantity: 9, daysRemaining: 9 } }), { status: 201, headers: { "Content-Type": "application/json" } }));
    renderScreen();
    fireEvent.click(await screen.findByTestId("button-update-medicine-supply"));
    fireEvent.click(screen.getByTestId("button-refill-stock-count"));
    fireEvent.change(screen.getByTestId("input-refill-quantity"), { target: { value: "9" } });
    fireEvent.click(screen.getByTestId("button-refill-save"));
    await waitFor(() => expect(apiFetchMock.mock.calls[0]?.[0]).toContain("/stock-counts"));
  });
});
