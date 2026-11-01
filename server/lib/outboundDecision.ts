import {
  isInQuietHours,
  effectiveDailyCallLimit,
  type ContactPolicy,
} from "../../shared/contactPolicy.js";
export type DecisionInput = {
  purpose: string;
  requested_channel: "voice_outbound" | "whatsapp_outbound";
  urgent?: boolean;
  local_time: string;
  calls_today: number;
  policy: ContactPolicy;
  residentCallOverride?: number | null;
};
export function outboundDecision(i: DecisionInput) {
  const limit = effectiveDailyCallLimit(i.policy, i.residentCallOverride);
  const result = (
    decided_channel: "voice_outbound" | "whatsapp_outbound" | "skip",
    reason: string,
  ) => ({ decided_channel, reason, calls_today: i.calls_today, limit });
  if (i.urgent === true || i.purpose === "sos")
    return result("voice_outbound", "urgent");
  if (isInQuietHours(i.local_time, i.policy))
    return result("skip", "quiet_hours");
  if (i.purpose === "checkin_retry")
    return result(i.requested_channel, "retry_exempt");
  if (i.requested_channel === "voice_outbound" && i.calls_today >= limit)
    return result(i.policy.overLimitFallback, "over_daily_limit");
  return result(i.requested_channel, "allowed");
}
