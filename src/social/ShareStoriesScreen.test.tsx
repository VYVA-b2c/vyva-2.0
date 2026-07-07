import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import ShareStoriesScreen from "./ShareStoriesScreen";
import type { SocialShareDropBoxNote, SocialShareStoriesHomeResponse, SocialShareStoryPrompt } from "./types";

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => null,
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const prompts: SocialShareStoryPrompt[] = [
  {
    id: "song-old-favourite",
    noteType: "song",
    title: "An old favourite song",
    body: "Say the song and the memory it brings back.",
    promptText: "What song would you like to share today?",
    promptKind: "song",
    connectionGoal: "Find someone who remembers this song too.",
    suggestedRoomSlug: "music-room",
    roomPath: "/social-rooms/music-room",
    roomName: "Music Room",
    connectionLabel: "See the Music Room",
    nextActionLabel: "Share another",
  },
  {
    id: "recipe-family-table",
    noteType: "recipe",
    title: "Family table",
    body: "Leave a recipe, kitchen trick, or food memory.",
    promptText: "What recipe or kitchen tip would you like to save?",
    promptKind: "recipe",
    connectionGoal: "Invite kitchen memories and tips.",
    suggestedRoomSlug: "kitchen-table",
    roomPath: "/social-rooms/kitchen-table",
    roomName: "Kitchen Table",
    connectionLabel: "See Kitchen Table",
    nextActionLabel: "Share another",
  },
];

function note(overrides: Partial<SocialShareDropBoxNote> = {}): SocialShareDropBoxNote {
  return {
    id: "share-note-1",
    noteType: "recipe",
    source: "typed",
    transcript: "My soup needs parsley at the end",
    editedText: "My soup needs parsley at the end",
    suggestedRoomSlug: "kitchen-table",
    promptId: "recipe-family-table",
    promptText: "What recipe or kitchen tip would you like to save?",
    promptKind: "recipe",
    connectionGoal: "Invite kitchen memories and tips.",
    connectionLabel: "See Kitchen Table",
    nextActionLabel: "Share another",
    roomPath: "/social-rooms/kitchen-table",
    status: "ready",
    safetyFlags: [],
    placementKind: "room_handoff",
    placementTargetId: null,
    publishLabel: "Place in room",
    publishedAt: null,
    deletedAt: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    audio: null,
    ...overrides,
  };
}

function home(overrides: Partial<SocialShareStoriesHomeResponse> = {}): SocialShareStoriesHomeResponse {
  return {
    todayPrompt: prompts[0],
    prompts,
    recentNotes: [
      note({ id: "ready-note", status: "ready", editedText: "A reading thought", noteType: "reading", connectionLabel: "See Reading Room" }),
      note({ id: "placed-note", status: "placed", editedText: "Stand By Me", noteType: "song", suggestedRoomSlug: "music-room", roomPath: "/social-rooms/music-room", connectionLabel: "See the Music Room" }),
      note({ id: "blocked-note", status: "blocked", editedText: "Text me outside", noteType: "hello", connectionLabel: "Open Together Room" }),
    ],
    stats: { sharedThisWeek: 3, placedThisWeek: 1, readyCount: 1, blockedCount: 1 },
    suggestedRooms: prompts.map((prompt) => ({
      noteType: prompt.noteType,
      slug: prompt.suggestedRoomSlug,
      name: prompt.roomName,
      path: prompt.roomPath,
      connectionGoal: prompt.connectionGoal,
    })),
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <pre data-testid="route-state">{JSON.stringify(location.state ?? {})}</pre>
    </>
  );
}

function renderShareStories(response = home()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => response,
      },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/social-rooms/share"]}>
        <Routes>
          <Route path="/social-rooms/share" element={<ShareStoriesScreen />} />
          <Route path="/social-rooms/:slug" element={<LocationProbe />} />
          <Route path="/social-rooms" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ShareStoriesScreen", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the simple story prompt, actions, theme chips, and recent share statuses", async () => {
    renderShareStories();

    expect(await screen.findByText("Share a story")).toBeInTheDocument();
    expect(screen.getByTestId("share-stories-today")).toHaveTextContent("What song would you like to share today?");
    expect(screen.getByTestId("button-share-stories-start-voice")).toBeInTheDocument();
    expect(screen.getByTestId("button-share-stories-type")).toBeInTheDocument();

    const promptRail = screen.getByTestId("share-stories-prompts");
    expect(within(promptRail).getByText("An old favourite song")).toBeInTheDocument();
    expect(within(promptRail).getByText("Family table")).toBeInTheDocument();

    const recent = screen.getByTestId("share-stories-recent");
    expect(recent).toHaveTextContent("Ready");
    expect(recent).toHaveTextContent("Placed");
    expect(recent).toHaveTextContent("Review");
  });

  it("sends prompt metadata for typed stories and shows the placement outcome", async () => {
    apiFetchMock.mockImplementation(async (url, options) => {
      if (String(url).endsWith("/api/social/share-dropbox/notes")) {
        const body = JSON.parse(String(options?.body ?? "{}"));
        expect(body).toMatchObject({
          noteType: "recipe",
          promptId: "recipe-family-table",
          promptKind: "recipe",
          connectionGoal: "Invite kitchen memories and tips.",
        });
        return jsonResponse({ ok: true, note: note() }, { status: 201 });
      }
      if (String(url).includes("/share-dropbox/notes/share-note-1") && options?.method === "PATCH") {
        const body = JSON.parse(String(options?.body ?? "{}"));
        expect(body.promptId).toBe("recipe-family-table");
        return jsonResponse({ ok: true, note: note() });
      }
      if (String(url).includes("/publish")) {
        return jsonResponse({
          ok: true,
          note: note({ status: "placed", publishedAt: "2026-07-01T10:05:00.000Z" }),
          connection: {
            label: "See Kitchen Table",
            nextActionLabel: "Share another",
            roomPath: "/social-rooms/kitchen-table",
          },
          handoff: {
            roomSlug: "kitchen-table",
            path: "/social-rooms/kitchen-table",
            state: {
              socialShareDropBoxNote: {
                id: "share-note-1",
                noteType: "recipe",
                text: "My soup needs parsley at the end",
                source: "share-dropbox",
              },
            },
          },
        });
      }
      return jsonResponse({ ok: true });
    });

    renderShareStories();
    await screen.findByText("Share a story");

    fireEvent.click(screen.getByTestId("share-story-prompt-recipe-family-table"));
    fireEvent.click(screen.getByTestId("button-share-stories-type"));
    fireEvent.change(screen.getByTestId("share-dropbox-typed-input"), {
      target: { value: "My soup needs parsley at the end" },
    });
    fireEvent.click(screen.getByTestId("button-share-dropbox-save-typed"));

    await waitFor(() => {
      expect(screen.getByTestId("share-dropbox-review-text")).toHaveValue("My soup needs parsley at the end");
    });

    fireEvent.click(screen.getByTestId("button-share-dropbox-primary"));

    expect(await screen.findByTestId("share-stories-outcome")).toHaveTextContent("Story placed");
    fireEvent.click(screen.getByRole("button", { name: "See the room" }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/kitchen-table");
    expect(screen.getByTestId("route-state")).toHaveTextContent("share-dropbox");
  });
});
