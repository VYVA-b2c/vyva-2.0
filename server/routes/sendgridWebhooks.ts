import { Router } from "express";
import type { Request } from "express";
import { eq, or, sql } from "drizzle-orm";
import { db } from "../db.js";
import { communicationsLog } from "../../shared/schema.js";
import { verifySendgridSignature } from "../lib/webhookVerification.js";

const router = Router();

const SIGNATURE_HEADER = "x-twilio-email-event-webhook-signature";
const TIMESTAMP_HEADER = "x-twilio-email-event-webhook-timestamp";

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

type SendgridEvent = {
  email?: string;
  event?: string;
  sg_message_id?: string;
  sg_event_id?: string;
  reason?: string;
  status?: string;
  url?: string;
  timestamp?: number;
  [key: string]: unknown;
};

/**
 * SendGrid's `sg_message_id` looks like `<base-message-id>.<recv-suffix>`.
 * The portion before the first dot matches the `X-Message-Id` we store as
 * `provider_message_id` when sending. Return both so we can match either form.
 */
function messageIdCandidates(sgMessageId: string | undefined): string[] {
  if (!sgMessageId) return [];
  const base = sgMessageId.split(".")[0];
  return base && base !== sgMessageId ? [sgMessageId, base] : [sgMessageId];
}

async function findCommunication(event: SendgridEvent) {
  const candidates = messageIdCandidates(event.sg_message_id);

  for (const candidate of candidates) {
    const [row] = await db
      .select()
      .from(communicationsLog)
      .where(or(
        eq(communicationsLog.provider_message_id, candidate),
        sql`${communicationsLog.metadata}->>'sg_message_id' = ${candidate}`,
        sql`${communicationsLog.metadata}->>'sendgrid_message_id' = ${candidate}`,
      ))
      .limit(1);
    if (row) return row;
  }
  return null;
}

function mapStatus(eventName: string | undefined): "delivered" | "failed" | "queued" | null {
  switch (eventName) {
    case "delivered":
      return "delivered";
    case "bounce":
    case "dropped":
    case "spamreport":
    case "blocked":
      return "failed";
    case "deferred":
      return "queued";
    default:
      // open, click, processed, unsubscribe, group_unsubscribe, etc.
      return null;
  }
}

async function applyEvent(event: SendgridEvent) {
  const existing = await findCommunication(event);
  if (!existing) return false;

  const status = mapStatus(event.event);
  const nowIso = new Date().toISOString();
  const eventTimeIso = typeof event.timestamp === "number"
    ? new Date(event.timestamp * 1000).toISOString()
    : nowIso;

  const baseMetadata = metadataRecord(existing.metadata);
  const engagementEvents = Array.isArray(baseMetadata.engagement_events)
    ? baseMetadata.engagement_events as unknown[]
    : [];

  const newMetadata: Record<string, unknown> = {
    ...baseMetadata,
    provider_event: event.event ?? null,
    provider_status: event.status ?? event.event ?? null,
    sendgrid_event_id: event.sg_event_id ?? null,
    sendgrid_message_id: event.sg_message_id ?? baseMetadata.sendgrid_message_id ?? null,
    sendgrid_last_event: event,
    status_callback_at: nowIso,
  };

  const patch: Partial<typeof communicationsLog.$inferInsert> = {};

  if (status === "delivered") {
    patch.status = "delivered";
    patch.sent_at = existing.sent_at ?? new Date();
    newMetadata.delivered_at = eventTimeIso;
  } else if (status === "failed") {
    patch.status = "failed";
    const errorText = event.reason || event.status || `SendGrid ${event.event}`;
    newMetadata.dispatch_error = errorText;
    newMetadata.provider_error = errorText;
  } else if (status === "queued") {
    // Only downgrade to queued/retrying if the message hasn't already finished.
    if (existing.status !== "delivered" && existing.status !== "failed") {
      patch.status = "queued";
    }
    newMetadata.provider_event = "deferred";
  } else if (event.event === "open" || event.event === "click") {
    // Engagement events: keep delivery status, append to engagement log.
    engagementEvents.push({
      event: event.event,
      timestamp: eventTimeIso,
      ...(event.url ? { url: event.url } : {}),
      ...(event.sg_event_id ? { sg_event_id: event.sg_event_id } : {}),
    });
    newMetadata.engagement_events = engagementEvents;
  }

  patch.metadata = newMetadata;

  await db
    .update(communicationsLog)
    .set(patch)
    .where(eq(communicationsLog.id, existing.id));

  return true;
}

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

router.post("/events", async (req: Request, res) => {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY?.trim();
  if (publicKey) {
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
    const timestamp = req.header(TIMESTAMP_HEADER);

    // Reject replayed payloads: SendGrid signs `timestamp + body`, so a stale
    // timestamp with a still-valid signature would otherwise be replayable.
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() - timestampSeconds * 1000) > SIGNATURE_MAX_AGE_MS) {
      console.warn("[sendgrid-webhook] rejected request with stale or missing timestamp");
      return res.sendStatus(403);
    }

    const valid = verifySendgridSignature({
      publicKey,
      signature: req.header(SIGNATURE_HEADER),
      timestamp,
      rawBody,
    });
    if (!valid) {
      console.warn("[sendgrid-webhook] rejected request with invalid signature");
      return res.sendStatus(403);
    }
  } else {
    console.warn("[sendgrid-webhook] SENDGRID_WEBHOOK_PUBLIC_KEY not configured — accepting events without signature verification");
  }

  const events: SendgridEvent[] = Array.isArray(req.body) ? req.body : [];

  // Process before acknowledging so a crash/restart doesn't silently drop
  // updates. Per-event failures are isolated; a total failure returns 500 so
  // SendGrid retries the batch.
  try {
    for (const event of events) {
      try {
        await applyEvent(event);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[sendgrid-webhook] failed to process event ${event.sg_event_id ?? "(no id)"}: ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sendgrid-webhook] batch processing failed: ${message}`);
    return res.sendStatus(500);
  }

  return res.sendStatus(200);
});

export default router;
