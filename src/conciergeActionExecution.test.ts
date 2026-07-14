import { describe, expect, it } from "vitest";
import {
  buildConciergeExecutionTask,
  withConciergeExecutionTask,
} from "../shared/conciergeActionExecution";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";

describe("concierge action execution task", () => {
  it("marks a ride as needing details before it can be executed", () => {
    const task = buildConciergeExecutionTask({
      useCase: "book_ride",
      providerName: "Radio Taxi",
      providerPhone: "+34 600 111 222",
      payload: {
        pickup_address: "Home",
        requested_time: "tomorrow 09:00",
      },
      summary: "Book a ride to the clinic",
      pendingStatus: "pending",
      now: "2026-07-14T10:00:00.000Z",
    });

    expect(task).toMatchObject({
      version: 1,
      flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
      action_type: "phone_call",
      requested_tool: "phone_call",
      lifecycle_status: "needs_info",
      provider_ready: true,
      user_confirmed: false,
    });
    expect(task.missing_requirements.map((item) => item.key)).toContain("destination");
  });

  it("keeps missing saved providers visible for provider-required flows", () => {
    const task = buildConciergeExecutionTask({
      useCase: "order_medicine",
      payload: {
        item_text: "vitamins",
        fulfillment_preference: "pickup",
        requested_time: "today",
      },
      summary: "Ask pharmacy for vitamins",
      pendingStatus: "pending",
      now: "2026-07-14T10:00:00.000Z",
    });

    expect(task.lifecycle_status).toBe("needs_info");
    expect(task.missing_requirements[0]).toMatchObject({
      key: "provider",
      label_en: "Provider",
    });
  });

  it("records user confirmation when a task starts", () => {
    const payload = withConciergeExecutionTask({
      useCase: "book_appointment",
      providerName: "Marbella Clinic",
      providerPhone: "+34 600 333 444",
      payload: {
        reason: "Follow-up",
        requested_time: "Friday morning",
      },
      summary: "Call clinic",
      pendingStatus: "calling",
      lifecycleStatus: "in_progress",
      userConfirmed: true,
      confirmationSource: "confirm_endpoint",
      now: "2026-07-14T10:00:00.000Z",
    });

    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "in_progress",
      user_confirmed: true,
      confirmation_source: "confirm_endpoint",
      confirmed_at: "2026-07-14T10:00:00.000Z",
    });
  });

  it("carries completed execution proof into outcome payloads", () => {
    const payload = withConciergeExecutionTask({
      useCase: "insurance_admin",
      payload: {
        document_type: "claim",
        recipient_email: "insurer@example.com",
        deadline: "Friday",
        execution_channel: "email",
      },
      summary: "Prepare insurance claim",
      pendingStatus: "completed",
      lifecycleStatus: "done",
      userConfirmed: true,
      confirmationSource: "completion_endpoint",
      outcome: "Claim email prepared and saved.",
      now: "2026-07-14T10:00:00.000Z",
    });

    expect(payload.execution_task).toMatchObject({
      flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
      action_type: "admin_paperwork",
      requested_tool: "email",
      lifecycle_status: "done",
      outcome: "Claim email prepared and saved.",
    });
  });
});
