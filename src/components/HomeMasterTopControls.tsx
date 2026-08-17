import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { VyvaMark } from "@/components/VyvaMark";

type HomeMasterTopbarProps = {
  children: ReactNode;
  className?: string;
  testId?: string;
};

type HomeMasterProfileControlProps = {
  isDark: boolean;
  onClick: () => void;
  testId: string;
  ariaLabel: string;
  expanded?: boolean;
  controls?: string;
};

type HomeMasterActionControlProps = {
  isDark: boolean;
  icon: LucideIcon;
  onClick: () => void;
  testId: string;
  ariaLabel: string;
};

const TOPBAR_LAYOUT_CLASS =
  "grid grid-cols-[40px_1fr_40px] items-center gap-3 px-1 sm:grid-cols-[44px_1fr_44px] sm:px-3 lg:grid-cols-[52px_1fr_52px] lg:gap-5 lg:px-5";

const ROUND_CONTROL_BASE =
  "vyva-tap relative flex h-9 !min-h-9 w-9 items-center justify-center rounded-full shadow-[0_10px_22px_rgba(36,28,48,0.07)] sm:h-10 sm:!min-h-10 sm:w-10 lg:h-12 lg:!min-h-12 lg:w-12";

const ACTION_CONTROL_BASE =
  "vyva-tap flex h-9 !min-h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)] sm:h-10 sm:!min-h-10 sm:w-10 lg:h-12 lg:!min-h-12 lg:w-12";

export function HomeMasterTopbar({ children, className = "", testId }: HomeMasterTopbarProps) {
  return (
    <div className={[TOPBAR_LAYOUT_CLASS, className].filter(Boolean).join(" ")} data-testid={testId}>
      {children}
    </div>
  );
}

export function HomeMasterProfileControl({
  isDark,
  onClick,
  testId,
  ariaLabel,
  expanded,
  controls,
}: HomeMasterProfileControlProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className={[
        ROUND_CONTROL_BASE,
        isDark ? "bg-[#2A1645] text-[#F7F0FF] ring-1 ring-inset ring-[#C4B5FD]/18" : "bg-white text-vyva-purple",
      ].join(" ")}
    >
      <VyvaMark className="h-[18px] w-[18px] sm:h-[19px] sm:w-[19px] lg:h-[22px] lg:w-[22px]" variant={isDark ? "white" : "purple"} />
    </button>
  );
}

export function HomeMasterActionControl({
  isDark,
  icon: Icon,
  onClick,
  testId,
  ariaLabel,
}: HomeMasterActionControlProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
      className={[
        ACTION_CONTROL_BASE,
        isDark ? "bg-[#6D28D9] ring-1 ring-inset ring-[#C4B5FD]/25" : "bg-vyva-purple ring-2 ring-white/85",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 lg:h-5 lg:w-5" strokeWidth={2.35} aria-hidden="true" />
    </button>
  );
}
