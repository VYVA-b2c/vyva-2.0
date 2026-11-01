import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONTACT_POLICY as p,
  isInQuietHours,
  effectiveDailyCallLimit,
  checkinNoAnswerPlan,
  widerQuietHours,
} from "./contactPolicy";
describe("contact policy", () => {
  it("wraps quiet hours with exclusive end", () => {
    for (const t of ["21:00", "23:59", "00:00", "07:59"])
      expect(isInQuietHours(t, p)).toBe(true);
    for (const t of ["08:00", "20:59"])
      expect(isInQuietHours(t, p)).toBe(false);
  });
  it("equal bounds disable quiet hours", () =>
    expect(isInQuietHours("21:00", { ...p, quietHoursEnd: "21:00" })).toBe(
      false,
    ));
  it("resident overrides only lower limits", () => {
    expect(effectiveDailyCallLimit(p, null)).toBe(3);
    expect(effectiveDailyCallLimit(p, 1)).toBe(1);
    expect(effectiveDailyCallLimit(p, 6)).toBe(3);
  });
  it("plans default retries", () =>
    expect(checkinNoAnswerPlan("10:00", p)).toEqual({
      retryTimes: ["10:15", "10:30", "10:45"],
      escalateAt: "10:45",
      graceMinutes: 45,
    }));
  it("crosses midnight", () =>
    expect(checkinNoAnswerPlan("23:50", p).retryTimes).toEqual([
      "00:05",
      "00:20",
      "00:35",
    ]));
  it("zero retries escalates immediately", () =>
    expect(
      checkinNoAnswerPlan("10:00", { ...p, checkinNoAnswerRetries: 0 }),
    ).toEqual({ retryTimes: [], escalateAt: "10:00", graceMinutes: 0 }));
});

describe("resident quiet window clamping", () => {
  it("clamps narrower quiet hours", () =>
    expect(widerQuietHours(p, "22:00", "07:00")).toEqual({
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
    }));
  it("retains wider quiet hours", () =>
    expect(widerQuietHours(p, "20:00", "09:00")).toEqual({
      quietHoursStart: "20:00",
      quietHoursEnd: "09:00",
    }));
  it("rejects disjoint windows instead of losing resident quiet hours", () =>
    expect(() => widerQuietHours(p, "12:00", "13:00")).toThrow());
});
