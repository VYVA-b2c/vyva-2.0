import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { VyvaIcon, type VyvaBrandGlyph, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { cn } from "@/lib/utils";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { BRAIN_COACH_SHELL_CONTRACT } from "./brainCoachPresentation";
import { CANONICAL_MENU_ITEM_TITLE_CLASS } from "@/design/canonicalMenuTypography";

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
  dense?: boolean;
  showArrow?: boolean;
  tile?: boolean;
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
  dense = false,
  showArrow = true,
  tile = false,
  className,
  disabled,
  type = "button",
  style,
  ...props
}: CanonicalBrainCoachActivityCardProps) {
  const { isDark } = useHomeMasterTheme();
  const iconTileId = brandIcon ?? iconAccent ?? "utility";
  const isFeatured = variant === "featured";

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "vyva-tap group relative grid min-h-[148px] w-full min-w-0 grid-cols-[56px_minmax(0,1fr)] items-start gap-4 overflow-hidden rounded-[28px] border p-5 text-left shadow-[0_16px_38px_rgba(36,28,48,0.09)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(36,28,48,0.14)] focus-visible:-translate-y-1 disabled:opacity-60 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:gap-5 sm:p-6",
        dense && "min-h-[120px]",
        isDark
          ? isFeatured
            ? "border-[#8B5CF6]/55 bg-[linear-gradient(135deg,rgba(109,40,217,0.42),rgba(255,255,255,0.07))] text-[#F9F4FF] shadow-[0_20px_48px_rgba(0,0,0,0.24)]"
            : "border-white/[0.14] bg-white/[0.08] text-[#F9F4FF] shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
          : isFeatured
            ? "border-[#D8C7F3] bg-[linear-gradient(135deg,#FFFFFF_0%,#FBF7FF_58%,#F1E8FF_100%)] text-[#241C30]"
            : "border-[#EEE8F1] bg-white text-[#241C30]",
        tile && "min-h-[144px] grid-cols-1 justify-items-center gap-3 rounded-lg p-4 text-center shadow-sm lg:min-h-[144px]",
        className,
      )}
      style={style}
      data-scene-kind="activity_card"
      data-card-variant={variant}
      data-card-density={dense ? "dense" : "standard"}
      data-vyva-card-layout="canonical-health-hub-action"
      data-container-contract={BRAIN_COACH_SHELL_CONTRACT.containerId}
      {...props}
    >
      <span
        className={cn(
          "relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[20px] shadow-[0_10px_24px_rgba(36,28,48,0.10)] transition-transform duration-200 group-hover:scale-[1.05] group-focus-visible:scale-[1.05] sm:h-16 sm:w-16 sm:rounded-[22px]",
        )}
        style={{ background: iconBg, color: iconColor }}
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

      <span className="min-w-0">
        {badge ? (
          <span
            className="inline-flex whitespace-nowrap rounded-full px-3 py-1.5 font-body text-[11px] font-black leading-none sm:text-[12px]"
            style={{ background: badgeBg ?? iconBg, color: badgeColor ?? iconColor }}
          >
            {badge}
          </span>
        ) : null}
        <span className={cn("mt-2 block", tile ? "font-display text-[18px] font-semibold leading-tight tracking-normal [overflow-wrap:anywhere]" : CANONICAL_MENU_ITEM_TITLE_CLASS)}>
          {title}
        </span>
        {description ? (
          <span className={cn("mt-2 block font-body text-[14px] font-semibold leading-relaxed sm:text-[15px]", isDark ? "text-[#D8CDE4]" : "text-[#6B6173]")}>
            {description}
          </span>
        ) : null}
        <span className="mt-4 flex flex-wrap items-center gap-2">
          {meta ? (
            <span className={cn("font-body text-[12px] font-extrabold leading-snug sm:text-[13px]", isDark ? "text-[#CFC1DC]" : "text-[#776A81]")}>
              {meta}
            </span>
          ) : null}
          {actionLabel ? (
            <span className="inline-flex items-center gap-1.5 font-body text-[13px] font-black" style={{ color: isDark ? "#E9D5FF" : iconColor }}>
              {actionLabel}
              <ArrowRight size={15} strokeWidth={2.7} aria-hidden="true" />
            </span>
          ) : null}
        </span>
      </span>

      {showArrow ? (
        <span
          className="col-span-2 grid h-11 w-11 place-items-center justify-self-end rounded-full text-white shadow-[0_10px_22px_rgba(36,28,48,0.16)] transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:self-center"
          style={{ background: iconColor }}
          aria-hidden="true"
        >
          <ArrowRight size={20} strokeWidth={2.6} />
        </span>
      ) : null}
    </button>
  );
}

export default CanonicalBrainCoachActivityCard;
