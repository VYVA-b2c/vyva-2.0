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

  it("keeps SOS direct call actions localized for supported account languages", () => {
    const expected = {
      en: ["Need urgent help?", "Call {{number}} now", "Call {{name}}"],
      es: ["Necesitas ayuda urgente?", "Llamar a {{number}} ahora", "Llamar a {{name}}"],
      fr: ["Besoin d'aide urgente ?", "Appeler {{number}} maintenant", "Appeler {{name}}"],
      de: ["Brauchen Sie dringend Hilfe?", "{{number}} jetzt anrufen", "{{name}} anrufen"],
      it: ["Hai bisogno di aiuto urgente?", "Chiama {{number}} ora", "Chiama {{name}}"],
      pt: ["Precisa de ajuda urgente?", "Ligar para {{number}} agora", "Ligar a {{name}}"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "sos.title"),
        translate(language as keyof typeof expected, "sos.callEmergencyNumber"),
        translate(language as keyof typeof expected, "sos.callContact"),
      ]).toEqual(labels);
    }
  });

  it("keeps medication service actions localized for supported account languages", () => {
    const expected = {
      en: ["Prepare refill", "Check interactions", "Doctor help"],
      es: ["Preparar reposicion", "Revisar interacciones", "Ayuda medica"],
      fr: ["Preparer le renouvellement", "Verifier interactions", "Aide medecin"],
      de: ["Nachfullung vorbereiten", "Wechselwirkungen prufen", "Arzthilfe"],
      it: ["Prepara rifornimento", "Controlla interazioni", "Aiuto medico"],
      pt: ["Preparar reposicao", "Verificar interacoes", "Ajuda medica"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "meds.refillSupport"),
        translate(language as keyof typeof expected, "meds.interactionSupport"),
        translate(language as keyof typeof expected, "meds.doctorReview"),
      ]).toEqual(labels);
    }
  });

  it("keeps adherence report service actions localized for supported account languages", () => {
    const expected = {
      en: ["Medication help in one tap", "Prepare refill", "Medication appointment"],
      es: ["Ayuda de medicacion en un toque", "Preparar reposicion", "Cita de medicacion"],
      fr: ["Aide medicaments en un geste", "Preparer le renouvellement", "Rendez-vous medicaments"],
      de: ["Medikamentenhilfe mit einem Tipp", "Nachfullung vorbereiten", "Medikamententermin"],
      it: ["Aiuto farmaci in un tocco", "Prepara rifornimento", "Appuntamento farmaci"],
      pt: ["Ajuda com medicacao num toque", "Preparar reposicao", "Consulta de medicacao"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "meds.adherenceService.title"),
        translate(language as keyof typeof expected, "meds.adherenceService.refill"),
        translate(language as keyof typeof expected, "meds.adherenceService.appointment"),
      ]).toEqual(labels);
    }
  });

  it("keeps reports overview service actions localized for supported account languages", () => {
    const expected = {
      en: ["Fast service access", "Review vitals", "Prepare refill", "Book ride"],
      es: ["Acceso rapido a servicios", "Revisar constantes", "Preparar reposicion", "Reservar transporte"],
      fr: ["Acces rapide aux services", "Voir constantes", "Renouvellement", "Transport"],
      de: ["Schneller Servicezugang", "Vitalwerte ansehen", "Nachfullung", "Fahrt buchen"],
      it: ["Accesso rapido ai servizi", "Vedi parametri", "Rifornimento", "Prenota trasporto"],
      pt: ["Acesso rapido a servicos", "Ver sinais vitais", "Preparar reposicao", "Reservar transporte"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "informes.fastServiceAccess"),
        translate(language as keyof typeof expected, "informes.actions.reviewVitals"),
        translate(language as keyof typeof expected, "informes.actions.prepareRefill"),
        translate(language as keyof typeof expected, "informes.actions.bookRide"),
      ]).toEqual(labels);
    }
  });

  it("keeps safe-home service actions localized for supported account languages", () => {
    const expected = {
      en: ["Order safety aids", "Request quote"],
      es: ["Pedir ayudas de seguridad", "Pedir presupuesto"],
      fr: ["Commander aides securite", "Demander un devis"],
      de: ["Sicherheitshilfen bestellen", "Angebot anfragen"],
      it: ["Ordina aiuti sicurezza", "Richiedi preventivo"],
      pt: ["Encomendar ajudas de seguranca", "Pedir orcamento"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "safeHome.actions.orderAids"),
        translate(language as keyof typeof expected, "safeHome.actions.requestQuote"),
      ]).toEqual(labels);
    }
  });

  it("keeps visual scan service actions localized for supported account languages", () => {
    const expected = {
      en: ["Doctor help", "Appointment", "Book ride"],
      es: ["Ayuda medica", "Cita", "Reservar transporte"],
      fr: ["Aide medecin", "Rendez-vous", "Reserver transport"],
      de: ["Arzthilfe", "Termin", "Fahrt buchen"],
      it: ["Aiuto medico", "Appuntamento", "Prenota trasporto"],
      pt: ["Ajuda medica", "Consulta", "Reservar transporte"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.scanWound.actions.doctorHelp"),
        translate(language as keyof typeof expected, "health.scanWound.actions.appointment"),
        translate(language as keyof typeof expected, "health.scanWound.actions.ride"),
      ]).toEqual(labels);
    }
  });

  it("keeps doctor quick service actions localized for supported account languages", () => {
    const expected = {
      en: ["Fast service access", "Call {{name}}", "Book appointment", "Book transport"],
      es: ["Acceso rapido a servicios", "Llamar a {{name}}", "Pedir cita", "Reservar transporte"],
      fr: ["Acces rapide aux services", "Appeler {{name}}", "Prendre rendez-vous", "Reserver transport"],
      de: ["Schneller Servicezugang", "{{name}} anrufen", "Termin buchen", "Fahrt buchen"],
      it: ["Accesso rapido ai servizi", "Chiama {{name}}", "Prenota visita", "Prenota trasporto"],
      pt: ["Acesso rapido a servicos", "Ligar a {{name}}", "Marcar consulta", "Reservar transporte"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.doctorChoice.quickActions.title"),
        translate(language as keyof typeof expected, "health.doctorChoice.quickActions.callGp"),
        translate(language as keyof typeof expected, "health.doctorChoice.quickActions.bookAppointment"),
        translate(language as keyof typeof expected, "health.doctorChoice.quickActions.bookRide"),
      ]).toEqual(labels);
    }
  });

  it("keeps health-home doctor access actions localized for supported account languages", () => {
    const expected = {
      en: ["Doctor access", "Call GP", "Book appointment", "Book transport", "Add GP contact"],
      es: ["Acceso medico", "Llamar al medico", "Pedir cita", "Reservar transporte", "Anadir contacto medico"],
      fr: ["Acces medecin", "Appeler le medecin", "Prendre rendez-vous", "Reserver transport", "Ajouter contact medecin"],
      de: ["Arztzugang", "Arzt anrufen", "Termin buchen", "Fahrt buchen", "Arztkontakt hinzufuegen"],
      it: ["Accesso medico", "Chiama medico", "Prenota visita", "Prenota trasporto", "Aggiungi medico"],
      pt: ["Acesso medico", "Ligar ao medico", "Marcar consulta", "Reservar transporte", "Adicionar medico"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.seeDoctor.actions.title"),
        translate(language as keyof typeof expected, "health.seeDoctor.actions.callGp"),
        translate(language as keyof typeof expected, "health.seeDoctor.actions.bookAppointment"),
        translate(language as keyof typeof expected, "health.seeDoctor.actions.bookTransport"),
        translate(language as keyof typeof expected, "health.seeDoctor.actions.addGp"),
      ]).toEqual(labels);
    }
  });

  it("keeps specialist service actions localized for supported account languages", () => {
    const expected = {
      en: ["Call", "Appointment", "Book ride", "Map", "Share", "Search specialists"],
      es: ["Llamar", "Cita", "Reservar transporte", "Mapa", "Compartir", "Buscar especialistas"],
      fr: ["Appeler", "Rendez-vous", "Reserver transport", "Carte", "Partager", "Rechercher specialistes"],
      de: ["Anrufen", "Termin", "Fahrt buchen", "Karte", "Teilen", "Fachaerzte suchen"],
      it: ["Chiama", "Appuntamento", "Prenota trasporto", "Mappa", "Condividi", "Cerca specialisti"],
      pt: ["Ligar", "Consulta", "Reservar transporte", "Mapa", "Partilhar", "Pesquisar especialistas"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.findSpecialist.call"),
        translate(language as keyof typeof expected, "health.findSpecialist.bookAppointment"),
        translate(language as keyof typeof expected, "health.findSpecialist.bookRide"),
        translate(language as keyof typeof expected, "health.findSpecialist.map"),
        translate(language as keyof typeof expected, "health.findSpecialist.share"),
        translate(language as keyof typeof expected, "health.findSpecialist.searchButton"),
      ]).toEqual(labels);
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
      en: ["Confidence level", "Confidence improving", "VYVA is checking symptoms and safety signs", "Symptoms", "Safety check", "Next step"],
      es: ["Nivel de confianza", "La confianza mejora", "VYVA revisa sintomas y senales de seguridad", "Sintomas", "Control de seguridad", "Siguiente paso"],
      fr: ["Niveau de confiance", "La confiance augmente", "VYVA verifie les symptomes et les signes de securite", "Symptomes", "Controle securite", "Prochaine etape"],
      de: ["Vertrauensniveau", "Vertrauen steigt", "VYVA prueft Symptome und Sicherheitssignale", "Symptome", "Sicherheitscheck", "Naechster Schritt"],
      it: ["Livello di fiducia", "Fiducia in aumento", "VYVA controlla sintomi e segnali di sicurezza", "Sintomi", "Controllo sicurezza", "Prossimo passo"],
      pt: ["Nivel de confianca", "A confianca aumenta", "A VYVA verifica sintomas e sinais de seguranca", "Sintomas", "Verificacao seguranca", "Proximo passo"],
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

  it("keeps symptom chat confidence cues localized for supported account languages", () => {
    const expected = {
      en: ["One question at a time", "Current question", "{{count}} answers saved", "Choose the closest answer, or type in your own words."],
      es: ["Una pregunta cada vez", "Pregunta actual", "{{count}} respuestas guardadas", "Elige la respuesta mas cercana o escribe con tus palabras."],
      fr: ["Une question a la fois", "Question actuelle", "{{count}} reponses enregistrees", "Choisissez la reponse la plus proche ou ecrivez avec vos mots."],
      de: ["Eine Frage nach der anderen", "Aktuelle Frage", "{{count}} Antworten gespeichert", "Waehle die passendste Antwort oder schreibe mit eigenen Worten."],
      it: ["Una domanda alla volta", "Domanda attuale", "{{count}} risposte salvate", "Scegli la risposta piu vicina o scrivi con parole tue."],
      pt: ["Uma pergunta de cada vez", "Pergunta atual", "{{count}} respostas guardadas", "Escolha a resposta mais proxima ou escreva pelas suas palavras."],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "health.symptomCheck.chat.oneQuestion"),
        translate(language as keyof typeof expected, "health.symptomCheck.chat.currentQuestion"),
        translate(language as keyof typeof expected, "health.symptomCheck.chat.answersSaved"),
        translate(language as keyof typeof expected, "health.symptomCheck.chat.startAnswering"),
      ]).toEqual(labels);
    }
  });

  it("keeps scam guard action buttons localized for supported account languages", () => {
    const expected = {
      en: ["Quick safe actions", "Call {{name}}", "Get safe help", "Call guidance"],
      es: ["Acciones seguras", "Llamar a {{name}}", "Ayuda segura", "Guia por llamada"],
      fr: ["Actions sures", "Appeler {{name}}", "Aide sure", "Aide par appel"],
      de: ["Sichere Schnellaktionen", "{{name}} anrufen", "Sichere Hilfe", "Anrufhilfe"],
      it: ["Azioni sicure", "Chiama {{name}}", "Aiuto sicuro", "Guida in chiamata"],
      pt: ["Acoes seguras", "Ligar a {{name}}", "Ajuda segura", "Orientacao por chamada"],
    } as const;

    for (const [language, labels] of Object.entries(expected)) {
      expect([
        translate(language as keyof typeof expected, "scamGuard.actions.title"),
        translate(language as keyof typeof expected, "scamGuard.actions.callTrusted"),
        translate(language as keyof typeof expected, "scamGuard.actions.safeHelp"),
        translate(language as keyof typeof expected, "scamGuard.actions.callGuidance"),
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
    const legacySettingsSource = readFileSync("src/pages/SettingsScreen.tsx", "utf8");

    expect(settingsSource).not.toContain("react-i18next");
    expect(settingsSource).not.toContain("useTranslation(");
    expect(legacySettingsSource).not.toContain("react-i18next");
    expect(legacySettingsSource).not.toContain("useTranslation(");
    expect(legacySettingsSource).not.toContain("i18n.changeLanguage");
    expect(legacySettingsSource).not.toContain("LANGUAGE_STORAGE_KEY");
  });
});
