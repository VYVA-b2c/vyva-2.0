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
  messages: { en: { why: "Worth asking about this combination." } },
  approved_locales: ["en"],
  is_active: true,
};

describe("computeMedicationInteractionFlags", () => {
  it("returns reviewed rule flags before duplicate class flags and caps results", () => {
    const flags = computeMedicationInteractionFlags({
      medicines,
      rules: [reviewedRule],
      locale: "en",
      maxFlags: 2,
      now: new Date("2026-07-07T12:00:00.000Z"),
    });

    expect(flags).toHaveLength(2);
    expect(flags[0]).toMatchObject({
      kind: "rule",
      ruleId: "rule-1",
      medicines: ["Amlodipine", "Ibuprofen"],
      canSnooze: true,
    });
    expect(flags[1]).toMatchObject({
      kind: "duplicate_class",
      medicines: ["Amlodipine", "Lisinopril"],
      canSnooze: true,
    });
  });

  it("does not show inactive rules", () => {
    const flags = computeMedicationInteractionFlags({
      medicines: medicines.slice(0, 2),
      rules: [{ ...reviewedRule, is_active: false }],
      locale: "en",
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
      locale: "en",
    });

    expect(flags).toEqual([]);
  });

  it("hides resolved flags until the medicine changes", () => {
    const flags = computeMedicationInteractionFlags({
      medicines: medicines.slice(0, 2),
      rules: [reviewedRule],
      locale: "en",
      states: [{ flag_key: "rule-1:med-1:med-2", status: "resolved_fine", snooze_until: "2026-07-01T12:00:00.000Z" }],
      now: new Date("2026-07-07T12:00:00.000Z"),
    });

    expect(flags).toEqual([]);
  });
});
