import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendOwnedConciergeEmailAdapter } from "./conciergeEmailAdapter";

const originalEnv = { ...process.env };

describe("owned Concierge email adapter reply routing", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test";
    process.env.NOTIFY_FROM_EMAIL = "hola@notifications.vyva.life";
    process.env.CONCIERGE_EMAIL_INBOUND_ADDRESS = "concierge@replies.vyva.life";
    process.env.CONCIERGE_EMAIL_REPLY_SECRET = "reply-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("uses a signed task address for provider replies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await sendOwnedConciergeEmailAdapter({
      recipient: "provider@example.com",
      pendingId: "0f83cc56-6226-4ca4-a7e2-aa2967addd4a",
      summary: "Confirm the appointment",
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.reply_to).toMatch(/^concierge\+vyva\.0f83cc56-6226-4ca4-a7e2-aa2967addd4a\.[0-9a-f]{24}@replies\.vyva\.life$/);
  });
});
