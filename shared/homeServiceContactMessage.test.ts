import { describe, expect, it } from "vitest";
import { homeServiceContactSummaryLines, providerContactLanguage } from "./homeServiceContactMessage";

describe("home service provider contact summary", () => {
  it("includes operational wizard answers in the contact draft", () => {
    expect(homeServiceContactSummaryLines({
      service_label: "Pest control",
      urgency: "this_week",
      requested_time: "Thursday afternoon",
      criteria: ["fastest", "lowest_cost"],
    })).toEqual([
      "Service: Pest control",
      "Urgency: this week",
      "Preferred timing: Thursday afternoon",
      "Priorities: fastest available help, lower cost",
    ]);
  });

  it("localizes wizard details for provider contact", () => {
    expect(homeServiceContactSummaryLines({
      service_label: "Fontanería",
      urgency: "esta_semana",
      requested_time: "jueves por la tarde",
      criteria: ["fastest", "lowest_cost"],
    }, "es")).toEqual([
      "Servicio: Fontanería",
      "Urgencia: esta semana",
      "Horario preferido: jueves por la tarde",
      "Prioridades: la ayuda más rápida, menor coste",
    ]);
  });

  it("prefers an explicit provider language and otherwise uses the request language", () => {
    expect(providerContactLanguage({ contact_language: "fr-FR" }, "es")).toBe("fr");
    expect(providerContactLanguage({}, "pt-PT")).toBe("pt");
    expect(providerContactLanguage({ contact_language: "unsupported" }, null)).toBe("en");
  });

  it("does not add address or access details to the automatic summary", () => {
    const lines = homeServiceContactSummaryLines({
      service_label: "Plumber",
      home_address: "Private address",
      home_access_or_safety_notes: "Door code 1234",
    });

    expect(lines).toEqual(["Service: Plumber"]);
    expect(lines.join(" ")).not.toContain("Private address");
    expect(lines.join(" ")).not.toContain("Door code");
  });
});
