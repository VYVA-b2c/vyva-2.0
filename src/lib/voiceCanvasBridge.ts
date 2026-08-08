import type { VoiceCanvasViewModel } from "@/components/voice-canvas";

export const VYVA_VOICE_CANVAS_PRESENT_EVENT = "vyva:voice-canvas-present";
export const VYVA_VOICE_CANVAS_CLEAR_EVENT = "vyva:voice-canvas-clear";
export const VYVA_VOICE_CANVAS_RESPONSE_EVENT = "vyva:voice-canvas-response";

export type VoiceCanvasSceneOwner =
  | "voice_action"
  | "concierge_ride"
  | "concierge_appointment"
  | "concierge_home_service"
  | "health_preventive_check";

export type VoiceCanvasSceneEnvelope = {
  viewModel: VoiceCanvasViewModel;
  owner: VoiceCanvasSceneOwner;
  revision: number;
  actionId?: string;
  flowReference?: string;
  pendingId?: string;
  questionId?: string;
  sceneInstanceId?: string;
};

export type VoiceCanvasResponseKind = "choice" | "primary" | "secondary" | "text" | "file";

export type VoiceCanvasResponseDetail = {
  sceneId: string;
  revision: number;
  questionId?: string;
  sceneInstanceId?: string;
  flowReference?: string;
  kind: VoiceCanvasResponseKind;
  utterance: string;
  value?: string;
  choiceId?: string;
  file?: File | null;
  at: string;
  voiceUtteranceId?: string;
};

export type VoiceCanvasClearDetail = {
  owner?: VoiceCanvasSceneOwner;
  sceneId?: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

export type VoiceCanvasSceneProvenance = {
  owner: VoiceCanvasSceneOwner;
  sceneId: string;
  revision: number;
  actionId?: string;
  flowReference?: string;
  pendingId?: string;
  questionId?: string;
  sceneInstanceId?: string;
};

let activeVoiceCanvasSceneProvenance: VoiceCanvasSceneProvenance | null = null;

function provenanceForScene(scene: VoiceCanvasSceneEnvelope): VoiceCanvasSceneProvenance {
  return {
    owner: scene.owner,
    sceneId: scene.viewModel.sceneId,
    revision: scene.revision,
    actionId: scene.actionId,
    flowReference: scene.flowReference,
    pendingId: scene.pendingId,
    questionId: scene.questionId,
    sceneInstanceId: scene.sceneInstanceId,
  };
}

export function readActiveVoiceCanvasSceneProvenance(): VoiceCanvasSceneProvenance | null {
  return activeVoiceCanvasSceneProvenance ? { ...activeVoiceCanvasSceneProvenance } : null;
}

export function emitVoiceCanvasScene(scene: VoiceCanvasSceneEnvelope) {
  if (!hasWindow()) return;
  activeVoiceCanvasSceneProvenance = provenanceForScene(scene);
  window.dispatchEvent(new CustomEvent<VoiceCanvasSceneEnvelope>(VYVA_VOICE_CANVAS_PRESENT_EVENT, {
    detail: scene,
  }));
}

export function clearVoiceCanvasScene(detail: VoiceCanvasClearDetail = {}) {
  if (!hasWindow()) return;
  if (
    activeVoiceCanvasSceneProvenance
    && (!detail.owner || detail.owner === activeVoiceCanvasSceneProvenance.owner)
    && (!detail.sceneId || detail.sceneId === activeVoiceCanvasSceneProvenance.sceneId)
  ) {
    activeVoiceCanvasSceneProvenance = null;
  }
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
