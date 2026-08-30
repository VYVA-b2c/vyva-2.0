import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { db } from "../db.js";
import { medicationInventoryEvents, myMedicines, profiles } from "../../shared/schema.js";
import { requireActiveProfileId } from "../lib/profileAccess.js";
import { resolveDomainAccess, type CaregiverDomainAccessContext } from "../lib/caregiverDomainAccess.js";
import { getRefillSummaries, reconcileRefillAlerts, serializeRefillAlert } from "../medication/refillAlerts.js";
import { ensureRefillPersistence } from "../medication/refillPersistence.js";

const router = Router();

const settingsSchema = z.object({
  doseUnit: z.string().trim().min(1).max(40),
  unitsPerDose: z.coerce.number().positive().max(10_000),
  dailyFrequency: z.coerce.number().positive().max(24),
  refillAlertDays: z.coerce.number().int().min(1).max(90).default(7),
});

const inventoryEventSchema = settingsSchema.extend({
  quantity: z.coerce.number().nonnegative().max(1_000_000),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["manual", "photo", "caregiver"]).default("manual"),
});

const photoSchema = z.object({
  image: z.string().min(32).max(14_000_000),
  language: z.string().trim().max(20).default("en"),
});

async function resolveProfileId(req: Request, res: Response) {
  return req.params.profileId === "me" ? requireActiveProfileId(req.user!.id, res) : req.params.profileId;
}

async function requireInventoryAccess(req: Request, res: Response): Promise<{ profileId: string; access: CaregiverDomainAccessContext } | null> {
  const profileId = await resolveProfileId(req, res);
  if (!profileId) return null;
  const access = await resolveDomainAccess({
    actorUserId: req.user!.id,
    targetUserId: profileId,
    domain: "meds",
    requiredPermission: "manage_inventory",
    actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
    actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
  });
  if (!access) {
    res.status(403).json({ error: "Medication inventory access is not enabled." });
    return null;
  }
  return { profileId, access };
}

async function requireRefillReadAccess(req: Request, res: Response): Promise<{ profileId: string; access: CaregiverDomainAccessContext } | null> {
  const profileId = await resolveProfileId(req, res);
  if (!profileId) return null;
  const access = await resolveDomainAccess({
    actorUserId: req.user!.id,
    targetUserId: profileId,
    domain: "meds",
    actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
    actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
  });
  const canRead = Boolean(
    access && (
      access.isOwnProfile
      || access.isAdmin
      || access.permissions.view_adherence
      || access.permissions.receive_refill_alerts
      || access.permissions.manage_inventory
    )
  );
  if (!access || !canRead) {
    res.status(403).json({ error: "Medication refill alert access is not enabled." });
    return null;
  }
  return { profileId, access };
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function actorName(actorUserId: string) {
  const [actor] = await db.select({
    preferredName: profiles.preferred_name,
    fullName: profiles.full_name,
    email: profiles.email,
  }).from(profiles).where(eq(profiles.id, actorUserId)).limit(1);
  return actor?.preferredName?.trim() || actor?.fullName?.trim() || actor?.email?.trim() || "VYVA user";
}

async function saveInventoryEvent(req: Request, res: Response, eventType: "purchase" | "stock_count") {
  const context = await requireInventoryAccess(req, res);
  if (!context) return;
  const parsed = inventoryEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid inventory details", details: parsed.error.issues });
  if (parsed.data.occurredOn > new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: "The inventory date cannot be in the future." });
  }
  await ensureRefillPersistence();
  const [medicine] = await db.select().from(myMedicines).where(and(
    eq(myMedicines.id, req.params.medicineId),
    eq(myMedicines.user_id, context.profileId),
    eq(myMedicines.status, "active"),
  )).limit(1);
  if (!medicine) return res.status(404).json({ error: "Medicine not found" });

  const name = await actorName(req.user!.id);
  const source = context.access.isOwnProfile ? parsed.data.source : "caregiver";
  await db.transaction(async (tx) => {
    await tx.update(myMedicines).set({
      dose_unit: parsed.data.doseUnit,
      units_per_dose: String(parsed.data.unitsPerDose),
      daily_frequency: String(parsed.data.dailyFrequency),
      refill_alert_days: parsed.data.refillAlertDays,
      inventory_tracking_enabled: true,
      updated_at: new Date(),
    }).where(and(eq(myMedicines.id, medicine.id), eq(myMedicines.user_id, context.profileId)));
    await tx.insert(medicationInventoryEvents).values({
      user_id: context.profileId,
      medicine_id: medicine.id,
      event_type: eventType,
      quantity: String(parsed.data.quantity),
      unit: parsed.data.doseUnit,
      occurred_on: parsed.data.occurredOn,
      source,
      actor_user_id: req.user!.id,
      actor_role: context.access.actorRole,
      actor_name: name,
      metadata: { confirmed: true },
    });
  });

  const summaries = await getRefillSummaries(context.profileId);
  const summary = summaries.find((item) => item.medicineId === medicine.id) ?? null;
  await db.update(myMedicines).set({ refill_due_date: summary?.projectedRunOutDate ?? null }).where(eq(myMedicines.id, medicine.id));
  const alerts = await reconcileRefillAlerts(context.profileId, summaries);
  return res.status(201).json({ summary, alerts: alerts.map(serializeRefillAlert) });
}

router.get("/:profileId", async (req: Request, res: Response) => {
  try {
    const context = await requireRefillReadAccess(req, res);
    if (!context) return;
    const medicines = await getRefillSummaries(context.profileId);
    const alerts = await reconcileRefillAlerts(context.profileId, medicines);
    return res.json({
      profileId: context.profileId,
      permissions: context.access.permissions,
      actorRole: context.access.actorRole,
      medicines,
      alerts: alerts.map(serializeRefillAlert),
    });
  } catch (error) {
    console.error("[meds/refills GET]", error);
    return res.status(500).json({ error: "Failed to load refill tracking" });
  }
});

router.post("/:profileId/medicines/:medicineId/purchases", async (req, res) => {
  try { return await saveInventoryEvent(req, res, "purchase"); }
  catch (error) { console.error("[meds/refills purchase]", error); return res.status(500).json({ error: "Failed to save the purchase" }); }
});

router.post("/:profileId/medicines/:medicineId/stock-counts", async (req, res) => {
  try { return await saveInventoryEvent(req, res, "stock_count"); }
  catch (error) { console.error("[meds/refills stock count]", error); return res.status(500).json({ error: "Failed to save the stock count" }); }
});

router.patch("/:profileId/medicines/:medicineId/settings", async (req, res) => {
  try {
    const context = await requireInventoryAccess(req, res);
    if (!context) return;
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid refill settings", details: parsed.error.issues });
    await ensureRefillPersistence();
    const [updated] = await db.update(myMedicines).set({
      dose_unit: parsed.data.doseUnit,
      units_per_dose: String(parsed.data.unitsPerDose),
      daily_frequency: String(parsed.data.dailyFrequency),
      refill_alert_days: parsed.data.refillAlertDays,
      inventory_tracking_enabled: true,
      updated_at: new Date(),
    }).where(and(eq(myMedicines.id, req.params.medicineId), eq(myMedicines.user_id, context.profileId))).returning();
    if (!updated) return res.status(404).json({ error: "Medicine not found" });
    const summaries = await getRefillSummaries(context.profileId);
    const summary = summaries.find((item) => item.medicineId === updated.id) ?? null;
    await db.update(myMedicines).set({ refill_due_date: summary?.projectedRunOutDate ?? null }).where(eq(myMedicines.id, updated.id));
    const alerts = await reconcileRefillAlerts(context.profileId, summaries);
    return res.json({ summary, alerts: alerts.map(serializeRefillAlert) });
  } catch (error) {
    console.error("[meds/refills settings]", error);
    return res.status(500).json({ error: "Failed to update refill settings" });
  }
});

router.post("/:profileId/photo-extract", async (req, res) => {
  try {
    const context = await requireInventoryAccess(req, res);
    if (!context) return;
    const parsed = photoSchema.safeParse(req.body);
    if (!parsed.success || !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(parsed.data.image)) {
      return res.status(400).json({ error: "A valid medicine-label photo is required." });
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return res.json({
        draft: { medicineName: "", strength: "", packageCount: null, unitsPerPackage: null, totalQuantity: null, doseUnit: "tablet", purchasedOn: new Date().toISOString().slice(0, 10) },
        confidence: "low",
        fieldConfidence: {},
        warnings: ["VYVA could not read this photo automatically. Please enter the visible details."],
        imageRetained: false,
      });
    }
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o",
      temperature: 0.1,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [{
        role: "system",
        content: `Read visible medicine package and purchase details for an inventory draft. Return JSON only: {"medicineName":"", "strength":"", "packageCount":number|null, "unitsPerPackage":number|null, "totalQuantity":number|null, "doseUnit":"tablet|capsule|ml|dose|patch|other", "purchasedOn":"YYYY-MM-DD|null", "confidence":"high|medium|low", "fieldConfidence":{}, "warnings":[]}. Do not recommend or change a dose. Use ${parsed.data.language}. Use null when unreadable.`,
      }, {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: parsed.data.image, detail: "high" } },
          { type: "text", text: "Extract a draft for the user to review. The image must not be retained." },
        ],
      }],
    });
    const model = JSON.parse(response.choices[0]?.message?.content || "{}") as Record<string, unknown>;
    const packageCount = numberValue(model.packageCount);
    const unitsPerPackage = numberValue(model.unitsPerPackage);
    const totalQuantity = numberValue(model.totalQuantity) ?? (packageCount && unitsPerPackage ? packageCount * unitsPerPackage : null);
    return res.json({
      draft: {
        medicineName: typeof model.medicineName === "string" ? model.medicineName.slice(0, 160) : "",
        strength: typeof model.strength === "string" ? model.strength.slice(0, 80) : "",
        packageCount,
        unitsPerPackage,
        totalQuantity,
        doseUnit: typeof model.doseUnit === "string" ? model.doseUnit.slice(0, 40) : "tablet",
        purchasedOn: typeof model.purchasedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(model.purchasedOn) ? model.purchasedOn : new Date().toISOString().slice(0, 10),
      },
      confidence: ["high", "medium", "low"].includes(String(model.confidence)) ? model.confidence : "low",
      fieldConfidence: model.fieldConfidence && typeof model.fieldConfidence === "object" ? model.fieldConfidence : {},
      warnings: Array.isArray(model.warnings) ? model.warnings.filter((item): item is string => typeof item === "string").slice(0, 5) : [],
      imageRetained: false,
    });
  } catch (error) {
    console.error("[meds/refills photo extract]", error);
    return res.status(500).json({ error: "VYVA could not read this photo. You can enter the details manually." });
  }
});

export default router;
