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
import type { CanvasTelemetryEnvelope } from "./canvasPlatform";

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const preflightScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "preflight-voice-canvas-launch-readiness.ts",
);

function runPreflight(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, preflightScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function validAnalyticsSamples(): CanvasTelemetryEnvelope[] {
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

function validAnalyticsEvidence() {
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
    samples: validAnalyticsSamples(),
  };
}

function withTempAnalyticsFile<T>(
  value: unknown,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-analytics-"));
  const inputPath = path.join(tempDir, "analytics-evidence.json");
  writeFileSync(inputPath, `${JSON.stringify(value, null, 2)}\n`);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas launch readiness preflight command", () => {
  it("prints a copy-safe preflight runbook", () => {
    const result = runPreflight(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("npm run canvas:qa:preflight -- --final");
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:preflight -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json",
    );
    expect(result.stdout).toContain("This preflight is read-only");
    expect(result.stdout).not.toContain("<YYYY-MM-DD>");
  });

  it("accepts the committed pending launch gates as a structural preflight", () => {
    const result = runPreflight();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Voice Canvas launch QA preflight");
    expect(result.stdout).toContain("Final gate mode: no");
    expect(result.stdout).toContain("Ready for launch: no");
    expect(result.stdout).toContain(
      "QA matrix: pending; incomplete 280; failing/not-ready 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Evidence packet: pending; incomplete 9; problems 0",
    );
    expect(result.stdout).toContain(
      "Analytics evidence: not provided; samples 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Execute real-device and deployed rollback QA, then fill the QA matrix.",
    );
    expect(result.stdout).toContain(
      "Voice Canvas launch evidence gates are structurally valid but still pending real-device QA.",
    );
  });

  it("fails final gate mode while real-device evidence is pending", () => {
    const result = runPreflight(["--final"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Final gate mode: yes");
    expect(result.stdout).toContain("Ready for launch: no");
    expect(result.stdout).toContain(
      "Fill the sanitized evidence packet artifact references and reviewer/date cells.",
    );
    expect(result.stdout).toContain(
      "Execute real-device and deployed rollback QA, then fill the QA matrix.",
    );
    expect(result.stdout).toContain(
      "Provide --analytics=<path> for the sanitized analytics evidence artifact before final launch sign-off.",
    );
  });

  it("emits machine-readable JSON for launch readiness artifacts", () => {
    const result = runPreflight(["--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      readyForLaunch: boolean;
      finalGate: boolean;
      acceptedPending: boolean;
      matrix: {
        state: string;
        incompleteCellCount: number;
        failingCellCount: number;
        problemCount: number;
      };
      evidencePacket: {
        state: string;
        incompleteCellCount: number;
        problemCount: number;
      };
      analyticsEvidence: {
        provided: boolean;
        readyForLaunchEvidence: boolean;
        sampleCount: number;
        problemCount: number;
      };
      nextActions: string[];
      message: string;
    };

    expect(summary.readyForLaunch).toBe(false);
    expect(summary.finalGate).toBe(false);
    expect(summary.acceptedPending).toBe(true);
    expect(summary.matrix).toMatchObject({
      state: "pending",
      incompleteCellCount: 280,
      failingCellCount: 0,
      problemCount: 0,
    });
    expect(summary.evidencePacket).toMatchObject({
      state: "pending",
      incompleteCellCount: 9,
      problemCount: 0,
    });
    expect(summary.analyticsEvidence).toMatchObject({
      provided: false,
      readyForLaunchEvidence: false,
      sampleCount: 0,
      problemCount: 0,
    });
    expect(summary.nextActions).toEqual(
      expect.arrayContaining([
        "Fill the sanitized evidence packet artifact references and reviewer/date cells.",
        "Execute real-device and deployed rollback QA, then fill the QA matrix.",
      ]),
    );
    expect(summary.message).toBe(
      "Voice Canvas launch evidence gates are structurally valid but still pending real-device QA.",
    );
  });

  it("includes sanitized analytics evidence in the preflight summary", () =>
    withTempAnalyticsFile(validAnalyticsEvidence(), (inputPath) => {
      const result = runPreflight([`--analytics=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        acceptedPending: boolean;
        analyticsEvidence: {
          provided: boolean;
          readyForLaunchEvidence: boolean;
          sampleCount: number;
          problemCount: number;
          sampleLaunchSignalCounts: Record<string, number>;
        };
      };

      expect(summary.acceptedPending).toBe(true);
      expect(summary.analyticsEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
        sampleCount: 6,
        problemCount: 0,
      });
      expect(summary.analyticsEvidence.sampleLaunchSignalCounts).toMatchObject({
        started: 1,
        resumed: 1,
        abandoned: 1,
        blocked: 1,
        confirmed: 1,
        completed: 1,
      });
    }));

  it("fails unsafe analytics evidence without echoing personal fields or values", () =>
    withTempAnalyticsFile(
      {
        ...validAnalyticsEvidence(),
        samples: [
          {
            ...validAnalyticsSamples()[0],
            pickupAddress: "123 Secret Street",
            transcript: "private spoken detail",
          },
          ...validAnalyticsSamples().slice(1),
        ],
      },
      (inputPath) => {
        const result = runPreflight([`--analytics=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          analyticsEvidence: {
            provided: boolean;
            readyForLaunchEvidence: boolean;
            problemCount: number;
          };
          nextActions: string[];
        };

        expect(summary.analyticsEvidence).toMatchObject({
          provided: true,
          readyForLaunchEvidence: false,
        });
        expect(summary.analyticsEvidence.problemCount).toBeGreaterThan(0);
        expect(summary.nextActions).toContain(
          "Fix sanitized analytics evidence before launch sign-off.",
        );
        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("123 Secret Street");
        expect(serialized).not.toContain("private spoken detail");
        expect(serialized).not.toContain("pickupAddress");
        expect(serialized).not.toContain("transcript");
      },
    ));

  it("saves JSON summaries while preserving existing artifacts by default", () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-"));
    const outputPath = path.join(tempDir, "launch-preflight.json");

    try {
      const first = runPreflight(["--json", `--output=${outputPath}`]);

      expect(first.status).toBe(0);
      expect(first.stderr).toBe("");
      expect(existsSync(outputPath)).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(
        JSON.parse(first.stdout),
      );

      writeFileSync(outputPath, '{"existing":true}\n');
      const preserved = runPreflight(["--json", `--output=${outputPath}`]);

      expect(preserved.status).toBe(1);
      expect(preserved.stderr).toContain("Output file already exists.");
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual({
        existing: true,
      });

      const forced = runPreflight([
        "--json",
        "--force",
        `--output=${outputPath}`,
      ]);

      expect(forced.status).toBe(0);
      expect(JSON.parse(readFileSync(outputPath, "utf8")).acceptedPending).toBe(
        true,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects output paths outside JSON mode", () => {
    const result = runPreflight(["--output=launch-preflight.json"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use --output only with --json.");
  });

  it("rejects empty analytics artifact paths", () => {
    const result = runPreflight(["--analytics="]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --analytics=<path>.");
  });
});
