import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { requireEntitlement } from "../middleware/entitlements.js";
import {
  createConciergeTaskDraftSchema,
  updateConciergeTaskDraftSchema,
} from "../../shared/conciergeTaskDrafts.js";
import {
  ConciergeTaskUnavailableError,
  completeConciergeTaskDraft,
  createConciergeTaskDraft,
  deleteConciergeTaskDraft,
  getConciergeTaskDraft,
  listActiveConciergeTaskDrafts,
  updateConciergeTaskDraft,
} from "../services/conciergeTaskDrafts.js";

const router = Router();
const idSchema = z.string().uuid();

router.use(authMiddleware, requireUser, requireEntitlement("concierge"));

function userId(req: Request): string {
  return req.user!.id;
}

function taskError(res: Response, error: unknown) {
  if (error instanceof ConciergeTaskUnavailableError) {
    return res.status(410).json({ error: "Task is no longer active", status: error.status });
  }
  if (error instanceof Error && error.message === "Concierge task not found") {
    return res.status(404).json({ error: error.message });
  }
  console.error("[concierge/tasks]", error);
  return res.status(500).json({ error: "Could not save Concierge task" });
}

router.get("/", async (req, res) => {
  try {
    return res.json({ items: await listActiveConciergeTaskDrafts(userId(req)) });
  } catch (error) {
    return taskError(res, error);
  }
});

router.post("/", async (req, res) => {
  const parsed = createConciergeTaskDraftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await createConciergeTaskDraft({
      userId: userId(req),
      entry: parsed.data.entry,
      language: parsed.data.language ?? "es",
    });
    return res.status(201).json({ task });
  } catch (error) {
    return taskError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ error: "Invalid task ID" });
  try {
    const task = await getConciergeTaskDraft(parsedId.data, userId(req));
    return task ? res.json({ task }) : res.status(404).json({ error: "Concierge task not found" });
  } catch (error) {
    return taskError(res, error);
  }
});

router.patch("/:id", async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id);
  const parsed = updateConciergeTaskDraftSchema.safeParse(req.body);
  if (!parsedId.success || !parsed.success) return res.status(400).json({ error: "Invalid task update" });
  try {
    const task = await updateConciergeTaskDraft({
      id: parsedId.data,
      userId: userId(req),
      progress: parsed.data.progress,
      stage: parsed.data.stage,
    });
    return res.json({ task });
  } catch (error) {
    return taskError(res, error);
  }
});

router.post("/:id/complete", async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ error: "Invalid task ID" });
  try {
    return res.json({ task: await completeConciergeTaskDraft(parsedId.data, userId(req)) });
  } catch (error) {
    return taskError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ error: "Invalid task ID" });
  try {
    return res.json({ task: await deleteConciergeTaskDraft(parsedId.data, userId(req)) });
  } catch (error) {
    return taskError(res, error);
  }
});

export default router;
