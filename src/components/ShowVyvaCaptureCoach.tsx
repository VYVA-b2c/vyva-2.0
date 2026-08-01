import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Camera, Check, FileText, RotateCcw, RotateCw, ShieldCheck, X } from "lucide-react";
import { rotateShowVyvaPreparedEvidence, type ShowVyvaPreparedEvidence } from "@/lib/showVyvaEvidence";
import { getShowVyvaUseCase, type ShowVyvaUseCaseId } from "../../shared/showVyvaFlow";

type ShowVyvaCaptureCoachProps = {
  evidence: ShowVyvaPreparedEvidence;
  useCaseId: ShowVyvaUseCaseId;
  busy?: boolean;
  onUse: (evidence: ShowVyvaPreparedEvidence) => void;
  onRetake: () => void;
  onClose: () => void;
};

export default function ShowVyvaCaptureCoach({
  evidence,
  useCaseId,
  busy = false,
  onUse,
  onRetake,
  onClose,
}: ShowVyvaCaptureCoachProps) {
  const { t } = useTranslation();
  const [previewEvidence, setPreviewEvidence] = useState(evidence);
  const [rotating, setRotating] = useState(false);
  const needsCheck = previewEvidence.qualityIssues.length > 0;
  const useCase = getShowVyvaUseCase(useCaseId);
  const instruction = t(`showVyva.capture.instruction.${useCaseId}`, useCase.captureInstruction);

  useEffect(() => setPreviewEvidence(evidence), [evidence]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  const rotatePreview = async () => {
    if (previewEvidence.kind !== "image" || rotating || busy) return;
    setRotating(true);
    try {
      setPreviewEvidence(await rotateShowVyvaPreparedEvidence(previewEvidence));
    } finally {
      setRotating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#241B2E]/45 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="show-vyva-capture-title"
      data-testid="dialog-show-vyva-capture-coach"
    >
      <section className="max-h-[94vh] w-full overflow-y-auto rounded-t-[24px] bg-[#FFFCF8] shadow-[0_24px_70px_rgba(36,27,46,0.24)] sm:max-w-[560px] sm:rounded-[24px]">
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-[#EDE5DB] bg-[#FFFCF8] px-5 py-4">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
            {previewEvidence.kind === "pdf" ? <FileText size={22} aria-hidden="true" /> : <Camera size={22} aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="show-vyva-capture-title" className="font-body text-[21px] font-black leading-tight text-vyva-text-1">
              {t("showVyva.capture.previewTitle", "Use this for the review?")}
            </h2>
            <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
              {t("showVyva.capture.changeAnything", "Check it first. Your current task stays open.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[#EDE5DB] bg-white text-vyva-text-2 disabled:opacity-50"
            aria-label={t("showVyva.capture.close", "Close preview")}
            data-testid="button-show-vyva-capture-close"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <div className="overflow-hidden rounded-[18px] border border-[#EDE5DB] bg-[#F5EFE4]">
            <img
              src={previewEvidence.dataUrl}
              alt={t("showVyva.capture.previewAlt", "Preview of the item for VYVA to review")}
              className="max-h-[42vh] min-h-[220px] w-full object-contain"
              data-testid="image-show-vyva-capture-preview"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EDE5DB] bg-white px-3 py-2">
              <p className="min-w-0 truncate font-body text-[12px] font-bold text-vyva-text-2">{previewEvidence.fileName}</p>
              {previewEvidence.kind === "pdf" ? (
                <span className="rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[11px] font-black text-vyva-purple">
                  {t("showVyva.capture.pdfFirstPage", "PDF - first page")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-[16px] border border-[#D8CFF7] bg-[#F8F6FF] p-3">
            <Camera size={19} className="mt-0.5 flex-shrink-0 text-vyva-purple" aria-hidden="true" />
            <div>
              <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-purple">
                {t("showVyva.capture.tip", "For a clearer review")}
              </p>
              <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-1" data-testid="text-show-vyva-capture-instruction">
                {instruction}
              </p>
            </div>
          </div>

          <div
            className={`rounded-[16px] border p-3 ${
              needsCheck ? "border-[#FDE68A] bg-[#FFFBEB]" : "border-[#BBF7D0] bg-[#F0FDF4]"
            }`}
            data-testid="section-show-vyva-capture-quality"
          >
            <div className="flex items-center gap-2">
              {needsCheck ? (
                <AlertTriangle size={19} className="text-[#A16207]" aria-hidden="true" />
              ) : (
                <Check size={19} className="text-[#047857]" aria-hidden="true" />
              )}
              <p className={`font-body text-[14px] font-black ${needsCheck ? "text-[#854D0E]" : "text-[#047857]"}`}>
                {needsCheck
                  ? t("showVyva.capture.qualityCheck", "Check this before using it")
                  : t("showVyva.capture.qualityGood", "Looks clear enough to review")}
              </p>
            </div>
            {needsCheck ? (
              <ul className="mt-2 space-y-1 pl-7 font-body text-[13px] font-semibold leading-snug text-[#713F12]">
                {previewEvidence.qualityIssues.map((issue) => (
                  <li key={issue} data-testid={`text-show-vyva-quality-${issue}`}>
                    {t(`showVyva.capture.quality.${issue}`, {
                      dark: "The image may be too dark.",
                      glare: "Glare may hide important details.",
                      blur: "The image may be blurry.",
                      framing: "Some details may be too small or outside the frame.",
                    }[issue])}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-[16px] border border-[#CDEAE5] bg-[#F2FBF9] p-3" data-testid="section-show-vyva-capture-privacy">
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className="mt-0.5 flex-shrink-0 text-[#0F766E]" aria-hidden="true" />
              <div>
                <p className="font-body text-[14px] font-black text-[#115E59]">
                  {t("showVyva.capture.privacyTitle", "You choose what VYVA sees")}
                </p>
                <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-[#35645F]">
                  {t("showVyva.capture.privacyBody", "Only this image and your question are sent for this review. The image itself is not saved to history; the written review may be saved.")}
                </p>
              </div>
            </div>
          </div>

          <div className={`grid gap-3 ${previewEvidence.kind === "image" ? "grid-cols-3" : "grid-cols-2"}`}>
            <button
              type="button"
              onClick={onRetake}
              disabled={busy}
              className="vyva-tap flex min-h-[54px] items-center justify-center gap-2 rounded-[16px] border border-[#D8CFF7] bg-white px-3 font-body text-[15px] font-black text-vyva-purple disabled:opacity-50"
              data-testid="button-show-vyva-capture-retake"
            >
              <RotateCcw size={19} aria-hidden="true" />
              {t("showVyva.capture.retake", "Retake")}
            </button>
            {previewEvidence.kind === "image" ? (
              <button
                type="button"
                onClick={rotatePreview}
                disabled={busy || rotating}
                className="vyva-tap flex min-h-[54px] items-center justify-center gap-2 rounded-[16px] border border-[#CDEAE5] bg-white px-2 font-body text-[14px] font-black text-[#0F766E] disabled:opacity-50"
                data-testid="button-show-vyva-capture-rotate"
              >
                <RotateCw size={19} aria-hidden="true" />
                {t("showVyva.capture.rotate", "Rotate")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onUse(previewEvidence)}
              disabled={busy || rotating}
              className="vyva-tap flex min-h-[54px] items-center justify-center gap-2 rounded-[16px] bg-vyva-purple px-3 font-body text-[15px] font-black text-white shadow-[0_8px_20px_rgba(107,33,168,0.2)] disabled:opacity-50"
              data-testid="button-show-vyva-capture-use"
            >
              <Check size={19} aria-hidden="true" />
              {busy ? t("showVyva.busy", "Reviewing...") : t("showVyva.capture.useThis", "Use this")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
