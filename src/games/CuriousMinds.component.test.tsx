import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import CuriousMinds, { getDefaultCuriousMindsUserState } from "./CuriousMinds";

const supabaseMock = vi.hoisted(() => {
  const queue: Array<{ data: unknown; error: unknown }> = [];
  const from = vi.fn(() => {
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.gte = vi.fn(() => query);
    query.lt = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    query.insert = vi.fn((payload) => {
      query.payload = payload;
      return query;
    });
    query.upsert = vi.fn((payload) => {
      query.payload = payload;
      return query;
    });
    query.single = vi.fn(() => Promise.resolve(queue.shift() ?? { data: query.payload, error: null }));
    query.maybeSingle = vi.fn(() => Promise.resolve(queue.shift() ?? { data: null, error: null }));
    query.then = (onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? { data: [], error: null }).then(onfulfilled, onrejected);
    return query;
  });

  return { from, queue };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

vi.mock("./shared/brainCoachSessions", () => ({
  recordCognitiveSession: vi.fn().mockResolvedValue({ persisted: true }),
}));

vi.mock("@/games/memory/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isSupported: false,
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

describe("Curious Minds component", () => {
  beforeEach(() => {
    setLanguage("en");
    supabaseMock.queue.length = 0;
    supabaseMock.from.mockClear();
    Object.defineProperty(window, "innerWidth", { writable: true, value: 768 });
  });

  it("loads reviewed hook and prompt content into the first input screen", async () => {
    supabaseMock.queue.push(
      { data: getDefaultCuriousMindsUserState("user-1"), error: null },
      {
        data: [{
          id: "hook-1",
          fact_prompt: "Why do flamingos often stand on one leg?",
          fact_answer: "It helps them rest while using less energy.",
          category: "animals",
          language: "en",
          is_active: true,
        }],
        error: null,
      },
      {
        data: [{
          id: "prompt-1",
          prompt_type: "alternate_uses",
          prompt_text: "How many different uses can you think of for an umbrella, besides rain?",
          topic: "umbrella",
          language: "en",
          is_active: true,
        }],
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
    );

    render(<CuriousMinds userId="user-1" onExit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Why do flamingos often stand on one leg?" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your guess...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
