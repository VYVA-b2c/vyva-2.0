import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  insertedValues: [] as unknown[],
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import adminLearningRouter from "../routes/adminLearning.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/learning", adminLearningRouter);
  return app;
}

function makeTransaction() {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => []),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: unknown) => {
        dbMock.insertedValues.push(values);
      }),
    })),
  };
}

const app = buildApp();

describe("admin learning import", () => {
  beforeEach(() => {
    dbMock.insertedValues = [];
    dbMock.db.select.mockReset();
    dbMock.db.transaction.mockReset();
    dbMock.db.select
      .mockReturnValueOnce({
        from: () => ({
          limit: async () => [],
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          limit: async () => [],
        }),
      });
    dbMock.db.transaction.mockImplementation(async (callback: (tx: ReturnType<typeof makeTransaction>) => Promise<void>) => {
      await callback(makeTransaction());
    });
  });

  it("imports the downloaded snake_case learning content pack format", async () => {
    const response = await request(app)
      .post("/api/admin/learning/import")
      .send({
        schema_version: "learning_content_pack_v1",
        categories: [
          {
            slug: "science",
            label: "Science",
            description: "Short discoveries about the world.",
            color: "#2563EB",
            icon: "atom",
            sort_order: 10,
            is_active: true,
          },
        ],
        lessons: [
          {
            external_id: "science-soap-cleaning-001",
            category_slug: "science",
            language: "en",
            title: "Why Soap Helps Water Do More",
            hook: "Soap turns an ordinary rinse into a tiny act of chemistry.",
            body: "Soap has two different sides that help water carry oil away.",
            reflection_prompt: "What simple household tool quietly does more than people notice?",
            source_notes: "General chemistry background.",
            estimated_minutes: 3,
            difficulty: "easy",
            tags: ["chemistry", "cleaning"],
            status: "draft",
            is_active: false,
          },
        ],
      })
      .expect(200);

    expect(response.body.summary).toMatchObject({
      categoriesCreated: 1,
      lessonsCreated: 1,
    });
    expect(dbMock.insertedValues).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: "science", sortOrder: 10, isActive: true }),
      expect.objectContaining({ externalId: "science-soap-cleaning-001", categorySlug: "science" }),
    ]));
  });
});
