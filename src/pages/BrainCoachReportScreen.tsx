import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Clock3,
  Flame,
  Gamepad2,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import {
  HealthWizardCard,
  HealthWizardHero,
  HealthWizardSectionLabel,
  HealthWizardShell,
  HealthWizardTopBar,
} from "@/components/health/HealthWizard";
import { useToast } from "@/hooks/use-toast";
import type { BrainCoachProgress, BrainCoachSession } from "@/lib/brainCoachReport";
import {
  activityLabel,
  brainCoachCompletionLabel,
  buildBrainCoachNarrative,
  buildBrainCoachNextSteps,
  buildBrainCoachShareText,
  domainLabel,
  formatBrainCoachAccuracy,
  formatBrainCoachDate,
  formatBrainCoachDuration,
  formatBrainCoachTime,
  hasBrainCoachData,
  strongestBrainCoachDomain,
} from "@/lib/brainCoachReport";

type StatTileProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone: "purple" | "green" | "amber" | "blue";
  testId?: string;
};

const statTone = {
  purple: { bg: "#F5F3FF", text: "#6B21A8", border: "#DDD6FE" },
  green: { bg: "#ECFDF5", text: "#047857", border: "#BBF7D0" },
  amber: { bg: "#FFFBEB", text: "#B45309", border: "#FED7AA" },
  blue: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
};

function StatTile({ icon: Icon, label, value, sub, tone, testId }: StatTileProps) {
  const colors = statTone[tone];
  return (
    <div
      data-testid={testId}
      className="rounded-[24px] border bg-white p-4 shadow-[0_10px_24px_rgba(63,45,35,0.06)]"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[16px]" style={{ background: colors.bg, color: colors.text }}>
          <Icon size={20} />
        </span>
        <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-text-2">{label}</p>
      </div>
      <p className="mt-4 font-body text-[30px] font-black leading-none text-vyva-text-1">{value}</p>
      {sub ? <p className="mt-2 font-body text-[13px] font-bold leading-snug text-vyva-text-2">{sub}</p> : null}
    </div>
  );
}

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
      className={`vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] px-5 py-3 font-body text-[15px] font-black ${classes}`}
    >
      <Icon size={19} />
      <span>{children}</span>
    </button>
  );
}

function RecentSessionRow({ session }: { session: BrainCoachSession }) {
  const time = formatBrainCoachTime(session.playedAt);
  return (
    <li className="flex items-center gap-3 border-b border-[#EFE7DD] py-3 last:border-b-0">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
        <Gamepad2 size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[15px] font-black text-vyva-text-1">{activityLabel(session.activityType)}</p>
        <p className="font-body text-[12px] font-bold text-vyva-text-2">
          {formatBrainCoachDate(session.playedAt)}{time ? `, ${time}` : ""} · {domainLabel(session.domain)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-body text-[16px] font-black text-vyva-text-1">{session.score ?? 0}</p>
        <p className="font-body text-[11px] font-bold text-vyva-text-2">{formatBrainCoachAccuracy(session.accuracyPct)}</p>
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
  const strongestDomain = strongestBrainCoachDomain(progress);
  const nextSteps = buildBrainCoachNextSteps(progress);
  const recentSessions = (progress?.history ?? []).slice(0, 6);
  const domains = (progress?.domains ?? []).slice(0, 4);
  const completedToday = progress?.today?.completedCount ?? 0;
  const lastPlayed = summary?.lastPlayedAt ? formatBrainCoachDate(summary.lastPlayedAt) : t("reports.brainCoach.notYet", "Not yet");

  const copySummary = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(buildBrainCoachShareText(progress));
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

  return (
    <HealthWizardShell
      testId="brain-coach-report-shell"
      contentClassName="max-w-[1120px] px-4 pb-36 sm:px-6 lg:px-8 lg:pb-16"
    >
      <HealthWizardTopBar
        title={t("reports.brainCoach.title", "Brain Coach report")}
        kicker={t("informes.title", "Reports")}
        onBack={() => navigate("/informes")}
        backLabel={t("informes.back", "Back")}
        action={(
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-vyva-purple shadow-sm">
            <BrainCircuit size={22} />
          </span>
        )}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-[24px] bg-white shadow-[0_8px_24px_rgba(63,45,35,0.06)]" />
          ))}
        </div>
      ) : null}

      {!isLoading && isError ? (
        <HealthWizardCard tone="red" testId="brain-coach-report-error">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-body text-[18px] font-black">{t("reports.brainCoach.errorTitle", "Brain Coach report did not load")}</p>
              <p className="mt-1 font-body text-[14px] font-bold opacity-80">{t("reports.brainCoach.errorSub", "Try again when the connection is steady.")}</p>
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
            icon={<Sparkles size={25} />}
            kicker={t("reports.brainCoach.kicker", "Games and practice")}
            title={hasData ? brainCoachCompletionLabel(progress) : t("reports.brainCoach.emptyTitle", "Ready for your first game")}
            body={buildBrainCoachNarrative(progress)}
            className="mt-2"
          >
            <div className="grid gap-3 border-t border-white/20 pt-4 sm:grid-cols-3">
              <div>
                <p className={`font-body text-[24px] font-black ${hasData ? "text-white" : "text-vyva-text-1"}`}>{summary?.streakDays ?? 0}</p>
                <p className={`font-body text-[12px] font-bold ${hasData ? "text-white/75" : "text-vyva-text-2"}`}>{t("reports.brainCoach.currentStreak", "Current streak")}</p>
              </div>
              <div>
                <p className={`font-body text-[24px] font-black ${hasData ? "text-white" : "text-vyva-text-1"}`}>{formatBrainCoachDuration(summary?.totalDurationSeconds ?? 0)}</p>
                <p className={`font-body text-[12px] font-bold ${hasData ? "text-white/75" : "text-vyva-text-2"}`}>{t("reports.brainCoach.practiceTime", "Practice time")}</p>
              </div>
              <div>
                <p className={`font-body text-[24px] font-black ${hasData ? "text-white" : "text-vyva-text-1"}`}>{lastPlayed}</p>
                <p className={`font-body text-[12px] font-bold ${hasData ? "text-white/75" : "text-vyva-text-2"}`}>{t("reports.brainCoach.lastPlayed", "Last played")}</p>
              </div>
            </div>
          </HealthWizardHero>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="brain-coach-report-stats">
            <StatTile
              icon={CheckCircle2}
              label={t("reports.brainCoach.completed", "Completed")}
              value={summary?.completedSessions ?? 0}
              sub={t("reports.brainCoach.completedSub", "Finished games")}
              tone="green"
              testId="brain-coach-stat-completed"
            />
            <StatTile
              icon={Flame}
              label={t("reports.brainCoach.streak", "Streak")}
              value={summary?.streakDays ?? 0}
              sub={t("reports.brainCoach.bestStreak", "Best {{count}} days", { count: summary?.bestStreakDays ?? 0 })}
              tone="amber"
              testId="brain-coach-stat-streak"
            />
            <StatTile
              icon={Clock3}
              label={t("reports.brainCoach.time", "Time")}
              value={formatBrainCoachDuration(summary?.totalDurationSeconds ?? 0)}
              sub={completedToday > 0 ? t("reports.brainCoach.todayDone", "{{count}} today", { count: completedToday }) : t("reports.brainCoach.todayNone", "None today")}
              tone="blue"
              testId="brain-coach-stat-time"
            />
            <StatTile
              icon={Trophy}
              label={t("reports.brainCoach.strongest", "Strongest")}
              value={strongestDomain ? domainLabel(strongestDomain.domain) : "--"}
              sub={strongestDomain ? t("reports.brainCoach.bestScore", "Best score {{score}}", { score: strongestDomain.bestScore }) : t("reports.brainCoach.morePractice", "More practice needed")}
              tone="purple"
              testId="brain-coach-stat-strongest"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ReportActionButton icon={Clipboard} onClick={copySummary} variant="secondary" testId="button-copy-brain-coach-report">
              {t("reports.brainCoach.copy", "Copy summary")}
            </ReportActionButton>
            <ReportActionButton icon={Gamepad2} onClick={() => navigate("/mind-memory")} testId="button-start-brain-coach-games">
              {hasData ? t("reports.brainCoach.practice", "Practice now") : t("reports.brainCoach.start", "Start a game")}
            </ReportActionButton>
          </div>

          <HealthWizardSectionLabel className="mt-7">{t("reports.brainCoach.nextTitle", "Next best steps")}</HealthWizardSectionLabel>
          <HealthWizardCard tone="green" testId="brain-coach-next-steps">
            <ul className="grid gap-3 md:grid-cols-3">
              {nextSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white font-body text-[13px] font-black text-[#047857]">
                    {index + 1}
                  </span>
                  <p className="font-body text-[15px] font-black leading-snug text-[#064E3B]">{step}</p>
                </li>
              ))}
            </ul>
          </HealthWizardCard>

          <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <section>
              <HealthWizardSectionLabel>{t("reports.brainCoach.areasTitle", "Areas practiced")}</HealthWizardSectionLabel>
              <div className="grid gap-3 sm:grid-cols-2" data-testid="brain-coach-domain-grid">
                {domains.length > 0 ? domains.map((domain) => (
                  <HealthWizardCard key={domain.domain} tone="white" testId={`brain-coach-domain-${domain.domain}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-[17px] font-black text-vyva-text-1">{domainLabel(domain.domain)}</p>
                        <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">{domain.completedSessions} completed</p>
                      </div>
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#EFF6FF] text-[#1D4ED8]">
                        <Target size={18} />
                      </span>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#EFE7DD] pt-4">
                      <div>
                        <p className="font-body text-[12px] font-bold text-vyva-text-2">{t("reports.brainCoach.best", "Best")}</p>
                        <p className="font-body text-[24px] font-black text-vyva-text-1">{domain.bestScore}</p>
                      </div>
                      <p className="font-body text-[13px] font-bold text-vyva-text-2">{formatBrainCoachDuration(domain.totalDurationSeconds)}</p>
                    </div>
                  </HealthWizardCard>
                )) : (
                  <HealthWizardCard tone="white" className="sm:col-span-2" testId="brain-coach-domain-empty">
                    <p className="font-body text-[16px] font-black text-vyva-text-1">{t("reports.brainCoach.noAreasYet", "No practice areas yet")}</p>
                    <p className="mt-1 font-body text-[14px] font-bold text-vyva-text-2">{t("reports.brainCoach.noAreasSub", "Finish one game and VYVA will start grouping your practice.")}</p>
                  </HealthWizardCard>
                )}
              </div>
            </section>

            <section>
              <HealthWizardSectionLabel>{t("reports.brainCoach.recentTitle", "Recent games")}</HealthWizardSectionLabel>
              <HealthWizardCard tone="white" testId="brain-coach-recent-sessions">
                {recentSessions.length > 0 ? (
                  <ul>
                    {recentSessions.map((session, index) => (
                      <RecentSessionRow key={session.id ?? `${session.activityType}-${session.playedAt}-${index}`} session={session} />
                    ))}
                  </ul>
                ) : (
                  <div className="py-4 text-center">
                    <BarChart2 className="mx-auto text-vyva-purple/55" size={28} />
                    <p className="mt-3 font-body text-[15px] font-black text-vyva-text-1">{t("reports.brainCoach.noRecent", "No games recorded yet")}</p>
                    <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">{t("reports.brainCoach.noRecentSub", "Your recent games will appear here.")}</p>
                  </div>
                )}
              </HealthWizardCard>
            </section>
          </div>

          <section className="mt-5 rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] p-4">
            <div className="flex items-start gap-3">
              <CalendarDays size={18} className="mt-0.5 flex-shrink-0 text-[#1D4ED8]" />
              <p className="font-body text-[12px] font-bold leading-relaxed text-[#1E3A8A]">
                {t("reports.brainCoach.note", "This report shows practice patterns only. It is not a diagnosis or medical assessment.")}
              </p>
            </div>
          </section>
        </>
      ) : null}
    </HealthWizardShell>
  );
}
