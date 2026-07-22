import { describe, expect, it } from "vitest";
import type { VoiceCanvasAgentPresenceCopy, VoiceCanvasOptionCardBlock, VoiceCanvasViewModel } from "./types";
import { initialRideCanvasState } from "./rideCanvasMachine";
import { rideCanvasViewModel, type RideCanvasCopy } from "./rideCanvasViewModel";
import { initialRefillCanvasState } from "./refillCanvasMachine";
import { refillCanvasViewModel, type RefillCanvasCopy } from "./refillCanvasViewModel";
import { initialShoppingCanvasState } from "./shoppingCanvasMachine";
import { shoppingCanvasViewModel, type ShoppingCanvasCopy } from "./shoppingCanvasViewModel";
import { initialProviderReplyCanvasState } from "./providerReplyCanvasMachine";
import { providerReplyCanvasViewModel, type ProviderReplyCanvasCopy } from "./providerReplyCanvasViewModel";

const agentPresence: VoiceCanvasAgentPresenceCopy = {
  idleLabel: "Voice ready",
  idleDescription: "Use voice or touch.",
  listeningLabel: "Listening with you",
  listeningDescription: "Say or tap one choice.",
  speakingLabel: "VYVA is speaking",
  speakingDescription: "Follow the screen.",
  thinkingLabel: "VYVA is checking",
  thinkingDescription: "Review what is on screen.",
  accessibleLabel: "VYVA voice status",
};

function optionCards(viewModel: VoiceCanvasViewModel): VoiceCanvasOptionCardBlock[] {
  return (viewModel.blocks ?? []).filter((block): block is VoiceCanvasOptionCardBlock => block.kind === "option-card");
}

function cardText(card: VoiceCanvasOptionCardBlock): string {
  return JSON.stringify({
    title: card.title,
    subtitle: card.subtitle,
    description: card.description,
    badge: card.badge,
    details: card.details,
  });
}

function expectCardText(viewModel: VoiceCanvasViewModel, expected: string) {
  const cards = optionCards(viewModel);
  expect(cards.length).toBeGreaterThan(0);
  expect(cards.some((card) => cardText(card).includes(expected))).toBe(true);
}

const rideCopy: RideCanvasCopy = {
  agentPresence,
  listening: { status: "Listening", title: "Ride", helper: "Start", start: "Start", cancel: "Cancel" },
  place: { title: "Where to?", helper: "Choose one", newAddress: "New address", newAddressHelper: "Enter another", continue: "Continue", back: "Back" },
  provider: { title: "Which ride?", helper: "Compare", back: "Back" },
  details: {
    savedPlace: "Saved place",
    newAddress: "New destination",
    provider: "Ride company",
    estimatedPickup: "Estimated pickup",
    estimatedArrival: "Estimated arrival",
    estimatedPrice: "Estimated price",
    reputation: "Reputation",
    accessibility: "Accessibility",
    recommended: "Recommended",
    reviewBeforeBooking: "Review before booking",
    noBookingYet: "No booking yet",
  },
  address: { title: "Address", helper: "Enter", label: "Address", placeholder: "Address", continue: "Continue", back: "Back" },
  dateTime: { title: "When?", helper: "Choose", timeLabel: "Time", continue: "Continue", back: "Back" },
  review: { title: "Review", helper: "Confirm later", destination: "Destination", provider: "Provider", date: "Date", time: "Time", confirm: "Confirm", change: "Back" },
  waiting: { status: "Waiting", title: "Waiting", helper: "Wait", action: "Waiting" },
  completed: { status: "Done", title: "Done", helper: "Done", reference: "Reference", done: "Done" },
  blocked: { status: "Blocked", title: "Blocked", helper: "Blocked", retry: "Retry", cancel: "Cancel" },
  cancelled: { status: "Cancelled", title: "Cancelled", helper: "Cancelled", restart: "Restart" },
  progress: (current, total) => `Step ${current} of ${total}`,
};

const refillCopy: RefillCanvasCopy = {
  agentPresence,
  listening: { status: "Listening", title: "Refill", helper: "Start", start: "Start", cancel: "Cancel" },
  medication: { title: "Medication", helper: "Choose", manual: "Manual", manualHelper: "Enter", cannotIdentify: "Cannot identify", cannotIdentifyHelper: "Stop", back: "Back" },
  medicationEntry: { title: "Medication", helper: "Enter", label: "Medication", placeholder: "Medication", continue: "Continue", cannotIdentify: "Cannot identify", back: "Back" },
  strength: { title: "Strength", helper: "Enter", label: "Strength", placeholder: "Strength", continue: "Continue", back: "Back" },
  safety: { title: "Routine?", helper: "Choose", routine: "Routine refill", routineHelper: "Routine only", urgent: "Urgent help", urgentHelper: "Stop safely", back: "Back" },
  provider: { title: "Provider", helper: "Choose", manual: "Manual provider", manualHelper: "Enter", back: "Back" },
  providerEntry: { title: "Provider", helper: "Enter", label: "Provider", placeholder: "Provider", continue: "Continue", back: "Back" },
  quantity: { title: "Quantity", helper: "Enter", label: "Quantity", placeholder: "Quantity", continue: "Continue", back: "Back" },
  notes: { title: "Notes", helper: "Optional", label: "Notes", placeholder: "Notes", continue: "Continue", back: "Back" },
  contact: { title: "Contact", helper: "Choose", back: "Back" },
  details: { savedProfile: "Saved profile", strength: "Strength", providerType: "Provider type", quantity: "Quantity or supply", routineBoundary: "Routine refill only", urgentBoundary: "Urgent safety boundary", noDosingChanges: "No dosing changes", reviewBeforeAction: "Review before action", manualEntry: "Manual entry", recommended: "Recommended" },
  review: { title: "Review", helper: "Confirm later", medication: "Medication", strength: "Strength", provider: "Provider", quantity: "Quantity", notes: "Notes", contact: "Contact", noNotes: "None", confirm: "Confirm", change: "Back" },
  waiting: { status: "Waiting", title: "Waiting", helper: "Wait", action: "Waiting" },
  completed: { status: "Done", title: "Done", helper: "Done", reference: "Reference", done: "Done" },
  blocked: { status: "Blocked", title: "Blocked", helper: "Blocked", identificationTitle: "Cannot identify", identificationHelper: "Try again", retry: "Retry", cancel: "Cancel" },
  urgent: { status: "Urgent", title: "Urgent", helper: "Get help", primary: "Call", secondary: "Back" },
  cancelled: { status: "Cancelled", title: "Cancelled", helper: "Cancelled", restart: "Restart" },
  progress: (current, total) => `Step ${current} of ${total}`,
};

const shoppingCopy: ShoppingCanvasCopy = {
  agentPresence,
  listening: { status: "Listening", title: "Shopping", helper: "Start", start: "Start", cancel: "Cancel" },
  retailer: { title: "Retailer", helper: "Choose", other: "Other retailer", otherHelper: "Enter", back: "Back" },
  retailerEntry: { title: "Retailer", helper: "Enter", label: "Retailer", placeholder: "Retailer", continue: "Continue", back: "Back" },
  itemName: { title: "Item", helper: "Enter", label: "Item", placeholder: "Item", continue: "Continue", back: "Back" },
  itemQuantity: { title: "Quantity", helper: "Enter", label: "Quantity", placeholder: "Quantity", continue: "Continue", back: "Back" },
  moreItems: { title: "More items?", helper: "Choose", add: "Add item", finish: "Finish", back: "Back" },
  fulfillment: { title: "Delivery or collection?", helper: "Choose", delivery: "Delivery", deliveryHelper: "Prepare delivery", collection: "Collection", collectionHelper: "Prepare collection", back: "Back" },
  location: { deliveryTitle: "Delivery address", collectionTitle: "Collection place", helper: "Choose", other: "Other place", otherDelivery: "Other delivery", otherCollection: "Other collection", back: "Back" },
  locationEntry: { deliveryTitle: "Delivery address", collectionTitle: "Collection place", helper: "Enter", label: "Location", placeholder: "Location", continue: "Continue", back: "Back" },
  time: { title: "Time", helper: "Enter", label: "Time", placeholder: "Time", continue: "Continue", back: "Back" },
  substitutions: { title: "Substitutions", helper: "Choose", none: "None", noneHelper: "No substitutions", ask: "Ask me", askHelper: "Ask first", allow: "Allow", allowHelper: "Allow similar", back: "Back" },
  estimate: { title: "Estimate", helper: "Choose", provided: "Provided", providedHelper: "Enter amount", unverified: "Unverified", unverifiedHelper: "Not checked", back: "Back" },
  cost: { title: "Cost", helper: "Enter", label: "Cost", placeholder: "Cost", continue: "Continue", back: "Back" },
  fees: { title: "Fees", helper: "Enter", label: "Fees", placeholder: "Fees", continue: "Continue", back: "Back" },
  details: { savedRetailer: "Saved retailer", savedAddress: "Saved address", retailerType: "Retailer type", estimateConfidence: "Estimate", fees: "Fees", fulfillment: "Fulfilment", deliveryBoundary: "Delivery prepared, not ordered", collectionBoundary: "Collection prepared, not reserved", substitutionRule: "Substitution rule", availability: "Availability", unverified: "Unverified", reviewBeforeAction: "Review before action", noPaymentOrOrder: "No order or payment", manualEntry: "Manual entry", recommended: "Recommended", itemsInBasket: "Items to review" },
  review: { title: "Review", helper: "Confirm later", changedHelper: "Changed", retailer: "Retailer", items: "Items", fulfillment: "Fulfilment", location: "Location", time: "Time", substitutions: "Substitutions", cost: "Cost", fees: "Fees", availability: "Availability", unverified: "Unverified", confirm: "Confirm", change: "Back", delivery: "Delivery", collection: "Collection", substitutionLabels: { none: "None", ask: "Ask", allow: "Allow" } },
  waiting: { status: "Waiting", title: "Waiting", helper: "Wait", action: "Waiting" },
  completed: { status: "Done", title: "Done", helper: "Done", reference: "Reference", done: "Done" },
  pending: { status: "Pending", title: "Pending", helper: "Pending", reference: "Reference", done: "Done" },
  blocked: { status: "Blocked", title: "Blocked", helper: "Blocked", retry: "Retry", cancel: "Cancel" },
  cancelled: { status: "Cancelled", title: "Cancelled", helper: "Cancelled", restart: "Restart" },
  progress: (current, total) => `Step ${current} of ${total}`,
  itemsSummary: (items) => items.map((item) => `${item.quantity} ${item.name}`).join(", "),
};

const providerReplyCopy: ProviderReplyCanvasCopy = {
  agentPresence,
  listening: { status: "Listening", title: "Reply", helper: "Start", start: "Start", cancel: "Cancel" },
  context: { title: "Reply intent", helper: "Choose", provider: "Provider", providerType: "Provider type", action: "Task", waiting: "Waiting", continue: "Continue", back: "Back" },
  reply: { title: "Draft", helper: "Enter", label: "Reply", placeholder: "Reply", continue: "Continue", back: "Back" },
  scheduledFor: { title: "Scheduled", helper: "Enter", label: "Scheduled", continue: "Continue", back: "Back" },
  details: { title: "Notes", helper: "Optional", label: "Notes", placeholder: "Notes", continue: "Continue", back: "Back" },
  review: { title: "Review", helper: "Confirm later", provider: "Provider", intent: "Reply intent", action: "Task", reply: "Reply", scheduledFor: "Scheduled", notes: "Notes", noNotes: "None", save: "Save", back: "Back" },
  saving: { status: "Saving", title: "Saving", helper: "No send", action: "Saving" },
  saved: { status: "Saved", title: "Saved", helper: "Saved", reference: "Reference", markComplete: "Complete", edit: "Edit" },
  completing: { status: "Completing", title: "Completing", helper: "Wait", action: "Completing" },
  completed: { status: "Done", title: "Done", helper: "Done", reference: "Reference", done: "Done" },
  blocked: { status: "Blocked", title: "Blocked", helper: "Blocked", missingContextHelper: "Missing context", incompleteReplyHelper: "Missing reply", incompleteScheduledForHelper: "Missing scheduled time", urgentBoundaryHelper: "No message was sent", retry: "Retry", cancel: "Cancel" },
  cancelled: { status: "Cancelled", title: "Cancelled", helper: "Cancelled", restart: "Restart" },
  detailLabels: { messagePurpose: "Message purpose", providerType: "Provider type", confidence: "Confidence", reviewNeeded: "Review needed", draftOnly: "Draft only", noMessageSent: "No message sent yet", reviewBeforeSend: "Review before send", recommended: "Recommended", urgentBoundary: "Urgent safety boundary", outgoingDraft: "Outgoing draft", editBeforeSend: "Edit before send" },
  progress: (current, total) => `Step ${current} of ${total}`,
};

describe("unified rich decision card contracts", () => {
  it("keeps ride rich cards aligned with the cross-flow review and no-action boundary", () => {
    const viewModel = rideCanvasViewModel({ ...initialRideCanvasState, step: "place" }, rideCopy, [{
      id: "clinic",
      label: "Clinic",
      address: "12 Garden Lane",
      pickupEstimate: { value: "8 min", tone: "good" },
      priceEstimate: { value: "$12-$16" },
      reputation: { value: "4.8 / 5", tone: "good" },
      recommended: true,
    }], [], []);

    expect(optionCards(viewModel)[0]).toMatchObject({ kind: "option-card", badge: "Recommended", recommended: true });
    expectCardText(viewModel, "Estimated pickup");
    expectCardText(viewModel, "Review before booking");
    expectCardText(viewModel, "No booking yet");
  });

  it("keeps refill safety cards explicit about routine boundaries and urgent stop paths", () => {
    const viewModel = refillCanvasViewModel({ ...initialRefillCanvasState, step: "safety" }, refillCopy, [], [], []);

    expect(optionCards(viewModel)).toHaveLength(2);
    expectCardText(viewModel, "No dosing changes");
    expectCardText(viewModel, "Review before action");
    expectCardText(viewModel, "Urgent safety boundary");
  });

  it("keeps shopping cards explicit about review and no payment/order boundaries", () => {
    const viewModel = shoppingCanvasViewModel({
      ...initialShoppingCanvasState,
      step: "fulfillment",
      draft: { ...initialShoppingCanvasState.draft, items: [{ id: "item-1", name: "Milk", quantity: "2" }] },
    }, shoppingCopy, [], []);

    expect(optionCards(viewModel)).toHaveLength(2);
    expectCardText(viewModel, "Delivery prepared, not ordered");
    expectCardText(viewModel, "Collection prepared, not reserved");
    expectCardText(viewModel, "No order or payment");
  });

  it("keeps provider reply cards explicit about draft-only, no-send, review-before-send, and urgent blocking", () => {
    const viewModel = providerReplyCanvasViewModel({ ...initialProviderReplyCanvasState, step: "context" }, providerReplyCopy, {
      providerName: "Riverside Clinic",
      providerType: "Clinic",
      replyIntents: [
        { id: "confirm", label: "Confirm appointment", recommended: true },
        { id: "urgent", label: "Urgent or safety concern", urgent: true, boundaryLabel: "This path is blocked and safe" },
      ],
    });

    expect(optionCards(viewModel)[0]).toMatchObject({ badge: "Recommended", recommended: true });
    expect(viewModel.primaryAction).toMatchObject({ disabled: true });
    expectCardText(viewModel, "Draft only");
    expectCardText(viewModel, "No message sent yet");
    expectCardText(viewModel, "Review before send");
    expectCardText(viewModel, "Urgent safety boundary");
  });
});
