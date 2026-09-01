import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../middleware/auth.js";
import healthDevicesSettingsRouter from "../routes/healthDevicesSettings.js";

const { profileStore, deviceStore } = vi.hoisted(() => ({
  profileStore: new Map<string, { data_sharing_consent: unknown; updated_at?: Date }>(),
  deviceStore: new Map<string, Record<string, unknown>>(),
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
  const tableName = (table: unknown) => (table as Record<symbol, string>)?.[Symbol.for("drizzle:Name")];
  function firstProfile() {
    const entry = profileStore.entries().next();
    return entry.done ? null : entry.value;
  }

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => ({
          where: vi.fn(() => tableName(table) === "user_device_connections"
            ? Promise.resolve([...deviceStore.values()])
            : ({
              limit: vi.fn(async () => {
              const entry = firstProfile();
              if (!entry) return [];
              return [{ data_sharing_consent: entry[1].data_sharing_consent }];
            }),
            })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => ({
          onConflictDoUpdate: vi.fn(async () => {
            deviceStore.set(String(values.device_kind), { id: randomUUID(), ...values });
          }),
        })),
      })),
      update: vi.fn((table: unknown) => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn(() => tableName(table) === "user_device_connections"
            ? Promise.resolve([...deviceStore.entries()].map(([key, device]) => {
              deviceStore.set(key, { ...device, ...values });
              return deviceStore.get(key);
            }))
            : ({
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
  deviceStore.clear();
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

  it("migrates legacy profile devices into the canonical registry without re-pairing", async () => {
    const profileId = createProfile({
      data_sharing_consent: {
        health_devices: {
          devices: [{
            id: "pulse_oximeter",
            deviceName: "Bedroom oximeter",
            connectedAt: "2026-08-24T10:00:00.000Z",
            method: "web_bluetooth",
            status: "ready",
          }],
        },
      },
    });

    const res = await request(app)
      .get("/api/settings/health-devices")
      .set("x-user-id", profileId)
      .expect(200);

    expect(res.body.devices).toEqual([
      expect.objectContaining({ id: "pulse_oximeter", deviceName: "Bedroom oximeter", status: "ready" }),
    ]);
    expect(deviceStore.get("pulse_oximeter")).toEqual(expect.objectContaining({
      capabilities: ["oxygen_saturation", "resting_hr_bpm"],
      is_active: true,
    }));
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

  it("persists pilot compatibility metadata and discards browser-scoped device ids", async () => {
    const profileId = createProfile();

    const saved = await request(app)
      .post("/api/settings/health-devices")
      .set("x-user-id", profileId)
      .send({
        device: {
          id: "bp_cuff",
          deviceName: "A&D UA-651BLE",
          method: "web_bluetooth",
          status: "ready",
          sourceRef: {
            provider: "web_bluetooth",
            device_type: "bp_cuff",
            device_name: "A&D UA-651BLE",
            device_id: "browser-origin-scoped-id",
            model_id: "and_ua_651ble",
            model_label: "A&D UA-651BLE",
            support_level: "pilot_candidate",
            service_uuid: "0x1810",
            characteristic_uuid: "0x2a35",
            parser_version: "vyva-ble-standard-gatt-v1",
          },
        },
      })
      .expect(201);

    expect(saved.body.devices[0].sourceRef).toEqual(expect.objectContaining({
      model_id: "and_ua_651ble",
      support_level: "pilot_candidate",
      service_uuid: "0x1810",
      characteristic_uuid: "0x2a35",
      parser_version: "vyva-ble-standard-gatt-v1",
    }));
    expect(saved.body.devices[0].sourceRef).not.toHaveProperty("device_id");
    expect(deviceStore.get("bp_cuff")?.metadata).not.toHaveProperty("device_id");

    const loaded = await request(app)
      .get("/api/settings/health-devices")
      .set("x-user-id", profileId)
      .expect(200);
    expect(loaded.body.devices[0].sourceRef.model_id).toBe("and_ua_651ble");
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
