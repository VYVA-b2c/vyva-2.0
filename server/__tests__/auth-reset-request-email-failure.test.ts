import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "development";

const mocks = vi.hoisted(() => {
  let storedResetToken: string | null = null;
  const user = { id: "user-1", email: "karim.assad@mokadigital.net" };

  return {
    get storedResetToken() {
      return storedResetToken;
    },
    reset() {
      storedResetToken = null;
    },
    sendPasswordResetEmail: vi.fn(),
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [user]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: { reset_token?: string }) => {
          storedResetToken = values.reset_token ?? null;
          return {
            where: vi.fn(async () => []),
          };
        }),
      })),
    },
  };
});

vi.mock("../db.js", () => ({ db: mocks.db }));
vi.mock("../lib/email.js", () => ({
  sendMagicLoginEmail: vi.fn(),
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

const { authRouter } = await import("../routes/auth.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  return app;
}

describe("password reset request email delivery", () => {
  beforeEach(() => {
    mocks.reset();
    mocks.sendPasswordResetEmail.mockReset();
  });

  it("keeps local reset usable when the email provider refuses delivery", async () => {
    mocks.sendPasswordResetEmail.mockRejectedValueOnce(new Error("Maximum credits exceeded"));

    const res = await request(buildApp())
      .post("/api/auth/reset-request")
      .set("host", "localhost:3001")
      .send({ email: "karim.assad@mokadigital.net" })
      .expect(200);

    expect(res.body.message).toBe("If an account with that email exists, a reset link has been sent.");
    expect(res.body.error).toBeUndefined();
    expect(res.body._devEmailDeliveryFailed).toBe(true);
    expect(res.body._devToken).toBe(mocks.storedResetToken);
    expect(res.body._devResetLink).toContain(`/reset-password?token=${mocks.storedResetToken}`);
  });
});
