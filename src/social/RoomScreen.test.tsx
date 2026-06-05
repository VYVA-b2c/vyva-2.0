import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RoomScreen from "./RoomScreen";
import type { SocialRoomResponse } from "./types";

const languageMock = vi.hoisted(() => ({ language: "en" }));
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
    startVoice: vi.fn(),
    stopVoice: vi.fn(),
    sendText: vi.fn(),
    sendContextUpdate: vi.fn(),
    status: "idle",
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
        <Route path="/social-rooms/:slug" element={<RoomScreen />} />
        <Route path="/activity" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

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

  it("starts a gentle exercise session from a Movement room card", async () => {
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

    expect(screen.queryByTestId("current-route")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Chair yoga");
    expect(screen.getByRole("dialog")).toHaveTextContent("Session started");
    expect(screen.getByTestId("movement-room-exercise-session-steps")).toHaveTextContent("Sit tall with both feet flat.");
    expect(screen.getByTestId("movement-room-exercise-safety")).toHaveTextContent("Move gently. Stop if you feel pain, dizzy, or short of breath.");

    fireEvent.click(screen.getByTestId("button-finish-movement-room-exercise-chair-yoga"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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

  it("repeats the last Movement room exercise from My gentle week", async () => {
    localStorage.setItem("vyva_movement_last_exercise_id", "tai-chi");
    renderRoom();

    expect(screen.getByTestId("movement-room-exercise-card-tai-chi")).toHaveTextContent("Last used");
    expect(screen.getByTestId("movement-room-gentle-week")).toHaveTextContent("Last time: Tai chi");
    expect(screen.getByTestId("button-movement-room-repeat-exercise")).toHaveTextContent("Last time: Tai chi");

    fireEvent.click(screen.getByTestId("button-movement-room-repeat-exercise"));

    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("Session started"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Tai chi");
  });

  it("saves comfort level and opens a one-tap swap exercise", async () => {
    renderRoom();

    fireEvent.click(screen.getByTestId("button-movement-room-comfort-seated"));

    expect(localStorage.getItem("vyva_movement_comfort_level")).toBe("seated");

    fireEvent.click(screen.getByTestId("button-movement-room-swap-calm"));

    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("Calm breathing"));
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

    expect(screen.getByRole("dialog")).toHaveTextContent("Wall push-ups");
    expect(screen.getByTestId("movement-room-exercise-session-steps")).toHaveTextContent("Stand an arm's length from a wall.");

    fireEvent.click(screen.getByTestId("button-finish-movement-room-exercise-wall-push-ups"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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
    expect(screen.getByRole("dialog")).toHaveTextContent(wall);
    expect(screen.getByTestId("movement-room-exercise-session-steps")).toHaveTextContent(step);
    expect(screen.getByTestId("movement-room-exercise-safety")).toHaveTextContent(safety);
    expect(screen.getByTestId("movement-room-exercise-safety")).not.toHaveTextContent("Move gently.");

    fireEvent.click(screen.getByTestId("button-finish-movement-room-exercise-wall-push-ups"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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
