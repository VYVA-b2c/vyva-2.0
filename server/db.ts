import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

const rawDatabaseUrl = process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL
  ?? process.env.POSTGRES_PRISMA_URL
  ?? process.env.POSTGRES_URL_NON_POOLING;

if (!rawDatabaseUrl) {
  throw new Error(
    "DATABASE_URL or a Vercel Postgres URL must be set. For local admin login, create a .env file from .env.example and set DATABASE_URL to a reachable PostgreSQL database before starting the API server.",
  );
}

function normalizeDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    const isSupabase = url.hostname === "supabase.com" || url.hostname.endsWith(".supabase.com");
    if (
      isSupabase
      && url.searchParams.get("sslmode") === "require"
      && !url.searchParams.has("uselibpqcompat")
    ) {
      // Supabase's Vercel integration emits libpq-style `sslmode=require` URLs.
      // pg-connection-string otherwise treats `require` as `verify-full`, which
      // rejects the Supabase pooler's certificate chain in Vercel functions.
      url.searchParams.set("uselibpqcompat", "true");
    }
    return url.toString();
  } catch {
    return value;
  }
}

const databaseUrl = normalizeDatabaseUrl(rawDatabaseUrl);

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });
