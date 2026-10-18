import { describe, expect, it } from "vitest";
import { careFinderProfileFromSummary } from "./api";

describe("careFinderProfileFromSummary", () => {
  it("carries the profile country, or null when it is blank", () => {
    expect(careFinderProfileFromSummary({ postalCode: "69003", cityState: "Lyon", country: "FR" })).toMatchObject({ location: "69003 Lyon", country: "FR" });
    expect(careFinderProfileFromSummary({ cityState: "Zamora", country: " " })?.country).toBeNull();
    expect(careFinderProfileFromSummary({ cityState: "Zamora" })?.country).toBeNull();
  });
});
