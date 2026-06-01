import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, BookOpen, CheckCircle2, Eye, Pencil, Save, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import {
  HERO_LIMITS,
  HERO_LIBRARY_TEMPLATES,
  HERO_MESSAGES,
  getHeroPeriod,
  mergeHeroMessages,
  selectHeroMessageFromCatalog,
  type HeroContentMode,
  type HeroCopy,
  type HeroCopyModes,
  type HeroCopySourceMetadata,
  type HeroLanguage,
  type HeroLibraryTemplate,
  type HeroMessageDefinition,
  type HeroMessageEventType,
  type HeroMessageSource,
  type HeroPeriod,
  type HeroReason,
  type HeroSafetyLevel,
  type HeroSurface,
  validateHeroMessageResult,
} from "@/lib/heroMessages";

type AdminSource = "built_in" | "database";

type HeroMessageAdmin = HeroMessageDefinition & {
  message_id: string;
  is_enabled: boolean;
  admin_notes?: string | null;
  updated_at?: string;
  source: AdminSource;
  copyModes: HeroCopyModes;
  copySourceMetadata: HeroCopySourceMetadata;
};

type HeroMessageRow = {
  message_id: string;
  surface: HeroSurface;
  reason: HeroReason;
  priority: number;
  cooldown_hours: number;
  periods?: string[];
  safety_levels?: string[];
  event_types?: string[];
  activity_types?: string[];
  copy?: Record<HeroLanguage, HeroCopy>;
  copy_modes?: HeroCopyModes;
  copy_source_metadata?: HeroCopySourceMetadata;
  is_enabled: boolean;
  admin_notes?: string | null;
  updated_at?: string;
};

type HeroMetricRow = {
  surface: HeroSurface;
  message_id: string;
  language: HeroLanguage;
  source: HeroMessageSource;
  event_type: HeroMessageEventType;
  count: number;
};

const LANGUAGES: HeroLanguage[] = ["es", "en", "de", "fr", "it", "pt"];
const SURFACES: HeroSurface[] = ["home", "health", "doctor", "vitals", "meds", "concierge", "brain", "activity", "companions", "social"];
const REASONS: HeroReason[] = ["safety", "scheduled_event", "continuation", "time_of_day", "evergreen"];
const PERIODS: HeroPeriod[] = ["morning", "afternoon", "evening", "night"];
const SAFETY_LEVELS: HeroSafetyLevel[] = ["normal", "medical", "urgent"];
const EVENT_TYPES = ["", "appointment", "medication", "social", "concierge"] as const;
const ACTIVITY_TYPES = ["", "health_check", "meds", "social", "concierge"] as const;
const CONTENT_MODES: Array<{ value: HeroContentMode; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "ai_generated", label: "AI generated" },
  { value: "library", label: "Library" },
];

function words(value?: string) {
  return (value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function textToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function formatDate(value?: string) {
  if (!value) return "Built-in catalog";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function sourceLabel(source: HeroMessageSource | AdminSource) {
  if (source === "database" || source === "managed") return "Managed";
  if (source === "built_in") return "Built-in";
  return "Fallback";
}

function sourceClass(source: HeroMessageSource | AdminSource) {
  if (source === "database" || source === "managed") return "bg-emerald-50 text-emerald-700";
  if (source === "built_in") return "bg-purple-50 text-purple-700";
  return "bg-amber-50 text-amber-800";
}

function modeLabel(mode: HeroContentMode) {
  return CONTENT_MODES.find((item) => item.value === mode)?.label ?? "Manual";
}

function diagnosticDate(period: HeroPeriod) {
  const date = new Date();
  const hourByPeriod: Record<HeroPeriod, number> = { morning: 9, afternoon: 14, evening: 18, night: 22 };
  date.setHours(hourByPeriod[period], 0, 0, 0);
  return date;
}

function builtInToAdmin(message: HeroMessageDefinition): HeroMessageAdmin {
  return {
    ...message,
    message_id: message.id,
    is_enabled: true,
    admin_notes: "",
    source: "built_in",
    copyModes: message.copyModes ?? {},
    copySourceMetadata: message.copySourceMetadata ?? {},
  };
}

function rowToAdmin(row: HeroMessageRow): HeroMessageAdmin {
  return {
    id: row.message_id,
    message_id: row.message_id,
    surface: row.surface,
    reason: row.reason,
    priority: row.priority,
    cooldownHours: row.cooldown_hours,
    periods: (row.periods ?? []) as HeroMessageAdmin["periods"],
    safetyLevels: (row.safety_levels ?? []) as HeroMessageAdmin["safetyLevels"],
    eventTypes: row.event_types as HeroMessageAdmin["eventTypes"],
    activityTypes: row.activity_types as HeroMessageAdmin["activityTypes"],
    copy: (row.copy ?? {}) as Record<HeroLanguage, HeroCopy>,
    is_enabled: row.is_enabled,
    admin_notes: row.admin_notes,
    updated_at: row.updated_at,
    source: "database",
    copyModes: row.copy_modes ?? {},
    copySourceMetadata: row.copy_source_metadata ?? {},
  };
}

function adminToDefinition(message: HeroMessageAdmin): HeroMessageDefinition {
  return {
    id: message.message_id,
    surface: message.surface,
    reason: message.reason,
    priority: Number(message.priority),
    cooldownHours: Number(message.cooldownHours),
    periods: message.periods,
    safetyLevels: message.safetyLevels,
    eventTypes: message.eventTypes,
    activityTypes: message.activityTypes,
    copy: message.copy,
  };
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </label>
  );
}

function LimitNote({ label, value, wordsLimit, charsLimit }: { label: string; value?: string; wordsLimit: number; charsLimit: number }) {
  const wordCount = words(value);
  const charCount = (value ?? "").length;
  const ok = wordCount <= wordsLimit && charCount <= charsLimit;
  return (
    <span className={`text-xs font-bold ${ok ? "text-emerald-700" : "text-red-700"}`}>
      {label}: {wordCount}/{wordsLimit} words, {charCount}/{charsLimit} chars
    </span>
  );
}

function copyWarnings(message: HeroMessageAdmin, language: HeroLanguage) {
  const warnings: string[] = [];
  const selectedCopy = message.copy[language];
  const copy = selectedCopy ?? message.copy.es;

  if (!selectedCopy) warnings.push(`Missing ${language.toUpperCase()} copy`);
  if (!copy?.headline?.trim()) warnings.push("Headline is required");
  if (copy?.headline?.trim().toLowerCase() === "vyva") warnings.push("Headline is too generic");
  if (copy?.headline && (words(copy.headline) > HERO_LIMITS.headlineWords || copy.headline.length > HERO_LIMITS.headlineChars)) warnings.push("Headline too long");
  if (copy?.sourceText && (words(copy.sourceText) > HERO_LIMITS.sourceWords || copy.sourceText.length > HERO_LIMITS.sourceChars)) warnings.push("Source text too long");
  if (copy?.subtitle && (words(copy.subtitle) > HERO_LIMITS.subtitleWords || copy.subtitle.length > HERO_LIMITS.subtitleChars)) warnings.push("Subtitle too long");
  if (copy?.ctaLabel && (words(copy.ctaLabel) > HERO_LIMITS.ctaWords || copy.ctaLabel.length > HERO_LIMITS.ctaChars)) warnings.push("CTA too long");
  if (message.source === "database" && message.is_enabled && copy && !validateHeroMessageResult(copy)) warnings.push("Managed message will be skipped");

  return warnings;
}

function warningPills(warnings: string[]) {
  if (!warnings.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
        <CheckCircle2 size={13} /> Valid
      </span>
    );
  }

  return warnings.slice(0, 3).map((warning) => (
    <span key={warning} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
      <AlertTriangle size={13} /> {warning}
    </span>
  ));
}

function metricCount(metrics: HeroMetricRow[], surface: HeroSurface, messageId: string, language: HeroLanguage, eventType: HeroMessageEventType) {
  return metrics
    .filter((metric) => metric.surface === surface && metric.message_id === messageId && metric.language === language && metric.event_type === eventType)
    .reduce((sum, metric) => sum + Number(metric.count ?? 0), 0);
}

function HeroPreview({ copy, source }: { copy: HeroCopy; source: HeroMessageSource | AdminSource }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b16a5] to-[#8f35d0] p-5 text-white shadow-sm" data-testid="hero-live-preview">
      <div className="flex items-center justify-between gap-3">
        <p className="font-serif text-3xl leading-none">VYVA</p>
        <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black">{sourceLabel(source)}</span>
      </div>
      <div className="mt-6 rounded-full border border-white/20 bg-white/15 px-4 py-3">
        <p className="truncate text-sm font-black uppercase tracking-[0.16em] text-emerald-200">{copy.sourceText || "Hero"}</p>
        <h3 className="mt-1 min-h-9 text-2xl font-black leading-tight" data-testid="hero-preview-headline">{copy.headline || "Untitled hero"}</h3>
      </div>
      <p className="mt-4 min-h-6 text-sm font-bold text-white/80">{copy.subtitle || "No subtitle"}</p>
      <button type="button" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 font-black text-purple-800">
        {copy.ctaLabel || "Talk"}
      </button>
    </div>
  );
}

export default function HeroMessagesAdminPage() {
  const [databaseMessages, setDatabaseMessages] = useState<HeroMessageAdmin[]>([]);
  const [drafts, setDrafts] = useState<Record<string, HeroMessageAdmin>>({});
  const [metrics, setMetrics] = useState<HeroMetricRow[]>([]);
  const [surfaceFilter, setSurfaceFilter] = useState<HeroSurface | "all">("all");
  const [language, setLanguage] = useState<HeroLanguage>("es");
  const [metricsDays, setMetricsDays] = useState(7);
  const [selectedMessageId, setSelectedMessageId] = useState<string>("");
  const [diagnosticSurface, setDiagnosticSurface] = useState<HeroSurface>("health");
  const [diagnosticLanguage, setDiagnosticLanguage] = useState<HeroLanguage>("es");
  const [diagnosticPeriod, setDiagnosticPeriod] = useState<HeroPeriod>(getHeroPeriod());
  const [diagnosticSafety, setDiagnosticSafety] = useState<HeroSafetyLevel>("normal");
  const [diagnosticEventType, setDiagnosticEventType] = useState<(typeof EVENT_TYPES)[number]>("");
  const [diagnosticActivity, setDiagnosticActivity] = useState<(typeof ACTIVITY_TYPES)[number]>("");
  const [message, setMessage] = useState("");
  const [modeBusy, setModeBusy] = useState(false);
  const editorRef = useRef<HTMLElement | null>(null);

  const allMessages = useMemo(() => {
    const merged = new Map<string, HeroMessageAdmin>();
    for (const item of HERO_MESSAGES.map(builtInToAdmin)) merged.set(item.message_id, item);
    for (const item of databaseMessages) merged.set(item.message_id, item);
    for (const [id, draft] of Object.entries(drafts)) merged.set(id, draft);
    return Array.from(merged.values()).sort((a, b) => b.priority - a.priority || a.message_id.localeCompare(b.message_id));
  }, [databaseMessages, drafts]);

  const filteredMessages = useMemo(
    () => allMessages.filter((item) => surfaceFilter === "all" || item.surface === surfaceFilter),
    [allMessages, surfaceFilter],
  );

  const selectionCatalog = useMemo(() => {
    const managed = allMessages.filter((item) => item.is_enabled && (item.source === "database" || Boolean(drafts[item.message_id])));
    return mergeHeroMessages(managed.map(adminToDefinition));
  }, [allMessages, drafts]);

  const selectedMessage = useMemo(
    () => allMessages.find((item) => item.message_id === selectedMessageId) ?? filteredMessages[0],
    [allMessages, filteredMessages, selectedMessageId],
  );

  const selectedCopy = selectedMessage?.copy[language] ?? selectedMessage?.copy.es ?? { headline: "" };
  const selectedMode: HeroContentMode = selectedMessage?.copyModes?.[language] ?? "manual";
  const selectedModeMetadata = selectedMessage?.copySourceMetadata?.[language] ?? {};
  const selectedWarnings = selectedMessage ? copyWarnings(selectedMessage, language) : [];
  const canSaveSelected = Boolean(selectedMessage && selectedCopy.headline?.trim() && validateHeroMessageResult(selectedCopy));

  const selectedLibraryTemplates = useMemo(() => {
    if (!selectedMessage) return [];
    return HERO_LIBRARY_TEMPLATES.filter((template) => {
      const copy = template.copy[language];
      return template.surface === selectedMessage.surface && copy && validateHeroMessageResult(copy);
    });
  }, [language, selectedMessage]);

  const selectedLibraryTemplateId = typeof selectedModeMetadata.templateId === "string"
    ? selectedModeMetadata.templateId
    : "";
  const selectedTemplateLabel = typeof selectedModeMetadata.templateLabel === "string"
    ? selectedModeMetadata.templateLabel
    : "";
  const selectedAiModel = typeof selectedModeMetadata.model === "string"
    ? selectedModeMetadata.model
    : "";

  const overview = useMemo(() => SURFACES.map((surface) => {
    const result = selectHeroMessageFromCatalog(surface, { language, date: new Date(), safetyLevel: "normal" }, selectionCatalog);
    const active = allMessages.find((item) => item.message_id === result.messageId);
    const activeWarnings = active ? copyWarnings(active, language) : [];
    if (result.source === "fallback") activeWarnings.push(result.fallbackReason === "invalid_selected_message" ? "Invalid managed copy caused fallback" : "No usable surface copy");
    if (result.headline.trim().toLowerCase() === "vyva") activeWarnings.push("Generic fallback headline");
    const impressions = metricCount(metrics, surface, result.messageId, language, "impression");
    const clicks = metricCount(metrics, surface, result.messageId, language, "cta_click");
    return {
      surface,
      result,
      priority: active?.priority ?? 0,
      lastEdited: result.source === "managed" ? formatDate(active?.updated_at) : sourceLabel(result.source),
      warnings: activeWarnings,
      impressions,
      clicks,
      ctr: impressions ? `${((clicks / impressions) * 100).toFixed(1)}%` : "0.0%",
    };
  }), [allMessages, language, metrics, selectionCatalog]);

  const diagnosticResult = useMemo(() => selectHeroMessageFromCatalog(diagnosticSurface, {
    language: diagnosticLanguage,
    date: diagnosticDate(diagnosticPeriod),
    safetyLevel: diagnosticSafety,
    upcomingEventType: diagnosticEventType || null,
    recentActivity: diagnosticActivity || null,
  }, selectionCatalog), [diagnosticActivity, diagnosticEventType, diagnosticLanguage, diagnosticPeriod, diagnosticSafety, diagnosticSurface, selectionCatalog]);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Admin request failed");
    return data;
  }

  async function refreshMessages() {
    const data = await api("/hero-messages");
    setDatabaseMessages((data.messages ?? []).map(rowToAdmin));
    setDrafts({});
  }

  async function refreshMetrics(days = metricsDays) {
    const data = await api(`/hero-messages/metrics?days=${days}`);
    setMetrics((data.metrics ?? []) as HeroMetricRow[]);
    if (data.warning) setMessage(data.warning);
  }

  async function refreshAll(days = metricsDays) {
    setMessage("");
    await Promise.all([refreshMessages(), refreshMetrics(days)]);
  }

  function updateMessage(messageId: string, patch: Partial<HeroMessageAdmin>) {
    const current = allMessages.find((item) => item.message_id === messageId) ?? builtInToAdmin(HERO_MESSAGES[0]);
    setDrafts((existing) => ({
      ...existing,
      [messageId]: {
        ...current,
        ...existing[messageId],
        ...patch,
        source: existing[messageId]?.source ?? current.source,
      },
    }));
  }

  function updateCopy(messageId: string, copyPatch: Partial<HeroCopy>) {
    const current = allMessages.find((item) => item.message_id === messageId);
    if (!current) return;
    const currentCopy = current.copy[language] ?? current.copy.es ?? { headline: "" };
    updateMessage(messageId, {
      copy: {
        ...current.copy,
        [language]: { ...currentCopy, ...copyPatch },
      },
    });
  }

  function updateMode(messageId: string, mode: HeroContentMode, metadata: Record<string, unknown> = {}) {
    const current = allMessages.find((item) => item.message_id === messageId);
    if (!current) return;
    updateMessage(messageId, {
      copyModes: {
        ...(current.copyModes ?? {}),
        [language]: mode,
      },
      copySourceMetadata: {
        ...(current.copySourceMetadata ?? {}),
        [language]: metadata,
      },
    });
  }

  function applyModeCopy(messageId: string, mode: HeroContentMode, copy: HeroCopy, metadata: Record<string, unknown>) {
    const current = allMessages.find((item) => item.message_id === messageId);
    if (!current) return;
    updateMessage(messageId, {
      copy: {
        ...current.copy,
        [language]: { ...copy },
      },
      copyModes: {
        ...(current.copyModes ?? {}),
        [language]: mode,
      },
      copySourceMetadata: {
        ...(current.copySourceMetadata ?? {}),
        [language]: metadata,
      },
    });
  }

  function applyLibraryTemplate(template: HeroLibraryTemplate) {
    if (!selectedMessage) return;
    const copy = template.copy[language];
    if (!copy || !validateHeroMessageResult(copy)) {
      setMessage("That library template does not pass banner limits for this language.");
      return;
    }
    applyModeCopy(selectedMessage.message_id, "library", copy, {
      templateId: template.id,
      templateLabel: template.label,
      appliedAt: new Date().toISOString(),
    });
    setMessage("Library draft applied. Save to publish it.");
  }

  async function generateAiCopy(item: HeroMessageAdmin) {
    setModeBusy(true);
    setMessage("Generating AI draft...");
    try {
      const data = await api("/hero-messages/generate-copy", {
        method: "POST",
        body: JSON.stringify({
          surface: item.surface,
          language,
          reason: item.reason,
          priority: item.priority,
          cooldown_hours: item.cooldownHours,
          periods: item.periods ?? [],
          safety_levels: item.safetyLevels ?? [],
          event_types: item.eventTypes ?? [],
          activity_types: item.activityTypes ?? [],
          current_copy: item.copy[language] ?? item.copy.es ?? {},
          admin_notes: item.admin_notes ?? "",
        }),
      });
      const copy = data.copy as HeroCopy;
      if (!copy?.headline?.trim() || !validateHeroMessageResult(copy)) {
        setMessage("AI draft came back too long. Try again or use Manual mode.");
        return;
      }
      applyModeCopy(item.message_id, "ai_generated", copy, {
        ...(data.metadata ?? {}),
        generatedAt: data.metadata?.generatedAt ?? new Date().toISOString(),
      });
      const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
      setMessage(warnings.length ? `AI draft ready with warnings: ${warnings.join(", ")}` : "AI draft ready. Save to publish it.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "AI draft generation failed.");
    } finally {
      setModeBusy(false);
    }
  }

  function changeContentMode(mode: HeroContentMode) {
    if (!selectedMessage) return;
    if (mode === "manual") {
      updateMode(selectedMessage.message_id, "manual", {});
      setMessage("Manual draft mode selected. Save to publish changes.");
      return;
    }
    if (mode === "library") {
      const template = selectedLibraryTemplates[0];
      if (!template) {
        setMessage("No approved library templates are available for this surface and language.");
        return;
      }
      applyLibraryTemplate(template);
      return;
    }
    void generateAiCopy(selectedMessage);
  }

  function createManagedDraft() {
    const surface = surfaceFilter === "all" ? "home" : surfaceFilter;
    const id = `${surface}-managed-${Date.now()}`;
    const draft: HeroMessageAdmin = {
      id,
      message_id: id,
      surface,
      reason: "evergreen",
      priority: 30,
      cooldownHours: 8,
      periods: [],
      safetyLevels: [],
      eventTypes: [],
      activityTypes: [],
      copy: {
        [language]: { sourceText: "VYVA", headline: "New message", ctaLabel: "Talk" },
      } as Record<HeroLanguage, HeroCopy>,
      is_enabled: true,
      admin_notes: "",
      source: "database",
      copyModes: { [language]: "manual" },
      copySourceMetadata: {},
    };
    setDrafts((existing) => ({ ...existing, [id]: draft }));
    setSelectedMessageId(id);
    window.setTimeout(() => editorRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 0);
  }

  function focusMessageInEditor(messageId: string, surface: HeroSurface) {
    const targetId = allMessages.some((item) => item.message_id === messageId)
      ? messageId
      : allMessages.find((item) => item.surface === surface)?.message_id ?? "";
    setSurfaceFilter(surface);
    setSelectedMessageId(targetId);
    window.setTimeout(() => editorRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 0);
  }

  async function saveMessage(item: HeroMessageAdmin) {
    const copy = item.copy[language] ?? item.copy.es;
    if (!copy?.headline?.trim()) {
      setMessage("Headline is required for the selected language.");
      return;
    }
    if (!validateHeroMessageResult(copy)) {
      setMessage("This copy is too long. Shorten the selected language before saving.");
      return;
    }

    await api("/hero-messages", {
      method: "POST",
      body: JSON.stringify({
        message_id: item.message_id,
        surface: item.surface,
        reason: item.reason,
        priority: Number(item.priority),
        cooldown_hours: Number(item.cooldownHours),
        periods: item.periods ?? [],
        safety_levels: item.safetyLevels ?? [],
        event_types: item.eventTypes ?? [],
        activity_types: item.activityTypes ?? [],
        copy: item.copy,
        copy_modes: item.copyModes ?? {},
        copy_source_metadata: item.copySourceMetadata ?? {},
        is_enabled: item.is_enabled,
        admin_notes: item.admin_notes ?? "",
      }),
    });
    await refreshAll();
    setSelectedMessageId(item.message_id);
    setMessage(`${item.message_id} saved.`);
  }

  useEffect(() => {
    refreshAll().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedMessage || !filteredMessages.some((item) => item.message_id === selectedMessage.message_id)) {
      setSelectedMessageId(filteredMessages[0]?.message_id ?? "");
    }
  }, [filteredMessages, selectedMessage]);

  useEffect(() => {
    refreshMetrics(metricsDays).catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsDays]);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Hero messages"
          subtitle="Monitor live banner copy, aggregate performance, and managed overrides across every app surface."
        >
          <button className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-3 font-bold text-white" onClick={() => refreshAll().catch((err) => setMessage(err.message))}>
            <Search size={16} /> Refresh
          </button>
          {message && <span className="rounded-xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 grid gap-3 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-purple-700"><BarChart3 size={16} /> Overview</p>
              <h2 className="mt-1 text-xl font-black">Live banner control center</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Field label="Language">
                <select className="w-32 rounded-xl border border-[#eadfd5] px-3 py-2" value={language} onChange={(event) => setLanguage(event.target.value as HeroLanguage)}>
                  {LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                </select>
              </Field>
              <Field label="Metrics window">
                <select className="w-32 rounded-xl border border-[#eadfd5] px-3 py-2" value={metricsDays} onChange={(event) => setMetricsDays(Number(event.target.value))}>
                  {[7, 14, 30, 90].map((days) => <option key={days} value={days}>{days} days</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.map((item) => (
              <article key={item.surface} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-4" data-testid={`card-hero-overview-${item.surface}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7d6b65]">{item.surface}</p>
                    <h3 className="mt-1 truncate text-lg font-black" data-testid={`hero-active-${item.surface}`}>{item.result.headline}</h3>
                    <p className="mt-1 text-sm text-[#7d6b65]">{item.result.messageId}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${sourceClass(item.result.source)}`}>{sourceLabel(item.result.source)}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-black text-purple-700 transition hover:border-purple-300 hover:bg-purple-50"
                      onClick={() => focusMessageInEditor(item.result.messageId, item.surface)}
                    >
                      <Pencil size={13} /> Edit copy
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-[#8b7a73]">Reason</p><p className="font-black">{item.result.reason}</p></div>
                  <div><p className="text-[#8b7a73]">Priority</p><p className="font-black">{item.priority}</p></div>
                  <div><p className="text-[#8b7a73]">Edited</p><p className="font-black">{item.lastEdited}</p></div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-white p-3 text-sm">
                  <div><p className="text-[#8b7a73]">Views</p><p className="font-black">{item.impressions}</p></div>
                  <div><p className="text-[#8b7a73]">Clicks</p><p className="font-black">{item.clicks}</p></div>
                  <div><p className="text-[#8b7a73]">CTR</p><p className="font-black">{item.ctr}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{warningPills(item.warnings)}</div>
              </article>
            ))}
          </div>
        </section>

        <section ref={editorRef} className="mt-5 grid scroll-mt-6 gap-4 xl:grid-cols-[1.05fr_1.6fr]">
          <aside className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-purple-700"><SlidersHorizontal size={16} /> Editor</p>
                <h2 className="mt-1 text-xl font-black">Messages</h2>
              </div>
              <button type="button" className="rounded-xl border border-purple-200 px-3 py-2 text-sm font-black text-purple-700" onClick={createManagedDraft}>New</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Surface">
                <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value as HeroSurface | "all")}>
                  <option value="all">All surfaces</option>
                  {SURFACES.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
                </select>
              </Field>
              <Field label="Editing language">
                <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={language} onChange={(event) => setLanguage(event.target.value as HeroLanguage)}>
                  {LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-4 max-h-[760px] space-y-2 overflow-auto pr-1">
              {filteredMessages.map((item) => {
                const warnings = copyWarnings(item, language);
                const active = selectedMessage?.message_id === item.message_id;
                return (
                  <button
                    key={item.message_id}
                    type="button"
                    onClick={() => setSelectedMessageId(item.message_id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-purple-300 bg-purple-50" : "border-[#eadfd5] bg-[#fffaf4] hover:border-purple-200"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-black">{item.copy[language]?.headline ?? item.copy.es?.headline ?? item.message_id}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${sourceClass(item.source)}`}>{sourceLabel(item.source)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-[#7d6b65]">{item.message_id} - {item.surface} - priority {item.priority}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">{warningPills(warnings)}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            {selectedMessage ? (
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">{selectedMessage.surface}</p>
                      <h2 className="mt-1 text-xl font-black">{selectedMessage.message_id}</h2>
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-full bg-[#f7f2eb] px-3 py-2 text-sm font-black text-[#4d4351]">
                      <input type="checkbox" checked={selectedMessage.is_enabled} onChange={(event) => updateMessage(selectedMessage.message_id, { is_enabled: event.target.checked })} />
                      Enabled
                    </label>
                  </div>
                  <div className="mt-4">
                    <HeroPreview copy={selectedCopy} source={selectedMessage.source} />
                  </div>
                  <div className="mt-4 rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                    <p className="flex items-center gap-2 text-sm font-black"><Eye size={16} /> Validation</p>
                    <div className="mt-3 flex flex-wrap gap-2">{warningPills(selectedWarnings)}</div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_1.3fr]">
                      <Field label={`Content mode (${language.toUpperCase()})`}>
                        <select
                          aria-label={`Content mode (${language.toUpperCase()})`}
                          className="w-full rounded-xl border border-[#eadfd5] px-3 py-2"
                          value={selectedMode}
                          disabled={modeBusy}
                          onChange={(event) => changeContentMode(event.target.value as HeroContentMode)}
                        >
                          {CONTENT_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </Field>

                      {selectedMode === "library" ? (
                        <Field label="Library template">
                          <select
                            aria-label="Library template"
                            className="w-full rounded-xl border border-[#eadfd5] px-3 py-2"
                            value={selectedLibraryTemplateId}
                            disabled={!selectedLibraryTemplates.length || modeBusy}
                            onChange={(event) => {
                              const template = selectedLibraryTemplates.find((item) => item.id === event.target.value);
                              if (template) applyLibraryTemplate(template);
                            }}
                          >
                            <option value="">Choose template</option>
                            {selectedLibraryTemplates.map((template) => (
                              <option key={template.id} value={template.id}>{template.label}</option>
                            ))}
                          </select>
                        </Field>
                      ) : selectedMode === "ai_generated" ? (
                        <div className="flex items-end">
                          <button
                            type="button"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2.5 font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#8b7a73]"
                            disabled={modeBusy}
                            onClick={() => generateAiCopy(selectedMessage)}
                          >
                            <Sparkles size={16} /> {modeBusy ? "Generating" : "Regenerate AI copy"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-end">
                          <span className="inline-flex w-full items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#7d6b65]">
                            <Pencil size={16} /> Direct copy editing
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#7d6b65]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1">
                        {selectedMode === "library" ? <BookOpen size={13} /> : selectedMode === "ai_generated" ? <Sparkles size={13} /> : <Pencil size={13} />}
                        {modeLabel(selectedMode)}
                      </span>
                      {selectedMode === "library" && selectedTemplateLabel && <span className="rounded-full bg-white px-3 py-1">Template: {selectedTemplateLabel}</span>}
                      {selectedMode === "ai_generated" && selectedAiModel && <span className="rounded-full bg-white px-3 py-1">Model: {selectedAiModel}</span>}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <Field label="Surface">
                      <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedMessage.surface} onChange={(event) => updateMessage(selectedMessage.message_id, { surface: event.target.value as HeroSurface })}>
                        {SURFACES.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
                      </select>
                    </Field>
                    <Field label="Reason">
                      <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedMessage.reason} onChange={(event) => updateMessage(selectedMessage.message_id, { reason: event.target.value as HeroReason })}>
                        {REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                    </Field>
                    <Field label="Priority">
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" type="number" value={selectedMessage.priority} onChange={(event) => updateMessage(selectedMessage.message_id, { priority: Number(event.target.value) })} />
                    </Field>
                    <Field label="Cooldown">
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" type="number" value={selectedMessage.cooldownHours} onChange={(event) => updateMessage(selectedMessage.message_id, { cooldownHours: Number(event.target.value) })} />
                    </Field>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <Field label="Periods" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={listToText(selectedMessage.periods)} onChange={(event) => updateMessage(selectedMessage.message_id, { periods: textToList(event.target.value) as HeroMessageAdmin["periods"] })} placeholder="morning, evening" />
                    </Field>
                    <Field label="Safety" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={listToText(selectedMessage.safetyLevels)} onChange={(event) => updateMessage(selectedMessage.message_id, { safetyLevels: textToList(event.target.value) as HeroMessageAdmin["safetyLevels"] })} placeholder="urgent" />
                    </Field>
                    <Field label="Events" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={listToText(selectedMessage.eventTypes)} onChange={(event) => updateMessage(selectedMessage.message_id, { eventTypes: textToList(event.target.value) as HeroMessageAdmin["eventTypes"] })} placeholder="appointment" />
                    </Field>
                    <Field label="Activity" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={listToText(selectedMessage.activityTypes)} onChange={(event) => updateMessage(selectedMessage.message_id, { activityTypes: textToList(event.target.value) as HeroMessageAdmin["activityTypes"] })} placeholder="health_check" />
                    </Field>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label={`Headline (${language.toUpperCase()})`}>
                      <input aria-label={`Headline (${language.toUpperCase()})`} className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedCopy.headline ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { headline: event.target.value })} />
                      <LimitNote label="Headline" value={selectedCopy.headline} wordsLimit={HERO_LIMITS.headlineWords} charsLimit={HERO_LIMITS.headlineChars} />
                    </Field>
                    <Field label="Headline with name" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedCopy.headlineWithName ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { headlineWithName: event.target.value })} placeholder="Good morning, {name}" />
                    </Field>
                    <Field label="Source text" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedCopy.sourceText ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { sourceText: event.target.value })} />
                      <LimitNote label="Source" value={selectedCopy.sourceText} wordsLimit={HERO_LIMITS.sourceWords} charsLimit={HERO_LIMITS.sourceChars} />
                    </Field>
                    <Field label="CTA label" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedCopy.ctaLabel ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { ctaLabel: event.target.value })} />
                      <LimitNote label="CTA" value={selectedCopy.ctaLabel} wordsLimit={HERO_LIMITS.ctaWords} charsLimit={HERO_LIMITS.ctaChars} />
                    </Field>
                    <Field label="Subtitle" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedCopy.subtitle ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { subtitle: event.target.value })} />
                      <LimitNote label="Subtitle" value={selectedCopy.subtitle} wordsLimit={HERO_LIMITS.subtitleWords} charsLimit={HERO_LIMITS.subtitleChars} />
                    </Field>
                    <Field label="Context hint" optional>
                      <input className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedCopy.contextHint ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { contextHint: event.target.value })} />
                    </Field>
                  </div>

                  <Field label="Admin notes" optional>
                    <textarea className="min-h-20 w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={selectedMessage.admin_notes ?? ""} onChange={(event) => updateMessage(selectedMessage.message_id, { admin_notes: event.target.value })} />
                  </Field>

                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                    disabled={!canSaveSelected}
                    onClick={() => saveMessage(selectedMessage).catch((err) => setMessage(err.message))}
                  >
                    <Save size={18} /> Save hero message
                  </button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-[#fffaf4] p-4 font-bold text-[#7d6b65]">No messages match this filter.</p>
            )}
          </section>
        </section>

        <section className="mt-5 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Selection diagnostics</p>
              <h2 className="mt-1 text-xl font-black">Simulated winner</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-black ${sourceClass(diagnosticResult.source)}`}>{sourceLabel(diagnosticResult.source)}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <Field label="Surface">
              <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticSurface} onChange={(event) => setDiagnosticSurface(event.target.value as HeroSurface)}>
                {SURFACES.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
              </select>
            </Field>
            <Field label="Language">
              <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticLanguage} onChange={(event) => setDiagnosticLanguage(event.target.value as HeroLanguage)}>
                {LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label="Period">
              <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticPeriod} onChange={(event) => setDiagnosticPeriod(event.target.value as HeroPeriod)}>
                {PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}
              </select>
            </Field>
            <Field label="Safety">
              <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticSafety} onChange={(event) => setDiagnosticSafety(event.target.value as HeroSafetyLevel)}>
                {SAFETY_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </Field>
            <Field label="Event">
              <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticEventType} onChange={(event) => setDiagnosticEventType(event.target.value as (typeof EVENT_TYPES)[number])}>
                {EVENT_TYPES.map((eventType) => <option key={eventType || "none"} value={eventType}>{eventType || "none"}</option>)}
              </select>
            </Field>
            <Field label="Recent activity">
              <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticActivity} onChange={(event) => setDiagnosticActivity(event.target.value as (typeof ACTIVITY_TYPES)[number])}>
                {ACTIVITY_TYPES.map((activity) => <option key={activity || "none"} value={activity}>{activity || "none"}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4 grid gap-3 rounded-xl bg-[#fffaf4] p-4 md:grid-cols-5" data-testid="hero-diagnostics-winner">
            <div className="md:col-span-2">
              <p className="text-sm text-[#8b7a73]">Active copy</p>
              <p className="text-xl font-black">{diagnosticResult.headline}</p>
              <p className="mt-1 text-sm text-[#7d6b65]">{diagnosticResult.messageId}</p>
            </div>
            <div><p className="text-sm text-[#8b7a73]">Reason</p><p className="font-black">{diagnosticResult.reason}</p></div>
            <div><p className="text-sm text-[#8b7a73]">Language</p><p className="font-black">{diagnosticResult.language.toUpperCase()}</p></div>
            <div><p className="text-sm text-[#8b7a73]">Fallback</p><p className="font-black">{diagnosticResult.fallbackReason ?? "No"}</p></div>
          </div>
        </section>
      </section>
    </main>
  );
}
