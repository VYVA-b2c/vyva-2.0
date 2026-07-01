import { describe, expect, it } from "vitest";
import type { CommunicationLog } from "../../shared/schema.js";
import { buildResendEmailRequest } from "./communicationDispatcher.js";

describe("Resend email dispatch", () => {
  it("builds the Resend payload used by appointment communications", () => {
    const payload = buildResendEmailRequest(
      {
        id: "communication-1",
        recipient: "clinic@example.com",
        body: "Please arrange an appointment.",
      } as CommunicationLog,
      {
        subject: "Appointment request",
        text: "Please arrange an appointment.",
      },
      "appointments@vyva.life",
      "reply@vyva.life",
      null,
    );

    expect(payload).toEqual({
      from: "VYVA <appointments@vyva.life>",
      to: ["clinic@example.com"],
      subject: "Appointment request",
      text: "Please arrange an appointment.",
      reply_to: "reply@vyva.life",
    });
  });

  it("keeps inline signup invite attachments on the Resend payload", () => {
    const payload = buildResendEmailRequest(
      {
        id: "communication-2",
        recipient: "gm@4cksa.com",
        body: "Join VYVA",
      } as CommunicationLog,
      {
        subject: "Join VYVA",
        text: "Join VYVA",
        html: '<img src="cid:vyva-logo-en" alt="VYVA">',
        attachments: [{
          filename: "vyva-logo-en.png",
          content: "base64-logo",
          type: "image/png",
          disposition: "inline",
          content_id: "vyva-logo-en",
        }],
      },
      "invites@vyva.life",
      "reply@vyva.life",
      "GM",
    );

    expect(payload).toMatchObject({
      from: "VYVA <invites@vyva.life>",
      to: ["GM <gm@4cksa.com>"],
      attachments: [{
        filename: "vyva-logo-en.png",
        content: "base64-logo",
        content_type: "image/png",
        content_id: "vyva-logo-en",
      }],
    });
  });
});
