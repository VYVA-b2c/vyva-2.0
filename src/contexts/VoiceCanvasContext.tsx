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

      const normalized = utterance.toLocaleLowerCase();
      const choice = scene.viewModel.choices?.find((item) => (
        item.label.trim().toLocaleLowerCase() === normalized
        || item.id.replace(/_/g, " ").toLocaleLowerCase() === normalized
      ));
      const primaryMatches = scene.viewModel.primaryAction?.label.trim().toLocaleLowerCase() === normalized;
      const secondaryMatches = scene.viewModel.secondaryAction?.label.trim().toLocaleLowerCase() === normalized;

      emitVoiceCanvasResponse({
        sceneId: scene.viewModel.sceneId,
        revision: scene.revision,
        kind: choice ? "choice" : primaryMatches ? "primary" : secondaryMatches ? "secondary" : "text",
        utterance,
        value: choice?.label ?? utterance,
        choiceId: choice?.id,
        at: detail.at || new Date().toISOString(),
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
