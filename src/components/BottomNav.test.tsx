import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import BottomNav from "./BottomNav";

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@/hooks/useHomeMasterTheme", () => ({
  useHomeMasterTheme: () => ({ isDark: false }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderBottomNav(initialPath = "/") {
  const onSosClick = vi.fn();
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<><BottomNav onSosClick={onSosClick} /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onSosClick };
}

describe("BottomNav", () => {
  it("renders exactly Home, SOS and My Reports", () => {
    renderBottomNav();

    expect(screen.getByTestId("nav-tab-home")).toHaveTextContent("Home");
    expect(screen.getByTestId("nav-tab-sos")).toHaveTextContent("SOS");
    expect(screen.getByTestId("nav-tab-reports")).toHaveTextContent("My Reports");
  });

  it("keeps the Home dock item inert on the Home screen", () => {
    renderBottomNav("/");

    const homeTab = screen.getByTestId("nav-tab-home");
    expect(homeTab).toBeDisabled();
    expect(homeTab).toHaveAttribute("aria-disabled", "true");
    expect(homeTab).not.toHaveAttribute("aria-current");
    expect(homeTab).toHaveClass("cursor-default");
    expect(homeTab).not.toHaveClass("opacity-60");

    fireEvent.click(homeTab);

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
  });

  it("reuses the supplied SOS handler", () => {
    const { onSosClick } = renderBottomNav();

    fireEvent.click(screen.getByTestId("nav-tab-sos"));

    expect(onSosClick).toHaveBeenCalledTimes(1);
  });

  it("routes Reports to the existing informes screen", () => {
    renderBottomNav();

    fireEvent.click(screen.getByTestId("nav-tab-reports"));

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/informes");
  });

  it("uses the floating home dock surface on Menu without making Home inert", () => {
    renderBottomNav("/menu");

    const dock = screen.getByRole("navigation");
    const homeTab = screen.getByTestId("nav-tab-home");

    expect(dock).toHaveClass("bottom-[18px]");
    expect(dock).toHaveClass("rounded-[22px]");
    expect(dock).toHaveClass("md:max-w-[560px]", "lg:max-w-[620px]");
    expect(homeTab).not.toBeDisabled();

    fireEvent.click(homeTab);

    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
  });
});
