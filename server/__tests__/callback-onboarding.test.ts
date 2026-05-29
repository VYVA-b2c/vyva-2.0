import "dotenv/config";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import callbackOnboardingRouter from "../routes/callbackOnboarding.js";
import {
  completeCallbackOnboardingToolHandler,
  completePhoneOnboardingToolHandler,
  failCallbackOnboardingToolHandler,
  saveCallbackOnboardingSectionToolHandler,
} from "../routes/elevenlabsTools.js";
import { db } from "../db.js";
import {
  accessLinks,
  communicationsLog,
  lifecycleEvents,
  onboardingState,
  profiles,
  userChannelPreferences,
  userIntakes,
  userMedications,
} from "../../shared/schema.js";
import {
  createCallbackOnboardingRequest,
  queueDueCallbackOnboardingCalls,
} from "../services/callbackOnboarding.js";
import { signCallbackOnboardingToolToken } from "../lib/jwt.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/public/callback-onboarding", callbackOnboardingRouter);
  app.post("/api/elevenlabs/tools/phone-onboarding/complete", completePhoneOnboardingToolHandler);
  app.post("/api/elevenlabs/tools/callback-onboarding/save-section", saveCallbackOnboardingSectionToolHandler);
  app.post("/api/elevenlabs/tools/callback-onboarding/complete", completeCallbackOnboardingToolHandler);
  app.post("/api/elevenlabs/tools/callback-onboarding/fail", failCallbackOnboardingToolHandler);
  return app;
}

const app = buildApp();
const createdIntakeIds = new Set<string>();
const createdUserIds = new Set<string>();
const originalFetch = globalThis.fetch;
const envKeys = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_CALLBACK_ONBOARDING_AGENT_ID",
  "ELEVENLABS_CALLBACK_ONBOARDING_PHONE_NUMBER_ID",
  "ELEVENLABS_PHONE_ONBOARDING_TOOL_TOKEN",
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

async function trackIntake(intakeId: string) {
  createdIntakeIds.add(intakeId);
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, intakeId)).limit(1);
  for (const id of [intake?.user_id, intake?.elder_user_id, intake?.family_user_id]) {
    if (id) createdUserIds.add(id);
  }
}

async function cleanupIntake(intakeId: string) {
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, intakeId)).limit(1);
  for (const id of [intake?.user_id, intake?.elder_user_id, intake?.family_user_id]) {
    if (id) createdUserIds.add(id);
  }

  await db.delete(communicationsLog).where(eq(communicationsLog.intake_id, intakeId));
  await db.delete(accessLinks).where(eq(accessLinks.intake_id, intakeId));
  await db.delete(lifecycleEvents).where(eq(lifecycleEvents.intake_id, intakeId));
  await db.delete(userIntakes).where(eq(userIntakes.id, intakeId));
}

async function cleanupUser(userId: string) {
  await db.delete(communicationsLog).where(eq(communicationsLog.user_id, userId));
  await db.delete(accessLinks).where(eq(accessLinks.user_id, userId));
  await db.delete(lifecycleEvents).where(eq(lifecycleEvents.user_id, userId));
  await db.delete(userMedications).where(eq(userMedications.user_id, userId));
  await db.delete(userChannelPreferences).where(eq(userChannelPreferences.user_id, userId));
  await db.delete(onboardingState).where(eq(onboardingState.user_id, userId));
  await db.delete(profiles).where(eq(profiles.id, userId));
}

afterEach(async () => {
  for (const intakeId of createdIntakeIds) {
    await cleanupIntake(intakeId);
  }
  for (const userId of createdUserIds) {
    await cleanupUser(userId);
  }
  createdIntakeIds.clear();
  createdUserIds.clear();

  for (const key of envKeys) {
    const original = originalEnv[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("callback onboarding", () => {
  it("creates a phone intake and app access from ElevenLabs inbound caller data", async () => {
    process.env.ELEVENLABS_PHONE_ONBOARDING_TOOL_TOKEN = "phone-tool-token";
    const email = `phone-onboarding-${Date.now()}@example.com`;

    const res = await request(app)
      .post("/api/elevenlabs/tools/phone-onboarding/complete")
      .set("Authorization", "Bearer phone-tool-token")
      .send({
        conversation_id: "conv_phone_onboarding_test",
        first_name: "Lola",
        last_name: "Martin",
        country_code: "+34",
        phone: "612 345 679",
        email,
        language: "en",
        timezone: "Europe/Madrid",
        profile: {
          preferred_name: "Lola",
        },
      })
      .expect(201);

    await trackIntake(res.body.intake_id);
    expect(res.body.next_action).toBe("link_queued");
    expect(res.body.communication).toMatchObject({
      channel: "email",
      recipient: email,
      purpose: "send_app_link",
    });

    const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, res.body.intake_id)).limit(1);
    expect(intake).toMatchObject({
      name: "Lola Martin",
      email,
      entry_point: "phone",
      status: "link_sent",
      journey_step: "link_sent",
      consent_status: "not_required",
    });
    expect(intake.metadata).toMatchObject({
      elevenlabs: {
        inbound_phone_onboarding: true,
        conversation_id: "conv_phone_onboarding_test",
      },
    });

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, res.body.elder_user_id)).limit(1);
    expect(profile).toMatchObject({
      full_name: "Lola Martin",
      preferred_name: "Lola",
      email,
      language: "en",
    });

    const events = await db.select().from(lifecycleEvents).where(eq(lifecycleEvents.intake_id, res.body.intake_id));
    expect(events.some((event) => event.event_type === "phone_onboarding_captured")).toBe(true);
  });

  it("rejects inbound phone onboarding when the ElevenLabs tool token is missing", async () => {
    process.env.ELEVENLABS_PHONE_ONBOARDING_TOOL_TOKEN = "phone-tool-token";

    await request(app)
      .post("/api/elevenlabs/tools/phone-onboarding/complete")
      .send({
        conversation_id: "conv_phone_onboarding_missing_token",
        name: "No Token",
        phone: "+34612345679",
      })
      .expect(401);
  });

  it("creates a scheduled intake without creating a profile", async () => {
    const res = await request(app)
      .post("/api/public/callback-onboarding/request")
      .send({
        first_name: "Maria",
        last_name: "Gomez",
        country_code: "+34",
        phone: "612 345 678",
        preferred_date: "2026-06-01",
        preferred_time: "10:00",
        preferred_period: "AM",
        callback_for: "me",
        language: "fr-FR",
        timezone: "Europe/Madrid",
      })
      .expect(201);

    await trackIntake(res.body.intake_id);
    expect(res.body.scheduled_for).toBe("2026-06-01T08:00:00.000Z");

    const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, res.body.intake_id)).limit(1);
    expect(intake).toMatchObject({
      entry_point: "phone",
      status: "created",
      journey_step: "callback_scheduled",
      tier: "premium",
      user_id: null,
    });
    expect(intake?.phone).toBe("+34612345678");
    expect(intake?.metadata).toMatchObject({
      callback: {
        status: "scheduled",
        callback_for: "me",
        language: "fr",
      },
    });

    const [profile] = await db.select().from(profiles).where(eq(profiles.phone_number, "+34612345678")).limit(1);
    expect(profile).toBeUndefined();
  });

  it("starts due callback intakes through ElevenLabs with the onboarding token", async () => {
    process.env.ELEVENLABS_API_KEY = "test-api-key";
    process.env.ELEVENLABS_CALLBACK_ONBOARDING_AGENT_ID = "agent_callback";
    process.env.ELEVENLABS_CALLBACK_ONBOARDING_PHONE_NUMBER_ID = "phone_callback";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ conversation_id: "conv_123", callSid: "CA123" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { intake } = await createCallbackOnboardingRequest({
      first_name: "Jose",
      last_name: "Lopez",
      country_code: "+34",
      phone: "699 111 222",
      preferred_date: "2026-01-01",
      preferred_time: "09:30",
      preferred_period: "AM",
      callback_for: "caregiver",
      language: "es",
      timezone: "Europe/Madrid",
    });
    createdIntakeIds.add(intake.id);

    const results = await queueDueCallbackOnboardingCalls();
    expect(results).toEqual([
      expect.objectContaining({ status: "calling", conversationId: "conv_123", callSid: "CA123" }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "xi-api-key": "test-api-key",
        }),
      }),
    );
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      agent_id: "agent_callback",
      agent_phone_number_id: "phone_callback",
      to_number: "+34699111222",
      conversation_initiation_client_data: {
        dynamic_variables: {
          intake_id: intake.id,
          first_name: "Jose",
          full_name: "Jose Lopez",
          callback_for: "caregiver",
          language: "es",
        },
      },
    });
    expect(payload.conversation_initiation_client_data.dynamic_variables.onboarding_tool_token).toEqual(expect.any(String));
  });

  it("rejects ElevenLabs tool calls when the token does not match the intake", async () => {
    const first = await createCallbackOnboardingRequest({
      first_name: "Ana",
      last_name: "One",
      country_code: "+34",
      phone: "600 100 100",
      preferred_date: "2026-06-01",
      preferred_time: "09:00",
      preferred_period: "AM",
      callback_for: "me",
      language: "en",
      timezone: "Europe/Madrid",
    });
    const second = await createCallbackOnboardingRequest({
      first_name: "Ana",
      last_name: "Two",
      country_code: "+34",
      phone: "600 200 200",
      preferred_date: "2026-06-01",
      preferred_time: "09:00",
      preferred_period: "AM",
      callback_for: "me",
      language: "en",
      timezone: "Europe/Madrid",
    });
    createdIntakeIds.add(first.intake.id);
    createdIntakeIds.add(second.intake.id);

    const token = await signCallbackOnboardingToolToken(first.intake.id);
    const res = await request(app)
      .post("/api/elevenlabs/tools/callback-onboarding/save-section")
      .send({
        intake_id: second.intake.id,
        onboarding_tool_token: token,
        consent_confirmed: true,
        section_id: "identity",
        data: { full_name: "Ana Two" },
      })
      .expect(403);

    expect(res.body.error).toBe("Invalid or expired onboarding tool token");
  });

  it("saves sections, completes onboarding, and queues the selected confirmation channel", async () => {
    const { intake } = await createCallbackOnboardingRequest({
      first_name: "Marta",
      last_name: "Ruiz",
      country_code: "+34",
      phone: "611 222 333",
      preferred_date: "2026-06-01",
      preferred_time: "11:00",
      preferred_period: "AM",
      callback_for: "me",
      language: "en",
      timezone: "Europe/Madrid",
    });
    createdIntakeIds.add(intake.id);
    const token = await signCallbackOnboardingToolToken(intake.id);

    await request(app)
      .post("/api/elevenlabs/tools/callback-onboarding/save-section")
      .send({
        intake_id: intake.id,
        conversation_id: "conv_done",
        onboarding_tool_token: token,
        consent_confirmed: true,
        section_id: "medications",
        data: {
          medications: [{ name: "Metformin", dosage: "500mg", frequency: "once daily" }],
          known_allergies: ["Penicillin"],
        },
      })
      .expect(200);

    const res = await request(app)
      .post("/api/elevenlabs/tools/callback-onboarding/complete")
      .send({
        intake_id: intake.id,
        conversation_id: "conv_done",
        onboarding_tool_token: token,
        consent_confirmed: true,
        confirmation_channel: "email",
        email: "marta@example.com",
        profile: {
          full_name: "Marta Ruiz",
          preferred_name: "Marta",
          language: "en",
          date_of_birth: "1945-04-01",
        },
        sections: {
          address: {
            address_line_1: "Calle Mayor 1",
            city: "Tarifa",
            region: "Andalucia",
            postcode: "11380",
          },
          conditions: {
            conditions: ["diabetes"],
          },
        },
      })
      .expect(200);

    createdUserIds.add(res.body.profile_id);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, res.body.profile_id)).limit(1);
    expect(profile).toMatchObject({
      full_name: "Marta Ruiz",
      preferred_name: "Marta",
      email: "marta@example.com",
      phone_number: "+34611222333",
      onboarding_complete: true,
      current_stage: "complete",
      subscription_tier: "premium",
      subscription_status: "trial",
      channel_reports: "email",
      channel_notifications: "email",
    });
    expect(profile?.trial_ends_at).toBeInstanceOf(Date);

    const [communication] = await db
      .select()
      .from(communicationsLog)
      .where(eq(communicationsLog.id, res.body.communication_id))
      .limit(1);
    expect(communication).toMatchObject({
      channel: "email",
      recipient: "marta@example.com",
      purpose: "callback_onboarding_confirmation",
      status: "queued",
    });

    const [medication] = await db.select().from(userMedications).where(eq(userMedications.user_id, res.body.profile_id)).limit(1);
    expect(medication).toMatchObject({
      medication_name: "Metformin",
      dosage: "500mg",
      added_by: "callback_onboarding",
    });

    const [updatedIntake] = await db.select().from(userIntakes).where(eq(userIntakes.id, intake.id)).limit(1);
    expect(updatedIntake).toMatchObject({
      status: "link_sent",
      journey_step: "callback_complete_confirmation_queued",
      user_id: res.body.profile_id,
      elder_user_id: res.body.profile_id,
    });
  });

  it("asks the agent for a missing confirmation destination instead of completing", async () => {
    const { intake } = await createCallbackOnboardingRequest({
      first_name: "Lola",
      last_name: "Perez",
      country_code: "+34",
      phone: "622 111 111",
      preferred_date: "2026-06-01",
      preferred_time: "11:00",
      preferred_period: "AM",
      callback_for: "me",
      language: "en",
      timezone: "Europe/Madrid",
    });
    createdIntakeIds.add(intake.id);
    const token = await signCallbackOnboardingToolToken(intake.id);

    const res = await request(app)
      .post("/api/elevenlabs/tools/callback-onboarding/complete")
      .send({
        intake_id: intake.id,
        onboarding_tool_token: token,
        consent_confirmed: true,
        confirmation_channel: "email",
        profile: { full_name: "Lola Perez" },
      })
      .expect(400);

    expect(res.body.error).toBe("Missing email for confirmation");
  });
});
