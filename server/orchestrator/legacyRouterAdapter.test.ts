import express, { type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  createLegacyRouterAdapter,
  digestLegacyJsonPayload,
  orchestratorLatencyBucket,
} from "./legacyRouterAdapter.js";

function appWithAdapter(
  legacyHandler: (req: Request, res: Response) => unknown | Promise<unknown>,
) {
  const app = express();
  app.use(express.json());
  const adapter = createLegacyRouterAdapter(legacyHandler, () => 5);
  app.post("/api/router", async (req, res, next) => {
    try {
      await adapter(req, res);
    } catch (error) {
      next(error);
    }
  });
  return app;
}

function appWithErrorHandler(
  legacyHandler: (req: Request, res: Response) => unknown | Promise<unknown>,
) {
  const app = appWithAdapter(legacyHandler);
  app.use((
    error: Error,
    _req: Request,
    res: Response,
    _next: () => void,
  ) => {
    res.status(500).json({ message: error.message });
  });
  return app;
}

describe("legacy router adapter", () => {
  it("preserves explicit status and exact JSON body", async () => {
    const body = { error: "Missing required fields" };
    const response = await request(appWithAdapter((_req, res) =>
      res.status(400).json(body)))
      .post("/api/router")
      .send({})
      .expect(400);
    expect(response.body).toEqual(body);
  });

  it("preserves the default 200 status and JSON body", async () => {
    const body = {
      agent_id: "agent-health",
      dynamic_variables: { domain: "health" },
      session_data: { domain: "health" },
    };
    const response = await request(appWithAdapter((_req, res) =>
      res.json(body)))
      .post("/api/router")
      .send({ untouched: true })
      .expect(200);
    expect(response.body).toEqual(body);
  });

  it("invokes the supplied legacy handler exactly once", async () => {
    const legacy = vi.fn((_req: Request, res: Response) =>
      res.json({ ok: true }));
    await request(appWithAdapter(legacy))
      .post("/api/router")
      .send({})
      .expect(200);
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("passes the original request and response objects through", async () => {
    let observedRequest: Request | undefined;
    let observedResponse: Response | undefined;
    const app = express();
    app.use(express.json());
    const adapter = createLegacyRouterAdapter((req, res) => {
      observedRequest = req;
      observedResponse = res;
      return res.json({ ok: true });
    });
    app.post("/api/router", async (req, res) => {
      await adapter(req, res);
      expect(observedRequest).toBe(req);
      expect(observedResponse).toBe(res);
    });

    await request(app).post("/api/router").send({ value: "original" }).expect(200);
  });

  it("does not mutate the request body", async () => {
    const submitted = { nested: { value: "unchanged" } };
    let before = "";
    let after = "";
    const app = express();
    app.use(express.json());
    const adapter = createLegacyRouterAdapter((req, res) => {
      before = JSON.stringify(req.body);
      return res.json({ ok: true });
    });
    app.post("/api/router", async (req, res) => {
      await adapter(req, res);
      after = JSON.stringify(req.body);
    });

    await request(app).post("/api/router").send(submitted).expect(200);
    expect(after).toBe(before);
    expect(JSON.parse(after)).toEqual(submitted);
  });

  it("captures only minimized observation fields", async () => {
    const app = express();
    app.use(express.json());
    let observation: Awaited<ReturnType<ReturnType<typeof createLegacyRouterAdapter>>> | undefined;
    const adapter = createLegacyRouterAdapter((_req, res) =>
      res.json({ private: "response body" }), () => 10);
    app.post("/api/router", async (req, res) => {
      observation = await adapter(req, res);
    });

    await request(app).post("/api/router").send({
      utterance: "raw private utterance",
    }).expect(200);
    expect(observation).toEqual({
      invocationCount: 1,
      completed: true,
      statusCode: 200,
      responseKind: "object",
      responseDigest: digestLegacyJsonPayload(
        '{"private":"response body"}',
      ),
      latencyBucket: "lt_10ms",
    });
    expect(JSON.stringify(observation)).not.toContain("raw private utterance");
    expect(JSON.stringify(observation)).not.toContain("response body");
  });

  it("restores response methods after successful delivery", async () => {
    const app = express();
    const adapter = createLegacyRouterAdapter((_req, res) =>
      res.json({ ok: true }));
    app.post("/api/router", async (req, res) => {
      const originalStatus = res.status;
      const originalJson = res.json;
      await adapter(req, res);
      expect(res.status).toBe(originalStatus);
      expect(res.json).toBe(originalJson);
    });
    await request(app).post("/api/router").expect(200);
  });

  it("restores response methods when the legacy handler throws", async () => {
    const thrown = new Error("legacy failed");
    const req = {} as Request;
    const status = vi.fn(function status(this: Response) {
      return this;
    });
    const json = vi.fn(function json(this: Response) {
      return this;
    });
    const res = {
      statusCode: 200,
      status,
      json,
    } as unknown as Response;
    const adapter = createLegacyRouterAdapter(() => {
      throw thrown;
    });

    await expect(adapter(req, res)).rejects.toBe(thrown);
    expect(res.status).toBe(status);
    expect(res.json).toBe(json);
  });

  it("preserves thrown error object identity", async () => {
    const thrown = { code: "legacy-object", private: "not serialized" };
    const req = {} as Request;
    const res = {
      statusCode: 200,
      status(this: Response) {
        return this;
      },
      json(this: Response) {
        return this;
      },
    } as unknown as Response;
    const adapter = createLegacyRouterAdapter(() => {
      throw thrown;
    });
    await expect(adapter(req, res)).rejects.toBe(thrown);
  });

  it("does not replace a post-delivery legacy throw with JSON", async () => {
    const thrown = new Error("after delivery");
    const json = vi.fn(function json(this: Response) {
      this.statusCode = 200;
      return this;
    });
    const res = {
      statusCode: 200,
      status(this: Response, code: number) {
        this.statusCode = code;
        return this;
      },
      json,
    } as unknown as Response;
    const adapter = createLegacyRouterAdapter((_req, response) => {
      response.json({ delivered: true });
      throw thrown;
    });

    await expect(adapter({} as Request, res)).rejects.toBe(thrown);
    expect(json).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith({ delivered: true });
  });

  it("does not serialize stateful JSON values before Express", async () => {
    let serializationCalls = 0;
    const response = await request(appWithAdapter((_req, res) =>
      res.json({
        toJSON() {
          serializationCalls += 1;
          return { serializationCall: serializationCalls };
        },
      })))
      .post("/api/router")
      .send({})
      .expect(200);

    expect(response.body).toEqual({ serializationCall: 1 });
    expect(serializationCalls).toBe(1);
  });

  it("preserves the first Express JSON serialization failure", async () => {
    let serializationCalls = 0;
    const response = await request(appWithErrorHandler((_req, res) =>
      res.json({
        toJSON() {
          serializationCalls += 1;
          if (serializationCalls === 1) {
            throw new Error("first serialization failed");
          }
          return { masked: true };
        },
      })))
      .post("/api/router")
      .send({})
      .expect(500);

    expect(response.body).toEqual({ message: "first serialization failed" });
    expect(serializationCalls).toBe(1);
  });

  it.each([
    [0, "lt_10ms"],
    [10, "lt_50ms"],
    [50, "lt_100ms"],
    [100, "lt_250ms"],
    [250, "lt_500ms"],
    [500, "lt_1000ms"],
    [1_000, "gte_1000ms"],
  ] as const)("buckets %d ms as %s", (duration, expected) => {
    expect(orchestratorLatencyBucket(duration)).toBe(expected);
  });

  it("digests only the serialized payload emitted by Express", () => {
    expect(digestLegacyJsonPayload('{"b":2,"a":1}')).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
    expect(digestLegacyJsonPayload('{"b":2,"a":1}')).not.toBe(
      digestLegacyJsonPayload('{"a":1,"b":2}'),
    );
    expect(digestLegacyJsonPayload(Buffer.from('{"b":2,"a":1}'))).toBe(
      digestLegacyJsonPayload('{"b":2,"a":1}'),
    );
    expect(digestLegacyJsonPayload({ b: 2, a: 1 })).toBeUndefined();
  });
});
