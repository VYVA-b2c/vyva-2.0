import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CANVAS_REAL_DEVICE_QA_PENDING_STATUS,
  evaluateCanvasRealDeviceQaMatrix,
} from "../src/components/voice-canvas/canvasLaunchSignoff";

const defaultMatrixPath = "docs/audits/voice-canvas-real-device-qa-matrix.md";
const args = process.argv.slice(2);

interface PendingSectionSummary {
  section: string;
  pendingCells: number;
  rowsWithPending: number;
}

function normalizeCell(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isPendingCell(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    normalized === "" ||
    normalized === "pending" ||
    normalized === "tbd" ||
    normalized === "todo" ||
    normalized === "fixme"
  );
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  if (/^\|\s*-/.test(trimmed)) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function summarizePendingCellsBySection(
  markdown: string,
): PendingSectionSummary[] {
  const summaries = new Map<string, PendingSectionSummary>();
  let currentSection = "Document";

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      currentSection = heading[1];
      continue;
    }

    const row = parseMarkdownTableRow(line);
    if (!row) continue;

    const pendingCells = row.filter((cell) => isPendingCell(cell)).length;
    if (pendingCells === 0) continue;

    const summary =
      summaries.get(currentSection) ??
      ({
        section: currentSection,
        pendingCells: 0,
        rowsWithPending: 0,
      } satisfies PendingSectionSummary);
    summary.pendingCells += pendingCells;
    summary.rowsWithPending += 1;
    summaries.set(currentSection, summary);
  }

  return [...summaries.values()];
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Validate the Voice Canvas real-device QA sign-off matrix.",
      "",
      "Usage:",
      "  npm run canvas:qa:validate",
      "  npm run canvas:qa:validate -- --allow-pending",
      "  npm run --silent canvas:qa:validate -- --allow-pending --json",
      "  npm run canvas:qa:validate -- docs/audits/voice-canvas-real-device-qa-matrix.md",
      "",
      "The command exits non-zero unless the matrix is ready for launch.",
      "Use --allow-pending for in-progress review of the committed pending matrix.",
      "Use --json to emit machine-readable summary output for QA artifacts or CI.",
    ].join("\n"),
  );
  process.exit(0);
}

const allowPending = args.includes("--allow-pending");
const jsonOutput = args.includes("--json");
const matrixArg = args.find((arg) => !arg.startsWith("-"));
const matrixPath = path.resolve(process.cwd(), matrixArg ?? defaultMatrixPath);
const matrix = readFileSync(matrixPath, "utf8");
const result = evaluateCanvasRealDeviceQaMatrix(matrix);
const pendingSummaries = summarizePendingCellsBySection(matrix);
const relativeMatrixPath = path.relative(process.cwd(), matrixPath);
const acceptedPending =
  allowPending &&
  result.status === CANVAS_REAL_DEVICE_QA_PENDING_STATUS &&
  result.problems.length === 0;

function failureMessage(): string {
  if (result.problems.length > 0) return "Matrix is not ready for launch.";
  if (result.status === CANVAS_REAL_DEVICE_QA_PENDING_STATUS) {
    return "Matrix is still pending execution. Fill every row, attach sanitized evidence, and change Status to ready for launch.";
  }
  return "Matrix is not ready for launch.";
}

const exitCode = result.readyForLaunch || acceptedPending ? 0 : 1;

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        matrixPath: relativeMatrixPath,
        status: result.status,
        state: result.state,
        readyForLaunch: result.readyForLaunch,
        incompleteCellCount: result.incompleteCellCount,
        failingCellCount: result.failingCellCount,
        pendingSections: pendingSummaries,
        problemCount: result.problems.length,
        problems: result.problems,
        allowPending,
        acceptedPending,
        message: result.readyForLaunch
          ? "Matrix is ready for launch."
          : acceptedPending
            ? "Matrix is still pending execution, but its structure is valid."
            : failureMessage(),
      },
      null,
      2,
    ),
  );
  process.exit(exitCode);
}

console.log(`Canvas QA matrix: ${relativeMatrixPath}`);
console.log(`Status: ${result.status ?? "missing"}`);
console.log(`State: ${result.state}`);
console.log(`Ready for launch: ${result.readyForLaunch ? "yes" : "no"}`);
console.log(`Incomplete cells: ${result.incompleteCellCount}`);
console.log(`Failing/not-ready cells: ${result.failingCellCount}`);

if (pendingSummaries.length > 0) {
  console.log("Pending cells by section:");
  for (const summary of pendingSummaries) {
    console.log(
      `- ${summary.section}: ${summary.pendingCells} pending cell(s) across ${summary.rowsWithPending} row(s)`,
    );
  }
}

if (result.readyForLaunch) {
  console.log("Matrix is ready for launch.");
  process.exit(0);
}

if (acceptedPending) {
  console.log("Matrix is still pending execution, but its structure is valid.");
  process.exit(0);
}

if (result.problems.length > 0) {
  console.error("Matrix is not ready for launch:");
  for (const problem of result.problems) {
    console.error(`- ${problem}`);
  }
} else if (result.status === CANVAS_REAL_DEVICE_QA_PENDING_STATUS) {
  console.error(
    "Matrix is still pending execution. Fill every row, attach sanitized evidence, and change Status to ready for launch.",
  );
} else {
  console.error("Matrix is not ready for launch.");
}

process.exit(1);
