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
const copyEvidenceScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-copy-evidence.ts",
);

function runCopyEvidence(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, copyEvidenceScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function freshReviewDate(): string {
  return new Date(Date.now() - 60_000).toISOString().slice(0, 10);
}

function validCopyEvidenceArtifact(): string {
  const reviewedOn = freshReviewDate();
  const lines = [
    "# Voice Canvas copy clarity evidence artifact",
    "",
    "Use this copy-safe artifact to prove every Canvas launch flow is senior-friendly, shows one clear decision at a time, explains what happens next, and remains accessible with long translated labels.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: ${reviewedOn}`,
    "Reviewer: QA Launch Reviewer",
    "QA run URL: https://staging.vyva.app",
    "Commit/build: aabbccddeeff",
    "Privacy boundary: sanitized artifact references only with no personal details",
    "",
    "## Copy clarity checklist",
    "",
    "| Flow | Senior-friendly copy | What happens next | Long translated labels | Accessibility announcements | Evidence reference | Reviewer/date |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const flow of canvasLaunchReadinessFlows) {
    lines.push(
      `| ${flow.label} | warm plain senior-friendly restrained copy with one clear decision at a time | what happens next is clear for primary action, secondary back cancel exit, waiting, blocked, and completed states | long translated Spanish labels wrap without overflow on mobile, tablet, and desktop | focus moves meaningfully; screen reader announces waiting, blocked, and completed; reduced motion respected | artifacts/voice-canvas/${reviewedOn}/${flow.id}-copy-clarity-accessibility-screenshot-capture-review-artifact.md | reviewed by QA Launch Reviewer on ${reviewedOn} |`,
    );
  }

  lines.push(
    "",
    "## Copy-ready evidence packet note",
    "",
    `Copy clarity reviewed on ${reviewedOn} by QA Launch Reviewer: every launch flow used warm plain senior-friendly restrained copy, showed one clear decision at a time, explained what happens next for primary, secondary/back/cancel/exit, waiting, blocked, and completed states, handled long translated Spanish labels without overflow, moved focus meaningfully, announced waiting/blocked/completed states to screen readers, respected reduced motion, and used sanitized dated copy/accessibility artifact references only.`,
  );

  return `${lines.join("\n")}\n`;
}

function withTempCopyFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-copy-"));
  const inputPath = path.join(tempDir, "copy-clarity.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas copy clarity evidence helper command", () => {
  it("prints copy-safe help for run-specific copy clarity artifacts", () => {
    const result = runCopyEvidence(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("npm run --silent canvas:qa:copy -- --template");
    expect(result.stdout).toContain(
      "artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md",
    );
    expect(result.stdout).toContain("senior-friendly copy");
    expect(result.stdout).toContain("what-happens-next clarity");
    expect(result.stdout).toContain("no remaining placeholders");
    expect(result.stdout).toContain("deployed HTTPS non-local QA run URL");
    expect(result.stdout).toContain("This helper never calls feature endpoints");
    expect(result.stdout).not.toContain("<YYYY-MM-DD>");
  });

  it("prints a manifest-filled copy-safe template", () => {
    const result = runCopyEvidence(["--template"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Voice Canvas copy clarity evidence artifact");
    for (const flow of canvasLaunchReadinessFlows) {
      expect(result.stdout).toContain(`| ${flow.label} |`);
    }
    expect(result.stdout).toContain("long translated Spanish labels");
    expect(result.stdout).toContain("screen reader announces waiting, blocked, and completed");
  });

  it("passes a filled copy clarity evidence artifact", () =>
    withTempCopyFile(validCopyEvidenceArtifact(), (inputPath) => {
      const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        readyForLaunchEvidence: boolean;
        reviewedOn: string;
        requiredFlowCount: number;
        requiredCopyRowCount: number;
        problemCount: number;
        problems: string[];
      };

      expect(summary.readyForLaunchEvidence).toBe(true);
      expect(summary.reviewedOn).toBe(freshReviewDate());
      expect(summary.requiredFlowCount).toBe(canvasLaunchReadinessFlows.length);
      expect(summary.requiredCopyRowCount).toBe(canvasLaunchReadinessFlows.length);
      expect(summary.problemCount).toBe(0);
      expect(summary.problems).toEqual([]);
    }));

  it("rejects unfilled templates as not launch-ready", () =>
    withTempCopyFile(runCopyEvidence(["--template"]).stdout, (inputPath) => {
      const result = runCopyEvidence([inputPath, "--json"]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout) as { problems: string[] };
      expect(summary.problems).toEqual(
        expect.arrayContaining([
          "Copy clarity evidence artifact still contains placeholder text.",
        ]),
      );
    }));

  it("rejects missing flow rows", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        /\| Ride Voice Canvas \|[^\n]+\n/,
        "",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining(["Ride Voice Canvas: missing copy clarity row."]),
        );
      },
    ));

  it("rejects rows without next-step clarity", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "what happens next is clear for primary action, secondary back cancel exit, waiting, blocked, and completed states",
        "primary copy reviewed",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Ride Voice Canvas: next-step cell must explain primary, secondary/back/cancel/exit, waiting, blocked, and completed states.",
          ]),
        );
      },
    ));

  it("rejects long-label evidence without mobile, tablet, desktop overflow proof", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "long translated Spanish labels wrap without overflow on mobile, tablet, and desktop",
        "long Spanish labels reviewed",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Ride Voice Canvas: long translated labels cell must prove wrapping without overflow on mobile, tablet, and desktop.",
          ]),
        );
      },
    ));

  it("rejects contradictory copy/accessibility evidence even when required phrases are present", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "long translated Spanish labels wrap without overflow on mobile, tablet, and desktop",
        "long translated Spanish labels wrap without overflow on mobile, tablet, and desktop, but tablet labels were clipped and screen reader not announced for blocked state",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Copy clarity evidence artifact must use affirmative successful copy/accessibility evidence, not overflow, clipping, unreadable, missing-focus, missing-announcement, unavailable, or unverified evidence.",
          ]),
        );
        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("tablet labels were clipped");
        expect(serialized).not.toContain("screen reader not announced");
      },
    ));

  it("rejects accessibility evidence without announcements and reduced-motion proof", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "focus moves meaningfully; screen reader announces waiting, blocked, and completed; reduced motion respected",
        "focus checked",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Ride Voice Canvas: accessibility cell must prove focus movement, screen-reader announcements for waiting/blocked/completed, and reduced-motion support.",
          ]),
        );
      },
    ));

  it("rejects non-HTTPS QA run URLs as not real deployed copy evidence", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: http://staging.vyva.app",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Copy clarity evidence QA run URL must be a deployed HTTPS non-local URL.",
          ]),
        );
      },
    ));

  it("rejects credential or query-bearing QA run URLs as not copy-safe evidence", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: https://staging.vyva.app?token=secret",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Copy clarity evidence QA run URL must be a deployed HTTPS non-local URL.",
          ]),
        );
      },
    ));

  it("rejects personal details without echoing them in problem output", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references only; pickup address=123 Secret Street",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Copy clarity evidence artifact appears to include personal details.",
          ]),
        );
        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("123 Secret Street");
        expect(serialized).not.toContain("pickup address");
      },
    ));

  it("rejects secret-bearing artifact references without echoing them", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references only; artifact https://qa-user:secret-pass@staging.vyva.app/copy?token=secret",
      ),
      (inputPath) => {
        const result = runCopyEvidence([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as { problems: string[] };
        expect(summary.problems).toContain(
          "Copy clarity evidence artifact appears to include personal details.",
        );
        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("secret-pass");
        expect(serialized).not.toContain("token=secret");
      },
    ));

  it("saves templates and validation JSON without overwriting by default", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-copy-output-"));
    const templatePath = path.join(tempDir, "copy-clarity.md");
    const validationPath = path.join(tempDir, "copy-validation.json");

    try {
      const templateResult = runCopyEvidence(["--template", `--output=${templatePath}`]);
      expect(templateResult.status).toBe(0);
      expect(existsSync(templatePath)).toBe(true);
      expect(readFileSync(templatePath, "utf8")).toContain(
        "# Voice Canvas copy clarity evidence artifact",
      );

      const blockedTemplateResult = runCopyEvidence(["--template", `--output=${templatePath}`]);
      expect(blockedTemplateResult.status).toBe(1);
      expect(blockedTemplateResult.stderr).toContain("Output file already exists");

      writeFileSync(templatePath, validCopyEvidenceArtifact());
      const validationResult = runCopyEvidence([
        `--input=${templatePath}`,
        "--json",
        `--output=${validationPath}`,
      ]);
      expect(validationResult.status).toBe(0);
      expect(JSON.parse(readFileSync(validationPath, "utf8"))).toMatchObject({
        readyForLaunchEvidence: true,
        problemCount: 0,
      });

      const blockedValidationResult = runCopyEvidence([
        `--input=${templatePath}`,
        "--json",
        `--output=${validationPath}`,
      ]);
      expect(blockedValidationResult.status).toBe(1);
      expect(blockedValidationResult.stderr).toContain("Output file already exists");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects output paths outside JSON mode", () =>
    withTempCopyFile(validCopyEvidenceArtifact(), (inputPath) => {
      const result = runCopyEvidence([
        `--input=${inputPath}`,
        "--output=artifacts/voice-canvas/copy-validation.json",
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Use --output with validation only when --json is also passed.");
    }));
});
