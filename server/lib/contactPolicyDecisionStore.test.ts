import { describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  context: vi.fn(),
  count: vi.fn(),
}));
vi.mock("../db.js", () => ({ pool: { connect: mocks.connect } }));
vi.mock("./contactPolicyStore.js", () => ({
  getContactPolicyForUser: mocks.context,
}));
vi.mock("./outboundCallBudget.js", () => ({
  countOutboundCallsToday: mocks.count,
}));
import { DEFAULT_CONTACT_POLICY } from "../../shared/contactPolicy";
import {
  recordOutboundDecision,
  residentLocalTime,
} from "./contactPolicyDecisionStore";
import { localDayWindow } from "./dailyCheckinSchedule";
describe("resident date boundary", () => {
  it.each(["Europe/Madrid", "Europe/Berlin"])(
    "uses local midnight in %s",
    (timezone) => {
      const before = new Date("2026-11-01T22:59:00Z"),
        after = new Date("2026-11-01T23:00:00Z");
      expect(localDayWindow(before, timezone).date_key).toBe("2026-11-01");
      expect(localDayWindow(after, timezone).date_key).toBe("2026-11-02");
      expect(residentLocalTime(after, timezone)).toBe("00:00");
    },
  );
});

describe("call ledger budget", () => {
  it("allows three calls, exempts a retry, then persists WhatsApp fallback", async () => {
    let count = 0;
    const rows: unknown[][] = [];
    mocks.context.mockResolvedValue({
      policy: DEFAULT_CONTACT_POLICY,
      timezone: "Europe/Madrid",
      residentCallOverride: null,
    });
    mocks.count.mockImplementation(async () => count);
    const query = vi.fn(async (sql: string, args: unknown[] = []) => {
      if (sql.startsWith("insert")) {
        rows.push(args);
        if (
          args[3] === "voice_outbound" &&
          ["allowed", "urgent"].includes(String(args[4]))
        )
          count++;
      }
      return { rows: [] };
    });
    mocks.connect.mockResolvedValue({ query, release: vi.fn() });
    const send = (purpose = "medication") =>
      recordOutboundDecision(
        "resident",
        { purpose, requested_channel: "voice_outbound" },
        new Date("2026-11-01T10:00:00Z"),
      );
    expect((await send()).calls_today).toBe(1);
    expect((await send("checkin_retry")).calls_today).toBe(1);
    await send();
    expect((await send()).calls_today).toBe(3);
    expect(await send()).toMatchObject({
      decided_channel: "whatsapp_outbound",
      reason: "over_daily_limit",
      calls_today: 3,
    });
    expect(rows).toHaveLength(5);
    expect(query).toHaveBeenCalledWith(
      "select pg_advisory_xact_lock(hashtext($1))",
      ["contact-budget:resident"],
    );
  });
});
