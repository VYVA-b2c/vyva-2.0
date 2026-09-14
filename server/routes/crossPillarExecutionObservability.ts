import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { crossPillarExecutionAttemptSchema } from "../../shared/crossPillarExecutionObservability.js";
import {
  buildAdminCrossPillarExecutionSummary,
  listOwnCrossPillarExecutionAttempts,
  recordCrossPillarExecutionAttempt,
} from "../services/crossPillarExecutionObservability.js";

export const crossPillarExecutionRouter = Router();
export const adminCrossPillarExecutionRouter = Router();

crossPillarExecutionRouter.post("/attempts", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = crossPillarExecutionAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid execution attempt." });
  }
  try {
    const result = await recordCrossPillarExecutionAttempt(userId, parsed.data);
    return res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    console.error("[cross-pillar-executions] POST /attempts failed:", error);
    return res.status(503).json({ error: "Execution history is temporarily unavailable." });
  }
});

crossPillarExecutionRouter.get("/attempts", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    return res.json({ attempts: await listOwnCrossPillarExecutionAttempts(userId) });
  } catch (error) {
    console.error("[cross-pillar-executions] GET /attempts failed:", error);
    return res.status(503).json({ error: "Execution history is temporarily unavailable." });
  }
});

adminCrossPillarExecutionRouter.get("/summary", async (req: Request, res: Response) => {
  const parsed = z.coerce.number().int().min(1).max(168).safeParse(req.query.hours ?? 24);
  if (!parsed.success) return res.status(400).json({ error: "Invalid time window." });
  try {
    return res.json(await buildAdminCrossPillarExecutionSummary(parsed.data));
  } catch (error) {
    console.error("[admin-cross-pillar-executions] GET /summary failed:", error);
    return res.status(503).json({ error: "Execution summary is temporarily unavailable." });
  }
});
