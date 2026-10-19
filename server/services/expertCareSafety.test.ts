import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("../db.js", () => ({ pool: { query: db.query, connect: db.connect } }));

import { expertCareRuntimeControl, recordExpertCareSafetyEvent } from "./expertCareSafety.js";

describe("Expert Care safety circuit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.connect.mockResolvedValue({ query: db.clientQuery, release: db.release });
    db.clientQuery.mockImplementation(async (sql: string) => sql.includes("returning id") ? { rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] } : { rows: [] });
  });

  it("automatically disables the service for a critical privacy failure", async () => {
    const result = await recordExpertCareSafetyEvent({ metric: "privacy_failure", severity: "critical", metadata: { source: "audit" } });
    expect(result.rollbackTriggered).toBe(true);
    expect(db.clientQuery).toHaveBeenCalledWith(expect.stringContaining("force_disabled = true"), expect.arrayContaining([expect.any(String), "privacy_failure"]));
    expect(db.clientQuery).toHaveBeenCalledWith("commit");
  });

  it("records ordinary metrics without tripping rollback", async () => {
    const result = await recordExpertCareSafetyEvent({ metric: "citation_coverage", value: 1 });
    expect(result.rollbackTriggered).toBe(false);
    expect(db.clientQuery.mock.calls.some(([sql]) => String(sql).includes("force_disabled = true"))).toBe(false);
  });

  it("returns the persistent circuit state", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ force_disabled: true, reason: "unsupported_claim_detected", incident_event_id: "event-1", updated_at: "2026-10-19T12:00:00Z" }] });
    await expect(expertCareRuntimeControl()).resolves.toMatchObject({ forceDisabled: true, reason: "unsupported_claim_detected" });
  });
});
