import { describe, expect, it } from "vitest";
import {
  actionForSpecialistTransfer,
  actionForVoiceToolCall,
  actionForVoiceUtterance,
  isActionableVoiceText,
  routeForVoiceUtterance,
  specialistTransferFromToolCall,
  voiceActionRegistryEntries,
} from "./voiceNavigation";

describe("voice navigation actions", () => {
  it("ignores punctuation-only and filler transcript noise", () => {
    expect(isActionableVoiceText("'")).toBe(false);
    expect(isActionableVoiceText("...")).toBe(false);
    expect(isActionableVoiceText(" ? ")).toBe(false);
    expect(isActionableVoiceText("um")).toBe(false);
    expect(actionForVoiceUtterance("'")).toBeNull();
    expect(routeForVoiceUtterance("...")).toBeNull();
  });

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

  it("routes vitals capture requests separately from vitals review", () => {
    const action = actionForVoiceUtterance("Measure my blood pressure");

    expect(action?.id).toBe("voice_vitals_capture");
    expect(action?.actionType).toBe("health.vitals_capture");
    expect(action?.route).toBe("/health/vitals");
    expect(action?.payload?.vital_type).toBe("blood_pressure");
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes ride booking requests to Concierge with confirmation context", () => {
    const action = actionForVoiceUtterance("Book me a ride to the doctor tomorrow morning");

    expect(action?.id).toBe("voice_concierge_ride_booking");
    expect(action?.actionType).toBe("concierge.ride_booking");
    expect(action?.route).toBe("/concierge");
    expect(action?.domain).toBe("concierge");
    expect(action?.payload).toMatchObject({ task_type: "ride", destination: "doctor", time: "tomorrow morning" });
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes order requests to the shopping order journey", () => {
    const action = actionForVoiceUtterance("Order groceries for tomorrow");

    expect(action?.id).toBe("voice_concierge_order_request");
    expect(action?.actionType).toBe("concierge.order_request");
    expect(action?.route).toBe("/concierge/shopping");
    expect(action?.payload).toMatchObject({ items: "groceries", category: "groceries" });
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes medication refill requests separately from stock reports", () => {
    const action = actionForVoiceUtterance("I need more metformin");

    expect(action?.id).toBe("voice_meds_refill_request");
    expect(action?.actionType).toBe("meds.refill_request");
    expect(action?.route).toBe("/meds/adherence-report");
    expect(action?.payload?.medication_name).toBe("metformin");
    expect(action?.requiresConfirmation).toBe(true);
  });

  it("routes reminder requests to scheduled support", () => {
    const action = actionForVoiceUtterance("Remind me tomorrow morning to call my daughter");

    expect(action?.id).toBe("voice_concierge_reminder");
    expect(action?.route).toBe("/settings/scheduled-support");
    expect(action?.payload?.reminder_time).toBe("tomorrow morning");
  });

  it("opens memory games for memory game requests", () => {
    expect(routeForVoiceUtterance("Let's play a memory game")).toBe("/memory-games");
  });

  it("routes common brain and companion journeys to their direct screens", () => {
    expect(actionForVoiceUtterance("Help me relax")?.actionType).toBe("brain.relax_breathe");
    expect(routeForVoiceUtterance("Help me focus")).toBe("/attention-boosters");
    expect(routeForVoiceUtterance("I want to learn something")).toBe("/learn");
    expect(routeForVoiceUtterance("Train my senses")).toBe("/senses");
    expect(actionForVoiceUtterance("I want cognitive exercises")?.actionType).toBe("brain.activity");
    expect(routeForVoiceUtterance("I want cognitive exercises")).toBe("/mind-memory");
    expect(routeForVoiceUtterance("I want someone to talk to")).toBe("/companions");
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

  it("infers ride actions from ambiguous Concierge tool calls", () => {
    const action = actionForVoiceToolCall({
      route: "/concierge",
      domain: "concierge",
      source_text: "Book me a ride to the doctor tomorrow morning",
    });

    expect(action?.actionType).toBe("concierge.ride_booking");
    expect(action?.route).toBe("/concierge");
    expect(action?.payload).toMatchObject({
      task_type: "ride",
      destination: "doctor",
      time: "tomorrow morning",
    });
  });

  it("infers Brain Coach actions from ambiguous cognitive exercise tool calls", () => {
    const action = actionForVoiceToolCall({
      domain: "brain",
      source_text: "I want cognitive exercises",
    });

    expect(action?.actionType).toBe("brain.activity");
    expect(action?.domain).toBe("brain_coach");
    expect(action?.route).toBe("/mind-memory");
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
    expect(action?.route).toBe("/mind-memory");
  });

  it("exposes action registry contracts for simulator and app fulfilment", () => {
    const entries = voiceActionRegistryEntries();
    const meds = entries.find((entry) => entry.actionType === "meds.inventory_report");
    const safety = entries.find((entry) => entry.actionType === "safety.support");
    const ride = entries.find((entry) => entry.actionType === "concierge.ride_booking");
    const refill = entries.find((entry) => entry.actionType === "meds.refill_request");

    expect(entries.length).toBeGreaterThan(18);
    expect(meds?.optionalPayloadKeys).toContain("medication_name");
    expect(safety?.safetyLevel).toBe("urgent");
    expect(safety?.requiresConfirmation).toBe(true);
    expect(ride?.requiredPayloadKeys).toEqual(["pickup", "destination", "time"]);
    expect(refill?.requiresConfirmation).toBe(true);
  });
});
