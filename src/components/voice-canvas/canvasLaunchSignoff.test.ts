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

function replacePendingEvidence(markdown: string): string {
  return markdown.replace(
    /\bPending\b/g,
    "Passed - evidence captured by QA on 2026-07-19",
  );
}

function fillRequiredSignoffs(markdown: string): string {
  return markdown
    .replace(
      /^\| Product \| .* \| .* \| .* \| .* \|$/m,
      "| Product | Priya Product | 2026-07-19 | Approved for launch | Reviewed real-use evidence |",
    )
    .replace(
      /^\| Engineering \| .* \| .* \| .* \| .* \|$/m,
      "| Engineering | Elena Engineering | 2026-07-19 | Approved for launch | Verified rollback and stale guards |",
    )
    .replace(
      /^\| QA \| .* \| .* \| .* \| .* \|$/m,
      "| QA | Quentin QA | 2026-07-19 | Approved for launch | Device matrix complete |",
    )
    .replace(
      /^\| Operations\/rollback owner \| .* \| .* \| .* \| .* \|$/m,
      "| Operations/rollback owner | Omar Ops | 2026-07-19 | Approved for launch | Rollback owner confirmed |",
    );
}

function replaceDeviceRow(markdown: string, flow: string, row: string): string {
  const escapedFlow = flow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.replace(new RegExp(`^\\| ${escapedFlow} \\| .* \\|$`, "m"), row);
}

describe("Canvas real-device QA sign-off", () => {
  it("keeps the committed matrix explicitly pending until deployed QA is recorded", () => {
    const result = evaluateCanvasRealDeviceQaMatrix(realDeviceQaMatrix());

    expect(result.state).toBe("pending");
    expect(result.readyForLaunch).toBe(false);
    expect(result.incompleteCellCount).toBeGreaterThan(0);
    expect(result.failingCellCount).toBe(0);
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

  it("rejects ready-for-launch sign-offs with non-date cells or non-approval decisions", () => {
    const completedWithoutRealSignoffs = replacePendingEvidence(
      markReady(realDeviceQaMatrix()),
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completedWithoutRealSignoffs);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.incompleteCellCount).toBe(0);
    expect(result.invalidRequiredSignoffDateRoles).toEqual([
      "Product",
      "Engineering",
      "QA",
      "Operations/rollback owner",
    ]);
    expect(result.unapprovedRequiredSignoffRoles).toEqual([
      "Product",
      "Engineering",
      "QA",
      "Operations/rollback owner",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("must use YYYY-MM-DD"),
        expect.stringContaining("without an approved-for-launch decision"),
      ]),
    );
  });

  it("rejects ready-for-launch sign-offs that explicitly decline approval", () => {
    const completedMatrix = fillRequiredSignoffs(
      replacePendingEvidence(markReady(realDeviceQaMatrix())),
    ).replace(
      "| Product | Priya Product | 2026-07-19 | Approved for launch | Reviewed real-use evidence |",
      "| Product | Priya Product | 2026-07-19 | Not approved | Found a launch blocker |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completedMatrix);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.unapprovedRequiredSignoffRoles).toEqual(["Product"]);
  });

  it("rejects ready-for-launch matrices with filled but failing QA evidence", () => {
    const completedMatrix = replaceDeviceRow(
      fillRequiredSignoffs(replacePendingEvidence(markReady(realDeviceQaMatrix()))),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Failed - phone lost restored draft | Passed - evidence captured by QA on 2026-07-19 | Passed - evidence captured by QA on 2026-07-19 | Screenshot and replay attached |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completedMatrix);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.incompleteCellCount).toBe(0);
    expect(result.failingCellCount).toBe(1);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("failing or not-ready QA cell"),
      ]),
    );
  });

  it("accepts the matrix only after all required evidence and sign-offs are filled", () => {
    const completedMatrix = fillRequiredSignoffs(
      replacePendingEvidence(markReady(realDeviceQaMatrix())),
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completedMatrix);

    expect(result.state).toBe("ready");
    expect(result.readyForLaunch).toBe(true);
    expect(result.incompleteCellCount).toBe(0);
    expect(result.failingCellCount).toBe(0);
    expect(result.missingRequiredSignoffRoles).toEqual([]);
    expect(result.incompleteRequiredSignoffRoles).toEqual([]);
    expect(result.invalidRequiredSignoffDateRoles).toEqual([]);
    expect(result.unapprovedRequiredSignoffRoles).toEqual([]);
    expect(result.problems).toEqual([]);
  });
});
