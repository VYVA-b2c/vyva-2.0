import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "./conciergeFlowRegistry";
import { APP_WORKFLOW_REFERENCES } from "./workflowRegistry";
import { buildWorkflowReceiptMoment } from "./workflowReceiptMoments";

describe("workflow receipt moments", () => {
  it("keeps light actions simple and ready to continue", () => {
    const receipt = buildWorkflowReceiptMoment({
      workflowReference: APP_WORKFLOW_REFERENCES.gameScentMemory,
      status: "done",
    });

    expect(receipt.actionLevel).toBe("light");
    expect(receipt.title).toBe("Scent Memory done");
    expect(receipt.statusLabel).toBe("Done");
    expect(receipt.message).toBe("You can continue when you are ready.");
    expect(receipt.primaryActionLabel).toBe("Continue");
    expect(receipt.requiresFinalConfirmation).toBe(false);
  });

  it("summarizes guided actions with captured context", () => {
    const receipt = buildWorkflowReceiptMoment({
      workflowReference: APP_WORKFLOW_REFERENCES.togetherSharePlan,
      subject: "quiet lunch nearby",
      capturedSummary: "Shared. Others can join or say maybe.",
      details: [{ key: "comfort", label: "Comfort", value: "Easy access" }],
    });

    expect(receipt.actionLevel).toBe("guided");
    expect(receipt.title).toBe("Saved with context");
    expect(receipt.message).toBe("Shared. Others can join or say maybe.");
    expect(receipt.details).toEqual([{ key: "comfort", label: "Comfort", value: "Easy access" }]);
    expect(receipt.requiresFinalConfirmation).toBe(false);
  });

  it("reuses Concierge confirmation details for external actions", () => {
    const receipt = buildWorkflowReceiptMoment({
      workflowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
      conciergeReceiptInput: {
        useCase: "book_ride",
        providerName: "Radio Taxi",
        outcome: "completed",
        outcomeSummary: "Ride saved with Radio Taxi.",
        payload: {
          flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
          destination_address: "City Clinic",
          pickup_address: "Saved home",
          requested_time: "tomorrow 09:00",
          booking_reference: "RT-123",
        },
      },
    });

    expect(receipt.actionLevel).toBe("external_action");
    expect(receipt.title).toBe("Ride: Completed");
    expect(receipt.message).toBe("Ride saved with Radio Taxi.");
    expect(receipt.primaryActionLabel).toBe("Review receipt");
    expect(receipt.secondaryActionLabel).toBe("Change details");
    expect(receipt.requiresFinalConfirmation).toBe(true);
    expect(receipt.details.map((detail) => detail.key)).toEqual(expect.arrayContaining(["destination", "pickup", "time", "reference"]));
  });

  it("prepares cross-pillar external actions without implying anything was sent", () => {
    const receipts = [
      APP_WORKFLOW_REFERENCES.visualScan,
      CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
      CONCIERGE_FLOW_REFERENCES.scamCheck,
    ].map((workflowReference) => buildWorkflowReceiptMoment({
      workflowReference,
      status: "prepared",
      capturedSummary: "Saved. Continue in Concierge when you are ready.",
    }));

    expect(receipts).toHaveLength(3);
    for (const receipt of receipts) {
      expect(receipt.actionLevel).toBe("external_action");
      expect(receipt.title).toBe("Action prepared");
      expect(receipt.message).toBe("Saved. Continue in Concierge when you are ready.");
      expect(receipt.nextStep).toBe("Review the details and confirm before calling, sending, booking, or sharing.");
      expect(receipt.requiresFinalConfirmation).toBe(true);
    }
  });

  it("turns setup completion into future readiness", () => {
    const receipt = buildWorkflowReceiptMoment({
      workflowReference: APP_WORKFLOW_REFERENCES.trustedProviders,
      details: [{ key: "provider", label: "Provider", value: "Neighborhood Pharmacy" }],
    });

    expect(receipt.actionLevel).toBe("setup");
    expect(receipt.title).toBe("Ready for future help");
    expect(receipt.message).toBe("VYVA can use this next time you ask for help.");
    expect(receipt.nextStep).toBe("Next time, VYVA can skip repeated questions.");
    expect(receipt.details[0].value).toBe("Neighborhood Pharmacy");
  });
});
