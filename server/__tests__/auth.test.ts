import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { authRouter } from "../routes/auth.js";
import { db } from "../db.js";
import { profileMemberships, profiles, teamInvitations, users } from "../../shared/schema.js";
import { and, eq, or } from "drizzle-orm";
import { AUTH_SESSION_COOKIE } from "../lib/sessionCookie.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  return app;
}

const app = buildApp();

const TEST_EMAIL = `test-auth-${randomUUID()}@example.com`;
const TEST_PASSWORD = "securepassword123";

async function cleanupEmail(email: string) {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (user) {
      await db.delete(teamInvitations).where(or(
        eq(teamInvitations.senior_id, user.id),
        eq(teamInvitations.accepted_user_id, user.id),
      ));
      await db.delete(profiles).where(eq(profiles.id, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
  } catch (err) {
    console.error(`[test] cleanupEmail failed for ${email}:`, err);
    throw err;
  }
}

describe("Auth endpoints", () => {
  beforeAll(async () => {
    await cleanupEmail(TEST_EMAIL);
  });

  afterAll(async () => {
    await cleanupEmail(TEST_EMAIL);
  });

  let registeredToken: string;
  let registeredCookie: string;

  it("POST /register creates a user and returns a valid JWT", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, language: "fr" })
      .expect(201);

    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("userId");
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.language).toBe("fr");
    const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
    registeredCookie = setCookie?.find((cookie) => cookie.startsWith(`${AUTH_SESSION_COOKIE}=`))?.split(";")[0] ?? "";
    expect(registeredCookie).toMatch(new RegExp(`^${AUTH_SESSION_COOKIE}=`));

    registeredToken = res.body.token;
  });

  it("stores the registered language in the canonical profile preference", async () => {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL.toLowerCase()))
      .limit(1);
    const [profile] = await db
      .select({ language: profiles.language, language_preference: profiles.language_preference })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    expect(profile.language).toBe("fr");
    expect(profile.language_preference).toBe("fr");
  });

  it("POST /register rejects duplicate emails with 409", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(409);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("POST /register rejects short passwords (< 8 chars) with 400", async () => {
    const uniqueEmail = `test-short-${randomUUID()}@example.com`;
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "short" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/8 char/i);
  });

  it("POST /login returns a JWT for correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("userId");
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  it("POST /login returns 401 for wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "wrongpassword" })
      .expect(401);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/incorrect/i);
  });

  it("GET /me returns user identity with a valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registeredToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("email");
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
    expect(res.body.language).toBe("fr");
  });

  it("GET /me resolves language_preference before legacy profile language", async () => {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL.toLowerCase()))
      .limit(1);

    await db
      .update(profiles)
      .set({ language: "es", language_preference: "de" })
      .where(eq(profiles.id, user.id));

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registeredToken}`)
      .expect(200);

    expect(res.body.language).toBe("de");
  });

  it("GET /me restores the user from the session cookie", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", registeredCookie)
      .expect(200);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("token");
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
  });

  it("GET /me can recover from a stale bearer token when the session cookie is valid", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer this.is.not.a.valid.token")
      .set("Cookie", registeredCookie)
      .expect(200);

    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
  });

  it("GET /me returns 401 with an invalid/expired token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer this.is.not.a.valid.token")
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /logout clears the session cookie", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .expect(200);

    const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
    expect(setCookie?.some((cookie) => (
      cookie.startsWith(`${AUTH_SESSION_COOKIE}=`) &&
      cookie.includes("Max-Age=0")
    ))).toBe(true);
  });
});

describe("Care-team invite claim flow", () => {
  const seniorEmail = `careteam-senior-${randomUUID()}@example.com`;
  const caregiverEmail = `careteam-caregiver-${randomUUID()}@example.com`;
  const otherEmail = `careteam-other-${randomUUID()}@example.com`;
  const password = "securepassword123";

  let seniorId: string;
  let caregiverId: string;
  let caregiverToken: string;
  let otherToken: string;
  let inviteId: string;
  let inviteToken: string;

  async function register(email: string) {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password })
      .expect(201);
    return { id: res.body.userId as string, token: res.body.token as string };
  }

  beforeAll(async () => {
    await cleanupEmail(seniorEmail);
    await cleanupEmail(caregiverEmail);
    await cleanupEmail(otherEmail);

    const senior = await register(seniorEmail);
    const caregiver = await register(caregiverEmail);
    const other = await register(otherEmail);

    seniorId = senior.id;
    caregiverId = caregiver.id;
    caregiverToken = caregiver.token;
    otherToken = other.token;

    await db
      .update(profiles)
      .set({ full_name: "Elena Senior" })
      .where(eq(profiles.id, seniorId));

    inviteToken = randomUUID();
    const [invite] = await db
      .insert(teamInvitations)
      .values({
        senior_id: seniorId,
        invitee_name: "Care Giver",
        invitee_email: caregiverEmail.toLowerCase(),
        role: "caregiver",
        relationship: "daughter",
        invite_token: inviteToken,
        invite_channel: "whatsapp_outbound",
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        can_receive_daily_digest: true,
        can_receive_safety_alerts: true,
        can_view_dashboard: true,
        can_view_journal_summaries: true,
      })
      .returning();
    inviteId = invite.id;
  });

  afterAll(async () => {
    if (seniorId) {
      await db.delete(teamInvitations).where(eq(teamInvitations.senior_id, seniorId));
      await db.delete(profileMemberships).where(eq(profileMemberships.profile_id, seniorId));
    }
    await cleanupEmail(seniorEmail);
    await cleanupEmail(caregiverEmail);
    await cleanupEmail(otherEmail);
  });

  it("GET /careteam-invites/:token returns a non-sensitive pending invite summary", async () => {
    const res = await request(app)
      .get(`/api/auth/careteam-invites/${inviteToken}`)
      .expect(200);

    expect(res.body.invite).toMatchObject({
      status: "pending",
      canAccept: true,
      seniorDisplayName: "Elena Senior",
      inviteeName: "Care Giver",
      role: "caregiver",
      relationship: "daughter",
      requestedPermissions: {
        dashboardAccess: true,
        journalSummaries: true,
      },
    });
    expect(JSON.stringify(res.body)).not.toContain(caregiverEmail.toLowerCase());
  });

  it("POST /careteam-invites/:token/accept requires authentication", async () => {
    const res = await request(app)
      .post(`/api/auth/careteam-invites/${inviteToken}/accept`)
      .expect(401);

    expect(res.body.error).toMatch(/sign in/i);
  });

  it("accepts a valid invite, creates membership, and selects the senior profile", async () => {
    const res = await request(app)
      .post(`/api/auth/careteam-invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${caregiverToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      status: "accepted",
      alreadyAccepted: false,
      seniorProfileId: seniorId,
      destination: "/caregiver",
    });

    const [invite] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, inviteId))
      .limit(1);
    expect(invite.status).toBe("accepted");
    expect(invite.accepted_user_id).toBe(caregiverId);
    expect(invite.accepted_at).toBeTruthy();

    const [membership] = await db
      .select()
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.user_id, caregiverId),
        eq(profileMemberships.profile_id, seniorId),
      ))
      .limit(1);
    expect(membership).toMatchObject({
      role: "caregiver",
      status: "active",
      relationship: "daughter",
    });
    expect(membership.permissions).toMatchObject({
      care_team: {
        dashboardAccess: true,
        journalSummaries: true,
      },
    });

    const [caregiver] = await db
      .select({ active_profile_id: users.active_profile_id })
      .from(users)
      .where(eq(users.id, caregiverId))
      .limit(1);
    expect(caregiver.active_profile_id).toBe(seniorId);
  });

  it("accept is idempotent for the same caregiver account", async () => {
    const res = await request(app)
      .post(`/api/auth/careteam-invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${caregiverToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      status: "accepted",
      alreadyAccepted: true,
      destination: "/caregiver",
    });
  });

  it("rejects repeat acceptance by a different account", async () => {
    const res = await request(app)
      .post(`/api/auth/careteam-invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(409);

    expect(res.body.error).toMatch(/another account/i);
  });

  it("blocks acceptance when the signed-in contact does not match the invite", async () => {
    const mismatchToken = randomUUID();
    await db
      .insert(teamInvitations)
      .values({
        senior_id: seniorId,
        invitee_name: "Wrong Contact",
        invitee_email: `wrong-${randomUUID()}@example.com`,
        role: "family_member",
        relationship: "son",
        invite_token: mismatchToken,
        invite_channel: "whatsapp_outbound",
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

    const res = await request(app)
      .post(`/api/auth/careteam-invites/${mismatchToken}/accept`)
      .set("Authorization", `Bearer ${caregiverToken}`)
      .expect(403);

    expect(res.body.error).toMatch(/invited email or mobile/i);
  });

  it("rejects expired public invite lookup with an inactive summary", async () => {
    const expiredToken = randomUUID();
    await db
      .insert(teamInvitations)
      .values({
        senior_id: seniorId,
        invitee_name: "Expired Invite",
        invitee_email: `expired-${randomUUID()}@example.com`,
        role: "family_member",
        relationship: "friend",
        invite_token: expiredToken,
        invite_channel: "whatsapp_outbound",
        status: "pending",
        expires_at: new Date(Date.now() - 60 * 1000),
      });

    const res = await request(app)
      .get(`/api/auth/careteam-invites/${expiredToken}`)
      .expect(410);

    expect(res.body.invite).toMatchObject({
      status: "expired",
      canAccept: false,
      seniorDisplayName: "Elena Senior",
    });
  });

  it("lets a new invited caregiver create an account before accepting the invite", async () => {
    const newCaregiverEmail = `careteam-new-${randomUUID()}@example.com`;
    const newInviteToken = randomUUID();

    await cleanupEmail(newCaregiverEmail);
    await db
      .insert(teamInvitations)
      .values({
        senior_id: seniorId,
        invitee_name: "New Caregiver",
        invitee_email: newCaregiverEmail.toLowerCase(),
        role: "caregiver",
        relationship: "son",
        invite_token: newInviteToken,
        invite_channel: "email",
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        can_receive_safety_alerts: true,
        can_view_dashboard: true,
      });

    try {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          email: newCaregiverEmail,
          password,
          care_team_invite_token: newInviteToken,
        })
        .expect(201);

      const newCaregiverId = registerRes.body.userId as string;
      const newCaregiverToken = registerRes.body.token as string;
      expect(registerRes.body.activeProfileId).toBeNull();

      const [selfProfile] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, newCaregiverId))
        .limit(1);
      expect(selfProfile).toBeUndefined();

      const [selfMembership] = await db
        .select({ id: profileMemberships.id })
        .from(profileMemberships)
        .where(and(
          eq(profileMemberships.user_id, newCaregiverId),
          eq(profileMemberships.profile_id, newCaregiverId),
        ))
        .limit(1);
      expect(selfMembership).toBeUndefined();

      const acceptRes = await request(app)
        .post(`/api/auth/careteam-invites/${newInviteToken}/accept`)
        .set("Authorization", `Bearer ${newCaregiverToken}`)
        .expect(200);

      expect(acceptRes.body).toMatchObject({
        ok: true,
        status: "accepted",
        alreadyAccepted: false,
        seniorProfileId: seniorId,
        destination: "/caregiver",
      });
    } finally {
      await db.delete(teamInvitations).where(eq(teamInvitations.invite_token, newInviteToken));
      await cleanupEmail(newCaregiverEmail);
    }
  });

  it("blocks care-team invite registration when the contact does not match the invitation", async () => {
    const mismatchInviteToken = randomUUID();
    const invitedEmail = `careteam-invited-${randomUUID()}@example.com`;
    const registeringEmail = `careteam-uninvited-${randomUUID()}@example.com`;

    await cleanupEmail(registeringEmail);
    await db
      .insert(teamInvitations)
      .values({
        senior_id: seniorId,
        invitee_name: "Invited Caregiver",
        invitee_email: invitedEmail.toLowerCase(),
        role: "caregiver",
        relationship: "daughter",
        invite_token: mismatchInviteToken,
        invite_channel: "email",
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

    try {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: registeringEmail,
          password,
          care_team_invite_token: mismatchInviteToken,
        })
        .expect(403);

      expect(res.body.error).toMatch(/invited email or mobile/i);
    } finally {
      await db.delete(teamInvitations).where(eq(teamInvitations.invite_token, mismatchInviteToken));
      await cleanupEmail(registeringEmail);
    }
  });
});
