import { describe, expect, it } from "vitest";
import { isSequenceTileMatch } from "./sequenceScoring";

describe("sequence tile scoring", () => {
  it("matches each visible tile only to the same expected tile", () => {
    [0, 1, 2, 3].forEach((tileIndex) => {
      expect(isSequenceTileMatch(tileIndex, tileIndex)).toBe(true);

      [0, 1, 2, 3]
        .filter((expectedIndex) => expectedIndex !== tileIndex)
        .forEach((expectedIndex) => {
          expect(isSequenceTileMatch(tileIndex, expectedIndex)).toBe(false);
        });
    });
  });

  it("does not accept vertically mirrored taps", () => {
    expect(isSequenceTileMatch(0, 2)).toBe(false);
    expect(isSequenceTileMatch(1, 3)).toBe(false);
    expect(isSequenceTileMatch(2, 0)).toBe(false);
    expect(isSequenceTileMatch(3, 1)).toBe(false);
  });
});
