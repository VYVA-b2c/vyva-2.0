import { describe, expect, it } from "vitest";
import { distanceKm, organisationVisibleTo, parseVettedProviderCsv, partnerCoversLocation, vettedProviderInputSchema } from "./vettedPartners.js";

describe("vetted partner coverage", () => {
  const tarifa = { lat: 36.0143, lng: -5.6044 };
  const algeciras = { lat: 36.1408, lng: -5.4562 };
  const madrid = { lat: 40.4168, lng: -3.7038 };

  it("measures distance", () => {
    expect(distanceKm(tarifa, algeciras)).toBeGreaterThan(15);
    expect(distanceKm(tarifa, algeciras)).toBeLessThan(25);
  });

  it("matches a radius only with known coordinates inside it", () => {
    const radius = { coverageCountry: "ES", coverageLat: tarifa.lat, coverageLng: tarifa.lng, coverageRadiusKm: 30 };
    expect(partnerCoversLocation(radius, { countryCode: "ES", ...algeciras })).toBe(true);
    expect(partnerCoversLocation(radius, { countryCode: "ES", ...madrid })).toBe(false);
    expect(partnerCoversLocation(radius, { countryCode: "ES" })).toBe(false);
    expect(partnerCoversLocation(radius, { countryCode: "GI", ...algeciras })).toBe(false);
  });

  it("matches a region as whole words in the member's address", () => {
    const zamora = { coverageCountry: "ES", coverageRegion: "Zamora" };
    expect(partnerCoversLocation(zamora, { countryCode: "ES", addressText: "Calle Mayor 3, 49001 Zamora, España" })).toBe(true);
    expect(partnerCoversLocation(zamora, { countryCode: "ES", addressText: "Calle Zamoranos 3, Madrid" })).toBe(false);
    expect(partnerCoversLocation({ coverageCountry: "DE", coverageRegion: "München" }, { countryCode: "DE", addressText: "Leopoldstr. 1, 80802 Munchen" })).toBe(true);
  });

  it("covers the whole country when nothing narrower is set", () => {
    expect(partnerCoversLocation({ coverageCountry: "PT" }, { countryCode: "pt" })).toBe(true);
  });

  it("limits organisation visibility to listed deployments", () => {
    expect(organisationVisibleTo([], "standard")).toBe(true);
    expect(organisationVisibleTo(["drk"], "drk")).toBe(true);
    expect(organisationVisibleTo(["drk"], "standard")).toBe(false);
    expect(organisationVisibleTo(["drk"], null)).toBe(false);
  });
});

describe("vetted provider input", () => {
  const base = { name: "Fontanería Ruiz", trades: ["plumber"], phone: "+34 956 000 111", coverageCountry: "es" };
  it("accepts a minimal provider and normalises the country", () => {
    expect(vettedProviderInputSchema.parse(base).coverageCountry).toBe("ES");
  });
  it("needs a contact route and complete radius coverage", () => {
    expect(vettedProviderInputSchema.safeParse({ ...base, phone: "" }).success).toBe(false);
    expect(vettedProviderInputSchema.safeParse({ ...base, coverageLat: 36, coverageLng: -5 }).success).toBe(false);
    expect(vettedProviderInputSchema.safeParse({ ...base, coverageLat: 36, coverageLng: -5, coverageRadiusKm: 20 }).success).toBe(true);
  });
  it("rejects unknown trades", () => {
    expect(vettedProviderInputSchema.safeParse({ ...base, trades: ["gardener"] }).success).toBe(false);
  });
});

describe("CSV import", () => {
  it("parses comma or semicolon files with quotes and reports row errors", () => {
    const csv = [
      "name;trades;phone;email;website;address;languages;country;region;lat;lng;radius_km;notes",
      "\"Ruiz; Hijos\";plumber|handyman;+34 956 000 111;;;;es|en;ES;;36,0143;-5,6044;25;Habla inglés",
      "Sin contacto;plumber;;;;;;ES;Zamora;;;;",
    ].join("\n");
    const rows = parseVettedProviderCsv(csv);
    expect(rows[0].input).toMatchObject({ name: "Ruiz; Hijos", trades: ["plumber", "handyman"], languages: ["es", "en"], coverageLat: 36.0143, coverageRadiusKm: 25 });
    expect(rows[1].row).toBe(3);
    expect(rows[1].errors?.join(" ")).toContain("phone");
  });
});
