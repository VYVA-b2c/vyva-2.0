import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import {
  emitVoiceTriageTouchAnswer,
  ensureVoiceSessionId,
} from "@/lib/voiceSessionBridge";
import VoiceCanvasScene from "./VoiceCanvasScene";
import {
  initialShoppingCanvasState,
  isRestorableShoppingCanvasState,
  shoppingCanvasReducer,
  type ShoppingAddress,
  type ShoppingCanvasDraft,
  type ShoppingCanvasEvent,
  type ShoppingCanvasState,
  type ShoppingRetailer,
} from "./shoppingCanvasMachine";
import {
  shoppingCanvasViewModel,
  type ShoppingCanvasCopy,
} from "./shoppingCanvasViewModel";
import {
  trackShoppingCanvasEvent,
  type ShoppingCanvasTelemetryEvent,
} from "./shoppingCanvasTelemetry";
export interface ShoppingVoiceCommands {
  start: string[];
  back: string[];
  cancel: string[];
  confirm: string[];
  retry: string[];
  delivery: string[];
  collection: string[];
  addItem: string[];
  finishItems: string[];
  noSubstitutions: string[];
  askSubstitutions: string[];
  allowSubstitutions: string[];
  estimateProvided: string[];
  estimateUnverified: string[];
  other: string[];
}
export type ShoppingConfirmationResult =
  | { outcome: "completed" | "pending"; reference?: string }
  | {
      outcome: "changed";
      message?: string;
      changes?: Partial<ShoppingCanvasDraft>;
    };
export interface ShoppingVoiceCanvasProps {
  copy: ShoppingCanvasCopy;
  voiceCommands: ShoppingVoiceCommands;
  retailers: ShoppingRetailer[];
  addresses: ShoppingAddress[];
  onConfirm: (
    draft: Readonly<ShoppingCanvasDraft>,
    context: { requestId: number; revision: number; signal: AbortSignal },
  ) => Promise<ShoppingConfirmationResult>;
  onDone?: () => void;
  onCancel?: () => void;
  storageKey?: string;
  initialState?: ShoppingCanvasState;
  onTelemetry?: (event: ShoppingCanvasTelemetryEvent) => void;
}
const normalize = (value: string) => value.trim().toLocaleLowerCase();
const matches = (text: string, commands: string[]) =>
  commands.some((command) => text === normalize(command));
export function ShoppingVoiceCanvas({
  copy,
  voiceCommands,
  retailers,
  addresses,
  onConfirm,
  onDone,
  onCancel,
  storageKey = "vyva.shoppingDelivery.v1",
  initialState,
  onTelemetry = trackShoppingCanvasEvent,
}: ShoppingVoiceCanvasProps) {
  const restoredRef = useRef(false),
    restoreTrackedRef = useRef(false),
    inputRef = useRef<ShoppingCanvasTelemetryEvent["input"]>("system");
  const restore = () => {
    if (initialState) return initialState;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isRestorableShoppingCanvasState(parsed)) {
          restoredRef.current = true;
          return parsed;
        }
      }
    } catch {}
    return initialShoppingCanvasState;
  };
  const [state, dispatch] = useReducer(
      shoppingCanvasReducer,
      undefined,
      restore,
    ),
    rootRef = useRef<HTMLDivElement>(null),
    activeRequest = useRef<{ id: number; controller: AbortController } | null>(
      null,
    ),
    viewModel = useMemo(
      () => shoppingCanvasViewModel(state, copy, retailers, addresses),
      [state, copy, retailers, addresses],
    );
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);
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
  }, [state.step, state.requestId, state.revision, onTelemetry]);
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
  }, [state.step, state.requestId, state.revision, onTelemetry]);
  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [state.step]);
  useEffect(() => () => activeRequest.current?.controller.abort(), []);
  const choose = useCallback(
    (id: string) => {
      inputRef.current = "touch_or_keyboard";
      if (id.startsWith("retailer:"))
        dispatch(
          id === "retailer:other"
            ? { type: "CHOOSE_RETAILER", manual: true }
            : {
                type: "CHOOSE_RETAILER",
                retailer: retailers.find(
                  (item) => `retailer:${item.id}` === id,
                ),
              },
        );
      else if (id === "items:add") dispatch({ type: "ADD_ITEM" });
      else if (id === "items:finish") dispatch({ type: "FINISH_ITEMS" });
      else if (id.startsWith("fulfillment:"))
        dispatch({
          type: "CHOOSE_FULFILLMENT",
          value: id.endsWith("delivery") ? "delivery" : "collection",
        });
      else if (id.startsWith("location:"))
        dispatch(
          id === "location:other"
            ? { type: "CHOOSE_LOCATION", manual: true }
            : {
                type: "CHOOSE_LOCATION",
                address: addresses.find((item) => `location:${item.id}` === id),
              },
        );
      else if (id.startsWith("substitutions:"))
        dispatch({
          type: "CHOOSE_SUBSTITUTIONS",
          value: id.split(":")[1] as "none" | "ask" | "allow",
        });
      else if (id.startsWith("estimate:"))
        dispatch({
          type: "CHOOSE_ESTIMATE",
          value: id.endsWith("provided") ? "provided" : "unverified",
        });
    },
    [retailers, addresses],
  );
  const primary = useCallback(() => {
    inputRef.current = "touch_or_keyboard";
    const event: ShoppingCanvasEvent | undefined =
      state.step === "listening" || state.step === "cancelled"
        ? { type: "START" }
        : state.step === "retailerEntry"
          ? { type: "CONTINUE_RETAILER" }
          : state.step === "itemName"
            ? { type: "CONTINUE_ITEM_NAME" }
            : state.step === "itemQuantity"
              ? { type: "CONTINUE_ITEM_QUANTITY" }
              : state.step === "locationEntry"
                ? { type: "CONTINUE_LOCATION" }
                : state.step === "time"
                  ? { type: "CONTINUE_TIME" }
                  : state.step === "cost"
                    ? { type: "CONTINUE_COST" }
                    : state.step === "fees"
                      ? { type: "CONTINUE_FEES" }
                      : state.step === "review"
                        ? { type: "CONFIRM" }
                        : state.step === "blocked"
                          ? { type: "RETRY" }
                          : undefined;
    if (event) {
      if (event.type === "CONFIRM")
        onTelemetry({
          name: "confirmation_submitted",
          step: "review",
          input: inputRef.current,
          attempt: state.requestId + 1,
          revision: state.revision,
          restored: restoredRef.current,
        });
      if (event.type === "RETRY")
        onTelemetry({
          name: "retried",
          step: "blocked",
          input: inputRef.current,
          attempt: state.requestId,
          revision: state.revision,
          restored: restoredRef.current,
        });
      dispatch(event);
    } else if (state.step === "completed" || state.step === "pending")
      onDone?.();
  }, [state, onDone, onTelemetry]);
  const secondary = useCallback(() => {
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
    } else dispatch({ type: "BACK" });
  }, [state, onCancel, onTelemetry]);
  const change = useCallback(
    (value: string) => {
      inputRef.current = "touch_or_keyboard";
      const types: Partial<
        Record<typeof state.step, ShoppingCanvasEvent["type"]>
      > = {
        retailerEntry: "CHANGE_RETAILER",
        itemName: "CHANGE_ITEM_NAME",
        itemQuantity: "CHANGE_ITEM_QUANTITY",
        locationEntry: "CHANGE_LOCATION",
        time: "CHANGE_TIME",
        cost: "CHANGE_COST",
        fees: "CHANGE_FEES",
      };
      const type = types[state.step];
      if (type) dispatch({ type, value } as ShoppingCanvasEvent);
    },
    [state.step],
  );
  useEffect(() => {
    if (
      state.step !== "waiting" ||
      activeRequest.current?.id === state.requestId
    )
      return;
    activeRequest.current?.controller.abort();
    const controller = new AbortController(),
      id = state.requestId;
    activeRequest.current = { id, controller };
    onConfirm(
      Object.freeze({
        ...state.draft,
        items: state.draft.items.map((item) => Object.freeze({ ...item })),
      }),
      { requestId: id, revision: state.revision, signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.outcome === "changed") {
          onTelemetry({
            name: "reconfirmation_required",
            step: "review",
            input: "system",
            attempt: id,
            revision: state.revision + 1,
            restored: restoredRef.current,
          });
          dispatch({ type: "MATERIAL_CHANGE", requestId: id, ...result });
        } else {
          onTelemetry({
            name: result.outcome,
            step: result.outcome,
            input: "system",
            attempt: id,
            revision: state.revision,
            restored: restoredRef.current,
          });
          dispatch({ type: "RESOLVE", requestId: id, ...result });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          onTelemetry({
            name: "failed",
            step: "blocked",
            input: "system",
            attempt: id,
            revision: state.revision,
            restored: restoredRef.current,
          });
          dispatch({
            type: "REJECT",
            requestId: id,
            message: error instanceof Error ? error.message : undefined,
          });
        }
      });
  }, [
    state.step,
    state.requestId,
    state.revision,
    state.draft,
    onConfirm,
    onTelemetry,
  ]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<VoiceUserMessageDetail>).detail;
      if (!detail?.text) return;
      inputRef.current = "voice";
      const text = normalize(detail.text);
      let item: ShoppingCanvasEvent | undefined;
      if (matches(text, voiceCommands.cancel)) item = { type: "CANCEL" };
      else if (matches(text, voiceCommands.back)) item = { type: "BACK" };
      else if (matches(text, voiceCommands.start)) item = { type: "START" };
      else if (state.step === "review" && matches(text, voiceCommands.confirm))
        item = { type: "CONFIRM" };
      else if (state.step === "blocked" && matches(text, voiceCommands.retry))
        item = { type: "RETRY" };
      else if (state.step === "retailer") {
        const retailer = retailers.find(
          (candidate) => text === normalize(candidate.label),
        );
        if (retailer) item = { type: "CHOOSE_RETAILER", retailer };
        else if (matches(text, voiceCommands.other))
          item = { type: "CHOOSE_RETAILER", manual: true };
      } else if (state.step === "location") {
        const address = addresses.find(
          (candidate) =>
            text === normalize(candidate.label) ||
            text === normalize(candidate.address),
        );
        if (address) item = { type: "CHOOSE_LOCATION", address };
        else if (matches(text, voiceCommands.other))
          item = { type: "CHOOSE_LOCATION", manual: true };
      }
      else if (
        state.step === "fulfillment" &&
        matches(text, voiceCommands.delivery)
      )
        item = { type: "CHOOSE_FULFILLMENT", value: "delivery" };
      else if (
        state.step === "fulfillment" &&
        matches(text, voiceCommands.collection)
      )
        item = { type: "CHOOSE_FULFILLMENT", value: "collection" };
      else if (
        state.step === "moreItems" &&
        matches(text, voiceCommands.addItem)
      )
        item = { type: "ADD_ITEM" };
      else if (
        state.step === "moreItems" &&
        matches(text, voiceCommands.finishItems)
      )
        item = { type: "FINISH_ITEMS" };
      else if (state.step === "substitutions") {
        if (matches(text, voiceCommands.noSubstitutions))
          item = { type: "CHOOSE_SUBSTITUTIONS", value: "none" };
        else if (matches(text, voiceCommands.askSubstitutions))
          item = { type: "CHOOSE_SUBSTITUTIONS", value: "ask" };
        else if (matches(text, voiceCommands.allowSubstitutions))
          item = { type: "CHOOSE_SUBSTITUTIONS", value: "allow" };
      } else if (state.step === "estimate") {
        if (matches(text, voiceCommands.estimateProvided))
          item = { type: "CHOOSE_ESTIMATE", value: "provided" };
        else if (matches(text, voiceCommands.estimateUnverified))
          item = { type: "CHOOSE_ESTIMATE", value: "unverified" };
      } else {
        const changes: Partial<
          Record<typeof state.step, ShoppingCanvasEvent["type"]>
        > = {
          retailerEntry: "CHANGE_RETAILER",
          itemName: "CHANGE_ITEM_NAME",
          itemQuantity: "CHANGE_ITEM_QUANTITY",
          locationEntry: "CHANGE_LOCATION",
          time: "CHANGE_TIME",
          cost: "CHANGE_COST",
          fees: "CHANGE_FEES",
        };
        const continues: Partial<
          Record<typeof state.step, ShoppingCanvasEvent["type"]>
        > = {
          retailerEntry: "CONTINUE_RETAILER",
          itemName: "CONTINUE_ITEM_NAME",
          itemQuantity: "CONTINUE_ITEM_QUANTITY",
          locationEntry: "CONTINUE_LOCATION",
          time: "CONTINUE_TIME",
          cost: "CONTINUE_COST",
          fees: "CONTINUE_FEES",
        };
        const type = changes[state.step];
        if (type) {
          const first = {
            type,
            value: detail.text.trim(),
          } as ShoppingCanvasEvent;
          dispatch(first);
          const next = shoppingCanvasReducer(state, first),
            second = { type: continues[state.step] } as ShoppingCanvasEvent;
          dispatch(second);
          const final = shoppingCanvasReducer(next, second);
          emitVoiceTriageTouchAnswer({
            conversationId: ensureVoiceSessionId(),
            utterance: detail.text,
            choiceId: final.step,
            nextQuestion: shoppingCanvasViewModel(
              final,
              copy,
              retailers,
              addresses,
            ).title,
            status: final.step,
          });
          return;
        }
      }
      if (item) {
        if (item.type === "CONFIRM")
          onTelemetry({
            name: "confirmation_submitted",
            step: "review",
            input: "voice",
            attempt: state.requestId + 1,
            revision: state.revision,
            restored: restoredRef.current,
          });
        dispatch(item);
      }
    };
    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handler);
    return () =>
      window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handler);
  }, [state, voiceCommands, copy, retailers, addresses, onTelemetry]);
  return (
    <div
      ref={rootRef}
      data-testid="shopping-voice-canvas"
      data-step={state.step}
    >
      <VoiceCanvasScene
        viewModel={viewModel}
        onChoice={choose}
        onPrimary={primary}
        onSecondary={secondary}
        onTextChange={change}
      />
      <span
        className="sr-only"
        aria-live={state.step === "blocked" ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {viewModel.statusLabel || viewModel.title}
      </span>
    </div>
  );
}
export default ShoppingVoiceCanvas;
