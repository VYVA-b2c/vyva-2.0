import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FileText,
  History,
  LineChart,
  Loader2,
  Microscope,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  CognitiveAssessmentHistoryResponse,
  CognitiveAssessmentLatestReportResponse,
  CognitiveAssessmentReport,
  CognitiveAssessmentTaskSummary,
} from "../../shared/cognitiveAssessmentReport";

const EXPECTED_REPORT_AREAS = [
  { taskId: "orientation", label: "Orientation" },
  { taskId: "story_recall_immediate", label: "Story recall" },
  { taskId: "fluency_semantic", label: "Category fluency" },
  { taskId: "fluency_phonemic", label: "Letter fluency" },
  { taskId: "digit_span", label: "Digit span" },
  { taskId: "similarities", label: "Similarities" },
  { taskId: "clock_drawing", label: "Clock drawing" },
  { taskId: "story_recall_delayed", label: "Delayed recall" },
  { taskId: "mood_screen", label: "Mood check" },
  { taskId: "sleep_energy", label: "Sleep and energy" },
  { taskId: "function_iadl", label: "Daily function" },
  { taskId: "subjective_concern", label: "Memory concern" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Not completed yet";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function completionPercent(report: CognitiveAssessmentReport) {
  if (report.totalTasks <= 0) return 0;
  return Math.round((report.tasksCompleted / report.totalTasks) * 100);
}

function completionLabel(report: CognitiveAssessmentReport) {
  const percent = completionPercent(report);
  if (percent >= 100) return "Complete baseline";
  if (percent >= 70) return "Nearly complete";
  if (percent >= 35) return "Developing snapshot";
  return "Early snapshot";
}

function completedDomains(report: CognitiveAssessmentReport) {
  return Array.from(new Set(report.sections.map((section) => section.domain).filter(Boolean)));
}

function visibleScoreLabel(section: CognitiveAssessmentTaskSummary) {
  if (section.taskId.includes("story_recall")) return null;
  return section.scoreLabel ?? null;
}

function scoreSignalCount(report: CognitiveAssessmentReport) {
  return report.sections.filter((section) => visibleScoreLabel(section)).length;
}

function remainingAreas(report: CognitiveAssessmentReport) {
  const completed = new Set(report.sections.map((section) => section.taskId));
  return EXPECTED_REPORT_AREAS.filter((area) => !completed.has(area.taskId));
}

function remainingAreaText(report: CognitiveAssessmentReport) {
  const remaining = remainingAreas(report);
  if (remaining.length === 0) return "All planned areas are represented.";
  const shown = remaining.slice(0, 3).map((area) => area.label).join(", ");
  const extra = remaining.length > 3 ? `, plus ${remaining.length - 3} more` : "";
  return `${shown}${extra}`;
}

function sectionInsight(section: CognitiveAssessmentTaskSummary) {
  if (section.taskId.includes("story_recall")) {
    return "Free recall is useful for tracking how much detail comes back without cues. Compare it with delayed recall and future checks.";
  }
  if (section.taskId.includes("fluency")) {
    return "Fluency helps show word retrieval and mental search speed. Repeating under similar conditions makes the count more meaningful.";
  }
  if (section.taskId === "digit_span") {
    return "Digit span is a quick working-memory and attention signal. Forward and backward spans tell different parts of the story.";
  }
  if (section.taskId === "similarities") {
    return "Similarities checks abstract reasoning: whether the answer names the deeper relationship, not just visible features.";
  }
  if (section.taskId === "clock_drawing") {
    return "Clock drawing brings together planning, visual layout, number placement, and instruction following.";
  }
  if (section.taskId === "orientation") {
    return "Orientation anchors the check in time and place, which helps interpret the rest of the assessment.";
  }
  if (["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"].includes(section.taskId)) {
    return "Context matters: mood, sleep, energy, daily function, and worry can all affect how memory feels day to day.";
  }
  return "This response is saved as part of the member's cognitive tracking history.";
}

function buildTakeaways(report: CognitiveAssessmentReport) {
  const remainingCount = Math.max(0, report.totalTasks - report.tasksCompleted);
  const domains = completedDomains(report);
  const scores = scoreSignalCount(report);
  const takeaways: string[] = [];

  if (remainingCount > 0) {
    takeaways.push(`${remainingCount} planned step${remainingCount === 1 ? "" : "s"} still need to be completed before this becomes a full baseline.`);
  } else {
    takeaways.push("All planned assessment areas are represented, so this can now serve as a fuller baseline.");
  }

  if (domains.length > 0) {
    takeaways.push(`Captured areas so far: ${domains.join(", ")}.`);
  }

  if (scores > 0) {
    takeaways.push(`${scores} structured score signal${scores === 1 ? "" : "s"} are available today; interpret them alongside notes and context.`);
  } else {
    takeaways.push("Most of today's value is qualitative so far: what was recalled, answered, or noted.");
  }

  takeaways.push(report.trend);
  return takeaways.slice(0, 4);
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
  const programSteps = [
    "Memory, attention, language, reasoning, and everyday function are checked in one guided flow.",
    "The report appears immediately after completion and is saved for later review.",
    "Repeating the check over time helps show whether things are stable, improving, or changing.",
  ];
  const evidencePoints = [
    "Built from established cognitive-screening domains, including story recall, verbal fluency, digit span, similarities, and clock drawing.",
    "Language content is localized across English, Spanish, German, French, and Portuguese so members can answer naturally.",
    "The result is a wellness report for tracking and conversation, not a medical diagnosis.",
  ];

  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-10">
      <header className="px-5 pt-5">
        <button
          type="button"
          onClick={() => navigate("/mind-memory")}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#2f2135] shadow-[0_8px_20px_rgba(63,45,35,0.07)]"
        >
          <ArrowLeft size={18} />
          Mind & Memory
        </button>
      </header>

      <section className="px-5 pt-4">
        <div className="rounded-[30px] border border-[#DDD6FE] bg-white p-5 shadow-[0_18px_40px_rgba(63,45,35,0.08)]">
          <span className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-[#F5F3FF] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">
            <Brain size={16} />
            Cognitive Assessment
          </span>
          <h1 className="mt-4 text-[34px] font-black leading-[1.02] text-[#2f2135]">
            A guided check for memory and thinking
          </h1>
          <p className="mt-3 text-[17px] font-bold leading-relaxed text-[#62564f]">
            VYVA walks the member through a short, structured assessment and turns the answers into a clear report that can be reviewed today and compared over time.
          </p>
          <button
            type="button"
            onClick={() => navigate("/mind-memory/cognitive-assessment/start")}
            className="mt-5 inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[17px] font-black text-white shadow-[0_12px_28px_rgba(47,33,53,0.18)]"
          >
            <PlayCircle size={20} />
            Start guided check
          </button>
          <p className="mt-3 text-center text-[12px] font-bold leading-relaxed text-[#766b63]">
            Takes about 10 to 15 minutes. No report exists yet.
          </p>
        </div>
      </section>

      <section className="grid gap-3 px-5 pt-5">
        <div className="rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_10px_24px_rgba(63,45,35,0.055)]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#EFF6FF] text-[#2563EB]">
              <ClipboardList size={23} />
            </span>
            <div>
              <h2 className="text-[21px] font-black leading-tight text-[#2f2135]">What the program checks</h2>
              <div className="mt-3 grid gap-2">
                {programSteps.map((item) => (
                  <p key={item} className="flex gap-2 text-[14px] font-bold leading-relaxed text-[#62564f]">
                    <CheckCircle2 className="mt-0.5 flex-shrink-0 text-[#059669]" size={18} />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-[#1E3A8A] shadow-[0_10px_24px_rgba(37,99,235,0.07)]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#2563EB]">
              <FileText size={23} />
            </span>
            <div>
              <h2 className="text-[21px] font-black leading-tight">The report</h2>
              <p className="mt-2 text-[14px] font-bold leading-relaxed">
                After the check, VYVA summarizes completed areas, saved answers, score-style signals where available, and practical next steps. Later visits show the latest report first, with history kept underneath.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#D9ECE4] bg-white p-4 shadow-[0_10px_24px_rgba(63,45,35,0.055)]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
              <Microscope size={23} />
            </span>
            <div>
              <h2 className="text-[21px] font-black leading-tight text-[#2f2135]">Scientific basis</h2>
              <div className="mt-3 grid gap-2">
                {evidencePoints.map((item) => (
                  <p key={item} className="text-[14px] font-bold leading-relaxed text-[#62564f]">{item}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#FED7AA] bg-[#FFF7ED] p-4 text-[#7C2D12] shadow-[0_10px_24px_rgba(194,65,12,0.055)]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#C2410C]">
              <ShieldCheck size={23} />
            </span>
            <div>
              <h2 className="text-[21px] font-black leading-tight">How to use it</h2>
              <p className="mt-2 text-[14px] font-bold leading-relaxed">
                Use the report to notice patterns and prepare better conversations with caregivers or clinicians, especially when sleep, mood, medicines, or daily function may be affecting memory.
              </p>
            </div>
          </div>
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

function MetricTile({
  icon,
  label,
  value,
  detail,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  className: string;
}) {
  return (
    <div className={`min-h-[132px] rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(63,45,35,0.055)] ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white/80">
        {icon}
      </div>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.1em] opacity-75">{label}</p>
      <p className="mt-1 text-[27px] font-black leading-none">{value}</p>
      <p className="mt-2 text-[12px] font-bold leading-snug opacity-80">{detail}</p>
    </div>
  );
}

function AssessmentAreaCard({
  section,
  index,
}: {
  section: CognitiveAssessmentTaskSummary;
  index: number;
}) {
  const score = visibleScoreLabel(section);
  const accents = [
    "border-[#DDD6FE] bg-[#FBFAFF] text-[#5B21B6]",
    "border-[#BFDBFE] bg-[#F8FBFF] text-[#1D4ED8]",
    "border-[#BBF7D0] bg-[#F7FEFA] text-[#047857]",
    "border-[#FED7AA] bg-[#FFF9F1] text-[#C2410C]",
  ];
  const accent = accents[index % accents.length];

  return (
    <div className={`rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(63,45,35,0.05)] ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.1em] opacity-75">{section.domain}</p>
          <h3 className="mt-1 text-[19px] font-black leading-tight text-[#2f2135]">{section.label}</h3>
        </div>
        {score ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black shadow-sm">
            {score}
          </span>
        ) : (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black shadow-sm">
            saved
          </span>
        )}
      </div>
      <p className="mt-3 text-[14px] font-black leading-relaxed text-[#4C4039]">{section.detail}</p>
      <p className="mt-2 text-[13px] font-bold leading-relaxed text-[#766b63]">{sectionInsight(section)}</p>
    </div>
  );
}

function ReportView({ report, title }: { report: CognitiveAssessmentReport; title: string }) {
  const navigate = useNavigate();
  const percent = completionPercent(report);
  const domains = completedDomains(report);
  const scoreSignals = scoreSignalCount(report);
  const remaining = remainingAreas(report);
  const takeaways = buildTakeaways(report);
  const snapshotCopy = report.tasksCompleted >= report.totalTasks
    ? "This report can now serve as a fuller baseline for future checks."
    : "This report is already useful, but it is still partial. Finishing the remaining areas will make the baseline stronger.";

  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <ReportHeader
        title={title}
        subtitle={`${formatDate(report.completedAt)} - ${report.tasksCompleted}/${report.totalTasks} steps saved`}
      />

      <section className="grid gap-4 px-5 pt-5">
        <div className="rounded-[30px] border border-[#DDD6FE] bg-white p-5 shadow-[0_18px_40px_rgba(63,45,35,0.08)]">
          <div className="flex items-center gap-4">
            <div
              className="flex h-[112px] w-[112px] flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#7C3AED ${percent}%, #EFE7DE ${percent}% 100%)` }}
              aria-label={`${percent}% complete`}
            >
              <div className="flex h-[82px] w-[82px] flex-col items-center justify-center rounded-full bg-white text-center">
                <span className="text-[26px] font-black leading-none text-[#2f2135]">{percent}%</span>
                <span className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#766b63]">complete</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Current snapshot</p>
              <h2 className="mt-1 text-[28px] font-black leading-[1.03] text-[#2f2135]">{completionLabel(report)}</h2>
              <p className="mt-2 text-[15px] font-bold leading-relaxed text-[#62564f]">{snapshotCopy}</p>
            </div>
          </div>
          <p className="mt-4 rounded-[20px] bg-[#F5F3FF] px-4 py-3 text-[14px] font-black leading-relaxed text-[#5B21B6]">
            {report.trend}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            icon={<ClipboardList size={22} />}
            label="Steps saved"
            value={`${report.tasksCompleted}/${report.totalTasks}`}
            detail={report.overview}
            className="border-[#DDD6FE] bg-[#F5F3FF] text-[#5B21B6]"
          />
          <MetricTile
            icon={<Activity size={22} />}
            label="Areas touched"
            value={`${domains.length}`}
            detail={domains.length ? domains.join(", ") : "No domains yet"}
            className="border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
          />
          <MetricTile
            icon={<BarChart3 size={22} />}
            label="Score signals"
            value={`${scoreSignals}`}
            detail="Structured counts or scores available today"
            className="border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
          />
          <MetricTile
            icon={<Target size={22} />}
            label="Still missing"
            value={`${remaining.length}`}
            detail={remaining.length ? remainingAreaText(report) : "Ready for comparison later"}
            className="border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]"
          />
        </div>

        <div className="rounded-[26px] border border-[#D9ECE4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
              <Sparkles size={23} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[23px] font-black leading-tight text-[#2f2135]">Key takeaways</h2>
              <div className="mt-3 grid gap-3">
                {takeaways.map((takeaway) => (
                  <p key={takeaway} className="flex gap-2 text-[14px] font-bold leading-relaxed text-[#62564f]">
                    <CheckCircle2 className="mt-0.5 flex-shrink-0 text-[#059669]" size={18} />
                    <span>{takeaway}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {remaining.length > 0 ? (
          <div className="rounded-[26px] border border-[#FDE68A] bg-[#FFFBEB] p-5 text-[#78350F] shadow-[0_12px_28px_rgba(146,64,14,0.06)]">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#B45309]">
                <CircleAlert size={23} />
              </span>
              <div>
                <h2 className="text-[22px] font-black leading-tight">What would make this more useful</h2>
                <p className="mt-2 text-[14px] font-bold leading-relaxed">
                  Complete the remaining areas next: {remainingAreaText(report)}. That will make future changes easier to compare.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3">
          <h2 className="px-1 text-[24px] font-black leading-tight text-[#2f2135]">Assessment areas</h2>
          {report.sections.map((section, index) => (
            <AssessmentAreaCard key={`${section.taskId}-${section.label}`} section={section} index={index} />
          ))}
        </div>

        <div className="rounded-[26px] border border-[#BFDBFE] bg-[#EFF6FF] p-5 text-[#1E3A8A] shadow-[0_12px_28px_rgba(37,99,235,0.07)]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#2563EB]">
              <LineChart size={23} />
            </span>
            <div>
              <h2 className="text-[22px] font-black leading-tight">Next best actions</h2>
              <div className="mt-3 grid gap-2">
                {report.recommendations.map((recommendation) => (
                  <p key={recommendation} className="text-[14px] font-bold leading-relaxed">{recommendation}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-[#6B21A8]">
              <Microscope size={23} />
            </span>
            <div>
              <h2 className="text-[22px] font-black leading-tight text-[#2f2135]">How to interpret this</h2>
              <p className="mt-2 text-[14px] font-bold leading-relaxed text-[#62564f]">
                A single check is a snapshot, not a verdict. The most useful signal comes from repeated checks done in similar conditions, especially alongside sleep, mood, medicines, and daily routine.
              </p>
            </div>
          </div>
        </div>

        {report.sections.length === 0 ? (
          <div className="rounded-[24px] border border-[#E8DED4] bg-white p-5 text-[15px] font-bold text-[#766b63]">
            No assessment areas have been saved in this report yet.
          </div>
        ) : null}

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => navigate("/mind-memory/cognitive-assessment/start")}
            className="flex min-h-[68px] w-full items-center justify-between rounded-[22px] bg-[#2f2135] px-4 text-left text-white shadow-[0_10px_24px_rgba(63,45,35,0.12)]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/12 text-white">
                <PlayCircle size={23} />
              </span>
              <span>
                <span className="block text-[17px] font-black">{remaining.length ? "Continue the check" : "Start a new check"}</span>
                <span className="block text-[13px] font-bold text-white/80">{remaining.length ? "Complete the missing areas" : "Update this report later"}</span>
              </span>
            </span>
            <ChevronRight size={24} className="text-white/80" />
          </button>

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
                <span className="block text-[13px] font-bold text-[#766b63]">Past checks and trends</span>
              </span>
            </span>
            <ChevronRight size={24} className="text-[#9A8F87]" />
          </button>
        </div>

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
