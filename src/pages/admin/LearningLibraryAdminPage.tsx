import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Archive, CheckCircle2, Download, FilePlus2, Loader2, Save, Search, Upload } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";

type Category = {
  slug: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

type LessonStatus = "draft" | "review" | "published" | "archived";
type LessonDifficulty = "easy" | "medium" | "deep";

type Lesson = {
  id: string;
  externalId: string | null;
  categorySlug: string;
  language: string;
  title: string;
  hook: string;
  body: string;
  reflectionPrompt: string;
  sourceNotes: string | null;
  estimatedMinutes: number;
  difficulty: LessonDifficulty;
  tags: string[];
  status: LessonStatus;
  isActive: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  updatedAt: string | null;
};

type LessonDraft = Omit<Lesson, "id" | "reviewedAt" | "reviewedBy" | "publishedAt" | "publishedBy" | "archivedAt" | "archivedBy" | "updatedAt"> & {
  id?: string;
  tagsText: string;
};

const emptyLesson = (categorySlug = "general_knowledge"): LessonDraft => ({
  externalId: null,
  categorySlug,
  language: "en",
  title: "",
  hook: "",
  body: "",
  reflectionPrompt: "",
  sourceNotes: "",
  estimatedMinutes: 3,
  difficulty: "easy",
  tags: [],
  tagsText: "",
  status: "draft",
  isActive: false,
});

function lessonToDraft(lesson: Lesson): LessonDraft {
  return {
    ...lesson,
    sourceNotes: lesson.sourceNotes ?? "",
    tagsText: lesson.tags.join(", "),
  };
}

function draftToPayload(draft: LessonDraft) {
  return {
    externalId: draft.externalId || null,
    categorySlug: draft.categorySlug,
    language: draft.language,
    title: draft.title,
    hook: draft.hook,
    body: draft.body,
    reflectionPrompt: draft.reflectionPrompt,
    sourceNotes: draft.sourceNotes || null,
    estimatedMinutes: Number(draft.estimatedMinutes),
    difficulty: draft.difficulty,
    tags: draft.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    status: draft.status,
    isActive: draft.status === "published" ? true : draft.isActive,
  };
}

function statusClass(status: LessonStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  if (status === "review") return "bg-sky-50 text-sky-700";
  return "bg-amber-50 text-amber-800";
}

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-[#4d4351]">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-[#E5D8CA] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const textareaClass = "min-h-[92px] w-full rounded-xl border border-[#E5D8CA] bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";

const defaultTemplateCategories = [
  {
    slug: "science",
    label: "Science",
    description: "Short discoveries about the world and how it works.",
    color: "#2563EB",
    icon: "atom",
    sort_order: 10,
    is_active: true,
  },
  {
    slug: "language",
    label: "Language",
    description: "Words, meanings, memory, and communication.",
    color: "#7C3AED",
    icon: "languages",
    sort_order: 20,
    is_active: true,
  },
  {
    slug: "arts",
    label: "Arts",
    description: "Painting, design, craft, and creative observation.",
    color: "#DB2777",
    icon: "palette",
    sort_order: 30,
    is_active: true,
  },
  {
    slug: "general_knowledge",
    label: "General Knowledge",
    description: "Useful everyday facts and gentle trivia.",
    color: "#B45309",
    icon: "sparkles",
    sort_order: 40,
    is_active: true,
  },
  {
    slug: "music",
    label: "Music",
    description: "Songs, rhythm, instruments, and listening.",
    color: "#0F766E",
    icon: "music",
    sort_order: 50,
    is_active: true,
  },
  {
    slug: "history",
    label: "History",
    description: "Human stories, objects, places, and time.",
    color: "#92400E",
    icon: "landmark",
    sort_order: 60,
    is_active: true,
  },
  {
    slug: "nature",
    label: "Nature",
    description: "Plants, animals, seasons, and habitats.",
    color: "#0A7C4E",
    icon: "leaf",
    sort_order: 70,
    is_active: true,
  },
  {
    slug: "technology",
    label: "Technology",
    description: "Simple explanations of modern tools.",
    color: "#475569",
    icon: "cpu",
    sort_order: 80,
    is_active: true,
  },
];

function buildLearningContentTemplate(categories: Category[]) {
  const templateCategories = categories.length > 0
    ? categories.map((category) => ({
      slug: category.slug,
      label: category.label,
      description: category.description,
      color: category.color,
      icon: category.icon,
      sort_order: category.sortOrder,
      is_active: category.isActive,
    }))
    : defaultTemplateCategories;
  const sampleCategory = templateCategories.find((category) => category.is_active) ?? templateCategories[0] ?? defaultTemplateCategories[3];

  return {
    schema_version: "learning_content_pack_v1",
    categories: templateCategories,
    lessons: [
      {
        external_id: `${sampleCategory.slug}-lesson-001`,
        category_slug: sampleCategory.slug,
        language: "en",
        title: "Replace with a clear lesson title",
        hook: "Open with one inviting sentence that makes the topic feel worth learning.",
        body: "Write a short, warm learning snippet. Keep it practical, accurate, and easy to finish in a few minutes.",
        reflection_prompt: "End with one gentle question that helps the learner connect the idea to memory or daily life.",
        source_notes: "Add source, citation, reviewer note, or internal provenance here.",
        estimated_minutes: 3,
        difficulty: "easy",
        tags: ["starter", sampleCategory.slug],
        status: "draft",
        is_active: false,
      },
    ],
  };
}

function parseLearningContentPackText(text: string) {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch (error) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    }
    throw error;
  }
}

function responseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as Record<string, unknown>;
  const primary =
    typeof body.error === "string" && body.error.trim()
      ? body.error.trim()
      : typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : fallback;
  const details = [
    ...(Array.isArray(body.details)
      ? body.details.map((detail) => typeof detail === "string" ? detail.trim() : "").filter(Boolean)
      : typeof body.details === "string" && body.details.trim()
        ? [body.details.trim()]
        : []),
    ...(typeof body.detail === "string" && body.detail.trim() ? [body.detail.trim()] : []),
  ].filter((detail, index, all) => detail !== primary && all.indexOf(detail) === index);

  return [primary, ...details].join(" ");
}

export default function LearningLibraryAdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<LessonDraft>(emptyLesson());
  const [statusFilter, setStatusFilter] = useState<LessonStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [editorMessage, setEditorMessage] = useState("");

  const selectedLesson = useMemo(() => lessons.find((lesson) => lesson.id === selectedId) ?? null, [lessons, selectedId]);

  const lessonQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", statusFilter);
    params.set("category", categoryFilter);
    params.set("language", languageFilter);
    if (search.trim()) params.set("search", search.trim());
    return `/api/admin/learning/lessons?${params.toString()}`;
  }, [categoryFilter, languageFilter, search, statusFilter]);

  async function loadData(options: { clearMessage?: boolean } = {}) {
    setLoading(true);
    if (options.clearMessage !== false) setMessage("");
    try {
      const [categoriesResponse, lessonsResponse] = await Promise.all([
        apiFetch("/api/admin/learning/categories"),
        apiFetch(lessonQuery),
      ]);
      const [categoriesPayload, lessonsPayload] = await Promise.all([
        categoriesResponse.json().catch(() => ({})),
        lessonsResponse.json().catch(() => ({})),
      ]);
      if (!categoriesResponse.ok) throw new Error(responseErrorMessage(categoriesPayload, "Could not load categories."));
      if (!lessonsResponse.ok) throw new Error(responseErrorMessage(lessonsPayload, "Could not load lessons."));
      const nextCategories = (categoriesPayload.categories ?? []) as Category[];
      const nextLessons = (lessonsPayload.lessons ?? []) as Lesson[];
      setCategories(nextCategories);
      setLessons(nextLessons);
      const selectedLessonIsVisible = selectedId ? nextLessons.some((lesson) => lesson.id === selectedId) : false;
      if ((!selectedId || !selectedLessonIsVisible) && nextLessons[0]) {
        setSelectedId(nextLessons[0].id);
        setDraft(lessonToDraft(nextLessons[0]));
      } else if ((!selectedId || !selectedLessonIsVisible) && !nextLessons[0]) {
        setSelectedId("");
        setDraft(emptyLesson(nextCategories[0]?.slug ?? "general_knowledge"));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Learning library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonQuery]);

  useEffect(() => {
    if (selectedLesson) setDraft(lessonToDraft(selectedLesson));
  }, [selectedLesson]);

  async function saveLesson(nextStatus?: LessonStatus) {
    const nextDraft = nextStatus ? { ...draft, status: nextStatus, isActive: nextStatus === "published" } : draft;
    setSaving(true);
    setMessage("");
    setEditorMessage("");
    try {
      const response = await apiFetch(nextDraft.id ? `/api/admin/learning/lessons/${nextDraft.id}` : "/api/admin/learning/lessons", {
        method: nextDraft.id ? "PATCH" : "POST",
        body: JSON.stringify(draftToPayload(nextDraft)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseErrorMessage(payload, "Lesson could not be saved."));
      const saved = payload.lesson as Lesson;
      setLessons((current) => {
        const exists = current.some((lesson) => lesson.id === saved.id);
        return exists ? current.map((lesson) => lesson.id === saved.id ? saved : lesson) : [saved, ...current];
      });
      setSelectedId(saved.id);
      setDraft(lessonToDraft(saved));
      const nextMessage = nextStatus === "published" ? "Lesson published." : nextStatus === "archived" ? "Lesson archived." : "Lesson saved.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Lesson could not be saved.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  async function quickAction(action: "publish" | "archive") {
    if (!draft.id) {
      await saveLesson(action === "publish" ? "published" : "archived");
      return;
    }

    setSaving(true);
    setMessage("");
    setEditorMessage("");
    try {
      const response = await apiFetch(`/api/admin/learning/lessons/${draft.id}/${action}`, { method: "PATCH" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseErrorMessage(payload, `Lesson could not be ${action}ed.`));
      const saved = payload.lesson as Lesson;
      setLessons((current) => current.map((lesson) => lesson.id === saved.id ? saved : lesson));
      setSelectedId(saved.id);
      setDraft(lessonToDraft(saved));
      const nextMessage = action === "publish" ? "Lesson published." : "Lesson archived.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
      void loadData({ clearMessage: false });
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Lesson could not be updated.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  const startNewLesson = () => {
    setSelectedId("");
    setDraft(emptyLesson(categories[0]?.slug ?? "general_knowledge"));
    setEditorMessage("");
  };

  async function bulkPublishDrafts() {
    setBulkPublishing(true);
    setMessage("");
    setEditorMessage("");
    try {
      const response = await apiFetch("/api/admin/learning/lessons/bulk-publish", { method: "PATCH" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseErrorMessage(payload, "Lessons could not be published."));
      await loadData({ clearMessage: false });
      const count = payload.summary?.lessonsPublished ?? 0;
      const nextMessage = count === 1 ? "Published 1 draft lesson." : `Published ${count} draft lessons.`;
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Lessons could not be published.";
      setMessage(nextMessage);
      setEditorMessage(nextMessage);
    } finally {
      setBulkPublishing(false);
    }
  }

  async function importContentPack(file: File | null | undefined) {
    if (!file) return;
    setImporting(true);
    setMessage("");
    setEditorMessage("");
    try {
      const text = await file.text();
      const pack = parseLearningContentPackText(text);
      const response = await apiFetch("/api/admin/learning/import", {
        method: "POST",
        body: JSON.stringify(pack),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseErrorMessage(payload, "Content pack could not be imported."));
      }
      const summary = payload.summary ?? {};
      setSelectedId("");
      await loadData();
      setMessage(`Import complete. Categories: ${summary.categoriesCreated ?? 0} new, ${summary.categoriesUpdated ?? 0} updated. Lessons: ${summary.lessonsCreated ?? 0} new, ${summary.lessonsUpdated ?? 0} updated.`);
    } catch (error) {
      setMessage(error instanceof SyntaxError ? "Content pack must be valid JSON. Download the template, paste lesson content into it, then upload again." : error instanceof Error ? error.message : "Content pack could not be imported.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(buildLearningContentTemplate(categories), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "learning-library-template.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("Learning library template download started.");
    setEditorMessage("");
  }

  return (
    <main className="min-h-screen bg-[#F7F2EB] px-5 py-6 text-[#2f2135]">
      <div className="mx-auto w-full max-w-7xl">
        <AdminPageHeader
          title="Learning library"
          subtitle="Create, review, publish, and archive curated lessons for Learn Something New."
        >
          <div className="flex flex-wrap gap-2">
            <input
              id="learning-content-pack-upload"
              type="file"
              accept="application/json,text/plain,.json,.txt"
              className="sr-only"
              disabled={importing}
              onChange={(event) => {
                void importContentPack(event.target.files?.[0]);
                event.target.value = "";
              }}
              data-testid="input-admin-learning-import"
            />
            <label
              htmlFor="learning-content-pack-upload"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 py-2 text-sm font-bold text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
            >
              {importing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              Upload JSON/TXT
            </label>
            <button
              type="button"
              onClick={startNewLesson}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-purple-800"
              data-testid="button-admin-learning-create"
            >
              <FilePlus2 size={16} />
              Create lesson
            </button>
            <button
              type="button"
              disabled={bulkPublishing || saving || importing}
              onClick={() => void bulkPublishDrafts()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              data-testid="button-admin-learning-bulk-publish"
            >
              {bulkPublishing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Publish all drafts
            </button>
          </div>
        </AdminPageHeader>
        <AdminMenu />

        <section className="mt-4 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm" aria-labelledby="learning-template-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Content template</p>
              <h2 id="learning-template-title" className="mt-1 text-lg font-black text-[#2f2135]">Learning library JSON</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-[#7d6b65]">
                Download a ready-to-fill file with the current categories, one sample lesson, and every field needed for bulk upload. Upload accepts .json files or plain .txt files containing JSON.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2f2135] px-4 text-sm font-black text-white transition hover:bg-purple-800"
              data-testid="button-admin-learning-template"
            >
              <Download size={16} />
              Download template
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-[#7d6b65]">
            <span className="rounded-full bg-[#FBF8F5] px-3 py-1">{categories.length || defaultTemplateCategories.length} categories</span>
            <span className="rounded-full bg-[#FBF8F5] px-3 py-1">JSON upload format</span>
            <span className="rounded-full bg-[#FBF8F5] px-3 py-1">Add categories by slug</span>
          </div>
        </section>

        {message ? (
          <p className="mt-4 rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 text-sm font-bold text-[#5b4a46]" data-testid="admin-learning-message">
            {message}
          </p>
        ) : null}

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_160px]">
              <label className="relative block">
                <Search className="absolute left-3 top-3 text-[#8b7a73]" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search lessons"
                  className={`${inputClass} pl-9`}
                  data-testid="input-admin-learning-search"
                />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LessonStatus | "all")} className={inputClass}>
                <option value="all">All status</option>
                <option value="draft">Drafts</option>
                <option value="review">In review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass}>
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
              </select>
              <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} className={inputClass}>
                <option value="all">All languages</option>
                {["en", "es", "fr", "de", "it", "pt"].map((language) => <option key={language} value={language}>{language.toUpperCase()}</option>)}
              </select>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadfd5]">
              <div className="grid grid-cols-[1fr_130px_100px_90px] bg-[#FBF8F5] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#7d6b65]">
                <span>Lessons</span>
                <span>Category</span>
                <span>Status</span>
                <span>Updated</span>
              </div>

              {loading ? (
                <div className="flex min-h-48 items-center justify-center text-sm font-black text-purple-700">
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  Loading lessons
                </div>
              ) : lessons.length === 0 ? (
                <div className="min-h-48 px-4 py-10 text-center text-sm font-bold text-[#7d6b65]">
                  No lessons match these filters.
                </div>
              ) : lessons.map((lesson) => {
                const category = categories.find((candidate) => candidate.slug === lesson.categorySlug);
                const active = lesson.id === draft.id;
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelectedId(lesson.id)}
                    className={`grid min-h-[82px] w-full grid-cols-[1fr_130px_100px_90px] items-center gap-3 border-t border-[#eadfd5] px-4 py-3 text-left transition ${active ? "bg-[#F5F3FF]" : "bg-white hover:bg-[#FFFCF8]"}`}
                    data-testid={`button-admin-learning-lesson-${lesson.id}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-black text-[#2f2135]">{lesson.title}</span>
                      <span className="mt-1 block truncate text-xs font-semibold text-[#7d6b65]">{lesson.hook}</span>
                    </span>
                    <span className="truncate text-sm font-bold text-[#5b4a46]">{category?.label ?? lesson.categorySlug}</span>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${statusClass(lesson.status)}`}>{lesson.status}</span>
                    <span className="text-xs font-bold text-[#7d6b65]">{formatDate(lesson.updatedAt)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Lesson editor</p>
                <h2 className="mt-1 font-serif text-3xl">{draft.id ? "Edit lesson" : "Create lesson"}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(draft.status)}`}>{draft.status}</span>
            </div>

            <div className="mt-4 grid gap-3">
              <Field label="Title">
                <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={inputClass} data-testid="input-admin-learning-title" />
              </Field>
              <Field label="External ID">
                <input
                  value={draft.externalId ?? ""}
                  onChange={(event) => setDraft({ ...draft, externalId: event.target.value || null })}
                  placeholder="science-soap-001"
                  className={inputClass}
                  data-testid="input-admin-learning-external-id"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Category">
                  <select value={draft.categorySlug} onChange={(event) => setDraft({ ...draft, categorySlug: event.target.value })} className={inputClass}>
                    {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
                  </select>
                </Field>
                <Field label="Language">
                  <select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })} className={inputClass}>
                    {["en", "es", "fr", "de", "it", "pt"].map((language) => <option key={language} value={language}>{language.toUpperCase()}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Hook">
                <textarea value={draft.hook} onChange={(event) => setDraft({ ...draft, hook: event.target.value })} className={textareaClass} data-testid="textarea-admin-learning-hook" />
              </Field>
              <Field label="Body / snippet">
                <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} className={`${textareaClass} min-h-[150px]`} data-testid="textarea-admin-learning-body" />
              </Field>
              <Field label="Reflection prompt">
                <textarea value={draft.reflectionPrompt} onChange={(event) => setDraft({ ...draft, reflectionPrompt: event.target.value })} className={textareaClass} data-testid="textarea-admin-learning-reflection" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Estimated minutes">
                  <input type="number" min={1} max={15} value={draft.estimatedMinutes} onChange={(event) => setDraft({ ...draft, estimatedMinutes: Number(event.target.value) })} className={inputClass} />
                </Field>
                <Field label="Difficulty">
                  <select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as LessonDifficulty })} className={inputClass}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="deep">Deep</option>
                  </select>
                </Field>
              </div>
              <Field label="Tags">
                <input value={draft.tagsText} onChange={(event) => setDraft({ ...draft, tagsText: event.target.value })} placeholder="music, memory, listening" className={inputClass} />
              </Field>
              <Field label="Source notes">
                <textarea value={draft.sourceNotes ?? ""} onChange={(event) => setDraft({ ...draft, sourceNotes: event.target.value })} className={textareaClass} />
              </Field>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {editorMessage ? (
                <p
                  className="rounded-xl border border-[#eadfd5] bg-[#FFFCF8] px-3 py-2 text-sm font-black text-[#5b4a46] sm:col-span-3"
                  role="status"
                  data-testid="admin-learning-editor-message"
                >
                  {editorMessage}
                </p>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveLesson()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-[#FFFCF8] px-3 text-sm font-black text-[#5b4a46] disabled:opacity-60"
                data-testid="button-admin-learning-save"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void quickAction("publish")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white disabled:opacity-60"
                data-testid="button-admin-learning-publish"
              >
                <CheckCircle2 size={16} />
                Publish
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void quickAction("archive")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-700 px-3 text-sm font-black text-white disabled:opacity-60"
                data-testid="button-admin-learning-archive"
              >
                <Archive size={16} />
                Archive
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
