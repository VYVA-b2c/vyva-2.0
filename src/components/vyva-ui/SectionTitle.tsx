import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionTitleProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  as?: ElementType;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function SectionTitle({
  title,
  subtitle,
  action,
  as: Component = "h2",
  className,
  titleClassName,
  subtitleClassName,
}: SectionTitleProps) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <Component
          className={cn(
            "font-display text-[24px] font-normal italic leading-tight text-vyva-text-1",
            titleClassName,
          )}
        >
          {title}
        </Component>
        {subtitle ? (
          <p className={cn("mt-1 font-body text-[14px] leading-snug text-vyva-text-2", subtitleClassName)}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
