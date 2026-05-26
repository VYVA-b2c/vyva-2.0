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
  Siren,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useLanguage } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";

const careLoop = [
  { icon: Mic2, label: "Checks in", detail: "A familiar voice starts your daily touchpoint." },
  { icon: CheckCircle2, label: "Helps confirm", detail: "Medication, mood, symptoms, and routines." },
  { icon: Activity, label: "Notices change", detail: "Missed routines and concerns become visible." },
  { icon: UsersRound, label: "Shares by choice", detail: "Trusted people know what you want them to know." },
];

const supportMoments = [
  {
    icon: Pill,
    title: "Medication confirmation",
    body: "Not just a reminder. A clear yes, no, or needs help.",
    tone: "bg-[#EEF2FF] text-[#4F46E5]",
  },
  {
    icon: Mic2,
    title: "Daily voice check-ins",
    body: "A simple call that can surface mood, symptoms, and risk.",
    tone: "bg-[#F3E8FF] text-[#7E22CE]",
  },
  {
    icon: Siren,
    title: "Safety signals",
    body: "When something feels off, the care circle gets context sooner.",
    tone: "bg-[#FEE2E2] text-[#B91C1C]",
  },
  {
    icon: Brain,
    title: "Engagement",
    body: "Stories, music, memory games, and reasons to stay connected.",
    tone: "bg-[#FEF3C7] text-[#B7791F]",
  },
];

const fullFeatureSet = [
  {
    icon: HeartPulse,
    title: "Telehealth Support",
    body: "Health context, providers, emergency details, and clearer remote consultations.",
    tone: "bg-[#FCE7F3] text-[#BE185D]",
  },
  {
    icon: Pill,
    title: "Medication Management",
    body: "Reminders, confirmations, routines, and adherence context.",
    tone: "bg-[#EEF2FF] text-[#4F46E5]",
  },
  {
    icon: Mic2,
    title: "Daily Voice Check-ins",
    body: "Natural check-ins by phone, app, or familiar channels.",
    tone: "bg-[#F3E8FF] text-[#7E22CE]",
  },
  {
    icon: Stethoscope,
    title: "Symptom Checking",
    body: "Structured questions when someone does not feel well.",
    tone: "bg-[#ECFDF5] text-[#047857]",
  },
  {
    icon: FileText,
    title: "24/7 Companionship",
    body: "Always-available support for conversation, reassurance, and daily engagement.",
    tone: "bg-[#FEF3C7] text-[#B7791F]",
  },
  {
    icon: ShieldCheck,
    title: "Safety Protocols",
    body: "Fall context, urgent signals, scam awareness, privacy, and consent.",
    tone: "bg-[#FEE2E2] text-[#B91C1C]",
  },
  {
    icon: Brain,
    title: "Brain Coach",
    body: "Memory games, stories, music, quizzes, and gentle engagement.",
    tone: "bg-[#E0F2FE] text-[#0369A1]",
  },
  {
    icon: MapPin,
    title: "Concierge Help",
    body: "Local support, useful places, services, and everyday assistance.",
    tone: "bg-[#DCFCE7] text-[#15803D]",
  },
  {
    icon: UsersRound,
    title: "Family Dashboard",
    body: "Trusted people stay informed without taking over.",
    tone: "bg-[#FAE8FF] text-[#A21CAF]",
  },
];

const outcomeCards = [
  {
    icon: HeartHandshake,
    title: "For seniors",
    body: "A friendly voice, practical reminders, and support that feels human.",
  },
  {
    icon: UsersRound,
    title: "For families",
    body: "More confidence between calls, visits, and busy days.",
  },
  {
    icon: ShieldCheck,
    title: "For care teams",
    body: "Better context before small issues turn into emergencies.",
  },
];

const LANDING_COPY: Record<LanguageCode, {
  languageLabel: string;
  signIn: string;
  getStarted: string;
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
    heroTitle: "Your AI companion for life.",
    heroSubtitle: "One friendly companion for health, medication, mind, social connection, and practical help, day or night.",
    andMore: "And more",
    productLive: "Live",
    productTalk: "Talk to VYVA",
    productActions: ["My Health", "My Mind", "My Community", "My Concierge"],
    heroFeatures: ["Telehealth Support", "Medication Management", "Voice Check-ins", "Symptom Checking", "24/7 Companionship", "Safety Protocols", "Brain Coach", "Concierge Help", "Family Dashboard"],
    careLoopHeading: "A care loop that never goes quiet.",
    careLoopIntro: "Every call helps you stay on top of routines, notice changes, and keep trusted people informed by choice.",
    careLoop: [
      { label: "Checks in", detail: "A familiar voice starts your daily touchpoint." },
      { label: "Helps confirm", detail: "Medication, mood, symptoms, and routines." },
      { label: "Notices change", detail: "Missed routines and concerns become visible." },
      { label: "Shares by choice", detail: "Trusted people know what you want them to know." },
    ],
    supportHeading: "Stay independent with support close by.",
    supportIntro: "VYVA makes health routines, reminders, safety context, and family updates easier to manage day to day.",
    supportMoments: [
      { title: "Medication confirmation", body: "Not just a reminder. A clear yes, no, or needs help." },
      { title: "Daily voice check-ins", body: "A simple call that can surface mood, symptoms, and risk." },
      { title: "Safety signals", body: "When something feels off, the care circle gets context sooner." },
      { title: "Engagement", body: "Stories, music, memory games, and reasons to stay connected." },
    ],
    featuresHeading: "One companion. Many ways to help.",
    featuresIntro: "VYVA connects the daily pieces of care: health, medication, safety, engagement, family updates, and practical help.",
    features: [
      { title: "Telehealth Support", body: "Health context, providers, emergency details, and clearer remote consultations." },
      { title: "Medication Management", body: "Reminders, confirmations, routines, and adherence context." },
      { title: "Daily Voice Check-ins", body: "Natural check-ins by phone, app, or familiar channels." },
      { title: "Symptom Checking", body: "Structured questions when someone does not feel well." },
      { title: "24/7 Companionship", body: "Always-available support for conversation, reassurance, and daily engagement." },
      { title: "Safety Protocols", body: "Fall context, urgent signals, scam awareness, privacy, and consent." },
      { title: "Brain Coach", body: "Memory games, stories, music, quizzes, and gentle engagement." },
      { title: "Concierge Help", body: "Local support, useful places, services, and everyday assistance." },
      { title: "Family Dashboard", body: "Trusted people stay informed without taking over." },
    ],
    valuesHeading: "Your support stays yours.",
    valuesIntro: "VYVA helps without taking over: private by default, consent-led, and built around the people you trust.",
    values: ["Supports independence", "Keeps routines easier", "Brings trusted people closer", "Protects privacy and consent"],
    caregiverHeading: "A companion for the parts of care that happen every day.",
    caregiverIntro: "Warm enough to feel personal. Practical enough to help with routines, health context, and follow-through.",
    outcomes: [
      { title: "For seniors", body: "A friendly voice, practical reminders, and support that feels human." },
      { title: "For families", body: "More confidence between calls, visits, and busy days." },
      { title: "For care teams", body: "Better context before small issues turn into emergencies." },
    ],
    finalHeading: "Start with one daily check-in.",
    createAccount: "Create your account",
  },
  es: {
    languageLabel: "Idioma",
    signIn: "Entrar",
    getStarted: "Empezar",
    heroTitle: "Tu companero de IA para la vida.",
    heroSubtitle: "Un companero cercano para salud, medicacion, mente, vida social y ayuda practica, de dia o de noche.",
    andMore: "Y mas",
    productLive: "En vivo",
    productTalk: "Hablar con VYVA",
    productActions: ["Mi salud", "Mi mente", "Mi comunidad", "Mi conserje"],
    heroFeatures: ["Telehealth", "Gestion de medicacion", "Check-ins por voz", "Revision de sintomas", "Compania 24/7", "Protocolos de seguridad", "Coach mental", "Concierge", "Panel familiar"],
    careLoopHeading: "Un circulo de cuidado que no se apaga.",
    careLoopIntro: "Cada llamada ayuda a seguir rutinas, notar cambios y mantener informadas a las personas de confianza.",
    careLoop: [
      { label: "Pregunta", detail: "Una voz familiar inicia el contacto diario." },
      { label: "Ayuda a confirmar", detail: "Medicacion, animo, sintomas y rutinas." },
      { label: "Detecta cambios", detail: "Rutinas perdidas y preocupaciones se vuelven visibles." },
      { label: "Comparte con permiso", detail: "Las personas de confianza saben lo que quieres compartir." },
    ],
    supportHeading: "Independencia con apoyo cerca.",
    supportIntro: "VYVA facilita gestionar rutinas de salud, recordatorios, seguridad y actualizaciones familiares.",
    supportMoments: [
      { title: "Confirmacion de medicacion", body: "No solo un recordatorio. Un si, no o necesito ayuda." },
      { title: "Check-ins diarios por voz", body: "Una llamada sencilla que puede detectar animo, sintomas y riesgo." },
      { title: "Senales de seguridad", body: "Cuando algo cambia, el circulo de cuidado recibe contexto antes." },
      { title: "Participacion", body: "Historias, musica, juegos de memoria y motivos para conectar." },
    ],
    featuresHeading: "Un companero. Muchas formas de ayudar.",
    featuresIntro: "VYVA conecta las piezas diarias del cuidado: salud, medicacion, seguridad, actividad, familia y ayuda practica.",
    features: [
      { title: "Soporte telehealth", body: "Contexto de salud, medicos, datos de emergencia y consultas remotas mas claras." },
      { title: "Gestion de medicacion", body: "Recordatorios, confirmaciones, rutinas y contexto de adherencia." },
      { title: "Check-ins por voz", body: "Conversaciones naturales por telefono, app o canales familiares." },
      { title: "Revision de sintomas", body: "Preguntas estructuradas cuando alguien no se siente bien." },
      { title: "Compania 24/7", body: "Apoyo siempre disponible para conversar, tranquilizar y acompanhar cada dia." },
      { title: "Protocolos de seguridad", body: "Caidas, senales urgentes, estafas, privacidad y consentimiento." },
      { title: "Coach mental", body: "Juegos de memoria, historias, musica, quizzes y actividad suave." },
      { title: "Concierge", body: "Apoyo local, lugares utiles, servicios y ayuda cotidiana." },
      { title: "Panel familiar", body: "Las personas de confianza se mantienen informadas sin invadir." },
    ],
    valuesHeading: "Tu apoyo sigue siendo tuyo.",
    valuesIntro: "VYVA ayuda sin tomar el control: privado por defecto, con consentimiento y alrededor de tu gente de confianza.",
    values: ["Apoya la independencia", "Facilita las rutinas", "Acerca a la gente de confianza", "Protege privacidad y consentimiento"],
    caregiverHeading: "Un companero para el cuidado que pasa todos los dias.",
    caregiverIntro: "Cercano para sentirse personal. Practico para rutinas, salud y seguimiento.",
    outcomes: [
      { title: "Para mayores", body: "Una voz amable, recordatorios practicos y apoyo humano." },
      { title: "Para familias", body: "Mas tranquilidad entre llamadas, visitas y dias ocupados." },
      { title: "Para equipos de cuidado", body: "Mejor contexto antes de que algo pequeno se vuelva urgente." },
    ],
    finalHeading: "Empieza con un check-in diario.",
    createAccount: "Crear cuenta",
  },
  fr: {
    languageLabel: "Langue",
    signIn: "Connexion",
    getStarted: "Commencer",
    heroTitle: "Votre compagnon IA pour la vie.",
    heroSubtitle: "Un compagnon chaleureux pour la sante, les medicaments, le cerveau, le lien social et l'aide pratique, jour et nuit.",
    andMore: "Et plus",
    productLive: "En direct",
    productTalk: "Parler a VYVA",
    productActions: ["Ma sante", "Mon cerveau", "Ma communaute", "Ma conciergerie"],
    heroFeatures: ["Telehealth", "Gestion des medicaments", "Appels vocaux", "Verification des symptomes", "Compagnie 24/7", "Protocoles de securite", "Coach mental", "Concierge", "Tableau familial"],
    careLoopHeading: "Une boucle de soin qui ne s'eteint jamais.",
    careLoopIntro: "Chaque appel aide a suivre les routines, remarquer les changements et informer les personnes de confiance.",
    careLoop: [
      { label: "Prend contact", detail: "Une voix familiere lance le point quotidien." },
      { label: "Aide a confirmer", detail: "Medicaments, humeur, symptomes et routines." },
      { label: "Remarque les changements", detail: "Les routines manquees et les inquietudes deviennent visibles." },
      { label: "Partage avec accord", detail: "Les proches savent ce que vous choisissez de partager." },
    ],
    supportHeading: "Rester independant avec du soutien a proximite.",
    supportIntro: "VYVA facilite les routines de sante, les rappels, la securite et les nouvelles familiales.",
    supportMoments: [
      { title: "Confirmation des medicaments", body: "Pas seulement un rappel. Un oui, non ou besoin d'aide." },
      { title: "Appels vocaux quotidiens", body: "Un appel simple pour reperer humeur, symptomes et risque." },
      { title: "Signaux de securite", body: "Quand quelque chose change, le cercle de soin a du contexte plus tot." },
      { title: "Engagement", body: "Histoires, musique, jeux de memoire et raisons de rester connecte." },
    ],
    featuresHeading: "Un compagnon. Beaucoup de facons d'aider.",
    featuresIntro: "VYVA relie les pieces du quotidien: sante, medicaments, securite, engagement, famille et aide pratique.",
    features: [
      { title: "Support telehealth", body: "Contexte de sante, soignants, urgence et consultations a distance plus claires." },
      { title: "Gestion des medicaments", body: "Rappels, confirmations, routines et suivi de l'observance." },
      { title: "Appels vocaux quotidiens", body: "Echanges naturels par telephone, app ou canaux familiers." },
      { title: "Verification des symptomes", body: "Questions structurees quand quelqu'un ne se sent pas bien." },
      { title: "Compagnie 24/7", body: "Soutien toujours disponible pour parler, rassurer et accompagner." },
      { title: "Protocoles de securite", body: "Chutes, signaux urgents, arnaques, confidentialite et consentement." },
      { title: "Coach mental", body: "Jeux de memoire, histoires, musique, quiz et engagement doux." },
      { title: "Concierge", body: "Soutien local, lieux utiles, services et aide du quotidien." },
      { title: "Tableau familial", body: "Les proches restent informes sans prendre le controle." },
    ],
    valuesHeading: "Votre soutien reste le votre.",
    valuesIntro: "VYVA aide sans prendre la main: prive par defaut, avec consentement, autour des personnes de confiance.",
    values: ["Soutient l'independance", "Facilite les routines", "Rapproche les proches", "Protege confidentialite et consentement"],
    caregiverHeading: "Un compagnon pour les moments de soin du quotidien.",
    caregiverIntro: "Assez chaleureux pour sembler personnel. Assez pratique pour les routines et le suivi.",
    outcomes: [
      { title: "Pour les seniors", body: "Une voix amie, des rappels pratiques et un soutien humain." },
      { title: "Pour les familles", body: "Plus de confiance entre les appels, les visites et les journees chargees." },
      { title: "Pour les equipes de soin", body: "Plus de contexte avant qu'un petit sujet devienne urgent." },
    ],
    finalHeading: "Commencez par un check-in quotidien.",
    createAccount: "Creer votre compte",
  },
  de: {
    languageLabel: "Sprache",
    signIn: "Anmelden",
    getStarted: "Loslegen",
    heroTitle: "Ihr KI-Begleiter furs Leben.",
    heroSubtitle: "Ein freundlicher Begleiter fur Gesundheit, Medikamente, Geist, soziale Verbindung und praktische Hilfe, Tag und Nacht.",
    andMore: "Und mehr",
    productLive: "Live",
    productTalk: "Mit VYVA sprechen",
    productActions: ["Meine Gesundheit", "Mein Geist", "Meine Community", "Mein Concierge"],
    heroFeatures: ["Telehealth", "Medikamentenmanagement", "Sprach-Check-ins", "Symptomcheck", "24/7 Begleitung", "Sicherheitsprotokolle", "Mental Coach", "Concierge", "Familien-Dashboard"],
    careLoopHeading: "Ein Pflegekreislauf, der nie verstummt.",
    careLoopIntro: "Jeder Anruf hilft, Routinen zu verfolgen, Veranderungen zu bemerken und Vertrauenspersonen informiert zu halten.",
    careLoop: [
      { label: "Fragt nach", detail: "Eine vertraute Stimme startet den taglichen Kontakt." },
      { label: "Hilft zu bestatigen", detail: "Medikamente, Stimmung, Symptome und Routinen." },
      { label: "Bemerkt Veranderungen", detail: "Verpasste Routinen und Sorgen werden sichtbar." },
      { label: "Teilt nach Wunsch", detail: "Vertrauenspersonen wissen, was Sie teilen mochten." },
    ],
    supportHeading: "Selbstandig bleiben, mit Unterstutzung in der Nahe.",
    supportIntro: "VYVA erleichtert Gesundheitsroutinen, Erinnerungen, Sicherheitskontext und Familienupdates.",
    supportMoments: [
      { title: "Medikamentenbestatigung", body: "Nicht nur eine Erinnerung. Ein klares Ja, Nein oder brauche Hilfe." },
      { title: "Tagliche Sprach-Check-ins", body: "Ein einfacher Anruf kann Stimmung, Symptome und Risiken sichtbar machen." },
      { title: "Sicherheitssignale", body: "Wenn etwas anders ist, erhalt der Pflegekreis fruher Kontext." },
      { title: "Aktivierung", body: "Geschichten, Musik, Gedachtnisspiele und Grunde, verbunden zu bleiben." },
    ],
    featuresHeading: "Ein Begleiter. Viele Wege zu helfen.",
    featuresIntro: "VYVA verbindet die taglichen Teile der Pflege: Gesundheit, Medikamente, Sicherheit, Aktivierung, Familie und praktische Hilfe.",
    features: [
      { title: "Telehealth-Unterstutzung", body: "Gesundheitskontext, Anbieter, Notfalldetails und klarere Fernkonsultationen." },
      { title: "Medikamentenmanagement", body: "Erinnerungen, Bestatigungen, Routinen und Adharenzkontext." },
      { title: "Tagliche Sprach-Check-ins", body: "Naturliche Gesprache per Telefon, App oder vertrauten Kanalen." },
      { title: "Symptomcheck", body: "Strukturierte Fragen, wenn sich jemand nicht wohl fuhlt." },
      { title: "24/7 Begleitung", body: "Immer verfugbare Unterstutzung fur Gesprach, Beruhigung und Alltag." },
      { title: "Sicherheitsprotokolle", body: "Sturzkontext, dringende Signale, Betrugsbewusstsein, Datenschutz und Zustimmung." },
      { title: "Mental Coach", body: "Gedachtnisspiele, Geschichten, Musik, Quiz und sanfte Aktivierung." },
      { title: "Concierge-Hilfe", body: "Lokale Hilfe, nutzliche Orte, Services und Alltagsunterstutzung." },
      { title: "Familien-Dashboard", body: "Vertrauenspersonen bleiben informiert, ohne zu ubernehmen." },
    ],
    valuesHeading: "Ihre Unterstutzung bleibt Ihre.",
    valuesIntro: "VYVA hilft, ohne zu ubernehmen: privat voreingestellt, mit Zustimmung und rund um die Menschen Ihres Vertrauens.",
    values: ["Unterstutzt Selbstandigkeit", "Erleichtert Routinen", "Bringt Vertrauenspersonen naher", "Schutzt Datenschutz und Zustimmung"],
    caregiverHeading: "Ein Begleiter fur die Teile der Pflege, die jeden Tag passieren.",
    caregiverIntro: "Warm genug, um personlich zu wirken. Praktisch genug fur Routinen, Gesundheitskontext und Nachverfolgung.",
    outcomes: [
      { title: "Fur Senioren", body: "Eine freundliche Stimme, praktische Erinnerungen und menschliche Unterstutzung." },
      { title: "Fur Familien", body: "Mehr Vertrauen zwischen Anrufen, Besuchen und vollen Tagen." },
      { title: "Fur Pflegeteams", body: "Besserer Kontext, bevor kleine Themen dringend werden." },
    ],
    finalHeading: "Beginnen Sie mit einem taglichen Check-in.",
    createAccount: "Konto erstellen",
  },
  it: {
    languageLabel: "Lingua",
    signIn: "Accedi",
    getStarted: "Inizia",
    heroTitle: "Il tuo compagno IA per la vita.",
    heroSubtitle: "Un compagno gentile per salute, farmaci, mente, socialita e aiuto pratico, giorno e notte.",
    andMore: "E altro",
    productLive: "Live",
    productTalk: "Parla con VYVA",
    productActions: ["La mia salute", "La mia mente", "La mia comunita", "Il mio concierge"],
    heroFeatures: ["Telehealth", "Gestione farmaci", "Check-in vocali", "Controllo sintomi", "Compagnia 24/7", "Protocolli sicurezza", "Brain Coach", "Concierge", "Dashboard famiglia"],
    careLoopHeading: "Un ciclo di cura che non si ferma.",
    careLoopIntro: "Ogni chiamata aiuta a seguire le routine, notare cambiamenti e informare le persone fidate.",
    careLoop: [
      { label: "Fa check-in", detail: "Una voce familiare apre il contatto quotidiano." },
      { label: "Aiuta a confermare", detail: "Farmaci, umore, sintomi e routine." },
      { label: "Nota cambiamenti", detail: "Routine mancate e preoccupazioni diventano visibili." },
      { label: "Condivide per scelta", detail: "Le persone fidate sanno cio che vuoi condividere." },
    ],
    supportHeading: "Indipendenza con supporto vicino.",
    supportIntro: "VYVA semplifica routine di salute, promemoria, sicurezza e aggiornamenti familiari.",
    supportMoments: [
      { title: "Conferma farmaci", body: "Non solo un promemoria. Un chiaro si, no o serve aiuto." },
      { title: "Check-in vocali quotidiani", body: "Una chiamata semplice puo rilevare umore, sintomi e rischio." },
      { title: "Segnali di sicurezza", body: "Quando qualcosa cambia, il cerchio di cura riceve contesto prima." },
      { title: "Coinvolgimento", body: "Storie, musica, giochi di memoria e motivi per restare connessi." },
    ],
    featuresHeading: "Un compagno. Molti modi per aiutare.",
    featuresIntro: "VYVA collega i pezzi quotidiani della cura: salute, farmaci, sicurezza, coinvolgimento, famiglia e aiuto pratico.",
    features: [
      { title: "Supporto telehealth", body: "Contesto salute, medici, dettagli di emergenza e consulti remoti piu chiari." },
      { title: "Gestione farmaci", body: "Promemoria, conferme, routine e contesto di aderenza." },
      { title: "Check-in vocali quotidiani", body: "Conversazioni naturali via telefono, app o canali familiari." },
      { title: "Controllo sintomi", body: "Domande strutturate quando qualcuno non si sente bene." },
      { title: "Compagnia 24/7", body: "Supporto sempre disponibile per conversazione, rassicurazione e quotidianita." },
      { title: "Protocolli sicurezza", body: "Cadute, segnali urgenti, truffe, privacy e consenso." },
      { title: "Brain Coach", body: "Giochi di memoria, storie, musica, quiz e coinvolgimento gentile." },
      { title: "Concierge", body: "Supporto locale, luoghi utili, servizi e aiuto quotidiano." },
      { title: "Dashboard famiglia", body: "Le persone fidate restano informate senza prendere il controllo." },
    ],
    valuesHeading: "Il supporto resta tuo.",
    valuesIntro: "VYVA aiuta senza prendere il controllo: privato di default, basato sul consenso e sulle persone fidate.",
    values: ["Sostiene l'indipendenza", "Rende piu semplici le routine", "Avvicina le persone fidate", "Protegge privacy e consenso"],
    caregiverHeading: "Un compagno per le parti di cura che accadono ogni giorno.",
    caregiverIntro: "Abbastanza caldo da sembrare personale. Abbastanza pratico per routine, salute e follow-through.",
    outcomes: [
      { title: "Per senior", body: "Una voce amica, promemoria pratici e supporto umano." },
      { title: "Per famiglie", body: "Piu fiducia tra chiamate, visite e giornate piene." },
      { title: "Per team di cura", body: "Miglior contesto prima che piccoli problemi diventino emergenze." },
    ],
    finalHeading: "Inizia con un check-in quotidiano.",
    createAccount: "Crea account",
  },
  pt: {
    languageLabel: "Idioma",
    signIn: "Entrar",
    getStarted: "Comecar",
    heroTitle: "O seu companheiro de IA para a vida.",
    heroSubtitle: "Um companheiro proximo para saude, medicacao, mente, ligacao social e ajuda pratica, dia e noite.",
    andMore: "E mais",
    productLive: "Ao vivo",
    productTalk: "Falar com a VYVA",
    productActions: ["A minha saude", "A minha mente", "A minha comunidade", "O meu concierge"],
    heroFeatures: ["Telehealth", "Gestao da medicacao", "Check-ins por voz", "Verificacao de sintomas", "Companhia 24/7", "Protocolos de seguranca", "Coach mental", "Concierge", "Painel familiar"],
    careLoopHeading: "Um ciclo de cuidado que nunca se cala.",
    careLoopIntro: "Cada chamada ajuda a seguir rotinas, notar mudancas e manter pessoas de confianca informadas.",
    careLoop: [
      { label: "Faz check-in", detail: "Uma voz familiar inicia o contacto diario." },
      { label: "Ajuda a confirmar", detail: "Medicacao, humor, sintomas e rotinas." },
      { label: "Nota mudancas", detail: "Rotinas falhadas e preocupacoes tornam-se visiveis." },
      { label: "Partilha por escolha", detail: "As pessoas de confianca sabem o que quer partilhar." },
    ],
    supportHeading: "Independencia com apoio por perto.",
    supportIntro: "A VYVA facilita rotinas de saude, lembretes, seguranca e atualizacoes familiares.",
    supportMoments: [
      { title: "Confirmacao da medicacao", body: "Nao e so um lembrete. Um sim, nao ou preciso de ajuda." },
      { title: "Check-ins diarios por voz", body: "Uma chamada simples pode revelar humor, sintomas e risco." },
      { title: "Sinais de seguranca", body: "Quando algo muda, o circulo de cuidado recebe contexto mais cedo." },
      { title: "Envolvimento", body: "Historias, musica, jogos de memoria e motivos para manter ligacao." },
    ],
    featuresHeading: "Um companheiro. Muitas formas de ajudar.",
    featuresIntro: "A VYVA liga as pecas diarias do cuidado: saude, medicacao, seguranca, envolvimento, familia e ajuda pratica.",
    features: [
      { title: "Apoio telehealth", body: "Contexto de saude, prestadores, emergencia e consultas remotas mais claras." },
      { title: "Gestao da medicacao", body: "Lembretes, confirmacoes, rotinas e contexto de adesao." },
      { title: "Check-ins diarios por voz", body: "Conversas naturais por telefone, app ou canais familiares." },
      { title: "Verificacao de sintomas", body: "Perguntas estruturadas quando alguem nao se sente bem." },
      { title: "Companhia 24/7", body: "Apoio sempre disponivel para conversa, tranquilidade e envolvimento diario." },
      { title: "Protocolos de seguranca", body: "Quedas, sinais urgentes, burlas, privacidade e consentimento." },
      { title: "Coach mental", body: "Jogos de memoria, historias, musica, quizzes e envolvimento suave." },
      { title: "Concierge", body: "Apoio local, locais uteis, servicos e ajuda do dia a dia." },
      { title: "Painel familiar", body: "Pessoas de confianca ficam informadas sem tomar controlo." },
    ],
    valuesHeading: "O apoio continua a ser seu.",
    valuesIntro: "A VYVA ajuda sem tomar controlo: privada por defeito, com consentimento e em torno das pessoas em quem confia.",
    values: ["Apoia a independencia", "Facilita rotinas", "Aproxima pessoas de confianca", "Protege privacidade e consentimento"],
    caregiverHeading: "Um companheiro para as partes do cuidado que acontecem todos os dias.",
    caregiverIntro: "Proximo o suficiente para parecer pessoal. Pratico para rotinas, saude e acompanhamento.",
    outcomes: [
      { title: "Para seniores", body: "Uma voz amiga, lembretes praticos e apoio humano." },
      { title: "Para familias", body: "Mais confianca entre chamadas, visitas e dias ocupados." },
      { title: "Para equipas de cuidado", body: "Melhor contexto antes de pequenos temas virarem urgencias." },
    ],
    finalHeading: "Comece com um check-in diario.",
    createAccount: "Criar conta",
  },
  cy: {
    languageLabel: "Language",
    signIn: "Sign in",
    getStarted: "Get started",
    heroTitle: "Your AI companion for life.",
    heroSubtitle: "One friendly companion for health, medication, mind, social connection, and practical help, day or night.",
    andMore: "And more",
    productLive: "Live",
    productTalk: "Talk to VYVA",
    productActions: ["My Health", "My Mind", "My Community", "My Concierge"],
    heroFeatures: ["Telehealth Support", "Medication Management", "Voice Check-ins", "Symptom Checking", "24/7 Companionship", "Safety Protocols", "Brain Coach", "Concierge Help", "Family Dashboard"],
    careLoopHeading: "A care loop that never goes quiet.",
    careLoopIntro: "Every call helps you stay on top of routines, notice changes, and keep trusted people informed by choice.",
    careLoop: [
      { label: "Checks in", detail: "A familiar voice starts your daily touchpoint." },
      { label: "Helps confirm", detail: "Medication, mood, symptoms, and routines." },
      { label: "Notices change", detail: "Missed routines and concerns become visible." },
      { label: "Shares by choice", detail: "Trusted people know what you want them to know." },
    ],
    supportHeading: "Stay independent with support close by.",
    supportIntro: "VYVA makes health routines, reminders, safety context, and family updates easier to manage day to day.",
    supportMoments: [
      { title: "Medication confirmation", body: "Not just a reminder. A clear yes, no, or needs help." },
      { title: "Daily voice check-ins", body: "A simple call that can surface mood, symptoms, and risk." },
      { title: "Safety signals", body: "When something feels off, the care circle gets context sooner." },
      { title: "Engagement", body: "Stories, music, memory games, and reasons to stay connected." },
    ],
    featuresHeading: "One companion. Many ways to help.",
    featuresIntro: "VYVA connects the daily pieces of care: health, medication, safety, engagement, family updates, and practical help.",
    features: [
      { title: "Telehealth Support", body: "Health context, providers, emergency details, and clearer remote consultations." },
      { title: "Medication Management", body: "Reminders, confirmations, routines, and adherence context." },
      { title: "Daily Voice Check-ins", body: "Natural check-ins by phone, app, or familiar channels." },
      { title: "Symptom Checking", body: "Structured questions when someone does not feel well." },
      { title: "24/7 Companionship", body: "Always-available support for conversation, reassurance, and daily engagement." },
      { title: "Safety Protocols", body: "Fall context, urgent signals, scam awareness, privacy, and consent." },
      { title: "Brain Coach", body: "Memory games, stories, music, quizzes, and gentle engagement." },
      { title: "Concierge Help", body: "Local support, useful places, services, and everyday assistance." },
      { title: "Family Dashboard", body: "Trusted people stay informed without taking over." },
    ],
    valuesHeading: "Your support stays yours.",
    valuesIntro: "VYVA helps without taking over: private by default, consent-led, and built around the people you trust.",
    values: ["Supports independence", "Keeps routines easier", "Brings trusted people closer", "Protects privacy and consent"],
    caregiverHeading: "A companion for the parts of care that happen every day.",
    caregiverIntro: "Warm enough to feel personal. Practical enough to help with routines, health context, and follow-through.",
    outcomes: [
      { title: "For seniors", body: "A friendly voice, practical reminders, and support that feels human." },
      { title: "For families", body: "More confidence between calls, visits, and busy days." },
      { title: "For care teams", body: "Better context before small issues turn into emergencies." },
    ],
    finalHeading: "Start with one daily check-in.",
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
  const localizedHeroFeatureSet = localizedFullFeatureSet.map((item, index) => ({
    ...item,
    title: copy.heroFeatures[index],
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
          <h1 className="max-w-[780px] font-body text-[3.05rem] font-black leading-[0.96] text-[#8253AB] sm:text-[4.7rem] lg:text-[5.7rem]">
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
