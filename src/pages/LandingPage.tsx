import { Link } from "react-router-dom";
import {
  ArrowRight,
  Activity,
  Brain,
  CheckCircle2,
  ConciergeBell,
  FileText,
  Globe2,
  HeartHandshake,
  HeartPulse,
  MapPin,
  MessageCircleHeart,
  Mic2,
  Pill,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useLanguage } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";

const careLoop = [
  { icon: Mic2, label: "Listens", detail: "A warm voice starts the check-in." },
  { icon: CheckCircle2, label: "Reminds", detail: "Medication, appointments, routines, and plans stay visible." },
  { icon: Activity, label: "Notices", detail: "Changes in mood, symptoms, or missed routines are easier to spot." },
  { icon: UsersRound, label: "Shares by choice", detail: "Trusted people hear only what you choose to share." },
];

const supportMoments = [
  {
    icon: HeartPulse,
    title: "Health check-ins",
    body: "A simple conversation can capture how you feel and what changed.",
    tone: "bg-[#FCE7F3] text-[#BE185D]",
  },
  {
    icon: Pill,
    title: "Medication reminders",
    body: "Gentle prompts help confirm what was taken and when.",
    tone: "bg-[#EEF2FF] text-[#4F46E5]",
  },
  {
    icon: Brain,
    title: "Memory and calm",
    body: "Short exercises, stories, music, and conversation help keep the mind active.",
    tone: "bg-[#E0F2FE] text-[#0369A1]",
  },
  {
    icon: ConciergeBell,
    title: "Planning the day",
    body: "VYVA can help with appointments, errands, and next steps.",
    tone: "bg-[#DCFCE7] text-[#15803D]",
  },
];

const fullFeatureSet = [
  {
    icon: HeartPulse,
    title: "Health check-ins",
    body: "Talk through symptoms, wellbeing, providers, and health context when you need support.",
    tone: "bg-[#FCE7F3] text-[#BE185D]",
  },
  {
    icon: Pill,
    title: "Medication reminders",
    body: "Set reminders, confirm doses, and keep routines easier to follow.",
    tone: "bg-[#EEF2FF] text-[#4F46E5]",
  },
  {
    icon: Mic2,
    title: "Daily voice check-ins",
    body: "Natural check-ins by phone, app, or familiar channels.",
    tone: "bg-[#F3E8FF] text-[#7E22CE]",
  },
  {
    icon: Stethoscope,
    title: "Symptom guidance",
    body: "Answer structured questions when you do not feel well.",
    tone: "bg-[#ECFDF5] text-[#047857]",
  },
  {
    icon: FileText,
    title: "Companionship",
    body: "Always-available conversation, reassurance, and daily engagement.",
    tone: "bg-[#FEF3C7] text-[#B7791F]",
  },
  {
    icon: ShieldCheck,
    title: "Safety support",
    body: "Urgent signals, scam awareness, privacy, and consent stay visible.",
    tone: "bg-[#FEE2E2] text-[#B91C1C]",
  },
  {
    icon: Brain,
    title: "Memory exercises",
    body: "Memory games, stories, music, and gentle brain activities.",
    tone: "bg-[#E0F2FE] text-[#0369A1]",
  },
  {
    icon: MapPin,
    title: "Concierge help",
    body: "Bookings, errands, local support, and practical tasks.",
    tone: "bg-[#DCFCE7] text-[#15803D]",
  },
  {
    icon: UsersRound,
    title: "Family updates",
    body: "Trusted people stay informed without taking over.",
    tone: "bg-[#FAE8FF] text-[#A21CAF]",
  },
];

const outcomeCards = [
  {
    icon: HeartHandshake,
    title: "For seniors",
    body: "A friendly voice for reminders, wellbeing, memory, and daily plans.",
  },
  {
    icon: UsersRound,
    title: "For families",
    body: "More reassurance between calls, visits, and busy days.",
  },
  {
    icon: ShieldCheck,
    title: "For care teams",
    body: "Clearer context before small issues become urgent.",
  },
];

const LANDING_COPY: Record<LanguageCode, {
  languageLabel: string;
  signIn: string;
  getStarted: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  andMore: string;
  productLive: string;
  productTalk: string;
  productActions: string[];
  heroFeatures: string[];
  careLoopHeading: string;
  careLoopIntro: string;
  careLoop: { label: string; detail: string }[];
  supportHeading: string;
  supportIntro: string;
  supportMoments: { title: string; body: string }[];
  featuresHeading: string;
  featuresIntro: string;
  features: { title: string; body: string }[];
  valuesHeading: string;
  valuesIntro: string;
  values: string[];
  caregiverHeading: string;
  caregiverIntro: string;
  outcomes: { title: string; body: string }[];
  finalHeading: string;
  createAccount: string;
}> = {
  en: {
    languageLabel: "Language",
    signIn: "Sign in",
    getStarted: "Get started",
    heroEyebrow: "Health and wellness support",
    heroTitle: "A companion that listens, reminds, and helps.",
    heroSubtitle: "Talk to VYVA for health check-ins, medication reminders, memory exercises, or help planning your day.",
    andMore: "And more",
    productLive: "Live",
    productTalk: "Talk to VYVA",
    productActions: ["My Health", "My Mind", "My Community", "My Concierge"],
    heroFeatures: ["Health check-ins", "Medication reminders", "Memory exercises", "Daily planning", "Family updates", "Practical help"],
    careLoopHeading: "A daily rhythm that helps you stay well.",
    careLoopIntro: "VYVA listens first, then helps with the small routines that make each day feel easier and more connected.",
    careLoop: [
      { label: "Listens", detail: "A warm voice starts the check-in." },
      { label: "Reminds", detail: "Medication, appointments, routines, and plans stay visible." },
      { label: "Notices", detail: "Changes in mood, symptoms, or missed routines are easier to spot." },
      { label: "Shares by choice", detail: "Trusted people hear only what you choose to share." },
    ],
    supportHeading: "Help for the moments that matter every day.",
    supportIntro: "From health and medication to memory and practical tasks, VYVA keeps support close without taking over.",
    supportMoments: [
      { title: "Health check-ins", body: "A simple conversation can capture how you feel and what changed." },
      { title: "Medication reminders", body: "Gentle prompts help confirm what was taken and when." },
      { title: "Memory and calm", body: "Short exercises, stories, music, and conversation help keep the mind active." },
      { title: "Planning the day", body: "VYVA can help with appointments, errands, and next steps." },
    ],
    featuresHeading: "Everything connects around your day.",
    featuresIntro: "VYVA brings together health, medication, mind activities, family updates, community, and concierge help in one calm experience.",
    features: [
      { title: "Health check-ins", body: "Talk through symptoms, wellbeing, providers, and health context when you need support." },
      { title: "Medication reminders", body: "Set reminders, confirm doses, and keep routines easier to follow." },
      { title: "Daily voice check-ins", body: "Natural check-ins by phone, app, or familiar channels." },
      { title: "Symptom guidance", body: "Answer structured questions when you do not feel well." },
      { title: "Companionship", body: "Always-available conversation, reassurance, and daily engagement." },
      { title: "Safety support", body: "Urgent signals, scam awareness, privacy, and consent stay visible." },
      { title: "Memory exercises", body: "Memory games, stories, music, and gentle brain activities." },
      { title: "Concierge help", body: "Bookings, errands, local support, and practical tasks." },
      { title: "Family updates", body: "Trusted people stay informed without taking over." },
    ],
    valuesHeading: "Private support, shared only by choice.",
    valuesIntro: "VYVA helps without taking over: private by default, consent-led, and built around the people you trust.",
    values: ["Built for independence", "Reminders without pressure", "Trusted people closer", "Privacy and consent first"],
    caregiverHeading: "Support for seniors first, reassurance for families too.",
    caregiverIntro: "VYVA listens to the person using it, then helps families and care teams understand what needs attention.",
    outcomes: [
      { title: "For seniors", body: "A friendly voice for reminders, wellbeing, memory, and daily plans." },
      { title: "For families", body: "More reassurance between calls, visits, and busy days." },
      { title: "For care teams", body: "Clearer context before small issues become urgent." },
    ],
    finalHeading: "Start with a conversation that helps.",
    createAccount: "Create your account",
  },
  es: {
    languageLabel: "Idioma",
    signIn: "Entrar",
    getStarted: "Empezar",
    heroEyebrow: "Apoyo de salud y bienestar",
    heroTitle: "Una compañera que escucha, recuerda y ayuda.",
    heroSubtitle: "Habla con VYVA para controles de salud, recordatorios de medicación, ejercicios de memoria o ayuda para planificar tu día.",
    andMore: "Y más",
    productLive: "En vivo",
    productTalk: "Hablar con VYVA",
    productActions: ["Mi salud", "Mi mente", "Mi comunidad", "Mi conserje"],
    heroFeatures: ["Controles de salud", "Recordatorios de medicación", "Ejercicios de memoria", "Planificar el día", "Actualizaciones familiares", "Ayuda práctica"],
    careLoopHeading: "Un ritmo diario que ayuda a estar bien.",
    careLoopIntro: "VYVA escucha primero y luego ayuda con pequeñas rutinas para que cada día sea más fácil y conectado.",
    careLoop: [
      { label: "Escucha", detail: "Una voz cálida inicia el check-in." },
      { label: "Recuerda", detail: "Medicación, citas, rutinas y planes quedan visibles." },
      { label: "Nota cambios", detail: "Cambios de ánimo, síntomas o rutinas perdidas son más fáciles de detectar." },
      { label: "Comparte por elección", detail: "Las personas de confianza solo oyen lo que decides compartir." },
    ],
    supportHeading: "Ayuda para los momentos de cada día.",
    supportIntro: "Desde salud y medicación hasta memoria y tareas prácticas, VYVA mantiene el apoyo cerca sin tomar el control.",
    supportMoments: [
      { title: "Controles de salud", body: "Una conversación sencilla puede recoger cómo te sientes y qué ha cambiado." },
      { title: "Recordatorios de medicación", body: "Avisos suaves ayudan a confirmar qué se tomó y cuándo." },
      { title: "Memoria y calma", body: "Ejercicios breves, historias, música y conversación ayudan a mantener la mente activa." },
      { title: "Planificar el día", body: "VYVA puede ayudar con citas, recados y próximos pasos." },
    ],
    featuresHeading: "Todo se conecta alrededor de tu día.",
    featuresIntro: "VYVA reúne salud, medicación, actividades mentales, actualizaciones familiares, comunidad y ayuda concierge en una experiencia tranquila.",
    features: [
      { title: "Controles de salud", body: "Habla sobre síntomas, bienestar, médicos y contexto de salud cuando necesites apoyo." },
      { title: "Recordatorios de medicación", body: "Configura recordatorios, confirma tomas y facilita seguir rutinas." },
      { title: "Check-ins diarios por voz", body: "Conversaciones naturales por teléfono, app o canales familiares." },
      { title: "Guía de síntomas", body: "Responde preguntas estructuradas cuando no te sientes bien." },
      { title: "Compañía", body: "Conversación, tranquilidad y apoyo diario siempre disponibles." },
      { title: "Apoyo de seguridad", body: "Señales urgentes, estafas, privacidad y consentimiento permanecen visibles." },
      { title: "Ejercicios de memoria", body: "Juegos de memoria, historias, música y actividades mentales suaves." },
      { title: "Ayuda concierge", body: "Reservas, recados, apoyo local y tareas prácticas." },
      { title: "Actualizaciones familiares", body: "Las personas de confianza se mantienen informadas sin tomar el control." },
    ],
    valuesHeading: "Apoyo privado, compartido solo por elección.",
    valuesIntro: "VYVA ayuda sin tomar el control: privado por defecto, guiado por consentimiento y alrededor de personas de confianza.",
    values: ["Diseñado para la independencia", "Recordatorios sin presión", "Personas de confianza más cerca", "Privacidad y consentimiento primero"],
    caregiverHeading: "Primero apoyo para seniors, también tranquilidad para familias.",
    caregiverIntro: "VYVA escucha a la persona que lo usa y ayuda a familias y equipos de cuidado a entender qué necesita atención.",
    outcomes: [
      { title: "Para seniors", body: "Una voz amable para recordatorios, bienestar, memoria y planes diarios." },
      { title: "Para familias", body: "Más tranquilidad entre llamadas, visitas y días ocupados." },
      { title: "Para equipos de cuidado", body: "Contexto más claro antes de que pequeños problemas sean urgentes." },
    ],
    finalHeading: "Empieza con una conversación que ayuda.",
    createAccount: "Crear cuenta",
  },
  fr: {
    languageLabel: "Langue",
    signIn: "Connexion",
    getStarted: "Commencer",
    heroEyebrow: "Soutien santé et bien-être",
    heroTitle: "Un compagnon qui écoute, rappelle et aide.",
    heroSubtitle: "Parlez à VYVA pour les points santé, les rappels de médicaments, les exercices de mémoire ou l'organisation de votre journée.",
    andMore: "Et plus",
    productLive: "En direct",
    productTalk: "Parler à VYVA",
    productActions: ["Ma santé", "Mon cerveau", "Ma communauté", "Ma conciergerie"],
    heroFeatures: ["Points santé", "Rappels de médicaments", "Exercices de mémoire", "Organisation du jour", "Nouvelles aux proches", "Aide pratique"],
    careLoopHeading: "Un rythme quotidien pour rester bien.",
    careLoopIntro: "VYVA écoute d'abord, puis aide avec les petites routines qui rendent la journée plus simple et plus reliée.",
    careLoop: [
      { label: "Écoute", detail: "Une voix chaleureuse lance le point quotidien." },
      { label: "Rappelle", detail: "Médicaments, rendez-vous, routines et plans restent visibles." },
      { label: "Remarque", detail: "Les changements d'humeur, de symptômes ou de routines sont plus faciles à repérer." },
      { label: "Partage par choix", detail: "Les personnes de confiance entendent seulement ce que vous choisissez de partager." },
    ],
    supportHeading: "De l'aide pour les moments du quotidien.",
    supportIntro: "De la santé aux médicaments, de la mémoire aux tâches pratiques, VYVA garde le soutien proche sans prendre le contrôle.",
    supportMoments: [
      { title: "Points santé", body: "Une conversation simple peut noter comment vous vous sentez et ce qui a changé." },
      { title: "Rappels de médicaments", body: "Des rappels doux aident à confirmer ce qui a été pris et quand." },
      { title: "Mémoire et calme", body: "Exercices courts, histoires, musique et conversation aident à garder l'esprit actif." },
      { title: "Organisation du jour", body: "VYVA peut aider avec les rendez-vous, les courses et les prochaines étapes." },
    ],
    featuresHeading: "Tout se relie autour de votre journée.",
    featuresIntro: "VYVA réunit santé, médicaments, activités de mémoire, nouvelles aux proches, communauté et aide concierge dans une expérience calme.",
    features: [
      { title: "Points santé", body: "Parlez symptômes, bien-être, soignants et contexte santé quand vous avez besoin de soutien." },
      { title: "Rappels de médicaments", body: "Créez des rappels, confirmez les prises et gardez des routines plus faciles à suivre." },
      { title: "Points vocaux quotidiens", body: "Des échanges naturels par téléphone, application ou canaux familiers." },
      { title: "Guide symptômes", body: "Répondez à des questions structurées quand vous ne vous sentez pas bien." },
      { title: "Compagnie", body: "Conversation, réassurance et soutien quotidien toujours disponibles." },
      { title: "Soutien sécurité", body: "Signaux urgents, arnaques, confidentialité et consentement restent visibles." },
      { title: "Exercices de mémoire", body: "Jeux de mémoire, histoires, musique et activités douces pour l'esprit." },
      { title: "Aide concierge", body: "Réservations, démarches, soutien local et tâches pratiques." },
      { title: "Nouvelles aux proches", body: "Les personnes de confiance restent informées sans prendre le contrôle." },
    ],
    valuesHeading: "Un soutien privé, partagé seulement par choix.",
    valuesIntro: "VYVA aide sans prendre le contrôle : privé par défaut, guidé par le consentement et centré sur les personnes de confiance.",
    values: ["Conçu pour l'autonomie", "Rappels sans pression", "Proches de confiance plus présents", "Confidentialité et consentement d'abord"],
    caregiverHeading: "D'abord le soutien des seniors, avec de la réassurance pour les familles.",
    caregiverIntro: "VYVA écoute la personne qui l'utilise, puis aide les familles et équipes de soin à comprendre ce qui mérite attention.",
    outcomes: [
      { title: "Pour les seniors", body: "Une voix amicale pour les rappels, le bien-être, la mémoire et les plans du jour." },
      { title: "Pour les familles", body: "Plus de réassurance entre les appels, visites et journées chargées." },
      { title: "Pour les équipes de soin", body: "Un contexte plus clair avant que les petits sujets deviennent urgents." },
    ],
    finalHeading: "Commencez par une conversation qui aide.",
    createAccount: "Créer votre compte",
  },
  de: {
    languageLabel: "Sprache",
    signIn: "Anmelden",
    getStarted: "Loslegen",
    heroEyebrow: "Unterstützung für Gesundheit und Wohlbefinden",
    heroTitle: "Ein Begleiter, der zuhört, erinnert und hilft.",
    heroSubtitle: "Sprechen Sie mit VYVA über Gesundheits-Check-ins, Medikamentenerinnerungen, Gedächtnisübungen oder Hilfe bei der Tagesplanung.",
    andMore: "Und mehr",
    productLive: "Live",
    productTalk: "Mit VYVA sprechen",
    productActions: ["Meine Gesundheit", "Mein Geist", "Meine Community", "Mein Concierge"],
    heroFeatures: ["Gesundheits-Check-ins", "Medikamentenerinnerungen", "Gedächtnisübungen", "Tagesplanung", "Familien-Updates", "Praktische Hilfe"],
    careLoopHeading: "Ein täglicher Rhythmus, der gut tut.",
    careLoopIntro: "VYVA hört zuerst zu und hilft dann mit kleinen Routinen, damit sich der Tag leichter und verbundener anfühlt.",
    careLoop: [
      { label: "Hört zu", detail: "Eine warme Stimme beginnt den Check-in." },
      { label: "Erinnert", detail: "Medikamente, Termine, Routinen und Pläne bleiben sichtbar." },
      { label: "Bemerkt", detail: "Veränderungen bei Stimmung, Symptomen oder Routinen werden leichter erkannt." },
      { label: "Teilt nach Wunsch", detail: "Vertrauenspersonen hören nur, was Sie teilen möchten." },
    ],
    supportHeading: "Hilfe für die wichtigen Momente im Alltag.",
    supportIntro: "Von Gesundheit und Medikamenten bis Gedächtnis und praktischen Aufgaben hält VYVA Unterstützung nah, ohne zu übernehmen.",
    supportMoments: [
      { title: "Gesundheits-Check-ins", body: "Ein einfaches Gespräch kann festhalten, wie es Ihnen geht und was sich verändert hat." },
      { title: "Medikamentenerinnerungen", body: "Sanfte Hinweise helfen zu bestätigen, was wann genommen wurde." },
      { title: "Gedächtnis und Ruhe", body: "Kurze Übungen, Geschichten, Musik und Gespräche helfen, den Geist aktiv zu halten." },
      { title: "Tagesplanung", body: "VYVA kann bei Terminen, Besorgungen und nächsten Schritten helfen." },
    ],
    featuresHeading: "Alles verbindet sich rund um Ihren Tag.",
    featuresIntro: "VYVA verbindet Gesundheit, Medikamente, Gedächtnisaktivitäten, Familien-Updates, Community und Concierge-Hilfe in einer ruhigen Erfahrung.",
    features: [
      { title: "Gesundheits-Check-ins", body: "Sprechen Sie über Symptome, Wohlbefinden, Ärzte und Gesundheitskontext, wenn Sie Unterstützung brauchen." },
      { title: "Medikamentenerinnerungen", body: "Erinnerungen einrichten, Einnahmen bestätigen und Routinen leichter einhalten." },
      { title: "Tägliche Sprach-Check-ins", body: "Natürliche Gespräche per Telefon, App oder vertrauten Kanälen." },
      { title: "Symptom-Hilfe", body: "Strukturierte Fragen beantworten, wenn Sie sich nicht wohlfühlen." },
      { title: "Begleitung", body: "Jederzeit verfügbare Gespräche, Beruhigung und tägliche Unterstützung." },
      { title: "Sicherheitsunterstützung", body: "Dringende Signale, Betrugsschutz, Datenschutz und Zustimmung bleiben sichtbar." },
      { title: "Gedächtnisübungen", body: "Gedächtnisspiele, Geschichten, Musik und sanfte Denkaktivitäten." },
      { title: "Concierge-Hilfe", body: "Buchungen, Besorgungen, lokale Unterstützung und praktische Aufgaben." },
      { title: "Familien-Updates", body: "Vertrauenspersonen bleiben informiert, ohne zu übernehmen." },
    ],
    valuesHeading: "Private Unterstützung, nur nach Wunsch geteilt.",
    valuesIntro: "VYVA hilft, ohne zu übernehmen: standardmäßig privat, zustimmungsgeführt und rund um Vertrauenspersonen gebaut.",
    values: ["Für Selbstständigkeit gebaut", "Erinnerungen ohne Druck", "Vertrauenspersonen näher", "Datenschutz und Zustimmung zuerst"],
    caregiverHeading: "Zuerst Unterstützung für Senioren, dazu Sicherheit für Familien.",
    caregiverIntro: "VYVA hört der Person zu, die es nutzt, und hilft Familien und Pflegeteams zu verstehen, was Aufmerksamkeit braucht.",
    outcomes: [
      { title: "Für Senioren", body: "Eine freundliche Stimme für Erinnerungen, Wohlbefinden, Gedächtnis und Tagespläne." },
      { title: "Für Familien", body: "Mehr Sicherheit zwischen Anrufen, Besuchen und vollen Tagen." },
      { title: "Für Pflegeteams", body: "Klarerer Kontext, bevor kleine Themen dringend werden." },
    ],
    finalHeading: "Beginnen Sie mit einem Gespräch, das hilft.",
    createAccount: "Konto erstellen",
  },
  it: {
    languageLabel: "Lingua",
    signIn: "Accedi",
    getStarted: "Inizia",
    heroEyebrow: "Supporto per salute e benessere",
    heroTitle: "Un compagno che ascolta, ricorda e aiuta.",
    heroSubtitle: "Parla con VYVA per controlli di salute, promemoria farmaci, esercizi di memoria o aiuto per organizzare la giornata.",
    andMore: "E altro",
    productLive: "Live",
    productTalk: "Parla con VYVA",
    productActions: ["La mia salute", "La mia mente", "La mia comunità", "Il mio concierge"],
    heroFeatures: ["Controlli salute", "Promemoria farmaci", "Esercizi di memoria", "Pianificare la giornata", "Aggiornamenti famiglia", "Aiuto pratico"],
    careLoopHeading: "Un ritmo quotidiano che aiuta a stare bene.",
    careLoopIntro: "VYVA ascolta prima, poi aiuta con piccole routine che rendono la giornata più semplice e più connessa.",
    careLoop: [
      { label: "Ascolta", detail: "Una voce calda avvia il check-in." },
      { label: "Ricorda", detail: "Farmaci, appuntamenti, routine e piani restano visibili." },
      { label: "Nota", detail: "Cambiamenti di umore, sintomi o routine mancate sono più facili da vedere." },
      { label: "Condivide per scelta", detail: "Le persone fidate sentono solo ciò che scegli di condividere." },
    ],
    supportHeading: "Aiuto per i momenti che contano ogni giorno.",
    supportIntro: "Dalla salute ai farmaci, dalla memoria alle attività pratiche, VYVA tiene il supporto vicino senza prendere il controllo.",
    supportMoments: [
      { title: "Controlli salute", body: "Una conversazione semplice può raccogliere come ti senti e cosa è cambiato." },
      { title: "Promemoria farmaci", body: "Promemoria gentili aiutano a confermare cosa è stato preso e quando." },
      { title: "Memoria e calma", body: "Esercizi brevi, storie, musica e conversazione aiutano a mantenere la mente attiva." },
      { title: "Pianificare la giornata", body: "VYVA può aiutare con appuntamenti, commissioni e prossimi passi." },
    ],
    featuresHeading: "Tutto si collega intorno alla tua giornata.",
    featuresIntro: "VYVA unisce salute, farmaci, attività mentali, aggiornamenti familiari, comunità e aiuto concierge in un'esperienza calma.",
    features: [
      { title: "Controlli salute", body: "Parla di sintomi, benessere, medici e contesto sanitario quando hai bisogno di supporto." },
      { title: "Promemoria farmaci", body: "Imposta promemoria, conferma le dosi e segui le routine più facilmente." },
      { title: "Check-in vocali quotidiani", body: "Conversazioni naturali per telefono, app o canali familiari." },
      { title: "Guida sintomi", body: "Rispondi a domande strutturate quando non ti senti bene." },
      { title: "Compagnia", body: "Conversazione, rassicurazione e supporto quotidiano sempre disponibili." },
      { title: "Supporto sicurezza", body: "Segnali urgenti, truffe, privacy e consenso restano visibili." },
      { title: "Esercizi di memoria", body: "Giochi di memoria, storie, musica e attività mentali leggere." },
      { title: "Aiuto concierge", body: "Prenotazioni, commissioni, supporto locale e attività pratiche." },
      { title: "Aggiornamenti famiglia", body: "Le persone fidate restano informate senza prendere il controllo." },
    ],
    valuesHeading: "Supporto privato, condiviso solo per scelta.",
    valuesIntro: "VYVA aiuta senza prendere il controllo: privato per impostazione predefinita, guidato dal consenso e costruito intorno alle persone fidate.",
    values: ["Pensato per l'indipendenza", "Promemoria senza pressione", "Persone fidate più vicine", "Privacy e consenso prima di tutto"],
    caregiverHeading: "Prima supporto per i senior, poi rassicurazione per le famiglie.",
    caregiverIntro: "VYVA ascolta la persona che lo usa, poi aiuta famiglie e team di cura a capire cosa richiede attenzione.",
    outcomes: [
      { title: "Per senior", body: "Una voce amica per promemoria, benessere, memoria e piani quotidiani." },
      { title: "Per famiglie", body: "Più tranquillità tra chiamate, visite e giornate piene." },
      { title: "Per team di cura", body: "Contesto più chiaro prima che piccoli temi diventino urgenti." },
    ],
    finalHeading: "Inizia con una conversazione che aiuta.",
    createAccount: "Crea account",
  },
  pt: {
    languageLabel: "Idioma",
    signIn: "Entrar",
    getStarted: "Começar",
    heroEyebrow: "Apoio de saúde e bem-estar",
    heroTitle: "Uma companhia que ouve, lembra e ajuda.",
    heroSubtitle: "Fale com a VYVA para check-ins de saúde, lembretes de medicação, exercícios de memória ou ajuda a planear o dia.",
    andMore: "E mais",
    productLive: "Ao vivo",
    productTalk: "Falar com a VYVA",
    productActions: ["A minha saúde", "A minha mente", "A minha comunidade", "O meu concierge"],
    heroFeatures: ["Check-ins de saúde", "Lembretes de medicação", "Exercícios de memória", "Planear o dia", "Atualizações familiares", "Ajuda prática"],
    careLoopHeading: "Um ritmo diário que ajuda a estar bem.",
    careLoopIntro: "A VYVA ouve primeiro e depois ajuda com pequenas rotinas para tornar cada dia mais simples e ligado.",
    careLoop: [
      { label: "Ouve", detail: "Uma voz calorosa inicia o check-in." },
      { label: "Lembra", detail: "Medicação, consultas, rotinas e planos ficam visíveis." },
      { label: "Nota", detail: "Mudanças de humor, sintomas ou rotinas falhadas tornam-se mais fáceis de identificar." },
      { label: "Partilha por escolha", detail: "As pessoas de confiança ouvem apenas o que escolher partilhar." },
    ],
    supportHeading: "Ajuda para os momentos que contam todos os dias.",
    supportIntro: "Da saúde e medicação à memória e tarefas práticas, a VYVA mantém apoio por perto sem tomar controlo.",
    supportMoments: [
      { title: "Check-ins de saúde", body: "Uma conversa simples pode registar como se sente e o que mudou." },
      { title: "Lembretes de medicação", body: "Avisos suaves ajudam a confirmar o que foi tomado e quando." },
      { title: "Memória e calma", body: "Exercícios curtos, histórias, música e conversa ajudam a manter a mente ativa." },
      { title: "Planear o dia", body: "A VYVA pode ajudar com consultas, recados e próximos passos." },
    ],
    featuresHeading: "Tudo se liga à volta do seu dia.",
    featuresIntro: "A VYVA junta saúde, medicação, atividades mentais, atualizações familiares, comunidade e ajuda concierge numa experiência calma.",
    features: [
      { title: "Check-ins de saúde", body: "Fale sobre sintomas, bem-estar, médicos e contexto de saúde quando precisar de apoio." },
      { title: "Lembretes de medicação", body: "Configure lembretes, confirme doses e torne as rotinas mais fáceis de seguir." },
      { title: "Check-ins diários por voz", body: "Conversas naturais por telefone, app ou canais familiares." },
      { title: "Guia de sintomas", body: "Responda a perguntas estruturadas quando não se sente bem." },
      { title: "Companhia", body: "Conversa, tranquilidade e apoio diário sempre disponíveis." },
      { title: "Apoio de segurança", body: "Sinais urgentes, burlas, privacidade e consentimento ficam visíveis." },
      { title: "Exercícios de memória", body: "Jogos de memória, histórias, música e atividades mentais suaves." },
      { title: "Ajuda concierge", body: "Reservas, recados, apoio local e tarefas práticas." },
      { title: "Atualizações familiares", body: "Pessoas de confiança ficam informadas sem tomar controlo." },
    ],
    valuesHeading: "Apoio privado, partilhado só por escolha.",
    valuesIntro: "A VYVA ajuda sem tomar controlo: privada por defeito, guiada pelo consentimento e construída à volta de pessoas de confiança.",
    values: ["Criada para a independência", "Lembretes sem pressão", "Pessoas de confiança mais perto", "Privacidade e consentimento primeiro"],
    caregiverHeading: "Primeiro apoio para seniores, também tranquilidade para famílias.",
    caregiverIntro: "A VYVA ouve a pessoa que a usa e ajuda famílias e equipas de cuidado a entender o que precisa de atenção.",
    outcomes: [
      { title: "Para seniores", body: "Uma voz amiga para lembretes, bem-estar, memória e planos diários." },
      { title: "Para famílias", body: "Mais tranquilidade entre chamadas, visitas e dias ocupados." },
      { title: "Para equipas de cuidado", body: "Contexto mais claro antes de pequenos temas se tornarem urgentes." },
    ],
    finalHeading: "Comece com uma conversa que ajuda.",
    createAccount: "Criar conta",
  },
  cy: {
    languageLabel: "Language",
    signIn: "Sign in",
    getStarted: "Get started",
    heroEyebrow: "Health and wellness support",
    heroTitle: "A companion that listens, reminds, and helps.",
    heroSubtitle: "Talk to VYVA for health check-ins, medication reminders, memory exercises, or help planning your day.",
    andMore: "And more",
    productLive: "Live",
    productTalk: "Talk to VYVA",
    productActions: ["My Health", "My Mind", "My Community", "My Concierge"],
    heroFeatures: ["Health check-ins", "Medication reminders", "Memory exercises", "Daily planning", "Family updates", "Practical help"],
    careLoopHeading: "A daily rhythm that helps you stay well.",
    careLoopIntro: "VYVA listens first, then helps with the small routines that make each day feel easier and more connected.",
    careLoop: [
      { label: "Listens", detail: "A warm voice starts the check-in." },
      { label: "Reminds", detail: "Medication, appointments, routines, and plans stay visible." },
      { label: "Notices", detail: "Changes in mood, symptoms, or missed routines are easier to spot." },
      { label: "Shares by choice", detail: "Trusted people hear only what you choose to share." },
    ],
    supportHeading: "Help for the moments that matter every day.",
    supportIntro: "From health and medication to memory and practical tasks, VYVA keeps support close without taking over.",
    supportMoments: [
      { title: "Health check-ins", body: "A simple conversation can capture how you feel and what changed." },
      { title: "Medication reminders", body: "Gentle prompts help confirm what was taken and when." },
      { title: "Memory and calm", body: "Short exercises, stories, music, and conversation help keep the mind active." },
      { title: "Planning the day", body: "VYVA can help with appointments, errands, and next steps." },
    ],
    featuresHeading: "Everything connects around your day.",
    featuresIntro: "VYVA brings together health, medication, mind activities, family updates, community, and concierge help in one calm experience.",
    features: [
      { title: "Health check-ins", body: "Talk through symptoms, wellbeing, providers, and health context when you need support." },
      { title: "Medication reminders", body: "Set reminders, confirm doses, and keep routines easier to follow." },
      { title: "Daily voice check-ins", body: "Natural check-ins by phone, app, or familiar channels." },
      { title: "Symptom guidance", body: "Answer structured questions when you do not feel well." },
      { title: "Companionship", body: "Always-available conversation, reassurance, and daily engagement." },
      { title: "Safety support", body: "Urgent signals, scam awareness, privacy, and consent stay visible." },
      { title: "Memory exercises", body: "Memory games, stories, music, and gentle brain activities." },
      { title: "Concierge help", body: "Bookings, errands, local support, and practical tasks." },
      { title: "Family updates", body: "Trusted people stay informed without taking over." },
    ],
    valuesHeading: "Private support, shared only by choice.",
    valuesIntro: "VYVA helps without taking over: private by default, consent-led, and built around the people you trust.",
    values: ["Built for independence", "Reminders without pressure", "Trusted people closer", "Privacy and consent first"],
    caregiverHeading: "Support for seniors first, reassurance for families too.",
    caregiverIntro: "VYVA listens to the person using it, then helps families and care teams understand what needs attention.",
    outcomes: [
      { title: "For seniors", body: "A friendly voice for reminders, wellbeing, memory, and daily plans." },
      { title: "For families", body: "More reassurance between calls, visits, and busy days." },
      { title: "For care teams", body: "Clearer context before small issues become urgent." },
    ],
    finalHeading: "Start with a conversation that helps.",
    createAccount: "Create your account",
  },
};

function ProductPreview({ copy }: { copy: Pick<(typeof LANDING_COPY)["en"], "productLive" | "productTalk" | "productActions"> }) {
  const quickActions = [
    { icon: HeartPulse, label: copy.productActions[0], tone: "bg-[#FCE7F3] text-[#BE185D]" },
    { icon: Brain, label: copy.productActions[1], tone: "bg-[#E0F2FE] text-[#0369A1]" },
    { icon: MessageCircleHeart, label: copy.productActions[2], tone: "bg-[#F3E8FF] text-[#7E22CE]" },
    { icon: ConciergeBell, label: copy.productActions[3], tone: "bg-[#DCFCE7] text-[#15803D]" },
  ];

  return (
    <section
      aria-label="VYVA product preview"
      className="relative mx-auto w-full max-w-[410px] rounded-[42px] border border-[#E8DDD2] bg-white p-4 shadow-[0_28px_70px_rgba(79,43,116,0.18)]"
    >
      <div className="h-1.5 w-16 rounded-full bg-[#D8C9BB] mx-auto" />
      <div className="mt-4 overflow-hidden rounded-[32px] bg-[#FBF5EF] p-4">
        <div className="flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8253AB] font-body text-sm font-black text-white shadow-[0_10px_24px_rgba(130,83,171,0.26)]">
            V
          </span>
          <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-xs font-black text-[#047857]">
            {copy.productLive}
          </span>
        </div>

        <div className="landing-voice-card mt-5 rounded-[30px] p-6 text-center text-white shadow-[0_22px_44px_rgba(130,83,171,0.28)]">
          <div className="relative mx-auto h-32 w-32" aria-hidden="true">
            <span className="landing-mic-ring absolute inset-0 rounded-full bg-white/20" />
            <span className="landing-mic-ring landing-mic-ring-delay absolute inset-3 rounded-full border border-white/35" />
            <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white shadow-[0_18px_36px_rgba(47,24,63,0.22)]">
              <div className="landing-mic-core relative flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F0FF] text-[#8253AB]">
                <Mic2 className="h-9 w-9" />
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#FFDF61] shadow-[0_0_0_4px_rgba(255,223,97,0.24)]" />
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-end justify-center gap-2" aria-hidden="true">
            {[18, 30, 46, 60, 46, 30, 18].map((height, index) => (
              <span
                key={index}
                className="landing-wave-bar w-2.5 rounded-full bg-[#FFDF61]"
                style={{ height, animationDelay: `${index * 0.11}s` }}
              />
            ))}
          </div>
          <p className="mt-5 font-body text-xl font-black">{copy.productTalk}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl bg-white p-3 shadow-[0_10px_28px_rgba(76,46,22,0.06)]">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="mt-2 font-body text-xs font-black text-[#2F183F]">{item.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { language, setLanguage, languages } = useLanguage();
  const copy = LANDING_COPY[language] ?? LANDING_COPY.en;
  const localizedCareLoop = careLoop.map((item, index) => ({ ...item, ...copy.careLoop[index] }));
  const localizedSupportMoments = supportMoments.map((item, index) => ({ ...item, ...copy.supportMoments[index] }));
  const localizedFullFeatureSet = fullFeatureSet.map((item, index) => ({ ...item, ...copy.features[index] }));
  const localizedHeroFeatureSet = copy.heroFeatures.map((title, index) => ({
    ...localizedFullFeatureSet[index],
    title,
  }));
  const localizedOutcomeCards = outcomeCards.map((item, index) => ({ ...item, ...copy.outcomes[index] }));

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#FAF7F2] text-[#2F183F]" data-testid="landing-page">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" aria-label="VYVA home" className="inline-flex items-center">
          <VyvaWordmark className="h-auto w-[118px] sm:w-[142px]" />
        </Link>
        <div className="flex items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 rounded-full border border-[#E8DDF3] bg-white/88 px-3 py-2 shadow-[0_12px_32px_rgba(77,45,20,0.08)] backdrop-blur">
            <Globe2 className="h-4 w-4 shrink-0 text-vyva-purple" aria-hidden="true" />
            <span className="sr-only">{copy.languageLabel}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label={copy.languageLabel}
              className="max-w-[96px] bg-transparent font-body text-sm font-extrabold text-vyva-purple outline-none sm:max-w-none"
              data-testid="select-landing-language"
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            to="/login?mode=login"
            className="hidden min-h-11 items-center justify-center rounded-full px-4 font-body text-sm font-bold text-[#4B3C36] transition hover:bg-white sm:inline-flex"
          >
            {copy.signIn}
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-vyva-purple px-4 font-body text-sm font-bold text-white shadow-[0_14px_34px_rgba(107,33,168,0.28)] transition hover:bg-[#5F1E97] sm:px-5"
          >
            {copy.getStarted}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-8 px-5 pb-14 pt-5 sm:px-8 md:min-h-[calc(100svh-92px)] lg:grid-cols-[minmax(0,0.94fr)_minmax(390px,0.76fr)] lg:gap-10 lg:px-10 lg:pb-20 lg:pt-8">
        <div className="max-w-3xl lg:col-start-1 lg:row-start-1">
          <div className="mb-5 h-1.5 w-24 rounded-full bg-[#FFDF61]" />
          <p className="mb-3 font-body text-sm font-black uppercase text-[#8253AB]">
            {copy.heroEyebrow}
          </p>
          <h1 className="max-w-[820px] font-body text-[2.7rem] font-black leading-[1] text-[#8253AB] sm:text-[4.1rem] lg:text-[5rem]">
            {copy.heroTitle}
          </h1>
          <p className="mt-6 max-w-2xl font-body text-lg leading-8 text-[#5F5768] sm:text-xl sm:leading-9">
            {copy.heroSubtitle}
          </p>
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <ProductPreview copy={copy} />
        </div>
        <div className="max-w-3xl lg:col-start-1 lg:row-start-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {localizedHeroFeatureSet.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex min-h-10 items-center gap-2 rounded-2xl bg-white/86 px-2.5 py-2 font-body text-[12px] font-black leading-tight text-[#2F183F] shadow-[0_10px_28px_rgba(76,46,22,0.06)] sm:px-3 sm:text-sm">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {item.title}
                </div>
              );
            })}
          </div>
          <a
            href="#features"
            className="mt-6 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-[#FFDF61] px-5 font-body text-sm font-black text-[#3B2600] shadow-[0_12px_28px_rgba(255,223,97,0.22)] transition hover:bg-[#F7D94E]"
          >
            {copy.andMore}
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section id="loop" className="bg-[#8253AB] py-14 text-white sm:py-16">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-end">
            <div>
              <div className="mb-5 h-1.5 w-20 rounded-full bg-[#FFDF61]" />
            <h2 className="font-body text-4xl font-black leading-tight sm:text-5xl">{copy.careLoopHeading}</h2>
            </div>
            <p className="max-w-2xl font-body text-lg leading-8 text-[#F1E9F8]">
              {copy.careLoopIntro}
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {localizedCareLoop.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-[24px] border border-white/14 bg-white/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#8253AB]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="font-body text-sm font-black text-[#FFDF61]">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 font-body text-xl font-black">{item.label}</h3>
                  <p className="mt-2 font-body text-sm leading-6 text-[#F1E9F8]">{item.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="support" className="bg-white py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[0.72fr_1fr] lg:px-10">
          <div>
            <div className="mb-5 h-1.5 w-20 rounded-full bg-[#FFDF61]" />
            <h2 className="font-body text-4xl font-black leading-tight text-[#8253AB] sm:text-5xl">
              {copy.supportHeading}
            </h2>
            <p className="mt-5 max-w-xl font-body text-lg leading-8 text-[#5F5768]">
              {copy.supportIntro}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {localizedSupportMoments.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[26px] border border-[#EDE2D8] bg-[#FFF9F1] p-5 shadow-[0_12px_32px_rgba(76,46,22,0.07)]">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-body text-lg font-extrabold text-[#2F183F]">{item.title}</h3>
                  <p className="mt-2 font-body text-sm leading-6 text-[#6F6475]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#FAF7F2] py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-end">
            <div>
              <div className="mb-5 h-1.5 w-20 rounded-full bg-[#FFDF61]" />
              <h2 className="font-body text-4xl font-black leading-tight text-[#8253AB] sm:text-5xl">
                {copy.featuresHeading}
              </h2>
            </div>
            <p className="max-w-2xl font-body text-lg leading-8 text-[#5F5768]">
              {copy.featuresIntro}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {localizedFullFeatureSet.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[24px] border border-[#E7DDD4] bg-white p-5 shadow-[0_12px_32px_rgba(76,46,22,0.06)]">
                  <div className="flex items-start gap-4">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-body text-lg font-black text-[#2F183F]">{item.title}</h3>
                      <p className="mt-1 font-body text-sm leading-6 text-[#6F6475]">{item.body}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="values" className="bg-[#2F183F] py-16 text-white sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.92fr_1fr] lg:px-10">
          <div>
            <div className="mb-5 h-1.5 w-20 rounded-full bg-[#FFDF61]" />
            <h2 className="font-body text-4xl font-black leading-tight sm:text-5xl">{copy.valuesHeading}</h2>
            <p className="mt-5 max-w-xl font-body text-lg leading-8 text-[#EBDFF3]">
              {copy.valuesIntro}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {copy.values.map((value) => (
              <div key={value} className="flex min-h-[92px] items-center gap-4 rounded-[24px] border border-white/14 bg-white/8 px-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F8D37A] text-[#3B2600]">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="font-body text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="caregivers" className="bg-[#F8F4EF] py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_0.82fr] lg:px-10">
          <div className="rounded-[30px] border border-[#E7DDD4] bg-white p-6 shadow-[0_16px_46px_rgba(76,46,22,0.08)] sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3E8FF] text-[#8253AB]">
                <HeartHandshake className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-body text-4xl font-black leading-tight text-[#8253AB]">{copy.caregiverHeading}</h2>
                <p className="mt-4 font-body text-lg leading-8 text-[#5F5768]">
                  {copy.caregiverIntro}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {localizedOutcomeCards.map((item) => {
              const Icon = item.icon;
              return (
              <article key={item.title} className="rounded-[24px] border border-[#E7DDD4] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(76,46,22,0.06)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF2B8] text-[#8253AB]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-body text-lg font-bold text-[#2F183F]">{item.title}</h3>
                    <p className="mt-1 font-body text-base leading-7 text-[#7C6B63]">{item.body}</p>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8 sm:py-18">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <MessageCircleHeart className="h-10 w-10 text-vyva-purple" aria-hidden="true" />
          <h2 className="mt-4 max-w-3xl font-body text-4xl font-black leading-tight text-[#8253AB] sm:text-5xl">
            {copy.finalHeading}
          </h2>
          <Link
            to="/login"
            className="mt-8 inline-flex min-h-[56px] items-center justify-center gap-3 rounded-full bg-vyva-purple px-7 font-body text-base font-bold text-white shadow-[0_18px_42px_rgba(107,33,168,0.28)] transition hover:bg-[#5F1E97]"
          >
            {copy.createAccount}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
