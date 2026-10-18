import { describe, expect, it, vi } from "vitest";
import { geocodeFrenchAddresses, geocodeFrenchLocation, parseBanCsv } from "./banGeocoder.js";

// Answers recorded from data.geopf.fr on 8 October 2026.
const CSV_ANSWER = `id,adresse,longitude,latitude,result_score,result_score_next,result_label,result_type,result_id,result_banId,result_housenumber,result_name,result_street,result_postcode,result_city,result_context,result_citycode,result_oldcitycode,result_oldcity,result_district,result_status
a,"22 Boulevard Flandrin, 75116 Paris 16e Arrondissement",2.272782,48.866218,0.9788990909090908,,22 Boulevard Flandrin 75116 Paris,housenumber,75116_3663_00022,ad9466a3-8180-4d4f-9a27-3fb1507c73d9,22,22 Boulevard Flandrin,Boulevard Flandrin,75116,Paris,"75, Paris, Île-de-France",75116,,,Paris 16e Arrondissement,ok
d,"1 rue qui nexiste pas, 99999 Nulle Part",,,,,,,,,,,,,,,,,,,not-found`;

const LYON = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [4.835, 45.758] }, properties: { label: "Lyon", score: 0.9639, type: "municipality", postcode: "69001", citycode: "69123", context: "69, Rhône, Auvergne-Rhône-Alpes", depcode: "69" } }] };

describe("BAN geocoder", () => {
  it("reads the CSV answer by column name, with no coordinates for addresses not found", () => {
    expect(parseBanCsv(CSV_ANSWER)).toEqual([
      { id: "a", lat: 48.866218, lng: 2.272782, score: 0.9788990909090908, type: "housenumber", citycode: "75116", oldcitycode: null },
      { id: "d", lat: null, lng: null, score: null, type: null, citycode: null, oldcitycode: null },
    ]);
  });

  it("posts the addresses as a CSV file", async () => {
    const fetcher = vi.fn(async () => new Response(CSV_ANSWER)) as unknown as typeof fetch;
    const results = await geocodeFrenchAddresses([{ id: "a", address: "22 Boulevard Flandrin, 75116 Paris" }], { fetch: fetcher });
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe("https://data.geopf.fr/geocodage/search/csv");
    const form = (init as RequestInit).body as FormData;
    expect(await (form.get("data") as Blob).text()).toBe('id,adresse\n"a","22 Boulevard Flandrin, 75116 Paris"');
    expect(form.get("columns")).toBe("adresse");
    expect(results[0].citycode).toBe("75116");
  });

  it("places a member's town with its commune and département codes", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(LYON))) as unknown as typeof fetch;
    expect(await geocodeFrenchLocation("Lyon", { fetch: fetcher })).toEqual({
      lat: 45.758, lng: 4.835, postcode: "69001", regionCode: null, provinceCode: "69", municipalityCode: "69123", precision: "municipality",
    });
  });

  it("gives no point for a weak match or a failed call", async () => {
    const weak = { ...LYON, features: [{ ...LYON.features[0], properties: { ...LYON.features[0].properties, score: 0.2 } }] };
    expect(await geocodeFrenchLocation("Lyonx", { fetch: (async () => new Response(JSON.stringify(weak))) as unknown as typeof fetch })).toBeNull();
    expect(await geocodeFrenchLocation("Lyon", { fetch: (async () => new Response("", { status: 503 })) as unknown as typeof fetch })).toBeNull();
  });
});
