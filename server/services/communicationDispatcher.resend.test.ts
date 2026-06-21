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
});
