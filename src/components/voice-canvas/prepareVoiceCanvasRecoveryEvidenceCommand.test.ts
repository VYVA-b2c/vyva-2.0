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
const recoveryEvidenceScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-recovery-evidence.ts",
);

function runRecoveryEvidence(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, recoveryEvidenceScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function freshReviewDate(): string {
  return new Date(Date.now() - 60_000).toISOString().slice(0, 10);
}

function validRecoveryEvidenceArtifact(): string {
  const reviewedOn = freshReviewDate();
  const lines = [
    "# Voice Canvas recovery behavior evidence artifact",
    "",
    "Use this copy-safe artifact to prove every Canvas launch flow can be left, resumed, interrupted, retried, cancelled, and protected from duplicate or stale responses without side effects.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: ${reviewedOn}`,
    "Reviewer: QA Launch Reviewer",
    "QA run URL: https://staging.vyva.app",
    "Commit/build: aabbccddeeff",
    "Privacy boundary: sanitized artifact references only with no personal details",
    "",
    "## Recovery behavior checklist",
    "",
    "| Flow | Start/resume | App exit/reopen | Refresh/reconnect | Voice interruption | Browser back | Cancel/exit | Retry/failure | Duplicate/stale | Evidence reference | Reviewer/date |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const flow of canvasLaunchReadinessFlows) {
    lines.push(
      `| ${flow.label} | start and resume restored current work with entered information preserved, no write, no resubmission, and no external action | app exit and reopen restored draft with entered information preserved, no write, no resubmission, and no external action | refresh and reconnect restored work with entered information preserved, no write, no resubmission, and no external action | voice interruption recovered current work with entered information preserved, no write, no resubmission, and no external action | browser back returned safely with entered information preserved, no write, and no external action | cancel and exit left safely with no write and no external action | recoverable failure offered retry and exit with entered information preserved, no write, no resubmission, and no external action | duplicate confirmation prevented and stale response ignored or discarded with no write, no resubmission, and no external action | artifacts/voice-canvas/${reviewedOn}/${flow.id}-recovery-behavior-resume-reconnect-screenshot-log-recording-capture-artifact.md | reviewed by QA Launch Reviewer on ${reviewedOn} |`,
    );
  }

  lines.push(
    "",
    "## Copy-ready evidence packet note",
    "",
    `Recovery behavior reviewed on ${reviewedOn} by QA Launch Reviewer: every launch flow restored start/resume, app exit/reopen, refresh/reconnect, voice interruption, browser back, cancel/exit, retry/failure, duplicate prevention, and stale-response handling with entered information preserved where relevant, no write, no resubmission, no external action, and sanitized dated recovery screenshots/logs/recordings/captures/artifacts only.`,
  );

  return `${lines.join("\n")}\n`;
}

function withTempRecoveryFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-recovery-"));
  const inputPath = path.join(tempDir, "recovery-behavior.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas recovery behavior evidence helper command", () => {
  it("prints copy-safe help for run-specific recovery artifacts", () => {
    const result = runRecoveryEvidence(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("npm run --silent canvas:qa:recovery -- --template");
    expect(result.stdout).toContain(
      "artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md",
    );
    expect(result.stdout).toContain("start/resume");
    expect(result.stdout).toContain("duplicate prevention");
    expect(result.stdout).toContain("stale-response evidence");
    expect(result.stdout).toContain("deployed HTTPS non-local QA run URL");
    expect(result.stdout).toContain("This helper never calls feature endpoints");
    expect(result.stdout).not.toContain("<YYYY-MM-DD>");
  });

  it("prints a manifest-filled copy-safe recovery template", () => {
    const result = runRecoveryEvidence(["--template"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Voice Canvas recovery behavior evidence artifact");
    for (const flow of canvasLaunchReadinessFlows) {
      expect(result.stdout).toContain(`| ${flow.label} |`);
    }
    expect(result.stdout).toContain("refresh and reconnect restored work");
    expect(result.stdout).toContain("duplicate confirmation or action prevented");
  });

  it("passes a filled recovery behavior evidence artifact", () =>
    withTempRecoveryFile(validRecoveryEvidenceArtifact(), (inputPath) => {
      const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        readyForLaunchEvidence: boolean;
        reviewedOn: string;
        requiredFlowCount: number;
        requiredRecoveryRowCount: number;
        problemCount: number;
        problems: string[];
      };

      expect(summary.readyForLaunchEvidence).toBe(true);
      expect(summary.reviewedOn).toBe(freshReviewDate());
      expect(summary.requiredFlowCount).toBe(canvasLaunchReadinessFlows.length);
      expect(summary.requiredRecoveryRowCount).toBe(canvasLaunchReadinessFlows.length);
      expect(summary.problemCount).toBe(0);
      expect(summary.problems).toEqual([]);
    }));

  it("rejects unfilled templates as not launch-ready", () =>
    withTempRecoveryFile(runRecoveryEvidence(["--template"]).stdout, (inputPath) => {
      const result = runRecoveryEvidence([inputPath, "--json"]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout) as { problems: string[] };
      expect(summary.problems).toEqual(
        expect.arrayContaining([
          "Recovery behavior evidence artifact still contains placeholder text.",
        ]),
      );
    }));

  it("rejects missing flow rows", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(/\| Ride Voice Canvas \|[^\n]+\n/, ""),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining(["Ride Voice Canvas: missing recovery behavior row."]),
        );
      },
    ));

  it("rejects weak refresh/reconnect preservation evidence", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "refresh and reconnect restored work with entered information preserved, no write, no resubmission, and no external action",
        "refresh checked",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Ride Voice Canvas: refresh/reconnect cell must name the required recovery behavior and preservation proof.",
            "Ride Voice Canvas: refresh/reconnect cell must prove no write, no external action, and no resubmission where required.",
          ]),
        );
      },
    ));

  it("rejects weak duplicate and stale-response evidence", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "duplicate confirmation prevented and stale response ignored or discarded with no write, no resubmission, and no external action",
        "duplicate and stale checked",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Ride Voice Canvas: duplicate/stale cell must prove duplicate prevention and stale-response ignoring or discarding.",
            "Ride Voice Canvas: duplicate/stale cell must prove no write, no external action, and no resubmission.",
          ]),
        );
      },
    ));

  it("rejects duplicate and stale-response evidence without no-side-effect proof", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "duplicate confirmation prevented and stale response ignored or discarded with no write, no resubmission, and no external action",
        "duplicate confirmation prevented and stale response ignored or discarded",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toContain(
          "Ride Voice Canvas: duplicate/stale cell must prove no write, no external action, and no resubmission.",
        );
      },
    ));

  it("rejects contradictory recovery evidence even when no-side-effect wording is present", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "refresh and reconnect restored work with entered information preserved, no write, no resubmission, and no external action",
        "refresh and reconnect restored work with entered information preserved, no write, no resubmission, and no external action, but navigation triggered during reconnect",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toContain(
          "Recovery behavior evidence artifact must use affirmative successful recovery evidence, not failed, unavailable, or accepted duplicate/stale evidence.",
        );
        expect(result.stdout).not.toContain("navigation triggered");
      },
    ));

  it("rejects incomplete recovery evidence without echoing values", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "recoverable failure offered retry and exit with entered information preserved, no write, no resubmission, and no external action",
        "recoverable failure retry is incomplete, exit path not complete, and task not safely exited, with no write, no resubmission, and no external action",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toContain(
          "Recovery behavior evidence artifact must use affirmative successful recovery evidence, not failed, unavailable, or accepted duplicate/stale evidence.",
        );
        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("retry is incomplete");
        expect(serialized).not.toContain("not complete");
        expect(serialized).not.toContain("not safely exited");
      },
    ));

  it("rejects stale reviewer dates", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replaceAll(freshReviewDate(), "2000-01-01"),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Recovery behavior evidence reviewed date must be no older than 7 days.",
          ]),
        );
      },
    ));

  it("rejects non-HTTPS QA run URLs as not real deployed evidence", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: http://staging.vyva.app",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Recovery behavior evidence QA run URL must be a deployed HTTPS non-local URL.",
          ]),
        );
      },
    ));

  it("rejects credential or query-bearing QA run URLs as not recovery evidence", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: https://staging.vyva.app?token=secret",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Recovery behavior evidence QA run URL must be a deployed HTTPS non-local URL.",
          ]),
        );
      },
    ));

  it("rejects personal details without echoing them in problem output", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references include pickup address=123 Secret Street",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Recovery behavior evidence artifact appears to include personal details.",
          ]),
        );
        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("123 Secret Street");
        expect(serialized).not.toContain("pickup address");
      },
    ));

  it("rejects secret-bearing artifact references without echoing them", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references include https://qa-user:secret-pass@staging.vyva.app/recovery?token=secret",
      ),
      (inputPath) => {
        const result = runRecoveryEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toContain(
          "Recovery behavior evidence artifact appears to include personal details.",
        );
        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("secret-pass");
        expect(serialized).not.toContain("token=secret");
      },
    ));

  it("saves templates and validation JSON without overwriting by default", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-recovery-output-"));
    const templatePath = path.join(tempDir, "recovery-behavior.md");
    const validationPath = path.join(tempDir, "recovery-validation.json");

    try {
      const templateResult = runRecoveryEvidence(["--template", `--output=${templatePath}`]);
      expect(templateResult.status).toBe(0);
      expect(existsSync(templatePath)).toBe(true);
      expect(readFileSync(templatePath, "utf8")).toContain(
        "# Voice Canvas recovery behavior evidence artifact",
      );

      const blockedTemplateResult = runRecoveryEvidence(["--template", `--output=${templatePath}`]);
      expect(blockedTemplateResult.status).toBe(1);
      expect(blockedTemplateResult.stderr).toContain("Output file already exists");

      writeFileSync(templatePath, validRecoveryEvidenceArtifact());
      const validationResult = runRecoveryEvidence([
        `--input=${templatePath}`,
        "--json",
        `--output=${validationPath}`,
      ]);
      expect(validationResult.status).toBe(0);
      expect(JSON.parse(readFileSync(validationPath, "utf8"))).toMatchObject({
        readyForLaunchEvidence: true,
        problemCount: 0,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects output paths outside JSON mode", () =>
    withTempRecoveryFile(validRecoveryEvidenceArtifact(), (inputPath) => {
      const result = runRecoveryEvidence([
        `--input=${inputPath}`,
        "--output=artifacts/voice-canvas/recovery-validation.json",
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Use --output with validation only when --json is also passed.");
    }));
});
