import { describe, expect, it } from "vitest";
import { HOME_SERVICE_SEARCH_TERMS, localHomeServiceTerms } from "./homeServiceSearch.js";
import { decideProviderCandidates } from "./providerDecision.js";
import { buildAppointmentSearchQueries } from "../server/services/appointmentDiscovery.js";

describe("multilingual home-service discovery", () => {
  for (const [language, terms] of Object.entries(HOME_SERVICE_SEARCH_TERMS)) {
    for (const [service, term] of Object.entries(terms)) {
      it(`matches ${language} ${service} without an English label`, () => {
        expect(term.length).toBeGreaterThan(0);
        const result = decideProviderCandidates([{
          id: "local", name: term, source: "saved", contactable: true, active: true, raw: {},
        }], { appointmentType: "home-service", serviceType: service });
        expect(result.ranked).toHaveLength(1);
      });
    }
  }

  it.each([ ["ES", "fontanero"], ["FR", "plombier"], ["DE", "Sanit\u00e4rinstallateur"], ["IT", "idraulico"], ["PT", "canalizador"], ["BR", "encanador"], ["GB", "plumber"] ])("uses local vocabulary in %s for every interface language", (countryCode, term) => {
    for (const language of Object.keys(HOME_SERVICE_SEARCH_TERMS)) {
      const queries = buildAppointmentSearchQueries({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location: "City", countryCode, language });
      expect(queries[0]).toBe(`${term} City`);
      expect(queries).toContain("plumber");
    }
  });

  it("includes supported local languages in multilingual countries", () => {
    expect(localHomeServiceTerms("plumber", "CH")).toEqual(["Sanit\u00e4rinstallateur", "plombier", "idraulico", "plumber"]);
    expect(localHomeServiceTerms("plumber", "CA")).toEqual(["plumber", "plombier"]);
  });

  it("falls back safely for unknown locales", () => {
    expect(localHomeServiceTerms("plumber", undefined, "fr-CA")).toEqual(["plombier", "plumber"]);
    expect(localHomeServiceTerms("plumber", "ZZ", "constructor")).toEqual(["plumber"]);
  });

  it("does not confuse trades or override an explicit medical category", () => {
    const options = [
      { id: "wrong-trade", name: "serrurier" },
      { id: "medical", name: "plombier", category: "doctor_clinic" },
    ].map(item => ({ ...item, source: "saved" as const, contactable: true, active: true, raw: {} }));
    expect(decideProviderCandidates(options, { appointmentType: "home-service", serviceType: "plumber" }).ranked).toHaveLength(0);
  });
});
