import { randomUUID } from "crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../db.js";
import {
  companionProfiles,
  participationEventChecks,
  participationEventResponses,
  participationEvents,
  participationNotifications,
  profiles,
  socialUserInterests,
} from "../../shared/schema.js";
import type {
  AdminParticipationEvent,
  ParticipationEvent,
  ParticipationEventFormat,
  ParticipationEventRecommendation,
  ParticipationEventResponse,
  ParticipationEventResponseAction,
  ParticipationEventResponseCounts,
  ParticipationEventResponseValue,
  ParticipationFitReason,
  ParticipationHelperAction,
  ParticipationNotification,
  ParticipationPulse,
  SocialLanguage,
} from "../../src/social/types.js";

type LocalizedText = Record<SocialLanguage, string>;
type EventRow = typeof participationEvents.$inferSelect;
type EventInsert = typeof participationEvents.$inferInsert;
type EventUpdate = Partial<typeof participationEvents.$inferInsert>;
type EventResponseRow = typeof participationEventResponses.$inferSelect;
type EventCheckRow = typeof participationEventChecks.$inferSelect;
type EventNotificationRow = typeof participationNotifications.$inferSelect;

type ParticipationSignals = {
  interests: string[];
  preferredTimes: string[];
  city: string;
  region: string;
  countryCode: string;
  language: SocialLanguage;
  languageLabel: string;
  activityLevel: "low" | "moderate" | "active";
  lastRooms: string[];
  needsProfileNudge: boolean;
};

type ParticipationHints = {
  interests?: string[];
  city?: string;
  region?: string;
  countryCode?: string;
  preferredTimes?: string[];
};

type AdminEventInput = {
  eventKey: string;
  titleEs: string;
  titleDe: string;
  titleEn: string;
  summaryEs?: string;
  summaryDe?: string;
  summaryEn?: string;
  descriptionEs?: string;
  descriptionDe?: string;
  descriptionEn?: string;
  format?: ParticipationEventFormat;
  locationLabel?: string;
  city?: string | null;
  countryCode?: string | null;
  timeLabelEs?: string;
  timeLabelDe?: string;
  timeLabelEn?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  costLabelEs?: string;
  costLabelDe?: string;
  costLabelEn?: string;
  languageCodes?: string[];
  tags?: string[];
  interestTags?: string[];
  accessibilityTags?: string[];
  helperActions?: ParticipationHelperAction[];
  source?: string;
  sourceUrl?: string | null;
  status?: "active" | "draft" | "hidden" | "archived";
  isCurated?: boolean;
  needsLiveCheck?: boolean;
  safetyStatus?: "approved" | "needs_review" | "hidden";
  metadata?: Record<string, unknown>;
};

type AdminEventPatch = Partial<Omit<AdminEventInput, "eventKey">>;

type MemoryCheck = {
  id: string;
  eventKey: string;
  userId: string;
  status: "requested" | "checking" | "checked";
  requestNote: string;
  helperActions: ParticipationHelperAction[];
  conciergePrefill: Record<string, unknown>;
  createdAt: string;
};

const SAFE_DB_TIMEOUT_MS = 1400;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_LANGUAGES: SocialLanguage[] = ["es", "de", "en"];
const RESPONSE_VALUES: ParticipationEventResponseValue[] = ["interested", "maybe", "not_for_me"];
const DEFAULT_COUNTRY = "ES";

const t = (es: string, en: string, de: string): LocalizedText => ({ es, en, de });

const seedEvents: EventRow[] = [
  seedEvent({
    eventKey: "gentle-choir-table",
    title: t("Mesa de canciones conocidas", "Familiar songs table", "Tisch mit vertrauten Liedern"),
    summary: t(
      "Un encuentro pequeno para escuchar, tararear o compartir una cancion querida.",
      "A small gathering to listen, hum along, or share a song you love.",
      "Ein kleines Treffen zum Zuhoeren, Mitsummen oder Teilen eines Lieblingslieds.",
    ),
    description: t(
      "VYVA confirmara el horario, el ritmo tranquilo y si conviene hacerlo online o cerca.",
      "VYVA will check the time, gentle pace, and whether nearby or online is best.",
      "VYVA prueft Zeit, ruhiges Tempo und ob nah oder online besser passt.",
    ),
    format: "hybrid",
    locationLabel: "Nearby or online",
    timeLabel: t("Esta semana, hora por confirmar", "This week, time to be checked", "Diese Woche, Zeit wird geprueft"),
    costLabel: t("Gratis o bajo coste", "Free or low cost", "Kostenlos oder guenstig"),
    tags: ["music", "singing", "social", "memories"],
    interestTags: ["music", "singing", "choir", "memories"],
    accessibilityTags: ["seating", "quiet_pace", "easy_access"],
    helperActions: ["check_details", "reminder", "bring_friend"],
  }),
  seedEvent({
    eventKey: "accessible-garden-walk",
    title: t("Paseo de jardin con pausas", "Garden walk with pauses", "Gartenrunde mit Pausen"),
    summary: t(
      "Una salida corta para ver plantas, sentarse cuando haga falta y volver sin prisa.",
      "A short outing to enjoy plants, sit when needed, and return without rushing.",
      "Ein kurzer Ausflug zu Pflanzen, mit Sitzpausen und ohne Eile.",
    ),
    description: t(
      "VYVA comprobara acceso, bancos, transporte y clima antes de sugerir un paso real.",
      "VYVA checks access, benches, transport, and weather before suggesting a real next step.",
      "VYVA prueft Zugang, Sitzplaetze, Transport und Wetter vor dem naechsten Schritt.",
    ),
    format: "nearby",
    locationLabel: "Nearby green space",
    timeLabel: t("Manana o tarde suave", "Morning or gentle afternoon", "Vormittag oder ruhiger Nachmittag"),
    costLabel: t("Gratis", "Free", "Kostenlos"),
    tags: ["walking", "gardening", "nature", "outdoors"],
    interestTags: ["walking", "gardening", "nature", "plants", "bird watching"],
    accessibilityTags: ["easy_access", "seating", "transport_help", "quiet_pace"],
    helperActions: ["check_details", "transport", "bring_friend"],
  }),
  seedEvent({
    eventKey: "book-club-taster",
    title: t("Prueba de club de lectura", "Book club taster", "Literaturclub zum Ausprobieren"),
    summary: t(
      "Una sesion ligera para escuchar recomendaciones y compartir una lectura favorita.",
      "A light session to hear recommendations and share a favourite read.",
      "Eine leichte Runde fuer Empfehlungen und ein Lieblingsbuch.",
    ),
    description: t(
      "Puedes escuchar primero. VYVA comprobara idioma, tamano del grupo y ritmo.",
      "You can listen first. VYVA checks language, group size, and pace.",
      "Du kannst erst zuhoeren. VYVA prueft Sprache, Gruppengroesse und Tempo.",
    ),
    format: "online",
    locationLabel: "Online room",
    timeLabel: t("Tarde tranquila", "Quiet afternoon", "Ruhiger Nachmittag"),
    costLabel: t("Gratis", "Free", "Kostenlos"),
    tags: ["reading", "book club", "stories", "conversation"],
    interestTags: ["reading", "book club", "writing", "poetry", "local history"],
    accessibilityTags: ["listen_first", "quiet_pace"],
    helperActions: ["check_details", "reminder"],
  }),
  seedEvent({
    eventKey: "friendly-tech-class",
    title: t("Clase amable de tecnologia", "Friendly technology class", "Freundlicher Technikkurs"),
    summary: t(
      "Ayuda tranquila para practicar movil, mensajes, fotos o videollamadas.",
      "Gentle help practising phone, messages, photos, or video calls.",
      "Ruhige Hilfe fuer Handy, Nachrichten, Fotos oder Videoanrufe.",
    ),
    description: t(
      "VYVA comprobara que no haya compras, presion ni intercambio privado de datos.",
      "VYVA checks there is no buying pressure or private data sharing.",
      "VYVA prueft, dass es keinen Kaufdruck und keine privaten Datenabfragen gibt.",
    ),
    format: "nearby",
    locationLabel: "Nearby class",
    timeLabel: t("Horario diurno", "Daytime", "Tagsueber"),
    costLabel: t("Gratis o bajo coste", "Free or low cost", "Kostenlos oder guenstig"),
    tags: ["learning", "technology", "computers", "help"],
    interestTags: ["computers", "tech", "learning", "online courses"],
    accessibilityTags: ["easy_access", "seating", "clear_cost"],
    helperActions: ["check_details", "transport", "reminder"],
  }),
  seedEvent({
    eventKey: "gentle-movement-circle",
    title: t("Movimiento suave en grupo", "Gentle movement circle", "Sanfte Bewegungsrunde"),
    summary: t(
      "Estiramientos y equilibrio a ritmo tranquilo, con opcion de hacerlo sentado.",
      "Light stretching and balance at a calm pace, with seated options.",
      "Leichte Dehn- und Gleichgewichtsuebungen in ruhigem Tempo, auch im Sitzen.",
    ),
    description: t(
      "VYVA comprobara acceso, intensidad, descansos y si conviene ir acompanado.",
      "VYVA checks access, intensity, rest breaks, and whether a companion would help.",
      "VYVA prueft Zugang, Intensitaet, Pausen und ob Begleitung sinnvoll ist.",
    ),
    format: "nearby",
    locationLabel: "Nearby community space",
    timeLabel: t("Manana tranquila", "Gentle morning", "Ruhiger Vormittag"),
    costLabel: t("Gratis o bajo coste", "Free or low cost", "Kostenlos oder guenstig"),
    tags: ["movement", "stretching", "balance", "wellbeing"],
    interestTags: ["walking", "movement", "exercise", "wellbeing", "yoga", "balance"],
    accessibilityTags: ["seated_option", "quiet_pace", "easy_access", "seating"],
    helperActions: ["check_details", "transport", "reminder"],
  }),
  seedEvent({
    eventKey: "recipe-memory-kitchen",
    title: t("Mesa de recetas y recuerdos", "Recipe memory table", "Rezepte-und-Erinnerungen-Tisch"),
    summary: t(
      "Una charla sencilla para compartir una receta familiar o escuchar ideas de cocina.",
      "A simple conversation to share a family recipe or hear cooking ideas.",
      "Ein einfaches Gespraech ueber Familienrezepte und Kochideen.",
    ),
    description: t(
      "VYVA comprobara alergias, coste, formato y si hay una opcion online.",
      "VYVA checks allergies, cost, format, and whether there is an online option.",
      "VYVA prueft Allergien, Kosten, Format und ob es eine Online-Option gibt.",
    ),
    format: "hybrid",
    locationLabel: "Nearby or online",
    timeLabel: t("Tarde tranquila", "Quiet afternoon", "Ruhiger Nachmittag"),
    costLabel: t("Gratis o bajo coste", "Free or low cost", "Kostenlos oder guenstig"),
    tags: ["cooking", "recipes", "memories", "conversation"],
    interestTags: ["cooking", "recipes", "food", "baking", "family memories"],
    accessibilityTags: ["listen_first", "seating", "clear_cost"],
    helperActions: ["check_details", "reminder", "bring_friend"],
  }),
  seedEvent({
    eventKey: "quiet-craft-studio",
    title: t("Taller tranquilo de arte y manualidades", "Quiet art and craft studio", "Ruhiges Kunst- und Bastelatelier"),
    summary: t(
      "Una sesion amable para pintar, hacer manualidades o mirar mientras otros crean.",
      "A gentle session to paint, craft, or simply watch others create.",
      "Eine freundliche Runde zum Malen, Basteln oder Zuschauen.",
    ),
    description: t(
      "VYVA comprobara materiales, coste, ruido y acceso antes de sugerir un paso.",
      "VYVA checks materials, cost, noise level, and access before suggesting a next step.",
      "VYVA prueft Material, Kosten, Lautstaerke und Zugang vor dem naechsten Schritt.",
    ),
    format: "nearby",
    locationLabel: "Local studio or library",
    timeLabel: t("Media manana o tarde", "Late morning or afternoon", "Spaeter Vormittag oder Nachmittag"),
    costLabel: t("Materiales comprobados", "Materials checked", "Materialien werden geprueft"),
    tags: ["art", "craft", "painting", "creativity"],
    interestTags: ["art", "craft", "painting", "drawing", "knitting", "creativity"],
    accessibilityTags: ["seating", "quiet_pace", "easy_access", "clear_cost"],
    helperActions: ["check_details", "transport", "bring_friend"],
  }),
  seedEvent({
    eventKey: "language-culture-cafe",
    title: t("Cafe de idioma y cultura", "Language and culture cafe", "Sprach- und Kulturcafe"),
    summary: t(
      "Una conversacion ligera para practicar palabras, cultura y pequenas historias.",
      "A light conversation to practise words, culture, and small stories.",
      "Ein leichtes Gespraech ueber Woerter, Kultur und kleine Geschichten.",
    ),
    description: t(
      "Puedes escuchar primero. VYVA comprobara idioma, grupo y ritmo.",
      "You can listen first. VYVA checks language, group size, and pace.",
      "Du kannst erst zuhoeren. VYVA prueft Sprache, Gruppengroesse und Tempo.",
    ),
    format: "online",
    locationLabel: "Online or community room",
    timeLabel: t("Tarde tranquila", "Quiet afternoon", "Ruhiger Nachmittag"),
    costLabel: t("Gratis", "Free", "Kostenlos"),
    tags: ["language", "culture", "learning", "conversation"],
    interestTags: ["language", "culture", "travel", "learning", "conversation"],
    accessibilityTags: ["listen_first", "quiet_pace"],
    helperActions: ["check_details", "reminder"],
  }),
  seedEvent({
    eventKey: "local-history-stories",
    title: t("Historias del barrio", "Local history stories", "Geschichten aus der Umgebung"),
    summary: t(
      "Un encuentro para escuchar recuerdos, fotos antiguas e historias del lugar.",
      "A gathering for memories, old photos, and stories from the local area.",
      "Ein Treffen mit Erinnerungen, alten Fotos und Geschichten aus der Umgebung.",
    ),
    description: t(
      "VYVA comprobara acceso, tamano del grupo y transporte antes de proponerlo.",
      "VYVA checks access, group size, and transport before suggesting it.",
      "VYVA prueft Zugang, Gruppengroesse und Transport vor einem Vorschlag.",
    ),
    format: "nearby",
    locationLabel: "Local library or museum",
    timeLabel: t("Horario diurno", "Daytime", "Tagsueber"),
    costLabel: t("Gratis o bajo coste", "Free or low cost", "Kostenlos oder guenstig"),
    tags: ["history", "local history", "stories", "memories"],
    interestTags: ["history", "local history", "stories", "photography", "memories"],
    accessibilityTags: ["easy_access", "seating", "transport_help", "quiet_pace"],
    helperActions: ["check_details", "transport", "bring_friend"],
  }),
];

const memoryEvents = new Map<string, EventRow>();
const memoryResponses = new Map<string, ParticipationEventResponseValue>();
const memoryChecks: MemoryCheck[] = [];
const memoryNotifications: ParticipationNotification[] = [];

function seedEvent(input: {
  eventKey: string;
  title: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  format: ParticipationEventFormat;
  locationLabel: string;
  timeLabel: LocalizedText;
  costLabel: LocalizedText;
  tags: string[];
  interestTags: string[];
  accessibilityTags: string[];
  helperActions: ParticipationHelperAction[];
}): EventRow {
  const now = new Date(0);
  return {
    id: input.eventKey,
    event_key: input.eventKey,
    title_es: input.title.es,
    title_de: input.title.de,
    title_en: input.title.en,
    summary_es: input.summary.es,
    summary_de: input.summary.de,
    summary_en: input.summary.en,
    description_es: input.description.es,
    description_de: input.description.de,
    description_en: input.description.en,
    format: input.format,
    location_label: input.locationLabel,
    city: null,
    country_code: DEFAULT_COUNTRY,
    time_label_es: input.timeLabel.es,
    time_label_de: input.timeLabel.de,
    time_label_en: input.timeLabel.en,
    starts_at: null,
    ends_at: null,
    cost_label_es: input.costLabel.es,
    cost_label_de: input.costLabel.de,
    cost_label_en: input.costLabel.en,
    language_codes: ["es", "de", "en"],
    tags: input.tags,
    interest_tags: input.interestTags,
    accessibility_tags: input.accessibilityTags,
    helper_actions: input.helperActions,
    source: "curated",
    source_url: null,
    status: "active",
    is_curated: true,
    needs_live_check: true,
    safety_status: "approved",
    metadata: {},
    created_by: null,
    created_at: now,
    updated_at: now,
  };
}

async function safeDb<T>(label: string, action: () => Promise<T>, fallback: () => Promise<T> | T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeout = new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        Promise.resolve(fallback()).then(resolve, reject);
      }, SAFE_DB_TIMEOUT_MS);
    });
    return await Promise.race([action(), timeout]);
  } catch (error) {
    console.warn(`[participation] ${label} fallback`, error);
    return await fallback();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function normalizeLanguage(raw?: string | null): SocialLanguage {
  const base = String(raw ?? "").split("-")[0]?.toLowerCase();
  return SUPPORTED_LANGUAGES.includes(base as SocialLanguage) ? base as SocialLanguage : "en";
}

function languageLabel(language: SocialLanguage) {
  if (language === "es") return "Espanol";
  if (language === "de") return "Deutsch";
  return "English";
}

function compactStrings(values: unknown[]): string[] {
  return Array.from(new Set(values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)));
}

function normalizeForMatch(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function localize(row: EventRow, field: "title" | "summary" | "description" | "time_label" | "cost_label", language: SocialLanguage) {
  const key = `${field}_${language}` as keyof EventRow;
  const fallback = `${field}_en` as keyof EventRow;
  return String(row[key] || row[fallback] || "");
}

function normalizeFormat(value: string): ParticipationEventFormat {
  if (value === "online" || value === "hybrid") return value;
  return "nearby";
}

function normalizeHelperActions(values: string[] | null | undefined): ParticipationHelperAction[] {
  const allowed = new Set<ParticipationHelperAction>(["check_details", "transport", "reminder", "bring_friend"]);
  return compactStrings(values ?? []).filter((value): value is ParticipationHelperAction => allowed.has(value as ParticipationHelperAction));
}

function responseCountsForEvent(event: Pick<EventRow, "id" | "event_key">, rows: EventResponseRow[]): ParticipationEventResponseCounts {
  const counts: ParticipationEventResponseCounts = { interested: 0, maybe: 0, not_for_me: 0 };
  for (const row of rows) {
    if (row.event_id !== event.id) continue;
    if (RESPONSE_VALUES.includes(row.response as ParticipationEventResponseValue)) {
      counts[row.response as ParticipationEventResponseValue] += 1;
    }
  }
  for (const [key, response] of memoryResponses.entries()) {
    if (!key.endsWith(`:${event.event_key}`)) continue;
    counts[response] += 1;
  }
  return counts;
}

function memoryResponseKey(userId: string, eventKey: string) {
  return `${userId}:${eventKey}`;
}

function dbResponseForEvent(eventId: string, userId: string, rows: EventResponseRow[]) {
  return rows.find((row) => row.user_id === userId && row.event_id === eventId)?.response as ParticipationEventResponseValue | undefined;
}

function memoryResponseForEvent(eventKey: string, userId: string) {
  return memoryResponses.get(memoryResponseKey(userId, eventKey)) ?? null;
}

function checkStatusForEvent(event: EventRow, userId: string, checks: EventCheckRow[]) {
  const dbCheck = checks.find((check) => check.event_id === event.id && check.user_id === userId);
  if (dbCheck?.status) return dbCheck.status;
  return memoryChecks.find((check) => check.eventKey === event.event_key && check.userId === userId)?.status ?? "none";
}

function checkRequestCountForEvent(event: EventRow, checks: EventCheckRow[]) {
  const dbCount = checks.filter((check) => check.event_id === event.id).length;
  const memoryCount = memoryChecks.filter((check) => check.eventKey === event.event_key).length;
  return dbCount + memoryCount;
}

function fitCopy(language: SocialLanguage) {
  if (language === "es") {
    return {
      interest: (value: string) => `Coincide con ${value}`,
      location: (value: string) => `Cerca de ${value}`,
      online: "Tambien puede hacerse online",
      access: "Comodidad y acceso incluidos",
      language: "Disponible en tu idioma",
      social: "Encaja con tu actividad social reciente",
      safety: "VYVA comprueba detalles antes de comprometerte",
    };
  }
  if (language === "de") {
    return {
      interest: (value: string) => `Passt zu ${value}`,
      location: (value: string) => `In der Naehe von ${value}`,
      online: "Auch online moeglich",
      access: "Komfort und Zugang bedacht",
      language: "In deiner Sprache verfuegbar",
      social: "Passt zu deiner letzten sozialen Aktivitaet",
      safety: "VYVA prueft Details vor einer Zusage",
    };
  }
  return {
    interest: (value: string) => `Matches ${value}`,
    location: (value: string) => `Near ${value}`,
    online: "Can also be online",
    access: "Comfort and access included",
    language: "Available in your language",
    social: "Fits your recent social activity",
    safety: "VYVA checks details before you commit",
  };
}

export function rankParticipationEvents(input: {
  events: EventRow[];
  signals: ParticipationSignals;
  responses: EventResponseRow[];
  checks: EventCheckRow[];
  language: SocialLanguage;
  userId: string;
}): ParticipationEventRecommendation[] {
  const copy = fitCopy(input.language);
  const normalizedInterests = input.signals.interests.map(normalizeForMatch);
  const normalizedTimes = input.signals.preferredTimes.map(normalizeForMatch);
  const normalizedLastRooms = input.signals.lastRooms.map(normalizeForMatch);

  return input.events
    .filter((event) => event.status === "active" && event.safety_status === "approved")
    .map((event) => {
      let score = 40;
      const fitReasons: ParticipationFitReason[] = [];
      const eventTags = [...(event.tags ?? []), ...(event.interest_tags ?? [])];
      const normalizedTags = eventTags.map(normalizeForMatch);
      const matchedInterest = input.signals.interests.find((interest) => {
        const normalized = normalizeForMatch(interest);
        return normalizedTags.some((tag) => tag.includes(normalized) || normalized.includes(tag));
      });

      if (matchedInterest) {
        score += 34;
        fitReasons.push({ id: "interest", kind: "interest", label: copy.interest(matchedInterest) });
      }

      if (event.format === "online" || event.format === "hybrid") {
        score += 8;
        fitReasons.push({ id: "online", kind: "location", label: copy.online });
      } else if (input.signals.city && (!event.city || normalizeForMatch(event.city) === normalizeForMatch(input.signals.city))) {
        score += 14;
        fitReasons.push({ id: "location", kind: "location", label: copy.location(input.signals.city) });
      } else if (input.signals.countryCode && (!event.country_code || event.country_code === input.signals.countryCode)) {
        score += 8;
      }

      const timeHit = normalizedTimes.some((time) => normalizeForMatch(localize(event, "time_label", input.language)).includes(time));
      if (timeHit) score += 8;

      if ((event.accessibility_tags ?? []).length > 0) {
        score += 8;
        fitReasons.push({ id: "access", kind: "access", label: copy.access });
      }

      if ((event.language_codes ?? []).includes(input.language)) {
        score += 6;
        fitReasons.push({ id: "language", kind: "language", label: copy.language });
      }

      if (normalizedLastRooms.some((room) => normalizedTags.some((tag) => room.includes(tag) || tag.includes(room)))) {
        score += 6;
        fitReasons.push({ id: "social", kind: "social", label: copy.social });
      }

      if (event.needs_live_check) {
        fitReasons.push({ id: "safety", kind: "safety", label: copy.safety });
      }

      const responseCounts = responseCountsForEvent(event, input.responses);
      const myResponse = dbResponseForEvent(event.id, input.userId, input.responses) ?? memoryResponseForEvent(event.event_key, input.userId);
      if (myResponse === "interested") score += 12;
      if (myResponse === "maybe") score += 4;
      if (myResponse === "not_for_me") score -= 90;

      return {
        ...eventToParticipationEvent(event, input.language, {
          responseCounts,
          myResponse,
          fitReasons: fitReasons.slice(0, 4),
          checkStatus: checkStatusForEvent(event, input.userId, input.checks),
        }),
        score,
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function eventToParticipationEvent(
  row: EventRow,
  language: SocialLanguage,
  extra: {
    responseCounts: ParticipationEventResponseCounts;
    myResponse?: ParticipationEventResponseValue | null;
    fitReasons?: ParticipationFitReason[];
    checkStatus?: string;
  },
): ParticipationEvent {
  return {
    id: row.event_key,
    eventKey: row.event_key,
    title: localize(row, "title", language),
    summary: localize(row, "summary", language),
    description: localize(row, "description", language),
    format: normalizeFormat(row.format),
    locationLabel: row.location_label,
    city: row.city,
    countryCode: row.country_code,
    timeLabel: localize(row, "time_label", language),
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    costLabel: localize(row, "cost_label", language),
    languageCodes: row.language_codes ?? [],
    tags: row.tags ?? [],
    interestTags: row.interest_tags ?? [],
    accessibilityTags: row.accessibility_tags ?? [],
    helperActions: normalizeHelperActions(row.helper_actions),
    source: row.source,
    sourceUrl: row.source_url,
    status: row.status,
    isCurated: row.is_curated,
    needsLiveCheck: row.needs_live_check,
    safetyStatus: row.safety_status,
    responseCounts: extra.responseCounts,
    myResponse: extra.myResponse ?? null,
    fitReasons: extra.fitReasons ?? [],
    checkStatus: extra.checkStatus ?? "none",
  };
}

function eventToAdminParticipationEvent(
  row: EventRow,
  extra: {
    responseCounts: ParticipationEventResponseCounts;
    checkRequestCount: number;
  },
): AdminParticipationEvent {
  return {
    id: row.event_key,
    eventKey: row.event_key,
    titleEs: row.title_es,
    titleDe: row.title_de,
    titleEn: row.title_en,
    summaryEs: row.summary_es,
    summaryDe: row.summary_de,
    summaryEn: row.summary_en,
    descriptionEs: row.description_es,
    descriptionDe: row.description_de,
    descriptionEn: row.description_en,
    format: normalizeFormat(row.format),
    locationLabel: row.location_label,
    city: row.city,
    countryCode: row.country_code,
    timeLabelEs: row.time_label_es,
    timeLabelDe: row.time_label_de,
    timeLabelEn: row.time_label_en,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    costLabelEs: row.cost_label_es,
    costLabelDe: row.cost_label_de,
    costLabelEn: row.cost_label_en,
    languageCodes: row.language_codes ?? [],
    tags: row.tags ?? [],
    interestTags: row.interest_tags ?? [],
    accessibilityTags: row.accessibility_tags ?? [],
    helperActions: normalizeHelperActions(row.helper_actions),
    source: row.source,
    sourceUrl: row.source_url,
    status: row.status,
    isCurated: row.is_curated,
    needsLiveCheck: row.needs_live_check,
    safetyStatus: row.safety_status,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
    responseCounts: extra.responseCounts,
    checkRequestCount: extra.checkRequestCount,
  };
}

function defaultSignals(userId: string, language: SocialLanguage, hints: ParticipationHints = {}): ParticipationSignals {
  const interests = compactStrings(hints.interests ?? []);
  return {
    interests,
    preferredTimes: compactStrings(hints.preferredTimes ?? []),
    city: hints.city?.trim() ?? "",
    region: hints.region?.trim() ?? "",
    countryCode: (hints.countryCode?.trim().toUpperCase() || DEFAULT_COUNTRY),
    language,
    languageLabel: languageLabel(language),
    activityLevel: "moderate",
    lastRooms: [],
    needsProfileNudge: interests.length === 0,
  };
}

function hobbiesFromConsent(consent: unknown): string[] {
  if (!consent || typeof consent !== "object") return [];
  const hobbies = (consent as { hobbies?: { hobbies?: unknown; personality?: Record<string, string> } }).hobbies;
  const hobbyValues = Array.isArray(hobbies?.hobbies) ? hobbies.hobbies : [];
  const personalityValues = hobbies?.personality ? Object.values(hobbies.personality) : [];
  return compactStrings([...hobbyValues, ...personalityValues]);
}

async function loadSignals(userId: string, language: SocialLanguage, hints: ParticipationHints = {}): Promise<ParticipationSignals> {
  return safeDb(
    "load participation signals",
    async () => {
      const [profileRow] = await db
        .select({
          language: profiles.language,
          languagePreference: profiles.language_preference,
          city: profiles.city,
          region: profiles.region,
          countryCode: profiles.country_code,
          timezone: profiles.timezone,
          consent: profiles.data_sharing_consent,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      const [socialRow] = await db
        .select()
        .from(socialUserInterests)
        .where(eq(socialUserInterests.user_id, userId))
        .limit(1);

      const [companionRow] = await db
        .select({
          interests: companionProfiles.interests,
          hobbies: companionProfiles.hobbies,
          preferredActivities: companionProfiles.preferred_activities,
        })
        .from(companionProfiles)
        .where(eq(companionProfiles.user_id, userId))
        .limit(1);

      const resolvedLanguage = normalizeLanguage(profileRow?.languagePreference ?? profileRow?.language ?? language);
      const interests = compactStrings([
        ...(hints.interests ?? []),
        ...(socialRow?.interest_tags ?? []),
        ...(companionRow?.interests ?? []),
        ...(companionRow?.hobbies ?? []),
        ...(companionRow?.preferredActivities ?? []),
        ...hobbiesFromConsent(profileRow?.consent),
      ]);

      return {
        interests,
        preferredTimes: compactStrings([...(hints.preferredTimes ?? []), ...(socialRow?.preferred_times ?? [])]),
        city: hints.city?.trim() || profileRow?.city?.trim() || "",
        region: hints.region?.trim() || profileRow?.region?.trim() || "",
        countryCode: hints.countryCode?.trim().toUpperCase() || profileRow?.countryCode?.trim().toUpperCase() || DEFAULT_COUNTRY,
        language: resolvedLanguage,
        languageLabel: languageLabel(resolvedLanguage),
        activityLevel: (socialRow?.activity_level as ParticipationSignals["activityLevel"] | undefined) ?? "moderate",
        lastRooms: socialRow?.last_rooms ?? [],
        needsProfileNudge: interests.length === 0,
      };
    },
    () => defaultSignals(userId, language, hints),
  );
}

async function loadEvents(): Promise<EventRow[]> {
  return safeDb(
    "load participation events",
    async () => {
      const rows = await db
        .select()
        .from(participationEvents)
        .where(or(eq(participationEvents.status, "active"), eq(participationEvents.status, "draft")))
        .orderBy(desc(participationEvents.updated_at))
        .limit(80);
      return rows.length > 0 ? rows : [...seedEvents, ...memoryEvents.values()];
    },
    () => [...seedEvents, ...memoryEvents.values()],
  );
}

async function loadAdminEvents(): Promise<EventRow[]> {
  return safeDb(
    "load participation admin events",
    async () => {
      const rows = await db
        .select()
        .from(participationEvents)
        .orderBy(desc(participationEvents.updated_at))
        .limit(160);
      return rows.length > 0 ? rows : [...seedEvents, ...memoryEvents.values()];
    },
    () => [...seedEvents, ...memoryEvents.values()],
  );
}

async function loadResponses(userId: string, eventRows: EventRow[]) {
  const eventIds = eventRows.filter((event) => UUID_RE.test(event.id)).map((event) => event.id);
  if (eventIds.length === 0) return [];
  return safeDb(
    "load participation responses",
    async () => db.select().from(participationEventResponses).where(inArray(participationEventResponses.event_id, eventIds)),
    () => [] as EventResponseRow[],
  );
}

async function loadChecks(userId: string, eventRows: EventRow[]) {
  const eventIds = eventRows.filter((event) => UUID_RE.test(event.id)).map((event) => event.id);
  if (eventIds.length === 0) return [];
  return safeDb(
    "load participation checks",
    async () => db
      .select()
      .from(participationEventChecks)
      .where(and(eq(participationEventChecks.user_id, userId), inArray(participationEventChecks.event_id, eventIds)))
      .orderBy(desc(participationEventChecks.created_at)),
    () => [] as EventCheckRow[],
  );
}

async function loadAdminChecks(eventRows: EventRow[]) {
  const eventIds = eventRows.filter((event) => UUID_RE.test(event.id)).map((event) => event.id);
  if (eventIds.length === 0) return [];
  return safeDb(
    "load participation admin checks",
    async () => db
      .select()
      .from(participationEventChecks)
      .where(inArray(participationEventChecks.event_id, eventIds))
      .orderBy(desc(participationEventChecks.created_at)),
    () => [] as EventCheckRow[],
  );
}

async function loadNotifications(userId: string): Promise<ParticipationNotification[]> {
  return safeDb(
    "load participation notifications",
    async () => {
      const rows = await db
        .select()
        .from(participationNotifications)
        .where(eq(participationNotifications.user_id, userId))
        .orderBy(desc(participationNotifications.created_at))
        .limit(8);
      return rows.map(notificationFromRow);
    },
    () => memoryNotifications.filter((notification) => notification.metadata?.userId === userId).slice(0, 8),
  );
}

function notificationFromRow(row: EventNotificationRow): ParticipationNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    eventId: row.event_id,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
  };
}

function pulseCopy(language: SocialLanguage) {
  if (language === "es") {
    return {
      headline: "Eventos elegidos para ti",
      reassurance: "VYVA comprueba detalles antes de que te comprometas.",
      safetyCopy: "No hay compras, reservas ni contacto externo sin tu confirmacion.",
      locationFallback: "Cerca de ti u online",
      profileTitle: "Dinos tus intereses",
      profileBody: "Asi VYVA puede recomendar eventos, clases y salidas que encajen contigo.",
      profileAction: "Anadir hobbies",
    };
  }
  if (language === "de") {
    return {
      headline: "Veranstaltungen fuer dich",
      reassurance: "VYVA prueft Details, bevor du dich festlegst.",
      safetyCopy: "Keine Buchung, Zahlung oder externer Kontakt ohne deine Bestaetigung.",
      locationFallback: "In deiner Naehe oder online",
      profileTitle: "Erzaehl uns deine Interessen",
      profileBody: "So kann VYVA passende Veranstaltungen, Kurse und Ausfluege empfehlen.",
      profileAction: "Hobbys hinzufuegen",
    };
  }
  return {
    headline: "Events chosen for you",
    reassurance: "VYVA checks details before you commit.",
    safetyCopy: "No booking, payment, or outside contact happens without your confirmation.",
    locationFallback: "Near you or online",
    profileTitle: "Tell us your interests",
    profileBody: "VYVA can then recommend events, classes, and outings that fit you.",
    profileAction: "Add hobbies",
  };
}

export async function buildParticipationPulse(input: {
  userId: string;
  language: SocialLanguage;
  hints?: ParticipationHints;
}): Promise<ParticipationPulse> {
  const signals = await loadSignals(input.userId, input.language, input.hints);
  const events = await loadEvents();
  const [responses, checks, notifications] = await Promise.all([
    loadResponses(input.userId, events),
    loadChecks(input.userId, events),
    loadNotifications(input.userId),
  ]);
  const ranked = rankParticipationEvents({
    events,
    signals,
    responses,
    checks,
    language: signals.language,
    userId: input.userId,
  });
  const visible = ranked.filter((event) => event.myResponse !== "not_for_me");
  const recommendations = (visible.length ? visible : ranked).slice(0, 4);
  const featuredEvent = recommendations[0] ?? rankParticipationEvents({
    events: seedEvents,
    signals: defaultSignals(input.userId, signals.language, input.hints),
    responses: [],
    checks: [],
    language: signals.language,
    userId: input.userId,
  })[0];
  const copy = pulseCopy(signals.language);
  const savedEvents = ranked
    .filter((event) => event.myResponse === "interested" || event.myResponse === "maybe")
    .slice(0, 4);

  return {
    generatedAt: new Date().toISOString(),
    language: signals.language,
    headline: copy.headline,
    reassurance: copy.reassurance,
    safetyCopy: copy.safetyCopy,
    profileSignals: {
      interests: signals.interests.slice(0, 6),
      locationLabel: signals.city || signals.region || copy.locationFallback,
      preferredTimes: signals.preferredTimes.slice(0, 3),
      languageLabel: signals.languageLabel,
      needsProfileNudge: signals.needsProfileNudge,
    },
    featuredEvent,
    recommendations: recommendations.filter((event) => event.id !== featuredEvent.id).slice(0, 3),
    savedEvents,
    notifications,
    ...(signals.needsProfileNudge ? {
      emptyProfileNudge: {
        title: copy.profileTitle,
        body: copy.profileBody,
        actionLabel: copy.profileAction,
        path: "/onboarding/profile/hobbies",
      },
    } : {}),
  };
}

async function findDbEvent(eventRef: string): Promise<EventRow | null> {
  return safeDb(
    "find participation event",
    async () => {
      const eventKeyClause = eq(participationEvents.event_key, eventRef);
      const eventIdClause = UUID_RE.test(eventRef) ? eq(participationEvents.id, eventRef) : null;
      const [row] = await db
        .select()
        .from(participationEvents)
        .where(eventIdClause ? or(eventKeyClause, eventIdClause) : eventKeyClause)
        .limit(1);
      return row ?? memoryEvents.get(eventRef) ?? seedEvents.find((event) => event.event_key === eventRef) ?? null;
    },
    () => memoryEvents.get(eventRef) ?? seedEvents.find((event) => event.event_key === eventRef) ?? null,
  );
}

function clearMemoryResponse(userId: string, eventKey: string): ParticipationEventResponse {
  memoryResponses.delete(memoryResponseKey(userId, eventKey));
  return {
    eventId: eventKey,
    response: null,
    responseCounts: responseCountsForEvent({ id: eventKey, event_key: eventKey }, []),
  };
}

function saveMemoryResponse(userId: string, eventKey: string, response: ParticipationEventResponseValue): ParticipationEventResponse {
  memoryResponses.set(memoryResponseKey(userId, eventKey), response);
  return {
    eventId: eventKey,
    response,
    responseCounts: responseCountsForEvent({ id: eventKey, event_key: eventKey }, []),
  };
}

export async function respondToParticipationEvent(input: {
  userId: string;
  eventId: string;
  response: ParticipationEventResponseAction;
}): Promise<ParticipationEventResponse> {
  const event = await findDbEvent(input.eventId);
  if (!event) throw new Error("Participation event not found");
  if (input.response === "clear") {
    await safeDb(
      "clear participation response",
      async () => {
        if (!UUID_RE.test(event.id)) return;
        await db
          .delete(participationEventResponses)
          .where(and(
            eq(participationEventResponses.event_id, event.id),
            eq(participationEventResponses.user_id, input.userId),
          ));
      },
      () => undefined,
    );
    return clearMemoryResponse(input.userId, event.event_key);
  }

  const saved = await safeDb(
    "save participation response",
    async () => {
      if (!UUID_RE.test(event.id)) throw new Error("Seed event response uses memory fallback");
      const now = new Date();
      await db
        .insert(participationEventResponses)
        .values({
          event_id: event.id,
          user_id: input.userId,
          response: input.response,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: [participationEventResponses.event_id, participationEventResponses.user_id],
          set: {
            response: input.response,
            updated_at: now,
          },
        });
      return input.response;
    },
    () => {
      memoryResponses.set(memoryResponseKey(input.userId, event.event_key), input.response);
      return input.response;
    },
  );

  return {
    eventId: event.event_key,
    response: saved,
    responseCounts: responseCountsForEvent(event, []),
  };
}

function checkCopy(language: SocialLanguage, eventTitle: string) {
  if (language === "es") {
    return {
      title: "VYVA comprobara este evento",
      body: `"${eventTitle}" se guardo para revisar horario, acceso y transporte antes de comprometerte.`,
      message: `Ayudame a comprobar "${eventTitle}". Confirma horario, acceso, coste, transporte y si conviene ir acompanado. No reserves ni contactes con nadie sin mi confirmacion.`,
    };
  }
  if (language === "de") {
    return {
      title: "VYVA prueft diese Veranstaltung",
      body: `"${eventTitle}" wurde gespeichert, damit Zeit, Zugang und Transport vor einer Zusage geprueft werden.`,
      message: `Hilf mir, "${eventTitle}" zu pruefen. Bestaetige Zeit, Zugang, Kosten, Transport und ob Begleitung sinnvoll ist. Bitte nichts buchen oder kontaktieren ohne meine Bestaetigung.`,
    };
  }
  return {
    title: "VYVA will check this event",
    body: `"${eventTitle}" was saved so VYVA can check timing, access, and transport before you commit.`,
    message: `Help me check "${eventTitle}". Confirm timing, access, cost, transport, and whether it would help to go with someone. Do not book or contact anyone without my confirmation.`,
  };
}

export async function askVyvaToCheckParticipationEvent(input: {
  userId: string;
  eventId: string;
  language: SocialLanguage;
  note?: string;
  helperActions?: ParticipationHelperAction[];
}) {
  const event = await findDbEvent(input.eventId);
  if (!event) throw new Error("Participation event not found");
  const title = localize(event, "title", input.language);
  const copy = checkCopy(input.language, title);
  const helperActions = input.helperActions?.length ? input.helperActions : normalizeHelperActions(event.helper_actions);
  const prefill = {
    kind: "events",
    source: "participate",
    message: copy.message,
    event: {
      id: event.event_key,
      title,
      locationLabel: event.location_label,
      timeLabel: localize(event, "time_label", input.language),
      costLabel: localize(event, "cost_label", input.language),
      needsLiveCheck: event.needs_live_check,
      helperActions,
    },
  };

  await safeDb(
    "create participation check",
    async () => {
      if (!UUID_RE.test(event.id)) throw new Error("Seed event check uses memory fallback");
      const now = new Date();
      await db.insert(participationEventChecks).values({
        event_id: event.id,
        user_id: input.userId,
        status: "requested",
        request_note: input.note ?? "",
        helper_actions: helperActions,
        concierge_prefill: prefill,
        updated_at: now,
      });
      await db.insert(participationNotifications).values({
        user_id: input.userId,
        event_id: event.id,
        type: "event_check_requested",
        title: copy.title,
        body: copy.body,
        metadata: { eventKey: event.event_key },
      });
    },
    () => {
      const createdAt = new Date().toISOString();
      memoryChecks.unshift({
        id: randomUUID(),
        eventKey: event.event_key,
        userId: input.userId,
        status: "requested",
        requestNote: input.note ?? "",
        helperActions,
        conciergePrefill: prefill,
        createdAt,
      });
      memoryNotifications.unshift({
        id: randomUUID(),
        type: "event_check_requested",
        title: copy.title,
        body: copy.body,
        eventId: event.event_key,
        metadata: { eventKey: event.event_key, userId: input.userId },
        createdAt,
        readAt: null,
      });
    },
  );

  return {
    ok: true,
    eventId: event.event_key,
    checkStatus: "requested",
    conciergePrefill: prefill,
  };
}

function eventInsertFromAdmin(input: AdminEventInput, adminUserId: string): EventInsert {
  const format = input.format ?? "nearby";
  return {
    event_key: input.eventKey,
    title_es: input.titleEs,
    title_de: input.titleDe,
    title_en: input.titleEn,
    summary_es: input.summaryEs ?? "",
    summary_de: input.summaryDe ?? "",
    summary_en: input.summaryEn ?? "",
    description_es: input.descriptionEs ?? "",
    description_de: input.descriptionDe ?? "",
    description_en: input.descriptionEn ?? "",
    format,
    location_label: input.locationLabel ?? (format === "online" ? "Online" : "Nearby"),
    city: input.city ?? null,
    country_code: input.countryCode ?? DEFAULT_COUNTRY,
    time_label_es: input.timeLabelEs ?? "",
    time_label_de: input.timeLabelDe ?? "",
    time_label_en: input.timeLabelEn ?? "",
    starts_at: input.startsAt ? new Date(input.startsAt) : null,
    ends_at: input.endsAt ? new Date(input.endsAt) : null,
    cost_label_es: input.costLabelEs ?? "",
    cost_label_de: input.costLabelDe ?? "",
    cost_label_en: input.costLabelEn ?? "",
    language_codes: input.languageCodes ?? ["es", "de", "en"],
    tags: input.tags ?? [],
    interest_tags: input.interestTags ?? [],
    accessibility_tags: input.accessibilityTags ?? [],
    helper_actions: input.helperActions ?? ["check_details"],
    source: input.source ?? "admin",
    source_url: input.sourceUrl ?? null,
    status: input.status ?? "active",
    is_curated: input.isCurated ?? true,
    needs_live_check: input.needsLiveCheck ?? true,
    safety_status: input.safetyStatus ?? "approved",
    metadata: input.metadata ?? {},
    created_by: adminUserId,
  };
}

function memoryEventFromAdmin(input: AdminEventInput, adminUserId: string): EventRow {
  const insert = eventInsertFromAdmin(input, adminUserId);
  const now = new Date();
  return {
    id: insert.event_key,
    event_key: insert.event_key,
    title_es: insert.title_es,
    title_de: insert.title_de,
    title_en: insert.title_en,
    summary_es: insert.summary_es ?? "",
    summary_de: insert.summary_de ?? "",
    summary_en: insert.summary_en ?? "",
    description_es: insert.description_es ?? "",
    description_de: insert.description_de ?? "",
    description_en: insert.description_en ?? "",
    format: insert.format ?? "nearby",
    location_label: insert.location_label ?? "Nearby",
    city: insert.city ?? null,
    country_code: insert.country_code ?? null,
    time_label_es: insert.time_label_es ?? "",
    time_label_de: insert.time_label_de ?? "",
    time_label_en: insert.time_label_en ?? "",
    starts_at: insert.starts_at ?? null,
    ends_at: insert.ends_at ?? null,
    cost_label_es: insert.cost_label_es ?? "",
    cost_label_de: insert.cost_label_de ?? "",
    cost_label_en: insert.cost_label_en ?? "",
    language_codes: insert.language_codes ?? [],
    tags: insert.tags ?? [],
    interest_tags: insert.interest_tags ?? [],
    accessibility_tags: insert.accessibility_tags ?? [],
    helper_actions: insert.helper_actions ?? [],
    source: insert.source ?? "admin",
    source_url: insert.source_url ?? null,
    status: insert.status ?? "active",
    is_curated: insert.is_curated ?? true,
    needs_live_check: insert.needs_live_check ?? true,
    safety_status: insert.safety_status ?? "approved",
    metadata: insert.metadata ?? {},
    created_by: adminUserId,
    created_at: now,
    updated_at: now,
  };
}

export async function listAdminParticipationEvents(language: SocialLanguage = "en") {
  void language;
  const rows = await loadAdminEvents();
  const [responses, checks] = await Promise.all([
    loadResponses("admin", rows),
    loadAdminChecks(rows),
  ]);
  return rows.map((event) => eventToAdminParticipationEvent(event, {
    responseCounts: responseCountsForEvent(event, responses),
    checkRequestCount: checkRequestCountForEvent(event, checks),
  }));
}

export async function createAdminParticipationEvent(input: AdminEventInput, adminUserId: string) {
  const row = await safeDb(
    "create participation admin event",
    async () => {
      const [row] = await db.insert(participationEvents).values(eventInsertFromAdmin(input, adminUserId)).returning();
      return row;
    },
    () => {
      const row = memoryEventFromAdmin(input, adminUserId);
      memoryEvents.set(row.event_key, row);
      return row;
    },
  );
  return eventToAdminParticipationEvent(row, {
    responseCounts: responseCountsForEvent(row, []),
    checkRequestCount: checkRequestCountForEvent(row, []),
  });
}

function dbPatchFromAdmin(input: AdminEventPatch): EventUpdate {
  const patch: EventUpdate = {};
  if (input.titleEs !== undefined) patch.title_es = input.titleEs;
  if (input.titleDe !== undefined) patch.title_de = input.titleDe;
  if (input.titleEn !== undefined) patch.title_en = input.titleEn;
  if (input.summaryEs !== undefined) patch.summary_es = input.summaryEs;
  if (input.summaryDe !== undefined) patch.summary_de = input.summaryDe;
  if (input.summaryEn !== undefined) patch.summary_en = input.summaryEn;
  if (input.descriptionEs !== undefined) patch.description_es = input.descriptionEs;
  if (input.descriptionDe !== undefined) patch.description_de = input.descriptionDe;
  if (input.descriptionEn !== undefined) patch.description_en = input.descriptionEn;
  if (input.format !== undefined) patch.format = input.format;
  if (input.locationLabel !== undefined) patch.location_label = input.locationLabel;
  if (input.city !== undefined) patch.city = input.city;
  if (input.countryCode !== undefined) patch.country_code = input.countryCode;
  if (input.timeLabelEs !== undefined) patch.time_label_es = input.timeLabelEs;
  if (input.timeLabelDe !== undefined) patch.time_label_de = input.timeLabelDe;
  if (input.timeLabelEn !== undefined) patch.time_label_en = input.timeLabelEn;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt ? new Date(input.startsAt) : null;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt ? new Date(input.endsAt) : null;
  if (input.costLabelEs !== undefined) patch.cost_label_es = input.costLabelEs;
  if (input.costLabelDe !== undefined) patch.cost_label_de = input.costLabelDe;
  if (input.costLabelEn !== undefined) patch.cost_label_en = input.costLabelEn;
  if (input.languageCodes !== undefined) patch.language_codes = input.languageCodes;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.interestTags !== undefined) patch.interest_tags = input.interestTags;
  if (input.accessibilityTags !== undefined) patch.accessibility_tags = input.accessibilityTags;
  if (input.helperActions !== undefined) patch.helper_actions = input.helperActions;
  if (input.source !== undefined) patch.source = input.source;
  if (input.sourceUrl !== undefined) patch.source_url = input.sourceUrl;
  if (input.status !== undefined) patch.status = input.status;
  if (input.isCurated !== undefined) patch.is_curated = input.isCurated;
  if (input.needsLiveCheck !== undefined) patch.needs_live_check = input.needsLiveCheck;
  if (input.safetyStatus !== undefined) patch.safety_status = input.safetyStatus;
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  patch.updated_at = new Date();
  return patch;
}

export async function updateAdminParticipationEvent(eventRef: string, patchInput: AdminEventPatch) {
  const row = await safeDb(
    "update participation admin event",
    async () => {
      const patch = dbPatchFromAdmin(patchInput);
      const eventKeyClause = eq(participationEvents.event_key, eventRef);
      const eventIdClause = UUID_RE.test(eventRef) ? eq(participationEvents.id, eventRef) : null;
      const [row] = await db
        .update(participationEvents)
        .set(patch)
        .where(eventIdClause ? or(eventKeyClause, eventIdClause) : eventKeyClause)
        .returning();
      if (row) return row;
      const current = memoryEvents.get(eventRef) ?? seedEvents.find((event) => event.event_key === eventRef);
      if (!current) return null;
      const next = { ...current, ...patch } as EventRow;
      memoryEvents.set(next.event_key, next);
      return next;
    },
    () => {
      const current = memoryEvents.get(eventRef) ?? seedEvents.find((event) => event.event_key === eventRef);
      if (!current) return null;
      const patch = dbPatchFromAdmin(patchInput);
      const next = { ...current, ...patch } as EventRow;
      memoryEvents.set(next.event_key, next);
      return next;
    },
  );
  return row
    ? eventToAdminParticipationEvent(row, {
      responseCounts: responseCountsForEvent(row, []),
      checkRequestCount: checkRequestCountForEvent(row, []),
    })
    : null;
}

export async function listAdminParticipationActivity() {
  return safeDb(
    "list participation admin activity",
    async () => {
      const [responses, checks, notifications] = await Promise.all([
        db.select().from(participationEventResponses).orderBy(desc(participationEventResponses.updated_at)).limit(50),
        db.select().from(participationEventChecks).orderBy(desc(participationEventChecks.created_at)).limit(50),
        db.select().from(participationNotifications).orderBy(desc(participationNotifications.created_at)).limit(50),
      ]);
      return { responses, checks, notifications };
    },
    () => ({
      responses: Array.from(memoryResponses.entries()).map(([key, response]) => {
        const [userId, eventKey] = key.split(":");
        return { userId, eventKey, response };
      }),
      checks: memoryChecks,
      notifications: memoryNotifications,
    }),
  );
}

export function parseParticipationLanguage(raw?: string | null): SocialLanguage {
  return normalizeLanguage(raw);
}
