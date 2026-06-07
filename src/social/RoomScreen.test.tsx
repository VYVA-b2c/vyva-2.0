import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RoomScreen from "./RoomScreen";
import type { SocialRoomResponse } from "./types";

const apiFetchMock = vi.fn();
const queryMock = vi.fn();
const voiceMocks = vi.hoisted(() => ({
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  sendText: vi.fn(),
  sendContextUpdate: vi.fn(),
  beginUserTurn: vi.fn(),
  endUserTurn: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => queryMock(),
  };
});

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: "Karim",
    profile: { firstName: "Karim" },
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    startVoice: voiceMocks.startVoice,
    stopVoice: voiceMocks.stopVoice,
    sendText: voiceMocks.sendText,
    sendContextUpdate: voiceMocks.sendContextUpdate,
    status: "idle",
    isSpeaking: false,
    isUserSpeaking: false,
    isConnecting: false,
    hasMicrophone: false,
    lastError: null,
    transcript: [],
    beginUserTurn: voiceMocks.beginUserTurn,
    endUserTurn: voiceMocks.endUserTurn,
  }),
}));

beforeEach(() => {
  Object.values(voiceMocks).forEach((mock) => mock.mockClear());
});

const movementRoomResponse: SocialRoomResponse = {
  room: {
    slug: "morning-movement",
    name: "Gentle Movement",
    category: "activity",
    agentSlug: "amara-osei",
    agentFullName: "Amara Osei",
    agentColour: "#0284C7",
    agentCredential: "Movement guide",
    ctaLabel: "Move",
    topicTags: ["movement", "stretching", "mobility", "safe"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    participantCount: 6,
    sessionDate: "2026-06-04",
    topic: "Safe movements to start the day.",
    opener: "Hello, I'm Amara. We can move gently and without hurry.",
    quote: "",
    activityType: "challenge",
    contentTag: "",
    contentTitle: "Gentle wake-up",
    contentBody: "We start with an easy seated movement.",
    options: ["I want seated movement", "Something for shoulders"],
    liveBadge: "6 in the room",
  },
  transcript: [],
  promptChips: ["I want seated movement", "Something for shoulders"],
  members: [
    { id: "member-carmen", name: "Carmen", sharedTopic: "Chair stretches" },
    { id: "member-luis", name: "Luis", sharedTopic: "Balance practice" },
  ],
  memberChat: [],
};

const readingRoomResponse: SocialRoomResponse = {
  room: {
    slug: "reading-room",
    name: "Reading Room",
    category: "social",
    agentSlug: "isabel-mora",
    agentFullName: "Isabel Mora",
    agentColour: "#7C2D12",
    agentCredential: "Literary host",
    ctaLabel: "Enter the literary club",
    topicTags: ["books", "stories", "companionship"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    participantCount: 6,
    sessionDate: "2026-06-04",
    topic: "Books, scenes and memories shared gently.",
    opener: "Welcome to the literary club.",
    quote: "",
    activityType: "discussion",
    contentTag: "",
    contentTitle: "A literary table",
    contentBody: "A warm place for book memories.",
    options: ["Share a memory", "Meet a reader"],
    liveBadge: "6 in the club",
  },
  transcript: [],
  promptChips: ["Share a scene", "Recommend gently"],
  members: [
    {
      id: "member-maria",
      name: "Maria",
      sharedTopic: "Shares family novels and short poems",
      statusLabel: "Ready for a note",
    },
    {
      id: "member-jose",
      name: "Jose",
      sharedTopic: "Enjoys history, newspapers and biographies",
      statusLabel: "Looking for calm conversation",
    },
  ],
  memberChat: [],
};

const togetherRoomResponse: SocialRoomResponse = {
  room: {
    slug: "together-room",
    name: "Together Room",
    category: "connection",
    agentSlug: "vyva-host",
    agentFullName: "VYVA Host",
    agentColour: "#6D28D9",
    agentCredential: "Shared plans host",
    ctaLabel: "Enter",
    topicTags: ["friendship", "connection"],
    timeSlots: ["afternoon"],
    featured: true,
    participantCount: 3,
    sessionDate: "2026-06-04",
    topic: "A small safe circle.",
    opener: "Welcome.",
    quote: "",
    activityType: "discussion",
    contentTag: "",
    contentTitle: "",
    contentBody: "",
    options: [],
    liveBadge: "3 present",
  },
  transcript: [],
  promptChips: [],
  members: [
    { id: "member-carmen", name: "Carmen", statusLabel: "Looking for a quiet plan" },
    { id: "member-luis", name: "Luis", statusLabel: "Comparing services" },
    { id: "member-ana", name: "Ana", statusLabel: "Reviewing an offer" },
  ],
  memberChat: [],
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <div data-testid="route-state">{JSON.stringify(location.state ?? null)}</div>
    </>
  );
}

function renderRoom(initialEntry = "/social-rooms/morning-movement") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/social-rooms/:slug" element={<RoomScreen />} />
        <Route path="/activity" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoomScreen Together Room", () => {
  beforeEach(() => {
    localStorage.clear();
    apiFetchMock.mockReset();
    queryMock.mockReset();
    queryMock.mockReturnValue({
      data: togetherRoomResponse,
      isLoading: false,
      isError: false,
    });
    apiFetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/enter")) {
        return Promise.resolve(jsonResponse({
          visitId: "visit-together-1",
          visitState: { isFirstVisit: false, visitCount: 2, previousVisitCount: 1 },
        }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
  });

  it("keeps the simple Together Room quiet instead of auto-starting voice", async () => {
    renderRoom("/social-rooms/together-room");

    expect(screen.getByRole("heading", { name: "Together Room" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/enter",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(voiceMocks.startVoice).not.toHaveBeenCalled();
  });
});

describe("RoomScreen movement room", () => {
  beforeEach(() => {
    localStorage.clear();
    apiFetchMock.mockReset();
    queryMock.mockReset();
    queryMock.mockReturnValue({
      data: movementRoomResponse,
      isLoading: false,
      isError: false,
    });
    apiFetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/enter")) {
        return Promise.resolve(jsonResponse({
          visitId: "visit-1",
          visitState: { isFirstVisit: true, visitCount: 1, previousVisitCount: 0 },
        }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
  });

  it("surfaces the gentle exercise library from the Movement room", async () => {
    renderRoom();

    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent("Gentle exercise cards");
    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent("Pick from 12 photo-led routines");
    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent("Each starts with plain steps");
    expect(screen.getByText("Chair yoga")).toBeInTheDocument();
    expect(screen.getByText("Tai chi")).toBeInTheDocument();
    expect(screen.getByText("Seated strength")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-movement-room-browse-exercises"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/activity"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"scrollToGentleExercises\":true");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"routineSource\":\"movement_room\"");
  });
});

describe("RoomScreen reading room member lounge", () => {
  beforeEach(() => {
    localStorage.clear();
    apiFetchMock.mockReset();
    queryMock.mockReset();
    queryMock.mockReturnValue({
      data: readingRoomResponse,
      isLoading: false,
      isError: false,
    });
    apiFetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/enter")) {
        return Promise.resolve(jsonResponse({
          visitId: "visit-reading-1",
          visitState: { isFirstVisit: false, visitCount: 2, previousVisitCount: 1 },
        }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
  });

  it("turns lounge members into protected notes and table invitations", async () => {
    renderRoom("/social-rooms/reading-room");

    expect(screen.getByTestId("reading-club-start-here")).toHaveTextContent("Start here");
    expect(screen.queryByTestId("reading-club-deep-tools")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-club-focused-path")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-club-desk")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-companion-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-reflection-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-member-lounge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-recommendation-shelf")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-reading-start-share"));
    await waitFor(() => expect(screen.getByTestId("reading-club-focused-path")).toBeInTheDocument());
    expect(screen.queryByTestId("reading-club-deep-tools")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-club-desk")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-companion-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-member-lounge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-recommendation-shelf")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Write a book, scene, character or memory...") as HTMLTextAreaElement).value.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("button-reading-start-recommend"));
    expect(screen.getByTestId("reading-recommendation-shelf")).toHaveTextContent("Share a recommendation");
    expect(screen.queryByTestId("reading-member-lounge")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("input-reading-recommendation-title"), {
      target: { value: "A gentle garden story for a calm afternoon read." },
    });
    fireEvent.click(screen.getByTestId("button-reading-save-recommendation"));

    expect(screen.getByTestId("reading-recommendation-cards")).toHaveTextContent("A gentle garden story for a calm afternoon read.");

    fireEvent.click(screen.getByTestId("button-reading-use-recommendation"));

    expect(screen.getByLabelText("Write a book, scene, character or memory...")).toHaveValue(
      "A gentle garden story for a calm afternoon read.",
    );

    fireEvent.click(screen.getByTestId("button-reading-start-meet"));
    expect(screen.getByTestId("reading-member-lounge")).toHaveTextContent("Readers in the lounge");
    expect(screen.getByTestId("reading-member-lounge")).toHaveTextContent("Ready for a note");
    expect(screen.getByTestId("reading-companion-card")).toBeInTheDocument();
    expect(screen.queryByTestId("reading-recommendation-shelf")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reading-reflection-card")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-reading-lounge-letter-member-maria"));

    expect(screen.getByTestId("input-reading-letter-recipient")).toHaveValue("Maria");
    expect(screen.getByTestId("input-reading-letter-subject")).toHaveValue("A gentle club hello");
    expect(screen.getByTestId("textarea-reading-letter-body")).toHaveValue(
      "Hello Maria, I noticed your reading thread and would enjoy exchanging one small book memory when it feels comfortable.",
    );
    expect(screen.getByTestId("reading-club-status")).toHaveTextContent("protected note is ready");

    fireEvent.click(screen.getByTestId("button-reading-lounge-table-member-jose"));

    expect(screen.getByTestId("input-reading-host-table-topic")).toHaveValue("A small table with Jose");
    expect(screen.getByTestId("textarea-reading-host-table-note")).toHaveValue(
      "Jose might enjoy this quiet table. Bring one memory or recommendation in your own words.",
    );
    expect(screen.getByTestId("reading-club-status")).toHaveTextContent("table invitation is ready");

    fireEvent.click(screen.getByTestId("button-reading-toggle-deep-tools"));
    expect(screen.queryByTestId("reading-club-focused-path")).not.toBeInTheDocument();
    expect(screen.getByTestId("reading-club-deep-tools")).toBeInTheDocument();
    expect(screen.getByTestId("reading-club-desk")).toBeInTheDocument();
  });
});
