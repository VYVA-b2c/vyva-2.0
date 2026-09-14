export type ShoppingCanvasStep =
  | "listening"
  | "retailer"
  | "retailerEntry"
  | "itemName"
  | "itemQuantity"
  | "moreItems"
  | "fulfillment"
  | "location"
  | "locationEntry"
  | "time"
  | "substitutions"
  | "estimate"
  | "cost"
  | "fees"
  | "review"
  | "waiting"
  | "completed"
  | "pending"
  | "blocked"
  | "cancelled";
export interface ShoppingRetailer {
  id: string;
  label: string;
  description?: string;
  subtitle?: string;
  retailerType?: string;
  estimateLabel?: string;
  feeLabel?: string;
  savedLabel?: string;
  reviewReminder?: string;
  recommended?: boolean;
  voiceAliases?: string[];
}
export interface ShoppingAddress {
  id: string;
  label: string;
  address: string;
  description?: string;
  savedLabel?: string;
  deliveryNote?: string;
  reviewReminder?: string;
  recommended?: boolean;
  voiceAliases?: string[];
}
export interface ShoppingCanvasItem {
  id: string;
  name: string;
  quantity: string;
}
export interface ShoppingCanvasDraft {
  retailerId: string;
  retailerName: string;
  items: ShoppingCanvasItem[];
  itemName: string;
  itemQuantity: string;
  fulfillment: "delivery" | "collection" | "";
  locationId: string;
  location: string;
  preferredTime: string;
  substitutions: "none" | "ask" | "allow" | "";
  estimateStatus: "provided" | "unverified" | "";
  estimatedCost: string;
  fees: string;
  availability: "unverified";
}
export interface ShoppingCanvasState {
  step: ShoppingCanvasStep;
  draft: ShoppingCanvasDraft;
  requestId: number;
  revision: number;
  resultReference?: string;
  errorMessage?: string;
  changeMessage?: string;
}
export type ShoppingCanvasEvent =
  | { type: "START" }
  | { type: "CHOOSE_RETAILER"; retailer?: ShoppingRetailer; manual?: boolean }
  | { type: "CHANGE_RETAILER"; value: string }
  | { type: "CONTINUE_RETAILER" }
  | { type: "CHANGE_ITEM_NAME"; value: string }
  | { type: "CONTINUE_ITEM_NAME" }
  | { type: "CHANGE_ITEM_QUANTITY"; value: string }
  | { type: "CONTINUE_ITEM_QUANTITY" }
  | { type: "ADD_ITEM" }
  | { type: "FINISH_ITEMS" }
  | { type: "CHOOSE_FULFILLMENT"; value: "delivery" | "collection" }
  | { type: "CHOOSE_LOCATION"; address?: ShoppingAddress; manual?: boolean }
  | { type: "CHANGE_LOCATION"; value: string }
  | { type: "CONTINUE_LOCATION" }
  | { type: "CHANGE_TIME"; value: string }
  | { type: "CONTINUE_TIME" }
  | { type: "CHOOSE_SUBSTITUTIONS"; value: "none" | "ask" | "allow" }
  | { type: "CHOOSE_ESTIMATE"; value: "provided" | "unverified" }
  | { type: "CHANGE_COST"; value: string }
  | { type: "CONTINUE_COST" }
  | { type: "CHANGE_FEES"; value: string }
  | { type: "CONTINUE_FEES" }
  | { type: "BACK" }
  | { type: "CANCEL" }
  | { type: "CONFIRM" }
  | {
      type: "RESOLVE";
      requestId: number;
      outcome: "completed" | "pending";
      reference?: string;
    }
  | {
      type: "MATERIAL_CHANGE";
      requestId: number;
      message?: string;
      changes?: Partial<ShoppingCanvasDraft>;
    }
  | { type: "REJECT"; requestId: number; message?: string }
  | { type: "RETRY" };
export const emptyShoppingDraft: ShoppingCanvasDraft = {
  retailerId: "",
  retailerName: "",
  items: [],
  itemName: "",
  itemQuantity: "",
  fulfillment: "",
  locationId: "",
  location: "",
  preferredTime: "",
  substitutions: "",
  estimateStatus: "",
  estimatedCost: "",
  fees: "",
  availability: "unverified",
};
export const initialShoppingCanvasState: ShoppingCanvasState = {
  step: "listening",
  draft: emptyShoppingDraft,
  requestId: 0,
  revision: 0,
};
const addCurrentItem = (draft: ShoppingCanvasDraft): ShoppingCanvasDraft =>
  draft.itemName.trim() && draft.itemQuantity.trim()
    ? {
        ...draft,
        items: [
          ...draft.items,
          {
            id: `item-${draft.items.length + 1}`,
            name: draft.itemName.trim(),
            quantity: draft.itemQuantity.trim(),
          },
        ],
        itemName: "",
        itemQuantity: "",
      }
    : draft;
export function shoppingCanvasReducer(
  state: ShoppingCanvasState,
  event: ShoppingCanvasEvent,
): ShoppingCanvasState {
  switch (event.type) {
    case "START":
      return state.step === "listening" || state.step === "cancelled"
        ? {
            ...initialShoppingCanvasState,
            step: "retailer",
            draft: { ...emptyShoppingDraft },
          }
        : state;
    case "CHOOSE_RETAILER":
      if (state.step !== "retailer") return state;
      if (event.manual)
        return {
          ...state,
          step: "retailerEntry",
          draft: { ...state.draft, retailerId: "", retailerName: "" },
        };
      return event.retailer
        ? {
            ...state,
            step: "itemName",
            draft: {
              ...state.draft,
              retailerId: event.retailer.id,
              retailerName: event.retailer.label,
            },
          }
        : state;
    case "CHANGE_RETAILER":
      return state.step === "retailerEntry"
        ? { ...state, draft: { ...state.draft, retailerName: event.value } }
        : state;
    case "CONTINUE_RETAILER":
      return state.step === "retailerEntry" && state.draft.retailerName.trim()
        ? { ...state, step: "itemName" }
        : state;
    case "CHANGE_ITEM_NAME":
      return state.step === "itemName"
        ? { ...state, draft: { ...state.draft, itemName: event.value } }
        : state;
    case "CONTINUE_ITEM_NAME":
      return state.step === "itemName" && state.draft.itemName.trim()
        ? { ...state, step: "itemQuantity" }
        : state;
    case "CHANGE_ITEM_QUANTITY":
      return state.step === "itemQuantity"
        ? { ...state, draft: { ...state.draft, itemQuantity: event.value } }
        : state;
    case "CONTINUE_ITEM_QUANTITY":
      return state.step === "itemQuantity" && state.draft.itemQuantity.trim()
        ? { ...state, step: "moreItems", draft: addCurrentItem(state.draft) }
        : state;
    case "ADD_ITEM":
      return state.step === "moreItems"
        ? { ...state, step: "itemName" }
        : state;
    case "FINISH_ITEMS":
      return state.step === "moreItems" && state.draft.items.length
        ? { ...state, step: "fulfillment" }
        : state;
    case "CHOOSE_FULFILLMENT":
      return state.step === "fulfillment"
        ? {
            ...state,
            step: "location",
            draft: {
              ...state.draft,
              fulfillment: event.value,
              locationId: "",
              location: "",
            },
          }
        : state;
    case "CHOOSE_LOCATION":
      if (state.step !== "location") return state;
      if (event.manual)
        return {
          ...state,
          step: "locationEntry",
          draft: { ...state.draft, locationId: "", location: "" },
        };
      return event.address
        ? {
            ...state,
            step: "time",
            draft: {
              ...state.draft,
              locationId: event.address.id,
              location: event.address.address,
            },
          }
        : state;
    case "CHANGE_LOCATION":
      return state.step === "locationEntry"
        ? { ...state, draft: { ...state.draft, location: event.value } }
        : state;
    case "CONTINUE_LOCATION":
      return state.step === "locationEntry" && state.draft.location.trim()
        ? { ...state, step: "time" }
        : state;
    case "CHANGE_TIME":
      return state.step === "time"
        ? { ...state, draft: { ...state.draft, preferredTime: event.value } }
        : state;
    case "CONTINUE_TIME":
      return state.step === "time" && state.draft.preferredTime.trim()
        ? { ...state, step: "substitutions" }
        : state;
    case "CHOOSE_SUBSTITUTIONS":
      return state.step === "substitutions"
        ? {
            ...state,
            step: "estimate",
            draft: { ...state.draft, substitutions: event.value },
          }
        : state;
    case "CHOOSE_ESTIMATE":
      return state.step === "estimate"
        ? {
            ...state,
            step: event.value === "provided" ? "cost" : "review",
            draft: {
              ...state.draft,
              estimateStatus: event.value,
              estimatedCost: "",
              fees: "",
            },
          }
        : state;
    case "CHANGE_COST":
      return state.step === "cost"
        ? { ...state, draft: { ...state.draft, estimatedCost: event.value } }
        : state;
    case "CONTINUE_COST":
      return state.step === "cost" && state.draft.estimatedCost.trim()
        ? { ...state, step: "fees" }
        : state;
    case "CHANGE_FEES":
      return state.step === "fees"
        ? { ...state, draft: { ...state.draft, fees: event.value } }
        : state;
    case "CONTINUE_FEES":
      return state.step === "fees" && state.draft.fees.trim()
        ? { ...state, step: "review" }
        : state;
    case "BACK": {
      const back: Partial<Record<ShoppingCanvasStep, ShoppingCanvasStep>> = {
        retailerEntry: "retailer",
        itemName: state.draft.items.length
          ? "moreItems"
          : state.draft.retailerId
            ? "retailer"
            : "retailerEntry",
        itemQuantity: "itemName",
        moreItems: "itemQuantity",
        fulfillment: "moreItems",
        location: "fulfillment",
        locationEntry: "location",
        time: state.draft.locationId ? "location" : "locationEntry",
        substitutions: "time",
        estimate: "substitutions",
        cost: "estimate",
        fees: "cost",
        review: state.draft.estimateStatus === "provided" ? "fees" : "estimate",
      };
      return back[state.step] ? { ...state, step: back[state.step]! } : state;
    }
    case "CANCEL":
      return ["waiting", "completed", "pending"].includes(state.step)
        ? state
        : { ...state, step: "cancelled" };
    case "CONFIRM":
      return state.step === "review"
        ? {
            ...state,
            step: "waiting",
            requestId: state.requestId + 1,
            errorMessage: undefined,
            changeMessage: undefined,
          }
        : state;
    case "RESOLVE":
      return state.step === "waiting" && event.requestId === state.requestId
        ? { ...state, step: event.outcome, resultReference: event.reference }
        : state;
    case "MATERIAL_CHANGE":
      return state.step === "waiting" && event.requestId === state.requestId
        ? {
            ...state,
            step: "review",
            revision: state.revision + 1,
            changeMessage: event.message,
            draft: {
              ...state.draft,
              ...event.changes,
              availability: "unverified",
            },
          }
        : state;
    case "REJECT":
      return state.step === "waiting" && event.requestId === state.requestId
        ? { ...state, step: "blocked", errorMessage: event.message }
        : state;
    case "RETRY":
      return state.step === "blocked"
        ? { ...state, step: "review", errorMessage: undefined }
        : state;
  }
}
export function isRestorableShoppingCanvasState(
  value: unknown,
): value is ShoppingCanvasState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<ShoppingCanvasState>;
  return (
    typeof state.requestId === "number" &&
    typeof state.revision === "number" &&
    !!state.draft &&
    Array.isArray(state.draft.items) &&
    typeof state.step === "string" &&
    [
      "listening",
      "retailer",
      "retailerEntry",
      "itemName",
      "itemQuantity",
      "moreItems",
      "fulfillment",
      "location",
      "locationEntry",
      "time",
      "substitutions",
      "estimate",
      "cost",
      "fees",
      "review",
      "blocked",
      "cancelled",
    ].includes(state.step)
  );
}
