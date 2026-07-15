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

  it("asks for the scam review source without treating the canned summary as enough", () => {
    const task = buildConciergeExecutionTask({
      useCase: "scam_check",
      payload: {
        source_type: "company",
        concern: "Company or offer",
        requested_tool: "web_search",
        execution_channel: "web_search",
      },
      summary: "Safe check prepared: Company or offer.",
      pendingStatus: "pending",
      now: "2026-07-14T10:00:00.000Z",
    });

    expect(task).toMatchObject({
      flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
      action_type: "web_search",
      lifecycle_status: "needs_info",
      confirmation_required: true,
      user_confirmed: false,
    });
    expect(task.missing_requirements).toEqual([{
      key: "source",
      label_en: "Source",
      label_es: "Fuente",
    }]);
  });

  it("routes deal comparisons through shopping support with confirmation still gated", () => {
    const task = buildConciergeExecutionTask({
      useCase: "find_offers",
      payload: {
        offer_name: "Senior Energy Saver",
        category: "Household costs",
        comparison_summary: "Compare price, trust, and terms.",
        requested_tool: "operator_review",
      },
      summary: "Deal comparison prepared: Senior Energy Saver.",
      pendingStatus: "pending",
      now: "2026-07-14T10:00:00.000Z",
    });

    expect(task).toMatchObject({
      flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
      action_type: "shopping_request",
      lifecycle_status: "ready",
      provider_ready: true,
      confirmation_required: true,
      user_confirmed: false,
      missing_requirements: [],
    });
  });

  it("keeps tool-gated actions in needs-info until the contact or website is known", () => {
    const task = buildConciergeExecutionTask({
      useCase: "send_message",
      payload: {
        requested_tool: "email",
        action_type: "email",
        draft_message: "Please prepare an email about my application.",
      },
      summary: "Email draft prepared.",
      pendingStatus: "pending",
      now: "2026-07-14T10:00:00.000Z",
    });

    expect(task).toMatchObject({
      flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
      action_type: "message",
      lifecycle_status: "needs_info",
      confirmation_required: true,
      user_confirmed: false,
    });
    expect(task.missing_requirements.map((item) => item.key)).toEqual(["website_or_contact"]);
  });
});
