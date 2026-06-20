import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { requireEntitlement } from "../middleware/entitlements.js";
import { resolveTransportOptions } from "../services/transportOptions.js";

const router = Router();

const pointSchema = z.object({
  address: z.string().trim().max(500).optional(),
  name: z.string().trim().max(200).optional(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
}).partial();

const transportOptionsSchema = z.object({
  pickup: pointSchema.optional(),
  destination: pointSchema.optional(),
  requestedTime: z.string().trim().max(120).optional(),
  purpose: z.enum(["medical", "errand", "social", "other"]).optional(),
  mobilityNeeds: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  language: z.string().trim().min(2).max(12).optional(),
});

router.use(authMiddleware, requireUser, requireEntitlement("concierge"));

router.post("/options", async (req: Request, res: Response) => {
  const parsed = transportOptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const userId = req.entitlement?.profileId ?? req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const result = await resolveTransportOptions(userId, parsed.data);
    return res.json(result);
  } catch (err) {
    console.error("[transport/options]", err);
    return res.status(500).json({ error: "Could not find transport options" });
  }
});

export default router;
