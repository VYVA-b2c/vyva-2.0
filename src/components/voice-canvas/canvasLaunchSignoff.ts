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
    problems,
  };
}
