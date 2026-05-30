import { readdirSync, readFileSync, statSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { getLanguage, setAccountLanguage, setLanguage, syncProfileLanguage, translate, LANGUAGE_STORAGE_KEY } from "./index";

const LANGUAGE_SOURCE_STORAGE_KEY = "vyva_lang_source";

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = `${dir}/${entry}`;
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
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
      en: ["Quick access", "Symptoms", "Medication", "Vitals", "Reports"],
      es: ["Acceso rápido", "Síntomas", "Medicación", "Constantes", "Informes"],
      fr: ["Accès rapide", "Symptômes", "Médicaments", "Constantes", "Rapports"],
      de: ["Schnellzugriff", "Symptome", "Medikamente", "Vitalwerte", "Berichte"],
      it: ["Accesso rapido", "Sintomi", "Farmaci", "Parametri", "Report"],
      pt: ["Acesso rápido", "Sintomas", "Medicação", "Sinais vitais", "Relatórios"],
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

  it("keeps symptom report status labels localized for supported account languages", () => {
    const expected = {
      en: ["Report not saved", "Why VYVA chose this", "Monitor at home, with doctor access ready", "Share with doctor", "No doctor contact in profile"],
      es: ["Informe no guardado", "Por que VYVA eligio esto", "Vigila en casa, con medico disponible", "Compartir con medico", "Sin contacto medico en perfil"],
      fr: ["Rapport non enregistre", "Pourquoi VYVA a choisi cela", "Surveillez a domicile, avec un medecin pret a etre contacte", "Partager avec le medecin", "Aucun contact medecin dans le profil"],
      de: ["Bericht nicht gespeichert", "Warum VYVA das gewahlt hat", "Zu Hause beobachten, Arztkontakt bereithalten", "Mit Arzt teilen", "Kein Arztkontakt im Profil"],
      it: ["Report non salvato", "Perche VYVA ha scelto questo", "Monitora a casa, con accesso al medico pronto", "Condividi col medico", "Nessun contatto medico nel profilo"],
      pt: ["Relatorio nao guardado", "Porque a VYVA escolheu isto", "Monitorize em casa, com acesso ao medico pronto", "Partilhar com medico", "Sem contacto medico no perfil"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.report.saveFailed"),
        translate(language as keyof typeof expected, "health.symptomCheck.report.whyThisStep"),
        translate(language as keyof typeof expected, "health.symptomCheck.report.nextStepMonitorReady"),
        translate(language as keyof typeof expected, "health.symptomCheck.report.shareWithDoctor"),
        translate(language as keyof typeof expected, "health.symptomCheck.report.noDoctorToShare"),
      ]).toEqual(labels);
    }
  });

  it("keeps daily check-in home card copy localized for supported account languages", () => {
    const expected = {
      en: ["Daily are-you-okay check", "Checked in today", "Let VYVA know how today feels", "You checked in today. VYVA has a fresh wellbeing signal.", "View history"],
      es: ["Control diario de bienestar", "Hecho hoy", "Cu\u00e9ntale a VYVA c\u00f3mo te sientes hoy", "Has completado el control de hoy. VYVA tiene una nueva se\u00f1al de bienestar.", "Ver historial"],
      fr: ["Controle quotidien de bien-etre", "Controle fait aujourd'hui", "Dites a VYVA comment vous vous sentez aujourd'hui", "Vous avez fait le controle aujourd'hui. VYVA a un nouveau signal de bien-etre.", "Voir l'historique"],
      de: ["Taglicher Wohlbefinden-Check", "Heute erledigt", "Sag VYVA, wie du dich heute fuhlst", "Du hast heute eingecheckt. VYVA hat ein neues Wohlbefinden-Signal.", "Verlauf ansehen"],
      it: ["Controllo quotidiano del benessere", "Fatto oggi", "Di a VYVA come ti senti oggi", "Hai completato il controllo di oggi. VYVA ha un nuovo segnale di benessere.", "Vedi cronologia"],
      pt: ["Check-in diario de bem-estar", "Feito hoje", "Diga a VYVA como se sente hoje", "Concluiu o check-in de hoje. A VYVA tem um novo sinal de bem-estar.", "Ver historico"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.dailyCheckin.kicker"),
        translate(language as keyof typeof expected, "health.dailyCheckin.completed"),
        translate(language as keyof typeof expected, "health.dailyCheckin.title"),
        translate(language as keyof typeof expected, "health.dailyCheckin.messages.completed"),
        translate(language as keyof typeof expected, "health.dailyCheckin.actions.viewHistory"),
      ]).toEqual(labels);
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

  it("keeps settings pages on the shared app language store", () => {
    const settingsSource = collectFiles("src/pages/settings")
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(settingsSource).not.toContain("react-i18next");
    expect(settingsSource).not.toContain("useTranslation(");
  });
});
