import {
  conciergeProductionChannelForTool,
  type ConciergeChannelReadinessResult,
  type ConciergeProductionChannel,
} from "../../shared/conciergeChannelReadiness.js";
import {
  buildConciergeAdapterPayloadPreview,
  conciergeAdapterId,
  conciergeProviderContactForChannel,
} from "../../shared/conciergeAdapterPayloadContract.js";
import type { ConciergeToolRequirement } from "../../shared/conciergeFlowRegistry.js";

export type ConciergeActionAdapterMode = "dry_run" | "probe" | "live";

export type ConciergeActionAdapterStatus =
  | "blocked"
  | "failed"
  | "passed"
  | "sent"
  | "simulated";

export type ConciergeActionAdapterResult = {
  version: 1;
  adapter: string;
  mode: ConciergeActionAdapterMode;
  channel: ConciergeProductionChannel;
  tool: ConciergeToolRequirement;
  status: ConciergeActionAdapterStatus;
  attempted_at: string;
  provider_name: string | null;
  provider_contact: string | null;
  external_action_allowed: boolean;
  result: string;
  result_id?: string | null;
  blocker?: string | null;
  error?: string | null;
  response_status?: number | null;
};

export type ConciergeActionAdapterInput = {
  mode: ConciergeActionAdapterMode;
  tool: ConciergeToolRequirement;
  payload?: Record<string, unknown> | null;
  providerName?: string | null;
  providerPhone?: string | null;
  pendingId?: string | null;
  userId?: string | null;
  summary?: string | null;
  userConfirmed?: boolean;
  dryRun?: boolean;
  channelReadiness?: ConciergeChannelReadinessResult | null;
  dynamicVariables?: Record<string, string>;
  liveEndpointUrl?: string | null;
  qaTarget?: string | null;
};

type StoredProbeStatus = "pass" | "fail";

const OUTBOUND_AGENT_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_CALLER_AGENT_ID",
  "ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID",
  "ELEVENLABS_OUTBOUND_AGENT_ID",
];

const OUTBOUND_PHONE_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID",
  "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
];

const QA_ENDPOINT_ENV_KEYS: Record<ConciergeProductionChannel, string[]> = {
  phone_call: [
    "CONCIERGE_PHONE_CALL_QA_ENDPOINT",
    "CONCIERGE_PHONE_CALL_QA_PHONE_NUMBER",
    "CONCIERGE_CHANNEL_PHONE_CALL_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_PHONE_CALL_QA_PHONE_NUMBER",
  ],
  email: [
    "CONCIERGE_EMAIL_QA_ENDPOINT",
    "CONCIERGE_EMAIL_QA_RECIPIENT",
    "CONCIERGE_CHANNEL_EMAIL_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_EMAIL_QA_RECIPIENT",
  ],
  whatsapp: [
    "CONCIERGE_WHATSAPP_QA_ENDPOINT",
    "CONCIERGE_WHATSAPP_QA_PHONE_NUMBER",
    "CONCIERGE_CHANNEL_WHATSAPP_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_WHATSAPP_QA_PHONE_NUMBER",
  ],
  form_application: [
    "CONCIERGE_FORM_APPLICATION_QA_ENDPOINT",
    "CONCIERGE_FORM_APPLICATION_QA_URL",
    "CONCIERGE_CHANNEL_FORM_APPLICATION_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_FORM_APPLICATION_QA_URL",
  ],
  document_upload: [
    "CONCIERGE_DOCUMENT_UPLOAD_QA_ENDPOINT",
    "CONCIERGE_DOCUMENT_UPLOAD_QA_URL",
    "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_QA_URL",
  ],
};

const LIVE_ENDPOINT_ENV_KEYS: Record<Exclude<ConciergeProductionChannel, "phone_call">, string[]> = {
  email: [
    "CONCIERGE_EMAIL_LIVE_ENDPOINT",
    "CONCIERGE_EMAIL_ADAPTER_ENDPOINT",
    "CONCIERGE_CHANNEL_EMAIL_LIVE_ENDPOINT",
  ],
  whatsapp: [
    "CONCIERGE_WHATSAPP_LIVE_ENDPOINT",
    "CONCIERGE_WHATSAPP_ADAPTER_ENDPOINT",
    "CONCIERGE_CHANNEL_WHATSAPP_LIVE_ENDPOINT",
  ],
  form_application: [
    "CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT",
    "CONCIERGE_FORM_APPLICATION_ADAPTER_ENDPOINT",
    "CONCIERGE_CHANNEL_FORM_APPLICATION_LIVE_ENDPOINT",
  ],
  document_upload: [
    "CONCIERGE_DOCUMENT_UPLOAD_LIVE_ENDPOINT",
    "CONCIERGE_DOCUMENT_UPLOAD_ADAPTER_ENDPOINT",
    "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_LIVE_ENDPOINT",
  ],
};

function envValue(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function firstEnv(keys: string[]): string {
  for (const key of keys) {
    const value = envValue(key);
    if (value) return value;
  }
  return "";
}

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseJsonObject(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  try {
    return jsonObject(JSON.parse(value));
  } catch {
    return { message: value };
  }
}

function qaTargetLabel(channel: ConciergeProductionChannel): string {
  switch (channel) {
    case "phone_call":
      return "reserved QA phone number";
    case "email":
      return "reserved QA email inbox";
    case "whatsapp":
      return "reserved QA WhatsApp number";
    case "form_application":
      return "QA form/application URL";
    case "document_upload":
      return "QA document-upload URL";
    default:
      return "QA endpoint";
  }
}

function hasQaSchemeTarget(value: string): boolean {
  return /^(qa|test|dry-run):/i.test(value.trim());
}

function isSafeReservedPhoneTarget(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^1?20255501\d{2}$/.test(digits) || /^1?55501\d{2}$/.test(digits);
}

function isSafeReservedEmailTarget(value: string): boolean {
  const email = value.trim().toLowerCase().replace(/^mailto:/, "");
  const domain = email.includes("@") ? email.split("@").pop() ?? "" : "";
  return Boolean(domain)
    && (
      domain.endsWith(".test")
      || domain.endsWith(".invalid")
      || domain.endsWith(".localhost")
      || domain === "example.com"
      || domain === "example.org"
      || domain === "example.net"
    );
}

function isSafeReservedUrlTarget(value: string): boolean {
  if (hasQaSchemeTarget(value)) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host === "localhost"
      || host === "127.0.0.1"
      || host === "::1"
      || host.endsWith(".test")
      || host.endsWith(".invalid")
      || host.endsWith(".localhost")
      || host === "example.com"
      || host === "example.org"
      || host === "example.net";
  } catch {
    return false;
  }
}

function isSafeQaTarget(channel: ConciergeProductionChannel, value: string): boolean {
  switch (channel) {
    case "phone_call":
    case "whatsapp":
      return isSafeReservedPhoneTarget(value);
    case "email":
      return isSafeReservedEmailTarget(value);
    case "form_application":
    case "document_upload":
      return isSafeReservedUrlTarget(value);
    default:
      return false;
  }
}

export function runConciergeActionAdapterProbe(input: {
  channel: ConciergeProductionChannel;
  configured: boolean;
  qaTarget?: string | null;
}): { status: StoredProbeStatus; blocker: string | null } {
  if (!input.configured) {
    return {
      status: "fail",
      blocker: "Required setup has not been configured on the server.",
    };
  }

  const qaTarget = input.qaTarget?.trim() || firstEnv(QA_ENDPOINT_ENV_KEYS[input.channel]);
  if (!qaTarget) {
    return {
      status: "fail",
      blocker: `Add a ${qaTargetLabel(input.channel)} before running a live-readiness probe.`,
    };
  }

  if (!isSafeQaTarget(input.channel, qaTarget)) {
    return {
      status: "fail",
      blocker: `The configured ${qaTargetLabel(input.channel)} is not a reserved test endpoint, so no probe was run.`,
    };
  }

  return {
    status: "pass",
    blocker: null,
  };
}

function resultBase(input: ConciergeActionAdapterInput, channel: ConciergeProductionChannel): Omit<ConciergeActionAdapterResult, "result" | "status"> {
  return {
    version: 1,
    adapter: conciergeAdapterId(channel),
    mode: input.mode,
    channel,
    tool: input.tool,
    attempted_at: new Date().toISOString(),
    provider_name: input.providerName?.trim() || null,
    provider_contact: conciergeProviderContactForChannel(channel, input),
    external_action_allowed: input.mode === "live" && input.channelReadiness?.external_action_allowed === true,
  };
}

function blockedResult(input: ConciergeActionAdapterInput, channel: ConciergeProductionChannel, blocker: string): ConciergeActionAdapterResult {
  return {
    ...resultBase(input, channel),
    status: "blocked",
    result: "blocked",
    blocker,
    external_action_allowed: false,
  };
}

function simulatedResult(input: ConciergeActionAdapterInput, channel: ConciergeProductionChannel): ConciergeActionAdapterResult {
  return {
    ...resultBase(input, channel),
    status: "simulated",
    result: "simulated",
    external_action_allowed: false,
  };
}

function failedResult(input: ConciergeActionAdapterInput, channel: ConciergeProductionChannel, error: string, responseStatus?: number | null): ConciergeActionAdapterResult {
  return {
    ...resultBase(input, channel),
    status: "failed",
    result: "failed",
    error,
    response_status: responseStatus ?? null,
  };
}

function sentResult(input: ConciergeActionAdapterInput, channel: ConciergeProductionChannel, resultId: string | null, result = "sent"): ConciergeActionAdapterResult {
  return {
    ...resultBase(input, channel),
    status: "sent",
    result,
    result_id: resultId,
  };
}

function liveGateBlocker(input: ConciergeActionAdapterInput, channel: ConciergeProductionChannel): string | null {
  if (input.dryRun) return "dry_run_blocks_live_action";
  if (!input.userConfirmed) return "user_confirmation_required";
  const readiness = input.channelReadiness;
  if (!readiness) return `${channel}_readiness_missing`;
  if (readiness.channel !== channel) return `${channel}_readiness_mismatch`;
  if (!readiness.configured) return `${channel}_not_configured`;
  if (!readiness.verified) return `${channel}_latest_probe_not_passed`;
  if (!readiness.admin_enabled) return `${channel}_disabled_by_admin`;
  if (!readiness.ready || !readiness.external_action_allowed) return readiness.blockers[0] ?? `${channel}_not_live_ready`;
  return null;
}

function outboundPhoneConfig() {
  return {
    apiKey: envValue("ELEVENLABS_API_KEY"),
    agentId: firstEnv(OUTBOUND_AGENT_ENV_KEYS),
    agentPhoneNumberId: firstEnv(OUTBOUND_PHONE_ENV_KEYS),
  };
}

async function postJsonAdapterEndpoint(
  input: ConciergeActionAdapterInput,
  channel: Exclude<ConciergeProductionChannel, "phone_call">,
): Promise<ConciergeActionAdapterResult> {
  const endpoint = input.liveEndpointUrl?.trim() || firstEnv(LIVE_ENDPOINT_ENV_KEYS[channel]);
  if (!endpoint) {
    return failedResult(input, channel, `${conciergeAdapterId(channel)} live endpoint is not configured.`);
  }
  const preview = buildConciergeAdapterPayloadPreview(input);
  if (!preview.outbound_payload) {
    return blockedResult(input, channel, "adapter_payload_contract_incomplete: adapter_payload_missing_channel");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preview.outbound_payload),
  });
  const rawBody = await response.text().catch(() => "");
  const data = parseJsonObject(rawBody || response.statusText);

  if (!response.ok) {
    return failedResult(input, channel, text(data.message) ?? `Adapter endpoint failed with ${response.status}.`, response.status);
  }

  return sentResult(
    input,
    channel,
    text(data.id) ?? text(data.message_id) ?? text(data.sid) ?? null,
    text(data.result) ?? "sent",
  );
}

async function executePhoneLive(input: ConciergeActionAdapterInput): Promise<ConciergeActionAdapterResult> {
  const channel = "phone_call";
  const config = outboundPhoneConfig();
  const toNumber = conciergeProviderContactForChannel(channel, input);

  if (!config.apiKey) return failedResult(input, channel, "Missing ElevenLabs API key.");
  if (!config.agentId) return failedResult(input, channel, "Missing ElevenLabs concierge caller agent ID.");
  if (!config.agentPhoneNumberId) return failedResult(input, channel, "Missing ElevenLabs concierge phone number ID.");
  if (!toNumber) return failedResult(input, channel, "Missing provider phone number for outbound call.");

  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": config.apiKey,
    },
    body: JSON.stringify({
      agent_id: config.agentId,
      agent_phone_number_id: config.agentPhoneNumberId,
      to_number: toNumber,
      conversation_initiation_client_data: {
        dynamic_variables: input.dynamicVariables ?? {},
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    return failedResult(input, channel, `ElevenLabs outbound call failed: ${detail}`, response.status);
  }

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  return sentResult(
    input,
    channel,
    text(data.conversation_id) ?? text(data.callSid) ?? null,
    text(data.message) ?? "outbound_call_started",
  );
}

async function executeLive(input: ConciergeActionAdapterInput, channel: ConciergeProductionChannel): Promise<ConciergeActionAdapterResult> {
  const blocker = liveGateBlocker(input, channel);
  if (blocker) return blockedResult(input, channel, blocker);
  const preview = buildConciergeAdapterPayloadPreview(input);
  if (!preview.valid) {
    return blockedResult(input, channel, `adapter_payload_contract_incomplete: ${preview.blockers.join(", ")}`);
  }

  if (channel === "phone_call") return executePhoneLive(input);
  return postJsonAdapterEndpoint(input, channel);
}

export async function executeConciergeActionAdapter(input: ConciergeActionAdapterInput): Promise<ConciergeActionAdapterResult> {
  const channel = conciergeProductionChannelForTool(input.tool);
  if (!channel) {
    throw new Error(`No Concierge action adapter is available for tool "${input.tool}".`);
  }

  if (input.mode === "dry_run") {
    return simulatedResult(input, channel);
  }

  if (input.mode === "probe") {
    const probe = runConciergeActionAdapterProbe({
      channel,
      configured: input.channelReadiness?.configured === true,
    });
    return {
      ...resultBase(input, channel),
      status: probe.status === "pass" ? "passed" : "failed",
      result: probe.status,
      blocker: probe.blocker,
      external_action_allowed: false,
    };
  }

  return executeLive(input, channel);
}
