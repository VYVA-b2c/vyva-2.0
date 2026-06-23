import { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import VoiceCallOverlay from "./VoiceCallOverlay";
import type { TranscriptEntry } from "@/hooks/useVyvaVoice";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const baseProps = {
  isSpeaking: false,
  isConnecting: false,
  transcript: [] as TranscriptEntry[],
  onEnd: vi.fn(),
};

const canvasGradientMock = {
  addColorStop: vi.fn(),
};

const canvasContextMock = {
  clearRect: vi.fn(),
  save: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  clip: vi.fn(),
  createRadialGradient: vi.fn(() => canvasGradientMock),
  fillRect: vi.fn(),
  fill: vi.fn(),
  restore: vi.fn(),
  setTransform: vi.fn(),
};

const canvasMocks = [
  canvasGradientMock.addColorStop,
  canvasContextMock.clearRect,
  canvasContextMock.save,
  canvasContextMock.beginPath,
  canvasContextMock.arc,
  canvasContextMock.clip,
  canvasContextMock.createRadialGradient,
  canvasContextMock.fillRect,
  canvasContextMock.fill,
  canvasContextMock.restore,
  canvasContextMock.setTransform,
];

function renderOverlay(transcript: TranscriptEntry[], props: Partial<typeof baseProps> = {}) {
  return render(
    <VoiceCallOverlay
      {...baseProps}
      {...props}
      transcript={transcript}
    />,
  );
}

describe("VoiceCallOverlay word transcript", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const originalResizeObserver = window.ResizeObserver;

  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => canvasContextMock),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: vi.fn((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16)),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: vi.fn((timerId: number) => window.clearTimeout(timerId)),
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: class ResizeObserverMock {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: originalGetContext,
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalCancelAnimationFrame,
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: originalResizeObserver,
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    baseProps.onEnd.mockClear();
    canvasMocks.forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows VYVA transcript one word at a time", () => {
    renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Hello");
    expect(screen.getByTestId("text-call-transcript")).toHaveClass("font-body");
    expect(screen.getByTestId("text-call-transcript")).not.toHaveClass("font-display");
    expect(screen.getByTestId("voice-mode-zamora-orb")).toBeInTheDocument();
    expect(screen.getByTestId("voice-indicator-zamora-orb")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Karim");
  });

  it("does not animate user transcript as the large word transcript", () => {
    renderOverlay([{ from: "user", text: "Hello VYVA", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("voiceHero.listening");
    expect(screen.queryByTestId("text-call-speaker")).not.toBeInTheDocument();
  });

  it("resets playback when a new VYVA transcript arrives", () => {
    const { rerender } = renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }]);

    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Karim");

    act(() => {
      rerender(
        <VoiceCallOverlay
          {...baseProps}
          transcript={[{ from: "vyva", text: "Welcome back", timestamp: 2 }]}
        />,
      );
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Welcome");
  });

  it("keeps the connecting fallback when no VYVA transcript is available", () => {
    renderOverlay([], { isConnecting: true });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("voiceHero.connecting");
  });

  it("keeps long words contained with responsive transcript styles", () => {
    renderOverlay([{ from: "vyva", text: "Supercalifragilisticexpialidocious", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveStyle({
      fontSize: "clamp(56px, 16vw, 118px)",
      maxWidth: "90vw",
      overflowWrap: "anywhere",
    });
  });
});
