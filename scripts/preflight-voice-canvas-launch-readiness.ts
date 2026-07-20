import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const finalGate = args.includes("--final");
const forceOutput = args.includes("--force");
const outputArg = args.find((arg) => arg.startsWith("--output="));
const outputPathArg = outputArg?.slice("--output=".length).trim();
const matrixPathArg = args
  .find((arg) => arg.startsWith("--matrix="))
  ?.slice("--matrix=".length)
  .trim();
const packetPathArg = args
  .find((arg) => arg.startsWith("--packet="))
  ?.slice("--packet=".length)
  .trim();
const runSheetPathArg = args
  .find((arg) => arg.startsWith("--runsheet="))
  ?.slice("--runsheet=".length)
  .trim();
const featureEnabledArg = args.find((arg) => arg.startsWith("--features-enabled="));
const featureEnabledPathArg = featureEnabledArg
  ?.slice("--features-enabled=".length)
  .trim();
const featureRollbackArg = args.find((arg) =>
  arg.startsWith("--features-rollback="),
);
const featureRollbackPathArg = featureRollbackArg
  ?.slice("--features-rollback=".length)
  .trim();
const analyticsArg = args.find((arg) => arg.startsWith("--analytics="));
const analyticsPathArg = args
  .find((arg) => arg.startsWith("--analytics="))
  ?.slice("--analytics=".length)
  .trim();

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const matrixValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-qa-matrix.ts",
);
const packetValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-evidence-packet.ts",
);
const runSheetValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-run-sheet.ts",
);
const analyticsValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-analytics-evidence.ts",
);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Preflight the Voice Canvas launch-readiness evidence gates.",
      "",
      "Usage:",
      "  npm run canvas:qa:preflight",
      "  npm run canvas:qa:preflight -- --final",
      "  npm run --silent canvas:qa:preflight -- --json",
      "  npm run --silent canvas:qa:preflight -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
      "  npm run canvas:qa:preflight -- --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json",
      "  npm run canvas:qa:preflight -- --features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json --features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
      "  npm run canvas:qa:preflight -- --runsheet=docs/audits/voice-canvas-real-device-run-sheet.md --matrix=docs/audits/voice-canvas-real-device-qa-matrix.md --packet=docs/audits/voice-canvas-real-device-evidence-packet.md",
      "",
      "Default mode accepts a structurally valid pending run sheet, matrix, and packet so QA can capture an in-progress launch artifact.",
      "Pass --features-enabled=<path> and --features-rollback=<path> to validate sanitized endpoint collector artifacts generated within the last 7 days.",
      "Pass --analytics=<path> to validate sanitized analytics evidence generated within the last 7 days in the same aggregate-only snapshot.",
      "Use --final after real-device evidence is filled; it exits non-zero unless the run sheet, matrix, packet, enabled endpoint artifact, rollback endpoint artifact, and analytics evidence are ready.",
      "Use --json to emit a machine-readable summary for QA artifacts or CI.",
      "Use --output=<path> with --json to also save the summary to a file.",
      "Existing output files are preserved by default; pass --force only when intentionally replacing one.",
      "This preflight is read-only and never calls feature endpoints, analytics, bookings, calls, messages, navigation, or data writes.",
    ].join("\n"),
  );
  process.exit(0);
}

if (outputArg && !outputPathArg) {
  console.error("Expected --output=<path>.");
  process.exit(1);
}
if (featureEnabledArg && !featureEnabledPathArg) {
  console.error("Expected --features-enabled=<path>.");
  process.exit(1);
}
if (featureRollbackArg && !featureRollbackPathArg) {
  console.error("Expected --features-rollback=<path>.");
  process.exit(1);
}
if (analyticsArg && !analyticsPathArg) {
  console.error("Expected --analytics=<path>.");
  process.exit(1);
}
if (outputPathArg && !jsonOutput) {
  console.error("Use --output only with --json.");
  process.exit(1);
}

interface ValidatorRun {
  status: number | null;
  stdout: string;
  stderr: string;
  summary: Record<string, unknown> | null;
}

interface FeatureEndpointArtifactValidation {
  provided: boolean;
  path: string;
  readyForLaunchEvidence: boolean;
  mode: "enabled" | "rollback";
  endpointCount: number;
  problemCount: number;
  problems: string[];
}

interface PendingSectionSummary {
  section: string;
  pendingCells: number;
  rowsWithPending: number;
}

const featureFlaggedFlows = canvasLaunchReadinessFlows.filter(
  (flow) => flow.featureFlag,
);
const expectedEndpointEvidenceScope = "VYVA Canvas Launch Readiness + Real-Use QA v1";
const maxLaunchEvidenceAgeMs = 7 * 24 * 60 * 60 * 1000;
const evidenceArtifactDatePlaceholder = "YYYY-MM-DD";
const evidenceBaseUrlPlaceholder = "https://staging.vyva.app";

function runValidator(
  scriptPath: string,
  artifactPath: string | undefined,
  options: { allowPending: boolean },
): ValidatorRun {
  const validatorArgs = [
    tsxCliPath,
    scriptPath,
    ...(artifactPath ? [artifactPath] : []),
    ...(options.allowPending ? ["--allow-pending"] : []),
    "--json",
  ];
  const result = spawnSync(process.execPath, validatorArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  let summary: Record<string, unknown> | null = null;
  try {
    summary = JSON.parse(result.stdout) as Record<string, unknown>;
  } catch {
    summary = null;
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    summary,
  };
}

function numericField(
  summary: Record<string, unknown> | null,
  field: string,
): number {
  const value = summary?.[field];
  return typeof value === "number" ? value : 0;
}

function booleanField(
  summary: Record<string, unknown> | null,
  field: string,
): boolean {
  return summary?.[field] === true;
}

function stringField(
  summary: Record<string, unknown> | null,
  field: string,
): string {
  const value = summary?.[field];
  return typeof value === "string" ? value : "unknown";
}

function stringArrayField(
  summary: Record<string, unknown> | null,
  field: string,
): string[] {
  const value = summary?.[field];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function printProblemDetails(label: string, problems: string[]): void {
  if (problems.length === 0) return;

  console.log(`${label} problems:`);
  for (const problem of problems) {
    console.log(`- ${problem}`);
  }
}

function pendingSectionSummaries(value: unknown): PendingSectionSummary[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (entry): entry is PendingSectionSummary =>
      isRecord(entry) &&
      typeof entry.section === "string" &&
      typeof entry.pendingCells === "number" &&
      typeof entry.rowsWithPending === "number",
  );
}

function printPendingSections(
  label: string,
  value: unknown,
  nextValue: unknown,
): void {
  const summaries = pendingSectionSummaries(value);
  if (summaries.length === 0) return;

  console.log(`${label} pending sections:`);
  for (const summary of summaries) {
    console.log(
      `- ${summary.section}: ${summary.pendingCells} pending cell(s) across ${summary.rowsWithPending} row(s)`,
    );
  }
  const nextSection = pendingSectionSummaries(
    Array.isArray(nextValue) ? nextValue : nextValue ? [nextValue] : [],
  )[0];
  if (nextSection) {
    console.log(
      `${label} next evidence area: ${nextSection.section} (${nextSection.pendingCells} pending cell(s) across ${nextSection.rowsWithPending} row(s))`,
    );
  }
}

function isLocalOrPlaceholderHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "example.com" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".test") ||
    host.endsWith(".example")
  ) {
    return true;
  }

  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
    return true;
  }

  const private172 = host.match(/^172\.(\d{1,2})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  return false;
}

function parseDeployedOrigin(value: unknown): URL | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (isLocalOrPlaceholderHost(parsed.hostname)) return null;
    return new URL(parsed.origin);
  } catch {
    return null;
  }
}

function parseValidNonFutureGeneratedAt(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  const valid =
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === value &&
    parsed.getTime() <= Date.now();
  return valid ? parsed : null;
}

function validateFeatureEndpointArtifact(
  artifactPathArg: string | undefined,
  mode: "enabled" | "rollback",
): FeatureEndpointArtifactValidation {
  if (!artifactPathArg) {
    return {
      provided: false,
      path: "unknown",
      readyForLaunchEvidence: false,
      mode,
      endpointCount: 0,
      problemCount: 0,
      problems: [],
    };
  }

  const artifactPath = path.resolve(process.cwd(), artifactPathArg);
  const relativePath = path.relative(process.cwd(), artifactPath);
  const problems: string[] = [];
  let artifact: unknown = null;

  try {
    artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  } catch {
    problems.push("Feature endpoint artifact could not be read as JSON.");
  }

  if (!isRecord(artifact)) {
    problems.push("Feature endpoint artifact must be a JSON object.");
  }

  const endpoints = isRecord(artifact) ? artifact.featureEndpoints : null;
  if (!Array.isArray(endpoints)) {
    problems.push("Feature endpoint artifact must include featureEndpoints array.");
  }

  const deployedOrigin = parseDeployedOrigin(isRecord(artifact) ? artifact.baseUrl : null);
  if (!deployedOrigin) {
    problems.push(
      "Feature endpoint artifact must include a deployed HTTPS non-local baseUrl origin.",
    );
  }

  const generatedAt = parseValidNonFutureGeneratedAt(
    isRecord(artifact) ? artifact.generatedAt : null,
  );
  if (!generatedAt) {
    problems.push(
      "Feature endpoint artifact must include generatedAt as a non-future ISO timestamp.",
    );
  } else if (Date.now() - generatedAt.getTime() > maxLaunchEvidenceAgeMs) {
    problems.push("Feature endpoint artifact generatedAt must be no older than 7 days.");
  }

  if (
    isRecord(artifact) &&
    artifact.scope !== expectedEndpointEvidenceScope
  ) {
    problems.push("Feature endpoint artifact scope does not match the launch-readiness goal.");
  }

  const expectedArtifactState =
    mode === "enabled" ? "enabled" : "rollback-disabled";
  if (isRecord(artifact) && artifact.expectedState !== expectedArtifactState) {
    problems.push(
      `Feature endpoint artifact expectedState must be ${expectedArtifactState}.`,
    );
  }

  const readyForQaEvidence = isRecord(artifact)
    ? artifact.readyForQaEvidence
    : undefined;
  if (readyForQaEvidence !== true) {
    problems.push("Feature endpoint artifact must have readyForQaEvidence true.");
  }

  if (isRecord(artifact) && artifact.problemCount !== 0) {
    problems.push("Feature endpoint artifact problemCount must be 0.");
  }

  if (
    isRecord(artifact) &&
    (!Array.isArray(artifact.problems) || artifact.problems.length !== 0)
  ) {
    problems.push("Feature endpoint artifact problems must be an empty array.");
  }

  const expectedEnabled = mode === "enabled";
  const expectedRollout = mode === "enabled" ? 100 : 0;
  const endpointRows = Array.isArray(endpoints) ? endpoints : [];
  const expectedEndpointIds = new Set(featureFlaggedFlows.map((flow) => flow.id));
  if (endpointRows.length !== featureFlaggedFlows.length) {
    problems.push(
      "Feature endpoint artifact must include exactly the launch-scoped feature endpoints.",
    );
  }
  if (
    isRecord(artifact) &&
    artifact.endpointCount !== featureFlaggedFlows.length
  ) {
    problems.push(
      "Feature endpoint artifact endpointCount must match the launch-scoped feature endpoint count.",
    );
  }

  const rowsById = new Map<string, Record<string, unknown>>();
  for (const row of endpointRows) {
    if (!isRecord(row) || typeof row.id !== "string") {
      problems.push("Feature endpoint artifact contains an invalid endpoint row.");
      continue;
    }
    if (!expectedEndpointIds.has(row.id)) {
      problems.push("Feature endpoint artifact contains an out-of-scope endpoint row.");
      continue;
    }
    if (rowsById.has(row.id)) {
      problems.push(`${row.id}: duplicate feature endpoint evidence row.`);
      continue;
    }
    rowsById.set(row.id, row);
  }

  for (const flow of featureFlaggedFlows) {
    const row = rowsById.get(flow.id);
    if (!row) {
      problems.push(`${flow.label}: feature endpoint evidence row is missing.`);
      continue;
    }

    if (row.endpoint !== flow.featureFlag?.endpoint) {
      problems.push(`${flow.label}: endpoint path does not match launch manifest.`);
    }
    if (row.serverFeatureKey !== flow.featureFlag?.serverFeatureKey) {
      problems.push(`${flow.label}: server feature key does not match launch manifest.`);
    }
    if (deployedOrigin) {
      try {
        const rowUrl = new URL(String(row.url));
        const expectedUrl = new URL(flow.featureFlag!.endpoint, deployedOrigin);
        if (rowUrl.origin !== deployedOrigin.origin || rowUrl.pathname !== expectedUrl.pathname) {
          problems.push(
            `${flow.label}: endpoint URL does not match the deployed baseUrl and launch endpoint.`,
          );
        }
        if (rowUrl.search || rowUrl.hash || rowUrl.username || rowUrl.password) {
          problems.push(`${flow.label}: endpoint URL must not include credentials, query, or hash.`);
        }
      } catch {
        problems.push(`${flow.label}: endpoint URL must be a valid deployed URL.`);
      }
    }
    if (row.ok !== true || row.status !== 200) {
      problems.push(`${flow.label}: endpoint evidence must be ok with HTTP 200.`);
    }
    if (
      typeof row.cacheControl !== "string" ||
      !row.cacheControl.toLowerCase().includes("no-store")
    ) {
      problems.push(
        `${flow.label}: endpoint evidence must include Cache-Control no-store.`,
      );
    }
    if (!Array.isArray(row.problems) || row.problems.length !== 0) {
      problems.push(`${flow.label}: endpoint evidence row problems must be empty.`);
    }
    if (row.enabled !== expectedEnabled) {
      problems.push(
        `${flow.label}: ${mode} endpoint evidence must report enabled ${String(expectedEnabled)}.`,
      );
    }
    if (row.rolloutPercent !== expectedRollout) {
      problems.push(
        `${flow.label}: ${mode} endpoint evidence must report rolloutPercent ${expectedRollout}.`,
      );
    }
    if (row.unexpectedPayloadKeyCount !== 0) {
      problems.push(`${flow.label}: endpoint evidence included unexpected payload keys.`);
    }
    const payloadKeys = row.payloadKeys;
    if (
      !Array.isArray(payloadKeys) ||
      payloadKeys.length !== 2 ||
      !payloadKeys.includes("enabled") ||
      !payloadKeys.includes("rolloutPercent")
    ) {
      problems.push(`${flow.label}: endpoint evidence must include only enabled and rolloutPercent payload keys.`);
    }
  }

  return {
    provided: true,
    path: relativePath,
    readyForLaunchEvidence: problems.length === 0,
    mode,
    endpointCount: endpointRows.length,
    problemCount: problems.length,
    problems,
  };
}

function messagesForNextAction(
  runSheetRun: ValidatorRun,
  matrixRun: ValidatorRun,
  packetRun: ValidatorRun,
  analyticsRun: ValidatorRun | null,
  enabledFeatures: FeatureEndpointArtifactValidation,
  rollbackFeatures: FeatureEndpointArtifactValidation,
): string[] {
  const messages: string[] = [];
  const runSheetProblems = numericField(runSheetRun.summary, "problemCount");
  const runSheetIncomplete = numericField(
    runSheetRun.summary,
    "incompleteCellCount",
  );
  const matrixProblems = numericField(matrixRun.summary, "problemCount");
  const packetProblems = numericField(packetRun.summary, "problemCount");
  const analyticsProblems = numericField(analyticsRun?.summary ?? null, "problemCount");
  const matrixFailing = numericField(matrixRun.summary, "failingCellCount");
  const matrixIncomplete = numericField(matrixRun.summary, "incompleteCellCount");
  const packetIncomplete = numericField(packetRun.summary, "incompleteCellCount");

  if (!runSheetRun.summary) {
    messages.push("Fix the run sheet validator output before using the preflight artifact.");
  }
  if (!matrixRun.summary) {
    messages.push("Fix the QA matrix validator output before using the preflight artifact.");
  }
  if (!packetRun.summary) {
    messages.push("Fix the evidence packet validator output before using the preflight artifact.");
  }
  if (runSheetProblems > 0) {
    messages.push("Fix real-device run sheet structural or coverage rows before staging QA.");
  }
  if (matrixProblems > 0 || matrixFailing > 0) {
    messages.push("Fix QA matrix structural or failing/not-ready rows before real-user rollout.");
  }
  if (packetProblems > 0) {
    messages.push("Fix evidence packet structural or privacy-safety rows before copying evidence into the matrix.");
  }
  if (analyticsRun && !analyticsRun.summary) {
    messages.push("Fix the analytics validator output before using the preflight artifact.");
  }
  if (analyticsProblems > 0) {
    messages.push("Fix sanitized analytics evidence before launch sign-off.");
  }
  if (enabledFeatures.problemCount > 0) {
    messages.push("Fix enabled feature endpoint evidence before launch sign-off.");
  }
  if (rollbackFeatures.problemCount > 0) {
    messages.push("Fix rollback-disabled feature endpoint evidence before launch sign-off.");
  }
  if (finalGate && !enabledFeatures.provided) {
    messages.push("Provide --features-enabled=<path> for the enabled feature endpoint collector artifact before final launch sign-off.");
  }
  if (finalGate && !rollbackFeatures.provided) {
    messages.push("Provide --features-rollback=<path> for the rollback-disabled feature endpoint collector artifact before final launch sign-off.");
  }
  if (finalGate && !analyticsRun) {
    messages.push("Provide --analytics=<path> for the sanitized analytics evidence artifact before final launch sign-off.");
  }
  if (runSheetIncomplete > 0) {
    messages.push("Execute the real-device run sheet and record fresh sanitized evidence before final launch sign-off.");
  }
  if (packetIncomplete > 0) {
    messages.push(
      "Fill the sanitized evidence packet artifact references and reviewer/date cells with fresh explicit reviewed, verified, validated, approved, or sign-off wording.",
    );
  }
  if (matrixIncomplete > 0) {
    messages.push("Execute fresh real-device and deployed rollback QA, then fill the QA matrix.");
  }
  if (messages.length === 0) {
    messages.push("Run final launch sign-off and keep rollback owners ready before enabling wider rollout.");
  }

  return messages;
}

function launchEvidenceCommands(): string[] {
  const artifactPrefix = `artifacts/voice-canvas/${evidenceArtifactDatePlaceholder}`;
  const enabledEndpointArtifact = `${artifactPrefix}-feature-endpoints-enabled.json`;
  const rollbackEndpointArtifact = `${artifactPrefix}-feature-endpoints-rollback-disabled.json`;
  const analyticsEvidenceArtifact = `${artifactPrefix}-analytics-evidence.json`;
  const analyticsValidationArtifact = `${artifactPrefix}-analytics-validation.json`;
  const runSheetSummaryArtifact = `${artifactPrefix}-run-sheet-summary.json`;
  const qaSummaryArtifact = `${artifactPrefix}-qa-summary.json`;
  const packetSummaryArtifact = `${artifactPrefix}-evidence-packet-summary.json`;
  const preflightArtifact = `${artifactPrefix}-launch-preflight.json`;

  return [
    `npm run --silent canvas:qa:features -- --base-url=${evidenceBaseUrlPlaceholder} --expected-state=enabled --json --output=${enabledEndpointArtifact}`,
    `npm run --silent canvas:qa:features -- --base-url=${evidenceBaseUrlPlaceholder} --expected-state=rollback-disabled --json --output=${rollbackEndpointArtifact}`,
    "npm run --silent canvas:qa:analytics -- --template",
    `npm run --silent canvas:qa:analytics -- --input=${analyticsEvidenceArtifact} --json --output=${analyticsValidationArtifact}`,
    `npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=${runSheetSummaryArtifact}`,
    `npm run --silent canvas:qa:validate -- --allow-pending --json --output=${qaSummaryArtifact}`,
    `npm run --silent canvas:qa:packet -- --allow-pending --json --output=${packetSummaryArtifact}`,
    `npm run --silent canvas:qa:preflight -- --final --features-enabled=${enabledEndpointArtifact} --features-rollback=${rollbackEndpointArtifact} --analytics=${analyticsEvidenceArtifact} --json --output=${preflightArtifact}`,
  ];
}

const runSheetRun = runValidator(runSheetValidatorPath, runSheetPathArg, {
  allowPending: !finalGate,
});
const matrixRun = runValidator(matrixValidatorPath, matrixPathArg, {
  allowPending: !finalGate,
});
const packetRun = runValidator(packetValidatorPath, packetPathArg, {
  allowPending: !finalGate,
});
const analyticsRun = analyticsPathArg
  ? runValidator(analyticsValidatorPath, `--input=${analyticsPathArg}`, {
      allowPending: false,
    })
  : null;
const enabledFeatures = validateFeatureEndpointArtifact(
  featureEnabledPathArg,
  "enabled",
);
const rollbackFeatures = validateFeatureEndpointArtifact(
  featureRollbackPathArg,
  "rollback",
);
const readyForLaunch =
  booleanField(runSheetRun.summary, "readyForQaRunSheet") &&
  booleanField(matrixRun.summary, "readyForLaunch") &&
  booleanField(packetRun.summary, "readyForLaunchEvidencePacket") &&
  enabledFeatures.readyForLaunchEvidence &&
  rollbackFeatures.readyForLaunchEvidence &&
  booleanField(analyticsRun?.summary ?? null, "readyForLaunchEvidence");
const structuralProblems =
  !runSheetRun.summary ||
  !matrixRun.summary ||
  !packetRun.summary ||
  (analyticsRun !== null && !analyticsRun.summary) ||
  numericField(runSheetRun.summary, "problemCount") > 0 ||
  numericField(matrixRun.summary, "problemCount") > 0 ||
  numericField(matrixRun.summary, "failingCellCount") > 0 ||
  numericField(packetRun.summary, "problemCount") > 0 ||
  enabledFeatures.problemCount > 0 ||
  rollbackFeatures.problemCount > 0 ||
  numericField(analyticsRun?.summary ?? null, "problemCount") > 0;
const acceptedPending =
  !finalGate &&
  !structuralProblems &&
  runSheetRun.status === 0 &&
  matrixRun.status === 0 &&
  packetRun.status === 0 &&
  !readyForLaunch;
const exitCode = readyForLaunch || acceptedPending ? 0 : 1;
const nextActions = messagesForNextAction(
  runSheetRun,
  matrixRun,
  packetRun,
  analyticsRun,
  enabledFeatures,
  rollbackFeatures,
);
const evidenceCommands = launchEvidenceCommands();

const summary = {
  readyForLaunch,
  finalGate,
  acceptedPending,
  runSheet: {
    path: stringField(runSheetRun.summary, "runSheetPath"),
    state: stringField(runSheetRun.summary, "state"),
    readyForQaRunSheet: booleanField(runSheetRun.summary, "readyForQaRunSheet"),
    incompleteCellCount: numericField(runSheetRun.summary, "incompleteCellCount"),
    problemCount: numericField(runSheetRun.summary, "problemCount"),
    problems: stringArrayField(runSheetRun.summary, "problems"),
    pendingSections: runSheetRun.summary?.pendingSections ?? [],
    nextPendingSection: runSheetRun.summary?.nextPendingSection ?? null,
    message: stringField(runSheetRun.summary, "message"),
  },
  matrix: {
    path: stringField(matrixRun.summary, "matrixPath"),
    status: stringField(matrixRun.summary, "status"),
    state: stringField(matrixRun.summary, "state"),
    readyForLaunch: booleanField(matrixRun.summary, "readyForLaunch"),
    incompleteCellCount: numericField(matrixRun.summary, "incompleteCellCount"),
    failingCellCount: numericField(matrixRun.summary, "failingCellCount"),
    problemCount: numericField(matrixRun.summary, "problemCount"),
    problems: stringArrayField(matrixRun.summary, "problems"),
    pendingSections: matrixRun.summary?.pendingSections ?? [],
    nextPendingSection: matrixRun.summary?.nextPendingSection ?? null,
    message: stringField(matrixRun.summary, "message"),
  },
  evidencePacket: {
    path: stringField(packetRun.summary, "packetPath"),
    state: stringField(packetRun.summary, "state"),
    readyForLaunchEvidencePacket: booleanField(
      packetRun.summary,
      "readyForLaunchEvidencePacket",
    ),
    incompleteCellCount: numericField(packetRun.summary, "incompleteCellCount"),
    problemCount: numericField(packetRun.summary, "problemCount"),
    problems: stringArrayField(packetRun.summary, "problems"),
    pendingSections: packetRun.summary?.pendingSections ?? [],
    nextPendingSection: packetRun.summary?.nextPendingSection ?? null,
    message: stringField(packetRun.summary, "message"),
  },
  analyticsEvidence: {
    provided: Boolean(analyticsPathArg),
    path: stringField(analyticsRun?.summary ?? null, "inputPath"),
    readyForLaunchEvidence: booleanField(
      analyticsRun?.summary ?? null,
      "readyForLaunchEvidence",
    ),
    sampleCount: numericField(analyticsRun?.summary ?? null, "sampleCount"),
    problemCount: numericField(analyticsRun?.summary ?? null, "problemCount"),
    problems: stringArrayField(analyticsRun?.summary ?? null, "problems"),
    coveredFlows: analyticsRun?.summary?.coveredFlows ?? [],
    sampleLaunchSignalCounts:
      analyticsRun?.summary?.sampleLaunchSignalCounts ?? null,
  },
  featureEndpointEvidence: {
    enabled: {
      provided: enabledFeatures.provided,
      path: enabledFeatures.path,
      readyForLaunchEvidence: enabledFeatures.readyForLaunchEvidence,
      endpointCount: enabledFeatures.endpointCount,
      problemCount: enabledFeatures.problemCount,
      problems: enabledFeatures.problems,
    },
    rollback: {
      provided: rollbackFeatures.provided,
      path: rollbackFeatures.path,
      readyForLaunchEvidence: rollbackFeatures.readyForLaunchEvidence,
      endpointCount: rollbackFeatures.endpointCount,
      problemCount: rollbackFeatures.problemCount,
      problems: rollbackFeatures.problems,
    },
  },
  nextActions,
  evidenceCommands,
  message: readyForLaunch
    ? "Voice Canvas launch evidence gates are ready."
    : acceptedPending
      ? "Voice Canvas launch evidence gates are structurally valid but still pending real-device QA."
      : "Voice Canvas launch evidence gates are not ready.",
};

if (jsonOutput) {
  const jsonSummary = JSON.stringify(summary, null, 2);
  if (outputPathArg) {
    const outputPath = path.resolve(process.cwd(), outputPathArg);
    if (existsSync(outputPath) && !forceOutput) {
      console.error(
        `Output file already exists. Use a run-specific path or pass --force to overwrite: ${path.relative(process.cwd(), outputPath)}`,
      );
      process.exit(1);
    }
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${jsonSummary}\n`);
  }
  console.log(jsonSummary);
  process.exit(exitCode);
}

console.log("Voice Canvas launch QA preflight");
console.log(`Final gate mode: ${finalGate ? "yes" : "no"}`);
console.log(`Ready for launch: ${readyForLaunch ? "yes" : "no"}`);
console.log(
  `Run sheet: ${summary.runSheet.state}; incomplete ${summary.runSheet.incompleteCellCount}; problems ${summary.runSheet.problemCount}`,
);
console.log(
  `QA matrix: ${summary.matrix.state}; incomplete ${summary.matrix.incompleteCellCount}; failing/not-ready ${summary.matrix.failingCellCount}; problems ${summary.matrix.problemCount}`,
);
console.log(
  `Evidence packet: ${summary.evidencePacket.state}; incomplete ${summary.evidencePacket.incompleteCellCount}; problems ${summary.evidencePacket.problemCount}`,
);
console.log(
  `Analytics evidence: ${summary.analyticsEvidence.provided ? (summary.analyticsEvidence.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; samples ${summary.analyticsEvidence.sampleCount}; problems ${summary.analyticsEvidence.problemCount}`,
);
console.log(
  `Feature endpoints enabled: ${summary.featureEndpointEvidence.enabled.provided ? (summary.featureEndpointEvidence.enabled.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; endpoints ${summary.featureEndpointEvidence.enabled.endpointCount}; problems ${summary.featureEndpointEvidence.enabled.problemCount}`,
);
console.log(
  `Feature endpoints rollback: ${summary.featureEndpointEvidence.rollback.provided ? (summary.featureEndpointEvidence.rollback.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; endpoints ${summary.featureEndpointEvidence.rollback.endpointCount}; problems ${summary.featureEndpointEvidence.rollback.problemCount}`,
);
printProblemDetails("Run sheet", summary.runSheet.problems);
printProblemDetails("QA matrix", summary.matrix.problems);
printProblemDetails("Evidence packet", summary.evidencePacket.problems);
printProblemDetails("Analytics evidence", summary.analyticsEvidence.problems);
printProblemDetails(
  "Feature endpoints enabled",
  summary.featureEndpointEvidence.enabled.problems,
);
printProblemDetails(
  "Feature endpoints rollback",
  summary.featureEndpointEvidence.rollback.problems,
);
printPendingSections(
  "Run sheet",
  summary.runSheet.pendingSections,
  summary.runSheet.nextPendingSection,
);
printPendingSections(
  "QA matrix",
  summary.matrix.pendingSections,
  summary.matrix.nextPendingSection,
);
printPendingSections(
  "Evidence packet",
  summary.evidencePacket.pendingSections,
  summary.evidencePacket.nextPendingSection,
);
console.log("Next action:");
for (const action of nextActions) {
  console.log(`- ${action}`);
}
console.log("Copy-ready evidence commands:");
for (const command of evidenceCommands) {
  console.log(`- ${command}`);
}
console.log(summary.message);

process.exit(exitCode);
