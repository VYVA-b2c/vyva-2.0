import { ChevronRight, type LucideIcon } from "lucide-react";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

type SymptomChoiceCardProps = {
  Icon: LucideIcon;
  accent?: VyvaIconAccent;
  label: string;
  disabled?: boolean;
  testId?: string;
  onClick: () => void;
};

export function SymptomChoiceCard({
  Icon,
  accent = "dot",
  label,
  disabled = false,
  testId,
  onClick,
}: SymptomChoiceCardProps) {
  const { isDark } = useHomeMasterTheme();

  return (
    <button
      type="button"
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={`symptom-canonical-choice group vyva-tap flex min-h-[72px] w-full items-center gap-3 rounded-[18px] border px-4 py-3.5 text-left shadow-[0_8px_22px_rgba(0,0,0,0.08)] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8B5CF6]/30 disabled:cursor-not-allowed disabled:opacity-55 ${isDark ? "border-white/[0.13] bg-[#352842] text-[#FFF8FF] hover:border-[#8B5CF6]/55 hover:bg-[#3D2D4B]" : "border-[#DED3E2] bg-white text-[#241238] hover:border-[#BFA2D8] hover:bg-[#FFFCFF]"}`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${isDark ? "bg-[#45325E]" : "bg-[#F3EAFF]"}`}>
        <VyvaIcon icon={Icon} accent={accent} size={21} strokeWidth={2.45} />
      </span>
      <span className="min-w-0 flex-1 font-body text-[17px] font-semibold leading-[1.42] tracking-[-0.005em]">
        {label}
      </span>
      <VyvaIcon
        icon={ChevronRight}
        tone="muted"
        size={20}
        strokeWidth={2.5}
        className={`shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-[#8B5CF6] ${isDark ? "text-[#B9ACC5]" : "text-[#9B83AD]"}`}
      />
    </button>
  );
}
