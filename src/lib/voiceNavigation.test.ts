import { describe, expect, it } from "vitest";
import {
  actionForSpecialistTransfer,
  actionForVoiceToolCall,
  actionForVoiceUtterance,
  routeForVoiceUtterance,
  specialistTransferFromToolCall,
  voiceActionRegistryEntries,
} from "./voiceNavigation";

describe("voice navigation actions", () => {
  it("opens medication report for medication stock questions", () => {
    const action = actionForVoiceUtterance("Do we need to buy Paracetamol?");

    expect(action?.id).toBe("voice_meds_inventory_report");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.domain).toBe("meds");
    expect(action?.actionType).toBe("meds.inventory_report");
    expect(action?.safetyLevel).toBe("medical");
    expect(action?.extractedSubject).toBe("paracetamol");
  });

  it("routes booking a GP appointment to concierge", () => {
    const action = actionForVoiceUtterance("Can you book GP appointment for me?");

    expect(action?.id).toBe("voice_book_health_appointment");
    expect(action?.route).toBe("/concierge");
    expect(action?.domain).toBe("concierge");
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes shopping and grocery choices to the Concierge shopping helper", () => {
    const action = actionForVoiceUtterance("Can you help me choose groceries for the week?");

    expect(action?.id).toBe("voice_concierge_shopping");
    expect(action?.route).toBe("/concierge/shopping");
    expect(action?.domain).toBe("concierge");
    expect(action?.requiresConfirmation).toBe(false);
  });

  it("routes trusted provider requests to the home-service intake", () => {
    const action = actionForVoiceUtterance("I need a plumber today");

    expect(action?.id).toBe("voice_concierge_home_service");
    expect(action?.route).toBe("/concierge");
    expect(action?.domain).toBe("concierge");
    expect(action?.actionType).toBe("concierge.home_service");
    expect(action?.payload).toMatchObject({
      intake_origin: "voice",
      service_type: "plumber",
      task_type: "home_service",
    });
  });

  it("prioritises vitals over generic health routing", () => {
    const action = actionForVoiceUtterance("Can we check my blood pressure?");

    expect(action?.id).toBe("voice_vitals_review");
    expect(action?.route).toBe("/health/vitals");
  });

  it("opens memory games for memory game requests", () => {
    expect(routeForVoiceUtterance("Let's play a memory game")).toBe("/memory-games");
  });

  it("creates app actions from ElevenLabs tool parameters", () => {
    const action = actionForVoiceToolCall({
      route: "/meds/adherence-report",
      title: "Paracetamol stock",
      reason: "The user asked whether they need to buy paracetamol.",
      subject: "paracetamol",
    });

    expect(action?.id).toBe("voice_meds_inventory_report");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.title).toBe("Paracetamol stock");
    expect(action?.extractedSubject).toBe("paracetamol");
    expect(action?.payload?.simulated).toBeUndefined();
    expect(action?.optionalPayloadKeys).toContain("medication_name");
  });

  it("creates app actions from registry aliases", () => {
    const action = actionForVoiceToolCall({
      action_type: "meds_inventory_report",
      medication_name: "ibuprofen",
    });

    expect(action?.actionType).toBe("meds.inventory_report");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.payload?.medication_name).toBe("ibuprofen");
  });

  it("rejects unrecognised app action routes from tool parameters", () => {
    expect(actionForVoiceToolCall({ route: "https://example.com" })).toBeNull();
    expect(actionForVoiceToolCall({ route: "/unknown" })).toBeNull();
  });

  it("creates specialist transfer requests from tool parameters", () => {
    const transfer = specialistTransferFromToolCall({
      domain: "brain-coach",
      reason: "The user asked for a memory game.",
    });

    expect(transfer?.domain).toBe("brain_coach");
    expect(transfer?.agentSlug).toBe("brain-coach");

    const action = transfer ? actionForSpecialistTransfer(transfer) : null;
    expect(action?.id).toBe("voice_transfer_brain_coach");
    expect(action?.route).toBe("/activities");
  });

  it("exposes action registry contracts for simulator and app fulfilment", () => {
    const entries = voiceActionRegistryEntries();
    const meds = entries.find((entry) => entry.actionType === "meds.inventory_report");
    const safety = entries.find((entry) => entry.actionType === "safety.support");

    expect(entries.length).toBeGreaterThan(8);
    expect(meds?.optionalPayloadKeys).toContain("medication_name");
    expect(safety?.safetyLevel).toBe("urgent");
    expect(safety?.requiresConfirmation).toBe(true);
  });
});
