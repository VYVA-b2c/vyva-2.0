import { describe, expect, it } from "vitest";
import { countryNameFromCode, normalizeAddressCountry, addressCountryLabel, ADDRESS_COUNTRY_NAMES } from "./addressCountry";

describe("address country codes", () => {
  it.each(["en", "es", "fr", "de", "it", "pt"])("preserves country identity with %s display labels", language => {
    for (const [code, name] of Object.entries(ADDRESS_COUNTRY_NAMES)) {
      expect(normalizeAddressCountry(code)).toBe(name);
      expect(normalizeAddressCountry(addressCountryLabel(name, language))).toBe(name);
    }
  });
  it.each([["ES", "Spain"], ["fr", "France"], [" DE ", "Germany"], ["IT", "Italy"], ["PT", "Portugal"], ["GB", "United Kingdom"]])("preserves %s independently of interface language", (code, name) => {
    expect(countryNameFromCode(code)).toBe(name);
  });
  it("leaves names and unsupported codes to the name normalizer", () => {
    expect(countryNameFromCode("Spain")).toBeUndefined();
    expect(countryNameFromCode("ZZ")).toBeUndefined();
  });
});
