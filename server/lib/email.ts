import { explainEmailProviderError, requireEmailFromAddress } from "./emailSenderConfig.js";

const isDev = process.env.NODE_ENV !== "production";
const EMAIL_NOT_CONFIGURED_MESSAGE = "Resend email sender is not configured. Set RESEND_API_KEY.";
const VYVA_WEBSITE_URL = "https://vyva.life";
const VYVA_PRIVACY_URL = "https://vyva.life/privacypolicy";

type ResendResponse = {
  id?: string;
  name?: string;
  message?: string;
};

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  debugLabel: string;
  debugLink: string;
  allowDevelopmentLog?: boolean;
};

export interface SendPasswordResetEmailOptions {
  to: string;
  resetLink: string;
  allowDevelopmentLog?: boolean;
}

export interface SendMagicLoginEmailOptions {
  to: string;
  magicLink: string;
  allowDevelopmentLog?: boolean;
}

type BrandedActionEmailOptions = {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  detail: string;
  safetyNote: string;
};

function defaultPublicBaseUrl() {
  return (process.env.APP_URL?.trim() || "https://v2.vyva.life").replace(/\/+$/, "");
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandedActionEmailHtml({
  preheader,
  eyebrow,
  title,
  intro,
  actionLabel,
  actionUrl,
  detail,
  safetyNote,
}: BrandedActionEmailOptions) {
  const safeActionUrl = htmlEscape(actionUrl);
  const logoSrc = `${defaultPublicBaseUrl()}/assets/vyva/vyva-logo-english-slogan.png`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${htmlEscape(title)}</title>
  </head>
  <body style="margin:0;background:#f8f3ed;color:#241133;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${htmlEscape(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f3ed;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eadfd4;border-radius:28px;overflow:hidden;box-shadow:0 20px 48px rgba(60,28,83,0.13);">
            <tr>
              <td style="padding:30px 36px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" valign="middle">
                      <img src="${htmlEscape(logoSrc)}" width="124" alt="VYVA" style="display:block;width:124px;max-width:124px;height:auto;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td align="right" valign="middle" style="font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#7d2be8;">
                      ${htmlEscape(eyebrow)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 36px 0;">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:40px;line-height:1.08;font-weight:500;color:#241133;">${htmlEscape(title)}</h1>
                <p style="margin:18px 0 0;font-size:17px;line-height:1.6;color:#66566f;">${htmlEscape(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 36px 12px;">
                <a href="${safeActionUrl}" style="display:block;background:#7d2be8;background-image:linear-gradient(135deg,#8f22f5,#5420c8);color:#ffffff;text-decoration:none;text-align:center;border-radius:999px;padding:18px 24px;font-size:18px;line-height:1.2;font-weight:800;box-shadow:0 12px 26px rgba(125,43,232,0.28);">${htmlEscape(actionLabel)}</a>
                <p style="margin:14px 0 0;text-align:center;font-size:14px;line-height:1.55;color:#7c6e83;">${htmlEscape(detail)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 36px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f0ff;border:1px solid #eadcff;border-radius:18px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#3d2b46;font-weight:700;">Security note</p>
                      <p style="margin:0;font-size:14px;line-height:1.55;color:#66566f;">${htmlEscape(safetyNote)}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#7c6e83;">If the button does not work, copy this link into your browser:</p>
                <p style="margin:6px 0 0;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${safeActionUrl}" style="color:#6f22d8;text-decoration:underline;">${safeActionUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td align="center" style="border-top:1px solid #eadfd4;padding:18px 36px 24px;background:#fbf8f5;text-align:center;">
                <p style="margin:0;text-align:center;font-size:13px;line-height:1.7;color:#82738a;">
                  VYVA, your AI companion for life.
                  <span style="color:#c7bdcc;"> | </span>
                  <a href="${VYVA_WEBSITE_URL}" style="color:#6f22d8;text-decoration:none;">Website</a>
                  <span style="color:#c7bdcc;"> | </span>
                  <a href="${VYVA_PRIVACY_URL}" style="color:#6f22d8;text-decoration:none;">Privacy</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendEmailMessage({
  to,
  subject,
  text,
  html,
  debugLabel,
  debugLink,
  allowDevelopmentLog = isDev,
}: EmailMessage): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!resendApiKey) {
    if (allowDevelopmentLog && isDev) {
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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `VYVA <${from}>`,
      to: [to],
      subject,
      text,
      html,
      reply_to: replyTo,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(async () => ({
      message: await response.text().catch(() => response.statusText),
    })) as ResendResponse;
    const message = payload.message ?? payload.name ?? `Resend request failed with ${response.status}`;
    throw new Error(explainEmailProviderError(message, from, "Resend"));
  }
}

export async function sendPasswordResetEmail({
  to,
  resetLink,
  allowDevelopmentLog,
}: SendPasswordResetEmailOptions): Promise<void> {
  const subject = "Reset your VYVA password";
  const text = [
    "We received a request to reset the password for your VYVA account.",
    "Use this secure link to set a new password. It expires in 1 hour:",
    resetLink,
    "If you did not request this, you can safely ignore this email. Your password will not change.",
  ].join("\n\n");
  const html = brandedActionEmailHtml({
    preheader: "Use this secure VYVA link to reset your password.",
    eyebrow: "Account access",
    title: "Reset your password",
    intro: "We received a request to reset the password for your VYVA account.",
    actionLabel: "Reset password",
    actionUrl: resetLink,
    detail: "This secure link expires in 1 hour.",
    safetyNote: "If you did not request a password reset, ignore this email. Your password will not change.",
  });

  await sendEmailMessage({ to, subject, text, html, debugLabel: "Password reset", debugLink: resetLink, allowDevelopmentLog });
}

export async function sendMagicLoginEmail({
  to,
  magicLink,
  allowDevelopmentLog,
}: SendMagicLoginEmailOptions): Promise<void> {
  const subject = "Your secure VYVA sign-in link";
  const text = [
    "Use this secure link to open your VYVA account. It expires in 15 minutes:",
    magicLink,
    "If you did not request this, you can safely ignore this email.",
  ].join("\n\n");
  const html = brandedActionEmailHtml({
    preheader: "Use this secure VYVA link to sign in.",
    eyebrow: "Secure sign in",
    title: "Open your VYVA account",
    intro: "Use this secure link to open your VYVA account.",
    actionLabel: "Sign in securely",
    actionUrl: magicLink,
    detail: "This secure link expires in 15 minutes.",
    safetyNote: "If you did not request this sign-in link, ignore this email. No account changes will be made.",
  });

  await sendEmailMessage({ to, subject, text, html, debugLabel: "Magic login", debugLink: magicLink, allowDevelopmentLog });
}
