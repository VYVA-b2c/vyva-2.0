import { useCallback, useEffect, useMemo, useRef } from "react";
import { type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import {
  emitVoiceTriageTouchAnswer,
  ensureVoiceSessionId,
} from "@/lib/voiceSessionBridge";
import VoiceCanvasScene from "./VoiceCanvasScene";
import {
  initialRefillCanvasState,
  isRestorableRefillState,
  refillCanvasReducer,
  type RefillCanvasDraft,
  type RefillCanvasEvent,
  type RefillCanvasState,
  type RefillMedication,
  type RefillProvider,
} from "./refillCanvasMachine";
import {
  refillCanvasViewModel,
  type RefillCanvasCopy,
  type RefillContactChoice,
} from "./refillCanvasViewModel";
import {
  trackRefillCanvasEvent,
  type RefillCanvasTelemetryEvent,
} from "./refillCanvasTelemetry";
import {
  CanvasLiveStatus,
  useCanvasAccessibility,
  useCanvasExternalActionGate,
  useCanvasSessionReducer,
  useCanvasVoiceSynchronization,
} from "./useVoiceCanvasPlatform";
export interface RefillVoiceCommands {
  start: string[];
  back: string[];
  cancel: string[];
  confirm: string[];
  retry: string[];
  routine: string[];
  urgent: string[];
}
export interface RefillPreparationResult {
  reference?: string;
}
export interface RefillVoiceCanvasProps {
  copy: RefillCanvasCopy;
  medications: RefillMedication[];
  providers: RefillProvider[];
  contactChoices: RefillContactChoice[];
  voiceCommands: RefillVoiceCommands;
  urgentTerms: string[];
  onConfirmPrepare: (
    draft: Readonly<RefillCanvasDraft>,
    context: { requestId: number; signal: AbortSignal },
  ) => Promise<RefillPreparationResult>;
  onPrepared?: (
    result: Readonly<RefillPreparationResult>,
    draft: Readonly<RefillCanvasDraft>,
  ) => void;
  onUrgentHelp?: () => void;
  onDone?: () => void;
  onCancel?: () => void;
  storageKey?: string;
  initialState?: RefillCanvasState;
  onTelemetry?: (event: RefillCanvasTelemetryEvent) => void;
}
const normalize = (value: string) => value.trim().toLocaleLowerCase();
export function RefillVoiceCanvas({
  copy,
  medications,
  providers,
  contactChoices,
  voiceCommands,
  urgentTerms,
  onConfirmPrepare,
  onPrepared,
  onUrgentHelp,
  onDone,
  onCancel,
  storageKey = "vyva.refillCanvas.v1",
  initialState,
  onTelemetry = trackRefillCanvasEvent,
}: RefillVoiceCanvasProps) {
  const restoreTrackedRef = useRef(false),
    inputRef = useRef<RefillCanvasTelemetryEvent["input"]>("system");
  const { state, dispatch, restoredRef } = useCanvasSessionReducer({
    reducer: refillCanvasReducer,
    initialState: initialRefillCanvasState,
    suppliedState: initialState,
    storageKey,
    isRestorable: isRestorableRefillState,
  });
  const rootRef = useCanvasAccessibility(state.step);
  const actionGate = useCanvasExternalActionGate();
  const viewModel = useMemo(
    () =>
      refillCanvasViewModel(
        state,
        copy,
        medications,
        providers,
        contactChoices,
      ),
    [state, copy, medications, providers, contactChoices],
  );
  const urgentText = useCallback(
    (value: string) =>
      urgentTerms.some((term) => normalize(value).includes(normalize(term))),
    [urgentTerms],
  );
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
    if (state.step === "urgent")
      onTelemetry({
        name: "urgent_help_shown",
        step: "urgent",
        input: inputRef.current,
        attempt: state.requestId,
        restored: restoredRef.current,
      });
    inputRef.current = "system";
  }, [state.step, state.requestId, onTelemetry, restoredRef]);
  const choose = useCallback(
    (id: string) => {
      inputRef.current = "touch_or_keyboard";
      if (id === "manual-medication")
        dispatch({ type: "CHOOSE_MEDICATION", manual: true });
      else if (id === "cannot-identify") dispatch({ type: "CANNOT_IDENTIFY" });
      else if (id.startsWith("medication:"))
        dispatch({
          type: "CHOOSE_MEDICATION",
          medication: medications.find((item) => item.id === id.slice(11)),
        });
      else if (id === "routine") dispatch({ type: "ROUTINE_REFILL" });
      else if (id === "urgent") dispatch({ type: "URGENT" });
      else if (id === "manual-provider")
        dispatch({ type: "CHOOSE_PROVIDER", manual: true });
      else if (id.startsWith("provider:"))
        dispatch({
          type: "CHOOSE_PROVIDER",
          provider: providers.find((item) => item.id === id.slice(9)),
        });
      else if (id.startsWith("contact:")) {
        const contact = contactChoices.find((item) => item.id === id.slice(8));
        if (contact) dispatch({ type: "CHOOSE_CONTACT", value: contact.label });
      }
    },
    [medications, providers, contactChoices, dispatch],
  );
  const primary = useCallback(() => {
    inputRef.current = "touch_or_keyboard";
    if (state.step === "review")
      onTelemetry({
        name: "confirmation_submitted",
        step: "review",
        input: inputRef.current,
        attempt: state.requestId + 1,
        restored: restoredRef.current,
      });
    if (state.step === "blocked")
      onTelemetry({
        name: "retried",
        step: "blocked",
        input: inputRef.current,
        attempt: state.requestId,
        restored: restoredRef.current,
      });
    if (state.step === "listening" || state.step === "cancelled")
      dispatch({ type: "START" });
    else if (state.step === "medicationEntry")
      dispatch({ type: "CONTINUE_MEDICATION" });
    else if (state.step === "strength") dispatch({ type: "CONTINUE_STRENGTH" });
    else if (state.step === "providerEntry")
      dispatch({ type: "CONTINUE_PROVIDER" });
    else if (state.step === "quantity") dispatch({ type: "CONTINUE_QUANTITY" });
    else if (state.step === "notes") dispatch({ type: "CONTINUE_NOTES" });
    else if (state.step === "review") {
      actionGate.authorize(state.requestId + 1);
      dispatch({ type: "CONFIRM" });
    } else if (state.step === "blocked") dispatch({ type: "RETRY" });
    else if (state.step === "urgent") onUrgentHelp?.();
    else if (state.step === "completed") onDone?.();
  }, [
    state.step,
    state.requestId,
    onDone,
    onUrgentHelp,
    onTelemetry,
    actionGate,
    dispatch,
    restoredRef,
  ]);
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
          onPrepared?.(
            Object.freeze({ ...result }),
            Object.freeze({ ...state.draft }),
          );
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
    onPrepared,
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
      const apply = (refillEvent: RefillCanvasEvent) => {
        nextState = refillCanvasReducer(nextState, refillEvent);
        dispatch(refillEvent);
      };
      if (
        urgentText(text) ||
        voiceCommands.urgent.some((command) => text === normalize(command))
      )
        apply({ type: "URGENT" });
      else if (
        voiceCommands.cancel.some((command) => text === normalize(command))
      ) {
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
      ) {
        onTelemetry({
          name: "retried",
          step: "blocked",
          input: "voice",
          attempt: state.requestId,
          restored: restoredRef.current,
        });
        apply({ type: "RETRY" });
      } else if (
        voiceCommands.routine.some((command) => text === normalize(command)) &&
        state.step === "safety"
      )
        apply({ type: "ROUTINE_REFILL" });
      else {
        const medication = medications.find((item) =>
            text.includes(normalize(item.label)),
          ),
          provider = providers.find((item) =>
            text.includes(normalize(item.label)),
          ),
          contact = contactChoices.find((item) =>
            text.includes(normalize(item.label)),
          );
        if (
          state.step === "medication" &&
          text.includes(normalize(copy.medication.manual))
        )
          apply({ type: "CHOOSE_MEDICATION", manual: true });
        else if (
          state.step === "medication" &&
          text.includes(normalize(copy.medication.cannotIdentify))
        )
          apply({ type: "CANNOT_IDENTIFY" });
        else if (state.step === "medication" && medication)
          apply({ type: "CHOOSE_MEDICATION", medication });
        else if (state.step === "medicationEntry") {
          apply({ type: "CHANGE_MEDICATION", value: detail.text.trim() });
          apply({ type: "CONTINUE_MEDICATION" });
        } else if (state.step === "strength") {
          apply({ type: "CHANGE_STRENGTH", value: detail.text.trim() });
          apply({ type: "CONTINUE_STRENGTH" });
        } else if (
          state.step === "provider" &&
          text.includes(normalize(copy.provider.manual))
        )
          apply({ type: "CHOOSE_PROVIDER", manual: true });
        else if (state.step === "provider" && provider)
          apply({ type: "CHOOSE_PROVIDER", provider });
        else if (state.step === "providerEntry") {
          apply({ type: "CHANGE_PROVIDER", value: detail.text.trim() });
          apply({ type: "CONTINUE_PROVIDER" });
        } else if (state.step === "quantity") {
          apply({ type: "CHANGE_QUANTITY", value: detail.text.trim() });
          apply({ type: "CONTINUE_QUANTITY" });
        } else if (state.step === "notes") {
          apply({ type: "CHANGE_NOTES", value: detail.text.trim() });
          apply({ type: "CONTINUE_NOTES" });
        } else if (state.step === "contact" && contact)
          apply({ type: "CHOOSE_CONTACT", value: contact.label });
        else handled = false;
      }
      if (handled) {
        const nextViewModel = refillCanvasViewModel(
          nextState,
          copy,
          medications,
          providers,
          contactChoices,
        );
        emitVoiceTriageTouchAnswer({
          conversationId: ensureVoiceSessionId(),
          utterance: detail.text,
          choiceId: nextState.step,
          nextQuestion: nextViewModel.title,
          status: nextState.step,
        });
      }
  });
  const textChange = (value: string) => {
    inputRef.current = "touch_or_keyboard";
    if (state.step === "notes" && urgentText(value)) {
      dispatch({ type: "URGENT" });
      return;
    }
    if (state.step === "medicationEntry")
      dispatch({ type: "CHANGE_MEDICATION", value });
    else if (state.step === "strength")
      dispatch({ type: "CHANGE_STRENGTH", value });
    else if (state.step === "providerEntry")
      dispatch({ type: "CHANGE_PROVIDER", value });
    else if (state.step === "quantity")
      dispatch({ type: "CHANGE_QUANTITY", value });
    else if (state.step === "notes") dispatch({ type: "CHANGE_NOTES", value });
  };
  return (
    <div ref={rootRef} data-testid="refill-voice-canvas" data-step={state.step}>
      <VoiceCanvasScene
        viewModel={viewModel}
        onChoice={choose}
        onPrimary={primary}
        onSecondary={secondary}
        onTextChange={textChange}
      />
      <CanvasLiveStatus
        label={viewModel.statusLabel || viewModel.title}
        assertive={state.step === "blocked" || state.step === "urgent"}
      />
    </div>
  );
}
export default RefillVoiceCanvas;
