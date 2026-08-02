import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type OnboardingCompanionMode = "voice" | "tactile";
export type OnboardingCompanionVoiceStatus =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "error";

export interface OnboardingCompanionGuidanceState {
  mode: OnboardingCompanionMode;
  voiceStatus: OnboardingCompanionVoiceStatus;
  currentPrompt?: string;
  activeTargetId?: string;
  lastHeardText?: string;
  error?: string;
}

export interface OnboardingCompanionGuidanceActions {
  setMode: (mode: OnboardingCompanionMode) => void;
  setGuidance: (state: Partial<Omit<OnboardingCompanionGuidanceState, "mode">>) => void;
  clearGuidance: () => void;
}

export type OnboardingCompanionGuidance = OnboardingCompanionGuidanceState &
  OnboardingCompanionGuidanceActions;

const STORAGE_KEY = "vyva.onboarding.companionMode.v1";
const GUIDANCE_CHANGE_EVENT = "vyva:onboarding-companion-guidance-change";

const DEFAULT_STATE: OnboardingCompanionGuidanceState = {
  mode: "voice",
  voiceStatus: "idle",
};

function isMode(value: unknown): value is OnboardingCompanionMode {
  return value === "voice" || value === "tactile";
}

function isVoiceStatus(value: unknown): value is OnboardingCompanionVoiceStatus {
  return (
    value === "idle" ||
    value === "listening" ||
    value === "speaking" ||
    value === "thinking" ||
    value === "error"
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStoredMode(): OnboardingCompanionMode | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredMode(mode: OnboardingCompanionMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // A blocked storage write should not prevent switching modes in-session.
  }
}

function sanitizeGuidanceState(
  state: Partial<OnboardingCompanionGuidanceState>
): Partial<OnboardingCompanionGuidanceState> {
  const sanitized: Partial<OnboardingCompanionGuidanceState> = {
    ...(isMode(state.mode) ? { mode: state.mode } : {}),
    ...(isVoiceStatus(state.voiceStatus)
      ? { voiceStatus: state.voiceStatus }
      : {}),
  };

  if ("currentPrompt" in state) sanitized.currentPrompt = cleanText(state.currentPrompt);
  if ("activeTargetId" in state) sanitized.activeTargetId = cleanText(state.activeTargetId);
  if ("lastHeardText" in state) sanitized.lastHeardText = cleanText(state.lastHeardText);
  if ("error" in state) sanitized.error = cleanText(state.error);

  return sanitized;
}

function emitGuidanceChange(state: Partial<OnboardingCompanionGuidanceState>) {
  window.dispatchEvent(
    new CustomEvent(GUIDANCE_CHANGE_EVENT, {
      detail: sanitizeGuidanceState(state),
    })
  );
}

const OnboardingCompanionGuidanceContext =
  createContext<OnboardingCompanionGuidance | null>(null);

export function OnboardingCompanionGuidanceProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: Partial<OnboardingCompanionGuidanceState>;
}) {
  const [state, setState] = useState<OnboardingCompanionGuidanceState>(() => ({
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
        (event as CustomEvent<Partial<OnboardingCompanionGuidanceState>>).detail ??
          {}
      );
      setState((current) => ({
        ...current,
        ...detail,
        mode: detail.mode ?? current.mode,
        voiceStatus: detail.voiceStatus ?? current.voiceStatus,
      }));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    };
  }, []);

  const setMode = useCallback((mode: OnboardingCompanionMode) => {
    setState((current) => ({ ...current, mode }));
    writeStoredMode(mode);
    emitGuidanceChange({ mode });
  }, []);

  const setGuidance = useCallback(
    (nextState: Partial<Omit<OnboardingCompanionGuidanceState, "mode">>) => {
      const sanitized = sanitizeGuidanceState(nextState);
      setState((current) => ({
        ...current,
        ...sanitized,
        mode: current.mode,
        voiceStatus: sanitized.voiceStatus ?? current.voiceStatus,
      }));
      emitGuidanceChange(sanitized);
    },
    []
  );

  const clearGuidance = useCallback(() => {
    const cleared: Partial<OnboardingCompanionGuidanceState> = {
      voiceStatus: "idle",
      currentPrompt: undefined,
      activeTargetId: undefined,
      lastHeardText: undefined,
      error: undefined,
    };
    setState((current) => ({ ...current, ...cleared }));
    emitGuidanceChange(cleared);
  }, []);

  const value = useMemo<OnboardingCompanionGuidance>(
    () => ({
      ...state,
      setMode,
      setGuidance,
      clearGuidance,
    }),
    [clearGuidance, setGuidance, setMode, state]
  );

  return (
    <OnboardingCompanionGuidanceContext.Provider value={value}>
      {children}
    </OnboardingCompanionGuidanceContext.Provider>
  );
}

function useStandaloneGuidance(
  fallbackState?: Partial<OnboardingCompanionGuidanceState>
): OnboardingCompanionGuidance {
  const [state, setState] = useState<OnboardingCompanionGuidanceState>(() => ({
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
        (event as CustomEvent<Partial<OnboardingCompanionGuidanceState>>).detail ??
          {}
      );
      setState((current) => ({
        ...current,
        ...detail,
        mode: detail.mode ?? current.mode,
        voiceStatus: detail.voiceStatus ?? current.voiceStatus,
      }));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(GUIDANCE_CHANGE_EVENT, handleGuidanceChange);
    };
  }, []);

  const setMode = useCallback((mode: OnboardingCompanionMode) => {
    setState((current) => ({ ...current, mode }));
    writeStoredMode(mode);
    emitGuidanceChange({ mode });
  }, []);

  const setGuidance = useCallback(
    (nextState: Partial<Omit<OnboardingCompanionGuidanceState, "mode">>) => {
      const sanitized = sanitizeGuidanceState(nextState);
      setState((current) => ({
        ...current,
        ...sanitized,
        mode: current.mode,
        voiceStatus: sanitized.voiceStatus ?? current.voiceStatus,
      }));
      emitGuidanceChange(sanitized);
    },
    []
  );

  const clearGuidance = useCallback(() => {
    const cleared: Partial<OnboardingCompanionGuidanceState> = {
      voiceStatus: "idle",
      currentPrompt: undefined,
      activeTargetId: undefined,
      lastHeardText: undefined,
      error: undefined,
    };
    setState((current) => ({ ...current, ...cleared }));
    emitGuidanceChange(cleared);
  }, []);

  return useMemo(
    () => ({
      ...state,
      setMode,
      setGuidance,
      clearGuidance,
    }),
    [clearGuidance, setGuidance, setMode, state]
  );
}

export function useOnboardingCompanionGuidance(
  fallbackState?: Partial<OnboardingCompanionGuidanceState>
) {
  const context = useContext(OnboardingCompanionGuidanceContext);
  const standalone = useStandaloneGuidance(fallbackState);
  return context ?? standalone;
}
