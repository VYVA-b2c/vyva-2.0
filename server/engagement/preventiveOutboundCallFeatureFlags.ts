import {
  isValidPreventiveOutboundCallProviderConfig,
  PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV,
} from "./preventiveOutboundCallProvider.js";

export const PREVENTIVE_OUTBOUND_CALL_FLAG = Object.freeze({
  flagId: "flag.engagement.preventive_outbound_call",
  flagVersion: "1.0.0",
  defaultMode: "disabled",
} as const);

export const PREVENTIVE_OUTBOUND_CALL_FLAG_ENV = Object.freeze({
  mode: "VYVA_PREVENTIVE_OUTBOUND_CALL_MODE",
  allowUsers: "VYVA_PREVENTIVE_OUTBOUND_CALL_ALLOW_USERS",
  denyUsers: "VYVA_PREVENTIVE_OUTBOUND_CALL_DENY_USERS",
  allowProduction: "VYVA_PREVENTIVE_OUTBOUND_CALL_ALLOW_PRODUCTION",
  expiresAt: "VYVA_PREVENTIVE_OUTBOUND_CALL_EXPIRES_AT",
  owner: "VYVA_PREVENTIVE_OUTBOUND_CALL_OWNER",
  auditRef: "VYVA_PREVENTIVE_OUTBOUND_CALL_AUDIT_REF",
  environment: "NODE_ENV",
} as const);

export type PreventiveOutboundCallMode = "disabled" | "pilot";

export type PreventiveOutboundCallFlagReasonCode =
  | "preventive_outbound_call_allowed_user"
  | "preventive_outbound_call_audit_ref_invalid"
  | "preventive_outbound_call_default_disabled"
  | "preventive_outbound_call_denied_user"
  | "preventive_outbound_call_disabled_requested"
  | "preventive_outbound_call_environment_invalid"
  | "preventive_outbound_call_expired"
  | "preventive_outbound_call_expiry_invalid"
  | "preventive_outbound_call_mode_invalid"
  | "preventive_outbound_call_not_allowlisted"
  | "preventive_outbound_call_owner_invalid"
  | "preventive_outbound_call_provider_config_invalid"
  | "preventive_outbound_call_provider_config_missing"
  | "preventive_outbound_call_production_not_authorized"
  | "preventive_outbound_call_resolution_failed";

export type PreventiveOutboundCallFlagResolution = Readonly<{
  flagId: typeof PREVENTIVE_OUTBOUND_CALL_FLAG.flagId;
  flagVersion: typeof PREVENTIVE_OUTBOUND_CALL_FLAG.flagVersion;
  requestedMode: PreventiveOutboundCallMode;
  effectiveMode: PreventiveOutboundCallMode;
  defaultMode: "disabled";
  reasonCode: PreventiveOutboundCallFlagReasonCode;
  productionAllowed: boolean;
  providerConfigured: boolean;
  expiresAt?: string;
  ownerRef?: string;
  auditRef?: string;
}>;

export type PreventiveOutboundCallEnvironmentMap =
  Readonly<Record<string, string | undefined>>;

const USER_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,199}$/;
const MAX_LIST_LENGTH = 100;
const DISALLOWED_WHITESPACE = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/u;
const STRICT_UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function disabled(
  requestedMode: PreventiveOutboundCallMode,
  reasonCode: PreventiveOutboundCallFlagReasonCode,
  options: {
    productionAllowed?: boolean;
    providerConfigured?: boolean;
    expiresAt?: string;
    ownerRef?: string;
    auditRef?: string;
  } = {},
): PreventiveOutboundCallFlagResolution {
  return {
    flagId: PREVENTIVE_OUTBOUND_CALL_FLAG.flagId,
    flagVersion: PREVENTIVE_OUTBOUND_CALL_FLAG.flagVersion,
    requestedMode,
    effectiveMode: "disabled",
    defaultMode: "disabled",
    reasonCode,
    productionAllowed: options.productionAllowed ?? false,
    providerConfigured: options.providerConfigured ?? false,
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
    ...(options.ownerRef ? { ownerRef: options.ownerRef } : {}),
    ...(options.auditRef ? { auditRef: options.auditRef } : {}),
  };
}

function selected(options: {
  requestedMode: PreventiveOutboundCallMode;
  productionAllowed: boolean;
  expiresAt: string;
  ownerRef: string;
  auditRef: string;
}): PreventiveOutboundCallFlagResolution {
  return {
    flagId: PREVENTIVE_OUTBOUND_CALL_FLAG.flagId,
    flagVersion: PREVENTIVE_OUTBOUND_CALL_FLAG.flagVersion,
    requestedMode: options.requestedMode,
    effectiveMode: "pilot",
    defaultMode: "disabled",
    reasonCode: "preventive_outbound_call_allowed_user",
    productionAllowed: options.productionAllowed,
    providerConfigured: true,
    expiresAt: options.expiresAt,
    ownerRef: options.ownerRef,
    auditRef: options.auditRef,
  };
}

function environmentClass(value: string | undefined): "development" | "local" | "test" | "staging" | "production" | null {
  if (value === "development" || value === "local" || value === "test" || value === "staging" || value === "production") {
    return value;
  }
  return null;
}

function parseUserList(raw: string | undefined): { ok: true; values: Set<string> } | { ok: false } {
  if (raw === undefined || raw === "") return { ok: true, values: new Set() };
  if (raw !== raw.trim() || DISALLOWED_WHITESPACE.test(raw)) return { ok: false };
  const values = raw.split(",");
  if (values.length === 0 || values.length > MAX_LIST_LENGTH) return { ok: false };
  const seen = new Set<string>();
  for (const value of values) {
    if (value.length === 0 || value.length > 160 || !USER_REF_PATTERN.test(value) || seen.has(value)) {
      return { ok: false };
    }
    seen.add(value);
  }
  return { ok: true, values: seen };
}

function parseStrictUtcExpiry(raw: string | undefined, now: Date): { ok: true; value: string } | { ok: false; reason: "invalid" | "expired" } {
  if (!raw || raw !== raw.trim() || !STRICT_UTC_ISO_PATTERN.test(raw)) {
    return { ok: false, reason: "invalid" };
  }
  const epochMs = Date.parse(raw);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== raw) {
    return { ok: false, reason: "invalid" };
  }
  if (epochMs <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, value: raw };
}

function validReference(value: string | undefined): value is string {
  return Boolean(value) &&
    value === value?.trim() &&
    !DISALLOWED_WHITESPACE.test(value) &&
    REFERENCE_PATTERN.test(value);
}

export function resolvePreventiveOutboundCallFlag(input: {
  env: PreventiveOutboundCallEnvironmentMap;
  userRef?: string;
  now: Date;
}): PreventiveOutboundCallFlagResolution {
  try {
    const rawMode = input.env[PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.mode];
    if (rawMode === undefined || rawMode === "") {
      return disabled("disabled", "preventive_outbound_call_default_disabled");
    }
    if (rawMode !== rawMode.trim() || (rawMode !== "disabled" && rawMode !== "pilot")) {
      return disabled("disabled", "preventive_outbound_call_mode_invalid");
    }
    const requestedMode = rawMode as PreventiveOutboundCallMode;
    if (requestedMode === "disabled") {
      return disabled(requestedMode, "preventive_outbound_call_disabled_requested");
    }

    const environment = environmentClass(input.env[PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.environment]);
    if (!environment) return disabled(requestedMode, "preventive_outbound_call_environment_invalid");
    const productionAllowed = environment !== "production" ||
      input.env[PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.allowProduction] === "true";
    if (!productionAllowed) {
      return disabled(requestedMode, "preventive_outbound_call_production_not_authorized", { productionAllowed });
    }

    const providerState = isValidPreventiveOutboundCallProviderConfig(input.env);
    if (providerState.reason === "missing") {
      return disabled(requestedMode, "preventive_outbound_call_provider_config_missing", { productionAllowed });
    }
    if (providerState.reason === "invalid") {
      return disabled(requestedMode, "preventive_outbound_call_provider_config_invalid", { productionAllowed });
    }

    const ownerRef = input.env[PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.owner];
    if (!validReference(ownerRef)) {
      return disabled(requestedMode, "preventive_outbound_call_owner_invalid", {
        productionAllowed,
        providerConfigured: true,
      });
    }
    const auditRef = input.env[PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.auditRef];
    if (!validReference(auditRef)) {
      return disabled(requestedMode, "preventive_outbound_call_audit_ref_invalid", {
        productionAllowed,
        providerConfigured: true,
        ownerRef,
      });
    }
    const expiry = parseStrictUtcExpiry(input.env[PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.expiresAt], input.now);
    if (!expiry.ok) {
      return disabled(
        requestedMode,
        expiry.reason === "expired" ? "preventive_outbound_call_expired" : "preventive_outbound_call_expiry_invalid",
        { productionAllowed, providerConfigured: true, ownerRef, auditRef },
      );
    }

    const deny = parseUserList(input.env[PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.denyUsers]);
    if (!deny.ok) {
      return disabled(requestedMode, "preventive_outbound_call_mode_invalid", {
        productionAllowed,
        providerConfigured: true,
        expiresAt: expiry.value,
        ownerRef,
        auditRef,
      });
    }
    const allow = parseUserList(input.env[PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.allowUsers]);
    if (!allow.ok) {
      return disabled(requestedMode, "preventive_outbound_call_mode_invalid", {
        productionAllowed,
        providerConfigured: true,
        expiresAt: expiry.value,
        ownerRef,
        auditRef,
      });
    }
    const userRef = input.userRef ?? "";
    if (userRef && deny.values.has(userRef)) {
      return disabled(requestedMode, "preventive_outbound_call_denied_user", {
        productionAllowed,
        providerConfigured: true,
        expiresAt: expiry.value,
        ownerRef,
        auditRef,
      });
    }
    if (!userRef || !allow.values.has(userRef)) {
      return disabled(requestedMode, "preventive_outbound_call_not_allowlisted", {
        productionAllowed,
        providerConfigured: true,
        expiresAt: expiry.value,
        ownerRef,
        auditRef,
      });
    }
    return selected({
      requestedMode,
      productionAllowed,
      expiresAt: expiry.value,
      ownerRef,
      auditRef,
    });
  } catch {
    return disabled("disabled", "preventive_outbound_call_resolution_failed");
  }
}

export function requiredPreventiveOutboundCallProviderEnvKeys(): readonly string[] {
  return [
    PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsApiKey,
    PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsAgentId,
    PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsPhoneNumberId,
    PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.publicWebhookBaseUrl,
    PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.twilioAccountSid,
    PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.twilioAuthToken,
  ];
}
