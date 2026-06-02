import { describe, expect, it } from "vitest";
import { getSymptomRecommendationActionKinds } from "./symptomReportActions";

describe("symptom report recommendation actions", () => {
  it("maps emergency recommendations to an emergency call action when a number is known", () => {
    expect(getSymptomRecommendationActionKinds("Call emergency services now", {
      hasEmergencyContact: true,
    })).toEqual(["call_emergency"]);
  });

  it("does not show a fake emergency call action when no emergency number is known", () => {
    expect(getSymptomRecommendationActionKinds("Call emergency services now")).toEqual([]);
  });

  it("maps doctor recommendations to available GP contact actions and doctor help", () => {
    expect(getSymptomRecommendationActionKinds("Contact your doctor immediately", {
      hasGpPhone: true,
      hasGpEmail: true,
    })).toEqual(["call_gp", "email_gp", "doctor_help"]);
  });

  it("keeps doctor help when GP phone and email are missing", () => {
    expect(getSymptomRecommendationActionKinds("Talk to your GP today")).toEqual(["doctor_help"]);
  });

  it("maps urgent care recommendations to ride and appointment actions", () => {
    expect(getSymptomRecommendationActionKinds("Consider visiting an urgent care center")).toEqual([
      "book_ride",
      "schedule_appointment",
    ]);
  });

  it("maps hydration recommendations to an online order action", () => {
    expect(getSymptomRecommendationActionKinds("Stay hydrated and drink fluids")).toEqual(["online_order"]);
  });

  it("maps care support recommendations to a quote action", () => {
    expect(getSymptomRecommendationActionKinds("Have someone stay with you tonight")).toEqual(["request_quote"]);
  });

  it("returns no action buttons for unrelated recommendations", () => {
    expect(getSymptomRecommendationActionKinds("Rest and monitor symptoms")).toEqual([]);
  });
});
