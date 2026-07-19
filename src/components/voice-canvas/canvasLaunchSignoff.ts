import { canvasLaunchReadinessFlows } from "./canvasLaunchReadiness";

export const CANVAS_REAL_DEVICE_QA_PENDING_STATUS = "pending execution";
export const CANVAS_REAL_DEVICE_QA_READY_STATUS = "ready for launch";

export const CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES = [
  "Product",
  "Engineering",
  "QA",
  "Operations/rollback owner",
] as const;

export const CANVAS_REAL_DEVICE_QA_REQUIRED_ENVIRONMENT_FIELDS = [
  "Environment URL",
  "Build or commit SHA",
  "Test account",
  "Browser versions",
  "Voice provider/session mode",
  "Analytics sink reviewed",
  "Initial flag state",
  "Rollback flag state",
] as const;

export const CANVAS_REAL_DEVICE_QA_REQUIRED_COPY_CHECKS = [
  "English copy uses one clear decision at a time",
  "Spanish copy and long labels remain readable without horizontal overflow",
  "Waiting states explain what is happening and what is not happening",
  "Blocked states explain what is needed and provide retry or exit",
  "Completed states explain the outcome without implying extra action",
  "Keyboard-only completion works for each flow",
  "Focus moves meaningfully when scenes change",
  "Screen-reader announcements fire for waiting, blocked, and completed states",
  "Reduced-motion mode remains calm and usable",
] as const;

export const CANVAS_REAL_DEVICE_QA_REQUIRED_PRIVACY_CLASSES = [
  "Spoken transcripts",
  "Typed free text",
  "Addresses or saved-place labels",
  "Medication names, strengths, quantities, or symptoms",
  "Provider names, reply text, notes, references, phone numbers, or emails",
  "Shopping item names, prices, fees, or retailer names",
  "Dates, times, identities, or contact details",
] as const;

export type CanvasRealDeviceQaSignoffRole =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES)[number];

export type CanvasRealDeviceQaMatrixState = "pending" | "ready" | "invalid";

export interface CanvasRealDeviceQaMatrixEvaluation {
  status: string | null;
  state: CanvasRealDeviceQaMatrixState;
  readyForLaunch: boolean;
  incompleteCellCount: number;
  failingCellCount: number;
  missingRequiredMatrixRows: string[];
  missingRequiredSignoffRoles: CanvasRealDeviceQaSignoffRole[];
  incompleteRequiredSignoffRoles: CanvasRealDeviceQaSignoffRole[];
  invalidRequiredSignoffDateRoles: CanvasRealDeviceQaSignoffRole[];
  unapprovedRequiredSignoffRoles: CanvasRealDeviceQaSignoffRole[];
  problems: string[];
}

function normalizeCell(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlaceholderCell(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    normalized === "" ||
    normalized === "pending" ||
    normalized === "tbd" ||
    normalized === "todo" ||
    normalized === "fixme"
  );
}

function isFailingQaCell(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (isPlaceholderCell(normalized)) return false;
  return /^(fail(ed|ure)?|blocked|unsafe|not ready|not passed|not passing|rejected|hold|no[- ]?go)\b/.test(
    normalized,
  );
}

function isIsoDateCell(value: string): boolean {
  const normalized = normalizeCell(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === normalized
  );
}

function isApprovedLaunchDecisionCell(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (isPlaceholderCell(normalized)) return false;
  if (/\b(not approved|unapproved|rejected|hold|blocked|no[- ]?go)\b/.test(normalized))
    return false;
  return (
    /\bapprove(d)?\b/.test(normalized) ||
    normalized.includes("ready for launch") ||
    normalized === "go" ||
    normalized.startsWith("go ")
  );
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  if (/^\|\s*-/.test(trimmed)) return null;
  return trimmed
    .split("|")
    .slice(1, -1)
    .map(normalizeCell);
}

function parseMarkdownSections(markdown: string): Map<string, string[][]> {
  const sections = new Map<string, string[][]>();
  let currentSection = "";

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      currentSection = normalizeCell(heading[1]);
      if (!sections.has(currentSection)) sections.set(currentSection, []);
      continue;
    }

    const row = parseMarkdownTableRow(line);
    if (!row) continue;
    if (!sections.has(currentSection)) sections.set(currentSection, []);
    sections.get(currentSection)!.push(row);
  }

  return sections;
}

function statusFromMarkdown(markdown: string): string | null {
  return (
    markdown.match(/^Status:\s*\*\*([^*]+)\*\*/m)?.[1]?.trim().toLowerCase() ??
    null
  );
}

function missingRowsInSection(
  sections: Map<string, string[][]>,
  section: string,
  expectedRows: readonly string[],
): string[] {
  const presentRows = new Set((sections.get(section) ?? []).slice(1).map((row) => row[0]));
  return expectedRows
    .filter((row) => !presentRows.has(row))
    .map((row) => `${section}: ${row}`);
}

export function evaluateCanvasRealDeviceQaMatrix(
  markdown: string,
): CanvasRealDeviceQaMatrixEvaluation {
  const status = statusFromMarkdown(markdown);
  const sections = parseMarkdownSections(markdown);
  const rows = [...sections.values()].flat();
  const dataRows = rows.filter((row) => row.some((cell) => !/^[-:]+$/.test(cell)));
  const incompleteCellCount = dataRows
    .flat()
    .filter((cell) => isPlaceholderCell(cell)).length;
  const failingCellCount = dataRows
    .flatMap((row) => row.slice(1))
    .filter((cell) => isFailingQaCell(cell)).length;

  const signoffRows = new Map(
    dataRows.map((row) => [row[0], row.slice(1)] as const),
  );
  const missingRequiredSignoffRoles =
    CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES.filter(
      (role) => !signoffRows.has(role),
    );
  const incompleteRequiredSignoffRoles =
    CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES.filter((role) => {
      const signoff = signoffRows.get(role);
      if (!signoff) return false;
      const [name, date, decision] = signoff;
      return [name, date, decision].some((cell) => isPlaceholderCell(cell ?? ""));
    });
  const invalidRequiredSignoffDateRoles =
    CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES.filter((role) => {
      const signoff = signoffRows.get(role);
      if (!signoff) return false;
      const date = signoff[1] ?? "";
      return !isPlaceholderCell(date) && !isIsoDateCell(date);
    });
  const unapprovedRequiredSignoffRoles =
    CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES.filter((role) => {
      const signoff = signoffRows.get(role);
      if (!signoff) return false;
      const decision = signoff[2] ?? "";
      return (
        !isPlaceholderCell(decision) &&
        !isApprovedLaunchDecisionCell(decision)
      );
    });
  const requiredFlowLabels = canvasLaunchReadinessFlows.map((flow) => flow.label);
  const requiredFeatureFlaggedFlowLabels = canvasLaunchReadinessFlows
    .filter((flow) => flow.featureFlag)
    .map((flow) => flow.label);
  const missingRequiredMatrixRows = [
    ...missingRowsInSection(
      sections,
      "Environment record",
      CANVAS_REAL_DEVICE_QA_REQUIRED_ENVIRONMENT_FIELDS,
    ),
    ...missingRowsInSection(sections, "Device coverage", requiredFlowLabels),
    ...missingRowsInSection(
      sections,
      "Required behavior checklist",
      requiredFlowLabels,
    ),
    ...missingRowsInSection(
      sections,
      "Feature endpoint and rollback checks",
      requiredFeatureFlaggedFlowLabels,
    ),
    ...missingRowsInSection(
      sections,
      "Copy and accessibility read-through",
      CANVAS_REAL_DEVICE_QA_REQUIRED_COPY_CHECKS,
    ),
    ...missingRowsInSection(
      sections,
      "Analytics privacy review",
      CANVAS_REAL_DEVICE_QA_REQUIRED_PRIVACY_CLASSES,
    ),
  ];

  const problems: string[] = [];
  if (!status) {
    problems.push("Missing matrix Status line.");
  } else if (
    status !== CANVAS_REAL_DEVICE_QA_PENDING_STATUS &&
    status !== CANVAS_REAL_DEVICE_QA_READY_STATUS
  ) {
    problems.push(
      `Matrix Status must be "${CANVAS_REAL_DEVICE_QA_PENDING_STATUS}" or "${CANVAS_REAL_DEVICE_QA_READY_STATUS}".`,
    );
  }

  if (status === CANVAS_REAL_DEVICE_QA_READY_STATUS) {
    if (incompleteCellCount > 0) {
      problems.push(
        `Matrix is marked ready but still contains ${incompleteCellCount} incomplete placeholder cell(s).`,
      );
    }
    if (failingCellCount > 0) {
      problems.push(
        `Matrix is marked ready but still contains ${failingCellCount} failing or not-ready QA cell(s).`,
      );
    }
    if (missingRequiredMatrixRows.length > 0) {
      problems.push(
        `Matrix is missing required QA row(s): ${missingRequiredMatrixRows.join(", ")}.`,
      );
    }
    if (missingRequiredSignoffRoles.length > 0) {
      problems.push(
        `Matrix is missing required sign-off role(s): ${missingRequiredSignoffRoles.join(", ")}.`,
      );
    }
    if (incompleteRequiredSignoffRoles.length > 0) {
      problems.push(
        `Matrix has incomplete required sign-off role(s): ${incompleteRequiredSignoffRoles.join(", ")}.`,
      );
    }
    if (invalidRequiredSignoffDateRoles.length > 0) {
      problems.push(
        `Matrix has required sign-off date(s) that must use YYYY-MM-DD: ${invalidRequiredSignoffDateRoles.join(", ")}.`,
      );
    }
    if (unapprovedRequiredSignoffRoles.length > 0) {
      problems.push(
        `Matrix has required sign-off role(s) without an approved-for-launch decision: ${unapprovedRequiredSignoffRoles.join(", ")}.`,
      );
    }
  }

  const readyForLaunch =
    status === CANVAS_REAL_DEVICE_QA_READY_STATUS && problems.length === 0;
  const state: CanvasRealDeviceQaMatrixState = readyForLaunch
    ? "ready"
    : status === CANVAS_REAL_DEVICE_QA_PENDING_STATUS
      ? "pending"
      : "invalid";

  return {
    status,
    state,
    readyForLaunch,
    incompleteCellCount,
    failingCellCount,
    missingRequiredMatrixRows,
    missingRequiredSignoffRoles,
    incompleteRequiredSignoffRoles,
    invalidRequiredSignoffDateRoles,
    unapprovedRequiredSignoffRoles,
    problems,
  };
}
