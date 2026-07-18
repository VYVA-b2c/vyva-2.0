import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Link2, Loader2, Mail, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import type { ConciergeInboundReplyReviewItem } from "../../../shared/conciergeInboundReplies";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";

type ReviewResponse = {
  items?: ConciergeInboundReplyReviewItem[];
  error?: string;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ConciergeInboundRepliesAdminPage() {
  const [items, setItems] = useState<ConciergeInboundReplyReviewItem[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/concierge/inbound-replies");
      const data = await response.json().catch(() => ({})) as ReviewResponse;
      if (!response.ok) throw new Error(data.error || "Email replies could not be loaded.");
      setItems(data.items ?? []);
    } catch (error) {
      setItems([]);
      setMessage(error instanceof Error ? error.message : "Email replies could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function updateReply(item: ConciergeInboundReplyReviewItem, action: "link" | "ignore") {
    const pendingId = selectedTasks[item.id];
    if (action === "link" && !pendingId) {
      setMessage("Choose the matching Concierge task first.");
      return;
    }

    setSavingId(item.id);
    setMessage("");
    try {
      const response = await apiFetch(`/api/admin/concierge/inbound-replies/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(action === "link"
          ? { action, pending_id: pendingId }
          : { action }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Email reply could not be updated.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessage(action === "link" ? "Reply connected to the task." : "Reply removed from review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email reply could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#2f2135] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-6xl">
        <AdminPageHeader
          title="Email replies"
          subtitle="Connect provider replies that could not be matched automatically."
        >
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#eadfd5] bg-white px-3 text-sm font-bold hover:border-purple-200 hover:text-purple-700 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </button>
        </AdminPageHeader>

        <AdminMenu />

        {message ? (
          <div className="mt-4 rounded-[8px] border border-purple-100 bg-white px-4 py-3 text-sm font-bold" role="status">
            {message}
          </div>
        ) : null}

        <section className="mt-5" aria-labelledby="email-replies-heading">
          <div className="flex items-center justify-between gap-3 border-b border-[#e4d8cd] pb-3">
            <div>
              <h2 id="email-replies-heading" className="font-serif text-2xl">Needs review</h2>
              <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                {items.length === 1 ? "1 reply" : `${items.length} replies`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-bold text-[#7d6b65]">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Loading replies
            </div>
          ) : items.length === 0 ? (
            <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-[8px] border border-emerald-200 bg-white px-5 text-center">
              <CheckCircle2 size={28} className="text-emerald-600" aria-hidden="true" />
              <p className="mt-3 font-black">No replies need review</p>
              <p className="mt-1 text-sm font-semibold text-[#7d6b65]">New matched replies appear in their Concierge task automatically.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {items.map((item) => {
                const saving = savingId === item.id;
                return (
                  <article key={item.id} className="rounded-[8px] border border-[#e4d8cd] bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-purple-700">
                          <Mail size={16} aria-hidden="true" />
                          <span className="truncate">{item.senderEmail}</span>
                          <span className="shrink-0 text-xs text-[#8b7a73]">{formatDate(item.receivedAt)}</span>
                        </div>
                        <h3 className="mt-2 text-base font-black">{item.subject}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#5b4a46]">{item.preview}</p>
                      </div>

                      <div className="w-full shrink-0 lg:w-[360px]">
                        <label htmlFor={`task-${item.id}`} className="text-xs font-black uppercase text-[#7d6b65]">
                          Matching task
                        </label>
                        <select
                          id={`task-${item.id}`}
                          value={selectedTasks[item.id] ?? ""}
                          onChange={(event) => setSelectedTasks((current) => ({ ...current, [item.id]: event.target.value }))}
                          className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d9ccc1] bg-white px-3 text-sm font-semibold"
                        >
                          <option value="">Choose a task</option>
                          {item.candidates.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.providerName} - {candidate.actionSummary} ({candidate.userLabel})
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void updateReply(item, "link")}
                            disabled={saving || !selectedTasks[item.id]}
                            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[8px] bg-purple-700 px-3 text-sm font-black text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
                            Connect
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateReply(item, "ignore")}
                            disabled={saving}
                            aria-label={`Ignore reply from ${item.senderEmail}`}
                            title="Ignore"
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#d9ccc1] bg-white text-[#5b4a46] hover:border-red-200 hover:text-red-700 disabled:opacity-50"
                          >
                            <X size={17} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
