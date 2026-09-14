import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, Save, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/queryClient";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";

type RoomPrompt = {
  id: string;
  roomId: string;
  roomSlug: string;
  roomName: string;
  sessionDate: string;
  topicEn: string;
  topicEs: string;
  topicDe: string;
  openerEn: string;
  openerEs: string;
  openerDe: string;
  activityType: string;
  isLive: boolean;
  createdAt: string | null;
};

export default function RoomPromptsAdminPage() {
  const [searchParams] = useSearchParams();
  const focusedId = searchParams.get("focus");
  const [prompts, setPrompts] = useState<RoomPrompt[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/social/room-prompts");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Room prompts could not be loaded.");
      setPrompts(data.prompts ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Room prompts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (!focusedId || prompts.length === 0) return;
    document.getElementById(`room-prompt-${focusedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedId, prompts.length]);

  const visiblePrompts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return prompts;
    return prompts.filter((prompt) => [prompt.roomName, prompt.roomSlug, prompt.sessionDate, prompt.topicEn, prompt.topicEs, prompt.topicDe].join(" ").toLowerCase().includes(query));
  }, [prompts, search]);

  function updatePrompt(id: string, patch: Partial<RoomPrompt>) {
    setPrompts((current) => current.map((prompt) => prompt.id === id ? { ...prompt, ...patch } : prompt));
  }

  async function savePrompt(prompt: RoomPrompt) {
    setSavingId(prompt.id);
    setMessage("");
    try {
      const response = await apiFetch(`/api/admin/social/room-prompts/${prompt.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          topicEn: prompt.topicEn,
          topicEs: prompt.topicEs,
          topicDe: prompt.topicDe,
          openerEn: prompt.openerEn,
          openerEs: prompt.openerEs,
          openerDe: prompt.openerDe,
          isLive: prompt.isLive,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Room prompt could not be saved.");
      setMessage(`${prompt.roomName} prompt saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Room prompt could not be saved.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#2f2135] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader title="Room prompts" subtitle="Review the daily topic and opening question shown inside each social room. English, Spanish, and German are stored with the room session.">
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-purple-700 px-4 text-sm font-black text-white disabled:opacity-60">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" /> Refresh
          </button>
        </AdminPageHeader>
        <AdminMenu />

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="max-w-xl flex-1">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Find a prompt</span>
              <span className="relative block">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b7a73]" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Room, date, or topic" className="h-11 w-full rounded-[10px] border border-[#dfd3ca] bg-[#fffdfb] pl-10 pr-3 text-sm font-semibold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100" />
              </span>
            </label>
            <p className="text-sm font-bold text-[#7d6b65]">{visiblePrompts.length} of {prompts.length} prompts</p>
          </div>
          {message ? <p className="mt-3 rounded-[10px] bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800" role="status">{message}</p> : null}
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-2">
          {loading ? <p className="rounded-[14px] border border-[#eadfd5] bg-white p-8 text-center font-bold text-[#7d6b65] xl:col-span-2">Loading room prompts...</p> : null}
          {!loading && visiblePrompts.length === 0 ? <p className="rounded-[14px] border border-[#eadfd5] bg-white p-8 text-center font-bold text-[#7d6b65] xl:col-span-2">No room prompts match this search.</p> : null}
          {visiblePrompts.map((prompt) => (
            <article id={`room-prompt-${prompt.id}`} key={prompt.id} className={`rounded-[14px] border bg-white p-5 shadow-sm ${focusedId === prompt.id ? "border-purple-500 ring-4 ring-purple-100" : "border-[#eadfd5]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee5dd] pb-4">
                <div>
                  <p className="font-black">{prompt.roomName}</p>
                  <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{prompt.sessionDate} - {prompt.activityType}</p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
                  <input type="checkbox" checked={prompt.isLive} onChange={(event) => updatePrompt(prompt.id, { isLive: event.target.checked })} /> Live
                </label>
              </div>
              <div className="mt-4 grid gap-4">
                {(["En", "Es", "De"] as const).map((language) => (
                  <fieldset key={language} className="grid gap-2 rounded-[10px] border border-[#eee5dd] bg-[#fffdfb] p-3">
                    <legend className="px-1 text-xs font-black uppercase tracking-[0.12em] text-purple-700">{language === "En" ? "English" : language === "Es" ? "Spanish" : "German"}</legend>
                    <label>
                      <span className="mb-1 block text-xs font-black text-[#6f625e]">Topic</span>
                      <input value={prompt[`topic${language}`]} onChange={(event) => updatePrompt(prompt.id, { [`topic${language}`]: event.target.value })} className="h-11 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 text-sm font-semibold outline-none focus:border-purple-400" />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-black text-[#6f625e]">Opening question</span>
                      <textarea value={prompt[`opener${language}`]} onChange={(event) => updatePrompt(prompt.id, { [`opener${language}`]: event.target.value })} className="min-h-20 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-purple-400" />
                    </label>
                  </fieldset>
                ))}
              </div>
              <button type="button" onClick={() => void savePrompt(prompt)} disabled={savingId === prompt.id} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-purple-700 px-4 text-sm font-black text-white disabled:opacity-60">
                {savingId === prompt.id ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} Save prompt
              </button>
              {focusedId === prompt.id ? <span className="ml-3 inline-flex items-center gap-1 text-sm font-bold text-purple-700"><CheckCircle2 size={15} /> Opened from content index</span> : null}
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
