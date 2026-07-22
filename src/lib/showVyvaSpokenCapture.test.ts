import { describe, expect, it } from "vitest";
import {
  SHOW_VYVA_GUIDANCE_CHANGE_COOLDOWN_MS,
  SHOW_VYVA_GUIDANCE_REPEAT_COOLDOWN_MS,
  canSpeakShowVyvaGuidance,
  matchShowVyvaCaptureCommand,
  normalizeShowVyvaCaptureSpeech,
  spokenGuidanceForShowVyvaStatus,
} from "./showVyvaSpokenCapture";

describe("Show VYVA spoken capture", () => {
  it("matches concise commands in every supported language", () => {
    expect(matchShowVyvaCaptureCommand("Please take a photo", "en")).toBe("take_photo");
    expect(matchShowVyvaCaptureCommand("VYVA, cancelar", "es")).toBe("cancel");
    expect(matchShowVyvaCaptureCommand("Importer plutot", "fr")).toBe("upload_instead");
    expect(matchShowVyvaCaptureCommand("Foto aufnehmen", "de")).toBe("take_photo");
    expect(matchShowVyvaCaptureCommand("Carica invece", "it")).toBe("upload_instead");
    expect(matchShowVyvaCaptureCommand("Fechar camara", "pt")).toBe("cancel");
  });

  it("normalizes accents but rejects partial or unrelated speech", () => {
    expect(normalizeShowVyvaCaptureSpeech("  Cerrar camara! ")).toBe("cerrar camara");
    expect(matchShowVyvaCaptureCommand("take", "en")).toBeNull();
    expect(matchShowVyvaCaptureCommand("please", "en")).toBeNull();
    expect(matchShowVyvaCaptureCommand("this is a document", "en")).toBeNull();
  });

  it("maps visual coaching to the short spoken prompts", () => {
    expect(spokenGuidanceForShowVyvaStatus("dark")).toBe("find_more_light");
    expect(spokenGuidanceForShowVyvaStatus("blur")).toBe("move_closer");
    expect(spokenGuidanceForShowVyvaStatus("framing")).toBe("move_closer");
    expect(spokenGuidanceForShowVyvaStatus("glare")).toBe("tilt_away_from_glare");
    expect(spokenGuidanceForShowVyvaStatus("hold_steady")).toBe("hold_steady");
    expect(spokenGuidanceForShowVyvaStatus("ready")).toBeNull();
  });

  it("uses a longer cooldown for repeated guidance", () => {
    const previousSpokenAt = 10_000;
    expect(canSpeakShowVyvaGuidance({
      guidance: "hold_steady",
      previousGuidance: "hold_steady",
      previousSpokenAt,
      now: previousSpokenAt + SHOW_VYVA_GUIDANCE_REPEAT_COOLDOWN_MS - 1,
    })).toBe(false);
    expect(canSpeakShowVyvaGuidance({
      guidance: "hold_steady",
      previousGuidance: "hold_steady",
      previousSpokenAt,
      now: previousSpokenAt + SHOW_VYVA_GUIDANCE_REPEAT_COOLDOWN_MS,
    })).toBe(true);
    expect(canSpeakShowVyvaGuidance({
      guidance: "move_closer",
      previousGuidance: "hold_steady",
      previousSpokenAt,
      now: previousSpokenAt + SHOW_VYVA_GUIDANCE_CHANGE_COOLDOWN_MS,
    })).toBe(true);
  });
});
