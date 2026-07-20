// @vitest-environment node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { buildSync } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CANVAS_LAUNCH_FLOW_IDS,
  canvasLaunchEvidenceFlowCoverage,
  canvasLaunchReadinessFlows,
} from "./canvasLaunchReadiness";
import type { CanvasTelemetryEnvelope } from "./canvasPlatform";

const preflightScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "preflight-voice-canvas-launch-readiness.ts",
);
let bundledPreflightDir: string | null = null;
let bundledPreflightScriptPath = preflightScriptPath;

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

function runPreflight(args: string[] = []) {
  return spawnSync(process.execPath, [bundledPreflightScriptPath, ...args], {
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

function artifactPathsForRunDate(runDate: string) {
  const prefix = `artifacts/voice-canvas/${runDate}`;
  return {
    enabledEndpoints: `${prefix}-feature-endpoints-enabled.json`,
    rollbackEndpoints: `${prefix}-feature-endpoints-rollback-disabled.json`,
    analyticsEvidence: `${prefix}-analytics-evidence.json`,
    analyticsValidation: `${prefix}-analytics-validation.json`,
    copyEvidence: `${prefix}-copy-clarity.md`,
    copyValidation: `${prefix}-copy-clarity-validation.json`,
    recoveryEvidence: `${prefix}-recovery-behavior.md`,
    recoveryValidation: `${prefix}-recovery-behavior-validation.json`,
    realUseEvidence: `${prefix}-real-use-coverage.md`,
    realUseValidation: `${prefix}-real-use-validation.json`,
    entrySurfaces: `${prefix}-entry-surfaces.md`,
    entrySurfacesValidation: `${prefix}-entry-surfaces-validation.json`,
    rollbackOwnerHandoff: `${prefix}-rollback-owner-handoff.md`,
    rollbackOwnerValidation: `${prefix}-rollback-owner-validation.json`,
    runSheetSummary: `${prefix}-run-sheet-summary.json`,
    qaMatrixSummary: `${prefix}-qa-summary.json`,
    evidencePacketSummary: `${prefix}-evidence-packet-summary.json`,
    launchPreflight: `${prefix}-launch-preflight.json`,
    launchRunPlan: `${prefix}-launch-evidence-run.json`,
  };
}

function launchEvidenceCommandsForRun(
  runDate: string,
  baseUrl: string,
  requestHeaderEnvRefs: string[] = [],
): string[] {
  const paths = artifactPathsForRunDate(runDate);
  const requestHeaderArgs = requestHeaderEnvRefs
    .map((ref) => ` --request-header-env=${ref}`)
    .join("");

  return [
    `npm run --silent canvas:qa:run -- --date=${runDate} --base-url=${baseUrl}${requestHeaderArgs} --json --output=${paths.launchRunPlan}`,
    `npm run --silent canvas:qa:features -- --base-url=${baseUrl} --expected-state=enabled --json --output=${paths.enabledEndpoints}${requestHeaderArgs}`,
    `npm run --silent canvas:qa:features -- --base-url=${baseUrl} --expected-state=rollback-disabled --json --output=${paths.rollbackEndpoints}${requestHeaderArgs}`,
    "npm run --silent canvas:qa:features -- --trace-template",
    "npm run --silent canvas:qa:analytics -- --template",
    `npm run --silent canvas:qa:analytics -- --input=${paths.analyticsEvidence} --json --output=${paths.analyticsValidation}`,
    `npm run --silent canvas:qa:copy -- --template --output=${paths.copyEvidence}`,
    `npm run --silent canvas:qa:copy -- --input=${paths.copyEvidence} --json --output=${paths.copyValidation}`,
    `npm run --silent canvas:qa:recovery -- --template --output=${paths.recoveryEvidence}`,
    `npm run --silent canvas:qa:recovery -- --input=${paths.recoveryEvidence} --json --output=${paths.recoveryValidation}`,
    `npm run --silent canvas:qa:real-use -- --template --output=${paths.realUseEvidence}`,
    `npm run --silent canvas:qa:real-use -- --input=${paths.realUseEvidence} --json --output=${paths.realUseValidation}`,
    `npm run --silent canvas:qa:entry-surfaces -- --template --output=${paths.entrySurfaces}`,
    `npm run --silent canvas:qa:entry-surfaces -- --input=${paths.entrySurfaces} --json --output=${paths.entrySurfacesValidation}`,
    `npm run --silent canvas:qa:rollback-owner -- --template --output=${paths.rollbackOwnerHandoff}`,
    `npm run --silent canvas:qa:rollback-owner -- --input=${paths.rollbackOwnerHandoff} --json --output=${paths.rollbackOwnerValidation}`,
    `npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=${paths.runSheetSummary}`,
    `npm run --silent canvas:qa:validate -- --allow-pending --json --output=${paths.qaMatrixSummary}`,
    `npm run --silent canvas:qa:packet -- --allow-pending --json --output=${paths.evidencePacketSummary}`,
    `npm run --silent canvas:qa:preflight -- --final --date=${runDate} --json --output=${paths.launchPreflight}`,
  ];
}

function validLaunchRunPlan(
  runDate: string,
  baseUrl = "https://staging.vyva.app",
  requestHeaderEnvRefs: string[] = [],
) {
  return {
    readyForEvidenceRun: true,
    runDate,
    baseUrl,
    artifactDirectory: "artifacts/voice-canvas",
    artifactPaths: artifactPathsForRunDate(runDate),
    requestHeaderEnv: requestHeaderEnvRefs,
    authenticatedRequest: requestHeaderEnvRefs.length > 0,
    commands: launchEvidenceCommandsForRun(runDate, baseUrl, requestHeaderEnvRefs),
    flowCoverage: canvasLaunchEvidenceFlowCoverage(),
    checklist: [
      "Collect enabled endpoint evidence before rollback evidence.",
      "Fill analytics evidence from aggregate-only staging or production-like telemetry.",
      "Fill copy clarity evidence from senior-friendly copy, what-happens-next, long-label, focus, announcement, and reduced-motion review.",
      "Fill recovery behavior evidence from resume, refresh, back, reconnect, interruption, cancel, retry, duplicate, and stale-response coverage.",
      "Fill real-use evidence from real physical phone, tablet, desktop/laptop, voice, touch, and keyboard coverage.",
      "Fill entry surface evidence from every canonical launch surface without writes or external actions before confirmation.",
      "Fill rollback owner handoff with deployed QA run URL, owner, backup, decision window, trigger, action, fallback, privacy, and no-side-effect proof.",
      "Execute every flow on real phone, tablet, and desktop/laptop sessions using voice, touch, and keyboard paths.",
      "Verify refresh, browser back, app exit/reopen, reconnect, voice interruption, cancel/exit, retry, and duplicate/stale-response recovery with entered information preserved.",
      "Verify feature-flag rollback closes or hides Canvas in an open session and restores the named existing fallback path without writes or external actions.",
      "Review senior-friendly copy for one clear decision, readable long Spanish labels, waiting/blocked/completed announcements, focus movement, reduced motion, and what-happens-next clarity.",
      "Copy only sanitized artifact references into the evidence packet and QA matrix.",
      "Run final preflight with the same run-date artifact paths through --date.",
    ],
    privacyBoundary: [
      "No addresses, saved-place labels, transcripts, typed text, medication details, provider details, shopping details, contact details, account identifiers, raw endpoint bodies, or personal data.",
      "Use aggregate counts, allowed Canvas telemetry envelope fields, sanitized screenshots/photos/logs, and dated artifact references only.",
    ],
    sameRunDateRequired: true,
    message:
      "Voice Canvas launch evidence run plan is ready. Use these same-date paths for final evidence collection.",
  };
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

function validFeatureEndpointArtifact(
  mode: "enabled" | "rollback",
  options: { authenticatedRequest?: boolean; requestHeaderCount?: number } = {},
) {
  const enabled = mode === "enabled";
  const rolloutPercent = mode === "enabled" ? 100 : 0;
  const authenticatedRequest = options.authenticatedRequest ?? false;
  const requestHeaderCount = options.requestHeaderCount ?? 0;

  return {
    generatedAt: freshGeneratedAt(),
    baseUrl: "https://staging.vyva.app",
    scope: "VYVA Canvas Launch Readiness + Real-Use QA v1",
    expectedState: mode === "enabled" ? "enabled" : "rollback-disabled",
    authenticatedRequest,
    requestHeaderCount,
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
      `| ${flow.label} | start and resume restored current work with entered information preserved, no write, no resubmission, and no external action | app exit and reopen restored draft with entered information preserved, no write, no resubmission, and no external action | refresh and reconnect restored work with entered information preserved, no write, no resubmission, and no external action | voice interruption recovered current work with entered information preserved, no write, no resubmission, and no external action | browser back returned safely with entered information preserved, no write, and no external action | cancel and exit left safely with no write and no external action | recoverable failure offered retry and exit with entered information preserved, no write, no resubmission, and no external action | duplicate confirmation prevented and stale response ignored or discarded | artifacts/voice-canvas/${reviewedOn}/${flow.id}-recovery-behavior-resume-reconnect-screenshot-log-recording-capture-artifact.md | reviewed by QA Launch Reviewer on ${reviewedOn} |`,
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

function withTempRealUseFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-real-use-"));
  const inputPath = path.join(tempDir, "real-use.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function withTempCopyFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-copy-"));
  const inputPath = path.join(tempDir, "copy-clarity.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function withTempRecoveryFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-recovery-"));
  const inputPath = path.join(tempDir, "recovery-behavior.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function withTempEntrySurfaceFile<T>(
  value: string,
  callback: (inputPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-preflight-entry-surfaces-"));
  const inputPath = path.join(tempDir, "entry-surfaces.md");
  writeFileSync(inputPath, value);

  try {
    return callback(inputPath);
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

function withLaunchRunPlanArtifact<T>(
  runDate: string,
  value: unknown,
  callback: (inputPath: string) => T,
): T {
  const relativePath = artifactPathsForRunDate(runDate).launchRunPlan;
  const inputPath = path.resolve(process.cwd(), relativePath);

  if (existsSync(inputPath)) {
    throw new Error(`Refusing to overwrite existing test launch run plan: ${relativePath}`);
  }

  mkdirSync(path.dirname(inputPath), { recursive: true });
  writeFileSync(inputPath, `${JSON.stringify(value, null, 2)}\n`);

  try {
    return callback(relativePath);
  } finally {
    rmSync(inputPath, { force: true });
  }
}

function withStandardLaunchBundleArtifacts<T>(
  runDate: string,
  callback: () => T,
): T {
  const paths = artifactPathsForRunDate(runDate);
  const artifacts: Record<string, string> = {
    [paths.launchRunPlan]: `${JSON.stringify(validLaunchRunPlan(runDate), null, 2)}\n`,
    [paths.enabledEndpoints]: `${JSON.stringify(validFeatureEndpointArtifact("enabled"), null, 2)}\n`,
    [paths.rollbackEndpoints]: `${JSON.stringify(validFeatureEndpointArtifact("rollback"), null, 2)}\n`,
    [paths.analyticsEvidence]: `${JSON.stringify(validAnalyticsEvidence(), null, 2)}\n`,
    [paths.copyEvidence]: validCopyEvidenceArtifact(),
    [paths.recoveryEvidence]: validRecoveryEvidenceArtifact(),
    [paths.realUseEvidence]: validRealUseEvidenceArtifact(),
    [paths.entrySurfaces]: validEntrySurfaceEvidenceArtifact(),
    [paths.rollbackOwnerHandoff]: validRollbackOwnerHandoffArtifact(),
  };
  const previous = new Map<string, string | null>();

  for (const relativePath of Object.keys(artifacts)) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    previous.set(
      relativePath,
      existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null,
    );
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, artifacts[relativePath]);
  }

  try {
    return callback();
  } finally {
    for (const [relativePath, originalContent] of previous) {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      if (originalContent === null) {
        rmSync(absolutePath, { force: true });
      } else {
        writeFileSync(absolutePath, originalContent);
      }
    }
  }
}

describe("Voice Canvas launch readiness preflight command", () => {
  it("prints a copy-safe preflight runbook", () => {
    const result = runPreflight(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("npm run canvas:qa:preflight -- --final --date=YYYY-MM-DD");
    expect(result.stdout).not.toContain("  npm run canvas:qa:preflight -- --final\n");
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:preflight -- --final --date=YYYY-MM-DD --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:preflight -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --copy=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --recovery=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --real-use=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --entry-surfaces=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json --features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --rollback-owner=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --run-plan=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json",
    );
    expect(result.stdout).toContain(
      "Pass --date=YYYY-MM-DD to validate the standard same-date launch evidence bundle without hand-assembling every artifact path.",
    );
    expect(result.stdout).toContain(
      "Use --final --date=YYYY-MM-DD for launch sign-off; plain --final is only for custom explicit artifact-path diagnostics.",
    );
    expect(result.stdout).toContain(
      "npm run canvas:qa:preflight -- --runsheet=docs/audits/voice-canvas-real-device-run-sheet.md --matrix=docs/audits/voice-canvas-real-device-qa-matrix.md --packet=docs/audits/voice-canvas-real-device-evidence-packet.md",
    );
    expect(result.stdout).toContain(
      "unless the run sheet, matrix, packet, launch run plan, enabled endpoint artifact, rollback endpoint artifact, analytics evidence, copy clarity evidence, recovery behavior evidence, real-use evidence, entry surface evidence, and rollback owner handoff are ready",
    );
    expect(result.stdout).toContain(
      "Final external evidence artifacts must share one QA run date",
    );
    expect(result.stdout).toContain(
      "Final external evidence artifacts with QA URLs must share one deployed QA origin",
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
      "QA matrix: pending; incomplete 313; failing/not-ready 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Evidence packet: pending; incomplete 14; problems 0",
    );
    expect(result.stdout).toContain(
      "Launch run plan: not provided; date unknown; request headers 0; commands 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Analytics evidence: not provided; samples 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Copy clarity evidence: not provided; reviewed unknown; copy rows 0; problems 0",
    );
    expect(result.stdout).toContain(
      "Recovery behavior evidence: not provided; reviewed unknown; recovery rows 0; problems 0",
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
    expect(result.stdout).toContain(
      "External evidence origin: not checked; problems 0",
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
      "- Entry surface coverage: 18 pending cell(s) across 6 row(s)",
    );
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
      "- Evidence packet inventory: 14 pending cell(s) across 14 row(s)",
    );
    expect(result.stdout).toContain(
      "Evidence packet next evidence area: Evidence packet inventory (14 pending cell(s) across 14 row(s))",
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
      "For final launch sign-off, rerun with --date=YYYY-MM-DD so the same-date evidence bundle cannot accidentally omit required artifacts.",
    );
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
      "Provide --run-plan=<path> for the same-date launch evidence run plan before final launch sign-off.",
    );
    expect(result.stdout).toContain(
      "Provide --analytics=<path> for the sanitized analytics evidence artifact before final launch sign-off.",
    );
    expect(result.stdout).toContain(
      "Provide --copy=<path> for the sanitized copy clarity evidence artifact before final launch sign-off.",
    );
    expect(result.stdout).toContain(
      "Provide --recovery=<path> for the sanitized recovery behavior evidence artifact before final launch sign-off.",
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
      "npm run --silent canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json",
    );
    expect(
      result.stdout.indexOf(
        "npm run --silent canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json",
      ),
    ).toBeLessThan(
      result.stdout.indexOf(
        "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json",
      ),
    );
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
      "npm run --silent canvas:qa:copy -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:copy -- --input=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity-validation.json",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:recovery -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:recovery -- --input=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior-validation.json",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:real-use -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:real-use -- --input=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-validation.json",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:entry-surfaces -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:entry-surfaces -- --input=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces-validation.json",
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
      "npm run --silent canvas:qa:preflight -- --final --date=YYYY-MM-DD --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
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
      launchBundleDate: string;
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
      launchRunPlan: {
        provided: boolean;
        readyForLaunchEvidence: boolean;
        runDate: string;
        baseUrl: string;
        commandCount: number;
        flowCount: number;
        canonicalFlowCoverage: ReturnType<typeof canvasLaunchEvidenceFlowCoverage>;
        problemCount: number;
        problems: string[];
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
      copyEvidence: {
        provided: boolean;
        readyForLaunchEvidence: boolean;
        reviewedOn: string;
        requiredFlowCount: number;
        requiredCopyRowCount: number;
        problemCount: number;
        problems: string[];
      };
      recoveryEvidence: {
        provided: boolean;
        readyForLaunchEvidence: boolean;
        reviewedOn: string;
        requiredFlowCount: number;
        requiredRecoveryRowCount: number;
        problemCount: number;
        problems: string[];
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
      externalEvidenceOriginConsistency: {
        ready: boolean;
        checked: boolean;
        origin: string;
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
    expect(summary.launchBundleDate).toBe("not provided");
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
      incompleteCellCount: 313,
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
      incompleteCellCount: 14,
      problemCount: 0,
      problems: [],
      nextPendingSection: {
        section: "Evidence packet inventory",
        pendingCells: 14,
        rowsWithPending: 14,
      },
    });
    expect(summary.launchRunPlan).toEqual({
      provided: false,
      path: "unknown",
      readyForLaunchEvidence: false,
      runDate: "unknown",
      baseUrl: "unknown",
      requestHeaderCount: 0,
      commandCount: 0,
      flowCount: 0,
      canonicalFlowCoverage: [],
      problemCount: 0,
      problems: [],
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
    expect(summary.copyEvidence).toMatchObject({
      provided: false,
      readyForLaunchEvidence: false,
      reviewedOn: "unknown",
      requiredFlowCount: 0,
      requiredCopyRowCount: 0,
      problemCount: 0,
      problems: [],
    });
    expect(summary.recoveryEvidence).toMatchObject({
      provided: false,
      readyForLaunchEvidence: false,
      reviewedOn: "unknown",
      requiredFlowCount: 0,
      requiredRecoveryRowCount: 0,
      problemCount: 0,
      problems: [],
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
    expect(summary.externalEvidenceOriginConsistency).toEqual({
      ready: false,
      checked: false,
      origin: "unknown",
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
      "npm run --silent canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json",
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json",
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
      "npm run --silent canvas:qa:features -- --trace-template",
      "npm run --silent canvas:qa:analytics -- --template",
      "npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json",
      "npm run --silent canvas:qa:copy -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md",
      "npm run --silent canvas:qa:copy -- --input=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity-validation.json",
      "npm run --silent canvas:qa:recovery -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md",
      "npm run --silent canvas:qa:recovery -- --input=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior-validation.json",
      "npm run --silent canvas:qa:real-use -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md",
      "npm run --silent canvas:qa:real-use -- --input=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-validation.json",
      "npm run --silent canvas:qa:entry-surfaces -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md",
      "npm run --silent canvas:qa:entry-surfaces -- --input=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces-validation.json",
      "npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
      "npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json",
      "npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-run-sheet-summary.json",
      "npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json",
      "npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json",
      "npm run --silent canvas:qa:preflight -- --final --date=YYYY-MM-DD --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
    ]);
    expect(summary.message).toBe(
      "Voice Canvas launch evidence gates are structurally valid but still pending real-device QA.",
    );
  });

  it("resolves the standard same-date launch evidence bundle with --date", () => {
    const runDate = freshReviewDate();

    withStandardLaunchBundleArtifacts(runDate, () => {
      const result = runPreflight([`--date=${runDate}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        launchBundleDate: string;
        launchRunPlan: {
          provided: boolean;
          readyForLaunchEvidence: boolean;
          runDate: string;
          commandCount: number;
        };
        featureEndpointEvidence: {
          enabled: { provided: boolean; readyForLaunchEvidence: boolean };
          rollback: { provided: boolean; readyForLaunchEvidence: boolean };
        };
        analyticsEvidence: { provided: boolean; readyForLaunchEvidence: boolean };
        copyEvidence: { provided: boolean; readyForLaunchEvidence: boolean };
        recoveryEvidence: { provided: boolean; readyForLaunchEvidence: boolean };
        realUseEvidence: { provided: boolean; readyForLaunchEvidence: boolean };
        entrySurfaceEvidence: { provided: boolean; readyForLaunchEvidence: boolean };
        rollbackOwnerEvidence: { provided: boolean; readyForLaunchEvidence: boolean };
        externalEvidenceDateConsistency: {
          checked: boolean;
          ready: boolean;
          runDate: string;
          problemCount: number;
        };
        externalEvidenceOriginConsistency: {
          checked: boolean;
          ready: boolean;
          origin: string;
          problemCount: number;
        };
      };

      expect(summary.launchBundleDate).toBe(runDate);
      expect(summary.launchRunPlan).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
        runDate,
        commandCount: 20,
      });
      expect(summary.featureEndpointEvidence.enabled).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
      });
      expect(summary.featureEndpointEvidence.rollback).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
      });
      expect(summary.analyticsEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
      });
      expect(summary.copyEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
      });
      expect(summary.recoveryEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
      });
      expect(summary.realUseEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
      });
      expect(summary.entrySurfaceEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
      });
      expect(summary.rollbackOwnerEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
      });
      expect(summary.externalEvidenceDateConsistency).toMatchObject({
        checked: true,
        ready: true,
        runDate,
        problemCount: 0,
      });
      expect(summary.externalEvidenceOriginConsistency).toMatchObject({
        checked: true,
        ready: true,
        origin: "https://staging.vyva.app",
        problemCount: 0,
      });
    });
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

  it("includes sanitized launch evidence run plans in the preflight summary", () => {
    const runDate = freshReviewDate();

    return withLaunchRunPlanArtifact(
      runDate,
      validLaunchRunPlan(runDate),
      (inputPath) => {
        const result = runPreflight([`--run-plan=${inputPath}`, "--json"]);

        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          launchRunPlan: {
            provided: boolean;
            path: string;
            readyForLaunchEvidence: boolean;
            runDate: string;
            baseUrl: string;
            requestHeaderCount: number;
            commandCount: number;
            flowCount: number;
            canonicalFlowCoverage: ReturnType<typeof canvasLaunchEvidenceFlowCoverage>;
            problemCount: number;
            problems: string[];
          };
        };

        expect(summary.launchRunPlan).toMatchObject({
          provided: true,
          path: path.normalize(artifactPathsForRunDate(runDate).launchRunPlan),
          readyForLaunchEvidence: true,
          runDate,
          baseUrl: "https://staging.vyva.app",
          requestHeaderCount: 0,
          commandCount: 20,
          flowCount: canvasLaunchReadinessFlows.length,
          canonicalFlowCoverage: canvasLaunchEvidenceFlowCoverage(),
          problemCount: 0,
          problems: [],
        });
        expect(summary.launchRunPlan.canonicalFlowCoverage[0]).toMatchObject({
          id: "ride",
          surfaces: ["voice handoff", "/concierge", "task hub pending resume"],
          qaGates: expect.arrayContaining([
            "voice_touch_keyboard",
            "privacy_safe_analytics",
          ]),
          fallback: "Existing Concierge transport panel",
          featureFlag: {
            endpoint: "/api/config/features/ride-voice-canvas",
            serverFeatureKey: "ride",
          },
          telemetryEvent: "vyva:ride-canvas-telemetry",
        });
      },
    );
  });

  it("accepts sanitized authenticated launch evidence run plans without secret values", () => {
    const runDate = freshReviewDate();
    const secret = "qa-preview-secret-value";

    return withLaunchRunPlanArtifact(
      runDate,
      validLaunchRunPlan(runDate, "https://v2.vyva.life", [
        "x-qa-preview-bypass:VYVA_QA_PREVIEW_BYPASS",
      ]),
      (inputPath) => {
        const result = runPreflight([`--run-plan=${inputPath}`, "--json"]);

        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          launchRunPlan: {
            readyForLaunchEvidence: boolean;
            baseUrl: string;
            requestHeaderCount: number;
            problemCount: number;
            problems: string[];
          };
        };

        expect(summary.launchRunPlan).toMatchObject({
          readyForLaunchEvidence: true,
          baseUrl: "https://v2.vyva.life",
          requestHeaderCount: 1,
          problemCount: 0,
          problems: [],
        });
        expect(result.stdout).toContain("requestHeaderCount");
        expect(result.stdout).not.toContain(secret);
      },
    );
  });

  it("rejects launch evidence run plans captured from mock hosts", () => {
    const runDate = freshReviewDate();

    return withLaunchRunPlanArtifact(
      runDate,
      validLaunchRunPlan(runDate, "https://mock-staging.vyva.app"),
      (inputPath) => {
        const result = runPreflight([`--run-plan=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          launchRunPlan: {
            readyForLaunchEvidence: boolean;
            problemCount: number;
            problems: string[];
          };
          nextActions: string[];
        };

        expect(summary.launchRunPlan.readyForLaunchEvidence).toBe(false);
        expect(summary.launchRunPlan.problems).toContain(
          "Launch evidence run plan baseUrl must be a deployed HTTPS non-local origin.",
        );
        expect(summary.launchRunPlan.problemCount).toBeGreaterThan(0);
        expect(summary.nextActions).toContain(
          "Fix the launch evidence run plan before final launch sign-off.",
        );
      },
    );
  });

  it("rejects launch evidence run plans that drift from the canonical evidence bundle", () => {
    const runDate = freshReviewDate();
    const runPlan = validLaunchRunPlan(runDate);

    return withLaunchRunPlanArtifact(
      runDate,
      {
        ...runPlan,
        commands: runPlan.commands.slice(1),
      },
      (inputPath) => {
        const result = runPreflight([`--run-plan=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          launchRunPlan: {
            readyForLaunchEvidence: boolean;
            problemCount: number;
            problems: string[];
          };
          nextActions: string[];
        };

        expect(summary.launchRunPlan.readyForLaunchEvidence).toBe(false);
        expect(summary.launchRunPlan.problemCount).toBeGreaterThan(0);
        expect(summary.launchRunPlan.problems.join("\n")).toContain(
          "Launch evidence run plan commands must match the canonical same-date evidence bundle.",
        );
        expect(summary.nextActions).toContain(
          "Fix the launch evidence run plan before final launch sign-off.",
        );
      },
    );
  });

  it("rejects launch evidence run plans with drifted flow execution details", () => {
    const runDate = freshReviewDate();
    const runPlan = validLaunchRunPlan(runDate);
    const flowCoverage = canvasLaunchEvidenceFlowCoverage().map((flow) =>
      flow.id === "ride"
        ? {
            ...flow,
            surfaces: ["/wrong-entry"],
            qaGates: flow.qaGates.slice(1),
            fallback: "Wrong fallback panel",
            featureFlag: flow.featureFlag
              ? {
                  ...flow.featureFlag,
                  endpoint: "/api/config/features/wrong-canvas",
                }
              : null,
            telemetryEvent: "vyva:wrong-canvas-telemetry",
          }
        : flow,
    );

    return withLaunchRunPlanArtifact(
      runDate,
      {
        ...runPlan,
        flowCoverage,
      },
      (inputPath) => {
        const result = runPreflight([`--run-plan=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          launchRunPlan: {
            readyForLaunchEvidence: boolean;
            problemCount: number;
            problems: string[];
          };
        };

        expect(summary.launchRunPlan.readyForLaunchEvidence).toBe(false);
        expect(summary.launchRunPlan.problems).toEqual(
          expect.arrayContaining([
            "Ride Voice Canvas: launch evidence run plan must include the canonical entry surfaces.",
            "Ride Voice Canvas: launch evidence run plan must include the canonical real-use QA gates.",
            "Ride Voice Canvas: launch evidence run plan fallback must match the launch manifest.",
            "Ride Voice Canvas: launch evidence run plan telemetry event must match the launch manifest.",
            "Ride Voice Canvas: launch evidence run plan feature flag details must match the launch manifest.",
          ]),
        );
      },
    );
  });

  it("rejects launch evidence run plans that omit real-use QA checklist obligations", () => {
    const runDate = freshReviewDate();
    const runPlan = validLaunchRunPlan(runDate);

    return withLaunchRunPlanArtifact(
      runDate,
      {
        ...runPlan,
        checklist: [
          "Collect enabled endpoint evidence before rollback evidence.",
          "Fill analytics evidence from aggregate-only staging or production-like telemetry.",
          "Copy sanitized artifact references into the evidence packet and QA matrix.",
        ],
      },
      (inputPath) => {
        const result = runPreflight([`--run-plan=${inputPath}`, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          launchRunPlan: {
            readyForLaunchEvidence: boolean;
            problemCount: number;
            problems: string[];
          };
          nextActions: string[];
        };

        expect(summary.launchRunPlan.readyForLaunchEvidence).toBe(false);
        expect(summary.launchRunPlan.problemCount).toBeGreaterThan(0);
        expect(summary.launchRunPlan.problems).toEqual(
          expect.arrayContaining([
            "Launch evidence run plan checklist must require real phone, tablet, desktop/laptop, voice, touch, and keyboard coverage.",
            "Launch evidence run plan checklist must require refresh, back, app exit/reopen, reconnect, interruption, cancel/exit, retry, and duplicate/stale recovery.",
            "Launch evidence run plan checklist must require open-session feature-flag rollback fallback without side effects.",
            "Launch evidence run plan checklist must require senior-friendly copy, Spanish long labels, announcements, focus, reduced motion, and what happens next.",
          ]),
        );
        expect(summary.nextActions).toContain(
          "Fix the launch evidence run plan before final launch sign-off.",
        );
      },
    );
  });

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
          authenticatedRequest: false,
          requestHeaderCount: 0,
          endpointCount: launchFeatureFlows.length,
          problemCount: 0,
        });
        expect(summary.featureEndpointEvidence.rollback).toMatchObject({
          provided: true,
          readyForLaunchEvidence: true,
          authenticatedRequest: false,
          requestHeaderCount: 0,
          endpointCount: launchFeatureFlows.length,
          problemCount: 0,
        });
      },
    ));

  it("rejects endpoint artifacts that include request header or credential references", () =>
    withTempFeatureEndpointFiles(
      {
        ...validFeatureEndpointArtifact("enabled"),
        requestHeaderEnv: ["Authorization:VYVA_QA_TOKEN"],
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
            enabled: {
              readyForLaunchEvidence: boolean;
              problemCount: number;
              problems: string[];
            };
          };
          nextActions: string[];
        };

        expect(summary.featureEndpointEvidence.enabled.readyForLaunchEvidence).toBe(false);
        expect(summary.featureEndpointEvidence.enabled.problemCount).toBeGreaterThan(0);
        expect(summary.featureEndpointEvidence.enabled.problems).toEqual(
          expect.arrayContaining([
            "Feature endpoint artifact must not include request header names, cookies, authorization values, or credential references.",
          ]),
        );
        expect(result.stdout).not.toContain("VYVA_QA_TOKEN");
        expect(summary.nextActions).toContain(
          "Fix enabled feature endpoint evidence before launch sign-off.",
        );
      },
    ));

  it("rejects endpoint auth metadata that drifts from an authenticated launch run plan", () => {
    const runDate = freshReviewDate();

    return withLaunchRunPlanArtifact(
      runDate,
      validLaunchRunPlan(runDate, "https://staging.vyva.app", [
        "x-qa-preview-bypass:VYVA_QA_PREVIEW_BYPASS",
      ]),
      (runPlanPath) =>
        withTempFeatureEndpointFiles(
          validFeatureEndpointArtifact("enabled"),
          validFeatureEndpointArtifact("rollback", {
            authenticatedRequest: true,
            requestHeaderCount: 1,
          }),
          ({ enabledPath, rollbackPath }) => {
            const result = runPreflight([
              `--run-plan=${runPlanPath}`,
              `--features-enabled=${enabledPath}`,
              `--features-rollback=${rollbackPath}`,
              "--json",
            ]);

            expect(result.status).toBe(1);
            expect(result.stderr).toBe("");

            const summary = JSON.parse(result.stdout) as {
              endpointAuthConsistency: {
                ready: boolean;
                checked: boolean;
                requestHeaderCount: number;
                problemCount: number;
                problems: string[];
              };
              nextActions: string[];
            };

            expect(summary.endpointAuthConsistency).toMatchObject({
              ready: false,
              checked: true,
              requestHeaderCount: 1,
            });
            expect(summary.endpointAuthConsistency.problemCount).toBeGreaterThan(0);
            expect(summary.endpointAuthConsistency.problems).toEqual(
              expect.arrayContaining([
                "enabled feature endpoints: requestHeaderCount must match the launch run plan request header count.",
                "enabled feature endpoints: authenticatedRequest must be true when the launch run plan uses request headers.",
              ]),
            );
            expect(summary.nextActions).toContain(
              "Fix endpoint evidence authentication metadata so it matches the launch run plan.",
            );
          },
        ),
    );
  });

  it("includes sanitized copy clarity artifacts in the preflight summary", () =>
    withTempCopyFile(validCopyEvidenceArtifact(), (inputPath) => {
      const result = runPreflight([`--copy=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        acceptedPending: boolean;
        copyEvidence: {
          provided: boolean;
          readyForLaunchEvidence: boolean;
          reviewedOn: string;
          requiredFlowCount: number;
          requiredCopyRowCount: number;
          problemCount: number;
          problems: string[];
        };
      };

      expect(summary.acceptedPending).toBe(true);
      expect(summary.copyEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
        reviewedOn: freshReviewDate(),
        requiredFlowCount: canvasLaunchReadinessFlows.length,
        requiredCopyRowCount: canvasLaunchReadinessFlows.length,
        problemCount: 0,
        problems: [],
      });
    }));

  it("rejects unsafe copy clarity artifacts without echoing personal values", () =>
    withTempCopyFile(
      validCopyEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references include 123 Secret Street",
      ),
      (inputPath) => {
        const result = runPreflight([`--copy=${inputPath}`]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("Copy clarity evidence problems:");
        expect(result.stdout).toContain(
          "Copy clarity evidence artifact appears to include personal details.",
        );
        expect(result.stdout).toContain(
          "Fix sanitized copy clarity evidence before launch sign-off.",
        );
        expect(result.stdout).not.toContain("123 Secret Street");
      },
    ));

  it("includes sanitized recovery behavior artifacts in the preflight summary", () =>
    withTempRecoveryFile(validRecoveryEvidenceArtifact(), (inputPath) => {
      const result = runPreflight([`--recovery=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        acceptedPending: boolean;
        recoveryEvidence: {
          provided: boolean;
          readyForLaunchEvidence: boolean;
          reviewedOn: string;
          requiredFlowCount: number;
          requiredRecoveryRowCount: number;
          problemCount: number;
          problems: string[];
        };
      };

      expect(summary.acceptedPending).toBe(true);
      expect(summary.recoveryEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
        reviewedOn: freshReviewDate(),
        requiredFlowCount: canvasLaunchReadinessFlows.length,
        requiredRecoveryRowCount: canvasLaunchReadinessFlows.length,
        problemCount: 0,
        problems: [],
      });
    }));

  it("rejects unsafe recovery behavior artifacts without echoing personal values", () =>
    withTempRecoveryFile(
      validRecoveryEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references include 123 Secret Street",
      ),
      (inputPath) => {
        const result = runPreflight([`--recovery=${inputPath}`]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("Recovery behavior evidence problems:");
        expect(result.stdout).toContain(
          "Recovery behavior evidence artifact appears to include personal details.",
        );
        expect(result.stdout).toContain(
          "Fix sanitized recovery behavior evidence before launch sign-off.",
        );
        expect(result.stdout).not.toContain("123 Secret Street");
      },
    ));

  it("includes sanitized real-use artifacts in the preflight summary", () =>
    withTempRealUseFile(validRealUseEvidenceArtifact(), (inputPath) => {
      const result = runPreflight([`--real-use=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        acceptedPending: boolean;
        realUseEvidence: {
          provided: boolean;
          readyForLaunchEvidence: boolean;
          reviewedOn: string;
          requiredFlowCount: number;
          requiredDeviceRowCount: number;
          requiredInteractionRowCount: number;
          problemCount: number;
          problems: string[];
        };
      };

      expect(summary.acceptedPending).toBe(true);
      expect(summary.realUseEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
        reviewedOn: freshReviewDate(),
        requiredFlowCount: canvasLaunchReadinessFlows.length,
        requiredDeviceRowCount: canvasLaunchReadinessFlows.length,
        requiredInteractionRowCount: canvasLaunchReadinessFlows.length,
        problemCount: 0,
        problems: [],
      });
    }));

  it("rejects unsafe real-use artifacts without echoing personal values", () =>
    withTempRealUseFile(
      validRealUseEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references include 123 Secret Street",
      ),
      (inputPath) => {
        const result = runPreflight([`--real-use=${inputPath}`]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("Real-use evidence problems:");
        expect(result.stdout).toContain(
          "Real-use evidence artifact appears to include personal details.",
        );
        expect(result.stdout).toContain(
          "Fix sanitized real-use evidence before launch sign-off.",
        );
        expect(result.stdout).not.toContain("123 Secret Street");
      },
    ));

  it("includes sanitized entry surface artifacts in the preflight summary", () =>
    withTempEntrySurfaceFile(validEntrySurfaceEvidenceArtifact(), (inputPath) => {
      const result = runPreflight([`--entry-surfaces=${inputPath}`, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        acceptedPending: boolean;
        entrySurfaceEvidence: {
          provided: boolean;
          readyForLaunchEvidence: boolean;
          reviewedOn: string;
          requiredFlowCount: number;
          requiredSurfaceCount: number;
          problemCount: number;
          problems: string[];
        };
      };

      expect(summary.acceptedPending).toBe(true);
      expect(summary.entrySurfaceEvidence).toMatchObject({
        provided: true,
        readyForLaunchEvidence: true,
        reviewedOn: freshReviewDate(),
        requiredFlowCount: canvasLaunchReadinessFlows.length,
        requiredSurfaceCount: canvasLaunchReadinessFlows.reduce(
          (total, flow) => total + flow.surfaces.length,
          0,
        ),
        problemCount: 0,
        problems: [],
      });
    }));

  it("rejects unsafe entry surface artifacts without echoing personal values", () =>
    withTempEntrySurfaceFile(
      validEntrySurfaceEvidenceArtifact().replace(
        "sanitized artifact references only with no personal details",
        "sanitized artifact references include 123 Secret Street",
      ),
      (inputPath) => {
        const result = runPreflight([`--entry-surfaces=${inputPath}`]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("Entry surface evidence problems:");
        expect(result.stdout).toContain(
          "Entry surface evidence artifact appears to include personal details.",
        );
        expect(result.stdout).toContain(
          "Fix sanitized entry surface evidence before launch sign-off.",
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
          withTempCopyFile(validCopyEvidenceArtifact(), (copyPath) =>
            withTempRecoveryFile(validRecoveryEvidenceArtifact(), (recoveryPath) =>
              withTempRealUseFile(validRealUseEvidenceArtifact(), (realUsePath) =>
                withTempEntrySurfaceFile(validEntrySurfaceEvidenceArtifact(), (entrySurfacePath) =>
                  withTempRollbackOwnerFile(
                    validRollbackOwnerHandoffArtifact(),
                    (rollbackOwnerPath) => {
                      const result = runPreflight([
                        "--final",
                        `--features-enabled=${enabledPath}`,
                        `--features-rollback=${rollbackPath}`,
                        `--analytics=${analyticsPath}`,
                        `--copy=${copyPath}`,
                        `--recovery=${recoveryPath}`,
                        `--real-use=${realUsePath}`,
                        `--entry-surfaces=${entrySurfacePath}`,
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
                        "Fix external launch evidence dates so endpoint, analytics, copy clarity, recovery behavior, real-use, entry surface, and rollback owner artifacts share one QA run date.",
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
    ));

  it("rejects final preflight when external evidence artifacts use different QA origins", () =>
    withTempFeatureEndpointFiles(
      validFeatureEndpointArtifact("enabled"),
      validFeatureEndpointArtifact("rollback"),
      ({ enabledPath, rollbackPath }) =>
        withTempAnalyticsFile(validAnalyticsEvidence(), (analyticsPath) =>
          withTempCopyFile(validCopyEvidenceArtifact(), (copyPath) =>
            withTempRecoveryFile(validRecoveryEvidenceArtifact(), (recoveryPath) =>
              withTempRealUseFile(
                validRealUseEvidenceArtifact().replace(
                  "QA run URL: https://staging.vyva.app",
                  "QA run URL: https://qa-other.vyva.app",
                ),
                (realUsePath) =>
                  withTempEntrySurfaceFile(validEntrySurfaceEvidenceArtifact(), (entrySurfacePath) =>
                    withTempRollbackOwnerFile(
                      validRollbackOwnerHandoffArtifact(),
                      (rollbackOwnerPath) => {
                        const result = runPreflight([
                          "--final",
                          `--features-enabled=${enabledPath}`,
                          `--features-rollback=${rollbackPath}`,
                          `--analytics=${analyticsPath}`,
                          `--copy=${copyPath}`,
                          `--recovery=${recoveryPath}`,
                          `--real-use=${realUsePath}`,
                          `--entry-surfaces=${entrySurfacePath}`,
                          `--rollback-owner=${rollbackOwnerPath}`,
                          "--json",
                        ]);

                        expect(result.status).toBe(1);
                        expect(result.stderr).toBe("");

                        const summary = JSON.parse(result.stdout) as {
                          externalEvidenceOriginConsistency: {
                            ready: boolean;
                            checked: boolean;
                            origin: string;
                            problemCount: number;
                            problems: string[];
                          };
                          nextActions: string[];
                        };

                        expect(summary.externalEvidenceOriginConsistency).toMatchObject({
                          ready: false,
                          checked: true,
                          origin: "mixed",
                          problemCount: 1,
                        });
                        expect(
                          summary.externalEvidenceOriginConsistency.problems.join("\n"),
                        ).toContain(
                          "External launch evidence must share one deployed QA origin",
                        );
                        expect(summary.nextActions).toContain(
                          "Fix external launch evidence origins so endpoint, copy clarity, recovery behavior, real-use, entry surface, and rollback owner artifacts share one deployed QA origin.",
                        );
                      },
                    ),
                  ),
              ),
            ),
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
        baseUrl: "https://mock-staging.vyva.app",
        featureEndpoints: validFeatureEndpointArtifact("rollback").featureEndpoints.map(
          (endpoint) => ({
            ...endpoint,
            url: endpoint.url.replace(
              "https://staging.vyva.app",
              "https://mock-staging.vyva.app",
            ),
          }),
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
        expect(summary.featureEndpointEvidence.enabled.problems).toEqual(
          expect.arrayContaining([
            "Feature endpoint artifact must include a deployed HTTPS non-local baseUrl origin.",
          ]),
        );
        expect(summary.featureEndpointEvidence.rollback.problemCount).toBeGreaterThan(0);
        expect(summary.featureEndpointEvidence.rollback.problems).toContain(
          "Feature endpoint artifact must include a deployed HTTPS non-local baseUrl origin.",
        );
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
      expect(forced.stderr).toBe("");
      expect(existsSync(outputPath)).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, "utf8")).acceptedPending).toBe(
        true,
      );
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(
        JSON.parse(forced.stdout),
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

  it("rejects empty and invalid launch bundle dates", () => {
    const emptyResult = runPreflight(["--date="]);
    const malformedResult = runPreflight(["--date=not-a-date"]);
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const futureResult = runPreflight([`--date=${futureDate}`]);
    const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const staleResult = runPreflight([`--date=${staleDate}`]);

    expect(emptyResult.status).toBe(1);
    expect(emptyResult.stderr).toContain("Expected --date=YYYY-MM-DD.");
    expect(malformedResult.status).toBe(1);
    expect(malformedResult.stderr).toContain(
      "Expected --date to be a valid non-future YYYY-MM-DD.",
    );
    expect(futureResult.status).toBe(1);
    expect(futureResult.stderr).toContain(
      "Expected --date to be a valid non-future YYYY-MM-DD.",
    );
    expect(staleResult.status).toBe(1);
    expect(staleResult.stderr).toContain("Expected --date to be no older than 7 days.");
  });

  it("rejects empty analytics artifact paths", () => {
    const result = runPreflight(["--analytics="]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --analytics=<path>.");
  });

  it("rejects empty copy clarity artifact paths", () => {
    const result = runPreflight(["--copy="]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --copy=<path>.");
  });

  it("rejects empty recovery behavior artifact paths", () => {
    const result = runPreflight(["--recovery="]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --recovery=<path>.");
  });

  it("rejects empty real-use artifact paths", () => {
    const result = runPreflight(["--real-use="]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --real-use=<path>.");
  });

  it("rejects empty entry surface artifact paths", () => {
    const result = runPreflight(["--entry-surfaces="]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --entry-surfaces=<path>.");
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
