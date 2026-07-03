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
import {
  createAdminParticipationEvent,
  listAdminParticipationActivity,
  listAdminParticipationEvents,
  parseParticipationLanguage,
  updateAdminParticipationEvent,
} from "../lib/participation.js";
import {
  discoverParticipationEvents,
  ParticipationDiscoveryError,
} from "../lib/participationDiscovery.js";

const router = Router();

const reportStatusSchema = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
  notes: z.string().trim().max(400).optional(),
  roomSlug: z.string().trim().max(120).optional(),
  lang: z.enum(["es", "de", "en"]).optional(),
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

const participationHelperActionSchema = z.enum(["check_details", "transport", "reminder", "bring_friend"]);

const participationEventSchema = z.object({
  eventKey: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9-]*$/),
  titleEs: z.string().trim().min(1).max(140),
  titleDe: z.string().trim().min(1).max(140),
  titleEn: z.string().trim().min(1).max(140),
  summaryEs: z.string().trim().max(260).optional(),
  summaryDe: z.string().trim().max(260).optional(),
  summaryEn: z.string().trim().max(260).optional(),
  descriptionEs: z.string().trim().max(600).optional(),
  descriptionDe: z.string().trim().max(600).optional(),
  descriptionEn: z.string().trim().max(600).optional(),
  format: z.enum(["nearby", "online", "hybrid"]).optional(),
  locationLabel: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).nullable().optional(),
  countryCode: z.string().trim().max(2).nullable().optional(),
  timeLabelEs: z.string().trim().max(120).optional(),
  timeLabelDe: z.string().trim().max(120).optional(),
  timeLabelEn: z.string().trim().max(120).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  costLabelEs: z.string().trim().max(120).optional(),
  costLabelDe: z.string().trim().max(120).optional(),
  costLabelEn: z.string().trim().max(120).optional(),
  languageCodes: z.array(z.string().trim().min(2).max(8)).max(8).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(24).optional(),
  interestTags: z.array(z.string().trim().min(1).max(60)).max(24).optional(),
  accessibilityTags: z.array(z.string().trim().min(1).max(60)).max(16).optional(),
  helperActions: z.array(participationHelperActionSchema).max(4).optional(),
  source: z.string().trim().max(60).optional(),
  sourceUrl: z.string().url().nullable().optional(),
  status: z.enum(["active", "draft", "hidden", "archived"]).optional(),
  isCurated: z.boolean().optional(),
  needsLiveCheck: z.boolean().optional(),
  safetyStatus: z.enum(["approved", "needs_review", "hidden"]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const participationEventPatchSchema = participationEventSchema.omit({ eventKey: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" },
);

const participationDiscoverySchema = z.object({
  city: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().max(2).nullable().optional(),
  languageCodes: z.array(z.string().trim().min(2).max(8)).max(8).optional(),
  interests: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  format: z.enum(["any", "nearby", "online", "hybrid"]).optional(),
  maxResults: z.coerce.number().int().min(1).max(12).optional(),
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

function isSupportedReportModerationRoom(slug: string) {
  return slug === "together-room" || slug === "reading-room";
}

function isTogetherModerationRoom(slug: string) {
  return slug === "together-room";
}

function forceAiDiscoveryDraft<T extends z.infer<typeof participationEventSchema>>(event: T): T {
  if (event.source !== "ai-discovery") return event;
  return {
    ...event,
    status: "draft",
    safetyStatus: "needs_review",
    isCurated: true,
    needsLiveCheck: true,
  };
}

router.get("/participate/events", async (req: Request, res: Response) => {
  const language = parseParticipationLanguage(req.query.lang as string | undefined);
  const events = await listAdminParticipationEvents(language);
  return res.json({ events });
});

router.post("/participate/events", async (req: Request, res: Response) => {
  const parsed = participationEventSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const event = await createAdminParticipationEvent(forceAiDiscoveryDraft(parsed.data), adminUserId(req));
  return res.status(201).json({ ok: true, event });
});

router.post("/participate/discover", async (req: Request, res: Response) => {
  const parsed = participationDiscoverySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const discovery = await discoverParticipationEvents(parsed.data);
    return res.json({ ok: true, ...discovery });
  } catch (error) {
    if (error instanceof ParticipationDiscoveryError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }
    console.error("[admin/social] participation discovery failed", error);
    return res.status(500).json({
      error: "AI discovery could not complete. Nothing was created.",
      code: "DISCOVERY_FAILED",
    });
  }
});

router.patch("/participate/events/:eventId", async (req: Request, res: Response) => {
  const parsed = participationEventPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const event = await updateAdminParticipationEvent(req.params.eventId, parsed.data);
  if (!event) return res.status(404).json({ error: "Participation event not found" });
  return res.json({ ok: true, event });
});

router.get("/participate/activity", async (_req: Request, res: Response) => {
  const activity = await listAdminParticipationActivity();
  return res.json({ activity });
});

router.get("/rooms/:slug/moderation", async (req: Request, res: Response) => {
  const slug = resolveSocialRoomSlug(req.params.slug);
  if (!isSupportedReportModerationRoom(slug)) {
    return res.status(400).json({ error: "This room does not support social moderation" });
  }
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

  const roomSlug = parsed.data.roomSlug ? resolveSocialRoomSlug(parsed.data.roomSlug) : undefined;
  if (roomSlug && !isSupportedReportModerationRoom(roomSlug)) {
    return res.status(400).json({ error: "This room does not support social report moderation" });
  }
  const roomId = roomSlug ? await resolveRoomId(roomSlug) : null;
  const payload = {
    reportId: req.params.reportId,
    adminUserId: adminUserId(req),
    status: parsed.data.status,
    notes: parsed.data.notes,
    roomSlug,
    roomId,
    language: parsed.data.lang ?? "en",
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
  if (!isTogetherModerationRoom(roomSlug)) {
    return res.status(400).json({ error: "This room does not support Together Room plan moderation" });
  }
  const roomId = await resolveRoomId(roomSlug);
  await updateTogetherPlanModeration({
    planKey: req.params.planId,
    adminUserId: adminUserId(req),
    roomSlug,
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
  if (!isTogetherModerationRoom(roomSlug)) {
    return res.status(400).json({ error: "This room does not support Together Room poll moderation" });
  }
  const roomId = await resolveRoomId(roomSlug);
  await updateTogetherPollModeration({
    pollKey: req.params.pollId,
    adminUserId: adminUserId(req),
    roomSlug,
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
  if (!isTogetherModerationRoom(roomSlug)) {
    return res.status(400).json({ error: "This room does not support Together Room reply moderation" });
  }
  const roomId = await resolveRoomId(roomSlug);
  await updateTogetherReplyModeration({
    replyId: req.params.replyId,
    adminUserId: adminUserId(req),
    roomSlug,
    roomId,
    status: parsed.data.status,
    notes: parsed.data.notes,
  });

  return res.json({ ok: true });
});

export default router;
