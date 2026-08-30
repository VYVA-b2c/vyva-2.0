import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "@/i18n";
import AttentionBoostersPage from "./AttentionBoostersPage";

describe("AttentionBoostersPage", () => {
  beforeEach(() => {
    setLanguage("en");
  });

  it("opens Curious Minds from the Train Reflexes hub", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/attention-boosters"]}>
        <Routes>
          <Route path="/attention-boosters" element={<AttentionBoostersPage />} />
          <Route path="/memory-games/curious-minds" element={<h1>Curious Minds game</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("attention-boosters-flow-shell")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("attention-boosters-flow-shell")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.train_reflexes");
    expect(screen.getByTestId("attention-boosters-flow-shell").querySelector('[data-vyva-icon-tile="pulse"]')).toBeInTheDocument();
    const curiousMindsButton = screen.getByRole("button", { name: /Curious Minds/i });
    expect(curiousMindsButton.querySelector('[data-vyva-accent="spark"]')).toBeInTheDocument();

    fireEvent.click(curiousMindsButton);

    expect(screen.getByRole("heading", { name: "Curious Minds game" })).toBeInTheDocument();
  });
});
