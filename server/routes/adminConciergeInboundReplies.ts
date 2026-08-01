import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  ignoreConciergeInboundReply,
  linkConciergeInboundReply,
  listConciergeInboundReplyReviewItems,
} from "../services/conciergeInboundReplies.js";

const adminConciergeInboundRepliesRouter = Router();

const messageIdSchema = z.string().uuid();
const reviewActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    pending_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("ignore"),
  }),
]);

function reviewer(req: Request): string {
  return req.user?.email?.trim() || req.user?.id?.trim() || "admin";
}

adminConciergeInboundRepliesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.json({ items: await listConciergeInboundReplyReviewItems() });
  } catch (error) {
    console.error("[admin-concierge-inbound-replies] GET / error:", error);
    res.status(500).json({ error: "Email replies could not be loaded." });
  }
});

adminConciergeInboundRepliesRouter.patch("/:messageId", async (req: Request, res: Response) => {
  const messageId = messageIdSchema.safeParse(req.params.messageId);
  const action = reviewActionSchema.safeParse(req.body);
  if (!messageId.success || !action.success) {
    return res.status(400).json({ error: "Choose a valid reply and action." });
  }

  try {
    const updated = action.data.action === "link"
      ? await linkConciergeInboundReply({
          messageId: messageId.data,
          pendingId: action.data.pending_id,
          reviewedBy: reviewer(req),
        })
      : await ignoreConciergeInboundReply(messageId.data, reviewer(req));

    if (!updated) {
      return res.status(409).json({ error: "This reply was already handled or the task is no longer open." });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[admin-concierge-inbound-replies] PATCH /:messageId error:", error);
    res.status(500).json({ error: "Email reply could not be updated." });
  }
});

export default adminConciergeInboundRepliesRouter;
