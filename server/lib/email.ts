import nodemailer from "nodemailer";
import { explainEmailProviderError, requireEmailFromAddress } from "./emailSenderConfig.js";

const isDev = process.env.NODE_ENV !== "production";
const EMAIL_NOT_CONFIGURED_MESSAGE = "Email sender is not configured. Set SENDGRID_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.";

type SendGridResponse = {
  message?: string;
  errors?: Array<{ message?: string }>;
};

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  debugLabel: string;
  debugLink: string;
};

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export interface SendPasswordResetEmailOptions {
  to: string;
  resetLink: string;
}

export interface SendMagicLoginEmailOptions {
  to: string;
  magicLink: string;
}

async function sendEmailMessage({ to, subject, text, html, debugLabel, debugLink }: EmailMessage): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const transport = apiKey ? null : createTransport();

  if (!apiKey && !transport) {
    if (isDev) {
      console.log(`[email:dev] ${debugLabel} email (provider not configured - logging instead)`);
      console.log(`[email:dev] To: ${to}`);
      console.log(`[email:dev] Subject: ${subject}`);
      console.log(`[email:dev] Link: ${debugLink}`);
      return;
    }
    throw new Error(EMAIL_NOT_CONFIGURED_MESSAGE);
  }

  const from = requireEmailFromAddress({ allowDevelopmentFallback: true });
  const replyTo = process.env.NOTIFY_REPLY_TO_EMAIL?.trim() || from;

  if (apiKey) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: from, name: "VYVA" },
        reply_to: { email: replyTo, name: "VYVA" },
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
        tracking_settings: {
          click_tracking: { enable: false, enable_text: false },
          open_tracking: { enable: false },
        },
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(async () => ({
        message: await response.text().catch(() => response.statusText),
      })) as SendGridResponse;
      const message = payload.errors?.[0]?.message ?? payload.message ?? `SendGrid request failed with ${response.status}`;
      throw new Error(explainEmailProviderError(message, from));
    }
    return;
  }

  await transport.sendMail({
    from: { name: "VYVA", address: from },
    replyTo,
    to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetEmail({ to, resetLink }: SendPasswordResetEmailOptions): Promise<void> {
  const subject = "Reset your Vyva password";
  const text = [
    "We received a request to reset the password for your Vyva account.",
    "Open this secure link to set a new password. It expires in 1 hour:",
    resetLink,
    "If you didn't request this, you can safely ignore this email. Your password will not change.",
  ].join("\n\n");
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>We received a request to reset the password for your Vyva account.</p>
      <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${resetLink}"
           style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          Reset Password
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px;">
        If you didn't request this, you can safely ignore this email. Your password will not change.
      </p>
      <p style="color:#6b7280;font-size:14px;">
        Or copy this link into your browser:<br/>
        <a href="${resetLink}">${resetLink}</a>
      </p>
    </div>
  `;

  await sendEmailMessage({ to, subject, text, html, debugLabel: "Password reset", debugLink: resetLink });
}

export async function sendMagicLoginEmail({ to, magicLink }: SendMagicLoginEmailOptions): Promise<void> {
  const subject = "Your secure VYVA sign-in link";
  const text = [
    "Use this secure link to open your VYVA account. It expires in 15 minutes:",
    magicLink,
    "If you did not request this, you can safely ignore this email.",
  ].join("\n\n");
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Sign in to VYVA</h2>
      <p>Use this secure link to open your VYVA account. It expires in <strong>15 minutes</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${magicLink}"
           style="background:#6B21A8;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block;">
          Sign in securely
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px;">
        If you did not request this, you can safely ignore this email.
      </p>
      <p style="color:#6b7280;font-size:14px;">
        Or copy this link into your browser:<br/>
        <a href="${magicLink}">${magicLink}</a>
      </p>
    </div>
  `;

  await sendEmailMessage({ to, subject, text, html, debugLabel: "Magic login", debugLink: magicLink });
}
