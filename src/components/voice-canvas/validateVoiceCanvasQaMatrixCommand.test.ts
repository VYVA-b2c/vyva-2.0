import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const validatorScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-qa-matrix.ts",
);

function runValidator(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, validatorScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("Voice Canvas QA matrix validator command", () => {
  it("passes the committed pending matrix only in explicit pending-review mode", () => {
    const result = runValidator(["--allow-pending"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Status: pending execution");
    expect(result.stdout).toContain("Ready for launch: no");
    expect(result.stdout).toContain("Pending cells by section:");
    expect(result.stdout).toContain(
      "- Environment record: 8 pending cell(s) across 8 row(s)",
    );
    expect(result.stdout).toContain(
      "- Required behavior checklist: 78 pending cell(s) across 6 row(s)",
    );
    expect(result.stdout).toContain(
      "- Final sign-off: 16 pending cell(s) across 4 row(s)",
    );
    expect(result.stdout).toContain(
      "Matrix is still pending execution, but its structure is valid.",
    );
  });

  it("fails the committed pending matrix as a final launch gate", () => {
    const result = runValidator();

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Status: pending execution");
    expect(result.stdout).toContain("Ready for launch: no");
    expect(result.stdout).toContain("Pending cells by section:");
    expect(result.stdout).toContain(
      "- Evidence artifact inventory: 27 pending cell(s) across 9 row(s)",
    );
    expect(result.stderr).toContain(
      "Matrix is still pending execution. Fill every row, attach sanitized evidence, and change Status to ready for launch.",
    );
  });

  it("emits machine-readable JSON for pending-review QA artifacts", () => {
    const result = runValidator(["--allow-pending", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      matrixPath: string;
      status: string;
      state: string;
      readyForLaunch: boolean;
      incompleteCellCount: number;
      failingCellCount: number;
      pendingSections: Array<{
        section: string;
        pendingCells: number;
        rowsWithPending: number;
      }>;
      problemCount: number;
      problems: string[];
      allowPending: boolean;
      acceptedPending: boolean;
      message: string;
    };

    expect(summary.matrixPath).toContain("voice-canvas-real-device-qa-matrix.md");
    expect(summary.status).toBe("pending execution");
    expect(summary.state).toBe("pending");
    expect(summary.readyForLaunch).toBe(false);
    expect(summary.incompleteCellCount).toBe(280);
    expect(summary.failingCellCount).toBe(0);
    expect(summary.problemCount).toBe(0);
    expect(summary.problems).toEqual([]);
    expect(summary.allowPending).toBe(true);
    expect(summary.acceptedPending).toBe(true);
    expect(summary.pendingSections).toEqual(
      expect.arrayContaining([
        {
          section: "Environment record",
          pendingCells: 8,
          rowsWithPending: 8,
        },
        {
          section: "Required behavior checklist",
          pendingCells: 78,
          rowsWithPending: 6,
        },
        {
          section: "Final sign-off",
          pendingCells: 16,
          rowsWithPending: 4,
        },
      ]),
    );
    expect(summary.message).toBe(
      "Matrix is still pending execution, but its structure is valid.",
    );
  });

  it("keeps final-gate JSON parseable when the pending matrix fails launch", () => {
    const result = runValidator(["--json"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      readyForLaunch: boolean;
      acceptedPending: boolean;
      message: string;
      pendingSections: Array<{ section: string; pendingCells: number }>;
    };

    expect(summary.readyForLaunch).toBe(false);
    expect(summary.acceptedPending).toBe(false);
    expect(summary.pendingSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "Evidence artifact inventory",
          pendingCells: 27,
        }),
      ]),
    );
    expect(summary.message).toBe(
      "Matrix is still pending execution. Fill every row, attach sanitized evidence, and change Status to ready for launch.",
    );
  });
});
