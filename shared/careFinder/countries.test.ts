import { describe, expect, it } from "vitest";
import { careFinderCountry, hasOfficialRegister, mapsRegionCode } from "./countries";

describe("care finder countries", () => {
  it("normalises profile country codes", () => {
    expect(careFinderCountry("es")).toBe("ES");
    expect(careFinderCountry(" FR ")).toBe("FR");
    expect(careFinderCountry("uk")).toBe("GB");
    expect(careFinderCountry("")).toBeNull();
    expect(careFinderCountry("Spain")).toBeNull();
    expect(careFinderCountry(null)).toBeNull();
  });

  it("searches an official register only where one is imported", () => {
    for (const country of ["ES", "FR"]) expect(hasOfficialRegister(country)).toBe(true);
    for (const country of ["DE", "GB", "IT"]) expect(hasOfficialRegister(country)).toBe(false);
  });

  it("biases the map search with the country's ccTLD", () => {
    expect(mapsRegionCode("ES")).toBe("es");
    expect(mapsRegionCode("GB")).toBe("uk");
  });
});
