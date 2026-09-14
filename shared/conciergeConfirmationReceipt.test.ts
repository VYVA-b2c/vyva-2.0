import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "./conciergeFlowRegistry";
import { buildConciergeConfirmationReceipt } from "./conciergeConfirmationReceipt";

describe("concierge confirmation receipts", () => {
  it("summarizes a confirmed ride with subject, status, next step, and details", () => {
    const receipt = buildConciergeConfirmationReceipt({
      useCase: "book_ride",
      providerName: "Radio Taxi",
      outcome: "completed",
      outcomeSummary: "Ride saved with Radio Taxi.",
      payload: {
        flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
        execution_mode: "live",
        destination_address: "City Clinic",
        pickup_address: "Saved home",
        requested_time: "tomorrow 09:00",
        price_estimate: "EUR18",
        booking_reference: "RT-123",
        provider_phone: "+34 612 345 678",
      },
    });

    expect(receipt.flowLabel).toBe("Ride");
    expect(receipt.whatVyvaDid).toBe("Ride saved with Radio Taxi.");
    expect(receipt.subjectLabel).toBe("With");
    expect(receipt.subjectValue).toBe("Radio Taxi");
    expect(receipt.statusLabel).toBe("Completed");
    expect(receipt.nextStep).toContain("review this receipt");
    expect(receipt.details.map((detail) => detail.key)).toEqual(expect.arrayContaining(["destination", "pickup", "time", "cost", "reference", "phone"]));
  });

  it("turns sent email and WhatsApp outcomes into clear receipt statuses", () => {
    expect(buildConciergeConfirmationReceipt({
      useCase: "admin_task",
      payload: {
        email_outcome: "sent",
        recipient_email: "clinic@example.com",
        subject: "Appointment request",
      },
    }).statusLabel).toBe("Sent");

    const whatsapp = buildConciergeConfirmationReceipt({
      useCase: "provider_reply",
      providerName: "Neighborhood Pharmacy",
      payload: {
        whatsapp_outcome: "sent",
        recipient_whatsapp: "+34600111222",
        provider_reply: "Pickup is ready.",
      },
    });
    expect(whatsapp.whatVyvaDid).toBe("VYVA recorded the WhatsApp that was sent.");
    expect(whatsapp.statusLabel).toBe("Sent");
    expect(whatsapp.details.map((detail) => detail.key)).toContain("whatsapp");
  });

  it("explains waiting, missing-info, and unavailable outcomes without implying completion", () => {
    expect(buildConciergeConfirmationReceipt({
      useCase: "home_service",
      providerName: "Saved Plumber",
      outcome: "waiting",
    }).nextStep).toBe("VYVA keeps this saved while you wait for a reply.");

    expect(buildConciergeConfirmationReceipt({
      useCase: "book_appointment",
      providerName: "City Clinic",
      payload: { provider_reply_status: "needs_more_info" },
    }).statusLabel).toBe("Needs your reply");

    expect(buildConciergeConfirmationReceipt({
      useCase: "shopping_request",
      providerName: "Local Seller",
      payload: { provider_reply_status: "unavailable" },
    }).nextStep).toBe("You can compare another option before contacting anyone.");
  });
});
