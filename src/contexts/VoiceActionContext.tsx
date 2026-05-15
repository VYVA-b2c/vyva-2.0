import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import {
  VYVA_VOICE_APP_ACTION_EVENT,
  VYVA_VOICE_APP_ACTION_RESULT_EVENT,
  type VoiceAppAction,
  type VoiceAppActionResult,
} from "@/lib/voiceNavigation";

type VoiceActionFeedbackMetadata = Record<string, unknown>;

type ActiveVoiceActionState = {
  action: VoiceAppAction;
  instanceId: string;
};

type CompleteActiveActionOptions = {
  clear?: boolean;
  metadata?: VoiceActionFeedbackMetadata;
};

type VoiceActionContextValue = {
  activeAction: VoiceAppAction | null;
  completeActiveAction: (options?: CompleteActiveActionOptions) => void;
  dismissActiveAction: (metadata?: VoiceActionFeedbackMetadata) => void;
};

const VoiceActionContext = createContext<VoiceActionContextValue | null>(null);

function feedbackOverride(action: VoiceAppAction) {
  return {
    id: action.id,
    domain: action.domain,
    title: action.title,
    reason: action.feedbackReason,
  };
}

function baseFeedbackMetadata(action: VoiceAppAction) {
  return {
    voice_action_id: action.id,
    voice_action_domain: action.domain,
    voice_action_route: action.route,
    voice_action_title: action.title,
    voice_action_reason: action.feedbackReason,
  };
}

export function VoiceActionProvider({ children }: { children: ReactNode }) {
  const { recordRecommendationFeedback } = useVyvaVoice();
  const [activeState, setActiveState] = useState<ActiveVoiceActionState | null>(null);
  const activeStateRef = useRef<ActiveVoiceActionState | null>(null);
  const feedbackKeysRef = useRef<Set<string>>(new Set());

  const openVoiceAction = useCallback((action: VoiceAppAction) => {
    const nextState = {
      action,
      instanceId: `${action.id}:${Date.now()}`,
    };
    activeStateRef.current = nextState;
    setActiveState(nextState);
  }, []);

  const recordActionFeedback = useCallback(
    (
      state: ActiveVoiceActionState,
      feedbackAction: "accepted" | "completed" | "dismissed",
      metadata: VoiceActionFeedbackMetadata = {},
    ) => {
      const source = typeof metadata.source === "string" ? metadata.source : "voice_action_context";
      const feedbackKey = `${state.instanceId}:${feedbackAction}:${source}`;
      if (feedbackKeysRef.current.has(feedbackKey)) return;

      feedbackKeysRef.current.add(feedbackKey);
      void recordRecommendationFeedback(
        feedbackAction,
        {
          ...baseFeedbackMetadata(state.action),
          ...metadata,
        },
        feedbackOverride(state.action),
      );
    },
    [recordRecommendationFeedback],
  );

  const completeActiveAction = useCallback(
    (options: CompleteActiveActionOptions = {}) => {
      const current = activeStateRef.current;
      if (!current) return;
      recordActionFeedback(current, "completed", options.metadata);
      if (options.clear === false) return;
      activeStateRef.current = null;
      setActiveState(null);
    },
    [recordActionFeedback],
  );

  const dismissActiveAction = useCallback(
    (metadata: VoiceActionFeedbackMetadata = {}) => {
      const current = activeStateRef.current;
      if (!current) return;
      recordActionFeedback(current, "dismissed", metadata);
      activeStateRef.current = null;
      setActiveState(null);
    },
    [recordActionFeedback],
  );

  useEffect(() => {
    const handleVoiceAppAction = (event: Event) => {
      const action = event instanceof CustomEvent ? (event.detail as VoiceAppAction | undefined) : undefined;
      if (!action?.id || !action.route) return;
      openVoiceAction(action);
    };

    window.addEventListener(VYVA_VOICE_APP_ACTION_EVENT, handleVoiceAppAction);
    return () => window.removeEventListener(VYVA_VOICE_APP_ACTION_EVENT, handleVoiceAppAction);
  }, [openVoiceAction]);

  useEffect(() => {
    const handleVoiceAppActionResult = (event: Event) => {
      const result = event instanceof CustomEvent
        ? (event.detail as VoiceAppActionResult | undefined)
        : undefined;
      if (!result?.action) return;

      const current = activeStateRef.current;
      if (!current) return;
      if (result.actionId && result.actionId !== current.action.id) return;
      if (result.domain && result.domain !== current.action.domain) return;

      recordActionFeedback(current, result.action, {
        source: result.source ?? "voice_action_result_event",
        evidence: result.evidence ?? "",
        title: result.title ?? current.action.title,
        reason: result.reason ?? current.action.feedbackReason,
      });

      if (result.action === "completed" || result.action === "dismissed") {
        activeStateRef.current = null;
        setActiveState(null);
      }
    };

    window.addEventListener(VYVA_VOICE_APP_ACTION_RESULT_EVENT, handleVoiceAppActionResult);
    return () => window.removeEventListener(VYVA_VOICE_APP_ACTION_RESULT_EVENT, handleVoiceAppActionResult);
  }, [recordActionFeedback]);

  useEffect(() => {
    if (!activeState) return;
    const timer = window.setTimeout(() => {
      activeStateRef.current = null;
      setActiveState(null);
    }, 45000);
    return () => window.clearTimeout(timer);
  }, [activeState]);

  const value = useMemo<VoiceActionContextValue>(
    () => ({
      activeAction: activeState?.action ?? null,
      completeActiveAction,
      dismissActiveAction,
    }),
    [activeState?.action, completeActiveAction, dismissActiveAction],
  );

  return <VoiceActionContext.Provider value={value}>{children}</VoiceActionContext.Provider>;
}

export function useVoiceActionContext() {
  const context = useContext(VoiceActionContext);
  if (!context) {
    throw new Error("useVoiceActionContext must be used inside VoiceActionProvider");
  }
  return context;
}
