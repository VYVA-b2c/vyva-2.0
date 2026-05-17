import type { Request, Response } from "express";
import { signToken } from "./jwt.js";

export const AUTH_SESSION_COOKIE = "vyva_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function encodeCookieValue(value: string): string {
  return encodeURIComponent(value);
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${encodeCookieValue(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== name) continue;
    return decodeCookieValue(rawValue.join("="));
  }

  return null;
}

export function readAuthSessionCookie(req: Request): string | null {
  return readCookie(req, AUTH_SESSION_COOKIE);
}

export async function issueAuthSessionCookie(res: Response, userId: string): Promise<string> {
  const token = await signToken(userId);
  res.append("Set-Cookie", serializeCookie(AUTH_SESSION_COOKIE, token, SESSION_MAX_AGE_SECONDS));
  return token;
}

export function clearAuthSessionCookie(res: Response): void {
  res.append("Set-Cookie", serializeCookie(AUTH_SESSION_COOKIE, "", 0));
}
