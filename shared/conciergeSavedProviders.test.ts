import { describe, expect, it } from "vitest";
import {
  normalizeSavedProviderDefaults,
  savedProviderContactReadiness,
  selectConciergeSavedProvider,
} from "./conciergeSavedProviders.js";

describe("Concierge saved provider selection", () => {
  it("uses the trusted default provider for the requested category", () => {
    const selected = selectConciergeSavedProvider([
      { name: "First Taxi", category: "transport", phone: "+34 600 111 111", is_trusted: true },
      { name: "Default Taxi", category: "transport", phone: "+34 600 222 222", is_trusted: true, is_default: true },
      { name: "Old Taxi", category: "transport", phone: "+34 600 333 333", is_trusted: false, is_default: true },
    ], "transport");

    expect(selected?.name).toBe("Default Taxi");
  });

  it("returns missing when the category has no trusted provider", () => {
    expect(selectConciergeSavedProvider([
      { name: "Unreviewed Clinic", category: "doctor_clinic", is_trusted: false },
      { name: "Trusted Taxi", category: "transport", is_trusted: true },
    ], "doctor_clinic")).toBeNull();
  });

  it("does not treat providers without contact details as Concierge usable", () => {
    expect(savedProviderContactReadiness({
      name: "Clinic without contact",
      category: "doctor_clinic",
      is_trusted: true,
      is_default: true,
    })).toMatchObject({
      channels: [],
      conciergeUsable: false,
      label: "Add contact",
    });

    expect(selectConciergeSavedProvider([
      { name: "Clinic without contact", category: "doctor_clinic", is_trusted: true, is_default: true },
    ], "doctor_clinic")).toBeNull();
  });

  it("summarizes ready provider contact channels without exposing technical fields", () => {
    expect(savedProviderContactReadiness({
      name: "Harbour Clinic",
      category: "doctor_clinic",
      email: "frontdesk@example.com",
      whatsapp: "+34 600 111 222",
      preferred_channel: "whatsapp",
      can_contact_after_confirmation: true,
    })).toMatchObject({
      channels: ["email", "whatsapp"],
      preferredChannel: "whatsapp",
      conciergeUsable: true,
      label: "Email, WhatsApp",
    });
  });

  it("keeps exactly one default per category and supports legacy saved providers", () => {
    const normalized = normalizeSavedProviderDefaults([
      { name: "Local Pharmacy", role: "pharmacy" },
      { name: "Second Pharmacy", category: "pharmacy", is_trusted: true, is_default: true },
      { name: "Taxi One", role: "taxi" },
      { name: "Taxi Two", category: "transport" },
    ]);

    expect(normalized.filter((provider) => provider.is_default).map((provider) => provider.name)).toEqual([
      "Second Pharmacy",
      "Taxi One",
    ]);
  });
});
