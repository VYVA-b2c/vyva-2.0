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

function renderRoom() {
  render(
    <MemoryRouter initialEntries={["/social-rooms/morning-movement"]}>
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
    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent("Browse all 12 photo-led routines");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent("Chair yoga");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent("Tai chi");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent("Seated strength");
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent("Calm breathing");
    expect(screen.getAllByTestId(/^movement-room-exercise-card-/)).toHaveLength(4);

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

    const logCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/activity/log");
    expect(logCall).toBeTruthy();
    expect(logCall?.[1]).toEqual(expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ activity_type: "ChairYoga", duration_minutes: 10 }),
    }));
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
      chair: "Yoga sur chaise",
      more: "Plus d'exercices doux",
      group: "Force",
      wall: "Pompes au mur",
      step: "Placez-vous a une longueur de bras du mur.",
      safety: "Bougez doucement.",
      logged: "Pompes au mur note pendant 10 min.",
    },
    {
      language: "it",
      title: "Scegli un'attivita dolce",
      chair: "Yoga sulla sedia",
      more: "Altri esercizi dolci",
      group: "Forza",
      wall: "Piegamenti al muro",
      step: "Mettiti a un braccio di distanza dal muro.",
      safety: "Muoviti con dolcezza.",
      logged: "Piegamenti al muro registrato per 10 min.",
    },
    {
      language: "pt",
      title: "Escolha uma atividade suave",
      chair: "Ioga na cadeira",
      more: "Mais exercicios suaves",
      group: "Forca",
      wall: "Flexoes na parede",
      step: "Fique a distancia de um braco da parede.",
      safety: "Movimente-se suavemente.",
      logged: "Flexoes na parede registado por 10 min.",
    },
  ])("does not fall back to English for Movement exercise copy in $language", async ({ language, title, chair, more, group, wall, step, safety, logged }) => {
    languageMock.language = language;
    renderRoom();

    expect(screen.getByTestId("movement-room-exercise-library")).toHaveTextContent(title);
    expect(screen.getByTestId("movement-room-exercise-cards")).toHaveTextContent(chair);
    expect(screen.getByTestId("movement-room-exercise-library")).not.toHaveTextContent("Choose a gentle activity");
    expect(screen.getByTestId("movement-room-exercise-cards")).not.toHaveTextContent("Chair yoga");

    fireEvent.click(screen.getByTestId("button-movement-room-browse-exercises"));
    expect(screen.getByTestId("movement-room-expanded-exercise-library")).toHaveTextContent(more);

    fireEvent.click(screen.getByTestId("movement-room-exercise-filter-strength"));
    expect(screen.getByTestId("movement-room-exercise-group-strength")).toHaveTextContent(group);
    expect(screen.getByTestId("movement-room-extra-exercise-cards")).toHaveTextContent(wall);
    expect(screen.getByTestId("movement-room-extra-exercise-cards")).not.toHaveTextContent("Wall push-ups");

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
