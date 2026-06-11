import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      seedSong: {
        id: "us-stand-by-me",
        songText: "Stand By Me",
        causeId: "bridge",
        nudge: "Diego picked one. Add yours.",
        originCountryCode: "US",
        originLabel: "United States",
        matchTags: ["soul", "friend"],
      },
      starterSongs: [
        {
          id: "us-stand-by-me",
          songText: "Stand By Me",
          causeId: "bridge",
          nudge: "Diego picked one. Add yours.",
          originCountryCode: "US",
          originLabel: "United States",
          matchTags: ["soul", "friend"],
        },
        {
          id: "us-lean-on-me",
          songText: "Lean On Me",
          causeId: "bridge",
          nudge: "Diego picked one. Add yours.",
          originCountryCode: "US",
          originLabel: "United States",
          matchTags: ["support", "friend"],
        },
        {
          id: "global-besame-mucho",
          songText: "Besame Mucho",
          causeId: "bridge",
          nudge: "Diego picked one. Add yours.",
          originCountryCode: "MX",
          originLabel: "Global bridge",
          matchTags: ["bolero", "bridge"],
        },
      ],
      culture: {
        countryCode: "US",
        originLabel: "United States",
        language: "en",
        fallback: false,
      },
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

  it("keeps the extra music studio behind one compact control", () => {
    render(<MusicRoomScreen roomResponse={withMusicCircle()} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.queryByText("Ask")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Who remembers it?" })).toHaveClass("lg:col-start-2");
    expect(screen.getByRole("group", { name: "Songs" })).toHaveClass("lg:row-start-2");
    expect(screen.getByRole("img", { name: "Today's Song: Stand By Me" })).toHaveClass("lg:max-w-[460px]");
    expect(screen.getByRole("group", { name: "Memory doorways" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Memory doorway: Who for Stand By Me" })).toHaveClass("min-h-[64px]");
    expect(screen.getByRole("group", { name: "Chorus lane" })).toHaveClass("hidden");

    const studioButton = screen.getByRole("button", { name: "Open studio" });

    expect(studioButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(studioButton);

    expect(screen.getByRole("button", { name: "Hide studio" })).toHaveAttribute("aria-expanded", "true");
  });

  it("starts the top music match from the featured song", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      reply: "Arthur got your hello.",
      thread: musicThread(),
    }));

    render(<MusicRoomScreen roomResponse={withMusicCircle()} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Say hello to Arthur" }));

    await waitFor(() => {
      const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
      const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { memberId: string; circleItemId: string; songText: string };
      expect(connectBody.memberId).toBe("member-arthur");
      expect(connectBody.circleItemId).toBe("circle-item-1");
      expect(connectBody.songText).toBe("Stand By Me");
    });
  });

  it("uses a quick memory doorway to retune the top match", async () => {
    render(<MusicRoomScreen roomResponse={withMusicCircle()} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.queryByText("Ask")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Memory doorway: Dance for Stand By Me" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start Dance for Stand By Me with Rosa" })).toBeInTheDocument();
    });
    const inviteTicket = screen.getByRole("button", { name: "Start Dance for Stand By Me with Rosa" });
    expect(within(inviteTicket).getByText("Ask")).toBeInTheDocument();
    expect(within(inviteTicket).getAllByText("Rosa").length).toBeGreaterThan(0);
    expect(within(inviteTicket).getAllByText("Dance").length).toBeGreaterThan(0);
    expect(within(inviteTicket).getByText("Boleros")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Today's Song: Stand By Me, Dance" })).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Say hello to Rosa" })).getByText("Dance")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Duet prompt: Dance and Boleros with Rosa for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Duet prompt: Dance and Boleros with Rosa for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Needle cue: Dance for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Memory doorway: Dance for Stand By Me" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "Memory doorways" })).toHaveClass("hidden");
    expect(screen.getByRole("group", { name: "Chorus lane" })).toHaveClass("hidden");
    expect(screen.getByRole("group", { name: "Songs" })).toHaveClass("hidden");
    expect(screen.getByRole("status", { name: "Music bridge: Stand By Me, Dance, Rosa" })).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("spins the song card through memory matches without publishing", async () => {
    render(<MusicRoomScreen roomResponse={withMusicCircle()} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Spin memory: Who for Stand By Me" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Memory doorway: Who for Stand By Me" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start Who for Stand By Me with Arthur" })).toBeInTheDocument();
    });
    expect(screen.getByRole("img", { name: "Today's Song: Stand By Me, Who" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spin memory: Dance for Stand By Me" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Spin memory: Dance for Stand By Me" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start Dance for Stand By Me with Rosa" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Duet prompt: Dance and Boleros with Rosa for Stand By Me" })).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("plays the song pulse as a beat handoff without publishing", async () => {
    render(<MusicRoomScreen roomResponse={withMusicCircle()} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Play pulse for Stand By Me" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start Beat for Stand By Me with Malik" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Beat 1: Stand By Me to Malik" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Room pulse: 5" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Songs" })).toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Play pulse for Stand By Me" })).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("uses Diego's daily seed when the circle is empty", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      reply: "Arthur got your hello.",
      thread: musicThread(),
    }));

    render(
      <MusicRoomScreen
        roomResponse={{
          ...withMusicCircle([]),
          musicCircle: {
            dayKey: "2026-06-04",
            prompt: "Old Radio",
            featuredItemId: null,
            seedSong: {
              id: "us-stand-by-me",
              songText: "Stand By Me",
              causeId: "bridge",
              nudge: "Diego picked one. Add yours.",
              originCountryCode: "US",
              originLabel: "United States",
              matchTags: ["soul", "friend"],
            },
            starterSongs: [
              {
                id: "us-stand-by-me",
                songText: "Stand By Me",
                causeId: "bridge",
                nudge: "Diego picked one. Add yours.",
                originCountryCode: "US",
                originLabel: "United States",
                matchTags: ["soul", "friend"],
              },
              {
                id: "us-lean-on-me",
                songText: "Lean On Me",
                causeId: "bridge",
                nudge: "Diego picked one. Add yours.",
                originCountryCode: "US",
                originLabel: "United States",
                matchTags: ["support", "friend"],
              },
              {
                id: "global-besame-mucho",
                songText: "Besame Mucho",
                causeId: "bridge",
                nudge: "Diego picked one. Add yours.",
                originCountryCode: "MX",
                originLabel: "Global bridge",
                matchTags: ["bolero", "bridge"],
              },
            ],
            culture: {
              countryCode: "US",
              originLabel: "United States",
              language: "en",
              fallback: false,
            },
            items: [],
          },
        }}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Old Radio")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who remembers it?" })).toBeInTheDocument();
    expect(screen.getAllByText("Stand By Me").length).toBeGreaterThan(0);
    expect(screen.getByRole("status", { name: "Song home: Stand By Me from United States" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Room pulse: 1" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Diego picked one. Add yours." })).toBeInTheDocument();
    expect(screen.getByText("Add yours")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Arthur");

    fireEvent.click(screen.getByRole("button", { name: "Stand By Me" }));
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Stand By Me");

    fireEvent.click(screen.getByRole("button", { name: "Say hello to Arthur" }));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/music-room/connect",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"songText":"Stand By Me"'),
        }),
      );
    });
    const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
    const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { circleItemId?: string; songText: string };
    expect(connectBody.circleItemId).toBeUndefined();
    expect(connectBody.songText).toBe("Stand By Me");
  });

  it("uses country-aware starter metadata when adding an empty-room song", async () => {
    const item = circleItem({ songText: "Cielito Lindo", causeId: "anthem" });
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      item,
      musicCircle: {
        dayKey: "2026-06-04",
        prompt: "Today's Song",
        featuredItemId: item.id,
        items: [item],
      },
    }));

    render(
      <MusicRoomScreen
        roomResponse={{
          ...withMusicCircle([]),
          musicCircle: {
            dayKey: "2026-06-04",
            prompt: "Today's Song",
            featuredItemId: null,
            culture: {
              countryCode: "MX",
              originLabel: "Mexico",
              language: "es",
              fallback: false,
            },
            seedSong: {
              id: "mx-cielito-lindo",
              songText: "Cielito Lindo",
              causeId: "anthem",
              nudge: "Diego picked one. Add yours.",
              originCountryCode: "MX",
              originLabel: "Mexico",
              matchTags: ["chorus", "family", "mexican"],
            },
            starterSongs: [
              {
                id: "mx-cielito-lindo",
                songText: "Cielito Lindo",
                causeId: "anthem",
                nudge: "Diego picked one. Add yours.",
                originCountryCode: "MX",
                originLabel: "Mexico",
                matchTags: ["chorus", "family", "mexican"],
              },
              {
                id: "mx-besame-mucho",
                songText: "Besame Mucho",
                causeId: "bridge",
                nudge: "Diego picked one. Add yours.",
                originCountryCode: "MX",
                originLabel: "Mexico",
                matchTags: ["bolero", "romance"],
              },
              {
                id: "global-stand-by-me",
                songText: "Stand By Me",
                causeId: "bridge",
                nudge: "Diego picked one. Add yours.",
                originCountryCode: "US",
                originLabel: "Global bridge",
                matchTags: ["soul", "friend"],
              },
            ],
            items: [],
          },
        }}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cielito Lindo" }));
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Cielito Lindo");

    fireEvent.click(screen.getByRole("button", { name: /Add/i }));

    await waitFor(() => {
      const addCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/music-circle/items");
      const addBody = JSON.parse(String(addCall?.[1]?.body)) as { songText: string; causeId: string; countryCode?: string };
      expect(addBody.songText).toBe("Cielito Lindo");
      expect(addBody.causeId).toBe("anthem");
      expect(addBody.countryCode).toBe("MX");
    });
  });

  it("turns starter songs into tappable queue records", () => {
    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Lean On Me" }));

    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Lean On Me");
  });

  it("spins through starter records and retunes the people match", async () => {
    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Arthur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stand By Me" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Lean On Me" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status", { name: "Listening match: Stand By Me with Arthur" })).toBeInTheDocument();
    expect(screen.getAllByTitle("United States").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Spin record from Stand By Me" }));
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Lean On Me");
    expect(screen.getByRole("status", { name: "Record response: Spin for Lean On Me" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stand By Me" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Lean On Me" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Spin record from Lean On Me" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Rosa");
    });
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Besame Mucho");
    expect(screen.getByRole("status", { name: "Listening match: Besame Mucho with Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Song bridge: Besame Mucho with Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spin record from Besame Mucho" })).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("shows tappable next-duet matches for people", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({}));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("group", { name: "Chorus lane" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Room chorus: Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Next duet: Stand By Me with Arthur" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Music bridge: Stand By Me, Who, Arthur" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Active groove: Who for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Duet pickup: Duet with Arthur" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Duet card: Duet with Arthur" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next duet: Stand By Me with Arthur" }));

    await waitFor(() => {
      const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
      const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { memberId: string; songText: string };
      expect(connectBody.memberId).toBe("member-arthur");
      expect(connectBody.songText).toBe("Stand By Me");
    });
  });

  it("moves a tapped chorus member to the front of the people rail", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({}));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: /^(Say hello to .+|.+ Sent)$/ })[0]).toHaveAccessibleName("Say hello to Arthur");

    fireEvent.click(screen.getByRole("button", { name: "Next duet: Stand By Me with Malik" }));

    await waitFor(() => {
      const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
      const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { memberId: string; songText: string };
      expect(connectBody.memberId).toBe("member-malik");
      expect(connectBody.songText).toBe("Stand By Me");
    });

    expect(screen.getByRole("button", { name: "Next duet: Stand By Me with Malik" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /^(Say hello to .+|.+ Sent)$/ })[0]).toHaveAccessibleName("Malik Sent");
  });

  it("passes the room beat to the next chorus member without publishing", () => {
    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Arthur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next duet: Stand By Me with Arthur" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status", { name: "Beat trail: 0 of 4" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tap beat for Stand By Me" }));

    expect(screen.getByRole("status", { name: "Beat 1: Stand By Me to Malik" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Next duet: Stand By Me with Malik" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Music bridge: Stand By Me, Beat, Malik" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Active groove: Beat for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Live handoff: Beat for Stand By Me with Malik" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Song path: Stand By Me to Malik" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Duet card: Beat with Malik" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Beat trail: 1 of 4" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Room pulse: 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Malik" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next duet: Stand By Me with Arthur" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Next duet: Stand By Me with Malik" })).toHaveAttribute("aria-pressed", "true");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("uses a memory key to focus the listener match without publishing", async () => {
    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("group", { name: "Memory keys" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Diego cue: Who for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Arthur" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Memory key: Dance for Stand By Me" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Rosa");
    });
    expect(screen.queryByRole("status", { name: "Diego cue: Who for Stand By Me" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Memory key: Dance for Stand By Me" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Duet card: Dance with Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Music bridge: Stand By Me, Dance, Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Active groove: Dance for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Live handoff: Dance for Stand By Me with Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Song path: Stand By Me to Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Song passport: Stand By Me from United States to Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Memory cue: Dance with Rosa" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Dance").length).toBeGreaterThan(1);
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Stand By Me");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("uses a groove cue to make the record feel playable", async () => {
    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("group", { name: "Feel the song" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Groove cue: Sway for Stand By Me" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Groove cue: Sway for Stand By Me" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Rosa");
    });
    expect(screen.getByRole("button", { name: "Groove cue: Sway for Stand By Me" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Duet card: Sway with Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Music bridge: Stand By Me, Sway, Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Active groove: Sway for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Record response: Sway for Stand By Me" })).toBeInTheDocument();
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Stand By Me");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("carries the selected music cue into the duet invite", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({}));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Memory key: Dance for Stand By Me" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Rosa" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Start Dance for Stand By Me with Rosa" }));

    await waitFor(() => {
      const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
      const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { memberId: string; songText: string; bridgePrompt: string };
      expect(connectBody.memberId).toBe("member-rosa");
      expect(connectBody.songText).toBe("Stand By Me");
      expect(connectBody.bridgePrompt).toContain("Dance");
      expect(connectBody.bridgePrompt).toContain("Rosa");
    });
  });

  it("carries a tapped beat into the duet invite", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({}));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tap beat for Stand By Me" }));
    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Malik" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Song bridge: Stand By Me with Malik" }));

    await waitFor(() => {
      const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
      const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { memberId: string; songText: string; bridgePrompt: string };
      expect(connectBody.memberId).toBe("member-malik");
      expect(connectBody.songText).toBe("Stand By Me");
      expect(connectBody.bridgePrompt).toContain("beat 1");
      expect(connectBody.bridgePrompt).toContain("Malik");
    });
  });

  it("opens a one-tap song bridge to the best match", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({}));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Song bridge: Stand By Me with Arthur" }));

    await waitFor(() => {
      const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
      const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { memberId: string; songText: string };
      expect(connectBody.memberId).toBe("member-arthur");
      expect(connectBody.songText).toBe("Stand By Me");
    });
  });

  it("shows the duet strip immediately after a music thread starts", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      thread: musicThread({ entries: [] }),
    }));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Add memory...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Song bridge: Stand By Me with Arthur" }));

    expect(await screen.findByLabelText("Add memory...")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Duet turn: Stand By Me with Arthur" })).toBeInTheDocument();
    expect(screen.getAllByText("Stand By Me").length).toBeGreaterThan(1);
  });

  it("fills the duet memory field from a one-tap thread prompt", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      thread: musicThread({ entries: [] }),
    }));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Song bridge: Stand By Me with Arthur" }));
    const memoryInput = await screen.findByLabelText("Add memory...");

    fireEvent.click(screen.getByRole("button", { name: "Duet prompt: Who for Stand By Me" }));

    expect(memoryInput).toHaveValue("Reminds me of someone.");
    expect(screen.getByRole("button", { name: "Duet prompt: Who for Stand By Me" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status", { name: "Duet cue ready: Who for Stand By Me with Arthur" })).toBeInTheDocument();

    fireEvent.change(memoryInput, { target: { value: "My own memory." } });

    expect(screen.queryByRole("status", { name: "Duet cue ready: Who for Stand By Me with Arthur" })).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("turns a memory spark into a room-visible song memory", async () => {
    const item = circleItem({ memoryText: "Old block" });
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      item,
      musicCircle: {
        dayKey: "2026-06-04",
        prompt: "Today's Song",
        featuredItemId: item.id,
        items: [item],
      },
    }));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Memory spark: Old block" }));
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Stand By Me");

    fireEvent.click(screen.getByRole("button", { name: /Add/i }));

    await waitFor(() => {
      const addCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/music-circle/items");
      const addBody = JSON.parse(String(addCall?.[1]?.body)) as { songText: string; memoryText: string; causeId: string };
      expect(addBody.songText).toBe("Stand By Me");
      expect(addBody.memoryText).toBe("Old block");
      expect(addBody.causeId).toBe("bridge");
    });
    expect((await screen.findAllByText("Old block")).length).toBeGreaterThan(1);
  });

  it("uses a memory spark to focus the people rail", async () => {
    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Arthur");
    expect(screen.getByRole("status", { name: "Listening match: Stand By Me with Arthur" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Memory spark: Work radio" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Malik");
    });
    expect(screen.getByRole("status", { name: "Listening match: Stand By Me with Malik" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Music trail: Work radio to Malik" })).toBeInTheDocument();
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Stand By Me");
  });

  it("turns a listener cue into a focused duet bridge", async () => {
    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Memory cue: Work radio with Malik" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Malik");
    });
    expect(screen.getByRole("status", { name: "Music trail: Work radio to Malik" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Malik" })).toBeInTheDocument();
    expect(screen.getByLabelText("Song or memory...")).toHaveValue("Stand By Me");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("publishes the seeded song when the senior joins the chorus", async () => {
    const item = circleItem({ reactionCount: 0 });
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      item,
      musicCircle: {
        dayKey: "2026-06-04",
        prompt: "Today's Song",
        featuredItemId: item.id,
        items: [item],
      },
    }));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Join chorus" }));

    await waitFor(() => {
      const addCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/music-circle/items");
      const addBody = JSON.parse(String(addCall?.[1]?.body)) as { songText: string; memoryText: string; causeId: string };
      expect(addBody.songText).toBe("Stand By Me");
      expect(addBody.memoryText).toBe("");
      expect(addBody.causeId).toBe("bridge");
    });
    expect(screen.getByRole("status", { name: "Your voice joined Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Your voice in the room chorus: Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "You joined the chorus" })).toHaveAttribute("aria-pressed", "true");
    expect((await screen.findAllByText("Stand By Me")).length).toBeGreaterThan(1);
  });

  it("turns a joined chorus into a focused duet invite", async () => {
    const item = circleItem({ reactionCount: 0 });
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({
        item,
        musicCircle: {
          dayKey: "2026-06-04",
          prompt: "Today's Song",
          featuredItemId: item.id,
          items: [item],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({}));

    render(
      <MusicRoomScreen
        roomResponse={withMusicCircle([])}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Join chorus" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Say hello to/ })[0]).toHaveAccessibleName("Say hello to Ingrid");
    });
    expect(screen.getByRole("button", { name: "Song bridge: Stand By Me with Ingrid" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Live handoff: Chorus for Stand By Me with Ingrid" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Song path: Stand By Me to Ingrid" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Song passport: Stand By Me from United States to Ingrid" })).toBeInTheDocument();
    expect(screen.getAllByText("Chorus").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Song bridge: Stand By Me with Ingrid" }));

    await waitFor(() => {
      const connectCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/social/rooms/music-room/connect");
      const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { memberId: string; songText: string; bridgePrompt: string };
      expect(connectBody.memberId).toBe("member-ingrid");
      expect(connectBody.songText).toBe("Stand By Me");
      expect(connectBody.bridgePrompt).toContain("chorus");
      expect(connectBody.bridgePrompt).toContain("Ingrid");
    });
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
    expect(screen.getByRole("button", { name: /Stand By Me.*You/ })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "You joined the chorus" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status", { name: "Your voice joined Stand By Me" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Duet turn: Stand By Me with Arthur" })).toBeInTheDocument();
    expect(screen.getByText("Soul: old friends.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Send heart" }).length).toBeGreaterThan(0);
    const threadPanel = document.getElementById("music-thread-panel");
    const threadToggle = document.querySelector<HTMLButtonElement>('[aria-controls="music-thread-panel"]');
    expect(threadPanel).toHaveClass("hidden");
    expect(threadToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(threadToggle!);

    expect(threadPanel).toHaveClass("block");
    expect(threadToggle).toHaveAttribute("aria-expanded", "true");
  });
});
