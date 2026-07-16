import {
  evaluateConciergeChannelReadiness,
  type ConciergeChannelReadinessFlags,
  type ConciergeChannelReadinessResult,
} from "../../shared/conciergeChannelReadiness.js";
import type { ConciergeToolRequirement } from "../../shared/conciergeFlowRegistry.js";

const OUTBOUND_AGENT_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_CALLER_AGENT_ID",
  "ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID",
  "ELEVENLABS_OUTBOUND_AGENT_ID",
];

const OUTBOUND_PHONE_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID",
  "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
];

function envValue(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function anyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(envValue(key)));
}

function envFlag(keys: string[]): boolean {
  return keys.some((key) => {
    const value = envValue(key).toLowerCase();
    return value === "1" || value === "true" || value === "yes" || value === "ready" || value === "enabled";
  });
}

export function loadConciergeChannelReadinessFlags(): ConciergeChannelReadinessFlags {
  const phoneConfigured = Boolean(envValue("ELEVENLABS_API_KEY"))
    && anyEnv(OUTBOUND_AGENT_ENV_KEYS)
    && anyEnv(OUTBOUND_PHONE_ENV_KEYS);

  return {
    phone_call: {
      adminEnabled: envFlag(["CONCIERGE_PHONE_CALL_CHANNEL_READY", "CONCIERGE_CHANNEL_PHONE_CALL_READY"]),
      configured: phoneConfigured || envFlag(["CONCIERGE_PHONE_CALL_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_PHONE_CALL_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_PHONE_CALL_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_PHONE_CALL_VERIFIED"]),
      notes: phoneConfigured ? "ElevenLabs outbound caller configuration detected." : "ElevenLabs outbound caller is not fully configured.",
    },
    email: {
      adminEnabled: envFlag(["CONCIERGE_EMAIL_CHANNEL_READY", "CONCIERGE_CHANNEL_EMAIL_READY"]),
      configured: envFlag(["CONCIERGE_EMAIL_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_EMAIL_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_EMAIL_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_EMAIL_VERIFIED"]),
    },
    whatsapp: {
      adminEnabled: envFlag(["CONCIERGE_WHATSAPP_CHANNEL_READY", "CONCIERGE_CHANNEL_WHATSAPP_READY"]),
      configured: envFlag(["CONCIERGE_WHATSAPP_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_WHATSAPP_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_WHATSAPP_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_WHATSAPP_VERIFIED"]),
    },
    form_application: {
      adminEnabled: envFlag(["CONCIERGE_FORM_APPLICATION_CHANNEL_READY", "CONCIERGE_CHANNEL_FORM_APPLICATION_READY"]),
      configured: envFlag(["CONCIERGE_FORM_APPLICATION_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_FORM_APPLICATION_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_FORM_APPLICATION_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_FORM_APPLICATION_VERIFIED"]),
    },
    document_upload: {
      adminEnabled: envFlag(["CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_READY", "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_READY"]),
      configured: envFlag(["CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_VERIFIED"]),
    },
  };
}

export function conciergeChannelReadinessForTool(input: {
  tool: ConciergeToolRequirement;
  dryRun?: boolean;
}): ConciergeChannelReadinessResult {
  return evaluateConciergeChannelReadiness({
    tool: input.tool,
    dryRun: input.dryRun,
    flags: loadConciergeChannelReadinessFlags(),
  });
}
