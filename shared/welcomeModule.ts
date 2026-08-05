export type WelcomeAudience = "elder" | "caregiver";
export type WelcomeMomentType = "first_login_welcome" | "daily_profile_nudge";
export type WelcomeLanguage = "es" | "en" | "de" | "fr" | "it" | "pt";
export type WelcomePeriod = "morning" | "afternoon" | "evening" | "night";

export type WelcomeProfileActionId =
  | "emergency_contact"
  | "medications"
  | "gp_details"
  | "address"
  | "care_team"
  | "preferences"
  | "notifications"
  | "cognitive"
  | "health_conditions"
  | "allergies"
  | "providers"
  | "devices"
  | "diet"
  | "hobbies";

export type WelcomeCopy = {
  headline: string;
  subtitle: string;
  ctaLabel?: string;
};

export type WelcomeTemplateDefinition = {
  id: string;
  audience: WelcomeAudience;
  momentType: WelcomeMomentType;
  profileAction?: WelcomeProfileActionId;
  priority: number;
  cooldownHours: number;
  periods?: WelcomePeriod[];
  copy: Partial<Record<WelcomeLanguage, WelcomeCopy>>;
  actionRoute?: string;
  isEnabled?: boolean;
  adminNotes?: string | null;
  updatedAt?: string | null;
  source?: "built_in" | "managed";
};

export type WelcomeHomeSelection = {
  templateId: string;
  audience: WelcomeAudience;
  momentType: WelcomeMomentType;
  profileAction?: WelcomeProfileActionId;
  headline: string;
  subtitle: string;
  ctaLabel?: string;
  actionRoute?: string;
  priority: number;
  source: "built_in" | "managed";
};

export const WELCOME_LANGUAGES: WelcomeLanguage[] = ["es", "en", "de", "fr", "it", "pt"];
export const WELCOME_PERIODS: WelcomePeriod[] = ["morning", "afternoon", "evening", "night"];
export const WELCOME_AUDIENCES: WelcomeAudience[] = ["elder", "caregiver"];
export const WELCOME_MOMENT_TYPES: WelcomeMomentType[] = ["first_login_welcome", "daily_profile_nudge"];

export const WELCOME_PROFILE_ACTIONS: Array<{
  id: WelcomeProfileActionId;
  label: string;
  route: string;
  category: "safety" | "health" | "care" | "preferences" | "life";
  priority: number;
}> = [
  { id: "emergency_contact", label: "Emergency contact", route: "/onboarding/profile/emergency", category: "safety", priority: 98 },
  { id: "medications", label: "Medications", route: "/onboarding/profile/medications", category: "health", priority: 94 },
  { id: "gp_details", label: "GP details", route: "/onboarding/profile/gp", category: "health", priority: 90 },
  { id: "address", label: "Home address", route: "/onboarding/profile/address", category: "safety", priority: 86 },
  { id: "care_team", label: "Care team", route: "/onboarding/profile/care-team", category: "care", priority: 82 },
  { id: "preferences", label: "Preferences", route: "/onboarding/profile/basics", category: "preferences", priority: 78 },
  { id: "notifications", label: "Notifications", route: "/settings/notifications", category: "preferences", priority: 74 },
  { id: "cognitive", label: "Cognitive settings", route: "/onboarding/profile/cognitive", category: "health", priority: 70 },
  { id: "health_conditions", label: "Health conditions", route: "/onboarding/profile/health", category: "health", priority: 66 },
  { id: "allergies", label: "Allergies", route: "/onboarding/profile/allergies", category: "health", priority: 62 },
  { id: "providers", label: "Trusted providers", route: "/onboarding/profile/providers", category: "care", priority: 58 },
  { id: "devices", label: "Devices and sensors", route: "/onboarding/profile/devices", category: "health", priority: 54 },
  { id: "diet", label: "Dietary preferences", route: "/onboarding/profile/diet", category: "life", priority: 50 },
  { id: "hobbies", label: "Hobbies", route: "/onboarding/profile/hobbies", category: "life", priority: 46 },
];

export const WELCOME_PROFILE_ACTION_BY_ID = Object.fromEntries(
  WELCOME_PROFILE_ACTIONS.map((action) => [action.id, action]),
) as Record<WelcomeProfileActionId, typeof WELCOME_PROFILE_ACTIONS[number]>;

export function normalizeWelcomeLanguage(language?: string | null): WelcomeLanguage {
  const base = (language || "es").trim().toLowerCase().split("-")[0];
  return WELCOME_LANGUAGES.includes(base as WelcomeLanguage) ? base as WelcomeLanguage : "es";
}

export function normalizeWelcomeAudience(role?: string | null): WelcomeAudience {
  const value = (role || "").trim().toLowerCase();
  return value === "caregiver" || value === "family" || value === "doctor" ? "caregiver" : "elder";
}

export function getWelcomePeriod(date = new Date()): WelcomePeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  if (hour >= 17 && hour <= 20) return "evening";
  return "night";
}

function copy(headline: string, subtitle: string, ctaLabel?: string): WelcomeCopy {
  return { headline, subtitle, ...(ctaLabel ? { ctaLabel } : {}) };
}

function firstWelcomeTemplate(
  audience: WelcomeAudience,
  period: WelcomePeriod,
  copyByLanguage: Partial<Record<WelcomeLanguage, WelcomeCopy>>,
): WelcomeTemplateDefinition {
  return {
    id: `${audience}-first-${period}`,
    audience,
    momentType: "first_login_welcome",
    priority: 120,
    cooldownHours: 0,
    periods: [period],
    copy: copyByLanguage,
  };
}

function profileNudgeTemplate(
  audience: WelcomeAudience,
  profileAction: WelcomeProfileActionId,
  copyByLanguage: Partial<Record<WelcomeLanguage, WelcomeCopy>>,
): WelcomeTemplateDefinition {
  const action = WELCOME_PROFILE_ACTION_BY_ID[profileAction];
  return {
    id: `${audience}-nudge-${profileAction}`,
    audience,
    momentType: "daily_profile_nudge",
    profileAction,
    priority: action.priority,
    cooldownHours: 24,
    copy: copyByLanguage,
    actionRoute: action.route,
  };
}

const ELDER_PROFILE_NUDGE_COPY: Record<WelcomeProfileActionId, Record<WelcomeLanguage, WelcomeCopy>> = {
  emergency_contact: {
    en: copy("Make VYVA safer", "Add who VYVA should keep visible in urgent moments.", "Add contact"),
    es: copy("Haga VYVA mas seguro", "Anada a quien VYVA debe tener visible en momentos urgentes.", "Anadir contacto"),
    de: copy("VYVA sicherer machen", "Fuegen Sie hinzu, wen VYVA in dringenden Momenten sehen soll.", "Kontakt hinzufuegen"),
    fr: copy("Rendre VYVA plus sur", "Ajoutez la personne a garder visible en cas d'urgence.", "Ajouter"),
    it: copy("Rendi VYVA piu sicuro", "Aggiunga chi VYVA deve tenere visibile nei momenti urgenti.", "Aggiungi contatto"),
    pt: copy("Torne VYVA mais seguro", "Adicione quem a VYVA deve manter visivel em momentos urgentes.", "Adicionar contacto"),
  },
  medications: {
    en: copy("Add your medicines", "VYVA can help remember routines and spot safer next steps.", "Add medicines"),
    es: copy("Anada sus medicinas", "VYVA puede ayudar con rutinas y proximos pasos mas seguros.", "Anadir"),
    de: copy("Medikamente hinzufuegen", "VYVA kann Routinen merken und sicherere naechste Schritte erkennen.", "Hinzufuegen"),
    fr: copy("Ajouter vos medicaments", "VYVA peut aider avec les rappels et les routines.", "Ajouter"),
    it: copy("Aggiunga i medicinali", "VYVA puo aiutare con le routine e i prossimi passi piu sicuri.", "Aggiungi"),
    pt: copy("Adicione os medicamentos", "A VYVA pode ajudar nas rotinas e em passos seguintes mais seguros.", "Adicionar"),
  },
  gp_details: {
    en: copy("Add your doctor", "Doctor details help VYVA prepare better health conversations.", "Add doctor"),
    es: copy("Anada su medico", "Los datos del medico ayudan a preparar mejor las conversaciones.", "Anadir medico"),
    de: copy("Arzt hinzufuegen", "Arztdaten helfen VYVA, Gesundheitsgespraeche besser vorzubereiten.", "Arzt hinzufuegen"),
    fr: copy("Ajouter le medecin", "Ces details aident VYVA a mieux preparer les echanges.", "Ajouter"),
    it: copy("Aggiunga il medico", "I dati del medico aiutano VYVA a preparare meglio le conversazioni.", "Aggiungi medico"),
    pt: copy("Adicione o medico", "Os dados do medico ajudam a VYVA a preparar melhor as conversas.", "Adicionar medico"),
  },
  address: {
    en: copy("Add your address", "Local context helps VYVA support rides, services, and safety.", "Add address"),
    es: copy("Anada su direccion", "El contexto local ayuda con viajes, servicios y seguridad.", "Anadir direccion"),
    de: copy("Adresse hinzufuegen", "Lokaler Kontext hilft VYVA bei Fahrten, Services und Sicherheit.", "Adresse hinzufuegen"),
    fr: copy("Ajouter l'adresse", "Le contexte local aide pour les trajets, services et securite.", "Ajouter"),
    it: copy("Aggiunga l'indirizzo", "Il contesto locale aiuta VYVA con trasporti, servizi e sicurezza.", "Aggiungi indirizzo"),
    pt: copy("Adicione o endereco", "O contexto local ajuda a VYVA com viagens, servicos e seguranca.", "Adicionar endereco"),
  },
  care_team: {
    en: copy("Add your care team", "Keep family, carers, or clinicians easy to reach when needed.", "Add team"),
    es: copy("Anada su equipo", "Familia, cuidadores o clinicos quedan faciles de contactar.", "Anadir equipo"),
    de: copy("Betreuungsteam hinzufuegen", "Familie, Betreuung und Kliniker bleiben bei Bedarf leicht erreichbar.", "Team hinzufuegen"),
    fr: copy("Ajouter l'equipe", "Gardez les proches et soignants faciles a contacter.", "Ajouter"),
    it: copy("Aggiunga il team", "Famiglia, assistenti e clinici restano facili da raggiungere.", "Aggiungi team"),
    pt: copy("Adicione a equipa", "Familia, cuidadores e clinicos ficam faceis de contactar.", "Adicionar equipa"),
  },
  preferences: {
    en: copy("Set your preferences", "VYVA works better when it knows your language and routine.", "Set preferences"),
    es: copy("Ajuste preferencias", "VYVA funciona mejor con su idioma y rutina.", "Ajustar"),
    de: copy("Praeferenzen festlegen", "VYVA arbeitet besser, wenn Sprache und Routine bekannt sind.", "Festlegen"),
    fr: copy("Regler preferences", "VYVA fonctionne mieux avec votre langue et routine.", "Regler"),
    it: copy("Imposti le preferenze", "VYVA funziona meglio quando conosce lingua e routine.", "Imposta"),
    pt: copy("Defina preferencias", "A VYVA funciona melhor quando conhece idioma e rotina.", "Definir"),
  },
  notifications: {
    en: copy("Choose reminders", "Pick how and when VYVA should contact you.", "Choose"),
    es: copy("Elija recordatorios", "Decida como y cuando VYVA debe contactarle.", "Elegir"),
    de: copy("Erinnerungen waehlen", "Legen Sie fest, wie und wann VYVA Sie kontaktieren soll.", "Waehlen"),
    fr: copy("Choisir rappels", "Decidez comment et quand VYVA peut vous contacter.", "Choisir"),
    it: copy("Scelga i promemoria", "Decida come e quando VYVA deve contattarla.", "Scegli"),
    pt: copy("Escolha lembretes", "Decida como e quando a VYVA deve contactar.", "Escolher"),
  },
  cognitive: {
    en: copy("Set your pace", "Cognitive settings help VYVA adapt memory support to you.", "Set pace"),
    es: copy("Ajuste su ritmo", "VYVA adapta el apoyo de memoria a sus preferencias.", "Ajustar"),
    de: copy("Tempo festlegen", "Kognitive Einstellungen helfen VYVA, die Gedachtnisstuetze anzupassen.", "Festlegen"),
    fr: copy("Regler le rythme", "VYVA adapte le soutien memoire a vos preferences.", "Regler"),
    it: copy("Imposti il ritmo", "Le impostazioni cognitive aiutano VYVA ad adattare il supporto.", "Imposta"),
    pt: copy("Defina o ritmo", "As definicoes cognitivas ajudam a VYVA a adaptar o apoio.", "Definir"),
  },
  health_conditions: {
    en: copy("Add health context", "Known conditions help VYVA keep conversations safer.", "Add context"),
    es: copy("Anada contexto de salud", "Las condiciones conocidas ayudan a VYVA a conversar con mas seguridad.", "Anadir"),
    de: copy("Gesundheitskontext hinzufuegen", "Bekannte Erkrankungen helfen VYVA, Gespraeche sicherer zu halten.", "Hinzufuegen"),
    fr: copy("Ajouter contexte sante", "Les conditions connues aident VYVA a garder les echanges plus surs.", "Ajouter"),
    it: copy("Aggiunga contesto salute", "Le condizioni note aiutano VYVA a mantenere conversazioni piu sicure.", "Aggiungi"),
    pt: copy("Adicione contexto de saude", "Condicoes conhecidas ajudam a VYVA a manter conversas mais seguras.", "Adicionar"),
  },
  allergies: {
    en: copy("Add allergies", "Allergy details help VYVA avoid risky suggestions.", "Add allergies"),
    es: copy("Anada alergias", "Los datos de alergias ayudan a VYVA a evitar sugerencias de riesgo.", "Anadir alergias"),
    de: copy("Allergien hinzufuegen", "Allergiedaten helfen VYVA, riskante Vorschlaege zu vermeiden.", "Hinzufuegen"),
    fr: copy("Ajouter allergies", "Les allergies aident VYVA a eviter les suggestions risquees.", "Ajouter"),
    it: copy("Aggiunga allergie", "I dettagli sulle allergie aiutano VYVA a evitare suggerimenti rischiosi.", "Aggiungi"),
    pt: copy("Adicione alergias", "Detalhes de alergias ajudam a VYVA a evitar sugestoes arriscadas.", "Adicionar"),
  },
  providers: {
    en: copy("Add trusted providers", "VYVA can prepare requests faster with trusted services.", "Add providers"),
    es: copy("Anada proveedores fiables", "VYVA puede preparar solicitudes mas rapido con servicios de confianza.", "Anadir"),
    de: copy("Vertraute Anbieter hinzufuegen", "Mit vertrauten Services kann VYVA Anfragen schneller vorbereiten.", "Hinzufuegen"),
    fr: copy("Ajouter fournisseurs fiables", "VYVA peut preparer les demandes plus vite avec des services fiables.", "Ajouter"),
    it: copy("Aggiunga fornitori fidati", "VYVA puo preparare richieste piu rapidamente con servizi fidati.", "Aggiungi"),
    pt: copy("Adicione fornecedores de confianca", "A VYVA prepara pedidos mais rapido com servicos de confianca.", "Adicionar"),
  },
  devices: {
    en: copy("Add devices", "Health devices help VYVA understand your signals.", "Add devices"),
    es: copy("Anada dispositivos", "Los dispositivos de salud ayudan a VYVA a entender sus senales.", "Anadir"),
    de: copy("Geraete hinzufuegen", "Gesundheitsgeraete helfen VYVA, Ihre Signale zu verstehen.", "Hinzufuegen"),
    fr: copy("Ajouter appareils", "Les appareils de sante aident VYVA a comprendre vos signaux.", "Ajouter"),
    it: copy("Aggiunga dispositivi", "I dispositivi sanitari aiutano VYVA a capire i suoi segnali.", "Aggiungi"),
    pt: copy("Adicione dispositivos", "Dispositivos de saude ajudam a VYVA a entender os seus sinais.", "Adicionar"),
  },
  diet: {
    en: copy("Add food preferences", "Diet notes help daily suggestions feel more personal.", "Add diet"),
    es: copy("Anada preferencias de comida", "Las notas de dieta hacen las sugerencias mas personales.", "Anadir"),
    de: copy("Essensvorlieben hinzufuegen", "Ernaehrungsnotizen machen taegliche Vorschlaege persoenlicher.", "Hinzufuegen"),
    fr: copy("Ajouter preferences alimentaires", "Les notes alimentaires rendent les conseils plus personnels.", "Ajouter"),
    it: copy("Aggiunga preferenze alimentari", "Le note sulla dieta rendono i consigli piu personali.", "Aggiungi"),
    pt: copy("Adicione preferencias alimentares", "Notas de dieta tornam as sugestoes mais pessoais.", "Adicionar"),
  },
  hobbies: {
    en: copy("Add your interests", "Interests help VYVA make companionship warmer.", "Add interests"),
    es: copy("Anada sus intereses", "Los intereses ayudan a VYVA a hacer la compania mas calida.", "Anadir"),
    de: copy("Interessen hinzufuegen", "Interessen helfen VYVA, Begleitung waermer zu gestalten.", "Hinzufuegen"),
    fr: copy("Ajouter interets", "Les interets aident VYVA a rendre la compagnie plus chaleureuse.", "Ajouter"),
    it: copy("Aggiunga interessi", "Gli interessi aiutano VYVA a rendere la compagnia piu calda.", "Aggiungi"),
    pt: copy("Adicione interesses", "Interesses ajudam a VYVA a tornar a companhia mais acolhedora.", "Adicionar"),
  },
};

const CAREGIVER_PROFILE_ACTION_LABELS: Record<WelcomeProfileActionId, Record<WelcomeLanguage, string>> = {
  emergency_contact: {
    en: "emergency contact",
    es: "contacto de emergencia",
    de: "Notfallkontakt",
    fr: "contact d'urgence",
    it: "contatto di emergenza",
    pt: "contacto de emergencia",
  },
  medications: {
    en: "medications",
    es: "medicinas",
    de: "Medikamente",
    fr: "medicaments",
    it: "medicinali",
    pt: "medicamentos",
  },
  gp_details: {
    en: "doctor details",
    es: "datos del medico",
    de: "Arztdaten",
    fr: "details du medecin",
    it: "dati del medico",
    pt: "dados do medico",
  },
  address: {
    en: "home address",
    es: "direccion",
    de: "Adresse",
    fr: "adresse",
    it: "indirizzo",
    pt: "endereco",
  },
  care_team: {
    en: "care team",
    es: "equipo de apoyo",
    de: "Betreuungsteam",
    fr: "equipe de soutien",
    it: "team di supporto",
    pt: "equipa de apoio",
  },
  preferences: {
    en: "preferences",
    es: "preferencias",
    de: "Praeferenzen",
    fr: "preferences",
    it: "preferenze",
    pt: "preferencias",
  },
  notifications: {
    en: "notifications",
    es: "notificaciones",
    de: "Benachrichtigungen",
    fr: "notifications",
    it: "notifiche",
    pt: "notificacoes",
  },
  cognitive: {
    en: "cognitive settings",
    es: "ajustes cognitivos",
    de: "kognitive Einstellungen",
    fr: "reglages cognitifs",
    it: "impostazioni cognitive",
    pt: "definicoes cognitivas",
  },
  health_conditions: {
    en: "health conditions",
    es: "condiciones de salud",
    de: "Gesundheitsdaten",
    fr: "conditions de sante",
    it: "condizioni di salute",
    pt: "condicoes de saude",
  },
  allergies: {
    en: "allergies",
    es: "alergias",
    de: "Allergien",
    fr: "allergies",
    it: "allergie",
    pt: "alergias",
  },
  providers: {
    en: "trusted providers",
    es: "proveedores fiables",
    de: "vertraute Anbieter",
    fr: "fournisseurs fiables",
    it: "fornitori fidati",
    pt: "fornecedores de confianca",
  },
  devices: {
    en: "devices",
    es: "dispositivos",
    de: "Geraete",
    fr: "appareils",
    it: "dispositivi",
    pt: "dispositivos",
  },
  diet: {
    en: "food preferences",
    es: "preferencias de comida",
    de: "Essensvorlieben",
    fr: "preferences alimentaires",
    it: "preferenze alimentari",
    pt: "preferencias alimentares",
  },
  hobbies: {
    en: "interests",
    es: "intereses",
    de: "Interessen",
    fr: "interets",
    it: "interessi",
    pt: "interesses",
  },
};

const CAREGIVER_PROFILE_ACTION_SUBTITLES: Record<WelcomeProfileActionId, Record<WelcomeLanguage, string>> = {
  emergency_contact: {
    en: "Add the contact VYVA should keep visible in urgent moments.",
    es: "Anada el contacto que VYVA debe tener visible en momentos urgentes.",
    de: "Fuegen Sie den Kontakt hinzu, den VYVA in dringenden Momenten sehen soll.",
    fr: "Ajoutez le contact a garder visible en cas d'urgence.",
    it: "Aggiunga il contatto che VYVA deve tenere visibile nei momenti urgenti.",
    pt: "Adicione o contacto que a VYVA deve manter visivel em momentos urgentes.",
  },
  medications: {
    en: "Medication details help reminders and handovers stay accurate.",
    es: "Los datos de medicinas mantienen recordatorios y traspasos precisos.",
    de: "Medikamentendaten halten Erinnerungen und Uebergaben genauer.",
    fr: "Les medicaments rendent les rappels et relais plus precis.",
    it: "I medicinali mantengono promemoria e passaggi piu precisi.",
    pt: "Os medicamentos mantem lembretes e passagens mais precisos.",
  },
  gp_details: {
    en: "Doctor details make it faster to prepare calls and health conversations.",
    es: "Los datos del medico facilitan llamadas y conversaciones de salud.",
    de: "Arztdaten machen Anrufe und Gesundheitsgespraeche schneller.",
    fr: "Les details du medecin accelerent les appels et echanges sante.",
    it: "I dati del medico rendono piu rapide chiamate e conversazioni sanitarie.",
    pt: "Os dados do medico aceleram chamadas e conversas de saude.",
  },
  address: {
    en: "The address helps rides, home services, and safety checks go to the right place.",
    es: "La direccion ayuda a enviar viajes, servicios y revisiones al lugar correcto.",
    de: "Die Adresse hilft, Fahrten, Services und Sicherheitschecks richtig zu senden.",
    fr: "L'adresse aide a envoyer trajets, services et controles au bon endroit.",
    it: "L'indirizzo aiuta a inviare trasporti, servizi e controlli al posto giusto.",
    pt: "O endereco ajuda viagens, servicos e verificacoes a chegar ao sitio certo.",
  },
  care_team: {
    en: "Care-team details show who to contact for each kind of support.",
    es: "El equipo muestra a quien contactar para cada tipo de apoyo.",
    de: "Das Betreuungsteam zeigt, wen man fuer welche Hilfe kontaktiert.",
    fr: "L'equipe indique qui contacter pour chaque type de soutien.",
    it: "Il team indica chi contattare per ogni tipo di supporto.",
    pt: "A equipa mostra quem contactar para cada tipo de apoio.",
  },
  preferences: {
    en: "Preferences help VYVA use the right language, tone, and routine.",
    es: "Las preferencias ayudan a VYVA con idioma, tono y rutina correctos.",
    de: "Praeferenzen helfen VYVA mit passender Sprache, Tonalitaet und Routine.",
    fr: "Les preferences aident VYVA avec la bonne langue, le ton et la routine.",
    it: "Le preferenze aiutano VYVA con lingua, tono e routine giusti.",
    pt: "As preferencias ajudam a VYVA com idioma, tom e rotina certos.",
  },
  notifications: {
    en: "Notification choices decide who hears what, and when.",
    es: "Las notificaciones deciden quien recibe que aviso y cuando.",
    de: "Benachrichtigungen legen fest, wer was wann hoert.",
    fr: "Les notifications fixent qui recoit quoi, et quand.",
    it: "Le notifiche decidono chi riceve cosa e quando.",
    pt: "As notificacoes definem quem recebe o que, e quando.",
  },
  cognitive: {
    en: "Cognitive settings help VYVA choose the right pace and memory support.",
    es: "Los ajustes cognitivos ayudan a elegir ritmo y apoyo de memoria.",
    de: "Kognitive Einstellungen helfen, Tempo und Gedachtnisstuetze anzupassen.",
    fr: "Les reglages cognitifs aident a choisir rythme et soutien memoire.",
    it: "Le impostazioni cognitive aiutano a scegliere ritmo e supporto memoria.",
    pt: "As definicoes cognitivas ajudam a escolher ritmo e apoio de memoria.",
  },
  health_conditions: {
    en: "Health conditions help VYVA avoid missing important context.",
    es: "Las condiciones ayudan a no perder contexto importante.",
    de: "Gesundheitsdaten verhindern, dass wichtiger Kontext fehlt.",
    fr: "Les conditions evitent de manquer un contexte important.",
    it: "Le condizioni aiutano a non perdere contesto importante.",
    pt: "As condicoes evitam perder contexto importante.",
  },
  allergies: {
    en: "Allergy details help VYVA avoid risky suggestions.",
    es: "Las alergias ayudan a evitar sugerencias de riesgo.",
    de: "Allergien helfen, riskante Vorschlaege zu vermeiden.",
    fr: "Les allergies aident a eviter les suggestions risquees.",
    it: "Le allergie aiutano a evitare suggerimenti rischiosi.",
    pt: "As alergias ajudam a evitar sugestoes arriscadas.",
  },
  providers: {
    en: "Trusted providers let VYVA prepare service requests faster.",
    es: "Los proveedores fiables permiten preparar solicitudes mas rapido.",
    de: "Vertraute Anbieter machen Serviceanfragen schneller.",
    fr: "Les fournisseurs fiables accelerent les demandes de service.",
    it: "I fornitori fidati rendono piu rapide le richieste di servizio.",
    pt: "Fornecedores de confianca aceleram pedidos de servico.",
  },
  devices: {
    en: "Device details help VYVA understand readings and setup needs.",
    es: "Los dispositivos ayudan a entender lecturas y necesidades de configuracion.",
    de: "Geraetedaten helfen, Messwerte und Einrichtung zu verstehen.",
    fr: "Les appareils aident a comprendre mesures et installation.",
    it: "I dispositivi aiutano a capire letture e configurazione.",
    pt: "Os dispositivos ajudam a entender leituras e configuracao.",
  },
  diet: {
    en: "Food preferences help meals and recommendations fit the person.",
    es: "La comida ayuda a que comidas y recomendaciones encajen mejor.",
    de: "Essensvorlieben machen Mahlzeiten und Empfehlungen passender.",
    fr: "Les preferences alimentaires rendent repas et conseils plus adaptes.",
    it: "Le preferenze alimentari rendono pasti e consigli piu adatti.",
    pt: "As preferencias alimentares tornam refeicoes e conselhos mais adequados.",
  },
  hobbies: {
    en: "Interests help companion moments feel familiar and personal.",
    es: "Los intereses hacen que la compania sea mas familiar y personal.",
    de: "Interessen machen Begleitung vertrauter und persoenlicher.",
    fr: "Les interets rendent la compagnie plus familiere et personnelle.",
    it: "Gli interessi rendono la compagnia piu familiare e personale.",
    pt: "Os interesses tornam a companhia mais familiar e pessoal.",
  },
};

function caregiverProfileNudgeCopy(actionId: WelcomeProfileActionId): Record<WelcomeLanguage, WelcomeCopy> {
  const label = CAREGIVER_PROFILE_ACTION_LABELS[actionId];
  const subtitle = CAREGIVER_PROFILE_ACTION_SUBTITLES[actionId];
  const emergency = actionId === "emergency_contact";
  return {
    en: copy(
      emergency ? "Make support safer" : `Complete ${label.en}`,
      subtitle.en,
      emergency ? "Add contact" : "Complete",
    ),
    es: copy(
      emergency ? "Haga el apoyo mas seguro" : `Complete ${label.es}`,
      subtitle.es,
      emergency ? "Anadir contacto" : "Completar",
    ),
    de: copy(
      emergency ? "Support sicherer machen" : `${label.de} ergaenzen`,
      subtitle.de,
      emergency ? "Kontakt hinzufuegen" : "Ergaenzen",
    ),
    fr: copy(
      emergency ? "Rendre le soutien plus sur" : `Completer ${label.fr}`,
      subtitle.fr,
      emergency ? "Ajouter" : "Completer",
    ),
    it: copy(
      emergency ? "Rendi il supporto piu sicuro" : `Completa ${label.it}`,
      subtitle.it,
      emergency ? "Aggiungi contatto" : "Completa",
    ),
    pt: copy(
      emergency ? "Torne o apoio mais seguro" : `Complete ${label.pt}`,
      subtitle.pt,
      emergency ? "Adicionar contacto" : "Completar",
    ),
  };
}

export const WELCOME_MODULE_TEMPLATES: WelcomeTemplateDefinition[] = [
  firstWelcomeTemplate("elder", "morning", {
    en: copy("Good morning, {name}", "How are you feeling?"),
    es: copy("Buenos dias, {name}", "Como se siente hoy?"),
    fr: copy("Bonjour, {name}", "Comment vous sentez-vous ?"),
    de: copy("Guten Morgen, {name}", "Wie fuehlen Sie sich?"),
    it: copy("Buongiorno, {name}", "Come si sente oggi?"),
    pt: copy("Bom dia, {name}", "Como se sente hoje?"),
  }),
  firstWelcomeTemplate("elder", "afternoon", {
    en: copy("Good afternoon, {name}", "How are you feeling?"),
    es: copy("Buenas tardes, {name}", "Como se siente hoy?"),
    fr: copy("Bon apres-midi, {name}", "Comment vous sentez-vous ?"),
    de: copy("Guten Tag, {name}", "Wie fuehlen Sie sich?"),
    it: copy("Buon pomeriggio, {name}", "Come si sente oggi?"),
    pt: copy("Boa tarde, {name}", "Como se sente hoje?"),
  }),
  firstWelcomeTemplate("elder", "evening", {
    en: copy("Good evening, {name}", "How are you feeling?"),
    es: copy("Buenas noches, {name}", "Como se siente hoy?"),
    fr: copy("Bonsoir, {name}", "Comment vous sentez-vous ?"),
    de: copy("Guten Abend, {name}", "Wie fuehlen Sie sich?"),
    it: copy("Buonasera, {name}", "Come si sente oggi?"),
    pt: copy("Boa noite, {name}", "Como se sente hoje?"),
  }),
  firstWelcomeTemplate("elder", "night", {
    en: copy("Good evening, {name}", "How are you feeling?"),
    es: copy("Buenas noches, {name}", "Como se siente hoy?"),
    fr: copy("Bonsoir, {name}", "Comment vous sentez-vous ?"),
    de: copy("Guten Abend, {name}", "Wie fuehlen Sie sich?"),
    it: copy("Buonasera, {name}", "Come si sente oggi?"),
    pt: copy("Boa noite, {name}", "Como se sente hoje?"),
  }),
  firstWelcomeTemplate("caregiver", "morning", {
    en: copy("Good morning, {name}", "Set up contacts, medicines, and reminders so help is ready."),
    es: copy("Buenos dias, {name}", "Prepare contactos, medicinas y recordatorios para que la ayuda este lista."),
    de: copy("Guten Morgen, {name}", "Richten Sie Kontakte, Medikamente und Erinnerungen ein, damit Hilfe bereit ist."),
    fr: copy("Bonjour, {name}", "Ajoutez contacts, medicaments et rappels pour que l'aide soit prete."),
    it: copy("Buongiorno, {name}", "Imposti contatti, medicinali e promemoria cosi l'aiuto e pronto."),
    pt: copy("Bom dia, {name}", "Configure contactos, medicamentos e lembretes para a ajuda ficar pronta."),
  }),
  firstWelcomeTemplate("caregiver", "afternoon", {
    en: copy("Good afternoon, {name}", "Set up contacts, medicines, and reminders so help is ready."),
    es: copy("Buenas tardes, {name}", "Prepare contactos, medicinas y recordatorios para que la ayuda este lista."),
    de: copy("Guten Tag, {name}", "Richten Sie Kontakte, Medikamente und Erinnerungen ein, damit Hilfe bereit ist."),
    fr: copy("Bon apres-midi, {name}", "Ajoutez contacts, medicaments et rappels pour que l'aide soit prete."),
    it: copy("Buon pomeriggio, {name}", "Imposti contatti, medicinali e promemoria cosi l'aiuto e pronto."),
    pt: copy("Boa tarde, {name}", "Configure contactos, medicamentos e lembretes para a ajuda ficar pronta."),
  }),
  firstWelcomeTemplate("caregiver", "evening", {
    en: copy("Good evening, {name}", "Check urgent contacts, medicines, and reminders before they are needed."),
    es: copy("Buenas noches, {name}", "Revise contactos urgentes, medicinas y recordatorios antes de necesitarlos."),
    de: copy("Guten Abend, {name}", "Pruefen Sie Notfallkontakte, Medikamente und Erinnerungen, bevor sie gebraucht werden."),
    fr: copy("Bonsoir, {name}", "Verifiez contacts urgents, medicaments et rappels avant d'en avoir besoin."),
    it: copy("Buonasera, {name}", "Controlli contatti urgenti, medicinali e promemoria prima che servano."),
    pt: copy("Boa noite, {name}", "Verifique contactos urgentes, medicamentos e lembretes antes de serem precisos."),
  }),
  firstWelcomeTemplate("caregiver", "night", {
    en: copy("Good evening, {name}", "Check urgent contacts, medicines, and reminders before they are needed."),
    es: copy("Buenas noches, {name}", "Revise contactos urgentes, medicinas y recordatorios antes de necesitarlos."),
    de: copy("Guten Abend, {name}", "Pruefen Sie Notfallkontakte, Medikamente und Erinnerungen, bevor sie gebraucht werden."),
    fr: copy("Bonsoir, {name}", "Verifiez contacts urgents, medicaments et rappels avant d'en avoir besoin."),
    it: copy("Buonasera, {name}", "Controlli contatti urgenti, medicinali e promemoria prima che servano."),
    pt: copy("Boa noite, {name}", "Verifique contactos urgentes, medicamentos e lembretes antes de serem precisos."),
  }),
  ...WELCOME_PROFILE_ACTIONS.map((action) => profileNudgeTemplate("elder", action.id, ELDER_PROFILE_NUDGE_COPY[action.id])),
  ...WELCOME_PROFILE_ACTIONS.map((action) => profileNudgeTemplate("caregiver", action.id, caregiverProfileNudgeCopy(action.id))),
];

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasText(...values: unknown[]): boolean {
  return values.some((value) => textValue(value).length > 0);
}

function hasArrayItems(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => textValue(item).length > 0 || Boolean(item && typeof item === "object"));
}

function boolValue(value: unknown): boolean {
  return value === true || value === "true";
}

export function applyWelcomeName(template: string, name?: string | null): string {
  const displayName = textValue(name) || "VYVA";
  return template.replace(/\{name\}/g, displayName);
}

export function renderWelcomeCopy(
  template: WelcomeTemplateDefinition,
  language: string | null | undefined,
  name?: string | null,
): WelcomeCopy | null {
  const normalized = normalizeWelcomeLanguage(language);
  const selected = template.copy[normalized] ?? template.copy.en ?? template.copy.es;
  if (!selected?.headline || !selected.subtitle) return null;
  return {
    headline: applyWelcomeName(selected.headline, name),
    subtitle: applyWelcomeName(selected.subtitle, name),
    ctaLabel: selected.ctaLabel ? applyWelcomeName(selected.ctaLabel, name) : undefined,
  };
}

export function isWelcomeProfileActionComplete(
  action: WelcomeProfileActionId,
  snapshot: {
    profile?: Record<string, unknown> | null;
    onboardingState?: Record<string, unknown> | null;
    channelPreferences?: Record<string, unknown> | null;
    medications?: unknown[] | null;
  },
): boolean {
  const profile = recordValue(snapshot.profile);
  const state = recordValue(snapshot.onboardingState);
  const consent = recordValue(profile.data_sharing_consent);
  const emergency = recordValue(consent.emergency ?? profile.emergency_contact);
  const conditions = recordValue(consent.conditions);
  const medications = recordValue(consent.medications);
  const allergies = recordValue(consent.allergies);
  const providers = recordValue(consent.providers);
  const devices = recordValue(consent.devices);
  const diet = recordValue(consent.diet);
  const hobbies = recordValue(consent.hobbies);
  const cognitive = recordValue(consent.cognitive ?? consent.brain ?? profile.cognitive_preferences);
  const channelPreferences = recordValue(snapshot.channelPreferences);

  switch (action) {
    case "emergency_contact":
      return boolValue(state.has_emergency_address)
        || hasText(emergency.emergency_name, emergency.emergency_phone, emergency.address, profile.emergency_contact_name);
    case "medications":
      return boolValue(state.has_medications)
        || boolValue(profile.no_known_medications)
        || boolValue(medications.no_known_medications)
        || hasArrayItems(snapshot.medications)
        || hasArrayItems(profile.medications)
        || hasArrayItems(medications.medications);
    case "gp_details":
      return boolValue(state.has_gp_details)
        || hasText(profile.gp_name, profile.gp_phone, profile.gp_email)
        || hasText(recordValue(consent.gp).gp_name, recordValue(consent.gp).gp_phone);
    case "address":
      return boolValue(state.has_emergency_address)
        || boolValue(state.has_location)
        || hasText(profile.street, profile.city, profile.cityState, profile.postalCode, emergency.address);
    case "care_team":
      return boolValue(state.has_caregiver)
        || boolValue(state.has_family_member)
        || boolValue(state.has_doctor)
        || hasText(profile.caregiver_name, profile.caregiverName)
        || hasArrayItems(profile.care_team);
    case "preferences":
      return boolValue(state.has_language)
        && (boolValue(state.has_checkin_preference) || hasText(profile.channel_notifications, profile.language, profile.language_preference));
    case "notifications":
      return hasText(
        channelPreferences.preferred_checkin_channel,
        channelPreferences.preferred_reminder_channel,
        profile.channel_notifications,
      );
    case "cognitive":
      return hasText(cognitive.pace, cognitive.language, cognitive.memory_support, cognitive.preferred_pace)
        || hasText(profile.cognitive_pace, profile.memory_support_preference);
    case "health_conditions":
      return boolValue(state.has_health_conditions)
        || boolValue(profile.no_known_conditions)
        || boolValue(conditions.no_known_conditions)
        || hasArrayItems(profile.conditions)
        || hasArrayItems(conditions.health_conditions);
    case "allergies":
      return boolValue(state.has_allergies)
        || boolValue(profile.no_known_allergies)
        || boolValue(allergies.no_known_allergies)
        || hasArrayItems(profile.allergies)
        || hasArrayItems(allergies.allergies);
    case "providers":
      return hasArrayItems(profile.savedProviders)
        || hasArrayItems(providers.providers)
        || hasArrayItems(profile.providers);
    case "devices":
      return hasArrayItems(devices.devices)
        || hasArrayItems(profile.health_devices)
        || hasArrayItems(profile.devices);
    case "diet":
      return hasText(diet.dietary_notes, diet.dietary_preferences)
        || hasArrayItems(diet.dietary_preferences)
        || hasText(profile.dietary_preferences);
    case "hobbies":
      return hasArrayItems(hobbies.hobbies)
        || hasArrayItems(profile.hobbies)
        || hasText(profile.hobbies);
    default:
      return false;
  }
}
