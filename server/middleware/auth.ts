import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/jwt.js";
import { verifySupabaseAccessToken } from "../lib/supabaseAuth.js";
import { readAuthSessionCookie } from "../lib/sessionCookie.js";
import { isLocalDevelopmentRequest } from "../lib/requestEnvironment.js";
import { db } from "../db.js";
import { users } from "../../shared/schema.js";

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
const REVOKED_LEGACY_LOGIN_INTENT = "admin_deleted_login";

function isSuperAdminEmail(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

function nestedErrorField(error: unknown, field: string, seen = new Set<unknown>()): unknown {
  if (!error || typeof error !== "object" || seen.has(error)) return undefined;
  seen.add(error);
  const record = error as Record<string, unknown>;
  if (record[field] !== undefined) return record[field];
  return nestedErrorField(record.cause, field, seen);
}

function databaseUnavailableDetail(error: unknown): string | null {
  const code = nestedErrorField(error, "code");
  const hostname = nestedErrorField(error, "hostname");
  const message = error instanceof Error ? error.message : String(error ?? "");
  const nestedMessage = nestedErrorField(error, "message");
  const combinedMessage = [message, typeof nestedMessage === "string" ? nestedMessage : ""].join(" ");

  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || combinedMessage.includes("ENOTFOUND")) {
    const hostLabel = typeof hostname === "string" && hostname.trim() ? ` (${hostname})` : "";
    return `The app database host${hostLabel} cannot be reached from this environment. Check DATABASE_URL or local network access, restart the API, and try again.`;
  }

  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ECONNRESET") {
    return "The app database connection was refused or timed out. Check that the database is running and reachable, restart the API, and try again.";
  }

  if (combinedMessage.includes("DATABASE_URL")) {
    return "DATABASE_URL is missing or invalid for the API server. Set it to a reachable PostgreSQL database, restart the API, and try again.";
  }

  return null;
}

function isRevokedLegacyLogin(account: { password_hash: string; onboarding_intent: string | null } | null | undefined) {
  return !account
    || account.onboarding_intent === REVOKED_LEGACY_LOGIN_INTENT
    || account.password_hash.startsWith("revoked:");
}

async function legacyTokenCanAuthenticate(userId: string): Promise<boolean> {
  try {
    const [account] = await db
      .select({
        password_hash: users.password_hash,
        onboarding_intent: users.onboarding_intent,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return !isRevokedLegacyLogin(account);
  } catch (error) {
    console.error("[auth] legacy token account lookup failed:", error);
    return false;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role?: string; authProvider?: "legacy" | "supabase"; [key: string]: unknown };
    }
  }
}

/**
 * Authentication middleware.
 *
 * Reads a JWT from `Authorization: Bearer <token>`, verifies it, and sets
 * `req.user.id` from the token's `sub` claim.
 *
 * - Valid token  → sets req.user and calls next()
 * - Invalid token → immediately returns 401 (prevents fallthrough)
 * - No token     → calls next() without setting req.user
 *                  (protected routes use requireUser to enforce auth)
 *
 * Development fallback: when NODE_ENV is not "production", a bare
 * `x-user-id` header is also accepted (for local tooling pre-dating JWT auth).
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"] as string | undefined;
  const cookieToken = readAuthSessionCookie(req);

  async function applyToken(token: string): Promise<boolean> {
    const userId = await verifyToken(token);
    if (userId) {
      if (!await legacyTokenCanAuthenticate(userId)) return false;
      req.user = { id: userId, authProvider: "legacy" };
      return true;
    }

    const supabaseUser = await verifySupabaseAccessToken(token);
    if (supabaseUser) {
      req.user = { id: supabaseUser.id, email: supabaseUser.email, authProvider: "supabase" };
      return true;
    }

    return false;
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (await applyToken(token)) {
      return next();
    }
    // Prefer a still-valid cookie session if local storage has gone stale.
    if (cookieToken && cookieToken !== token && await applyToken(cookieToken)) {
      return next();
    }

    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  if (cookieToken && await applyToken(cookieToken)) {
    return next();
  }

  // Dev/test fallback: trust x-user-id header only outside production.
  if (isLocalDevelopmentRequest(req)) {
    const rawId = req.headers["x-user-id"] as string | undefined;
    if (rawId && rawId.trim().length > 0) {
      req.user = { id: rawId.trim() };
      return next();
    }
  }

  next();
}

/**
 * Route-level guard. Call after authMiddleware on any route that requires
 * a logged-in user. Returns 401 if req.user is not set.
 */
export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export async function requireAdminUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [{ eq }, { db }, { profiles, users }] = await Promise.all([
    import("drizzle-orm"),
    import("../db.js"),
    import("../../shared/schema.js"),
  ]);

  let profile: { role: string; email: string | null } | undefined;
  let account: { email: string | null } | undefined;

  try {
    [profile] = await db
      .select({ role: profiles.role, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, req.user.id))
      .limit(1);

    [account] = req.user.email
      ? []
      : await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, req.user.id))
          .limit(1);
  } catch (error) {
    console.error("[auth] admin guard database lookup failed:", error);
    const detail = databaseUnavailableDetail(error);
    res.status(503).json({
      error: "Admin database could not be reached.",
      code: "ADMIN_DATABASE_UNAVAILABLE",
      ...(detail ? { details: [detail] } : {}),
    });
    return;
  }

  const isSuperAdmin =
    isSuperAdminEmail(req.user.email) ||
    isSuperAdminEmail(profile?.email) ||
    isSuperAdminEmail(account?.email);

  if (!profile && !isSuperAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  if (profile?.role !== "admin" && !isSuperAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  req.user.role = "admin";
  req.user.email = req.user.email ?? profile?.email ?? account?.email ?? undefined;
  next();
}
