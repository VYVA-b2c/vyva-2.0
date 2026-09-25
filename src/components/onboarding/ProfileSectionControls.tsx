import type { FocusEventHandler } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { useOnboardingAgent } from "@/components/onboarding/useOnboardingAgent";

export function ProfileStandaloneHeader({ title, onBack, backTestId }: { title: string; onBack: () => void; backTestId?: string }) {
  const { primaryVoiceActionId, runPrimaryVoiceAction } = useOnboardingAgent();
  return (
    <header className="mx-auto grid w-full max-w-[760px] grid-cols-[44px_1fr_44px] items-center gap-3 px-5 pb-4 pt-7">
      <button type="button" data-testid={backTestId} onClick={onBack} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full border border-vyva-border bg-white text-vyva-purple shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/20"><ArrowLeft size={20} /></button>
      <h1 className="truncate text-center font-body text-[20px] font-extrabold text-vyva-text-1">{title}</h1>
      {primaryVoiceActionId ? <button type="button" onClick={runPrimaryVoiceAction} aria-label="Add information by voice" className="grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-vyva-purple text-white shadow-[0_12px_28px_rgba(107,33,168,0.24)]"><VyvaIcon icon={Mic} size={18} tone="inverse" /></button> : <a href="/" aria-label="Return to VYVA voice mode" className="grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-vyva-purple text-white shadow-[0_12px_28px_rgba(107,33,168,0.24)]"><VyvaIcon icon={Mic} size={18} tone="inverse" /></a>}
    </header>
  );
}

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
  onFocus?: FocusEventHandler<HTMLButtonElement>;
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
  onFocus,
}: ProfileVoiceActionProps) {
  // The canonical profile exposes voice through the page header. Keep this
  // inert, non-focusable hook temporarily so legacy section integrations and
  // their compatibility tests can still invoke the registered action without
  // rendering a second voice control in the UI.
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onFocus={onFocus}
      disabled={disabled || busy}
      tabIndex={-1}
      aria-hidden="true"
      className={cn("sr-only", className)}
    >
      <Icon aria-hidden="true" />
      <span>{busy ? (busyLabel ?? title) : title}</span>
      <span>{description}</span>
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
  onFocus?: FocusEventHandler<HTMLButtonElement>;
};

export function ProfileNoneOption({
  title,
  description,
  selected,
  onClick,
  testId,
  tone = "purple",
  className,
  onFocus,
}: ProfileNoneOptionProps) {
  const colors = toneClasses[tone];

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      onClick={onClick}
      onFocus={onFocus}
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
          <span className="sr-only">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

type ProfileCompletionBarProps = {
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  savingLabel: string;
  helper: string;
  disabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
  testId?: string;
};

export function ProfileCompletionBar({
  saving,
  onSave,
  saveLabel,
  savingLabel,
  helper,
  disabled = false,
  skipLabel,
  onSkip,
  testId = "button-save-profile-section",
}: ProfileCompletionBarProps) {
  return (
    <div className="mt-6 border-t border-vyva-border pt-4 sm:flex sm:items-center sm:gap-4">
      <p className="mb-2 flex-1 text-[13px] font-semibold leading-snug text-vyva-text-2 sm:mb-0 sm:text-[14px]">
        {helper}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid={testId}
          onClick={onSave}
          disabled={disabled || saving}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[16px] bg-vyva-purple px-5 text-[15px] font-black text-white shadow-[0_10px_24px_rgba(105,31,190,0.2)] transition hover:bg-[#5D1AA8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/20 disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-[190px]"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}
