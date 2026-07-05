import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  insertedValues: [] as unknown[],
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));
const openAiMock = vi.hoisted(() => ({
  generate: vi.fn(),
}));

vi.mock("../db.js", () => dbMock);
vi.mock("openai", () => ({
  default: class MockOpenAI {
    images = {
      generate: openAiMock.generate,
    };
  },
}));

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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin learning import", () => {
  beforeEach(() => {
    dbMock.insertedValues = [];
    dbMock.db.insert.mockReset();
    dbMock.db.select.mockReset();
    dbMock.db.update.mockReset();
    dbMock.db.transaction.mockReset();
    openAiMock.generate.mockReset();
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
            image_url: "https://cdn.example.com/learning/soap-water.png",
            image_alt: "Soap molecules helping water lift oil from a hand.",
            image_prompt: "A clear custom image showing soap molecules connecting water and oil.",
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
      expect.objectContaining({
        externalId: "science-soap-cleaning-001",
        categorySlug: "science",
        imageUrl: "https://cdn.example.com/learning/soap-water.png",
        imageAlt: "Soap molecules helping water lift oil from a hand.",
        imagePrompt: "A clear custom image showing soap molecules connecting water and oil.",
      }),
    ]));
  });

  it("expands grouped lesson translations into language-specific lessons", async () => {
    const response = await request(app)
      .post("/api/admin/learning/import")
      .send({
        schema_version: "learning_content_pack_v1",
        categories: [
          {
            slug: "science",
            label: "Science",
          },
        ],
        lessons: [
          {
            external_id_base: "science-soap-cleaning-001",
            category_slug: "science",
            estimated_minutes: 3,
            difficulty: "easy",
            tags: ["chemistry", "cleaning"],
            status: "draft",
            is_active: false,
            image_url: "https://cdn.example.com/learning/soap-water.png",
            image_prompt: "A custom image showing soap, water, and oil at a simple molecular level.",
            translations: {
              en: {
                title: "Why Soap Helps Water Do More",
                hook: "Soap turns an ordinary rinse into a tiny act of chemistry.",
                body: "Soap has two different sides that help water carry oil away.",
                reflection_prompt: "What simple household tool quietly does more than people notice?",
                image_alt: "Soap molecules helping water carry oil away.",
                source_notes: "General chemistry background.",
              },
              es: {
                title: "Por que el jabon ayuda al agua",
                hook: "El jabon convierte un enjuague comun en un pequeno acto de quimica.",
                body: "El jabon tiene dos lados diferentes que ayudan al agua a llevarse el aceite.",
                reflection_prompt: "Que herramienta sencilla hace mas de lo que parece?",
                image_alt: "Moleculas de jabon ayudando al agua a retirar aceite.",
                source_notes: "Revision de contenido en espanol.",
              },
            },
          },
        ],
      })
      .expect(200);

    expect(response.body.summary).toMatchObject({
      categoriesCreated: 1,
      lessonsCreated: 2,
    });
    expect(dbMock.insertedValues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        externalId: "science-soap-cleaning-001-en",
        language: "en",
        title: "Why Soap Helps Water Do More",
        imageUrl: "https://cdn.example.com/learning/soap-water.png",
        imageAlt: "Soap molecules helping water carry oil away.",
      }),
      expect.objectContaining({
        externalId: "science-soap-cleaning-001-es",
        language: "es",
        title: "Por que el jabon ayuda al agua",
        imageUrl: "https://cdn.example.com/learning/soap-water.png",
        imageAlt: "Moleculas de jabon ayudando al agua a retirar aceite.",
      }),
    ]));
  });

  it("imports a full 80 lesson pack without rejecting valid rows", async () => {
    const categories = [
      "science",
      "language",
      "arts",
      "general_knowledge",
      "music",
      "history",
      "nature",
      "technology",
    ].map((slug, index) => ({
      slug,
      label: slug.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
      description: `Learning snippets for ${slug}.`,
      color: "#2563EB",
      icon: "book_open",
      sort_order: (index + 1) * 10,
      is_active: true,
    }));

    const lessons = Array.from({ length: 80 }, (_, index) => {
      const category = categories[index % categories.length];
      const lessonNumber = String(index + 1).padStart(3, "0");
      return {
        external_id: `${category.slug}-lesson-${lessonNumber}`,
        category_slug: category.slug,
        language: "en",
        title: `Gentle lesson ${lessonNumber}`,
        hook: "A small idea can still be worth noticing.",
        body: "This lesson is short, warm, and specific enough for a daily learning snippet.",
        reflection_prompt: "What part of this idea would you like to remember tomorrow?",
        source_notes: "Curated admin content test fixture.",
        estimated_minutes: 3,
        difficulty: index % 3 === 0 ? "medium" : "easy",
        tags: ["learning", category.slug],
        status: "draft",
        is_active: false,
      };
    });

    const response = await request(app)
      .post("/api/admin/learning/import")
      .send({
        schema_version: "learning_content_pack_v1",
        categories,
        lessons,
      })
      .expect(200);

    expect(response.body.summary).toMatchObject({
      categoriesCreated: 8,
      lessonsCreated: 80,
      lessonsUpdated: 0,
    });
    expect(dbMock.insertedValues).toHaveLength(88);
    expect(dbMock.insertedValues).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: "general_knowledge", sortOrder: 40, isActive: true }),
      expect.objectContaining({ externalId: "science-lesson-001", categorySlug: "science" }),
      expect.objectContaining({ externalId: "technology-lesson-080", categorySlug: "technology" }),
    ]));
  });

  it("returns a database reachability detail when import queries cannot connect", async () => {
    dbMock.db.select.mockReset();
    dbMock.db.select.mockImplementation(() => ({
      from: () => ({
        limit: async () => {
          const cause = Object.assign(new Error("getaddrinfo ENOTFOUND helium"), {
            code: "ENOTFOUND",
            hostname: "helium",
          });
          const error = new Error("Failed query");
          (error as Error & { cause?: unknown }).cause = cause;
          throw error;
        },
      }),
    }));

    const response = await request(app)
      .post("/api/admin/learning/import")
      .send({
        schema_version: "learning_content_pack_v1",
        categories: [
          {
            slug: "science",
            label: "Science",
          },
        ],
        lessons: [],
      })
      .expect(500);

    expect(response.body).toMatchObject({
      error: "Learning content pack could not be imported.",
      details: [
        expect.stringContaining("The app database host (helium) cannot be reached"),
      ],
    });
  });

  it("returns a schema drift detail when learning text columns are still json", async () => {
    const cause = Object.assign(new Error('invalid input syntax for type json'), {
      code: "22P02",
      detail: 'Token "Temporary" is invalid.',
      where: "JSON data, line 1: Temporary",
    });
    const error = new Error("Failed query");
    (error as Error & { cause?: unknown }).cause = cause;
    dbMock.db.transaction.mockRejectedValue(error);

    const response = await request(app)
      .post("/api/admin/learning/import")
      .send({
        schema_version: "learning_content_pack_v1",
        categories: [
          {
            slug: "science",
            label: "Science",
          },
        ],
        lessons: [],
      })
      .expect(500);

    expect(response.body).toMatchObject({
      error: "Learning content pack could not be imported.",
      details: [
        expect.stringContaining("one or more lesson/category text fields are still JSON columns"),
      ],
    });
  });

  it("bulk publishes draft and review lessons", async () => {
    const now = new Date("2026-06-24T10:00:00.000Z");
    const returning = vi.fn(async () => [
      {
        id: "lesson-1",
        externalId: "music-memory-001",
        categorySlug: "music",
        language: "en",
        title: "Why music sticks in memory",
        hook: "A melody gives memory a rhythm to walk on.",
        body: "Music combines pattern, repetition, emotion, and timing.",
        reflectionPrompt: "What song can you remember from long ago?",
        sourceNotes: "Starter curated library",
        estimatedMinutes: 3,
        difficulty: "easy",
        tags: ["music", "memory"],
        status: "published",
        isActive: true,
        reviewedAt: now,
        reviewedBy: "admin",
        publishedAt: now,
        publishedBy: "admin",
        archivedAt: null,
        archivedBy: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "lesson-2",
        externalId: "science-soap-001",
        categorySlug: "science",
        language: "en",
        title: "Why soap helps water do more",
        hook: "Soap changes how water meets oil.",
        body: "Soap molecules can connect with oil and water at the same time.",
        reflectionPrompt: "Where did you see chemistry quietly helping today?",
        sourceNotes: "General chemistry background.",
        estimatedMinutes: 3,
        difficulty: "easy",
        tags: ["science"],
        status: "published",
        isActive: true,
        reviewedAt: now,
        reviewedBy: "admin",
        publishedAt: now,
        publishedBy: "admin",
        archivedAt: null,
        archivedBy: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    dbMock.db.update.mockReturnValue({ set });

    const response = await request(app)
      .patch("/api/admin/learning/lessons/bulk-publish")
      .expect(200);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: "published",
      isActive: true,
      reviewedBy: "admin",
      publishedBy: "admin",
    }));
    expect(where).toHaveBeenCalledTimes(1);
    expect(returning).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      summary: { lessonsPublished: 2 },
      lessons: [
        expect.objectContaining({ id: "lesson-1", status: "published", isActive: true }),
        expect.objectContaining({ id: "lesson-2", status: "published", isActive: true }),
      ],
    });
  });

  it("bulk publishes only selected lessons when IDs are provided", async () => {
    const now = new Date("2026-06-24T10:00:00.000Z");
    const returning = vi.fn(async () => [
      {
        id: "lesson-2",
        externalId: "science-soap-001",
        categorySlug: "science",
        language: "en",
        title: "Why soap helps water do more",
        hook: "Soap changes how water meets oil.",
        body: "Soap molecules can connect with oil and water at the same time.",
        reflectionPrompt: "Where did you see chemistry quietly helping today?",
        sourceNotes: "General chemistry background.",
        estimatedMinutes: 3,
        difficulty: "easy",
        tags: ["science"],
        status: "published",
        isActive: true,
        reviewedAt: now,
        reviewedBy: "admin",
        publishedAt: now,
        publishedBy: "admin",
        archivedAt: null,
        archivedBy: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    dbMock.db.update.mockReturnValue({ set });

    const response = await request(app)
      .patch("/api/admin/learning/lessons/bulk-publish")
      .send({ lessonIds: ["lesson-2", "lesson-2"] })
      .expect(200);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: "published",
      isActive: true,
      reviewedBy: "admin",
      publishedBy: "admin",
    }));
    expect(where).toHaveBeenCalledTimes(1);
    expect(returning).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      summary: { lessonsPublished: 1 },
      lessons: [
        expect.objectContaining({ id: "lesson-2", status: "published", isActive: true }),
      ],
    });
  });

  it("generates and stores a custom lesson image", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const now = new Date("2026-06-24T10:00:00.000Z");
    const lesson = {
      id: "11111111-1111-4111-8111-111111111111",
      externalId: "science-soap-001",
      categorySlug: "science",
      language: "en",
      title: "Why soap helps water do more",
      hook: "Soap changes how water meets oil.",
      body: "Soap molecules can connect with oil and water at the same time.",
      reflectionPrompt: "Where did you see chemistry quietly helping today?",
      sourceNotes: "General chemistry background.",
      imageUrl: null,
      imageAlt: null,
      imagePrompt: "Show soap molecules lifting oil away in water.",
      estimatedMinutes: 3,
      difficulty: "easy",
      tags: ["science"],
      status: "draft",
      isActive: false,
      reviewedAt: null,
      reviewedBy: null,
      publishedAt: null,
      publishedBy: null,
      archivedAt: null,
      archivedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    const imageId = "22222222-2222-4222-8222-222222222222";
    const imageBytes = Buffer.from("generated image bytes");
    openAiMock.generate.mockResolvedValue({
      data: [{ b64_json: imageBytes.toString("base64") }],
    });
    dbMock.db.select.mockReset();
    dbMock.db.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [lesson],
        }),
      }),
    });
    const imageValues = vi.fn(() => ({
      returning: vi.fn(async () => [{
        id: imageId,
        lessonId: lesson.id,
        mimeType: "image/jpeg",
        imageBytes,
        prompt: "stored prompt",
        model: "gpt-image-2",
        createdBy: "admin",
        createdAt: now,
      }]),
    }));
    dbMock.db.insert.mockReturnValue({ values: imageValues });
    const updatedLesson = {
      ...lesson,
      imageUrl: `/api/learning/images/${imageId}`,
      imageAlt: "Soap molecules helping water lift oil.",
      updatedAt: now,
    };
    const returning = vi.fn(async () => [updatedLesson]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    dbMock.db.update.mockReturnValue({ set });

    const response = await request(app)
      .post(`/api/admin/learning/lessons/${lesson.id}/generate-image`)
      .send({
        imagePrompt: "Show soap molecules lifting oil away in water.",
        imageAlt: "Soap molecules helping water lift oil.",
      })
      .expect(200);

    expect(openAiMock.generate).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-image-2",
      prompt: expect.stringContaining("Why soap helps water do more"),
      output_format: "jpeg",
    }));
    expect(imageValues).toHaveBeenCalledWith(expect.objectContaining({
      lessonId: lesson.id,
      mimeType: "image/jpeg",
      imageBytes,
      model: "gpt-image-2",
    }));
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      imageUrl: `/api/learning/images/${imageId}`,
      imageAlt: "Soap molecules helping water lift oil.",
      imagePrompt: "Show soap molecules lifting oil away in water.",
    }));
    expect(response.body).toMatchObject({
      image: {
        id: imageId,
        url: `/api/learning/images/${imageId}`,
        mimeType: "image/jpeg",
        model: "gpt-image-2",
      },
      lesson: {
        id: lesson.id,
        imageUrl: `/api/learning/images/${imageId}`,
        imageAlt: "Soap molecules helping water lift oil.",
      },
    });
  });
});
