import { describe, expect, it } from "vitest";
import { buildCareTeamInviteEmail } from "./careTeamInviteEmail.js";

describe("care team invite email", () => {
  it("renders a polished HTML invite with CTA and fallback link", () => {
    const email = buildCareTeamInviteEmail({
      url: "https://v2.vyva.life/care-team/invite/token-123",
      senior_name: "Karim Assad",
      invitee_name: "Mary User",
      recipient_name: "Mary User",
      target_role: "family",
      relationship: "Daughter",
      subject: "Karim Assad invited you to their VYVA care team",
    }, "VYVA: Karim Assad invited you to their care team. Review and accept securely: https://v2.vyva.life/care-team/invite/token-123");

    expect(email.subject).toBe("Karim Assad invited you to their VYVA care team");
    expect(email.text).toContain("Karim Assad invited you to join their VYVA care team.");
    expect(email.text).toContain("Accept invitation: https://v2.vyva.life/care-team/invite/token-123");
    expect(email.html).toContain("Join Karim Assad's care team");
    expect(email.html).toContain(">Accept invitation</a>");
    expect(email.html).toContain("Review first");
    expect(email.html).toContain("Nothing is shared until the invite is accepted.");
  });
});
