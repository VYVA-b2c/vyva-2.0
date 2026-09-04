import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { VyvaIcon, type VyvaBrandGlyph, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { cn } from "@/lib/utils";
import { BRAIN_COACH_SHELL_CONTRACT } from "./brainCoachPresentation";

type CanonicalBrainCoachActivityCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  icon: LucideIcon;
  brandIcon?: VyvaBrandGlyph;
  iconAccent?: VyvaIconAccent;
  iconBg?: string;
  iconColor?: string;
  badge?: ReactNode;
  badgeBg?: string;
  badgeColor?: string;
  meta?: ReactNode;
  actionLabel?: ReactNode;
  variant?: "default" | "featured" | "compact";
  borderColor?: string;
};

export function CanonicalBrainCoachActivityCard({
  title,
  description,
  icon: Icon,
  brandIcon,
  iconAccent,
  iconBg = "#F1EAFF",
  iconColor = "#7C3AED",
  badge,
  badgeBg,
  badgeColor,
  meta,
  actionLabel,
  variant = "default",
  borderColor: _borderColor,
  className,
  disabled,
  type = "button",
  style,
  ...props
}: CanonicalBrainCoachActivityCardProps) {
  const iconTileId = brandIcon ?? iconAccent ?? "utility";
  const isFeatured = variant === "featured";

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "vyva-tap group grid min-h-[96px] w-full min-w-0 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 rounded-[26px] border border-[#EEE8F1] bg-white px-4 text-left text-[#241C30] shadow-[0_14px_30px_rgba(36,28,48,0.07)] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 disabled:opacity-60 lg:min-h-[148px] lg:grid-cols-[64px_minmax(0,1fr)_auto] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-y-3 lg:p-5",
        isFeatured && "ring-2 ring-[#E9DDF8]",
        className,
      )}
      style={style}
      data-scene-kind="activity_card"
      data-card-variant={variant}
      data-container-contract={BRAIN_COACH_SHELL_CONTRACT.containerId}
      {...props}
    >
      <span
        className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[20px] bg-[#F1E8FF] transition-[background-color,transform] duration-200 group-hover:scale-[1.03] group-hover:bg-[#ECE0FF] group-focus-visible:scale-[1.03] lg:row-span-2 lg:h-16 lg:w-16 lg:self-start"
        data-vyva-icon-tile={iconTileId}
        aria-hidden="true"
      >
        <VyvaIcon
          icon={Icon}
          glyph={brandIcon}
          accent={iconAccent}
          size={brandIcon ? 44 : 29}
          strokeWidth={2.55}
          tone="brand"
        />
      </span>

      <span className="min-w-0 self-center lg:self-start">
        <span className="block font-display text-[20px] font-semibold leading-[1.05] tracking-[-0.025em] lg:text-[22px]">
          {title}
        </span>
        {description ? (
          <span className="mt-1 line-clamp-2 block font-body text-[13.5px] font-bold leading-snug text-[#8A8095] lg:text-[14px]">
            {description}
          </span>
        ) : null}
        {meta ? <span className="sr-only">{meta}</span> : null}
        {actionLabel ? <span className="sr-only">{actionLabel}</span> : null}
      </span>

      {badge ? (
        <span
          className="self-center whitespace-nowrap rounded-full px-3 py-1.5 font-body text-[11px] font-black leading-none lg:self-start lg:text-[12px]"
          style={{ background: badgeBg ?? iconBg, color: badgeColor ?? iconColor }}
        >
          {badge}
        </span>
      ) : null}

      <span className="hidden opacity-70 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 lg:col-start-3 lg:row-start-2 lg:block lg:self-end lg:justify-self-end" aria-hidden="true">
        <VyvaIcon icon={ArrowUpRight} size={20} strokeWidth={2.35} tone="muted" />
      </span>
    </button>
  );
}

export default CanonicalBrainCoachActivityCard;
