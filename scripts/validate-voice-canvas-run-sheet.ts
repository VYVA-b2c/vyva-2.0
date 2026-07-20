import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const defaultRunSheetPath = "docs/audits/voice-canvas-real-device-run-sheet.md";
const args = process.argv.slice(2);
const maxLaunchEvidenceAgeMs = 7 * 24 * 60 * 60 * 1000;

interface PendingSectionSummary {
  section: string;
  pendingCells: number;
  rowsWithPending: number;
}

interface MarkdownTable {
  section: string;
  headers: string[];
  rows: string[][];
}

const requiredSections = [
  "Privacy and safety guardrails",
  "Environment preflight",
  "Flow execution checklist",
  "Per-flow behavior pass",
  "Confirmation and rollback pass",
  "Copy, accessibility, and analytics pass",
  "Run-sheet closeout",
] as const;

const requiredFlows = [
  "Ride Voice Canvas",
  "Appointment Voice Canvas",
  "Medication Refill Voice Canvas",
  "Shopping Delivery Voice Canvas",
  "Provider Reply Voice Canvas",
  "Concierge Task Hub Resume",
] as const;

const requiredDeviceRows = ["Phone", "Tablet", "Desktop/laptop"] as const;

const requiredEnvironmentRows = [
  "Staging or production-like URL is deployed and non-local",
  "Build or commit SHA matches the tested deployment",
  "Live voice session is available",
  "Initial feature flags are enabled for tested flows",
  "Rollback feature flags are available",
  "Analytics sink is available",
] as const;

const requiredCopyAccessibilityAnalyticsRows = [
  "English copy uses one clear decision at a time",
  "Spanish long labels remain readable",
  "Focus moves meaningfully",
  "Screen-reader announcements fire",
  "Reduced-motion mode remains calm",
  "Analytics launch signals are present",
  "Analytics privacy is preserved",
] as const;

const sectionCoverageRequirements: Record<string, readonly (readonly string[])[]> = {
  "Privacy and safety guardrails": [
    ["synthetic"],
    ["transcripts"],
    ["typed free text"],
    ["addresses"],
    ["medication"],
    ["provider"],
    ["personal details"],
    ["launch blocker"],
    ["booking"],
    ["call"],
    ["message"],
    ["navigation"],
    ["write"],
    ["explicit final confirmation"],
    ["feature-flag rollback"],
    ["fallback"],
  ],
  "Flow execution checklist": [
    ["real phone"],
    ["real tablet"],
    ["real desktop/laptop"],
    ["touch"],
    ["keyboard"],
    ["voice"],
    ["existing fallback"],
    ["endpoint rollback"],
    ["analytics signal"],
    ["privacy query"],
  ],
  "Per-flow behavior pass": [
    ["start/resume"],
    ["app exit/reopen"],
    ["refresh/reconnect"],
    ["voice interruption"],
    ["browser back"],
    ["cancel/exit"],
    ["duplicate"],
    ["stale"],
    ["recoverable failure"],
    ["retry"],
    ["exit"],
  ],
  "Confirmation and rollback pass": [
    ["no external action"],
    ["explicit confirmation"],
    ["accepted once"],
    ["waiting"],
    ["pending"],
    ["completed"],
    ["blocked"],
    ["what happens next"],
    ["in-session flag rollback"],
    ["fallback"],
    ["no write"],
  ],
  "Copy, accessibility, and analytics pass": [
    ["one clear decision"],
    ["spanish"],
    ["long labels"],
    ["focus"],
    ["screen-reader"],
    ["reduced-motion"],
    ["started"],
    ["resumed"],
    ["abandoned"],
    ["blocked"],
    ["confirmed"],
    ["completed"],
    ["allowed envelope", "only `name`"],
    ["forbidden data"],
  ],
  "Run-sheet closeout": [
    ["pending"],
    ["sanitized artifact"],
    ["reviewer/date"],
    ["evidence-packet"],
    ["launch blocker"],
    ["patched"],
    ["retested"],
    ["feature remains disabled"],
    ["canvas:qa:features"],
    ["canvas:qa:analytics"],
    ["canvas:qa:packet"],
    ["canvas:qa:validate"],
    ["canvas:qa:preflight"],
    ["--final"],
    ["ready for launch"],
  ],
};

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

function isGenericCompletedCell(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (isPendingCell(normalized)) return false;
  return /^(?:pass|passed|complete|completed|done|ok|okay|verified|reviewed)(?:\s+by\s+(?:qa|reviewer))?(?:\s+on\s+\d{4}-\d{2}-\d{2})?$/.test(
    normalized,
  );
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? parsed
    : null;
}

function hasStaleOrFutureEvidenceDate(value: string): boolean {
  const dates = normalizeCell(value).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  if (dates.length === 0) return false;

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );

  return dates.some((dateValue) => {
    const date = parseIsoDate(dateValue);
    if (!date) return true;
    if (date > todayUtc) return true;
    return todayUtc.getTime() - date.getTime() > maxLaunchEvidenceAgeMs;
  });
}

const literalPersonalDataPatterns: readonly RegExp[] = [
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]*){10,}\b/,
  /\b(?:transcript|spoken transcript|typed free text|free text|saved-place label|saved place label|pickup address|dropoff address|destination address|street address|ride details|route details|pickup details|dropoff details|destination details|appointment date|appointment time|date\/time details|medication name|medication details|provider name|provider details|provider contact|reply text|reply body|shopping item|shopping details|item name|retailer name|price|fee|contact details|account id|user id|profile id|patient id)\b/i,
];

function hasLiteralPersonalData(value: string): boolean {
  const filenameFriendlyValue = value.replace(/[-_]+/g, " ");
  return literalPersonalDataPatterns.some(
    (pattern) => pattern.test(value) || pattern.test(filenameFriendlyValue),
  );
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  if (/^\|\s*:?-/.test(trimmed)) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseMarkdownTables(markdown: string): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  let currentSection = "Document";
  let activeTable: MarkdownTable | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      currentSection = heading[1].trim();
      activeTable = null;
      continue;
    }

    if (isMarkdownTableSeparator(line)) continue;

    const row = parseMarkdownTableRow(line);
    if (!row) {
      activeTable = null;
      continue;
    }

    if (!activeTable) {
      activeTable = {
        section: currentSection,
        headers: row,
        rows: [],
      };
      tables.push(activeTable);
      continue;
    }

    activeTable.rows.push(row);
  }

  return tables;
}

function sectionContent(markdown: string, section: string): string {
  const lines = markdown.split(/\r?\n/);
  const collected: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (inSection) break;
      inSection = heading[1].trim() === section;
      continue;
    }

    if (inSection) collected.push(line);
  }

  return collected.join("\n");
}

function findTable(
  tables: readonly MarkdownTable[],
  section: string,
): MarkdownTable | undefined {
  return tables.find((table) => table.section === section);
}

function hasRequiredRow(table: MarkdownTable | undefined, value: string): boolean {
  return Boolean(table?.rows.some((row) => normalizeCell(row[0] ?? "") === value));
}

function hasAllCoverageTerms(
  value: string,
  requirements: readonly (readonly string[])[],
): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return requirements.every((terms) =>
    terms.some((term) => normalized.includes(term.toLowerCase())),
  );
}

function summarizePendingCellsBySection(
  tables: readonly MarkdownTable[],
): PendingSectionSummary[] {
  const summaries = new Map<string, PendingSectionSummary>();

  for (const table of tables) {
    for (const row of table.rows) {
      const pendingCells = row.filter((cell) => isPendingCell(cell)).length;
      if (pendingCells === 0) continue;

      const summary =
        summaries.get(table.section) ??
        ({
          section: table.section,
          pendingCells: 0,
          rowsWithPending: 0,
        } satisfies PendingSectionSummary);
      summary.pendingCells += pendingCells;
      summary.rowsWithPending += 1;
      summaries.set(table.section, summary);
    }
  }

  return [...summaries.values()];
}

function countGenericCompletedCells(tables: readonly MarkdownTable[]): number {
  return tables.reduce(
    (total, table) =>
      total +
      table.rows.reduce(
        (rowTotal, row) =>
          rowTotal + row.slice(1).filter((cell) => isGenericCompletedCell(cell)).length,
        0,
      ),
    0,
  );
}

function countLiteralPersonalDataCells(tables: readonly MarkdownTable[]): number {
  return tables.reduce(
    (total, table) =>
      total +
      table.rows.reduce(
        (rowTotal, row) =>
          rowTotal + row.slice(1).filter((cell) => hasLiteralPersonalData(cell)).length,
        0,
      ),
    0,
  );
}

function countStaleOrFutureEvidenceDateCells(tables: readonly MarkdownTable[]): number {
  return tables.reduce(
    (total, table) =>
      total +
      table.rows.reduce(
        (rowTotal, row) =>
          rowTotal +
          row
            .slice(1)
            .filter(
              (cell) =>
                !isPendingCell(cell) && hasStaleOrFutureEvidenceDate(cell),
            ).length,
        0,
      ),
    0,
  );
}

function evaluateRunSheet(markdown: string) {
  const problems: string[] = [];
  const tables = parseMarkdownTables(markdown);
  const sections = new Set(
    markdown
      .split(/\r?\n/)
      .map((line) => line.match(/^##\s+(.+?)\s*$/)?.[1]?.trim())
      .filter(Boolean) as string[],
  );

  for (const section of requiredSections) {
    if (!sections.has(section)) {
      problems.push(`Missing required run-sheet section: ${section}.`);
    }
  }

  for (const [section, requirements] of Object.entries(sectionCoverageRequirements)) {
    const content = sectionContent(markdown, section);
    if (content && !hasAllCoverageTerms(content, requirements)) {
      problems.push(`${section} is missing required launch-readiness coverage.`);
    }
  }

  const environmentTable = findTable(tables, "Environment preflight");
  for (const row of requiredEnvironmentRows) {
    if (!hasRequiredRow(environmentTable, row)) {
      problems.push(`Missing environment preflight row: ${row}.`);
    }
  }

  const flowTable = findTable(tables, "Flow execution checklist");
  for (const flow of requiredFlows) {
    if (!hasRequiredRow(flowTable, flow)) {
      problems.push(`Missing flow execution checklist row: ${flow}.`);
    }
  }

  const behaviorTable = findTable(tables, "Per-flow behavior pass");
  for (const flow of requiredFlows) {
    for (const device of requiredDeviceRows) {
      const hasRow = Boolean(
        behaviorTable?.rows.some(
          (row) =>
            normalizeCell(row[0] ?? "") === flow &&
            normalizeCell(row[1] ?? "") === device,
        ),
      );
      if (!hasRow) {
        problems.push(`Missing per-flow behavior row: ${flow} on ${device}.`);
      }
    }
  }

  const confirmationTable = findTable(tables, "Confirmation and rollback pass");
  for (const flow of requiredFlows) {
    if (!hasRequiredRow(confirmationTable, flow)) {
      problems.push(`Missing confirmation and rollback row: ${flow}.`);
    }
  }

  const copyTable = findTable(tables, "Copy, accessibility, and analytics pass");
  for (const row of requiredCopyAccessibilityAnalyticsRows) {
    if (!hasRequiredRow(copyTable, row)) {
      problems.push(`Missing copy/accessibility/analytics row: ${row}.`);
    }
  }

  const pendingSections = summarizePendingCellsBySection(tables);
  const incompleteCellCount = pendingSections.reduce(
    (total, section) => total + section.pendingCells,
    0,
  );
  const genericCompletedCellCount = countGenericCompletedCells(tables);
  if (genericCompletedCellCount > 0) {
    problems.push(
      `Run sheet contains ${genericCompletedCellCount} filled cell(s) with generic pass text; record specific sanitized evidence instead.`,
    );
  }
  const staleOrFutureEvidenceDateCellCount =
    countStaleOrFutureEvidenceDateCells(tables);
  if (staleOrFutureEvidenceDateCellCount > 0) {
    problems.push(
      `Run sheet contains ${staleOrFutureEvidenceDateCellCount} filled cell(s) with stale, future, or invalid evidence dates; use non-future YYYY-MM-DD dates no older than 7 days.`,
    );
  }
  const literalPersonalDataCellCount = countLiteralPersonalDataCells(tables);
  if (literalPersonalDataCellCount > 0) {
    problems.push(
      `Run sheet contains ${literalPersonalDataCellCount} filled cell(s) that appear to include literal personal data; replace them with sanitized artifact references.`,
    );
  }
  const readyForQaRunSheet = problems.length === 0 && incompleteCellCount === 0;

  return {
    readyForQaRunSheet,
    state: readyForQaRunSheet ? "ready" : problems.length > 0 ? "invalid" : "pending",
    incompleteCellCount,
    pendingSections,
    problemCount: problems.length,
    problems,
  };
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Validate the Voice Canvas real-device QA run sheet before staging execution.",
      "",
      "Usage:",
      "  npm run canvas:qa:runsheet",
      "  npm run canvas:qa:runsheet -- --allow-pending",
      "  npm run --silent canvas:qa:runsheet -- --allow-pending --json",
      "  npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-run-sheet-summary.json",
      "  npm run canvas:qa:runsheet -- docs/audits/voice-canvas-real-device-run-sheet.md",
      "",
      "The command exits non-zero unless the run sheet has no pending cells and no structural coverage problems.",
      "Use --allow-pending for in-progress review of the committed run-sheet template.",
      "It protects privacy guardrails, environment preflight, flow/device rows, behavior recovery, rollback, copy/accessibility, analytics, and closeout checks.",
      "Filled result cells must name specific sanitized evidence or behavior; generic pass/done/OK text is rejected.",
      "Filled dated evidence cells must use non-future YYYY-MM-DD dates no older than 7 days.",
      "Filled cells must not include literal personal data such as street-address-shaped text, email addresses, phone numbers, transcripts, route details, shopping details, provider details, or account identifiers.",
      "Use --json to emit machine-readable summary output for QA artifacts or CI.",
      "Use --output=<path> with --json to also save the summary to a file.",
      "Existing output files are preserved by default; pass --force only when intentionally replacing one.",
    ].join("\n"),
  );
  process.exit(0);
}

const allowPending = args.includes("--allow-pending");
const jsonOutput = args.includes("--json");
const forceOutput = args.includes("--force");
const outputArg = args.find((arg) => arg.startsWith("--output="));
const outputPathArg = outputArg?.slice("--output=".length).trim();
if (outputArg && !outputPathArg) {
  console.error("Expected --output=<path>.");
  process.exit(1);
}
if (outputPathArg && !jsonOutput) {
  console.error("Use --output only with --json.");
  process.exit(1);
}

const runSheetArg = args.find((arg) => !arg.startsWith("-"));
const runSheetPath = path.resolve(process.cwd(), runSheetArg ?? defaultRunSheetPath);
const runSheet = readFileSync(runSheetPath, "utf8");
const result = evaluateRunSheet(runSheet);
const relativeRunSheetPath = path.relative(process.cwd(), runSheetPath);
const acceptedPending =
  allowPending && result.state === "pending" && result.problemCount === 0;
const nextPendingSection = [...result.pendingSections].sort(
  (a, b) => b.pendingCells - a.pendingCells,
)[0];

function failureMessage(): string {
  if (result.problemCount > 0) return "Run sheet is not ready.";
  if (result.state === "pending") {
    return "Run sheet is still pending. Complete the staging execution rows before final launch sign-off.";
  }
  return "Run sheet is not ready.";
}

const exitCode = result.readyForQaRunSheet || acceptedPending ? 0 : 1;

if (jsonOutput) {
  const jsonSummary = JSON.stringify(
    {
      runSheetPath: relativeRunSheetPath,
      state: result.state,
      readyForQaRunSheet: result.readyForQaRunSheet,
      incompleteCellCount: result.incompleteCellCount,
      pendingSections: result.pendingSections,
      nextPendingSection: nextPendingSection ?? null,
      problemCount: result.problemCount,
      problems: result.problems,
      allowPending,
      acceptedPending,
      message: result.readyForQaRunSheet
        ? "Run sheet is ready for QA matrix sign-off."
        : acceptedPending
          ? "Run sheet is still pending, but its structure is valid."
          : failureMessage(),
    },
    null,
    2,
  );

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

console.log(`Canvas run sheet: ${relativeRunSheetPath}`);
console.log(`State: ${result.state}`);
console.log(`Ready for QA matrix sign-off: ${result.readyForQaRunSheet ? "yes" : "no"}`);
console.log(`Incomplete cells: ${result.incompleteCellCount}`);

if (result.pendingSections.length > 0) {
  console.log("Pending cells by section:");
  for (const summary of result.pendingSections) {
    console.log(
      `- ${summary.section}: ${summary.pendingCells} pending cell(s) across ${summary.rowsWithPending} row(s)`,
    );
  }
  if (nextPendingSection) {
    console.log(
      `Next evidence area: ${nextPendingSection.section} (${nextPendingSection.pendingCells} pending cell(s) across ${nextPendingSection.rowsWithPending} row(s))`,
    );
  }
}

if (result.readyForQaRunSheet) {
  console.log("Run sheet is ready for QA matrix sign-off.");
  process.exit(0);
}

if (acceptedPending) {
  console.log("Run sheet is still pending, but its structure is valid.");
  process.exit(0);
}

if (result.problemCount > 0) {
  console.error("Run sheet is not ready:");
  for (const problem of result.problems) {
    console.error(`- ${problem}`);
  }
} else if (result.state === "pending") {
  console.error(
    "Run sheet is still pending. Complete the staging execution rows before final launch sign-off.",
  );
} else {
  console.error("Run sheet is not ready.");
}

process.exit(1);
