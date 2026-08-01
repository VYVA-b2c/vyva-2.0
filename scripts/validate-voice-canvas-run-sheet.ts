import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

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

const requiredBehaviorColumns = [
  "Flow",
  "Device",
  "Interaction mode",
  "Start/resume restored work",
  "App exit/reopen restored draft",
  "Refresh/reconnect restored work",
  "Voice interruption recovered work",
  "Browser back preserved or returned safely",
  "Cancel/exit left safely",
  "Duplicate prevented and stale response ignored",
  "Recoverable failure offered retry and exit",
  "Evidence reference",
  "Reviewer/date",
] as const;

const requiredFlowExecutionColumns = [
  "Flow",
  "Entry surface",
  "Main path to exercise",
  "Existing fallback path",
  "Required sanitized artifacts",
] as const;

const requiredCopyAccessibilityAnalyticsColumns = [
  "Check",
  "Expected result",
  "Evidence reference",
  "Reviewer/date",
] as const;

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

function hasContradictoryLaunchEvidenceLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (isPendingCell(normalized)) return false;
  return (
    /\b(known issue|known issues|known bug|known bugs|unresolved issue|unresolved issues|unresolved bug|unresolved bugs|defect|defects|regression|regressions|risk accepted|accepted risk|launch risk|workaround required|manual workaround|waiver|exception)\b/.test(
      normalized,
    ) ||
    /\b(not complete|not completed|incomplete|did not complete|failed to complete|unable to complete|could not complete|not safely exited|not safe exit|not exited safely)\b/.test(
      normalized,
    ) ||
    /\b(?:write|writes|external action|external actions|booking|bookings|call|calls|message|messages|navigation|navigations|submission|submissions|endpoint|endpoints)\b.{0,36}\b(?:happened|occurred|triggered|fired|ran|sent|submitted|created|wrote|called|messaged|navigated)\b/.test(
      normalized,
    ) ||
    /\b(?:triggered|fired|ran|sent|submitted|created|wrote|called|messaged|navigated)\b.{0,36}\b(?:write|writes|external action|external actions|booking|bookings|call|calls|message|messages|navigation|navigations|submission|submissions|endpoint|endpoints)\b/.test(
      normalized,
    ) ||
    /\b(?:fallback|rollback|canvas|draft|entered information|current scene|current work|focus|screen-reader|screen reader|announcement|announcements|spanish|long labels|analytics|voice|touch|keyboard|reconnect|refresh|interruption|browser back|retry|exit)\b.{0,36}\b(?:missing|unavailable|not available|not visible|not shown|not working|not preserved|not restored|not recovered|not readable|not announced|failed|broken)\b/.test(
      normalized,
    ) ||
    /\b(?:missing|unavailable|not available|not visible|not shown|not working|not preserved|not restored|not recovered|not readable|not announced|failed|broken)\b.{0,36}\b(?:fallback|rollback|canvas|draft|entered information|current scene|current work|focus|screen-reader|screen reader|announcement|announcements|spanish|long labels|analytics|voice|touch|keyboard|reconnect|refresh|interruption|browser back|retry|exit)\b/.test(
      normalized,
    )
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

function evidenceDateTodayUtc(): Date {
  const testDateOverride = process.env.NODE_ENV === "test"
    ? process.env.VYVA_QA_VALIDATION_TODAY
    : undefined;
  const overrideMatch = testDateOverride?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (overrideMatch) {
    return new Date(`${overrideMatch[1]}-${overrideMatch[2]}-${overrideMatch[3]}T00:00:00.000Z`);
  }

  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
}

function hasStaleOrFutureEvidenceDate(value: string): boolean {
  const dates = normalizeCell(value).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  if (dates.length === 0) return false;

  const todayUtc = evidenceDateTodayUtc();

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
  /https?:\/\/[^\s/|`]+:[^\s@/|`]+@[^\s|`]+/i,
  /\b(?:token|secret|api[_-]?key|authorization|cookie|password|session)[=:][^\s|`]+/i,
  /\bbearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\bx-api-key\s*[:=]\s*[^\s|`]+/i,
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
  const normalized = normalizeEvidenceText(value);
  return requirements.every((terms) =>
    terms.some((term) => normalized.includes(normalizeEvidenceText(term))),
  );
}

function normalizeEvidenceText(value: string): string {
  return normalizeCell(value).toLowerCase().replace(/[-/]+/g, " ");
}

function hasEvidenceTermGroup(
  value: string,
  terms: readonly string[],
): boolean {
  const normalized = normalizeEvidenceText(value);
  return terms.some((term) => normalized.includes(normalizeEvidenceText(term)));
}

function hasEvidenceTermGroups(
  value: string,
  requirements: readonly (readonly string[])[],
): boolean {
  return requirements.every((terms) => hasEvidenceTermGroup(value, terms));
}

const behaviorCellRequirements: Partial<
  Record<(typeof requiredBehaviorColumns)[number], readonly (readonly string[])[]>
> = {
  "Interaction mode": [["voice"], ["touch"], ["keyboard"]],
  "Start/resume restored work": [
    ["start", "resume", "start/resume"],
    ["restored", "preserved"],
    ["entered information", "current scene", "current work"],
    ["no write", "without write"],
    ["no resubmission", "without resubmission"],
    ["no external action", "without external action"],
  ],
  "App exit/reopen restored draft": [
    ["app exit", "reopen", "exit/reopen"],
    ["restored"],
    ["draft", "entered information"],
    ["no write", "without write"],
    ["no resubmission", "without resubmission"],
    ["no external action", "without external action"],
  ],
  "Refresh/reconnect restored work": [
    ["refresh"],
    ["reconnect"],
    ["restored", "preserved"],
    ["entered information", "work"],
    ["no write", "without write"],
    ["no resubmission", "without resubmission"],
    ["no external action", "without external action"],
  ],
  "Voice interruption recovered work": [
    ["voice interruption", "interruption"],
    ["recovered", "restored", "preserved"],
    ["entered information", "work"],
    ["no write", "without write"],
    ["no resubmission", "without resubmission"],
    ["no external action", "without external action"],
  ],
  "Browser back preserved or returned safely": [
    ["browser back", "back"],
    ["preserved", "returned safely", "safe"],
    ["entered information", "work"],
    ["no write", "without write"],
    ["no external action", "without external action"],
  ],
  "Cancel/exit left safely": [
    ["cancel"],
    ["exit"],
    ["left safely", "safe"],
    ["no write", "without write"],
    ["no external action", "without external action"],
  ],
  "Duplicate prevented and stale response ignored": [
    ["duplicate"],
    ["prevented", "blocked", "ignored", "rejected", "discarded"],
    ["stale"],
    ["ignored", "rejected", "discarded"],
    ["no write", "without write"],
    ["no resubmission", "without resubmission"],
    ["no external action", "without external action"],
  ],
  "Recoverable failure offered retry and exit": [
    ["recoverable failure", "failure"],
    ["retry"],
    ["exit", "cancel"],
    ["entered information", "preserved"],
    ["no write", "without write", "no extra write"],
    ["no resubmission", "without resubmission"],
    ["no external action", "without external action"],
  ],
  "Evidence reference": [
    ["artifact", "screenshot", "photo", "recording", "log", "trace"],
    ["reviewed", "verified", "captured"],
    ["start", "resume", "start/resume"],
    ["app exit", "reopen", "exit/reopen"],
    ["refresh"],
    ["reconnect"],
    ["interruption"],
    ["browser back", "back"],
    ["cancel"],
    ["duplicate"],
    ["stale"],
    ["retry"],
    ["no personal details", "no personal data"],
  ],
  "Reviewer/date": [["qa", "reviewer"], ["reviewed", "verified", "captured"]],
};

const confirmationCellRequirements: Record<string, readonly (readonly string[])[]> = {
  "No external action before explicit confirmation": [
    ["no external action", "without external action"],
    ["no write", "without write"],
    ["booking"],
    ["call"],
    ["message"],
    ["navigation"],
    ["explicit confirmation"],
  ],
  "Explicit confirmation accepted once": [
    ["explicit confirmation"],
    ["accepted once", "submitted once", "only once"],
    ["duplicate", "double"],
    ["prevented", "blocked", "ignored", "rejected", "discarded"],
  ],
  "Waiting state explains what is pending and what has not happened": [
    ["waiting"],
    ["pending", "in progress"],
    ["what has not happened", "has not happened", "not happened"],
    ["no external action", "without external action"],
  ],
  "Completed or blocked result explains what happens next": [
    ["completed"],
    ["blocked"],
    ["what happens next"],
    ["next"],
  ],
  "In-session flag rollback closes or hides Canvas": [
    ["in-session", "in session"],
    ["flag rollback", "feature flag rollback"],
    ["canvas"],
    ["closes", "closed", "hides", "hidden"],
  ],
  "Existing fallback path appears": [
    ["existing", "previous", "safe"],
    ["fallback"],
    ["path", "panel", "experience"],
    ["appears", "visible", "shown"],
  ],
  "No write or external action during rollback": [
    ["rollback"],
    ["no write", "without write"],
    ["no external action", "without external action"],
  ],
  "Evidence reference": [
    ["artifact", "screenshot", "photo", "recording", "log", "trace"],
    ["reviewed", "verified", "captured"],
    ["explicit confirmation"],
    ["waiting"],
    ["completed"],
    ["blocked"],
    ["rollback"],
    ["fallback"],
    ["no write", "without write"],
    ["no external action", "without external action"],
    ["no personal details", "no personal data"],
  ],
  "Reviewer/date": [["qa", "reviewer"], ["reviewed", "verified", "captured"]],
};

const copyAccessibilityAnalyticsCellRequirements: Record<
  string,
  readonly (readonly string[])[]
> = {
  "English copy uses one clear decision at a time": [
    ["one clear decision"],
    ["flow", "each flow"],
    ["exit", "safe exit"],
  ],
  "Spanish long labels remain readable": [
    ["spanish"],
    ["long label", "long labels"],
    ["readable", "legible"],
    ["no overflow", "no horizontal overflow", "without overflow"],
    ["clipping", "no clipping"],
    ["truncation", "no truncation"],
  ],
  "Focus moves meaningfully": [
    ["focus"],
    ["scene heading", "primary control"],
    ["moves", "moved"],
  ],
  "Screen-reader announcements fire": [
    ["screen-reader", "screen reader"],
    ["announcements", "announced"],
    ["waiting"],
    ["blocked"],
    ["completed"],
  ],
  "Reduced-motion mode remains calm": [
    ["reduced-motion", "reduced motion"],
    ["calm", "usable"],
    ["animation"],
  ],
  "Analytics launch signals are present": [
    ["started"],
    ["resumed"],
    ["abandoned"],
    ["blocked"],
    ["confirmed"],
    ["completed", "terminal pending"],
    ["aggregate"],
    ["positive"],
  ],
  "Analytics privacy is preserved": [
    ["allowed envelope", "only name", "only `name`", "name step input attempt restored revision"],
    ["forbidden data"],
    ["absent", "not recorded", "not logged", "not captured", "not included"],
  ],
};

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

function countContradictoryLaunchEvidenceCells(
  tables: readonly MarkdownTable[],
): number {
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
                !isPendingCell(cell) && hasContradictoryLaunchEvidenceLanguage(cell),
            ).length,
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

function tableColumnIndex(table: MarkdownTable, header: string): number {
  return table.headers.findIndex((candidate) => normalizeCell(candidate) === header);
}

function flowExecutionArtifactRequirements(
  flowId: string,
): readonly (readonly string[])[] {
  if (flowId === "task_hub_resume") {
    return [
      ["task hub resume"],
      ["destination fallback"],
      ["no write", "no-write"],
      ["no external action", "no-external-action"],
    ];
  }

  return [
    ["device screenshots", "device screenshot", "photos"],
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["endpoint rollback"],
    ["analytics signal"],
    ["privacy query"],
  ];
}

function invalidFlowExecutionChecklistRows(
  table: MarkdownTable | undefined,
): string[] {
  if (!table) return [];
  const problems: string[] = [];
  const entrySurfaceIndex = tableColumnIndex(table, "Entry surface");
  const mainPathIndex = tableColumnIndex(table, "Main path to exercise");
  const fallbackIndex = tableColumnIndex(table, "Existing fallback path");
  const artifactsIndex = tableColumnIndex(table, "Required sanitized artifacts");

  for (const flow of canvasLaunchReadinessFlows) {
    const row = table.rows.find(
      (candidate) => normalizeCell(candidate[0] ?? "") === flow.label,
    );
    if (!row) continue;

    if (
      entrySurfaceIndex >= 0 &&
      !hasEvidenceTermGroups(
        row[entrySurfaceIndex] ?? "",
        flow.surfaces.map((surface) => [surface]),
      )
    ) {
      problems.push(
        `${flow.label}: flow execution checklist must name every canonical launch entry surface.`,
      );
    }

    if (mainPathIndex >= 0) {
      const mainPathRequirements = flow.featureFlag
        ? [
            ["explicit confirmation"],
            ["waiting"],
            ["completed", "saved"],
            ["blocked"],
          ]
        : [["resume"], ["stale", "blocked"]];
      if (!hasEvidenceTermGroups(row[mainPathIndex] ?? "", mainPathRequirements)) {
        problems.push(
          `${flow.label}: flow execution checklist must name the canonical launch path to exercise.`,
        );
      }
    }

    const expectedFallback =
      flow.featureFlag?.fallback ?? "safe existing destination path";
    if (
      fallbackIndex >= 0 &&
      !hasEvidenceTermGroups(row[fallbackIndex] ?? "", [[expectedFallback]])
    ) {
      problems.push(
        `${flow.label}: flow execution checklist must name the expected fallback path.`,
      );
    }

    if (
      artifactsIndex >= 0 &&
      !hasEvidenceTermGroups(
        row[artifactsIndex] ?? "",
        flowExecutionArtifactRequirements(flow.id),
      )
    ) {
      problems.push(
        `${flow.label}: flow execution checklist must name the required sanitized artifact categories.`,
      );
    }
  }

  return problems;
}

function invalidBehaviorEvidenceCells(table: MarkdownTable | undefined): string[] {
  if (!table) return [];
  const problems: string[] = [];

  for (const [column, requirements] of Object.entries(behaviorCellRequirements)) {
    const columnIndex = tableColumnIndex(table, column);
    if (columnIndex < 0) continue;

    for (const row of table.rows) {
      const value = row[columnIndex] ?? "";
      if (isPendingCell(value)) continue;
      if (column === "Reviewer/date" && !hasStaleOrFutureEvidenceDate(value)) {
        const hasDate = /\b\d{4}-\d{2}-\d{2}\b/.test(value);
        if (!hasDate) {
          problems.push(
            `${row[0] ?? "Unknown flow"} on ${row[1] ?? "unknown device"}: ${column} must include a non-future YYYY-MM-DD date.`,
          );
          continue;
        }
      }
      if (!hasEvidenceTermGroups(value, requirements)) {
        problems.push(
          `${row[0] ?? "Unknown flow"} on ${row[1] ?? "unknown device"}: ${column} must name the specific real-use evidence it proves.`,
        );
      }
    }
  }

  return problems;
}

function invalidConfirmationEvidenceCells(table: MarkdownTable | undefined): string[] {
  if (!table) return [];
  const problems: string[] = [];

  for (const [column, requirements] of Object.entries(confirmationCellRequirements)) {
    const columnIndex = tableColumnIndex(table, column);
    if (columnIndex < 0) continue;

    for (const row of table.rows) {
      const value = row[columnIndex] ?? "";
      if (isPendingCell(value)) continue;
      if (column === "Reviewer/date" && !/\b\d{4}-\d{2}-\d{2}\b/.test(value)) {
        problems.push(
          `${row[0] ?? "Unknown flow"}: ${column} must include a non-future YYYY-MM-DD date.`,
        );
        continue;
      }
      if (!hasEvidenceTermGroups(value, requirements)) {
        problems.push(
          `${row[0] ?? "Unknown flow"}: ${column} must name the specific confirmation or rollback evidence it proves.`,
        );
      }
    }
  }

  return problems;
}

function invalidCopyAccessibilityAnalyticsCells(
  table: MarkdownTable | undefined,
): string[] {
  if (!table) return [];
  const problems: string[] = [];
  const expectedResultIndex = tableColumnIndex(table, "Expected result");
  const evidenceReferenceIndex = tableColumnIndex(table, "Evidence reference");
  const reviewerDateIndex = tableColumnIndex(table, "Reviewer/date");

  for (const row of table.rows) {
    const check = normalizeCell(row[0] ?? "");
    const requirements = copyAccessibilityAnalyticsCellRequirements[check];
    if (!requirements) continue;

    for (const [label, columnIndex] of [
      ["Expected result", expectedResultIndex],
      ["Evidence reference", evidenceReferenceIndex],
    ] as const) {
      if (columnIndex < 0) continue;
      const value = row[columnIndex] ?? "";
      if (isPendingCell(value)) continue;
      const checkedValue = label === "Expected result" ? `${check} ${value}` : value;
      if (!hasEvidenceTermGroups(checkedValue, requirements)) {
        problems.push(
          `${check}: ${label} must name the specific copy/accessibility/analytics evidence it proves.`,
        );
      }
    }

    if (reviewerDateIndex >= 0) {
      const reviewerDate = row[reviewerDateIndex] ?? "";
      if (
        !isPendingCell(reviewerDate) &&
        (!/\b\d{4}-\d{2}-\d{2}\b/.test(reviewerDate) ||
          !hasEvidenceTermGroups(reviewerDate, [["qa", "reviewer"], ["reviewed", "verified", "captured"]]))
      ) {
        problems.push(
          `${check}: Reviewer/date must include reviewer evidence with a non-future YYYY-MM-DD date.`,
        );
      }
    }
  }

  return problems;
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
  if (flowTable) {
    for (const column of requiredFlowExecutionColumns) {
      if (!flowTable.headers.some((header) => normalizeCell(header) === column)) {
        problems.push(`Missing flow execution checklist column: ${column}.`);
      }
    }
  }
  for (const flow of requiredFlows) {
    if (!hasRequiredRow(flowTable, flow)) {
      problems.push(`Missing flow execution checklist row: ${flow}.`);
    }
  }
  problems.push(...invalidFlowExecutionChecklistRows(flowTable));

  const behaviorTable = findTable(tables, "Per-flow behavior pass");
  if (behaviorTable) {
    for (const column of requiredBehaviorColumns) {
      if (!behaviorTable.headers.some((header) => normalizeCell(header) === column)) {
        problems.push(`Missing per-flow behavior column: ${column}.`);
      }
    }
  }
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
  problems.push(...invalidBehaviorEvidenceCells(behaviorTable));

  const confirmationTable = findTable(tables, "Confirmation and rollback pass");
  for (const flow of requiredFlows) {
    if (!hasRequiredRow(confirmationTable, flow)) {
      problems.push(`Missing confirmation and rollback row: ${flow}.`);
    }
  }
  problems.push(...invalidConfirmationEvidenceCells(confirmationTable));

  const copyTable = findTable(tables, "Copy, accessibility, and analytics pass");
  if (copyTable) {
    for (const column of requiredCopyAccessibilityAnalyticsColumns) {
      if (!copyTable.headers.some((header) => normalizeCell(header) === column)) {
        problems.push(`Missing copy/accessibility/analytics column: ${column}.`);
      }
    }
  }
  for (const row of requiredCopyAccessibilityAnalyticsRows) {
    if (!hasRequiredRow(copyTable, row)) {
      problems.push(`Missing copy/accessibility/analytics row: ${row}.`);
    }
  }
  problems.push(...invalidCopyAccessibilityAnalyticsCells(copyTable));

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
  const contradictoryLaunchEvidenceCellCount =
    countContradictoryLaunchEvidenceCells(tables);
  if (contradictoryLaunchEvidenceCellCount > 0) {
    problems.push(
      `Run sheet contains ${contradictoryLaunchEvidenceCellCount} filled cell(s) with contradictory or unsafe launch evidence wording; resolve the underlying QA issue before sign-off.`,
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
      "It protects privacy guardrails, environment preflight, canonical flow entry surfaces, fallback paths, sanitized artifact categories, flow/device rows, behavior recovery, rollback, copy/accessibility, analytics, and closeout checks.",
      "Filled result cells must name specific sanitized evidence or behavior; generic pass/done/OK text is rejected.",
      "Filled dated evidence cells must use non-future YYYY-MM-DD dates no older than 7 days.",
      "Filled cells must not include literal personal data or secrets such as street-address-shaped text, email addresses, phone numbers, transcripts, route details, shopping details, provider details, account identifiers, token-bearing URLs, bearer tokens, cookies, passwords, or API keys.",
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
