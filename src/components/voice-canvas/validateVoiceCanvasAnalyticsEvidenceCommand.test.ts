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
import { CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS } from "./canvasLaunchReadiness";
import type { CanvasTelemetryEnvelope } from "./canvasPlatform";

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const validatorScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-analytics-evidence.ts",
);

function runValidator(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, validatorScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function validSamples(): CanvasTelemetryEnvelope[] {
  return [
    {
      name: "scene_viewed",
      step: "listening",
      input: "voice",
      attempt: 1,
      restored: false,
    },
    {
      name: "draft_restored",
      step: "review",
      input: "system",
      attempt: 1,
      restored: true,
    },
    {
      name: "abandoned",
      step: "review",
      input: "touch_or_keyboard",
      attempt: 1,
      restored: false,
    },
    {
      name: "failed",
      step: "blocked",
      input: "system",
      attempt: 1,
      restored: false,
    },
    {
      name: "confirmation_submitted",
      step: "review",
      input: "touch_or_keyboard",
      attempt: 1,
      restored: false,
    },
    {
      name: "pending",
      step: "pending",
      input: "system",
      attempt: 1,
      restored: false,
    },
  ];
}

function validEvidence() {
  return {
    generatedAt: "2026-07-20T00:00:00.000Z",
    source: "staging synthetic QA analytics export",
    counts: {
      started: 2,
      resumed: 1,
      abandoned: 1,
      blocked: 1,
      confirmed: 1,
      completed: 1,
    },
    samples: validSamples(),
  };
}

function withTempJsonFile<T>(value: unknown, callback: (inputPath: string) => T): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-analytics-"));
  const inputPath = path.join(tempDir, "analytics-evidence.json");
  writeFileSync(inputPath, `${JSON.stringify(value, null, 2)}\n`);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas analytics evidence validator command", () => {
  it("prints copy-safe help for run-specific analytics validation artifacts", () => {
    const result = runValidator(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json",
    );
    expect(result.stdout).toContain(
      "Completed can be proven by completed samples or terminal pending samples.",
    );
    expect(result.stdout).toContain(
      "The source must identify staging, production, or a concrete analytics dashboard/query/export/log artifact.",
    );
    expect(result.stdout).toContain("never copies raw sample rows");
    expect(result.stdout).toContain("pass --force only when intentionally");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(
      `--input=artifacts/voice-canvas/${unsafeDatePlaceholder}-analytics-evidence.json`,
    );
  });

  it("requires an input artifact path", () => {
    const result = runValidator(["--json"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Expected --input=<analytics evidence JSON path>.",
    );
  });

  it("validates positive launch signals with allowed-envelope samples", () =>
    withTempJsonFile(validEvidence(), (inputPath) => {
      const result = runValidator([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        readyForLaunchEvidence: boolean;
        sampleCount: number;
        allowedEnvelopeFields: string[];
        sampleLaunchSignalCounts: Record<string, number>;
        declaredCounts: Record<string, number>;
        problems: string[];
      };

      expect(summary.readyForLaunchEvidence).toBe(true);
      expect(summary.sampleCount).toBe(6);
      expect(summary.allowedEnvelopeFields).toEqual([
        ...CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS,
      ]);
      expect(summary.sampleLaunchSignalCounts).toEqual({
        started: 1,
        resumed: 1,
        abandoned: 1,
        blocked: 1,
        confirmed: 1,
        completed: 1,
      });
      expect(summary.declaredCounts.started).toBe(2);
        expect(summary.problems).toEqual([]);
      }));

  it("rejects event arrays without dated analytics source metadata", () =>
    withTempJsonFile(validSamples(), (inputPath) => {
      const result = runValidator([`--input=${inputPath}`, "--json"]);

      expect(result.status).toBe(1);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        readyForLaunchEvidence: boolean;
        sampleCount: number;
        problems: string[];
      };

      expect(summary.readyForLaunchEvidence).toBe(false);
      expect(summary.sampleCount).toBe(0);
      expect(summary.problems).toEqual(
        expect.arrayContaining(["Analytics evidence must be a JSON object."]),
      );
    }));

  it("rejects local or undated analytics source metadata", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        generatedAt: "not-a-timestamp",
        source: "localhost developer smoke fixture",
      },
      (inputPath) => {
        const result = runValidator([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          readyForLaunchEvidence: boolean;
          problems: string[];
        };

        expect(summary.readyForLaunchEvidence).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Analytics evidence must include generatedAt as a non-future ISO timestamp.",
            "Analytics evidence source must identify staging, production, or a concrete analytics dashboard/query/export/log artifact.",
          ]),
        );
      },
    ));

  it("rejects future-dated analytics evidence metadata", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        generatedAt: "2999-01-01T00:00:00.000Z",
      },
      (inputPath) => {
        const result = runValidator([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          readyForLaunchEvidence: boolean;
          problems: string[];
        };

        expect(summary.readyForLaunchEvidence).toBe(false);
        expect(summary.problems).toContain(
          "Analytics evidence must include generatedAt as a non-future ISO timestamp.",
        );
      },
    ));

  it("rejects unexpected sample fields without copying field names or values", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        samples: [
          {
            ...validSamples()[0],
            pickupAddress: "123 Secret Street",
            transcript: "private spoken detail",
          },
          ...validSamples().slice(1),
        ],
      },
      (inputPath) => {
        const result = runValidator([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          readyForLaunchEvidence: boolean;
          problemCount: number;
          problems: string[];
        };

        expect(summary.readyForLaunchEvidence).toBe(false);
        expect(summary.problemCount).toBeGreaterThan(0);
        expect(summary.problems.join("\n")).toContain(
          "outside the allowed telemetry envelope",
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("123 Secret Street");
        expect(serialized).not.toContain("private spoken detail");
        expect(serialized).not.toContain("pickupAddress");
        expect(serialized).not.toContain("transcript");
      },
    ));

  it("rejects zero aggregate or sample counts for launch signals", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        counts: {
          started: 0,
          resumed: 1,
          abandoned: 1,
          blocked: 1,
          confirmed: 1,
          completed: 1,
        },
        samples: validSamples().filter((sample) => sample.name !== "abandoned"),
      },
      (inputPath) => {
        const result = runValidator([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        const summary = JSON.parse(result.stdout) as {
          readyForLaunchEvidence: boolean;
          problems: string[];
        };

        expect(summary.readyForLaunchEvidence).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "started: declared aggregate count must be positive.",
            "abandoned: sample evidence must include a positive observed count.",
          ]),
        );
      },
    ));

  it("saves validation JSON while preserving existing artifacts by default", () =>
    withTempJsonFile(validEvidence(), (inputPath) => {
      const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-analytics-out-"));
      const outputPath = path.join(tempDir, "analytics-validation.json");

      try {
        const first = runValidator([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(first.status).toBe(0);
        expect(first.stderr).toBe("");
        expect(existsSync(outputPath)).toBe(true);
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(
          JSON.parse(first.stdout),
        );

        writeFileSync(outputPath, '{"existing":true}\n');
        const preserved = runValidator([
          `--input=${inputPath}`,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(preserved.status).toBe(1);
        expect(preserved.stderr).toContain("Output file already exists.");
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual({
          existing: true,
        });

        const forced = runValidator([
          `--input=${inputPath}`,
          "--json",
          "--force",
          `--output=${outputPath}`,
        ]);

        expect(forced.status).toBe(0);
        expect(
          JSON.parse(readFileSync(outputPath, "utf8")).readyForLaunchEvidence,
        ).toBe(true);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }));

  it("rejects output paths outside JSON mode", () =>
    withTempJsonFile(validEvidence(), (inputPath) => {
      const result = runValidator([
        `--input=${inputPath}`,
        "--output=analytics-validation.json",
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Use --output only with --json.");
    }));
});
