import { readdirSync, readFileSync, statSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { getLanguage, setAccountLanguage, setLanguage, syncProfileLanguage, translate, LANGUAGE_STORAGE_KEY } from "./index";

const LANGUAGE_SOURCE_STORAGE_KEY = "vyva_lang_source";
const SUPPORTED_TEST_LANGUAGES = ["en", "es", "fr", "de", "it", "pt"] as const;

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = `${dir}/${entry}`;
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

function flattenLocaleKeys(value: unknown, prefix = "", output: string[] = []): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;

  for (const [key, child] of Object.entries(value)) {
    const childKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenLocaleKeys(child, childKey, output);
    } else {
      output.push(childKey);
    }
  }

  return output;
}

function localeKeys(language: (typeof SUPPORTED_TEST_LANGUAGES)[number]) {
  return new Set(flattenLocaleKeys(JSON.parse(readFileSync(`src/i18n/locales/${language}.json`, "utf8"))));
}

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

  it("lets profile hydration replace a browser-detected default", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    localStorage.setItem(LANGUAGE_SOURCE_STORAGE_KEY, "browser");

    syncProfileLanguage("de");

    expect(getLanguage()).toBe("de");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("de");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("account");
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

  it("keeps bottom navigation labels localized for supported account languages", () => {
    const expected = {
      en: "My Reports",
      es: "Mis informes",
      fr: "Mes rapports",
      de: "Meine Berichte",
      it: "I miei report",
      pt: "Os meus relatórios",
    } as const;

    for (const [language, reportsLabel] of Object.entries(expected)) {
      expect(translate(language as keyof typeof expected, "nav.reports")).toBe(reportsLabel);
    }
  });

  it("keeps settings home rows localized for supported account languages", () => {
    const keys = [
      "settings.home.rows.myAccount",
      "settings.home.rows.notifications",
      "settings.home.rows.scheduledSupport",
      "settings.home.rows.healthProfile",
      "settings.home.rows.privacyConsent",
    ];
    const expected = {
      en: ["My account", "Notifications & contact", "Scheduled support", "General Profile", "Privacy & consent"],
      es: ["Mi cuenta", "Notificaciones y contacto", "Mi apoyo programado", "Perfil general", "Privacidad y consentimiento"],
      fr: ["Mon compte", "Notifications et contact", "Mon soutien programmé", "Profil général", "Confidentialité et consentement"],
      de: ["Mein Konto", "Benachrichtigungen & Kontakt", "Geplante Unterstützung", "Allgemeines Profil", "Datenschutz & Einwilligung"],
      it: ["Il mio account", "Notifiche e contatti", "Supporto programmato", "Profilo generale", "Privacy e consenso"],
      pt: ["Minha conta", "Notificações e contato", "Apoio programado", "Perfil geral", "Privacidade e consentimento"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect(keys.map((key) => translate(language as keyof typeof expected, key))).toEqual(labels);
    }
  });

  it("keeps notification support mode labels localized for supported account languages", () => {
    const expected = {
      en: ["Support mode", "AI-powered", "Human-supported"],
      es: ["Modo de apoyo", "Con IA", "Con apoyo humano"],
      fr: ["Mode de soutien", "Avec IA", "Avec soutien humain"],
      de: ["Betreuungsmodus", "KI-gestützt", "Menschliche Unterstützung"],
      it: ["Modalità di supporto", "Con IA", "Con supporto umano"],
      pt: ["Modo de apoio", "Com IA", "Com apoio humano"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "settings.notifications.supportMode"),
        translate(language as keyof typeof expected, "settings.notifications.supportModeAi"),
        translate(language as keyof typeof expected, "settings.notifications.supportModeHuman"),
      ]).toEqual(labels);
    }
  });

  it("keeps vitals and symptom-check health flows localized for supported account languages", () => {
    const namespaces = [
      "statusVitals",
      "health.symptomCheck.scan",
      "health.symptomCheck.report",
    ];
    const englishKeys = localeKeys("en");

    for (const language of SUPPORTED_TEST_LANGUAGES.filter((code) => code !== "en")) {
      const translatedKeys = localeKeys(language);
      const missingKeys = [...englishKeys].filter((key) => (
        namespaces.some((namespace) => key.startsWith(`${namespace}.`)) && !translatedKeys.has(key)
      ));

      expect(missingKeys, `${language} is missing health translation keys`).toEqual([]);
    }
  });

  it("keeps settings pages on the shared app language store", () => {
    const settingsSource = collectFiles("src/pages/settings")
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(settingsSource).not.toContain("react-i18next");
    expect(settingsSource).not.toContain("useTranslation(");
  });
});
