import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, ChevronLeft, Share2, CheckCircle, AlertTriangle, Eye, ClipboardList, FileText, Heart, PhoneCall, Pill, Stethoscope } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import TriageChat from "@/components/TriageChat";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, queryClient } from "@/lib/queryClient";

type Step = "intro" | "chat" | "report";

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  aiSummary?: string;
  nextStepLabel?: string;
  nextStepLevel?: "emergency" | "doctor_today" | "doctor_24_48" | "monitor";
  triageReasons?: string[];
  watchSigns?: string[];
  profileConsiderations?: string[];
  vitalsNotes?: string[];
  evidenceSummary?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
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

function IntroScreen({ onStart }: { onStart: (clue: string) => void }) {
  const { t } = useTranslation();
  const [clue, setClue] = useState("");
  const cleanClue = clue.trim();
  const canStart = cleanClue.length >= 2;
  const quickClues = [
    t("health.symptomCheck.intro.clueHeadache", "Bad headache"),
    t("health.symptomCheck.intro.clueBreathing", "Short of breath"),
    t("health.symptomCheck.intro.clueDizzy", "Dizzy"),
    t("health.symptomCheck.intro.clueFever", "Fever"),
    t("health.symptomCheck.intro.clueFall", "I fell"),
    t("health.symptomCheck.intro.clueUrine", "Pain when I pee"),
    t("health.symptomCheck.intro.clueChest", "Chest pain"),
    t("health.symptomCheck.intro.clueStomach", "Stomach pain"),
    t("health.symptomCheck.intro.clueMedicine", "Medication concern"),
    t("health.symptomCheck.intro.clueAnxiety", "Feeling anxious"),
  ];

  return (
    <div className="flex flex-1 flex-col justify-center gap-7 px-[22px] py-8">
      <section className="text-left">
        <p className="font-body text-[15px] font-extrabold uppercase tracking-[0.12em] text-vyva-purple">
          {t("health.symptomCheck.intro.stepLabel", "Symptom check")}
        </p>
        <h1 className="mt-3 max-w-[340px] font-body text-[30px] font-bold leading-[1.08] text-vyva-text-1">
          {t("health.symptomCheck.intro.clueTitle", "What is bothering you?")}
        </h1>
        <p className="mt-3 max-w-[390px] font-body text-[18px] font-semibold leading-snug text-vyva-text-2">
          {t("health.symptomCheck.intro.clueSub", "Use a few words. VYVA will choose the right questions.")}
        </p>
      </section>

      <div className="grid gap-4">
        <label className="sr-only" htmlFor="symptom-clue">
          {t("health.symptomCheck.intro.clueTitle", "What is bothering you?")}
        </label>
        <input
          id="symptom-clue"
          value={clue}
          onChange={(event) => setClue(event.target.value)}
          placeholder={t("health.symptomCheck.intro.cluePlaceholder", "For example: bad headache...")}
          data-testid="input-symptom-clue"
          className="min-h-[72px] rounded-[24px] border border-[#E8DED4] bg-white px-5 font-body text-[20px] font-bold text-vyva-text-1 shadow-[0_10px_26px_rgba(63,45,35,0.06)] outline-none focus:border-[#6B21A8]"
        />
        <div className="flex flex-wrap gap-2">
          {quickClues.map((quickClue) => (
            <button
              key={quickClue}
              type="button"
              onClick={() => setClue(quickClue)}
              className="vyva-tap min-h-[64px] rounded-full border border-[#E8DED4] bg-white px-5 font-body text-[18px] font-extrabold text-vyva-text-2"
            >
              {quickClue}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <p className="font-body text-[15px] font-bold leading-snug text-vyva-text-2">
          {t("health.symptomCheck.intro.vitalsAsNextStep", "Vitals can be checked after VYVA understands what is happening.")}
        </p>
        <button
          type="button"
          onClick={() => onStart(cleanClue)}
          disabled={!canStart}
          data-testid="button-symptom-check-start"
          className="vyva-primary-action min-h-[72px] w-full text-[20px] disabled:opacity-45"
        >
          {t("health.symptomCheck.intro.startBtn", "Start symptom check")}
        </button>
      </div>
    </div>
  );
}

function ReportConfig(summary: TriageSummary) {
  const level = summary.nextStepLevel ?? (summary.urgency === "urgent" ? "doctor_today" : summary.urgency === "routine" ? "doctor_24_48" : "monitor");
  if (level === "emergency") {
    return {
      bg: "linear-gradient(135deg, #B91C1C 0%, #EF4444 100%)",
      icon: AlertTriangle,
      label: "health.symptomCheck.report.emergencyLabel",
      fallbackLabel: "Emergency now",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  if (level === "doctor_today") {
    return {
      bg: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
      icon: Stethoscope,
      label: "health.symptomCheck.report.doctorTodayLabel",
      fallbackLabel: "Doctor today",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  if (level === "doctor_24_48") {
    return {
      bg: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)",
      icon: Eye,
      label: "health.symptomCheck.report.routineLabel",
      fallbackLabel: "Doctor within 24-48 hours",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  return {
    bg: "linear-gradient(135deg, #0A7C4E 0%, #10B981 100%)",
    icon: CheckCircle,
    label: "health.symptomCheck.report.monitorLabel",
    fallbackLabel: "Monitor at home",
    pillBg: "rgba(255,255,255,0.25)",
    level,
  };
}

function uniqueLines(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index, list) => list.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index);
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
  const cfg = ReportConfig(summary);
  const UrgencyIcon = cfg.icon;
  const isEmergency = cfg.level === "emergency";
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
  const contactStatusText = notifiedText || t("health.symptomCheck.report.noContactsConfigured", "No doctor or caregiver contact is set yet.");
  const doctorTellItems = uniqueLines([
    `${t("health.symptomCheck.report.tellMainSymptom", "Main symptom")}: ${summary.chiefComplaint}`,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    summary.nextStepLabel ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${summary.nextStepLabel}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Why this step")}: ${summary.triageReasons.join(" ")}` : "",
    summary.vitalsNotes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${summary.vitalsNotes.join(" ")}` : "",
    summary.profileConsiderations?.length ? `${t("health.symptomCheck.report.profileConsidered", "Profile considered")}: ${summary.profileConsiderations.join(" ")}` : "",
    summary.watchSigns?.length ? `${t("health.symptomCheck.report.watchSigns", "Watch signs")}: ${summary.watchSigns.join(" ")}` : "",
  ]).slice(0, 6);
  const doctorNote = [
    summary.chiefComplaint,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Resp. Rate")}: ${respiratoryRate} rpm` : "",
    `${t("health.symptomCheck.report.urgencyLabel", "Urgency")}: ${t(cfg.label, cfg.fallbackLabel)}`,
    summary.nextStepLabel ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${summary.nextStepLabel}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Why this step")}: ${summary.triageReasons.join(" ")}` : "",
    summary.evidenceSummary ? `${t("health.symptomCheck.report.evidenceChecked", "Medical evidence checked")}: ${summary.evidenceSummary}` : "",
    summary.recommendations.length ? `${t("health.symptomCheck.report.recommendations", "What to do next")}: ${summary.recommendations.join(" ")}` : "",
    summary.watchSigns?.length ? `${t("health.symptomCheck.report.watchSigns", "Watch signs")}: ${summary.watchSigns.join(" ")}` : "",
    summary.profileConsiderations?.length ? `${t("health.symptomCheck.report.profileConsidered", "Profile considered")}: ${summary.profileConsiderations.join(" ")}` : "",
    summary.vitalsNotes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${summary.vitalsNotes.join(" ")}` : "",
  ].filter(Boolean).join("\n");
  const openDoctorWithContext = () => {
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: doctorNote,
      },
    });
  };
  const nextSteps = [
    { key: "vitals", Icon: Activity, label: t("health.symptomCheck.report.nextStepVitals", "Check vitals"), onClick: () => navigate("/health/vitals"), primary: true },
    { key: "doctor", Icon: Stethoscope, label: t("health.symptomCheck.report.nextStepDoctor", "Talk to doctor"), onClick: openDoctorWithContext },
    { key: "meds", Icon: Pill, label: t("health.symptomCheck.report.nextStepMeds", "Review meds"), onClick: () => navigate("/meds") },
    { key: "reports", Icon: FileText, label: t("health.symptomCheck.report.nextStepReports", "Open reports"), onClick: () => navigate(reportId ? `/informes/${reportId}` : "/informes") },
  ];

  const shareText = [
    t("health.symptomCheck.report.shareTitle"),
    "",
    `${t("health.symptomCheck.report.chiefComplaint")}: ${summary.chiefComplaint}`,
    bpm != null ? `${t("health.symptomCheck.scan.heartRate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Resp. Rate")}: ${respiratoryRate} rpm` : "",
    durationText ? `${t("health.symptomCheck.report.timeTaken", "Time taken")}: ${durationText}` : "",
    "",
    `${t("health.symptomCheck.report.urgencyLabel")}: ${t(cfg.label, cfg.fallbackLabel)}`,
    summary.nextStepLabel ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${summary.nextStepLabel}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Why this step")}: ${summary.triageReasons.join(" ")}` : "",
    summary.evidenceSummary ? `${t("health.symptomCheck.report.evidenceChecked", "Medical evidence checked")}: ${summary.evidenceSummary}` : "",
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
        className={`mx-[18px] mb-4 mt-4 flex flex-col gap-3 rounded-[30px] p-5 shadow-[0_16px_36px_rgba(91,18,160,0.18)] ${isEmergency ? "motion-safe:animate-pulse" : ""}`}
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
              {t(cfg.label, cfg.fallbackLabel)}
            </p>
          </div>
        </div>

        <p className="font-body text-[21px] font-black leading-tight text-white">
          {summary.nextStepLabel ?? t(cfg.label, cfg.fallbackLabel)}
        </p>
        <p className="font-body text-[16px] font-bold text-white/90 leading-relaxed">
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
        <div className="grid grid-cols-2 gap-3">
          {isEmergency ? (
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
          {summary.nextStepLabel && (
            <div className="col-span-2 rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                {t("health.symptomCheck.report.nextStep", "Next step")}
              </p>
              <p className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                {summary.nextStepLabel}
              </p>
            </div>
          )}
          {summary.triageReasons?.length ? (
            <div className="col-span-2 rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] p-4 text-vyva-purple shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                  {t("health.symptomCheck.report.whyThisStep", "Why this step")}
                </p>
              </div>
              <ul className="grid gap-2">
                {summary.triageReasons.slice(0, 3).map((reason, index) => (
                  <li key={index} className="font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="col-span-2 rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
            <div className="mb-3 flex items-center gap-2 text-vyva-purple">
              <Stethoscope size={19} />
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("health.symptomCheck.report.tellDoctorTitle", "Tell the doctor")}
              </p>
            </div>
            <ul className="grid gap-2">
              {doctorTellItems.map((item, index) => (
                <li key={index} className="font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {(summary.evidenceSummary || summary.evidenceSources?.length) ? (
            <div className="col-span-2 rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-[#1D4ED8] shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("health.symptomCheck.report.evidenceChecked", "Medical evidence checked")}
              </p>
              {summary.evidenceSummary ? (
                <p className="mt-2 font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                  {summary.evidenceSummary}
                </p>
              ) : null}
              {summary.evidenceSources?.length ? (
                <p className="mt-2 font-body text-[14px] font-extrabold leading-snug text-[#1D4ED8]">
                  {summary.evidenceSources.slice(0, 2).map((source) => source.title).filter(Boolean).join(" - ")}
                </p>
              ) : null}
            </div>
          ) : null}
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
          className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_30px_rgba(63,45,35,0.06)]"
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
          <div className={`mt-5 flex items-start gap-3 border-t border-[#EADFD5] pt-4 ${notifiedText ? "text-[#047857]" : "text-vyva-text-2"}`}>
            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${notifiedText ? "bg-[#DCFCE7]" : "bg-[#F5F3FF]"}`}>
              {notifiedText ? <CheckCircle size={18} /> : <ClipboardList size={18} />}
            </span>
            <p className="font-body text-[17px] font-extrabold leading-snug">
              {contactStatusText}
            </p>
          </div>
        </div>

        {isEmergency ? (
          <div className="rounded-[24px] border-2 border-[#DC2626] bg-[#FEF2F2] p-5 text-[#991B1B] shadow-[0_12px_30px_rgba(220,38,38,0.14)]">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#DC2626] text-white">
                <AlertTriangle size={24} />
              </span>
              <p className="font-body text-[22px] font-black leading-tight">
                {t("health.symptomCheck.report.emergencyDoNotWait", "Do not wait")}
              </p>
            </div>
            <p className="font-body text-[18px] font-bold leading-snug">
              {t("health.symptomCheck.report.emergencyBody", "Call emergency services now. Do not drive yourself. Keep this report open for the responder.")}
            </p>
          </div>
        ) : null}

        {(summary.watchSigns?.length || summary.profileConsiderations?.length || summary.vitalsNotes?.length) && (
          <div className="grid gap-3">
            {summary.watchSigns?.length ? (
              <div className="rounded-[24px] border border-[#FED7AA] bg-[#FFF7ED] p-5 text-[#9A3412] shadow-[0_8px_24px_rgba(63,45,35,0.05)]">
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                  {t("health.symptomCheck.report.watchSigns", "Watch for")}
                </p>
                <ul className="mt-3 grid gap-2">
                  {summary.watchSigns.slice(0, 3).map((sign, index) => (
                    <li key={index} className="font-body text-[16px] font-bold leading-snug">
                      {sign}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.profileConsiderations?.length || summary.vitalsNotes?.length ? (
              <div className="rounded-[24px] border border-[#DDD6FE] bg-[#F5F3FF] p-5 text-vyva-purple shadow-[0_8px_24px_rgba(63,45,35,0.05)]">
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                  {t("health.symptomCheck.report.contextUsed", "What VYVA considered")}
                </p>
                <ul className="mt-3 grid gap-2">
                  {[...(summary.profileConsiderations ?? []), ...(summary.vitalsNotes ?? [])].slice(0, 4).map((note, index) => (
                    <li key={index} className="font-body text-[16px] font-bold leading-snug">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

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

        <div className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]">
          <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider">
            {t("health.symptomCheck.report.nextStepsTitle")}
          </p>
          <p className="mt-2 font-body text-[15px] leading-relaxed text-vyva-text-2">
            {t("health.symptomCheck.report.nextStepsSubtitle")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {nextSteps.map(({ key, Icon, label, onClick, primary }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
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
  const bpm: number | null = null;
  const respiratoryRate: number | null = null;
  const [chatStartTime, setChatStartTime] = useState<number | null>(null);
  const [initialClue, setInitialClue] = useState("");
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [summary, setSummary] = useState<TriageSummary | null>(null);
  const [reportSaveState, setReportSaveState] = useState<ReportSaveState>("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

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

  const startChatDirectly = (clue: string, withVoice = false) => {
    setInitialClue(clue);
    setChatStartTime(Date.now());
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
        next_step_label: triageSummary.nextStepLabel ?? null,
        next_step_level: triageSummary.nextStepLevel ?? null,
        triage_reasons: triageSummary.triageReasons ?? [],
        watch_signs: triageSummary.watchSigns ?? [],
        profile_considerations: triageSummary.profileConsiderations ?? [],
        vitals_notes: triageSummary.vitalsNotes ?? [],
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
            onStart={(clue) => startChatDirectly(clue, false)}
          />
        )}

        {step === "chat" && (
          <TriageChat
            bpm={bpm}
            respiratoryRate={respiratoryRate}
            entryMode="without_vitals"
            initialClue={initialClue}
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
