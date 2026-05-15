import { CheckCircle2, X } from "lucide-react";
import type { VoiceAppAction } from "@/lib/voiceNavigation";
import { cn } from "@/lib/utils";

const domainLabels: Record<VoiceAppAction["domain"], string> = {
  meds: "Medication",
  health: "Health",
  safety: "Safety",
  concierge: "Concierge",
  brain_coach: "Brain coach",
  social: "Social",
  reports: "Reports",
};

type VoiceActionCardProps = {
  action: VoiceAppAction;
  onComplete?: () => void;
  onDismiss?: () => void;
  className?: string;
};

export default function VoiceActionCard({ action, onComplete, onDismiss, className }: VoiceActionCardProps) {
  return (
    <section
      aria-live="polite"
      data-testid="voice-action-card"
      className={cn(
        "rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-vyva-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.13)]" />
            <span className="font-body text-[12px] font-bold uppercase text-emerald-700">
              VYVA opened {domainLabels[action.domain]}
            </span>
          </div>
          <h2 className="font-display text-[20px] leading-tight text-vyva-text-1">{action.title}</h2>
          <p className="mt-1 font-body text-[14px] leading-[1.45] text-vyva-text-2">{action.summary}</p>
        </div>

        {onDismiss && (
          <button
            type="button"
            aria-label="Hide"
            title="Hide"
            onClick={onDismiss}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-vyva-text-2 shadow-sm transition active:scale-95"
            data-testid="button-hide-voice-action"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {onComplete && (
        <button
          type="button"
          onClick={onComplete}
          className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 font-body text-[15px] font-bold text-white transition active:scale-[0.98]"
          data-testid="button-complete-voice-action"
        >
          <CheckCircle2 size={18} />
          Done
        </button>
      )}
    </section>
  );
}
