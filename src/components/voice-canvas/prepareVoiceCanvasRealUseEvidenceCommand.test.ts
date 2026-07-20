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
const realUseScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-real-use-evidence.ts",
);

function runRealUseHelper(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, realUseScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function freshReviewDate(): string {
  return new Date(Date.now() - 60_000).toISOString().slice(0, 10);
}

function validRealUseEvidenceArtifact(): string {
  const reviewedOn = freshReviewDate();
  const lines = [
    "# Voice Canvas real-use device and interaction evidence artifact",
    "",
    "Use this copy-safe artifact to prove every Canvas launch flow completed or safely exited on real devices and through supported interaction modes.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: ${reviewedOn}`,
    "Reviewer: QA Launch Reviewer",
    "QA run URL: https://staging.vyva.app",
    "Commit/build: aabbccddeeff",
    "Privacy boundary: sanitized artifact references only with no personal details",
    "",
    "## Real device coverage",
    "",
    "| Flow | Phone/mobile | Tablet | Desktop/laptop | Evidence reference | Reviewer/date |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  for (const flow of canvasLaunchReadinessFlows) {
    lines.push(
      `| ${flow.label} | real physical phone/mobile completed with no write and no external action before confirmation | real physical tablet completed with no write and no external action before confirmation | real desktop/laptop completed with no write and no external action before confirmation | artifacts/voice-canvas/${reviewedOn}/${flow.id}-phone-tablet-desktop-screenshot-photo-capture-artifact.md | reviewed by QA Launch Reviewer on ${reviewedOn} |`,
    );
  }

  lines.push(
    "",
    "## Interaction mode coverage",
    "",
    "| Flow | Voice | Touch | Keyboard | Evidence reference | Reviewer/date |",
    "| --- | --- | --- | --- | --- | --- |",
  );

  for (const flow of canvasLaunchReadinessFlows) {
    lines.push(
      `| ${flow.label} | voice path completed with no write and no external action before confirmation | touch path completed with no write and no external action before confirmation | keyboard-only path completed with no write and no external action before confirmation | artifacts/voice-canvas/${reviewedOn}/${flow.id}-voice-touch-keyboard-recording-log-screenshot-artifact.md | reviewed by QA Launch Reviewer on ${reviewedOn} |`,
    );
  }

  lines.push(
    "",
    "## Copy-ready evidence packet note",
    "",
    `Real-use coverage reviewed on ${reviewedOn} by QA Launch Reviewer: every launch flow had real physical phone/mobile, tablet, and desktop/laptop coverage plus voice, touch, and keyboard completion or safe-exit proof, with sanitized dated screenshots/photos/recordings/logs/captures/artifacts, no write, and no external action before explicit confirmation.`,
  );

  return `${lines.join("\n")}\n`;
}

function withTempMarkdownFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-real-use-"));
  const inputPath = path.join(tempDir, "real-use.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas real-use evidence helper command", () => {
  it("prints copy-safe help for run-specific real-use artifacts", () => {
    const result = runRealUseHelper(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:real-use -- --template",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:real-use -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md",
    );
    expect(result.stdout).toContain("real physical phone, tablet, desktop/laptop");
    expect(result.stdout).toContain("voice, touch, and keyboard");
    expect(result.stdout).toContain("deployed HTTPS non-local QA run URL");
    expect(result.stdout).toContain("This helper never calls feature endpoints");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(unsafeDatePlaceholder);
  });

  it("prints a manifest-filled copy-safe real-use template", () => {
    const result = runRealUseHelper(["--template"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "# Voice Canvas real-use device and interaction evidence artifact",
    );
    expect(result.stdout).toContain("## Real device coverage");
    expect(result.stdout).toContain("## Interaction mode coverage");

    for (const flow of canvasLaunchReadinessFlows) {
      expect(result.stdout, flow.label).toContain(`| ${flow.label} |`);
    }

    expect(result.stdout).not.toContain("123 Secret Street");
    expect(result.stdout).not.toContain("private spoken detail");
    expect(result.stdout).not.toContain("raw endpoint body:");
  });

  it("passes a filled copy-safe real-use evidence artifact", () =>
    withTempMarkdownFile(validRealUseEvidenceArtifact(), (inputPath) => {
      const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const summary = JSON.parse(result.stdout);
      expect(summary).toMatchObject({
        readyForLaunchEvidence: true,
        requiredFlowCount: canvasLaunchReadinessFlows.length,
        requiredDeviceRowCount: canvasLaunchReadinessFlows.length,
        requiredInteractionRowCount: canvasLaunchReadinessFlows.length,
        problemCount: 0,
        problems: [],
      });
    }));

  it("rejects unfilled templates as not launch-ready", () =>
    withTempMarkdownFile(runRealUseHelper(["--template"]).stdout, (inputPath) => {
      const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout);
      expect(summary.problems).toContain(
        "Real-use evidence artifact still contains placeholder text.",
      );
    }));

  it("rejects missing flow rows", () => {
    const flow = canvasLaunchReadinessFlows[0];
    const artifact = validRealUseEvidenceArtifact()
      .split("\n")
      .filter((line) => !line.startsWith(`| ${flow.label} |`))
      .join("\n");

    return withTempMarkdownFile(`${artifact}\n`, (inputPath) => {
      const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout);
      expect(summary.problems).toContain(`${flow.label}: missing real device coverage row.`);
      expect(summary.problems).toContain(`${flow.label}: missing interaction mode coverage row.`);
    });
  });

  it("rejects emulator or responsive-mode device evidence", () =>
    withTempMarkdownFile(
      validRealUseEvidenceArtifact().replace(
        "real physical phone/mobile completed",
        "responsive mode phone viewport completed",
      ),
      (inputPath) => {
        const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems).toContain(
          "Real-use evidence artifact must use real physical devices, not emulator, simulator, responsive-mode, DevTools, unavailable, or failed evidence.",
        );
      },
    ));

  it("rejects rows without no-write and no-external-action proof", () =>
    withTempMarkdownFile(
      validRealUseEvidenceArtifact().replace(
        "with no write and no external action before confirmation",
        "before confirmation",
      ),
      (inputPath) => {
        const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems.join("\n")).toContain(
          "must prove completion or safe exit with no write and no external action before confirmation",
        );
      },
    ));

  it("rejects evidence references that omit required device or interaction artifacts", () =>
    withTempMarkdownFile(
      validRealUseEvidenceArtifact()
        .replace(/artifacts\/voice-canvas\/[^|]+phone-tablet-desktop-screenshot-photo-capture-artifact\.md/, "artifacts/voice-canvas/2026-07-20/device-proof.md")
        .replace(/artifacts\/voice-canvas\/[^|]+voice-touch-keyboard-recording-log-screenshot-artifact\.md/, "artifacts/voice-canvas/2026-07-20/interaction-proof.md"),
      (inputPath) => {
        const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems.join("\n")).toContain(
          "device evidence must include dated sanitized phone, tablet, and desktop/laptop screenshot/photo/capture/artifact references",
        );
        expect(summary.problems.join("\n")).toContain(
          "interaction evidence must include dated sanitized voice, touch, and keyboard recording/log/screenshot/artifact references",
        );
      },
    ));

  it("rejects stale reviewer dates", () =>
    withTempMarkdownFile(
      validRealUseEvidenceArtifact().replaceAll(freshReviewDate(), "2020-01-01"),
      (inputPath) => {
        const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems.join("\n")).toContain(
          "Real-use evidence reviewed date must be no older than 7 days.",
        );
        expect(summary.problems.join("\n")).toContain(
          "device reviewer/date must include a non-future YYYY-MM-DD date no older than 7 days",
        );
      },
    ));

  it("rejects non-HTTPS QA run URLs as not real deployed evidence", () =>
    withTempMarkdownFile(
      validRealUseEvidenceArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: http://staging.vyva.app",
      ),
      (inputPath) => {
        const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems).toContain(
          "Real-use evidence QA run URL must be a deployed HTTPS non-local URL.",
        );
      },
    ));

  it("rejects personal details without echoing them in problem output", () =>
    withTempMarkdownFile(
      validRealUseEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references include 123 Secret Street",
      ),
      (inputPath) => {
        const result = runRealUseHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stdout).not.toContain("123 Secret Street");
        const summary = JSON.parse(result.stdout);
        expect(summary.problems).toContain(
          "Real-use evidence artifact appears to include personal details.",
        );
      },
    ));

  it("saves templates and validation JSON without overwriting by default", () =>
    withTempMarkdownFile(validRealUseEvidenceArtifact(), (inputPath) => {
      const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-real-use-out-"));
      const templatePath = path.join(tempDir, "real-use.md");
      const outputPath = path.join(tempDir, "real-use-validation.json");

      try {
        const templateResult = runRealUseHelper([
          "--template",
          `--output=${templatePath}`,
        ]);
        expect(templateResult.status).toBe(0);
        expect(existsSync(templatePath)).toBe(true);

        const preserveTemplate = runRealUseHelper([
          "--template",
          `--output=${templatePath}`,
        ]);
        expect(preserveTemplate.status).toBe(1);
        expect(preserveTemplate.stderr).toContain("Output file already exists");

        const validationResult = runRealUseHelper([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
        ]);
        expect(validationResult.status).toBe(0);
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toMatchObject({
          readyForLaunchEvidence: true,
        });

        const preserveValidation = runRealUseHelper([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
        ]);
        expect(preserveValidation.status).toBe(1);
        expect(preserveValidation.stderr).toContain("Output file already exists");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }));

  it("rejects output paths outside JSON mode", () => {
    const result = runRealUseHelper([
      "--input=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md",
      "--output=artifacts/voice-canvas/YYYY-MM-DD-real-use-validation.json",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Use --output with validation only when --json is also passed.",
    );
  });
});
