import { randomUUID } from "crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  companionProfiles,
  profiles,
  socialConnections,
  socialRoomMusicCircleItems,
  socialRoomMusicItemReactions,
  socialRoomMusicThreadEntries,
  socialRoomMusicThreads,
  socialRoomSafetyReports,
  socialRoomSessions,
  socialRoomVisits,
  socialRooms,
  socialUserInterests,
} from "../../shared/schema.js";
import type {
  SocialGameLanguage,
  SocialMusicCircle,
  SocialMusicCircleItem,
  SocialMusicCauseId,
  SocialMusicThread,
  SocialMusicThreadEntry,
  SocialRoomSafetyFlag,
} from "../../src/social/types";
import {
  buildDailyRoomSession,
  getSocialRoomBySlug,
  getTimeSlotFromDate,
  localizeRoom,
  resolveSocialRoomSlug,
  socialRoomSeeds,
} from "../lib/socialRoomsSeed.js";
import {
  buildGamePreferenceTag,
  buildGameTable,
  isSocialGameKind,
} from "../lib/socialGameRounds.js";
import {
  formatSharedTopic,
  pickBestSocialMatch,
  supportsSocialMatching,
} from "../lib/socialMatching.js";
import { buildReadingClubDestination } from "../lib/readingClubDestination.js";
import {
  buildUserConversationContext,
  type ConversationContextSummary,
} from "../lib/conversationContext.js";
import {
  acknowledgeTogetherAgreement,
  blockedReplyDetails,
  buildTogetherRoomPulse,
  createTogetherProposal,
  createTogetherSafetyReport,
  detectSafetyFlags,
  markTogetherNotificationRead,
  replyToTogetherPlan,
  respondToTogetherPlan,
  saveTogetherComfortCheck,
  shouldBlockReply,
  voteTogetherPoll,
} from "../lib/socialRoomPulse.js";
import {
  buildReadingClubPulse,
  createReadingClubPost,
  createReadingClubSafetyReport,
  respondToReadingClubPlan,
  voteReadingClubPoll,
} from "../lib/readingClubPulse.js";
import { normalizeAppLanguage } from "../../shared/language.js";

type SocialLanguage = "es" | "de" | "en";

type InterestSnapshot = {
  interestTags: string[];
  preferredTimes: string[];
  activityLevel: "low" | "moderate" | "active";
  roomVisitCounts: Record<string, number>;
  lastRooms: string[];
};

type RoomVisitState = {
  isFirstVisit: boolean;
  previousVisitCount: number;
  visitCount: number;
};

type MemoryMusicThread = SocialMusicThread & {
  roomSlug: string;
};

type MemoryMusicCircleItem = SocialMusicCircleItem & {
  roomSlug: string;
};

type MemoryMusicReaction = {
  itemId: string;
  userId: string;
  kind: "heart";
  createdAt: string;
};

const router = Router();
const IS_PROD = process.env.NODE_ENV === "production";
const DEMO_USER_ID = "demo-user";
const EMPTY_CONVERSATION_CONTEXT: ConversationContextSummary = {
  generatedAt: new Date(0).toISOString(),
  lines: [],
  text: "No recent report context available.",
  facts: {},
};
const SAFE_DB_TIMEOUT_MS = 1400;
const CONVERSATION_CONTEXT_TIMEOUT_MS = 1600;
const ROOM_VISIT_STATE_TIMEOUT_MS = 1200;
const visitSessionMemory = new Map<string, { userId: string; roomSlug: string; enteredAt: number }>();
const memoryInterests = new Map<string, InterestSnapshot>();
const memoryConnections = new Map<string, { matchedUserId: string; matchedViaRoom: string; matchedAt: string }>();
const memoryMusicThreads = new Map<string, MemoryMusicThread>();
const memoryMusicCircleItems = new Map<string, MemoryMusicCircleItem>();
const memoryMusicReactions = new Map<string, MemoryMusicReaction>();
const memoryRoomOccupancy = new Map<string, number>();
const memberCatalog = [
  { id: "member-ana", name: "Ana", topics: ["plantas", "cocina", "paseos"] },
  { id: "member-jose", name: "José", topics: ["ajedrez", "noticias", "lectura"] },
  { id: "member-elena", name: "Elena", topics: ["recetas", "flores", "rutinas"] },
  { id: "member-carmen", name: "Carmen", topics: ["arte", "historias", "memorias"] },
  { id: "member-luis", name: "Luis", topics: ["caminar", "jardín", "cultura"] },
  { id: "member-maria", name: "María", topics: ["libros", "meditación", "plantas"] },
];

const READING_SHELF_TAGS: Record<string, string[]> = {
  memoir: ["memoir", "book_memories"],
  "short-stories": ["short_stories", "stories"],
  poetry: ["poetry", "literature"],
  classics: ["classics", "literature"],
};
const READING_PACE_TAGS: Record<string, string[]> = {
  quiet: ["reading_companion"],
  chatty: ["book_recommendations", "reading_companion"],
  letters: ["book_memories", "reading_companion"],
};
const READING_INTENT_TAGS: Record<string, string[]> = {
  "share-memory": ["book_memories"],
  "recommend-book": ["book_recommendations"],
  "meet-reader": ["reading_companion"],
  "quiet-reading": ["reading"],
};

const messageSchema = z.object({
  message: z.string().trim().min(1).max(320),
  lang: z.string().optional(),
  visitId: z.string().optional(),
});

const roomActionSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  completed: z.boolean().optional(),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).optional(),
});

const gameRoundSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  roundId: z.string().trim().min(1).max(80).optional(),
  gameKind: z.enum(["chess", "word", "dominoes", "bridge"]),
  completed: z.boolean().optional(),
});

const planResponseSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  response: z.enum(["join", "maybe"]),
});

const planReplySchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  body: z.string().trim().min(1).max(180),
  tone: z.enum(["support", "curious", "help"]).optional().default("support"),
});

const pollVoteSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  optionId: z.string().trim().min(1).max(80),
});

const proposalSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  title: z.string().trim().min(1).max(96),
  details: z.string().trim().max(320).optional().default(""),
  locationLabel: z.enum(["nearby", "online"]).optional().default("online"),
  comfortNeeds: z.array(z.enum(["quiet_pace", "easy_access", "seating"])).max(3).optional().default([]),
  kind: z.enum(["plan", "message", "question"]).optional().default("plan"),
  experienceCategory: z.enum([
    "movie_date",
    "restaurant_date",
    "home_share",
    "service_booking",
    "deal_help",
    "outing",
    "other",
  ]).optional().default("other"),
  preferredTime: z.enum(["morning", "afternoon", "evening", "flexible"]).optional().default("flexible"),
  costRange: z.enum(["free", "low", "shared", "discuss"]).optional().default("discuss"),
  groupSize: z.enum(["one_to_one", "small_group", "open_room"]).optional().default("one_to_one"),
});

const safetyReportSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  reason: z.string().trim().min(1).max(80),
  details: z.string().trim().max(480).optional().default(""),
  targetType: z.enum(["room", "plan", "message", "question", "poll", "reply", "music_thread_entry", "music_circle_item"]).optional().default("room"),
  targetId: z.string().trim().min(1).max(140).optional(),
}).superRefine((value, ctx) => {
  if (value.targetType !== "room" && !value.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetId"],
      message: "targetId is required when reporting a shared item",
    });
  }
});

const musicThreadEntrySchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  kind: z.enum(["memory", "voice"]).optional().default("memory"),
  body: z.string().trim().max(480).optional().default(""),
}).superRefine((value, ctx) => {
  if (value.kind === "memory" && !value.body.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["body"],
      message: "Memory text is required",
    });
  }
});

const musicCircleItemSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  songText: z.string().trim().min(1).max(160),
  causeId: z.enum(["anthem", "memory", "bridge"]).optional().default("bridge"),
  memoryText: z.string().trim().max(280).optional().default(""),
});

const musicCircleReactionSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  kind: z.enum(["heart"]).optional().default("heart"),
});

const agreementAcknowledgementSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
});

const notificationReadSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
});

const comfortCheckSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  comfortNeeds: z.array(z.enum(["quiet_pace", "easy_access", "seating"])).max(3).optional().default([]),
});

function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

function resolvePublicUserId(req: Request): string {
  return req.user?.id ?? DEMO_USER_ID;
}

function normalizeLanguage(raw?: string | null): SocialLanguage {
  const language = normalizeAppLanguage(raw, "es");
  if (language === "es" || language === "de") return language;
  return "en";
}

function normalizeGameLanguage(raw?: string | null): SocialGameLanguage {
  return normalizeAppLanguage(raw, "es");
}

function appendReadingPreferenceTags(tags: string[], value: unknown, tagMap: Record<string, string[]>) {
  if (typeof value !== "string") return;
  tags.push(...(tagMap[value] ?? []));
}

function buildReadingPreferenceTags(body: {
  favoriteShelf?: unknown;
  favoriteShelfId?: unknown;
  preferredPace?: unknown;
  preferredPaceId?: unknown;
  readingIntent?: unknown;
  selectedIntentId?: unknown;
  readingPreferenceTags?: unknown;
}) {
  const tags: string[] = [];
  appendReadingPreferenceTags(tags, body.favoriteShelf ?? body.favoriteShelfId, READING_SHELF_TAGS);
  appendReadingPreferenceTags(tags, body.preferredPace ?? body.preferredPaceId, READING_PACE_TAGS);
  appendReadingPreferenceTags(tags, body.readingIntent ?? body.selectedIntentId, READING_INTENT_TAGS);

  if (Array.isArray(body.readingPreferenceTags)) {
    tags.push(...body.readingPreferenceTags.filter((tag): tag is string => typeof tag === "string" && tag.length <= 64));
  }

  return Array.from(new Set(tags)).slice(0, 12);
}

function getReadingProfileNote(
  language: SocialLanguage,
  body: { favoriteShelf?: unknown; favoriteShelfId?: unknown; preferredPace?: unknown; preferredPaceId?: unknown },
) {
  const shelf = typeof (body.favoriteShelf ?? body.favoriteShelfId) === "string"
    ? String(body.favoriteShelf ?? body.favoriteShelfId)
    : "";
  const pace = typeof (body.preferredPace ?? body.preferredPaceId) === "string"
    ? String(body.preferredPace ?? body.preferredPaceId)
    : "";
  if (!shelf && !pace) return "";

  const shelfLabels: Record<string, Record<SocialLanguage, string>> = {
    memoir: { es: "memorias", de: "Memoiren", en: "memoirs" },
    "short-stories": { es: "cuentos", de: "Kurzgeschichten", en: "short stories" },
    poetry: { es: "poesia", de: "Poesie", en: "poetry" },
    classics: { es: "clasicos", de: "Klassiker", en: "classics" },
  };
  const paceLabels: Record<string, Record<SocialLanguage, string>> = {
    quiet: { es: "ritmo tranquilo", de: "ruhiges Tempo", en: "quiet pace" },
    chatty: { es: "intercambio conversador", de: "lebendiger Austausch", en: "lively exchange" },
    letters: { es: "notas escritas", de: "geschriebene Notizen", en: "written notes" },
  };
  const shelfLabel = shelfLabels[shelf]?.[language];
  const paceLabel = paceLabels[pace]?.[language];
  if (!shelfLabel && !paceLabel) return "";

  if (language === "de") {
    return ` Ich habe deinen Clubtisch beruecksichtigt: ${[shelfLabel, paceLabel].filter(Boolean).join(", ")}.`;
  }
  if (language === "en") {
    return ` I used your club desk preferences: ${[shelfLabel, paceLabel].filter(Boolean).join(", ")}.`;
  }
  return ` He usado tus preferencias del club: ${[shelfLabel, paceLabel].filter(Boolean).join(", ")}.`;
}

function buildConnectionKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

async function hasExistingSocialConnection(userId: string, matchedUserId: string, roomSlug: string) {
  if (!matchedUserId) return false;
  if (memoryConnections.has(buildConnectionKey(userId, matchedUserId))) return true;

  const [user_id_a, user_id_b] = [userId, matchedUserId].sort();
  return safeDb(
    "load social connection",
    async () => {
      const rows = await db
        .select({ id: socialConnections.id })
        .from(socialConnections)
        .where(and(
          eq(socialConnections.user_id_a, user_id_a),
          eq(socialConnections.user_id_b, user_id_b),
          eq(socialConnections.matched_via_room, roomSlug),
        ))
        .limit(1);
      return rows.length > 0;
    },
    async () => false,
  );
}

async function loadProfileDisplayName(userId: string) {
  if (!userId) return "";
  return safeDb(
    "load matched profile name",
    async () => {
      const rows = await db
        .select({
          preferred_name: profiles.preferred_name,
          full_name: profiles.full_name,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      const profile = rows[0];
      return profile?.preferred_name || profile?.full_name?.split(/\s+/).filter(Boolean)[0] || "";
    },
    async () => "",
  );
}

function getDeterministicParticipantCount(slug: string) {
  const seed = slug.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (seed % 5) + 3;
}

function getRoomParticipantCount(slug: string) {
  return getDeterministicParticipantCount(slug) + (memoryRoomOccupancy.get(slug) ?? 0);
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
    console.warn(`[social] ${label} fallback`, error);
    return await fallback();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function buildSafeConversationContext(
  userId: string,
  options: Parameters<typeof buildUserConversationContext>[1] = {},
): Promise<ConversationContextSummary> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeout = new Promise<ConversationContextSummary>((resolve) => {
      timeoutId = setTimeout(() => resolve(EMPTY_CONVERSATION_CONTEXT), CONVERSATION_CONTEXT_TIMEOUT_MS);
    });
    return await Promise.race([buildUserConversationContext(userId, options), timeout]);
  } catch (error) {
    console.warn("[social] conversation context fallback", error);
    return EMPTY_CONVERSATION_CONTEXT;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function loadProfileSummary(userId: string) {
  return safeDb(
    "profile summary",
    async () => {
      const [row] = await db
        .select({
          language: profiles.language,
          language_preference: profiles.language_preference,
          preferred_name: profiles.preferred_name,
          full_name: profiles.full_name,
          discoverable: profiles.discoverable,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      const firstName =
        row?.preferred_name?.trim() ||
        row?.full_name?.trim().split(/\s+/).filter(Boolean)[0] ||
        "amiga";

      return {
        firstName,
        language: normalizeLanguage(row?.language_preference ?? row?.language ?? "es"),
        discoverable: row?.discoverable ?? false,
      };
    },
    () => ({
      firstName: "amiga",
      language: "es" as SocialLanguage,
      discoverable: false,
    }),
  );
}

async function loadUserInterestSnapshot(userId: string): Promise<InterestSnapshot> {
  const fallback = memoryInterests.get(userId);
  if (fallback) return fallback;

  return safeDb(
    "interest snapshot",
    async () => {
      const [socialRow] = await db
        .select()
        .from(socialUserInterests)
        .where(eq(socialUserInterests.user_id, userId))
        .limit(1);

      if (socialRow) {
        return {
          interestTags: socialRow.interest_tags,
          preferredTimes: socialRow.preferred_times,
          activityLevel: (socialRow.activity_level as InterestSnapshot["activityLevel"]) ?? "moderate",
          roomVisitCounts: (socialRow.room_visit_counts as Record<string, number>) ?? {},
          lastRooms: socialRow.last_rooms ?? [],
        };
      }

      const [companionRow] = await db
        .select({
          interests: companionProfiles.interests,
          preferredActivities: companionProfiles.preferred_activities,
        })
        .from(companionProfiles)
        .where(eq(companionProfiles.user_id, userId))
        .limit(1);

      return {
        interestTags: companionRow?.interests ?? [],
        preferredTimes: [],
        activityLevel:
          (companionRow?.preferredActivities?.includes("walk_together") ? "active" : "moderate") as InterestSnapshot["activityLevel"],
        roomVisitCounts: {},
        lastRooms: [],
      };
    },
    () => ({
      interestTags: [],
      preferredTimes: [],
      activityLevel: "moderate",
      roomVisitCounts: {},
      lastRooms: [],
    }),
  );
}

async function persistInterestSnapshot(userId: string, snapshot: InterestSnapshot) {
  memoryInterests.set(userId, snapshot);

  await safeDb(
    "persist interests",
    async () => {
      await db
        .insert(socialUserInterests)
        .values({
          user_id: userId,
          interest_tags: snapshot.interestTags,
          preferred_times: snapshot.preferredTimes,
          activity_level: snapshot.activityLevel,
          room_visit_counts: snapshot.roomVisitCounts,
          last_rooms: snapshot.lastRooms,
        })
        .onConflictDoUpdate({
          target: socialUserInterests.user_id,
          set: {
            interest_tags: snapshot.interestTags,
            preferred_times: snapshot.preferredTimes,
            activity_level: snapshot.activityLevel,
            room_visit_counts: snapshot.roomVisitCounts,
            last_rooms: snapshot.lastRooms,
            updated_at: new Date(),
          },
        });
    },
    async () => undefined,
  );
}

async function persistGamePreference(userId: string, gameKind: "chess" | "word" | "dominoes" | "bridge") {
  const existing = await loadUserInterestSnapshot(userId);
  const nextTags = Array.from(new Set([
    ...existing.interestTags,
    "games",
    buildGamePreferenceTag(gameKind),
  ]));

  await persistInterestSnapshot(userId, {
    ...existing,
    interestTags: nextTags,
  });
}

function buildRoomVisitState(snapshot: InterestSnapshot, roomSlug: string, incrementBy = 0): RoomVisitState {
  const canonicalSlug = resolveSocialRoomSlug(roomSlug);
  const rawCount = Number(snapshot.roomVisitCounts[canonicalSlug] ?? 0);
  const previousVisitCount = Number.isFinite(rawCount) ? Math.max(0, rawCount) : 0;

  return {
    isFirstVisit: previousVisitCount === 0,
    previousVisitCount,
    visitCount: previousVisitCount + incrementBy,
  };
}

async function loadRoomVisitState(userId: string, roomSlug: string): Promise<RoomVisitState> {
  const fallback: RoomVisitState = {
    isFirstVisit: true,
    previousVisitCount: 0,
    visitCount: 0,
  };
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeout = new Promise<RoomVisitState>((resolve) => {
      timeoutId = setTimeout(() => resolve(fallback), ROOM_VISIT_STATE_TIMEOUT_MS);
    });
    return await Promise.race([
      loadUserInterestSnapshot(userId).then((snapshot) => buildRoomVisitState(snapshot, roomSlug)),
      timeout,
    ]);
  } catch (error) {
    console.warn("[social] room visit state fallback", error);
    return fallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function ensureRoomRecords(slug: string) {
  const roomSeed = getSocialRoomBySlug(slug);
  if (!roomSeed) return null;

  return safeDb(
    "ensure room/session",
    async () => {
      const [roomRow] = await db
        .insert(socialRooms)
        .values({
          slug: roomSeed.slug,
          name_es: roomSeed.names.es,
          name_de: roomSeed.names.de,
          name_en: roomSeed.names.en,
          category: roomSeed.category,
          agent_slug: roomSeed.agentSlug,
          agent_full_name: roomSeed.agentFullName,
          agent_colour: roomSeed.agentColour,
          agent_cred_es: roomSeed.agentCredential.es,
          agent_cred_de: roomSeed.agentCredential.de,
          agent_cred_en: roomSeed.agentCredential.en,
          cta_label_es: roomSeed.ctaLabel.es,
          cta_label_de: roomSeed.ctaLabel.de,
          cta_label_en: roomSeed.ctaLabel.en,
          topic_tags: roomSeed.topicTags,
          time_slots: roomSeed.timeSlots,
          is_active: true,
        })
        .onConflictDoUpdate({
          target: socialRooms.slug,
          set: {
            name_es: roomSeed.names.es,
            name_de: roomSeed.names.de,
            name_en: roomSeed.names.en,
            category: roomSeed.category,
            agent_slug: roomSeed.agentSlug,
            agent_full_name: roomSeed.agentFullName,
            agent_colour: roomSeed.agentColour,
            agent_cred_es: roomSeed.agentCredential.es,
            agent_cred_de: roomSeed.agentCredential.de,
            agent_cred_en: roomSeed.agentCredential.en,
            cta_label_es: roomSeed.ctaLabel.es,
            cta_label_de: roomSeed.ctaLabel.de,
            cta_label_en: roomSeed.ctaLabel.en,
            topic_tags: roomSeed.topicTags,
            time_slots: roomSeed.timeSlots,
            is_active: true,
          },
        })
        .returning();

      const today = new Date();
      const sessionDate = today.toISOString().slice(0, 10);
      const daily = {
        es: buildDailyRoomSession(roomSeed, "es", today),
        de: buildDailyRoomSession(roomSeed, "de", today),
        en: buildDailyRoomSession(roomSeed, "en", today),
      };

      const [sessionRow] = await db
        .insert(socialRoomSessions)
        .values({
          room_id: roomRow.id,
          session_date: sessionDate,
          topic_es: daily.es.topic,
          topic_de: daily.de.topic,
          topic_en: daily.en.topic,
          opener_es: daily.es.opener,
          opener_de: daily.de.opener,
          opener_en: daily.en.opener,
          activity_type: daily.es.activityType,
          participant_count: getRoomParticipantCount(slug),
          is_live: true,
        })
        .onConflictDoUpdate({
          target: [socialRoomSessions.room_id, socialRoomSessions.session_date],
          set: {
            topic_es: daily.es.topic,
            topic_de: daily.de.topic,
            topic_en: daily.en.topic,
            opener_es: daily.es.opener,
            opener_de: daily.de.opener,
            opener_en: daily.en.opener,
            activity_type: daily.es.activityType,
            participant_count: getRoomParticipantCount(slug),
            is_live: true,
          },
        })
        .returning();

      return { roomId: roomRow.id, sessionId: sessionRow.id };
    },
    () => null,
  );
}

function buildRoomPayload(slug: string, language: SocialLanguage) {
  const seed = getSocialRoomBySlug(slug);
  if (!seed) return null;

  const room = localizeRoom(seed, language);
  const session = buildDailyRoomSession(seed, language);
  const participantCount = getRoomParticipantCount(slug);

  return {
    ...room,
    participantCount,
    sessionDate: session.sessionDate,
    topic: session.topic,
    opener: session.opener,
    quote: session.quote,
    activityType: session.activityType,
    contentTag: session.contentTag,
    contentTitle: session.contentTitle,
    contentBody: session.contentBody,
    options: session.options,
  };
}

function scoreRoom(
  slug: string,
  userInterests: InterestSnapshot,
  participantCount: number,
  timeSlot: string,
) {
  const seed = getSocialRoomBySlug(slug);
  if (!seed) return 0;

  let score = 0;
  if (seed.timeSlots.includes(timeSlot)) score += 30;

  const overlap = seed.topicTags.filter((tag) => userInterests.interestTags.includes(tag));
  score += overlap.length * 20;
  score += Math.min(participantCount * 5, 25);

  if (!userInterests.lastRooms.includes(slug)) score += 15;
  if (seed.featured) score += 10;

  return score;
}

function toLiveBadge(language: SocialLanguage, participantCount: number) {
  if (participantCount <= 0) {
    return language === "de"
      ? "Sala preparada"
      : language === "en"
        ? "Room ready"
        : "Sala preparada";
  }

  if (language === "de") return `${participantCount} im Raum`;
  if (language === "en") return `${participantCount} in the room`;
  return `${participantCount} en la sala`;
}

type DisplayRoomMember = {
  id: string;
  name: string;
  sharedTopic: string;
  statusLabel: string;
};

function buildMusicRoomMembers(language: SocialLanguage): DisplayRoomMember[] {
  const musicMembers: Record<SocialLanguage, DisplayRoomMember[]> = {
    es: [
      { id: "member-rosa", name: "Rosa", sharedTopic: "Boleros", statusLabel: "Cancion compartida" },
      { id: "member-malik", name: "Malik", sharedTopic: "Ritmos de mercado", statusLabel: "Ritmo compartido" },
      { id: "member-ingrid", name: "Ingrid", sharedTopic: "Coro", statusLabel: "Quiere saludar" },
      { id: "member-arthur", name: "Arthur", sharedTopic: "Soul", statusLabel: "Cambiando canciones" },
    ],
    de: [
      { id: "member-rosa", name: "Rosa", sharedTopic: "Boleros", statusLabel: "Lied geteilt" },
      { id: "member-malik", name: "Malik", sharedTopic: "Marktrhythmen", statusLabel: "Rhythmus geteilt" },
      { id: "member-ingrid", name: "Ingrid", sharedTopic: "Chor", statusLabel: "Moechte gruessen" },
      { id: "member-arthur", name: "Arthur", sharedTopic: "Soul", statusLabel: "Tauscht Lieder" },
    ],
    en: [
      { id: "member-rosa", name: "Rosa", sharedTopic: "Boleros", statusLabel: "Shared a song" },
      { id: "member-malik", name: "Malik", sharedTopic: "Market rhythms", statusLabel: "Brought a rhythm" },
      { id: "member-ingrid", name: "Ingrid", sharedTopic: "Choir", statusLabel: "Open to hello" },
      { id: "member-arthur", name: "Arthur", sharedTopic: "Soul", statusLabel: "Swapping songs" },
    ],
  };

  return musicMembers[language];
}

function musicYouLabel(language: SocialLanguage) {
  if (language === "de") return "Du";
  if (language === "en") return "You";
  return "Tu";
}

function musicVoiceLabel(language: SocialLanguage) {
  if (language === "de") return "Sprachnotiz";
  if (language === "en") return "Voice note";
  return "Nota de voz";
}

function musicCirclePrompt(language: SocialLanguage) {
  if (language === "de") return "Lied des Tages";
  if (language === "en") return "Today's Song";
  return "Cancion de hoy";
}

function musicDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeMusicCauseId(value: string): SocialMusicCauseId {
  if (value === "anthem" || value === "memory" || value === "bridge") return value;
  return "bridge";
}

function musicReactionKey(itemId: string, userId: string, kind: "heart") {
  return `${itemId}:${userId}:${kind}`;
}

function summarizeMusicReactions(
  rows: Array<typeof socialRoomMusicItemReactions.$inferSelect>,
  userId: string,
) {
  const summary = new Map<string, { reactionCount: number; myReaction: boolean }>();
  for (const row of rows) {
    if (row.kind !== "heart") continue;
    const current = summary.get(row.item_id) ?? { reactionCount: 0, myReaction: false };
    current.reactionCount += 1;
    if (row.user_id === userId) current.myReaction = true;
    summary.set(row.item_id, current);
  }
  return summary;
}

function countMemoryMusicReactions(itemId: string, userId: string) {
  let reactionCount = 0;
  let myReaction = false;
  for (const reaction of memoryMusicReactions.values()) {
    if (reaction.itemId !== itemId || reaction.kind !== "heart") continue;
    reactionCount += 1;
    if (reaction.userId === userId) myReaction = true;
  }
  return { reactionCount, myReaction };
}

function formatMusicCircleItem(
  row: typeof socialRoomMusicCircleItems.$inferSelect,
  reactions: { reactionCount: number; myReaction: boolean },
): SocialMusicCircleItem {
  return {
    id: row.id,
    roomId: row.room_id,
    dayKey: row.day_key,
    authorId: row.author_id,
    authorName: row.author_name,
    songText: row.song_text,
    causeId: normalizeMusicCauseId(row.cause_id),
    memoryText: row.memory_text,
    status: row.status,
    reactionCount: reactions.reactionCount,
    myReaction: reactions.myReaction,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

function formatMemoryMusicCircleItem(item: MemoryMusicCircleItem, userId: string): SocialMusicCircleItem {
  const { roomSlug: _roomSlug, reactionCount: _reactionCount, myReaction: _myReaction, ...publicItem } = item;
  return {
    ...publicItem,
    ...countMemoryMusicReactions(item.id, userId),
  };
}

function buildMemoryMusicCircle(
  userId: string,
  roomSlug: string,
  language: SocialLanguage,
  dayKey = musicDayKey(),
): SocialMusicCircle {
  const items = Array.from(memoryMusicCircleItems.values())
    .filter((item) => item.roomSlug === roomSlug && item.dayKey === dayKey && item.status === "active")
    .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
    .slice(0, 8)
    .map((item) => formatMemoryMusicCircleItem(item, userId));

  return {
    dayKey,
    prompt: musicCirclePrompt(language),
    featuredItemId: items[0]?.id ?? null,
    items,
  };
}

async function loadMusicCircle(
  userId: string,
  roomSlug: string,
  roomId: string | null,
  language: SocialLanguage,
): Promise<SocialMusicCircle> {
  const dayKey = musicDayKey();
  const prompt = musicCirclePrompt(language);

  return safeDb(
    "load music circle",
    async () => {
      if (!roomId) throw new Error("Missing room id");
      const itemRows = await db
        .select()
        .from(socialRoomMusicCircleItems)
        .where(and(
          eq(socialRoomMusicCircleItems.room_id, roomId),
          eq(socialRoomMusicCircleItems.day_key, dayKey),
          eq(socialRoomMusicCircleItems.status, "active"),
        ))
        .orderBy(desc(socialRoomMusicCircleItems.updated_at))
        .limit(8);
      if (!itemRows.length) return { dayKey, prompt, featuredItemId: null, items: [] };

      const reactionRows = await db
        .select()
        .from(socialRoomMusicItemReactions)
        .where(inArray(socialRoomMusicItemReactions.item_id, itemRows.map((item) => item.id)));
      const reactions = summarizeMusicReactions(reactionRows, userId);
      const items = itemRows.map((item) => formatMusicCircleItem(item, reactions.get(item.id) ?? { reactionCount: 0, myReaction: false }));

      return {
        dayKey,
        prompt,
        featuredItemId: items[0]?.id ?? null,
        items,
      };
    },
    async () => buildMemoryMusicCircle(userId, roomSlug, language, dayKey),
  );
}

async function loadMusicCircleItemForConnect(input: {
  userId: string;
  roomSlug: string;
  roomId: string | null;
  itemId: string;
}): Promise<SocialMusicCircleItem | null> {
  if (!input.itemId) return null;
  return safeDb(
    "load music circle item",
    async () => {
      if (!input.roomId) throw new Error("Missing room id");
      const [itemRow] = await db
        .select()
        .from(socialRoomMusicCircleItems)
        .where(and(
          eq(socialRoomMusicCircleItems.id, input.itemId),
          eq(socialRoomMusicCircleItems.room_id, input.roomId),
          eq(socialRoomMusicCircleItems.status, "active"),
        ))
        .limit(1);
      if (!itemRow) return null;

      const reactionRows = await db
        .select()
        .from(socialRoomMusicItemReactions)
        .where(eq(socialRoomMusicItemReactions.item_id, itemRow.id));
      const reactions = summarizeMusicReactions(reactionRows, input.userId);
      return formatMusicCircleItem(itemRow, reactions.get(itemRow.id) ?? { reactionCount: 0, myReaction: false });
    },
    async () => {
      const item = memoryMusicCircleItems.get(input.itemId);
      if (!item || item.roomSlug !== input.roomSlug || item.status !== "active") return null;
      return formatMemoryMusicCircleItem(item, input.userId);
    },
  );
}

async function createMusicCircleItem(input: {
  userId: string;
  roomSlug: string;
  roomId: string | null;
  language: SocialLanguage;
  songText: string;
  causeId: SocialMusicCauseId;
  memoryText: string;
}): Promise<{ item?: SocialMusicCircleItem; musicCircle?: SocialMusicCircle; error?: string; safetyFlags?: SocialRoomSafetyFlag[] }> {
  const songText = input.songText.trim();
  const memoryText = input.memoryText.trim();
  const safetyFlags = detectSafetyFlags({ category: "other", title: songText, details: memoryText });
  if (shouldBlockReply(safetyFlags)) {
    await createMusicSafetyReport({
      userId: input.userId,
      roomId: input.roomId,
      language: input.language,
      targetId: randomUUID(),
      safetyFlags,
      targetType: "music_circle_item",
      reason: "music_circle_item_review",
    });
    return {
      error: "Reply needs VYVA review before it can be shared",
      safetyFlags,
    };
  }

  return safeDb(
    "create music circle item",
    async () => {
      if (!input.roomId) throw new Error("Missing room id");
      const now = new Date();
      const [itemRow] = await db
        .insert(socialRoomMusicCircleItems)
        .values({
          room_id: input.roomId,
          day_key: musicDayKey(now),
          author_id: input.userId,
          author_name: musicYouLabel(input.language),
          song_text: songText,
          cause_id: input.causeId,
          memory_text: memoryText,
          status: "active",
          updated_at: now,
        })
        .returning();
      if (!itemRow) return { error: "Music circle item was not created" };

      const item = formatMusicCircleItem(itemRow, { reactionCount: 0, myReaction: false });
      const musicCircle = await loadMusicCircle(input.userId, input.roomSlug, input.roomId, input.language);
      return { item, musicCircle };
    },
    async () => {
      const now = new Date().toISOString();
      const item: MemoryMusicCircleItem = {
        id: randomUUID(),
        roomId: input.roomId,
        roomSlug: input.roomSlug,
        dayKey: musicDayKey(),
        authorId: input.userId,
        authorName: musicYouLabel(input.language),
        songText,
        causeId: input.causeId,
        memoryText,
        status: "active",
        reactionCount: 0,
        myReaction: false,
        createdAt: now,
        updatedAt: now,
      };
      memoryMusicCircleItems.set(item.id, item);
      return {
        item: formatMemoryMusicCircleItem(item, input.userId),
        musicCircle: buildMemoryMusicCircle(input.userId, input.roomSlug, input.language, item.dayKey),
      };
    },
  );
}

async function toggleMusicCircleReaction(input: {
  userId: string;
  roomSlug: string;
  roomId: string | null;
  itemId: string;
  language: SocialLanguage;
  kind: "heart";
}): Promise<{ item?: SocialMusicCircleItem; musicCircle?: SocialMusicCircle; error?: string }> {
  return safeDb(
    "toggle music circle reaction",
    async () => {
      if (!input.roomId) throw new Error("Missing room id");
      const [itemRow] = await db
        .select()
        .from(socialRoomMusicCircleItems)
        .where(and(
          eq(socialRoomMusicCircleItems.id, input.itemId),
          eq(socialRoomMusicCircleItems.room_id, input.roomId),
          eq(socialRoomMusicCircleItems.status, "active"),
        ))
        .limit(1);
      if (!itemRow) return { error: "Music circle item not found" };

      const [existing] = await db
        .select()
        .from(socialRoomMusicItemReactions)
        .where(and(
          eq(socialRoomMusicItemReactions.item_id, itemRow.id),
          eq(socialRoomMusicItemReactions.user_id, input.userId),
          eq(socialRoomMusicItemReactions.kind, input.kind),
        ))
        .limit(1);

      if (existing) {
        await db
          .delete(socialRoomMusicItemReactions)
          .where(eq(socialRoomMusicItemReactions.id, existing.id));
      } else {
        await db
          .insert(socialRoomMusicItemReactions)
          .values({
            item_id: itemRow.id,
            user_id: input.userId,
            kind: input.kind,
          });
      }

      const musicCircle = await loadMusicCircle(input.userId, input.roomSlug, input.roomId, input.language);
      return {
        item: musicCircle.items.find((item) => item.id === input.itemId),
        musicCircle,
      };
    },
    async () => {
      const item = memoryMusicCircleItems.get(input.itemId);
      if (!item || item.roomSlug !== input.roomSlug || item.status !== "active") {
        return { error: "Music circle item not found" };
      }

      const key = musicReactionKey(input.itemId, input.userId, input.kind);
      if (memoryMusicReactions.has(key)) {
        memoryMusicReactions.delete(key);
      } else {
        memoryMusicReactions.set(key, {
          itemId: input.itemId,
          userId: input.userId,
          kind: input.kind,
          createdAt: new Date().toISOString(),
        });
      }

      const musicCircle = buildMemoryMusicCircle(input.userId, input.roomSlug, input.language, item.dayKey);
      return {
        item: musicCircle.items.find((circleItem) => circleItem.id === input.itemId),
        musicCircle,
      };
    },
  );
}

function buildMusicThreadReply(input: {
  language: SocialLanguage;
  matchedMemberName: string;
  matchedTopic: string;
  songText: string;
  bridgePrompt?: string;
}) {
  const topic = input.matchedTopic.trim();
  if (input.language === "de") return topic ? `${topic}: alte Freunde.` : `${input.matchedMemberName} erinnert sich.`;
  if (input.language === "en") return topic ? `${topic}: old friends.` : `${input.matchedMemberName} remembers that one.`;
  return topic ? `${topic}: viejas amistades.` : `${input.matchedMemberName} recuerda esa cancion.`;
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function formatMusicThreadEntry(row: typeof socialRoomMusicThreadEntries.$inferSelect): SocialMusicThreadEntry {
  return {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    authorName: row.author_name,
    kind: row.kind === "voice" ? "voice" : "memory",
    body: row.body,
    status: row.status,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

function formatMusicThread(
  row: typeof socialRoomMusicThreads.$inferSelect,
  entries: Array<typeof socialRoomMusicThreadEntries.$inferSelect>,
): SocialMusicThread {
  return {
    id: row.id,
    roomId: row.room_id,
    creatorId: row.creator_id,
    matchedMemberId: row.matched_member_id,
    matchedMemberName: row.matched_member_name,
    songText: row.song_text,
    matchedTopic: row.matched_topic,
    status: row.status,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
    entries: entries.filter((entry) => entry.status === "active").map(formatMusicThreadEntry),
  };
}

function formatMemoryMusicThread(thread: MemoryMusicThread): SocialMusicThread {
  const { roomSlug: _roomSlug, ...publicThread } = thread;
  return {
    ...publicThread,
    entries: publicThread.entries.filter((entry) => entry.status === "active"),
  };
}

function createMemoryMusicThread(input: {
  userId: string;
  roomSlug: string;
  roomId: string | null;
  language: SocialLanguage;
  matchedMemberId: string;
  matchedMemberName: string;
  songText: string;
  matchedTopic: string;
  bridgePrompt?: string;
}) {
  const existing = Array.from(memoryMusicThreads.values()).find((thread) => (
    thread.roomSlug === input.roomSlug &&
    thread.creatorId === input.userId &&
    thread.matchedMemberId === input.matchedMemberId &&
    thread.status === "active"
  ));
  if (existing) return formatMemoryMusicThread(existing);

  const now = new Date().toISOString();
  const threadId = randomUUID();
  const entry: SocialMusicThreadEntry = {
    id: randomUUID(),
    threadId,
    authorId: input.matchedMemberId,
    authorName: input.matchedMemberName,
    kind: "memory",
    body: buildMusicThreadReply(input),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const thread: MemoryMusicThread = {
    id: threadId,
    roomId: input.roomId,
    roomSlug: input.roomSlug,
    creatorId: input.userId,
    matchedMemberId: input.matchedMemberId,
    matchedMemberName: input.matchedMemberName,
    songText: input.songText,
    matchedTopic: input.matchedTopic,
    status: "active",
    createdAt: now,
    updatedAt: now,
    entries: [entry],
  };

  memoryMusicThreads.set(thread.id, thread);
  return formatMemoryMusicThread(thread);
}

async function loadMusicThreads(roomSlug: string, roomId: string | null): Promise<SocialMusicThread[]> {
  return safeDb(
    "load music threads",
    async () => {
      if (!roomId) throw new Error("Missing room id");
      const threadRows = await db
        .select()
        .from(socialRoomMusicThreads)
        .where(and(eq(socialRoomMusicThreads.room_id, roomId), eq(socialRoomMusicThreads.status, "active")))
        .orderBy(desc(socialRoomMusicThreads.updated_at))
        .limit(12);
      if (!threadRows.length) return [];

      const entryRows = await db
        .select()
        .from(socialRoomMusicThreadEntries)
        .where(and(
          inArray(socialRoomMusicThreadEntries.thread_id, threadRows.map((thread) => thread.id)),
          eq(socialRoomMusicThreadEntries.status, "active"),
        ))
        .orderBy(socialRoomMusicThreadEntries.created_at);
      const entriesByThread = new Map<string, Array<typeof socialRoomMusicThreadEntries.$inferSelect>>();
      for (const entry of entryRows) {
        entriesByThread.set(entry.thread_id, [...(entriesByThread.get(entry.thread_id) ?? []), entry]);
      }

      return threadRows.map((thread) => formatMusicThread(thread, entriesByThread.get(thread.id) ?? []));
    },
    async () => Array.from(memoryMusicThreads.values())
      .filter((thread) => thread.roomSlug === roomSlug && thread.status === "active")
      .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
      .slice(0, 12)
      .map(formatMemoryMusicThread),
  );
}

async function createOrReuseMusicThread(input: {
  userId: string;
  roomSlug: string;
  roomId: string | null;
  language: SocialLanguage;
  matchedMemberId: string;
  matchedMemberName: string;
  songText: string;
  matchedTopic: string;
  bridgePrompt?: string;
}): Promise<SocialMusicThread> {
  return safeDb(
    "create music thread",
    async () => {
      if (!input.roomId) throw new Error("Missing room id");
      const [existing] = await db
        .select()
        .from(socialRoomMusicThreads)
        .where(and(
          eq(socialRoomMusicThreads.room_id, input.roomId),
          eq(socialRoomMusicThreads.creator_id, input.userId),
          eq(socialRoomMusicThreads.matched_member_id, input.matchedMemberId),
          eq(socialRoomMusicThreads.status, "active"),
        ))
        .limit(1);
      if (existing) {
        const entries = await db
          .select()
          .from(socialRoomMusicThreadEntries)
          .where(and(
            eq(socialRoomMusicThreadEntries.thread_id, existing.id),
            eq(socialRoomMusicThreadEntries.status, "active"),
          ))
          .orderBy(socialRoomMusicThreadEntries.created_at);
        return formatMusicThread(existing, entries);
      }

      const now = new Date();
      const [thread] = await db
        .insert(socialRoomMusicThreads)
        .values({
          room_id: input.roomId,
          creator_id: input.userId,
          matched_member_id: input.matchedMemberId,
          matched_member_name: input.matchedMemberName,
          song_text: input.songText,
          matched_topic: input.matchedTopic,
          status: "active",
          updated_at: now,
        })
        .returning();
      if (!thread) throw new Error("Music thread was not created");

      const [entry] = await db
        .insert(socialRoomMusicThreadEntries)
        .values({
          thread_id: thread.id,
          author_id: input.matchedMemberId,
          author_name: input.matchedMemberName,
          kind: "memory",
          body: buildMusicThreadReply(input),
          status: "active",
          updated_at: now,
        })
        .returning();
      return formatMusicThread(thread, entry ? [entry] : []);
    },
    async () => createMemoryMusicThread(input),
  );
}

async function createMusicSafetyReport(input: {
  userId: string;
  roomId: string | null;
  language: SocialLanguage;
  targetId: string;
  safetyFlags: SocialRoomSafetyFlag[];
  targetType?: "room" | "music_thread_entry" | "music_circle_item";
  reason?: string;
  details?: string;
}) {
  await safeDb(
    "persist music safety report",
    async () => {
      if (!input.roomId) return;
      await db
        .insert(socialRoomSafetyReports)
        .values({
          room_id: input.roomId,
          reporter_id: input.userId,
          target_type: input.targetType ?? "music_thread_entry",
          target_id: input.targetType === "room" ? null : input.targetId,
          reason: input.reason ?? "music_memory_review",
          details: input.details ?? blockedReplyDetails(input.safetyFlags, input.language),
          status: "open",
        });
    },
    async () => undefined,
  );
}

async function addMusicThreadEntry(input: {
  userId: string;
  roomSlug: string;
  roomId: string | null;
  threadId: string;
  language: SocialLanguage;
  kind: "memory" | "voice";
  body: string;
}): Promise<{ entry?: SocialMusicThreadEntry; thread?: SocialMusicThread; error?: string; safetyFlags?: SocialRoomSafetyFlag[] }> {
  const body = input.kind === "voice" ? musicVoiceLabel(input.language) : input.body.trim();

  if (input.kind === "memory") {
    const safetyFlags = detectSafetyFlags({ category: "other", title: "", details: body });
    if (shouldBlockReply(safetyFlags)) {
      await createMusicSafetyReport({
        userId: input.userId,
        roomId: input.roomId,
        language: input.language,
        targetId: input.threadId,
        safetyFlags,
      });
      return {
        error: "Reply needs VYVA review before it can be shared",
        safetyFlags,
      };
    }
  }

  return safeDb(
    "add music thread entry",
    async () => {
      if (!input.roomId) throw new Error("Missing room id");
      const [threadRow] = await db
        .select()
        .from(socialRoomMusicThreads)
        .where(and(
          eq(socialRoomMusicThreads.id, input.threadId),
          eq(socialRoomMusicThreads.room_id, input.roomId),
          eq(socialRoomMusicThreads.status, "active"),
        ))
        .limit(1);
      if (!threadRow) return { error: "Music thread not found" };

      const now = new Date();
      const [entryRow] = await db
        .insert(socialRoomMusicThreadEntries)
        .values({
          thread_id: threadRow.id,
          author_id: input.userId,
          author_name: musicYouLabel(input.language),
          kind: input.kind,
          body,
          status: "active",
          updated_at: now,
        })
        .returning();
      if (!entryRow) return { error: "Music thread entry was not created" };

      const [updatedThreadRow] = await db
        .update(socialRoomMusicThreads)
        .set({ updated_at: now })
        .where(eq(socialRoomMusicThreads.id, threadRow.id))
        .returning();
      const entries = await db
        .select()
        .from(socialRoomMusicThreadEntries)
        .where(and(
          eq(socialRoomMusicThreadEntries.thread_id, threadRow.id),
          eq(socialRoomMusicThreadEntries.status, "active"),
        ))
        .orderBy(socialRoomMusicThreadEntries.created_at);

      return {
        entry: formatMusicThreadEntry(entryRow),
        thread: formatMusicThread(updatedThreadRow ?? threadRow, entries),
      };
    },
    async () => {
      const thread = memoryMusicThreads.get(input.threadId);
      if (!thread || thread.roomSlug !== input.roomSlug || thread.status !== "active") {
        return { error: "Music thread not found" };
      }

      const now = new Date().toISOString();
      const entry: SocialMusicThreadEntry = {
        id: randomUUID(),
        threadId: thread.id,
        authorId: input.userId,
        authorName: musicYouLabel(input.language),
        kind: input.kind,
        body,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      thread.entries.push(entry);
      thread.updatedAt = now;
      memoryMusicThreads.set(thread.id, thread);

      return {
        entry,
        thread: formatMemoryMusicThread(thread),
      };
    },
  );
}

function buildAgentReply(
  slug: string,
  language: SocialLanguage,
  userMessage: string,
) {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  const lowered = userMessage.toLowerCase();
  const quotedPrompt = language === "de"
    ? "Magst du mir noch ein kleines Detail dazu erzählen?"
    : language === "en"
      ? "Would you tell me one small detail about that?"
      : "¿Me cuentas un pequeño detalle más?";

  if (canonicalSlug === "garden-corner") {
    return language === "de"
      ? `Das klingt liebevoll gepflegt. ${quotedPrompt}`
      : language === "en"
        ? `That sounds lovingly cared for. ${quotedPrompt}`
        : `Suena muy bien cuidado. ${quotedPrompt}`;
  }

  if (canonicalSlug === "games-room") {
    return language === "de"
      ? `Sehr guter Blick. Im Schach zählt Ruhe oft mehr als Eile. Was war dein erster Gedanke?`
      : language === "en"
        ? `That is a thoughtful idea. In chess, calm often beats speed. What was your first instinct?`
        : `Es una idea muy pensada. En ajedrez, la calma suele valer más que la prisa. ¿Cuál fue tu primera intuición?`;
  }

  if (canonicalSlug === "kitchen-table") {
    return language === "de"
      ? `Das klingt köstlich. Ein guter Duft macht jede Küche freundlicher. Welches Gewürz erinnert dich an Zuhause?`
      : language === "en"
        ? `That sounds delicious. A good aroma makes every kitchen feel warmer. Which spice reminds you of home?`
        : `Suena delicioso. Un buen aroma vuelve más cálida cualquier cocina. ¿Qué especia te recuerda a casa?`;
  }

  if (canonicalSlug === "walking-companion") {
    return language === "de"
      ? `Jede Bewegung zählt. Schon ein kurzer Spaziergang kann den Tag öffnen. Wann fühlst du dich am liebsten in Bewegung?`
      : language === "en"
        ? `Every bit of movement counts. Even a short walk can open the day. When do you enjoy moving most?`
        : `Todo movimiento cuenta. Incluso un paseo breve puede abrir el día. ¿Cuándo disfrutas más moverte?`;
  }

  if (canonicalSlug === "together-room") {
    return language === "de"
      ? "Das ist ein guter Plan. Ich kann nach Ziel, Tempo und Naehe sortieren. Welche Art von Person waere dir angenehm?"
      : language === "en"
        ? "That is a good plan. I can sort by goal, pace and distance. What kind of person would feel comfortable?"
        : "Es un buen plan. Puedo ordenar por objetivo, ritmo y cercania. Que tipo de persona te resultaria comoda?";
  }

  if (canonicalSlug === "music-room") {
    return language === "de"
      ? "Im Kreis. Wen soll es erreichen?"
      : language === "en"
        ? "In the circle. Who should hear it?"
        : "En el circulo. Quien deberia escucharlo?";
  }

  if (canonicalSlug === "reading-room") {
    return language === "de"
      ? "Das ist ein guter Club-Beitrag. Ich kann daraus eine Frage fuer die Runde machen oder eine passende Leseverbindung suchen."
      : language === "en"
        ? "That is a good club contribution. I can turn it into a room question or look for a reading companion."
        : "Es una buena aportacion para el club. Puedo convertirla en pregunta para la sala o buscar una compania de lectura.";
  }

  if (canonicalSlug === "memory-lane") {
    return language === "de"
      ? `Das ist ein schöner Gesprächsbeginn. Freundliche Neugier verbindet Menschen. Möchtest du eine passende Verbindung suchen?`
      : language === "en"
        ? `That is a lovely conversation opener. Kind curiosity brings people together. Shall I look for a suitable match?`
        : `Es un comienzo de conversación muy bonito. La curiosidad amable une a las personas. ¿Quieres que busque una conexión adecuada?`;
  }

  if (lowered.includes("?")) {
    return language === "de"
      ? `Gute Frage. Lass uns sie mit Ruhe anschauen. Was spricht dein Gefühl dazu?`
      : language === "en"
        ? `That is a good question. Let’s look at it gently. What does your instinct say?`
        : `Es una buena pregunta. Vamos a mirarla con calma. ¿Qué te dice la intuición?`;
  }

  return language === "de"
    ? `Danke, dass du das teilst. ${quotedPrompt}`
    : language === "en"
      ? `Thank you for sharing that. ${quotedPrompt}`
      : `Gracias por compartirlo. ${quotedPrompt}`;
}

function applyConversationContextCue(
  reply: string,
  language: SocialLanguage,
  conversationContext?: ConversationContextSummary | null,
) {
  const hasSensitiveDailyContext = conversationContext?.lines.some((line) =>
    /health report|vitals|check-in|medication/i.test(line),
  );
  if (!hasSensitiveDailyContext) return reply;

  const cue =
    language === "de"
      ? "Wir halten es heute ruhig und angenehm."
      : language === "en"
        ? "We can keep it gentle today."
        : "Podemos mantenerlo tranquilo hoy.";
  return `${reply} ${cue}`;
}

function buildPromptChips(slug: string, language: SocialLanguage) {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  const chips: Record<string, Record<SocialLanguage, string[]>> = {
    "garden-chat": {
      es: ["¿Qué planta me recomiendas?", "Tengo hojas amarillas", "¿Cada cuánto riego?"],
      de: ["Welche Pflanze empfiehlst du?", "Meine Blätter sind gelb", "Wie oft gieße ich?"],
      en: ["Which plant do you recommend?", "My leaves are turning yellow", "How often should I water it?"],
    },
    "chess-corner": {
      es: ["No veo la mejor jugada", "¿Qué pieza muevo primero?", "Explícamelo paso a paso"],
      de: ["Ich sehe den besten Zug nicht", "Welche Figur zuerst?", "Erklär es Schritt für Schritt"],
      en: ["I can't see the best move", "Which piece should I move first?", "Explain it step by step"],
    },
    "creative-studio": {
      es: ["Dame una idea sencilla", "¿Qué colores combinan bien?", "Quiero empezar despacio"],
      de: ["Gib mir eine einfache Idee", "Welche Farben passen gut?", "Ich möchte sanft beginnen"],
      en: ["Give me a simple idea", "Which colours work well together?", "I want to start gently"],
    },
    "music-salon": {
      es: ["Compartir una cancion de mi vida", "Conocer a alguien con musica", "Encontrar un himno alegre"],
      de: ["Ein Lied aus meinem Leben teilen", "Jemanden ueber Musik kennenlernen", "Ein froehliches Lied finden"],
      en: ["Share a song from my life", "Meet someone through music", "Find a joyful anthem"],
    },
    "music-room": {
      es: ["Compartir una cancion de mi vida", "Conocer a alguien con musica", "Encontrar un himno alegre"],
      de: ["Ein Lied aus meinem Leben teilen", "Jemanden ueber Musik kennenlernen", "Ein froehliches Lied finden"],
      en: ["Share a song from my life", "Meet someone through music", "Find a joyful anthem"],
    },
    "reading-room": {
      es: ["Compartir un libro querido", "Buscar companero de lectura", "Preguntar que estan leyendo"],
      de: ["Ein liebes Buch teilen", "Lesegefaehrtin finden", "Fragen, was andere lesen"],
      en: ["Share a loved book", "Find a reading companion", "Ask what others are reading"],
    },
    "together-room": {
      es: ["Quiero un plan cerca", "Buscame una cita de pelicula", "Ayudame con un trato"],
      de: ["Ich moechte einen Plan in der Naehe", "Finde ein Film-Date", "Hilf mir mit einem Deal"],
      en: ["I want a nearby plan", "Find a movie date", "Help me with a deal"],
    },
  };

  const fallback: Record<SocialLanguage, string[]> = {
    es: ["Explícamelo fácil", "Dame un ejemplo", "Quiero preguntar algo"],
    de: ["Erklär es einfach", "Gib mir ein Beispiel", "Ich möchte etwas fragen"],
    en: ["Explain it simply", "Give me an example", "I want to ask something"],
  };

  return chips[canonicalSlug]?.[language] ?? chips[slug]?.[language] ?? fallback[language];
}

function buildRoomMembers(slug: string, language: SocialLanguage, count: number) {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  const offset = slug.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % memberCatalog.length;
  const visibleCount = Math.min(Math.max(count - 1, 2), 4);
  if (canonicalSlug === "together-room") {
    const togetherMembers = {
      es: [
        { id: "member-carmen", name: "Carmen", sharedTopic: "Busca vivienda tranquila cerca", statusLabel: "Le interesa compartir casa" },
        { id: "member-luis", name: "Luis", sharedTopic: "Compara servicios locales", statusLabel: "Quiere reservar con otra persona" },
        { id: "member-ana", name: "Ana", sharedTopic: "Prefiere negociar con calma", statusLabel: "Revisa una oferta" },
        { id: "member-jose", name: "Jose", sharedTopic: "Disfruta peliculas clasicas", statusLabel: "Busca cita de pelicula" },
      ],
      de: [
        { id: "member-carmen", name: "Carmen", sharedTopic: "Sucht ruhiges Wohnen in der Naehe", statusLabel: "Interessiert an Wohnoptionen" },
        { id: "member-luis", name: "Luis", sharedTopic: "Vergleicht lokale Services", statusLabel: "Moechte gemeinsam buchen" },
        { id: "member-ana", name: "Ana", sharedTopic: "Verhandelt gern ruhig", statusLabel: "Prueft ein Angebot" },
        { id: "member-jose", name: "Jose", sharedTopic: "Mag Filmklassiker", statusLabel: "Sucht ein Film-Date" },
      ],
      en: [
        { id: "member-carmen", name: "Carmen", sharedTopic: "Looking at quiet nearby housing", statusLabel: "Interested in home sharing" },
        { id: "member-luis", name: "Luis", sharedTopic: "Comparing local services", statusLabel: "Wants to book with company" },
        { id: "member-ana", name: "Ana", sharedTopic: "Likes calm negotiation", statusLabel: "Reviewing an offer" },
        { id: "member-jose", name: "Jose", sharedTopic: "Enjoys classic movies", statusLabel: "Looking for a movie date" },
      ],
    };

    return togetherMembers[language];
  }

  if (canonicalSlug === "reading-room") {
    const readingMembers = {
      es: [
        { id: "member-maria", name: "Maria", sharedTopic: "Comparte novelas familiares y poesia breve", statusLabel: "Busca alguien para comentar un libro" },
        { id: "member-jose", name: "Jose", sharedTopic: "Le gustan historia, periodicos y biografias", statusLabel: "Trajo una pregunta literaria" },
        { id: "member-carmen", name: "Carmen", sharedTopic: "Recuerda escenas de teatro y cuentos", statusLabel: "Esta intercambiando recomendaciones" },
        { id: "member-ana", name: "Ana", sharedTopic: "Disfruta historias tranquilas y finales esperanzadores", statusLabel: "Quiere saludar a otra lectora" },
      ],
      de: [
        { id: "member-maria", name: "Maria", sharedTopic: "Teilt Familienromane und kurze Gedichte", statusLabel: "Sucht jemanden zum Buchgespraech" },
        { id: "member-jose", name: "Jose", sharedTopic: "Mag Geschichte, Zeitungen und Biografien", statusLabel: "Hat eine literarische Frage mitgebracht" },
        { id: "member-carmen", name: "Carmen", sharedTopic: "Erinnert Theaterszenen und Erzaehlungen", statusLabel: "Tauscht Empfehlungen aus" },
        { id: "member-ana", name: "Ana", sharedTopic: "Mag ruhige Geschichten und hoffnungsvolle Enden", statusLabel: "Moechte eine andere Leserin gruessen" },
      ],
      en: [
        { id: "member-maria", name: "Maria", sharedTopic: "Shares family novels and short poems", statusLabel: "Looking for someone to discuss a book" },
        { id: "member-jose", name: "Jose", sharedTopic: "Enjoys history, newspapers and biographies", statusLabel: "Brought a literary question" },
        { id: "member-carmen", name: "Carmen", sharedTopic: "Remembers theatre scenes and short stories", statusLabel: "Is exchanging recommendations" },
        { id: "member-ana", name: "Ana", sharedTopic: "Likes gentle stories and hopeful endings", statusLabel: "Wants to greet another reader" },
      ],
    };

    return readingMembers[language].slice(0, visibleCount);
  }

  if (canonicalSlug === "music-room") {
    return buildMusicRoomMembers(language).slice(0, visibleCount);
  }

  const members = Array.from({ length: visibleCount }, (_, index) => memberCatalog[(offset + index) % memberCatalog.length]);

  const statuses: Record<string, Record<SocialLanguage, string[]>> = {
    "garden-chat": {
      es: ["Está viendo el ejemplo", "Pidió ayuda con el riego", "Quiere una planta para interior", "Va a probar en el balcón"],
      de: ["Schaut sich das Beispiel an", "Hat um Hilfe beim Gießen gebeten", "Sucht eine Pflanze für drinnen", "Probiert es auf dem Balkon aus"],
      en: ["Is viewing the example", "Asked for help with watering", "Wants a plant for indoors", "Is going to try it on the balcony"],
    },
    "chess-corner": {
      es: ["Está resolviendo el reto", "Pidió ayuda con la reina", "Está viendo el ejemplo", "Quiere intentarlo otra vez"],
      de: ["Löst die Aufgabe", "Hat um Hilfe mit der Dame gebeten", "Schaut sich das Beispiel an", "Möchte es noch einmal versuchen"],
      en: ["Is solving the challenge", "Asked for help with the queen", "Is viewing the example", "Wants to try again"],
    },
    "creative-studio": {
      es: ["Está eligiendo colores suaves", "Pidió una idea sencilla", "Está viendo el ejemplo", "Empezó con una forma redonda"],
      de: ["Wählt sanfte Farben", "Bat um eine einfache Idee", "Schaut sich das Beispiel an", "Hat mit einer runden Form begonnen"],
      en: ["Is choosing soft colours", "Asked for a simple idea", "Is viewing the example", "Started with a round shape"],
    },
    "music-salon": {
      es: ["Compartio una cancion de su juventud", "Quiere conocer a alguien por musica", "Trajo un ritmo de su barrio", "Esta cambiando recuerdos musicales"],
      de: ["Teilt ein Lied aus der Jugend", "Moechte jemanden ueber Musik kennenlernen", "Bringt einen Rhythmus aus der Heimat mit", "Tauscht Musikerinnerungen aus"],
      en: ["Shared a song from their youth", "Wants to meet someone through music", "Brought a hometown rhythm", "Is swapping music memories"],
    },
    "music-room": {
      es: ["Compartio una cancion de su juventud", "Quiere conocer a alguien por musica", "Trajo un ritmo de su barrio", "Esta cambiando recuerdos musicales"],
      de: ["Teilt ein Lied aus der Jugend", "Moechte jemanden ueber Musik kennenlernen", "Bringt einen Rhythmus aus der Heimat mit", "Tauscht Musikerinnerungen aus"],
      en: ["Shared a song from their youth", "Wants to meet someone through music", "Brought a hometown rhythm", "Is swapping music memories"],
    },
  };

  const fallbackStatuses: Record<SocialLanguage, string[]> = {
    es: ["Está participando ahora", "Pidió ayuda", "Está viendo el ejemplo", "Compartió una idea"],
    de: ["Ist gerade dabei", "Hat um Hilfe gebeten", "Schaut sich das Beispiel an", "Hat eine Idee geteilt"],
    en: ["Is taking part now", "Asked for help", "Is viewing the example", "Shared an idea"],
  };

  const pool = statuses[canonicalSlug]?.[language] ?? statuses[slug]?.[language] ?? fallbackStatuses[language];

  return members.map((member, index) => ({
    id: member.id,
    name: member.name,
    sharedTopic:
      language === "de"
        ? `Mag ${member.topics[index % member.topics.length]}`
        : language === "en"
          ? `Likes ${member.topics[index % member.topics.length]}`
          : `Le gusta ${member.topics[index % member.topics.length]}`,
    statusLabel: pool[index % pool.length],
  }));
}

function buildRoomChat(slug: string, language: SocialLanguage, members: Array<{ id: string; name: string }>) {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  const messages: Record<string, Record<SocialLanguage, string[]>> = {
    "garden-chat": {
      es: ["Yo también tengo geranios en la ventana.", "A mí me ayuda tocar la tierra antes de regar."],
      de: ["Ich habe auch Geranien am Fenster.", "Mir hilft es, die Erde vor dem Gießen zu berühren."],
      en: ["I also keep geraniums by the window.", "It helps me to touch the soil before watering."],
    },
    "creative-studio": {
      es: ["Yo empiezo siempre con formas redondas.", "Los colores suaves me relajan mucho."],
      de: ["Ich beginne immer mit runden Formen.", "Sanfte Farben entspannen mich sehr."],
      en: ["I always start with round shapes.", "Soft colours relax me a lot."],
    },
    "music-salon": {
      es: ["Canciones de casa.", "Un ritmo abrio un saludo."],
      de: ["Lieder von zuhause.", "Ein Rhythmus oeffnete einen Gruss."],
      en: ["Songs from home.", "A rhythm opened hello."],
    },
    "music-room": {
      es: ["Canciones de casa.", "Un ritmo abrio un saludo."],
      de: ["Lieder von zuhause.", "Ein Rhythmus oeffnete einen Gruss."],
      en: ["Songs from home.", "A rhythm opened hello."],
    },
    "reading-room": {
      es: ["Yo traje una novela que me recuerda a mi hermana.", "A mi me gusta preguntar que personaje se queda contigo.", "Una recomendacion corta ayuda a empezar sin presion."],
      de: ["Ich habe einen Roman mitgebracht, der mich an meine Schwester erinnert.", "Ich frage gern, welche Figur bei dir bleibt.", "Eine kurze Empfehlung hilft, ohne Druck zu beginnen."],
      en: ["I brought a novel that reminds me of my sister.", "I like asking which character stays with you.", "A short recommendation helps start without pressure."],
    },
    "together-room": {
      es: ["Yo elegiria un cafe tranquilo antes de reservar.", "Para un trato, me ayuda escribir tres preguntas primero.", "Si es restaurante, prefiero que este cerca y sea accesible."],
      de: ["Ich wuerde vor der Buchung ein ruhiges Cafe waehlen.", "Bei einem Deal helfen mir zuerst drei Fragen.", "Beim Restaurant ist mir Naehe und Barrierefreiheit wichtig."],
      en: ["I would choose a quiet cafe before booking.", "For a deal, it helps me write three questions first.", "For a restaurant, nearby and accessible matters to me."],
    },
  };

  const fallback: Record<SocialLanguage, string[]> = {
    es: ["Me gusta cómo lo explica.", "Yo también quería preguntar eso."],
    de: ["Mir gefällt, wie es erklärt wird.", "Das wollte ich auch fragen."],
    en: ["I like how it's being explained.", "I wanted to ask that too."],
  };

  const gamesRoomMessages: Record<SocialLanguage, string[]> = {
    es: [
      "Yo empece con una pista de ajedrez y me ayudo ir despacio.",
      "Los juegos de palabras me salen mejor cuando la ronda es corta.",
      "Viktor explico el reto de memoria paso a paso y fue mas facil.",
    ],
    de: [
      "Ich habe mit einem Schachhinweis begonnen, und langsam zu gehen hat geholfen.",
      "Wortspiele fallen mir leichter, wenn die Runde kurz ist.",
      "Viktor hat die Gedaechtnisaufgabe Schritt fuer Schritt erklaert, das war einfacher.",
    ],
    en: [
      "I started with a chess clue, and slowing down helped.",
      "Word games feel easier when the round is short.",
      "Viktor explained the memory challenge one step at a time, and it felt easier.",
    ],
  };

  const pool =
    canonicalSlug === "games-room"
      ? gamesRoomMessages[language]
      : messages[canonicalSlug]?.[language] ?? messages[slug]?.[language] ?? fallback[language];
  return pool.slice(0, Math.min(pool.length, members.length)).map((text, index) => ({
    id: `${slug}-chat-${index}`,
    authorId: members[index]?.id ?? `member-${index}`,
    authorName: members[index]?.name ?? (language === "en" ? "Member" : language === "de" ? "Mitglied" : "Miembro"),
    text,
    createdAt: new Date(Date.now() - (index + 1) * 60000).toISOString(),
    connectable: true,
  }));
}

async function updateVisitInterests(userId: string, roomSlug: string): Promise<RoomVisitState> {
  const canonicalSlug = resolveSocialRoomSlug(roomSlug);
  const seed = getSocialRoomBySlug(canonicalSlug);
  if (!seed) return { isFirstVisit: true, previousVisitCount: 0, visitCount: 0 };

  const existing = await loadUserInterestSnapshot(userId);
  const visitState = buildRoomVisitState(existing, canonicalSlug, 1);
  const nextTags = Array.from(new Set([...existing.interestTags, ...seed.topicTags]));
  const nextTimes = Array.from(new Set([...existing.preferredTimes, ...seed.timeSlots]));
  const nextCounts = {
    ...existing.roomVisitCounts,
    [canonicalSlug]: visitState.visitCount,
  };
  const nextLastRooms = [canonicalSlug, ...existing.lastRooms.filter((value) => value !== canonicalSlug)].slice(0, 3);

  await persistInterestSnapshot(userId, {
    ...existing,
    interestTags: nextTags,
    preferredTimes: nextTimes,
    roomVisitCounts: nextCounts,
    lastRooms: nextLastRooms,
  });

  return visitState;
}

router.get("/hub", async (req: Request, res: Response) => {
  const userId = resolvePublicUserId(req);

  const profile = await loadProfileSummary(userId);
  const language = normalizeLanguage((req.query.lang as string | undefined) ?? profile.language);
  const interests = await loadUserInterestSnapshot(userId);
  const timeSlot = getTimeSlotFromDate();

  const activeRooms = socialRoomSeeds
    .map((seed) => {
      const payload = buildRoomPayload(seed.slug, language);
      if (!payload) return null;
      return {
        ...payload,
        liveBadge: toLiveBadge(language, payload.participantCount),
        heroScore: scoreRoom(seed.slug, interests, payload.participantCount, timeSlot),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.heroScore ?? 0) - (a?.heroScore ?? 0));

  const heroRooms = activeRooms;
  const alsoForYou: typeof activeRooms = [];

  return res.json({
    user: {
      id: userId,
      firstName: profile.firstName,
      language,
    },
    timeSlot,
    activeCount: activeRooms.length,
    interestTags: interests.interestTags,
    lastRooms: interests.lastRooms,
    heroRooms,
    alsoForYou,
    listRooms: activeRooms,
  });
});

router.get("/rooms/:slug", async (req: Request, res: Response) => {
  const userId = resolvePublicUserId(req);
  const profile = await loadProfileSummary(userId);
  const rawLanguage = (req.query.lang as string | undefined) ?? profile.language;
  const language = normalizeLanguage(rawLanguage);
  const gameLanguage = normalizeGameLanguage(rawLanguage);
  const room = buildRoomPayload(req.params.slug, language);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const members = buildRoomMembers(room.slug, language, room.participantCount);
  const memberChat = buildRoomChat(room.slug, language, members);
  const visitState = await loadRoomVisitState(userId, room.slug);
  const conversationContext = await buildSafeConversationContext(userId, {
    roomSlug: room.slug,
    roomVisitState: visitState,
  });
  const roomRecords = room.slug === "together-room" || room.slug === "reading-room" || room.slug === "music-room" ? await ensureRoomRecords(room.slug) : null;
  const pulse = room.slug === "together-room"
    ? await buildTogetherRoomPulse(userId, language, roomRecords?.roomId ?? null, members)
    : room.slug === "reading-room"
      ? await buildReadingClubPulse(userId, language, roomRecords?.roomId ?? null, members)
      : undefined;
  const readingClub = room.slug === "reading-room"
    ? buildReadingClubDestination(language, members, room.participantCount)
    : undefined;
  const musicThreads = room.slug === "music-room"
    ? await loadMusicThreads(room.slug, roomRecords?.roomId ?? null)
    : undefined;
  const musicCircle = room.slug === "music-room"
    ? await loadMusicCircle(userId, room.slug, roomRecords?.roomId ?? null, language)
    : undefined;

  return res.json({
    room: {
      ...room,
      liveBadge: toLiveBadge(language, room.participantCount),
    },
    transcript: [
      {
        id: `${room.slug}-welcome`,
        speaker: "agent",
        text: room.opener,
        createdAt: new Date().toISOString(),
      },
    ],
    promptChips: room.options?.length ? room.options : buildPromptChips(room.slug, language),
    members,
    memberChat,
    visitState,
    conversationContext,
    ...(room.slug === "games-room"
      ? { gameTable: buildGameTable(gameLanguage, room.participantCount) }
      : {}),
    ...(pulse ? { pulse } : {}),
    ...(readingClub ? { readingClub } : {}),
    ...(musicCircle ? { musicCircle } : {}),
    ...(musicThreads ? { musicThreads } : {}),
  });
});

router.get("/rooms/:slug/pulse", async (req: Request, res: Response) => {
  const userId = resolvePublicUserId(req);
  const profile = await loadProfileSummary(userId);
  const language = normalizeLanguage((req.query.lang as string | undefined) ?? profile.language);
  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room" && slug !== "reading-room") return res.status(400).json({ error: "This room does not support pulse actions" });

  const records = await ensureRoomRecords(slug);
  const room = buildRoomPayload(slug, language);
  const members = room ? buildRoomMembers(slug, language, room.participantCount) : undefined;
  const pulse = slug === "together-room"
    ? await buildTogetherRoomPulse(userId, language, records?.roomId ?? null, members)
    : await buildReadingClubPulse(userId, language, records?.roomId ?? null, members);
  return res.json({ pulse });
});

router.post("/rooms/:slug/plans/:planId/respond", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = planResponseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room" && slug !== "reading-room") return res.status(400).json({ error: "This room does not support plan responses" });

  const records = await ensureRoomRecords(slug);
  const payload = {
    userId,
    roomId: records?.roomId ?? null,
    planKey: req.params.planId,
    response: parsed.data.response,
    language: normalizeLanguage(parsed.data.lang),
  };
  const result = slug === "together-room"
    ? await respondToTogetherPlan(payload)
    : await respondToReadingClubPlan(payload);

  if ("error" in result) return res.status(400).json({ error: result.error });
  return res.json({ ok: true, ...result });
});

router.post("/rooms/:slug/plans/:planId/replies", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = planReplySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room") return res.status(400).json({ error: "This room does not support gentle replies" });

  const records = await ensureRoomRecords(slug);
  const result = await replyToTogetherPlan({
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    planKey: req.params.planId,
    body: parsed.data.body,
    tone: parsed.data.tone,
    language: normalizeLanguage(parsed.data.lang),
  });

  if ("error" in result) return res.status(400).json({ error: result.error });
  return res.json({ ok: true, ...result });
});

router.post("/rooms/:slug/music-threads/:threadId/entries", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = musicThreadEntrySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "music-room") return res.status(400).json({ error: "This room does not support music thread entries" });

  const records = await ensureRoomRecords(slug);
  const result = await addMusicThreadEntry({
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    threadId: req.params.threadId,
    language: normalizeLanguage(parsed.data.lang),
    kind: parsed.data.kind,
    body: parsed.data.body,
  });

  if (result.error) {
    return res.status(result.safetyFlags ? 400 : 404).json({
      error: result.error,
      ...(result.safetyFlags ? { safetyFlags: result.safetyFlags } : {}),
    });
  }
  return res.json({ ok: true, entry: result.entry, thread: result.thread });
});

router.post("/rooms/:slug/music-circle/items", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = musicCircleItemSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "music-room") return res.status(400).json({ error: "This room does not support music circle items" });

  const records = await ensureRoomRecords(slug);
  const result = await createMusicCircleItem({
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    language: normalizeLanguage(parsed.data.lang),
    songText: parsed.data.songText,
    causeId: parsed.data.causeId,
    memoryText: parsed.data.memoryText,
  });

  if (result.error) {
    return res.status(result.safetyFlags ? 400 : 404).json({
      error: result.error,
      ...(result.safetyFlags ? { safetyFlags: result.safetyFlags } : {}),
    });
  }
  return res.json({ ok: true, item: result.item, musicCircle: result.musicCircle });
});

router.post("/rooms/:slug/music-circle/items/:itemId/reactions", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = musicCircleReactionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "music-room") return res.status(400).json({ error: "This room does not support music circle reactions" });

  const records = await ensureRoomRecords(slug);
  const result = await toggleMusicCircleReaction({
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    itemId: req.params.itemId,
    language: normalizeLanguage(parsed.data.lang),
    kind: parsed.data.kind,
  });

  if (result.error) return res.status(404).json({ error: result.error });
  return res.json({ ok: true, item: result.item, musicCircle: result.musicCircle });
});

router.post("/rooms/:slug/polls/:pollId/vote", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = pollVoteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room" && slug !== "reading-room") return res.status(400).json({ error: "This room does not support room votes" });

  const records = await ensureRoomRecords(slug);
  const payload = {
    userId,
    roomId: records?.roomId ?? null,
    pollKey: req.params.pollId,
    optionId: parsed.data.optionId,
    language: normalizeLanguage(parsed.data.lang),
  };
  const result = slug === "together-room"
    ? await voteTogetherPoll(payload)
    : await voteReadingClubPoll(payload);

  if ("error" in result) return res.status(400).json({ error: result.error });
  return res.json({ ok: true, ...result });
});

router.post("/rooms/:slug/proposals", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = proposalSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room" && slug !== "reading-room") return res.status(400).json({ error: "This room does not support proposals" });

  const records = await ensureRoomRecords(slug);
  const payload = {
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    title: parsed.data.title,
    details: parsed.data.details,
    locationLabel: parsed.data.locationLabel,
    comfortNeeds: parsed.data.comfortNeeds,
    kind: parsed.data.kind,
    experienceCategory: parsed.data.experienceCategory,
    preferredTime: parsed.data.preferredTime,
    costRange: parsed.data.costRange,
    groupSize: parsed.data.groupSize,
    language: normalizeLanguage(parsed.data.lang),
  };
  const result = slug === "together-room"
    ? await createTogetherProposal(payload)
    : await createReadingClubPost(payload);

  return res.json({ ok: true, ...result });
});

router.post("/rooms/:slug/safety-reports", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = safetyReportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room" && slug !== "reading-room" && slug !== "music-room") return res.status(400).json({ error: "This room does not support safety reports" });
  if (slug === "music-room" && parsed.data.targetType !== "room" && parsed.data.targetType !== "music_thread_entry" && parsed.data.targetType !== "music_circle_item") {
    return res.status(400).json({ error: "Music Room reports can target the room, a music circle item or a music thread entry" });
  }

  const records = await ensureRoomRecords(slug);
  const payload = {
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    language: normalizeLanguage(parsed.data.lang),
  };
  if (slug === "music-room") {
    await createMusicSafetyReport({
      userId,
      roomId: records?.roomId ?? null,
      language: payload.language,
      targetId: parsed.data.targetId ?? "room",
      safetyFlags: [],
      targetType: parsed.data.targetType === "music_thread_entry" || parsed.data.targetType === "music_circle_item"
        ? parsed.data.targetType
        : "room",
      reason: parsed.data.reason,
      details: parsed.data.details,
    });
    return res.json({
      ok: true,
      report: {
        id: randomUUID(),
        roomSlug: slug,
        reporterId: userId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        reason: parsed.data.reason,
        details: parsed.data.details,
        status: "open",
        createdAt: new Date().toISOString(),
      },
    });
  }

  const result = slug === "together-room"
    ? await createTogetherSafetyReport(payload)
    : await createReadingClubSafetyReport(payload);

  return res.json({ ok: true, ...result });
});

router.post("/rooms/:slug/safety-acknowledgement", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = agreementAcknowledgementSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room") return res.status(400).json({ error: "This room does not support safety acknowledgement" });

  const records = await ensureRoomRecords(slug);
  const result = await acknowledgeTogetherAgreement({
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    language: normalizeLanguage(parsed.data.lang),
  });

  return res.json({ ok: true, ...result });
});

router.post("/rooms/:slug/comfort-check", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = comfortCheckSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room") return res.status(400).json({ error: "This room does not support comfort check-ins" });

  const records = await ensureRoomRecords(slug);
  const result = await saveTogetherComfortCheck({
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    comfortNeeds: parsed.data.comfortNeeds,
    language: normalizeLanguage(parsed.data.lang),
  });

  return res.json({ ok: true, ...result });
});

router.post("/rooms/:slug/notifications/:notificationId/read", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = notificationReadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "together-room") return res.status(400).json({ error: "This room does not support room update read receipts" });

  const records = await ensureRoomRecords(slug);
  const result = await markTogetherNotificationRead({
    userId,
    roomSlug: slug,
    roomId: records?.roomId ?? null,
    notificationId: req.params.notificationId,
    language: normalizeLanguage(parsed.data.lang),
  });

  return res.json({ ok: true, ...result });
});

router.post("/rooms/:slug/enter", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = roomActionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  const room = buildRoomPayload(slug, normalizeLanguage(parsed.data.lang));
  if (!room) return res.status(404).json({ error: "Room not found" });

  const visitId = randomUUID();
  visitSessionMemory.set(visitId, {
    userId,
    roomSlug: slug,
    enteredAt: Date.now(),
  });
  memoryRoomOccupancy.set(slug, (memoryRoomOccupancy.get(slug) ?? 0) + 1);

  const visitState = await updateVisitInterests(userId, slug);

  const ensured = await ensureRoomRecords(slug);
  if (ensured) {
    await safeDb(
      "insert visit",
      async () => {
        await db.insert(socialRoomVisits).values({
          user_id: userId,
          room_id: ensured.roomId,
          session_id: ensured.sessionId,
        });
      },
      async () => undefined,
    );
  }

  return res.json({
    visitId,
    participantCount: getRoomParticipantCount(slug),
    liveBadge: toLiveBadge(normalizeLanguage(parsed.data.lang), getRoomParticipantCount(slug)),
    isFirstVisit: visitState.isFirstVisit,
    previousVisitCount: visitState.previousVisitCount,
    visitCount: visitState.visitCount,
    visitState,
    conversationContext: await buildSafeConversationContext(userId, {
      roomSlug: slug,
      roomVisitState: visitState,
    }),
  });
});

router.post("/rooms/:slug/leave", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = roomActionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const memoryVisit = parsed.data.visitId ? visitSessionMemory.get(parsed.data.visitId) : null;
  if (memoryVisit?.roomSlug) {
    const current = memoryRoomOccupancy.get(memoryVisit.roomSlug) ?? 0;
    memoryRoomOccupancy.set(memoryVisit.roomSlug, Math.max(0, current - 1));
    visitSessionMemory.delete(parsed.data.visitId!);
  }

  return res.json({ ok: true });
});

router.post("/rooms/:slug/game-round", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = gameRoundSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  if (slug !== "games-room") {
    return res.status(400).json({ error: "This room does not support game rounds" });
  }

  await persistGamePreference(userId, parsed.data.gameKind);

  return res.json({
    ok: true,
    roomSlug: slug,
    roundId: parsed.data.roundId ?? null,
    gameKind: parsed.data.gameKind,
    interestTag: buildGamePreferenceTag(parsed.data.gameKind),
  });
});

router.post("/rooms/:slug/message", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = messageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const room = getSocialRoomBySlug(req.params.slug);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const language = normalizeLanguage(parsed.data.lang);
  const visitState = await loadRoomVisitState(userId, room.slug);
  const conversationContext = await buildSafeConversationContext(userId, {
    roomSlug: room.slug,
    roomVisitState: visitState,
  });
  const reply = applyConversationContextCue(
    buildAgentReply(room.slug, language, parsed.data.message),
    language,
    conversationContext,
  );

  return res.json({
    reply,
    createdAt: new Date().toISOString(),
    conversationContext,
  });
});

router.post("/rooms/:slug/match", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const body = (req.body ?? {}) as {
    lang?: string;
    gameKind?: unknown;
    readingMode?: unknown;
    readingIntent?: unknown;
    selectedIntentId?: unknown;
    favoriteShelf?: unknown;
    favoriteShelfId?: unknown;
    preferredPace?: unknown;
    preferredPaceId?: unknown;
    readingPreferenceTags?: unknown;
  };
  const language = normalizeLanguage(body.lang);
  const slug = resolveSocialRoomSlug(req.params.slug);
  const gameKind = isSocialGameKind(body.gameKind) ? body.gameKind : null;
  const readingMode = typeof body.readingMode === "string" ? body.readingMode : "one-to-one";
  const readingPreferenceTags = slug === "reading-room" ? buildReadingPreferenceTags(body) : [];

  if (!supportsSocialMatching(slug)) {
    return res.status(400).json({ error: "This room does not support matching" });
  }

  if (slug === "games-room" && gameKind) {
    await persistGamePreference(userId, gameKind);
  }

  const userInterests = await loadUserInterestSnapshot(userId);

  const candidates = await safeDb(
    "load match candidates",
    async () => {
      const interestRows = await db
        .select({
          userId: socialUserInterests.user_id,
          interestTags: socialUserInterests.interest_tags,
        })
        .from(socialUserInterests)
        .where(ne(socialUserInterests.user_id, userId));

      const discoverableProfiles = await db
        .select({
          id: profiles.id,
          preferred_name: profiles.preferred_name,
          full_name: profiles.full_name,
          discoverable: profiles.discoverable,
        })
        .from(profiles)
        .where(and(ne(profiles.id, userId), eq(profiles.discoverable, true)));

      const allowedIds = new Set(discoverableProfiles.map((row) => row.id));
      const profileMap = new Map(discoverableProfiles.map((row) => [row.id, row]));

      return interestRows
        .filter((row) => allowedIds.has(row.userId))
        .map((row) => ({
          userId: row.userId,
          interestTags: row.interestTags ?? [],
          discoverable: true,
          displayName:
            profileMap.get(row.userId)?.preferred_name ||
            profileMap.get(row.userId)?.full_name?.split(/\s+/).filter(Boolean)[0] ||
            "Amiga",
        }));
    },
    async () => {
      if (IS_PROD) return [];
      return Array.from(memoryInterests.entries())
        .filter(([candidateId]) => candidateId !== userId)
        .map(([candidateId, snapshot]) => ({
          userId: candidateId,
          interestTags: snapshot.interestTags,
          displayName: "Amiga",
        }));
    },
  );

  const best = pickBestSocialMatch(userInterests.interestTags, candidates, { roomSlug: slug, gameKind, readingPreferenceTags });

  if (!best) {
    const agentMessage = language === "de"
      ? "Heute ist noch niemand passend verfügbar. Schau später noch einmal vorbei."
      : language === "en"
        ? "Nobody suitable is available just yet today. Please come back a little later."
        : "Todavía no hay nadie adecuado disponible hoy. Vuelve un poco más tarde.";
    return res.json({ noMatch: true, agentMessage });
  }

  const connectionKey = buildConnectionKey(userId, best.userId);
  memoryConnections.set(connectionKey, {
    matchedUserId: best.userId,
    matchedViaRoom: slug,
    matchedAt: new Date().toISOString(),
  });

  await safeDb(
    "persist social connection",
    async () => {
      await db
        .insert(socialConnections)
        .values({
          user_id_a: [userId, best.userId].sort()[0],
          user_id_b: [userId, best.userId].sort()[1],
          matched_via_room: slug,
          status: "pending",
        })
        .onConflictDoNothing();
    },
    async () => undefined,
  );

  const fallbackGameTopic = gameKind ? buildGamePreferenceTag(gameKind) : undefined;
  const sharedTopic = formatSharedTopic(best.shared[0] ?? fallbackGameTopic, language);
  const readingProfileNote = slug === "reading-room" ? getReadingProfileNote(language, body) : "";
  const agentMessage =
    slug === "games-room"
      ? language === "de"
        ? `Ich habe jemanden gefunden, der auch ${sharedTopic} mag. Wenn ihr beide zustimmt, bleibt der Kontakt geschuetzt.`
        : language === "en"
          ? `I found someone who also enjoys ${sharedTopic}. If you both accept, contact stays private until you are ready.`
          : `He encontrado a alguien que tambien disfruta ${sharedTopic}. Si ambos aceptais, el contacto sigue protegido.`
      : slug === "reading-room"
        ? readingMode === "small-circle"
          ? language === "de"
            ? `Ich habe jemanden gefunden, der auch ${sharedTopic} mag. Isabel kann daraus einen kleinen Tisch mit ruhigem Thema machen.${readingProfileNote}`
            : language === "en"
              ? `I found someone who also enjoys ${sharedTopic}. Isabel can shape this into a small table around a calm theme.${readingProfileNote}`
              : `He encontrado a alguien que tambien disfruta ${sharedTopic}. Isabel puede convertirlo en una mesa pequena con un tema tranquilo.${readingProfileNote}`
          : readingMode === "pen-note"
            ? language === "de"
              ? `Ich habe jemanden gefunden, der auch ${sharedTopic} mag. Ihr koennt mit einer kurzen geschuetzten Notiz beginnen.${readingProfileNote}`
              : language === "en"
                ? `I found someone who also enjoys ${sharedTopic}. You can begin with a short protected note.${readingProfileNote}`
                : `He encontrado a alguien que tambien disfruta ${sharedTopic}. Podeis empezar con una nota breve y protegida.${readingProfileNote}`
            : language === "de"
              ? `Ich habe jemanden gefunden, der auch ${sharedTopic} mag. Ihr koennt mit einer Lieblingsstelle oder Empfehlung beginnen.${readingProfileNote}`
              : language === "en"
                ? `I found someone who also enjoys ${sharedTopic}. You could begin with a favourite passage or recommendation.${readingProfileNote}`
                : `He encontrado a alguien que tambien disfruta ${sharedTopic}. Podeis empezar con una escena favorita o una recomendacion.${readingProfileNote}`
      : language === "de"
        ? `Ich habe jemanden mit aehnlichen Interessen gefunden. Ihr koennt mit ${sharedTopic} beginnen.`
        : language === "en"
          ? `I found someone with similar interests. You could begin with ${sharedTopic}.`
          : `He encontrado a alguien con intereses parecidos. Podeis empezar por ${sharedTopic}.`;

  return res.json({
    noMatch: false,
    matchedUser: {
      userId: best.userId,
      name: best.displayName,
    },
    sharedTopics: best.shared,
    agentMessage,
  });
});

router.post("/rooms/:slug/connect", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const memberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
  const language = normalizeLanguage((req.body as { lang?: string } | undefined)?.lang);
  const canonicalSlug = resolveSocialRoomSlug(req.params.slug);
  const bridgePrompt = typeof req.body?.bridgePrompt === "string" ? req.body.bridgePrompt.trim().slice(0, 220) : "";
  const member =
    canonicalSlug === "music-room"
      ? buildMusicRoomMembers(language).find((entry) => entry.id === memberId)
      : memberCatalog.find((entry) => entry.id === memberId);

  if (canonicalSlug === "reading-room") {
    const isMatchedReader = await hasExistingSocialConnection(userId, memberId, canonicalSlug);
    if (!member && !isMatchedReader) return res.status(404).json({ error: "Member not found" });

    const memberName =
      member?.name ||
      await loadProfileDisplayName(memberId) ||
      (language === "de" ? "deine Lesegefaehrtin" : language === "en" ? "your reading companion" : "tu compania de lectura");
    const starter =
      bridgePrompt ||
      (language === "de"
        ? "ein Buch, eine Figur oder eine Erinnerung, die ihr teilen moechtet."
        : language === "en"
          ? "a book, character or memory you would like to share."
          : "un libro, un personaje o un recuerdo que querais compartir.");
    const reply =
      language === "de"
        ? `${memberName} weiss, dass du offen fuer einen literarischen Gruss bist. Ihr koennt beginnen mit: ${starter}`
        : language === "en"
          ? `${memberName} now knows you're open to a literary greeting. You can begin with: ${starter}`
          : `${memberName} ya sabe que te apetece un saludo literario. Podeis empezar con: ${starter}`;

    return res.json({ ok: true, reply });
  }

  if (!member) return res.status(404).json({ error: "Member not found" });

  if (canonicalSlug === "music-room") {
    const records = await ensureRoomRecords(canonicalSlug);
    const circleItemId = typeof req.body?.circleItemId === "string" ? req.body.circleItemId.trim().slice(0, 140) : "";
    const circleItem = circleItemId
      ? await loadMusicCircleItemForConnect({
        userId,
        roomSlug: canonicalSlug,
        roomId: records?.roomId ?? null,
        itemId: circleItemId,
      })
      : null;
    const requestSongText = typeof req.body?.songText === "string" && req.body.songText.trim()
      ? req.body.songText.trim().slice(0, 160)
      : "";
    const songText = circleItem?.songText || requestSongText || bridgePrompt || (
      language === "de" ? "Geteiltes Lied" : language === "en" ? "Shared song" : "Cancion compartida"
    );
    const matchedTopic = typeof req.body?.matchedTopic === "string" && req.body.matchedTopic.trim()
      ? req.body.matchedTopic.trim().slice(0, 80)
      : member.sharedTopic ?? "";
    const thread = await createOrReuseMusicThread({
      userId,
      roomSlug: canonicalSlug,
      roomId: records?.roomId ?? null,
      language,
      matchedMemberId: member.id,
      matchedMemberName: member.name,
      songText,
      matchedTopic,
      bridgePrompt,
    });
    const reply =
      language === "de"
        ? `${member.name} hat deinen Gruss.`
        : language === "en"
          ? `${member.name} got your hello.`
          : `${member.name} recibio tu saludo.`;

    return res.json({ ok: true, reply, thread });
  }

  const reply =
    language === "de"
      ? `${member.name} weiß, dass du offen für ein Gespräch bist. Ich kann euch über gemeinsame Interessen zusammenbringen.`
      : language === "en"
        ? `${member.name} now knows you're open to a chat. I can bring you together around a shared interest.`
        : `${member.name} ya sabe que te apetece conversar. Puedo acercaros a través de un interés compartido.`;

  return res.json({ ok: true, reply });
});

export default router;
