import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type CanvasLaunchFeatureFlag,
  type CanvasLaunchReadinessFlow,
  canvasLaunchReadinessFlows,
} from "../src/components/voice-canvas/canvasLaunchReadiness";

type FeatureFlaggedCanvasFlow = CanvasLaunchReadinessFlow & {
  featureFlag: CanvasLaunchFeatureFlag;
};

interface EndpointEvidence {
  id: string;
  label: string;
  endpoint: string;
  serverFeatureKey: string;
  fallback: string;
  url: string;
  ok: boolean;
  status: number | null;
  cacheControl: string | null;
  elapsedMs: number;
  enabled: boolean | null;
  rolloutPercent: number | null;
  payloadKeys: readonly ("enabled" | "rolloutPercent")[];
  unexpectedPayloadKeyCount: number;
  problems: string[];
}

interface EndpointEvidenceSummary {
  generatedAt: string;
  baseUrl: string;
  scope: string;
  expectedState: ExpectedEndpointState | null;
  authenticatedRequest: boolean;
  requestHeaderCount: number;
  endpointCount: number;
  readyForQaEvidence: boolean;
  featureEndpoints: EndpointEvidence[];
  problemCount: number;
  problems: string[];
}

const args = process.argv.slice(2);
const expectedPayloadKeys = ["enabled", "rolloutPercent"] as const;
const expectedEndpointStates = ["enabled", "rollback-disabled"] as const;
type ExpectedEndpointState = (typeof expectedEndpointStates)[number];

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
}

function readArgValues(name: string): string[] {
  const prefix = `${name}=`;
  return args
    .filter((arg) => arg.startsWith(prefix))
    .map((arg) => arg.slice(prefix.length).trim());
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Collect sanitized Voice Canvas feature endpoint evidence from a deployed environment.",
      "",
      "Usage:",
      "  npm run --silent canvas:qa:features -- --trace-template",
      "  npm run canvas:qa:features -- --base-url=https://staging.vyva.app",
      "  npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --json",
      "  npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json",
      "  npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
      "",
      "Use --trace-template to print a manifest-filled manual evidence template for malformed-config and missing-config fail-closed traces.",
      "The command performs GET requests only and never writes application data.",
      "By default, local/private/example hosts are rejected so staging evidence is not confused with local smoke testing.",
      "Launch evidence must use HTTPS unless --allow-local is explicitly passed for developer smoke checks.",
      "Use --allow-local only for local command tests or developer smoke checks.",
      "Use --expected-state=enabled for enabled true/rollout 100 launch evidence.",
      "Use --expected-state=rollback-disabled for disabled false/rollout 0 rollback evidence.",
      "Use --json to emit machine-readable endpoint evidence for QA artifacts.",
      "Use --output=<path> with --json to also save the evidence to a file.",
      "Failed endpoint evidence is printed but not saved unless --save-failed is passed for diagnostic artifacts.",
      "Use --request-header-env=Header-Name:ENV_NAME for authenticated QA or preview gateways; header values are never printed or saved.",
      "Existing output files are preserved by default; pass --force only when intentionally replacing one.",
    ].join("\n"),
  );
  process.exit(0);
}

const baseUrlArg = readArgValue("--base-url");
const jsonOutput = args.includes("--json");
const allowLocal = args.includes("--allow-local");
const forceOutput = args.includes("--force");
const saveFailedOutput = args.includes("--save-failed");
const traceTemplateOutput = args.includes("--trace-template");
const outputPathArg = readArgValue("--output");
const expectedStateArg = readArgValue("--expected-state");
const requestHeaderEnvArgs = readArgValues("--request-header-env");

function featureEndpointTraceTemplate(): string {
  const lines = [
    "Voice Canvas feature endpoint manual trace template",
    "",
    "Use this copy-safe template for malformed-config and missing-config evidence that cannot be collected by canvas:qa:features.",
    "Replace bracketed placeholders only. Do not paste raw response bodies, environment variable values, screenshots with personal data, unexpected payload field names, transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data.",
  ];

  for (const flow of featureFlaggedFlows()) {
    lines.push(
      "",
      `## ${flow.label}`,
      "",
      "Feature endpoint manual trace evidence, reviewed on [YYYY-MM-DD] by [reviewer]:",
      `- Flow: ${flow.label}`,
      `- Endpoint: ${flow.featureFlag.endpoint}`,
      `- Server key: ${flow.featureFlag.serverFeatureKey}`,
      "- Malformed config artifact: [sanitized deployment log/trace/artifact reference]",
      "- Missing config artifact: [sanitized deployment log/trace/artifact reference]",
      `- Observed malformed-config behavior: fail-closed disabled false/rollout 0 and ${flow.featureFlag.fallback} visible`,
      `- Observed missing-config behavior: fail-closed disabled false/rollout 0 and ${flow.featureFlag.fallback} visible`,
      "- Privacy check: artifact contains no raw response body, unexpected field names, transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data",
    );
  }

  return lines.join("\n");
}

if (traceTemplateOutput) {
  console.log(`${featureEndpointTraceTemplate()}\n`);
  process.exit(0);
}

if (!baseUrlArg) {
  console.error("Expected --base-url=<deployed app URL>.");
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

function parseExpectedState(value: string | undefined): ExpectedEndpointState | null {
  if (!value) return null;
  if (expectedEndpointStates.includes(value as ExpectedEndpointState)) {
    return value as ExpectedEndpointState;
  }

  console.error("Expected --expected-state to be enabled or rollback-disabled.");
  process.exit(1);
}

function parseBaseUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    console.error(`Invalid --base-url: ${value}`);
    process.exit(1);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    console.error("Expected --base-url to use http or https.");
    process.exit(1);
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    console.error("Expected --base-url to be an origin URL without credentials, query, or hash.");
    process.exit(1);
  }

  if (!allowLocal && isLocalOrPlaceholderHost(parsed.hostname)) {
    console.error(
      "Refusing to collect launch evidence from a local, private, or placeholder host. Use --allow-local only for developer smoke checks.",
    );
    process.exit(1);
  }

  if (!allowLocal && parsed.protocol !== "https:") {
    console.error(
      "Expected launch evidence --base-url to use https. Use --allow-local only for developer smoke checks.",
    );
    process.exit(1);
  }

  return new URL(parsed.origin);
}

function parseRequestHeaders(values: string[]): HeadersInit {
  const headers: Record<string, string> = {};

  for (const value of values) {
    const separatorIndex = value.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      console.error(
        "Expected --request-header-env to use Header-Name:ENV_NAME without including the secret value.",
      );
      process.exit(1);
    }

    const headerName = value.slice(0, separatorIndex).trim();
    const envName = value.slice(separatorIndex + 1).trim();
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(headerName)) {
      console.error("Expected --request-header-env to include a valid HTTP header name.");
      process.exit(1);
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envName)) {
      console.error("Expected --request-header-env to reference a valid environment variable name.");
      process.exit(1);
    }

    const headerValue = process.env[envName];
    if (!headerValue) {
      console.error(`Missing environment variable for request header: ${envName}.`);
      process.exit(1);
    }

    headers[headerName] = headerValue;
  }

  return headers;
}

function isLocalOrPlaceholderHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "example.com" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".test") ||
    host.endsWith(".example")
  ) {
    return true;
  }

  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
    return true;
  }

  const private172 = host.match(/^172\.(\d{1,2})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  return false;
}

function featureFlaggedFlows(): FeatureFlaggedCanvasFlow[] {
  return canvasLaunchReadinessFlows.filter(
    (flow): flow is FeatureFlaggedCanvasFlow => Boolean(flow.featureFlag),
  );
}

function payloadRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function fetchTextWithTimeout(
  url: URL,
  timeoutMs: number,
  headers: HeadersInit,
): Promise<{
  status: number;
  ok: boolean;
  cacheControl: string | null;
  text: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    return {
      status: response.status,
      ok: response.ok,
      cacheControl: response.headers.get("cache-control"),
      text: await response.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function collectEndpointEvidence(
  baseUrl: URL,
  flow: FeatureFlaggedCanvasFlow,
  expectedState: ExpectedEndpointState | null,
  headers: HeadersInit,
): Promise<EndpointEvidence> {
  const featureFlag = flow.featureFlag;
  const url = new URL(featureFlag.endpoint, baseUrl);
  const startedAt = Date.now();
  const problems: string[] = [];

  try {
    const response = await fetchTextWithTimeout(url, 10_000, headers);
    let parsed: unknown = null;

    try {
      parsed = response.text ? JSON.parse(response.text) : null;
    } catch {
      problems.push("Endpoint did not return valid JSON.");
    }

    const payload = payloadRecord(parsed);
    if (!payload) {
      problems.push("Endpoint payload must be a JSON object.");
    }

    if (!response.ok) {
      problems.push(`Endpoint returned HTTP ${response.status}.`);
    }

    const enabled = payload?.enabled;
    const rolloutPercent = payload?.rolloutPercent;
    const recognizedKeys = expectedPayloadKeys.filter((key) =>
      Object.prototype.hasOwnProperty.call(payload ?? {}, key),
    );
    const unexpectedPayloadKeyCount = payload
      ? Object.keys(payload).filter(
          (key) => !expectedPayloadKeys.includes(key as (typeof expectedPayloadKeys)[number]),
        ).length
      : 0;

    if (typeof enabled !== "boolean") {
      problems.push("Endpoint payload must include boolean enabled.");
    }

    if (typeof rolloutPercent !== "number" || !Number.isFinite(rolloutPercent)) {
      problems.push("Endpoint payload must include numeric rolloutPercent.");
    } else if (
      !Number.isInteger(rolloutPercent) ||
      rolloutPercent < 0 ||
      rolloutPercent > 100
    ) {
      problems.push("Endpoint rolloutPercent must be an integer between 0 and 100.");
    }

    if (unexpectedPayloadKeyCount > 0) {
      problems.push(
        `Endpoint payload included ${unexpectedPayloadKeyCount} unexpected key(s); expected only enabled and rolloutPercent.`,
      );
    }

    if (!response.cacheControl?.toLowerCase().includes("no-store")) {
      problems.push(
        "Endpoint must include Cache-Control no-store so rollback evidence cannot be stale.",
      );
    }

    if (expectedState === "enabled") {
      if (enabled !== true || rolloutPercent !== 100) {
        problems.push(
          "Expected enabled launch evidence to show enabled true and rolloutPercent 100.",
        );
      }
    } else if (expectedState === "rollback-disabled") {
      if (enabled !== false || rolloutPercent !== 0) {
        problems.push(
          "Expected rollback-disabled launch evidence to show enabled false and rolloutPercent 0.",
        );
      }
    }

    return {
      id: flow.id,
      label: flow.label,
      endpoint: featureFlag.endpoint,
      serverFeatureKey: featureFlag.serverFeatureKey,
      fallback: featureFlag.fallback,
      url: url.toString(),
      ok: problems.length === 0,
      status: response.status,
      cacheControl: response.cacheControl,
      elapsedMs: Date.now() - startedAt,
      enabled: typeof enabled === "boolean" ? enabled : null,
      rolloutPercent:
        typeof rolloutPercent === "number" && Number.isFinite(rolloutPercent)
          ? rolloutPercent
          : null,
      payloadKeys: recognizedKeys,
      unexpectedPayloadKeyCount,
      problems,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: flow.id,
      label: flow.label,
      endpoint: featureFlag.endpoint,
      serverFeatureKey: featureFlag.serverFeatureKey,
      fallback: featureFlag.fallback,
      url: url.toString(),
      ok: false,
      status: null,
      cacheControl: null,
      elapsedMs: Date.now() - startedAt,
      enabled: null,
      rolloutPercent: null,
      payloadKeys: [],
      unexpectedPayloadKeyCount: 0,
      problems: [`Endpoint request failed: ${message}`],
    };
  }
}

function buildSummary(
  baseUrl: URL,
  featureEndpoints: EndpointEvidence[],
  requestHeaderCount: number,
): EndpointEvidenceSummary {
  const problems = featureEndpoints.flatMap((endpoint) =>
    endpoint.problems.map((problem) => `${endpoint.label}: ${problem}`),
  );

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: baseUrl.origin,
    scope: "VYVA Canvas Launch Readiness + Real-Use QA v1",
    expectedState,
    authenticatedRequest: requestHeaderCount > 0,
    requestHeaderCount,
    endpointCount: featureEndpoints.length,
    readyForQaEvidence: problems.length === 0,
    featureEndpoints,
    problemCount: problems.length,
    problems,
  };
}

function writeJsonOutput(outputPathArg: string, jsonSummary: string) {
  const outputPath = path.resolve(process.cwd(), outputPathArg);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${jsonSummary}\n`);
}

function printTextSummary(summary: EndpointEvidenceSummary) {
  console.log("Voice Canvas feature endpoint evidence");
  console.log(`Base URL: ${summary.baseUrl}`);
  console.log(`Expected state: ${summary.expectedState ?? "not specified"}`);
  console.log(`Endpoints checked: ${summary.endpointCount}`);
  console.log(`Ready for QA evidence: ${summary.readyForQaEvidence ? "yes" : "no"}`);

  for (const endpoint of summary.featureEndpoints) {
    const status = endpoint.status ?? "request failed";
    const enabled =
      endpoint.enabled === null ? "enabled=missing" : `enabled=${String(endpoint.enabled)}`;
    const rollout =
      endpoint.rolloutPercent === null
        ? "rolloutPercent=missing"
        : `rolloutPercent=${endpoint.rolloutPercent}`;
    console.log(
      `- ${endpoint.label}: ${status} ${enabled} ${rollout} (${endpoint.endpoint}, ${endpoint.serverFeatureKey})`,
    );
  }

  if (summary.problems.length > 0) {
    console.error("Endpoint evidence is not ready:");
    for (const problem of summary.problems) {
      console.error(`- ${problem}`);
    }
  }
}

const expectedState = parseExpectedState(expectedStateArg);
const baseUrl = parseBaseUrl(baseUrlArg);
const requestHeaders = parseRequestHeaders(requestHeaderEnvArgs);
if (outputPathArg) {
  const outputPath = path.resolve(process.cwd(), outputPathArg);
  if (existsSync(outputPath) && !forceOutput) {
    console.error(
      `Output file already exists. Use a run-specific path or pass --force to overwrite: ${path.relative(process.cwd(), outputPath)}`,
    );
    process.exit(1);
  }
}

const evidence = await Promise.all(
  featureFlaggedFlows().map((flow) =>
    collectEndpointEvidence(baseUrl, flow, expectedState, requestHeaders),
  ),
);
const summary = buildSummary(baseUrl, evidence, requestHeaderEnvArgs.length);
const exitCode = summary.readyForQaEvidence ? 0 : 1;

if (jsonOutput) {
  const jsonSummary = JSON.stringify(summary, null, 2);
  if (outputPathArg) {
    if (summary.readyForQaEvidence || saveFailedOutput) {
      writeJsonOutput(outputPathArg, jsonSummary);
    } else {
      console.error(
        "Endpoint evidence is not ready; refusing to save a launch-named artifact. Pass --save-failed only for diagnostic artifacts.",
      );
    }
  }
  console.log(jsonSummary);
  process.exitCode = exitCode;
} else {
  printTextSummary(summary);
  process.exitCode = exitCode;
}
