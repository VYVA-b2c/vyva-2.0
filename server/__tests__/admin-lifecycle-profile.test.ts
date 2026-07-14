import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { adminLifecycleRouter } from "../routes/adminLifecycle.js";
import { db } from "../db.js";
import { accessLinks, profileMemberships, profiles, teamInvitations, userIntakes, users } from "../../shared/schema.js";

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
const createdUserIds = new Set<string>();
const createdInvitationIds = new Set<string>();
const createdAccessLinkIds = new Set<string>();

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

async function createUser(values: Partial<typeof users.$inferInsert> = {}) {
  const userId = typeof values.id === "string" ? values.id : randomUUID();
  createdUserIds.add(userId);
  await db.insert(users).values({
    id: userId,
    password_hash: "test-password-hash",
    ...values,
  });
  return userId;
}

afterEach(async () => {
  for (const inviteId of createdInvitationIds) {
    await db.delete(teamInvitations).where(eq(teamInvitations.id, inviteId));
  }
  for (const linkId of createdAccessLinkIds) {
    await db.delete(accessLinks).where(eq(accessLinks.id, linkId));
  }
  for (const intakeId of createdIntakeIds) {
    await db.delete(userIntakes).where(eq(userIntakes.id, intakeId));
  }
  for (const userId of createdUserIds) {
    await db.delete(users).where(eq(users.id, userId));
  }
  for (const profileId of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, profileId));
  }
  createdInvitationIds.clear();
  createdAccessLinkIds.clear();
  createdIntakeIds.clear();
  createdUserIds.clear();
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

  it("syncs admin identity edits to app profile fields", async () => {
    const targetProfileId = await createProfile({
      full_name: "Language Elder",
      phone_number: "+34600000012",
      country_code: "ES",
      language: "en",
      language_preference: "en",
      data_sharing_consent: { identity: { gender: "prefer_not" } },
    });
    const intake = await createIntake({
      user_id: targetProfileId,
      elder_user_id: targetProfileId,
      phone: "+34600000012",
    });

    await request(app)
      .patch(`/api/admin/lifecycle/users/${intake.id}/profile`)
      .send({ language: "de", country_code: "DE", gender: "female" })
      .expect(200);

    const [targetProfile] = await db
      .select({
        country_code: profiles.country_code,
        data_sharing_consent: profiles.data_sharing_consent,
        language: profiles.language,
        language_preference: profiles.language_preference,
      })
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .limit(1);

    expect(targetProfile).toMatchObject({
      country_code: "DE",
      language: "de",
      language_preference: "de",
    });
    expect((targetProfile?.data_sharing_consent as { identity?: { gender?: string } })?.identity?.gender).toBe("female");
  });

  it("deletes a linked legacy login account and releases its email for caregiver signup", async () => {
    const accountId = randomUUID();
    const caregiverAccountId = randomUUID();
    const email = `delete-login-${randomUUID()}@example.com`;
    const phone = `+346${String(Date.now()).slice(-8)}`;
    await createUser({
      id: accountId,
      email,
      phone_number: phone,
      active_profile_id: accountId,
    });
    await createUser({
      id: caregiverAccountId,
      email: `caregiver-${randomUUID()}@example.com`,
      active_profile_id: accountId,
    });
    await createProfile({
      id: accountId,
      full_name: "Delete Login",
      email,
      phone_number: phone,
      account_status: "enabled",
    });
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: accountId,
      role: "elder",
      relationship: "self",
      is_primary: true,
      accepted_at: new Date(),
    });
    await db.insert(profileMemberships).values({
      user_id: caregiverAccountId,
      profile_id: accountId,
      role: "caregiver",
      relationship: "son",
      status: "active",
      accepted_at: new Date(),
    });
    const intake = await createIntake({
      name: "Delete Login",
      user_id: accountId,
      elder_user_id: accountId,
      phone,
      email,
      status: "active",
      journey_step: "profile_completed",
    });
    const [invitation] = await db.insert(teamInvitations).values({
      senior_id: accountId,
      invitee_name: "Care Helper",
      invitee_email: `helper-${randomUUID()}@example.com`,
      role: "caregiver",
      invite_token: randomUUID(),
      invite_channel: "email",
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).returning({ id: teamInvitations.id });
    createdInvitationIds.add(invitation.id);
    const [accessLink] = await db.insert(accessLinks).values({
      token: randomUUID(),
      user_id: accountId,
      intake_id: intake.id,
      link_type: "trial",
      tier: "free",
      destination: "/onboarding",
      target_role: "elder",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).returning({ id: accessLinks.id });
    createdAccessLinkIds.add(accessLink.id);

    const response = await request(app)
      .post(`/api/admin/lifecycle/users/${intake.id}/delete-login-account`)
      .send({
        confirm: "DELETE_LOGIN_ACCOUNT",
        source: "legacy",
        login_uid: accountId,
      })
      .expect(200);

    expect(response.body.deleted_login_account).toMatchObject({ id: accountId, email, phone_number: phone });
    expect(response.body.released_contacts).toContain(email);

    const [deletedAccount] = await db.select().from(users).where(eq(users.id, accountId)).limit(1);
    expect(deletedAccount).toMatchObject({
      email: null,
      phone_number: null,
      active_profile_id: null,
      onboarding_intent: "admin_deleted_login",
    });
    expect(deletedAccount?.password_hash).toMatch(/^revoked:/);

    const [closedProfile] = await db
      .select({
        account_status: profiles.account_status,
        disabled_reason: profiles.disabled_reason,
        email: profiles.email,
        phone_number: profiles.phone_number,
      })
      .from(profiles)
      .where(eq(profiles.id, accountId))
      .limit(1);
    expect(closedProfile).toMatchObject({
      account_status: "disabled",
      disabled_reason: "Login account deleted by admin",
      email: null,
      phone_number: null,
    });

    const [revokedMembership] = await db
      .select({ status: profileMemberships.status })
      .from(profileMemberships)
      .where(eq(profileMemberships.user_id, caregiverAccountId))
      .limit(1);
    expect(revokedMembership?.status).toBe("revoked");

    const [revokedInvitation] = await db
      .select({ status: teamInvitations.status })
      .from(teamInvitations)
      .where(eq(teamInvitations.id, invitation.id))
      .limit(1);
    expect(revokedInvitation?.status).toBe("revoked");

    const [revokedLink] = await db
      .select({ revoked_at: accessLinks.revoked_at })
      .from(accessLinks)
      .where(eq(accessLinks.id, accessLink.id))
      .limit(1);
    expect(revokedLink?.revoked_at).toBeTruthy();

    const [hiddenIntake] = await db
      .select({ journey_step: userIntakes.journey_step, metadata: userIntakes.metadata })
      .from(userIntakes)
      .where(eq(userIntakes.id, intake.id))
      .limit(1);
    expect(hiddenIntake?.journey_step).toBe("admin_deleted");
    expect(hiddenIntake?.metadata).toMatchObject({
      login_account_deleted: true,
      app_access_changed: true,
    });

    const replacementId = await createUser({
      email,
      password_hash: "replacement-password-hash",
    });
    expect(replacementId).toBeTruthy();
  });
});
