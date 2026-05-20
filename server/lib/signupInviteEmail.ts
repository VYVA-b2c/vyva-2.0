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
const cachedSignupEmailLogos = new Map<SignupInviteLanguage, EmailAttachment | null>();
const BENEFIT_CARD_ACCENTS = [
  { background: "#14b87a", shadow: "rgba(20,184,122,0.20)" },
  { background: "#4f6bff", shadow: "rgba(79,107,255,0.20)" },
  { background: "#f04475", shadow: "rgba(240,68,117,0.20)" },
] as const;

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
  return `
                        <tr>
                          <td style="padding:0 0 14px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e6dff2;border-radius:16px;box-shadow:0 10px 24px rgba(53,28,87,0.07);">
                              <tr>
                                <td width="64" valign="top" style="width:64px;padding:18px 0 18px 18px;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" width="48" style="width:48px;background:${accent.background};border-radius:14px;box-shadow:0 8px 16px ${accent.shadow};">
                                    <tr>
                                      <td align="center" style="height:48px;padding:0 4px;font-size:10px;line-height:1.1;font-weight:800;letter-spacing:0.04em;color:#ffffff;">${htmlEscape(benefit.label)}</td>
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
  const logoAttachment = signupEmailLogoAttachment(language);
  const logoSrc = logoAttachment
    ? `cid:${logoAttachment.content_id}`
    : `${baseUrl.replace(/\/$/, "")}/assets/vyva/vyva-logo-${language}.png`;
  const text = [
    copy.preheader,
    customIntro,
    copy.summary,
    `${copy.featureTitle}:`,
    ...copy.benefits.map((benefit) => `${benefit.title}: ${benefit.body}`),
    copy.reassurance,
    `${copy.startHere}: ${loginUrl}`,
    `${copy.fallback} ${loginUrl}`,
    copy.ignore,
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
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3fb;padding:28px 12px;">
      <tr>
        <td align="center">
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
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${customIntro ? `<tr>
              <td style="padding:24px 36px 4px;">
                ${paragraphHtml(intro)}
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
              <td style="padding:0 36px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3fb;border-radius:14px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#665d70;">${htmlEscape(copy.fallback)}<br><a href="${safeUrl}" style="color:#6f22c9;word-break:break-all;">${safeUrl}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #ebe4f4;padding:20px 36px 28px;background:#fbf9ff;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#70677b;">${htmlEscape(copy.ignore)}</p>
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
