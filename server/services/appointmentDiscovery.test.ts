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

  it("maps Google Places results into confirmable provider options", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/place/textsearch/")) {
        return jsonResponse({
          status: "OK",
          results: [{
            name: "Clinica Costa",
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
        return jsonResponse({
          status: "OK",
          result: {
            international_phone_number: "+34 600 111 222",
            website: "https://clinic.example/book",
            url: "https://maps.google.com/?cid=123",
            opening_hours: { open_now: true },
          },
        });
      }
      return jsonResponse({ status: "ZERO_RESULTS", results: [] });
    });

    const result = await discoverAppointmentProviderOptions({
      appointmentType: "medical",
      detail: "dermatology appointment",
      location: { city: "Marbella", region: "Malaga", countryCode: "ES" },
      language: "en",
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.fallback_reason).toBeUndefined();
    expect(result.options).toHaveLength(1);
    expect(result.options[0].available_channels).toEqual(["booking_url", "phone", "manual"]);
    expect(result.options[0].provider_snapshot).toMatchObject({
      source: "google_places",
      place_id: "place-123",
      name: "Clinica Costa",
      phone: "+34 600 111 222",
      booking_url: "https://clinic.example/book",
      maps_url: "https://maps.google.com/?cid=123",
      rating: 4.7,
      review_count: 118,
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
});
