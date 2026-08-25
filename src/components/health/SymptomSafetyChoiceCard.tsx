import { ChevronRight, type LucideIcon } from "lucide-react";

type SymptomSafetyChoiceCardProps = {
  Icon: LucideIcon;
  label: string;
  isClearChoice?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function SymptomSafetyChoiceCard({
  Icon,
  label,
  isClearChoice = false,
  disabled = false,
  onClick,
}: SymptomSafetyChoiceCardProps) {
  const safetyTone = isClearChoice ? "clear" : "warning";

  return (
    <button
      type="button"
      disabled={disabled}
      data-safety-tone={safetyTone}
      onClick={onClick}
      className={`group vyva-tap flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border bg-white px-4 py-3 text-left shadow-[0_6px_18px_rgba(63,45,75,0.05)] transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-55 ${
        isClearChoice
          ? "border-[#B7DFC9] text-[#14532D] hover:border-[#73C394] hover:bg-[#F7FFF9] focus-visible:ring-[#C7EED6]"
          : "border-[#F0C5C5] text-[#7F1D1D] hover:border-[#DD9292] hover:bg-[#FFF9F9] focus-visible:ring-[#F5CECE]"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${
          isClearChoice ? "bg-[#EAF8EF] text-[#15803D]" : "bg-[#FFF0F0] text-[#B91C1C]"
        }`}
      >
        <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 font-body text-[15px] font-black leading-[1.28]">
        {label}
      </span>
      <ChevronRight
        size={20}
        strokeWidth={2.5}
        className="shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}
