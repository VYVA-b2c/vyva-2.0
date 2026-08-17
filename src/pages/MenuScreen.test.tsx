import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";
import MenuScreen, { MENU_TILES } from "./MenuScreen";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderMenu(props?: ComponentProps<typeof MenuScreen>) {
  return render(
    <MemoryRouter initialEntries={["/menu"]}>
      <Routes>
        <Route path="/menu" element={<><MenuScreen {...props} /><LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MenuScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders exactly the four approved Menu tiles", () => {
    renderMenu();

    const grid = screen.getByTestId("menu-tile-grid");
    const tiles = within(grid).getAllByRole("button");

    expect(tiles).toHaveLength(4);
    expect(grid).toHaveTextContent("My Health");
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

  it("can override tile paths for the isolated Home/Nav design preview", () => {
    renderMenu({
      tilePathOverrides: {
        health: "/dev/home-master/health",
        brain: "/dev/home-master/brain",
        community: "/dev/home-master/community",
        concierge: "/dev/home-master/concierge",
      },
    });

    fireEvent.click(screen.getByTestId("menu-tile-health"));
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/dev/home-master/health");
  });

  it("returns to Home from the voice button", () => {
    renderMenu();

    fireEvent.click(screen.getByTestId("button-menu-voice-home"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
  });

  it("opens profile and settings in-place from manual mode before protected routes", () => {
    renderMenu();

    fireEvent.click(screen.getByTestId("button-menu-profile"));

    const profileMenu = screen.getByTestId("menu-profile-menu");
    expect(profileMenu).toBeInTheDocument();
    expect(profileMenu).toHaveTextContent("Profile & settings");
    expect(profileMenu).toHaveClass("max-h-[calc(100svh-104px)]");
    expect(profileMenu).toHaveClass("box-border");
    expect(profileMenu).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/menu");

    fireEvent.click(screen.getByTestId("button-menu-profile-account"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/settings/account");
  });

  it("can return to the public Home preview when rendered by the dev preview route", () => {
    renderMenu({ backPath: "/dev/home-master" });

    fireEvent.click(screen.getByTestId("button-menu-voice-home"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/dev/home-master");
  });

  it("uses the right-side purple voice control instead of a back control", () => {
    renderMenu();

    const voiceHomeButton = screen.getByTestId("button-menu-voice-home");

    expect(screen.queryByTestId("button-menu-back")).not.toBeInTheDocument();
    expect(voiceHomeButton).not.toHaveClass("justify-self-end");
    expect(voiceHomeButton).toHaveClass("h-9");
    expect(voiceHomeButton).toHaveClass("w-9");
    expect(voiceHomeButton).toHaveClass("!min-h-9");
    expect(voiceHomeButton).toHaveClass("bg-vyva-purple");
    expect(voiceHomeButton).toHaveClass("text-white");
  });

  it("uses a cohesive dark Menu surface when the Home master theme is dark", () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");

    renderMenu();

    expect(screen.getByTestId("menu-screen")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByTestId("menu-screen")).toHaveClass("bg-[linear-gradient(180deg,#1E1139_0%,#11081F_46%,#070311_100%)]");
    expect(screen.getByTestId("menu-tile-health")).toHaveClass("bg-[#211235]");
    expect(screen.getByTestId("button-menu-profile")).toBeInTheDocument();
  });

  it("uses compact mobile tile sizing so all four tiles fit above the dock", () => {
    renderMenu();

    const grid = screen.getByTestId("menu-tile-grid");
    const firstTile = screen.getByTestId("menu-tile-health");

    expect(grid).toHaveClass("gap-3");
    expect(firstTile).toHaveClass("min-h-[82px]");
    expect(firstTile).not.toHaveClass("min-h-[118px]");
  });

  it("matches the Home master responsive shell width without becoming fixed-width", () => {
    renderMenu();

    const shell = screen.getByTestId("menu-shell");
    const topbar = screen.getByTestId("menu-topbar");

    expect(shell).toHaveClass("w-full");
    expect(shell).toHaveClass("max-w-[calc(100vw-32px)]");
    expect(shell).toHaveClass("min-[390px]:max-w-[366px]");
    expect(shell).toHaveClass("sm:max-w-[620px]");
    expect(shell).toHaveClass("lg:max-w-[760px]");
    expect(shell).not.toHaveClass("sm:max-w-[390px]");
    expect(topbar).toHaveClass("px-1");
    expect(topbar).toHaveClass("sm:px-3");
    expect(screen.getByRole("heading", { name: "Menu" })).toHaveClass("sr-only");
  });
});
