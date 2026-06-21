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
      <MemoryRouter initialEntries={["/attention-boosters"]}>
        <Routes>
          <Route path="/attention-boosters" element={<AttentionBoostersPage />} />
          <Route path="/memory-games/curious-minds" element={<h1>Curious Minds game</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Curious Minds/i }));

    expect(screen.getByRole("heading", { name: "Curious Minds game" })).toBeInTheDocument();
  });
});
