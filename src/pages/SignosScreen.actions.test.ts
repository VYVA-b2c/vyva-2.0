import { describe, expect, it } from "vitest";
import { vitalsStatusServiceActionsFor } from "./SignosScreen";

const labels = {
  callGp: "Call GP",
  callGpWithName: "Call {{name}}",
  emailGp: "Email GP",
  doctorHelp: "Doctor help",
  addDoctor: "Add doctor",
  appointment: "Book appointment",
  ride: "Book ride",
  appointmentPrefill: "Please help me schedule a doctor appointment based on my VYVA vitals. Ask me to confirm before booking.",
  ridePrefill: "Please help me arrange safe transport based on my VYVA vitals. Ask me to confirm before booking.",
};

describe("Vitals status service actions", () => {
  it("turns saved GP details into direct contact, doctor, appointment, and ride actions", () => {
    const actions = vitalsStatusServiceActionsFor({
      gpName: "Dr Garcia",
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
      context: "VYVA vitals summary\nHeart rate: 112 bpm",
      labels,
    });

    expect(actions).toEqual([
      expect.objectContaining({ kind: "call_gp", label: "Call Dr Garcia", href: "tel:+34612345678" }),
      expect.objectContaining({ kind: "email_gp", href: expect.stringContaining("mailto:gp@example.com") }),
      expect.objectContaining({ kind: "doctor_help", to: "/health/doctor" }),
      expect.objectContaining({
        kind: "schedule_appointment",
        to: "/concierge",
        state: { conciergePrefill: expect.objectContaining({ kind: "appointment", source: "vitals_safety" }) },
      }),
      expect.objectContaining({
        kind: "book_ride",
        to: "/concierge",
        state: { conciergePrefill: expect.objectContaining({ kind: "ride", source: "vitals_safety" }) },
      }),
    ]);
  });

  it("offers doctor setup when no GP contact exists and keeps booking actions available", () => {
    const actions = vitalsStatusServiceActionsFor({
      context: "VYVA vitals summary\nNo recent readings",
      labels,
    });

    expect(actions[0]).toMatchObject({
      kind: "add_doctor_contact",
      to: "/onboarding/profile/gp",
    });
    expect(actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "doctor_help", to: "/health/doctor" }),
      expect.objectContaining({ kind: "schedule_appointment", to: "/concierge" }),
      expect.objectContaining({ kind: "book_ride", to: "/concierge" }),
    ]));
  });
});
