import { createHash } from "node:crypto";
import {
  isValidPreventiveWebPushProviderConfig,
  PREVENTIVE_WEB_PUSH_PROVIDER_ENV,
} from "./preventiveWebPushProvider.js";

export const PREVENTIVE_WEB_PUSH_FLAG = Object.freeze({
  flagId: "flag.engagement.preventive_web_push",
  flagVersion: "1.0.0",
  defaultMode: "disabled",
} as const);

export const PREVENTIVE_WEB_PUSH_FLAG_ENV = Object.freeze({
  mode: "VYVA_PREVENTIVE_WEB_PUSH_MODE",
  allowUsers: "VYVA_PREVENTIVE_WEB_PUSH_ALLOW_USERS",
  denyUsers: "VYVA_PREVENTIVE_WEB_PUSH_DENY_USERS",
  rolloutBasisPoints: "VYVA_PREVENTIVE_WEB_PUSH_ROLLOUT_BPS",
  allowProduction: "VYVA_PREVENTIVE_WEB_PUSH_ALLOW_PRODUCTION",
  environment: "NODE_ENV",
} as const);

export type PreventiveWebPushMode = "disabled" | "pilot";

export type PreventiveWebPushFlagReasonCode =
  | "preventive_web_push_allowed_user"
  | "preventive_web_push_cohort_missing"
  | "preventive_web_push_cohort_not_selected"
  | "preventive_web_push_default_disabled"
  | "preventive_web_push_denied_user"
  | "preventive_web_push_disabled_requested"
  | "preventive_web_push_environment_invalid"
  | "preventive_web_push_mode_invalid"
  | "preventive_web_push_provider_config_invalid"
  | "preventive_web_push_provider_config_missing"
  | "preventive_web_push_production_not_authorized"
  | "preventive_web_push_resolution_failed"
  | "preventive_web_push_rollout_invalid"
  | "preventive_web_push_rollout_selected";

export type PreventiveWebPushFlagResolution = Readonly<{
  flagId: typeof PREVENTIVE_WEB_PUSH_FLAG.flagId;
  flagVersion: typeof PREVENTIVE_WEB_PUSH_FLAG.flagVersion;
  requestedMode: PreventiveWebPushMode;
  effectiveMode: PreventiveWebPushMode;
  defaultMode: "disabled";
  reasonCode: PreventiveWebPushFlagReasonCode;
  rolloutBucket?: number;
  productionAllowed: boolean;
  providerConfigured: boolean;
}>;

export type PreventiveWebPushEnvironmentMap =
  Readonly<Record<string, string | undefined>>;

const USER_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_LIST_LENGTH = 100;
const MAX_COHORT_KEY_LENGTH = 512;
const DISALLOWED_LIST_WHITESPACE = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/u;

function disabled(
  requestedMode: PreventiveWebPushMode,
  reasonCode: PreventiveWebPushFlagReasonCode,
  options: {
    rolloutBucket?: number;
    productionAllowed?: boolean;
    providerConfigured?: boolean;
  } = {},
): PreventiveWebPushFlagResolution {
  return {
    flagId: PREVENTIVE_WEB_PUSH_FLAG.flagId,
    flagVersion: PREVENTIVE_WEB_PUSH_FLAG.flagVersion,
    requestedMode,
    effectiveMode: "disabled",
    defaultMode: "disabled",
    reasonCode,
    ...(options.rolloutBucket !== undefined ? { rolloutBucket: options.rolloutBucket } : {}),
    productionAllowed: options.productionAllowed ?? false,
    providerConfigured: options.providerConfigured ?? false,
  };
}

function selected(
  reasonCode: PreventiveWebPushFlagReasonCode,
  options: {
    requestedMode: PreventiveWebPushMode;
    rolloutBucket?: number;
    productionAllowed: boolean;
  },
): PreventiveWebPushFlagResolution {
  return {
    flagId: PREVENTIVE_WEB_PUSH_FLAG.flagId,
    flagVersion: PREVENTIVE_WEB_PUSH_FLAG.flagVersion,
    requestedMode: options.requestedMode,
    effectiveMode: "pilot",
    defaultMode: "disabled",
    reasonCode,
    ...(options.rolloutBucket !== undefined ? { rolloutBucket: options.rolloutBucket } : {}),
    productionAllowed: options.productionAllowed,
    providerConfigured: true,
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
  if (raw !== raw.trim() || DISALLOWED_LIST_WHITESPACE.test(raw)) return { ok: false };
  const values = raw.split(",");
  if (values.length === 0 || values.length > MAX_LIST_LENGTH) return { ok: false };
  const seen = new Set<string>();
  for (const value of values) {
    if (value.length === 0 || value.length > 160 || !USER_REF_PATTERN.test(value) || seen.has(value)) {
      return { ok: false };
    }
    seen.add(value);
  }
  if (seen.size !== values.length) {
    return { ok: false };
  }
  return { ok: true, values: seen };
}

function parseRollout(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  if (raw !== raw.trim() || !/^\d{1,5}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 0 && value <= 10_000 ? value : null;
}

export function computePreventiveWebPushCohortBucket(cohortKey: string): number {
  const digest = createHash("sha256")
    .update(`${PREVENTIVE_WEB_PUSH_FLAG.flagId}:${PREVENTIVE_WEB_PUSH_FLAG.flagVersion}:${cohortKey}`)
    .digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function resolvePreventiveWebPushFlag(input: {
  env: PreventiveWebPushEnvironmentMap;
  cohortKey?: string;
  userRef?: string;
}): PreventiveWebPushFlagResolution {
  try {
    const rawMode = input.env[PREVENTIVE_WEB_PUSH_FLAG_ENV.mode];
    if (rawMode === undefined || rawMode === "") {
      return disabled("disabled", "preventive_web_push_default_disabled");
    }
    if (rawMode !== rawMode.trim() || (rawMode !== "disabled" && rawMode !== "pilot")) {
      return disabled("disabled", "preventive_web_push_mode_invalid");
    }
    const requestedMode = rawMode as PreventiveWebPushMode;
    if (requestedMode === "disabled") {
      return disabled(requestedMode, "preventive_web_push_disabled_requested");
    }

    const environment = environmentClass(input.env[PREVENTIVE_WEB_PUSH_FLAG_ENV.environment]);
    if (!environment) return disabled(requestedMode, "preventive_web_push_environment_invalid");
    const productionAllowed = environment !== "production" ||
      input.env[PREVENTIVE_WEB_PUSH_FLAG_ENV.allowProduction] === "true";
    if (!productionAllowed) {
      return disabled(requestedMode, "preventive_web_push_production_not_authorized", { productionAllowed });
    }

    const providerState = isValidPreventiveWebPushProviderConfig(input.env);
    if (providerState.reason === "missing") {
      return disabled(requestedMode, "preventive_web_push_provider_config_missing", { productionAllowed });
    }
    if (providerState.reason === "invalid") {
      return disabled(requestedMode, "preventive_web_push_provider_config_invalid", { productionAllowed });
    }

    const deny = parseUserList(input.env[PREVENTIVE_WEB_PUSH_FLAG_ENV.denyUsers]);
    if (!deny.ok) {
      return disabled(requestedMode, "preventive_web_push_mode_invalid", {
        productionAllowed,
        providerConfigured: true,
      });
    }
    const allow = parseUserList(input.env[PREVENTIVE_WEB_PUSH_FLAG_ENV.allowUsers]);
    if (!allow.ok) {
      return disabled(requestedMode, "preventive_web_push_mode_invalid", {
        productionAllowed,
        providerConfigured: true,
      });
    }

    const userRef = input.userRef ?? "";
    if (userRef && deny.values.has(userRef)) {
      return disabled(requestedMode, "preventive_web_push_denied_user", {
        productionAllowed,
        providerConfigured: true,
      });
    }
    if (userRef && allow.values.has(userRef)) {
      return selected("preventive_web_push_allowed_user", { requestedMode, productionAllowed });
    }

    const rollout = parseRollout(input.env[PREVENTIVE_WEB_PUSH_FLAG_ENV.rolloutBasisPoints]);
    if (rollout === null) {
      return disabled(requestedMode, "preventive_web_push_rollout_invalid", {
        productionAllowed,
        providerConfigured: true,
      });
    }
    const cohortKey = input.cohortKey;
    if (!cohortKey || cohortKey !== cohortKey.trim() || cohortKey.length > MAX_COHORT_KEY_LENGTH) {
      return disabled(requestedMode, "preventive_web_push_cohort_missing", {
        productionAllowed,
        providerConfigured: true,
      });
    }
    const rolloutBucket = computePreventiveWebPushCohortBucket(cohortKey);
    if (rolloutBucket >= rollout) {
      return disabled(requestedMode, "preventive_web_push_cohort_not_selected", {
        rolloutBucket,
        productionAllowed,
        providerConfigured: true,
      });
    }
    return selected("preventive_web_push_rollout_selected", {
      requestedMode,
      rolloutBucket,
      productionAllowed,
    });
  } catch {
    return disabled("disabled", "preventive_web_push_resolution_failed");
  }
}

export function requiredPreventiveWebPushProviderEnvKeys(): readonly string[] {
  return [
    PREVENTIVE_WEB_PUSH_PROVIDER_ENV.publicKey,
    PREVENTIVE_WEB_PUSH_PROVIDER_ENV.privateKey,
    PREVENTIVE_WEB_PUSH_PROVIDER_ENV.subject,
  ];
}
