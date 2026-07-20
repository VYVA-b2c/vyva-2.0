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
const entrySurfaceScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-entry-surface-evidence.ts",
);

function runEntrySurfaceHelper(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, entrySurfaceScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function freshReviewDate(): string {
  return new Date(Date.now() - 60_000).toISOString().slice(0, 10);
}

function validEntrySurfaceEvidenceArtifact(): string {
  const reviewedOn = freshReviewDate();
  const lines = [
    "# Voice Canvas entry surface evidence artifact",
    "",
    "Use this copy-safe artifact to prove every Canvas launch flow was opened or resumed from every canonical entry surface in the launch manifest.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: ${reviewedOn}`,
    "Reviewer: QA Launch Reviewer",
    "QA run URL: https://staging.vyva.app",
    "Commit/build: aabbccddeeff",
    "Privacy boundary: sanitized artifact references only with no personal details",
    "",
    "## Entry surface checklist",
  ];

  for (const flow of canvasLaunchReadinessFlows) {
    lines.push(
      "",
      `### ${flow.label}`,
      "",
      `- Flow ID: ${flow.id}`,
      `- Required surfaces: ${flow.surfaces.join("; ")}`,
      "",
      "| Surface | Result | Evidence reference | Reviewer/date |",
      "| --- | --- | --- | --- |",
    );

    for (const surface of flow.surfaces) {
      lines.push(
        `| ${surface} | exercised from this exact surface with no write and no external action before explicit confirmation | artifacts/voice-canvas/${reviewedOn}/${flow.id}-${surface.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-screenshot-log-artifact.md | reviewed by QA Launch Reviewer on ${reviewedOn} |`,
      );
    }
  }

  lines.push(
    "",
    "## Copy-ready evidence packet note",
    "",
    `Entry surface artifacts reviewed on ${reviewedOn} by QA Launch Reviewer: every canonical launch surface for ride, appointment, refill, shopping, provider reply, and task hub resume was exercised from the manifest-aligned surface list with sanitized dated screenshot/log/recording/capture/photo/artifact proof, no write, and no external action before explicit confirmation.`,
  );

  return `${lines.join("\n")}\n`;
}

function withTempMarkdownFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-entry-surfaces-"));
  const inputPath = path.join(tempDir, "entry-surfaces.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas entry surface evidence helper command", () => {
  it("prints copy-safe help for run-specific entry surface artifacts", () => {
    const result = runEntrySurfaceHelper(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:entry-surfaces -- --template",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:entry-surfaces -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:entry-surfaces -- --input=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md",
    );
    expect(result.stdout).toContain("canonical launch surface");
    expect(result.stdout).toContain("no write and no external action");
    expect(result.stdout).toContain("deployed HTTPS non-local QA run URL");
    expect(result.stdout).toContain("This helper never calls feature endpoints");
    expect(result.stdout).toContain("pass --force only when intentionally");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(unsafeDatePlaceholder);
  });

  it("prints a manifest-filled copy-safe entry surface template", () => {
    const result = runEntrySurfaceHelper(["--template"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "# Voice Canvas entry surface evidence artifact",
    );
    expect(result.stdout).toContain("QA run URL:");
    expect(result.stdout).toContain("Commit/build:");
    expect(result.stdout).toContain("Privacy boundary:");
    expect(result.stdout).toContain("| Surface | Result | Evidence reference | Reviewer/date |");

    for (const flow of canvasLaunchReadinessFlows) {
      expect(result.stdout, flow.label).toContain(`### ${flow.label}`);
      expect(result.stdout, flow.id).toContain(`- Flow ID: ${flow.id}`);
      expect(result.stdout, flow.label).toContain(
        `- Required surfaces: ${flow.surfaces.join("; ")}`,
      );
      for (const surface of flow.surfaces) {
        expect(result.stdout, `${flow.label} ${surface}`).toContain(`| ${surface} |`);
      }
    }

    expect(result.stdout).not.toContain("123 Secret Street");
    expect(result.stdout).not.toContain("private spoken detail");
    expect(result.stdout).not.toContain("raw endpoint body:");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(unsafeDatePlaceholder);
  });

  it("saves entry surface templates without overwriting existing artifacts by default", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-entry-surfaces-"));
    const outputPath = path.join(tempDir, "entry-surfaces.md");

    try {
      const firstResult = runEntrySurfaceHelper([
        "--template",
        `--output=${outputPath}`,
      ]);

      expect(firstResult.status).toBe(0);
      expect(firstResult.stdout).toContain(
        "Saved entry surface evidence template to",
      );
      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath, "utf8")).toContain(
        "Voice Canvas entry surface evidence artifact",
      );

      writeFileSync(outputPath, "existing artifact\n");
      const secondResult = runEntrySurfaceHelper([
        "--template",
        `--output=${outputPath}`,
      ]);

      expect(secondResult.status).toBe(1);
      expect(secondResult.stderr).toContain("Output file already exists");
      expect(readFileSync(outputPath, "utf8")).toBe("existing artifact\n");

      const forcedResult = runEntrySurfaceHelper([
        "--template",
        `--output=${outputPath}`,
        "--force",
      ]);

      expect(forcedResult.status).toBe(0);
      expect(readFileSync(outputPath, "utf8")).toContain(
        "Entry surface checklist",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes a filled copy-safe entry surface evidence artifact", () =>
    withTempMarkdownFile(validEntrySurfaceEvidenceArtifact(), (inputPath) => {
      const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const summary = JSON.parse(result.stdout);
      expect(summary).toMatchObject({
        readyForLaunchEvidence: true,
        requiredFlowCount: canvasLaunchReadinessFlows.length,
        requiredSurfaceCount: canvasLaunchReadinessFlows.reduce(
          (total, flow) => total + flow.surfaces.length,
          0,
        ),
        problemCount: 0,
        problems: [],
      });
    }));

  it("rejects unfilled templates as not launch-ready", () =>
    withTempMarkdownFile(
      runEntrySurfaceHelper(["--template"]).stdout,
      (inputPath) => {
        const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.readyForLaunchEvidence).toBe(false);
        expect(summary.problems).toContain(
          "Entry surface evidence artifact still contains placeholder text.",
        );
      },
    ));

  it("rejects artifacts that omit a canonical surface", () => {
    const flow = canvasLaunchReadinessFlows[0];
    const omittedSurface = flow.surfaces[0];
    const artifact = validEntrySurfaceEvidenceArtifact().replace(
      new RegExp(`\\| ${omittedSurface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|[^\\n]+\\n`),
      "",
    );

    return withTempMarkdownFile(artifact, (inputPath) => {
      const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout);
      expect(summary.problems).toContain(
        `${flow.label}: missing entry surface row for ${omittedSurface}.`,
      );
    });
  });

  it("rejects generic main-entry coverage", () =>
    withTempMarkdownFile(
      validEntrySurfaceEvidenceArtifact().replace(
        "exercised from this exact surface",
        "generic main entry exercised",
      ),
      (inputPath) => {
        const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems).toContain(
          "Entry surface evidence artifact must not use generic main-entry coverage.",
        );
      },
    ));

  it("rejects rows without no-write and no-external-action proof", () =>
    withTempMarkdownFile(
      validEntrySurfaceEvidenceArtifact().replace(
        "with no write and no external action before explicit confirmation",
        "before explicit confirmation",
      ),
      (inputPath) => {
        const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems.join("\n")).toContain("result must prove no write");
        expect(summary.problems.join("\n")).toContain(
          "result must prove no external action occurred before confirmation",
        );
      },
    ));

  it("rejects undated or non-artifact evidence references", () =>
    withTempMarkdownFile(
      validEntrySurfaceEvidenceArtifact().replace(
        /artifacts\/voice-canvas\/[^|]+-screenshot-log-artifact\.md/,
        "entry-surface-proof",
      ),
      (inputPath) => {
        const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems.join("\n")).toContain(
          "evidence must include a dated sanitized screenshot/log/recording/capture/photo/artifact reference",
        );
      },
    ));

  it("rejects stale reviewer dates", () =>
    withTempMarkdownFile(
      validEntrySurfaceEvidenceArtifact().replaceAll(freshReviewDate(), "2020-01-01"),
      (inputPath) => {
        const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems.join("\n")).toContain(
          "Entry surface evidence reviewed date must be no older than 7 days.",
        );
        expect(summary.problems.join("\n")).toContain(
          "reviewer/date must include a non-future YYYY-MM-DD date no older than 7 days",
        );
      },
    ));

  it("rejects non-HTTPS QA run URLs as not real deployed entry-surface evidence", () =>
    withTempMarkdownFile(
      validEntrySurfaceEvidenceArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: http://staging.vyva.app",
      ),
      (inputPath) => {
        const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems).toContain(
          "Entry surface evidence QA run URL must be a deployed HTTPS non-local URL.",
        );
      },
    ));

  it("rejects credential or query-bearing QA run URLs as not entry-surface evidence", () =>
    withTempMarkdownFile(
      validEntrySurfaceEvidenceArtifact().replace(
        "QA run URL: https://staging.vyva.app",
        "QA run URL: https://staging.vyva.app?token=secret",
      ),
      (inputPath) => {
        const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout);
        expect(summary.problems).toContain(
          "Entry surface evidence QA run URL must be a deployed HTTPS non-local URL.",
        );
      },
    ));

  it("rejects personal details without echoing them in problem output", () =>
    withTempMarkdownFile(
      validEntrySurfaceEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "pickup address: 123 Secret Street",
      ),
      (inputPath) => {
        const result = runEntrySurfaceHelper([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stdout).not.toContain("123 Secret Street");
        const summary = JSON.parse(result.stdout);
        expect(summary.problems).toContain(
          "Entry surface evidence artifact appears to include personal details.",
        );
      },
    ));

  it("saves validation JSON while preserving existing artifacts by default", () =>
    withTempMarkdownFile(validEntrySurfaceEvidenceArtifact(), (inputPath) => {
      const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-entry-surface-out-"));
      const outputPath = path.join(tempDir, "entry-surfaces-validation.json");

      try {
        const firstResult = runEntrySurfaceHelper([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(firstResult.status).toBe(0);
        expect(existsSync(outputPath)).toBe(true);
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toMatchObject({
          readyForLaunchEvidence: true,
        });

        writeFileSync(outputPath, "existing validation\n");
        const secondResult = runEntrySurfaceHelper([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(secondResult.status).toBe(1);
        expect(secondResult.stderr).toContain("Output file already exists");
        expect(readFileSync(outputPath, "utf8")).toBe("existing validation\n");

        const forcedResult = runEntrySurfaceHelper([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
          "--force",
        ]);

        expect(forcedResult.status).toBe(0);
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toMatchObject({
          readyForLaunchEvidence: true,
        });
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }));

  it("rejects output paths outside JSON mode", () => {
    const result = runEntrySurfaceHelper([
      "--input=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md",
      "--output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces-validation.json",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Use --output with validation only when --json is also passed.",
    );
  });
});
