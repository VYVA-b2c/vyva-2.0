import { useMemo, useState } from "react";
import { CheckCircle2, FlaskConical, Play, RadioTower, XCircle } from "lucide-react";
import {
  actionForVoiceToolCall,
  actionForVoiceUtterance,
  emitVoiceAppAction,
  emitVoiceAppActionResult,
  emitVoiceSpecialistTransfer,
  voiceActionRegistryEntries,
} from "@/lib/voiceNavigation";
import { useVoiceActionContext } from "@/contexts/VoiceActionContext";
import { useAuth } from "@/contexts/AuthContext";
import { recordVoiceTimelineEvent } from "@/lib/voiceTimeline";

export function canShowVoiceActionSimulator({
  isDev,
  flagValue,
  userRole,
  hostname,
}: {
  isDev: boolean;
  flagValue?: string;
  userRole?: string | null;
  hostname?: string;
}) {
  const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
  const isLocalHost = hostname ? localHostnames.has(hostname) : false;
  return isLocalHost && (isDev || (flagValue === "true" && userRole === "admin"));
}

export default function VoiceActionSimulator() {
  const entries = useMemo(() => voiceActionRegistryEntries(), []);
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState(entries[0]?.actionType ?? "");
  const [subject, setSubject] = useState("paracetamol");
  const [utterance, setUtterance] = useState("Do we need to buy Paracetamol?");
  const [evidence, setEvidence] = useState("Simulator action");
  const { activeAction } = useVoiceActionContext();
  const { user } = useAuth();
  const simulatorEnabled = canShowVoiceActionSimulator({
    isDev: import.meta.env.DEV,
    flagValue: import.meta.env.VITE_ENABLE_VOICE_ACTION_SIMULATOR,
    userRole: user?.role,
    hostname: typeof window === "undefined" ? undefined : window.location.hostname,
  });

  if (!simulatorEnabled || entries.length === 0) return null;

  const selected = entries.find((entry) => entry.actionType === actionType) ?? entries[0];
  const activeLabel = activeAction ? `${activeAction.title} - ${activeAction.domain}` : "No active action";

  const buildParams = () => ({
    action_type: selected.actionType,
    title: subject ? `${selected.title}: ${subject}` : selected.title,
    reason: evidence || `Simulator opened ${selected.title}.`,
    evidence: evidence || `Simulator opened ${selected.title}.`,
    subject,
    medication_name: selected.domain === "meds" ? subject : "",
    simulated: true,
  });

  const openAction = () => {
    const action = actionForVoiceToolCall(buildParams());
    if (action) emitVoiceAppAction(action);
  };

  const openUtteranceAction = () => {
    const action = actionForVoiceUtterance(utterance);
    if (!action) {
      setEvidence("No app action matched that sentence.");
      recordVoiceTimelineEvent({
        kind: "simulator",
        title: "Voice lab utterance did not match",
        detail: utterance,
        severity: "warning",
      });
      return;
    }
    if (action.actionType) setActionType(action.actionType);
    setSubject(action.extractedSubject ?? subject);
    setEvidence(action.feedbackReason);
    emitVoiceAppAction(action);
    recordVoiceTimelineEvent({
      kind: "simulator",
      title: "Voice lab utterance matched",
      detail: utterance,
      domain: action.domain,
      route: action.route,
      actionId: action.id,
      ...(action.actionType ? { actionType: action.actionType } : {}),
    });
  };

  const recordResult = (result: "accepted" | "completed" | "dismissed") => {
    emitVoiceAppActionResult({
      action: result,
      actionId: activeAction?.id ?? selected.id,
      domain: activeAction?.domain ?? selected.domain,
      title: activeAction?.title ?? selected.title,
      reason: evidence || `Simulator marked ${result}.`,
      evidence,
      source: "voice_action_simulator",
    });
  };

  const requestTransfer = () => {
    emitVoiceSpecialistTransfer({
      domain: selected.domain,
      reason: evidence || `Simulator requested ${selected.domain} specialist support.`,
      contextHint: subject ? `${selected.title}: ${subject}` : selected.title,
      route: selected.route,
      autoStart: false,
    });
  };

  return (
    <div className="fixed bottom-[116px] right-4 z-[65] hidden font-body sm:block">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[46px] items-center gap-2 rounded-full border border-vyva-border bg-white px-4 text-[14px] font-bold text-vyva-text-1 shadow-vyva-card transition active:scale-95"
          data-testid="button-open-voice-simulator"
        >
          <FlaskConical size={17} />
          Voice lab
        </button>
      ) : (
        <section
          className="w-[min(calc(100vw-32px),360px)] rounded-[24px] border border-vyva-border bg-white p-4 shadow-[0_24px_70px_rgba(47,33,53,0.22)]"
          data-testid="voice-action-simulator"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-emerald-700">Voice lab</p>
              <h2 className="font-display text-[21px] leading-tight text-vyva-text-1">Action simulator</h2>
            </div>
            <button
              type="button"
              aria-label="Close voice simulator"
              title="Close"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-vyva-warm text-vyva-text-2 transition active:scale-95"
            >
              <XCircle size={18} />
            </button>
          </div>

          <label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">
            Say it like a user
          </label>
          <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
            <input
              value={utterance}
              onChange={(event) => setUtterance(event.target.value)}
              placeholder="Open meds inventory for paracetamol"
              className="h-11 rounded-[16px] border border-vyva-border bg-white px-3 text-[14px] text-vyva-text-1"
              data-testid="input-voice-simulator-utterance"
            />
            <button
              type="button"
              onClick={openUtteranceAction}
              className="flex h-11 min-w-[88px] items-center justify-center gap-2 rounded-full bg-vyva-purple px-3 text-[13px] font-bold text-white transition active:scale-[0.98]"
              data-testid="button-simulate-utterance"
            >
              <Play size={15} />
              Test
            </button>
          </div>

          <label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">
            Scenario
          </label>
          <select
            value={selected.actionType}
            onChange={(event) => setActionType(event.target.value)}
            className="mb-3 h-11 w-full rounded-[16px] border border-vyva-border bg-vyva-cream px-3 text-[14px] font-semibold text-vyva-text-1"
            data-testid="select-voice-simulator-action"
          >
            {entries.map((entry) => (
              <option key={entry.actionType} value={entry.actionType}>
                {entry.title} - {entry.domain}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              className="h-11 rounded-[16px] border border-vyva-border bg-white px-3 text-[14px] text-vyva-text-1"
              data-testid="input-voice-simulator-subject"
            />
            <input
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder="Evidence"
              className="h-11 rounded-[16px] border border-vyva-border bg-white px-3 text-[14px] text-vyva-text-1"
              data-testid="input-voice-simulator-evidence"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.04em]">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{selected.safetyLevel}</span>
            <span className="rounded-full bg-vyva-warm px-2.5 py-1 text-vyva-text-2">
              {selected.requiresConfirmation ? "Confirm" : "No confirm"}
            </span>
            <span className="rounded-full bg-vyva-warm px-2.5 py-1 text-vyva-text-2">{activeLabel}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openAction}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-emerald-600 px-3 text-[14px] font-bold text-white transition active:scale-[0.98]"
              data-testid="button-simulate-open-action"
            >
              <Play size={16} />
              Open
            </button>
            <button
              type="button"
              onClick={requestTransfer}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-vyva-purple px-3 text-[14px] font-bold text-white transition active:scale-[0.98]"
              data-testid="button-simulate-transfer"
            >
              <RadioTower size={16} />
              Transfer
            </button>
            <button
              type="button"
              onClick={() => recordResult("accepted")}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[14px] font-bold text-emerald-700 transition active:scale-[0.98]"
              data-testid="button-simulate-accepted"
            >
              <CheckCircle2 size={16} />
              Accept
            </button>
            <button
              type="button"
              onClick={() => recordResult("completed")}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[14px] font-bold text-emerald-700 transition active:scale-[0.98]"
              data-testid="button-simulate-completed"
            >
              <CheckCircle2 size={16} />
              Done
            </button>
            <button
              type="button"
              onClick={() => recordResult("dismissed")}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-vyva-border bg-white px-3 text-[14px] font-bold text-vyva-text-2 transition active:scale-[0.98]"
              data-testid="button-simulate-dismissed"
            >
              <XCircle size={16} />
              Hide
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
