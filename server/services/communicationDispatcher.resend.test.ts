import { describe, expect, it } from "vitest";
import type { CommunicationLog } from "../../shared/schema.js";
import { buildEmailPayload, buildResendEmailRequest } from "./communicationDispatcher.js";

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

  it("uses generic communication HTML metadata for marketing emails", () => {
    const email = buildEmailPayload({
      id: "communication-3",
      recipient: "caregiver@example.com",
      purpose: "marketing_campaign_email",
      body: "Plain marketing copy",
      metadata: {
        subject: "July update",
        htmlBody: "<p>Rich Source template</p>",
      },
    } as CommunicationLog);

    expect(email).toEqual({
      subject: "July update",
      text: "Plain marketing copy",
      html: "<p>Rich Source template</p>",
    });

    expect(buildResendEmailRequest(
      { id: "communication-3", recipient: "caregiver@example.com", body: "Plain marketing copy" } as CommunicationLog,
      email,
      "marketing@vyva.life",
      "reply@vyva.life",
      null,
    )).toMatchObject({
      subject: "July update",
      text: "Plain marketing copy",
      html: "<p>Rich Source template</p>",
    });
  });

  it("keeps a user-approved Home Service photo on the provider email", () => {
    const email = buildEmailPayload({
      id: "communication-home-service",
      recipient: "provider@example.com",
      purpose: "home_service_request",
      body: "Please review this home service request.",
      metadata: {
        subject: "Home service request",
        attachments: [{
          filename: "leaking-sink.jpg",
          type: "image/jpeg",
          content: "cGhvdG8=",
        }],
      },
    } as CommunicationLog);

    expect(email.attachments).toEqual([
      expect.objectContaining({
        filename: "leaking-sink.jpg",
        type: "image/jpeg",
        content: "cGhvdG8=",
      }),
    ]);
    expect(buildResendEmailRequest(
      { id: "communication-home-service", recipient: "provider@example.com", body: email.text } as CommunicationLog,
      email,
      "concierge@vyva.life",
      "reply@vyva.life",
      null,
    )).toMatchObject({
      attachments: [{
        filename: "leaking-sink.jpg",
        content: "cGhvdG8=",
        content_type: "image/jpeg",
      }],
    });
  });
});
