import { describe, expect, it } from "vitest";
import { selectTriageScanOffer } from "./triageScanOffers";

const answer = (id: string, kind = "red_flag") => ({ id, label: id, value: id, kind });
const symptom = (id: string) => answer(id, "symptom");

describe("selectTriageScanOffer", () => {
  it("offers vitals after breathing red flags are cleared or speakable", () => {
    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("breathing"), answer("worse_but_speaking")],
    })?.type).toBe("vitals");
  });

  it("suppresses scans when an emergency safety alert is active", () => {
    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("breathing"), answer("worse_but_speaking")],
      safetyAlertActive: true,
    })).toBeNull();
  });

  it("offers wound photos for skin or fall cases without emergency blockers", () => {
    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("skin"), answer("wound_spreading")],
    })?.type).toBe("wound_photo");
  });

  it("offers urine photos for visible urine changes but not blocked urine", () => {
    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("urinary"), answer("blood_in_urine")],
    })?.type).toBe("urine_photo");

    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("urinary"), answer("cannot_pee")],
    })).toBeNull();
  });

  it("offers stool photos for relevant bowel cases but not severe stool red flags", () => {
    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("stomach"), answer("no_red_flag"), answer("constipation_passing_gas", "duration")],
    })?.type).toBe("stool_photo");

    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("stomach"), answer("blood_vomit_stool")],
    })).toBeNull();
  });

  it("does not repeat completed or declined scans", () => {
    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("breathing"), answer("worse_but_speaking")],
      declinedScanTypes: ["vitals"],
    })).toBeNull();

    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("breathing"), answer("worse_but_speaking")],
      scanResults: [{
        id: "scan-1",
        type: "vitals",
        label: "Pulse and breathing scan",
        concernLevel: "normal",
        summary: "Pulse 72 bpm",
        findings: ["Pulse: 72 bpm"],
        capturedAt: new Date().toISOString(),
      }],
    })).toBeNull();
  });
});
