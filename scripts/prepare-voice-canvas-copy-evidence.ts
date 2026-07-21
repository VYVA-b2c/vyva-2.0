import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const artifactDatePlaceholder = "YYYY-MM-DD";
const artifactPathPlaceholder = `artifacts/voice-canvas/${artifactDatePlaceholder}-copy-clarity.md`;
const maxLaunchEvidenceAgeMs = 7 * 24 * 60 * 60 * 1000;

interface CopyEvidenceSummary {
  inputPath: string;
  readyForLaunchEvidence: boolean;
  reviewedOn: string;
  qaRunUrl: string;
  requiredFlowCount: number;
  requiredCopyRowCount: number;
  problemCount: number;
  problems: string[];
}

interface CopyEvidenceRow {
  flowLabel: string;
  seniorFriendlyCopy: string;
  nextStepClarity: string;
  longLabels: string;
  accessibility: string;
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
      "Prepare a copy-safe Voice Canvas senior-friendly copy and next-step clarity evidence artifact template.",
      "",
      "Usage:",
      "  npm run --silent canvas:qa:copy -- --template",
      `  npm run --silent canvas:qa:copy -- --template --output=${artifactPathPlaceholder}`,
      `  npm run canvas:qa:copy -- --input=${artifactPathPlaceholder}`,
      `  npm run --silent canvas:qa:copy -- --input=${artifactPathPlaceholder} --json --output=artifacts/voice-canvas/${artifactDatePlaceholder}-copy-clarity-validation.json`,
      "",
      "Use --template to print the per-flow copy clarity evidence shape.",
      "Use --input=<path> to validate a filled copy clarity evidence artifact.",
      "The template is intentionally not launch approval until every launch flow has senior-friendly copy, one-clear-decision proof, what-happens-next clarity, long translated label proof, focus and screen-reader announcement proof, and reduced-motion proof from the deployed QA run.",
      "Each row must include dated sanitized screenshot, capture, review, transcript-free copy artifact, or accessibility artifact proof.",
      "Do not add addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
      "Validation requires a deployed HTTPS non-local QA run URL, a non-future reviewed date generated within the last 7 days, no remaining placeholders, every launch flow, copy that is described as warm/plain/senior-friendly/restrained, clear next-step wording, long-label overflow proof, focus/screen-reader/reduced-motion proof, and concrete sanitized artifact references.",
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
  console.error("Expected --template or --input=<copy clarity evidence artifact path>.");
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

function copyEvidenceTemplate(): string {
  const lines = [
    "# Voice Canvas copy clarity evidence artifact",
    "",
    "Use this copy-safe artifact to prove every Canvas launch flow is senior-friendly, shows one clear decision at a time, explains what happens next, and remains accessible with long translated labels.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: [${artifactDatePlaceholder}]`,
    "Reviewer: [reviewer]",
    "QA run URL: [deployed HTTPS staging or production-like URL]",
    "Commit/build: [commit SHA or deployed build]",
    "Privacy boundary: [sanitized artifact references only; no personal details]",
    "",
    "## Copy clarity checklist",
    "",
    "| Flow | Senior-friendly copy | What happens next | Long translated labels | Accessibility announcements | Evidence reference | Reviewer/date |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const flow of canvasLaunchReadinessFlows) {
    lines.push(
      `| ${flow.label} | [warm plain senior-friendly restrained copy with one clear decision at a time] | [what happens next is clear for primary action, secondary/back/cancel/exit, waiting, blocked, and completed states] | [long translated Spanish labels wrap without overflow, clipping, or hidden decisions on mobile, tablet, and desktop] | [focus moves meaningfully; screen reader announces waiting, blocked, and completed; reduced motion respected] | [sanitized dated copy review screenshot/capture/accessibility artifact reference] | [reviewed by reviewer on ${artifactDatePlaceholder}] |`,
    );
  }

  lines.push(
    "",
    "## Copy-ready evidence packet note",
    "",
    `Copy clarity reviewed on [${artifactDatePlaceholder}] by [reviewer]: every launch flow used warm plain senior-friendly restrained copy, showed one clear decision at a time, explained what happens next for primary, secondary/back/cancel/exit, waiting, blocked, and completed states, handled long translated Spanish labels without overflow, moved focus meaningfully, announced waiting/blocked/completed states to screen readers, respected reduced motion, and used sanitized dated copy/accessibility artifact references only.`,
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

function summaryQaRunUrl(value: string | null): string {
  if (!value) return "unknown";
  if (!isDeployedQaRunUrl(value)) return "invalid";
  return new URL(value).origin;
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

function parseCopyRows(content: string): CopyEvidenceRow[] {
  return tableSectionContent(content, "Copy clarity checklist")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .map(splitMarkdownRow)
    .filter((cells) => cells.length >= 7 && cells[0] !== "Flow" && cells[0] !== "---")
    .map((cells) => ({
      flowLabel: cells[0],
      seniorFriendlyCopy: cells[1] ?? "",
      nextStepClarity: cells[2] ?? "",
      longLabels: cells[3] ?? "",
      accessibility: cells[4] ?? "",
      evidence: cells[5] ?? "",
      reviewerDate: cells[6] ?? "",
    }));
}

const unsafeFilledArtifactPatterns: readonly RegExp[] = [
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]*){10,}\b/,
  /https?:\/\/[^\s/|`]+:[^\s@/|`]+@[^\s|`]+/i,
  /\b(?:token|secret|api[_-]?key|authorization|cookie|password|session)[=:][^\s|`]+/i,
  /\bbearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\bx-api-key\s*[:=]\s*[^\s|`]+/i,
  /\b(?:patient id|profile id|account id|user id)\b\s*[:#-]?\s*[A-Za-z0-9_-]{3,}\b/i,
  /\b(?:pickup address|destination address|saved-place label|spoken transcript|typed free text|medication name|provider name|shopping item|account id)\s*[:=-]\s*\S+/i,
];

function artifactReferenceLooksConcrete(value: string): boolean {
  return (
    /\b\d{4}-\d{2}-\d{2}\b/.test(value) &&
    hasAllWordGroups(value, [
      ["copy", "clarity", "accessibility", "a11y", "long-label"],
      ["screenshot", "capture", "artifact", "review"],
    ])
  );
}

function validateCopyEvidence(inputPathArg: string): CopyEvidenceSummary {
  const inputPath = path.resolve(process.cwd(), inputPathArg);
  const relativeInputPath = path.relative(process.cwd(), inputPath);
  const problems: string[] = [];
  let content = "";

  try {
    content = readFileSync(inputPath, "utf8");
  } catch {
    problems.push("Copy clarity evidence artifact could not be read.");
  }

  if (!content.includes("# Voice Canvas copy clarity evidence artifact")) {
    problems.push("Copy clarity evidence artifact must use the expected template heading.");
  }

  if (/\[[^\]]+\]/.test(content)) {
    problems.push("Copy clarity evidence artifact still contains placeholder text.");
  }

  const reviewedDate = parseReviewedDate(content);
  if (!reviewedDate) {
    problems.push("Copy clarity evidence artifact must include Reviewed on: YYYY-MM-DD.");
  } else if (reviewedDate.getTime() > Date.now()) {
    problems.push("Copy clarity evidence reviewed date must not be in the future.");
  } else if (Date.now() - reviewedDate.getTime() > maxLaunchEvidenceAgeMs) {
    problems.push("Copy clarity evidence reviewed date must be no older than 7 days.");
  }

  for (const requiredLine of [
    "Reviewer",
    "QA run URL",
    "Commit/build",
    "Privacy boundary",
  ]) {
    if (!lineHasFilledValue(content, requiredLine)) {
      problems.push(`Copy clarity evidence artifact must fill ${requiredLine}.`);
    }
  }
  if (!isDeployedQaRunUrl(lineValue(content, "QA run URL"))) {
    problems.push("Copy clarity evidence QA run URL must be a deployed HTTPS non-local URL.");
  }

  for (const pattern of unsafeFilledArtifactPatterns) {
    if (pattern.test(content)) {
      problems.push("Copy clarity evidence artifact appears to include personal details.");
      break;
    }
  }

  const copyRows = parseCopyRows(content);

  for (const flow of canvasLaunchReadinessFlows) {
    const copyRow = copyRows.find((row) => row.flowLabel === flow.label);
    if (!copyRow) {
      problems.push(`${flow.label}: missing copy clarity row.`);
      continue;
    }

    if (
      !hasAllWordGroups(copyRow.seniorFriendlyCopy, [
        ["warm", "reassuring"],
        ["plain", "simple"],
        ["senior-friendly", "senior friendly"],
        ["restrained"],
        ["one clear decision", "one decision"],
      ])
    ) {
      problems.push(`${flow.label}: senior-friendly copy cell must prove warm plain restrained copy with one clear decision.`);
    }

    if (
      !hasAllWordGroups(copyRow.nextStepClarity, [
        ["what happens next", "next step"],
        ["primary"],
        ["secondary", "back", "cancel", "exit"],
        ["waiting"],
        ["blocked"],
        ["completed", "complete"],
      ])
    ) {
      problems.push(`${flow.label}: next-step cell must explain primary, secondary/back/cancel/exit, waiting, blocked, and completed states.`);
    }

    if (
      !hasAllWordGroups(copyRow.longLabels, [
        ["long"],
        ["translated", "Spanish", "labels"],
        ["wrap", "wrapped"],
        ["without overflow", "no overflow"],
        ["mobile"],
        ["tablet"],
        ["desktop"],
      ])
    ) {
      problems.push(`${flow.label}: long translated labels cell must prove wrapping without overflow on mobile, tablet, and desktop.`);
    }

    if (
      !hasAllWordGroups(copyRow.accessibility, [
        ["focus"],
        ["screen reader", "screen-reader"],
        ["announce", "announces", "announcement"],
        ["waiting"],
        ["blocked"],
        ["completed", "complete"],
        ["reduced motion", "reduced-motion"],
      ])
    ) {
      problems.push(`${flow.label}: accessibility cell must prove focus movement, screen-reader announcements for waiting/blocked/completed, and reduced-motion support.`);
    }

    if (!artifactReferenceLooksConcrete(copyRow.evidence)) {
      problems.push(`${flow.label}: copy clarity evidence must include dated sanitized copy/accessibility screenshot/capture/review/artifact references.`);
    }

    if (!validFreshDate(parseReviewerDate(copyRow.reviewerDate))) {
      problems.push(`${flow.label}: copy clarity reviewer/date must include a non-future YYYY-MM-DD date no older than 7 days.`);
    }
    if (!includesAny(copyRow.reviewerDate, ["reviewed", "verified", "validated", "approved", "sign-off"])) {
      problems.push(`${flow.label}: copy clarity reviewer/date must include explicit review wording.`);
    }
  }

  return {
    inputPath: relativeInputPath,
    readyForLaunchEvidence: problems.length === 0,
    reviewedOn: reviewedDate ? reviewedDate.toISOString().slice(0, 10) : "unknown",
    qaRunUrl: summaryQaRunUrl(lineValue(content, "QA run URL")),
    requiredFlowCount: canvasLaunchReadinessFlows.length,
    requiredCopyRowCount: canvasLaunchReadinessFlows.length,
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
  const summary = validateCopyEvidence(inputPathArg);
  const exitCode = summary.readyForLaunchEvidence ? 0 : 1;

  if (jsonOutput) {
    const jsonSummary = `${JSON.stringify(summary, null, 2)}\n`;
    if (outputPathArg) {
      writeOutputFile(outputPathArg, jsonSummary);
    }
    console.log(jsonSummary);
    process.exit(exitCode);
  }

  console.log("Voice Canvas copy clarity evidence validation");
  console.log(`Ready for launch evidence: ${summary.readyForLaunchEvidence ? "yes" : "no"}`);
  console.log(`Reviewed on: ${summary.reviewedOn}`);
  console.log(`Required flows: ${summary.requiredFlowCount}`);
  console.log(`Required copy rows: ${summary.requiredCopyRowCount}`);
  console.log(`Problems: ${summary.problemCount}`);
  for (const problem of summary.problems) {
    console.log(`- ${problem}`);
  }
  console.log(
    summary.readyForLaunchEvidence
      ? "Copy clarity evidence artifact is ready."
      : "Copy clarity evidence artifact is not ready.",
  );
  process.exit(exitCode);
}

const output = `${copyEvidenceTemplate()}\n`;

if (outputPathArg) {
  const relativeOutputPath = writeOutputFile(outputPathArg, output);
  console.log(`Saved copy clarity evidence template to ${relativeOutputPath}`);
  process.exit(0);
}

console.log(output);
