import { act, fireEvent, render, screen } from "@testing-library/react";
import { VoiceCanvasProvider, useVoiceCanvasContext, voiceCanvasStateReducer } from "./VoiceCanvasContext";
import {
  emitVoiceCanvasScene,
  VYVA_VOICE_CANVAS_RESPONSE_EVENT,
  type VoiceCanvasSceneEnvelope,
} from "@/lib/voiceCanvasBridge";
import { emitVoiceUserMessage } from "@/lib/voiceNavigation";

const sendText = vi.fn();

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({ sendText }),
}));

const firstScene: VoiceCanvasSceneEnvelope = {
  owner: "concierge_ride",
  revision: 1,
  viewModel: { sceneId: "ride-destination", kind: "place", title: "Where are you going?" },
};

function Harness() {
  const { activeScene, submitResponse } = useVoiceCanvasContext();
  return (
    <div>
      <span data-testid="scene">{activeScene?.viewModel.sceneId ?? "none"}</span>
      <button type="button" onClick={() => submitResponse({
        kind: "choice",
        choiceId: "saved-home",
        utterance: "Use my saved home address",
      })}>Answer</button>
    </div>
  );
}

describe("VoiceCanvasProvider", () => {
  beforeEach(() => sendText.mockReset());

  it("publishes the touch response before sending the same answer to voice", () => {
    const order: string[] = [];
    const responseListener = () => order.push("route");
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, responseListener);
    sendText.mockImplementation(() => {
      order.push("voice");
      return true;
    });
    render(<VoiceCanvasProvider><Harness /></VoiceCanvasProvider>);

    act(() => emitVoiceCanvasScene(firstScene));
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));

    expect(order).toEqual(["route", "voice"]);
    expect(sendText).toHaveBeenCalledWith("Use my saved home address", { invisibleInTranscript: true });
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, responseListener);
  });

  it("still publishes a route answer when voice is disconnected", () => {
    sendText.mockReturnValue(false);
    const received = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
    render(<VoiceCanvasProvider><Harness /></VoiceCanvasProvider>);

    act(() => emitVoiceCanvasScene(firstScene));
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));

    expect(received).toHaveBeenCalledTimes(1);
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
  });

  it("routes a spoken answer through the active scene like a touch answer", () => {
    const received = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
    render(<VoiceCanvasProvider><Harness /></VoiceCanvasProvider>);
    act(() => emitVoiceCanvasScene({
      ...firstScene,
      viewModel: {
        ...firstScene.viewModel,
        choices: [{ id: "saved_home", label: "Saved home" }],
      },
    }));

    act(() => emitVoiceUserMessage({ text: "Saved home", at: "2026-07-18T10:00:00.000Z" }));

    expect(received).toHaveBeenCalledTimes(1);
    expect((received.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      sceneId: "ride-destination",
      revision: 1,
      kind: "choice",
      choiceId: "saved_home",
      value: "Saved home",
    });
    expect(sendText).not.toHaveBeenCalled();
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
  });

  it("does not route the voice echo of a touch answer twice", () => {
    const received = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
    render(<VoiceCanvasProvider><Harness /></VoiceCanvasProvider>);
    act(() => emitVoiceCanvasScene(firstScene));

    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    act(() => emitVoiceUserMessage({ text: "Use my saved home address", at: "2026-07-18T10:00:00.000Z" }));

    expect(received).toHaveBeenCalledTimes(1);
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
  });

  it("does not let an older revision replace the current scene", () => {
    const state = { activeScene: { ...firstScene, revision: 3 } };
    const next = voiceCanvasStateReducer(state, {
      type: "present",
      scene: {
        ...firstScene,
        revision: 2,
        viewModel: { ...firstScene.viewModel, sceneId: "ride-pickup" },
      },
    });

    expect(next).toBe(state);
    expect(next.activeScene?.revision).toBe(3);
  });
});
