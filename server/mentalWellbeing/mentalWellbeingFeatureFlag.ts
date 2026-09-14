import { createHash } from "node:crypto";

export const MENTAL_WELLBEING_SPECIALIST_FLAG_ID = "flag.mental_wellbeing.specialist" as const;
export const MENTAL_WELLBEING_SPECIALIST_FLAG_VERSION = "1.0.0" as const;

export type MentalWellbeingSpecialistEffectiveMode =
  | "legacy_only"
  | "specialist_preview";

export type MentalWellbeingSpecialistFlagResolution = {
  flagId: typeof MENTAL_WELLBEING_SPECIALIST_FLAG_ID;
  flagVersion: typeof MENTAL_WELLBEING_SPECIALIST_FLAG_VERSION;
  effectiveMode: MentalWellbeingSpecialistEffectiveMode;
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

export type MentalWellbeingSpecialistFlagInput = {
  env?: Readonly<Record<string, string | undefined>>;
  userRef: string;
  cohortKey?: string;
};

const MODE_ENV = "VYVA_MENTAL_WELLBEING_SPECIALIST_MODE";
const ROLLOUT_ENV = "VYVA_MENTAL_WELLBEING_SPECIALIST_ROLLOUT_BPS";
const ALLOW_USERS_ENV = "VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS";
const DENY_USERS_ENV = "VYVA_MENTAL_WELLBEING_SPECIALIST_DENY_USERS";
const ALLOW_PRODUCTION_ENV = "VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_PRODUCTION";

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

function invalid(): MentalWellbeingSpecialistFlagResolution {
  return {
    flagId: MENTAL_WELLBEING_SPECIALIST_FLAG_ID,
    flagVersion: MENTAL_WELLBEING_SPECIALIST_FLAG_VERSION,
    effectiveMode: "legacy_only",
    selected: false,
    reasonCode: "invalid_configuration",
  };
}

function legacy(
  reasonCode: MentalWellbeingSpecialistFlagResolution["reasonCode"],
): MentalWellbeingSpecialistFlagResolution {
  return {
    flagId: MENTAL_WELLBEING_SPECIALIST_FLAG_ID,
    flagVersion: MENTAL_WELLBEING_SPECIALIST_FLAG_VERSION,
    effectiveMode: "legacy_only",
    selected: false,
    reasonCode,
  };
}

function selected(
  reasonCode: MentalWellbeingSpecialistFlagResolution["reasonCode"],
): MentalWellbeingSpecialistFlagResolution {
  return {
    flagId: MENTAL_WELLBEING_SPECIALIST_FLAG_ID,
    flagVersion: MENTAL_WELLBEING_SPECIALIST_FLAG_VERSION,
    effectiveMode: "specialist_preview",
    selected: true,
    reasonCode,
  };
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

function rolloutBucket(input: { userRef: string; cohortKey: string }): number {
  const digest = createHash("sha256")
    .update([
      MENTAL_WELLBEING_SPECIALIST_FLAG_ID,
      MENTAL_WELLBEING_SPECIALIST_FLAG_VERSION,
      input.userRef,
      input.cohortKey,
    ].join(":"))
    .digest("hex")
    .slice(0, 8);
  return Number.parseInt(digest, 16) % 10_000;
}

export function resolveMentalWellbeingSpecialistFlag(
  input: MentalWellbeingSpecialistFlagInput,
): MentalWellbeingSpecialistFlagResolution {
  if (!input.userRef || hasWhitespace(input.userRef)) return invalid();
  const env = input.env ?? process.env;
  const mode = env[MODE_ENV];
  if (mode === undefined || mode === "" || mode === "disabled" || mode === "legacy_only") {
    return legacy(mode === "disabled" || mode === "legacy_only" ? "explicit_legacy" : "default_legacy");
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
  return rolloutBucket({ userRef: input.userRef, cohortKey }) < rolloutBps
    ? selected("selected_by_rollout")
    : legacy("default_legacy");
}
