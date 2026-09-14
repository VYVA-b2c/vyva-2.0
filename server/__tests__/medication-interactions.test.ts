import { describe, expect, it } from "vitest";
import { computeMedicationInteractionFlags } from "../lib/medicationInteractions.js";

const medicines = [
  {
    id: "med-1",
    display_name: "Amlodipine",
    drug_class_tag: "blood_pressure_lowering",
    status: "active",
  },
  {
    id: "med-2",
    display_name: "Ibuprofen",
    drug_class_tag: "nsaid_pain_reliever",
    status: "active",
  },
  {
    id: "med-3",
    display_name: "Lisinopril",
    drug_class_tag: "blood_pressure_lowering",
    status: "active",
  },
];

const reviewedRule = {
  id: "rule-1",
  class_a: "blood_pressure_lowering",
  class_b: "nsaid_pain_reliever",
  flag_message_en: "Worth asking your pharmacist if they go well together.",
  flag_message_es: "Pregunta a tu farmaceutico si van bien juntos.",
  flag_message_de: "Frag deinen Apotheker, ob das zusammenpasst.",
  severity_tier: "worth_asking",
  is_active: true,
};

describe("computeMedicationInteractionFlags", () => {
  it("returns reviewed rule flags before duplicate class flags and caps results", () => {
    const flags = computeMedicationInteractionFlags({
      medicines,
      rules: [reviewedRule],
      maxFlags: 2,
      now: new Date("2026-07-07T12:00:00.000Z"),
    });

    expect(flags).toHaveLength(2);
    expect(flags[0]).toMatchObject({
      kind: "rule",
      ruleId: "rule-1",
      medicines: ["Amlodipine", "Ibuprofen"],
      canDismiss: true,
    });
    expect(flags[1]).toMatchObject({
      kind: "duplicate_class",
      medicines: ["Amlodipine", "Lisinopril"],
      canDismiss: false,
    });
  });

  it("does not show inactive rules", () => {
    const flags = computeMedicationInteractionFlags({
      medicines: medicines.slice(0, 2),
      rules: [{ ...reviewedRule, is_active: false }],
    });

    expect(flags).toEqual([]);
  });

  it("does not surface flags for discontinued medicines", () => {
    const flags = computeMedicationInteractionFlags({
      medicines: [
        medicines[0],
        { ...medicines[1], status: "discontinued" },
      ],
      rules: [reviewedRule],
    });

    expect(flags).toEqual([]);
  });

  it("hides reviewed flags permanently after the pharmacist dismissal", () => {
    const flags = computeMedicationInteractionFlags({
      medicines: medicines.slice(0, 2),
      rules: [reviewedRule],
      dismissals: [{
        rule_id: "rule-1",
        medicine_pair: ["med-2", "med-1"],
        reason: "asked_pharmacist",
        dismissed_at: "2026-07-01T12:00:00.000Z",
      }],
      now: new Date("2026-07-07T12:00:00.000Z"),
    });

    expect(flags).toEqual([]);
  });
});
