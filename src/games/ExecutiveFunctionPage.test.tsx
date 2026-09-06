import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "@/i18n";
import ExecutiveFunctionPage from "./ExecutiveFunctionPage";

describe("ExecutiveFunctionPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLanguage("en");
  });

  it("opens Number Trails from its hub card", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/executive-function"]}>
        <Routes>
          <Route path="/executive-function" element={<ExecutiveFunctionPage />} />
          <Route path="/brain-coach/activity/number_trails" element={<h1>Number Trails page</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("executive-function-flow-shell")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("executive-function-flow-shell")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.improve_thinking");
    expect(screen.getByTestId("button-brain-coach-category-voice")).toBeInTheDocument();
    const numberTrailsButton = screen.getByRole("button", { name: /Number Trails/i });
    expect(numberTrailsButton.querySelector('[data-vyva-accent="path"]')).toBeInTheDocument();

    fireEvent.click(numberTrailsButton);

    expect(screen.getByRole("heading", { name: "Number Trails page" })).toBeInTheDocument();
  });
});
