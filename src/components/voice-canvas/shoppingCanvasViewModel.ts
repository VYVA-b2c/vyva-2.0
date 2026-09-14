import {
  BadgeCheck,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  ListPlus,
  MapPin,
  PackageCheck,
  Plus,
  ShoppingBasket,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type {
  VoiceCanvasAgentPresenceCopy,
  VoiceCanvasOptionCardDetail,
  VoiceCanvasViewModel,
} from "./types";
import type {
  ShoppingAddress,
  ShoppingCanvasState,
  ShoppingRetailer,
} from "./shoppingCanvasMachine";
export interface ShoppingCanvasCopy {
  agentPresence: VoiceCanvasAgentPresenceCopy;
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
  details: {
    savedRetailer: string;
    savedAddress: string;
    retailerType: string;
    estimateConfidence: string;
    fees: string;
    fulfillment: string;
    deliveryBoundary: string;
    collectionBoundary: string;
    substitutionRule: string;
    availability: string;
    unverified: string;
    reviewBeforeAction: string;
    noPaymentOrOrder: string;
    manualEntry: string;
    recommended: string;
    itemsInBasket: string;
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
const detail = (
  id: string,
  label: string,
  value?: string,
  tone?: "good" | "neutral" | "caution",
): VoiceCanvasOptionCardDetail[] => value ? [{ id, label, value, tone }] : [];
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
        blocks: [
          ...retailers.map((item) => ({
            kind: "option-card" as const,
            id: `retailer:${item.id}`,
            title: item.label,
            subtitle: item.subtitle || item.savedLabel || copy.details.savedRetailer,
            description: item.description,
            badge: item.recommended ? copy.details.recommended : undefined,
            recommended: item.recommended,
            accessibleLabel: [
              item.label,
              item.subtitle || item.savedLabel || copy.details.savedRetailer,
              item.description,
            ].filter(Boolean).join(". "),
            selected: state.draft.retailerId === item.id,
            icon: Building2,
            voiceAliases: item.voiceAliases,
            details: [
              ...detail("type", copy.details.retailerType, item.retailerType),
              ...detail("estimate", copy.details.estimateConfidence, item.estimateLabel || copy.details.unverified, item.estimateLabel ? "neutral" : "caution"),
              ...detail("fees", copy.details.fees, item.feeLabel || copy.details.unverified, item.feeLabel ? "neutral" : "caution"),
              ...detail("review", copy.details.reviewBeforeAction, item.reviewReminder || copy.details.reviewBeforeAction),
            ],
          })),
          {
            kind: "option-card" as const,
            id: "retailer:other",
            title: copy.retailer.other,
            subtitle: copy.details.manualEntry,
            description: copy.retailer.otherHelper,
            accessibleLabel: copy.retailer.other,
            icon: Plus,
            details: detail("review", copy.details.reviewBeforeAction, copy.details.reviewBeforeAction),
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
        blocks: [
          {
            kind: "option-card",
            id: "items:add",
            title: copy.moreItems.add,
            subtitle: copy.details.itemsInBasket,
            description: copy.itemsSummary(state.draft.items),
            accessibleLabel: copy.moreItems.add,
            icon: ListPlus,
            details: detail("review", copy.details.reviewBeforeAction, copy.details.reviewBeforeAction),
          },
          {
            kind: "option-card",
            id: "items:finish",
            title: copy.moreItems.finish,
            subtitle: copy.details.reviewBeforeAction,
            description: copy.moreItems.helper,
            accessibleLabel: copy.moreItems.finish,
            icon: ShoppingBasket,
            details: [
              ...detail("items", copy.details.itemsInBasket, String(state.draft.items.length)),
              ...detail("boundary", copy.details.noPaymentOrOrder, copy.details.noPaymentOrOrder, "good"),
            ],
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
        blocks: [
          {
            kind: "option-card",
            id: "fulfillment:delivery",
            title: copy.fulfillment.delivery,
            subtitle: copy.details.deliveryBoundary,
            description: copy.fulfillment.deliveryHelper,
            accessibleLabel: copy.fulfillment.delivery,
            icon: Truck,
            details: [
              ...detail("fulfillment", copy.details.fulfillment, copy.review.delivery),
              ...detail("boundary", copy.details.noPaymentOrOrder, copy.details.noPaymentOrOrder, "good"),
            ],
          },
          {
            kind: "option-card",
            id: "fulfillment:collection",
            title: copy.fulfillment.collection,
            subtitle: copy.details.collectionBoundary,
            description: copy.fulfillment.collectionHelper,
            accessibleLabel: copy.fulfillment.collection,
            icon: PackageCheck,
            details: [
              ...detail("fulfillment", copy.details.fulfillment, copy.review.collection),
              ...detail("boundary", copy.details.noPaymentOrOrder, copy.details.noPaymentOrOrder, "good"),
            ],
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
        blocks: [
          ...(state.draft.fulfillment === "delivery"
            ? addresses.map((item) => ({
                kind: "option-card" as const,
                id: `location:${item.id}`,
                title: item.label,
                subtitle: item.savedLabel || copy.details.savedAddress,
                description: item.description || item.address,
                badge: item.recommended ? copy.details.recommended : undefined,
                recommended: item.recommended,
                accessibleLabel: [item.label, item.savedLabel || copy.details.savedAddress, item.address].filter(Boolean).join(". "),
                selected: state.draft.locationId === item.id,
                icon: MapPin,
                voiceAliases: item.voiceAliases,
                details: [
                  ...detail("delivery", copy.details.deliveryBoundary, item.deliveryNote || copy.details.deliveryBoundary),
                  ...detail("review", copy.details.reviewBeforeAction, item.reviewReminder || copy.details.reviewBeforeAction),
                ],
              }))
            : []),
          {
            kind: "option-card" as const,
            id: "location:other",
            title: copy.location.other,
            subtitle: copy.details.manualEntry,
            description:
              state.draft.fulfillment === "delivery"
                ? copy.location.otherDelivery
                : copy.location.otherCollection,
            accessibleLabel: copy.location.other,
            icon: Plus,
            details: detail("review", copy.details.reviewBeforeAction, copy.details.reviewBeforeAction),
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
        blocks: [
          {
            kind: "option-card",
            id: "substitutions:none",
            title: copy.substitutions.none,
            subtitle: copy.details.substitutionRule,
            description: copy.substitutions.noneHelper,
            accessibleLabel: copy.substitutions.none,
            icon: ShieldCheck,
            details: detail("review", copy.details.reviewBeforeAction, copy.details.reviewBeforeAction),
          },
          {
            kind: "option-card",
            id: "substitutions:ask",
            title: copy.substitutions.ask,
            subtitle: copy.details.substitutionRule,
            description: copy.substitutions.askHelper,
            accessibleLabel: copy.substitutions.ask,
            icon: ClipboardCheck,
            details: detail("review", copy.details.reviewBeforeAction, copy.details.reviewBeforeAction),
          },
          {
            kind: "option-card",
            id: "substitutions:allow",
            title: copy.substitutions.allow,
            subtitle: copy.details.substitutionRule,
            description: copy.substitutions.allowHelper,
            accessibleLabel: copy.substitutions.allow,
            icon: BadgeCheck,
            details: detail("review", copy.details.reviewBeforeAction, copy.details.reviewBeforeAction),
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
        blocks: [
          {
            kind: "option-card",
            id: "estimate:provided",
            title: copy.estimate.provided,
            subtitle: copy.details.estimateConfidence,
            description: copy.estimate.providedHelper,
            accessibleLabel: copy.estimate.provided,
            icon: CircleDollarSign,
            details: [
              ...detail("availability", copy.details.availability, copy.details.unverified, "caution"),
              ...detail("review", copy.details.reviewBeforeAction, copy.details.reviewBeforeAction),
            ],
          },
          {
            kind: "option-card",
            id: "estimate:unverified",
            title: copy.estimate.unverified,
            subtitle: copy.details.unverified,
            description: copy.estimate.unverifiedHelper,
            accessibleLabel: copy.estimate.unverified,
            icon: ShieldCheck,
            details: [
              ...detail("availability", copy.details.availability, copy.details.unverified, "caution"),
              ...detail("boundary", copy.details.noPaymentOrOrder, copy.details.noPaymentOrOrder, "good"),
            ],
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
        blocks: [{
          kind: "option-card",
          id: "cost-guidance",
          title: copy.details.estimateConfidence,
          subtitle: copy.details.reviewBeforeAction,
          description: copy.details.noPaymentOrOrder,
          icon: CircleDollarSign,
          disabled: true,
          details: [
            ...detail("availability", copy.details.availability, copy.details.unverified, "caution"),
            ...detail("review", copy.details.reviewBeforeAction, copy.details.reviewBeforeAction),
          ],
        }],
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
        blocks: [{
          kind: "option-card",
          id: "fees-guidance",
          title: copy.details.fees,
          subtitle: copy.details.reviewBeforeAction,
          description: copy.details.noPaymentOrOrder,
          icon: CircleDollarSign,
          disabled: true,
          details: [
            ...detail("estimate", copy.details.estimateConfidence, state.draft.estimatedCost),
            ...detail("boundary", copy.details.noPaymentOrOrder, copy.details.noPaymentOrOrder, "good"),
          ],
        }],
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
