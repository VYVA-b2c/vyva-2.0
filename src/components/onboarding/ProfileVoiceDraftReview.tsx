import { CheckCircle2, RotateCcw, X } from "lucide-react";
import type { ProfileVoiceDraft } from "@/lib/profileVoiceCompletion";
import { cn } from "@/lib/utils";

interface ProfileVoiceDraftReviewProps {
  draft: ProfileVoiceDraft;
  confirmLabel: string;
  tryAgainLabel: string;
  dismissLabel: string;
  onConfirm: () => void;
  onTryAgain: () => void;
  onDismiss: () => void;
  onRemoveRow?: (value: string) => void;
  className?: string;
  testId?: string;
}

export function ProfileVoiceDraftReview({
  draft,
  confirmLabel,
  tryAgainLabel,
  dismissLabel,
  onConfirm,
  onTryAgain,
  onDismiss,
  onRemoveRow,
  className,
  testId = "profile-voice-draft-review",
}: ProfileVoiceDraftReviewProps) {
  return (
    <section
      data-testid={testId}
      aria-label={draft.title}
      className={cn(
        "rounded-[22px] border border-[#BFE9DB] bg-[#F0FDF8] p-4 shadow-[0_12px_28px_rgba(15,159,118,0.09)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0F9F76] text-white">
          <CheckCircle2 size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] font-black leading-tight text-vyva-text-1">
            {draft.title}
          </h3>
          <p className="mt-1 text-[14px] font-semibold leading-snug text-vyva-text-2">
            {draft.helper}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {draft.rows.map((row) => (
          <div
            key={row.id}
            className="flex min-h-12 items-center gap-3 rounded-[16px] border border-emerald-100 bg-white px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black uppercase tracking-[0.06em] text-[#087A58]">
                {row.label}
              </p>
              <p className="truncate text-[16px] font-black text-vyva-text-1">
                {row.value}
              </p>
              {row.helper ? (
                <p className="text-[13px] font-semibold text-vyva-text-2">{row.helper}</p>
              ) : null}
            </div>
            {onRemoveRow ? (
              <button
                type="button"
                aria-label={`Remove ${row.value}`}
                data-testid={`button-profile-voice-draft-remove-${row.id}`}
                onClick={() => onRemoveRow(row.value)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#087A58] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
              >
                <X size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 min-[520px]:flex-row">
        <button
          type="button"
          data-testid="button-profile-voice-draft-confirm"
          onClick={onConfirm}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#0F9F76] px-4 text-[15px] font-black text-white shadow-[0_10px_20px_rgba(15,159,118,0.18)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
        >
          <CheckCircle2 size={18} aria-hidden="true" />
          {confirmLabel}
        </button>
        <button
          type="button"
          data-testid="button-profile-voice-draft-try-again"
          onClick={onTryAgain}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-[#BFE9DB] bg-white px-4 text-[15px] font-black text-[#087A58] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
        >
          <RotateCcw size={17} aria-hidden="true" />
          {tryAgainLabel}
        </button>
        <button
          type="button"
          data-testid="button-profile-voice-draft-dismiss"
          onClick={onDismiss}
          className="min-h-12 rounded-[16px] px-4 text-[15px] font-black text-vyva-text-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/15"
        >
          {dismissLabel}
        </button>
      </div>
    </section>
  );
}
