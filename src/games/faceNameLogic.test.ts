import { describe, expect, it } from "vitest";
import {
  computeFaceNameScore,
  FACE_NAME_ADVANCE_ACCURACY,
  selectFreshFaceNameGroup,
  getFaceNameDistractorCount,
  getFaceNameFaceCount,
  getFaceNameRecallModes,
  getFaceNameStudySeconds,
} from "./faceNameLogic";

describe("face-name match logic", () => {
  it("accepts three correct answers out of four for progression", () => {
    expect(FACE_NAME_ADVANCE_ACCURACY).toBe(75);
    expect(100 * 3 / 4).toBeGreaterThanOrEqual(FACE_NAME_ADVANCE_ACCURACY);
    expect(100 * 2 / 4).toBeLessThan(FACE_NAME_ADVANCE_ACCURACY);
  });

  it("replaces people from the previous round without changing their identities", () => {
    const pool = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `Name ${i}` }));
    const previous = pool.slice(0, 4);
    const next = selectFreshFaceNameGroup(pool, 4, previous.map((p) => p.id));
    expect(next.map((p) => p.id)).toEqual(["4", "5", "6", "0"]);
    expect(new Set(next.map((p) => p.id)).size).toBe(4);
    expect(next[0]).toBe(pool[4]);
    expect(selectFreshFaceNameGroup(pool, 4, next.map((p) => p.id)).map((p) => p.id)).not.toEqual(next.map((p) => p.id));
  });
  it("scales difficulty by tier", () => {
    expect(getFaceNameFaceCount(1)).toBe(4);
    expect(getFaceNameFaceCount(5)).toBe(5);
    expect(getFaceNameFaceCount(10)).toBe(6);
    expect(getFaceNameFaceCount(16)).toBe(8);
    expect(getFaceNameStudySeconds()).toBe(10);
    expect(getFaceNameDistractorCount(2)).toBe(0);
    expect(getFaceNameDistractorCount(3)).toBe(1);
    expect(getFaceNameDistractorCount(8)).toBe(2);
    expect(getFaceNameDistractorCount(16)).toBe(3);
  });

  it("uses name-to-face only for early tiers", () => {
    expect(getFaceNameRecallModes(1)).toEqual(["name_to_face"]);
    expect(getFaceNameRecallModes(5)).toEqual(["name_to_face"]);
    expect(getFaceNameRecallModes(6)).toEqual(["name_to_face", "face_to_name"]);
    expect(getFaceNameRecallModes(11)).toEqual(["name_to_face", "face_to_name", "face_to_name"]);
    expect(getFaceNameRecallModes(16)).toEqual(["name_to_face", "face_to_name", "face_to_name", "name_to_face"]);
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
