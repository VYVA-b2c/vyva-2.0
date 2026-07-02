import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { adminLifecycleRouter } from "../routes/adminLifecycle.js";
import { db } from "../db.js";
import { profiles, userIntakes } from "../../shared/schema.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/lifecycle", (req, _res, next) => {
    req.user = { id: "admin-test", role: "admin", email: "admin@example.com" };
    next();
  }, adminLifecycleRouter);
  return app;
}

const app = buildApp();
const createdProfileIds = new Set<string>();
const createdIntakeIds = new Set<string>();

async function createProfile(values: Partial<typeof profiles.$inferInsert> = {}) {
  const profileId = typeof values.id === "string" ? values.id : randomUUID();
  createdProfileIds.add(profileId);
  await db.insert(profiles).values({
    id: profileId,
    language: "en",
    ...values,
  });
  return profileId;
}

async function createIntake(values: Partial<typeof userIntakes.$inferInsert> = {}) {
  const [intake] = await db.insert(userIntakes).values({
    name: "Target Elder",
    phone: "+34600000002",
    user_type: "elder",
    entry_point: "form",
    tier: "free",
    status: "created",
    journey_step: "created",
    consent_status: "not_required",
    source_payload: {},
    metadata: {},
    ...values,
  }).returning();
  createdIntakeIds.add(intake.id);
  return intake;
}

afterEach(async () => {
  for (const intakeId of createdIntakeIds) {
    await db.delete(userIntakes).where(eq(userIntakes.id, intakeId));
  }
  for (const profileId of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, profileId));
  }
  createdIntakeIds.clear();
  createdProfileIds.clear();
});

describe("Admin lifecycle profile updates", () => {
  it("returns all editable profile fields for the admin detail drawer", async () => {
    const profileId = await createProfile({
      full_name: "Detail Elder",
      preferred_name: "Detail",
      date_of_birth: "1945-02-03",
      email: "detail-elder@example.com",
      phone_number: "+34600000003",
      whatsapp_number: "+34600000004",
      language: "en",
      timezone: "Europe/London",
      caregiver_name: "Mary Helper",
      caregiver_contact: "mary@example.com",
    });
    const intake = await createIntake({
      name: "Detail Elder",
      user_id: profileId,
      elder_user_id: profileId,
      phone: "+34600000003",
      email: "detail-elder@example.com",
    });

    const response = await request(app)
      .get(`/api/admin/lifecycle/users/${intake.id}/details`)
      .expect(200);

    expect(response.body.profile).toMatchObject({
      id: profileId,
      full_name: "Detail Elder",
      preferred_name: "Detail",
      date_of_birth: "1945-02-03",
      email: "detail-elder@example.com",
      phone_number: "+34600000003",
      whatsapp_number: "+34600000004",
      language: "en",
      timezone: "Europe/London",
      caregiver_name: "Mary Helper",
      caregiver_contact: "mary@example.com",
    });
  });

  it("rejects phone numbers already used by another profile", async () => {
    await createProfile({
      full_name: "Existing Elder",
      phone_number: "+34600000999",
    });
    const targetProfileId = await createProfile({
      full_name: "Target Elder",
      phone_number: "+34600000002",
    });
    const intake = await createIntake({
      user_id: targetProfileId,
      elder_user_id: targetProfileId,
      phone: "+34600000002",
    });

    const response = await request(app)
      .patch(`/api/admin/lifecycle/users/${intake.id}/profile`)
      .send({ phone_number: "+34 600 000 999" })
      .expect(409);

    expect(response.body).toMatchObject({
      error: "That phone number is already used on another profile. Choose a different profile phone number.",
    });

    const [targetProfile] = await db
      .select({ phone_number: profiles.phone_number })
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .limit(1);

    expect(targetProfile?.phone_number).toBe("+34600000002");
  });
});
