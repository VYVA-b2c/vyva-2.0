import { describe, expect, it } from "vitest";
import {
  computeFaceNameScore,
  getFaceNameDistractorCount,
  getFaceNameFaceCount,
  getFaceNameRecallModes,
  getFaceNameStudySeconds,
} from "./faceNameLogic";

describe("face-name match logic", () => {
  it("scales difficulty by tier", () => {
    expect(getFaceNameFaceCount(1)).toBe(4);
    expect(getFaceNameFaceCount(5)).toBe(6);
    expect(getFaceNameFaceCount(10)).toBe(8);
    expect(getFaceNameStudySeconds(1)).toBe(45);
    expect(getFaceNameStudySeconds(10)).toBe(25);
    expect(getFaceNameDistractorCount(2)).toBe(0);
    expect(getFaceNameDistractorCount(3)).toBe(1);
    expect(getFaceNameDistractorCount(8)).toBe(2);
  });

  it("uses name-to-face only for early tiers", () => {
    expect(getFaceNameRecallModes(1)).toEqual(["name_to_face"]);
    expect(getFaceNameRecallModes(5)).toEqual(["name_to_face", "face_to_name"]);
    expect(getFaceNameRecallModes(10)).toEqual(["name_to_face", "face_to_name", "face_to_name"]);
  });

  it("scores early tiers on the full 1000 point range", () => {
    const result = computeFaceNameScore(
      [
        { persona_id: "a", mode: "name_to_face", correct: true },
        { persona_id: "b", mode: "name_to_face", correct: false },
        { persona_id: "c", mode: "name_to_face", correct: true },
        { persona_id: "d", mode: "name_to_face", correct: true },
      ],
      4,
      ["name_to_face"],
    );

    expect(result.n2fCorrect).toBe(3);
    expect(result.f2nAttempts).toBe(0);
    expect(result.overallAccuracyPct).toBe(75);
    expect(result.score).toBe(750);
  });

  it("splits score between recognition and free recall when both modes are present", () => {
    const result = computeFaceNameScore(
      [
        { persona_id: "a", mode: "name_to_face", correct: true },
        { persona_id: "b", mode: "name_to_face", correct: true },
        { persona_id: "a", mode: "face_to_name", correct: false },
        { persona_id: "b", mode: "face_to_name", correct: true },
      ],
      2,
      ["name_to_face", "face_to_name"],
    );

    expect(result.n2fAccuracyPct).toBe(100);
    expect(result.f2nAccuracyPct).toBe(50);
    expect(result.overallAccuracyPct).toBe(75);
    expect(result.score).toBe(750);
  });
});
