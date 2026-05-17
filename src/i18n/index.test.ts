import { beforeEach, describe, expect, it } from "vitest";
import { getLanguage, setAccountLanguage, setLanguage, syncProfileLanguage, translate, LANGUAGE_STORAGE_KEY } from "./index";

const LANGUAGE_SOURCE_STORAGE_KEY = "vyva_lang_source";

describe("language persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    setAccountLanguage("es");
  });

  it("uses the account language as the persistent default", () => {
    setAccountLanguage("en");

    expect(getLanguage()).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("account");
  });

  it("does not let profile refreshes overwrite a language chosen from a selector", () => {
    setAccountLanguage("es");
    setLanguage("fr");

    syncProfileLanguage("es");

    expect(getLanguage()).toBe("fr");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("fr");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("user");
  });

  it("lets a later account login establish that account language", () => {
    setLanguage("de");

    setAccountLanguage("pt");

    expect(getLanguage()).toBe("pt");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("pt");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("account");
  });

  it("keeps health quick cards localized for supported account languages", () => {
    const expected = {
      en: ["Quick access", "Symptoms", "Medication", "Status", "Reports"],
      es: ["Acceso rápido", "Síntomas", "Medicación", "Estado", "Informes"],
      fr: ["Accès rapide", "Symptômes", "Médicaments", "État", "Rapports"],
      de: ["Schnellzugriff", "Symptome", "Medikamente", "Status", "Berichte"],
      it: ["Accesso rapido", "Sintomi", "Farmaci", "Stato", "Report"],
      pt: ["Acesso rápido", "Sintomas", "Medicação", "Estado", "Relatórios"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.quickAccess"),
        translate(language as keyof typeof expected, "health.quickTiles.symptoms.label"),
        translate(language as keyof typeof expected, "health.quickTiles.medication.label"),
        translate(language as keyof typeof expected, "health.quickTiles.status.label"),
        translate(language as keyof typeof expected, "health.quickTiles.reports.label"),
      ]).toEqual(labels);
    }
  });
});
