import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const forceOutput = args.includes("--force");
const allowLocal = args.includes("--allow-local");
const dateArg = args.find((arg) => arg.startsWith("--date="))?.slice("--date=".length);
const baseUrlArg =
  args.find((arg) => arg.startsWith("--base-url="))?.slice("--base-url=".length) ??
  "https://staging.vyva.app";
const outputArg = args.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);

const oneDayMs = 24 * 60 * 60 * 1000;
const maxLaunchEvidenceAgeMs = 7 * oneDayMs;

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Prepare a copy-safe Voice Canvas launch evidence run plan.",
      "",
      "Usage:",
      "  npm run canvas:qa:run",
      "  npm run canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app",
      "  npm run --silent canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json",
      "",
      "The run plan performs no network calls and writes only when --output is provided.",
      "Use one run date for endpoint, analytics, rollback-owner, run-sheet, QA-matrix, packet, and final preflight artifacts.",
      "Do not paste addresses, saved-place labels, transcripts, typed text, medication details, provider details, shopping details, account identifiers, raw endpoint bodies, or personal data into any artifact.",
      "Launch evidence should use a deployed HTTPS staging or production-like origin; local origins require --allow-local for developer smoke planning only.",
    ].join("\n"),
  );
  process.exit(0);
}

function todayRunDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseRunDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
}

function validateRunDate(value: string): string[] {
  const parsed = parseRunDate(value);
  if (!parsed) {
    return ["Expected --date to use YYYY-MM-DD."];
  }

  const today = parseRunDate(todayRunDate());
  if (!today) return ["Unable to determine today's launch evidence date."];
  if (parsed.getTime() > today.getTime()) {
    return ["Launch evidence run date cannot be in the future."];
  }
  if (today.getTime() - parsed.getTime() > maxLaunchEvidenceAgeMs) {
    return ["Launch evidence run date must be no older than 7 days."];
  }
  return [];
}

function validateBaseUrl(value: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return ["Expected --base-url to be a valid URL."];
  }

  const host = parsed.hostname.toLowerCase();
  const localHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".test") ||
    host.endsWith(".example") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  const problems: string[] = [];
  if (parsed.protocol !== "https:" && !allowLocal) {
    problems.push("Launch evidence base URL must use HTTPS unless --allow-local is set.");
  }
  if (localHost && !allowLocal) {
    problems.push(
      "Launch evidence base URL must be a deployed non-local origin unless --allow-local is set.",
    );
  }
  return problems;
}

function artifactPaths(runDate: string) {
  const prefix = `artifacts/voice-canvas/${runDate}`;
  return {
    enabledEndpoints: `${prefix}-feature-endpoints-enabled.json`,
    rollbackEndpoints: `${prefix}-feature-endpoints-rollback-disabled.json`,
    analyticsEvidence: `${prefix}-analytics-evidence.json`,
    analyticsValidation: `${prefix}-analytics-validation.json`,
    rollbackOwnerHandoff: `${prefix}-rollback-owner-handoff.md`,
    rollbackOwnerValidation: `${prefix}-rollback-owner-validation.json`,
    runSheetSummary: `${prefix}-run-sheet-summary.json`,
    qaMatrixSummary: `${prefix}-qa-summary.json`,
    evidencePacketSummary: `${prefix}-evidence-packet-summary.json`,
    launchPreflight: `${prefix}-launch-preflight.json`,
    launchRunPlan: `${prefix}-launch-evidence-run.json`,
  };
}

function launchCommands(runDate: string, baseUrl: string) {
  const paths = artifactPaths(runDate);
  return [
    `npm run --silent canvas:qa:run -- --date=${runDate} --base-url=${baseUrl} --json --output=${paths.launchRunPlan}`,
    `npm run --silent canvas:qa:features -- --base-url=${baseUrl} --expected-state=enabled --json --output=${paths.enabledEndpoints}`,
    `npm run --silent canvas:qa:features -- --base-url=${baseUrl} --expected-state=rollback-disabled --json --output=${paths.rollbackEndpoints}`,
    "npm run --silent canvas:qa:features -- --trace-template",
    "npm run --silent canvas:qa:analytics -- --template",
    `npm run --silent canvas:qa:analytics -- --input=${paths.analyticsEvidence} --json --output=${paths.analyticsValidation}`,
    `npm run --silent canvas:qa:rollback-owner -- --template --output=${paths.rollbackOwnerHandoff}`,
    `npm run --silent canvas:qa:rollback-owner -- --input=${paths.rollbackOwnerHandoff} --json --output=${paths.rollbackOwnerValidation}`,
    `npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=${paths.runSheetSummary}`,
    `npm run --silent canvas:qa:validate -- --allow-pending --json --output=${paths.qaMatrixSummary}`,
    `npm run --silent canvas:qa:packet -- --allow-pending --json --output=${paths.evidencePacketSummary}`,
    `npm run --silent canvas:qa:preflight -- --final --run-plan=${paths.launchRunPlan} --features-enabled=${paths.enabledEndpoints} --features-rollback=${paths.rollbackEndpoints} --analytics=${paths.analyticsEvidence} --rollback-owner=${paths.rollbackOwnerHandoff} --json --output=${paths.launchPreflight}`,
  ];
}

const runDate = dateArg ?? todayRunDate();
const problems = [...validateRunDate(runDate), ...validateBaseUrl(baseUrlArg)];

if (outputArg && !jsonOutput) {
  problems.push("Use --output only with --json so saved run plans stay machine-readable.");
}

if (problems.length > 0) {
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          readyForEvidenceRun: false,
          runDate,
          baseUrl: baseUrlArg,
          problemCount: problems.length,
          problems,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("Voice Canvas launch evidence run plan is not ready.");
    console.log("Problems:");
    for (const problem of problems) {
      console.log(`- ${problem}`);
    }
  }
  process.exit(1);
}

const paths = artifactPaths(runDate);
const commands = launchCommands(runDate, baseUrlArg);
const flowCoverage = canvasLaunchReadinessFlows.map((flow) => ({
  id: flow.id,
  label: flow.label,
  fallback: flow.featureFlag?.fallback ?? "destination flow fallback",
}));
const checklist = [
  "Collect enabled endpoint evidence before rollback evidence.",
  "Fill analytics evidence from aggregate-only staging or production-like telemetry.",
  "Fill rollback owner handoff with owner, backup, decision window, trigger, action, fallback, privacy, and no-side-effect proof.",
  "Execute the run sheet across real phone, tablet, and desktop/laptop sessions.",
  "Copy only sanitized artifact references into the evidence packet and QA matrix.",
  "Run final preflight with the same run-date artifact paths.",
];
const privacyBoundary = [
  "No addresses, saved-place labels, transcripts, typed text, medication details, provider details, shopping details, contact details, account identifiers, raw endpoint bodies, or personal data.",
  "Use aggregate counts, allowed Canvas telemetry envelope fields, sanitized screenshots/photos/logs, and dated artifact references only.",
];
const summary = {
  readyForEvidenceRun: true,
  runDate,
  baseUrl: baseUrlArg,
  artifactDirectory: `artifacts/voice-canvas`,
  artifactPaths: paths,
  commands,
  flowCoverage,
  checklist,
  privacyBoundary,
  sameRunDateRequired: true,
  message:
    "Voice Canvas launch evidence run plan is ready. Use these same-date paths for final evidence collection.",
};
const jsonSummary = JSON.stringify(summary, null, 2);

if (outputArg) {
  const outputPath = path.resolve(process.cwd(), outputArg);
  if (existsSync(outputPath) && !forceOutput) {
    console.error(
      `Output file already exists. Use a run-specific path or pass --force to overwrite: ${path.relative(process.cwd(), outputPath)}`,
    );
    process.exit(1);
  }
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${jsonSummary}\n`);
}

if (jsonOutput) {
  console.log(jsonSummary);
  process.exit(0);
}

console.log("Voice Canvas launch evidence run plan");
console.log(`Run date: ${summary.runDate}`);
console.log(`Base URL: ${summary.baseUrl}`);
console.log(`Artifact directory: ${summary.artifactDirectory}`);
console.log("Copy-ready commands:");
for (const command of summary.commands) {
  console.log(`- ${command}`);
}
console.log("Checklist:");
for (const item of summary.checklist) {
  console.log(`- ${item}`);
}
console.log("Privacy boundary:");
for (const item of summary.privacyBoundary) {
  console.log(`- ${item}`);
}
console.log(summary.message);
