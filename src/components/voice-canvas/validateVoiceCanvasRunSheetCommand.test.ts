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
  "validate-voice-canvas-run-sheet.ts",
);
const runSheetPath = path.resolve(
  process.cwd(),
  "docs",
  "audits",
  "voice-canvas-real-device-run-sheet.md",
);

function runValidator(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, validatorScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function committedRunSheet(): string {
  return readFileSync(runSheetPath, "utf8");
}

function completedRunSheet(): string {
  return committedRunSheet().replace(
    /\bPending\b/g,
    "Sanitized QA artifact evidence reviewed by QA on 2026-07-19: real device behavior, rollback, analytics, no personal details, no write, and no external action verified",
  );
}

function genericCompletedRunSheet(): string {
  return committedRunSheet().replace(/\bPending\b/g, "Passed by QA on 2026-07-19");
}

function withTempRunSheet<T>(
  markdown: string,
  callback: (tempRunSheetPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-runsheet-"));
  const tempRunSheetPath = path.join(tempDir, "run-sheet.md");
  writeFileSync(tempRunSheetPath, markdown);

  try {
    return callback(tempRunSheetPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas run sheet validator command", () => {
  it("prints copy-safe help for run-specific run sheet artifacts", () => {
    const result = runValidator(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-run-sheet-summary.json",
    );
    expect(result.stdout).toContain("privacy guardrails");
    expect(result.stdout).toContain("flow/device rows");
    expect(result.stdout).toContain("generic pass/done/OK text is rejected");
    expect(result.stdout).toContain("street-address-shaped text");
    expect(result.stdout).toContain("pass --force only when intentionally");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(
      `--output=artifacts/voice-canvas/${unsafeDatePlaceholder}-run-sheet-summary.json`,
    );
  });

  it("passes the committed pending run sheet only in explicit pending-review mode", () => {
    const result = runValidator(["--allow-pending"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("State: pending");
    expect(result.stdout).toContain("Ready for QA matrix sign-off: no");
    expect(result.stdout).toContain("Incomplete cells: 260");
    expect(result.stdout).toContain(
      "- Per-flow behavior pass: 180 pending cell(s) across 18 row(s)",
    );
    expect(result.stdout).toContain(
      "Run sheet is still pending, but its structure is valid.",
    );
  });

  it("fails the committed pending run sheet as a final launch gate", () => {
    const result = runValidator();

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("State: pending");
    expect(result.stderr).toContain(
      "Run sheet is still pending. Complete the staging execution rows before final launch sign-off.",
    );
  });

  it("emits machine-readable JSON for pending-review run sheet artifacts", () => {
    const result = runValidator(["--allow-pending", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      state: string;
      readyForQaRunSheet: boolean;
      incompleteCellCount: number;
      problemCount: number;
      acceptedPending: boolean;
      pendingSections: Array<{ section: string; pendingCells: number }>;
    };

    expect(summary.state).toBe("pending");
    expect(summary.readyForQaRunSheet).toBe(false);
    expect(summary.incompleteCellCount).toBe(260);
    expect(summary.problemCount).toBe(0);
    expect(summary.acceptedPending).toBe(true);
    expect(summary.pendingSections).toEqual(
      expect.arrayContaining([
        {
          section: "Environment preflight",
          pendingCells: 12,
          rowsWithPending: 6,
        },
      ]),
    );
  });

  it("passes a completed run sheet", () =>
    withTempRunSheet(completedRunSheet(), (tempRunSheetPath) => {
      const result = runValidator([tempRunSheetPath, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        state: string;
        readyForQaRunSheet: boolean;
        incompleteCellCount: number;
        problems: string[];
      };

      expect(summary.state).toBe("ready");
      expect(summary.readyForQaRunSheet).toBe(true);
      expect(summary.incompleteCellCount).toBe(0);
      expect(summary.problems).toEqual([]);
    }));

  it("rejects run sheets with literal personal data without echoing values", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        "Sanitized QA artifact evidence reviewed by QA on 2026-07-19: real device behavior, rollback, analytics, no personal details, no write, and no external action verified",
        "Sanitized QA artifact evidence reviewed by QA on 2026-07-19: screenshot includes 123 Secret Street and qa-person@example.com",
      ),
      (tempRunSheetPath) => {
        const result = runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining("literal personal data"),
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("123 Secret Street");
        expect(serialized).not.toContain("qa-person@example.com");
      },
    ));

  it("rejects completed run sheets with generic pass-only cells", () =>
    withTempRunSheet(genericCompletedRunSheet(), (tempRunSheetPath) => {
      const result = runValidator([tempRunSheetPath, "--json"]);

      expect(result.status).toBe(1);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        state: string;
        readyForQaRunSheet: boolean;
        problems: string[];
      };

      expect(summary.state).toBe("invalid");
      expect(summary.readyForQaRunSheet).toBe(false);
      expect(summary.problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining("filled cell(s) with generic pass text"),
        ]),
      );
    }));

  it("rejects run sheets that omit required behavior coverage", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        "Duplicate prevented and stale response ignored",
        "Duplicate check",
      ),
      (tempRunSheetPath) => {
        const result = runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toContain(
          "Per-flow behavior pass is missing required launch-readiness coverage.",
        );
      },
    ));

  it("saves validation JSON while preserving existing artifacts by default", () =>
    withTempRunSheet(completedRunSheet(), (tempRunSheetPath) => {
      const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-runsheet-out-"));
      const outputPath = path.join(tempDir, "run-sheet-summary.json");

      try {
        const first = runValidator([
          tempRunSheetPath,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(first.status).toBe(0);
        expect(first.stderr).toBe("");
        expect(existsSync(outputPath)).toBe(true);
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(
          JSON.parse(first.stdout),
        );

        writeFileSync(outputPath, '{"existing":true}\n');
        const preserved = runValidator([
          tempRunSheetPath,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(preserved.status).toBe(1);
        expect(preserved.stderr).toContain("Output file already exists.");
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual({
          existing: true,
        });

        const forced = runValidator([
          tempRunSheetPath,
          "--json",
          "--force",
          `--output=${outputPath}`,
        ]);

        expect(forced.status).toBe(0);
        expect(JSON.parse(readFileSync(outputPath, "utf8")).readyForQaRunSheet).toBe(
          true,
        );
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }));

  it("rejects output paths outside JSON mode", () => {
    const result = runValidator([
      "--allow-pending",
      "--output=run-sheet-summary.json",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use --output only with --json.");
  });
});
