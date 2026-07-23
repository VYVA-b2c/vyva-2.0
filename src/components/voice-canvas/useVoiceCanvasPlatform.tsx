import {
  useEffect,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type Reducer,
  type RefObject,
} from "react";
import type {
  CanvasInputMethod,
  CanvasTelemetryEnvelope,
} from "./canvasPlatform";
import { CanvasSafetyError } from "./canvasPlatform";
import { VYVA_VOICE_USER_MESSAGE_EVENT } from "@/lib/voiceNavigation";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import type { VoiceSessionPhase } from "@/lib/voiceSessionState";
import type {
  VoiceCanvasAgentPresence,
  VoiceCanvasAgentPresenceCopy,
  VoiceCanvasAgentPresenceState,
  VoiceCanvasSpokenChoiceFeedback,
  VoiceCanvasViewModel,
} from "./types";

/** Keeps one stable global voice listener while always invoking the latest scene handler. */
export function useCanvasVoiceSynchronization(handler: (event: Event) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  useEffect(() => {
    const listener = (event: Event) => handlerRef.current(event);
    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, listener);
    return () => window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, listener);
  }, []);
}

export function useCanvasSessionReducer<State, Event>({
  reducer,
  initialState,
  suppliedState,
  storageKey,
  isRestorable,
}: {
  reducer: Reducer<State, Event>;
  initialState: State | (() => State);
  suppliedState?: State;
  storageKey: string;
  isRestorable: (value: unknown) => value is State;
}): {
  state: State;
  dispatch: Dispatch<Event>;
  restoredRef: RefObject<boolean>;
} {
  const restoredRef = useRef(false);
  const initialize = () => {
    if (suppliedState) return suppliedState;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isRestorable(parsed)) {
          restoredRef.current = true;
          return parsed;
        }
      }
    } catch {
      /* Storage can be unavailable in embedded browsers. */
    }
    return typeof initialState === "function"
      ? (initialState as () => State)()
      : initialState;
  };
  const [state, dispatch] = useReducer(reducer, undefined, initialize);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* Storage can be unavailable. */
    }
  }, [state, storageKey]);
  return { state, dispatch, restoredRef };
}

export function useCanvasAccessibility(step: string) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [step]);
  return rootRef;
}

type VoiceCanvasAgentPresenceVoiceState = {
  status?: "idle" | "connecting" | "connected";
  isSpeaking?: boolean;
  isConnecting?: boolean;
  isMicMuted?: boolean;
  voiceSessionPhase?: VoiceSessionPhase;
};

const emptyVoiceState: VoiceCanvasAgentPresenceVoiceState = {
  status: "idle",
  isSpeaking: false,
  isConnecting: false,
  isMicMuted: false,
  voiceSessionPhase: "idle",
};

function useOptionalCanvasVoiceState(): VoiceCanvasAgentPresenceVoiceState {
  try {
    const voice = useVyvaVoice();
    return {
      status: voice.status,
      isSpeaking: voice.isSpeaking,
      isConnecting: voice.isConnecting,
      isMicMuted: voice.isMicMuted,
      voiceSessionPhase: voice.voiceSessionPhase,
    };
  } catch {
    return emptyVoiceState;
  }
}

export function voiceCanvasAgentPresenceStateFor(
  viewModel: Pick<VoiceCanvasViewModel, "kind" | "status">,
  voice: VoiceCanvasAgentPresenceVoiceState,
): VoiceCanvasAgentPresenceState {
  if (viewModel.kind === "waiting" || viewModel.status === "loading" || voice.isConnecting || voice.voiceSessionPhase === "connecting" || voice.voiceSessionPhase === "transferring") {
    return "thinking";
  }
  if (voice.isSpeaking || voice.voiceSessionPhase === "speaking") return "speaking";
  if (voice.status === "connected" && !voice.isMicMuted && voice.voiceSessionPhase !== "muted") return "listening";
  return "idle";
}

function presenceCopyForState(copy: VoiceCanvasAgentPresenceCopy, state: VoiceCanvasAgentPresenceState) {
  if (state === "speaking") return { label: copy.speakingLabel, description: copy.speakingDescription };
  if (state === "thinking") return { label: copy.thinkingLabel, description: copy.thinkingDescription };
  if (state === "listening") return { label: copy.listeningLabel, description: copy.listeningDescription };
  return { label: copy.idleLabel, description: copy.idleDescription };
}

export function applyVoiceCanvasAgentPresence(
  viewModel: VoiceCanvasViewModel,
  voice: VoiceCanvasAgentPresenceVoiceState,
  suppliedCopy?: VoiceCanvasAgentPresenceCopy,
): VoiceCanvasViewModel {
  if (viewModel.kind === "listening") return viewModel;
  const copy = suppliedCopy ?? viewModel.agentPresenceCopy;
  if (!copy && !viewModel.agentPresence) return viewModel;
  const state = voiceCanvasAgentPresenceStateFor(viewModel, voice);
  if (!copy) return { ...viewModel, agentPresence: { ...viewModel.agentPresence!, state } };
  const stateCopy = presenceCopyForState(copy, state);
  const agentPresence: VoiceCanvasAgentPresence = {
    state,
    label: stateCopy.label,
    description: stateCopy.description,
    accessibleLabel: copy.accessibleLabel,
    ariaLive: copy.ariaLive,
  };
  return { ...viewModel, agentPresence };
}

export function useVoiceCanvasAgentPresence(
  viewModel: VoiceCanvasViewModel | null | undefined,
  copy?: VoiceCanvasAgentPresenceCopy,
) {
  const voice = useOptionalCanvasVoiceState();
  const {
    isConnecting,
    isMicMuted,
    isSpeaking,
    status,
    voiceSessionPhase,
  } = voice;
  return useMemo(
    () => viewModel ? applyVoiceCanvasAgentPresence(viewModel, {
      isConnecting,
      isMicMuted,
      isSpeaking,
      status,
      voiceSessionPhase,
    }, copy) : viewModel,
    [copy, isConnecting, isMicMuted, isSpeaking, status, viewModel, voiceSessionPhase],
  );
}

export function applyVoiceCanvasSpokenChoiceFeedback(
  viewModel: VoiceCanvasViewModel,
  feedback?: VoiceCanvasSpokenChoiceFeedback,
): VoiceCanvasViewModel {
  if (!feedback) return viewModel;
  const choices = viewModel.choices?.map((choice) =>
    choice.id === feedback.choiceId
      ? { ...choice, selected: true, spokenSelected: true }
      : choice,
  );
  const blocks = viewModel.blocks?.map((block) =>
    block.kind === "option-card" && block.id === feedback.choiceId
      ? { ...block, selected: true, spokenSelected: true }
      : block,
  );
  const matched =
    choices?.some((choice) => choice.id === feedback.choiceId) ||
    blocks?.some((block) => block.kind === "option-card" && block.id === feedback.choiceId);
  if (!matched) return viewModel;
  return {
    ...viewModel,
    choices,
    blocks,
    spokenChoiceFeedback: feedback,
  };
}

export function useVoiceCanvasSpokenChoiceFeedback(delayMs = 650) {
  const [feedback, setFeedback] = useState<VoiceCanvasSpokenChoiceFeedback | undefined>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);

  const clear = useCallback(() => {
    tokenRef.current += 1;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setFeedback(undefined);
  }, []);

  const acknowledge = useCallback((
    next: Omit<VoiceCanvasSpokenChoiceFeedback, "token">,
    commit: () => void,
  ) => {
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setFeedback({ ...next, token });
    timeoutRef.current = window.setTimeout(() => {
      if (tokenRef.current !== token) return;
      timeoutRef.current = null;
      commit();
      setFeedback(undefined);
    }, delayMs);
  }, [delayMs]);

  useEffect(() => () => {
    tokenRef.current += 1;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  return { feedback, acknowledge, clear };
}

export function CanvasLiveStatus({
  label,
  assertive = false,
}: {
  label: string;
  assertive?: boolean;
}) {
  return (
    <span
      className="sr-only"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {label}
    </span>
  );
}

type Permit = { requestId: number; revision: number };
export function useCanvasExternalActionGate() {
  const permitRef = useRef<Permit | null>(null);
  const activeRef = useRef<{
    requestId: number;
    controller: AbortController;
  } | null>(null);
  useEffect(() => () => activeRef.current?.controller.abort(), []);
  return useMemo(
    () => ({
      authorize(requestId: number, revision = 0) {
        permitRef.current = { requestId, revision };
      },
      invalidate() {
        permitRef.current = null;
        activeRef.current?.controller.abort();
        activeRef.current = null;
      },
      begin(requestId: number, revision = 0) {
        const permit = permitRef.current;
        if (
          !permit ||
          permit.requestId !== requestId ||
          permit.revision !== revision
        )
          throw new CanvasSafetyError();
        if (activeRef.current?.requestId === requestId) return null;
        activeRef.current?.controller.abort();
        const controller = new AbortController();
        activeRef.current = { requestId, controller };
        return controller;
      },
      isCurrent(requestId: number, controller: AbortController) {
        return (
          !controller.signal.aborted &&
          activeRef.current?.requestId === requestId &&
          activeRef.current.controller === controller
        );
      },
    }),
    [],
  );
}

export function createCanvasInputRef() {
  return { current: "system" as CanvasInputMethod };
}
export type AnyCanvasTelemetry = CanvasTelemetryEnvelope<string>;
