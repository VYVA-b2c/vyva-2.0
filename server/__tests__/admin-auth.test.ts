import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import { requireAdminUser } from "../middleware/auth.js";

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: "admin-1" };
    next();
  });
  app.get("/admin", requireAdminUser, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("requireAdminUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a clear JSON response when the admin database lookup cannot connect", async () => {
    dbMock.db.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            const cause = Object.assign(new Error("getaddrinfo ENOTFOUND helium"), {
              code: "ENOTFOUND",
              hostname: "helium",
            });
            const error = new Error("Failed query");
            (error as Error & { cause?: unknown }).cause = cause;
            throw error;
          },
        }),
      }),
    }));

    const response = await request(buildApp())
      .get("/admin")
      .expect(503);

    expect(response.body).toMatchObject({
      error: "Admin database could not be reached.",
      code: "ADMIN_DATABASE_UNAVAILABLE",
      details: [
        expect.stringContaining("The app database host (helium) cannot be reached"),
      ],
    });
  });
});
