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
    expect(grid).toHaveTextContent("Check-ins & medicines");
    expect(grid).toHaveTextContent("Memory, focus & calm");
    expect(grid).toHaveTextContent("Rooms & support");
    expect(grid).toHaveTextContent("Everyday help");
    expect(MENU_TILES.map((tile) => tile.path)).toEqual([
      "/health",
      "/mind-memory",
      "/social-rooms",
      "/concierge",
    ]);
    expect(screen.getByTestId("menu-tile-health").querySelector('[data-vyva-accent="pulse"]')).toBeInTheDocument();
    expect(screen.getByTestId("menu-tile-brain").querySelector('[data-vyva-accent="bridge"]')).toBeInTheDocument();
    expect(screen.getByTestId("menu-tile-community").querySelector('[data-vyva-accent="link"]')).toBeInTheDocument();
    expect(screen.getByTestId("menu-tile-concierge").querySelector('[data-vyva-accent="clapper"]')).toBeInTheDocument();
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
    expect(profileMenu).toHaveClass("md:max-w-[720px]");
    expect(profileMenu).toHaveClass("md:top-1/2");
    expect(profileMenu).toHaveClass("md:-translate-y-1/2");
    expect(screen.getByTestId("menu-profile-menu-links")).toHaveClass("md:grid-cols-2");
    expect(screen.getByTestId("button-menu-profile-menu-backdrop")).toHaveClass("md:backdrop-blur-[3px]");
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/menu");
    expect(screen.getByTestId("button-menu-profile-account").querySelector('[data-vyva-accent="id"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-health").querySelector('[data-vyva-accent="pulse"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-medications").querySelector('[data-vyva-accent="divider"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-emergency").querySelector('[data-vyva-accent="check"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-care-team").querySelector('[data-vyva-accent="link"]')).toBeInTheDocument();
    expect(screen.getByTestId("button-menu-profile-providers").querySelector('[data-vyva-accent="scope"]')).toBeInTheDocument();

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
    expect(voiceHomeButton).toHaveClass("bg-[#6D28D9]");
    expect(voiceHomeButton).toHaveClass("text-white");
  });

  it("uses a cohesive dark Menu surface when the Home master theme is dark", () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");

    renderMenu();

    expect(screen.getByTestId("menu-screen")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByTestId("menu-screen")).toHaveClass("bg-[radial-gradient(circle_at_50%_0%,#21132A_0%,#140C18_54%,#100814_100%)]");
    expect(screen.getByTestId("menu-tile-health")).toHaveClass("bg-[#2A2034]");
    expect(screen.getByTestId("button-menu-profile")).toBeInTheDocument();
  });

  it("uses compact mobile tile sizing so all four tiles fit above the dock", () => {
    renderMenu();

    const grid = screen.getByTestId("menu-tile-grid");
    const firstTile = screen.getByTestId("menu-tile-health");

    expect(grid).toHaveClass("gap-3");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("lg:grid-cols-4");
    expect(firstTile).toHaveClass("min-h-[82px]");
    expect(firstTile).toHaveClass("md:min-h-[128px]");
    expect(firstTile).toHaveClass("lg:min-h-[184px]");
    expect(firstTile).toHaveClass("lg:flex-col");
    expect(firstTile).toHaveClass("lg:justify-start");
    expect(screen.getByTestId("menu-tile-health-detail")).toHaveClass("lg:whitespace-nowrap");
    expect(screen.getByTestId("menu-tile-health-detail")).toHaveClass("lg:text-[13px]");
    expect(firstTile).not.toHaveClass("min-h-[118px]");
  });

  it("matches the Home master responsive shell width without becoming fixed-width", () => {
    renderMenu();

    const shell = screen.getByTestId("menu-shell");
    const topbar = screen.getByTestId("menu-topbar");

    expect(shell).toHaveClass("w-full");
    expect(shell).toHaveClass("max-w-[calc(100vw-32px)]");
    expect(shell).toHaveClass("min-[390px]:max-w-[366px]");
    expect(shell).toHaveClass("sm:max-w-[390px]");
    expect(shell).toHaveClass("md:max-w-[680px]");
    expect(shell).toHaveClass("lg:max-w-[880px]");
    expect(topbar).toHaveClass("px-1");
    expect(topbar).toHaveClass("sm:px-3");
    expect(screen.getByRole("heading", { name: "Menu" })).toHaveClass("sr-only");
    expect(screen.getByRole("heading", { name: "Menu" })).toHaveClass("md:not-sr-only");
    expect(screen.getByTestId("menu-grid-stage")).toHaveClass("md:items-center");
    expect(screen.getByTestId("menu-screen")).not.toHaveClass("pb-[calc(120px+env(safe-area-inset-bottom))]");
  });
});
