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

  it("opens Association from the Sharpen Senses hub", () => {
    render(
      <MemoryRouter initialEntries={["/senses"]}>
        <Routes>
          <Route path="/senses" element={<SensesPage />} />
          <Route path="/senses/association" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Association/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/senses/association");
  });
});
