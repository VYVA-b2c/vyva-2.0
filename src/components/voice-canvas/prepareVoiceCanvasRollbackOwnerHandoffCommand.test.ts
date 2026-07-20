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
import { canvasLaunchReadinessFlows } from "./canvasLaunchReadiness";

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const rollbackOwnerScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-rollback-owner-handoff.ts",
);

const launchFeatureFlows = canvasLaunchReadinessFlows.filter(
  (flow) => flow.featureFlag,
);

function runRollbackOwnerHelper(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, rollbackOwnerScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("Voice Canvas rollback owner handoff helper command", () => {
  it("prints copy-safe help for run-specific rollback owner artifacts", () => {
    const result = runRollbackOwnerHelper(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:rollback-owner -- --template",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
    );
    expect(result.stdout).toContain("Operations/rollback owner sign-off");
    expect(result.stdout).toContain("decision window");
    expect(result.stdout).toContain("rollback trigger");
    expect(result.stdout).toContain("endpoint/fallback/open-session evidence");
    expect(result.stdout).toContain("This helper never calls feature endpoints");
    expect(result.stdout).toContain("pass --force only when intentionally");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(unsafeDatePlaceholder);
  });

  it("prints a manifest-filled copy-safe rollback owner handoff template", () => {
    const result = runRollbackOwnerHelper(["--template"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "# Voice Canvas rollback owner handoff artifact",
    );
    expect(result.stdout).toContain("Operations/rollback owner:");
    expect(result.stdout).toContain("Backup owner:");
    expect(result.stdout).toContain("Decision window:");
    expect(result.stdout).toContain("Rollback trigger:");
    expect(result.stdout).toContain("Rollback action:");
    expect(result.stdout).toContain("Privacy boundary:");
    expect(result.stdout).toContain("Fallback readiness:");
    expect(result.stdout).toContain("Canvas closed or hidden");
    expect(result.stdout).toContain("No-write/no-resubmission/no-external-action");

    for (const flow of launchFeatureFlows) {
      expect(result.stdout, flow.label).toContain(`### ${flow.label}`);
      expect(result.stdout, flow.featureFlag!.endpoint).toContain(
        `- Endpoint: ${flow.featureFlag!.endpoint}`,
      );
      expect(result.stdout, flow.featureFlag!.serverFeatureKey).toContain(
        `- Server key: ${flow.featureFlag!.serverFeatureKey}`,
      );
      expect(result.stdout, flow.featureFlag!.fallback).toContain(
        `- Named fallback path: ${flow.featureFlag!.fallback}`,
      );
    }

    expect(result.stdout).not.toContain("123 Secret Street");
    expect(result.stdout).not.toContain("private spoken detail");
    expect(result.stdout).not.toContain("raw endpoint body:");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(unsafeDatePlaceholder);
  });

  it("saves rollback owner handoff templates without overwriting existing artifacts by default", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-rollback-owner-"));
    const outputPath = path.join(tempDir, "rollback-owner-handoff.md");

    try {
      const firstResult = runRollbackOwnerHelper([
        "--template",
        `--output=${outputPath}`,
      ]);

      expect(firstResult.status).toBe(0);
      expect(firstResult.stdout).toContain(
        "Saved rollback owner handoff template to",
      );
      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath, "utf8")).toContain(
        "Voice Canvas rollback owner handoff artifact",
      );

      writeFileSync(outputPath, "existing artifact\n");
      const secondResult = runRollbackOwnerHelper([
        "--template",
        `--output=${outputPath}`,
      ]);

      expect(secondResult.status).toBe(1);
      expect(secondResult.stderr).toContain("Output file already exists");
      expect(readFileSync(outputPath, "utf8")).toBe("existing artifact\n");

      const forcedResult = runRollbackOwnerHelper([
        "--template",
        `--output=${outputPath}`,
        "--force",
      ]);

      expect(forcedResult.status).toBe(0);
      expect(readFileSync(outputPath, "utf8")).toContain(
        "Operations/rollback owner sign-off",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects output paths unless a template is being generated", () => {
    const result = runRollbackOwnerHelper([
      "--output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --template.");
  });
});
