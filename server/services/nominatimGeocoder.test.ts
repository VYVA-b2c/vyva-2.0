import { describe, expect, it, vi } from "vitest";
import { geocodeGermanLocation } from "./nominatimGeocoder.js";

const PRENZLAU = [{ lat: "53.3167", lon: "13.8601", addresstype: "town", address: { postcode: "17291", "ISO3166-2-lvl4": "DE-BB" } }];

describe("Nominatim geocoder", () => {
  it("places a German town, limited to Germany, identifying VYVA", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(PRENZLAU))) as unknown as typeof fetch;
    expect(await geocodeGermanLocation("Prenzlau", { fetch: fetcher })).toEqual({
      lat: 53.3167, lng: 13.8601, postcode: "17291", regionCode: "DE-BB", provinceCode: null, municipalityCode: null, precision: "town",
    });
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(new URL(String(url)).searchParams.get("countrycodes")).toBe("de");
    expect((init as RequestInit).headers).toMatchObject({ "user-agent": "VYVA-CareFinder/1.0" });
  });

  it("gives no point when nothing is found or the call fails", async () => {
    expect(await geocodeGermanLocation("Nirgendwo", { fetch: (async () => new Response("[]")) as unknown as typeof fetch })).toBeNull();
    expect(await geocodeGermanLocation("Berlin", { fetch: (async () => new Response("", { status: 429 })) as unknown as typeof fetch })).toBeNull();
  });
});
