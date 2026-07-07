import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  PlayCircle,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/queryClient";
import {
  COGNITIVE_ASSESSMENT_PROGRAM_FREQUENCIES,
  cognitiveAssessmentFrequencyLabel,
  type CognitiveAssessmentProgramFrequency,
  type CognitiveAssessmentProgramJoinResponse,
  type CognitiveAssessmentProgramStatusResponse,
} from "../../shared/cognitiveAssessmentProgram";

const PROGRAM_QUERY_KEY = ["/api/cognitive-assessment/program"] as const;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not scheduled yet";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No report yet";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function setupSummary(frequency: CognitiveAssessmentProgramFrequency) {
  if (frequency === "weekly") return "A short check each week.";
  if (frequency === "every_2_weeks") return "A balanced check every two weeks.";
  return "A calm monthly rhythm for tracking change.";
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/mind-memory")}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#2f2135] shadow-[0_8px_20px_rgba(63,45,35,0.07)]"
    >
      <ArrowLeft size={18} />
      Mind & Memory
    </button>
  );
}

function HubShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-10">
      <header className="mx-auto w-full max-w-[980px] px-5 pt-5 md:px-7">
        <BackButton />
      </header>
      {children}
    </main>
  );
}

function ProgramSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(todayInputValue);
  const [frequency, setFrequency] = useState<CognitiveAssessmentProgramFrequency>("monthly");
  const [reminderTime, setReminderTime] = useState("10:00");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [error, setError] = useState("");
  const frequencyLabel = cognitiveAssessmentFrequencyLabel(frequency);

  const joinMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/cognitive-assessment/program/join", {
        method: "POST",
        body: JSON.stringify({ startDate, frequency, reminderTime, timezone }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Cognitive Assessment program could not be joined.");
      }
      return response.json() as Promise<CognitiveAssessmentProgramJoinResponse>;
    },
    onSuccess: (data) => {
      setError("");
      queryClient.setQueryData(PROGRAM_QUERY_KEY, data.program);
      void queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEY });
    },
    onError: (joinError) => {
      setError(joinError instanceof Error ? joinError.message : "Cognitive Assessment program could not be joined.");
    },
  });

  return (
    <HubShell>
      <section className="mx-auto w-full max-w-[980px] px-5 pt-5 md:px-7">
        <div className="rounded-[30px] border border-[#DDD6FE] bg-white p-5 shadow-[0_18px_40px_rgba(63,45,35,0.08)] md:p-6">
          <span className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-[#F5F3FF] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">
            <Brain size={16} />
            Cognitive Assessment
          </span>
          <h1 className="mt-4 text-[34px] font-black leading-[1.02] text-[#2f2135] md:text-[44px]">
            Set up a regular memory and thinking check
          </h1>
          <p className="mt-3 max-w-[46rem] text-[17px] font-bold leading-relaxed text-[#62564f]">
            A 10 to 15 minute guided check creates a saved report and trend view over time.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { icon: Clock3, title: "10-15 min", detail: "Short guided flow" },
              { icon: BarChart3, title: "Trends", detail: "Compare over time" },
              { icon: ShieldCheck, title: "Not diagnosis", detail: "Tracking signals only" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-[20px] border border-[#E8DED4] bg-[#FFFCF8] p-4">
                  <Icon size={22} className="text-[#6B21A8]" />
                  <p className="mt-3 text-[18px] font-black text-[#2f2135]">{item.title}</p>
                  <p className="mt-1 text-[13px] font-bold text-[#766b63]">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-[28px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Program setup</p>
              <h2 className="mt-1 text-[27px] font-black leading-tight text-[#2f2135]">{frequencyLabel}</h2>
              <p className="mt-1 text-[14px] font-bold text-[#766b63]">{setupSummary(frequency)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="min-h-[54px] w-full rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] px-4 text-[15px] font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">Frequency</span>
              <select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as CognitiveAssessmentProgramFrequency)}
                className="min-h-[54px] w-full rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] px-4 text-[15px] font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              >
                {COGNITIVE_ASSESSMENT_PROGRAM_FREQUENCIES.map((option) => (
                  <option key={option} value={option}>{cognitiveAssessmentFrequencyLabel(option)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">Reminder time</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(event) => setReminderTime(event.target.value)}
                className="min-h-[54px] w-full rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] px-4 text-[15px] font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">Timezone</span>
              <input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="min-h-[54px] w-full rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] px-4 text-[15px] font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <button
              type="button"
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              className="inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[17px] font-black text-white disabled:opacity-60"
            >
              {joinMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
              Join program
            </button>
            <button
              type="button"
              onClick={() => navigate("/mind-memory")}
              className="inline-flex min-h-[54px] items-center justify-center rounded-[18px] border border-[#E8DED4] bg-white px-5 text-sm font-black text-[#2f2135]"
            >
              Maybe later
            </button>
          </div>
        </div>
      </section>
    </HubShell>
  );
}

function ActiveProgram({ program }: { program: CognitiveAssessmentProgramStatusResponse }) {
  const navigate = useNavigate();
  const enrollment = program.enrollment;
  const latestReport = program.latestReport;
  const unfinished = program.latestUnfinishedSession;
  const continuePath = unfinished
    ? `/mind-memory/cognitive-assessment/start?sessionId=${encodeURIComponent(unfinished.sessionId)}`
    : "/mind-memory/cognitive-assessment/start";
  const reportPath = latestReport
    ? `/mind-memory/cognitive-assessment/report/${encodeURIComponent(latestReport.sessionId)}`
    : "/mind-memory/cognitive-assessment/report";

  return (
    <HubShell>
      <section className="mx-auto w-full max-w-[980px] px-5 pt-5 md:px-7">
        <div className="rounded-[30px] border border-[#DDD6FE] bg-white p-5 shadow-[0_18px_40px_rgba(63,45,35,0.08)] md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-[#ECFDF5] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#047857]">
                <CheckCircle2 size={16} />
                Active
              </span>
              <h1 className="mt-4 text-[34px] font-black leading-[1.02] text-[#2f2135] md:text-[44px]">
                Cognitive Assessment
              </h1>
              <p className="mt-3 max-w-[42rem] text-[16px] font-bold leading-relaxed text-[#62564f]">
                Keep your memory and thinking report up to date with regular checks.
              </p>
            </div>
            <div className="rounded-[22px] border border-[#D9ECE4] bg-[#ECFDF5] px-4 py-3 text-[#047857] md:min-w-[220px]">
              <p className="text-xs font-black uppercase tracking-[0.1em]">Next reminder</p>
              <p className="mt-1 text-[20px] font-black leading-tight">{formatDateTime(enrollment?.nextRunAt)}</p>
              <p className="mt-2 text-xs font-bold">{cognitiveAssessmentFrequencyLabel(enrollment?.frequency ?? "monthly")}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InfoTile icon={<CalendarDays size={22} />} label="Schedule" value={cognitiveAssessmentFrequencyLabel(enrollment?.frequency ?? "monthly")} detail={`${enrollment?.reminderTime ?? "10:00"} local time`} />
            <InfoTile icon={<FileText size={22} />} label="Latest report" value={formatDate(latestReport?.completedAt)} detail={latestReport ? `${latestReport.tasksCompleted}/${latestReport.totalTasks} steps saved` : "Complete a check first"} />
            <InfoTile icon={<RotateCw size={22} />} label="History" value={`${program.completedReportCount}`} detail={program.completedReportCount === 1 ? "saved report" : "saved reports"} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-[28px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)] md:grid-cols-[1fr_1fr]">
          <button
            type="button"
            onClick={() => navigate(continuePath)}
            className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[17px] font-black text-white"
          >
            <PlayCircle size={21} />
            {unfinished ? "Continue check" : "Start check"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (latestReport) navigate(reportPath);
            }}
            disabled={!latestReport}
            className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-[20px] border border-[#DDD6FE] bg-[#F5F3FF] px-5 text-[17px] font-black text-[#5B21B6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BarChart3 size={21} />
            View report
          </button>
          {!latestReport ? (
            <p className="md:col-span-2 rounded-[18px] bg-[#FFFCF8] px-4 py-3 text-sm font-bold text-[#766b63]">
              No saved report yet. Finish one check to unlock trends and history.
            </p>
          ) : null}
        </div>
      </section>
    </HubShell>
  );
}

function InfoTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#E8DED4] bg-[#FFFCF8] p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white text-[#6B21A8]">{icon}</span>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">{label}</p>
      <p className="mt-1 text-[19px] font-black leading-tight text-[#2f2135]">{value}</p>
      <p className="mt-1 text-[13px] font-bold text-[#766b63]">{detail}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <HubShell>
      <section className="mx-auto w-full max-w-[980px] px-5 pt-5 md:px-7">
        <div className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-[#E8DED4] bg-white">
          <span className="inline-flex items-center gap-3 text-sm font-black text-[#2f2135]">
            <Loader2 className="animate-spin" size={20} />
            Loading program
          </span>
        </div>
      </section>
    </HubShell>
  );
}

export default function CognitiveAssessmentHubPage() {
  const programQuery = useQuery<CognitiveAssessmentProgramStatusResponse>({
    queryKey: PROGRAM_QUERY_KEY,
    refetchOnMount: "always",
  });
  const program = programQuery.data;

  const content = useMemo(() => {
    if (programQuery.isLoading) return <LoadingState />;
    if (programQuery.isError) return <ProgramSetup />;
    if (program?.joined) return <ActiveProgram program={program} />;
    return <ProgramSetup />;
  }, [program, programQuery.isError, programQuery.isLoading]);

  return content;
}
