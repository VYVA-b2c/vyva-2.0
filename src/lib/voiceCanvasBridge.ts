import type { VoiceCanvasViewModel } from "@/components/voice-canvas";

export const VYVA_VOICE_CANVAS_PRESENT_EVENT = "vyva:voice-canvas-present";
export const VYVA_VOICE_CANVAS_CLEAR_EVENT = "vyva:voice-canvas-clear";
export const VYVA_VOICE_CANVAS_RESPONSE_EVENT = "vyva:voice-canvas-response";

export type VoiceCanvasSceneOwner = "voice_action" | "concierge_ride";

export type VoiceCanvasSceneEnvelope = {
  viewModel: VoiceCanvasViewModel;
  owner: VoiceCanvasSceneOwner;
  revision: number;
  actionId?: string;
  flowReference?: string;
  pendingId?: string;
};

export type VoiceCanvasResponseKind = "choice" | "primary" | "secondary" | "text";

export type VoiceCanvasResponseDetail = {
  sceneId: string;
  revision: number;
  kind: VoiceCanvasResponseKind;
  utterance: string;
  value?: string;
  choiceId?: string;
  at: string;
};

export type VoiceCanvasClearDetail = {
  owner?: VoiceCanvasSceneOwner;
  sceneId?: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

export function emitVoiceCanvasScene(scene: VoiceCanvasSceneEnvelope) {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<VoiceCanvasSceneEnvelope>(VYVA_VOICE_CANVAS_PRESENT_EVENT, {
    detail: scene,
  }));
}

export function clearVoiceCanvasScene(detail: VoiceCanvasClearDetail = {}) {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<VoiceCanvasClearDetail>(VYVA_VOICE_CANVAS_CLEAR_EVENT, {
    detail,
  }));
}

export function emitVoiceCanvasResponse(detail: VoiceCanvasResponseDetail) {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<VoiceCanvasResponseDetail>(VYVA_VOICE_CANVAS_RESPONSE_EVENT, {
    detail,
  }));
}

export function voiceCanvasResponseMatchesScene(
  response: Pick<VoiceCanvasResponseDetail, "sceneId" | "revision">,
  scene: Pick<VoiceCanvasSceneEnvelope, "revision"> & { viewModel: Pick<VoiceCanvasViewModel, "sceneId"> },
) {
  return response.sceneId === scene.viewModel.sceneId && response.revision === scene.revision;
}

export function voiceCanvasClearMatchesScene(
  clear: VoiceCanvasClearDetail,
  scene: VoiceCanvasSceneEnvelope,
) {
  if (clear.owner && clear.owner !== scene.owner) return false;
  if (clear.sceneId && clear.sceneId !== scene.viewModel.sceneId) return false;
  return true;
}
