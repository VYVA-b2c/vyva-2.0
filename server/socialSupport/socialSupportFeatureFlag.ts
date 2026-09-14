import { createHash } from "node:crypto";

export const SOCIAL_SUPPORT_SPECIALIST_FLAG_ID = "flag.social_support.specialist" as const;
export const SOCIAL_SUPPORT_SPECIALIST_FLAG_VERSION = "1.0.0" as const;

export type SocialSupportSpecialistEffectiveMode =
  | "legacy_only"
  | "specialist_preview";

export type SocialSupportSpecialistFlagResolution = {
  flagId: typeof SOCIAL_SUPPORT_SPECIALIST_FLAG_ID;
  flagVersion: typeof SOCIAL_SUPPORT_SPECIALIST_FLAG_VERSION;
  effectiveMode: SocialSupportSpecialistEffectiveMode;
  selected: boolean;
  reasonCode:
    | "default_legacy"
    | "explicit_legacy"
    | "selected_by_allowlist"
    | "selected_by_rollout"
    | "denied_by_user"
    | "production_not_allowed"
    | "invalid_configuration";
};

export type SocialSupportSpecialistFlagInput = {
  env?: Readonly<Record<string, string | undefined>>;
  userRef: string;
  cohortKey?: string;
};

const MODE_ENV = "VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE";
const ROLLOUT_ENV = "VYVA_SOCIAL_SUPPORT_SPECIALIST_ROLLOUT_BPS";
const ALLOW_USERS_ENV = "VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS";
const DENY_USERS_ENV = "VYVA_SOCIAL_SUPPORT_SPECIALIST_DENY_USERS";
const ALLOW_PRODUCTION_ENV = "VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_PRODUCTION";

function invalid(): SocialSupportSpecialistFlagResolution {
  return {
    flagId: SOCIAL_SUPPORT_SPECIALIST_FLAG_ID,
    flagVersion: SOCIAL_SUPPORT_SPECIALIST_FLAG_VERSION,
    effectiveMode: "legacy_only",
    selected: false,
    reasonCode: "invalid_configuration",
  };
}

function legacy(reasonCode: SocialSupportSpecialistFlagResolution["reasonCode"]): SocialSupportSpecialistFlagResolution {
  return {
    flagId: SOCIAL_SUPPORT_SPECIALIST_FLAG_ID,
    flagVersion: SOCIAL_SUPPORT_SPECIALIST_FLAG_VERSION,
    effectiveMode: "legacy_only",
    selected: false,
    reasonCode,
  };
}

function selected(reasonCode: SocialSupportSpecialistFlagResolution["reasonCode"]): SocialSupportSpecialistFlagResolution {
  return {
    flagId: SOCIAL_SUPPORT_SPECIALIST_FLAG_ID,
    flagVersion: SOCIAL_SUPPORT_SPECIALIST_FLAG_VERSION,
    effectiveMode: "specialist_preview",
    selected: true,
    reasonCode,
  };
}

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

function parseUserList(raw: string | undefined): string[] | null {
  if (raw === undefined || raw === "") return [];
  if (hasWhitespace(raw)) return null;
  const values = raw.split(",");
  if (values.some((value) => value.length === 0)) return null;
  return values;
}

function parseRollout(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return 0;
  if (!/^(0|[1-9]\d{0,3}|10000)$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 0 && value <= 10_000 ? value : null;
}

function bucket(flagFacts: { userRef: string; cohortKey: string }): number {
  const digest = createHash("sha256")
    .update(`${SOCIAL_SUPPORT_SPECIALIST_FLAG_ID}:${SOCIAL_SUPPORT_SPECIALIST_FLAG_VERSION}:${flagFacts.userRef}:${flagFacts.cohortKey}`)
    .digest("hex")
    .slice(0, 8);
  return Number.parseInt(digest, 16) % 10_000;
}

export function resolveSocialSupportSpecialistFlag(
  input: SocialSupportSpecialistFlagInput,
): SocialSupportSpecialistFlagResolution {
  if (!input.userRef || hasWhitespace(input.userRef)) return invalid();
  const env = input.env ?? process.env;
  const mode = env[MODE_ENV];
  if (mode === undefined || mode === "" || mode === "disabled" || mode === "legacy_only") {
    return legacy(mode === "legacy_only" || mode === "disabled" ? "explicit_legacy" : "default_legacy");
  }
  if (mode !== "specialist_preview") return invalid();
  if (env.NODE_ENV === "production" && env[ALLOW_PRODUCTION_ENV] !== "true") {
    return legacy("production_not_allowed");
  }

  const allowUsers = parseUserList(env[ALLOW_USERS_ENV]);
  const denyUsers = parseUserList(env[DENY_USERS_ENV]);
  const rolloutBps = parseRollout(env[ROLLOUT_ENV]);
  if (!allowUsers || !denyUsers || rolloutBps === null) return invalid();

  if (denyUsers.includes(input.userRef)) return legacy("denied_by_user");
  if (allowUsers.includes(input.userRef)) return selected("selected_by_allowlist");

  const cohortKey = input.cohortKey ?? input.userRef;
  if (!cohortKey || hasWhitespace(cohortKey)) return invalid();
  return bucket({ userRef: input.userRef, cohortKey }) < rolloutBps
    ? selected("selected_by_rollout")
    : legacy("default_legacy");
}
