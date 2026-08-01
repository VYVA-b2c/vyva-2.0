import { describe, expect, it } from "vitest";
import {
  classifyConciergeInboundReply,
  extractInboundReplyText,
  normalizeInboundEmailAddress,
  plainTextFromInboundHtml,
} from "./conciergeInboundReplies";

describe("Concierge inbound replies", () => {
  it("normalizes provider addresses", () => {
    expect(normalizeInboundEmailAddress("Clinic Team <FRONTDESK@EXAMPLE.COM>")).toBe("frontdesk@example.com");
  });

  it("removes quoted history before saving a reply", () => {
    expect(extractInboundReplyText("Your appointment is available Tuesday.\n\nOn Monday VYVA wrote:\n> Can you help?")).toBe(
      "Your appointment is available Tuesday.",
    );
  });

  it("marks a provider question as action needed", () => {
    expect(classifyConciergeInboundReply({
      text: "Could you confirm the patient's preferred time?",
    })).toMatchObject({
      status: "action_needed",
      actionNeeded: true,
    });
  });

  it("marks a clear provider answer as reply received", () => {
    expect(classifyConciergeInboundReply({
      text: "The booking is confirmed for Tuesday at 10:00.",
    })).toMatchObject({
      status: "reply_received",
      actionNeeded: false,
    });
  });

  it("marks a provider offer as action needed so the user can confirm it", () => {
    expect(classifyConciergeInboundReply({
      text: "We can visit Thursday at 11:00 for EUR 95.",
    })).toMatchObject({
      status: "action_needed",
      actionNeeded: true,
      resolution: {
        primaryAction: "confirm",
        dateTime: "Thursday at 11:00",
        price: "EUR 95",
      },
    });
  });

  it("uses sanitized HTML when a plain-text body is unavailable", () => {
    expect(plainTextFromInboundHtml("<p>We can help.</p><script>ignore()</script>"))
      .toBe("We can help.");
  });
});
