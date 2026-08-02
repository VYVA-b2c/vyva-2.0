import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getToken, setToken, clearToken, isAuthenticated } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { getLanguageSnapshot, setAccountLanguage } from "@/i18n";
import { signInWithSupabase } from "@/lib/supabaseAuth";

const ONBOARDING_STATE_KEY = ["/api/onboarding/state"] as const;
const LOCAL_PREVIEW_AUTH_KEY = "vyva_local_preview_auth";
const LOCAL_API_UNAVAILABLE_MESSAGE =
  "Local API is not running. Start the backend on port 3001 and make sure DATABASE_URL is set.";

interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  language: string | null;
  activeProfileId: string | null;
  activeProfileRole: string | null;
  profileCount: number;
  needsProfileSetup: boolean;
  needsProfileSelection: boolean;
  role: string;
}

interface AuthIdentifier {
  email?: string;
  phone?: string;
  identifier?: string;
  language?: string;
  invite_id?: string;
  care_team_invite_token?: string;
  setup_for?: "self" | "someone_else";
}

interface MagicLinkResponse {
  message: string;
}

interface CurrentUserResult {
  user: AuthUser;
  token: string | null;
  prevSeenAt: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  lastSeenAt: string | null;
  login: (identifier: string | AuthIdentifier, password: string) => Promise<AuthUser>;
  register: (identifier: string | AuthIdentifier, password: string) => Promise<AuthUser>;
  requestMagicLink: (identifier: string | AuthIdentifier) => Promise<MagicLinkResponse>;
  loginWithMagicToken: (magicToken: string) => Promise<AuthUser>;
  refreshCurrentUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

class AuthLoadError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthLoadError";
    this.status = status;
  }
}

function contactPayload(identifier: string | AuthIdentifier): AuthIdentifier {
  if (typeof identifier === "string") return { identifier };
  return identifier;
}

function emailFromIdentifier(identifier: string | AuthIdentifier): string | null {
  const payload = contactPayload(identifier);
  const raw = payload.email ?? (payload.identifier?.includes("@") ? payload.identifier : null);
  return raw?.trim() || null;
}

function apiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const body = data as { error?: unknown; message?: unknown; code?: unknown };
  if (body.code === "LOCAL_API_UNAVAILABLE" || body.error === "API proxy failed") {
    return typeof body.message === "string" && body.message.trim()
      ? body.message
      : LOCAL_API_UNAVAILABLE_MESSAGE;
  }
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  return fallback;
}

function languageHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const language = getLanguageSnapshot();
  headers.set("X-VYVA-Language", language.language);
  headers.set("X-VYVA-Language-Source", language.source);
  return headers;
}

function responseUser(data: {
  userId?: string;
  id?: string;
  email?: string | null;
  phone?: string | null;
  language?: string | null;
  activeProfileId?: string | null;
  activeProfileRole?: string | null;
  profileCount?: number | null;
  needsProfileSetup?: boolean | null;
  needsProfileSelection?: boolean | null;
  role?: string | null;
}): AuthUser {
  return {
    id: data.userId ?? data.id ?? "",
    email: data.email ?? null,
    phone: data.phone ?? null,
    language: data.language ?? null,
    activeProfileId: data.activeProfileId ?? null,
    activeProfileRole: data.activeProfileRole ?? null,
    profileCount: typeof data.profileCount === "number" ? data.profileCount : 0,
    needsProfileSetup: Boolean(data.needsProfileSetup),
    needsProfileSelection: Boolean(data.needsProfileSelection),
    role: data.role ?? "user",
  };
}

function canUseLocalPreviewAuth(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
}

function isLocalPreviewAuthEnabled(): boolean {
  if (!canUseLocalPreviewAuth()) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("local_preview") === "1") {
      window.localStorage.setItem(LOCAL_PREVIEW_AUTH_KEY, "1");
      return true;
    }
    return window.localStorage.getItem(LOCAL_PREVIEW_AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

function clearLocalPreviewAuth(): void {
  try {
    window.localStorage.removeItem(LOCAL_PREVIEW_AUTH_KEY);
  } catch {
    // ignore
  }
}

function base64UrlJson(value: unknown): string {
  return window.btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function localPreviewCurrentUser(): CurrentUserResult {
  const language = getLanguageSnapshot().language;
  const now = Math.floor(Date.now() / 1000);
  const token = [
    base64UrlJson({ alg: "none", typ: "JWT" }),
    base64UrlJson({
      sub: "local-preview-user",
      email: "local.preview@vyva.dev",
      exp: now + 60 * 60 * 8,
      iat: now,
      iss: "vyva-local-preview",
    }),
    "local-preview",
  ].join(".");

  return {
    token,
    prevSeenAt: null,
    user: {
      id: "local-preview-user",
      email: "local.preview@vyva.dev",
      phone: null,
      language,
      activeProfileId: "local-preview-profile",
      activeProfileRole: "owner",
      profileCount: 1,
      needsProfileSetup: false,
      needsProfileSelection: false,
      role: "user",
    },
  };
}

async function loadCurrentUser(token?: string | null, fallback?: { userId?: string; email?: string | null }): Promise<CurrentUserResult> {
  const headers = languageHeaders(token ? { Authorization: `Bearer ${token}` } : undefined);
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new AuthLoadError(response.status, apiErrorMessage(body, "Could not load your account"));
  }

  const data = await response.json();
  return {
    user: responseUser({
      ...data,
      id: data.id ?? fallback?.userId,
      email: data.email ?? fallback?.email,
    }),
    token: typeof data.token === "string" ? data.token : token ?? null,
    prevSeenAt: data.prevSeenAt ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  const applyToken = useCallback((tok: string, u: AuthUser, prevSeenAt: string | null) => {
    setToken(tok);
    setTokenState(tok);
    setUser(u);
    setLastSeenAt(prevSeenAt);
    if (u.language) setAccountLanguage(u.language);
    queryClient.prefetchQuery({ queryKey: ONBOARDING_STATE_KEY });
    return u;
  }, []);

  const applyLocalPreviewAuth = useCallback(() => {
    const currentUser = localPreviewCurrentUser();
    if (currentUser.token) setToken(currentUser.token);
    setTokenState(currentUser.token);
    setUser(currentUser.user);
    setLastSeenAt(currentUser.prevSeenAt);
    if (currentUser.user.language) setAccountLanguage(currentUser.user.language);
    queryClient.setQueryData(ONBOARDING_STATE_KEY, {
      onboardingState: { current_stage: "complete" },
      profile: { current_stage: "complete" },
    });
    return currentUser.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Local session cleanup should still happen if the network request fails.
    } finally {
      clearToken();
      clearLocalPreviewAuth();
      setTokenState(null);
      setUser(null);
      setLastSeenAt(null);
      queryClient.removeQueries({ queryKey: ["/api/onboarding/state"] });
      queryClient.removeQueries({ queryKey: ["/api/profile"] });
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (isLocalPreviewAuthEnabled()) {
      return applyLocalPreviewAuth();
    }

    const stored = getToken();
    const currentUser = await loadCurrentUser(stored);
    if (currentUser.token) {
      setToken(currentUser.token);
    } else {
      clearToken();
    }
    setTokenState(currentUser.token);
    setUser(currentUser.user);
    setLastSeenAt(currentUser.prevSeenAt);
    if (currentUser.user.language) setAccountLanguage(currentUser.user.language);
    queryClient.invalidateQueries({ queryKey: ONBOARDING_STATE_KEY });
    queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    return currentUser.user;
  }, [applyLocalPreviewAuth]);

  useEffect(() => {
    if (isLocalPreviewAuthEnabled()) {
      applyLocalPreviewAuth();
      setIsLoading(false);
      return;
    }

    const stored = getToken();
    const usableStored = stored && isAuthenticated() ? stored : null;

    loadCurrentUser(usableStored)
      .then((data) => {
        if (data.token) {
          setToken(data.token);
        } else {
          clearToken();
        }
        setTokenState(data.token);
        setUser(data.user);
        setLastSeenAt(data.prevSeenAt);
        if (data.user.language) setAccountLanguage(data.user.language);
        queryClient.prefetchQuery({ queryKey: ONBOARDING_STATE_KEY });
      })
      .catch((err) => {
        if (err instanceof AuthLoadError && (err.status === 401 || err.status === 403)) {
          clearToken();
          setTokenState(null);
        }
      })
      .finally(() => setIsLoading(false));
  }, [applyLocalPreviewAuth]);

  const login = useCallback(async (identifier: string | AuthIdentifier, password: string) => {
    const email = emailFromIdentifier(identifier);
    if (email) {
      try {
        const session = await signInWithSupabase(email, password);
        const currentUser = await loadCurrentUser(session.token, { userId: session.userId, email: session.email });
        return applyToken(currentUser.token ?? session.token, currentUser.user, currentUser.prevSeenAt);
      } catch {
        // Fall back to VYVA's backend auth so regular email/password accounts
        // are not blocked by Supabase confirmation or SMTP setup.
      }
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: languageHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...contactPayload(identifier), password }),
    }).catch((err) => {
      throw new Error(err instanceof TypeError ? LOCAL_API_UNAVAILABLE_MESSAGE : "Login failed");
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(data, "Login failed"));
    return applyToken(data.token, responseUser(data), data.prevSeenAt ?? null);
  }, [applyToken]);

  const register = useCallback(async (identifier: string | AuthIdentifier, password: string) => {
    const payload = contactPayload(identifier);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "same-origin",
      headers: languageHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...payload, language: payload.language ?? getLanguageSnapshot().language, password }),
    }).catch((err) => {
      throw new Error(err instanceof TypeError ? LOCAL_API_UNAVAILABLE_MESSAGE : "Registration failed");
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(data, "Registration failed"));
    return applyToken(data.token, responseUser(data), null);
  }, [applyToken]);

  const requestMagicLink = useCallback(async (identifier: string | AuthIdentifier) => {
    const res = await fetch("/api/auth/magic-link-request", {
      method: "POST",
      credentials: "same-origin",
      headers: languageHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(contactPayload(identifier)),
    }).catch((err) => {
      throw new Error(err instanceof TypeError ? LOCAL_API_UNAVAILABLE_MESSAGE : "Could not send sign-in link");
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(data, "Could not send sign-in link"));
    return data as MagicLinkResponse;
  }, []);

  const loginWithMagicToken = useCallback(async (magicToken: string) => {
    const res = await fetch("/api/auth/magic-login", {
      method: "POST",
      credentials: "same-origin",
      headers: languageHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ token: magicToken }),
    }).catch((err) => {
      throw new Error(err instanceof TypeError ? LOCAL_API_UNAVAILABLE_MESSAGE : "This sign-in link did not work");
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(data, "This sign-in link did not work"));
    return applyToken(data.token, responseUser(data), data.prevSeenAt ?? null);
  }, [applyToken]);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, lastSeenAt, login, register, requestMagicLink, loginWithMagicToken, refreshCurrentUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
