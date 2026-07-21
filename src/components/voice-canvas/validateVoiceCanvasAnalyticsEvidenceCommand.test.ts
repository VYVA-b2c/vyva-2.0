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
import {
  CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS,
  CANVAS_LAUNCH_FLOW_IDS,
} from "./canvasLaunchReadiness";
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

function freshGeneratedAt(): string {
  return new Date(Date.now() - 60_000).toISOString();
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
    generatedAt: freshGeneratedAt(),
    qaRunUrl: "https://staging.vyva.app",
    source: "real deployed QA staging analytics dashboard export artifact",
    coveredFlows: [...CANVAS_LAUNCH_FLOW_IDS],
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
      "npm run --silent canvas:qa:analytics -- --template",
    );
    expect(result.stdout).toContain(
      "The template is intentionally not launch-ready",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json",
    );
    expect(result.stdout).toContain(
      "Completed can be proven by completed samples or terminal pending samples.",
    );
    expect(result.stdout).toContain(
      "The source must identify real deployed QA, staging, production, or a concrete analytics dashboard/query/export/log artifact.",
    );
    expect(result.stdout).toContain(
      "The source must not name addresses, transcripts, route details, shopping details, provider details, account identifiers",
    );
    expect(result.stdout).toContain("token-bearing URLs");
    expect(result.stdout).toContain("API keys");
    expect(result.stdout).toContain(
      "generatedAt must be a non-future ISO timestamp no older than 7 days.",
    );
    expect(result.stdout).toContain(
      "qaRunUrl must be the deployed non-local QA run URL that produced the aggregate evidence.",
    );
    expect(result.stdout).toContain(
      "coveredFlows must list every launch flow",
    );
    expect(result.stdout).toContain(
      "Allowed envelope values must stay non-identifying",
    );
    expect(result.stdout).toContain("never copies raw sample rows");
    expect(result.stdout).toContain("pass --force only when intentionally");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(
      `--input=artifacts/voice-canvas/${unsafeDatePlaceholder}-analytics-evidence.json`,
    );
  });

  it("prints a privacy-safe analytics evidence template that is not launch-ready", () => {
    const templateResult = runValidator(["--template"]);

    expect(templateResult.status).toBe(0);
    expect(templateResult.stderr).toBe("");

    const template = JSON.parse(templateResult.stdout) as {
      generatedAt: string;
      qaRunUrl: string;
      source: string;
      coveredFlows: string[];
      counts: Record<string, number>;
      samples: unknown[];
    };

    expect(template).toEqual({
      generatedAt: "REPLACE_WITH_NON_FUTURE_ISO_TIMESTAMP_WITHIN_7_DAYS",
      qaRunUrl: "REPLACE_WITH_DEPLOYED_NON_LOCAL_QA_RUN_URL",
      source: "REPLACE_WITH_STAGING_DASHBOARD_QUERY_OR_EXPORT_REFERENCE",
      coveredFlows: [...CANVAS_LAUNCH_FLOW_IDS],
      counts: {
        started: 0,
        resumed: 0,
        abandoned: 0,
        blocked: 0,
        confirmed: 0,
        completed: 0,
      },
      samples: [],
    });

    const serialized = JSON.stringify(template);
    for (const forbiddenDetail of [
      "address",
      "transcript",
      "medication",
      "providerName",
      "replyText",
      "shopping item",
      "phone",
      "email",
      "account id",
      "profile id",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(
        forbiddenDetail.toLowerCase(),
      );
    }

    withTempJsonFile(template, (inputPath) => {
      const validationResult = runValidator([`--input=${inputPath}`, "--json"]);
      const summary = JSON.parse(validationResult.stdout) as {
        readyForLaunchEvidence: boolean;
        problems: string[];
      };

      expect(validationResult.status).toBe(1);
      expect(summary.readyForLaunchEvidence).toBe(false);
      expect(summary.problems).toEqual(
        expect.arrayContaining([
          "Analytics evidence must include generatedAt as a non-future ISO timestamp.",
          "Analytics evidence qaRunUrl must be a deployed HTTPS non-local QA run URL.",
          "Analytics evidence must include sanitized sample envelopes in samples or events.",
          "started: declared aggregate count must be positive.",
          "completed: sample evidence must include a positive observed count.",
        ]),
      );
    });
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
        qaRunUrl: string;
        sampleCount: number;
        allowedEnvelopeFields: string[];
        coveredFlows: string[];
        sampleLaunchSignalCounts: Record<string, number>;
        declaredCounts: Record<string, number>;
        problems: string[];
      };

      expect(summary.readyForLaunchEvidence).toBe(true);
      expect(summary.qaRunUrl).toBe("https://staging.vyva.app");
      expect(summary.sampleCount).toBe(6);
      expect(summary.allowedEnvelopeFields).toEqual([
        ...CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS,
      ]);
      expect(summary.coveredFlows).toEqual([...CANVAS_LAUNCH_FLOW_IDS]);
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

  it("rejects analytics evidence that does not cover every launch flow", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        coveredFlows: [
          "ride",
          "appointment",
          "refill",
          "shopping",
          "123 Secret Street",
        ],
      },
      (inputPath) => {
        const result = runValidator([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          readyForLaunchEvidence: boolean;
          coveredFlows: string[];
          problems: string[];
        };

        expect(summary.readyForLaunchEvidence).toBe(false);
        expect(summary.coveredFlows).toEqual([
          "ride",
          "appointment",
          "refill",
          "shopping",
        ]);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "coveredFlows included 1 value(s) outside the launch flow set.",
            "provider_reply: coveredFlows must include this launch flow.",
            "task_hub_resume: coveredFlows must include this launch flow.",
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("123 Secret Street");
      },
    ));

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
            "Analytics evidence source must identify real deployed QA, staging, production, or a concrete analytics dashboard/query/export/log artifact.",
          ]),
        );
      },
    ));

  it("rejects synthetic analytics source metadata", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        source: "staging synthetic QA analytics export",
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
            "Analytics evidence source must identify real deployed QA, staging, production, or a concrete analytics dashboard/query/export/log artifact.",
          ]),
        );
      },
    ));

  it("rejects local or mock analytics QA run URLs", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        qaRunUrl: "https://mock-staging.vyva.app",
      },
      (inputPath) => {
        const result = runValidator([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          readyForLaunchEvidence: boolean;
          qaRunUrl: string;
          problems: string[];
        };

        expect(summary.readyForLaunchEvidence).toBe(false);
        expect(summary.qaRunUrl).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Analytics evidence qaRunUrl must be a deployed HTTPS non-local QA run URL.",
          ]),
        );
      },
    ));

  it("does not echo query-bearing analytics QA run URLs", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        qaRunUrl: "https://staging.vyva.app?token=secret",
      },
      (inputPath) => {
        const result = runValidator([`--input=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");
        expect(result.stdout).not.toContain("token=secret");

        const summary = JSON.parse(result.stdout) as {
          readyForLaunchEvidence: boolean;
          qaRunUrl: string;
          problems: string[];
        };

        expect(summary.readyForLaunchEvidence).toBe(false);
        expect(summary.qaRunUrl).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Analytics evidence qaRunUrl must be a deployed HTTPS non-local QA run URL.",
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

  it("rejects stale analytics evidence metadata", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        generatedAt: "2000-01-01T00:00:00.000Z",
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
          "Analytics evidence generatedAt must be no older than 7 days.",
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

  it("rejects private details inside allowed sample envelope values without copying them", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        samples: [
          {
            ...validSamples()[0],
            step: "route-details-shopping-item-details-retailer-name-profile-id",
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
        expect(summary.problems).toContain(
          "Sample 1 included 1 allowed envelope value(s) that appear to contain personal or raw captured data.",
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("route-details");
        expect(serialized).not.toContain("shopping-item-details");
        expect(serialized).not.toContain("retailer-name");
        expect(serialized).not.toContain("profile-id");
      },
    ));

  it("rejects secrets inside allowed sample envelope values without copying them", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        samples: [
          {
            ...validSamples()[0],
            step: "review-token=secret",
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
        expect(summary.problems).toContain(
          "Sample 1 included 1 allowed envelope value(s) that appear to contain personal or raw captured data.",
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("token=secret");
      },
    ));

  it("rejects source metadata that names private launch details without echoing it", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        source:
          "staging-dashboard-export-shopping-item-details-retailer-name-route-details-profile-id",
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
        expect(summary.problems).toContain(
          "Analytics evidence source appears to include personal or raw captured data.",
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("shopping-item-details");
        expect(serialized).not.toContain("retailer-name");
        expect(serialized).not.toContain("route-details");
        expect(serialized).not.toContain("profile-id");
      },
    ));

  it("rejects source metadata with secret-bearing links without echoing it", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        source:
          "staging dashboard export https://qa-user:secret-pass@staging.vyva.app/analytics?token=secret",
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
        expect(summary.problems).toContain(
          "Analytics evidence source appears to include personal or raw captured data.",
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("secret-pass");
        expect(serialized).not.toContain("token=secret");
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

  it("rejects fractional aggregate counts and counts lower than observed samples", () =>
    withTempJsonFile(
      {
        ...validEvidence(),
        counts: {
          started: 1.5,
          resumed: 1,
          abandoned: 1,
          blocked: 1,
          confirmed: 1,
          completed: 1,
        },
        samples: [
          ...validSamples(),
          {
            name: "confirmation_submitted",
            step: "review",
            input: "voice",
            attempt: 2,
            restored: false,
          },
        ],
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
            "started: declared count must be a non-negative integer.",
            "started: declared aggregate count must be positive.",
            "confirmed: declared aggregate count cannot be lower than observed sample count.",
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
