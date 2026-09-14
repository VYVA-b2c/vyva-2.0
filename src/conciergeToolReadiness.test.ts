import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import {
  evaluateConciergeToolReadiness,
  preferredToolFromTransportActions,
  toolFromAppointmentChannel,
} from "../shared/conciergeToolReadiness";

describe("concierge tool readiness", () => {
  it("marks configured provider channels as ready", () => {
    const readiness = evaluateConciergeToolReadiness({
      flowReference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      requestedTool: toolFromAppointmentChannel("email"),
      provider: {
        email: "clinic@example.com",
        availableChannels: ["email", "manual"],
      },
    });

    expect(readiness).toMatchObject({
      status: "ready",
      activeTool: "email",
      canProceed: true,
      missing: [],
    });
  });

  it("falls back to manual review when provider contact details are missing", () => {
    const readiness = evaluateConciergeToolReadiness({
      flowReference: CONCIERGE_FLOW_REFERENCES.homeService,
      requestedTool: "phone_call",
      provider: { name: "Home Repair" },
    });

    expect(readiness).toMatchObject({
      status: "manual_review",
      activeTool: "operator_review",
      canProceed: true,
      missing: ["phone"],
      reason: "missing_provider_detail",
    });
  });

  it("treats a provider website as a usable handoff route", () => {
    const readiness = evaluateConciergeToolReadiness({
      flowReference: CONCIERGE_FLOW_REFERENCES.homeService,
      requestedTool: "booking_link",
      provider: { name: "Home Repair", websiteUrl: "https://repair.example" },
    });

    expect(readiness).toMatchObject({
      status: "ready",
      activeTool: "booking_link",
      canProceed: true,
      missing: [],
    });
  });

  it("falls back to manual review when a direct capability is disabled", () => {
    const readiness = evaluateConciergeToolReadiness({
      flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
      requestedTool: "phone_call",
      provider: { phone: "+34 600 111 222" },
      capabilities: { phone_call: false, operator_review: true },
    });

    expect(readiness).toMatchObject({
      status: "manual_review",
      activeTool: "operator_review",
      canProceed: true,
      reason: "capability_unavailable",
    });
  });

  it("chooses operator review for transport options that prepare a concierge action", () => {
    expect(preferredToolFromTransportActions(["call_phone", "start_concierge_action"])).toBe("operator_review");
    expect(preferredToolFromTransportActions(["open_url"])).toBe("booking_link");
  });
});
