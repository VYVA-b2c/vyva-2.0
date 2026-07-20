import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const launchRunScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-launch-evidence-run.ts",
);

function runLaunchEvidencePlan(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, launchRunScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function dateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

describe("Voice Canvas launch evidence run helper command", () => {
  it("prints copy-safe help for one-date launch evidence bundles", () => {
    const result = runLaunchEvidencePlan(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("npm run canvas:qa:run");
    expect(result.stdout).toContain("--date=YYYY-MM-DD");
    expect(result.stdout).toContain("Use one run date");
    expect(result.stdout).toContain("performs no network calls");
    expect(result.stdout).toContain("Do not paste addresses");
  });

  it("prints human-readable same-date commands for the full launch evidence run", () => {
    const runDate = dateDaysAgo(0);
    const result = runLaunchEvidencePlan([
      `--date=${runDate}`,
      "--base-url=https://staging.vyva.app",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Voice Canvas launch evidence run plan");
    expect(result.stdout).toContain(`Run date: ${runDate}`);
    expect(result.stdout).toContain(
      `artifacts/voice-canvas/${runDate}-feature-endpoints-enabled.json`,
    );
    expect(result.stdout).toContain(
      `artifacts/voice-canvas/${runDate}-feature-endpoints-rollback-disabled.json`,
    );
    expect(result.stdout).toContain(
      `artifacts/voice-canvas/${runDate}-rollback-owner-handoff.md`,
    );
    expect(result.stdout).toContain(
      `artifacts/voice-canvas/${runDate}-launch-preflight.json`,
    );
    expect(result.stdout).toContain("Run final preflight with the same run-date artifact paths.");
    expect(result.stdout).not.toContain("YYYY-MM-DD");
  });

  it("emits machine-readable run plans without personal evidence fields", () => {
    const runDate = dateDaysAgo(1);
    const result = runLaunchEvidencePlan([
      `--date=${runDate}`,
      "--base-url=https://staging.vyva.app",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      readyForEvidenceRun: boolean;
      runDate: string;
      baseUrl: string;
      artifactPaths: Record<string, string>;
      commands: string[];
      flowCoverage: Array<{ id: string; label: string; fallback: string }>;
      privacyBoundary: string[];
      sameRunDateRequired: boolean;
    };

    expect(summary.readyForEvidenceRun).toBe(true);
    expect(summary.runDate).toBe(runDate);
    expect(summary.baseUrl).toBe("https://staging.vyva.app");
    expect(summary.sameRunDateRequired).toBe(true);
    expect(Object.values(summary.artifactPaths).every((value) => value.includes(runDate))).toBe(
      true,
    );
    expect(summary.commands).toHaveLength(12);
    expect(summary.commands[0]).toBe(
      `npm run --silent canvas:qa:run -- --date=${runDate} --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/${runDate}-launch-evidence-run.json`,
    );
    expect(summary.commands.join("\n")).toContain(
      `--features-enabled=artifacts/voice-canvas/${runDate}-feature-endpoints-enabled.json`,
    );
    expect(summary.commands.join("\n")).toContain(
      `--final --run-plan=artifacts/voice-canvas/${runDate}-launch-evidence-run.json`,
    );
    expect(summary.flowCoverage.map((flow) => flow.id)).toEqual([
      "ride",
      "appointment",
      "refill",
      "shopping",
      "provider_reply",
      "task_hub_resume",
    ]);
    expect(summary.privacyBoundary.join(" ")).toContain("No addresses");
    expect(summary.privacyBoundary.join(" ")).toContain("aggregate counts");
  });

  it("rejects future, stale, and local launch evidence run plans by default", () => {
    const future = runLaunchEvidencePlan([
      `--date=${dateDaysFromNow(1)}`,
      "--base-url=https://staging.vyva.app",
      "--json",
    ]);
    const stale = runLaunchEvidencePlan([
      `--date=${dateDaysAgo(8)}`,
      "--base-url=https://staging.vyva.app",
      "--json",
    ]);
    const local = runLaunchEvidencePlan([
      `--date=${dateDaysAgo(0)}`,
      "--base-url=http://localhost:3000",
      "--json",
    ]);

    expect(future.status).toBe(1);
    expect(JSON.parse(future.stdout).problems).toContain(
      "Launch evidence run date cannot be in the future.",
    );
    expect(stale.status).toBe(1);
    expect(JSON.parse(stale.stdout).problems).toContain(
      "Launch evidence run date must be no older than 7 days.",
    );
    expect(local.status).toBe(1);
    expect(JSON.parse(local.stdout).problems).toContain(
      "Launch evidence base URL must be a deployed non-local origin unless --allow-local is set.",
    );
  });

  it("saves JSON run plans without overwriting existing artifacts by default", () => {
    const runDate = dateDaysAgo(0);
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-launch-run-"));
    const outputPath = path.join(tempDir, "launch-evidence-run.json");

    try {
      const first = runLaunchEvidencePlan([
        `--date=${runDate}`,
        "--base-url=https://staging.vyva.app",
        "--json",
        `--output=${outputPath}`,
      ]);
      const second = runLaunchEvidencePlan([
        `--date=${runDate}`,
        "--base-url=https://staging.vyva.app",
        "--json",
        `--output=${outputPath}`,
      ]);

      expect(first.status).toBe(0);
      expect(first.stderr).toBe("");
      expect(existsSync(outputPath)).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, "utf8")).runDate).toBe(runDate);
      expect(second.status).toBe(1);
      expect(second.stderr).toContain("Output file already exists");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
