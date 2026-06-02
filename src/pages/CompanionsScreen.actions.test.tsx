import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveGroupPanel, GroupsStrip, HeroBanner } from "./CompanionsScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
  };
});

vi.mock("@/hooks/useHeroMessage", () => ({
  useHeroMessage: () => ({
    ctaLabel: "Explore",
    headline: "Find your circle",
    sourceText: "My community",
  }),
}));

describe("Companions service actions", () => {
  it("turns the community hero CTA into an explore action", () => {
    const onExplore = vi.fn();

    render(<HeroBanner onExplore={onExplore} />);

    fireEvent.click(screen.getByTestId("button-explorar-community"));

    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it("turns group discovery controls into profile-management actions", () => {
    const onManageGroups = vi.fn();

    render(<GroupsStrip onManageGroups={onManageGroups} />);

    fireEvent.click(screen.getByTestId("button-groups-see-all"));
    fireEvent.click(screen.getByTestId("button-group-add"));

    expect(onManageGroups).toHaveBeenCalledTimes(2);
  });

  it("turns join call into an immediate call-start action", () => {
    const onJoinCall = vi.fn();

    render(<ActiveGroupPanel onJoinCall={onJoinCall} />);

    fireEvent.click(screen.getByTestId("button-join-call"));

    expect(onJoinCall).toHaveBeenCalledTimes(1);
  });
});
