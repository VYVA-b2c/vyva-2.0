import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const artifactDatePlaceholder = "YYYY-MM-DD";
const artifactPathPlaceholder = `artifacts/voice-canvas/${artifactDatePlaceholder}-rollback-owner-handoff.md`;
const maxLaunchEvidenceAgeMs = 7 * 24 * 60 * 60 * 1000;

interface RollbackOwnerHandoffSummary {
  inputPath: string;
  readyForLaunchEvidence: boolean;
  reviewedOn: string;
  qaRunUrl: string;
  requiredFlowCount: number;
  problemCount: number;
  problems: string[];
}

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Prepare a copy-safe Voice Canvas rollback owner handoff artifact template.",
      "",
      "Usage:",
      "  npm run --silent canvas:qa:rollback-owner -- --template",
      `  npm run --silent canvas:qa:rollback-owner -- --template --output=${artifactPathPlaceholder}`,
      `  npm run canvas:qa:rollback-owner -- --input=${artifactPathPlaceholder}`,
      `  npm run --silent canvas:qa:rollback-owner -- --input=${artifactPathPlaceholder} --json --output=artifacts/voice-canvas/${artifactDatePlaceholder}-rollback-owner-validation.json`,
      "",
      "Use --template to print the handoff artifact shape for Operations/rollback owner sign-off.",
      "Use --input=<path> to validate a filled rollback owner handoff artifact.",
      "The template is intentionally not launch approval until a deployed non-local QA run URL, real rollback owner, backup owner, decision window, rollback trigger, rollback action, endpoint/fallback/open-session evidence, privacy boundary, and fallback readiness are filled from the launch run.",
      "The generated template includes only feature names, endpoints, server keys, and named fallback paths from the launch manifest.",
      "Do not add addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, or personal data.",
      "Validation requires a deployed non-local QA run URL, a non-future reviewed date generated within the last 7 days, no remaining placeholders, all launch feature endpoints/server keys/fallbacks, and concrete endpoint/fallback/open-session/no-side-effect proof wording.",
      "Use --output=<path> with --template to save the Markdown artifact, or with --json to save the validation summary.",
      "Existing output files are preserved by default; pass --force only when intentionally replacing one.",
      "This helper never calls feature endpoints, analytics, bookings, calls, messages, navigation, or application data writes.",
    ].join("\n"),
  );
  process.exit(0);
}

const templateOutput = args.includes("--template");
const jsonOutput = args.includes("--json");
const forceOutput = args.includes("--force");
const inputPathArg = readArgValue("--input") ?? args.find((arg) => !arg.startsWith("-"));
const outputPathArg = readArgValue("--output");

if (!templateOutput && !inputPathArg) {
  console.error("Expected --template or --input=<rollback owner handoff artifact path>.");
  process.exit(1);
}

if (templateOutput && inputPathArg) {
  console.error("Use either --template or --input, not both.");
  process.exit(1);
}

if (outputPathArg === "") {
  console.error("Expected --output=<path>.");
  process.exit(1);
}

if (outputPathArg && !templateOutput && !jsonOutput) {
  console.error("Use --output with validation only when --json is also passed.");
  process.exit(1);
}

function rollbackOwnerHandoffTemplate(): string {
  const lines = [
    "# Voice Canvas rollback owner handoff artifact",
    "",
    "Use this copy-safe artifact for final Operations/rollback owner sign-off. Replace bracketed placeholders only after the deployed launch run is reviewed.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: [${artifactDatePlaceholder}]`,
    "Reviewer: [reviewer]",
    "QA run URL: [deployed non-local QA run URL]",
    "Operations/rollback owner: [owner name or team handle]",
    "Backup owner: [backup owner name or team handle]",
    "Decision window: [start/end time or launch-monitoring window]",
    "Rollback trigger: [clear trigger for disabling Canvas]",
    "Rollback action: [enable false or disabled rollout 0 action]",
    "Privacy boundary: [sanitized artifact references only; no personal details]",
    "Fallback readiness: [existing Concierge fallback verified and ready]",
    "",
    "## Required sanitized evidence",
    "",
    "- Enabled endpoint artifact: [sanitized enabled endpoint artifact reference]",
    "- Rollback-disabled endpoint artifact: [sanitized rollback endpoint artifact reference]",
    "- Fallback visibility artifact: [sanitized fallback screenshot/log/artifact reference]",
    "- Open-session Canvas closed or hidden artifact: [sanitized open-session rollback artifact reference]",
    "- No-write/no-resubmission/no-external-action evidence: [sanitized artifact reference]",
    "",
    "## Launch manifest coverage",
  ];

  for (const flow of canvasLaunchReadinessFlows.filter((candidate) => candidate.featureFlag)) {
    lines.push(
      "",
      `### ${flow.label}`,
      "",
      `- Endpoint: ${flow.featureFlag!.endpoint}`,
      `- Server key: ${flow.featureFlag!.serverFeatureKey}`,
      `- Named fallback path: ${flow.featureFlag!.fallback}`,
      "- Handoff confirmation: [owner and backup can disable this flag, verify rollback-disabled endpoint payload, confirm Canvas closed or hidden in an open session, and confirm the named fallback path is visible]",
    );
  }

  lines.push(
    "",
    "## Copy-ready final sign-off note",
    "",
    `Operations/rollback owner sign-off, reviewed on [${artifactDatePlaceholder}] by [reviewer]: rollback owner [owner] and backup owner [backup] confirmed the decision window [window], rollback trigger [trigger], enable false or disabled rollout 0 rollback action [action], sanitized endpoint/fallback/open-session evidence [references], Canvas closed or hidden behavior, privacy boundary, and fallback readiness before launch.`,
  );

  return lines.join("\n");
}

function parseReviewedDate(content: string): Date | null {
  const match = content.match(/\bReviewed on:\s*(\d{4}-\d{2}-\d{2})\b/i);
  if (!match) return null;

  const parsed = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function includesAny(content: string, words: readonly string[]): boolean {
  const lowerContent = content.toLowerCase();
  return words.some((word) => lowerContent.includes(word.toLowerCase()));
}

function lineHasFilledValue(content: string, label: string): boolean {
  const value = lineValue(content, label);
  return Boolean(value);
}

function lineValue(content: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^${escapedLabel}:\\s*(.+)$`, "im"));
  if (!match) return null;
  const value = match[1].trim();
  return value.length > 0 && !value.includes("[") && !value.includes("]")
    ? value
    : null;
}

function isDeployedQaRunUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".test") ||
      host.endsWith(".example") ||
      host.includes("mock")
    ) {
      return false;
    }
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return false;
    const private172 = host.match(/^172\.(\d{1,2})\./);
    if (private172) {
      const secondOctet = Number(private172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const unsafeFilledArtifactPatterns: readonly RegExp[] = [
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]*){10,}\b/,
  /\b(?:patient id|profile id|account id|user id)\b\s*[:#-]?\s*[A-Za-z0-9_-]{3,}\b/i,
];

function validateRollbackOwnerHandoff(inputPathArg: string): RollbackOwnerHandoffSummary {
  const inputPath = path.resolve(process.cwd(), inputPathArg);
  const relativeInputPath = path.relative(process.cwd(), inputPath);
  const problems: string[] = [];
  let content = "";

  try {
    content = readFileSync(inputPath, "utf8");
  } catch {
    problems.push("Rollback owner handoff artifact could not be read.");
  }

  if (!content.includes("# Voice Canvas rollback owner handoff artifact")) {
    problems.push("Rollback owner handoff artifact must use the expected template heading.");
  }

  if (/\[[^\]]+\]/.test(content)) {
    problems.push("Rollback owner handoff artifact still contains placeholder text.");
  }

  const reviewedDate = parseReviewedDate(content);
  if (!reviewedDate) {
    problems.push("Rollback owner handoff artifact must include Reviewed on: YYYY-MM-DD.");
  } else if (reviewedDate.getTime() > Date.now()) {
    problems.push("Rollback owner handoff reviewed date must not be in the future.");
  } else if (Date.now() - reviewedDate.getTime() > maxLaunchEvidenceAgeMs) {
    problems.push("Rollback owner handoff reviewed date must be no older than 7 days.");
  }

  for (const requiredLine of [
    "Reviewer",
    "QA run URL",
    "Operations/rollback owner",
    "Backup owner",
    "Decision window",
    "Rollback trigger",
    "Rollback action",
    "Privacy boundary",
    "Fallback readiness",
  ]) {
    if (!lineHasFilledValue(content, requiredLine)) {
      problems.push(`Rollback owner handoff artifact must fill ${requiredLine}.`);
    }
  }
  if (!isDeployedQaRunUrl(lineValue(content, "QA run URL"))) {
    problems.push("Rollback owner handoff QA run URL must be a deployed non-local http(s) URL.");
  }

  for (const requiredEvidence of [
    "Enabled endpoint artifact",
    "Rollback-disabled endpoint artifact",
    "Fallback visibility artifact",
    "Open-session Canvas closed or hidden artifact",
    "No-write/no-resubmission/no-external-action evidence",
  ]) {
    if (!lineHasFilledValue(content, `- ${requiredEvidence}`)) {
      problems.push(`Rollback owner handoff artifact must fill ${requiredEvidence}.`);
    }
  }

  for (const flow of canvasLaunchReadinessFlows.filter((candidate) => candidate.featureFlag)) {
    if (!content.includes(`### ${flow.label}`)) {
      problems.push(`Rollback owner handoff artifact is missing ${flow.label}.`);
    }
    if (!content.includes(`- Endpoint: ${flow.featureFlag!.endpoint}`)) {
      problems.push(`Rollback owner handoff artifact is missing ${flow.label} endpoint.`);
    }
    if (!content.includes(`- Server key: ${flow.featureFlag!.serverFeatureKey}`)) {
      problems.push(`Rollback owner handoff artifact is missing ${flow.label} server key.`);
    }
    if (!content.includes(`- Named fallback path: ${flow.featureFlag!.fallback}`)) {
      problems.push(`Rollback owner handoff artifact is missing ${flow.label} fallback path.`);
    }
  }

  for (const requiredGroup of [
    ["owner"],
    ["backup"],
    ["decision window"],
    ["rollback trigger"],
    ["enable false", "disabled rollout 0", "rollout 0"],
    ["endpoint"],
    ["fallback"],
    ["open-session", "open session"],
    ["Canvas closed", "Canvas hidden", "closed or hidden"],
    ["no-write", "no write"],
    ["no-resubmission", "no resubmission"],
    ["no-external-action", "no external action"],
    ["privacy boundary", "no personal details"],
    ["fallback readiness"],
  ]) {
    if (!includesAny(content, requiredGroup)) {
      problems.push(
        `Rollback owner handoff artifact is missing required wording: ${requiredGroup.join(" or ")}.`,
      );
    }
  }

  for (const pattern of unsafeFilledArtifactPatterns) {
    if (pattern.test(content)) {
      problems.push("Rollback owner handoff artifact appears to include personal details.");
      break;
    }
  }

  return {
    inputPath: relativeInputPath,
    readyForLaunchEvidence: problems.length === 0,
    reviewedOn: reviewedDate ? reviewedDate.toISOString().slice(0, 10) : "unknown",
    qaRunUrl: lineValue(content, "QA run URL") ?? "unknown",
    requiredFlowCount: canvasLaunchReadinessFlows.filter((flow) => flow.featureFlag)
      .length,
    problemCount: problems.length,
    problems,
  };
}

function writeOutputFile(outputPathArg: string, output: string): string {
  const outputPath = path.resolve(process.cwd(), outputPathArg);
  if (existsSync(outputPath) && !forceOutput) {
    console.error(
      `Output file already exists. Use a run-specific path or pass --force to overwrite: ${path.relative(process.cwd(), outputPath)}`,
    );
    process.exit(1);
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
  return path.relative(process.cwd(), outputPath);
}

if (inputPathArg) {
  const summary = validateRollbackOwnerHandoff(inputPathArg);
  const exitCode = summary.readyForLaunchEvidence ? 0 : 1;

  if (jsonOutput) {
    const jsonSummary = `${JSON.stringify(summary, null, 2)}\n`;
    if (outputPathArg) {
      writeOutputFile(outputPathArg, jsonSummary);
    }
    console.log(jsonSummary);
    process.exit(exitCode);
  }

  console.log("Voice Canvas rollback owner handoff validation");
  console.log(`Ready for launch evidence: ${summary.readyForLaunchEvidence ? "yes" : "no"}`);
  console.log(`Reviewed on: ${summary.reviewedOn}`);
  console.log(`Required flows: ${summary.requiredFlowCount}`);
  console.log(`Problems: ${summary.problemCount}`);
  for (const problem of summary.problems) {
    console.log(`- ${problem}`);
  }
  console.log(
    summary.readyForLaunchEvidence
      ? "Rollback owner handoff artifact is ready."
      : "Rollback owner handoff artifact is not ready.",
  );
  process.exit(exitCode);
}

const output = `${rollbackOwnerHandoffTemplate()}\n`;

if (outputPathArg) {
  const relativeOutputPath = writeOutputFile(outputPathArg, output);
  console.log(`Saved rollback owner handoff template to ${relativeOutputPath}`);
  process.exit(0);
}

console.log(output);
