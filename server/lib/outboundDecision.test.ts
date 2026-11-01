import { describe, it, expect } from "vitest";
import { outboundDecision } from "./outboundDecision";
import { DEFAULT_CONTACT_POLICY as policy } from "../../shared/contactPolicy";
const base = {
  purpose: "medication",
  requested_channel: "voice_outbound" as const,
  local_time: "10:00",
  calls_today: 0,
  policy,
};
describe("outbound decisions", () => {
  it.each([
    [{ calls_today: 2 }, "voice_outbound", "allowed"],
    [{ calls_today: 3 }, "whatsapp_outbound", "over_daily_limit"],
    [
      { purpose: "checkin_retry", calls_today: 3 },
      "voice_outbound",
      "retry_exempt",
    ],
    [{ local_time: "22:00" }, "skip", "quiet_hours"],
    [
      { urgent: true, local_time: "22:00", calls_today: 9 },
      "voice_outbound",
      "urgent",
    ],
    [{ purpose: "sos", local_time: "22:00" }, "voice_outbound", "urgent"],
    [
      { requested_channel: "whatsapp_outbound" },
      "whatsapp_outbound",
      "allowed",
    ],
    [{ purpose: "checkin_retry", local_time: "22:00" }, "skip", "quiet_hours"],
  ])("applies priority rules %j", (patch, channel, reason) => {
    expect(
      outboundDecision({ ...base, ...patch } as typeof base),
    ).toMatchObject({ decided_channel: channel, reason });
  });
  it("does not mutate retry count", () =>
    expect(
      outboundDecision({ ...base, purpose: "checkin_retry", calls_today: 3 })
        .calls_today,
    ).toBe(3));
});
