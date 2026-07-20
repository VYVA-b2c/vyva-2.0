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
const preflightScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "preflight-voice-canvas-launch-readiness.ts",
);

function runPreflight(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, preflightScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("Voice Canvas launch readiness preflight command", () => {
  it("prints a copy-safe preflight runbook", () => {
    const result = runPreflight(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("npm run canvas:qa:preflight -- --final");
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:preflight -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
    );
    expect(result.stdout).toContain("This preflight is read-only");
    expect(result.stdout).not.toContain("<YYYY-MM-DD>");
  });

  it("accepts the committed pending launch gates as a structural preflight", () => {
    const result = runPreflight();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Voice Canvas launch QA preflight");
    expect(result.stdout).toContain("Final gate mode: no");
    expect(result.stdout).toContain("Ready for launch: no");
    expect(result.stdout).toContain(
      "QA matrix: pending; incomplete 280; failing/not-ready 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Evidence packet: pending; incomplete 9; problems 0",
    );
    expect(result.stdout).toContain(
      "Execute real-device and deployed rollback QA, then fill the QA matrix.",
    );
    expect(result.stdout).toContain(
      "Voice Canvas launch evidence gates are structurally valid but still pending real-device QA.",
    );
  });

  it("fails final gate mode while real-device evidence is pending", () => {
    const result = runPreflight(["--final"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Final gate mode: yes");
    expect(result.stdout).toContain("Ready for launch: no");
    expect(result.stdout).toContain(
      "Fill the sanitized evidence packet artifact references and reviewer/date cells.",
    );
    expect(result.stdout).toContain(
      "Execute real-device and deployed rollback QA, then fill the QA matrix.",
    );
  });

  it("emits machine-readable JSON for launch readiness artifacts", () => {
    const result = runPreflight(["--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      readyForLaunch: boolean;
      finalGate: boolean;
      acceptedPending: boolean;
      matrix: {
        state: string;
        incompleteCellCount: number;
        failingCellCount: number;
        problemCount: number;
      };
      evidencePacket: {
        state: string;
        incompleteCellCount: number;
        problemCount: number;
      };
      nextActions: string[];
      message: string;
    };

    expect(summary.readyForLaunch).toBe(false);
    expect(summary.finalGate).toBe(false);
    expect(summary.acceptedPending).toBe(true);
    expect(summary.matrix).toMatchObject({
      state: "pending",
      incompleteCellCount: 280,
      failingCellCount: 0,
      problemCount: 0,
    });
    expect(summary.evidencePacket).toMatchObject({
      state: "pending",
      incompleteCellCount: 9,
      problemCount: 0,
    });
    expect(summary.nextActions).toEqual(
      expect.arrayContaining([
        "Fill the sanitized evidence packet artifact references and reviewer/date cells.",
        "Execute real-device and deployed rollback QA, then fill the QA matrix.",
      ]),
    );
    expect(summary.message).toBe(
      "Voice Canvas launch evidence gates are structurally valid but still pending real-device QA.",
    );
  });

  it("saves JSON summaries while preserving existing artifacts by default", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-"));
    const outputPath = path.join(tempDir, "launch-preflight.json");

    try {
      const first = runPreflight(["--json", `--output=${outputPath}`]);

      expect(first.status).toBe(0);
      expect(first.stderr).toBe("");
      expect(existsSync(outputPath)).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(
        JSON.parse(first.stdout),
      );

      writeFileSync(outputPath, '{"existing":true}\n');
      const preserved = runPreflight(["--json", `--output=${outputPath}`]);

      expect(preserved.status).toBe(1);
      expect(preserved.stderr).toContain("Output file already exists.");
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual({
        existing: true,
      });

      const forced = runPreflight([
        "--json",
        "--force",
        `--output=${outputPath}`,
      ]);

      expect(forced.status).toBe(0);
      expect(JSON.parse(readFileSync(outputPath, "utf8")).acceptedPending).toBe(
        true,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects output paths outside JSON mode", () => {
    const result = runPreflight(["--output=launch-preflight.json"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use --output only with --json.");
  });
});
