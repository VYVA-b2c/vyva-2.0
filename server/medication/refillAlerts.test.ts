import { describe, expect, it, vi } from "vitest";
import { serializeRefillAlert } from "./refillAlerts.js";

vi.mock("../db.js", () => ({ db: {} }));

describe("refill alert display data", () => {
  it("includes the medicine name separately from stored English text", () => {
    const alert = {
      id: "alert-1", medicine_id: "medicine-1", user_id: "profile-1", status: "refill_soon",
      cycle_key: "cycle-1", title: "Legacy English title", message: "Legacy English message",
      days_remaining: 5, projected_run_out_date: "2026-10-10",
      created_at: new Date("2026-10-05T00:00:00Z"), resolved_at: null, resolved_reason: null,
    } as Parameters<typeof serializeRefillAlert>[0];
    const result = serializeRefillAlert(alert, "ExampleMed");
    expect(result.medicineName).toBe("ExampleMed");
    expect(result.status).toBe("refill_soon");
    expect(result.daysRemaining).toBe(5);
    expect(result.title).toBe(alert.title);
  });
});
