import { describe, expect, it } from "vitest";
import {
  applyProfileVoiceCorrection,
  createAllergiesVoiceDraft,
  parseProfileVoiceCommand,
  parseProfileVoiceTranscript,
} from "./profileVoiceCompletion";

describe("profile voice completion adapter", () => {
  it("parses health transcripts into review drafts", () => {
    const result = parseProfileVoiceTranscript(
      "health",
      "I have diabetes and high blood pressure",
    );

    expect(result.type).toBe("draft");
    if (result.type !== "draft") return;
    expect(result.draft.kind).toBe("health-conditions");
    expect(result.draft.values).toEqual(["Hypertension", "Diabetes Type 2"]);
    expect(result.draft.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Condition", value: "Hypertension" }),
        expect.objectContaining({ label: "Condition", value: "Diabetes Type 2" }),
      ]),
    );
  });

  it("parses medication transcripts into a structured draft", () => {
    const result = parseProfileVoiceTranscript(
      "medications",
      "I take metformin 500mg morning and evening",
    );

    expect(result.type).toBe("draft");
    if (result.type !== "draft") return;
    expect(result.draft.kind).toBe("medications");
    expect(result.draft.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Medication", value: "Metformin" }),
        expect.objectContaining({ label: "Strength", value: "500mg" }),
        expect.objectContaining({ label: "Routine", value: "morning and evening" }),
      ]),
    );
  });

  it("parses allergies transcripts and incoming parsed values into the same draft contract", () => {
    expect(createAllergiesVoiceDraft(["Penicillin", "penicillin", "Latex"])?.values).toEqual([
      "Penicillin",
      "Latex",
    ]);

    const result = parseProfileVoiceTranscript(
      "allergies",
      "I am allergic to peanuts and shellfish",
    );

    expect(result.type).toBe("draft");
    if (result.type !== "draft") return;
    expect(result.draft.values).toEqual(["Peanuts", "Shellfish"]);
  });

  it("recognises correction commands and removes matching draft rows", () => {
    const draftResult = parseProfileVoiceTranscript(
      "allergies",
      "I am allergic to peanuts and shellfish",
    );
    expect(draftResult.type).toBe("draft");
    if (draftResult.type !== "draft") return;

    const command = parseProfileVoiceCommand("allergies", "remove peanuts");
    expect(command).toEqual({ section: "allergies", kind: "remove", target: "peanuts" });
    if (!command) return;

    const corrected = applyProfileVoiceCorrection(draftResult.draft, command);
    expect(corrected?.values).toEqual(["Shellfish"]);
  });

  it("recognises try again and skip commands as non-writing actions", () => {
    expect(parseProfileVoiceTranscript("health", "try again")).toEqual({
      type: "command",
      command: { section: "health", kind: "try-again" },
    });
    expect(parseProfileVoiceTranscript("medications", "skip this")).toEqual({
      type: "command",
      command: { section: "medications", kind: "skip" },
    });
  });
});
