import { describe, expect, it } from "vitest";
import { providerDirectoryItemFromConsent } from "./adminProviderDirectory.js";

describe("admin provider directory", () => {
  it("summarizes a saved provider without exposing profile internals", () => {
    const item = providerDirectoryItemFromConsent({
      profileId: "profile-1",
      providerIndex: 0,
      userLabel: "Karim",
      userEmail: "karim@example.com",
      provider: {
        name: "City Clinic",
        role: "doctor_clinic",
        phone: "+34 911 111 111",
        email: "clinic@example.com",
        is_trusted: true,
        is_default: true,
        can_contact_after_confirmation: true,
      },
    });

    expect(item).toMatchObject({
      id: "profile-1:0",
      userLabel: "Karim",
      name: "City Clinic",
      category: "doctor_clinic",
      readyForConcierge: true,
      readinessLabel: "Phone, Email",
      channels: ["phone", "email"],
      defaultForCategory: true,
    });
  });

  it("marks providers without contact details as needing attention", () => {
    const item = providerDirectoryItemFromConsent({
      profileId: "profile-1",
      providerIndex: 1,
      userLabel: "Karim",
      provider: {
        name: "Repair Help",
        role: "home_service",
        is_trusted: true,
        can_contact_after_confirmation: true,
      },
    });

    expect(item).toMatchObject({
      name: "Repair Help",
      category: "home_service",
      readyForConcierge: false,
      readinessLabel: "Add contact",
      channels: [],
    });
  });
});
