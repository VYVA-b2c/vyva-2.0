import { useCallback, useEffect, useRef } from "react";
import {
  Bell,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Headphones,
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CuratedEventsExperience from "@/social/CuratedEventsExperience";

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

const ActivitiesScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const notifiedCaregiverNudgeIdsRef = useRef<Set<string>>(new Set());

  const { data: brainCoachProgress } = useQuery<BrainCoachProgress>({
    queryKey: ["/api/games/progress"],
    retry: false,
  });
  const { data: dailyPlan } = useQuery<BrainCoachDailyPlan>({
    queryKey: ["/api/games/daily-plan"],
    retry: false,
  });

  const streak = brainCoachProgress?.summary?.streakDays ?? 0;
  const completedTodayCount = brainCoachProgress?.today?.completedCount ?? 0;
  const caregiverNudge = dailyPlan?.caregiverNudge ?? null;
  const visibleCaregiverNudge = caregiverNudge?.status === "dismissed" ? null : caregiverNudge;

  const quickActivityActions: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    sub: string;
    mobileLabel: string;
    mobileSub: string;
    to: string;
    iconBg: string;
    iconColor: string;
    border: string;
    testId: string;
  }> = [
    {
      id: "play",
      icon: BrainCircuit,
      label: t("activities.quick.play", "Play a Brain Game"),
      sub: t("activities.quick.playSub", "Practice memory and focus."),
      mobileLabel: t("activities.quick.playMobile", "Play"),
      mobileSub: t("activities.quick.playSubMobile", "Brain games"),
      to: "/memory-games",
      iconBg: "#EFF6FF",
      iconColor: "#2563EB",
      border: "#BFDBFE",
      testId: "button-activities-quick-play",
    },
    {
      id: "learn",
      icon: BookOpen,
      label: t("activities.quick.learn", "Learn Something New"),
      sub: t("activities.quick.learnSub", "Try words, language, and recall."),
      mobileLabel: t("activities.quick.learnMobile", "Learn"),
      mobileSub: t("activities.quick.learnSubMobile", "Words and recall"),
      to: "/language",
      iconBg: "#F5F3FF",
      iconColor: "#7C3AED",
      border: "#D8B4FE",
      testId: "button-activities-quick-learn",
    },
    {
      id: "relax",
      icon: Headphones,
      label: t("activities.quick.relax", "Relax & Breathe"),
      sub: t("activities.quick.relaxSub", "Take a calm guided pause."),
      mobileLabel: t("activities.quick.relaxMobile", "Relax"),
      mobileSub: t("activities.quick.relaxSubMobile", "Calm pause"),
      to: "/activities/relax-breathe",
      iconBg: "#CCFBF1",
      iconColor: "#0F766E",
      border: "#99F6E4",
      testId: "button-activities-quick-relax",
    },
  ];

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

  const brainCoachStrip = (
    <section
      className="mt-8 rounded-[28px] border border-[#EDE2D1] bg-[#FFFCF8] p-5 shadow-[0_14px_32px_rgba(60,38,20,0.07)]"
      data-testid="activities-brain-coach-strip"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
            {t("activities.quick.kicker", "Brain Coach")}
          </p>
          <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
            A short mind plan if you want it
          </h2>
        </div>
        <p className="max-w-[28rem] font-body text-[14px] font-bold leading-relaxed text-vyva-text-2">
          Memory, focus, and calm exercises stay here as a gentle second option.
        </p>
      </div>

      {visibleCaregiverNudge && (
        <section
          className="mt-4 flex items-start gap-3 rounded-[22px] border p-4"
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

      <section
        className="mt-4 flex items-center gap-3 rounded-[22px] border border-[#EDE2D1] bg-white px-4 py-3"
        data-testid="brain-coach-progress-summary"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-vyva-purple">
          <BrainCircuit size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
            {t("brain.progressSummary", "Brain Coach progress")}
          </span>
          <span className="mt-0.5 block truncate font-body text-[15px] font-extrabold text-vyva-text-1">
            {streak > 0
              ? t("brain.progressStreak", "{{count}} day streak", { count: streak })
              : t("brain.progressStart", "Start with one short activity")}
          </span>
        </span>
        {completedTodayCount > 0 && (
          <span className="shrink-0 rounded-full bg-[#D1FAE5] px-3 py-1 font-body text-[12px] font-black text-[#047857]">
            {t("brain.doneTodayShort", "Today done")}
          </span>
        )}
      </section>

      {dailyPlan && dailyPlan.activities.length > 0 && (
        <section
          className="mt-4 rounded-[24px] border bg-white p-4"
          style={{ borderColor: "#EDE2D1", boxShadow: "0 2px 10px rgba(43,31,24,0.04)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-body text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple">
                Today's Brain Coach Plan
              </p>
              <h2 className="mt-1 font-display text-[27px] leading-tight text-vyva-text-1">
                A short plan for today
              </h2>
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
                key={activity.planItemId}
                type="button"
                onClick={() => void handleDailyPlanActivityClick(activity)}
                className="flex min-h-[74px] items-center gap-3 rounded-[20px] border bg-white px-3 py-3 text-left shadow-sm transition-transform active:scale-[0.99]"
                style={{ borderColor: "#EFE4D5" }}
              >
                <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[16px] bg-[#F3E8FF] text-vyva-purple">
                  {activity.completedToday ? <CheckCircle2 size={23} /> : <BrainCircuit size={23} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[17px] font-extrabold leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">
                    {activity.title}
                  </span>
                  <span className="mt-1 block font-body text-[13px] font-semibold leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                    {activity.rationale}
                  </span>
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

      <section className="mt-4" data-testid="activities-quick-actions">
        <div className="mb-3">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
            {t("activities.quick.kicker", "Brain Coach")}
          </p>
          <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
            {t("activities.chooseActivity", "Choose an activity")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {quickActivityActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={action.testId}
                aria-label={action.label}
                onClick={() => navigate(action.to)}
                className="vyva-tap flex min-h-[82px] w-full items-center gap-4 rounded-[22px] border bg-white px-4 py-4 text-left transition-transform hover:-translate-y-0.5"
                style={{ borderColor: action.border }}
              >
                <span
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]"
                  style={{ background: action.iconBg, color: action.iconColor }}
                >
                  <Icon size={22} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">
                    <span className="sm:hidden">{action.mobileLabel}</span>
                    <span className="hidden sm:inline">{action.label}</span>
                  </span>
                  <span className="mt-1 block max-w-[24rem] font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                    <span className="sm:hidden">{action.mobileSub}</span>
                    <span className="hidden sm:inline">{action.sub}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );

  return <CuratedEventsExperience variant="activities" afterEvents={brainCoachStrip} />;
};

export default ActivitiesScreen;
