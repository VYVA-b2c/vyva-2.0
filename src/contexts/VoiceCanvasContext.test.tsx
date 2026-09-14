import { act, fireEvent, render, screen } from "@testing-library/react";
import { VoiceCanvasProvider, useVoiceCanvasContext, voiceCanvasStateReducer } from "./VoiceCanvasContext";
import {
  emitVoiceCanvasScene,
  VYVA_VOICE_CANVAS_RESPONSE_EVENT,
  type VoiceCanvasSceneEnvelope,
} from "@/lib/voiceCanvasBridge";
import { emitVoiceUserMessage, VYVA_VOICE_USER_MESSAGE_EVENT } from "@/lib/voiceNavigation";

const sendText = vi.fn();

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({ sendText }),
}));

const firstScene: VoiceCanvasSceneEnvelope = {
  owner: "concierge_ride",
  revision: 1,
  viewModel: { sceneId: "ride-destination", kind: "place", title: "Where are you going?" },
};

const healthScene: VoiceCanvasSceneEnvelope = {
  owner: "health_preventive_check",
  flowReference: "health.preventive_check",
  questionId: "health.preventive_check.energy",
  sceneInstanceId: "health-session-a",
  revision: 2,
  viewModel: {
    sceneId: "health.preventive_check.energy",
    kind: "choice",
    title: "How much energy do you have today?",
    choices: [{ id: "3", label: "Normal" }],
  },
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

  it("keeps legacy non-Health spoken routing when raw voice provenance is absent", () => {
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

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: { text: "Saved home", at: "2026-07-18T10:00:00.000Z" },
      }));
    });

    expect(received).toHaveBeenCalledTimes(1);
    expect((received.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      sceneId: "ride-destination",
      revision: 1,
      kind: "choice",
      choiceId: "saved_home",
    });
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
  });

  it("fails closed instead of stamping current Health scene identity when raw voice provenance is absent", () => {
    const received = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
    render(<VoiceCanvasProvider><Harness /></VoiceCanvasProvider>);
    act(() => emitVoiceCanvasScene(healthScene));

    act(() => emitVoiceUserMessage({ text: "Normal", at: "2026-08-07T10:00:00.000Z" }));

    expect(received).not.toHaveBeenCalled();
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
  });

  it("uses immutable Health provenance rather than rebinding delayed raw voice to the current Health scene", () => {
    const received = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
    render(<VoiceCanvasProvider><Harness /></VoiceCanvasProvider>);
    act(() => emitVoiceCanvasScene(healthScene));
    const staleProvenance = {
      owner: "health_preventive_check" as const,
      sceneId: healthScene.viewModel.sceneId,
      revision: healthScene.revision,
      flowReference: healthScene.flowReference,
      questionId: healthScene.questionId,
      sceneInstanceId: healthScene.sceneInstanceId,
    };
    act(() => emitVoiceCanvasScene({
      ...healthScene,
      questionId: "health.preventive_check.mood",
      sceneInstanceId: "health-session-a",
      revision: 3,
      viewModel: {
        sceneId: "health.preventive_check.mood",
        kind: "choice",
        title: "How is your mood?",
        choices: [{ id: "happy", label: "Happy" }],
      },
    }));

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text: "Normal",
          at: "2026-08-07T10:00:01.000Z",
          canvasProvenance: staleProvenance,
        },
      }));
    });

    expect(received).toHaveBeenCalledTimes(1);
    expect((received.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      sceneId: "health.preventive_check.energy",
      revision: 2,
      questionId: "health.preventive_check.energy",
      sceneInstanceId: "health-session-a",
      kind: "text",
      value: "Normal",
    });
    expect((received.mock.calls[0][0] as CustomEvent).detail.choiceId).toBeUndefined();
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
  });

  it("routes a spoken option-card alias through the active scene", () => {
    const received = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
    render(<VoiceCanvasProvider><Harness /></VoiceCanvasProvider>);
    act(() => emitVoiceCanvasScene({
      ...firstScene,
      viewModel: {
        ...firstScene.viewModel,
        blocks: [{
          kind: "option-card",
          id: "ride:carecab",
          title: "CareCab",
          subtitle: "Best reputation",
          voiceAliases: ["recommended ride"],
        }],
      },
    }));

    act(() => emitVoiceUserMessage({ text: "recommended ride", at: "2026-07-18T10:00:00.000Z" }));

    expect(received).toHaveBeenCalledTimes(1);
    expect((received.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      sceneId: "ride-destination",
      revision: 1,
      kind: "choice",
      choiceId: "ride:carecab",
      value: "CareCab",
    });
    expect(sendText).not.toHaveBeenCalled();
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
  });

  it("does not allow voice to select disabled option-card blocks", () => {
    const received = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
    render(<VoiceCanvasProvider><Harness /></VoiceCanvasProvider>);
    act(() => emitVoiceCanvasScene({
      ...firstScene,
      viewModel: {
        ...firstScene.viewModel,
        blocks: [{
          kind: "option-card",
          id: "ride:disabled",
          title: "Unavailable provider",
          disabled: true,
          voiceAliases: ["unavailable ride"],
        }],
      },
    }));

    act(() => emitVoiceUserMessage({ text: "unavailable ride", at: "2026-07-18T10:00:00.000Z" }));

    expect(received).toHaveBeenCalledTimes(1);
    expect((received.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      kind: "text",
      value: "unavailable ride",
    });
    expect((received.mock.calls[0][0] as CustomEvent).detail.choiceId).toBeUndefined();
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
