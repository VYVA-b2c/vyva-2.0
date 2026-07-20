import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS,
  CANVAS_LAUNCH_FLOW_IDS,
  type CanvasLaunchFlowId,
} from "../src/components/voice-canvas/canvasLaunchReadiness";
import {
  CANVAS_LAUNCH_SIGNALS,
  canvasLaunchTelemetrySampleFromEnvelope,
  emptyCanvasLaunchTelemetryCounts,
  isCanvasTelemetryEnvelope,
  type CanvasLaunchTelemetryCounts,
} from "../src/components/voice-canvas/canvasLaunchTelemetry";
import type { CanvasLaunchSignal } from "../src/components/voice-canvas/canvasPlatform";

interface AnalyticsEvidenceSummary {
  inputPath: string;
  readyForLaunchEvidence: boolean;
  generatedAt: string;
  qaRunUrl: string;
  requiredSignals: readonly CanvasLaunchSignal[];
  allowedEnvelopeFields: readonly string[];
  coveredFlows: readonly CanvasLaunchFlowId[];
  sampleCount: number;
  sampleLaunchSignalCounts: CanvasLaunchTelemetryCounts;
  declaredCounts: Partial<CanvasLaunchTelemetryCounts> | null;
  problemCount: number;
  problems: string[];
}

const args = process.argv.slice(2);
const allowedEnvelopeFields = [...CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS];
const allowedTopLevelKeys = [
  "generatedAt",
  "qaRunUrl",
  "source",
  "coveredFlows",
  "counts",
  "samples",
  "events",
] as const;
const maxLaunchEvidenceAgeMs = 7 * 24 * 60 * 60 * 1000;
const unsafeAnalyticsMetadataPatterns: readonly RegExp[] = [
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]*){10,}\b/,
  /\b(?:transcript|spoken transcript|typed free text|free text|saved-place label|saved place label|pickup address|dropoff address|destination address|street address|ride details|route details|pickup details|dropoff details|destination details|appointment date|appointment time|date\/time details|medication name|medication details|provider name|provider details|provider contact|reply text|reply body|shopping item|shopping details|item name|retailer name|price|fee|contact details|account id|user id|profile id|patient id)\b/i,
];

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Validate a sanitized Voice Canvas analytics evidence artifact.",
      "",
      "Usage:",
      "  npm run --silent canvas:qa:analytics -- --template",
      "  npm run canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json",
      "  npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json",
      "  npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json",
      "",
      "Use --template to print a privacy-safe JSON skeleton. The template is intentionally not launch-ready until generatedAt, qaRunUrl, source, counts, and sanitized sample envelopes are filled from real staging or production-like aggregate evidence.",
      "The input JSON must be an object with generatedAt, qaRunUrl, source, samples/events, and optional counts.",
      "generatedAt must be a non-future ISO timestamp no older than 7 days.",
      "qaRunUrl must be the deployed non-local QA run URL that produced the aggregate evidence.",
      "The source must identify staging, production, or a concrete analytics dashboard/query/export/log artifact.",
      "The source must not name addresses, transcripts, route details, shopping details, provider details, account identifiers, or other personal data.",
      "coveredFlows must list every launch flow: ride, appointment, refill, shopping, provider_reply, task_hub_resume.",
      "Every sample must contain only: name, step, input, attempt, restored, revision.",
      "Allowed envelope values must stay non-identifying; step text must not contain addresses, transcripts, route details, shopping details, provider details, account identifiers, or other personal data.",
      "Every launch signal must have a positive observed sample count: started, resumed, abandoned, blocked, confirmed, completed.",
      "Completed can be proven by completed samples or terminal pending samples.",
      "The command writes only aggregate validation results and never copies raw sample rows into its output.",
      "Use --output=<path> with --json to also save the validation summary to a file.",
      "Existing output files are preserved by default; pass --force only when intentionally replacing one.",
    ].join("\n"),
  );
  process.exit(0);
}

const jsonOutput = args.includes("--json");
const forceOutput = args.includes("--force");
const templateOutput = args.includes("--template");
const inputPathArg =
  readArgValue("--input") ?? args.find((arg) => !arg.startsWith("-"));
const outputPathArg = readArgValue("--output");

function analyticsEvidenceTemplate() {
  return {
    generatedAt: "REPLACE_WITH_NON_FUTURE_ISO_TIMESTAMP_WITHIN_7_DAYS",
    qaRunUrl: "REPLACE_WITH_DEPLOYED_NON_LOCAL_QA_RUN_URL",
    source: "REPLACE_WITH_STAGING_DASHBOARD_QUERY_OR_EXPORT_REFERENCE",
    coveredFlows: [...CANVAS_LAUNCH_FLOW_IDS],
    counts: {
      started: 0,
      resumed: 0,
      abandoned: 0,
      blocked: 0,
      confirmed: 0,
      completed: 0,
    },
    samples: [],
  };
}

if (templateOutput) {
  console.log(`${JSON.stringify(analyticsEvidenceTemplate(), null, 2)}\n`);
  process.exit(0);
}

if (!inputPathArg) {
  console.error("Expected --input=<analytics evidence JSON path>.");
  process.exit(1);
}

if (outputPathArg === "") {
  console.error("Expected --output=<path>.");
  process.exit(1);
}

if (outputPathArg && !jsonOutput) {
  console.error("Use --output only with --json.");
  process.exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJsonFile(inputPath: string): unknown {
  try {
    return JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not read analytics evidence JSON: ${message}`);
    process.exit(1);
  }
}

function normalizeSamples(artifact: unknown): unknown[] {
  if (!isRecord(artifact)) return [];

  const samples: unknown[] = [];
  if (Array.isArray(artifact.samples)) samples.push(...artifact.samples);
  if (Array.isArray(artifact.events)) samples.push(...artifact.events);
  return samples;
}

function extractDeclaredCounts(
  artifact: unknown,
  problems: string[],
): Partial<CanvasLaunchTelemetryCounts> | null {
  if (!isRecord(artifact) || artifact.counts === undefined) return null;
  if (!isRecord(artifact.counts)) {
    problems.push("Counts must be an object when provided.");
    return null;
  }

  const counts: Partial<CanvasLaunchTelemetryCounts> = {};
  const unexpectedCountKeyCount = Object.keys(artifact.counts).filter(
    (key) => !CANVAS_LAUNCH_SIGNALS.includes(key as CanvasLaunchSignal),
  ).length;
  if (unexpectedCountKeyCount > 0) {
    problems.push(
      `Counts included ${unexpectedCountKeyCount} key(s) outside the launch signal set.`,
    );
  }

  for (const signal of CANVAS_LAUNCH_SIGNALS) {
    const value = artifact.counts[signal];
    if (value === undefined) continue;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      problems.push(`${signal}: declared count must be a non-negative integer.`);
      continue;
    }
    counts[signal] = value;
  }

  return counts;
}

function extractCoveredFlows(
  artifact: unknown,
  problems: string[],
): readonly CanvasLaunchFlowId[] {
  if (!isRecord(artifact) || !Array.isArray(artifact.coveredFlows)) {
    problems.push(
      "Analytics evidence must include coveredFlows with every launch-scoped flow id.",
    );
    return [];
  }

  const expected = new Set<string>(CANVAS_LAUNCH_FLOW_IDS);
  const covered = new Set<CanvasLaunchFlowId>();
  let invalidEntryCount = 0;
  let duplicateEntryCount = 0;

  for (const entry of artifact.coveredFlows) {
    if (typeof entry !== "string" || !expected.has(entry)) {
      invalidEntryCount += 1;
      continue;
    }

    if (covered.has(entry as CanvasLaunchFlowId)) {
      duplicateEntryCount += 1;
      continue;
    }
    covered.add(entry as CanvasLaunchFlowId);
  }

  if (invalidEntryCount > 0) {
    problems.push(
      `coveredFlows included ${invalidEntryCount} value(s) outside the launch flow set.`,
    );
  }
  if (duplicateEntryCount > 0) {
    problems.push(`coveredFlows included ${duplicateEntryCount} duplicate value(s).`);
  }

  for (const flowId of CANVAS_LAUNCH_FLOW_IDS) {
    if (!covered.has(flowId)) {
      problems.push(`${flowId}: coveredFlows must include this launch flow.`);
    }
  }

  return CANVAS_LAUNCH_FLOW_IDS.filter((flowId) => covered.has(flowId));
}

function topLevelProblems(artifact: unknown): string[] {
  if (!isRecord(artifact)) {
    return ["Analytics evidence must be a JSON object."];
  }

  const problems: string[] = [];
  const unexpectedTopLevelKeyCount = Object.keys(artifact).filter(
    (key) => !allowedTopLevelKeys.includes(key as (typeof allowedTopLevelKeys)[number]),
  ).length;

  if (unexpectedTopLevelKeyCount > 0) {
    problems.push(
      `Evidence artifact included ${unexpectedTopLevelKeyCount} top-level key(s) outside the allowed schema.`,
    );
  }

  const generatedAt = parseValidNonFutureGeneratedAt(artifact.generatedAt);
  if (!generatedAt) {
    problems.push(
      "Analytics evidence must include generatedAt as a non-future ISO timestamp.",
    );
  } else if (Date.now() - generatedAt.getTime() > maxLaunchEvidenceAgeMs) {
    problems.push("Analytics evidence generatedAt must be no older than 7 days.");
  }

  if (metadataLooksUnsafe(artifact.source)) {
    problems.push(
      "Analytics evidence source appears to include personal or raw captured data.",
    );
  } else if (!hasConcreteAnalyticsSource(artifact.source)) {
    problems.push(
      "Analytics evidence source must identify staging, production, or a concrete analytics dashboard/query/export/log artifact.",
    );
  }

  if (!isDeployedQaRunUrl(artifact.qaRunUrl)) {
    problems.push(
      "Analytics evidence qaRunUrl must be a deployed HTTPS non-local QA run URL.",
    );
  }

  return problems;
}

function parseValidNonFutureGeneratedAt(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  const valid =
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === value &&
    parsed.getTime() <= Date.now();
  return valid ? parsed : null;
}

function isDeployedQaRunUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:") return false;
    if (url.username || url.password || url.search || url.hash) return false;
    if (
      host === "localhost" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host === "example.com" ||
      host.includes("mock") ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".test") ||
      host.endsWith(".example")
    ) {
      return false;
    }
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
      return false;
    }
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

function hasConcreteAnalyticsSource(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase().trim();
  if (normalized.length < 8) return false;
  if (/\b(localhost|local only|developer smoke|mock|fixture|fake)\b/.test(normalized)) {
    return false;
  }
  return /\b(staging|production|prod|dashboard|query|export|log|artifact)\b/.test(
    normalized,
  );
}

function metadataLooksUnsafe(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const filenameFriendlyValue = value.replace(/[-_]+/g, " ");
  return unsafeAnalyticsMetadataPatterns.some(
    (pattern) => pattern.test(value) || pattern.test(filenameFriendlyValue),
  );
}

function sampleEnvelopeProblems(
  sample: unknown,
  index: number,
): { problems: string[]; signal: CanvasLaunchSignal | null } {
  const problems: string[] = [];
  if (!isRecord(sample)) {
    return {
      problems: [`Sample ${index + 1} must be a JSON object.`],
      signal: null,
    };
  }

  const unexpectedFieldCount = Object.keys(sample).filter(
    (key) => !allowedEnvelopeFields.includes(key),
  ).length;

  if (unexpectedFieldCount > 0) {
    problems.push(
      `Sample ${index + 1} included ${unexpectedFieldCount} field(s) outside the allowed telemetry envelope.`,
    );
  }
  const unsafeAllowedValueCount = Object.entries(sample).filter(
    ([key, value]) =>
      allowedEnvelopeFields.includes(key) &&
      typeof value === "string" &&
      metadataLooksUnsafe(value),
  ).length;
  if (unsafeAllowedValueCount > 0) {
    problems.push(
      `Sample ${index + 1} included ${unsafeAllowedValueCount} allowed envelope value(s) that appear to contain personal or raw captured data.`,
    );
  }

  if (!isCanvasTelemetryEnvelope(sample)) {
    problems.push(`Sample ${index + 1} is not a valid Canvas telemetry envelope.`);
    return { problems, signal: null };
  }

  const launchSample = canvasLaunchTelemetrySampleFromEnvelope(sample);
  return { problems, signal: launchSample?.signal ?? null };
}

function validateAnalyticsEvidence(inputPath: string): AnalyticsEvidenceSummary {
  const artifact = parseJsonFile(inputPath);
  const relativeInputPath = path.relative(process.cwd(), inputPath);
  const problems = topLevelProblems(artifact);
  const generatedAt = isRecord(artifact)
    ? parseValidNonFutureGeneratedAt(artifact.generatedAt)
    : null;
  const declaredCounts = extractDeclaredCounts(artifact, problems);
  const coveredFlows = extractCoveredFlows(artifact, problems);
  const samples = normalizeSamples(artifact);
  const sampleLaunchSignalCounts = emptyCanvasLaunchTelemetryCounts();

  if (samples.length === 0) {
    problems.push(
      "Analytics evidence must include sanitized sample envelopes in samples or events.",
    );
  }

  samples.forEach((sample, index) => {
    const result = sampleEnvelopeProblems(sample, index);
    problems.push(...result.problems);
    if (result.signal) {
      sampleLaunchSignalCounts[result.signal] += 1;
    }
  });

  for (const signal of CANVAS_LAUNCH_SIGNALS) {
    const sampleCount = sampleLaunchSignalCounts[signal];
    if (sampleCount <= 0) {
      problems.push(`${signal}: sample evidence must include a positive observed count.`);
    }

    if (declaredCounts) {
      const declaredCount = declaredCounts[signal];
      if (declaredCount === undefined || declaredCount <= 0) {
        problems.push(`${signal}: declared aggregate count must be positive.`);
      } else if (declaredCount < sampleCount) {
        problems.push(
          `${signal}: declared aggregate count cannot be lower than observed sample count.`,
        );
      }
    }
  }

  return {
    inputPath: relativeInputPath,
    readyForLaunchEvidence: problems.length === 0,
    generatedAt: generatedAt ? generatedAt.toISOString() : "unknown",
    qaRunUrl: isRecord(artifact) && typeof artifact.qaRunUrl === "string"
      ? artifact.qaRunUrl
      : "unknown",
    requiredSignals: CANVAS_LAUNCH_SIGNALS,
    allowedEnvelopeFields,
    coveredFlows,
    sampleCount: samples.length,
    sampleLaunchSignalCounts,
    declaredCounts,
    problemCount: problems.length,
    problems,
  };
}

function writeJsonOutput(outputPathArg: string, jsonSummary: string) {
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

function printTextSummary(summary: AnalyticsEvidenceSummary) {
  console.log(`Voice Canvas analytics evidence: ${summary.inputPath}`);
  console.log(
    `Ready for launch evidence: ${summary.readyForLaunchEvidence ? "yes" : "no"}`,
  );
  console.log(`Samples checked: ${summary.sampleCount}`);
  console.log("Observed launch signal sample counts:");
  for (const signal of CANVAS_LAUNCH_SIGNALS) {
    console.log(`- ${signal}: ${summary.sampleLaunchSignalCounts[signal]}`);
  }

  if (summary.problems.length > 0) {
    console.error("Analytics evidence is not ready:");
    for (const problem of summary.problems) {
      console.error(`- ${problem}`);
    }
  }
}

const inputPath = path.resolve(process.cwd(), inputPathArg);
const summary = validateAnalyticsEvidence(inputPath);
const exitCode = summary.readyForLaunchEvidence ? 0 : 1;

if (jsonOutput) {
  const jsonSummary = JSON.stringify(summary, null, 2);
  if (outputPathArg) {
    writeJsonOutput(outputPathArg, jsonSummary);
  }
  console.log(jsonSummary);
} else {
  printTextSummary(summary);
}

process.exitCode = exitCode;
