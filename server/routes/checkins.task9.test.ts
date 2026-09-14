import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InteractionEvent } from "../../shared/orchestration/events.js";
import type { FlowState } from "../../shared/orchestration/flowState.js";
import type {
  EventStateCompatibilityStore,
  ShadowPersistenceWriteResult,
} from "../orchestrator/eventStatePersistence.js";

const db = vi.hoisted(() => ({
  query: vi.fn(),
}));

const activeProfile = vi.hoisted(() => ({
  getActiveProfileContext: vi.fn(),
}));

const dailyMonitor = vi.hoisted(() => ({
  markDailyCheckinCompleted: vi.fn(),
  getDailyCheckinTodayStatus: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: db,
}));

vi.mock("../middleware/auth.js", () => ({
  requireUser: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: { id: string; email: string } }).user = {
      id: "account-user-task9",
      email: "task9@example.com",
    };
    next();
  },
}));

vi.mock("../lib/profileAccess.js", () => activeProfile);

vi.mock("../services/dailyCheckinMonitor.js", () => dailyMonitor);

vi.mock("../lib/caregiverDomainAccess.js", () => ({
  resolveDomainAccess: vi.fn(async () => ({ allowed: true })),
}));

type CompletionRow = {
  id: string;
  orchestration_completion_status?: "pending" | "completed" | "failed";
  orchestration_claim_token?: string | null;
  orchestration_claim_expires_at?: string | null;
  feeling_label: string;
  overall_state: string;
  vyva_reading: string;
  why_today: string | null;
  trend_note: string | null;
  personal_plan: string | null;
  app_suggestion: string | null;
  suggested_app_action: string | null;
  right_now: string[];
  today_actions: string[];
  highlight: string;
  flag_caregiver: boolean;
  watch_for: string | null;
  inserted?: boolean;
};

type MockDatabaseState = {
  completions: Map<string, CompletionRow>;
  legacyRows: CompletionRow[];
  completionInsertCount: number;
  claimInsertCount: number;
  legacyInsertCount: number;
  trendWrites: number;
};

class CapturingStore implements EventStateCompatibilityStore {
  events: InteractionEvent[] = [];
  flows: FlowState[] = [];

  async writeInteractionEvent(event: InteractionEvent): Promise<ShadowPersistenceWriteResult> {
    this.events.push(event);
    return { outcome: "stored" };
  }

  async writeFlowProjection(flowState: FlowState): Promise<ShadowPersistenceWriteResult> {
    this.flows.push(flowState);
    return { outcome: "stored" };
  }

  async eventsByCorrelation(correlationId: string): Promise<InteractionEvent[]> {
    return this.events.filter((event) => event.correlationId === correlationId);
  }

  async activeFlowsBySession(sessionId: string): Promise<FlowState[]> {
    return this.flows.filter((flow) => flow.sessionId === sessionId);
  }
}

const baseAnswers = {
  energy_level: 4,
  mood: "alegre",
  body_areas: ["ninguno"],
  sleep_quality: "bien",
  symptoms: ["dolor_cabeza"],
  symptom_details: ["headache_mild"],
  safety_flags: ["mild_stable"],
  social_contact: "algo",
};

function task9Env(overrides: Record<string, string | undefined> = {}) {
  return {
    VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
    VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: "user-task9",
    VYVA_HEALTH_PREVENTIVE_FLOW_DENY_USERS: undefined,
    VYVA_HEALTH_PREVENTIVE_FLOW_ROLLOUT_BPS: undefined,
    VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_PRODUCTION: "false",
    NODE_ENV: "staging",
    ...overrides,
  };
}

function installEnv(env: Record<string, string | undefined>) {
  for (const key of [
    "VYVA_HEALTH_PREVENTIVE_FLOW_MODE",
    "VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS",
    "VYVA_HEALTH_PREVENTIVE_FLOW_DENY_USERS",
    "VYVA_HEALTH_PREVENTIVE_FLOW_ROLLOUT_BPS",
    "VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_PRODUCTION",
    "NODE_ENV",
    "OPENAI_API_KEY",
  ]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
}

function completionKey(
  userId: string,
  flowId: string,
  flowVersion: string,
  flowInstanceId: string,
  completionReference: string,
): string {
  return [userId, flowId, flowVersion, flowInstanceId, completionReference].join("|");
}

function setupMockDatabase(): MockDatabaseState {
  const state: MockDatabaseState = {
    completions: new Map(),
    legacyRows: [],
    completionInsertCount: 0,
    claimInsertCount: 0,
    legacyInsertCount: 0,
    trendWrites: 0,
  };

  db.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const text = String(sql);
    if (/^\s*(create|alter)\s+/i.test(text) || /create\s+(unique\s+)?index/i.test(text)) {
      return { rows: [], rowCount: 0 };
    }
    if (/from profiles/i.test(text)) {
      return {
        rows: [{
          id: "user-task9",
          preferred_name: "Amiga",
          grammatical_gender: "feminine",
          language: "es",
        }],
      };
    }
    if (/from (user_medications|companion_profiles|vitals_readings|activity_logs|triage_reports|medication_adherence)/i.test(text)) {
      return { rows: [] };
    }
    if (/select energy_level, mood, sleep_quality, symptoms, social_contact, completed_at/i.test(text)) {
      return { rows: [] };
    }
    if (/select id, feeling_label, overall_state, vyva_reading/i.test(text)) {
      const key = completionKey(
        String(params[0]),
        String(params[1]),
        String(params[2]),
        String(params[3]),
        String(params[4]),
      );
      const existing = state.completions.get(key);
      return {
        rows: existing?.orchestration_completion_status === "completed"
          ? [{ ...existing, inserted: false }]
          : [],
      };
    }
    if (/insert into checkin_sessions/i.test(text) && /orchestration_completion_status/i.test(text)) {
      const key = completionKey(
        String(params[0]),
        String(params[11]),
        String(params[12]),
        String(params[13]),
        String(params[14]),
      );
      const existing = state.completions.get(key);
      if (existing) return { rows: [] };
      state.claimInsertCount += 1;
      const row: CompletionRow = {
        id: `checkin-session-${state.claimInsertCount}`,
        orchestration_completion_status: "pending",
        orchestration_claim_token: String(params[16]),
        orchestration_claim_expires_at: String(params[18]),
        feeling_label: "",
        overall_state: "moderate",
        vyva_reading: "",
        why_today: null,
        trend_note: null,
        personal_plan: null,
        app_suggestion: null,
        suggested_app_action: null,
        right_now: [],
        today_actions: [],
        highlight: "",
        flag_caregiver: false,
        watch_for: null,
      };
      state.completions.set(key, row);
      return { rows: [{ id: row.id, orchestration_claim_expires_at: row.orchestration_claim_expires_at }] };
    }
    if (/select id, orchestration_completion_status, orchestration_claim_expires_at/i.test(text)) {
      const key = completionKey(
        String(params[0]),
        String(params[1]),
        String(params[2]),
        String(params[3]),
        String(params[4]),
      );
      const existing = state.completions.get(key);
      return { rows: existing ? [{ ...existing }] : [] };
    }
    if (/update checkin_sessions/i.test(text) && /set\s+orchestration_completion_status = 'pending'/i.test(text)) {
      const key = completionKey(
        String(params[0]),
        String(params[1]),
        String(params[2]),
        String(params[3]),
        String(params[4]),
      );
      const existing = state.completions.get(key);
      const nowMs = Date.parse(String(params[7]));
      const expiresMs = Date.parse(existing?.orchestration_claim_expires_at ?? "");
      if (existing && (existing.orchestration_completion_status === "failed" || expiresMs <= nowMs)) {
        existing.orchestration_completion_status = "pending";
        existing.orchestration_claim_token = String(params[6]);
        existing.orchestration_claim_expires_at = String(params[8]);
        return { rows: [{ id: existing.id }] };
      }
      return { rows: [] };
    }
    if (/update checkin_sessions/i.test(text) && /orchestration_completion_status = 'completed'/i.test(text)) {
      const key = completionKey(
        String(params[0]),
        String(params[24]),
        String(params[25]),
        String(params[26]),
        String(params[27]),
      );
      const existing = state.completions.get(key);
      if (
        !existing ||
        existing.orchestration_completion_status !== "pending" ||
        existing.orchestration_claim_token !== String(params[30])
      ) {
        return { rows: [] };
      }
      state.completionInsertCount += 1;
      const row: CompletionRow = {
        id: existing.id,
        orchestration_completion_status: "completed",
        orchestration_claim_token: existing.orchestration_claim_token,
        orchestration_claim_expires_at: existing.orchestration_claim_expires_at,
        feeling_label: String(params[9]),
        overall_state: String(params[10]),
        vyva_reading: String(params[11]),
        why_today: typeof params[12] === "string" ? params[12] : null,
        trend_note: typeof params[13] === "string" ? params[13] : null,
        personal_plan: typeof params[14] === "string" ? params[14] : null,
        app_suggestion: typeof params[15] === "string" ? params[15] : null,
        suggested_app_action: typeof params[16] === "string" ? params[16] : null,
        right_now: JSON.parse(String(params[17])) as string[],
        today_actions: JSON.parse(String(params[18])) as string[],
        highlight: String(params[19]),
        flag_caregiver: params[20] === true,
        watch_for: typeof params[21] === "string" ? params[21] : null,
      };
      state.completions.set(key, row);
      return { rows: [{ ...row, inserted: true }] };
    }
    if (/update checkin_sessions/i.test(text) && /orchestration_completion_status = 'failed'/i.test(text)) {
      const key = completionKey(
        String(params[0]),
        String(params[1]),
        String(params[2]),
        String(params[3]),
        String(params[4]),
      );
      const existing = state.completions.get(key);
      if (existing && existing.orchestration_claim_token === String(params[8])) {
        existing.orchestration_completion_status = "failed";
        existing.orchestration_claim_expires_at = String(params[7]);
      }
      return { rows: [], rowCount: existing ? 1 : 0 };
    }
    if (/insert into checkin_sessions/i.test(text)) {
      state.legacyInsertCount += 1;
      const row: CompletionRow = {
        id: `legacy-checkin-session-${state.legacyInsertCount}`,
        feeling_label: String(params[9]),
        overall_state: String(params[10]),
        vyva_reading: String(params[11]),
        why_today: typeof params[12] === "string" ? params[12] : null,
        trend_note: typeof params[13] === "string" ? params[13] : null,
        personal_plan: typeof params[14] === "string" ? params[14] : null,
        app_suggestion: typeof params[15] === "string" ? params[15] : null,
        suggested_app_action: typeof params[16] === "string" ? params[16] : null,
        right_now: JSON.parse(String(params[17])) as string[],
        today_actions: JSON.parse(String(params[18])) as string[],
        highlight: String(params[19]),
        flag_caregiver: params[20] === true,
        watch_for: typeof params[21] === "string" ? params[21] : null,
      };
      state.legacyRows.push(row);
      return { rows: [{ id: row.id }] };
    }
    if (/insert into checkin_trend_state/i.test(text)) {
      state.trendWrites += 1;
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });

  return state;
}

async function createApp(options: {
  modality?: "voice" | "touch" | "text" | "unsupported";
  eventStore?: EventStateCompatibilityStore;
} = {}) {
  const {
    default: checkinsRouter,
    setPreventiveHealthTrustedModality,
  } = await import("./checkins.js");
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    (req as express.Request & { language?: string }).language = "es";
    if (options.modality === "voice" || options.modality === "text" || options.modality === "touch") {
      setPreventiveHealthTrustedModality(res, options.modality);
    }
    if (options.eventStore) {
      res.locals.preventiveHealthEventStore = options.eventStore;
    }
    next();
  });
  app.use("/api/checkins", checkinsRouter);
  return app;
}

describe("Task 9 /api/checkins/analyze integration seam", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../health/healthSpecialistAdapter.js");
    db.query.mockReset();
    activeProfile.getActiveProfileContext.mockReset();
    activeProfile.getActiveProfileContext.mockResolvedValue({ profileId: "user-task9" });
    dailyMonitor.markDailyCheckinCompleted.mockReset();
    dailyMonitor.markDailyCheckinCompleted.mockResolvedValue(undefined);
    dailyMonitor.getDailyCheckinTodayStatus.mockReset();
    installEnv(task9Env());
  });

  it("resolves the active profile before eligibility and returns the existing response shape", async () => {
    const state = setupMockDatabase();
    const app = await createApp();
    const response = await request(app)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, answers: baseAnswers });

    expect(response.status).toBe(200);
    expect(activeProfile.getActiveProfileContext).toHaveBeenCalledWith("account-user-task9");
    expect(response.body).toMatchObject({
      result: {
        overall_state: expect.any(String),
        right_now: expect.any(Array),
        today_actions: expect.any(Array),
      },
      session_id: "checkin-session-1",
      meta: {
        used_minimal_profile: false,
        orchestration: {
          flow_id: "health.preventive_check",
          flow_version: "1.0.0",
          persistence_status: "created",
        },
      },
    });
    expect(state.completionInsertCount).toBe(1);
    expect(state.legacyInsertCount).toBe(0);
    expect(state.trendWrites).toBe(1);
  });

  it("falls back to the unchanged legacy path when Task 9 flags are malformed", async () => {
    const state = setupMockDatabase();
    installEnv(task9Env({ VYVA_HEALTH_PREVENTIVE_FLOW_MODE: " authoritative " }));
    const app = await createApp({ eventStore: new CapturingStore() });
    const response = await request(app)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, answers: baseAnswers });

    expect(response.status).toBe(200);
    expect(response.body.meta.orchestration).toBeUndefined();
    expect(response.body.session_id).toBe("legacy-checkin-session-1");
    expect(state.completionInsertCount).toBe(0);
    expect(state.legacyInsertCount).toBe(1);
    expect(state.trendWrites).toBe(1);
  });

  it("passes trusted modality into Task 9 observability and ignores unsupported values", async () => {
    const voiceStore = new CapturingStore();
    setupMockDatabase();
    const voiceApp = await createApp({ modality: "voice", eventStore: voiceStore });
    const voiceResponse = await request(voiceApp)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, answers: baseAnswers });

    expect(voiceStore.events.map((event) => event.metadata.inputModality)).toEqual([
      "voice",
      "voice",
      "voice",
    ]);
    expect(voiceStore.events.map((event) => event.channel)).toEqual([
      "voice",
      "voice",
      "voice",
    ]);

    vi.resetModules();
    vi.doUnmock("../health/healthSpecialistAdapter.js");
    db.query.mockReset();
    activeProfile.getActiveProfileContext.mockResolvedValue({ profileId: "user-task9" });
    dailyMonitor.markDailyCheckinCompleted.mockResolvedValue(undefined);
    setupMockDatabase();
    const textStore = new CapturingStore();
    const textApp = await createApp({ modality: "text", eventStore: textStore });
    const textResponse = await request(textApp)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, answers: baseAnswers });
    expect(textStore.events.map((event) => event.metadata.inputModality)).toEqual([
      "text",
      "text",
      "text",
    ]);
    expect(textStore.events.map((event) => event.channel)).toEqual([
      "text",
      "text",
      "text",
    ]);

    vi.resetModules();
    vi.doUnmock("../health/healthSpecialistAdapter.js");
    db.query.mockReset();
    activeProfile.getActiveProfileContext.mockResolvedValue({ profileId: "user-task9" });
    dailyMonitor.markDailyCheckinCompleted.mockResolvedValue(undefined);
    setupMockDatabase();
    const defaultStore = new CapturingStore();
    const defaultApp = await createApp({ modality: "unsupported", eventStore: defaultStore });
    await request(defaultApp)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, answers: baseAnswers });
    expect(defaultStore.events.map((event) => event.metadata.inputModality)).toEqual([
      "touch",
      "touch",
      "touch",
    ]);
    expect(textResponse.body.result).toEqual(voiceResponse.body.result);
    expect(defaultStore.events[2].metadata.answerDigest).toBe(voiceStore.events[2].metadata.answerDigest);
    expect(textStore.events[2].metadata.answerDigest).toBe(voiceStore.events[2].metadata.answerDigest);
  });

  it("ignores client-spoofed modality fields and keeps the trusted default", async () => {
    const store = new CapturingStore();
    setupMockDatabase();
    const app = await createApp({ eventStore: store });
    await request(app)
      .post("/api/checkins/analyze")
      .send({
        language: "es",
        duration_seconds: 20,
        vyvaInteractionModality: "voice",
        modality: "voice",
        answers: baseAnswers,
      });

    expect(store.events.map((event) => event.metadata.inputModality)).toEqual([
      "touch",
      "touch",
      "touch",
    ]);
  });

  it("uses one durable completion row and returns persisted or bounded pending responses for concurrent duplicates", async () => {
    const state = setupMockDatabase();
    const app = await createApp();
    const [first, second] = await Promise.all([
      request(app).post("/api/checkins/analyze").send({ language: "es", answers: baseAnswers }),
      request(app).post("/api/checkins/analyze").send({ language: "es", answers: baseAnswers }),
    ]);

    expect([200, 202]).toContain(first.status);
    expect([200, 202]).toContain(second.status);
    expect([first.status, second.status]).toContain(200);
    expect(state.completionInsertCount).toBe(1);
    expect(state.claimInsertCount).toBe(1);
    expect(state.legacyInsertCount).toBe(0);
    const completed = first.status === 200 ? first : second;
    const pending = first.status === 202 ? first : second;
    expect(completed.body.session_id).toBe("checkin-session-1");
    expect(["created", "existing"]).toContain(completed.body.meta.orchestration.persistence_status);
    if (pending.status === 202) {
      expect(pending.body.meta.orchestration).toMatchObject({
        reason_code: "preventive_health_flow_completion_pending",
        persistence_status: "pending",
      });
    } else {
      expect(pending.body.session_id).toBe("checkin-session-1");
      expect(pending.body.result).toEqual(completed.body.result);
      expect(pending.body.meta.orchestration.persistence_status).toBe("existing");
    }

    const retry = await request(app)
      .post("/api/checkins/analyze")
      .send({ language: "es", answers: baseAnswers });
    expect(retry.status).toBe(200);
    expect(retry.body.session_id).toBe("checkin-session-1");
    expect(retry.body.result).toEqual(completed.body.result);
    expect(retry.body.meta.orchestration.persistence_status).toBe("existing");
    expect(state.completionInsertCount).toBe(1);
    expect(state.legacyInsertCount).toBe(0);
  });

  it("rejects malformed Specialist proposals at the route without legacy persistence", async () => {
    vi.doMock("../health/healthSpecialistAdapter.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../health/healthSpecialistAdapter.js")>();
      return {
        ...actual,
        proposePreventiveHealthCompletion: vi.fn((input: Parameters<typeof actual.proposePreventiveHealthCompletion>[0]) => {
          const proposed = actual.proposePreventiveHealthCompletion(input);
          return {
            ...proposed,
            completionResult: {
              ...proposed.completionResult,
              answerDigest: `sha256:${"0".repeat(64)}`,
            },
          };
        }),
      };
    });
    const state = setupMockDatabase();
    const store = new CapturingStore();
    const app = await createApp({ eventStore: store });
    const response = await request(app)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, answers: baseAnswers });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Unable to complete this check-in safely right now.");
    expect(response.body.meta.orchestration).toMatchObject({
      reason_code: "preventive_health_flow_specialist_rejected",
      persistence_status: "not_started",
    });
    expect(state.claimInsertCount).toBe(0);
    expect(state.completionInsertCount).toBe(0);
    expect(state.legacyInsertCount).toBe(0);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      eventType: "FLOW_FAILED",
      metadata: {
        specialistValidationOutcome: "rejected",
      },
    });
    expect(store.flows).toHaveLength(0);
  });

  it("preserves deterministic safety precedence without emitting an ordinary completion", async () => {
    const state = setupMockDatabase();
    const store = new CapturingStore();
    const app = await createApp({ eventStore: store });
    const response = await request(app)
      .post("/api/checkins/analyze")
      .send({
        language: "es",
        answers: {
          ...baseAnswers,
          symptoms: ["falta_aire"],
          safety_flags: [],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.session_id).toBeNull();
    expect(response.body.meta.orchestration).toMatchObject({
      reason_code: "preventive_health_flow_safety_preempted",
      persistence_status: "not_started",
    });
    expect(response.body.result.flag_caregiver).toBe(true);
    expect(state.claimInsertCount).toBe(0);
    expect(state.completionInsertCount).toBe(0);
    expect(state.legacyInsertCount).toBe(0);
    expect(store.events).toHaveLength(0);
  });
});
