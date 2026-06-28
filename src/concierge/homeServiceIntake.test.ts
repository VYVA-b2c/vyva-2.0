import { describe, expect, it } from "vitest";
import {
  buildHomeServiceIntake,
  homeServiceQuestionsFor,
  homeServiceIntakeFromPreferences,
  normalizeHomeServiceType,
} from "../../shared/serviceIntake";

describe("home service intake", () => {
  it("normalizes plumber orders into a research brief with safety flags", () => {
    const intake = buildHomeServiceIntake({
      origin: "app",
      serviceType: "plumber",
      urgency: "today",
      criteria: "trusted",
      answers: {
        problem_summary: "Water leaking under the sink",
        problem_type: "leak",
        active_flooding: "yes",
        affected_area: "kitchen",
      },
      language: "en",
    });

    expect(intake).toMatchObject({
      version: "home-service-intake-v1",
      origin: "app",
      service_type: "plumber",
      urgency: "today",
    });
    expect(intake.safety_flags).toContain("active_water_damage");
    expect(intake.research_brief).toContain("Plumber needed");
    expect(intake.research_brief).toContain("Leak");
  });

  it("preserves a voice origin and existing research brief from request preferences", () => {
    const intake = homeServiceIntakeFromPreferences({
      service_intake: {
        origin: "voice",
        service_type: "electrician",
        urgency: "now",
        criteria: ["fastest"],
        answers: { problem_summary: "Sparks from a socket", safety_risk: "hazard" },
        research_brief: "Electrician needed. Sparks from a socket.",
      },
    });

    expect(intake?.origin).toBe("voice");
    expect(intake?.service_type).toBe("electrician");
    expect(intake?.research_brief).toBe("Electrician needed. Sparks from a socket.");
    expect(intake?.safety_flags).toContain("electrical_hazard");
  });

  it("detects common service words", () => {
    expect(normalizeHomeServiceType("I need a fontanero")).toBe("plumber");
    expect(normalizeHomeServiceType("socket keeps sparking")).toBe("electrician");
  });

  it("asks other services to identify the service before urgency", () => {
    const questions = homeServiceQuestionsFor("other");

    expect(questions[0]).toMatchObject({
      key: "service_needed",
      kind: "text",
      en: "What service do you need?",
    });
    expect(questions[1]).toMatchObject({ key: "urgency" });
  });

  it("keeps electrician intake short and focused", () => {
    const keys = homeServiceQuestionsFor("electrician").map((question) => question.key);

    expect(keys).toEqual([
      "urgency",
      "problem_type",
      "scope",
      "safety_risk",
      "criteria",
    ]);
    expect(keys).not.toContain("problem_summary");
    expect(keys).not.toContain("breaker_status");
    expect(keys).not.toContain("access_notes");
  });

  it("asks about powered medical equipment only when the electrical issue can affect power", () => {
    expect(homeServiceQuestionsFor("electrician", {
      urgency: "today",
      problem_type: "socket_light",
      scope: "one_fixture",
    }).map((question) => question.key)).not.toContain("medical_device");

    expect(homeServiceQuestionsFor("electrician", {
      urgency: "today",
      problem_type: "power_outage",
      scope: "whole_home",
    }).map((question) => question.key)).toContain("medical_device");
  });

  it("uses the typed other-service name in the research brief", () => {
    const intake = buildHomeServiceIntake({
      origin: "app",
      serviceType: "other",
      urgency: "today",
      criteria: "trusted",
      answers: {
        service_needed: "Pest control",
        problem_summary: "Wasps are near the front door",
      },
      language: "en",
    });

    expect(intake.research_brief).toContain("Pest control needed");
    expect(intake.research_brief).not.toContain("Other service needed");
  });
});
