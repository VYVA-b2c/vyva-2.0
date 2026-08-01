import type { LucideIcon } from "lucide-react";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ControlTone = "purple" | "amber" | "green";

const toneClasses: Record<
  ControlTone,
  { action: string; icon: string; selected: string; idle: string }
> = {
  purple: {
    action: "border-[#DCC8FF] bg-[#F8F3FF] text-[#6720BC]",
    icon: "bg-[#7D2BE8] text-white",
    selected: "border-[#7D2BE8] bg-[#F3E8FF] text-[#6720BC]",
    idle: "border-[#E5D6F7] bg-white text-[#4B3B58]",
  },
  amber: {
    action: "border-[#F6D46B] bg-[#FFF9E8] text-[#9A4A08]",
    icon: "bg-[#F59E0B] text-white",
    selected: "border-[#F59E0B] bg-[#FFF7D6] text-[#8A4108]",
    idle: "border-[#F2DC9C] bg-white text-[#4B3B58]",
  },
  green: {
    action: "border-[#A9E4CE] bg-[#F0FDF8] text-[#087A58]",
    icon: "bg-[#0F9F76] text-white",
    selected: "border-[#0F9F76] bg-[#EAFBF5] text-[#087A58]",
    idle: "border-[#BFE9DB] bg-white text-[#4B3B58]",
  },
};

type ProfileVoiceActionProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  testId: string;
  tone?: ControlTone;
  className?: string;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
};

export function ProfileVoiceAction({
  icon: Icon,
  title,
  description,
  onClick,
  testId,
  tone = "purple",
  className,
  disabled = false,
  busy = false,
  busyLabel,
}: ProfileVoiceActionProps) {
  const colors = toneClasses[tone];

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "group flex min-h-[72px] w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left shadow-[0_10px_24px_rgba(53,28,87,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(53,28,87,0.1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/15 disabled:pointer-events-none disabled:opacity-60",
        colors.action,
        className,
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] shadow-sm",
          colors.icon,
        )}
      >
        {busy ? (
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        ) : (
          <Icon size={20} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-[17px] leading-tight">
          {busy && busyLabel ? busyLabel : title}
        </strong>
        <span className="mt-1 block text-[14px] leading-snug opacity-80">
          {description}
        </span>
      </span>
      <ChevronRight
        size={20}
        className="shrink-0 opacity-55 transition group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

type ProfileNoneOptionProps = {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  testId: string;
  tone?: ControlTone;
  className?: string;
};

export function ProfileNoneOption({
  title,
  description,
  selected,
  onClick,
  testId,
  tone = "purple",
  className,
}: ProfileNoneOptionProps) {
  const colors = toneClasses[tone];

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "flex min-h-[62px] w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/15",
        selected ? colors.selected : colors.idle,
        className,
      )}
    >
      <CheckCircle2
        size={21}
        className={cn("shrink-0", selected ? "fill-current/10" : "opacity-65")}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <strong className="block text-[16px] leading-tight">{title}</strong>
        {description ? (
          <span className="mt-0.5 block text-[13px] leading-snug opacity-75">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
