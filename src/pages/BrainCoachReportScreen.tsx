import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  BookOpen,
  CalendarDays,
  Compass,
  Ear,
  Gauge,
  Gamepad2,
  Leaf,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  Play,
  RefreshCw,
  Share,
  Target,
  type LucideIcon,
} from "lucide-react";
import {
  HealthWizardCard,
  HealthWizardHero,
} from "@/components/health/HealthWizard";
import { HomeMasterDetailShell } from "@/components/health/HomeMasterDetailShell";
import { CanonicalVoiceButton } from "@/components/CanonicalDetailFlowShell";
import { useToast } from "@/hooks/use-toast";
import { areaForDomain, type BrainCoachArea } from "../../shared/brainCoachAreas";
import type { BrainCoachProgress, BrainCoachSession } from "@/lib/brainCoachReport";
import {
  activityLabel,
  buildBrainCoachNarrative,
  buildBrainCoachNextSteps,
  buildBrainCoachShareText,
  domainLabel,
  hasBrainCoachData,
} from "@/lib/brainCoachReport";

const AREA_ORDER: BrainCoachArea[] = ["memory", "attention", "executive_function", "language", "processing_speed", "spatial_navigation", "sensory", "knowledge"];
const AREA_ICONS: Record<BrainCoachArea, LucideIcon> = {
  memory: Lightbulb,
  attention: Target,
  executive_function: ListChecks,
  language: MessageSquareText,
  processing_speed: Gauge,
  spatial_navigation: Compass,
  sensory: Ear,
  knowledge: BookOpen,
};
const STATUS_STYLES = {
  above: "bg-[#DCFCE7] text-[#14532D]",
  usual: "bg-[#EDE9FE] text-[#4C1D95]",
  below: "bg-[#FEF3C7] text-[#78350F]",
} as const;
const STATUS_FALLBACK = {
  above: "Higher than usual",
  usual: "Usual for you",
  below: "Lower than usual",
  building: "Learning your usual level",
} as const;

function ReportActionButton({
  icon: Icon,
  children,
  onClick,
  variant = "primary",
  testId,
}: {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
  testId?: string;
}) {
  const classes = variant === "primary"
    ? "bg-vyva-purple text-white shadow-[0_14px_30px_rgba(107,33,168,0.22)]"
    : "border border-[#DDD6FE] bg-white text-vyva-purple shadow-sm";

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`vyva-tap inline-flex min-h-[72px] w-full items-center justify-center gap-3 rounded-[22px] px-6 py-4 font-body text-[22px] font-extrabold ${classes}`}
    >
      <Icon size={24} />
      <span>{children}</span>
    </button>
  );
}

function recentSessionDateLabel(iso: string | null | undefined, locale: string, t: ReturnType<typeof useTranslation>["t"]) {
  if (!iso) return "";
  const playedAt = new Date(iso);
  if (Number.isNaN(playedAt.getTime())) return "";

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfPlayedDay = new Date(playedAt.getFullYear(), playedAt.getMonth(), playedAt.getDate());
  const dayDifference = Math.round((startOfToday.getTime() - startOfPlayedDay.getTime()) / 86_400_000);
  const date = dayDifference === 0
    ? t("reports.brainCoach.today", "Today")
    : dayDifference === 1
      ? t("reports.brainCoach.yesterday", "Yesterday")
      : new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          ...(playedAt.getFullYear() === today.getFullYear() ? {} : { year: "numeric" as const }),
        }).format(playedAt);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(playedAt);
  return `${date}, ${time}`;
}

function RecentSessionRow({ session }: { session: BrainCoachSession }) {
  const { t, i18n } = useTranslation();
  const area = areaForDomain(session.domain) ?? session.domain;
  const dateTime = recentSessionDateLabel(session.playedAt, i18n.resolvedLanguage ?? i18n.language ?? "en", t);
  return (
    <li className="flex items-center gap-4 border-b border-[#EFE7DD] py-5 last:border-b-0">
      <span className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-vyva-purple">
        <Gamepad2 size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-body text-[22px] font-extrabold leading-tight text-vyva-text-1">{activityLabel(session.activityType)}</p>
        <p className="mt-1 font-body text-[20px] font-semibold leading-snug text-vyva-text-2">
          {dateTime} · {t(`reports.brainCoach.areas.${area}`, domainLabel(area))}
        </p>
      </div>
    </li>
  );
}

export default function BrainCoachReportScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: progress, isLoading, isError, refetch } = useQuery<BrainCoachProgress>({
    queryKey: ["/api/games/progress"],
    retry: false,
  });

  const summary = progress?.summary;
  const hasData = hasBrainCoachData(progress);
  const nextSteps = buildBrainCoachNextSteps(progress, t);
  const recentSessions = (progress?.history ?? []).slice(0, 3);
  const performance = progress?.performance;
  const wholeMinutes = Math.max(0, Math.round((summary?.totalDurationSeconds ?? 0) / 60));
  const performanceByArea = new Map((performance?.areas ?? []).map((item) => [item.area, item]));
  const orderedAreas = (progress?.domains ?? [])
    .map((domain) => {
      const area = (areaForDomain(domain.domain) ?? domain.domain) as BrainCoachArea;
      return { domain, area, performance: performanceByArea.get(area) };
    })
    .sort((left, right) => {
      const statusOrder = Number(!left.performance) - Number(!right.performance);
      return statusOrder || AREA_ORDER.indexOf(left.area) - AREA_ORDER.indexOf(right.area);
    });

  const copySummary = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(buildBrainCoachShareText(progress, t));
      toast({
        title: t("reports.brainCoach.copyDone", "Brain Coach summary copied"),
        description: t("reports.brainCoach.copyDoneSub", "Ready to share when you need it."),
      });
    } catch {
      toast({
        title: t("reports.brainCoach.copyFailed", "Could not copy the summary"),
        description: t("reports.brainCoach.copyFailedSub", "Please try again in a moment."),
        variant: "destructive",
      });
    }
  };

  const shareSummary = async () => {
    const text = buildBrainCoachShareText(progress, t);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Fall through to the clipboard when native sharing is interrupted.
      }
    }
    await copySummary();
  };

  return (
    <HomeMasterDetailShell
      title={t("reports.brainCoach.title", "Brain Coach report")}
      onBack={() => navigate("/informes")}
      backLabel={t("informes.back", "Back")}
      testId="brain-coach-report-shell"
      action={(
        <CanonicalVoiceButton
          label={t("common.talkToVyva", "Talk to VYVA")}
          contextHint={t("reports.brainCoach.voiceContext", "Help me understand my Brain Coach report and choose what to practice next.")}
          agentSlug="brain-coach"
          dynamicVariables={{ app_entrypoint: "brain_coach_report" }}
          testId="button-brain-coach-report-voice"
        />
      )}
    >
      <div className="pb-[calc(136px+env(safe-area-inset-bottom))]">
        {isLoading ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-[28px] bg-white/90" />)}
          </div>
        ) : null}

        {!isLoading && isError ? (
          <HealthWizardCard tone="red" testId="brain-coach-report-error">
            <div className="flex flex-col gap-5">
              <div>
                <p className="font-body text-[24px] font-extrabold">{t("reports.brainCoach.errorTitle", "Brain Coach report did not load")}</p>
                <p className="mt-2 font-body text-[20px] font-semibold opacity-80">{t("reports.brainCoach.errorSub", "Try again when the connection is steady.")}</p>
              </div>
              <ReportActionButton icon={RefreshCw} onClick={() => refetch()} variant="secondary" testId="button-retry-brain-coach-report">
                {t("reports.brainCoach.retry", "Try again")}
              </ReportActionButton>
            </div>
          </HealthWizardCard>
        ) : null}

        {!isLoading && !isError ? (
          <>
            <HealthWizardHero
              tone={hasData ? "purple" : "light"}
              title={hasData ? buildBrainCoachNarrative(progress, t) : t("reports.brainCoach.emptyTitle", "Ready for your first game")}
              body={hasData ? undefined : buildBrainCoachNarrative(progress, t)}
            >
              {hasData ? (
                <div className="grid grid-cols-3 gap-3 border-t border-white/20 pt-5" data-testid="brain-coach-facts">
                  {[
                    [summary?.completedSessions ?? 0, t("reports.brainCoach.factGames", "games")],
                    [summary?.streakDays ?? 0, t("reports.brainCoach.factStreak", "day streak")],
                    [wholeMinutes, t("reports.brainCoach.factMinutes", "minutes")],
                  ].map(([value, label]) => (
                    <div key={String(label)}>
                      <p className="font-body text-[30px] font-extrabold leading-none text-white">{value}</p>
                      <p className="mt-2 font-body text-[20px] font-semibold leading-tight text-white/85">{label}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </HealthWizardHero>

            <section className="mt-8" data-testid="brain-coach-performance">
              <h2 className="font-display text-[26px] font-semibold text-vyva-text-1">{t("reports.brainCoach.thinkingTitle", "Your thinking areas")}</h2>
              {performance ? <p className="mt-2 font-body text-[20px] font-semibold text-vyva-text-2">{t("reports.brainCoach.comparedNote", "Compared only with your own recent games.")}</p> : null}
              <HealthWizardCard tone="white" className="mt-4 overflow-hidden !p-0">
                {orderedAreas.length > 0 ? (
                  <div className="divide-y divide-[#EFE7DD]">
                    {orderedAreas.map(({ domain, area, performance: areaPerformance }) => {
                      const Icon = AREA_ICONS[area] ?? Target;
                      const status = areaPerformance?.status ?? (performance ? "building" : undefined);
                      return (
                        <div key={domain.domain} className="flex items-center gap-4 p-5" data-testid={"brain-coach-performance-" + area}>
                          <span className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-vyva-purple"><Icon size={25} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="font-body text-[24px] font-extrabold leading-tight text-vyva-text-1">{t("reports.brainCoach.areas." + area, domainLabel(area))}</p>
                            <p className="mt-1 font-body text-[20px] font-semibold text-vyva-text-2">{t("reports.brainCoach.gamesCount", { count: domain.completedSessions })}</p>
                            {status === "building" ? (
                              <p className="mt-2 font-body text-[20px] font-semibold leading-tight text-vyva-text-2">{t("reports.brainCoach.status.building", STATUS_FALLBACK.building)}</p>
                            ) : status ? (
                              <span className={"mt-3 inline-flex rounded-full px-4 py-2 font-body text-[20px] font-extrabold leading-tight " + STATUS_STYLES[status]}>{t("reports.brainCoach.status." + status, STATUS_FALLBACK[status])}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {(performance?.relaxationMinutes ?? 0) > 0 ? (
                      <div className="flex items-center gap-4 p-5">
                        <span className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[18px] bg-[#ECFDF5] text-[#14532D]"><Leaf size={25} /></span>
                        <p className="font-body text-[20px] font-bold text-vyva-text-1">{t("reports.brainCoach.relaxationThisWeek", "Relaxation this week: {{count}} min", { count: performance.relaxationMinutes })}</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="p-5 font-body text-[20px] font-semibold text-vyva-text-2">{t("reports.brainCoach.noAreasSub", "Finish one game and VYVA will start grouping your practice.")}</p>
                )}
              </HealthWizardCard>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-[26px] font-semibold text-vyva-text-1">{t("reports.brainCoach.nextTitle", "Next best steps")}</h2>
              <HealthWizardCard tone="white" className="mt-4" testId="brain-coach-next-steps">
                <ul className="space-y-5">
                  {nextSteps.map((step, index) => (
                    <li key={step} className="flex items-start gap-4">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F5F3FF] font-body text-[20px] font-extrabold text-vyva-purple">{index + 1}</span>
                      <p className="pt-1 font-body text-[21px] font-bold leading-snug text-vyva-text-1">{step}</p>
                    </li>
                  ))}
                </ul>
              </HealthWizardCard>
            </section>

            <div className="mt-8 space-y-3">
              <ReportActionButton icon={Play} onClick={() => navigate("/mind-memory")} testId="button-start-brain-coach-games">
                {hasData ? t("reports.brainCoach.practice", "Practice now") : t("reports.brainCoach.start", "Start a game")}
              </ReportActionButton>
              {hasData ? (
                <ReportActionButton icon={Share} onClick={() => void shareSummary()} variant="secondary" testId="button-copy-brain-coach-report">
                  {t("reports.brainCoach.shareFamily", "Share with family")}
                </ReportActionButton>
              ) : null}
            </div>

            <section className="mt-8">
              <h2 className="font-display text-[26px] font-semibold text-vyva-text-1">{t("reports.brainCoach.recentTitle", "Recent games")}</h2>
              <HealthWizardCard tone="white" className="mt-4" testId="brain-coach-recent-sessions">
                {recentSessions.length > 0 ? (
                  <ul>{recentSessions.map((session, index) => <RecentSessionRow key={session.id ?? session.activityType + "-" + session.playedAt + "-" + index} session={session} />)}</ul>
                ) : (
                  <div className="py-4 text-center">
                    <BarChart2 className="mx-auto text-vyva-purple/55" size={34} />
                    <p className="mt-3 font-body text-[22px] font-extrabold text-vyva-text-1">{t("reports.brainCoach.noRecent", "No games recorded yet")}</p>
                    <p className="mt-2 font-body text-[20px] font-semibold text-vyva-text-2">{t("reports.brainCoach.noRecentSub", "Your recent games will appear here.")}</p>
                  </div>
                )}
              </HealthWizardCard>
            </section>

            <section className="mt-8 rounded-[24px] border border-[#BFDBFE] bg-[#EFF6FF] p-5">
              <div className="flex items-start gap-4">
                <CalendarDays size={24} className="mt-0.5 flex-shrink-0 text-[#1D4ED8]" />
                <p className="font-body text-[20px] font-semibold leading-relaxed text-[#1E3A8A]">{t("reports.brainCoach.note", "This report shows practice patterns only. It is not a diagnosis or medical assessment.")}</p>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </HomeMasterDetailShell>
  );
}
