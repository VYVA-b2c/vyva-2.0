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

const badgeClass: Record<NonNullable<ProfileSectionHeroBadge["color"]>, string> = {
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
  badges = [],
  iconClassName = "text-white",
  iconBgClassName = "bg-[#7D2BE8]",
  className,
  autoSave,
}: ProfileSectionHeroProps) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-[#EFE4D5] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFFFFF_58%,#F5ECFF_100%)] p-4 shadow-[0_14px_34px_rgba(53,28,87,0.06)] sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <div
            className={cn(
              "hidden h-12 w-12 shrink-0 items-center justify-center rounded-[15px] shadow-[0_10px_20px_rgba(125,43,232,0.18)] min-[520px]:flex",
              iconBgClassName,
            )}
          >
            <Icon size={23} className={iconClassName} />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 inline-flex rounded-full bg-[#FFF1B8] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">
              {kicker}
            </p>
            <h2 className="font-display text-[30px] leading-[1.08] text-vyva-text-1 sm:text-[34px]">
              {title}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[16px] leading-relaxed text-vyva-text-2">
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
      {badges.length > 0 ? (
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
