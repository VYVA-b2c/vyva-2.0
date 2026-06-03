type CareTeamInviteMetadata = Record<string, unknown>;

type CareTeamInviteEmailPayload = {
  subject: string;
  text: string;
  html: string;
  disableTracking: boolean;
};

function metadataString(metadata: CareTeamInviteMetadata, key: string) {
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

function roleLabel(value: string | null) {
  if (value === "doctor") return "Doctor or specialist";
  if (value === "carer") return "Caregiver";
  return "Family member or friend";
}

function possessiveName(value: string) {
  if (value === "someone you support") return "their";
  return value.endsWith("s") ? `${value}'` : `${value}'s`;
}

export function buildCareTeamInviteEmail(metadata: CareTeamInviteMetadata, fallbackBody: string | null): CareTeamInviteEmailPayload {
  const inviteUrl = metadataString(metadata, "url") ?? "#";
  const seniorName = metadataString(metadata, "senior_name") ?? "someone you support";
  const inviteeName = metadataString(metadata, "invitee_name") ?? metadataString(metadata, "recipient_name");
  const relationship = metadataString(metadata, "relationship");
  const role = roleLabel(metadataString(metadata, "target_role"));
  const subject = metadataString(metadata, "subject") ?? `${seniorName} invited you to their VYVA care team`;
  const greeting = inviteeName ? `Hi ${inviteeName},` : "Hello,";
  const roleLine = relationship ? `${role} - ${relationship}` : role;
  const possessiveSeniorName = possessiveName(seniorName);
  const fallback = fallbackBody?.trim();

  const text = [
    `${seniorName} invited you to join their VYVA care team.`,
    greeting,
    `With VYVA, you can stay connected to ${possessiveSeniorName} support circle without taking over their independence.`,
    `Your role: ${roleLine}`,
    "What happens next:",
    "1. Sign in or create your own VYVA account.",
    "2. Review the invite and the access requested.",
    "3. Accept only if everything looks right.",
    "Nothing is shared until access is accepted, and permissions can be changed later.",
    `Accept invitation: ${inviteUrl}`,
    fallback && !fallback.includes(inviteUrl) ? fallback : null,
  ].filter(Boolean).join("\n\n");

  const safeUrl = htmlEscape(inviteUrl);
  const safeSeniorName = htmlEscape(seniorName);
  const safeGreeting = htmlEscape(greeting);
  const safeRoleLine = htmlEscape(roleLine);
  const safePossessiveSeniorName = htmlEscape(possessiveSeniorName);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${htmlEscape(subject)}</title>
  </head>
  <body style="margin:0;background:#f8f3ec;color:#241133;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safeSeniorName} invited you to join their VYVA care team.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f3ec;">
      <tr>
        <td align="center" style="padding:28px 10px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffaf4;border:1px solid #eadfcc;border-radius:30px;overflow:hidden;box-shadow:0 24px 60px rgba(60,38,20,0.13);">
            <tr>
              <td style="padding:30px 34px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:30px;line-height:1;font-weight:900;letter-spacing:0.02em;color:#7d2be8;">VYVA</td>
                    <td align="right" style="font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#8b5cf6;">Care team invite</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#6b21a8;background-image:linear-gradient(135deg,#8f22f5 0%,#6b21a8 50%,#3b176f 100%);border-radius:24px;">
                  <tr>
                    <td style="padding:34px 30px 32px;">
                      <p style="margin:0 0 12px;font-size:13px;line-height:1.2;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#ffde59;">You have been invited</p>
                      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.1;font-weight:600;color:#ffffff;">Join ${safePossessiveSeniorName} care team</h1>
                      <p style="margin:18px 0 0;font-size:18px;line-height:1.55;color:#fbf5ff;">VYVA helps trusted people stay connected, understand what matters, and support daily care without taking over.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 36px 6px;">
                <p style="margin:0 0 12px;font-size:19px;line-height:1.45;font-weight:800;color:#241133;">${safeGreeting}</p>
                <p style="margin:0;font-size:17px;line-height:1.6;color:#5c4f46;">${safeSeniorName} invited you to join their care team on VYVA. You will be able to review what access is being requested before accepting.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 36px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #eadfcc;border-radius:20px;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <p style="margin:0 0 6px;font-size:12px;line-height:1.2;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#7d2be8;">Your role</p>
                      <p style="margin:0;font-size:21px;line-height:1.25;font-weight:900;color:#241133;">${safeRoleLine}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 36px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${[
                    ["Review first", "See the invitation and requested access before anything is shared."],
                    ["Stay informed", "Receive the updates and alerts that the account holder chooses."],
                    ["Respect control", "Permissions can be changed or removed later by the account holder."],
                  ].map(([title, body]) => `
                  <tr>
                    <td style="padding:0 0 12px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #eadfcc;border-radius:18px;">
                        <tr>
                          <td width="54" style="width:54px;padding:16px 0 16px 16px;">
                            <table role="presentation" width="38" cellspacing="0" cellpadding="0" style="width:38px;background:#f1e7ff;border-radius:14px;">
                              <tr><td align="center" style="height:38px;font-size:20px;line-height:38px;color:#6b21a8;font-weight:900;">&#10003;</td></tr>
                            </table>
                          </td>
                          <td style="padding:15px 18px 15px 4px;">
                            <p style="margin:0 0 4px;font-size:17px;line-height:1.25;font-weight:900;color:#241133;">${htmlEscape(title)}</p>
                            <p style="margin:0;font-size:14px;line-height:1.5;color:#6a5c52;">${htmlEscape(body)}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`).join("")}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 36px 22px;">
                <a href="${safeUrl}" style="display:block;background:#7d2be8;background-image:linear-gradient(135deg,#8f22f5,#5d1bc7);color:#ffffff;text-decoration:none;text-align:center;border-radius:999px;padding:18px 24px;font-size:18px;line-height:1.2;font-weight:900;box-shadow:0 14px 28px rgba(107,33,168,0.24);">Accept invitation</a>
                <p style="margin:14px 0 0;text-align:center;font-size:14px;line-height:1.5;color:#6a5c52;">Nothing is shared until the invite is accepted.</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #eadfcc;padding:18px 36px 26px;background:#fffdf9;">
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#7a6d64;">If the button does not work, copy and paste this secure link:</p>
                <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.5;color:#6b21a8;"><a href="${safeUrl}" style="color:#6b21a8;">${safeUrl}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html, disableTracking: false };
}
