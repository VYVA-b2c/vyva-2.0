import { Resend } from "resend";
import { z } from "zod";
import type { ConciergeInboundProviderEmail } from "./conciergeInboundReplies.js";

const receivedEventSchema = z.object({
  type: z.literal("email.received"),
  created_at: z.string(),
  data: z.object({
    email_id: z.string().min(1),
    created_at: z.string().optional(),
    from: z.string().optional(),
    to: z.array(z.string()).optional().default([]),
    bcc: z.array(z.string()).optional().default([]),
    cc: z.array(z.string()).optional().default([]),
    message_id: z.string().optional(),
    subject: z.string().optional().default(""),
    attachments: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  }),
});

export type ResendInboundReceivedEvent = z.infer<typeof receivedEventSchema>;

function apiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}
function webhookSecret(): string | null {
  return process.env.CONCIERGE_EMAIL_INBOUND_WEBHOOK_SECRET?.trim()
    || process.env.RESEND_WEBHOOK_SECRET?.trim()
    || null;
}

export function resendInboundWebhookConfigured(): boolean {
  return Boolean(apiKey() && webhookSecret());
}

export function verifyResendInboundWebhook(input: {
  rawBody: string;
  webhookId: string | undefined;
  webhookTimestamp: string | undefined;
  webhookSignature: string | undefined;
}): unknown {
  const key = apiKey();
  const secret = webhookSecret();
  if (!key || !secret) throw new Error("Resend inbound webhook is not configured.");
  if (!input.webhookId || !input.webhookTimestamp || !input.webhookSignature) {
    throw new Error("Resend webhook signature headers are missing.");
  }
  return new Resend(key).webhooks.verify({
    payload: input.rawBody,
    headers: {
      id: input.webhookId,
      timestamp: input.webhookTimestamp,
      signature: input.webhookSignature,
    },
    webhookSecret: secret,
  });
}

export function parseResendInboundReceivedEvent(value: unknown): ResendInboundReceivedEvent | null {
  const parsed = receivedEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function retrieveResendReceivedEmail(
  event: ResendInboundReceivedEvent,
  webhookEventId: string | null,
): Promise<ConciergeInboundProviderEmail> {
  const key = apiKey();
  if (!key) throw new Error("Resend API key is not configured.");
  const { data, error } = await new Resend(key).emails.receiving.get(event.data.email_id, { html_format: "cid" });
  if (error || !data) {
    const message = error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Resend received email could not be retrieved.";
    throw new Error(message);
  }
  return {
    channel: "email",
    providerEventId: data.id || event.data.email_id,
    webhookEventId,
    senderEmail: data.from || event.data.from || "",
    recipientEmails: data.to?.length ? data.to : event.data.to,
    subject: data.subject || event.data.subject,
    text: data.text,
    html: data.html,
    receivedAt: data.created_at || event.data.created_at || event.created_at,
    providerMetadata: {
      message_id: data.message_id || event.data.message_id || null,
      headers: data.headers ?? {},
      reply_to: data.reply_to ?? [],
      cc: data.cc ?? [],
      attachments: (data.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        content_type: attachment.content_type,
        size: attachment.size,
      })),
    },
  };
}
