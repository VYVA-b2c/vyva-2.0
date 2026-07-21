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

function withTempMarkdownFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-rollback-owner-"));
  const inputPath = path.join(tempDir, "rollback-owner-handoff.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
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
    expect(result.stdout).toContain(
      "npm run canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json",
    );
    expect(result.stdout).toContain("Operations/rollback owner sign-off");
    expect(result.stdout).toContain("decision window");
    expect(result.stdout).toContain("rollback trigger");
    expect(result.stdout).toContain("endpoint/fallback/open-session evidence");
    expect(result.stdout).toContain("no remaining placeholders");
    expect(result.stdout).toContain("deployed HTTPS non-local QA run URL");
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
    expect(result.stdout).toContain("QA run URL:");
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

  it("passes a filled copy-safe rollback owner handoff artifact", () =>
    withTempMarkdownFile(validRollbackOwnerHandoffArtifact(), (inputPath) => {
      const result = runRollbackOwnerHelper([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        readyForLaunchEvidence: boolean;
        reviewedOn: string;
        requiredFlowCount: number;
        problemCount: number;
        problems: string[];
      };

      expect(summary.readyForLaunchEvidence).toBe(true);
      expect(summary.reviewedOn).toBe(freshReviewDate());
      expect(summary.requiredFlowCount).toBe(launchFeatureFlows.length);
      expect(summary.problemCount).toBe(0);
      expect(summary.problems).toEqual([]);
    }));

  it("rejects non-HTTPS QA run URLs as not real deployed rollback owner evidence", () =>
    withTempMarkdownFile(
      validRollbackOwnerHandoffArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: http://staging.vyva.app",
      ),
      (inputPath) => {
        const result = runRollbackOwnerHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stdout).not.toContain("token=secret");
        const summary = JSON.parse(result.stdout) as {
          qaRunUrl: string;
          problems: string[];
        };
        expect(summary.qaRunUrl).toBe("invalid");
        expect(summary.problems).toContain(
          "Rollback owner handoff QA run URL must be a deployed HTTPS non-local URL.",
        );
      },
    ));

  it("rejects credential or query-bearing QA run URLs as not rollback owner evidence", () =>
    withTempMarkdownFile(
      validRollbackOwnerHandoffArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: https://staging.vyva.app?token=secret",
      ),
      (inputPath) => {
        const result = runRollbackOwnerHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toContain(
          "Rollback owner handoff QA run URL must be a deployed HTTPS non-local URL.",
        );
      },
    ));

  it("rejects unchanged templates and unsafe filled handoff artifacts", () =>
    withTempMarkdownFile(validRollbackOwnerHandoffArtifact(), (inputPath) => {
      const templateResult = runRollbackOwnerHelper(["--template"]);
      writeFileSync(inputPath, templateResult.stdout);

      const unchangedResult = runRollbackOwnerHelper([`--input=${inputPath}`, "--json"]);
      const unchangedSummary = JSON.parse(unchangedResult.stdout) as {
        readyForLaunchEvidence: boolean;
        problems: string[];
      };

      expect(unchangedResult.status).toBe(1);
      expect(unchangedSummary.readyForLaunchEvidence).toBe(false);
      expect(unchangedSummary.problems).toEqual(
        expect.arrayContaining([
          "Rollback owner handoff artifact still contains placeholder text.",
          "Rollback owner handoff artifact must fill Operations/rollback owner.",
        ]),
      );

      writeFileSync(
        inputPath,
        validRollbackOwnerHandoffArtifact().replace(
          "sanitized artifact references only with no personal details",
          "sanitized artifact references include 123 Secret Street",
        ),
      );
      const unsafeResult = runRollbackOwnerHelper([`--input=${inputPath}`, "--json"]);
      const unsafeSummary = JSON.parse(unsafeResult.stdout) as {
        problems: string[];
      };

      expect(unsafeResult.status).toBe(1);
      expect(unsafeSummary.problems).toContain(
        "Rollback owner handoff artifact appears to include personal details.",
      );
    }));

  it("saves validation JSON while preserving existing artifacts by default", () =>
    withTempMarkdownFile(validRollbackOwnerHandoffArtifact(), (inputPath) => {
      const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-rollback-owner-output-"));
      const outputPath = path.join(tempDir, "rollback-owner-validation.json");

      try {
        const firstResult = runRollbackOwnerHelper([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(firstResult.status).toBe(0);
        expect(readFileSync(outputPath, "utf8")).toContain(
          '"readyForLaunchEvidence": true',
        );

        writeFileSync(outputPath, "existing summary\n");
        const secondResult = runRollbackOwnerHelper([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(secondResult.status).toBe(1);
        expect(secondResult.stderr).toContain("Output file already exists");
        expect(readFileSync(outputPath, "utf8")).toBe("existing summary\n");

        const forcedResult = runRollbackOwnerHelper([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
          "--force",
        ]);

        expect(forcedResult.status).toBe(0);
        expect(readFileSync(outputPath, "utf8")).toContain(
          '"problemCount": 0',
        );
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }));

  it("rejects output paths during validation unless JSON is requested", () => {
    const result = runRollbackOwnerHelper([
      "--input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
      "--output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use --output with validation only when --json is also passed.");
  });
});
