import { describe, expect, it } from "vitest";
import { actionForVoiceUtterance, routeForVoiceUtterance } from "./voiceNavigation";

describe("voice navigation actions", () => {
  it("opens medication report for medication stock questions", () => {
    const action = actionForVoiceUtterance("Do we need to buy Paracetamol?");

    expect(action?.id).toBe("voice_meds_inventory_report");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.domain).toBe("meds");
    expect(action?.extractedSubject).toBe("paracetamol");
  });

  it("routes booking a GP appointment to concierge", () => {
    const action = actionForVoiceUtterance("Can you book GP appointment for me?");

    expect(action?.id).toBe("voice_book_health_appointment");
    expect(action?.route).toBe("/concierge");
    expect(action?.domain).toBe("concierge");
  });

  it("prioritises vitals over generic health routing", () => {
    const action = actionForVoiceUtterance("Can we check my blood pressure?");

    expect(action?.id).toBe("voice_vitals_review");
    expect(action?.route).toBe("/health/vitals");
  });

  it("opens memory games for memory game requests", () => {
    expect(routeForVoiceUtterance("Let's play a memory game")).toBe("/memory-games");
  });
});
