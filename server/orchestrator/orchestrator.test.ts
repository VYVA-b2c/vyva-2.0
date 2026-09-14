import express, { type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routerHandler } from "../routes/router.js";
import {
  createOrchestratorRouterHandler,
  MAX_ORCHESTRATOR_SHADOW_TIMEOUT_MS,
} from "./orchestrator.js";
import { resolveOrchestratorShellMode } from "./orchestratorFeatureFlags.js";
import {
  orchestratorShellDecisionRecordSchema,
  type LegacyRouterHandler,
  type OrchestratorShellDecisionRecord,
  type OrchestratorShellModeResolution,
} from "./orchestratorTypes.js";
import {
  emitOrchestratorTelemetry,
  resetOrchestratorTelemetrySink,
  setOrchestratorTelemetrySink,
} from "./orchestratorTelemetry.js";

const NOW = new Date("2026-08-02T12:00:00.000Z");

const legacyMode: OrchestratorShellModeResolution = {
  requestedMode: "legacy_only",
  effectiveMode: "legacy_only",
  defaultMode: "legacy_only",
  activationEligibility: "eligible",
  reasonCode: "orchestrator_shell_legacy_requested",
  nonExecutable: true,
};

function shadowMode(): OrchestratorShellModeResolution {
  return resolveOrchestratorShellMode({
    env: {
      VYVA_ORCHESTRATOR_MODE: "shadow_compare",
      VYVA_ORCHESTRATOR_SHADOW_ROLLOUT_BPS: "10000",
      VYVA_ORCHESTRATOR_SHADOW_EVIDENCE_IDS: "evidence.task6.review",
      VYVA_ORCHESTRATOR_SHADOW_ROLLBACK_PLAN_ID: "rollback.task6.legacy",
      VYVA_ORCHESTRATOR_SHADOW_EXPIRY: "2026-09-01T00:00:00.000Z",
      VYVA_ORCHESTRATOR_SHADOW_OWNER_REFERENCE: "team.architecture",
      VYVA_ORCHESTRATOR_SHADOW_AUDIT_REFERENCE: "audit.task6.shell",
      NODE_ENV: "staging",
    },
    now: NOW,
    cohortKey: "session-shadow",
  });
}

function shellApp(
  legacyHandler: LegacyRouterHandler,
  overrides: Parameters<typeof createOrchestratorRouterHandler>[0] = {},
) {
  const app = express();
  app.use(express.json());
  app.post("/api/router", createOrchestratorRouterHandler({
    legacyHandler,
    flagResolver: () => legacyMode,
    currentTime: () => NOW,
    idFactory: () => "shell-test-id",
    ...overrides,
  }));
  return app;
}

function directApp(legacyHandler: LegacyRouterHandler) {
  const app = express();
  app.use(express.json());
  app.post("/api/router", legacyHandler);
  return app;
}

function goldenLegacyHandler(effect: ReturnType<typeof vi.fn>): LegacyRouterHandler {
  return (req, res) => {
    const body = req.body as {
      user_id?: string;
      session_id?: string;
      utterance?: string;
    };
    if (!body.user_id || !body.session_id ||
      typeof body.utterance !== "string") {
      return res.status(400).json({
        error: "Missing required fields: user_id, session_id, utterance",
      });
    }
    effect(body.utterance);
    if (body.utterance.toLowerCase().includes("emergency")) {
      return res.json({
        agent_id: "agent-safety",
        system_prompt_override: "unchanged-safety-prompt",
        dynamic_variables: {
          domain: "safety",
          conversation_id: body.session_id,
        },
        session_data: {
          domain: "safety",
          intent_confidence: 1,
          session_id: body.session_id,
          turn_count: 1,
          last_agent: null,
        },
      });
    }
    return res.json({
      agent_id: "agent-health",
      system_prompt_override: "unchanged-health-prompt",
      dynamic_variables: {
        domain: "health",
        conversation_id: body.session_id,
        context_token: "unchanged-tool-token",
      },
      session_data: {
        domain: "health",
        intent_confidence: 0.88,
        session_id: body.session_id,
        turn_count: 2,
        last_agent: "companion",
      },
    });
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  resetOrchestratorTelemetrySink();
});

describe("orchestrator shell parity and authority", () => {
  it("preserves the actual legacy missing-field response", async () => {
    const direct = await request(directApp(routerHandler))
      .post("/api/router")
      .send({})
      .expect(400);
    const shell = await request(shellApp(routerHandler))
      .post("/api/router")
      .send({})
      .expect(400);
    expect(shell.body).toEqual(direct.body);
    expect(shell.headers["content-type"]).toBe(direct.headers["content-type"]);
  });

  it("preserves the golden safety response and safety precedence", async () => {
    const directEffect = vi.fn();
    const shellEffect = vi.fn();
    const payload = {
      user_id: "user-1",
      session_id: "session-1",
      utterance: "This is an emergency",
      conversation_history: [],
    };
    const direct = await request(directApp(goldenLegacyHandler(directEffect)))
      .post("/api/router").send(payload).expect(200);
    const shell = await request(shellApp(goldenLegacyHandler(shellEffect)))
      .post("/api/router").send(payload).expect(200);
    expect(shell.body).toEqual(direct.body);
    expect(shell.body.session_data.domain).toBe("safety");
    expect(shellEffect).toHaveBeenCalledTimes(1);
  });

  it("preserves the golden normal response and all nested shapes", async () => {
    const directEffect = vi.fn();
    const shellEffect = vi.fn();
    const payload = {
      user_id: "user-1",
      session_id: "session-1",
      utterance: "Help with my health",
      conversation_history: [],
    };
    const direct = await request(directApp(goldenLegacyHandler(directEffect)))
      .post("/api/router").send(payload).expect(200);
    const shell = await request(shellApp(goldenLegacyHandler(shellEffect)))
      .post("/api/router").send(payload).expect(200);
    expect(shell.body).toEqual(direct.body);
    expect(shell.body.agent_id).toBe("agent-health");
    expect(shell.body.dynamic_variables).toEqual(
      direct.body.dynamic_variables,
    );
    expect(shell.body.session_data).toEqual(direct.body.session_data);
    expect(shellEffect).toHaveBeenCalledTimes(1);
  });

  it("invokes legacy exactly once in legacy-only mode", async () => {
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ ok: true }));
    await request(shellApp(legacy)).post("/api/router").send({}).expect(200);
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("invokes legacy exactly once in shadow mode", async () => {
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ ok: true }));
    const tasks: Array<() => void> = [];
    await request(shellApp(legacy, {
      flagResolver: () => shadowMode(),
      taskScheduler: (task) => tasks.push(task),
    })).post("/api/router").send({}).expect(200);
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(tasks).toHaveLength(1);
  });

  it("starts shadow only after legacy response delivery", async () => {
    let delivered = false;
    let shadowSawDelivery = false;
    const tasks: Array<() => void> = [];
    const legacy: LegacyRouterHandler = (_req, res) => {
      const result = res.json({ authoritative: "legacy" });
      delivered = true;
      return result;
    };
    await request(shellApp(legacy, {
      flagResolver: () => shadowMode(),
      taskScheduler: (task) => tasks.push(task),
      shadowEvaluator: () => {
        shadowSawDelivery = delivered;
        return { comparisonClassification: "legacy_delivery_observed" };
      },
    })).post("/api/router").send({}).expect(200);
    expect(shadowSawDelivery).toBe(false);
    tasks[0]();
    await vi.waitFor(() => expect(shadowSawDelivery).toBe(true));
  });

  it("does not schedule shadow when legacy returns without a JSON response", async () => {
    const scheduler = vi.fn();
    const shadowEvaluator = vi.fn();
    const telemetry: OrchestratorShellDecisionRecord[] = [];
    const legacy = vi.fn(async () => undefined);
    const response = {
      statusCode: 200,
      status: vi.fn(),
      json: vi.fn(),
    } as unknown as Response;
    const handler = createOrchestratorRouterHandler({
      legacyHandler: legacy,
      flagResolver: () => shadowMode(),
      currentTime: () => NOW,
      idFactory: () => "shell-no-response",
      taskScheduler: scheduler,
      shadowEvaluator,
      telemetryEmitter: (record) => {
        telemetry.push(record);
      },
    });

    await handler({ body: {} } as Request, response);

    expect(legacy).toHaveBeenCalledTimes(1);
    expect(scheduler).not.toHaveBeenCalled();
    expect(shadowEvaluator).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
    expect(telemetry).toHaveLength(1);
    expect(telemetry[0]).toMatchObject({
      shadowAttempted: false,
      shadowOutcome: "not_requested",
      comparisonClassification: "not_performed",
      exactOnceLegacyInvocation: true,
    });
  });

  it("does not let shadow mutate or preempt the safety response", async () => {
    const tasks: Array<() => void> = [];
    const shadow = vi.fn(() => ({
      comparisonClassification: "legacy_delivery_observed" as const,
    }));
    const response = await request(shellApp(
      goldenLegacyHandler(vi.fn()),
      {
        flagResolver: () => shadowMode(),
        taskScheduler: (task) => tasks.push(task),
        shadowEvaluator: shadow,
      },
    )).post("/api/router").send({
      user_id: "user-1",
      session_id: "session-1",
      utterance: "emergency",
    }).expect(200);
    expect(response.body.session_data.domain).toBe("safety");
    tasks[0]();
    await vi.waitFor(() => expect(shadow).toHaveBeenCalledOnce());
    expect(response.body.session_data.domain).toBe("safety");
  });

  it("passes only minimized immutable data to shadow", async () => {
    const tasks: Array<() => void> = [];
    const shadow = vi.fn((input: Readonly<Record<string, unknown>>) => {
      expect(Object.isFrozen(input)).toBe(true);
      expect(Object.keys(input).sort()).toEqual([
        "latencyBucket",
        "legacyCompleted",
        "legacyResponseDigest",
        "legacyResponseStatus",
        "nonExecutable",
        "routeId",
        "shellCorrelationId",
      ]);
      const serialized = JSON.stringify(input);
      expect(serialized).not.toContain("private utterance");
      expect(serialized).not.toContain("user-secret");
      expect(serialized).not.toContain("session-secret");
      expect(serialized).not.toContain("unchanged-tool-token");
      return { comparisonClassification: "legacy_delivery_observed" as const };
    });
    await request(shellApp(goldenLegacyHandler(vi.fn()), {
      flagResolver: () => shadowMode(),
      taskScheduler: (task) => tasks.push(task),
      shadowEvaluator: shadow,
    })).post("/api/router").send({
      user_id: "user-secret",
      session_id: "session-secret",
      utterance: "private utterance",
    }).expect(200);
    tasks[0]();
    await vi.waitFor(() => expect(shadow).toHaveBeenCalledOnce());
  });

  it("does not add response fields or headers", async () => {
    const legacy: LegacyRouterHandler = (_req, res) => {
      res.setHeader("x-legacy", "present");
      return res.status(207).json({ exact: true });
    };
    const direct = await request(directApp(legacy))
      .post("/api/router").expect(207);
    const shell = await request(shellApp(legacy))
      .post("/api/router").expect(207);
    expect(shell.body).toEqual(direct.body);
    expect(shell.headers["x-legacy"]).toBe(direct.headers["x-legacy"]);
    expect(Object.keys(shell.headers).sort()).toEqual(
      Object.keys(direct.headers).sort(),
    );
  });
});

describe("orchestrator shell failure fallback", () => {
  it("calls legacy once when flag resolution throws", async () => {
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ legacy: true }));
    const response = await request(shellApp(legacy, {
      flagResolver: () => {
        throw new Error("flag unavailable");
      },
    })).post("/api/router").send({}).expect(200);
    expect(response.body).toEqual({ legacy: true });
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("calls legacy once when the clock throws", async () => {
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ legacy: true }));
    await request(shellApp(legacy, {
      currentTime: () => {
        throw new Error("clock unavailable");
      },
    })).post("/api/router").expect(200);
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("calls legacy once when ID creation throws", async () => {
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ legacy: true }));
    await request(shellApp(legacy, {
      idFactory: () => {
        throw new Error("uuid unavailable");
      },
    })).post("/api/router").expect(200);
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("keeps delivery unchanged when telemetry throws", async () => {
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.status(202).json({ legacy: true }));
    const response = await request(shellApp(legacy, {
      telemetryEmitter: () => {
        throw new Error("telemetry unavailable");
      },
    })).post("/api/router").expect(202);
    expect(response.body).toEqual({ legacy: true });
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("keeps delivery unchanged when injected telemetry rejects", async () => {
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ legacy: true }));
    const response = await request(shellApp(legacy, {
      telemetryEmitter: async () => {
        throw new Error("telemetry rejected");
      },
    })).post("/api/router").expect(200);
    expect(response.body).toEqual({ legacy: true });
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("keeps delivery unchanged when shadow throws", async () => {
    const tasks: Array<() => void> = [];
    const records: OrchestratorShellDecisionRecord[] = [];
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ legacy: true }));
    const response = await request(shellApp(legacy, {
      flagResolver: () => shadowMode(),
      taskScheduler: (task) => tasks.push(task),
      shadowEvaluator: () => {
        throw new Error("shadow failed");
      },
      telemetryEmitter: (record) => records.push(record),
    })).post("/api/router").expect(200);
    expect(response.body).toEqual({ legacy: true });
    tasks[0]();
    await vi.waitFor(() =>
      expect(records.at(-1)).toMatchObject({
        shadowOutcome: "failed",
        errorClassification: "shadow_failed",
      }));
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("bounds shadow timeout without delaying delivery", async () => {
    const tasks: Array<() => void> = [];
    const records: OrchestratorShellDecisionRecord[] = [];
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ legacy: true }));
    const response = await request(shellApp(legacy, {
      flagResolver: () => shadowMode(),
      taskScheduler: (task) => tasks.push(task),
      shadowTimeoutMs: 5,
      shadowEvaluator: () => new Promise(() => {}),
      telemetryEmitter: (record) => records.push(record),
    })).post("/api/router").expect(200);
    expect(response.body).toEqual({ legacy: true });
    tasks[0]();
    await vi.waitFor(() =>
      expect(records.at(-1)).toMatchObject({
        shadowOutcome: "timed_out",
        errorClassification: "shadow_timed_out",
      }));
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("caps injected shadow timeout at the fixed maximum", async () => {
    const tasks: Array<() => void> = [];
    let aborted = false;
    await request(shellApp((_req, res) => res.json({ legacy: true }), {
      flagResolver: () => shadowMode(),
      taskScheduler: (task) => tasks.push(task),
      shadowTimeoutMs: Number.MAX_SAFE_INTEGER,
      shadowEvaluator: (_input, signal) => new Promise((resolve) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          resolve({ comparisonClassification: "legacy_delivery_observed" });
        });
      }),
    })).post("/api/router").expect(200);
    tasks[0]();
    await new Promise((resolve) =>
      setTimeout(resolve, MAX_ORCHESTRATOR_SHADOW_TIMEOUT_MS + 20));
    expect(aborted).toBe(true);
  });

  it("handles scheduler failure after legacy delivery", async () => {
    const records: OrchestratorShellDecisionRecord[] = [];
    const response = await request(shellApp(
      (_req, res) => res.json({ legacy: true }),
      {
        flagResolver: () => shadowMode(),
        taskScheduler: () => {
          throw new Error("scheduler unavailable");
        },
        telemetryEmitter: (record) => records.push(record),
      },
    )).post("/api/router").expect(200);
    expect(response.body).toEqual({ legacy: true });
    await vi.waitFor(() =>
      expect(records.at(-1)).toMatchObject({
        shadowOutcome: "schedule_failed",
        errorClassification: "shadow_schedule_failed",
      }));
  });

  it("preserves thrown legacy error identity and emits no replacement JSON", async () => {
    const thrown = new Error("legacy error");
    const json = vi.fn(function json(this: Response) {
      return this;
    });
    const res = {
      statusCode: 200,
      status(this: Response) {
        return this;
      },
      json,
    } as unknown as Response;
    const handler = createOrchestratorRouterHandler({
      legacyHandler: () => {
        throw thrown;
      },
      flagResolver: () => legacyMode,
      currentTime: () => NOW,
      idFactory: () => "shell-test-id",
      telemetryEmitter: () => {},
    });
    await expect(handler({ body: {} } as Request, res)).rejects.toBe(thrown);
    expect(json).not.toHaveBeenCalled();
  });

  it("does not retry after a partial legacy response", async () => {
    const thrown = new Error("after response");
    const legacy = vi.fn((_req: Request, res: Response) => {
      res.json({ partial: true });
      throw thrown;
    });
    const res = {
      statusCode: 200,
      status(this: Response) {
        return this;
      },
      json: vi.fn(function json(this: Response) {
        return this;
      }),
    } as unknown as Response;
    const handler = createOrchestratorRouterHandler({
      legacyHandler: legacy,
      flagResolver: () => legacyMode,
      currentTime: () => NOW,
      idFactory: () => "shell-test-id",
    });
    await expect(handler({ body: {} } as Request, res)).rejects.toBe(thrown);
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledTimes(1);
  });
});

describe("orchestrator shell telemetry minimization and mode inactivity", () => {
  it("emits a strict minimized legacy-only record", async () => {
    const records: OrchestratorShellDecisionRecord[] = [];
    await request(shellApp(
      (_req, res) => res.json({ token: "response-secret" }),
      { telemetryEmitter: (record) => records.push(record) },
    )).post("/api/router").send({
      user_id: "user-secret",
      session_id: "session-secret",
      utterance: "utterance-secret",
      system_prompt: "prompt-secret",
      token: "request-token-secret",
    }).expect(200);
    await vi.waitFor(() => expect(records).toHaveLength(1));
    expect(orchestratorShellDecisionRecordSchema.parse(records[0])).toEqual(
      records[0],
    );
    const serialized = JSON.stringify(records[0]);
    for (const secret of [
      "user-secret",
      "session-secret",
      "utterance-secret",
      "prompt-secret",
      "request-token-secret",
      "response-secret",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("supports a replaceable, resettable non-blocking telemetry sink", async () => {
    const records: OrchestratorShellDecisionRecord[] = [];
    setOrchestratorTelemetrySink((record) => {
      records.push(record);
    });
    await request(shellApp(
      (_req, res) => res.json({ ok: true }),
      { telemetryEmitter: emitOrchestratorTelemetry },
    )).post("/api/router").expect(200);
    expect(records).toHaveLength(1);

    resetOrchestratorTelemetrySink();
    emitOrchestratorTelemetry(records[0]);
    expect(records).toHaveLength(1);
  });

  it("swallows synchronous and asynchronous configured sink failures", () => {
    const record = orchestratorShellDecisionRecordSchema.parse({
      schemaVersion: "1.0.0",
      shellDecisionId: "decision-test",
      shellCorrelationId: "correlation-test",
      routeId: "route.api.router.post",
      modeState: legacyMode,
      deliveryAuthority: "legacy_handler",
      exactOnceLegacyInvocation: true,
      shadowAttempted: false,
      shadowOutcome: "not_requested",
      comparisonClassification: "not_performed",
      fallbackRecommendation: "remain_legacy_only",
      errorClassification: "none",
      nonExecutable: true,
    });
    setOrchestratorTelemetrySink(() => {
      throw new Error("sync sink");
    });
    expect(() => emitOrchestratorTelemetry(record)).not.toThrow();
    setOrchestratorTelemetrySink(async () => {
      throw new Error("async sink");
    });
    expect(() => emitOrchestratorTelemetry(record)).not.toThrow();
  });

  it.each(["candidate_delivery", "authoritative"] as const)(
    "cannot activate %s delivery",
    async (requestedMode) => {
      const mode = resolveOrchestratorShellMode({
        env: { VYVA_ORCHESTRATOR_MODE: requestedMode },
        now: NOW,
        cohortKey: "session-1",
      });
      const shadow = vi.fn();
      const legacy = vi.fn((_req: Request, res: Response) =>
        res.json({ authority: "legacy" }));
      const response = await request(shellApp(legacy, {
        flagResolver: () => mode,
        shadowEvaluator: shadow,
      })).post("/api/router").expect(200);
      expect(response.body).toEqual({ authority: "legacy" });
      expect(mode.effectiveMode).toBe("legacy_only");
      expect(shadow).not.toHaveBeenCalled();
      expect(legacy).toHaveBeenCalledOnce();
    },
  );
});

describe("orchestrator shell production boundary", () => {
  it("mounts exactly one POST /api/router shell handler", () => {
    const source = readFileSync("server/index.ts", "utf8");
    expect(source.match(/app\.post\("\/api\/router"/g)).toHaveLength(1);
    expect(source).toContain(
      'app.post("/api/router", orchestratorRouterHandler);',
    );
    expect(source).not.toContain(
      'import { routerHandler } from "./routes/router.js";',
    );
  });

  it("keeps Task 6 production imports inside the approved boundary", () => {
    const productionFiles = [
      "server/orchestrator/orchestrator.ts",
      "server/orchestrator/orchestratorTypes.ts",
      "server/orchestrator/legacyRouterAdapter.ts",
      "server/orchestrator/orchestratorFeatureFlags.ts",
      "server/orchestrator/orchestratorTelemetry.ts",
    ];
    const prohibitedImportSources = [
      /from ["']react/,
      /from ["'].*\/src\//,
      /from ["'].*mem0/i,
      /from ["'].*(?:db|database|drizzle)/i,
      /from ["'].*provider/i,
      /from ["'].*specialist/i,
      /from ["'].*fixtures/i,
      /from ["'].*(?:queue|scheduler)/i,
      /from ["'].*toolAdapter/i,
    ];
    for (const file of productionFiles) {
      const source = readFileSync(file, "utf8");
      for (const pattern of prohibitedImportSources) {
        expect(source, `${file} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
