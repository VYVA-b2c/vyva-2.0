import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCaregiverAlertWorkflowPatch,
  normalizeCaregiverAlertWorkflowStatus,
} from "../lib/caregiverAlertWorkflow.js";
import { authMiddleware } from "../middleware/auth.js";

type AlertRow = {
  id: string;
  user_id: string;
  alert_type: string;
  severity: string;
  message: string;
  sent_to: string[];
  status?: string | null;
  acknowledged_at?: Date | string | null;
  acknowledged_by?: string | null;
  contacted_at?: Date | string | null;
  resolved_at?: Date | string | null;
  resolved_by?: string | null;
  caregiver_note?: string | null;
  created_at: Date | string;
};

const testState = vi.hoisted(() => ({
  alerts: [] as AlertRow[],
  lastPatch: null as Record<string, unknown> | null,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {},
}));

vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: vi.fn(async (userId: string) => ({ profileId: userId })),
}));

vi.mock("../db.js", () => ({
  db: {
    execute: vi.fn(async () => []),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async (limit: number) => testState.alerts.slice(0, limit)),
          })),
          limit: vi.fn(async () => testState.alerts.slice(0, 1)),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Record<string, unknown>) => {
        testState.lastPatch = patch;
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (testState.alerts.length === 0) return [];
              testState.alerts[0] = { ...testState.alerts[0], ...patch };
              return [testState.alerts[0]];
            }),
          })),
        };
      }),
    })),
  },
}));

async function importRouter() {
  const module = await import("../routes/vitalsEngine.js");
  return module.default;
}

async function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(authMiddleware);
  testApp.use("/api/vitals-engine", await importRouter());
  return testApp;
}

function baseAlert(overrides: Partial<AlertRow> = {}): AlertRow {
  return {
    id: "alert-1",
    user_id: "caregiver-1",
    alert_type: "triage_report",
    severity: "urgent_help",
    message: "Symptom report: chest discomfort",
    sent_to: ["+1 555 0100"],
    status: "new",
    acknowledged_at: null,
    acknowledged_by: null,
    contacted_at: null,
    resolved_at: null,
    resolved_by: null,
    caregiver_note: null,
    created_at: "2026-05-29T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  testState.alerts = [baseAlert()];
  testState.lastPatch = null;
});

describe("caregiver alert workflow rules", () => {
  it("normalizes existing resolved_at alerts to resolved for backward compatibility", () => {
    expect(normalizeCaregiverAlertWorkflowStatus({
      status: "new",
      resolved_at: "2026-05-29T10:04:00.000Z",
    })).toBe("resolved");
  });

  it("preserves audit timestamps when moving from reviewed to contacted", () => {
    const patch = buildCaregiverAlertWorkflowPatch(
      {
        status: "reviewed",
        acknowledged_at: "2026-05-29T10:02:00.000Z",
        acknowledged_by: "caregiver-1",
      },
      { status: "contacted" },
      "caregiver-2",
      new Date("2026-05-29T10:03:00.000Z"),
    );

    expect(patch.acknowledged_at).toBe("2026-05-29T10:02:00.000Z");
    expect(patch.acknowledged_by).toBe("caregiver-1");
    expect(patch.contacted_at).toEqual(new Date("2026-05-29T10:03:00.000Z"));
  });
});

describe("caregiver alert workflow API", () => {
  it("updates an alert to reviewed and returns persisted workflow fields", async () => {
    const res = await request(await app())
      .patch("/api/vitals-engine/caregiver/alerts/alert-1/workflow")
      .set("x-user-id", "caregiver-1")
      .send({ status: "reviewed" })
      .expect(200);

    expect(res.body.alert.status).toBe("reviewed");
    expect(res.body.alert.acknowledged_by).toBe("caregiver-1");
    expect(res.body.alert.acknowledged_at).toBeTruthy();
    expect(testState.lastPatch).toMatchObject({
      status: "reviewed",
      acknowledged_by: "caregiver-1",
    });
  });

  it("persists caregiver notes without requiring a status escalation", async () => {
    const res = await request(await app())
      .patch("/api/vitals-engine/caregiver/alerts/alert-1/workflow")
      .set("x-user-id", "caregiver-1")
      .send({ status: "new", caregiver_note: "Called and left a voicemail." })
      .expect(200);

    expect(res.body.alert.status).toBe("new");
    expect(res.body.alert.caregiver_note).toBe("Called and left a voicemail.");
  });

  it("returns saved workflow state from latest alerts", async () => {
    await request(await app())
      .patch("/api/vitals-engine/caregiver/alerts/alert-1/workflow")
      .set("x-user-id", "caregiver-1")
      .send({ status: "contacted", caregiver_note: "Spoke with nurse line." })
      .expect(200);

    const res = await request(await app())
      .get("/api/vitals-engine/caregiver/latest-alerts")
      .set("x-user-id", "caregiver-1")
      .expect(200);

    expect(res.body.alerts[0]).toMatchObject({
      status: "contacted",
      caregiver_note: "Spoke with nurse line.",
    });
    expect(res.body.alerts[0].acknowledged_at).toBeTruthy();
    expect(res.body.alerts[0].contacted_at).toBeTruthy();
  });

  it("keeps existing resolved_at compatibility in latest alerts", async () => {
    testState.alerts = [baseAlert({
      status: "new",
      resolved_at: "2026-05-29T10:04:00.000Z",
      resolved_by: "legacy-flow",
    })];

    const res = await request(await app())
      .get("/api/vitals-engine/caregiver/latest-alerts")
      .set("x-user-id", "caregiver-1")
      .expect(200);

    expect(res.body.alerts[0]).toMatchObject({
      status: "resolved",
      resolved_at: "2026-05-29T10:04:00.000Z",
      resolved_by: "legacy-flow",
    });
  });

  it("rejects unsupported workflow states", async () => {
    await request(await app())
      .patch("/api/vitals-engine/caregiver/alerts/alert-1/workflow")
      .set("x-user-id", "caregiver-1")
      .send({ status: "watching" })
      .expect(400);
  });

  it("returns 404 for alerts outside the active caregiver profile", async () => {
    testState.alerts = [];

    await request(await app())
      .patch("/api/vitals-engine/caregiver/alerts/missing-alert/workflow")
      .set("x-user-id", "caregiver-1")
      .send({ status: "reviewed" })
      .expect(404);
  });
});
