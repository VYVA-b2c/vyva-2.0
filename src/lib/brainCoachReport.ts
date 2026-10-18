import { areaForDomain, type BrainCoachArea } from "../../shared/brainCoachAreas";

export type BrainCoachSession = {
  id?: string | null;
  activityType: string;
  domain: string;
  secondaryDomain?: string | null;
  difficulty?: number | null;
  difficultyScale?: string | null;
  completed?: boolean | null;
  abandoned?: boolean | null;
  score?: number | null;
  accuracyPct?: number | null;
  speedPct?: number | null;
  durationSeconds?: number | null;
  playedAt?: string | null;
  source?: string | null;
};

export type BrainCoachGroupSummary = {
  totalSessions: number;
  completedSessions: number;
  bestScore: number;
  totalDurationSeconds: number;
  lastPlayedAt: string | null;
};

export type BrainCoachProgress = {
  summary?: {
    totalSessions: number;
    completedSessions: number;
    streakDays: number;
    bestStreakDays: number;
    lastPlayedAt: string | null;
    totalDurationSeconds: number;
  };
  today?: {
    completedCount: number;
    activityTypes: string[];
    domains: string[];
  };
  domains?: Array<BrainCoachGroupSummary & { domain: string }>;
  activities?: Array<BrainCoachGroupSummary & { activityType: string }>;
  history?: BrainCoachSession[];
  performance?: {
    areas: Array<{
      area: BrainCoachArea;
      status: "usual" | "above" | "below" | "building";
      sessionsInWindow: number;
      weekly: Array<{ weekStart: string; value: number | null }>;
    }>;
    relaxationMinutes: number;
    generatedAt: string;
  };
};

export type BrainCoachTranslate = (
  key: string,
  fallback: string,
  values?: Record<string, unknown>,
) => string;

const fallbackTranslate: BrainCoachTranslate = (_key, fallback, values) => fallback.replace(
  /\{\{(\w+)\}\}/g,
  (_match, name) => String(values?.[name] ?? `{{${name}}}`),
);

const domainLabels: Record<string, string> = {
  attention: "Focus",
  executive_function: "Planning",
  language: "Language",
  memory: "Memory",
  sensory: "Senses",
  spatial_navigation: "Spatial skills",
  processing_speed: "Speed",
};

const activityLabels: Record<string, string> = {
  association_memory: "Connections",
  breath_garden: "Breath garden",
  category_sort: "Category sort",
  curious_minds: "Curious minds",
  dual_task_walk: "Dual task walk",
  face_name_match: "Face-name match",
  listen_closely: "Listen closely",
  number_trails: "Number trails",
  remember_later: "Remember later",
  scent_memory: "Scent memory",
  sequence_memory: "Rhythm tap",
  spatial_navigator: "Spatial navigator",
  word_recall: "Word recall",
};

function humanizeKey(value?: string | null) {
  if (!value) return "Brain Coach";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function domainLabel(value?: string | null) {
  const area = areaForDomain(value) ?? value;
  return area ? domainLabels[area] ?? humanizeKey(area) : "Brain Coach";
}

export function activityLabel(value?: string | null) {
  return value ? activityLabels[value] ?? humanizeKey(value) : "Brain Coach activity";
}

export function hasBrainCoachData(progress?: BrainCoachProgress | null) {
  const summary = progress?.summary;
  return Boolean((summary?.completedSessions ?? 0) > 0 || (summary?.totalSessions ?? 0) > 0);
}

export function formatBrainCoachDuration(seconds?: number | null) {
  const safeSeconds = Math.max(0, Math.round(safeNumber(seconds)));
  if (safeSeconds === 0) return "0 min";
  if (safeSeconds < 60) return "<1 min";

  const minutes = Math.max(1, Math.round(safeSeconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function formatBrainCoachDate(iso?: string | null) {
  if (!iso) return "Not yet";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Not yet";
  }
}

export function formatBrainCoachTime(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function strongestBrainCoachDomain(progress?: BrainCoachProgress | null) {
  return [...(progress?.domains ?? [])].sort((a, b) => {
    if (b.completedSessions !== a.completedSessions) return b.completedSessions - a.completedSessions;
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    return (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? "");
  })[0] ?? null;
}

function translatedArea(t: BrainCoachTranslate, value?: string | null) {
  const area = areaForDomain(value) ?? value;
  return t(`reports.brainCoach.areas.${area}`, domainLabel(value));
}

function lowerFirst(value: string) {
  return value ? value.charAt(0).toLocaleLowerCase() + value.slice(1) : value;
}

export function buildBrainCoachNarrative(progress?: BrainCoachProgress | null, t: BrainCoachTranslate = fallbackTranslate) {
  if (!hasBrainCoachData(progress)) {
    return t("reports.brainCoach.narrative.empty", "Play a few short games and VYVA will turn them into a simple progress report.");
  }

  const summary = progress!.summary!;
  const strongest = strongestBrainCoachDomain(progress);
  const streak = summary.streakDays;
  const completed = summary.completedSessions;
  const area = strongest ? translatedArea(t, strongest.domain) : t("reports.brainCoach.narrative.brainTraining", "brain training");
  const higherArea = progress?.performance?.areas.find((item) => item.status === "above");
  if (higherArea) return t("reports.brainCoach.narrative.higher", "Your {{area}} has been higher than your usual level. Keep the routine steady.", { area: lowerFirst(translatedArea(t, higherArea.area)) });

  if (streak >= 3) {
    return t("reports.brainCoach.narrative.streak", "You are on a {{count}}-day streak. Your most practiced area is {{area}}.", { count: streak, area });
  }

  if (completed >= 3) {
    return t("reports.brainCoach.narrative.completed", "You have completed {{count}} games. Keep three steady days in a row to build a stronger routine.", { count: completed });
  }

  return t("reports.brainCoach.narrative.moreSessions", "A few more short sessions will make this report more useful.");
}

export function buildBrainCoachNextSteps(progress?: BrainCoachProgress | null, t: BrainCoachTranslate = fallbackTranslate) {
  if (!hasBrainCoachData(progress)) {
    return [
      t("reports.brainCoach.steps.startMemory", "Start with one short memory game."),
      t("reports.brainCoach.steps.returnTomorrow", "Come back tomorrow so VYVA can spot a pattern."),
      t("reports.brainCoach.steps.keepShort", "Keep sessions short and steady."),
    ];
  }

  const summary = progress!.summary!;
  const domains = progress?.domains ?? [];
  const steps: string[] = [];
  const easierArea = progress?.performance?.areas.find((item) => item.status === "below");
  if (easierArea) steps.push(t("reports.brainCoach.steps.easier", "Try an easier {{area}} game this week.", { area: lowerFirst(translatedArea(t, easierArea.area)) }));

  if ((progress?.today?.completedCount ?? 0) === 0) {
    steps.push(t("reports.brainCoach.steps.playToday", "Do one short Brain Coach game today."));
  } else {
    steps.push(t("reports.brainCoach.steps.practicedToday", "You already practiced today. Keep tomorrow light and steady."));
  }

  if (summary.streakDays < 3) {
    steps.push(t("reports.brainCoach.steps.aimStreak", "Aim for 3 completed days in a row."));
  } else {
    steps.push(t("reports.brainCoach.steps.protectStreak", "Protect the streak with one easy game tomorrow."));
  }

  if (domains.length <= 1) {
    steps.push(t("reports.brainCoach.steps.tryArea", "Try a different area next, like focus or language."));
  } else {
    const leastPracticed = [...domains].sort((a, b) => a.completedSessions - b.completedSessions)[0];
    steps.push(t("reports.brainCoach.steps.leastPracticed", "Give {{area}} a turn next.", { area: translatedArea(t, leastPracticed.domain) }));
  }

  return [...new Set(steps)].slice(0, 3);
}

export function buildBrainCoachShareText(progress?: BrainCoachProgress | null, t: BrainCoachTranslate = fallbackTranslate) {
  const summary = progress?.summary;
  const strongest = strongestBrainCoachDomain(progress);
  const lines = [
    t("reports.brainCoach.share.title", "VYVA Brain Coach report"),
    t("reports.brainCoach.share.completed", "Completed games: {{count}}", { count: summary?.completedSessions ?? 0 }),
    t("reports.brainCoach.share.streak", "Current streak: {{count}} days", { count: summary?.streakDays ?? 0 }),
    t("reports.brainCoach.share.time", "Practice time: {{time}}", { time: formatBrainCoachDuration(summary?.totalDurationSeconds ?? 0) }),
    t("reports.brainCoach.share.lastPlayed", "Last played: {{date}}", { date: formatBrainCoachDate(summary?.lastPlayedAt ?? null) }),
  ];

  if (strongest) {
    lines.push(t("reports.brainCoach.share.mostPracticed", "Most practiced area: {{area}}", { area: translatedArea(t, strongest.domain) }));
  }

  (progress?.performance?.areas ?? []).forEach((item) => lines.push(t("reports.brainCoach.share.areaStatus", "{{area}}: {{status}}", {
    area: translatedArea(t, item.area),
    status: t(`reports.brainCoach.status.${item.status}`, item.status),
  })));

  lines.push(t("reports.brainCoach.share.nextStep", "Next step: {{step}}", { step: buildBrainCoachNextSteps(progress, t)[0] }));
  return lines.join("\n");
}
