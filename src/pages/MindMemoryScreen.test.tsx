import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MindMemoryScreen from "./MindMemoryScreen";

const guardPathMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  useServiceGate: () => ({
    guardPath: guardPathMock,
  }),
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({ label, testId, className }: { label?: string; testId?: string; className?: string }) => (
    <button type="button" data-testid={testId} className={className}>
      {label}
    </button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderMindMemory() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/mind-memory"]}>
      <Routes>
        <Route path="/mind-memory" element={<MindMemoryScreen />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MindMemoryScreen", () => {
  beforeEach(() => {
    guardPathMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the approved pillar layout", () => {
    renderMindMemory();

    expect(screen.getByTestId("mind-memory-master-hero")).toHaveTextContent("Mind check ready");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory")).toHaveTextContent("Strengthen Memory");
    expect(screen.getByTestId("card-mind-memory-train-reflexes")).toHaveTextContent("Train Reflexes");
    expect(screen.getByTestId("card-mind-memory-boost-focus")).toHaveTextContent("Boost Focus");
    expect(screen.getByTestId("card-mind-memory-sharpen-senses")).toHaveTextContent("Sharpen Senses");
    expect(screen.queryByTestId("card-mind-memory-sleep")).not.toBeInTheDocument();

    const fastHelp = screen.getByTestId("mind-memory-fast-help");
    expect(within(fastHelp).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("button-mind-memory-fast-relax-breathe")).toHaveTextContent("Relax Breathe");
    expect(screen.getByTestId("button-mind-memory-fast-learn-words")).toHaveTextContent("Learn Words");
    expect(screen.getByTestId("button-mind-memory-fast-cognitive-assessment")).toHaveTextContent("Cognitive Assessment");
  });

  it("uses existing cognitive routes", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-strengthen-memory"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/memory-games");
  });

  it("routes the reflexes card", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-train-reflexes"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/attention-boosters");
  });

  it("routes the thinking card", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-boost-focus"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/executive-function");
  });

  it("routes the senses card", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-sharpen-senses"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/senses");
  });

  it("routes calm breathing from fast help", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("button-mind-memory-fast-relax-breathe"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/activities/relax-breathe");
  });

  it("routes cognitive assessment from fast help", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("button-mind-memory-fast-cognitive-assessment"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/mind-memory/cognitive-assessment");
  });

  it("rotates through the full final Fast help set", () => {
    vi.useFakeTimers();
    renderMindMemory();

    expect(screen.getByTestId("button-mind-memory-fast-relax-breathe")).toHaveTextContent("Relax Breathe");
    expect(screen.getByTestId("button-mind-memory-fast-learn-words")).toHaveTextContent("Learn Words");
    expect(screen.getByTestId("button-mind-memory-fast-cognitive-assessment")).toHaveTextContent("Cognitive Assessment");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("button-mind-memory-fast-play-game")).toHaveTextContent("Play Game");
    expect(screen.getByTestId("button-mind-memory-fast-listen-closely")).toHaveTextContent("Listen Closely");
    expect(screen.getByTestId("button-mind-memory-fast-calm-focus")).toHaveTextContent("Calm Focus");
  });
});
