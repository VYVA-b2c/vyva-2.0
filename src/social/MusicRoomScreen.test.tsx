import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MusicRoomScreen from "./MusicRoomScreen";
import type { SocialMusicThread, SocialRoomResponse } from "./types";

const apiFetchMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const roomResponse: SocialRoomResponse = {
  room: {
    slug: "music-room",
    name: "Music Room",
    category: "activity",
    agentSlug: "diego-salinas",
    agentFullName: "Diego Salinas",
    agentColour: "#7E22CE",
    agentCredential: "Musicologist",
    ctaLabel: "Join the circle",
    topicTags: ["music"],
    timeSlots: ["afternoon"],
    featured: true,
    participantCount: 5,
    sessionDate: "2026-06-04",
    topic: "Songs from every life.",
    opener: "Hello, I'm Diego. Bring a song.",
    quote: "",
    activityType: "discussion",
    contentTag: "",
    contentTitle: "Music connects us",
    contentBody: "Songs connect us.",
    options: ["Share a song from my life", "Meet someone through music"],
    liveBadge: "5 in the room",
  },
  transcript: [],
  promptChips: ["Share a song from my life"],
  members: [
    {
      id: "member-rosa",
      name: "Rosa",
      sharedTopic: "Boleros",
      statusLabel: "Shared a song",
    },
    {
      id: "member-malik",
      name: "Malik",
      sharedTopic: "Market rhythms",
      statusLabel: "Brought a rhythm",
    },
    {
      id: "member-ingrid",
      name: "Ingrid",
      sharedTopic: "Choir",
      statusLabel: "Open to hello",
    },
    {
      id: "member-arthur",
      name: "Arthur",
      sharedTopic: "Soul",
      statusLabel: "Swapping songs",
    },
  ],
  memberChat: [
    {
      id: "chat-1",
      authorId: "member-rosa",
      authorName: "Rosa",
      text: "A rhythm opened hello.",
      createdAt: "2026-06-04T10:00:00.000Z",
      connectable: true,
    },
  ],
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function musicThread(overrides: Partial<SocialMusicThread> = {}): SocialMusicThread {
  return {
    id: "thread-1",
    creatorId: "music-user",
    matchedMemberId: "member-arthur",
    matchedMemberName: "Arthur",
    songText: "Stand By Me",
    matchedTopic: "Soul",
    status: "active",
    createdAt: "2026-06-04T10:00:00.000Z",
    updatedAt: "2026-06-04T10:00:00.000Z",
    entries: [
      {
        id: "entry-song",
        authorId: "music-user",
        authorName: "You",
        kind: "memory",
        body: "Stand By Me",
        status: "active",
        createdAt: "2026-06-04T10:00:00.000Z",
        updatedAt: "2026-06-04T10:00:00.000Z",
      },
      {
        id: "entry-reply",
        authorId: "member-arthur",
        authorName: "Arthur",
        kind: "memory",
        body: "Soul: old friends.",
        status: "active",
        createdAt: "2026-06-04T10:00:01.000Z",
        updatedAt: "2026-06-04T10:00:01.000Z",
      },
    ],
    ...overrides,
  };
}

describe("MusicRoomScreen", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(jsonResponse({
      reply: "In the circle. Who should hear it?",
    }));
  });

  it("adds a song memory to the circle and shows Diego's response", async () => {
    render(<MusicRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Song Circle" })).toBeInTheDocument();
    expect(screen.getAllByText("Bridge").length).toBeGreaterThan(0);
    expect(screen.getByText("Round")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Song or memory..."), {
      target: { value: "Stand By Me, because it played at every family party" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add/i }));

    expect(screen.getByText("Stand By Me, because it played at every family party")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/music-room/message",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("What song shows your path?"),
        }),
      );
    });

    expect(await screen.findByText(/In the circle/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Arthur");
  });

  it("fills the song field from a song spark", () => {
    render(<MusicRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "My place" }));

    expect(screen.getByLabelText("Song or memory...")).toHaveValue("My place");
  });

  it("sends a music-based greeting with one tap", async () => {
    const memoryEntry = {
      id: "entry-memory",
      authorId: "music-user",
      authorName: "You",
      kind: "memory" as const,
      body: "It played on my old radio.",
      status: "active",
      createdAt: "2026-06-04T10:00:02.000Z",
      updatedAt: "2026-06-04T10:00:02.000Z",
    };
    const voiceEntry = {
      id: "entry-voice",
      authorId: "music-user",
      authorName: "You",
      kind: "voice" as const,
      body: "Voice note",
      status: "active",
      createdAt: "2026-06-04T10:00:03.000Z",
      updatedAt: "2026-06-04T10:00:03.000Z",
    };
    const baseThread = musicThread();
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({
        reply: "In the circle. Who should hear it?",
      }))
      .mockResolvedValueOnce(jsonResponse({
        reply: "Arthur got your hello.",
        thread: baseThread,
      }))
      .mockResolvedValueOnce(jsonResponse({
        entry: memoryEntry,
        thread: musicThread({
          updatedAt: memoryEntry.createdAt,
          entries: [...baseThread.entries, memoryEntry],
        }),
      }))
      .mockResolvedValueOnce(jsonResponse({
        entry: voiceEntry,
        thread: musicThread({
          updatedAt: voiceEntry.createdAt,
          entries: [...baseThread.entries, memoryEntry, voiceEntry],
        }),
      }));

    render(<MusicRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Song or memory..."), {
      target: { value: "Stand By Me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Say hello to Arthur" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/music-room/connect",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"memberId":"member-arthur"'),
        }),
      );
    });
    const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
    const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { bridgePrompt: string; songText: string; matchedTopic: string };
    expect(connectBody.bridgePrompt).toContain('I added "Stand By Me"');
    expect(connectBody.bridgePrompt).toContain('"Soul" caught my ear');
    expect(connectBody.songText).toBe("Stand By Me");
    expect(connectBody.matchedTopic).toBe("Soul");
    expect(await screen.findByRole("button", { name: "Arthur Replied" })).toBeInTheDocument();
    expect(screen.getByText("Arthur replied")).toBeInTheDocument();
    expect(screen.getByText("Soul: old friends.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Add memory..."), {
      target: { value: "It played on my old radio." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add memory" }));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/music-room/music-threads/thread-1/entries",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"kind":"memory"'),
        }),
      );
    });
    expect(await screen.findByText("It played on my old radio.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voice note" }));
    await waitFor(() => {
      const voiceCall = apiFetchMock.mock.calls.find(([, init]) => String(init?.body).includes('"kind":"voice"'));
      expect(voiceCall?.[0]).toBe("/api/social/rooms/music-room/music-threads/thread-1/entries");
    });
    expect(await screen.findByText("Voice note")).toBeInTheDocument();
  });

  it("renders a saved music thread on room reload", () => {
    render(
      <MusicRoomScreen
        roomResponse={{ ...roomResponse, musicThreads: [musicThread()] }}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Stand By Me").length).toBeGreaterThan(0);
    expect(screen.getByText("Arthur replied")).toBeInTheDocument();
    expect(screen.getByText("Soul: old friends.")).toBeInTheDocument();
  });
});
