import { describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  query: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("../db.js", () => ({
  db: { select: mocks.select, insert: mocks.insert },
  pool: { query: mocks.query, connect: mocks.connect },
}));
vi.mock("../lib/contactPolicyStore.js", () => ({
  getContactPolicyForUser: vi.fn(),
}));
vi.mock("drizzle-orm/node-postgres",()=>({drizzle:()=>({select:mocks.select,insert:mocks.insert})}));
import { createNoResponseAlert } from "./dailyCheckinMonitor";
import { evaluateDailyCheckinSchedule } from "../lib/dailyCheckinSchedule";
describe("no-answer daily idempotency", () => {
  it("reuses the same alert on duplicate calls", async () => {
    const alert = { id: "one-alert", alert_type: "daily_checkin_no_response" };
    let saved = false;
    mocks.query.mockResolvedValue({
      rows: [
        {
          caregiver_contact: "caregiver",
          data_sharing_consent: { caregiver_alerts: true, safety_alerts: true },
          language: "en",
        },
      ],
    });
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      release: vi.fn(),
    });
    mocks.select.mockImplementation(() => {
      let ordered = false;
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => {
          ordered = true;
          return chain;
        },
        limit: async () => (ordered ? (saved ? [alert] : []) : []),
      };
      return chain;
    });
    mocks.insert.mockReturnValue({
      values: () => ({
        returning: async () => {
          saved = true;
          return [alert];
        },
      }),
    });
    const status = evaluateDailyCheckinSchedule({
      now: new Date("2026-11-01T11:00:00Z"),
      timezone: "UTC",
      scheduledTimes: ["10:00"],
    });
    const schedule = {
      escalation_contacts: [{ name: "Caregiver", contact: "caregiver" }],
    } as Parameters<typeof createNoResponseAlert>[1];
    const first = await createNoResponseAlert("resident", schedule, status);
    const second = await createNoResponseAlert("resident", schedule, status);
    expect(first.alert?.id).toBe("one-alert");
    expect(second.alert?.id).toBe("one-alert");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });
});
