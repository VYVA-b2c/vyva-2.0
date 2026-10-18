import { beforeEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), release: vi.fn() }));
vi.mock("../db.js", () => ({ pool: database }));
import { deleteConciergeRequest, requestWasExecuted } from "./conciergeRequestDeletion.js";

describe("request deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    database.connect.mockResolvedValue({ query: database.query, release: database.release });
    database.query.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_try")) return { rows: [{ locked: true }] };
      if (sql.includes("select id, linked")) return { rows: [{ id: "draft", linked_pending_id: "pending" }] };
      if (sql.includes("select status")) return { rows: [{ status: "pending", action_payload: {} }] };
      return { rows: [], rowCount: 1 };
    });
  });
  it("cancels unsent work and removes its draft in the same transaction", async () => {
    await deleteConciergeRequest("draft", "draft", "owner");
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("set status = $3"), ["pending", "owner", "cancelled"]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("status = 'deleted'"), ["draft", "owner", "pending"]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("pg_try_advisory"), ["concierge:pending:pending"]);
  });
  it("retains the execution status when a live email was already sent", async () => {
    const original = database.query.getMockImplementation()!;
    database.query.mockImplementation((sql: string, ...args: unknown[]) => sql.includes("select status")
      ? Promise.resolve({ rows: [{ status: "pending", action_payload: { execution_adapter: { mode: "live", status: "sent" } } }] }) : original(sql, ...args));
    await deleteConciergeRequest("pending", "pending", "owner");
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("set status = $3"), ["pending", "owner", "pending"]);
  });
  it("blocks deletion while execution holds the shared lock", async () => {
    database.query.mockResolvedValue({ rows: [{ locked: false }] });
    await expect(deleteConciergeRequest("pending", "pending", "owner")).rejects.toThrow("being processed");
    expect(database.query.mock.calls.some(([sql]) => String(sql).includes("update "))).toBe(false);
    expect(database.release).toHaveBeenCalled();
  });
  it("blocks an in-flight or interrupted call even after the lock is released", async () => {
    const original = database.query.getMockImplementation()!;
    database.query.mockImplementation((sql: string, ...args: unknown[]) => sql.includes("select status")
      ? Promise.resolve({ rows: [{ status: "calling", action_payload: {} }] }) : original(sql, ...args));
    await expect(deleteConciergeRequest("pending", "pending", "owner")).rejects.toThrow("being processed");
    expect(database.query.mock.calls.some(([sql]) => String(sql).includes("update "))).toBe(false);
  });
  it("cannot remove a request belonging to another user", async () => {
    const original = database.query.getMockImplementation()!;
    database.query.mockImplementation((sql: string, ...args: unknown[]) => sql.includes("select status")
      ? Promise.resolve({ rows: [] }) : original(sql, ...args));
    await expect(deleteConciergeRequest("pending", "pending", "other")).rejects.toThrow("not found");
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("user_id = $2 for update"), ["pending", "other"]);
  });
  it("does not mistake a simulated send for an executed action", () => {
    expect(requestWasExecuted("pending", { execution_adapter: { mode: "dry_run", status: "sent" } })).toBe(false);
    expect(requestWasExecuted("pending", { live_handoff_status: "sent_or_called" })).toBe(true);
    expect(requestWasExecuted("completed", {})).toBe(true);
  });
});
