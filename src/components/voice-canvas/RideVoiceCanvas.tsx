import { useCallback, useEffect, useMemo, useRef } from "react";
import { type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import {
  emitVoiceTriageTouchAnswer,
  ensureVoiceSessionId,
} from "@/lib/voiceSessionBridge";
import VoiceCanvasScene from "./VoiceCanvasScene";
import {
  initialRideCanvasState,
  isRestorableRideState,
  rideCanvasReducer,
  type RideCanvasDraft,
  type RideCanvasState,
  type RidePlace,
  type RideProviderOption,
} from "./rideCanvasMachine";
import {
  rideCanvasViewModel,
  type RideCanvasCopy,
  type RideDateChoice,
} from "./rideCanvasViewModel";
import {
  trackRideCanvasEvent,
  type RideCanvasTelemetryEvent,
} from "./rideCanvasTelemetry";
import {
  CanvasLiveStatus,
  useCanvasAccessibility,
  useCanvasExternalActionGate,
  useCanvasSessionReducer,
  useCanvasVoiceSynchronization,
  useVoiceCanvasAgentPresence,
} from "./useVoiceCanvasPlatform";

export interface RideVoiceCommands {
  start: string[];
  back: string[];
  cancel: string[];
  confirm: string[];
  retry: string[];
}
export interface RideConfirmationResult {
  reference?: string;
}
export interface RideVoiceCanvasProps {
  copy: RideCanvasCopy;
  places: RidePlace[];
  providers: RideProviderOption[];
  dateChoices: RideDateChoice[];
  voiceCommands: RideVoiceCommands;
  onConfirmRide: (
    draft: Readonly<RideCanvasDraft>,
    context: { requestId: number; signal: AbortSignal },
  ) => Promise<RideConfirmationResult>;
  onDone?: () => void;
  onCancel?: () => void;
  storageKey?: string;
  initialState?: RideCanvasState;
  onTelemetry?: (event: RideCanvasTelemetryEvent) => void;
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function RideVoiceCanvas({
  copy,
  places,
  providers,
  dateChoices,
  voiceCommands,
  onConfirmRide,
  onDone,
  onCancel,
  storageKey = "vyva.rideCanvas.v1",
  initialState,
  onTelemetry = trackRideCanvasEvent,
}: RideVoiceCanvasProps) {
  const inputRef = useRef<RideCanvasTelemetryEvent["input"]>("system");
  const { state, dispatch, restoredRef } = useCanvasSessionReducer({
    reducer: rideCanvasReducer,
    initialState: initialRideCanvasState,
    suppliedState: initialState,
    storageKey,
    isRestorable: isRestorableRideState,
  });
  const rootRef = useCanvasAccessibility(state.step);
  const actionGate = useCanvasExternalActionGate();
  const baseViewModel = useMemo(
    () => rideCanvasViewModel(state, copy, places, providers, dateChoices),
    [state, copy, places, providers, dateChoices],
  );
  const viewModel = useVoiceCanvasAgentPresence(baseViewModel, copy.agentPresence);

  useEffect(() => {
    onTelemetry({
      name: "scene_viewed",
      step: state.step,
      input: inputRef.current,
      attempt: state.requestId,
      restored: restoredRef.current,
    });
    inputRef.current = "system";
  }, [state.step, state.requestId, onTelemetry, restoredRef]);

  const choose = useCallback(
    (id: string) => {
      inputRef.current = "touch_or_keyboard";
      if (id === "new-address")
        dispatch({ type: "CHOOSE_PLACE", newAddress: true });
      else if (id.startsWith("place:"))
        dispatch({
          type: "CHOOSE_PLACE",
          place: places.find((place) => place.id === id.slice(6)),
        });
      else if (id.startsWith("provider:"))
        dispatch({
          type: "CHOOSE_PROVIDER",
          provider: providers.find((provider) => provider.id === id.slice(9)),
        });
      else if (id.startsWith("date:")) {
        const date = dateChoices.find((item) => item.id === id.slice(5));
        if (date) dispatch({ type: "CHOOSE_DATE", value: date.value });
      }
    },
    [places, providers, dateChoices, dispatch],
  );

  const primary = useCallback(() => {
    inputRef.current = "touch_or_keyboard";
    if (state.step === "review")
      onTelemetry({
        name: "confirmation_submitted",
        step: state.step,
        input: inputRef.current,
        attempt: state.requestId + 1,
        restored: restoredRef.current,
      });
    if (state.step === "blocked")
      onTelemetry({
        name: "retried",
        step: state.step,
        input: inputRef.current,
        attempt: state.requestId,
        restored: restoredRef.current,
      });
    if (state.step === "listening" || state.step === "cancelled")
      dispatch({ type: "START" });
    else if (state.step === "address") dispatch({ type: "CONTINUE_ADDRESS" });
    else if (state.step === "dateTime")
      dispatch({ type: "CONTINUE_DATE_TIME" });
    else if (state.step === "review") {
      actionGate.authorize(state.requestId + 1);
      dispatch({ type: "CONFIRM" });
    } else if (state.step === "blocked") dispatch({ type: "RETRY" });
    else if (state.step === "completed") onDone?.();
  }, [state.step, state.requestId, onDone, onTelemetry, actionGate, dispatch, restoredRef]);
  const secondary = useCallback(() => {
    inputRef.current = "touch_or_keyboard";
    if (state.step === "listening" || state.step === "blocked")
      onTelemetry({
        name: "abandoned",
        step: state.step,
        input: inputRef.current,
        attempt: state.requestId,
        restored: restoredRef.current,
      });
    if (state.step === "listening" || state.step === "blocked") {
      dispatch({ type: "CANCEL" });
      onCancel?.();
    } else dispatch({ type: "BACK" });
  }, [state.step, state.requestId, onCancel, onTelemetry, dispatch, restoredRef]);

  useEffect(() => {
    if (state.step !== "waiting") return;
    const controller = actionGate.begin(state.requestId);
    if (!controller) return;
    const request = { id: state.requestId, controller };
    onConfirmRide(Object.freeze({ ...state.draft }), {
      requestId: request.id,
      signal: controller.signal,
    })
      .then((result) => {
        if (actionGate.isCurrent(request.id, controller)) {
          onTelemetry({
            name: "completed",
            step: "completed",
            input: "system",
            attempt: request.id,
            restored: restoredRef.current,
          });
          dispatch({
            type: "RESOLVE",
            requestId: request.id,
            reference: result.reference,
          });
        }
      })
      .catch((error) => {
        if (actionGate.isCurrent(request.id, controller)) {
          onTelemetry({
            name: "failed",
            step: "blocked",
            input: "system",
            attempt: request.id,
            restored: restoredRef.current,
          });
          dispatch({
            type: "REJECT",
            requestId: request.id,
            message: error instanceof Error ? error.message : undefined,
          });
        }
      });
  }, [
    state.step,
    state.requestId,
    state.draft,
    onConfirmRide,
    onTelemetry,
    actionGate,
    dispatch,
    restoredRef,
  ]);

  useCanvasVoiceSynchronization((event: Event) => {
      const detail = (event as CustomEvent<VoiceUserMessageDetail>).detail;
      if (!detail?.text) return;
      inputRef.current = "voice";
      const text = normalized(detail.text);
      let handled = true;
      if (
        voiceCommands.cancel.some((command) => text === normalized(command))
      ) {
        onTelemetry({
          name: "abandoned",
          step: state.step,
          input: "voice",
          attempt: state.requestId,
          restored: restoredRef.current,
        });
        dispatch({ type: "CANCEL" });
        onCancel?.();
      } else if (
        voiceCommands.back.some((command) => text === normalized(command))
      )
        dispatch({ type: "BACK" });
      else if (
        voiceCommands.start.some((command) => text === normalized(command))
      )
        dispatch({ type: "START" });
      else if (
        voiceCommands.confirm.some((command) => text === normalized(command)) &&
        state.step === "review"
      ) {
        actionGate.authorize(state.requestId + 1);
        onTelemetry({
          name: "confirmation_submitted",
          step: state.step,
          input: "voice",
          attempt: state.requestId + 1,
          restored: restoredRef.current,
        });
        dispatch({ type: "CONFIRM" });
      } else if (
        voiceCommands.retry.some((command) => text === normalized(command)) &&
        state.step === "blocked"
      ) {
        onTelemetry({
          name: "retried",
          step: state.step,
          input: "voice",
          attempt: state.requestId,
          restored: restoredRef.current,
        });
        dispatch({ type: "RETRY" });
      } else {
        const place = places.find((item) =>
          [item.label, item.address, ...(item.voiceAliases ?? [])].some((value) =>
            text.includes(normalized(value)),
          ),
        );
        const provider = providers.find((item) =>
          [item.label, item.description ?? "", ...(item.voiceAliases ?? [])].some((value) =>
            value && text.includes(normalized(value)),
          ),
        );
        const date = dateChoices.find((item) =>
          text.includes(normalized(item.label)),
        );
        if (state.step === "place" && place)
          dispatch({ type: "CHOOSE_PLACE", place });
        else if (state.step === "provider" && provider)
          dispatch({ type: "CHOOSE_PROVIDER", provider });
        else if (state.step === "dateTime" && date)
          dispatch({ type: "CHOOSE_DATE", value: date.value });
        else handled = false;
      }
      if (handled)
        emitVoiceTriageTouchAnswer({
          conversationId: ensureVoiceSessionId(),
          utterance: detail.text,
          choiceId: state.step,
          nextQuestion: viewModel.title,
          status: state.step,
        });
  });

  return (
    <div ref={rootRef} data-testid="ride-voice-canvas" data-step={state.step}>
      <VoiceCanvasScene
        viewModel={viewModel}
        onChoice={choose}
        onPrimary={primary}
        onSecondary={secondary}
        onTextChange={(value) => {
          inputRef.current = "touch_or_keyboard";
          dispatch({
            type: state.step === "dateTime" ? "CHANGE_TIME" : "CHANGE_ADDRESS",
            value,
          });
        }}
      />
      <CanvasLiveStatus
        label={viewModel.statusLabel || viewModel.title}
        assertive={state.step === "blocked"}
      />
    </div>
  );
}

export default RideVoiceCanvas;
