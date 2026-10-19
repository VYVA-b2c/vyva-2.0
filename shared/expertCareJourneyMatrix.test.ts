import { describe, expect, it } from "vitest";
import type { ExpertCareSpecialty, SpecialistCandidate } from "./expertCare";
import {
  acknowledgeExpertCareResearchBoundary,
  applyExpertCarePatch,
  attachExpertCareContactPreparation,
  attachExpertCareEvidence,
  attachExpertCareSpecialists,
  createExpertCareState,
  updateExpertCareVerification,
} from "./expertCareState";

const specialties: ExpertCareSpecialty[] = ["oncology", "cardiology", "neurology"];
const languages = ["en", "es"] as const;
const people = ["self", "trusted_helper"] as const;

const candidate = (specialty: ExpertCareSpecialty): SpecialistCandidate => ({
  id: `${specialty}-candidate`, name: "Specialist candidate", specialty, institution: "Reference hospital",
  country: "ES", address: "Madrid", distanceMeters: null, openingStatus: null, todayOpeningHours: null,
  languages: ["English", "Español"], remoteCareRegions: ["European Union"], websiteUrl: null,
  mapsUrl: null, rating: null, reviewCount: null, ratingProvenance: null,
  expertiseEvidence: ["Subspecialty verification pending"],
  directorySources: [{ label: "Open directory", url: "https://example.test/directory" }],
  contactData: { website: null, phone: null, email: "clinic@example.test" }, availability: null,
  timezone: "Europe/Madrid", estimatedCost: null, verificationStatus: "unverified",
  verificationDetails: [], sourceLabel: "Open directory",
});

describe("Expert Care complete journey matrix", () => {
  for (const language of languages) for (const specialty of specialties) for (const person of people) {
    it(`reaches confirmed coordination for ${language}/${specialty}/${person}`, () => {
      let state = createExpertCareState(language, "2026-10-19T08:00:00.000Z");
      state = applyExpertCarePatch(state, {
        goal: "second_opinion", specialty, person,
        authorityConfirmedAt: person === "trusted_helper" ? "2026-10-19T08:05:00.000Z" : null,
        emergencyResult: "clear", diagnosisOrRecommendation: "Review the current recommendation",
        currentTreatment: "Current plan documented for specialist review", concerns: "Understand options and tradeoffs",
        location: "Madrid, Spain", languages: [language], stage: "research",
      });
      state = attachExpertCareEvidence(state, { items: [], retrievedAt: "2026-10-19T09:00:00.000Z", educationalOnly: true, unavailableSources: [] });
      state = attachExpertCareSpecialists(state, { candidates: [candidate(specialty)], contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
      expect(state.specialists?.result.candidates[0].verificationStatus).toBe("unverified");
      state = acknowledgeExpertCareResearchBoundary(state);
      state = updateExpertCareVerification(state, `${specialty}-candidate`, "verified", ["All seven operational checks passed"]);
      state = attachExpertCareContactPreparation(state, {
        pendingActionId: `task-${specialty}-${language}-${person}`, candidateId: `${specialty}-candidate`,
        recipient: "clinic@example.test", documentIds: [],
        healthFields: ["diagnosis_or_recommendation", "current_treatment", "concerns", "location", "languages"],
        channel: "email", message: "Please prepare this consultation request for final member confirmation.",
        confirmedAt: "2026-10-19T10:00:00.000Z",
      });
      expect(state.context).toMatchObject({ specialty, person, languages: [language], emergencyResult: "clear" });
      expect(state.consent).toMatchObject({ research: true, sharing: true });
      expect(state.coordinationStatus).toBe("awaiting_confirmation");
      expect(state.specialists?.result.candidates[0].verificationStatus).toBe("verified");
      expect(state.contactPreparation?.pendingActionId).toContain(`task-${specialty}-${language}-${person}`);
    });
  }
});
