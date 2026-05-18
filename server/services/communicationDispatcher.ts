import { and, asc, eq, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { join } from "path";
import { db } from "../db.js";
import { communicationsLog } from "../../shared/schema.js";
import { explainEmailProviderError, requireEmailFromAddress } from "../lib/emailSenderConfig.js";
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

type EmailPayload = {
  subject: string;
  text: string;
  html?: string;
  disableTracking?: boolean;
  attachments?: EmailAttachment[];
};

type EmailAttachment = {
  content: string;
  filename: string;
  type: string;
  disposition: "inline" | "attachment";
  content_id: string;
};

const SIGNUP_EMAIL_LOGO_CID = "vyva-logo";
let cachedSignupEmailLogo: EmailAttachment | null | undefined;

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

function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphHtml(value: string) {
  return htmlEscape(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function signupEmailLogoAttachment() {
  if (cachedSignupEmailLogo !== undefined) return cachedSignupEmailLogo;
  try {
    const logoPath = join(process.cwd(), "public", "assets", "vyva", "vyva-logo-english.png");
    cachedSignupEmailLogo = {
      content: readFileSync(logoPath).toString("base64"),
      filename: "vyva-logo.png",
      type: "image/png",
      disposition: "inline",
      content_id: SIGNUP_EMAIL_LOGO_CID,
    };
  } catch (err) {
    console.warn("[communications] signup invite logo could not be attached", err);
    cachedSignupEmailLogo = null;
  }
  return cachedSignupEmailLogo;
}

function introFromLegacyBody(body: string | null) {
  if (!body) return null;
  const [intro] = body.split(/\n\s*\nSign up here:/i);
  return intro?.trim() || null;
}

function buildSignupInviteEmail(metadata: Record<string, unknown>, fallbackBody: string | null): EmailPayload {
  const loginUrl = metadataString(metadata, "url") ?? `${publicBaseUrl()}/login`;
  const intro = metadataString(metadata, "intro") ?? introFromLegacyBody(fallbackBody) ?? "You are invited to create your VYVA account.";
  const subject = metadataString(metadata, "subject") ?? "Create your VYVA account";
  const logoAttachment = signupEmailLogoAttachment();
  const logoSrc = logoAttachment ? `cid:${SIGNUP_EMAIL_LOGO_CID}` : `${publicBaseUrl().replace(/\/$/, "")}/assets/vyva/vyva-logo-english.png`;
  const text = [
    intro,
    "Create your secure VYVA account to manage health, support, reminders, and daily care in one place.",
    `Start here: ${loginUrl}`,
    "If you were not expecting this invitation, you can ignore this email.",
  ].join("\n\n");
  const safeUrl = htmlEscape(loginUrl);
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${htmlEscape(subject)}</title>
  </head>
  <body style="margin:0;background:#f7f1e9;color:#2f2135;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f1e9;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffaf4;border:1px solid #eaded2;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 12px;">
                <img src="${htmlEscape(logoSrc)}" width="112" alt="VYVA" style="display:block;width:112px;max-width:112px;height:auto;border:0;outline:none;text-decoration:none;">
                <h1 style="margin:26px 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.05;font-weight:500;color:#2f143f;">Create your VYVA account</h1>
                <div style="font-size:17px;line-height:1.6;color:#6f5f5a;">${paragraphHtml(intro)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px;">
                <p style="margin:0;font-size:16px;line-height:1.6;color:#6f5f5a;">Your account helps keep health, support, reminders, and daily care in one private place.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 18px;">
                <a href="${safeUrl}" style="display:block;background:#6f22c9;color:#ffffff;text-decoration:none;text-align:center;border-radius:999px;padding:17px 22px;font-size:18px;font-weight:700;">Create account</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8b7b74;">If the button does not work, copy and paste this link into your browser:<br><a href="${safeUrl}" style="color:#6f22c9;word-break:break-all;">${safeUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #eaded2;padding:18px 32px 26px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8b7b74;">You received this invitation because someone asked VYVA to send you a secure signup link. If you were not expecting it, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject,
    text,
    html,
    disableTracking: true,
    ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
  };
}

function buildEmailPayload(item: Communication): EmailPayload {
  const metadata = metadataRecord(item.metadata);
  const subject = metadataString(metadata, "subject") ?? "Join VYVA";

  if (item.purpose === "share_signup_form") {
    return buildSignupInviteEmail(metadata, item.body);
  }

  return {
    subject,
    text: item.body ?? "",
  };
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
  const email = buildEmailPayload(item);
  const from = requireEmailFromAddress({ allowDevelopmentFallback: true });
  const replyTo = process.env.NOTIFY_REPLY_TO_EMAIL?.trim() || from;

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
      from: { name: "VYVA", address: from },
      replyTo,
      to: item.recipient,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.attachments?.length ? {
        attachments: email.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, "base64"),
          contentType: attachment.type,
          cid: attachment.content_id,
        })),
      } : {}),
    });
    return { sid: null, status: "sent" };
  }

  const content = [
    { type: "text/plain", value: email.text },
    ...(email.html ? [{ type: "text/html", value: email.html }] : []),
  ];

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: item.recipient }], subject: email.subject }],
      from: { email: from, name: "VYVA" },
      reply_to: { email: replyTo, name: "VYVA" },
      content,
      ...(email.attachments?.length ? { attachments: email.attachments } : {}),
      ...(email.disableTracking ? {
        tracking_settings: {
          click_tracking: { enable: false, enable_text: false },
          open_tracking: { enable: false },
        },
      } : {}),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) })) as SendGridResponse;
    const message = payload.errors?.[0]?.message ?? payload.message ?? `SendGrid request failed with ${response.status}`;
    throw new Error(explainEmailProviderError(message, from));
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
