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
        "border border-[#EFE4D5] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFFFFF_58%,#F5ECFF_100%)] shadow-[0_14px_34px_rgba(53,28,87,0.06)]",
        compact ? "rounded-[20px] p-3.5 sm:p-4" : "rounded-[24px] p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <div
            className={cn(
              "shrink-0 items-center justify-center shadow-[0_10px_20px_rgba(125,43,232,0.18)]",
              compact
                ? "flex h-10 w-10 rounded-[13px]"
                : "hidden h-12 w-12 rounded-[15px] min-[520px]:flex",
              iconBgClassName,
            )}
          >
            <Icon size={compact ? 20 : 23} className={iconClassName} />
          </div>
          <div className="min-w-0">
            {!compact ? (
              <p className="mb-1.5 inline-flex rounded-full bg-[#FFF1B8] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">
                {kicker}
              </p>
            ) : null}
            <h2
              className={cn(
                "font-display leading-[1.08] text-vyva-text-1",
                compact
                  ? "text-[24px] sm:text-[26px]"
                  : "text-[30px] sm:text-[34px]",
              )}
            >
              {title}
            </h2>
            <p
              className={cn(
                "max-w-2xl text-vyva-text-2",
                compact
                  ? "mt-1 text-[14px] leading-snug sm:text-[15px]"
                  : "mt-1.5 text-[16px] leading-relaxed",
              )}
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
      {!compact && badges.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full px-3 py-1.5 text-[13px] font-extrabold",
                badgeClass[badge.color ?? "purple"],
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export const seniorInputClassName =
  "h-14 rounded-[18px] border-[#DDC7FF] bg-white px-4 text-[17px] text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] placeholder:text-[#8D7D73] focus-visible:ring-4 focus-visible:ring-vyva-purple/15";

export const seniorTextAreaClassName =
  "min-h-[118px] rounded-[18px] border border-[#DDC7FF] bg-white px-4 py-3 text-[17px] leading-relaxed text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] placeholder:text-[#8D7D73] focus:outline-none focus:border-vyva-purple focus:ring-4 focus:ring-vyva-purple/15";
