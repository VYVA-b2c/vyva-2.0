import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  buildAdminConciergeChannelReadinessSnapshot,
  runAdminConciergeChannelVerificationProbe,
  updateAdminConciergeChannelReadiness,
} from "../services/conciergeChannelReadiness.js";
import type { ConciergeProductionChannel } from "../../shared/conciergeChannelReadiness.js";

const adminConciergeChannelReadinessRouter = Router();

const channelSchema = z.enum(["phone_call", "email", "whatsapp", "form_application", "document_upload"]);

const updateChannelSchema = z.object({
  admin_enabled: z.boolean().optional(),
  verified: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
}).refine((value) => (
  value.admin_enabled !== undefined || value.verified !== undefined || value.notes !== undefined
), {
  message: "At least one readiness field is required.",
});

function adminUserId(req: Request): string | null {
  const user = req.user as { id?: string; email?: string } | undefined;
  return user?.id ?? user?.email ?? null;
}

adminConciergeChannelReadinessRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.json(await buildAdminConciergeChannelReadinessSnapshot());
  } catch (error) {
    console.error("[admin-concierge-channel-readiness] GET / error:", error);
    res.status(500).json({ error: "Could not load Concierge channel readiness." });
  }
});

adminConciergeChannelReadinessRouter.patch("/:channel", async (req: Request, res: Response) => {
  const channel = channelSchema.safeParse(req.params.channel);
  if (!channel.success) {
    return res.status(404).json({ error: "Unknown Concierge channel." });
  }

  const parsed = updateChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid readiness update." });
  }

  try {
    const row = await updateAdminConciergeChannelReadiness({
      channel: channel.data as ConciergeProductionChannel,
      adminEnabled: parsed.data.admin_enabled,
      verified: parsed.data.verified,
      notes: parsed.data.notes,
      updatedBy: adminUserId(req),
    });
    res.json({ channel: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update Concierge channel readiness.";
    const status = /cannot|not ready|required setup/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

adminConciergeChannelReadinessRouter.post("/:channel/probe", async (req: Request, res: Response) => {
  const channel = channelSchema.safeParse(req.params.channel);
  if (!channel.success) {
    return res.status(404).json({ error: "Unknown Concierge channel." });
  }

  try {
    const row = await runAdminConciergeChannelVerificationProbe({
      channel: channel.data as ConciergeProductionChannel,
      updatedBy: adminUserId(req),
    });
    res.json({ channel: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not run Concierge channel verification.";
    const status = /migration|table|not available/i.test(message) ? 500 : 400;
    res.status(status).json({ error: message });
  }
});

export default adminConciergeChannelReadinessRouter;
