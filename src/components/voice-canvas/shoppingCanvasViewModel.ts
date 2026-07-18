import {
  Building2,
  MapPin,
  PackageCheck,
  Plus,
  ShoppingBasket,
  Truck,
} from "lucide-react";
import type { VoiceCanvasViewModel } from "./types";
import type {
  ShoppingAddress,
  ShoppingCanvasState,
  ShoppingRetailer,
} from "./shoppingCanvasMachine";
export interface ShoppingCanvasCopy {
  listening: {
    status: string;
    title: string;
    helper: string;
    start: string;
    cancel: string;
  };
  retailer: {
    title: string;
    helper: string;
    other: string;
    otherHelper: string;
    back: string;
  };
  retailerEntry: {
    title: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  itemName: {
    title: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  itemQuantity: {
    title: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  moreItems: {
    title: string;
    helper: string;
    add: string;
    finish: string;
    back: string;
  };
  fulfillment: {
    title: string;
    helper: string;
    delivery: string;
    deliveryHelper: string;
    collection: string;
    collectionHelper: string;
    back: string;
  };
  location: {
    deliveryTitle: string;
    collectionTitle: string;
    helper: string;
    other: string;
    otherDelivery: string;
    otherCollection: string;
    back: string;
  };
  locationEntry: {
    deliveryTitle: string;
    collectionTitle: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  time: {
    title: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  substitutions: {
    title: string;
    helper: string;
    none: string;
    noneHelper: string;
    ask: string;
    askHelper: string;
    allow: string;
    allowHelper: string;
    back: string;
  };
  estimate: {
    title: string;
    helper: string;
    provided: string;
    providedHelper: string;
    unverified: string;
    unverifiedHelper: string;
    back: string;
  };
  cost: {
    title: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  fees: {
    title: string;
    helper: string;
    label: string;
    placeholder: string;
    continue: string;
    back: string;
  };
  review: {
    title: string;
    helper: string;
    changedHelper: string;
    retailer: string;
    items: string;
    fulfillment: string;
    location: string;
    time: string;
    substitutions: string;
    cost: string;
    fees: string;
    availability: string;
    unverified: string;
    confirm: string;
    change: string;
    delivery: string;
    collection: string;
    substitutionLabels: Record<"none" | "ask" | "allow", string>;
  };
  waiting: { status: string; title: string; helper: string; action: string };
  completed: {
    status: string;
    title: string;
    helper: string;
    reference: string;
    done: string;
  };
  pending: {
    status: string;
    title: string;
    helper: string;
    reference: string;
    done: string;
  };
  blocked: {
    status: string;
    title: string;
    helper: string;
    retry: string;
    cancel: string;
  };
  cancelled: { status: string; title: string; helper: string; restart: string };
  progress: (current: number, total: number) => string;
  itemsSummary: (items: Array<{ name: string; quantity: string }>) => string;
}
export function shoppingCanvasViewModel(
  state: ShoppingCanvasState,
  copy: ShoppingCanvasCopy,
  retailers: ShoppingRetailer[],
  addresses: ShoppingAddress[],
): VoiceCanvasViewModel {
  const progress = (current: number) => ({
      current,
      total: 9,
      label: copy.progress(current, 9),
    }),
    back = (label: string) => ({ label });
  switch (state.step) {
    case "listening":
      return {
        sceneId: "shopping-listening",
        kind: "listening",
        title: copy.listening.title,
        helperText: copy.listening.helper,
        status: "listening",
        statusLabel: copy.listening.status,
        primaryAction: { label: copy.listening.start },
        secondaryAction: { label: copy.listening.cancel },
      };
    case "retailer":
      return {
        sceneId: "shopping-retailer",
        kind: "choice",
        title: copy.retailer.title,
        helperText: copy.retailer.helper,
        progress: progress(1),
        choices: [
          ...retailers.map((item) => ({
            id: `retailer:${item.id}`,
            label: item.label,
            description: item.description,
            accessibleLabel: item.label,
            selected: state.draft.retailerId === item.id,
            icon: Building2,
          })),
          {
            id: "retailer:other",
            label: copy.retailer.other,
            description: copy.retailer.otherHelper,
            accessibleLabel: copy.retailer.other,
            icon: Plus,
          },
        ],
        secondaryAction: back(copy.retailer.back),
      };
    case "retailerEntry":
      return {
        sceneId: "shopping-retailer-entry",
        kind: "text-entry",
        title: copy.retailerEntry.title,
        helperText: copy.retailerEntry.helper,
        progress: progress(1),
        textEntry: {
          label: copy.retailerEntry.label,
          value: state.draft.retailerName,
          placeholder: copy.retailerEntry.placeholder,
          accessibleLabel: copy.retailerEntry.label,
        },
        primaryAction: {
          label: copy.retailerEntry.continue,
          disabled: !state.draft.retailerName.trim(),
        },
        secondaryAction: back(copy.retailerEntry.back),
      };
    case "itemName":
      return {
        sceneId: "shopping-item-name",
        kind: "text-entry",
        title: copy.itemName.title,
        helperText: copy.itemName.helper,
        progress: progress(2),
        textEntry: {
          label: copy.itemName.label,
          value: state.draft.itemName,
          placeholder: copy.itemName.placeholder,
          accessibleLabel: copy.itemName.label,
        },
        primaryAction: {
          label: copy.itemName.continue,
          disabled: !state.draft.itemName.trim(),
        },
        secondaryAction: back(copy.itemName.back),
      };
    case "itemQuantity":
      return {
        sceneId: "shopping-item-quantity",
        kind: "text-entry",
        title: copy.itemQuantity.title,
        helperText: copy.itemQuantity.helper,
        progress: progress(2),
        textEntry: {
          label: copy.itemQuantity.label,
          value: state.draft.itemQuantity,
          placeholder: copy.itemQuantity.placeholder,
          accessibleLabel: copy.itemQuantity.label,
        },
        primaryAction: {
          label: copy.itemQuantity.continue,
          disabled: !state.draft.itemQuantity.trim(),
        },
        secondaryAction: back(copy.itemQuantity.back),
      };
    case "moreItems":
      return {
        sceneId: "shopping-more-items",
        kind: "choice",
        title: copy.moreItems.title,
        helperText: copy.moreItems.helper,
        progress: progress(3),
        summaryRows: [
          {
            id: "items",
            label: copy.review.items,
            value: copy.itemsSummary(state.draft.items),
          },
        ],
        choices: [
          {
            id: "items:add",
            label: copy.moreItems.add,
            accessibleLabel: copy.moreItems.add,
            icon: Plus,
          },
          {
            id: "items:finish",
            label: copy.moreItems.finish,
            accessibleLabel: copy.moreItems.finish,
            icon: ShoppingBasket,
          },
        ],
        secondaryAction: back(copy.moreItems.back),
      };
    case "fulfillment":
      return {
        sceneId: "shopping-fulfillment",
        kind: "choice",
        title: copy.fulfillment.title,
        helperText: copy.fulfillment.helper,
        progress: progress(4),
        choices: [
          {
            id: "fulfillment:delivery",
            label: copy.fulfillment.delivery,
            description: copy.fulfillment.deliveryHelper,
            accessibleLabel: copy.fulfillment.delivery,
            icon: Truck,
          },
          {
            id: "fulfillment:collection",
            label: copy.fulfillment.collection,
            description: copy.fulfillment.collectionHelper,
            accessibleLabel: copy.fulfillment.collection,
            icon: PackageCheck,
          },
        ],
        secondaryAction: back(copy.fulfillment.back),
      };
    case "location":
      return {
        sceneId: "shopping-location",
        kind: "choice",
        title:
          state.draft.fulfillment === "delivery"
            ? copy.location.deliveryTitle
            : copy.location.collectionTitle,
        helperText: copy.location.helper,
        progress: progress(5),
        choices: [
          ...(state.draft.fulfillment === "delivery"
            ? addresses.map((item) => ({
                id: `location:${item.id}`,
                label: item.label,
                description: item.description || item.address,
                accessibleLabel: item.label,
                selected: state.draft.locationId === item.id,
                icon: MapPin,
              }))
            : []),
          {
            id: "location:other",
            label: copy.location.other,
            description:
              state.draft.fulfillment === "delivery"
                ? copy.location.otherDelivery
                : copy.location.otherCollection,
            accessibleLabel: copy.location.other,
            icon: Plus,
          },
        ],
        secondaryAction: back(copy.location.back),
      };
    case "locationEntry":
      return {
        sceneId: "shopping-location-entry",
        kind: "text-entry",
        title:
          state.draft.fulfillment === "delivery"
            ? copy.locationEntry.deliveryTitle
            : copy.locationEntry.collectionTitle,
        helperText: copy.locationEntry.helper,
        progress: progress(5),
        textEntry: {
          label: copy.locationEntry.label,
          value: state.draft.location,
          placeholder: copy.locationEntry.placeholder,
          accessibleLabel: copy.locationEntry.label,
        },
        primaryAction: {
          label: copy.locationEntry.continue,
          disabled: !state.draft.location.trim(),
        },
        secondaryAction: back(copy.locationEntry.back),
      };
    case "time":
      return {
        sceneId: "shopping-time",
        kind: "text-entry",
        title: copy.time.title,
        helperText: copy.time.helper,
        progress: progress(6),
        textEntry: {
          label: copy.time.label,
          value: state.draft.preferredTime,
          placeholder: copy.time.placeholder,
          accessibleLabel: copy.time.label,
        },
        primaryAction: {
          label: copy.time.continue,
          disabled: !state.draft.preferredTime.trim(),
        },
        secondaryAction: back(copy.time.back),
      };
    case "substitutions":
      return {
        sceneId: "shopping-substitutions",
        kind: "choice",
        title: copy.substitutions.title,
        helperText: copy.substitutions.helper,
        progress: progress(7),
        choices: [
          {
            id: "substitutions:none",
            label: copy.substitutions.none,
            description: copy.substitutions.noneHelper,
            accessibleLabel: copy.substitutions.none,
          },
          {
            id: "substitutions:ask",
            label: copy.substitutions.ask,
            description: copy.substitutions.askHelper,
            accessibleLabel: copy.substitutions.ask,
          },
          {
            id: "substitutions:allow",
            label: copy.substitutions.allow,
            description: copy.substitutions.allowHelper,
            accessibleLabel: copy.substitutions.allow,
          },
        ],
        secondaryAction: back(copy.substitutions.back),
      };
    case "estimate":
      return {
        sceneId: "shopping-estimate",
        kind: "choice",
        title: copy.estimate.title,
        helperText: copy.estimate.helper,
        progress: progress(8),
        choices: [
          {
            id: "estimate:provided",
            label: copy.estimate.provided,
            description: copy.estimate.providedHelper,
            accessibleLabel: copy.estimate.provided,
          },
          {
            id: "estimate:unverified",
            label: copy.estimate.unverified,
            description: copy.estimate.unverifiedHelper,
            accessibleLabel: copy.estimate.unverified,
          },
        ],
        secondaryAction: back(copy.estimate.back),
      };
    case "cost":
      return {
        sceneId: "shopping-cost",
        kind: "text-entry",
        title: copy.cost.title,
        helperText: copy.cost.helper,
        progress: progress(8),
        textEntry: {
          label: copy.cost.label,
          value: state.draft.estimatedCost,
          placeholder: copy.cost.placeholder,
          accessibleLabel: copy.cost.label,
        },
        primaryAction: {
          label: copy.cost.continue,
          disabled: !state.draft.estimatedCost.trim(),
        },
        secondaryAction: back(copy.cost.back),
      };
    case "fees":
      return {
        sceneId: "shopping-fees",
        kind: "text-entry",
        title: copy.fees.title,
        helperText: copy.fees.helper,
        progress: progress(8),
        textEntry: {
          label: copy.fees.label,
          value: state.draft.fees,
          placeholder: copy.fees.placeholder,
          accessibleLabel: copy.fees.label,
        },
        primaryAction: {
          label: copy.fees.continue,
          disabled: !state.draft.fees.trim(),
        },
        secondaryAction: back(copy.fees.back),
      };
    case "review":
      return {
        sceneId: "shopping-review",
        kind: "review",
        title: copy.review.title,
        helperText: state.changeMessage || copy.review.helper,
        progress: progress(9),
        summaryRows: [
          {
            id: "retailer",
            label: copy.review.retailer,
            value: state.draft.retailerName,
          },
          {
            id: "items",
            label: copy.review.items,
            value: copy.itemsSummary(state.draft.items),
          },
          {
            id: "fulfillment",
            label: copy.review.fulfillment,
            value:
              state.draft.fulfillment === "delivery"
                ? copy.review.delivery
                : copy.review.collection,
          },
          {
            id: "location",
            label: copy.review.location,
            value: state.draft.location,
          },
          {
            id: "time",
            label: copy.review.time,
            value: state.draft.preferredTime,
          },
          {
            id: "substitutions",
            label: copy.review.substitutions,
            value: state.draft.substitutions
              ? copy.review.substitutionLabels[state.draft.substitutions]
              : "",
          },
          {
            id: "cost",
            label: copy.review.cost,
            value:
              state.draft.estimateStatus === "provided"
                ? state.draft.estimatedCost
                : copy.review.unverified,
          },
          {
            id: "fees",
            label: copy.review.fees,
            value:
              state.draft.estimateStatus === "provided"
                ? state.draft.fees
                : copy.review.unverified,
          },
          {
            id: "availability",
            label: copy.review.availability,
            value: copy.review.unverified,
          },
        ],
        primaryAction: { label: copy.review.confirm },
        secondaryAction: { label: copy.review.change },
      };
    case "waiting":
      return {
        sceneId: "shopping-waiting",
        kind: "waiting",
        title: copy.waiting.title,
        helperText: copy.waiting.helper,
        status: "loading",
        statusLabel: copy.waiting.status,
        primaryAction: { label: copy.waiting.action, loading: true },
      };
    case "completed":
      return {
        sceneId: "shopping-completed",
        kind: "completed",
        title: copy.completed.title,
        helperText: copy.completed.helper,
        status: "success",
        statusLabel: copy.completed.status,
        summaryRows: state.resultReference
          ? [
              {
                id: "reference",
                label: copy.completed.reference,
                value: state.resultReference,
              },
            ]
          : [],
        primaryAction: { label: copy.completed.done },
      };
    case "pending":
      return {
        sceneId: "shopping-pending",
        kind: "completed",
        title: copy.pending.title,
        helperText: copy.pending.helper,
        status: "idle",
        statusLabel: copy.pending.status,
        summaryRows: state.resultReference
          ? [
              {
                id: "reference",
                label: copy.pending.reference,
                value: state.resultReference,
              },
            ]
          : [],
        primaryAction: { label: copy.pending.done },
      };
    case "blocked":
      return {
        sceneId: "shopping-blocked",
        kind: "blocked",
        title: copy.blocked.title,
        helperText: state.errorMessage || copy.blocked.helper,
        status: "blocked",
        statusLabel: copy.blocked.status,
        primaryAction: { label: copy.blocked.retry },
        secondaryAction: { label: copy.blocked.cancel },
      };
    case "cancelled":
      return {
        sceneId: "shopping-cancelled",
        kind: "blocked",
        title: copy.cancelled.title,
        helperText: copy.cancelled.helper,
        status: "idle",
        statusLabel: copy.cancelled.status,
        primaryAction: { label: copy.cancelled.restart },
      };
  }
}
