import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { socialRooms } from "../../shared/schema.js";
import { resolveSocialRoomSlug } from "../lib/socialRoomsSeed.js";
import {
  listTogetherModeration,
  updateTogetherPlanModeration,
  updateTogetherPollModeration,
  updateTogetherReplyModeration,
  updateTogetherReport,
} from "../lib/socialRoomPulse.js";
import {
  listReadingClubModeration,
  updateReadingClubReport,
} from "../lib/readingClubPulse.js";

const router = Router();

const reportStatusSchema = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
});

const planModerationSchema = z.object({
  status: z.enum(["active", "hidden", "closed"]),
  notes: z.string().trim().max(400).optional(),
  roomSlug: z.string().trim().max(120).optional(),
});

const pollModerationSchema = z.object({
  status: z.enum(["active", "closed", "hidden"]),
  notes: z.string().trim().max(400).optional(),
  roomSlug: z.string().trim().max(120).optional(),
});

const replyModerationSchema = z.object({
  status: z.enum(["active", "hidden"]),
  notes: z.string().trim().max(400).optional(),
  roomSlug: z.string().trim().max(120).optional(),
});

async function resolveRoomId(roomSlug: string) {
  try {
    const [room] = await db
      .select({ id: socialRooms.id })
      .from(socialRooms)
      .where(eq(socialRooms.slug, resolveSocialRoomSlug(roomSlug)))
      .limit(1);
    return room?.id ?? null;
  } catch (error) {
    console.warn("[admin/social] room lookup fallback", error);
    return null;
  }
}

function adminUserId(req: Request) {
  return req.user?.id ?? "admin";
}

router.get("/rooms/:slug/moderation", async (req: Request, res: Response) => {
  const slug = resolveSocialRoomSlug(req.params.slug);
  const roomId = await resolveRoomId(slug);
  const moderation = slug === "reading-room"
    ? await listReadingClubModeration(slug, roomId)
    : await listTogetherModeration(slug, roomId);
  return res.json({ roomSlug: slug, ...moderation });
});

router.patch("/reports/:reportId", async (req: Request, res: Response) => {
  const parsed = reportStatusSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = {
    reportId: req.params.reportId,
    adminUserId: adminUserId(req),
    status: parsed.data.status,
  };
  await Promise.all([
    updateTogetherReport(payload),
    updateReadingClubReport(payload),
  ]);

  return res.json({ ok: true });
});

router.patch("/plans/:planId", async (req: Request, res: Response) => {
  const parsed = planModerationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const roomSlug = resolveSocialRoomSlug(parsed.data.roomSlug ?? "together-room");
  const roomId = await resolveRoomId(roomSlug);
  await updateTogetherPlanModeration({
    planKey: req.params.planId,
    adminUserId: adminUserId(req),
    roomId,
    status: parsed.data.status,
    notes: parsed.data.notes,
  });

  return res.json({ ok: true });
});

router.patch("/polls/:pollId", async (req: Request, res: Response) => {
  const parsed = pollModerationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const roomSlug = resolveSocialRoomSlug(parsed.data.roomSlug ?? "together-room");
  const roomId = await resolveRoomId(roomSlug);
  await updateTogetherPollModeration({
    pollKey: req.params.pollId,
    adminUserId: adminUserId(req),
    roomId,
    status: parsed.data.status,
    notes: parsed.data.notes,
  });

  return res.json({ ok: true });
});

router.patch("/replies/:replyId", async (req: Request, res: Response) => {
  const parsed = replyModerationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const roomSlug = resolveSocialRoomSlug(parsed.data.roomSlug ?? "together-room");
  const roomId = await resolveRoomId(roomSlug);
  await updateTogetherReplyModeration({
    replyId: req.params.replyId,
    adminUserId: adminUserId(req),
    roomId,
    status: parsed.data.status,
    notes: parsed.data.notes,
  });

  return res.json({ ok: true });
});

export default router;
