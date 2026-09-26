import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdvisorChat, { buildSeniorHomeFinderShareSummary } from "./AdvisorChat";
import type { AdvisorSessionResponse } from "../../shared/advisors";

const queryMock = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());
const startVoiceMock = vi.hoisted(() => vi.fn());
const stopVoiceMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => queryMock(),
  };
});

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    startVoice: startVoiceMock,
    stopVoice: stopVoiceMock,
    status: "idle",
    isSpeaking: false,
    isConnecting: false,
    transcript: [],
  }),
}));

const ui = {
  backToCommunity: "Back to Community",
  eyebrow: "MY EXPERTS",
  title: "Choose an expert",
  instruction: "Tap an expert to talk.",
  loading: "Preparing your experts...",
  empty: "Your experts are not available right now.",
  neverTalked: "Never talked",
  today: "Today",
  yesterday: "Yesterday",
  daysAgo: (days: number) => `${days} days ago`,
  lastWeek: "Last week",
  startTalking: "Start talking",
  inputPlaceholder: "Write a message...",
  send: "Send",
  micIdle: "Talk by voice",
  micListening: "Listening",
  retry: "Try again",
  sendError: "Could not send. Try again.",
  disclaimerLabel: "Important note",
};

const noraSession: AdvisorSessionResponse = {
  language: "en",
  ui,
  advisor: {
    slug: "nora",
    name: "Nora",
    role: "Nutrition",
    shortRole: "Meals",
    intro: "Hi, I am Nora. I can help with simple meal ideas.",
    starter: "What would you like help planning today?",
    disclaimerText: "Nora shares general food and wellbeing information, not medical advice.",
    sortOrder: 10,
    iconKey: "nutrition",
    chipBg: "#E4F3E7",
    iconColor: "#3F8752",
    recencyLabel: "Never talked",
    sessionCount: 0,
    lastMessageAt: null,
  },
  introRequired: true,
  session: null,
  messages: [],
};

const amaraSession: AdvisorSessionResponse = {
  language: "en",
  ui,
  advisor: {
    slug: "amara",
    name: "Wellness",
    role: "Coach",
    shortRole: "Movement and calm",
    intro: "Movement, breathing, energy, and balance.",
    starter: "Pick a gentle wellness routine.",
    disclaimerText: "Stop if you feel pain, dizzy, or short of breath.",
    sortOrder: 5,
    iconKey: "coach",
    chipBg: "#E8F7EF",
    iconColor: "#0A7C4E",
    recencyLabel: "Never talked",
    sessionCount: 0,
    lastMessageAt: null,
  },
  introRequired: true,
  session: null,
  messages: [],
};

const sabioSession: AdvisorSessionResponse = {
  language: "en",
  ui,
  advisor: {
    slug: "sabio",
    name: "Sabio",
    role: "Research",
    shortRole: "Questions",
    intro: "I can help you compare suitable senior living options.",
    starter: "What matters most to you in a possible new home?",
    disclaimerText: "Sabio gives general information; verify details with each provider.",
    sortOrder: 40,
    iconKey: "research",
    chipBg: "#E3EDF7",
    iconColor: "#3C6E9E",
    recencyLabel: "Never talked",
    sessionCount: 1,
    lastMessageAt: "2026-07-07T10:00:00.000Z",
  },
  introRequired: false,
  session: { id: "sabio-session-1", status: "active", startedAt: "2026-07-07T10:00:00.000Z", lastMessageAt: "2026-07-07T10:02:00.000Z" },
  messages: [
    { id: "m1", role: "user", text: "Can you compare two homes near Madrid?", source: "text", createdAt: "2026-07-07T10:01:00.000Z" },
    { id: "m2", role: "assistant", text: "Willow Court and Oak Gardens both accept visits this week.", source: "text", createdAt: "2026-07-07T10:02:00.000Z" },
  ],
};

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <div data-testid="route-state">{JSON.stringify(location.state ?? null)}</div>
    </>
  );
}

function renderChat(initialPath: string | { pathname: string; state?: unknown } = "/social-rooms/experts/nora") {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialPath]}>
      <Routes>
        <Route path="/social-rooms/experts" element={<LocationProbe />} />
        <Route path="/social-rooms/experts/:agentSlug" element={<><AdvisorChat /><LocationProbe /></>} />
        <Route path="/social-rooms/morning-movement" element={<LocationProbe />} />
        <Route path="/social-rooms/morning-movement/exercises/:exerciseId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdvisorChat", () => {
  beforeEach(() => {
    queryMock.mockReset();
    apiFetchMock.mockReset();
    startVoiceMock.mockReset();
    stopVoiceMock.mockReset();
    queryMock.mockReturnValue({
      data: noraSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the first-session intro, starts a session, and opens voice with advisor context", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: "session-1",
          status: "active",
          startedAt: "2026-07-07T10:00:00.000Z",
          lastMessageAt: "2026-07-07T10:00:00.000Z",
        },
      }),
    });

    renderChat();

    expect(screen.getByTestId("advisor-intro")).toHaveTextContent("Nutrition Expert");
    expect(screen.getByRole("button", { name: /Voice chat/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Text chat/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("advisor-intro")).toHaveTextContent("I can help with meals, appetite and hydration.");
    expect(screen.queryByText("How would you like to talk today?")).not.toBeInTheDocument();
    expect(screen.queryByTestId("advisor-disclaimer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-advisor-start-voice"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/advisors/nora/sessions?lang=en", expect.objectContaining({ method: "POST" }));
    });
    expect(startVoiceMock).toHaveBeenCalledWith(
      expect.stringContaining("Nutrition Expert"),
      expect.stringContaining("shopping-friendly substitutions"),
      expect.objectContaining({
        agentSlug: "nora",
        dynamicVariables: expect.objectContaining({ app_entrypoint: "ask_an_expert_chat" }),
      }),
    );
  });

  it("shows a message field immediately without a Text chat entry card", () => {
    renderChat();
    const input = screen.getByTestId("input-advisor-message");
    expect(input).toBeInTheDocument();
    expect(screen.queryByTestId("button-advisor-start-chat")).not.toBeInTheDocument();
    expect(startVoiceMock).not.toHaveBeenCalled();
  });

  it("sends typed messages and shows user plus assistant bubbles", async () => {
    queryMock.mockReturnValue({
      data: {
        ...noraSession,
        introRequired: false,
        session: {
          id: "session-1",
          status: "active",
          startedAt: "2026-07-07T10:00:00.000Z",
          lastMessageAt: null,
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        session: {
          id: "session-1",
          status: "active",
          startedAt: "2026-07-07T10:00:00.000Z",
          lastMessageAt: "2026-07-07T10:02:00.000Z",
        },
        userMessage: {
          id: "message-user",
          role: "user",
          text: "Can you help with dinner?",
          source: "text",
          createdAt: "2026-07-07T10:01:00.000Z",
        },
        assistantMessage: {
          id: "message-assistant",
          role: "assistant",
          text: "Yes. Tell me what you have at home.",
          source: "text",
          createdAt: "2026-07-07T10:02:00.000Z",
        },
        advisor: noraSession.advisor,
      }),
    });

    renderChat();

    fireEvent.change(screen.getByTestId("input-advisor-message"), {
      target: { value: "Can you help with dinner?" },
    });
    fireEvent.click(screen.getByTestId("button-advisor-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/advisors/nora/messages?lang=en", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "Can you help with dinner?", sessionId: "session-1", source: "text" }),
      }));
    });

    expect(await screen.findByText("Can you help with dinner?")).toBeInTheDocument();
    expect(screen.getByText("Yes. Tell me what you have at home.")).toBeInTheDocument();
  });

  it("prefills a validated starter handoff from Benefits Navigator", () => {
    queryMock.mockReturnValue({
      data: { ...noraSession, introRequired: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderChat("/social-rooms/experts/nora?starter=Please%20explain%20housing%20benefit");

    expect(screen.getByTestId("input-advisor-message")).toHaveValue("Please explain housing benefit");
  });

  it("shows a hand-off message from router state instead of the static intro on a fresh advisor", () => {
    queryMock.mockReturnValue({
      data: noraSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderChat({
      pathname: "/social-rooms/experts/nora",
      state: { handoffMessage: "I can see you were looking at \"Housing benefit\". What would you like to know?" },
    });

    expect(screen.getByTestId("advisor-intro")).toHaveTextContent(
      "I can see you were looking at \"Housing benefit\". What would you like to know?",
    );
    expect(screen.getByTestId("advisor-intro")).not.toHaveTextContent("I can help with meals, appetite and hydration.");
  });

  it("shows a hand-off message as the opening bubble when returning to an advisor with no messages yet", () => {
    queryMock.mockReturnValue({
      data: { ...noraSession, introRequired: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderChat({
      pathname: "/social-rooms/experts/nora",
      state: { handoffMessage: "Marta sent you here to double check a benefit." },
    });

    expect(screen.getByTestId("advisor-message-assistant")).toHaveTextContent(
      "Marta sent you here to double check a benefit.",
    );
  });

  it("renders the backend movement coach with touch routine shortcuts", async () => {
    queryMock.mockReturnValue({
      data: amaraSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderChat("/social-rooms/experts/amara");

    expect(screen.getByRole("heading", { name: "Wellness Coach" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voice guide/i })).toBeInTheDocument();
    expect(screen.queryByTestId("button-advisor-start-chat")).not.toBeInTheDocument();
    expect(screen.queryByText(/Text guidance/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("movement-coach-routines")).toHaveTextContent("Pick a routine");
    expect(screen.getByTestId("button-movement-coach-routine-chair-yoga")).toBeInTheDocument();
    expect(screen.getByTestId("button-movement-coach-routine-tai-chi")).toBeInTheDocument();
    expect(screen.getByTestId("button-movement-coach-routine-sit-to-stand")).toBeInTheDocument();
    expect(screen.getByTestId("button-movement-coach-routine-calm-breathing")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-movement-coach-routine-chair-yoga"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/morning-movement/exercises/chair-yoga");
    expect(screen.getByTestId("route-state")).toHaveTextContent("autoStartVoiceGuide");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("starts the movement coach through the advisor API with voice context", async () => {
    queryMock.mockReturnValue({
      data: amaraSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: "amara-session-1",
          status: "active",
          startedAt: "2026-07-07T10:00:00.000Z",
          lastMessageAt: "2026-07-07T10:00:00.000Z",
        },
      }),
    });

    renderChat("/social-rooms/experts/amara");

    fireEvent.click(screen.getByTestId("button-advisor-start-voice"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/advisors/amara/sessions?lang=en", expect.objectContaining({ method: "POST" }));
      expect(startVoiceMock).toHaveBeenCalledWith(
        expect.stringContaining("Wellness Coach hub"),
        expect.stringContaining("chair yoga"),
        expect.objectContaining({
          agentSlug: "wellness",
          dynamicVariables: expect.objectContaining({
            advisor_slug: "amara",
            app_entrypoint: "wellness_coach_hub",
            visible_screen: "wellness_routine_picker",
            session_state: "routine_picker",
          }),
        }),
      );
    });
  });

  it("only shows the shortlist share button for Sabio once there is an assistant reply", () => {
    queryMock.mockReturnValue({ data: noraSession, isLoading: false, isError: false, refetch: vi.fn() });
    renderChat("/social-rooms/experts/nora");
    expect(screen.queryByTestId("button-advisor-share-shortlist")).not.toBeInTheDocument();
    cleanup();

    queryMock.mockReturnValue({
      data: { ...sabioSession, messages: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderChat("/social-rooms/experts/sabio");
    expect(screen.queryByTestId("button-advisor-share-shortlist")).not.toBeInTheDocument();
    cleanup();

    queryMock.mockReturnValue({ data: sabioSession, isLoading: false, isError: false, refetch: vi.fn() });
    renderChat("/social-rooms/experts/sabio");
    expect(screen.getByTestId("button-advisor-share-shortlist")).toBeInTheDocument();
  });

  it("creates a share link from the assistant's own messages and copies it when Web Share is unavailable", async () => {
    queryMock.mockReturnValue({ data: sabioSession, isLoading: false, isError: false, refetch: vi.fn() });
    apiFetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: "share-token-1" }) });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.stubGlobal("navigator", { ...navigator, share: undefined });

    renderChat("/social-rooms/experts/sabio");
    fireEvent.click(screen.getByTestId("button-advisor-share-shortlist"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/advisors/sabio/share", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Sabio", language: "en", summary: "Willow Court and Oak Gardens both accept visits this week." }),
      }));
    });
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/shared/senior-home/share-token-1"));
    });
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });
});

describe("buildSeniorHomeFinderShareSummary", () => {
  it("joins only the assistant's own messages, not the user's", () => {
    const summary = buildSeniorHomeFinderShareSummary([
      { id: "1", role: "user", text: "Compare two homes", source: "text", createdAt: "2026-07-07T10:00:00.000Z" },
      { id: "2", role: "assistant", text: "Willow Court is nearby.", source: "text", createdAt: "2026-07-07T10:01:00.000Z" },
      { id: "3", role: "assistant", text: "Oak Gardens has availability.", source: "text", createdAt: "2026-07-07T10:02:00.000Z" },
    ]);
    expect(summary).toBe("Willow Court is nearby.\n\nOak Gardens has availability.");
  });

  it("returns an empty string with no assistant messages", () => {
    expect(buildSeniorHomeFinderShareSummary([])).toBe("");
  });
});
