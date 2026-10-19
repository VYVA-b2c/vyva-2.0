import { afterEach, describe, expect, it, vi } from "vitest";
import { latestMedicineProfileUpdatedAt } from "./medicineCheckUpdatedAt";

describe("latestMedicineProfileUpdatedAt", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the latest persisted medicine or profile modification instead of request time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T22:00:00.000Z"));

    expect(latestMedicineProfileUpdatedAt(
      new Date("2026-10-10T09:00:00.000Z"),
      [
        { updated_at: new Date("2026-10-12T11:30:00.000Z") },
        { updated_at: new Date("2026-10-11T15:00:00.000Z") },
      ],
    )).toBe("2026-10-12T11:30:00.000Z");
  });

  it("uses the profile modification when it is newer than every medicine", () => {
    expect(latestMedicineProfileUpdatedAt(
      "2026-10-15T08:45:00.000Z",
      [{ updated_at: "2026-10-12T11:30:00.000Z" }],
    )).toBe("2026-10-15T08:45:00.000Z");
  });
});
