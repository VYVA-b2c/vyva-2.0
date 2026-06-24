import { describe, expect, it } from "vitest";
import {
  buildHomeServiceIntake,
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
});
