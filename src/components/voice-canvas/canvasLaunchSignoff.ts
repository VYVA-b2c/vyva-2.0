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
  "Medication names, strengths, quantities, or symptoms",
  "Provider names, reply text, notes, references, phone numbers, or emails",
  "Shopping item names, prices, fees, or retailer names",
  "Dates, times, identities, or contact details",
] as const;

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

export type CanvasRealDeviceQaMatrixState = "pending" | "ready" | "invalid";

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
  if (isPlaceholderCell(normalized) || isFailingQaCell(normalized)) return false;

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
      return /\breview(ed)?\b/i.test(normalized) && isIsoDateCellFromText(normalized);
    case "Initial flag state":
    case "Rollback flag state":
      return /\b(enabled|disabled|rollout|percent|flag|true|false|0|100)\b/i.test(
        lower,
      );
  }
}

function isIsoDateCellFromText(value: string): boolean {
  return /\b\d{4}-\d{2}-\d{2}\b/.test(value);
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
    isIsoDateCellFromText(normalizeCell(value)) &&
    hasAnyWord(value, evidenceWords) &&
    hasAnyWord(value, ["qa", "reviewer", "reviewed", "captured", "verified"])
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
      if (!hasAllWordGroups(cell, requirement.wordGroups)) {
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
      !hasDatedEvidenceLanguage(evidence)
    ) {
      problems.push(`${flow.label}: evidence must include dated QA or reviewer evidence`);
    } else if (hasEmulatedDeviceEvidenceLanguage(evidence)) {
      problems.push(`${flow.label}: evidence must not rely on viewport or emulator evidence`);
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
      if (!hasAllWordGroups(cell, requirement.wordGroups)) {
        problems.push(`${flow.label}: ${requirement.description}`);
      }
    }

    const evidence = row[4] ?? "";
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      !hasDatedEvidenceLanguage(evidence)
    ) {
      problems.push(
        `${flow.label}: interaction-mode evidence must include dated QA or reviewer evidence`,
      );
    }
  }

  return problems;
}

const behaviorChecklistRequirements = [
  {
    columnIndex: 1,
    description:
      "start/resume cell must mention start, resumed work, and no write evidence",
    wordGroups: [
      ["start", "started"],
      ["resume", "resumed", "restore", "restored"],
      ["preserve", "preserved", "restore", "restored", "same scene", "current scene", "draft"],
      [
        "no write",
        "no external action",
        "not submitted",
        "without submitting",
        "without write",
      ],
    ],
  },
  {
    columnIndex: 2,
    description:
      "app exit/reopen cell must mention app exit/reopen, restored draft, and no write evidence",
    wordGroups: [
      ["app exit", "exit app", "app close", "close app", "leave app"],
      ["reopen", "reopened", "return", "returned"],
      ["restore", "restored", "resume", "resumed", "draft"],
      [
        "no write",
        "no external action",
        "not submitted",
        "without submitting",
        "without resubmitting",
        "without write",
      ],
    ],
  },
  {
    columnIndex: 3,
    description:
      "refresh/reconnect cell must mention refresh, reconnect, restored work, and no write evidence",
    wordGroups: [
      ["refresh"],
      ["reconnect", "reconnected", "network"],
      ["preserve", "preserved", "restore", "restored", "resume", "resumed", "draft"],
      [
        "no write",
        "no external action",
        "not submitted",
        "without submitting",
        "without resubmitting",
        "without write",
      ],
    ],
  },
  {
    columnIndex: 4,
    description:
      "voice interruption cell must mention interruption recovery, preserved work, and no write evidence",
    wordGroups: [
      ["interruption", "interrupted", "interrupt"],
      ["recover", "recovery", "resume", "continued", "restored"],
      ["preserve", "preserved", "restore", "restored", "same scene", "current scene", "draft"],
      [
        "no write",
        "no external action",
        "not submitted",
        "without submitting",
        "without resubmitting",
        "without write",
      ],
    ],
  },
  {
    columnIndex: 5,
    description:
      "browser back cell must mention safe back navigation with preserved work and no write",
    wordGroups: [
      ["back"],
      ["preserve", "preserved", "restore", "restored", "return", "returned"],
      [
        "no write",
        "no external action",
        "not submitted",
        "without submitting",
        "without write",
      ],
    ],
  },
  {
    columnIndex: 6,
    description: "cancel/exit cell must mention cancel, exit, and no write evidence",
    wordGroups: [
      ["cancel"],
      ["exit", "leave"],
      [
        "no write",
        "no external action",
        "not submitted",
        "without submitting",
        "without write",
      ],
    ],
  },
  {
    columnIndex: 7,
    description:
      "flag rollback/fallback cell must mention flag rollback, existing fallback, and no write evidence",
    wordGroups: [
      ["flag"],
      ["rollback"],
      ["fallback"],
      ["existing", "previous", "old", "safe concierge"],
      [
        "no write",
        "no external action",
        "not submitted",
        "without submitting",
        "without write",
      ],
    ],
  },
  {
    columnIndex: 8,
    description:
      "confirmation safety cell must mention no external action, write, booking, call, message, and navigation before explicit confirmation",
    wordGroups: [
      [
        "no external action",
        "without external action",
        "no action",
        "nothing sent",
        "nothing submitted",
      ],
      [
        "no write",
        "no writes",
        "without write",
        "without writes",
        "not submitted",
        "nothing submitted",
      ],
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
    columnIndex: 9,
    description:
      "duplicate/stale guard cell must mention duplicate prevention and stale response ignoring",
    wordGroups: [
      ["duplicate"],
      [
        "prevented",
        "blocked",
        "ignored",
        "no duplicate",
        "without duplicate",
        "not submitted",
        "not resubmitted",
      ],
      ["stale"],
      ["ignored", "rejected", "discarded", "not accepted"],
    ],
  },
  {
    columnIndex: 10,
    description:
      "recoverable failure retry cell must mention recoverable failure, retry, exit, and no write evidence",
    wordGroups: [
      ["recoverable"],
      ["failure", "failed", "blocked"],
      ["retry"],
      ["exit", "cancel", "recover", "recovery"],
      [
        "no write",
        "no external action",
        "not submitted",
        "without submitting",
        "without resubmitting",
        "without write",
      ],
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
      ["readable", "long label", "long labels", "large touch", "touch target"],
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
      if (!hasAllWordGroups(cell, requirement.wordGroups)) {
        problems.push(`${flow.label}: ${requirement.description}`);
      }
    }

    const evidence = row[13] ?? "";
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      !hasDatedEvidenceLanguage(evidence)
    ) {
      problems.push(`${flow.label}: behavior evidence must include dated QA or reviewer evidence`);
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
      !hasAnyWord(disabledPayload, ["disabled", "false", "rollout 0", "0%"])
    ) {
      problems.push(`${flow.label}: disabled payload evidence`);
    }
    if (
      !isPlaceholderCell(enabledPayload) &&
      !hasAnyWord(enabledPayload, ["enabled", "true", "rollout", "100", "%"])
    ) {
      problems.push(`${flow.label}: enabled payload evidence`);
    }
    if (
      !isPlaceholderCell(malformedConfig) &&
      !hasAllWordGroups(malformedConfig, [
        ["malformed", "invalid", "bad config", "bad-config"],
        ["fail closed", "fail-closed", "disabled", "fallback", "false", "rollout 0"],
      ])
    ) {
      problems.push(`${flow.label}: malformed config fallback evidence`);
    }
    if (
      !isPlaceholderCell(missingConfig) &&
      !hasAllWordGroups(missingConfig, [
        ["missing", "absent", "unreachable", "no config"],
        ["fail closed", "fail-closed", "disabled", "fallback", "false", "rollout 0"],
      ])
    ) {
      problems.push(`${flow.label}: missing config fallback evidence`);
    }
    if (
      !isPlaceholderCell(rollback) &&
      !hasAnyWord(rollback, ["rollback", "disabled", "rollout 0", "0%", "fallback"])
    ) {
      problems.push(`${flow.label}: in-session rollback evidence`);
    }
    if (
      !isPlaceholderCell(fallback) &&
      !hasAnyWord(fallback, ["fallback", "existing", featureFlag.fallback.toLowerCase()])
    ) {
      problems.push(`${flow.label}: existing fallback evidence`);
    }
    if (
      !isPlaceholderCell(evidence) &&
      !hasDatedEvidenceLanguage(evidence, [
        "evidence",
        "screenshot",
        "log",
        "trace",
        "recording",
        "qa",
      ])
    ) {
      problems.push(`${flow.label}: rollout evidence note`);
    }
  }

  return problems;
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
      ["fallback", "existing"],
    ],
    safeWordGroups: [
      ["no write", "no external action", "not submitted", "without submitting"],
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
      ["fallback", "existing"],
    ],
    safeWordGroups: [
      ["no write", "no external action", "not submitted", "without submitting"],
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
      ["fallback", "existing", "safe concierge task path"],
    ],
    safeWordGroups: [
      ["no write", "no external action", "not submitted", "without submitting"],
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
      ["fallback", "existing", "safe concierge task path", "no canvas"],
      ["stale", "blocked", "disabled", "rollout 0", "safe"],
    ],
    safeWordGroups: [
      ["no write", "no external action", "not submitted", "without submitting"],
      ["detail", "completion", "confirmation", "endpoint"],
    ],
  },
};

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
      !hasAllWordGroups(routeBehavior, requirements.routeWordGroups)
    ) {
      problems.push(
        `${rowLabel}: resume route must name the task hub destination behavior`,
      );
    }
    if (
      !isPlaceholderCell(fallbackBehavior) &&
      !isFailingQaCell(fallbackBehavior) &&
      !hasAllWordGroups(fallbackBehavior, requirements.fallbackWordGroups)
    ) {
      problems.push(
        `${rowLabel}: fallback must name the disabled destination path`,
      );
    }
    if (
      !isPlaceholderCell(safeBehavior) &&
      !isFailingQaCell(safeBehavior) &&
      !hasAllWordGroups(safeBehavior, requirements.safeWordGroups)
    ) {
      problems.push(
        `${rowLabel}: safety cell must mention no writes before confirmation`,
      );
    }
    if (
      !isPlaceholderCell(evidence) &&
      !isFailingQaCell(evidence) &&
      !hasDatedEvidenceLanguage(evidence)
    ) {
      problems.push(`${rowLabel}: evidence must include dated QA or reviewer evidence`);
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
      "evidence must reference dated English copy or screenshot review",
    evidenceWordGroups: [["english", "copy", "screenshot", "read-through"]],
  },
  "Spanish copy and long labels remain readable without horizontal overflow": {
    resultDescription:
      "result must mention Spanish long-label readability without horizontal overflow",
    resultWordGroups: [
      ["spanish"],
      ["long label", "long labels"],
      ["readable", "overflow", "horizontal overflow", "no horizontal overflow"],
    ],
    evidenceDescription:
      "evidence must reference dated Spanish, long-label, overflow, or screenshot review",
    evidenceWordGroups: [["spanish", "long label", "long labels", "overflow", "screenshot"]],
  },
  "Waiting states explain what is happening and what is not happening": {
    resultDescription:
      "result must mention waiting copy and what is not happening",
    resultWordGroups: [
      ["waiting"],
      ["not happening", "no action", "not sent", "not submitted", "no external action"],
    ],
    evidenceDescription: "evidence must reference dated waiting-state review",
    evidenceWordGroups: [["waiting", "screenshot"]],
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
    evidenceDescription: "evidence must reference dated blocked-state review",
    evidenceWordGroups: [["blocked", "screenshot"]],
  },
  "Completed states explain the outcome without implying extra action": {
    resultDescription:
      "result must mention completed outcome and no extra action",
    resultWordGroups: [
      ["completed"],
      ["outcome", "result"],
      ["no extra action", "without extra action", "not implying extra action"],
    ],
    evidenceDescription: "evidence must reference dated completed-state review",
    evidenceWordGroups: [["completed", "screenshot"]],
  },
  "Keyboard-only completion works for each flow": {
    resultDescription: "result must mention keyboard-only completion for each flow",
    resultWordGroups: [
      ["keyboard"],
      ["each flow", "all flows"],
    ],
    evidenceDescription: "evidence must reference dated keyboard evidence",
    evidenceWordGroups: [["keyboard"]],
  },
  "Focus moves meaningfully when scenes change": {
    resultDescription: "result must mention focus movement on scene changes",
    resultWordGroups: [
      ["focus"],
      ["scene"],
    ],
    evidenceDescription: "evidence must reference dated focus evidence",
    evidenceWordGroups: [["focus"]],
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
    evidenceDescription: "evidence must reference dated screen-reader announcement evidence",
    evidenceWordGroups: [["screen-reader", "screen reader", "announcement"]],
  },
  "Reduced-motion mode remains calm and usable": {
    resultDescription: "result must mention reduced-motion mode as calm and usable",
    resultWordGroups: [
      ["reduced-motion", "reduced motion"],
      ["calm"],
      ["usable"],
    ],
    evidenceDescription: "evidence must reference dated reduced-motion evidence",
    evidenceWordGroups: [["reduced-motion", "reduced motion", "motion"]],
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
    if (!hasAllWordGroups(result, requirements.resultWordGroups)) {
      problems.push(`${check}: ${requirements.resultDescription}`);
    }
    if (
      !hasAllWordGroups(evidence, requirements.evidenceWordGroups) ||
      !hasDatedEvidenceLanguage(evidence)
    ) {
      problems.push(`${check}: ${requirements.evidenceDescription}`);
    }
  }

  return problems;
}

function hasNoSensitiveDataLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  return (
    /\b(no|none|zero|absent|omitted|excluded|redacted)\b/.test(normalized) ||
    /\bnot (recorded|logged|present|sent|captured|included)\b/.test(normalized)
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
      return hasAnyWord(value, ["completed"]);
  }
}

function analyticsSignalResultIsSpecific(
  signal: CanvasRealDeviceQaAnalyticsSignal,
  value: string,
): boolean {
  return hasAllWordGroups(value, [
    [signal.toLowerCase()],
    ["aggregate", "count", "signal"],
    ["observed", "reviewed", "verified", "counted"],
  ]);
}

function hasAnalyticsSignalEvidenceLanguage(value: string): boolean {
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
    hasAnyWord(value, ["aggregate", "signal", "count"]) &&
    hasAnyWord(value, ["allowed envelope", "envelope", "privacy-safe"])
  );
}

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
      problems.push(`${signal}: result must mention the aggregate signal/count reviewed`);
    }
    if (!hasAnalyticsSignalEvidenceLanguage(evidence)) {
      problems.push(
        `${signal}: evidence must reference dated aggregate telemetry with allowed envelope fields`,
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
    if (!hasNoSensitiveDataLanguage(result)) {
      problems.push(`${privacyClass}: result must state sensitive data was absent`);
    }
    if (!hasAnalyticsEvidenceLanguage(evidence) || !hasDatedEvidenceLanguage(evidence)) {
      problems.push(
        `${privacyClass}: evidence must reference dated analytics or telemetry review`,
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
    invalidEnvironmentFields,
    invalidDeviceCoverageRows: invalidDeviceCoverageChecks,
    invalidInteractionModeRows: invalidInteractionModeChecks,
    invalidBehaviorRows: invalidBehaviorChecks,
    invalidFeatureFlagRows: invalidFeatureFlagChecks,
    invalidTaskHubDestinationRows: invalidTaskHubDestinationChecks,
    invalidCopyAccessibilityRows: invalidCopyAccessibilityChecks,
    invalidAnalyticsSignalRows: invalidAnalyticsSignalChecks,
    invalidPrivacyRows: invalidPrivacyChecks,
    missingRequiredSignoffRoles,
    incompleteRequiredSignoffRoles,
    invalidRequiredSignoffDateRoles,
    unapprovedRequiredSignoffRoles,
    problems,
  };
}
