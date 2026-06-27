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
    process.env.SENDGRID_API_KEY = "SG_old_key_that_should_not_be_used";

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

  it("does not fall back when Resend refuses delivery", async () => {
    process.env.SENDGRID_API_KEY = "SG_fallback_key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: "Maximum credits exceeded" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendPasswordResetEmail({
        to: "karim.assad@mokadigital.net",
        resetLink: "https://v2.vyva.life/reset-password?token=test",
        allowDevelopmentLog: false,
      }),
    ).rejects.toThrow("Maximum credits exceeded");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [resendUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(resendUrl).toBe("https://api.resend.com/emails");
  });
});
