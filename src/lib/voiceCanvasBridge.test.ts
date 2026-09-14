import {
  clearVoiceCanvasScene,
  emitVoiceCanvasResponse,
  emitVoiceCanvasScene,
  readActiveVoiceCanvasSceneProvenance,
  voiceCanvasClearMatchesScene,
  voiceCanvasResponseMatchesScene,
  VYVA_VOICE_CANVAS_CLEAR_EVENT,
  VYVA_VOICE_CANVAS_PRESENT_EVENT,
  VYVA_VOICE_CANVAS_RESPONSE_EVENT,
  type VoiceCanvasSceneEnvelope,
} from "./voiceCanvasBridge";

const scene: VoiceCanvasSceneEnvelope = {
  owner: "concierge_ride",
  revision: 3,
  flowReference: "CONCIERGE_TRANSPORT_V1",
  viewModel: {
    sceneId: "ride-destination",
    kind: "place",
    title: "Where are you going?",
  },
};

describe("voiceCanvasBridge", () => {
  it("emits typed scene lifecycle events", () => {
    const presented = vi.fn();
    const cleared = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, presented);
    window.addEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, cleared);

    emitVoiceCanvasScene(scene);
    clearVoiceCanvasScene({ owner: "concierge_ride" });

    expect((presented.mock.calls[0][0] as CustomEvent).detail).toEqual(scene);
    expect((cleared.mock.calls[0][0] as CustomEvent).detail).toEqual({ owner: "concierge_ride" });
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, presented);
    window.removeEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, cleared);
  });

  it("captures and clears a privacy-safe active scene provenance snapshot", () => {
    emitVoiceCanvasScene({
      ...scene,
      questionId: "health.preventive_check.energy",
      sceneInstanceId: "health-session-a",
    });

    expect(readActiveVoiceCanvasSceneProvenance()).toEqual({
      owner: "concierge_ride",
      sceneId: "ride-destination",
      revision: 3,
      flowReference: "CONCIERGE_TRANSPORT_V1",
      actionId: undefined,
      pendingId: undefined,
      questionId: "health.preventive_check.energy",
      sceneInstanceId: "health-session-a",
    });

    clearVoiceCanvasScene({ sceneId: "ride-destination" });
    expect(readActiveVoiceCanvasSceneProvenance()).toBeNull();
  });

  it("emits touch responses with their scene revision", () => {
    const received = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);

    emitVoiceCanvasResponse({
      sceneId: "ride-destination",
      revision: 3,
      kind: "choice",
      choiceId: "saved-home",
      utterance: "Use my saved home address",
      at: "2026-07-18T10:00:00.000Z",
    });

    expect((received.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      sceneId: "ride-destination",
      revision: 3,
      choiceId: "saved-home",
    });
    window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, received);
  });

  it("rejects a response from an older or different scene", () => {
    expect(voiceCanvasResponseMatchesScene({ sceneId: "ride-destination", revision: 3 }, scene)).toBe(true);
    expect(voiceCanvasResponseMatchesScene({ sceneId: "ride-destination", revision: 2 }, scene)).toBe(false);
    expect(voiceCanvasResponseMatchesScene({ sceneId: "ride-time", revision: 3 }, scene)).toBe(false);
  });

  it("only clears the scene requested by its owner or id", () => {
    expect(voiceCanvasClearMatchesScene({ owner: "concierge_ride" }, scene)).toBe(true);
    expect(voiceCanvasClearMatchesScene({ owner: "voice_action" }, scene)).toBe(false);
    expect(voiceCanvasClearMatchesScene({ sceneId: "ride-time" }, scene)).toBe(false);
  });
});
