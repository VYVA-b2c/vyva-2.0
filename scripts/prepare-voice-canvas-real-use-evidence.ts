import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const artifactDatePlaceholder = "YYYY-MM-DD";
const artifactPathPlaceholder = `artifacts/voice-canvas/${artifactDatePlaceholder}-real-use-coverage.md`;
const maxLaunchEvidenceAgeMs = 7 * 24 * 60 * 60 * 1000;

interface RealUseEvidenceSummary {
  inputPath: string;
  readyForLaunchEvidence: boolean;
  reviewedOn: string;
  qaRunUrl: string;
  requiredFlowCount: number;
  requiredDeviceRowCount: number;
  requiredInteractionRowCount: number;
  problemCount: number;
  problems: string[];
}

interface DeviceRow {
  flowLabel: string;
  phone: string;
  tablet: string;
  desktop: string;
  evidence: string;
  reviewerDate: string;
}

interface InteractionRow {
  flowLabel: string;
  voice: string;
  touch: string;
  keyboard: string;
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
      "Prepare a copy-safe Voice Canvas real-use device and interaction evidence artifact template.",
      "",
      "Usage:",
      "  npm run --silent canvas:qa:real-use -- --template",
      `  npm run --silent canvas:qa:real-use -- --template --output=${artifactPathPlaceholder}`,
      `  npm run canvas:qa:real-use -- --input=${artifactPathPlaceholder}`,
      `  npm run --silent canvas:qa:real-use -- --input=${artifactPathPlaceholder} --json --output=artifacts/voice-canvas/${artifactDatePlaceholder}-real-use-validation.json`,
      "",
      "Use --template to print the per-flow real device and interaction evidence shape.",
      "Use --input=<path> to validate a filled real-use evidence artifact.",
      "The template is intentionally not launch approval until every launch flow has real physical phone, tablet, desktop/laptop, voice, touch, and keyboard evidence from the deployed QA run.",
      "Each row must include dated sanitized screenshot, photo, recording, log, capture, or artifact proof, completion or safe-exit proof, and no write/no external action before explicit confirmation.",
      "Do not add addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
      "Validation requires a deployed HTTPS non-local QA run URL, a non-future reviewed date generated within the last 7 days, no remaining placeholders, every launch flow, real physical device wording, concrete sanitized artifact references, and no emulator/responsive-mode evidence.",
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
  console.error("Expected --template or --input=<real-use evidence artifact path>.");
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

function realUseEvidenceTemplate(): string {
  const lines = [
    "# Voice Canvas real-use device and interaction evidence artifact",
    "",
    "Use this copy-safe artifact to prove every Canvas launch flow completed or safely exited on real devices and through supported interaction modes.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: [${artifactDatePlaceholder}]`,
    "Reviewer: [reviewer]",
    "QA run URL: [deployed HTTPS staging or production-like URL]",
    "Commit/build: [commit SHA or deployed build]",
    "Privacy boundary: [sanitized artifact references only; no personal details]",
    "",
    "## Real device coverage",
    "",
    "| Flow | Phone/mobile | Tablet | Desktop/laptop | Evidence reference | Reviewer/date |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  for (const flow of canvasLaunchReadinessFlows) {
    lines.push(
      `| ${flow.label} | [real physical phone/mobile completed or safely exited with no write and no external action before explicit confirmation] | [real physical tablet completed or safely exited with no write and no external action before explicit confirmation] | [real desktop/laptop completed or safely exited with no write and no external action before explicit confirmation] | [sanitized dated phone/tablet/desktop screenshot/photo/capture/artifact reference] | [reviewed by reviewer on ${artifactDatePlaceholder}] |`,
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
      `| ${flow.label} | [voice path completed or safely exited with no write and no external action before explicit confirmation] | [touch path completed or safely exited with no write and no external action before explicit confirmation] | [keyboard-only path completed or safely exited with no write and no external action before explicit confirmation] | [sanitized dated voice/touch/keyboard recording/log/screenshot/artifact reference] | [reviewed by reviewer on ${artifactDatePlaceholder}] |`,
    );
  }

  lines.push(
    "",
    "## Copy-ready evidence packet note",
    "",
    `Real-use coverage reviewed on [${artifactDatePlaceholder}] by [reviewer]: every launch flow had real physical phone/mobile, tablet, and desktop/laptop coverage plus voice, touch, and keyboard completion or safe-exit proof, with sanitized dated screenshots/photos/recordings/logs/captures/artifacts, no write, and no external action before explicit confirmation.`,
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

function parseDeviceRows(content: string): DeviceRow[] {
  return tableSectionContent(content, "Real device coverage")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .map(splitMarkdownRow)
    .filter((cells) => cells.length >= 6 && cells[0] !== "Flow" && cells[0] !== "---")
    .map((cells) => ({
      flowLabel: cells[0],
      phone: cells[1] ?? "",
      tablet: cells[2] ?? "",
      desktop: cells[3] ?? "",
      evidence: cells[4] ?? "",
      reviewerDate: cells[5] ?? "",
    }));
}

function parseInteractionRows(content: string): InteractionRow[] {
  return tableSectionContent(content, "Interaction mode coverage")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .map(splitMarkdownRow)
    .filter((cells) => cells.length >= 6 && cells[0] !== "Flow" && cells[0] !== "---")
    .map((cells) => ({
      flowLabel: cells[0],
      voice: cells[1] ?? "",
      touch: cells[2] ?? "",
      keyboard: cells[3] ?? "",
      evidence: cells[4] ?? "",
      reviewerDate: cells[5] ?? "",
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

const rejectedDeviceEvidencePatterns: readonly RegExp[] = [
  /\b(?:emulator|simulator|responsive mode|responsive-mode|devtools|device toolbar|viewport only)\b/i,
  /\b(?:not tested|not real|unavailable|failed|unable to test|broken|crashed|blank screen|white screen|not completed|not complete|incomplete|did not complete|failed to complete|unable to complete|could not complete|not safely exited|not safe exit)\b/i,
  /\b(?:write|data write|booking|call|message|navigation|external action)\s+(?:triggered|occurred|happened|started|sent|placed|submitted|created|booked|navigated)\b/i,
  /\b(?:triggered|sent|placed|submitted|created|booked|navigated)\s+(?:a\s+)?(?:write|data write|booking|call|message|navigation|external action)\b/i,
];

function artifactReferenceLooksConcrete(
  value: string,
  requiredGroups: readonly (readonly string[])[],
): boolean {
  return /\b\d{4}-\d{2}-\d{2}\b/.test(value) && hasAllWordGroups(value, requiredGroups);
}

function hasSafeCompletionWording(value: string): boolean {
  return (
    includesAny(value, ["completed", "safely exited", "safe exit"]) &&
    includesAny(value, ["no write", "without write", "no-write"]) &&
    includesAny(value, [
      "no external action",
      "without external action",
      "no-external-action",
    ]) &&
    includesAny(value, [
      "before explicit confirmation",
      "prior to explicit confirmation",
      "until explicit confirmation",
      "before final confirmation",
      "prior to final confirmation",
      "until final confirmation",
    ])
  );
}

function validateRealUseEvidence(inputPathArg: string): RealUseEvidenceSummary {
  const inputPath = path.resolve(process.cwd(), inputPathArg);
  const relativeInputPath = path.relative(process.cwd(), inputPath);
  const problems: string[] = [];
  let content = "";

  try {
    content = readFileSync(inputPath, "utf8");
  } catch {
    problems.push("Real-use evidence artifact could not be read.");
  }

  if (!content.includes("# Voice Canvas real-use device and interaction evidence artifact")) {
    problems.push("Real-use evidence artifact must use the expected template heading.");
  }

  if (/\[[^\]]+\]/.test(content)) {
    problems.push("Real-use evidence artifact still contains placeholder text.");
  }

  const reviewedDate = parseReviewedDate(content);
  if (!reviewedDate) {
    problems.push("Real-use evidence artifact must include Reviewed on: YYYY-MM-DD.");
  } else if (reviewedDate.getTime() > Date.now()) {
    problems.push("Real-use evidence reviewed date must not be in the future.");
  } else if (Date.now() - reviewedDate.getTime() > maxLaunchEvidenceAgeMs) {
    problems.push("Real-use evidence reviewed date must be no older than 7 days.");
  }

  for (const requiredLine of [
    "Reviewer",
    "QA run URL",
    "Commit/build",
    "Privacy boundary",
  ]) {
    if (!lineHasFilledValue(content, requiredLine)) {
      problems.push(`Real-use evidence artifact must fill ${requiredLine}.`);
    }
  }
  if (!isDeployedQaRunUrl(lineValue(content, "QA run URL"))) {
    problems.push("Real-use evidence QA run URL must be a deployed HTTPS non-local URL.");
  }

  for (const pattern of unsafeFilledArtifactPatterns) {
    if (pattern.test(content)) {
      problems.push("Real-use evidence artifact appears to include personal details.");
      break;
    }
  }

  for (const pattern of rejectedDeviceEvidencePatterns) {
    if (pattern.test(content)) {
      problems.push("Real-use evidence artifact must use real physical devices, not emulator, simulator, responsive-mode, DevTools, unavailable, or failed evidence.");
      break;
    }
  }

  const deviceRows = parseDeviceRows(content);
  const interactionRows = parseInteractionRows(content);

  for (const flow of canvasLaunchReadinessFlows) {
    const deviceRow = deviceRows.find((row) => row.flowLabel === flow.label);
    if (!deviceRow) {
      problems.push(`${flow.label}: missing real device coverage row.`);
    } else {
      if (!hasAllWordGroups(deviceRow.phone, [["real"], ["physical"], ["phone", "mobile"]])) {
        problems.push(`${flow.label}: phone/mobile cell must name real physical phone or mobile evidence.`);
      }
      if (!hasAllWordGroups(deviceRow.tablet, [["real"], ["physical"], ["tablet"]])) {
        problems.push(`${flow.label}: tablet cell must name real physical tablet evidence.`);
      }
      if (
        !hasAllWordGroups(deviceRow.desktop, [
          ["real"],
          ["desktop", "laptop"],
        ])
      ) {
        problems.push(`${flow.label}: desktop/laptop cell must name real desktop or laptop evidence.`);
      }
      for (const [label, value] of [
        ["phone/mobile", deviceRow.phone],
        ["tablet", deviceRow.tablet],
        ["desktop/laptop", deviceRow.desktop],
      ] as const) {
        if (!hasSafeCompletionWording(value)) {
          problems.push(`${flow.label}: ${label} cell must prove completion or safe exit with no write and no external action before explicit confirmation.`);
        }
      }
      if (
        !artifactReferenceLooksConcrete(deviceRow.evidence, [
          ["phone", "mobile"],
          ["tablet"],
          ["desktop", "laptop"],
          ["screenshot", "photo", "capture", "artifact"],
        ])
      ) {
        problems.push(`${flow.label}: device evidence must include dated sanitized phone, tablet, and desktop/laptop screenshot/photo/capture/artifact references.`);
      }
      if (!validFreshDate(parseReviewerDate(deviceRow.reviewerDate))) {
        problems.push(`${flow.label}: device reviewer/date must include a non-future YYYY-MM-DD date no older than 7 days.`);
      }
      if (!includesAny(deviceRow.reviewerDate, ["reviewed", "verified", "validated", "approved", "sign-off"])) {
        problems.push(`${flow.label}: device reviewer/date must include explicit review wording.`);
      }
    }

    const interactionRow = interactionRows.find((row) => row.flowLabel === flow.label);
    if (!interactionRow) {
      problems.push(`${flow.label}: missing interaction mode coverage row.`);
    } else {
      for (const [label, value] of [
        ["voice", interactionRow.voice],
        ["touch", interactionRow.touch],
        ["keyboard", interactionRow.keyboard],
      ] as const) {
        if (!includesAny(value, [label, label === "keyboard" ? "keyboard-only" : label])) {
          problems.push(`${flow.label}: ${label} cell must name ${label} evidence.`);
        }
        if (!hasSafeCompletionWording(value)) {
          problems.push(`${flow.label}: ${label} cell must prove completion or safe exit with no write and no external action before explicit confirmation.`);
        }
      }
      if (
        !artifactReferenceLooksConcrete(interactionRow.evidence, [
          ["voice"],
          ["touch"],
          ["keyboard"],
          ["recording", "log", "screenshot", "artifact"],
        ])
      ) {
        problems.push(`${flow.label}: interaction evidence must include dated sanitized voice, touch, and keyboard recording/log/screenshot/artifact references.`);
      }
      if (!validFreshDate(parseReviewerDate(interactionRow.reviewerDate))) {
        problems.push(`${flow.label}: interaction reviewer/date must include a non-future YYYY-MM-DD date no older than 7 days.`);
      }
      if (!includesAny(interactionRow.reviewerDate, ["reviewed", "verified", "validated", "approved", "sign-off"])) {
        problems.push(`${flow.label}: interaction reviewer/date must include explicit review wording.`);
      }
    }
  }

  return {
    inputPath: relativeInputPath,
    readyForLaunchEvidence: problems.length === 0,
    reviewedOn: reviewedDate ? reviewedDate.toISOString().slice(0, 10) : "unknown",
    qaRunUrl: summaryQaRunUrl(lineValue(content, "QA run URL")),
    requiredFlowCount: canvasLaunchReadinessFlows.length,
    requiredDeviceRowCount: canvasLaunchReadinessFlows.length,
    requiredInteractionRowCount: canvasLaunchReadinessFlows.length,
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
  const summary = validateRealUseEvidence(inputPathArg);
  const exitCode = summary.readyForLaunchEvidence ? 0 : 1;

  if (jsonOutput) {
    const jsonSummary = `${JSON.stringify(summary, null, 2)}\n`;
    if (outputPathArg) {
      writeOutputFile(outputPathArg, jsonSummary);
    }
    console.log(jsonSummary);
    process.exit(exitCode);
  }

  console.log("Voice Canvas real-use evidence validation");
  console.log(`Ready for launch evidence: ${summary.readyForLaunchEvidence ? "yes" : "no"}`);
  console.log(`Reviewed on: ${summary.reviewedOn}`);
  console.log(`Required flows: ${summary.requiredFlowCount}`);
  console.log(`Required device rows: ${summary.requiredDeviceRowCount}`);
  console.log(`Required interaction rows: ${summary.requiredInteractionRowCount}`);
  console.log(`Problems: ${summary.problemCount}`);
  for (const problem of summary.problems) {
    console.log(`- ${problem}`);
  }
  console.log(
    summary.readyForLaunchEvidence
      ? "Real-use evidence artifact is ready."
      : "Real-use evidence artifact is not ready.",
  );
  process.exit(exitCode);
}

const output = `${realUseEvidenceTemplate()}\n`;

if (outputPathArg) {
  const relativeOutputPath = writeOutputFile(outputPathArg, output);
  console.log(`Saved real-use evidence template to ${relativeOutputPath}`);
  process.exit(0);
}

console.log(output);
