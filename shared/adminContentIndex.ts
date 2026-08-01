export const ADMIN_CONTENT_LANGUAGES = ["en", "es", "fr", "de", "it", "pt"] as const;

export type AdminContentLanguage = typeof ADMIN_CONTENT_LANGUAGES[number];
export type AdminContentType = "home_card" | "curated_activity" | "lesson" | "room_prompt";
export type AdminContentStatus = "published" | "draft" | "review" | "hidden" | "archived" | "mixed";
export type AdminContentRouteStatus = "ready" | "missing" | "invalid";

export type AdminContentSourceHealth = {
  type: AdminContentType;
  available: boolean;
  message: string | null;
};

export type AdminContentLanguageCoverage = {
  mode: "universal" | "localized";
  available: AdminContentLanguage[];
  expected: AdminContentLanguage[];
  missing: AdminContentLanguage[];
};

export type AdminContentIndexItem = {
  key: string;
  sourceId: string;
  type: AdminContentType;
  title: string;
  subtitle: string;
  status: AdminContentStatus;
  languageCoverage: AdminContentLanguageCoverage;
  missingContent: string[];
  route: string | null;
  routeStatus: AdminContentRouteStatus;
  editorUrl: string;
  updatedAt: string | null;
};

export type AdminContentIndexSummary = {
  total: number;
  published: number;
  needsAttention: number;
  routeIssues: number;
  languageGaps: number;
  unavailableSources: number;
  byType: Record<AdminContentType, number>;
};

export type AdminContentIndexResponse = {
  generatedAt: string;
  items: AdminContentIndexItem[];
  summary: AdminContentIndexSummary;
  sources: AdminContentSourceHealth[];
};

type HomeCardInput = {
  card_id: string;
  is_enabled: boolean;
  route: string;
  admin_notes?: string | null;
  updated_at?: Date | string | null;
};

type ActivityInput = {
  event_key: string;
  title_en: string;
  title_es: string;
  title_de: string;
  summary_en: string;
  summary_es: string;
  summary_de: string;
  description_en: string;
  description_es: string;
  description_de: string;
  format: string;
  location_label: string;
  starts_at?: Date | string | null;
  time_label_en: string;
  time_label_es: string;
  time_label_de: string;
  status: string;
  safety_status: string;
  updated_at?: Date | string | null;
};

type LessonInput = {
  id: string;
  externalId?: string | null;
  categorySlug: string;
  language: string;
  title: string;
  hook: string;
  body: string;
  reflectionPrompt: string;
  imageUrl?: string | null;
  status: string;
  isActive: boolean;
  updatedAt?: Date | string | null;
};

type RoomPromptInput = {
  id: string;
  slug: string;
  roomName: string;
  sessionDate: string;
  topicEn: string;
  topicEs: string;
  topicDe: string;
  openerEn: string;
  openerEs: string;
  openerDe: string;
  isLive: boolean;
  createdAt?: Date | string | null;
};

const LOCALIZED_SOURCE_LANGUAGES: AdminContentLanguage[] = ["en", "es", "de"];

function asIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function localizedCoverage(languages: AdminContentLanguage[]): AdminContentLanguageCoverage {
  const available = ADMIN_CONTENT_LANGUAGES.filter((language) => languages.includes(language));
  return {
    mode: "localized",
    available,
    expected: [...ADMIN_CONTENT_LANGUAGES],
    missing: ADMIN_CONTENT_LANGUAGES.filter((language) => !available.includes(language)),
  };
}

function universalCoverage(): AdminContentLanguageCoverage {
  return {
    mode: "universal",
    available: [...ADMIN_CONTENT_LANGUAGES],
    expected: [...ADMIN_CONTENT_LANGUAGES],
    missing: [],
  };
}

export function adminContentRouteStatus(route: string | null | undefined): AdminContentRouteStatus {
  const value = clean(route);
  if (!value || value === "/") return "missing";
  if (!value.startsWith("/") || value.startsWith("//")) return "invalid";
  return "ready";
}

function normalizeStatus(value: string, fallback: AdminContentStatus = "draft"): AdminContentStatus {
  if (value === "active" || value === "published") return "published";
  if (value === "draft" || value === "review" || value === "hidden" || value === "archived") return value;
  return fallback;
}

function missingLocalizedFields(input: Record<string, string>, fields: string[]) {
  return fields.filter((field) => !clean(input[field]));
}

export function buildHomeCardContentItems(rows: HomeCardInput[]): AdminContentIndexItem[] {
  return rows.map((row) => {
    const routeStatus = adminContentRouteStatus(row.route);
    return {
      key: `home_card:${row.card_id}`,
      sourceId: row.card_id,
      type: "home_card",
      title: humanize(row.card_id),
      subtitle: clean(row.admin_notes) || "Personalized Today card rule",
      status: row.is_enabled ? "published" : "hidden",
      languageCoverage: universalCoverage(),
      missingContent: routeStatus === "ready" ? [] : ["Destination route"],
      route: clean(row.route) || null,
      routeStatus,
      editorUrl: `/admin/home-cards?focus=${encodeURIComponent(row.card_id)}`,
      updatedAt: asIso(row.updated_at),
    };
  });
}

export function buildActivityContentItems(rows: ActivityInput[]): AdminContentIndexItem[] {
  return rows.map((row) => {
    const missingContent = missingLocalizedFields({
      "English title": row.title_en,
      "Spanish title": row.title_es,
      "German title": row.title_de,
      "English summary": row.summary_en,
      "Spanish summary": row.summary_es,
      "German summary": row.summary_de,
      "English description": row.description_en,
      "Spanish description": row.description_es,
      "German description": row.description_de,
    }, [
      "English title",
      "Spanish title",
      "German title",
      "English summary",
      "Spanish summary",
      "German summary",
      "English description",
      "Spanish description",
      "German description",
    ]);
    if (row.format !== "online" && !clean(row.location_label)) missingContent.push("Location");
    if (!row.starts_at && ![row.time_label_en, row.time_label_es, row.time_label_de].some(clean)) missingContent.push("Time");
    if (row.safety_status !== "approved") missingContent.push("Safety approval");

    return {
      key: `curated_activity:${row.event_key}`,
      sourceId: row.event_key,
      type: "curated_activity",
      title: clean(row.title_en) || humanize(row.event_key),
      subtitle: clean(row.summary_en) || `${humanize(row.format)} activity`,
      status: normalizeStatus(row.status),
      languageCoverage: localizedCoverage(LOCALIZED_SOURCE_LANGUAGES.filter((language) => {
        if (language === "en") return Boolean(clean(row.title_en) && clean(row.summary_en) && clean(row.description_en));
        if (language === "es") return Boolean(clean(row.title_es) && clean(row.summary_es) && clean(row.description_es));
        return Boolean(clean(row.title_de) && clean(row.summary_de) && clean(row.description_de));
      })),
      missingContent,
      route: "/social-rooms/activities",
      routeStatus: "ready",
      editorUrl: `/admin/curated-activities?focus=${encodeURIComponent(row.event_key)}`,
      updatedAt: asIso(row.updated_at),
    };
  });
}

function lessonFamilyId(row: LessonInput) {
  const externalId = clean(row.externalId);
  if (!externalId) return row.id;
  return externalId.replace(/[-_](en|es|fr|de|it|pt)$/i, "") || externalId;
}

function normalizedLanguage(value: string): AdminContentLanguage | null {
  const language = value.toLowerCase().split(/[-_]/)[0] as AdminContentLanguage;
  return ADMIN_CONTENT_LANGUAGES.includes(language) ? language : null;
}

export function buildLessonContentItems(rows: LessonInput[]): AdminContentIndexItem[] {
  const families = new Map<string, LessonInput[]>();
  rows.forEach((row) => {
    const familyId = lessonFamilyId(row);
    families.set(familyId, [...(families.get(familyId) ?? []), row]);
  });

  return Array.from(families.entries()).map(([familyId, lessons]) => {
    const sorted = [...lessons].sort((a, b) => {
      const aLanguage = normalizedLanguage(a.language);
      const bLanguage = normalizedLanguage(b.language);
      return ADMIN_CONTENT_LANGUAGES.indexOf(aLanguage ?? "en") - ADMIN_CONTENT_LANGUAGES.indexOf(bLanguage ?? "en");
    });
    const primary = sorted.find((lesson) => normalizedLanguage(lesson.language) === "en") ?? sorted[0];
    const available = sorted
      .map((lesson) => normalizedLanguage(lesson.language))
      .filter((language): language is AdminContentLanguage => Boolean(language));
    const statuses = new Set(sorted.map((lesson) => normalizeStatus(lesson.status)));
    const status: AdminContentStatus = statuses.size === 1 ? [...statuses][0] : "mixed";
    const missingContent: string[] = [];

    sorted.forEach((lesson) => {
      const language = normalizedLanguage(lesson.language)?.toUpperCase() ?? lesson.language.toUpperCase();
      if (!clean(lesson.title)) missingContent.push(`${language} title`);
      if (!clean(lesson.hook)) missingContent.push(`${language} hook`);
      if (!clean(lesson.body)) missingContent.push(`${language} body`);
      if (!clean(lesson.reflectionPrompt)) missingContent.push(`${language} reflection prompt`);
      if (lesson.status === "published" && !clean(lesson.imageUrl)) missingContent.push(`${language} visual`);
    });

    const newest = sorted
      .map((lesson) => asIso(lesson.updatedAt))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    return {
      key: `lesson:${familyId}`,
      sourceId: familyId,
      type: "lesson",
      title: clean(primary.title) || humanize(familyId),
      subtitle: `${humanize(primary.categorySlug)} lesson family`,
      status,
      languageCoverage: localizedCoverage(available),
      missingContent: [...new Set(missingContent)],
      route: "/learn",
      routeStatus: "ready",
      editorUrl: `/admin/learning-library?focus=${encodeURIComponent(primary.id)}`,
      updatedAt: newest,
    };
  });
}

export function buildRoomPromptContentItems(rows: RoomPromptInput[]): AdminContentIndexItem[] {
  return rows.map((row) => {
    const languageCoverage = localizedCoverage(LOCALIZED_SOURCE_LANGUAGES.filter((language) => {
      if (language === "en") return Boolean(clean(row.topicEn) && clean(row.openerEn));
      if (language === "es") return Boolean(clean(row.topicEs) && clean(row.openerEs));
      return Boolean(clean(row.topicDe) && clean(row.openerDe));
    }));
    const missingContent = missingLocalizedFields({
      "English topic": row.topicEn,
      "Spanish topic": row.topicEs,
      "German topic": row.topicDe,
      "English opener": row.openerEn,
      "Spanish opener": row.openerEs,
      "German opener": row.openerDe,
    }, ["English topic", "Spanish topic", "German topic", "English opener", "Spanish opener", "German opener"]);

    return {
      key: `room_prompt:${row.id}`,
      sourceId: row.id,
      type: "room_prompt",
      title: clean(row.topicEn) || `${row.roomName} prompt`,
      subtitle: `${row.roomName} - ${row.sessionDate}`,
      status: row.isLive ? "published" : "hidden",
      languageCoverage,
      missingContent,
      route: `/social-rooms/${row.slug}`,
      routeStatus: adminContentRouteStatus(`/social-rooms/${row.slug}`),
      editorUrl: `/admin/room-prompts?focus=${encodeURIComponent(row.id)}`,
      updatedAt: asIso(row.createdAt),
    };
  });
}

export function summarizeAdminContentIndex(
  items: AdminContentIndexItem[],
  sources: AdminContentSourceHealth[],
): AdminContentIndexSummary {
  const byType: Record<AdminContentType, number> = {
    home_card: 0,
    curated_activity: 0,
    lesson: 0,
    room_prompt: 0,
  };
  items.forEach((item) => { byType[item.type] += 1; });

  return {
    total: items.length,
    published: items.filter((item) => item.status === "published").length,
    needsAttention: items.filter((item) => (
      item.missingContent.length > 0 || item.languageCoverage.missing.length > 0 || item.routeStatus !== "ready"
    )).length,
    routeIssues: items.filter((item) => item.routeStatus !== "ready").length,
    languageGaps: items.filter((item) => item.languageCoverage.missing.length > 0).length,
    unavailableSources: sources.filter((source) => !source.available).length,
    byType,
  };
}
