import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, ChevronDown, HelpCircle, SearchCheck, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ShowVyvaReviewContract, ShowVyvaReviewRiskLevel } from "../../shared/showVyvaReviewContract";
import type { ShowVyvaFollowUpAction } from "../../shared/showVyvaFollowUp";
import { buildShowVyvaDecisionHandoff, type ShowVyvaDecisionTone } from "../../shared/showVyvaDecisionHandoff";
import { buildShowVyvaConfidenceEvidence, type ShowVyvaConfidenceEvidenceTone } from "../../shared/showVyvaConfidenceEvidence";
import { upsertShowVyvaReviewHistory } from "@/lib/showVyvaReviewHistory";
import ShowVyvaFollowUpPanel from "./ShowVyvaFollowUpPanel";

type ShowVyvaResultCardProps = {
  contract: ShowVyvaReviewContract;
  reviewedLabel?: string;
  thinkingLabel?: string;
  testIdSuffix?: string;
  className?: string;
  headerAction?: ReactNode;
  actions?: ShowVyvaFollowUpAction[];
  actionTitle?: string;
  actionSubtitle?: string;
  onActionSelect?: (action: ShowVyvaFollowUpAction, contract: ShowVyvaReviewContract) => void;
};

const RISK_TONES: Record<ShowVyvaReviewRiskLevel, {
  bg: string;
  border: string;
  text: string;
  badge: string;
  icon: LucideIcon;
}> = {
  low: {
    bg: "#F0FDFA",
    border: "#99F6E4",
    text: "#0F766E",
    badge: "#CCFBF1",
    icon: CheckCircle2,
  },
  medium: {
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#92400E",
    badge: "#FEF3C7",
    icon: AlertTriangle,
  },
  high: {
    bg: "#FEF2F2",
    border: "#FECACA",
    text: "#991B1B",
    badge: "#FEE2E2",
    icon: AlertTriangle,
  },
  unknown: {
    bg: "#F8FAFC",
    border: "#E2E8F0",
    text: "#475569",
    badge: "#E2E8F0",
    icon: HelpCircle,
  },
};

const DECISION_TONES: Record<ShowVyvaDecisionTone, { bg: string; border: string; text: string }> = {
  safe: { bg: "#F0FDFA", border: "#99F6E4", text: "#0F766E" },
  care: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  warn: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" },
  neutral: { bg: "#F8FAFC", border: "#E2E8F0", text: "#475569" },
};

const CONFIDENCE_EVIDENCE_TONES: Record<ShowVyvaConfidenceEvidenceTone, { bg: string; border: string; text: string; chip: string }> = {
  clear_risk: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", chip: "#FEE2E2" },
  needs_checking: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", chip: "#FEF3C7" },
  not_enough_information: { bg: "#F8FAFC", border: "#E2E8F0", text: "#475569", chip: "#E2E8F0" },
};

function fallbackRiskLabel(riskLevel: ShowVyvaReviewRiskLevel): string {
  if (riskLevel === "low") return "Low";
  if (riskLevel === "medium") return "Needs care";
  if (riskLevel === "high") return "High risk";
  return "Not sure yet";
}

function fallbackInputLabel(inputType: ShowVyvaReviewContract["inputType"]): string {
  switch (inputType) {
    case "camera_photo":
      return "Camera photo";
    case "uploaded_image":
      return "Uploaded image";
    case "uploaded_document":
      return "Uploaded document";
    case "pasted_text":
      return "Pasted text";
    case "pasted_link":
      return "Pasted link";
    case "phone_number":
      return "Phone number";
    case "company_name":
      return "Company name";
    case "document_text":
      return "Document text";
    default:
      return "Review item";
  }
}

function compactReviewedValue(value: string | null | undefined): string {
  const cleaned = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!cleaned) return "";
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

export default function ShowVyvaResultCard({
  contract,
  reviewedLabel,
  thinkingLabel,
  testIdSuffix = contract.inputType,
  className = "",
  headerAction,
  actions,
  actionTitle,
  actionSubtitle,
  onActionSelect,
}: ShowVyvaResultCardProps) {
  const { t } = useTranslation();
  const [explainOpen, setExplainOpen] = useState(false);
  const tone = RISK_TONES[contract.riskLevel];
  const handoff = buildShowVyvaDecisionHandoff(contract);
  const handoffTone = DECISION_TONES[handoff.tone];
  const confidenceEvidence = buildShowVyvaConfidenceEvidence(contract);
  const confidenceEvidenceTone = CONFIDENCE_EVIDENCE_TONES[confidenceEvidence.tone];
  const RiskIcon = tone.icon;
  const inputLabel = t(`showVyva.contract.input.${contract.inputType}`, fallbackInputLabel(contract.inputType));
  const riskLabel = t(`showVyva.contract.risk.${contract.riskLevel}`, fallbackRiskLabel(contract.riskLevel));
  const confidenceLabel = t(`showVyva.contract.confidence.${contract.confidenceLevel}`, contract.confidenceLevel);
  const reviewedValue = compactReviewedValue(contract.reviewedValue ?? contract.fileName);
  const defaultReviewedLabel = reviewedValue ? `${inputLabel}: ${reviewedValue}` : inputLabel;
  const verifiedObservations = contract.verifiedObservations?.length
    ? contract.verifiedObservations
    : contract.noticed.length
      ? contract.noticed
      : [contract.concernSummary];
  const warningSigns = contract.warningSigns ?? [];
  const unknowns = contract.unknowns?.length
    ? contract.unknowns
    : [t("showVyva.contract.unknownFallback", "VYVA cannot confirm details that are not visible in this item.")];
  const nextSteps = contract.safeNextSteps.length ? contract.safeNextSteps : [contract.concernSummary];
  const followUpActions = actions ?? handoff.actions;

  useEffect(() => {
    upsertShowVyvaReviewHistory(contract);
  }, [contract]);

  return (
    <section
      data-testid={`show-vyva-result-${testIdSuffix}`}
      className={`rounded-[20px] border bg-white p-4 shadow-[0_14px_34px_rgba(63,45,35,0.08)] ${className}`}
      style={{ borderColor: tone.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-vyva-purple">
            <ShieldCheck size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[11px] font-black uppercase tracking-[0.11em] text-[#7C3AED]">
              {t("showVyva.contract.kicker", "VYVA review")}
            </p>
            <h3 className="mt-0.5 font-body text-[20px] font-black leading-tight text-vyva-text-1">
              {contract.concernSummary}
            </h3>
          </div>
        </div>
        {headerAction}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          data-testid={`show-vyva-result-input-${testIdSuffix}`}
          className="rounded-full border border-[#EDE5DB] bg-[#FFFCF8] px-3 py-1 font-body text-[12px] font-black text-[#6F5F59]"
        >
          {inputLabel}
        </span>
        <span
          data-testid={`show-vyva-result-risk-${testIdSuffix}`}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-body text-[12px] font-black"
          style={{ background: tone.badge, color: tone.text }}
        >
          <RiskIcon size={13} aria-hidden="true" />
          {riskLabel}
        </span>
        <span className="rounded-full bg-[#F8FAFC] px-3 py-1 font-body text-[12px] font-black text-[#64748B]">
          {confidenceLabel}
        </span>
      </div>

      <section
        data-testid={`show-vyva-decision-handoff-${testIdSuffix}`}
        className="mt-4 rounded-[18px] border p-3"
        style={{ background: handoffTone.bg, borderColor: handoffTone.border }}
      >
        <p className="font-body text-[11px] font-black uppercase tracking-[0.09em]" style={{ color: handoffTone.text }}>
          {t("showVyva.handoff.kicker", "Best next step")}
        </p>
        <h4
          data-testid={`show-vyva-decision-title-${testIdSuffix}`}
          className="mt-1 font-body text-[19px] font-black leading-tight"
          style={{ color: handoffTone.text }}
        >
          {t(`showVyva.handoff.title.${contract.followUpContext}`, handoff.title)}
        </h4>
        <p
          data-testid={`show-vyva-decision-subtitle-${testIdSuffix}`}
          className="mt-1 font-body text-[14px] font-bold leading-snug"
          style={{ color: handoffTone.text }}
        >
          {handoff.subtitle}
        </p>
      </section>

      <section
        data-testid={`show-vyva-confidence-evidence-${testIdSuffix}`}
        className="mt-3 rounded-[18px] border p-3"
        style={{ background: confidenceEvidenceTone.bg, borderColor: confidenceEvidenceTone.border }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 font-body text-[11px] font-black uppercase tracking-[0.09em]" style={{ color: confidenceEvidenceTone.text }}>
            <SearchCheck size={14} aria-hidden="true" />
            {t("showVyva.evidence.kicker", "Why VYVA thinks this")}
          </p>
          <span
            data-testid={`show-vyva-confidence-label-${testIdSuffix}`}
            className="rounded-full px-3 py-1 font-body text-[12px] font-black"
            style={{ background: confidenceEvidenceTone.chip, color: confidenceEvidenceTone.text }}
          >
            {t(`showVyva.evidence.confidence.${confidenceEvidence.tone}`, confidenceEvidence.label)}
          </span>
        </div>
        <ul className="mt-2 grid gap-1.5">
          {confidenceEvidence.evidencePoints.map((item, index) => (
            <li key={`${item}-${index}`} className="font-body text-[13px] font-bold leading-snug" style={{ color: confidenceEvidenceTone.text }}>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-[14px] bg-white/75 p-2.5" data-testid={`show-vyva-facts-found-${testIdSuffix}`}>
            <p className="font-body text-[10px] font-black uppercase tracking-[0.09em]" style={{ color: confidenceEvidenceTone.text }}>
              {t("showVyva.evidence.factsFound", "Facts found")}
            </p>
            <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-1">
              {confidenceEvidence.factsFound[0] ?? t("showVyva.evidence.noFacts", "No solid fact found yet.")}
            </p>
          </div>
          <div className="rounded-[14px] bg-white/75 p-2.5" data-testid={`show-vyva-uncertain-points-${testIdSuffix}`}>
            <p className="font-body text-[10px] font-black uppercase tracking-[0.09em]" style={{ color: confidenceEvidenceTone.text }}>
              {t("showVyva.evidence.stillUncertain", "Still uncertain")}
            </p>
            <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-1">
              {confidenceEvidence.uncertainPoints[0] ?? t("showVyva.evidence.noUncertainty", "Nothing else flagged from this item.")}
            </p>
          </div>
        </div>
      </section>

      <button
        type="button"
        data-testid={`button-show-vyva-explain-${testIdSuffix}`}
        onClick={() => setExplainOpen((value) => !value)}
        className="mt-3 flex min-h-[44px] w-full items-center justify-between rounded-[15px] border border-[#EDE5DB] bg-[#FFFCF8] px-3 text-left font-body text-[13px] font-black text-vyva-text-2 transition active:scale-[0.99]"
        aria-expanded={explainOpen}
      >
        <span>{explainOpen ? t("showVyva.handoff.hideExplain", "Hide explanation") : t("showVyva.handoff.explain", "Explain")}</span>
        <ChevronDown size={17} className={explainOpen ? "rotate-180 transition" : "transition"} aria-hidden="true" />
      </button>

      {explainOpen ? (
      <div className="mt-3 grid gap-3" data-testid={`show-vyva-result-details-${testIdSuffix}`}>
        <section className="rounded-[16px] bg-[#FFFCF8] p-3">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.09em] text-[#7C3AED]">
            {t("showVyva.contract.sections.reviewed", "What VYVA reviewed")}
          </p>
          <p data-testid={`show-vyva-result-reviewed-${testIdSuffix}`} className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-1">
            {reviewedLabel ?? defaultReviewedLabel}
          </p>
        </section>

        <section className="rounded-[16px] bg-[#F0FDFA] p-3">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.09em] text-[#7C3AED]">
            {t("showVyva.contract.sections.visible", "What is visible")}
          </p>
          <p data-testid={`show-vyva-result-thinks-${testIdSuffix}`} className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-1">
            {thinkingLabel ?? verifiedObservations[0]}
          </p>
          {verifiedObservations.length > 1 ? (
            <ul className="mt-2 grid gap-1.5">
              {verifiedObservations.slice(1, 4).map((item, index) => (
                <li key={`${item}-${index}`} className="font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {warningSigns.length ? (
          <section className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] p-3" data-testid={`show-vyva-result-warning-signs-${testIdSuffix}`}>
            <p className="font-body text-[11px] font-black uppercase tracking-[0.09em] text-[#92400E]">
              {t("showVyva.contract.sections.warningSigns", "Warning signs")}
            </p>
            <ul className="mt-2 grid gap-1.5">
              {warningSigns.slice(0, 4).map((item, index) => (
                <li key={`${item}-${index}`} className="font-body text-[13px] font-semibold leading-snug text-[#78350F]">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] p-3" data-testid={`show-vyva-result-unknowns-${testIdSuffix}`}>
          <p className="font-body text-[11px] font-black uppercase tracking-[0.09em] text-[#475569]">
            {t("showVyva.contract.sections.unknowns", "What VYVA cannot confirm")}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {unknowns.slice(0, 4).map((item, index) => (
              <li key={`${item}-${index}`} className="font-body text-[13px] font-semibold leading-snug text-[#475569]">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[16px] p-3" style={{ background: tone.bg, border: `1px solid ${tone.border}` }}>
          <p className="font-body text-[11px] font-black uppercase tracking-[0.09em]" style={{ color: tone.text }}>
            {t("showVyva.contract.sections.urgency", "Risk or urgency")}
          </p>
          <p className="mt-1 font-body text-[15px] font-black leading-snug" style={{ color: tone.text }}>
            {riskLabel}
          </p>
        </section>

        <section className="rounded-[16px] bg-[#F0FDFA] p-3">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.09em] text-[#0F766E]">
            {t("showVyva.contract.sections.recommendedNextStep", "Recommended next step")}
          </p>
          <p data-testid={`show-vyva-result-next-step-${testIdSuffix}`} className="mt-1 font-body text-[14px] font-black leading-snug text-[#134E4A]">
            {nextSteps[0]}
          </p>
          {nextSteps.length > 1 ? (
            <ul className="mt-2 grid gap-1.5">
              {nextSteps.slice(1, 4).map((step, index) => (
                <li key={`${step}-${index}`} className="font-body text-[13px] font-semibold leading-snug text-[#0F766E]">
                  {step}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
      ) : null}

      {onActionSelect && followUpActions.length ? (
        <ShowVyvaFollowUpPanel
          context={contract.followUpContext}
          testIdSuffix={testIdSuffix}
          title={actionTitle ?? t("showVyva.handoff.actionsTitle", "Choose a safe action")}
          subtitle={actionSubtitle}
          confirmation={t("showVyva.contract.finalConfirmation", contract.finalConfirmationRule)}
          actions={followUpActions}
          onSelect={(action) => onActionSelect(action, contract)}
        />
      ) : (
        <p className="mt-3 rounded-[13px] bg-[#FFFCF8] px-3 py-2 font-body text-[12px] font-bold leading-snug text-[#6F5F59]">
          {t("showVyva.contract.finalConfirmation", contract.finalConfirmationRule)}
        </p>
      )}
    </section>
  );
}
