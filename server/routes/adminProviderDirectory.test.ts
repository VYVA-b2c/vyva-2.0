import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const providerDirectoryMock = vi.hoisted(() => ({
  listAdminProviderDirectory: vi.fn(),
  parseAdminProviderUpdate: vi.fn((value) => value),
  updateAdminProviderDirectoryItem: vi.fn(),
}));

vi.mock("../services/adminProviderDirectory.js", () => providerDirectoryMock);

import adminProviderDirectoryRouter from "./adminProviderDirectory.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "admin-1", email: "ops@vyva.life", role: "admin" };
    next();
  });
  app.use("/api/admin/providers", adminProviderDirectoryRouter);
  return app;
}

describe("admin provider directory route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerDirectoryMock.listAdminProviderDirectory.mockResolvedValue({
      providers: [{ id: "profile-1:0", name: "City Clinic" }],
      totals: { providers: 1, ready: 1, needsAttention: 0 },
    });
    providerDirectoryMock.updateAdminProviderDirectoryItem.mockResolvedValue({
      provider: { id: "profile-1:0", name: "City Clinic", defaultForCategory: true },
      directory: { providers: [], totals: { providers: 0, ready: 0, needsAttention: 0 } },
    });
  });

  it("lists saved providers for admin review", async () => {
    const response = await request(buildApp())
      .get("/api/admin/providers")
      .expect(200);

    expect(response.body.providers[0].name).toBe("City Clinic");
  });

  it("saves a provider update", async () => {
    await request(buildApp())
      .patch("/api/admin/providers/profile-1/providers/0")
      .send({ email: "clinic@example.com", defaultForCategory: true })
      .expect(200);

    expect(providerDirectoryMock.updateAdminProviderDirectoryItem).toHaveBeenCalledWith({
      profileId: "profile-1",
      providerIndex: 0,
      patch: { email: "clinic@example.com", defaultForCategory: true },
    });
  });

  it("rejects an invalid provider selection", async () => {
    await request(buildApp())
      .patch("/api/admin/providers/profile-1/providers/nope")
      .send({ email: "clinic@example.com" })
      .expect(400);

    expect(providerDirectoryMock.updateAdminProviderDirectoryItem).not.toHaveBeenCalled();
  });
});
