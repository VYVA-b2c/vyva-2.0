import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appointmentOptionIdentity,
  buildAppointmentSearchQueries,
  discoverAppointmentProviderOptions,
  reservationSystemLinksFor,
} from "./appointmentDiscovery.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clearPlacesEnv() {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
  vi.stubEnv("PLACES_API_KEY", "");
  vi.stubEnv("VITE_GOOGLE_PLACES_API_KEY", "");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("appointment discovery", () => {
  it("rejects Denver and unknown coordinates for a confirmed Tarifa address", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) {
        expect(url.searchParams.get("address")).toBe("Tarifa, Spain");
        return jsonResponse({ status: "OK", results: [{ geometry: { location: { lat: 36.014, lng: -5.604 } } }] });
      }
      if (url.pathname.includes("textsearch")) return jsonResponse({ status: "OK", results: [
        { name: "Denver plumber", place_id: "denver", geometry: { location: { lat: 39.72, lng: -104.94 } } },
        { name: "Unknown plumber", place_id: "unknown" },
        { name: "Tarifa plumber", place_id: "tarifa", geometry: { location: { lat: 36.015, lng: -5.605 } } },
      ] });
      expect(url.searchParams.get("place_id")).toBe("tarifa");
      return jsonResponse({ status: "OK", result: {} });
    });
    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", serviceType: "plumber", detail: "fast help", location: { address: "Tarifa, Spain" } });
    expect(result.options.map(option => option.provider_snapshot.place_id)).toEqual(["tarifa"]);
  });

  it("does not search globally when address resolution fails", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ status: "REQUEST_DENIED" }));
    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", detail: "plumber", location: { address: "Tarifa, Spain" } });
    expect(result.options).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not call Google when no server-side Places key is configured", async () => {
    clearPlacesEnv();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await discoverAppointmentProviderOptions({
      appointmentType: "medical",
      detail: "dermatology",
      location: { city: "Marbella", countryCode: "ES" },
      language: "en",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.fallback_reason).toBe("google_places_not_configured");
    expect(result.options).toEqual([]);
    expect(result.reservation_systems.map((item) => item.name)).toContain("Doctoralia");
  });

  it.each(["medical", "home-service"])("maps %s results without inventing home-service booking channels", async (appointmentType) => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/geocode/")) return jsonResponse({ status: "OK", results: [{ geometry: { location: { lat: 36.51, lng: -4.88 } } }] });
      if (url.includes("/place/textsearch/")) {
        return jsonResponse({
          status: "OK",
          results: [{
            name: "Clinica Costa",
            geometry: { location: { lat: 36.51, lng: -4.88 } },
            formatted_address: "Avenida del Mar 10, Marbella",
            rating: 4.7,
            user_ratings_total: 118,
            place_id: "place-123",
            types: ["doctor", "health"],
            business_status: "OPERATIONAL",
          }],
        });
      }
      if (url.includes("/place/details/")) {
        expect(new URL(url).searchParams.get("fields")?.includes("price_level")).toBe(appointmentType === "home-service");
        return jsonResponse({
          status: "OK",
          result: {
            international_phone_number: "+34 600 111 222",
            website: "https://clinic.example/book",
            url: "https://maps.google.com/?cid=123",
            opening_hours: { open_now: true },
            price_level: 2,
          },
        });
      }
      return jsonResponse({ status: "ZERO_RESULTS", results: [] });
    });

    const result = await discoverAppointmentProviderOptions({
      appointmentType,
      detail: "dermatology appointment",
      location: { city: "Marbella", region: "Malaga", countryCode: "ES" },
      language: "en",
      constraints: ["lowest_cost", "fastest"],
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.fallback_reason).toBeUndefined();
    expect(result.options).toHaveLength(1);
    expect(result.options[0].available_channels).toEqual(appointmentType === "home-service" ? ["phone", "manual"] : ["booking_url", "phone", "manual"]);
    expect(result.options[0].provider_snapshot).toMatchObject({
      source: "google_places",
      place_id: "place-123",
      name: "Clinica Costa",
      phone: "+34 600 111 222",
      website_url: "https://clinic.example/book",
      booking_url: appointmentType === "home-service" ? null : "https://clinic.example/book",
      maps_url: "https://maps.google.com/?cid=123",
      rating: 4.7,
      review_count: 118,
      price_level: 2,
    });
    expect(appointmentOptionIdentity(result.options[0].provider_snapshot)).toBe("place:place-123");
  });

  it("builds practical reservation-system links by appointment type", () => {
    const links = reservationSystemLinksFor({
      appointmentType: "social",
      detail: "dinner",
      location: "Tarifa, Spain",
      language: "en",
    });
    const queries = buildAppointmentSearchQueries({
      appointmentType: "social",
      detail: "dinner with friends",
      location: "Tarifa, Spain",
      language: "en",
    });

    expect(links.map((link) => link.name)).toEqual(["TheFork", "OpenTable", "Google Maps"]);
    expect(queries[0]).toContain("dinner with friends");
    expect(queries[0]).toContain("Tarifa, Spain");
  });

  it("uses a generated home-service research brief in search queries", () => {
    const queries = buildAppointmentSearchQueries({
      appointmentType: "home-service",
      detail: "Plumber needed. What kind of plumbing issue?: Leak. Where is the problem?: Kitchen. Criteria: trusted",
      location: "Marbella, Spain",
      language: "en",
    });

    expect(queries[0]).toContain("Plumber needed");
    expect(queries[0]).toContain("Leak");
    expect(queries[0]).toContain("Marbella, Spain");
    expect(queries.some((query) => query.includes("home service repair maintenance"))).toBe(true);
  });

  it("puts the canonical home-service specialty ahead of free-form detail", () => {
    const queries = buildAppointmentSearchQueries({
      appointmentType: "home-service",
      serviceType: "electrician",
      detail: "The kitchen light is not working",
      constraints: ["trusted"],
      location: "Marbella, Spain",
      language: "en",
    });

    expect(queries[0]).toMatch(/^Electrician /i);
    expect(queries[0]).toContain("Marbella, Spain");
  });
});
