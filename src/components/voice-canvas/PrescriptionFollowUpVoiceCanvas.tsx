import { useCallback, useEffect, useMemo, useRef } from "react";
import { type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import {
  emitVoiceTriageTouchAnswer,
  ensureVoiceSessionId,
} from "@/lib/voiceSessionBridge";
import VoiceCanvasScene from "./VoiceCanvasScene";
import {
  initialPrescriptionFollowUpState,
  isRestorablePrescriptionFollowUpState,
  prescriptionFollowUpReducer,
  type PrescriptionFollowUpAction,
  type PrescriptionFollowUpEvent,
  type PrescriptionFollowUpSource,
  type PrescriptionFollowUpState,
} from "./prescriptionFollowUpMachine";
import {
  prescriptionFollowUpViewModel,
  type PrescriptionFollowUpCopy,
} from "./prescriptionFollowUpViewModel";
import {
  trackPrescriptionFollowUpEvent,
  type PrescriptionFollowUpTelemetryEvent,
} from "./prescriptionFollowUpTelemetry";
import {
  CanvasLiveStatus,
  useCanvasAccessibility,
  useCanvasExternalActionGate,
  useCanvasSessionReducer,
  useCanvasVoiceSynchronization,
  useVoiceCanvasAgentPresence,
} from "./useVoiceCanvasPlatform";
export interface PrescriptionFollowUpCommands {
  start: string[];
  back: string[];
  cancel: string[];
  confirm: string[];
  retry: string[];
  clinician: string[];
  pharmacy: string[];
  status: string[];
  update: string[];
}
export interface PrescriptionFollowUpResult {
  outcome: "completed" | "pending";
  reference?: string;
}
export interface PrescriptionFollowUpVoiceCanvasProps {
  source: PrescriptionFollowUpSource;
  copy: PrescriptionFollowUpCopy;
  voiceCommands: PrescriptionFollowUpCommands;
  onConfirm: (
    source: Readonly<PrescriptionFollowUpSource>,
    draft: Readonly<PrescriptionFollowUpState["draft"]>,
    context: { requestId: number; signal: AbortSignal },
  ) => Promise<PrescriptionFollowUpResult>;
  onDone?: () => void;
  onCancel?: () => void;
  storageKey?: string;
  initialState?: PrescriptionFollowUpState;
  onTelemetry?: (event: PrescriptionFollowUpTelemetryEvent) => void;
}
const normalize = (value: string) => value.trim().toLocaleLowerCase();
export function PrescriptionFollowUpVoiceCanvas({
  source,
  copy,
  voiceCommands,
  onConfirm,
  onDone,
  onCancel,
  storageKey = "vyva.prescriptionFollowUp.v1",
  initialState,
  onTelemetry = trackPrescriptionFollowUpEvent,
}: PrescriptionFollowUpVoiceCanvasProps) {
  const restoreTrackedRef = useRef(false),
    inputRef = useRef<PrescriptionFollowUpTelemetryEvent["input"]>("system");
  const { state, dispatch, restoredRef } = useCanvasSessionReducer({
    reducer: prescriptionFollowUpReducer,
    initialState: () => initialPrescriptionFollowUpState(source),
    suppliedState: initialState,
    storageKey,
    isRestorable: (value): value is PrescriptionFollowUpState =>
      isRestorablePrescriptionFollowUpState(value) &&
      value.source.preparationReference === source.preparationReference,
  });
  const rootRef = useCanvasAccessibility(state.step);
  const actionGate = useCanvasExternalActionGate();
  const baseViewModel = useMemo(
    () => prescriptionFollowUpViewModel(state, copy),
    [state, copy],
  );
  const viewModel = useVoiceCanvasAgentPresence(baseViewModel, copy.agentPresence);
  useEffect(() => {
    if (restoredRef.current && !restoreTrackedRef.current) {
      restoreTrackedRef.current = true;
      onTelemetry({
        name: "draft_restored",
        step: state.step,
        input: "system",
        attempt: state.requestId,
        restored: true,
      });
    }
  }, [state.step, state.requestId, onTelemetry, restoredRef]);
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
  const choose = useCallback((id: string) => {
    inputRef.current = "touch_or_keyboard";
    if (["clinician", "pharmacy", "status", "update"].includes(id))
      dispatch({
        type: "CHOOSE_ACTION",
        action: id as Exclude<PrescriptionFollowUpAction, "">,
      });
  }, [dispatch]);
  const primary = useCallback(() => {
    inputRef.current = "touch_or_keyboard";
    if (state.step === "listening" || state.step === "cancelled")
      dispatch({ type: "START" });
    else if (state.step === "missingInfo") dispatch({ type: "CONTINUE" });
    else if (state.step === "review") {
      actionGate.authorize(state.requestId + 1);
      onTelemetry({
        name: "confirmation_submitted",
        step: "review",
        input: inputRef.current,
        attempt: state.requestId + 1,
        restored: restoredRef.current,
      });
      dispatch({ type: "CONFIRM" });
    } else if (state.step === "blocked") {
      onTelemetry({
        name: "retried",
        step: "blocked",
        input: inputRef.current,
        attempt: state.requestId,
        restored: restoredRef.current,
      });
      dispatch({ type: "RETRY" });
    } else if (state.step === "completed" || state.step === "pending")
      onDone?.();
  }, [state.step, state.requestId, onDone, onTelemetry, actionGate, dispatch, restoredRef]);
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
  }, [state.step, state.requestId, onCancel, onTelemetry, dispatch, restoredRef]);
  useEffect(() => {
    if (state.step !== "waiting") return;
    const controller = actionGate.begin(state.requestId);
    if (!controller) return;
    const request = { id: state.requestId, controller };
    onConfirm(
      Object.freeze({
        ...state.source,
        draft: Object.freeze({ ...state.source.draft }),
      }),
      Object.freeze({ ...state.draft }),
      { requestId: request.id, signal: controller.signal },
    )
      .then((result) => {
        if (actionGate.isCurrent(request.id, controller)) {
          onTelemetry({
            name: result.outcome,
            step: result.outcome,
            input: "system",
            attempt: request.id,
            restored: restoredRef.current,
          });
          dispatch({ type: "RESOLVE", requestId: request.id, ...result });
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
    state.source,
    state.draft,
    onConfirm,
    onTelemetry,
    actionGate,
    dispatch,
    restoredRef,
  ]);
  useCanvasVoiceSynchronization((event: Event) => {
      const detail = (event as CustomEvent<VoiceUserMessageDetail>).detail;
      if (!detail?.text) return;
      inputRef.current = "voice";
      const text = normalize(detail.text);
      let handled = true,
        nextState = state;
      const apply = (item: PrescriptionFollowUpEvent) => {
        nextState = prescriptionFollowUpReducer(nextState, item);
        dispatch(item);
      };
      if (voiceCommands.cancel.some((command) => text === normalize(command))) {
        onTelemetry({
          name: "abandoned",
          step: state.step,
          input: "voice",
          attempt: state.requestId,
          restored: restoredRef.current,
        });
        apply({ type: "CANCEL" });
        onCancel?.();
      } else if (
        voiceCommands.back.some((command) => text === normalize(command))
      )
        apply({ type: "BACK" });
      else if (
        voiceCommands.start.some((command) => text === normalize(command))
      )
        apply({ type: "START" });
      else if (
        voiceCommands.confirm.some((command) => text === normalize(command)) &&
        state.step === "review"
      ) {
        actionGate.authorize(state.requestId + 1);
        onTelemetry({
          name: "confirmation_submitted",
          step: "review",
          input: "voice",
          attempt: state.requestId + 1,
          restored: restoredRef.current,
        });
        apply({ type: "CONFIRM" });
      } else if (
        voiceCommands.retry.some((command) => text === normalize(command)) &&
        state.step === "blocked"
      )
        apply({ type: "RETRY" });
      else if (state.step === "nextStep") {
        const action = (
          ["clinician", "pharmacy", "status", "update"] as const
        ).find((key) =>
          voiceCommands[key].some((command) =>
            text.includes(normalize(command)),
          ),
        );
        if (action) apply({ type: "CHOOSE_ACTION", action });
        else handled = false;
      } else if (state.step === "missingInfo") {
        apply({ type: "CHANGE_MISSING_INFO", value: detail.text.trim() });
        apply({ type: "CONTINUE" });
      } else handled = false;
      if (handled) {
        const next = prescriptionFollowUpViewModel(nextState, copy);
        emitVoiceTriageTouchAnswer({
          conversationId: ensureVoiceSessionId(),
          utterance: detail.text,
          choiceId: nextState.step,
          nextQuestion: next.title,
          status: nextState.step,
        });
      }
  });
  return (
    <div
      ref={rootRef}
      data-testid="prescription-follow-up-voice-canvas"
      data-step={state.step}
    >
      <VoiceCanvasScene
        viewModel={viewModel}
        onChoice={choose}
        onPrimary={primary}
        onSecondary={secondary}
        onTextChange={(value) => {
          inputRef.current = "touch_or_keyboard";
          dispatch({ type: "CHANGE_MISSING_INFO", value });
        }}
      />
      <CanvasLiveStatus
        label={viewModel.statusLabel || viewModel.title}
        assertive={state.step === "blocked"}
      />
    </div>
  );
}
export default PrescriptionFollowUpVoiceCanvas;
