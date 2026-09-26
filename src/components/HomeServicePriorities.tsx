import { useState } from "react";
import { HOME_SERVICE_COMMON_CRITERIA } from "../../shared/serviceIntake";

export function HomeServicePriorities({ isSpanish, onContinue }: {
  isSpanish: boolean;
  onContinue: (value: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(key: string) {
    setSelected(current => {
      if (current.includes(key)) return current.filter(value => value !== key);
      if (key === "not_sure") return [key];
      const priorities = current.filter(value => value !== "not_sure");
      return priorities.length < 2 ? [...priorities, key] : priorities;
    });
  }
  return <fieldset className="mt-3" aria-label={isSpanish ? "Prioridades" : "Priorities"}>
    <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
      {HOME_SERVICE_COMMON_CRITERIA.map(option => {
        const checked = selected.includes(option.key);
        const disabled = !checked && option.key !== "not_sure" && selected.length >= 2;
        return <label key={option.key} className={`flex min-h-[54px] items-center gap-3 rounded-[18px] border px-4 py-3 text-[15px] font-semibold text-vyva-text-1 ${checked ? "border-vyva-purple bg-vyva-purple/15" : "border-vyva-text-3/30 bg-vyva-text-1/5"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(option.key)} className="h-5 w-5 shrink-0 accent-vyva-purple" data-testid={`button-home-service-answer-${option.key}`} />
          <span className="min-w-0 break-words">{isSpanish ? option.es : option.en}</span>
        </label>;
      })}
    </div>
    <div className="mt-4 flex items-center justify-between gap-4">
      <span className="text-sm text-vyva-text-2" aria-live="polite">{selected.includes("not_sure") ? (isSpanish ? "Sin preferencia" : "No preference") : `${selected.length}/2`}</span>
      <button type="button" disabled={selected.length === 0} onClick={() => onContinue(selected.join(","))} data-testid="button-home-service-priorities-continue" className="min-h-[48px] rounded-full bg-vyva-purple px-7 py-3 font-semibold text-white disabled:opacity-40">
        {isSpanish ? "Continuar" : "Continue"}
      </button>
    </div>
  </fieldset>;
}
