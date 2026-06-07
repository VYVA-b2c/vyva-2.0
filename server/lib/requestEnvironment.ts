import type { Request } from "express";

const LOCAL_HOSTS = new Set([
  "",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "0:0:0:0:0:0:0:1",
]);

function hostValues(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function hostName(value: string): string {
  const lower = value.toLowerCase();
  if (lower.startsWith("[")) {
    const end = lower.indexOf("]");
    return end > -1 ? lower.slice(1, end) : lower;
  }

  const colonIndex = lower.indexOf(":");
  return colonIndex > -1 ? lower.slice(0, colonIndex) : lower;
}

function isLocalHost(value: string): boolean {
  const name = hostName(value);
  return LOCAL_HOSTS.has(name) || name.endsWith(".localhost");
}

export function isLocalDevelopmentRequest(req: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const hosts = [
    ...hostValues(req.headers.host),
    ...hostValues(req.headers["x-forwarded-host"] as string | string[] | undefined),
  ];

  return hosts.length === 0 || hosts.every(isLocalHost);
}
