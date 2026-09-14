import { Router } from "express";
import { z } from "zod";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { requireEntitlement } from "../middleware/entitlements.js";
import {
  listConciergeTaskNotifications,
  markConciergeTaskNotificationRead,
} from "../services/conciergeTaskNotifications.js";

const router = Router();
const idSchema = z.string().uuid();

router.use(authMiddleware, requireUser, requireEntitlement("concierge"));

router.get("/", async (req, res) => {
  try {
    return res.json(await listConciergeTaskNotifications(req.user!.id));
  } catch (error) {
    console.error("[concierge/notifications] list failed", error);
    return res.status(500).json({ error: "Could not load task updates" });
  }
});

router.post("/:id/read", async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ error: "Invalid notification ID" });
  try {
    const found = await markConciergeTaskNotificationRead({ id: parsedId.data, userId: req.user!.id });
    return found ? res.json({ ok: true }) : res.status(404).json({ error: "Task update not found" });
  } catch (error) {
    console.error("[concierge/notifications] read failed", error);
    return res.status(500).json({ error: "Could not update task alert" });
  }
});

export default router;
