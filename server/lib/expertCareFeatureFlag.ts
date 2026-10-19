export const EXPERT_CARE_RELEASE_MODES = ["disabled", "internal", "closed_pilot", "limited_pilot", "general"] as const;
export type ExpertCareReleaseMode = typeof EXPERT_CARE_RELEASE_MODES[number];

const list = (value: string | undefined) => new Set((value ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean));

export function resolveExpertCareFeatureFlag(
  identity: { userId: string; email?: string | null },
  env: NodeJS.ProcessEnv = process.env,
) {
  const configured = env.EXPERT_CARE_RELEASE_MODE;
  const mode: ExpertCareReleaseMode = EXPERT_CARE_RELEASE_MODES.includes(configured as ExpertCareReleaseMode)
    ? configured as ExpertCareReleaseMode
    : env.NODE_ENV === "production" ? "disabled" : "general";
  const allowlist = list(env.EXPERT_CARE_ALLOWED_IDENTITIES);
  const identityAllowed = allowlist.has(identity.userId.toLowerCase()) || Boolean(identity.email && allowlist.has(identity.email.toLowerCase()));
  const enabled = mode === "general" || (mode !== "disabled" && identityAllowed);
  return {
    enabled,
    mode,
    reason: enabled ? null : mode === "disabled" ? "feature_disabled" : "pilot_access_required",
  } as const;
}
