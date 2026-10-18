import { pool } from "../db.js";

export class ConciergeRequestBusyError extends Error {
  constructor() { super("This request is being processed. Please try again when it finishes."); }
}

// Shared by execution, draft promotion and deletion across all server processes.
export async function withConciergeRequestLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as locked", [`concierge:${key}`],
    );
    if (!result.rows[0]?.locked) throw new ConciergeRequestBusyError();
    const value = await work();
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}
