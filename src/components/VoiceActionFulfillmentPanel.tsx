import { AlertTriangle, CheckCircle2, Send, ShieldCheck, Sparkles, X } from "lucide-react";
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

function safetyCopy(safetyLevel?: string, requiresConfirmation?: boolean) {
  if (safetyLevel === "urgent") return "Safety first. Review the next step before anything happens.";
  if (requiresConfirmation) return "Nothing is done without your confirmation.";
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
  const isAppointmentAction = action.actionType === "concierge.appointment_help";
  const eyebrow = action.requiresConfirmation ? "Review first" : "Ready to help";
  const panelTitle = isAppointmentAction ? "Appointment request ready" : title ?? action.title;
  const panelDescription = description ?? action.cue ?? action.summary;
  const requestText = action.sourceText?.trim() || action.summary || panelDescription;
  const detailRows = [
    subject ? { label: "Focus", value: subject } : null,
    ...visibleHighlights.map((highlight) => ({
      label: highlight.label,
      value: highlight.value,
    })),
    ...visiblePayloadEntries.map((entry) => ({
      label: entry.label,
      value: entry.value,
    })),
  ].filter((row): row is { label: string; value: string | number } =>
    Boolean(row && row.value !== undefined && row.value !== null && String(row.value).trim().length > 0),
  );

  return (
    <section
      aria-live="polite"
      data-testid="voice-action-fulfillment-panel"
      className={cn(
        "overflow-hidden rounded-[34px] border border-[#D8B4FE] bg-white shadow-[0_20px_52px_rgba(107,33,168,0.18)]",
        className,
      )}
    >
      <div className="relative bg-[linear-gradient(135deg,#8728F4_0%,#5F17C7_52%,#3D0D82_100%)] px-6 pb-8 pt-7 text-white">
        <div className="flex min-w-0 items-start gap-4 pr-10">
          <div className="mt-1 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-white/14 text-white shadow-sm ring-1 ring-white/18">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-body text-[15px] font-black uppercase tracking-[0.16em] text-[#FFD84D]">
              {eyebrow}
            </p>
            <h2 className="mt-2 font-body text-[32px] font-black leading-[1.08] text-white">
              {panelTitle}
            </h2>
            <p className="mt-4 font-body text-[19px] font-bold leading-[1.35] text-white/92">
              {panelDescription}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => dismissActiveAction({
            source: "voice_action_fulfillment_hide",
            current_action_type: action.actionType ?? action.id,
          })}
          aria-label="Close"
          title="Hide"
          className="absolute right-6 top-7 flex h-11 w-11 items-center justify-center rounded-full bg-white/14 text-white ring-1 ring-white/14 transition active:scale-95"
          data-testid="button-hide-voice-action-fulfillment"
        >
          <X size={22} />
        </button>
      </div>

      <div className="space-y-4 px-5 pb-5 pt-6">
        <div className="rounded-[28px] border border-[#E8DED4] bg-[#FFFCF8] p-4">
          <p className="font-body text-[16px] font-black uppercase tracking-[0.14em] text-vyva-text-3">
            Key details
          </p>
          <div className="mt-4 rounded-[24px] bg-white px-4 py-4">
            <p className="font-body text-[14px] font-black uppercase tracking-[0.12em] text-vyva-text-3">
              Request
            </p>
            <p className="mt-2 font-body text-[19px] font-black leading-[1.35] text-vyva-text-1">
              {requestText}
            </p>
          </div>
          {detailRows.length > 0 && (
            <div className="mt-3 grid gap-2">
              {detailRows.map((row) => (
                <div key={`${row.label}:${row.value}`} className="rounded-[20px] bg-white px-4 py-3">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-text-3">
                    {row.label}
                  </p>
                  <p className="mt-1 font-body text-[16px] font-black leading-snug text-vyva-text-1">
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          )}
          {isActiveActionAccepted && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-4 py-2 font-body text-[13px] font-black text-[#047857]">
              <CheckCircle2 size={15} />
              Confirmed
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
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
            className="inline-flex min-h-[64px] flex-1 items-center justify-center gap-3 rounded-full bg-vyva-purple px-5 font-body text-[20px] font-black text-white shadow-[0_14px_30px_rgba(107,33,168,0.28)] transition active:scale-[0.98]"
            data-testid="button-complete-voice-action-fulfillment"
          >
            {needsTapConfirmation ? <Send size={21} /> : <CheckCircle2 size={21} />}
            {needsTapConfirmation ? "Review and continue" : action.completion?.doneLabel ?? "Done"}
          </button>
          <button
            type="button"
            onClick={() => dismissActiveAction({
              source: "voice_action_fulfillment_hide",
              current_action_type: action.actionType ?? action.id,
            })}
            className="inline-flex min-h-[64px] flex-1 items-center justify-center gap-3 rounded-full border-2 border-[#D8B4FE] bg-white px-5 font-body text-[20px] font-black text-vyva-purple transition active:scale-[0.98]"
          >
            <X size={21} />
            Not now
          </button>
        </div>

        {safetyNote && (
          <p className="flex items-center justify-center gap-2 rounded-[24px] bg-[#ECFDF5] px-5 py-4 text-center font-body text-[17px] font-black leading-snug text-[#047857]">
            {action.safetyLevel === "urgent" ? <AlertTriangle size={18} className="shrink-0" /> : <ShieldCheck size={18} className="shrink-0" />}
            {safetyNote}
          </p>
        )}
      </div>
    </section>
  );
}
