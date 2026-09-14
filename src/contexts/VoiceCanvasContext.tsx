import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import type { VoiceCanvasOptionCardBlock, VoiceCanvasViewModel } from "@/components/voice-canvas";
import {
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import {
  clearVoiceCanvasScene,
  emitVoiceCanvasResponse,
  emitVoiceCanvasScene,
  voiceCanvasClearMatchesScene,
  VYVA_VOICE_CANVAS_CLEAR_EVENT,
  VYVA_VOICE_CANVAS_PRESENT_EVENT,
  type VoiceCanvasClearDetail,
  type VoiceCanvasResponseKind,
  type VoiceCanvasSceneEnvelope,
  type VoiceCanvasSceneProvenance,
  type VoiceCanvasSceneOwner,
} from "@/lib/voiceCanvasBridge";

type VoiceCanvasState = {
  activeScene: VoiceCanvasSceneEnvelope | null;
};

type VoiceCanvasStateAction =
  | { type: "present"; scene: VoiceCanvasSceneEnvelope }
  | { type: "clear"; detail: VoiceCanvasClearDetail };

type SubmitCanvasResponseInput = {
  kind: VoiceCanvasResponseKind;
  utterance: string;
  value?: string;
  choiceId?: string;
  file?: File | null;
};

type VoiceCanvasContextValue = {
  activeScene: VoiceCanvasSceneEnvelope | null;
  presentScene: (scene: VoiceCanvasSceneEnvelope) => void;
  clearScene: (owner?: VoiceCanvasSceneOwner) => void;
  submitResponse: (response: SubmitCanvasResponseInput) => boolean;
};

const VoiceCanvasContext = createContext<VoiceCanvasContextValue | null>(null);

function optionCardBlocks(viewModel: VoiceCanvasViewModel): VoiceCanvasOptionCardBlock[] {
  return viewModel.blocks?.filter((block): block is VoiceCanvasOptionCardBlock => block.kind === "option-card") ?? [];
}

function matchesSpokenOption(value: string, spoken: string) {
  return value.trim().toLocaleLowerCase() === spoken;
}

function isHealthCanvasScene(scene: Pick<VoiceCanvasSceneEnvelope, "owner">) {
  return scene.owner === "health_preventive_check";
}

function voiceCanvasSceneMatchesProvenance(
  scene: VoiceCanvasSceneEnvelope,
  provenance: VoiceCanvasSceneProvenance,
) {
  return scene.owner === provenance.owner
    && scene.viewModel.sceneId === provenance.sceneId
    && scene.revision === provenance.revision
    && scene.questionId === provenance.questionId
    && scene.sceneInstanceId === provenance.sceneInstanceId;
}

export function voiceCanvasStateReducer(state: VoiceCanvasState, action: VoiceCanvasStateAction): VoiceCanvasState {
  if (action.type === "clear") {
    if (!state.activeScene || !voiceCanvasClearMatchesScene(action.detail, state.activeScene)) return state;
    return { activeScene: null };
  }

  const current = state.activeScene;
  const next = action.scene;
  if (
    current?.owner === next.owner &&
    next.revision < current.revision
  ) {
    return state;
  }
  return { activeScene: next };
}

export function VoiceCanvasProvider({ children }: { children: ReactNode }) {
  const { sendText } = useVyvaVoice();
  const [state, dispatch] = useReducer(voiceCanvasStateReducer, { activeScene: null });
  const activeSceneRef = useRef<VoiceCanvasSceneEnvelope | null>(null);
  const lastTouchResponseRef = useRef<{ utterance: string; at: number } | null>(null);

  useEffect(() => {
    activeSceneRef.current = state.activeScene;
  }, [state.activeScene]);

  useEffect(() => {
    const handlePresent = (event: Event) => {
      const scene = event instanceof CustomEvent
        ? (event.detail as VoiceCanvasSceneEnvelope | undefined)
        : undefined;
      if (!scene?.viewModel?.sceneId || !scene.owner || !Number.isFinite(scene.revision)) return;
      dispatch({ type: "present", scene });
    };
    const handleClear = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? (event.detail as VoiceCanvasClearDetail | undefined)
        : undefined;
      dispatch({ type: "clear", detail: detail ?? {} });
    };

    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handlePresent);
    window.addEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, handleClear);
    return () => {
      window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handlePresent);
      window.removeEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, handleClear);
    };
  }, []);

  useEffect(() => {
    const handleVoiceAnswer = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? (event.detail as VoiceUserMessageDetail | undefined)
        : undefined;
      const scene = activeSceneRef.current;
      const utterance = detail?.text?.trim();
      if (!scene || !utterance) return;

      const recentTouch = lastTouchResponseRef.current;
      if (
        recentTouch
        && recentTouch.utterance.localeCompare(utterance, undefined, { sensitivity: "accent" }) === 0
        && Date.now() - recentTouch.at < 2_000
      ) {
        return;
      }

      const provenance = detail?.canvasProvenance ?? null;
      if (isHealthCanvasScene(scene) && provenance?.owner !== "health_preventive_check") {
        return;
      }

      const responseScene = isHealthCanvasScene(scene) && provenance
        ? provenance
        : {
            sceneId: scene.viewModel.sceneId,
            revision: scene.revision,
            questionId: scene.questionId,
            sceneInstanceId: scene.sceneInstanceId,
            flowReference: scene.flowReference,
          };
      const canMatchAgainstActiveScene = !isHealthCanvasScene(scene)
        || (provenance ? voiceCanvasSceneMatchesProvenance(scene, provenance) : true);

      const normalized = utterance.toLocaleLowerCase();
      const choice = canMatchAgainstActiveScene
        ? scene.viewModel.choices?.find((item) => !item.disabled && (
            matchesSpokenOption(item.label, normalized)
            || matchesSpokenOption(item.id.replace(/_/g, " "), normalized)
          ))
        : undefined;
      const optionCard = canMatchAgainstActiveScene
        ? optionCardBlocks(scene.viewModel).find((item) => !item.disabled && (
            matchesSpokenOption(item.title, normalized)
            || matchesSpokenOption(item.id.replace(/[_:-]/g, " "), normalized)
            || item.voiceAliases?.some((alias) => matchesSpokenOption(alias, normalized))
          ))
        : undefined;
      const primaryMatches = canMatchAgainstActiveScene
        && scene.viewModel.primaryAction?.label.trim().toLocaleLowerCase() === normalized;
      const secondaryMatches = canMatchAgainstActiveScene
        && scene.viewModel.secondaryAction?.label.trim().toLocaleLowerCase() === normalized;

      emitVoiceCanvasResponse({
        sceneId: responseScene.sceneId,
        revision: responseScene.revision,
        questionId: responseScene.questionId,
        sceneInstanceId: responseScene.sceneInstanceId,
        flowReference: responseScene.flowReference,
        kind: choice || optionCard ? "choice" : primaryMatches ? "primary" : secondaryMatches ? "secondary" : "text",
        utterance,
        value: choice?.label ?? optionCard?.title ?? utterance,
        choiceId: choice?.id ?? optionCard?.id,
        at: detail.at || new Date().toISOString(),
        voiceUtteranceId: detail.voiceUtteranceId,
      });
    };

    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceAnswer);
    return () => window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceAnswer);
  }, []);

  const presentScene = useCallback((scene: VoiceCanvasSceneEnvelope) => {
    emitVoiceCanvasScene(scene);
  }, []);

  const clearScene = useCallback((owner?: VoiceCanvasSceneOwner) => {
    clearVoiceCanvasScene(owner ? { owner } : {});
  }, []);

  const submitResponse = useCallback((response: SubmitCanvasResponseInput) => {
    const scene = activeSceneRef.current;
    const utterance = response.utterance.trim();
    if (!scene || (!utterance && response.kind !== "file")) return false;

    emitVoiceCanvasResponse({
      sceneId: scene.viewModel.sceneId,
      revision: scene.revision,
      questionId: scene.questionId,
      sceneInstanceId: scene.sceneInstanceId,
      flowReference: scene.flowReference,
      ...response,
      utterance: utterance || (response.file?.name ?? "file"),
      at: new Date().toISOString(),
    });
    const responseUtterance = utterance || (response.file?.name ?? "file");
    lastTouchResponseRef.current = { utterance: responseUtterance, at: Date.now() };
    if (response.kind !== "file") sendText(responseUtterance, { invisibleInTranscript: true });
    return true;
  }, [sendText]);

  const value = useMemo<VoiceCanvasContextValue>(() => ({
    activeScene: state.activeScene,
    presentScene,
    clearScene,
    submitResponse,
  }), [clearScene, presentScene, state.activeScene, submitResponse]);

  return <VoiceCanvasContext.Provider value={value}>{children}</VoiceCanvasContext.Provider>;
}

export function useVoiceCanvasContext() {
  const context = useContext(VoiceCanvasContext);
  if (!context) throw new Error("useVoiceCanvasContext must be used inside VoiceCanvasProvider");
  return context;
}
