import { useState } from "react";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

export type SeverityScaleChoice = {
  id: string;
  label: string;
  value: string;
};

type SeverityScaleControlProps = {
  choices: SeverityScaleChoice[];
  onSubmit: (choice: SeverityScaleChoice) => void | Promise<void>;
  disabled?: boolean;
  continueLabel?: string;
  minimumLabel?: string;
  maximumLabel?: string;
};

function numericValue(choice: SeverityScaleChoice): number | null {
  const label = choice.label.trim();
  if (!/^\d+$/.test(label)) return null;
  const value = Number(label);
  return Number.isFinite(value) ? value : null;
}

export function isNumericSeverityScaleChoices(choices: SeverityScaleChoice[]): boolean {
  return choices.length > 1 && choices.every((choice) => numericValue(choice) !== null);
}

export function SeverityScaleControl({
  choices,
  onSubmit,
  disabled = false,
  continueLabel = "Continue",
  minimumLabel = "None",
  maximumLabel = "Worst imaginable",
}: SeverityScaleControlProps) {
  const { isDark } = useHomeMasterTheme();
  const numericChoices = choices
    .map((choice) => ({ choice, number: numericValue(choice) }))
    .filter((item): item is { choice: SeverityScaleChoice; number: number } => item.number !== null)
    .sort((left, right) => left.number - right.number);
  const minimum = numericChoices[0]?.number ?? 0;
  const maximum = numericChoices.at(-1)?.number ?? 10;
  const midpoint = Math.round((minimum + maximum) / 2);
  const [selectedValue, setSelectedValue] = useState(midpoint);
  const selectedChoice = numericChoices.find((item) => item.number === selectedValue)?.choice;
  const percentage = maximum === minimum
    ? 0
    : ((selectedValue - minimum) / (maximum - minimum)) * 100;

  if (!numericChoices.length) return null;

  return (
    <div
      className={`mx-auto max-w-[430px] rounded-[22px] border p-4 shadow-[0_12px_28px_rgba(0,0,0,0.10)] sm:p-5 [@media(max-height:800px)]:p-3 ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#E2D7E8] bg-white"}`}
      data-testid="symptom-severity-scale"
    >
      <output
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#7024C4] font-body text-[26px] font-black text-white shadow-[0_10px_22px_rgba(112,36,196,0.22)] [@media(max-height:800px)]:h-14 [@media(max-height:800px)]:w-14 [@media(max-height:800px)]:text-[23px]"
        htmlFor="symptom-severity-range"
        aria-live="polite"
      >
        {selectedValue}
      </output>

      <input
        id="symptom-severity-range"
        type="range"
        min={minimum}
        max={maximum}
        step={1}
        value={selectedValue}
        disabled={disabled}
        onChange={(event) => setSelectedValue(Number(event.currentTarget.value))}
        aria-label={`Symptom severity from ${minimum} to ${maximum}`}
        className="vyva-severity-range mt-6 w-full disabled:cursor-not-allowed disabled:opacity-55 [@media(max-height:800px)]:mt-4"
        style={{
          background: `linear-gradient(to right, #7024C4 0%, #7024C4 ${percentage}%, #E7DDEB ${percentage}%, #E7DDEB 100%)`,
        }}
      />

      <div className={`mt-2 flex items-start justify-between gap-3 text-[12px] font-bold leading-tight ${isDark ? "text-[#D2C6DC]" : "text-[#746A72]"}`}>
        <span className="text-left">{minimum} · {minimumLabel}</span>
        <span className="max-w-[120px] text-right">{maximum} · {maximumLabel}</span>
      </div>

      <button
        type="button"
        disabled={disabled || !selectedChoice}
        onClick={() => selectedChoice && void onSubmit(selectedChoice)}
        className="vyva-primary-action mt-5 min-h-[56px] w-full text-[16px] font-black shadow-[0_10px_22px_rgba(112,36,196,0.18)] [@media(max-height:800px)]:mt-4 [@media(max-height:800px)]:min-h-[50px]"
        data-testid="symptom-severity-continue"
      >
        {continueLabel}
      </button>
    </div>
  );
}
