import { describe, expect, it } from "vitest";
import {
  CONCIERGE_LIVE_HANDOFF_QA_JOURNEYS,
  getConciergeLiveHandoffQaJourney,
} from "../shared/conciergeLiveHandoffQa";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";

describe("concierge live handoff QA contract", () => {
  it("covers the four launch journeys through four distinct contact channels", () => {
    expect(CONCIERGE_LIVE_HANDOFF_QA_JOURNEYS.map((journey) => journey.reference)).toEqual([
      CONCIERGE_FLOW_REFERENCES.transportBooking,
      CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.homeService,
    ]);
    expect(CONCIERGE_LIVE_HANDOFF_QA_JOURNEYS.map((journey) => journey.channel)).toEqual([
      "phone_call",
      "whatsapp",
      "email",
      "booking_form",
    ]);
    expect(new Set(CONCIERGE_LIVE_HANDOFF_QA_JOURNEYS.map((journey) => journey.channel))).toHaveLength(4);
  });

  it("requires QA-controlled recipients, reload persistence, retry confirmation, replies, and history", () => {
    for (const journey of CONCIERGE_LIVE_HANDOFF_QA_JOURNEYS) {
      expect(journey.testProviderLabel).toMatch(/^QA /);
      expect(journey.launchInstruction).toContain("QA-controlled");
      expect(journey.launchExpectedResult.toLowerCase()).toContain("final confirmation");
      expect(journey.waitingInstruction.toLowerCase()).toContain("reload");
      expect(journey.waitingExpectedResult).toContain("Waiting for provider");
      expect(journey.noAnswerInstruction).toContain("No answer");
      expect(journey.noAnswerExpectedResult).toContain("another final user confirmation");
      expect(journey.replyInstruction).toContain("QA");
      expect(journey.historyInstruction).toContain("completed Concierge history");
    }
  });

  it("returns no live-contact contract for flows outside this focused pass", () => {
    expect(getConciergeLiveHandoffQaJourney(CONCIERGE_FLOW_REFERENCES.transportBooking)?.channel).toBe("phone_call");
    expect(getConciergeLiveHandoffQaJourney(CONCIERGE_FLOW_REFERENCES.shoppingSupport)).toBeNull();
  });
});
