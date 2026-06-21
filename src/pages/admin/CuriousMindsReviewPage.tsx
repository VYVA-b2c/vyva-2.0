import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabaseClient";
import AdminPageHeader from "./AdminPageHeader";

type ReviewMode = "hooks" | "prompts";

type DraftRow = {
  id: string;
  language: string;
  created_at?: string;
  reviewed_at?: string | null;
  category?: string;
  prompt_type?: string;
  fact_prompt?: string;
  fact_answer?: string;
  prompt_text?: string;
  topic?: string;
};

const CHECKLIST = [
  "factuallyAccurate",
  "warmTone",
  "naturalLanguage",
  "safeContent",
  "notPatronising",
] as const;

const PROMPT_ONLY_CHECKS = ["openEnded"] as const;

const HOOK_FIELDS = ["fact_prompt", "fact_answer"] as const;
const PROMPT_FIELDS = ["prompt_text", "topic"] as const;

export default function CuriousMindsReviewPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<ReviewMode>("hooks");
  const [items, setItems] = useState<DraftRow[]>([]);
  const [draftsById, setDraftsById] = useState<Record<string, Record<string, string>>>({});
  const [checksById, setChecksById] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const config = useMemo(() => {
    if (mode === "hooks") {
      return {
        table: "curious_minds_hooks",
        fields: HOOK_FIELDS,
        title: t("games.curiousMinds.admin.hooksTitle", "Curiosity hooks"),
      };
    }
    return {
      table: "curious_minds_prompts",
      fields: PROMPT_FIELDS,
      title: t("games.curiousMinds.admin.promptsTitle", "Divergent prompts"),
    };
  }, [mode, t]);

  const visibleChecklist = mode === "hooks" ? CHECKLIST : [...CHECKLIST, ...PROMPT_ONLY_CHECKS];

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from(config.table)
      .select("*")
      .eq("is_active", false)
      .order("created_at", { ascending: true })
      .limit(200);

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const pending = ((data ?? []) as DraftRow[]).filter((item) => !item.reviewed_at);
    setItems(pending);
    setDraftsById(
      Object.fromEntries(
        pending.map((item) => [
          item.id,
          Object.fromEntries(config.fields.map((field) => [field, String(item[field] ?? "")])),
        ]),
      ),
    );
    setChecksById({});
    setLoading(false);
  }, [config]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const updateDraft = (id: string, field: string, value: string) => {
    setDraftsById((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  };

  const updateCheck = (id: string, check: string, checked: boolean) => {
    setChecksById((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [check]: checked,
      },
    }));
  };

  const allChecksPassed = (id: string) => visibleChecklist.every((check) => checksById[id]?.[check]);

  const approveItem = async (item: DraftRow) => {
    if (!allChecksPassed(item.id)) return;

    const { error: updateError } = await supabase
      .from(config.table)
      .update({
        ...(draftsById[item.id] ?? {}),
        is_active: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.email ?? user?.id ?? "admin",
      })
      .eq("id", item.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  };

  const rejectItem = async (item: DraftRow) => {
    const { error: updateError } = await supabase
      .from(config.table)
      .update({
        is_active: false,
        reviewed_at: new Date().toISOString(),
        reviewed_by: `rejected:${user?.email ?? user?.id ?? "admin"}`,
      })
      .eq("id", item.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  };

  return (
    <main className="min-h-screen bg-[#F7F2EB] px-5 py-6 text-[#2f2135]">
      <div className="mx-auto w-full max-w-6xl">
        <AdminPageHeader
          title={t("games.curiousMinds.admin.title", "Content review")}
          subtitle={t("games.curiousMinds.admin.subtitle", "Approve, edit, or reject Curious Minds draft content before it reaches members.")}
        />

        <section className="mt-5 rounded-3xl border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-serif text-3xl">{config.title}</h1>
              <p className="mt-1 text-sm font-bold text-[#7d6b65]">
                {t("games.curiousMinds.admin.pendingCount", "{n} drafts pending review", { n: items.length })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("hooks")}
                className={`min-h-[52px] rounded-2xl px-5 text-sm font-black ${mode === "hooks" ? "bg-purple-700 text-white" : "border border-[#eadfd5] bg-white text-[#2f2135]"}`}
              >
                {t("games.curiousMinds.admin.hooksTab", "Hooks")}
              </button>
              <button
                type="button"
                onClick={() => setMode("prompts")}
                className={`min-h-[52px] rounded-2xl px-5 text-sm font-black ${mode === "prompts" ? "bg-purple-700 text-white" : "border border-[#eadfd5] bg-white text-[#2f2135]"}`}
              >
                {t("games.curiousMinds.admin.promptsTab", "Prompts")}
              </button>
              <button
                type="button"
                onClick={() => void loadItems()}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-[#eadfd5] bg-white px-5 text-sm font-black text-purple-700"
              >
                <RefreshCw size={16} />
                {t("games.curiousMinds.admin.refresh", "Refresh")}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
        ) : null}

        {loading ? (
          <p className="mt-5 rounded-3xl border border-[#eadfd5] bg-white p-5 text-sm font-bold text-[#7d6b65]">
            {t("games.curiousMinds.admin.loading", "Loading drafts...")}
          </p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="mt-5 rounded-3xl border border-[#eadfd5] bg-white p-5 text-sm font-bold text-[#7d6b65]">
            {t("games.curiousMinds.admin.empty", "No pending drafts.")}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-3xl border border-[#eadfd5] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-black text-purple-700">{item.language}</span>
                <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-black text-[#92400E]">
                  {mode === "hooks" ? item.category : item.prompt_type}
                </span>
                {item.created_at ? <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-bold text-[#64748B]">{new Date(item.created_at).toLocaleDateString()}</span> : null}
              </div>

              <div className="mt-4 grid gap-3">
                {config.fields.map((field) => (
                  <label key={field} className="block">
                    <span className="text-sm font-black text-[#2f2135]">{t(`games.curiousMinds.admin.fields.${field}`, field)}</span>
                    <textarea
                      value={draftsById[item.id]?.[field] ?? ""}
                      onChange={(event) => updateDraft(item.id, field, event.target.value)}
                      rows={field === "fact_answer" ? 4 : 3}
                      className="mt-2 min-h-[92px] w-full rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-4 py-3 text-base font-semibold text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                    />
                  </label>
                ))}
              </div>

              <fieldset className="mt-4 rounded-2xl border border-[#eadfd5] p-4">
                <legend className="px-2 text-sm font-black text-[#2f2135]">{t("games.curiousMinds.admin.checklistTitle", "Review checklist")}</legend>
                <div className="grid gap-2">
                  {visibleChecklist.map((check) => (
                    <label key={check} className="flex min-h-[44px] items-center gap-3 text-sm font-bold text-[#4b3b52]">
                      <input
                        type="checkbox"
                        checked={Boolean(checksById[item.id]?.[check])}
                        onChange={(event) => updateCheck(item.id, check, event.target.checked)}
                        className="h-6 w-6 accent-purple-700"
                      />
                      <span>{t(`games.curiousMinds.admin.checklist.${check}`, check)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void approveItem(item)}
                  disabled={!allChecksPassed(item.id)}
                  className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl bg-purple-700 px-5 text-sm font-black text-white disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  {t("games.curiousMinds.admin.approve", "Approve")}
                </button>
                <button
                  type="button"
                  onClick={() => void rejectItem(item)}
                  className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl border border-red-200 bg-white px-5 text-sm font-black text-red-700"
                >
                  <XCircle size={18} />
                  {t("games.curiousMinds.admin.reject", "Reject")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
