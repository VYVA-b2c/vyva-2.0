import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProviderOffers } from "./offers.js";
import { clearProviderSourceAdapterCache } from "../services/providerSourceAdapters.js";

const context = {
  city: "Madrid",
  region: "Madrid",
  countryCode: "ES",
  mobilityPreference: "either" as const,
  priceSensitivity: "medium" as const,
  interests: [],
};

function googleFetch(params: {
  name: string;
  website?: string;
  rating?: number;
  priceLevel?: number;
}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("place/textsearch")) {
      return new Response(JSON.stringify({
        results: [{
          place_id: "place-1",
          name: params.name,
          formatted_address: "Calle Mayor 1, Madrid",
          rating: params.rating ?? 4.5,
          user_ratings_total: 90,
          price_level: params.priceLevel ?? 2,
          opening_hours: { open_now: true },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("place/details")) {
      return new Response(JSON.stringify({
        result: {
          name: params.name,
          formatted_address: "Calle Mayor 1, Madrid",
          formatted_phone_number: "+34 600 123 123",
          website: params.website,
          url: "https://maps.google.com/?cid=1",
          rating: params.rating ?? 4.5,
          user_ratings_total: 90,
          price_level: params.priceLevel ?? 2,
          opening_hours: { open_now: true },
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe("provider search source integration", () => {
  beforeEach(() => {
    clearProviderSourceAdapterCache();
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  it("refreshes transport evidence while keeping Google facts reported", async () => {
    vi.stubGlobal("fetch", googleFetch({ name: "City Taxi", website: "https://citytaxi.example", rating: 4.7 }));
    const fetchPage = vi.fn(async (url: string) => ({
      url,
      html: "<html><body><h1>City Taxi</h1><p>Price EUR 20. Available today. Wheelchair accessible vehicles. Service area Madrid.</p></body></html>",
    }));

    const offers = await buildProviderOffers(
      "accessible taxi nearby",
      "Transporte",
      context,
      "en",
      undefined,
      undefined,
      "transport",
      { fetchPage },
    );

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      name: "City Taxi",
      source_status: "verified",
      source_priority: ["provider_owned", "directory"],
    });
    expect(offers[0].comparison.accessibility).toMatchObject({
      status: "verified",
      sourceType: "provider_owned",
    });
    expect(offers[0].comparison.reputation).toMatchObject({
      status: "reported",
      sourceType: "directory",
    });
    expect(offers[0].comparison.price.conflict).toBe(false);
  });

  it("reuses saved official and regulated links during a care-provider re-check", async () => {
    vi.stubGlobal("fetch", googleFetch({ name: "Clinica Sol", rating: 4.6 }));
    const fetchPage = vi.fn(async (url: string) => {
      if (url.includes("registry.gov")) {
        return { url, html: "<html><body>Clinica Sol authorised medical provider.</body></html>" };
      }
      return { url, html: "<html><body><h1>Clinica Sol</h1><p>Accepts Sanitas insurance.</p></body></html>" };
    });

    const offers = await buildProviderOffers(
      "Clinica Sol doctor",
      "Vivienda y cuidados",
      context,
      "en",
      undefined,
      {
        preferred_sources: ["official", "provider_owned", "regulated", "directory"],
        criteria: ["coverage", "reputation"],
        providers: [{
          id: "clinic-sol",
          name: "Clinica Sol",
          official_website: "https://clinicasol.example",
          directory_url: "https://registry.gov/clinica-sol",
        }],
      },
      "specialist",
      { fetchPage },
    );

    expect(offers[0].comparison.coverage).toMatchObject({
      status: "verified",
      sourceType: "provider_owned",
      value: expect.stringMatching(/Sanitas/i),
    });
    expect(offers[0].comparison.reputation.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "regulated", status: "verified" }),
      expect.objectContaining({ sourceType: "directory", status: "reported" }),
    ]));
    expect(fetchPage).toHaveBeenCalledWith("https://clinicasol.example");
    expect(fetchPage).toHaveBeenCalledWith("https://registry.gov/clinica-sol");
  });

  it("uses the same evidence pipeline for home-service providers", async () => {
    vi.stubGlobal("fetch", googleFetch({ name: "Casa Clara", website: "https://casaclara.example", rating: 4.4 }));
    const fetchPage = vi.fn(async (url: string) => ({
      url,
      html: "<html><body><h1>Casa Clara</h1><p>Price EUR 25 per hour. Available tomorrow. Service area Madrid.</p></body></html>",
    }));

    const offers = await buildProviderOffers(
      "home cleaning nearby",
      "Servicios en casa",
      context,
      "en",
      undefined,
      undefined,
      "home-service",
      { fetchPage },
    );

    expect(offers[0].comparison.price).toMatchObject({ status: "verified", sourceType: "provider_owned" });
    expect(offers[0].comparison.coverage).toMatchObject({
      status: "verified",
      value: expect.stringMatching(/Service area Madrid/i),
    });
  });
});
