import { describe, expect, it } from "vitest";
import {
  channelsForProvider,
  normalizeConsentProvider,
  providerSnapshot,
} from "./providerSync.js";

describe("provider sync normalization", () => {
  it("keeps trusted provider readiness fields for transport providers", () => {
    const provider = normalizeConsentProvider({
      name: "Trusted Taxi",
      role: "Transport / Taxi",
      phone: "+34 600 111 222",
      email: "bookings@trustedtaxi.example",
      whatsapp: "+34 600 333 444",
      booking_url: "https://trustedtaxi.example/book",
      preferred_channel: "whatsapp",
      can_contact_after_confirmation: true,
    });

    expect(provider).toMatchObject({
      category: "transport",
      name: "Trusted Taxi",
      phone: "+34 600 111 222",
      email: "bookings@trustedtaxi.example",
      whatsapp: "+34 600 333 444",
      booking_url: "https://trustedtaxi.example/book",
      metadata: {
        preferred_channel: "whatsapp",
        preferred_booking_method: "whatsapp",
        can_contact_after_confirmation: true,
      },
    });
  });

  it("exposes contact channels in appointment provider snapshots", () => {
    const snapshot = providerSnapshot({
      id: "provider-1",
      category: "home_service",
      name: "Home Repair",
      phone: "+34 600 111 222",
      whatsapp: "+34 600 333 444",
      email: "help@repair.example",
      booking_url: "https://repair.example/book",
      metadata: { preferred_booking_method: "booking_url" },
    });

    expect(channelsForProvider(snapshot)).toEqual([
      "booking_url",
      "phone",
      "whatsapp",
      "email",
      "manual",
    ]);
    expect(snapshot.metadata).toMatchObject({ preferred_booking_method: "booking_url" });
  });
});
