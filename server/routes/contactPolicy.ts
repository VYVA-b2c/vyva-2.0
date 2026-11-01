import { Router } from "express";

import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { and, eq } from "drizzle-orm";

import { db } from "../db.js";

import { scheduledInteractions } from "../../shared/schema.js";

import { getContactPolicyForUser } from "../lib/contactPolicyStore.js";

import {
  effectiveDailyCallLimit,
  checkinNoAnswerPlan,
} from "../../shared/contactPolicy.js";

import { countOutboundCallsToday } from "../lib/outboundCallBudget.js";

import { recordOutboundDecision } from "../lib/contactPolicyDecisionStore.js";

import { reportCheckinNoAnswer } from "../services/dailyCheckinMonitor.js";

export const contactPolicyRouter = Router();

contactPolicyRouter.use((req, res, next) => {
  const expected = process.env.VYVA_TELEPHONY_POLICY_SECRET;
  if (!expected)
    return res
      .status(503)
      .json({ error: "Telephony contact policy is not configured" });
  const received = req.header("x-vyva-telephony-secret");
  if (
    !received ||
    Buffer.byteLength(received) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  )
    return res.status(401).json({ error: "Unauthorized" });
  next();
});

const decisionBody = z
  .object({
    purpose: z.enum([
      "checkin",
      "checkin_retry",
      "medication",
      "brain_coach",
      "preventive",
      "other",
      "sos",
    ]),
    requested_channel: z.enum(["voice_outbound", "whatsapp_outbound"]),
    local_time: z
      .string()
      .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    urgent: z.boolean().optional(),
    source_ref: z.string().max(200).optional(),
  })
  .strict();

contactPolicyRouter.get("/users/:userId", async (req, res) => {
  try {
    const context = await getContactPolicyForUser(req.params.userId);
    const [schedule] = await db
      .select()
      .from(scheduledInteractions)
      .where(
        and(
          eq(scheduledInteractions.user_id, req.params.userId),
          eq(scheduledInteractions.interaction_type, "CHECK_IN"),
          eq(scheduledInteractions.status, "ACTIVE"),
          eq(scheduledInteractions.is_paused, false),
        ),
      )
      .limit(1);
    return res.json({
      ...context,
      effective_daily_call_limit: effectiveDailyCallLimit(
        context.policy,
        context.residentCallOverride,
      ),
      calls_today: await countOutboundCallsToday(
        req.params.userId,
        context.timezone,
      ),
      checkin_plan_for_today: schedule?.times_of_day?.[0]
        ? checkinNoAnswerPlan(schedule.times_of_day[0], context.policy)
        : null,
    });
  } catch (e) {
    return res
      .status(
        e instanceof Error && e.message === "Resident not found" ? 404 : 500,
      )
      .json({ error: "Contact policy unavailable" });
  }
});

contactPolicyRouter.post(
  "/users/:userId/outbound-decision",
  async (req, res) => {
    const parsed = decisionBody.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.json(
        await recordOutboundDecision(String(req.params.userId), {
          ...parsed.data,
          purpose: parsed.data.purpose!,
          requested_channel: parsed.data.requested_channel!,
        }),
      );
    } catch (e) {
      return res
        .status(
          e instanceof Error && e.message === "Resident not found" ? 404 : 500,
        )
        .json({ error: "Outbound decision unavailable" });
    }
  },
);

contactPolicyRouter.post(
  "/users/:userId/checkin-no-answer",
  async (req, res) => {
    const parsed = z
      .object({
        scheduled_for: z.string().datetime({ offset: true }),
        attempts: z.number().int().min(1).max(6),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.json(
        await reportCheckinNoAnswer(String(req.params.userId), {
          scheduled_for: parsed.data.scheduled_for!,
          attempts: parsed.data.attempts!,
        }),
      );
    } catch (e) {
      return res
        .status(
          e instanceof Error && e.message === "Resident not found" ? 404 : 409,
        )
        .json({
          error:
            e instanceof Error ? e.message : "No-answer report unavailable",
        });
    }
  },
);

export default contactPolicyRouter;
