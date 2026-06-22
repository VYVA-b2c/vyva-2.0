export const MOTIVATION_MILESTONE_THRESHOLDS = [3, 5, 7, 8, 14, 21, 30] as const;

export type MotivationMilestoneDomain = "daily_checkin" | "brain_coach";
export type MotivationMilestoneMetric = "streak_days";

export type MotivationMilestoneCandidate = {
  id: string;
  domain: MotivationMilestoneDomain;
  metric: MotivationMilestoneMetric;
  threshold: number;
  achieved_value: number;
  title: string;
  body: string;
  button_label: string;
  source_ref: Record<string, unknown>;
};

type CandidateInput = {
  domain: MotivationMilestoneDomain;
  metric?: MotivationMilestoneMetric;
  achievedValue: number;
  sourceRef?: Record<string, unknown>;
};

export function motivationMilestoneId(
  domain: MotivationMilestoneDomain,
  metric: MotivationMilestoneMetric,
  threshold: number,
) {
  return `${domain}:${metric}:${threshold}`;
}

export function parseMotivationMilestoneId(id: string): {
  domain: MotivationMilestoneDomain;
  metric: MotivationMilestoneMetric;
  threshold: number;
} | null {
  const [domain, metric, thresholdText] = id.split(":");
  const threshold = Number(thresholdText);

  if (domain !== "daily_checkin" && domain !== "brain_coach") return null;
  if (metric !== "streak_days") return null;
  if (!MOTIVATION_MILESTONE_THRESHOLDS.includes(threshold as typeof MOTIVATION_MILESTONE_THRESHOLDS[number])) {
    return null;
  }

  return { domain, metric, threshold };
}

function titleFor(domain: MotivationMilestoneDomain, threshold: number) {
  if (domain === "brain_coach") {
    return `You kept Brain Coach going for ${threshold} days.`;
  }
  return `You checked in for ${threshold} days.`;
}

export function buildMotivationMilestoneCandidates({
  domain,
  metric = "streak_days",
  achievedValue,
  sourceRef = {},
}: CandidateInput): MotivationMilestoneCandidate[] {
  const value = Math.max(0, Math.floor(achievedValue));
  return MOTIVATION_MILESTONE_THRESHOLDS
    .filter((threshold) => value >= threshold)
    .map((threshold) => ({
      id: motivationMilestoneId(domain, metric, threshold),
      domain,
      metric,
      threshold,
      achieved_value: value,
      title: titleFor(domain, threshold),
      body: "That consistency matters. Small steps help VYVA understand your rhythm.",
      button_label: "Continue",
      source_ref: {
        ...sourceRef,
        achieved_value: value,
      },
    }));
}

export function prioritizeMotivationMilestones(candidates: MotivationMilestoneCandidate[]) {
  return [...candidates].sort((left, right) => {
    const leftDomainPriority = left.domain === "daily_checkin" ? 0 : 1;
    const rightDomainPriority = right.domain === "daily_checkin" ? 0 : 1;
    if (leftDomainPriority !== rightDomainPriority) return leftDomainPriority - rightDomainPriority;
    if (left.threshold !== right.threshold) return right.threshold - left.threshold;
    return right.achieved_value - left.achieved_value;
  });
}
