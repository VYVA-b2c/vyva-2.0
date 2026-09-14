import { type HTMLAttributes, type ReactNode } from "react";
import { useOnboardingCompanionGuidance } from "./useOnboardingCompanionGuidance";

export interface OnboardingCompanionTargetState {
  active: boolean;
  targetProps: {
    "data-vyva-companion-target": string;
    "data-vyva-companion-target-active"?: "true";
  };
  className: string;
}

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function companionTargetClassName(active: boolean, className = "") {
  return joinClassNames(
    className,
    "transition-[box-shadow,border-color,background-color,transform] duration-300 focus-within:outline focus-within:outline-4 focus-within:outline-offset-2 focus-within:outline-[#FACC15] motion-reduce:transition-none",
    active &&
      "relative z-[1] rounded-[22px] bg-[#FFFBF1] shadow-[0_0_0_4px_rgba(250,204,21,0.38),0_0_0_8px_rgba(107,33,168,0.12),0_18px_40px_rgba(91,33,182,0.14)] ring-2 ring-vyva-purple/45 ring-offset-2 ring-offset-[#FFFCF8] motion-safe:animate-pulse"
  );
}

export function useOnboardingCompanionTarget(
  targetId: string,
  className = ""
): OnboardingCompanionTargetState {
  const { activeTargetId } = useOnboardingCompanionGuidance();
  const active = Boolean(targetId && activeTargetId === targetId);

  return {
    active,
    targetProps: {
      "data-vyva-companion-target": targetId,
      ...(active ? { "data-vyva-companion-target-active": "true" as const } : {}),
    },
    className: companionTargetClassName(active, className),
  };
}

interface OnboardingCompanionTargetProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  targetId: string;
  children: ReactNode;
}

export function OnboardingCompanionTarget({
  targetId,
  children,
  className,
  ...props
}: OnboardingCompanionTargetProps) {
  const target = useOnboardingCompanionTarget(targetId, className);

  return (
    <div
      {...props}
      {...target.targetProps}
      className={target.className}
      aria-current={target.active ? "step" : undefined}
    >
      {children}
    </div>
  );
}
