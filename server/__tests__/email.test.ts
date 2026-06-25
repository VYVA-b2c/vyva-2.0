import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "../lib/email.js";

const originalEnv = { ...process.env };

describe("email sender", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "hello@vyva.life";
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("sends password reset emails through Resend when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "email_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendPasswordResetEmail({
      to: "karim.assad@mokadigital.net",
      resetLink: "https://v2.vyva.life/reset-password?token=test",
      allowDevelopmentLog: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "VYVA <hello@vyva.life>",
      to: ["karim.assad@mokadigital.net"],
      subject: "Reset your VYVA password",
      reply_to: "hello@vyva.life",
    });
  });
});
