import { describe, expect, it, vi } from "vitest";
import { searchCareProviders } from "./careFinderSearch.js";

type Handler = (url: URL) => unknown;

function mockFetch(handler: Handler) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const body = handler(url);
    return new Response(JSON.stringify(body ?? {}), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

const request = {
  careType: "physiotherapy" as const,
  access: "private" as const,
  coverage: "public" as const,
  location: "11380 Tarifa",
  accessNeeds: ["step_free" as const],
  language: "en",
};

describe("searchCareProviders", () => {
  it("reports unavailable instead of inventing options when Places is not configured", async () => {
    const result = await searchCareProviders(request, { apiKey: null });
    expect(result.status).toBe("unavailable");
    expect(result.options).toEqual([]);
    expect(result.mapsSearchUrl).toContain("fisioterapia");
  });

  it("returns no_results honestly", async () => {
    const fetcher = mockFetch(() => ({ status: "ZERO_RESULTS", results: [] }));
    const result = await searchCareProviders(request, { apiKey: "key", fetch: fetcher, refreshEvidence: async () => null });
    expect(result).toMatchObject({ status: "no_results", options: [] });
  });

  it("drops non-health places, orders by travel time, and labels Google facts as reported", async () => {
    const queries: string[] = [];
    const fetcher = mockFetch((url) => {
      if (url.pathname.endsWith("/textsearch/json")) {
        queries.push(url.searchParams.get("query") ?? "");
        return {
          status: "OK",
          results: [
            { place_id: "far", name: "Fisio Lejos", formatted_address: "Algeciras", types: ["physiotherapist", "health"] },
            { place_id: "gym", name: "Gimnasio Fit", formatted_address: "Tarifa", types: ["gym"] },
            { place_id: "home", name: "Residencia Las Flores", formatted_address: "Tarifa", types: ["lodging"] },
            { place_id: "near", name: "Fisio Cerca", formatted_address: "Tarifa", rating: 4.8, user_ratings_total: 40, types: ["physiotherapist"] },
          ],
        };
      }
      if (url.pathname.endsWith("/distancematrix/json")) {
        return {
          status: "OK",
          rows: [{ elements: [
            { status: "OK", distance: { text: "21 km" }, duration: { text: "25 min", value: 1500 } },
            { status: "OK", distance: { text: "1.2 km" }, duration: { text: "4 min", value: 240 } },
          ] }],
        };
      }
      if (url.pathname.endsWith("/details/json")) {
        const near = url.searchParams.get("place_id") === "near";
        return {
          status: "OK",
          result: {
            international_phone_number: near ? "+34 956 000 000" : "+34 956 111 111",
            wheelchair_accessible_entrance: near ? true : undefined,
            opening_hours: { weekday_text: ["Monday: 9:00 AM – 2:00 PM", "Tuesday: 9:00 AM – 2:00 PM", "", "", "", "", ""] },
          },
        };
      }
      return {};
    });

    const result = await searchCareProviders(request, {
      apiKey: "key",
      fetch: fetcher,
      now: () => new Date("2026-10-05T10:00:00Z"), // a Monday
      refreshEvidence: async () => null,
    });

    expect(queries[0]).toBe("fisioterapia 11380 Tarifa");
    expect(queries.join(" ")).not.toMatch(/residencia|centro de dia/i);
    expect(result.status).toBe("ok");
    expect(result.orderedBy).toBe("travel_time");
    expect(result.options.map((option) => option.name)).toEqual(["Fisio Cerca", "Fisio Lejos"]);

    const first = result.options[0];
    expect(first.travel_minutes).toBe(4);
    expect(first.comparison?.distance).toMatchObject({ status: "reported", value: "1.2 km · 4 min by car" });
    expect(first.comparison?.accessibility).toMatchObject({ status: "reported", value: "Step-free entrance listed" });
    expect(first.comparison?.availability?.value).toContain("Monday");
    expect(first.comparison?.coverage?.status).toBe("unknown");
    expect(first.comparison?.price?.status).toBe("unknown");
    expect(first.matched).toEqual(expect.arrayContaining(["Google lists a step-free entrance", "The closest of the options found"]));
    expect(JSON.stringify(result)).not.toMatch(/recommended|verified google|best/i);
  });

  it("states the public health centre assumption explicitly", async () => {
    const fetcher = mockFetch((url) => {
      if (url.pathname.endsWith("/textsearch/json")) {
        return { status: "OK", results: [{ place_id: "cs", name: "Centro de Salud Tarifa", types: ["doctor", "health"] }] };
      }
      return { status: "OK", result: {} };
    });
    const result = await searchCareProviders(
      { ...request, careType: "primary_care", access: "public", accessNeeds: [] },
      { apiKey: "key", fetch: fetcher, refreshEvidence: async () => null },
    );
    expect(result.options[0].assumptions[0]).toMatch(/health card/);
    expect(result.orderedBy).toBe("search_relevance");
  });
});
