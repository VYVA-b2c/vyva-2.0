import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { homeFastHelpOutcomeAggregate } from "../services/homeFastHelpSync.js";

const router = Router();
const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
});

router.get("/", async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Days must be between 1 and 90." });
  try {
    return res.json(await homeFastHelpOutcomeAggregate(parsed.data.days));
  } catch (error) {
    console.error("[admin-home-fast-help-outcomes] GET / failed:", error);
    return res.status(503).json({ error: "Fast Help outcome totals are temporarily unavailable." });
  }
});

export default router;
