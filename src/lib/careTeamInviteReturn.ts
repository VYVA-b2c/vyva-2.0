const CARE_TEAM_INVITE_RETURN_KEY = "vyva_care_team_invite_return";
const CARE_TEAM_INVITE_PREFIX = "/care-team/invite/";

export function normalizeCareTeamInviteReturnPath(value: string | null | undefined): string | null {
  if (!value || value.startsWith("//")) return null;
  const path = value.trim();
  if (!path.startsWith(CARE_TEAM_INVITE_PREFIX)) return null;
  const rawToken = path.slice(CARE_TEAM_INVITE_PREFIX.length).split(/[?#]/)[0]?.trim();
  return rawToken ? path : null;
}

export function isCareTeamInviteReturnPath(value: string | null | undefined): boolean {
  return normalizeCareTeamInviteReturnPath(value) !== null;
}

export function careTeamInviteTokenFromReturnPath(value: string | null | undefined): string | null {
  const path = normalizeCareTeamInviteReturnPath(value);
  if (!path) return null;
  const rawToken = path.slice(CARE_TEAM_INVITE_PREFIX.length).split(/[?#]/)[0]?.trim();
  if (!rawToken) return null;
  try {
    return decodeURIComponent(rawToken);
  } catch {
    return rawToken;
  }
}

export function rememberCareTeamInviteReturnPath(value: string | null | undefined) {
  const path = normalizeCareTeamInviteReturnPath(value);
  if (!path || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CARE_TEAM_INVITE_RETURN_KEY, path);
  } catch {
    // Some embedded browsers can deny sessionStorage. The URL returnTo path still handles the normal flow.
  }
}

export function currentCareTeamInviteReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const path = normalizeCareTeamInviteReturnPath(window.sessionStorage.getItem(CARE_TEAM_INVITE_RETURN_KEY));
    if (!path) window.sessionStorage.removeItem(CARE_TEAM_INVITE_RETURN_KEY);
    return path;
  } catch {
    return null;
  }
}

export function clearCareTeamInviteReturnPath() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CARE_TEAM_INVITE_RETURN_KEY);
  } catch {
    // No-op.
  }
}

