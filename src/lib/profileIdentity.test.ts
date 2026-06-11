import { describe, expect, it } from "vitest";
import {
  buildOnboardingIdentityPayload,
  buildPhoneNumber,
  buildProfileIdentityPayload,
  identityFromOnboardingProfile,
  identityFromProfileResponse,
  joinFullName,
  phoneLocalPlaceholderForCountry,
  splitFullName,
  splitPhoneNumber,
  type IdentityBasicsForm,
} from "./profileIdentity";

const baseIdentityForm: IdentityBasicsForm = {
  firstName: "Karim",
  lastName: "Assad",
  preferredName: "Karim",
  dateOfBirth: "1975-04-12",
  phoneCountry: "ES",
  phoneLocal: "233245",
  email: "karim@example.com",
  language: "en",
  avatarUrl: "data:image/jpeg;base64,avatar",
};

describe("profileIdentity", () => {
  it("splits and joins full names consistently", () => {
    expect(splitFullName("  Karim bin Assad  ")).toEqual({
      firstName: "Karim",
      lastName: "bin Assad",
    });
    expect(splitFullName("Karim")).toEqual({ firstName: "Karim", lastName: "" });
    expect(joinFullName(" Karim ", " Assad ")).toBe("Karim Assad");
    expect(joinFullName("", "Assad")).toBe("Assad");
  });

  it("splits and builds phone numbers with country formatting", () => {
    expect(splitPhoneNumber("+34 612345678", "US")).toEqual({
      phoneCountry: "ES",
      phoneLocal: "612 345 678",
    });
    expect(splitPhoneNumber("233245", "ES")).toEqual({
      phoneCountry: "ES",
      phoneLocal: "233 245",
    });
    expect(buildPhoneNumber("ES", "233245")).toBe("+34 233 245");
  });

  it("uses local phone placeholders that match the selected country", () => {
    expect(phoneLocalPlaceholderForCountry("ES")).toBe("612 345 678");
    expect(phoneLocalPlaceholderForCountry("UK")).toBe("7700 900 123");
    expect(phoneLocalPlaceholderForCountry("US")).toBe("201 555 0123");
    expect(phoneLocalPlaceholderForCountry("FR")).toBe("6 12 34 56 78");
    expect(phoneLocalPlaceholderForCountry(null)).toBe("612 345 678");
    expect(phoneLocalPlaceholderForCountry("ES")).not.toContain("+34");
    expect(phoneLocalPlaceholderForCountry("UK")).not.toContain("+44");
  });

  it("maps a profile response into the shared identity form", () => {
    expect(
      identityFromProfileResponse({
        firstName: "Karim",
        lastName: "Assad",
        preferredName: "Karim",
        dateOfBirth: "1975-04-12",
        phone: "+44 7700900123",
        country: "UK",
        email: "karim@example.com",
        language: "en",
        avatarUrl: "avatar-url",
      }, "es"),
    ).toEqual({
      firstName: "Karim",
      lastName: "Assad",
      preferredName: "Karim",
      dateOfBirth: "1975-04-12",
      phoneCountry: "UK",
      phoneLocal: "770 090 012 3",
      email: "karim@example.com",
      language: "en",
      avatarUrl: "avatar-url",
    });
  });

  it("maps an onboarding profile into the shared identity form", () => {
    expect(
      identityFromOnboardingProfile({
        full_name: "Karim Assad",
        preferred_name: "Karim",
        date_of_birth: "1975-04-12",
        phone_number: "+34 233245",
        email: "karim@example.com",
        language: "en",
        avatar_url: "avatar-url",
      }, "es"),
    ).toEqual({
      firstName: "Karim",
      lastName: "Assad",
      preferredName: "Karim",
      dateOfBirth: "1975-04-12",
      phoneCountry: "ES",
      phoneLocal: "233 245",
      email: "karim@example.com",
      language: "en",
      avatarUrl: "avatar-url",
    });
  });

  it("builds the existing profile endpoint payload", () => {
    expect(buildProfileIdentityPayload(baseIdentityForm)).toEqual({
      firstName: "Karim",
      lastName: "Assad",
      preferredName: "Karim",
      dateOfBirth: "1975-04-12",
      phone: "+34 233 245",
      email: "karim@example.com",
      language: "en",
      country: "ES",
    });
  });

  it("builds the existing onboarding basics endpoint payload", () => {
    expect(buildOnboardingIdentityPayload(baseIdentityForm)).toEqual({
      full_name: "Karim Assad",
      preferred_name: "Karim",
      date_of_birth: "1975-04-12",
      phone_number: "+34 233 245",
      language: "en",
      email: "karim@example.com",
    });
  });
});
