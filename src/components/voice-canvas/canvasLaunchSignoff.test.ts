import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANVAS_REAL_DEVICE_QA_READY_STATUS,
  evaluateCanvasRealDeviceQaMatrix,
} from "./canvasLaunchSignoff";

const realDeviceQaMatrixPath =
  "docs/audits/voice-canvas-real-device-qa-matrix.md";

function realDeviceQaMatrix(): string {
  return readFileSync(path.resolve(process.cwd(), realDeviceQaMatrixPath), "utf8");
}

function markReady(markdown: string): string {
  return markdown.replace(
    /^Status:\s*\*\*[^*]+\*\*/m,
    `Status: **${CANVAS_REAL_DEVICE_QA_READY_STATUS}**`,
  );
}

describe("Canvas real-device QA sign-off", () => {
  it("keeps the committed matrix explicitly pending until deployed QA is recorded", () => {
    const result = evaluateCanvasRealDeviceQaMatrix(realDeviceQaMatrix());

    expect(result.state).toBe("pending");
    expect(result.readyForLaunch).toBe(false);
    expect(result.incompleteCellCount).toBeGreaterThan(0);
    expect(result.problems).toEqual([]);
  });

  it("rejects a premature ready-for-launch status while placeholders remain", () => {
    const result = evaluateCanvasRealDeviceQaMatrix(markReady(realDeviceQaMatrix()));

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("still contains"),
        expect.stringContaining("incomplete required sign-off"),
      ]),
    );
  });

  it("accepts the matrix only after all required evidence and sign-offs are filled", () => {
    const completedMatrix = markReady(realDeviceQaMatrix()).replace(
      /\bPending\b/g,
      "Passed - evidence captured by QA on 2026-07-19",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completedMatrix);

    expect(result.state).toBe("ready");
    expect(result.readyForLaunch).toBe(true);
    expect(result.incompleteCellCount).toBe(0);
    expect(result.missingRequiredSignoffRoles).toEqual([]);
    expect(result.incompleteRequiredSignoffRoles).toEqual([]);
    expect(result.problems).toEqual([]);
  });
});
