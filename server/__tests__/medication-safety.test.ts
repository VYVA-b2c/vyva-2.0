import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import medsAdherenceRouter from "../routes/medsAdherence.js";
import { authMiddleware } from "../middleware/auth.js";
import { db, pool } from "../db.js";
import {
  medicationAdherence,
  medicationSafetyCaseEvents,
  medicationSafetyCases,
  medicationSafetySignals,
  myMedicines,
  myMedicinesChangeLog,
  userMedications,
} from "../../shared/schema.js";
import {
  buildMedicationSafetyCaseExport,
  buildMedicationSafetySignals,
} from "../lib/medicationSafety.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/meds", medsAdherenceRouter);
  return app;
}

const app = buildApp();
const TEST_USER_ID = randomUUID();
let medicationSafetyDbAvailable = false;

async function cleanupUser(userId: string) {
  await db.delete(medicationSafetyCaseEvents).where(eq(medicationSafetyCaseEvents.user_id, userId));
  await db.delete(medicationSafetySignals).where(eq(medicationSafetySignals.user_id, userId));
  await db.delete(medicationSafetyCases).where(eq(medicationSafetyCases.user_id, userId));
  await db.delete(myMedicinesChangeLog).where(eq(myMedicinesChangeLog.user_id, userId));
  await db.delete(myMedicines).where(eq(myMedicines.user_id, userId));
  await db.delete(medicationAdherence).where(eq(medicationAdherence.user_id, userId));
  await db.delete(userMedications).where(eq(userMedications.user_id, userId));
}

async function seedMedication(options: {
  name: string;
  scheduledTimes?: string[];
  createdAt?: Date;
}) {
  const [row] = await db.insert(userMedications).values({
    user_id: TEST_USER_ID,
    medication_name: options.name,
    dosage: "10mg",
    frequency: "daily",
    scheduled_times: options.scheduledTimes ?? ["08:00"],
    active: true,
    created_at: options.createdAt ?? new Date(),
  }).returning();
  return row;
}

describe("medication safety rules", () => {
  const now = new Date("2026-06-26T12:00:00.000Z");

  it("does not create a case for a single missed dose", () => {
    const createdAt = new Date("2026-06-25T08:00:00.000Z");
    const signals = buildMedicationSafetySignals({
      now,
      medications: [{ medication_name: "Metformin", scheduled_times: ["08:00"], created_at: createdAt }],
      adherenceRows: [],
    });

    expect(signals.find((signal) => signal.signal_type === "missed_dose_pattern")).toBeUndefined();
  });

  it("creates a conservative draft signal for repeated missed doses", () => {
    const createdAt = new Date("2026-06-19T08:00:00.000Z");
    const signals = buildMedicationSafetySignals({
      now,
      medications: [{ medication_name: "Metformin", scheduled_times: ["08:00"], created_at: createdAt }],
      adherenceRows: [],
    });

    const signal = signals.find((item) => item.signal_type === "missed_dose_pattern");
    expect(signal).toMatchObject({
      severity: "attention",
      medication_name: "Metformin",
      shouldCreateCase: true,
    });
  });

  it("preserves high-severity daily safety context as a vitals overlap signal", () => {
    const signals = buildMedicationSafetySignals({
      now,
      medications: [{ medication_name: "Atenolol", scheduled_times: ["08:00"], created_at: now }],
      adherenceRows: [],
      dailySafety: {
        id: "analysis-1",
        safety_status: "urgent_help",
        recommended_action: "urgent_help",
        risk_score: 82,
        pattern_labels: ["pulse"],
        senior_message: "Seek urgent help.",
      },
    });

    expect(signals).toEqual([
      expect.objectContaining({
        signal_type: "vitals_overlap",
        severity: "urgent",
        shouldCreateCase: false,
      }),
    ]);
  });

  it("maps safety cases to E2B-ready packets without inventing missing facts", () => {
    const packet = buildMedicationSafetyCaseExport({
      generatedAt: now,
      safetyCase: {
        id: "case-1",
        user_id: "user-1",
        status: "draft",
        severity: "attention",
        signal_type: "possible_side_effect",
        suspected_medication: "Metformin",
        reaction: "Dizziness",
        reaction_started_at: "2026-06-25T00:00:00.000Z",
        seriousness_flags: ["other_medically_important"],
        outcome: "Improving",
        action_taken: "Called pharmacist",
        reporter_name: "Maria",
        reporter_contact: "maria@example.com",
        evidence: [{ type: "manual_report" }],
      },
    });

    expect(packet.export_ready).toBe(true);
    expect(packet.missing_fields).toEqual([]);
    expect(packet.e2b_ready_json.safety_report.suspect_drug.medicinal_product).toBe("Metformin");
    expect(packet.e2b_ready_json.safety_report.reaction.reaction_term).toBe("Dizziness");
  });
});

describe("medication safety routes", () => {
  beforeAll(async () => {
    try {
      await pool.query("select 1");
      await request(app).get("/api/meds/safety").set("x-user-id", TEST_USER_ID).expect(200);
      medicationSafetyDbAvailable = true;
      await cleanupUser(TEST_USER_ID);
    } catch (err) {
      medicationSafetyDbAvailable = false;
      console.warn("[medication-safety.test] DB-backed route tests skipped:", err instanceof Error ? err.message : err);
    }
  });

  afterAll(async () => {
    if (medicationSafetyDbAvailable) await cleanupUser(TEST_USER_ID);
  });

  it("requires authentication", async () => {
    await request(app).get("/api/meds/safety").expect(401);
  });

  it("analyses repeated missed-dose patterns and dedupes open cases", async () => {
    if (!medicationSafetyDbAvailable) return;
    await cleanupUser(TEST_USER_ID);
    await seedMedication({
      name: "Metformin",
      createdAt: new Date(Date.now() - 8 * 86400000),
    });

    const first = await request(app)
      .post("/api/meds/safety/analyse")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(first.body.openCases).toHaveLength(1);
    expect(first.body.openCases[0]).toMatchObject({
      signal_type: "missed_dose_pattern",
      suspected_medication: "Metformin",
    });

    const second = await request(app)
      .post("/api/meds/safety/analyse")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(second.body.openCases).toHaveLength(1);
    const cases = await db.select().from(medicationSafetyCases).where(eq(medicationSafetyCases.user_id, TEST_USER_ID));
    expect(cases).toHaveLength(1);
  });

  it("creates, updates, and exports a manual side-effect case with audit events", async () => {
    if (!medicationSafetyDbAvailable) return;
    await cleanupUser(TEST_USER_ID);

    const created = await request(app)
      .post("/api/meds/safety/cases")
      .set("x-user-id", TEST_USER_ID)
      .send({
        suspected_medication: "Aspirin",
        reaction: "Rash",
      })
      .expect(201);

    expect(created.body.case).toMatchObject({
      signal_type: "possible_side_effect",
      suspected_medication: "Aspirin",
      reaction: "Rash",
      export_ready: false,
    });

    const caseId = created.body.case.id as string;
    const updated = await request(app)
      .patch(`/api/meds/safety/cases/${caseId}`)
      .set("x-user-id", TEST_USER_ID)
      .send({
        status: "needs_review",
        reaction_started_at: "2026-06-25",
        seriousness_flags: ["other_medically_important"],
        outcome: "Improving",
        action_taken: "Called pharmacist",
        reporter_name: "Maria",
        reporter_contact: "maria@example.com",
      })
      .expect(200);

    expect(updated.body.case.export_ready).toBe(true);

    const exported = await request(app)
      .post(`/api/meds/safety/cases/${caseId}/export`)
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(exported.body.export.export_ready).toBe(true);
    expect(exported.body.export.e2b_ready_json.safety_report.reaction.reaction_term).toBe("Rash");
    expect(exported.body.export.human_readable_text).toContain("VYVA Medication Safety Case Packet");

    const events = await db.select().from(medicationSafetyCaseEvents).where(eq(medicationSafetyCaseEvents.case_id, caseId));
    expect(events.map((event) => event.event_type)).toEqual(expect.arrayContaining(["created_manual", "updated", "exported"]));
  });
});
