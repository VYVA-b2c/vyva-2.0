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
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === "/api/admin/learning/categories") return Promise.resolve(response(categoryPayload));
      if (url.startsWith("/api/admin/learning/lessons?")) return Promise.resolve(response(lessonPayload));
      if (url === "/api/admin/learning/lessons/lesson-1/publish") {
        return Promise.resolve(response({
          lesson: {
            ...lessonPayload.lessons[0],
            status: "published",
            isActive: true,
            publishedAt: "2026-06-24T10:00:00.000Z",
            publishedBy: "admin@example.com",
            updatedAt: "2026-06-24T10:00:00.000Z",
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

    expect(await screen.findByRole("heading", { name: "Learning library" })).toBeInTheDocument();
    expect(await screen.findByText("Why music sticks in memory")).toBeInTheDocument();
    expect(screen.getByTestId("input-admin-learning-title")).toHaveValue("Why music sticks in memory");

    fireEvent.click(screen.getByTestId("button-admin-learning-publish"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/admin/learning/lessons/lesson-1/publish",
      { method: "PATCH" },
    ));
    expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Lesson published.");
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
        estimated_minutes: 3,
        difficulty: "easy",
        tags: ["culture"],
        status: "draft",
        is_active: false,
      }],
    };
    const file = new File([`Here is the pack:\n\n\`\`\`json\n${JSON.stringify(pack)}\n\`\`\``], "learning-pack.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("input-admin-learning-import"), { target: { files: [file] } });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/admin/learning/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(pack),
      }),
    ));
    expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Import complete.");
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
        external_id: "music-lesson-001",
        status: "draft",
        is_active: false,
      }));
      expect(await screen.findByTestId("admin-learning-message")).toHaveTextContent("Learning library template download started.");
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
      click.mockRestore();
    }
  });
});
