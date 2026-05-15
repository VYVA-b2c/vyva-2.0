import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BackButton } from "./BackButton";
import { FeatureCard } from "./FeatureCard";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  backLabel?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
  showBack?: boolean;
};

export function PageHeader({
  title,
  subtitle,
  icon,
  iconNode,
  iconBg = "#FFFFFF",
  iconColor = "#7C3AED",
  backLabel = "Back",
  backTo,
  onBack,
  actions,
  className,
  showBack = true,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-5", className)}>
      {(showBack || actions) && (
        <div className="flex items-center justify-between gap-3">
          {showBack ? <BackButton label={backLabel} to={backTo} onClick={onBack} /> : <span />}
          {actions}
        </div>
      )}
      <FeatureCard
        tone="warm"
        title={title}
        description={subtitle}
        icon={icon}
        iconNode={iconNode}
        iconBg={iconBg}
        iconColor={iconColor}
        titleClassName="text-[38px] leading-[1.02]"
        descriptionClassName="text-[18px]"
      />
    </header>
  );
}
