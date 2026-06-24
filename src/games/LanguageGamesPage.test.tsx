import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "@/i18n";
import LanguageGamesPage from "./LanguageGamesPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderLanguageGames() {
  return render(
    <MemoryRouter initialEntries={["/language"]}>
      <Routes>
        <Route path="/language" element={<LanguageGamesPage />} />
        <Route path="/memory-games/curious-minds" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LanguageGamesPage", () => {
  beforeEach(() => {
    setLanguage("en");
  });

  it("offers Curious Minds instead of the short story memory exercise", async () => {
    renderLanguageGames();

    expect(screen.getByRole("button", { name: "Open Curious Minds" })).toBeInTheDocument();
    expect(screen.queryByText("Short stories")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Curious Minds" }));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/memory-games/curious-minds"));
  });
});
