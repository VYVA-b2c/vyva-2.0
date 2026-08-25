import { ChevronRight, type LucideIcon } from "lucide-react";

type SymptomChoiceCardProps = {
  Icon: LucideIcon;
  label: string;
  disabled?: boolean;
  testId?: string;
  onClick: () => void;
};

export function SymptomChoiceCard({
  Icon,
  label,
  disabled = false,
  testId,
  onClick,
}: SymptomChoiceCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className="group vyva-tap flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border border-[#DED3E2] bg-white px-4 py-3 text-left text-[#241238] shadow-[0_6px_18px_rgba(63,45,75,0.05)] transition hover:border-[#BFA2D8] hover:bg-[#FFFCFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D9C2F3] disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#F3EAFF] text-[#7024C4]">
        <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 font-body text-[15px] font-black leading-[1.28]">
        {label}
      </span>
      <ChevronRight
        size={20}
        strokeWidth={2.5}
        className="shrink-0 text-[#9B83AD] transition-transform group-hover:translate-x-0.5 group-hover:text-[#7024C4]"
        aria-hidden="true"
      />
    </button>
  );
}
