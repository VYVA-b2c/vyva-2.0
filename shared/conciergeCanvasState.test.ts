import { describe, expect, it } from "vitest";
import {
  conciergeCanvasFlowKind,
  deriveConciergeCanvasState,
} from "./conciergeCanvasState";
import { CONCIERGE_FLOW_REFERENCES } from "./conciergeFlowRegistry";
import type { ConciergeExecutionTask } from "./conciergeActionExecution";

function task(overrides: Partial<ConciergeExecutionTask> = {}): Partial<ConciergeExecutionTask> {
  return {
    lifecycle_status: "ready",
    user_confirmed: false,
    external_action_allowed: false,
    missing_requirements: [],
    channel_readiness: {
      version: 1,
      tool: "operator_review",
      channel: "operator_review",
      label: "VYVA review",
      status: "ready",
      ready: true,
      admin_enabled: true,
      configured: true,
      verified: true,
      dry_run: false,
      external_action_allowed: false,
      blockers: [],
    },
    ...overrides,
  };
}

describe("concierge canvas state machine", () => {
  it("maps the required concierge flows to stable canvas flow kinds", () => {
    expect(conciergeCanvasFlowKind({ flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking })).toBe("ride");
    expect(conciergeCanvasFlowKind({ flowReference: CONCIERGE_FLOW_REFERENCES.homeService })).toBe("home_service");
    expect(conciergeCanvasFlowKind({ flowReference: CONCIERGE_FLOW_REFERENCES.otcPharmacy })).toBe("otc_pharmacy");
    expect(conciergeCanvasFlowKind({ flowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport })).toBe("shopping");
    expect(conciergeCanvasFlowKind({ actionType: "provider_reply" })).toBe("provider_reply");
  });

  it("keeps ride booking in collecting while destination, pickup, or time details are missing", () => {
    const summary = deriveConciergeCanvasState({
      useCase: "book_ride",
      status: "pending",
      executionTask: task({
        flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
        lifecycle_status: "needs_info",
        missing_requirements: [{ key: "destination", label_en: "Destination", label_es: "Destino" }],
      }),
    });

    expect(summary).toMatchObject({
      state: "collecting",
      flowKind: "ride",
      primaryActionLabel: "Add detail",
      safeExternalActionAllowed: false,
      requiresUserConfirmationBeforeExternalAction: true,
    });
  });

  it("marks home service as ready to review once details are complete but not yet presented", () => {
    const summary = deriveConciergeCanvasState({
      useCase: "home_service",
      status: "pending",
      executionTask: task({
        flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
      }),
      hasReviewSummary: true,
    });

    expect(summary).toMatchObject({
      state: "ready_to_review",
      flowKind: "home_service",
      primaryActionLabel: "Review",
      safeExternalActionAllowed: false,
    });
  });

  it("moves OTC pharmacy help to awaiting confirmation when the review is on screen", () => {
    const summary = deriveConciergeCanvasState({
      useCase: "order_medicine",
      status: "pending",
      executionTask: task({
        flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      }),
      hasReviewSummary: true,
      reviewPresented: true,
    });

    expect(summary).toMatchObject({
      state: "awaiting_confirmation",
      flowKind: "otc_pharmacy",
      primaryActionLabel: "Confirm",
      requiresUserConfirmationBeforeExternalAction: true,
      safeExternalActionAllowed: false,
    });
  });

  it("does not allow shopping external action before explicit confirmation", () => {
    const summary = deriveConciergeCanvasState({
      useCase: "shopping_request",
      status: "pending",
      executionTask: task({
        flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
        action_type: "shopping_request",
        external_action_allowed: true,
        channel_readiness: {
          version: 1,
          tool: "web_search",
          channel: "web_search",
          label: "Web search",
          status: "ready",
          ready: true,
          admin_enabled: true,
          configured: true,
          verified: true,
          dry_run: false,
          external_action_allowed: true,
          blockers: [],
        },
      }),
      reviewPresented: true,
    });

    expect(summary.state).toBe("awaiting_confirmation");
    expect(summary.flowKind).toBe("shopping");
    expect(summary.safeExternalActionAllowed).toBe(false);
  });

  it("allows an in-progress external step only after user confirmation and channel readiness", () => {
    const summary = deriveConciergeCanvasState({
      useCase: "book_ride",
      status: "calling",
      executionTask: task({
        flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
        lifecycle_status: "in_progress",
        user_confirmed: true,
        external_action_allowed: true,
        channel_readiness: {
          version: 1,
          tool: "phone_call",
          channel: "phone",
          label: "Phone calls",
          status: "ready",
          ready: true,
          admin_enabled: true,
          configured: true,
          verified: true,
          dry_run: false,
          external_action_allowed: true,
          blockers: [],
        },
      }),
    });

    expect(summary).toMatchObject({
      state: "in_progress",
      primaryActionLabel: "Continue",
      safeExternalActionAllowed: true,
      requiresUserConfirmationBeforeExternalAction: false,
    });
  });

  it("routes provider replies needing follow-up into needs_user_input", () => {
    const summary = deriveConciergeCanvasState({
      actionType: "provider_reply",
      status: "calling",
      executionTask: task({ user_confirmed: true }),
      providerReply: {
        status: "reply_received",
        followUpRequiresConfirmation: true,
      },
    });

    expect(summary).toMatchObject({
      state: "needs_user_input",
      flowKind: "provider_reply",
      primaryActionLabel: "Continue",
      safeExternalActionAllowed: false,
    });
  });

  it("maps completed and failed terminal states to Save and Try another way", () => {
    expect(deriveConciergeCanvasState({
      status: "completed",
      executionTask: task({ lifecycle_status: "done", user_confirmed: true }),
    }).primaryActionLabel).toBe("Save");

    expect(deriveConciergeCanvasState({
      status: "failed",
      executionTask: task({ lifecycle_status: "failed" }),
    }).primaryActionLabel).toBe("Try another way");
  });
});
