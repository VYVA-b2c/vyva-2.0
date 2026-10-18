import { CheckCircle2, X } from "lucide-react";
import {
  BRAIN_COACH_COMPLETION_SHELL_CONTRACT,
  getBrainCoachPresentationAttributes,
} from "@/components/brain/brainCoachPresentation";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { cn } from "@/lib/utils";

function metricGridClass(count) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  return "grid-cols-2 sm:grid-cols-4";
}

function actionGridClass(count) {
  if (count <= 1) return "sm:grid-cols-1";
  if (count === 2) return "sm:grid-cols-2";
  return "sm:grid-cols-3";
}

export default function BrainGameCompletionDialog({
  title,
  summary,
  metrics = [],
  details = null,
  continueLabel,
  continueHint,
  nextLevelLabel,
  nextLevelDisplayLabel,
  stayLabel,
  replayLabel,
  anotherLabel,
  assessmentReturnLabel,
  assessmentReturnHint,
  onContinue,
  onNextLevel,
  onStay,
  onReplay,
  onAnother,
  onAssessmentReturn,
  onClose,
  closeLabel = "Close",
  appearance = "theme",
  disabled = false,
  className = "",
  embedded = false,
}) {
  const { isDark } = useHomeMasterTheme();
  const usesDarkSurface = appearance === "theme" && isDark;
  const visibleMetrics = metrics.filter(Boolean);
  const hasNextLevel = Boolean(onNextLevel && nextLevelLabel);
  const primaryLabel = hasNextLevel ? nextLevelDisplayLabel ?? nextLevelLabel : continueLabel;
  const primaryAriaLabel = hasNextLevel ? nextLevelLabel : continueLabel;
  const primaryAction = hasNextLevel ? onNextLevel : onContinue;
  const titleId = "brain-game-completion-title";
  const summaryId = "brain-game-completion-summary";
  const actions = [
    primaryAction && primaryLabel
      ? {
          id: "primary",
          label: primaryLabel,
          ariaLabel: primaryAriaLabel,
          hint: continueHint && !hasNextLevel ? continueHint : null,
          onClick: primaryAction,
          className:
            "bg-vyva-purple text-white shadow-vyva-card",
        }
      : null,
    onStay && stayLabel
      ? {
          id: "stay",
          label: stayLabel,
          onClick: onStay,
          className: usesDarkSurface
            ? "border border-white/[0.16] bg-white/[0.08] text-[#F7F0FF]"
            : "border-2 border-[#D8C7F3] bg-white text-vyva-purple shadow-vyva-card",
        }
      : null,
    onReplay && replayLabel
      ? {
          id: "replay",
          label: replayLabel,
          onClick: onReplay,
          className: usesDarkSurface
            ? "border border-white/[0.16] bg-white/[0.08] text-[#F7F0FF]"
            : "border-2 border-[#D8C7F3] bg-white text-vyva-purple shadow-vyva-card",
        }
      : null,
    onAnother && anotherLabel
      ? {
          id: "another",
          label: anotherLabel,
          onClick: onAnother,
          className: usesDarkSurface
            ? "border border-white/[0.16] bg-white/[0.08] text-[#F7F0FF]"
            : "border-2 border-vyva-border bg-white text-vyva-text-1 shadow-vyva-card",
        }
      : null,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        embedded ? "w-full pb-28 pt-2" : "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 py-3 backdrop-blur-[3px] sm:items-center sm:px-4 sm:py-6",
        !embedded && (usesDarkSurface ? "bg-black/60" : "bg-[rgba(43,34,51,0.42)]"),
        className,
      )}
      role={embedded ? "region" : "dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-labelledby={titleId}
      aria-describedby={summary ? summaryId : undefined}
      {...getBrainCoachPresentationAttributes({
        approvedFrame: "brain_coach.activity_session.completion",
        presentationId: "brain_coach.activity_session.completion.touch",
        sceneId: "brain_coach.activity_session.completion",
        state: "complete",
        sceneKind: "completion_dialog",
        sceneLayout: "modal_actions",
        shellContract: BRAIN_COACH_COMPLETION_SHELL_CONTRACT,
      })}
    >
      <div className={cn(
        embedded ? "relative mx-auto w-full max-w-[680px] text-center" : "relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[680px] overflow-y-auto overscroll-contain rounded-[24px] border px-4 py-4 text-center shadow-[0_28px_80px_rgba(43,34,51,0.28)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[30px] sm:px-7 sm:py-7",
        embedded ? (usesDarkSurface ? "text-[#F7F0FF]" : "text-[#241C30]") : usesDarkSurface ? "border-white/[0.14] bg-[#21162D] text-[#F7F0FF]" : "border-white/80 bg-white text-[#241C30]",
      )}>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            aria-label={closeLabel}
            className={cn(
              "absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full transition-colors disabled:opacity-60",
              usesDarkSurface ? "bg-white/[0.08] text-[#F7F0FF] hover:bg-white/[0.14]" : "bg-[#F5F0F8] text-vyva-text-2 hover:bg-[#ECE3F2]",
            )}
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        )}

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#ECFDF5] text-[#0A7C4E] shadow-[0_12px_30px_rgba(10,124,78,0.18)] sm:h-[78px] sm:w-[78px] sm:rounded-[26px]">
          <CheckCircle2 className="h-8 w-8 sm:h-[38px] sm:w-[38px]" />
        </div>

        <h2 id={titleId} className={embedded ? "mt-4 font-display text-[26px] font-semibold leading-tight text-inherit" : "mt-3 font-display text-[28px] leading-tight text-inherit sm:mt-4 sm:text-[38px]"}>
          {title}
        </h2>
        {summary && (
          <p id={summaryId} className={cn("mx-auto mt-1.5 max-w-[42ch] text-[15px] font-medium leading-[1.4] sm:mt-2 sm:text-[17px] sm:leading-[1.45]", usesDarkSurface ? "text-[#D8CDE4]" : "text-vyva-text-2")}>
            {summary}
          </p>
        )}

        {visibleMetrics.length > 0 && (
          <dl className={cn("mt-4 grid overflow-hidden rounded-[20px] border sm:mt-5 sm:rounded-[22px]", embedded ? "grid-cols-2" : metricGridClass(visibleMetrics.length), usesDarkSurface ? "border-white/[0.12] bg-white/[0.10]" : "border-[#EADFF8] bg-[#EADFF8]")}>
            {visibleMetrics.map((item, index) => (
              <div key={item.label} className={cn("px-3 py-3 sm:py-4", embedded && visibleMetrics.length % 2 === 1 && index === visibleMetrics.length - 1 && "col-span-2", usesDarkSurface ? "bg-white/[0.06]" : "bg-[#FFF9F1]")}>
                <dt className={cn("text-[12px] font-semibold uppercase", usesDarkSurface ? "text-[#CFC1DB]" : "text-vyva-text-2")}>{item.label}</dt>
                <dd className="mt-1 text-[22px] font-extrabold leading-none text-inherit sm:text-[24px]">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {onAssessmentReturn && assessmentReturnLabel && (
          <div className="mt-5 rounded-[20px] border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-4 text-left text-[#0F766E]">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">Assessment practice</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <p className="text-[17px] font-extrabold leading-snug text-vyva-text-1">
                {assessmentReturnHint || "Good. You practiced the area VYVA noticed."}
              </p>
              <button
                type="button"
                onClick={onAssessmentReturn}
                disabled={disabled}
                className="min-h-[54px] rounded-full bg-[#0F766E] px-5 text-[17px] font-black text-white shadow-vyva-card disabled:opacity-60"
              >
                {assessmentReturnLabel}
              </button>
            </div>
          </div>
        )}

        {actions.length > 0 && (
          <div className={`mt-4 grid gap-2.5 sm:mt-6 sm:gap-3 ${actionGridClass(actions.length)}`}>
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                disabled={disabled}
                aria-label={action.ariaLabel}
                className={`flex min-h-14 flex-col items-center justify-center rounded-full px-4 py-2.5 text-center text-[18px] font-extrabold leading-[1.08] disabled:opacity-60 sm:min-h-[64px] sm:py-3 sm:text-[20px] ${action.hint ? "gap-1" : ""} ${action.className}`}
              >
                <span>{action.label}</span>
                {action.hint && (
                  <span className="sr-only">{action.hint}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {details && (
          <div className={embedded ? "mt-6 text-left" : "mt-4 text-left sm:mt-5"}>
            {details}
          </div>
        )}
      </div>
    </div>
  );
}
