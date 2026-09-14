import { describe, expect, it } from "vitest";
import { resolveTriageHandoffAuthorization } from "./triageHandoffConsent.js";

describe("triage handoff consent", () => {
  it("keeps saved reports private by default", () => {
    expect(resolveTriageHandoffAuthorization({})).toEqual({
      shareWithSavedContacts: false,
      staffReviewRequested: false,
    });
  });

  it("does not infer sharing or staff review from urgency", () => {
    expect(resolveTriageHandoffAuthorization({
      shareWithSavedContacts: false,
      requestStaffReview: false,
    })).toEqual({
      shareWithSavedContacts: false,
      staffReviewRequested: false,
    });
  });

  it("allows only explicit authorization", () => {
    expect(resolveTriageHandoffAuthorization({
      shareWithSavedContacts: true,
      requestStaffReview: true,
    })).toEqual({
      shareWithSavedContacts: true,
      staffReviewRequested: true,
    });
  });
});
