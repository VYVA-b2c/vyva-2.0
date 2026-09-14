import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { profiles, userDeviceConnections } from "../../shared/schema.js";
import { VITALS_DEVICE_CAPABILITIES } from "../../shared/vitalsAcquisition.js";

const router = Router();
router.use(requireUser);

const deviceKindSchema = z.enum([
  "bp_cuff",
  "pulse_oximeter",
  "thermometer",
  "glucose_meter",
  "weight_scale",
  "heart_monitor",
]);

const healthDeviceSourceRefSchema = z.object({
  provider: z.literal("web_bluetooth").optional(),
  device_type: deviceKindSchema.optional(),
  device_name: z.string().trim().min(1).max(140).optional(),
  model_id: z.string().trim().min(1).max(80).optional(),
  model_label: z.string().trim().min(1).max(140).optional(),
  support_level: z.enum(["pilot_candidate", "tested", "experimental"]).optional(),
  service_uuid: z.string().trim().max(24).optional(),
  characteristic_uuid: z.string().trim().max(24).optional(),
  parser_version: z.string().trim().max(80).optional(),
}).passthrough().transform((sourceRef) => {
  // Web Bluetooth device IDs are browser/origin-scoped identifiers. They are
  // unnecessary for a foreground read and must not be persisted server-side.
  const { device_id: _discardedDeviceId, ...safeSourceRef } = sourceRef;
  return safeSourceRef;
});

const healthDeviceSchema = z.object({
  id: deviceKindSchema,
  deviceName: z.string().trim().min(1).max(140).optional(),
  connectedAt: z.string().datetime().optional(),
  method: z.enum(["web_bluetooth"]).default("web_bluetooth"),
  status: z.enum(["ready", "not_set", "failed"]).default("ready"),
  sourceRef: healthDeviceSourceRefSchema.optional(),
});

const upsertDeviceSchema = z.object({
  device: healthDeviceSchema,
});

type HealthDevice = z.infer<typeof healthDeviceSchema>;

async function activeProfileId(req: Request, res: Response): Promise<string | null> {
  const accountUserId = req.user?.id;
  if (!accountUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const context = await getActiveProfileContext(accountUserId);
  if (!context.profileId) {
    res.status(409).json({
      error: "No care profile selected",
      nextRoute: "/onboarding/who-for",
    });
    return null;
  }
  return context.profileId;
}

function consentRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeHealthDevices(value: unknown): HealthDevice[] {
  const record = consentRecord(value);
  const section = consentRecord(record.health_devices);
  const devices = Array.isArray(section.devices) ? section.devices : [];
  const normalized: HealthDevice[] = [];
  const seen = new Set<string>();

  for (const item of devices) {
    const parsed = healthDeviceSchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    normalized.push(parsed.data);
  }

  return normalized;
}

async function readConsent(profileId: string) {
  const [profile] = await db
    .select({ data_sharing_consent: profiles.data_sharing_consent })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return profile?.data_sharing_consent ?? null;
}

async function saveDevices(profileId: string, devices: HealthDevice[]) {
  const existing = consentRecord(await readConsent(profileId));
  const next = {
    ...existing,
    health_devices: {
      ...consentRecord(existing.health_devices),
      devices,
      updated_at: new Date().toISOString(),
    },
  };

  const [updated] = await db
    .update(profiles)
    .set({ data_sharing_consent: next, updated_at: new Date() })
    .where(eq(profiles.id, profileId))
    .returning({ data_sharing_consent: profiles.data_sharing_consent });

  if (!updated) return null;
  return normalizeHealthDevices(updated.data_sharing_consent);
}

function canonicalDevice(row: typeof userDeviceConnections.$inferSelect): HealthDevice | null {
  const parsed = healthDeviceSchema.safeParse({
    id: row.device_kind,
    deviceName: row.device_label ?? undefined,
    connectedAt: row.connected_at?.toISOString(),
    method: "web_bluetooth",
    status: row.status,
    sourceRef: row.metadata,
  });
  return parsed.success ? parsed.data : null;
}

async function readCanonicalDevices(profileId: string): Promise<HealthDevice[]> {
  const rows = await db.select().from(userDeviceConnections).where(and(
    eq(userDeviceConnections.user_id, profileId),
    eq(userDeviceConnections.is_active, true),
  ));
  return rows.map(canonicalDevice).filter((device): device is HealthDevice => Boolean(device));
}

async function upsertCanonicalDevice(profileId: string, device: HealthDevice) {
  const now = new Date();
  await db.insert(userDeviceConnections).values({
    user_id: profileId,
    provider: device.method,
    device_kind: device.id,
    device_label: device.deviceName ?? device.id,
    status: device.status,
    capabilities: [...VITALS_DEVICE_CAPABILITIES[device.id]],
    metadata: device.sourceRef ?? {},
    is_active: true,
    connected_at: device.connectedAt ? new Date(device.connectedAt) : now,
    last_synced_at: now,
  }).onConflictDoUpdate({
    target: [
      userDeviceConnections.user_id,
      userDeviceConnections.provider,
      userDeviceConnections.device_kind,
    ],
    set: {
      device_label: device.deviceName ?? device.id,
      status: device.status,
      capabilities: [...VITALS_DEVICE_CAPABILITIES[device.id]],
      metadata: device.sourceRef ?? {},
      is_active: true,
      last_synced_at: now,
    },
  });
}

async function migrateLegacyDevices(profileId: string, legacy: HealthDevice[]) {
  await Promise.all(legacy.map((device) => upsertCanonicalDevice(profileId, device)));
  return readCanonicalDevices(profileId);
}

router.get("/", async (req: Request, res: Response) => {
  const profileId = await activeProfileId(req, res);
  if (!profileId) return;

  try {
    const canonical = await readCanonicalDevices(profileId);
    if (canonical.length) return res.json({ devices: canonical });
    const legacy = normalizeHealthDevices(await readConsent(profileId));
    return res.json({ devices: legacy.length ? await migrateLegacyDevices(profileId, legacy) : [] });
  } catch (err) {
    console.error("[health-devices GET]", err);
    return res.status(500).json({ error: "Could not load health devices." });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const profileId = await activeProfileId(req, res);
  if (!profileId) return;

  const parsed = upsertDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid health device.", details: parsed.error.flatten() });
  }

  try {
    const current = normalizeHealthDevices(await readConsent(profileId));
    const device: HealthDevice = {
      ...parsed.data.device,
      connectedAt: parsed.data.device.connectedAt ?? new Date().toISOString(),
      status: parsed.data.device.status ?? "ready",
    };
    const next = [device, ...current.filter((item) => item.id !== device.id)];
    await upsertCanonicalDevice(profileId, device);
    const devices = await saveDevices(profileId, next);
    if (!devices) return res.status(404).json({ error: "Profile not found." });
    return res.status(201).json({ devices });
  } catch (err) {
    console.error("[health-devices POST]", err);
    return res.status(500).json({ error: "Could not save health device." });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const profileId = await activeProfileId(req, res);
  if (!profileId) return;

  const parsed = deviceKindSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ error: "Invalid health device." });

  try {
    const current = normalizeHealthDevices(await readConsent(profileId));
    const next = current.filter((item) => item.id !== parsed.data);
    await db.update(userDeviceConnections).set({ is_active: false, status: "not_set" }).where(and(
      eq(userDeviceConnections.user_id, profileId),
      eq(userDeviceConnections.device_kind, parsed.data),
    ));
    const devices = await saveDevices(profileId, next);
    if (!devices) return res.status(404).json({ error: "Profile not found." });
    return res.json({ devices });
  } catch (err) {
    console.error("[health-devices DELETE]", err);
    return res.status(500).json({ error: "Could not remove health device." });
  }
});

export default router;
