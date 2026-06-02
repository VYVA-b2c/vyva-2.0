const SIGNUP_INVITE_SESSION_KEY = "vyva_signup_invite_id";

export type SignupInviteAuditEvent = "clicked" | "profile_started" | "profile_created" | "profile_completed";

export function signupInviteIdFromSearch(search: string): string | null {
  const inviteId = new URLSearchParams(search).get("invite_id")?.trim();
  return inviteId || null;
}

export function rememberSignupInviteId(inviteId: string | null | undefined) {
  if (!inviteId) return;
  window.sessionStorage.setItem(SIGNUP_INVITE_SESSION_KEY, inviteId);
}

export function currentSignupInviteId(search?: string): string | null {
  const fromSearch = typeof search === "string" ? signupInviteIdFromSearch(search) : null;
  if (fromSearch) {
    rememberSignupInviteId(fromSearch);
    return fromSearch;
  }
  return window.sessionStorage.getItem(SIGNUP_INVITE_SESSION_KEY);
}

export function clearSignupInviteId(inviteId?: string | null) {
  const current = window.sessionStorage.getItem(SIGNUP_INVITE_SESSION_KEY);
  if (!inviteId || current === inviteId) {
    window.sessionStorage.removeItem(SIGNUP_INVITE_SESSION_KEY);
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
