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
});
