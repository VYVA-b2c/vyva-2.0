import { readFileSync } from "fs";
import { join } from "path";
import { normalizeSignupInviteLanguage, signupInviteCopyFor, type SignupInviteBenefit, type SignupInviteLanguage } from "./signupInviteLanguage.js";

export type EmailAttachment = {
  content: string;
  filename: string;
  type: string;
  disposition: "inline" | "attachment";
  content_id: string;
};

export type SignupInviteEmailPayload = {
  subject: string;
  text: string;
  html: string;
  disableTracking: boolean;
  attachments?: EmailAttachment[];
};

const SIGNUP_EMAIL_LOGO_CID_PREFIX = "vyva-logo";
const VYVA_WEBSITE_URL = "https://vyva.life";
const VYVA_PRIVACY_URL = "https://vyva.life/privacypolicy";
const VYVA_TERMS_URL = "https://vyva.life/securityencryption";
const cachedSignupEmailLogos = new Map<SignupInviteLanguage, EmailAttachment | null>();
const BENEFIT_CARD_ACCENTS = [
  { background: "#14b87a", shadow: "rgba(20,184,122,0.20)" },
  { background: "#4f6bff", shadow: "rgba(79,107,255,0.20)" },
  { background: "#f04475", shadow: "rgba(240,68,117,0.20)" },
  { background: "#ff8a00", shadow: "rgba(255,138,0,0.20)" },
  { background: "#7d2be8", shadow: "rgba(125,43,232,0.20)" },
  { background: "#d43bd7", shadow: "rgba(212,59,215,0.20)" },
] as const;
const BENEFIT_CARD_ICONS = ["&#10010;", "&#8594;", "&#10003;", "&#10022;", "&#9733;", "&#9829;"] as const;

function defaultPublicBaseUrl() {
  return process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? "5000"}`;
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
    .map((paragraph) => `<p style="margin:0 0 12px;font-size:17px;line-height:1.58;color:#433a4b;">${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function introFromLegacyBody(body: string | null) {
  if (!body) return null;
  const [intro] = body.split(/\n\s*\nSign up here:/i);
  return intro?.trim() || null;
}

function signupEmailLogoAttachment(languageInput: unknown) {
  const language = normalizeSignupInviteLanguage(languageInput);
  const cachedLogo = cachedSignupEmailLogos.get(language);
  if (cachedSignupEmailLogos.has(language)) return cachedLogo ?? null;
  try {
    const logoPath = join(process.cwd(), "public", "assets", "vyva", `vyva-logo-${language}.png`);
    const logoAttachment: EmailAttachment = {
      content: readFileSync(logoPath).toString("base64"),
      filename: `vyva-logo-${language}.png`,
      type: "image/png",
      disposition: "inline",
      content_id: `${SIGNUP_EMAIL_LOGO_CID_PREFIX}-${language}`,
    };
    cachedSignupEmailLogos.set(language, logoAttachment);
    return logoAttachment;
  } catch (err) {
    console.warn("[communications] signup invite logo could not be attached", err);
    cachedSignupEmailLogos.set(language, null);
    return null;
  }
}

function benefitCard(benefit: SignupInviteBenefit, index: number) {
  const accent = BENEFIT_CARD_ACCENTS[index % BENEFIT_CARD_ACCENTS.length];
  const icon = BENEFIT_CARD_ICONS[index % BENEFIT_CARD_ICONS.length];
  return `
                        <tr>
                          <td style="padding:0 0 14px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e6dff2;border-radius:16px;box-shadow:0 10px 24px rgba(53,28,87,0.07);">
                              <tr>
                                <td width="64" valign="top" style="width:64px;padding:18px 0 18px 18px;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" width="48" style="width:48px;background:${accent.background};border-radius:14px;box-shadow:0 8px 16px ${accent.shadow};">
                                    <tr>
                                      <td align="center" style="height:48px;padding:0;font-size:24px;line-height:48px;font-weight:800;color:#ffffff;">${icon}</td>
                                    </tr>
                                  </table>
                                </td>
                                <td valign="top" style="padding:17px 18px 17px 4px;">
                                  <p style="margin:0 0 5px;font-size:20px;line-height:1.2;font-weight:800;color:#241133;">${htmlEscape(benefit.title)}</p>
                                  <p style="margin:0;font-size:15px;line-height:1.5;color:#4b4254;">${htmlEscape(benefit.body)}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>`;
}

export function buildSignupInviteEmail(
  metadata: Record<string, unknown>,
  fallbackBody: string | null,
  baseUrl = defaultPublicBaseUrl(),
): SignupInviteEmailPayload {
  const language = normalizeSignupInviteLanguage(metadata.language);
  const copy = signupInviteCopyFor(metadata.language);
  const loginUrl = metadataString(metadata, "url") ?? `${baseUrl.replace(/\/$/, "")}/login`;
  const customIntro = metadataString(metadata, "intro") ?? introFromLegacyBody(fallbackBody);
  const intro = customIntro ?? copy.defaultIntro;
  const subject = metadataString(metadata, "subject") ?? copy.subject;
  const recipientName = metadataString(metadata, "recipient_name");
  const greeting = recipientName ? `${copy.greeting} ${recipientName},` : null;
  const logoAttachment = signupEmailLogoAttachment(language);
  const logoSrc = logoAttachment
    ? `cid:${logoAttachment.content_id}`
    : `${baseUrl.replace(/\/$/, "")}/assets/vyva/vyva-logo-${language}.png`;
  const text = [
    copy.preheader,
    greeting,
    customIntro,
    copy.summary,
    copy.outcomeBadge,
    `${copy.featureTitle}:`,
    ...copy.benefits.map((benefit) => `${benefit.title}: ${benefit.body}`),
    copy.reassurance,
    `${copy.startHere}: ${loginUrl}`,
    `${copy.fallback} ${loginUrl}`,
    copy.ignore,
    `VYVA: ${VYVA_WEBSITE_URL}`,
    `Privacy Policy: ${VYVA_PRIVACY_URL}`,
    `Terms of Service: ${VYVA_TERMS_URL}`,
  ].filter(Boolean).join("\n\n");
  const safeUrl = htmlEscape(loginUrl);
  const safePreheader = htmlEscape(copy.preheader);
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${htmlEscape(subject)}</title>
  </head>
  <body style="margin:0;background:#f7f3fb;color:#241133;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3fb;">
      <tr>
        <td align="center" style="padding:28px 6px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #ebe4f4;border-radius:28px;overflow:hidden;box-shadow:0 20px 54px rgba(53,28,87,0.13);">
            <tr>
              <td style="padding:30px 36px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" valign="middle">
                      <img src="${htmlEscape(logoSrc)}" width="116" alt="VYVA" style="display:block;width:116px;max-width:116px;height:auto;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td align="right" valign="middle" style="font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#6b4bb0;">
                      ${htmlEscape(copy.eyebrow)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#5f16c9;background-image:linear-gradient(135deg,#9a14f4 0%,#5d1bc7 48%,#24185f 100%);border-radius:22px;overflow:hidden;">
                  <tr>
                    <td style="padding:34px 32px 32px;">
                      <p style="margin:0 0 12px;font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#ffca4b;">${htmlEscape(copy.startHere)}</p>
                      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:37px;line-height:1.08;font-weight:600;color:#ffffff;">${htmlEscape(copy.title)}</h1>
                      <p style="margin:18px 0 0;font-size:18px;line-height:1.55;color:#f6efff;">${htmlEscape(copy.summary)}</p>
                      ${copy.outcomeBadge ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 0;background:#ffffff;border-radius:999px;">
                        <tr>
                          <td style="padding:9px 14px;font-size:13px;line-height:1.2;font-weight:800;color:#4b1a87;">${htmlEscape(copy.outcomeBadge)}</td>
                        </tr>
                      </table>` : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${greeting || customIntro ? `<tr>
              <td style="padding:24px 36px 4px;">
                ${greeting ? `<p style="margin:0 0 ${customIntro ? "10px" : "0"};font-size:19px;line-height:1.45;font-weight:800;color:#241133;">${htmlEscape(greeting)}</p>` : ""}
                ${customIntro ? paragraphHtml(intro) : ""}
              </td>
            </tr>` : ""}
            <tr>
              <td style="padding:${customIntro ? "10px" : "24px"} 36px 4px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f5ff;border:1px solid #e8dfff;border-radius:18px;">
                  <tr>
                    <td style="padding:22px 22px 8px;">
                      <p style="margin:0 0 16px;font-size:13px;line-height:1.2;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#6b4bb0;">${htmlEscape(copy.featureTitle)}</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        ${copy.benefits.map((benefit, index) => benefitCard(benefit, index)).join("")}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 36px 18px;">
                <a href="${safeUrl}" style="display:block;background:#7d2be8;background-image:linear-gradient(135deg,#8f22f5,#4f46e5);color:#ffffff;text-decoration:none;text-align:center;border-radius:999px;padding:19px 24px;font-size:19px;line-height:1.2;font-weight:800;box-shadow:0 12px 24px rgba(111,34,201,0.28);">${htmlEscape(copy.cta)}</a>
                <p style="margin:14px 0 0;text-align:center;font-size:15px;line-height:1.5;color:#5c5267;">${htmlEscape(copy.reassurance)}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="border-top:1px solid #ebe4f4;padding:18px 36px 24px;background:#fbf9ff;text-align:center;">
                <p style="margin:0;text-align:center;font-size:13px;line-height:1.7;color:#7d8fb3;">
                  &copy; 2026 MOKA DIGITECK SL.
                  <span style="color:#c0b8cf;"> | </span>
                  <a href="${VYVA_WEBSITE_URL}" style="color:#6b7fab;text-decoration:none;">Website</a>
                  <span style="color:#c0b8cf;"> | </span>
                  <a href="${VYVA_PRIVACY_URL}" style="color:#6b7fab;text-decoration:none;">Privacy Policy</a>
                  <span style="color:#c0b8cf;"> | </span>
                  <a href="${VYVA_TERMS_URL}" style="color:#6b7fab;text-decoration:none;">Terms of Service</a>
                </p>
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
