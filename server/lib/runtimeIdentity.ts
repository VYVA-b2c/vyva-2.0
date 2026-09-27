import { createHash } from "node:crypto";

export function runtimeIdentity(env: NodeJS.ProcessEnv = process.env) {
  const keys = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"] as const;
  const databaseConfigSource = keys.find(key => env[key] !== undefined) ?? null;
  let databaseTargetFingerprint: string | null = null;
  try {
    const url = new URL(databaseConfigSource ? env[databaseConfigSource]! : "");
    // Identify the configured target, never credentials. This is not proof of database equality.
    const target = JSON.stringify([url.hostname.toLowerCase(), url.port || "5432", url.pathname]);
    databaseTargetFingerprint = createHash("sha256").update(target).digest("hex").slice(0, 16);
  } catch {
    // Missing or invalid configuration is reported without exposing the connection string.
  }
  return {
    nodeEnvironment: env.NODE_ENV ?? "unset",
    databaseConfigSource,
    databaseTargetFingerprint,
  };
}
