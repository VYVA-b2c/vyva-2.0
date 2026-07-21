import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  canvasLaunchEvidenceFlowCoverage,
  canvasLaunchReadinessFlows,
} from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const finalGate = args.includes("--final");
const forceOutput = args.includes("--force");
const outputArg = args.find((arg) => arg.startsWith("--output="));
const outputPathArg = outputArg?.slice("--output=".length).trim();
const bundleDateArg = args.find((arg) => arg.startsWith("--date="));
const bundleDatePathArg = bundleDateArg?.slice("--date=".length).trim();
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
const runPlanArg = args.find((arg) => arg.startsWith("--run-plan="));
const runPlanPathArg = runPlanArg
  ?.slice("--run-plan=".length)
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
const copyArg = args.find((arg) => arg.startsWith("--copy="));
const copyPathArg = copyArg
  ?.slice("--copy=".length)
  .trim();
const recoveryArg = args.find((arg) => arg.startsWith("--recovery="));
const recoveryPathArg = recoveryArg
  ?.slice("--recovery=".length)
  .trim();
const realUseArg = args.find((arg) => arg.startsWith("--real-use="));
const realUsePathArg = realUseArg
  ?.slice("--real-use=".length)
  .trim();
const entrySurfacesArg = args.find((arg) => arg.startsWith("--entry-surfaces="));
const entrySurfacesPathArg = entrySurfacesArg
  ?.slice("--entry-surfaces=".length)
  .trim();
const rollbackOwnerArg = args.find((arg) => arg.startsWith("--rollback-owner="));
const rollbackOwnerPathArg = rollbackOwnerArg
  ?.slice("--rollback-owner=".length)
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
const copyValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-copy-evidence.ts",
);
const recoveryValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-recovery-evidence.ts",
);
const realUseValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-real-use-evidence.ts",
);
const entrySurfacesValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-entry-surface-evidence.ts",
);
const rollbackOwnerValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "prepare-voice-canvas-rollback-owner-handoff.ts",
);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Preflight the Voice Canvas launch-readiness evidence gates.",
      "",
      "Usage:",
      "  npm run canvas:qa:preflight",
      "  npm run canvas:qa:preflight -- --final --date=YYYY-MM-DD",
      "  npm run --silent canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json",
      "  npm run --silent canvas:qa:preflight -- --final --date=YYYY-MM-DD --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
      "  npm run --silent canvas:qa:preflight -- --json",
      "  npm run --silent canvas:qa:preflight -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
      "  npm run canvas:qa:preflight -- --run-plan=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json",
      "  npm run canvas:qa:preflight -- --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json",
      "  npm run canvas:qa:preflight -- --copy=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md",
      "  npm run canvas:qa:preflight -- --recovery=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md",
      "  npm run canvas:qa:preflight -- --real-use=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md",
      "  npm run canvas:qa:preflight -- --entry-surfaces=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md",
      "  npm run canvas:qa:preflight -- --features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json --features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
      "  npm run canvas:qa:preflight -- --rollback-owner=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
      "  npm run canvas:qa:preflight -- --runsheet=docs/audits/voice-canvas-real-device-run-sheet.md --matrix=docs/audits/voice-canvas-real-device-qa-matrix.md --packet=docs/audits/voice-canvas-real-device-evidence-packet.md",
      "",
      "Default mode accepts a structurally valid pending run sheet, matrix, and packet so QA can capture an in-progress launch artifact.",
      "Pass --date=YYYY-MM-DD to validate the standard same-date, same deployed-origin launch evidence bundle without hand-assembling every artifact path.",
      "Use --final --date=YYYY-MM-DD for launch sign-off; plain --final is only for custom explicit artifact-path diagnostics.",
      "Pass --run-plan=<path> to validate the same-date, same deployed-origin launch evidence run plan generated by canvas:qa:run with matching endpoint auth metadata.",
      "Pass --features-enabled=<path> and --features-rollback=<path> to validate sanitized endpoint collector artifacts generated within the last 7 days.",
      "Pass --analytics=<path> to validate sanitized analytics evidence generated within the last 7 days in the same aggregate-only snapshot.",
      "Pass --copy=<path> to validate sanitized senior-friendly copy and next-step clarity evidence generated within the last 7 days.",
      "Pass --recovery=<path> to validate sanitized resume, refresh, back, reconnect, interruption, cancel, retry, duplicate, and stale-response evidence generated within the last 7 days.",
      "Pass --real-use=<path> to validate sanitized real device and interaction evidence generated within the last 7 days.",
      "Pass --entry-surfaces=<path> to validate sanitized canonical entry surface evidence generated within the last 7 days.",
      "Pass --rollback-owner=<path> to validate the sanitized rollback owner handoff artifact generated within the last 7 days.",
      "Final external evidence artifacts must share one QA run date across enabled endpoints, rollback endpoints, analytics, copy clarity, recovery behavior, real-use evidence, entry surfaces, and rollback owner handoff.",
      "Final external evidence artifacts with QA URLs must share one deployed QA origin across endpoint, analytics, copy clarity, recovery behavior, real-use, entry surface, rollback owner, and launch run plan artifacts.",
      "Use --final --date=YYYY-MM-DD after real-device evidence is filled; it exits non-zero unless the run sheet, matrix, packet, launch run plan, enabled endpoint artifact, rollback endpoint artifact, analytics evidence, copy clarity evidence, recovery behavior evidence, real-use evidence, entry surface evidence, and rollback owner handoff are ready.",
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
if (bundleDateArg && !bundleDatePathArg) {
  console.error("Expected --date=YYYY-MM-DD.");
  process.exit(1);
}
if (runPlanArg && !runPlanPathArg) {
  console.error("Expected --run-plan=<path>.");
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
if (copyArg && !copyPathArg) {
  console.error("Expected --copy=<path>.");
  process.exit(1);
}
if (recoveryArg && !recoveryPathArg) {
  console.error("Expected --recovery=<path>.");
  process.exit(1);
}
if (realUseArg && !realUsePathArg) {
  console.error("Expected --real-use=<path>.");
  process.exit(1);
}
if (entrySurfacesArg && !entrySurfacesPathArg) {
  console.error("Expected --entry-surfaces=<path>.");
  process.exit(1);
}
if (rollbackOwnerArg && !rollbackOwnerPathArg) {
  console.error("Expected --rollback-owner=<path>.");
  process.exit(1);
}
if (outputPathArg && !jsonOutput) {
  console.error("Use --output only with --json.");
  process.exit(1);
}
if (jsonOutput && outputPathArg && !forceOutput) {
  const outputPath = path.resolve(process.cwd(), outputPathArg);
  if (existsSync(outputPath)) {
    console.error(
      `Output file already exists. Use a run-specific path or pass --force to overwrite: ${path.relative(process.cwd(), outputPath)}`,
    );
    process.exit(1);
  }
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
  baseUrl: string;
  generatedAt: string;
  authenticatedRequest: boolean;
  requestHeaderCount: number;
  endpointCount: number;
  problemCount: number;
  problems: string[];
}

interface LaunchRunPlanValidation {
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
}

interface ExternalEvidenceDateConsistency {
  ready: boolean;
  checked: boolean;
  runDate: string;
  problemCount: number;
  problems: string[];
}

interface ExternalEvidenceOriginConsistency {
  ready: boolean;
  checked: boolean;
  origin: string;
  problemCount: number;
  problems: string[];
}

interface EndpointAuthConsistency {
  ready: boolean;
  checked: boolean;
  requestHeaderCount: number;
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

function stringArraysEqual(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    expected.every((entry, index) => actual[index] === entry)
  );
}

function featureFlagCoverageMatches(
  actual: unknown,
  expected: ReturnType<typeof canvasLaunchEvidenceFlowCoverage>[number]["featureFlag"],
): boolean {
  if (!expected) return actual === null;
  if (!isRecord(actual)) return false;
  return (
    actual.endpoint === expected.endpoint &&
    actual.serverFeatureKey === expected.serverFeatureKey &&
    actual.enableEnv === expected.enableEnv &&
    actual.rolloutEnv === expected.rolloutEnv
  );
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
    host.includes("mock") ||
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

function summaryDeployedOrigin(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "unknown";
  const deployedOrigin = parseDeployedOrigin(value);
  return deployedOrigin ? deployedOrigin.origin : "invalid";
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
      baseUrl: "unknown",
      generatedAt: "unknown",
      authenticatedRequest: false,
      requestHeaderCount: 0,
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
  } else if (containsUnsafeLaunchArtifactText(artifact)) {
    problems.push(
      "Feature endpoint artifact contains contradictory or unsafe launch evidence wording.",
    );
  }

  const endpoints = isRecord(artifact) ? artifact.featureEndpoints : null;
  if (!Array.isArray(endpoints)) {
    problems.push("Feature endpoint artifact must include featureEndpoints array.");
  }

  const baseUrl = isRecord(artifact) && typeof artifact.baseUrl === "string"
    ? artifact.baseUrl
    : "unknown";
  const deployedOrigin = parseDeployedOrigin(baseUrl);
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

  const authenticatedRequest = isRecord(artifact)
    ? artifact.authenticatedRequest
    : undefined;
  const requestHeaderCount = isRecord(artifact)
    ? artifact.requestHeaderCount
    : undefined;
  if (authenticatedRequest !== undefined && typeof authenticatedRequest !== "boolean") {
    problems.push("Feature endpoint artifact authenticatedRequest must be boolean when present.");
  }
  if (
    requestHeaderCount !== undefined &&
    (!Number.isInteger(requestHeaderCount) || requestHeaderCount < 0)
  ) {
    problems.push("Feature endpoint artifact requestHeaderCount must be a non-negative integer when present.");
  }
  if (authenticatedRequest === true && requestHeaderCount === 0) {
    problems.push("Feature endpoint artifact authenticatedRequest requires a positive requestHeaderCount.");
  }
  if (authenticatedRequest === false && typeof requestHeaderCount === "number" && requestHeaderCount > 0) {
    problems.push("Feature endpoint artifact unauthenticated requests must not report requestHeaderCount.");
  }
  for (const unsafeKey of [
    "requestHeaderEnv",
    "requestHeaders",
    "headers",
    "authorization",
    "Authorization",
    "cookie",
    "Cookie",
  ]) {
    if (isRecord(artifact) && Object.prototype.hasOwnProperty.call(artifact, unsafeKey)) {
      problems.push(
        "Feature endpoint artifact must not include request header names, cookies, authorization values, or credential references.",
      );
      break;
    }
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
    baseUrl: summaryDeployedOrigin(baseUrl),
    generatedAt: generatedAt ? generatedAt.toISOString() : "unknown",
    authenticatedRequest: authenticatedRequest === true,
    requestHeaderCount:
      typeof requestHeaderCount === "number" && Number.isInteger(requestHeaderCount)
        ? requestHeaderCount
        : 0,
    endpointCount: endpointRows.length,
    problemCount: problems.length,
    problems,
  };
}

function evidenceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = parseValidNonFutureGeneratedAt(trimmed);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function parseValidRunDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    parsed.getTime() > Date.now()
  ) {
    return null;
  }
  return parsed;
}

function artifactPathsForRunDate(runDate: string): Record<string, string> {
  const artifactPrefix = `artifacts/voice-canvas/${runDate}`;
  return {
    enabledEndpoints: `${artifactPrefix}-feature-endpoints-enabled.json`,
    rollbackEndpoints: `${artifactPrefix}-feature-endpoints-rollback-disabled.json`,
    analyticsEvidence: `${artifactPrefix}-analytics-evidence.json`,
    analyticsValidation: `${artifactPrefix}-analytics-validation.json`,
    copyEvidence: `${artifactPrefix}-copy-clarity.md`,
    copyValidation: `${artifactPrefix}-copy-clarity-validation.json`,
    recoveryEvidence: `${artifactPrefix}-recovery-behavior.md`,
    recoveryValidation: `${artifactPrefix}-recovery-behavior-validation.json`,
    realUseEvidence: `${artifactPrefix}-real-use-coverage.md`,
    realUseValidation: `${artifactPrefix}-real-use-validation.json`,
    entrySurfaces: `${artifactPrefix}-entry-surfaces.md`,
    entrySurfacesValidation: `${artifactPrefix}-entry-surfaces-validation.json`,
    rollbackOwnerHandoff: `${artifactPrefix}-rollback-owner-handoff.md`,
    rollbackOwnerValidation: `${artifactPrefix}-rollback-owner-validation.json`,
    runSheetSummary: `${artifactPrefix}-run-sheet-summary.json`,
    qaMatrixSummary: `${artifactPrefix}-qa-summary.json`,
    evidencePacketSummary: `${artifactPrefix}-evidence-packet-summary.json`,
    launchPreflight: `${artifactPrefix}-launch-preflight.json`,
    launchRunPlan: `${artifactPrefix}-launch-evidence-run.json`,
  };
}

function validateRequestHeaderEnvRefs(values: unknown): string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) {
    return ["Launch evidence run plan requestHeaderEnv must be an array when provided."];
  }

  const problems: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      problems.push("Launch evidence run plan requestHeaderEnv entries must be strings.");
      continue;
    }
    const separatorIndex = value.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      problems.push(
        "Launch evidence run plan requestHeaderEnv entries must use Header-Name:ENV_NAME without secret values.",
      );
      continue;
    }
    const headerName = value.slice(0, separatorIndex).trim();
    const envName = value.slice(separatorIndex + 1).trim();
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(headerName)) {
      problems.push("Launch evidence run plan requestHeaderEnv includes an invalid HTTP header name.");
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envName)) {
      problems.push("Launch evidence run plan requestHeaderEnv includes an invalid environment variable name.");
    }
  }
  return problems;
}

function requestHeaderEnvRefsFromArtifact(artifact: unknown): string[] {
  if (!isRecord(artifact) || !Array.isArray(artifact.requestHeaderEnv)) return [];
  return artifact.requestHeaderEnv.filter((entry): entry is string => typeof entry === "string");
}

const requiredLaunchRunPlanChecklistGroups: Array<{
  label: string;
  wordGroups: readonly (readonly string[])[];
}> = [
  {
    label: "real phone, tablet, desktop/laptop, voice, touch, and keyboard coverage",
    wordGroups: [
      ["phone", "mobile"],
      ["tablet"],
      ["desktop", "laptop"],
      ["voice"],
      ["touch"],
      ["keyboard"],
    ],
  },
  {
    label:
      "refresh, back, app exit/reopen, reconnect, interruption, cancel/exit, retry, and duplicate/stale recovery",
    wordGroups: [
      ["refresh"],
      ["back"],
      ["app exit", "reopen"],
      ["reconnect"],
      ["interruption", "interrupt"],
      ["cancel", "exit"],
      ["retry"],
      ["duplicate"],
      ["stale"],
      ["preserved", "preserve"],
    ],
  },
  {
    label: "open-session feature-flag rollback fallback without side effects",
    wordGroups: [
      ["feature-flag", "feature flag"],
      ["rollback"],
      ["open session", "open-session"],
      ["closed", "closes", "hidden", "hides"],
      ["fallback"],
      ["without writes", "without write", "no writes", "no write"],
      [
        "without external actions",
        "without external action",
        "no external actions",
        "no external action",
        "external actions",
        "external action",
      ],
    ],
  },
  {
    label:
      "senior-friendly copy, Spanish long labels, announcements, focus, reduced motion, and what happens next",
    wordGroups: [
      ["one clear decision"],
      ["spanish"],
      ["long label", "long labels", "long spanish label", "long spanish labels"],
      ["waiting"],
      ["blocked"],
      ["completed"],
      ["announcement", "announcements"],
      ["focus"],
      ["reduced motion", "reduced-motion"],
      ["what-happens-next", "what happens next"],
    ],
  },
  {
    label: "privacy-safe aggregate analytics evidence",
    wordGroups: [
      ["analytics"],
      ["aggregate"],
      ["telemetry"],
    ],
  },
  {
    label: "one deployed QA origin across external launch artifacts",
    wordGroups: [
      ["one", "same", "single"],
      ["deployed"],
      ["qa origin", "origin"],
      ["launch run plan", "run plan"],
      ["enabled endpoint", "enabled endpoints"],
      ["rollback endpoint", "rollback endpoints"],
      ["analytics"],
      ["copy clarity", "copy-clarity"],
      ["recovery behavior", "recovery-behavior"],
      ["real use", "real-use"],
      ["entry surface", "entry-surface"],
      ["rollback owner", "rollback-owner"],
    ],
  },
  {
    label: "endpoint auth metadata matching the launch run plan without credentials",
    wordGroups: [
      ["endpoint"],
      ["auth metadata", "authentication metadata"],
      ["matching", "match"],
      ["launch run plan", "run plan"],
      ["request header", "request-header"],
      ["credential", "credentials", "token", "tokens", "secret", "secrets"],
    ],
  },
];

function normalizeRunPlanText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasRunPlanWord(value: string, words: readonly string[]): boolean {
  const normalized = normalizeRunPlanText(value);
  return words.some((word) => normalized.includes(normalizeRunPlanText(word)));
}

function hasRunPlanWordGroups(
  value: string,
  wordGroups: readonly (readonly string[])[],
): boolean {
  return wordGroups.every((words) => hasRunPlanWord(value, words));
}

function hasUnsafeLaunchRunPlanText(value: string): boolean {
  const normalized = normalizeRunPlanText(value);
  return (
    /\b(known issue|known issues|known bug|known bugs|unresolved issue|unresolved issues|unresolved bug|unresolved bugs|defect|defects|regression|regressions|risk accepted|accepted risk|launch risk|workaround required|manual workaround|waiver|exception)\b/.test(
      normalized,
    ) ||
    /\b(not complete|not completed|incomplete|did not complete|failed to complete|unable to complete|could not complete|not safely exited|not safe exit|not exited safely)\b/.test(
      normalized,
    ) ||
    /\b(?:write|writes|external action|external actions|booking|bookings|call|calls|message|messages|navigation|navigations|reply|replies|refill request|order|orders|submission|submissions|endpoint|endpoints)\b.{0,36}\b(?:happened|occurred|triggered|fired|ran|sent|submitted|created|wrote|called|messaged|navigated|booked|ordered)\b/.test(
      normalized,
    ) ||
    /\b(?:triggered|fired|ran|sent|submitted|created|wrote|called|messaged|navigated|booked|ordered)\b.{0,36}\b(?:write|writes|external action|external actions|booking|bookings|call|calls|message|messages|navigation|navigations|reply|replies|refill request|order|orders|submission|submissions|endpoint|endpoints)\b/.test(
      normalized,
    ) ||
    /\b(?:fallback|rollback|canvas|draft|entered information|current scene|current work|focus|screen reader|announcement|announcements|spanish|long labels|analytics|voice|touch|keyboard|reconnect|refresh|interruption|browser back|retry|exit|task hub|destination)\b.{0,36}\b(?:unavailable|not available|not visible|not shown|not working|not preserved|not restored|not recovered|not readable|not announced|failed|broken)\b/.test(
      normalized,
    ) ||
    /\b(?:unavailable|not available|not visible|not shown|not working|not preserved|not restored|not recovered|not readable|not announced|failed|broken)\b.{0,36}\b(?:fallback|rollback|canvas|draft|entered information|current scene|current work|focus|screen reader|announcement|announcements|spanish|long labels|analytics|voice|touch|keyboard|reconnect|refresh|interruption|browser back|retry|exit|task hub|destination)\b/.test(
      normalized,
    )
  );
}

function containsUnsafeLaunchArtifactText(value: unknown): boolean {
  if (typeof value === "string") return hasUnsafeLaunchRunPlanText(value);
  if (Array.isArray(value)) return value.some(containsUnsafeLaunchArtifactText);
  if (!isRecord(value)) return false;
  return Object.values(value).some(containsUnsafeLaunchArtifactText);
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

function validateLaunchRunPlanArtifact(
  artifactPathArg: string | undefined,
): LaunchRunPlanValidation {
  if (!artifactPathArg) {
    return {
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
    };
  }

  const artifactPath = path.resolve(process.cwd(), artifactPathArg);
  const relativePath = path.relative(process.cwd(), artifactPath);
  const problems: string[] = [];
  let artifact: unknown = null;

  if (!existsSync(artifactPath)) {
    problems.push("Launch evidence run plan artifact does not exist.");
  } else {
    try {
      artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as unknown;
    } catch {
      problems.push("Launch evidence run plan artifact must be valid JSON.");
    }
  }

  const runDate = isRecord(artifact) && typeof artifact.runDate === "string"
    ? artifact.runDate
    : "unknown";
  const baseUrl = isRecord(artifact) && typeof artifact.baseUrl === "string"
    ? artifact.baseUrl
    : "unknown";
  const commands = isRecord(artifact) && Array.isArray(artifact.commands)
    ? artifact.commands.filter((entry): entry is string => typeof entry === "string")
    : [];
  const checklist = isRecord(artifact) && Array.isArray(artifact.checklist)
    ? artifact.checklist.filter((entry): entry is string => typeof entry === "string")
    : [];
  const privacyBoundary = isRecord(artifact) && Array.isArray(artifact.privacyBoundary)
    ? artifact.privacyBoundary.filter((entry): entry is string => typeof entry === "string")
    : [];
  const message = isRecord(artifact) && typeof artifact.message === "string"
    ? artifact.message
    : "";
  const flowCoverage = isRecord(artifact) && Array.isArray(artifact.flowCoverage)
    ? artifact.flowCoverage.filter(isRecord)
    : [];
  const requestHeaderEnvRefs = requestHeaderEnvRefsFromArtifact(artifact);
  const artifactPaths = isRecord(artifact) && isRecord(artifact.artifactPaths)
    ? artifact.artifactPaths
    : {};
  problems.push(...validateRequestHeaderEnvRefs(isRecord(artifact) ? artifact.requestHeaderEnv : undefined));

  if (!isRecord(artifact)) {
    problems.push("Launch evidence run plan artifact must be a JSON object.");
  } else {
    if (containsUnsafeLaunchArtifactText(artifact)) {
      problems.push(
        "Launch evidence run plan contains contradictory or unsafe launch evidence wording.",
      );
    }
    if (artifact.readyForEvidenceRun !== true) {
      problems.push("Launch evidence run plan must be marked readyForEvidenceRun true.");
    }
    if (artifact.sameRunDateRequired !== true) {
      problems.push("Launch evidence run plan must require the same run date.");
    }
  }

  const parsedRunDate = parseValidRunDate(runDate);
  if (!parsedRunDate) {
    problems.push("Launch evidence run plan must include a valid non-future YYYY-MM-DD runDate.");
  } else if (Date.now() - parsedRunDate.getTime() > maxLaunchEvidenceAgeMs) {
    problems.push("Launch evidence run plan runDate must be no older than 7 days.");
  }

  const deployedOrigin = parseDeployedOrigin(baseUrl);
  if (!deployedOrigin) {
    problems.push("Launch evidence run plan baseUrl must be a deployed HTTPS non-local origin.");
  }

  if (parsedRunDate) {
    const expectedPaths = artifactPathsForRunDate(runDate);
    for (const [key, expectedValue] of Object.entries(expectedPaths)) {
      if (artifactPaths[key] !== expectedValue) {
        problems.push(`Launch evidence run plan artifact path ${key} must be ${expectedValue}.`);
      }
    }
    if (path.normalize(relativePath) !== path.normalize(expectedPaths.launchRunPlan)) {
      problems.push("Launch evidence run plan path must match its run-date artifact path.");
    }
  }

  if (deployedOrigin && parsedRunDate) {
    const expectedCommands = launchEvidenceCommandsForRun(
      runDate,
      deployedOrigin.origin,
      requestHeaderEnvRefs,
    );
    if (
      commands.length !== expectedCommands.length ||
      expectedCommands.some((command, index) => commands[index] !== command)
    ) {
      problems.push("Launch evidence run plan commands must match the canonical same-date, same deployed-origin evidence bundle.");
    }
  }

  if (!isRecord(artifact) || !Array.isArray(artifact.checklist)) {
    problems.push("Launch evidence run plan must include a checklist array.");
  } else {
    const checklistText = checklist.join(" ");
    for (const requirement of requiredLaunchRunPlanChecklistGroups) {
      if (!hasRunPlanWordGroups(checklistText, requirement.wordGroups)) {
        problems.push(
          `Launch evidence run plan checklist must require ${requirement.label}.`,
        );
      }
    }
  }
  const coveredFlowIds = new Set(
    flowCoverage
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const expectedFlowCoverage = canvasLaunchEvidenceFlowCoverage();
  for (const flow of expectedFlowCoverage) {
    if (!coveredFlowIds.has(flow.id)) {
      problems.push(`${flow.label}: launch evidence run plan must include this flow.`);
      continue;
    }

    const row = flowCoverage.find((entry) => entry.id === flow.id);
    if (!row) continue;
    if (row.label !== flow.label) {
      problems.push(`${flow.label}: launch evidence run plan label must match the launch manifest.`);
    }
    if (!stringArraysEqual(stringArrayField(row, "surfaces"), flow.surfaces)) {
      problems.push(
        `${flow.label}: launch evidence run plan must include the canonical entry surfaces.`,
      );
    }
    if (!stringArraysEqual(stringArrayField(row, "qaGates"), flow.qaGates)) {
      problems.push(
        `${flow.label}: launch evidence run plan must include the canonical real-use QA gates.`,
      );
    }
    if (row.fallback !== flow.fallback) {
      problems.push(
        `${flow.label}: launch evidence run plan fallback must match the launch manifest.`,
      );
    }
    if (row.telemetryEvent !== flow.telemetryEvent) {
      problems.push(
        `${flow.label}: launch evidence run plan telemetry event must match the launch manifest.`,
      );
    }
    if (!featureFlagCoverageMatches(row.featureFlag, flow.featureFlag)) {
      problems.push(
        `${flow.label}: launch evidence run plan feature flag details must match the launch manifest.`,
      );
    }
  }
  if (flowCoverage.length !== expectedFlowCoverage.length) {
    problems.push("Launch evidence run plan flowCoverage must match the launch flow count.");
  }

  return {
    provided: true,
    path: relativePath,
    readyForLaunchEvidence: problems.length === 0,
    runDate,
    baseUrl: summaryDeployedOrigin(baseUrl),
    requestHeaderCount: requestHeaderEnvRefs.length,
    commandCount: commands.length,
    flowCount: flowCoverage.length,
    canonicalFlowCoverage: expectedFlowCoverage,
    problemCount: problems.length,
    problems,
  };
}

function validateExternalEvidenceDateConsistency(
  enabledFeatures: FeatureEndpointArtifactValidation,
  rollbackFeatures: FeatureEndpointArtifactValidation,
  analyticsRun: ValidatorRun | null,
  copyRun: ValidatorRun | null,
  recoveryRun: ValidatorRun | null,
  realUseRun: ValidatorRun | null,
  entrySurfacesRun: ValidatorRun | null,
  rollbackOwnerRun: ValidatorRun | null,
  runPlan: LaunchRunPlanValidation,
): ExternalEvidenceDateConsistency {
  const requiredEntries = [
    {
      label: "enabled feature endpoints",
      date: evidenceDate(enabledFeatures.generatedAt),
      provided: enabledFeatures.provided,
    },
    {
      label: "rollback feature endpoints",
      date: evidenceDate(rollbackFeatures.generatedAt),
      provided: rollbackFeatures.provided,
    },
    {
      label: "analytics evidence",
      date: evidenceDate(analyticsRun?.summary?.generatedAt),
      provided: Boolean(analyticsRun),
    },
    {
      label: "copy clarity evidence",
      date: evidenceDate(copyRun?.summary?.reviewedOn),
      provided: Boolean(copyRun),
    },
    {
      label: "recovery behavior evidence",
      date: evidenceDate(recoveryRun?.summary?.reviewedOn),
      provided: Boolean(recoveryRun),
    },
    {
      label: "real-use evidence",
      date: evidenceDate(realUseRun?.summary?.reviewedOn),
      provided: Boolean(realUseRun),
    },
    {
      label: "entry surface evidence",
      date: evidenceDate(entrySurfacesRun?.summary?.reviewedOn),
      provided: Boolean(entrySurfacesRun),
    },
    {
      label: "rollback owner handoff",
      date: evidenceDate(rollbackOwnerRun?.summary?.reviewedOn),
      provided: Boolean(rollbackOwnerRun),
    },
  ];
  const entries = runPlan.provided
    ? [
        {
          label: "launch run plan",
          date: evidenceDate(runPlan.runDate),
          provided: runPlan.provided,
        },
        ...requiredEntries,
      ]
    : requiredEntries;

  const requiredProvidedEntries = requiredEntries.filter((entry) => entry.provided);
  if (requiredProvidedEntries.length !== requiredEntries.length) {
    return {
      ready: false,
      checked: false,
      runDate: "unknown",
      problemCount: 0,
      problems: [],
    };
  }

  const providedEntries = entries.filter((entry) => entry.provided);
  const missingDateLabels = providedEntries
    .filter((entry) => !entry.date)
    .map((entry) => entry.label);
  const datedEntries = providedEntries.filter(
    (entry): entry is { label: string; date: string; provided: boolean } =>
      Boolean(entry.date),
  );
  const uniqueDates = new Set(datedEntries.map((entry) => entry.date));
  const problems: string[] = [];

  if (missingDateLabels.length > 0) {
    problems.push(
      `External launch evidence is missing comparable run dates for ${missingDateLabels.join(", ")}.`,
    );
  }
  if (uniqueDates.size > 1) {
    problems.push(
      `External launch evidence must share one QA run date; found ${datedEntries
        .map((entry) => `${entry.label} ${entry.date}`)
        .join(", ")}.`,
    );
  }

  return {
    ready: problems.length === 0,
    checked: true,
    runDate: uniqueDates.size === 1 ? datedEntries[0]?.date ?? "unknown" : "mixed",
    problemCount: problems.length,
    problems,
  };
}

function evidenceOrigin(value: unknown): string | null {
  return parseDeployedOrigin(value)?.origin ?? null;
}

function validateExternalEvidenceOriginConsistency(
  enabledFeatures: FeatureEndpointArtifactValidation,
  rollbackFeatures: FeatureEndpointArtifactValidation,
  analyticsRun: ValidatorRun | null,
  copyRun: ValidatorRun | null,
  recoveryRun: ValidatorRun | null,
  realUseRun: ValidatorRun | null,
  entrySurfacesRun: ValidatorRun | null,
  rollbackOwnerRun: ValidatorRun | null,
  runPlan: LaunchRunPlanValidation,
): ExternalEvidenceOriginConsistency {
  const requiredEntries = [
    {
      label: "enabled feature endpoints",
      origin: evidenceOrigin(enabledFeatures.baseUrl),
      provided: enabledFeatures.provided,
    },
    {
      label: "rollback feature endpoints",
      origin: evidenceOrigin(rollbackFeatures.baseUrl),
      provided: rollbackFeatures.provided,
    },
    {
      label: "analytics evidence",
      origin: evidenceOrigin(analyticsRun?.summary?.qaRunUrl),
      provided: Boolean(analyticsRun),
    },
    {
      label: "copy clarity evidence",
      origin: evidenceOrigin(copyRun?.summary?.qaRunUrl),
      provided: Boolean(copyRun),
    },
    {
      label: "recovery behavior evidence",
      origin: evidenceOrigin(recoveryRun?.summary?.qaRunUrl),
      provided: Boolean(recoveryRun),
    },
    {
      label: "real-use evidence",
      origin: evidenceOrigin(realUseRun?.summary?.qaRunUrl),
      provided: Boolean(realUseRun),
    },
    {
      label: "entry surface evidence",
      origin: evidenceOrigin(entrySurfacesRun?.summary?.qaRunUrl),
      provided: Boolean(entrySurfacesRun),
    },
    {
      label: "rollback owner handoff",
      origin: evidenceOrigin(rollbackOwnerRun?.summary?.qaRunUrl),
      provided: Boolean(rollbackOwnerRun),
    },
  ];
  const entries = runPlan.provided
    ? [
        {
          label: "launch run plan",
          origin: evidenceOrigin(runPlan.baseUrl),
          provided: runPlan.provided,
        },
        ...requiredEntries,
      ]
    : requiredEntries;

  const requiredProvidedEntries = requiredEntries.filter((entry) => entry.provided);
  if (requiredProvidedEntries.length !== requiredEntries.length) {
    return {
      ready: false,
      checked: false,
      origin: "unknown",
      problemCount: 0,
      problems: [],
    };
  }

  const providedEntries = entries.filter((entry) => entry.provided);
  const missingOriginLabels = providedEntries
    .filter((entry) => !entry.origin)
    .map((entry) => entry.label);
  const originatedEntries = providedEntries.filter(
    (entry): entry is { label: string; origin: string; provided: boolean } =>
      Boolean(entry.origin),
  );
  const uniqueOrigins = new Set(originatedEntries.map((entry) => entry.origin));
  const problems: string[] = [];

  if (missingOriginLabels.length > 0) {
    problems.push(
      `External launch evidence is missing comparable deployed origins for ${missingOriginLabels.join(", ")}.`,
    );
  }
  if (uniqueOrigins.size > 1) {
    problems.push(
      `External launch evidence must share one deployed QA origin; found ${originatedEntries
        .map((entry) => `${entry.label} ${entry.origin}`)
        .join(", ")}.`,
    );
  }

  return {
    ready: problems.length === 0,
    checked: true,
    origin:
      uniqueOrigins.size === 1 ? originatedEntries[0]?.origin ?? "unknown" : "mixed",
    problemCount: problems.length,
    problems,
  };
}

function validateEndpointAuthConsistency(
  runPlan: LaunchRunPlanValidation,
  enabledFeatures: FeatureEndpointArtifactValidation,
  rollbackFeatures: FeatureEndpointArtifactValidation,
): EndpointAuthConsistency {
  if (!runPlan.provided || !enabledFeatures.provided || !rollbackFeatures.provided) {
    return {
      ready: false,
      checked: false,
      requestHeaderCount: runPlan.requestHeaderCount,
      problemCount: 0,
      problems: [],
    };
  }

  const problems: string[] = [];
  for (const [label, artifact] of [
    ["enabled feature endpoints", enabledFeatures],
    ["rollback feature endpoints", rollbackFeatures],
  ] as const) {
    if (artifact.requestHeaderCount !== runPlan.requestHeaderCount) {
      problems.push(
        `${label}: requestHeaderCount must match the launch run plan request header count.`,
      );
    }
    if (runPlan.requestHeaderCount > 0 && !artifact.authenticatedRequest) {
      problems.push(
        `${label}: authenticatedRequest must be true when the launch run plan uses request headers.`,
      );
    }
    if (runPlan.requestHeaderCount === 0 && artifact.authenticatedRequest) {
      problems.push(
        `${label}: authenticatedRequest must be false when the launch run plan does not use request headers.`,
      );
    }
  }

  return {
    ready: problems.length === 0,
    checked: true,
    requestHeaderCount: runPlan.requestHeaderCount,
    problemCount: problems.length,
    problems,
  };
}

function messagesForNextAction(
  runSheetRun: ValidatorRun,
  matrixRun: ValidatorRun,
  packetRun: ValidatorRun,
  runPlan: LaunchRunPlanValidation,
  analyticsRun: ValidatorRun | null,
  copyRun: ValidatorRun | null,
  recoveryRun: ValidatorRun | null,
  realUseRun: ValidatorRun | null,
  entrySurfacesRun: ValidatorRun | null,
  rollbackOwnerRun: ValidatorRun | null,
  enabledFeatures: FeatureEndpointArtifactValidation,
  rollbackFeatures: FeatureEndpointArtifactValidation,
  externalEvidenceDateConsistency: ExternalEvidenceDateConsistency,
  externalEvidenceOriginConsistency: ExternalEvidenceOriginConsistency,
  endpointAuthConsistency: EndpointAuthConsistency,
): string[] {
  const messages: string[] = [];
  if (finalGate && !bundleDatePathArg) {
    messages.push(
      "For final launch sign-off, rerun with --date=YYYY-MM-DD so the same-date, same deployed-origin evidence bundle cannot accidentally omit required artifacts.",
    );
  }
  const runSheetProblems = numericField(runSheetRun.summary, "problemCount");
  const runSheetIncomplete = numericField(
    runSheetRun.summary,
    "incompleteCellCount",
  );
  const matrixProblems = numericField(matrixRun.summary, "problemCount");
  const packetProblems = numericField(packetRun.summary, "problemCount");
  const analyticsProblems = numericField(analyticsRun?.summary ?? null, "problemCount");
  const copyProblems = numericField(copyRun?.summary ?? null, "problemCount");
  const recoveryProblems = numericField(recoveryRun?.summary ?? null, "problemCount");
  const realUseProblems = numericField(realUseRun?.summary ?? null, "problemCount");
  const entrySurfacesProblems = numericField(
    entrySurfacesRun?.summary ?? null,
    "problemCount",
  );
  const rollbackOwnerProblems = numericField(
    rollbackOwnerRun?.summary ?? null,
    "problemCount",
  );
  const matrixFailing = numericField(matrixRun.summary, "failingCellCount");
  const matrixIncomplete = numericField(matrixRun.summary, "incompleteCellCount");
  const packetIncomplete = numericField(packetRun.summary, "incompleteCellCount");

  if (runSheetIncomplete > 0 || matrixIncomplete > 0 || packetIncomplete > 0) {
    messages.push(
      "Start with docs/audits/voice-canvas-real-device-qa-handoff.md, then execute the detailed run sheet, evidence packet, and QA matrix.",
    );
  }

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
  if (runPlan.problemCount > 0) {
    messages.push("Fix the launch evidence run plan before final launch sign-off.");
  }
  if (analyticsRun && !analyticsRun.summary) {
    messages.push("Fix the analytics validator output before using the preflight artifact.");
  }
  if (copyRun && !copyRun.summary) {
    messages.push("Fix the copy clarity validator output before using the preflight artifact.");
  }
  if (recoveryRun && !recoveryRun.summary) {
    messages.push("Fix the recovery behavior validator output before using the preflight artifact.");
  }
  if (realUseRun && !realUseRun.summary) {
    messages.push("Fix the real-use validator output before using the preflight artifact.");
  }
  if (entrySurfacesRun && !entrySurfacesRun.summary) {
    messages.push("Fix the entry surface validator output before using the preflight artifact.");
  }
  if (rollbackOwnerRun && !rollbackOwnerRun.summary) {
    messages.push("Fix the rollback owner handoff validator output before using the preflight artifact.");
  }
  if (analyticsProblems > 0) {
    messages.push("Fix sanitized analytics evidence before launch sign-off.");
  }
  if (copyProblems > 0) {
    messages.push("Fix sanitized copy clarity evidence before launch sign-off.");
  }
  if (recoveryProblems > 0) {
    messages.push("Fix sanitized recovery behavior evidence before launch sign-off.");
  }
  if (realUseProblems > 0) {
    messages.push("Fix sanitized real-use evidence before launch sign-off.");
  }
  if (entrySurfacesProblems > 0) {
    messages.push("Fix sanitized entry surface evidence before launch sign-off.");
  }
  if (rollbackOwnerProblems > 0) {
    messages.push("Fix sanitized rollback owner handoff evidence before launch sign-off.");
  }
  if (externalEvidenceDateConsistency.problemCount > 0) {
    messages.push("Fix external launch evidence dates so endpoint, analytics, copy clarity, recovery behavior, real-use, entry surface, and rollback owner artifacts share one QA run date.");
  }
  if (externalEvidenceOriginConsistency.problemCount > 0) {
    messages.push("Fix external launch evidence origins so endpoint, analytics, copy clarity, recovery behavior, real-use, entry surface, and rollback owner artifacts share one deployed QA origin.");
  }
  if (endpointAuthConsistency.problemCount > 0) {
    messages.push("Fix endpoint evidence authentication metadata so it matches the launch run plan.");
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
  if (finalGate && !runPlan.provided) {
    messages.push("Provide --run-plan=<path> for the same-date, same deployed-origin launch evidence run plan with matching endpoint auth metadata before final launch sign-off.");
  }
  if (finalGate && !analyticsRun) {
    messages.push("Provide --analytics=<path> for the sanitized analytics evidence artifact before final launch sign-off.");
  }
  if (finalGate && !copyRun) {
    messages.push("Provide --copy=<path> for the sanitized copy clarity evidence artifact before final launch sign-off.");
  }
  if (finalGate && !recoveryRun) {
    messages.push("Provide --recovery=<path> for the sanitized recovery behavior evidence artifact before final launch sign-off.");
  }
  if (finalGate && !realUseRun) {
    messages.push("Provide --real-use=<path> for the sanitized real-use evidence artifact before final launch sign-off.");
  }
  if (finalGate && !entrySurfacesRun) {
    messages.push("Provide --entry-surfaces=<path> for the sanitized entry surface evidence artifact before final launch sign-off.");
  }
  if (finalGate && !rollbackOwnerRun) {
    messages.push("Provide --rollback-owner=<path> for the sanitized rollback owner handoff artifact before final launch sign-off.");
  }
  if (runSheetIncomplete > 0) {
    messages.push("Execute the real-device run sheet and record fresh sanitized evidence before final launch sign-off.");
  }
  if (packetIncomplete > 0) {
    messages.push(
      "Fill the sanitized evidence packet artifact references and reviewer/date cells with fresh explicit reviewed, verified, validated, approved, or sign-off wording.",
    );
  }
  if (finalGate && (packetIncomplete > 0 || matrixIncomplete > 0)) {
    messages.push(
      "Fill rollback owner handoff artifacts and Operations/rollback owner sign-off evidence before launch.",
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
  return launchEvidenceCommandsForRun(
    evidenceArtifactDatePlaceholder,
    evidenceBaseUrlPlaceholder,
  );
}

if (bundleDatePathArg) {
  const parsedBundleDate = parseValidRunDate(bundleDatePathArg);
  if (!parsedBundleDate) {
    console.error("Expected --date to be a valid non-future YYYY-MM-DD.");
    process.exit(1);
  }
  if (Date.now() - parsedBundleDate.getTime() > maxLaunchEvidenceAgeMs) {
    console.error("Expected --date to be no older than 7 days.");
    process.exit(1);
  }
}

const bundleArtifactPaths = bundleDatePathArg
  ? artifactPathsForRunDate(bundleDatePathArg)
  : null;
const effectiveRunPlanPathArg =
  runPlanPathArg ?? bundleArtifactPaths?.launchRunPlan;
const effectiveFeatureEnabledPathArg =
  featureEnabledPathArg ?? bundleArtifactPaths?.enabledEndpoints;
const effectiveFeatureRollbackPathArg =
  featureRollbackPathArg ?? bundleArtifactPaths?.rollbackEndpoints;
const effectiveAnalyticsPathArg =
  analyticsPathArg ?? bundleArtifactPaths?.analyticsEvidence;
const effectiveCopyPathArg =
  copyPathArg ?? bundleArtifactPaths?.copyEvidence;
const effectiveRecoveryPathArg =
  recoveryPathArg ?? bundleArtifactPaths?.recoveryEvidence;
const effectiveRealUsePathArg =
  realUsePathArg ?? bundleArtifactPaths?.realUseEvidence;
const effectiveEntrySurfacesPathArg =
  entrySurfacesPathArg ?? bundleArtifactPaths?.entrySurfaces;
const effectiveRollbackOwnerPathArg =
  rollbackOwnerPathArg ?? bundleArtifactPaths?.rollbackOwnerHandoff;

const runSheetRun = runValidator(runSheetValidatorPath, runSheetPathArg, {
  allowPending: !finalGate,
});
const matrixRun = runValidator(matrixValidatorPath, matrixPathArg, {
  allowPending: !finalGate,
});
const packetRun = runValidator(packetValidatorPath, packetPathArg, {
  allowPending: !finalGate,
});
const runPlan = validateLaunchRunPlanArtifact(effectiveRunPlanPathArg);
const analyticsRun = effectiveAnalyticsPathArg
  ? runValidator(analyticsValidatorPath, `--input=${effectiveAnalyticsPathArg}`, {
      allowPending: false,
    })
  : null;
const copyRun = effectiveCopyPathArg
  ? runValidator(copyValidatorPath, `--input=${effectiveCopyPathArg}`, {
      allowPending: false,
    })
  : null;
const recoveryRun = effectiveRecoveryPathArg
  ? runValidator(recoveryValidatorPath, `--input=${effectiveRecoveryPathArg}`, {
      allowPending: false,
    })
  : null;
const realUseRun = effectiveRealUsePathArg
  ? runValidator(realUseValidatorPath, `--input=${effectiveRealUsePathArg}`, {
      allowPending: false,
    })
  : null;
const entrySurfacesRun = effectiveEntrySurfacesPathArg
  ? runValidator(entrySurfacesValidatorPath, `--input=${effectiveEntrySurfacesPathArg}`, {
      allowPending: false,
    })
  : null;
const rollbackOwnerRun = effectiveRollbackOwnerPathArg
  ? runValidator(rollbackOwnerValidatorPath, `--input=${effectiveRollbackOwnerPathArg}`, {
      allowPending: false,
    })
  : null;
const enabledFeatures = validateFeatureEndpointArtifact(
  effectiveFeatureEnabledPathArg,
  "enabled",
);
const rollbackFeatures = validateFeatureEndpointArtifact(
  effectiveFeatureRollbackPathArg,
  "rollback",
);
const externalEvidenceDateConsistency = validateExternalEvidenceDateConsistency(
  enabledFeatures,
  rollbackFeatures,
  analyticsRun,
  copyRun,
  recoveryRun,
  realUseRun,
  entrySurfacesRun,
  rollbackOwnerRun,
  runPlan,
);
const externalEvidenceOriginConsistency = validateExternalEvidenceOriginConsistency(
  enabledFeatures,
  rollbackFeatures,
  analyticsRun,
  copyRun,
  recoveryRun,
  realUseRun,
  entrySurfacesRun,
  rollbackOwnerRun,
  runPlan,
);
const endpointAuthConsistency = validateEndpointAuthConsistency(
  runPlan,
  enabledFeatures,
  rollbackFeatures,
);
const readyForLaunch =
  booleanField(runSheetRun.summary, "readyForQaRunSheet") &&
  booleanField(matrixRun.summary, "readyForLaunch") &&
  booleanField(packetRun.summary, "readyForLaunchEvidencePacket") &&
  runPlan.readyForLaunchEvidence &&
  enabledFeatures.readyForLaunchEvidence &&
  rollbackFeatures.readyForLaunchEvidence &&
  booleanField(analyticsRun?.summary ?? null, "readyForLaunchEvidence") &&
  booleanField(copyRun?.summary ?? null, "readyForLaunchEvidence") &&
  booleanField(recoveryRun?.summary ?? null, "readyForLaunchEvidence") &&
  booleanField(realUseRun?.summary ?? null, "readyForLaunchEvidence") &&
  booleanField(entrySurfacesRun?.summary ?? null, "readyForLaunchEvidence") &&
  booleanField(rollbackOwnerRun?.summary ?? null, "readyForLaunchEvidence") &&
  externalEvidenceDateConsistency.ready &&
  externalEvidenceOriginConsistency.ready &&
  endpointAuthConsistency.ready;
const structuralProblems =
  !runSheetRun.summary ||
  !matrixRun.summary ||
  !packetRun.summary ||
  (analyticsRun !== null && !analyticsRun.summary) ||
  (copyRun !== null && !copyRun.summary) ||
  (recoveryRun !== null && !recoveryRun.summary) ||
  (realUseRun !== null && !realUseRun.summary) ||
  (entrySurfacesRun !== null && !entrySurfacesRun.summary) ||
  (rollbackOwnerRun !== null && !rollbackOwnerRun.summary) ||
  numericField(runSheetRun.summary, "problemCount") > 0 ||
  numericField(matrixRun.summary, "problemCount") > 0 ||
  numericField(matrixRun.summary, "failingCellCount") > 0 ||
  numericField(packetRun.summary, "problemCount") > 0 ||
  runPlan.problemCount > 0 ||
  enabledFeatures.problemCount > 0 ||
  rollbackFeatures.problemCount > 0 ||
  numericField(analyticsRun?.summary ?? null, "problemCount") > 0 ||
  numericField(copyRun?.summary ?? null, "problemCount") > 0 ||
  numericField(recoveryRun?.summary ?? null, "problemCount") > 0 ||
  numericField(realUseRun?.summary ?? null, "problemCount") > 0 ||
  numericField(entrySurfacesRun?.summary ?? null, "problemCount") > 0 ||
  numericField(rollbackOwnerRun?.summary ?? null, "problemCount") > 0 ||
  (finalGate && externalEvidenceDateConsistency.problemCount > 0) ||
  (finalGate && externalEvidenceOriginConsistency.problemCount > 0) ||
  endpointAuthConsistency.problemCount > 0;
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
  runPlan,
  analyticsRun,
  copyRun,
  recoveryRun,
  realUseRun,
  entrySurfacesRun,
  rollbackOwnerRun,
  enabledFeatures,
  rollbackFeatures,
  externalEvidenceDateConsistency,
  externalEvidenceOriginConsistency,
  endpointAuthConsistency,
);
const evidenceCommands = launchEvidenceCommands();

const summary = {
  readyForLaunch,
  finalGate,
  acceptedPending,
  launchBundleDate: bundleDatePathArg ?? "not provided",
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
  launchRunPlan: {
    provided: runPlan.provided,
    path: runPlan.path,
    readyForLaunchEvidence: runPlan.readyForLaunchEvidence,
    runDate: runPlan.runDate,
    baseUrl: runPlan.baseUrl,
    requestHeaderCount: runPlan.requestHeaderCount,
    commandCount: runPlan.commandCount,
    flowCount: runPlan.flowCount,
    canonicalFlowCoverage: runPlan.canonicalFlowCoverage,
    problemCount: runPlan.problemCount,
    problems: runPlan.problems,
  },
  analyticsEvidence: {
    provided: Boolean(effectiveAnalyticsPathArg),
    path: stringField(analyticsRun?.summary ?? null, "inputPath"),
    generatedAt: stringField(analyticsRun?.summary ?? null, "generatedAt"),
    qaRunUrl: stringField(analyticsRun?.summary ?? null, "qaRunUrl"),
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
  copyEvidence: {
    provided: Boolean(effectiveCopyPathArg),
    path: stringField(copyRun?.summary ?? null, "inputPath"),
    qaRunUrl: stringField(copyRun?.summary ?? null, "qaRunUrl"),
    readyForLaunchEvidence: booleanField(
      copyRun?.summary ?? null,
      "readyForLaunchEvidence",
    ),
    reviewedOn: stringField(copyRun?.summary ?? null, "reviewedOn"),
    requiredFlowCount: numericField(
      copyRun?.summary ?? null,
      "requiredFlowCount",
    ),
    requiredCopyRowCount: numericField(
      copyRun?.summary ?? null,
      "requiredCopyRowCount",
    ),
    problemCount: numericField(copyRun?.summary ?? null, "problemCount"),
    problems: stringArrayField(copyRun?.summary ?? null, "problems"),
  },
  recoveryEvidence: {
    provided: Boolean(effectiveRecoveryPathArg),
    path: stringField(recoveryRun?.summary ?? null, "inputPath"),
    qaRunUrl: stringField(recoveryRun?.summary ?? null, "qaRunUrl"),
    readyForLaunchEvidence: booleanField(
      recoveryRun?.summary ?? null,
      "readyForLaunchEvidence",
    ),
    reviewedOn: stringField(recoveryRun?.summary ?? null, "reviewedOn"),
    requiredFlowCount: numericField(
      recoveryRun?.summary ?? null,
      "requiredFlowCount",
    ),
    requiredRecoveryRowCount: numericField(
      recoveryRun?.summary ?? null,
      "requiredRecoveryRowCount",
    ),
    problemCount: numericField(recoveryRun?.summary ?? null, "problemCount"),
    problems: stringArrayField(recoveryRun?.summary ?? null, "problems"),
  },
  realUseEvidence: {
    provided: Boolean(effectiveRealUsePathArg),
    path: stringField(realUseRun?.summary ?? null, "inputPath"),
    qaRunUrl: stringField(realUseRun?.summary ?? null, "qaRunUrl"),
    readyForLaunchEvidence: booleanField(
      realUseRun?.summary ?? null,
      "readyForLaunchEvidence",
    ),
    reviewedOn: stringField(realUseRun?.summary ?? null, "reviewedOn"),
    requiredFlowCount: numericField(
      realUseRun?.summary ?? null,
      "requiredFlowCount",
    ),
    requiredDeviceRowCount: numericField(
      realUseRun?.summary ?? null,
      "requiredDeviceRowCount",
    ),
    requiredInteractionRowCount: numericField(
      realUseRun?.summary ?? null,
      "requiredInteractionRowCount",
    ),
    problemCount: numericField(realUseRun?.summary ?? null, "problemCount"),
    problems: stringArrayField(realUseRun?.summary ?? null, "problems"),
  },
  entrySurfaceEvidence: {
    provided: Boolean(effectiveEntrySurfacesPathArg),
    path: stringField(entrySurfacesRun?.summary ?? null, "inputPath"),
    qaRunUrl: stringField(entrySurfacesRun?.summary ?? null, "qaRunUrl"),
    readyForLaunchEvidence: booleanField(
      entrySurfacesRun?.summary ?? null,
      "readyForLaunchEvidence",
    ),
    reviewedOn: stringField(entrySurfacesRun?.summary ?? null, "reviewedOn"),
    requiredFlowCount: numericField(
      entrySurfacesRun?.summary ?? null,
      "requiredFlowCount",
    ),
    requiredSurfaceCount: numericField(
      entrySurfacesRun?.summary ?? null,
      "requiredSurfaceCount",
    ),
    problemCount: numericField(
      entrySurfacesRun?.summary ?? null,
      "problemCount",
    ),
    problems: stringArrayField(entrySurfacesRun?.summary ?? null, "problems"),
  },
  rollbackOwnerEvidence: {
    provided: Boolean(effectiveRollbackOwnerPathArg),
    path: stringField(rollbackOwnerRun?.summary ?? null, "inputPath"),
    qaRunUrl: stringField(rollbackOwnerRun?.summary ?? null, "qaRunUrl"),
    readyForLaunchEvidence: booleanField(
      rollbackOwnerRun?.summary ?? null,
      "readyForLaunchEvidence",
    ),
    reviewedOn: stringField(rollbackOwnerRun?.summary ?? null, "reviewedOn"),
    requiredFlowCount: numericField(
      rollbackOwnerRun?.summary ?? null,
      "requiredFlowCount",
    ),
    problemCount: numericField(rollbackOwnerRun?.summary ?? null, "problemCount"),
    problems: stringArrayField(rollbackOwnerRun?.summary ?? null, "problems"),
  },
  featureEndpointEvidence: {
    enabled: {
      provided: enabledFeatures.provided,
      path: enabledFeatures.path,
      readyForLaunchEvidence: enabledFeatures.readyForLaunchEvidence,
      baseUrl: enabledFeatures.baseUrl,
      generatedAt: enabledFeatures.generatedAt,
      authenticatedRequest: enabledFeatures.authenticatedRequest,
      requestHeaderCount: enabledFeatures.requestHeaderCount,
      endpointCount: enabledFeatures.endpointCount,
      problemCount: enabledFeatures.problemCount,
      problems: enabledFeatures.problems,
    },
    rollback: {
      provided: rollbackFeatures.provided,
      path: rollbackFeatures.path,
      readyForLaunchEvidence: rollbackFeatures.readyForLaunchEvidence,
      baseUrl: rollbackFeatures.baseUrl,
      generatedAt: rollbackFeatures.generatedAt,
      authenticatedRequest: rollbackFeatures.authenticatedRequest,
      requestHeaderCount: rollbackFeatures.requestHeaderCount,
      endpointCount: rollbackFeatures.endpointCount,
      problemCount: rollbackFeatures.problemCount,
      problems: rollbackFeatures.problems,
    },
  },
  externalEvidenceDateConsistency,
  externalEvidenceOriginConsistency,
  endpointAuthConsistency,
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
console.log(`Launch bundle date: ${summary.launchBundleDate}`);
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
  `Launch run plan: ${summary.launchRunPlan.provided ? (summary.launchRunPlan.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; date ${summary.launchRunPlan.runDate}; request headers ${summary.launchRunPlan.requestHeaderCount}; commands ${summary.launchRunPlan.commandCount}; problems ${summary.launchRunPlan.problemCount}`,
);
console.log(
  `Analytics evidence: ${summary.analyticsEvidence.provided ? (summary.analyticsEvidence.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; samples ${summary.analyticsEvidence.sampleCount}; problems ${summary.analyticsEvidence.problemCount}`,
);
console.log(
  `Copy clarity evidence: ${summary.copyEvidence.provided ? (summary.copyEvidence.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; reviewed ${summary.copyEvidence.reviewedOn}; copy rows ${summary.copyEvidence.requiredCopyRowCount}; problems ${summary.copyEvidence.problemCount}`,
);
console.log(
  `Recovery behavior evidence: ${summary.recoveryEvidence.provided ? (summary.recoveryEvidence.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; reviewed ${summary.recoveryEvidence.reviewedOn}; recovery rows ${summary.recoveryEvidence.requiredRecoveryRowCount}; problems ${summary.recoveryEvidence.problemCount}`,
);
console.log(
  `Real-use evidence: ${summary.realUseEvidence.provided ? (summary.realUseEvidence.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; reviewed ${summary.realUseEvidence.reviewedOn}; device rows ${summary.realUseEvidence.requiredDeviceRowCount}; interaction rows ${summary.realUseEvidence.requiredInteractionRowCount}; problems ${summary.realUseEvidence.problemCount}`,
);
console.log(
  `Entry surface evidence: ${summary.entrySurfaceEvidence.provided ? (summary.entrySurfaceEvidence.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; reviewed ${summary.entrySurfaceEvidence.reviewedOn}; surfaces ${summary.entrySurfaceEvidence.requiredSurfaceCount}; problems ${summary.entrySurfaceEvidence.problemCount}`,
);
console.log(
  `Rollback owner evidence: ${summary.rollbackOwnerEvidence.provided ? (summary.rollbackOwnerEvidence.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; reviewed ${summary.rollbackOwnerEvidence.reviewedOn}; problems ${summary.rollbackOwnerEvidence.problemCount}`,
);
console.log(
  `Feature endpoints enabled: ${summary.featureEndpointEvidence.enabled.provided ? (summary.featureEndpointEvidence.enabled.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; endpoints ${summary.featureEndpointEvidence.enabled.endpointCount}; problems ${summary.featureEndpointEvidence.enabled.problemCount}`,
);
console.log(
  `Feature endpoints rollback: ${summary.featureEndpointEvidence.rollback.provided ? (summary.featureEndpointEvidence.rollback.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; endpoints ${summary.featureEndpointEvidence.rollback.endpointCount}; problems ${summary.featureEndpointEvidence.rollback.problemCount}`,
);
console.log(
  `External evidence run date: ${summary.externalEvidenceDateConsistency.checked ? summary.externalEvidenceDateConsistency.runDate : "not checked"}; problems ${summary.externalEvidenceDateConsistency.problemCount}`,
);
console.log(
  `External evidence origin: ${summary.externalEvidenceOriginConsistency.checked ? summary.externalEvidenceOriginConsistency.origin : "not checked"}; problems ${summary.externalEvidenceOriginConsistency.problemCount}`,
);
console.log(
  `Endpoint auth metadata: ${summary.endpointAuthConsistency.checked ? "checked" : "not checked"}; request headers ${summary.endpointAuthConsistency.requestHeaderCount}; problems ${summary.endpointAuthConsistency.problemCount}`,
);
printProblemDetails("Run sheet", summary.runSheet.problems);
printProblemDetails("QA matrix", summary.matrix.problems);
printProblemDetails("Evidence packet", summary.evidencePacket.problems);
printProblemDetails("Launch run plan", summary.launchRunPlan.problems);
printProblemDetails("Analytics evidence", summary.analyticsEvidence.problems);
printProblemDetails("Copy clarity evidence", summary.copyEvidence.problems);
printProblemDetails("Recovery behavior evidence", summary.recoveryEvidence.problems);
printProblemDetails("Real-use evidence", summary.realUseEvidence.problems);
printProblemDetails("Entry surface evidence", summary.entrySurfaceEvidence.problems);
printProblemDetails("Rollback owner evidence", summary.rollbackOwnerEvidence.problems);
printProblemDetails(
  "External evidence run date",
  summary.externalEvidenceDateConsistency.problems,
);
printProblemDetails(
  "External evidence origin",
  summary.externalEvidenceOriginConsistency.problems,
);
printProblemDetails(
  "Endpoint auth metadata",
  summary.endpointAuthConsistency.problems,
);
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
