import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appointmentOptionIdentity,
  buildAppointmentSearchQueries,
  discoverAppointmentProviderOptions,
  refreshAppointmentProviderContact,
  reservationSystemLinksFor,
  normalizeSearchAddress,
  providerSearchArea,
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
const spain = [{ short_name: "ES", types: ["country"] }];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("appointment discovery", () => {
  it("falls back to Places Text Search (New) when the legacy endpoint is unavailable", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) {
        return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.51, lng: -4.88 } } }] });
      }
      if (url.pathname.includes("/place/textsearch/")) return jsonResponse({ status: "REQUEST_DENIED" });
      if (url.hostname === "places.googleapis.com") {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("test-key");
        return jsonResponse({ places: [{
          id: "new-place-id",
          displayName: { text: "Marbella Plomberie" },
          formattedAddress: "Calle Example, Marbella, Spain",
          location: { latitude: 36.51, longitude: -4.88 },
          addressComponents: [{ shortText: "ES", types: ["country"] }],
          internationalPhoneNumber: "+34 956 123 456",
          googleMapsUri: "https://maps.google.com/?cid=new-place-id",
          rating: 4.7,
          userRatingCount: 31,
          businessStatus: "OPERATIONAL",
        }] });
      }
      return jsonResponse({ status: "NOT_FOUND" }, 404);
    });

    const result = await discoverAppointmentProviderOptions({
      appointmentType: "home-service",
      serviceType: "plumber",
      detail: "plumber",
      location: { city: "Marbella", countryCode: "ES" },
      language: "fr",
    });

    expect(result.options).toHaveLength(1);
    expect(result.options[0].provider_snapshot).toMatchObject({
      place_id: "new-place-id",
      name: "Marbella Plomberie",
      phone: "+34 956 123 456",
      country_code: "ES",
    });
  });

  it("refreshes a selected external provider phone before contact methods are shown", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      expect(url.pathname).toContain("/place/details/");
      expect(url.searchParams.get("place_id")).toBe("provider-place-id");
      return jsonResponse({
        status: "OK",
        result: {
          international_phone_number: "+34 956 123 456",
          website: "https://provider.example",
          url: "https://maps.google.com/?cid=provider",
          opening_hours: { open_now: true },
        },
      });
    });

    const refreshed = await refreshAppointmentProviderContact({
      appointmentType: "home-service",
      language: "en",
      snapshot: {
        place_id: "provider-place-id",
        name: "Provider",
        phone: null,
        website_url: "https://provider.example",
      },
    });

    expect(refreshed?.snapshot).toMatchObject({
      phone: "+34 956 123 456",
      website_url: "https://provider.example/",
      booking_url: null,
      open_now: true,
    });
    expect(refreshed?.availableChannels).toEqual(["phone", "manual"]);
  });

  it("uses the provider's local weekday when deriving open-today", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T23:30:00.000Z"));
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.51, lng: -4.88 } } }] });
      if (url.pathname.includes("textsearch")) return jsonResponse({ status: "OK", results: [{ name: "Night Plumber", place_id: "night", types: ["plumber"], business_status: "OPERATIONAL", geometry: { location: { lat: 36.51, lng: -4.88 } } }] });
      return jsonResponse({ status: "OK", result: {
        address_components: spain,
        utc_offset_minutes: 120,
        opening_hours: {
          open_now: false,
          periods: [{ open: { day: 1 }, close: { day: 1 } }],
        },
      } });
    });

    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location: { city: "Marbella", countryCode: "ES" } });
    expect(result.options[0].provider_snapshot.open_today).toBe(true);
    vi.useRealTimers();
  });

  it("falls back to an explicit postcode area without changing the visit address or accepting US results", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const location = { address: "my address is Calle madroneo number 6, 11380 Tarifa, Andalucia, Other" };
    const original = location.address;
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) {
        if (url.searchParams.get("address")?.startsWith("Calle")) return jsonResponse({ status: "ZERO_RESULTS", results: [] });
        expect(url.searchParams.get("address")).toBe("11380 Tarifa, Andalucia");
        return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.014, lng: -5.604 } } }] });
      }
      if (url.pathname.includes("textsearch")) {
        expect(url.searchParams.get("query")).not.toContain("madroneo");
        return jsonResponse({ status: "OK", results: [
          { name: "Texas", place_id: "us", geometry: { location: { lat: 29.5, lng: -98.3 } } },
          { name: "Tarifa", place_id: "local", geometry: { location: { lat: 36.014, lng: -5.604 } } },
        ] });
      }
      return jsonResponse({ status: "OK", result: { address_components: spain } });
    });
    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location });
    expect(result.options).toHaveLength(1);
    expect(result.options[0].provider_snapshot).toMatchObject({ place_id: "local", search_area_fallback: true, search_area: "11380 Tarifa, Andalucia" });
    expect(location.address).toBe(original);
  });
  it("cleans the reported conversational address without inventing a country", () => {
    expect(normalizeSearchAddress("my address is Calle madroneo number 6, 11380 Tarifa, Andalucia, Other"))
      .toBe("Calle madroneo number 6, 11380 Tarifa, Andalucia");
  });

  it("uses the postcode and locality for provider queries instead of the house address", () => {
    expect(providerSearchArea("6 Calle Madroño, 11380 Tarifa, Cádiz, Spain"))
      .toBe("11380 Tarifa, Cádiz, Spain");
    expect(providerSearchArea("Tarifa, Cádiz, Spain"))
      .toBe("Tarifa, Cádiz, Spain");
  });

  it.each([
    [{ status: "ZERO_RESULTS", results: [] }, "address_unresolved"],
    [{ status: "OK", results: [{ partial_match: true }] }, "address_unresolved"],
    [{ status: "REQUEST_DENIED" }, "geocoding_unavailable"],
  ])("distinguishes address and geocoding failures", async (body, reason) => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(body));
    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", detail: "plumber", location: { address: "Tarifa, Spain" } });
    expect(result.fallback_reason).toBe(reason);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects Denver and unknown coordinates for a confirmed Tarifa address", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) {
        expect(url.searchParams.get("address")).toBe("Calle madroneo number 6, 11380 Tarifa, Andalucia");
        return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.014, lng: -5.604 } } }] });
      }
      if (url.pathname.includes("textsearch")) return jsonResponse({ status: "OK", results: [
        { name: "Denver plumber", place_id: "denver", geometry: { location: { lat: 39.72, lng: -104.94 } } },
        { name: "Unknown plumber", place_id: "unknown" },
        { name: "Tarifa plumber", place_id: "tarifa", geometry: { location: { lat: 36.015, lng: -5.605 } } },
      ] });
      expect(url.searchParams.get("place_id")).toBe("tarifa");
      return jsonResponse({ status: "OK", result: { address_components: spain } });
    });
    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", serviceType: "plumber", detail: "fast help", location: { address: "my address is Calle madroneo number 6, 11380 Tarifa, Andalucia, Other" } });
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
      if (url.includes("/geocode/")) return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.51, lng: -4.88 } } }] });
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
            address_components: spain,
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

  it.each(["ES", "MA"])("uses the resolved %s country, not a default or profile bias, at a national border", async country => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) return jsonResponse({ status: "OK", results: [{
        address_components: [{ short_name: country, types: ["country"] }],
        geometry: { location: { lat: 36.014, lng: -5.604 } },
      }] });
      if (url.pathname.includes("textsearch")) {
        expect(url.searchParams.get("region")).toBe(country.toLowerCase());
        return jsonResponse({ status: "OK", results: [
          { place_id: "ES", geometry: { location: { lat: 36.015, lng: -5.605 } } },
          { place_id: "MA", geometry: { location: { lat: 35.76, lng: -5.81 } } },
          { place_id: "unknown", geometry: { location: { lat: 36.015, lng: -5.605 } } },
        ] });
      }
      expect(url.searchParams.get("fields")).toContain("address_components");
      const code = url.searchParams.get("place_id");
      return jsonResponse({ status: "OK", result: {
        address_components: code === "unknown" ? [] : [{ short_name: code, types: ["country"] }],
      } });
    });
    const result = await discoverAppointmentProviderOptions({
      appointmentType: "home-service", serviceType: "plumber", detail: "plumber",
      location: { address: "Explicit visit address", countryCode: country === "ES" ? "MA" : "ES" },
    });
    expect(result.options.map(option => option.provider_snapshot.place_id)).toEqual([country]);
    expect(result.options[0].provider_snapshot).toMatchObject({ country_code: country, search_country_code: country });
  });
  it("searches the local Spanish trade name even when the app is English", () => {
    expect(buildAppointmentSearchQueries({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location: "Tarifa", countryCode: "ES", language: "en" })).toContain("fontanero Tarifa");
    expect(buildAppointmentSearchQueries({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location: "Tarifa", countryCode: "ES", language: "en" })).toContain("fontanero");
  });

  it("fills shortlist slots after rejecting cross-border candidates", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.014, lng: -5.604 } } }] });
      if (url.pathname.includes("textsearch")) return jsonResponse({ status: "OK", results: ["foreign", "local"].map(place_id => ({ place_id, geometry: { location: { lat: 36.014, lng: -5.604 } } })) });
      return jsonResponse({ status: "OK", result: { address_components: url.searchParams.get("place_id") === "local" ? spain : [{ short_name: "MA", types: ["country"] }] } });
    });
    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location: { address: "Tarifa" }, maxResults: 1 });
    expect(result.options.map(option => option.provider_snapshot.place_id)).toEqual(["local"]);
  });

  it("does not search when geocoding cannot establish the country", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ status: "OK", results: [{
      geometry: { location: { lat: 36.014, lng: -5.604 } },
    }] }));
    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", detail: "plumber", location: { address: "Tarifa" } });
    expect(result.fallback_reason).toBe("address_unresolved");
    expect(result.options).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { address_components: [{ short_name: "MA", types: ["country"] }] }])("returns an explicit empty result when no provider country is eligible", async detail => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.014, lng: -5.604 } } }] });
      if (url.pathname.includes("textsearch")) return jsonResponse({ status: "OK", results: [{ place_id: "foreign", geometry: { location: { lat: 35.76, lng: -5.81 } } }] });
      return jsonResponse({ status: "OK", result: detail });
    });
    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", detail: "plumber", location: { address: "Tarifa" } });
    expect(result.options).toEqual([]);
    expect(result.fallback_reason).toBe("no_google_results");
  });

  it("keeps an in-country Text Search result when Place Details is temporarily unavailable", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.014, lng: -5.604 } } }] });
      if (url.pathname.includes("textsearch")) return jsonResponse({ status: "OK", results: [{ place_id: "local", name: "Fontaneria Tarifa", formatted_address: "Tarifa, Cadiz, Spain", geometry: { location: { lat: 36.02, lng: -5.61 } } }] });
      return jsonResponse({ status: "OVER_QUERY_LIMIT" });
    });

    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location: { address: "Tarifa, Spain" }, language: "en" });

    expect(result.fallback_reason).toBeUndefined();
    expect(result.options).toHaveLength(1);
    expect(result.options[0].provider_snapshot).toMatchObject({ name: "Fontaneria Tarifa", address: "Tarifa, Cadiz, Spain" });
  });

  it("keeps a local in-radius result when Google omits the country suffix and Place Details is unavailable", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.014, lng: -5.604 } } }] });
      if (url.pathname.includes("textsearch")) return jsonResponse({ status: "OK", results: [{ place_id: "local", name: "Fontaneria Tarifa", formatted_address: "Calle Sancho IV, 11380 Tarifa, Cadiz", geometry: { location: { lat: 36.02, lng: -5.61 } } }] });
      return jsonResponse({ status: "OVER_QUERY_LIMIT" });
    });

    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location: { address: "Tarifa, Spain" }, language: "fr" });

    expect(result.fallback_reason).toBeUndefined();
    expect(result.options).toHaveLength(1);
    expect(result.options[0].provider_snapshot).toMatchObject({ name: "Fontaneria Tarifa" });
  });

  it("does not keep a cross-border Text Search result when Place Details is unavailable", async () => {
    clearPlacesEnv();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.includes("geocode")) return jsonResponse({ status: "OK", results: [{ address_components: spain, geometry: { location: { lat: 36.014, lng: -5.604 } } }] });
      if (url.pathname.includes("textsearch")) return jsonResponse({ status: "OK", results: [{ place_id: "foreign", name: "Plombier Tanger", formatted_address: "Tanger, Morocco", geometry: { location: { lat: 35.76, lng: -5.81 } } }] });
      return jsonResponse({ status: "OVER_QUERY_LIMIT" });
    });

    const result = await discoverAppointmentProviderOptions({ appointmentType: "home-service", serviceType: "plumber", detail: "plumber", location: { address: "Tarifa, Spain" }, language: "en" });

    expect(result.options).toEqual([]);
    expect(result.fallback_reason).toBe("no_google_results");
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

  it.each(["Pest control", "Gardener", "Appliance repair"])(
    "uses the typed custom service as the primary search term: %s",
    (service) => {
      const queries = buildAppointmentSearchQueries({
        appointmentType: "home-service",
        serviceType: "other",
        detail: `${service} needed. Urgency: Today`,
        location: "Barbate, Spain",
        countryCode: "ES",
        language: "en",
      });

      expect(queries[0]).toBe(`${service} Barbate, Spain`);
      expect(queries).toContain(service);
      expect(queries.some((query) => query.includes("mantenimiento del hogar"))).toBe(true);
    },
  );

  it("uses the generic local fallback when Other service is skipped", () => {
    const queries = buildAppointmentSearchQueries({
      appointmentType: "home-service",
      serviceType: "other",
      detail: "Other service needed. Urgency: Flexible",
      location: "Barbate, Spain",
      countryCode: "ES",
      language: "en",
    });

    expect(queries[0]).toBe("mantenimiento del hogar Barbate, Spain");
    expect(queries).not.toContain("Other service");
  });
});
