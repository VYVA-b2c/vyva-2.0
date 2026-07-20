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
  CANVAS_LAUNCH_FLOW_IDS,
  canvasLaunchReadinessFlows,
} from "./canvasLaunchReadiness";
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

function freshGeneratedAt(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

function generatedAtDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function freshReviewDate(): string {
  return new Date(Date.now() - 60_000).toISOString().slice(0, 10);
}

const launchFeatureFlows = canvasLaunchReadinessFlows.filter(
  (flow) => flow.featureFlag,
);

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
    generatedAt: freshGeneratedAt(),
    source: "staging synthetic QA analytics export",
    coveredFlows: [...CANVAS_LAUNCH_FLOW_IDS],
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

function validFeatureEndpointArtifact(mode: "enabled" | "rollback") {
  const enabled = mode === "enabled";
  const rolloutPercent = mode === "enabled" ? 100 : 0;

  return {
    generatedAt: freshGeneratedAt(),
    baseUrl: "https://staging.vyva.app",
    scope: "VYVA Canvas Launch Readiness + Real-Use QA v1",
    expectedState: mode === "enabled" ? "enabled" : "rollback-disabled",
    endpointCount: launchFeatureFlows.length,
    readyForQaEvidence: true,
    problemCount: 0,
    problems: [],
    featureEndpoints: launchFeatureFlows.map((flow) => ({
      id: flow.id,
      label: flow.label,
      endpoint: flow.featureFlag!.endpoint,
      serverFeatureKey: flow.featureFlag!.serverFeatureKey,
      fallback: flow.featureFlag!.fallback,
      url: `https://staging.vyva.app${flow.featureFlag!.endpoint}`,
      ok: true,
      status: 200,
      cacheControl: "no-store",
      elapsedMs: 25,
      enabled,
      rolloutPercent,
      payloadKeys: ["enabled", "rolloutPercent"],
      unexpectedPayloadKeyCount: 0,
      problems: [],
    })),
  };
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

function withTempFeatureEndpointFiles<T>(
  enabledArtifact: unknown,
  rollbackArtifact: unknown,
  callback: (paths: { enabledPath: string; rollbackPath: string }) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-features-"));
  const enabledPath = path.join(tempDir, "feature-endpoints-enabled.json");
  const rollbackPath = path.join(tempDir, "feature-endpoints-rollback-disabled.json");
  writeFileSync(enabledPath, `${JSON.stringify(enabledArtifact, null, 2)}\n`);
  writeFileSync(rollbackPath, `${JSON.stringify(rollbackArtifact, null, 2)}\n`);

  try {
    return callback({ enabledPath, rollbackPath });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function withTempRollbackOwnerFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-rollback-owner-"));
  const inputPath = path.join(tempDir, "rollback-owner-handoff.md");
  writeFileSync(inputPath, value);

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
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json --features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --rollback-owner=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --runsheet=docs/audits/voice-canvas-real-device-run-sheet.md --matrix=docs/audits/voice-canvas-real-device-qa-matrix.md --packet=docs/audits/voice-canvas-real-device-evidence-packet.md",
    );
    expect(result.stdout).toContain(
      "unless the run sheet, matrix, packet, enabled endpoint artifact, rollback endpoint artifact, analytics evidence, and rollback owner handoff are ready",
    );
    expect(result.stdout).toContain(
      "Final external evidence artifacts must share one QA run date",
    );
    expect(result.stdout).toContain("generated within the last 7 days");
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
      "Run sheet: pending; incomplete 260; problems 0",
    );
    expect(result.stdout).toContain(
      "QA matrix: pending; incomplete 289; failing/not-ready 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Evidence packet: pending; incomplete 12; problems 0",
    );
    expect(result.stdout).toContain(
      "Analytics evidence: not provided; samples 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Rollback owner evidence: not provided; reviewed unknown; problems 0",
    );
    expect(result.stdout).toContain(
      "Feature endpoints enabled: not provided; endpoints 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Feature endpoints rollback: not provided; endpoints 0; problems 0",
    );
    expect(result.stdout).toContain(
      "External evidence run date: not checked; problems 0",
    );
    expect(result.stdout).toContain("Run sheet pending sections:");
    expect(result.stdout).toContain(
      "- Environment preflight: 12 pending cell(s) across 6 row(s)",
    );
    expect(result.stdout).toContain(
      "Run sheet next evidence area: Per-flow behavior pass (180 pending cell(s) across 18 row(s))",
    );
    expect(result.stdout).toContain("QA matrix pending sections:");
    expect(result.stdout).toContain(
      "- Device coverage: 24 pending cell(s) across 6 row(s)",
    );
    expect(result.stdout).toContain(
      "- Analytics privacy review: 16 pending cell(s) across 8 row(s)",
    );
    expect(result.stdout).toContain(
      "QA matrix next evidence area: Required behavior checklist (78 pending cell(s) across 6 row(s))",
    );
    expect(result.stdout).toContain("Evidence packet pending sections:");
    expect(result.stdout).toContain(
      "- Evidence packet inventory: 12 pending cell(s) across 12 row(s)",
    );
    expect(result.stdout).toContain(
      "Evidence packet next evidence area: Evidence packet inventory (12 pending cell(s) across 12 row(s))",
    );
    expect(result.stdout).toContain(
      "Execute the real-device run sheet and record fresh sanitized evidence before final launch sign-off.",
    );
    expect(result.stdout).toContain(
      "Execute fresh real-device and deployed rollback QA, then fill the QA matrix.",
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
      "Execute the real-device run sheet and record fresh sanitized evidence before final launch sign-off.",
    );
    expect(result.stdout).toContain(
      "Fill the sanitized evidence packet artifact references and reviewer/date cells with fresh explicit reviewed, verified, validated, approved, or sign-off wording.",
    );
    expect(result.stdout).toContain(
      "Fill rollback owner handoff artifacts and Operations/rollback owner sign-off evidence before launch.",
    );
    expect(result.stdout).toContain(
      "Execute fresh real-device and deployed rollback QA, then fill the QA matrix.",
    );
    expect(result.stdout).toContain(
      "Provide --features-enabled=<path> for the enabled feature endpoint collector artifact before final launch sign-off.",
    );
    expect(result.stdout).toContain(
      "Provide --features-rollback=<path> for the rollback-disabled feature endpoint collector artifact before final launch sign-off.",
    );
    expect(result.stdout).toContain(
      "Provide --analytics=<path> for the sanitized analytics evidence artifact before final launch sign-off.",
    );
    expect(result.stdout).toContain(
      "Provide --rollback-owner=<path> for the sanitized rollback owner handoff artifact before final launch sign-off.",
    );
    expect(result.stdout).toContain("Run sheet pending sections:");
    expect(result.stdout).toContain("Run sheet next evidence area:");
    expect(result.stdout).toContain("QA matrix pending sections:");
    expect(result.stdout).toContain("QA matrix next evidence area:");
    expect(result.stdout).toContain("Evidence packet pending sections:");
    expect(result.stdout).toContain("Evidence packet next evidence area:");
    expect(result.stdout).toContain("Copy-ready evidence commands:");
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:features -- --trace-template",
    );
    expect(
      result.stdout.indexOf(
        "npm run --silent canvas:qa:features -- --trace-template",
      ),
    ).toBeLessThan(
      result.stdout.indexOf(
        "npm run --silent canvas:qa:analytics -- --template",
      ),
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:analytics -- --template",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json",
    );
    expect(
      result.stdout.indexOf(
        "npm run --silent canvas:qa:analytics -- --template",
      ),
    ).toBeLessThan(
      result.stdout.indexOf(
        "npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json",
      ),
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:preflight -- --final --features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json --features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --rollback-owner=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
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
        problems: string[];
        nextPendingSection: {
          section: string;
          pendingCells: number;
          rowsWithPending: number;
        };
      };
      runSheet: {
        state: string;
        incompleteCellCount: number;
        problemCount: number;
        problems: string[];
        nextPendingSection: {
          section: string;
          pendingCells: number;
          rowsWithPending: number;
        };
      };
      evidencePacket: {
        state: string;
        incompleteCellCount: number;
        problemCount: number;
        problems: string[];
        nextPendingSection: {
          section: string;
          pendingCells: number;
          rowsWithPending: number;
        };
      };
      analyticsEvidence: {
        provided: boolean;
        generatedAt: string;
        readyForLaunchEvidence: boolean;
        sampleCount: number;
        problemCount: number;
        problems: string[];
        coveredFlows: string[];
      };
      rollbackOwnerEvidence: {
        provided: boolean;
        readyForLaunchEvidence: boolean;
        reviewedOn: string;
        requiredFlowCount: number;
        problemCount: number;
        problems: string[];
      };
      featureEndpointEvidence: {
        enabled: {
          provided: boolean;
          generatedAt: string;
          readyForLaunchEvidence: boolean;
          endpointCount: number;
          problemCount: number;
          problems: string[];
        };
        rollback: {
          provided: boolean;
          generatedAt: string;
          readyForLaunchEvidence: boolean;
          endpointCount: number;
          problemCount: number;
          problems: string[];
        };
      };
      externalEvidenceDateConsistency: {
        ready: boolean;
        checked: boolean;
        runDate: string;
        problemCount: number;
        problems: string[];
      };
      nextActions: string[];
      evidenceCommands: string[];
      message: string;
    };

    expect(summary.readyForLaunch).toBe(false);
    expect(summary.finalGate).toBe(false);
    expect(summary.acceptedPending).toBe(true);
    expect(summary.runSheet).toMatchObject({
      state: "pending",
      incompleteCellCount: 260,
      problemCount: 0,
      problems: [],
      nextPendingSection: {
        section: "Per-flow behavior pass",
        pendingCells: 180,
        rowsWithPending: 18,
      },
    });
    expect(summary.matrix).toMatchObject({
      state: "pending",
      incompleteCellCount: 289,
      failingCellCount: 0,
      problemCount: 0,
      problems: [],
      nextPendingSection: {
        section: "Required behavior checklist",
        pendingCells: 78,
        rowsWithPending: 6,
      },
    });
    expect(summary.evidencePacket).toMatchObject({
      state: "pending",
      incompleteCellCount: 12,
      problemCount: 0,
      problems: [],
      nextPendingSection: {
        section: "Evidence packet inventory",
        pendingCells: 12,
        rowsWithPending: 12,
      },
    });
    expect(summary.analyticsEvidence).toMatchObject({
      provided: false,
      generatedAt: "unknown",
      readyForLaunchEvidence: false,
      sampleCount: 0,
      problemCount: 0,
      problems: [],
      coveredFlows: [],
    });
    expect(summary.rollbackOwnerEvidence).toMatchObject({
      provided: false,
      readyForLaunchEvidence: false,
      reviewedOn: "unknown",
      requiredFlowCount: 0,
      problemCount: 0,
      problems: [],
    });
    expect(summary.featureEndpointEvidence.enabled).toMatchObject({
      provided: false,
      generatedAt: "unknown",
      readyForLaunchEvidence: false,
      endpointCount: 0,
      problemCount: 0,
      problems: [],
    });
    expect(summary.externalEvidenceDateConsistency).toEqual({
      ready: false,
      checked: false,
      runDate: "unknown",
      problemCount: 0,
      problems: [],
    });
    expect(summary.featureEndpointEvidence.rollback).toMatchObject({
      provided: false,
      readyForLaunchEvidence: false,
      endpointCount: 0,
      problemCount: 0,
      problems: [],
    });
    expect(summary.nextActions).toEqual(
      expect.arrayContaining([
        "Execute the real-device run sheet and record fresh sanitized evidence before final launch sign-off.",
        "Fill the sanitized evidence packet artifact references and reviewer/date cells with fresh explicit reviewed, verified, validated, approved, or sign-off wording.",
        "Execute fresh real-device and deployed rollback QA, then fill the QA matrix.",
      ]),
    );
    expect(summary.evidenceCommands).toEqual([
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json",
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
      "npm run --silent canvas:qa:features -- --trace-template",
      "npm run --silent canvas:qa:analytics -- --template",
      "npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json",
      "npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
      "npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json",
      "npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-run-sheet-summary.json",
      "npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json",
      "npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json",
      "npm run --silent canvas:qa:preflight -- --final --features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json --features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --rollback-owner=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
    ]);
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
          coveredFlows: string[];
          sampleLaunchSignalCounts: Record<string, number>;
        };
      };

      expect(summary.acceptedPending).toBe(true);
      expect(summary.analyticsEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
        sampleCount: 6,
        problemCount: 0,
        coveredFlows: [...CANVAS_LAUNCH_FLOW_IDS],
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

  it("includes sanitized feature endpoint artifacts in the preflight summary", () =>
    withTempFeatureEndpointFiles(
      validFeatureEndpointArtifact("enabled"),
      validFeatureEndpointArtifact("rollback"),
      ({ enabledPath, rollbackPath }) => {
        const result = runPreflight([
          `--features-enabled=${enabledPath}`,
          `--features-rollback=${rollbackPath}`,
          "--json",
        ]);

        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          acceptedPending: boolean;
          featureEndpointEvidence: {
            enabled: {
              provided: boolean;
              readyForLaunchEvidence: boolean;
              endpointCount: number;
              problemCount: number;
            };
            rollback: {
              provided: boolean;
              readyForLaunchEvidence: boolean;
              endpointCount: number;
              problemCount: number;
            };
          };
        };

        expect(summary.acceptedPending).toBe(true);
        expect(summary.featureEndpointEvidence.enabled).toMatchObject({
          provided: true,
          readyForLaunchEvidence: true,
          endpointCount: launchFeatureFlows.length,
          problemCount: 0,
        });
        expect(summary.featureEndpointEvidence.rollback).toMatchObject({
          provided: true,
          readyForLaunchEvidence: true,
          endpointCount: launchFeatureFlows.length,
          problemCount: 0,
        });
      },
    ));

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

  it("rejects final preflight when external evidence artifacts use different QA run dates", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        generatedAt: generatedAtDaysAgo(2),
      },
      validFeatureEndpointArtifact("rollback"),
      ({ enabledPath, rollbackPath }) =>
        withTempAnalyticsFile(validAnalyticsEvidence(), (analyticsPath) =>
          withTempRollbackOwnerFile(
            validRollbackOwnerHandoffArtifact(),
            (rollbackOwnerPath) => {
              const result = runPreflight([
                "--final",
                `--features-enabled=${enabledPath}`,
                `--features-rollback=${rollbackPath}`,
                `--analytics=${analyticsPath}`,
                `--rollback-owner=${rollbackOwnerPath}`,
                "--json",
              ]);

              expect(result.status).toBe(1);
              expect(result.stderr).toBe("");

              const summary = JSON.parse(result.stdout) as {
                externalEvidenceDateConsistency: {
                  ready: boolean;
                  checked: boolean;
                  runDate: string;
                  problemCount: number;
                  problems: string[];
                };
                nextActions: string[];
              };

              expect(summary.externalEvidenceDateConsistency).toMatchObject({
                ready: false,
                checked: true,
                runDate: "mixed",
                problemCount: 1,
              });
              expect(
                summary.externalEvidenceDateConsistency.problems.join("\n"),
              ).toContain(
                "External launch evidence must share one QA run date",
              );
              expect(summary.nextActions).toContain(
                "Fix external launch evidence dates so endpoint, analytics, and rollback owner artifacts share one QA run date.",
              );
            },
          ),
        ),
    ));

  it("rejects endpoint artifacts that do not prove enabled and rollback states", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        featureEndpoints: validFeatureEndpointArtifact("enabled").featureEndpoints.map(
          (endpoint, index) =>
            index === 0 ? { ...endpoint, rolloutPercent: 50 } : endpoint,
        ),
      },
      {
        ...validFeatureEndpointArtifact("rollback"),
        featureEndpoints: validFeatureEndpointArtifact("rollback").featureEndpoints.map(
          (endpoint, index) => (index === 0 ? { ...endpoint, enabled: true } : endpoint),
        ),
      },
      ({ enabledPath, rollbackPath }) => {
        const result = runPreflight([
          `--features-enabled=${enabledPath}`,
          `--features-rollback=${rollbackPath}`,
          "--json",
        ]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          featureEndpointEvidence: {
            enabled: {
              readyForLaunchEvidence: boolean;
              problemCount: number;
              problems: string[];
            };
            rollback: {
              readyForLaunchEvidence: boolean;
              problemCount: number;
              problems: string[];
            };
          };
          nextActions: string[];
        };

        expect(summary.featureEndpointEvidence.enabled.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.rollback.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.enabled.problemCount).toBeGreaterThan(0);
        expect(summary.featureEndpointEvidence.rollback.problemCount).toBeGreaterThan(0);
        expect(summary.featureEndpointEvidence.enabled.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              "enabled endpoint evidence must report rolloutPercent 100",
            ),
          ]),
        );
        expect(summary.featureEndpointEvidence.rollback.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              "rollback endpoint evidence must report enabled false",
            ),
          ]),
        );
        expect(summary.nextActions).toContain(
          "Fix enabled feature endpoint evidence before launch sign-off.",
        );
        expect(summary.nextActions).toContain(
          "Fix rollback-disabled feature endpoint evidence before launch sign-off.",
        );
      },
    ));

  it("rejects endpoint artifacts captured without the matching expected-state label", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        expectedState: "rollback-disabled",
      },
      {
        ...validFeatureEndpointArtifact("rollback"),
        expectedState: null,
      },
      ({ enabledPath, rollbackPath }) => {
        const result = runPreflight([
          `--features-enabled=${enabledPath}`,
          `--features-rollback=${rollbackPath}`,
          "--json",
        ]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          featureEndpointEvidence: {
            enabled: {
              readyForLaunchEvidence: boolean;
              problemCount: number;
            };
            rollback: { readyForLaunchEvidence: boolean; problemCount: number };
          };
          nextActions: string[];
        };

        expect(summary.featureEndpointEvidence.enabled.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.rollback.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.enabled.problemCount).toBeGreaterThan(0);
        expect(summary.featureEndpointEvidence.rollback.problemCount).toBeGreaterThan(0);
        expect(summary.nextActions).toContain(
          "Fix enabled feature endpoint evidence before launch sign-off.",
        );
        expect(summary.nextActions).toContain(
          "Fix rollback-disabled feature endpoint evidence before launch sign-off.",
        );
      },
    ));

  it("rejects endpoint artifacts with extra out-of-scope rows", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        endpointCount: launchFeatureFlows.length + 1,
        featureEndpoints: [
          ...validFeatureEndpointArtifact("enabled").featureEndpoints,
          {
            id: "unscoped-admin-feature",
            label: "Unscoped admin feature",
            endpoint: "/api/config/features/unscoped-admin-feature",
            serverFeatureKey: "unscopedAdmin",
            fallback: "Unexpected admin panel",
            url: "https://staging.vyva.app/api/config/features/unscoped-admin-feature",
            ok: true,
            status: 200,
            cacheControl: "no-store",
            elapsedMs: 25,
            enabled: true,
            rolloutPercent: 100,
            payloadKeys: ["enabled", "rolloutPercent"],
            unexpectedPayloadKeyCount: 0,
            problems: [],
          },
        ],
      },
      validFeatureEndpointArtifact("rollback"),
      ({ enabledPath, rollbackPath }) => {
        const result = runPreflight([
          `--features-enabled=${enabledPath}`,
          `--features-rollback=${rollbackPath}`,
          "--json",
        ]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          featureEndpointEvidence: {
            enabled: { readyForLaunchEvidence: boolean; problemCount: number };
            rollback: { readyForLaunchEvidence: boolean; problemCount: number };
          };
          nextActions: string[];
        };

        expect(summary.featureEndpointEvidence.enabled.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.enabled.problemCount).toBeGreaterThan(0);
        expect(summary.featureEndpointEvidence.rollback.readyForLaunchEvidence).toBe(
          true,
        );
        expect(summary.nextActions).toContain(
          "Fix enabled feature endpoint evidence before launch sign-off.",
        );
      },
    ));

  it("rejects endpoint artifacts that are not deployed launch evidence", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        baseUrl: "http://staging.vyva.app",
        generatedAt: "not-a-timestamp",
        scope: "developer smoke check",
        featureEndpoints: validFeatureEndpointArtifact("enabled").featureEndpoints.map(
          (endpoint) => ({
            ...endpoint,
            url: endpoint.url.replace("https://staging.vyva.app", "http://staging.vyva.app"),
          }),
        ),
      },
      {
        ...validFeatureEndpointArtifact("rollback"),
        baseUrl: "https://staging.vyva.app",
        featureEndpoints: validFeatureEndpointArtifact("rollback").featureEndpoints.map(
          (endpoint, index) =>
            index === 0
              ? {
                  ...endpoint,
                  url: endpoint.url.replace(
                    "https://staging.vyva.app",
                    "https://other-staging.vyva.app",
                  ),
                }
              : endpoint,
        ),
      },
      ({ enabledPath, rollbackPath }) => {
        const result = runPreflight([
          `--features-enabled=${enabledPath}`,
          `--features-rollback=${rollbackPath}`,
          "--json",
        ]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          featureEndpointEvidence: {
            enabled: {
              readyForLaunchEvidence: boolean;
              problemCount: number;
              problems: string[];
            };
            rollback: { readyForLaunchEvidence: boolean; problemCount: number };
          };
          nextActions: string[];
        };

        expect(summary.featureEndpointEvidence.enabled.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.rollback.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.enabled.problemCount).toBeGreaterThan(0);
        expect(summary.featureEndpointEvidence.enabled.problems).toEqual(
          expect.arrayContaining([
            "Feature endpoint artifact must include a deployed HTTPS non-local baseUrl origin.",
          ]),
        );
        expect(summary.featureEndpointEvidence.rollback.problemCount).toBeGreaterThan(0);
        expect(summary.nextActions).toContain(
          "Fix enabled feature endpoint evidence before launch sign-off.",
        );
        expect(summary.nextActions).toContain(
          "Fix rollback-disabled feature endpoint evidence before launch sign-off.",
        );
      },
    ));

  it("rejects future-dated endpoint artifacts", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        generatedAt: "2999-01-01T00:00:00.000Z",
      },
      validFeatureEndpointArtifact("rollback"),
      ({ enabledPath, rollbackPath }) => {
        const result = runPreflight([
          `--features-enabled=${enabledPath}`,
          `--features-rollback=${rollbackPath}`,
          "--json",
        ]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          featureEndpointEvidence: {
            enabled: { readyForLaunchEvidence: boolean; problemCount: number };
            rollback: { readyForLaunchEvidence: boolean; problemCount: number };
          };
          nextActions: string[];
        };

        expect(summary.featureEndpointEvidence.enabled.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.rollback.readyForLaunchEvidence).toBe(
          true,
        );
        expect(summary.featureEndpointEvidence.enabled.problemCount).toBeGreaterThan(0);
        expect(summary.nextActions).toContain(
          "Fix enabled feature endpoint evidence before launch sign-off.",
        );
      },
    ));

  it("rejects stale endpoint artifacts", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        generatedAt: "2000-01-01T00:00:00.000Z",
      },
      validFeatureEndpointArtifact("rollback"),
      ({ enabledPath, rollbackPath }) => {
        const result = runPreflight([
          `--features-enabled=${enabledPath}`,
          `--features-rollback=${rollbackPath}`,
          "--json",
        ]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          featureEndpointEvidence: {
            enabled: { readyForLaunchEvidence: boolean; problemCount: number };
            rollback: { readyForLaunchEvidence: boolean; problemCount: number };
          };
          nextActions: string[];
        };

        expect(summary.featureEndpointEvidence.enabled.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.rollback.readyForLaunchEvidence).toBe(
          true,
        );
        expect(summary.featureEndpointEvidence.enabled.problemCount).toBeGreaterThan(0);
        expect(summary.nextActions).toContain(
          "Fix enabled feature endpoint evidence before launch sign-off.",
        );
      },
    ));

  it("rejects forged-ready endpoint artifacts with cacheable rows or embedded problems", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        problemCount: 1,
        problems: ["hidden endpoint issue"],
        featureEndpoints: validFeatureEndpointArtifact("enabled").featureEndpoints.map(
          (endpoint, index) =>
            index === 0
              ? {
                  ...endpoint,
                  cacheControl: "public, max-age=300",
                  problems: ["cacheable response"],
                }
              : endpoint,
        ),
      },
      validFeatureEndpointArtifact("rollback"),
      ({ enabledPath, rollbackPath }) => {
        const result = runPreflight([
          `--features-enabled=${enabledPath}`,
          `--features-rollback=${rollbackPath}`,
          "--json",
        ]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          featureEndpointEvidence: {
            enabled: { readyForLaunchEvidence: boolean; problemCount: number };
            rollback: { readyForLaunchEvidence: boolean; problemCount: number };
          };
          nextActions: string[];
        };

        expect(summary.featureEndpointEvidence.enabled.readyForLaunchEvidence).toBe(
          false,
        );
        expect(summary.featureEndpointEvidence.enabled.problemCount).toBeGreaterThan(0);
        expect(summary.featureEndpointEvidence.rollback.readyForLaunchEvidence).toBe(
          true,
        );
        expect(summary.nextActions).toContain(
          "Fix enabled feature endpoint evidence before launch sign-off.",
        );
      },
    ));

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
            problems: string[];
          };
          nextActions: string[];
        };

        expect(summary.analyticsEvidence).toMatchObject({
          provided: true,
          readyForLaunchEvidence: false,
        });
        expect(summary.analyticsEvidence.problemCount).toBeGreaterThan(0);
        expect(summary.analyticsEvidence.problems.join("\n")).toContain(
          "outside the allowed telemetry envelope",
        );
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

  it("prints sanitized problem details in human-readable preflight output", () =>
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
        const result = runPreflight([`--analytics=${inputPath}`]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("Analytics evidence problems:");
        expect(result.stdout).toContain("outside the allowed telemetry envelope");
        expect(result.stdout).toContain(
          "Fix sanitized analytics evidence before launch sign-off.",
        );
        expect(result.stdout).not.toContain("123 Secret Street");
        expect(result.stdout).not.toContain("private spoken detail");
        expect(result.stdout).not.toContain("pickupAddress");
        expect(result.stdout).not.toContain("transcript");
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

  it("rejects empty feature endpoint artifact paths", () => {
    const enabledResult = runPreflight(["--features-enabled="]);
    const rollbackResult = runPreflight(["--features-rollback="]);

    expect(enabledResult.status).toBe(1);
    expect(enabledResult.stderr).toContain("Expected --features-enabled=<path>.");
    expect(rollbackResult.status).toBe(1);
    expect(rollbackResult.stderr).toContain("Expected --features-rollback=<path>.");
  });

  it("rejects empty rollback owner handoff artifact paths", () => {
    const result = runPreflight(["--rollback-owner="]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --rollback-owner=<path>.");
  });
});
