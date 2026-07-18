import { useCallback, useEffect, useMemo, useRef } from "react";
import { type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import {
  emitVoiceTriageTouchAnswer,
  ensureVoiceSessionId,
} from "@/lib/voiceSessionBridge";
import VoiceCanvasScene from "./VoiceCanvasScene";
import {
  appointmentCanvasReducer,
  initialAppointmentCanvasState,
  isRestorableAppointmentState,
  type AppointmentCanvasDraft,
  type AppointmentCanvasState,
  type AppointmentProvider,
} from "./appointmentCanvasMachine";
import {
  appointmentCanvasViewModel,
  type AppointmentCanvasCopy,
  type AppointmentDateChoice,
} from "./appointmentCanvasViewModel";
import {
  trackAppointmentCanvasEvent,
  type AppointmentCanvasTelemetryEvent,
} from "./appointmentCanvasTelemetry";
import {
  CanvasLiveStatus,
  useCanvasAccessibility,
  useCanvasExternalActionGate,
  useCanvasSessionReducer,
  useCanvasVoiceSynchronization,
} from "./useVoiceCanvasPlatform";
export interface AppointmentVoiceCommands {
  start: string[];
  back: string[];
  cancel: string[];
  confirm: string[];
  retry: string[];
}
export interface AppointmentPreparationResult {
  reference?: string;
}
export interface AppointmentVoiceCanvasProps {
  copy: AppointmentCanvasCopy;
  providers: AppointmentProvider[];
  dateChoices: AppointmentDateChoice[];
  voiceCommands: AppointmentVoiceCommands;
  onConfirmPrepare: (
    draft: Readonly<AppointmentCanvasDraft>,
    context: { requestId: number; signal: AbortSignal },
  ) => Promise<AppointmentPreparationResult>;
  onDone?: () => void;
  onCancel?: () => void;
  storageKey?: string;
  initialState?: AppointmentCanvasState;
  onTelemetry?: (event: AppointmentCanvasTelemetryEvent) => void;
}
const normalized = (value: string) => value.trim().toLocaleLowerCase();
export function AppointmentVoiceCanvas({
  copy,
  providers,
  dateChoices,
  voiceCommands,
  onConfirmPrepare,
  onDone,
  onCancel,
  storageKey = "vyva.appointmentCanvas.v1",
  initialState,
  onTelemetry = trackAppointmentCanvasEvent,
}: AppointmentVoiceCanvasProps) {
  const inputRef = useRef<AppointmentCanvasTelemetryEvent["input"]>("system");
  const { state, dispatch, restoredRef } = useCanvasSessionReducer({
    reducer: appointmentCanvasReducer,
    initialState: initialAppointmentCanvasState,
    suppliedState: initialState,
    storageKey,
    isRestorable: isRestorableAppointmentState,
  });
  const rootRef = useCanvasAccessibility(state.step);
  const actionGate = useCanvasExternalActionGate();
  const viewModel = useMemo(
    () => appointmentCanvasViewModel(state, copy, providers, dateChoices),
    [state, copy, providers, dateChoices],
  );
  useEffect(() => {
    onTelemetry({
      name: "scene_viewed",
      step: state.step,
      input: inputRef.current,
      attempt: state.requestId,
      restored: restoredRef.current,
    });
    inputRef.current = "system";
  }, [state.step, state.requestId, onTelemetry]);
  const choose = useCallback(
    (id: string) => {
      inputRef.current = "touch_or_keyboard";
      if (id === "new-provider")
        dispatch({ type: "CHOOSE_PROVIDER", newProvider: true });
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
    [providers, dateChoices],
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
    else if (state.step === "providerEntry")
      dispatch({ type: "CONTINUE_PROVIDER" });
    else if (state.step === "reason") dispatch({ type: "CONTINUE_REASON" });
    else if (state.step === "dateTime")
      dispatch({ type: "CONTINUE_DATE_TIME" });
    else if (state.step === "review") {
      actionGate.authorize(state.requestId + 1);
      dispatch({ type: "CONFIRM" });
    } else if (state.step === "blocked") dispatch({ type: "RETRY" });
    else if (state.step === "completed") onDone?.();
  }, [state.step, state.requestId, onDone, onTelemetry, actionGate]);
  const secondary = useCallback(() => {
    inputRef.current = "touch_or_keyboard";
    if (state.step === "listening" || state.step === "blocked") {
      onTelemetry({
        name: "abandoned",
        step: state.step,
        input: inputRef.current,
        attempt: state.requestId,
        restored: restoredRef.current,
      });
      dispatch({ type: "CANCEL" });
      onCancel?.();
    } else dispatch({ type: "BACK" });
  }, [state.step, state.requestId, onCancel, onTelemetry]);
  useEffect(() => {
    if (state.step !== "waiting") return;
    const controller = actionGate.begin(state.requestId);
    if (!controller) return;
    const request = { id: state.requestId, controller };
    onConfirmPrepare(Object.freeze({ ...state.draft }), {
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
    onConfirmPrepare,
    onTelemetry,
    actionGate,
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
        const provider = providers.find((item) =>
            text.includes(normalized(item.label)),
          ),
          date = dateChoices.find((item) =>
            text.includes(normalized(item.label)),
          );
        if (state.step === "provider" && provider)
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
  const textChange = (value: string) => {
    inputRef.current = "touch_or_keyboard";
    if (state.step === "providerEntry")
      dispatch({ type: "CHANGE_PROVIDER", value });
    else if (state.step === "reason")
      dispatch({ type: "CHANGE_REASON", value });
    else if (state.step === "dateTime")
      dispatch({ type: "CHANGE_TIME", value });
  };
  return (
    <div
      ref={rootRef}
      data-testid="appointment-voice-canvas"
      data-step={state.step}
    >
      <VoiceCanvasScene
        viewModel={viewModel}
        onChoice={choose}
        onPrimary={primary}
        onSecondary={secondary}
        onTextChange={textChange}
      />
      <CanvasLiveStatus
        label={viewModel.statusLabel || viewModel.title}
        assertive={state.step === "blocked"}
      />
    </div>
  );
}
export default AppointmentVoiceCanvas;
