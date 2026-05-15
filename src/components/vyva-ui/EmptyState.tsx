import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  iconNode,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("rounded-[28px] border border-vyva-border bg-white p-6 text-center shadow-vyva-card", className)}>
      {Icon || iconNode ? (
        <div className="mx-auto mb-4 flex h-[64px] w-[64px] items-center justify-center rounded-[22px] bg-[#F5F3FF] text-vyva-purple">
          {iconNode ?? (Icon ? <Icon size={30} strokeWidth={2.4} aria-hidden="true" /> : null)}
        </div>
      ) : null}
      <h2 className="font-display text-[28px] leading-tight text-vyva-text-1">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-[34ch] font-body text-[15px] leading-relaxed text-vyva-text-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
