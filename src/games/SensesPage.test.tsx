import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "@/i18n";
import SensesPage from "./SensesPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

describe("SensesPage", () => {
  beforeEach(() => {
    setLanguage("en");
  });

  it("opens Listen Closely from the Sharpen Senses hub", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/senses"]}>
        <Routes>
          <Route path="/senses" element={<SensesPage />} />
          <Route path="/senses/listen-closely" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("senses-flow-shell")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("senses-flow-shell")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.sharpen_senses");
    expect(screen.getByTestId("senses-flow-shell").querySelector('[data-vyva-icon-tile="signal"]')).toBeInTheDocument();
    const listenButton = screen.getByRole("button", { name: /Listen Closely/i });
    expect(listenButton.querySelector('[data-vyva-accent="signal"]')).toBeInTheDocument();

    fireEvent.click(listenButton);

    expect(screen.getByTestId("current-route")).toHaveTextContent("/senses/listen-closely");
  });

  it("keeps Association out of the Sharpen Senses hub", () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/senses"]}>
        <Routes>
          <Route path="/senses" element={<SensesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /Association/i })).not.toBeInTheDocument();
    expect(container.querySelector(".xl\\:grid-cols-4")).not.toBeInTheDocument();
  });

  it("opens Scent Memory from the Sharpen Senses hub", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/senses"]}>
        <Routes>
          <Route path="/senses" element={<SensesPage />} />
          <Route path="/senses/scent-memory" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Scent Memory/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/senses/scent-memory");
  });

  it("opens Breath Garden from the Sharpen Senses hub", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/senses"]}>
        <Routes>
          <Route path="/senses" element={<SensesPage />} />
          <Route path="/senses/breath-garden" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Breath Garden/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/senses/breath-garden");
  });
});
