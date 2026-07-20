// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildSync } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canvasLaunchReadinessFlows } from "./canvasLaunchReadiness";

const preflightScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "preflight-voice-canvas-launch-readiness.ts",
);
let bundledPreflightDir: string | null = null;
let bundledPreflightScriptPath = preflightScriptPath;

const launchFeatureFlows = canvasLaunchReadinessFlows.filter(
  (flow) => flow.featureFlag,
);

function runPreflight(args: string[] = []) {
  return spawnSync(process.execPath, [bundledPreflightScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

beforeAll(() => {
  bundledPreflightDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-cli-"));
  bundledPreflightScriptPath = path.join(
    bundledPreflightDir,
    "preflight-voice-canvas-launch-readiness.mjs",
  );
  buildSync({
    entryPoints: [preflightScriptPath],
    outfile: bundledPreflightScriptPath,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
  });
});

afterAll(() => {
  if (bundledPreflightDir && existsSync(bundledPreflightDir)) {
    rmSync(bundledPreflightDir, { recursive: true, force: true });
  }
});

function freshReviewDate(): string {
  return new Date(Date.now() - 60_000).toISOString().slice(0, 10);
}

function validRollbackOwnerHandoffArtifact(): string {
  const reviewedOn = freshReviewDate();
  const lines = [
    "# Voice Canvas rollback owner handoff artifact",
    "",
    "Use this copy-safe artifact for final Operations/rollback owner sign-off. Replace bracketed placeholders only after the deployed launch run is reviewed.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: ${reviewedOn}`,
    "Reviewer: QA Launch Reviewer",
    "QA run URL: https://staging.vyva.app",
    "Operations/rollback owner: Ops Launch Owner",
    "Backup owner: Ops Backup Owner",
    "Decision window: launch monitoring window after enablement",
    "Rollback trigger: any confirmed Canvas confusion, stale response, duplicate action, privacy, or fallback readiness issue",
    "Rollback action: enable false and disabled rollout 0 action available for all Canvas flags",
    "Privacy boundary: sanitized artifact references only with no personal details",
    "Fallback readiness: existing Concierge fallback verified and ready",
    "",
    "## Required sanitized evidence",
    "",
    "- Enabled endpoint artifact: artifacts/voice-canvas/2026-07-20-feature-endpoints-enabled.json verified endpoint evidence",
    "- Rollback-disabled endpoint artifact: artifacts/voice-canvas/2026-07-20-feature-endpoints-rollback-disabled.json verified rollback-disabled endpoint evidence",
    "- Fallback visibility artifact: artifacts/voice-canvas/2026-07-20-fallback-visibility.md verified fallback visibility",
    "- Open-session Canvas closed or hidden artifact: artifacts/voice-canvas/2026-07-20-open-session-rollback.md verified open-session Canvas closed or hidden behavior",
    "- No-write/no-resubmission/no-external-action evidence: artifacts/voice-canvas/2026-07-20-no-side-effects.md verified no-write no-resubmission no-external-action behavior",
    "",
    "## Launch manifest coverage",
  ];

  for (const flow of launchFeatureFlows) {
    lines.push(
      "",
      `### ${flow.label}`,
      "",
      `- Endpoint: ${flow.featureFlag!.endpoint}`,
      `- Server key: ${flow.featureFlag!.serverFeatureKey}`,
      `- Named fallback path: ${flow.featureFlag!.fallback}`,
      "- Handoff confirmation: owner and backup can disable this flag, verify rollback-disabled endpoint payload, confirm Canvas closed or hidden in an open session, and confirm the named fallback path is visible",
    );
  }

  lines.push(
    "",
    "## Copy-ready final sign-off note",
    "",
    `Operations/rollback owner sign-off, reviewed on ${reviewedOn} by QA Launch Reviewer: rollback owner Ops Launch Owner and backup owner Ops Backup Owner confirmed the decision window launch monitoring window after enablement, rollback trigger any confirmed Canvas confusion or privacy issue, enable false or disabled rollout 0 rollback action for all Canvas flags, sanitized endpoint/fallback/open-session evidence artifacts/voice-canvas/2026-07-20-rollback-owner-handoff.md, Canvas closed or hidden behavior, privacy boundary, no write, no resubmission, no external action, and fallback readiness before launch.`,
  );

  return `${lines.join("\n")}\n`;
}

function withTempRollbackOwnerFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-rollback-"));
  const inputPath = path.join(tempDir, "rollback-owner-handoff.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas rollback-owner preflight evidence", () => {
  it("includes sanitized rollback owner handoff artifacts in the preflight summary", () =>
    withTempRollbackOwnerFile(validRollbackOwnerHandoffArtifact(), (inputPath) => {
      const result = runPreflight([`--rollback-owner=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        acceptedPending: boolean;
        rollbackOwnerEvidence: {
          provided: boolean;
          readyForLaunchEvidence: boolean;
          reviewedOn: string;
          requiredFlowCount: number;
          problemCount: number;
          problems: string[];
        };
      };

      expect(summary.acceptedPending).toBe(true);
      expect(summary.rollbackOwnerEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
        reviewedOn: freshReviewDate(),
        requiredFlowCount: launchFeatureFlows.length,
        problemCount: 0,
        problems: [],
      });
    }));

  it("rejects rollback owner handoff artifacts from local QA run URLs", () =>
    withTempRollbackOwnerFile(
      validRollbackOwnerHandoffArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: http://127.0.0.1:5173",
      ),
      (inputPath) => {
        const result = runPreflight([`--rollback-owner=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          rollbackOwnerEvidence: {
            readyForLaunchEvidence: boolean;
            problems: string[];
          };
          nextActions: string[];
        };

        expect(summary.rollbackOwnerEvidence.readyForLaunchEvidence).toBe(false);
        expect(summary.rollbackOwnerEvidence.problems).toContain(
          "Rollback owner handoff QA run URL must be a deployed non-local http(s) URL.",
        );
        expect(summary.nextActions).toContain(
          "Fix sanitized rollback owner handoff evidence before launch sign-off.",
        );
      },
    ));

  it("rejects unsafe rollback owner handoff artifacts without echoing personal values", () =>
    withTempRollbackOwnerFile(
      validRollbackOwnerHandoffArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references include 123 Secret Street",
      ),
      (inputPath) => {
        const result = runPreflight([`--rollback-owner=${inputPath}`]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("Rollback owner evidence problems:");
        expect(result.stdout).toContain(
          "Rollback owner handoff artifact appears to include personal details.",
        );
        expect(result.stdout).toContain(
          "Fix sanitized rollback owner handoff evidence before launch sign-off.",
        );
        expect(result.stdout).not.toContain("123 Secret Street");
      },
    ));
});
