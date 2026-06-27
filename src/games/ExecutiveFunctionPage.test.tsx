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
          <Route path="/executive-function/number-trails" element={<h1>Number Trails page</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Number Trails/i }));

    expect(screen.getByRole("heading", { name: "Number Trails page" })).toBeInTheDocument();
  });
});
