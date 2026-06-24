import { render, screen, waitFor } from "@testing-library/react";
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
        <Route path="/learn" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LanguageGamesPage", () => {
  beforeEach(() => {
    setLanguage("en");
  });

  it("redirects old language links to the learning program", async () => {
    renderLanguageGames();

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/learn"));
  });
});
