import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { authMiddleware } from "../middleware/auth.js";
import { onboardingRouter } from "../routes/onboarding.js";
import { db } from "../db.js";
import { communicationsLog, profiles, onboardingState, userChannelPreferences, teamInvitations, userMedications } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", authMiddleware, onboardingRouter);
  return app;
}

const app = buildApp();

const TEST_USER_ID = randomUUID();

async function cleanupUser(userId: string) {
  try {
    await db.delete(teamInvitations).where(eq(teamInvitations.senior_id, userId));
    await db.delete(communicationsLog).where(eq(communicationsLog.user_id, userId));
    await db.delete(userMedications).where(eq(userMedications.user_id, userId));
    await db.delete(userChannelPreferences).where(eq(userChannelPreferences.user_id, userId));
    await db.delete(onboardingState).where(eq(onboardingState.user_id, userId));
    await db.delete(profiles).where(eq(profiles.id, userId));
  } catch (err) {
    console.error(`[test] cleanupUser failed for ${userId}:`, err);
    throw err;
  }
}

describe("Onboarding journey — end-to-end", () => {
  beforeAll(async () => {
    await cleanupUser(TEST_USER_ID);
  });

  afterAll(async () => {
    await cleanupUser(TEST_USER_ID);
  });

  it("returns 401 when x-user-id header is missing", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .expect(401);

    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("GET /state returns null profile before onboarding starts", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body).toHaveProperty("profile");
    expect(res.body).toHaveProperty("onboardingState");
    expect(res.body.profile).toBeNull();
  });

  it("POST /basics creates profile and advances to stage_2_preferences", async () => {
    const res = await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", TEST_USER_ID)
      .send({
        full_name: "Test User",
        preferred_name: "Testy",
        date_of_birth: "1950-01-15",
        language: "en",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
    expect(res.body).toHaveProperty("trial_ends_at");

    const [profile] = await db
      .select({
        subscription_tier: profiles.subscription_tier,
        subscription_status: profiles.subscription_status,
        trial_ends_at: profiles.trial_ends_at,
      })
      .from(profiles)
      .where(eq(profiles.id, TEST_USER_ID))
      .limit(1);

    expect(profile?.subscription_tier).toBe("premium");
    expect(profile?.subscription_status).toBe("trial");
    expect(profile?.trial_ends_at).toBeTruthy();
    const trialDays = profile?.trial_ends_at
      ? Math.ceil((new Date(profile.trial_ends_at).getTime() - Date.now()) / 86400000)
      : 0;
    expect(trialDays).toBeGreaterThanOrEqual(13);
    expect(trialDays).toBeLessThanOrEqual(14);
  });

  it("POST /basics rejects missing full_name with 400", async () => {
    const res = await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", TEST_USER_ID)
      .send({ language: "en" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("GET /state reflects stage_2_preferences after basics", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.profile.current_stage).toBe("stage_2_preferences");
    expect(res.body.profile.full_name).toBe("Test User");
  });

  it("POST /consent is blocked before channel step (stage gate)", async () => {
    const res = await request(app)
      .post("/api/onboarding/consent")
      .set("x-user-id", TEST_USER_ID)
      .send({
        entries: [{ scope: "conversation_summary", action: "granted", channel: "web_form" }],
      })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.required_stage).toBe("stage_3_health");
  });

  it("POST /channel saves preferences and advances to stage_3_health", async () => {
    const res = await request(app)
      .post("/api/onboarding/channel")
      .set("x-user-id", TEST_USER_ID)
      .send({
        preferred_checkin_channel: "voice_outbound",
        preferred_conversation_channel: "voice_app",
        preferred_reminder_channel: "voice_outbound",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });

    const [preferences] = await db
      .select()
      .from(userChannelPreferences)
      .where(eq(userChannelPreferences.user_id, TEST_USER_ID))
      .limit(1);
    expect(preferences?.preferred_checkin_channel).toBe("voice_outbound");
    expect(preferences?.preferred_reminder_channel).toBe("voice_outbound");
  });

  it("GET /state reflects stage_3_health after channel step", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.profile.current_stage).toBe("stage_3_health");
  });

  it("POST /channel is blocked when basics not yet completed (stage gate)", async () => {
    const otherUser = randomUUID();
    const res = await request(app)
      .post("/api/onboarding/channel")
      .set("x-user-id", otherUser)
      .send({ preferred_checkin_channel: "voice_outbound" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /section/conditions saves health conditions", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/conditions")
      .set("x-user-id", TEST_USER_ID)
      .send({ health_conditions: ["Type 2 Diabetes", "Hypertension"] })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "conditions" });
  });

  it("POST /section/conditions persists explicit no known conditions", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/conditions")
      .set("x-user-id", TEST_USER_ID)
      .send({ health_conditions: [], no_known_conditions: true })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "conditions" });

    const stateRes = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(stateRes.body.profile.conditions).toEqual([]);
    expect(stateRes.body.profile.no_known_conditions).toBe(true);
    expect(stateRes.body.onboardingState.has_health_conditions).toBe(false);
  });

  it("POST /section/conditions does not complete empty health without explicit none", async () => {
    await request(app)
      .post("/api/onboarding/section/conditions")
      .set("x-user-id", TEST_USER_ID)
      .send({ health_conditions: [] })
      .expect(200);

    const stateRes = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(stateRes.body.profile.no_known_conditions).toBe(false);
    expect(stateRes.body.onboardingState.has_health_conditions).toBe(false);
  });

  it("POST /section/medications saves medications and allergies", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/medications")
      .set("x-user-id", TEST_USER_ID)
      .send({
        medications: [
          { medication_name: "Metformin", dosage: "500mg", frequency: "twice daily" },
        ],
        known_allergies: ["Penicillin"],
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "medications" });
  });

  it("POST /section/medications saves for text profile ids", async () => {
    const externalUserId = `external-profile-${randomUUID()}`;
    await cleanupUser(externalUserId);

    try {
      await request(app)
        .post("/api/onboarding/basics")
        .set("x-user-id", externalUserId)
        .send({
          full_name: "External Profile",
          preferred_name: "External",
          date_of_birth: "1950-01-15",
          language: "en",
        })
        .expect(200);

      const res = await request(app)
        .post("/api/onboarding/section/medications")
        .set("x-user-id", externalUserId)
        .send({
          medications: [
            { medication_name: "Metformin", dosage: "500mg", frequency: "once_daily" },
          ],
        })
        .expect(200);

      expect(res.body).toMatchObject({ ok: true, section: "medications" });

      const [medication] = await db
        .select({ medication_name: userMedications.medication_name })
        .from(userMedications)
        .where(eq(userMedications.user_id, externalUserId))
        .limit(1);

      expect(medication?.medication_name).toBe("Metformin");
    } finally {
      await cleanupUser(externalUserId);
    }
  });

  it("POST /section/medications persists no current medications without service medication rows", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/medications")
      .set("x-user-id", TEST_USER_ID)
      .send({ medications: [], no_known_medications: true })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "medications" });

    const stateRes = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(stateRes.body.profile.medications).toEqual([]);
    expect(stateRes.body.profile.no_known_medications).toBe(true);
    expect(stateRes.body.onboardingState.has_medications).toBe(false);
  });

  it("POST /section/medications preserves medications when saving allergies only", async () => {
    await request(app)
      .post("/api/onboarding/section/medications")
      .set("x-user-id", TEST_USER_ID)
      .send({ medications: [{ medication_name: "Atorvastatin", dosage: "20mg" }] })
      .expect(200);

    await request(app)
      .post("/api/onboarding/section/medications")
      .set("x-user-id", TEST_USER_ID)
      .send({ known_allergies: ["Peanuts"] })
      .expect(200);

    const stateRes = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(stateRes.body.profile.medications).toEqual([
      expect.objectContaining({ name: "Atorvastatin", dosage: "20mg" }),
    ]);
    expect(stateRes.body.profile.known_allergies).toEqual(["Peanuts"]);
    expect(stateRes.body.profile.no_known_allergies).toBe(false);
  });

  it("POST /section/medications persists explicit no known allergies", async () => {
    await request(app)
      .post("/api/onboarding/section/medications")
      .set("x-user-id", TEST_USER_ID)
      .send({ known_allergies: [], no_known_allergies: true })
      .expect(200);

    const stateRes = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(stateRes.body.profile.known_allergies).toEqual([]);
    expect(stateRes.body.profile.no_known_allergies).toBe(true);
    expect(stateRes.body.onboardingState.has_allergies).toBe(false);
  });

  it("POST /section/address saves address details", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/address")
      .set("x-user-id", TEST_USER_ID)
      .send({
        address_line_1: "12 Oak Street",
        city: "London",
        postcode: "SW1A 1AA",
        country_code: "GB",
        timezone: "Europe/London",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "address" });

    const [state] = await db
      .select({
        has_location: onboardingState.has_location,
        has_emergency_address: onboardingState.has_emergency_address,
      })
      .from(onboardingState)
      .where(eq(onboardingState.user_id, TEST_USER_ID))
      .limit(1);

    expect(state?.has_location).toBe(true);
    expect(state?.has_emergency_address).toBe(false);
  });

  it("POST /section/gp saves GP details", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/gp")
      .set("x-user-id", TEST_USER_ID)
      .send({
        gp_name: "Dr. Jane Smith",
        gp_phone: "020 7946 0958",
        gp_email: "gp@example.com",
        gp_address: "1 Health Centre, London",
        gp_maps_url: "",
        gp_place_id: "",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "gp" });

    const [profile] = await db
      .select({
        gp_name: profiles.gp_name,
        gp_phone: profiles.gp_phone,
        gp_email: profiles.gp_email,
        gp_address: profiles.gp_address,
      })
      .from(profiles)
      .where(eq(profiles.id, TEST_USER_ID))
      .limit(1);

    expect(profile).toMatchObject({
      gp_name: "Dr. Jane Smith",
      gp_phone: "020 7946 0958",
      gp_email: "gp@example.com",
      gp_address: "1 Health Centre, London",
    });

    const [state] = await db
      .select({ has_gp_details: onboardingState.has_gp_details })
      .from(onboardingState)
      .where(eq(onboardingState.user_id, TEST_USER_ID))
      .limit(1);

    expect(state?.has_gp_details).toBe(true);
  });

  it("POST /section/gp clears GP details without leaving the section complete", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/gp")
      .set("x-user-id", TEST_USER_ID)
      .send({
        gp_name: "",
        gp_phone: "",
        gp_email: "",
        gp_address: "",
        gp_maps_url: "",
        gp_place_id: "",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "gp" });

    const [profile] = await db
      .select({
        gp_name: profiles.gp_name,
        gp_phone: profiles.gp_phone,
        gp_email: profiles.gp_email,
        gp_address: profiles.gp_address,
      })
      .from(profiles)
      .where(eq(profiles.id, TEST_USER_ID))
      .limit(1);

    expect(profile).toMatchObject({
      gp_name: null,
      gp_phone: null,
      gp_email: null,
      gp_address: null,
    });

    const [state] = await db
      .select({ has_gp_details: onboardingState.has_gp_details })
      .from(onboardingState)
      .where(eq(onboardingState.user_id, TEST_USER_ID))
      .limit(1);

    expect(state?.has_gp_details).toBe(false);
  });

  it("POST /section/hobbies saves hobbies", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/hobbies")
      .set("x-user-id", TEST_USER_ID)
      .send({ hobbies: ["Reading", "Gardening", "Walking"] })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "hobbies" });
  });

  it("POST /section/emergency saves emergency contact", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/emergency")
      .set("x-user-id", TEST_USER_ID)
      .send({
        emergency_name: "Mary User",
        emergency_phone: "07700900000",
        emergency_role: "Daughter",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "emergency" });
  });

  it("POST /section/careteam saves a care team member", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/careteam")
      .set("x-user-id", TEST_USER_ID)
      .send({
        role: "family",
        person: { name: "Mary User", relationship: "Daughter", phone: "07700900000", email: "mary@example.com" },
        consent: { daily_summary: true, emergency_alerts: true },
        invite_channel: "sms",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "careteam" });
    expect(res.body.invitation).toMatchObject({ status: "pending" });
    expect(res.body.delivery.queued).toBe(2);
    expect(res.body._devInviteUrl).toContain("/care-team/invite/");

    const channels = (res.body.delivery.results as Array<{ channel: string }>).map((item) => item.channel).sort();
    expect(channels).toEqual(["email", "sms"]);

    const communications = await db
      .select()
      .from(communicationsLog)
      .where(eq(communicationsLog.user_id, TEST_USER_ID));
    expect(communications.filter((row) => row.purpose === "care_team_invite")).toHaveLength(2);

    const roster = await request(app)
      .get("/api/onboarding/careteam")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);
    const mary = roster.body.members.find((member: { invitee_name: string }) => member.invitee_name === "Mary User");
    expect(mary.latest_delivery_status).toBeTruthy();
    expect(mary.latest_delivery_channel).toBeTruthy();
    expect(mary).toMatchObject({
      can_receive_daily_digest: true,
      can_receive_safety_alerts: true,
      can_receive_health_alerts: false,
      can_view_health_reports: false,
      can_view_journal_summaries: false,
    });
  });

  it("POST /section/careteam requires caregiver email because invites always send SMS and email", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/careteam")
      .set("x-user-id", TEST_USER_ID)
      .send({
        role: "family",
        person: { name: "Email Missing", relationship: "Daughter", phone: "07700900001" },
        consent: { daily_summary: true, emergency_alerts: true },
        invite_channel: "sms",
      })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /careteam/:id/resend refreshes a pending invitation token and queues delivery", async () => {
    const [before] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.senior_id, TEST_USER_ID))
      .limit(1);

    const res = await request(app)
      .post(`/api/onboarding/careteam/${before.id}/resend`)
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, status: "pending", newId: before.id });
    expect(res.body.delivery.queued).toBe(2);
    expect(res.body._devInviteUrl).toContain("/care-team/invite/");

    const [after] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, before.id))
      .limit(1);
    expect(after.invite_token).not.toBe(before.invite_token);
  });

  it("POST /section/:unknown returns 400 for unknown sections", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/nonexistent")
      .set("x-user-id", TEST_USER_ID)
      .send({})
      .expect(400);

    expect(res.body).toMatchObject({ error: "Unknown section: nonexistent" });
  });

  it("POST /field marks individual onboarding fields", async () => {
    const res = await request(app)
      .post("/api/onboarding/field")
      .set("x-user-id", TEST_USER_ID)
      .send({ field: "has_language" })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, field: "has_language" });
  });

  it("POST /field rejects unknown field names with 400", async () => {
    const res = await request(app)
      .post("/api/onboarding/field")
      .set("x-user-id", TEST_USER_ID)
      .send({ field: "has_nuclear_reactor" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /consent completes onboarding and advances to complete", async () => {
    const res = await request(app)
      .post("/api/onboarding/consent")
      .set("x-user-id", TEST_USER_ID)
      .send({
        entries: [
          { scope: "conversation_summary",       action: "granted", channel: "web_form" },
          { scope: "health_conditions",          action: "granted", channel: "web_form" },
          { scope: "caregiver_full_access",      action: "granted", channel: "web_form" },
        ],
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, inserted: 3 });
  });

  it("GET /state confirms onboarding is complete", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.profile.current_stage).toBe("complete");
    expect(res.body.profile.onboarding_complete).toBe(true);
  });
});

describe("Onboarding journey — proxy flow", () => {
  const PROXY_USER_ID = randomUUID();

  beforeAll(async () => {
    await cleanupUser(PROXY_USER_ID);

    await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", PROXY_USER_ID)
      .send({ full_name: "Elder Person", language: "en" });
  });

  afterAll(async () => {
    await cleanupUser(PROXY_USER_ID);
  });

  it("POST /proxy records proxy setup (requires basics first)", async () => {
    const res = await request(app)
      .post("/api/onboarding/proxy")
      .set("x-user-id", PROXY_USER_ID)
      .send({ proxy_name: "Mary Carer" })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  it("POST /proxy rejects too-short proxy names", async () => {
    const otherUser = randomUUID();
    await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", otherUser)
      .send({ full_name: "Another Elder", language: "en" });

    const res = await request(app)
      .post("/api/onboarding/proxy")
      .set("x-user-id", otherUser)
      .send({ proxy_name: "X" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    await cleanupUser(otherUser);
  });

  it("POST /consent is blocked for unconfirmed proxy accounts", async () => {
    const res = await request(app)
      .post("/api/onboarding/consent")
      .set("x-user-id", PROXY_USER_ID)
      .send({
        entries: [{ scope: "conversation_summary", action: "granted", channel: "web_form" }],
      })
      .expect(403);

    expect(res.body.code).toBe("ELDER_CONFIRMATION_REQUIRED");
  });

  it("POST /elder-confirm allows the elder to confirm their proxy-initiated account", async () => {
    const res = await request(app)
      .post("/api/onboarding/elder-confirm")
      .set("x-user-id", PROXY_USER_ID)
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  it("POST /consent succeeds after elder confirms proxy account", async () => {
    const res = await request(app)
      .post("/api/onboarding/consent")
      .set("x-user-id", PROXY_USER_ID)
      .send({
        entries: [
          { scope: "conversation_summary", action: "granted", channel: "web_form" },
        ],
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  it("POST /elder-confirm returns 400 for non-proxy accounts", async () => {
    const directUser = randomUUID();
    await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", directUser)
      .send({ full_name: "Direct User", language: "en" });

    const res = await request(app)
      .post("/api/onboarding/elder-confirm")
      .set("x-user-id", directUser)
      .expect(400);

    expect(res.body).toHaveProperty("error");
    await cleanupUser(directUser);
  });
});
