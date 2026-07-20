import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANVAS_LAUNCH_QA_GATES } from "./canvasLaunchReadiness";

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
    expect(result.stdout).toContain("--request-header-env=Header-Name:ENV_NAME");
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
      `artifacts/voice-canvas/${runDate}-copy-clarity.md`,
    );
    expect(result.stdout).toContain(
      `artifacts/voice-canvas/${runDate}-recovery-behavior.md`,
    );
    expect(result.stdout).toContain(
      `artifacts/voice-canvas/${runDate}-real-use-coverage.md`,
    );
    expect(result.stdout).toContain(
      `artifacts/voice-canvas/${runDate}-entry-surfaces.md`,
    );
    expect(result.stdout).toContain(
      `artifacts/voice-canvas/${runDate}-launch-preflight.json`,
    );
    expect(result.stdout).toContain(
      "Execute every flow on real phone, tablet, and desktop/laptop sessions using voice, touch, and keyboard paths.",
    );
    expect(result.stdout).toContain(
      "Fill real-use evidence from real physical phone, tablet, desktop/laptop, voice, touch, and keyboard coverage.",
    );
    expect(result.stdout).toContain(
      "Fill copy clarity evidence from senior-friendly copy, what-happens-next, long-label, focus, announcement, and reduced-motion review.",
    );
    expect(result.stdout).toContain(
      "Fill recovery behavior evidence from resume, refresh, back, reconnect, interruption, cancel, retry, duplicate, and stale-response coverage.",
    );
    expect(result.stdout).toContain(
      "Fill entry surface evidence from every canonical launch surface without writes or external actions before confirmation.",
    );
    expect(result.stdout).toContain(
      "Fill rollback owner handoff with deployed QA run URL, owner, backup, decision window, trigger, action, fallback, privacy, and no-side-effect proof.",
    );
    expect(result.stdout).toContain(
      "Verify refresh, browser back, app exit/reopen, reconnect, voice interruption, cancel/exit, retry, and duplicate/stale-response recovery with entered information preserved.",
    );
    expect(result.stdout).toContain(
      "Verify feature-flag rollback closes or hides Canvas in an open session and restores the named existing fallback path without writes or external actions.",
    );
    expect(result.stdout).toContain(
      "Review senior-friendly copy for one clear decision, readable long Spanish labels, waiting/blocked/completed announcements, focus movement, reduced motion, and what-happens-next clarity.",
    );
    expect(result.stdout).toContain("Flow coverage:");
    expect(result.stdout).toContain(
      "Ride Voice Canvas; surfaces voice handoff, /concierge, task hub pending resume",
    );
    expect(result.stdout).toContain(
      "qa gates voice_touch_keyboard, mobile_tablet_desktop",
    );
    expect(result.stdout).toContain("feature /api/config/features/ride-voice-canvas");
    expect(result.stdout).toContain("Run final preflight with the same run-date artifact paths through --date.");
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
      flowCoverage: Array<{
        id: string;
        label: string;
        surfaces: string[];
        qaGates: string[];
        fallback: string;
        featureFlag: {
          endpoint: string;
          serverFeatureKey: string;
          enableEnv: string;
          rolloutEnv: string;
        } | null;
        telemetryEvent: string | null;
      }>;
      requestHeaderEnv: string[];
      authenticatedRequest: boolean;
      checklist: string[];
      privacyBoundary: string[];
      sameRunDateRequired: boolean;
    };

    expect(summary.readyForEvidenceRun).toBe(true);
    expect(summary.runDate).toBe(runDate);
    expect(summary.baseUrl).toBe("https://staging.vyva.app");
    expect(summary.sameRunDateRequired).toBe(true);
    expect(summary.requestHeaderEnv).toEqual([]);
    expect(summary.authenticatedRequest).toBe(false);
    expect(Object.values(summary.artifactPaths).every((value) => value.includes(runDate))).toBe(
      true,
    );
    expect(summary.commands).toHaveLength(20);
    expect(summary.commands[0]).toBe(
      `npm run --silent canvas:qa:run -- --date=${runDate} --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/${runDate}-launch-evidence-run.json`,
    );
    expect(summary.commands.join("\n")).toContain(
      `artifacts/voice-canvas/${runDate}-feature-endpoints-enabled.json`,
    );
    expect(summary.commands.join("\n")).toContain(
      `artifacts/voice-canvas/${runDate}-copy-clarity.md`,
    );
    expect(summary.commands.join("\n")).toContain(
      `artifacts/voice-canvas/${runDate}-recovery-behavior.md`,
    );
    expect(summary.commands.join("\n")).toContain(
      `artifacts/voice-canvas/${runDate}-real-use-coverage.md`,
    );
    expect(summary.commands.join("\n")).toContain(
      `artifacts/voice-canvas/${runDate}-entry-surfaces.md`,
    );
    expect(summary.commands.join("\n")).toContain(
      `--final --date=${runDate}`,
    );
    expect(summary.flowCoverage.map((flow) => flow.id)).toEqual([
      "ride",
      "appointment",
      "refill",
      "shopping",
      "provider_reply",
      "task_hub_resume",
    ]);
    expect(summary.flowCoverage[0]).toMatchObject({
      id: "ride",
      label: "Ride Voice Canvas",
      surfaces: ["voice handoff", "/concierge", "task hub pending resume"],
      qaGates: [...CANVAS_LAUNCH_QA_GATES],
      fallback: "Existing Concierge transport panel",
      featureFlag: {
        endpoint: "/api/config/features/ride-voice-canvas",
        serverFeatureKey: "ride",
        enableEnv: "VYVA_ENABLE_RIDE_VOICE_CANVAS",
        rolloutEnv: "VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT",
      },
      telemetryEvent: "vyva:ride-canvas-telemetry",
    });
    expect(summary.flowCoverage.at(-1)).toMatchObject({
      id: "task_hub_resume",
      surfaces: ["/concierge/tasks", "/concierge/tasks/:taskKey", "home resume card"],
      featureFlag: null,
      telemetryEvent: null,
    });
    expect(summary.checklist.join(" ")).toContain(
      "real phone, tablet, and desktop/laptop sessions using voice, touch, and keyboard paths",
    );
    expect(summary.checklist.join(" ")).toContain(
      "copy clarity evidence from senior-friendly copy, what-happens-next, long-label",
    );
    expect(summary.checklist.join(" ")).toContain(
      "recovery behavior evidence from resume, refresh, back, reconnect, interruption, cancel, retry, duplicate, and stale-response coverage",
    );
    expect(summary.checklist.join(" ")).toContain(
      "real-use evidence from real physical phone, tablet, desktop/laptop, voice, touch, and keyboard coverage",
    );
    expect(summary.checklist.join(" ")).toContain(
      "entry surface evidence from every canonical launch surface",
    );
    expect(summary.checklist.join(" ")).toContain(
      "rollback owner handoff with deployed QA run URL, owner, backup",
    );
    expect(summary.checklist.join(" ")).toContain(
      "refresh, browser back, app exit/reopen, reconnect, voice interruption, cancel/exit, retry, and duplicate/stale-response recovery",
    );
    expect(summary.checklist.join(" ")).toContain(
      "feature-flag rollback closes or hides Canvas in an open session",
    );
    expect(summary.checklist.join(" ")).toContain(
      "one clear decision, readable long Spanish labels, waiting/blocked/completed announcements",
    );
    expect(summary.privacyBoundary.join(" ")).toContain("No addresses");
    expect(summary.privacyBoundary.join(" ")).toContain("aggregate counts");
  });

  it("emits authenticated QA gateway header references without credential values", () => {
    const runDate = dateDaysAgo(0);
    const secret = "qa-preview-secret-value";
    const result = runLaunchEvidencePlan([
      `--date=${runDate}`,
      "--base-url=https://v2.vyva.life",
      "--request-header-env=x-qa-preview-bypass:VYVA_QA_PREVIEW_BYPASS",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      baseUrl: string;
      requestHeaderEnv: string[];
      authenticatedRequest: boolean;
      commands: string[];
    };

    expect(summary.baseUrl).toBe("https://v2.vyva.life");
    expect(summary.requestHeaderEnv).toEqual([
      "x-qa-preview-bypass:VYVA_QA_PREVIEW_BYPASS",
    ]);
    expect(summary.authenticatedRequest).toBe(true);
    expect(summary.commands[0]).toContain(
      "--request-header-env=x-qa-preview-bypass:VYVA_QA_PREVIEW_BYPASS",
    );
    expect(summary.commands[1]).toContain(
      "--request-header-env=x-qa-preview-bypass:VYVA_QA_PREVIEW_BYPASS",
    );
    expect(summary.commands[2]).toContain(
      "--request-header-env=x-qa-preview-bypass:VYVA_QA_PREVIEW_BYPASS",
    );
    expect(result.stdout).not.toContain(secret);
  });

  it("rejects malformed authenticated QA gateway header references", () => {
    const result = runLaunchEvidencePlan([
      `--date=${dateDaysAgo(0)}`,
      "--base-url=https://v2.vyva.life",
      "--request-header-env=x-qa-preview-bypass",
      "--json",
    ]);

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).problems).toContain(
      "Expected --request-header-env to use Header-Name:ENV_NAME without including the secret value.",
    );
  });

  it("rejects future, stale, local, and mock launch evidence run plans by default", () => {
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
    const mock = runLaunchEvidencePlan([
      `--date=${dateDaysAgo(0)}`,
      "--base-url=https://mock-staging.vyva.app",
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
    expect(mock.status).toBe(1);
    expect(JSON.parse(mock.stdout).problems).toContain(
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
