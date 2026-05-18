import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import profileRouter from "../routes/profile.js";
import { db } from "../db.js";
import { lifecycleEvents, profiles, userIntakes, userMedications } from "../../shared/schema.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/profile", authMiddleware, profileRouter);
  return app;
}

const app = buildApp();
const createdUserIds = new Set<string>();

async function cleanupUser(userId: string) {
  await db.delete(lifecycleEvents).where(eq(lifecycleEvents.user_id, userId));
  await db.delete(userIntakes).where(eq(userIntakes.user_id, userId));
  await db.delete(userMedications).where(eq(userMedications.user_id, userId));
  await db.delete(profiles).where(eq(profiles.id, userId));
}

async function createProfile(values: Partial<typeof profiles.$inferInsert> = {}) {
  const userId = randomUUID();
  createdUserIds.add(userId);
  await db.insert(profiles).values({
    id: userId,
    language: "en",
    ...values,
  });
  return userId;
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    await cleanupUser(userId);
  }
  createdUserIds.clear();
});

describe("Profile readiness", () => {
  it("blocks service gates for an empty profile", async () => {
    const userId = await createProfile();

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.hasBasics).toBe(false);
    expect(res.body.services.medications.ready).toBe(false);
    expect(res.body.services.adherenceReport.ready).toBe(false);
    expect(res.body.services.sos.ready).toBe(false);
    expect(res.body.services.doctor.ready).toBe(false);
    expect(res.body.services.chat.ready).toBe(true);
    expect(res.body.services.concierge.ready).toBe(false);
    expect(res.body.services.concierge.missing[0].section).toBe("subscription");
    expect(res.body.services.symptomCheck.ready).toBe(false);
  });

  it("unlocks medication services when a usable medication exists", async () => {
    const userId = await createProfile();
    await db.insert(userMedications).values({
      user_id: userId,
      medication_name: "Metformin",
      dosage: "500mg",
      frequency: null,
      scheduled_times: null,
      added_by: "test",
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.hasMedicationForServices).toBe(true);
    expect(res.body.services.medications.ready).toBe(true);
    expect(res.body.services.adherenceReport.ready).toBe(true);
  });

  it("unlocks premium entitlement-only services during an active premium trial", async () => {
    const userId = await createProfile({
      subscription_tier: "premium",
      subscription_status: "trial",
      trial_ends_at: new Date(Date.now() + 14 * 86400000),
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.subscriptionTier).toBe("premium");
    expect(res.body.profile.subscriptionStatus).toBe("trial");
    expect(res.body.services.chat.ready).toBe(true);
    expect(res.body.services.symptomCheck.ready).toBe(true);
    expect(res.body.services.concierge.ready).toBe(true);
    expect(res.body.services.caregiverDashboard.ready).toBe(true);
  });

  it("downgrades expired no-card premium trials to free active", async () => {
    const userId = await createProfile({
      subscription_tier: "premium",
      subscription_status: "trial",
      trial_ends_at: new Date(Date.now() - 86400000),
    });
    await db.insert(userIntakes).values({
      user_id: userId,
      name: "Expired Trial User",
      phone: "+34600000002",
      tier: "premium",
      status: "active",
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.subscriptionTier).toBe("free");
    expect(res.body.profile.subscriptionStatus).toBe("active");
    expect(res.body.services.symptomCheck.ready).toBe(false);
    expect(res.body.services.concierge.ready).toBe(false);

    const [profile] = await db
      .select({
        tier: profiles.subscription_tier,
        status: profiles.subscription_status,
        trial_ends_at: profiles.trial_ends_at,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    expect(profile?.tier).toBe("free");
    expect(profile?.status).toBe("active");
    expect(profile?.trial_ends_at).toBeNull();

    const [intake] = await db
      .select({ tier: userIntakes.tier })
      .from(userIntakes)
      .where(eq(userIntakes.user_id, userId))
      .limit(1);
    expect(intake?.tier).toBe("free");
  });

  it("keeps free active profiles free even if old trial dates exist", async () => {
    const userId = await createProfile({
      subscription_tier: "free",
      subscription_status: "active",
      trial_ends_at: new Date(Date.now() - 86400000),
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.subscriptionTier).toBe("free");
    expect(res.body.profile.subscriptionStatus).toBe("active");
    expect(res.body.services.chat.ready).toBe(true);
    expect(res.body.services.concierge.ready).toBe(false);
  });

  it("keeps paid premium active access even if a stale trial date exists", async () => {
    const userId = await createProfile({
      subscription_tier: "premium",
      subscription_status: "active",
      trial_ends_at: new Date(Date.now() - 86400000),
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.subscriptionTier).toBe("premium");
    expect(res.body.profile.subscriptionStatus).toBe("active");
    expect(res.body.services.symptomCheck.ready).toBe(true);
    expect(res.body.services.concierge.ready).toBe(true);
  });

  it("repairs stale free profiles when lifecycle says premium", async () => {
    const userId = await createProfile({
      subscription_tier: "free",
      subscription_status: "trial",
    });
    await db.insert(userIntakes).values({
      user_id: userId,
      name: "Premium Lifecycle User",
      phone: "+34600000001",
      tier: "premium",
      status: "active",
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.subscriptionTier).toBe("premium");
    expect(res.body.profile.storedSubscriptionTier).toBe("free");
    expect(res.body.profile.entitlementRepaired).toBe(true);
    expect(res.body.services.concierge.ready).toBe(true);

    const [profile] = await db
      .select({ tier: profiles.subscription_tier, status: profiles.subscription_status })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    expect(profile?.tier).toBe("premium");
    expect(profile?.status).toBe("active");

    const [event] = await db
      .select()
      .from(lifecycleEvents)
      .where(eq(lifecycleEvents.user_id, userId))
      .limit(1);
    expect(event?.event_type).toBe("entitlement_self_healed");
    expect(event?.channel).toBe("system");
  });

  it("keeps local services blocked when address is too partial", async () => {
    const userId = await createProfile({ city: "Madrid" });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.hasLocalAddress).toBe(false);
    expect(res.body.services.localServices.ready).toBe(false);
  });

  it("unlocks SOS when detailed address and emergency contact exist", async () => {
    const userId = await createProfile({
      full_name: "Test User",
      phone_number: "+34600000000",
      address_line_1: "12 Calle Mayor",
      city: "Madrid",
      postcode: "28001",
      country_code: "ES",
      data_sharing_consent: {
        emergency: {
          emergency_name: "Mary User",
          emergency_phone: "+34611111111",
          emergency_role: "Daughter",
        },
      },
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.services.sos.ready).toBe(true);
    expect(res.body.services.doctor.ready).toBe(true);
  });
});
