import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MusicRoomScreen from "./MusicRoomScreen";
import type { SocialRoomResponse } from "./types";

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
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({
        reply: "In the circle. Who should hear it?",
      }))
      .mockResolvedValueOnce(jsonResponse({
        reply: "Arthur got your hello.",
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
    const connectBody = JSON.parse(String(connectCall?.[1]?.body)) as { bridgePrompt: string };
    expect(connectBody.bridgePrompt).toContain('I added "Stand By Me"');
    expect(connectBody.bridgePrompt).toContain('"Soul" caught my ear');
    expect(await screen.findByRole("button", { name: "Arthur Replied" })).toBeInTheDocument();
    expect(screen.getByText("Arthur replied")).toBeInTheDocument();
    expect(screen.getByText("Soul: old friends.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Add memory..."), {
      target: { value: "It played on my old radio." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add memory" }));
    expect(screen.getByText("It played on my old radio.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voice note" }));
    expect(screen.getByText("Voice note")).toBeInTheDocument();
  });
});
