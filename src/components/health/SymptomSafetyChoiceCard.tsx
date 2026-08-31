import { ChevronRight, type LucideIcon } from "lucide-react";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

export type SymptomSafetyChoiceTone = "warning" | "caution" | "clear";

type SymptomSafetyChoiceCardProps = {
  Icon: LucideIcon;
  label: string;
  tone?: SymptomSafetyChoiceTone;
  accent?: VyvaIconAccent;
  disabled?: boolean;
  testId?: string;
  onClick: () => void;
};

export function SymptomSafetyChoiceCard({
  Icon,
  label,
  tone = "warning",
  accent = "dot",
  disabled = false,
  testId,
  onClick,
}: SymptomSafetyChoiceCardProps) {
  const { isDark } = useHomeMasterTheme();
  const isClearChoice = tone === "clear";
  const isCautionChoice = tone === "caution";
  const toneClass = isClearChoice
    ? isDark
      ? "border-[#4ADE80]/35 bg-[#1D332B] text-[#A7F3D0] hover:border-[#4ADE80]/65 hover:bg-[#223C31] focus-visible:ring-[#4ADE80]/25"
      : "border-[#B7DFC9] bg-white text-[#14532D] hover:border-[#73C394] hover:bg-[#F7FFF9] focus-visible:ring-[#C7EED6]"
    : isCautionChoice
      ? isDark
        ? "border-[#F8AE1B]/32 bg-[#382D24] text-[#FCD98A] hover:border-[#F8AE1B]/58 hover:bg-[#433426] focus-visible:ring-[#F8AE1B]/24"
        : "border-[#E8CF9D] bg-white text-[#7A4A00] hover:border-[#D6AE5B] hover:bg-[#FFFCF5] focus-visible:ring-[#F6E2B8]"
      : isDark
        ? "border-[#FB7185]/35 bg-[#3A242E] text-[#FDA4AF] hover:border-[#FB7185]/65 hover:bg-[#432832] focus-visible:ring-[#FB7185]/25"
        : "border-[#F0C5C5] bg-white text-[#7F1D1D] hover:border-[#DD9292] hover:bg-[#FFF9F9] focus-visible:ring-[#F5CECE]";
  const tileClass = isClearChoice
    ? isDark ? "bg-[#234D3A]" : "bg-[#EAF8EF]"
    : isCautionChoice
      ? isDark ? "bg-[#52402A]" : "bg-[#FFF5DD]"
      : isDark ? "bg-[#562C38]" : "bg-[#FFF0F0]";
  const iconTone = isClearChoice ? "success" : isCautionChoice ? "warning" : "danger";

  return (
    <button
      type="button"
      disabled={disabled}
      data-testid={testId}
      data-safety-tone={tone}
      onClick={onClick}
      className={`symptom-canonical-choice group vyva-tap flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left shadow-[0_8px_22px_rgba(0,0,0,0.08)] transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-55 [@media(max-height:800px)]:min-h-[60px] [@media(max-height:800px)]:py-2 ${toneClass}`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${tileClass}`}
      >
        <VyvaIcon icon={Icon} accent={accent} size={20} strokeWidth={2.5} tone={iconTone} />
      </span>
      <span className="min-w-0 flex-1 font-body text-[16px] font-semibold leading-[1.4] tracking-[-0.005em]">
        {label}
      </span>
      <VyvaIcon
        icon={ChevronRight}
        tone={iconTone}
        size={20}
        strokeWidth={2.5}
        className="shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
      />
    </button>
  );
}
