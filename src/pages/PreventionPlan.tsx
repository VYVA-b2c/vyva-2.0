import { useQuery } from "@tanstack/react-query";
import {
  Apple,
  ArrowLeft,
  Brain,
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Footprints,
  HeartPulse,
  Mic,
  Share2,
  Sparkles,
  ThumbsUp,
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

type DailyContentType = "exercise" | "meal" | "tip" | "article";
type DailyContentItem = {
  id: string;
  content_type: DailyContentType;
  title: string;
  description: string;
  detail_text: string | null;
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
  articles: DailyContentItem[];
  byPillar?: Partial<Record<PreventionPillar, DailyContentItem[]>>;
};

type CompanionSignal = {
  id: string;
  label: string;
  detail: string;
  source: "profile" | "medication" | "brain" | "check-in" | "symptom" | "vitals" | "feedback";
  pillar: PreventionPillar | null;
  tone: "steady" | "attention" | "positive";
};

type CompanionAction = {
  action_key: string;
  content_id?: string | null;
  title: string;
  detail: string;
  pillar: PreventionPillar | null;
  route: string | null;
  prompt: string;
  source: "monthly_plan" | "daily_content" | "feedback_memory" | "fallback";
};

type CompanionPayload = {
  plan: PreventionPlanData;
  todayFocus: {
    pillar: PreventionPillar | null;
    label: string;
    headline: string;
    summary: string;
  };
  whyToday: string;
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

const PRIORITY_STATUS_RANK: Record<PreventionPillarStatus, number> = {
  priority_focus: 4,
  needs_attention: 3,
  steady: 2,
  thriving: 1,
};

const PREVIEW_DAILY_CONTENT: DailyContentResponse = {
  exercise: {
    id: "preview-exercise",
    content_type: "exercise",
    title: "Walk after lunch",
    description: "Ten steady minutes supports circulation without making the plan feel heavy.",
    detail_text: null,
    source_label: null,
    source_url: null,
    condition_tags: ["heart"],
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
    source_label: null,
    source_url: null,
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
    source_label: null,
    source_url: null,
    condition_tags: ["all"],
    pillar_tag: "calm",
    time_of_day: "evening",
    language: "en",
  },
  articles: [
    {
      id: "preview-article",
      content_type: "article",
      title: "Walking after meals supports heart and glucose patterns",
      description: "A short, practical read connected to your current heart focus.",
      detail_text: null,
      source_label: "Curated research",
      source_url: "https://academic.oup.com/eurheartj",
      condition_tags: ["heart"],
      pillar_tag: "heart",
      time_of_day: "any",
      language: "en",
    },
  ],
  byPillar: {
    heart: [{
      id: "preview-heart",
      content_type: "exercise",
      title: "Walk after lunch",
      description: "Tie ten easy minutes to a meal so circulation support is simple to remember.",
      detail_text: null,
      source_label: null,
      source_url: null,
      condition_tags: ["heart"],
      pillar_tag: "heart",
      time_of_day: "afternoon",
      language: "en",
    }],
    brain: [{
      id: "preview-brain",
      content_type: "tip",
      title: "One familiar Brain Coach round",
      description: "A familiar activity keeps today's brain step low effort.",
      detail_text: null,
      source_label: null,
      source_url: null,
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
      source_label: null,
      source_url: null,
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
      source_label: null,
      source_url: null,
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
      source_label: null,
      source_url: null,
      condition_tags: ["calm"],
      pillar_tag: "calm",
      time_of_day: "evening",
      language: "en",
    }],
  },
};

function upperFirst(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function lowerFirst(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
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
    title: content.title,
    detail: content.description,
    pillar,
    route: pillar === "brain" ? "/mind" : pillar === "calm" ? "/games/breath-garden" : pillar === "strength" ? "/health/exercises/gentle-walk" : null,
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
        prompt: `Help me with today's ${pillar.label} step: ${fallbackTitle}.`,
        source: "fallback" as const,
      }];
  })) as Record<PreventionPillar, CompanionAction>;
  const primaryAction = pillarActions[priorityPillar];
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

  return {
    plan,
    todayFocus: {
      pillar: priorityPillar,
      label: priorityDefinition?.label ?? "Longevity",
      headline: firstName ? `${firstName}, restart Brain Coach gently today` : "Restart Brain Coach gently today",
      summary: signalsUsed[0].detail,
    },
    whyToday,
    primaryAction,
    supportAction,
    pillarActions,
    careSummary: {
      title: `Longevity summary for ${firstName || "this user"}`,
      bullets: [whyToday, ...PILLARS.map((pillar) => `${pillar.label}: ${pillarActions[pillar.id].title}.`), signalsUsed[0].detail],
      share_text: [`Longevity summary for ${firstName || "this user"}`, "- " + whyToday, ...PILLARS.map((pillar) => `- ${pillar.label}: ${pillarActions[pillar.id].title}.`)].join("\n"),
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

function statusClass(tone: "success" | "steady" | "warning", isDark: boolean): string {
  if (tone === "success") return isDark ? "bg-[#123D31] text-[#72E1B3]" : "bg-[#E4F7EF] text-[#0A7653]";
  if (tone === "warning") return isDark ? "bg-[#4A3618] text-[#FFC65A]" : "bg-[#FFF0D2] text-[#9A5A00]";
  return isDark ? "bg-white/[0.08] text-[#D9CFE3]" : "bg-[#F2EDF4] text-[#6E6175]";
}

function routeForPillarAction(pillar: PreventionPillar, title: string): string | null {
  const text = title.toLowerCase();
  if (pillar === "brain" || text.includes("brain coach")) return "/mind";
  if (pillar === "calm" || text.includes("breath")) return "/games/breath-garden";
  if (pillar === "strength" || text.includes("walk") || text.includes("chair")) return "/health/exercises/gentle-walk";
  if (text.includes("medicine") || text.includes("medication")) return "/health/medications";
  return null;
}

function fallbackActionForPillar(plan: PreventionPlanData, pillar: PreventionPillar): CompanionAction {
  const recommendation = plan.recommendations[pillar]?.[0];
  const pillarLabel = PILLARS.find((item) => item.id === pillar)?.shortLabel.toLowerCase() ?? "wellbeing";
  const title = recommendation?.action ?? `Choose one ${pillarLabel} step`;
  const detail = recommendation?.why ?? "One small step is enough today.";
  return {
    action_key: actionKeyFor(pillar, title),
    title,
    detail,
    pillar,
    route: routeForPillarAction(pillar, title),
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

function briefText(value: string | null | undefined, maxChars = 96): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentenceEnd = clean.search(/[.!?](\s|$)/);
  const firstSentence = sentenceEnd >= 0 ? clean.slice(0, sentenceEnd + 1) : clean;
  if (firstSentence.length <= maxChars) return firstSentence;
  return firstSentence.slice(0, Math.max(0, maxChars - 3)).trimEnd().replace(/[.,;:]+$/, "") + "...";
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
  const userId = previewPlan ? "" : user?.id ?? "";
  const firstName = firstNameOverride ?? profileFirstName;
  const query = usePreventionCompanion(userId);
  const companion = previewPlan ? buildPreviewCompanion(previewPlan, firstName) : query.data;
  const plan = companion?.plan;
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"shared" | "copied" | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, "done" | "too_hard" | "not_relevant">>({});

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

  const openCompanionAction = (action: CompanionAction) => {
    if (action.route) navigate(action.route);
    else navigate("/chat?mode=voice&q=" + encodeURIComponent(action.prompt));
  };

  const submitFeedback = async (action: CompanionAction, eventType: "done" | "too_hard" | "not_relevant") => {
    setFeedbackState((current) => ({ ...current, [action.action_key]: eventType }));
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
        },
      }),
    }).catch((err) => console.warn("[prevention feedback]", err));
  };

  const priorityDefinition = companion.todayFocus.pillar
    ? PILLARS.find((pillar) => pillar.id === companion.todayFocus.pillar) ?? resolvePriorityDefinition(plan)
    : resolvePriorityDefinition(plan);
  const priorityPillarId = priorityDefinition?.id ?? null;
  const priorityLabel = companion.todayFocus.label || priorityDefinition?.label || plan.priority_pillar;
  const pillarActions = resolvePillarActions(companion, plan);
  const priorityAction = priorityPillarId ? pillarActions[priorityPillarId] : companion.primaryAction;
  const orderedPillars = priorityDefinition
    ? [priorityDefinition, ...PILLARS.filter((pillar) => pillar.id !== priorityDefinition.id)]
    : PILLARS;
  const secondaryPillars = orderedPillars.filter((pillar) => pillar.id !== priorityPillarId);
  const heroHeadline = companion.todayFocus.headline || personalisedHeadline(firstName, plan.priority_intervention, priorityLabel);
  const seniorNarrative = companion.whyToday || personalisedNarrative(plan.plan_narrative_senior, firstName);
  const vyvaPrompt = priorityAction.prompt || "Explain my longevity plan and help me choose where to start";
  const careTeamSummary = companion.careSummary.share_text;

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
  const primaryFeedbackState = feedbackState[priorityAction.action_key] ?? null;
  const feedbackLabel = primaryFeedbackState === "done"
    ? "Saved as done"
    : primaryFeedbackState === "too_hard"
      ? "VYVA will make it smaller"
      : primaryFeedbackState === "not_relevant"
        ? "VYVA will avoid repeats"
        : null;

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
            <button type="button" onClick={() => navigate("/chat?mode=voice&q=" + encodeURIComponent(vyvaPrompt))} className="mt-4 inline-flex h-[52px] min-h-[52px] w-full items-center justify-center gap-3 rounded-[17px] bg-[#6B21A8] px-6 font-body text-[15px] font-black text-white shadow-[0_10px_24px_rgba(107,33,168,0.16)]">
              <VyvaIcon icon={Mic} accent="dot" size={21} strokeWidth={2.5} tone="inverse" />Ask VYVA
            </button>
          </div>
        </section>

        <section className="mt-7" aria-labelledby="daily-picks-heading">
          <h2 id="daily-picks-heading" className="font-display text-[24px] font-semibold">Today</h2>

          <div className={["mt-3 rounded-[22px] border p-3", cardClass].join(" ")}>
            <button
              type="button"
              onClick={() => openCompanionAction(priorityAction)}
              className={["group grid min-h-[72px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[17px] px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]", isDark ? "bg-white/[0.04] hover:bg-white/[0.07]" : "bg-[#FFFDF9] hover:bg-[#FAF7FC]"].join(" ")}
            >
              <span className={["grid h-11 w-11 shrink-0 place-items-center rounded-[15px]", isDark ? "bg-[#3C2956]" : "bg-[#FFF7E8]"].join(" ")}>
                <VyvaIcon icon={Sparkles} accent="spark" size={22} strokeWidth={2.4} tone="brand" />
              </span>
              <span className="min-w-0">
                <span className="font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#854F0B]">{priorityDefinition?.label ?? "Do this"}</span>
                <span className="block font-display text-[17px] font-semibold leading-5">{priorityAction.title}</span>
                <span className={["mt-1 block font-body text-[13px] font-semibold leading-5", mutedTextClass].join(" ")}>{briefText(priorityAction.detail, 110)}</span>
              </span>
              <VyvaIcon icon={ChevronRight} size={17} strokeWidth={2.5} tone={isDark ? "inverse" : "muted"} />
            </button>

            <div className={["mt-3 border-t pt-3", dividerClass].join(" ")}>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => void submitFeedback(priorityAction, "done")} className={["flex min-h-[44px] items-center justify-center gap-1.5 rounded-[14px] border px-2 font-body text-[12px] font-black", primaryFeedbackState === "done" ? "border-[#149A63] bg-[#E4F7EF] text-[#0A7653]" : isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] text-[#6E6175]"].join(" ")}>
                  <ThumbsUp size={15} />Done
                </button>
                <button type="button" onClick={() => void submitFeedback(priorityAction, "too_hard")} className={["flex min-h-[44px] items-center justify-center gap-1.5 rounded-[14px] border px-2 font-body text-[12px] font-black", primaryFeedbackState === "too_hard" ? "border-[#F59E0B] bg-[#FAEEDA] text-[#854F0B]" : isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] text-[#6E6175]"].join(" ")}>
                  <Sparkles size={15} />Too hard
                </button>
                <button type="button" onClick={() => void submitFeedback(priorityAction, "not_relevant")} className={["flex min-h-[44px] items-center justify-center gap-1.5 rounded-[14px] border px-2 font-body text-[12px] font-black", primaryFeedbackState === "not_relevant" ? "border-[#C15A2D] bg-[#FFF1E8] text-[#8A3C16]" : isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] text-[#6E6175]"].join(" ")}>
                  <Ban size={15} />Not relevant
                </button>
              </div>
              {feedbackLabel ? <p className="mt-2 text-center font-body text-[12px] font-black text-[#854F0B]">{feedbackLabel}</p> : null}
            </div>

            <div className={["mt-3 space-y-2 border-t pt-3", dividerClass].join(" ")}>
              {secondaryPillars.map((pillar) => {
                const action = pillarActions[pillar.id];
                const done = feedbackState[action.action_key] === "done";
                const status = pillarStatus(plan, pillar.id);
                const statusDisplay = STATUS[status];
                const reason = briefText(action.detail, 92);
                const Icon = pillar.icon;
                return (
                  <article
                    key={pillar.id}
                    className={["grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[17px] border px-2 py-2", isDark ? "border-white/[0.1] bg-white/[0.03]" : "border-[#EEE4D2] bg-[#FFFDF9]"].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => openCompanionAction(action)}
                      className="group grid min-h-[62px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                    >
                      <span className={["grid h-10 w-10 shrink-0 place-items-center rounded-[14px]", isDark ? "bg-[#2E2541]" : "bg-[#F8F0FF]"].join(" ")}>
                        <VyvaIcon icon={Icon} accent={pillar.accent} size={20} strokeWidth={2.4} tone="brand" />
                      </span>
                      <span className="min-w-0">
                        <span className={["font-body text-[10px] font-black uppercase tracking-[0.08em]", statusDisplay.tone === "success" ? "text-[#0A7653]" : statusDisplay.tone === "warning" ? "text-[#854F0B]" : isDark ? "text-[#D9CFE3]" : "text-[#766C80]"].join(" ")}>{pillar.shortLabel}</span>
                        <span className="block truncate font-display text-[15px] font-semibold leading-5">{action.title}</span>
                        {reason ? <span className={["mt-0.5 block truncate font-body text-[12px] font-semibold leading-5", mutedTextClass].join(" ")}>{reason}</span> : null}
                      </span>
                      <VyvaIcon icon={ChevronRight} size={16} strokeWidth={2.5} tone={isDark ? "inverse" : "muted"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitFeedback(action, "done")}
                      aria-label={`Mark ${pillar.shortLabel} done`}
                      className={["flex h-9 min-h-9 shrink-0 items-center justify-center gap-1 rounded-full border px-3 font-body text-[12px] font-black", done ? "border-[#149A63] bg-[#E4F7EF] text-[#0A7653]" : isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] text-[#6E6175]"].join(" ")}
                    >
                      <ThumbsUp size={13} />Done
                    </button>
                  </article>
                );
              })}
            </div>
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
              {companion.signalsUsed.length > 0 ? (
                <div className={seniorNarrative ? "mt-5" : ""}>
                  <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#9D4FE0]">Signals considered</p>
                  <ul className={["mt-2 divide-y", dividerClass].join(" ")}>
                    {companion.signalsUsed.map((signal) => (
                      <li key={signal.id} className={["flex min-h-[48px] items-center gap-3 py-2 font-body text-[14px] font-bold leading-6", mutedTextClass].join(" ")}><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#F8AE1B]" /><span>{signal.label}: {signal.detail}</span></li>
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
