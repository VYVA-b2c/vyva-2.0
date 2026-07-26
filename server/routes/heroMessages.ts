import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { heroMessageEvents, heroMessages } from "../../shared/schema.js";

const heroMessagesRouter = Router();
const heroEventSchema = z.object({
  message_id: z.string().min(1).max(128),
  surface: z.string().min(1).max(48),
  language: z.enum(["es", "en", "de", "fr", "it", "pt"]).default("es"),
  event_type: z.enum(["impression", "cta_click", "dismiss", "fallback"]),
  reason: z.enum(["safety", "scheduled_event", "continuation", "time_of_day", "evergreen"]),
  source: z.enum(["managed", "built_in", "fallback"]),
  route: z.string().max(256).optional().default(""),
}).strict();

function rowToDefinition(row: typeof heroMessages.$inferSelect) {
  return {
    id: row.message_id,
    surface: row.surface,
    reason: row.reason,
    priority: row.priority,
    cooldownHours: row.cooldown_hours,
    periods: row.periods ?? [],
    safetyLevels: row.safety_levels ?? [],
    eventTypes: row.event_types ?? [],
    activityTypes: row.activity_types ?? [],
    copy: row.copy ?? {},
  };
}

heroMessagesRouter.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(heroMessages)
      .where(eq(heroMessages.is_enabled, true))
      .orderBy(desc(heroMessages.priority));

    return res.json({ messages: rows.map(rowToDefinition), source: "admin" });
  } catch {
    return res.json({ messages: [], source: "built_in_fallback" });
  }
});

heroMessagesRouter.post("/events", async (req, res) => {
  const parsed = heroEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await db.insert(heroMessageEvents).values(parsed.data);
    return res.status(204).send();
  } catch {
    return res.status(202).json({ recorded: false });
  }
});

export default heroMessagesRouter;
