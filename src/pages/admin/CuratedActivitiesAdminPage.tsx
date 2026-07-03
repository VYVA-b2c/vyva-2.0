import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bot, CheckCircle2, ChevronDown, ChevronUp, CircleDollarSign, Clock3, Download, ExternalLink, Globe2, MapPin, Plus, RefreshCw, Save, Search, ShieldCheck, Tags, Trash2, Upload } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { PHONE_COUNTRY_OPTIONS } from "@/lib/profileIdentity";
import { apiFetch } from "@/lib/queryClient";
import type {
  AdminParticipationEvent,
  ParticipationEventFormat,
  ParticipationHelperAction,
} from "@/social/types";

type EventStatus = "active" | "draft" | "hidden" | "archived";
type SafetyStatus = "approved" | "needs_review" | "hidden";
type DiscoveryFormatPreference = ParticipationEventFormat | "any";
type DiscoveryCandidate = AdminParticipationEvent & { previewId: string; selected: boolean };
type EventSaveFeedback = {
  tone: "green" | "rose";
  message: string;
};
type DiscoveryFormState = {
  city: string;
  countryCode: string;
  interestTags: string[];
  customInterest: string;
  languageCodes: string[];
  format: DiscoveryFormatPreference;
  refinementTags: string[];
  maxResults: number;
};
type ActivityRecord = Record<string, unknown>;

type AdminParticipationActivity = {
  responses?: ActivityRecord[];
  checks?: ActivityRecord[];
  notifications?: ActivityRecord[];
};

type Filters = {
  search: string;
  city: string;
  country: string;
  language: string;
  status: string;
  format: string;
  safety: string;
};

const STATUS_OPTIONS: EventStatus[] = ["draft", "active", "hidden", "archived"];
const FORMAT_OPTIONS: ParticipationEventFormat[] = ["nearby", "online", "hybrid"];
const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  active: "Active - visible",
  hidden: "Hidden",
  archived: "Archived",
};
const FORMAT_LABELS: Record<ParticipationEventFormat, string> = {
  nearby: "In person",
  online: "Online",
  hybrid: "Hybrid",
};
const COUNTRY_LABELS: Record<string, string> = {
  AE: "United Arab Emirates",
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  IT: "Italy",
  PT: "Portugal",
  UK: "United Kingdom",
  US: "United States",
};
const DISCOVERY_COUNTRY_OPTIONS = PHONE_COUNTRY_OPTIONS.map((option) => ({
  value: option.value,
  label: `${COUNTRY_LABELS[option.value] ?? option.value} (${option.value})`,
}));
const DISCOVERY_FORMAT_CHOICES: Array<{ value: DiscoveryFormatPreference; label: string; detail: string }> = [
  { value: "any", label: "Best match", detail: "Local, online, or hybrid" },
  { value: "nearby", label: "Nearby", detail: "In-person places" },
  { value: "online", label: "Online", detail: "Remote friendly" },
  { value: "hybrid", label: "Hybrid", detail: "Both options" },
];
const DISCOVERY_INTEREST_OPTIONS = [
  "music",
  "walking",
  "art",
  "crafts",
  "learning",
  "gardening",
  "movement",
  "reading",
  "history",
  "language",
  "cooking",
  "social",
];
const DISCOVERY_REFINEMENT_OPTIONS = [
  "free",
  "low cost",
  "indoor",
  "outdoor",
  "wheelchair friendly",
  "step-free",
  "seated",
  "gentle pace",
  "small group",
  "morning",
  "public transport",
  "accessible toilets",
];
const DISCOVERY_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
];
const SAFETY_OPTIONS: SafetyStatus[] = ["approved", "needs_review", "hidden"];
const SAFETY_LABELS: Record<SafetyStatus, string> = {
  approved: "Approved",
  needs_review: "Needs review",
  hidden: "Hidden",
};
const LANGUAGE_OPTIONS = ["en", "es", "de"];
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
};
const HELPER_ACTION_OPTIONS: ParticipationHelperAction[] = ["check_details", "transport", "reminder", "bring_friend"];
const ACTIVITY_TEMPLATE_FILE_NAME = "vyva-activities-template.csv";
const ACTIVITY_TEMPLATE_CSV = [
  [
    "eventKey",
    "title",
    "summary",
    "description",
    "city",
    "country",
    "format",
    "location",
    "time",
    "cost",
    "language",
    "interests",
    "tags",
    "accessibility",
    "actions",
    "url",
    "status",
    "safety",
    "curated",
    "conciergeCheck",
    "source",
  ],
  [
    "valencia-community-choir",
    "Community choir",
    "Gentle seated singalong for older adults",
    "Hosted by the local community centre",
    "Valencia",
    "ES",
    "nearby",
    "Community centre",
    "Wednesday morning",
    "Free",
    "en; es",
    "music; social",
    "choir; community",
    "seated; step-free",
    "check_details; reminder",
    "https://example.com",
    "draft",
    "needs_review",
    "true",
    "true",
    "admin-import",
  ],
].map((row) => row.join(",")).join("\n");
const ACTIVITY_TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(ACTIVITY_TEMPLATE_CSV)}`;

const emptyCounts = { interested: 0, maybe: 0, not_for_me: 0 };

const emptyEvent: AdminParticipationEvent = {
  id: "",
  eventKey: "",
  titleEs: "",
  titleDe: "",
  titleEn: "",
  summaryEs: "",
  summaryDe: "",
  summaryEn: "",
  descriptionEs: "",
  descriptionDe: "",
  descriptionEn: "",
  format: "nearby",
  locationLabel: "Nearby",
  city: "",
  countryCode: "ES",
  timeLabelEs: "",
  timeLabelDe: "",
  timeLabelEn: "",
  startsAt: null,
  endsAt: null,
  costLabelEs: "",
  costLabelDe: "",
  costLabelEn: "",
  languageCodes: ["en", "es", "de"],
  tags: [],
  interestTags: [],
  accessibilityTags: [],
  helperActions: ["check_details"],
  source: "admin",
  sourceUrl: null,
  status: "draft",
  isCurated: true,
  needsLiveCheck: true,
  safetyStatus: "needs_review",
  metadata: {},
  createdBy: null,
  createdAt: null,
  updatedAt: null,
  responseCounts: emptyCounts,
  checkRequestCount: 0,
};

type ImportRow = Record<string, unknown>;

function cloneEvent(event: AdminParticipationEvent) {
  return JSON.parse(JSON.stringify(event)) as AdminParticipationEvent;
}

function listToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function textToList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(value?: string | null) {
  return value?.trim() ?? "";
}

function nullableText(value?: string | null) {
  const trimmed = cleanText(value);
  return trimmed ? trimmed : null;
}

function normalizeCountry(value?: string | null) {
  const trimmed = cleanText(value).toUpperCase();
  return trimmed ? trimmed.slice(0, 2) : null;
}

function countryLabel(countryCode?: string | null) {
  const normalized = normalizeCountry(countryCode);
  if (!normalized) return "Unknown country";
  return `${COUNTRY_LABELS[normalized] ?? normalized} (${normalized})`;
}

function normalizeHelperActions(values: string[]) {
  return values.filter((value): value is ParticipationHelperAction => (
    HELPER_ACTION_OPTIONS.includes(value as ParticipationHelperAction)
  ));
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rawImportValue(row: ImportRow, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.includes(normalizeHeader(key))) return value;
  }
  return undefined;
}

function importText(row: ImportRow, aliases: string[]) {
  const value = rawImportValue(row, aliases);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function limitImportText(value: string, maxLength: number) {
  return cleanText(value).slice(0, maxLength);
}

function slugifyEventKey(value: string, fallback: string) {
  const slug = cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || fallback;
}

function parseBooleanImport(value: string, fallback: boolean) {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return fallback;
}

function importList(row: ImportRow, aliases: string[], fallback: string[] = [], maxItems = 24) {
  const value = rawImportValue(row, aliases);
  const list = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[,;|\n]/);
  const cleaned = list
    .map((item) => String(item).trim())
    .filter(Boolean);
  return (cleaned.length ? cleaned : fallback).slice(0, maxItems);
}

function importFormat(value: string): ParticipationEventFormat {
  const normalized = value.trim().toLowerCase();
  return FORMAT_OPTIONS.includes(normalized as ParticipationEventFormat)
    ? normalized as ParticipationEventFormat
    : "nearby";
}

function importStatus(value: string): EventStatus {
  const normalized = value.trim().toLowerCase();
  return STATUS_OPTIONS.includes(normalized as EventStatus) ? normalized as EventStatus : "draft";
}

function importSafetyStatus(value: string): SafetyStatus {
  const normalized = value.trim().toLowerCase();
  return SAFETY_OPTIONS.includes(normalized as SafetyStatus) ? normalized as SafetyStatus : "needs_review";
}

function importIsoDate(value: string) {
  const trimmed = cleanText(value);
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function importSourceUrl(value: string) {
  const trimmed = cleanText(value);
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function parseCsvRows(text: string): ImportRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);

  const [headers, ...bodyRows] = rows;
  if (!headers?.length) return [];
  return bodyRows
    .filter((bodyRow) => bodyRow.some(Boolean))
    .map((bodyRow) => Object.fromEntries(headers.map((header, index) => [header, bodyRow[index] ?? ""])));
}

function parseImportRows(fileName: string, text: string): ImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "events" in parsed && Array.isArray((parsed as { events?: unknown }).events)
        ? (parsed as { events: unknown[] }).events
        : parsed && typeof parsed === "object" && "activities" in parsed && Array.isArray((parsed as { activities?: unknown }).activities)
          ? (parsed as { activities: unknown[] }).activities
          : [];
    return rows.filter((item): item is ImportRow => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }
  return parseCsvRows(text);
}

function eventFromImportRow(row: ImportRow, index: number, fileName: string): AdminParticipationEvent {
  const title = importText(row, ["titleEn", "title", "name", "eventTitle", "activity"]);
  const fallbackTitle = title || `Imported activity ${index + 1}`;
  const format = importFormat(importText(row, ["format", "mode", "type"]));
  const eventKey = slugifyEventKey(
    importText(row, ["eventKey", "event_key", "key", "slug", "id"]) || fallbackTitle,
    `imported-activity-${index + 1}`,
  );
  const languages = importList(row, ["languageCodes", "language_codes", "languages", "language"], ["en", "es", "de"], 8);
  const helperActions = normalizeHelperActions(importList(
    row,
    ["helperActions", "helper_actions", "actions"],
    ["check_details"],
    4,
  ));

  return {
    ...cloneEvent(emptyEvent),
    eventKey,
    id: eventKey,
    titleEn: limitImportText(fallbackTitle, 140),
    titleEs: limitImportText(importText(row, ["titleEs", "title_es", "spanishTitle", "titulo"]) || fallbackTitle, 140),
    titleDe: limitImportText(importText(row, ["titleDe", "title_de", "germanTitle"]) || fallbackTitle, 140),
    summaryEn: limitImportText(importText(row, ["summaryEn", "summary", "shortDescription", "description"]) || "What's On activity selected by VYVA.", 260),
    summaryEs: limitImportText(importText(row, ["summaryEs", "summary_es", "resumen"]) || importText(row, ["summaryEn", "summary"]) || "Actividad seleccionada por VYVA.", 260),
    summaryDe: limitImportText(importText(row, ["summaryDe", "summary_de"]) || importText(row, ["summaryEn", "summary"]) || "Von VYVA ausgewahlte Aktivitat.", 260),
    descriptionEn: limitImportText(importText(row, ["descriptionEn", "description_en", "details", "notes"]), 600),
    descriptionEs: limitImportText(importText(row, ["descriptionEs", "description_es"]), 600),
    descriptionDe: limitImportText(importText(row, ["descriptionDe", "description_de"]), 600),
    format,
    locationLabel: limitImportText(importText(row, ["locationLabel", "location_label", "venue", "location"]) || (format === "online" ? "Online" : "Local community"), 160),
    city: nullableText(importText(row, ["city", "town", "area"])),
    countryCode: normalizeCountry(importText(row, ["countryCode", "country_code", "country"])),
    timeLabelEn: limitImportText(importText(row, ["timeLabelEn", "time", "timeLabel", "when"]) || "Time to be checked", 120),
    timeLabelEs: limitImportText(importText(row, ["timeLabelEs", "time_label_es"]) || "Hora por confirmar", 120),
    timeLabelDe: limitImportText(importText(row, ["timeLabelDe", "time_label_de"]) || "Zeit wird gepruft", 120),
    startsAt: importIsoDate(importText(row, ["startsAt", "starts_at", "start", "startDate"])),
    endsAt: importIsoDate(importText(row, ["endsAt", "ends_at", "end", "endDate"])),
    costLabelEn: limitImportText(importText(row, ["costLabelEn", "cost", "price"]) || "Free or low cost", 120),
    costLabelEs: limitImportText(importText(row, ["costLabelEs", "cost_label_es"]) || "Gratis o bajo coste", 120),
    costLabelDe: limitImportText(importText(row, ["costLabelDe", "cost_label_de"]) || "Kostenlos oder gunstig", 120),
    languageCodes: languages,
    tags: importList(row, ["tags", "categories"], [], 24),
    interestTags: importList(row, ["interestTags", "interest_tags", "interests", "hobbies"], [], 24),
    accessibilityTags: importList(row, ["accessibilityTags", "accessibility_tags", "accessibility"], [], 16),
    helperActions: helperActions.length ? helperActions : ["check_details"],
    source: limitImportText(importText(row, ["source", "provider"]) || "admin-import", 60),
    sourceUrl: importSourceUrl(importText(row, ["sourceUrl", "source_url", "url", "link"])),
    status: importStatus(importText(row, ["status", "publishStatus", "publish_status"])),
    isCurated: parseBooleanImport(importText(row, ["isCurated", "is_curated", "curated"]), true),
    needsLiveCheck: parseBooleanImport(importText(row, ["needsLiveCheck", "needs_live_check", "conciergeCheck"]), true),
    safetyStatus: importSafetyStatus(importText(row, ["safetyStatus", "safety_status", "safety"])),
    metadata: {
      importFile: fileName,
      importRow: index + 1,
    },
  };
}

function eventPayload(event: AdminParticipationEvent, includeKey: boolean) {
  const payload = {
    ...(includeKey ? { eventKey: cleanText(event.eventKey) } : {}),
    titleEs: cleanText(event.titleEs),
    titleDe: cleanText(event.titleDe),
    titleEn: cleanText(event.titleEn),
    summaryEs: cleanText(event.summaryEs),
    summaryDe: cleanText(event.summaryDe),
    summaryEn: cleanText(event.summaryEn),
    descriptionEs: cleanText(event.descriptionEs),
    descriptionDe: cleanText(event.descriptionDe),
    descriptionEn: cleanText(event.descriptionEn),
    format: event.format,
    locationLabel: cleanText(event.locationLabel) || (event.format === "online" ? "Online" : "Nearby"),
    city: nullableText(event.city),
    countryCode: normalizeCountry(event.countryCode),
    timeLabelEs: cleanText(event.timeLabelEs),
    timeLabelDe: cleanText(event.timeLabelDe),
    timeLabelEn: cleanText(event.timeLabelEn),
    startsAt: nullableText(event.startsAt),
    endsAt: nullableText(event.endsAt),
    costLabelEs: cleanText(event.costLabelEs),
    costLabelDe: cleanText(event.costLabelDe),
    costLabelEn: cleanText(event.costLabelEn),
    languageCodes: event.languageCodes.map((language) => language.trim()).filter(Boolean),
    tags: event.tags.map((tag) => tag.trim()).filter(Boolean),
    interestTags: event.interestTags.map((tag) => tag.trim()).filter(Boolean),
    accessibilityTags: event.accessibilityTags.map((tag) => tag.trim()).filter(Boolean),
    helperActions: normalizeHelperActions(event.helperActions),
    source: cleanText(event.source) || "admin",
    sourceUrl: nullableText(event.sourceUrl),
    status: event.status as EventStatus,
    isCurated: event.isCurated,
    needsLiveCheck: event.needsLiveCheck,
    safetyStatus: event.safetyStatus as SafetyStatus,
    metadata: event.metadata ?? {},
  };
  return payload;
}

function adminErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const body = data as { error?: unknown; message?: unknown };
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  if (typeof body.message === "string" && body.message.trim()) return body.message;

  if (body.error && typeof body.error === "object") {
    const error = body.error as { fieldErrors?: unknown; formErrors?: unknown };
    const messages: string[] = [];
    if (Array.isArray(error.formErrors)) {
      messages.push(...error.formErrors.map(String).filter(Boolean));
    }
    if (error.fieldErrors && typeof error.fieldErrors === "object") {
      for (const [field, fieldErrors] of Object.entries(error.fieldErrors)) {
        if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
          messages.push(`${field}: ${fieldErrors.map(String).join(", ")}`);
        }
      }
    }
    if (messages.length > 0) return messages.join(" ");
  }

  return fallback;
}

function aiDraftPayload(candidate: AdminParticipationEvent) {
  return {
    ...eventPayload({
      ...candidate,
      status: "draft",
      safetyStatus: "needs_review",
      isCurated: true,
      needsLiveCheck: true,
      source: "ai-discovery",
    }, true),
    status: "draft",
    safetyStatus: "needs_review",
    isCurated: true,
    needsLiveCheck: true,
    source: "ai-discovery",
  };
}

function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="block">
      <label className="block">
        <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
          <span>{label}</span>
        </span>
        {children}
      </label>
      {(hint || optional) && (
        <p className="mt-1 text-xs font-semibold text-[#8a7770]">
          {hint}
          {hint && optional ? " " : ""}
          {optional ? "Optional." : ""}
        </p>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      className="min-h-20 w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold leading-relaxed text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function SelectInput<T extends string>({
  value,
  onChange,
  options,
  labels,
}: {
  value: T | string;
  onChange: (value: T) => void;
  options: readonly T[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}
    </select>
  );
}

function Pill({ children, tone = "purple" }: { children: ReactNode; tone?: "purple" | "green" | "amber" | "rose" | "plain" }) {
  const tones = {
    purple: "bg-purple-50 text-purple-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    plain: "bg-[#f7f2eb] text-[#5b4a46]",
  };
  return <span className={`rounded-full px-3 py-1.5 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function ChoiceChip({
  selected,
  children,
  onClick,
  testId,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      className={`rounded-full border px-4 py-2 text-sm font-black transition ${
        selected
          ? "border-purple-500 bg-purple-100 text-purple-800 shadow-sm"
          : "border-[#eadfd5] bg-[#fffaf4] text-[#5b4a46] hover:border-purple-200 hover:text-purple-800"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function cityKey(event: AdminParticipationEvent) {
  const city = cleanText(event.city);
  const country = cleanText(event.countryCode).toUpperCase();
  return city ? `${city}${country ? `, ${country}` : ""}` : "";
}

function statusTone(status: string) {
  if (status === "active") return "green";
  if (status === "draft") return "amber";
  if (status === "hidden") return "rose";
  return "plain";
}

function safetyTone(status: string) {
  if (status === "approved") return "green";
  if (status === "needs_review") return "amber";
  return "rose";
}

function discoveryEvidence(event: AdminParticipationEvent) {
  const discovery = event.metadata?.discovery;
  if (!discovery || typeof discovery !== "object") return "";
  const evidence = (discovery as { evidence?: unknown }).evidence;
  return typeof evidence === "string" ? evidence : "";
}

export default function CuratedActivitiesAdminPage() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [events, setEvents] = useState<AdminParticipationEvent[]>([]);
  const [activity, setActivity] = useState<AdminParticipationActivity>({});
  const [draft, setDraft] = useState<AdminParticipationEvent>(cloneEvent(emptyEvent));
  const [filters, setFilters] = useState<Filters>({
    search: "",
    city: "",
    country: "",
    language: "",
    status: "",
    format: "",
    safety: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [savingDiscovery, setSavingDiscovery] = useState(false);
  const [savingEventKey, setSavingEventKey] = useState<string | null>(null);
  const [eventSaveFeedback, setEventSaveFeedback] = useState<Record<string, EventSaveFeedback>>({});
  const [discoveryCandidates, setDiscoveryCandidates] = useState<DiscoveryCandidate[]>([]);
  const [expandedDiscoveryId, setExpandedDiscoveryId] = useState<string | null>(null);
  const [discoveryForm, setDiscoveryForm] = useState<DiscoveryFormState>({
    city: "Madrid",
    countryCode: "ES",
    interestTags: ["music", "walking", "art"],
    customInterest: "",
    languageCodes: ["en", "es", "de"],
    format: "any",
    refinementTags: ["free", "indoor", "wheelchair friendly"],
    maxResults: 6,
  });

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/social/participate${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(adminErrorMessage(data, "Admin request failed"));
    return data;
  }

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const [eventData, activityData] = await Promise.all([
        api("/events"),
        api("/activity"),
      ]);
      setEvents(eventData.events ?? []);
      setActivity(activityData.activity ?? {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cityOptions = useMemo(() => (
    Array.from(new Set(events.map((event) => cleanText(event.city)).filter(Boolean))).sort()
  ), [events]);

  const countryOptions = useMemo(() => (
    Array.from(new Set(events.map((event) => cleanText(event.countryCode).toUpperCase()).filter(Boolean))).sort()
  ), [events]);

  const filteredEvents = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return events.filter((event) => {
      const haystack = [
        event.eventKey,
        event.titleEn,
        event.titleEs,
        event.titleDe,
        event.city ?? "",
        event.countryCode ?? "",
        ...event.tags,
        ...event.interestTags,
      ].join(" ").toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filters.city && cleanText(event.city).toLowerCase() !== filters.city.toLowerCase()) return false;
      if (filters.country && cleanText(event.countryCode).toUpperCase() !== filters.country.toUpperCase()) return false;
      if (filters.language && !event.languageCodes.includes(filters.language)) return false;
      if (filters.status && event.status !== filters.status) return false;
      if (filters.format && event.format !== filters.format) return false;
      if (filters.safety && event.safetyStatus !== filters.safety) return false;
      return true;
    });
  }, [events, filters]);

  const activeApproved = useMemo(() => (
    events.filter((event) => event.status === "active" && event.safetyStatus === "approved")
  ), [events]);

  const onlineFallbackCount = activeApproved.filter((event) => event.format === "online" || event.format === "hybrid").length;
  const localCityCount = new Set(activeApproved.map(cityKey).filter(Boolean)).size;
  const interestedCount = events.reduce((sum, event) => sum + event.responseCounts.interested, 0);
  const checkRequestCount = events.reduce((sum, event) => sum + event.checkRequestCount, 0);
  const selectedDiscoveryCount = discoveryCandidates.filter((candidate) => candidate.selected).length;

  const coverageRows = useMemo(() => {
    const map = new Map<string, { label: string; active: number; drafts: number; checks: number; interested: number }>();
    for (const event of events) {
      const key = cityKey(event);
      if (!key) continue;
      const current = map.get(key) ?? { label: key, active: 0, drafts: 0, checks: 0, interested: 0 };
      if (event.status === "active" && event.safetyStatus === "approved") current.active += 1;
      if (event.status === "draft") current.drafts += 1;
      current.checks += event.checkRequestCount;
      current.interested += event.responseCounts.interested;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.active - a.active || a.label.localeCompare(b.label));
  }, [events]);

  const filteredCityHasNoActiveLocal = Boolean(filters.city) && !activeApproved.some((event) => (
    cleanText(event.city).toLowerCase() === filters.city.toLowerCase()
  ));

  function updateEvent(eventKey: string, patch: Partial<AdminParticipationEvent>) {
    setEvents((current) => current.map((event) => event.eventKey === eventKey ? { ...event, ...patch } : event));
  }

  function updateDiscoveryCandidate(previewId: string, patch: Partial<DiscoveryCandidate>) {
    setDiscoveryCandidates((current) => (
      current.map((candidate) => candidate.previewId === previewId ? { ...candidate, ...patch } : candidate)
    ));
  }

  function updateDiscoveryEvidence(candidate: DiscoveryCandidate, evidence: string) {
    const discovery = candidate.metadata?.discovery;
    updateDiscoveryCandidate(candidate.previewId, {
      metadata: {
        ...(candidate.metadata ?? {}),
        discovery: {
          ...(discovery && typeof discovery === "object" ? discovery : {}),
          evidence,
        },
      },
    });
  }

  function setDiscoverySelection(selected: boolean) {
    setDiscoveryCandidates((current) => current.map((candidate) => ({ ...candidate, selected })));
  }

  function discardDiscoveryCandidate(previewId: string) {
    setDiscoveryCandidates((current) => current.filter((candidate) => candidate.previewId !== previewId));
    setExpandedDiscoveryId((current) => (current === previewId ? null : current));
  }

  function toggleDiscoveryInterest(tag: string) {
    setDiscoveryForm((prev) => ({
      ...prev,
      interestTags: prev.interestTags.includes(tag)
        ? prev.interestTags.filter((item) => item !== tag)
        : [...prev.interestTags, tag],
    }));
  }

  function addCustomDiscoveryInterest() {
    const tag = cleanText(discoveryForm.customInterest).toLowerCase();
    if (!tag) return;
    setDiscoveryForm((prev) => ({
      ...prev,
      interestTags: prev.interestTags.includes(tag) ? prev.interestTags : [...prev.interestTags, tag],
      customInterest: "",
    }));
  }

  function toggleDiscoveryLanguage(language: string) {
    setDiscoveryForm((prev) => {
      const selected = prev.languageCodes.includes(language);
      if (selected && prev.languageCodes.length === 1) return prev;
      return {
        ...prev,
        languageCodes: selected
          ? prev.languageCodes.filter((item) => item !== language)
          : [...prev.languageCodes, language],
      };
    });
  }

  function toggleDiscoveryRefinement(tag: string) {
    setDiscoveryForm((prev) => ({
      ...prev,
      refinementTags: prev.refinementTags.includes(tag)
        ? prev.refinementTags.filter((item) => item !== tag)
        : [...prev.refinementTags, tag],
    }));
  }

  async function discoverActivities() {
    setDiscovering(true);
    setMessage("");
    try {
      const body = {
        city: cleanText(discoveryForm.city),
        countryCode: normalizeCountry(discoveryForm.countryCode),
        interests: discoveryForm.interestTags,
        refinementTags: discoveryForm.refinementTags,
        languageCodes: discoveryForm.languageCodes,
        format: discoveryForm.format,
        maxResults: discoveryForm.maxResults,
      };
      const data = await api("/discover", { method: "POST", body: JSON.stringify(body) });
      const candidates = (data.candidates ?? []) as AdminParticipationEvent[];
      const rejected = Array.isArray(data.rejected) ? data.rejected.length : 0;
      setDiscoveryCandidates(candidates.map((candidate, index) => ({
        ...candidate,
        previewId: `${slugifyEventKey(candidate.eventKey, "candidate")}-${index}`,
        selected: false,
      })));
      setExpandedDiscoveryId(null);
      setMessage(rejected > 0
        ? `${candidates.length} AI candidates ready for review. Select the ones to save as drafts. ${rejected} skipped because they were missing sources or required fields.`
        : `${candidates.length} AI candidates ready for review. Select the ones to save as drafts.`);
    } finally {
      setDiscovering(false);
    }
  }

  async function saveDiscoveryDrafts() {
    const selected = discoveryCandidates.filter((candidate) => candidate.selected);
    if (selected.length === 0) {
      setMessage("Select at least one AI candidate to save as a draft.");
      return;
    }

    setSavingDiscovery(true);
    setMessage("");
    try {
      const saved: string[] = [];
      const failed: string[] = [];
      for (const candidate of selected) {
        try {
          await api("/events", { method: "POST", body: JSON.stringify(aiDraftPayload(candidate)) });
          saved.push(candidate.eventKey);
        } catch (error) {
          failed.push(`${candidate.eventKey}: ${error instanceof Error ? error.message : "Could not save"}`);
        }
      }

      setDiscoveryCandidates((current) => current.filter((candidate) => !saved.includes(candidate.eventKey)));
      await refresh();
      setMessage(failed.length > 0
        ? `${saved.length} AI drafts saved. ${failed.length} need another look.`
        : `${saved.length} AI drafts saved for review.`);
    } finally {
      setSavingDiscovery(false);
    }
  }

  async function addEvent() {
    const body = eventPayload(draft, true);
    await api("/events", { method: "POST", body: JSON.stringify(body) });
    setDraft(cloneEvent(emptyEvent));
    await refresh();
    setMessage(`${body.eventKey} added as ${body.status}.`);
  }

  async function saveEvent(event: AdminParticipationEvent) {
    const eventKey = event.eventKey;
    setSavingEventKey(eventKey);
    setMessage("");
    setEventSaveFeedback((current) => {
      const next = { ...current };
      delete next[eventKey];
      return next;
    });
    const body = eventPayload(event, false);
    try {
      await api(`/events/${eventKey}`, { method: "PATCH", body: JSON.stringify(body) });
      await refresh();
      const nextMessage = `${eventKey} saved.`;
      setMessage(nextMessage);
      setEventSaveFeedback((current) => ({
        ...current,
        [eventKey]: { tone: "green", message: nextMessage },
      }));
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Could not save event.";
      setMessage(nextMessage);
      setEventSaveFeedback((current) => ({
        ...current,
        [eventKey]: { tone: "rose", message: nextMessage },
      }));
    } finally {
      setSavingEventKey(null);
    }
  }

  async function importEvents(file: File) {
    setImporting(true);
    setMessage("");
    try {
      const rows = parseImportRows(file.name, await file.text());
      if (rows.length === 0) throw new Error("No activities found in that file.");
      if (rows.length > 100) throw new Error("Upload up to 100 activities at a time.");

      let imported = 0;
      const failed: string[] = [];

      for (const [index, row] of rows.entries()) {
        const importEvent = eventFromImportRow(row, index, file.name);
        const body = eventPayload(importEvent, true);
        try {
          await api("/events", { method: "POST", body: JSON.stringify(body) });
          imported += 1;
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Could not import";
          failed.push(`${importEvent.eventKey}: ${detail}`);
        }
      }

      const importedLabel = imported === 1 ? "1 activity imported" : `${imported} activities imported`;
      const nextMessage = failed.length > 0
        ? `${importedLabel}. ${failed.length} need review.`
        : `${importedLabel} from ${file.name}.`;
      await refresh();
      setMessage(nextMessage);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="What's On"
          subtitle="Manage city coverage, publish status, and Concierge-checked activities shown in What's On."
        >
          <input
            ref={uploadInputRef}
            data-testid="admin-participate-upload-input"
            className="sr-only"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) importEvents(file).catch((err) => setMessage(err.message));
            }}
          />
          <button
            className="inline-flex items-center gap-2 rounded-2xl border border-purple-200 bg-white px-5 py-3 font-bold text-purple-800 disabled:opacity-60"
            onClick={() => uploadInputRef.current?.click()}
            disabled={loading || importing}
            type="button"
          >
            <Upload size={16} />
            {importing ? "Uploading..." : "Upload activities"}
          </button>
          <a
            className="inline-flex items-center gap-2 rounded-2xl border border-[#eadfd5] bg-[#fffaf4] px-5 py-3 font-bold text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-800"
            href={ACTIVITY_TEMPLATE_HREF}
            download={ACTIVITY_TEMPLATE_FILE_NAME}
          >
            <Download size={16} />
            Download template
          </a>
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-60"
            onClick={() => refresh().catch((err) => setMessage(err.message))}
            disabled={loading || importing || discovering || savingDiscovery}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.5rem] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-purple-700"><ShieldCheck size={16} /> Active cities</div>
            <p className="mt-2 text-3xl font-black">{localCityCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-purple-700"><Globe2 size={16} /> Online fallback</div>
            <p className="mt-2 text-3xl font-black">{onlineFallbackCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-purple-700"><CheckCircle2 size={16} /> Interested</div>
            <p className="mt-2 text-3xl font-black">{interestedCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-purple-700"><Search size={16} /> Concierge checks</div>
            <p className="mt-2 text-3xl font-black">{checkRequestCount}</p>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-serif text-3xl"><Bot size={24} /> AI discovery</h2>
              <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
                Find public candidates for admin review. AI results stay in this preview until selected items are saved as drafts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="amber">Drafts only</Pill>
              <Pill tone="amber">Review required</Pill>
              <Pill tone="green">Sources required</Pill>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="City">
              <input
                data-testid="admin-discovery-city"
                className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold text-[#2f2135]"
                value={discoveryForm.city}
                onChange={(event) => setDiscoveryForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Madrid"
              />
            </Field>
            <Field label="Country">
              <select
                data-testid="admin-discovery-country"
                className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]"
                value={discoveryForm.countryCode}
                onChange={(event) => setDiscoveryForm((prev) => ({ ...prev, countryCode: event.target.value }))}
              >
                {DISCOVERY_COUNTRY_OPTIONS.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
              </select>
            </Field>
            <Field label="Max results">
              <input
                className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold text-[#2f2135]"
                type="number"
                min={1}
                max={12}
                value={discoveryForm.maxResults}
                onChange={(event) => setDiscoveryForm((prev) => ({ ...prev, maxResults: Number(event.target.value) || 1 }))}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <div>
              <p className="mb-2 text-sm font-bold text-[#4d4351]">Interests</p>
              <div className="flex flex-wrap gap-2">
                {DISCOVERY_INTEREST_OPTIONS.map((tag) => (
                  <ChoiceChip
                    key={tag}
                    testId={`admin-interest-${slugifyEventKey(tag, "tag")}`}
                    selected={discoveryForm.interestTags.includes(tag)}
                    onClick={() => toggleDiscoveryInterest(tag)}
                  >
                    {tag}
                  </ChoiceChip>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="min-h-[44px] flex-1 rounded-2xl border border-[#eadfd5] px-4 py-2 text-sm font-semibold text-[#2f2135]"
                  value={discoveryForm.customInterest}
                  onChange={(event) => setDiscoveryForm((prev) => ({ ...prev, customInterest: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomDiscoveryInterest();
                    }
                  }}
                  placeholder="Add another interest"
                />
                <button
                  className="min-h-[44px] rounded-2xl border border-purple-200 bg-white px-4 py-2 text-sm font-black text-purple-800"
                  onClick={addCustomDiscoveryInterest}
                  type="button"
                >
                  Add tag
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-[#4d4351]">Languages</p>
              <div className="flex flex-wrap gap-2">
                {DISCOVERY_LANGUAGE_OPTIONS.map((language) => (
                  <ChoiceChip
                    key={language.value}
                    testId={`admin-language-${language.value}`}
                    selected={discoveryForm.languageCodes.includes(language.value)}
                    onClick={() => toggleDiscoveryLanguage(language.value)}
                  >
                    {language.label}
                  </ChoiceChip>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="mb-2 text-sm font-bold text-[#4d4351]">Format</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {DISCOVERY_FORMAT_CHOICES.map((choice) => {
                  const selected = discoveryForm.format === choice.value;
                  return (
                    <button
                      key={choice.value}
                      data-testid={`admin-format-${choice.value}`}
                      type="button"
                      aria-pressed={selected}
                      className={`rounded-2xl border p-3 text-left transition ${
                        selected
                          ? "border-purple-500 bg-purple-100 text-purple-900 shadow-sm"
                          : "border-[#eadfd5] bg-[#fffaf4] text-[#5b4a46] hover:border-purple-200"
                      }`}
                      onClick={() => setDiscoveryForm((prev) => ({ ...prev, format: choice.value }))}
                    >
                      <span className="block text-sm font-black">{choice.label}</span>
                      <span className="mt-1 block text-xs font-semibold opacity-75">{choice.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-[#4d4351]">Refine results</p>
              <div className="flex flex-wrap gap-2">
                {DISCOVERY_REFINEMENT_OPTIONS.map((tag) => (
                  <ChoiceChip
                    key={tag}
                    testId={`admin-refinement-${slugifyEventKey(tag, "tag")}`}
                    selected={discoveryForm.refinementTags.includes(tag)}
                    onClick={() => toggleDiscoveryRefinement(tag)}
                  >
                    {tag}
                  </ChoiceChip>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              data-testid="admin-discovery-find"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-60"
              onClick={() => discoverActivities().catch((err) => setMessage(err.message))}
              disabled={discovering || savingDiscovery}
              type="button"
            >
              <Search size={17} />
              {discovering ? "Finding..." : "Find activities"}
            </button>
            <button
              data-testid="admin-discovery-save"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-white px-5 py-3 font-bold text-purple-800 disabled:opacity-60"
              onClick={() => saveDiscoveryDrafts().catch((err) => setMessage(err.message))}
              disabled={savingDiscovery || discovering || selectedDiscoveryCount === 0}
              type="button"
            >
              <Save size={17} />
              {savingDiscovery ? "Saving..." : `Save selected as drafts (${selectedDiscoveryCount})`}
            </button>
          </div>

          <div className="mt-4 space-y-3" data-testid="admin-discovery-preview">
            {discoveryCandidates.length === 0 ? (
              <p className="rounded-2xl bg-[#f7f2eb] p-4 text-sm font-bold text-[#7d6b65]">No AI candidates in preview yet.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f7f2eb] px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-[#2f2135]">
                      {discoveryCandidates.length} candidates found. {selectedDiscoveryCount} selected for draft save.
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#7d6b65]">Review the full shortlist, open details when needed, then save only the best matches.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-purple-800 disabled:opacity-50"
                      disabled={selectedDiscoveryCount === discoveryCandidates.length}
                      onClick={() => setDiscoverySelection(true)}
                      type="button"
                    >
                      <CheckCircle2 size={14} />
                      Select all
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#5b4a46] disabled:opacity-50"
                      disabled={selectedDiscoveryCount === 0}
                      onClick={() => setDiscoverySelection(false)}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {discoveryCandidates.map((candidate) => {
                    const expanded = expandedDiscoveryId === candidate.previewId;
                    const previewTags = Array.from(new Set([
                      ...candidate.interestTags,
                      ...candidate.accessibilityTags,
                    ])).slice(0, 6);
                    return (
                      <article
                        key={candidate.previewId}
                        data-testid={`admin-discovery-candidate-${candidate.previewId}`}
                        className={`rounded-2xl border p-4 transition ${
                          candidate.selected
                            ? "border-purple-300 bg-purple-50/60 shadow-sm"
                            : "border-[#eadfd5] bg-[#fffdf9]"
                        }`}
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                            <input
                              className="mt-1 h-4 w-4 accent-purple-700"
                              type="checkbox"
                              aria-label={`Select ${candidate.titleEn || candidate.eventKey}`}
                              checked={candidate.selected}
                              onChange={(event) => updateDiscoveryCandidate(candidate.previewId, { selected: event.target.checked })}
                            />
                            <span className="min-w-0">
                              <span className="block break-words text-lg font-black text-[#2f2135]">{candidate.titleEn || candidate.eventKey}</span>
                              <span className="mt-1 block break-words text-xs font-bold uppercase tracking-wide text-purple-700">{candidate.eventKey}</span>
                              {candidate.summaryEn && (
                                <span className="mt-2 block text-sm font-semibold leading-relaxed text-[#5b4a46]">{candidate.summaryEn}</span>
                              )}
                            </span>
                          </label>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {candidate.sourceUrl ? (
                              <a
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700"
                                href={candidate.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Source link for ${candidate.titleEn || candidate.eventKey}`}
                              >
                                <ExternalLink size={14} />
                                Source link
                              </a>
                            ) : (
                              <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">Source missing</span>
                            )}
                            <button
                              className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-purple-800"
                              onClick={() => setExpandedDiscoveryId(expanded ? null : candidate.previewId)}
                              type="button"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "Hide details" : "View details"} for ${candidate.titleEn || candidate.eventKey}`}
                            >
                              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {expanded ? "Hide details" : "View details"}
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700"
                              onClick={() => discardDiscoveryCandidate(candidate.previewId)}
                              type="button"
                              aria-label={`Discard ${candidate.titleEn || candidate.eventKey}`}
                            >
                              <Trash2 size={14} />
                              Discard
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm font-semibold text-[#5b4a46] md:grid-cols-2 xl:grid-cols-4">
                          <span className="inline-flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2">
                            <Clock3 size={14} className="shrink-0 text-purple-700" />
                            <span className="truncate">{candidate.timeLabelEn || "Time to be checked"}</span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2">
                            <MapPin size={14} className="shrink-0 text-purple-700" />
                            <span className="truncate">{candidate.locationLabel || cityKey(candidate) || "Location to be checked"}</span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2">
                            <CircleDollarSign size={14} className="shrink-0 text-purple-700" />
                            <span className="truncate">{candidate.costLabelEn || "Cost to be checked"}</span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2">
                            <Tags size={14} className="shrink-0 text-purple-700" />
                            <span className="truncate">{FORMAT_LABELS[candidate.format] ?? candidate.format}</span>
                          </span>
                        </div>

                        {previewTags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {previewTags.map((tag) => <Pill key={tag} tone="plain">{tag}</Pill>)}
                          </div>
                        )}

                        {expanded && (
                          <div className="mt-4 border-t border-[#eadfd5] pt-4" data-testid={`admin-discovery-detail-${candidate.previewId}`}>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-black text-[#2f2135]">Review and edit before saving</p>
                              <div className="flex flex-wrap gap-2">
                                <Pill tone="amber">Draft</Pill>
                                <Pill tone="amber">Needs review</Pill>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <Field label="Internal ID">
                                <TextInput value={candidate.eventKey} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { eventKey: value, id: value })} />
                              </Field>
                              <Field label="Title (English)">
                                <TextInput value={candidate.titleEn} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { titleEn: value })} />
                              </Field>
                              <Field label="City or town">
                                <TextInput value={candidate.city ?? ""} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { city: value })} />
                              </Field>
                              <Field label="Country">
                                <select
                                  className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]"
                                  value={normalizeCountry(candidate.countryCode) ?? ""}
                                  onChange={(input) => updateDiscoveryCandidate(candidate.previewId, { countryCode: input.target.value })}
                                >
                                  <option value="">No country</option>
                                  {candidate.countryCode && !DISCOVERY_COUNTRY_OPTIONS.some((country) => country.value === normalizeCountry(candidate.countryCode)) && (
                                    <option value={normalizeCountry(candidate.countryCode) ?? ""}>{countryLabel(candidate.countryCode)}</option>
                                  )}
                                  {DISCOVERY_COUNTRY_OPTIONS.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
                                </select>
                              </Field>
                              <Field label="Precise location" hint="Venue, address, meeting point, or online room name.">
                                <TextInput value={candidate.locationLabel} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { locationLabel: value })} />
                              </Field>
                              <Field label="Time (English)">
                                <TextInput value={candidate.timeLabelEn} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { timeLabelEn: value })} />
                              </Field>
                              <Field label="Cost (English)">
                                <TextInput value={candidate.costLabelEn} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { costLabelEn: value })} />
                              </Field>
                              <Field label="Interests">
                                <TextInput value={listToText(candidate.interestTags)} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { interestTags: textToList(value) })} />
                              </Field>
                              <Field label="Source link">
                                <TextInput value={candidate.sourceUrl ?? ""} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { sourceUrl: value })} />
                              </Field>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <Field label="Short description (English)">
                                <TextArea value={candidate.summaryEn} onChange={(value) => updateDiscoveryCandidate(candidate.previewId, { summaryEn: value })} />
                              </Field>
                              <Field label="Evidence">
                                <TextArea value={discoveryEvidence(candidate)} onChange={(value) => updateDiscoveryEvidence(candidate, value)} />
                              </Field>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">City coverage</h2>
              <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
                Active approved city activities are shown first; online and hybrid activities keep the experience useful when a city has no local coverage.
              </p>
            </div>
            <Pill tone={onlineFallbackCount > 0 ? "green" : "amber"}>{onlineFallbackCount > 0 ? "Online fallback available" : "No online fallback"}</Pill>
          </div>

          {filteredCityHasNoActiveLocal && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              {filters.city} has no active approved local events. Add a draft for this city or keep online/hybrid fallback active.
            </div>
          )}

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {coverageRows.length === 0 ? (
              <div className="rounded-2xl bg-[#f7f2eb] p-4 text-sm font-bold text-[#7d6b65]">No city-specific events yet.</div>
            ) : coverageRows.map((row) => (
              <div key={row.label} className="rounded-2xl bg-[#f7f2eb] p-4">
                <p className="font-black">{row.label}</p>
                <p className="mt-1 text-sm text-[#7d6b65]">{row.active} active - {row.drafts} draft - {row.interested} interested - {row.checks} checks</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Find events</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">{filteredEvents.length} visible of {events.length} events.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-7">
            <Field label="Search">
              <TextInput value={filters.search} onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))} placeholder="title, tag, venue" />
            </Field>
            <Field label="Filter by city">
              <input
                className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold text-[#2f2135]"
                list="participate-admin-cities"
                value={filters.city}
                onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Madrid"
              />
              <datalist id="participate-admin-cities">
                {cityOptions.map((city) => <option key={city} value={city} />)}
              </datalist>
            </Field>
            <Field label="Country">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.country} onChange={(event) => setFilters((prev) => ({ ...prev, country: event.target.value }))}>
                <option value="">All countries</option>
                {countryOptions.map((country) => <option key={country} value={country}>{countryLabel(country)}</option>)}
              </select>
            </Field>
            <Field label="Language">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.language} onChange={(event) => setFilters((prev) => ({ ...prev, language: event.target.value }))}>
                <option value="">All languages</option>
                {LANGUAGE_OPTIONS.map((language) => <option key={language} value={language}>{LANGUAGE_LABELS[language] ?? language}</option>)}
              </select>
            </Field>
            <Field label="Review state">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="">All states</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
              </select>
            </Field>
            <Field label="Format">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.format} onChange={(event) => setFilters((prev) => ({ ...prev, format: event.target.value }))}>
                <option value="">All formats</option>
                {FORMAT_OPTIONS.map((format) => <option key={format} value={format}>{FORMAT_LABELS[format]}</option>)}
              </select>
            </Field>
            <Field label="Safety review">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.safety} onChange={(event) => setFilters((prev) => ({ ...prev, safety: event.target.value }))}>
                <option value="">All safety states</option>
                {SAFETY_OPTIONS.map((status) => <option key={status} value={status}>{SAFETY_LABELS[status]}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Add event</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">New entries start as drafts or review-ready events until details are checked.</p>
            </div>
            <Pill tone="amber">Human verified before publish</Pill>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <Field label="Internal ID" hint="Lowercase words with hyphens. Used only by admins and imports.">
              <TextInput value={draft.eventKey} onChange={(value) => setDraft((prev) => ({ ...prev, eventKey: value }))} placeholder="madrid-garden-walk" />
            </Field>
            <Field label="Title (English)">
              <TextInput value={draft.titleEn} onChange={(value) => setDraft((prev) => ({ ...prev, titleEn: value }))} placeholder="Garden walk and coffee" />
            </Field>
            <Field label="Title (Spanish)">
              <TextInput value={draft.titleEs} onChange={(value) => setDraft((prev) => ({ ...prev, titleEs: value }))} placeholder="Paseo por el jardin y cafe" />
            </Field>
            <Field label="Title (German)">
              <TextInput value={draft.titleDe} onChange={(value) => setDraft((prev) => ({ ...prev, titleDe: value }))} placeholder="Gartenspaziergang und Kaffee" />
            </Field>
            <Field label="City or town">
              <TextInput value={draft.city ?? ""} onChange={(value) => setDraft((prev) => ({ ...prev, city: value }))} placeholder="Madrid" />
            </Field>
            <Field label="Country">
              <select
                className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]"
                value={normalizeCountry(draft.countryCode) ?? "ES"}
                onChange={(event) => setDraft((prev) => ({ ...prev, countryCode: event.target.value }))}
              >
                {DISCOVERY_COUNTRY_OPTIONS.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
              </select>
            </Field>
            <div className="lg:col-span-2">
              <Field label="Precise location" hint="Venue, street address, meeting point, or online room name.">
                <TextInput value={draft.locationLabel} onChange={(value) => setDraft((prev) => ({ ...prev, locationLabel: value }))} placeholder="Retiro Park, Puerta de Alcala meeting point" />
              </Field>
            </div>
            <Field label="Format">
              <SelectInput value={draft.format} onChange={(value) => setDraft((prev) => ({ ...prev, format: value }))} options={FORMAT_OPTIONS} labels={FORMAT_LABELS} />
            </Field>
            <Field label="Review state">
              <SelectInput value={draft.status} onChange={(value) => setDraft((prev) => ({ ...prev, status: value }))} options={STATUS_OPTIONS} labels={STATUS_LABELS} />
            </Field>
            <div className="lg:col-span-2">
              <Field label="Short description (English)">
                <TextArea value={draft.summaryEn} onChange={(value) => setDraft((prev) => ({ ...prev, summaryEn: value }))} placeholder="A gentle, social activity with clear meeting details." />
              </Field>
            </div>
            <Field label="Interests" hint="Comma separated tags used for matching.">
              <TextArea value={listToText(draft.interestTags)} onChange={(value) => setDraft((prev) => ({ ...prev, interestTags: textToList(value) }))} placeholder="music, walking, art" />
            </Field>
            <Field label="Accessibility" hint="Practical review notes, not marketing copy.">
              <TextArea value={listToText(draft.accessibilityTags)} onChange={(value) => setDraft((prev) => ({ ...prev, accessibilityTags: textToList(value) }))} placeholder="seated, step-free, quiet pace" />
            </Field>
            <Field label="Source link" optional>
              <TextInput value={draft.sourceUrl ?? ""} onChange={(value) => setDraft((prev) => ({ ...prev, sourceUrl: value }))} placeholder="https://..." />
            </Field>
            <button
              className="inline-flex min-h-[52px] items-center justify-center gap-2 self-end rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white"
              onClick={() => addEvent().catch((err) => setMessage(err.message))}
            >
              <Plus size={17} />
              Add event
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-4" data-testid="admin-participate-events">
          {filteredEvents.map((event) => {
            const saveFeedback = eventSaveFeedback[event.eventKey];
            const isSavingEvent = savingEventKey === event.eventKey;
            return (
            <article key={event.eventKey} className="rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black">{event.eventKey}</p>
                  <p className="mt-1 text-sm text-[#7d6b65]">{event.titleEn || event.titleEs || event.titleDe}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={statusTone(event.status)}>{STATUS_LABELS[event.status as EventStatus] ?? event.status}</Pill>
                  <Pill tone={safetyTone(event.safetyStatus)}>{SAFETY_LABELS[event.safetyStatus as SafetyStatus] ?? event.safetyStatus}</Pill>
                  <Pill tone="plain">{FORMAT_LABELS[event.format] ?? event.format}</Pill>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Review state">
                  <SelectInput value={event.status} onChange={(value) => updateEvent(event.eventKey, { status: value })} options={STATUS_OPTIONS} labels={STATUS_LABELS} />
                </Field>
                <Field label="Safety review">
                  <SelectInput value={event.safetyStatus} onChange={(value) => updateEvent(event.eventKey, { safetyStatus: value })} options={SAFETY_OPTIONS} labels={SAFETY_LABELS} />
                </Field>
                <Field label="Format">
                  <SelectInput value={event.format} onChange={(value) => updateEvent(event.eventKey, { format: value })} options={FORMAT_OPTIONS} labels={FORMAT_LABELS} />
                </Field>
                <Field label="Source note">
                  <TextInput value={event.source} onChange={(value) => updateEvent(event.eventKey, { source: value })} />
                </Field>
                <Field label="City or town">
                  <TextInput value={event.city ?? ""} onChange={(value) => updateEvent(event.eventKey, { city: value })} />
                </Field>
                <Field label="Country">
                  <select
                    className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]"
                    value={normalizeCountry(event.countryCode) ?? ""}
                    onChange={(input) => updateEvent(event.eventKey, { countryCode: input.target.value })}
                  >
                    <option value="">No country</option>
                    {event.countryCode && !DISCOVERY_COUNTRY_OPTIONS.some((country) => country.value === normalizeCountry(event.countryCode)) && (
                      <option value={normalizeCountry(event.countryCode) ?? ""}>{countryLabel(event.countryCode)}</option>
                    )}
                    {DISCOVERY_COUNTRY_OPTIONS.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
                  </select>
                </Field>
                <Field label="Precise location">
                  <TextInput value={event.locationLabel} onChange={(value) => updateEvent(event.eventKey, { locationLabel: value })} />
                </Field>
                <Field label="Source link" optional>
                  <TextInput value={event.sourceUrl ?? ""} onChange={(value) => updateEvent(event.eventKey, { sourceUrl: value })} />
                </Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Title (English)"><TextInput value={event.titleEn} onChange={(value) => updateEvent(event.eventKey, { titleEn: value })} /></Field>
                <Field label="Title (Spanish)"><TextInput value={event.titleEs} onChange={(value) => updateEvent(event.eventKey, { titleEs: value })} /></Field>
                <Field label="Title (German)"><TextInput value={event.titleDe} onChange={(value) => updateEvent(event.eventKey, { titleDe: value })} /></Field>
                <Field label="Short description (English)"><TextArea value={event.summaryEn} onChange={(value) => updateEvent(event.eventKey, { summaryEn: value })} /></Field>
                <Field label="Short description (Spanish)"><TextArea value={event.summaryEs} onChange={(value) => updateEvent(event.eventKey, { summaryEs: value })} /></Field>
                <Field label="Short description (German)"><TextArea value={event.summaryDe} onChange={(value) => updateEvent(event.eventKey, { summaryDe: value })} /></Field>
                <Field label="Full description (English)"><TextArea value={event.descriptionEn} onChange={(value) => updateEvent(event.eventKey, { descriptionEn: value })} /></Field>
                <Field label="Full description (Spanish)"><TextArea value={event.descriptionEs} onChange={(value) => updateEvent(event.eventKey, { descriptionEs: value })} /></Field>
                <Field label="Full description (German)"><TextArea value={event.descriptionDe} onChange={(value) => updateEvent(event.eventKey, { descriptionDe: value })} /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Time (English)"><TextInput value={event.timeLabelEn} onChange={(value) => updateEvent(event.eventKey, { timeLabelEn: value })} /></Field>
                <Field label="Time (Spanish)"><TextInput value={event.timeLabelEs} onChange={(value) => updateEvent(event.eventKey, { timeLabelEs: value })} /></Field>
                <Field label="Time (German)"><TextInput value={event.timeLabelDe} onChange={(value) => updateEvent(event.eventKey, { timeLabelDe: value })} /></Field>
                <Field label="Cost (English)"><TextInput value={event.costLabelEn} onChange={(value) => updateEvent(event.eventKey, { costLabelEn: value })} /></Field>
                <Field label="Cost (Spanish)"><TextInput value={event.costLabelEs} onChange={(value) => updateEvent(event.eventKey, { costLabelEs: value })} /></Field>
                <Field label="Cost (German)"><TextInput value={event.costLabelDe} onChange={(value) => updateEvent(event.eventKey, { costLabelDe: value })} /></Field>
                <Field label="Start date/time" hint="ISO format if there is an exact time." optional><TextInput value={event.startsAt ?? ""} onChange={(value) => updateEvent(event.eventKey, { startsAt: value })} placeholder="2026-07-12T10:00:00.000Z" /></Field>
                <Field label="End date/time" hint="ISO format if there is an exact end time." optional><TextInput value={event.endsAt ?? ""} onChange={(value) => updateEvent(event.eventKey, { endsAt: value })} placeholder="2026-07-12T11:00:00.000Z" /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Languages">
                  <TextInput value={listToText(event.languageCodes)} onChange={(value) => updateEvent(event.eventKey, { languageCodes: textToList(value) })} />
                </Field>
                <Field label="General tags">
                  <TextArea value={listToText(event.tags)} onChange={(value) => updateEvent(event.eventKey, { tags: textToList(value) })} />
                </Field>
                <Field label="Interests">
                  <TextArea value={listToText(event.interestTags)} onChange={(value) => updateEvent(event.eventKey, { interestTags: textToList(value) })} />
                </Field>
                <Field label="Accessibility">
                  <TextArea value={listToText(event.accessibilityTags)} onChange={(value) => updateEvent(event.eventKey, { accessibilityTags: textToList(value) })} />
                </Field>
                <Field label="Support prompts">
                  <TextInput value={listToText(event.helperActions)} onChange={(value) => updateEvent(event.eventKey, { helperActions: normalizeHelperActions(textToList(value)) })} />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                    <input type="checkbox" checked={event.isCurated} onChange={(input) => updateEvent(event.eventKey, { isCurated: input.target.checked })} />
                    Curated
                  </label>
                  <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                    <input type="checkbox" checked={event.needsLiveCheck} onChange={(input) => updateEvent(event.eventKey, { needsLiveCheck: input.target.checked })} />
                    Concierge check
                  </label>
                  <Pill tone="green">{event.responseCounts.interested} interested</Pill>
                  <Pill tone="amber">{event.responseCounts.maybe} maybe</Pill>
                  <Pill tone="rose">{event.responseCounts.not_for_me} not for me</Pill>
                  <Pill tone="plain">{event.checkRequestCount} checks</Pill>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  {saveFeedback && (
                    <p
                      className={`max-w-sm rounded-2xl px-4 py-2 text-sm font-bold ${
                        saveFeedback.tone === "green"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                      data-testid={`admin-event-save-feedback-${event.eventKey}`}
                      role="status"
                    >
                      {saveFeedback.message}
                    </p>
                  )}
                  <button
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-60"
                    disabled={savingEventKey !== null}
                    onClick={() => void saveEvent(event)}
                    type="button"
                  >
                    <Save size={17} />
                    {isSavingEvent ? "Saving..." : "Save event"}
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <h2 className="font-serif text-3xl">Recent Concierge checks</h2>
          <div className="mt-4 grid gap-2">
            {(activity.checks ?? []).slice(0, 8).length === 0 ? (
              <p className="rounded-2xl bg-[#f7f2eb] p-4 text-sm font-bold text-[#7d6b65]">No check requests yet.</p>
            ) : (activity.checks ?? []).slice(0, 8).map((item, index) => (
              <div key={`${String(item.id ?? index)}-${index}`} className="rounded-2xl bg-[#f7f2eb] p-4 text-sm">
                <p className="font-black text-[#2f2135]">{String(item.eventKey ?? item.event_id ?? "event")}</p>
                <p className="mt-1 text-[#7d6b65]">Status: {String(item.status ?? "requested")} - User: {String(item.userId ?? item.user_id ?? "unknown")}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
