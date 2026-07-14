import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import ShareDropBoxSheet from "./ShareDropBoxSheet";
import type { SocialShareDropBoxNote, SocialShareStoryPrompt } from "./types";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const songPrompt: SocialShareStoryPrompt = {
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
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function shareNote(overrides: Partial<SocialShareDropBoxNote> = {}): SocialShareDropBoxNote {
  return {
    id: "share-note-1",
    noteType: "song",
    source: "voice",
    transcript: "Stand By Me",
    editedText: "Stand By Me",
    suggestedRoomSlug: "music-room",
    promptId: null,
    promptText: null,
    promptKind: null,
    connectionGoal: null,
    connectionLabel: "See the Music Room",
    nextActionLabel: "Share another",
    roomPath: "/social-rooms/music-room",
    status: "ready",
    safetyFlags: [],
    placementKind: "music_circle_item",
    placementTargetId: null,
    publishLabel: "Share in Music Room",
    publishedAt: null,
    deletedAt: null,
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z",
    audio: {
      id: "share-audio-1",
      url: "/api/social/share-dropbox/notes/share-note-1/audio",
      mimeType: "audio/webm",
      byteSize: 64,
      durationMs: 1200,
      expiresAt: "2026-07-24T00:00:00.000Z",
    },
    ...overrides,
  };
}

function installMediaRecorderMock() {
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  class MockMediaRecorder {
    static isTypeSupported = vi.fn(() => true);
    state: "inactive" | "recording" = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(_stream: MediaStream, options?: { mimeType?: string }) {
      this.mimeType = options?.mimeType ?? "audio/webm";
    }

    start() {
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob([new Uint8Array(64)], { type: this.mimeType }) });
      this.onstop?.();
    }
  }

  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
}

describe("ShareDropBoxSheet", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });

  it("records, reviews private audio, and publishes a song note", async () => {
    installMediaRecorderMock();
    const onNavigate = vi.fn();
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/notes/audio")) {
        return jsonResponse({
          ok: true,
          note: shareNote({
            promptId: songPrompt.id,
            promptText: songPrompt.promptText,
            promptKind: songPrompt.promptKind,
            connectionGoal: songPrompt.connectionGoal,
          }),
        }, { status: 201 });
      }
      if (String(url).includes("/publish")) {
        return jsonResponse({
          ok: true,
          note: shareNote({ status: "placed", publishedAt: "2026-06-24T01:00:00.000Z" }),
          roomPath: "/social-rooms/music-room",
        });
      }
      return jsonResponse({ ok: true });
    });

    render(<ShareDropBoxSheet language="en" onClose={vi.fn()} onNavigate={onNavigate} prompt={songPrompt} />);

    fireEvent.click(screen.getByTestId("button-share-dropbox-primary"));
    await waitFor(() => expect(screen.getByText(/Listening/i)).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("button-share-dropbox-finish"));

    await waitFor(() => {
      expect(screen.getByTestId("share-dropbox-review-text")).toHaveValue("Stand By Me");
    });
    expect(screen.getByTestId("share-dropbox-audio")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-share-dropbox-primary"));

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith("/social-rooms/music-room");
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("promptId=song-old-favourite"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("saves typed fallback notes and hands reading notes to the room", async () => {
    const onNavigate = vi.fn();
    apiFetchMock.mockImplementation(async (url, options) => {
      if (String(url).endsWith("/api/social/share-dropbox/notes")) {
        expect(String(options?.body)).toContain("A book that stayed with me");
        return jsonResponse({
          ok: true,
          note: shareNote({
            noteType: "reading",
            source: "typed",
            transcript: "A book that stayed with me",
            editedText: "A book that stayed with me",
            suggestedRoomSlug: "reading-room",
            roomPath: "/social-rooms/reading-room",
            placementKind: "room_handoff",
            publishLabel: "Place in room",
            audio: null,
          }),
        }, { status: 201 });
      }
      if (String(url).includes("/publish")) {
        return jsonResponse({
          ok: true,
          note: shareNote({
            noteType: "reading",
            source: "typed",
            status: "placed",
            editedText: "A book that stayed with me",
            suggestedRoomSlug: "reading-room",
            roomPath: "/social-rooms/reading-room",
            placementKind: "room_handoff",
            audio: null,
          }),
          handoff: {
            roomSlug: "reading-room",
            path: "/social-rooms/reading-room",
            state: {
              socialShareDropBoxNote: {
                id: "share-note-1",
                noteType: "reading",
                text: "A book that stayed with me",
                source: "share-dropbox",
              },
            },
          },
        });
      }
      return jsonResponse({ ok: true });
    });

    render(<ShareDropBoxSheet language="en" onClose={vi.fn()} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Type instead"));
    fireEvent.click(screen.getByRole("button", { name: "Reading A book or reflection" }));
    fireEvent.change(screen.getByTestId("share-dropbox-typed-input"), {
      target: { value: "A book that stayed with me" },
    });
    fireEvent.click(screen.getByTestId("button-share-dropbox-save-typed"));

    await waitFor(() => {
      expect(screen.getByTestId("share-dropbox-review-text")).toHaveValue("A book that stayed with me");
    });

    fireEvent.click(screen.getByTestId("button-share-dropbox-primary"));

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith(
        "/social-rooms/reading-room",
        expect.objectContaining({
          state: expect.objectContaining({
            socialShareDropBoxNote: expect.objectContaining({
              text: "A book that stayed with me",
            }),
          }),
        }),
      );
    });
  });
});
