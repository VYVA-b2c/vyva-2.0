import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, Database, FileJson, RefreshCw, Upload, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import {
  CONTENT_UPLOAD_LANGUAGES,
  CONTENT_UPLOAD_TYPE_OPTIONS,
  parseBulkUploadJson,
  validateBulkUploadItems,
  type BulkUploadContentType,
  type BulkUploadLanguage,
  type BulkUploadPreview,
} from "../../../shared/contentBulkUpload";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";

type AdminPanel = "review" | "bulk";
type ReviewMode = "hooks" | "prompts" | "scent";
type ReviewQueueFilter = "all" | "ready" | "needs_checks" | "edited" | "missing_text";

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
  scent_name?: string;
  scent_description?: string;
  guiding_question?: string;
};

const CHECKLIST = [
  "factuallyAccurate",
  "warmTone",
  "naturalLanguage",
  "safeContent",
  "notPatronising",
] as const;

const PROMPT_ONLY_CHECKS = ["openEnded"] as const;
const SCENT_ONLY_CHECKS = ["lowDistressScent", "openMemoryQuestion"] as const;

const HOOK_FIELDS = ["fact_prompt", "fact_answer"] as const;
const PROMPT_FIELDS = ["prompt_text", "topic"] as const;
const SCENT_FIELDS = ["scent_name", "scent_description", "guiding_question"] as const;
const REVIEW_QUEUE_FILTERS: Array<{ id: ReviewQueueFilter; label: string; description: string }> = [
  { id: "all", label: "All drafts", description: "Everything pending" },
  { id: "ready", label: "Ready", description: "Checklist complete" },
  { id: "needs_checks", label: "Needs checklist", description: "Text present, checks open" },
  { id: "edited", label: "Edited", description: "Changed in review" },
  { id: "missing_text", label: "Missing text", description: "Required fields empty" },
];

type BulkUploadResponse = {
  insertedCount?: number;
  skippedCount?: number;
  error?: string;
};

function previewSummary(preview: BulkUploadPreview) {
  if (preview.totalItems === 0) return "No items detected.";
  if (preview.invalidItems.length === 0) {
    return `${preview.totalItems} items detected, all pass validation.`;
  }
  return `${preview.totalItems} items detected, ${preview.validItems.length} pass validation and ${preview.invalidItems.length} will be skipped.`;
}

function BulkUploadPanel({ onLoaded }: { onLoaded: () => void }) {
  const [contentType, setContentType] = useState<BulkUploadContentType>("cc_story_recall");
  const [language, setLanguage] = useState<BulkUploadLanguage>("es");
  const [jsonText, setJsonText] = useState("");
  const [fileName, setFileName] = useState("");
  const [skipAdminReview, setSkipAdminReview] = useState(true);
  const [preview, setPreview] = useState<BulkUploadPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setPreviewError("");
    setUploadStatus("");
  }, []);

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonText(text);
    setFileName(file.name);
    clearPreview();
  }, [clearPreview]);

  const handlePreview = useCallback(() => {
    clearPreview();
    try {
      const rawItems = parseBulkUploadJson(jsonText);
      setPreview(validateBulkUploadItems(contentType, language, rawItems, {
        skipAdminReview,
        reviewedAt: new Date().toISOString(),
        reviewedBy: "current admin",
      }));
    } catch (error) {
      setPreviewError(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
    }
  }, [clearPreview, contentType, jsonText, language, skipAdminReview]);

  const handleLoad = useCallback(async () => {
    if (!preview || preview.validItems.length === 0) return;

    setUploading(true);
    setUploadStatus("");
    setPreviewError("");

    try {
      const response = await apiFetch("/api/admin/curious-minds/review/bulk-upload", {
        method: "POST",
        body: JSON.stringify({
          contentType,
          language,
          jsonText,
          skipAdminReview,
        }),
      });
      const body = await response.json().catch(() => ({})) as BulkUploadResponse;
      if (!response.ok) {
        setPreviewError(body.error ?? "Bulk upload failed.");
        return;
      }
      setUploadStatus(`${body.insertedCount ?? 0} items loaded. ${body.skippedCount ?? 0} skipped.`);
      onLoaded();
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  }, [contentType, jsonText, language, onLoaded, preview, skipAdminReview]);

  const canLoad = Boolean(preview && preview.validItems.length > 0);
  const invalidItems = preview?.invalidItems.slice(0, 20) ?? [];

  return (
    <section className="mt-5 rounded-3xl border border-[#eadfd5] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl">Bulk Upload</h1>
          <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#7d6b65]">
            <Database size={16} />
            Development database
          </p>
        </div>
        <label className="inline-flex min-h-[44px] items-center gap-3 rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-4 text-sm font-black text-[#2f2135]">
          <input
            type="checkbox"
            checked={skipAdminReview}
            onChange={(event) => {
              setSkipAdminReview(event.target.checked);
              clearPreview();
            }}
            className="h-5 w-5 accent-purple-700"
          />
          Skip admin review
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase text-[#7d6b65]">Content type</span>
          <select
            value={contentType}
            onChange={(event) => {
              setContentType(event.target.value as BulkUploadContentType);
              clearPreview();
            }}
            className="min-h-[52px] w-full rounded-2xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
          >
            {CONTENT_UPLOAD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase text-[#7d6b65]">Target language</span>
          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value as BulkUploadLanguage);
              clearPreview();
            }}
            className="min-h-[52px] w-full rounded-2xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
          >
            {CONTENT_UPLOAD_LANGUAGES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-black uppercase text-[#7d6b65]">JSON</span>
        <textarea
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value);
            setFileName("");
            clearPreview();
          }}
          rows={14}
          spellCheck={false}
          className="min-h-[300px] w-full rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-4 py-3 font-mono text-sm text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-[52px] cursor-pointer items-center gap-2 rounded-2xl border border-[#eadfd5] bg-white px-5 text-sm font-black text-purple-700">
          <FileJson size={18} />
          Choose JSON file
          <input type="file" accept="application/json,.json" onChange={handleFileUpload} className="sr-only" />
        </label>
        {fileName ? <span className="text-sm font-bold text-[#7d6b65]">{fileName}</span> : null}
        <button
          type="button"
          onClick={handlePreview}
          disabled={!jsonText.trim()}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-[#2f2135] px-5 text-sm font-black text-white disabled:opacity-50"
        >
          <Upload size={18} />
          Preview
        </button>
        {canLoad ? (
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={uploading}
            className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-purple-700 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            {uploading ? "Loading..." : "Load into database"}
          </button>
        ) : null}
      </div>

      {previewError ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{previewError}</p>
      ) : null}

      {uploadStatus ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{uploadStatus}</p>
      ) : null}

      {preview ? (
        <div className={`mt-5 rounded-2xl border px-4 py-3 ${
          preview.validItems.length === 0
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
        }`}>
          <p className="flex items-center gap-2 text-sm font-black text-[#2f2135]">
            {preview.invalidItems.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {previewSummary(preview)}
          </p>
          {invalidItems.length ? (
            <div className="mt-3 grid gap-2">
              {invalidItems.map((item) => (
                <p key={`${item.index}-${item.reason}`} className="rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-[#7c2d12]">
                  Item {item.index + 1}: {item.reason}
                </p>
              ))}
              {preview.invalidItems.length > invalidItems.length ? (
                <p className="text-xs font-bold text-[#7d6b65]">
                  {preview.invalidItems.length - invalidItems.length} more validation errors hidden.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function CuriousMindsReviewPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activePanel, setActivePanel] = useState<AdminPanel>("review");
  const [mode, setMode] = useState<ReviewMode>("hooks");
  const [items, setItems] = useState<DraftRow[]>([]);
  const [draftsById, setDraftsById] = useState<Record<string, Record<string, string>>>({});
  const [checksById, setChecksById] = useState<Record<string, Record<string, boolean>>>({});
  const [reviewQueueFilter, setReviewQueueFilter] = useState<ReviewQueueFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const config = useMemo(() => {
    if (mode === "hooks") {
      return {
        type: "hooks",
        fields: HOOK_FIELDS,
        title: t("games.curiousMinds.admin.hooksTitle", "Curiosity hooks"),
      };
    }
    if (mode === "prompts") {
      return {
        type: "prompts",
        fields: PROMPT_FIELDS,
        title: t("games.curiousMinds.admin.promptsTitle", "Divergent prompts"),
      };
    }
    return {
      type: "scent",
      fields: SCENT_FIELDS,
      title: t("games.curiousMinds.admin.scentTitle", "Scent Memory prompts"),
    };
  }, [mode, t]);

  const visibleChecklist = useMemo(() => {
    if (mode === "hooks") return [...CHECKLIST];
    if (mode === "prompts") return [...CHECKLIST, ...PROMPT_ONLY_CHECKS];
    return [...CHECKLIST, ...SCENT_ONLY_CHECKS];
  }, [mode]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");

    const response = await apiFetch(`/api/admin/curious-minds/review?type=${config.type}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload?.error ?? "Could not load Curious Minds drafts.");
      setLoading(false);
      return;
    }

    const pending = ((payload.items ?? []) as DraftRow[]).filter((item) => !item.reviewed_at);
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

  const allChecksPassed = useCallback(
    (id: string) => visibleChecklist.every((check) => checksById[id]?.[check]),
    [checksById, visibleChecklist],
  );
  const requiredFieldsComplete = useCallback(
    (item: DraftRow) => config.fields.every((field) => (draftsById[item.id]?.[field] ?? "").trim().length > 0),
    [config.fields, draftsById],
  );
  const draftWasEdited = useCallback(
    (item: DraftRow) => config.fields.some((field) => (draftsById[item.id]?.[field] ?? "") !== String(item[field] ?? "")),
    [config.fields, draftsById],
  );
  const matchesReviewQueue = useCallback((item: DraftRow, filter: ReviewQueueFilter) => {
    if (filter === "all") return true;
    if (filter === "ready") return requiredFieldsComplete(item) && allChecksPassed(item.id);
    if (filter === "needs_checks") return requiredFieldsComplete(item) && !allChecksPassed(item.id);
    if (filter === "edited") return draftWasEdited(item);
    return !requiredFieldsComplete(item);
  }, [allChecksPassed, draftWasEdited, requiredFieldsComplete]);
  const visibleItems = useMemo(
    () => items.filter((item) => matchesReviewQueue(item, reviewQueueFilter)),
    [items, matchesReviewQueue, reviewQueueFilter],
  );
  const reviewQueueCounts = useMemo<Record<ReviewQueueFilter, number>>(() => ({
    all: items.length,
    ready: items.filter((item) => matchesReviewQueue(item, "ready")).length,
    needs_checks: items.filter((item) => matchesReviewQueue(item, "needs_checks")).length,
    edited: items.filter((item) => matchesReviewQueue(item, "edited")).length,
    missing_text: items.filter((item) => matchesReviewQueue(item, "missing_text")).length,
  }), [items, matchesReviewQueue]);

  const approveItem = async (item: DraftRow) => {
    if (!allChecksPassed(item.id)) return;

    const response = await apiFetch(`/api/admin/curious-minds/review/${config.type}/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        action: "approve",
        values: draftsById[item.id] ?? {},
        reviewer: user?.email ?? user?.id ?? "admin",
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload?.error ?? "Could not approve Curious Minds draft.");
      return;
    }
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  };

  const rejectItem = async (item: DraftRow) => {
    const response = await apiFetch(`/api/admin/curious-minds/review/${config.type}/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        action: "reject",
        reviewer: user?.email ?? user?.id ?? "admin",
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload?.error ?? "Could not reject Curious Minds draft.");
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
        <AdminMenu />

        <div className="mt-5 inline-flex rounded-2xl border border-[#eadfd5] bg-white p-1 shadow-sm" role="tablist" aria-label="Content review panels">
          {[
            { value: "review" as const, label: "Review Queue" },
            { value: "bulk" as const, label: "Bulk Upload" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={activePanel === option.value}
              onClick={() => setActivePanel(option.value)}
              className={`min-h-[44px] rounded-xl px-4 text-sm font-black transition ${
                activePanel === option.value
                  ? "bg-[#2f2135] text-white"
                  : "text-[#4f4352] hover:bg-[#fbf8f5]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {activePanel === "bulk" ? (
          <BulkUploadPanel onLoaded={() => void loadItems()} />
        ) : (
          <>
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
                onClick={() => setMode("scent")}
                className={`min-h-[52px] rounded-2xl px-5 text-sm font-black ${mode === "scent" ? "bg-purple-700 text-white" : "border border-[#eadfd5] bg-white text-[#2f2135]"}`}
              >
                {t("games.curiousMinds.admin.scentTab", "Scent Memory")}
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

        {!loading && items.length > 0 ? (
          <section className="mt-5 rounded-3xl border border-[#eadfd5] bg-white p-5 shadow-sm" data-testid="curious-review-queue">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-serif text-3xl">Review queue</h2>
                <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                  Showing {visibleItems.length} of {items.length} drafts.
                </p>
              </div>
              {reviewQueueFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setReviewQueueFilter("all")}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 px-4 text-sm font-black text-purple-800"
                  data-testid="curious-review-clear-queue"
                >
                  Show all
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {REVIEW_QUEUE_FILTERS.map((queue) => {
                const active = reviewQueueFilter === queue.id;
                return (
                  <button
                    key={queue.id}
                    type="button"
                    onClick={() => setReviewQueueFilter(queue.id)}
                    className={`min-h-[92px] rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                        : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
                    }`}
                    data-testid={`curious-review-queue-${queue.id}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black">{queue.label}</span>
                      <span className="text-2xl font-black leading-none">{reviewQueueCounts[queue.id]}</span>
                    </span>
                    <span className={`mt-1 block text-xs font-bold ${active ? "text-purple-100" : "text-[#8b7a73]"}`}>{queue.description}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="mt-5 rounded-3xl border border-[#eadfd5] bg-white p-5 text-sm font-bold text-[#7d6b65]">
            {t("games.curiousMinds.admin.empty", "No pending drafts.")}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4" data-testid="curious-review-list">
          {!loading && items.length > 0 && visibleItems.length === 0 ? (
            <div className="rounded-3xl border border-[#eadfd5] bg-white p-8 text-center text-sm font-bold text-[#7d6b65]">
              No drafts match this review queue.
            </div>
          ) : visibleItems.map((item) => (
            <article key={item.id} className="rounded-3xl border border-[#eadfd5] bg-white p-5 shadow-sm" data-testid={`curious-review-card-${item.id}`}>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-black text-purple-700">{item.language}</span>
                <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-black text-[#92400E]">
                  {mode === "hooks" ? item.category : mode === "scent" ? item.category : item.prompt_type}
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
          </>
        )}
      </div>
    </main>
  );
}
