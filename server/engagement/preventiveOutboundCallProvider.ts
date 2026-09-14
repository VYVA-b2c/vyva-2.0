import {
  isSafeProviderReference,
  normalizePublicWebhookBaseUrl,
  PREVENTIVE_OUTBOUND_CALL_TWILIO_CALL_SID_PATTERN,
} from "./preventiveOutboundCallSecurity.js";

export const PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV = Object.freeze({
  elevenLabsApiKey: "ELEVENLABS_API_KEY",
  elevenLabsAgentId: "VYVA_PREVENTIVE_OUTBOUND_CALL_ELEVENLABS_AGENT_ID",
  elevenLabsPhoneNumberId: "VYVA_PREVENTIVE_OUTBOUND_CALL_ELEVENLABS_PHONE_NUMBER_ID",
  publicWebhookBaseUrl: "VYVA_PREVENTIVE_OUTBOUND_CALL_PUBLIC_WEBHOOK_BASE_URL",
  twilioAccountSid: "TWILIO_ACCOUNT_SID",
  twilioAuthToken: "TWILIO_AUTH_TOKEN",
} as const);

export const PREVENTIVE_OUTBOUND_CALL_AGENT_CONTRACT = Object.freeze({
  version: "1.0.0",
  confirmationToolName: "vyva_preventive_outbound_call_confirm_identity",
  secretConfirmationTokenVariable: "secret__preventive_call_confirmation_token",
  confirmationTokenHeaderName: "X-VYVA-Preventive-Call-Token",
  callAttemptIdVariable: "preventive_call_attempt_id",
  confirmationUrlVariable: "preventive_call_confirmation_url",
} as const);

export type PreventiveOutboundCallProviderConfig = Readonly<{
  elevenLabsApiKey: string;
  elevenLabsAgentId: string;
  elevenLabsPhoneNumberId: string;
  publicWebhookBaseUrl: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
}>;

export type PreventiveOutboundCallProviderStartInput = Readonly<{
  callAttemptId: string;
  phoneE164: string;
  confirmationToken: string;
  callbackUrl: string;
}>;

export type PreventiveOutboundCallProviderStartResult =
  | {
      outcome: "started";
      providerStatus: number | null;
      providerConversationId: string;
      twilioCallSid: string;
    }
  | { outcome: "failed_permanent" | "failed_retryable" | "delivery_uncertain"; providerStatus: number | null; reason: string };

export type PreventiveOutboundCallProviderCancelResult =
  | { outcome: "cancel_requested" }
  | { outcome: "unsupported" | "failed"; reason?: string };

export type PreventiveOutboundCallProvider = Readonly<{
  start(input: PreventiveOutboundCallProviderStartInput): Promise<PreventiveOutboundCallProviderStartResult>;
  cancel?(input: { twilioCallSid: string; providerConversationId?: string | null }): Promise<PreventiveOutboundCallProviderCancelResult>;
}>;

type FetchLike = typeof fetch;

function strictSecret(value: string | undefined, maxLength = 512): value is string {
  return Boolean(value) &&
    value === value?.trim() &&
    !/[\r\n\s]/u.test(value) &&
    value.length <= maxLength;
}

function validTwilioAccountSid(value: string | undefined): value is string {
  return typeof value === "string" &&
    value === value.trim() &&
    /^AC[a-fA-F0-9]{32}$/u.test(value);
}

export function resolvePreventiveOutboundCallProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
): { ok: true; config: PreventiveOutboundCallProviderConfig } | { ok: false; reason: "missing" | "invalid" } {
  const elevenLabsApiKey = env[PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsApiKey];
  const elevenLabsAgentId = env[PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsAgentId];
  const elevenLabsPhoneNumberId = env[PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsPhoneNumberId];
  const publicWebhookBaseUrl = env[PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.publicWebhookBaseUrl];
  const twilioAccountSid = env[PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.twilioAccountSid];
  const twilioAuthToken = env[PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.twilioAuthToken];
  if (!elevenLabsApiKey ||
    !elevenLabsAgentId ||
    !elevenLabsPhoneNumberId ||
    !publicWebhookBaseUrl ||
    !twilioAccountSid ||
    !twilioAuthToken) {
    return { ok: false, reason: "missing" };
  }
  const base = normalizePublicWebhookBaseUrl(publicWebhookBaseUrl);
  if (!strictSecret(elevenLabsApiKey, 1024) ||
    !isSafeProviderReference(elevenLabsAgentId) ||
    !isSafeProviderReference(elevenLabsPhoneNumberId) ||
    !base.ok ||
    !validTwilioAccountSid(twilioAccountSid) ||
    !strictSecret(twilioAuthToken, 512)) {
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    config: {
      elevenLabsApiKey,
      elevenLabsAgentId,
      elevenLabsPhoneNumberId,
      publicWebhookBaseUrl: base.baseUrl,
      twilioAccountSid,
      twilioAuthToken,
    },
  };
}

export function isValidPreventiveOutboundCallProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
): { reason: "valid" | "missing" | "invalid" } {
  const resolved = resolvePreventiveOutboundCallProviderConfig(env);
  return resolved.ok ? { reason: "valid" } : { reason: resolved.reason };
}

function classifyProviderFailure(status: number | null): PreventiveOutboundCallProviderStartResult {
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return { outcome: "failed_permanent", providerStatus: status, reason: "provider_permanent_failure" };
  }
  return { outcome: "failed_retryable", providerStatus: status, reason: "provider_retryable_failure" };
}

export function createPreventiveOutboundCallProvider(input: {
  config: PreventiveOutboundCallProviderConfig;
  fetcher?: FetchLike;
}): PreventiveOutboundCallProvider {
  const fetcher = input.fetcher ?? fetch;
  return {
    async start(startInput) {
      try {
        const response = await fetcher("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": input.config.elevenLabsApiKey,
          },
          body: JSON.stringify({
            agent_id: input.config.elevenLabsAgentId,
            agent_phone_number_id: input.config.elevenLabsPhoneNumberId,
            to_number: startInput.phoneE164,
            call_recording_enabled: false,
            conversation_initiation_client_data: {
              dynamic_variables: {
                [PREVENTIVE_OUTBOUND_CALL_AGENT_CONTRACT.callAttemptIdVariable]: startInput.callAttemptId,
                [PREVENTIVE_OUTBOUND_CALL_AGENT_CONTRACT.secretConfirmationTokenVariable]: startInput.confirmationToken,
                [PREVENTIVE_OUTBOUND_CALL_AGENT_CONTRACT.confirmationUrlVariable]: startInput.callbackUrl,
              },
            },
          }),
        });
        const status = typeof response.status === "number" ? response.status : null;
        if (!response.ok) return classifyProviderFailure(status);
        const data = await response.json().catch(() => ({})) as Record<string, unknown>;
        const providerConversationId = typeof data.conversation_id === "string" ? data.conversation_id : null;
        const twilioCallSid = typeof data.callSid === "string" ? data.callSid : null;
        if (!isSafeProviderReference(providerConversationId) ||
          !twilioCallSid ||
          !PREVENTIVE_OUTBOUND_CALL_TWILIO_CALL_SID_PATTERN.test(twilioCallSid)) {
          return {
            outcome: "delivery_uncertain",
            providerStatus: status,
            reason: "provider_missing_required_correlation",
          };
        }
        return {
          outcome: "started",
          providerStatus: status,
          providerConversationId,
          twilioCallSid,
        };
      } catch {
        return { outcome: "failed_retryable", providerStatus: null, reason: "provider_exception" };
      }
    },
    async cancel(cancelInput) {
      if (!PREVENTIVE_OUTBOUND_CALL_TWILIO_CALL_SID_PATTERN.test(cancelInput.twilioCallSid)) {
        return { outcome: "failed", reason: "invalid_call_sid" };
      }
      try {
        const response = await fetcher(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(input.config.twilioAccountSid)}/Calls/${encodeURIComponent(cancelInput.twilioCallSid)}.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${input.config.twilioAccountSid}:${input.config.twilioAuthToken}`, "utf8").toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ Status: "canceled" }).toString(),
          },
        );
        if (response.ok) return { outcome: "cancel_requested" };
        if (response.status === 404) return { outcome: "unsupported", reason: "provider_call_not_found" };
        return { outcome: "failed", reason: "provider_cancel_failed" };
      } catch {
        return { outcome: "failed", reason: "provider_cancel_exception" };
      }
    },
  };
}

export function createDefaultPreventiveOutboundCallProvider(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PreventiveOutboundCallProvider | null {
  const resolved = resolvePreventiveOutboundCallProviderConfig(env);
  if (!resolved.ok) return null;
  return createPreventiveOutboundCallProvider({ config: resolved.config });
}
