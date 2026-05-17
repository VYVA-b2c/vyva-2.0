import { and, asc, eq, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db } from "../db.js";
import { communicationsLog } from "../../shared/schema.js";
import { queueDueConsentCalls } from "./lifecycle.js";

type Communication = typeof communicationsLog.$inferSelect;
type DispatchStatus = "queued" | "sending" | "sent" | "failed";

type DispatchResult = {
  id: string;
  channel: string;
  recipient: string;
  status: DispatchStatus;
  provider_message_id?: string | null;
  error?: string;
};

type TwilioMessageResponse = {
  sid?: string;
  status?: string;
  error_message?: string;
  message?: string;
};

type SendGridResponse = {
  message?: string;
  errors?: Array<{ message?: string }>;
};

function publicBaseUrl() {
  return process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? "5000"}`;
}

function twilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return {
    accountSid,
    authHeader: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
  };
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function withWhatsappPrefix(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twilioRequestUrl(accountSid: string, resource: "Messages" | "Calls") {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${resource}.json`;
}

async function postTwilioForm(resource: "Messages" | "Calls", params: URLSearchParams): Promise<TwilioMessageResponse> {
  const credentials = twilioCredentials();
  if (!credentials) throw new Error("Twilio credentials are not configured");

  const response = await fetch(twilioRequestUrl(credentials.accountSid, resource), {
    method: "POST",
    headers: {
      Authorization: credentials.authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) })) as TwilioMessageResponse;

  if (!response.ok) {
    throw new Error(payload.message ?? payload.error_message ?? `Twilio ${resource} request failed with ${response.status}`);
  }

  return payload;
}

async function sendSms(item: Communication) {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_SMS_FROM_NUMBER ?? process.env.TWILIO_FROM_NUMBER;
  if (!messagingServiceSid && !from) throw new Error("SMS sender is not configured");

  const params = new URLSearchParams({
    To: item.recipient,
    Body: item.body ?? "",
    StatusCallback: `${publicBaseUrl()}/api/webhooks/twilio/message-status`,
  });
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else if (from) params.set("From", from);

  return postTwilioForm("Messages", params);
}

async function sendWhatsapp(item: Communication) {
  const from = process.env.TWILIO_WHATSAPP_FROM ?? process.env.TWILIO_WHATSAPP_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID;
  if (!messagingServiceSid && !from) throw new Error("WhatsApp sender is not configured");

  const params = new URLSearchParams({
    To: withWhatsappPrefix(item.recipient),
    Body: item.body ?? "",
    StatusCallback: `${publicBaseUrl()}/api/webhooks/twilio/message-status`,
  });
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else if (from) params.set("From", withWhatsappPrefix(from));

  return postTwilioForm("Messages", params);
}

async function sendEmail(item: Communication) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const metadata = metadataRecord(item.metadata);
  const subject = typeof metadata.subject === "string" && metadata.subject.trim()
    ? metadata.subject.trim()
    : "Join VYVA";
  const from = process.env.NOTIFY_FROM_EMAIL ?? process.env.SMTP_FROM ?? "noreply@vyva.ai";

  if (!apiKey) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error("Email sender is not configured. Set SENDGRID_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.");
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transport.sendMail({
      from,
      to: item.recipient,
      subject,
      text: item.body ?? "",
    });
    return { sid: null, status: "sent" };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: item.recipient }], subject }],
      from: { email: from },
      content: [{ type: "text/plain", value: item.body ?? "" }],
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) })) as SendGridResponse;
    throw new Error(payload.errors?.[0]?.message ?? payload.message ?? `SendGrid request failed with ${response.status}`);
  }

  return { sid: null, status: "sent" };
}

async function sendVoiceCall(item: Communication) {
  const from = process.env.TWILIO_VOICE_FROM_NUMBER ?? process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error("Voice sender is not configured");

  const metadata = metadataRecord(item.metadata);
  const twiml = typeof metadata.twiml === "string"
    ? metadata.twiml
    : `<Response><Say>${xmlEscape(item.body ?? "Hello from VYVA.")}</Say></Response>`;
  const url = typeof metadata.voice_url === "string" ? metadata.voice_url : process.env.TWILIO_CONSENT_CALL_URL;

  const params = new URLSearchParams({
    To: item.recipient,
    From: from,
    StatusCallback: `${publicBaseUrl()}/api/webhooks/twilio/voice-status`,
    StatusCallbackMethod: "POST",
  });
  if (url) params.set("Url", url);
  else params.set("Twiml", twiml);

  return postTwilioForm("Calls", params);
}

async function markCommunication(id: string, patch: Partial<typeof communicationsLog.$inferInsert>) {
  const [updated] = await db
    .update(communicationsLog)
    .set(patch)
    .where(eq(communicationsLog.id, id))
    .returning();
  return updated;
}

async function dispatchCommunication(item: Communication): Promise<DispatchResult> {
  try {
    await markCommunication(item.id, {
      status: "sending",
      metadata: {
        ...metadataRecord(item.metadata),
        dispatch_started_at: new Date().toISOString(),
      },
    });

    const channel = item.channel.toLowerCase();
    const response = channel === "whatsapp"
      ? await sendWhatsapp(item)
      : channel === "voice"
        ? await sendVoiceCall(item)
        : channel === "email"
          ? await sendEmail(item)
          : await sendSms(item);

    await markCommunication(item.id, {
      status: "sent",
      provider_message_id: response.sid ?? null,
      sent_at: new Date(),
      metadata: {
        ...metadataRecord(item.metadata),
        provider_status: response.status ?? null,
        dispatch_completed_at: new Date().toISOString(),
      },
    });

    return {
      id: item.id,
      channel: item.channel,
      recipient: item.recipient,
      status: "sent",
      provider_message_id: response.sid ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markCommunication(item.id, {
      status: "failed",
      metadata: {
        ...metadataRecord(item.metadata),
        dispatch_failed_at: new Date().toISOString(),
        dispatch_error: message,
      },
    });

    return {
      id: item.id,
      channel: item.channel,
      recipient: item.recipient,
      status: "failed",
      error: message,
    };
  }
}

export async function dispatchCommunicationsByIds(ids: string[]): Promise<{ processed: number; results: DispatchResult[] }> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return { processed: 0, results: [] };

  const queued = await db
    .select()
    .from(communicationsLog)
    .where(and(
      inArray(communicationsLog.id, uniqueIds),
      eq(communicationsLog.status, "queued"),
      inArray(communicationsLog.channel, ["sms", "whatsapp", "voice", "email"]),
    ));

  const byId = new Map(queued.map((item) => [item.id, item]));
  const results = [];
  for (const id of uniqueIds) {
    const item = byId.get(id);
    if (item) results.push(await dispatchCommunication(item));
  }

  return { processed: results.length, results };
}

export async function dispatchQueuedCommunications(limit = 25): Promise<{ processed: number; results: DispatchResult[] }> {
  await queueDueConsentCalls(limit);

  const queued = await db
    .select()
    .from(communicationsLog)
    .where(and(
      eq(communicationsLog.status, "queued"),
      inArray(communicationsLog.channel, ["sms", "whatsapp", "voice", "email"]),
    ))
    .orderBy(asc(communicationsLog.created_at))
    .limit(limit);

  const results = [];
  for (const item of queued) {
    results.push(await dispatchCommunication(item));
  }

  return { processed: results.length, results };
}

export function startCommunicationDispatcher() {
  const intervalMs = Number(process.env.COMMUNICATION_DISPATCH_INTERVAL_MS ?? 0);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;

  const batchSize = Number(process.env.COMMUNICATION_DISPATCH_BATCH_SIZE ?? 25);
  const timer = setInterval(() => {
    dispatchQueuedCommunications(batchSize).catch((error) => {
      console.error("[communications] dispatcher run failed", error);
    });
  }, intervalMs);
  timer.unref?.();
  return timer;
}
