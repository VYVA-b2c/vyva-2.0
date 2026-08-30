import { describe, expect, it } from "vitest";
import { calculateRefillInventory } from "../../server/medication/refillInventory";

const base = {
  today: "2026-08-30",
  unitsPerDose: 1,
  dailyFrequency: 1,
  refillAlertDays: 7,
  missedDosesByDate: {},
};

describe("medication refill inventory calculation", () => {
  it("requires a quantity and confirmed routine before forecasting", () => {
    expect(calculateRefillInventory({ ...base, events: [] })).toMatchObject({
      status: "setup_needed",
      estimatedQuantity: null,
      projectedRunOutDate: null,
      confidence: "low",
    });
    expect(calculateRefillInventory({ ...base, unitsPerDose: null, events: [{ eventType: "stock_count", quantity: 20, occurredOn: base.today }] }).status).toBe("setup_needed");
  });

  it("uses seven days as the inclusive refill-soon boundary", () => {
    const seven = calculateRefillInventory({ ...base, events: [{ eventType: "stock_count", quantity: 7, occurredOn: base.today }] });
    const eight = calculateRefillInventory({ ...base, events: [{ eventType: "stock_count", quantity: 8, occurredOn: base.today }] });
    expect(seven.status).toBe("refill_soon");
    expect(eight.status).toBe("on_track");
  });

  it("returns refill-now without exposing a negative stock estimate", () => {
    const result = calculateRefillInventory({
      ...base,
      events: [{ eventType: "stock_count", quantity: 1, occurredOn: "2026-08-20" }],
    });
    expect(result.status).toBe("refill_now");
    expect(result.estimatedQuantity).toBe(0);
    expect(result.daysRemaining).toBe(0);
  });

  it("adds multiple purchases and removes scheduled consumption", () => {
    const result = calculateRefillInventory({
      ...base,
      events: [
        { eventType: "purchase", quantity: 10, occurredOn: "2026-08-28" },
        { eventType: "purchase", quantity: 5, occurredOn: "2026-08-29" },
      ],
    });
    expect(result.estimatedQuantity).toBe(12);
    expect(result.daysRemaining).toBe(12);
  });

  it("resets the estimate at the latest absolute stock count", () => {
    const result = calculateRefillInventory({
      ...base,
      events: [
        { eventType: "purchase", quantity: 100, occurredOn: "2026-08-20" },
        { eventType: "stock_count", quantity: 10, occurredOn: "2026-08-29" },
        { eventType: "purchase", quantity: 5, occurredOn: "2026-08-30" },
      ],
    });
    expect(result.estimatedQuantity).toBe(14);
    expect(result.calculationReason).toContain("latest stock count");
  });

  it("adds stock back for explicitly recorded missed doses", () => {
    const withoutMissedDose = calculateRefillInventory({
      ...base,
      events: [{ eventType: "stock_count", quantity: 10, occurredOn: "2026-08-28" }],
    });
    const withMissedDose = calculateRefillInventory({
      ...base,
      missedDosesByDate: { "2026-08-29": 1 },
      events: [{ eventType: "stock_count", quantity: 10, occurredOn: "2026-08-28" }],
    });
    expect(withoutMissedDose.estimatedQuantity).toBe(8);
    expect(withMissedDose.estimatedQuantity).toBe(9);
  });

  it("supports decimal quantities and routines", () => {
    const result = calculateRefillInventory({
      ...base,
      unitsPerDose: 2.5,
      dailyFrequency: 2,
      events: [{ eventType: "stock_count", quantity: 47.5, occurredOn: base.today }],
    });
    expect(result.estimatedQuantity).toBe(47.5);
    expect(result.daysRemaining).toBe(9);
    expect(result.projectedRunOutDate).toBe("2026-09-08");
  });

  it("marks stale uncorrected purchase estimates as uncertain", () => {
    const result = calculateRefillInventory({
      ...base,
      events: [{ eventType: "purchase", quantity: 500, occurredOn: "2026-05-01" }],
    });
    expect(result.status).toBe("uncertain");
    expect(result.confidence).toBe("low");
  });

  it("uses date-only UTC arithmetic across month boundaries", () => {
    const result = calculateRefillInventory({
      ...base,
      today: "2026-03-01",
      events: [{ eventType: "stock_count", quantity: 4, occurredOn: "2026-02-27" }],
    });
    expect(result.estimatedQuantity).toBe(2);
    expect(result.projectedRunOutDate).toBe("2026-03-02");
  });
});
