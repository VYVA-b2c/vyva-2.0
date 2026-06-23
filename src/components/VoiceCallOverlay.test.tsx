import { act } from "react";
import { render, screen } from "@testing-library/react";
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
  beforeEach(() => {
    vi.useFakeTimers();
    baseProps.onEnd.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows VYVA transcript one word at a time", () => {
    renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Hello");

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
