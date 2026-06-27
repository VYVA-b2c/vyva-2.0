import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import CuriousMinds, { getDefaultCuriousMindsUserState } from "./CuriousMinds";

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

describe("Curious Minds component", () => {
  beforeEach(() => {
    setLanguage("en");
    apiFetchMock.mockReset();
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", { writable: true, value: 768 });
  });

  it("loads reviewed hook and prompt content into the first input screen", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      state: getDefaultCuriousMindsUserState("user-1"),
      hook: {
        id: "hook-1",
        fact_prompt: "Why do flamingos often stand on one leg?",
        fact_answer: "It helps them rest while using less energy.",
        category: "animals",
        language: "en",
        is_active: true,
      },
      prompt: {
        id: "prompt-1",
        prompt_type: "alternate_uses",
        prompt_text: "How many different uses can you think of for an umbrella, besides rain?",
        topic: "umbrella",
        language: "en",
        is_active: true,
      },
    }), { status: 200 }));

    window.localStorage.setItem("curiousMinds:tutorialSeen:v1:user-1", "true");

    render(<CuriousMinds userId="user-1" onExit={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Why do flamingos often stand on one leg?" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your guess...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("shows the tutorial once and reopens it from Instructions", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      state: getDefaultCuriousMindsUserState("user-1"),
      hook: {
        id: "hook-1",
        fact_prompt: "Why do flamingos often stand on one leg?",
        fact_answer: "It helps them rest while using less energy.",
        category: "animals",
        language: "en",
        is_active: true,
      },
      prompt: {
        id: "prompt-1",
        prompt_type: "alternate_uses",
        prompt_text: "How many different uses can you think of for an umbrella, besides rain?",
        topic: "umbrella",
        language: "en",
        is_active: true,
      },
    }), { status: 200 }));

    render(<CuriousMinds userId="user-1" onExit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "How it works" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I understand" }));

    expect(window.localStorage.getItem("curiousMinds:tutorialSeen:v1:user-1")).toBe("true");
    expect(await screen.findByRole("heading", { name: "Why do flamingos often stand on one leg?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Instructions" }));

    expect(await screen.findByRole("heading", { name: "How it works" })).toBeInTheDocument();
  });
});
