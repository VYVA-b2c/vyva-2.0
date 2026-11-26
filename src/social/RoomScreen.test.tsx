import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MovementExerciseGuideScreen from "./MovementExerciseGuideScreen";
import { MOVEMENT_EXERCISE_SESSIONS, getMovementStepImage, getMovementStepVideo, getNarratedMovementStepVideo, getNarratedMovementGuide } from "./movementExercises";
import RoomScreen from "./RoomScreen";
import type { SocialRoomResponse } from "./types";

const languageMock = vi.hoisted(() => ({ language: "en" }));
const voiceMock = vi.hoisted(() => ({
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  sendText: vi.fn(),
  sendContextUpdate: vi.fn(),
  beginUserTurn: vi.fn(),
  endUserTurn: vi.fn(),
  setMicrophoneMuted: vi.fn(),
  status: "idle" as "idle" | "connecting" | "connected",
}));
const apiFetchMock = vi.fn();
const queryMock = vi.fn();

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
  useLanguage: () => ({ language: languageMock.language }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    startVoice: voiceMock.startVoice,
    stopVoice: voiceMock.stopVoice,
    sendText: voiceMock.sendText,
    sendContextUpdate: voiceMock.sendContextUpdate,
    status: voiceMock.status,
    isSpeaking: false,
    isUserSpeaking: false,
    isConnecting: false,
    hasMicrophone: false,
    lastError: null,
    transcript: [],
    beginUserTurn: voiceMock.beginUserTurn,
    endUserTurn: voiceMock.endUserTurn,
    setMicrophoneMuted: voiceMock.setMicrophoneMuted,
  }),
}));

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  Object.values(voiceMock).forEach((value) => {
    if (typeof value === "function" && "mockClear" in value) {
      value.mockClear();
    }
  });
  voiceMock.status = "idle";
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

async function advanceMovementGuideStep() {
  await act(async () => {
    vi.advanceTimersByTime(MOVEMENT_GUIDE_STEP_MS);
    await Promise.resolve();
  });
}

async function advanceMovementGuideIntro() {
  await act(async () => {
    vi.advanceTimersByTime(MOVEMENT_STEP_INSTRUCTION_INTRO_MS);
    await Promise.resolve();
  });
}

async function advanceMovementGuideVisualStep() {
  await act(async () => {
    vi.advanceTimersByTime(MOVEMENT_GUIDE_STEP_MS - MOVEMENT_STEP_INSTRUCTION_INTRO_MS);
    await Promise.resolve();
  });
}

async function flushAsyncEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function completeMovementGuide() {
  for (let index = 0; index < 4; index += 1) {
    await advanceMovementGuideStep();
  }
}

const movementRoomResponse: SocialRoomResponse = {
  room: {
    slug: "morning-movement",
    name: "Gentle Movement",
    category: "activity",
    agentSlug: "amara-osei",
    agentFullName: "Wellness Coach",
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
const movementExerciseIds = Object.keys(MOVEMENT_EXERCISE_SESSIONS) as Array<keyof typeof MOVEMENT_EXERCISE_SESSIONS>;
const MOVEMENT_GUIDE_STEP_MS = 150_000;
const MOVEMENT_STEP_INSTRUCTION_INTRO_MS = 5_000;

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

const kitchenRoomResponse: SocialRoomResponse = {
  room: {
    slug: "kitchen-table",
    name: "Kitchen Table",
    category: "social",
    agentSlug: "marco-rossi",
    agentFullName: "Marco Rossi",
    agentColour: "#C45A00",
    agentCredential: "Kitchen host",
    ctaLabel: "Enter",
    topicTags: ["recipe", "food", "memory"],
    timeSlots: ["afternoon"],
    featured: true,
    participantCount: 4,
    sessionDate: "2026-06-04",
    topic: "Simple recipes and kitchen memories.",
    opener: "Welcome to the kitchen table.",
    quote: "",
    activityType: "discussion",
    contentTag: "",
    contentTitle: "",
    contentBody: "",
    options: [],
    liveBadge: "4 around the table",
  },
  transcript: [],
  promptChips: [],
  members: [
    { id: "member-martha", name: "Martha", sharedTopic: "Soup memories" },
    { id: "member-ali", name: "Ali", sharedTopic: "Easy dinners" },
  ],
  memberChat: [],
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function localDateKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

type RoomInitialEntry = string | { pathname: string; state?: unknown };

function renderRoom(initialEntry: RoomInitialEntry = "/social-rooms/morning-movement") {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/social-rooms/morning-movement/exercises/:exerciseId" element={<><MovementExerciseGuideScreen /><LocationProbe /></>} />
        <Route path="/dev/social-rooms/morning-movement/exercises/:exerciseId" element={<><MovementExerciseGuideScreen /><LocationProbe /></>} />
        <Route path="/social-rooms/experts/amara" element={<LocationProbe />} />
        <Route path="/dev/home-master/community" element={<LocationProbe />} />
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
    expect(voiceMock.startVoice).not.toHaveBeenCalled();
  });
});

describe("RoomScreen Share Stories room handoff", () => {
  beforeEach(() => {
    languageMock.language = "en";
    localStorage.clear();
    apiFetchMock.mockReset();
    queryMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/enter")) {
        return Promise.resolve(jsonResponse({
          visitId: "visit-story-handoff",
          visitState: { isFirstVisit: false, visitCount: 2, previousVisitCount: 1 },
        }));
      }
      return Promise.resolve(jsonResponse({ ok: true, reply: "That is ready for the room." }));
    });
  });

  it("prefills a placed recipe story into the destination room composer", async () => {
    queryMock.mockReturnValue({
      data: kitchenRoomResponse,
      isLoading: false,
      isError: false,
    });

    renderRoom({
      pathname: "/social-rooms/kitchen-table",
      state: {
        socialShareDropBoxNote: {
          id: "note-recipe-1",
          noteType: "recipe",
          text: "My soup tastes best with parsley at the end.",
          source: "share-dropbox",
        },
      },
    });

    expect(await screen.findByTestId("story-room-handoff")).toHaveTextContent("Recipe ready for the table");
    expect(screen.getByTestId("story-handoff-primary")).toHaveTextContent("Share at Kitchen Table");
    expect(screen.getByTestId("story-handoff-outcome")).toHaveTextContent("cooking tip, memory, or question");
    expect(screen.getByTestId("story-room-handoff-text")).toHaveTextContent("My soup tastes best");
    expect(screen.getByDisplayValue("My soup tastes best with parsley at the end.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("story-handoff-primary"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/kitchen-table/message",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            message: "My soup tastes best with parsley at the end.",
            lang: "en",
            visitId: "visit-story-handoff",
          }),
        }),
      );
    });
    await waitFor(() => expect(screen.queryByTestId("story-room-handoff")).not.toBeInTheDocument());
    expect(await screen.findByTestId("story-reply-loop")).toHaveTextContent("Story placed");
    expect(screen.getByTestId("story-reply-loop-body")).toHaveTextContent(
      "That parsley tip sounds lovely. I might try it in my soup.",
    );
    expect(screen.getByTestId("story-room-replies")).toHaveTextContent("From Martha");
    expect(screen.getByTestId("story-reply-action-0")).toHaveTextContent("Draft reply");
    expect(screen.getByTestId("story-reply-context-frame")).toHaveTextContent("Martha wants to try your recipe.");
    expect(screen.getByTestId("story-reply-suggestion-1")).toHaveTextContent(
      "Ali also joined the conversation.",
    );

    fireEvent.click(screen.getByTestId("story-reply-action-0"));

    expect(screen.getByDisplayValue("Thanks, Martha. It is a small detail, but it helps.")).toBeInTheDocument();
  });

  it("puts a reading story into the club reflection composer", async () => {
    queryMock.mockReturnValue({
      data: readingRoomResponse,
      isLoading: false,
      isError: false,
    });

    renderRoom({
      pathname: "/social-rooms/reading-room",
      state: {
        socialShareDropBoxNote: {
          id: "note-reading-1",
          noteType: "reading",
          text: "The poem reminded me of my old garden.",
          source: "share-dropbox",
        },
      },
    });

    expect(await screen.findByTestId("story-room-handoff")).toHaveTextContent("Add your reflection");
    expect(screen.getByTestId("story-handoff-primary")).toHaveTextContent("Add reflection");
    expect(screen.getByTestId("story-handoff-outcome")).toHaveTextContent("reading memories and recommendations");
    expect(await screen.findByTestId("reading-reflection-card")).toBeInTheDocument();
    expect(screen.getByLabelText("Write a book, scene, character or memory...")).toHaveValue(
      "The poem reminded me of my old garden.",
    );

    fireEvent.click(screen.getByTestId("story-handoff-primary"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/reading-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("The poem reminded me of my old garden."),
        }),
      );
    });
    await waitFor(() => expect(screen.queryByTestId("story-room-handoff")).not.toBeInTheDocument());
    expect(await screen.findByTestId("story-reply-loop")).toHaveTextContent("Story placed");
    expect(screen.getByTestId("story-reply-loop-body")).toHaveTextContent("That garden image sounds peaceful.");
    expect(screen.getByTestId("story-reply-context-frame")).toHaveTextContent("Maria has a thought on your reflection.");

    fireEvent.click(screen.getByTestId("story-reply-action-0"));

    expect(screen.getByDisplayValue("Thanks, Maria. That image stayed with me the most.")).toBeInTheDocument();
  });

  it("opens a hello story in Together Room as a protected hello", async () => {
    queryMock.mockReturnValue({
      data: togetherRoomResponse,
      isLoading: false,
      isError: false,
    });

    renderRoom({
      pathname: "/social-rooms/together-room",
      state: {
        socialShareDropBoxNote: {
          id: "note-hello-1",
          noteType: "hello",
          text: "Hello, I would enjoy a quiet chat today.",
          source: "share-dropbox",
        },
      },
    });

    expect(await screen.findByTestId("story-room-handoff")).toHaveTextContent("Send a hello");
    expect(screen.getByTestId("story-handoff-primary")).toHaveTextContent("Send hello");
    expect(screen.getByTestId("story-handoff-outcome")).toHaveTextContent("respond when they are ready");
    await waitFor(() => {
      expect(screen.getByTestId("together-proposal-draft")).toHaveValue("Hello, I would enjoy a quiet chat today.");
    });

    fireEvent.click(screen.getByTestId("story-handoff-primary"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Hello, I would enjoy a quiet chat today."),
        }),
      );
    });
    await waitFor(() => expect(screen.queryByTestId("story-room-handoff")).not.toBeInTheDocument());
    expect(await screen.findByTestId("story-reply-loop")).toHaveTextContent("Story placed");
    expect(screen.getByTestId("story-reply-loop-body")).toHaveTextContent("Hello. I am glad you came in.");
    expect(screen.getByTestId("story-reply-context-frame")).toHaveTextContent("Carmen can start the conversation.");

    fireEvent.click(screen.getByTestId("story-reply-action-0"));

    expect(screen.getByTestId("together-proposal-draft")).toHaveValue("Thanks, Carmen. I am glad to say hello too.");
  });
});

describe("RoomScreen movement room", () => {
  beforeEach(() => {
    languageMock.language = "en";
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
    vi.useFakeTimers();
    const exerciseLoggedDate = new Date("2026-09-25T12:00:00");
    vi.setSystemTime(exerciseLoggedDate);
    renderRoom();

    expect(screen.queryByText("Amara welcomes you")).not.toBeInTheDocument();
    expect(screen.queryByText("Hello, I'm Amara. We can move gently and without hurry.")).not.toBeInTheDocument();
    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent("Choose a gentle activity");
    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent("Tap a photo");
    expect(screen.getByTestId("button-movement-room-recommended-exercise")).toHaveTextContent("Recommended today");
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent("My gentle week");
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent("0 days moved");
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent("Chair support");
    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent("Browse all 12 photo-led routines");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent("Chair yoga");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent("Tai chi");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent("Seated strength");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent("Calm breathing");
    expect(screen.getAllByTestId(/^movement-room-exercise-card-/)).toHaveLength(4);
    expect(
      screen.getByTestId("movement-room-exercise-cards").compareDocumentPosition(screen.getByTestId("movement-room-gentle-week"))
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    voiceMock.startVoice.mockClear();
    fireEvent.click(screen.getByTestId("movement-room-exercise-card-chair-yoga"));

    await flushAsyncEffects();
    expect(screen.getByTestId("movement-exercise-guide")).toBeInTheDocument();
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/morning-movement/exercises/chair-yoga");
    expect(screen.getByTestId("route-state")).toHaveTextContent("autoStartVoiceGuide");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"returnTo\":\"/social-rooms/morning-movement\"");
    expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Chair yoga");
    expect(screen.getByTestId("movement-guide-status")).toHaveTextContent("Ready for the guided session");
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Sit tall with both feet flat.");
    expect(screen.getByTestId("movement-guide-step-intro")).toBeInTheDocument();
    expect(screen.getByTestId("button-movement-guide-pause")).toHaveTextContent("Start guide");
    fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
    await flushAsyncEffects();
    expect(screen.getByTestId("movement-guide-status")).toHaveTextContent("Guide is live");
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "seated-tall");
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute(
      "src",
      getNarratedMovementStepVideo("chair-yoga", 0, "seated-tall", "en"),
    );
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("data-playback-mode", "narrated-once");
    expect((screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement).loop).toBe(false);
    expect((screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement).muted).toBe(false);
    expect(voiceMock.startVoice).not.toHaveBeenCalled();
    expect(screen.queryByTestId("button-movement-guide-start-audio")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-movement-guide-replay-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-movement-guide-next")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-movement-guide-back-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-exercise-guide-step-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-exercise-guide-audio-panel")).not.toBeInTheDocument();

    await completeMovementGuide();
    vi.useRealTimers();

    await waitFor(() =>
      expect(screen.getByTestId("movement-room-exercise-logged-status")).toHaveTextContent("Chair yoga logged for 10 min."),
    );
    expect(screen.getByTestId("movement-room-exercise-card-chair-yoga")).toHaveTextContent("Logged");
    expect(localStorage.getItem("vyva_movement_last_exercise_id")).toBe("chair-yoga");
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent("1 day moved");
    expect(JSON.parse(localStorage.getItem("vyva_movement_week_log_dates") ?? "[]")).toContain(localDateKey(exerciseLoggedDate));

    const logCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/activity/log");
    expect(logCall).toBeTruthy();
    expect(logCall?.[1]).toEqual(expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ activity_type: "ChairYoga", duration_minutes: 10 }),
    }));
  });

  it("steps through a Movement exercise guide page with step-specific photos in a language without narrated assets", async () => {
    vi.useFakeTimers();
    languageMock.language = "es";
    renderRoom("/social-rooms/morning-movement/exercises/ankle-mobility");

    const ankleMobilitySession = MOVEMENT_EXERCISE_SESSIONS["ankle-mobility"];
    expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Movilidad de tobillos");
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent(ankleMobilitySession.steps.es[0]);
    expect(screen.getByTestId("movement-guide-step-intro")).toBeInTheDocument();
    expect(screen.queryByTestId("movement-guide-step-intro-icon")).not.toBeInTheDocument();

    await flushAsyncEffects();
    expect(voiceMock.startVoice).toHaveBeenCalled();
    await advanceMovementGuideIntro();

    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "ankle-seat");
    expect(screen.queryByTestId("movement-guide-motion-cue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-exercise-step-thumb-3")).not.toBeInTheDocument();
    const firstStepVideo = screen.getByTestId("movement-exercise-step-video");
    expect(firstStepVideo).toHaveAttribute("src", getMovementStepVideo("ankle-mobility", 0, ankleMobilitySession.visuals[0]));
    expect(firstStepVideo).toHaveAttribute("data-playback-mode", "silent-loop");
    expect((firstStepVideo as HTMLVideoElement).loop).toBe(true);
    expect((firstStepVideo as HTMLVideoElement).muted).toBe(true);
    expect(firstStepVideo).toHaveAttribute("poster", getMovementStepImage("ankle-mobility", 0, ankleMobilitySession.visuals[0]));
    expect(firstStepVideo).toHaveAttribute(
      "aria-label",
      "Movilidad de tobillos: Seated tall with foot ready",
    );

    await advanceMovementGuideVisualStep();

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent(ankleMobilitySession.steps.es[1]);
    expect(screen.getByTestId("movement-guide-step-intro")).toBeInTheDocument();
    await advanceMovementGuideIntro();
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "foot-lift");
    expect(screen.queryByTestId("movement-guide-motion-cue")).not.toBeInTheDocument();
    const secondStepVideo = screen.getByTestId("movement-exercise-step-video");
    expect(secondStepVideo).toHaveAttribute("src", getMovementStepVideo("ankle-mobility", 1, ankleMobilitySession.visuals[1]));
    expect(secondStepVideo).toHaveAttribute("data-playback-mode", "silent-loop");
    expect(secondStepVideo).toHaveAttribute("poster", getMovementStepImage("ankle-mobility", 1, ankleMobilitySession.visuals[1]));
    expect(secondStepVideo.getAttribute("poster")).not.toBe(firstStepVideo.getAttribute("poster"));

    await advanceMovementGuideVisualStep();
    await advanceMovementGuideIntro();

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent(ankleMobilitySession.steps.es[2]);
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "toe-flex");
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("src", getMovementStepVideo("ankle-mobility", 2, ankleMobilitySession.visuals[2]));
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("poster", getMovementStepImage("ankle-mobility", 2, ankleMobilitySession.visuals[2]));

    await advanceMovementGuideVisualStep();
    await advanceMovementGuideIntro();

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent(ankleMobilitySession.steps.es[3]);
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "foot-change");
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("src", getMovementStepVideo("ankle-mobility", 3, ankleMobilitySession.visuals[3]));
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("data-playback-mode", "silent-loop");
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("poster", getMovementStepImage("ankle-mobility", 3, ankleMobilitySession.visuals[3]));
    expect(screen.queryByTestId("button-movement-guide-finish")).not.toBeInTheDocument();
  });

  it("shows a live countdown that freezes while the routine is paused", async () => {
    vi.useFakeTimers();
    renderRoom("/social-rooms/morning-movement/exercises/ankle-mobility");

    await flushAsyncEffects();
    fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
    await flushAsyncEffects();
    expect(screen.getByTestId("movement-guide-countdown")).toHaveTextContent("1:12 left");
    expect(screen.getByTestId("movement-guide-step-countdown-progress")).toHaveStyle({ width: "0%" });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(screen.getByTestId("movement-guide-countdown")).toHaveTextContent("1:02 left");
    expect(screen.getByTestId("movement-guide-step-countdown-progress")).toHaveStyle({ width: `${10_000 / 72_000 * 100}%` });

    fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
    await act(async () => {
      vi.advanceTimersByTime(20_000);
      await Promise.resolve();
    });

    expect(screen.getByTestId("movement-guide-countdown")).toHaveTextContent("1:02 left");
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Follow the short guide");
  });

  it.each([
    { exerciseId: "ankle-mobility", initialTimer: "1:12 left", durationMs: 72_000, logType: "AnkleMobility" },
    { exerciseId: "chest-opener", initialTimer: "1:00 left", durationMs: 60_000, logType: "ChestOpener" },
    { exerciseId: "side-steps", initialTimer: "1:00 left", durationMs: 60_000, logType: "SideSteps" },
    { exerciseId: "hand-breathing", initialTimer: "1:00 left", durationMs: 60_000, logType: "HandBreathing" },
    { exerciseId: "shoulder-release", initialTimer: "1:00 left", durationMs: 60_000, logType: "ShoulderRelease" },
  ])("plays the complete $exerciseId guide once and logs its short duration", async ({ exerciseId, initialTimer, durationMs, logType }) => {
    vi.useFakeTimers();
    renderRoom(`/social-rooms/morning-movement/exercises/${exerciseId}`);
    await flushAsyncEffects();
    expect(screen.queryByTestId("movement-exercise-step-video")).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByTestId("movement-guide-countdown")).toHaveTextContent(initialTimer);

    fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
    await flushAsyncEffects();
    const video = screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", `/assets/movement/narrated/${exerciseId}-short-guide-en-v2.mp4`);
    expect(video.loop).toBe(false);
    expect(video.muted).toBe(false);
    expect(voiceMock.startVoice).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(durationMs - 1_000); });
    expect(screen.getByTestId("movement-guide-countdown")).toHaveTextContent("0:01 left");
    expect(apiFetchMock.mock.calls.some(([url]) => url === "/api/activity/log")).toBe(false);
    await act(async () => { vi.advanceTimersByTime(1_000); });
    await flushAsyncEffects();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/activity/log", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ activity_type: logType, duration_minutes: 1 }),
    }));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/experts/amara");
  });

  it.each(movementExerciseIds.filter((id) => !getNarratedMovementGuide(id, "en")))(
    "plays all four narrated %s steps, pauses the timer and logs completion once",
    async (exerciseId) => {
      vi.useFakeTimers();
      renderRoom(`/social-rooms/morning-movement/exercises/${exerciseId}`);
      await flushAsyncEffects();
      fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
      await flushAsyncEffects();
      const session = MOVEMENT_EXERCISE_SESSIONS[exerciseId];

      for (let index = 0; index < session.visuals.length; index += 1) {
        if (index > 0) await advanceMovementGuideIntro();
        const video = screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement;
        expect(video).toHaveAttribute("src", getNarratedMovementStepVideo(exerciseId, index, session.visuals[index], "en"));
        expect(video.loop).toBe(false);
        expect(video.muted).toBe(false);
        expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent(session.steps.en[index]);

        fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
        const pausedTime = screen.getByTestId("movement-guide-countdown").textContent;
        await act(async () => { vi.advanceTimersByTime(10_000); });
        expect(screen.getByTestId("movement-guide-countdown").textContent).toBe(pausedTime);
        fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
        await flushAsyncEffects();
        expect(apiFetchMock.mock.calls.some(([url]) => url === "/api/activity/log")).toBe(false);
        await advanceMovementGuideVisualStep();
      }

      await flushAsyncEffects();
      const logCalls = apiFetchMock.mock.calls.filter(([url]) => url === "/api/activity/log");
      expect(logCalls).toHaveLength(1);
      expect(logCalls[0][1]).toEqual(expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ activity_type: session.logType, duration_minutes: 10 }),
      }));
      expect(voiceMock.startVoice).not.toHaveBeenCalled();
      expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/experts/amara");
    },
  );

  it("keeps guided step visuals video-backed and free of circle cues", async () => {
    vi.useFakeTimers();
    languageMock.language = "es";
    renderRoom("/social-rooms/morning-movement/exercises/heel-raises");

    await flushAsyncEffects();
    expect(screen.getByTestId("movement-guide-step-intro")).toBeInTheDocument();
    await advanceMovementGuideIntro();
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "chair-behind");
    expect(screen.getByTestId("movement-exercise-step-media-frame")).toHaveClass("aspect-video");
    expect(screen.getByTestId("movement-exercise-step-media-frame")).toHaveClass("sm:aspect-auto");
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("src", getMovementStepVideo("heel-raises", 0, "chair-behind"));
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("data-playback-mode", "silent-loop");
    expect((screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement).loop).toBe(true);
    expect((screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement).muted).toBe(true);
    expect(screen.queryByTestId("movement-guide-motion-cue")).not.toBeInTheDocument();

    await advanceMovementGuideVisualStep();
    await advanceMovementGuideIntro();
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "chair-hold");
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("src", getMovementStepVideo("heel-raises", 1, "chair-hold"));
    expect(screen.queryByTestId("movement-guide-motion-cue")).not.toBeInTheDocument();

    await advanceMovementGuideVisualStep();
    await advanceMovementGuideIntro();
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "toe-rise");
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("src", getMovementStepVideo("heel-raises", 2, "toe-rise"));
    expect(screen.queryByTestId("movement-guide-motion-cue")).not.toBeInTheDocument();

    await advanceMovementGuideVisualStep();
    await advanceMovementGuideIntro();
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "heel-lower");
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("src", getMovementStepVideo("heel-raises", 3, "heel-lower"));
    expect(screen.queryByTestId("movement-guide-motion-cue")).not.toBeInTheDocument();
  });

  it("changes the step photo and written step together", async () => {
    vi.useFakeTimers();
    for (const [index, exerciseId] of (["seated-strength", "calm-breathing"] as const).entries()) {
      if (index > 0) cleanup();
      renderRoom(`/social-rooms/morning-movement/exercises/${exerciseId}`);

      const session = MOVEMENT_EXERCISE_SESSIONS[exerciseId];
      const hasNarratedFirstStep = Boolean(getNarratedMovementStepVideo(exerciseId, 0, session.visuals[0], "en"));
      const firstStepText = screen.getByTestId("movement-exercise-guide-step").textContent;
      await flushAsyncEffects();
      if (hasNarratedFirstStep) {
        expect(voiceMock.startVoice).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
        await flushAsyncEffects();
      } else {
        expect(voiceMock.startVoice).toHaveBeenCalled();
        await advanceMovementGuideIntro();
      }
      const firstStepMedia = screen.queryByTestId("movement-exercise-step-video")?.getAttribute("src")
        ?? screen.getByTestId("movement-exercise-step-image").getAttribute("src");
      if (hasNarratedFirstStep) {
        await advanceMovementGuideStep();
      } else {
        await advanceMovementGuideVisualStep();
      }
      await advanceMovementGuideIntro();

      const secondStepMedia = screen.queryByTestId("movement-exercise-step-video")?.getAttribute("src")
        ?? screen.getByTestId("movement-exercise-step-image").getAttribute("src");
      expect(secondStepMedia).not.toBe(firstStepMedia);
      expect(screen.getByTestId("movement-exercise-guide-step").textContent).not.toBe(firstStepText);
      expect(screen.queryByTestId("movement-exercise-step-thumb-1")).not.toBeInTheDocument();
      voiceMock.startVoice.mockClear();
    }
  });

  it("keeps Movement exercise motion metadata aligned with each guide step", () => {
    Object.entries(MOVEMENT_EXERCISE_SESSIONS).forEach(([exerciseId, session]) => {
      Object.entries(session.steps).forEach(([language, steps]) => {
        expect(
          session.visuals,
          `${exerciseId} should keep voice motion metadata aligned for every ${language} step`,
        ).toHaveLength(steps.length);
        expect(
          session.sceneLabels,
          `${exerciseId} should keep scene labels aligned for every ${language} step`,
        ).toHaveLength(steps.length);
        session.visuals.forEach((motion, index) => {
          expect(motion).toBeTruthy();
          expect(
            getMovementStepImage(exerciseId as keyof typeof MOVEMENT_EXERCISE_SESSIONS, index, motion),
            `${exerciseId} should have a step image for ${language} step ${index + 1}`,
          ).toBeTruthy();
          expect(
            session.sceneLabels[index],
            `${exerciseId} should have a scene label for ${language} step ${index + 1}`,
          ).toBeTruthy();
        });
      });
    });
  });

  it("looks up approved narrated assets without replacing silent fallbacks", () => {
    expect(getNarratedMovementStepVideo("chair-yoga", 0, "seated-tall", "en")).toBe(
      "/assets/movement/narrated/chair-yoga-step-01-seated-tall.mp4",
    );
    expect(getNarratedMovementStepVideo("chair-yoga", 0, "shoulder-roll", "en")).toBeUndefined();
    expect(getNarratedMovementStepVideo("chair-yoga", 1, "shoulder-roll", "en")).toBe(
      "/assets/movement/narrated/chair-yoga-step-02-shoulder-roll.mp4",
    );
    expect(getNarratedMovementStepVideo("chair-yoga", 2, "overhead-reach", "en")).toBe(
      "/assets/movement/narrated/chair-yoga-step-03-overhead-reach.mp4",
    );
    expect(getNarratedMovementStepVideo("chair-yoga", 3, "side-change", "en")).toBe(
      "/assets/movement/narrated/chair-yoga-step-04-side-change.mp4",
    );
    expect(getNarratedMovementStepVideo("tai-chi", 0, "standing-support", "en")).toBe(
      "/assets/movement/narrated/tai-chi-step-01-standing-support.mp4",
    );
    expect(getNarratedMovementStepVideo("tai-chi", 1, "soft-knees", "en")).toBe(
      "/assets/movement/narrated/tai-chi-step-02-soft-knees.mp4",
    );
    expect(getNarratedMovementStepVideo("tai-chi", 2, "weight-shift", "en")).toBe(
      "/assets/movement/narrated/tai-chi-step-03-weight-shift.mp4",
    );
    expect(getNarratedMovementStepVideo("tai-chi", 3, "hand-flow", "en")).toBe(
      "/assets/movement/narrated/tai-chi-step-04-hand-flow.mp4",
    );
    expect(getNarratedMovementStepVideo("seated-strength", 0, "chair-front", "en")).toBe(
      "/assets/movement/narrated/seated-strength-step-01-chair-front.mp4",
    );
    expect(getNarratedMovementStepVideo("sit-to-stand", 1, "feet-under", "en")).toBe(
      "/assets/movement/narrated/sit-to-stand-step-02-feet-under.mp4",
    );
    expect(getNarratedMovementStepVideo("sit-to-stand", 2, "stand-up", "en")).toBe(
      "/assets/movement/narrated/sit-to-stand-step-03-stand-up.mp4",
    );
    expect(getNarratedMovementStepVideo("sit-to-stand", 3, "sit-down", "en")).toBe(
      "/assets/movement/narrated/sit-to-stand-step-04-sit-down.mp4",
    );
    expect(getNarratedMovementStepVideo("heel-raises", 0, "chair-behind", "en")).toBe(
      "/assets/movement/narrated/heel-raises-step-01-chair-behind.mp4",
    );
    expect(getNarratedMovementStepVideo("heel-raises", 1, "chair-hold", "en")).toBe(
      "/assets/movement/narrated/heel-raises-step-02-chair-hold.mp4",
    );
    expect(getNarratedMovementStepVideo("heel-raises", 2, "toe-rise", "en")).toBe(
      "/assets/movement/narrated/heel-raises-step-03-toe-rise.mp4",
    );
    expect(getNarratedMovementStepVideo("heel-raises", 3, "heel-lower", "en")).toBe(
      "/assets/movement/narrated/heel-raises-step-04-heel-lower.mp4",
    );
    expect(getNarratedMovementStepVideo("wall-push-ups", 0, "wall-ready", "en")).toBe(
      "/assets/movement/narrated/wall-push-ups-step-01-wall-ready.mp4",
    );
    expect(getNarratedMovementStepVideo("wall-push-ups", 1, "hands-wall", "en")).toBe(
      "/assets/movement/narrated/wall-push-ups-step-02-hands-wall.mp4",
    );
    expect(getNarratedMovementStepVideo("wall-push-ups", 2, "wall-lean", "en")).toBe(
      "/assets/movement/narrated/wall-push-ups-step-03-wall-lean.mp4",
    );
    expect(getNarratedMovementStepVideo("wall-push-ups", 3, "wall-press", "en")).toBe(
      "/assets/movement/narrated/wall-push-ups-step-04-wall-press.mp4",
    );
    expect(getNarratedMovementGuide("ankle-mobility", "en")?.video).toBe("/assets/movement/narrated/ankle-mobility-short-guide-en-v2.mp4");
    expect(getNarratedMovementGuide("ankle-mobility", "es")).toBeUndefined();
    expect(getNarratedMovementStepVideo("ankle-mobility", 0, "ankle-seat", "en")).toBeUndefined();
    expect(getNarratedMovementStepVideo("chair-yoga", 1, "shoulder-roll", "es")).toBeUndefined();
    expect(getMovementStepVideo("chair-yoga", 1, "shoulder-roll")).toBe("/assets/movement/chair-yoga-step-02-shoulder-roll.mp4");
  });

  it.each(movementExerciseIds)("renders step-specific media for the %s guide", async (exerciseId) => {
    vi.useFakeTimers();
    renderRoom(`/social-rooms/morning-movement/exercises/${exerciseId}`);
    await flushAsyncEffects();

    const session = MOVEMENT_EXERCISE_SESSIONS[exerciseId];
    const narratedStepVideo = getNarratedMovementGuide(exerciseId, "en")?.video ?? getNarratedMovementStepVideo(exerciseId, 0, session.visuals[0], "en");
    if (narratedStepVideo) {
      expect(screen.getByTestId("movement-guide-step-intro")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
      await flushAsyncEffects();
      expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute(
        "src",
        narratedStepVideo,
      );
      expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("data-playback-mode", "narrated-once");
      expect((screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement).loop).toBe(false);
      expect((screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement).muted).toBe(false);
    } else {
      expect(screen.getByTestId("movement-guide-step-intro")).toBeInTheDocument();
      await advanceMovementGuideIntro();
      const stepVideo = getMovementStepVideo(exerciseId, 0, session.visuals[0]);
      expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("src", stepVideo);
      expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute("data-playback-mode", "silent-loop");
      expect((screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement).loop).toBe(true);
      expect((screen.getByTestId("movement-exercise-step-video") as HTMLVideoElement).muted).toBe(true);
    }
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute(
      "data-motion",
      session.visuals[0],
    );
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute(
      "poster",
      getMovementStepImage(exerciseId, 0, session.visuals[0]),
    );
    expect(screen.getByTestId("movement-exercise-step-video")).toHaveAttribute(
      "aria-label",
      expect.stringContaining(getNarratedMovementGuide(exerciseId, "en")?.sceneLabel ?? session.sceneLabels[0]),
    );
    expect(screen.queryByTestId("movement-exercise-step-image")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-exercise-step-thumb-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-motion-cue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-motion-cue-timer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-guide-session-status")).not.toBeInTheDocument();
    expect(document.querySelector(".photo-motion-dot")).not.toBeInTheDocument();
    expect(document.querySelector(".photo-motion-cue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-guide-motion-cue")).not.toBeInTheDocument();
  });

  it("auto-starts VYVA guide with exercise-specific storyboard context", async () => {
    languageMock.language = "es";
    renderRoom("/social-rooms/morning-movement/exercises/heel-raises");

    await flushAsyncEffects();
    expect(voiceMock.startVoice).toHaveBeenCalled();
    expect(voiceMock.startVoice).toHaveBeenCalledWith(
      expect.stringContaining("Guide the user through Elevacion de talones."),
      undefined,
      expect.objectContaining({
        agentSlug: "wellness",
        roomSlug: "morning-movement",
        autoStartListening: false,
        dynamicVariables: expect.objectContaining({
          app_entrypoint: "movement_exercise_guide",
          guidance_mode: "app_guided_visual_routine",
          timer_authority: "app",
          app_controls: "visuals,timer,step_advancement,pause_resume,completion_logging",
          activity_language: "es",
          language: "es",
          exercise_id: "heel-raises",
          exercise_title: "Elevacion de talones",
          exercise_benefit: "Tobillos estables",
          wellness_routine: "heel-raises",
          routine_id: "heel-raises",
          routine_title: "Elevacion de talones",
          routine_type: "HeelRaises",
          duration_seconds: 600,
          step_duration_seconds: 150,
          current_step: "Ponte detras de una silla estable.",
          current_step_index: 0,
          visual_step_label: "Paso 1 de 4",
          current_step_number: 1,
          current_step_total: 4,
          is_final_step: false,
          visual_motion: "chair-behind",
          visual_scene: "Standing behind a stable chair",
          next_visual_action: "Siguiente",
          safety_line: "Muevete con suavidad. Para si sientes dolor, mareo o falta de aire.",
          audio_role: "agent_spoken_guidance_only",
        }),
      }),
    );
    expect(voiceMock.startVoice).toHaveBeenCalledWith(
      expect.stringContaining("The purple instruction screen is showing now"),
      undefined,
      expect.any(Object),
    );
    expect(voiceMock.startVoice).toHaveBeenCalledWith(
      expect.stringContaining("Do not ask \"are you there\""),
      undefined,
      expect.any(Object),
    );
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(
      expect.stringContaining("\"current_step\":\"Ponte detras de una silla estable.\""),
    );
    expect(voiceMock.setMicrophoneMuted).toHaveBeenCalledWith(true);
    expect(voiceMock.sendText).not.toHaveBeenCalled();
  });

  it("returns from a routine to the Wellness Coach instead of the old Movement room", async () => {
    renderRoom("/social-rooms/morning-movement/exercises/chair-yoga");
    await flushAsyncEffects();

    fireEvent.click(screen.getByTestId("button-movement-guide-back-room"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/experts/amara");
  });

  it("returns from a dev routine preview to the Home Master community preview", async () => {
    renderRoom("/dev/social-rooms/morning-movement/exercises/chair-yoga");
    await flushAsyncEffects();

    fireEvent.click(screen.getByTestId("button-movement-guide-back-room"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/dev/home-master/community");
  });

  it("sends updated voice context when advancing a connected guide", async () => {
    vi.useFakeTimers();
    languageMock.language = "es";
    voiceMock.status = "connected";
    renderRoom("/social-rooms/morning-movement/exercises/heel-raises");

    await flushAsyncEffects();
    expect(voiceMock.startVoice).toHaveBeenCalled();
    voiceMock.sendContextUpdate.mockClear();
    voiceMock.sendText.mockClear();
    await advanceMovementGuideStep();

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Sujeta la silla suavemente.");
    await advanceMovementGuideIntro();
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "chair-hold");
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("Authoritative movement routine state from the app"));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"wellness_routine\":\"heel-raises\""));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"current_step\":\"Sujeta la silla suavemente."));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"current_step_number\":2"));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"current_step_total\":4"));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"timer_authority\":\"app\""));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"visual_motion\":\"chair-hold\""));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"visual_scene\":\"Hands lightly holding the chair\""));
    expect(voiceMock.sendText).toHaveBeenCalledWith(
      expect.stringContaining("Current step 2 of 4"),
      { invisibleInTranscript: true },
    );
  });

  it("keeps the routine page free of manual guide clutter", async () => {
    renderRoom("/social-rooms/morning-movement/exercises/seated-strength");
    await flushAsyncEffects();

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Sit near the front of the chair.");
    expect(screen.queryByTestId("movement-motion-cue-timer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-guide-session-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-movement-guide-pause")).toHaveTextContent("Start guide");
    expect(screen.queryByTestId("button-movement-guide-start-audio")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-movement-guide-replay-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-movement-guide-next")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-movement-guide-back-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-exercise-guide-step-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-exercise-guide-audio-panel")).not.toBeInTheDocument();
  });

  it("shows a single Begin fallback if automatic audio start is blocked", async () => {
    languageMock.language = "es";
    voiceMock.startVoice.mockRejectedValueOnce(new Error("audio blocked"));
    renderRoom("/social-rooms/morning-movement/exercises/heel-raises");

    await waitFor(() => expect(screen.getByTestId("movement-guide-audio-fallback")).toBeInTheDocument());
    expect(screen.getByTestId("movement-guide-audio-fallback")).toHaveTextContent("El audio no esta disponible ahora.");
    expect(screen.getByTestId("button-movement-guide-begin-fallback")).toHaveTextContent("Iniciar guia");
    expect(screen.queryByTestId("button-movement-guide-start-audio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-movement-guide-begin-fallback"));
    await waitFor(() => expect(screen.getByTestId("movement-guide-status")).toHaveTextContent("La guia esta activa"));
  });

  it("handles invalid Movement exercise IDs safely", async () => {
    renderRoom("/social-rooms/morning-movement/exercises/not-real");

    expect(screen.getByTestId("movement-exercise-guide-invalid")).toHaveTextContent("Exercise not found");

    fireEvent.click(screen.getByTestId("button-movement-guide-back-room"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/experts/amara"));
  });

  it("repeats the last Movement room exercise from My gentle week", async () => {
    localStorage.setItem("vyva_movement_last_exercise_id", "tai-chi");
    renderRoom();

    expect(screen.getByTestId("movement-room-exercise-card-tai-chi")).toHaveTextContent("Last used");
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent("Last time: Tai chi");
    expect(screen.getByTestId("button-movement-room-repeat-exercise")).toHaveTextContent("Last time: Tai chi");

    fireEvent.click(screen.getByTestId("button-movement-room-repeat-exercise"));

    await waitFor(() => expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Tai chi"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/morning-movement/exercises/tai-chi");
  });

  it("saves comfort level and opens a one-tap swap exercise", async () => {
    renderRoom();

    fireEvent.click(screen.getByTestId("button-movement-room-comfort-seated"));

    expect(localStorage.getItem("vyva_movement_comfort_level")).toBe("seated");

    fireEvent.click(screen.getByTestId("button-movement-room-swap-calm"));

    await waitFor(() => expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Calm breathing"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/morning-movement/exercises/calm-breathing");
  });

  it("expands more exercise cards inside the Movement room", async () => {
    vi.useFakeTimers();
    renderRoom();

    fireEvent.click(screen.getByTestId("button-movement-room-browse-exercises"));

    expect(screen.queryByTestId("current-route")).not.toBeInTheDocument();
    expect(screen.getByTestId("movement-room-expanded-exercise-library")).toHaveTextContent("More gentle exercises");
    expect(screen.getByTestId("movement-room-expanded-exercise-library")).toHaveTextContent("12 choices");
    expect(screen.getAllByTestId(/^movement-room-exercise-card-/)).toHaveLength(6);

    fireEvent.click(screen.getByTestId("movement-room-exercise-filter-strength"));

    expect(screen.getByTestId("movement-room-exercise-group-strength")).toHaveTextContent("Strength");
    expect(screen.getByTestId("movement-room-extra-exercise-cards")).toHaveTextContent("Sit-to-stand");
    expect(screen.getByTestId("movement-room-extra-exercise-cards")).toHaveTextContent("Wall push-ups");

    fireEvent.click(screen.getByTestId("movement-room-exercise-card-wall-push-ups"));

    await flushAsyncEffects();
    expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Wall push-ups");
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Stand an arm's length from a wall.");
    fireEvent.click(screen.getByTestId("button-movement-guide-pause"));
    await flushAsyncEffects();

    await completeMovementGuide();
    vi.useRealTimers();

    await waitFor(
      () => expect(screen.queryByTestId("movement-exercise-guide")).not.toBeInTheDocument(),
      { timeout: 5_000 },
    );
    await waitFor(() =>
      expect(screen.getByTestId("movement-room-exercise-logged-status")).toHaveTextContent("Wall push-ups logged for 10 min."),
    );

    const logCall = apiFetchMock.mock.calls.find(([, options]) => options?.body === JSON.stringify({ activity_type: "WallPushUps", duration_minutes: 10 }));
    expect(logCall).toBeTruthy();
  });

  it.each([
    {
      language: "fr",
      title: "Choisir une activite douce",
      recommended: "Recommande aujourd'hui",
      week: "Ma semaine douce",
      comfort: "Niveau de confort",
      chair: "Yoga sur chaise",
      more: "Plus d'exercices doux",
      group: "Force",
      wall: "Pompes au mur",
      lastUsed: "Dernier",
      step: "Placez-vous a une longueur de bras du mur.",
      logged: "Pompes au mur note pendant 10 min.",
    },
    {
      language: "it",
      title: "Scegli un'attivita dolce",
      recommended: "Consigliato oggi",
      week: "La mia settimana dolce",
      comfort: "Livello di comfort",
      chair: "Yoga sulla sedia",
      more: "Altri esercizi dolci",
      group: "Forza",
      wall: "Piegamenti al muro",
      lastUsed: "Ultimo",
      step: "Mettiti a un braccio di distanza dal muro.",
      logged: "Piegamenti al muro registrato per 10 min.",
    },
    {
      language: "pt",
      title: "Escolha uma atividade suave",
      recommended: "Recomendado hoje",
      week: "A minha semana suave",
      comfort: "Nivel de conforto",
      chair: "Ioga na cadeira",
      more: "Mais exercicios suaves",
      group: "Forca",
      wall: "Flexoes na parede",
      lastUsed: "Ultimo",
      step: "Fique a distancia de um braco da parede.",
      logged: "Flexoes na parede registado por 10 min.",
    },
  ])("does not fall back to English for Movement exercise copy in $language", async ({ language, title, recommended, week, comfort, chair, more, group, wall, lastUsed, step, logged }) => {
    vi.useFakeTimers();
    languageMock.language = language;
    localStorage.setItem("vyva_movement_last_exercise_id", "wall-push-ups");
    renderRoom();

    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent(title);
    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent(recommended);
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent(week);
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent(comfort);
    expect(screen.getByTestId("movement-room-exercise-library")).not.toHaveTextContent("Recommended today");
    expect(screen.getByTestId("movement-room-gentle-week")).not.toHaveTextContent("My gentle week");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent(chair);
    expect(screen.getByTestId("movement-room-exercise-library")).not.toHaveTextContent("Choose a gentle activity");
    expect(screen.getByTestId("movement-room-exercise-cards")).not.toHaveTextContent("Chair yoga");

    fireEvent.click(screen.getByTestId("button-movement-room-browse-exercises"));
    expect(screen.getByTestId("movement-room-expanded-exercise-library")).toHaveTextContent(more);

    fireEvent.click(screen.getByTestId("movement-room-exercise-filter-strength"));
    expect(screen.getByTestId("movement-room-exercise-group-strength")).toHaveTextContent(group);
    expect(screen.getByTestId("movement-room-extra-exercise-cards")).toHaveTextContent(wall);
    expect(screen.getByTestId("movement-room-extra-exercise-cards")).not.toHaveTextContent("Wall push-ups");
    expect(screen.getByTestId("movement-room-exercise-card-wall-push-ups")).toHaveTextContent(lastUsed);
    expect(screen.getByTestId("movement-room-exercise-card-wall-push-ups")).not.toHaveTextContent("Last used");

    fireEvent.click(screen.getByTestId("movement-room-exercise-card-wall-push-ups"));
    await flushAsyncEffects();
    expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent(wall);
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent(step);

    await completeMovementGuide();
    vi.useRealTimers();

    const loggedStatus = await screen.findByTestId("movement-room-exercise-logged-status");
    expect(loggedStatus).toHaveTextContent(logged);
    expect(loggedStatus).not.toHaveTextContent("logged for 10 min.");
  });
});

describe("RoomScreen reading room member lounge", () => {
  beforeEach(() => {
    languageMock.language = "en";
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
  }, 60_000);
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
  }, 60_000);
});
