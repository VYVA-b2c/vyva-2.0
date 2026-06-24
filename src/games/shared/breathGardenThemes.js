export const GARDEN_THEMES = [
  {
    id: "garden",
    labelKey: "games.breathGarden.themeGarden",
    accent: "#0F766E",
    soft: "#DDF7F1",
  },
  {
    id: "tide",
    labelKey: "games.breathGarden.themeTide",
    accent: "#2563EB",
    soft: "#DBEAFE",
  },
  {
    id: "stars",
    labelKey: "games.breathGarden.themeStars",
    accent: "#6B21A8",
    soft: "#F3E8FF",
  },
  {
    id: "ripples",
    labelKey: "games.breathGarden.themeRipples",
    accent: "#0F766E",
    soft: "#CCFBF1",
  },
];

export function isBreathGardenTheme(value) {
  return GARDEN_THEMES.some((theme) => theme.id === value);
}

export function getBreathGardenTheme(value) {
  return GARDEN_THEMES.find((theme) => theme.id === value) ?? GARDEN_THEMES[0];
}
