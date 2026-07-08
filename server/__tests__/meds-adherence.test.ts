import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import medsAdherenceRouter from "../routes/medsAdherence.js";
import { authMiddleware } from "../middleware/auth.js";
import { db } from "../db.js";
import {
  interactionFlagDismissals,
  medicationAdherence,
  myMedicines,
  myMedicinesChangeLog,
  userMedications,
} from "../../shared/schema.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/meds/adherence-report", medsAdherenceRouter);
  return app;
}

const app = buildApp();
const TEST_USER_ID = randomUUID();

async function cleanupUser(userId: string) {
  await db.delete(interactionFlagDismissals).where(eq(interactionFlagDismissals.user_id, userId));
  await db.delete(myMedicinesChangeLog).where(eq(myMedicinesChangeLog.user_id, userId));
  await db.delete(myMedicines).where(eq(myMedicines.user_id, userId));
  await db.delete(medicationAdherence).where(eq(medicationAdherence.user_id, userId));
  await db.delete(userMedications).where(eq(userMedications.user_id, userId));
}

async function seedMedication(options: {
  name: string;
  dosage?: string;
  scheduledTimes: string[];
  createdAt?: Date;
}) {
  const [row] = await db
    .insert(userMedications)
    .values({
      user_id: TEST_USER_ID,
      medication_name: options.name,
      dosage: options.dosage ?? "10mg",
      frequency: "daily",
      scheduled_times: options.scheduledTimes,
      active: true,
      created_at: options.createdAt ?? new Date(),
    })
    .returning();

  return row;
}

async function seedTakenLog(options: {
  name: string;
  scheduledTime: string;
  createdAt: Date;
}) {
  await db.insert(medicationAdherence).values({
    user_id: TEST_USER_ID,
    medication_name: options.name,
    scheduled_time: options.scheduledTime,
    status: "taken",
    confirmed_by: "user",
    confirmed_taken_at: options.createdAt,
    created_at: options.createdAt,
  });
}

describe("Medication adherence routes", () => {
  beforeAll(async () => {
    await cleanupUser(TEST_USER_ID);
  });

  afterAll(async () => {
    await cleanupUser(TEST_USER_ID);
  });

  it("returns 401 when the user is not authenticated", async () => {
    await request(app).get("/api/meds/adherence-report/today").expect(401);
  });

  it("returns per-dose progress for today's medications", async () => {
    await cleanupUser(TEST_USER_ID);
    await seedMedication({
      name: "Metformin",
      scheduledTimes: ["08:00", "20:00"],
    });
    await seedTakenLog({
      name: "Metformin",
      scheduledTime: "08:00",
      createdAt: new Date(),
    });

    const res = await request(app)
      .get("/api/meds/adherence-report/today")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.medications).toHaveLength(1);
    expect(res.body.medications[0]).toMatchObject({
      medication_name: "Metformin",
      takenCountToday: 1,
      scheduledCountToday: 2,
      takenToday: false,
    });
  });

  it("does not allow confirming more doses than scheduled for today", async () => {
    await cleanupUser(TEST_USER_ID);
    await seedMedication({
      name: "Aspirin",
      scheduledTimes: ["09:00"],
    });
    await seedTakenLog({
      name: "Aspirin",
      scheduledTime: "09:00",
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/meds/adherence-report/confirm")
      .set("x-user-id", TEST_USER_ID)
      .send({
        medication_name: "Aspirin",
        scheduled_time: "09:00",
      })
      .expect(409);

    expect(res.body.error).toMatch(/fully confirmed/i);
  });

  it("does not create missed days before a medication existed", async () => {
    await cleanupUser(TEST_USER_ID);
    const createdAt = new Date();
    createdAt.setUTCDate(createdAt.getUTCDate() - 2);
    createdAt.setUTCHours(9, 0, 0, 0);

    await seedMedication({
      name: "Vitamin D",
      scheduledTimes: ["09:00"],
      createdAt,
    });

    const res = await request(app)
      .get("/api/meds/adherence-report")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.perMedication).toHaveLength(1);
    expect(res.body.perMedication[0]).toMatchObject({
      name: "Vitamin D",
      scheduled: 3,
      taken: 0,
      streak: 0,
    });
    expect(res.body.perMedication[0].dailyStatus).toEqual([
      "none",
      "none",
      "none",
      "none",
      "missed",
      "missed",
      "none",
    ]);
  });

  it("returns latest taken and today's summary in the adherence report", async () => {
    await cleanupUser(TEST_USER_ID);
    await seedMedication({
      name: "Metformin",
      scheduledTimes: ["08:00", "20:00"],
    });
    await seedMedication({
      name: "Aspirin",
      scheduledTimes: ["09:00"],
    });
    const earlier = new Date();
    earlier.setUTCHours(8, 0, 0, 0);
    const later = new Date();
    later.setUTCHours(9, 0, 0, 0);
    await seedTakenLog({
      name: "Metformin",
      scheduledTime: "08:00",
      createdAt: earlier,
    });
    await seedTakenLog({
      name: "Aspirin",
      scheduledTime: "09:00",
      createdAt: later,
    });

    const res = await request(app)
      .get("/api/meds/adherence-report")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.latestTaken).toMatchObject({
      medication_name: "Aspirin",
      scheduled_time: "09:00",
    });
    expect(res.body.latestTaken.confirmed_taken_at).toEqual(later.toISOString());
    expect(res.body.nextDue).toEqual({
      medication_name: "Metformin",
      scheduled_time: "20:00",
    });
    expect(res.body.todaySummary).toEqual({
      taken: 2,
      scheduled: 3,
      remaining: 1,
      medicationCount: 2,
      completedMedicationCount: 1,
      pendingMedicationCount: 1,
    });
  });
});
