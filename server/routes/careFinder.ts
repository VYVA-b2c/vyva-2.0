import { Router } from "express";
import { careFinderSearchRequestSchema } from "../../shared/careFinder/search.js";
import { searchCareProviders } from "../services/careFinderSearch.js";

const router = Router();

router.post("/search", async (req, res) => {
  const parsed = careFinderSearchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request" });
  }
  // Never guess where someone lives: searching the wrong town silently is
  // worse than asking.
  if (!parsed.data.location) {
    return res.status(400).json({ error: "location_required" });
  }

  try {
    return res.json(await searchCareProviders(parsed.data));
  } catch (err) {
    console.error("[care-finder/search]", err);
    return res.status(500).json({ error: "search_failed" });
  }
});

export default router;
