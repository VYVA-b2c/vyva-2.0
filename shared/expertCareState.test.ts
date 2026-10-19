import { describe, expect, it } from "vitest";
import { acknowledgeExpertCareResearchBoundary, applyExpertCarePatch, attachExpertCareContactPreparation, attachExpertCareEvidence, attachExpertCareSpecialistResponse, attachExpertCareSpecialists, createExpertCareState, updateExpertCareVerification } from "./expertCareState";

const evidence = { items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true as const, unavailableSources: [] };
const specialists = { candidates: [{ id: "doctor-1", verificationStatus: "unverified", verificationDetails: [] } as never], contactBlockedUntilVerified: true as const, retrievedAt: "2026-10-19T10:00:00.000Z" };

describe("Expert Care persisted state", () => {
  it("invalidates dependent research and specialists when clinical context changes", () => {
    let state = createExpertCareState("en", "2026-10-19T09:00:00.000Z");
    state = attachExpertCareEvidence(state, evidence);
    state = attachExpertCareSpecialists(state, specialists);
    const updated = applyExpertCarePatch(state, { specialty: "oncology" }, "2026-10-19T11:00:00.000Z");
    expect(updated.evidence).toBeNull();
    expect(updated.specialists).toBeNull();
    expect(updated.verification).toEqual([]);
    expect(updated.coordinationStatus).toBe("not_started");
  });

  it("keeps evidence but invalidates the shortlist when only location changes", () => {
    let state = createExpertCareState();
    state = attachExpertCareEvidence(state, evidence);
    state = attachExpertCareSpecialists(state, specialists);
    const updated = applyExpertCarePatch(state, { location: "Madrid, Spain" });
    expect(updated.evidence?.result).toBe(evidence);
    expect(updated.specialists).toBeNull();
  });

  it("requires a fresh educational-boundary acknowledgement for each evidence brief", () => {
    let state = attachExpertCareEvidence(createExpertCareState(), evidence);
    expect(state.consent.research).toBe(false);
    state = acknowledgeExpertCareResearchBoundary(state);
    expect(state.consent.research).toBe(true);
    state = applyExpertCarePatch(state, { concerns: "A changed consultation goal" });
    expect(state.evidence).toBeNull();
    expect(state.consent.research).toBe(false);
  });

  it("invalidates downstream work when the goal or safety answer changes", () => {
    let state = createExpertCareState();
    state = applyExpertCarePatch(state, { emergencyResult: "clear", goal: "find_specialist" });
    state = attachExpertCareEvidence(state, evidence);
    state = attachExpertCareSpecialists(state, specialists);
    const goalChanged = applyExpertCarePatch(state, { goal: "trials_advances" });
    expect(goalChanged.evidence).toBeNull();
    expect(goalChanged.specialists).toBeNull();

    state = attachExpertCareEvidence(state, evidence);
    state = attachExpertCareSpecialists(state, specialists);
    const safetyExpired = applyExpertCarePatch(state, { emergencyResult: "not_checked" });
    expect(safetyExpired.evidence).toBeNull();
    expect(safetyExpired.specialists).toBeNull();
  });

  it("stops the case and clears all actionable results on an emergency", () => {
    let state = createExpertCareState();
    state = attachExpertCareEvidence(state, evidence);
    state = attachExpertCareSpecialists(state, specialists);
    const updated = applyExpertCarePatch(state, { emergencyResult: "urgent_stop", stage: "research" });
    expect(updated.stage).toBe("safety");
    expect(updated.evidence).toBeNull();
    expect(updated.specialists).toBeNull();
    expect(updated.consent.sharing).toBe(false);
  });

  it("blocks contact state until operations verification and records itemized consent", () => {
    let state = attachExpertCareSpecialists(createExpertCareState(), specialists);
    state = updateExpertCareVerification(state, "doctor-1", "verification_pending", ["Requested"]);
    expect(state.specialists?.result.candidates[0].verificationStatus).toBe("verification_pending");
    expect(state.coordinationStatus).toBe("not_started");

    state = updateExpertCareVerification(state, "doctor-1", "verified", ["License and contact route confirmed"], {
      institution: "Reference Hospital", country: "Spain", address: "Madrid", languages: ["English"], remoteCareRegions: ["Spain"],
      expertiseEvidence: ["Registered oncology subspecialist"], contactData: { email: "clinic@example.test", phone: null, website: null },
      availability: "Remote consultations available", timezone: "Europe/Madrid", estimatedCost: "€250",
    });
    expect(state.specialists?.result.candidates[0]).toMatchObject({ institution: "Reference Hospital", languages: ["English"], contactData: { email: "clinic@example.test" } });
    state = attachExpertCareContactPreparation(state, {
      pendingActionId: "task-1",
      candidateId: "doctor-1",
      recipient: "clinic@example.test",
      documentIds: [],
      healthFields: ["diagnosis_or_recommendation"],
      channel: "email",
      message: "Please review this request for an expert consultation.",
      confirmedAt: "2026-10-19T12:00:00.000Z",
    });
    expect(state.consent.sharing).toBe(true);
    expect(state.coordinationStatus).toBe("awaiting_confirmation");
    expect(state.contactPreparation?.recipient).toBe("clinic@example.test");
    state = attachExpertCareSpecialistResponse(state, { candidateId: "doctor-1", outcome: "accepted", notes: "Appointment offered", receivedAt: "2026-10-19T13:00:00.000Z" });
    expect(state.coordinationStatus).toBe("complete");
    expect(state.stage).toBe("ready");
    expect(state.specialistResponse?.outcome).toBe("accepted");
  });
});
