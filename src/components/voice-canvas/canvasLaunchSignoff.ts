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

export type CanvasRealDeviceQaEnvironmentField =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_ENVIRONMENT_FIELDS)[number];

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

export type CanvasRealDeviceQaCopyAccessibilityCheck =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_COPY_CHECKS)[number];

export const CANVAS_REAL_DEVICE_QA_REQUIRED_ANALYTICS_SIGNALS = [
  "Started",
  "Resumed",
  "Abandoned",
  "Blocked",
  "Confirmed",
  "Completed",
] as const;

export type CanvasRealDeviceQaAnalyticsSignal =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_ANALYTICS_SIGNALS)[number];

export const CANVAS_REAL_DEVICE_QA_REQUIRED_PRIVACY_CLASSES = [
  "Spoken transcripts",
  "Typed free text",
  "Addresses or saved-place labels",
  "Ride pickup, dropoff, destination, or route details",
  "Medication names, strengths, quantities, or symptoms",
  "Provider names, reply text, notes, references, phone numbers, or emails",
  "Shopping item names, prices, fees, or retailer names",
  "Dates, times, identities, or contact details",
] as const;

export type CanvasRealDeviceQaPrivacyClass =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_PRIVACY_CLASSES)[number];

export type CanvasRealDeviceQaSignoffRole =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES)[number];

export const CANVAS_REAL_DEVICE_QA_REQUIRED_TASK_HUB_DESTINATION_ROWS = [
  "Local shopping draft",
  "Local medication refill draft",
  "Pending provider reply task",
  "Stale or blocked task",
] as const;

export type CanvasRealDeviceQaTaskHubDestinationRow =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_TASK_HUB_DESTINATION_ROWS)[number];

export const CANVAS_REAL_DEVICE_QA_REQUIRED_ARTIFACT_INVENTORY_ROWS = [
  "Environment and flag artifacts",
  "Real-device screenshots or photos",
  "Interaction recordings or logs",
  "Behavior recovery artifacts",
  "Feature endpoint artifacts",
  "Task hub resume artifacts",
  "Copy and accessibility artifacts",
  "Analytics signal artifacts",
  "Analytics privacy artifacts",
  "Run sheet validation artifacts",
  "Launch preflight artifacts",
] as const;

export type CanvasRealDeviceQaArtifactInventoryRow =
  (typeof CANVAS_REAL_DEVICE_QA_REQUIRED_ARTIFACT_INVENTORY_ROWS)[number];

export type CanvasRealDeviceQaMatrixState = "pending" | "ready" | "invalid";
const CANVAS_REAL_DEVICE_QA_MAX_EVIDENCE_AGE_DAYS = 7;

export interface CanvasRealDeviceQaMatrixEvaluation {
  status: string | null;
  state: CanvasRealDeviceQaMatrixState;
  readyForLaunch: boolean;
  incompleteCellCount: number;
  failingCellCount: number;
  missingRequiredMatrixRows: string[];
  invalidEnvironmentFields: string[];
  invalidDeviceCoverageRows: string[];
  invalidInteractionModeRows: string[];
  invalidBehaviorRows: string[];
  invalidFeatureFlagRows: string[];
  invalidTaskHubDestinationRows: string[];
  invalidCopyAccessibilityRows: string[];
  invalidAnalyticsSignalRows: string[];
  invalidPrivacyRows: string[];
  invalidArtifactInventoryRows: string[];
  missingRequiredSignoffRoles: CanvasRealDeviceQaSignoffRole[];
  incompleteRequiredSignoffRoles: CanvasRealDeviceQaSignoffRole[];
  invalidRequiredSignoffDateRoles: CanvasRealDeviceQaSignoffRole[];
  unapprovedRequiredSignoffRoles: CanvasRealDeviceQaSignoffRole[];
  blockedRequiredSignoffNoteRoles: CanvasRealDeviceQaSignoffRole[];
  invalidRequiredSignoffNoteRoles: CanvasRealDeviceQaSignoffRole[];
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
  if (
    /^blocked[- ]?(copy|state|states|scene)\b/.test(normalized) &&
    /\b(explain|explains|verified|offers|provides|retry|exit|evidence)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  if (
    /^(blocked aggregate signal|blocked launch signal|blocked signal|failed or urgent_help_shown|failed, urgent_help_shown)\b/.test(
      normalized,
    ) &&
    /\b(signal|count|observed|verified|source event|scene view|urgent_help_shown)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
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

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoDateToUtcMs(value: string): number {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

function isNonFutureIsoDateCell(value: string): boolean {
  const normalized = normalizeCell(value);
  return isIsoDateCell(normalized) && normalized <= todayIsoDate();
}

function isFreshNonFutureIsoDateCell(value: string): boolean {
  const normalized = normalizeCell(value);
  if (!isNonFutureIsoDateCell(normalized)) return false;
  const maxAgeMs = CANVAS_REAL_DEVICE_QA_MAX_EVIDENCE_AGE_DAYS * 24 * 60 * 60 * 1000;
  return isoDateToUtcMs(todayIsoDate()) - isoDateToUtcMs(normalized) <= maxAgeMs;
}

function isApprovedLaunchDecisionCell(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (isPlaceholderCell(normalized)) return false;
  if (/\b(not approved|unapproved|rejected|hold|blocked|no[- ]?go)\b/.test(normalized))
    return false;
  if (
    /\b(if|when|once|after|pending|contingent|conditional(?:ly)?|conditioned|provided|assuming|unless|except|needs?|requires?|required|todo|fix(?:es|ed)?|follow[- ]?up|blocker)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  return (
    /\bapprove(d)?\b/.test(normalized) ||
    normalized.includes("ready for launch") ||
    normalized === "go" ||
    normalized.startsWith("go ")
  );
}

function hasBlockedLaunchSignoffNoteLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (isPlaceholderCell(normalized)) return false;
  return (
    /\b(not ready|not approved|unapproved|rejected|hold|blocked|no[- ]?go|blocker|launch blocker)\b/.test(
      normalized,
    ) ||
    /\b(if|when|once|after|pending|contingent|conditional(?:ly)?|conditioned|provided|assuming|unless|except)\b/.test(
      normalized,
    ) ||
    /\b(needs?|requires?|required|todo|fix(?:es|ed)?|follow[- ]?up|retest|rerun|re-run|waiting|open issue|open bug)\b/.test(
      normalized,
    )
  );
}

const launchSignoffRoleNoteRequirements: Record<
  CanvasRealDeviceQaSignoffRole,
  readonly (readonly string[])[]
> = {
  Product: [
    ["real-use", "real use"],
    ["senior", "copy"],
    ["what happens next", "next"],
    ["privacy", "analytics"],
  ],
  Engineering: [
    ["rollback"],
    ["stale", "duplicate"],
    ["guard", "guards"],
    ["feature flag", "fallback"],
  ],
  QA: [
    ["qa"],
    ["real-device", "real device", "device"],
    ["matrix"],
    ["voice", "touch", "keyboard"],
  ],
  "Operations/rollback owner": [
    ["rollback"],
    ["owner"],
    ["disable", "disabled", "rollout 0", "0%"],
    ["fallback"],
  ],
};

function hasMeaningfulLaunchSignoffNoteLanguage(
  role: CanvasRealDeviceQaSignoffRole,
  value: string,
): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (isPlaceholderCell(normalized)) return false;
  if (
    /^(n\/?a|none|no notes?|ok|okay|approved|looks good|good|done|complete|-|—)$/.test(
      normalized,
    )
  ) {
    return false;
  }

  return hasAllWordGroups(normalized, [
    [
      "reviewed",
      "verified",
      "confirmed",
      "complete",
      "completed",
      "validated",
      "signed off",
      "sign-off",
    ],
    [
      "real-use",
      "real use",
      "device",
      "matrix",
      "evidence",
      "rollback",
      "stale",
      "guard",
      "analytics",
      "privacy",
      "feature flag",
      "fallback",
      "qa",
      "launch",
    ],
  ]) && hasAllWordGroups(normalized, launchSignoffRoleNoteRequirements[role]);
}

function isDeployedEnvironmentUrl(value: string): boolean {
  try {
    const url = new URL(normalizeCell(value));
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return !(
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^127(?:\.\d{1,3}){3}$/.test(host) ||
      /^10(?:\.\d{1,3}){3}$/.test(host) ||
      /^192\.168(?:\.\d{1,3}){2}$/.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host) ||
      host.endsWith(".local") ||
      host.endsWith(".localhost") ||
      host.endsWith(".test") ||
      host.endsWith(".example") ||
      host === "example.com" ||
      host.endsWith(".example.com") ||
      host.includes("mock")
    );
  } catch {
    return false;
  }
}

function isMeaningfulEnvironmentValue(
  field: CanvasRealDeviceQaEnvironmentField,
  value: string,
): boolean {
  const normalized = normalizeCell(value);
  const lower = normalized.toLowerCase();
  if (
    isPlaceholderCell(normalized) ||
    isFailingQaCell(normalized) ||
    hasNegativeEnvironmentValueLanguage(normalized)
  ) {
    return false;
  }

  switch (field) {
    case "Environment URL":
      return isDeployedEnvironmentUrl(normalized);
    case "Build or commit SHA":
      return /\b[0-9a-f]{7,40}\b/i.test(normalized);
    case "Test account":
      return !/^passed\b/i.test(normalized) && normalized.length >= 4;
    case "Browser versions":
      return (
        /\b(chrome|safari|firefox|edge|ios|android)\b/i.test(normalized) &&
        /\d/.test(normalized)
      );
    case "Voice provider/session mode":
      return (
        /\b(voice|session|provider|browser|live|staging|production|deployed)\b/i.test(
          normalized,
        ) && !/\b(mock|stub|fake|simulated|local)\b/i.test(normalized)
      );
    case "Analytics sink reviewed":
      return (
        /\breview(ed)?\b/i.test(normalized) &&
        hasFreshNonFutureIsoDateCellFromText(normalized) &&
        !hasFutureIsoDateCellFromText(normalized) &&
        hasConcreteEnvironmentArtifactLanguage(normalized) &&
        !hasNegativeEvidenceLanguage(normalized)
      );
    case "Initial flag state":
      return (
        hasAllWordGroups(lower, [
          ["enabled", "enable"],
          ["true", "enabled true", "enabled: true", "enabled=true"],
          [
            "rollout 100",
            "rollout: 100",
            "rollout=100",
            "rollout percent 100",
            "rollout percent: 100",
            "rollout percent=100",
            "rolloutpercent 100",
            "rolloutpercent: 100",
            "rolloutpercent=100",
            "100%",
          ],
        ]) &&
        hasFreshNonFutureIsoDateCellFromText(normalized) &&
        !hasFutureIsoDateCellFromText(normalized) &&
        hasConcreteEnvironmentArtifactLanguage(normalized)
      );
    case "Rollback flag state":
      return (
        hasAllWordGroups(lower, [
          ["disabled", "disable"],
          ["false", "enabled false", "enabled: false", "enabled=false"],
          [
            "rollout 0",
            "rollout: 0",
            "rollout=0",
            "rollout percent 0",
            "rollout percent: 0",
            "rollout percent=0",
            "rolloutpercent 0",
            "rolloutpercent: 0",
            "rolloutpercent=0",
            "0%",
          ],
        ]) &&
        hasFreshNonFutureIsoDateCellFromText(normalized) &&
        !hasFutureIsoDateCellFromText(normalized) &&
        hasConcreteEnvironmentArtifactLanguage(normalized)
      );
  }
}

function hasConcreteEnvironmentArtifactLanguage(value: string): boolean {
  return hasAnyWord(value, [
    "artifact",
    "artifacts",
    "dashboard",
    "query",
    "queries",
    "log",
    "logs",
    "trace",
    "traces",
    "screenshot",
    "screen shot",
    "capture",
    "captures",
    "link",
  ]);
}

function hasNegativeEnvironmentValueLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    /\bnot (available|ready|deployed|reachable|returned|enabled|disabled|reviewed|verified|working|live)\b/.test(
      normalized,
    ) ||
    /\bdid not (deploy|return|review|verify|enable|disable|work)\b/.test(
      normalized,
    ) ||
    /\b(?:unable|failed|fails|could not) to (deploy|return|review|verify|enable|disable|work|reach|connect)\b/.test(
      normalized,
    ) ||
    /\b(missing|unavailable|not available|not reachable|not returned|not reviewed|not verified|not working|unreviewed|unverified)\b/.test(
      normalized,
    ) ||
    /\b(test account|account|browser|voice|session|provider|environment|url|commit|build|analytics|sink|flag|rollout|payload)\b.{0,32}\b(missing|unavailable|not available|not reachable|not returned|not reviewed|not verified|not working|unreviewed|unverified)\b/.test(
      normalized,
    ) ||
    /\b(missing|unavailable|not available|not reachable|not returned|not reviewed|not verified|not working|unreviewed|unverified)\b.{0,32}\b(test account|account|browser|voice|session|provider|environment|url|commit|build|analytics|sink|flag|rollout|payload)\b/.test(
      normalized,
    )
  );
}

function isIsoDateCellFromText(value: string): boolean {
  return (normalizeCell(value).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).some(
    isIsoDateCell,
  );
}

function hasNonFutureIsoDateCellFromText(value: string): boolean {
  return (normalizeCell(value).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).some(
    isNonFutureIsoDateCell,
  );
}

function hasFreshNonFutureIsoDateCellFromText(value: string): boolean {
  return (normalizeCell(value).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).some(
    isFreshNonFutureIsoDateCell,
  );
}

function hasFutureIsoDateCellFromText(value: string): boolean {
  const today = todayIsoDate();
  return (normalizeCell(value).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).some(
    (date) => isIsoDateCell(date) && date > today,
  );
}

function hasAnyWord(value: string, words: readonly string[]): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function hasAllWordGroups(
  value: string,
  wordGroups: readonly (readonly string[])[],
): boolean {
  return wordGroups.every((words) => hasAnyWord(value, words));
}

function hasDatedEvidenceLanguage(
  value: string,
  evidenceWords: readonly string[] = [
    "evidence",
    "screenshot",
    "log",
    "trace",
    "recording",
    "reviewed",
  ],
): boolean {
  return (
    hasFreshNonFutureIsoDateCellFromText(normalizeCell(value)) &&
    !hasFutureIsoDateCellFromText(normalizeCell(value)) &&
    !hasNegativeEvidenceLanguage(value) &&
    hasAnyWord(value, evidenceWords) &&
    hasAnyWord(value, ["qa", "reviewer", "reviewed", "captured", "verified"])
  );
}

function hasNegativeEvidenceLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return /\b(no evidence|without evidence|missing evidence|evidence missing|not reviewed|not captured|not verified|not tested|not run|not executed|not checked|unable to review|unable to verify|could not review|could not verify|unreviewed|unverified|untested)\b/.test(
    normalized,
  );
}

function hasNegativeInteractionOutcomeLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return /\b(not completed|not complete|did not complete|failed to complete|unable to complete|could not complete|not safely exited|not safe exit|not exited safely|not tested|not run|not executed|untested)\b/.test(
    normalized,
  );
}

function hasNegativeBehaviorOutcomeLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    /\bnot (restored|preserved|recovered|returned|available|visible|offered|provided|prevented|blocked|ignored|rejected|discarded|readable|legible|calm|usable)\b/.test(
      normalized,
    ) ||
    /\bdid not (restore|preserve|recover|return|offer|provide|prevent|block|ignore|reject|discard|explain)\b/.test(
      normalized,
    ) ||
    /\b(?:unable|failed|fails|could not) to (restore|preserve|recover|return|offer|provide|prevent|block|ignore|reject|discard|explain)\b/.test(
      normalized,
    ) ||
    /\b(no retry|no exit|no fallback)\b/.test(normalized) ||
    /\b(external action|write|booking|call|message|navigation)s?\b.{0,24}\b(happened|occurred|sent|submitted|triggered|fired|ran)\b/.test(
      normalized,
    )
  );
}

function hasNegativeCopyAccessibilityOutcomeLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    /\bnot (announced|verified|readable|legible|usable|calm|working|focused|moved|explained|provided|offered|completed)\b/.test(
      normalized,
    ) ||
    /\bdid not (announce|fire|verify|work|focus|move|explain|provide|offer|complete)\b/.test(
      normalized,
    ) ||
    /\bdoes not (announce|fire|verify|work|focus|move|explain|provide|offer|complete|remain)\b/.test(
      normalized,
    ) ||
    /\b(?:unable|failed|fails|could not) to (announce|fire|verify|work|focus|move|explain|provide|offer|complete|remain)\b/.test(
      normalized,
    ) ||
    /\b(no announcement|no announcements|no retry|no exit|no focus|no focus movement|missing announcement|missing announcements|missing focus|missing retry|missing exit|unavailable|overflowed|overflowing|clipped|truncated|unreadable|illegible|unusable|uncalm)\b/.test(
      normalized,
    ) ||
    /\b(announcement|announcements|focus|retry|exit)\b.{0,16}\b(missing|unavailable)\b/.test(
      normalized,
    )
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

function invalidEnvironmentRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Environment record") ?? []).slice(1).map((row) => [row[0], row[1] ?? ""]),
  );

  return CANVAS_REAL_DEVICE_QA_REQUIRED_ENVIRONMENT_FIELDS.filter((field) => {
    const value = rows.get(field);
    return (
      value !== undefined &&
      !isPlaceholderCell(value) &&
      !isMeaningfulEnvironmentValue(field, value)
    );
  });
}

const deviceCoverageRequirements = [
  {
    columnIndex: 1,
    description: "phone cell must name real physical phone or mobile evidence",
    wordGroups: [
      ["phone", "mobile", "iphone", "ios", "android"],
      ["real", "physical", "actual", "hardware", "device"],
    ],
  },
  {
    columnIndex: 2,
    description: "tablet cell must name real physical tablet evidence",
    wordGroups: [
      ["tablet", "ipad", "android tablet"],
      ["real", "physical", "actual", "hardware", "device"],
    ],
  },
  {
    columnIndex: 3,
    description: "desktop/laptop cell must name real desktop or laptop evidence",
    wordGroups: [
      ["desktop", "laptop", "windows", "mac", "chrome", "edge", "firefox"],
      ["real", "physical", "actual", "hardware", "device"],
    ],
  },
] as const;

function hasEmulatedDeviceEvidenceLanguage(value: string): boolean {
  return hasAnyWord(value, [
    "browser emulation",
    "device emulation",
    "emulated",
    "emulator",
    "simulated device",
    "simulator",
    "viewport",
    "responsive mode",
    "device toolbar",
    "devtools",
  ]);
}

function hasNegativeDeviceCoverageLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    hasNegativeEvidenceLanguage(normalized) ||
    /\b(not|no|without)\s+(?:a\s+|an\s+)?(?:real|physical|actual|hardware)\b/.test(
      normalized,
    ) ||
    /\bnot\s+(?:a\s+|an\s+)?(?:phone|mobile|tablet|ipad|desktop|laptop|device)\b/.test(
      normalized,
    ) ||
    /\b(real|physical|actual|hardware|phone|mobile|tablet|ipad|desktop|laptop|device)\b.{0,30}\b(not available|unavailable|missing|absent)\b/.test(
      normalized,
    ) ||
    /\b(?:did not|does not|doesn't|cannot|can't)\s+(?:load|render|open|work|display|run|complete)\b/.test(
      normalized,
    ) ||
    /\b(?:failed|fails|unable|could not|couldn't)\s+to\s+(?:load|render|open|work|display|run|test|verify|use|complete)\b/.test(
      normalized,
    ) ||
    /\bnot\s+(?:usable|working|loading|rendering|displaying)\b/.test(
      normalized,
    ) ||
    /\b(?:unusable|not usable|not working|broken|crashed|crashing)\b/.test(
      normalized,
    ) ||
    /\b(?:phone|mobile|tablet|ipad|desktop|laptop|device|browser|canvas|page|screen|flow|safari|chrome|edge|firefox)\s+crashes\b/.test(
      normalized,
    ) ||
    (/\b(?:blank|white)\s+screen\b|\bscreen\s+(?:blank|white)\b/.test(
      normalized,
    ) &&
      !/\b(?:no|without)\s+(?:blank|white)\s+screen\b/.test(normalized))
  );
}

function hasDeviceCoverageEvidenceLanguage(value: string): boolean {
  return (
    hasDatedEvidenceLanguage(value, ["qa", "reviewer", "evidence", "screenshot", "log"]) &&
    hasConcreteEvidenceArtifactLanguage(value) &&
    hasAllWordGroups(value, [
      ["real", "physical", "actual", "hardware", "device"],
      ["phone", "mobile", "iphone", "ios", "android"],
      ["tablet", "ipad", "android tablet"],
      ["desktop", "laptop", "windows", "mac", "chrome", "edge", "firefox"],
    ])
  );
}

function hasConcreteEvidenceArtifactLanguage(value: string): boolean {
  return hasAnyWord(value, [
    "log",
    "logs",
    "trace",
    "traces",
    "screenshot",
    "screen shot",
    "photo",
    "image",
    "recording",
    "video",
    "network capture",
    "endpoint capture",
    "payload capture",
    "artifact",
    "artifacts",
    "link",
    "url",
  ]);
}

function invalidDeviceCoverageRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Device coverage") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const flow of canvasLaunchReadinessFlows) {
    const row = rows.get(flow.label);
    if (!row) continue;

    for (const requirement of deviceCoverageRequirements) {
      const cell = row[requirement.columnIndex] ?? "";
      if (isPlaceholderCell(cell) || isFailingQaCell(cell)) continue;
      if (
        !hasAllWordGroups(cell, requirement.wordGroups) ||
        hasNegativeDeviceCoverageLanguage(cell)
      ) {
        problems.push(`${flow.label}: ${requirement.description}`);
      } else if (hasEmulatedDeviceEvidenceLanguage(cell)) {
        problems.push(
          `${flow.label}: ${requirement.description} and must not be viewport or emulator evidence`,
        );
      }
    }

    const evidence = row[4] ?? "";
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      (!hasDeviceCoverageEvidenceLanguage(evidence) ||
        hasNegativeDeviceCoverageLanguage(evidence))
    ) {
      problems.push(
        `${flow.label}: evidence must include dated real phone, tablet, and desktop/laptop screenshot/photo artifact evidence`,
      );
    } else if (hasEmulatedDeviceEvidenceLanguage(evidence)) {
      problems.push(`${flow.label}: evidence must not rely on viewport or emulator evidence`);
    }
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      hasSensitiveDataLeakageLanguage(evidence)
    ) {
      problems.push(
        `${flow.label}: device evidence artifacts must not include transcripts, entered text, addresses, or personal details`,
      );
    }
  }

  return problems;
}

const interactionOutcomeWordGroups = [
  [
    "completed",
    "completion",
    "complete flow",
    "completed flow",
    "safely exited",
    "safe exit",
    "exited safely",
    "cancelled safely",
    "canceled safely",
  ],
] as const;

const interactionModeRequirements = [
  {
    columnIndex: 1,
    description:
      "voice cell must mention voice or spoken-command evidence and completion or safe exit",
    wordGroups: [
      ["voice", "spoken", "speech", "dictation"],
      ...interactionOutcomeWordGroups,
    ],
  },
  {
    columnIndex: 2,
    description:
      "touch cell must mention touch or tap evidence and completion or safe exit",
    wordGroups: [
      ["touch", "tap", "tapped"],
      ...interactionOutcomeWordGroups,
    ],
  },
  {
    columnIndex: 3,
    description:
      "keyboard cell must mention keyboard navigation evidence and completion or safe exit",
    wordGroups: [
      ["keyboard", "tab", "enter"],
      ...interactionOutcomeWordGroups,
    ],
  },
] as const;

function invalidInteractionModeRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Interaction mode coverage") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const flow of canvasLaunchReadinessFlows) {
    const row = rows.get(flow.label);
    if (!row) continue;

    for (const requirement of interactionModeRequirements) {
      const cell = row[requirement.columnIndex] ?? "";
      if (isPlaceholderCell(cell) || isFailingQaCell(cell)) continue;
      if (
        !hasAllWordGroups(cell, requirement.wordGroups) ||
        hasNegativeInteractionOutcomeLanguage(cell)
      ) {
        problems.push(`${flow.label}: ${requirement.description}`);
      }
    }

    const evidence = row[4] ?? "";
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      (!hasInteractionModeEvidenceLanguage(evidence) ||
        hasNegativeInteractionOutcomeLanguage(evidence))
    ) {
      problems.push(
        `${flow.label}: interaction-mode evidence must include dated voice, touch, and keyboard completion or safe-exit artifact evidence`,
      );
    }
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      hasSensitiveDataLeakageLanguage(evidence)
    ) {
      problems.push(
        `${flow.label}: interaction-mode evidence artifacts must not include transcripts, entered text, addresses, or personal details`,
      );
    }
  }

  return problems;
}

function hasInteractionModeEvidenceLanguage(value: string): boolean {
  return (
    hasDatedEvidenceLanguage(value, ["qa", "reviewer", "evidence", "screenshot", "log"]) &&
    hasConcreteEvidenceArtifactLanguage(value) &&
    hasAllWordGroups(value, [
      ["voice", "spoken"],
      ["touch", "tap"],
      ["keyboard", "tab", "enter"],
      ...interactionOutcomeWordGroups,
    ])
  );
}

const explicitNoWriteEvidenceWords = [
  "no write",
  "no writes",
  "no-write",
  "without write",
  "without a write",
  "without any write",
  "without writes",
  "without any writes",
] as const;

const explicitNoExternalActionEvidenceWords = [
  "no external action",
  "no external actions",
  "no-external-action",
  "without external action",
  "without an external action",
  "without any external action",
  "without external actions",
  "without any external actions",
  "without a write, resubmission, or external action",
  "without write, resubmission, or external action",
  "without writes, resubmissions, or external actions",
] as const;

const explicitNoResubmissionEvidenceWords = [
  "no resubmission",
  "no resubmissions",
  "no-resubmission",
  "without resubmission",
  "without a resubmission",
  "without any resubmission",
  "without resubmissions",
  "without any resubmissions",
  "without a write, resubmission",
  "without write, resubmission",
  "without writes, resubmissions",
  "not resubmitted",
  "not automatically resubmitted",
  "not auto-resubmitted",
] as const;

const enteredInformationPreservationWords = [
  "entered information",
  "entered info",
  "entered details",
  "entered values",
  "entered inputs",
  "user input",
  "user inputs",
  "input preserved",
  "inputs preserved",
  "details preserved",
  "information preserved",
  "draft details",
  "draft contents",
  "current details",
  "selected choices",
  "partial details",
] as const;

const duplicateStaleGuardDescription =
  "duplicate/stale guard cell must mention duplicate prevention and stale response ignoring";

function hasDuplicateAttemptHandlingLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    /\b(no duplicate|without duplicate)\b/.test(normalized) ||
    /\bduplicate(?: confirmation| action| attempt| attempts| submission| submissions)?\b.{0,24}\b(prevented|blocked|ignored|rejected|discarded)\b/.test(
      normalized,
    ) ||
    /\b(prevented|blocked|ignored|rejected|discarded)\b.{0,24}\bduplicate(?: confirmation| action| attempt| attempts| submission| submissions)?\b/.test(
      normalized,
    )
  );
}

function hasStaleResponseHandlingLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    /\bstale(?: response| responses)?\b.{0,36}\b(ignored|rejected|discarded|not accepted)\b/.test(
      normalized,
    ) ||
    /\b(ignored|rejected|discarded|not accepted)\b.{0,36}\bstale(?: response| responses)?\b/.test(
      normalized,
    )
  );
}

const behaviorChecklistRequirements = [
  {
    columnIndex: 1,
    description:
      "start/resume cell must mention start, resumed work, entered information preservation, no write, and no resubmission evidence",
    wordGroups: [
      ["start", "started"],
      ["resume", "resumed", "restore", "restored"],
      ["preserve", "preserved", "restore", "restored", "same scene", "current scene", "draft"],
      enteredInformationPreservationWords,
      explicitNoWriteEvidenceWords,
      explicitNoResubmissionEvidenceWords,
      explicitNoExternalActionEvidenceWords,
    ],
  },
  {
    columnIndex: 2,
    description:
      "app exit/reopen cell must mention app exit/reopen, restored draft, entered information preservation, no write, and no resubmission evidence",
    wordGroups: [
      ["app exit", "exit app", "app close", "close app", "leave app"],
      ["reopen", "reopened", "return", "returned"],
      ["restore", "restored", "resume", "resumed", "draft"],
      enteredInformationPreservationWords,
      explicitNoWriteEvidenceWords,
      explicitNoResubmissionEvidenceWords,
      explicitNoExternalActionEvidenceWords,
    ],
  },
  {
    columnIndex: 3,
    description:
      "refresh/reconnect cell must mention refresh, reconnect, restored work, entered information preservation, no write, and no resubmission evidence",
    wordGroups: [
      ["refresh"],
      ["reconnect", "reconnected", "network"],
      ["preserve", "preserved", "restore", "restored", "resume", "resumed", "draft"],
      enteredInformationPreservationWords,
      explicitNoWriteEvidenceWords,
      explicitNoResubmissionEvidenceWords,
      explicitNoExternalActionEvidenceWords,
    ],
  },
  {
    columnIndex: 4,
    description:
      "voice interruption cell must mention interruption recovery, preserved work, entered information preservation, no write, and no resubmission evidence",
    wordGroups: [
      ["interruption", "interrupted", "interrupt"],
      ["recover", "recovery", "resume", "continued", "restored"],
      ["preserve", "preserved", "restore", "restored", "same scene", "current scene", "draft"],
      enteredInformationPreservationWords,
      explicitNoWriteEvidenceWords,
      explicitNoResubmissionEvidenceWords,
      explicitNoExternalActionEvidenceWords,
    ],
  },
  {
    columnIndex: 5,
    description:
      "browser back cell must mention safe back navigation with preserved entered information and no write",
    wordGroups: [
      ["back"],
      ["preserve", "preserved", "restore", "restored", "return", "returned"],
      enteredInformationPreservationWords,
      explicitNoWriteEvidenceWords,
      explicitNoExternalActionEvidenceWords,
    ],
  },
  {
    columnIndex: 6,
    description: "cancel/exit cell must mention cancel, exit, and no write evidence",
    wordGroups: [
      ["cancel"],
      ["exit", "leave"],
      explicitNoWriteEvidenceWords,
      explicitNoExternalActionEvidenceWords,
    ],
  },
  {
    columnIndex: 7,
    description:
      "flag rollback/fallback cell must mention open-session flag rollback, Canvas closure, existing fallback, and no write evidence",
    wordGroups: [
      ["flag"],
      ["rollback"],
      ["in-session", "in session", "open session", "during session", "focus", "refresh"],
      ["canvas"],
      ["closed", "closes", "disappeared", "disappears", "hidden", "removed", "dismissed"],
      ["fallback"],
      ["existing", "previous", "old", "safe concierge"],
      explicitNoWriteEvidenceWords,
      explicitNoExternalActionEvidenceWords,
    ],
  },
  {
    columnIndex: 8,
    description:
      "confirmation safety cell must mention no external action, write, booking, call, message, and navigation before explicit confirmation",
    wordGroups: [
      explicitNoExternalActionEvidenceWords,
      explicitNoWriteEvidenceWords,
      [
        "no booking",
        "no bookings",
        "without booking",
        "without bookings",
        "not booked",
      ],
      [
        "no call",
        "no calls",
        "without call",
        "without calls",
        "not called",
      ],
      [
        "no message",
        "no messages",
        "without message",
        "without messages",
        "not messaged",
      ],
      [
        "no navigation",
        "without navigation",
        "did not navigate",
        "not navigated",
        "not routed",
      ],
      ["before"],
      ["explicit confirmation", "confirmation"],
    ],
  },
  {
    columnIndex: 10,
    description:
      "recoverable failure retry cell must mention recoverable failure, retry, exit, entered information preservation, no write, and no resubmission evidence",
    wordGroups: [
      ["recoverable"],
      ["failure", "failed", "blocked"],
      ["retry"],
      ["exit", "cancel"],
      enteredInformationPreservationWords,
      explicitNoWriteEvidenceWords,
      explicitNoResubmissionEvidenceWords,
      explicitNoExternalActionEvidenceWords,
    ],
  },
  {
    columnIndex: 11,
    description:
      "senior-friendly copy cell must mention senior copy, one clear decision, readable labels, and what happens next",
    wordGroups: [
      ["senior"],
      ["copy"],
      ["one clear decision", "single decision", "one decision"],
      ["readable", "legible"],
      ["label", "labels", "touch target", "touch targets"],
      ["what happens next", "next"],
    ],
  },
  {
    columnIndex: 12,
    description:
      "privacy-safe analytics cell must mention aggregate analytics and no sensitive data evidence",
    wordGroups: [
      ["privacy"],
      ["analytics", "telemetry"],
      ["aggregate", "count", "signal"],
      [
        "no sensitive",
        "without sensitive",
        "not recorded",
        "forbidden absent",
        "only allowed envelope",
        "allowed envelope",
      ],
    ],
  },
] as const;

const behaviorEvidenceWordGroups = [
  ["start"],
  ["resume", "resumed"],
  ["app exit", "exit app", "app close", "close app", "leave app"],
  ["reopen", "reopened", "return", "returned"],
  ["refresh"],
  ["reconnect", "reconnected", "network"],
  ["interruption", "interrupted", "interrupt"],
  ["browser back", "back"],
  ["cancel"],
  ["exit"],
  ["flag"],
  ["rollback"],
  ["confirmation"],
  ["duplicate"],
  ["stale"],
  ["recoverable"],
  ["retry"],
  ["senior"],
  ["one clear decision", "single decision", "one decision"],
  ["readable", "legible"],
  ["label", "labels", "touch target", "touch targets"],
  ["what happens next", "next"],
  ["privacy"],
  ["aggregate", "count", "signal"],
  explicitNoWriteEvidenceWords,
  explicitNoResubmissionEvidenceWords,
  explicitNoExternalActionEvidenceWords,
  ["no booking", "without booking", "not booked"],
  ["no call", "without call", "not called"],
  ["no message", "without message", "not messaged"],
  ["no navigation", "without navigation", "not navigated"],
] as const;

function hasBehaviorEvidenceLanguage(value: string): boolean {
  return (
    hasDatedEvidenceLanguage(value, ["qa", "reviewer", "evidence", "screenshot", "log"]) &&
    hasConcreteEvidenceArtifactLanguage(value) &&
    hasAllWordGroups(value, behaviorEvidenceWordGroups)
  );
}

function invalidBehaviorRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Required behavior checklist") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const flow of canvasLaunchReadinessFlows) {
    const row = rows.get(flow.label);
    if (!row) continue;

    for (const requirement of behaviorChecklistRequirements) {
      const cell = row[requirement.columnIndex] ?? "";
      if (isPlaceholderCell(cell) || isFailingQaCell(cell)) continue;
      if (
        !hasAllWordGroups(cell, requirement.wordGroups) ||
        hasNegativeBehaviorOutcomeLanguage(cell)
      ) {
        problems.push(`${flow.label}: ${requirement.description}`);
      }
    }

    const duplicateStaleGuard = row[9] ?? "";
    if (
      !isPlaceholderCell(duplicateStaleGuard) &&
      !isFailingQaCell(duplicateStaleGuard) &&
      (!hasDuplicateAttemptHandlingLanguage(duplicateStaleGuard) ||
        !hasStaleResponseHandlingLanguage(duplicateStaleGuard) ||
        hasNegativeBehaviorOutcomeLanguage(duplicateStaleGuard))
    ) {
      problems.push(`${flow.label}: ${duplicateStaleGuardDescription}`);
    }

    const evidence = row[13] ?? "";
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      (!hasBehaviorEvidenceLanguage(evidence) ||
        hasNegativeBehaviorOutcomeLanguage(evidence))
    ) {
      problems.push(
        `${flow.label}: behavior evidence must include dated artifact coverage for resume, recovery, rollback, confirmation safety, senior copy, privacy, and no side effects`,
      );
    }
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      hasSensitiveDataLeakageLanguage(evidence)
    ) {
      problems.push(
        `${flow.label}: behavior evidence artifacts must not include transcripts, entered text, addresses, or personal details`,
      );
    }
  }

  return problems;
}

function invalidFeatureFlagRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Feature endpoint and rollback checks") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const flow of canvasLaunchReadinessFlows.filter((candidate) => candidate.featureFlag)) {
    const featureFlag = flow.featureFlag!;
    const row = rows.get(flow.label);
    if (!row) continue;

    const [
      ,
      endpoint = "",
      serverKey = "",
      disabledPayload = "",
      enabledPayload = "",
      malformedConfig = "",
      missingConfig = "",
      rollback = "",
      fallback = "",
      evidence = "",
    ] = row;

    if (normalizeCell(endpoint) !== featureFlag.endpoint) {
      problems.push(`${flow.label}: endpoint must be ${featureFlag.endpoint}`);
    }
    if (normalizeCell(serverKey) !== featureFlag.serverFeatureKey) {
      problems.push(`${flow.label}: server key must be ${featureFlag.serverFeatureKey}`);
    }
    if (
      !isPlaceholderCell(disabledPayload) &&
      !hasAffirmativeFeatureFlagEvidence(disabledPayload, [
        ["false", "enabled false", "enabled: false", "enabled=false"],
        [
          "rollout 0",
          "rollout: 0",
          "rollout=0",
          "rollout percent 0",
          "rolloutpercent 0",
          "0%",
        ],
      ])
    ) {
      problems.push(`${flow.label}: disabled payload evidence`);
    }
    if (
      !isPlaceholderCell(enabledPayload) &&
      !hasAffirmativeFeatureFlagEvidence(enabledPayload, [
        ["true", "enabled true", "enabled: true", "enabled=true"],
        [
          "rollout 100",
          "rollout: 100",
          "rollout=100",
          "rollout percent 100",
          "rolloutpercent 100",
          "100%",
        ],
      ])
    ) {
      problems.push(`${flow.label}: enabled payload evidence`);
    }
    if (
      !isPlaceholderCell(malformedConfig) &&
      !hasAffirmativeFeatureFlagEvidence(malformedConfig, [
        ["malformed", "invalid", "bad config", "bad-config"],
        ["fail closed", "failed closed", "fail-closed"],
        ["disabled", "false", "rollout 0", "0%"],
        ["fallback"],
      ])
    ) {
      problems.push(`${flow.label}: malformed config fallback evidence`);
    }
    if (
      !isPlaceholderCell(missingConfig) &&
      !hasAffirmativeFeatureFlagEvidence(missingConfig, [
        ["missing", "absent", "unreachable", "no config"],
        ["fail closed", "failed closed", "fail-closed"],
        ["disabled", "false", "rollout 0", "0%"],
        ["fallback"],
      ])
    ) {
      problems.push(`${flow.label}: missing config fallback evidence`);
    }
    if (
      !isPlaceholderCell(rollback) &&
      (!hasAffirmativeFeatureFlagEvidence(rollback, [
        ["rollback", "rolled back"],
        ["disabled", "false", "rollout 0", "0%"],
        ["fallback"],
      ]) ||
        !hasNamedFeatureFallbackPath(rollback, featureFlag.fallback))
    ) {
      problems.push(
        `${flow.label}: in-session rollback must show disabled rollout and existing fallback`,
      );
    }
    if (
      !isPlaceholderCell(fallback) &&
      (!hasAffirmativeFeatureFlagEvidence(fallback, [["fallback"]]) ||
        !hasNamedFeatureFallbackPath(fallback, featureFlag.fallback))
    ) {
      problems.push(`${flow.label}: existing fallback evidence`);
    }
    if (
      !isPlaceholderCell(evidence) &&
      (!hasFeatureFlagEvidenceNoteLanguage(
        evidence,
        featureFlag.endpoint,
        featureFlag.serverFeatureKey,
        featureFlag.fallback,
      ) ||
        hasFeatureEndpointSensitiveArtifactLeakageLanguage(evidence) ||
        hasNegativeFeatureFlagOutcomeLanguage(evidence))
    ) {
      problems.push(`${flow.label}: rollout evidence note`);
    }
  }

  return problems;
}

function hasFeatureFlagEvidenceNoteLanguage(
  value: string,
  endpoint: string,
  serverFeatureKey: string,
  fallback: string,
): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    hasDatedEvidenceLanguage(value, [
      "evidence",
      "screenshot",
      "log",
      "trace",
      "recording",
      "qa",
      "endpoint",
      "payload",
      "rollback",
      "fallback",
    ]) &&
    hasConcreteEvidenceArtifactLanguage(value) &&
    normalized.includes(endpoint.toLowerCase()) &&
    normalized.includes(serverFeatureKey.toLowerCase()) &&
    hasNamedFeatureFallbackPath(value, fallback) &&
    hasAllWordGroups(value, [
      ["endpoint"],
      ["server key", "server feature key", "feature key"],
      ["payload"],
      ["disabled", "false", "rollout 0", "0%"],
      ["enabled", "true", "rollout 100", "100%"],
      ["malformed"],
      ["missing"],
      ["rollback"],
      ["fallback"],
    ])
  );
}

function hasFeatureEndpointSensitiveArtifactLeakageLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  const artifactPattern =
    "(?:endpoint\\s+)?(?:log|logs|trace|traces|artifact|artifacts|capture|captures|network|payload|recording|recordings|screenshot|screenshots|link|links|url|urls)";
  const leakVerbPattern =
    "(?:recorded|logged|sent|captured|include|includes|included|containing|contains|stored|retained|present|shown|shows|displayed|displays|visible|exposed|exposes)";
  const sensitiveNounPattern =
    "(?:transcript|transcripts|spoken transcript|spoken transcripts|entered text|typed free text|free text|address|addresses|address details|saved-place content|saved-place contents|saved-place label|saved-place labels|saved place|saved places|pickup|pick-up|dropoff|drop-off|destination|destinations|route|routes|location|locations|coordinate|coordinates|ride detail|ride details|medication name|medication names|medication|medications|medicine|strength|strengths|quantity|quantities|symptom|symptoms|provider name|provider names|reply text|note|notes|reference|references|phone number|phone numbers|phone|phones|email|emails|item name|item names|price|prices|fee|fees|retailer name|retailer names|date|dates|time|times|identity|identities|contact|contacts|personal detail|personal details|pii|sensitive data|forbidden data)";

  return [
    new RegExp(
      `\\b${artifactPattern}\\b.{0,96}\\b${leakVerbPattern}\\b.{0,96}\\b${sensitiveNounPattern}\\b`,
    ),
    new RegExp(
      `\\b${leakVerbPattern}\\b.{0,96}\\b${sensitiveNounPattern}\\b.{0,96}\\b${artifactPattern}\\b`,
    ),
    new RegExp(
      `\\b${sensitiveNounPattern}\\b.{0,96}\\b${leakVerbPattern}\\b.{0,96}\\b${artifactPattern}\\b`,
    ),
  ].some((pattern) => pattern.test(normalized));
}

function hasAffirmativeFeatureFlagEvidence(
  value: string,
  wordGroups: readonly (readonly string[])[],
): boolean {
  return (
    hasAllWordGroups(value, wordGroups) &&
    !hasNegativeFeatureFlagOutcomeLanguage(value)
  );
}

function hasNamedFeatureFallbackPath(value: string, fallback: string): boolean {
  const normalized = normalizeCell(value).toLowerCase().replace(/[/_-]+/g, " ");
  const fallbackWords = normalizeCell(fallback)
    .toLowerCase()
    .replace(/[/_-]+/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        ![
          "and",
          "the",
          "old",
          "safe",
          "path",
          "shown",
          "existing",
          "previous",
        ].includes(word),
    );

  return (
    fallbackWords.length > 0 &&
    fallbackWords.every((word) => normalized.includes(word))
  );
}

function hasNegativeFeatureFlagOutcomeLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    /\bnot (returned|available|visible|shown|enabled|disabled)\b/.test(
      normalized,
    ) ||
    /\bdid not (return|show|fall back|fallback|disable|enable|roll back|rollback)\b/.test(
      normalized,
    ) ||
    /\b(?:unable|could not) to (return|show|fall back|fallback|disable|enable|roll back|rollback)\b/.test(
      normalized,
    ) ||
    /\b(payload|response|flag|rollout)\b.{0,24}\b(missing|unavailable|not returned|not available)\b/.test(
      normalized,
    ) ||
    /\b(fallback|existing fallback|previous fallback|safe concierge|panel|path)\b.{0,32}\b(missing|unavailable|not visible|not shown|not available)\b/.test(
      normalized,
    ) ||
    /\b(no fallback|without fallback|fallback missing|fallback unavailable|fallback not visible|fallback not shown)\b/.test(
      normalized,
    )
  );
}

function hasNegativeTaskHubDestinationOutcomeLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    /\bnot (resumed|routed|available|visible|shown|safe)\b/.test(normalized) ||
    /\bdid not (resume|route|open|show|fall back|fallback)\b/.test(normalized) ||
    /\b(?:unable|failed|fails|could not) to (resume|route|open|show|fall back|fallback)\b/.test(
      normalized,
    ) ||
    /\b(no fallback|without fallback|fallback unavailable|fallback missing|missing fallback|resume unavailable|route unavailable|destination unavailable)\b/.test(
      normalized,
    ) ||
    /\b(no write|no external action|no external actions)\b.{0,24}\b(failed|missing|unavailable)\b/.test(
      normalized,
    ) ||
    /\b(write|writes|external action|external actions|submission|submitted|endpoint|booking|call|message|navigation)\b.{0,32}\b(happened|occurred|triggered|fired|ran|sent|submitted|created|wrote)\b/.test(
      normalized,
    ) ||
    /\b(happened|occurred|triggered|fired|ran|sent|submitted|created|wrote)\b.{0,32}\b(write|writes|external action|external actions|submission|endpoint|booking|call|message|navigation)\b/.test(
      normalized,
    )
  );
}

const taskHubDestinationRequirements: Record<
  CanvasRealDeviceQaTaskHubDestinationRow,
  {
    routeWordGroups: readonly (readonly string[])[];
    fallbackWordGroups: readonly (readonly string[])[];
    safeWordGroups: readonly (readonly string[])[];
  }
> = {
  "Local shopping draft": {
    routeWordGroups: [
      ["shopping"],
      ["draft"],
      ["resume", "resumed"],
      ["enabled"],
    ],
    fallbackWordGroups: [
      ["shopping"],
      ["disabled", "rollout 0", "0%"],
      ["fallback"],
      ["shopping experience"],
    ],
    safeWordGroups: [
      ["no write", "no writes", "no-write", "without write", "without writes"],
      [
        "no external action",
        "no external actions",
        "no-external-action",
        "without external action",
        "without external actions",
      ],
      ["confirmation"],
    ],
  },
  "Local medication refill draft": {
    routeWordGroups: [
      ["medication", "refill"],
      ["draft"],
      ["resume", "resumed"],
      ["enabled"],
    ],
    fallbackWordGroups: [
      ["medication", "refill"],
      ["disabled", "rollout 0", "0%"],
      ["fallback"],
      ["medication refill", "shopping/support"],
    ],
    safeWordGroups: [
      ["no write", "no writes", "no-write", "without write", "without writes"],
      [
        "no external action",
        "no external actions",
        "no-external-action",
        "without external action",
        "without external actions",
      ],
      ["confirmation"],
    ],
  },
  "Pending provider reply task": {
    routeWordGroups: [
      ["provider"],
      ["reply"],
      ["pending"],
      ["resume", "resumed"],
    ],
    fallbackWordGroups: [
      ["provider"],
      ["reply"],
      ["disabled", "rollout 0", "0%"],
      ["fallback"],
      ["safe concierge task path"],
    ],
    safeWordGroups: [
      ["no write", "no writes", "no-write", "without write", "without writes"],
      [
        "no external action",
        "no external actions",
        "no-external-action",
        "without external action",
        "without external actions",
      ],
      ["confirmation"],
    ],
  },
  "Stale or blocked task": {
    routeWordGroups: [
      ["stale", "blocked"],
      ["safe concierge task path", "concierge task path"],
      ["resume", "resumed"],
    ],
    fallbackWordGroups: [
      ["fallback", "no canvas", "safe concierge task path"],
      ["stale", "blocked", "disabled", "rollout 0", "safe"],
      ["safe concierge task path", "no canvas"],
    ],
    safeWordGroups: [
      ["no write", "no writes", "no-write", "without write", "without writes"],
      [
        "no external action",
        "no external actions",
        "no-external-action",
        "without external action",
        "without external actions",
      ],
      ["detail", "completion", "confirmation", "endpoint"],
    ],
  },
};

function hasTaskHubDestinationEvidenceLanguage(
  rowLabel: CanvasRealDeviceQaTaskHubDestinationRow,
  value: string,
): boolean {
  const requirements = taskHubDestinationRequirements[rowLabel];

  return (
    hasDatedEvidenceLanguage(value, ["qa", "reviewer", "evidence", "screenshot", "log"]) &&
    hasConcreteEvidenceArtifactLanguage(value) &&
    hasAllWordGroups(value, [
      ...requirements.routeWordGroups,
      ...requirements.fallbackWordGroups,
      ...requirements.safeWordGroups,
    ])
  );
}

function invalidTaskHubDestinationRows(
  sections: Map<string, string[][]>,
): string[] {
  const rows = new Map(
    (sections.get("Task hub destination fallback checks") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const rowLabel of CANVAS_REAL_DEVICE_QA_REQUIRED_TASK_HUB_DESTINATION_ROWS) {
    const row = rows.get(rowLabel);
    if (!row) continue;

    const [, routeBehavior = "", fallbackBehavior = "", safeBehavior = "", evidence = ""] =
      row;
    const requirements = taskHubDestinationRequirements[rowLabel];

    if (
      !isPlaceholderCell(routeBehavior) &&
      !isFailingQaCell(routeBehavior) &&
      (!hasAllWordGroups(routeBehavior, requirements.routeWordGroups) ||
        hasNegativeTaskHubDestinationOutcomeLanguage(routeBehavior))
    ) {
      problems.push(
        `${rowLabel}: resume route must name the task hub destination behavior`,
      );
    }
    if (
      !isPlaceholderCell(fallbackBehavior) &&
      !isFailingQaCell(fallbackBehavior) &&
      (!hasAllWordGroups(fallbackBehavior, requirements.fallbackWordGroups) ||
        hasNegativeTaskHubDestinationOutcomeLanguage(fallbackBehavior))
    ) {
      problems.push(
        `${rowLabel}: fallback must name the disabled destination path`,
      );
    }
    if (
      !isPlaceholderCell(safeBehavior) &&
      !isFailingQaCell(safeBehavior) &&
      (!hasAllWordGroups(safeBehavior, requirements.safeWordGroups) ||
        hasNegativeTaskHubDestinationOutcomeLanguage(safeBehavior))
    ) {
      problems.push(
        `${rowLabel}: safety cell must mention no writes and no external actions before confirmation`,
      );
    }
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      (!hasTaskHubDestinationEvidenceLanguage(rowLabel, evidence) ||
        hasNegativeTaskHubDestinationOutcomeLanguage(evidence))
    ) {
      problems.push(
        `${rowLabel}: evidence must include dated artifact resume, disabled fallback, no-write, and no-external-action evidence`,
      );
    }
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      hasSensitiveDataLeakageLanguage(evidence)
    ) {
      problems.push(
        `${rowLabel}: evidence artifacts must not include transcripts, entered text, addresses, or personal details`,
      );
    }
  }

  return problems;
}

const copyAccessibilityResultRequirements: Record<
  CanvasRealDeviceQaCopyAccessibilityCheck,
  {
    resultDescription: string;
    resultWordGroups: readonly (readonly string[])[];
    evidenceDescription: string;
    evidenceWordGroups: readonly (readonly string[])[];
  }
> = {
  "English copy uses one clear decision at a time": {
    resultDescription: "result must mention English copy with one clear decision",
    resultWordGroups: [
      ["english"],
      ["copy", "label", "labels"],
      ["one clear decision", "single decision", "one decision"],
    ],
    evidenceDescription:
      "evidence must reference dated English one-clear-decision copy review for each flow",
    evidenceWordGroups: [
      ["english"],
      ["copy", "screenshot", "read-through"],
      ["one clear decision", "single decision", "one decision"],
      ["each flow", "all flows"],
    ],
  },
  "Spanish copy and long labels remain readable without horizontal overflow": {
    resultDescription:
      "result must mention Spanish long-label readability without horizontal overflow",
    resultWordGroups: [
      ["spanish"],
      ["long label", "long labels"],
      ["readable", "legible"],
      [
        "no horizontal overflow",
        "without horizontal overflow",
        "no overflow",
        "without overflow",
        "not clipped",
        "not truncated",
      ],
    ],
    evidenceDescription:
      "evidence must reference dated Spanish long-label readability without horizontal overflow",
    evidenceWordGroups: [
      ["spanish"],
      ["long label", "long labels", "long-label", "long-labels"],
      ["readable", "legible"],
      [
        "no horizontal overflow",
        "without horizontal overflow",
        "no overflow",
        "without overflow",
        "not clipped",
        "not truncated",
      ],
      ["screenshot", "read-through"],
    ],
  },
  "Waiting states explain what is happening and what is not happening": {
    resultDescription:
      "result must mention waiting copy, what is pending, and what is not happening",
    resultWordGroups: [
      ["waiting"],
      [
        "pending",
        "processing",
        "in progress",
        "still working",
        "continues",
        "what is happening",
        "waiting for",
      ],
      ["not happening", "no action", "not sent", "not submitted", "no external action"],
    ],
    evidenceDescription:
      "evidence must reference dated waiting-state pending and no-action review",
    evidenceWordGroups: [
      ["waiting"],
      [
        "pending",
        "processing",
        "in progress",
        "still working",
        "continues",
        "what is happening",
        "waiting for",
      ],
      ["not happening", "no action", "not sent", "not submitted", "no external action"],
      ["screenshot", "read-through"],
    ],
  },
  "Blocked states explain what is needed and provide retry or exit": {
    resultDescription:
      "result must mention blocked-state needs plus retry and exit",
    resultWordGroups: [
      ["blocked"],
      ["needed", "needs", "what is needed", "information"],
      ["retry"],
      ["exit", "cancel"],
    ],
    evidenceDescription:
      "evidence must reference dated blocked-state needs, retry, and exit review",
    evidenceWordGroups: [
      ["blocked"],
      ["needed", "needs", "what is needed", "information"],
      ["retry"],
      ["exit", "cancel"],
      ["screenshot", "read-through"],
    ],
  },
  "Completed states explain the outcome without implying extra action": {
    resultDescription:
      "result must mention completed outcome and no extra action",
    resultWordGroups: [
      ["completed"],
      ["outcome", "result"],
      ["no extra action", "without extra action", "not implying extra action"],
    ],
    evidenceDescription:
      "evidence must reference dated completed-state outcome and no-extra-action review",
    evidenceWordGroups: [
      ["completed"],
      ["outcome", "result"],
      ["no extra action", "without extra action", "not implying extra action"],
      ["screenshot", "read-through"],
    ],
  },
  "Keyboard-only completion works for each flow": {
    resultDescription: "result must mention keyboard-only completion for each flow",
    resultWordGroups: [
      ["keyboard"],
      ["completion", "completed", "complete", "safely exited", "safe exit"],
      ["each flow", "all flows"],
    ],
    evidenceDescription:
      "evidence must reference dated keyboard completion or safe-exit evidence for each flow",
    evidenceWordGroups: [
      ["keyboard"],
      ["completion", "completed", "complete", "safely exited", "safe exit"],
      ["each flow", "all flows"],
    ],
  },
  "Focus moves meaningfully when scenes change": {
    resultDescription: "result must mention focus movement on scene changes",
    resultWordGroups: [
      ["focus"],
      ["moves", "moved", "movement", "move"],
      ["scene"],
      ["heading", "control"],
    ],
    evidenceDescription:
      "evidence must reference dated focus movement to a new scene heading or control",
    evidenceWordGroups: [
      ["focus"],
      ["moves", "moved", "movement", "move"],
      ["scene"],
      ["heading", "control"],
    ],
  },
  "Screen-reader announcements fire for waiting, blocked, and completed states": {
    resultDescription:
      "result must mention screen-reader announcements for waiting, blocked, and completed states",
    resultWordGroups: [
      ["screen-reader", "screen reader"],
      ["announcement", "announcements"],
      ["waiting"],
      ["blocked"],
      ["completed"],
    ],
    evidenceDescription:
      "evidence must reference dated screen-reader announcement evidence for waiting, blocked, and completed states",
    evidenceWordGroups: [
      ["screen-reader", "screen reader"],
      ["announcement", "announcements"],
      ["waiting"],
      ["blocked"],
      ["completed"],
    ],
  },
  "Reduced-motion mode remains calm and usable": {
    resultDescription: "result must mention reduced-motion mode as calm and usable",
    resultWordGroups: [
      ["reduced-motion", "reduced motion"],
      ["calm"],
      ["usable"],
    ],
    evidenceDescription:
      "evidence must reference dated calm and usable reduced-motion evidence",
    evidenceWordGroups: [
      ["reduced-motion", "reduced motion", "motion"],
      ["calm"],
      ["usable"],
    ],
  },
};

function invalidCopyAccessibilityRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Copy and accessibility read-through") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const check of CANVAS_REAL_DEVICE_QA_REQUIRED_COPY_CHECKS) {
    const row = rows.get(check);
    if (!row) continue;
    const [, result = "", evidence = ""] = row;
    if (isPlaceholderCell(result) || isPlaceholderCell(evidence)) continue;

    const requirements = copyAccessibilityResultRequirements[check];
    if (
      !hasAllWordGroups(result, requirements.resultWordGroups) ||
      hasNegativeCopyAccessibilityOutcomeLanguage(result)
    ) {
      problems.push(`${check}: ${requirements.resultDescription}`);
    }
    if (
      !hasAllWordGroups(evidence, requirements.evidenceWordGroups) ||
      !hasDatedEvidenceLanguage(evidence) ||
      hasNegativeCopyAccessibilityOutcomeLanguage(evidence)
    ) {
      problems.push(`${check}: ${requirements.evidenceDescription}`);
    }
  }

  return problems;
}

function hasNoSensitiveDataLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  const noSensitiveNounPattern =
    /\b(no|none|zero)\b\W{0,24}\b(transcript|transcripts|text|address|addresses|saved-place|saved place|place|places|label|labels|pickup|pick-up|dropoff|drop-off|destination|destinations|route|routes|location|locations|coordinate|coordinates|ride detail|ride details|medication|medications|medicine|strength|strengths|quantity|quantities|symptom|symptoms|provider|providers|reply|notes?|reference|references|phone|phones|email|emails|item|items|price|prices|fee|fees|retailer|retailers|date|dates|time|times|identity|identities|contact|contacts|sensitive|forbidden|personal|pii|data|details?)\b/;

  return (
    /\bnot (recorded|logged|present|sent|captured|included|stored|retained)\b/.test(
      normalized,
    ) ||
    /\b(absent|omitted|excluded|redacted)\b/.test(normalized) ||
    noSensitiveNounPattern.test(normalized)
  );
}

const sensitiveDataNounPattern =
  "(?:transcripts?|spoken transcripts?|typed free text|free text|text|addresses?|saved-place labels?|saved-place contents?|saved places?|saved-place names?|place labels?|place names?|labels?|pickups?|pick-ups?|dropoffs?|drop-offs?|destinations?|routes?|locations?|coordinates?|ride details?|medications?|medicine|strengths?|quantities?|symptoms?|providers?|provider names?|reply text|replies|notes?|references?|phone numbers?|phones?|emails?|items?|prices?|fees?|retailers?|dates?|times?|identities|contacts?|sensitive|forbidden|personal|pii|data|details?)";

const literalSensitiveDataPatterns: readonly RegExp[] = [
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]*){10,}\b/,
];

function hasLiteralSensitiveDataLeakage(value: string): boolean {
  return literalSensitiveDataPatterns.some((pattern) => pattern.test(value));
}

function hasSensitiveDataLeakageLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  const sensitiveNoun = sensitiveDataNounPattern;
  const leakVerb =
    "(?:recorded|logged|sent|captured|include|includes|included|containing|contains|stored|retained|present|shown|shows|displayed|displays|visible|exposed|exposes)";
  const safeAbsenceLanguage = [
    new RegExp(`\\b(?:no|none|zero|without)\\b.{0,32}\\b${sensitiveNoun}\\b.{0,32}\\b${leakVerb}\\b`, "g"),
    new RegExp(`\\b${sensitiveNoun}\\b.{0,24}\\b(?:absent|omitted|excluded|redacted)\\b`, "g"),
    new RegExp(`\\b${sensitiveNoun}\\b.{0,24}\\b(?:not|never)\\b.{0,16}\\b${leakVerb}\\b`, "g"),
    new RegExp(`\\b(?:not|never)\\b.{0,16}\\b${leakVerb}\\b.{0,32}\\b${sensitiveNoun}\\b`, "g"),
  ].reduce((current, pattern) => current.replace(pattern, " "), normalized);

  return (
    hasLiteralSensitiveDataLeakage(value) ||
    new RegExp(`\\b${sensitiveNoun}\\b.{0,32}\\b${leakVerb}\\b`).test(
      safeAbsenceLanguage,
    ) ||
    new RegExp(`\\b${leakVerb}\\b.{0,32}\\b${sensitiveNoun}\\b`).test(
      safeAbsenceLanguage,
    )
  );
}

function hasAnalyticsEvidenceLanguage(value: string): boolean {
  return hasAnyWord(value, [
    "analytics",
    "telemetry",
    "sink",
    "event",
    "envelope",
    "log",
    "sample",
    "reviewed",
  ]);
}

function hasConcreteAnalyticsArtifactLanguage(value: string): boolean {
  return hasAnyWord(value, [
    "artifact",
    "artifacts",
    "dashboard",
    "query",
    "queries",
    "export",
    "exports",
    "report",
    "reports",
    "log",
    "logs",
    "trace",
    "traces",
    "screenshot",
    "screen shot",
    "link",
    "url",
  ]);
}

function analyticsSignalSourceIsSpecific(
  signal: CanvasRealDeviceQaAnalyticsSignal,
  value: string,
): boolean {
  switch (signal) {
    case "Started":
      return (
        hasAnyWord(value, ["scene_viewed"]) &&
        hasAnyWord(value, [
          "restored false",
          "restored: false",
          "restored=false",
          "not restored",
        ])
      );
    case "Resumed":
      return (
        hasAnyWord(value, ["draft_restored"]) ||
        (hasAnyWord(value, ["scene_viewed"]) &&
          hasAnyWord(value, [
            "restored true",
            "restored: true",
            "restored=true",
          ]))
      );
    case "Abandoned":
      return hasAnyWord(value, ["abandoned"]);
    case "Blocked":
      return hasAnyWord(value, [
        "failed",
        "urgent_help_shown",
        "blocked scene",
        "blocked scene view",
      ]);
    case "Confirmed":
      return hasAnyWord(value, ["confirmation_submitted"]);
    case "Completed":
      return hasAnyWord(value, ["completed", "terminal pending", "pending terminal"]);
  }
}

function analyticsSignalResultIsSpecific(
  signal: CanvasRealDeviceQaAnalyticsSignal,
  value: string,
): boolean {
  const normalized = normalizeCell(value);
  const positiveCountPattern =
    /\b(?:aggregate\s+)?(?:signal\s+)?count(?:ed|s)?\b\D{0,12}\b[1-9]\d*\b|\b[1-9]\d*\b\D{0,12}\b(?:aggregate\s+)?(?:signal\s+)?count(?:ed|s)?\b/i;

  return (
    hasAllWordGroups(value, [
      [signal.toLowerCase()],
      ["aggregate", "count", "signal"],
      ["observed", "reviewed", "verified", "counted"],
    ]) && positiveCountPattern.test(normalized)
  );
}

function hasAnalyticsSignalEvidenceLanguage(
  signal: CanvasRealDeviceQaAnalyticsSignal,
  value: string,
): boolean {
  return (
    hasDatedEvidenceLanguage(value, [
      "analytics",
      "telemetry",
      "sink",
      "event",
      "sample",
      "log",
      "evidence",
      "counter",
    ]) &&
    analyticsSignalSourceIsSpecific(signal, value) &&
    analyticsSignalResultIsSpecific(signal, value) &&
    hasAllowedEnvelopeFieldsLanguage(value) &&
    hasConcreteAnalyticsArtifactLanguage(value) &&
    !hasSensitiveDataLeakageLanguage(value)
  );
}

function hasAllowedEnvelopeFieldsLanguage(value: string): boolean {
  return hasAnyWord(value, [
    "allowed envelope",
    "allowed envelope fields",
    "only allowed envelope",
    "only allowed fields",
    "closed envelope",
    "closed event shape",
    "allowed fields",
    "name, step, input, attempt, restored, and revision",
    "name, step, input, attempt, restored, revision",
    "name step input attempt restored revision",
  ]);
}

const privacyClassWordGroups: Record<
  CanvasRealDeviceQaPrivacyClass,
  readonly (readonly string[])[]
> = {
  "Spoken transcripts": [["spoken"], ["transcript", "transcripts"]],
  "Typed free text": [["typed"], ["free text", "text"]],
  "Addresses or saved-place labels": [
    ["address", "addresses"],
    ["saved-place", "saved place"],
    ["label", "labels"],
  ],
  "Ride pickup, dropoff, destination, or route details": [
    ["ride"],
    ["pickup", "pick-up"],
    ["dropoff", "drop-off"],
    ["destination", "route"],
  ],
  "Medication names, strengths, quantities, or symptoms": [
    ["medication", "medications"],
    ["name", "names"],
    ["strength", "strengths"],
    ["quantity", "quantities"],
    ["symptom", "symptoms"],
  ],
  "Provider names, reply text, notes, references, phone numbers, or emails": [
    ["provider", "providers"],
    ["name", "names"],
    ["reply"],
    ["note", "notes", "reference", "references"],
    ["phone", "phones", "email", "emails"],
  ],
  "Shopping item names, prices, fees, or retailer names": [
    ["shopping"],
    ["item", "items"],
    ["name", "names"],
    ["price", "prices", "fee", "fees"],
    ["retailer", "retailers"],
  ],
  "Dates, times, identities, or contact details": [
    ["date", "dates"],
    ["time", "times"],
    ["identity", "identities"],
    ["contact", "contacts"],
  ],
};

function invalidAnalyticsSignalRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Analytics signal review") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const signal of CANVAS_REAL_DEVICE_QA_REQUIRED_ANALYTICS_SIGNALS) {
    const row = rows.get(signal);
    if (!row) continue;
    const [, sourceEvent = "", aggregateResult = "", evidence = ""] = row;
    if (
      isPlaceholderCell(sourceEvent) ||
      isPlaceholderCell(aggregateResult) ||
      isPlaceholderCell(evidence)
    ) {
      continue;
    }
    if (!analyticsSignalSourceIsSpecific(signal, sourceEvent)) {
      problems.push(`${signal}: source event must match the canonical launch signal`);
    }
    if (!analyticsSignalResultIsSpecific(signal, aggregateResult)) {
      problems.push(
        `${signal}: result must mention the aggregate signal/count reviewed with a positive numeric count`,
      );
    }
    if (!hasAnalyticsSignalEvidenceLanguage(signal, evidence)) {
      problems.push(
        `${signal}: evidence must include dated source-event, positive aggregate count, and allowed-envelope evidence`,
      );
    }
  }

  return problems;
}

function invalidPrivacyReviewRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Analytics privacy review") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const privacyClass of CANVAS_REAL_DEVICE_QA_REQUIRED_PRIVACY_CLASSES) {
    const row = rows.get(privacyClass);
    if (!row) continue;
    const [, result = "", evidence = ""] = row;
    if (isPlaceholderCell(result) || isPlaceholderCell(evidence)) continue;
    const privacyClassGroups = privacyClassWordGroups[privacyClass];
    if (
      !hasAllWordGroups(result, privacyClassGroups) ||
      !hasNoSensitiveDataLanguage(result) ||
      hasSensitiveDataLeakageLanguage(result)
    ) {
      problems.push(
        `${privacyClass}: result must name the forbidden data class and state it was absent`,
      );
    }
    if (
      !hasAllWordGroups(evidence, privacyClassGroups) ||
      !hasAnalyticsEvidenceLanguage(evidence) ||
      !hasDatedEvidenceLanguage(evidence) ||
      !hasAllowedEnvelopeFieldsLanguage(evidence) ||
      !hasConcreteAnalyticsArtifactLanguage(evidence) ||
      hasSensitiveDataLeakageLanguage(evidence)
    ) {
      problems.push(
        `${privacyClass}: evidence must name the forbidden data class and reference dated analytics or telemetry review with only allowed envelope fields`,
      );
    }
  }

  return problems;
}

const artifactInventoryRequirements: Record<
  CanvasRealDeviceQaArtifactInventoryRow,
  readonly (readonly string[])[]
> = {
  "Environment and flag artifacts": [
    ["environment"],
    ["flag", "feature flag"],
    ["analytics sink", "sink"],
    ["enabled"],
    ["disabled", "rollback"],
  ],
  "Real-device screenshots or photos": [
    ["phone", "mobile"],
    ["tablet"],
    ["desktop", "laptop"],
    ["screenshot", "photo", "image", "artifact"],
  ],
  "Interaction recordings or logs": [
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["complete", "completed", "completion", "safe exit", "safely exited"],
  ],
  "Behavior recovery artifacts": [
    ["resume", "restored", "restore"],
    ["reconnect", "refresh"],
    ["browser back", "back"],
    ["interruption", "interrupt"],
    ["cancel", "exit"],
  ],
  "Feature endpoint artifacts": [
    ["endpoint"],
    ["payload"],
    ["rollback"],
    ["fallback"],
  ],
  "Task hub resume artifacts": [
    ["task hub"],
    ["resume"],
    ["fallback"],
    ["no write", "without write"],
    ["no external action", "without external action"],
  ],
  "Copy and accessibility artifacts": [
    ["copy"],
    ["accessibility", "screen-reader", "screen reader"],
    ["focus"],
    ["long label", "long labels", "spanish"],
  ],
  "Analytics signal artifacts": [
    ["analytics", "telemetry"],
    ["started"],
    ["resumed"],
    ["abandoned"],
    ["blocked"],
    ["confirmed"],
    ["completed"],
  ],
  "Analytics privacy artifacts": [
    ["analytics", "telemetry"],
    ["privacy"],
    ["allowed envelope", "allowed fields", "closed envelope"],
    ["forbidden data", "sensitive data"],
    ["absent", "not recorded", "redacted"],
  ],
  "Run sheet validation artifacts": [
    ["run sheet", "runsheet"],
    ["validation", "validated"],
    ["matrix"],
    ["packet"],
  ],
  "Launch preflight artifacts": [
    ["preflight"],
    ["run sheet", "runsheet"],
    ["matrix"],
    ["packet"],
    ["endpoint"],
    ["analytics"],
  ],
};

function hasConcreteArtifactInventoryReference(value: string): boolean {
  return (
    hasConcreteEvidenceArtifactLanguage(value) ||
    hasConcreteAnalyticsArtifactLanguage(value) ||
    hasConcreteEnvironmentArtifactLanguage(value)
  );
}

function hasArtifactInventoryReviewerDate(value: string): boolean {
  return (
    hasFreshNonFutureIsoDateCellFromText(value) &&
    !hasFutureIsoDateCellFromText(value) &&
    hasAnyWord(value, ["qa", "reviewer", "reviewed", "captured", "verified"])
  );
}

function invalidArtifactInventoryRows(sections: Map<string, string[][]>): string[] {
  const rows = new Map(
    (sections.get("Evidence artifact inventory") ?? [])
      .slice(1)
      .map((row) => [row[0], row] as const),
  );
  const problems: string[] = [];

  for (const artifactSet of CANVAS_REAL_DEVICE_QA_REQUIRED_ARTIFACT_INVENTORY_ROWS) {
    const row = rows.get(artifactSet);
    if (!row) continue;
    const [, coverage = "", reference = "", reviewerDate = ""] = row;
    if (
      isPlaceholderCell(coverage) ||
      isPlaceholderCell(reference) ||
      isPlaceholderCell(reviewerDate)
    ) {
      continue;
    }
    if (
      !hasAllWordGroups(coverage, artifactInventoryRequirements[artifactSet]) ||
      hasNegativeEvidenceLanguage(coverage)
    ) {
      problems.push(`${artifactSet}: coverage must name the launch evidence it proves`);
    }
    if (
      !hasConcreteArtifactInventoryReference(reference) ||
      !hasNoSensitiveDataLanguage(reference) ||
      hasSensitiveDataLeakageLanguage(reference) ||
      hasNegativeEvidenceLanguage(reference)
    ) {
      problems.push(
        `${artifactSet}: reference must name sanitized concrete artifacts with no personal details`,
      );
    }
    if (!hasArtifactInventoryReviewerDate(reviewerDate)) {
      problems.push(
        `${artifactSet}: reviewer/date must include QA or reviewer evidence with a non-future YYYY-MM-DD date`,
      );
    }
  }

  return problems;
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
      return !isPlaceholderCell(date) && !isFreshNonFutureIsoDateCell(date);
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
  const blockedRequiredSignoffNoteRoles =
    CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES.filter((role) => {
      const signoff = signoffRows.get(role);
      if (!signoff) return false;
      const notes = signoff[3] ?? "";
      return hasBlockedLaunchSignoffNoteLanguage(notes);
    });
  const invalidRequiredSignoffNoteRoles =
    CANVAS_REAL_DEVICE_QA_REQUIRED_SIGNOFF_ROLES.filter((role) => {
      const signoff = signoffRows.get(role);
      if (!signoff) return false;
      const notes = signoff[3] ?? "";
      return (
        !isPlaceholderCell(notes) &&
        !hasMeaningfulLaunchSignoffNoteLanguage(role, notes)
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
      "Interaction mode coverage",
      requiredFlowLabels,
    ),
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
      "Task hub destination fallback checks",
      CANVAS_REAL_DEVICE_QA_REQUIRED_TASK_HUB_DESTINATION_ROWS,
    ),
    ...missingRowsInSection(
      sections,
      "Copy and accessibility read-through",
      CANVAS_REAL_DEVICE_QA_REQUIRED_COPY_CHECKS,
    ),
    ...missingRowsInSection(
      sections,
      "Analytics signal review",
      CANVAS_REAL_DEVICE_QA_REQUIRED_ANALYTICS_SIGNALS,
    ),
    ...missingRowsInSection(
      sections,
      "Analytics privacy review",
      CANVAS_REAL_DEVICE_QA_REQUIRED_PRIVACY_CLASSES,
    ),
    ...missingRowsInSection(
      sections,
      "Evidence artifact inventory",
      CANVAS_REAL_DEVICE_QA_REQUIRED_ARTIFACT_INVENTORY_ROWS,
    ),
  ];
  const invalidEnvironmentFields = invalidEnvironmentRows(sections);
  const invalidDeviceCoverageChecks = invalidDeviceCoverageRows(sections);
  const invalidInteractionModeChecks = invalidInteractionModeRows(sections);
  const invalidBehaviorChecks = invalidBehaviorRows(sections);
  const invalidFeatureFlagChecks = invalidFeatureFlagRows(sections);
  const invalidTaskHubDestinationChecks = invalidTaskHubDestinationRows(sections);
  const invalidCopyAccessibilityChecks = invalidCopyAccessibilityRows(sections);
  const invalidAnalyticsSignalChecks = invalidAnalyticsSignalRows(sections);
  const invalidPrivacyChecks = invalidPrivacyReviewRows(sections);
  const invalidArtifactInventoryChecks = invalidArtifactInventoryRows(sections);

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
    if (invalidEnvironmentFields.length > 0) {
      problems.push(
        `Matrix has environment field(s) without launch-specific evidence: ${invalidEnvironmentFields.join(", ")}.`,
      );
    }
    if (invalidDeviceCoverageChecks.length > 0) {
      problems.push(
        `Matrix has real-device coverage row issue(s): ${invalidDeviceCoverageChecks.join(", ")}.`,
      );
    }
    if (invalidInteractionModeChecks.length > 0) {
      problems.push(
        `Matrix has interaction-mode coverage row issue(s): ${invalidInteractionModeChecks.join(", ")}.`,
      );
    }
    if (invalidBehaviorChecks.length > 0) {
      problems.push(
        `Matrix has required behavior row issue(s): ${invalidBehaviorChecks.join(", ")}.`,
      );
    }
    if (invalidFeatureFlagChecks.length > 0) {
      problems.push(
        `Matrix has feature-flag rollback row issue(s): ${invalidFeatureFlagChecks.join(", ")}.`,
      );
    }
    if (invalidTaskHubDestinationChecks.length > 0) {
      problems.push(
        `Matrix has task-hub destination fallback row issue(s): ${invalidTaskHubDestinationChecks.join(", ")}.`,
      );
    }
    if (invalidCopyAccessibilityChecks.length > 0) {
      problems.push(
        `Matrix has copy/accessibility row issue(s): ${invalidCopyAccessibilityChecks.join(", ")}.`,
      );
    }
    if (invalidAnalyticsSignalChecks.length > 0) {
      problems.push(
        `Matrix has analytics signal row issue(s): ${invalidAnalyticsSignalChecks.join(", ")}.`,
      );
    }
    if (invalidPrivacyChecks.length > 0) {
      problems.push(
        `Matrix has analytics privacy row issue(s): ${invalidPrivacyChecks.join(", ")}.`,
      );
    }
    if (invalidArtifactInventoryChecks.length > 0) {
      problems.push(
        `Matrix has evidence artifact inventory row issue(s): ${invalidArtifactInventoryChecks.join(", ")}.`,
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
        `Matrix has required sign-off date(s) that must use YYYY-MM-DD, cannot be in the future, and must be no older than 7 days: ${invalidRequiredSignoffDateRoles.join(", ")}.`,
      );
    }
    if (unapprovedRequiredSignoffRoles.length > 0) {
      problems.push(
        `Matrix has required sign-off role(s) without an approved-for-launch decision: ${unapprovedRequiredSignoffRoles.join(", ")}.`,
      );
    }
    if (blockedRequiredSignoffNoteRoles.length > 0) {
      problems.push(
        `Matrix has required sign-off note(s) with pending fixes, conditions, or blockers: ${blockedRequiredSignoffNoteRoles.join(", ")}.`,
      );
    }
    if (invalidRequiredSignoffNoteRoles.length > 0) {
      problems.push(
        `Matrix has required sign-off note(s) without concrete, role-specific launch evidence: ${invalidRequiredSignoffNoteRoles.join(", ")}.`,
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
    invalidEnvironmentFields,
    invalidDeviceCoverageRows: invalidDeviceCoverageChecks,
    invalidInteractionModeRows: invalidInteractionModeChecks,
    invalidBehaviorRows: invalidBehaviorChecks,
    invalidFeatureFlagRows: invalidFeatureFlagChecks,
    invalidTaskHubDestinationRows: invalidTaskHubDestinationChecks,
    invalidCopyAccessibilityRows: invalidCopyAccessibilityChecks,
    invalidAnalyticsSignalRows: invalidAnalyticsSignalChecks,
    invalidPrivacyRows: invalidPrivacyChecks,
    invalidArtifactInventoryRows: invalidArtifactInventoryChecks,
    missingRequiredSignoffRoles,
    incompleteRequiredSignoffRoles,
    invalidRequiredSignoffDateRoles,
    unapprovedRequiredSignoffRoles,
    blockedRequiredSignoffNoteRoles,
    invalidRequiredSignoffNoteRoles,
    problems,
  };
}
