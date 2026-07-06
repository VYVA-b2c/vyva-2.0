import { CheckCircle2 } from "lucide-react";

function metricGridClass(count) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  return "grid-cols-2 sm:grid-cols-4";
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
  replayLabel,
  anotherLabel,
  onContinue,
  onNextLevel,
  onReplay,
  onAnother,
  disabled = false,
  className = "",
}) {
  const visibleMetrics = metrics.filter(Boolean);
  const hasNextLevel = Boolean(onNextLevel && nextLevelLabel);
  const primaryLabel = hasNextLevel ? nextLevelDisplayLabel ?? nextLevelLabel : continueLabel;
  const primaryAriaLabel = hasNextLevel ? nextLevelLabel : continueLabel;
  const primaryAction = hasNextLevel ? onNextLevel : onContinue;
  const titleId = "brain-game-completion-title";
  const summaryId = "brain-game-completion-summary";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,34,51,0.42)] px-4 py-6 backdrop-blur-[2px] ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={summary ? summaryId : undefined}
    >
      <div className="w-full max-w-[720px] rounded-[30px] border border-white/80 bg-white px-5 py-6 text-center shadow-[0_28px_80px_rgba(43,34,51,0.28)] sm:px-7 sm:py-7">
        <div className="mx-auto flex h-[78px] w-[78px] items-center justify-center rounded-[26px] bg-[#ECFDF5] text-[#0A7C4E] shadow-[0_12px_30px_rgba(10,124,78,0.18)]">
          <CheckCircle2 size={38} />
        </div>

        <h2 id={titleId} className="mt-4 font-display text-[34px] leading-tight text-vyva-text-1 sm:text-[38px]">
          {title}
        </h2>
        {summary && (
          <p id={summaryId} className="mx-auto mt-2 max-w-[42ch] text-[16px] font-medium leading-[1.45] text-vyva-text-2 sm:text-[17px]">
            {summary}
          </p>
        )}

        {visibleMetrics.length > 0 && (
          <dl className={`mt-5 grid overflow-hidden rounded-[20px] border border-[#EADFF8] bg-[#EADFF8] ${metricGridClass(visibleMetrics.length)}`}>
            {visibleMetrics.map((item) => (
              <div key={item.label} className="bg-[#FFF9F1] px-3 py-4">
                <dt className="text-[12px] font-semibold uppercase text-vyva-text-2">{item.label}</dt>
                <dd className="mt-1 text-[24px] font-extrabold leading-none text-vyva-text-1">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={primaryAction}
            disabled={disabled || !primaryAction}
            aria-label={primaryAriaLabel}
            className={`flex min-h-[64px] flex-col items-center justify-center rounded-full bg-vyva-purple px-4 py-3 text-center text-[20px] font-extrabold leading-[1.08] text-white shadow-vyva-card disabled:opacity-60 ${continueHint && !hasNextLevel ? "gap-1" : ""}`}
          >
            <span>{primaryLabel}</span>
            {continueHint && !hasNextLevel && (
              <span className="text-[14px] font-bold leading-[1.15] text-white/85 sm:text-[15px]">{continueHint}</span>
            )}
          </button>
          <button
            type="button"
            onClick={onReplay}
            disabled={disabled || !onReplay}
            className="min-h-[64px] rounded-full border-2 border-[#D8C7F3] bg-white px-4 py-3 text-center text-[20px] font-extrabold leading-[1.08] text-vyva-purple shadow-vyva-card disabled:opacity-60"
          >
            {replayLabel}
          </button>
          <button
            type="button"
            onClick={onAnother}
            disabled={disabled || !onAnother}
            className="min-h-[64px] rounded-full border-2 border-vyva-border bg-white px-4 py-3 text-center text-[20px] font-extrabold leading-[1.08] text-vyva-text-1 shadow-vyva-card disabled:opacity-60"
          >
            {anotherLabel}
          </button>
        </div>

        {details && (
          <div className="mt-5 max-h-[28dvh] overflow-y-auto pr-1 text-left">
            {details}
          </div>
        )}
      </div>
    </div>
  );
}
