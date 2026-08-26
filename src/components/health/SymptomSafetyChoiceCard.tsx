import { ChevronRight, type LucideIcon } from "lucide-react";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

type SymptomSafetyChoiceCardProps = {
  Icon: LucideIcon;
  label: string;
  isClearChoice?: boolean;
  disabled?: boolean;
  testId?: string;
  onClick: () => void;
};

export function SymptomSafetyChoiceCard({
  Icon,
  label,
  isClearChoice = false,
  disabled = false,
  testId,
  onClick,
}: SymptomSafetyChoiceCardProps) {
  const { isDark } = useHomeMasterTheme();
  const safetyTone = isClearChoice ? "clear" : "warning";

  return (
    <button
      type="button"
      disabled={disabled}
      data-testid={testId}
      data-safety-tone={safetyTone}
      onClick={onClick}
      className={`symptom-canonical-choice group vyva-tap flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left shadow-[0_8px_22px_rgba(0,0,0,0.08)] transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-55 ${isClearChoice
        ? isDark
          ? "border-[#4ADE80]/35 bg-[#1D332B] text-[#86EFAC] hover:border-[#4ADE80]/65 hover:bg-[#223C31] focus-visible:ring-[#4ADE80]/25"
          : "border-[#B7DFC9] bg-white text-[#14532D] hover:border-[#73C394] hover:bg-[#F7FFF9] focus-visible:ring-[#C7EED6]"
        : isDark
          ? "border-[#FB7185]/35 bg-[#3A242E] text-[#FDA4AF] hover:border-[#FB7185]/65 hover:bg-[#432832] focus-visible:ring-[#FB7185]/25"
          : "border-[#F0C5C5] bg-white text-[#7F1D1D] hover:border-[#DD9292] hover:bg-[#FFF9F9] focus-visible:ring-[#F5CECE]"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${
          isClearChoice
            ? isDark ? "bg-[#234D3A]" : "bg-[#EAF8EF]"
            : isDark ? "bg-[#562C38]" : "bg-[#FFF0F0]"
        }`}
      >
        <VyvaIcon icon={Icon} size={20} strokeWidth={2.5} tone={isClearChoice ? "success" : "danger"} />
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
