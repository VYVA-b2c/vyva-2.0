import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MusicRoomScreen from "./MusicRoomScreen";
import type { SocialMusicCircleItem, SocialMusicThread, SocialRoomResponse } from "./types";

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

function circleItem(overrides: Partial<SocialMusicCircleItem> = {}): SocialMusicCircleItem {
  return {
    id: "circle-item-1",
    roomId: "room-1",
    dayKey: "2026-06-04",
    authorId: "music-user",
    authorName: "You",
    songText: "Stand By Me",
    causeId: "bridge",
    memoryText: "",
    status: "active",
    reactionCount: 6,
    myReaction: false,
    createdAt: "2026-06-04T10:00:00.000Z",
    updatedAt: "2026-06-04T10:00:00.000Z",
    ...overrides,
  };
}

function withMusicCircle(items: SocialMusicCircleItem[] = [circleItem()]): SocialRoomResponse {
  return {
    ...roomResponse,
    musicCircle: {
      dayKey: "2026-06-04",
      prompt: "Today's Song",
      featuredItemId: items[0]?.id ?? null,
      items,
    },
  };
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
        threadId: "thread-1",
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
        threadId: "thread-1",
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
  });

  it("adds a daily circle song and ranks Arthur first for Stand By Me", async () => {
    const item = circleItem();
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      item,
      musicCircle: {
        dayKey: "2026-06-04",
        prompt: "Today's Song",
        featuredItemId: item.id,
        items: [item],
      },
    }));

    render(<MusicRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Song Circle" })).toBeInTheDocument();
    expect(screen.getAllByText("Today's Song").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Song or memory..."), {
      target: { value: "Stand By Me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/music-room/music-circle/items",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"songText":"Stand By Me"'),
        }),
      );
    });

    expect(screen.getAllByText("Stand By Me").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Arthur");
  });

  it("toggles a heart reaction on a circle item", async () => {
    const updatedItem = circleItem({ reactionCount: 7, myReaction: true });
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      item: updatedItem,
      musicCircle: {
        dayKey: "2026-06-04",
        prompt: "Today's Song",
        featuredItemId: updatedItem.id,
        items: [updatedItem],
      },
    }));

    render(<MusicRoomScreen roomResponse={withMusicCircle()} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Send heart" })[0]);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/music-room/music-circle/items/circle-item-1/reactions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"kind":"heart"'),
        }),
      );
    });
    expect(await screen.findAllByRole("button", { name: "Remove heart" })).toHaveLength(2);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
  });

  it("sends a music greeting from the featured circle item", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      reply: "Arthur got your hello.",
      thread: musicThread(),
    }));

    render(<MusicRoomScreen roomResponse={withMusicCircle()} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Say hello to Arthur" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/music-room/connect",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"circleItemId":"circle-item-1"'),
        }),
      );
    });
    const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
    const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { circleItemId: string; songText: string; matchedTopic: string };
    expect(connectBody.circleItemId).toBe("circle-item-1");
    expect(connectBody.songText).toBe("Stand By Me");
    expect(connectBody.matchedTopic).toBe("Soul");
    expect(await screen.findByText("Soul: old friends.")).toBeInTheDocument();
  });

  it("adds memory and voice markers to the active persisted thread", async () => {
    const memoryEntry = {
      id: "entry-memory",
      threadId: "thread-1",
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
      threadId: "thread-1",
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

    render(
      <MusicRoomScreen
        roomResponse={{ ...withMusicCircle(), musicThreads: [baseThread] }}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

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

  it("renders saved circle items and saved music threads on room reload", () => {
    render(
      <MusicRoomScreen
        roomResponse={{ ...withMusicCircle(), musicThreads: [musicThread()] }}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Stand By Me").length).toBeGreaterThan(0);
    expect(screen.getByText("Soul: old friends.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Send heart" }).length).toBeGreaterThan(0);
  });
});
