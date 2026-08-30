export const BRAIN_COACH_MAX_LEVEL = 20;

export const BRAIN_COACH_LEVEL_BAND_SIZE = 5;

export type BrainCoachLevelBandId = "foundation" | "build" | "challenge" | "mastery";

export type BrainCoachLevelBand = {
  id: BrainCoachLevelBandId;
  label: string;
  minLevel: number;
  maxLevel: number;
  milestoneLabel: string;
  promotionCopy: string;
};

export const BRAIN_COACH_LEVEL_BANDS: BrainCoachLevelBand[] = [
  {
    id: "foundation",
    label: "Foundation",
    minLevel: 1,
    maxLevel: 5,
    milestoneLabel: "Foundation complete",
    promotionCopy: "You are building the base. Keep this level steady and calm.",
  },
  {
    id: "build",
    label: "Build",
    minLevel: 6,
    maxLevel: 10,
    milestoneLabel: "Building confidence",
    promotionCopy: "Good rhythm. The next levels add a little more to hold in mind.",
  },
  {
    id: "challenge",
    label: "Challenge",
    minLevel: 11,
    maxLevel: 15,
    milestoneLabel: "Challenge ready",
    promotionCopy: "You are ready for richer practice with a bit more switching.",
  },
  {
    id: "mastery",
    label: "Mastery",
    minLevel: 16,
    maxLevel: 20,
    milestoneLabel: "Mastery round",
    promotionCopy: "This is the strongest band. Take your time and aim for confidence.",
  },
];

export const BRAIN_COACH_MILESTONE_LEVELS = [5, 10, 15, 20] as const;

export function clampBrainCoachLevel(level: number, fallback = 1) {
  const normalized = Number.isFinite(level) ? Math.round(level) : fallback;
  return Math.min(BRAIN_COACH_MAX_LEVEL, Math.max(1, normalized));
}

export function getBrainCoachLevelBand(level: number): BrainCoachLevelBand {
  const clampedLevel = clampBrainCoachLevel(level);
  return (
    BRAIN_COACH_LEVEL_BANDS.find((band) => clampedLevel >= band.minLevel && clampedLevel <= band.maxLevel)
    ?? BRAIN_COACH_LEVEL_BANDS[0]
  );
}

export function getBrainCoachLevelBandProgress(level: number) {
  const clampedLevel = clampBrainCoachLevel(level);
  const band = getBrainCoachLevelBand(clampedLevel);
  const current = clampedLevel - band.minLevel + 1;

  return {
    current,
    total: BRAIN_COACH_LEVEL_BAND_SIZE,
    percent: Math.round((current / BRAIN_COACH_LEVEL_BAND_SIZE) * 100),
  };
}

export function isBrainCoachMilestoneLevel(level: number) {
  return BRAIN_COACH_MILESTONE_LEVELS.includes(clampBrainCoachLevel(level) as (typeof BRAIN_COACH_MILESTONE_LEVELS)[number]);
}

export function getBrainCoachMilestoneLabel(level: number) {
  const clampedLevel = clampBrainCoachLevel(level);
  if (!isBrainCoachMilestoneLevel(clampedLevel)) return null;
  return getBrainCoachLevelBand(clampedLevel).milestoneLabel;
}

export function getBrainCoachProgressLabel(level: number) {
  const clampedLevel = clampBrainCoachLevel(level);
  return `Level ${clampedLevel} - ${getBrainCoachLevelBand(clampedLevel).label}`;
}

export function getBrainCoachSupportiveProgressCopy({
  advanced,
  level,
}: {
  advanced: boolean;
  level: number;
}) {
  const clampedLevel = clampBrainCoachLevel(level);
  const milestoneLabel = getBrainCoachMilestoneLabel(clampedLevel);

  if (advanced && milestoneLabel) {
    return `${milestoneLabel}. You can move ahead, or stay here and enjoy another strong round.`;
  }

  if (advanced) {
    return getBrainCoachLevelBand(clampedLevel).promotionCopy;
  }

  return "Stay here and strengthen this level. A steady repeat is still progress.";
}

export function getBrainCoachMilestoneJourney(streakDays: number) {
  const normalizedStreak = Math.max(0, Math.round(Number.isFinite(streakDays) ? streakDays : 0));
  const milestones = [
    { count: 1, label: "First session" },
    { count: 3, label: "Three-day rhythm" },
    { count: 7, label: "One-week streak" },
    { count: 14, label: "Two-week confidence" },
    { count: 30, label: "Monthly practice" },
  ];
  const current = [...milestones].reverse().find((milestone) => normalizedStreak >= milestone.count) ?? milestones[0];
  const next = milestones.find((milestone) => normalizedStreak < milestone.count) ?? null;

  return {
    current,
    next,
    streakDays: normalizedStreak,
  };
}
