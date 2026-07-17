import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { requireEntitlement } from "../middleware/entitlements.js";
import { withConciergeExecutionTask } from "../../shared/conciergeActionExecution.js";
import {
  CONCIERGE_USE_CASES,
  cancelPendingConciergeAction,
  confirmPendingConciergeActionReview,
  completePendingConciergeAction,
  startPendingConciergeAction,
  triggerConciergeAction,
  updatePendingConciergeActionDetails,
  type ConciergeUseCase,
} from "../services/conciergeActions.js";

const router = Router();

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";

function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

const triggerSchema = z.object({
  use_case: z.enum(CONCIERGE_USE_CASES),
  provider_id: z.string().uuid().optional().nullable(),
  provider_name: z.string().trim().min(1).max(200).optional().nullable(),
  provider_phone: z.string().trim().min(3).max(50).optional().nullable(),
  found_externally: z.boolean().optional().default(false),
  action_summary: z.string().trim().min(1).max(500),
  action_payload: z.record(z.string(), z.unknown()).default({}),
  language: z.string().trim().min(2).max(12).optional(),
  trigger_source: z
    .enum(["user_request", "agent_confirmed", "automation", "no_contact_nudge", "manual"])
    .optional()
    .default("user_request"),
  auto_start: z.boolean().optional().default(true),
});

const completeSchema = z.object({
  outcome_summary: z.string().trim().max(500).optional().nullable(),
  outcome_payload: z.record(z.string(), z.unknown()).optional().default({}),
});

const detailUpdateSchema = z.object({
  action_payload: z.record(z.string(), z.unknown()).default({}),
  answer_key: z.string().trim().min(1).max(120).optional().nullable(),
  answer_value: z.string().trim().max(1000).optional().nullable(),
});

router.use(authMiddleware, requireUser, requireEntitlement("concierge"));

router.post("/trigger", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = triggerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await triggerConciergeAction({
      userId,
      useCase: parsed.data.use_case,
      providerId: parsed.data.provider_id,
      providerName: parsed.data.provider_name,
      providerPhone: parsed.data.provider_phone,
      foundExternally: parsed.data.found_externally,
      actionSummary: parsed.data.action_summary,
      actionPayload: parsed.data.action_payload,
      language: parsed.data.language,
      triggerSource: parsed.data.trigger_source,
      autoStart: parsed.data.auto_start,
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error("[concierge/actions POST /trigger]", err);
    return res.status(500).json({ error: (err as Error).message || "Failed to trigger concierge action" });
  }
});

router.patch("/:id/details", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = detailUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await updatePendingConciergeActionDetails(req.params.id, userId, {
      actionPayload: parsed.data.action_payload,
      answerKey: parsed.data.answer_key,
      answerValue: parsed.data.answer_value,
    });
    return res.json(result);
  } catch (err) {
    console.error("[concierge/actions PATCH /:id/details]", err);
    return res.status(400).json({ error: (err as Error).message || "Failed to update concierge action details" });
  }
});

router.post("/:id/confirm", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const result = await startPendingConciergeAction(req.params.id, userId);
    return res.json(result);
  } catch (err) {
    console.error("[concierge/actions POST /:id/confirm]", err);
    return res.status(400).json({ error: (err as Error).message || "Failed to confirm concierge action" });
  }
});

router.post("/:id/review-confirm", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const result = await confirmPendingConciergeActionReview(req.params.id, userId);
    return res.json(result);
  } catch (err) {
    console.error("[concierge/actions POST /:id/review-confirm]", err);
    return res.status(400).json({ error: (err as Error).message || "Failed to confirm concierge action" });
  }
});

router.post("/:id/cancel", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    await cancelPendingConciergeAction(req.params.id, userId);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[concierge/actions POST /:id/cancel]", err);
    return res.status(400).json({ error: (err as Error).message || "Failed to cancel concierge action" });
  }
});

router.post("/:id/complete", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await completePendingConciergeAction(req.params.id, userId, {
      outcomeSummary: parsed.data.outcome_summary,
      outcomePayload: parsed.data.outcome_payload,
    });
    return res.json(result);
  } catch (err) {
    console.error("[concierge/actions POST /:id/complete]", err);
    return res.status(400).json({ error: (err as Error).message || "Failed to complete concierge action" });
  }
});

router.get("/pending", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const result = await pool.query(
      `
        select
          id,
          use_case,
          provider_name,
          provider_phone,
          action_summary,
          action_payload,
          status,
          language,
          confirmed_at,
          expires_at,
          updated_at
        from concierge_pending
        where user_id = $1
          and status in ('pending', 'calling')
        order by confirmed_at desc nulls last, expires_at desc nulls last
        limit 20
      `,
      [userId],
    );

    return res.json({
      items: result.rows.map((row) => ({
        ...row,
        action_payload: withConciergeExecutionTask({
          useCase: row.use_case,
          payload: row.action_payload,
          providerName: row.provider_name,
          providerPhone: row.provider_phone,
          summary: row.action_summary,
          pendingStatus: row.status,
        }),
      })),
    });
  } catch (err) {
    console.error("[concierge/actions GET /pending]", err);
    return res.status(500).json({ error: "Failed to fetch pending concierge actions" });
  }
});

router.get("/sessions", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const result = await pool.query(
      `
        select
          id,
          pending_id,
          use_case,
          provider_name,
          outcome,
          outcome_payload,
          outcome_summary,
          completed_at
        from concierge_sessions
        where user_id = $1
        order by completed_at desc nulls last
        limit 20
      `,
      [userId],
    );

    return res.json({ items: result.rows });
  } catch (err) {
    console.error("[concierge/actions GET /sessions]", err);
    return res.status(500).json({ error: "Failed to fetch concierge sessions" });
  }
});

export default router;
