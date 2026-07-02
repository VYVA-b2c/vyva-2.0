import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
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

  it("renders the approved pillar layout", () => {
    renderMindMemory();

    expect(screen.getByTestId("mind-memory-master-hero")).toHaveTextContent("Mind check ready");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory")).toHaveTextContent("Strengthen Memory");
    expect(screen.getByTestId("card-mind-memory-train-reflexes")).toHaveTextContent("Train Reflexes");
    expect(screen.getByTestId("card-mind-memory-improve-thinking")).toHaveTextContent("Improve Thinking");
    expect(screen.getByTestId("card-mind-memory-sharpen-senses")).toHaveTextContent("Sharpen Senses");
    expect(screen.queryByTestId("card-mind-memory-sleep")).not.toBeInTheDocument();

    const fastHelp = screen.getByTestId("mind-memory-fast-help");
    expect(within(fastHelp).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("button-mind-memory-fast-confusion-now")).toHaveTextContent("Confusion now");
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

    fireEvent.click(screen.getByTestId("card-mind-memory-improve-thinking"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/executive-function");
  });

  it("routes the senses card", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-sharpen-senses"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/senses");
  });

  it("pins urgent confusion help to the doctor support flow", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("button-mind-memory-fast-confusion-now"));

    expect(guardPathMock).toHaveBeenCalledWith("/health/doctor", expect.objectContaining({
      state: expect.objectContaining({ autoStartVoice: true }),
    }));
  });
});
