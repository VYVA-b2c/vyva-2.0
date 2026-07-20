import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const artifactDatePlaceholder = "YYYY-MM-DD";
const artifactPathPlaceholder = `artifacts/voice-canvas/${artifactDatePlaceholder}-recovery-behavior.md`;
const maxLaunchEvidenceAgeMs = 7 * 24 * 60 * 60 * 1000;

interface RecoveryEvidenceSummary {
  inputPath: string;
  readyForLaunchEvidence: boolean;
  reviewedOn: string;
  qaRunUrl: string;
  requiredFlowCount: number;
  requiredRecoveryRowCount: number;
  problemCount: number;
  problems: string[];
}

interface RecoveryEvidenceRow {
  flowLabel: string;
  startResume: string;
  appExitReopen: string;
  refreshReconnect: string;
  voiceInterruption: string;
  browserBack: string;
  cancelExit: string;
  retryFailure: string;
  duplicateStale: string;
  evidence: string;
  reviewerDate: string;
}

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Prepare a copy-safe Voice Canvas recovery behavior evidence artifact template.",
      "",
      "Usage:",
      "  npm run --silent canvas:qa:recovery -- --template",
      `  npm run --silent canvas:qa:recovery -- --template --output=${artifactPathPlaceholder}`,
      `  npm run canvas:qa:recovery -- --input=${artifactPathPlaceholder}`,
      `  npm run --silent canvas:qa:recovery -- --input=${artifactPathPlaceholder} --json --output=artifacts/voice-canvas/${artifactDatePlaceholder}-recovery-behavior-validation.json`,
      "",
      "Use --template to print the per-flow recovery behavior evidence shape.",
      "Use --input=<path> to validate a filled recovery behavior evidence artifact.",
      "The template is intentionally not launch approval until every launch flow has start/resume, app exit/reopen, refresh/reconnect, voice interruption, browser back, cancel/exit, retry/failure, duplicate prevention, and stale-response evidence from the deployed QA run.",
      "Each row must include entered-information preservation where relevant, no write, no resubmission, no external action, and dated sanitized screenshot, log, capture, recording, or artifact proof.",
      "Do not add addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
      "Validation requires a deployed HTTPS non-local QA run URL, a non-future reviewed date generated within the last 7 days, no remaining placeholders, every launch flow, affirmative recovery wording, duplicate prevention plus stale-response ignoring, concrete sanitized artifact references, and no failed/unavailable evidence.",
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
  console.error("Expected --template or --input=<recovery behavior evidence artifact path>.");
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

function recoveryEvidenceTemplate(): string {
  const lines = [
    "# Voice Canvas recovery behavior evidence artifact",
    "",
    "Use this copy-safe artifact to prove every Canvas launch flow can be left, resumed, interrupted, retried, cancelled, and protected from duplicate or stale responses without side effects.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: [${artifactDatePlaceholder}]`,
    "Reviewer: [reviewer]",
    "QA run URL: [deployed HTTPS staging or production-like URL]",
    "Commit/build: [commit SHA or deployed build]",
    "Privacy boundary: [sanitized artifact references only; no personal details]",
    "",
    "## Recovery behavior checklist",
    "",
    "| Flow | Start/resume | App exit/reopen | Refresh/reconnect | Voice interruption | Browser back | Cancel/exit | Retry/failure | Duplicate/stale | Evidence reference | Reviewer/date |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const flow of canvasLaunchReadinessFlows) {
    lines.push(
      `| ${flow.label} | [start and resume restored current work with entered information preserved, no write, no resubmission, and no external action] | [app exit and reopen restored draft with entered information preserved, no write, no resubmission, and no external action] | [refresh and reconnect restored work with entered information preserved, no write, no resubmission, and no external action] | [voice interruption recovered current work with entered information preserved, no write, no resubmission, and no external action] | [browser back returned safely or preserved entered information with no write and no external action] | [cancel and exit left safely with no write and no external action] | [recoverable failure offered retry and exit or cancel with entered information preserved, no write, no resubmission, and no external action] | [duplicate confirmation or action prevented and stale response ignored or discarded] | [sanitized dated recovery screenshot/log/recording/capture/artifact reference] | [reviewed by reviewer on ${artifactDatePlaceholder}] |`,
    );
  }

  lines.push(
    "",
    "## Copy-ready evidence packet note",
    "",
    `Recovery behavior reviewed on [${artifactDatePlaceholder}] by [reviewer]: every launch flow restored start/resume, app exit/reopen, refresh/reconnect, voice interruption, browser back, cancel/exit, retry/failure, duplicate prevention, and stale-response handling with entered information preserved where relevant, no write, no resubmission, no external action, and sanitized dated recovery screenshots/logs/recordings/captures/artifacts only.`,
  );

  return lines.join("\n");
}

function parseReviewedDate(content: string): Date | null {
  const match = content.match(/\bReviewed on:\s*(\d{4}-\d{2}-\d{2})\b/i);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseReviewerDate(value: string): Date | null {
  const match = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validFreshDate(date: Date | null): boolean {
  return Boolean(
    date &&
      date.getTime() <= Date.now() &&
      Date.now() - date.getTime() <= maxLaunchEvidenceAgeMs,
  );
}

function includesAny(content: string, words: readonly string[]): boolean {
  const lowerContent = content.toLowerCase();
  return words.some((word) => lowerContent.includes(word.toLowerCase()));
}

function hasAllWordGroups(
  content: string,
  wordGroups: readonly (readonly string[])[],
): boolean {
  return wordGroups.every((words) => includesAny(content, words));
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
    if (url.protocol !== "https:") return false;
    if (url.username || url.password || url.search || url.hash) return false;
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

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function tableSectionContent(content: string, section: string): string {
  const start = content.indexOf(`## ${section}`);
  if (start === -1) return "";
  const afterStart = content.slice(start + `## ${section}`.length);
  const nextSection = afterStart.search(/\n##\s+/);
  return nextSection === -1 ? afterStart : afterStart.slice(0, nextSection);
}

function parseRecoveryRows(content: string): RecoveryEvidenceRow[] {
  return tableSectionContent(content, "Recovery behavior checklist")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .map(splitMarkdownRow)
    .filter((cells) => cells.length >= 11 && cells[0] !== "Flow" && cells[0] !== "---")
    .map((cells) => ({
      flowLabel: cells[0],
      startResume: cells[1] ?? "",
      appExitReopen: cells[2] ?? "",
      refreshReconnect: cells[3] ?? "",
      voiceInterruption: cells[4] ?? "",
      browserBack: cells[5] ?? "",
      cancelExit: cells[6] ?? "",
      retryFailure: cells[7] ?? "",
      duplicateStale: cells[8] ?? "",
      evidence: cells[9] ?? "",
      reviewerDate: cells[10] ?? "",
    }));
}

const unsafeFilledArtifactPatterns: readonly RegExp[] = [
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]*){10,}\b/,
  /\b(?:patient id|profile id|account id|user id)\b\s*[:#-]?\s*[A-Za-z0-9_-]{3,}\b/i,
  /\b(?:pickup address|destination address|saved-place label|spoken transcript|typed free text|medication name|provider name|shopping item|account id)\s*[:=-]\s*\S+/i,
];

const rejectedRecoveryPatterns: readonly RegExp[] = [
  /\b(?:not tested|unavailable|failed|unable to test|broken|crashed|blank screen|white screen|not restored|not preserved|did not restore|did not preserve|duplicate accepted|stale accepted)\b/i,
];

function hasNoSideEffectProof(value: string, requireNoResubmission = true): boolean {
  const base =
    includesAny(value, ["no write", "without write", "no-write"]) &&
    includesAny(value, [
      "no external action",
      "without external action",
      "no-external-action",
    ]);
  return requireNoResubmission
    ? base && includesAny(value, ["no resubmission", "without resubmission", "no-resubmission"])
    : base;
}

function artifactReferenceLooksConcrete(value: string): boolean {
  return (
    /\b\d{4}-\d{2}-\d{2}\b/.test(value) &&
    hasAllWordGroups(value, [
      ["recovery", "behavior", "resume", "reconnect"],
      ["screenshot", "log", "recording", "capture", "artifact"],
    ])
  );
}

function validateRecoveryEvidence(inputPathArg: string): RecoveryEvidenceSummary {
  const inputPath = path.resolve(process.cwd(), inputPathArg);
  const relativeInputPath = path.relative(process.cwd(), inputPath);
  const problems: string[] = [];
  let content = "";

  try {
    content = readFileSync(inputPath, "utf8");
  } catch {
    problems.push("Recovery behavior evidence artifact could not be read.");
  }

  if (!content.includes("# Voice Canvas recovery behavior evidence artifact")) {
    problems.push("Recovery behavior evidence artifact must use the expected template heading.");
  }

  if (/\[[^\]]+\]/.test(content)) {
    problems.push("Recovery behavior evidence artifact still contains placeholder text.");
  }

  const reviewedDate = parseReviewedDate(content);
  if (!reviewedDate) {
    problems.push("Recovery behavior evidence artifact must include Reviewed on: YYYY-MM-DD.");
  } else if (reviewedDate.getTime() > Date.now()) {
    problems.push("Recovery behavior evidence reviewed date must not be in the future.");
  } else if (Date.now() - reviewedDate.getTime() > maxLaunchEvidenceAgeMs) {
    problems.push("Recovery behavior evidence reviewed date must be no older than 7 days.");
  }

  for (const requiredLine of [
    "Reviewer",
    "QA run URL",
    "Commit/build",
    "Privacy boundary",
  ]) {
    if (!lineHasFilledValue(content, requiredLine)) {
      problems.push(`Recovery behavior evidence artifact must fill ${requiredLine}.`);
    }
  }
  if (!isDeployedQaRunUrl(lineValue(content, "QA run URL"))) {
    problems.push("Recovery behavior evidence QA run URL must be a deployed HTTPS non-local URL.");
  }

  for (const pattern of unsafeFilledArtifactPatterns) {
    if (pattern.test(content)) {
      problems.push("Recovery behavior evidence artifact appears to include personal details.");
      break;
    }
  }

  for (const pattern of rejectedRecoveryPatterns) {
    if (pattern.test(content)) {
      problems.push("Recovery behavior evidence artifact must use affirmative successful recovery evidence, not failed, unavailable, or accepted duplicate/stale evidence.");
      break;
    }
  }

  const rows = parseRecoveryRows(content);

  for (const flow of canvasLaunchReadinessFlows) {
    const row = rows.find((candidate) => candidate.flowLabel === flow.label);
    if (!row) {
      problems.push(`${flow.label}: missing recovery behavior row.`);
      continue;
    }

    for (const [label, value, wordGroups, requireNoResubmission] of [
      ["start/resume", row.startResume, [["start"], ["resume"], ["restored"], ["entered information", "information preserved", "preserved"]], true],
      ["app exit/reopen", row.appExitReopen, [["app exit", "exit"], ["reopen"], ["restored"], ["entered information", "information preserved", "preserved"]], true],
      ["refresh/reconnect", row.refreshReconnect, [["refresh"], ["reconnect"], ["restored"], ["entered information", "information preserved", "preserved"]], true],
      ["voice interruption", row.voiceInterruption, [["voice"], ["interruption", "interrupted"], ["recovered", "restored"], ["entered information", "information preserved", "preserved"]], true],
      ["browser back", row.browserBack, [["browser back", "back"], ["returned safely", "preserved"], ["entered information", "information preserved", "preserved"]], false],
      ["cancel/exit", row.cancelExit, [["cancel"], ["exit"], ["left safely", "safe exit", "safely"]], false],
      ["retry/failure", row.retryFailure, [["recoverable failure", "failure"], ["retry"], ["exit", "cancel"], ["entered information", "information preserved", "preserved"]], true],
    ] as const) {
      if (!hasAllWordGroups(value, wordGroups)) {
        problems.push(`${flow.label}: ${label} cell must name the required recovery behavior and preservation proof.`);
      }
      if (!hasNoSideEffectProof(value, requireNoResubmission)) {
        problems.push(`${flow.label}: ${label} cell must prove no write, no external action, and no resubmission where required.`);
      }
    }

    if (
      !hasAllWordGroups(row.duplicateStale, [
        ["duplicate"],
        ["prevented", "blocked", "ignored", "rejected", "discarded"],
        ["stale"],
        ["ignored", "rejected", "discarded", "not accepted"],
      ])
    ) {
      problems.push(`${flow.label}: duplicate/stale cell must prove duplicate prevention and stale-response ignoring or discarding.`);
    }

    if (!artifactReferenceLooksConcrete(row.evidence)) {
      problems.push(`${flow.label}: recovery evidence must include dated sanitized recovery screenshot/log/recording/capture/artifact references.`);
    }

    if (!validFreshDate(parseReviewerDate(row.reviewerDate))) {
      problems.push(`${flow.label}: recovery reviewer/date must include a non-future YYYY-MM-DD date no older than 7 days.`);
    }
    if (!includesAny(row.reviewerDate, ["reviewed", "verified", "validated", "approved", "sign-off"])) {
      problems.push(`${flow.label}: recovery reviewer/date must include explicit review wording.`);
    }
  }

  return {
    inputPath: relativeInputPath,
    readyForLaunchEvidence: problems.length === 0,
    reviewedOn: reviewedDate ? reviewedDate.toISOString().slice(0, 10) : "unknown",
    qaRunUrl: lineValue(content, "QA run URL") ?? "unknown",
    requiredFlowCount: canvasLaunchReadinessFlows.length,
    requiredRecoveryRowCount: canvasLaunchReadinessFlows.length,
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
  const summary = validateRecoveryEvidence(inputPathArg);
  const exitCode = summary.readyForLaunchEvidence ? 0 : 1;

  if (jsonOutput) {
    const jsonSummary = `${JSON.stringify(summary, null, 2)}\n`;
    if (outputPathArg) {
      writeOutputFile(outputPathArg, jsonSummary);
    }
    console.log(jsonSummary);
    process.exit(exitCode);
  }

  console.log("Voice Canvas recovery behavior evidence validation");
  console.log(`Ready for launch evidence: ${summary.readyForLaunchEvidence ? "yes" : "no"}`);
  console.log(`Reviewed on: ${summary.reviewedOn}`);
  console.log(`Required flows: ${summary.requiredFlowCount}`);
  console.log(`Required recovery rows: ${summary.requiredRecoveryRowCount}`);
  console.log(`Problems: ${summary.problemCount}`);
  for (const problem of summary.problems) {
    console.log(`- ${problem}`);
  }
  console.log(
    summary.readyForLaunchEvidence
      ? "Recovery behavior evidence artifact is ready."
      : "Recovery behavior evidence artifact is not ready.",
  );
  process.exit(exitCode);
}

const output = `${recoveryEvidenceTemplate()}\n`;

if (outputPathArg) {
  const relativeOutputPath = writeOutputFile(outputPathArg, output);
  console.log(`Saved recovery behavior evidence template to ${relativeOutputPath}`);
  process.exit(0);
}

console.log(output);
