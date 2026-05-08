export default function BrainGameResultActions({
  continueLabel,
  continueHint,
  replayLabel,
  anotherLabel,
  onContinue,
  onReplay,
  onAnother,
  disabled = false,
  className = "",
}) {
  return (
    <div className={`grid w-full gap-3 ${className}`}>
      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className={`flex ${continueHint ? "min-h-[88px]" : "min-h-[64px]"} w-full flex-col items-center justify-center rounded-full bg-vyva-purple px-5 py-3 text-center text-[22px] font-extrabold leading-[1.05] text-white shadow-vyva-card disabled:opacity-60`}
      >
        <span>{continueLabel}</span>
        {continueHint && (
          <span className="mt-1 text-[22px] font-bold leading-[1.1] text-white/85">
            {continueHint}
          </span>
        )}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onReplay}
          disabled={disabled}
          className="min-h-[64px] whitespace-normal rounded-full border-2 border-[#D8C7F3] bg-white px-4 py-3 text-center text-[22px] font-extrabold leading-[1.05] text-vyva-purple shadow-vyva-card disabled:opacity-60"
        >
          {replayLabel}
        </button>
        <button
          type="button"
          onClick={onAnother}
          disabled={disabled}
          className="min-h-[64px] whitespace-normal rounded-full border-2 border-vyva-border bg-white px-4 py-3 text-center text-[22px] font-extrabold leading-[1.05] text-vyva-text-1 shadow-vyva-card disabled:opacity-60"
        >
          {anotherLabel}
        </button>
      </div>
    </div>
  );
}
