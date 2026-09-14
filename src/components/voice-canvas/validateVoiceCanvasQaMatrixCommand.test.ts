import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  it("prints copy-safe help for run-specific JSON artifacts", () => {
    const result = runValidator(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json",
    );
    expect(result.stdout).toContain("pass --force only when intentionally");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(
      `--output=artifacts/voice-canvas/${unsafeDatePlaceholder}-qa-summary.json`,
    );
  });

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
      "- Entry surface coverage: 18 pending cell(s) across 6 row(s)",
    );
    expect(result.stdout).toContain(
      "- Required behavior checklist: 78 pending cell(s) across 6 row(s)",
    );
    expect(result.stdout).toContain(
      "Next evidence area: Required behavior checklist (78 pending cell(s) across 6 row(s))",
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
      "- Evidence artifact inventory: 42 pending cell(s) across 14 row(s)",
    );
    expect(result.stdout).toContain(
      "- Entry surface coverage: 18 pending cell(s) across 6 row(s)",
    );
    expect(result.stdout).toContain(
      "Next evidence area: Required behavior checklist (78 pending cell(s) across 6 row(s))",
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
      nextPendingSection: {
        section: string;
        pendingCells: number;
        rowsWithPending: number;
      };
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
    expect(summary.incompleteCellCount).toBe(313);
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
          section: "Entry surface coverage",
          pendingCells: 18,
          rowsWithPending: 6,
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
    expect(summary.nextPendingSection).toEqual({
      section: "Required behavior checklist",
      pendingCells: 78,
      rowsWithPending: 6,
    });
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
      nextPendingSection: {
        section: string;
        pendingCells: number;
        rowsWithPending: number;
      };
    };

    expect(summary.readyForLaunch).toBe(false);
    expect(summary.acceptedPending).toBe(false);
    expect(summary.pendingSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "Entry surface coverage",
          pendingCells: 18,
        }),
        expect.objectContaining({
          section: "Evidence artifact inventory",
          pendingCells: 42,
        }),
      ]),
    );
    expect(summary.nextPendingSection).toEqual({
      section: "Required behavior checklist",
      pendingCells: 78,
      rowsWithPending: 6,
    });
    expect(summary.message).toBe(
      "Matrix is still pending execution. Fill every row, attach sanitized evidence, and change Status to ready for launch.",
    );
  });

  it("saves machine-readable JSON to an explicit QA artifact path", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-qa-"));
    const outputPath = path.join(tempDir, "qa-summary.json");

    try {
      const result = runValidator([
        "--allow-pending",
        "--json",
        `--output=${outputPath}`,
      ]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(existsSync(outputPath)).toBe(true);

      const stdoutSummary = JSON.parse(result.stdout) as {
        status: string;
        acceptedPending: boolean;
      };
      const fileSummary = JSON.parse(readFileSync(outputPath, "utf8")) as {
        status: string;
        acceptedPending: boolean;
      };

      expect(fileSummary).toEqual(stdoutSummary);
      expect(fileSummary.status).toBe("pending execution");
      expect(fileSummary.acceptedPending).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects output paths outside JSON mode", () => {
    const result = runValidator(["--allow-pending", "--output=qa-summary.json"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use --output only with --json.");
  });

  it("preserves existing QA artifact files unless force is explicit", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-qa-"));
    const outputPath = path.join(tempDir, "qa-summary.json");
    writeFileSync(outputPath, '{"existing":true}\n');

    try {
      const result = runValidator([
        "--allow-pending",
        "--json",
        `--output=${outputPath}`,
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Output file already exists.");
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual({
        existing: true,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("overwrites an existing QA artifact only when force is explicit", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-qa-"));
    const outputPath = path.join(tempDir, "qa-summary.json");
    writeFileSync(outputPath, '{"existing":true}\n');

    try {
      const result = runValidator([
        "--allow-pending",
        "--json",
        "--force",
        `--output=${outputPath}`,
      ]);

      expect(result.status).toBe(0);

      const fileSummary = JSON.parse(readFileSync(outputPath, "utf8")) as {
        status: string;
        acceptedPending: boolean;
      };
      expect(fileSummary.status).toBe("pending execution");
      expect(fileSummary.acceptedPending).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
