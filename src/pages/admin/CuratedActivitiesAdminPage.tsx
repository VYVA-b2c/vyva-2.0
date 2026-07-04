import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bot, CheckCircle2, Download, ExternalLink, Globe2, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import type {
  AdminParticipationEvent,
  ParticipationEventFormat,
  ParticipationHelperAction,
} from "@/social/types";

type EventStatus = "active" | "draft" | "hidden" | "archived";
type SafetyStatus = "approved" | "needs_review" | "hidden";
type DiscoveryFormatPreference = ParticipationEventFormat | "any";
type DiscoveryCandidate = AdminParticipationEvent & { selected: boolean };
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

type WorkQueueFilter = "all" | "review" | "checks" | "popular" | "live";

const STATUS_OPTIONS: EventStatus[] = ["draft", "active", "hidden", "archived"];
const FORMAT_OPTIONS: ParticipationEventFormat[] = ["nearby", "online", "hybrid"];
const DISCOVERY_FORMAT_OPTIONS: DiscoveryFormatPreference[] = ["nearby", "online", "hybrid", "any"];
const SAFETY_OPTIONS: SafetyStatus[] = ["approved", "needs_review", "hidden"];
const LANGUAGE_OPTIONS = ["en", "es", "de"];
const HELPER_ACTION_OPTIONS: ParticipationHelperAction[] = ["check_details", "transport", "reminder", "bring_friend"];
const WORK_QUEUE_FILTERS: Array<{ id: WorkQueueFilter; label: string; description: string }> = [
  { id: "all", label: "All activities", description: "Everything in the library" },
  { id: "review", label: "Review queue", description: "Drafts or safety review" },
  { id: "checks", label: "Concierge checks", description: "User check requests" },
  { id: "popular", label: "User interest", description: "Interested or maybe" },
  { id: "live", label: "Live coverage", description: "Active and approved" },
];
type DiscoveryCityPreset = {
  city: string;
  defaultLocality: string;
  defaultAnchor: string;
  localities: readonly string[];
  anchors: readonly string[];
};

type DiscoveryProvincePreset = {
  province: string;
  cities: readonly DiscoveryCityPreset[];
};

type DiscoveryCountryPreset = {
  countryCode: string;
  countryName: string;
  provinces: readonly DiscoveryProvincePreset[];
};

const DISCOVERY_LOCATION_PRESETS: readonly DiscoveryCountryPreset[] = [
  {
    countryCode: "ES",
    countryName: "Spain",
    provinces: [
      {
        province: "Madrid",
        cities: [
          {
            city: "Madrid",
            defaultLocality: "Chamberi, Salamanca",
            defaultAnchor: "28010",
            localities: ["Chamberi", "Salamanca", "Retiro", "Centro", "Arganzuela", "Moncloa"],
            anchors: ["28010", "28001", "28014", "Centro Cultural Galileo", "Biblioteca Publica Jose Hierro"],
          },
          {
            city: "Alcala de Henares",
            defaultLocality: "Centro historico",
            defaultAnchor: "28801",
            localities: ["Centro historico", "La Garena", "El Ensanche", "Reyes Catolicos"],
            anchors: ["28801", "28806", "Biblioteca Cardenal Cisneros", "Casa de la Cultura"],
          },
        ],
      },
      {
        province: "Valencia",
        cities: [
          {
            city: "Valencia",
            defaultLocality: "Ruzafa, Gran Via",
            defaultAnchor: "46006",
            localities: ["Ruzafa", "Gran Via", "Ciutat Vella", "El Carmen", "Ensanche", "Jardin del Turia"],
            anchors: ["46006", "46005", "46001", "Jardin del Turia", "Biblioteca Publica Valencia"],
          },
          {
            city: "Gandia",
            defaultLocality: "Centro, Grau",
            defaultAnchor: "46701",
            localities: ["Centro", "Grau", "Benipeixcar", "Roig de Corella"],
            anchors: ["46701", "46730", "Casa de Cultura Marques Gonzalez de Quiros"],
          },
        ],
      },
      {
        province: "Barcelona",
        cities: [
          {
            city: "Barcelona",
            defaultLocality: "Eixample, Gracia",
            defaultAnchor: "08012",
            localities: ["Eixample", "Gracia", "Sarria", "Sant Antoni", "Poblenou", "Les Corts"],
            anchors: ["08012", "08036", "08015", "Centre Civic Cotxeres Borrell", "Biblioteca Jaume Fuster"],
          },
          {
            city: "Badalona",
            defaultLocality: "Centre, Casagemes",
            defaultAnchor: "08911",
            localities: ["Centre", "Casagemes", "Dalt la Vila", "Gorg"],
            anchors: ["08911", "08912", "Biblioteca Can Casacuberta"],
          },
        ],
      },
      {
        province: "Malaga",
        cities: [
          {
            city: "Malaga",
            defaultLocality: "Centro, La Malagueta",
            defaultAnchor: "29015",
            localities: ["Centro", "La Malagueta", "El Limonar", "Teatinos"],
            anchors: ["29015", "29016", "Biblioteca Canovas del Castillo", "Centro Cultural La Malagueta"],
          },
        ],
      },
    ],
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    provinces: [
      {
        province: "Greater London",
        cities: [
          {
            city: "London",
            defaultLocality: "Kensington, Chelsea",
            defaultAnchor: "SW3",
            localities: ["Kensington", "Chelsea", "Westminster", "Camden", "Islington", "Hammersmith"],
            anchors: ["SW3", "W8", "W1", "Kensington Central Library", "Chelsea Library"],
          },
        ],
      },
      {
        province: "Greater Manchester",
        cities: [
          {
            city: "Manchester",
            defaultLocality: "Didsbury, Chorlton",
            defaultAnchor: "M20",
            localities: ["Didsbury", "Chorlton", "City centre", "Withington", "Sale"],
            anchors: ["M20", "M21", "Manchester Central Library", "Didsbury Library"],
          },
        ],
      },
      {
        province: "West Midlands",
        cities: [
          {
            city: "Birmingham",
            defaultLocality: "Edgbaston, Moseley",
            defaultAnchor: "B13",
            localities: ["Edgbaston", "Moseley", "Harborne", "Jewellery Quarter"],
            anchors: ["B13", "B15", "Library of Birmingham", "Moseley Community Hub"],
          },
        ],
      },
    ],
  },
  {
    countryCode: "FR",
    countryName: "France",
    provinces: [
      {
        province: "Ile-de-France",
        cities: [
          {
            city: "Paris",
            defaultLocality: "Marais, Saint-Germain",
            defaultAnchor: "75004",
            localities: ["Marais", "Saint-Germain", "Montparnasse", "Batignolles"],
            anchors: ["75004", "75006", "Bibliotheque Saint-Simon", "Maison de la Vie Associative"],
          },
        ],
      },
      {
        province: "Provence-Alpes-Cote d'Azur",
        cities: [
          {
            city: "Nice",
            defaultLocality: "Liberation, Cimiez",
            defaultAnchor: "06000",
            localities: ["Liberation", "Cimiez", "Old town", "Port Lympia"],
            anchors: ["06000", "06300", "Bibliotheque Louis Nucera"],
          },
        ],
      },
    ],
  },
  {
    countryCode: "DE",
    countryName: "Germany",
    provinces: [
      {
        province: "Berlin",
        cities: [
          {
            city: "Berlin",
            defaultLocality: "Charlottenburg, Mitte",
            defaultAnchor: "10115",
            localities: ["Charlottenburg", "Mitte", "Prenzlauer Berg", "Kreuzberg"],
            anchors: ["10115", "10623", "Amerika-Gedenkbibliothek", "Stadtbibliothek Mitte"],
          },
        ],
      },
      {
        province: "Bavaria",
        cities: [
          {
            city: "Munich",
            defaultLocality: "Maxvorstadt, Schwabing",
            defaultAnchor: "80799",
            localities: ["Maxvorstadt", "Schwabing", "Sendling", "Haidhausen"],
            anchors: ["80799", "80802", "Muenchner Stadtbibliothek"],
          },
        ],
      },
    ],
  },
] as const;
const DISCOVERY_COUNTRY_OPTIONS = DISCOVERY_LOCATION_PRESETS.map((country) => ({
  value: country.countryCode,
  label: country.countryName,
}));
const DISCOVERY_CITY_PRESETS = DISCOVERY_LOCATION_PRESETS.flatMap((country) => (
  country.provinces.flatMap((province) => (
    province.cities.map((city) => ({
      ...city,
      province: province.province,
      countryCode: country.countryCode,
      countryName: country.countryName,
    }))
  ))
));
const DISCOVERY_FALLBACK_LOCALITIES = ["City centre", "Old town", "Near public library", "Near community centre", "Main park"];
const DISCOVERY_FALLBACK_ANCHORS = ["Main library", "Community centre", "Central park", "Town hall"];
const DISCOVERY_INTEREST_OPTIONS = ["music", "walking", "art", "culture", "gardening", "history", "language", "crafts", "gentle movement", "book club"];
const DISCOVERY_VENUE_OPTIONS = [
  "libraries",
  "cultural centres",
  "parks",
  "community centres",
  "museums",
  "senior centres",
  "neighbourhood parks",
  "public workshops",
  "local walking groups",
];
const DISCOVERY_LANGUAGE_CHOICES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
] as const;
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

function FieldGroup({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <input
      data-testid={testId}
      className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function listIncludes(value: string, option: string) {
  const normalizedOption = option.trim().toLowerCase();
  return textToList(value).some((item) => item.toLowerCase() === normalizedOption);
}

function addListOption(value: string, option: string) {
  const cleaned = option.trim();
  if (!cleaned || listIncludes(value, cleaned)) return value;
  return [...textToList(value), cleaned].join(", ");
}

function toggleListOption(value: string, option: string) {
  const normalizedOption = option.trim().toLowerCase();
  const current = textToList(value);
  const exists = current.some((item) => item.toLowerCase() === normalizedOption);
  return (exists ? current.filter((item) => item.toLowerCase() !== normalizedOption) : [...current, option]).join(", ");
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ChoiceButton({
  active,
  children,
  onClick,
  testId,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-left text-sm font-black transition ${
        active
          ? "border-purple-700 bg-purple-700 text-white shadow-sm"
          : "border-[#eadfd5] bg-white text-[#2f2135] hover:border-purple-300 hover:bg-purple-50"
      }`}
    >
      {children}
    </button>
  );
}

function SmartMultiPicker({
  value,
  onChange,
  options,
  testIdPrefix,
  customPlaceholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  testIdPrefix: string;
  customPlaceholder: string;
}) {
  const [customValue, setCustomValue] = useState("");

  const addCustomValue = () => {
    const next = addListOption(value, customValue);
    onChange(next);
    setCustomValue("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ChoiceButton
            key={option}
            active={listIncludes(value, option)}
            onClick={() => onChange(toggleListOption(value, option))}
            testId={`${testIdPrefix}-${slugifyEventKey(option, "option")}`}
          >
            {option}
          </ChoiceButton>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          data-testid={`${testIdPrefix}-custom`}
          className="min-w-0 flex-1 rounded-2xl border border-[#eadfd5] px-3 py-2 text-sm font-semibold text-[#2f2135]"
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomValue();
            }
          }}
          placeholder={customPlaceholder}
        />
        <button
          type="button"
          data-testid={`${testIdPrefix}-add`}
          onClick={addCustomValue}
          disabled={!customValue.trim()}
          className="inline-flex items-center gap-1 rounded-2xl border border-purple-200 bg-white px-3 py-2 text-sm font-black text-purple-800 disabled:opacity-50"
        >
          <Plus size={15} />
          Add
        </button>
      </div>
    </div>
  );
}

function LanguageTogglePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DISCOVERY_LANGUAGE_CHOICES.map((language) => (
        <ChoiceButton
          key={language.value}
          active={listIncludes(value, language.value)}
          onClick={() => onChange(toggleListOption(value, language.value))}
          testId={`admin-discovery-language-${language.value}`}
        >
          {language.label}
        </ChoiceButton>
      ))}
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  testId,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  const nextValue = (direction: -1 | 1) => clampNumber(Number(value) + (step * direction), min, max);
  return (
    <div className="flex min-h-[50px] items-center justify-between rounded-2xl border border-[#eadfd5] bg-white px-2">
      <button
        type="button"
        aria-label="Decrease"
        data-testid={`${testId}-decrease`}
        onClick={() => onChange(nextValue(-1))}
        className="h-9 w-9 rounded-xl bg-[#f7f2eb] text-lg font-black text-[#2f2135]"
      >
        -
      </button>
      <output data-testid={testId} className="px-3 text-sm font-black text-[#2f2135]">{value}</output>
      <button
        type="button"
        aria-label="Increase"
        data-testid={`${testId}-increase`}
        onClick={() => onChange(nextValue(1))}
        className="h-9 w-9 rounded-xl bg-purple-700 text-lg font-black text-white"
      >
        +
      </button>
    </div>
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
}: {
  value: T | string;
  onChange: (value: T) => void;
  options: readonly T[];
}) {
  return (
    <select
      className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
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

function matchesWorkQueue(event: AdminParticipationEvent, queue: WorkQueueFilter) {
  if (queue === "all") return true;
  if (queue === "review") return event.status === "draft" || event.safetyStatus === "needs_review";
  if (queue === "checks") return event.checkRequestCount > 0;
  if (queue === "popular") return event.responseCounts.interested + event.responseCounts.maybe > 0;
  return event.status === "active" && event.safetyStatus === "approved";
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
  const [workQueueFilter, setWorkQueueFilter] = useState<WorkQueueFilter>("all");
  const [discoveryCandidates, setDiscoveryCandidates] = useState<DiscoveryCandidate[]>([]);
  const [countryQuery, setCountryQuery] = useState("Spain");
  const [customCity, setCustomCity] = useState("");
  const [discoveryForm, setDiscoveryForm] = useState({
    city: "Madrid",
    province: "Madrid",
    countryCode: "ES",
    locality: "Chamberi, Salamanca",
    postalCode: "28010",
    radiusKm: 4,
    interests: "music, walking, art",
    venueHints: "libraries, cultural centres, parks",
    languageCodes: "en, es, de",
    format: "nearby" as DiscoveryFormatPreference,
    maxResults: 6,
  });
  const countryMatches = useMemo(() => {
    const query = countryQuery.trim().toLowerCase();
    if (!query) return DISCOVERY_LOCATION_PRESETS;
    return DISCOVERY_LOCATION_PRESETS.filter((country) => (
      country.countryName.toLowerCase().includes(query) || country.countryCode.toLowerCase().includes(query)
    ));
  }, [countryQuery]);
  const normalizedCountryQuery = countryQuery.trim().toLowerCase();
  const countrySuggestions = normalizedCountryQuery && countryMatches.some((country) => (
    country.countryName.toLowerCase() === normalizedCountryQuery || country.countryCode.toLowerCase() === normalizedCountryQuery
  ))
    ? []
    : countryMatches.slice(0, 4);
  const activeDiscoveryCountryPreset = useMemo(() => {
    const code = cleanText(discoveryForm.countryCode).toUpperCase();
    return DISCOVERY_LOCATION_PRESETS.find((country) => country.countryCode === code);
  }, [discoveryForm.countryCode]);
  const visibleDiscoveryCountryPreset = countryMatches.length === 1 ? countryMatches[0] : activeDiscoveryCountryPreset;
  const activeProvincePreset = useMemo(() => {
    const province = cleanText(discoveryForm.province).toLowerCase();
    return visibleDiscoveryCountryPreset?.provinces.find((item) => item.province.toLowerCase() === province)
      ?? visibleDiscoveryCountryPreset?.provinces.find((item) => (
        item.cities.some((city) => city.city.toLowerCase() === discoveryForm.city.toLowerCase())
      ))
      ?? visibleDiscoveryCountryPreset?.provinces[0];
  }, [discoveryForm.city, discoveryForm.province, visibleDiscoveryCountryPreset]);
  const activeDiscoveryCityPreset = useMemo(() => {
    const city = cleanText(discoveryForm.city).toLowerCase();
    const country = cleanText(discoveryForm.countryCode).toUpperCase();
    return DISCOVERY_CITY_PRESETS.find((preset) => (
      preset.city.toLowerCase() === city && preset.countryCode === country
    ));
  }, [discoveryForm.city, discoveryForm.countryCode]);
  const visibleCityOptions = activeProvincePreset?.cities ?? [];
  const localityOptions = activeDiscoveryCityPreset?.localities ?? DISCOVERY_FALLBACK_LOCALITIES;
  const anchorOptions = activeDiscoveryCityPreset?.anchors ?? DISCOVERY_FALLBACK_ANCHORS;

  function selectCountryPreset(country: DiscoveryCountryPreset) {
    const province = country.provinces[0];
    const city = province?.cities[0];
    setCountryQuery(country.countryName);
    if (!province || !city) {
      setDiscoveryForm((prev) => ({ ...prev, countryCode: country.countryCode }));
      return;
    }
    setDiscoveryForm((prev) => ({
      ...prev,
      countryCode: country.countryCode,
      province: province.province,
      city: city.city,
      locality: city.defaultLocality,
      postalCode: city.defaultAnchor,
    }));
  }

  function updateCountryQuery(value: string) {
    setCountryQuery(value);
    const normalized = value.trim().toLowerCase();
    const exactMatch = DISCOVERY_LOCATION_PRESETS.find((country) => (
      country.countryName.toLowerCase() === normalized || country.countryCode.toLowerCase() === normalized
    ));
    if (exactMatch) selectCountryPreset(exactMatch);
  }

  function selectProvincePreset(province: DiscoveryProvincePreset) {
    const city = province.cities[0];
    const country = visibleDiscoveryCountryPreset;
    if (country) setCountryQuery(country.countryName);
    if (!city) {
      setDiscoveryForm((prev) => ({
        ...prev,
        countryCode: country?.countryCode ?? prev.countryCode,
        province: province.province,
      }));
      return;
    }
    setDiscoveryForm((prev) => ({
      ...prev,
      countryCode: country?.countryCode ?? prev.countryCode,
      province: province.province,
      city: city.city,
      locality: city.defaultLocality,
      postalCode: city.defaultAnchor,
    }));
  }

  function selectCityPreset(city: DiscoveryCityPreset) {
    const country = visibleDiscoveryCountryPreset;
    const province = activeProvincePreset;
    if (country) setCountryQuery(country.countryName);
    setDiscoveryForm((prev) => ({
      ...prev,
      countryCode: country?.countryCode ?? prev.countryCode,
      province: province?.province ?? prev.province,
      city: city.city,
      locality: city.defaultLocality,
      postalCode: city.defaultAnchor,
    }));
  }

  function addCustomCity() {
    const city = customCity.trim();
    if (!city) return;
    setDiscoveryForm((prev) => ({
      ...prev,
      city,
      locality: prev.locality || city,
      postalCode: prev.postalCode,
    }));
    setCustomCity("");
  }

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/social/participate${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Admin request failed");
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
      if (!matchesWorkQueue(event, workQueueFilter)) return false;
      return true;
    });
  }, [events, filters, workQueueFilter]);

  const activeApproved = useMemo(() => (
    events.filter((event) => event.status === "active" && event.safetyStatus === "approved")
  ), [events]);

  const onlineFallbackCount = activeApproved.filter((event) => event.format === "online" || event.format === "hybrid").length;
  const localCityCount = new Set(activeApproved.map(cityKey).filter(Boolean)).size;
  const interestedCount = events.reduce((sum, event) => sum + event.responseCounts.interested, 0);
  const checkRequestCount = events.reduce((sum, event) => sum + event.checkRequestCount, 0);
  const selectedDiscoveryCount = discoveryCandidates.filter((candidate) => candidate.selected).length;
  const workQueueCounts = useMemo<Record<WorkQueueFilter, number>>(() => ({
    all: events.length,
    review: events.filter((event) => matchesWorkQueue(event, "review")).length,
    checks: events.filter((event) => matchesWorkQueue(event, "checks")).length,
    popular: events.filter((event) => matchesWorkQueue(event, "popular")).length,
    live: events.filter((event) => matchesWorkQueue(event, "live")).length,
  }), [events]);

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

  function updateDiscoveryCandidate(eventKey: string, patch: Partial<DiscoveryCandidate>) {
    setDiscoveryCandidates((current) => (
      current.map((candidate) => candidate.eventKey === eventKey ? { ...candidate, ...patch } : candidate)
    ));
  }

  function updateDiscoveryEvidence(candidate: DiscoveryCandidate, evidence: string) {
    const discovery = candidate.metadata?.discovery;
    updateDiscoveryCandidate(candidate.eventKey, {
      metadata: {
        ...(candidate.metadata ?? {}),
        discovery: {
          ...(discovery && typeof discovery === "object" ? discovery : {}),
          evidence,
        },
      },
    });
  }

  async function discoverActivities() {
    setDiscovering(true);
    setMessage("");
    try {
      const body = {
        city: cleanText(discoveryForm.city),
        countryCode: normalizeCountry(discoveryForm.countryCode),
        locality: cleanText(discoveryForm.locality),
        postalCode: cleanText(discoveryForm.postalCode),
        radiusKm: Math.max(0.5, Math.min(50, Number(discoveryForm.radiusKm) || 4)),
        interests: textToList(discoveryForm.interests),
        venueHints: textToList(discoveryForm.venueHints),
        languageCodes: textToList(discoveryForm.languageCodes),
        format: discoveryForm.format,
        maxResults: discoveryForm.maxResults,
      };
      const data = await api("/discover", { method: "POST", body: JSON.stringify(body) });
      const candidates = (data.candidates ?? []) as AdminParticipationEvent[];
      const rejected = Array.isArray(data.rejected) ? data.rejected.length : 0;
      setDiscoveryCandidates(candidates.map((candidate) => ({ ...candidate, selected: true })));
      setMessage(rejected > 0
        ? `${candidates.length} AI candidates ready for review. ${rejected} skipped because they were missing sources or required fields.`
        : `${candidates.length} AI candidates ready for review.`);
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
    const body = eventPayload(event, false);
    await api(`/events/${event.eventKey}`, { method: "PATCH", body: JSON.stringify(body) });
    await refresh();
    setMessage(`${event.eventKey} saved.`);
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

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm" data-testid="admin-participate-work-queue">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-serif text-3xl">Work queue</h2>
              <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                Showing {filteredEvents.length} of {events.length} activities.
              </p>
            </div>
            {workQueueFilter !== "all" && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 px-4 text-sm font-black text-purple-800"
                onClick={() => setWorkQueueFilter("all")}
                data-testid="admin-participate-clear-work-queue"
              >
                Show all
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {WORK_QUEUE_FILTERS.map((queue) => {
              const active = workQueueFilter === queue.id;
              return (
                <button
                  key={queue.id}
                  type="button"
                  onClick={() => setWorkQueueFilter(queue.id)}
                  className={`min-h-[92px] rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                      : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
                  }`}
                  data-testid={`admin-participate-queue-${queue.id}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black">{queue.label}</span>
                    <span className="text-2xl font-black leading-none">{workQueueCounts[queue.id]}</span>
                  </span>
                  <span className={`mt-1 block text-xs font-bold ${active ? "text-purple-100" : "text-[#8b7a73]"}`}>{queue.description}</span>
                </button>
              );
            })}
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

          <div className="mt-4 rounded-3xl border border-[#eadfd5] bg-[#fffaf4] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black text-[#2f2135]">Locality focus</h3>
                <p className="text-sm font-semibold text-[#7d6b65]">
                  Pick neighbourhoods, anchors, and a practical radius so discovery avoids generic city-wide results.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="plain">{discoveryForm.locality || discoveryForm.city}</Pill>
                <Pill tone="plain">{discoveryForm.radiusKm} km radius</Pill>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1.05fr_1.05fr_1.35fr_1fr_0.9fr]">
              <FieldGroup label="Country">
                <input
                  data-testid="admin-discovery-country"
                  aria-label="Country"
                  className="w-full rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 text-sm font-bold text-[#2f2135]"
                  value={countryQuery}
                  onChange={(event) => updateCountryQuery(event.target.value)}
                  placeholder="Type a country"
                  list="admin-discovery-country-options"
                />
                <datalist id="admin-discovery-country-options">
                  {DISCOVERY_COUNTRY_OPTIONS.map((country) => (
                    <option key={country.value} value={country.label}>{country.value}</option>
                  ))}
                </datalist>
                {countrySuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {countrySuggestions.map((country) => (
                    <ChoiceButton
                      key={country.countryCode}
                      active={discoveryForm.countryCode === country.countryCode}
                      onClick={() => selectCountryPreset(country)}
                      testId={`admin-discovery-country-option-${country.countryCode.toLowerCase()}`}
                    >
                      {country.countryName}
                    </ChoiceButton>
                    ))}
                  </div>
                )}
              </FieldGroup>
              <FieldGroup label="Province/region">
                <div className="flex flex-wrap gap-2">
                  {(visibleDiscoveryCountryPreset?.provinces ?? []).map((province) => (
                    <ChoiceButton
                      key={province.province}
                      active={activeProvincePreset?.province === province.province}
                      onClick={() => selectProvincePreset(province)}
                      testId={`admin-discovery-province-${slugifyEventKey(province.province, "province")}`}
                    >
                      {province.province}
                    </ChoiceButton>
                  ))}
                </div>
              </FieldGroup>
              <FieldGroup label="City">
                <div className="flex flex-wrap gap-2">
                  {visibleCityOptions.map((city) => (
                    <ChoiceButton
                      key={city.city}
                      active={discoveryForm.city.toLowerCase() === city.city.toLowerCase()}
                      onClick={() => selectCityPreset(city)}
                      testId={`admin-discovery-city-option-${slugifyEventKey(city.city, "city")}`}
                    >
                      {city.city}
                    </ChoiceButton>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    data-testid="admin-discovery-city-custom"
                    aria-label="Custom discovery city"
                    className="min-w-0 flex-1 rounded-2xl border border-[#eadfd5] px-3 py-2 text-sm font-semibold text-[#2f2135]"
                    value={customCity}
                    onChange={(event) => setCustomCity(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomCity();
                      }
                    }}
                    placeholder="Type another city"
                  />
                  <button
                    type="button"
                    onClick={addCustomCity}
                    disabled={!customCity.trim()}
                    className="rounded-2xl border border-purple-200 bg-white px-3 py-2 text-sm font-black text-purple-800 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </FieldGroup>
              <FieldGroup label="Neighbourhood or area">
                <SmartMultiPicker
                  value={discoveryForm.locality}
                  onChange={(value) => setDiscoveryForm((prev) => ({ ...prev, locality: value }))}
                  options={localityOptions}
                  testIdPrefix="admin-discovery-locality"
                  customPlaceholder="Add area"
                />
              </FieldGroup>
              <FieldGroup label="Postcode or anchor">
                <select
                  data-testid="admin-discovery-postal-code"
                  className="w-full rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 text-sm font-bold text-[#2f2135]"
                  value={anchorOptions.includes(discoveryForm.postalCode) ? discoveryForm.postalCode : "custom"}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value !== "custom") setDiscoveryForm((prev) => ({ ...prev, postalCode: value }));
                  }}
                >
                  {anchorOptions.map((anchor) => <option key={anchor} value={anchor}>{anchor}</option>)}
                  <option value="custom">Custom anchor</option>
                </select>
                <input
                  aria-label="Custom postcode or anchor"
                  className="mt-2 w-full rounded-2xl border border-[#eadfd5] px-3 py-2 text-sm font-semibold text-[#2f2135]"
                  value={discoveryForm.postalCode}
                  onChange={(event) => setDiscoveryForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                  placeholder="Postcode, library, venue, or landmark"
                />
              </FieldGroup>
              <FieldGroup label="Radius">
                <div className="rounded-2xl border border-[#eadfd5] bg-white px-4 py-3">
                  <div className="flex items-center justify-between text-sm font-black text-[#2f2135]">
                    <span>{discoveryForm.radiusKm} km</span>
                    <span className="text-xs text-[#7d6b65]">0.5-50 km</span>
                  </div>
                  <input
                    data-testid="admin-discovery-radius"
                    className="mt-2 w-full accent-purple-700"
                    type="range"
                    min={0.5}
                    max={50}
                    step={0.5}
                    value={discoveryForm.radiusKm}
                    onChange={(event) => setDiscoveryForm((prev) => ({
                      ...prev,
                      radiusKm: clampNumber(Number(event.target.value) || 0.5, 0.5, 50),
                    }))}
                  />
                </div>
              </FieldGroup>
            </div>
          </div>

          <div className="mt-3 grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.25fr_1.35fr_1fr_0.8fr_0.7fr]">
            <FieldGroup label="Interests">
              <SmartMultiPicker
                value={discoveryForm.interests}
                onChange={(value) => setDiscoveryForm((prev) => ({ ...prev, interests: value }))}
                options={DISCOVERY_INTEREST_OPTIONS}
                testIdPrefix="admin-discovery-interest"
                customPlaceholder="Add interest"
              />
            </FieldGroup>
            <FieldGroup label="Venue/source hints">
              <SmartMultiPicker
                value={discoveryForm.venueHints}
                onChange={(value) => setDiscoveryForm((prev) => ({ ...prev, venueHints: value }))}
                options={DISCOVERY_VENUE_OPTIONS}
                testIdPrefix="admin-discovery-venue"
                customPlaceholder="Add venue/source type"
              />
            </FieldGroup>
            <FieldGroup label="Languages">
              <LanguageTogglePicker
                value={discoveryForm.languageCodes}
                onChange={(value) => setDiscoveryForm((prev) => ({ ...prev, languageCodes: value }))}
              />
            </FieldGroup>
            <Field label="Format">
              <SelectInput value={discoveryForm.format} onChange={(value) => setDiscoveryForm((prev) => ({ ...prev, format: value }))} options={DISCOVERY_FORMAT_OPTIONS} />
            </Field>
            <FieldGroup label="Max results">
              <NumberStepper
                value={discoveryForm.maxResults}
                min={1}
                max={12}
                onChange={(value) => setDiscoveryForm((prev) => ({ ...prev, maxResults: value }))}
                testId="admin-discovery-max-results"
              />
            </FieldGroup>
          </div>

          <div className="hidden">
            <input type="hidden" readOnly data-testid="admin-discovery-locality-value" value={discoveryForm.locality} />
            <input type="hidden" readOnly data-testid="admin-discovery-venue-hints" value={discoveryForm.venueHints} />
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

          <div className="mt-4 grid gap-4" data-testid="admin-discovery-preview">
            {discoveryCandidates.length === 0 ? (
              <p className="rounded-2xl bg-[#f7f2eb] p-4 text-sm font-bold text-[#7d6b65]">No AI candidates in preview yet.</p>
            ) : discoveryCandidates.map((candidate) => (
              <article key={candidate.eventKey} className="rounded-2xl border border-[#eadfd5] bg-[#fffdf9] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-[#2f2135]">{candidate.eventKey}</p>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{candidate.titleEn}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                      <input
                        type="checkbox"
                        checked={candidate.selected}
                        onChange={(event) => updateDiscoveryCandidate(candidate.eventKey, { selected: event.target.checked })}
                      />
                      Save
                    </label>
                    {candidate.sourceUrl && (
                      <a
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700"
                        href={candidate.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={14} />
                        Source link
                      </a>
                    )}
                    <button
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700"
                      onClick={() => setDiscoveryCandidates((current) => current.filter((item) => item.eventKey !== candidate.eventKey))}
                      type="button"
                    >
                      <Trash2 size={14} />
                      Discard
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Event key">
                    <TextInput value={candidate.eventKey} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { eventKey: value, id: value })} />
                  </Field>
                  <Field label="Title EN">
                    <TextInput value={candidate.titleEn} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { titleEn: value })} />
                  </Field>
                  <Field label="City">
                    <TextInput value={candidate.city ?? ""} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { city: value })} />
                  </Field>
                  <Field label="Location">
                    <TextInput value={candidate.locationLabel} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { locationLabel: value })} />
                  </Field>
                  <Field label="Time">
                    <TextInput value={candidate.timeLabelEn} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { timeLabelEn: value })} />
                  </Field>
                  <Field label="Cost">
                    <TextInput value={candidate.costLabelEn} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { costLabelEn: value })} />
                  </Field>
                  <Field label="Tags">
                    <TextInput value={listToText(candidate.interestTags)} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { interestTags: textToList(value) })} />
                  </Field>
                  <Field label="Source URL">
                    <TextInput value={candidate.sourceUrl ?? ""} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { sourceUrl: value })} />
                  </Field>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="Summary">
                    <TextArea value={candidate.summaryEn} onChange={(value) => updateDiscoveryCandidate(candidate.eventKey, { summaryEn: value })} />
                  </Field>
                  <Field label="Evidence">
                    <TextArea value={discoveryEvidence(candidate)} onChange={(value) => updateDiscoveryEvidence(candidate, value)} />
                  </Field>
                </div>
              </article>
            ))}
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
              <h2 className="font-serif text-3xl">Filters</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">{filteredEvents.length} visible of {events.length} events.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-7">
            <Field label="Search">
              <TextInput value={filters.search} onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))} placeholder="title, tag, key" />
            </Field>
            <Field label="City filter">
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
                <option value="">All</option>
                {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
            </Field>
            <Field label="Language">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.language} onChange={(event) => setFilters((prev) => ({ ...prev, language: event.target.value }))}>
                <option value="">All</option>
                {LANGUAGE_OPTIONS.map((language) => <option key={language} value={language}>{language}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="">All</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Format">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.format} onChange={(event) => setFilters((prev) => ({ ...prev, format: event.target.value }))}>
                <option value="">All</option>
                {FORMAT_OPTIONS.map((format) => <option key={format} value={format}>{format}</option>)}
              </select>
            </Field>
            <Field label="Safety">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.safety} onChange={(event) => setFilters((prev) => ({ ...prev, safety: event.target.value }))}>
                <option value="">All</option>
                {SAFETY_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
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
            <Field label="Event key">
              <TextInput value={draft.eventKey} onChange={(value) => setDraft((prev) => ({ ...prev, eventKey: value }))} placeholder="madrid-garden-walk" />
            </Field>
            <Field label="Title EN">
              <TextInput value={draft.titleEn} onChange={(value) => setDraft((prev) => ({ ...prev, titleEn: value }))} />
            </Field>
            <Field label="Title ES">
              <TextInput value={draft.titleEs} onChange={(value) => setDraft((prev) => ({ ...prev, titleEs: value }))} />
            </Field>
            <Field label="Title DE">
              <TextInput value={draft.titleDe} onChange={(value) => setDraft((prev) => ({ ...prev, titleDe: value }))} />
            </Field>
            <Field label="City">
              <TextInput value={draft.city ?? ""} onChange={(value) => setDraft((prev) => ({ ...prev, city: value }))} placeholder="Madrid" />
            </Field>
            <Field label="Country code">
              <TextInput value={draft.countryCode ?? ""} onChange={(value) => setDraft((prev) => ({ ...prev, countryCode: value }))} placeholder="ES" />
            </Field>
            <Field label="Format">
              <SelectInput value={draft.format} onChange={(value) => setDraft((prev) => ({ ...prev, format: value }))} options={FORMAT_OPTIONS} />
            </Field>
            <Field label="Status">
              <SelectInput value={draft.status} onChange={(value) => setDraft((prev) => ({ ...prev, status: value }))} options={STATUS_OPTIONS} />
            </Field>
            <Field label="Summary EN">
              <TextArea value={draft.summaryEn} onChange={(value) => setDraft((prev) => ({ ...prev, summaryEn: value }))} />
            </Field>
            <Field label="Interest tags">
              <TextArea value={listToText(draft.interestTags)} onChange={(value) => setDraft((prev) => ({ ...prev, interestTags: textToList(value) }))} placeholder="music, walking, art" />
            </Field>
            <Field label="Accessibility">
              <TextArea value={listToText(draft.accessibilityTags)} onChange={(value) => setDraft((prev) => ({ ...prev, accessibilityTags: textToList(value) }))} placeholder="seated, step-free" />
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
          {filteredEvents.length === 0 ? (
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-8 text-center text-sm font-bold text-[#7d6b65]">
              No activities match this queue and filter combination.
            </div>
          ) : filteredEvents.map((event) => (
            <article key={event.eventKey} className="rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black">{event.eventKey}</p>
                  <p className="mt-1 text-sm text-[#7d6b65]">{event.titleEn || event.titleEs || event.titleDe}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={statusTone(event.status)}>{event.status}</Pill>
                  <Pill tone={safetyTone(event.safetyStatus)}>{event.safetyStatus}</Pill>
                  <Pill tone="plain">{event.format}</Pill>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Status">
                  <SelectInput value={event.status} onChange={(value) => updateEvent(event.eventKey, { status: value })} options={STATUS_OPTIONS} />
                </Field>
                <Field label="Safety status">
                  <SelectInput value={event.safetyStatus} onChange={(value) => updateEvent(event.eventKey, { safetyStatus: value })} options={SAFETY_OPTIONS} />
                </Field>
                <Field label="Format">
                  <SelectInput value={event.format} onChange={(value) => updateEvent(event.eventKey, { format: value })} options={FORMAT_OPTIONS} />
                </Field>
                <Field label="Source">
                  <TextInput value={event.source} onChange={(value) => updateEvent(event.eventKey, { source: value })} />
                </Field>
                <Field label="City">
                  <TextInput value={event.city ?? ""} onChange={(value) => updateEvent(event.eventKey, { city: value })} />
                </Field>
                <Field label="Country code">
                  <TextInput value={event.countryCode ?? ""} onChange={(value) => updateEvent(event.eventKey, { countryCode: value })} />
                </Field>
                <Field label="Location label">
                  <TextInput value={event.locationLabel} onChange={(value) => updateEvent(event.eventKey, { locationLabel: value })} />
                </Field>
                <Field label="Source URL" optional>
                  <TextInput value={event.sourceUrl ?? ""} onChange={(value) => updateEvent(event.eventKey, { sourceUrl: value })} />
                </Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Title EN"><TextInput value={event.titleEn} onChange={(value) => updateEvent(event.eventKey, { titleEn: value })} /></Field>
                <Field label="Title ES"><TextInput value={event.titleEs} onChange={(value) => updateEvent(event.eventKey, { titleEs: value })} /></Field>
                <Field label="Title DE"><TextInput value={event.titleDe} onChange={(value) => updateEvent(event.eventKey, { titleDe: value })} /></Field>
                <Field label="Summary EN"><TextArea value={event.summaryEn} onChange={(value) => updateEvent(event.eventKey, { summaryEn: value })} /></Field>
                <Field label="Summary ES"><TextArea value={event.summaryEs} onChange={(value) => updateEvent(event.eventKey, { summaryEs: value })} /></Field>
                <Field label="Summary DE"><TextArea value={event.summaryDe} onChange={(value) => updateEvent(event.eventKey, { summaryDe: value })} /></Field>
                <Field label="Description EN"><TextArea value={event.descriptionEn} onChange={(value) => updateEvent(event.eventKey, { descriptionEn: value })} /></Field>
                <Field label="Description ES"><TextArea value={event.descriptionEs} onChange={(value) => updateEvent(event.eventKey, { descriptionEs: value })} /></Field>
                <Field label="Description DE"><TextArea value={event.descriptionDe} onChange={(value) => updateEvent(event.eventKey, { descriptionDe: value })} /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Time EN"><TextInput value={event.timeLabelEn} onChange={(value) => updateEvent(event.eventKey, { timeLabelEn: value })} /></Field>
                <Field label="Time ES"><TextInput value={event.timeLabelEs} onChange={(value) => updateEvent(event.eventKey, { timeLabelEs: value })} /></Field>
                <Field label="Time DE"><TextInput value={event.timeLabelDe} onChange={(value) => updateEvent(event.eventKey, { timeLabelDe: value })} /></Field>
                <Field label="Cost EN"><TextInput value={event.costLabelEn} onChange={(value) => updateEvent(event.eventKey, { costLabelEn: value })} /></Field>
                <Field label="Cost ES"><TextInput value={event.costLabelEs} onChange={(value) => updateEvent(event.eventKey, { costLabelEs: value })} /></Field>
                <Field label="Cost DE"><TextInput value={event.costLabelDe} onChange={(value) => updateEvent(event.eventKey, { costLabelDe: value })} /></Field>
                <Field label="Starts at ISO" optional><TextInput value={event.startsAt ?? ""} onChange={(value) => updateEvent(event.eventKey, { startsAt: value })} placeholder="2026-07-12T10:00:00.000Z" /></Field>
                <Field label="Ends at ISO" optional><TextInput value={event.endsAt ?? ""} onChange={(value) => updateEvent(event.eventKey, { endsAt: value })} placeholder="2026-07-12T11:00:00.000Z" /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Languages">
                  <TextInput value={listToText(event.languageCodes)} onChange={(value) => updateEvent(event.eventKey, { languageCodes: textToList(value) })} />
                </Field>
                <Field label="Tags">
                  <TextArea value={listToText(event.tags)} onChange={(value) => updateEvent(event.eventKey, { tags: textToList(value) })} />
                </Field>
                <Field label="Interest tags">
                  <TextArea value={listToText(event.interestTags)} onChange={(value) => updateEvent(event.eventKey, { interestTags: textToList(value) })} />
                </Field>
                <Field label="Accessibility tags">
                  <TextArea value={listToText(event.accessibilityTags)} onChange={(value) => updateEvent(event.eventKey, { accessibilityTags: textToList(value) })} />
                </Field>
                <Field label="Helper actions">
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
                <button
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white"
                  onClick={() => saveEvent(event).catch((err) => setMessage(err.message))}
                >
                  <Save size={17} />
                  Save event
                </button>
              </div>
            </article>
          ))}
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
