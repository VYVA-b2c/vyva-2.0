import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware, requireUser } from "../middleware/auth.js";

const dbMock = vi.hoisted(() => ({
  db: {
    select: vi.fn(() => {
      throw new Error("advisor db unavailable");
    }),
    insert: vi.fn(() => {
      throw new Error("advisor db unavailable");
    }),
    update: vi.fn(() => {
      throw new Error("advisor db unavailable");
    }),
  },
}));

vi.mock("../db.js", () => dbMock);

const openAiCreateMock = vi.hoisted(() => vi.fn());
vi.mock("openai", () => {
  class MockOpenAI {
    chat = { completions: { create: openAiCreateMock } };
  }
  return { default: MockOpenAI };
});

import advisorsRouter from "../routes/advisors.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/advisors", authMiddleware, requireUser, advisorsRouter);
  return app;
}

describe("advisors API mem0 integration", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("MEM0_API_KEY", "test-mem0-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.db.select.mockClear();
    openAiCreateMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("injects retrieved memory into the system prompt without instructing the model to volunteer it", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ memories: [{ memory: "Prefers seated exercises because of a bad knee" }] }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "mem-1" }) });
    openAiCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: "Let's try a seated routine today." } }],
    });

    const res = await request(buildApp())
      .post("/api/advisors/amara/messages?lang=en")
      .set("x-user-id", "mem0-user-1")
      .send({ prompt: "What movement should I try today?", source: "text" })
      .expect(200);

    expect(res.body.assistantMessage.text).toBe("Let's try a seated routine today.");

    const searchCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/memories/search/"));
    expect(searchCall).toBeTruthy();
    expect(JSON.parse(searchCall![1].body)).toMatchObject({ user_id: "mem0-user-1" });

    const systemMessage = openAiCreateMock.mock.calls[0][0].messages[0];
    expect(systemMessage.content).toContain("Prefers seated exercises because of a bad knee");
    expect(systemMessage.content).toMatch(/never volunteer it unprompted/i);

    const addCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/memories/"));
    expect(addCall).toBeTruthy();
    const addBody = JSON.parse(addCall![1].body);
    expect(addBody.user_id).toBe("mem0-user-1");
    expect(addBody.messages).toEqual([
      { role: "user", content: "What movement should I try today?" },
      { role: "assistant", content: "Let's try a seated routine today." },
    ]);
  });

  it("shares one mem0 identity across advisors rather than a per-agent one", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ memories: [] }) });
    openAiCreateMock.mockResolvedValue({
      choices: [{ message: { content: "General reply." } }],
    });

    await request(buildApp())
      .post("/api/advisors/nora/messages?lang=en")
      .set("x-user-id", "mem0-user-2")
      .send({ prompt: "What should I eat?", source: "text" })
      .expect(200);

    await request(buildApp())
      .post("/api/advisors/diego/messages?lang=en")
      .set("x-user-id", "mem0-user-2")
      .send({ prompt: "Is this text a scam?", source: "text" })
      .expect(200);

    const searchUserIds = fetchMock.mock.calls
      .filter(([url]) => String(url).includes("v1/memories/search/"))
      .map(([, options]) => JSON.parse(options.body).user_id);
    expect(searchUserIds).toEqual(["mem0-user-2", "mem0-user-2"]);
  });
});
