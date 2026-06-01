import { readdirSync, readFileSync, statSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getLanguage,
  getLanguageSnapshot,
  setAccountLanguage,
  setBootstrapLanguage,
  setLanguage,
  syncProfileLanguage,
  translate,
  LANGUAGE_STORAGE_KEY,
} from "./index";

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
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("profile");
  });

  it("lets a later account login establish that account language", () => {
    setLanguage("de");

    setAccountLanguage("pt");

    expect(getLanguage()).toBe("pt");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("pt");
    expect(localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)).toBe("account");
  });

  it("lets a different active profile become the master language", () => {
    syncProfileLanguage("es", "profile-a");
    setLanguage("fr");

    syncProfileLanguage("de", "profile-b");

    expect(getLanguage()).toBe("de");
    expect(getLanguageSnapshot()).toMatchObject({
      language: "de",
      source: "profile",
      profileId: "profile-b",
    });
  });

  it("keeps a current-session selector choice when the first active profile arrives", () => {
    setLanguage("it");

    syncProfileLanguage("en", "profile-a");

    expect(getLanguage()).toBe("it");
    expect(getLanguageSnapshot()).toMatchObject({
      language: "it",
      source: "user",
      profileId: "profile-a",
    });
  });

  it("does not let invite language override an account or profile language", () => {
    setAccountLanguage("en");
    setBootstrapLanguage("pt");

    expect(getLanguage()).toBe("en");
    expect(getLanguageSnapshot().source).toBe("account");
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
      en: ["Report not saved", "Initial Assessment", "Monitor at home, with doctor access ready", "Share with doctor", "No doctor contact in profile"],
      es: ["Informe no guardado", "Evaluación inicial", "Vigila en casa, con medico disponible", "Compartir con medico", "Sin contacto medico en perfil"],
      fr: ["Rapport non enregistre", "Évaluation initiale", "Surveillez a domicile, avec un medecin pret a etre contacte", "Partager avec le medecin", "Aucun contact medecin dans le profil"],
      de: ["Bericht nicht gespeichert", "Erste Einschätzung", "Zu Hause beobachten, Arztkontakt bereithalten", "Mit Arzt teilen", "Kein Arztkontakt im Profil"],
      it: ["Report non salvato", "Valutazione iniziale", "Monitora a casa, con accesso al medico pronto", "Condividi col medico", "Nessun contatto medico nel profilo"],
      pt: ["Relatorio nao guardado", "Avaliação inicial", "Monitorize em casa, com acesso ao medico pronto", "Partilhar com medico", "Sem contacto medico no perfil"],
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

  it("keeps symptom doctor contact action localized for supported account languages", () => {
    const expected = {
      en: "Add doctor contact",
      es: "Anadir contacto medico",
      fr: "Ajouter le contact medecin",
      de: "Arztkontakt hinzufuegen",
      it: "Aggiungi contatto medico",
      pt: "Adicionar contacto medico",
    } as const;

    for (const [language, label] of Object.entries(expected)) {
      expect(translate(language as keyof typeof expected, "health.symptomCheck.report.addDoctorContact")).toBe(label);
    }
  });

  it("keeps symptom confidence tracker localized for supported account languages", () => {
    const expected = {
      en: ["Assessment confidence", "Building confidence", "VYVA is checking your answers", "Listen", "Check", "Next step"],
      es: ["Confianza de la evaluacion", "Ganando confianza", "VYVA revisa tus respuestas", "Escuchar", "Revisar", "Siguiente paso"],
      fr: ["Confiance de l'evaluation", "Confiance en cours", "VYVA verifie vos reponses", "Ecouter", "Verifier", "Prochaine etape"],
      de: ["Einschaetzungs-Sicherheit", "Sicherheit steigt", "VYVA prueft Ihre Antworten", "Zuhoeren", "Pruefen", "Naechster Schritt"],
      it: ["Fiducia nella valutazione", "Fiducia in crescita", "VYVA controlla le tue risposte", "Ascolto", "Controllo", "Prossimo passo"],
      pt: ["Confianca da avaliacao", "A ganhar confianca", "A VYVA esta a verificar as suas respostas", "Ouvir", "Verificar", "Proximo passo"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.label"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.building"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.checking"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.listen"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.check"),
        translate(language as keyof typeof expected, "health.symptomCheck.tracker.nextStep"),
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
    const legacySettingsSource = readFileSync("src/pages/SettingsScreen.tsx", "utf8");

    expect(settingsSource).not.toContain("react-i18next");
    expect(settingsSource).not.toContain("useTranslation(");
    expect(legacySettingsSource).not.toContain("react-i18next");
    expect(legacySettingsSource).not.toContain("useTranslation(");
    expect(legacySettingsSource).not.toContain("i18n.changeLanguage");
    expect(legacySettingsSource).not.toContain("LANGUAGE_STORAGE_KEY");
  });

  it("keeps live health and social screens on the current app language", () => {
    const files = [
      "src/pages/HealthScreen.tsx",
      "src/pages/SignosScreen.tsx",
      "src/pages/CheckHowIFeelScreen.tsx",
      "src/pages/CheckinHistoryScreen.tsx",
      "src/social/SocialHub.tsx",
      "src/social/RoomScreen.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} should not use stale profile language for live UI`).not.toMatch(/profile\??\.language/);
    }
  });
});
