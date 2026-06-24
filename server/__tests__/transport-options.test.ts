import { describe, expect, it, vi } from "vitest";
import { resolveTransportOptions, type TransportResolverDeps } from "../services/transportOptions.js";

const madridProfile = {
  address_line_1: "Calle Luna 1",
  city: "Madrid",
  region: "Madrid",
  postcode: "28001",
  country_code: "ES",
};

function deps(overrides: TransportResolverDeps = {}): TransportResolverDeps {
  return {
    loadProfile: vi.fn(async () => madridProfile),
    loadSavedProviders: vi.fn(async () => []),
    searchLocalProviders: vi.fn(async () => []),
    ...overrides,
  };
}

describe("transport options resolver", () => {
  it("prioritizes a saved trusted transport provider", async () => {
    const result = await resolveTransportOptions("user-1", {
      destination: { address: "Hospital Universitario La Paz, Madrid" },
      requestedTime: "now",
      purpose: "medical",
    }, deps({
      loadSavedProviders: vi.fn(async () => [{
        id: "provider-1",
        name: "Radio Taxi Familiar",
        phone: "+34 612 345 678",
        address: "Madrid",
        maps_url: "https://maps.example/taxi",
        notes: "Trusted taxi",
        category: "taxi",
      }]),
      searchLocalProviders: vi.fn(async () => [{
        name: "City Taxi",
        phone: "+34 600 000 000",
        address: "Madrid",
        maps_url: "https://maps.example/city",
        place_id: "city-taxi",
      }]),
    }));

    expect(result.options[0]).toMatchObject({
      kind: "saved_provider",
      label: "Radio Taxi Familiar",
      phone: "+34 612 345 678",
      actions: ["call_phone", "start_concierge_action"],
    });
    expect(result.disclaimers.join(" ")).toContain("No ride is booked or requested");
  });

  it("returns a configured ride app in a known market", async () => {
    const result = await resolveTransportOptions("user-1", {
      pickup: { address: "Calle Luna 1, Madrid" },
      destination: { address: "Clinica Centro, Madrid" },
    }, deps());

    expect(result.market).toMatchObject({ countryCode: "ES", city: "Madrid" });
    expect(result.options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "ride_app",
        providerName: "FREENOW",
        actions: ["start_concierge_action"],
      }),
    ]));
  });

  it("treats saved trusted drivers as transport help", async () => {
    const result = await resolveTransportOptions("user-1", {
      destination: { address: "Clinica Centro, Madrid" },
      requestedTime: "17:00",
    }, deps({
      loadSavedProviders: vi.fn(async () => [{
        id: "provider-driver",
        name: "Ana trusted driver",
        phone: "+34 600 333 444",
        address: "Marbella",
        maps_url: null,
        notes: "Family driver for medical appointments",
        category: "trusted_driver",
      }]),
    }));

    expect(result.options[0]).toMatchObject({
      kind: "caregiver",
      label: "Ana trusted driver",
      phone: "+34 600 333 444",
      actions: ["call_phone", "start_concierge_action"],
    });
    expect(result.options[0].description).toContain("trusted driver");
  });

  it("matches a family visit to the saved family driver before taxi providers", async () => {
    const result = await resolveTransportOptions("user-1", {
      destination: { name: "Daughter Maria", address: "Maria's home, Madrid" },
      requestedTime: "tomorrow 16:00",
      purpose: "family_visit",
    }, deps({
      loadSavedProviders: vi.fn(async () => [
        {
          id: "provider-taxi",
          name: "Radio Taxi Familiar",
          phone: "+34 612 345 678",
          address: "Madrid",
          maps_url: "https://maps.example/taxi",
          notes: "Trusted taxi",
          category: "taxi",
        },
        {
          id: "provider-family",
          name: "Ahmed family driver",
          phone: "+34 600 111 222",
          address: "Madrid",
          maps_url: null,
          notes: "Daughter visits and family outings",
          category: "family_driver",
          metadata: { ride_purposes: ["family_visit"], people: ["daughter"] },
        },
      ]),
      searchLocalProviders: vi.fn(async () => [{
        name: "City Taxi",
        phone: "+34 600 000 000",
        address: "Madrid",
        maps_url: "https://maps.example/city",
        place_id: "city-taxi",
      }]),
    }));

    expect(result.options[0]).toMatchObject({
      kind: "caregiver",
      label: "Ahmed family driver",
      phone: "+34 600 111 222",
      matchStrength: "direct",
    });
    expect(result.options[0].matchReason).toMatch(/daughter|family/i);
  });

  it("falls back to manual Concierge help in an unknown market", async () => {
    const result = await resolveTransportOptions("user-1", {
      destination: { address: "Local clinic" },
    }, deps({
      loadProfile: vi.fn(async () => ({
        address_line_1: "Avenue Hassan II",
        city: "Tangier",
        region: "Tangier-Tetouan",
        postcode: "90000",
        country_code: "MA",
      })),
    }));

    expect(result.fallbackReason).toBe("local_provider_search_empty");
    expect(result.options).toEqual([
      expect.objectContaining({
        kind: "concierge_manual",
        actions: ["draft_message", "start_concierge_action"],
      }),
    ]);
  });

  it("returns a clear fallback when pickup and destination context are missing", async () => {
    const searchLocalProviders = vi.fn(async () => []);
    const result = await resolveTransportOptions("user-1", {}, deps({
      loadProfile: vi.fn(async () => null),
      searchLocalProviders,
    }));

    expect(result.fallbackReason).toBe("pickup_or_destination_needed");
    expect(searchLocalProviders).not.toHaveBeenCalled();
    expect(result.options[0]).toMatchObject({ kind: "concierge_manual" });
  });

  it("keeps Concierge fallback when local provider search fails", async () => {
    const result = await resolveTransportOptions("user-1", {
      destination: { address: "Clinic" },
    }, deps({
      searchLocalProviders: vi.fn(async () => {
        throw new Error("places down");
      }),
    }));

    expect(result.fallbackReason).toBe("local_provider_search_failed");
    expect(result.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "concierge_manual" }),
    ]));
  });
});
