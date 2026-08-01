import { describe, expect, it } from "vitest";
import {
  medicationDoctorActionKinds,
  medicationDoctorContext,
  medicationListSummary,
  medicationRefillShoppingState,
  medicationReviewAppointmentState,
  medicationReviewRideState,
} from "./MedsScreen";

describe("Meds service actions", () => {
  it("builds a senior-friendly medication summary", () => {
    expect(medicationListSummary(["Metformin", " ", "Atorvastatin"])).toBe("Metformin, Atorvastatin");
    expect(medicationListSummary([])).toBe("my medications");
  });

  it("prefills pharmacy shopping support for refills", () => {
    const state = medicationRefillShoppingState("Metformin, Atorvastatin", "en");

    expect(state.shoppingPrefill).toEqual({
      needText: expect.stringContaining("safe refill or pharmacy delivery"),
      category: "pharmacy_basics",
      priorities: ["safety", "delivery", "simplicity"],
    });
    expect(state.shoppingPrefill.needText).toContain("Metformin, Atorvastatin");
  });

  it("prefills medication review appointment support", () => {
    const state = medicationReviewAppointmentState(
      "Metformin",
      "Today: 1/2 doses. Still due: 1",
      "en",
      "medication_support",
    );

    expect(state.conciergePrefill).toMatchObject({
      kind: "appointment",
      source: "medication_support",
    });
    expect(state.conciergePrefill.message).toContain("medication review appointment");
    expect(state.conciergePrefill.message).toContain("Metformin");
    expect(state.conciergePrefill.message).toContain("Still due: 1");
    expect(state.conciergePrefill.message).toContain("confirm before booking");
  });

  it("localizes medication update appointment handoffs in every app language", () => {
    const expectedConfirmationCopy = {
      en: "confirm before booking",
      es: "confirmacion antes de reservar",
      fr: "confirmation avant toute reservation",
      de: "Bestaetigung",
      it: "conferma prima di prenotare",
      pt: "confirmacao antes de marcar",
    } as const;

    for (const [language, confirmationCopy] of Object.entries(expectedConfirmationCopy)) {
      const state = medicationReviewAppointmentState(
        "Metformin",
        "FDA | 2026-03-15 | https://dailymed.nlm.nih.gov/example",
        language,
        "medication_support",
      );

      expect(state.conciergePrefill).toMatchObject({
        kind: "appointment",
        source: "medication_support",
      });
      expect(state.conciergePrefill.message).toContain("Metformin");
      expect(state.conciergePrefill.message).toContain("https://dailymed.nlm.nih.gov/example");
      expect(state.conciergePrefill.message).toContain(confirmationCopy);
    }
  });

  it("prefills medication transport support", () => {
    const state = medicationReviewRideState(
      "Metformin",
      "Needs pharmacy pickup",
      "en",
      "adherence_report",
    );

    expect(state.conciergePrefill).toMatchObject({
      kind: "ride",
      source: "adherence_report",
    });
    expect(state.conciergePrefill.message).toContain("book transport");
    expect(state.conciergePrefill.message).toContain("Metformin");
    expect(state.conciergePrefill.message).toContain("Needs pharmacy pickup");
    expect(state.conciergePrefill.message).toContain("confirm before booking");
  });

  it("builds medication context for doctor help", () => {
    const context = medicationDoctorContext({
      medicationSummary: "Metformin",
      totalScheduledDoseCount: 2,
      totalTakenDoseCount: 1,
      totalRemainingDoseCount: 1,
      language: "en",
    });

    expect(context).toContain("VYVA medication summary");
    expect(context).toContain("Medication: Metformin");
    expect(context).toContain("Today's doses: 1/2");
    expect(context).toContain("Still due: 1");
  });

  it("keeps every applicable medication doctor action available", () => {
    expect(medicationDoctorActionKinds({ hasGpPhone: true, hasGpEmail: true })).toEqual([
      "call_gp",
      "email_gp",
      "doctor_help",
    ]);
    expect(medicationDoctorActionKinds({ hasGpPhone: false, hasGpEmail: true })).toEqual([
      "email_gp",
      "doctor_help",
    ]);
    expect(medicationDoctorActionKinds({ hasGpPhone: false, hasGpEmail: false })).toEqual([
      "doctor_help",
    ]);
  });
});
