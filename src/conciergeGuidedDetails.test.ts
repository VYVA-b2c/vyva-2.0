import { describe, expect, it } from "vitest";
import {
  buildConciergeGuidedDetailCapture,
  guidedDetailValue,
} from "../shared/conciergeGuidedDetails";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";

describe("concierge guided detail capture", () => {
  it("asks for the next missing ride detail in order", () => {
    const capture = buildConciergeGuidedDetailCapture({
      useCase: "book_ride",
      locale: "en",
      payload: {
        pickup_address: "Saved home",
        requested_time: "tomorrow 09:00",
      },
    });

    expect(capture?.nextQuestion).toMatchObject({
      key: "destination_address",
      payloadKey: "destination_address",
      prompt: "Where should the ride go?",
    });
    expect(capture?.missingRequiredKeys).toEqual(["destination_address"]);
    expect(capture?.complete).toBe(false);
  });

  it("uses flow references for OTC pharmacy tasks without a new table", () => {
    const capture = buildConciergeGuidedDetailCapture({
      useCase: "admin_task",
      locale: "en",
      payload: {
        flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
        item_text: "Vitamin D",
      },
    });

    expect(capture?.nextQuestion).toMatchObject({
      key: "fulfillment_preference",
      payloadKey: "fulfillment_preference",
    });
    expect(capture?.questions.map((question) => question.key)).toEqual([
      "item_text",
      "fulfillment_preference",
      "requested_time",
    ]);
  });

  it("chooses the right scam subject payload for link checks", () => {
    const capture = buildConciergeGuidedDetailCapture({
      useCase: "scam_check",
      locale: "en",
      payload: {
        show_vyva_action_id: "check_link",
      },
    });

    expect(capture?.nextQuestion).toMatchObject({
      key: "scam_subject",
      payloadKey: "url",
      label: "Link",
    });
  });

  it("recognizes saved provider-search criteria aliases", () => {
    expect(guidedDetailValue({ criteria_notes: "price and reputation" }, "scam_context")).toBe("price and reputation");
  });
});
