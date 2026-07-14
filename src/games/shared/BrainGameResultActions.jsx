export default function BrainGameResultActions({
  continueLabel,
  continueHint,
  nextLevelLabel,
  replayLabel,
  anotherLabel,
  onContinue,
  onNextLevel,
  onReplay,
  onAnother,
  disabled = false,
  className = "",
}) {
  if (onNextLevel && nextLevelLabel) {
    const secondaryButtonClass =
      "min-h-[48px] whitespace-normal rounded-full border-2 bg-white px-4 py-2 text-center text-[15px] font-extrabold leading-[1.1] shadow-vyva-card disabled:opacity-60 sm:whitespace-nowrap sm:text-[16px]";

    return (
      <div className={`grid w-full gap-2 sm:grid-cols-[1.2fr_1fr_1.15fr] ${className}`}>
        <button
          type="button"
          onClick={onNextLevel}
          disabled={disabled}
          className="min-h-[48px] whitespace-normal rounded-full bg-vyva-purple px-4 py-2 text-center text-[16px] font-extrabold leading-[1.1] text-white shadow-vyva-card disabled:opacity-60 sm:whitespace-nowrap sm:text-[17px]"
        >
          {nextLevelLabel}
        </button>
        <button
          type="button"
          onClick={onReplay}
          disabled={disabled}
          className={`${secondaryButtonClass} border-[#D8C7F3] text-vyva-purple`}
        >
          {replayLabel}
        </button>
        <button
          type="button"
          onClick={onAnother}
          disabled={disabled}
          className={`${secondaryButtonClass} border-vyva-border text-vyva-text-1`}
        >
          {anotherLabel}
        </button>
      </div>
    );
  }

  return (
    <div className={`grid w-full gap-2.5 ${className}`}>
      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className={`flex ${continueHint ? "min-h-[76px]" : "min-h-[56px]"} w-full flex-col items-center justify-center rounded-full bg-vyva-purple px-5 py-3 text-center text-[19px] font-extrabold leading-[1.05] text-white shadow-vyva-card disabled:opacity-60 sm:text-[21px]`}
      >
        <span>{continueLabel}</span>
        {continueHint && (
          <span className="mt-1 text-[18px] font-bold leading-[1.1] text-white/85 sm:text-[20px]">
            {continueHint}
          </span>
        )}
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onReplay}
          disabled={disabled}
          className="min-h-[56px] whitespace-normal rounded-full border-2 border-[#D8C7F3] bg-white px-4 py-3 text-center text-[18px] font-extrabold leading-[1.05] text-vyva-purple shadow-vyva-card disabled:opacity-60 sm:text-[20px]"
        >
          {replayLabel}
        </button>
        <button
          type="button"
          onClick={onAnother}
          disabled={disabled}
          className="min-h-[56px] whitespace-normal rounded-full border-2 border-vyva-border bg-white px-4 py-3 text-center text-[18px] font-extrabold leading-[1.05] text-vyva-text-1 shadow-vyva-card disabled:opacity-60 sm:text-[20px]"
        >
          {anotherLabel}
        </button>
      </div>
    </div>
  );
}
