import { AlertTriangle, CheckCircle2, Sparkles, X } from "lucide-react";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import type { VoiceAppActionDomain } from "@/lib/voiceNavigation";
import { cn } from "@/lib/utils";

type HighlightTone = "neutral" | "good" | "warning" | "urgent";

export type VoiceActionFulfillmentHighlight = {
  label: string;
  value?: string | number | null;
  tone?: HighlightTone;
};

type VoiceActionFulfillmentPanelProps = {
  domain?: VoiceAppActionDomain | readonly VoiceAppActionDomain[];
  actionTypes?: readonly string[];
  routes?: readonly string[];
  title?: string;
  description?: string;
  highlights?: VoiceActionFulfillmentHighlight[];
  className?: string;
};

const toneClasses: Record<HighlightTone, string> = {
  neutral: "bg-white text-vyva-text-2",
  good: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

function safetyCopy(safetyLevel?: string, requiresConfirmation?: boolean) {
  if (safetyLevel === "urgent") return "Safety first. Confirm the next step before taking action.";
  if (requiresConfirmation) return "Confirm before taking action.";
  if (safetyLevel === "medical") return "Use profile context carefully and avoid guessing.";
  if (safetyLevel === "sensitive") return "Keep details private and confirm practical next steps.";
  return "";
}

function hasHighlightValue(highlight: VoiceActionFulfillmentHighlight) {
  return highlight.value !== undefined && highlight.value !== null && String(highlight.value).trim().length > 0;
}

export default function VoiceActionFulfillmentPanel({
  domain,
  actionTypes,
  routes,
  title,
  description,
  highlights = [],
  className,
}: VoiceActionFulfillmentPanelProps) {
  const {
    action,
    isActiveActionAccepted,
    acceptActiveAction,
    completeActiveAction,
    dismissActiveAction,
    payloadEntries,
    subject,
  } = useVoiceActionFulfillment({ domain, actionTypes, routes });

  if (!action) return null;

  const needsTapConfirmation = Boolean(action.requiresConfirmation && !isActiveActionAccepted);
  const visibleHighlights = highlights.filter(hasHighlightValue);
  const visiblePayloadEntries = payloadEntries.filter((entry) =>
    !visibleHighlights.some((highlight) => highlight.label.toLowerCase() === entry.label.toLowerCase()),
  );
  const safetyNote = safetyCopy(action.safetyLevel, action.requiresConfirmation);

  return (
    <section
      aria-live="polite"
      data-testid="voice-action-fulfillment-panel"
      className={cn(
        "rounded-[24px] border border-emerald-200 bg-[#F1FCF7] p-4 shadow-[0_12px_30px_rgba(16,185,129,0.10)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-emerald-700 shadow-sm">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
              VYVA focus
            </p>
            <h2 className="mt-1 font-body text-[18px] font-extrabold leading-tight text-vyva-text-1">
              {title ?? action.title}
            </h2>
            <p className="mt-1 font-body text-[14px] leading-[1.45] text-vyva-text-2">
              {description ?? action.cue ?? action.summary}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => dismissActiveAction({
            source: "voice_action_fulfillment_hide",
            current_action_type: action.actionType ?? action.id,
          })}
          aria-label="Hide VYVA focus"
          title="Hide"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-vyva-text-2 shadow-sm transition active:scale-95"
          data-testid="button-hide-voice-action-fulfillment"
        >
          <X size={18} />
        </button>
      </div>

      {(subject || visibleHighlights.length > 0 || visiblePayloadEntries.length > 0 || safetyNote || isActiveActionAccepted) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {subject && (
            <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-emerald-800 shadow-sm">
              {subject}
            </span>
          )}
          {visibleHighlights.map((highlight) => (
            <span
              key={`${highlight.label}:${highlight.value}`}
              className={cn(
                "rounded-full px-3 py-1.5 font-body text-[12px] font-bold shadow-sm",
                toneClasses[highlight.tone ?? "neutral"],
              )}
            >
              {highlight.label}: {highlight.value}
            </span>
          ))}
          {visiblePayloadEntries.map((entry) => (
            <span
              key={entry.key}
              className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2 shadow-sm"
            >
              {entry.label}: {entry.value}
            </span>
          ))}
          {safetyNote && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2 shadow-sm">
              {action.safetyLevel === "urgent" ? <AlertTriangle size={13} /> : null}
              {safetyNote}
            </span>
          )}
          {isActiveActionAccepted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 font-body text-[12px] font-bold text-emerald-800 shadow-sm">
              <CheckCircle2 size={13} />
              Confirmed
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (needsTapConfirmation) {
            acceptActiveAction({
              source: "voice_action_fulfillment_confirm",
              current_action_type: action.actionType ?? action.id,
            });
            return;
          }
          completeActiveAction({
            metadata: {
              source: "voice_action_fulfillment_done",
              current_action_type: action.actionType ?? action.id,
            },
          });
        }}
        className={cn(
          "mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full px-4 font-body text-[15px] font-bold text-white transition active:scale-[0.98]",
          needsTapConfirmation ? "bg-amber-600" : "bg-emerald-600",
        )}
        data-testid="button-complete-voice-action-fulfillment"
      >
        <CheckCircle2 size={18} />
        {needsTapConfirmation ? "Confirm next step" : action.completion?.doneLabel ?? "Done"}
      </button>
    </section>
  );
}
