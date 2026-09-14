import { describe, expect, it } from "vitest";
import { effectiveDomainPermissions } from "../lib/caregiverDomainAccess.js";
import { localDateKey } from "../medication/refillAlerts.js";
import { refillPushDeliveryKey } from "./medicationRefillMonitor.js";

describe("proactive medication refill monitoring", () => {
  it("evaluates the inventory day in the profile timezone", () => {
    const instant = new Date("2026-08-30T22:30:00.000Z");
    expect(localDateKey(instant, "Europe/Madrid")).toBe("2026-08-31");
    expect(localDateKey(instant, "America/New_York")).toBe("2026-08-30");
  });

  it("requires the explicit refill-alert caregiver permission", () => {
    expect(effectiveDomainPermissions({
      domain: "meds",
      membershipPermissions: { meds: { view_adherence: true } },
    }).receive_refill_alerts).toBe(false);
    expect(effectiveDomainPermissions({
      domain: "meds",
      membershipPermissions: { meds: { receive_refill_alerts: true } },
    }).receive_refill_alerts).toBe(true);
  });

  it("deduplicates one push per recipient, medicine, and stock cycle", () => {
    const input = {
      profileId: "profile-1",
      medicineId: "medicine-1",
      cycleKey: "purchase-1",
      recipientUserId: "caregiver-1",
    };
    expect(refillPushDeliveryKey(input)).toBe(refillPushDeliveryKey({ ...input }));
    expect(refillPushDeliveryKey(input)).not.toBe(refillPushDeliveryKey({ ...input, cycleKey: "purchase-2" }));
    expect(refillPushDeliveryKey(input)).not.toBe(refillPushDeliveryKey({ ...input, recipientUserId: "caregiver-2" }));
  });
});
