import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  KeyRound,
  Mic,
  RadioTower,
  Route,
  Sparkles,
  TestTube2,
} from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { useVoiceActionContext } from "@/contexts/VoiceActionContext";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import {
  VOICE_AGENT_CONTRACTS,
  validateVoiceAgentContext,
  voiceAgentContractFor,
  type VoiceAgentContract,
  type VoiceContextValidation,
} from "@/lib/voiceAgentContracts";
import {
  actionForVoiceUtterance,
  emitVoiceAppAction,
  voiceActionRegistryEntries,
  VOICE_SPECIALIST_AGENT_SLUGS,
} from "@/lib/voiceNavigation";
import { voiceSessionPhaseLabel } from "@/lib/voiceSessionState";
import {
  clearVoiceTimeline,
  fetchPersistedVoiceTimelineEvents,
  flushVoiceTimelineEvents,
  recordVoiceTimelineEvent,
  useVoiceTimeline,
  type PersistedVoiceTimelineEvent,
  type VoiceTimelineEvent,
} from "@/lib/voiceTimeline";

const QUICK_UTTERANCES = [
  "Do we need to buy Paracetamol?",
  "I forgot my medication",
  "Can we check my blood pressure?",
  "I feel chest pain",
  "Can you book a GP appointment?",
  "Let's play a memory game",
  "Show me social rooms",
];

function statusLabel(validation: VoiceContextValidation) {
  if (validation.status === "ready") return "Ready";
  if (validation.status === "missing_required") return "Missing keys";
  return "No session";
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "dark" }) {
  const classes = {
    neutral: "border-[#eadfd5] bg-white text-[#5b4a46]",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    dark: "border-[#2f2135] bg-[#2f2135] text-white",
  }[tone];

  return (
    <span className={`inline-flex min-h-[30px] items-center rounded-full border px-3 text-xs font-black ${classes}`}>
      {children}
    </span>
  );
}

function MetricTile({ icon: Icon, label, value, sub }: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">{label}</p>
          <p className="mt-1 truncate text-lg font-black text-[#2f2135]">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[#7d6b65]">{sub}</p>
    </section>
  );
}

function formatTimelineTime(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function timelineMarkerClass(severity: "info" | "success" | "warning" | "error") {
  if (severity === "success") return "bg-emerald-500";
  if (severity === "warning") return "bg-amber-500";
  if (severity === "error") return "bg-red-500";
  return "bg-purple-500";
}

function isPersistedTimelineEvent(event: VoiceTimelineEvent): event is PersistedVoiceTimelineEvent {
  return "userId" in event;
}

function AgentCard({ contract, validation, active }: {
  contract: VoiceAgentContract;
  validation: VoiceContextValidation;
  active: boolean;
}) {
  const missingPreview = validation.missingRequiredKeys.slice(0, 5);

  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${active ? "border-purple-300 ring-2 ring-purple-100" : "border-[#eadfd5]"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-[#2f2135]">{contract.name}</h2>
            {active && <Pill tone="dark">Current</Pill>}
            <Pill tone={validation.status === "ready" ? "good" : validation.status === "missing_required" ? "warn" : "neutral"}>
              {statusLabel(validation)} - {validation.coveragePct}%
            </Pill>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#7d6b65]">{contract.notes}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Pill>{contract.domain}</Pill>
          {contract.agentSlug && <Pill>{contract.agentSlug}</Pill>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Entrypoints</p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4352]">{contract.entrypoints.join(", ")}</p>
        </div>
        <div className="rounded-xl bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Plans</p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4352]">{contract.planIds.join(", ")}</p>
        </div>
        <div className="rounded-xl bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Actions</p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4352]">{contract.actionTypes.join(", ")}</p>
        </div>
      </div>

      {validation.status === "missing_required" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-sm font-black text-amber-900">
            <AlertTriangle size={16} />
            Missing required context
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingPreview.map((key) => <Pill key={key} tone="warn">{key}</Pill>)}
            {validation.missingRequiredKeys.length > missingPreview.length && (
              <Pill tone="warn">+{validation.missingRequiredKeys.length - missingPreview.length} more</Pill>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function VoiceReadinessAdminPage() {
  const {
    status,
    isMicMuted,
    isTransferring,
    voiceSessionPhase,
    transcript,
    lastResolvedSessionContext,
  } = useVyvaVoice();
  const { activeAction, isActiveActionAccepted } = useVoiceActionContext();
  const timelineEvents = useVoiceTimeline();
  const [persistedTimelineEvents, setPersistedTimelineEvents] = useState<PersistedVoiceTimelineEvent[]>([]);
  const [timelineServerStatus, setTimelineServerStatus] = useState("Local timeline ready");
  const [utterance, setUtterance] = useState(QUICK_UTTERANCES[0]);
  const [simulatorMessage, setSimulatorMessage] = useState("");
  const displayedTimelineEvents: VoiceTimelineEvent[] = useMemo(() => (
    persistedTimelineEvents.length > 0 ? persistedTimelineEvents : [...timelineEvents].reverse()
  ), [persistedTimelineEvents, timelineEvents]);

  const currentContract = voiceAgentContractFor({
    domain: lastResolvedSessionContext?.domain,
    agentSlug: lastResolvedSessionContext?.agentSlug,
    conversationPlanId: lastResolvedSessionContext?.conversationPlanId,
  });
  const currentValidation = validateVoiceAgentContext(
    currentContract,
    lastResolvedSessionContext?.dynamicVariables,
  );
  const variableEntries = useMemo(() => (
    Object.entries(lastResolvedSessionContext?.dynamicVariables ?? {})
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim().length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
  ), [lastResolvedSessionContext?.dynamicVariables]);
  const actionEntries = useMemo(() => voiceActionRegistryEntries(), []);
  const agentRows = useMemo(() => (
    VOICE_AGENT_CONTRACTS.map((contract) => ({
      contract,
      validation: validateVoiceAgentContext(
        contract,
        contract.id === currentContract.id ? lastResolvedSessionContext?.dynamicVariables : undefined,
      ),
    }))
  ), [currentContract.id, lastResolvedSessionContext?.dynamicVariables]);

  async function refreshPersistedTimeline() {
    try {
      setTimelineServerStatus("Syncing latest events...");
      await flushVoiceTimelineEvents();
      const events = await fetchPersistedVoiceTimelineEvents(120);
      setPersistedTimelineEvents(events);
      setTimelineServerStatus(events.length > 0
        ? `${events.length} persisted QA events loaded`
        : "No persisted QA events yet");
    } catch {
      setTimelineServerStatus("Persisted QA timeline unavailable");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setTimelineServerStatus("Loading persisted QA events...");
        await flushVoiceTimelineEvents();
        const events = await fetchPersistedVoiceTimelineEvents(120);
        if (cancelled) return;
        setPersistedTimelineEvents(events);
        setTimelineServerStatus(events.length > 0
          ? `${events.length} persisted QA events loaded`
          : "No persisted QA events yet");
      } catch {
        if (!cancelled) setTimelineServerStatus("Persisted QA timeline unavailable");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function simulateUtterance(value = utterance) {
    const action = actionForVoiceUtterance(value);
    if (!action) {
      setSimulatorMessage("No app action matched that utterance.");
      recordVoiceTimelineEvent({
        kind: "simulator",
        title: "Simulator utterance did not match",
        detail: value,
        severity: "warning",
      });
      return;
    }
    emitVoiceAppAction(action);
    setSimulatorMessage(`Matched ${action.actionType ?? action.id} - ${action.route}`);
    recordVoiceTimelineEvent({
      kind: "simulator",
      title: "Simulator utterance matched",
      detail: value,
      domain: action.domain,
      route: action.route,
      actionId: action.id,
      ...(action.actionType ? { actionType: action.actionType } : {}),
    });
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Voice readiness"
          subtitle="Inspect agent contracts, selected plans, live voice state, context keys, and simulator shortcuts before configuring ElevenLabs prompts."
        >
          <Pill tone={currentValidation.status === "ready" ? "good" : currentValidation.status === "missing_required" ? "warn" : "neutral"}>
            {currentContract.name}: {statusLabel(currentValidation)}
          </Pill>
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            icon={Mic}
            label="Voice state"
            value={voiceSessionPhaseLabel(voiceSessionPhase)}
            sub={`${status}${isMicMuted ? " - mic off" : " - mic on"}${isTransferring ? " - transfer pending" : ""}`}
          />
          <MetricTile
            icon={GitBranch}
            label="Plan"
            value={lastResolvedSessionContext?.conversationPlanId ?? "No session yet"}
            sub={lastResolvedSessionContext?.appEntrypoint ? `Entrypoint: ${lastResolvedSessionContext.appEntrypoint}` : "Start a voice session to resolve a plan."}
          />
          <MetricTile
            icon={KeyRound}
            label="Context keys"
            value={`${currentValidation.presentRequiredKeys.length}/${currentContract.requiredContextKeys.length}`}
            sub={`${variableEntries.length} populated variables available in the last resolved session.`}
          />
          <MetricTile
            icon={Route}
            label="Active action"
            value={activeAction?.title ?? "None"}
            sub={activeAction ? `${activeAction.route} - ${isActiveActionAccepted ? "confirmed" : "not confirmed"}` : "No current app action."}
          />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="space-y-4">
            {agentRows.map(({ contract, validation }) => (
              <AgentCard
                key={contract.id}
                contract={contract}
                validation={validation}
                active={contract.id === currentContract.id}
              />
            ))}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
                  <TestTube2 size={19} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Simulator shortcuts</h2>
                  <p className="text-sm text-[#7d6b65]">Test app-side routing without ElevenLabs.</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={utterance}
                  onChange={(event) => setUtterance(event.target.value)}
                  className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold outline-none focus:border-purple-300"
                />
                <button
                  type="button"
                  onClick={() => simulateUtterance()}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-purple-700 px-4 text-sm font-black text-white transition hover:bg-purple-800"
                >
                  Test
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_UTTERANCES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setUtterance(item);
                      simulateUtterance(item);
                    }}
                    className="rounded-full border border-[#eadfd5] bg-[#fbf8f5] px-3 py-2 text-left text-xs font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
                  >
                    {item}
                  </button>
                ))}
              </div>

              {simulatorMessage && (
                <p className="mt-3 rounded-xl bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800">
                  {simulatorMessage}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
                    <Activity size={19} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">Voice timeline</h2>
                    <p className="text-sm text-[#7d6b65]">{timelineServerStatus}</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshPersistedTimeline()}
                    className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
                  >
                    Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearVoiceTimeline();
                      setTimelineServerStatus("Local timeline cleared");
                    }}
                    className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#5b4a46] transition hover:border-red-200 hover:text-red-700"
                  >
                    Clear local
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-[440px] space-y-3 overflow-auto pr-1">
                {displayedTimelineEvents.length > 0 ? displayedTimelineEvents.slice(0, 18).map((event) => (
                  <article key={event.id} className="relative rounded-xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${timelineMarkerClass(event.severity)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 break-words text-sm font-black text-[#2f2135]">{event.title}</p>
                          <span className="text-xs font-bold text-[#8b7a73]">{formatTimelineTime(event.at)}</span>
                        </div>
                        <p className="mt-1 break-words text-xs font-bold text-[#7d6b65]">
                          {event.detail || event.kind}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Pill>{event.kind}</Pill>
                          {event.domain && <Pill>{event.domain}</Pill>}
                          {event.route && <Pill>{event.route}</Pill>}
                          {event.conversationPlanId && <Pill>{event.conversationPlanId}</Pill>}
                          {isPersistedTimelineEvent(event) && event.userId && <Pill>persisted</Pill>}
                        </div>
                      </div>
                    </div>
                  </article>
                )) : (
                  <p className="rounded-xl bg-[#fbf8f5] p-3 text-sm font-bold text-[#7d6b65]">
                    No voice timeline events yet. Start a voice session or use a simulator shortcut.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
                  <Sparkles size={19} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Current action</h2>
                  <p className="text-sm text-[#7d6b65]">What the app is fulfilling now.</p>
                </div>
              </div>

              {activeAction ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-[#fbf8f5] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Route</p>
                    <p className="mt-1 text-sm font-black text-[#2f2135]">{activeAction.route}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={isActiveActionAccepted ? "good" : activeAction.requiresConfirmation ? "warn" : "neutral"}>
                      {isActiveActionAccepted ? "Confirmed" : activeAction.requiresConfirmation ? "Needs tap" : "No tap required"}
                    </Pill>
                    <Pill>{activeAction.domain}</Pill>
                    {activeAction.actionType && <Pill>{activeAction.actionType}</Pill>}
                  </div>
                  {activeAction.payload && (
                    <div className="rounded-xl bg-[#fbf8f5] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Payload</p>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs font-bold text-[#4f4352]">
                        {JSON.stringify(activeAction.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-[#fbf8f5] p-3 text-sm font-bold text-[#7d6b65]">
                  No active voice action.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
                  <RadioTower size={19} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Agent slugs</h2>
                  <p className="text-sm text-[#7d6b65]">Expected app-to-agent mapping.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {Object.entries(VOICE_SPECIALIST_AGENT_SLUGS).map(([domain, slug]) => (
                  <div key={domain} className="flex items-center justify-between gap-3 rounded-xl bg-[#fbf8f5] px-3 py-2">
                    <span className="text-sm font-black text-[#2f2135]">{domain}</span>
                    <span className="text-sm font-bold text-[#7d6b65]">{slug}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Resolved context variables</h2>
              <Pill tone={currentValidation.status === "ready" ? "good" : currentValidation.status === "missing_required" ? "warn" : "neutral"}>
                {variableEntries.length} populated
              </Pill>
            </div>
            <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-[#eadfd5]">
              {variableEntries.length > 0 ? variableEntries.map(([key, value]) => (
                <div key={key} className="grid gap-2 border-b border-[#eadfd5] p-3 last:border-b-0 md:grid-cols-[220px_1fr]">
                  <span className="break-words text-sm font-black text-[#2f2135]">{key}</span>
                  <span className="break-words text-sm font-bold text-[#7d6b65]">{String(value).slice(0, 320)}</span>
                </div>
              )) : (
                <p className="p-4 text-sm font-bold text-[#7d6b65]">Start a voice session to inspect context variables.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Registry coverage</h2>
              <Pill>{actionEntries.length} actions</Pill>
            </div>
            <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-[#eadfd5]">
              {actionEntries.map((entry) => (
                <div key={entry.actionType} className="grid gap-2 border-b border-[#eadfd5] p-3 last:border-b-0 md:grid-cols-[220px_1fr]">
                  <div>
                    <p className="text-sm font-black text-[#2f2135]">{entry.actionType}</p>
                    <p className="mt-1 text-xs font-bold text-[#8b7a73]">{entry.domain} - {entry.route}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.requiredPayloadKeys.length > 0 ? entry.requiredPayloadKeys.map((key) => <Pill key={key} tone="warn">{key}</Pill>) : <Pill tone="good">No required payload</Pill>}
                    {entry.optionalPayloadKeys.slice(0, 5).map((key) => <Pill key={key}>{key}</Pill>)}
                    {entry.requiresConfirmation && <Pill tone="warn">tap confirm</Pill>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="flex items-center gap-2 text-sm font-black">
            <CheckCircle2 size={17} />
            ElevenLabs prompt prep rule
          </p>
          <p className="mt-2 text-sm font-bold leading-relaxed">
            Do not update a prompt until its contract is ready for a real session, or the missing keys are accepted as intentionally unavailable for that agent.
          </p>
          {transcript.length > 0 && (
            <p className="mt-2 text-sm font-bold leading-relaxed">
              Transcript entries in current session: {transcript.length}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
