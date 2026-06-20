import { useCallback, useEffect, useRef } from "react";
import { Bell, BrainCircuit, CheckCircle2, Clock3, Headphones, Layers, Map as MapIcon, MessageCircle, Puzzle, Route, Type, UserRoundPlus, Users, Wind, X, type LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { margaret } from "@/data/mockData";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { useRouteVoiceAutoStart } from "@/hooks/useRouteVoiceAutoStart";
import { ActionCard, ResponsiveGrid, SectionTitle } from "@/components/vyva-ui";
import { buildBrainCoachRetentionNudges, type BrainCoachRetentionNudge } from "@/lib/brainCoachRetentionNudges";

const activityIcons: Record<string, LucideIcon> = {
  "brain.activities.triviaQuiz": Route,
  "brain.activities.memoryGame": Layers,
  "brain.activities.spatialNavigator": MapIcon,
  "brain.activities.scrabble": Type,
  "brain.activities.logicPuzzle": Puzzle,
  "brain.activities.meditation": Headphones,
  "brain.activities.breathing": Wind,
};

const activityStyles: Record<string, { iconBg: string; iconColor: string; glow: string; badgeBg: string; badgeText: string }> = {
  "brain.activities.triviaQuiz": {
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    iconColor: "#149A63",
    glow: "rgba(20,154,99,0.12)",
    badgeBg: "#DDF8EA",
    badgeText: "#0A7C4E",
  },
  "brain.activities.memoryGame": {
    iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
    iconColor: "#7C3AED",
    glow: "rgba(124,58,237,0.13)",
    badgeBg: "#EDE9FE",
    badgeText: "#6D28D9",
  },
  "brain.activities.spatialNavigator": {
    iconBg: "linear-gradient(135deg, #FEF3C7 0%, #FFF7ED 100%)",
    iconColor: "#B45309",
    glow: "rgba(180,83,9,0.12)",
    badgeBg: "#FEF3C7",
    badgeText: "#B45309",
  },
  "brain.activities.scrabble": {
    iconBg: "linear-gradient(135deg, #FFE7E7 0%, #FFF7F2 100%)",
    iconColor: "#E74C43",
    glow: "rgba(231,76,67,0.12)",
    badgeBg: "#FFE7E7",
    badgeText: "#B0355A",
  },
  "brain.activities.logicPuzzle": {
    iconBg: "linear-gradient(135deg, #FEF3C7 0%, #FFF7ED 100%)",
    iconColor: "#C9890A",
    glow: "rgba(201,137,10,0.12)",
    badgeBg: "#FEF3C7",
    badgeText: "#A16207",
  },
  "brain.activities.meditation": {
    iconBg: "linear-gradient(135deg, #CCFBF1 0%, #F0FDFA 100%)",
    iconColor: "#0F766E",
    glow: "rgba(15,118,110,0.12)",
    badgeBg: "#CCFBF1",
    badgeText: "#0F766E",
  },
  "brain.activities.breathing": {
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    iconColor: "#149A63",
    glow: "rgba(20,154,99,0.12)",
    badgeBg: "#DDF8EA",
    badgeText: "#0A7C4E",
  },
};

type ActivityDestination = {
  to: string;
  state?: {
    preselectActivity?: string;
    duration?: number;
  };
};

const activityRoutes: Partial<Record<string, ActivityDestination>> = {
  "brain.activities.triviaQuiz": { to: "/attention-boosters" },
  "brain.activities.memoryGame": { to: "/memory-games" },
  "brain.activities.spatialNavigator": { to: "/spatial-navigator" },
  "brain.activities.scrabble": { to: "/language" },
  "brain.activities.logicPuzzle": { to: "/executive-function" },
  "brain.activities.meditation": { to: "/activities/relax-breathe" },
  "brain.activities.breathing": { to: "/activities/relax-breathe" },
};

const activityCompletionTypes: Record<string, string[]> = {
  "brain.activities.triviaQuiz": ["dual_task_walk", "sequence_memory"],
  "brain.activities.memoryGame": [
    "memory_match",
    "sequence_memory",
    "word_recall",
    "number_memory",
    "routine_memory",
    "association_memory",
    "story_recall",
  ],
  "brain.activities.spatialNavigator": ["spatial_navigator"],
  "brain.activities.scrabble": ["story_recall"],
  "brain.activities.logicPuzzle": ["category_sort", "number_trails", "face_name_match"],
};

type BrainCoachProgress = {
  summary?: {
    streakDays?: number;
    lastPlayedAt?: string | null;
  };
  today?: {
    completedCount?: number;
    activityTypes?: string[];
  };
};

type BrainCoachDailyPlan = {
  planId: string;
  status: "active" | "completed" | "expired";
  estimatedDurationMinutes: number;
  recommendedDomains: string[];
  activities: Array<{
    planItemId: string;
    activityType: string;
    title: string;
    domain: string;
    route: string;
    estimatedDurationMinutes: number;
    rationale: string;
    status: "recommended" | "accepted" | "started" | "completed" | "skipped";
    completedToday: boolean;
  }>;
  rationale: string[];
  completion: {
    completedCount: number;
    totalCount: number;
    allComplete: boolean;
  };
  caregiverNudge?: {
    id: string | null;
    messageType: string;
    title: string;
    body: string;
    sentAt: string | null;
    sentBy: string | null;
    status?: "unread" | "read" | "dismissed";
    isUnread?: boolean;
    readAt?: string | null;
    dismissedAt?: string | null;
  } | null;
  preferences?: {
    trainingTime?: string | null;
    sessionLengthMins?: number | null;
  };
};

function retentionNudgeStyle(tone: BrainCoachRetentionNudge["tone"]) {
  if (tone === "success") return { bg: "#ECFDF5", border: "#B7E7D1", icon: "#047857", text: "#064E3B" };
  if (tone === "restart") return { bg: "#FFF7ED", border: "#FED7AA", icon: "#B45309", text: "#7C2D12" };
  if (tone === "time") return { bg: "#EFF6FF", border: "#BFDBFE", icon: "#2563EB", text: "#1E3A8A" };
  return { bg: "#F5F3FF", border: "#DDD6FE", icon: "#6D28D9", text: "#4C1D95" };
}

const ActivitiesScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const notifiedCaregiverNudgeIdsRef = useRef<Set<string>>(new Set());
  const autoStartVoice = useRouteVoiceAutoStart();
  const { data: brainCoachProgress } = useQuery<BrainCoachProgress>({
    queryKey: ["/api/games/progress"],
    retry: false,
  });
  const { data: dailyPlan } = useQuery<BrainCoachDailyPlan>({
    queryKey: ["/api/games/daily-plan"],
    retry: false,
  });
  const todayIndex = new Date().getDay();
  const mappedToday = todayIndex === 0 ? 6 : todayIndex - 1;
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const streak = brainCoachProgress?.summary?.streakDays ?? 0;
  const completedTodayCount = brainCoachProgress?.today?.completedCount ?? 0;
  const todayActivityTypes = new Set(brainCoachProgress?.today?.activityTypes ?? []);
  const previousCompletedDays = Math.max(0, streak - (completedTodayCount > 0 ? 1 : 0));
  const caregiverNudge = dailyPlan?.caregiverNudge ?? null;
  const visibleCaregiverNudge = caregiverNudge?.status === "dismissed" ? null : caregiverNudge;
  const retentionNudges = buildBrainCoachRetentionNudges({
    completedTodayCount,
    planAllComplete: dailyPlan?.completion.allComplete,
    planCompletedCount: dailyPlan?.completion.completedCount,
    planTotalCount: dailyPlan?.completion.totalCount,
    lastPlayedAt: brainCoachProgress?.summary?.lastPlayedAt ?? null,
    preferredTrainingTime: dailyPlan?.preferences?.trainingTime ?? null,
  });

  const activityLabels: Record<string, string> = {
    "brain.activities.triviaQuiz": t("activities.trivia"),
    "brain.activities.memoryGame": t("activities.memory"),
    "brain.activities.spatialNavigator": t("activities.spatialNavigator"),
    "brain.activities.scrabble": t("activities.scrabble"),
    "brain.activities.logicPuzzle": t("activities.logicPuzzle"),
    "brain.activities.meditation": t("activities.meditation"),
    "brain.activities.breathing": t("activities.breathing"),
  };

  const primaryActivityActions: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    sub: string;
    color: string;
    bg: string;
    to: string;
    testId: string;
  }> = [
    {
      id: "memory",
      icon: BrainCircuit,
      label: t("activities.primary.memory", "Strengthen Memory"),
      sub: t("activities.primary.memorySub", "Practice recall, matching, and daily routines."),
      color: "#7C3AED",
      bg: "#F5F3FF",
      to: "/memory-games",
      testId: "button-activities-primary-memory",
    },
    {
      id: "reflexes",
      icon: Route,
      label: t("activities.primary.reflexes", "Train Reflexes"),
      sub: t("activities.primary.reflexesSub", "Build faster focus and response."),
      color: "#0A7C4E",
      bg: "#ECFDF5",
      to: "/attention-boosters",
      testId: "button-activities-primary-reflexes",
    },
    {
      id: "intelligence",
      icon: Puzzle,
      label: t("activities.primary.intelligence", "Boost Intelligence"),
      sub: t("activities.primary.intelligenceSub", "Challenge logic, planning, and problem solving."),
      color: "#C9890A",
      bg: "#FEF3C7",
      to: "/executive-function",
      testId: "button-activities-primary-intelligence",
    },
    {
      id: "senses",
      icon: Headphones,
      label: t("activities.primary.senses", "Sharpen Senses"),
      sub: t("activities.primary.sensesSub", "Reset with sound, breath, and calm attention."),
      color: "#0F766E",
      bg: "#CCFBF1",
      to: "/activities/relax-breathe",
      testId: "button-activities-primary-senses",
    },
  ];

  const activityDisplayOrder = [
    "brain.activities.memoryGame",
    "brain.activities.triviaQuiz",
    "brain.activities.logicPuzzle",
    "brain.activities.spatialNavigator",
    "brain.activities.scrabble",
    "brain.activities.meditation",
    "brain.activities.breathing",
  ];
  const orderedActivities = margaret.activities
    .slice()
    .sort((a, b) => {
      const aIndex = activityDisplayOrder.indexOf(a.name);
      const bIndex = activityDisplayOrder.indexOf(b.name);
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    });

  const handleActivityClick = (activityName: string) => {
    const destination = activityRoutes[activityName];
    if (destination) navigate(destination.to, destination.state ? { state: destination.state } : undefined);
  };

  const recordCaregiverNudgeEvent = useCallback(async (
    eventType: "caregiver_nudge_read" | "caregiver_nudge_dismissed",
    options: { invalidate?: boolean } = {},
  ) => {
    if (!dailyPlan?.planId || !caregiverNudge?.id) return false;

    try {
      const response = await apiFetch("/api/games/daily-plan/events", {
        method: "POST",
        body: JSON.stringify({
          planId: dailyPlan.planId,
          nudgeEventId: caregiverNudge.id,
          eventType,
          source: "activities_screen",
        }),
      });
      if (response.ok && options.invalidate) {
        void queryClient.invalidateQueries({ queryKey: ["/api/games/daily-plan"] });
      }
      return response.ok;
    } catch {
      return false;
    }
  }, [caregiverNudge?.id, dailyPlan?.planId, queryClient]);

  useEffect(() => {
    if (!caregiverNudge?.id || (caregiverNudge.status ?? "unread") !== "unread") return;
    if (notifiedCaregiverNudgeIdsRef.current.has(caregiverNudge.id)) return;

    notifiedCaregiverNudgeIdsRef.current.add(caregiverNudge.id);
    toast({
      title: caregiverNudge.title,
      description: caregiverNudge.body,
    });
    void recordCaregiverNudgeEvent("caregiver_nudge_read");
  }, [
    caregiverNudge?.body,
    caregiverNudge?.id,
    caregiverNudge?.status,
    caregiverNudge?.title,
    recordCaregiverNudgeEvent,
    toast,
  ]);

  const handleDismissCaregiverNudge = async () => {
    await recordCaregiverNudgeEvent("caregiver_nudge_dismissed", { invalidate: true });
  };

  const handleDailyPlanActivityClick = async (activity: BrainCoachDailyPlan["activities"][number]) => {
    if (dailyPlan?.planId && activity.planItemId && activity.status !== "completed") {
      await apiFetch("/api/games/daily-plan/events", {
        method: "POST",
        body: JSON.stringify({
          planId: dailyPlan.planId,
          planItemId: activity.planItemId,
          activityType: activity.activityType,
          eventType: "started",
          source: "activities_screen",
        }),
      }).then((response) => {
        if (response.ok) {
          void queryClient.invalidateQueries({ queryKey: ["/api/games/daily-plan"] });
        }
      }).catch(() => undefined);
    }
    navigate(activity.route);
  };

  return (
    <div className="vyva-page">
      <VoiceHero
        heroSurface="brain"
        sourceText={t("brain.voiceSource")}
        headline={<>{t("brain.headline")}</>}
        subtitle={t("brain.subtitle", { streak })}
        contextHint="brain training"
        autoStartVoice={autoStartVoice ? "brain" : false}
        showVoiceOverlay={false}
        activeLabel={t("voiceHero.endCall", "Pause listening")}
      />

      <VoiceActionFulfillmentPanel
        domain="brain_coach"
        actionTypes={["brain.activity"]}
        title="Activity context ready"
        description="VYVA can suggest a light activity and keep encouragement available while the user chooses."
        className="mt-[18px]"
      />

      {visibleCaregiverNudge && (
        <section
          className="mt-[18px] flex items-start gap-3 rounded-[22px] border p-4"
          style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
          data-testid="brain-coach-caregiver-nudge"
        >
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[14px] bg-white text-[#2563EB]">
            <Bell size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[16px] font-extrabold leading-tight text-[#1E3A8A] [overflow-wrap:anywhere]">
              {visibleCaregiverNudge.title}
            </span>
            <span className="mt-1 block font-body text-[13px] font-semibold leading-snug text-[#1E3A8A] [overflow-wrap:anywhere]">
              {visibleCaregiverNudge.body}
            </span>
          </span>
          {visibleCaregiverNudge.id && (
            <button
              type="button"
              aria-label="Dismiss caregiver nudge"
              data-testid="brain-coach-caregiver-nudge-dismiss"
              onClick={() => void handleDismissCaregiverNudge()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2563EB] shadow-sm transition-transform active:scale-[0.98]"
            >
              <X size={17} />
            </button>
          )}
        </section>
      )}

      {retentionNudges.length > 0 && (
        <section className="mt-[18px] grid gap-2">
          {retentionNudges.map((nudge) => {
            const style = retentionNudgeStyle(nudge.tone);
            return (
              <div
                key={nudge.id}
                className="flex items-start gap-3 rounded-[22px] border p-4"
                style={{ background: style.bg, borderColor: style.border }}
              >
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[14px] bg-white" style={{ color: style.icon }}>
                  {nudge.id === "completed_today" ? <CheckCircle2 size={21} /> : <Bell size={20} />}
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-[16px] font-extrabold leading-tight [overflow-wrap:anywhere]" style={{ color: style.text }}>
                    {nudge.title}
                  </span>
                  <span className="mt-1 block font-body text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]" style={{ color: style.text }}>
                    {nudge.body}
                  </span>
                </span>
              </div>
            );
          })}
        </section>
      )}

      <section className="mt-[18px]" data-testid="section-activities-primary-actions">
        <SectionTitle
          className="mb-3"
          title={t("activities.primaryTitle", "Choose your focus")}
          titleClassName="font-body text-[22px] font-extrabold not-italic"
        />
        <ResponsiveGrid columns="two" gap="sm">
          {primaryActivityActions.map((action) => (
            <ActionCard
              key={action.id}
              data-testid={action.testId}
              icon={action.icon}
              iconBg={action.bg}
              iconColor={action.color}
              title={action.label}
              description={action.sub}
              size="large"
              surface="white"
              onClick={() => navigate(action.to)}
            />
          ))}
        </ResponsiveGrid>
      </section>

      {dailyPlan && dailyPlan.activities.length > 0 && (
        <section
          className="mt-[18px] rounded-[26px] border bg-[#FFFCF8] p-[16px]"
          style={{
            borderColor: "#EDE2D1",
            boxShadow: "0 2px 10px rgba(43,31,24,0.05)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-body text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple">Today&apos;s Brain Coach Plan</p>
              <h2 className="mt-1 font-display text-[27px] leading-tight text-vyva-text-1">A short plan for today</h2>
              <p className="mt-2 font-body text-[14px] font-medium leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                {dailyPlan.rationale[0]}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#F3E8FF] px-3 py-2 text-[13px] font-extrabold text-vyva-purple">
              <Clock3 size={15} />
              {dailyPlan.estimatedDurationMinutes} min
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {dailyPlan.activities.map((activity) => (
              <button
                key={activity.activityType}
                type="button"
                onClick={() => void handleDailyPlanActivityClick(activity)}
                className="flex min-h-[74px] items-center gap-3 rounded-[20px] border bg-white px-3 py-3 text-left shadow-sm transition-transform active:scale-[0.99]"
                style={{ borderColor: "#EFE4D5" }}
              >
                <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[16px] bg-[#F3E8FF] text-vyva-purple">
                  {activity.completedToday ? <CheckCircle2 size={23} /> : <BrainCircuit size={23} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[17px] font-extrabold leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">{activity.title}</span>
                  <span className="mt-1 block font-body text-[13px] font-semibold leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">{activity.rationale}</span>
                </span>
                <span className="shrink-0 rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[12px] font-extrabold text-[#B45309]">
                  {activity.estimatedDurationMinutes} min
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {dailyPlan.recommendedDomains.map((domain) => (
              <span key={domain} className="rounded-full bg-[#EDE9FE] px-2.5 py-1 text-[12px] font-bold text-[#6D28D9]">
                {domain.replaceAll("_", " ")}
              </span>
            ))}
            <span className="rounded-full bg-[#DDF8EA] px-2.5 py-1 text-[12px] font-bold text-[#0A7C4E]">
              {dailyPlan.completion.completedCount}/{dailyPlan.completion.totalCount} done
            </span>
          </div>
        </section>
      )}

      <section
        className="mt-[18px] rounded-[26px] border bg-[#FFF9F1] p-4"
        style={{
          borderColor: "#EDE2D1",
          boxShadow: "0 2px 10px rgba(43,31,24,0.05)",
        }}
      >
        <div className="flex flex-col gap-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
          <div>
            <p className="font-body text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple">{t("brain.streakThisWeek")}</p>
            <p className="mt-1 font-display text-[30px] leading-none text-vyva-text-1">{streak}</p>
          </div>
          <div className="grid w-full grid-cols-7 gap-[5px] min-[430px]:flex min-[430px]:w-auto min-[430px]:gap-[6px]">
            {days.map((d, i) => {
              const daysAgo = mappedToday - i;
              const completed = daysAgo > 0 && daysAgo <= previousCompletedDays;
              const isToday = i === mappedToday;
              const completedToday = isToday && completedTodayCount > 0;
              return (
                <div
                  key={i}
                  className="flex h-8 min-w-0 items-center justify-center rounded-[10px] text-[12px] font-medium min-[430px]:h-[34px] min-[430px]:w-[34px]"
                  style={
                    completed || completedToday
                      ? { background: "#6B21A8", color: "#FFFFFF", boxShadow: "0 8px 18px rgba(107,33,168,0.16)" }
                      : isToday
                        ? { background: "#FFFFFF", color: "#6B21A8", border: "2px solid #6B21A8" }
                        : { background: "#FFFFFF", color: "#B5A89F", border: "1px solid #EFE4D5" }
                  }
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-[18px]">
        <SectionTitle
          title={t("activities.libraryTitle", "Choose an activity")}
          titleClassName="font-body text-[22px] font-extrabold not-italic"
        />
        <ResponsiveGrid className="mt-3" columns="two" gap="sm">
          {orderedActivities.map((act) => {
            const Icon = activityIcons[act.name] || BrainCircuit;
            const doneToday = (activityCompletionTypes[act.name] ?? []).some((activityType) => todayActivityTypes.has(activityType));
            const style = activityStyles[act.name] || {
              iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
              iconColor: "#7C3AED",
              glow: "rgba(124,58,237,0.13)",
              badgeBg: "#EDE9FE",
              badgeText: "#6D28D9",
            };

            return (
              <ActionCard
                key={act.name}
                onClick={() => handleActivityClick(act.name)}
                data-testid={`activity-card-${act.name.replaceAll(".", "-")}`}
                aria-label={activityLabels[act.name] ?? t("activities.memory")}
                title={activityLabels[act.name] ?? t("activities.memory")}
                icon={Icon}
                iconBg={style.iconBg}
                iconColor={style.iconColor}
                size="standard"
                style={{
                  borderColor: "#EDE2D1",
                  boxShadow: `0 16px 34px ${style.glow}, 0 2px 10px rgba(43,31,24,0.05)`,
                }}
                badge={doneToday ? (
                  <span
                    className="rounded-full px-2.5 py-1 font-body text-[11px] font-bold leading-tight shadow-sm"
                    style={{ background: style.badgeBg, color: style.badgeText }}
                  >
                    {t("activities.doneToday")}
                  </span>
                ) : null}
              />
            );
          })}
        </ResponsiveGrid>
      </section>

      <section
        className="mt-[18px] rounded-[26px] border bg-[#FFFCF8] p-[16px_18px]"
        style={{
          borderColor: "#EDE2D1",
          boxShadow: "0 2px 10px rgba(43,31,24,0.05)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[20px]"
            style={{ background: "linear-gradient(135deg, #E6F0FF 0%, #F3F8FF 100%)" }}
          >
            <Users size={28} strokeWidth={2.5} style={{ color: "#2F66D0" }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-body text-[21px] font-extrabold leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">{t("companions.activityTile")}</h3>
            <p className="mt-2 font-body text-[14px] font-medium leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">{t("companions.activityTileSubtitle")}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="activities-companion-actions">
          <button
            type="button"
            data-testid="button-activities-open-social-rooms"
            onClick={() => navigate("/social-rooms")}
            className="vyva-tap flex min-h-[58px] items-center gap-3 rounded-[18px] border border-[#BFDBFE] bg-white px-4 py-3 text-left shadow-[0_8px_20px_rgba(47,102,208,0.08)]"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#EFF6FF] text-[#2F66D0]">
              <MessageCircle size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">
                {t("activities.joinSocialRoom", "Join a room")}
              </span>
              <span className="block font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                {t("activities.joinSocialRoomSub", "Start a friendly conversation now.")}
              </span>
            </span>
          </button>
          <button
            type="button"
            data-testid="button-activities-open-companions"
            onClick={() => navigate("/companions")}
            className="vyva-tap flex min-h-[58px] items-center gap-3 rounded-[18px] border border-[#D8B4FE] bg-white px-4 py-3 text-left shadow-[0_8px_20px_rgba(107,33,168,0.08)]"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-vyva-purple">
              <UserRoundPlus size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">
                {t("activities.findCompanions", "Find companions")}
              </span>
              <span className="block font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                {t("activities.findCompanionsSub", "Match around interests and routines.")}
              </span>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default ActivitiesScreen;
