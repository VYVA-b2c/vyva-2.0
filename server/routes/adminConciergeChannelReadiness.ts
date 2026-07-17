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
const liveReadyStateSchema = z.enum(["on", "off"]);

const updateChannelSchema = z.object({
  admin_enabled: z.boolean().optional(),
  verified: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
  adapter_live_endpoint_url: z.string().max(2048).nullable().optional(),
  adapter_credential_reference: z.string().max(200).nullable().optional(),
  adapter_qa_target: z.string().max(2048).nullable().optional(),
}).refine((value) => (
  value.admin_enabled !== undefined
    || value.verified !== undefined
    || value.notes !== undefined
    || value.adapter_live_endpoint_url !== undefined
    || value.adapter_credential_reference !== undefined
    || value.adapter_qa_target !== undefined
), {
  message: "At least one readiness field is required.",
});

function adminUserId(req: Request): string | null {
  const user = req.user as { id?: string; email?: string } | undefined;
  return user?.id ?? user?.email ?? null;
}

function isNativeFormPost(req: Request): boolean {
  return Boolean(req.is("application/x-www-form-urlencoded") || req.is("multipart/form-data"));
}

function redirectToReadiness(
  res: Response,
  input: { channel: ConciergeProductionChannel; action: string; status: "ok" | "error"; message?: string },
) {
  const params = new URLSearchParams({
    channel: input.channel,
    action: input.action,
    status: input.status,
  });
  if (input.message) params.set("message", input.message.slice(0, 240));
  res.redirect(303, `/admin/concierge-readiness?${params.toString()}`);
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
      adapterLiveEndpointUrl: parsed.data.adapter_live_endpoint_url,
      adapterCredentialReference: parsed.data.adapter_credential_reference,
      adapterQaTarget: parsed.data.adapter_qa_target,
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
    if (isNativeFormPost(req)) {
      return redirectToReadiness(res, {
        channel: channel.data as ConciergeProductionChannel,
        action: "probe",
        status: row.probe.status === "pass" ? "ok" : "error",
        message: row.probe.status === "pass"
          ? `${row.label} verification passed.`
          : `${row.label} verification failed: ${row.probe.blocker ?? "Review channel setup."}`,
      });
    }
    res.json({ channel: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not run Concierge channel verification.";
    const status = /migration|table|not available/i.test(message) ? 500 : 400;
    if (isNativeFormPost(req)) {
      return redirectToReadiness(res, {
        channel: channel.data as ConciergeProductionChannel,
        action: "probe",
        status: "error",
        message,
      });
    }
    res.status(status).json({ error: message });
  }
});

adminConciergeChannelReadinessRouter.post("/:channel/live-ready/:state", async (req: Request, res: Response) => {
  const channel = channelSchema.safeParse(req.params.channel);
  if (!channel.success) {
    return res.status(404).json({ error: "Unknown Concierge channel." });
  }
  const state = liveReadyStateSchema.safeParse(req.params.state);
  if (!state.success) {
    return res.status(400).json({ error: "Unknown Live-ready state." });
  }

  try {
    const row = await updateAdminConciergeChannelReadiness({
      channel: channel.data as ConciergeProductionChannel,
      adminEnabled: state.data === "on",
      updatedBy: adminUserId(req),
    });
    if (isNativeFormPost(req)) {
      return redirectToReadiness(res, {
        channel: channel.data as ConciergeProductionChannel,
        action: "live-ready",
        status: "ok",
        message: `${row.label} readiness updated.`,
      });
    }
    res.json({ channel: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update Concierge channel readiness.";
    const status = /cannot|not ready|required setup/i.test(message) ? 400 : 500;
    if (isNativeFormPost(req)) {
      return redirectToReadiness(res, {
        channel: channel.data as ConciergeProductionChannel,
        action: "live-ready",
        status: "error",
        message,
      });
    }
    res.status(status).json({ error: message });
  }
});

export default adminConciergeChannelReadinessRouter;
