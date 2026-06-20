import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../middleware/auth.js";
import healthDevicesSettingsRouter from "../routes/healthDevicesSettings.js";

const { profileStore } = vi.hoisted(() => ({
  profileStore: new Map<string, { data_sharing_consent: unknown; updated_at?: Date }>(),
}));

vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: vi.fn(async (accountUserId: string) => ({
    accountUserId,
    profileId: profileStore.has(accountUserId) ? accountUserId : null,
    role: profileStore.has(accountUserId) ? "elder" : null,
    profileCount: profileStore.has(accountUserId) ? 1 : 0,
    needsProfileSetup: !profileStore.has(accountUserId),
    needsProfileSelection: false,
  })),
}));

vi.mock("../db.js", () => {
  function firstProfile() {
    const entry = profileStore.entries().next();
    return entry.done ? null : entry.value;
  }

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const entry = firstProfile();
              if (!entry) return [];
              return [{ data_sharing_consent: entry[1].data_sharing_consent }];
            }),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              const entry = firstProfile();
              if (!entry) return [];
              const [profileId, profile] = entry;
              const next = { ...profile, ...values };
              profileStore.set(profileId, next);
              return [{ data_sharing_consent: next.data_sharing_consent }];
            }),
          })),
        })),
      })),
    },
  };
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/settings/health-devices", authMiddleware, healthDevicesSettingsRouter);
  return app;
}

const app = buildApp();
function createProfile(values: { id?: string; data_sharing_consent?: unknown } = {}) {
  const profileId = values.id ?? randomUUID();
  profileStore.set(profileId, {
    data_sharing_consent: values.data_sharing_consent ?? {},
  });
  return profileId;
}

afterEach(() => {
  profileStore.clear();
});

describe("Health devices settings API", () => {
  it("loads empty device settings", async () => {
    const profileId = createProfile();

    const res = await request(app)
      .get("/api/settings/health-devices")
      .set("x-user-id", profileId)
      .expect(200);

    expect(res.body).toEqual({ devices: [] });
  });

  it("saves, reloads, and removes device metadata without readings", async () => {
    const profileId = createProfile();

    await request(app)
      .post("/api/settings/health-devices")
      .set("x-user-id", profileId)
      .send({
        device: {
          id: "heart_monitor",
          deviceName: "Test heart strap",
          connectedAt: "2026-06-20T10:00:00.000Z",
          method: "web_bluetooth",
          status: "ready",
        },
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.devices).toEqual([
          expect.objectContaining({
            id: "heart_monitor",
            deviceName: "Test heart strap",
            method: "web_bluetooth",
            status: "ready",
          }),
        ]);
      });

    const loaded = await request(app)
      .get("/api/settings/health-devices")
      .set("x-user-id", profileId)
      .expect(200);
    expect(loaded.body.devices[0].id).toBe("heart_monitor");

    const removed = await request(app)
      .delete("/api/settings/health-devices/heart_monitor")
      .set("x-user-id", profileId)
      .expect(200);
    expect(removed.body.devices).toEqual([]);
  });

  it("rejects unknown device types", async () => {
    const profileId = createProfile();

    await request(app)
      .post("/api/settings/health-devices")
      .set("x-user-id", profileId)
      .send({
        device: {
          id: "magic_device",
          deviceName: "Nope",
          method: "web_bluetooth",
        },
      })
      .expect(400);
  });
});
