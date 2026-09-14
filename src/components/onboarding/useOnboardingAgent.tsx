import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type OnboardingAgentMode = "voice" | "tactile";
export type OnboardingAgentVoiceStatus =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "error";

export type OnboardingAgentDraftStatus =
  | "idle"
  | "listening"
  | "parsed-draft"
  | "needs-clarification"
  | "corrected-draft"
  | "confirmed-locally"
  | "saved";

export interface OnboardingAgentSectionConfig<SectionId extends string = string> {
  sectionId: SectionId;
  sectionLabel: string;
  voicePrompt: string;
  expectedFields: readonly string[];
  examples?: readonly string[];
  draftRowLabels?: Record<string, string>;
  correctionCommands?: readonly string[];
  reviewRequired: boolean;
  explicitSaveRequired: boolean;
  targetIds?: {
    addByVoice?: string;
    draftReview?: string;
    reviewSave?: string;
    [key: string]: string | undefined;
  };
}

export interface OnboardingAgentDraftLifecycle {
  status: OnboardingAgentDraftStatus;
  sectionId?: string;
  draftId?: string;
  lastCommand?: "remove" | "try-again" | "skip";
  updatedAt: number;
}

export function createOnboardingAgentDraftLifecycle(
  patch: Partial<Omit<OnboardingAgentDraftLifecycle, "updatedAt">> = {},
): OnboardingAgentDraftLifecycle {
  return {
    status: patch.status ?? "idle",
    sectionId: patch.sectionId,
    draftId: patch.draftId,
    lastCommand: patch.lastCommand,
    updatedAt: Date.now(),
  };
}

export interface OnboardingAgentState {
  mode: OnboardingAgentMode;
  voiceStatus: OnboardingAgentVoiceStatus;
  draftStatus: OnboardingAgentDraftStatus;
  currentSectionId?: string;
  currentSectionLabel?: string;
  currentPrompt?: string;
  activeTargetId?: string;
  lastHeardText?: string;
  error?: string;
  primaryVoiceActionId?: string;
  primaryVoiceActionLabel?: string;
  primaryVoiceActionDescription?: string;
}

export interface OnboardingAgentVoiceActionRegistration {
  id: string;
  label: string;
  description?: string;
  sectionId?: string;
  sectionLabel?: string;
  targetId?: string;
  sectionConfig?: OnboardingAgentSectionConfig;
  onStart: () => void;
}

export interface OnboardingAgentActions {
  setMode: (mode: OnboardingAgentMode) => void;
  setGuidance: (state: Partial<Omit<OnboardingAgentState, "mode">>) => void;
  clearGuidance: () => void;
  registerVoiceAction: (
    action: OnboardingAgentVoiceActionRegistration
  ) => () => void;
  runPrimaryVoiceAction: () => void;
}

export type OnboardingAgent = OnboardingAgentState & OnboardingAgentActions;

const STORAGE_KEY = "vyva.onboarding.companionMode.v1";
const GUIDANCE_CHANGE_EVENT = "vyva:onboarding-agent-guidance-change";
const LEGACY_GUIDANCE_CHANGE_EVENT = "vyva:onboarding-companion-guidance-change";
const voiceActionHandlers = new Map<string, () => void>();

const DEFAULT_STATE: OnboardingAgentState = {
  mode: "voice",
  voiceStatus: "idle",
  draftStatus: "idle",
};

function isMode(value: unknown): value is OnboardingAgentMode {
  return value === "voice" || value === "tactile";
}

function isVoiceStatus(value: unknown): value is OnboardingAgentVoiceStatus {
  return (
    value === "idle" ||
    value === "listening" ||
    value === "speaking" ||
    value === "thinking" ||
    value === "error"
  );
}

function isDraftStatus(value: unknown): value is OnboardingAgentDraftStatus {
  return (
    value === "idle" ||
    value === "listening" ||
    value === "parsed-draft" ||
    value === "needs-clarification" ||
    value === "corrected-draft" ||
    value === "confirmed-locally" ||
    value === "saved"
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStoredMode(): OnboardingAgentMode | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredMode(mode: OnboardingAgentMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // A blocked storage write should not prevent switching modes in-session.
  }
}

function sanitizeGuidanceState(
  state: Partial<OnboardingAgentState>
): Partial<OnboardingAgentState> {
  const sanitized: Partial<OnboardingAgentState> = {
    ...(isMode(state.mode) ? { mode: state.mode } : {}),
    ...(isVoiceStatus(state.voiceStatus)
      ? { voiceStatus: state.voiceStatus }
      : {}),
    ...(isDraftStatus(state.draftStatus)
      ? { draftStatus: state.draftStatus }
      : {}),
  };

  if ("currentPrompt" in state) sanitized.currentPrompt = cleanText(state.currentPrompt);
  if ("activeTargetId" in state) sanitized.activeTargetId = cleanText(state.activeTargetId);
  if ("lastHeardText" in state) sanitized.lastHeardText = cleanText(state.lastHeardText);
  if ("error" in state) sanitized.error = cleanText(state.error);
  if ("currentSectionId" in state) sanitized.currentSectionId = cleanText(state.currentSectionId);
  if ("currentSectionLabel" in state) sanitized.currentSectionLabel = cleanText(state.currentSectionLabel);
  if ("primaryVoiceActionId" in state) sanitized.primaryVoiceActionId = cleanText(state.primaryVoiceActionId);
  if ("primaryVoiceActionLabel" in state) sanitized.primaryVoiceActionLabel = cleanText(state.primaryVoiceActionLabel);
  if ("primaryVoiceActionDescription" in state) {
    sanitized.primaryVoiceActionDescription = cleanText(state.primaryVoiceActionDescription);
  }

  return sanitized;
}

function emitGuidanceChange(state: Partial<OnboardingAgentState>) {
  const detail = sanitizeGuidanceState(state);
  window.dispatchEvent(new CustomEvent(GUIDANCE_CHANGE_EVENT, { detail }));
  window.dispatchEvent(new CustomEvent(LEGACY_GUIDANCE_CHANGE_EVENT, { detail }));
}

const OnboardingAgentContext = createContext<OnboardingAgent | null>(null);

export function OnboardingAgentProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: Partial<OnboardingAgentState>;
}) {
  const [state, setState] = useState<OnboardingAgentState>(() => ({
    ...DEFAULT_STATE,
    ...sanitizeGuidanceState(initialState ?? {}),
    mode:
      sanitizeGuidanceState(initialState ?? {}).mode ??
      readStoredMode() ??
      DEFAULT_STATE.mode,
  }));

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !isMode(event.newValue)) return;
      setState((current) => ({ ...current, mode: event.newValue }));
    };

    const handleGuidanceChange = (event: Event) => {
      const detail = sanitizeGuidanceState(
        (event as CustomEvent<Partial<OnboardingAgentState>>).detail ?? {}
      );
      setState((current) => ({
        ...current,
        ...detail,
        mode: detail.mode ?? current.mode,
        voiceStatus: detail.voiceStatus ?? current.voiceStatus,
        draftStatus: detail.draftStatus ?? current.draftStatus,
      }));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    window.addEventListener(LEGACY_GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
      window.removeEventListener(LEGACY_GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    };
  }, []);

  const setMode = useCallback((mode: OnboardingAgentMode) => {
    setState((current) => ({ ...current, mode }));
    writeStoredMode(mode);
    emitGuidanceChange({ mode });
  }, []);

  const setGuidance = useCallback(
    (nextState: Partial<Omit<OnboardingAgentState, "mode">>) => {
      const sanitized = sanitizeGuidanceState(nextState);
      setState((current) => ({
        ...current,
        ...sanitized,
        mode: current.mode,
        voiceStatus: sanitized.voiceStatus ?? current.voiceStatus,
        draftStatus: sanitized.draftStatus ?? current.draftStatus,
      }));
      emitGuidanceChange(sanitized);
    },
    []
  );

  const clearGuidance = useCallback(() => {
    const cleared: Partial<OnboardingAgentState> = {
      voiceStatus: "idle",
      draftStatus: "idle",
      currentSectionId: undefined,
      currentSectionLabel: undefined,
      currentPrompt: undefined,
      activeTargetId: undefined,
      lastHeardText: undefined,
      error: undefined,
      primaryVoiceActionId: undefined,
      primaryVoiceActionLabel: undefined,
      primaryVoiceActionDescription: undefined,
    };
    setState((current) => ({ ...current, ...cleared }));
    emitGuidanceChange(cleared);
  }, []);

  const registerVoiceAction = useCallback(
    (action: OnboardingAgentVoiceActionRegistration) => {
      const actionId = cleanText(action.id);
      if (!actionId) return () => undefined;

      voiceActionHandlers.set(actionId, action.onStart);
      const registered: Partial<OnboardingAgentState> = {
        currentSectionId: cleanText(action.sectionConfig?.sectionId ?? action.sectionId),
        currentSectionLabel: cleanText(action.sectionConfig?.sectionLabel ?? action.sectionLabel),
        primaryVoiceActionId: actionId,
        primaryVoiceActionLabel: cleanText(action.label),
        primaryVoiceActionDescription: cleanText(action.description),
      };
      setState((current) => ({ ...current, ...registered }));
      emitGuidanceChange(registered);

      return () => {
        const currentHandler = voiceActionHandlers.get(actionId);
        if (currentHandler === action.onStart) {
          voiceActionHandlers.delete(actionId);
        }
        const cleared: Partial<OnboardingAgentState> = {
          currentSectionId: undefined,
          currentSectionLabel: undefined,
          activeTargetId: undefined,
          primaryVoiceActionId: undefined,
          primaryVoiceActionLabel: undefined,
          primaryVoiceActionDescription: undefined,
        };
        setState((current) =>
          current.primaryVoiceActionId === actionId ? { ...current, ...cleared } : current
        );
        emitGuidanceChange(cleared);
      };
    },
    []
  );

  const runPrimaryVoiceAction = useCallback(() => {
    const actionId = state.primaryVoiceActionId;
    if (!actionId) return;
    voiceActionHandlers.get(actionId)?.();
  }, [state.primaryVoiceActionId]);

  const value = useMemo<OnboardingAgent>(
    () => ({
      ...state,
      setMode,
      setGuidance,
      clearGuidance,
      registerVoiceAction,
      runPrimaryVoiceAction,
    }),
    [clearGuidance, registerVoiceAction, runPrimaryVoiceAction, setGuidance, setMode, state]
  );

  return (
    <OnboardingAgentContext.Provider value={value}>
      {children}
    </OnboardingAgentContext.Provider>
  );
}

function useStandaloneAgent(
  fallbackState?: Partial<OnboardingAgentState>
): OnboardingAgent {
  const [state, setState] = useState<OnboardingAgentState>(() => ({
    ...DEFAULT_STATE,
    ...sanitizeGuidanceState(fallbackState ?? {}),
    mode:
      sanitizeGuidanceState(fallbackState ?? {}).mode ??
      readStoredMode() ??
      DEFAULT_STATE.mode,
  }));

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !isMode(event.newValue)) return;
      setState((current) => ({ ...current, mode: event.newValue }));
    };

    const handleGuidanceChange = (event: Event) => {
      const detail = sanitizeGuidanceState(
        (event as CustomEvent<Partial<OnboardingAgentState>>).detail ?? {}
      );
      setState((current) => ({
        ...current,
        ...detail,
        mode: detail.mode ?? current.mode,
        voiceStatus: detail.voiceStatus ?? current.voiceStatus,
        draftStatus: detail.draftStatus ?? current.draftStatus,
      }));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    window.addEventListener(LEGACY_GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
      window.removeEventListener(LEGACY_GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    };
  }, []);

  const setMode = useCallback((mode: OnboardingAgentMode) => {
    setState((current) => ({ ...current, mode }));
    writeStoredMode(mode);
    emitGuidanceChange({ mode });
  }, []);

  const setGuidance = useCallback(
    (nextState: Partial<Omit<OnboardingAgentState, "mode">>) => {
      const sanitized = sanitizeGuidanceState(nextState);
      setState((current) => ({
        ...current,
        ...sanitized,
        mode: current.mode,
        voiceStatus: sanitized.voiceStatus ?? current.voiceStatus,
        draftStatus: sanitized.draftStatus ?? current.draftStatus,
      }));
      emitGuidanceChange(sanitized);
    },
    []
  );

  const clearGuidance = useCallback(() => {
    const cleared: Partial<OnboardingAgentState> = {
      voiceStatus: "idle",
      draftStatus: "idle",
      currentSectionId: undefined,
      currentSectionLabel: undefined,
      currentPrompt: undefined,
      activeTargetId: undefined,
      lastHeardText: undefined,
      error: undefined,
      primaryVoiceActionId: undefined,
      primaryVoiceActionLabel: undefined,
      primaryVoiceActionDescription: undefined,
    };
    setState((current) => ({ ...current, ...cleared }));
    emitGuidanceChange(cleared);
  }, []);

  const registerVoiceAction = useCallback(
    (action: OnboardingAgentVoiceActionRegistration) => {
      const actionId = cleanText(action.id);
      if (!actionId) return () => undefined;

      voiceActionHandlers.set(actionId, action.onStart);
      const registered: Partial<OnboardingAgentState> = {
        currentSectionId: cleanText(action.sectionConfig?.sectionId ?? action.sectionId),
        currentSectionLabel: cleanText(action.sectionConfig?.sectionLabel ?? action.sectionLabel),
        primaryVoiceActionId: actionId,
        primaryVoiceActionLabel: cleanText(action.label),
        primaryVoiceActionDescription: cleanText(action.description),
      };
      setState((current) => ({ ...current, ...registered }));
      emitGuidanceChange(registered);

      return () => {
        const currentHandler = voiceActionHandlers.get(actionId);
        if (currentHandler === action.onStart) {
          voiceActionHandlers.delete(actionId);
        }
        const cleared: Partial<OnboardingAgentState> = {
          currentSectionId: undefined,
          currentSectionLabel: undefined,
          activeTargetId: undefined,
          primaryVoiceActionId: undefined,
          primaryVoiceActionLabel: undefined,
          primaryVoiceActionDescription: undefined,
        };
        setState((current) =>
          current.primaryVoiceActionId === actionId ? { ...current, ...cleared } : current
        );
        emitGuidanceChange(cleared);
      };
    },
    []
  );

  const runPrimaryVoiceAction = useCallback(() => {
    const actionId = state.primaryVoiceActionId;
    if (!actionId) return;
    voiceActionHandlers.get(actionId)?.();
  }, [state.primaryVoiceActionId]);

  return useMemo(
    () => ({
      ...state,
      setMode,
      setGuidance,
      clearGuidance,
      registerVoiceAction,
      runPrimaryVoiceAction,
    }),
    [clearGuidance, registerVoiceAction, runPrimaryVoiceAction, setGuidance, setMode, state]
  );
}

export function useOnboardingAgent(
  fallbackState?: Partial<OnboardingAgentState>
) {
  const context = useContext(OnboardingAgentContext);
  const standalone = useStandaloneAgent(fallbackState);
  return context ?? standalone;
}
