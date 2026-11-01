export type ContactPolicy = {
  quietHoursStart: string;
  quietHoursEnd: string;
  maxOutboundCallsPerDay: number;
  overLimitFallback: "whatsapp_outbound" | "skip";
  checkinNoAnswerRetries: number;
  checkinRetryIntervalMinutes: number;
};
export const DEFAULT_CONTACT_POLICY: Readonly<ContactPolicy> = Object.freeze({
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
  maxOutboundCallsPerDay: 3,
  overLimitFallback: "whatsapp_outbound",
  checkinNoAnswerRetries: 3,
  checkinRetryIntervalMinutes: 15,
});
export function isInQuietHours(
  localHHMM: string,
  p: Pick<ContactPolicy, "quietHoursStart" | "quietHoursEnd">,
): boolean {
  const { quietHoursStart: start, quietHoursEnd: end } = p;
  if (start === end) return false;
  return start < end
    ? localHHMM >= start && localHHMM < end
    : localHHMM >= start || localHHMM < end;
}
export function effectiveDailyCallLimit(
  policy: ContactPolicy,
  residentOverride?: number | null,
): number {
  return residentOverride == null
    ? policy.maxOutboundCallsPerDay
    : Math.min(residentOverride, policy.maxOutboundCallsPerDay);
}
export function checkinNoAnswerPlan(
  scheduledLocalHHMM: string,
  p: ContactPolicy,
): { retryTimes: string[]; escalateAt: string; graceMinutes: number } {
  const [hours, minutes] = scheduledLocalHHMM.split(":").map(Number);
  const at = (offset: number) => {
    const total = (hours * 60 + minutes + offset) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const graceMinutes = p.checkinNoAnswerRetries * p.checkinRetryIntervalMinutes;
  return {
    retryTimes: Array.from({ length: p.checkinNoAnswerRetries }, (_, i) =>
      at((i + 1) * p.checkinRetryIntervalMinutes),
    ),
    escalateAt: at(graceMinutes),
    graceMinutes,
  };
}

/** Return a single contiguous window containing both quiet windows. */
export function widerQuietHours(
  policy: ContactPolicy,
  start: string,
  end: string,
) {
  const quiet = Array.from({ length: 1440 }, (_, i) => {
    const t =
      String(Math.floor(i / 60)).padStart(2, "0") +
      ":" +
      String(i % 60).padStart(2, "0");
    return (
      isInQuietHours(t, policy) ||
      isInQuietHours(t, { quietHoursStart: start, quietHoursEnd: end })
    );
  });
  // Preserve wider resident windows; disjoint unions cannot be represented by two bounds.
  if (quiet.every(Boolean))
    throw new Error(
      "Quiet windows cover the entire day; choose a single wider quiet window.",
    );
  const transitions = quiet.filter(
    (v, i) => v !== quiet[(i + 1439) % 1440],
  ).length;
  if (transitions !== 2)
    throw new Error(
      "Quiet windows must form one continuous window containing deployment quiet hours.",
    );
  const fmt = (i: number) =>
    String(Math.floor(i / 60)).padStart(2, "0") +
    ":" +
    String(i % 60).padStart(2, "0");
  return {
    quietHoursStart: fmt(
      quiet.findIndex((v, i) => v && !quiet[(i + 1439) % 1440]),
    ),
    quietHoursEnd: fmt(
      quiet.findIndex((v, i) => !v && quiet[(i + 1439) % 1440]),
    ),
  };
}
