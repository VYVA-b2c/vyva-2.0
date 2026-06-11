import { randomUUID } from "crypto";
import { and, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "../db.js";
import {
  socialRoomModerationActions,
  socialRoomMemberRoles,
  socialRoomNotifications,
  socialRoomPlanResponses,
  socialRoomPlans,
  socialRoomPolls,
  socialRoomReplies,
  socialRoomSafetyReports,
  socialRoomVotes,
} from "../../shared/schema.js";
import type {
  SocialLanguage,
  SocialRoomComfortCheck,
  SocialRoomCostRange,
  SocialRoomComfortNeed,
  SocialRoomExperienceCategory,
  SocialRoomGroupSize,
  SocialRoomJoiningSupportCue,
  SocialRoomMember,
  SocialRoomPlan,
  SocialRoomPlanHelperAction,
  SocialRoomPlanInterestResponseValue,
  SocialRoomPlanKind,
  SocialRoomPlanResponseAction,
  SocialRoomPlanResponseValue,
  SocialRoomReply,
  SocialRoomReplyTone,
  SocialRoomReportedItemStatus,
  SocialRoomNotification,
  SocialRoomPulse,
  SocialRoomPoll,
  SocialRoomPreferredTime,
  SocialRoomSafetyFlag,
  SocialRoomSafetyReportTargetType,
  SocialRoomVisibilityState,
} from "../../src/social/types.js";

type LocalizedText = Record<SocialLanguage, string>;

type SeedPlan = {
  key: string;
  title: LocalizedText;
  body: LocalizedText;
  locationLabel: string;
  comfortNeeds?: SocialRoomComfortNeed[];
  experienceCategory?: SocialRoomExperienceCategory;
  preferredTime?: SocialRoomPreferredTime;
  costRange?: SocialRoomCostRange;
  groupSize?: SocialRoomGroupSize;
};

type SeedPollOption = {
  id: string;
  label: LocalizedText;
};

type MemoryReport = {
  id: string;
  roomSlug: string;
  reporterId: string;
  targetType: SocialRoomSafetyReportTargetType;
  targetId?: string | null;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

type MemoryProposal = {
  id: string;
  planKey: string;
  roomSlug: string;
  userId: string;
  kind: SocialRoomPlanKind;
  title: string;
  details: string;
  locationLabel: string;
  comfortNeeds: SocialRoomComfortNeed[];
  experienceCategory: SocialRoomExperienceCategory;
  preferredTime: SocialRoomPreferredTime;
  costRange: SocialRoomCostRange;
  groupSize: SocialRoomGroupSize;
  safetyFlags: SocialRoomSafetyFlag[];
  needsReview: boolean;
  status: "active" | "pending_review" | "hidden" | "closed";
  createdAt: string;
};

type MemoryReply = {
  id: string;
  planKey: string;
  roomSlug: string;
  userId: string;
  body: string;
  tone: SocialRoomReplyTone;
  status: string;
  createdAt: string;
};

type MemoryNotification = SocialRoomNotification & {
  userId: string;
  roomSlug: string;
};

type MemoryModerationAction = {
  id: string;
  room_id: string;
  admin_user_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  notes: string;
  created_at: string;
};

const TOGETHER_ROOM_SLUG = "together-room";
const DAILY_POLL_KEY = "daily-room-choice";
const ISSUE_POLL_PREFIX = "issue-";
const SAFE_DB_TIMEOUT_MS = 1400;
const COMFORT_NEED_OPTIONS: SocialRoomComfortNeed[] = ["listen_first", "quiet_pace", "easy_access", "seating", "transport_help", "arrival_buddy", "clear_cost"];
const PLAN_HELPER_ACTIONS: SocialRoomPlanHelperAction[] = ["choose", "pace", "buddy", "notify"];
const PLAN_HELPER_REPLY_BODIES: Record<SocialLanguage, Record<SocialRoomPlanHelperAction, string>> = {
  es: {
    choose: "Puedo ayudar a elegir una opcion sencilla para el grupo.",
    pace: "Un ritmo tranquilo, con pausas, me ayudaria.",
    buddy: "Me ayudaria quedar con alguien antes de entrar.",
    notify: "Por favor avisadme cuando haya un siguiente paso.",
  },
  en: {
    choose: "I can help choose one simple option for the group.",
    pace: "A quiet pace with room to pause would help me.",
    buddy: "It would help to meet with someone before joining.",
    notify: "Please keep me posted when there is a next step.",
  },
  de: {
    choose: "Ich kann helfen, eine einfache Option fuer die Gruppe auszuwaehlen.",
    pace: "Ein ruhiges Tempo mit Pausen wuerde mir helfen.",
    buddy: "Es wuerde mir helfen, vorher mit jemandem zusammen anzukommen.",
    notify: "Bitte haltet mich auf dem Laufenden, wenn es einen naechsten Schritt gibt.",
  },
};

const t = (es: string, en: string, de: string): LocalizedText => ({ es, en, de });

const seedPlans: SeedPlan[] = [
  {
    key: "tea-film-chat",
    title: t("Te y charla de pelicula", "Tea and film chat", "Tee und Filmgespraech"),
    body: t(
      "Elegid una pelicula tranquila y comentadla sin prisa.",
      "Choose a gentle film and talk about it without rushing.",
      "Waehlt einen ruhigen Film und sprecht ohne Eile darueber.",
    ),
    locationLabel: "online",
    comfortNeeds: ["quiet_pace"],
    experienceCategory: "movie_date",
    preferredTime: "evening",
    costRange: "free",
    groupSize: "small_group",
  },
  {
    key: "quiet-lunch",
    title: t("Comida tranquila cerca", "Quiet lunch nearby", "Ruhiges Mittagessen in der Naehe"),
    body: t(
      "VYVA ayuda a elegir un lugar cercano, accesible y calmado.",
      "VYVA helps choose somewhere nearby, accessible and calm.",
      "VYVA hilft, einen nahen, barrierearmen und ruhigen Ort zu waehlen.",
    ),
    locationLabel: "nearby",
    comfortNeeds: ["easy_access", "seating", "transport_help", "arrival_buddy", "clear_cost"],
    experienceCategory: "restaurant_date",
    preferredTime: "afternoon",
    costRange: "shared",
    groupSize: "small_group",
  },
  {
    key: "gentle-walk",
    title: t("Paseo suave", "Gentle walk", "Sanfter Spaziergang"),
    body: t(
      "Un paseo corto con ritmo comodo y opcion de parar.",
      "A short walk at a comfortable pace, with room to pause.",
      "Ein kurzer Spaziergang in bequemem Tempo mit Pausen.",
    ),
    locationLabel: "nearby",
    comfortNeeds: ["quiet_pace"],
    experienceCategory: "outing",
    preferredTime: "morning",
    costRange: "free",
    groupSize: "small_group",
  },
];

const pollQuestion = t(
  "Que os apeteceria compartir hoy?",
  "What would feel good to share today?",
  "Was wuerde sich heute gut anfuehlen?",
);

const pollOptions: SeedPollOption[] = [
  { id: "film", label: t("Pelicula", "Film chat", "Filmgespraech") },
  { id: "lunch", label: t("Comida", "Quiet lunch", "Ruhiges Essen") },
  { id: "views", label: t("Compartir opiniones", "Share views", "Ansichten teilen") },
];
const issuePollOptions: SeedPollOption[] = [
  { id: "yes", label: t("Si, es importante", "Yes, this matters", "Ja, das ist wichtig") },
  { id: "more_info", label: t("Necesito mas detalles", "I need more detail", "Ich brauche mehr Details") },
  { id: "not_now", label: t("Ahora no", "Not now", "Jetzt nicht") },
];

const planResponses = new Map<string, SocialRoomPlanResponseValue>();
const pollVotes = new Map<string, string>();
const memoryPollStatuses = new Map<string, string>();
const proposals: MemoryProposal[] = [];
const memoryReplies: MemoryReply[] = [];
const memoryNotifications: MemoryNotification[] = [];
const memoryModerationActions: MemoryModerationAction[] = [];
const agreementAcknowledgements = new Map<string, string>();
const comfortCheckIns = new Map<string, SocialRoomComfortNeed[]>();
const quietPauses = new Map<string, string>();

function normalizePlanKind(value: unknown): SocialRoomPlanKind {
  if (value === "message" || value === "question") return value;
  return "plan";
}

function normalizeComfortNeeds(value: unknown): SocialRoomComfortNeed[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<SocialRoomComfortNeed>(COMFORT_NEED_OPTIONS);
  return Array.from(new Set(value.filter((item): item is SocialRoomComfortNeed => allowed.has(item as SocialRoomComfortNeed)))).slice(0, 7);
}

function normalizeExperienceCategory(value: unknown): SocialRoomExperienceCategory {
  const allowed = new Set<SocialRoomExperienceCategory>([
    "movie_date",
    "restaurant_date",
    "home_share",
    "service_booking",
    "deal_help",
    "outing",
    "other",
  ]);
  return allowed.has(value as SocialRoomExperienceCategory) ? value as SocialRoomExperienceCategory : "other";
}

function normalizePreferredTime(value: unknown): SocialRoomPreferredTime {
  const allowed = new Set<SocialRoomPreferredTime>(["morning", "afternoon", "evening", "flexible"]);
  return allowed.has(value as SocialRoomPreferredTime) ? value as SocialRoomPreferredTime : "flexible";
}

function normalizeCostRange(value: unknown): SocialRoomCostRange {
  const allowed = new Set<SocialRoomCostRange>(["free", "low", "shared", "discuss"]);
  return allowed.has(value as SocialRoomCostRange) ? value as SocialRoomCostRange : "discuss";
}

function normalizeGroupSize(value: unknown): SocialRoomGroupSize {
  const allowed = new Set<SocialRoomGroupSize>(["one_to_one", "small_group", "open_room"]);
  return allowed.has(value as SocialRoomGroupSize) ? value as SocialRoomGroupSize : "one_to_one";
}

function normalizeSafetyFlags(value: unknown): SocialRoomSafetyFlag[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<SocialRoomSafetyFlag>(["money", "housing", "service", "private_contact", "transport", "unkind_tone"]);
  return Array.from(new Set(value.filter((item): item is SocialRoomSafetyFlag => allowed.has(item as SocialRoomSafetyFlag)))).slice(0, 5);
}

function normalizeSafetyText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectProtectedNumberDigits(value: string) {
  const matches = value.match(/(?:\+?\d[\d\s().-]{5,}\d)/g) ?? [];
  return matches.map((match) => {
    const trimmed = match.trim();
    const looksLikeDate = /^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed);
    return looksLikeDate ? "" : trimmed.replace(/\D/g, "");
  }).filter((digits) => digits.length >= 7 && digits.length <= 19);
}

function hasUnkindTone(value: string) {
  const text = normalizeSafetyText(value);
  return /\b(stupid|idiot|dumb|worthless|shut up|go away|ridiculous|nonsense|liar|estupido|idiota|callate|tonto|basura|dumm|halt die klappe|laecherlich|lacherlich|luegner)\b/.test(text);
}

export function detectSafetyFlags(input: {
  category: SocialRoomExperienceCategory;
  title: string;
  details: string;
}): SocialRoomSafetyFlag[] {
  const flags = new Set<SocialRoomSafetyFlag>();
  const rawText = `${input.title} ${input.details}`;
  const text = normalizeSafetyText(rawText);
  const protectedDigitGroups = detectProtectedNumberDigits(rawText);

  if (input.category === "home_share") flags.add("housing");
  if (input.category === "service_booking") flags.add("service");
  if (input.category === "deal_help") flags.add("money");

  if (/\b(bank|banco|bezahl|card|cash|contract|contrato|crypto|deal|deposit|deposito|dinero|discount|efectivo|factura|fianza|geld|gift card|iban|invoice|kaution|konto|loan|money|pagar|pay|payment|pago|precio|prestamo|price|rechnung|refund|rent|renta|tarjeta|transfer|transferencia|zahlen)\b/.test(text)) {
    flags.add("money");
  }
  if (/\b(address|adresse|correo|direccion|e-?mail|email|fuera de la app|number|nummer|outside the app|phone|private contact|telefono|telefon|text me|whatsapp)\b/.test(text) || /https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) {
    flags.add("private_contact");
  }
  if (protectedDigitGroups.some((digits) => digits.length >= 7 && digits.length <= 15)) {
    flags.add("private_contact");
  }
  if (protectedDigitGroups.some((digits) => digits.length >= 13)) {
    flags.add("money");
  }
  if (/\b(alquiler|apartment|apartamento|casa|habitacion|haus|home share|house|lease|miete|mietvertrag|mitbewohner|piso|rent|roommate|tenant|vivienda|wohnung|zimmer)\b/.test(text)) {
    flags.add("housing");
  }
  if (/\b(book a service|caregiver|cleaner|cuidador|cuidadora|dienstleistung|handwerker|handyman|limpiador|limpieza|pflege|pfleger|repair|reparacion|reparatur|service|servicio|tecnico|worker)\b/.test(text)) {
    flags.add("service");
  }
  if (/\b(abholen|auto|car|carro|coche|conductor|driver|fahrer|fahrt|lift|recogida|recoger|ride|taxi|transport|transporte|viaje)\b/.test(text)) {
    flags.add("transport");
  }
  if (hasUnkindTone(rawText)) {
    flags.add("unkind_tone");
  }

  return Array.from(flags).slice(0, 5);
}

function shouldReviewExperience(kind: SocialRoomPlanKind, safetyFlags: SocialRoomSafetyFlag[]) {
  return (kind === "plan" || kind === "message" || kind === "question") && safetyFlags.length > 0;
}

export function shouldBlockReply(safetyFlags: SocialRoomSafetyFlag[]) {
  return safetyFlags.length > 0;
}

export function blockedReplyDetails(safetyFlags: SocialRoomSafetyFlag[], language: SocialLanguage) {
  const flags = safetyFlags.join(", ");
  if (language === "de") return `Eine Antwort wurde vor dem Teilen gestoppt, weil sie geschuetzten Kontakt, Zahlungen, andere geschuetzte Details oder einen unfreundlichen Ton enthalten koennte. Hinweise: ${flags}.`;
  if (language === "en") return `A reply was stopped before sharing because it may include protected contact, payment details, other protected details or an unkind tone. Signals: ${flags}.`;
  return `Se detuvo una respuesta antes de compartirla porque podria incluir contacto protegido, pagos, otros datos protegidos o un tono poco amable. Senales: ${flags}.`;
}

function proposalReviewDetails(kind: SocialRoomPlanKind, safetyFlags: SocialRoomSafetyFlag[], language: SocialLanguage) {
  const flags = safetyFlags.join(", ");
  const itemDe = kind === "question" ? "Frage" : kind === "message" ? "Nachricht" : "Aktivitaet";
  const itemEn = kind === "question" ? "question" : kind === "message" ? "message" : "activity";
  const itemEs = kind === "question" ? "pregunta" : kind === "message" ? "mensaje" : "actividad";
  if (language === "de") return `Eine geteilte ${itemDe} wurde vor der Anzeige zur VYVA-Pruefung zurueckgehalten. Hinweise: ${flags}.`;
  if (language === "en") return `A shared ${itemEn} was held for VYVA review before it appeared in the room. Signals: ${flags}.`;
  return `Se retuvo un ${itemEs} compartido para revision de VYVA antes de mostrarlo en la sala. Senales: ${flags}.`;
}

function proposalNotificationCopy(input: {
  needsReview: boolean;
  title: string;
  details: string;
  language: SocialLanguage;
}) {
  if (!input.needsReview) {
    return {
      type: "proposal_created",
      title: input.title,
      body: input.details,
    };
  }

  if (input.language === "de") {
    return {
      type: "proposal_review_pending",
      title: "VYVA prueft dies vor dem Teilen",
      body: "Deine Idee ist privat gespeichert. Der Raum sieht sie erst, wenn VYVA sie als sicher einordnet.",
    };
  }

  if (input.language === "en") {
    return {
      type: "proposal_review_pending",
      title: "VYVA will review this before it appears",
      body: "Your idea is saved privately. The room will not see it until VYVA says it is safe.",
    };
  }

  return {
    type: "proposal_review_pending",
    title: "VYVA lo revisara antes de compartir",
    body: "Tu idea esta guardada en privado. La sala no la vera hasta que VYVA confirme que es segura.",
  };
}

function fitReasonLabels(language: SocialLanguage) {
  if (language === "de") {
    return {
      nearby: "In der Naehe",
      online: "Online",
      morning: "Morgen",
      afternoon: "Nachmittag",
      evening: "Abend",
      flexible: "Flexible Zeit",
      free: "Kostenfrei",
      low: "Kleine Kosten",
      shared: "Geteilte Kosten",
      discuss: "Kosten vorher klaeren",
      one_to_one: "1:1",
      small_group: "Kleine Gruppe",
      open_room: "Offene Runde",
    };
  }

  if (language === "en") {
    return {
      nearby: "Nearby",
      online: "Online",
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      flexible: "Flexible time",
      free: "Free",
      low: "Low cost",
      shared: "Shared cost",
      discuss: "Discuss cost first",
      one_to_one: "1:1",
      small_group: "Small group",
      open_room: "Open room",
    };
  }

  return {
    nearby: "Cerca",
    online: "En linea",
    morning: "Manana",
    afternoon: "Tarde",
    evening: "Noche",
    flexible: "Hora flexible",
    free: "Gratis",
    low: "Coste bajo",
    shared: "Coste compartido",
    discuss: "Aclarar coste antes",
    one_to_one: "1:1",
    small_group: "Grupo pequeno",
    open_room: "Sala abierta",
  };
}

function buildFitReasons(input: {
  locationLabel: string;
  preferredTime?: SocialRoomPreferredTime;
  costRange?: SocialRoomCostRange;
  groupSize?: SocialRoomGroupSize;
}, language: SocialLanguage) {
  const labels = fitReasonLabels(language);
  const preferredTime = input.preferredTime ?? "flexible";
  const costRange = input.costRange ?? "discuss";
  const groupSize = input.groupSize ?? "one_to_one";
  return [
    input.locationLabel === "nearby" ? labels.nearby : labels.online,
    labels[preferredTime],
    labels[costRange],
    labels[groupSize],
  ].slice(0, 4);
}

function normalizeReplyTone(value: unknown): SocialRoomReplyTone {
  if (value === "curious" || value === "help" || value === "different") return value;
  return "support";
}

function normalizeReplyBody(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 180);
}

const reports: MemoryReport[] = [];
const activePresenceVisits = new Map<string, { userId: string; roomSlug: string; lastSeenAt: number }>();
const ACTIVE_PRESENCE_TTL_MS = 45 * 60 * 1000;

function publicRoomId(roomSlug: string) {
  return roomSlug || TOGETHER_ROOM_SLUG;
}

function localize<T extends { [key in SocialLanguage]: string }>(value: T, language: SocialLanguage) {
  return value[language] || value.en || value.es;
}

function replyAuthorName(language: SocialLanguage) {
  if (language === "de") return "Mitglied";
  if (language === "en") return "Member";
  return "Miembro";
}

function normalizePlanResponse(value: unknown): SocialRoomPlanResponseValue {
  if (value === "join" || value === "not_for_me") return value;
  return "maybe";
}

function isPlanInterestResponse(value: unknown): value is SocialRoomPlanInterestResponseValue {
  return value === "join" || value === "maybe";
}

function responseKey(userId: string, planKey: string) {
  return `${userId}:${planKey}`;
}

function userIdFromPlanResponseKey(key: string, planKey: string) {
  const suffix = `:${planKey}`;
  return key.endsWith(suffix) ? key.slice(0, -suffix.length) : null;
}

function voteKey(userId: string, pollKey: string) {
  return `${userId}:${pollKey}`;
}

function issuePollKey(planKey: string) {
  return `${ISSUE_POLL_PREFIX}${planKey}`;
}

function issuePlanKeyFromPollKey(pollKey: string) {
  return pollKey.startsWith(ISSUE_POLL_PREFIX) ? pollKey.slice(ISSUE_POLL_PREFIX.length) : null;
}

function pollOptionsForKey(pollKey: string) {
  return issuePlanKeyFromPollKey(pollKey) ? issuePollOptions : pollOptions;
}

function memoryPollStatus(pollKey: string, fallback = "active") {
  return memoryPollStatuses.get(pollKey) ?? fallback;
}

function memoryVotesForPoll(pollKey: string) {
  const suffix = `:${pollKey}`;
  return Array.from(pollVotes.entries())
    .filter(([key]) => key.endsWith(suffix))
    .map(([, optionId]) => optionId);
}

function agreementKey(userId: string, roomSlug: string) {
  return `${userId}:${publicRoomId(roomSlug)}`;
}

function comfortCheckKey(userId: string, roomSlug: string) {
  return `${publicRoomId(roomSlug)}:${userId}`;
}

function memoryAgreementAcknowledgedAt(userId: string, roomSlug: string) {
  return agreementAcknowledgements.get(agreementKey(userId, roomSlug)) ?? null;
}

function memoryComfortNeeds(userId: string, roomSlug: string) {
  return comfortCheckIns.get(comfortCheckKey(userId, roomSlug)) ?? [];
}

function memoryQuietPausedAt(userId: string, roomSlug: string) {
  return quietPauses.get(comfortCheckKey(userId, roomSlug)) ?? null;
}

function reportTargetItemKey(targetType: SocialRoomSafetyReportTargetType | string, targetId?: string | null) {
  if (!targetId) return null;
  if (targetType === "reply") return `reply:${targetId}`;
  if (targetType === "plan" || targetType === "message" || targetType === "question") {
    return `plan:${targetId}`;
  }
  return null;
}

function compactReportItemKeys(keys: Array<string | null>) {
  return Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
}

function compactReportedItemStatuses(
  items: Array<{ itemKey: string | null; status: string; updatedAt?: string | null }>,
): SocialRoomReportedItemStatus[] {
  const byKey = new Map<string, SocialRoomReportedItemStatus>();
  const timeValue = (value?: string | null) => {
    const time = Date.parse(value ?? "");
    return Number.isFinite(time) ? time : 0;
  };
  const sortedItems = [...items]
    .filter((item): item is { itemKey: string; status: string; updatedAt?: string | null } => Boolean(item.itemKey))
    .sort((a, b) => timeValue(b.updatedAt) - timeValue(a.updatedAt));

  for (const item of sortedItems) {
    if (!byKey.has(item.itemKey)) {
      byKey.set(item.itemKey, {
        itemKey: item.itemKey,
        status: item.status,
        updatedAt: item.updatedAt ?? null,
      });
    }
  }

  return Array.from(byKey.values());
}

function memoryReportedItemKeys(userId: string, roomSlug: string) {
  const publicSlug = publicRoomId(roomSlug);
  return compactReportItemKeys(
    reports
      .filter((report) => report.reporterId === userId && report.roomSlug === publicSlug)
      .map((report) => reportTargetItemKey(report.targetType, report.targetId)),
  );
}

function memoryReportedItemStatuses(userId: string, roomSlug: string) {
  const publicSlug = publicRoomId(roomSlug);
  return compactReportedItemStatuses(
    reports
      .filter((report) => report.reporterId === userId && report.roomSlug === publicSlug)
      .map((report) => ({
        itemKey: reportTargetItemKey(report.targetType, report.targetId),
        status: report.status,
        updatedAt: report.reviewedAt ?? report.createdAt,
      })),
  );
}

function activeReportStatus(status: string) {
  return status === "open" || status === "reviewing";
}

function existingMemorySafetyReport(input: {
  userId: string;
  roomSlug: string;
  targetType: SocialRoomSafetyReportTargetType;
  targetId?: string | null;
  reason: string;
  details: string;
}) {
  const publicSlug = publicRoomId(input.roomSlug);
  const targetId = input.targetId ?? null;
  return reports.find((report) => (
    report.reporterId === input.userId &&
    report.roomSlug === publicSlug &&
    report.targetType === input.targetType &&
    (report.targetId ?? null) === targetId &&
    report.reason === input.reason &&
    report.details === input.details &&
    activeReportStatus(report.status)
  )) ?? null;
}

async function existingDbSafetyReport(input: {
  userId: string;
  roomSlug: string;
  roomId: string;
  targetType: SocialRoomSafetyReportTargetType;
  targetId?: string | null;
  reason: string;
  details: string;
}) {
  return await safeDb(
    "find existing safety report",
    async () => {
      const targetIdWhere = input.targetId
        ? eq(socialRoomSafetyReports.target_id, input.targetId)
        : isNull(socialRoomSafetyReports.target_id);
      const [report] = await db
        .select()
        .from(socialRoomSafetyReports)
        .where(and(
          eq(socialRoomSafetyReports.room_id, input.roomId),
          eq(socialRoomSafetyReports.reporter_id, input.userId),
          eq(socialRoomSafetyReports.target_type, input.targetType),
          targetIdWhere,
          eq(socialRoomSafetyReports.reason, input.reason),
          eq(socialRoomSafetyReports.details, input.details),
          inArray(socialRoomSafetyReports.status, ["open", "reviewing"]),
        ))
        .orderBy(desc(socialRoomSafetyReports.created_at))
        .limit(1);
      if (!report) return null;

      return {
        id: report.id,
        roomSlug: publicRoomId(input.roomSlug),
        reporterId: report.reporter_id,
        targetType: report.target_type as SocialRoomSafetyReportTargetType,
        targetId: report.target_id ?? null,
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.created_at.toISOString(),
        reviewedAt: report.reviewed_at?.toISOString() ?? null,
        reviewedBy: report.reviewed_by ?? null,
      } satisfies MemoryReport;
    },
    async () => null,
  );
}

function activeProposalStatus(status: string) {
  return status === "active" || status === "pending_review";
}

function normalizedProposalStatus(status: string): MemoryProposal["status"] {
  if (status === "pending_review" || status === "hidden" || status === "closed") return status;
  return "active";
}

function sameItems(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function existingMemoryProposal(input: {
  userId: string;
  roomSlug: string;
  kind: SocialRoomPlanKind;
  title: string;
  details: string;
  locationLabel: string;
  comfortNeeds: SocialRoomComfortNeed[];
  experienceCategory: SocialRoomExperienceCategory;
  preferredTime: SocialRoomPreferredTime;
  costRange: SocialRoomCostRange;
  groupSize: SocialRoomGroupSize;
  safetyFlags: SocialRoomSafetyFlag[];
  needsReview: boolean;
}) {
  const publicSlug = publicRoomId(input.roomSlug);
  return proposals.find((proposal) => (
    proposal.userId === input.userId &&
    proposal.roomSlug === publicSlug &&
    proposal.kind === input.kind &&
    proposal.title === input.title &&
    proposal.details === input.details &&
    proposal.locationLabel === input.locationLabel &&
    proposal.experienceCategory === input.experienceCategory &&
    proposal.preferredTime === input.preferredTime &&
    proposal.costRange === input.costRange &&
    proposal.groupSize === input.groupSize &&
    proposal.needsReview === input.needsReview &&
    sameItems(proposal.comfortNeeds, input.comfortNeeds) &&
    sameItems(proposal.safetyFlags, input.safetyFlags) &&
    activeProposalStatus(proposal.status)
  )) ?? null;
}

function dbPlanToMemoryProposal(
  plan: typeof socialRoomPlans.$inferSelect,
  roomSlug: string,
  language: SocialLanguage,
): MemoryProposal {
  const safetyFlags = normalizeSafetyFlags(plan.safety_flags);
  return {
    id: plan.id,
    planKey: plan.plan_key,
    roomSlug: publicRoomId(roomSlug),
    userId: plan.created_by ?? "",
    kind: normalizePlanKind(plan.kind),
    title: rowPlanTitle(plan, language),
    details: rowPlanBody(plan, language),
    locationLabel: plan.location_label,
    comfortNeeds: normalizeComfortNeeds(plan.comfort_needs),
    experienceCategory: normalizeExperienceCategory(plan.experience_category),
    preferredTime: normalizePreferredTime(plan.preferred_time),
    costRange: normalizeCostRange(plan.cost_range),
    groupSize: normalizeGroupSize(plan.group_size),
    safetyFlags,
    needsReview: Boolean(plan.needs_review) || safetyFlags.length > 0,
    status: normalizedProposalStatus(plan.status),
    createdAt: plan.created_at.toISOString(),
  };
}

async function existingDbProposal(input: {
  userId: string;
  roomSlug: string;
  roomId: string;
  kind: SocialRoomPlanKind;
  title: string;
  details: string;
  locationLabel: string;
  comfortNeeds: SocialRoomComfortNeed[];
  experienceCategory: SocialRoomExperienceCategory;
  preferredTime: SocialRoomPreferredTime;
  costRange: SocialRoomCostRange;
  groupSize: SocialRoomGroupSize;
  safetyFlags: SocialRoomSafetyFlag[];
  needsReview: boolean;
  language: SocialLanguage;
}) {
  return await safeDb(
    "find existing proposal",
    async () => {
      const candidates = await db
        .select()
        .from(socialRoomPlans)
        .where(and(
          eq(socialRoomPlans.room_id, input.roomId),
          eq(socialRoomPlans.created_by, input.userId),
          eq(socialRoomPlans.kind, input.kind),
          eq(socialRoomPlans.title_en, input.title),
          eq(socialRoomPlans.body_en, input.details),
          eq(socialRoomPlans.location_label, input.locationLabel),
          eq(socialRoomPlans.experience_category, input.experienceCategory),
          eq(socialRoomPlans.preferred_time, input.preferredTime),
          eq(socialRoomPlans.cost_range, input.costRange),
          eq(socialRoomPlans.group_size, input.groupSize),
          inArray(socialRoomPlans.status, ["active", "pending_review"]),
        ))
        .orderBy(desc(socialRoomPlans.created_at))
        .limit(8);
      const proposal = candidates.find((plan) => (
        Boolean(plan.needs_review) === input.needsReview &&
        sameItems(normalizeComfortNeeds(plan.comfort_needs), input.comfortNeeds) &&
        sameItems(normalizeSafetyFlags(plan.safety_flags), input.safetyFlags)
      ));
      return proposal ? dbPlanToMemoryProposal(proposal, input.roomSlug, input.language) : null;
    },
    async () => null,
  );
}

function userIdFromLeadingKey(key: string) {
  const separatorIndex = key.indexOf(":");
  return separatorIndex > 0 ? key.slice(0, separatorIndex) : null;
}

function userIdFromRoomScopedKey(key: string, roomSlug: string) {
  const prefix = `${publicRoomId(roomSlug)}:`;
  return key.startsWith(prefix) && key.length > prefix.length ? key.slice(prefix.length) : null;
}

function addParticipantId(ids: Set<string>, userId?: string | null) {
  const trimmed = userId?.trim();
  if (trimmed) ids.add(trimmed);
}

function memoryParticipantIds(roomSlug: string) {
  const publicSlug = publicRoomId(roomSlug);
  const ids = new Set<string>();

  for (const userId of activePresenceParticipantIds(publicSlug)) addParticipantId(ids, userId);
  for (const key of planResponses.keys()) addParticipantId(ids, userIdFromLeadingKey(key));
  for (const key of pollVotes.keys()) addParticipantId(ids, userIdFromLeadingKey(key));
  for (const key of comfortCheckIns.keys()) addParticipantId(ids, userIdFromRoomScopedKey(key, publicSlug));
  for (const key of quietPauses.keys()) addParticipantId(ids, userIdFromRoomScopedKey(key, publicSlug));
  for (const key of agreementAcknowledgements.keys()) {
    const userId = userIdFromLeadingKey(key);
    if (userId && key.endsWith(`:${publicSlug}`)) ids.add(userId);
  }
  for (const proposal of proposals) {
    if (proposal.roomSlug === publicSlug && proposal.status === "active") addParticipantId(ids, proposal.userId);
  }
  for (const reply of memoryReplies) {
    if (reply.roomSlug === publicSlug && reply.status === "active") addParticipantId(ids, reply.userId);
  }

  return Array.from(ids);
}

function pruneActivePresenceVisits(now = Date.now()) {
  for (const [visitId, visit] of activePresenceVisits.entries()) {
    if (now - visit.lastSeenAt > ACTIVE_PRESENCE_TTL_MS) {
      activePresenceVisits.delete(visitId);
    }
  }
}

function activePresenceParticipantIds(roomSlug: string) {
  const publicSlug = publicRoomId(roomSlug);
  pruneActivePresenceVisits();
  return Array.from(activePresenceVisits.values())
    .filter((visit) => visit.roomSlug === publicSlug)
    .map((visit) => visit.userId);
}

export async function registerTogetherRoomPresence(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  visitId: string;
}) {
  const publicSlug = publicRoomId(input.roomSlug);
  const now = new Date();
  activePresenceVisits.set(input.visitId, {
    userId: input.userId,
    roomSlug: publicSlug,
    lastSeenAt: now.getTime(),
  });

  if (!input.roomId) return;

  await safeDb(
    "register quiet presence",
    async () => {
      await db
        .insert(socialRoomMemberRoles)
        .values({
          room_id: input.roomId!,
          user_id: input.userId,
          role: "member",
          status: "active",
        })
        .onConflictDoUpdate({
          target: [socialRoomMemberRoles.room_id, socialRoomMemberRoles.user_id],
          set: {
            status: "active",
            updated_at: now,
          },
        });
    },
    async () => undefined,
  );
}

export function leaveTogetherRoomPresence(input: {
  visitId?: string | null;
  userId?: string | null;
  roomSlug?: string | null;
}) {
  if (input.visitId && activePresenceVisits.delete(input.visitId)) return;
  if (!input.userId || !input.roomSlug) return;

  const publicSlug = publicRoomId(input.roomSlug);
  for (const [visitId, visit] of activePresenceVisits.entries()) {
    if (visit.userId === input.userId && visit.roomSlug === publicSlug) {
      activePresenceVisits.delete(visitId);
    }
  }
}

function anonymousPresenceCopy(language: SocialLanguage) {
  if (language === "de") {
    return {
      you: "Du",
      member: "Mitglied",
      youStatus: "Du bist ruhig im Raum dabei.",
      statuses: [
        "Ist in ruhigem Tempo dabei.",
        "Hoert zu und macht ohne Druck mit.",
        "Schaut sich die Einladung an.",
      ],
    };
  }

  if (language === "en") {
    return {
      you: "You",
      member: "Member",
      youStatus: "You are here quietly.",
      statuses: [
        "Joining at a quiet pace.",
        "Listening and joining without pressure.",
        "Reviewing today's invitation.",
      ],
    };
  }

  return {
    you: "Tu",
    member: "Miembro",
    youStatus: "Estas en la sala con calma.",
    statuses: [
      "Participa con ritmo tranquilo.",
      "Escucha y se suma sin presion.",
      "Revisa la invitacion de hoy.",
    ],
  };
}

function togetherParticipantPresence(
  currentUserId: string,
  language: SocialLanguage,
  participantIds: string[],
  fallbackMembers: SocialRoomMember[],
) {
  const uniqueIds = Array.from(new Set(participantIds.filter(Boolean)));
  if (uniqueIds.length === 0) return fallbackMembers;

  const orderedIds = [
    ...uniqueIds.filter((id) => id === currentUserId),
    ...uniqueIds.filter((id) => id !== currentUserId),
  ].slice(0, 3);
  const copy = anonymousPresenceCopy(language);
  let anonymousMemberNumber = 0;
  const activeMembers = orderedIds.map<SocialRoomMember>((id, index) => {
    if (id === currentUserId) {
      return {
        id: "member-self",
        name: copy.you,
        statusLabel: copy.youStatus,
      };
    }

    anonymousMemberNumber += 1;
    return {
      id: `member-present-${index + 1}`,
      name: `${copy.member} ${anonymousMemberNumber}`,
      statusLabel: copy.statuses[(anonymousMemberNumber - 1) % copy.statuses.length],
    };
  });

  return [
    ...activeMembers,
    ...fallbackMembers.filter((member) => !activeMembers.some((activeMember) => activeMember.id === member.id)),
  ].slice(0, 3);
}

async function clearTogetherQuietPause(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  savedAt?: Date;
}) {
  quietPauses.delete(comfortCheckKey(input.userId, input.roomSlug));

  if (!input.roomId) return;

  const savedAt = input.savedAt ?? new Date();
  await safeDb(
    "clear quiet pause after room action",
    async () => {
      await db
        .update(socialRoomMemberRoles)
        .set({
          quiet_paused_at: null,
          updated_at: savedAt,
        })
        .where(and(
          eq(socialRoomMemberRoles.room_id, input.roomId!),
          eq(socialRoomMemberRoles.user_id, input.userId),
        ));
    },
    async () => undefined,
  );
}

function memoryComfortNeedEntries(roomSlug: string) {
  const prefix = `${publicRoomId(roomSlug)}:`;
  return Array.from(comfortCheckIns.entries())
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, needs]) => [key.slice(prefix.length), normalizeComfortNeeds(needs)] as const);
}

function emptyPlanCounts() {
  return { join: 0, maybe: 0, not_for_me: 0 };
}

function comfortCheckCopy(language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "Was macht es angenehm?",
      body: "Tippe an, was dir hilft. Die Gruppe kann Plaene daran ausrichten.",
      labels: {
        listen_first: "Erst zuhoeren",
        quiet_pace: "Ruhiges Tempo",
        easy_access: "Einfacher Zugang",
        seating: "Sitzplatz",
        transport_help: "Hilfe beim Hinkommen",
        arrival_buddy: "Gemeinsam ankommen",
        clear_cost: "Kosten vorher wissen",
      },
    };
  }

  if (language === "en") {
    return {
      title: "What would make this comfortable?",
      body: "Tap what helps. The room can shape plans around it.",
      labels: {
        listen_first: "Listen first",
        quiet_pace: "Quiet pace",
        easy_access: "Easy access",
        seating: "Place to sit",
        transport_help: "Transport help",
        arrival_buddy: "Meet together",
        clear_cost: "Know cost first",
      },
    };
  }

  return {
    title: "Que lo haria comodo?",
    body: "Toca lo que ayuda. La sala puede adaptar los planes.",
    labels: {
      listen_first: "Escuchar primero",
      quiet_pace: "Ritmo tranquilo",
      easy_access: "Acceso facil",
      seating: "Sentarse",
      transport_help: "Ayuda para llegar",
      arrival_buddy: "Quedar juntos",
      clear_cost: "Saber coste antes",
    },
  };
}

function buildComfortCheck(
  userId: string,
  roomSlug: string,
  language: SocialLanguage,
  persistedNeeds: Map<string, SocialRoomComfortNeed[]> = new Map(),
): SocialRoomComfortCheck {
  const copy = comfortCheckCopy(language);
  const needsByUser = new Map<string, SocialRoomComfortNeed[]>();

  for (const [memberId, needs] of persistedNeeds.entries()) {
    needsByUser.set(memberId, normalizeComfortNeeds(needs));
  }
  for (const [memberId, needs] of memoryComfortNeedEntries(roomSlug)) {
    needsByUser.set(memberId, normalizeComfortNeeds(needs));
  }

  const myComfortNeeds = normalizeComfortNeeds(needsByUser.get(userId) ?? memoryComfortNeeds(userId, roomSlug));
  if (myComfortNeeds.length > 0) {
    needsByUser.set(userId, myComfortNeeds);
  }

  const counts = new Map<SocialRoomComfortNeed, number>(COMFORT_NEED_OPTIONS.map((need) => [need, 0]));
  let totalResponses = 0;
  for (const needs of needsByUser.values()) {
    const uniqueNeeds = normalizeComfortNeeds(needs);
    if (uniqueNeeds.length === 0) continue;
    totalResponses += 1;
    for (const need of uniqueNeeds) {
      counts.set(need, (counts.get(need) ?? 0) + 1);
    }
  }

  return {
    title: copy.title,
    body: copy.body,
    options: COMFORT_NEED_OPTIONS.map((need) => ({
      id: need,
      label: copy.labels[need],
      count: counts.get(need) ?? 0,
    })),
    myComfortNeeds,
    totalResponses,
  };
}

function pollDirection(poll: SocialRoomPoll) {
  if (poll.totalVotes <= 0 || poll.options.length === 0) {
    return { leadingOption: null, tiedOptions: [] };
  }

  const topVotes = Math.max(...poll.options.map((option) => option.votes));
  if (topVotes <= 0) return { leadingOption: null, tiedOptions: [] };

  const topOptions = poll.options.filter((option) => option.votes === topVotes);
  return topOptions.length === 1
    ? { leadingOption: topOptions[0], tiedOptions: [] }
    : { leadingOption: null, tiedOptions: topOptions };
}

function topComfortLabels(comfortCheck: SocialRoomComfortCheck) {
  return [...comfortCheck.options]
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((option) => option.label);
}

function countedComfortOptions(comfortCheck: SocialRoomComfortCheck) {
  return [...comfortCheck.options]
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count);
}

function joiningSupportCueCopy(language: SocialLanguage) {
  if (language === "de") {
    return {
      generalTitle: "Mitmachen leichter machen",
      generalBody: (labels: string[]) => labels.length
        ? `VYVA kann aus ${labels.join(", ")} einen einfachen naechsten Schritt ohne Druck machen.`
        : "Wenn Mitmachen heute schwer wirkt, hilft VYVA mit einem einfachen ersten Schritt.",
      generalAction: "Hilfe zum Mitmachen fragen",
      generalDraft: (labels: string[]) => labels.length
        ? `VYVA, bitte mach den naechsten Schritt im Raum leichter mit ${labels.join(", ")}. Kontakt bleibt privat und du nutzt Summen, keine Namen.`
        : "VYVA, bitte hilf mir, heute den leichtesten sicheren Weg in diesen Raum zu finden. Kontakt bleibt privat und du nutzt Summen, keine Namen.",
      arrivalTitle: "Sicher ankommen",
      arrivalBody: "Hinkommen oder gemeinsam ankommen kann wichtig sein. VYVA kann das planen, ohne privaten Kontakt zu teilen.",
      arrivalAction: "Hilfe beim Ankommen fragen",
      arrivalDraft: "VYVA, bitte plane den naechsten Schritt so, dass Menschen mit Transportbedarf oder Ankunfts-Begleitung sicher mitmachen koennen. Kontakt bleibt in VYVA, bis beide zustimmen.",
      accessTitle: "Zugang und Sitzplatz klaeren",
      accessBody: "Zugang oder Sitzplatz kann wichtig sein. VYVA kann Ort und Tempo klaeren, bevor jemand sich festlegt.",
      accessAction: "Zugangshilfe fragen",
      accessDraft: "VYVA, bitte pruefe Zugang, Sitzplatz und ruhiges Tempo fuer den naechsten Plan. Nutze Summen, keine Namen, und halte Kontakt privat.",
      costTitle: "Kosten zuerst klaeren",
      costBody: "Kosten sind ein Komfortsignal. VYVA kann einen klaren Preis klaeren, bevor sich jemand verpflichtet.",
      costAction: "Kosten pruefen lassen",
      costDraft: "VYVA, bitte klaere Kosten, Zahlungsdetails und sichere naechste Schritte, bevor jemand zusagt. Nutze Summen, keine Namen.",
      privacyLine: "Diese Frage geht an VYVA. Der Raum sieht weiter nur Summen, keine Namen.",
    };
  }

  if (language === "en") {
    return {
      generalTitle: "Make joining easier",
      generalBody: (labels: string[]) => labels.length
        ? `VYVA can turn ${labels.join(", ")} into one simple no-pressure joining plan.`
        : "If joining feels hard today, VYVA can help choose one easy first step.",
      generalAction: "Ask for joining help",
      generalDraft: (labels: string[]) => labels.length
        ? `VYVA, please help make the next room step easy around ${labels.join(", ")}. Keep contact private and use totals, not names.`
        : "VYVA, please help me find the easiest safe way to join this room today. Keep contact private and use totals, not names.",
      arrivalTitle: "Safe arrival support",
      arrivalBody: "Transport or arriving together may matter. VYVA can shape this without sharing private contact.",
      arrivalAction: "Ask for arrival help",
      arrivalDraft: "VYVA, please shape the next activity so people who need transport or an arrival buddy can join safely. Keep contact inside VYVA until both people agree.",
      accessTitle: "Access and seating help",
      accessBody: "Access or a place to sit may matter. VYVA can check place and pace before anyone commits.",
      accessAction: "Ask for access help",
      accessDraft: "VYVA, please check access, seating, and a quiet pace for the next plan. Use totals, not names, and keep contact private.",
      costTitle: "Cost clarity first",
      costBody: "Cost is a comfort signal. VYVA can ask for a clear price before anyone commits.",
      costAction: "Ask to check cost",
      costDraft: "VYVA, please clarify cost, payment details, and safe next steps before anyone commits. Use totals, not names.",
      privacyLine: "This asks VYVA only. The room still sees totals, not names.",
    };
  }

  return {
    generalTitle: "Hacer mas facil participar",
    generalBody: (labels: string[]) => labels.length
      ? `VYVA puede convertir ${labels.join(", ")} en un paso sencillo y sin presion.`
      : "Si participar hoy parece dificil, VYVA puede ayudar con un primer paso facil.",
    generalAction: "Pedir ayuda para participar",
    generalDraft: (labels: string[]) => labels.length
      ? `VYVA, ayuda a que el siguiente paso de la sala sea facil con ${labels.join(", ")}. Manten el contacto privado y usa totales, no nombres.`
      : "VYVA, ayudame a encontrar la forma mas facil y segura de participar hoy en esta sala. Manten el contacto privado y usa totales, no nombres.",
    arrivalTitle: "Llegar con seguridad",
    arrivalBody: "El transporte o llegar juntos puede importar. VYVA puede prepararlo sin compartir contacto privado.",
    arrivalAction: "Pedir ayuda para llegar",
    arrivalDraft: "VYVA, prepara la proxima actividad para que quienes necesiten transporte o llegar acompanados puedan participar con seguridad. Manten el contacto dentro de VYVA hasta que ambas personas acepten.",
    accessTitle: "Acceso y asiento",
    accessBody: "El acceso o un sitio para sentarse puede importar. VYVA puede revisar lugar y ritmo antes de que nadie se comprometa.",
    accessAction: "Pedir ayuda de acceso",
    accessDraft: "VYVA, revisa acceso, asiento y ritmo tranquilo para el proximo plan. Usa totales, no nombres, y manten el contacto privado.",
    costTitle: "Coste claro primero",
    costBody: "El coste es una senal de comodidad. VYVA puede pedir un precio claro antes de que nadie se comprometa.",
    costAction: "Pedir revision de coste",
    costDraft: "VYVA, aclara coste, detalles de pago y proximos pasos seguros antes de que nadie se comprometa. Usa totales, no nombres.",
    privacyLine: "Esto solo pregunta a VYVA. La sala sigue viendo totales, no nombres.",
  };
}

function buildJoiningSupportCue(
  language: SocialLanguage,
  comfortCheck: SocialRoomComfortCheck,
): SocialRoomJoiningSupportCue {
  const copy = joiningSupportCueCopy(language);
  const countedOptions = countedComfortOptions(comfortCheck);
  const countedNeedIds = countedOptions.map((option) => option.id);
  const topLabels = countedOptions.slice(0, 2).map((option) => option.label);
  const hasArrivalNeed = countedNeedIds.includes("transport_help") || countedNeedIds.includes("arrival_buddy");
  const hasAccessNeed = countedNeedIds.includes("easy_access") || countedNeedIds.includes("seating");
  const hasCostNeed = countedNeedIds.includes("clear_cost");

  if (hasArrivalNeed) {
    return {
      id: "arrival-support",
      title: copy.arrivalTitle,
      body: copy.arrivalBody,
      actionLabel: copy.arrivalAction,
      draft: copy.arrivalDraft,
      privacyLine: copy.privacyLine,
      needIds: countedNeedIds,
    };
  }

  if (hasCostNeed) {
    return {
      id: "cost-support",
      title: copy.costTitle,
      body: copy.costBody,
      actionLabel: copy.costAction,
      draft: copy.costDraft,
      privacyLine: copy.privacyLine,
      needIds: countedNeedIds,
    };
  }

  if (hasAccessNeed) {
    return {
      id: "access-support",
      title: copy.accessTitle,
      body: copy.accessBody,
      actionLabel: copy.accessAction,
      draft: copy.accessDraft,
      privacyLine: copy.privacyLine,
      needIds: countedNeedIds,
    };
  }

  return {
    id: countedNeedIds.length > 0 ? "comfort-support" : "gentle-joining-support",
    title: copy.generalTitle,
    body: copy.generalBody(topLabels),
    actionLabel: copy.generalAction,
    draft: copy.generalDraft(topLabels),
    privacyLine: copy.privacyLine,
    needIds: countedNeedIds,
  };
}

function decisionGuideCopy(language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "Naechster sicherer Schritt",
      waitingBody: "Waehle eine Stimme oder tippe an, was hilft. VYVA macht daraus einen ruhigen naechsten Schritt.",
      viewBody: "Der Raum tendiert dazu, Ansichten zu teilen. Bleibt freundlich und ohne private Kontaktdaten.",
      tieBody: (labels: string[], needs: string[]) => {
        const comfort = needs.length ? ` Plant es mit ${needs.join(", ")}.` : "";
        return `Der Raum waehlt noch zwischen ${labels.join(" | ")}.${comfort}`;
      },
      planBody: (choice: string, needs: string[]) => {
        const comfort = needs.length ? ` mit ${needs.join(", ")}` : "";
        return `Der Raum tendiert zu ${choice}. VYVA kann daraus einen einfachen Plan${comfort} machen.`;
      },
      waitingSteps: ["Eine Option waehlen", "Komfort markieren", "Kontakt bleibt in VYVA"],
      tieSteps: (labels: string[], needs: string[]) => [
        `Gleichstand: ${labels.join(" | ")}`,
        needs.length ? `${needs.join(", ")} einplanen` : "Komfort markieren",
        "Kontakt bleibt in VYVA",
      ],
      viewSteps: ["Eine kurze Ansicht teilen", "Erst zuhoeren, wenn jemand Zeit braucht", "VYVA prueft, wenn etwas unangenehm ist"],
      planSteps: (needs: string[]) => [
        "Einen einfachen Plan bestaetigen",
        needs.length ? `${needs.join(", ")} einplanen` : "Fragen, was es angenehm macht",
        "Kontakt nur mit beidseitigem Ja",
      ],
      voteAction: "Mit einer Stimme beginnen",
      planAction: "Daraus einen Plan machen",
      viewAction: "Ansicht teilen",
    };
  }

  if (language === "en") {
    return {
      title: "Next safe step",
      waitingBody: "Choose one vote or tap what helps. VYVA will turn the room's signals into a gentle next step.",
      viewBody: "The room is leaning toward sharing views. Keep it kind and without private contact details.",
      tieBody: (labels: string[], needs: string[]) => {
        const comfort = needs.length ? ` Shape it around ${needs.join(", ")}.` : "";
        return `The room is still choosing between ${labels.join(" | ")}.${comfort}`;
      },
      planBody: (choice: string, needs: string[]) => {
        const comfort = needs.length ? ` with ${needs.join(", ")}` : "";
        return `The room is leaning toward ${choice}. VYVA can shape one simple plan${comfort}.`;
      },
      waitingSteps: ["Choose one room option", "Tap comfort needs", "Keep contact inside VYVA"],
      tieSteps: (labels: string[], needs: string[]) => [
        `Tied: ${labels.join(" | ")}`,
        needs.length ? `Keep ${needs.join(", ")} in mind` : "Tap comfort needs",
        "Keep contact inside VYVA",
      ],
      viewSteps: ["Share one short view", "Listen first if someone needs time", "Ask VYVA to review anything uncomfortable"],
      planSteps: (needs: string[]) => [
        "Confirm one simple plan",
        needs.length ? `Keep ${needs.join(", ")} in mind` : "Ask what would make it comfortable",
        "Share contact only after both agree",
      ],
      voteAction: "Start with a vote",
      planAction: "Make this a plan",
      viewAction: "Share a view",
    };
  }

  return {
    title: "Siguiente paso seguro",
    waitingBody: "Elige un voto o toca lo que ayuda. VYVA convertira las senales de la sala en un paso tranquilo.",
    viewBody: "La sala se inclina por compartir opiniones. Mantened un tono amable y sin datos privados.",
    tieBody: (labels: string[], needs: string[]) => {
      const comfort = needs.length ? ` Preparadlo con ${needs.join(", ")}.` : "";
      return `La sala aun esta eligiendo entre ${labels.join(" | ")}.${comfort}`;
    },
    planBody: (choice: string, needs: string[]) => {
      const comfort = needs.length ? ` con ${needs.join(", ")}` : "";
      return `La sala se inclina por ${choice}. VYVA puede preparar un plan sencillo${comfort}.`;
    },
    waitingSteps: ["Elegir una opcion", "Marcar comodidad", "Mantener el contacto dentro de VYVA"],
    tieSteps: (labels: string[], needs: string[]) => [
      `Empate: ${labels.join(" | ")}`,
      needs.length ? `Cuidar ${needs.join(", ")}` : "Marcar comodidad",
      "Mantener el contacto dentro de VYVA",
    ],
    viewSteps: ["Compartir una opinion breve", "Escuchar primero si alguien necesita tiempo", "Pedir revision a VYVA si algo incomoda"],
    planSteps: (needs: string[]) => [
      "Confirmar un plan sencillo",
      needs.length ? `Cuidar ${needs.join(", ")}` : "Preguntar que lo haria comodo",
      "Compartir contacto solo si ambas personas aceptan",
    ],
    voteAction: "Empezar con un voto",
    planAction: "Crear este plan",
    viewAction: "Compartir opinion",
  };
}

function buildDecisionGuide(language: SocialLanguage, poll: SocialRoomPoll, comfortCheck: SocialRoomComfortCheck) {
  const copy = decisionGuideCopy(language);
  const direction = pollDirection(poll);
  const leader = direction.leadingOption;
  const tiedLabels = direction.tiedOptions.map((option) => option.label);
  const needs = topComfortLabels(comfortCheck);

  if (tiedLabels.length > 1) {
    return {
      id: "waiting-for-clear-choice",
      title: copy.title,
      body: copy.tieBody(tiedLabels, needs),
      steps: copy.tieSteps(tiedLabels, needs),
      primaryActionLabel: copy.voteAction,
      actionKind: "vote" as const,
    };
  }

  if (!leader && needs.length === 0) {
    return {
      id: "waiting-for-signals",
      title: copy.title,
      body: copy.waitingBody,
      steps: copy.waitingSteps,
      primaryActionLabel: copy.voteAction,
      actionKind: "vote" as const,
    };
  }

  if (leader?.id === "views") {
    return {
      id: "share-views-safely",
      title: copy.title,
      body: copy.viewBody,
      steps: copy.viewSteps,
      primaryActionLabel: copy.viewAction,
      actionKind: "view" as const,
    };
  }

  return {
    id: "shape-one-plan",
    title: copy.title,
    body: leader ? copy.planBody(leader.label, needs) : copy.waitingBody,
    steps: copy.planSteps(needs),
    primaryActionLabel: copy.planAction,
    actionKind: "plan" as const,
  };
}

function activityDigestCopy(language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "Was sich im Raum bewegt",
      body: "Eine kurze Zusammenfassung ohne Namen, damit du ruhig entscheiden kannst.",
      privacyLine: "VYVA zeigt nur sichere Signale, keine privaten Entscheidungen mit Namen.",
      presenceLabel: "Ruhig dabei",
      presenceBody: (count: number) => `${count} ${count === 1 ? "Person kann" : "Personen koennen"} lesen oder mitmachen, ohne Druck.`,
      voteLabel: "Private Stimmen",
      voteBody: (count: number) => `${count} ${count === 1 ? "Stimme hilft" : "Stimmen helfen"} dem Raum, einen naechsten Schritt zu waehlen.`,
      comfortLabel: "Komfortsignale",
      comfortBody: (labels: string[]) => `Der Raum kann mit ${labels.join(", ")} planen.`,
      activityLabel: "Aktivitaeten",
      activityBody: (count: number) => `${count} ${count === 1 ? "Interesse ist" : "Interessen sind"} sichtbar, ohne Kontakt zu teilen.`,
      viewLabel: "Ansichten",
      viewBody: (count: number) => `${count} ${count === 1 ? "Ansicht kann" : "Ansichten koennen"} freundlich zusammengefasst werden.`,
      questionLabel: "Fragen fuer Abstimmung",
      questionBody: (count: number) => `${count} ${count === 1 ? "Frage kann" : "Fragen koennen"} zu privaten Stimmen werden.`,
      safetyLabel: "Sanfter Start",
      safetyBody: "Du kannst erst zuhoeren. Die wichtigsten Aktionen bleiben privat oder werden von VYVA geprueft.",
    };
  }

  if (language === "en") {
    return {
      title: "What is moving in the room",
      body: "A short no-name summary so you can decide calmly.",
      privacyLine: "VYVA shows safe signals only, never private choices with names.",
      presenceLabel: "Quietly present",
      presenceBody: (count: number) => `${count} ${count === 1 ? "person can" : "people can"} read or join without pressure.`,
      voteLabel: "Private votes",
      voteBody: (count: number) => `${count} private ${count === 1 ? "vote is" : "votes are"} helping the room choose.`,
      comfortLabel: "Comfort signals",
      comfortBody: (labels: string[]) => `The room can shape plans around ${labels.join(", ")}.`,
      activityLabel: "Activities",
      activityBody: (count: number) => `${count} interest ${count === 1 ? "signal is" : "signals are"} visible without sharing contact.`,
      viewLabel: "Views",
      viewBody: (count: number) => `${count} kind ${count === 1 ? "view can" : "views can"} be summarized calmly.`,
      questionLabel: "Questions for voting",
      questionBody: (count: number) => `${count} supported ${count === 1 ? "question can" : "questions can"} become private votes.`,
      safetyLabel: "Gentle start",
      safetyBody: "You can listen first. The main actions stay private or close to VYVA review.",
    };
  }

  return {
    title: "Lo que se mueve en la sala",
    body: "Un resumen breve sin nombres para decidir con calma.",
    privacyLine: "VYVA muestra solo senales seguras, nunca decisiones privadas con nombres.",
    presenceLabel: "Presentes con calma",
    presenceBody: (count: number) => `${count} ${count === 1 ? "persona puede" : "personas pueden"} leer o participar sin presion.`,
    voteLabel: "Votos privados",
    voteBody: (count: number) => `${count} ${count === 1 ? "voto privado ayuda" : "votos privados ayudan"} a elegir el siguiente paso.`,
    comfortLabel: "Senales de comodidad",
    comfortBody: (labels: string[]) => `La sala puede preparar planes con ${labels.join(", ")}.`,
    activityLabel: "Actividades",
    activityBody: (count: number) => `${count} ${count === 1 ? "senal de interes esta" : "senales de interes estan"} visibles sin compartir contacto.`,
    viewLabel: "Opiniones",
    viewBody: (count: number) => `${count} ${count === 1 ? "opinion amable puede" : "opiniones amables pueden"} resumirse con calma.`,
    questionLabel: "Preguntas para votar",
    questionBody: (count: number) => `${count} ${count === 1 ? "pregunta apoyada puede" : "preguntas apoyadas pueden"} pasar a votos privados.`,
    safetyLabel: "Empezar suave",
    safetyBody: "Puedes escuchar primero. Las acciones principales siguen privadas o cerca de la revision de VYVA.",
  };
}

function activePlanResponseTotal(plan: SocialRoomPlan) {
  return (plan.responseCounts?.join ?? 0) + (plan.responseCounts?.maybe ?? 0);
}

function buildActivityDigest(input: {
  language: SocialLanguage;
  activePoll: SocialRoomPoll;
  issuePolls: SocialRoomPoll[];
  comfortCheck: SocialRoomComfortCheck;
  featuredPlan: SocialRoomPlan;
  secondaryPlans: SocialRoomPlan[];
  postedExperiences: SocialRoomPlan[];
  memberPresence: SocialRoomMember[];
}): NonNullable<SocialRoomPulse["activityDigest"]> {
  const copy = activityDigestCopy(input.language);
  const roomPlans = [input.featuredPlan, ...input.secondaryPlans, ...input.postedExperiences];
  const activityInterestCount = roomPlans
    .filter((plan) => normalizePlanKind(plan.kind) === "plan" && plan.status === "active")
    .reduce((sum, plan) => sum + activePlanResponseTotal(plan), 0);
  const sharedViewCount = input.postedExperiences.filter((plan) => (
    normalizePlanKind(plan.kind) === "message" && plan.status === "active"
  )).length;
  const supportedQuestionCount = Math.max(
    input.issuePolls.length,
    input.postedExperiences.filter((plan) => (
      normalizePlanKind(plan.kind) === "question"
      && plan.status === "active"
      && activePlanResponseTotal(plan) > 0
    )).length,
  );
  const comfortLabels = topComfortLabels(input.comfortCheck);
  const items: NonNullable<SocialRoomPulse["activityDigest"]>["items"] = [];

  items.push({
    id: "presence",
    kind: "presence",
    label: copy.presenceLabel,
    body: copy.presenceBody(Math.max(1, input.memberPresence.length)),
    count: input.memberPresence.length,
    private: true,
  });

  if (input.activePoll.totalVotes > 0) {
    items.push({
      id: "vote",
      kind: "vote",
      label: copy.voteLabel,
      body: copy.voteBody(input.activePoll.totalVotes),
      count: input.activePoll.totalVotes,
      private: true,
    });
  }

  if (comfortLabels.length > 0) {
    items.push({
      id: "comfort",
      kind: "comfort",
      label: copy.comfortLabel,
      body: copy.comfortBody(comfortLabels),
      count: input.comfortCheck.totalResponses,
      private: true,
    });
  }

  if (activityInterestCount > 0) {
    items.push({
      id: "activity",
      kind: "activity",
      label: copy.activityLabel,
      body: copy.activityBody(activityInterestCount),
      count: activityInterestCount,
      private: true,
    });
  }

  if (sharedViewCount > 0) {
    items.push({
      id: "view",
      kind: "view",
      label: copy.viewLabel,
      body: copy.viewBody(sharedViewCount),
      count: sharedViewCount,
    });
  }

  if (supportedQuestionCount > 0) {
    items.push({
      id: "question",
      kind: "question",
      label: copy.questionLabel,
      body: copy.questionBody(supportedQuestionCount),
      count: supportedQuestionCount,
      private: true,
    });
  }

  if (items.length === 1) {
    items.push({
      id: "safety",
      kind: "safety",
      label: copy.safetyLabel,
      body: copy.safetyBody,
      private: true,
    });
  }

  return {
    title: copy.title,
    body: copy.body,
    privacyLine: copy.privacyLine,
    updatedAt: new Date().toISOString(),
    items: items.slice(0, 4),
  };
}

function seededPlanCounts(planKey: string) {
  const counts = emptyPlanCounts();
  for (const [key, response] of planResponses.entries()) {
    if (!key.endsWith(`:${planKey}`)) continue;
    counts[response] += 1;
  }
  return counts;
}

function memoryRepliesForPlan(planKey: string, roomSlug: string, language: SocialLanguage, userId: string): SocialRoomReply[] {
  return memoryReplies
    .filter((reply) => reply.planKey === planKey && reply.roomSlug === publicRoomId(roomSlug) && reply.status === "active")
    .slice(0, 3)
    .map((reply) => publicReply(reply, language, userId));
}

function publicReply(reply: MemoryReply, language: SocialLanguage, userId?: string): SocialRoomReply {
  return {
    id: reply.id,
    planKey: reply.planKey,
    authorName: replyAuthorName(language),
    body: reply.body,
    tone: reply.tone,
    status: reply.status,
    ownedByMe: reply.userId === userId,
    createdAt: reply.createdAt,
  };
}

function helperActionForReplyBody(body: string): SocialRoomPlanHelperAction | null {
  const normalized = body.trim();
  for (const language of Object.keys(PLAN_HELPER_REPLY_BODIES) as SocialLanguage[]) {
    for (const action of PLAN_HELPER_ACTIONS) {
      if (PLAN_HELPER_REPLY_BODIES[language][action] === normalized) return action;
    }
  }
  return null;
}

function helperBodiesForAction(action: SocialRoomPlanHelperAction) {
  return (Object.keys(PLAN_HELPER_REPLY_BODIES) as SocialLanguage[])
    .map((language) => PLAN_HELPER_REPLY_BODIES[language][action]);
}

function uniqueHelperActions(actions: Array<SocialRoomPlanHelperAction | null>) {
  return PLAN_HELPER_ACTIONS.filter((action) => actions.includes(action));
}

function existingMemoryReply(planKey: string, roomSlug: string, userId: string, body: string) {
  const publicSlug = publicRoomId(roomSlug);
  return memoryReplies.find((reply) => (
    reply.planKey === planKey
    && reply.roomSlug === publicSlug
    && reply.userId === userId
    && reply.body === body
    && reply.status === "active"
  )) ?? null;
}

function memoryHelperActionsForPlan(planKey: string, roomSlug: string, userId: string) {
  return uniqueHelperActions(
    memoryReplies
      .filter((reply) => (
        reply.planKey === planKey
        && reply.roomSlug === publicRoomId(roomSlug)
        && reply.userId === userId
        && reply.status === "active"
      ))
      .map((reply) => helperActionForReplyBody(reply.body)),
  );
}

function proposalToPlan(proposal: MemoryProposal, userId: string, language: SocialLanguage): SocialRoomPlan {
  return {
    id: proposal.planKey,
    key: proposal.planKey,
    kind: proposal.kind,
    title: proposal.title,
    body: proposal.details,
    locationLabel: proposal.locationLabel,
    comfortNeeds: proposal.comfortNeeds,
    experienceCategory: proposal.experienceCategory,
    preferredTime: proposal.preferredTime,
    costRange: proposal.costRange,
    groupSize: proposal.groupSize,
    safetyFlags: proposal.safetyFlags,
    needsReview: proposal.needsReview,
    fitReasons: buildFitReasons(proposal, language),
    startsAt: null,
    status: proposal.status,
    source: "user",
    createdBy: proposal.userId,
    ownedByMe: proposal.userId === userId,
    createdAt: proposal.createdAt,
    responseCounts: seededPlanCounts(proposal.planKey),
    myResponse: planResponses.get(responseKey(userId, proposal.planKey)) ?? null,
    myHelperActions: memoryHelperActionsForPlan(proposal.planKey, proposal.roomSlug, userId),
    replies: memoryRepliesForPlan(proposal.planKey, proposal.roomSlug, language, userId),
  };
}

function memoryPostedExperiences(roomSlug: string, userId: string, language: SocialLanguage) {
  return proposals
    .filter((proposal) => proposal.roomSlug === publicRoomId(roomSlug) && proposal.status === "active")
    .map((proposal) => proposalToPlan(proposal, userId, language));
}

function pushMemoryNotification(input: Omit<MemoryNotification, "id" | "createdAt" | "readAt">) {
  memoryNotifications.unshift({
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function pushMemoryModerationAction(input: Omit<MemoryModerationAction, "id" | "created_at">) {
  memoryModerationActions.unshift({
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  });
}

function memoryNotificationsFor(userId: string, roomSlug: string): SocialRoomNotification[] {
  return memoryNotifications
    .filter((notification) => (
      notification.userId === userId &&
      notification.roomSlug === publicRoomId(roomSlug) &&
      !notification.readAt
    ))
    .slice(0, 3)
    .map(({ userId: _userId, roomSlug: _roomSlug, ...notification }) => notification);
}

function memoryUnreadNotificationCountFor(userId: string, roomSlug: string) {
  return memoryNotifications.filter((notification) => (
    notification.userId === userId &&
    notification.roomSlug === publicRoomId(roomSlug) &&
    !notification.readAt
  )).length;
}

function notificationMetadata(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

async function createAutomaticSafetyReport(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  reason: string;
  details: string;
  targetType: SocialRoomSafetyReportTargetType;
  targetId?: string | null;
}) {
  const duplicateMemoryReport = existingMemorySafetyReport({
    userId: input.userId,
    roomSlug: input.roomSlug,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details,
  });
  if (duplicateMemoryReport) return duplicateMemoryReport;

  const duplicateDbReport = input.roomId
    ? await existingDbSafetyReport({
        userId: input.userId,
        roomSlug: input.roomSlug,
        roomId: input.roomId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details,
      })
    : null;
  const duplicateAfterDbReport = existingMemorySafetyReport({
    userId: input.userId,
    roomSlug: input.roomSlug,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details,
  });
  if (duplicateAfterDbReport) return duplicateAfterDbReport;
  if (duplicateDbReport) return duplicateDbReport;

  const report: MemoryReport = {
    id: randomUUID(),
    roomSlug: publicRoomId(input.roomSlug),
    reporterId: input.userId,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    reason: input.reason,
    details: input.details,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  reports.unshift(report);

  if (input.roomId) {
    await safeDb(
      "create automatic safety report",
      async () => {
        await db.insert(socialRoomSafetyReports).values({
          id: report.id,
          room_id: input.roomId!,
          reporter_id: input.userId,
          target_type: input.targetType,
          target_id: input.targetId ?? null,
          reason: input.reason,
          details: input.details,
        });
      },
      async () => undefined,
    );
  }

  return report;
}

function planResponseNotificationCopy(
  response: SocialRoomPlanInterestResponseValue,
  planTitle: string,
  language: SocialLanguage,
) {
  if (language === "de") {
    return {
      title: response === "join" ? "Jemand macht bei deiner Idee mit" : "Jemand merkt sich deine Idee",
      body: response === "join"
        ? `"${planTitle}" hat neue Begleitung.`
        : `"${planTitle}" wurde fuer spaeter gemerkt.`,
    };
  }

  if (language === "en") {
    return {
      title: response === "join" ? "Someone joined your idea" : "Someone saved your idea",
      body: response === "join"
        ? `"${planTitle}" has new company.`
        : `"${planTitle}" was saved for later.`,
    };
  }

  return {
    title: response === "join" ? "Alguien se apunto a tu idea" : "Alguien guardo tu idea",
    body: response === "join"
      ? `"${planTitle}" tiene nueva compania.`
      : `"${planTitle}" se guardo para luego.`,
  };
}

function replyNotificationCopy(planTitle: string, replyBody: string, language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "Jemand hat behutsam geantwortet",
      body: `"${planTitle}": ${replyBody}`,
    };
  }

  if (language === "en") {
    return {
      title: "Someone replied gently",
      body: `"${planTitle}": ${replyBody}`,
    };
  }

  return {
    title: "Alguien respondio con cuidado",
    body: `"${planTitle}": ${replyBody}`,
  };
}

function activityReadyNotificationCopy(planTitle: string, language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "Diese Aktivitaet ist bereit fuer VYVA",
      body: `"${planTitle}" hat Interesse, Komfortwunsch und eine kleine Hilfe. VYVA kann Details bestaetigen, bevor sich jemand festlegt.`,
    };
  }

  if (language === "en") {
    return {
      title: "This activity is ready for VYVA",
      body: `"${planTitle}" has interest, comfort notes, and a helper. VYVA can confirm details before anyone commits.`,
    };
  }

  return {
    title: "Esta actividad esta lista para VYVA",
    body: `"${planTitle}" tiene interes, comodidad y una ayuda. VYVA puede confirmar detalles antes de que nadie se comprometa.`,
  };
}

function voteReadyNotificationCopy(questionTitle: string, language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "Diese Frage ist bereit fuer eine Abstimmung",
      body: `"${questionTitle}" bekommt Unterstuetzung. VYVA kann daraus eine einfache, sichere Raumabstimmung ohne Namen machen.`,
    };
  }

  if (language === "en") {
    return {
      title: "This question is ready for a vote",
      body: `"${questionTitle}" is getting support. VYVA can turn it into one simple, safe room vote without names.`,
    };
  }

  return {
    title: "Esta pregunta esta lista para votar",
    body: `"${questionTitle}" recibe apoyo. VYVA puede convertirla en una votacion sencilla y segura sin nombres.`,
  };
}

function memoryPlanReadiness(planKey: string, roomSlug: string, language: SocialLanguage) {
  const seedPlan = seedPlans.find((plan) => plan.key === planKey);
  const memoryPlan = proposals.find((proposal) => proposal.planKey === planKey && proposal.roomSlug === publicRoomId(roomSlug));
  const title = memoryPlan?.title ?? (seedPlan ? localize(seedPlan.title, language) : planKey);
  const kind = memoryPlan?.kind ?? "plan";
  const active = memoryPlan ? memoryPlan.status === "active" : true;
  const comfortNeeds = memoryPlan?.comfortNeeds ?? seedPlan?.comfortNeeds ?? [];
  const counts = seededPlanCounts(planKey);
  const interestCount = counts.join + counts.maybe;
  const helperCount = memoryReplies.filter((reply) => (
    reply.planKey === planKey &&
    reply.roomSlug === publicRoomId(roomSlug) &&
    reply.status === "active"
  )).length;

  return {
    ready: kind === "plan" && active && comfortNeeds.length > 0 && interestCount > 0 && helperCount > 0,
    title,
    interestCount,
    helperCount,
  };
}

function pushMemoryActivityReadyNotification(input: {
  userId: string;
  roomSlug: string;
  planKey: string;
  language: SocialLanguage;
}) {
  const readiness = memoryPlanReadiness(input.planKey, input.roomSlug, input.language);
  if (!readiness.ready) return;

  const existing = memoryNotifications.some((notification) => (
    notification.userId === input.userId &&
    notification.roomSlug === publicRoomId(input.roomSlug) &&
    notification.type === "activity_ready" &&
    notification.metadata?.planKey === input.planKey
  ));
  if (existing) return;

  const copy = activityReadyNotificationCopy(readiness.title, input.language);
  pushMemoryNotification({
    userId: input.userId,
    roomSlug: input.roomSlug,
    type: "activity_ready",
    title: copy.title,
    body: copy.body,
    metadata: {
      planKey: input.planKey,
      interestCount: readiness.interestCount,
      helperCount: readiness.helperCount,
    },
  });
}

function memoryActivityReadyAudience(input: {
  userId: string;
  roomSlug: string;
  planKey: string;
}) {
  const publicSlug = publicRoomId(input.roomSlug);
  const audience = new Set<string>([input.userId]);
  const memoryPlan = proposals.find((proposal) => (
    proposal.planKey === input.planKey &&
    proposal.roomSlug === publicSlug
  ));
  if (memoryPlan?.userId) audience.add(memoryPlan.userId);

  for (const [key, response] of planResponses.entries()) {
    if (!isPlanInterestResponse(response)) continue;
    const responseUserId = userIdFromPlanResponseKey(key, input.planKey);
    if (responseUserId) audience.add(responseUserId);
  }

  for (const reply of memoryReplies) {
    if (
      reply.planKey === input.planKey &&
      reply.roomSlug === publicSlug &&
      reply.status === "active"
    ) {
      audience.add(reply.userId);
    }
  }

  return Array.from(audience);
}

function memoryQuestionVoteReadiness(planKey: string, roomSlug: string) {
  const question = proposals.find((proposal) => (
    proposal.planKey === planKey &&
    proposal.roomSlug === publicRoomId(roomSlug) &&
    proposal.kind === "question" &&
    proposal.status === "active"
  ));
  if (!question) return null;

  const counts = seededPlanCounts(planKey);
  const supportCount = counts.join + counts.maybe;
  return {
    ready: supportCount > 0,
    title: question.title,
    supportCount,
  };
}

function pushMemoryVoteReadyNotification(input: {
  userId: string;
  roomSlug: string;
  planKey: string;
  language: SocialLanguage;
}) {
  const readiness = memoryQuestionVoteReadiness(input.planKey, input.roomSlug);
  if (!readiness?.ready) return;

  const existing = memoryNotifications.some((notification) => (
    notification.userId === input.userId &&
    notification.roomSlug === publicRoomId(input.roomSlug) &&
    notification.type === "vote_ready" &&
    notification.metadata?.planKey === input.planKey
  ));
  if (existing) return;

  const copy = voteReadyNotificationCopy(readiness.title, input.language);
  pushMemoryNotification({
    userId: input.userId,
    roomSlug: input.roomSlug,
    type: "vote_ready",
    title: copy.title,
    body: copy.body,
    metadata: {
      planKey: input.planKey,
      supportCount: readiness.supportCount,
    },
  });
}

function memoryVoteReadyAudience(input: {
  userId: string;
  roomSlug: string;
  planKey: string;
}) {
  const publicSlug = publicRoomId(input.roomSlug);
  const audience = new Set<string>([input.userId]);
  const question = proposals.find((proposal) => (
    proposal.planKey === input.planKey &&
    proposal.roomSlug === publicSlug &&
    proposal.kind === "question"
  ));
  if (question?.userId) audience.add(question.userId);

  for (const [key, response] of planResponses.entries()) {
    if (!isPlanInterestResponse(response)) continue;
    const responseUserId = userIdFromPlanResponseKey(key, input.planKey);
    if (responseUserId) audience.add(responseUserId);
  }

  return Array.from(audience);
}

async function createDbActivityReadyNotification(input: {
  userId: string;
  roomId: string;
  planKey: string;
  language: SocialLanguage;
}) {
  await ensureSeedRows(input.roomId);
  const [plan] = await db
    .select()
    .from(socialRoomPlans)
    .where(and(eq(socialRoomPlans.room_id, input.roomId), eq(socialRoomPlans.plan_key, input.planKey)))
    .limit(1);
  if (!plan || plan.status !== "active" || normalizePlanKind(plan.kind) !== "plan") return;

  const comfortNeeds = normalizeComfortNeeds(plan.comfort_needs);
  if (comfortNeeds.length === 0) return;

  const responses = await db
    .select({ userId: socialRoomPlanResponses.user_id })
    .from(socialRoomPlanResponses)
    .where(and(
      eq(socialRoomPlanResponses.plan_id, plan.id),
      inArray(socialRoomPlanResponses.response, ["join", "maybe"]),
    ));
  if (responses.length === 0) return;

  const helpers = await db
    .select({ userId: socialRoomReplies.user_id })
    .from(socialRoomReplies)
    .where(and(eq(socialRoomReplies.plan_id, plan.id), eq(socialRoomReplies.status, "active")));
  if (helpers.length === 0) return;

  const audience = new Set<string>([
    input.userId,
    ...(plan.created_by ? [plan.created_by] : []),
    ...responses.map((response) => response.userId),
    ...helpers.map((helper) => helper.userId),
  ]);

  const existing = await db
    .select({
      userId: socialRoomNotifications.user_id,
      metadata: socialRoomNotifications.metadata,
    })
    .from(socialRoomNotifications)
    .where(and(
      eq(socialRoomNotifications.room_id, input.roomId),
      eq(socialRoomNotifications.type, "activity_ready"),
    ));
  const alreadyNotified = new Set(existing
    .filter((notification) => (
      ((notification.metadata ?? {}) as Record<string, unknown>).planKey === input.planKey
    ))
    .map((notification) => notification.userId));

  const copy = activityReadyNotificationCopy(rowPlanTitle(plan, input.language), input.language);
  const values = Array.from(audience)
    .filter((userId) => !alreadyNotified.has(userId))
    .map((userId) => ({
      user_id: userId,
      room_id: input.roomId,
      type: "activity_ready",
      title: copy.title,
      body: copy.body,
      metadata: {
        planKey: input.planKey,
        interestCount: responses.length,
        helperCount: helpers.length,
      },
    }));
  if (values.length > 0) {
    await db.insert(socialRoomNotifications).values(values);
  }
}

async function createDbVoteReadyNotification(input: {
  userId: string;
  roomId: string;
  planKey: string;
  language: SocialLanguage;
}) {
  await ensureSeedRows(input.roomId);
  const [plan] = await db
    .select()
    .from(socialRoomPlans)
    .where(and(eq(socialRoomPlans.room_id, input.roomId), eq(socialRoomPlans.plan_key, input.planKey)))
    .limit(1);
  if (!plan || plan.status !== "active" || normalizePlanKind(plan.kind) !== "question") return;

  const responses = await db
    .select({ userId: socialRoomPlanResponses.user_id })
    .from(socialRoomPlanResponses)
    .where(and(
      eq(socialRoomPlanResponses.plan_id, plan.id),
      inArray(socialRoomPlanResponses.response, ["join", "maybe"]),
    ));
  if (responses.length === 0) return;

  const audience = new Set<string>([
    input.userId,
    ...(plan.created_by ? [plan.created_by] : []),
    ...responses.map((response) => response.userId),
  ]);

  const existing = await db
    .select({
      userId: socialRoomNotifications.user_id,
      metadata: socialRoomNotifications.metadata,
    })
    .from(socialRoomNotifications)
    .where(and(
      eq(socialRoomNotifications.room_id, input.roomId),
      eq(socialRoomNotifications.type, "vote_ready"),
    ));
  const alreadyNotified = new Set(existing
    .filter((notification) => (
      ((notification.metadata ?? {}) as Record<string, unknown>).planKey === input.planKey
    ))
    .map((notification) => notification.userId));

  const copy = voteReadyNotificationCopy(rowPlanTitle(plan, input.language), input.language);
  const values = Array.from(audience)
    .filter((userId) => !alreadyNotified.has(userId))
    .map((userId) => ({
      user_id: userId,
      room_id: input.roomId,
      type: "vote_ready",
      title: copy.title,
      body: copy.body,
      metadata: {
        planKey: input.planKey,
        supportCount: responses.length,
      },
    }));
  if (values.length > 0) {
    await db.insert(socialRoomNotifications).values(values);
  }
}

async function notifyActivityReady(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  planKey: string;
  language: SocialLanguage;
}) {
  memoryActivityReadyAudience(input).forEach((userId) => {
    pushMemoryActivityReadyNotification({ ...input, userId });
  });

  if (!input.roomId) return;
  await safeDb(
    "create activity ready notification",
    () => createDbActivityReadyNotification({
      userId: input.userId,
      roomId: input.roomId!,
      planKey: input.planKey,
      language: input.language,
    }),
    async () => undefined,
  );
}

async function notifyQuestionVoteReady(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  planKey: string;
  language: SocialLanguage;
}) {
  memoryVoteReadyAudience(input).forEach((userId) => {
    pushMemoryVoteReadyNotification({ ...input, userId });
  });

  if (!input.roomId) return;
  await safeDb(
    "create vote ready notification",
    () => createDbVoteReadyNotification({
      userId: input.userId,
      roomId: input.roomId!,
      planKey: input.planKey,
      language: input.language,
    }),
    async () => undefined,
  );
}

function safetyReportNotificationCopy(language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "VYVA prueft deine Anfrage",
      body: "Deine Hilfe-Anfrage ist gespeichert. Der Raum sieht diese Meldung nicht.",
    };
  }

  if (language === "en") {
    return {
      title: "VYVA will review your request",
      body: "Your help request is saved. The room will not see this report.",
    };
  }

  return {
    title: "VYVA revisara tu solicitud",
    body: "Tu solicitud de ayuda esta guardada. La sala no vera este aviso.",
  };
}

function safetyReportReviewNotificationCopy(status: string, language: SocialLanguage) {
  if (language === "de") {
    if (status === "resolved") {
      return {
        title: "VYVA hat deine Meldung geprueft",
        body: "Danke. VYVA hat sich darum gekuemmert und deine Angaben privat gehalten.",
      };
    }
    if (status === "dismissed") {
      return {
        title: "VYVA hat deine Meldung angesehen",
        body: "VYVA musste nichts weiter tun. Deine Meldung blieb privat.",
      };
    }
    if (status === "open") {
      return {
        title: "VYVA laesst deine Meldung offen",
        body: "Deine Meldung bleibt fuer weitere Pruefung gespeichert. Der Raum sieht nicht, wer sie gesendet hat.",
      };
    }
    return {
      title: "VYVA prueft deine Meldung",
      body: "Deine Meldung wird privat geprueft. Der Raum sieht nicht, wer sie gesendet hat.",
    };
  }

  if (language === "en") {
    if (status === "resolved") {
      return {
        title: "VYVA reviewed your report",
        body: "Thank you. VYVA has taken care of this report and kept your details private.",
      };
    }
    if (status === "dismissed") {
      return {
        title: "VYVA checked your report",
        body: "VYVA did not need to take more action, and your report stayed private.",
      };
    }
    if (status === "open") {
      return {
        title: "VYVA kept your report open",
        body: "Your report remains saved for more review. The room does not see who sent it.",
      };
    }
    return {
      title: "VYVA is checking your report",
      body: "Your report is being reviewed privately. The room does not see who sent it.",
    };
  }

  if (status === "resolved") {
    return {
      title: "VYVA reviso tu aviso",
      body: "Gracias. VYVA se ha ocupado de este aviso y mantuvo tus datos privados.",
    };
  }
  if (status === "dismissed") {
    return {
      title: "VYVA comprobo tu aviso",
      body: "VYVA no necesito tomar mas medidas, y tu aviso siguio privado.",
    };
  }
  if (status === "open") {
    return {
      title: "VYVA mantiene tu aviso abierto",
      body: "Tu aviso sigue guardado para revisarlo mejor. La sala no ve quien lo envio.",
    };
  }
  return {
    title: "VYVA esta revisando tu aviso",
    body: "Tu aviso se revisa en privado. La sala no ve quien lo envio.",
  };
}

function defaultTogetherMemberPresence(language: SocialLanguage): SocialRoomMember[] {
  if (language === "de") {
    return [
      { id: "member-carmen", name: "Carmen", statusLabel: "Sucht einen ruhigen Plan" },
      { id: "member-luis", name: "Luis", statusLabel: "Moechte kurz Hallo sagen" },
      { id: "member-ana", name: "Ana", statusLabel: "Schaut sich die Einladung an" },
    ];
  }

  if (language === "en") {
    return [
      { id: "member-carmen", name: "Carmen", statusLabel: "Looking for a quiet plan" },
      { id: "member-luis", name: "Luis", statusLabel: "Happy to say hello" },
      { id: "member-ana", name: "Ana", statusLabel: "Reviewing today's invitation" },
    ];
  }

  return [
    { id: "member-carmen", name: "Carmen", statusLabel: "Busca un plan tranquilo" },
    { id: "member-luis", name: "Luis", statusLabel: "Quiere saludar" },
    { id: "member-ana", name: "Ana", statusLabel: "Revisa la invitacion de hoy" },
  ];
}

function seededPoll(language: SocialLanguage, userId: string): SocialRoomPoll {
  const votesByOption = new Map(pollOptions.map((option) => [option.id, 0]));
  for (const optionId of memoryVotesForPoll(DAILY_POLL_KEY)) {
    votesByOption.set(optionId, (votesByOption.get(optionId) ?? 0) + 1);
  }

  const options = pollOptions.map((option) => ({
    id: option.id,
    label: localize(option.label, language),
    votes: votesByOption.get(option.id) ?? 0,
  }));

  return {
    id: DAILY_POLL_KEY,
    key: DAILY_POLL_KEY,
    question: localize(pollQuestion, language),
    status: memoryPollStatus(DAILY_POLL_KEY),
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    myVote: pollVotes.get(voteKey(userId, DAILY_POLL_KEY)) ?? null,
  };
}

function issuePollQuestionTitle(question: SocialRoomPlan, language: SocialLanguage) {
  if (language === "de") return `Abstimmen: ${question.title}`;
  if (language === "en") return `Vote: ${question.title}`;
  return `Votar: ${question.title}`;
}

function memoryIssuePoll(question: SocialRoomPlan, language: SocialLanguage, userId: string): SocialRoomPoll {
  const pollKey = issuePollKey(question.key);
  const fallbackStatus = question.status === "active" ? "active" : question.status;
  const votesByOption = new Map(issuePollOptions.map((option) => [option.id, 0]));
  for (const optionId of memoryVotesForPoll(pollKey)) {
    votesByOption.set(optionId, (votesByOption.get(optionId) ?? 0) + 1);
  }
  const options = issuePollOptions.map((option) => ({
    id: option.id,
    label: localize(option.label, language),
    votes: votesByOption.get(option.id) ?? 0,
  }));

  return {
    id: pollKey,
    key: pollKey,
    sourcePlanKey: question.key,
    question: issuePollQuestionTitle(question, language),
    status: memoryPollStatus(pollKey, fallbackStatus),
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    myVote: pollVotes.get(voteKey(userId, pollKey)) ?? null,
  };
}

function supportedIssuePolls(questions: SocialRoomPlan[], language: SocialLanguage, userId: string) {
  return questions
    .filter((question) => (
      question.status === "active" &&
      normalizePlanKind(question.kind) === "question" &&
      memoryPollStatus(issuePollKey(question.key)) !== "hidden" &&
      Object.values(question.responseCounts ?? {}).reduce((sum, count) => sum + count, 0) > 0
    ))
    .slice(0, 3)
    .map((question) => memoryIssuePoll(question, language, userId));
}

function fallbackPulse(
  userId: string,
  language: SocialLanguage,
  memberPresence: SocialRoomMember[] = defaultTogetherMemberPresence(language),
): SocialRoomPulse {
  const plans = seedPlans.map<SocialRoomPlan>((plan, index) => ({
    id: plan.key,
    key: plan.key,
    kind: "plan",
    title: localize(plan.title, language),
    body: plan.body[language],
    locationLabel: plan.locationLabel,
    comfortNeeds: plan.comfortNeeds ?? [],
    experienceCategory: plan.experienceCategory ?? "other",
    preferredTime: plan.preferredTime ?? "flexible",
    costRange: plan.costRange ?? "discuss",
    groupSize: plan.groupSize ?? "one_to_one",
    safetyFlags: [],
    needsReview: false,
    fitReasons: buildFitReasons({
      locationLabel: plan.locationLabel,
      preferredTime: plan.preferredTime,
      costRange: plan.costRange,
      groupSize: plan.groupSize,
    }, language),
    startsAt: null,
    status: "active",
    responseCounts: seededPlanCounts(plan.key),
    myResponse: planResponses.get(responseKey(userId, plan.key)) ?? null,
    myHelperActions: memoryHelperActionsForPlan(plan.key, TOGETHER_ROOM_SLUG, userId),
    replies: memoryRepliesForPlan(plan.key, TOGETHER_ROOM_SLUG, language, userId),
  }));
  const activePoll = seededPoll(language, userId);
  const comfortCheck = buildComfortCheck(userId, TOGETHER_ROOM_SLUG, language);
  const postedExperiences = memoryPostedExperiences(TOGETHER_ROOM_SLUG, userId, language);
  const notifications = memoryNotificationsFor(userId, TOGETHER_ROOM_SLUG);
  const unreadNotificationCount = memoryUnreadNotificationCountFor(userId, TOGETHER_ROOM_SLUG);
  const presenceMembers = togetherParticipantPresence(
    userId,
    language,
    memoryParticipantIds(TOGETHER_ROOM_SLUG),
    memberPresence,
  );
  const issuePolls = supportedIssuePolls(postedExperiences, language, userId);
  const visibleMembers = memberPulseSummary(presenceMembers);

  return {
    featuredPlan: plans[0],
    secondaryPlans: plans.slice(1, 3),
    postedExperiences,
    memberPresence: visibleMembers,
    activePoll,
    issuePolls,
    comfortCheck,
    decisionGuide: buildDecisionGuide(language, activePoll, comfortCheck),
    joiningSupportCue: buildJoiningSupportCue(language, comfortCheck),
    discussionPrompt: getDiscussionPrompt(language),
    safety: getSafetyCopy(
      language,
      memoryAgreementAcknowledgedAt(userId, TOGETHER_ROOM_SLUG),
      memoryQuietPausedAt(userId, TOGETHER_ROOM_SLUG),
      memoryReportedItemKeys(userId, TOGETHER_ROOM_SLUG),
      memoryReportedItemStatuses(userId, TOGETHER_ROOM_SLUG),
    ),
    visibility: getVisibilityCopy(language),
    activityDigest: buildActivityDigest({
      language,
      activePoll,
      issuePolls,
      comfortCheck,
      featuredPlan: plans[0],
      secondaryPlans: plans.slice(1, 3),
      postedExperiences,
      memberPresence: visibleMembers,
    }),
    notifications,
    unreadNotificationCount,
  };
}

function getDiscussionPrompt(language: SocialLanguage) {
  if (language === "de") {
    return {
      id: "gentle-start",
      title: "Was moechtest du sagen?",
      body: "Du kannst klein anfangen. VYVA hilft, wenn du nicht weisst, wie.",
      starterButtons: ["Hallo sagen", "Plan vorschlagen", "VYVA fragen"],
      dailyQuestion: {
        id: "today-gentle-question",
        title: "Sanfte Frage fuer heute",
        body: "Was wuerde es dir heute leichter machen, dich im Raum zu beteiligen?",
        draft: "Heute wuerde es mir leichter fallen, mitzumachen, wenn...",
        actionLabel: "Sanft antworten",
        privacyLine: "Deine Antwort wird erst geteilt, wenn du sie sendest. VYVA prueft private Details vorher.",
      },
    };
  }

  if (language === "en") {
    return {
      id: "gentle-start",
      title: "What would you like to say?",
      body: "You can start small. VYVA can help if you are not sure how.",
      starterButtons: ["Say hello", "Suggest a plan", "Ask VYVA"],
      dailyQuestion: {
        id: "today-gentle-question",
        title: "Today's gentle question",
        body: "What would make it easier for you to join in today?",
        draft: "What would make it easier for me to join today is...",
        actionLabel: "Answer gently",
        privacyLine: "Your answer is shared only when you choose to post it. VYVA checks private details first.",
      },
    };
  }

  return {
    id: "gentle-start",
    title: "Que te gustaria decir?",
    body: "Puedes empezar poco a poco. VYVA ayuda si no sabes como.",
    starterButtons: ["Saludar", "Sugerir plan", "Preguntar a VYVA"],
    dailyQuestion: {
      id: "today-gentle-question",
      title: "Pregunta amable de hoy",
      body: "Que haria mas facil participar hoy en la sala?",
      draft: "Lo que me haria mas facil participar hoy es...",
      actionLabel: "Responder con calma",
      privacyLine: "Tu respuesta solo se comparte cuando la envias. VYVA revisa antes los detalles privados.",
    },
  };
}

function getSafetyCopy(
  language: SocialLanguage,
  acknowledgedAt: string | null = null,
  quietPausedAt: string | null = null,
  reportedItemKeys: string[] = [],
  reportedItemStatuses: SocialRoomReportedItemStatus[] = [],
) {
  if (language === "de") {
    return {
      title: "Geschuetzter kleiner Kreis",
      body: "VYVA achtet auf einen freundlichen Ton und hilft, wenn etwas unangenehm ist.",
      consentLine: "Kontakt wird nur geteilt, wenn beide Personen zustimmen.",
      helpLabel: "Hilfe oder Sicherheit",
      agreementTitle: "Unser Raumversprechen",
      agreementLines: [
        "Freundliche Worte, kein Druck.",
        "Meinungen teilen ohne zu urteilen.",
        "VYVA fragen, bevor Kontakt entsteht oder wenn etwas unangenehm ist.",
      ],
      acknowledgementLabel: "Ich verstehe",
      acknowledgedLabel: "Raumversprechen gespeichert",
      myAcknowledgedAt: acknowledgedAt,
      myQuietPausedAt: quietPausedAt,
      reportedItemKeys,
      reportedItemStatuses,
    };
  }

  if (language === "en") {
    return {
      title: "Safe small circle",
      body: "VYVA keeps the tone kind and can help if something feels uncomfortable.",
      consentLine: "Contact is shared only when both people agree.",
      helpLabel: "Help or safety",
      agreementTitle: "Our room promise",
      agreementLines: [
        "Use kind words and no pressure.",
        "Share views without judging.",
        "Ask VYVA before contact or if something feels wrong.",
      ],
      acknowledgementLabel: "I understand",
      acknowledgedLabel: "Room promise saved",
      myAcknowledgedAt: acknowledgedAt,
      myQuietPausedAt: quietPausedAt,
      reportedItemKeys,
      reportedItemStatuses,
    };
  }

  return {
    title: "Circulo pequeno y seguro",
    body: "VYVA cuida el tono amable y ayuda si algo incomoda.",
    consentLine: "El contacto solo se comparte si ambas personas aceptan.",
    helpLabel: "Ayuda o seguridad",
    agreementTitle: "Nuestra promesa de sala",
    agreementLines: [
      "Palabras amables y sin presion.",
      "Compartimos opiniones sin juzgar.",
      "Pide ayuda a VYVA antes de contactar o si algo incomoda.",
    ],
    acknowledgementLabel: "Lo entiendo",
    acknowledgedLabel: "Promesa de sala guardada",
    myAcknowledgedAt: acknowledgedAt,
    myQuietPausedAt: quietPausedAt,
    reportedItemKeys,
    reportedItemStatuses,
  };
}

function getVisibilityCopy(language: SocialLanguage): SocialRoomVisibilityState {
  if (language === "de") {
    return {
      title: "Wer was sieht",
      body: "Eine ruhige Erinnerung, bevor du tippst.",
      items: [
        {
          id: "private",
          title: "Privat fuer dich",
          body: "Deine Stimme, Komfortwuensche und Vielleicht-Wahl zeigen deinen Namen nicht.",
        },
        {
          id: "totals",
          title: "Der Raum sieht Summen",
          body: "Der Raum sieht Zaehler wie Stimmen, Interesse und Komfortwuensche.",
        },
        {
          id: "shared",
          title: "Im Raum geteilt",
          body: "Plaene, Ansichten und Antworten erscheinen im Raum, mit VYVA-Pruefung in der Naehe.",
        },
      ],
    };
  }

  if (language === "en") {
    return {
      title: "Who sees what",
      body: "A calm reminder before you tap.",
      items: [
        {
          id: "private",
          title: "Private to you",
          body: "Your vote, comfort choices and maybe choice do not show your name.",
        },
        {
          id: "totals",
          title: "Room sees totals",
          body: "The room sees counts like votes, interest and comfort needs.",
        },
        {
          id: "shared",
          title: "Shared with the room",
          body: "Plans, views and replies appear in the room, with VYVA review nearby.",
        },
      ],
    };
  }

  return {
    title: "Quien ve que",
    body: "Un recordatorio tranquilo antes de tocar.",
    items: [
      {
        id: "private",
        title: "Privado para ti",
        body: "Tu voto, tus apoyos de comodidad y 'quiza' no muestran tu nombre.",
      },
      {
        id: "totals",
        title: "La sala ve totales",
        body: "La sala ve conteos como votos, interes y necesidades de comodidad.",
      },
      {
        id: "shared",
        title: "Compartido en la sala",
        body: "Planes, opiniones y respuestas aparecen en la sala, con revision de VYVA cerca.",
      },
    ],
  };
}

async function safeDb<T>(label: string, action: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeout = new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        Promise.resolve(fallback()).then(resolve, reject);
      }, SAFE_DB_TIMEOUT_MS);
    });
    return await Promise.race([action(), timeout]);
  } catch (error) {
    console.warn(`[social-pulse] ${label} fallback`, error);
    return await fallback();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function ensureSeedRows(roomId: string) {
  for (const plan of seedPlans) {
    await db
      .insert(socialRoomPlans)
      .values({
        room_id: roomId,
        plan_key: plan.key,
        kind: "plan",
        title_es: plan.title.es,
        title_de: plan.title.de,
        title_en: plan.title.en,
        body_es: plan.body.es,
        body_de: plan.body.de,
        body_en: plan.body.en,
        location_label: plan.locationLabel,
        comfort_needs: plan.comfortNeeds ?? [],
        experience_category: plan.experienceCategory ?? "other",
        preferred_time: plan.preferredTime ?? "flexible",
        cost_range: plan.costRange ?? "discuss",
        group_size: plan.groupSize ?? "one_to_one",
        safety_flags: [],
        needs_review: false,
        status: "active",
        source: "seed",
      })
      .onConflictDoUpdate({
        target: [socialRoomPlans.room_id, socialRoomPlans.plan_key],
        set: {
          title_es: plan.title.es,
          title_de: plan.title.de,
          title_en: plan.title.en,
          body_es: plan.body.es,
          body_de: plan.body.de,
          body_en: plan.body.en,
          location_label: plan.locationLabel,
          comfort_needs: plan.comfortNeeds ?? [],
          experience_category: plan.experienceCategory ?? "other",
          preferred_time: plan.preferredTime ?? "flexible",
          cost_range: plan.costRange ?? "discuss",
          group_size: plan.groupSize ?? "one_to_one",
          safety_flags: [],
          needs_review: false,
          updated_at: new Date(),
        },
      });
  }

  await db
    .insert(socialRoomPolls)
    .values({
      room_id: roomId,
      poll_key: DAILY_POLL_KEY,
      question_es: pollQuestion.es,
      question_de: pollQuestion.de,
      question_en: pollQuestion.en,
      options: pollOptions.map((option) => ({
        id: option.id,
        label_es: option.label.es,
        label_de: option.label.de,
        label_en: option.label.en,
      })),
      status: "active",
    })
    .onConflictDoUpdate({
      target: [socialRoomPolls.room_id, socialRoomPolls.poll_key],
      set: {
        question_es: pollQuestion.es,
        question_de: pollQuestion.de,
        question_en: pollQuestion.en,
        options: pollOptions.map((option) => ({
          id: option.id,
          label_es: option.label.es,
          label_de: option.label.de,
          label_en: option.label.en,
        })),
        updated_at: new Date(),
      },
    });
}

function rowPlanTitle(plan: typeof socialRoomPlans.$inferSelect, language: SocialLanguage) {
  if (language === "de") return plan.title_de;
  if (language === "en") return plan.title_en;
  return plan.title_es;
}

function rowPlanBody(plan: typeof socialRoomPlans.$inferSelect, language: SocialLanguage) {
  if (language === "de") return plan.body_de;
  if (language === "en") return plan.body_en;
  return plan.body_es;
}

function rowPollQuestion(poll: typeof socialRoomPolls.$inferSelect, language: SocialLanguage) {
  if (language === "de") return poll.question_de;
  if (language === "en") return poll.question_en;
  return poll.question_es;
}

function rowPollOptionLabel(
  option: { label_es: string; label_de: string; label_en: string },
  language: SocialLanguage,
) {
  if (language === "de") return option.label_de;
  if (language === "en") return option.label_en;
  return option.label_es;
}

export function summarizePollVoteState(
  pollId: string,
  userId: string,
  optionIds: string[],
  votes: Array<{ poll_id: string; user_id: string; option_id: string }>,
) {
  const validOptionIds = new Set(optionIds);
  const optionCounts = Object.fromEntries(optionIds.map((optionId) => [optionId, 0])) as Record<string, number>;
  let myVote: string | null = null;

  for (const vote of votes) {
    if (vote.poll_id !== pollId || !validOptionIds.has(vote.option_id)) continue;
    optionCounts[vote.option_id] += 1;
    if (vote.user_id === userId) myVote = vote.option_id;
  }

  return {
    optionCounts,
    totalVotes: Object.values(optionCounts).reduce((sum, count) => sum + count, 0),
    myVote,
  };
}

function issuePollQuestionFromTitles(plan: typeof socialRoomPlans.$inferSelect) {
  return {
    es: `Votar: ${plan.title_es}`,
    de: `Abstimmen: ${plan.title_de}`,
    en: `Vote: ${plan.title_en}`,
  };
}

async function ensureIssuePollRow(input: {
  roomId: string;
  pollKey: string;
  userId: string;
}) {
  const planKey = issuePlanKeyFromPollKey(input.pollKey);
  if (!planKey) return null;

  const [plan] = await db
    .select()
    .from(socialRoomPlans)
    .where(and(eq(socialRoomPlans.room_id, input.roomId), eq(socialRoomPlans.plan_key, planKey)))
    .limit(1);
  if (!plan || normalizePlanKind(plan.kind) !== "question" || plan.status !== "active") return null;

  const question = issuePollQuestionFromTitles(plan);
  const pollValues = {
    room_id: input.roomId,
    poll_key: input.pollKey,
    question_es: question.es,
    question_de: question.de,
    question_en: question.en,
    options: issuePollOptions.map((option) => ({
      id: option.id,
      label_es: option.label.es,
      label_de: option.label.de,
      label_en: option.label.en,
    })),
    status: "active",
    created_by: input.userId,
  };

  const [poll] = await db
    .insert(socialRoomPolls)
    .values(pollValues)
    .onConflictDoUpdate({
      target: [socialRoomPolls.room_id, socialRoomPolls.poll_key],
      set: {
        question_es: question.es,
        question_de: question.de,
        question_en: question.en,
        options: pollValues.options,
        updated_at: new Date(),
      },
    })
    .returning({ id: socialRoomPolls.id, status: socialRoomPolls.status });

  return poll ?? null;
}

export async function buildTogetherRoomPulse(
  userId: string,
  language: SocialLanguage,
  roomId?: string | null,
  memberPresence: SocialRoomMember[] = defaultTogetherMemberPresence(language),
): Promise<SocialRoomPulse> {
  if (!roomId) return fallbackPulse(userId, language, memberPresence);

  return safeDb(
    "build pulse",
    async () => {
      await ensureSeedRows(roomId);

      const planRows = await db
        .select()
        .from(socialRoomPlans)
        .where(and(eq(socialRoomPlans.room_id, roomId), ne(socialRoomPlans.status, "hidden")));

      const pollRows = await db
        .select()
        .from(socialRoomPolls)
        .where(and(eq(socialRoomPolls.room_id, roomId), ne(socialRoomPolls.status, "hidden")));

      const planIds = planRows.map((plan) => plan.id);
      const responseRows = planIds.length
        ? await db.select().from(socialRoomPlanResponses).where(inArray(socialRoomPlanResponses.plan_id, planIds))
        : [];
      const replyRows = planIds.length
        ? await db
            .select()
            .from(socialRoomReplies)
            .where(and(inArray(socialRoomReplies.plan_id, planIds), ne(socialRoomReplies.status, "hidden")))
        : [];
      const pollIds = pollRows.map((poll) => poll.id);
      const voteRows = pollIds.length
        ? await db.select().from(socialRoomVotes).where(inArray(socialRoomVotes.poll_id, pollIds))
        : [];
      const notifications = await db
        .select()
        .from(socialRoomNotifications)
        .where(and(
          eq(socialRoomNotifications.user_id, userId),
          eq(socialRoomNotifications.room_id, roomId),
          isNull(socialRoomNotifications.read_at),
        ))
        .orderBy(desc(socialRoomNotifications.created_at))
        .limit(3);
      const [unreadNotificationCountRow] = await db
        .select({ value: count() })
        .from(socialRoomNotifications)
        .where(and(
          eq(socialRoomNotifications.user_id, userId),
          eq(socialRoomNotifications.room_id, roomId),
          isNull(socialRoomNotifications.read_at),
        ));
      const memberRoleRows = await db
        .select({
          user_id: socialRoomMemberRoles.user_id,
          agreement_acknowledged_at: socialRoomMemberRoles.agreement_acknowledged_at,
          comfort_needs: socialRoomMemberRoles.comfort_needs,
          quiet_paused_at: socialRoomMemberRoles.quiet_paused_at,
          updated_at: socialRoomMemberRoles.updated_at,
        })
        .from(socialRoomMemberRoles)
        .where(eq(socialRoomMemberRoles.room_id, roomId));
      const memberRole = memberRoleRows.find((role) => role.user_id === userId);
      const memberComfortNeeds = new Map(
        memberRoleRows.map((role) => [role.user_id, normalizeComfortNeeds(role.comfort_needs)] as const),
      );
      const reportRows = await db
        .select({
          targetType: socialRoomSafetyReports.target_type,
          targetId: socialRoomSafetyReports.target_id,
          status: socialRoomSafetyReports.status,
          createdAt: socialRoomSafetyReports.created_at,
          reviewedAt: socialRoomSafetyReports.reviewed_at,
        })
        .from(socialRoomSafetyReports)
        .where(and(
          eq(socialRoomSafetyReports.room_id, roomId),
          eq(socialRoomSafetyReports.reporter_id, userId),
        ));
      const reportedItemKeys = compactReportItemKeys([
        ...reportRows.map((report) => reportTargetItemKey(report.targetType, report.targetId)),
        ...memoryReportedItemKeys(userId, TOGETHER_ROOM_SLUG),
      ]);
      const reportedItemStatuses = compactReportedItemStatuses([
        ...reportRows.map((report) => ({
          itemKey: reportTargetItemKey(report.targetType, report.targetId),
          status: report.status,
          updatedAt: (report.reviewedAt ?? report.createdAt).toISOString(),
        })),
        ...memoryReportedItemStatuses(userId, TOGETHER_ROOM_SLUG),
      ]);
      const nowMs = Date.now();
      const activeMemberRoleIds = memberRoleRows
        .filter((role) => (
          Boolean(role.agreement_acknowledged_at)
          || Boolean(role.quiet_paused_at)
          || normalizeComfortNeeds(role.comfort_needs).length > 0
          || nowMs - role.updated_at.getTime() <= ACTIVE_PRESENCE_TTL_MS
        ))
        .map((role) => role.user_id);
      const participantIds = [
        ...activeMemberRoleIds,
        ...responseRows.map((response) => response.user_id),
        ...voteRows.map((vote) => vote.user_id),
        ...replyRows.map((reply) => reply.user_id),
        ...planRows
          .filter((plan) => plan.status === "active")
          .map((plan) => plan.created_by ?? ""),
        ...memoryParticipantIds(TOGETHER_ROOM_SLUG),
      ];
      const presenceMembers = togetherParticipantPresence(userId, language, participantIds, memberPresence);

      const seedOrder = new Map(seedPlans.map((seed, index) => [seed.key, index]));
      const mapPlanRow = (plan: (typeof planRows)[number]): SocialRoomPlan => {
          const counts = emptyPlanCounts();
          for (const row of responseRows.filter((response) => response.plan_id === plan.id)) {
            const response = normalizePlanResponse(row.response);
            counts[response] += 1;
          }

          const myResponse = responseRows.find((response) => response.plan_id === plan.id && response.user_id === userId);
          const dbReplies = replyRows
            .filter((reply) => reply.plan_id === plan.id)
            .map<SocialRoomReply>((reply) => ({
              id: reply.id,
              planKey: plan.plan_key,
              authorName: replyAuthorName(language),
              body: reply.body,
              tone: normalizeReplyTone(reply.tone),
              status: reply.status,
              ownedByMe: reply.user_id === userId,
              createdAt: reply.created_at.toISOString(),
            }));
          const myHelperActions = uniqueHelperActions([
            ...replyRows
              .filter((reply) => reply.plan_id === plan.id && reply.user_id === userId && reply.status === "active")
              .map((reply) => helperActionForReplyBody(reply.body)),
            ...memoryHelperActionsForPlan(plan.plan_key, TOGETHER_ROOM_SLUG, userId),
          ]);
          const dbReplyIds = new Set(dbReplies.map((reply) => reply.id));
          const replies = [
            ...memoryRepliesForPlan(plan.plan_key, TOGETHER_ROOM_SLUG, language, userId).filter((reply) => !dbReplyIds.has(reply.id)),
            ...dbReplies,
          ]
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .slice(0, 3);
          const experienceCategory = normalizeExperienceCategory(plan.experience_category);
          const preferredTime = normalizePreferredTime(plan.preferred_time);
          const costRange = normalizeCostRange(plan.cost_range);
          const groupSize = normalizeGroupSize(plan.group_size);
          const safetyFlags = normalizeSafetyFlags(plan.safety_flags);

          return {
            id: plan.plan_key,
            key: plan.plan_key,
            kind: normalizePlanKind(plan.kind),
            title: rowPlanTitle(plan, language),
            body: rowPlanBody(plan, language),
            locationLabel: plan.location_label,
            comfortNeeds: normalizeComfortNeeds(plan.comfort_needs),
            experienceCategory,
            preferredTime,
            costRange,
            groupSize,
            safetyFlags,
            needsReview: Boolean(plan.needs_review) || safetyFlags.length > 0,
            fitReasons: buildFitReasons({
              locationLabel: plan.location_label,
              preferredTime,
              costRange,
              groupSize,
            }, language),
            startsAt: plan.starts_at?.toISOString() ?? null,
            status: plan.status,
            source: plan.source,
            createdBy: plan.created_by,
            ownedByMe: plan.created_by === userId,
            createdAt: plan.created_at.toISOString(),
            responseCounts: counts,
            myResponse: myResponse ? normalizePlanResponse(myResponse.response) : null,
            myHelperActions,
            replies,
          };
        };

      const plans = planRows
        .filter((plan) => plan.source !== "user" && seedOrder.has(plan.plan_key))
        .sort((a, b) => (seedOrder.get(a.plan_key) ?? 999) - (seedOrder.get(b.plan_key) ?? 999))
        .map(mapPlanRow);

      const dbPostedExperiences = planRows
        .filter((plan) => plan.status === "active" && (plan.source === "user" || !seedOrder.has(plan.plan_key)))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .map(mapPlanRow);

      const seenPostedKeys = new Set(dbPostedExperiences.map((plan) => plan.key));
      const memoryPosts = memoryPostedExperiences(TOGETHER_ROOM_SLUG, userId, language).filter((plan) => !seenPostedKeys.has(plan.key));

      const fallback = fallbackPulse(userId, language, memberPresence);
      const mapPollRow = (poll: (typeof pollRows)[number]): SocialRoomPoll => {
            const voteState = summarizePollVoteState(
              poll.id,
              userId,
              poll.options.map((option) => option.id),
              voteRows,
            );
            const options = poll.options.map((option) => ({
              id: option.id,
              label: rowPollOptionLabel(option, language),
              votes: voteState.optionCounts[option.id] ?? 0,
            }));
            return {
              id: poll.poll_key,
              key: poll.poll_key,
              sourcePlanKey: issuePlanKeyFromPollKey(poll.poll_key),
              question: rowPollQuestion(poll, language),
              status: poll.status,
              options,
              totalVotes: voteState.totalVotes,
              myVote: voteState.myVote,
            };
          };
      const dailyPoll = pollRows.find((poll) => poll.poll_key === DAILY_POLL_KEY);
      const activePoll = dailyPoll
        ? mapPollRow(dailyPoll)
        : fallback.activePoll;
      const comfortCheck = buildComfortCheck(userId, TOGETHER_ROOM_SLUG, language, memberComfortNeeds);
      const postedExperiences = [...memoryPosts, ...dbPostedExperiences].slice(0, 8);
      const persistedIssuePolls = new Map(
        pollRows
          .filter((poll) => Boolean(issuePlanKeyFromPollKey(poll.poll_key)))
          .map((poll) => [issuePlanKeyFromPollKey(poll.poll_key), mapPollRow(poll)] as const),
      );
      const issuePolls = supportedIssuePolls(postedExperiences, language, userId).map((poll) => (
        poll.sourcePlanKey && persistedIssuePolls.get(poll.sourcePlanKey)
          ? persistedIssuePolls.get(poll.sourcePlanKey)!
          : poll
      ));
      const featuredPlan = plans[0] ?? fallback.featuredPlan;
      const secondaryPlans = plans.slice(1, 3).length ? plans.slice(1, 3) : fallback.secondaryPlans;
      const visibleMembers = memberPulseSummary(presenceMembers);

      return {
        featuredPlan,
        secondaryPlans,
        postedExperiences,
        memberPresence: visibleMembers,
        activePoll,
        issuePolls,
        comfortCheck,
        decisionGuide: buildDecisionGuide(language, activePoll, comfortCheck),
        joiningSupportCue: buildJoiningSupportCue(language, comfortCheck),
        discussionPrompt: getDiscussionPrompt(language),
        safety: getSafetyCopy(
          language,
          memberRole?.agreement_acknowledged_at?.toISOString() ??
            memoryAgreementAcknowledgedAt(userId, TOGETHER_ROOM_SLUG),
          memberRole?.quiet_paused_at?.toISOString() ??
            memoryQuietPausedAt(userId, TOGETHER_ROOM_SLUG),
          reportedItemKeys,
          reportedItemStatuses,
        ),
        visibility: getVisibilityCopy(language),
        activityDigest: buildActivityDigest({
          language,
          activePoll,
          issuePolls,
          comfortCheck,
          featuredPlan,
          secondaryPlans,
          postedExperiences,
          memberPresence: visibleMembers,
        }),
        notifications: notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          metadata: notificationMetadata(notification.metadata),
          createdAt: notification.created_at.toISOString(),
          readAt: notification.read_at?.toISOString() ?? null,
        })),
        unreadNotificationCount: Number(unreadNotificationCountRow?.value ?? notifications.length),
      };
    },
    () => fallbackPulse(userId, language, memberPresence),
  );
}

export async function respondToTogetherPlan(input: {
  userId: string;
  roomId?: string | null;
  planKey: string;
  response: SocialRoomPlanResponseAction;
  language: SocialLanguage;
}) {
  const isClearResponse = input.response === "clear";
  const planResponseValue = isClearResponse ? null : input.response;
  const interestResponse =
    planResponseValue === "join" || planResponseValue === "maybe" ? planResponseValue : null;
  const sharesInterest = interestResponse !== null;
  const previousMemoryResponse = planResponses.get(responseKey(input.userId, input.planKey));
  const memoryPlan = proposals.find((proposal) => proposal.planKey === input.planKey);
  if (!isClearResponse && memoryPlan && memoryPlan.status !== "active") {
    return { error: "Shared item needs VYVA review before members can join it" as const };
  }

  if (!isClearResponse && input.roomId) {
    const canRespond = await safeDb(
      "check plan status",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [plan] = await db
          .select({ status: socialRoomPlans.status })
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        return !plan || plan.status === "active";
      },
      () => true,
    );

    if (!canRespond) return { error: "Plan is closed" as const };
  }

  if (isClearResponse) {
    planResponses.delete(responseKey(input.userId, input.planKey));
  } else if (planResponseValue) {
    planResponses.set(responseKey(input.userId, input.planKey), planResponseValue);
  }

  if (
    sharesInterest &&
    memoryPlan &&
    memoryPlan.userId !== input.userId &&
    previousMemoryResponse !== interestResponse
  ) {
    const copy = planResponseNotificationCopy(interestResponse, memoryPlan.title, input.language);
    pushMemoryNotification({
      userId: memoryPlan.userId,
      roomSlug: memoryPlan.roomSlug,
      type: interestResponse === "join" ? "plan_joined" : "plan_saved",
      title: copy.title,
      body: copy.body,
      metadata: { planKey: input.planKey, response: interestResponse, responderId: input.userId },
    });
  }

  if (input.roomId) {
    await safeDb(
      "respond to plan",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [plan] = await db
          .select()
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        if (!plan) return;

        if (isClearResponse) {
          await db
            .delete(socialRoomPlanResponses)
            .where(and(eq(socialRoomPlanResponses.plan_id, plan.id), eq(socialRoomPlanResponses.user_id, input.userId)));
          return;
        }

        const nextResponse = planResponseValue;
        if (!nextResponse) return;

        const [existingResponse] = await db
          .select({ response: socialRoomPlanResponses.response })
          .from(socialRoomPlanResponses)
          .where(and(eq(socialRoomPlanResponses.plan_id, plan.id), eq(socialRoomPlanResponses.user_id, input.userId)))
          .limit(1);

        await db
          .insert(socialRoomPlanResponses)
          .values({
            plan_id: plan.id,
            user_id: input.userId,
            response: nextResponse,
          })
          .onConflictDoUpdate({
            target: [socialRoomPlanResponses.plan_id, socialRoomPlanResponses.user_id],
            set: {
              response: nextResponse,
              updated_at: new Date(),
            },
          });

        if (sharesInterest && plan.created_by && plan.created_by !== input.userId && existingResponse?.response !== interestResponse) {
          const copy = planResponseNotificationCopy(interestResponse, rowPlanTitle(plan, input.language), input.language);
          await db.insert(socialRoomNotifications).values({
            user_id: plan.created_by,
            room_id: input.roomId,
            type: interestResponse === "join" ? "plan_joined" : "plan_saved",
            title: copy.title,
            body: copy.body,
            metadata: { planKey: input.planKey, response: interestResponse, responderId: input.userId },
          });
        }
      },
      async () => undefined,
    );
  }

  if (sharesInterest) {
    await clearTogetherQuietPause({
      userId: input.userId,
      roomSlug: TOGETHER_ROOM_SLUG,
      roomId: input.roomId,
    });

    await notifyActivityReady({
      userId: input.userId,
      roomSlug: TOGETHER_ROOM_SLUG,
      roomId: input.roomId,
      planKey: input.planKey,
      language: input.language,
    });
    await notifyQuestionVoteReady({
      userId: input.userId,
      roomSlug: TOGETHER_ROOM_SLUG,
      roomId: input.roomId,
      planKey: input.planKey,
      language: input.language,
    });
  }

  const pulse = await buildTogetherRoomPulse(input.userId, input.language, input.roomId);
  return {
    planResponse: {
      planId: input.planKey,
      response: planResponseValue,
      responseCounts:
        [pulse.featuredPlan, ...pulse.secondaryPlans].find((plan) => plan.key === input.planKey)?.responseCounts ??
        seededPlanCounts(input.planKey),
    },
    pulse,
  };
}

export async function markTogetherNotificationRead(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  notificationId: string;
  language: SocialLanguage;
}) {
  const readAt = new Date();
  const memoryNotification = memoryNotifications.find((notification) => (
    notification.id === input.notificationId &&
    notification.userId === input.userId &&
    notification.roomSlug === publicRoomId(input.roomSlug)
  ));
  if (memoryNotification) {
    memoryNotification.readAt = readAt.toISOString();
  }

  if (input.roomId) {
    await safeDb(
      "mark notification read",
      async () => {
        await db
          .update(socialRoomNotifications)
          .set({ read_at: readAt })
          .where(and(
            eq(socialRoomNotifications.id, input.notificationId),
            eq(socialRoomNotifications.user_id, input.userId),
            eq(socialRoomNotifications.room_id, input.roomId!),
          ));
      },
      async () => undefined,
    );
  }

  return {
    notificationId: input.notificationId,
    readAt: readAt.toISOString(),
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function markTogetherNotificationsRead(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  language: SocialLanguage;
}) {
  const readAt = new Date();
  const readIds = new Set<string>();
  const roomSlug = publicRoomId(input.roomSlug);

  for (const notification of memoryNotifications) {
    if (
      notification.userId === input.userId &&
      notification.roomSlug === roomSlug &&
      !notification.readAt
    ) {
      notification.readAt = readAt.toISOString();
      readIds.add(notification.id);
    }
  }

  if (input.roomId) {
    await safeDb(
      "mark notifications read",
      async () => {
        const unreadNotifications = await db
          .select({ id: socialRoomNotifications.id })
          .from(socialRoomNotifications)
          .where(and(
            eq(socialRoomNotifications.user_id, input.userId),
            eq(socialRoomNotifications.room_id, input.roomId!),
            isNull(socialRoomNotifications.read_at),
          ));

        unreadNotifications.forEach((notification) => readIds.add(notification.id));

        await db
          .update(socialRoomNotifications)
          .set({ read_at: readAt })
          .where(and(
            eq(socialRoomNotifications.user_id, input.userId),
            eq(socialRoomNotifications.room_id, input.roomId!),
            isNull(socialRoomNotifications.read_at),
          ));
      },
      async () => undefined,
    );
  }

  return {
    notificationIds: Array.from(readIds),
    readAt: readAt.toISOString(),
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function replyToTogetherPlan(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  planKey: string;
  body: string;
  tone?: SocialRoomReplyTone;
  language: SocialLanguage;
}) {
  const body = normalizeReplyBody(input.body);
  if (!body) return { error: "Reply is empty" as const };

  const safetyFlags = detectSafetyFlags({ category: "other", title: "", details: body });
  if (shouldBlockReply(safetyFlags)) {
    await createAutomaticSafetyReport({
      userId: input.userId,
      roomSlug: input.roomSlug,
      roomId: input.roomId,
      reason: "blocked_reply_safety",
      targetType: "plan",
      targetId: input.planKey,
      details: blockedReplyDetails(safetyFlags, input.language),
    });
    return {
      error: "Reply needs VYVA review before it can be shared" as const,
      safetyFlags,
    };
  }

  const memoryPlan = proposals.find((proposal) => proposal.planKey === input.planKey);
  if (memoryPlan && memoryPlan.status !== "active") {
    return { error: "Shared item needs VYVA review before members can reply" as const };
  }

  const duplicateMemoryReply = existingMemoryReply(input.planKey, input.roomSlug, input.userId, body);
  if (duplicateMemoryReply) {
    return {
      reply: publicReply(duplicateMemoryReply, input.language, input.userId),
      pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
    };
  }

  if (input.roomId) {
    const canReply = await safeDb(
      "check reply target status",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [plan] = await db
          .select({ status: socialRoomPlans.status })
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        return !plan || plan.status === "active";
      },
      () => true,
    );

    if (!canReply) return { error: "Shared item is closed" as const };

    const duplicateDbReply = await safeDb(
      "find existing reply",
      async () => {
        const [plan] = await db
          .select({ id: socialRoomPlans.id, planKey: socialRoomPlans.plan_key })
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        if (!plan) return null;

        const [reply] = await db
          .select()
          .from(socialRoomReplies)
          .where(and(
            eq(socialRoomReplies.plan_id, plan.id),
            eq(socialRoomReplies.user_id, input.userId),
            eq(socialRoomReplies.body, body),
            eq(socialRoomReplies.status, "active"),
          ))
          .orderBy(desc(socialRoomReplies.created_at))
          .limit(1);
        if (!reply) return null;

        return {
          id: reply.id,
          planKey: plan.planKey,
          authorName: replyAuthorName(input.language),
          body: reply.body,
          tone: normalizeReplyTone(reply.tone),
          status: reply.status,
          ownedByMe: true,
          createdAt: reply.created_at.toISOString(),
        } satisfies SocialRoomReply;
      },
      async () => null,
    );

    if (duplicateDbReply) {
      return {
        reply: duplicateDbReply,
        pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
      };
    }
  }

  const replyId = randomUUID();
  const tone = normalizeReplyTone(input.tone);
  const createdAt = new Date();
  const roomSlug = publicRoomId(input.roomSlug);
  const reply: MemoryReply = {
    id: replyId,
    planKey: input.planKey,
    roomSlug,
    userId: input.userId,
    body,
    tone,
    status: "active",
    createdAt: createdAt.toISOString(),
  };
  memoryReplies.unshift(reply);

  if (memoryPlan && memoryPlan.userId !== input.userId) {
    const copy = replyNotificationCopy(memoryPlan.title, body, input.language);
    pushMemoryNotification({
      userId: memoryPlan.userId,
      roomSlug: memoryPlan.roomSlug,
      type: "reply_added",
      title: copy.title,
      body: copy.body,
      metadata: { planKey: input.planKey, replyId, tone, replierId: input.userId },
    });
  }

  if (input.roomId) {
    await safeDb(
      "create reply",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [plan] = await db
          .select()
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        if (!plan) return;

        await db.insert(socialRoomReplies).values({
          id: replyId,
          plan_id: plan.id,
          user_id: input.userId,
          body,
          tone,
          status: "active",
          created_at: createdAt,
          updated_at: createdAt,
        });

        if (plan.created_by && plan.created_by !== input.userId) {
          const copy = replyNotificationCopy(rowPlanTitle(plan, input.language), body, input.language);
          await db.insert(socialRoomNotifications).values({
            user_id: plan.created_by,
            room_id: input.roomId,
            type: "reply_added",
            title: copy.title,
            body: copy.body,
            metadata: { planKey: input.planKey, replyId, tone, replierId: input.userId },
          });
        }
      },
      async () => undefined,
    );
  }

  await clearTogetherQuietPause({
    userId: input.userId,
    roomSlug: input.roomSlug,
    roomId: input.roomId,
    savedAt: createdAt,
  });

  await notifyActivityReady({
    userId: input.userId,
    roomSlug: input.roomSlug,
    roomId: input.roomId,
    planKey: input.planKey,
    language: input.language,
  });

  return {
    reply: {
      id: reply.id,
      planKey: reply.planKey,
      authorName: replyAuthorName(input.language),
      body: reply.body,
      tone: reply.tone,
      status: reply.status,
      ownedByMe: true,
      createdAt: reply.createdAt,
    } satisfies SocialRoomReply,
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function removeTogetherPlanHelper(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  planKey: string;
  action: SocialRoomPlanHelperAction;
  language: SocialLanguage;
}) {
  const roomSlug = publicRoomId(input.roomSlug);
  let removed = false;
  for (const reply of memoryReplies) {
    if (
      reply.planKey === input.planKey
      && reply.roomSlug === roomSlug
      && reply.userId === input.userId
      && reply.status === "active"
      && helperActionForReplyBody(reply.body) === input.action
    ) {
      reply.status = "hidden";
      removed = true;
    }
  }

  if (input.roomId) {
    removed = await safeDb(
      "remove plan helper",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [plan] = await db
          .select({ id: socialRoomPlans.id })
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        if (!plan) return removed;

        await db
          .update(socialRoomReplies)
          .set({ status: "hidden", updated_at: new Date() })
          .where(and(
            eq(socialRoomReplies.plan_id, plan.id),
            eq(socialRoomReplies.user_id, input.userId),
            eq(socialRoomReplies.status, "active"),
            inArray(socialRoomReplies.body, helperBodiesForAction(input.action)),
          ));
        return true;
      },
      () => removed,
    );
  }

  return {
    helperAction: {
      planId: input.planKey,
      action: input.action,
      removed,
    },
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function withdrawTogetherReply(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  planKey: string;
  replyId: string;
  language: SocialLanguage;
}) {
  const roomSlug = publicRoomId(input.roomSlug);
  let withdrawn = false;
  const memoryReply = memoryReplies.find((reply) => (
    reply.id === input.replyId
    && reply.planKey === input.planKey
    && reply.roomSlug === roomSlug
    && reply.userId === input.userId
    && reply.status === "active"
  ));

  if (memoryReply) {
    memoryReply.status = "hidden";
    withdrawn = true;
  }

  if (input.roomId) {
    withdrawn = await safeDb(
      "withdraw reply",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [plan] = await db
          .select({ id: socialRoomPlans.id })
          .from(socialRoomPlans)
          .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
          .limit(1);
        if (!plan) return withdrawn;

        const [reply] = await db
          .update(socialRoomReplies)
          .set({ status: "hidden", updated_at: new Date() })
          .where(and(
            eq(socialRoomReplies.id, input.replyId),
            eq(socialRoomReplies.plan_id, plan.id),
            eq(socialRoomReplies.user_id, input.userId),
            eq(socialRoomReplies.status, "active"),
          ))
          .returning({ id: socialRoomReplies.id });

        return Boolean(reply) || withdrawn;
      },
      () => withdrawn,
    );
  }

  return {
    withdrawnReply: {
      planId: input.planKey,
      replyId: input.replyId,
      withdrawn,
    },
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function voteTogetherPoll(input: {
  userId: string;
  roomId?: string | null;
  pollKey: string;
  optionId: string | null;
  language: SocialLanguage;
}) {
  const isClearingVote = input.optionId === null;
  const pollOptions = pollOptionsForKey(input.pollKey);
  const validPoll = pollOptions.length > 0;
  const validOption = !isClearingVote && pollOptions.some((option) => option.id === input.optionId);
  if (!validPoll || (!isClearingVote && !validOption)) {
    return { error: "Invalid poll option" as const };
  }

  const moderatedStatus = memoryPollStatuses.get(input.pollKey);
  if (moderatedStatus && moderatedStatus !== "active") {
    return { error: "Poll is closed" as const };
  }

  if (input.roomId && issuePlanKeyFromPollKey(input.pollKey)) {
    const issuePollReady = await safeDb(
      "ensure issue poll",
      async () => Boolean(await ensureIssuePollRow({
        roomId: input.roomId!,
        pollKey: input.pollKey,
        userId: input.userId,
      })),
      () => true,
    );
    if (!issuePollReady) return { error: "Invalid poll option" as const };
  }

  if (input.roomId) {
    const canVote = await safeDb(
      "check poll status",
      async () => {
        await ensureSeedRows(input.roomId!);
        if (issuePlanKeyFromPollKey(input.pollKey)) {
          await ensureIssuePollRow({
            roomId: input.roomId!,
            pollKey: input.pollKey,
            userId: input.userId,
          });
        }
        const [poll] = await db
          .select({ status: socialRoomPolls.status })
          .from(socialRoomPolls)
          .where(and(eq(socialRoomPolls.room_id, input.roomId!), eq(socialRoomPolls.poll_key, input.pollKey)))
          .limit(1);
        return !poll || poll.status === "active";
      },
      () => true,
    );

    if (!canVote) return { error: "Poll is closed" as const };
  }

  if (isClearingVote) {
    pollVotes.delete(voteKey(input.userId, input.pollKey));
  } else {
    pollVotes.set(voteKey(input.userId, input.pollKey), input.optionId);
  }

  if (input.roomId) {
    await safeDb(
      "vote poll",
      async () => {
        await ensureSeedRows(input.roomId!);
        if (issuePlanKeyFromPollKey(input.pollKey)) {
          await ensureIssuePollRow({
            roomId: input.roomId!,
            pollKey: input.pollKey,
            userId: input.userId,
          });
        }
        const [poll] = await db
          .select({ id: socialRoomPolls.id })
          .from(socialRoomPolls)
          .where(and(eq(socialRoomPolls.room_id, input.roomId!), eq(socialRoomPolls.poll_key, input.pollKey)))
          .limit(1);
        if (!poll) return;

        if (isClearingVote) {
          await db
            .delete(socialRoomVotes)
            .where(and(eq(socialRoomVotes.poll_id, poll.id), eq(socialRoomVotes.user_id, input.userId)));
          return;
        }

        await db
          .insert(socialRoomVotes)
          .values({
            poll_id: poll.id,
            user_id: input.userId,
            option_id: input.optionId,
          })
          .onConflictDoUpdate({
            target: [socialRoomVotes.poll_id, socialRoomVotes.user_id],
            set: {
              option_id: input.optionId,
              updated_at: new Date(),
            },
          });
      },
      async () => undefined,
    );
  }

  if (!isClearingVote) {
    await clearTogetherQuietPause({
      userId: input.userId,
      roomSlug: TOGETHER_ROOM_SLUG,
      roomId: input.roomId,
    });
  }

  const pulse = await buildTogetherRoomPulse(input.userId, input.language, input.roomId);
  const votedPoll = [pulse.activePoll, ...(pulse.issuePolls ?? [])].find((poll) => poll.key === input.pollKey) ?? pulse.activePoll;
  return {
    vote: {
      pollId: input.pollKey,
      optionId: input.optionId,
      options: votedPoll.options,
      totalVotes: votedPoll.totalVotes,
    },
    pulse,
  };
}

export async function createTogetherProposal(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  title: string;
  details: string;
  locationLabel?: string;
  comfortNeeds?: SocialRoomComfortNeed[];
  kind?: SocialRoomPlanKind;
  experienceCategory?: SocialRoomExperienceCategory;
  preferredTime?: SocialRoomPreferredTime;
  costRange?: SocialRoomCostRange;
  groupSize?: SocialRoomGroupSize;
  language: SocialLanguage;
}) {
  const locationLabel = input.locationLabel === "nearby" ? "nearby" : "online";
  const kind = normalizePlanKind(input.kind);
  const comfortNeeds = kind === "plan" ? normalizeComfortNeeds(input.comfortNeeds) : [];
  const experienceCategory = kind === "plan" ? normalizeExperienceCategory(input.experienceCategory) : "other";
  const preferredTime = kind === "plan" ? normalizePreferredTime(input.preferredTime) : "flexible";
  const costRange = kind === "plan" ? normalizeCostRange(input.costRange) : "discuss";
  const groupSize = kind === "plan" ? normalizeGroupSize(input.groupSize) : "one_to_one";
  const safetyFlags = detectSafetyFlags({
    category: experienceCategory,
    title: input.title,
    details: input.details,
  });
  const needsReview = shouldReviewExperience(kind, safetyFlags);
  const proposalStatus = needsReview ? "pending_review" : "active";
  const proposalIdentity = {
    userId: input.userId,
    roomSlug: input.roomSlug,
    kind,
    title: input.title,
    details: input.details,
    locationLabel,
    comfortNeeds,
    experienceCategory,
    preferredTime,
    costRange,
    groupSize,
    safetyFlags,
    needsReview,
  };
  const duplicateMemoryProposal = existingMemoryProposal(proposalIdentity);
  if (duplicateMemoryProposal) {
    await clearTogetherQuietPause({
      userId: input.userId,
      roomSlug: input.roomSlug,
      roomId: input.roomId,
    });
    return {
      proposal: duplicateMemoryProposal,
      pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
    };
  }

  const duplicateDbProposal = input.roomId
    ? await existingDbProposal({
        ...proposalIdentity,
        roomId: input.roomId,
        language: input.language,
      })
    : null;
  const duplicateAfterDbProposal = existingMemoryProposal(proposalIdentity);
  if (duplicateAfterDbProposal) {
    await clearTogetherQuietPause({
      userId: input.userId,
      roomSlug: input.roomSlug,
      roomId: input.roomId,
    });
    return {
      proposal: duplicateAfterDbProposal,
      pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
    };
  }
  if (duplicateDbProposal) {
    await clearTogetherQuietPause({
      userId: input.userId,
      roomSlug: input.roomSlug,
      roomId: input.roomId,
    });
    return {
      proposal: duplicateDbProposal,
      pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
    };
  }

  const proposalId = randomUUID();
  const proposal = {
    id: proposalId,
    planKey: `experience-${proposalId}`,
    roomSlug: publicRoomId(input.roomSlug),
    userId: input.userId,
    kind,
    title: input.title,
    details: input.details,
    locationLabel,
    comfortNeeds,
    experienceCategory,
    preferredTime,
    costRange,
    groupSize,
    safetyFlags,
    needsReview,
    status: proposalStatus,
    createdAt: new Date().toISOString(),
  } satisfies MemoryProposal;
  proposals.unshift(proposal);

  if (needsReview) {
    await createAutomaticSafetyReport({
      userId: input.userId,
      roomSlug: input.roomSlug,
      roomId: input.roomId,
      reason: "proposal_needs_review",
      targetType: kind === "question" ? "question" : kind === "message" ? "message" : "plan",
      targetId: proposal.planKey,
      details: proposalReviewDetails(kind, safetyFlags, input.language),
    });
  }

  const proposalNotification = proposalNotificationCopy({
    needsReview,
    title: input.title,
    details: input.details,
    language: input.language,
  });

  pushMemoryNotification({
    userId: input.userId,
    roomSlug: proposal.roomSlug,
    type: proposalNotification.type,
    title: proposalNotification.title,
    body: proposalNotification.body,
    metadata: {
      proposalId: proposal.id,
      planKey: proposal.planKey,
      kind,
      comfortNeeds,
      experienceCategory,
      preferredTime,
      costRange,
      groupSize,
      safetyFlags,
      needsReview,
    },
  });

  if (input.roomId) {
    await safeDb(
      "create proposal",
      async () => {
        await db
          .insert(socialRoomPlans)
          .values({
            room_id: input.roomId!,
            plan_key: proposal.planKey,
            kind,
            title_es: input.title,
            title_de: input.title,
            title_en: input.title,
            body_es: input.details,
            body_de: input.details,
            body_en: input.details,
            location_label: locationLabel,
            comfort_needs: comfortNeeds,
            experience_category: experienceCategory,
            preferred_time: preferredTime,
            cost_range: costRange,
            group_size: groupSize,
            safety_flags: safetyFlags,
            needs_review: needsReview,
            status: proposalStatus,
            source: "user",
            created_by: input.userId,
          })
          .onConflictDoNothing({
            target: [socialRoomPlans.room_id, socialRoomPlans.plan_key],
          });

        await db.insert(socialRoomNotifications).values({
          user_id: input.userId,
          room_id: input.roomId,
          type: proposalNotification.type,
          title: proposalNotification.title,
          body: proposalNotification.body,
          metadata: {
            proposalId: proposal.id,
            planKey: proposal.planKey,
            kind,
            comfortNeeds,
            experienceCategory,
            preferredTime,
            costRange,
            groupSize,
            safetyFlags,
            needsReview,
          },
        });
      },
      async () => undefined,
    );
  }

  await clearTogetherQuietPause({
    userId: input.userId,
    roomSlug: input.roomSlug,
    roomId: input.roomId,
  });

  return {
    proposal,
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function withdrawTogetherProposal(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  planKey: string;
  language: SocialLanguage;
}) {
  const roomSlug = publicRoomId(input.roomSlug);
  let withdrawn = false;
  const memoryPlan = proposals.find((proposal) => (
    proposal.planKey === input.planKey
    && proposal.roomSlug === roomSlug
    && proposal.userId === input.userId
    && proposal.status === "active"
  ));
  if (memoryPlan) {
    memoryPlan.status = "hidden";
    withdrawn = true;
  }

  if (input.roomId) {
    withdrawn = await safeDb(
      "withdraw proposal",
      async () => {
        const [plan] = await db
          .update(socialRoomPlans)
          .set({ status: "hidden", updated_at: new Date() })
          .where(and(
            eq(socialRoomPlans.room_id, input.roomId!),
            eq(socialRoomPlans.plan_key, input.planKey),
            eq(socialRoomPlans.created_by, input.userId),
            eq(socialRoomPlans.status, "active"),
          ))
          .returning({ id: socialRoomPlans.id });
        return Boolean(plan) || withdrawn;
      },
      () => withdrawn,
    );
  }

  return {
    withdrawnItem: {
      planId: input.planKey,
      withdrawn,
    },
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function createTogetherSafetyReport(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  reason: string;
  details: string;
  targetType?: SocialRoomSafetyReportTargetType;
  targetId?: string | null;
  language: SocialLanguage;
}) {
  const targetType = input.targetType ?? "room";
  const duplicateMemoryReport = existingMemorySafetyReport({
    userId: input.userId,
    roomSlug: input.roomSlug,
    targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details,
  });
  if (duplicateMemoryReport) {
    return {
      reportId: duplicateMemoryReport.id,
      report: duplicateMemoryReport,
      pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
    };
  }

  const duplicateDbReport = input.roomId
    ? await existingDbSafetyReport({
        userId: input.userId,
        roomSlug: input.roomSlug,
        roomId: input.roomId,
        targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details,
      })
    : null;
  const duplicateAfterDbReport = existingMemorySafetyReport({
    userId: input.userId,
    roomSlug: input.roomSlug,
    targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details,
  });
  if (duplicateAfterDbReport) {
    return {
      reportId: duplicateAfterDbReport.id,
      report: duplicateAfterDbReport,
      pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
    };
  }
  if (duplicateDbReport) {
    return {
      reportId: duplicateDbReport.id,
      report: duplicateDbReport,
      pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
    };
  }

  const report: MemoryReport = {
    id: randomUUID(),
    roomSlug: publicRoomId(input.roomSlug),
    reporterId: input.userId,
    targetType,
    targetId: input.targetId ?? null,
    reason: input.reason,
    details: input.details,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  reports.unshift(report);

  const notificationCopy = safetyReportNotificationCopy(input.language);
  pushMemoryNotification({
    userId: input.userId,
    roomSlug: input.roomSlug,
    type: "safety_report_sent",
    title: notificationCopy.title,
    body: notificationCopy.body,
    metadata: { reportId: report.id, targetType, targetId: input.targetId ?? null, reason: input.reason },
  });

  if (input.roomId) {
    await safeDb(
      "create safety report",
      async () => {
        await db.insert(socialRoomSafetyReports).values({
          id: report.id,
          room_id: input.roomId!,
          reporter_id: input.userId,
          target_type: targetType,
          target_id: input.targetId ?? null,
          reason: input.reason,
          details: input.details,
        });

        await db.insert(socialRoomNotifications).values({
          user_id: input.userId,
          room_id: input.roomId!,
          type: "safety_report_sent",
          title: notificationCopy.title,
          body: notificationCopy.body,
          metadata: {
            reportId: report.id,
            targetType,
            targetId: input.targetId ?? null,
            reason: input.reason,
          },
        });
      },
      async () => undefined,
    );
  }

  return {
    reportId: report.id,
    report,
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function acknowledgeTogetherAgreement(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  language: SocialLanguage;
}) {
  const acknowledgedAt = new Date();
  agreementAcknowledgements.set(agreementKey(input.userId, input.roomSlug), acknowledgedAt.toISOString());

  if (input.roomId) {
    await safeDb(
      "acknowledge agreement",
      async () => {
        await db
          .insert(socialRoomMemberRoles)
          .values({
            room_id: input.roomId!,
            user_id: input.userId,
            role: "member",
            status: "active",
            agreement_acknowledged_at: acknowledgedAt,
          })
          .onConflictDoUpdate({
            target: [socialRoomMemberRoles.room_id, socialRoomMemberRoles.user_id],
            set: {
              status: "active",
              agreement_acknowledged_at: acknowledgedAt,
              updated_at: acknowledgedAt,
            },
          });
      },
      async () => undefined,
    );
  }

  return {
    acknowledgedAt: acknowledgedAt.toISOString(),
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function saveTogetherComfortCheck(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  comfortNeeds: SocialRoomComfortNeed[];
  language: SocialLanguage;
}) {
  const comfortNeeds = normalizeComfortNeeds(input.comfortNeeds);
  const savedAt = new Date();
  comfortCheckIns.set(comfortCheckKey(input.userId, input.roomSlug), comfortNeeds);

  if (input.roomId) {
    await safeDb(
      "save comfort check",
      async () => {
        await db
          .insert(socialRoomMemberRoles)
          .values({
            room_id: input.roomId!,
            user_id: input.userId,
            role: "member",
            status: "active",
            comfort_needs: comfortNeeds,
          })
          .onConflictDoUpdate({
            target: [socialRoomMemberRoles.room_id, socialRoomMemberRoles.user_id],
            set: {
              status: "active",
              comfort_needs: comfortNeeds,
              updated_at: savedAt,
            },
          });
      },
      async () => undefined,
    );
  }

  return {
    comfortNeeds,
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function saveTogetherQuietPause(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  paused: boolean;
  language: SocialLanguage;
}) {
  const savedAt = new Date();
  const quietPausedAt = input.paused ? savedAt.toISOString() : null;
  const key = comfortCheckKey(input.userId, input.roomSlug);
  if (quietPausedAt) {
    quietPauses.set(key, quietPausedAt);
  } else {
    quietPauses.delete(key);
  }

  if (input.roomId) {
    await safeDb(
      "save quiet pause",
      async () => {
        await db
          .insert(socialRoomMemberRoles)
          .values({
            room_id: input.roomId!,
            user_id: input.userId,
            role: "member",
            status: "active",
            quiet_paused_at: input.paused ? savedAt : null,
          })
          .onConflictDoUpdate({
            target: [socialRoomMemberRoles.room_id, socialRoomMemberRoles.user_id],
            set: {
              status: "active",
              quiet_paused_at: input.paused ? savedAt : null,
              updated_at: savedAt,
            },
          });
      },
      async () => undefined,
    );
  }

  return {
    quietPausedAt,
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function listTogetherModeration(roomSlug: string, roomId?: string | null) {
  const publicSlug = publicRoomId(roomSlug);
  const memoryActions = memoryModerationActions.filter((action) => action.room_id === publicSlug);
  if (!roomId) {
    return {
      reports: reports.filter((report) => report.roomSlug === publicSlug),
      proposals: proposals.filter((proposal) => proposal.roomSlug === publicSlug),
      replies: memoryReplies.filter((reply) => reply.roomSlug === publicSlug),
      actions: memoryActions,
    };
  }

  return safeDb(
    "list moderation",
    async () => {
      const [reportRows, actionRows, planRows, pollRows] = await Promise.all([
        db
          .select()
          .from(socialRoomSafetyReports)
          .where(eq(socialRoomSafetyReports.room_id, roomId))
          .orderBy(desc(socialRoomSafetyReports.created_at)),
        db
          .select()
          .from(socialRoomModerationActions)
          .where(eq(socialRoomModerationActions.room_id, roomId))
          .orderBy(desc(socialRoomModerationActions.created_at)),
        db.select().from(socialRoomPlans).where(eq(socialRoomPlans.room_id, roomId)),
        db.select().from(socialRoomPolls).where(eq(socialRoomPolls.room_id, roomId)),
      ]);
      const replyRows = planRows.length
        ? await db.select().from(socialRoomReplies).where(inArray(socialRoomReplies.plan_id, planRows.map((plan) => plan.id)))
        : [];

      return {
        reports: reportRows.map((report) => ({
          id: report.id,
          roomSlug,
          reporterId: report.reporter_id,
          targetType: report.target_type as SocialRoomSafetyReportTargetType,
          targetId: report.target_id ?? null,
          reason: report.reason,
          details: report.details,
          status: report.status,
          createdAt: report.created_at.toISOString(),
          reviewedAt: report.reviewed_at?.toISOString() ?? null,
          reviewedBy: report.reviewed_by ?? null,
        })),
        proposals: proposals.filter((proposal) => proposal.roomSlug === publicRoomId(roomSlug)),
        actions: actionRows,
        plans: planRows,
        polls: pollRows,
        replies: replyRows,
      };
    },
    () => ({
      reports: reports.filter((report) => report.roomSlug === publicSlug),
      proposals: proposals.filter((proposal) => proposal.roomSlug === publicSlug),
      replies: memoryReplies.filter((reply) => reply.roomSlug === publicSlug),
      actions: memoryActions,
    }),
  );
}

export async function updateTogetherReport(input: {
  reportId: string;
  adminUserId: string;
  status: string;
  notes?: string;
  roomSlug?: string;
  roomId?: string | null;
  language?: SocialLanguage;
}) {
  const reviewedAt = new Date();
  const publicSlug = input.roomSlug ? publicRoomId(input.roomSlug) : null;
  const memoryReport = reports.find((report) => (
    report.id === input.reportId &&
    (!publicSlug || report.roomSlug === publicSlug)
  ));
  if (memoryReport) {
    const copy = safetyReportReviewNotificationCopy(input.status, input.language ?? "en");
    memoryReport.status = input.status;
    memoryReport.reviewedAt = reviewedAt.toISOString();
    memoryReport.reviewedBy = input.adminUserId;
    pushMemoryModerationAction({
      room_id: memoryReport.roomSlug,
      admin_user_id: input.adminUserId,
      action_type: `report_${input.status}`,
      target_type: "report",
      target_id: input.reportId,
      notes: input.notes ?? "",
    });
    pushMemoryNotification({
      userId: memoryReport.reporterId,
      roomSlug: memoryReport.roomSlug,
      type: "safety_report_reviewed",
      title: copy.title,
      body: copy.body,
      metadata: {
        reportId: input.reportId,
        status: input.status,
        targetType: memoryReport.targetType,
        targetId: memoryReport.targetId ?? null,
      },
    });
  }

  await safeDb(
    "update report",
    async () => {
      const reportWhere = input.roomId
        ? and(eq(socialRoomSafetyReports.id, input.reportId), eq(socialRoomSafetyReports.room_id, input.roomId))
        : eq(socialRoomSafetyReports.id, input.reportId);
      const [report] = await db
        .update(socialRoomSafetyReports)
        .set({
          status: input.status,
          reviewed_at: reviewedAt,
          reviewed_by: input.adminUserId,
        })
        .where(reportWhere)
        .returning();

      if (report) {
        const copy = safetyReportReviewNotificationCopy(input.status, input.language ?? "en");
        await db.insert(socialRoomModerationActions).values({
          room_id: report.room_id,
          admin_user_id: input.adminUserId,
          action_type: `report_${input.status}`,
          target_type: "report",
          target_id: input.reportId,
          notes: input.notes ?? "",
        });
        await db.insert(socialRoomNotifications).values({
          user_id: report.reporter_id,
          room_id: report.room_id,
          type: "safety_report_reviewed",
          title: copy.title,
          body: copy.body,
          metadata: {
            reportId: input.reportId,
            status: input.status,
            targetType: report.target_type,
            targetId: report.target_id ?? null,
          },
        });
      }
    },
    async () => undefined,
  );
}

export async function updateTogetherPlanModeration(input: {
  planKey: string;
  adminUserId: string;
  roomSlug?: string;
  roomId?: string | null;
  status: string;
  notes?: string;
}) {
  const roomSlug = publicRoomId(input.roomSlug ?? TOGETHER_ROOM_SLUG);
  if (roomSlug !== TOGETHER_ROOM_SLUG) return;
  const memoryPlan = proposals.find((proposal) => (
    proposal.planKey === input.planKey &&
    proposal.roomSlug === roomSlug
  ));
  if (memoryPlan) {
    memoryPlan.status = input.status === "active" || input.status === "hidden" || input.status === "closed"
      ? input.status
      : memoryPlan.status;
    pushMemoryModerationAction({
      room_id: memoryPlan.roomSlug,
      admin_user_id: input.adminUserId,
      action_type: `plan_${input.status}`,
      target_type: "plan",
      target_id: input.planKey,
      notes: input.notes ?? "",
    });
  }

  if (!input.roomId) return;
  await safeDb(
    "update plan moderation",
    async () => {
      const [plan] = await db
        .update(socialRoomPlans)
        .set({ status: input.status, updated_at: new Date() })
        .where(and(eq(socialRoomPlans.room_id, input.roomId!), eq(socialRoomPlans.plan_key, input.planKey)))
        .returning();

      if (plan) {
        await db.insert(socialRoomModerationActions).values({
          room_id: input.roomId!,
          admin_user_id: input.adminUserId,
          action_type: `plan_${input.status}`,
          target_type: "plan",
          target_id: input.planKey,
          notes: input.notes ?? "",
        });
      }
    },
    async () => undefined,
  );
}

export async function updateTogetherReplyModeration(input: {
  replyId: string;
  adminUserId: string;
  roomSlug?: string;
  roomId?: string | null;
  status: string;
  notes?: string;
}) {
  const roomSlug = publicRoomId(input.roomSlug ?? TOGETHER_ROOM_SLUG);
  if (roomSlug !== TOGETHER_ROOM_SLUG) return;
  const memoryReply = memoryReplies.find((reply) => (
    reply.id === input.replyId &&
    reply.roomSlug === roomSlug
  ));
  if (memoryReply) {
    memoryReply.status = input.status;
    pushMemoryModerationAction({
      room_id: memoryReply.roomSlug,
      admin_user_id: input.adminUserId,
      action_type: `reply_${input.status}`,
      target_type: "reply",
      target_id: input.replyId,
      notes: input.notes ?? "",
    });
  }

  if (!input.roomId) return;
  await safeDb(
    "update reply moderation",
    async () => {
      const [reply] = await db
        .update(socialRoomReplies)
        .set({ status: input.status, updated_at: new Date() })
        .where(eq(socialRoomReplies.id, input.replyId))
        .returning();

      if (reply) {
        await db.insert(socialRoomModerationActions).values({
          room_id: input.roomId!,
          admin_user_id: input.adminUserId,
          action_type: `reply_${input.status}`,
          target_type: "reply",
          target_id: input.replyId,
          notes: input.notes ?? "",
        });
      }
    },
    async () => undefined,
  );
}

export async function updateTogetherPollModeration(input: {
  pollKey: string;
  adminUserId: string;
  roomSlug?: string;
  roomId?: string | null;
  status: string;
  notes?: string;
}) {
  const roomSlug = publicRoomId(input.roomSlug ?? TOGETHER_ROOM_SLUG);
  if (roomSlug !== TOGETHER_ROOM_SLUG) return;
  if (input.status === "active" || input.status === "closed" || input.status === "hidden") {
    memoryPollStatuses.set(input.pollKey, input.status);
    pushMemoryModerationAction({
      room_id: roomSlug,
      admin_user_id: input.adminUserId,
      action_type: `poll_${input.status}`,
      target_type: "poll",
      target_id: input.pollKey,
      notes: input.notes ?? "",
    });
  }

  if (!input.roomId) return;
  await safeDb(
    "update poll moderation",
    async () => {
      const [poll] = await db
        .update(socialRoomPolls)
        .set({ status: input.status, updated_at: new Date() })
        .where(and(eq(socialRoomPolls.room_id, input.roomId!), eq(socialRoomPolls.poll_key, input.pollKey)))
        .returning();

      if (poll) {
        await db.insert(socialRoomModerationActions).values({
          room_id: input.roomId!,
          admin_user_id: input.adminUserId,
          action_type: `poll_${input.status}`,
          target_type: "poll",
          target_id: input.pollKey,
          notes: input.notes ?? "",
        });
      }
    },
    async () => undefined,
  );
}

export function memberPulseSummary(members: SocialRoomMember[]) {
  return members.slice(0, 3).map((member) => ({
    id: member.id,
    name: member.name,
    statusLabel: member.statusLabel ?? member.sharedTopic ?? "",
  }));
}
