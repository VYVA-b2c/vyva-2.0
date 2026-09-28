import { describe, expect, it } from "vitest";
import { HOME_SERVICE_TEXT, homeServiceText } from "./homeServiceText";
import { HOME_SERVICE_TYPES, homeServiceQuestionsFor, homeServiceTypeLabel } from "./serviceIntake";

describe("home-service localization coverage", () => {
  it.each(["es", "fr", "de", "it", "pt"])("covers every intake question, option and placeholder in %s", language => {
    for (const service of HOME_SERVICE_TYPES) {
      expect(HOME_SERVICE_TEXT).toHaveProperty(service.en);
      expect(homeServiceTypeLabel(service.key, language)).toBe(homeServiceText(language, service.en));
      for (const question of homeServiceQuestionsFor(service.key, { problem_type: "power_outage" })) {
        expect(Object.hasOwn(HOME_SERVICE_TEXT, question.en)).toBe(true);
        for (const option of question.options ?? []) expect(Object.hasOwn(HOME_SERVICE_TEXT, option.en)).toBe(true);
        if (question.placeholderEn) expect(Object.hasOwn(HOME_SERVICE_TEXT, question.placeholderEn)).toBe(true);
      }
    }
  });
  it("leaves custom addresses and business names unchanged", () => {
    expect(homeServiceText("fr", "11380 Tarifa, Spain")).toBe("11380 Tarifa, Spain");
    expect(homeServiceText("fr", "Instalaciones Hilario S C")).toBe("Instalaciones Hilario S C");
  });
});
