import { useCallback, useEffect, useMemo, useRef } from "react";
import { type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import {
  emitVoiceTriageTouchAnswer,
  ensureVoiceSessionId,
} from "@/lib/voiceSessionBridge";
import VoiceCanvasScene from "./VoiceCanvasScene";
import {
  initialProviderReplyCanvasState,
  isRestorableProviderReplyCanvasState,
  isValidProviderReplyScheduledFor,
  providerReplyCanvasReducer,
  type ProviderReplyCanvasDraft,
  type ProviderReplyCanvasEvent,
  type ProviderReplyCanvasState,
} from "./providerReplyCanvasMachine";
import {
  providerReplyCanvasViewModel,
  type ProviderReplyCanvasContext,
  type ProviderReplyCanvasCopy,
} from "./providerReplyCanvasViewModel";
import {
  trackProviderReplyCanvasEvent,
  type ProviderReplyCanvasTelemetryEvent,
} from "./providerReplyCanvasTelemetry";
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

export interface ProviderReplyVoiceCommands {
  start: string[];
  back: string[];
  cancel: string[];
  continue: string[];
  save: string[];
  complete: string[];
  retry: string[];
  skip: string[];
}

export interface ProviderReplySaveResult {
  summary?: string;
  reference?: string;
}

export interface ProviderReplyCompleteResult {
  reference?: string;
}

export interface ProviderReplyVoiceCanvasProps {
  copy: ProviderReplyCanvasCopy;
  context: ProviderReplyCanvasContext;
  voiceCommands: ProviderReplyVoiceCommands;
  onSaveReply: (
    draft: Readonly<ProviderReplyCanvasDraft>,
    context: { requestId: number; revision: number; signal: AbortSignal },
  ) => Promise<ProviderReplySaveResult>;
  onMarkComplete: (
    draft: Readonly<ProviderReplyCanvasDraft>,
    context: { requestId: number; revision: number; signal: AbortSignal },
  ) => Promise<ProviderReplyCompleteResult>;
  onDone?: () => void;
  onCancel?: () => void;
  storageKey?: string;
  initialState?: ProviderReplyCanvasState;
  initialDraft?: Partial<ProviderReplyCanvasDraft>;
  onTelemetry?: (event: ProviderReplyCanvasTelemetryEvent) => void;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();
const matches = (text: string, commands: string[]) =>
  voiceCanvasTextMatchesAny(text, commands, "exact");

function freezeDraft(draft: ProviderReplyCanvasDraft) {
  return Object.freeze({ ...draft });
}

export function ProviderReplyVoiceCanvas({
  copy,
  context,
  voiceCommands,
  onSaveReply,
  onMarkComplete,
  onDone,
  onCancel,
  storageKey = "vyva.providerReplyCanvas.v1",
  initialState,
  initialDraft,
  onTelemetry = trackProviderReplyCanvasEvent,
}: ProviderReplyVoiceCanvasProps) {
  const restoreTrackedRef = useRef(false);
  const inputRef = useRef<ProviderReplyCanvasTelemetryEvent["input"]>("system");
  const initial = useMemo<ProviderReplyCanvasState>(() => ({
    ...initialProviderReplyCanvasState,
    draft: {
      ...initialProviderReplyCanvasState.draft,
      ...initialDraft,
    },
  }), [initialDraft]);
  const { state, dispatch, restoredRef } = useCanvasSessionReducer({
    reducer: providerReplyCanvasReducer,
    initialState: initial,
    suppliedState: initialState,
    storageKey,
    isRestorable: isRestorableProviderReplyCanvasState,
  });
  const stateRef = useRef(state);
  const rootRef = useCanvasAccessibility(state.step);
  const actionGate = useCanvasExternalActionGate();
  const baseViewModel = useMemo(
    () => providerReplyCanvasViewModel(state, copy, context),
    [state, copy, context],
  );
  const {
    viewModel,
    acknowledgeChoice,
    clearFeedback: clearSpokenChoice,
  } = useVoiceCanvasMultimodalInteraction<ProviderReplyCanvasState, ProviderReplyCanvasEvent>({
    viewModel: baseViewModel,
    agentPresenceCopy: copy.agentPresence,
    stateRef,
    reducer: providerReplyCanvasReducer,
    dispatch,
    getStep: (nextState) => nextState.step,
    getViewModel: (nextState) =>
      providerReplyCanvasViewModel(nextState, copy, context),
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (restoredRef.current && !restoreTrackedRef.current) {
      restoreTrackedRef.current = true;
      onTelemetry({
        name: "draft_restored",
        step: state.step,
        input: "system",
        attempt: state.requestId,
        revision: state.revision,
        restored: true,
      });
    }
  }, [state.step, state.requestId, state.revision, onTelemetry, restoredRef]);

  useEffect(() => {
    onTelemetry({
      name: "scene_viewed",
      step: state.step,
      input: inputRef.current,
      attempt: state.requestId,
      revision: state.revision,
      restored: restoredRef.current,
    });
    inputRef.current = "system";
  }, [state.step, state.requestId, state.revision, onTelemetry, restoredRef]);

  const submit = useCallback((event: ProviderReplyCanvasEvent) => {
    if (event.type === "SAVE_REPLY") {
      actionGate.authorize(state.requestId + 1, state.revision);
      onTelemetry({
        name: "confirmation_submitted",
        step: "review",
        input: inputRef.current,
        attempt: state.requestId + 1,
        revision: state.revision,
        restored: restoredRef.current,
      });
    } else if (event.type === "COMPLETE") {
      actionGate.authorize(state.requestId + 1, state.revision);
      onTelemetry({
        name: "confirmation_submitted",
        step: "saved",
        input: inputRef.current,
        attempt: state.requestId + 1,
        revision: state.revision,
        restored: restoredRef.current,
      });
    } else if (event.type === "RETRY") {
      onTelemetry({
        name: "retried",
        step: "blocked",
        input: inputRef.current,
        attempt: state.requestId,
        revision: state.revision,
        restored: restoredRef.current,
      });
    }
    dispatch(event);
  }, [actionGate, dispatch, onTelemetry, restoredRef, state.requestId, state.revision]);

  const choose = useCallback((id: string) => {
    clearSpokenChoice();
    inputRef.current = "touch_or_keyboard";
    if (!id.startsWith("intent:")) return;
    const intent = context.replyIntents?.find((item) => item.id === id.slice(7));
    if (!intent) return;
    submit({
      type: "CHOOSE_INTENT",
      intent,
      blockedMessage: copy.blocked.urgentBoundaryHelper,
    });
  }, [context.replyIntents, copy.blocked.urgentBoundaryHelper, submit, clearSpokenChoice]);

  const primary = useCallback(() => {
    clearSpokenChoice();
    inputRef.current = "touch_or_keyboard";
    if (state.step === "listening" || state.step === "cancelled") submit({ type: "START" });
    else if (state.step === "context")
      submit({
        type: "CONTINUE_CONTEXT",
        requiresIntent: Boolean(context.replyIntents?.length),
      });
    else if (state.step === "reply")
      submit({
        type: "CONTINUE_REPLY",
        requiresScheduledFor: context.requiresScheduledFor === true,
      });
    else if (state.step === "scheduledFor") submit({ type: "CONTINUE_SCHEDULED_FOR" });
    else if (state.step === "details") submit({ type: "CONTINUE_DETAILS" });
    else if (state.step === "review") submit({ type: "SAVE_REPLY" });
    else if (state.step === "saved") submit({ type: "COMPLETE" });
    else if (state.step === "blocked") submit({ type: "RETRY" });
    else if (state.step === "completed") onDone?.();
  }, [context.replyIntents, context.requiresScheduledFor, onDone, state.step, submit, clearSpokenChoice]);

  const secondary = useCallback(() => {
    clearSpokenChoice();
    inputRef.current = "touch_or_keyboard";
    if (state.step === "listening" || state.step === "blocked") {
      onTelemetry({
        name: "abandoned",
        step: state.step,
        input: inputRef.current,
        attempt: state.requestId,
        revision: state.revision,
        restored: restoredRef.current,
      });
      dispatch({ type: "CANCEL" });
      onCancel?.();
    } else if (state.step === "saved") {
      dispatch({ type: "EDIT" });
    } else {
      dispatch({ type: "BACK" });
    }
  }, [dispatch, onCancel, onTelemetry, restoredRef, state.requestId, state.revision, state.step, clearSpokenChoice]);

  const change = useCallback((value: string) => {
    clearSpokenChoice();
    inputRef.current = "touch_or_keyboard";
    if (state.step === "reply") dispatch({ type: "CHANGE_REPLY", value });
    else if (state.step === "scheduledFor")
      dispatch({ type: "CHANGE_SCHEDULED_FOR", value });
    else if (state.step === "details") dispatch({ type: "CHANGE_NOTES", value });
  }, [dispatch, state.step, clearSpokenChoice]);

  useEffect(() => {
    if (state.step !== "saving" && state.step !== "completing") return;
    const controller = actionGate.begin(state.requestId, state.revision);
    if (!controller) return;
    const requestId = state.requestId;
    const run = state.step === "saving"
      ? onSaveReply(freezeDraft(state.draft), {
          requestId,
          revision: state.revision,
          signal: controller.signal,
        }).then((result) => {
          if (!actionGate.isCurrent(requestId, controller)) return;
          onTelemetry({
            name: "saved",
            step: "saved",
            input: "system",
            attempt: requestId,
            revision: state.revision,
            restored: restoredRef.current,
          });
          dispatch({ type: "SAVE_RESOLVE", requestId, ...result });
        })
      : onMarkComplete(freezeDraft(state.draft), {
          requestId,
          revision: state.revision,
          signal: controller.signal,
        }).then((result) => {
          if (!actionGate.isCurrent(requestId, controller)) return;
          onTelemetry({
            name: "completed",
            step: "completed",
            input: "system",
            attempt: requestId,
            revision: state.revision,
            restored: restoredRef.current,
          });
          dispatch({ type: "COMPLETE_RESOLVE", requestId, ...result });
        });
    run.catch((error) => {
      if (!actionGate.isCurrent(requestId, controller)) return;
      onTelemetry({
        name: "failed",
        step: "blocked",
        input: "system",
        attempt: requestId,
        revision: state.revision,
        restored: restoredRef.current,
      });
      dispatch({
        type: state.step === "saving" ? "SAVE_REJECT" : "COMPLETE_REJECT",
        requestId,
        message: error instanceof Error ? error.message : undefined,
      });
    });
  }, [
    actionGate,
    dispatch,
    onMarkComplete,
    onSaveReply,
    onTelemetry,
    restoredRef,
    state.draft,
    state.requestId,
    state.revision,
    state.step,
  ]);

  useCanvasVoiceSynchronization((event: Event) => {
    const detail = (event as CustomEvent<VoiceUserMessageDetail>).detail;
    if (!detail?.text) return;
    clearSpokenChoice();
    inputRef.current = "voice";
    const text = normalize(detail.text);
    let eventToDispatch: ProviderReplyCanvasEvent | null = null;
    if (matches(text, voiceCommands.cancel)) eventToDispatch = { type: "CANCEL" };
    else if (matches(text, voiceCommands.back)) eventToDispatch = { type: "BACK" };
    else if (matches(text, voiceCommands.start)) eventToDispatch = { type: "START" };
    else if (state.step === "context" && matches(text, voiceCommands.continue))
      eventToDispatch = {
        type: "CONTINUE_CONTEXT",
        requiresIntent: Boolean(context.replyIntents?.length),
      };
    else if (state.step === "context") {
      const intent = findVoiceCanvasSpokenOption(
        context.replyIntents ?? [],
        text,
        (item) => [item.label, ...(item.voiceAliases ?? [])],
      );
      if (intent) {
        const choiceEvent: ProviderReplyCanvasEvent = {
          type: "CHOOSE_INTENT",
          intent,
          blockedMessage: copy.blocked.urgentBoundaryHelper,
        };
        if (intent.urgent) eventToDispatch = choiceEvent;
        else {
          acknowledgeChoice({
            choiceId: `intent:${intent.id}`,
            label: intent.label,
            expectedStep: "context",
            event: choiceEvent,
            detail,
          });
          return;
        }
      }
    }
    else if (state.step === "reply" && matches(text, voiceCommands.continue))
      eventToDispatch = state.draft.providerReply.trim()
        ? {
            type: "CONTINUE_REPLY",
            requiresScheduledFor: context.requiresScheduledFor === true,
          }
        : {
            type: "INVALID_REQUIRED_INFO",
            message: copy.blocked.incompleteReplyHelper,
            retryTarget: "reply",
          };
    else if (state.step === "scheduledFor" && matches(text, voiceCommands.continue))
      eventToDispatch = isValidProviderReplyScheduledFor(state.draft.scheduledFor)
        ? { type: "CONTINUE_SCHEDULED_FOR" }
        : {
            type: "INVALID_REQUIRED_INFO",
            message: copy.blocked.incompleteScheduledForHelper,
            retryTarget: "scheduledFor",
          };
    else if (state.step === "details" && matches(text, voiceCommands.continue))
      eventToDispatch = { type: "CONTINUE_DETAILS" };
    else if (state.step === "review" && matches(text, voiceCommands.save))
      eventToDispatch = { type: "SAVE_REPLY" };
    else if (state.step === "saved" && matches(text, voiceCommands.complete))
      eventToDispatch = { type: "COMPLETE" };
    else if (state.step === "blocked" && matches(text, voiceCommands.retry))
      eventToDispatch = { type: "RETRY" };
    else if (state.step === "details" && matches(text, voiceCommands.skip))
      eventToDispatch = { type: "CONTINUE_DETAILS" };
    else if (state.step === "reply") {
      dispatch({ type: "CHANGE_REPLY", value: detail.text.trim() });
      eventToDispatch = {
        type: "CONTINUE_REPLY",
        requiresScheduledFor: context.requiresScheduledFor === true,
      };
    } else if (state.step === "scheduledFor") {
      dispatch({ type: "CHANGE_SCHEDULED_FOR", value: detail.text.trim() });
      eventToDispatch = { type: "CONTINUE_SCHEDULED_FOR" };
    } else if (state.step === "details") {
      dispatch({ type: "CHANGE_NOTES", value: detail.text.trim() });
      eventToDispatch = { type: "CONTINUE_DETAILS" };
    }
    if (!eventToDispatch) return;
    submit(eventToDispatch);
    emitVoiceTriageTouchAnswer({
      conversationId: ensureVoiceSessionId(),
      utterance: detail.text,
      choiceId: state.step,
      nextQuestion: viewModel.title,
      status: state.step,
    });
  });

  return (
    <div
      ref={rootRef}
      data-testid="provider-reply-voice-canvas"
      data-step={state.step}
    >
      <VoiceCanvasScene
        viewModel={viewModel}
        onChoice={choose}
        onPrimary={primary}
        onSecondary={secondary}
        onTextChange={change}
      />
      <CanvasLiveStatus
        label={viewModel.statusLabel || viewModel.title}
        assertive={state.step === "blocked"}
      />
    </div>
  );
}

export default ProviderReplyVoiceCanvas;
