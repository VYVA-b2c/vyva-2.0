import { ArrowLeft, Brain, CalendarDays, ChevronRight, ClipboardList, History, Loader2, PlayCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  CognitiveAssessmentHistoryResponse,
  CognitiveAssessmentLatestReportResponse,
  CognitiveAssessmentReport,
} from "../../shared/cognitiveAssessmentReport";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not completed yet";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ReportHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const navigate = useNavigate();
  return (
    <header className="px-5 pt-5">
      <button
        type="button"
        onClick={() => navigate("/mind-memory")}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#2f2135] shadow-[0_8px_20px_rgba(63,45,35,0.07)]"
      >
        <ArrowLeft size={18} />
        Mind & Memory
      </button>
      <div className="mt-5 rounded-[28px] border border-[#DDD6FE] bg-white p-5 shadow-[0_14px_32px_rgba(63,45,35,0.07)]">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-[#6B21A8]">
            <Brain size={30} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Cognitive Assessment</p>
            <h1 className="mt-1 text-[32px] font-black leading-[1.02] text-[#2f2135]">{title}</h1>
            <p className="mt-2 text-[16px] font-bold leading-snug text-[#766b63]">{subtitle}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <ReportHeader
        title="Ready when you are"
        subtitle="Your latest report will appear here after the first completed check."
      />
      <section className="px-5 pt-5">
        <div className="rounded-[26px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#EFF6FF] text-[#2563EB]">
              <PlayCircle size={26} />
            </span>
            <div>
              <h2 className="text-[22px] font-black leading-tight text-[#2f2135]">No saved report yet</h2>
              <p className="mt-2 text-[15px] font-bold leading-relaxed text-[#766b63]">
                Start a guided check now. The report will appear here as soon as the assessment is complete.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/mind-memory/cognitive-assessment/start")}
            className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[16px] font-black text-white"
          >
            <PlayCircle size={20} />
            Start assessment
          </button>
        </div>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F2EB] p-6">
      <div className="flex items-center gap-3 rounded-[22px] border border-[#E8DED4] bg-white px-5 py-4 text-sm font-black text-[#2f2135] shadow-[0_12px_28px_rgba(63,45,35,0.07)]">
        <Loader2 className="animate-spin" size={20} />
        Loading report
      </div>
    </main>
  );
}

function ErrorState() {
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <ReportHeader
        title="Report unavailable"
        subtitle="The Cognitive Assessment report could not be loaded right now."
      />
      <section className="px-5 pt-5">
        <div className="rounded-[26px] border border-[#FECACA] bg-white p-5 text-[15px] font-bold leading-relaxed text-[#991B1B] shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          Try again in a moment. If this keeps happening, the assessment database setup needs attention.
        </div>
      </section>
    </main>
  );
}

function ReportView({ report, title }: { report: CognitiveAssessmentReport; title: string }) {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <ReportHeader
        title={title}
        subtitle={`${formatDate(report.completedAt)} - ${report.tasksCompleted}/${report.totalTasks} steps saved`}
      />

      <section className="grid gap-4 px-5 pt-5">
        <div className="rounded-[26px] border border-[#D9ECE4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#ECFDF5] text-[#047857]">
              <ClipboardList size={25} />
            </span>
            <div>
              <h2 className="text-[22px] font-black leading-tight text-[#2f2135]">Current summary</h2>
              <p className="mt-2 text-[15px] font-bold leading-relaxed text-[#766b63]">{report.overview}</p>
              <p className="mt-3 rounded-[18px] bg-[#F5F3FF] px-4 py-3 text-[14px] font-black text-[#5B21B6]">{report.trend}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-[#E8DED4] bg-white p-4 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <h2 className="px-1 text-[22px] font-black leading-tight text-[#2f2135]">Assessment areas</h2>
          <div className="mt-3 grid gap-2.5">
            {report.sections.map((section) => (
              <div key={`${section.taskId}-${section.label}`} className="rounded-[20px] border border-[#EFE7DE] bg-[#FFFCF8] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[16px] font-black leading-tight text-[#2f2135]">{section.label}</p>
                    <p className="mt-1 text-[13px] font-bold text-[#766b63]">{section.domain} - {section.detail}</p>
                  </div>
                  {section.scoreLabel ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#6B21A8] shadow-sm">
                      {section.scoreLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-[#BFDBFE] bg-[#EFF6FF] p-5 text-[#1E3A8A] shadow-[0_12px_28px_rgba(37,99,235,0.07)]">
          <h2 className="text-[22px] font-black leading-tight">Next steps</h2>
          <ul className="mt-3 grid gap-2">
            {report.recommendations.map((recommendation) => (
              <li key={recommendation} className="text-[14px] font-bold leading-relaxed">{recommendation}</li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => navigate("/mind-memory/cognitive-assessment/history")}
          className="flex min-h-[64px] w-full items-center justify-between rounded-[22px] border border-[#E8DED4] bg-white px-4 text-left shadow-[0_10px_24px_rgba(63,45,35,0.055)]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF7ED] text-[#B45309]">
              <History size={23} />
            </span>
            <span>
              <span className="block text-[17px] font-black text-[#2f2135]">Report history</span>
              <span className="block text-[13px] font-bold text-[#766b63]">Past checks</span>
            </span>
          </span>
          <ChevronRight size={24} className="text-[#9A8F87]" />
        </button>

        <button
          type="button"
          onClick={() => navigate("/mind-memory/cognitive-assessment/start")}
          className="flex min-h-[64px] w-full items-center justify-between rounded-[22px] bg-[#2f2135] px-4 text-left text-white shadow-[0_10px_24px_rgba(63,45,35,0.12)]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/12 text-white">
              <PlayCircle size={23} />
            </span>
            <span>
              <span className="block text-[17px] font-black">Start a new check</span>
              <span className="block text-[13px] font-bold text-white/80">Update this report</span>
            </span>
          </span>
          <ChevronRight size={24} className="text-white/80" />
        </button>

        <p className="px-1 text-[12px] font-bold leading-relaxed text-[#766b63]">{report.disclaimer}</p>
      </section>
    </main>
  );
}

function HistoryView({ history }: { history: CognitiveAssessmentHistoryResponse["history"] }) {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <ReportHeader title="Report history" subtitle="Past Mind & Memory checks stay available here." />
      <section className="grid gap-3 px-5 pt-5">
        {history.length === 0 ? (
          <div className="rounded-[24px] border border-[#E8DED4] bg-white p-5 text-[15px] font-bold text-[#766b63]">
            No completed checks yet.
          </div>
        ) : history.map((item) => (
          <button
            key={item.sessionId}
            type="button"
            onClick={() => navigate(`/mind-memory/cognitive-assessment/report/${item.sessionId}`)}
            className="flex min-h-[76px] items-center justify-between rounded-[22px] border border-[#E8DED4] bg-white px-4 text-left shadow-[0_10px_24px_rgba(63,45,35,0.055)]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-[#6B21A8]">
                <CalendarDays size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-black text-[#2f2135]">{formatDate(item.completedAt)}</span>
                <span className="block truncate text-[13px] font-bold text-[#766b63]">{item.tasksCompleted}/{item.totalTasks} steps - {item.language}</span>
              </span>
            </span>
            <ChevronRight size={24} className="text-[#9A8F87]" />
          </button>
        ))}
      </section>
    </main>
  );
}

export default function CognitiveAssessmentReportPage() {
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const isHistory = location.pathname.endsWith("/history");
  const reportUrl = sessionId
    ? `/api/cognitive-assessment/reports/${sessionId}`
    : "/api/cognitive-assessment/latest-report";
  const reportQuery = useQuery<CognitiveAssessmentLatestReportResponse>({
    queryKey: [reportUrl],
    enabled: !isHistory,
    refetchOnMount: "always",
  });
  const historyQuery = useQuery<CognitiveAssessmentHistoryResponse>({
    queryKey: ["/api/cognitive-assessment/history"],
    enabled: isHistory,
    refetchOnMount: "always",
  });

  if (reportQuery.isLoading || historyQuery.isLoading) return <LoadingState />;
  if (reportQuery.isError || historyQuery.isError) return <ErrorState />;
  if (isHistory) {
    return <HistoryView history={historyQuery.data?.history ?? []} />;
  }

  const report = reportQuery.data?.report ?? null;
  if (!report || location.pathname.endsWith("/start")) return <EmptyState />;
  return <ReportView report={report} title={sessionId ? "Saved report" : "Latest report"} />;
}
