import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SectionCompleteScreen from "./SectionCompleteScreen";

function renderSection(section: string) {
  return render(
    <MemoryRouter initialEntries={[`/onboarding/complete/${section}`]}>
      <Routes>
        <Route path="/onboarding/complete/:section" element={<SectionCompleteScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SectionCompleteScreen", () => {
  it("uses the setup receipt moment for trusted providers", () => {
    renderSection("providers");

    expect(screen.getByTestId("text-section-complete-title")).toHaveTextContent("Ready for future help");
    expect(screen.getByTestId("text-section-complete-message")).toHaveTextContent("VYVA can use this next time you ask for help.");
  });

  it("keeps normal section completion copy for non-provider sections", () => {
    renderSection("basics");

    expect(screen.getByTestId("text-section-complete-title")).toHaveTextContent("Basics saved");
    expect(screen.getByTestId("text-section-complete-message")).toHaveTextContent("Your personal details are looking good.");
  });
});
