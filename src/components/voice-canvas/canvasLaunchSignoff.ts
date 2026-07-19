export const CANVAS_REAL_DEVICE_QA_PENDING_STATUS = "pending execution";
export const CANVAS_REAL_DEVICE_QA_READY_STATUS = "ready for launch";

export const CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES = [
  "Product",
  "Engineering",
  "QA",
  "Operations/rollback owner",
] as const;

export type CanvasRealDeviceQaSignoffRole =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES)[number];

export type CanvasRealDeviceQaMatrixState = "pending" | "ready" | "invalid";

export interface CanvasRealDeviceQaMatrixEvaluation {
  status: string | null;
  state: CanvasRealDeviceQaMatrixState;
  readyForLaunch: boolean;
  incompleteCellCount: number;
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

function parseMarkdownRows(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|\s*-/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map(normalizeCell),
    );
}

function statusFromMarkdown(markdown: string): string | null {
  return (
    markdown.match(/^Status:\s*\*\*([^*]+)\*\*/m)?.[1]?.trim().toLowerCase() ??
    null
  );
}

export function evaluateCanvasRealDeviceQaMatrix(
  markdown: string,
): CanvasRealDeviceQaMatrixEvaluation {
  const status = statusFromMarkdown(markdown);
  const rows = parseMarkdownRows(markdown);
  const dataRows = rows.filter((row) => row.some((cell) => !/^[-:]+$/.test(cell)));
  const incompleteCellCount = dataRows
    .flat()
    .filter((cell) => isPlaceholderCell(cell)).length;

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
    missingRequiredSignoffRoles,
    incompleteRequiredSignoffRoles,
    invalidRequiredSignoffDateRoles,
    unapprovedRequiredSignoffRoles,
    problems,
  };
}
