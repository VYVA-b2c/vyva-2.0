import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Share2, CheckCircle, AlertTriangle, Eye, ClipboardList, FileText, PhoneCall, Stethoscope } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VitalsScan from "@/components/VitalsScan";
import TriageChat from "@/components/TriageChat";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, queryClient } from "@/lib/queryClient";

type Step = "intro" | "vitals" | "chat" | "report";

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  aiSummary?: string;
}

type ReportSaveState = "idle" | "saving" | "saved" | "error";

type TriageHealthMemory = {
  healthContext?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  latestVitals?: string;
  latestSymptomReport?: string;
};

type TriageContextResponse = {
  memory: TriageHealthMemory;
  usedItems: string[];
};

type ProfileContactsResponse = {
  caregiverName?: string | null;
  caregiverContact?: string | null;
  gpName?: string | null;
  gpPhone?: string | null;
} | null;

type SavedTriageReport = {
  id?: string;
  chief_complaint?: string;
  symptoms?: string[];
  urgency?: TriageSummary["urgency"];
  recommendations?: string[];
  disclaimer?: string;
  ai_summary?: string | null;
  bpm?: number | null;
  respiratory_rate?: number | null;
  duration_seconds?: number | null;
  created_at?: string;
};

function StepDots({ current, includeVitals }: { current: Step; includeVitals: boolean }) {
  const steps: Step[] = includeVitals ? ["vitals", "chat", "report"] : ["chat", "report"];
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-2 justify-center">
      {steps.map((s, i) => (
        <div
          key={s}
          className="rounded-full transition-all"
          style={{
            width: i === idx ? 20 : 8,
            height: 8,
            background: i <= idx ? "hsl(var(--vyva-purple))" : "hsl(var(--vyva-warm2))",
          }}
        />
      ))}
    </div>
  );
}

function IntroScreen({
  onStartWithVitals,
  onStartWithoutVitals,
}: {
  onStartWithVitals: () => void;
  onStartWithoutVitals: () => void;
}) {
  const { t } = useTranslation();
  const choices = [
    {
      id: "with-vitals",
      title: t("health.symptomCheck.intro.withVitalsCta", "Check my vitals first"),
      className: "border-[#6B21A8] bg-white text-vyva-text-1",
      onClick: onStartWithVitals,
    },
    {
      id: "without-vitals",
      title: t("health.symptomCheck.intro.withoutVitalsCta", "Skip vitals"),
      className: "border-[#E8DED4] bg-white text-vyva-text-1",
      onClick: onStartWithoutVitals,
    },
  ];

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 px-[22px] py-8">
      <section className="text-left">
        <p className="font-body text-[15px] font-extrabold uppercase tracking-[0.12em] text-vyva-purple">
          {t("health.symptomCheck.intro.stepLabel", "Symptom check")}
        </p>
        <h1 className="mt-3 max-w-[340px] font-body text-[30px] font-bold leading-[1.08] text-vyva-text-1">
          {t("health.symptomCheck.intro.choiceTitle", "How do you want to start?")}
        </h1>
      </section>

      <div className="grid gap-4">
        {choices.map(({ id, title, className, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            data-testid={`button-symptom-check-${id}`}
            className={`vyva-tap flex min-h-[88px] items-center rounded-[22px] border px-5 text-left transition active:scale-[0.99] ${className}`}
          >
            <span className="min-w-0 flex-1 font-body text-[22px] font-bold leading-tight">
              {title}
            </span>
            <ChevronLeft size={22} className={`rotate-180 ${id === "with-vitals" ? "text-vyva-purple" : "text-vyva-text-3"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function UrgencyConfig(urgency: TriageSummary["urgency"]) {
  if (urgency === "urgent") {
    return {
      bg: "linear-gradient(135deg, #B91C1C 0%, #EF4444 100%)",
      icon: AlertTriangle,
      label: "health.symptomCheck.report.urgentLabel",
      pillBg: "rgba(255,255,255,0.25)",
    };
  }
  if (urgency === "routine") {
    return {
      bg: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
      icon: Eye,
      label: "health.symptomCheck.report.routineLabel",
      pillBg: "rgba(255,255,255,0.25)",
    };
  }
  return {
    bg: "linear-gradient(135deg, #0A7C4E 0%, #10B981 100%)",
    icon: CheckCircle,
    label: "health.symptomCheck.report.monitorLabel",
    pillBg: "rgba(255,255,255,0.25)",
  };
}

function ReportScreen({
  summary,
  bpm,
  respiratoryRate,
  durationSeconds,
  reportId,
  reportSaveState,
  profileContacts,
  onDone,
}: {
  summary: TriageSummary;
  bpm: number | null;
  respiratoryRate: number | null;
  durationSeconds: number | null;
  reportId: string | null;
  reportSaveState: ReportSaveState;
  profileContacts?: ProfileContactsResponse;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const cfg = UrgencyConfig(summary.urgency);
  const UrgencyIcon = cfg.icon;
  const saveStatusText = reportSaveState === "saved"
    ? t("health.symptomCheck.report.savedToReports", "Saved to Reports")
    : reportSaveState === "saving"
      ? t("health.symptomCheck.report.savingReport", "Saving report...")
      : reportSaveState === "error"
        ? t("health.symptomCheck.report.saveFailed", "Report not saved")
        : t("health.symptomCheck.report.readyReport", "Report ready");
  const durationText = durationSeconds != null
    ? durationSeconds < 60
      ? `${durationSeconds}s`
      : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
    : null;
  const doctorContactName = profileContacts?.gpName?.trim() || (profileContacts?.gpPhone?.trim() ? t("health.symptomCheck.report.doctorContact", "your doctor") : "");
  const caregiverContactName = profileContacts?.caregiverName?.trim() || (profileContacts?.caregiverContact?.trim() ? t("health.symptomCheck.report.caregiverContact", "your caregiver") : "");
  const notifiedContacts = [
    doctorContactName ? { id: "doctor", label: doctorContactName } : null,
    caregiverContactName ? { id: "caregiver", label: caregiverContactName } : null,
  ].filter(Boolean) as Array<{ id: string; label: string }>;
  const notifiedText = notifiedContacts.length === 2
    ? t("health.symptomCheck.report.sentToBoth", "A copy of this report has been sent to {{first}} and {{second}}.", {
        first: notifiedContacts[0].label,
        second: notifiedContacts[1].label,
      })
    : notifiedContacts.length === 1
      ? t("health.symptomCheck.report.sentToOne", "A copy of this report has been sent to {{contact}}.", {
          contact: notifiedContacts[0].label,
        })
      : "";
  const doctorNote = [
    summary.chiefComplaint,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Resp. Rate")}: ${respiratoryRate} rpm` : "",
    `${t("health.symptomCheck.report.urgencyLabel", "Urgency")}: ${t(cfg.label)}`,
    summary.recommendations.length ? `${t("health.symptomCheck.report.recommendations", "What to do next")}: ${summary.recommendations.join(" ")}` : "",
  ].filter(Boolean).join("\n");
  const openDoctorWithContext = () => {
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: doctorNote,
      },
    });
  };

  const shareText = [
    t("health.symptomCheck.report.shareTitle"),
    "",
    `${t("health.symptomCheck.report.chiefComplaint")}: ${summary.chiefComplaint}`,
    bpm != null ? `${t("health.symptomCheck.scan.heartRate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Resp. Rate")}: ${respiratoryRate} rpm` : "",
    durationText ? `${t("health.symptomCheck.report.timeTaken", "Time taken")}: ${durationText}` : "",
    "",
    `${t("health.symptomCheck.report.urgencyLabel")}: ${t(cfg.label)}`,
    "",
    t("health.symptomCheck.report.recommendations") + ":",
    ...summary.recommendations.map((r, i) => `${i + 1}. ${r}`),
    "",
    t("health.symptomCheck.report.disclaimer"),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("health.symptomCheck.report.shareTitle"), text: shareText });
        return;
      } catch {
        /* user cancelled or not supported */
      }
    }
    const copied = await navigator.clipboard.writeText(shareText).then(() => true).catch(() => false);
    if (copied) {
      toast({
        title: t("health.symptomCheck.report.copiedToast"),
        description: t("health.symptomCheck.report.copiedToastDesc"),
      });
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div
        className="mx-[18px] mb-4 mt-4 flex flex-col gap-3 rounded-[30px] p-5 shadow-[0_16px_36px_rgba(91,18,160,0.18)]"
        style={{ background: cfg.bg }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px]"
            style={{ background: "rgba(255,255,255,0.22)" }}
          >
            <UrgencyIcon size={24} className="text-white" />
          </div>
          <div>
            <p className="font-body text-[12px] font-medium text-white/75 uppercase tracking-wider">
              {t("health.symptomCheck.report.urgencyLabel")}
            </p>
            <p className="font-display text-[28px] italic leading-tight text-white">
              {t(cfg.label)}
            </p>
          </div>
        </div>

        <p className="font-body text-[15px] text-white/90 leading-relaxed">
          {summary.chiefComplaint}
        </p>

        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 self-start"
          style={{ background: cfg.pillBg }}
        >
          <Heart size={13} className="text-white" />
          <span className="font-body text-[13px] text-white font-semibold">
            {bpm != null ? `${bpm} bpm` : `${t("health.symptomCheck.scan.heartRate")}: —`}
          </span>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 self-start"
          style={{ background: cfg.pillBg }}
        >
          <ClipboardList size={13} className="text-white" />
          <span className="font-body text-[13px] text-white font-semibold">
            {saveStatusText}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-[18px] pb-6">
        {notifiedText && (
          <div className="flex items-start gap-3 rounded-[24px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-[#047857] shadow-[0_8px_24px_rgba(63,45,35,0.05)]">
            <CheckCircle size={24} className="mt-0.5 flex-shrink-0" />
            <p className="font-body text-[18px] font-extrabold leading-snug">
              {notifiedText}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {summary.urgency === "urgent" ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = "tel:112";
              }}
              data-testid="button-report-emergency"
              className="vyva-tap col-span-2 flex min-h-[96px] items-center justify-between rounded-[24px] bg-[#DC2626] p-5 text-left text-white shadow-[0_16px_36px_rgba(220,38,38,0.28)]"
            >
              <span className="flex items-center gap-3">
                <PhoneCall size={26} />
                <span className="font-body text-[20px] font-black leading-tight">
                  {t("health.symptomCheck.report.callEmergency", "Call emergency services")}
                </span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openDoctorWithContext}
              data-testid="button-report-doctor"
              className="vyva-tap col-span-2 flex min-h-[96px] items-center justify-between rounded-[24px] bg-[#6B21A8] p-5 text-left text-white shadow-[0_16px_36px_rgba(107,33,168,0.24)]"
            >
              <span className="flex items-center gap-3">
                <Stethoscope size={26} />
                <span className="font-body text-[20px] font-black leading-tight">
                  {t("health.symptomCheck.report.callDoctor", "Talk to a real doctor")}
                </span>
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(reportId ? `/informes/${reportId}` : "/informes")}
            data-testid="button-report-view-reports"
            className="vyva-tap flex min-h-[92px] flex-col justify-between rounded-[24px] bg-[#EFF6FF] p-4 text-left text-[#1D4ED8] shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
          >
            <ClipboardList size={22} />
            <span className="font-body text-[16px] font-extrabold leading-tight">
              {t("health.symptomCheck.report.viewReports", "View reports")}
            </span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            data-testid="button-report-share-quick"
            className="vyva-tap flex min-h-[92px] flex-col justify-between rounded-[24px] bg-[#ECFDF5] p-4 text-left text-[#047857] shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
          >
            <Share2 size={22} />
            <span className="font-body text-[16px] font-extrabold leading-tight">
              {t("health.symptomCheck.report.shareBtn", "Share Report")}
            </span>
          </button>
        </div>

        {summary.symptoms.length > 0 && (
          <div
            className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
          >
            <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
              {t("health.symptomCheck.report.symptoms")}
            </p>
            <ul className="flex flex-wrap gap-2">
              {summary.symptoms.map((s, i) => (
                <li key={i} className="rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[13px] font-bold text-[#6B21A8]">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
        >
          <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
            {t("health.symptomCheck.report.recommendations")}
          </p>
          <ol className="flex flex-col gap-3">
            {summary.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-body text-[12px] font-bold text-white"
                  style={{ background: "hsl(var(--vyva-purple))" }}
                >
                  {i + 1}
                </span>
                <span className="font-body text-[15px] text-vyva-text-1 leading-relaxed pt-0.5">{rec}</span>
              </li>
            ))}
          </ol>
        </div>

        <div
          className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
              <FileText size={20} />
            </span>
            <div>
              <p className="font-body text-[12px] font-semibold uppercase tracking-wider text-vyva-text-3">
                {t("health.symptomCheck.report.doctorNoteTitle", "Doctor-ready note")}
              </p>
              <p className="font-body text-[13px] font-semibold text-vyva-text-2">
                {t("health.symptomCheck.report.doctorNoteSub", "Plain text to read, show, or share.")}
              </p>
            </div>
          </div>
          <p className="whitespace-pre-line rounded-[18px] bg-[#FAF7F3] p-4 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-1">
            {doctorNote}
          </p>
        </div>

        <button
          onClick={handleShare}
          data-testid="button-report-share"
          className="vyva-primary-action w-full"
        >
          <Share2 size={18} />
          {t("health.symptomCheck.report.shareBtn")}
        </button>

        <button
          onClick={onDone}
          data-testid="button-report-done"
          className="vyva-secondary-action w-full"
        >
          {t("health.symptomCheck.report.doneBtn")}
        </button>

        <p className="font-body text-[11px] text-vyva-text-3 text-center leading-relaxed px-2">
          {t("health.symptomCheck.report.disclaimer")}
        </p>
      </div>
    </div>
  );
}

export default function SymptomCheckScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: triageContext } = useQuery<TriageContextResponse>({
    queryKey: ["/api/triage/context"],
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const { data: profileContacts } = useQuery<ProfileContactsResponse>({
    queryKey: ["/api/profile"],
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const [step, setStep] = useState<Step>("intro");
  const [bpm, setBpm] = useState<number | null>(null);
  const [respiratoryRate, setRespiratoryRate] = useState<number | null>(null);
  const [chatStartTime, setChatStartTime] = useState<number | null>(null);
  const [chatEntryMode, setChatEntryMode] = useState<"vitals" | "direct">("vitals");
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [summary, setSummary] = useState<TriageSummary | null>(null);
  const [reportSaveState, setReportSaveState] = useState<ReportSaveState>("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  const stepTitle: Record<Step, string> = {
    intro: t("health.symptomCheck.title"),
    vitals: t("health.symptomCheck.scan.title"),
    chat: t("health.symptomCheck.chat.title"),
    report: t("health.symptomCheck.report.title"),
  };

  const handleBack = () => {
    if (step === "intro") {
      navigate("/health");
    } else if (step === "vitals") {
      setStep("intro");
    } else if (step === "chat") {
      setStep(chatEntryMode === "direct" ? "intro" : "vitals");
    } else {
      navigate("/health");
    }
  };

  const handleScanComplete = (detectedBpm: number | null, detectedResp: number | null) => {
    setBpm(detectedBpm);
    setRespiratoryRate(detectedResp);
    setChatStartTime(Date.now());
    setChatEntryMode("vitals");
    setAutoStartVoice(false);
    setStep("chat");
  };

  const startChatDirectly = (withVoice = false) => {
    setChatStartTime(Date.now());
    setChatEntryMode("direct");
    setAutoStartVoice(withVoice);
    setStep("chat");
  };

  const handleChatComplete = (triageSummary: TriageSummary) => {
    const durationSeconds = chatStartTime
      ? Math.round((Date.now() - chatStartTime) / 1000)
      : null;
    setDurationSeconds(durationSeconds);
    setSummary(triageSummary);
    setReportId(null);
    setReportSaveState("saving");
    setStep("report");
    apiFetch("/api/reports/triage", {
      method: "POST",
      body: JSON.stringify({
        chief_complaint: triageSummary.chiefComplaint,
        symptoms: triageSummary.symptoms,
        urgency: triageSummary.urgency,
        recommendations: triageSummary.recommendations,
        disclaimer: triageSummary.disclaimer,
        ai_summary: triageSummary.aiSummary ?? null,
        bpm: bpm ?? null,
        respiratory_rate: respiratoryRate ?? null,
        duration_seconds: durationSeconds,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const saved = await res.json().catch(() => null) as SavedTriageReport | null;
        setReportId(saved?.id ?? null);
        setReportSaveState("saved");
        queryClient.invalidateQueries({ queryKey: ["/api/reports/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] });
        if (saved) {
          queryClient.setQueryData(["/api/reports/summary"], (current: unknown) => ({
            ...(current && typeof current === "object" ? current : {}),
            latestTriage: saved,
          }));
          if (saved.id) {
            queryClient.setQueryData([`/api/reports/triage/${saved.id}`], saved);
          }
        }
      })
      .catch((err) => {
        console.error("[reports/triage] save failed:", err);
        setReportSaveState("error");
      });
  };

  return (
    <div className="flex min-h-[calc(100vh-204px)] w-full flex-col overflow-hidden bg-transparent">
      <div
        className="flex flex-shrink-0 items-center px-[18px] py-3"
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top))",
          borderBottom: step !== "intro" ? "1px solid hsl(var(--vyva-border))" : "none",
        }}
      >
        <button
          onClick={handleBack}
          data-testid="button-symptom-check-back"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(63,45,35,0.08)] transition-all active:scale-95"
        >
          <ChevronLeft size={20} style={{ color: "hsl(var(--vyva-text-1))" }} />
        </button>

        <div className="flex-1 text-center min-w-0">
          <p className="font-display text-[23px] italic leading-tight text-vyva-text-1">
            {stepTitle[step]}
          </p>
        </div>

        <div className="w-9 h-9 flex-shrink-0" />
      </div>

      {step !== "intro" && (
        <div className="flex-shrink-0 py-3" style={{ borderBottom: "1px solid hsl(var(--vyva-border))" }}>
          <StepDots current={step} includeVitals={chatEntryMode !== "direct"} />
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-4">
          <VoiceActionFulfillmentPanel
            domain="health"
            actionTypes={["health.symptom_support"]}
            title={t("health.symptomCheck.contextReady", "Symptom context ready")}
            description={t("health.symptomCheck.contextReadySub", "VYVA can keep the current symptom topic, scan context, and report flow together here.")}
          />
          {triageContext?.usedItems?.length ? (
            <div className="mt-3 rounded-[22px] border border-[#E8DED4] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(63,45,35,0.05)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-vyva-purple">
                  <ClipboardList size={19} />
                </span>
                <div className="min-w-0">
                  <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                    {t("health.symptomCheck.memory.title", "VYVA checked your health profile")}
                  </p>
                  <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                    {triageContext.usedItems.slice(0, 4).join(" • ")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {step === "intro" && (
          <IntroScreen
            onStartWithVitals={() => {
              setChatEntryMode("vitals");
              setAutoStartVoice(false);
              setStep("vitals");
            }}
            onStartWithoutVitals={() => startChatDirectly(false)}
          />
        )}

        {step === "vitals" && (
          <VitalsScan onComplete={handleScanComplete} />
        )}

        {step === "chat" && (
          <TriageChat
            bpm={bpm}
            respiratoryRate={respiratoryRate}
            entryMode={chatEntryMode === "vitals" ? "with_vitals" : "without_vitals"}
            healthMemory={triageContext?.memory ?? null}
            autoStartVoice={autoStartVoice}
            onVoiceAutoStarted={() => setAutoStartVoice(false)}
            onComplete={handleChatComplete}
          />
        )}

        {step === "report" && summary && (
          <ReportScreen
            summary={summary}
            bpm={bpm}
            respiratoryRate={respiratoryRate}
            durationSeconds={durationSeconds}
            reportId={reportId}
            reportSaveState={reportSaveState}
            profileContacts={profileContacts}
            onDone={() => navigate("/health")}
          />
        )}
      </div>
    </div>
  );
}
