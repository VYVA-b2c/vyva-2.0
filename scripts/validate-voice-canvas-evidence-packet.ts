import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const defaultPacketPath = "docs/audits/voice-canvas-real-device-evidence-packet.md";
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
  "Privacy rules for every artifact",
  "Evidence packet inventory",
  "Flow packet checklist",
  "Copy-ready evidence note patterns",
  "Final pre-fill check",
] as const;

const requiredInventoryArtifactSets = [
  "Environment and flag artifacts",
  "Entry surface artifacts",
  "Real-device screenshots or photos",
  "Interaction recordings or logs",
  "Behavior recovery artifacts",
  "Feature endpoint artifacts",
  "Task hub resume artifacts",
  "Rollback owner handoff artifacts",
  "Copy and accessibility artifacts",
  "Analytics signal artifacts",
  "Analytics privacy artifacts",
  "Run sheet validation artifacts",
  "Launch run plan artifacts",
  "Launch preflight artifacts",
] as const;

type RequiredInventoryArtifactSet =
  (typeof requiredInventoryArtifactSets)[number];

const inventoryCoverageRequirements: Record<
  RequiredInventoryArtifactSet,
  readonly (readonly string[])[]
> = {
  "Environment and flag artifacts": [
    ["environment"],
    ["feature"],
    ["rollback"],
  ],
  "Entry surface artifacts": [
    ["entry", "surface"],
    ["canonical", "manifest"],
    ["flow"],
    ["screenshot", "log", "recording", "artifact"],
  ],
  "Real-device screenshots or photos": [
    ["device"],
    ["phone"],
    ["tablet"],
    ["desktop", "laptop"],
  ],
  "Interaction recordings or logs": [
    ["interaction"],
    ["voice"],
    ["touch"],
    ["keyboard"],
  ],
  "Behavior recovery artifacts": [
    ["behavior"],
    ["resume"],
    ["refresh", "reconnect"],
    ["back"],
    ["cancel"],
    ["retry"],
    ["duplicate", "stale"],
    ["side effect", "side effects"],
  ],
  "Feature endpoint artifacts": [
    ["feature"],
    ["endpoint"],
    ["rollback"],
    ["auth", "authentication"],
    ["metadata"],
  ],
  "Task hub resume artifacts": [
    ["task hub"],
    ["destination"],
    ["fallback"],
  ],
  "Rollback owner handoff artifacts": [
    ["rollback"],
    ["owner"],
    ["backup"],
    ["decision"],
    ["trigger"],
    ["endpoint"],
    ["fallback"],
    ["open-session", "open session"],
    ["privacy"],
  ],
  "Copy and accessibility artifacts": [
    ["copy"],
    ["accessibility"],
  ],
  "Analytics signal artifacts": [
    ["analytics"],
    ["signal"],
  ],
  "Analytics privacy artifacts": [
    ["analytics"],
    ["privacy"],
  ],
  "Run sheet validation artifacts": [
    ["run sheet"],
    ["validation"],
    ["matrix"],
  ],
  "Launch run plan artifacts": [
    ["launch"],
    ["run plan", "launch-evidence-run"],
    ["same-date", "same date"],
    ["same deployed-origin", "same deployed origin", "deployed origin"],
    ["endpoint"],
    ["auth metadata", "authentication metadata"],
    [
      "no credential value",
      "no credential values",
      "without credential value",
      "without credential values",
      "no secret value",
      "no secret values",
      "without secret value",
      "without secret values",
      "no token",
      "without token",
    ],
    ["artifact"],
  ],
  "Launch preflight artifacts": [
    ["final"],
    ["run sheet", "runsheet"],
    ["matrix"],
    ["packet"],
    ["run plan", "launch-evidence-run"],
    ["endpoint"],
    ["analytics"],
  ],
};

const requiredFlowPackets = [
  "Ride Voice Canvas",
  "Appointment Voice Canvas",
  "Medication Refill Voice Canvas",
  "Shopping Delivery Voice Canvas",
  "Provider Reply Voice Canvas",
  "Concierge Task Hub Resume",
] as const;

type RequiredFlowPacket = (typeof requiredFlowPackets)[number];

const flowPacketCoverageRequirements: Record<
  RequiredFlowPacket,
  readonly (readonly string[])[]
> = {
  "Ride Voice Canvas": [
    ["phone"],
    ["tablet"],
    ["desktop", "laptop"],
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["saved-place", "saved place", "address"],
    ["review"],
    ["explicit confirmation"],
    ["no booking"],
    ["call"],
    ["message"],
    ["navigation"],
    ["write"],
    ["duplicate"],
    ["stale"],
    ["rollback"],
    ["existing"],
    ["transport"],
  ],
  "Appointment Voice Canvas": [
    ["phone"],
    ["tablet"],
    ["desktop", "laptop"],
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["date/time", "date", "time"],
    ["review"],
    ["explicit confirmation"],
    ["no booking"],
    ["call"],
    ["message"],
    ["navigation"],
    ["write"],
    ["duplicate"],
    ["stale"],
    ["rollback"],
    ["existing"],
    ["appointment"],
  ],
  "Medication Refill Voice Canvas": [
    ["phone"],
    ["tablet"],
    ["desktop", "laptop"],
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["refill"],
    ["medication"],
    ["review"],
    ["explicit confirmation"],
    ["no refill request"],
    ["call"],
    ["message"],
    ["navigation"],
    ["write"],
    ["duplicate"],
    ["stale"],
    ["rollback"],
    ["existing"],
  ],
  "Shopping Delivery Voice Canvas": [
    ["phone"],
    ["tablet"],
    ["desktop", "laptop"],
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["shopping"],
    ["item"],
    ["retailer"],
    ["review"],
    ["explicit confirmation"],
    ["no order"],
    ["call"],
    ["message"],
    ["navigation"],
    ["write"],
    ["duplicate"],
    ["stale"],
    ["rollback"],
    ["existing"],
  ],
  "Provider Reply Voice Canvas": [
    ["phone"],
    ["tablet"],
    ["desktop", "laptop"],
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["provider"],
    ["reply"],
    ["review"],
    ["explicit confirmation"],
    ["no reply"],
    ["call"],
    ["message"],
    ["navigation"],
    ["completion"],
    ["write"],
    ["duplicate"],
    ["stale"],
    ["rollback"],
    ["existing"],
  ],
  "Concierge Task Hub Resume": [
    ["phone"],
    ["tablet"],
    ["desktop", "laptop"],
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["local shopping"],
    ["local medication"],
    ["pending provider"],
    ["stale", "blocked"],
    ["destination"],
    ["fallback"],
    ["existing"],
    ["no writes"],
    ["external actions"],
    ["explicit confirmation"],
  ],
};

const requiredEvidenceNotePatterns = [
  "Device coverage",
  "Interaction mode coverage",
  "Required behavior",
  "Feature endpoint and rollback",
  "Task hub destination fallback",
  "Rollback owner handoff",
  "Copy and accessibility",
  "Analytics signal",
  "Analytics privacy",
] as const;

type RequiredEvidenceNotePattern =
  (typeof requiredEvidenceNotePatterns)[number];

const evidenceNotePatternRequirements: Record<
  RequiredEvidenceNotePattern,
  readonly (readonly string[])[]
> = {
  "Device coverage": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["phone"],
    ["tablet"],
    ["desktop", "laptop"],
    ["transcripts"],
    ["entered text"],
    ["addresses"],
    ["personal details"],
  ],
  "Interaction mode coverage": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["voice"],
    ["touch"],
    ["keyboard"],
    ["completed", "safely exited"],
    ["transcripts"],
    ["entered text"],
    ["addresses"],
    ["personal details"],
  ],
  "Required behavior": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["start/resume"],
    ["app exit/reopen"],
    ["refresh/reconnect"],
    ["voice interruption"],
    ["browser back"],
    ["cancel/exit"],
    ["retry/exit"],
    ["no write"],
    ["no resubmission"],
    ["no external action"],
    ["explicit confirmation"],
    ["duplicate"],
    ["stale"],
  ],
  "Feature endpoint and rollback": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["endpoint"],
    ["server key"],
    ["disabled"],
    ["false"],
    ["rollout 0"],
    ["enabled"],
    ["true"],
    ["rollout 100"],
    ["malformed"],
    ["missing"],
    ["fail-closed"],
    ["rollback"],
    ["fallback"],
    ["sanitized"],
    ["expected-state"],
    ["cache-control"],
    ["no-store"],
    ["auth metadata", "authentication metadata"],
    ["run plan"],
    ["credential"],
  ],
  "Task hub destination fallback": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["task path"],
    ["resumed"],
    ["destination"],
    ["enabled"],
    ["fell back"],
    ["existing"],
    ["disabled"],
    ["rollout 0"],
    ["no writes"],
    ["no external actions"],
    ["explicit confirmation"],
  ],
  "Rollback owner handoff": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["operations/rollback owner", "rollback owner"],
    ["backup owner", "backup"],
    ["distinct", "separate", "different"],
    ["decision window", "decision"],
    ["rollback trigger", "trigger"],
    ["enable false", "disabled"],
    ["rollout 0"],
    ["rollback action", "action"],
    ["sanitized"],
    ["endpoint"],
    ["fallback"],
    ["open-session", "open session"],
    ["canvas closed", "closed", "hidden"],
    ["privacy boundary", "privacy"],
    ["fallback readiness", "readiness"],
  ],
  "Copy and accessibility": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["one clear decision"],
    ["spanish"],
    ["long-label"],
    ["overflow"],
    ["clipping"],
    ["truncation"],
    ["waiting"],
    ["pending"],
    ["no-action", "no action", "what has not happened", "has not happened"],
    ["blocked"],
    ["completed"],
    ["keyboard"],
    ["focus"],
    ["screen-reader"],
    ["reduced-motion"],
  ],
  "Analytics signal": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["launch signal"],
    ["source event"],
    ["aggregate"],
    ["positive"],
    ["allowed envelope"],
    ["non-identifying allowed values", "non identifying allowed values"],
    ["coveredflows"],
    ["ride"],
    ["appointment"],
    ["refill"],
    ["shopping"],
    ["provider_reply"],
    ["task_hub_resume"],
    ["started"],
    ["resumed"],
    ["abandoned"],
    ["blocked"],
    ["confirmed"],
    ["completed"],
    ["terminal pending"],
  ],
  "Analytics privacy": [
    ["reference"],
    ["reviewed"],
    ["reviewer"],
    ["forbidden data class"],
    ["absent"],
    ["not recorded"],
    ["logged"],
    ["sent"],
    ["captured"],
    ["included"],
    ["allowed envelope"],
    ["non-identifying allowed values", "non identifying allowed values"],
  ],
};

const finalPrefillChecklistRequirements: readonly (readonly string[])[] = [
  ["sanitized"],
  ["artifact"],
  ["reviewer/date", "reviewer", "date"],
  ["phone"],
  ["tablet"],
  ["desktop", "laptop"],
  ["voice"],
  ["touch"],
  ["keyboard"],
  ["rollback"],
  ["fallback"],
  ["canvas:qa:features"],
  ["deployed url"],
  ["expected-state"],
  ["auth metadata", "authentication metadata"],
  ["credential"],
  ["rollback owner"],
  ["backup"],
  ["decision"],
  ["trigger"],
  ["open-session", "open session"],
  ["task hub"],
  ["local shopping"],
  ["local medication"],
  ["pending provider"],
  ["stale", "blocked"],
  ["canvas:qa:runsheet"],
  ["run-sheet-summary.json"],
  ["canvas:qa:packet"],
  ["evidence-packet-summary.json"],
  ["run plan", "launch-evidence-run"],
  ["--date"],
  ["analytics"],
  ["coveredflows"],
  ["started"],
  ["resumed"],
  ["abandoned"],
  ["blocked"],
  ["confirmed"],
  ["completed"],
  ["canvas:qa:analytics"],
  ["canvas:qa:preflight"],
  ["--final"],
  ["privacy"],
  ["forbidden data"],
  ["absent"],
  ["personal details"],
] as const;

const unsafeReferencePatterns: readonly RegExp[] = [
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]*){10,}\b/,
  /https?:\/\/[^\s/|`]+:[^\s@/|`]+@[^\s|`]+/i,
  /\b(?:token|secret|api[_-]?key|authorization|cookie|password|session)[=:][^\s|`]+/i,
  /\bbearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\bx-api-key\s*[:=]\s*[^\s|`]+/i,
  /\b(?:transcript|spoken transcript|typed free text|free text|saved-place label|saved place label|pickup address|dropoff address|destination address|street address|ride details|route details|pickup details|dropoff details|destination details|appointment date|appointment time|date\/time details|medication name|medication details|provider name|provider details|provider contact|reply text|reply body|shopping item|shopping details|item name|retailer name|price|fee|contact details|account id|user id|profile id|patient id)\b/i,
];

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

function findTable(
  tables: readonly MarkdownTable[],
  section: string,
): MarkdownTable | undefined {
  return tables.find((table) => table.section === section);
}

function hasRequiredRow(table: MarkdownTable | undefined, value: string): boolean {
  return Boolean(table?.rows.some((row) => normalizeCell(row[0] ?? "") === value));
}

function cellIndex(table: MarkdownTable, header: string): number {
  return table.headers.findIndex(
    (candidate) => normalizeCell(candidate).toLowerCase() === header.toLowerCase(),
  );
}

function hasValidReviewerDate(value: string): boolean {
  const normalized = normalizeCell(value);
  const dateMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!dateMatch) return false;

  const date = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  if (date > todayUtc) return false;
  if (todayUtc.getTime() - date.getTime() > maxLaunchEvidenceAgeMs) {
    return false;
  }

  const reviewerPart = normalized.replace(dateMatch[0], "").replace(/[/-]/g, "").trim();
  return (
    reviewerPart.length >= 2 &&
    /\b(reviewed|verified|approved|signed off|sign-off|validated)\b/i.test(normalized)
  );
}

function artifactReferenceHasPlaceholder(value: string): boolean {
  return /\bYYYY-MM-DD\b|<[^>]+>|\[[^\]]+\]/.test(value);
}

function artifactReferenceLooksUnsafe(value: string): boolean {
  const filenameFriendlyValue = value.replace(/[-_]+/g, " ");
  return unsafeReferencePatterns.some(
    (pattern) => pattern.test(value) || pattern.test(filenameFriendlyValue),
  );
}

function hasContradictoryLaunchEvidenceLanguage(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (isPendingCell(normalized)) return false;
  return (
    /\b(known issue|known issues|known bug|known bugs|unresolved issue|unresolved issues|unresolved bug|unresolved bugs|defect|defects|regression|regressions|risk accepted|accepted risk|launch risk|workaround required|manual workaround|waiver|exception)\b/.test(
      normalized,
    ) ||
    /\b(?:write|writes|external action|external actions|booking|bookings|call|calls|message|messages|navigation|navigations|reply|replies|refill request|order|orders|submission|submissions|endpoint|endpoints)\b.{0,36}\b(?:happened|occurred|triggered|fired|ran|sent|submitted|created|wrote|called|messaged|navigated|booked|ordered)\b/.test(
      normalized,
    ) ||
    /\b(?:triggered|fired|ran|sent|submitted|created|wrote|called|messaged|navigated|booked|ordered)\b.{0,36}\b(?:write|writes|external action|external actions|booking|bookings|call|calls|message|messages|navigation|navigations|reply|replies|refill request|order|orders|submission|submissions|endpoint|endpoints)\b/.test(
      normalized,
    ) ||
    /\b(?:fallback|rollback|canvas|draft|entered information|current scene|current work|focus|screen-reader|screen reader|announcement|announcements|spanish|long labels|analytics|voice|touch|keyboard|reconnect|refresh|interruption|browser back|retry|exit|task hub|destination)\b.{0,36}\b(?:unavailable|not available|not visible|not shown|not working|not preserved|not restored|not recovered|not readable|not announced|failed|broken)\b/.test(
      normalized,
    ) ||
    /\b(?:unavailable|not available|not visible|not shown|not working|not preserved|not restored|not recovered|not readable|not announced|failed|broken)\b.{0,36}\b(?:fallback|rollback|canvas|draft|entered information|current scene|current work|focus|screen-reader|screen reader|announcement|announcements|spanish|long labels|analytics|voice|touch|keyboard|reconnect|refresh|interruption|browser back|retry|exit|task hub|destination)\b/.test(
      normalized,
    )
  );
}

function artifactReferenceLooksConcrete(value: string): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  const hasDate = /\b\d{4}-\d{2}-\d{2}\b/.test(normalized);
  const hasArtifactPathOrLink =
    /\b(?:https?:\/\/|voice-canvas\/|artifacts\/|dashboard|query|log|trace|capture|recording|screenshot|photo|json|artifact|link)\b/.test(
      normalized,
    );
  const hasOnlyGenericReviewLanguage =
    /\b(reviewed|verified|checked|captured|evidence|artifact)\b/.test(normalized) &&
    !/[/.]/.test(normalized) &&
    !/\b(?:dashboard|query|log|trace|capture|recording|screenshot|photo|json|link)\b/.test(
      normalized,
    );

  return hasDate && hasArtifactPathOrLink && !hasOnlyGenericReviewLanguage;
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

function flowPacketArtifactRequirements(
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

function invalidFlowPacketCanonicalDetails(
  flowTable: MarkdownTable | undefined,
): string[] {
  if (!flowTable) return [];
  const problems: string[] = [];
  const coverageIndex = cellIndex(flowTable, "Required packet coverage");
  if (coverageIndex === -1) return problems;

  for (const flow of canvasLaunchReadinessFlows) {
    const row = flowTable.rows.find(
      (candidate) => normalizeCell(candidate[0] ?? "") === flow.label,
    );
    if (!row) continue;

    const coverage = normalizeCell(row[coverageIndex] ?? "");
    if (!coverage || isPendingCell(coverage)) continue;

    if (!hasAllCoverageTerms(coverage, flow.surfaces.map((surface) => [surface]))) {
      problems.push(
        `${flow.label}: flow packet checklist must name every canonical launch entry surface.`,
      );
    }

    const canonicalPathRequirements = flow.featureFlag
      ? [
          ["explicit confirmation"],
          ["waiting"],
          ["completed", "saved"],
          ["blocked"],
        ]
      : [
          ["resume"],
          ["stale", "blocked"],
        ];
    if (!hasAllCoverageTerms(coverage, canonicalPathRequirements)) {
      problems.push(
        `${flow.label}: flow packet checklist must name the canonical launch path to exercise.`,
      );
    }

    const expectedFallback =
      flow.featureFlag?.fallback ?? "safe existing destination path";
    if (!hasAllCoverageTerms(coverage, [[expectedFallback]])) {
      problems.push(
        `${flow.label}: flow packet checklist must name the expected fallback path.`,
      );
    }

    if (!hasAllCoverageTerms(coverage, flowPacketArtifactRequirements(flow.id))) {
      problems.push(
        `${flow.label}: flow packet checklist must name the required sanitized artifact categories.`,
      );
    }
  }

  return problems;
}

function hasDatePlaceholderOrConcreteDate(value: string): boolean {
  const normalized = normalizeCell(value);
  return /\[(?:YYYY-MM-DD|\d{4}-\d{2}-\d{2})\]/.test(normalized);
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

function evaluateEvidencePacket(markdown: string) {
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
      problems.push(`Missing required evidence packet section: ${section}.`);
    }
  }

  const finalPrefillContent = sectionContent(markdown, "Final pre-fill check");
  if (
    finalPrefillContent &&
    !hasAllCoverageTerms(finalPrefillContent, finalPrefillChecklistRequirements)
  ) {
    problems.push(
      "Final pre-fill check is missing required launch-readiness checklist coverage.",
    );
  }

  const inventoryTable = findTable(tables, "Evidence packet inventory");
  for (const artifactSet of requiredInventoryArtifactSets) {
    if (!hasRequiredRow(inventoryTable, artifactSet)) {
      problems.push(`Missing evidence packet inventory row: ${artifactSet}.`);
    }
  }

  const flowTable = findTable(tables, "Flow packet checklist");
  for (const flow of requiredFlowPackets) {
    if (!hasRequiredRow(flowTable, flow)) {
      problems.push(`Missing flow packet checklist row: ${flow}.`);
    }
  }
  if (flowTable) {
    const coverageIndex = cellIndex(flowTable, "Required packet coverage");
    if (coverageIndex === -1) {
      problems.push("Flow packet checklist is missing the Required packet coverage column.");
    } else {
      for (const flow of requiredFlowPackets) {
        const row = flowTable.rows.find(
          (candidate) => normalizeCell(candidate[0] ?? "") === flow,
        );
        if (!row) continue;

        const coverage = normalizeCell(row[coverageIndex] ?? "");
        if (
          coverage &&
          !isPendingCell(coverage) &&
          !hasAllCoverageTerms(coverage, flowPacketCoverageRequirements[flow])
        ) {
          problems.push(
            `Flow packet checklist row "${flow}" does not include the required launch-safety coverage.`,
          );
        }
      }
    }
    problems.push(...invalidFlowPacketCanonicalDetails(flowTable));
  }

  const notePatternTable = findTable(tables, "Copy-ready evidence note patterns");
  for (const pattern of requiredEvidenceNotePatterns) {
    if (!hasRequiredRow(notePatternTable, pattern)) {
      problems.push(`Missing copy-ready evidence note pattern row: ${pattern}.`);
    }
  }
  if (notePatternTable) {
    const patternIndex = cellIndex(notePatternTable, "Evidence note pattern");
    if (patternIndex === -1) {
      problems.push(
        "Copy-ready evidence note patterns is missing the Evidence note pattern column.",
      );
    } else {
      for (const pattern of requiredEvidenceNotePatterns) {
        const row = notePatternTable.rows.find(
          (candidate) => normalizeCell(candidate[0] ?? "") === pattern,
        );
        if (!row) continue;

        const notePattern = normalizeCell(row[patternIndex] ?? "");
        if (
          notePattern &&
          !isPendingCell(notePattern) &&
          (!hasDatePlaceholderOrConcreteDate(notePattern) ||
            !hasAllCoverageTerms(notePattern, evidenceNotePatternRequirements[pattern]))
        ) {
          problems.push(
            `Copy-ready evidence note pattern "${pattern}" is missing required launch evidence wording.`,
          );
        }
      }
    }
  }

  if (inventoryTable) {
    const referenceIndex = cellIndex(inventoryTable, "Suggested sanitized reference");
    const coverageIndex = cellIndex(inventoryTable, "Matrix rows it should prove");
    const reviewerIndex = cellIndex(inventoryTable, "Reviewer/date");
    if (referenceIndex === -1) {
      problems.push(
        "Evidence packet inventory is missing the Suggested sanitized reference column.",
      );
    }
    if (coverageIndex === -1) {
      problems.push(
        "Evidence packet inventory is missing the Matrix rows it should prove column.",
      );
    }
    if (reviewerIndex === -1) {
      problems.push("Evidence packet inventory is missing the Reviewer/date column.");
    }

    for (const row of inventoryTable.rows) {
      const artifactSet = normalizeCell(row[0] ?? "Unknown artifact set");
      const reference =
        referenceIndex >= 0 ? normalizeCell(row[referenceIndex] ?? "") : "";
      const coverage = coverageIndex >= 0 ? normalizeCell(row[coverageIndex] ?? "") : "";
      const reviewerDate =
        reviewerIndex >= 0 ? normalizeCell(row[reviewerIndex] ?? "") : "";

      const coverageRequirements =
        inventoryCoverageRequirements[artifactSet as RequiredInventoryArtifactSet];
      if (
        coverageRequirements &&
        coverage &&
        !isPendingCell(coverage) &&
        !hasAllCoverageTerms(coverage, coverageRequirements)
      ) {
        problems.push(
          `Evidence packet inventory row "${artifactSet}" does not map the artifact to the required launch evidence coverage.`,
        );
      }

      if (reference && !isPendingCell(reference) && artifactReferenceLooksUnsafe(reference)) {
        problems.push(
          `Evidence packet inventory row "${artifactSet}" has an artifact reference that appears to include personal or raw captured data.`,
        );
      }

      if (
        reference &&
        !isPendingCell(reference) &&
        !isPendingCell(reviewerDate) &&
        artifactReferenceHasPlaceholder(reference)
      ) {
        problems.push(
          `Evidence packet inventory row "${artifactSet}" still uses a placeholder artifact reference.`,
        );
      }

      if (
        reference &&
        !isPendingCell(reference) &&
        !artifactReferenceHasPlaceholder(reference) &&
        !artifactReferenceLooksUnsafe(reference) &&
        !artifactReferenceLooksConcrete(reference)
      ) {
        problems.push(
          `Evidence packet inventory row "${artifactSet}" needs a concrete dated sanitized artifact reference or link.`,
        );
      }

      if (
        reviewerDate &&
        !isPendingCell(reviewerDate) &&
        !hasValidReviewerDate(reviewerDate)
      ) {
        problems.push(
          `Evidence packet inventory row "${artifactSet}" needs a reviewer, explicit review wording, and a non-future YYYY-MM-DD date no older than 7 days.`,
        );
      }
    }
  }

  const pendingSections = summarizePendingCellsBySection(tables);
  const incompleteCellCount = pendingSections.reduce(
    (total, section) => total + section.pendingCells,
    0,
  );
  const contradictoryLaunchEvidenceCellCount =
    countContradictoryLaunchEvidenceCells(tables);
  if (contradictoryLaunchEvidenceCellCount > 0) {
    problems.push(
      `Evidence packet contains ${contradictoryLaunchEvidenceCellCount} filled cell(s) with contradictory or unsafe launch evidence wording; resolve the underlying QA issue before sign-off.`,
    );
  }
  const readyForLaunchEvidencePacket =
    problems.length === 0 && incompleteCellCount === 0;

  return {
    readyForLaunchEvidencePacket,
    state: readyForLaunchEvidencePacket
      ? "ready"
      : problems.length > 0
        ? "invalid"
        : "pending",
    incompleteCellCount,
    pendingSections,
    problemCount: problems.length,
    problems,
  };
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Validate the Voice Canvas real-device evidence packet before filling the QA matrix.",
      "",
      "Usage:",
      "  npm run canvas:qa:packet",
      "  npm run canvas:qa:packet -- --allow-pending",
      "  npm run --silent canvas:qa:packet -- --allow-pending --json",
      "  npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json",
      "  npm run canvas:qa:packet -- docs/audits/voice-canvas-real-device-evidence-packet.md",
      "",
      "The command exits non-zero unless the packet has no pending cells and no structural or privacy-safety problems.",
      "Use --allow-pending for in-progress review of the committed packet template.",
      "Use --json to emit machine-readable summary output for QA artifacts or CI.",
      "Use --output=<path> with --json to also save the summary to a file.",
      "Existing output files are preserved by default; pass --force only when intentionally replacing one.",
      "Flow packet rows must keep per-flow safety coverage for device classes, interaction modes, review, explicit confirmation, no pre-confirmation side effects, duplicate prevention, stale response handling, fallback rollback, canonical entry surfaces, canonical path states, fallback paths, and sanitized artifact categories.",
      "Copy-ready evidence note patterns must keep reference, reviewer/date, privacy, no-side-effect, rollback, accessibility, and analytics wording needed by the final QA matrix.",
      "The final pre-fill checklist must keep the required artifact, device, interaction, rollback, endpoint, task hub, run-sheet validation, analytics, preflight, and privacy checks.",
      "Inventory references must point to concrete dated sanitized artifact paths or links, not generic review prose.",
      "Inventory coverage cells must map each artifact set to the required environment, entry surface, device, interaction, behavior, endpoint, task hub, copy/accessibility, analytics, privacy, run-sheet validation, or preflight evidence.",
      "Inventory reviewer/date cells must include a non-future YYYY-MM-DD date no older than 7 days and explicit reviewed, verified, validated, approved, or sign-off wording.",
      "Problems never copy raw artifact-reference values, so accidental personal details, token-bearing URLs, bearer tokens, cookies, passwords, or API keys are not repeated in validator output.",
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

const packetArg = args.find((arg) => !arg.startsWith("-"));
const packetPath = path.resolve(process.cwd(), packetArg ?? defaultPacketPath);
const packet = readFileSync(packetPath, "utf8");
const result = evaluateEvidencePacket(packet);
const relativePacketPath = path.relative(process.cwd(), packetPath);
const acceptedPending =
  allowPending && result.state === "pending" && result.problemCount === 0;
const nextPendingSection = [...result.pendingSections].sort(
  (a, b) => b.pendingCells - a.pendingCells,
)[0];

function failureMessage(): string {
  if (result.problemCount > 0) return "Evidence packet is not ready.";
  if (result.state === "pending") {
    return "Evidence packet is still pending. Fill artifact references and reviewer/date cells with explicit reviewed, verified, validated, approved, or sign-off wording before final matrix sign-off.";
  }
  return "Evidence packet is not ready.";
}

const exitCode = result.readyForLaunchEvidencePacket || acceptedPending ? 0 : 1;

if (jsonOutput) {
  const jsonSummary = JSON.stringify(
    {
      packetPath: relativePacketPath,
      state: result.state,
      readyForLaunchEvidencePacket: result.readyForLaunchEvidencePacket,
      incompleteCellCount: result.incompleteCellCount,
      pendingSections: result.pendingSections,
      nextPendingSection: nextPendingSection ?? null,
      problemCount: result.problemCount,
      problems: result.problems,
      allowPending,
      acceptedPending,
      message: result.readyForLaunchEvidencePacket
        ? "Evidence packet is ready for QA matrix sign-off."
        : acceptedPending
          ? "Evidence packet is still pending, but its structure is valid."
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

console.log(`Canvas evidence packet: ${relativePacketPath}`);
console.log(`State: ${result.state}`);
console.log(
  `Ready for QA matrix sign-off: ${result.readyForLaunchEvidencePacket ? "yes" : "no"}`,
);
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

if (result.readyForLaunchEvidencePacket) {
  console.log("Evidence packet is ready for QA matrix sign-off.");
  process.exit(0);
}

if (acceptedPending) {
  console.log("Evidence packet is still pending, but its structure is valid.");
  process.exit(0);
}

if (result.problemCount > 0) {
  console.error("Evidence packet is not ready:");
  for (const problem of result.problems) {
    console.error(`- ${problem}`);
  }
} else if (result.state === "pending") {
  console.error(
    "Evidence packet is still pending. Fill artifact references and reviewer/date cells with explicit reviewed, verified, validated, approved, or sign-off wording before final matrix sign-off.",
  );
} else {
  console.error("Evidence packet is not ready.");
}

process.exit(1);
