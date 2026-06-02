import "dotenv/config";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../middleware/auth.js";

const mocks = vi.hoisted(() => {
  const seniorId = "00000000-0000-4000-8000-000000000101";
  const caregiverId = "00000000-0000-4000-8000-000000000102";
  const membershipId = "00000000-0000-4000-8000-000000000201";
  const planId = "00000000-0000-4000-8000-000000000301";
  const eventId = "00000000-0000-4000-8000-000000000401";
  const scheduleId = "00000000-0000-4000-8000-000000000501";
  const selectResults: unknown[][] = [];
  const insertResults: unknown[][] = [];
  const updateResults: unknown[][] = [];
  const insertValues: unknown[] = [];
  const updateValues: unknown[] = [];

  function selectChain(result: unknown[]) {
    const chain: {
      from: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: <TResult1 = unknown[], TResult2 = never>(
        onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) => Promise<TResult1 | TResult2>;
    } = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(async () => result),
      then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
    };
    return chain;
  }

  function insertChain() {
    const chain: {
      values: ReturnType<typeof vi.fn>;
      onConflictDoNothing: ReturnType<typeof vi.fn>;
      onConflictDoUpdate: ReturnType<typeof vi.fn>;
      returning: ReturnType<typeof vi.fn>;
    } = {
      values: vi.fn((value: unknown) => {
        insertValues.push(value);
        return chain;
      }),
      onConflictDoNothing: vi.fn(() => chain),
      onConflictDoUpdate: vi.fn(() => chain),
      returning: vi.fn(async () => insertResults.shift() ?? []),
    };
    return chain;
  }

  function updateChain() {
    const returning = vi.fn(async () => updateResults.shift() ?? []);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn((value: unknown) => {
      updateValues.push(value);
      return { where };
    });
    return { set };
  }

  const db = {
    select: vi.fn(() => selectChain(selectResults.shift() ?? [])),
    insert: vi.fn(() => insertChain()),
    update: vi.fn(() => updateChain()),
  };

  const getActiveProfileContext = vi.fn(async (accountUserId: string) => ({
    accountUserId,
    profileId: seniorId,
    role: accountUserId === seniorId ? "elder" : "caregiver",
  }));

  return {
    caregiverId,
    db,
    eventId,
    getActiveProfileContext,
    insertResults,
    insertValues,
    membershipId,
    planId,
    scheduleId,
    selectResults,
    seniorId,
    updateResults,
    updateValues,
  };
});

vi.mock("../db.js", () => ({ db: mocks.db }));
vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: mocks.getActiveProfileContext,
  requireActiveProfileId: vi.fn(async () => mocks.seniorId),
}));

import caregiverBrainCoachRouter from "../routes/caregiverBrainCoach.js";
import gamesRouter from "../routes/games.js";

const updatedPermissions = {
  brain_coach: {
    view_summary: true,
    manage_schedule: true,
    send_nudges: true,
  },
};

const profileRow = {
  role: "user",
  email: "caregiver@example.com",
  timezone: "Europe/Madrid",
  language: "en",
  dataSharingConsent: {
    cognitive: {
      sessionLengthMins: 7,
      variety: "variety",
    },
  },
};

const settingsRow = {
  userId: mocks.seniorId,
  preferredDomains: [],
  excludedActivityTypes: [],
  preferredTrainingTimes: ["09:30"],
  weeklyTargetDays: 3,
  sessionLengthMinutes: 7,
  paused: false,
};

const scheduleRow = {
  id: mocks.scheduleId,
  user_id: mocks.seniorId,
  interaction_type: "BRAIN_COACH",
  status: "ACTIVE",
  frequency_type: "WEEKLY",
  days_of_week: ["MON", "WED", "FRI"],
  times_of_day: ["09:30"],
  timezone: "Europe/Madrid",
  preferred_language: "en",
  is_paused: false,
  next_run_at: new Date("2026-06-03T07:30:00.000Z"),
  updated_by: mocks.caregiverId,
};

const planRow = {
  id: mocks.planId,
  userId: mocks.seniorId,
  planDate: new Date().toISOString().slice(0, 10),
  status: "active",
  estimatedDurationMinutes: 8,
  recommendedDomains: ["attention", "visual_memory"],
  rationale: ["Starts with a short balanced plan because there is no Brain Coach history yet."],
  generatedContext: { training_time: "09:30", session_length_mins: 7 },
  generationVersion: "brain_coach_plan_v2",
  createdAt: new Date("2026-06-02T08:00:00.000Z"),
  updatedAt: new Date("2026-06-02T08:00:00.000Z"),
};

const planItems = [{
  id: "00000000-0000-4000-8000-000000000302",
  planId: mocks.planId,
  userId: mocks.seniorId,
  planDate: planRow.planDate,
  activityType: "sequence_memory",
  title: "Rhythm Tap",
  domain: "attention",
  route: "/attention-boosters/rhythm-tap",
  estimatedDurationMinutes: 4,
  rationale: "new area for variety",
  status: "recommended",
  sortOrder: 0,
}, {
  id: "00000000-0000-4000-8000-000000000303",
  planId: mocks.planId,
  userId: mocks.seniorId,
  planDate: planRow.planDate,
  activityType: "memory_match",
  title: "Memory Match",
  domain: "visual_memory",
  route: "/memory-games/memory_match",
  estimatedDurationMinutes: 4,
  rationale: "new area for variety",
  status: "recommended",
  sortOrder: 1,
}];

const nudgeEvent = {
  id: mocks.eventId,
  planId: mocks.planId,
  eventType: "caregiver_nudge",
  metadata: {
    message_type: "today_plan",
    title: "Your Brain Coach plan is ready",
    body: "Your caregiver suggested starting with one short recommended activity.",
    sent_by: mocks.caregiverId,
  },
  createdAt: new Date("2026-06-02T09:00:00.000Z"),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/caregiver/brain-coach", authMiddleware, caregiverBrainCoachRouter);
  app.use("/api/games", authMiddleware, gamesRouter);
  return app;
}

function queueAccessSelects() {
  mocks.selectResults.push(
    [profileRow],
    [{
      role: "caregiver",
      permissions: updatedPermissions,
    }],
    [],
  );
}

describe("Brain Coach caregiver consent to senior activity loop", () => {
  beforeEach(() => {
    mocks.selectResults.length = 0;
    mocks.insertResults.length = 0;
    mocks.updateResults.length = 0;
    mocks.insertValues.length = 0;
    mocks.updateValues.length = 0;
    mocks.db.select.mockClear();
    mocks.db.insert.mockClear();
    mocks.db.update.mockClear();
    mocks.getActiveProfileContext.mockClear();
  });

  it("lets senior consent unlock caregiver schedule/nudge control and shows the nudge in the senior daily plan", async () => {
    const app = buildApp();

    mocks.selectResults.push(
      [{
        id: mocks.membershipId,
        user_id: mocks.caregiverId,
        profile_id: mocks.seniorId,
        role: "caregiver",
        status: "active",
        permissions: { brain_coach: { view_summary: true } },
      }],
      [],
    );
    mocks.updateResults.push([{
      id: mocks.membershipId,
      user_id: mocks.caregiverId,
      profile_id: mocks.seniorId,
      role: "caregiver",
      status: "active",
      permissions: updatedPermissions,
    }]);

    await request(app)
      .patch(`/api/caregiver/brain-coach/permissions/${mocks.membershipId}`)
      .set("x-user-id", mocks.seniorId)
      .send({ manage_schedule: true, send_nudges: true })
      .expect(200);

    queueAccessSelects();
    mocks.selectResults.push(
      [],
      [profileRow],
      [],
    );
    mocks.insertResults.push([settingsRow], [scheduleRow]);

    await request(app)
      .patch("/api/caregiver/brain-coach/me/settings")
      .set("x-user-id", mocks.caregiverId)
      .send({ preferredTrainingTimes: ["09:30"], paused: false })
      .expect(200);

    const scheduleInsert = mocks.insertValues.find((value) => (
      value && typeof value === "object" && (value as Record<string, unknown>).interaction_type === "BRAIN_COACH"
    )) as Record<string, unknown>;
    expect(scheduleInsert).toMatchObject({
      user_id: mocks.seniorId,
      interaction_type: "BRAIN_COACH",
      times_of_day: ["09:30"],
      status: "ACTIVE",
      updated_by: mocks.caregiverId,
    });

    const scheduleAudit = mocks.insertValues.find((value) => (
      value && typeof value === "object" && (value as Record<string, unknown>).consent_source === "brain_coach_settings_caregiver"
    )) as Record<string, unknown>;
    expect(scheduleAudit).toMatchObject({
      user_id: mocks.seniorId,
      schedule_id: mocks.scheduleId,
      changed_by: mocks.caregiverId,
    });

    queueAccessSelects();
    mocks.selectResults.push(
      [],
      [],
      [],
      [profileRow],
      [settingsRow],
    );
    mocks.insertResults.push([planRow], [nudgeEvent]);

    const nudgeRes = await request(app)
      .post("/api/caregiver/brain-coach/me/nudges")
      .set("x-user-id", mocks.caregiverId)
      .send({ messageType: "today_plan" })
      .expect(201);

    expect(nudgeRes.body.nudge).toMatchObject({
      planId: mocks.planId,
      title: "Your Brain Coach plan is ready",
    });

    const planInsert = mocks.insertValues.find((value) => (
      value && typeof value === "object" && (value as Record<string, unknown>).generationVersion === "brain_coach_plan_v2"
    )) as Record<string, unknown>;
    expect(planInsert).toMatchObject({
      userId: mocks.seniorId,
      status: "active",
    });

    mocks.selectResults.push(
      [],
      [nudgeEvent],
      [profileRow],
      [settingsRow],
      [planRow],
      planItems,
      planItems,
    );

    const seniorPlanRes = await request(app)
      .get("/api/games/daily-plan")
      .set("x-user-id", mocks.seniorId)
      .expect(200);

    expect(seniorPlanRes.body.planId).toBe(mocks.planId);
    expect(seniorPlanRes.body.caregiverNudge).toMatchObject({
      planId: mocks.planId,
      title: "Your Brain Coach plan is ready",
      sentBy: mocks.caregiverId,
    });
  });
});
