import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, ChevronLeft, ChevronRight, FileText, Heart, MessageSquare, Mic, Pill, Share2, CheckCircle, AlertTriangle, Eye, Stethoscope } from "lucide-react";
import TriageChat from "@/components/TriageChat";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/queryClient";

type Step = "intro" | "chat" | "report";

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  aiSummary?: string;
}

function StepDots({ current }: { current: Step }) {
  const steps: Step[] = ["chat", "report"];
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
  onStart,
  onStartVoice,
}: {
  onStart: () => void;
  onStartVoice: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col flex-1 px-[18px] py-4 gap-5">
      <section className="relative overflow-hidden rounded-[30px] bg-[#3D0D82] p-5 text-white shadow-[0_16px_36px_rgba(91,18,160,0.24)]">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative">
          <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/15">
            <Heart size={30} className="text-white" />
          </div>
          <p className="font-body text-[12px] font-bold uppercase tracking-[0.14em] text-white/64">
            {t("health.symptomCheck.title")}
          </p>
          <h1 className="mt-1 font-display text-[34px] italic leading-[1.08] text-white">
            {t("health.symptomCheck.intro.title")}
          </h1>
          <p className="mt-4 font-body text-[16px] font-semibold leading-relaxed text-white/84">
            {t("health.symptomCheck.intro.subtitle")}
          </p>
        </div>
      </section>

      <div className="grid w-full grid-cols-1 gap-3">
        <button
          onClick={onStart}
          data-testid="button-symptom-check-start"
          className="vyva-primary-action w-full min-h-[58px] shadow-[0_10px_24px_rgba(107,33,168,0.24)]"
        >
          {t("health.symptomCheck.intro.startBtn")}
        </button>

        <button
          onClick={onStartVoice}
          data-testid="button-symptom-check-voice-start"
          className="vyva-secondary-action w-full min-h-[56px] text-vyva-purple"
        >
          <Mic size={18} />
          {t("health.symptomCheck.intro.voiceBtn")}
        </button>
      </div>

      <div className="flex w-full flex-col gap-3">
        {(["chat", "next", "report"] as const).map((key, i) => {
          const icons = [MessageSquare, Activity, FileText];
          const Icon = icons[i];
          return (
            <button
              key={key}
              type="button"
              onClick={onStart}
              data-testid={`button-symptom-check-${key}`}
              className="flex w-full items-center gap-4 rounded-[24px] border border-[#E8DED4] bg-white p-4 text-left shadow-[0_8px_24px_rgba(63,45,35,0.06)] transition-all active:scale-[0.99]"
            >
              <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]"
                style={{ background: "hsl(var(--vyva-purple-light))" }}
              >
                <Icon size={18} style={{ color: "hsl(var(--vyva-purple))" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[15px] font-bold text-vyva-text-1">
                  {t(`health.symptomCheck.intro.step${i + 1}Title`)}
                </p>
                <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                  {t(`health.symptomCheck.intro.step${i + 1}Desc`)}
                </p>
              </div>
              <ChevronRight size={20} className="flex-shrink-0" style={{ color: "hsl(var(--vyva-purple))" }} />
            </button>
          );
        })}
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
  onDone,
}: {
  summary: TriageSummary;
  bpm: number | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const cfg = UrgencyConfig(summary.urgency);
  const UrgencyIcon = cfg.icon;
  const nextSteps = [
    { key: "vitals", Icon: Activity, label: t("health.symptomCheck.report.nextStepVitals"), to: "/health/vitals", primary: true },
    { key: "doctor", Icon: Stethoscope, label: t("health.symptomCheck.report.nextStepDoctor"), to: "/health/doctor" },
    { key: "meds", Icon: Pill, label: t("health.symptomCheck.report.nextStepMeds"), to: "/meds" },
    { key: "reports", Icon: FileText, label: t("health.symptomCheck.report.nextStepReports"), to: "/informes" },
  ];

  const shareText = [
    t("health.symptomCheck.report.shareTitle"),
    "",
    `${t("health.symptomCheck.report.chiefComplaint")}: ${summary.chiefComplaint}`,
    bpm != null ? `${t("health.symptomCheck.scan.heartRate")}: ${bpm} bpm` : "",
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
      </div>

      <div className="flex flex-col gap-4 px-[18px] pb-6">
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

        <div className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]">
          <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider">
            {t("health.symptomCheck.report.nextStepsTitle")}
          </p>
          <p className="mt-2 font-body text-[15px] leading-relaxed text-vyva-text-2">
            {t("health.symptomCheck.report.nextStepsSubtitle")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {nextSteps.map(({ key, Icon, label, to, primary }) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(to)}
                data-testid={`button-report-next-step-${key}`}
                className={`vyva-tap inline-flex min-h-[46px] items-center gap-2 rounded-full border px-4 py-2 font-body text-[14px] font-bold ${
                  primary
                    ? "border-vyva-purple bg-vyva-purple text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]"
                    : "border-vyva-border bg-[#FAF9F6] text-vyva-text-1"
                }`}
              >
                <Icon size={17} className={primary ? "text-white" : "text-vyva-purple"} />
                {label}
              </button>
            ))}
          </div>
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
  const [step, setStep] = useState<Step>("intro");
  const bpm: number | null = null;
  const [chatStartTime, setChatStartTime] = useState<number | null>(null);
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [summary, setSummary] = useState<TriageSummary | null>(null);

  const stepTitle: Record<Step, string> = {
    intro: t("health.symptomCheck.title"),
    chat: t("health.symptomCheck.chat.title"),
    report: t("health.symptomCheck.report.title"),
  };

  const handleBack = () => {
    if (step === "intro") {
      navigate("/health");
    } else if (step === "chat") {
      setStep("intro");
    } else {
      navigate("/health");
    }
  };

  const startChatDirectly = (withVoice = false) => {
    setChatStartTime(Date.now());
    setAutoStartVoice(withVoice);
    setStep("chat");
  };

  const handleChatComplete = (triageSummary: TriageSummary) => {
    const durationSeconds = chatStartTime
      ? Math.round((Date.now() - chatStartTime) / 1000)
      : null;
    setSummary(triageSummary);
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
        respiratory_rate: null,
        duration_seconds: durationSeconds,
      }),
    }).catch((err) => console.error("[reports/triage] save failed:", err));
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
          <StepDots current={step} />
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
        </div>

        {step === "intro" && (
          <IntroScreen
            onStart={() => startChatDirectly(false)}
            onStartVoice={() => startChatDirectly(true)}
          />
        )}

        {step === "chat" && (
          <TriageChat
            bpm={bpm}
            autoStartVoice={autoStartVoice}
            onVoiceAutoStarted={() => setAutoStartVoice(false)}
            onComplete={handleChatComplete}
          />
        )}

        {step === "report" && summary && (
          <ReportScreen
            summary={summary}
            bpm={bpm}
            onDone={() => navigate("/health")}
          />
        )}
      </div>
    </div>
  );
}
