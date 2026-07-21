import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const artifactDatePlaceholder = "YYYY-MM-DD";
const artifactPathPlaceholder = `artifacts/voice-canvas/${artifactDatePlaceholder}-entry-surfaces.md`;
const maxLaunchEvidenceAgeMs = 7 * 24 * 60 * 60 * 1000;

interface EntrySurfaceEvidenceSummary {
  inputPath: string;
  readyForLaunchEvidence: boolean;
  reviewedOn: string;
  qaRunUrl: string;
  requiredFlowCount: number;
  requiredSurfaceCount: number;
  problemCount: number;
  problems: string[];
}

interface SurfaceEvidenceRow {
  flowLabel: string;
  surface: string;
  result: string;
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
      "Prepare a copy-safe Voice Canvas entry surface evidence artifact template.",
      "",
      "Usage:",
      "  npm run --silent canvas:qa:entry-surfaces -- --template",
      `  npm run --silent canvas:qa:entry-surfaces -- --template --output=${artifactPathPlaceholder}`,
      `  npm run canvas:qa:entry-surfaces -- --input=${artifactPathPlaceholder}`,
      `  npm run --silent canvas:qa:entry-surfaces -- --input=${artifactPathPlaceholder} --json --output=artifacts/voice-canvas/${artifactDatePlaceholder}-entry-surfaces-validation.json`,
      "",
      "Use --template to print the per-flow canonical entry surface evidence shape.",
      "Use --input=<path> to validate a filled entry surface evidence artifact.",
      "The template is intentionally not launch approval until every canonical launch surface has dated screenshot, log, recording, capture, photo, or artifact proof from the deployed QA run.",
      "Each surface row must prove the flow was exercised from that exact surface with no write and no external action before explicit confirmation.",
      "Do not add addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
      "Validation requires a deployed HTTPS non-local QA run URL, a non-future reviewed date generated within the last 7 days, no remaining placeholders, every launch flow and surface from the manifest, no generic main-entry coverage, and concrete sanitized artifact references.",
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
  console.error("Expected --template or --input=<entry surface evidence artifact path>.");
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

function entrySurfaceEvidenceTemplate(): string {
  const lines = [
    "# Voice Canvas entry surface evidence artifact",
    "",
    "Use this copy-safe artifact to prove every Canvas launch flow was opened or resumed from every canonical entry surface in the launch manifest.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: [${artifactDatePlaceholder}]`,
    "Reviewer: [reviewer]",
    "QA run URL: [deployed HTTPS staging or production-like URL]",
    "Commit/build: [commit SHA or deployed build]",
    "Privacy boundary: [sanitized artifact references only; no personal details]",
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
        `| ${surface} | [exercised from this exact surface with no write and no external action before explicit confirmation] | [sanitized dated screenshot/log/recording/capture/photo/artifact reference] | [reviewed by reviewer on ${artifactDatePlaceholder}] |`,
      );
    }
  }

  lines.push(
    "",
    "## Copy-ready evidence packet note",
    "",
    `Entry surface artifacts reviewed on [${artifactDatePlaceholder}] by [reviewer]: every canonical launch surface for ride, appointment, refill, shopping, provider reply, and task hub resume was exercised from the manifest-aligned surface list with sanitized dated screenshot/log/recording/capture/photo/artifact proof, no write, and no external action before explicit confirmation.`,
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

function parseSurfaceRows(content: string): SurfaceEvidenceRow[] {
  const rows: SurfaceEvidenceRow[] = [];
  let currentFlowLabel = "";

  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      currentFlowLabel = heading[1];
      continue;
    }

    if (!currentFlowLabel || !line.trim().startsWith("|")) continue;
    const cells = splitMarkdownRow(line);
    if (
      cells.length < 4 ||
      cells[0] === "Surface" ||
      /^-+$/.test(cells[0]) ||
      cells[0] === "---"
    ) {
      continue;
    }

    rows.push({
      flowLabel: currentFlowLabel,
      surface: cells[0],
      result: cells[1] ?? "",
      evidence: cells[2] ?? "",
      reviewerDate: cells[3] ?? "",
    });
  }

  return rows;
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

const rejectedEntrySurfaceEvidencePatterns: readonly RegExp[] = [
  /\b(?:write|data write|booking|call|message|navigation|external action)\s+(?:triggered|occurred|happened|started|sent|placed|submitted|created|booked|navigated)\b/i,
  /\b(?:triggered|sent|placed|submitted|created|booked|navigated)\s+(?:a\s+)?(?:write|data write|booking|call|message|navigation|external action)\b/i,
  /\b(?:not exercised|not opened|did not open|did not resume|unable to open|unable to resume|failed|unavailable|fallback missing|fallback unavailable)\b/i,
];

function artifactReferenceLooksConcrete(value: string): boolean {
  return /\b\d{4}-\d{2}-\d{2}\b/.test(value) && /\b(?:screenshot|log|recording|capture|photo|artifact)\b/i.test(value);
}

function validateEntrySurfaceEvidence(inputPathArg: string): EntrySurfaceEvidenceSummary {
  const inputPath = path.resolve(process.cwd(), inputPathArg);
  const relativeInputPath = path.relative(process.cwd(), inputPath);
  const problems: string[] = [];
  let content = "";

  try {
    content = readFileSync(inputPath, "utf8");
  } catch {
    problems.push("Entry surface evidence artifact could not be read.");
  }

  if (!content.includes("# Voice Canvas entry surface evidence artifact")) {
    problems.push("Entry surface evidence artifact must use the expected template heading.");
  }

  if (/\[[^\]]+\]/.test(content)) {
    problems.push("Entry surface evidence artifact still contains placeholder text.");
  }

  const reviewedDate = parseReviewedDate(content);
  if (!reviewedDate) {
    problems.push("Entry surface evidence artifact must include Reviewed on: YYYY-MM-DD.");
  } else if (reviewedDate.getTime() > Date.now()) {
    problems.push("Entry surface evidence reviewed date must not be in the future.");
  } else if (Date.now() - reviewedDate.getTime() > maxLaunchEvidenceAgeMs) {
    problems.push("Entry surface evidence reviewed date must be no older than 7 days.");
  }

  for (const requiredLine of [
    "Reviewer",
    "QA run URL",
    "Commit/build",
    "Privacy boundary",
  ]) {
    if (!lineHasFilledValue(content, requiredLine)) {
      problems.push(`Entry surface evidence artifact must fill ${requiredLine}.`);
    }
  }
  if (!isDeployedQaRunUrl(lineValue(content, "QA run URL"))) {
    problems.push("Entry surface evidence QA run URL must be a deployed HTTPS non-local URL.");
  }

  if (/generic main entry|main entry only|normal flow/i.test(content)) {
    problems.push("Entry surface evidence artifact must not use generic main-entry coverage.");
  }

  for (const pattern of unsafeFilledArtifactPatterns) {
    if (pattern.test(content)) {
      problems.push("Entry surface evidence artifact appears to include personal details.");
      break;
    }
  }

  for (const pattern of rejectedEntrySurfaceEvidencePatterns) {
    if (pattern.test(content)) {
      problems.push("Entry surface evidence artifact must use affirmative successful entry-surface evidence, not failed, unavailable, missing-fallback, write, booking, call, message, navigation, or external-action evidence.");
      break;
    }
  }

  const rows = parseSurfaceRows(content);

  for (const flow of canvasLaunchReadinessFlows) {
    if (!content.includes(`### ${flow.label}`)) {
      problems.push(`Entry surface evidence artifact is missing ${flow.label}.`);
    }
    if (!content.includes(`- Flow ID: ${flow.id}`)) {
      problems.push(`Entry surface evidence artifact is missing ${flow.label} flow ID.`);
    }
    if (!content.includes(`- Required surfaces: ${flow.surfaces.join("; ")}`)) {
      problems.push(
        `${flow.label}: entry surface artifact must keep the canonical manifest surface list.`,
      );
    }

    for (const surface of flow.surfaces) {
      const row = rows.find(
        (candidate) => candidate.flowLabel === flow.label && candidate.surface === surface,
      );

      if (!row) {
        problems.push(`${flow.label}: missing entry surface row for ${surface}.`);
        continue;
      }

      if (!includesAny(row.result, ["exercised", "started", "resumed", "opened"])) {
        problems.push(`${flow.label} ${surface}: result must say the surface was exercised.`);
      }
      if (!includesAny(row.result, ["no write", "without write", "no-write"])) {
        problems.push(`${flow.label} ${surface}: result must prove no write occurred.`);
      }
      if (
        !includesAny(row.result, [
          "no external action",
          "without external action",
          "no-external-action",
        ])
      ) {
        problems.push(
          `${flow.label} ${surface}: result must prove no external action occurred before confirmation.`,
        );
      }
      if (!artifactReferenceLooksConcrete(row.evidence)) {
        problems.push(
          `${flow.label} ${surface}: evidence must include a dated sanitized screenshot/log/recording/capture/photo/artifact reference.`,
        );
      }
      if (!validFreshDate(parseReviewerDate(row.reviewerDate))) {
        problems.push(
          `${flow.label} ${surface}: reviewer/date must include a non-future YYYY-MM-DD date no older than 7 days.`,
        );
      }
      if (!includesAny(row.reviewerDate, ["reviewed", "verified", "validated", "approved", "sign-off"])) {
        problems.push(
          `${flow.label} ${surface}: reviewer/date must include explicit review wording.`,
        );
      }
    }
  }

  return {
    inputPath: relativeInputPath,
    readyForLaunchEvidence: problems.length === 0,
    reviewedOn: reviewedDate ? reviewedDate.toISOString().slice(0, 10) : "unknown",
    qaRunUrl: summaryQaRunUrl(lineValue(content, "QA run URL")),
    requiredFlowCount: canvasLaunchReadinessFlows.length,
    requiredSurfaceCount: canvasLaunchReadinessFlows.reduce(
      (total, flow) => total + flow.surfaces.length,
      0,
    ),
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
  const summary = validateEntrySurfaceEvidence(inputPathArg);
  const exitCode = summary.readyForLaunchEvidence ? 0 : 1;

  if (jsonOutput) {
    const jsonSummary = `${JSON.stringify(summary, null, 2)}\n`;
    if (outputPathArg) {
      writeOutputFile(outputPathArg, jsonSummary);
    }
    console.log(jsonSummary);
    process.exit(exitCode);
  }

  console.log("Voice Canvas entry surface evidence validation");
  console.log(`Ready for launch evidence: ${summary.readyForLaunchEvidence ? "yes" : "no"}`);
  console.log(`Reviewed on: ${summary.reviewedOn}`);
  console.log(`Required flows: ${summary.requiredFlowCount}`);
  console.log(`Required surfaces: ${summary.requiredSurfaceCount}`);
  console.log(`Problems: ${summary.problemCount}`);
  for (const problem of summary.problems) {
    console.log(`- ${problem}`);
  }
  console.log(
    summary.readyForLaunchEvidence
      ? "Entry surface evidence artifact is ready."
      : "Entry surface evidence artifact is not ready.",
  );
  process.exit(exitCode);
}

const output = `${entrySurfaceEvidenceTemplate()}\n`;

if (outputPathArg) {
  const relativeOutputPath = writeOutputFile(outputPathArg, output);
  console.log(`Saved entry surface evidence template to ${relativeOutputPath}`);
  process.exit(0);
}

console.log(output);
