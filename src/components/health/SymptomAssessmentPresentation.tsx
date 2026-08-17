import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ListChecks,
  LoaderCircle,
  MessageCircleMore,
  Mic,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
} from "lucide-react";
import type { SymptomAssessmentStageId } from "@/design/screenPresentation";

export type SymptomAssessmentModality = "voice" | "touch";

export const SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE = {
  describe: "capture.voice_or_text",
  safety_check: "choice.yes_no",
  urgent_escalation: "safety.urgent_escalation",
  symptom_selection: "multi_choice.symptom_picker",
  severity: "scale.severity_0_10",
  onset: "capture.onset_timing",
  related_details: "prompt.clarification",
  review: "confirmation.review",
  checking: "progress.checking",
  safest_next_step: "summary.guidance_next_step",
  save_share_summary: "summary.share_or_save",
} as const satisfies Record<SymptomAssessmentStageId, string>;

const stageCopy: Record<SymptomAssessmentStageId, {
  eyebrow: string;
  title: string;
  helper: string;
}> = {
  describe: {
    eyebrow: "Describe how you feel",
    title: "How are you feeling?",
    helper: "Tell VYVA in your own words.",
  },
  safety_check: {
    eyebrow: "Safety check",
    title: "Any urgent warning signs?",
    helper: "For example severe chest pain, fainting, or struggling to breathe.",
  },
  urgent_escalation: {
    eyebrow: "Urgent guidance",
    title: "Get urgent help now",
    helper: "Call emergency services now. Do not wait for an online assessment.",
  },
  symptom_selection: {
    eyebrow: "Symptom details",
    title: "What are you noticing?",
    helper: "Choose the closest symptom or describe it in your own words.",
  },
  severity: {
    eyebrow: "Severity",
    title: "How strong does it feel?",
    helper: "Use the scale or choose the closest answer.",
  },
  onset: {
    eyebrow: "Timing",
    title: "When did it start?",
    helper: "An approximate time is enough.",
  },
  related_details: {
    eyebrow: "Related details",
    title: "A little more detail",
    helper: "This helps VYVA understand what may matter next.",
  },
  review: {
    eyebrow: "Review",
    title: "Check what you shared",
    helper: "Make sure this looks right before VYVA checks the safest next step.",
  },
  checking: {
    eyebrow: "Checking",
    title: "VYVA is checking your answers",
    helper: "Looking for the safest next step based on what you shared.",
  },
  safest_next_step: {
    eyebrow: "Guidance",
    title: "Your safest next step",
    helper: "Follow this guidance and watch for any change in how you feel.",
  },
  save_share_summary: {
    eyebrow: "Summary",
    title: "Save or share your summary",
    helper: "Keep a copy or share it with someone supporting your care.",
  },
};

const iconByStage = {
  describe: MessageCircleMore,
  safety_check: ShieldCheck,
  urgent_escalation: AlertTriangle,
  symptom_selection: Stethoscope,
  severity: SlidersHorizontal,
  onset: Clock3,
  related_details: MessageCircleMore,
  review: ListChecks,
  checking: LoaderCircle,
  safest_next_step: CheckCircle2,
  save_share_summary: Save,
} as const;

export function SymptomAssessmentPresentation({
  stageId,
  modality,
  title,
  helper,
  children,
  className = "",
}: {
  stageId: SymptomAssessmentStageId;
  modality: SymptomAssessmentModality;
  title?: string;
  helper?: string;
  children?: ReactNode;
  className?: string;
}) {
  const copy = stageCopy[stageId];
  const Icon = iconByStage[stageId];
  const urgent = stageId === "urgent_escalation";

  return (
    <section
      className={`overflow-hidden rounded-[30px] border bg-white shadow-[0_18px_44px_rgba(63,45,35,0.09)] ${
        urgent ? "border-[#FCA5A5]" : "border-[#DDD6FE]"
      } ${className}`}
      data-testid={`symptom-presentation-${stageId}-${modality}`}
      data-approved-frame={SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE[stageId]}
      data-presentation-modality={modality}
    >
      <div className={`p-5 ${urgent ? "bg-[#FFF7F7]" : "bg-[linear-gradient(145deg,#FFFFFF_0%,#FBFAFF_62%,#F0FDFF_100%)]"}`}>
        <div className="flex items-start gap-4">
          <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] shadow-sm ${
            urgent ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-white text-vyva-purple"
          }`}>
            {stageId === "describe" && modality === "voice" ? (
              <Mic size={27} strokeWidth={2.7} />
            ) : stageId === "checking" ? (
              <Icon size={27} strokeWidth={2.7} className="animate-spin" />
            ) : (
              <Icon size={27} strokeWidth={2.7} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-body text-[12px] font-black uppercase tracking-[0.14em] ${urgent ? "text-[#B91C1C]" : "text-vyva-purple"}`}>
                {copy.eyebrow}
              </p>
              <span className={`rounded-full px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-[0.1em] ${
                urgent ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-white text-[#0E7490] shadow-sm"
              }`}>
                {modality === "voice" ? "Voice" : "Touch"}
              </span>
            </div>
            <h2 className={`mt-2 font-body text-[30px] font-black leading-[1.08] sm:text-[36px] ${urgent ? "text-[#7F1D1D]" : "text-vyva-text-1"}`}>
              {title || copy.title}
            </h2>
            <p className={`mt-2 font-body text-[16px] font-bold leading-snug sm:text-[17px] ${urgent ? "text-[#991B1B]" : "text-vyva-text-2"}`}>
              {helper || copy.helper}
            </p>
          </div>
        </div>
        {urgent ? (
          <div className="mt-4 rounded-[20px] border border-[#FCA5A5] bg-white px-4 py-3 font-body text-[15px] font-bold leading-snug text-[#7F1D1D]">
            <strong>VYVA will stay with you.</strong> Normal assessment questions stop here.
          </div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </section>
  );
}
