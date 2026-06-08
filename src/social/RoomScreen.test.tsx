import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MovementExerciseGuideScreen from "./MovementExerciseGuideScreen";
import { MOVEMENT_EXERCISE_SESSIONS, getMovementStepImage } from "./movementExercises";
import RoomScreen from "./RoomScreen";
import type { SocialRoomResponse } from "./types";

const languageMock = vi.hoisted(() => ({ language: "en" }));
const voiceMock = vi.hoisted(() => ({
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  sendText: vi.fn(),
  sendContextUpdate: vi.fn(),
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
    beginUserTurn: vi.fn(),
    endUserTurn: vi.fn(),
  }),
}));

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
const movementExerciseIds = Object.keys(MOVEMENT_EXERCISE_SESSIONS) as Array<keyof typeof MOVEMENT_EXERCISE_SESSIONS>;

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

function renderRoom(initialEntry = "/social-rooms/morning-movement") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/social-rooms/morning-movement/exercises/:exerciseId" element={<><MovementExerciseGuideScreen /><LocationProbe /></>} />
        <Route path="/social-rooms/:slug" element={<RoomScreen />} />
        <Route path="/activity" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RoomScreen Together Room", () => {
  beforeEach(() => {
    languageMock.language = "en";
    localStorage.clear();
    voiceMock.startVoice.mockReset();
    voiceMock.stopVoice.mockReset();
    voiceMock.sendText.mockReset();
    voiceMock.sendContextUpdate.mockReset();
    voiceMock.status = "idle";
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

describe("RoomScreen movement room", () => {
  beforeEach(() => {
    languageMock.language = "en";
    localStorage.clear();
    voiceMock.startVoice.mockReset();
    voiceMock.stopVoice.mockReset();
    voiceMock.sendText.mockReset();
    voiceMock.sendContextUpdate.mockReset();
    voiceMock.status = "idle";
    voiceMock.startVoice.mockResolvedValue(undefined);
    voiceMock.sendText.mockReturnValue(true);
    voiceMock.sendContextUpdate.mockReturnValue(true);
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

    fireEvent.click(screen.getByTestId("movement-room-exercise-card-chair-yoga"));

    await waitFor(() => expect(screen.getByTestId("movement-exercise-guide")).toBeInTheDocument());
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/morning-movement/exercises/chair-yoga");
    expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Chair yoga");
    expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Live audio guide");
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Sit tall with both feet flat.");
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "seated-tall");
    expect(screen.getByTestId("movement-exercise-guide-safety")).toHaveTextContent("Move gently. Stop if you feel pain, dizzy, or short of breath.");
    expect(screen.getByTestId("movement-exercise-guide-step-list")).toHaveTextContent("Session steps");
    expect(screen.getByTestId("movement-exercise-guide-audio-panel")).toHaveTextContent("Audio follows the step you see on screen.");

    fireEvent.click(screen.getByTestId("button-movement-guide-step-4"));
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Change sides slowly.");
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "side-change");
    fireEvent.click(screen.getByTestId("button-movement-guide-finish"));

    await waitFor(() => expect(screen.queryByTestId("movement-exercise-guide")).not.toBeInTheDocument());
    expect(screen.getByTestId("movement-room-exercise-logged-status")).toHaveTextContent("Chair yoga logged for 10 min.");
    expect(screen.getByTestId("movement-room-exercise-card-chair-yoga")).toHaveTextContent("Logged");
    expect(localStorage.getItem("vyva_movement_last_exercise_id")).toBe("chair-yoga");
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent("1 day moved");
    expect(JSON.parse(localStorage.getItem("vyva_movement_week_log_dates") ?? "[]")).toContain(localDateKey());

    const logCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/activity/log");
    expect(logCall).toBeTruthy();
    expect(logCall?.[1]).toEqual(expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ activity_type: "ChairYoga", duration_minutes: 10 }),
    }));
  });

  it("steps through a Movement exercise guide page with step-specific photos", async () => {
    renderRoom("/social-rooms/morning-movement/exercises/tai-chi");

    const taiChiSession = MOVEMENT_EXERCISE_SESSIONS["tai-chi"];
    expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Tai chi");
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Stand tall with a chair nearby if helpful.");
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "standing-support");
    expect(screen.queryByTestId("movement-exercise-step-thumb-3")).not.toBeInTheDocument();
    const firstStepImage = screen.getByTestId("movement-exercise-step-image").getAttribute("src");
    expect(firstStepImage).toBe(getMovementStepImage("tai-chi", 0, taiChiSession.visuals[0]));
    expect(screen.getByTestId("movement-exercise-step-image")).toHaveAttribute(
      "alt",
      "Tai chi: Standing tall with chair nearby",
    );

    fireEvent.click(screen.getByTestId("button-movement-guide-next"));

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Soften your knees.");
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "soft-knees");
    const secondStepImage = screen.getByTestId("movement-exercise-step-image").getAttribute("src");
    expect(secondStepImage).toBe(getMovementStepImage("tai-chi", 1, taiChiSession.visuals[1]));
    expect(secondStepImage).not.toBe(firstStepImage);

    fireEvent.click(screen.getByTestId("button-movement-guide-back-step"));

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Stand tall with a chair nearby if helpful.");
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "standing-support");
    expect(screen.getByTestId("movement-exercise-step-image").getAttribute("src")).toBe(firstStepImage);

    fireEvent.click(screen.getByTestId("button-movement-guide-step-4"));

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Float your hands forward and back slowly.");
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "hand-flow");
    expect(screen.getByTestId("movement-exercise-step-image").getAttribute("src")).toBe(getMovementStepImage("tai-chi", 3, taiChiSession.visuals[3]));
    expect(screen.getByTestId("button-movement-guide-finish")).toHaveTextContent("Finish and log 10 min");
  });

  it("changes the step photo and written step together", () => {
    (["chair-yoga", "tai-chi"] as const).forEach((exerciseId, index) => {
      if (index > 0) cleanup();
      renderRoom(`/social-rooms/morning-movement/exercises/${exerciseId}`);

      const firstStepImage = screen.getByTestId("movement-exercise-step-image").getAttribute("src");
      const firstStepText = screen.getByTestId("movement-exercise-guide-step").textContent;
      fireEvent.click(screen.getByTestId("button-movement-guide-next"));

      expect(screen.getByTestId("movement-exercise-step-image").getAttribute("src")).not.toBe(firstStepImage);
      expect(screen.getByTestId("movement-exercise-guide-step").textContent).not.toBe(firstStepText);
      expect(screen.queryByTestId("movement-exercise-step-thumb-1")).not.toBeInTheDocument();
    });
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

  it.each(movementExerciseIds)("renders a step-specific photo for the %s guide", (exerciseId) => {
    renderRoom(`/social-rooms/morning-movement/exercises/${exerciseId}`);

    const session = MOVEMENT_EXERCISE_SESSIONS[exerciseId];
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute(
      "data-motion",
      session.visuals[0],
    );
    expect(screen.getByTestId("movement-exercise-step-image")).toHaveAttribute(
      "src",
      getMovementStepImage(exerciseId, 0, session.visuals[0]),
    );
    expect(screen.getByTestId("movement-exercise-step-image")).toHaveAttribute(
      "alt",
      expect.stringContaining(session.sceneLabels[0]),
    );
    expect(screen.queryByTestId("movement-exercise-step-thumb-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-motion-cue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-motion-cue-timer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-guide-session-status")).not.toBeInTheDocument();
    expect(document.querySelector(".photo-motion-dot")).not.toBeInTheDocument();
    expect(document.querySelector(".photo-motion-cue")).not.toBeInTheDocument();
  });

  it("starts Amara guide with exercise-specific storyboard context", async () => {
    renderRoom("/social-rooms/morning-movement/exercises/tai-chi");

    expect(screen.getByTestId("button-movement-guide-start-audio")).toHaveTextContent("Start Amara guide");
    fireEvent.click(screen.getByTestId("button-movement-guide-start-audio"));

    await waitFor(() => expect(voiceMock.startVoice).toHaveBeenCalled());
    expect(voiceMock.startVoice).toHaveBeenCalledWith(
      expect.stringContaining("Guide the user through Tai chi."),
      undefined,
      expect.objectContaining({
        agentSlug: "amara-osei",
        roomSlug: "morning-movement",
        autoStartListening: false,
        dynamicVariables: expect.objectContaining({
          app_entrypoint: "movement_exercise_guide",
          exercise_id: "tai-chi",
          exercise_title: "Tai chi",
          exercise_benefit: "Balance practice",
          current_step: "Stand tall with a chair nearby if helpful.",
          visual_step_label: "Step 1 of 4",
          visual_motion: "standing-support",
          visual_scene: "Standing tall with chair nearby",
          next_visual_action: "Next",
          safety_line: "Move gently. Stop if you feel pain, dizzy, or short of breath.",
        }),
      }),
    );
    expect(voiceMock.sendText).toHaveBeenCalledWith(
      expect.stringContaining("Current step 1 of 4"),
      { invisibleInTranscript: true },
    );
    expect(voiceMock.sendText).toHaveBeenCalledWith(
      expect.stringContaining("photo storyboard scene: Standing tall with chair nearby."),
      { invisibleInTranscript: true },
    );
  });

  it("sends updated voice context when advancing a connected guide", async () => {
    voiceMock.status = "connected";
    renderRoom("/social-rooms/morning-movement/exercises/tai-chi");

    fireEvent.click(screen.getByTestId("button-movement-guide-next"));

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Soften your knees.");
    expect(screen.getByTestId("movement-exercise-step-visual")).toHaveAttribute("data-motion", "soft-knees");
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("Soften your knees."));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"visual_motion\":\"soft-knees\""));
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(expect.stringContaining("\"visual_scene\":\"Knees softly bent\""));
    expect(voiceMock.sendText).toHaveBeenCalledWith(
      expect.stringContaining("Current step 2 of 4"),
      { invisibleInTranscript: true },
    );
  });

  it("does not auto-advance and replays the current storyboard step", async () => {
    voiceMock.status = "connected";
    renderRoom("/social-rooms/morning-movement/exercises/tai-chi");

    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Stand tall with a chair nearby if helpful.");
    expect(screen.queryByTestId("movement-motion-cue-timer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("movement-guide-session-status")).not.toBeInTheDocument();

    const promptCount = voiceMock.sendText.mock.calls.length;
    fireEvent.click(screen.getByTestId("button-movement-guide-replay-step"));
    expect(voiceMock.sendText).toHaveBeenCalledTimes(promptCount + 1);
    expect(voiceMock.sendText).toHaveBeenLastCalledWith(
      expect.stringContaining("Current step 1 of 4"),
      { invisibleInTranscript: true },
    );
  });

  it("handles invalid Movement exercise IDs safely", async () => {
    renderRoom("/social-rooms/morning-movement/exercises/not-real");

    expect(screen.getByTestId("movement-exercise-guide-invalid")).toHaveTextContent("Exercise not found");

    fireEvent.click(screen.getByTestId("button-movement-guide-back-room"));

    await waitFor(() => expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent("Choose a gentle activity"));
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

    await waitFor(() => expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent("Wall push-ups"));
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent("Stand an arm's length from a wall.");

    fireEvent.click(screen.getByTestId("button-movement-guide-step-4"));
    fireEvent.click(screen.getByTestId("button-movement-guide-finish"));

    await waitFor(() => expect(screen.queryByTestId("movement-exercise-guide")).not.toBeInTheDocument());
    expect(screen.getByTestId("movement-room-exercise-logged-status")).toHaveTextContent("Wall push-ups logged for 10 min.");

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
      safety: "Bougez doucement.",
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
      safety: "Muoviti con dolcezza.",
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
      safety: "Movimente-se suavemente.",
      logged: "Flexoes na parede registado por 10 min.",
    },
  ])("does not fall back to English for Movement exercise copy in $language", async ({ language, title, recommended, week, comfort, chair, more, group, wall, lastUsed, step, safety, logged }) => {
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
    await waitFor(() => expect(screen.getByTestId("movement-exercise-guide")).toHaveTextContent(wall));
    expect(screen.getByTestId("movement-exercise-guide-step")).toHaveTextContent(step);
    expect(screen.getByTestId("movement-exercise-guide-safety")).toHaveTextContent(safety);
    expect(screen.getByTestId("movement-exercise-guide-safety")).not.toHaveTextContent("Move gently.");

    fireEvent.click(screen.getByTestId("button-movement-guide-step-4"));
    fireEvent.click(screen.getByTestId("button-movement-guide-finish"));

    await waitFor(() => expect(screen.queryByTestId("movement-exercise-guide")).not.toBeInTheDocument());
    expect(screen.getByTestId("movement-room-exercise-logged-status")).toHaveTextContent(logged);
    expect(screen.getByTestId("movement-room-exercise-logged-status")).not.toHaveTextContent("logged for 10 min.");
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
  });
});
