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
    const offer = selectTriageScanOffer({
      selectedAnswers: [symptom("stomach"), answer("no_red_flag"), answer("constipation_passing_gas", "duration")],
    });

    expect(offer?.type).toBe("stool_photo");
    expect(offer?.title).toBe("Photo of stool appearance");
    expect(offer?.body).toBe("If the stool looked unusual for you, a photo may help VYVA note the change.");
    expect(offer?.privacyNote).toBe("Only photograph the stool itself. Keep faces and ID cards out of the photo. A photo cannot tell if there is bleeding or stomach disease.");

    expect(selectTriageScanOffer({
      selectedAnswers: [symptom("stomach"), answer("blood_vomit_stool")],
    })).toBeNull();
  });

  it("can localize offer copy through the shared language controller translator", () => {
    const offer = selectTriageScanOffer({
      selectedAnswers: [symptom("stomach"), answer("no_red_flag"), answer("constipation_passing_gas", "duration")],
      localize: (path, fallback) => {
        if (path === "triageScan.offers.stool_photo.title") return "Foto del aspecto de las heces";
        if (path === "triageScan.offers.stool_photo.body") return "Texto localizado";
        if (path === "triageScan.offers.stool_photo.privacyNote") return "Nota localizada";
        return fallback ?? path;
      },
    });

    expect(offer?.type).toBe("stool_photo");
    expect(offer?.title).toBe("Foto del aspecto de las heces");
    expect(offer?.body).toBe("Texto localizado");
    expect(offer?.privacyNote).toBe("Nota localizada");
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
