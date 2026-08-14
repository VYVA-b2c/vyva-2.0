import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import MenuScreen, { MENU_TILES } from "./MenuScreen";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/menu"]}>
      <Routes>
        <Route path="/menu" element={<><MenuScreen /><LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MenuScreen", () => {
  it("renders exactly the four approved Menu tiles", () => {
    renderMenu();

    const grid = screen.getByTestId("menu-tile-grid");
    const tiles = within(grid).getAllByRole("button");

    expect(tiles).toHaveLength(4);
    expect(grid).toHaveTextContent("Health");
    expect(grid).toHaveTextContent("My Brain");
    expect(grid).toHaveTextContent("Community");
    expect(grid).toHaveTextContent("Concierge");
    expect(MENU_TILES.map((tile) => tile.path)).toEqual([
      "/health",
      "/mind-memory",
      "/social-rooms",
      "/concierge",
    ]);
  });

  it("routes each Menu tile to the existing app destination", () => {
    renderMenu();

    fireEvent.click(screen.getByTestId("menu-tile-brain"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/mind-memory");
  });

  it("returns to Home from the back button", () => {
    renderMenu();

    fireEvent.click(screen.getByTestId("button-menu-back"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
  });

  it("uses compact mobile tile sizing so all four tiles fit above the dock", () => {
    renderMenu();

    const grid = screen.getByTestId("menu-tile-grid");
    const firstTile = screen.getByTestId("menu-tile-health");

    expect(grid).toHaveClass("gap-3");
    expect(firstTile).toHaveClass("min-h-[88px]");
    expect(firstTile).not.toHaveClass("min-h-[118px]");
  });
});
