import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  homePlanCards,
  learningLessons,
  participationEvents,
  socialRooms,
  socialRoomSessions,
} from "../../shared/schema.js";
import {
  buildActivityContentItems,
  buildHomeCardContentItems,
  buildLessonContentItems,
  buildRoomPromptContentItems,
  summarizeAdminContentIndex,
  type AdminContentIndexItem,
  type AdminContentSourceHealth,
  type AdminContentType,
} from "../../shared/adminContentIndex.js";

const router = Router();

async function loadSource<T>(
  type: AdminContentType,
  loader: () => Promise<T[]>,
  builder: (rows: T[]) => AdminContentIndexItem[],
) {
  try {
    const rows = await loader();
    return {
      items: builder(rows),
      health: { type, available: true, message: null } satisfies AdminContentSourceHealth,
    };
  } catch (error) {
    console.error(`[admin/content-index] ${type} load failed`, error);
    return {
      items: [],
      health: {
        type,
        available: false,
        message: "This source could not be loaded. Check its database setup.",
      } satisfies AdminContentSourceHealth,
    };
  }
}

router.get("/", async (_req, res) => {
  const [homeCards, activities, lessons, roomPrompts] = await Promise.all([
    loadSource(
      "home_card",
      () => db.select().from(homePlanCards).orderBy(desc(homePlanCards.updated_at)).limit(1000),
      buildHomeCardContentItems,
    ),
    loadSource(
      "curated_activity",
      () => db.select().from(participationEvents).orderBy(desc(participationEvents.updated_at)).limit(1000),
      buildActivityContentItems,
    ),
    loadSource(
      "lesson",
      () => db.select().from(learningLessons).orderBy(desc(learningLessons.updatedAt)).limit(2000),
      buildLessonContentItems,
    ),
    loadSource(
      "room_prompt",
      () => db
        .select({
          id: socialRoomSessions.id,
          slug: socialRooms.slug,
          roomName: socialRooms.name_en,
          sessionDate: socialRoomSessions.session_date,
          topicEn: socialRoomSessions.topic_en,
          topicEs: socialRoomSessions.topic_es,
          topicDe: socialRoomSessions.topic_de,
          openerEn: socialRoomSessions.opener_en,
          openerEs: socialRoomSessions.opener_es,
          openerDe: socialRoomSessions.opener_de,
          isLive: socialRoomSessions.is_live,
          createdAt: socialRoomSessions.created_at,
        })
        .from(socialRoomSessions)
        .innerJoin(socialRooms, eq(socialRoomSessions.room_id, socialRooms.id))
        .orderBy(desc(socialRoomSessions.created_at))
        .limit(1000),
      buildRoomPromptContentItems,
    ),
  ]);

  const results = [homeCards, activities, lessons, roomPrompts];
  const items = results.flatMap((result) => result.items).sort((a, b) => (
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.title.localeCompare(b.title)
  ));
  const sources = results.map((result) => result.health);

  return res.json({
    generatedAt: new Date().toISOString(),
    items,
    summary: summarizeAdminContentIndex(items, sources),
    sources,
  });
});

export default router;
