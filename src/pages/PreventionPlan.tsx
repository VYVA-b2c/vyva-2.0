import { useQuery } from "@tanstack/react-query";
import {
  Apple,
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock,
  ExternalLink,
  Footprints,
  HeartPulse,
  Mic,
  PlayCircle,
  Share2,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalProfile } from "@/contexts/ProfileContext";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { apiFetch } from "@/lib/queryClient";

export type PreventionPillar = "heart" | "brain" | "strength" | "nourishment" | "calm";
export type PreventionPillarStatus = "thriving" | "steady" | "needs_attention" | "priority_focus";
export type PreventionRecommendation = { action: string; why: string };

export type PreventionPlanData = {
  id: string | null;
  generated_at: string | null;
  pillar_heart: PreventionPillarStatus;
  pillar_brain: PreventionPillarStatus;
  pillar_strength: PreventionPillarStatus;
  pillar_nourishment: PreventionPillarStatus;
  pillar_calm: PreventionPillarStatus;
  priority_pillar: PreventionPillar | null;
  priority_intervention: string | null;
  priority_why: string | null;
  plan_narrative_senior: string | null;
  plan_narrative_caregiver: string | null;
  recommendations: Partial<Record<PreventionPillar, PreventionRecommendation[]>>;
  source_signals: Record<string, boolean>;
  trajectory: "improving" | "stable" | "declining" | "first";
};

type DailyContentType = "exercise" | "meal" | "tip" | "article" | "supplement" | "natural_solution";
type DailyContentItem = {
  id: string;
  content_type: DailyContentType;
  title: string;
  description: string;
  detail_text: string | null;
  timing_guidance?: string | null;
  source_label: string | null;
  source_url: string | null;
  condition_tags: string[];
  pillar_tag: PreventionPillar | null;
  time_of_day: string | null;
  language: string;
};

type DailyContentResponse = {
  exercise: DailyContentItem | null;
  meal: DailyContentItem | null;
  tip: DailyContentItem | null;
  supplement?: DailyContentItem | null;
  naturalSolution?: DailyContentItem | null;
  articles: DailyContentItem[];
  byPillar?: Partial<Record<PreventionPillar, DailyContentItem[]>>;
};

type PillarStatusResponse = {
  statuses: Partial<Record<PreventionPillar, PreventionPillarStatus>>;
  priority_pillar: PreventionPillar | null;
};

type CompanionSignal = {
  id: string;
  label: string;
  detail: string;
  source: "profile" | "medication" | "brain" | "check-in" | "symptom" | "vitals" | "feedback";
  pillar: PreventionPillar | null;
  tone: "steady" | "attention" | "positive";
};

type BrainChallenge = {
  kind: "memory_prompt" | "word_chain" | "riddle" | "chess_puzzle" | "crossword";
  prompt: string;
  hint: string;
  answer: string | null;
  followUp: string;
};

type BrainGameOption = BrainChallenge & {
  id: string;
  label: string;
  title: string;
};

type CompanionAction = {
  action_key: string;
  content_id?: string | null;
  content_type?: DailyContentType | null;
  timing_guidance?: string | null;
  title: string;
  detail: string;
  pillar: PreventionPillar | null;
  route: string | null;
  resource_label?: string | null;
  resource_url?: string | null;
  prompt: string;
  source: "monthly_plan" | "daily_content" | "feedback_memory" | "fallback" | "program";
  challenge?: BrainChallenge | null;
  gameOptions?: BrainGameOption[] | null;
};

type DailyExperienceKind = "video" | "brain_game" | "movement" | "walking_route" | "food" | "calm" | "support";

type PrimaryExperience = {
  kind: DailyExperienceKind;
  title: string;
  detail: string;
  pillar: PreventionPillar | null;
  ctaLabel: string;
  action: CompanionAction;
  video: TodayVideo | null;
};

type CoveredPillar = {
  pillar: PreventionPillar;
  label: string;
  status: PreventionPillarStatus;
  actionTitle: string;
  reason: string;
  evidence: string;
};

type DailySession = {
  sessionFocus: string;
  primaryExperience: PrimaryExperience;
  companionAction: CompanionAction;
  optionalChoices: CompanionAction[];
  coveredPillars: CoveredPillar[];
  whyThis: {
    summary: string;
    evidence: string[];
  };
};

type VideoCurationStatus = "ready" | "pending" | "fallback" | "failed";

type ActiveProgram = {
  id: string;
  programKey: string;
  title: string;
  status: "active" | "paused" | "completed";
  focusPillars: PreventionPillar[];
  startDate: string;
  currentDay: number;
  totalDays: number;
  language: string;
  cadence: string;
};

type ProgramStep = {
  id: string;
  programId: string;
  dayIndex: number;
  pillar: PreventionPillar;
  theme: string;
  objective: string;
  actionTitle: string;
  actionDetail: string;
  videoQuery: string;
  scheduledDate: string;
  status: "scheduled" | "shown" | "completed" | "skipped";
};

type TodayVideo = {
  id: string;
  provider: "youtube";
  videoId: string;
  url: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  language: string;
  summary: string | null;
  selectedReason: string;
  safetyNotes: string;
};

type FeedbackEventType = "done" | "too_hard" | "not_relevant" | "opened";

type CompanionPayload = {
  plan: PreventionPlanData;
  activeProgram: ActiveProgram | null;
  todayProgramStep: ProgramStep | null;
  todayVideo: TodayVideo | null;
  videoCurationStatus: VideoCurationStatus;
  todayFocus: {
    pillar: PreventionPillar | null;
    label: string;
    headline: string;
    summary: string;
  };
  whyToday: string;
  dailySession?: DailySession | null;
  primaryAction: CompanionAction;
  supportAction: CompanionAction;
  pillarActions?: Partial<Record<PreventionPillar, CompanionAction>>;
  careSummary: {
    title: string;
    bullets: string[];
    share_text: string;
  };
  signalsUsed: CompanionSignal[];
  dailyContent: DailyContentResponse;
  feedbackHistory: Array<{
    action_key: string;
    action_title: string;
    event_type: "shown" | "opened" | "done" | "too_hard" | "not_relevant";
    created_at: string;
  }>;
};

type PreventionPlanProps = {
  previewPlan?: PreventionPlanData;
  firstNameOverride?: string;
  backPath?: string;
  themeOverride?: "light" | "dark";
};

type PillarDefinition = {
  id: PreventionPillar;
  icon: LucideIcon;
  accent: VyvaIconAccent;
  label: string;
  shortLabel: string;
};

const PILLARS: PillarDefinition[] = [
  { id: "heart", icon: HeartPulse, accent: "pulse", label: "Heart & circulation", shortLabel: "Heart" },
  { id: "brain", icon: Brain, accent: "bridge", label: "Brain & memory", shortLabel: "Brain" },
  { id: "strength", icon: Footprints, accent: "step", label: "Strength & stability", shortLabel: "Strength" },
  { id: "nourishment", icon: Apple, accent: "check", label: "Nourishment", shortLabel: "Nourishment" },
  { id: "calm", icon: Waves, accent: "spark", label: "Calm & recovery", shortLabel: "Calm" },
];

const STATUS: Record<PreventionPillarStatus, { label: string; tone: "success" | "steady" | "warning" }> = {
  thriving: { label: "Thriving", tone: "success" },
  steady: { label: "Steady", tone: "steady" },
  needs_attention: { label: "Needs attention", tone: "warning" },
  priority_focus: { label: "This month", tone: "warning" },
};

const DAILY_CONTENT_LABELS: Record<DailyContentType, string> = {
  exercise: "Move",
  meal: "Eat",
  tip: "Tip",
  article: "Read",
};

const DAILY_CONTENT_ICONS: Record<DailyContentType, LucideIcon> = {
  exercise: Footprints,
  meal: Apple,
  tip: Sparkles,
  article: Clipboard,
};

const PRIORITY_STATUS_RANK: Record<PreventionPillarStatus, number> = {
  priority_focus: 4,
  needs_attention: 3,
  steady: 2,
  thriving: 1,
};

const RESOURCE_URLS = {
  communityWalking: "/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning",
  niaBrain: "https://www.nia.nih.gov/health/brain-health/cognitive-health-and-older-adults",
  niaActivities: "https://www.nia.nih.gov/health/healthy-aging/participating-activities-you-enjoy-you-age",
  niaExerciseVideos: "https://www.nia.nih.gov/toolkits/exercise",
  niaFallHome: "https://www.nia.nih.gov/health/falls-and-falls-prevention/preventing-falls-home-room-room",
  niaFood: "https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-eating-you-age-know-your-food-groups",
  niaMealPlanning: "https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-meal-planning-tips-older-adults",
  niaSleep: "https://www.nia.nih.gov/health/sleep/sleep-and-older-adults",
  nihRelaxation: "https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know",
};

const PREVIEW_DAILY_CONTENT: DailyContentResponse = {
  exercise: {
    id: "preview-exercise",
    content_type: "exercise",
    title: "Tai chi",
    description: "A slow balance-friendly VYVA exercise for light movement, posture, and rhythm.",
    detail_text: null,
    source_label: "VYVA movement library",
    source_url: "/social-rooms/morning-movement/exercises/tai-chi",
    condition_tags: ["heart", "balance"],
    pillar_tag: "heart",
    time_of_day: "afternoon",
    language: "en",
  },
  meal: {
    id: "preview-meal",
    content_type: "meal",
    title: "Protein at breakfast",
    description: "A simple egg, yogurt, or beans helps energy and strength hold steadier.",
    detail_text: null,
    source_label: "NIA food guide",
    source_url: RESOURCE_URLS.niaFood,
    condition_tags: ["all"],
    pillar_tag: "nourishment",
    time_of_day: "morning",
    language: "en",
  },
  tip: {
    id: "preview-tip",
    content_type: "tip",
    title: "Same bedtime tonight",
    description: "A regular sleep time supports memory, mood, and blood sugar patterns.",
    detail_text: null,
    source_label: "NIA sleep guide",
    source_url: RESOURCE_URLS.niaSleep,
    condition_tags: ["all"],
    pillar_tag: "calm",
    time_of_day: "evening",
    language: "en",
  },
  articles: [
    {
      id: "preview-article",
      content_type: "article",
      title: "Guided movement supports heart routines",
      description: "A short, practical resource connected to your current movement focus.",
      detail_text: null,
      source_label: "Visual guide",
      source_url: RESOURCE_URLS.niaExerciseVideos,
      condition_tags: ["strength"],
      pillar_tag: "strength",
      time_of_day: "any",
      language: "en",
    },
  ],
  byPillar: {
    heart: [{
      id: "preview-heart",
      content_type: "exercise",
      title: "Tai chi",
      description: "A slow balance-friendly VYVA exercise for light movement, posture, and rhythm.",
      detail_text: null,
      source_label: "VYVA movement library",
      source_url: "/social-rooms/morning-movement/exercises/tai-chi",
      condition_tags: ["heart", "balance"],
      pillar_tag: "heart",
      time_of_day: "afternoon",
      language: "en",
    }],
    brain: [{
      id: "preview-brain",
      content_type: "tip",
      title: "Word recall challenge",
      description: "Study a few words, hide them, then see what you remember.",
      detail_text: null,
      source_label: "Brain Coach",
      source_url: "/mind",
      condition_tags: ["brain"],
      pillar_tag: "brain",
      time_of_day: "any",
      language: "en",
    }],
    strength: [{
      id: "preview-strength",
      content_type: "tip",
      title: "Clear one walking path",
      description: "One clear route at home makes movement easier and steadier.",
      detail_text: null,
      source_label: "NIA fall guide",
      source_url: RESOURCE_URLS.niaFallHome,
      condition_tags: ["falls"],
      pillar_tag: "strength",
      time_of_day: "evening",
      language: "en",
    }],
    nourishment: [{
      id: "preview-nourishment",
      content_type: "meal",
      title: "Protein with the next meal",
      description: "Choose one familiar protein food so nourishment does not become complicated.",
      detail_text: null,
      source_label: "NIA food guide",
      source_url: RESOURCE_URLS.niaFood,
      condition_tags: ["all"],
      pillar_tag: "nourishment",
      time_of_day: "any",
      language: "en",
    }],
    calm: [{
      id: "preview-calm",
      content_type: "tip",
      title: "Same bedtime tonight",
      description: "A familiar evening time supports tomorrow's energy and attention.",
      detail_text: null,
      source_label: "NIA sleep guide",
      source_url: RESOURCE_URLS.niaSleep,
      condition_tags: ["calm"],
      pillar_tag: "calm",
      time_of_day: "evening",
      language: "en",
    }],
  },
};

const PREVIEW_ACTIVE_PROGRAM: ActiveProgram = {
  id: "preview-longevity-program",
  programKey: "starter_video_longevity_v1",
  title: "14-day VYVA longevity starter",
  status: "active",
  focusPillars: ["brain", "heart", "strength", "nourishment", "calm"],
  startDate: "2026-08-01",
  currentDay: 1,
  totalDays: 14,
  language: "en",
  cadence: "daily",
};

const PREVIEW_PROGRAM_STEP: ProgramStep = {
  id: "preview-longevity-program-day-1",
  programId: PREVIEW_ACTIVE_PROGRAM.id,
  dayIndex: 1,
  pillar: "brain",
  theme: "Memory starter",
  objective: "Watch one short visual guide, then keep memory practice familiar.",
  actionTitle: "3-2-1 memory lane",
  actionDetail: "Pick a real place. Name 3 things you see there, 2 sounds, and 1 person connected to it.",
  videoQuery: "MIND diet brain health short Mayo Clinic video",
  scheduledDate: "2026-08-01",
  status: "scheduled",
};

const PREVIEW_TODAY_VIDEO: TodayVideo = {
  id: "preview-longevity-video",
  provider: "youtube",
  videoId: "hoPg4bkKemQ",
  url: "https://www.youtube.com/watch?v=hoPg4bkKemQ",
  title: "Mayo Clinic Minute: Can the MIND diet improve brain health?",
  channel: "Mayo Clinic",
  durationSeconds: 70,
  thumbnailUrl: "https://i.ytimg.com/vi/hoPg4bkKemQ/hqdefault.jpg",
  language: "en",
  summary: "A short visual guide connecting food choices with brain health.",
  selectedReason: "It is short, calm, and directly connected to today's memory-support program step.",
  safetyNotes: "General wellness education only.",
};

function upperFirst(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function lowerFirst(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function msUntilLocalMidnight(): number {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  return Math.max(1000, tomorrow.getTime() - Date.now());
}

function emptyDailyContentResponse(): DailyContentResponse {
  return {
    exercise: null,
    meal: null,
    tip: null,
    articles: [],
    byPillar: {},
  };
}

function isPillarStatus(value: unknown): value is PreventionPillarStatus {
  return typeof value === "string" && value in STATUS;
}

function isPillar(value: unknown): value is PreventionPillar {
  return typeof value === "string" && PILLARS.some((pillar) => pillar.id === value);
}

function normalizeDailyContentResponse(value: unknown): DailyContentResponse {
  if (!value || typeof value !== "object") return emptyDailyContentResponse();
  const data = value as Partial<DailyContentResponse>;
  return {
    exercise: data.exercise ?? null,
    meal: data.meal ?? null,
    tip: data.tip ?? null,
    articles: Array.isArray(data.articles) ? data.articles : [],
    byPillar: data.byPillar ?? {},
  };
}

function normalizePillarStatusResponse(value: unknown): PillarStatusResponse {
  const statuses: Partial<Record<PreventionPillar, PreventionPillarStatus>> = {};
  const data = value && typeof value === "object"
    ? value as { statuses?: Record<string, unknown>; priority_pillar?: unknown }
    : {};

  for (const pillar of PILLARS) {
    const status = data.statuses?.[pillar.id];
    if (isPillarStatus(status)) statuses[pillar.id] = status;
  }

  return {
    statuses,
    priority_pillar: isPillar(data.priority_pillar) ? data.priority_pillar : null,
  };
}

function uniqueDailyContentItems(items: DailyContentItem[]): DailyContentItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id || `${item.content_type}:${item.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasVisualResource(content: DailyContentItem): boolean {
  return Boolean(content.source_url?.match(/(?:youtube\.com|youtu\.be|vimeo\.com)/i));
}

function contentResourceLabel(content: DailyContentItem): string {
  if (hasVisualResource(content)) return "Visual guide";
  if (content.source_url) return content.source_label || "Useful link";
  return DAILY_CONTENT_LABELS[content.content_type];
}

function isInternalResourceUrl(url: string): boolean {
  return url.startsWith("/");
}

function defaultResourceForPillar(pillar: PreventionPillar | null): { label: string; url: string } | null {
  if (pillar === "heart") return { label: "Nearby walking ideas", url: RESOURCE_URLS.communityWalking };
  if (pillar === "brain") return { label: "Brain Coach", url: "/mind" };
  if (pillar === "strength") return { label: "NIA exercise videos", url: RESOURCE_URLS.niaExerciseVideos };
  if (pillar === "nourishment") return { label: "NIA food guide", url: RESOURCE_URLS.niaFood };
  if (pillar === "calm") return { label: "NIA sleep guide", url: RESOURCE_URLS.niaSleep };
  return null;
}

function actionDestination(action: CompanionAction): { label: string; url: string } | null {
  if (action.resource_url) {
    return {
      label: action.resource_label || (action.resource_url.match(/(?:youtube\.com|youtu\.be|vimeo\.com)/i) ? "Visual guide" : "Useful link"),
      url: action.resource_url,
    };
  }
  if (action.route) {
    return { label: action.pillar === "brain" ? "Brain Coach" : "Open step", url: action.route };
  }
  return defaultResourceForPillar(action.pillar);
}

function actionResourceLabel(action: CompanionAction): string | null {
  return actionDestination(action)?.label ?? null;
}

function withoutMonthlySuffix(value: string): string {
  return value.trim().replace(/\s+this month[.!]?$/i, "").replace(/[.!?]+$/, "");
}

function actionKeyFor(pillar: PreventionPillar | null, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
  return `${pillar ?? "general"}:${slug || "action"}`;
}

function personalisedHeadline(firstName: string, intervention: string | null, priorityLabel: string | null): string {
  const action = intervention
    ? withoutMonthlySuffix(intervention)
    : priorityLabel
      ? "Focus on " + priorityLabel.toLowerCase()
      : "Begin with one practical step";
  return firstName ? firstName + ", " + lowerFirst(action) : upperFirst(action);
}

function personalisedNarrative(narrative: string | null, firstName: string): string | null {
  if (!narrative || !firstName) return narrative;
  return narrative.replace(/^[^,]+(?=,\s*this month\b)/i, firstName);
}

function pillarStatus(
  plan: PreventionPlanData,
  pillarId: PreventionPillar,
  liveStatuses?: Partial<Record<PreventionPillar, PreventionPillarStatus>>,
): PreventionPillarStatus {
  if (liveStatuses?.[pillarId]) return liveStatuses[pillarId];
  const key = ("pillar_" + pillarId) as keyof PreventionPlanData;
  return plan[key] as PreventionPillarStatus;
}

function resolvePriorityDefinition(
  plan: PreventionPlanData,
  livePriority?: PreventionPillar | null,
  liveStatuses?: Partial<Record<PreventionPillar, PreventionPillarStatus>>,
): PillarDefinition | null {
  const priority = livePriority ?? plan.priority_pillar;
  const apiPriority = priority
    ? PILLARS.find((pillar) => pillar.id === priority) ?? null
    : null;
  if (apiPriority) return apiPriority;
  return [...PILLARS].sort((a, b) => PRIORITY_STATUS_RANK[pillarStatus(plan, b.id, liveStatuses)] - PRIORITY_STATUS_RANK[pillarStatus(plan, a.id, liveStatuses)])[0] ?? null;
}

function buildPreviewCompanion(plan: PreventionPlanData, firstName: string): CompanionPayload {
  const priorityDefinition = resolvePriorityDefinition(plan);
  const priorityPillar = priorityDefinition?.id ?? "brain";
  const whyToday = plan.priority_why
    ? `${priorityDefinition?.label ?? "Longevity"} comes first today because ${plan.priority_why.toLowerCase()}`
    : "VYVA is starting with one practical step while it learns from your routine.";
  const actionFromContent = (pillar: PreventionPillar, content: DailyContentItem): CompanionAction => ({
    action_key: actionKeyFor(pillar, content.title),
    content_id: content.id,
    content_type: content.content_type,
    timing_guidance: content.timing_guidance ?? null,
    title: content.title,
    detail: content.description,
    pillar,
    route: content.source_url?.startsWith("/") ? content.source_url : routeForPillarAction(pillar, content.title),
    resource_label: content.source_label,
    resource_url: content.source_url,
    prompt: `Help me with today's ${pillar} step: ${content.title}.`,
    source: "daily_content",
  });
  const pillarActions = Object.fromEntries(PILLARS.map((pillar) => {
    const content = PREVIEW_DAILY_CONTENT.byPillar?.[pillar.id]?.[0];
    const fallbackTitle = plan.recommendations[pillar.id]?.[0]?.action ?? `Choose one ${pillar.shortLabel.toLowerCase()} step`;
    const fallbackDetail = plan.recommendations[pillar.id]?.[0]?.why ?? "One small step is enough today.";
    return [pillar.id, content
      ? actionFromContent(pillar.id, content)
      : {
        action_key: actionKeyFor(pillar.id, fallbackTitle),
        title: fallbackTitle,
        detail: fallbackDetail,
        pillar: pillar.id,
        route: null,
        resource_label: defaultResourceForPillar(pillar.id)?.label ?? null,
        resource_url: defaultResourceForPillar(pillar.id)?.url ?? null,
        prompt: `Help me with today's ${pillar.label} step: ${fallbackTitle}.`,
        source: "fallback" as const,
      }];
  })) as Record<PreventionPillar, CompanionAction>;
  const previewGameOptions: BrainGameOption[] = [
    {
      id: "memory_lane",
      label: "Memory",
      title: "3-2-1 memory lane",
      kind: "memory_prompt",
      prompt: PREVIEW_PROGRAM_STEP.actionDetail,
      hint: "Use a place you know well, such as your kitchen, a favorite street, or a holiday spot.",
      answer: null,
      followUp: "This uses personal memory and storytelling, not a score.",
    },
    {
      id: "word_chain",
      label: "Words",
      title: "Word chain",
      kind: "word_chain",
      prompt: "Start with garden. Say five connected words without stopping.",
      hint: "Try: garden, flower, colour, painting, gallery. Your chain can be different.",
      answer: null,
      followUp: "Word chains train flexible thinking without needing a long session.",
    },
    {
      id: "riddle",
      label: "Riddle",
      title: "Quick riddle",
      kind: "riddle",
      prompt: "I hold stories without a shelf and open when someone asks the right question. What am I?",
      hint: "It is something your brain uses every day.",
      answer: "memory",
      followUp: "A tiny riddle gives the day a clear start and finish.",
    },
    {
      id: "chess_scan",
      label: "Chess",
      title: "Chess scan",
      kind: "chess_puzzle",
      prompt: "Before a move, name one piece that is protected and one piece that is open.",
      hint: "A protected piece has another piece that could respond if it is taken.",
      answer: null,
      followUp: "This is a gentle planning puzzle, not a timed match.",
    },
  ];
  const primaryAction: CompanionAction = {
    action_key: `program:${PREVIEW_ACTIVE_PROGRAM.id}:${PREVIEW_PROGRAM_STEP.dayIndex}:${actionKeyFor(PREVIEW_PROGRAM_STEP.pillar, PREVIEW_PROGRAM_STEP.actionTitle)}`,
    content_id: PREVIEW_PROGRAM_STEP.id,
    title: PREVIEW_PROGRAM_STEP.actionTitle,
    detail: "This uses personal memory and storytelling, not a score.",
    pillar: PREVIEW_PROGRAM_STEP.pillar,
    route: null,
    prompt: `Help me with today's Longevity program step: ${PREVIEW_PROGRAM_STEP.actionTitle}. Video: ${PREVIEW_TODAY_VIDEO.title}.`,
    source: "program",
    challenge: {
      kind: "memory_prompt",
      prompt: PREVIEW_PROGRAM_STEP.actionDetail,
      hint: "Use a place you know well, such as your kitchen, a favorite street, or a holiday spot.",
      answer: null,
      followUp: "This uses personal memory and storytelling, not a score.",
    },
    gameOptions: previewGameOptions,
  };
  const supportAction = pillarActions.heart;
  const signalsUsed: CompanionSignal[] = [
    {
      id: "preview-brain",
      label: "Brain Coach",
      detail: "No recent Brain Coach sessions are logged in this preview.",
      source: "brain",
      pillar: "brain",
      tone: "attention",
    },
    {
      id: "preview-checkins",
      label: "Check-ins",
      detail: "Recent check-ins are available for context.",
      source: "check-in",
      pillar: "calm",
      tone: "steady",
    },
  ];
  const dailySession: DailySession = {
    sessionFocus: firstName ? `${firstName}, keep memory active with one short challenge today.` : "Keep memory active with one short challenge today.",
    primaryExperience: {
      kind: "video",
      title: PREVIEW_TODAY_VIDEO.title,
      detail: PREVIEW_TODAY_VIDEO.selectedReason,
      pillar: PREVIEW_PROGRAM_STEP.pillar,
      ctaLabel: "Watch",
      action: primaryAction,
      video: PREVIEW_TODAY_VIDEO,
    },
    companionAction: primaryAction,
    optionalChoices: [pillarActions.heart, pillarActions.calm],
    coveredPillars: coveredPillarsFromActions(plan, pillarActions).map((pillar) => ({
      ...pillar,
      evidence: pillar.pillar === "brain"
        ? signalsUsed[0].detail
        : pillar.evidence,
    })),
    whyThis: {
      summary: whyToday,
      evidence: [
        `Program day ${PREVIEW_PROGRAM_STEP.dayIndex}: ${PREVIEW_PROGRAM_STEP.theme}.`,
        `Curated video: ${PREVIEW_TODAY_VIDEO.title}.`,
        `Brain Coach: ${signalsUsed[0].detail}`,
      ],
    },
  };

  return {
    plan,
    activeProgram: PREVIEW_ACTIVE_PROGRAM,
    todayProgramStep: PREVIEW_PROGRAM_STEP,
    todayVideo: PREVIEW_TODAY_VIDEO,
    videoCurationStatus: "fallback",
    todayFocus: {
      pillar: priorityPillar,
      label: priorityDefinition?.label ?? "Longevity",
      headline: firstName ? `${firstName}, today's memory starter` : "Today's memory starter",
      summary: PREVIEW_PROGRAM_STEP.objective,
    },
    whyToday,
    dailySession,
    primaryAction,
    supportAction,
    pillarActions,
    careSummary: {
      title: `Longevity summary for ${firstName || "this user"}`,
      bullets: [
        `Program day ${PREVIEW_PROGRAM_STEP.dayIndex}: ${PREVIEW_PROGRAM_STEP.theme}.`,
        `Video: ${PREVIEW_TODAY_VIDEO.title}.`,
        `Companion step: ${primaryAction.title}.`,
        `Health areas considered: ${PILLARS.map((pillar) => pillar.label).join("; ")}.`,
        signalsUsed[0].detail,
      ],
      share_text: [
        `Longevity summary for ${firstName || "this user"}`,
        `- Program day ${PREVIEW_PROGRAM_STEP.dayIndex}: ${PREVIEW_PROGRAM_STEP.theme}.`,
        `- Video: ${PREVIEW_TODAY_VIDEO.title}.`,
        `- Companion step: ${primaryAction.title}.`,
        `- Health areas considered: ${PILLARS.map((pillar) => pillar.label).join("; ")}.`,
      ].join("\n"),
    },
    signalsUsed,
    dailyContent: PREVIEW_DAILY_CONTENT,
    feedbackHistory: [],
  };
}

function usePreventionCompanion(userId: string) {
  return useQuery<CompanionPayload>({
    queryKey: ["prevention-companion", userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const response = await apiFetch("/api/prevention/companion/" + encodeURIComponent(userId));
      if (!response.ok) throw new Error("Could not load the longevity companion plan");
      return response.json();
    },
  });
}

function useDailyContent(userId: string) {
  return useQuery<DailyContentResponse>({
    queryKey: ["prevention-daily-content", userId],
    enabled: Boolean(userId),
    staleTime: msUntilLocalMidnight(),
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const response = await apiFetch("/api/prevention/daily-content/" + encodeURIComponent(userId));
      if (!response.ok) throw new Error("Could not load daily longevity content");
      return normalizeDailyContentResponse(await response.json());
    },
  });
}

function usePillarStatus(userId: string) {
  return useQuery<PillarStatusResponse>({
    queryKey: ["prevention-pillar-status", userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const response = await apiFetch("/api/prevention/pillar-status/" + encodeURIComponent(userId));
      if (!response.ok) throw new Error("Could not load live longevity status");
      return normalizePillarStatusResponse(await response.json());
    },
  });
}

function statusClass(tone: "success" | "steady" | "warning", isDark: boolean): string {
  if (tone === "success") return isDark ? "bg-[#123D31] text-[#72E1B3]" : "bg-[#E4F7EF] text-[#0A7653]";
  if (tone === "warning") return isDark ? "bg-[#4A3618] text-[#FFC65A]" : "bg-[#FFF0D2] text-[#9A5A00]";
  return isDark ? "bg-white/[0.08] text-[#D9CFE3]" : "bg-[#F2EDF4] text-[#6E6175]";
}

function movementExerciseRouteForTitle(title: string): string | null {
  const text = title.toLowerCase();
  const movementRoutes: Array<[string[], string]> = [
    [["chair yoga"], "/social-rooms/morning-movement/exercises/chair-yoga"],
    [["tai chi", "tai-chi"], "/social-rooms/morning-movement/exercises/tai-chi"],
    [["seated strength", "chair strength", "chair exercises"], "/social-rooms/morning-movement/exercises/seated-strength"],
    [["calm breathing"], "/social-rooms/morning-movement/exercises/calm-breathing"],
    [["sit-to-stand", "sit to stand"], "/social-rooms/morning-movement/exercises/sit-to-stand"],
    [["heel raises"], "/social-rooms/morning-movement/exercises/heel-raises"],
    [["wall push-ups", "wall pushups"], "/social-rooms/morning-movement/exercises/wall-push-ups"],
    [["ankle mobility"], "/social-rooms/morning-movement/exercises/ankle-mobility"],
    [["chest opener"], "/social-rooms/morning-movement/exercises/chest-opener"],
    [["side steps"], "/social-rooms/morning-movement/exercises/side-steps"],
    [["hand breathing"], "/social-rooms/morning-movement/exercises/hand-breathing"],
    [["shoulder release"], "/social-rooms/morning-movement/exercises/shoulder-release"],
  ];
  return movementRoutes.find(([matches]) => matches.some((match) => text.includes(match)))?.[1] ?? null;
}

function routeForPillarAction(pillar: PreventionPillar, title: string): string | null {
  const text = title.toLowerCase();
  const movementRoute = movementExerciseRouteForTitle(title);
  if (movementRoute) return movementRoute;
  if (text.includes("walking path") || text.includes("clear route") || text.includes("remove obstacles")) {
    return "/social-rooms/walking-route?source=longevity&intent=clear-walking-path";
  }
  if (pillar === "brain") {
    if (text.includes("word")) return "/memory-games/word_recall";
    if (text.includes("challenge") || text.includes("game") || text.includes("memory")) return "/memory-games";
    return "/mind";
  }
  if (text.includes("brain coach")) return "/mind";
  if (pillar === "calm" || text.includes("breath")) return "/games/breath-garden";
  if (pillar === "heart" && (text.includes("nearby") || text.includes("outing") || text.includes("activity") || text.includes("social"))) return RESOURCE_URLS.communityWalking;
  if (pillar === "heart" && (text.includes("movement") || text.includes("exercise") || text.includes("walk"))) return "/social-rooms/morning-movement/exercises/tai-chi";
  if (pillar === "strength" || text.includes("walk") || text.includes("chair")) return "/health/exercises/gentle-walk";
  if (text.includes("medicine") || text.includes("medication")) return "/health/medications";
  return null;
}

function previewRouteForAction(action: CompanionAction, fallbackUrl = ""): string | null {
  const route = action.route ?? fallbackUrl;
  const resourceUrl = action.resource_url ?? fallbackUrl;
  if (route.startsWith("/social-rooms/activities") || resourceUrl.startsWith("/social-rooms/activities")) return "/dev/home-master/community";
  if (route === "/mind" || action.pillar === "brain") return "/dev/home-master/brain";
  if (route === "/games/breath-garden" || action.pillar === "calm") return "/dev/breath-garden";
  if (route === "/health/medications") return "/dev/home-master/medicines";
  return null;
}

function fallbackActionForPillar(plan: PreventionPlanData, pillar: PreventionPillar): CompanionAction {
  const recommendation = plan.recommendations[pillar]?.[0];
  const pillarLabel = PILLARS.find((item) => item.id === pillar)?.shortLabel.toLowerCase() ?? "wellbeing";
  const title = recommendation?.action ?? `Choose one ${pillarLabel} step`;
  const detail = recommendation?.why ?? "One small step is enough today.";
  const resource = defaultResourceForPillar(pillar);
  return {
    action_key: actionKeyFor(pillar, title),
    title,
    detail,
    pillar,
    route: routeForPillarAction(pillar, title),
    resource_label: resource?.label ?? null,
    resource_url: resource?.url ?? null,
    prompt: `Help me with today's longevity step: ${title}.`,
    source: "fallback",
  };
}

function resolvePillarActions(companion: CompanionPayload, plan: PreventionPlanData): Record<PreventionPillar, CompanionAction> {
  return Object.fromEntries(PILLARS.map((pillar) => [
    pillar.id,
    companion.pillarActions?.[pillar.id]
      ?? (companion.primaryAction.pillar === pillar.id ? companion.primaryAction : null)
      ?? (companion.supportAction.pillar === pillar.id ? companion.supportAction : null)
      ?? fallbackActionForPillar(plan, pillar.id),
  ])) as Record<PreventionPillar, CompanionAction>;
}

function actionCategory(action: CompanionAction): DailyExperienceKind | "connection" {
  const text = `${action.title} ${action.detail} ${action.route ?? ""}`.toLowerCase();
  if (text.includes("youtube.com/watch") || text.includes("youtu.be/")) return "video";
  if (text.includes("memory-games") || text.includes("riddle") || text.includes("chess") || text.includes("word recall") || text.includes("memory lane") || text.includes("memory challenge") || (action.pillar === "brain" && text.includes("memory"))) return "brain_game";
  if (text.includes("morning-movement") || text.includes("tai chi") || text.includes("chair yoga") || text.includes("seated strength") || text.includes("chest opener") || text.includes("ankle mobility") || text.includes("side steps")) return "movement";
  if (text.includes("walking-route") || text.includes("walking path") || text.includes("clear route") || text.includes("remove obstacles")) return "walking_route";
  if (text.includes("protein") || text.includes("meal") || text.includes("food") || text.includes("water") || action.pillar === "nourishment") return "food";
  if (text.includes("breath") || text.includes("calm") || text.includes("wind-down") || action.pillar === "calm") return "calm";
  if (text.includes("call someone") || text.includes("social") || text.includes("conversation")) return "connection";
  return "support";
}

function isNearDuplicateAction(a: CompanionAction, b: CompanionAction): boolean {
  if (a.action_key === b.action_key) return true;
  if (a.title.trim().toLowerCase() === b.title.trim().toLowerCase()) return true;
  const aCategory = actionCategory(a);
  const bCategory = actionCategory(b);
  return aCategory !== "support" && aCategory === bCategory;
}

function ctaLabelForExperience(kind: DailyExperienceKind): string {
  if (kind === "video") return "Watch";
  if (kind === "brain_game") return "Play";
  if (kind === "movement") return "Start exercise";
  if (kind === "walking_route") return "Plan route";
  if (kind === "food") return "Make it easy";
  if (kind === "calm") return "Start reset";
  return "Start";
}

function dailyContentTypeLabel(type?: DailyContentType | null): string | null {
  if (!type) return null;
  const labels: Record<DailyContentType, string> = {
    exercise: "Exercise",
    meal: "Food",
    tip: "Tip",
    article: "Read",
    supplement: "Supplement",
    natural_solution: "Natural support",
  };
  return labels[type];
}

function timingMetaLabel(action: CompanionAction): string | null {
  if (!action.timing_guidance) return null;
  return [dailyContentTypeLabel(action.content_type), action.timing_guidance].filter(Boolean).join(" · ");
}

function experienceKindForAction(action: CompanionAction, video: TodayVideo | null): DailyExperienceKind {
  if (video) return "video";
  const category = actionCategory(action);
  return category === "connection" ? "support" : category;
}

function coveredPillarsFromActions(plan: PreventionPlanData, pillarActions: Record<PreventionPillar, CompanionAction>): CoveredPillar[] {
  return PILLARS.map((pillar) => ({
    pillar: pillar.id,
    label: pillar.label,
    status: pillarStatus(plan, pillar.id),
    actionTitle: pillarActions[pillar.id].title,
    reason: pillarActions[pillar.id].detail,
    evidence: `${pillar.label} is part of this monthly plan.`,
  }));
}

function fallbackDailySession(
  companion: CompanionPayload,
  plan: PreventionPlanData,
  firstName: string,
  pillarActions: Record<PreventionPillar, CompanionAction>,
): DailySession {
  const video = exactYoutubeUrl(companion.todayVideo?.url) ? companion.todayVideo : null;
  const primaryAction = companion.primaryAction ?? fallbackActionForPillar(plan, companion.todayFocus.pillar ?? "brain");
  const kind = experienceKindForAction(primaryAction, video);
  const optionalChoices = Object.values(pillarActions)
    .filter((action) => !isNearDuplicateAction(action, primaryAction))
    .slice(0, 2);
  return {
    sessionFocus: companion.todayFocus.headline || personalisedHeadline(firstName, plan.priority_intervention, companion.todayFocus.label),
    primaryExperience: {
      kind,
      title: video?.title ?? primaryAction.title,
      detail: video?.selectedReason ?? primaryAction.detail,
      pillar: primaryAction.pillar,
      ctaLabel: ctaLabelForExperience(kind),
      action: primaryAction,
      video,
    },
    companionAction: video ? primaryAction : companion.supportAction ?? optionalChoices[0] ?? primaryAction,
    optionalChoices,
    coveredPillars: coveredPillarsFromActions(plan, pillarActions),
    whyThis: {
      summary: companion.whyToday,
      evidence: companion.signalsUsed.slice(0, 4).map((signal) => `${signal.label}: ${signal.detail}`),
    },
  };
}

function briefText(value: string | null | undefined, maxChars = 96): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentenceEnd = clean.search(/[.!?](\s|$)/);
  const firstSentence = sentenceEnd >= 0 ? clean.slice(0, sentenceEnd + 1) : clean;
  if (firstSentence.length <= maxChars) return firstSentence;
  return firstSentence.slice(0, Math.max(0, maxChars - 3)).trimEnd().replace(/[.,;:]+$/, "") + "...";
}

function exactYoutubeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if ((host === "youtube.com" || host === "m.youtube.com") && url.pathname === "/watch") {
      const videoId = url.searchParams.get("v");
      return videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }
    if (host === "youtu.be") {
      const videoId = url.pathname.replace(/^\//, "").split("/")[0];
      return videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const totalSeconds = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  if (minutes === 0) return `${remainder} sec`;
  if (remainder === 0) return `${minutes} min`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function PreventionPlanSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <main
      className={[
        "min-h-[100svh] px-6 pb-40 pt-8",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)]",
      ].join(" ")}
      aria-label="Loading longevity plan"
    >
      <div className="mx-auto max-w-[900px] animate-pulse space-y-5">
        <div className={["h-12 rounded-2xl", isDark ? "bg-white/[0.08]" : "bg-white/80"].join(" ")} />
        <div className={["h-[290px] rounded-[32px]", isDark ? "bg-[#2B1E35]" : "bg-white"].join(" ")} />
        <div className="grid grid-cols-1 gap-4">
          {PILLARS.map((pillar) => (
            <div key={pillar.id} className={["h-[230px] rounded-[28px]", isDark ? "bg-[#2B1E35]" : "bg-white"].join(" ")} />
          ))}
        </div>
      </div>
    </main>
  );
}

export default function PreventionPlan({
  previewPlan,
  firstNameOverride,
  backPath = "/health",
  themeOverride,
}: PreventionPlanProps = {}) {
  const { user } = useAuth();
  const profileFirstName = useOptionalProfile()?.firstName ?? "";
  const { isDark: preferredIsDark } = useHomeMasterTheme();
  const isDark = themeOverride ? themeOverride === "dark" : preferredIsDark;
  const navigate = useNavigate();
  const isPreview = Boolean(previewPlan);
  const userId = isPreview ? "" : user?.id ?? "";
  const firstName = firstNameOverride ?? profileFirstName;
  const query = usePreventionCompanion(userId);
  const dailyContentQuery = useDailyContent(userId);
  const pillarStatusQuery = usePillarStatus(userId);
  const companion = previewPlan ? buildPreviewCompanion(previewPlan, firstName) : query.data;
  const plan = companion?.plan;
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"shared" | "copied" | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, "done" | "too_hard" | "not_relevant">>({});
  const [previewVoiceContext, setPreviewVoiceContext] = useState<{ title: string; prompt: string } | null>(null);
  const [challengeState, setChallengeState] = useState<Record<string, { hint: boolean; answer: boolean }>>({});
  const [selectedGameOption, setSelectedGameOption] = useState<Record<string, string>>({});

  if (!previewPlan && (query.isLoading || !userId)) return <PreventionPlanSkeleton isDark={isDark} />;

  if (query.isError || !companion || !plan) {
    return (
      <main className={[
        "min-h-[100svh] px-6 pb-40 pt-10 text-center",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F8F2FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
      ].join(" ")}>
        <section className={["mx-auto max-w-[680px] rounded-[30px] border p-8", isDark ? "border-white/[0.12] bg-white/[0.07]" : "border-[#EEE8F1] bg-white shadow-[0_18px_42px_rgba(80,52,109,0.08)]"].join(" ")}>
          <h1 className="font-display text-[32px] font-semibold">Your longevity plan</h1>
          <p className={["mt-4 font-body text-[18px] font-semibold leading-8", isDark ? "text-[#DDD3EA]" : "text-[#766C80]"].join(" ")}>We could not load your plan just now. Please try again shortly.</p>
          <button type="button" onClick={() => navigate(backPath)} className="mt-7 min-h-[58px] rounded-[20px] bg-vyva-purple px-8 font-body text-[17px] font-black text-white">Return to My Health</button>
        </section>
      </main>
    );
  }

  const openVoicePrompt = (title: string, prompt: string) => {
    if (isPreview) {
      setPreviewVoiceContext({ title, prompt });
      return;
    }
    navigate("/chat?mode=voice&q=" + encodeURIComponent(prompt));
  };

  const openResourceUrl = (url: string, action?: CompanionAction) => {
    if (isInternalResourceUrl(url)) {
      if (isPreview) {
        const previewRoute = action
          ? previewRouteForAction({ ...action, route: url }, url)
          : previewRouteForAction({
            action_key: "preview-resource",
            title: "Preview resource",
            detail: "",
            pillar: null,
            route: url,
            prompt: "",
            source: "fallback",
          }, url);
        if (previewRoute) {
          navigate(previewRoute);
          return;
        }
      }
      navigate(url);
      return;
    }
    window.location.assign(url);
  };

  const openCompanionAction = (action: CompanionAction) => {
    const destination = actionDestination(action);
    if (destination) {
      openResourceUrl(destination.url, action);
      return;
    }
    if (isPreview) {
      openVoicePrompt(action.title, action.prompt);
      return;
    }
    openVoicePrompt(action.title, action.prompt);
  };

  const trackDailyContentEngagement = (content: DailyContentItem) => {
    if (!userId || !content.id) return;
    void apiFetch("/api/prevention/daily-content/engage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, contentId: content.id }),
    }).catch((err) => console.warn("[daily content engage]", err));
  };

  const openDailyContent = (content: DailyContentItem) => {
    trackDailyContentEngagement(content);
    if (content.source_url) {
      openResourceUrl(content.source_url);
      return;
    }
    openVoicePrompt(
      content.title,
      `Help me with today's ${DAILY_CONTENT_LABELS[content.content_type].toLowerCase()}: ${content.title}. ${content.description}`,
    );
  };

  const submitFeedback = async (
    action: CompanionAction,
    eventType: FeedbackEventType,
    extraContext: Record<string, unknown> = {},
  ) => {
    if (eventType !== "opened") {
      setFeedbackState((current) => ({ ...current, [action.action_key]: eventType }));
    }
    if (!userId) return;
    await apiFetch("/api/prevention/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        planId: plan.id,
        pillar: action.pillar,
        actionKey: action.action_key,
        actionTitle: action.title,
        eventType,
        sourceContext: {
          todayFocus: companion.todayFocus.label,
          whyToday: companion.whyToday,
          actionSource: action.source,
          contentId: action.content_id ?? null,
          programId: companion.activeProgram?.id ?? null,
          programKey: companion.activeProgram?.programKey ?? null,
          programDayId: companion.todayProgramStep?.id ?? null,
          programDayIndex: companion.todayProgramStep?.dayIndex ?? null,
          videoResourceId: companion.todayVideo?.id ?? null,
          videoId: companion.todayVideo?.videoId ?? null,
          videoUrl: companion.todayVideo?.url ?? null,
          videoTitle: companion.todayVideo?.title ?? null,
          ...extraContext,
        },
      }),
    }).catch((err) => console.warn("[prevention feedback]", err));
  };

  const liveStatuses = pillarStatusQuery.data?.statuses;
  const livePriority = pillarStatusQuery.data?.priority_pillar;
  const pillarActions = resolvePillarActions(companion, plan);
  const dailySession = companion.dailySession ?? fallbackDailySession(companion, plan, firstName, pillarActions);
  const primaryExperience = dailySession.primaryExperience;
  const primaryExperienceAction = primaryExperience.action ?? companion.primaryAction;
  const mainAction = primaryExperience.kind === "video"
    ? dailySession.companionAction
    : primaryExperienceAction;
  const companionStepAction = primaryExperience.kind === "video"
    ? null
    : dailySession.companionAction;
  const currentPriority = primaryExperience.pillar ?? companion.todayFocus.pillar ?? livePriority ?? null;
  const priorityDefinition = currentPriority
    ? PILLARS.find((pillar) => pillar.id === currentPriority) ?? resolvePriorityDefinition(plan, livePriority, liveStatuses)
    : resolvePriorityDefinition(plan, livePriority, liveStatuses);
  const priorityPillarId = priorityDefinition?.id ?? null;
  const priorityLabel = companion.todayFocus.label || priorityDefinition?.label || plan.priority_pillar;
  const priorityAction = mainAction ?? companion.primaryAction ?? (priorityPillarId ? pillarActions[priorityPillarId] : fallbackActionForPillar(plan, "brain"));
  const todayVideoUrl = exactYoutubeUrl(primaryExperience.video?.url ?? companion.todayVideo?.url);
  const todayVideo = todayVideoUrl ? (primaryExperience.video ?? companion.todayVideo) : null;
  const videoDuration = formatDuration(todayVideo?.durationSeconds);
  const programDayLabel = companion.activeProgram && companion.todayProgramStep
    ? `Day ${companion.todayProgramStep.dayIndex} of ${companion.activeProgram.totalDays}`
    : "Today";
  const heroHeadline = dailySession.sessionFocus || companion.todayFocus.headline || personalisedHeadline(firstName, plan.priority_intervention, priorityLabel);
  const seniorNarrative = dailySession.whyThis.summary || companion.whyToday || personalisedNarrative(plan.plan_narrative_senior, firstName);
  const vyvaPrompt = priorityAction.prompt || primaryExperienceAction.prompt || "Explain my longevity plan and help me choose where to start";
  const careTeamSummary = companion.careSummary.share_text;
  const brainSpark = priorityAction.challenge ?? null;
  const brainGameOptions: BrainGameOption[] = brainSpark
    ? priorityAction.gameOptions?.length
      ? priorityAction.gameOptions
      : [{
        id: "today",
        label: "Today",
        title: priorityAction.title,
        ...brainSpark,
      }]
    : [];
  const selectedBrainGame = brainGameOptions.find((option) => option.id === selectedGameOption[priorityAction.action_key])
    ?? brainGameOptions[0]
    ?? null;
  const activeBrainSpark = selectedBrainGame ?? brainSpark;
  const brainSparkState = challengeState[priorityAction.action_key] ?? { hint: false, answer: false };
  const displayedPriorityTitle = selectedBrainGame?.title ?? priorityAction.title;
  const displayedPriorityDetail = selectedBrainGame?.followUp ?? priorityAction.detail;
  const priorityTimingMeta = timingMetaLabel(priorityAction);
  const priorityActionLabel = primaryExperience.kind === "video"
    ? "Companion step"
    : primaryExperience.kind === "brain_game"
      ? "Brain game"
      : primaryExperience.kind === "movement"
        ? "Movement"
        : primaryExperience.kind === "walking_route"
          ? "Route"
          : primaryExperience.kind === "food"
            ? "Food"
            : primaryExperience.kind === "calm"
              ? "Calm"
              : "Today";

  const openTodayVideo = () => {
    if (!todayVideo || !todayVideoUrl) return;
    void submitFeedback(priorityAction, "opened", {
      resourceType: "video",
      openedUrl: todayVideoUrl,
    });
    window.open(todayVideoUrl, "_blank", "noopener,noreferrer");
  };

  const updateBrainSparkState = (next: Partial<{ hint: boolean; answer: boolean }>) => {
    setChallengeState((current) => ({
      ...current,
      [priorityAction.action_key]: { ...brainSparkState, ...next },
    }));
  };

  const chooseBrainGame = (option: BrainGameOption) => {
    setSelectedGameOption((current) => ({ ...current, [priorityAction.action_key]: option.id }));
    setChallengeState((current) => ({ ...current, [priorityAction.action_key]: { hint: false, answer: false } }));
    void submitFeedback(priorityAction, "opened", {
      resourceType: "brain_game",
      gameOptionId: option.id,
      gameOptionTitle: option.title,
    });
  };

  const copyCareText = async () => {
    if (!careTeamSummary) return;
    await navigator.clipboard.writeText(careTeamSummary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const shareCareText = async () => {
    if (!careTeamSummary) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "VYVA Longevity Plan", text: careTeamSummary });
        setShareFeedback("shared");
        window.setTimeout(() => setShareFeedback(null), 1800);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(careTeamSummary);
    setShareFeedback("copied");
    window.setTimeout(() => setShareFeedback(null), 1800);
  };

  const surfaceClass = isDark
    ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F8F2FF]"
    : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]";
  const cardClass = isDark
    ? "border-white/[0.12] bg-white/[0.07] shadow-[0_18px_48px_rgba(0,0,0,0.18)]"
    : "border-[#EEE8F1] bg-white shadow-[0_18px_42px_rgba(80,52,109,0.08)]";
  const mutedTextClass = isDark ? "text-[#D9CFE3]" : "text-[#766C80]";
  const dividerClass = isDark ? "border-white/[0.1]" : "border-[#EEE8F1]";

  return (
    <main data-testid="prevention-plan-screen" data-home-master-theme={isDark ? "dark" : "light"} className={["min-h-[100svh] w-full overflow-x-hidden px-5 pb-40 pt-6 sm:px-7 sm:pt-8", surfaceClass].join(" ")}>
      <div className="vyva-home-master-fixed-type mx-auto w-full max-w-[900px]">
        <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3" data-testid="prevention-plan-topbar">
          <button type="button" onClick={() => navigate(backPath)} aria-label="Return to My Health" className={["vyva-tap grid h-11 min-h-11 w-11 place-items-center rounded-full border", isDark ? "border-white/[0.18] bg-white/[0.07]" : "border-black/[0.05] bg-white shadow-[0_12px_28px_rgba(80,52,109,0.12)]"].join(" ")}>
            <VyvaIcon icon={ArrowLeft} size={20} strokeWidth={2.45} tone={isDark ? "inverse" : "brand"} />
          </button>
          <h1 className="truncate text-center font-display text-[24px] font-semibold tracking-[-0.03em]">Longevity</h1>
          <span aria-hidden="true" className="h-11 min-h-11 w-11" />
        </header>

        <section className="relative mt-6 overflow-hidden rounded-[16px] border-[0.5px] border-[#E8E0D0] border-l-4 border-l-[#F59E0B] bg-[#FFFFFF] px-5 py-5 shadow-[0_14px_34px_rgba(80,52,109,0.07)] sm:px-6 sm:py-6">
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#FFF7E8] ring-1 ring-inset ring-[#F6D7A4]"><VyvaIcon glyph="longevity" size={38} /></span>
                <div>
                  <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">Today's focus</p>
                </div>
              </div>
              {priorityDefinition ? <span className="shrink-0 rounded-full bg-[#FAEEDA] px-3 py-1.5 font-body text-[12px] font-black text-[#854F0B]">{priorityDefinition.shortLabel}</span> : null}
            </div>
            <h2 className="mt-4 max-w-[700px] font-display text-[21px] font-medium leading-[1.16]" style={{ color: "var(--text-primary, #241C30)" }}>{heroHeadline}</h2>
            <button type="button" onClick={() => openVoicePrompt("Ask VYVA about my plan", vyvaPrompt)} className="mt-4 inline-flex h-[52px] min-h-[52px] w-full items-center justify-center gap-3 rounded-[17px] bg-[#6B21A8] px-6 font-body text-[15px] font-black text-white shadow-[0_10px_24px_rgba(107,33,168,0.16)]">
              <VyvaIcon icon={Mic} accent="dot" size={21} strokeWidth={2.5} tone="inverse" />Ask VYVA
            </button>
          </div>
        </section>

        {previewVoiceContext ? (
          <section className={["mt-4 rounded-[18px] border px-4 py-3", isDark ? "border-white/[0.12] bg-white/[0.07]" : "border-[#E8E0D0] bg-white"].join(" ")} role="status" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-[10px] font-black uppercase tracking-[0.1em] text-[#854F0B]">Voice context ready</p>
                <h3 className="mt-1 font-display text-[17px] font-semibold leading-5">{previewVoiceContext.title}</h3>
                <p className={["mt-1 font-body text-[13px] font-semibold leading-5", mutedTextClass].join(" ")}>{previewVoiceContext.prompt}</p>
              </div>
              <button type="button" onClick={() => setPreviewVoiceContext(null)} className={["shrink-0 rounded-full border px-3 py-1.5 font-body text-[12px] font-black", isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] text-[#6E6175]"].join(" ")}>Close</button>
            </div>
          </section>
        ) : null}

        <section className="mt-7" aria-labelledby="daily-picks-heading">
          <div className="flex items-end justify-between gap-3">
            <h2 id="daily-picks-heading" className="font-display text-[24px] font-semibold">Today</h2>
            <span className={["rounded-full px-3 py-1.5 font-body text-[12px] font-black", isDark ? "bg-white/[0.08] text-[#D9CFE3]" : "bg-[#FAEEDA] text-[#854F0B]"].join(" ")}>{programDayLabel}</span>
          </div>

          <div className="mt-3 space-y-3">
            {todayVideo ? (
              <article className={["overflow-hidden rounded-[22px] border p-3", cardClass].join(" ")}>
                <div className="grid gap-4 sm:grid-cols-[minmax(220px,0.84fr)_1fr] sm:items-center">
                  <button
                    type="button"
                    onClick={openTodayVideo}
                    aria-label={`Watch ${todayVideo.title}`}
                    className="group relative overflow-hidden rounded-[18px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                  >
                    <div className={["relative aspect-video w-full overflow-hidden rounded-[18px]", isDark ? "bg-[#2A1838]" : "bg-[#F8F0FF]"].join(" ")}>
                      {todayVideo.thumbnailUrl ? (
                        <img src={todayVideo.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <VyvaIcon icon={PlayCircle} accent="spark" size={44} strokeWidth={1.8} tone="brand" />
                        </div>
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-black/10">
                        <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#6B21A8] shadow-[0_12px_28px_rgba(0,0,0,0.2)] transition-transform group-hover:scale-105">
                          <PlayCircle size={30} strokeWidth={2.2} />
                        </span>
                      </span>
                    </div>
                  </button>

                  <div className="min-w-0 px-1 pb-1 sm:px-0 sm:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">Today&apos;s video</span>
                      {videoDuration ? (
                        <span className={["inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-[11px] font-black", isDark ? "bg-white/[0.08] text-[#D9CFE3]" : "bg-[#F5EFF8] text-[#6E6175]"].join(" ")}>
                          <Clock size={12} />{videoDuration}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 font-display text-[19px] font-semibold leading-6">{todayVideo.title}</h3>
                    {todayVideo.channel ? <p className={["mt-1 font-body text-[13px] font-black", mutedTextClass].join(" ")}>{todayVideo.channel}</p> : null}
                    <p className={["mt-3 font-body text-[14px] font-semibold leading-6", mutedTextClass].join(" ")}>{todayVideo.selectedReason}</p>
                    <button
                      type="button"
                      onClick={openTodayVideo}
                      className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#6B21A8] px-5 font-body text-[14px] font-black text-white shadow-[0_10px_24px_rgba(107,33,168,0.16)] sm:w-auto"
                    >
                      Watch
                      <ExternalLink size={17} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              </article>
            ) : primaryExperience.kind === "video" ? (
              <article className={["rounded-[22px] border p-5", cardClass].join(" ")}>
                <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">Today&apos;s video</p>
                <h3 className="mt-2 font-display text-[20px] font-semibold">VYVA is finding today&apos;s video</h3>
                <p className={["mt-2 font-body text-[14px] font-semibold leading-6", mutedTextClass].join(" ")}>
                  {companion.videoCurationStatus === "failed"
                    ? "Start with the step below while VYVA finds a better visual guide."
                    : "The step below is ready while the video choice finishes."}
                </p>
              </article>
            ) : null}

            <article className={["rounded-[22px] border p-4", cardClass].join(" ")}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <span className={["grid h-11 w-11 shrink-0 place-items-center rounded-[15px]", isDark ? "bg-[#3C2956]" : "bg-[#FFF7E8]"].join(" ")}>
                  <VyvaIcon icon={Sparkles} accent="spark" size={22} strokeWidth={2.4} tone="brand" />
                </span>
                <div className="min-w-0">
                  <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">{priorityActionLabel}</p>
                  <h3 className="mt-1 font-display text-[18px] font-semibold leading-6">{displayedPriorityTitle}</h3>
                  <p className={["mt-2 font-body text-[14px] font-semibold leading-6", mutedTextClass].join(" ")}>{displayedPriorityDetail}</p>
                  {priorityTimingMeta ? (
                    <p className="mt-2 font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">{priorityTimingMeta}</p>
                  ) : null}
                  {activeBrainSpark ? (
                    <div className={["mt-3 rounded-[16px] border px-4 py-3", isDark ? "border-white/[0.1] bg-white/[0.04]" : "border-[#F0DFC1] bg-[#FFF9EF]"].join(" ")}>
                      <p className={["font-body text-[15px] font-black leading-6", isDark ? "text-[#F8F2FF]" : "text-[#241C30]"].join(" ")}>{activeBrainSpark.prompt}</p>
                      {brainSparkState.hint ? <p className={["mt-3 font-body text-[13px] font-semibold leading-5", mutedTextClass].join(" ")}><span className="font-black text-[#854F0B]">Hint: </span>{activeBrainSpark.hint}</p> : null}
                      {activeBrainSpark.answer && brainSparkState.answer ? <p className={["mt-3 font-body text-[13px] font-semibold leading-5", mutedTextClass].join(" ")}><span className="font-black text-[#854F0B]">Answer: </span>{activeBrainSpark.answer}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateBrainSparkState({ hint: true })}
                          className={["min-h-[40px] rounded-full border px-4 font-body text-[12px] font-black", brainSparkState.hint ? "border-[#F59E0B] bg-[#FAEEDA] text-[#854F0B]" : isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] bg-white text-[#6E6175]"].join(" ")}
                        >
                          Show hint
                        </button>
                        {activeBrainSpark.answer ? (
                          <button
                            type="button"
                            onClick={() => updateBrainSparkState({ answer: true })}
                            className={["min-h-[40px] rounded-full border px-4 font-body text-[12px] font-black", brainSparkState.answer ? "border-[#149A63] bg-[#E4F7EF] text-[#0A7653]" : isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] bg-white text-[#6E6175]"].join(" ")}
                          >
                            Reveal answer
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCompanionAction(priorityAction)}
                      className={["mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] border px-4 font-body text-[13px] font-black", isDark ? "border-[#9D4FE0] text-[#DAB6FF]" : "border-[#7C3AED] text-[#6B21A8]"].join(" ")}
                    >
                      {primaryExperience.kind === "video" ? "Start step" : primaryExperience.ctaLabel}
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>

              {brainGameOptions.length > 0 ? (
                <div className={["mt-4 border-t pt-3", dividerClass].join(" ")}>
                  <p className="mb-2 font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">Pick a game</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {brainGameOptions.map((option) => {
                      const selected = selectedBrainGame?.id === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => chooseBrainGame(option)}
                          className={["min-h-[44px] rounded-[14px] border px-3 font-body text-[12px] font-black", selected ? "border-[#6B21A8] bg-[#F1E8FF] text-[#6B21A8]" : isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] bg-white text-[#6E6175]"].join(" ")}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          <details className={["group rounded-[26px] border", cardClass].join(" ")}>
            <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-4 px-5 font-body text-[17px] font-black sm:px-6">
              <span className="flex items-center gap-3"><span className={["grid h-10 w-10 place-items-center rounded-[14px]", isDark ? "bg-[#3C2956]" : "bg-[#F1E8FF]"].join(" ")}><VyvaIcon icon={Sparkles} accent="spark" size={22} strokeWidth={2.4} tone="brand" /></span>Why this?</span>
              <ChevronDown className="transition-transform group-open:rotate-180" size={22} />
            </summary>
            <div className={["border-t px-5 py-5 sm:px-6", dividerClass].join(" ")}>
              {seniorNarrative ? <p className={["font-body text-[16px] font-semibold leading-7", mutedTextClass].join(" ")}>{seniorNarrative}</p> : null}
              {dailySession.whyThis.evidence.length > 0 ? (
                <div className={seniorNarrative ? "mt-5" : ""}>
                  <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#9D4FE0]">VYVA considered</p>
                  <ul className={["mt-2 divide-y", dividerClass].join(" ")}>
                    {dailySession.whyThis.evidence.map((item) => (
                      <li key={item} className={["flex min-h-[48px] items-center gap-3 py-2 font-body text-[14px] font-bold leading-6", mutedTextClass].join(" ")}><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#F8AE1B]" /><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
              ) : <p className={[(seniorNarrative ? "mt-4 " : "") + "font-body text-[16px] font-semibold leading-7", mutedTextClass].join(" ")}>This first plan uses general-wellness guidance while VYVA learns what matters to you.</p>}
            </div>
          </details>

          <details className={["group rounded-[26px] border", cardClass].join(" ")}>
            <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-4 px-5 font-body text-[17px] font-black sm:px-6">
              <span className="flex items-center gap-3"><span className={["grid h-10 w-10 place-items-center rounded-[14px]", isDark ? "bg-[#3C2956]" : "bg-[#F1E8FF]"].join(" ")}><VyvaIcon icon={Clipboard} accent="bookmark" size={22} strokeWidth={2.4} tone="brand" /></span>Care-team summary</span>
              <ChevronDown className="transition-transform group-open:rotate-180" size={22} />
            </summary>
            <div className={["border-t px-5 py-5 sm:px-6", dividerClass].join(" ")}>
              <p className={["font-body text-[16px] font-black leading-7", isDark ? "text-[#F8F2FF]" : "text-[#241C30]"].join(" ")}>{companion.careSummary.title}</p>
              <ul className={["mt-3 divide-y", dividerClass].join(" ")}>
                {companion.careSummary.bullets.map((item) => (
                  <li key={item} className={["flex min-h-[46px] items-start gap-3 py-2 font-body text-[14px] font-bold leading-6", mutedTextClass].join(" ")}><span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#F8AE1B]" /><span>{item}</span></li>
                ))}
              </ul>
              {priorityLabel ? <div className={["mt-5 rounded-[18px] border px-4 py-4", isDark ? "border-[#6D4A1A] bg-[#3D2C16]" : "border-[#F2D08E] bg-[#FFF5E1]"].join(" ")}><p className={["font-body text-[16px] font-black", isDark ? "text-[#FFE0A3]" : "text-[#6D4105]"].join(" ")}>Focus: {priorityLabel}</p><p className={["mt-2 font-body text-[14px] font-bold leading-6", isDark ? "text-[#E8C88D]" : "text-[#76521E]"].join(" ")}>{priorityAction.title}</p></div> : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void copyCareText()} disabled={!careTeamSummary} className={["flex min-h-[56px] items-center justify-center gap-3 rounded-[18px] border-2 px-5 font-body text-[15px] font-black disabled:opacity-40", isDark ? "border-[#9D4FE0] text-[#DAB6FF]" : "border-[#7C3AED] text-[#6B21A8]"].join(" ")}>
                  {copied ? <VyvaIcon icon={Check} size={21} tone={isDark ? "inverse" : "brand"} /> : <VyvaIcon icon={Clipboard} accent="bookmark" size={21} tone={isDark ? "inverse" : "brand"} />}{copied ? "Copied" : "Copy summary"}
                </button>
                <button type="button" onClick={() => void shareCareText()} disabled={!careTeamSummary} className="flex min-h-[56px] items-center justify-center gap-3 rounded-[18px] bg-vyva-purple px-5 font-body text-[15px] font-black text-white disabled:opacity-40">
                  <VyvaIcon icon={shareFeedback ? Check : Share2} size={21} tone="inverse" />{shareFeedback === "shared" ? "Shared" : shareFeedback === "copied" ? "Copied" : "Share summary"}
                </button>
              </div>
              {/* TODO: Add GP-ready PDF export from plan_abstract_gp after pilot data exists. */}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

// TODO: Add ElevenLabs structured voice walkthroughs for each pillar.
// TODO: Show month-over-month trajectory after at least two plans exist.
// TODO: Learn from Done and Skip outcomes after at least three months.
