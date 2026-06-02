import { describe, expect, it } from "vitest";
import {
  healthDoctorQuickActionsFor,
  latestTriageServiceActionsFor,
  specialistProviderContext,
  specialistProviderServiceActionsFor,
  specialistRideState,
  type SpecialistProvider,
} from "./HealthScreen";

const baseReport = {
  id: "report-1",
  chief_complaint: "Chest pressure",
  symptoms: ["pressure"],
  urgency: "routine" as const,
  recommendations: ["Contact your doctor today"],
  bpm: null,
  respiratory_rate: null,
  created_at: "2026-06-01T10:00:00.000Z",
};

describe("Health home latest triage service actions", () => {
  it("puts emergency call first for urgent reports", () => {
    const actions = latestTriageServiceActionsFor({
      report: { ...baseReport, urgency: "urgent" },
      country: "ES",
      doctorContext: "Recent symptom check context",
    });

    expect(actions[0]).toMatchObject({
      kind: "call_emergency",
      href: "tel:112",
      label: "Call 112",
    });
  });

  it("maps latest doctor recommendations to direct GP contact and doctor help", () => {
    const actions = latestTriageServiceActionsFor({
      report: baseReport,
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
      doctorContext: "Recent symptom check context",
    });

    expect(actions).toEqual([
      expect.objectContaining({ kind: "call_gp", href: "tel:+34612345678" }),
      expect.objectContaining({ kind: "email_gp", href: expect.stringContaining("mailto:gp@example.com") }),
      expect.objectContaining({ kind: "doctor_help", to: "/health/doctor" }),
    ]);
  });

  it("maps transport and appointment recommendations to prepared concierge requests", () => {
    const actions = latestTriageServiceActionsFor({
      report: {
        ...baseReport,
        recommendations: ["Consider visiting an urgent care center"],
      },
      doctorContext: "Recent symptom check context",
    });

    expect(actions).toEqual([
      expect.objectContaining({
        kind: "book_ride",
        to: "/concierge",
        state: { conciergePrefill: expect.objectContaining({ kind: "ride" }) },
      }),
      expect.objectContaining({
        kind: "schedule_appointment",
        to: "/concierge",
        state: { conciergePrefill: expect.objectContaining({ kind: "appointment" }) },
      }),
    ]);
  });

  it("maps hydration recommendations to a prepared shopping order", () => {
    const actions = latestTriageServiceActionsFor({
      report: {
        ...baseReport,
        recommendations: ["Stay hydrated and drink fluids"],
      },
      doctorContext: "Recent symptom check context",
    });

    expect(actions).toEqual([
      expect.objectContaining({
        kind: "online_order",
        to: "/concierge/shopping",
        state: { shoppingPrefill: expect.objectContaining({ category: "groceries" }) },
      }),
    ]);
  });

  it("keeps every latest-triage service action when multiple needs apply", () => {
    const actions = latestTriageServiceActionsFor({
      report: {
        ...baseReport,
        recommendations: [
          "Contact your doctor today",
          "Consider visiting an urgent care center",
          "Stay hydrated and drink fluids",
          "Have someone stay with you at home",
        ],
      },
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
      doctorContext: "Recent symptom check context",
    });

    expect(actions.map((action) => action.kind)).toEqual([
      "call_gp",
      "email_gp",
      "doctor_help",
      "book_ride",
      "schedule_appointment",
      "online_order",
      "request_quote",
    ]);
  });
});

describe("Health home doctor access actions", () => {
  it("turns the see-doctor panel into direct GP and booking actions", () => {
    const actions = healthDoctorQuickActionsFor({
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
      gpName: "Dr Lopez",
      doctorContext: "Recent health context",
    });

    expect(actions).toEqual([
      expect.objectContaining({ kind: "call_gp", href: "tel:+34612345678", label: "Call Dr Lopez" }),
      expect.objectContaining({ kind: "email_gp", href: expect.stringContaining("mailto:gp@example.com") }),
      expect.objectContaining({ kind: "doctor_help", to: "/health/doctor" }),
      expect.objectContaining({
        kind: "schedule_appointment",
        to: "/concierge",
        state: { conciergePrefill: expect.objectContaining({ kind: "appointment", source: "health_home_doctor" }) },
      }),
      expect.objectContaining({
        kind: "book_ride",
        to: "/concierge",
        state: { conciergePrefill: expect.objectContaining({ kind: "ride", source: "health_home_doctor" }) },
      }),
    ]);
  });

  it("sends users to GP setup when no doctor contact is saved", () => {
    const actions = healthDoctorQuickActionsFor({
      doctorContext: "Health home doctor support request",
    });

    expect(actions[0]).toMatchObject({
      kind: "add_doctor_contact",
      to: "/onboarding/profile/gp",
    });
  });
});

describe("Find specialist provider service actions", () => {
  const provider: SpecialistProvider = {
    name: "Dr Maria Lopez",
    specialty: "cardiology",
    clinicName: "Heart Clinic Madrid",
    phone: "+34 612 345 678",
    address: "Calle Mayor 1, Madrid",
    openingTimes: "Mon-Fri 09:00-17:00",
    distanceLabel: "2.4 km",
    bookingUrl: "https://booking.example.com/dr-lopez",
    mapsUrl: "https://maps.example.com/heart-clinic",
    sourceName: "Google Places",
    rationale: "Nearby cardiology option",
  };

  it("turns a specialist result into call, appointment, ride, and map actions", () => {
    expect(specialistProviderServiceActionsFor(provider)).toEqual([
      { kind: "call_provider", href: "tel:+34612345678" },
      { kind: "book_appointment", href: "https://booking.example.com/dr-lopez" },
      { kind: "book_ride" },
      { kind: "open_map", href: "https://maps.example.com/heart-clinic" },
    ]);
  });

  it("keeps appointment and ride available even when provider contact data is sparse", () => {
    expect(specialistProviderServiceActionsFor({
      ...provider,
      phone: null,
      bookingUrl: null,
      mapsUrl: null,
    })).toEqual([
      { kind: "book_appointment", href: undefined },
      { kind: "book_ride" },
    ]);
  });

  it("prefills concierge transport with the selected specialist context", () => {
    const rideState = specialistRideState(provider, "chest discomfort", "en");

    expect(rideState.conciergePrefill).toMatchObject({
      kind: "ride",
      source: "specialist_finder",
    });
    expect(rideState.conciergePrefill.message).toContain("Help me prepare safe transport");
    expect(rideState.conciergePrefill.message).toContain("Heart Clinic Madrid");
    expect(rideState.conciergePrefill.message).toContain("Reason: chest discomfort");
  });

  it("builds a shareable specialist context for appointment support", () => {
    expect(specialistProviderContext(provider, "heart symptoms", "en")).toContain("Booking link: https://booking.example.com/dr-lopez");
    expect(specialistProviderContext(provider, "heart symptoms", "en")).toContain("Phone: +34 612 345 678");
  });
});
