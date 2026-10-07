import { describe, expect, it } from "vitest";
import { isPremiumRateNumber, listingRiskSignals } from "./providerListingRisk.js";

describe("provider listing risk", () => {
  it.each([
    ["+34 902 123 456", null, true],
    ["+34 807 123 456", null, true],
    ["+34 900 123 456", null, false],
    ["+34 956 123 456", null, false],
    ["+34 611 223 344", null, false],
    ["+49 180 5 123456", null, true],
    ["0900 1234567", "DE", true],
    ["+49 30 1234567", null, false],
    ["+49 800 1234567", null, false],
    ["0870 123 4567", "GB", true],
    ["+44 20 7946 0000", null, false],
    ["+33 8 92 12 34 56", null, true],
    ["+39 899 123456", null, true],
    ["+31 900 1234567", null, true],
    ["+48 701 234 567", null, true],
    ["+1 900 555 0100", null, true],
    ["+61 1900 123 456", null, true],
    ["+351 707 123 456", null, true],
    ["+1 212 555 0100", null, false],
    ["+34 900 123 456", "ES", false],
    ["not a number", "ES", false],
  ])("classifies %s", (phone, country, premium) => {
    expect(isPremiumRateNumber(phone, country)).toBe(premium);
  });

  it("flags one number behind differently named listings, not repeat listings of one firm", () => {
    const signals = listingRiskSignals([
      { id: "a", name: "Cerrajero Tarifa 24h", phone: "+34 611 223 344" },
      { id: "b", name: "Cerrajería Urgente Algeciras", phone: "611 22 33 44" },
      { id: "c", name: "Llaves Ruiz", phone: "+34 956 000 111" },
      { id: "d", name: "Llaves Ruiz", phone: "+34 956 000 111" },
      { id: "e", name: "Service Area Only", phone: "+34 956 000 222", hasBusinessAddress: false },
    ]);
    expect(signals.get("a")).toEqual(["shared_phone"]);
    expect(signals.get("b")).toEqual(["shared_phone"]);
    expect(signals.has("c")).toBe(false);
    expect(signals.get("e")).toEqual(["no_business_address"]);
  });
});
