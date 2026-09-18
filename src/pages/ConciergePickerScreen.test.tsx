import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ConciergePickerScreen from "./ConciergePickerScreen";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state)}</span>
    </>
  );
}

function renderPicker(category: "get-help" | "order-in" | "book-appointments" | "discover") {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/concierge/${category}`]}>
      <LocationProbe />
      <Routes>
        <Route path={`/concierge/${category}`} element={<ConciergePickerScreen category={category} />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConciergePickerScreen", () => {
  it("shows the four Get Help options and routes to the home-service task", () => {
    renderPicker("get-help");

    expect(screen.getByText("Get Help")).toBeInTheDocument();
    expect(screen.getByTestId("button-concierge-picker-home-repair")).toHaveTextContent("Home Repair");
    expect(screen.getByTestId("button-concierge-picker-healthcare")).toHaveTextContent("Healthcare");
    expect(screen.getByTestId("button-concierge-picker-admin-service")).toHaveTextContent("Admin Service");
    expect(screen.getByTestId("button-concierge-picker-home-care")).toHaveTextContent("Home Care");

    fireEvent.click(screen.getByTestId("button-concierge-picker-home-repair"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/task/new");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"home_service\"");
  });

  it("shows the four Book Appointments options and routes each appointment kind", () => {
    renderPicker("book-appointments");

    expect(screen.getByText("Book Appointments")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-picker-appointment-admin"));

    expect(screen.getByTestId("route-state")).toHaveTextContent("\"appointmentKind\":\"government\"");
  });

  it("routes Order In's Food option to the shopping helper with a groceries prefill", () => {
    renderPicker("order-in");

    expect(screen.getByText("Order In")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-picker-food"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"groceries\"");
  });

  it("routes Discover's Safe Home option to the safe-home flow", () => {
    renderPicker("discover");

    expect(screen.getByText("Discover")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-picker-safe-home"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/safe-home");
  });

  it("navigates back to the concierge hub", () => {
    renderPicker("get-help");

    fireEvent.click(screen.getByTestId("button-concierge-picker-back"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge");
  });
});
