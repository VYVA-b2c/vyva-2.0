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
  type AppointmentCanvasEvent,
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
  findVoiceCanvasSpokenOption,
  useCanvasAccessibility,
  useCanvasExternalActionGate,
  useCanvasSessionReducer,
  useCanvasVoiceSynchronization,
  useVoiceCanvasMultimodalInteraction,
  voiceCanvasTextMatchesAny,
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
const matches = (text: string, commands: string[]) =>
  voiceCanvasTextMatchesAny(text, commands, "exact");
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
  const stateRef = useRef(state);
  const rootRef = useCanvasAccessibility(state.step);
  const actionGate = useCanvasExternalActionGate();
  const baseViewModel = useMemo(
    () => appointmentCanvasViewModel(state, copy, providers, dateChoices),
    [state, copy, providers, dateChoices],
  );
  const {
    viewModel,
    acknowledgeChoice,
    clearFeedback,
  } = useVoiceCanvasMultimodalInteraction<AppointmentCanvasState, AppointmentCanvasEvent>({
    viewModel: baseViewModel,
    agentPresenceCopy: copy.agentPresence,
    stateRef,
    reducer: appointmentCanvasReducer,
    dispatch,
    getStep: (nextState) => nextState.step,
    getViewModel: (nextState) =>
      appointmentCanvasViewModel(nextState, copy, providers, dateChoices),
  });
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
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
      clearFeedback();
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
    [providers, dateChoices, dispatch, clearFeedback],
  );
  const primary = useCallback(() => {
    clearFeedback();
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
  }, [state.step, state.requestId, onDone, onTelemetry, actionGate, dispatch, restoredRef, clearFeedback]);
  const secondary = useCallback(() => {
    clearFeedback();
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
  }, [state.step, state.requestId, onCancel, onTelemetry, dispatch, restoredRef, clearFeedback]);
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
    dispatch,
    restoredRef,
  ]);
  useCanvasVoiceSynchronization((event: Event) => {
      const detail = (event as CustomEvent<VoiceUserMessageDetail>).detail;
      if (!detail?.text) return;
      clearFeedback();
      inputRef.current = "voice";
      const text = normalized(detail.text);
      let handled = true;
      if (matches(text, voiceCommands.cancel)) {
        onTelemetry({
          name: "abandoned",
          step: state.step,
          input: "voice",
          attempt: state.requestId,
          restored: restoredRef.current,
        });
        dispatch({ type: "CANCEL" });
        onCancel?.();
      } else if (matches(text, voiceCommands.back))
        dispatch({ type: "BACK" });
      else if (matches(text, voiceCommands.start))
        dispatch({ type: "START" });
      else if (
        matches(text, voiceCommands.confirm) &&
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
        matches(text, voiceCommands.retry) &&
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
        const provider = findVoiceCanvasSpokenOption(
            providers,
            text,
            (item) => [item.label, item.description],
            "contains",
          ),
          date = findVoiceCanvasSpokenOption(
            dateChoices,
            text,
            (item) => [item.label],
            "contains",
          );
        if (state.step === "provider" && provider)
          {
            acknowledgeChoice({
              choiceId: `provider:${provider.id}`,
              label: provider.label,
              expectedStep: "provider",
              event: { type: "CHOOSE_PROVIDER", provider },
              detail,
            });
            return;
          }
        else if (state.step === "dateTime" && date)
          {
            acknowledgeChoice({
              choiceId: `date:${date.id}`,
              label: date.label,
              expectedStep: "dateTime",
              event: { type: "CHOOSE_DATE", value: date.value },
              detail,
            });
            return;
          }
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
    clearFeedback();
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
