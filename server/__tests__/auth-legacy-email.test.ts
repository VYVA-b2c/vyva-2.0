import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  verifySupabaseAccessToken: vi.fn(),
  select: vi.fn(),
}));

vi.mock("../lib/jwt.js", () => ({ verifyToken: mocks.verifyToken }));
vi.mock("../lib/supabaseAuth.js", () => ({
  verifySupabaseAccessToken: mocks.verifySupabaseAccessToken,
}));
vi.mock("../db.js", () => ({
  db: { select: mocks.select },
}));

import { authMiddleware } from "../middleware/auth.js";

describe("legacy authentication identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue("legacy-user-1");
    mocks.verifySupabaseAccessToken.mockResolvedValue(null);
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{
            email: "pilot@example.test",
            password_hash: "legacy:valid",
            onboarding_intent: null,
          }],
        }),
      }),
    });
  });

  it("attaches the stored email so email-based feature allowlists can match", async () => {
    const req = {
      headers: { authorization: "Bearer valid-legacy-token" },
    } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({
      id: "legacy-user-1",
      email: "pilot@example.test",
      authProvider: "legacy",
    });
  });
});
