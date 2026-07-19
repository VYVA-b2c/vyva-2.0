import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  listAdminProviderDirectory,
  parseAdminProviderUpdate,
  updateAdminProviderDirectoryItem,
} from "../services/adminProviderDirectory.js";

const adminProviderDirectoryRouter = Router();

const providerIndexSchema = z.coerce.number().int().min(0);

adminProviderDirectoryRouter.get("/", async (_req: Request, res: Response) => {
  try {
    return res.json(await listAdminProviderDirectory());
  } catch (error) {
    console.error("[adminProviderDirectory] list failed", error);
    return res.status(500).json({ error: "Providers could not be loaded." });
  }
});

adminProviderDirectoryRouter.patch("/:profileId/providers/:providerIndex", async (req: Request, res: Response) => {
  const providerIndex = providerIndexSchema.safeParse(req.params.providerIndex);
  if (!providerIndex.success) {
    return res.status(400).json({ error: "Provider selection is invalid." });
  }

  const patch = (() => {
    try {
      return parseAdminProviderUpdate(req.body);
    } catch {
      return null;
    }
  })();
  if (!patch) return res.status(400).json({ error: "Provider details are invalid." });

  try {
    const result = await updateAdminProviderDirectoryItem({
      profileId: req.params.profileId,
      providerIndex: providerIndex.data,
      patch,
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider could not be saved.";
    const status = /not found/i.test(message) ? 404 : 500;
    if (status === 500) console.error("[adminProviderDirectory] save failed", error);
    return res.status(status).json({ error: message });
  }
});

export default adminProviderDirectoryRouter;
