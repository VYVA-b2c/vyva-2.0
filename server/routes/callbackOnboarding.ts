import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createCallbackOnboardingRequest,
  publicBaseUrl,
} from "../services/callbackOnboarding.js";

const router = Router();

const callbackRequestSchema = z.object({
  first_name: z.string().trim().min(2),
  last_name: z.string().trim().min(2),
  country_code: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  preferred_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z.string().trim().regex(/^\d{1,2}:\d{2}$/),
  preferred_period: z.enum(["AM", "PM"]),
  callback_for: z.enum(["me", "caregiver"]),
  language: z.string().trim().optional().nullable(),
  timezone: z.string().trim().optional().nullable(),
});

router.post("/request", async (req: Request, res: Response) => {
  const parsed = callbackRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid callback request",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await createCallbackOnboardingRequest(parsed.data);
    return res.status(201).json({
      ok: true,
      intake_id: result.intake.id,
      scheduled_for: result.scheduledFor.toISOString(),
      message: "Callback scheduled",
      base_url: publicBaseUrl(req),
    });
  } catch (error) {
    console.error("[callback onboarding] request failed", error);
    return res.status(500).json({ error: "Unable to schedule callback" });
  }
});

export default router;
