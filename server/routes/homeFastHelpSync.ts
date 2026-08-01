import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { homeFastHelpSyncRequestSchema } from "../../shared/homeFastHelpSync.js";
import {
  homeFastHelpSyncAvailableForUser,
  listHomeFastHelpJourneys,
  syncHomeFastHelpJourneys,
} from "../services/homeFastHelpSync.js";

const router = Router();
const uuidSchema = z.string().uuid();

async function syncAvailable(userId: string) {
  if (!uuidSchema.safeParse(userId).success) return false;
  return homeFastHelpSyncAvailableForUser(userId);
}

function unavailableResponse() {
  return { syncAvailable: false, syncedAt: new Date().toISOString(), journeys: [] };
}

router.get("/journeys", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    if (!await syncAvailable(userId)) return res.json(unavailableResponse());
    return res.json({
      syncAvailable: true,
      syncedAt: new Date().toISOString(),
      journeys: await listHomeFastHelpJourneys(userId),
    });
  } catch (error) {
    console.error("[home-fast-help-sync] GET /journeys failed:", error);
    return res.status(503).json({ error: "Fast Help sync is temporarily unavailable." });
  }
});

router.post("/sync", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = homeFastHelpSyncRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Fast Help sync payload." });
  }
  try {
    if (!await syncAvailable(userId)) return res.json(unavailableResponse());
    return res.json({
      syncAvailable: true,
      syncedAt: new Date().toISOString(),
      journeys: await syncHomeFastHelpJourneys(userId, parsed.data.journeys, parsed.data.impressions),
    });
  } catch (error) {
    console.error("[home-fast-help-sync] POST /sync failed:", error);
    return res.status(503).json({ error: "Fast Help sync is temporarily unavailable." });
  }
});

export default router;

