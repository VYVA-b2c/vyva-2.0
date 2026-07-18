import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
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
