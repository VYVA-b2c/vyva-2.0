import { describe, expect, it } from "vitest";
import { homeServiceCountryEnabled } from "./homeServiceCountries.js";

describe("home-service country selection", () => {
  it("is worldwide by default", () => {
    expect(homeServiceCountryEnabled("JP", undefined)).toBe(true);
    expect(homeServiceCountryEnabled("JP", "")).toBe(true);
    expect(homeServiceCountryEnabled("JP", "*")).toBe(true);
  });
  it("limits search to listed countries when set", () => {
    expect(homeServiceCountryEnabled("es", "ES, de")).toBe(true);
    expect(homeServiceCountryEnabled("DE", "ES, de")).toBe(true);
    expect(homeServiceCountryEnabled("FR", "ES,DE")).toBe(false);
    expect(homeServiceCountryEnabled(null, "ES,DE")).toBe(false);
  });
});
