import { beforeEach, describe, expect, it } from "vitest";
import { readLocalConciergeCanvasTaskItems } from "./conciergeLocalCanvasTasks";
import { emptyShoppingDraft } from "@/components/voice-canvas/shoppingCanvasMachine";
import { emptyRefillDraft } from "@/components/voice-canvas/refillCanvasMachine";

describe("readLocalConciergeCanvasTaskItems", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("surfaces restorable shopping and refill Canvas sessions as task hub cards", () => {
    sessionStorage.setItem("vyva.shoppingDelivery.v1", JSON.stringify({
      step: "review",
      draft: {
        ...emptyShoppingDraft,
        items: [{ id: "item-1", name: "Soup", quantity: "4 cans" }],
        fulfillment: "delivery",
        location: "Home",
        preferredTime: "Tomorrow",
        substitutions: "ask",
        estimateStatus: "unverified",
      },
      requestId: 0,
      revision: 2,
    }));
    sessionStorage.setItem("vyva.refillCanvas.adherence.active", JSON.stringify({
      step: "quantity",
      draft: {
        ...emptyRefillDraft,
        medicationName: "Metformin",
        strength: "500 mg",
        providerName: "Saved pharmacy",
      },
      requestId: 0,
    }));

    const items = readLocalConciergeCanvasTaskItems(false);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "local-canvas-shopping",
      title: "Shopping or delivery",
      resumePath: "/concierge/shopping",
      group: "needs_you",
      continuation: {
        flow: "shopping",
        state: "ready_to_confirm",
        sceneLabel: "Review",
      },
      actionPayload: {
        local_canvas_resume: true,
        resume_canvas: "shopping",
      },
    });
    expect(items[0].summary).toContain("1 item saved");
    expect(items[1]).toMatchObject({
      id: "local-canvas-refill-active",
      title: "Medication refill",
      resumePath: "/meds/adherence-report",
      group: "needs_you",
      continuation: {
        flow: "refill",
        state: "draft",
        sceneLabel: "Quantity",
      },
      actionPayload: {
        local_canvas_resume: true,
        resume_canvas: "refill",
      },
    });
  });

  it("ignores empty, cancelled, waiting, and invalid local sessions", () => {
    sessionStorage.setItem("vyva.shoppingDelivery.v1", JSON.stringify({
      step: "cancelled",
      draft: emptyShoppingDraft,
      requestId: 0,
      revision: 0,
    }));
    sessionStorage.setItem("vyva.refillCanvas.adherence.active", JSON.stringify({
      step: "waiting",
      draft: emptyRefillDraft,
      requestId: 1,
    }));
    sessionStorage.setItem("vyva.refillCanvas.adherence.other", "{broken");

    expect(readLocalConciergeCanvasTaskItems(false)).toEqual([]);
  });
});
