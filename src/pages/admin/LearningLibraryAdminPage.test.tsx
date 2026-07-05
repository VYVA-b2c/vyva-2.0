import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import LearningLibraryAdminPage from "./LearningLibraryAdminPage";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    logout: mocks.logout,
  }),
}));

const categoryPayload = {
  categories: [
    {
      id: "cat-music",
      slug: "music",
      label: "Music",
      description: "Songs and listening.",
      color: "#0F766E",
      icon: "music",
      sortOrder: 50,
      isActive: true,
      createdAt: null,
      updatedAt: null,
    },
  ],
};

const lessonPayload = {
  lessons: [
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
      imageUrl: "https://cdn.example.com/learning/music-memory.png",
      imageAlt: "A familiar melody represented as notes around a memory box.",
      imagePrompt: "A custom image showing music notes helping a memory become easier to recall.",
      estimatedMinutes: 3,
      difficulty: "easy",
      tags: ["music", "memory"],
      status: "draft",
      isActive: false,
      reviewedAt: null,
      reviewedBy: null,
      publishedAt: null,
      publishedBy: null,
      archivedAt: null,
      archivedBy: null,
      createdAt: "2026-06-24T09:00:00.000Z",
      updatedAt: "2026-06-24T09:00:00.000Z",
    },
  ],
};

function response(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("LearningLibraryAdminPage", () => {
  it("loads lessons and publishes the selected lesson", async () => {
    const publishedLesson = {
      ...lessonPayload.lessons[0],
      status: "published",
      isActive: true,
      publishedAt: "2026-06-24T10:00:00.000Z",
      publishedBy: "admin@example.com",
      updatedAt: "2026-06-24T10:00:00.000Z",
    };
    let published = false;
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url.startsWith("/api/admin/learning/lessons?")) {
        return Promise.resolve(response({ lessons: [published ? publishedLesson : lessonPayload.lessons[0]] }));
      }
      if (url === "/api/admin/learning/lessons/lesson-1/publish") {
        published = true;
        return Promise.resolve(response({
          lesson: publishedLesson,
        }));
      }
      return Promise.resolve(response({}));
    });

    render(
      <MemoryRouter initialEntries={["/admin/learning-library"]}>
        <LearningLibraryAdminPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Learning library" })).toBeInTheDocument();
    expect(await screen.findByText("Why music sticks in memory")).toBeInTheDocument();
    expect(screen.getByTestId("input-admin-learning-title")).toHaveValue("Why music sticks in memory");
    expect(screen.getByTestId("input-admin-learning-image-url")).toHaveValue("https://cdn.example.com/learning/music-memory.png");
    expect(screen.getByTestId("admin-learning-image-preview")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-admin-learning-publish"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/admin/learning/lessons/lesson-1/publish",
      { method: "PATCH" },
    ));
    expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Lesson published.");
    expect(screen.getByTestId("admin-learning-editor-message")).toHaveTextContent("Lesson published.");
    await waitFor(() => expect(screen.getAllByText("published").length).toBeGreaterThan(0));
  });

  it("saves the lesson and generates a custom image", async () => {
    const generatedLesson = {
      ...lessonPayload.lessons[0],
      imageUrl: "/api/learning/images/generated-image-1",
      imageAlt: "A gentle illustration of music notes around a memory box.",
      imagePrompt: "A gentle illustration of music notes around a memory box.",
      updatedAt: "2026-06-24T10:00:00.000Z",
    };
    mocks.apiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url.startsWith("/api/admin/learning/lessons?")) return Promise.resolve(response(lessonPayload));
      if (url === "/api/admin/learning/lessons/lesson-1" && options?.method === "PATCH") {
        const body = JSON.parse(String(options.body));
        return Promise.resolve(response({
          lesson: {
            ...lessonPayload.lessons[0],
            imagePrompt: body.imagePrompt,
            imageAlt: body.imageAlt,
          },
        }));
      }
      if (url === "/api/admin/learning/lessons/lesson-1/generate-image" && options?.method === "POST") {
        return Promise.resolve(response({
          image: {
            id: "generated-image-1",
            url: "/api/learning/images/generated-image-1",
            mimeType: "image/jpeg",
            model: "gpt-image-2",
          },
          lesson: generatedLesson,
        }));
      }
      return Promise.resolve(response({}));
    });

    render(
      <MemoryRouter initialEntries={["/admin/learning-library"]}>
        <LearningLibraryAdminPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Why music sticks in memory")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("textarea-admin-learning-image-prompt"), {
      target: { value: "A gentle illustration of music notes around a memory box." },
    });
    fireEvent.click(screen.getByTestId("button-admin-learning-generate-image"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/admin/learning/lessons/lesson-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("music notes around a memory box"),
      }),
    ));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/admin/learning/lessons/lesson-1/generate-image",
      {
        method: "POST",
        body: JSON.stringify({
          imagePrompt: "A gentle illustration of music notes around a memory box.",
          imageAlt: "A familiar melody represented as notes around a memory box.",
        }),
      },
    ));
    expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Image generated and saved.");
    expect(screen.getByTestId("input-admin-learning-image-url")).toHaveValue("/api/learning/images/generated-image-1");
  });

  it("bulk publishes draft lessons", async () => {
    const secondLesson = {
      ...lessonPayload.lessons[0],
      id: "lesson-2",
      externalId: "music-rhythm-002",
      title: "How rhythm helps attention",
      hook: "A steady beat can make attention easier to hold.",
    };
    const publishedLessons = [lessonPayload.lessons[0], secondLesson].map((lesson) => ({
      ...lesson,
      status: "published",
      isActive: true,
      publishedAt: "2026-06-24T10:00:00.000Z",
      publishedBy: "admin@example.com",
      updatedAt: "2026-06-24T10:00:00.000Z",
    }));
    let bulkPublished = false;
    mocks.apiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url.startsWith("/api/admin/learning/lessons?")) {
        return Promise.resolve(response({
          lessons: bulkPublished ? publishedLessons : [lessonPayload.lessons[0], secondLesson],
        }));
      }
      if (url === "/api/admin/learning/lessons/bulk-publish" && options?.method === "PATCH") {
        bulkPublished = true;
        return Promise.resolve(response({
          summary: { lessonsPublished: 2 },
          lessons: publishedLessons,
        }));
      }
      return Promise.resolve(response({}));
    });

    render(
      <MemoryRouter initialEntries={["/admin/learning-library"]}>
        <LearningLibraryAdminPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Why music sticks in memory")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-admin-learning-bulk-publish"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/admin/learning/lessons/bulk-publish",
      { method: "PATCH" },
    ));
    expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Published 2 draft lessons.");
    expect(screen.getByTestId("admin-learning-editor-message")).toHaveTextContent("Published 2 draft lessons.");
    await waitFor(() => expect(screen.getAllByText("published").length).toBeGreaterThan(0));
  });

  it("publishes selected draft lessons", async () => {
    const secondLesson = {
      ...lessonPayload.lessons[0],
      id: "lesson-2",
      externalId: "music-rhythm-002",
      title: "How rhythm helps attention",
      hook: "A steady beat can make attention easier to hold.",
    };
    const publishedSecondLesson = {
      ...secondLesson,
      status: "published",
      isActive: true,
      publishedAt: "2026-06-24T10:00:00.000Z",
      publishedBy: "admin@example.com",
      updatedAt: "2026-06-24T10:00:00.000Z",
    };
    let selectedPublished = false;
    mocks.apiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url.startsWith("/api/admin/learning/lessons?")) {
        return Promise.resolve(response({
          lessons: selectedPublished ? [lessonPayload.lessons[0], publishedSecondLesson] : [lessonPayload.lessons[0], secondLesson],
        }));
      }
      if (url === "/api/admin/learning/lessons/bulk-publish" && options?.method === "PATCH") {
        selectedPublished = true;
        return Promise.resolve(response({
          summary: { lessonsPublished: 1 },
          lessons: [publishedSecondLesson],
        }));
      }
      return Promise.resolve(response({}));
    });

    render(
      <MemoryRouter initialEntries={["/admin/learning-library"]}>
        <LearningLibraryAdminPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("How rhythm helps attention")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("checkbox-admin-learning-select-lesson-2"));
    fireEvent.click(screen.getByTestId("button-admin-learning-publish-selected"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/admin/learning/lessons/bulk-publish",
      {
        method: "PATCH",
        body: JSON.stringify({ lessonIds: ["lesson-2"] }),
      },
    ));
    expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Published 1 selected lesson.");
    expect(screen.getByTestId("admin-learning-editor-message")).toHaveTextContent("Published 1 selected lesson.");
  });

  it("shows language coverage across the full lesson library", async () => {
    const englishDraft = lessonPayload.lessons[0];
    const spanishPublished = {
      ...lessonPayload.lessons[0],
      id: "lesson-es",
      externalId: "music-memory-001-es",
      language: "es",
      title: "Por que la musica se queda en la memoria",
      status: "published",
      isActive: true,
      publishedAt: "2026-06-24T10:00:00.000Z",
      publishedBy: "admin@example.com",
      updatedAt: "2026-06-24T10:00:00.000Z",
    };

    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url === "/api/admin/learning/lessons?status=all&category=all&language=all") {
        return Promise.resolve(response({ lessons: [englishDraft, spanishPublished] }));
      }
      if (url.startsWith("/api/admin/learning/lessons?")) return Promise.resolve(response({ lessons: [englishDraft] }));
      return Promise.resolve(response({}));
    });

    render(
      <MemoryRouter initialEntries={["/admin/learning-library"]}>
        <LearningLibraryAdminPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("admin-learning-coverage")).toBeInTheDocument();
    expect(screen.getByTestId("admin-learning-coverage-cell-music-en")).toHaveTextContent("0 live");
    expect(screen.getByTestId("admin-learning-coverage-cell-music-en")).toHaveTextContent("1 draft");
    expect(screen.getByTestId("admin-learning-coverage-cell-music-es")).toHaveTextContent("1 live");
    expect(screen.getByTestId("admin-learning-coverage-cell-music-es")).toHaveTextContent("1 total");
    expect(screen.getByTestId("admin-learning-coverage-cell-music-fr")).toHaveTextContent("missing");
  });

  it("uploads a learning content pack", async () => {
    mocks.apiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url.startsWith("/api/admin/learning/lessons?")) return Promise.resolve(response(lessonPayload));
      if (url === "/api/admin/learning/import" && options?.method === "POST") {
        return Promise.resolve(response({
          summary: {
            categoriesCreated: 1,
            categoriesUpdated: 0,
            lessonsCreated: 1,
            lessonsUpdated: 0,
            lessonsPublished: 0,
            lessonsArchived: 0,
          },
        }));
      }
      return Promise.resolve(response({}));
    });

    render(
      <MemoryRouter initialEntries={["/admin/learning-library"]}>
        <LearningLibraryAdminPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Learning library" });

    const pack = {
      schema_version: "learning_content_pack_v1",
      categories: [{ slug: "world_cultures", label: "World Cultures" }],
      lessons: [{
        external_id: "world-cultures-tea-001",
        category_slug: "world_cultures",
        language: "en",
        title: "Why tea rituals feel calming",
        hook: "A simple cup of tea can become a small ceremony.",
        body: "Tea rituals often slow the body down.",
        reflection_prompt: "What daily routine feels calming to you?",
        image_url: "https://cdn.example.com/learning/tea-ritual.png",
        image_alt: "A calm cup of tea beside a small notebook.",
        image_prompt: "A custom image showing a calming tea ritual.",
        estimated_minutes: 3,
        difficulty: "easy",
        tags: ["culture"],
        status: "draft",
        is_active: false,
      }],
    };
    const uploadInput = screen.getByTestId("input-admin-learning-import");
    expect(uploadInput).toHaveAttribute("accept", expect.stringContaining(".txt"));

    const file = new File([`Here is the pack:\n\n\`\`\`json\n${JSON.stringify(pack)}\n\`\`\``], "learning-pack.txt", { type: "text/plain" });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/admin/learning/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(pack),
      }),
    ));
    expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Import complete.");
  });

  it("shows backend upload details when a content pack cannot be imported", async () => {
    mocks.apiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url.startsWith("/api/admin/learning/lessons?")) return Promise.resolve(response(lessonPayload));
      if (url === "/api/admin/learning/import" && options?.method === "POST") {
        return Promise.resolve(response({
          error: "Learning content pack could not be imported.",
          details: [
            "The app database host (helium) cannot be reached from this environment. Check DATABASE_URL or local network access, restart the API, and try again.",
          ],
        }, false));
      }
      return Promise.resolve(response({}));
    });

    render(
      <MemoryRouter initialEntries={["/admin/learning-library"]}>
        <LearningLibraryAdminPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Learning library" });

    const pack = {
      schema_version: "learning_content_pack_v1",
      categories: [{ slug: "science", label: "Science" }],
      lessons: [],
    };
    const file = new File([JSON.stringify(pack)], "learning-pack.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("input-admin-learning-import"), { target: { files: [file] } });

    expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Learning content pack could not be imported.");
    expect(screen.getByTestId("admin-learning-message")).toHaveTextContent("The app database host (helium) cannot be reached");
  });

  it("downloads a learning library template with the current categories", async () => {
    const createObjectUrl = vi.fn(() => "blob:learning-template");
    const revokeObjectUrl = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });

    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url.startsWith("/api/admin/learning/lessons?")) return Promise.resolve(response(lessonPayload));
      return Promise.resolve(response({}));
    });

    try {
      render(
        <MemoryRouter initialEntries={["/admin/learning-library"]}>
          <LearningLibraryAdminPage />
        </MemoryRouter>,
      );

      expect(await screen.findByText("Learning library JSON")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("button-admin-learning-template"));

      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:learning-template");

      const blob = createObjectUrl.mock.calls[0][0] as Blob;
      const template = JSON.parse(await blob.text());
      expect(template.schema_version).toBe("learning_content_pack_v1");
      expect(template.supported_languages).toEqual(["en", "es", "fr", "de", "it", "pt"]);
      expect(template.upload_format).toBe("grouped_translations");
      expect(template.categories).toEqual([
        expect.objectContaining({
          slug: "music",
          label: "Music",
          sort_order: 50,
          is_active: true,
        }),
      ]);
      expect(template.lessons[0]).toEqual(expect.objectContaining({
        category_slug: "music",
        external_id_base: "music-lesson-001",
        status: "draft",
        is_active: false,
        image_url: "https://example.com/learning/custom-lesson-image.png",
        image_prompt: expect.stringContaining("exact custom image"),
      }));
      expect(template.lessons[0].translations.en).toEqual(expect.objectContaining({
        title: "Replace with a clear English lesson title",
        image_alt: expect.stringContaining("plain English"),
        reflection_prompt: expect.any(String),
      }));
      expect(template.lessons[0].translations.es).toEqual(expect.objectContaining({
        title: "Replace with the Spanish lesson title",
      }));
      expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Learning library template download started.");
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
      click.mockRestore();
    }
  });
});
