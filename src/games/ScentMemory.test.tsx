import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import ScentMemory, { getDefaultScentMemoryUserState } from "./ScentMemory";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/games/memory/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isSupported: false,
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

function contentResponse() {
  return new Response(JSON.stringify({
    state: getDefaultScentMemoryUserState("user-1"),
    prompt: {
      id: "11111111-1111-4111-8111-111111111111",
      scent_name: "fresh bread",
      scent_description: "Imagine the warm smell from an oven just opened.",
      guiding_question: "Does it bring back a place or moment?",
      category: "food",
      language: "en",
      is_active: true,
    },
  }), { status: 200 });
}

function saveResponse() {
  return new Response(JSON.stringify({
    session: { id: "session-1" },
    state: {
      ...getDefaultScentMemoryUserState("user-1"),
      total_sessions: 1,
      streak_days: 1,
    },
  }), { status: 201 });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ScentMemory component", () => {
  beforeEach(() => {
    setLanguage("en");
    vi.useFakeTimers();
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValueOnce(contentResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads a reviewed scent prompt and reveals the question after a short pause", async () => {
    render(<ScentMemory userId="user-1" onExit={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("fresh bread")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tell me what you remember...")).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByPlaceholderText("Tell me what you remember...")).not.toBeDisabled();
  });

  it("saves a completed response and shows a warm close state", async () => {
    apiFetchMock.mockResolvedValueOnce(saveResponse());

    render(<ScentMemory userId="user-1" onExit={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("fresh bread")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    fireEvent.change(screen.getByPlaceholderText("Tell me what you remember..."), {
      target: { value: "It reminds me of Saturday mornings." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await flushPromises();

    expect(screen.getByRole("heading", { name: "Thanks for sharing that." })).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/games/scent-memory/sessions", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("It reminds me of Saturday mornings."),
    }));
  });

  it("allows skip without blocking completion", async () => {
    apiFetchMock.mockResolvedValueOnce(saveResponse());

    render(<ScentMemory userId="user-1" onExit={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("fresh bread")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await flushPromises();

    expect(screen.getByRole("heading", { name: "Thanks for sharing that." })).toBeInTheDocument();
    const sessionCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/games/scent-memory/sessions");
    expect(JSON.parse(String(sessionCall?.[1]?.body))).toMatchObject({
      responseText: null,
      completed: true,
      abandoned: false,
    });
  });
});
