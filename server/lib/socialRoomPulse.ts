import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
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
  SocialRoomMember,
  SocialRoomPlan,
  SocialRoomPlanKind,
  SocialRoomPlanResponseValue,
  SocialRoomReply,
  SocialRoomReplyTone,
  SocialRoomNotification,
  SocialRoomPulse,
  SocialRoomPoll,
  SocialRoomPreferredTime,
  SocialRoomSafetyFlag,
  SocialRoomSafetyReportTargetType,
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

const TOGETHER_ROOM_SLUG = "together-room";
const DAILY_POLL_KEY = "daily-room-choice";
const SAFE_DB_TIMEOUT_MS = 1400;
const COMFORT_NEED_OPTIONS: SocialRoomComfortNeed[] = ["quiet_pace", "easy_access", "seating"];

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
    comfortNeeds: ["easy_access", "seating"],
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
  { id: "hello", label: t("Solo saludar", "Just say hello", "Nur Hallo sagen") },
];

const planResponses = new Map<string, SocialRoomPlanResponseValue>();
const pollVotes = new Map<string, string>();
const proposals: MemoryProposal[] = [];
const memoryReplies: MemoryReply[] = [];
const memoryNotifications: MemoryNotification[] = [];
const agreementAcknowledgements = new Map<string, string>();
const comfortCheckIns = new Map<string, SocialRoomComfortNeed[]>();

function normalizePlanKind(value: unknown): SocialRoomPlanKind {
  if (value === "message" || value === "question") return value;
  return "plan";
}

function normalizeComfortNeeds(value: unknown): SocialRoomComfortNeed[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<SocialRoomComfortNeed>(["quiet_pace", "easy_access", "seating"]);
  return Array.from(new Set(value.filter((item): item is SocialRoomComfortNeed => allowed.has(item as SocialRoomComfortNeed)))).slice(0, 3);
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
  const allowed = new Set<SocialRoomSafetyFlag>(["money", "housing", "service", "private_contact", "transport"]);
  return Array.from(new Set(value.filter((item): item is SocialRoomSafetyFlag => allowed.has(item as SocialRoomSafetyFlag)))).slice(0, 5);
}

export function detectSafetyFlags(input: {
  category: SocialRoomExperienceCategory;
  title: string;
  details: string;
}): SocialRoomSafetyFlag[] {
  const flags = new Set<SocialRoomSafetyFlag>();
  const text = `${input.title} ${input.details}`.toLowerCase();

  if (input.category === "home_share") flags.add("housing");
  if (input.category === "service_booking") flags.add("service");
  if (input.category === "deal_help") flags.add("money");

  if (/\b(bank|banco|cash|card|contract|contrato|crypto|deal|deposit|discount|efectivo|geld|gift card|invoice|loan|money|pagar|pay|payment|pago|price|refund|rent|renta|transfer|transferencia|zahlen)\b/.test(text)) {
    flags.add("money");
  }
  if (/\b(address|adresse|correo|direccion|e-?mail|email|fuera de la app|number|nummer|outside the app|phone|private contact|telefono|telefon|text me|whatsapp)\b/.test(text) || /https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) {
    flags.add("private_contact");
  }
  if (/\b(apartment|home share|house|lease|rent|roommate|tenant)\b/.test(text)) {
    flags.add("housing");
  }
  if (/\b(book a service|caregiver|cleaner|handyman|repair|service|worker)\b/.test(text)) {
    flags.add("service");
  }
  if (/\b(car|driver|lift|ride|taxi|transport)\b/.test(text)) {
    flags.add("transport");
  }

  return Array.from(flags).slice(0, 5);
}

function shouldReviewExperience(kind: SocialRoomPlanKind, safetyFlags: SocialRoomSafetyFlag[]) {
  return kind === "plan" && safetyFlags.length > 0;
}

export function shouldBlockReply(safetyFlags: SocialRoomSafetyFlag[]) {
  return safetyFlags.length > 0;
}

export function blockedReplyDetails(safetyFlags: SocialRoomSafetyFlag[], language: SocialLanguage) {
  const flags = safetyFlags.join(", ");
  if (language === "de") return `Eine Antwort wurde vor dem Teilen gestoppt, weil sie geschuetzte Kontaktdaten, Zahlung, Wohnen, Service oder Transport betreffen koennte. Hinweise: ${flags}.`;
  if (language === "en") return `A reply was stopped before sharing because it may involve protected contact, payment, housing, services or transport. Signals: ${flags}.`;
  return `Se detuvo una respuesta antes de compartirla porque podria incluir contacto protegido, pagos, vivienda, servicios o transporte. Senales: ${flags}.`;
}

function proposalReviewDetails(safetyFlags: SocialRoomSafetyFlag[], language: SocialLanguage) {
  const flags = safetyFlags.join(", ");
  if (language === "de") return `Eine geteilte Aktivitaet wurde vor der Anzeige zur VYVA-Pruefung zurueckgehalten. Hinweise: ${flags}.`;
  if (language === "en") return `A shared activity was held for VYVA review before it appeared in the room. Signals: ${flags}.`;
  return `Se retuvo una actividad compartida para revision de VYVA antes de mostrarla en la sala. Senales: ${flags}.`;
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
  if (value === "help") return "help";
  return value === "curious" ? "curious" : "support";
}

function normalizeReplyBody(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 180);
}

const reports: MemoryReport[] = [];

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
  return value === "join" ? "join" : "maybe";
}

function responseKey(userId: string, planKey: string) {
  return `${userId}:${planKey}`;
}

function voteKey(userId: string, pollKey: string) {
  return `${userId}:${pollKey}`;
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

function memoryComfortNeedEntries(roomSlug: string) {
  const prefix = `${publicRoomId(roomSlug)}:`;
  return Array.from(comfortCheckIns.entries())
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, needs]) => [key.slice(prefix.length), normalizeComfortNeeds(needs)] as const);
}

function emptyPlanCounts() {
  return { join: 0, maybe: 0 };
}

function comfortCheckCopy(language: SocialLanguage) {
  if (language === "de") {
    return {
      title: "Was macht es angenehm?",
      body: "Tippe an, was dir hilft. Die Gruppe kann Plaene daran ausrichten.",
      labels: {
        quiet_pace: "Ruhiges Tempo",
        easy_access: "Einfacher Zugang",
        seating: "Sitzplatz",
      },
    };
  }

  if (language === "en") {
    return {
      title: "What would make this comfortable?",
      body: "Tap what helps. The room can shape plans around it.",
      labels: {
        quiet_pace: "Quiet pace",
        easy_access: "Easy access",
        seating: "Place to sit",
      },
    };
  }

  return {
    title: "Que lo haria comodo?",
    body: "Toca lo que ayuda. La sala puede adaptar los planes.",
    labels: {
      quiet_pace: "Ritmo tranquilo",
      easy_access: "Acceso facil",
      seating: "Sentarse",
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

function seededPlanCounts(planKey: string) {
  const counts = emptyPlanCounts();
  for (const [key, response] of planResponses.entries()) {
    if (!key.endsWith(`:${planKey}`)) continue;
    counts[response] += 1;
  }
  return counts;
}

function memoryRepliesForPlan(planKey: string, roomSlug: string, language: SocialLanguage): SocialRoomReply[] {
  return memoryReplies
    .filter((reply) => reply.planKey === planKey && reply.roomSlug === publicRoomId(roomSlug) && reply.status === "active")
    .slice(0, 3)
    .map((reply) => ({
      id: reply.id,
      planKey: reply.planKey,
      authorName: replyAuthorName(language),
      body: reply.body,
      tone: reply.tone,
      status: reply.status,
      createdAt: reply.createdAt,
    }));
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
    createdAt: proposal.createdAt,
    responseCounts: seededPlanCounts(proposal.planKey),
    myResponse: planResponses.get(responseKey(userId, proposal.planKey)) ?? null,
    replies: memoryRepliesForPlan(proposal.planKey, proposal.roomSlug, language),
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

async function createAutomaticSafetyReport(input: {
  userId: string;
  roomSlug: string;
  roomId?: string | null;
  reason: string;
  details: string;
  targetType: SocialRoomSafetyReportTargetType;
  targetId?: string | null;
}) {
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
  response: SocialRoomPlanResponseValue,
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
  for (const optionId of pollVotes.values()) {
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
    status: "active",
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    myVote: pollVotes.get(voteKey(userId, DAILY_POLL_KEY)) ?? null,
  };
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
    replies: memoryRepliesForPlan(plan.key, TOGETHER_ROOM_SLUG, language),
  }));

  return {
    featuredPlan: plans[0],
    secondaryPlans: plans.slice(1, 3),
    postedExperiences: memoryPostedExperiences(TOGETHER_ROOM_SLUG, userId, language),
    memberPresence: memberPulseSummary(memberPresence),
    activePoll: seededPoll(language, userId),
    comfortCheck: buildComfortCheck(userId, TOGETHER_ROOM_SLUG, language),
    discussionPrompt: getDiscussionPrompt(language),
    safety: getSafetyCopy(language, memoryAgreementAcknowledgedAt(userId, TOGETHER_ROOM_SLUG)),
    notifications: memoryNotificationsFor(userId, TOGETHER_ROOM_SLUG),
  };
}

function getDiscussionPrompt(language: SocialLanguage) {
  if (language === "de") {
    return {
      id: "gentle-start",
      title: "Was moechtest du sagen?",
      body: "Du kannst klein anfangen. VYVA hilft, wenn du nicht weisst, wie.",
      starterButtons: ["Hallo sagen", "Plan vorschlagen", "VYVA fragen"],
    };
  }

  if (language === "en") {
    return {
      id: "gentle-start",
      title: "What would you like to say?",
      body: "You can start small. VYVA can help if you are not sure how.",
      starterButtons: ["Say hello", "Suggest a plan", "Ask VYVA"],
    };
  }

  return {
    id: "gentle-start",
    title: "Que te gustaria decir?",
    body: "Puedes empezar poco a poco. VYVA ayuda si no sabes como.",
    starterButtons: ["Saludar", "Sugerir plan", "Preguntar a VYVA"],
  };
}

function getSafetyCopy(language: SocialLanguage, acknowledgedAt: string | null = null) {
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
        .where(and(eq(socialRoomPolls.room_id, roomId), ne(socialRoomPolls.status, "hidden")))
        .limit(1);

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
      const poll = pollRows[0];
      const voteRows = poll
        ? await db.select().from(socialRoomVotes).where(eq(socialRoomVotes.poll_id, poll.id))
        : [];
      const notifications = await db
        .select()
        .from(socialRoomNotifications)
        .where(and(eq(socialRoomNotifications.user_id, userId), isNull(socialRoomNotifications.read_at)))
        .orderBy(desc(socialRoomNotifications.created_at))
        .limit(3);
      const memberRoleRows = await db
        .select({
          user_id: socialRoomMemberRoles.user_id,
          agreement_acknowledged_at: socialRoomMemberRoles.agreement_acknowledged_at,
          comfort_needs: socialRoomMemberRoles.comfort_needs,
        })
        .from(socialRoomMemberRoles)
        .where(eq(socialRoomMemberRoles.room_id, roomId));
      const memberRole = memberRoleRows.find((role) => role.user_id === userId);
      const memberComfortNeeds = new Map(
        memberRoleRows.map((role) => [role.user_id, normalizeComfortNeeds(role.comfort_needs)] as const),
      );

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
              createdAt: reply.created_at.toISOString(),
            }));
          const dbReplyIds = new Set(dbReplies.map((reply) => reply.id));
          const replies = [
            ...memoryRepliesForPlan(plan.plan_key, TOGETHER_ROOM_SLUG, language).filter((reply) => !dbReplyIds.has(reply.id)),
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
            createdAt: plan.created_at.toISOString(),
            responseCounts: counts,
            myResponse: myResponse ? normalizePlanResponse(myResponse.response) : null,
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
      const activePoll = poll
        ? (() => {
            const options = poll.options.map((option) => ({
              id: option.id,
              label: rowPollOptionLabel(option, language),
              votes: voteRows.filter((vote) => vote.option_id === option.id).length,
            }));
            return {
              id: poll.poll_key,
              key: poll.poll_key,
              question: rowPollQuestion(poll, language),
              status: poll.status,
              options,
              totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
              myVote: voteRows.find((vote) => vote.user_id === userId)?.option_id ?? null,
            };
          })()
        : fallback.activePoll;

      return {
        featuredPlan: plans[0] ?? fallback.featuredPlan,
        secondaryPlans: plans.slice(1, 3).length ? plans.slice(1, 3) : fallback.secondaryPlans,
        postedExperiences: [...memoryPosts, ...dbPostedExperiences].slice(0, 8),
        memberPresence: memberPulseSummary(memberPresence),
        activePoll,
        comfortCheck: buildComfortCheck(userId, TOGETHER_ROOM_SLUG, language, memberComfortNeeds),
        discussionPrompt: getDiscussionPrompt(language),
        safety: getSafetyCopy(
          language,
          memberRole?.agreement_acknowledged_at?.toISOString() ??
            memoryAgreementAcknowledgedAt(userId, TOGETHER_ROOM_SLUG),
        ),
        notifications: notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          createdAt: notification.created_at.toISOString(),
          readAt: notification.read_at?.toISOString() ?? null,
        })),
      };
    },
    () => fallbackPulse(userId, language, memberPresence),
  );
}

export async function respondToTogetherPlan(input: {
  userId: string;
  roomId?: string | null;
  planKey: string;
  response: SocialRoomPlanResponseValue;
  language: SocialLanguage;
}) {
  const previousMemoryResponse = planResponses.get(responseKey(input.userId, input.planKey));
  const memoryPlan = proposals.find((proposal) => proposal.planKey === input.planKey);
  if (memoryPlan && memoryPlan.status !== "active") {
    return { error: "Shared item needs VYVA review before members can join it" as const };
  }

  if (input.roomId) {
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

  planResponses.set(responseKey(input.userId, input.planKey), input.response);

  if (
    memoryPlan &&
    memoryPlan.userId !== input.userId &&
    previousMemoryResponse !== input.response
  ) {
    const copy = planResponseNotificationCopy(input.response, memoryPlan.title, input.language);
    pushMemoryNotification({
      userId: memoryPlan.userId,
      roomSlug: memoryPlan.roomSlug,
      type: input.response === "join" ? "plan_joined" : "plan_saved",
      title: copy.title,
      body: copy.body,
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
            response: input.response,
          })
          .onConflictDoUpdate({
            target: [socialRoomPlanResponses.plan_id, socialRoomPlanResponses.user_id],
            set: {
              response: input.response,
              updated_at: new Date(),
            },
          });

        if (plan.created_by && plan.created_by !== input.userId && existingResponse?.response !== input.response) {
          const copy = planResponseNotificationCopy(input.response, rowPlanTitle(plan, input.language), input.language);
          await db.insert(socialRoomNotifications).values({
            user_id: plan.created_by,
            room_id: input.roomId,
            type: input.response === "join" ? "plan_joined" : "plan_saved",
            title: copy.title,
            body: copy.body,
            metadata: { planKey: input.planKey, response: input.response, responderId: input.userId },
          });
        }
      },
      async () => undefined,
    );
  }

  const pulse = await buildTogetherRoomPulse(input.userId, input.language, input.roomId);
  return {
    planResponse: {
      planId: input.planKey,
      response: input.response,
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

  return {
    reply: {
      id: reply.id,
      planKey: reply.planKey,
      authorName: replyAuthorName(input.language),
      body: reply.body,
      tone: reply.tone,
      status: reply.status,
      createdAt: reply.createdAt,
    } satisfies SocialRoomReply,
    pulse: await buildTogetherRoomPulse(input.userId, input.language, input.roomId),
  };
}

export async function voteTogetherPoll(input: {
  userId: string;
  roomId?: string | null;
  pollKey: string;
  optionId: string;
  language: SocialLanguage;
}) {
  const validOption = pollOptions.some((option) => option.id === input.optionId);
  if (!validOption) {
    return { error: "Invalid poll option" as const };
  }

  if (input.roomId) {
    const canVote = await safeDb(
      "check poll status",
      async () => {
        await ensureSeedRows(input.roomId!);
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

  pollVotes.set(voteKey(input.userId, input.pollKey), input.optionId);

  if (input.roomId) {
    await safeDb(
      "vote poll",
      async () => {
        await ensureSeedRows(input.roomId!);
        const [poll] = await db
          .select({ id: socialRoomPolls.id })
          .from(socialRoomPolls)
          .where(and(eq(socialRoomPolls.room_id, input.roomId!), eq(socialRoomPolls.poll_key, input.pollKey)))
          .limit(1);
        if (!poll) return;

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

  const pulse = await buildTogetherRoomPulse(input.userId, input.language, input.roomId);
  return {
    vote: {
      pollId: input.pollKey,
      optionId: input.optionId,
      options: pulse.activePoll.options,
      totalVotes: pulse.activePoll.totalVotes,
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
      details: proposalReviewDetails(safetyFlags, input.language),
    });
  }

  pushMemoryNotification({
    userId: input.userId,
    roomSlug: proposal.roomSlug,
    type: "proposal_created",
    title: input.title,
    body: input.details,
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
          type: "proposal_created",
          title: input.title,
          body: input.details,
          metadata: {
            proposalId: proposal.id,
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

  return {
    proposal,
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

  if (input.roomId) {
    await safeDb(
      "create safety report",
      async () => {
        await db.insert(socialRoomSafetyReports).values({
          room_id: input.roomId!,
          reporter_id: input.userId,
          target_type: targetType,
          target_id: input.targetId ?? null,
          reason: input.reason,
          details: input.details,
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

export async function listTogetherModeration(roomSlug: string, roomId?: string | null) {
  if (!roomId) {
    return {
      reports: reports.filter((report) => report.roomSlug === publicRoomId(roomSlug)),
      proposals: proposals.filter((proposal) => proposal.roomSlug === publicRoomId(roomSlug)),
      replies: memoryReplies.filter((reply) => reply.roomSlug === publicRoomId(roomSlug)),
      actions: [],
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
      reports: reports.filter((report) => report.roomSlug === publicRoomId(roomSlug)),
      proposals: proposals.filter((proposal) => proposal.roomSlug === publicRoomId(roomSlug)),
      replies: memoryReplies.filter((reply) => reply.roomSlug === publicRoomId(roomSlug)),
      actions: [],
    }),
  );
}

export async function updateTogetherReport(input: {
  reportId: string;
  adminUserId: string;
  status: string;
}) {
  const memoryReport = reports.find((report) => report.id === input.reportId);
  if (memoryReport) {
    memoryReport.status = input.status;
    memoryReport.reviewedAt = new Date().toISOString();
    memoryReport.reviewedBy = input.adminUserId;
  }

  await safeDb(
    "update report",
    async () => {
      await db
        .update(socialRoomSafetyReports)
        .set({
          status: input.status,
          reviewed_at: new Date(),
          reviewed_by: input.adminUserId,
        })
        .where(eq(socialRoomSafetyReports.id, input.reportId));
    },
    async () => undefined,
  );
}

export async function updateTogetherPlanModeration(input: {
  planKey: string;
  adminUserId: string;
  roomId?: string | null;
  status: string;
  notes?: string;
}) {
  const memoryPlan = proposals.find((proposal) => proposal.planKey === input.planKey);
  if (memoryPlan) {
    memoryPlan.status = input.status === "active" || input.status === "hidden" || input.status === "closed"
      ? input.status
      : memoryPlan.status;
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
  roomId?: string | null;
  status: string;
  notes?: string;
}) {
  const memoryReply = memoryReplies.find((reply) => reply.id === input.replyId);
  if (memoryReply) {
    memoryReply.status = input.status;
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
  roomId?: string | null;
  status: string;
  notes?: string;
}) {
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
