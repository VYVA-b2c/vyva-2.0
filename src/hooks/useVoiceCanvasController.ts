import { useEffect, useRef, type MutableRefObject } from "react";
import {
  clearVoiceCanvasScene,
  emitVoiceCanvasScene,
  type VoiceCanvasSceneEnvelope,
  type VoiceCanvasSceneOwner,
} from "@/lib/voiceCanvasBridge";
import type { VoiceCanvasViewModel } from "@/components/voice-canvas";

type UseVoiceCanvasControllerInput = {
  owner: VoiceCanvasSceneOwner;
  enabled: boolean;
  revision: number;
  viewModel: VoiceCanvasViewModel | null;
  actionId?: string;
  flowReference?: string;
  pendingId?: string;
  questionId?: string;
  sceneInstanceId?: string;
};

export function useVoiceCanvasController({
  owner,
  enabled,
  revision,
  viewModel,
  actionId,
  flowReference,
  pendingId,
  questionId,
  sceneInstanceId,
}: UseVoiceCanvasControllerInput): MutableRefObject<VoiceCanvasSceneEnvelope | null> {
  const activeSceneRef = useRef<VoiceCanvasSceneEnvelope | null>(null);

  useEffect(() => {
    if (!enabled || !viewModel) {
      activeSceneRef.current = null;
      clearVoiceCanvasScene({ owner });
      return;
    }

    const scene: VoiceCanvasSceneEnvelope = {
      owner,
      revision,
      actionId,
      flowReference,
      pendingId,
      questionId,
      sceneInstanceId,
      viewModel,
    };
    activeSceneRef.current = scene;
    emitVoiceCanvasScene(scene);
  }, [actionId, enabled, flowReference, owner, pendingId, questionId, revision, sceneInstanceId, viewModel]);

  useEffect(() => () => {
    activeSceneRef.current = null;
    clearVoiceCanvasScene({ owner });
  }, [owner]);

  return activeSceneRef;
}

