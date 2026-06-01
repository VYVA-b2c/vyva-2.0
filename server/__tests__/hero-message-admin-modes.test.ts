import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  selectFrom: vi.fn(),
  selectWhere: vi.fn(),
  selectLimit: vi.fn(),
  selectOrderBy: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  updateReturning: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
}));

const openAiMocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    select: dbMocks.select,
    update: dbMocks.update,
    insert: dbMocks.insert,
  },
  pool: {},
}));

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: openAiMocks.create,
      },
    },
  })),
}));

import { adminLifecycleRouter } from "../routes/adminLifecycle.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as typeof req & { user: { id: string; email: string; role: string } }).user = {
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
    };
    next();
  });
  app.use("/api/admin/lifecycle", adminLifecycleRouter);
  return app;
}

const app = buildApp();
const originalOpenAiKey = process.env.OPENAI_API_KEY;

function configureDb(existingRows: unknown[] = []) {
  const selectChain = {
    from: dbMocks.selectFrom,
    where: dbMocks.selectWhere,
    limit: dbMocks.selectLimit,
    orderBy: dbMocks.selectOrderBy,
  };
  dbMocks.selectFrom.mockReturnValue(selectChain);
  dbMocks.selectWhere.mockReturnValue(selectChain);
  dbMocks.selectLimit.mockResolvedValue(existingRows);
  dbMocks.selectOrderBy.mockResolvedValue(existingRows);
  dbMocks.select.mockReturnValue(selectChain);

  const updateChain = {
    set: dbMocks.updateSet,
    where: dbMocks.updateWhere,
    returning: dbMocks.updateReturning,
  };
  dbMocks.updateSet.mockReturnValue(updateChain);
  dbMocks.updateWhere.mockReturnValue(updateChain);
  dbMocks.updateReturning.mockResolvedValue([{ message_id: "health-admin" }]);
  dbMocks.update.mockReturnValue(updateChain);

  const insertChain = {
    values: dbMocks.insertValues,
    returning: dbMocks.insertReturning,
  };
  dbMocks.insertValues.mockReturnValue(insertChain);
  dbMocks.insertReturning.mockResolvedValue([{ message_id: "health-admin" }]);
  dbMocks.insert.mockReturnValue(insertChain);
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    message_id: "health-admin",
    surface: "health",
    reason: "evergreen",
    priority: 50,
    cooldown_hours: 8,
    periods: [],
    safety_levels: [],
    event_types: [],
    activity_types: [],
    copy: {
      es: { sourceText: "Salud", headline: "Control listo", subtitle: "Revision diaria", ctaLabel: "Hablar" },
    },
    is_enabled: true,
    admin_notes: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  configureDb();
});

afterEach(() => {
  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

describe("admin hero message content modes", () => {
  it("keeps save compatible when mode fields are omitted", async () => {
    await request(app)
      .post("/api/admin/lifecycle/hero-messages")
      .send(payload())
      .expect(201);

    expect(dbMocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      copy_modes: {},
      copy_source_metadata: {},
    }));
  });

  it("persists per-language mode metadata on save", async () => {
    await request(app)
      .post("/api/admin/lifecycle/hero-messages")
      .send(payload({
        copy_modes: { es: "library" },
        copy_source_metadata: { es: { templateId: "library-health-safe-default" } },
      }))
      .expect(201);

    expect(dbMocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      copy_modes: { es: "library" },
      copy_source_metadata: { es: { templateId: "library-health-safe-default" } },
    }));
  });

  it("returns a clear admin error when AI generation is unavailable", async () => {
    delete process.env.OPENAI_API_KEY;

    const res = await request(app)
      .post("/api/admin/lifecycle/hero-messages/generate-copy")
      .send({
        surface: "health",
        language: "es",
        reason: "evergreen",
        current_copy: { headline: "Todo en orden" },
      })
      .expect(503);

    expect(res.body.error).toMatch(/OPENAI_API_KEY/i);
    expect(openAiMocks.create).not.toHaveBeenCalled();
  });

  it("rejects invalid AI generation requests", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    await request(app)
      .post("/api/admin/lifecycle/hero-messages/generate-copy")
      .send({
        surface: "",
        language: "xx",
        reason: "evergreen",
      })
      .expect(400);

    expect(openAiMocks.create).not.toHaveBeenCalled();
  });

  it("generates and validates an admin-only AI draft", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    openAiMocks.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            sourceText: "Salud",
            headline: "Control listo",
            subtitle: "Revision diaria",
            ctaLabel: "Hablar",
            contextHint: "health doctor",
          }),
        },
      }],
    });

    const res = await request(app)
      .post("/api/admin/lifecycle/hero-messages/generate-copy")
      .send({
        surface: "health",
        language: "es",
        reason: "evergreen",
        current_copy: { headline: "Todo en orden" },
      })
      .expect(200);

    expect(res.body.copy.headline).toBe("Control listo");
    expect(res.body.metadata.mode).toBe("ai_generated");
    expect(openAiMocks.create).toHaveBeenCalledTimes(1);
  });
});
