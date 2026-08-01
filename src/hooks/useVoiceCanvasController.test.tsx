import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVoiceCanvasController } from "./useVoiceCanvasController";
import {
  VYVA_VOICE_CANVAS_CLEAR_EVENT,
  VYVA_VOICE_CANVAS_PRESENT_EVENT,
  type VoiceCanvasSceneEnvelope,
} from "@/lib/voiceCanvasBridge";

function Harness({ enabled = true, revision = 1 }: { enabled?: boolean; revision?: number }) {
  useVoiceCanvasController({
    owner: "concierge_home_service",
    enabled,
    revision,
    actionId: "voice-home-1",
    flowReference: "CONCIERGE_HOME_SERVICE_V1",
    viewModel: enabled ? { sceneId: "home-service-type", kind: "choice", title: "Choose a service" } : null,
  });
  return null;
}

describe("useVoiceCanvasController", () => {
  it("publishes revisions and clears only its own scene", () => {
    const presented = vi.fn();
    const cleared = vi.fn();
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, presented);
    window.addEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, cleared);

    const view = render(<Harness />);
    expect((presented.mock.calls.at(-1)?.[0] as CustomEvent<VoiceCanvasSceneEnvelope>).detail).toMatchObject({
      owner: "concierge_home_service",
      revision: 1,
      actionId: "voice-home-1",
    });

    view.rerender(<Harness revision={2} />);
    expect((presented.mock.calls.at(-1)?.[0] as CustomEvent<VoiceCanvasSceneEnvelope>).detail.revision).toBe(2);

    view.rerender(<Harness enabled={false} revision={3} />);
    expect((cleared.mock.calls.at(-1)?.[0] as CustomEvent).detail).toEqual({ owner: "concierge_home_service" });

    view.unmount();
    expect((cleared.mock.calls.at(-1)?.[0] as CustomEvent).detail).toEqual({ owner: "concierge_home_service" });
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, presented);
    window.removeEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, cleared);
  });
});
