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
    .map((paragraph) => `<p style="margin:0 0 12px;font-size:17px;line-height:1.58;color:#4f4355;">${paragraph.replace(/\n/g, "<br>")}</p>`)
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

function benefitCard(benefit: SignupInviteBenefit) {
  return `
                        <tr>
                          <td style="padding:0 0 12px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fbf8f5;border:1px solid #eaded2;border-radius:16px;">
                              <tr>
                                <td style="padding:15px 16px;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" width="70" style="width:70px;background:#efe6ff;border-radius:14px;">
                                    <tr>
                                      <td align="center" style="padding:9px 5px;font-size:10px;line-height:1.1;font-weight:800;letter-spacing:0.04em;color:#6f22c9;">${htmlEscape(benefit.label)}</td>
                                    </tr>
                                  </table>
                                  <p style="margin:10px 0 4px;font-size:18px;line-height:1.2;font-weight:800;color:#2f143f;">${htmlEscape(benefit.title)}</p>
                                  <p style="margin:0;font-size:14px;line-height:1.45;color:#5f514b;">${htmlEscape(benefit.body)}</p>
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
  <body style="margin:0;background:#f4efe7;color:#2f2135;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe7;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffaf4;border:1px solid #e7d8ca;border-radius:28px;overflow:hidden;box-shadow:0 18px 50px rgba(47,20,63,0.10);">
            <tr>
              <td style="padding:30px 36px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" valign="middle">
                      <img src="${htmlEscape(logoSrc)}" width="116" alt="VYVA" style="display:block;width:116px;max-width:116px;height:auto;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td align="right" valign="middle" style="font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8f6d18;">
                      ${htmlEscape(copy.eyebrow)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#341344;border-radius:22px;overflow:hidden;">
                  <tr>
                    <td style="padding:32px 32px 30px;">
                      <p style="margin:0 0 12px;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f6b63d;">${htmlEscape(copy.startHere)}</p>
                      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.08;font-weight:500;color:#ffffff;">${htmlEscape(copy.title)}</h1>
                      <p style="margin:18px 0 0;font-size:17px;line-height:1.55;color:#f0e5f6;">${htmlEscape(copy.summary)}</p>
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
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #eaded2;border-radius:18px;">
                  <tr>
                    <td style="padding:20px 22px 6px;">
                      <p style="margin:0 0 14px;font-size:13px;line-height:1.2;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7b5a10;">${htmlEscape(copy.featureTitle)}</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        ${copy.benefits.map((benefit) => benefitCard(benefit)).join("")}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 36px 18px;">
                <a href="${safeUrl}" style="display:block;background:#6f22c9;background-image:linear-gradient(135deg,#7d2be8,#4f46e5);color:#ffffff;text-decoration:none;text-align:center;border-radius:999px;padding:18px 24px;font-size:18px;line-height:1.2;font-weight:700;">${htmlEscape(copy.cta)}</a>
                <p style="margin:14px 0 0;text-align:center;font-size:14px;line-height:1.5;color:#6f5f5a;">${htmlEscape(copy.reassurance)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f2ea;border-radius:14px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#806f66;">${htmlEscape(copy.fallback)}<br><a href="${safeUrl}" style="color:#6f22c9;word-break:break-all;">${safeUrl}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #eaded2;padding:20px 36px 28px;background:#fff7ee;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8b7b74;">${htmlEscape(copy.ignore)}</p>
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
