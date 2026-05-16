import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type FeatureCardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  badge?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  tone?: "white" | "warm" | "purple";
  titleClassName?: string;
  descriptionClassName?: string;
};

export function FeatureCard({
  title,
  description,
  icon: Icon,
  iconNode,
  iconBg = "#F5F3FF",
  iconColor = "#7C3AED",
  badge,
  action,
  footer,
  tone = "white",
  titleClassName,
  descriptionClassName,
  className,
  children,
  ...props
}: FeatureCardProps) {
  return (
    <section
      className={cn(
        "rounded-[26px] border p-5 shadow-vyva-card",
        tone === "white" && "border-vyva-border bg-white",
        tone === "warm" && "border-[#EDE2D1] bg-[#FFF9F1]",
        tone === "purple" && "border-[#D8C7F3] bg-[#F7F2FF]",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {badge ? <div className="mb-3">{badge}</div> : null}
          <h1 className={cn("font-display text-[34px] leading-[1.04] text-vyva-text-1", titleClassName)}>{title}</h1>
          {description ? (
            <p className={cn("mt-3 font-body text-[17px] leading-[1.4] text-vyva-text-2", descriptionClassName)}>{description}</p>
          ) : null}
        </div>
        {Icon || iconNode || action ? (
          <div className="flex shrink-0 items-start gap-2">
            {Icon || iconNode ? (
              <div
                className="flex h-[70px] w-[70px] items-center justify-center rounded-[22px] bg-white shadow-vyva-card"
                style={{ background: iconBg, color: iconColor }}
              >
                {iconNode ?? (Icon ? <Icon size={34} strokeWidth={2.4} aria-hidden="true" /> : null)}
              </div>
            ) : null}
            {action}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </section>
  );
}
