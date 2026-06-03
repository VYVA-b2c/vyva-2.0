import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import profileRouter from "../routes/profile.js";
import { db } from "../db.js";
import { profileMemberships, profiles, users } from "../../shared/schema.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/profile", authMiddleware, profileRouter);
  return app;
}

const app = buildApp();
const createdProfileIds = new Set<string>();
const createdAccountIds = new Set<string>();

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

async function createAccount(values: Partial<typeof users.$inferInsert> = {}) {
  const accountId = randomUUID();
  createdAccountIds.add(accountId);
  await db.insert(users).values({
    id: accountId,
    email: `profile-save-${randomUUID()}@example.com`,
    password_hash: "test",
    ...values,
  });
  return accountId;
}

afterEach(async () => {
  for (const accountId of createdAccountIds) {
    await db.delete(profileMemberships).where(eq(profileMemberships.user_id, accountId));
  }
  for (const profileId of createdProfileIds) {
    await db.delete(profileMemberships).where(eq(profileMemberships.profile_id, profileId));
    await db.delete(profiles).where(eq(profiles.id, profileId));
  }
  for (const accountId of createdAccountIds) {
    await db.delete(users).where(eq(users.id, accountId));
  }
  createdProfileIds.clear();
  createdAccountIds.clear();
});

describe("Profile save", () => {
  it("does not copy the account email onto a separate active care profile", async () => {
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const seniorProfileId = await createProfile({
      full_name: "Elena Senior",
      phone_number: "+34600000001",
    });
    const accountId = await createAccount({
      email: accountEmail,
      active_profile_id: seniorProfileId,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      email: accountEmail,
      phone_number: "+34600000002",
    });
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: seniorProfileId,
      role: "caregiver",
      relationship: "daughter",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    await request(app)
      .post("/api/profile")
      .set("x-user-id", accountId)
      .send({
        firstName: "Elena",
        lastName: "Senior",
        preferredName: "Elena",
        dateOfBirth: "1942-04-10",
        email: accountEmail,
        phone: "+34600000001",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(200);

    const [profile] = await db
      .select({
        full_name: profiles.full_name,
        email: profiles.email,
        phone_number: profiles.phone_number,
        language_preference: profiles.language_preference,
      })
      .from(profiles)
      .where(eq(profiles.id, seniorProfileId))
      .limit(1);

    expect(profile).toMatchObject({
      full_name: "Elena Senior",
      email: null,
      phone_number: "+34600000001",
      language_preference: "en",
    });
  });
});
