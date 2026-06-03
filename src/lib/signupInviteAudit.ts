const SIGNUP_INVITE_SESSION_KEY = "vyva_signup_invite_id";

export type SignupInviteAuditEvent = "clicked" | "profile_started" | "profile_created" | "profile_completed";

function inviteSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function signupInviteIdFromSearch(search: string): string | null {
  const inviteId = new URLSearchParams(search).get("invite_id")?.trim();
  return inviteId || null;
}

export function rememberSignupInviteId(inviteId: string | null | undefined) {
  if (!inviteId) return;
  try {
    inviteSessionStorage()?.setItem(SIGNUP_INVITE_SESSION_KEY, inviteId);
  } catch {
    // Invite tracking should never block account setup.
  }
}

export function currentSignupInviteId(search?: string): string | null {
  const fromSearch = typeof search === "string" ? signupInviteIdFromSearch(search) : null;
  if (fromSearch) {
    rememberSignupInviteId(fromSearch);
    return fromSearch;
  }
  try {
    return inviteSessionStorage()?.getItem(SIGNUP_INVITE_SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}

export function clearSignupInviteId(inviteId?: string | null) {
  try {
    const storage = inviteSessionStorage();
    const current = storage?.getItem(SIGNUP_INVITE_SESSION_KEY);
    if (!inviteId || current === inviteId) {
      storage?.removeItem(SIGNUP_INVITE_SESSION_KEY);
    }
  } catch {
    // Invite tracking should never block account setup.
  }
}

export function trackSignupInviteEvent(
  inviteId: string | null | undefined,
  event: SignupInviteAuditEvent,
  options: { destination?: string; keepalive?: boolean; clearAfter?: boolean } = {},
) {
  if (!inviteId) return;
  const body = JSON.stringify({
    invite_id: inviteId,
    event,
    destination: options.destination,
  });

  fetch("/api/auth/signup-invite/track", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: options.keepalive ?? true,
  }).catch(() => {
    // Invite tracking is operational audit only; never block the user flow.
  });

  if (options.clearAfter) clearSignupInviteId(inviteId);
}
