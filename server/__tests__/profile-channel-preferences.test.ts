import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import profileRouter from "../routes/profile.js";
import { db } from "../db.js";
import { profiles, userChannelPreferences } from "../../shared/schema.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/profile", authMiddleware, profileRouter);
  return app;
}

const app = buildApp();
const createdUserIds = new Set<string>();

async function cleanupUser(userId: string) {
  await db.delete(userChannelPreferences).where(eq(userChannelPreferences.user_id, userId));
  await db.delete(profiles).where(eq(profiles.id, userId));
}

async function createProfile() {
  const userId = randomUUID();
  createdUserIds.add(userId);
  await db.insert(profiles).values({
    id: userId,
    language: "en",
  });
  return userId;
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    await cleanupUser(userId);
  }
  createdUserIds.clear();
});

describe("Profile channel preferences", () => {
  it("returns schema defaults when no preferences have been saved", async () => {
    const userId = await createProfile();

    const res = await request(app)
      .get("/api/profile/channel-preferences")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body).toMatchObject({
      preferred_checkin_channel: "voice_outbound",
      preferred_reminder_channel: "whatsapp_outbound",
      voice_available_from: "08:00",
      voice_available_until: "21:00",
      whatsapp_available_from: "07:00",
      whatsapp_available_until: "22:00",
      max_outbound_calls_per_day: 1,
      max_whatsapp_messages_per_day: 5,
    });
  });

  it("validates and persists detailed channel preferences", async () => {
    const userId = await createProfile();

    const payload = {
      preferred_checkin_channel: "whatsapp_outbound",
      preferred_reminder_channel: "voice_app",
      voice_available_from: "09:00",
      voice_available_until: "20:30",
      whatsapp_available_from: "09:15",
      whatsapp_available_until: "20:45",
      max_outbound_calls_per_day: null,
      max_whatsapp_messages_per_day: 10,
    };

    const saveRes = await request(app)
      .patch("/api/profile/channel-preferences")
      .set("x-user-id", userId)
      .send(payload)
      .expect(200);

    expect(saveRes.body).toMatchObject(payload);

    const getRes = await request(app)
      .get("/api/profile/channel-preferences")
      .set("x-user-id", userId)
      .expect(200);

    expect(getRes.body).toMatchObject(payload);

    const [row] = await db
      .select()
      .from(userChannelPreferences)
      .where(eq(userChannelPreferences.user_id, userId))
      .limit(1);
    expect(row?.preferred_checkin_channel).toBe("whatsapp_outbound");
    expect(row?.preferred_reminder_channel).toBe("voice_app");
    expect(row?.max_outbound_calls_per_day).toBeNull();
  });

  it("rejects invalid channel and time values", async () => {
    const userId = await createProfile();

    await request(app)
      .patch("/api/profile/channel-preferences")
      .set("x-user-id", userId)
      .send({
        preferred_checkin_channel: "telegram",
        voice_available_from: "25:00",
      })
      .expect(400);
  });
});
