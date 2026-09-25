import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";

type ProfileSectionHeroBadge = {
  label: string;
  color?: "green" | "amber" | "purple" | "blue" | "red";
};

type ProfileSectionHeroProps = {
  icon: LucideIcon;
  title: string;
  kicker?: string;
  description: ReactNode;
  compact?: boolean;
  badges?: ProfileSectionHeroBadge[];
  iconClassName?: string;
  iconBgClassName?: string;
  className?: string;
  autoSave?: {
    autoSaveStatus: AutoSaveStatus;
    savedFading?: boolean;
    retryCountdown?: number | null;
    onRetryNow?: () => void;
    testId?: string;
  };
};

const badgeClass: Record<
  NonNullable<ProfileSectionHeroBadge["color"]>,
  string
> = {
  green: "bg-[#ECFDF5] text-[#0A7C4E]",
  amber: "bg-[#FFF7CC] text-[#7A4C00]",
  purple: "bg-[#F3E8FF] text-vyva-purple",
  blue: "bg-[#EFF6FF] text-[#1D4ED8]",
  red: "bg-[#FEF2F2] text-[#B91C1C]",
};

export function ProfileSectionHero({
  icon: Icon,
  title,
  kicker = "Profile setup",
  description,
  compact = false,
  badges = [],
  iconClassName = "text-white",
  iconBgClassName = "bg-[#7D2BE8]",
  className,
  autoSave,
}: ProfileSectionHeroProps) {
  return (
    <section
      className={cn(
        "border-b border-vyva-border pb-4",
        compact ? "px-0" : "px-0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <span className="sr-only"><Icon />{kicker}: {title}</span>
          <div className="min-w-0">
            <p
              className="max-w-2xl text-[15px] leading-relaxed text-vyva-text-2"
            >
              {description}
            </p>
          </div>
        </div>
        {autoSave ? (
          <AutoSaveStatusBadge
            autoSaveStatus={autoSave.autoSaveStatus}
            savedFading={autoSave.savedFading ?? false}
            retryCountdown={autoSave.retryCountdown}
            onRetryNow={autoSave.onRetryNow}
            testId={autoSave.testId ?? "status-profile-section-autosave"}
          />
        ) : null}
      </div>
    </section>
  );
}

export const seniorInputClassName =
  "h-14 rounded-[18px] border-[#DDC7FF] bg-white px-4 text-[17px] text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] placeholder:text-[#8D7D73] focus-visible:ring-4 focus-visible:ring-vyva-purple/15";

export const seniorTextAreaClassName =
  "min-h-[118px] rounded-[18px] border border-[#DDC7FF] bg-white px-4 py-3 text-[17px] leading-relaxed text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] placeholder:text-[#8D7D73] focus:outline-none focus:border-vyva-purple focus:ring-4 focus:ring-vyva-purple/15";
