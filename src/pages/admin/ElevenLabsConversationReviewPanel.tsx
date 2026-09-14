import { useCallback, useEffect, useMemo, useState } from "react";
import { Headphones, RefreshCw, Search, ShieldCheck } from "lucide-react";
import {
  ELEVENLABS_REVIEW_STATUSES,
  fetchElevenLabsConversationAudio,
  fetchElevenLabsConversationDetails,
  fetchElevenLabsConversations,
  saveElevenLabsConversationReview,
  type ElevenLabsConversationDetails,
  type ElevenLabsConversationSummary,
  type ElevenLabsReviewStatus,
} from "@/lib/elevenLabsConversationReviews";

function reviewStatusLabel(status: ElevenLabsReviewStatus) {
  return {
    unreviewed: "Unreviewed",
    reviewed: "Reviewed",
    needs_follow_up: "Needs follow-up",
    quality_issue: "Quality issue",
  }[status];
}

function formatDate(value: number | null) {
  return value ? new Date(value).toLocaleString() : "Unknown";
}

function formatDuration(value: number | null) {
  if (value === null) return "Unknown duration";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export default function ElevenLabsConversationReviewPanel() {
  const [conversations, setConversations] = useState<ElevenLabsConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState<ElevenLabsConversationDetails | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ElevenLabsReviewStatus>("unreviewed");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("Loading provider conversation index...");
  const [busy, setBusy] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      setMessage("Loading provider conversation index...");
      const rows = await fetchElevenLabsConversations();
      setConversations(rows);
      setMessage(rows.length ? `${rows.length} conversation${rows.length === 1 ? "" : "s"} indexed.` : "No post-call conversations have been indexed yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load conversations.");
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const selected = conversations.find((conversation) => conversation.providerConversationId === selectedId) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) => [
      conversation.providerConversationId,
      conversation.vyvaSessionId,
      conversation.userId,
      conversation.agentName,
      conversation.locale,
      conversation.reviewStatus,
    ].some((value) => value?.toLowerCase().includes(needle)));
  }, [conversations, query]);

  function selectConversation(conversation: ElevenLabsConversationSummary) {
    setSelectedId(conversation.providerConversationId);
    setStatus(conversation.reviewStatus);
    setNote(conversation.reviewNote);
    setDetails(null);
    setAudioUrl(null);
    setMessage("Enter a review reason before retrieving transcript or audio.");
  }

  const hasReason = reason.trim().length >= 3;

  async function loadDetails() {
    if (!selected || !hasReason) return;
    try {
      setBusy(true);
      setDetails(await fetchElevenLabsConversationDetails(selected.providerConversationId, reason));
      setMessage("Transcript retrieved for this review only; it was not copied into VYVA storage.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not retrieve transcript.");
    } finally {
      setBusy(false);
    }
  }

  async function loadAudio() {
    if (!selected || !hasReason) return;
    try {
      setBusy(true);
      const blob = await fetchElevenLabsConversationAudio(selected.providerConversationId, reason);
      setAudioUrl(URL.createObjectURL(blob));
      setMessage("Recording loaded securely. Browser caching is disabled and access was audited.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not retrieve recording.");
    } finally {
      setBusy(false);
    }
  }

  async function saveReview() {
    if (!selected || !hasReason) return;
    try {
      setBusy(true);
      const updated = await saveElevenLabsConversationReview({
        conversationId: selected.providerConversationId,
        status,
        note,
        reason,
      });
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage("Review status saved and audit event recorded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#d9cbed] bg-white p-4 shadow-sm" data-testid="elevenlabs-conversation-review">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2eaff] text-purple-700">
            <Headphones size={21} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">ElevenLabs review</p>
            <h2 className="mt-1 text-xl font-black text-[#2f2135]">Audited conversation playback</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#7d6b65]">
              VYVA keeps only the provider ID and review metadata. Transcript and audio are fetched from ElevenLabs only when an admin provides a reason.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void loadConversations()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d9cbed] px-4 text-sm font-black text-purple-700">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.6fr)]">
        <div className="rounded-2xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
          <label className="relative block">
            <span className="sr-only">Search conversations</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 text-[#8b7a73]" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, user, agent, language..." className="min-h-11 w-full rounded-xl border border-[#eadfd5] bg-white pl-10 pr-3 text-sm font-bold outline-none focus:border-purple-400" />
          </label>
          <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
            {filtered.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => selectConversation(conversation)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === conversation.providerConversationId ? "border-purple-400 bg-[#f2eaff]" : "border-[#eadfd5] bg-white hover:border-purple-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-black text-[#2f2135]">{conversation.agentName || "Dr. AI"}</span>
                  <span className="rounded-full bg-[#f4eff7] px-2 py-1 text-[11px] font-black text-purple-700">{reviewStatusLabel(conversation.reviewStatus)}</span>
                </div>
                <p className="mt-2 truncate text-xs font-bold text-[#7d6b65]">{conversation.userId || "Unknown user"} · {formatDate(conversation.completedAt)}</p>
                <p className="mt-1 truncate text-xs text-[#8b7a73]">{conversation.providerConversationId}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#eadfd5] bg-white p-4">
          {selected ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs font-black uppercase text-[#8b7a73]">Completed</p><p className="mt-1 text-sm font-bold">{formatDate(selected.completedAt)}</p></div>
                <div><p className="text-xs font-black uppercase text-[#8b7a73]">Duration</p><p className="mt-1 text-sm font-bold">{formatDuration(selected.durationSeconds)}</p></div>
                <div><p className="text-xs font-black uppercase text-[#8b7a73]">Consent</p><p className="mt-1 text-sm font-bold">{selected.consentStatus}</p></div>
                <div><p className="text-xs font-black uppercase text-[#8b7a73]">Retrieval ends</p><p className="mt-1 text-sm font-bold">{formatDate(selected.retentionDeleteAt)}</p></div>
              </div>

              <label className="mt-4 block text-sm font-black text-[#2f2135]">
                Access reason <span className="text-red-600">required</span>
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Investigating reported voice quality issue" className="mt-2 min-h-11 w-full rounded-xl border border-[#d9cbed] px-3 text-sm font-bold outline-none focus:border-purple-500" />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy || !hasReason || !selected.availability.details} onClick={() => void loadDetails()} className="min-h-11 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Load transcript</button>
                <button type="button" disabled={busy || !hasReason || !selected.availability.audio} onClick={() => void loadAudio()} className="min-h-11 rounded-xl border border-purple-300 px-4 text-sm font-black text-purple-700 disabled:cursor-not-allowed disabled:opacity-40">Load recording</button>
              </div>

              {audioUrl && <audio className="mt-4 w-full" controls preload="none" src={audioUrl}>Your browser does not support audio playback.</audio>}
              {details && (
                <div className="mt-4 rounded-xl bg-[#fbf8f5] p-3">
                  {details.summary && <p className="text-sm font-bold leading-relaxed text-[#5b4a46]">{details.summary}</p>}
                  <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                    {details.transcript.map((turn, index) => (
                      <div key={`${turn.timeInCallSeconds ?? index}-${index}`} className="rounded-lg bg-white p-3">
                        <p className="text-xs font-black uppercase text-purple-700">{turn.role}{turn.timeInCallSeconds !== null ? ` · ${Math.round(turn.timeInCallSeconds)}s` : ""}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#4f4352]">{turn.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
                <label className="text-sm font-black">Review status
                  <select value={status} onChange={(event) => setStatus(event.target.value as ElevenLabsReviewStatus)} className="mt-2 min-h-11 w-full rounded-xl border border-[#d9cbed] bg-white px-3 text-sm font-bold">
                    {ELEVENLABS_REVIEW_STATUSES.map((value) => <option key={value} value={value}>{reviewStatusLabel(value)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-black">Review note
                  <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional finding or follow-up" className="mt-2 min-h-11 w-full rounded-xl border border-[#d9cbed] px-3 text-sm font-bold" />
                </label>
                <button type="button" disabled={busy || !hasReason} onClick={() => void saveReview()} className="min-h-11 rounded-xl bg-[#2f2135] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Save review</button>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <ShieldCheck size={34} className="text-purple-600" />
              <p className="mt-3 text-lg font-black text-[#2f2135]">Select a conversation to review</p>
              <p className="mt-2 max-w-md text-sm text-[#7d6b65]">Playback is not bulk-loaded. Every content request requires a reason and creates an audit event.</p>
            </div>
          )}
          <p className="mt-4 rounded-xl bg-[#f5f0ff] p-3 text-sm font-bold text-[#5b4a75]" role="status">{message}</p>
        </div>
      </div>
    </section>
  );
}
